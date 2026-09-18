// Material visibility: the three states (visible, hidden, scheduled) and the
// Romania wall-clock time helpers. No DOM code, so Node tests can load it,
// like catalog.js. The admin page, tools/material.mjs, tools/build_pages.mjs
// and tests/validate.mjs all share this module.
//
// Visibility is resolved at build time: the generator decides from the data
// only and never compares visibleFrom with the clock. The timer removes the
// field when it reveals a material.
(function () {
  // visibleFrom shape: minutes, seconds always 00, explicit offset.
  const VISIBLE_FROM_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):00([+-]\d{2}):(\d{2})$/;
  // Admin and CLI input: Romania wall-clock time, whatever the device zone.
  const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function isLeap(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function daysInMonth(year, month) {
    return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }

  function validParts(y, mo, d, h, mi) {
    return mo >= 1 && mo <= 12
      && d >= 1 && d <= daysInMonth(y, mo)
      && h >= 0 && h <= 23
      && mi >= 0 && mi <= 59;
  }

  function parseWall(input) {
    const m = WALL_RE.exec(String(input || '').trim());
    if (!m) return null;
    const parts = { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]), h: Number(m[4]), mi: Number(m[5]) };
    if (!validParts(parts.y, parts.mo, parts.d, parts.h, parts.mi)) return null;
    return parts;
  }

  // Last Sunday of a month (month is 1-12), as a UTC day number.
  function lastSunday(year, month) {
    const last = new Date(Date.UTC(year, month, 0));
    const dow = last.getUTCDay();
    return new Date(Date.UTC(year, month - 1, last.getUTCDate() - dow));
  }

  // Europe/Bucharest follows the EU daylight saving rules: summer time starts
  // on the last Sunday of March at 01:00 UTC and ends on the last Sunday of
  // October at 01:00 UTC. Returns the start/end instants (millis) for a year.
  function dstStartUtc(year) {
    const d = lastSunday(year, 3);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 1, 0, 0);
  }

  function dstEndUtc(year) {
    const d = lastSunday(year, 10);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 1, 0, 0);
  }

  // True when a UTC instant falls inside Romania summer time (+03:00).
  function isDstUtc(ms) {
    const year = new Date(ms).getUTCFullYear();
    return ms >= dstStartUtc(year) && ms < dstEndUtc(year);
  }

  function offsetMinutes(ms) {
    return isDstUtc(ms) ? 180 : 120;
  }

  // The offset for a Romania wall-clock time. Both candidate offsets are tried
  // against the daylight saving rules, so no table has to guess the rules:
  // - a normal time matches exactly one candidate;
  // - a time in the spring gap (e.g. 2027-03-28 03:30) matches neither -> null;
  // - a time in the autumn overlap (e.g. 2026-10-25 03:30) matches both:
  //   the first occurrence (+03:00) wins.
  function offsetForWall(parts) {
    const wallMs = Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi);
    const candidates = [];
    for (const off of [180, 120]) {
      const utc = wallMs - off * 60000;
      if (offsetMinutes(utc) === off) candidates.push(off);
    }
    if (!candidates.length) return null;
    return candidates[0];
  }

  function formatOffset(offMinutes) {
    const sign = offMinutes < 0 ? '-' : '+';
    const abs = Math.abs(offMinutes);
    return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  }

  // "2026-09-21 08:00" (Romania wall time) -> "2026-09-21T08:00:00+03:00".
  // Returns null when the input is not a real Romania wall-clock time
  // (bad shape, impossible date, or the spring gap).
  function wallToVisibleFrom(input) {
    const parts = parseWall(input);
    if (!parts) return null;
    const off = offsetForWall(parts);
    if (off === null) return null;
    return `${parts.y}-${pad(parts.mo)}-${pad(parts.d)}T${pad(parts.h)}:${pad(parts.mi)}:00${formatOffset(off)}`;
  }

  // True when a stored visibleFrom has the right shape and its offset is the
  // Europe/Bucharest offset for that wall-clock time. Both occurrences of an
  // autumn-overlap time pass; a spring-gap time or a wrong offset fails.
  function isValidVisibleFrom(value) {
    const m = VISIBLE_FROM_RE.exec(String(value || ''));
    if (!m) return false;
    const parts = { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]), h: Number(m[4]), mi: Number(m[5]) };
    if (!validParts(parts.y, parts.mo, parts.d, parts.h, parts.mi)) return false;
    const off = (m[6] === '-' ? -1 : 1) * (Number(m[6].slice(1)) * 60 + Number(m[7]));
    if (off !== 120 && off !== 180) return false;
    const wallMs = Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi);
    return offsetMinutes(wallMs - off * 60000) === off;
  }

  // Millis of a stored visibleFrom, or NaN when it is not valid.
  function visibleFromMs(value) {
    if (!isValidVisibleFrom(value)) return NaN;
    return Date.parse(value);
  }

  // The Romania calendar date of an instant (a Date, millis or ISO string).
  function todayInRomania(now) {
    const ms = now === undefined ? Date.now()
      : now instanceof Date ? now.getTime()
      : typeof now === 'number' ? now
      : Date.parse(now);
    if (Number.isNaN(ms)) return null;
    const shifted = new Date(ms + offsetMinutes(ms) * 60000);
    return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  }

  // The Romania date of a stored visibleFrom ("2026-09-21T08:00:00+03:00" -> "2026-09-21").
  function roDateOfVisibleFrom(value) {
    if (!isValidVisibleFrom(value)) return null;
    return String(value).slice(0, 10);
  }

  // "2026-09-21T08:00:00+03:00" -> "21.09.2026 08:00" for chips and the CLI list.
  function formatRoTime(value) {
    const m = VISIBLE_FROM_RE.exec(String(value || ''));
    if (!m) return '';
    return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
  }

  // "2026-09-21T08:00:00+03:00" -> "2026-09-21 08:00", the Romania wall-clock
  // form the CLI takes, for commit messages and logs.
  function formatWall(value) {
    const m = VISIBLE_FROM_RE.exec(String(value || ''));
    if (!m) return '';
    return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
  }

  // "2026-09-21T08:00:00+03:00" -> "2026-09-21T08:00" for <input type="datetime-local">.
  function visibleFromToInput(value) {
    const m = VISIBLE_FROM_RE.exec(String(value || ''));
    if (!m) return '';
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  }

  // Exactly one of three states. Default is visible: a material with no
  // visibility field is on the site, so old entries need no edit.
  function stateOf(material) {
    if (!material || typeof material !== 'object') return 'visible';
    if (material.visibleFrom !== undefined && material.visibleFrom !== null) return 'scheduled';
    if (material.hidden) return 'hidden';
    return 'visible';
  }

  function isVisible(material) {
    return stateOf(material) === 'visible';
  }

  function visibleOnly(materials) {
    return (materials || []).filter(isVisible);
  }

  // A change from the admin payload or the CLI, before it is applied.
  // { uid, state: 'visible' | 'hidden' | 'scheduled', visibleFrom? }.
  // Returns null when the change is valid, otherwise the reason.
  function changeError(change, knownUids) {
    if (!change || typeof change !== 'object') return 'must be an object';
    if (typeof change.uid !== 'string' || !change.uid) return 'uid is required';
    if (knownUids && !knownUids.has(change.uid)) return `unknown uid "${change.uid}"`;
    if (change.state === 'visible' || change.state === 'hidden') {
      if (change.visibleFrom !== undefined) return 'visibleFrom goes only with state "scheduled"';
      return null;
    }
    if (change.state === 'scheduled') {
      if (!isValidVisibleFrom(change.visibleFrom)) return `visibleFrom "${change.visibleFrom}" is not a valid Romania date-time with minutes and an explicit offset`;
      return null;
    }
    return `state must be "visible", "hidden" or "scheduled" (was "${change.state}")`;
  }

  // What an admin row asks for. A date means scheduled; without one, the
  // "Vizibil" checkbox decides. `when` is the datetime-local value in Romania
  // wall-clock time. Returns { state, visibleFrom? } or { error } (Romanian,
  // shown on the admin page).
  function rowChange(checked, when) {
    const wall = String(when || '').trim();
    if (wall) {
      const visibleFrom = wallToVisibleFrom(wall);
      if (!visibleFrom) return { error: 'Ora aleasă nu există în România (trecerea la ora de vară). Alege altă oră.' };
      return { state: 'scheduled', visibleFrom };
    }
    return checked ? { state: 'visible' } : { state: 'hidden' };
  }

  // True when two { state, visibleFrom? } describe the same data.
  function isSameState(a, b) {
    if (a.state !== b.state) return false;
    return a.state !== 'scheduled' || a.visibleFrom === b.visibleFrom;
  }

  // True when a saved change is in the data (the admin page polls for it).
  // A scheduled time that has already passed is revealed by the same
  // workflow run, so a visible material counts for it too.
  function changeLanded(change, material, nowMs) {
    if (!material) return false;
    const state = stateOf(material);
    if (change.state !== 'scheduled') return state === change.state;
    if (state === 'scheduled') return material.visibleFrom === change.visibleFrom;
    const due = visibleFromMs(change.visibleFrom) <= nowMs;
    return due && state === 'visible';
  }

  const api = {
    VISIBLE_FROM_RE,
    parseWall,
    dstStartUtc,
    dstEndUtc,
    isDstUtc,
    offsetForWall,
    wallToVisibleFrom,
    isValidVisibleFrom,
    visibleFromMs,
    todayInRomania,
    roDateOfVisibleFrom,
    formatRoTime,
    formatWall,
    visibleFromToInput,
    stateOf,
    isVisible,
    visibleOnly,
    changeError,
    rowChange,
    isSameState,
    changeLanded,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Visibility = api;
})();
