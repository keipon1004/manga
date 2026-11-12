import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import {
  REPO_ROOT,
  normalizeBase,
  url,
  mdHrefToWeb,
  distRelFromMd,
} from "./lib/paths.mjs";
import {
  discoverWorks,
  loadCoverage,
  parseWorkMeta,
  collectMarkdownUnderWork,
} from "./lib/discover.mjs";
import { layout, emptyState, escapeHtml } from "./lib/layout.mjs";

const BASE = normalizeBase(process.env.BASE_PATH);
const OUT = path.join(REPO_ROOT, "dist");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writePage(distRel, html) {
  const out = path.join(OUT, distRel);
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, html, "utf8");
}

function copyAsset() {
  const src = path.join(REPO_ROOT, "site", "assets", "css", "main.css");
  const dest = path.join(OUT, "assets", "css", "main.css");
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function rewriteTemplateLink(href) {
  if (href && (href.includes("テンプレート") || href.includes("../テンプレート"))) {
    return "https://github.com/keipon1004/manga/tree/main/テンプレート";
  }
  return href;
}

function markdownToHtml(md, fromMdRel) {
  const renderer = new marked.Renderer();
  renderer.link = function (token) {
    let href = token.href ?? "";
    href = rewriteTemplateLink(href);
    href = mdHrefToWeb(href, BASE, fromMdRel);
    const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
    const text = token.text ?? "";
    const external =
      typeof href === "string" && href.startsWith("http")
        ? ' rel="noopener noreferrer" target="_blank"'
        : "";
    return `<a href="${escapeHtml(href)}"${title}${external}>${text}</a>`;
  };
  marked.setOptions({ gfm: true, breaks: false });
  return marked.parse(md, { renderer });
}

function extractSpoilerBanner(md) {
  const lines = md.split("\n");
  if (lines[0]?.trim().startsWith("#")) {
    // skip title line
  }
  const quoteLines = [];
  for (const line of lines) {
    if (line.startsWith(">")) quoteLines.push(line.replace(/^>\s?/, "").trim());
    else if (quoteLines.length > 0) break;
    else if (line.trim() && !line.startsWith("#")) break;
  }
  if (!quoteLines.length || !/ネタバレ/.test(quoteLines.join(" "))) return null;
  return quoteLines.join(" ").replace(/\*\*/g, "");
}

function isStoryPath(mdRel) {
  return mdRel.includes("/story/");
}

function isKansouPath(mdRel) {
  return mdRel.includes("/感想/");
}

function renderMarkdownPage({ mdRel, md, title, description, breadcrumbs = [] }) {
  const spoiler = isStoryPath(mdRel) ? extractSpoilerBanner(md) : null;
  const spoilerHtml = spoiler
    ? `<div class="spoiler-banner" role="note"><strong class="spoiler-banner__label">注意</strong><p>${escapeHtml(spoiler)}</p></div>`
    : "";

  let kansouExtra = "";
  if (isKansouPath(mdRel) && /まだ供給されていません|未供給/.test(md)) {
    kansouExtra = `<p class="text-muted" style="margin-bottom:1rem">このページはプレースホルダです。個人の感想はまだ書かれていません。</p>`;
  }

  const crumb =
    breadcrumbs.length > 0
      ? `<nav class="breadcrumb" aria-label="パンくず">${breadcrumbs
          .map((c, i) =>
            i === breadcrumbs.length - 1
              ? `<span aria-current="page">${escapeHtml(c.label)}</span>`
              : `<a href="${escapeHtml(c.href)}">${escapeHtml(c.label)}</a>`
          )
          .join('<span class="breadcrumb__sep">/</span>')}</nav>`
      : "";

  const body = `
    ${crumb}
    ${spoilerHtml}
    ${kansouExtra}
    <article class="prose">${markdownToHtml(md, mdRel)}</article>`;

  return layout({
    base: BASE,
    title,
    description,
    body,
    bodyClass: isStoryPath(mdRel) ? "page-story" : isKansouPath(mdRel) ? "page-kansou" : "page-content",
  });
}

function pageTitleFromMd(md, mdRel) {
  const h1 = md.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].replace(/\s+—.*/, "").trim();
  if (mdRel.endsWith("/README.md")) return path.basename(path.dirname(mdRel));
  return path.basename(mdRel, ".md");
}

function buildMarkdownPages(works) {
  const built = [];
  const coverageMd = path.join(REPO_ROOT, "docs", "ストーリー要約のカバレッジ.md");
  if (fs.existsSync(coverageMd)) {
    const mdRel = "docs/ストーリー要約のカバレッジ.md";
    const md = fs.readFileSync(coverageMd, "utf8");
    const html = renderMarkdownPage({
      mdRel,
      md,
      title: "ストーリー要約のカバレッジ",
      description: "参照用要約の収録範囲一覧",
      breadcrumbs: [
        { href: url(BASE, "index.html"), label: "ホーム" },
        { href: url(BASE, "coverage.html"), label: "カバレッジ" },
      ],
    });
    writePage("coverage.html", html);
    built.push("coverage.html");
  }

  for (const work of works) {
    const files = collectMarkdownUnderWork(work);
    for (const mdRel of files) {
      const md = fs.readFileSync(path.join(REPO_ROOT, mdRel), "utf8");
      const title = pageTitleFromMd(md, mdRel);
      const distRel = distRelFromMd(mdRel);
      const workUrl = url(BASE, work, "index.html");

      const breadcrumbs = [{ href: url(BASE, "index.html"), label: "ホーム" }];
      breadcrumbs.push({ href: url(BASE, "works/index.html"), label: "作品一覧" });
      breadcrumbs.push({ href: workUrl, label: work });

      if (mdRel.includes("/story/")) {
        breadcrumbs.push({
          href: url(BASE, distRel),
          label: title,
        });
      } else if (mdRel.includes("/感想/")) {
        breadcrumbs.push({ href: url(BASE, distRel), label: "感想" });
      }

      const html = renderMarkdownPage({
        mdRel,
        md,
        title,
        description: `${work}の記録`,
        breadcrumbs,
      });
      writePage(distRel, html);
      built.push(distRel);
    }
  }
  return built;
}

function renderHome(works) {
  const coverage = loadCoverage();
  const cards = works
    .map((name) => {
      const readme = fs.readFileSync(path.join(REPO_ROOT, name, "README.md"), "utf8");
      const meta = parseWorkMeta(readme, name);
      const cov = meta.cov ?? coverage.get(name);
      const status = cov?.state ?? "—";
      const covText = cov?.coverage ?? "—";
      const workHref = url(BASE, name, "index.html");
      const storyLinks = meta.storyFiles
        .map((sf) => {
          const label = sf.includes("シーズン2") ? "S2要約" : "ストーリー";
          const web = distRelFromMd(`${name}/${sf}`);
          return `<a href="${url(BASE, web)}">${escapeHtml(label)}</a>`;
        })
        .join(" · ");

      return `<tr>
        <th scope="row"><a href="${workHref}">${escapeHtml(name)}</a></th>
        <td>${escapeHtml(meta.kind)}</td>
        <td>${escapeHtml(meta.progress)}</td>
        <td>${escapeHtml(status)}</td>
        <td class="coverage-cell">${escapeHtml(covText)}</td>
        <td>${storyLinks || "—"}</td>
      </tr>`;
    })
    .join("");

  const body = `
    <section class="hero">
      <h1 class="hero__title">漫画・ドラマジャーナル</h1>
      <p class="hero__lead">ストーリー（事実・参照要約）と感想（主観）を分けて残す個人用アーカイブ。正本は GitHub 上の Markdown です。</p>
      <p class="hero__lead text-muted">漫画 ${works.filter((w) => parseWorkMeta(fs.readFileSync(path.join(REPO_ROOT, w, "README.md"), "utf8"), w).kind === "漫画").length} 作品 ＋ ドラマ 1 作品（計 ${works.length}）</p>
    </section>
  <section class="card" style="margin-top:1.5rem">
    <h2 class="card__title">収録作品</h2>
    <div class="table-wrap">
    <table class="works-table">
      <thead>
        <tr>
          <th>作品</th>
          <th>種別</th>
          <th>利用者進捗</th>
          <th>参照状態</th>
          <th>収録上限</th>
          <th>ストーリー</th>
        </tr>
      </thead>
      <tbody>${cards}</tbody>
    </table>
    </div>
    <p class="browse-hint"><a href="${url(BASE, "coverage.html")}">カバレッジ一覧の詳細 →</a></p>
  </section>`;

  return layout({
    base: BASE,
    title: "ホーム",
    description: "漫画・ドラマジャーナル",
    body,
    bodyClass: "page-home",
  });
}

function renderWorksIndex(works) {
  const items = works
    .map((name) => {
      const readme = fs.readFileSync(path.join(REPO_ROOT, name, "README.md"), "utf8");
      const meta = parseWorkMeta(readme, name);
      return `<li class="work-list__item">
        <a class="work-list__link" href="${url(BASE, name, "index.html")}">
          <span class="work-list__name">${escapeHtml(name)}</span>
          <span class="work-list__meta">${escapeHtml(meta.kind)} · ${escapeHtml(meta.progress)}</span>
        </a>
      </li>`;
    })
    .join("");

  const body = `
    <h1>作品一覧</h1>
    <p class="text-muted">テンプレートフォルダはサイトには掲載しません。</p>
    <ul class="work-list">${items}</ul>`;

  return layout({
    base: BASE,
    title: "作品一覧",
    description: "収録作品一覧",
    body,
    bodyClass: "page-works",
  });
}

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  ensureDir(OUT);

  const works = discoverWorks();
  if (works.length !== 14) {
    console.warn(`Expected 14 works, found ${works.length}:`, works);
  }

  copyAsset();
  writePage("index.html", renderHome(works));
  writePage("works/index.html", renderWorksIndex(works));
  const pages = buildMarkdownPages(works);

  fs.writeFileSync(OUT + "/.nojekyll", "", "utf8");
  fs.writeFileSync(
    path.join(OUT, "site-meta.json"),
    JSON.stringify({ basePath: BASE, works, pages }, null, 2),
    "utf8"
  );

  console.log(`Built ${pages.length + 2} pages for ${works.length} works → dist/`);
}

main();
