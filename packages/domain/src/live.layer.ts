import { Effect, Layer, Option } from "effect";

import { TriviaSectionNotFoundError } from "./errors";
import { triviaSections } from "./sections";
import { TriviaService } from "./service";

export const TriviaLive = Layer.succeed(TriviaService, {
  getSection: (id) =>
    Effect.fromOption(
      Option.fromUndefinedOr(triviaSections.find((section) => section.id === id)),
      () => new TriviaSectionNotFoundError({ id }),
    ),
  listSections: Effect.succeed(triviaSections),
});
