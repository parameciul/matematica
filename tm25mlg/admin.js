// Admin page: every material with its state, in one place. Changes stay on
// the page until Salvează sends them all at once, so one save costs one
// build. Romanian UI. The state and Romania-time rules live in the DOM-free
// window.Visibility (assets/js/visibility.js); the list reuses the site's
// labels and styles through window.Site and window.Catalog.
(function () {
  'use strict';

  var V = window.Visibility;
  var POLL_EVERY = 20000;
  var POLL_FOR = 5 * 60 * 1000;

  // The API sits in this page's folder (<folder>/api/). The URL is built from
  // the path, so "/tm25mlg" without its trailing slash still reaches it.
  var PAGE_DIR = location.pathname.replace(/\/index\.html$/, '').replace(/\/?$/, '/');
  var API = PAGE_DIR + 'api/';
  // The local preview (python -m http.server) has no Functions: the list then
  // comes read-only from the source file on disk.
  var IS_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var LOCAL_SOURCE = PAGE_DIR + '../data/materials.source.json';

  var listEl = document.getElementById('admin-list');
  var searchEl = document.getElementById('admin-search');
  var filterEl = document.getElementById('admin-filter');
  var gradeFilterEl = document.getElementById('admin-grade-filter');
  var countEl = document.getElementById('admin-count');
  var saveEl = document.getElementById('admin-save');
  var resetEl = document.getElementById('admin-reset');
  var statusEl = document.getElementById('admin-status');

  // uid -> { m, topic, order, orig: { state, visibleFrom }, checked, when }.
  // orig is the last saved state; checked and when are what the row says now.
  // order is the position in data/materials.source.json, the last tie-break.
  var rows = new Map();
  var readOnly = false;
  var busy = false;
  var pollTimer = null;

  function esc(s) {
    return window.Shell.escapeHtml(s == null ? '' : s);
  }

  function status(text, kind) {
    statusEl.textContent = text;
    if (kind) statusEl.setAttribute('data-kind', kind);
    else statusEl.removeAttribute('data-kind');
  }

  function stateLabel(s) {
    if (s.state === 'hidden') return 'Ascuns';
    if (s.state === 'scheduled') return `Programat: ${V.formatRoTime(s.visibleFrom)}`;
    return 'Vizibil';
  }

  // "1 modificare", "5 modificări", "20 de modificări": the site's plural rule.
  function changesLabel(n) {
    return window.Site.plural(n, 'changes');
  }

  function wanted(row) {
    return V.rowChange(row.checked, row.when, row.orig);
  }

  function isDirty(row) {
    var found = wanted(row);
    return !found.error && !V.isSameState(found, row.orig);
  }

  function pendingChanges() {
    var changes = [];
    var errors = 0;
    rows.forEach(function (row, uid) {
      var found = wanted(row);
      if (found.error) {
        errors += 1;
        return;
      }
      if (V.isSameState(found, row.orig)) return;
      var change = { uid: uid, state: found.state };
      if (found.visibleFrom) change.visibleFrom = found.visibleFrom;
      changes.push(change);
    });
    return { changes: changes, errors: errors };
  }

  // --- Rendering -----------------------------------------------------------

  function searchText(row) {
    var m = row.m;
    return window.Catalog.normalize([
      m.title && m.title.ro, m.title && m.title.en, m.slug, m.uid,
      row.topic.title && row.topic.title.ro, window.Site.gradeName(row.topic.grade),
      window.Site.kindLabel(m.kind), stateLabel(row.orig),
      m.results ? 'rezultate' : '',
    ].join(' '));
  }

  function rowHtml(uid, row) {
    var m = row.m;
    var group = window.Catalog.groupOf(m.kind);
    var title = (m.title && m.title.ro) || m.slug;
    // Only a visible material has a page to open: the others 302 to their grade page.
    var titleHtml = row.orig.state === 'visible'
      ? `<a class="m-title" href="${esc(window.Site.materialUrl(m))}" target="_blank" rel="noopener">${esc(title)}</a>`
      : `<span class="m-title">${esc(title)}</span>`;
    var resultsHtml = m.results
      ? `<span class="admin-results"><span class="badge badge-fise">Rezultate: ${esc(String(m.results.checks))}</span> <a href="rezultate.html?uid=${esc(uid)}">Vezi rezultatele</a></span>`
      : '';
    return `<li class="m-row admin-row" data-uid="${esc(uid)}">`
      + '<div class="admin-item">'
      + `<span class="m-badges"><span class="m-grade m-grade-${esc(group)}">${esc(window.Catalog.ROMAN[row.topic.grade])}</span><span class="badge badge-${esc(group)}">${esc(window.Site.kindLabel(m.kind))}</span></span>`
      + '<div class="admin-main">'
      + titleHtml
      + '<span class="m-meta">'
      + `<span class="admin-state" data-state="${esc(row.orig.state)}">${esc(stateLabel(row.orig))}</span>`
      + '<span class="admin-next" data-next hidden></span>'
      + `<span class="admin-where">${esc(window.Site.gradeName(row.topic.grade))}</span>`
      + `<span class="admin-where">${esc((row.topic.title && row.topic.title.ro) || row.topic.id)}</span>`
      + `<span>cod ${esc(uid)}</span>`
      + `<time class="m-date" datetime="${esc(m.published)}">${esc(window.Site.formatDate(m.published))}</time>`
      + resultsHtml
      + '</span>'
      + '</div>'
      + '<div class="admin-controls">'
      + `<label class="admin-check"><input type="checkbox" data-visible${row.checked ? ' checked' : ''}> Vizibil</label>`
      + '<div class="admin-when">'
      + `<label for="when-${esc(uid)}">Apare singur la</label>`
      // The date and its clear button stay on one line.
      + '<span class="admin-when-field">'
      + `<input id="when-${esc(uid)}" type="datetime-local" step="60" data-when value="${esc(row.when)}">`
      + `<button class="chip" type="button" data-clear${row.when ? '' : ' disabled'}>Șterge data</button>`
      + '</span>'
      + '</div>'
      + '</div>'
      + '<p class="admin-row-note" data-row-note hidden></p>'
      + '</div>'
      + '</li>';
  }

  // One flat list, newest first. The grade and the topic ride on each row,
  // because there are no headings any more. The search and both filters pick
  // rows by the SAVED state, so a row never vanishes while it is being edited.
  function renderList() {
    var q = window.Catalog.normalize(searchEl.value.trim());
    var filters = { state: selectedFilter(), grade: selectedGrade() };
    var picked = [];
    rows.forEach(function (row, uid) {
      var test = { state: row.orig.state, grade: row.topic.grade, hasResults: !!row.m.results };
      if (!V.adminMatches(test, filters)) return;
      if (q && !searchText(row).includes(q)) return;
      picked.push(uid);
    });
    picked.sort(function (a, b) {
      var ra = rows.get(a);
      var rb = rows.get(b);
      var x = V.adminSortKey({ published: ra.m.published, grade: ra.topic.grade, order: ra.order });
      var y = V.adminSortKey({ published: rb.m.published, grade: rb.topic.grade, order: rb.order });
      for (var i = 0; i < x.length; i += 1) {
        if (x[i] !== y[i]) return x[i] - y[i];
      }
      return 0;
    });
    var html = picked.map(function (uid) {
      return rowHtml(uid, rows.get(uid));
    }).join('');
    listEl.innerHTML = html
      ? `<ul class="material-list">${html}</ul>`
      : '<p class="message">Niciun material nu se potrivește.</p>';
    listEl.removeAttribute('aria-busy');
    countEl.textContent = picked.length ? window.Site.plural(picked.length, 'count') : '';
    rows.forEach(function (_row, uid) {
      refreshRow(uid);
    });
    refreshSave();
  }

  function selectedFilter() {
    var active = filterEl.querySelector('[aria-pressed="true"]');
    return active ? active.getAttribute('data-filter') : '';
  }

  function selectedGrade() {
    var active = gradeFilterEl.querySelector('[aria-pressed="true"]');
    var value = active ? active.getAttribute('data-grade') : '';
    return value ? Number(value) : null;
  }

  function rowEl(uid) {
    return listEl.querySelector(`.admin-row[data-uid="${uid}"]`);
  }

  // The pending state and the note of one row, updated in place so the
  // control keeps its focus.
  function refreshRow(uid) {
    var el = rowEl(uid);
    if (!el) return;
    var row = rows.get(uid);
    var found = wanted(row);
    var next = el.querySelector('[data-next]');
    var note = el.querySelector('[data-row-note]');
    var dirty = isDirty(row);
    // Always there, so the rows keep one layout; usable only with a date.
    el.querySelector('[data-clear]').disabled = busy || !row.when;
    if (dirty) el.setAttribute('data-dirty', '');
    else el.removeAttribute('data-dirty');
    next.hidden = !dirty;
    next.textContent = dirty ? `→ ${stateLabel(found)}` : '';
    note.hidden = true;
    note.removeAttribute('data-kind');
    if (found.error) {
      note.textContent = found.error;
      note.setAttribute('data-kind', 'error');
      note.hidden = false;
    } else if (dirty && found.state === 'scheduled' && V.visibleFromMs(found.visibleFrom) <= Date.now()) {
      note.textContent = 'Ora a trecut deja: materialul apare imediat după salvare.';
      note.hidden = false;
    }
  }

  function refreshSave() {
    var found = pendingChanges();
    var n = found.changes.length;
    saveEl.textContent = n ? `Salvează (${changesLabel(n)})` : 'Salvează';
    saveEl.disabled = busy || readOnly || n === 0 || found.errors > 0;
    resetEl.hidden = busy || (n === 0 && found.errors === 0);
    if (busy) return;
    if (found.errors) status('Un rând are o oră care nu există. Corectează-l ca să poți salva.', 'error');
    else if (readOnly) status('Previzualizare locală: poți încerca butoanele, dar salvarea merge doar pe site.');
    else if (n) status('Modificările nu sunt salvate încă.');
    else status('Totul este salvat.');
  }

  // --- Row controls --------------------------------------------------------

  function onRowInput(event) {
    var target = event.target;
    var el = target.closest('.admin-row');
    if (!el || busy) return;
    var uid = el.getAttribute('data-uid');
    var row = rows.get(uid);
    var box = el.querySelector('[data-visible]');
    var when = el.querySelector('[data-when]');
    if (target === box) {
      // Visible now wins over a date: the material shows at the next save.
      row.checked = box.checked;
      if (box.checked) {
        row.when = '';
        when.value = '';
      }
    } else if (target === when) {
      row.when = when.value;
      // A date means "hidden until then".
      if (row.when) {
        row.checked = false;
        box.checked = false;
      }
    } else {
      return;
    }
    refreshRow(uid);
    refreshSave();
  }

  function onRowClick(event) {
    var btn = event.target.closest('[data-clear]');
    if (!btn || busy) return;
    var el = btn.closest('.admin-row');
    var uid = el.getAttribute('data-uid');
    var row = rows.get(uid);
    row.when = '';
    el.querySelector('[data-when]').value = '';
    // Without a date, a visible material stays visible and any other one stays hidden.
    row.checked = row.orig.state === 'visible';
    el.querySelector('[data-visible]').checked = row.checked;
    refreshRow(uid);
    refreshSave();
  }

  // --- Data ----------------------------------------------------------------

  function setData(data) {
    var topics = new Map((data.topics || []).map(function (t) { return [t.id, t]; }));
    rows = new Map();
    var order = 0;
    (data.materials || []).forEach(function (m) {
      var topic = topics.get(m.topic);
      if (!topic) return;
      var orig = { state: V.stateOf(m), visibleFrom: m.visibleFrom || null };
      rows.set(m.uid, {
        m: m,
        topic: topic,
        order: order++,
        orig: orig,
        checked: orig.state === 'visible',
        when: orig.state === 'scheduled' ? V.visibleFromToInput(orig.visibleFrom) : '',
      });
    });
  }

  // fetch with the Access session in mind: an expired session answers with a
  // redirect to the Access login, which a script cannot follow.
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

  function callError(r, action) {
    if (r.expired) return 'Autentificarea a expirat. Reîncarcă pagina și cere un cod nou.';
    if (r.network) return `${action}: nu există conexiune. Verifică internetul și încearcă din nou.`;
    // The API answers errors in plain text; an HTML page (a 404) says nothing useful.
    var detail = r.text && r.text.trim().charAt(0) !== '<' ? ` (${r.text.trim().slice(0, 200)})` : '';
    // A 403 is also a setup problem ("Access is not configured"): the reason
    // tells it apart from a wrong account.
    if (r.status === 403) return `${action}: acces refuzat${detail}. Reîncarcă pagina și autentifică-te cu adresa de administrator.`;
    return `${action}: serverul a răspuns ${r.status}${detail}.`;
  }

  function parse(text) {
    try {
      var data = JSON.parse(text);
      return data && Array.isArray(data.materials) ? data : null;
    } catch (e) {
      return null;
    }
  }

  async function load() {
    status('Se încarcă lista…');
    var r = await call(API + 'materials');
    var data = r.ok ? parse(r.text) : null;
    // Only a missing API (404) means the local preview; any other error is shown.
    if (!data && IS_LOCAL && r.status === 404) {
      var local = await call(LOCAL_SOURCE);
      data = local.ok ? parse(local.text) : null;
      readOnly = !!data;
    }
    if (!data) {
      listEl.removeAttribute('aria-busy');
      listEl.innerHTML = '<p class="message">Lista nu s-a încărcat.</p>';
      status(r.ok ? 'Lista nu s-a încărcat: datele primite nu sunt valide.' : callError(r, 'Lista nu s-a încărcat'), 'error');
      return;
    }
    setData(data);
    renderList();
  }

  function setBusy(on) {
    busy = on;
    if (on) listEl.setAttribute('inert', '');
    else listEl.removeAttribute('inert');
    listEl.querySelectorAll('input, button').forEach(function (control) {
      control.disabled = on;
    });
    if (!on) {
      rows.forEach(function (_row, uid) {
        refreshRow(uid);
      });
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  // After a save, the data branch is read again every 20 seconds for up to 5
  // minutes, until every change is in it.
  async function poll(changes, start) {
    var r = await call(API + 'materials');
    var data = r.ok ? parse(r.text) : null;
    if (data) {
      var byUid = new Map(data.materials.map(function (m) { return [m.uid, m]; }));
      var now = Date.now();
      var landed = changes.every(function (c) {
        return V.changeLanded(c, byUid.get(c.uid), now);
      });
      if (landed) {
        setBusy(false);
        setData(data);
        renderList();
        status('Gata: modificările sunt salvate. Site-ul se actualizează în aproximativ un minut.');
        return;
      }
    } else if (r.expired) {
      setBusy(false);
      refreshSave();
      status(callError(r, 'Verificarea'), 'error');
      return;
    }
    if (Date.now() - start > POLL_FOR) {
      setBusy(false);
      refreshSave();
      status('Modificările nu au apărut după 5 minute. Verifică GitHub Actions (material-visibility), apoi reîncarcă pagina.', 'error');
      return;
    }
    pollTimer = setTimeout(function () {
      poll(changes, start);
    }, POLL_EVERY);
  }

  async function save() {
    if (readOnly) {
      status('Salvarea merge doar pe site, nu în previzualizarea locală.', 'error');
      return;
    }
    var found = pendingChanges();
    if (found.errors || !found.changes.length || busy) return;
    stopPolling();
    setBusy(true);
    refreshSave();
    status('Se salvează…');
    var r = await call(API + 'save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: found.changes }),
    });
    if (r.status !== 202) {
      setBusy(false);
      refreshSave();
      status(callError(r, 'Salvarea nu a pornit'), 'error');
      return;
    }
    status('Salvat. Se publică modificările (1-3 minute)…');
    poll(found.changes, Date.now());
  }

  function reset() {
    rows.forEach(function (row) {
      row.checked = row.orig.state === 'visible';
      row.when = row.orig.state === 'scheduled' ? V.visibleFromToInput(row.orig.visibleFrom) : '';
    });
    renderList();
  }

  // --- Wiring --------------------------------------------------------------

  document.getElementById('admin-search-form').addEventListener('submit', function (event) {
    event.preventDefault();
  });
  searchEl.addEventListener('input', renderList);
  filterEl.querySelectorAll('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterEl.querySelectorAll('[data-filter]').forEach(function (other) {
        other.setAttribute('aria-pressed', String(other === btn));
      });
      renderList();
    });
  });
  gradeFilterEl.querySelectorAll('[data-grade]').forEach(function (btn) {
    var n = btn.getAttribute('data-grade');
    // The chip shows the numeral; screen readers get the full grade name,
    // exactly like the grade links in the site header.
    if (n) btn.setAttribute('aria-label', window.Site.gradeName(Number(n)));
    btn.addEventListener('click', function () {
      gradeFilterEl.querySelectorAll('[data-grade]').forEach(function (other) {
        other.setAttribute('aria-pressed', String(other === btn));
      });
      renderList();
    });
  });
  listEl.addEventListener('change', onRowInput);
  listEl.addEventListener('input', onRowInput);
  listEl.addEventListener('click', onRowClick);
  saveEl.addEventListener('click', save);
  resetEl.addEventListener('click', reset);
  // Unsaved changes live only on this page: ask before leaving it.
  window.addEventListener('beforeunload', function (event) {
    if (!busy && pendingChanges().changes.length) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  load();
})();
