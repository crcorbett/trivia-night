import "@tanstack/react-start/server-only";
import { TriviaLive } from "@trivia-night/domain/live";
import { makeHttpApiInProcessClient } from "@trivia-night/http-api/client/in-process";
import { HttpApiRoutes } from "@trivia-night/http-api/server";
import { RpcHttpLayer } from "@trivia-night/rpc/server";
import { Layer, ManagedRuntime } from "effect";
import { HttpRouter } from "effect/unstable/http";

export const rpcWebHandler = HttpRouter.toWebHandler(RpcHttpLayer.pipe(Layer.provide(TriviaLive)), {
  disableLogger: true,
});
export const httpApiWebHandler = HttpRouter.toWebHandler(
  HttpApiRoutes.pipe(Layer.provide(TriviaLive)),
  { disableLogger: true },
);

const ServerLive = makeHttpApiInProcessClient(httpApiWebHandler.handler).pipe(
  Layer.provideMerge(TriviaLive),
);
export const serverRuntime = ManagedRuntime.make(ServerLive);
export const disposeServerRuntime = () => serverRuntime.dispose();
