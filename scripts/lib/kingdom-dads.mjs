import { escapeHtml } from "./layout.mjs";
import { url } from "./paths.mjs";

const KINGDOM = "キングダム";

const EXTERNAL_ICON = `<svg class="dads-link__icon" width="16" height="16" viewBox="0 0 48 48" role="img" aria-label="新規タブで開きます"><path d="M22 6V9H9V39H39V26H42V42H6V6H22ZM42 6V20H39V11.2L21 29L19 27L36.8 9H28V6H42Z" fill="currentcolor"/></svg>`;

const UTILITY_EXTERNAL_ICON = `<svg class="dads-utility-link__tail-icon" width="16" height="16" viewBox="0 0 48 48" fill="currentcolor" role="img" aria-label="新規タブで開きます"><path d="M22 6V9H9V39H39V26H42V42H6V6H22ZM42 6V20H39V11.2L21 29L19 27L36.8 9H28V6H42Z"/></svg>`;

const BREADCRUMB_SEPARATOR = `<span class="dads-breadcrumb__separator"><svg class="dads-breadcrumb__separator-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 11L4 10.5L8 6.5L4 2.5L4.5 2L9 6.5L4.5 11Z" fill="currentcolor"/></svg></span>`;

const WARNING_ICON = `<svg class="dads-notification-banner__icon" width="24" height="24" viewBox="0 0 24 24" role="img" aria-label="警告"><path d="M1 21 12 2l11 19H1Z" fill="currentcolor"/><path d="M13 15h-2v-5h2v5Z" fill="Canvas"/><circle cx="12" cy="17" r="1" fill="Canvas"/></svg>`;

const INFO_ICON = `<svg class="dads-notification-banner__icon" width="24" height="24" viewBox="0 0 24 24" role="img" aria-label="インフォメーション"><circle cx="12" cy="12" r="10" fill="currentcolor"/><circle cx="12" cy="8" r="1" fill="Canvas"/><path d="M11 11h2v6h-2z" fill="Canvas"/></svg>`;

const HEADING_SIZE = { 1: "36", 2: "28", 3: "24", 4: "20", 5: "18", 6: "16" };

export function isKingdomMarkdown(mdRel) {
  return mdRel === KINGDOM || mdRel.startsWith(`${KINGDOM}/`);
}

export function kingdomPageKind(mdRel) {
  if (mdRel.includes("/story/")) return "story";
  if (mdRel.includes("/感想/")) return "kansou";
  return "work";
}

export function prepareKingdomMarkdown(md) {
  const lines = md.split("\n");
  let index = 0;
  if (lines[0]?.trim().startsWith("#")) {
    index = 1;
    if (lines[index]?.trim() === "") index += 1;
  }
  const start = index;
  if (!lines[index]?.startsWith(">")) return { md, spoiler: null };
  while (index < lines.length && lines[index].startsWith(">")) index += 1;
  const quoteLines = lines.slice(start, index).map((line) => line.replace(/^>\s?/, "").trim());
  const spoiler = quoteLines.join(" ").replace(/\*\*/g, "").trim();
  if (!/ネタバレ/.test(spoiler)) return { md, spoiler: null };
  const rest = lines.slice(index);
  while (rest[0]?.trim() === "") rest.shift();
  const kept = lines.slice(0, start).concat(rest);
  return { md: kept.join("\n"), spoiler };
}

function transformLinks(html) {
  return html.replace(/<a href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (_, href, attrs, text) => {
    const icon = /target="_blank"/.test(attrs) ? EXTERNAL_ICON : "";
    return `<a class="dads-link" href="${href}"${attrs}>${text}${icon}</a>`;
  });
}

function transformHeadings(html) {
  let count = 0;
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
    count += 1;
    const depth = Number(level);
    const size = HEADING_SIZE[depth];
    const modifier = depth === 1 ? ' data-rule="4"' : depth === 2 ? " data-chip" : "";
    const id = `heading-${count}`;
    return `<div class="dads-heading" data-size="${size}"${modifier}><h${depth} id="${id}" class="dads-heading__heading">${inner}</h${depth}></div>`;
  });
}

function transformLists(html) {
  return html
    .replace(/<ul>/g, '<ul class="dads-list" data-spacing="8">')
    .replace(/<ol>/g, '<ol class="dads-list" data-spacing="8">');
}

function transformBlockquotes(html) {
  return html.replace(/<blockquote>/g, '<blockquote class="dads-blockquote">');
}

function transformParagraphs(html) {
  return html.replace(/<p>/g, '<p class="dads-u-std-16N-175">');
}

function transformTables(html) {
  return html.replace(/<table>[\s\S]*?<\/table>/g, (table) => {
    const headers = [...table.matchAll(/<th>([\s\S]*?)<\/th>/g)].map((match) =>
      match[1].replace(/<[^>]+>/g, "").trim()
    );
    if (headers.length === 2 && headers[0] === "項目" && headers[1] === "内容") {
      const rows = [...table.matchAll(/<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g)];
      const items = rows
        .map(
          ([, term, detail]) =>
            `<div class="dads-description-list__item"><dt>${term.trim()}</dt><dd>${detail.trim()}</dd></div>`
        )
        .join("");
      return `<dl class="dads-description-list">${items}</dl>`;
    }
    const styled = table
      .replace("<table>", '<table class="dads-table__table" data-width="full">')
      .replace(/<th>/g, '<th class="dads-table__col-header" scope="col">')
      .replace("<tbody>", '<tbody data-cell-border="bottom">');
    return `<div class="dads-table" data-row-stripe>${styled}</div>`;
  });
}

export function structureKingdomProse(html) {
  const transformed = transformTables(
    transformParagraphs(transformBlockquotes(transformLists(transformHeadings(transformLinks(html)))))
  );
  const headings = [...transformed.matchAll(/<h([1-6]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)].map(
    (match) => ({
      level: match[1],
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, ""),
    })
  );
  const marker = '<div class="dads-heading" data-size="28"';
  const index = transformed.indexOf(marker);
  if (index === -1) {
    return { lead: transformed, sections: "", tocItems: [] };
  }
  const lead = transformed.slice(0, index);
  const chunks = transformed
    .slice(index)
    .split(/(?=<div class="dads-heading" data-size="28")/)
    .filter((chunk) => chunk.trim());
  const sections = chunks.map((chunk) => `<section class="kingdom-section">${chunk}</section>`).join("\n");
  const tocItems = headings.filter((heading) => heading.level === "2");
  return { lead, sections, tocItems };
}

function breadcrumbNav(breadcrumbs) {
  if (!breadcrumbs?.length) return "";
  const items = breadcrumbs
    .map((crumb, index) => {
      const last = index === breadcrumbs.length - 1;
      if (last) {
        return `<span class="dads-breadcrumb__item" aria-current="page">${escapeHtml(crumb.label)}</span>`;
      }
      return `<span class="dads-breadcrumb__item"><a class="dads-breadcrumb__link" href="${escapeHtml(crumb.href)}">${escapeHtml(crumb.label)}</a>${BREADCRUMB_SEPARATOR}</span>`;
    })
    .join("");
  return `<nav class="dads-breadcrumb" aria-labelledby="breadcrumb-label"><span id="breadcrumb-label" class="dads-u-visually-hidden">現在位置</span><p class="dads-breadcrumb__list">${items}</p></nav>`;
}

function utilityLink(href, label) {
  return `<a class="dads-utility-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><span class="dads-utility-link__label">${escapeHtml(label)}</span>${UTILITY_EXTERNAL_ICON}</a>`;
}

function menuItems(base, kind) {
  const items = [
    { id: "home", href: url(base, "index.html"), label: "ホーム" },
    { id: "works", href: url(base, "works/index.html"), label: "作品一覧" },
    { id: "coverage", href: url(base, "coverage.html"), label: "カバレッジ" },
    { id: "work", href: url(base, KINGDOM, "index.html"), label: "キングダム" },
    { id: "story", href: url(base, KINGDOM, "story/index.html"), label: "ストーリー" },
    { id: "kansou", href: url(base, KINGDOM, "感想/index.html"), label: "感想" },
  ];
  return items
    .map((item) => {
      const current = item.id === kind ? ' aria-current="page"' : "";
      return `<li class="dads-horizontal-menu__item"><a class="dads-horizontal-menu__item-inner" href="${item.href}"${current}>${escapeHtml(item.label)}</a></li>`;
    })
    .join("");
}

function pageActions(base, kind) {
  const actions = [
    { id: "work", href: url(base, KINGDOM, "index.html"), label: "作品情報", type: "outline" },
    { id: "story", href: url(base, KINGDOM, "story/index.html"), label: "ストーリーを読む", type: "outline" },
    { id: "kansou", href: url(base, KINGDOM, "感想/index.html"), label: "感想", type: "outline" },
  ];
  const links = actions
    .map((action) => {
      const current = action.id === kind;
      const type = current ? "solid-fill" : action.type;
      const aria = current ? ' aria-current="page"' : "";
      return `<a class="dads-button" data-size="md" data-type="${type}" href="${action.href}"${aria}>${escapeHtml(action.label)}</a>`;
    })
    .join("");
  return `<nav class="kingdom-actions" aria-label="キングダムのページ">${links}</nav>`;
}

function notificationBanner({ type, icon, heading, body }) {
  return `<div class="dads-notification-banner" data-style="standard" data-type="${type}">
  <h2 class="dads-notification-banner__heading">
    ${icon}
    <span class="dads-notification-banner__heading-text">${escapeHtml(heading)}</span>
  </h2>
  <div class="dads-notification-banner__body"><p>${escapeHtml(body)}</p></div>
</div>`;
}

function tableOfContents(items) {
  if (items.length < 2) return "";
  const links = items
    .map((item) => `<li><a class="dads-link" href="#${item.id}">${item.text}</a></li>`)
    .join("");
  return `<nav class="dads-toc" data-border="solid" aria-labelledby="toc-heading"><h2 id="toc-heading" class="dads-toc__heading">このページの目次</h2><ul class="dads-list" data-spacing="8">${links}</ul></nav>`;
}

function chipsFor(kind, sourceMd) {
  if (kind !== "story") return "";
  const chips = [];
  if (/ネタバレ/.test(sourceMd)) {
    chips.push('<span class="dads-chip-label" data-style="filled-1" data-color="orange">ネタバレ</span>');
  }
  if (/未完/.test(sourceMd)) {
    chips.push('<span class="dads-chip-label" data-style="filled-1" data-color="gray">未完</span>');
  }
  if (!chips.length) return "";
  return `<p class="kingdom-chips">${chips.join("")}</p>`;
}

const DADS_STYLES = [
  "assets/dads/css/global.css",
  "assets/dads/tokens.css",
  "assets/dads/css/button.css",
  "assets/dads/css/link.css",
  "assets/dads/css/breadcrumb.css",
  "assets/dads/css/heading.css",
  "assets/dads/css/notification-banner.css",
  "assets/dads/css/utility-link.css",
  "assets/dads/css/horizontal-menu.css",
  "assets/dads/css/hamburger-menu-button.css",
  "assets/dads/css/divider.css",
  "assets/dads/css/list.css",
  "assets/dads/css/blockquote.css",
  "assets/dads/css/description-list.css",
  "assets/dads/css/table.css",
  "assets/dads/css/toc.css",
  "assets/dads/css/chip-label.css",
  "assets/css/kingdom.css",
];

function kingdomDocument({ base, title, description, body }) {
  const siteTitle = "Manga / Drama Journal";
  const fullTitle = title ? `${title} — ${siteTitle}` : siteTitle;
  const styles = DADS_STYLES.map(
    (href) => `<link rel="stylesheet" href="${url(base, href)}">`
  ).join("\n  ");
  const home = url(base, "index.html");
  const menu = menuItems(base, body.kind);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description ?? "キングダムのストーリー")}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&family=Noto+Sans+Mono:wght@400;700&display=swap" rel="stylesheet">
  ${styles}
</head>
<body class="kingdom-body">
  <a class="dads-button kingdom-skip" data-size="md" data-type="solid-fill" href="#main">本文へスキップ</a>
  <header class="kingdom-header">
    <div class="kingdom-header__inner">
      <div class="kingdom-header__bar">
        <a class="kingdom-header__brand dads-u-std-20B-150" href="${home}">Manga Journal</a>
        <div class="kingdom-header__utils">
          ${utilityLink("https://github.com/keipon1004/manga", "GitHub")}
        </div>
        <button class="dads-hamburger-menu-button kingdom-header__toggle" type="button" aria-expanded="false" aria-controls="kingdom-menu" data-kingdom-menu-button>
          <svg data-icon class="dads-hamburger-menu-button__icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18V16H21V18H3ZM3 13V11H21V13H3ZM3 8V6H21V8H3Z" fill="currentcolor"/></svg>
          <span data-label>メニュー</span>
        </button>
      </div>
      <nav id="kingdom-menu" class="kingdom-menu" aria-label="メイン">
        <ul class="dads-horizontal-menu">${menu}</ul>
        <div class="kingdom-menu__utils">
          ${utilityLink("https://github.com/keipon1004/manga", "GitHub")}
        </div>
      </nav>
    </div>
  </header>
  <main id="main" class="kingdom-main">
    ${body.html}
  </main>
  <footer class="kingdom-footer">
    <hr class="dads-divider" data-color="solid-gray-420" data-style="solid" data-width="1">
    <div class="kingdom-footer__inner">
      <p class="kingdom-footer__note dads-u-dns-14N-130">正本はリポジトリ内の Markdown です。</p>
      ${utilityLink("https://github.com/keipon1004/manga", "GitHub")}
      ${utilityLink("https://design.digital.go.jp/", "デジタル庁デザインシステム")}
    </div>
  </footer>
  <script>
    (() => {
      const button = document.querySelector("[data-kingdom-menu-button]");
      const menu = document.getElementById("kingdom-menu");
      if (!button || !menu) return;
      const label = button.querySelector("[data-label]");
      const icon = button.querySelector("[data-icon]");
      const path = icon.querySelector("path");
      const menuPath = "M3 18V16H21V18H3ZM3 13V11H21V13H3ZM3 8V6H21V8H3Z";
      const closePath = "M32 95L25 88L53 60L25 32L32 25L60 53L88 25L95 32L67 60L95 88L88 95L60 67L32 95Z";
      const setOpen = (open) => {
        button.setAttribute("aria-expanded", String(open));
        menu.classList.toggle("is-open", open);
        label.textContent = open ? "閉じる" : "メニュー";
        icon.setAttribute("viewBox", open ? "0 0 120 120" : "0 0 24 24");
        path.setAttribute("d", open ? closePath : menuPath);
      };
      button.addEventListener("click", () => {
        setOpen(button.getAttribute("aria-expanded") !== "true");
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
          setOpen(false);
          button.focus();
        }
      });
      const desktop = window.matchMedia("(min-width: 48rem)");
      desktop.addEventListener("change", () => {
        if (desktop.matches) setOpen(false);
      });
    })();
  </script>
</body>
</html>`;
}

export function renderKingdomPage({ base, mdRel, proseHtml, sourceMd, title, description, breadcrumbs }) {
  const kind = kingdomPageKind(mdRel);
  const structured = structureKingdomProse(proseHtml);
  let { lead, sections, tocItems } = structured;
  if (kind === "story") {
    lead = lead.replace(
      /(<div class="dads-heading" data-size="36" data-rule="4">)<h1 id="([^"]+)" class="dads-heading__heading">キングダム — story<\/h1>/,
      '$1<p class="dads-heading__shoulder">ストーリー</p><h1 id="$2" class="dads-heading__heading">キングダム</h1>'
    );
  }
  const crumbs = breadcrumbs.map((crumb, index) => {
    if (index !== breadcrumbs.length - 1) return crumb;
    if (kind === "story") return { ...crumb, label: "ストーリー" };
    if (kind === "kansou") return { ...crumb, label: "感想" };
    return crumb;
  });
  const documentTitle = kind === "story" ? "キングダムのストーリー" : kind === "kansou" ? "キングダムの感想" : title;
  const prepared = prepareKingdomMarkdown(sourceMd);
  const spoiler = kind === "story" ? prepared.spoiler : null;
  const placeholder = kind === "kansou" && /まだ供給されていません|未供給/.test(sourceMd);

  const banner = spoiler
    ? notificationBanner({
        type: "warning",
        icon: WARNING_ICON,
        heading: "重大なネタバレ",
        body: spoiler,
      })
    : placeholder
      ? notificationBanner({
          type: "info-1",
          icon: INFO_ICON,
          heading: "感想は未供給",
          body: "このページはプレースホルダです。個人の感想はまだ書かれていません。",
        })
      : "";

  const headingEnd = lead.indexOf("</div>");
  const headingHtml = headingEnd === -1 ? lead : lead.slice(0, headingEnd + "</div>".length);
  const leadRest = headingEnd === -1 ? "" : lead.slice(headingEnd + "</div>".length);
  const article = `<article class="kingdom-article">
    <div class="kingdom-lead">
      ${headingHtml}
      ${chipsFor(kind, sourceMd)}
      ${banner}
      ${leadRest}
    </div>
    ${tableOfContents(tocItems)}
    ${sections}
  </article>`;

  const html = `${breadcrumbNav(crumbs)}
    ${pageActions(base, kind)}
    ${article}`;

  return kingdomDocument({
    base,
    title: documentTitle,
    description,
    body: { kind, html },
  });
}
