import { assert, describe, it } from "@effect/vitest";
import { Effect, Result, Schema } from "effect";
import { createSerializableLoader } from "../src/loader";

describe("serializable loader", () => {
  it.effect("round-trips success", () =>
    Effect.gen(function* () {
      const loader = createSerializableLoader({ error: Schema.String, success: Schema.String });
      const encoded = yield* loader.encodeExit(Effect.succeed("ok"));
      const decoded = loader.decode(encoded);
      assert.isTrue(Result.isSuccess(decoded));
    }),
  );
});
