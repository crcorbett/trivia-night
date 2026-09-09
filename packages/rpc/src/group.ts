import { TriviaSectionNotFoundError } from "@trivia-night/domain/errors";
import { TriviaSection, TriviaSectionId } from "@trivia-night/domain/schemas";
import { Schema } from "effect";
import * as EffectRpc from "effect/unstable/rpc/Rpc";
import * as EffectRpcGroup from "effect/unstable/rpc/RpcGroup";

export class ListTriviaSections extends EffectRpc.make("ListTriviaSections", {
  success: Schema.Array(TriviaSection),
}) {}

export class GetTriviaSection extends EffectRpc.make("GetTriviaSection", {
  error: TriviaSectionNotFoundError,
  payload: Schema.Struct({ id: TriviaSectionId }),
  success: TriviaSection,
}) {}

export const RpcGroup = EffectRpcGroup.make(ListTriviaSections, GetTriviaSection);
