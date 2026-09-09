import { Effect, Layer, Option } from "effect";

import { TriviaSectionNotFoundError } from "./errors";
import { triviaSections } from "./sections";
import { TriviaService } from "./service";

export const TriviaLive = Layer.succeed(TriviaService, {
  getSection: (id) =>
    Option.fromUndefinedOr(triviaSections.find((section) => section.id === id)).pipe(
      Option.match({
        onNone: () => Effect.fail(new TriviaSectionNotFoundError({ id })),
        onSome: Effect.succeed,
      }),
    ),
  listSections: () => Effect.succeed(triviaSections),
});
