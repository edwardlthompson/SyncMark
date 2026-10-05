/** Minimal TS → ESM stripper for SyncMark extension builds (no bundler dependency). */

export function transformSync(source, filePath = "") {
  let code = source;
  // Remove triple-slash refs
  code = code.replace(/^\s*\/\/\/\s*<reference[^>]*>\s*$/gm, "");
  // Remove `import type` / `export type` lines
  code = code.replace(/^\s*import\s+type\s+[\s\S]*?;\s*$/gm, "");
  code = code.replace(/^\s*export\s+type\s+[\s\S]*?;\s*$/gm, "");
  // Remove `type` from import braces: import { type X, Y } → import { Y }
  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*(["'][^"']+["'])/g,
    (_m, names, from) => {
      const cleaned = names
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p && !p.startsWith("type "))
        .map((p) => p.replace(/^type\s+/, ""))
        .filter(Boolean);
      if (!cleaned.length) return "";
      return `import { ${cleaned.join(", ")} } from ${from}`;
    },
  );
  // Strip `satisfies` clauses
  code = code.replace(/\s+satisfies\s+[A-Za-z0-9_<>[\]|&.,\s]+/g, "");
  // Remove simple type annotations on locals/params/returns (heuristic)
  code = code.replace(/(\(|,)\s*([A-Za-z_][\w]*)\s*:\s*[^,)=]+/g, "$1$2");
  code = code.replace(/\)\s*:\s*[^{;=]+(\s*\{|\s*=>)/g, ")$1");
  code = code.replace(
    /\b(const|let|var)\s+([A-Za-z_][\w]*)\s*:\s*[^=;\n]+(\s*=)/g,
    "$1 $2$3",
  );
  // Remove interface / type alias blocks
  code = code.replace(/^\s*export\s+interface\s+[\s\S]*?^\}/gm, "");
  code = code.replace(/^\s*interface\s+[\s\S]*?^\}/gm, "");
  code = code.replace(/^\s*export\s+type\s+[^=]+=\s*[\s\S]*?;\s*$/gm, "");
  code = code.replace(/^\s*type\s+[^=]+=\s*[\s\S]*?;\s*$/gm, "");
  // as casts
  code = code.replace(/\s+as\s+const\b/g, "");
  code = code.replace(/\s+as\s+[A-Za-z0-9_<>[\]|&.,\s?]+/g, "");
  // non-null !
  code = code.replace(/([\]\)\w])\!\./g, "$1.");
  code = code.replace(/([\]\)\w])\!;/g, "$1;");
  // generics on functions rarely appear; keep .js import paths
  if (filePath.includes("types.ts")) {
    // types-only module: export empty
    return "export {};\n";
  }
  return code + (code.endsWith("\n") ? "" : "\n");
}
