import { Layer, Option } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { Atom, AsyncResult, AtomRpc } from "effect/unstable/reactivity";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";

import type { RoomCode, TriviaRoomState } from "@trivia-night/domain/schemas";
import { RoomRpcGroup } from "@trivia-night/rpc/room";
import { appendUrlPath, decodeUrl } from "./url";

const roomApiUrlResult = decodeUrl(import.meta.env.VITE_ROOM_API_URL);
export const roomApiUrl = Option.getOrUndefined(roomApiUrlResult);
export const hasRemoteRoomApi = Option.isSome(roomApiUrlResult);

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
