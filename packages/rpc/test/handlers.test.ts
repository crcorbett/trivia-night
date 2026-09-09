import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { TriviaLive } from "@trivia-night/domain/live";

import { TriviaRpcClient } from "../src/service";
import { TriviaRpcClientTest } from "../src/test.layer";

describe("Trivia RPC", () => {
  it.effect("lists through the in-process client", () =>
    Effect.gen(function* () {
      const client = yield* TriviaRpcClient;
      const sections = yield* client.listSections();
      assert.isArray(sections);
      assert.isAbove(sections.length, 0);
    }).pipe(Effect.provide(TriviaRpcClientTest.pipe(Layer.provide(TriviaLive)))),
  );
});
