import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { Atom, AsyncResult, AtomRpc } from "effect/unstable/reactivity";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";

import type { RoomCode, TriviaRoomState } from "@trivia-night/domain/schemas";
import { RoomRpcGroup } from "@trivia-night/rpc/room";

export const roomApiUrl = import.meta.env.VITE_ROOM_API_URL;
export const hasRemoteRoomApi = roomApiUrl !== undefined && roomApiUrl !== "";

const rpcUrl = `${roomApiUrl?.replace(/\/$/u, "") ?? ""}/rpc`;

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
