import { Option, Result, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback, useMemo } from "react";

import { RoomCode } from "@trivia-night/domain/schemas";
import type { TriviaRoomAction } from "@trivia-night/domain/schemas";

import { emptyRoomStateAtom, roomActionAtom, roomKey, roomStateAtom } from "./room-atoms";
import { describeRemoteError, RemoteRoomError } from "./room-errors";

const decodeRemoteError = Schema.decodeUnknownOption(RemoteRoomError);

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
    onError: (error) =>
      Option.some(
        Option.match(decodeRemoteError(error), {
          onNone: () => "The room could not be reached.",
          onSome: describeRemoteError,
        }),
      ),
    onInitial: () => Option.none<string>(),
    onSuccess: () => Option.none<string>(),
  });
  const queryError = AsyncResult.matchWithError(stateResult, {
    onDefect: () => Option.some("The room could not be reached."),
    onError: (error) =>
      Option.some(
        Option.match(decodeRemoteError(error), {
          onNone: () => "The room could not be reached.",
          onSome: describeRemoteError,
        }),
      ),
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
