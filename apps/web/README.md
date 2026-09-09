# Web

TanStack Start/Vite application for the trivia night. It owns the home agenda,
host desk, player join screen, projected display, SSR server adapter, and the
browser room connection.

## Routes

- `/`: the seven-section running order and timing.
- `/host`: host controls for room `RAE60`, section changes and scores.
- `/join/:roomCode`: team join screen for a phone.
- `/display/:roomCode`: large-screen current section and scoreboard.

The browser room adapter uses local BroadcastChannel/localStorage when
`VITE_ROOM_API_URL` is absent. A deployed build uses `@effect/atom-react` and
the shared room RPC contract for room reads/actions. The Worker WebSocket is
used only for live update notifications; those notifications refresh the
typed room atom. Both endpoints are supplied by Alchemy.

Use `bun --filter @trivia-night/web build:cloudflare` to check the Cloudflare-specific Vite
configuration. This is still a local build; it does not deploy or read provider
state.

`room-worker.ts` contains the Effect Worker and Durable Object definitions.
Alchemy yields the Worker from the root stack and bundles this file as its
entrypoint. The Durable Object keeps hibernation and storage details at the
edge and delegates every game transition to `@trivia-night/domain/room`.
