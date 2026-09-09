# Cloudflare and Alchemy

The root `alchemy.run.ts` owns desired state for a `RoomWorker` and a
`Cloudflare.Website.Vite` resource. `RoomWorker` is the Effect Worker exported
by `@trivia-night/web/worker`; the stack yields that resource directly. Its
outer Effect binds one `TriviaRoom` Durable Object namespace, and its request
Effect serves the room RPC endpoint and forwards room paths to the matching
object. Alchemy remote state and Cloudflare provider state remain authoritative
for live identity and must be read just in time.

`apps/web/src/room-worker.ts` follows Alchemy's two-phase Effect pattern. The
outer Durable Object Effect resolves `Cloudflare.DurableObjectState`; the
inner Effect runs storage reads/writes and rebuilds hibernated WebSocket
sessions. Room state is schema-decoded when read, schema-encoded when written,
and persisted before an update is broadcast. Typed Durable Object methods
serve `GetRoomState` and `ApplyTriviaRoomAction`, while the pure domain
reducer remains the source of game rules. Local rehearsal uses browser storage
and does not need provider credentials.

The repository deliberately owns no production zone, DNS route, secret,
deployment workflow, or mutation runbook. When an approved Alchemy command
needs Cloudflare credentials, Doppler should inject them only for that command;
credentials must not be placed in source or a `.env` file. Alchemy state and
Doppler secrets have different jobs: Alchemy tracks deployment state, while
Doppler supplies secrets. Adding a consequential operation requires an
authority decision, rollback/revocation, provider readback, critical journey,
and proof packet. The selected Alchemy version and source commit are recorded
in the repository references.
