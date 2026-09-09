# RPC and HTTP transport boundaries

`packages/rpc` and `packages/http-api` own their wire contracts, handlers,
named clients, server composition, and transport tests. They reuse domain
Schemas, branded identifiers, tagged errors, and service operations rather than
redeclaring semantic policy. Browser HTTP uses Fetch; server loaders use the
in-process HTTP client; the section catalogue uses its named RPC client
service. The room contract in `packages/rpc/src/room-group.ts` is served by the
Effect Worker with `RpcServer.toHttpEffect` and is consumed in the browser by
`AtomRpc`. Live room updates use the separate Cloudflare WebSocket only to
refresh that typed room query.

A public transport change updates this page, the affected package README and
tests, `docs/critical-journeys/journeys.json`, and a claim-matched proof packet
in the same slice. Domain semantic changes update the domain schema/service
owners first. Encoding and decoding occur only at ingress/egress boundaries.
