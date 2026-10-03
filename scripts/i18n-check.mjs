// i18n consistency checks. Run: node scripts/i18n-check.mjs [--sweep]
// - Parity: every key in `es` must exist in `en` and vice versa (per app).
// - Sweep (advisory): lists suspicious hardcoded UI literals in tsx files.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPS = ["apps/web", "apps/docs"];

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object") flatten(v, path, out);
    else out[path] = v;
  }
  return out;
}

let failed = false;
for (const app of APPS) {
  for (const locale of ["es", "en"]) {
    try {
      readFileSync(join(ROOT, app, "messages", `${locale}.json`), "utf8");
    } catch {
      console.error(`[${app}] missing messages/${locale}.json`);
      failed = true;
    }
  }
  const es = flatten(JSON.parse(readFileSync(join(ROOT, app, "messages/es.json"), "utf8")));
  const en = flatten(JSON.parse(readFileSync(join(ROOT, app, "messages/en.json"), "utf8")));
  const esKeys = new Set(Object.keys(es));
  const enKeys = new Set(Object.keys(en));
  for (const k of esKeys) {
    if (!enKeys.has(k)) {
      console.error(`[${app}] missing in en: ${k}`);
      failed = true;
    }
  }
  for (const k of enKeys) {
    if (!esKeys.has(k)) {
      console.error(`[${app}] missing in es: ${k}`);
      failed = true;
    }
  }
  // ICU placeholders must match between locales ({name} vs {nombre} breaks calls).
  for (const k of esKeys) {
    if (!enKeys.has(k)) continue;
    const vars = (s) => new Set([...String(s).matchAll(/\{(\w+)(,[^}]*)?\}/g)].map((m) => m[1]));
    const a = vars(es[k]);
    const b = vars(en[k]);
    const same = a.size === b.size && [...a].every((v) => b.has(v));
    if (!same) {
      console.error(`[${app}] placeholder mismatch at ${k}: es={${[...a]}} en={${[...b]}}`);
      failed = true;
    }
  }
  // Rich-text tags must match too (<b>...</b>).
  for (const k of esKeys) {
    if (!enKeys.has(k)) continue;
    const tags = (s) => new Set([...String(s).matchAll(/<(\w+)>/g)].map((m) => m[1]));
    const a = tags(es[k]);
    const b = tags(en[k]);
    const same = a.size === b.size && [...a].every((v) => b.has(v));
    if (!same) {
      console.error(`[${app}] rich-text tag mismatch at ${k}: es=<${[...a]}> en=<${[...b]}>`);
      failed = true;
    }
  }
  console.log(`[${app}] parity: ${esKeys.size} keys each, ${failed ? "FAILURES" : "ok"}`);
}

if (process.argv.includes("--sweep")) {
  const SKIP_DIRS = new Set(["node_modules", ".next", "_generated", "__tests__"]);
  const candidates = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (SKIP_DIRS.has(entry)) continue;
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith(".tsx")) continue;
      const src = readFileSync(full, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // Skip comments, imports, classNames, URLs, code identifiers.
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("import ") ||
          trimmed.startsWith("} from") ||
          line.includes("className") ||
          line.includes("http") ||
          line.includes("aria-hidden") ||
          trimmed.startsWith("aria-")
        ) {
          return;
        }
        // JSX text nodes and user-facing props carrying sentence-like literals.
        const m =
          line.match(/>([^<>{}]*[A-Za-zÀ-ÿ][^<>{}]{2,})</) ||
          line.match(/(placeholder|aria-label|title)=["']([^"']*[A-Za-zÀ-ÿ][^"']*)["']/) ||
          line.match(/[`"']([A-ZÀ-Þ][^`"'${}]{4,}?)[`"']/) ||
          line.match(/t\(["']([^"']+)["']\)/);
        if (m) candidates.push(`${relative(ROOT, full)}:${i + 1}: ${(m[1] ?? m[0]).trim().slice(0, 90)}`);
      });
    }
  }
  for (const app of APPS) walk(join(ROOT, app));
  console.log(`--- sweep candidates (${candidates.length}) ---`);
  for (const c of candidates) console.log(c);
}

if (failed) process.exit(1);
console.log("i18n-check: parity ok");
