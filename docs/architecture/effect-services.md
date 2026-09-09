# Effect services

Contracts use `Context.Service`; live and deterministic test Layers use separate
export paths. The domain owns the seven-section catalogue, room state Schemas,
typed transition failures, and a pure reducer. Serializable boundaries use
Schema errors and codecs. Provider SDKs stay private to live adapters. Browser
clients use Fetch or the typed room RPC client backed by Effect Atom, while
server loaders use in-process handlers. Effects execute only at
app/framework/CLI boundaries.
