import { Option, Result, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback, useMemo } from "react";

import { RoomCode } from "@trivia-night/domain/schemas";
import type { TriviaRoomAction } from "@trivia-night/domain/schemas";

import { emptyRoomStateAtom, roomActionAtom, roomKey, roomStateAtom } from "./room-atoms";

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

const useRemoteRoom = (code: RoomCode | undefined) => {
  const stateAtom = useMemo(
    () =>
      code === undefined ? emptyRoomStateAtom : Atom.withRefresh(roomStateAtom(code), "2 seconds"),
    [code],
  );
  const stateResult = useAtomValue(stateAtom);
  const actionResult = useAtomValue(roomActionAtom);
  const setAction = useAtomSet(roomActionAtom);

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
      if (code === undefined) return;
      setAction({ payload: { action, code }, reactivityKeys: [roomKey(code)] });
    },
    [code, setAction],
  );

  return {
    connected: Option.isSome(AsyncResult.value(stateResult)),
    error: Option.getOrUndefined(actionError) ?? Option.getOrUndefined(queryError),
    send,
    state,
  } as const;
};

export const useRoom = (rawCode: string) => {
  const codeResult = useMemo(
    () => Schema.decodeResult(RoomCode)(rawCode.trim().toUpperCase()),
    [rawCode],
  );
  const code = Result.isSuccess(codeResult) ? codeResult.success : undefined;
  const remote = useRemoteRoom(code);

  return {
    code,
    connected: remote.connected,
    error: code === undefined ? "Use a room code with 3 to 8 letters or numbers." : remote.error,
    send: remote.send,
    state: remote.state,
  } as const;
};
