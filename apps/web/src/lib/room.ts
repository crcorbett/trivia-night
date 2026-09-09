import { applyRoomAction, createInitialRoomState } from "@trivia-night/domain/room";
import { triviaSections } from "@trivia-night/domain/sections";
import { RoomCode, TriviaRoomAction, TriviaRoomState } from "@trivia-night/domain/schemas";
import { Result, Schema } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";

type RoomListener = (state: TriviaRoomState) => void;

interface RoomConnection {
  readonly connected: boolean;
  readonly error: string | undefined;
  readonly send: (action: TriviaRoomAction) => void;
  readonly start: (listener: RoomListener) => void;
  readonly stop: () => void;
}

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const decodeState = (value: unknown): TriviaRoomState | undefined => {
  const decoded = Schema.decodeUnknownResult(TriviaRoomState)(value);
  return Result.isSuccess(decoded) ? decoded.success : undefined;
};

const decodeAction = (value: unknown): TriviaRoomAction | undefined => {
  const decoded = Schema.decodeUnknownResult(TriviaRoomAction)(value);
  return Result.isSuccess(decoded) ? decoded.success : undefined;
};

const initialState = (code: RoomCode) => createInitialRoomState(code, triviaSections.length);

const localStorageKey = (code: RoomCode) => `trivia-night:room:${code}`;

const readLocalState = (code: RoomCode): TriviaRoomState => {
  if (typeof window === "undefined") return initialState(code);
  const stored = window.localStorage.getItem(localStorageKey(code));
  return stored === null
    ? initialState(code)
    : (decodeState(parseJson(stored)) ?? initialState(code));
};

/** Browser-only adapter: local rehearsal uses BroadcastChannel and localStorage. */
const makeLocalConnection = (code: RoomCode): RoomConnection => {
  let state = initialState(code);
  let listener: RoomListener | undefined;
  let channel: BroadcastChannel | undefined;
  let connected = false;
  let error: string | undefined;

  const publish = (next: TriviaRoomState) => {
    state = next;
    window.localStorage.setItem(localStorageKey(code), JSON.stringify(next));
    // BroadcastChannel.postMessage has no targetOrigin argument.
    // oxlint-disable-next-line unicorn/require-post-message-target-origin
    channel?.postMessage(next);
    listener?.(next);
  };

  return {
    get connected() {
      return connected;
    },
    get error() {
      return error;
    },
    send: (action) => {
      const decodedAction = decodeAction(action);
      if (decodedAction === undefined) {
        error = "That action could not be read.";
        return;
      }
      const next = applyRoomAction(state, decodedAction);
      if (Result.isFailure(next)) {
        error = describeRoomError(next.failure.reason);
        return;
      }
      error = undefined;
      publish(next.success);
    },
    start: (nextListener) => {
      listener = nextListener;
      state = readLocalState(code);
      connected = true;
      channel =
        typeof BroadcastChannel === "undefined"
          ? undefined
          : new BroadcastChannel(localStorageKey(code));
      channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
        const next = decodeState(event.data);
        if (next === undefined) return;
        state = next;
        listener?.(next);
      });
      window.addEventListener("storage", (event) => {
        if (event.key !== localStorageKey(code) || event.newValue === null) return;
        const next = decodeState(parseJson(event.newValue));
        if (next === undefined) return;
        state = next;
        listener?.(next);
      });
      listener(state);
    },
    stop: () => {
      channel?.close();
      channel = undefined;
      connected = false;
      listener = undefined;
    },
  };
};

/** Browser-only adapter: deployed rooms use the Worker WebSocket and HTTP API. */
const makeRemoteConnection = (code: RoomCode, baseUrl: string): RoomConnection => {
  let socket: WebSocket | undefined;
  let listener: RoomListener | undefined;
  let connected = false;
  let error: string | undefined;
  const base = baseUrl.replace(/\/$/u, "");
  const roomPath = `/rooms/${encodeURIComponent(code)}`;

  const receive = (value: unknown) => {
    const next = decodeState(value);
    if (next === undefined) {
      error = "The room sent an unreadable update.";
      return;
    }
    error = undefined;
    listener?.(next);
  };

  return {
    get connected() {
      return connected;
    },
    get error() {
      return error;
    },
    send: (action) => {
      // Fetch is intentionally kept at this browser/Worker adapter boundary.
      void fetch(`${base}${roomPath}`, {
        body: JSON.stringify(action),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then((response) => response.json())
        .then(receive)
        .catch(() => {
          error = "The room could not be reached.";
        });
    },
    start: (nextListener) => {
      listener = nextListener;
      const webSocketUrl = `${base.replace(/^http/u, "ws")}${roomPath}/ws`;
      socket = new WebSocket(webSocketUrl);
      socket.addEventListener("open", () => {
        connected = true;
        error = undefined;
      });
      socket.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (typeof event.data !== "string") return;
        receive(parseJson(event.data));
      });
      socket.addEventListener("error", () => {
        error = "The room could not be reached.";
      });
      socket.addEventListener("close", () => {
        connected = false;
      });
    },
    stop: () => {
      socket?.close();
      socket = undefined;
      connected = false;
      listener = undefined;
    },
  };
};

const roomApiUrl = import.meta.env.VITE_ROOM_API_URL;

const makeConnection = (code: RoomCode): RoomConnection =>
  roomApiUrl === undefined || roomApiUrl === ""
    ? makeLocalConnection(code)
    : makeRemoteConnection(code, roomApiUrl);

const describeRoomError = (reason: string) => {
  switch (reason) {
    case "duplicate-team-name":
      return "That team name is already taken.";
    case "room-not-in-lobby":
      return "The room is already under way.";
    case "room-not-live":
      return "Start the game before changing the score.";
    case "room-finished":
      return "The game has finished.";
    case "unknown-team":
      return "That team is no longer in the room.";
    default:
      return "That action is not available yet.";
  }
};

export const useRoom = (rawCode: string) => {
  const codeResult = useMemo(
    () => Schema.decodeUnknownResult(RoomCode)(rawCode.trim().toUpperCase()),
    [rawCode],
  );
  const code = Result.isSuccess(codeResult) ? codeResult.success : undefined;
  const connection = useMemo(() => (code === undefined ? undefined : makeConnection(code)), [code]);
  const [state, setState] = useState<TriviaRoomState | undefined>(() =>
    code === undefined ? undefined : initialState(code),
  );
  const [, rerender] = useState(0);

  useEffect(() => {
    if (connection === undefined) return;
    connection.start((next) => setState(next));
    return connection.stop;
  }, [connection]);

  const send = useCallback(
    (action: TriviaRoomAction) => {
      connection?.send(action);
      rerender((value) => value + 1);
    },
    [connection],
  );

  return {
    code,
    connected: connection?.connected ?? false,
    error:
      code === undefined ? "Use a room code with 3 to 8 letters or numbers." : connection?.error,
    send,
    state,
  } as const;
};
