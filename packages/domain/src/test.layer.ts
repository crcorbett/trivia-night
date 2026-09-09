import { Array, Effect, Layer, Option, Ref } from "effect";

import { TriviaSectionNotFoundError } from "./errors";
import type { TriviaSection, TriviaSectionId } from "./schemas";
import { TriviaService } from "./service";

export const makeTriviaTest = (sections: readonly TriviaSection[]) =>
  Effect.gen(function* () {
    const requested = yield* Ref.make<readonly TriviaSectionId[]>([]);
    const layer = Layer.succeed(TriviaService, {
      getSection: (id) =>
        Ref.update(requested, Array.append(id)).pipe(
          Effect.andThen(
            Effect.fromOption(
              Option.fromUndefinedOr(sections.find((section) => section.id === id)),
              () => new TriviaSectionNotFoundError({ id }),
            ),
          ),
        ),
      listSections: Effect.succeed(sections),
    });
    return { layer, observations: { requested } } as const;
  });
