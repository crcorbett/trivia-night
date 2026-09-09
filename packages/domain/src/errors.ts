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

export const TriviaRoomStateErrorReason = Schema.Literals(["invalid-state", "room-code-mismatch"]);
export type TriviaRoomStateErrorReason = typeof TriviaRoomStateErrorReason.Type;

export class TriviaRoomStateError extends Schema.TaggedError<TriviaRoomStateError>()(
  "TriviaRoomStateError",
  { reason: TriviaRoomStateErrorReason },
) {}

export class TriviaRoomUnavailableError extends Schema.TaggedError<TriviaRoomUnavailableError>()(
  "TriviaRoomUnavailableError",
  { reason: Schema.Literal("rpc-client") },
) {}
