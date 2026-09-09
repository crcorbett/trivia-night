import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { exampleSection } from "../src/__testing__/fixtures";
import { TriviaService } from "../src/service";
import { makeTriviaTest } from "../src/test.layer";

describe("TriviaService", () => {
  it.effect("uses the deterministic Layer", () =>
    Effect.gen(function* () {
      const setup = yield* makeTriviaTest([exampleSection]);
      const item = yield* Effect.gen(function* () {
        const service = yield* TriviaService;
        return yield* service.getSection(exampleSection.id);
      }).pipe(Effect.provide(setup.layer));
      assert.strictEqual(item.title, "Two Time Capsules");
    }),
  );
});
