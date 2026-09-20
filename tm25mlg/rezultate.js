// Results page: one material's table of results plus its full answer key.
// Read-only: fixes go through `node tools/results.mjs open` and `save`.
// Romanian UI, like the admin list. Opened from the list as
// rezultate.html?uid=<uid>.
(function () {
  'use strict';

  // Same addressing as the admin list: the API sits in this page's folder,
  // the static files next to it. The local preview (python -m http.server)
  // has no Functions: the material then comes read-only from the source file.
  var PAGE_DIR = location.pathname.replace(/\/rezultate\.html$/, '').replace(/\/?$/, '/');
  var API = PAGE_DIR + 'api/';
  var IS_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var LOCAL_SOURCE = PAGE_DIR + '../data/materials.source.json';

  var KIND_LABEL = {
    number: 'număr',
    list: 'listă',
    set: 'mulțime',
    interval: 'interval',
    text: 'text',
    choice: 'alegere',
    truefalse: 'adevărat/fals',
  };

  var titleEl = document.getElementById('results-title');
  var metaEl = document.getElementById('results-meta');
  var wrapEl = document.getElementById('results-table-wrap');
  var rowsEl = document.getElementById('results-rows');
  var keyTitleEl = document.getElementById('results-key-title');
  var keyEl = document.getElementById('results-key');

  function esc(s) {
    return window.Shell.escapeHtml(s == null ? '' : s);
  }

  function checkLabel(item) {
    if (!item || item.check === false) {
      if (item && item.why === 'proof') return 'Nu: demonstrație';
      if (item && item.why === 'open') return 'Nu: răspuns deschis';
      return 'Nu: de verificat';
    }
    return 'Da: ' + (KIND_LABEL[item.kind] || item.kind);
  }

  // "1", "2", … "10", "6a", "6b": numbers first, then the letter.
  function keyOrder(keys) {
    const parts = (k) => {
      const m = /^(\d+)([a-z])?$/.exec(k);
      return m ? [Number(m[1]), m[2] || ''] : [1e9, k];
    };
    return keys.slice().sort((a, b) => {
      const x = parts(a);
      const y = parts(b);
      return x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0);
    });
  }

  async function call(url, opts) {
    var res;
    try {
      res = await fetch(url, Object.assign({ cache: 'no-store', redirect: 'manual', credentials: 'same-origin' }, opts || {}));
    } catch (e) {
      return { network: true };
    }
    if (res.type === 'opaqueredirect' || res.status === 0) return { expired: true };
    var text = '';
    try {
      text = await res.text();
    } catch (e) {
      text = '';
    }
    return { status: res.status, ok: res.ok, text: text };
  }

  function parseSource(text) {
    try {
      var data = JSON.parse(text);
      return data && Array.isArray(data.materials) ? data : null;
    } catch (e) {
      return null;
    }
  }

  function fail(message) {
    metaEl.textContent = message;
  }

  async function load() {
    var uid = new URLSearchParams(location.search).get('uid');
    if (!uid) {
      fail('Lipsește codul materialului (?uid=…). Deschide pagina din lista de materiale.');
      return;
    }
    var r = await call(API + 'materials');
    var data = r.ok ? parseSource(r.text) : null;
    if (!data && IS_LOCAL && r.status === 404) {
      var local = await call(LOCAL_SOURCE);
      data = local.ok ? parseSource(local.text) : null;
    }
    if (!data) {
      fail('Lista nu s-a încărcat. Verifică internetul și reîncarcă pagina.');
      return;
    }
    var material = (data.materials || []).find(function (m) { return m.uid === uid; });
    if (!material) {
      fail('Materialul nu a fost găsit.');
      return;
    }
    var topic = (data.topics || []).find(function (t) { return t.id === material.topic; });
    if (!material.results) {
      titleEl.textContent = (material.title && material.title.ro) || material.slug;
      fail('Acest material nu are rezultate.');
      return;
    }
    var name = `${material.slug}-${material.uid}`;
    titleEl.textContent = (material.title && material.title.ro) || name;
    metaEl.textContent = '';
    var grade = topic ? window.Site.gradeName(topic.grade) : '';
    var back = document.createElement('a');
    back.href = window.Site.materialUrl(material);
    back.target = '_blank';
    back.rel = 'noopener';
    back.textContent = 'Deschide pagina materialului';
    metaEl.append(grade ? `${grade} · ` : '', back, ` · versiunea ${material.results.version} · ${material.results.checks} verificări`);
    var saved = await call(PAGE_DIR + `../data/results/${name}.json`);
    if (!saved.ok) {
      fail('Rezultatele nu s-au încărcat. Verifică internetul și reîncarcă pagina.');
      return;
    }
    var results = null;
    try {
      results = JSON.parse(saved.text);
    } catch (e) {
      results = null;
    }
    if (!results || !results.items) {
      fail('Rezultatele primite nu sunt valide.');
      return;
    }
    rowsEl.textContent = '';
    keyOrder(Object.keys(results.items)).forEach(function (key) {
      var item = results.items[key];
      var tr = document.createElement('tr');
      if (item && item.check === false && item.why === 'review') tr.className = 'rev-row';
      var num = document.createElement('th');
      num.scope = 'row';
      num.textContent = key;
      var show = document.createElement('td');
      // show is teacher-written committed data, like an article: it holds
      // $…$ math and &lt; entities, so it goes in raw (esc() would show "&lt;").
      show.innerHTML = item && item.show ? item.show : '';
      var check = document.createElement('td');
      check.textContent = checkLabel(item);
      if (item && item.check === false && item.why === 'review' && item.note) {
        check.appendChild(document.createElement('br'));
        var note = document.createElement('span');
        note.className = 'rev-note';
        note.textContent = item.note;
        check.appendChild(note);
      }
      tr.append(num, show, check);
      rowsEl.appendChild(tr);
    });
    wrapEl.hidden = false;
    window.Site.renderMath(wrapEl);
    var key = await call(PAGE_DIR + `raspunsuri/${name}.html`);
    if (key.ok) {
      keyEl.innerHTML = key.text;
      keyEl.hidden = false;
      keyTitleEl.hidden = false;
      window.Site.renderMath(keyEl);
    }
  }

  load();
})();
