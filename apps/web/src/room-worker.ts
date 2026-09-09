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
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-origin": "*",
} as const;

type JsonResponseBody = { readonly error: string } | TriviaRoomState;

const jsonResponse = (body: JsonResponseBody, status = 200) =>
  HttpServerResponse.json(body, { headers: jsonHeaders, status }).pipe(
    Effect.tap((response) =>
      Effect.log("room response", response.status, typeof response.status, response.body._tag),
    ),
  );

const RoomCodeFromString = Schema.String.pipe(
  Schema.decodeTo(RoomCode, {
    decode: SchemaGetter.toUpperCase<string>(),
    encode: SchemaGetter.passthrough<string>(),
  }),
);

const decodeRoomPrefix = Schema.decodeUnknownOption(Schema.Literal("rooms"));
const decodeRoomCode = Schema.decodeOption(RoomCodeFromString);

const roomCodeFromPath = (path: string) =>
  decodePathSegments(path).pipe(
    Option.flatMap((segments) =>
      EffectArray.get(segments, 0).pipe(
        Option.flatMap(decodeRoomPrefix),
        Option.flatMap(() => EffectArray.get(segments, 1)),
        Option.flatMap(decodeRoomCode),
      ),
    ),
  );

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
      Effect.scoped(
        Effect.gen(function* () {
          const room = yield* rooms.getByName(code);
          return yield* room.GetRoomState({ code });
        }),
      );

    const applyRoomActionRemotely = (code: RoomCode, action: TriviaRoomAction) =>
      Effect.scoped(
        Effect.gen(function* () {
          const room = yield* rooms.getByName(code);
          return yield* room.ApplyTriviaRoomAction({ code, action });
        }),
      );

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

        const path = decodeUrl(request.originalUrl).pipe(Option.map((url) => url.pathname));
        if (Option.isNone(path)) return yield* jsonResponse({ error: "Invalid request URL" }, 400);
        if (path.value === "/rpc") {
          const handler = yield* rpcHandler;
          return yield* handler.pipe(
            Effect.map((response) => HttpServerResponse.setHeaders(response, jsonHeaders)),
          );
        }
        if (!path.value.startsWith("/rooms/"))
          return yield* jsonResponse({ error: "Not found" }, 404);

        const code = roomCodeFromPath(path.value);
        if (Option.isNone(code)) return yield* jsonResponse({ error: "Invalid room code" }, 400);

        if (request.method === "GET") {
          return yield* getRoomState(code.value).pipe(
            Effect.matchEffect({
              onFailure: () => jsonResponse({ error: "The room could not be reached" }, 500),
              onSuccess: jsonResponse,
            }),
          );
        }

        if (request.method !== "POST")
          return yield* jsonResponse({ error: "Method not allowed" }, 405);

        const body = yield* request.json.pipe(Effect.option);
        if (Option.isNone(body)) return yield* jsonResponse({ error: "Invalid room action" }, 400);
        return yield* Schema.decodeUnknownEffect(TriviaRoomAction)(body.value).pipe(
          Effect.matchEffect({
            onFailure: () => jsonResponse({ error: "Invalid room action" }, 400),
            onSuccess: (action) =>
              applyRoomActionRemotely(code.value, action).pipe(
                Effect.matchEffect({
                  onFailure: () => jsonResponse({ error: "The room could not be reached" }, 500),
                  onSuccess: jsonResponse,
                }),
              ),
          }),
        );
      }),
    };
  }),
) {}
