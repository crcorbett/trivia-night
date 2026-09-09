import { Effect, Layer } from "effect";
import * as EffectRpcTest from "effect/unstable/rpc/RpcTest";

import { RpcGroup } from "./group";
import { RpcHandlersLive } from "./handlers";
import { TriviaRpcClient } from "./service";

export const TriviaRpcClientTest = Layer.effect(
  TriviaRpcClient,
  EffectRpcTest.makeClient(RpcGroup).pipe(
    Effect.map((client) =>
      TriviaRpcClient.of({
        getSection: (id) => client.GetTriviaSection({ id }),
        listSections: () => client.ListTriviaSections(),
      }),
    ),
  ),
).pipe(Layer.provide(RpcHandlersLive));
