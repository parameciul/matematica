// Result checking on material pages: one exercise at a time, green or red.
// The buttons are added here, so without JavaScript the page is the same as
// before. The results file loads on the first press, never before. Student
// answers stay in localStorage on this device only; the popup never shows
// the right answer.
(function () {
  'use strict';

  if (!window.Answers) return;
  const main = document.getElementById('material');
  if (!main) return;
  const uid = main.getAttribute('data-id');
  const name = main.getAttribute('data-name');
  const version = main.getAttribute('data-results');
  if (!uid || !name || !version) return;

  const root = document.body.getAttribute('data-root') || '';
  const storeKey = `matematica.checks.${uid}`;
  const STORE_PREFIX = 'matematica.checks.';
  const SYMBOLS = ['√', 'π', '∞', '∪', '∅', ';', '{', '}', '[', ']', '(', ')'];

  let items = null; // the loaded results, null until the first press
  let opener = null;

  function loadSaved() {
    try {
      const raw = window.localStorage.getItem(storeKey);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved || String(saved.v) !== version || !saved.items) return null;
      return saved.items;
    } catch (e) {
      return null;
    }
  }

  function storeAll(value) {
    try {
      if (value) window.localStorage.setItem(storeKey, JSON.stringify(value));
      else window.localStorage.removeItem(storeKey);
    } catch (e) {
      // Storage can be blocked (private mode); the check still works.
    }
  }

  function remember(key, entry) {
    const saved = loadSaved() || {};
    saved[key] = entry;
    storeAll({ v: version, items: saved });
    refreshReset();
  }

  function keyLabel(key) {
    const m = /^(\d+)([a-z])?$/.exec(key);
    if (!m) return key;
    return m[2] ? `${m[1]} ${m[2]})` : m[1];
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // --- Page marks -----------------------------------------------------------

  function clearMark(box) {
    box.querySelectorAll('.check-chip').forEach((n) => n.remove());
    box.querySelectorAll('.check-ok, .check-bad').forEach((n) => n.classList.remove('check-ok', 'check-bad'));
  }

  function markChoice(box, index, ok) {
    clearMark(box);
    const options = choiceOptions(box);
    if (options[index]) options[index].classList.add(ok ? 'check-ok' : 'check-bad');
  }

  function markText(box, answer, ok, btn) {
    clearMark(box);
    const chip = el('span', `badge check-chip ${ok ? 'badge-fise' : 'badge-teste'}`, `${answer} ${ok ? '✓' : '✗'}`);
    btn.after(chip);
  }

  function choiceOptions(box) {
    const list = box.matches('ul.choices') ? box : box.querySelector('ul.choices');
    return list ? Array.from(list.querySelectorAll('li')) : [];
  }

  function applySaved() {
    const saved = loadSaved();
    if (!saved) return;
    main.querySelectorAll('[data-ex]').forEach((box) => {
      const key = box.getAttribute('data-ex');
      const entry = saved[key];
      if (!entry) return;
      const btn = box.querySelector('.check-btn');
      if (entry.pick !== undefined) markChoice(box, entry.pick, entry.ok);
      else if (entry.a !== undefined && btn) markText(box, entry.a, entry.ok, btn);
    });
    refreshReset();
  }

  function refreshReset() {
    const reset = document.getElementById('check-reset');
    if (!reset) return;
    const saved = loadSaved();
    reset.hidden = !saved || Object.keys(saved).length === 0;
  }

  // --- Popup ----------------------------------------------------------------

  let dialog = null;
  let verdict = null;
  let body = null;
  let titleEl = null;

  function ensureDialog() {
    if (dialog) return;
    dialog = el('dialog', 'check-dialog');
    titleEl = el('h2', 'check-title');
    titleEl.id = 'check-title';
    dialog.setAttribute('aria-labelledby', 'check-title');
    body = el('div', 'check-body');
    verdict = el('p', 'check-verdict');
    verdict.setAttribute('aria-live', 'polite');
    const row = el('div', 'check-row');
    const submit = el('button', 'button check-submit', t('check.submit'));
    submit.type = 'button';
    const cancel = el('button', 'chip check-cancel', t('check.cancel'));
    cancel.type = 'button';
    cancel.addEventListener('click', () => dialog.close());
    row.appendChild(submit);
    row.appendChild(cancel);
    dialog.appendChild(titleEl);
    dialog.appendChild(body);
    dialog.appendChild(verdict);
    dialog.appendChild(row);
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      if (opener && opener.isConnected) opener.focus();
      opener = null;
    });
    submit.addEventListener('click', onSubmit);
  }

  function say(text, kind) {
    verdict.textContent = text;
    verdict.setAttribute('data-kind', kind);
  }

  function openFor(box, key) {
    ensureDialog();
    opener = box.querySelector('.check-btn');
    titleEl.textContent = t('check.exercise').replace('{key}', keyLabel(key));
    body.textContent = '';
    say('', 'none');
    dialog.dataset.key = key;
    const item = items ? items[key] : null;
    const kind = item ? item.kind : null;
    if (kind === 'choice') {
      const options = choiceOptions(box);
      options.forEach((li, i) => {
        const label = el('label', 'check-option');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = `check-${uid}-${key}`;
        radio.value = String(i);
        label.appendChild(radio);
        const math = el('span', 'check-option-math');
        math.innerHTML = li.innerHTML;
        label.appendChild(math);
        body.appendChild(label);
      });
    } else if (kind === 'truefalse') {
      [['A', t('check.true')], ['F', t('check.false')]].forEach(([value, text]) => {
        const label = el('label', 'check-option');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = `check-${uid}-${key}`;
        radio.value = value;
        label.appendChild(radio);
        label.appendChild(el('span', null, text));
        body.appendChild(label);
      });
    } else if (kind) {
      const field = el('input', 'check-field');
      field.type = 'text';
      field.autocomplete = 'off';
      field.spellcheck = false;
      field.setAttribute('aria-label', t('check.answer'));
      field.placeholder = window.Answers.exampleFor(kind);
      body.appendChild(field);
      const example = el('p', 'check-example', t('check.example').replace('{example}', window.Answers.exampleFor(kind)));
      body.appendChild(example);
      const syms = el('div', 'check-syms');
      SYMBOLS.forEach((s) => {
        const btn = el('button', 'sym', s);
        btn.type = 'button';
        btn.addEventListener('click', () => typeAt(field, s));
        syms.appendChild(btn);
      });
      body.appendChild(syms);
      if (item.hint) {
        // Hints may hold $…$ math; the render below handles them like the article.
        const hint = el('p', 'check-hint', item.hint[getLang()] || item.hint.ro || '');
        body.appendChild(hint);
      }
    }
    if (window.Site) window.Site.renderMath(body);
    dialog.showModal();
    const first = body.querySelector('input');
    if (first) first.focus();
  }

  function typeAt(field, text) {
    const s = field.selectionStart == null ? field.value.length : field.selectionStart;
    const e = field.selectionEnd == null ? s : field.selectionEnd;
    field.value = field.value.slice(0, s) + text + field.value.slice(e);
    field.focus();
    field.setSelectionRange(s + text.length, s + text.length);
  }

  function currentAnswer(key, item) {
    if (item.kind === 'choice') {
      const checked = body.querySelector('input[type="radio"]:checked');
      if (!checked) return null;
      const box = main.querySelector(`[data-ex="${key}"]`);
      const options = box ? choiceOptions(box) : [];
      const li = options[Number(checked.value)];
      return li ? { value: li.getAttribute('data-value') || '', pick: Number(checked.value) } : null;
    }
    if (item.kind === 'truefalse') {
      const checked = body.querySelector('input[type="radio"]:checked');
      return checked ? { value: checked.value } : null;
    }
    const field = body.querySelector('.check-field');
    return field ? { value: field.value } : null;
  }

  async function ensureItems() {
    // No latch on failure: "try again later" must mean the next press really
    // fetches again, so a student who was offline is not stuck until a reload.
    if (items) return items;
    try {
      const res = await fetch(`${root}data/results/${name}.json?v=${encodeURIComponent(version)}`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      items = data && data.items ? data.items : null;
      if (!items) throw new Error('no items');
    } catch (e) {
      items = null;
    }
    if (items) {
      // An item missing from the file gets no button.
      main.querySelectorAll('[data-ex]').forEach((box) => {
        const key = box.getAttribute('data-ex');
        const item = items[key];
        if (!item || item.check === false) {
          const btn = box.querySelector('.check-btn');
          if (btn) btn.remove();
          clearMark(box);
        }
      });
    }
    return items;
  }

  async function onCheck(event) {
    const btn = event.currentTarget;
    const box = btn.closest('[data-ex]');
    if (!box) return;
    const key = box.getAttribute('data-ex');
    ensureDialog();
    // The first press loads the file; nothing loads before that.
    const found = await ensureItems();
    if (!found) {
      opener = btn;
      titleEl.textContent = t('check.exercise').replace('{key}', keyLabel(key));
      body.textContent = '';
      say(t('check.offline'), 'error');
      dialog.dataset.key = '';
      dialog.showModal();
      return;
    }
    openFor(box, key);
  }

  async function onSubmit() {
    const key = dialog.dataset.key;
    if (!key || !items || !items[key]) return;
    const item = items[key];
    const box = main.querySelector(`[data-ex="${key}"]`);
    if (!box) return;
    const given = currentAnswer(key, item);
    if (!given) {
      // Radio kinds with nothing picked: say so instead of doing nothing.
      say(t('check.pick'), 'error');
      return;
    }
    const read = window.Answers.read(item.kind, given.value);
    if (!read.ok) {
      say(t('check.unreadable').replace('{example}', window.Answers.exampleFor(item.kind)), 'error');
      return;
    }
    const ok = await window.Answers.verify(item, given.value);
    const btn = box.querySelector('.check-btn');
    if (item.kind === 'choice') {
      markChoice(box, given.pick, ok);
      remember(key, { pick: given.pick, ok });
    } else {
      if (btn) markText(box, given.value, ok, btn);
      remember(key, { a: given.value, ok });
    }
    if (ok) {
      say(`${t('check.ok')} ✓`, 'ok');
    } else {
      say(`${t('check.retry')} ✗`, 'bad');
      const again = el('button', 'chip check-again', t('check.tryAgain'));
      again.type = 'button';
      again.addEventListener('click', () => {
        say('', 'none');
        const field = body.querySelector('.check-field');
        if (field) field.focus();
        again.remove();
      });
      verdict.appendChild(el('span', null, ' '));
      verdict.appendChild(again);
    }
  }

  function clearAllStored() {
    try {
      const doomed = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.indexOf(STORE_PREFIX) === 0) doomed.push(k);
      }
      doomed.forEach((k) => window.localStorage.removeItem(k));
    } catch (e) {
      storeAll(null);
    }
  }

  // --- Wiring ---------------------------------------------------------------

  main.querySelectorAll('[data-ex]').forEach((box) => {
    const btn = el('button', 'check-btn', t('check.verify'));
    btn.type = 'button';
    btn.addEventListener('click', onCheck);
    box.appendChild(btn);
  });
  applySaved();

  const reset = document.getElementById('check-reset');
  if (reset) {
    let resetDialog = null;
    let resetOpener = null;

    function ensureResetDialog() {
      if (resetDialog) return;
      resetDialog = el('dialog', 'check-dialog');
      const title = el('h2', 'check-title', t('check.resetTitle'));
      title.id = 'check-reset-title';
      resetDialog.setAttribute('aria-labelledby', 'check-reset-title');
      const body = el('div', 'check-body');
      const labelThis = el('label', 'check-option');
      const radioThis = el('input');
      radioThis.type = 'radio';
      radioThis.name = `check-reset-scope-${uid}`;
      radioThis.value = 'this';
      radioThis.checked = true;
      labelThis.appendChild(radioThis);
      labelThis.appendChild(el('span', null, t('check.resetThis')));
      const labelAll = el('label', 'check-option');
      const radioAll = el('input');
      radioAll.type = 'radio';
      radioAll.name = `check-reset-scope-${uid}`;
      radioAll.value = 'all';
      labelAll.appendChild(radioAll);
      labelAll.appendChild(el('span', null, t('check.resetAll')));
      body.appendChild(labelThis);
      body.appendChild(labelAll);
      const row = el('div', 'check-row');
      const del = el('button', 'button check-submit', t('check.resetDelete'));
      del.type = 'button';
      const cancel = el('button', 'chip check-cancel', t('check.cancel'));
      cancel.type = 'button';
      cancel.addEventListener('click', () => resetDialog.close());
      row.appendChild(del);
      row.appendChild(cancel);
      resetDialog.appendChild(title);
      resetDialog.appendChild(body);
      resetDialog.appendChild(row);
      document.body.appendChild(resetDialog);
      resetDialog.addEventListener('close', () => {
        if (resetOpener && resetOpener.isConnected) resetOpener.focus();
        resetOpener = null;
      });
      del.addEventListener('click', () => {
        const all = resetDialog.querySelector('input[value="all"]').checked;
        if (all) clearAllStored();
        else storeAll(null);
        main.querySelectorAll('[data-ex]').forEach(clearMark);
        refreshReset();
        resetDialog.close();
      });
    }

    reset.addEventListener('click', () => {
      ensureResetDialog();
      const thisRadio = resetDialog.querySelector('input[value="this"]');
      if (thisRadio) thisRadio.checked = true;
      resetOpener = reset;
      resetDialog.showModal();
    });
    refreshReset();
  }
})();
