# Frontend composition

Routes and feature boundaries own data loading, Effect/service execution,
mutations, commands, shared state, workflow/error policy, and SSR restoration.
Presentation leaves receive narrow readonly values and action callbacks, then
own rendering, accessibility, pure derivation, and genuinely local UI state.
Prefer children/slots and colocated feature components. Reject service-aware
leaves, boolean-prop matrices, synchronization Effects, hooks that rename one
call, and giant route components.

The host, join, and display routes share only the browser room adapter. That
adapter selects local BroadcastChannel/localStorage rehearsal or the deployed
Worker connection at one platform boundary; the routes do not know about
Durable Object storage. In the deployed mode, `@effect/atom-react` provides a
shared `RegistryProvider` and `AtomRpc` client for typed room snapshots and
actions. The browser WebSocket is kept as a small platform boundary: valid
socket messages refresh the room atom, so HTTP RPC remains the single typed
read/write path.
