import { Cause, Effect, Exit, Option, Schema } from "effect";

type SyncSchema = Schema.Top & {
  readonly DecodingServices: never;
  readonly EncodingServices: never;
};

export const createSerializableLoader = <
  Success extends SyncSchema,
  Failure extends SyncSchema,
>(schemas: {
  readonly error: Failure;
  readonly success: Success;
}) => {
  const codec = Schema.toCodecJson(Schema.Exit(schemas.success, schemas.error, Schema.Never));
  const decode = Schema.decodeUnknownResult(codec);
  return {
    decode,
    encodeExit: <R>(program: Effect.Effect<Success["Type"], Failure["Type"], R>) =>
      Effect.exit(program).pipe(
        Effect.flatMap((exit) => {
          if (
            Exit.isFailure(exit) &&
            (Cause.hasDies(exit.cause) || Cause.hasInterrupts(exit.cause))
          ) {
            return Effect.failCause(exit.cause);
          }
          return Schema.encodeUnknownEffect(codec)(exit).pipe(Effect.orDie);
        }),
      ),
    matchExit: <OnSuccess, OnFailure>(
      exit: Exit.Exit<Success["Type"], Failure["Type"]>,
      handlers: {
        readonly onFailure: (error: Failure["Type"]) => OnFailure;
        readonly onSuccess: (value: Success["Type"]) => OnSuccess;
      },
    ) =>
      Exit.isSuccess(exit)
        ? handlers.onSuccess(exit.value)
        : handlers.onFailure(Exit.findErrorOption(exit).pipe(Option.getOrThrow)),
  } as const;
};
