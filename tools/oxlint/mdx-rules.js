const propertyName = (node) => {
  if (node?.type === "Identifier" || node?.type === "JSXIdentifier") {
    return node.name;
  }

  if (node?.type === "Literal") {
    return String(node.value);
  }

  return null;
};

const mdxComponentKeys = new Set([
  "a",
  "blockquote",
  "code",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const variableName = (node) => (node?.id?.type === "Identifier" ? node.id.name : null);

const objectHasMdxComponentKey = (node) =>
  node?.type === "ObjectExpression" &&
  node.properties?.some((property) => mdxComponentKeys.has(propertyName(property.key) ?? ""));

const jsxOpeningElementName = (node) => propertyName(node?.parent?.name);

const noRouteLocalMdxComponentRegistry = {
  create(context) {
    return {
      JSXAttribute(node) {
        if (
          propertyName(node.name) === "components" &&
          jsxOpeningElementName(node) === "MDX" &&
          node.value?.type === "JSXExpressionContainer" &&
          node.value.expression?.type === "ObjectExpression"
        ) {
          context.report({
            messageId: "noRouteLocalMdxComponentRegistry",
            node,
          });
        }
      },
      VariableDeclarator(node) {
        const name = variableName(node);

        if (
          name === "mdxComponents" ||
          (name === "components" && objectHasMdxComponentKey(node.init))
        ) {
          context.report({
            messageId: "noRouteLocalMdxComponentRegistry",
            node: node.id,
          });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Disallow route-local MDX component registries in favor of shared app or package registries.",
    },
    messages: {
      noRouteLocalMdxComponentRegistry:
        "Do not define route-local MDX component registries. Import a shared MDX component registry or package-owned MDX primitives instead of declaring mdxComponents, MDX-shaped components objects, or inline <MDX components={{ ... }} /> registries.",
    },
    type: "problem",
  },
};

export default {
  meta: {
    name: "mdx",
  },
  rules: {
    "no-route-local-mdx-component-registry": noRouteLocalMdxComponentRegistry,
  },
};
