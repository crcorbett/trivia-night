import { httpApiWebHandler } from "$/lib/runtime.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(machine)/api/$")({
  server: { handlers: { GET: ({ request }) => httpApiWebHandler.handler(request) } },
});
