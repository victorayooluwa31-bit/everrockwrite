window.__erReady = true;

(function () {
  var d = document;

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
