const propertyName = (node) => {
  if (node?.type === "Identifier") {
    return node.name;
  }

  if (node?.type === "JSXIdentifier") {
    return node.name;
  }

  if (node?.type === "Literal") {
    return String(node.value);
  }

  return null;
};

const sourceFileName = (context) => context.filename ?? context.getFilename?.() ?? "";

const normalizedSourceFileName = (context) => sourceFileName(context).replaceAll("\\", "/");

const genericConfigFilePattern = /(?<ultraciteCapture1>^|[/\\])(?:config|.*\.config)\.ts$/u;
const genericRuntimeBoundaryFilePatterns = [
  /(?<ultraciteCapture1>^|[/\\])(?:main|_runtime)\.ts$/u,
  /(?<ultraciteCapture1>^|[/\\])runtime\.(?:client|server)\.ts$/u,
  /(?<ultraciteCapture1>^|[/\\]).*\.(?:runtime|main|layer)\.ts$/u,
  /(?<ultraciteCapture1>^|[/\\])(?:live|bun)\.layer\.ts$/u,
];
const genericTestFilePattern =
  /(?:^|[/\\])(?:.*\.(?:test|spec)\.(?:ts|tsx)|(?:test|tests|testing)[/\\].*)$/u;
const genericCliFilePattern = /(?<ultraciteCapture1>^|[/\\])(?:cli[/\\]|cli\.ts$)/u;

const isGenericRuntimeBoundaryFile = (fileName) =>
  genericRuntimeBoundaryFilePatterns.some((pattern) => pattern.test(fileName)) ||
  genericTestFilePattern.test(fileName);

const isGenericRuntimeOrCliFile = (fileName) =>
  isGenericRuntimeBoundaryFile(fileName) || genericCliFilePattern.test(fileName);

const isGenericProcessBoundaryFile = (fileName) =>
  genericConfigFilePattern.test(fileName) || isGenericRuntimeOrCliFile(fileName);

const memberExpressionName = (node) => {
  if (node?.type !== "MemberExpression") {
    return null;
  }

  const objectName = node.object?.type === "Identifier" ? node.object.name : null;
  const memberName = propertyName(node.property);

  return objectName && memberName ? `${objectName}.${memberName}` : null;
};

const importSourceValue = (node) =>
  String(node?.source?.value) === node?.source?.value ? node.source.value : "";

const importedSpecifierName = (specifier) => {
  if (specifier?.type !== "ImportSpecifier") {
    return null;
  }

  return propertyName(specifier.imported);
};

const localSpecifierName = (specifier) => {
  if (
    specifier?.type !== "ImportSpecifier" &&
    specifier?.type !== "ImportDefaultSpecifier" &&
    specifier?.type !== "ImportNamespaceSpecifier"
  ) {
    return null;
  }

  return specifier.local?.type === "Identifier" ? specifier.local.name : null;
};

const unwrapCallee = (callee) => {
  let current = callee;

  while (current?.type === "TSInstantiationExpression" || current?.type === "ChainExpression") {
    current = current.expression;
  }

  return current;
};

const returnedFunctionEffect = (node) => {
  if (node?.body?.type !== "BlockStatement") {
    return node?.body;
  }

  const [statement] = node.body.body;
  return node.body.body.length === 1 && statement?.type === "ReturnStatement"
    ? statement.argument
    : undefined;
};

const returnedFunctionValue = (node) => {
  if (node?.body?.type !== "BlockStatement") {
    return node?.body;
  }

  const finalStatement = node.body.body.at(-1);
  return finalStatement?.type === "ReturnStatement" ? finalStatement.argument : undefined;
};

const createEffectModuleImportTracker = (moduleName) => {
  const namespaces = new Set();
  const directImports = new Map();

  return {
    callMethodName: (node) => {
      if (node?.type !== "CallExpression") {
        return null;
      }

      const callee = unwrapCallee(node.callee);

      if (
        callee?.type === "MemberExpression" &&
        callee.object?.type === "Identifier" &&
        namespaces.has(callee.object.name)
      ) {
        return propertyName(callee.property);
      }

      if (callee?.type === "Identifier") {
        return directImports.get(callee.name) ?? null;
      }

      return null;
    },
    importDeclaration: (node) => {
      const source = importSourceValue(node);

      if (source === "effect") {
        for (const specifier of node.specifiers ?? []) {
          if (importedSpecifierName(specifier) === moduleName) {
            const localName = localSpecifierName(specifier);
            if (localName !== null) {
              namespaces.add(localName);
            }
          }
        }
        return;
      }

      if (source !== `effect/${moduleName}`) {
        return;
      }

      for (const specifier of node.specifiers ?? []) {
        const localName = localSpecifierName(specifier);
        if (localName === null) {
          continue;
        }

        const importedName = importedSpecifierName(specifier);
        if (importedName === null) {
          namespaces.add(localName);
        } else {
          directImports.set(localName, importedName);
        }
      }
    },
    isReference: (node, exportName) => {
      if (
        node?.type === "MemberExpression" &&
        node.object?.type === "Identifier" &&
        namespaces.has(node.object.name)
      ) {
        return propertyName(node.property) === exportName;
      }

      return node?.type === "Identifier" && directImports.get(node.name) === exportName;
    },
  };
};

const noManualTag = {
  create(context) {
    return {
      Property(node) {
        const { key } = node;

        if (
          node.parent?.type === "ObjectExpression" &&
          ((key.type === "Identifier" && key.name === "_tag") ||
            (key.type === "Literal" && key.value === "_tag"))
        ) {
          context.report({
            messageId: "noManualTag",
            node: key,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow manual Effect _tag object literals.",
    },
    messages: {
      noManualTag:
        'Manual _tag object literals are not allowed. Define the tag at the canonical boundary with Data.TaggedClass, Data.TaggedError, or Schema.TaggedClass, then construct that type. Do not write { _tag: "SomeTag", ... } at callsites.',
    },
    type: "problem",
  },
};

const isErrorTagComparison = (node) => {
  if (node?.type !== "BinaryExpression" || !["===", "!==", "==", "!="].includes(node.operator)) {
    return false;
  }

  const operands = [node.left, node.right];
  const tagMember = operands.find(
    (operand) =>
      operand?.type === "MemberExpression" &&
      operand.object?.type === "Identifier" &&
      ["cause", "error"].includes(operand.object.name) &&
      propertyName(operand.property) === "_tag",
  );
  return tagMember !== undefined;
};

const noErrorTagComparison = {
  create(context) {
    if (genericTestFilePattern.test(normalizedSourceFileName(context))) {
      return {};
    }

    return {
      BinaryExpression(node) {
        if (isErrorTagComparison(node)) {
          context.report({
            messageId: "noErrorTagComparison",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow direct _tag comparisons for Effect errors in production code.",
    },
    messages: {
      noErrorTagComparison:
        "Do not inspect an Effect error or Option with error._tag or cause._tag. Use Effect.catchTag/catchTags for error handling, or Match.value, Schema.is, Option.isSome/isNone, or Option.match for a typed predicate.",
    },
    type: "problem",
  },
};

const noTypeof = {
  create(context) {
    return {
      UnaryExpression(node) {
        if (node.operator === "typeof") {
          context.report({
            messageId: "noTypeof",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow typeof checks in Effect-native service code.",
    },
    messages: {
      noTypeof:
        'Do not use typeof checks for service policy. Unknown input must be decoded by the owning Schema: Schema.decodeUnknown(RequestSchema)(input). Closed-domain branching must use Match: Match.value(value).pipe(Match.when({ _tag: "Known" }, onKnown), Match.exhaustive). Optional values must be Schema.optional + Option, not typeof value === "undefined".',
    },
    type: "problem",
  },
};

const noInstanceof = {
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator === "instanceof") {
          context.report({
            messageId: "noInstanceof",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow instanceof checks in Effect-native service code.",
    },
    messages: {
      noInstanceof:
        'Do not use instanceof checks for service policy. Model domain variants as tagged Schema/Data classes and branch with Match on _tag: Match.value(error).pipe(Match.when({ _tag: "SchemaDecodeError" }, handleDecode), Match.exhaustive). For Effect outcomes, use Exit.match, Result.match, or typed tagged errors instead of instanceof Error.',
    },
    type: "problem",
  },
};

const noInOperator = {
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator === "in") {
          context.report({
            messageId: "noInOperator",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow in-operator branching in Effect-native service code.",
    },
    messages: {
      noInOperator:
        "Do not use the in operator for service policy. Decode shape with the owning Schema instead of probing keys. For keyed collections, use HashMap.get(map, key).pipe(Option.match(...)) or Record.get(record, key).pipe(Option.match(...)). For variants, use Match on tagged Schema/Data classes.",
    },
    type: "problem",
  },
};

const isUndefinedIdentifier = (node) => node?.type === "Identifier" && node.name === "undefined";

const isNullLiteral = (node) => node?.type === "Literal" && node.value === null;

const noUndefinedComparison = {
  create(context) {
    return {
      BinaryExpression(node) {
        if (
          (node.operator === "===" || node.operator === "!==") &&
          (isUndefinedIdentifier(node.left) || isUndefinedIdentifier(node.right))
        ) {
          context.report({
            messageId: "noUndefinedComparison",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow raw undefined comparison in Effect-native service code.",
    },
    messages: {
      noUndefinedComparison:
        "Do not branch on raw undefined. Optional request/response fields must be owned by Schema.optional and immediately normalized to Option: const contextName = Option.fromNullable(payload.contextName); contextName.pipe(Option.match({ onNone: () => ..., onSome: (value) => ... })). Do not write value === undefined or value !== undefined.",
    },
    type: "problem",
  },
};

const noNullishComparison = {
  create(context) {
    return {
      BinaryExpression(node) {
        if (
          ["==", "!=", "===", "!=="].includes(node.operator) &&
          (isNullLiteral(node.left) || isNullLiteral(node.right))
        ) {
          context.report({
            messageId: "noNullishComparison",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow raw nullish comparison in Effect-native service code.",
    },
    messages: {
      noNullishComparison:
        "Do not compare against null in Effect-owned code. Own nullable input in Schema with Schema.NullOr or an explicit transform, normalize with Option.fromNullable(value), and branch with Option.match or Match. To fail an Effect from nullable input, use Effect.fromNullishOr(value).pipe(Effect.mapError(() => new MissingValue(...))). Undefined checks are separately banned; both cases should flow through Schema + Option.",
    },
    type: "problem",
  },
};

const noConditionalObjectSpread = {
  create(context) {
    return {
      SpreadElement(node) {
        if (
          node.parent?.type === "ObjectExpression" &&
          (node.argument?.type === "ConditionalExpression" ||
            node.argument?.type === "LogicalExpression")
        ) {
          context.report({
            messageId: "noConditionalObjectSpread",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow conditional object spreads for schema-backed response shaping.",
    },
    messages: {
      noConditionalObjectSpread:
        'Do not shape schema-backed responses with conditional object spreads. Put optional fields in the response Schema, then build them with Option/Match or service-owned policy: const help = query.help.pipe(Option.filter((mode) => mode === "errors"), Option.map(() => helpPayload)); return ResponseSchema.make({ calculatorId, help }); Do not write ...(condition ? { help } : {}).',
    },
    type: "problem",
  },
};

const isProcessBoundaryMember = (node) =>
  memberExpressionName(node) === "process.env" || memberExpressionName(node) === "process.argv";

const noProcessBoundaryOutsideConfig = {
  create(context) {
    const fileName = normalizedSourceFileName(context);

    if (isGenericProcessBoundaryFile(fileName)) {
      return {};
    }

    return {
      MemberExpression(node) {
        if (isProcessBoundaryMember(node)) {
          context.report({
            messageId: "noProcessBoundaryOutsideConfig",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Disallow process environment or argv reads outside config and runtime boundaries.",
    },
    messages: {
      noProcessBoundaryOutsideConfig:
        "Do not read process.env or process.argv in Effect-owned code outside config, runtime, main, CLI, layer, or test boundaries. Decode environment and arguments through Config, Schema, or an owning runtime service before passing values into package logic.",
    },
    type: "problem",
  },
};

const noConsoleOutsideRuntime = {
  create(context) {
    const fileName = normalizedSourceFileName(context);

    if (isGenericRuntimeOrCliFile(fileName)) {
      return {};
    }

    return {
      MemberExpression(node) {
        if (node.object?.type === "Identifier" && node.object.name === "console") {
          context.report({
            messageId: "noConsoleOutsideRuntime",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow console output outside runtime, CLI, adapter, and test boundaries.",
    },
    messages: {
      noConsoleOutsideRuntime:
        "Do not call console.* from Effect-owned service code. Return typed values or tagged errors and let runtime, CLI, adapter, or test boundaries decide how to print diagnostics.",
    },
    type: "problem",
  },
};

const schemaDecoderMethodPattern = /^decode(?!To)[A-Za-z]*$/u;
const schemaEncoderMethodPattern = /^encode(?!To)[A-Za-z]*$/u;
const nonThrowingDecoderMethodPattern = /(?:Result|Exit|Option)$/u;
const directUnknownParameterContracts = new Set([
  "TSTypeAnnotation:Identifier:ArrowFunctionExpression",
  "TSTypeAnnotation:Identifier:FunctionDeclaration",
  "TSTypeAnnotation:Identifier:FunctionExpression",
  "TSTypeAnnotation:Identifier:TSCallSignatureDeclaration",
  "TSTypeAnnotation:Identifier:TSFunctionType",
  "TSTypeAnnotation:Identifier:TSMethodSignature",
]);
const effectErrorUnknownContract =
  "TSTypeParameterInstantiation:TSTypeReference:TSQualifiedName:Identifier:Effect:Identifier:Effect";

const noSchemaDecoderOutsideIngress = {
  create(context) {
    const schemaImports = createEffectModuleImportTracker("Schema");

    return {
      CallExpression(node) {
        const methodName = schemaImports.callMethodName(node);

        if (methodName !== null && schemaDecoderMethodPattern.test(methodName)) {
          context.report({
            messageId: "noSchemaDecoderOutsideIngress",
            node: node.callee,
          });
        }
      },
      ImportDeclaration: schemaImports.importDeclaration,
    };
  },
  meta: {
    docs: {
      description:
        "Disallow Effect Schema decoder execution outside configured ingress boundaries.",
    },
    messages: {
      noSchemaDecoderOutsideIngress:
        "Schema decoder execution belongs only at an explicit ingress boundary. Decode raw host, HTTP, CLI, provider, filesystem, or generated-module input once with the owning schema, then pass its schema-derived value through services and builders. Schema decodeTo transformations are not decoder execution.",
    },
    type: "problem",
  },
};

const nominalIdentifierPropertyNames = new Set([
  "canonicalPath",
  "contentPath",
  "cursor",
  "id",
  "mimeType",
  "operation",
  "slug",
  "uri",
  "uriTemplate",
  "url",
]);

const noUnbrandedIdentifierSchema = {
  create(context) {
    const schemaImports = createEffectModuleImportTracker("Schema");
    const localSchemaRoles = new Map();
    const unresolvedIdentifierProperties = [];

    const isSchemaMember = (node, memberName) =>
      node?.type === "MemberExpression" &&
      node.object?.type === "Identifier" &&
      schemaImports.isReference(node, memberName);

    const isSchemaCall = (node, memberName) =>
      node?.type === "CallExpression" && isSchemaMember(node.callee, memberName);

    const containsSchemaBrand = (node) => {
      if (node === null || Object(node) !== node) {
        return false;
      }
      if (isSchemaCall(node, "brand")) {
        return true;
      }
      if (node.type === "CallExpression") {
        if (containsSchemaBrand(node.callee)) {
          return true;
        }
        return node.arguments.some(containsSchemaBrand);
      }
      if (node.type === "MemberExpression") {
        return containsSchemaBrand(node.object);
      }
      if (node.type === "ArrayExpression") {
        return node.elements.some(containsSchemaBrand);
      }
      if (node.type === "TSInstantiationExpression") {
        return containsSchemaBrand(node.expression);
      }
      return false;
    };

    const schemaRole = (node) => {
      if (node?.type === "Identifier") {
        return localSchemaRoles.get(node.name) ?? "unknown";
      }
      if (isSchemaMember(node, "String") || isSchemaMember(node, "Trimmed")) {
        return "plain";
      }
      if (isSchemaMember(node, "Literal") || isSchemaMember(node, "Literals")) {
        return "branded";
      }
      return node?.type === "CallExpression" ? schemaRoleForCall(node) : "unknown";
    };

    const schemaRoleForCall = (node) => {
      if (isSchemaCall(node, "String") || isSchemaCall(node, "Trimmed")) {
        return "plain";
      }
      if (isSchemaCall(node, "Literal") || isSchemaCall(node, "Literals")) {
        return "branded";
      }
      if (node.callee?.type !== "MemberExpression") {
        return "unknown";
      }
      const method = propertyName(node.callee.property);
      if (method === "make") {
        return schemaRole(node.callee.object);
      }
      if (method !== "pipe") {
        return "unknown";
      }
      const baseRole = schemaRole(node.callee.object);
      if (baseRole !== "plain" && baseRole !== "branded") {
        return "unknown";
      }
      return containsSchemaBrand(node) ? "branded" : "plain";
    };

    return {
      ImportDeclaration: schemaImports.importDeclaration,
      VariableDeclarator(node) {
        if (node.id?.type === "Identifier") {
          localSchemaRoles.set(node.id.name, schemaRole(node.init));
        }
      },
      Property(node) {
        if (node.parent?.type !== "ObjectExpression") {
          return;
        }
        const key = propertyName(node.key);
        if (key === null || !nominalIdentifierPropertyNames.has(key)) {
          return;
        }
        const role = schemaRole(node.value);
        if (role === "plain") {
          context.report({
            messageId: "noUnbrandedIdentifierSchema",
            node: node.value,
          });
          return;
        }
        if (role === "unknown" && node.value?.type === "Identifier") {
          unresolvedIdentifierProperties.push(node);
        }
      },
      "Program:exit"() {
        for (const node of unresolvedIdentifierProperties) {
          if (schemaRole(node.value) !== "plain") {
            continue;
          }
          context.report({
            messageId: "noUnbrandedIdentifierSchema",
            node: node.value,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Require identifier-shaped Schema fields to use an owning branded or literal Schema instead of a plain string Schema.",
    },
    messages: {
      noUnbrandedIdentifierSchema:
        "Identifier-shaped fields must use an owning branded or literal Schema, not Schema.String or Schema.Trimmed. Keep raw invalid ingress diagnostics explicitly scoped and typed.",
    },
    type: "problem",
  },
};

const noSchemaEncoderOutsideEgress = {
  create(context) {
    const schemaImports = createEffectModuleImportTracker("Schema");

    return {
      CallExpression(node) {
        const methodName = schemaImports.callMethodName(node);

        if (methodName !== null && schemaEncoderMethodPattern.test(methodName)) {
          context.report({
            messageId: "noSchemaEncoderOutsideEgress",
            node: node.callee,
          });
        }
      },
      ImportDeclaration: schemaImports.importDeclaration,
    };
  },
  meta: {
    docs: {
      description:
        "Disallow Effect Schema encoder execution outside configured serialization egress boundaries.",
    },
    messages: {
      noSchemaEncoderOutsideEgress:
        "Schema encoder execution belongs only where a typed value leaves the system, such as an HTTP/RPC response, loader codec, report, command output, persisted state, or provider request. Schema encodeTo transformations are not encoder execution.",
    },
    type: "problem",
  },
};

const noThrowingSchemaSyncCodec = {
  create(context) {
    const schemaImports = createEffectModuleImportTracker("Schema");

    return {
      CallExpression(node) {
        const methodName = schemaImports.callMethodName(node);

        if (methodName?.endsWith("Sync") && !nonThrowingDecoderMethodPattern.test(methodName)) {
          context.report({
            messageId: "noThrowingSchemaSyncCodec",
            node: node.callee,
          });
        }
      },
      ImportDeclaration: schemaImports.importDeclaration,
    };
  },
  meta: {
    docs: {
      description: "Disallow throwing synchronous Effect Schema codecs in production code.",
    },
    messages: {
      noThrowingSchemaSyncCodec:
        "Do not call throwing Schema *Sync codecs in production code, including top-level constants and runtime files. Use Schema.decodeUnknownEffect or Schema.encodeUnknownEffect at an Effect boundary. Synchronous consumer boundaries may use non-throwing decoder Result, Exit, or Option variants only.",
    },
    type: "problem",
  },
};

const noNonThrowingSchemaSyncDecoderOutsideConsumer = {
  create(context) {
    const schemaImports = createEffectModuleImportTracker("Schema");

    return {
      CallExpression(node) {
        const methodName = schemaImports.callMethodName(node);

        if (
          methodName !== null &&
          schemaDecoderMethodPattern.test(methodName) &&
          nonThrowingDecoderMethodPattern.test(methodName)
        ) {
          context.report({
            messageId: "noNonThrowingSchemaSyncDecoderOutsideConsumer",
            node: node.callee,
          });
        }
      },
      ImportDeclaration: schemaImports.importDeclaration,
    };
  },
  meta: {
    docs: {
      description:
        "Restrict non-throwing synchronous Schema decoders to configured consumer boundaries.",
    },
    messages: {
      noNonThrowingSchemaSyncDecoderOutsideConsumer:
        "Non-throwing synchronous Schema decoders are reserved for configured synchronous consumer boundaries, tests, and deterministic fixtures. Use an Effect decoder at an ingress boundary instead.",
    },
    type: "problem",
  },
};

const hasTaggedErrorAncestor = (node, schemaImports) => {
  let current = node?.parent;

  while (current) {
    let call = current;

    while (call?.type === "CallExpression") {
      const methodName = schemaImports.callMethodName(call);
      if (methodName === "TaggedError" || methodName === "TaggedErrorClass") {
        return true;
      }

      call = call.callee;
    }

    current = current.parent;
  }

  return false;
};

const noUnknownTaggedErrorPayload = {
  create(context) {
    const schemaImports = createEffectModuleImportTracker("Schema");

    return {
      ImportDeclaration: schemaImports.importDeclaration,
      Property(node) {
        if (
          schemaImports.isReference(node.value, "Unknown") &&
          hasTaggedErrorAncestor(node, schemaImports)
        ) {
          context.report({
            messageId: "noUnknownTaggedErrorPayload",
            node: node.value,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow Schema.Unknown in tagged error payloads.",
    },
    messages: {
      noUnknownTaggedErrorPayload:
        "Tagged errors must expose schema-safe payload fields, not Schema.Unknown. Preserve defects as defects or map only safe message, command, status, and canonical identity fields at the true adapter boundary.",
    },
    type: "problem",
  },
};

const noUnknownServiceContract = {
  create(context) {
    return {
      TSUnknownKeyword(node) {
        const annotation = node.parent;
        const parameter = annotation.parent ?? {};
        const functionNode = parameter.parent ?? {};
        const typeArguments = annotation;
        const typeReference = typeArguments.parent ?? {};
        const typeName = typeReference.typeName ?? {};
        const typeNameLeft = typeName.left ?? {};
        const typeNameRight = typeName.right ?? {};
        const directParameterContract = [annotation.type, parameter.type, functionNode.type].join(
          ":",
        );
        const effectErrorTypeContract = [
          typeArguments.type,
          typeReference.type,
          typeName.type,
          typeNameLeft.type,
          typeNameLeft.name,
          typeNameRight.type,
          typeNameRight.name,
        ].join(":");
        const isDirectParameter = directUnknownParameterContracts.has(directParameterContract);
        const isEffectError =
          effectErrorTypeContract === effectErrorUnknownContract &&
          (typeArguments.params ?? [])[1] === node;

        if (isDirectParameter || isEffectError) {
          context.report({
            messageId: "noUnknownServiceContract",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Disallow direct unknown parameter annotations and Effect error channels in service contracts.",
    },
    messages: {
      noUnknownServiceContract:
        "Service contracts must accept schema-derived inputs and expose closed tagged Effect errors, not unknown. Decode raw input at the owning ingress boundary and map expected failures to canonical tagged errors.",
    },
    type: "problem",
  },
};

const nativeArrayMethods = new Set([
  "concat",
  "every",
  "filter",
  "find",
  "findIndex",
  "flat",
  "flatMap",
  "forEach",
  "map",
  "reduce",
  "reduceRight",
  "slice",
  "some",
  "sort",
]);

const effectCollectionNamespaces = new Set([
  "Array",
  "Chunk",
  "Effect",
  "EffectArray",
  "HashMap",
  "HashSet",
  "Option",
  "Record",
]);

const isEffectCollectionNamespaceCall = (callee) =>
  callee?.type === "MemberExpression" &&
  callee.object?.type === "Identifier" &&
  effectCollectionNamespaces.has(callee.object.name);

const effectDataFirstCollectionNamespaces = new Set([
  "Array",
  "Chunk",
  "EffectArray",
  "HashMap",
  "HashSet",
  "Option",
  "Record",
]);

const effectDataFirstCollectionMethods = new Set([
  "every",
  "filter",
  "findFirst",
  "flatMap",
  "forEach",
  "map",
  "partition",
  "reduce",
  "some",
  "sort",
]);

const noEffectArrayDataFirst = {
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee?.type === "MemberExpression" &&
          node.callee.object?.type === "Identifier" &&
          effectDataFirstCollectionNamespaces.has(node.callee.object.name) &&
          effectDataFirstCollectionMethods.has(propertyName(node.callee.property)) &&
          (node.arguments?.length ?? 0) > 1
        ) {
          context.report({
            messageId: "noEffectArrayDataFirst",
            node: node.callee,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow data-first Effect collection calls in strict collection scopes.",
    },
    messages: {
      noEffectArrayDataFirst:
        "Use pipe-first or curried Effect collection calls instead of data-first calls. Prefer Array.map((item) => value)(items) or items.pipe(Array.map((item) => value)) so collection policy stays consistent and pipeable.",
    },
    type: "problem",
  },
};

const noNativeArrayMethods = {
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee?.type === "MemberExpression" &&
          !isEffectCollectionNamespaceCall(node.callee) &&
          nativeArrayMethods.has(propertyName(node.callee.property))
        ) {
          context.report({
            messageId: "noNativeArrayMethods",
            node: node.callee.property,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow native array method pipelines in Effect-native service code.",
    },
    messages: {
      noNativeArrayMethods:
        "Do not use native array methods in Effect-owned code. Use Effect Array or Chunk so collection policy is explicit and pipeable: Array.filter(items, predicate), Array.map(items, toValue), Chunk.fromIterable(items).pipe(Chunk.map(toValue)). For optional lookup use Array.findFirst(...).pipe(Option.match(...)), not items.find(...).",
    },
    type: "problem",
  },
};

const tinyMapperHelperNamePattern = /^(?:map|to|decode|encode|normalize)[A-Z]\w*$/u;
const effectTinyMapperMethods = new Set(["map", "mapError"]);
const rpcTinyMapperMethods = new Set(["map", "mapError"]);
const schemaBoundaryMethodPattern = /^(?:decode|encode)/u;

const isKnownTinyMapperHelperCall = (node, helper) => {
  if (!tinyMapperHelperNamePattern.test(helper.name)) {
    return false;
  }

  if (node.callee?.type !== "MemberExpression" || node.callee.object?.type !== "Identifier") {
    return false;
  }

  const objectName = node.callee.object.name;
  const methodName = propertyName(node.callee.property);

  return (
    (objectName === "Effect" && effectTinyMapperMethods.has(methodName)) ||
    (objectName === "Rpc" && rpcTinyMapperMethods.has(methodName)) ||
    (objectName === "Schema" && schemaBoundaryMethodPattern.test(methodName))
  );
};

const noNestedWrapperCalls = {
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee?.type === "Identifier" &&
          node.arguments.some((argument) => argument?.type === "CallExpression")
        ) {
          context.report({
            messageId: "noNestedWrapperCalls",
            node,
          });
        }

        for (const argument of node.arguments ?? []) {
          if (argument?.type === "Identifier" && isKnownTinyMapperHelperCall(node, argument)) {
            context.report({
              messageId: "noTinyMapperHelper",
              node: argument,
            });
          }
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow nested wrapper-call composition in Effect-owned code.",
    },
    messages: {
      noNestedWrapperCalls:
        "Do not compose transformations as nested wrapper calls like toResponse(filterEntries(query)). Use pipe-first data flow when sequencing transformations: query.pipe(filterEntries, toResponse) or pipe(query, filterEntries, toResponse). Keep inline Effect error transforms at the callsite with .pipe(Effect.mapError(...), Effect.catchTag(...)).",
      noTinyMapperHelper:
        "Do not extract tiny map*/to*/decode*/encode* helpers only to pass them into Effect.map, Effect.mapError, Schema decode/encode calls, or RPC adapter mapping. Inline the one-off transform at the callsite or move real reusable policy into the owning schema/service contract.",
    },
    type: "problem",
  },
};

const noRouteLoaderMappers = {
  create(context) {
    return {
      CallExpression(node) {
        for (const argument of node.arguments ?? []) {
          if (argument?.type === "Identifier" && isKnownTinyMapperHelperCall(node, argument)) {
            context.report({
              messageId: "noRouteLoaderMappers",
              node: argument,
            });
          }
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Disallow one-off mapper helpers passed into Effect, Schema, and RPC transforms.",
    },
    messages: {
      noRouteLoaderMappers:
        "Do not pass one-off map*/to*/decode*/encode*/normalize* helpers into Effect, Schema, or RPC transforms. Inline narrow transforms at the callsite or move durable behavior into the owning schema or service contract.",
    },
    type: "problem",
  },
};

const nativeCollectionConstructors = new Set(["Map", "Set", "WeakMap", "WeakSet"]);

const noNativeCollections = {
  create(context) {
    return {
      NewExpression(node) {
        if (
          node.callee?.type === "Identifier" &&
          nativeCollectionConstructors.has(node.callee.name)
        ) {
          context.report({
            messageId: "noNativeCollections",
            node: node.callee,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow native Map and Set constructors in Effect-native service code.",
    },
    messages: {
      noNativeCollections:
        "Do not use native Map/Set in Effect-owned code. Use Effect HashMap and HashSet so lookups, equality, and absence are typed: HashMap.empty<Key, Value>().pipe(HashMap.set(key, value)); HashMap.get(map, key).pipe(Option.match(...)); HashSet.fromIterable(ids).",
    },
    type: "problem",
  },
};

const isRawNullObjectProperty = (node) =>
  node?.type === "Property" && node.value?.type === "Literal" && node.value.value === null;

const nullableBoundaryMemberNames = new Set(["Option.getOrNull", "Schema.NullOr"]);

const noNullableBoundaryLeak = {
  create(context) {
    const fileName = normalizedSourceFileName(context);

    if (genericTestFilePattern.test(fileName)) {
      return {};
    }

    return {
      CallExpression(node) {
        if (nullableBoundaryMemberNames.has(memberExpressionName(node.callee))) {
          context.report({
            messageId: "noNullableBoundaryLeak",
            node: node.callee,
          });
        }
      },
      Property(node) {
        if (isRawNullObjectProperty(node)) {
          context.report({
            messageId: "noNullableBoundaryLeak",
            node: node.value,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow nullable values leaking through Effect-owned internal boundaries.",
    },
    messages: {
      noNullableBoundaryLeak:
        "Do not leak null through internal Effect-owned boundaries. Keep absence as Option or schema-owned optional fields, and confine explicit null handling to external protocol schemas or adapters.",
    },
    type: "problem",
  },
};

const hostServiceFilePattern =
  /(?<ultraciteCapture1>^|[/\\])(?:service|services|schemas|schema|errors|config)\.ts$/u;
const hostApiSourcePattern =
  /^(?:node:|bun$|playwright$|lighthouse$|chrome-launcher$|alchemy(?:\/|$)|@cloudflare(?:\/|$)|cloudflare$|@octokit(?:\/|$)|@actions(?:\/|$)|@sentry(?:\/|$)|stripe$|resend$|@aws(?:\/|$)|aws-sdk$)/u;
const hostApiAllowedBoundaryPattern =
  /(?<ultraciteCapture1>^|[/\\])(?:main|_runtime)\.ts$|(?<ultraciteCapture2>^|[/\\])runtime\.(?:client|server)\.ts$|(?<ultraciteCapture3>^|[/\\]).*\.(?:runtime|main|layer)\.ts$|(?<ultraciteCapture4>^|[/\\])(?:live|bun)\.layer\.ts$/u;

const noHostApiInService = {
  create(context) {
    const fileName = normalizedSourceFileName(context);

    if (
      !hostServiceFilePattern.test(fileName) ||
      hostApiAllowedBoundaryPattern.test(fileName) ||
      genericTestFilePattern.test(fileName) ||
      genericCliFilePattern.test(fileName)
    ) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        if (hostApiSourcePattern.test(importSourceValue(node))) {
          context.report({
            messageId: "noHostApiInService",
            node: node.source,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow direct host APIs in Effect service contract and schema files.",
    },
    messages: {
      noHostApiInService:
        "Do not import host APIs or provider SDKs in service contracts, schemas, errors, or config modules. Keep contracts portable and put live host access in layer, runtime, CLI, or adapter modules.",
    },
    type: "problem",
  },
};

const serviceFileNamePattern =
  /(?<ultraciteCapture1>^|[/\\])(?<ultraciteCapture2>service|services)\.ts$/u;
const layerExportNamePattern = /(?<ultraciteCapture1>Live|Mock|Test|TestLive)$/u;

const noLayerExportsInServiceFiles = {
  create(context) {
    const fileName = sourceFileName(context);

    if (!serviceFileNamePattern.test(fileName)) {
      return {};
    }

    return {
      ExportNamedDeclaration(node) {
        const { declaration } = node;

        if (declaration?.type !== "VariableDeclaration") {
          return;
        }

        for (const declarator of declaration.declarations) {
          if (
            declarator.id?.type === "Identifier" &&
            layerExportNamePattern.test(declarator.id.name)
          ) {
            context.report({
              messageId: "noLayerExportsInServiceFiles",
              node: declarator.id,
            });
          }
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow Live/Mock/Test layer exports from service definition files.",
    },
    messages: {
      noLayerExportsInServiceFiles:
        "Do not export Live, Mock, or Test layers from service definition files. service.ts owns the Context.Service contract and canonical request/error schemas. Put production wiring in live.layer.ts, test wiring in test.layer.ts or test helpers, then compose layers at package/app boundaries.",
    },
    type: "problem",
  },
};

const noThrow = {
  create(context) {
    return {
      ThrowStatement(node) {
        context.report({
          messageId: "noThrow",
          node,
        });
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow thrown exceptions in Effect-native service code.",
    },
    messages: {
      noThrow:
        "Do not throw from Effect-owned code. Model failures as tagged errors and return them through Effect. At boundaries, use Effect.try/Effect.tryPromise with catch mapping to tagged errors.",
    },
    type: "problem",
  },
};

const reencodedResultTags = new Set(["Success", "Failure", "Error"]);

const isReencodedResultTagProperty = (node) => {
  const isTagKey =
    (node.key?.type === "Identifier" && node.key.name === "_tag") ||
    (node.key?.type === "Literal" && node.key.value === "_tag");

  return (
    isTagKey && node.value?.type === "Literal" && reencodedResultTags.has(String(node.value.value))
  );
};

const noResultExitReencoding = {
  create(context) {
    const fileName = normalizedSourceFileName(context);

    if (genericTestFilePattern.test(fileName)) {
      return {};
    }

    return {
      Property(node) {
        if (isReencodedResultTagProperty(node)) {
          context.report({
            messageId: "noResultExitReencoding",
            node: node.value,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Disallow local Success, Failure, and Error result encodings in Effect-owned code.",
    },
    messages: {
      noResultExitReencoding:
        "Do not hand-roll local Success, Failure, or Error result encodings. Use Effect Result, Exit, or a schema-owned tagged value when outcomes cross a boundary.",
    },
    type: "problem",
  },
};

const runtimeBoundaryPattern =
  /(?<ultraciteCapture1>^|[/\\])(?<ultraciteCapture2>index|main|server|_runtime|runtime(?<ultraciteCapture3>\.(?<ultraciteCapture4>client|server))?|.*\.runtime|.*\.layer)\.ts$/u;

const isRuntimeExecutionCall = (node) =>
  node?.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  node.callee.object?.type === "Identifier" &&
  ((node.callee.object.name === "Effect" &&
    ["runFork", "runPromise", "runPromiseExit", "runSync", "runSyncExit"].includes(
      propertyName(node.callee.property),
    )) ||
    (node.callee.object.name === "ManagedRuntime" &&
      propertyName(node.callee.property) === "make") ||
    (node.callee.object.name === "BunRuntime" && propertyName(node.callee.property) === "runMain"));

const noRuntimeExecutionOutsideBoundaries = {
  create(context) {
    const fileName = sourceFileName(context);

    return {
      CallExpression(node) {
        if (isRuntimeExecutionCall(node) && !runtimeBoundaryPattern.test(fileName)) {
          context.report({
            messageId: "noRuntimeExecutionOutsideBoundaries",
            node: node.callee,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Restrict Effect runtime execution to app/runtime boundary files.",
    },
    messages: {
      noRuntimeExecutionOutsideBoundaries:
        "Do not execute Effects or create ManagedRuntime inside package/service logic. Runtime execution belongs in app entrypoints, runtime files, server files, or layer boundary modules. Services should return Effect values and expose Layers; apps run them with BunRuntime.runMain or a module-scoped ManagedRuntime that is disposed by the owning runtime lifecycle.",
    },
    type: "problem",
  },
};

const noEffectRunInAdapterWithoutBoundary = {
  create(context) {
    const fileName = normalizedSourceFileName(context);

    return {
      CallExpression(node) {
        if (isRuntimeExecutionCall(node) && !isGenericRuntimeOrCliFile(fileName)) {
          context.report({
            messageId: "noEffectRunInAdapterWithoutBoundary",
            node: node.callee,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Restrict Effect execution and ManagedRuntime construction to explicit runtime or adapter files.",
    },
    messages: {
      noEffectRunInAdapterWithoutBoundary:
        "Do not execute Effects or create ManagedRuntime outside explicit runtime, main, CLI, layer, or test boundaries. Package logic should return Effect programs and let the owning adapter run them.",
    },
    type: "problem",
  },
};

const effectPromiseBoundaryMethods = new Set(["promise", "tryPromise"]);

const isEffectPromiseBoundaryCall = (node) =>
  node?.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  node.callee.object?.type === "Identifier" &&
  node.callee.object.name === "Effect" &&
  effectPromiseBoundaryMethods.has(propertyName(node.callee.property));

const isEffectTryPromiseOptionsObject = (node) =>
  node?.type === "ObjectExpression" &&
  node.parent?.type === "CallExpression" &&
  isEffectPromiseBoundaryCall(node.parent) &&
  propertyName(node.parent.callee.property) === "tryPromise";

const isAllowedEffectPromiseBoundaryFunction = (node) => {
  if (node.parent?.type === "CallExpression" && isEffectPromiseBoundaryCall(node.parent)) {
    return true;
  }

  return (
    node.parent?.type === "Property" &&
    propertyName(node.parent.key) === "try" &&
    isEffectTryPromiseOptionsObject(node.parent.parent)
  );
};

const isFunctionNode = (node) =>
  node?.type === "ArrowFunctionExpression" ||
  node?.type === "FunctionDeclaration" ||
  node?.type === "FunctionExpression";

const isInsideAllowedEffectPromiseBoundaryFunction = (node) => {
  let { parent } = node;

  while (parent) {
    if (isFunctionNode(parent)) {
      return isAllowedEffectPromiseBoundaryFunction(parent);
    }

    ({ parent } = parent);
  }

  return false;
};

const noAsyncAwaitPromise = {
  create(context) {
    const reportAsyncIfNeeded = (node) => {
      if (node.async && !isAllowedEffectPromiseBoundaryFunction(node)) {
        context.report({
          messageId: "noAsync",
          node,
        });
      }
    };

    return {
      ArrowFunctionExpression: reportAsyncIfNeeded,
      AwaitExpression(node) {
        if (isInsideAllowedEffectPromiseBoundaryFunction(node)) {
          return;
        }

        context.report({
          messageId: "noAwait",
          node,
        });
      },
      FunctionDeclaration: reportAsyncIfNeeded,
      FunctionExpression: reportAsyncIfNeeded,
      NewExpression(node) {
        if (node.callee?.type === "Identifier" && node.callee.name === "Promise") {
          context.report({
            messageId: "noPromise",
            node: node.callee,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow async, await, and new Promise in Effect-native service code.",
    },
    messages: {
      noAsync:
        "Do not use async functions in Effect-owned code. Return Effect values directly: const program = Effect.gen(function* () { const value = yield* service.read(...); return value; }). Use Effect.promise/Effect.tryPromise only at external boundaries and map errors inline to tagged errors.",
      noAwait:
        "Do not await inside Effect-owned code. Compose Effects with pipe, Effect.gen, Effect.flatMap, Effect.all, and Layer-provided services. Boundary promises must enter through Effect.tryPromise with inline tagged-error mapping.",
      noPromise:
        "Do not construct Promise in Effect-owned code. Use Effect.async for callback APIs, Effect.promise for infallible promise boundaries, or Effect.tryPromise with inline tagged-error mapping for fallible boundaries.",
    },
    type: "problem",
  },
};

const noBareEffectTryPromise = {
  create(context) {
    const effectImports = createEffectModuleImportTracker("Effect");

    return {
      CallExpression(node) {
        if (
          effectImports.callMethodName(node) === "tryPromise" &&
          node.arguments?.[0]?.type !== "ObjectExpression"
        ) {
          context.report({
            messageId: "noBareEffectTryPromise",
            node: node.callee,
          });
        }
      },
      ImportDeclaration: effectImports.importDeclaration,
    };
  },
  meta: {
    docs: {
      description: "Require explicit typed rejection mapping at Effect.tryPromise boundaries.",
    },
    messages: {
      noBareEffectTryPromise:
        "Use Effect.tryPromise({ try, catch }) and map rejection to the boundary's canonical tagged error. Use Effect.promise only when rejection is intentionally a defect.",
    },
    type: "problem",
  },
};

const noDefectingWebCryptoDigest = {
  create(context) {
    const effectImports = createEffectModuleImportTracker("Effect");

    return {
      CallExpression(node) {
        const callee = unwrapCallee(node.callee);
        if (
          callee?.type !== "MemberExpression" ||
          propertyName(callee.property) !== "digest" ||
          callee.object?.type !== "MemberExpression" ||
          propertyName(callee.object.property) !== "subtle" ||
          callee.object.object?.type !== "Identifier" ||
          callee.object.object.name !== "crypto"
        ) {
          return;
        }

        let callback = node.parent;
        while (callback && !isFunctionNode(callback)) {
          callback = callback.parent;
        }

        if (
          callback &&
          callback.parent?.type === "CallExpression" &&
          callback.parent.arguments?.includes(callback) &&
          effectImports.callMethodName(callback.parent) === "promise"
        ) {
          context.report({
            messageId: "noDefectingWebCryptoDigest",
            node: node.callee,
          });
        }
      },
      ImportDeclaration: effectImports.importDeclaration,
    };
  },
  meta: {
    docs: {
      description: "Require typed rejection mapping for Web Crypto digest boundaries.",
    },
    messages: {
      noDefectingWebCryptoDigest:
        "Web Crypto digest can reject. Use Effect.tryPromise({ try, catch }) and map rejection to the boundary's canonical tagged error.",
    },
    type: "problem",
  },
};

const isMemberCall = (node, objectName, methodName) =>
  node?.type === "CallExpression" &&
  node.callee?.type === "MemberExpression" &&
  node.callee.object?.type === "Identifier" &&
  node.callee.object.name === objectName &&
  propertyName(node.callee.property) === methodName;

const noJsonParseStringify = {
  create(context) {
    return {
      CallExpression(node) {
        if (isMemberCall(node, "JSON", "parse")) {
          context.report({
            messageId: "noJsonParse",
            node: node.callee,
          });
        }

        if (isMemberCall(node, "JSON", "stringify")) {
          context.report({
            messageId: "noJsonStringify",
            node: node.callee,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow ad hoc JSON parse/stringify in schema-owned service code.",
    },
    messages: {
      noJsonParse:
        "Do not JSON.parse inputs directly. Decode unknown JSON through the owning Schema: Schema.decodeUnknown(RequestSchema)(value), or Schema.decodeJson(RequestSchema)(text) at an HTTP/file boundary, then map ParseResult errors to tagged service errors.",
      noJsonStringify:
        "Do not JSON.stringify outputs directly. Encode through the owning Schema at the boundary: Schema.encode(ResponseSchema)(value) or Schema.encodeJson(ResponseSchema)(value), keeping response shape owned by Schema.",
    },
    type: "problem",
  },
};

const noAmbientTimeOrRandom = {
  create(context) {
    return {
      CallExpression(node) {
        if (isMemberCall(node, "Date", "now")) {
          context.report({
            messageId: "noDateNow",
            node: node.callee,
          });
        }

        if (isMemberCall(node, "Math", "random")) {
          context.report({
            messageId: "noMathRandom",
            node: node.callee,
          });
        }
      },
      NewExpression(node) {
        if (node.callee?.type === "Identifier" && node.callee.name === "Date") {
          context.report({
            messageId: "noNewDate",
            node: node.callee,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow ambient time and randomness in deterministic Effect-owned code.",
    },
    messages: {
      noDateNow:
        "Do not read ambient time with Date.now in Effect-owned code. Time must be explicit input, canonical config, or an Effect Clock dependency at the boundary: yield* Clock.currentTimeMillis. Deterministic behavior must not hide clock reads.",
      noMathRandom:
        "Do not use Math.random in Effect-owned code. Randomness must be explicit input or an Effect Random dependency at the boundary, and deterministic Effect-owned modules should avoid randomness entirely.",
      noNewDate:
        "Do not construct Date from ambient state in Effect-owned code. Dates and context keys must come from canonical schemas/config. For boundary time, use Effect Clock and convert through canonical Schema-owned date/year types.",
    },
    type: "problem",
  },
};

const noSwitch = {
  create(context) {
    return {
      SwitchStatement(node) {
        context.report({
          messageId: "noSwitch",
          node,
        });
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow switch statements in Effect-native code.",
    },
    messages: {
      noSwitch: "Use Effect Match with Match.exhaustive instead of switch.",
    },
    type: "problem",
  },
};

const hasImportedName = (node, importedName, localName = importedName) =>
  (node.specifiers ?? []).some(
    (specifier) =>
      importedSpecifierName(specifier) === importedName &&
      localSpecifierName(specifier) === localName,
  );

const hasAnyVitestGlobalImport = (node) =>
  (node.specifiers ?? []).some((specifier) => {
    const name = importedSpecifierName(specifier);

    return (name === "it" || name === "describe") && localSpecifierName(specifier) === name;
  });

const noEffectTestGlobalMix = {
  create(context) {
    let unaliasedEffectIt = null;
    let unaliasedVitestGlobal = null;

    return {
      ImportDeclaration(node) {
        const source = importSourceValue(node);

        if (source === "@effect/vitest" && hasImportedName(node, "it", "it")) {
          unaliasedEffectIt = node;
        }

        if (source === "vitest" && hasAnyVitestGlobalImport(node)) {
          unaliasedVitestGlobal = node;
        }
      },
      "Program:exit"() {
        if (unaliasedEffectIt && unaliasedVitestGlobal) {
          context.report({
            messageId: "noEffectTestGlobalMix",
            node: unaliasedVitestGlobal,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow unaliased @effect/vitest it imports mixed with Vitest globals.",
    },
    messages: {
      noEffectTestGlobalMix:
        'Do not mix an unaliased `it` import from @effect/vitest with unaliased Vitest `it` or `describe` imports. Alias the Effect test helper, for example `import { it as effectIt } from "@effect/vitest"`.',
    },
    type: "problem",
  },
};

const noModuleLevelMutableTestState = {
  create(context) {
    if (!genericTestFilePattern.test(normalizedSourceFileName(context))) {
      return {};
    }

    const isModuleLevel = (node) => {
      let current = node.parent;
      while (current && current.type !== "Program") {
        if (isFunctionNode(current)) {
          return false;
        }
        if (
          current.type === "TSModuleDeclaration" &&
          (current.declare || current.global || current.id?.name === "global")
        ) {
          return false;
        }
        current = current.parent;
      }
      return current?.type === "Program";
    };

    return {
      VariableDeclaration(node) {
        if (node.kind !== "const" && isModuleLevel(node)) {
          context.report({
            messageId: "noModuleLevelMutableTestState",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Disallow module-level mutable bindings in tests that can leak state between cases.",
    },
    messages: {
      noModuleLevelMutableTestState:
        "Do not keep mutable test state in a module-level let or var binding. Build isolated state inside each test or test Layer; use Effect Ref, Deferred, Queue, or a scoped service for observations and coordination. Keep unavoidable synchronous host-adapter mutation inside that per-test boundary.",
    },
    type: "problem",
  },
};

const noUnscopedWebHandler = {
  create(context) {
    const effectNamespaces = new Set();
    const httpRouterNamespaces = new Set();

    const isEffectCall = (node, methodName) => {
      const callee = unwrapCallee(node?.callee);

      return (
        node?.type === "CallExpression" &&
        callee?.type === "MemberExpression" &&
        callee.object?.type === "Identifier" &&
        effectNamespaces.has(callee.object.name) &&
        propertyName(callee.property) === methodName
      );
    };

    const releaseDisposeBinding = (release) => {
      if (release?.type !== "ArrowFunctionExpression" && release?.type !== "FunctionExpression") {
        return null;
      }

      const acquired = release.params?.[0];
      if (acquired?.type !== "ObjectPattern") {
        return null;
      }

      for (const property of acquired.properties ?? []) {
        if (
          property?.type === "Property" &&
          propertyName(property.key) === "dispose" &&
          property.value?.type === "Identifier"
        ) {
          return property.value.name;
        }
      }

      return null;
    };

    const releaseOwnsDispose = (release) => {
      const disposeName = releaseDisposeBinding(release);
      const returned = returnedFunctionEffect(release);

      return (
        disposeName !== null &&
        isEffectCall(returned, "promise") &&
        returned.arguments?.[0]?.type === "Identifier" &&
        returned.arguments[0].name === disposeName
      );
    };

    const acquisitionReturnsHandler = (acquisition, handler) => {
      const callee = unwrapCallee(acquisition?.callee);
      if (
        acquisition?.type !== "CallExpression" ||
        callee?.type !== "MemberExpression" ||
        callee.object?.type !== "Identifier" ||
        !effectNamespaces.has(callee.object.name) ||
        propertyName(callee.property) !== "sync"
      ) {
        return false;
      }

      const acquire = acquisition.arguments?.[0];
      return (
        (acquire?.type === "ArrowFunctionExpression" || acquire?.type === "FunctionExpression") &&
        returnedFunctionEffect(acquire) === handler
      );
    };

    return {
      ImportDeclaration(node) {
        const source = importSourceValue(node);

        for (const specifier of node.specifiers ?? []) {
          const importedName = importedSpecifierName(specifier);
          const localName = localSpecifierName(specifier);
          if (localName === null) {
            continue;
          }
          if (source === "effect" && importedName === "Effect") {
            effectNamespaces.add(localName);
          }
          if (source === "effect/unstable/http" && importedName === "HttpRouter") {
            httpRouterNamespaces.add(localName);
          }
        }
      },
      CallExpression(node) {
        const callee = unwrapCallee(node.callee);
        if (
          callee?.type !== "MemberExpression" ||
          callee.object?.type !== "Identifier" ||
          !httpRouterNamespaces.has(callee.object.name) ||
          propertyName(callee.property) !== "toWebHandler"
        ) {
          return;
        }

        let current = node.parent;
        while (current?.type !== "Program") {
          if (
            isEffectCall(current, "acquireRelease") &&
            acquisitionReturnsHandler(current.arguments?.[0], node) &&
            releaseOwnsDispose(current.arguments?.[1])
          ) {
            return;
          }
          current = current?.parent;
        }

        context.report({
          messageId: "noUnscopedWebHandler",
          node: callee,
        });
      },
    };
  },
  meta: {
    docs: {
      description:
        "Require admitted test-runtime Web handlers to be acquired with their disposer registered in Effect Scope.",
    },
    messages: {
      noUnscopedWebHandler:
        "Create HttpRouter.toWebHandler in Effect.acquireRelease's acquire operation and register the acquired dispose function through Effect.promise in its release operation.",
    },
    type: "problem",
  },
};

const noUnscopedManagedRuntime = {
  create(context) {
    const effectNamespaces = new Set();
    const managedRuntimeNamespaces = new Set();

    const isEffectAcquireRelease = (node) => {
      const callee = unwrapCallee(node?.callee);
      return (
        node?.type === "CallExpression" &&
        callee?.type === "MemberExpression" &&
        callee.object?.type === "Identifier" &&
        effectNamespaces.has(callee.object.name) &&
        propertyName(callee.property) === "acquireRelease"
      );
    };

    const releaseOwnsRuntime = (release) => {
      if (release?.type !== "ArrowFunctionExpression" && release?.type !== "FunctionExpression") {
        return false;
      }
      const runtime = release.params?.[0];
      const returned = returnedFunctionEffect(release);

      return (
        runtime?.type === "Identifier" &&
        returned?.type === "MemberExpression" &&
        returned.object?.type === "Identifier" &&
        returned.object.name === runtime.name &&
        propertyName(returned.property) === "disposeEffect"
      );
    };

    const acquisitionReturnsRuntime = (acquisition, runtime) => {
      const callee = unwrapCallee(acquisition?.callee);
      if (
        acquisition?.type !== "CallExpression" ||
        callee?.type !== "MemberExpression" ||
        callee.object?.type !== "Identifier" ||
        !effectNamespaces.has(callee.object.name) ||
        propertyName(callee.property) !== "sync"
      ) {
        return false;
      }

      const acquire = acquisition.arguments?.[0];
      return (
        (acquire?.type === "ArrowFunctionExpression" || acquire?.type === "FunctionExpression") &&
        returnedFunctionValue(acquire) === runtime
      );
    };

    return {
      ImportDeclaration(node) {
        const source = importSourceValue(node);
        for (const specifier of node.specifiers ?? []) {
          const importedName = importedSpecifierName(specifier);
          const localName = localSpecifierName(specifier);
          if (source !== "effect" || localName === null) {
            continue;
          }
          if (importedName === "Effect") {
            effectNamespaces.add(localName);
          }
          if (importedName === "ManagedRuntime") {
            managedRuntimeNamespaces.add(localName);
          }
        }
      },
      CallExpression(node) {
        const callee = unwrapCallee(node.callee);
        if (
          callee?.type !== "MemberExpression" ||
          callee.object?.type !== "Identifier" ||
          !managedRuntimeNamespaces.has(callee.object.name) ||
          propertyName(callee.property) !== "make"
        ) {
          return;
        }

        let child = node;
        let current = node.parent;
        while (current?.type !== "Program") {
          if (
            isEffectAcquireRelease(current) &&
            current.arguments?.[0] === child &&
            acquisitionReturnsRuntime(child, node) &&
            releaseOwnsRuntime(current.arguments?.[1])
          ) {
            return;
          }
          child = current;
          current = current?.parent;
        }

        context.report({
          messageId: "noUnscopedManagedRuntime",
          node: callee,
        });
      },
    };
  },
  meta: {
    docs: {
      description:
        "Require admitted ManagedRuntime instances to be acquired and disposed by Effect Scope.",
    },
    messages: {
      noUnscopedManagedRuntime:
        "Create ManagedRuntime.make in Effect.acquireRelease's acquire operation and return that runtime's disposeEffect from the paired release operation. Do not create unowned or per-request runtimes.",
    },
    type: "problem",
  },
};

export default {
  meta: {
    name: "effect",
  },
  rules: {
    "no-ambient-time-or-random": noAmbientTimeOrRandom,
    "no-async-await-promise": noAsyncAwaitPromise,
    "no-conditional-object-spread": noConditionalObjectSpread,
    "no-console-outside-runtime": noConsoleOutsideRuntime,
    "no-effect-array-data-first": noEffectArrayDataFirst,
    "no-effect-run-in-adapter-without-boundary": noEffectRunInAdapterWithoutBoundary,
    "no-effect-test-global-mix": noEffectTestGlobalMix,
    "no-module-level-mutable-test-state": noModuleLevelMutableTestState,
    "no-unscoped-managed-runtime": noUnscopedManagedRuntime,
    "no-unscoped-web-handler": noUnscopedWebHandler,
    "no-error-tag-comparison": noErrorTagComparison,
    "no-host-api-in-service": noHostApiInService,
    "no-in-operator": noInOperator,
    "no-instanceof": noInstanceof,
    "no-json-parse-stringify": noJsonParseStringify,
    "no-layer-exports-in-service-files": noLayerExportsInServiceFiles,
    "no-manual-tag": noManualTag,
    "no-bare-effect-try-promise": noBareEffectTryPromise,
    "no-defecting-web-crypto-digest": noDefectingWebCryptoDigest,
    "no-native-array-methods": noNativeArrayMethods,
    "no-native-collections": noNativeCollections,
    "no-nested-wrapper-calls": noNestedWrapperCalls,
    "no-nullish-comparison": noNullishComparison,
    "no-nullable-boundary-leak": noNullableBoundaryLeak,
    "no-process-boundary-outside-config": noProcessBoundaryOutsideConfig,
    "no-result-exit-reencoding": noResultExitReencoding,
    "no-route-loader-mappers": noRouteLoaderMappers,
    "no-runtime-execution-outside-boundaries": noRuntimeExecutionOutsideBoundaries,
    "no-schema-decoder-outside-ingress": noSchemaDecoderOutsideIngress,
    "no-schema-encoder-outside-egress": noSchemaEncoderOutsideEgress,
    "no-unbranded-identifier-schema": noUnbrandedIdentifierSchema,
    "no-throwing-schema-sync-codec": noThrowingSchemaSyncCodec,
    "no-non-throwing-schema-sync-decoder-outside-consumer":
      noNonThrowingSchemaSyncDecoderOutsideConsumer,
    "no-unknown-service-contract": noUnknownServiceContract,
    "no-unknown-tagged-error-payload": noUnknownTaggedErrorPayload,
    "no-switch": noSwitch,
    "no-throw": noThrow,
    "no-typeof": noTypeof,
    "no-undefined-comparison": noUndefinedComparison,
  },
};
