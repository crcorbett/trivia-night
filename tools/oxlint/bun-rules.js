const sourceFileName = (context) => context.filename ?? context.getFilename?.() ?? "";

const normalizedSourceFileName = (context) => sourceFileName(context).replaceAll("\\", "/");

const toolingRuleFilePattern = /(?<ultraciteCapture1>^|[/\\])tools[/\\]oxlint[/\\]/u;
const genericTestFilePattern =
  /(?:^|[/\\])(?:.*\.(?:test|spec)\.(?:ts|tsx|js)|(?:test|tests|testing)[/\\].*)$/u;
const genericCliFilePattern =
  /(?<ultraciteCapture1>^|[/\\])(?:cli[/\\]|scripts[/\\][^/\\]+\.(?:ts|tsx|js)$|cli\.(?:ts|js)$)/u;
const genericRuntimeOrLayerFilePattern =
  /(?<ultraciteCapture1>^|[/\\])(?:main|_runtime)\.(?:ts|tsx|js)$|(?<ultraciteCapture2>^|[/\\])runtime\.(?:client|server)\.ts$|(?<ultraciteCapture3>^|[/\\]).*\.(?:runtime|main|layer)\.(?:ts|tsx|js)$|(?<ultraciteCapture4>^|[/\\])(?:live|bun)\.layer\.ts$/u;
const genericRuntimeEntrypointFilePattern =
  /(?<ultraciteCapture1>^|[/\\])(?:main|_runtime)\.(?:ts|tsx|js)$|(?<ultraciteCapture2>^|[/\\])runtime\.(?:client|server)\.ts$|(?<ultraciteCapture3>^|[/\\]).*\.(?:runtime|main)\.(?:ts|tsx|js)$/u;

const isGenericBunAdapterFile = (fileName) =>
  genericRuntimeOrLayerFilePattern.test(fileName) ||
  genericCliFilePattern.test(fileName) ||
  genericTestFilePattern.test(fileName);

const isGenericBunRuntimeEntrypointFile = (fileName) =>
  genericRuntimeEntrypointFilePattern.test(fileName) || genericCliFilePattern.test(fileName);

const propertyName = (node) => {
  if (node?.type === "Identifier") {
    return node.name;
  }

  if (node?.type === "Literal") {
    return String(node.value);
  }

  return null;
};

const importSourceValue = (node) =>
  String(node?.source?.value) === node?.source?.value ? node.source.value : "";

const isNodeRuntimeSource = (source) =>
  /^(?:@effect\/platform-node|effect\/platform-node)(?:\/NodeRuntime)?$/u.test(source) ||
  source.endsWith("/NodeRuntime");

const isNodeRuntimeReference = (node) => node?.type === "Identifier" && node.name === "NodeRuntime";

const isNodeRuntimeText = (value) => String(value) === value && value.includes("NodeRuntime");

const isBunMemberCall = (node, methods) =>
  node?.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  node.callee.object?.type === "Identifier" &&
  node.callee.object.name === "Bun" &&
  methods.has(propertyName(node.callee.property));

const isBunRuntimeRunMainCall = (node) =>
  node?.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  node.callee.object?.type === "Identifier" &&
  node.callee.object.name === "BunRuntime" &&
  propertyName(node.callee.property) === "runMain";

const noNodeRuntime = {
  create(context) {
    if (sourceFileName(context).includes("tools/oxlint/")) {
      return {};
    }

    return {
      Identifier(node) {
        if (isNodeRuntimeReference(node)) {
          context.report({
            messageId: "noNodeRuntime",
            node,
          });
        }
      },
      Literal(node) {
        if (isNodeRuntimeText(node.value)) {
          context.report({
            messageId: "noNodeRuntime",
            node,
          });
        }
      },
      TemplateElement(node) {
        if (node.value?.raw?.includes("NodeRuntime")) {
          context.report({
            messageId: "noNodeRuntime",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow NodeRuntime in Bun-first Effect repositories.",
    },
    messages: {
      noNodeRuntime:
        "Use BunRuntime for executable Effect script entrypoints in Bun-first repositories. Do not import, reference, or document NodeRuntime unless a spec records an explicit exception.",
    },
    type: "problem",
  },
};

const noNodeRuntimeImport = {
  create(context) {
    if (toolingRuleFilePattern.test(normalizedSourceFileName(context))) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        if (
          isNodeRuntimeSource(importSourceValue(node)) ||
          node.specifiers?.some((specifier) => isNodeRuntimeReference(specifier.local))
        ) {
          context.report({
            messageId: "noNodeRuntimeImport",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow Node runtime imports in Bun-first Effect repositories.",
    },
    messages: {
      noNodeRuntimeImport:
        "Use Bun runtime modules for executable Effect entrypoints in Bun-first repositories. Do not import NodeRuntime unless a spec records an explicit exception.",
    },
    type: "problem",
  },
};

const bunFileAndProcessMethods = new Set(["file", "write", "spawn", "spawnSync"]);
const directBunHostMethods = new Set(["file", "spawn", "spawnSync", "which", "write"]);

const noDirectBunHostAccess = {
  create(context) {
    return {
      CallExpression(node) {
        if (isBunMemberCall(node, directBunHostMethods)) {
          context.report({
            messageId: "noDirectBunHostAccess",
            node: node.callee,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow direct Bun host access in exact Effect-owned boundaries.",
    },
    messages: {
      noDirectBunHostAccess:
        "Use Effect FileSystem, Path, and ChildProcess services at this admitted boundary instead of direct Bun host access.",
    },
    type: "problem",
  },
};

const noBunFileOutsideAdapter = {
  create(context) {
    const fileName = normalizedSourceFileName(context);

    if (toolingRuleFilePattern.test(fileName) || isGenericBunAdapterFile(fileName)) {
      return {};
    }

    return {
      CallExpression(node) {
        if (isBunMemberCall(node, bunFileAndProcessMethods)) {
          context.report({
            messageId: "noBunFileOutsideAdapter",
            node: node.callee,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Restrict Bun file and process APIs to adapter, runtime, layer, CLI, and test boundaries.",
    },
    messages: {
      noBunFileOutsideAdapter:
        "Do not call Bun file or process APIs outside adapter boundaries. Keep Bun.file, Bun.write, Bun.spawn, and related host access in runtime, main, CLI, layer, bun.layer, live.layer, or test files.",
    },
    type: "problem",
  },
};

const noBunRuntimeOutsideEntrypoint = {
  create(context) {
    const fileName = normalizedSourceFileName(context);

    if (toolingRuleFilePattern.test(fileName) || isGenericBunRuntimeEntrypointFile(fileName)) {
      return {};
    }

    return {
      CallExpression(node) {
        if (isBunRuntimeRunMainCall(node)) {
          context.report({
            messageId: "noBunRuntimeOutsideEntrypoint",
            node: node.callee,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Restrict BunRuntime.runMain to executable entrypoints.",
    },
    messages: {
      noBunRuntimeOutsideEntrypoint:
        "Do not call BunRuntime.runMain outside executable entrypoints. Keep Bun runtime execution in main, runtime, or CLI files and keep package logic returning Effect programs.",
    },
    type: "problem",
  },
};

export default {
  meta: {
    name: "bun",
  },
  rules: {
    "no-bun-file-outside-adapter": noBunFileOutsideAdapter,
    "no-bun-runtime-outside-entrypoint": noBunRuntimeOutsideEntrypoint,
    "no-direct-bun-host-access": noDirectBunHostAccess,
    "no-node-runtime": noNodeRuntime,
    "no-node-runtime-import": noNodeRuntimeImport,
  },
};
