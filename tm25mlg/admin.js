// Admin page: every material with its state, in one place. Changes stay on
// the page until Salvează sends them all at once, so one save costs one
// build. Romanian UI, no dependencies besides window.Visibility.
(function () {
  'use strict';

  var V = window.Visibility;
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  var KIND = {
    lectie: 'Lecție',
    teorie: 'Teorie',
    'fisa-lucru': 'Fișă de lucru',
    'fisa-recapitulativa': 'Fișă recapitulativă',
    test: 'Test',
    joc: 'Joc',
    quiz: 'Quiz',
  };
  var POLL_EVERY = 20000;
  var POLL_FOR = 5 * 60 * 1000;

  var listEl = document.getElementById('admin-list');
  var searchEl = document.getElementById('admin-search');
  var filterEl = document.getElementById('admin-filter');
  var saveEl = document.getElementById('admin-save');
  var statusEl = document.getElementById('admin-status');

  // uid -> { state, visibleFrom }. The last saved state, from the API.
  var originals = new Map();
  // uid -> { slug, title, kind, grade, topicTitle } for rendering and search.
  var metas = new Map();
  var pollTimer = null;
  // True when the list came from the local source file instead of the API:
  // the local preview has no Functions, so saving stays disabled there.
  var localMode = false;

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function gradeName(grade) {
    return `Clasa a ${ROMAN[grade]}-a`;
  }

  function chipText(state, visibleFrom) {
    if (state === 'hidden') return 'Ascuns';
    if (state === 'scheduled') return `Programat: ${V.formatRoTime(visibleFrom)}`;
    return 'Vizibil';
  }

  function status(text) {
    statusEl.textContent = text;
  }

  function rowOf(uid) {
    return listEl.querySelector(`.admin-row[data-uid="${uid}"]`);
  }

  // What the row controls say now: a set date means scheduled, otherwise the
  // checkbox decides between visible and hidden.
  function desired(uid) {
    var row = rowOf(uid);
    var when = row.querySelector('[data-when]').value.trim();
    if (when) {
      var iso = V.wallToVisibleFrom(when);
      if (!iso) return { error: 'Data nu este un moment real din România. Verifică ziua și ora.' };
      return { state: 'scheduled', visibleFrom: iso };
    }
    return row.querySelector('[data-visible]').checked ? { state: 'visible' } : { state: 'hidden' };
  }

  function collectChanges() {
    var changes = [];
    var errors = [];
    originals.forEach(function (orig, uid) {
      var found = desired(uid);
      if (found.error) {
        errors.push(found.error);
        return;
      }
      var was = orig.visibleFrom || null;
      var now = found.visibleFrom || null;
      if (found.state !== orig.state || now !== was) {
        var change = { uid, state: found.state };
        if (found.visibleFrom) change.visibleFrom = found.visibleFrom;
        changes.push(change);
      }
    });
    return { changes, errors };
  }

  function showRowErrors(bad) {
    originals.forEach(function (_orig, uid) {
      var row = rowOf(uid);
      if (!row) return;
      var note = row.querySelector('[data-row-error]');
      var found = bad ? desired(uid) : null;
      if (found && found.error) {
        note.textContent = found.error;
        note.hidden = false;
      } else {
        note.textContent = '';
        note.hidden = true;
      }
    });
  }

  function refreshSave() {
    var found = collectChanges();
    showRowErrors(found.errors.length > 0);
    if (found.errors.length) {
      saveEl.disabled = true;
      saveEl.textContent = 'Salvează';
      return;
    }
    var n = found.changes.length;
    saveEl.disabled = n === 0;
    saveEl.textContent = n === 0 ? 'Salvează' : `Salvează (${n} modificări)`;
  }

  function applyView() {
    var q = norm(searchEl.value);
    var only = selectedFilter();
    listEl.querySelectorAll('.admin-row').forEach(function (row) {
      var hitQ = !q || norm(row.getAttribute('data-search')).includes(q);
      var hitF = !only || row.getAttribute('data-state') === only;
      row.hidden = !(hitQ && hitF);
    });
    listEl.querySelectorAll('[data-topic]').forEach(function (section) {
      var any = Array.from(section.querySelectorAll('.admin-row')).some((r) => !r.hidden);
      section.hidden = !any;
    });
    listEl.querySelectorAll('details.grade').forEach(function (block) {
      var any = Array.from(block.querySelectorAll('.admin-row')).some((r) => !r.hidden);
      block.hidden = !any;
    });
  }

  function selectedFilter() {
    var active = filterEl.querySelector('[aria-pressed="true"]');
    return active ? active.getAttribute('data-filter') : '';
  }

  function rowHtml(uid, meta, orig) {
    var chip = chipText(orig.state, orig.visibleFrom);
    var when = orig.state === 'scheduled' ? V.visibleFromToInput(orig.visibleFrom) : '';
    var open = orig.state === 'visible'
      ? `<a href="../materiale/${meta.slug}-${uid}.html" target="_blank" rel="noopener">Deschide</a>`
      : '';
    var search = `${meta.title} ${uid} ${meta.topicTitle} ${gradeName(meta.grade)} ${KIND[meta.kind] || meta.kind}`;
    return `<div class="admin-row" data-uid="${uid}" data-state="${orig.state}" data-search="${esc(search)}">`
      + `<div class="row-top"><span class="row-title">${esc(meta.title)}</span>`
      + `<span class="badge">${esc(KIND[meta.kind] || meta.kind)}</span>`
      + `<span class="state state-${orig.state}">${esc(chip)}</span>`
      + `<span class="row-uid">cod ${uid}</span>${open}</div>`
      + `<div class="row-controls"><label><input type="checkbox" data-visible${orig.state === 'visible' ? ' checked' : ''}> Vizibil</label>`
      + `<label>Afișează de la <input type="datetime-local" step="60" data-when value="${esc(when)}"></label>`
      + `<button class="chip" type="button" data-clear>Șterge data</button></div>`
      + `<p class="note" data-row-error hidden></p></div>`;
  }

  function render(data) {
    var topics = new Map((data.topics || []).map((t) => [t.id, t]));
    originals = new Map();
    metas = new Map();
    (data.materials || []).forEach(function (m) {
      var topic = topics.get(m.topic);
      if (!topic) return;
      originals.set(m.uid, {
        state: V.stateOf(m),
        visibleFrom: m.visibleFrom || null,
      });
      metas.set(m.uid, {
        slug: m.slug,
        title: (m.title && m.title.ro) || m.slug,
        kind: m.kind,
        grade: topic.grade,
        topicTitle: (topic.title && topic.title.ro) || m.topic,
        published: m.published || '',
      });
    });
    var byGrade = new Map();
    metas.forEach(function (meta, uid) {
      if (!byGrade.has(meta.grade)) byGrade.set(meta.grade, []);
      byGrade.get(meta.grade).push(uid);
    });
    var grades = Array.from(byGrade.keys()).sort((a, b) => a - b);
    var html = '';
    var first = true;
    grades.forEach(function (grade) {
      var uids = byGrade.get(grade).sort((a, b) => {
        var pa = metas.get(a).published;
        var pb = metas.get(b).published;
        if (pa === pb) return Number(b) - Number(a);
        return pa < pb ? 1 : -1;
      });
      var byTopic = new Map();
      uids.forEach(function (uid) {
        var meta = metas.get(uid);
        if (!byTopic.has(meta.topicTitle)) byTopic.set(meta.topicTitle, []);
        byTopic.get(meta.topicTitle).push(uid);
      });
      html += `<details class="grade"${first ? ' open' : ''}><summary><h2>${esc(gradeName(grade))}</h2></summary>`;
      first = false;
      byTopic.forEach(function (topicUids, topicTitle) {
        html += `<section data-topic><h3>${esc(topicTitle)}</h3>`;
        topicUids.forEach(function (uid) {
          html += rowHtml(uid, metas.get(uid), originals.get(uid));
        });
        html += '</section>';
      });
      html += '</details>';
    });
    listEl.innerHTML = html || '<p class="message">Niciun material.</p>';
    listEl.querySelectorAll('.admin-row').forEach(function (row) {
      row.querySelector('[data-visible]').addEventListener('change', refreshSave);
      row.querySelector('[data-when]').addEventListener('change', refreshSave);
      row.querySelector('[data-when]').addEventListener('input', refreshSave);
      row.querySelector('[data-clear]').addEventListener('click', function () {
        row.querySelector('[data-when]').value = '';
        refreshSave();
      });
    });
    refreshSave();
    applyView();
  }

  async function fetchJson(url) {
    var res;
    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch (e) {
      return null;
    }
    if (!res.ok) return null;
    try {
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function load() {
    status('Se încarcă lista…');
    // The API runs on Cloudflare Functions, so the local preview has none:
    // fall back to the source file on disk, read-only.
    var data = await fetchJson('api/materials');
    localMode = !data;
    if (!data) data = await fetchJson('../data/materials.source.json');
    if (!data) {
      status('Lista nu s-a încărcat. Verifică conexiunea și reîncarcă pagina.');
      return;
    }
    render(data);
    status(localMode
      ? 'Previzualizare locală: lista se vede, dar salvarea funcționează doar pe site.'
      : 'Alege ce se vede, apoi apasă Salvează.');
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  async function poll(changes, start) {
    var res;
    try {
      res = await fetch('api/materials', { cache: 'no-store' });
    } catch (e) {
      res = null;
    }
    if (res && res.ok) {
      var data = await res.json();
      var byUid = new Map((data.materials || []).map((m) => [m.uid, m]));
      var done = changes.every(function (c) {
        var m = byUid.get(c.uid);
        if (!m) return false;
        if (V.stateOf(m) !== c.state) return false;
        if (c.state === 'scheduled' && m.visibleFrom !== c.visibleFrom) return false;
        return true;
      });
      if (done) {
        render(data);
        status('Gata: modificările sunt în date. Site-ul se actualizează în aproximativ un minut.');
        return;
      }
    }
    if (Date.now() - start > POLL_FOR) {
      status('Modificările nu au apărut încă. Verifică GitHub Actions.');
      refreshSave();
      return;
    }
    pollTimer = setTimeout(function () {
      poll(changes, start);
    }, POLL_EVERY);
  }

  async function save() {
    if (localMode) {
      status('Salvarea funcționează doar pe site, nu în previzualizarea locală.');
      return;
    }
    var found = collectChanges();
    if (found.errors.length) {
      status(found.errors[0]);
      return;
    }
    if (!found.changes.length) return;
    stopPolling();
    saveEl.disabled = true;
    status('Se salvează…');
    var res;
    try {
      res = await fetch('api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: found.changes }),
      });
    } catch (e) {
      status('Salvarea nu a pornit. Verifică conexiunea și încearcă din nou.');
      refreshSave();
      return;
    }
    if (res.status !== 202) {
      status(`Salvarea nu a pornit (eroare ${res.status}). Încearcă din nou.`);
      refreshSave();
      return;
    }
    status('Salvat. Se așteaptă publicarea…');
    poll(found.changes, Date.now());
  }

  searchEl.addEventListener('input', applyView);
  filterEl.querySelectorAll('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterEl.querySelectorAll('[data-filter]').forEach(function (other) {
        other.setAttribute('aria-pressed', String(other === btn));
      });
      applyView();
    });
  });
  saveEl.addEventListener('click', save);
  load();
})();
