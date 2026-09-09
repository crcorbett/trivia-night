import {
  TriviaRoomActionError,
  TriviaRoomStateError,
  TriviaRoomUnavailableError,
} from "@trivia-night/domain/errors";
import { RoomCode, TriviaRoomAction, TriviaRoomState } from "@trivia-night/domain/schemas";
import { Schema } from "effect";
import * as EffectRpc from "effect/unstable/rpc/Rpc";
import * as EffectRpcGroup from "effect/unstable/rpc/RpcGroup";

export class GetRoomState extends EffectRpc.make("GetRoomState", {
  error: Schema.Union([TriviaRoomStateError, TriviaRoomUnavailableError]),
  payload: Schema.Struct({ code: RoomCode }),
  success: TriviaRoomState,
}) {}

export class ApplyTriviaRoomAction extends EffectRpc.make("ApplyTriviaRoomAction", {
  error: Schema.Union([TriviaRoomActionError, TriviaRoomStateError, TriviaRoomUnavailableError]),
  payload: Schema.Struct({ code: RoomCode, action: TriviaRoomAction }),
  success: TriviaRoomState,
}) {}

export const RoomRpcGroup = EffectRpcGroup.make(GetRoomState, ApplyTriviaRoomAction);
