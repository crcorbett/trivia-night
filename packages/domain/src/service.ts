import { Context } from "effect";
import type { Effect } from "effect";

import type { TriviaSectionNotFoundError } from "./errors";
import type { TriviaSection, TriviaSectionId } from "./schemas";

export interface ITriviaService {
  readonly getSection: (
    id: TriviaSectionId,
  ) => Effect.Effect<TriviaSection, TriviaSectionNotFoundError>;
  readonly listSections: Effect.Effect<readonly TriviaSection[]>;
}

export class TriviaService extends Context.Service<TriviaService, ITriviaService>()(
  "@trivia-night/domain/TriviaService",
) {}
