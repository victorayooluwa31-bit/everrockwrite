const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

marked.setOptions({ breaks: true });

const root = __dirname;
const out = path.join(root, 'dist');

/* ---------- Helpers ---------- */
const str = (v) => (v == null ? '' : String(v).trim());

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const slugify = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Accept only hex colours so a typo can never break the stylesheet
const hex = (v) => {
  const s = str(v);
  return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) ? s : '';
};
function hexToRgb(h) {
  let s = h.replace('#', '');
  if (s.length <= 4) s = s.split('').map((c) => c + c).join('');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
const safeUrl = (u) => {
  const s = str(u);
  return /^\s*(javascript|data|vbscript):/i.test(s) ? '' : s;
};
const isExternal = (u) => /^(https?:)?\/\//i.test(u);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

function readJSON(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch (e) {
    console.warn(`Warning: ${file} could not be read (${e.message}). Using defaults.`);
    return {};
  }
}

const validDate = (d) => d instanceof Date && !isNaN(d);
const fmtDate = (d) =>
  validDate(d)
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : '';
const isoDate = (d) => (validDate(d) ? d.toISOString().slice(0, 10) : '');
const readingTime = (text) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 220));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function write(rel, content) {
  const file = path.join(out, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/* ---------- Settings (site.json, home.json, categories.json, menu.json) ---------- */
const rawSite = readJSON('site.json');
const rawHome = readJSON('home.json');
const rawCats = readJSON('categories.json');
const rawMenu = readJSON('menu.json');

const site = {
  title: str(rawSite.title) || 'EverRock Write',
  tagline: str(rawSite.tagline) || 'Words with purpose',
  author: str(rawSite.author) || str(rawSite.title) || 'EverRock Write',
};

let baseUrl = str(rawSite.url).replace(/\/+$/, '');
if (baseUrl && !/^https?:\/\//.test(baseUrl)) baseUrl = 'https://' + baseUrl;

// GoatCounter: accept "mycode", "mycode.goatcounter.com" or a full address
const gc = str(rawSite.goatcounter)
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\.goatcounter\.com.*$/, '')
  .replace(/[^a-z0-9-]/g, '');

// Logos and favicon. Defaults ship with the site; the admin can replace them.
const logoSrc = str(rawSite.logo) || '/img/logo.png';
const headerLogoSrc = str(rawSite.header_logo) || logoSrc;
const faviconSrc = str(rawSite.favicon); // empty = use the shipped favicon files
const shareImage = str(rawSite.logo) || '/img/og-default.png';

// Site-wide colours (only the ones that are set override the defaults)
const colorVars = {
  text: '--ink',
  background: '--bg',
  accent: '--accent',
  header_bg: '--header-bg',
  header_text: '--header-fg',
  footer_bg: '--footer-bg',
  footer_text: '--footer-fg',
  button: '--btn-bg',
  button_text: '--btn-fg',
};
const rawColors = rawSite.colors && typeof rawSite.colors === 'object' ? rawSite.colors : {};
const footerSettings = rawSite.footer && typeof rawSite.footer === 'object' ? rawSite.footer : {};
const colorCss = Object.entries(colorVars)
  .map(([k, v]) => (hex(rawColors[k]) ? `${v}:${hex(rawColors[k])}` : ''))
  .filter(Boolean)
  .join(';');

// Home page
const imgList = Array.isArray(rawHome.hero_images) ? rawHome.hero_images : [];
let overlay = Number(rawHome.hero_overlay);
if (!isFinite(overlay) || rawHome.hero_overlay === '' || rawHome.hero_overlay == null) overlay = 60;
overlay = clamp(overlay, 0, 90) / 100;
const home = {
  heading: str(rawHome.hero_heading) || str(rawSite.hero_heading) || 'Words with purpose.',
  text:
    str(rawHome.hero_text) ||
    str(rawSite.hero_text) ||
    'Reflections from the Word, poems, and stories drawn from life and imagination.',
  images: imgList.map((x) => (typeof x === 'string' ? x : x && x.image ? x.image : '')).map(str).filter(Boolean),
  overlay,
  heroBg: hex(rawHome.hero_bg_color),
  heroFg: hex(rawHome.hero_text_color),
  btn1Text: str(rawHome.button_1_text),
  btn1Link: safeUrl(rawHome.button_1_link),
  btn2Text: str(rawHome.button_2_text),
  btn2Link: safeUrl(rawHome.button_2_link),
  showCategories: rawHome.show_categories !== false,
  latestTitle: str(rawHome.latest_title) || 'Latest writing',
  // null = nothing added yet: show the default "Latest writing" section
  sections: Array.isArray(rawHome.sections) && rawHome.sections.length ? rawHome.sections : null,
};

const RESERVED = ['admin', 'posts', 'tags', 'css', 'js', 'img', 'uploads', 'writing', '404', 'feed', 'sitemap', 'robots'];

/* ---------- Categories ---------- */
const DEFAULT_CATEGORIES = [
  { name: 'Word from God', slug: 'word-from-god', description: 'Reflections and encouragement from the Word.' },
  { name: 'Poem', slug: 'poem', description: 'Poems and lyrics.' },
  { name: 'Life & Fictional Story', slug: 'life-and-fiction', description: 'Stories from real life, and stories imagined.' },
];
const catSource = Array.isArray(rawCats.categories) && rawCats.categories.length ? rawCats.categories : DEFAULT_CATEGORIES;
const CATEGORIES = [];
for (const c of catSource) {
  const name = str(c && c.name);
  const slug = slugify(str(c && c.slug) || name);
  if (!name || !slug) continue;
  if (RESERVED.includes(slug) || CATEGORIES.some((x) => x.slug === slug)) {
    console.warn(`Warning: category "${name}" skipped because the address /${slug}/ is already in use.`);
    continue;
  }
  CATEGORIES.push({ name, slug, blurb: str(c.description) });
}
const findCategory = (v) => {
  const k = str(v).toLowerCase();
  return k ? CATEGORIES.find((c) => c.name.toLowerCase() === k || c.slug === slugify(k)) || null : null;
};

/* ---------- Pages ---------- */
const parsePlacement = (v) => {
  const s = str(v).toLowerCase();
  if (s.startsWith('footer')) return 'footer';
  if (s.startsWith('hidden')) return 'hidden';
  return 'menu';
};
const pages = [];
const pagesDir = path.join(root, 'content', 'pages');
if (fs.existsSync(pagesDir)) {
  for (const f of fs.readdirSync(pagesDir).filter((x) => x.endsWith('.md'))) {
    const { data, content } = matter(fs.readFileSync(path.join(pagesDir, f), 'utf8'));
    const slug = slugify(f.replace(/\.md$/, ''));
    pages.push({
      slug,
      title: str(data.title) || slug,
      placement: parsePlacement(data.placement),
      order: isFinite(Number(data.menu_order)) && data.menu_order !== '' && data.menu_order != null ? Number(data.menu_order) : 50,
      showTitle: data.show_title !== false,
      sections: Array.isArray(data.sections) ? data.sections : [],
      content,
    });
  }
}
// Privacy and copyright pages kept at the top level of the repo
for (const [file, slug] of [['privacy.md', 'privacy'], ['copyright.md', 'copyright']]) {
  const p = path.join(root, file);
  if (!fs.existsSync(p) || pages.some((x) => x.slug === slug)) continue;
  const { data, content } = matter(fs.readFileSync(p, 'utf8'));
  pages.push({ slug, title: str(data.title) || slug, placement: 'footer', order: 100, showTitle: true, sections: [], content });
}
const livePages = pages.filter((p) => {
  if (!p.slug || RESERVED.includes(p.slug) || CATEGORIES.some((c) => c.slug === p.slug)) {
    console.warn(`Warning: page "${p.title}" skipped because the address /${p.slug}/ is already in use.`);
    return false;
  }
  return true;
});
const byOrder = (a, b) => a.order - b.order || a.title.localeCompare(b.title);
const menuPages = livePages.filter((p) => p.placement === 'menu').sort(byOrder);
const footerPages = livePages.filter((p) => p.placement === 'footer').sort(byOrder);
const findPage = (v) => {
  const k = str(v).toLowerCase();
  return k ? livePages.find((p) => p.title.toLowerCase() === k || p.slug === slugify(k)) || null : null;
};

/* ---------- Posts ---------- */
const postsDir = path.join(root, 'content', 'posts');
const posts = (fs.existsSync(postsDir) ? fs.readdirSync(postsDir) : [])
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { data, content } = matter(fs.readFileSync(path.join(postsDir, f), 'utf8'));
    const slug = f.replace(/\.md$/, '');
    const category = findCategory(data.category);
    const rawTags = Array.isArray(data.tags) ? data.tags : String(data.tags || '').split(',');
    const seen = new Set();
    const tags = [];
    for (const t of rawTags) {
      const name = str(t);
      const s = slugify(name);
      if (name && s && !seen.has(s)) {
        seen.add(s);
        tags.push({ name, slug: s });
      }
    }
    return {
      slug,
      url: `/posts/${slug}/`,
      title: str(data.title) || 'Untitled',
      date: data.date ? new Date(data.date) : new Date(0),
      summary: str(data.summary),
      image: str(data.image),
      draft: data.draft === true,
      category,
      tags,
      content,
      minutes: readingTime(content),
    };
  })
  .filter((p) => !p.draft)
  .sort((a, b) => b.date - a.date);

/* ---------- Menu (automatic, plus optional dropdowns from menu.json) ---------- */
const autoNav = [
  { key: 'home', cur: 'home', href: '/', label: 'Home' },
  ...CATEGORIES.map((c) => ({ key: 'cat:' + c.slug, cur: c.slug, href: `/${c.slug}/`, label: c.name })),
  ...menuPages.map((p) => ({ key: 'page:' + p.slug, cur: p.slug, href: `/${p.slug}/`, label: p.title })),
];

const dropdowns = (Array.isArray(rawMenu.dropdowns) ? rawMenu.dropdowns : [])
  .map((d) => {
    const label = str(d && d.label);
    const items = [];
    const captured = new Set();
    for (const it of Array.isArray(d && d.items) ? d.items : []) {
      const type = str(it && it.type);
      if (type === 'page') {
        const pg = findPage(it.page);
        if (!pg) { console.warn(`Warning: menu "${label}": page "${str(it.page)}" not found, skipped.`); continue; }
        items.push({ label: str(it.label) || pg.title, href: `/${pg.slug}/`, cur: pg.slug });
        captured.add('page:' + pg.slug);
      } else if (type === 'category') {
        const c = findCategory(it.category);
        if (!c) { console.warn(`Warning: menu "${label}": category "${str(it.category)}" not found, skipped.`); continue; }
        items.push({ label: str(it.label) || c.name, href: `/${c.slug}/`, cur: c.slug });
        captured.add('cat:' + c.slug);
      } else if (type === 'link') {
        const url = safeUrl(it.url);
        if (!str(it.label) || !url) continue;
        items.push({ label: str(it.label), href: url, cur: '', external: isExternal(url) });
      }
    }
    return { label, items, captured };
  })
  .filter((d) => d.label && d.items.length);

// A dropdown sits where its first moved item used to be; link-only dropdowns go at the end.
const navItems = [];
{
  const placed = new Set();
  for (const a of autoNav) {
    const d = dropdowns.find((x) => x.captured.has(a.key));
    if (d) {
      if (!placed.has(d)) { placed.add(d); navItems.push({ dropdown: d }); }
      continue;
    }
    navItems.push(a);
  }
  for (const d of dropdowns) if (!placed.has(d)) navItems.push({ dropdown: d });
}

const CHEVRON =
  '<svg class="chev" viewBox="0 0 12 8" width="11" height="8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 1.5l5 5 5-5"/></svg>';

function navLink(n, current) {
  return `<a href="${esc(n.href)}"${n.cur && n.cur === current ? ' aria-current="page"' : ''}${n.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(n.label)}</a>`;
}
function navHtml(current) {
  return navItems
    .map((n) => {
      if (!n.dropdown) return navLink(n, current);
      const d = n.dropdown;
      const active = d.items.some((i) => i.cur && i.cur === current);
      return `<div class="has-sub${active ? ' active' : ''}">
        <button type="button" class="sub-toggle" aria-expanded="false">${esc(d.label)}${CHEVRON}</button>
        <ul class="sub">${d.items.map((i) => `<li>${navLink(i, current)}</li>`).join('')}</ul>
      </div>`;
    })
    .join('\n      ');
}

/* ---------- Layout ---------- */
const ICON_EYE =
  '<svg class="ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';

const viewsEl = (url) =>
  gc
    ? `<span class="views" data-views="${esc(url)}" hidden>${ICON_EYE}<span class="n"></span>&nbsp;<span class="u">views</span></span>`
    : '';

function layout({ title, description, image, body, current, urlPath, type, noindex }) {
  const fullTitle = title ? `${title} | ${site.title}` : `${site.title}: ${site.tagline}`;
  const desc = description || home.text;
  const canonical = baseUrl ? `${baseUrl}${urlPath || '/'}` : '';
  const shareImg = image || shareImage;
  const img = baseUrl && shareImg.startsWith('/') ? baseUrl + shareImg : shareImg;
  const icons = faviconSrc
    ? `<link rel="icon" href="${esc(faviconSrc)}">\n<link rel="apple-touch-icon" href="${esc(faviconSrc)}">`
    : `<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">`;
  const footerLinks = footerPages.map((p) => `<li><a href="/${p.slug}/">${esc(p.title)}</a></li>`).join('');
  const readLinks =
    CATEGORIES.map((c) => `<li><a href="/${c.slug}/">${esc(c.name)}</a></li>`).join('') +
    menuPages.map((p) => `<li><a href="/${p.slug}/">${esc(p.title)}</a></li>`).join('');
  const customFooterColumns = Array.isArray(footerSettings.columns) ? footerSettings.columns : [];
  const footerColumnHtml = customFooterColumns.length
    ? customFooterColumns.map((col) => {
        const links = (Array.isArray(col.links) ? col.links : []).map((item) => {
          const href = safeUrl(item && item.url);
          const label = str(item && item.label);
          if (!href || !label) return '';
          const external = isExternal(href) || (item && item.new_tab === true);
          return `<li><a href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(label)}</a></li>`;
        }).join('');
        return links ? `<nav aria-label="${esc(str(col.heading) || 'Footer links')}"><h2>${esc(str(col.heading) || 'Explore')}</h2><ul>${links}</ul></nav>` : '';
      }).join('')
    : `<nav aria-label="Read"><h2>Explore</h2><ul>${readLinks}</ul></nav>${footerLinks ? `<nav aria-label="Site information"><h2>Information</h2><ul>${footerLinks}</ul></nav>` : ''}`;
  const footerSocialHtml = (Array.isArray(footerSettings.social_links) ? footerSettings.social_links : []).map((item) => {
    const href = safeUrl(item && item.url);
    const label = str(item && item.label);
    if (!href || !label) return '';
    return `<li><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a></li>`;
  }).join('');
  const footerDescription = str(footerSettings.description) || site.tagline;
  const footerCopyright = (str(footerSettings.copyright) || '© {{year}} {{author}}. All rights reserved.')
    .replace(/\{\{year\}\}/g, String(new Date().getFullYear()))
    .replace(/\{\{author\}\}/g, site.author);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${hex(rawColors.header_bg) || '#05132A'}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${type || 'website'}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
${icons}
${baseUrl ? `<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="/feed.xml">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Inter:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<script>document.documentElement.classList.add('js');setTimeout(function(){if(!window.__erReady)document.documentElement.classList.add('no-anim')},3000)</script>
<link rel="stylesheet" href="/css/style.css">
${colorCss ? `<style>:root{${colorCss}}</style>` : ''}
${gc ? `<meta name="goatcounter" content="${gc}">\n<script data-goatcounter="https://${gc}.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>` : ''}
<script src="/js/main.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/"><img src="${esc(headerLogoSrc)}" alt="${esc(site.title)} home"></a>
    <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav"><span class="bars" aria-hidden="true"></span><span class="lbl">Menu</span></button>
    <nav class="nav" id="site-nav" aria-label="Main">
      ${navHtml(current)}
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="f-brand">
      ${footerSettings.show_logo === false ? '' : `<img src="${esc(logoSrc)}" alt="${esc(site.title)}">`}
      <p>${esc(footerDescription)}</p>
      ${footerSocialHtml ? `<ul class="footer-social" aria-label="Social links">${footerSocialHtml}</ul>` : ''}
    </div>
    ${footerColumnHtml}
  </div>
  <div class="wrap fine">${esc(footerCopyright)}</div>
</footer>
</body>
</html>`;
}

/* ---------- Components ---------- */
const catLink = (p) => (p.category ? `<a class="cat" href="/${p.category.slug}/">${esc(p.category.name)}</a>` : '');

function row(p) {
  return `<li class="post-row reveal${p.image ? ' has-image' : ''}">
  <div class="row-meta">${catLink(p)}<time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time></div>
  <div class="row-text">
    <h3><a href="${p.url}">${esc(p.title)}</a></h3>
    ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
    <div class="row-foot"><span>${p.minutes} min read</span>${viewsEl(p.url)}</div>
  </div>
  ${p.image ? `<a class="thumb" href="${p.url}" tabindex="-1" aria-hidden="true"><img src="${esc(p.image)}" alt="" loading="lazy"></a>` : ''}
</li>`;
}

const postList = (list) => `<ul class="post-list stagger">${list.map(row).join('\n')}</ul>`;

function featured(p) {
  return `<article class="featured reveal${p.image ? ' has-image' : ''}">
  ${p.image ? `<a class="f-img" href="${p.url}" tabindex="-1" aria-hidden="true"><img src="${esc(p.image)}" alt=""></a>` : ''}
  <div class="f-text">
    <div class="meta">${catLink(p)}<time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time><span>${p.minutes} min read</span>${viewsEl(p.url)}</div>
    <h2><a href="${p.url}">${esc(p.title)}</a></h2>
    ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
    <a class="read-more" href="${p.url}">Read this post</a>
  </div>
</article>`;
}

function related(post) {
  return posts
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      const shared = p.tags.filter((t) => post.tags.some((x) => x.slug === t.slug)).length;
      const sameCat = p.category && post.category && p.category.slug === post.category.slug ? 1 : 0;
      return { p, score: shared * 3 + sameCat * 2 };
    })
    .sort((a, b) => b.score - a.score || b.p.date - a.p.date)
    .slice(0, 3)
    .map((s) => s.p);
}

const pageHead = (title, sub) => `<header class="page-head wrap">
  <h1 class="reveal">${esc(title)}</h1>
  ${sub ? `<p class="reveal">${esc(sub)}</p>` : ''}
</header>`;

const emptyState = (text) => `<p class="empty reveal">${text}</p>`;

/* ---------- Section builder ---------- */
const SPACING = { none: 'sp-none', small: 'sp-sm', medium: 'sp-md', large: 'sp-lg' };

function shell(s, inner) {
  const st = s.style && typeof s.style === 'object' ? s.style : {};
  const bg = hex(st.bg);
  const fg = hex(st.fg);
  const img = safeUrl(st.bg_image);
  let ov = Number(st.overlay);
  if (!isFinite(ov) || st.overlay === '' || st.overlay == null) ov = 40;
  ov = clamp(ov, 0, 90) / 100;
  const sp = SPACING[str(st.spacing).toLowerCase()] || 'sp-md';
  const center = str(st.align).toLowerCase() === 'center' ? ' center' : '';
  // Colours are set as --bg / --ink on the section so everything inside it (buttons, lines, muted text) follows
  const vars = [bg ? `background:${bg};--bg:${bg}` : '', fg ? `color:${fg};--ink:${fg}` : '', img ? `--ov:${ov}` : '']
    .filter(Boolean)
    .join(';');
  return `<section class="blk blk-${esc(s.type)} ${sp}${center}${img ? ' has-img' : ''}"${vars ? ` style="${vars}"` : ''}>
${img ? `<img class="blk-bgimg" src="${esc(img)}" alt="" loading="lazy"><div class="blk-shade"></div>` : ''}
${inner}
</section>`;
}

function buttonsHtml(list) {
  const html = (Array.isArray(list) ? list : [])
    .map((b) => {
      const label = str(b && b.label);
      const link = safeUrl(b && b.link);
      if (!label || !link) return '';
      const bg = hex(b.bg);
      const fg = hex(b.fg);
      const outline = str(b.style).toLowerCase() === 'outline';
      const vars = [bg ? `--b-bg:${bg}` : '', fg ? `--b-fg:${fg}` : ''].filter(Boolean).join(';');
      const ext = isExternal(link) || b.new_tab === true;
      return `<a class="btn ${outline ? 'btn-outline' : 'btn-fill'}" href="${esc(link)}"${vars ? ` style="${vars}"` : ''}${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(label)}</a>`;
    })
    .join('');
  return html ? `<div class="btn-row">${html}</div>` : '';
}

const heading = (s, tag = 'h2') => (str(s.heading) ? `<${tag}>${esc(str(s.heading))}</${tag}>` : '');
const prose = (md) => (str(md) ? `<div class="prose">${marked.parse(String(md))}</div>` : '');

function videoEmbed(url) {
  const u = safeUrl(url);
  let m;
  if ((m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/)))
    return `<iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="Video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)))
    return `<iframe src="https://player.vimeo.com/video/${m[1]}" title="Video" loading="lazy" allow="picture-in-picture" allowfullscreen></iframe>`;
  if (/\.(mp4|webm)(\?.*)?$/i.test(u)) return `<video src="${esc(u)}" controls preload="metadata"></video>`;
  return '';
}

function latestBlock(s) {
  const title = str(s.title) || 'Latest writing';
  let count = parseInt(s.count, 10);
  if (!(count > 0)) count = 7;
  count = Math.min(count, 30);
  const cat = findCategory(s.category);
  const list = cat ? posts.filter((p) => p.category && p.category.slug === cat.slug) : posts;
  let inner = `<div class="wrap"><div class="section-head reveal"><h2 class="section-title">${esc(title)}</h2>${
    list.length > count ? `<a class="more" href="${cat ? `/${cat.slug}/` : '/writing/'}">All ${cat ? esc(cat.name) : 'writing'}</a>` : ''
  }</div>`;
  if (!list.length) {
    inner += emptyState(
      cat ? `Nothing here yet. Posts published in <strong>${esc(cat.name)}</strong> will appear here.` : 'Nothing published yet. Open <a href="/admin/">/admin</a> to write your first post.'
    );
  } else {
    const [first, ...rest] = list;
    inner += featured(first);
    const shown = rest.slice(0, count - 1);
    if (shown.length) inner += postList(shown);
  }
  return inner + '</div>';
}

function renderBlock(s) {
  if (!s || typeof s !== 'object') return '';
  const t = str(s.type);
  s.type = t;
  switch (t) {
    case 'text': {
      const wide = str(s.width).toLowerCase() === 'wide';
      return shell(s, `<div class="wrap"><div class="blk-in${wide ? ' wide' : ''} reveal">${heading(s)}${prose(s.body)}${buttonsHtml(s.buttons)}</div></div>`);
    }
    case 'image_text': {
      const img = safeUrl(s.image);
      if (!img) return '';
      const right = str(s.side).toLowerCase() === 'right';
      return shell(
        s,
        `<div class="wrap"><div class="split${right ? ' img-right' : ''} reveal"><div class="split-img"><img src="${esc(img)}" alt="${esc(str(s.alt))}" loading="lazy"></div><div class="split-text">${heading(s)}${prose(s.body)}${buttonsHtml(s.buttons)}</div></div></div>`
      );
    }
    case 'image': {
      const img = safeUrl(s.image);
      if (!img) return '';
      const full = str(s.size).toLowerCase().startsWith('full');
      const fig = `<figure class="pic reveal"><img src="${esc(img)}" alt="${esc(str(s.alt))}" loading="lazy">${str(s.caption) ? `<figcaption>${esc(str(s.caption))}</figcaption>` : ''}</figure>`;
      return shell(s, full ? `<div class="full">${fig}</div>` : `<div class="wrap">${fig}</div>`);
    }
    case 'buttons':
      return shell(s, `<div class="wrap"><div class="blk-in cta reveal">${heading(s)}${str(s.text) ? `<p class="lead">${esc(str(s.text))}</p>` : ''}${buttonsHtml(s.buttons)}</div></div>`);
    case 'gallery': {
      const items = (Array.isArray(s.images) ? s.images : [])
        .map((g) => ({ src: safeUrl(typeof g === 'string' ? g : g && g.image), cap: typeof g === 'object' && g ? str(g.caption) : '' }))
        .filter((g) => g.src);
      if (!items.length) return '';
      const cols = [2, 3, 4].includes(parseInt(s.columns, 10)) ? parseInt(s.columns, 10) : 3;
      return shell(
        s,
        `<div class="wrap">${heading(s)}<ul class="gallery cols-${cols} stagger">${items
          .map((g) => `<li class="reveal"><figure><img src="${esc(g.src)}" alt="${esc(g.cap)}" loading="lazy">${g.cap ? `<figcaption>${esc(g.cap)}</figcaption>` : ''}</figure></li>`)
          .join('')}</ul></div>`
      );
    }
    case 'cards': {
      const items = (Array.isArray(s.cards) ? s.cards : []).filter((item) => str(item && item.title));
      const columns = [2, 3, 4].includes(parseInt(s.columns, 10)) ? parseInt(s.columns, 10) : 2;
      const cards = items.map((item) => {
        const href = safeUrl(item.link);
        const image = safeUrl(item.image);
        const title = esc(str(item.title));
        const description = str(item.text);
        const linkText = esc(str(item.link_text) || 'Explore');
        const inner = `${image ? `<img class="content-card-img" src="${esc(image)}" alt="" loading="lazy">` : ''}<div class="content-card-body"><h3>${title}</h3>${description ? `<div class="content-card-copy">${marked.parse(description)}</div>` : ''}${href ? `<span class="content-card-link">${linkText} <span aria-hidden="true">→</span></span>` : ''}</div>`;
        return href ? `<a class="content-card" href="${esc(href)}">${inner}</a>` : `<article class="content-card">${inner}</article>`;
      }).join('');
      return shell(s, `<div class="wrap"><div class="cards-intro">${heading(s)}${prose(s.body)}</div><div class="content-card-grid cols-${columns}">${cards}</div></div>`);
    }
    case 'video': {
      const v = videoEmbed(s.url);
      if (!v) { console.warn(`Warning: video link "${str(s.url)}" is not a YouTube, Vimeo or .mp4 address, skipped.`); return ''; }
      return shell(s, `<div class="wrap"><div class="blk-in wide reveal">${heading(s)}<div class="video">${v}</div>${str(s.caption) ? `<p class="cap">${esc(str(s.caption))}</p>` : ''}</div></div>`);
    }
    case 'quote':
      if (!str(s.text)) return '';
      return shell(s, `<div class="wrap"><blockquote class="big-quote reveal"><p>${esc(str(s.text)).replace(/\n/g, '<br>')}</p>${str(s.source) ? `<footer>${esc(str(s.source))}</footer>` : ''}</blockquote></div>`);
    case 'latest_posts':
      return shell(s, latestBlock(s));
    case 'html':
      return str(s.code) ? shell(s, `<div class="wrap"><div class="blk-in wide custom">${String(s.code)}</div></div>`) : '';
    default:
      if (t) console.warn(`Warning: unknown section type "${t}" skipped.`);
      return '';
  }
}
const renderSections = (list) => (Array.isArray(list) ? list.map(renderBlock).join('\n') : '');

/* ---------- Build ---------- */
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
if (fs.existsSync(path.join(root, 'static'))) fs.cpSync(path.join(root, 'static'), out, { recursive: true });

// Files uploaded to the top level of the repo are placed where the site needs them.
const rootAssets = {
  'style.css': 'css/style.css',
  'main.js': 'js/main.js',
  'admin-config.yml': 'admin/config.yml',
  'favicon.ico': 'favicon.ico',
  'favicon-32.png': 'favicon-32.png',
  'apple-touch-icon.png': 'apple-touch-icon.png',
  'logo.png': 'img/logo.png',
  'og-default.png': 'img/og-default.png',
};
for (const [src, dest] of Object.entries(rootAssets)) {
  const from = path.join(root, src);
  if (fs.existsSync(from)) {
    const to = path.join(out, dest);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

/* Home */
const heroWords = home.heading
  .split(/\s+/)
  .filter(Boolean)
  .map((w, i) => `<span class="w" style="--i:${i}">${esc(w)}</span>`)
  .join(' ');

const doors = CATEGORIES.slice(0, 5)
  .map((c, i) => {
    const n = posts.filter((p) => p.category && p.category.slug === c.slug).length;
    return `<li class="door" style="--i:${i}"><a href="/${c.slug}/">
      <span class="name">${esc(c.name)}</span>
      <span class="count">${n === 0 ? 'Coming soon' : plural(n, 'post', 'posts')}</span>
      ${c.blurb ? `<span class="blurb">${esc(c.blurb)}</span>` : ''}
    </a></li>`;
  })
  .join('\n');

const latest = posts[0];
const b1 = { text: home.btn1Text || (latest ? 'Read the latest post' : ''), href: home.btn1Link || (latest ? latest.url : '') };
const b2 = { text: home.btn2Text || (CATEGORIES[0] ? CATEGORIES[0].name : ''), href: home.btn2Link || (CATEGORIES[0] ? `/${CATEGORIES[0].slug}/` : '') };
const heroImages = home.images.length
  ? `<div class="hero-bg" aria-hidden="true" data-count="${home.images.length}">${home.images
      .map((src, i) => `<img src="${esc(src)}" alt=""${i === 0 ? ' class="on" fetchpriority="high"' : ' loading="lazy"'}>`)
      .join('')}</div><div class="hero-shade"></div>`
  : '';
const showDoors = home.showCategories && CATEGORIES.length > 0;
const [sr, sg, sb] = hexToRgb(home.heroBg || '#05132a');
const heroVars = [
  home.heroBg ? `--hero-bg:${home.heroBg}` : '',
  home.heroFg ? `--hero-fg:${home.heroFg}` : '',
  `--overlay:${home.overlay}`,
  `--shade:rgb(${sr} ${sg} ${sb} / ${home.overlay})`,
]
  .filter(Boolean)
  .join(';');

const homeSections = home.sections === null ? [{ type: 'latest_posts', title: home.latestTitle, count: 7 }] : home.sections;

const homeBody = `<section class="hero${home.images.length ? ' has-bg' : ''}" style="${heroVars}">
  ${heroImages}
  <div class="wrap hero-inner${showDoors ? ' with-doors' : ''}">
    <div class="hero-copy">
      <h1>${heroWords}</h1>
      <svg class="swoosh" viewBox="0 0 320 28" fill="none" aria-hidden="true"><path d="M3 21C70 5 190 1 317 13" stroke="currentColor" stroke-width="5" stroke-linecap="round" pathLength="1"/></svg>
      <p class="hero-text">${esc(home.text)}</p>
      <div class="hero-actions">
        ${b1.text && b1.href ? `<a class="btn btn-primary" href="${esc(b1.href)}">${esc(b1.text)}</a>` : ''}
        ${b2.text && b2.href ? `<a class="btn btn-ghost" href="${esc(b2.href)}">${esc(b2.text)}</a>` : ''}
      </div>
    </div>
    ${showDoors ? `<ul class="doors">\n${doors}\n    </ul>` : ''}
  </div>
</section>
${renderSections(homeSections)}`;
write('index.html', layout({ body: homeBody, current: 'home', urlPath: '/' }));

/* All writing */
if (posts.length) {
  write('writing/index.html', layout({
    title: 'All writing',
    description: 'Every post on ' + site.title,
    urlPath: '/writing/',
    body: `${pageHead('All writing', plural(posts.length, 'post', 'posts'))}<div class="wrap section">${postList(posts)}</div>`,
  }));
}

/* Category pages */
for (const c of CATEGORIES) {
  const list = posts.filter((p) => p.category && p.category.slug === c.slug);
  write(`${c.slug}/index.html`, layout({
    title: c.name,
    description: c.blurb,
    current: c.slug,
    urlPath: `/${c.slug}/`,
    body: `${pageHead(c.name, c.blurb)}<div class="wrap section">${
      list.length
        ? postList(list)
        : emptyState(`Nothing here yet. Posts published with the category <strong>${esc(c.name)}</strong> will appear on this page.`)
    }</div>`,
  }));
}

/* Tag pages */
const tagMap = new Map();
for (const p of posts) for (const t of p.tags) {
  if (!tagMap.has(t.slug)) tagMap.set(t.slug, { name: t.name, posts: [] });
  tagMap.get(t.slug).posts.push(p);
}
for (const [slug, t] of tagMap) {
  write(`tags/${slug}/index.html`, layout({
    title: `#${t.name}`,
    description: `Posts tagged ${t.name}`,
    urlPath: `/tags/${slug}/`,
    body: `${pageHead(`#${t.name}`, plural(t.posts.length, 'post', 'posts'))}<div class="wrap section">${postList(t.posts)}</div>`,
  }));
}

/* Post pages */
for (const p of posts) {
  const pageUrl = baseUrl ? baseUrl + p.url : '';
  const enc = encodeURIComponent;
  const shareLinks = [
    ['whatsapp', 'WhatsApp', `https://wa.me/?text=${enc(p.title + ' ' + pageUrl)}`],
    ['x', 'X', `https://twitter.com/intent/tweet?text=${enc(p.title)}&url=${enc(pageUrl)}`],
    ['facebook', 'Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(pageUrl)}`],
  ]
    .map(([k, label, href]) => `<a data-share="${k}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`)
    .join('');
  const rel = related(p);
  const body = `<article>
  <div class="article">
    <header class="article-head">
      <div class="meta reveal">${catLink(p)}<time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time><span>${p.minutes} min read</span>${viewsEl(p.url)}</div>
      <h1 class="reveal">${esc(p.title)}</h1>
      ${p.summary ? `<p class="standfirst reveal">${esc(p.summary)}</p>` : ''}
    </header>
  </div>
  ${p.image ? `<figure class="hero-img reveal"><img src="${esc(p.image)}" alt=""></figure>` : ''}
  <div class="article">
    <div class="prose reveal">${marked.parse(p.content)}</div>
    ${p.tags.length ? `<ul class="tags reveal" aria-label="Tags">${p.tags.map((t) => `<li><a href="/tags/${t.slug}/">#${esc(t.name)}</a></li>`).join('')}</ul>` : ''}
    <div class="share reveal"><span>Share this post</span>${shareLinks}<button type="button" data-copy>Copy link</button></div>
  </div>
  ${rel.length ? `<section class="related"><div class="wrap"><h2 class="section-title reveal">Keep reading</h2>${postList(rel)}</div></section>` : ''}
</article>`;
  write(`posts/${p.slug}/index.html`, layout({
    title: p.title,
    description: p.summary,
    image: p.image,
    body,
    current: p.category ? p.category.slug : '',
    urlPath: p.url,
    type: 'article',
  }));
}

/* Pages (About, anything added in the admin, privacy, copyright) */
for (const pg of livePages) {
  const hasBody = str(pg.content) !== '';
  const showHead = pg.showTitle || hasBody;
  const head = `${pg.showTitle ? `<header class="article-head"><h1 class="reveal">${esc(pg.title)}</h1></header>` : ''}${hasBody ? `<div class="prose reveal">${marked.parse(pg.content)}</div>` : ''}`;
  write(`${pg.slug}/index.html`, layout({
    title: pg.title,
    urlPath: `/${pg.slug}/`,
    current: pg.slug,
    body: `${showHead ? `<article class="wrap page-text"><div class="article">${head}</div></article>` : ''}
${renderSections(pg.sections)}`,
  }));
}

/* 404 */
write('404.html', layout({
  title: 'Page not found',
  noindex: true,
  body: `<div class="wrap"><div class="article"><header class="article-head"><h1>Page not found</h1><p class="standfirst">That link does not lead anywhere. <a href="/">Go to the home page</a>.</p></header></div></div>`,
}));

/* RSS feed, sitemap, robots (only when the website address is set) */
if (baseUrl) {
  const items = posts
    .map(
      (p) => `<item>
<title>${esc(p.title)}</title>
<link>${baseUrl}${p.url}</link>
<guid>${baseUrl}${p.url}</guid>
<pubDate>${validDate(p.date) ? p.date.toUTCString() : ''}</pubDate>
${p.category ? `<category>${esc(p.category.name)}</category>` : ''}
<description>${esc(p.summary)}</description>
</item>`
    )
    .join('\n');
  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(site.title)}</title>
<link>${baseUrl}</link>
<description>${esc(site.tagline)}</description>
${items}
</channel></rss>`);

  const urls = [
    '/',
    ...CATEGORIES.map((c) => `/${c.slug}/`),
    ...livePages.filter((p) => p.placement !== 'hidden').map((p) => `/${p.slug}/`),
    ...posts.map((p) => p.url),
  ];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${baseUrl}${u}</loc></url>`).join('\n')}
</urlset>`);
  write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${baseUrl}/sitemap.xml\n`);
}

console.log(`Built ${posts.length} post(s), ${livePages.length} page(s), ${CATEGORIES.length} categor${CATEGORIES.length === 1 ? 'y' : 'ies'}, ${dropdowns.length} dropdown(s), ${tagMap.size} tag page(s) into dist/`);
