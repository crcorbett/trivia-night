import { HttpApi as EffectHttpApi } from "effect/unstable/httpapi";
import { HttpApiGroup } from "./group";
export const HttpApiApi = EffectHttpApi.make("HttpApiApi").add(HttpApiGroup);
