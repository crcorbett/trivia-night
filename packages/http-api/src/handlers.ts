import { TriviaService } from "@trivia-night/domain/service";
import { Effect } from "effect";
import { HttpApiBuilder as EffectHttpApiBuilder } from "effect/unstable/httpapi";

import { HttpApiApi } from "./api";

export const HttpApiHandlersLive = EffectHttpApiBuilder.group(HttpApiApi, "trivia", (handlers) =>
  Effect.gen(function* () {
    const trivia = yield* TriviaService;
    return handlers
      .handle("listSections", () => trivia.listSections)
      .handle("getSection", ({ params }) => trivia.getSection(params.id));
  }),
);
