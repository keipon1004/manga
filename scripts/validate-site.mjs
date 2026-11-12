import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./lib/paths.mjs";

const DIST = path.join(REPO_ROOT, "dist");
const SKIP_PREFIXES = ["http://", "https://", "mailto:", "#", "//"];

function collectHtmlFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...collectHtmlFiles(full));
    else if (ent.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function resolveHref(file, href, base) {
  let targetPath;
  const clean = href.split("#")[0];
  if (!clean) return null;

  if (clean.startsWith(base)) {
    targetPath = path.join(DIST, decodeURIComponent(clean.slice(base.length)));
  } else if (clean.startsWith("/")) {
    const withoutBase = clean.startsWith(base.slice(0, -1))
      ? clean.slice(base.length - 1)
      : clean;
    const rel = withoutBase.replace(/^\//, "");
    targetPath = path.join(DIST, decodeURIComponent(rel));
  } else {
    targetPath = path.resolve(path.dirname(file), clean);
  }

  if (targetPath.endsWith("/")) targetPath = path.join(targetPath, "index.html");
  return targetPath;
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error("dist/ not found. Run npm run build first.");
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(path.join(DIST, "site-meta.json"), "utf8"));
  const base = meta.basePath || "/manga/";
  const errors = [];
  const hrefRe = /href="([^"]+)"/g;

  for (const file of collectHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, "utf8");
    hrefRe.lastIndex = 0;
    let m;
    while ((m = hrefRe.exec(html)) !== null) {
      const href = m[1];
      if (SKIP_PREFIXES.some((p) => href.startsWith(p))) continue;
      const targetPath = resolveHref(file, href, base);
      if (targetPath && !fs.existsSync(targetPath)) {
        errors.push(`${path.relative(DIST, file)}: missing ${href}`);
      }
    }
  }

  const required = ["index.html", "works/index.html", "coverage.html", "VIVANT/story/index.html", "VIVANT/story/シーズン2.html"];
  for (const rel of required) {
    if (!fs.existsSync(path.join(DIST, rel))) {
      errors.push(`missing required page: ${rel}`);
    }
  }

  const home = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  if (!/ネタバレ|spoiler-banner/.test(fs.readFileSync(path.join(DIST, "VIVANT/story/index.html"), "utf8"))) {
    errors.push("VIVANT S1 story missing spoiler content");
  }
  if (!home.includes("spoiler-banner") && !fs.readFileSync(path.join(DIST, "はじめの一歩/story/index.html"), "utf8").includes("spoiler-banner")) {
    const sample = fs.readFileSync(path.join(DIST, "はじめの一歩/story/index.html"), "utf8");
    if (!sample.includes("spoiler-banner")) errors.push("sample story missing spoiler banner");
  }

  if (errors.length) {
    console.error("Validation failed:\n" + errors.join("\n"));
    process.exit(1);
  }
  console.log(`Validated dist/ (${meta.works?.length ?? "?"} works), internal links OK.`);
}

main();
