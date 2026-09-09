import { Schema } from "effect";

const isString = Schema.is(Schema.String);

const propertyName = (node) => {
  if (node?.type === "Identifier") {
    return node.name;
  }
  if (node?.type === "Literal" && isString(node.value)) {
    return node.value;
  }
  return undefined;
};

const ambientMethods = new Set(["argv", "env", "file", "spawn", "spawnSync", "write"]);

const noAmbientHostApi = {
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.object?.type === "Identifier" &&
          node.object.name === "Bun" &&
          ambientMethods.has(propertyName(node.property))
        ) {
          context.report({ messageId: "noAmbientHostApi", node });
        }
      },
    };
  },
  meta: {
    docs: { description: "Disallow direct Bun host APIs in Effect-owned TypeScript." },
    messages: {
      noAmbientHostApi:
        "Use decoded input and Effect platform services instead of direct Bun environment, file or process APIs.",
    },
    type: "problem",
  },
};

export default {
  meta: { name: "common-bun" },
  rules: {
    "no-ambient-host-api": noAmbientHostApi,
  },
};
