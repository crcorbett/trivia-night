# Frontend composition

Routes and feature boundaries own data loading, Effect/service execution,
mutations, commands, shared state, workflow/error policy, and SSR restoration.
Presentation leaves receive narrow readonly values and action callbacks, then
own rendering, accessibility, pure derivation, and genuinely local UI state.
Prefer children/slots and colocated feature components. Reject service-aware
leaves, boolean-prop matrices, synchronization Effects, hooks that rename one
call, and giant route components.

The host, join, and display routes share only the browser room adapter. That
adapter connects to the Room Worker at one platform boundary; the routes do
not know about Durable Object storage. `@effect/atom-react` provides a shared
`RegistryProvider` and `AtomRpc` client for typed room snapshots and actions.
`Atom.withRefresh` polls the room query every two seconds, so the typed HTTP
RPC remains the single remote read/write path.
