import { TriviaService } from "@trivia-night/domain/service";
import { Effect } from "effect";

import { RpcGroup } from "./group";

export const RpcHandlersLive = RpcGroup.toLayer(
  Effect.gen(function* () {
    const trivia = yield* TriviaService;
    return RpcGroup.of({
      GetTriviaSection: ({ id }) => trivia.getSection(id),
      ListTriviaSections: () => trivia.listSections(),
    });
  }),
);
