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
            Option.fromUndefinedOr(sections.find((section) => section.id === id)).pipe(
              Option.match({
                onNone: () => Effect.fail(new TriviaSectionNotFoundError({ id })),
                onSome: Effect.succeed,
              }),
            ),
          ),
        ),
      listSections: () => Effect.succeed(sections),
    });
    return { layer, observations: { requested } } as const;
  });
