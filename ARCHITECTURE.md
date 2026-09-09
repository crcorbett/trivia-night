# Architecture

The repository is a Bun/Turbo monorepo. `apps/web` owns the TanStack Start
application, the host/player/display views, and Effect execution at framework
boundaries. `packages/domain` owns the trivia sections, room schemas, typed
failures, and pure room reducer. `packages/rpc` and `packages/http-api` own
transport contracts for the section catalogue. `packages/effect-start` owns
framework codec adaptation.

The root `alchemy.run.ts` imports the exported Effect Worker from
`@trivia-night/web/worker` and yields it in the Alchemy stack. That Worker
binds one Effect `TriviaRoom` Durable Object per room code and serves the
typed room RPC contract. The browser uses Effect Atom to poll typed snapshots
and send typed actions. The Durable Object uses Alchemy's Effect storage
service and the pure domain reducer. The Website is built with
`Cloudflare.Website.Vite` and receives the Worker URL as a build-time
`VITE_ROOM_API_URL` value.

Focused architecture decisions live under [`docs/architecture/`](docs/architecture/).
Operational procedures live under [`docs/runbooks/`](docs/runbooks/); proof and
current task state are intentionally separate. Start at [`docs/README.md`](docs/README.md).

Implementation guidance for the pinned Effect and Alchemy versions lives in
the shallow Git references under [`.references/`](.references/). They are
read-only submodules, not application dependencies.
