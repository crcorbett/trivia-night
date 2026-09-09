# Architecture

The repository is a Bun/Turbo monorepo. `apps/web` owns the TanStack Start
application, the host/player/display views, and Effect execution at framework
boundaries. `packages/domain` owns the trivia sections, room schemas, typed
failures, and pure room reducer. `packages/rpc` and `packages/http-api` own
transport contracts for the section catalogue. `packages/effect-start` owns
framework codec adaptation.

The root `alchemy.run.ts` declares two Cloudflare resources: a `RoomWorker`
with one SQLite-backed `TriviaRoom` Durable Object per room code, and a
`Website` built with `Cloudflare.Website.Vite`. The Website receives the room
Worker URL as a build-time `VITE_ROOM_API_URL` value. The native Cloudflare
class in `apps/web/src/room-worker.ts` is a narrow host adapter; game rules do
not live there.

Focused architecture decisions live under [`docs/architecture/`](docs/architecture/).
Operational procedures live under [`docs/runbooks/`](docs/runbooks/); proof and
current task state are intentionally separate. Start at [`docs/README.md`](docs/README.md).

Implementation guidance for the pinned Effect and Alchemy versions lives in
the shallow Git references under [`.references/`](.references/). They are
read-only submodules, not application dependencies.
