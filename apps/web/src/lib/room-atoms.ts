import { Array as EffectArray, Effect, Layer, Option, Random, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { Atom, AsyncResult, AtomRpc } from "effect/unstable/reactivity";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";

import type { RoomCode, TriviaRoomState } from "@trivia-night/domain/schemas";
import { RoomCode as RoomCodeSchema } from "@trivia-night/domain/schemas";
import { RoomRpcGroup } from "@trivia-night/rpc/room";
import { appendUrlPath, decodeUrl } from "./url";

const roomApiUrlResult = decodeUrl(import.meta.env.VITE_ROOM_API_URL);

const rpcUrl = Option.match(roomApiUrlResult, {
  onNone: () => "/rpc",
  onSome: (url) =>
    Option.match(appendUrlPath(url, ["rpc"]), {
      onNone: () => "/rpc",
      onSome: (next) => next.toString(),
    }),
});

const roomProtocol = RpcClient.layerProtocolHttp({ url: rpcUrl }).pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(RpcSerialization.layerNdjson),
);

const RoomRpcClient = AtomRpc.Service()("RoomRpcClient", {
  group: RoomRpcGroup,
  protocol: roomProtocol,
});

export const roomKey = (code: RoomCode) => `trivia-room:${code}`;

export const roomStateAtom = (code: RoomCode) =>
  RoomRpcClient.query(
    "GetRoomState",
    { code },
    {
      reactivityKeys: [roomKey(code)],
      serializationKey: code,
      timeToLive: "10 minutes",
    },
  );

export const roomActionAtom = RoomRpcClient.mutation("ApplyTriviaRoomAction");

export const emptyRoomStateAtom = Atom.make(AsyncResult.initial<TriviaRoomState>());

const roomCodeCharacters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const newRoomCodeEffect = Effect.gen(function* () {
  const indexes = yield* Effect.replicateEffect(6)(
    Random.nextIntBetween(0, roomCodeCharacters.length - 1),
  );
  const candidate = EffectArray.join(
    EffectArray.map((index) => roomCodeCharacters.charAt(index))(indexes),
    "",
  );

  return yield* Schema.decodeEffect(RoomCodeSchema)(candidate);
});

export const newRoomCodeAtom = Atom.fn<null>()(() => newRoomCodeEffect);
