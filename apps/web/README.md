# Web

TanStack Start/Vite application for the trivia night. It owns the home agenda,
host desk, player join screen, projected display, SSR server adapter, and the
browser room connection.

## Routes

- `/`: the seven-section running order and timing.
- `/host`: host controls for room `RAE60`, section changes and scores.
- `/join/:roomCode`: team join screen for a phone.
- `/display/:roomCode`: large-screen current section and scoreboard.

The browser room adapter always uses `@effect/atom-react` and the shared room
RPC contract for room reads/actions. A runtime `VITE_ROOM_API_URL` points to
the Room Worker; Alchemy supplies it in deployed builds. `Atom.withRefresh`
polls the typed room query every two seconds. Without the URL, room pages show
the connection state but cannot join or control a room.

Use `bun --filter @trivia-night/web build:cloudflare` to check the Cloudflare-specific Vite
configuration. This is still a local build; it does not deploy or read provider
state.

`room-worker.ts` contains the Effect Worker and Durable Object definitions.
Alchemy yields the Worker from the root stack and bundles this file as its
entrypoint. The Durable Object keeps hibernation and storage details at the
edge and delegates every game transition to `@trivia-night/domain/room`.
