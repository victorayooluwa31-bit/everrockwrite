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

/* ---------- Settings (site.json, home.json, categories.json) ---------- */
const rawSite = readJSON('site.json');
const rawHome = readJSON('home.json');
const rawCats = readJSON('categories.json');

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

// Home page
const imgList = Array.isArray(rawHome.hero_images) ? rawHome.hero_images : [];
let overlay = Number(rawHome.hero_overlay);
if (!isFinite(overlay) || rawHome.hero_overlay === '' || rawHome.hero_overlay == null) overlay = 60;
overlay = Math.min(90, Math.max(0, overlay)) / 100;
const home = {
  heading: str(rawHome.hero_heading) || str(rawSite.hero_heading) || 'Words with purpose.',
  text:
    str(rawHome.hero_text) ||
    str(rawSite.hero_text) ||
    'Reflections from the Word, poems, and stories drawn from life and imagination.',
  images: imgList.map((x) => (typeof x === 'string' ? x : x && x.image ? x.image : '')).map(str).filter(Boolean),
  overlay,
  btn1Text: str(rawHome.button_1_text),
  btn1Link: str(rawHome.button_1_link),
  btn2Text: str(rawHome.button_2_text),
  btn2Link: str(rawHome.button_2_link),
  showCategories: rawHome.show_categories !== false,
  latestTitle: str(rawHome.latest_title) || 'Latest writing',
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
      content,
    });
  }
}
// Privacy and copyright pages kept at the top level of the repo
for (const [file, slug] of [['privacy.md', 'privacy'], ['copyright.md', 'copyright']]) {
  const p = path.join(root, file);
  if (!fs.existsSync(p) || pages.some((x) => x.slug === slug)) continue;
  const { data, content } = matter(fs.readFileSync(p, 'utf8'));
  pages.push({ slug, title: str(data.title) || slug, placement: 'footer', order: 100, content });
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

/* ---------- Posts ---------- */
const postsDir = path.join(root, 'content', 'posts');
const posts = (fs.existsSync(postsDir) ? fs.readdirSync(postsDir) : [])
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { data, content } = matter(fs.readFileSync(path.join(postsDir, f), 'utf8'));
    const slug = f.replace(/\.md$/, '');
    const catKey = str(data.category).toLowerCase();
    const category = CATEGORIES.find((c) => c.name.toLowerCase() === catKey || c.slug === slugify(catKey)) || null;
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

/* ---------- Layout ---------- */
const ICON_EYE =
  '<svg class="ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';

const viewsEl = (url) =>
  gc
    ? `<span class="views" data-views="${esc(url)}" hidden>${ICON_EYE}<span class="n"></span>&nbsp;<span class="u">views</span></span>`
    : '';

const navItems = [
  { key: 'home', href: '/', label: 'Home' },
  ...CATEGORIES.map((c) => ({ key: c.slug, href: `/${c.slug}/`, label: c.name })),
  ...menuPages.map((p) => ({ key: p.slug, href: `/${p.slug}/`, label: p.title })),
];

function layout({ title, description, image, body, current, urlPath, type, noindex }) {
  const fullTitle = title ? `${title} | ${site.title}` : `${site.title}: ${site.tagline}`;
  const desc = description || home.text;
  const canonical = baseUrl ? `${baseUrl}${urlPath || '/'}` : '';
  const shareImg = image || shareImage;
  const img = baseUrl && shareImg.startsWith('/') ? baseUrl + shareImg : shareImg;
  const nav = navItems
    .map((n) => `<a href="${esc(n.href)}"${n.key === current ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`)
    .join('\n      ');
  const icons = faviconSrc
    ? `<link rel="icon" href="${esc(faviconSrc)}">\n<link rel="apple-touch-icon" href="${esc(faviconSrc)}">`
    : `<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">`;
  const footerLinks = footerPages.map((p) => `<li><a href="/${p.slug}/">${esc(p.title)}</a></li>`).join('');
  const readLinks =
    CATEGORIES.map((c) => `<li><a href="/${c.slug}/">${esc(c.name)}</a></li>`).join('') +
    menuPages.map((p) => `<li><a href="/${p.slug}/">${esc(p.title)}</a></li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#05132A">
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
${gc ? `<meta name="goatcounter" content="${gc}">\n<script data-goatcounter="https://${gc}.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>` : ''}
<script src="/js/main.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/"><img src="${esc(headerLogoSrc)}" alt="${esc(site.title)} home"></a>
    <nav class="nav" aria-label="Main">
      ${nav}
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="f-brand">
      <img src="${esc(logoSrc)}" alt="${esc(site.title)}">
      <p>${esc(site.tagline)}</p>
    </div>
    <nav aria-label="Pages">
      <h2>Read</h2>
      <ul>${readLinks}</ul>
    </nav>
    ${footerLinks ? `<nav aria-label="Site information"><h2>Site</h2><ul>${footerLinks}</ul></nav>` : ''}
  </div>
  <div class="wrap fine">&copy; ${new Date().getFullYear()} ${esc(site.author)}. All rights reserved.</div>
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
const b1 = {
  text: home.btn1Text || (latest ? 'Read the latest post' : ''),
  href: home.btn1Link || (latest ? latest.url : ''),
};
const b2 = {
  text: home.btn2Text || (CATEGORIES[0] ? CATEGORIES[0].name : ''),
  href: home.btn2Link || (CATEGORIES[0] ? `/${CATEGORIES[0].slug}/` : ''),
};
const heroImages = home.images.length
  ? `<div class="hero-bg" aria-hidden="true" data-count="${home.images.length}">${home.images
      .map((src, i) => `<img src="${esc(src)}" alt=""${i === 0 ? ' class="on" fetchpriority="high"' : ' loading="lazy"'}>`)
      .join('')}</div><div class="hero-shade"></div>`
  : '';
const showDoors = home.showCategories && CATEGORIES.length > 0;

let homeBody = `<section class="hero${home.images.length ? ' has-bg' : ''}" style="--overlay:${home.overlay}">
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
<div class="wrap section">`;

if (posts.length === 0) {
  homeBody += `<h2 class="section-title reveal">${esc(home.latestTitle)}</h2>${emptyState('Nothing published yet. Open <a href="/admin/">/admin</a> to write your first post.')}`;
} else {
  const [first, ...rest] = posts;
  homeBody += `<div class="section-head reveal"><h2 class="section-title">${esc(home.latestTitle)}</h2>${posts.length > 7 ? '<a class="more" href="/writing/">All writing</a>' : ''}</div>
${featured(first)}`;
  const shown = rest.slice(0, 6);
  if (shown.length) homeBody += postList(shown);
  if (posts.length > 7) homeBody += `<p class="all-link reveal"><a class="btn btn-solid" href="/writing/">See all ${posts.length} posts</a></p>`;
}
homeBody += `</div>`;
write('index.html', layout({ body: homeBody, current: 'home', urlPath: '/' }));

/* All writing */
if (posts.length > 7) {
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
  write(`${pg.slug}/index.html`, layout({
    title: pg.title,
    urlPath: `/${pg.slug}/`,
    current: pg.slug,
    body: `<article class="wrap">
  <div class="article">
    <header class="article-head"><h1 class="reveal">${esc(pg.title)}</h1></header>
    <div class="prose reveal">${marked.parse(pg.content)}</div>
  </div>
</article>`,
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

console.log(`Built ${posts.length} post(s), ${livePages.length} page(s), ${CATEGORIES.length} categor${CATEGORIES.length === 1 ? 'y' : 'ies'}, ${tagMap.size} tag page(s) into dist/`);
