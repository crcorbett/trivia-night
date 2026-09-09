import { rpcWebHandler } from "$/lib/runtime.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(machine)/rpc")({
  server: { handlers: { POST: ({ request }) => rpcWebHandler.handler(request) } },
});
