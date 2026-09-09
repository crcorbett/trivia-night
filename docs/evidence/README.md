# Evidence

Evidence records outcome, provenance, artifact identity/digest, producer epoch,
collection time, limitations, and retention owner. Keep selected successful,
failed, inconclusive, and superseded evidence durable, but route raw experiments
outside the default context window through [`failed/`](failed/). Evidence does
not become a second owner of current architecture or provider state.
