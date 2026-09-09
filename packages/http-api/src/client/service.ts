import type { TriviaSectionNotFoundError } from "@trivia-night/domain/errors";
import type { TriviaSection, TriviaSectionId } from "@trivia-night/domain/schemas";
import { Context } from "effect";
import type { Effect, Schema } from "effect";
import type { HttpClientError } from "effect/unstable/http/HttpClientError";

export interface ITriviaHttpApiClient {
  readonly getSection: (
    id: TriviaSectionId,
  ) => Effect.Effect<
    TriviaSection,
    TriviaSectionNotFoundError | HttpClientError | Schema.SchemaError
  >;
  readonly listSections: () => Effect.Effect<
    readonly TriviaSection[],
    HttpClientError | Schema.SchemaError
  >;
}

export class HttpApiClientService extends Context.Service<
  HttpApiClientService,
  ITriviaHttpApiClient
>()("@trivia-night/http-api/TriviaClient") {}
