# `@trivia-night/rpc`

Effect RPC transport over `@trivia-night/domain`. Domain policy remains in the
domain service/reducer; this package owns the section-catalogue and room RPC
contracts, handlers, clients, and server composition.

## Exports

- `./group`: public RPC contract group.
- `./room`: public room snapshot/action contract used by the Cloudflare Worker
  and Effect Atom frontend client.
- `./handlers`: server handler Layer.
- `./service`: public RPC client service contract.
- `./server`: HTTP/RPC server composition.
- `./live`: production client Layer.
- `./test`: deterministic in-process test Layer.

The public catalogue operations are `listSections` and `getSection`. The room
operations are `GetRoomState` and `ApplyTriviaRoomAction`.

## Documentation impact

Public RPC changes update the repository transport architecture owner and
affected critical journeys/proof in the same slice.

## Runbook applicability

Provider operations, authority, and runbooks remain repository-owned. Add or
update a target-owned runbook only when an operation or deployment changes.

## Non-claims

This package makes no deployment, provider-state, network-reachability, or
packed-publisher claim.
