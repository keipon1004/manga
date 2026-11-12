import { url } from "./paths.mjs";

const NAV = [
  { href: "index.html", label: "ホーム" },
  { href: "works/index.html", label: "作品一覧" },
  { href: "coverage.html", label: "カバレッジ" },
];

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function layout({ base, title, description, body, extraHead = "", bodyClass = "" }) {
  const siteTitle = "Manga / Drama Journal";
  const fullTitle = title ? `${title} — ${siteTitle}` : siteTitle;
  const nav = NAV.map(
    (item) =>
      `<a class="site-nav__link" href="${url(base, item.href)}">${escapeHtml(item.label)}</a>`
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description ?? "漫画・ドラマのストーリーと感想ジャーナル")}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600&family=Noto+Serif+JP:wght@500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${url(base, "assets/css/main.css")}">
  ${extraHead}
</head>
<body class="${escapeHtml(bodyClass)}">
  <a class="skip-link" href="#main">本文へスキップ</a>
  <header class="site-header">
    <div class="site-header__inner">
      <a class="site-brand" href="${url(base, "index.html")}">
        <span class="site-brand__mark" aria-hidden="true">📚</span>
        <span class="site-brand__text">Manga Journal</span>
      </a>
      <nav class="site-nav" aria-label="メイン">${nav}</nav>
    </div>
  </header>
  <main id="main" class="site-main">
    ${body}
  </main>
  <footer class="site-footer">
    <p>正本はリポジトリ内の Markdown です。<a href="https://github.com/keipon1004/manga">GitHub</a></p>
  </footer>
</body>
</html>`;
}

export function emptyState({ heading, message, hint }) {
  return `<section class="empty-state" aria-live="polite">
    <div class="empty-state__icon" aria-hidden="true">◎</div>
    <h2 class="empty-state__title">${escapeHtml(heading)}</h2>
    <p class="empty-state__text">${escapeHtml(message)}</p>
    ${hint ? `<p class="empty-state__hint">${hint}</p>` : ""}
  </section>`;
}
