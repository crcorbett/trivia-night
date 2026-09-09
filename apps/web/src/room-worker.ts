import * as Cloudflare from "alchemy/Cloudflare";
import { RuntimeContext } from "alchemy/RuntimeContext";
import { Array as EffectArray, Effect, Layer, Option, Schema, SchemaGetter } from "effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

import { TriviaRoomStateError } from "@trivia-night/domain/errors";
import type { TriviaRoomActionError } from "@trivia-night/domain/errors";
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

const JsonResponseBody = Schema.Union([Schema.Struct({ error: Schema.String }), TriviaRoomState]);

const jsonResponse = (body: typeof JsonResponseBody.Type, status = 200) =>
  HttpServerResponse.schemaJson(JsonResponseBody)(body, { headers: jsonHeaders, status });

const RoomCodeFromString = Schema.String.pipe(
  Schema.decodeTo(RoomCode, {
    decode: SchemaGetter.toUpperCase<string>(),
    encode: SchemaGetter.passthrough<string>(),
  }),
);

const decodeRoomPrefix = Schema.decodeUnknownOption(Schema.Literal("rooms"));
const decodeRoomCode = Schema.decodeOption(RoomCodeFromString);

class InvalidWebSocketMessageError extends Schema.TaggedError<InvalidWebSocketMessageError>()(
  "InvalidWebSocketMessageError",
  {},
) {}

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

const RoomSocketAttachment = Schema.Struct({ code: RoomCode });
const TriviaRoomActionJson = Schema.fromJsonString(TriviaRoomAction);
const TriviaRoomStateJson = Schema.fromJsonString(TriviaRoomState);

const decodeStoredState = (value: unknown) =>
  Schema.decodeUnknownEffect(TriviaRoomState)(value).pipe(
    Effect.mapError(() => new TriviaRoomStateError({ reason: "invalid-state" })),
  );

const encodeStateMessage = (roomState: TriviaRoomState) =>
  Schema.encodeEffect(TriviaRoomStateJson)(roomState).pipe(
    Effect.mapError(() => new TriviaRoomStateError({ reason: "invalid-state" })),
  );

export class TriviaRoom extends Cloudflare.DurableObject<TriviaRoom>()(
  "TriviaRoom",
  Effect.gen(function* () {
    const state = yield* Cloudflare.DurableObjectState;

    // The nested Effect is Alchemy's required Durable Object init/runtime split.
    // @effect-diagnostics-next-line returnEffectInGen:off
    return Effect.gen(function* () {
      const runtimeContext = yield* RuntimeContext;
      const sessions = new Map<Cloudflare.WebSocket, RoomCode>();

      for (const socket of yield* state
        .getWebSockets()
        .pipe(Effect.provideService(RuntimeContext, runtimeContext))) {
        const attachment = Schema.decodeUnknownOption(RoomSocketAttachment)(
          socket.deserializeAttachment<unknown>(),
        );
        if (Option.isSome(attachment)) sessions.set(socket, attachment.value.code);
      }

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
          if (roomState.code !== code) {
            return yield* new TriviaRoomStateError({ reason: "room-code-mismatch" });
          }
          return roomState;
        });

      const broadcast = (roomState: TriviaRoomState) =>
        Effect.gen(function* () {
          const message = yield* encodeStateMessage(roomState);
          yield* Effect.forEach(
            sessions.keys(),
            (socket) => socket.send(message).pipe(Effect.ignoreCause),
            { discard: true },
          );
        });

      const applyAction = (code: RoomCode, action: TriviaRoomAction) =>
        Effect.gen(function* () {
          const current = yield* readOrCreateState(code);
          const next = yield* Effect.fromResult(applyRoomAction(current, action));
          yield* writeState(next);
          yield* broadcast(next);
          return next;
        }).pipe(Effect.provideService(RuntimeContext, runtimeContext));

      const actionResponse = (code: RoomCode, action: TriviaRoomAction) =>
        applyAction(code, action).pipe(
          Effect.matchEffect({
            onFailure: (error: TriviaRoomActionError | TriviaRoomStateError) =>
              jsonResponse(
                { error: error.reason },
                error._tag === "TriviaRoomActionError" ? 409 : 500,
              ),
            onSuccess: (next) => jsonResponse(next),
          }),
        );

      return {
        getState: (code: RoomCode) =>
          readOrCreateState(code).pipe(Effect.provideService(RuntimeContext, runtimeContext)),
        applyAction,
        fetch: Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const path = decodeUrl(request.originalUrl).pipe(Option.map((url) => url.pathname));
          if (Option.isNone(path))
            return yield* jsonResponse({ error: "Invalid request URL" }, 400);
          const code = roomCodeFromPath(path.value);
          if (Option.isNone(code)) return yield* jsonResponse({ error: "Invalid room code" }, 400);

          if (request.headers.upgrade?.toLowerCase() === "websocket") {
            return yield* readOrCreateState(code.value).pipe(
              Effect.matchEffect({
                onFailure: (error) => jsonResponse({ error: error.reason }, 500),
                onSuccess: (roomState) =>
                  Effect.gen(function* () {
                    const [response, socket] = yield* Cloudflare.upgrade();
                    socket.serializeAttachment({ code: code.value });
                    sessions.set(socket, code.value);
                    yield* socket.send(yield* encodeStateMessage(roomState));
                    return response;
                  }),
              }),
            );
          }

          if (request.method === "GET") {
            return yield* readOrCreateState(code.value).pipe(
              Effect.matchEffect({
                onFailure: (error) => jsonResponse({ error: error.reason }, 500),
                onSuccess: jsonResponse,
              }),
            );
          }

          if (request.method !== "POST")
            return yield* jsonResponse({ error: "Method not allowed" }, 405);

          const body = yield* request.json.pipe(Effect.option);
          if (Option.isNone(body))
            return yield* jsonResponse({ error: "Invalid room action" }, 400);
          return yield* Schema.decodeUnknownEffect(TriviaRoomAction)(body.value).pipe(
            Effect.matchEffect({
              onFailure: () => jsonResponse({ error: "Invalid room action" }, 400),
              onSuccess: (action) => actionResponse(code.value, action),
            }),
          );
        }),
        webSocketMessage: Effect.fn(function* (
          socket: Cloudflare.WebSocket,
          message: string | ArrayBuffer,
        ) {
          const attachment = Schema.decodeUnknownOption(RoomSocketAttachment)(
            socket.deserializeAttachment<unknown>(),
          );
          if (Option.isNone(attachment)) return;

          const text = yield* Effect.try({
            try: () => (typeof message === "string" ? message : new TextDecoder().decode(message)),
            catch: () => new InvalidWebSocketMessageError(),
          }).pipe(Effect.option);
          if (Option.isNone(text)) return;

          const action = Schema.decodeOption(TriviaRoomActionJson)(text.value);
          if (Option.isNone(action)) return;

          yield* applyAction(attachment.value.code, action.value).pipe(Effect.ignoreCause);
        }),
        webSocketClose: Effect.fn(function* (
          socket: Cloudflare.WebSocket,
          code: number,
          reason: string,
          _wasClean: boolean,
        ) {
          sessions.delete(socket);
          yield* socket.close(code, reason);
        }),
      };
    });
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
    const handlersLayer = RoomRpcGroup.toLayer(
      Effect.succeed(
        RoomRpcGroup.of({
          ApplyTriviaRoomAction: ({ code, action }) =>
            rooms.getByName(code).applyAction(code, action),
          GetRoomState: ({ code }) => rooms.getByName(code).getState(code),
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
        const room = rooms.getByName(code.value);

        if (request.headers.upgrade?.toLowerCase() === "websocket")
          return yield* room.fetch(request);

        if (request.method === "GET") {
          return yield* room.getState(code.value).pipe(
            Effect.matchEffect({
              onFailure: (error) => jsonResponse({ error: error.reason }, 500),
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
              room.applyAction(code.value, action).pipe(
                Effect.matchEffect({
                  onFailure: (error) =>
                    jsonResponse(
                      { error: error.reason },
                      error._tag === "TriviaRoomActionError" ? 409 : 500,
                    ),
                  onSuccess: jsonResponse,
                }),
              ),
          }),
        );
      }),
    };
  }),
) {}
