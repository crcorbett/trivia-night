import { TriviaSectionNotFoundError } from "@trivia-night/domain/errors";
import { TriviaSection } from "@trivia-night/domain/schemas";
import { TriviaSectionId } from "@trivia-night/domain/schemas";
import { Schema } from "effect";
import {
  HttpApiEndpoint as EffectHttpApiEndpoint,
  HttpApiGroup as EffectHttpApiGroup,
  HttpApiSchema as EffectHttpApiSchema,
} from "effect/unstable/httpapi";

const NotFound = TriviaSectionNotFoundError.pipe(EffectHttpApiSchema.status(404));

export const HttpApiGroup = EffectHttpApiGroup.make("trivia")
  .add(
    EffectHttpApiEndpoint.get("listSections", "/api/sections", {
      success: Schema.Array(TriviaSection),
    }),
  )
  .add(
    EffectHttpApiEndpoint.get("getSection", "/api/sections/:id", {
      error: NotFound,
      params: Schema.Struct({ id: TriviaSectionId }),
      success: TriviaSection,
    }),
  );
