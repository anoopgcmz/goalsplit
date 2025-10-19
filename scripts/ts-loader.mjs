import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const tsExtensions = new Set([".ts", ".tsx"]);
const aliasPrefix = "@/";
const projectRoot = process.cwd();

const candidateSuffixes = [
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.mjs",
  "/index.cjs",
];

const fileExists = async (candidatePath) => {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
};

const resolveAlias = async (specifier) => {
  if (!specifier.startsWith(aliasPrefix)) {
    return null;
  }

  const relativePath = specifier.slice(aliasPrefix.length);
  const basePath = path.resolve(projectRoot, "src", relativePath);

  if (await fileExists(basePath)) {
    return pathToFileURL(basePath).href;
  }

  for (const suffix of candidateSuffixes) {
    const candidate = `${basePath}${suffix}`;
    if (await fileExists(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  return null;
};

export async function resolve(specifier, context, defaultResolve) {
  const aliasResolution = await resolveAlias(specifier);
  if (aliasResolution) {
    return {
      url: aliasResolution,
      shortCircuit: true,
    };
  }

  return defaultResolve(specifier, context, defaultResolve);
}

const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  sourceMap: false,
};

export async function load(url, context, defaultLoad) {
  const ext = path.extname(url);
  if (tsExtensions.has(ext)) {
    const filepath = fileURLToPath(url);
    const source = await fs.readFile(filepath, "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions,
      fileName: filepath,
      reportDiagnostics: false,
    });

    return {
      format: "module",
      shortCircuit: true,
      source: outputText,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
