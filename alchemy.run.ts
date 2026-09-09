import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Stack } from "alchemy/Stack";
import { Effect } from "effect";

export const TriviaRoom = Cloudflare.DurableObject("TriviaRoom", {
  className: "TriviaRoom",
});

export const RoomWorker = Cloudflare.Worker("RoomWorker", {
  compatibility: { date: "2026-06-24", flags: ["nodejs_compat"] },
  env: { TRIVIA_ROOM: TriviaRoom },
  main: "./apps/web/src/room-worker.ts",
});

export const Website = Cloudflare.Website.Vite("Website", {
  compatibility: { date: "2026-06-24", flags: ["nodejs_compat"] },
  env: { VITE_ROOM_API_URL: RoomWorker.pipe(Effect.map((worker) => worker.url.as<string>())) },
  rootDir: "apps/web",
});

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

export default Alchemy.Stack(
  "TriviaNightCloudflare",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const stack = yield* Stack;
    const roomWorker = yield* RoomWorker;
    const website = yield* Website;
    return {
      roomWorkerUrl: roomWorker.url,
      stage: stack.stage,
      websiteUrl: website.url,
    };
  }),
);
