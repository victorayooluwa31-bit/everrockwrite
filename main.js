window.__erReady = true;

(function () {
  var d = document;

  /* ---- Mailchimp newsletter popup ---- */
  var newsletterModal = d.getElementById('newsletter-modal');
  var newsletterForm = d.getElementById('newsletter-form');
  if (newsletterModal) {
    var newsletterKey = 'er_newsletter_signup_done_v1';
    var newsletterDismissKey = 'er_newsletter_popup_dismissed_v1';
    var showNewsletter = function () {
      try {
        if (localStorage.getItem(newsletterKey) || localStorage.getItem(newsletterDismissKey)) return;
      } catch (e) {}
      newsletterModal.classList.add('is-visible');
      newsletterModal.setAttribute('aria-hidden', 'false');
      var emailField = d.getElementById('newsletter-email');
      if (emailField) emailField.focus();
    };
    var closeNewsletter = function () {
      newsletterModal.classList.remove('is-visible');
      newsletterModal.setAttribute('aria-hidden', 'true');
      try { localStorage.setItem(newsletterDismissKey, '1'); } catch (e) {}
    };
    window.setTimeout(showNewsletter, 9000);
    newsletterModal.querySelectorAll('[data-newsletter-close]').forEach(function (el) {
      el.addEventListener('click', closeNewsletter);
    });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && newsletterModal.classList.contains('is-visible')) closeNewsletter();
    });
    if (newsletterForm) {
      newsletterForm.addEventListener('submit', function () {
        try { localStorage.setItem(newsletterKey, '1'); } catch (e) {}
      });
    }
  }

  /* ---- Scroll reveal ---- */
  var groups = d.querySelectorAll('.stagger');
  for (var g = 0; g < groups.length; g++) {
    var kids = groups[g].children;
    for (var k = 0; k < kids.length; k++) {
      kids[k].style.setProperty('--d', Math.min(k, 5) * 80 + 'ms');
    }
  }
  var els = d.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    for (var i = 0; i < els.length; i++) els[i].classList.add('in');
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
    );
    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  }



  /* ---- Navigation: mobile menu and dropdowns ---- */
  var toggle = d.querySelector('.nav-toggle');
  var nav = d.getElementById('site-nav');
  var subs = d.querySelectorAll('.has-sub');
  function closeSubs(except) {
    for (var q = 0; q < subs.length; q++) {
      if (subs[q] === except) continue;
      subs[q].classList.remove('open');
      var b = subs[q].querySelector('.sub-toggle');
      if (b) b.setAttribute('aria-expanded', 'false');
    }
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var o = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', o ? 'true' : 'false');
    });
  }
  for (var n = 0; n < subs.length; n++) {
    (function (sub) {
      var btn = sub.querySelector('.sub-toggle');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var opening = !sub.classList.contains('open');
        closeSubs(opening ? sub : null);
        sub.classList.toggle('open', opening);
        btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
      });
      sub.addEventListener('focusout', function (e) {
        if (!sub.contains(e.relatedTarget)) {
          sub.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    })(subs[n]);
  }
  d.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.has-sub')) closeSubs(null);
  });
  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openSub = d.querySelector('.has-sub.open');
    closeSubs(null);
    if (openSub) { var b2 = openSub.querySelector('.sub-toggle'); if (b2) b2.focus(); }
    else if (toggle && nav && nav.classList.contains('open')) { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
  });

  /* ---- Search page ---- */
  var searchForm = d.querySelector('.site-search');
  var searchInput = d.getElementById('site-search-input');
  var searchResults = d.getElementById('search-results');
  var searchStatus = d.getElementById('search-status');
  if (searchForm && searchInput && searchResults) {
    var params = new URLSearchParams(location.search);
    var initialQuery = params.get('q') || '';
    searchInput.value = initialQuery;
    var runSearch = function (query) {
      var q = query.trim().toLocaleLowerCase();
      if (!q) { searchResults.innerHTML = ''; searchStatus.textContent = 'Enter a title or keyword to search.'; return; }
      searchStatus.textContent = 'Searching…';
      fetch('/search-index.json').then(function (r) { if (!r.ok) throw new Error('Search index unavailable'); return r.json(); })
        .then(function (items) {
          var terms = q.split(/\\s+/).filter(Boolean);
          var matches = items.map(function (item) {
            var hay = (item.title + ' ' + item.summary + ' ' + item.category + ' ' + item.text).toLocaleLowerCase();
            var score = terms.reduce(function (n, term) { return n + (hay.indexOf(term) >= 0 ? 1 : 0); }, 0);
            return { item: item, score: score };
          }).filter(function (x) { return x.score > 0; }).sort(function (a,b) { return b.score-a.score || (b.item.date||'').localeCompare(a.item.date||''); });
          searchStatus.textContent = matches.length ? matches.length + (matches.length === 1 ? ' result found.' : ' results found.') : 'No matching writing found. Try another keyword.';
          searchResults.innerHTML = matches.map(function (x) {
            var item=x.item;
            return '<article class="search-result"><div class="search-result-meta">' + [item.category,item.date].filter(Boolean).join(' · ') + '</div><h2><a href="' + item.url + '">' + escapeHtml(item.title) + '</a></h2>' + (item.summary ? '<p>' + escapeHtml(item.summary) + '</p>' : '') + '</article>';
          }).join('');
        }).catch(function () { searchStatus.textContent = 'Search is temporarily unavailable. Please try again later.'; });
    };
    function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
    searchForm.addEventListener('submit', function (e) { e.preventDefault(); var q=searchInput.value.trim(); history.replaceState(null,'','/search/' + (q ? '?q='+encodeURIComponent(q) : '')); runSearch(q); });
    if (initialQuery) runSearch(initialQuery); else searchStatus.textContent='Enter a title or keyword to search.';
  }

  /* ---- Hero background slideshow (only when more than one image) ---- */
  var heroImgs = d.querySelectorAll('.hero-bg img');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (heroImgs.length > 1 && !reduce) {
    var cur = 0;
    setInterval(function () {
      heroImgs[cur].classList.remove('on');
      cur = (cur + 1) % heroImgs.length;
      var next = heroImgs[cur];
      if (next.loading === 'lazy') next.loading = 'eager';
      next.classList.add('on');
    }, 6500);
  }

  /* ---- Editorial card carousel ---- */
  var carousels = d.querySelectorAll('[data-cards-carousel]');
  for (var ci = 0; ci < carousels.length; ci++) {
    (function (wrap) {
      var track = wrap.querySelector('.content-card-grid');
      var prev = wrap.querySelector('.carousel-arrow.prev');
      var next = wrap.querySelector('.carousel-arrow.next');
      if (!track || !prev || !next) return;
      var step = function () { var card = track.querySelector('.content-card'); return card ? card.getBoundingClientRect().width + 20 : track.clientWidth * .8; };
      prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
      next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    })(carousels[ci]);
  }

  /* ---- View counts (GoatCounter) ---- */
  var meta = d.querySelector('meta[name="goatcounter"]');
  var code = meta && meta.getAttribute('content');
  if (code && window.fetch) {
    var counters = d.querySelectorAll('[data-views]');
    for (var c = 0; c < counters.length; c++) {
      (function (el) {
        var p = el.getAttribute('data-views');
        fetch('https://' + code + '.goatcounter.com/counter/' + encodeURIComponent(p) + '.json')
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (!data || !data.count) return;
            el.querySelector('.n').textContent = data.count;
            el.querySelector('.u').textContent = String(data.count) === '1' ? 'view' : 'views';
            el.hidden = false;
          })
          .catch(function () {});
      })(counters[c]);
    }
  }

  /* ---- Share links use the address the reader is actually on ---- */
  var url = location.href.split('#')[0];
  var title = d.querySelector('h1') ? d.querySelector('h1').textContent : d.title;
  var enc = encodeURIComponent;
  var targets = {
    whatsapp: 'https://wa.me/?text=' + enc(title + ' ' + url),
    x: 'https://twitter.com/intent/tweet?text=' + enc(title) + '&url=' + enc(url),
    facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + enc(url)
  };
  var links = d.querySelectorAll('[data-share]');
  for (var s = 0; s < links.length; s++) {
    var t = targets[links[s].getAttribute('data-share')];
    if (t) links[s].href = t;
  }

  /* ---- Copy link ---- */
  var btn = d.querySelector('[data-copy]');
  if (btn) {
    btn.addEventListener('click', function () {
      var done = function () {
        btn.textContent = 'Link copied';
        setTimeout(function () { btn.textContent = 'Copy link'; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link:', url); });
      } else {
        window.prompt('Copy this link:', url);
      }
    });
  }
})();
