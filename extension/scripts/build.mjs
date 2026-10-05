import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, "dist");
const srcRoot = join(root, "src");

function listTs(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listTs(p, acc);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

function transpile(tsPath) {
  const source = readFileSync(tsPath, "utf8");
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false,
    },
    fileName: tsPath,
    reportDiagnostics: true,
  });
  const errors = (diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    const msg = errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n");
    throw new Error(`Transpile failed for ${tsPath}:\n${msg}`);
  }
  return outputText;
}

function buildTarget(target, manifestName) {
  const dest = join(outRoot, target);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  for (const tsPath of listTs(srcRoot)) {
    const js = transpile(tsPath);
    const rel = relative(srcRoot, tsPath).replace(/\.ts$/i, ".js");
    const out = join(dest, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, js, "utf8");
  }

  mkdirSync(join(dest, "popup"), { recursive: true });
  mkdirSync(join(dest, "options"), { recursive: true });
  cpSync(join(srcRoot, "popup/popup.html"), join(dest, "popup/popup.html"));
  cpSync(join(srcRoot, "popup/popup.css"), join(dest, "popup/popup.css"));
  cpSync(join(srcRoot, "options/options.html"), join(dest, "options/options.html"));
  cpSync(join(srcRoot, "options/options.css"), join(dest, "options/options.css"));
  cpSync(join(root, "icons"), join(dest, "icons"), { recursive: true });
  cpSync(join(root, manifestName), join(dest, "manifest.json"));
  console.log(`Built ${target} → ${dest}`);
}

buildTarget("chromium", "manifest.chromium.json");
buildTarget("firefox", "manifest.firefox.json");
