# RPC and HTTP transport boundaries

`packages/rpc` and `packages/http-api` own their wire contracts, handlers,
named clients, server composition, and transport tests for the section
catalogue. They reuse domain Schemas, branded identifiers, tagged errors, and
service operations rather than redeclaring semantic policy. Browser HTTP uses
Fetch; server loaders use the in-process HTTP client; RPC uses its named client
service. Live room state uses the separate Cloudflare Worker WebSocket/HTTP
adapter and the same domain reducer.

A public transport change updates this page, the affected package README and
tests, `docs/critical-journeys/journeys.json`, and a claim-matched proof packet
in the same slice. Domain semantic changes update the domain schema/service
owners first. Encoding and decoding occur only at ingress/egress boundaries.
