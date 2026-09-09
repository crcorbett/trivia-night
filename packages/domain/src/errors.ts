import { Schema } from "effect";

import { TriviaSectionId, TriviaRoomActionErrorReason } from "./schemas";

export class TriviaSectionNotFoundError extends Schema.TaggedError<TriviaSectionNotFoundError>()(
  "TriviaSectionNotFoundError",
  { id: TriviaSectionId },
) {}

export class TriviaRoomActionError extends Schema.TaggedError<TriviaRoomActionError>()(
  "TriviaRoomActionError",
  { reason: TriviaRoomActionErrorReason },
) {}
