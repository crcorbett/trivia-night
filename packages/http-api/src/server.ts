import { Layer } from "effect";
import { HttpServer } from "effect/unstable/http";
import { HttpApiBuilder as EffectHttpApiBuilder } from "effect/unstable/httpapi";

import { HttpApiApi } from "./api";
import { HttpApiHandlersLive } from "./handlers";

export const HttpApiRoutes = EffectHttpApiBuilder.layer(HttpApiApi).pipe(
  Layer.provide(HttpApiHandlersLive),
  Layer.provide(HttpServer.layerServices),
);
