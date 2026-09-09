import * as Cloudflare from "alchemy/Cloudflare";
import { Array as EffectArray, Effect, Layer, Option, Schema, SchemaGetter } from "effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

import { TriviaRoomStateError } from "@trivia-night/domain/errors";
import { applyRoomAction, createInitialRoomState } from "@trivia-night/domain/room";
import { triviaSections } from "@trivia-night/domain/sections";
import { RoomCode, TriviaRoomAction, TriviaRoomState } from "@trivia-night/domain/schemas";
import { RoomRpcGroup } from "@trivia-night/rpc/room";
import { decodePathSegments, decodeUrl } from "./lib/url";

const stateKey = "room-state";

const jsonHeaders = {
  "access-control-allow-headers": "b3, content-type, traceparent",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-origin": "*",
} as const;

const RoomCodeFromString = Schema.String.pipe(
  Schema.decodeTo(RoomCode, {
    decode: SchemaGetter.toUpperCase<string>(),
    encode: SchemaGetter.passthrough<string>(),
  }),
);

const RpcPath = Schema.Tuple([Schema.Literal("rpc")]);
const RoomPath = Schema.Tuple([Schema.Literal("rooms"), RoomCodeFromString]);
const decodeRpcPath = Schema.decodeUnknownOption(RpcPath);
const decodeRoomsPathPrefix = Schema.decodeUnknownOption(Schema.Literal("rooms"));
const decodeRoomPath = Schema.decodeUnknownOption(RoomPath);

const decodeStoredState = (value: unknown) =>
  Schema.decodeUnknownEffect(TriviaRoomState)(value).pipe(
    Effect.mapError(() => new TriviaRoomStateError({ reason: "invalid-state" })),
  );

export class TriviaRoom extends Cloudflare.RpcDurableObject<TriviaRoom>()(
  "TriviaRoom",
  { schema: RoomRpcGroup },
  Effect.gen(function* () {
    const state = yield* Cloudflare.DurableObjectState;

    /* eslint-disable require-yield */
    // @effect-diagnostics-next-line returnEffectInGen:off
    return Effect.gen(function* () {
      const writeState = (roomState: TriviaRoomState) =>
        Schema.encodeEffect(TriviaRoomState)(roomState).pipe(
          Effect.mapError(() => new TriviaRoomStateError({ reason: "invalid-state" })),
          Effect.flatMap((encoded) => state.storage.put(stateKey, encoded)),
        );

      const readOrCreateState = (code: RoomCode) =>
        Effect.gen(function* () {
          const stored = yield* state.storage.get(stateKey);
          if (stored === undefined) {
            const initial = createInitialRoomState(code, triviaSections.length);
            yield* writeState(initial);
            return initial;
          }

          const roomState = yield* decodeStoredState(stored);
          if (roomState.code !== code)
            return yield* new TriviaRoomStateError({ reason: "room-code-mismatch" });
          return roomState;
        });

      const applyAction = (code: RoomCode, action: TriviaRoomAction) =>
        Effect.gen(function* () {
          const current = yield* readOrCreateState(code);
          const next = yield* Effect.fromResult(applyRoomAction(current, action));
          yield* writeState(next);
          return next;
        });

      const handlers = RoomRpcGroup.toLayer(
        Effect.succeed(
          RoomRpcGroup.of({
            GetRoomState: ({ code }) => readOrCreateState(code),
            ApplyTriviaRoomAction: ({ code, action }) => applyAction(code, action),
          }),
        ),
      );

      const rpcLayer = handlers.pipe(Layer.provideMerge(RpcSerialization.layerNdjson));

      // @effect-diagnostics-next-line returnEffectInGen:off
      return RpcServer.toHttpEffect(RoomRpcGroup, {
        disableFatalDefects: true,
      }).pipe(Effect.provide(rpcLayer));
    });
    /* eslint-enable require-yield */
  }),
) {}

export default class RoomWorker extends Cloudflare.Worker<RoomWorker>()(
  "RoomWorker",
  {
    compatibility: { date: "2026-06-24", flags: ["nodejs_compat"] },
    main: import.meta.url,
  },
  Effect.gen(function* () {
    const rooms = yield* TriviaRoom;

    const getRoomState = (code: RoomCode) =>
      rooms.getByName(code).pipe(Effect.flatMap((room) => room.GetRoomState({ code })));

    const applyRoomActionRemotely = (code: RoomCode, action: TriviaRoomAction) =>
      rooms
        .getByName(code)
        .pipe(Effect.flatMap((room) => room.ApplyTriviaRoomAction({ code, action })));

    const handlersLayer = RoomRpcGroup.toLayer(
      Effect.succeed(
        RoomRpcGroup.of({
          GetRoomState: ({ code }) => getRoomState(code).pipe(Effect.orDie),
          ApplyTriviaRoomAction: ({ code, action }) =>
            applyRoomActionRemotely(code, action).pipe(Effect.orDie),
        }),
      ),
    );
    const rpcHandler = RpcServer.toHttpEffect(RoomRpcGroup, {
      disableFatalDefects: true,
    }).pipe(Effect.provide(Layer.mergeAll(handlersLayer, RpcSerialization.layerNdjson)));

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        if (request.method === "OPTIONS") {
          return HttpServerResponse.empty({ headers: jsonHeaders, status: 204 });
        }

        const pathSegments = decodeUrl(request.originalUrl).pipe(
          Option.flatMap((url) => decodePathSegments(url.pathname)),
        );
        if (Option.isNone(pathSegments))
          return yield* HttpServerResponse.json(
            { error: "Invalid request URL" },
            { headers: jsonHeaders, status: 400 },
          );
        if (Option.isSome(decodeRpcPath(pathSegments.value))) {
          const handler = yield* rpcHandler;
          return yield* handler.pipe(
            Effect.map((response) => HttpServerResponse.setHeaders(response, jsonHeaders)),
          );
        }
        const isRoomsPath = Option.isSome(
          EffectArray.get(pathSegments.value, 0).pipe(Option.flatMap(decodeRoomsPathPrefix)),
        );
        if (!isRoomsPath)
          return yield* HttpServerResponse.json(
            { error: "Not found" },
            { headers: jsonHeaders, status: 404 },
          );

        const roomPath = decodeRoomPath(pathSegments.value);
        if (Option.isNone(roomPath))
          return yield* HttpServerResponse.json(
            { error: "Invalid room code" },
            { headers: jsonHeaders, status: 400 },
          );
        const code = roomPath.value[1];

        if (request.method === "GET") {
          return yield* getRoomState(code).pipe(
            Effect.matchEffect({
              onFailure: () =>
                HttpServerResponse.json(
                  { error: "The room could not be reached" },
                  { headers: jsonHeaders, status: 500 },
                ),
              onSuccess: (roomState) =>
                Schema.encodeEffect(TriviaRoomState)(roomState).pipe(
                  Effect.matchEffect({
                    onFailure: () =>
                      HttpServerResponse.json(
                        { error: "The room could not be reached" },
                        { headers: jsonHeaders, status: 500 },
                      ),
                    onSuccess: (body) =>
                      HttpServerResponse.json(body, { headers: jsonHeaders, status: 200 }),
                  }),
                ),
            }),
          );
        }

        if (request.method !== "POST")
          return yield* HttpServerResponse.json(
            { error: "Method not allowed" },
            { headers: jsonHeaders, status: 405 },
          );

        const body = yield* request.json.pipe(Effect.option);
        if (Option.isNone(body))
          return yield* HttpServerResponse.json(
            { error: "Invalid room action" },
            { headers: jsonHeaders, status: 400 },
          );
        return yield* Schema.decodeUnknownEffect(TriviaRoomAction)(body.value).pipe(
          Effect.matchEffect({
            onFailure: () =>
              HttpServerResponse.json(
                { error: "Invalid room action" },
                { headers: jsonHeaders, status: 400 },
              ),
            onSuccess: (action) =>
              applyRoomActionRemotely(code, action).pipe(
                Effect.matchEffect({
                  onFailure: () =>
                    HttpServerResponse.json(
                      { error: "The room could not be reached" },
                      { headers: jsonHeaders, status: 500 },
                    ),
                  onSuccess: (roomState) =>
                    Schema.encodeEffect(TriviaRoomState)(roomState).pipe(
                      Effect.matchEffect({
                        onFailure: () =>
                          HttpServerResponse.json(
                            { error: "The room could not be reached" },
                            { headers: jsonHeaders, status: 500 },
                          ),
                        onSuccess: (encoded) =>
                          HttpServerResponse.json(encoded, {
                            headers: jsonHeaders,
                            status: 200,
                          }),
                      }),
                    ),
                }),
              ),
          }),
        );
      }),
    };
  }),
) {}
