import { Layer } from "effect";
import { RpcSerialization, RpcServer as EffectRpcServer } from "effect/unstable/rpc";

import { RpcGroup } from "./group";
import { RpcHandlersLive } from "./handlers";

export const RpcHttpLayer = EffectRpcServer.layerHttp({
  disableFatalDefects: true,
  group: RpcGroup,
  path: "/rpc",
  protocol: "http",
}).pipe(Layer.provide([RpcHandlersLive, RpcSerialization.layerNdjson]));
