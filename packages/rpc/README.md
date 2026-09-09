# `@trivia-night/rpc`

Effect RPC transport over `@trivia-night/domain`. Domain policy remains in the
domain service; this package owns the section-catalogue RPC contract, handlers,
clients, and server composition.

## Exports

- `./group`: public RPC contract group.
- `./handlers`: server handler Layer.
- `./service`: public RPC client service contract.
- `./server`: HTTP/RPC server composition.
- `./live`: production client Layer.
- `./test`: deterministic in-process test Layer.

The public operations are `listSections` and `getSection`.

## Documentation impact

Public RPC changes update the repository transport architecture owner and
affected critical journeys/proof in the same slice.

## Runbook applicability

Provider operations, authority, and runbooks remain repository-owned. Add or
update a target-owned runbook only when an operation or deployment changes.

## Non-claims

This package makes no deployment, provider-state, network-reachability, or
packed-publisher claim.
