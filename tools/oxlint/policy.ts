export const forbiddenRuntimePattern = /Effect\.run(?:Promise|Sync)\b/;
export const genericClientPattern = /readonly\s+(?:use|withClient)\s*[:(]/;
export const rawSemanticIdPattern = /\b(?:id|identifier)\s*:\s*string\b/i;
export const primitiveSemanticConfigPattern = /Config\.(?:string|nonEmptyString|redacted)\s*\(/;
export const runtimeClassPolicyPattern = /\binstanceof\b/;
export const uncheckedClientOutputPattern = /Effect\.Effect<\s*A(?:\s*,|>)/;

type ImportSource = { readonly value?: unknown };
type ImportNode = { readonly source?: ImportSource };
type WorkspaceImportRuleContext = {
  readonly filename?: string;
  readonly getFilename?: () => string;
  readonly report: (problem: {
    readonly messageId: "noRelativeWorkspaceImports";
    readonly node: ImportNode | ImportSource;
  }) => void;
};

const relativeImportSpecifier = /^(?:\.\/|\.\.\/)\S+/;

const normalizeFilename = (filename: string) => filename.replaceAll("\\", "/");

const workspaceOwner = (filename: string) => {
  const parts = normalizeFilename(filename).split("/");
  let owner: string | null = null;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const workspaceKind = parts[index];

    if (workspaceKind === "apps" || workspaceKind === "packages") {
      owner = `${workspaceKind}/${parts[index + 1]}`;
    }
  }

  return owner;
};

const resolveRelativeImport = (filename: string, specifier: string) => {
  const parts = normalizeFilename(filename).split("/");
  parts.pop();

  for (const part of specifier.split("/")) {
    if (part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return parts.join("/");
};

export const isRelativeWorkspaceImport = (filename: string, specifier: string) => {
  if (!relativeImportSpecifier.test(specifier)) return false;
  const sourceOwner = workspaceOwner(filename);
  const targetOwner = workspaceOwner(resolveRelativeImport(filename, specifier));
  return targetOwner !== null && targetOwner !== sourceOwner;
};

export const noRelativeWorkspaceImportsRule = {
  create(context: WorkspaceImportRuleContext) {
    const filename = normalizeFilename(context.filename ?? context.getFilename?.() ?? "");
    const checkSource = (source: ImportSource | undefined, node: ImportNode) => {
      const specifier = source?.value;
      if (String(specifier) !== specifier || !isRelativeWorkspaceImport(filename, specifier)) {
        return;
      }
      context.report({
        messageId: "noRelativeWorkspaceImports",
        node: source ?? node,
      });
    };

    return {
      ExportAllDeclaration(node: ImportNode) {
        checkSource(node.source, node);
      },
      ExportNamedDeclaration(node: ImportNode) {
        checkSource(node.source, node);
      },
      ImportDeclaration(node: ImportNode) {
        checkSource(node.source, node);
      },
      ImportExpression(node: ImportNode) {
        checkSource(node.source, node);
      },
    };
  },
  meta: {
    docs: {
      description: "Disallow relative imports that resolve into another app or package workspace.",
    },
    messages: {
      noRelativeWorkspaceImports:
        "Import another app or package through an explicit workspace export. Do not bypass its public contract with a relative filesystem path.",
    },
    type: "problem",
  },
};

export const sourceConditionFirst = (value: Record<string, unknown>, condition: string) => {
  const keys = Object.keys(value);
  return keys[0] === condition && keys.includes("types") && keys.includes("default");
};

export default {
  meta: { name: "repository" },
  rules: {
    "no-relative-workspace-imports": noRelativeWorkspaceImportsRule,
  },
};
