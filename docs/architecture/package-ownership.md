# Package ownership

`domain` owns semantic policy. `rpc` and `http-api` are independent transports
over it. `effect-start` owns SSR codec primitives. `apps/web` owns framework
adaptation, execution, runtime composition, and disposal. New packages require a
stable capability boundary and consumer evidence; one-use code stays local.
Workspace consumers import another app or package only through its explicit
exports. Relative imports stay inside their current `apps/*` or `packages/*`
owner.
