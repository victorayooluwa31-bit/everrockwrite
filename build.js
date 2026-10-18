const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

marked.setOptions({ breaks: true });

const root = __dirname;
const out = path.join(root, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(root, 'site.json'), 'utf8'));
const baseUrl = (site.url || '').replace(/\/+$/, '');

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const readingTime = (text) => Math.max(1, Math.round(text.split(/\s+/).length / 220));

function write(rel, html) {
  const file = path.join(out, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function layout({ title, description, image, body, current, urlPath }) {
  const fullTitle = title ? `${title} | ${site.title}` : site.title;
  const desc = description || site.tagline;
  const canonical = baseUrl ? `${baseUrl}${urlPath || '/'}` : '';
  const img = image ? (baseUrl && image.startsWith('/') ? baseUrl + image : image) : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${image ? 'article' : 'website'}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ''}
${baseUrl ? `<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="/feed.xml">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div class="wrap">
  <header class="site-header">
    <a class="brand" href="/">${esc(site.title)}</a>
    <nav class="nav" aria-label="Main">
      <a href="/"${current === 'home' ? ' aria-current="page"' : ''}>Writing</a>
      <a href="/about/"${current === 'about' ? ' aria-current="page"' : ''}>About</a>
    </nav>
  </header>
</div>
<main>
${body}
</main>
<div class="wrap">
  <footer class="site-footer">
    <span>&copy; ${new Date().getFullYear()} ${esc(site.author || site.title)}</span>
    ${baseUrl ? '<a href="/feed.xml">RSS feed</a>' : ''}
  </footer>
</div>
</body>
</html>`;
}

// Load posts
const postsDir = path.join(root, 'content', 'posts');
const posts = fs
  .readdirSync(postsDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { data, content } = matter(fs.readFileSync(path.join(postsDir, f), 'utf8'));
    return {
      slug: f.replace(/\.md$/, ''),
      title: data.title || 'Untitled',
      date: data.date ? new Date(data.date) : new Date(0),
      summary: data.summary || '',
      image: data.image || '',
      draft: data.draft === true,
      content,
    };
  })
  .filter((p) => !p.draft)
  .sort((a, b) => b.date - a.date);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(root, 'static'), out, { recursive: true });

// Home
function row(p) {
  return `<li class="post-row${p.image ? ' has-image' : ''}">
  <div class="meta">${fmtDate(p.date)}</div>
  <div class="row-text">
    <h3><a href="/posts/${esc(p.slug)}/">${esc(p.title)}</a></h3>
    ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
  </div>
  ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : ''}
</li>`;
}

let homeBody = `<div class="wrap">
  <section class="masthead">
    <h1>${esc(site.title)}</h1>
    <p>${esc(site.tagline)}</p>
  </section>`;

if (posts.length === 0) {
  homeBody += `<p class="empty">No posts yet. Go to <a href="/admin/">/admin</a> to write your first one.</p>`;
} else {
  const [first, ...rest] = posts;
  homeBody += `<article class="featured${first.image ? ' has-image' : ''}">
    ${first.image ? `<a href="/posts/${esc(first.slug)}/"><img src="${esc(first.image)}" alt=""></a>` : ''}
    <div>
      <div class="meta">${fmtDate(first.date)} &middot; ${readingTime(first.content)} min read</div>
      <h2><a href="/posts/${esc(first.slug)}/">${esc(first.title)}</a></h2>
      ${first.summary ? `<p>${esc(first.summary)}</p>` : ''}
    </div>
  </article>`;
  if (rest.length) homeBody += `<ul class="post-list">${rest.map(row).join('\n')}</ul>`;
}
homeBody += `</div>`;
write('index.html', layout({ body: homeBody, current: 'home', urlPath: '/' }));

// Posts
for (const p of posts) {
  const body = `<article class="wrap">
  <header class="article-head">
    <div class="meta">${fmtDate(p.date)} &middot; ${readingTime(p.content)} min read</div>
    <h1>${esc(p.title)}</h1>
    ${p.summary ? `<p class="standfirst">${esc(p.summary)}</p>` : ''}
  </header>
  ${p.image ? `<figure class="hero"><img src="${esc(p.image)}" alt=""></figure>` : ''}
  <div class="prose">${marked.parse(p.content)}</div>
  <p class="back"><a href="/">Back to all writing</a></p>
</article>`;
  write(`posts/${p.slug}/index.html`, layout({
    title: p.title, description: p.summary, image: p.image, body, urlPath: `/posts/${p.slug}/`,
  }));
}

// About
const about = matter(fs.readFileSync(path.join(root, 'content', 'pages', 'about.md'), 'utf8'));
write('about/index.html', layout({
  title: about.data.title || 'About',
  current: 'about',
  urlPath: '/about/',
  body: `<article class="wrap">
  <header class="article-head"><h1>${esc(about.data.title || 'About')}</h1></header>
  <div class="prose">${marked.parse(about.content)}</div>
</article>`,
}));

// 404
write('404.html', layout({
  title: 'Page not found',
  body: `<div class="wrap article-head"><h1>Page not found</h1><p class="standfirst">That link doesn't lead anywhere. <a href="/">Go to the home page</a>.</p></div>`,
}));

// RSS (only when site.url is set)
if (baseUrl) {
  const items = posts.map((p) => `<item>
<title>${esc(p.title)}</title>
<link>${baseUrl}/posts/${esc(p.slug)}/</link>
<guid>${baseUrl}/posts/${esc(p.slug)}/</guid>
<pubDate>${p.date.toUTCString()}</pubDate>
<description>${esc(p.summary)}</description>
</item>`).join('\n');
  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(site.title)}</title>
<link>${baseUrl}</link>
<description>${esc(site.tagline)}</description>
${items}
</channel></rss>`);
}

console.log(`Built ${posts.length} post(s) into dist/`);
