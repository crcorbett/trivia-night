# Cloudflare and Alchemy

The root `alchemy.run.ts` owns desired state for a `RoomWorker` and a
`Cloudflare.Website.Vite` resource. The Worker binds one SQLite-backed
`TriviaRoom` Durable Object to each room code. Alchemy remote state and
Cloudflare provider state remain authoritative for live identity and must be
read just in time.

The Cloudflare class in `apps/web/src/room-worker.ts` is a narrow platform
adapter. It persists room state before broadcasting updates and delegates game
rules to the pure domain reducer. Local rehearsal uses browser storage and does
not need provider credentials.

The repository deliberately owns no production zone, DNS route, secret,
deployment workflow, or mutation runbook. When an approved Alchemy command
needs Cloudflare credentials, Doppler should inject them only for that command;
credentials must not be placed in source or a `.env` file. Alchemy state and
Doppler secrets have different jobs: Alchemy tracks deployment state, while
Doppler supplies secrets. Adding a consequential operation requires an
authority decision, rollback/revocation, provider readback, critical journey,
and proof packet. The selected Alchemy version and source commit are recorded
in the repository references.
