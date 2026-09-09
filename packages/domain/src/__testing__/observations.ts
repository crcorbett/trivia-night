import type { Ref } from "effect";

import type { TriviaSectionId } from "../schemas";

export interface TriviaObservations {
  readonly requested: Ref.Ref<readonly TriviaSectionId[]>;
}
