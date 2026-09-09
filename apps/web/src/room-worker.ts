/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from "cloudflare:workers";
import { Result, Schema } from "effect";

import { applyRoomAction, createInitialRoomState } from "@trivia-night/domain/room";
import { triviaSections } from "@trivia-night/domain/sections";
import { RoomCode, TriviaRoomAction, TriviaRoomState } from "@trivia-night/domain/schemas";

/**
 * Cloudflare's runtime requires async methods and native WebSocket objects at
 * this boundary. The room rules remain in the pure Effect-owned domain
 * package; this file only adapts them to a Worker and Durable Object.
 */
export interface TriviaRoomEnv {
  readonly TRIVIA_ROOM: DurableObjectNamespace<TriviaRoom>;
}

const jsonHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: { ...jsonHeaders, ...init?.headers },
  });

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const roomCodeFromRequest = (request: Request) => {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const rawCode = segments[0] === "rooms" ? segments[1] : undefined;
  return Schema.decodeUnknownResult(RoomCode)(rawCode?.toUpperCase());
};

export class TriviaRoom extends DurableObject<TriviaRoomEnv> {
  private readonly ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: TriviaRoomEnv) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY, state_json TEXT NOT NULL)",
      );
    });
  }

  private readState(): TriviaRoomState | undefined {
    const row = this.ctx.storage.sql
      .exec<{ state_json: string }>("SELECT state_json FROM room_state WHERE id = 1")
      .toArray()[0];
    if (row === undefined) return undefined;
    const decoded = Schema.decodeUnknownResult(TriviaRoomState)(parseJson(row.state_json));
    return Result.isSuccess(decoded) ? decoded.success : undefined;
  }

  private readOrCreateState(code: RoomCode): TriviaRoomState {
    const existing = this.readState();
    if (existing !== undefined) return existing;
    const initial = createInitialRoomState(code, triviaSections.length);
    this.writeState(initial);
    return initial;
  }

  private writeState(state: TriviaRoomState): void {
    this.ctx.storage.sql.exec(
      "INSERT INTO room_state (id, state_json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json",
      JSON.stringify(state),
    );
  }

  private broadcast(state: TriviaRoomState): void {
    const message = JSON.stringify(state);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
      } catch {
        socket.close(1011, "Room connection failed");
      }
    }
  }

  override async fetch(request: Request): Promise<Response> {
    await this.ready;
    const code = roomCodeFromRequest(request);
    if (Result.isFailure(code))
      return jsonResponse({ error: "Invalid room code" }, { status: 400 });

    const state = this.readOrCreateState(code.success);
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].send(JSON.stringify(state));
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (request.method === "GET") return jsonResponse(state);
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    const input = Schema.decodeUnknownResult(TriviaRoomAction)(await request.json());
    if (Result.isFailure(input))
      return jsonResponse({ error: "Invalid room action" }, { status: 400 });

    const next = applyRoomAction(state, input.success);
    if (Result.isFailure(next)) {
      return jsonResponse({ error: next.failure.reason }, { status: 409 });
    }
    this.writeState(next.success);
    this.broadcast(next.success);
    return jsonResponse(next.success);
  }

  override async webSocketMessage(
    _socket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    const input = Schema.decodeUnknownResult(TriviaRoomAction)(parseJson(text));
    if (Result.isFailure(input)) return;
    const state = this.readState();
    if (state === undefined) return;
    const next = applyRoomAction(state, input.success);
    if (Result.isFailure(next)) return;
    this.writeState(next.success);
    this.broadcast(next.success);
  }

  override webSocketClose(
    _socket: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): void {}
}

const notFound = () => jsonResponse({ error: "Not found" }, { status: 404 });

export default {
  async fetch(request: Request, env: TriviaRoomEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: jsonHeaders });
    if (!url.pathname.startsWith("/rooms/")) return notFound();
    const code = roomCodeFromRequest(request);
    if (Result.isFailure(code))
      return jsonResponse({ error: "Invalid room code" }, { status: 400 });
    const room = env.TRIVIA_ROOM.getByName(code.success);
    return room.fetch(request);
  },
};
