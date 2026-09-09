const contextFieldNames = new Set(["description", "image", "title"]);

const contextFieldName = (node) => {
  if (node?.type !== "MemberExpression") {
    return null;
  }

  if (node.property?.type === "Identifier") {
    return node.property.name;
  }

  if (node.property?.type === "Literal") {
    return String(node.property.value);
  }

  return null;
};

const noContextNullishDefault = {
  create(context) {
    return {
      LogicalExpression(node) {
        if (node.operator === "??" && contextFieldNames.has(contextFieldName(node.left))) {
          context.report({
            messageId: "noContextNullishDefault",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow contextName or context-key defaults in Effect-owned site code.",
    },
    messages: {
      noContextNullishDefault:
        'Do not invent missing SEO/content metadata with ??. Metadata must come from canonical schemas. Missing values must stay Option.none or fail with a tagged service error. Only use defaults declared by the owning Schema, never payload.description ?? "fallback".',
    },
    type: "problem",
  },
};

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

const typographyUtilityNames = new Set([
  "font-bold",
  "font-medium",
  "font-mono",
  "font-normal",
  "font-sans",
  "font-semibold",
  "leading-none",
  "leading-normal",
  "leading-relaxed",
  "leading-snug",
  "leading-tight",
  "text-2xl",
  "text-3xl",
  "text-4xl",
  "text-base",
  "text-lg",
  "text-md",
  "text-sm",
  "text-xl",
  "text-xs",
  "tracking-display",
  "tracking-loose",
  "tracking-tight",
]);

const classAttributeNames = new Set(["class", "className"]);
const classBuilderCalleeNames = new Set(["cn", "clsx", "cva", "twMerge"]);
const routeTypographyAllowlistPattern =
  /(?<ultraciteCapture1>^|[/\\])apps[/\\]web[/\\]src[/\\]lib[/\\]design-system[/\\]sections[/\\]foundations\.tsx$/u;
const componentTypographyAllowlistPattern =
  /(?<ultraciteCapture1>^|[/\\])packages[/\\]ui[/\\]src[/\\]components[/\\]typography\.tsx$/u;

const isClassAttribute = (node) =>
  node?.type === "JSXAttribute" && classAttributeNames.has(propertyName(node.name));

const isClassBuilderCallee = (callee) =>
  callee?.type === "Identifier" && classBuilderCalleeNames.has(callee.name);

const isInsideClassBuilderCall = (node) => {
  let parent = node?.parent;

  while (parent) {
    if (isClassAttribute(parent)) {
      return true;
    }

    if (parent.type === "CallExpression" && isClassBuilderCallee(parent.callee)) {
      return true;
    }

    ({ parent } = parent);
  }

  return false;
};

const lastTopLevelColonIndex = (value) => {
  let squareDepth = 0;
  let parenDepth = 0;
  let lastIndex = -1;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "[") {
      squareDepth += 1;
    } else if (character === "]" && squareDepth > 0) {
      squareDepth -= 1;
    } else if (character === "(") {
      parenDepth += 1;
    } else if (character === ")" && parenDepth > 0) {
      parenDepth -= 1;
    } else if (character === ":" && squareDepth === 0 && parenDepth === 0) {
      lastIndex = index;
    }
  }

  return lastIndex;
};

const normalizedClassUtility = (className) => {
  const colonIndex = lastTopLevelColonIndex(className);
  const utility = colonIndex === -1 ? className : className.slice(colonIndex + 1);

  return utility.replace(/^!/u, "").replace(/!$/u, "").replace(/\/.*$/u, "");
};

const isRawTypographyUtility = (className) =>
  typographyUtilityNames.has(normalizedClassUtility(className));

const classStringHasRawTypographyUtility = (source) =>
  source.split(/\s+/u).some(isRawTypographyUtility);

const sourceFromStringNode = (node) => {
  if (node?.type === "Literal" && String(node.value) === node.value) {
    return node.value;
  }

  if (node?.type === "TemplateElement") {
    return node.value?.cooked ?? node.value?.raw ?? "";
  }

  return "";
};

const createNoLocalTypographyUtilitiesRule = ({
  allowlistPattern,
  description,
  message,
  messageId,
}) => ({
  create(context) {
    if (allowlistPattern.test(sourceFileName(context))) {
      return {};
    }

    const reportIfNeeded = (node) => {
      const source = sourceFromStringNode(node);

      if (source && isInsideClassBuilderCall(node) && classStringHasRawTypographyUtility(source)) {
        context.report({
          messageId,
          node,
        });
      }
    };

    return {
      Literal: reportIfNeeded,
      TemplateElement: reportIfNeeded,
    };
  },
  meta: {
    docs: {
      description,
    },
    messages: {
      [messageId]: message,
    },
    type: "problem",
  },
});

const noRouteLocalTypographyUtilities = createNoLocalTypographyUtilitiesRule({
  allowlistPattern: routeTypographyAllowlistPattern,
  description:
    "Disallow route/app component typography utility piles where typography primitives should be used.",
  message:
    "Do not compose route or app component typography with raw text size, leading, tracking, font-family, or font-weight utilities. Use @packages/ui Heading, Text, CodeText, semantic role classes for native/link elements, or WEB_OG_TYPOGRAPHY for OG output.",
  messageId: "noRouteLocalTypographyUtilities",
});

const noComponentLocalTypographyUtilities = createNoLocalTypographyUtilitiesRule({
  allowlistPattern: componentTypographyAllowlistPattern,
  description:
    "Disallow package component typography utility piles where role-backed typography should be used.",
  message:
    "Do not define package component typography with raw text size, leading, tracking, font-family, or font-weight utilities. Use Heading, Text, CodeText, semantic role classes, or package compact helpers such as type-label-compact and type-body-compact.",
  messageId: "noComponentLocalTypographyUtilities",
});

const typeLineHeightDeclarationPattern =
  /--text-[a-z0-9-]+--line-height\s*:\s*(?<ultraciteCapture1>[^;"'`\n}]+)/giu;
const unsafeLineHeightCalcPattern = /^calc\([^)]*\/[^)]*\)$/u;

const stringHasUnsafeTypeTokenLineHeight = (source) => {
  typeLineHeightDeclarationPattern.lastIndex = 0;

  let declaration = typeLineHeightDeclarationPattern.exec(source);

  while (declaration) {
    const value = declaration[1].trim();
    const numericValue = Number(value);

    if (
      unsafeLineHeightCalcPattern.test(value) ||
      (Number.isFinite(numericValue) && numericValue < 1)
    ) {
      return true;
    }

    declaration = typeLineHeightDeclarationPattern.exec(source);
  }

  return false;
};

const noUnsafeTypeTokenLineHeight = {
  create(context) {
    const reportIfNeeded = (node) => {
      if (stringHasUnsafeTypeTokenLineHeight(sourceFromStringNode(node))) {
        context.report({
          messageId: "noUnsafeTypeTokenLineHeight",
          node,
        });
      }
    };

    return {
      Literal: reportIfNeeded,
      TemplateElement: reportIfNeeded,
    };
  },
  meta: {
    docs: {
      description:
        "Disallow unsafe text token line-height declarations in JavaScript or TypeScript strings.",
    },
    messages: {
      noUnsafeTypeTokenLineHeight:
        "Do not define --text-*--line-height with a calc division or a ratio below 1. Use canonical --leading-tight, --leading-snug, or --leading-normal role-backed values instead.",
    },
    type: "problem",
  },
};

const isSpaceAxisUtility = (className) => /^space-[xy]-/u.test(normalizedClassUtility(className));

const classStringHasSpaceAxisUtility = (source) => source.split(/\s+/u).some(isSpaceAxisUtility);

const noSpaceAxisUtilities = {
  create(context) {
    const reportIfNeeded = (node) => {
      const source = sourceFromStringNode(node);

      if (source && isInsideClassBuilderCall(node) && classStringHasSpaceAxisUtility(source)) {
        context.report({
          messageId: "noSpaceAxisUtilities",
          node,
        });
      }
    };

    return {
      Literal: reportIfNeeded,
      TemplateElement: reportIfNeeded,
    };
  },
  meta: {
    docs: {
      description:
        "Disallow Tailwind space-x and space-y layout utilities in route and component code.",
    },
    messages: {
      noSpaceAxisUtilities:
        "Do not use space-x-* or space-y-* utilities. Compose layout with explicit flex/grid gap utilities so children, wrapping, and skeleton states do not depend on sibling margin injection.",
    },
    type: "problem",
  },
};

const routePathPattern =
  /(?<ultraciteCapture1>^|[/\\])apps[/\\]web[/\\]src[/\\]routes[/\\].+\.(?<ultraciteCapture2>ts|tsx)$/u;
const routePageWrapperIdentifierPattern = /^[A-Z][A-Za-z]*Page$/u;

const isRouteComponentProperty = (node) =>
  node?.type === "Property" && propertyName(node.key) === "component";

const noDesignPageWrapper = {
  create(context) {
    if (!routePathPattern.test(sourceFileName(context))) {
      return {};
    }

    return {
      Property(node) {
        if (
          isRouteComponentProperty(node) &&
          node.value?.type === "Identifier" &&
          routePageWrapperIdentifierPattern.test(node.value.name)
        ) {
          context.report({
            messageId: "noDesignPageWrapper",
            node: node.value,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow /design route delegation to page-sized Design*Page wrappers.",
    },
    messages: {
      noDesignPageWrapper:
        "Do not delegate route composition to *Page route component wrappers. Use route-owned *Route component values and compose PageShell, PageHeader, PageSection, catalogues, leaves, and section components directly in the route file.",
    },
    type: "problem",
  },
};

const isWebHttpGlobalName = (name) =>
  name === "Headers" || name === "Request" || name === "Response";

const noWebHttpGlobalsInSeoAeo = {
  create(context) {
    return {
      Identifier(node) {
        if (isWebHttpGlobalName(node.name)) {
          context.report({
            messageId: "noWebHttpGlobalsInSeoAeo",
            node,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow Web HTTP globals in Effect-owned SEO/AEO domain modules.",
    },
    messages: {
      noWebHttpGlobalsInSeoAeo:
        "Do not use Web Request, Response, or Headers in SEO/AEO domain modules. Return Effect HTTP HttpServerResponse values and keep Web adaptation in apps/web/src/lib/http or TanStack route files.",
    },
    type: "problem",
  },
};

const noRouteLocalSeo = {
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee?.type === "Identifier" && node.callee.name === "seo") {
          context.report({
            messageId: "noRouteLocalSeo",
            node: node.callee,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow route-local SEO field objects in TanStack route files.",
    },
    messages: {
      noRouteLocalSeo:
        "Do not build route metadata with route-local seo({...}) objects. Use the generated routeSeo({ page: RouteSeoPage.static(...) }) or RouteSeoPage.post(...) pipeline so schemas own canonical URL, keywords, images, and JSON-LD.",
    },
    type: "problem",
  },
};

const routeLocalMarkdownNegotiationImports = new Set(["$/lib/seo-aeo/markdown-negotiation"]);

const noRouteLocalMarkdownNegotiation = {
  create(context) {
    return {
      ImportDeclaration(node) {
        if (routeLocalMarkdownNegotiationImports.has(node.source?.value)) {
          context.report({
            messageId: "noRouteLocalMarkdownNegotiation",
            node: node.source,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow route-local markdown negotiation plumbing in TanStack route files.",
    },
    messages: {
      noRouteLocalMarkdownNegotiation:
        "Do not install markdown negotiation in route-local server handlers. AEO content negotiation is owned by src/start.ts request middleware and the Effect runtime bridge.",
    },
    type: "problem",
  },
};

const tanstackServerFunctionImports = new Set(["createServerFn", "createServerOnlyFn"]);

const allowedTanstackServerFunctionFence =
  "apps/web/src/lib/http/markdown-sibling-redirect.middleware.ts";

const normalizeFilename = (filename) => filename.replaceAll("\\", "/");

const relativeImportSpecifier = /^(?<ultraciteCapture1>\.\.?\/)\S+/u;

const workspaceOwner = (filename) => {
  const parts = normalizeFilename(filename).split("/");

  for (let index = 0; index < parts.length - 1; index += 1) {
    const workspaceKind = parts[index];

    if (workspaceKind === "apps" || workspaceKind === "packages") {
      return `${workspaceKind}/${parts[index + 1]}`;
    }
  }

  return null;
};

const resolveRelativeImport = (filename, specifier) => {
  const parts = normalizeFilename(filename).split("/");
  parts.pop();

  for (const part of specifier.split("/")) {
    if (part === ".") {
      continue;
    }

    if (part === "..") {
      parts.pop();
      continue;
    }

    parts.push(part);
  }

  return parts.join("/");
};

const noRelativeWorkspaceImports = {
  create(context) {
    const filename = normalizeFilename(context.getFilename?.() ?? "");
    const sourceOwner = workspaceOwner(filename);

    const checkSource = (source, node) => {
      const specifier = source?.value;

      if (String(specifier) !== specifier || !relativeImportSpecifier.test(specifier)) {
        return;
      }

      const targetOwner = workspaceOwner(resolveRelativeImport(filename, specifier));

      if (targetOwner === null || targetOwner === sourceOwner) {
        return;
      }

      context.report({
        messageId: "noRelativeWorkspaceImports",
        node: source ?? node,
      });
    };

    return {
      ExportAllDeclaration(node) {
        checkSource(node.source, node);
      },
      ExportNamedDeclaration(node) {
        checkSource(node.source, node);
      },
      ImportDeclaration(node) {
        checkSource(node.source, node);
      },
      ImportExpression(node) {
        checkSource(node.source, node);
      },
    };
  },
  meta: {
    docs: {
      description:
        "Disallow relative imports that resolve into a different app or package workspace.",
    },
    messages: {
      noRelativeWorkspaceImports:
        "Import another app or package through an explicit workspace export. Do not bypass its public contract with a relative filesystem path.",
    },
    type: "problem",
  },
};

const importedSpecifierName = (specifier) => {
  if (specifier.type !== "ImportSpecifier") {
    return null;
  }

  const { imported } = specifier;

  if (imported.type === "Identifier") {
    return imported.name;
  }

  if (imported.type === "Literal") {
    return String(imported.value);
  }

  return null;
};

const noUnscopedTanstackServerFunctions = {
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "@tanstack/react-start") {
          return;
        }

        const filename = normalizeFilename(context.getFilename?.() ?? "");
        const isAllowedFence = filename.endsWith(allowedTanstackServerFunctionFence);

        for (const specifier of node.specifiers ?? []) {
          const importedName = importedSpecifierName(specifier);

          if (!tanstackServerFunctionImports.has(importedName)) {
            continue;
          }

          if (isAllowedFence && importedName === "createServerOnlyFn") {
            continue;
          }

          context.report({
            messageId: "noUnscopedTanstackServerFunctions",
            node: specifier,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Disallow broad TanStack server function imports outside the documented Markdown middleware import fence.",
    },
    messages: {
      noUnscopedTanstackServerFunctions:
        "Do not import TanStack createServerFn/createServerOnlyFn outside the documented Markdown middleware fence. Use the app runtime/RPC boundary or isolate the server-only import in the approved middleware fence with a .server.ts implementation.",
    },
    type: "problem",
  },
};

const noManualJsonLdScript = {
  create(context) {
    return {
      Property(node) {
        const { key, value } = node;
        const isTypeKey =
          (key.type === "Identifier" && key.name === "type") ||
          (key.type === "Literal" && key.value === "type");
        const isJsonLdValue = value.type === "Literal" && value.value === "application/ld+json";

        if (isTypeKey && isJsonLdValue) {
          context.report({
            messageId: "noManualJsonLdScript",
            node: value,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow manually authored JSON-LD script descriptors in route files.",
    },
    messages: {
      noManualJsonLdScript:
        "Do not hand-author application/ld+json scripts in route files. Add the schema-owned JSON-LD node to @packages/seo and let routeSeo(...) emit the encoded script.",
    },
    type: "problem",
  },
};

const moduleOwnedPublicAssetPath = /^\/(?<ultraciteCapture1>images|patterns)\//u;

const noModuleOwnedPublicAssetUrl = {
  create(context) {
    return {
      JSXAttribute(node) {
        if (
          propertyName(node.name) !== "src" ||
          node.value?.type !== "Literal" ||
          String(node.value.value) !== node.value.value ||
          !moduleOwnedPublicAssetPath.test(node.value.value)
        ) {
          return;
        }

        context.report({
          messageId: "noModuleOwnedPublicAssetUrl",
          node: node.value,
        });
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow JSX URLs that bypass the Vite module graph for module-owned assets.",
    },
    messages: {
      noModuleOwnedPublicAssetUrl:
        "Import module-owned image and pattern assets from $/assets with a Vite query. Stable public PWA, CSS-token, and OG boundary URLs remain explicit public contracts.",
    },
    type: "problem",
  },
};

export default {
  meta: {
    name: "site",
  },
  rules: {
    "no-context-nullish-default": noContextNullishDefault,
    "no-design-page-wrapper": noDesignPageWrapper,
    "no-route-local-typography-utilities": noRouteLocalTypographyUtilities,
    "no-space-axis-utilities": noSpaceAxisUtilities,
    "no-route-local-seo": noRouteLocalSeo,
    "no-route-local-markdown-negotiation": noRouteLocalMarkdownNegotiation,
    "no-relative-workspace-imports": noRelativeWorkspaceImports,
    "no-unscoped-tanstack-server-functions": noUnscopedTanstackServerFunctions,
    "no-manual-json-ld-script": noManualJsonLdScript,
    "no-module-owned-public-asset-url": noModuleOwnedPublicAssetUrl,
    "no-component-local-typography-utilities": noComponentLocalTypographyUtilities,
    "no-unsafe-type-token-line-height": noUnsafeTypeTokenLineHeight,
    "no-web-http-globals-in-seo-aeo": noWebHttpGlobalsInSeoAeo,
  },
};
