import { Schema } from "effect";

const isString = Schema.is(Schema.String);
const isRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));

const propertyName = (node) => {
  if (node?.type === "Identifier") {
    return node.name;
  }
  if (node?.type === "Literal" && isString(node.value)) {
    return node.value;
  }
  return undefined;
};

const sourceFileName = (context) =>
  (context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/");

const memberExpressionName = (node) => {
  if (node?.type !== "MemberExpression" || node.object?.type !== "Identifier") {
    return undefined;
  }
  const property = propertyName(node.property);
  return property === undefined ? undefined : `${node.object.name}.${property}`;
};

const isMemberCall = (node, objectName, methodName) =>
  node?.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  node.callee.object?.type === "Identifier" &&
  node.callee.object.name === objectName &&
  propertyName(node.callee.property) === methodName;

const noAmbientProcess = {
  create(context) {
    return {
      MemberExpression(node) {
        if (["process.argv", "process.env", "process.exit"].includes(memberExpressionName(node))) {
          context.report({ messageId: "noAmbientProcess", node });
        }
      },
    };
  },
  meta: {
    docs: { description: "Disallow ambient process input and exit control." },
    messages: {
      noAmbientProcess:
        "Use decoded command input, Effect Config and typed command results instead of ambient process state.",
    },
    type: "problem",
  },
};

const noRawFetch = {
  create(context) {
    return {
      CallExpression(node) {
        const isBareFetch = node.callee?.type === "Identifier" && node.callee.name === "fetch";
        const isGlobalFetch =
          node.callee?.type === "MemberExpression" &&
          node.callee.object?.type === "Identifier" &&
          ["globalThis", "window"].includes(node.callee.object.name) &&
          propertyName(node.callee.property) === "fetch";
        if (isBareFetch || isGlobalFetch) {
          context.report({ messageId: "noRawFetch", node: node.callee });
        }
      },
    };
  },
  meta: {
    docs: { description: "Disallow raw fetch in Effect-owned TypeScript." },
    messages: {
      noRawFetch: "Use Effect HttpClient and decode the response with its owning Schema.",
    },
    type: "problem",
  },
};

const noUncheckedJson = {
  create(context) {
    return {
      CallExpression(node) {
        if (isMemberCall(node, "JSON", "parse")) {
          context.report({ messageId: "noUncheckedJson", node: node.callee });
        }
      },
    };
  },
  meta: {
    docs: { description: "Disallow JSON.parse without an owning Schema." },
    messages: {
      noUncheckedJson: "Decode JSON text with the owning Effect Schema.",
    },
    type: "problem",
  },
};

const noConsole = {
  create(context) {
    return {
      MemberExpression(node) {
        if (node.object?.type === "Identifier" && node.object.name === "console") {
          context.report({ messageId: "noConsole", node });
        }
      },
    };
  },
  meta: {
    docs: { description: "Disallow raw console calls in Effect-owned TypeScript." },
    messages: {
      noConsole: "Use Effect Console or structured Effect logging.",
    },
    type: "problem",
  },
};

const isFunctionNode = (node) =>
  ["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"].includes(node?.type);

const isAllowedPromiseBoundary = (node) => {
  const parent = node?.parent;
  if (parent?.type === "CallExpression" && parent.arguments?.includes(node)) {
    return (
      parent.callee?.type === "MemberExpression" &&
      parent.callee.object?.type === "Identifier" &&
      parent.callee.object.name === "Effect" &&
      ["promise", "tryPromise"].includes(propertyName(parent.callee.property))
    );
  }
  if (parent?.type !== "Property" || propertyName(parent.key) !== "try") {
    return false;
  }
  const options = parent.parent;
  const call = options?.parent;
  return (
    options?.type === "ObjectExpression" &&
    call?.type === "CallExpression" &&
    call.arguments?.includes(options) &&
    call.callee?.type === "MemberExpression" &&
    call.callee.object?.type === "Identifier" &&
    call.callee.object.name === "Effect" &&
    propertyName(call.callee.property) === "tryPromise"
  );
};

const isInsideAllowedPromiseBoundary = (node) => {
  let parent = node?.parent;
  while (parent !== undefined && parent !== null) {
    if (isFunctionNode(parent)) {
      return isAllowedPromiseBoundary(parent);
    }
    parent = parent.parent;
  }
  return false;
};

const noAsyncAwaitPromise = {
  create(context) {
    const reportAsync = (node) => {
      if (node.async && !isAllowedPromiseBoundary(node)) {
        context.report({ messageId: "noAsync", node });
      }
    };
    return {
      ArrowFunctionExpression: reportAsync,
      AwaitExpression(node) {
        if (!isInsideAllowedPromiseBoundary(node)) {
          context.report({ messageId: "noAwait", node });
        }
      },
      FunctionDeclaration: reportAsync,
      FunctionExpression: reportAsync,
      Identifier(node) {
        if (
          node.name === "Promise" &&
          node.parent?.type === "TSTypeReference" &&
          node.parent.typeName === node
        ) {
          context.report({ messageId: "noPromiseType", node });
        }
      },
      NewExpression(node) {
        if (node.callee?.type === "Identifier" && node.callee.name === "Promise") {
          context.report({ messageId: "noPromise", node: node.callee });
        }
      },
    };
  },
  meta: {
    docs: { description: "Disallow raw Promise and async orchestration." },
    messages: {
      noAsync: "Return an Effect program instead of declaring an async function.",
      noAwait: "Compose Effect programs instead of awaiting raw Promises.",
      noPromise: "Use Effect.async, Effect.promise or Effect.tryPromise at the host boundary.",
      noPromiseType: "Expose an Effect result instead of a raw Promise type.",
    },
    type: "problem",
  },
};

const noInstanceof = {
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator === "instanceof") {
          context.report({ messageId: "noInstanceof", node });
        }
      },
    };
  },
  meta: {
    docs: { description: "Disallow instanceof checks in Effect-owned TypeScript." },
    messages: {
      noInstanceof: "Use tagged data, Schema guards or Effect matchers instead of instanceof.",
    },
    type: "problem",
  },
};

const isManualTagKey = (node) => {
  const parent = node?.parent;
  if (propertyName(node) !== "_tag") {
    return false;
  }
  if (parent?.type === "MemberExpression") {
    return parent.property === node;
  }
  if (["Property", "PropertyDefinition", "TSPropertySignature"].includes(parent?.type)) {
    return parent.key === node;
  }
  return false;
};

const noManualTag = {
  create(context) {
    const reportTag = (node) => {
      if (isManualTagKey(node)) {
        context.report({ messageId: "noManualTag", node });
      }
    };
    return {
      Identifier: reportTag,
      Literal: reportTag,
    };
  },
  meta: {
    docs: { description: "Disallow manual Effect tag definitions and checks." },
    messages: {
      noManualTag:
        "Use Data or Schema tagged classes to define variants, then use Match, Schema.is or the matching Effect primitive to inspect them.",
    },
    type: "problem",
  },
};

const noRuntimeExecutionOutsideMain = {
  create(context) {
    const fileName = sourceFileName(context);
    const isMain = fileName.endsWith("/apps/cli/src/main.ts");
    return {
      CallExpression(node) {
        if (node.callee?.type !== "MemberExpression") {
          return;
        }
        const object = node.callee.object;
        const method = propertyName(node.callee.property);
        const isEffectRun =
          object?.type === "Identifier" && object.name === "Effect" && method?.startsWith("run");
        const isBunRunMain =
          object?.type === "Identifier" && object.name === "BunRuntime" && method === "runMain";
        if ((isEffectRun || isBunRunMain) && !isMain) {
          context.report({ messageId: "noRuntimeExecutionOutsideMain", node: node.callee });
        }
      },
    };
  },
  meta: {
    docs: { description: "Restrict Effect runtime execution to the CLI main entrypoint." },
    messages: {
      noRuntimeExecutionOutsideMain:
        "Only apps/cli/src/main.ts may execute the Effect runtime. Packages return Effect programs.",
    },
    type: "problem",
  },
};

const publicServiceNames = new Set([
  "Distribution",
  "ManifestSync",
  "PackageCheck",
  "SchemaRefresh",
  "SkillSources",
  "Validator",
]);

const instrumentationName = (node) => {
  if (
    node?.type !== "CallExpression" ||
    node.callee?.type !== "MemberExpression" ||
    node.callee.object?.type !== "Identifier" ||
    node.callee.object.name !== "Effect"
  ) {
    return undefined;
  }
  const method = propertyName(node.callee.property);
  const name = node.arguments?.[0];
  return ["fn", "withSpan"].includes(method) && name?.type === "Literal" && isString(name.value)
    ? name.value
    : undefined;
};

const collectInstrumentationNames = (node) => {
  const names = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) {
      return;
    }
    const name = instrumentationName(value);
    if (name !== undefined) {
      names.add(name);
    }
    Object.entries(value).forEach(([key, child]) => {
      if (key !== "parent") {
        visit(child);
      }
    });
  };
  visit(node);
  return names;
};

const requireServiceOperationInstrumentation = {
  create(context) {
    const variableInstrumentation = new Map();
    const serviceDefinitions = [];
    return {
      CallExpression(node) {
        if (
          node.callee?.type === "MemberExpression" &&
          node.callee.object?.type === "Identifier" &&
          publicServiceNames.has(node.callee.object.name) &&
          propertyName(node.callee.property) === "of" &&
          node.arguments?.[0]?.type === "ObjectExpression"
        ) {
          serviceDefinitions.push({
            service: node.callee.object.name,
            operations: node.arguments[0].properties,
          });
        }
      },
      "Program:exit"() {
        serviceDefinitions.forEach(({ service, operations }) => {
          operations.forEach((operation) => {
            if (operation.type !== "Property") {
              context.report({ messageId: "unsupportedOperation", node: operation });
              return;
            }
            const operationName = propertyName(operation.key);
            if (operationName === undefined) {
              context.report({ messageId: "unsupportedOperation", node: operation });
              return;
            }
            const names =
              operation.value.type === "Identifier"
                ? variableInstrumentation.get(operation.value.name)
                : collectInstrumentationNames(operation.value);
            if (!names?.has(`${service}.${operationName}`)) {
              context.report({
                data: { operation: `${service}.${operationName}` },
                messageId: "missingInstrumentation",
                node: operation,
              });
            }
          });
        });
      },
      VariableDeclarator(node) {
        if (node.id?.type === "Identifier" && node.init !== null) {
          variableInstrumentation.set(node.id.name, collectInstrumentationNames(node.init));
        }
      },
    };
  },
  meta: {
    docs: { description: "Require exact tracing names on public Effect service operations." },
    messages: {
      missingInstrumentation:
        "Instrument {{operation}} with Effect.fn or Effect.withSpan using that exact name.",
      unsupportedOperation:
        "Declare public Effect service operations as named object properties so tracing can be checked.",
    },
    type: "problem",
  },
};

export default {
  meta: { name: "common-effect" },
  rules: {
    "no-ambient-process": noAmbientProcess,
    "no-async-await-promise": noAsyncAwaitPromise,
    "no-console": noConsole,
    "no-instanceof": noInstanceof,
    "no-manual-tag": noManualTag,
    "no-raw-fetch": noRawFetch,
    "no-runtime-execution-outside-main": noRuntimeExecutionOutsideMain,
    "no-unchecked-json": noUncheckedJson,
    "require-service-operation-instrumentation": requireServiceOperationInstrumentation,
  },
};
