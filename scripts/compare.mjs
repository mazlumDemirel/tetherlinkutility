// Builds the site with Eleventy and compares every file in _site against the
// files served today (the `main` branch, or a directory passed as the first argument).
//
//   npm run compare               compare against the main branch
//   npm run compare -- ../website compare against a directory
//   npm run compare -- --no-build skip the Eleventy build
//
// Categories: identical, whitespace-only differences, real differences (with a diff),
// missing (in the reference but not in _site) and extra (in _site but not in the reference).
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const noBuild = args.includes("--no-build");
const refArg = args.find((a) => !a.startsWith("--"));

// Files in the repository that GitHub Pages does not serve (dotfiles).
const IGNORE = (rel) => rel.split("/").some((p) => p.startsWith("."));

if (!noBuild) {
  fs.rmSync(path.join(root, "_site"), { recursive: true, force: true });
  execSync("npx @11ty/eleventy --quiet", { cwd: root, stdio: "inherit" });
}

let refDir;
if (refArg) {
  refDir = path.resolve(refArg);
} else {
  refDir = path.join(root, ".compare", "main");
  fs.rmSync(refDir, { recursive: true, force: true });
  fs.mkdirSync(refDir, { recursive: true });
  execSync(`git archive main | tar -x -C "${refDir}"`, { cwd: root, shell: "/bin/sh" });
}

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    if (IGNORE(rel)) continue;
    if (e.isDirectory()) walk(full, base, out);
    else out.push(rel);
  }
  return out.sort();
}

const siteDir = path.join(root, "_site");
const ref = new Set(walk(refDir));
const site = new Set(walk(siteDir));
const norm = (s) => s.replace(/\s+/g, " ").trim();

const identical = [], wsOnly = [], real = [], missing = [], extra = [];
for (const rel of ref) {
  if (!site.has(rel)) { missing.push(rel); continue; }
  const a = fs.readFileSync(path.join(refDir, rel));
  const b = fs.readFileSync(path.join(siteDir, rel));
  if (a.equals(b)) identical.push(rel);
  else if (norm(a.toString("utf8")) === norm(b.toString("utf8"))) wsOnly.push(rel);
  else real.push(rel);
}
for (const rel of site) if (!ref.has(rel)) extra.push(rel);

const list = (title, arr) => {
  console.log(`\n## ${title}: ${arr.length}`);
  for (const f of arr) console.log(`  ${f}`);
};
list("Identical", identical);
list("Whitespace-only differences", wsOnly);
list("Real differences", real);
for (const rel of real) {
  console.log(`\n--- diff ${rel}`);
  try {
    execSync(`diff -u "${path.join(refDir, rel)}" "${path.join(siteDir, rel)}" | head -60`, { stdio: "inherit", shell: "/bin/sh" });
  } catch {}
}
list("Missing from _site", missing);
list("Extra in _site", extra);
console.log(
  `\nSummary: ${identical.length} identical, ${wsOnly.length} whitespace-only, ${real.length} real differences, ${missing.length} missing, ${extra.length} extra`
);
process.exitCode = real.length || missing.length ? 1 : 0;
