import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./paths.mjs";

const EXCLUDE_DIRS = new Set([
  ".git",
  ".github",
  "node_modules",
  "dist",
  "scripts",
  "site",
  "テンプレート",
  "docs",
]);

export function discoverWorks() {
  const entries = fs.readdirSync(REPO_ROOT, { withFileTypes: true });
  const works = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith(".")) continue;
    if (EXCLUDE_DIRS.has(ent.name)) continue;
    const readme = path.join(REPO_ROOT, ent.name, "README.md");
    if (!fs.existsSync(readme)) continue;
    works.push(ent.name);
  }
  return works.sort((a, b) => a.localeCompare(b, "ja"));
}

export function parseCoverageTable(md) {
  const map = new Map();
  const rowRe = /^\|\s*\[([^\]]+)\]\([^)]+\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/gm;
  let m;
  while ((m = rowRe.exec(md)) !== null) {
    map.set(m[1].trim(), {
      state: m[2].trim(),
      coverage: m[3].trim(),
      notes: m[4].trim(),
    });
  }
  return map;
}

export function loadCoverage() {
  const p = path.join(REPO_ROOT, "docs", "ストーリー要約のカバレッジ.md");
  if (!fs.existsSync(p)) return new Map();
  return parseCoverageTable(fs.readFileSync(p, "utf8"));
}

export function parseWorkMeta(readmeMd, workName) {
  let kind = "漫画";
  if (/ドラマ/.test(readmeMd)) kind = "ドラマ";
  const kindMatch = readmeMd.match(/種別\s*\|\s*([^\n|]+)/);
  if (kindMatch) {
    const cell = kindMatch[1].trim();
    if (cell.includes("ドラマ")) kind = "ドラマ";
    else if (cell.includes("漫画")) kind = "漫画";
  }

  let progress = "未記録";
  if (/進捗（利用者）[\s\S]*?\*\*未記録\*\*/.test(readmeMd)) progress = "未記録";
  if (/視聴済み/.test(readmeMd)) {
    if (/未申告/.test(readmeMd)) progress = "S1視聴済み申告・S2未申告";
    else progress = "視聴済み申告あり";
  } else if (/未記録/.test(readmeMd) && !/視聴済み/.test(readmeMd)) {
    progress = "未記録";
  }

  const coverage = loadCoverage();
  const cov = coverage.get(workName) ?? null;

  const storyFiles = [];
  const storyDir = path.join(REPO_ROOT, workName, "story");
  if (fs.existsSync(storyDir)) {
    for (const f of fs.readdirSync(storyDir)) {
      if (f.endsWith(".md")) storyFiles.push(`story/${f}`);
    }
  }

  return { kind, progress, cov, storyFiles };
}

export function collectMarkdownUnderWork(workName) {
  const root = path.join(REPO_ROOT, workName);
  const files = [];
  function walk(dir, rel) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = path.posix.join(rel, ent.name);
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full, relPath);
      else if (ent.name.endsWith(".md")) files.push(relPath);
    }
  }
  walk(root, workName);
  return files.sort();
}
