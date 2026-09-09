import { Array as EffectArray, Option, Schema, SchemaGetter, String as EffectString } from "effect";

const PathSegments = Schema.String.pipe(
  Schema.decodeTo(Schema.Array(Schema.String), {
    decode: SchemaGetter.split<string>({ separator: "/" }).map((segments: readonly string[]) =>
      EffectArray.filter<string>((segment) => EffectString.isNonEmpty(segment))(segments),
    ),
    encode: SchemaGetter.transform((segments: readonly string[]) =>
      EffectArray.join(segments, "/"),
    ),
  }),
);

const UrlFromString = Schema.URLFromString;

export const decodeUrl = Schema.decodeUnknownOption(UrlFromString);
export const decodePathSegments = Schema.decodeOption(PathSegments);
const encodePathSegments = Schema.encodeOption(PathSegments);

export const appendUrlPath = (url: URL, segments: readonly string[]) =>
  Option.flatMap(decodePathSegments(url.pathname), (prefix) =>
    Option.flatMap(encodePathSegments(EffectArray.appendAll(prefix, segments)), (pathname) =>
      Option.map(decodeUrl(url.toString()), (next) => {
        next.pathname = pathname;
        return next;
      }),
    ),
  );
