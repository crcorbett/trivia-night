import { Option, Result, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { applyRoomAction, createInitialRoomState } from "@trivia-night/domain/room";
import { triviaSections } from "@trivia-night/domain/sections";
import { RoomCode, TriviaRoomAction, TriviaRoomState } from "@trivia-night/domain/schemas";

import {
  emptyRoomStateAtom,
  hasRemoteRoomApi,
  roomActionAtom,
  roomApiUrl,
  roomKey,
  roomStateAtom,
} from "./room-atoms";
import { appendUrlPath, toWebSocketUrl } from "./url";

type RoomListener = (state: TriviaRoomState) => void;

interface RoomConnection {
  readonly connected: boolean;
  readonly error: string | undefined;
  readonly send: (action: TriviaRoomAction) => void;
  readonly start: (listener: RoomListener) => void;
  readonly stop: () => void;
}

const TriviaRoomStateJson = Schema.fromJsonString(TriviaRoomState);
const decodeState = Schema.decodeUnknownOption(TriviaRoomState);
const decodeStateJson = Schema.decodeOption(TriviaRoomStateJson);
const decodeAction = Schema.decodeUnknownOption(TriviaRoomAction);
const encodeStateJson = Schema.encodeOption(TriviaRoomStateJson);

const initialState = (code: RoomCode) => createInitialRoomState(code, triviaSections.length);

const localStorageKey = (code: RoomCode) => `trivia-night:room:${code}`;

const readLocalState = (code: RoomCode): TriviaRoomState => {
  if (typeof window === "undefined") return initialState(code);
  const stored = window.localStorage.getItem(localStorageKey(code));
  if (stored === null) return initialState(code);
  const decoded = decodeStateJson(stored);
  return Option.isSome(decoded) ? decoded.value : initialState(code);
};

/** Browser-only adapter: local rehearsal uses BroadcastChannel and localStorage. */
const makeLocalConnection = (code: RoomCode): RoomConnection => {
  let state = initialState(code);
  let listener: RoomListener | undefined;
  let channel: BroadcastChannel | undefined;
  let connected = false;
  let error: string | undefined;

  const publish = (next: TriviaRoomState) => {
    const encoded = encodeStateJson(next);
    if (Option.isNone(encoded)) {
      error = "That update could not be saved.";
      return;
    }
    state = next;
    window.localStorage.setItem(localStorageKey(code), encoded.value);
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
      if (Option.isNone(decodedAction)) {
        error = "That action could not be read.";
        return;
      }
      const next = applyRoomAction(state, decodedAction.value);
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
        if (Option.isNone(next)) return;
        state = next.value;
        listener?.(next.value);
      });
      window.addEventListener("storage", (event) => {
        if (event.key !== localStorageKey(code) || event.newValue === null) return;
        const next = decodeStateJson(event.newValue);
        if (Option.isNone(next)) return;
        state = next.value;
        listener?.(next.value);
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

const describeRemoteError = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "TriviaRoomActionError" &&
    "reason" in error &&
    typeof error.reason === "string"
  ) {
    return describeRoomError(error.reason);
  }
  return "The room could not be reached.";
};

const useLocalRoom = (code: RoomCode | undefined) => {
  const connection = useMemo(
    () => (hasRemoteRoomApi || code === undefined ? undefined : makeLocalConnection(code)),
    [code],
  );
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
    connected: connection?.connected ?? false,
    error: connection?.error,
    send,
    state,
  } as const;
};

const useRemoteRoom = (code: RoomCode | undefined) => {
  const stateAtom = useMemo(
    () => (hasRemoteRoomApi && code !== undefined ? roomStateAtom(code) : emptyRoomStateAtom),
    [code],
  );
  const stateResult = useAtomValue(stateAtom);
  const actionResult = useAtomValue(roomActionAtom);
  const refreshState = useAtomRefresh(stateAtom);
  const setAction = useAtomSet(roomActionAtom);
  const webSocketUrl = useMemo(
    () =>
      hasRemoteRoomApi && code !== undefined && roomApiUrl !== undefined
        ? Option.flatMap(appendUrlPath(roomApiUrl, ["rooms", code, "ws"]), toWebSocketUrl)
        : Option.none(),
    [code],
  );
  const [socketState, setSocketState] = useState<{
    readonly code: RoomCode | undefined;
    readonly connected: boolean;
    readonly error: string | undefined;
  }>({ code: undefined, connected: false, error: undefined });
  const connectionState =
    socketState.code === code ? socketState : { code, connected: false, error: undefined };

  useEffect(() => {
    if (!hasRemoteRoomApi || code === undefined || roomApiUrl === undefined) return;

    let active = true;
    if (Option.isNone(webSocketUrl)) return;
    // The browser WebSocket is the platform boundary. Effect Atom owns the
    // typed HTTP RPC reads/actions; socket events only invalidate that atom.
    const socket = new WebSocket(webSocketUrl.value.toString());

    socket.addEventListener("open", () => {
      if (!active) return;
      setSocketState({ code, connected: true, error: undefined });
      refreshState();
    });
    socket.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (!active || typeof event.data !== "string") return;
      if (Option.isNone(decodeStateJson(event.data))) {
        setSocketState({
          code,
          connected: true,
          error: "The room sent an unreadable update.",
        });
        return;
      }
      refreshState();
    });
    socket.addEventListener("error", () => {
      if (active) {
        setSocketState({ code, connected: false, error: "The room could not be reached." });
      }
    });
    socket.addEventListener("close", () => {
      if (active) {
        setSocketState((current) => ({
          code,
          connected: false,
          error: current.code === code ? current.error : undefined,
        }));
      }
    });

    return () => {
      active = false;
      socket.close();
    };
  }, [code, refreshState, webSocketUrl]);

  const state = Option.getOrUndefined(AsyncResult.value(stateResult));
  const actionError = AsyncResult.matchWithError(actionResult, {
    onDefect: () => Option.some("The room could not be reached."),
    onError: (error) => Option.some(describeRemoteError(error)),
    onInitial: () => Option.none<string>(),
    onSuccess: () => Option.none<string>(),
  });
  const queryError = AsyncResult.matchWithError(stateResult, {
    onDefect: () => Option.some("The room could not be reached."),
    onError: (error) => Option.some(describeRemoteError(error)),
    onInitial: () => Option.none<string>(),
    onSuccess: () => Option.none<string>(),
  });

  const send = useCallback(
    (action: TriviaRoomAction) => {
      if (!hasRemoteRoomApi || code === undefined) return;
      setAction({ payload: { action, code }, reactivityKeys: [roomKey(code)] });
    },
    [code, setAction],
  );

  return {
    connected: connectionState.connected,
    error:
      connectionState.error ??
      (hasRemoteRoomApi && code !== undefined && Option.isNone(webSocketUrl)
        ? "The room could not be reached."
        : undefined) ??
      Option.getOrUndefined(actionError) ??
      Option.getOrUndefined(queryError),
    send,
    state: state ?? (code === undefined ? undefined : initialState(code)),
  } as const;
};

export const useRoom = (rawCode: string) => {
  const codeResult = useMemo(
    () => Schema.decodeResult(RoomCode)(rawCode.trim().toUpperCase()),
    [rawCode],
  );
  const code = Result.isSuccess(codeResult) ? codeResult.success : undefined;
  const local = useLocalRoom(code);
  const remote = useRemoteRoom(code);
  const selected = hasRemoteRoomApi ? remote : local;

  return {
    code,
    connected: selected.connected,
    error: code === undefined ? "Use a room code with 3 to 8 letters or numbers." : selected.error,
    send: selected.send,
    state: selected.state,
  } as const;
};
