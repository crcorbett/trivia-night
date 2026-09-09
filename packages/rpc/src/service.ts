import type { TriviaSectionNotFoundError } from "@trivia-night/domain/errors";
import type { TriviaSection, TriviaSectionId } from "@trivia-night/domain/schemas";
import { Context } from "effect";
import type { Effect } from "effect";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";

export interface ITriviaRpcClient {
  readonly getSection: (
    id: TriviaSectionId,
  ) => Effect.Effect<TriviaSection, TriviaSectionNotFoundError | RpcClientError>;
  readonly listSections: Effect.Effect<readonly TriviaSection[], RpcClientError>;
}

export class TriviaRpcClient extends Context.Service<TriviaRpcClient, ITriviaRpcClient>()(
  "@trivia-night/rpc/TriviaRpcClient",
) {}
