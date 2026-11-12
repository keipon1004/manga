import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export function normalizeBase(basePath) {
  const raw = basePath ?? process.env.BASE_PATH ?? "/manga/";
  let b = raw.trim();
  if (!b.startsWith("/")) b = `/${b}`;
  if (!b.endsWith("/")) b = `${b}/`;
  return b;
}

/** Encode each path segment for safe URLs (Japanese paths). */
export function encodeWebSegments(...segments) {
  return segments
    .flatMap((s) => String(s).split("/"))
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

export function url(base, ...segments) {
  const encoded = encodeWebSegments(...segments);
  return encoded ? `${base}${encoded}` : base;
}

function mdRelToWebPath(mdRel) {
  let p = mdRel.replace(/\\/g, "/");
  if (p.endsWith("/README.md")) {
    p = p.replace(/README\.md$/, "index.html");
  } else if (p.endsWith(".md")) {
    p = p.replace(/\.md$/, ".html");
  }
  return p;
}

export function resolveMdHref(fromMdRel, href) {
  if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) {
    return href;
  }
  const clean = href.split("#")[0];
  const fromDir = path.dirname(fromMdRel);
  const resolved = path.normalize(path.join(fromDir, clean)).replace(/\\/g, "/");
  return mdRelToWebPath(resolved);
}

export function mdHrefToWeb(href, base, fromMdRel = null) {
  if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) {
    return href;
  }
  const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "";
  const webPath = fromMdRel ? resolveMdHref(fromMdRel, href) : mdRelToWebPath(href.replace(/^(\.\.\/)+/, ""));
  const parts = webPath.split("/").filter(Boolean);
  return url(base, ...parts) + hash;
}

/** Dist filesystem path (unicode folders, unencoded on disk). */
export function distRelFromMd(mdRel) {
  return mdRelToWebPath(mdRel);
}
