import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient as EffectRpcClient, RpcSerialization } from "effect/unstable/rpc";

import { RpcGroup } from "./group";
import { TriviaRpcClient } from "./service";

export const TriviaRpcClientLive = Layer.effect(TriviaRpcClient)(
  EffectRpcClient.make(RpcGroup).pipe(
    Effect.map((client) =>
      TriviaRpcClient.of({
        getSection: (id) => client.GetTriviaSection({ id }),
        listSections: () => client.ListTriviaSections(),
      }),
    ),
  ),
).pipe(
  Layer.provide(EffectRpcClient.layerProtocolHttp({ url: "/rpc" })),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(RpcSerialization.layerNdjson),
);
