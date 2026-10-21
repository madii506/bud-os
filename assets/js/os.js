// bud OS: the greenhouse, the dive through the night-shift PC, a short boot, then a dark phosphor desktop where every
// window works and the buds live on the taskbar. The windows, the terminal and the pets all read the same live engine.
import { createSound } from './sound.js?v=2';
import * as WAL from './wallet.js?v=2';
import { ICONS, SPR, avatarURL, hueOf, tinted, walkFrames } from './sprites.js?v=2';
import { installApps } from './apps.js?v=2';
import { installTerm } from './term.js?v=2';
import { installPets } from './pets.js?v=2';
import * as FX from './fx.js?v=2';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 760px)').matches || matchMedia('(hover: none)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ss = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} }, del(k) { try { sessionStorage.removeItem(k); } catch {} } };
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const SOUND = createSound(ls);
SOUND.unlock();
const unlockOnce = () => { SOUND.unlock(); if (SOUND.on) ['pointerdown', 'keydown', 'touchend'].forEach(t => removeEventListener(t, unlockOnce, true)); };
['pointerdown', 'keydown', 'touchend'].forEach(t => addEventListener(t, unlockOnce, true));

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
const ago = t => { if (!t) return '—'; const s = Math.max(1, (Date.now() - new Date(t).getTime()) / 1000); return s < 60 ? `${s | 0}s` : s < 3600 ? `${s / 60 | 0}m` : s < 86400 ? `${s / 3600 | 0}h` : `${s / 86400 | 0}d`; };
const fsol = n => { n = Number(n || 0); return n === 0 ? '0' : n < .001 ? n.toFixed(5) : n < 1 ? n.toFixed(4) : n < 100 ? n.toFixed(3) : n.toFixed(1); };
const ftok = (raw, dec = 6) => { const ui = Number(raw || 0) / 10 ** dec; return ui >= 1e9 ? (ui / 1e9).toFixed(2) + 'B' : ui >= 1e6 ? (ui / 1e6).toFixed(2) + 'M' : ui >= 1e3 ? (ui / 1e3).toFixed(1) + 'K' : ui.toFixed(0); };
async function api(op, { method = 'GET', body, params } = {}) {
  const u = '/api/' + op + (params ? '?' + new URLSearchParams(params) : '');
  let r; try { r = await fetch(u, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('No connection. Check your internet and try again.'); }
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok || j.ok === false) throw new Error(j.error || `Request failed (${r.status}).`);
  return j;
}
async function copy(t) { try { await navigator.clipboard.writeText(t); toast('copied'); } catch { toast('select it and copy'); } }
const solscan = s => `https://solscan.io/tx/${s}`, acct = a => `https://solscan.io/account/${a}`, pumpfun = m => `https://pump.fun/coin/${m}`;

// ---------------------------------------------------------------- the shared context every app gets
const BUS = new Map();
const X = {
  $, $$, esc, short, ago, fsol, ftok, api, copy, sleep, ls, ss, SOUND, WAL, ICONS, SPR, avatarURL, hueOf, tinted, walkFrames, MOBILE, RM, solscan, acct, pumpfun,
  BUDS: [], TOTALS: {}, TICK: null, CFG: null, FEEDLAST: 0, RECENT: [], fx: FX,
  on(ev, fn) { if (!BUS.has(ev)) BUS.set(ev, new Set()); BUS.get(ev).add(fn); return () => BUS.get(ev).delete(fn); },
  emit(ev, d) { (BUS.get(ev) || []).forEach(fn => { try { fn(d); } catch (e) { console.error(e); } }); },
};
const APPS = {};
X.APPS = APPS; X.define = (id, def) => { APPS[id] = def; return def; };

// ---------------------------------------------------------------- toasts
function toast(text, opt = {}) {
  const box = $('#toasts'); if (!box) return;
  const ms = opt.ms || 4600, t = document.createElement('div'); t.className = 'toast' + (opt.kind ? ' ' + opt.kind : ''); t.style.setProperty('--ms', ms + 'ms');
  t.innerHTML = (opt.icon ? `<img src="${opt.icon}" alt="">` : '') + `<span>${esc(text)}</span><i class="tbar"></i>`;
  if (opt.onclick) { t.classList.add('click'); t.onclick = () => { opt.onclick(); out(); }; }
  box.appendChild(t); requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
  while (box.children.length > 3) box.firstChild.remove();
  const out = () => { if (t._out) return; t._out = 1; t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 380); };
  setTimeout(out, ms);
}
X.toast = toast;

// ================================================================ boot: greenhouse → dive → boot screen → desktop
async function boot() {
  const qs = new URLSearchParams(location.search);
  if (ss.get('bud:seen') || RM || qs.has('bud') || qs.has('app') || qs.has('skip')) return desktop(qs.get('app') || '', true);
  const canvas = $('#room');
  let started = false;
  const go = cmd => { if (go.done) return; go.done = true; ss.set('bud:seen', '1'); desktop(cmd); };
  $$('#itouch button').forEach(b => b.onclick = () => { if (window.__bud && window.__bud.go) window.__bud.go(b.dataset.go); else go(b.dataset.go); });
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) throw new Error('no webgl');
    const { run } = await import('./intro.js?v=2');
    window.__bud = await run({ canvas, mobile: MOBILE, onEnter: go, status: null, audio: SOUND, onReady: () => { $('#ihint').classList.add('on'); $('#itouch').classList.add('on'); } });
    started = true;
    requestAnimationFrame(() => canvas.classList.add('on'));
  } catch (e) { console.warn(e); if (!started) fallbackBoot(go); }
}
async function fallbackBoot(go) {
  const pre = $('#ifall'); pre.hidden = false; const r = $('#room'); if (r) r.remove();
  const lines = ['BUD LABS BIOS v2.0  (c) the night shift', 'cpu: photosynthetic @ 33 MHz', 'memory test: 65536K ok', '', 'detecting grow lights ........ on', 'detecting seed trays ......... wet', 'detecting buds ............... awake', 'detecting sleep .............. not found', '', 'every coin gets a bud.', 'it does the bagwork while you sleep.', '', 'press enter.'];
  for (const l of lines) { pre.textContent += l + '\n'; await sleep(70); }
  $('#itouch').classList.add('on');
  addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') go(''); }, { once: true });
}
// no loading screen: the greenhouse goes dark, then the desktop flickers on like an old CRT
async function desktop(cmd, instant) {
  const intro = $('#intro'); if (intro) intro.remove();
  document.body.classList.remove('booting');
  const d = $('#desk'); d.hidden = false; d.classList.add(instant && !/[?&]crt\b/.test(location.search) ? 'in' : 'crt-on');
  SOUND.scene('desk'); setTimeout(() => SOUND.sfx(instant ? 'click' : 'crton'), instant ? 0 : 60);
  setTimeout(() => d.classList.remove('in', 'crt-on'), 1400);
  await initDesk();
  const qs = new URLSearchParams(location.search);
  const target = qs.get('bud');
  if (target) X.openBud(target);
  const app = { launch: 'launch', buds: 'buds', ledger: 'ledger', terminal: 'term', term: 'term', greenhouse: 'greenhouse', docs: 'readme', readme: 'readme', game: 'bagwork', catch: 'bagwork', bagwork: 'pipe', stats: 'stats', dash: 'stats' }[cmd];
  if (app) WM.open(app);
  else if (!target) { if (ls.get('bud:nowelcome') !== '1') WM.open('welcome'); if (!MOBILE) setTimeout(() => WM.open('buds'), 350); }
}

// ================================================================ window manager
const WM = {
  z: 30, wins: {},
  make(app) {
    const def = APPS[app]; if (!def) return null;
    const w = document.createElement('section'); w.className = 'win'; w.dataset.app = app; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', def.title);
    w.style.setProperty('--ww', (def.w || 560) + 'px'); w.style.setProperty('--wh', (def.h || 420) + 'px');
    if (def.cls) w.classList.add(...def.cls.split(' '));
    w.innerHTML = `<header class="tb"><img src="${def.iconURL || ICONS[def.icon] || ICONS.folder}" alt=""><span class="tt">${esc(def.title)}</span><div class="tbb"><button type="button" data-min aria-label="minimize">_</button>${def.nomax ? '' : '<button type="button" data-max aria-label="maximize">□</button>'}<button type="button" data-close aria-label="close">×</button></div></header><div class="wb"></div>`;
    $('#wins').appendChild(w); this.wins[app] = w;
    const tb = w.querySelector('.tb');
    tb.addEventListener('pointerdown', e => this.drag(e, w));
    tb.addEventListener('dblclick', e => { if (!e.target.closest('button')) this.max(app); });
    w.addEventListener('pointerdown', () => this.focus(app), true);
    w.querySelector('[data-min]').onclick = e => { e.stopPropagation(); this.min(app); };
    const mx = w.querySelector('[data-max]'); if (mx) mx.onclick = e => { e.stopPropagation(); this.max(app); };
    w.querySelector('[data-close]').onclick = e => { e.stopPropagation(); this.close(app); };
    if (!MOBILE && !def.noresize) { const g = document.createElement('div'); g.className = 'grip'; w.appendChild(g); g.addEventListener('pointerdown', e => this.resize(e, w)); }
    try { def.build && def.build(w.querySelector('.wb'), w); } catch (e) { console.error(app, e); w.querySelector('.wb').innerHTML = `<p class="err">this window crashed: ${esc(e.message)}</p>`; }
    return w;
  },
  place(w, def) {
    const wins = $('#wins'), area = { width: wins.offsetWidth, height: wins.offsetHeight }, n = $$('.win.open').length;   // layout sizes: the desktop may be mid power-on
    const ww = Math.min(w.offsetWidth || def.w || 560, area.width - 16), wh = Math.min(w.offsetHeight || def.h || 420, area.height - 16);
    let x, y;
    if (def.at === 'right') { x = area.width - ww - 18; y = 18; }
    else if (def.at === 'left') { x = 130; y = 24; }
    else { x = Math.max(120, (area.width - ww) / 2 + (n % 6) * 28 - 60); y = Math.max(12, (area.height - wh) / 2 + (n % 6) * 24 - 40); }
    x = Math.min(x, area.width - ww - 8); y = Math.min(y, area.height - wh - 8);
    w.style.left = Math.max(4, x) + 'px'; w.style.top = Math.max(4, y) + 'px';
  },
  open(app, arg, fromEl) {
    closeMenus();
    let w = this.wins[app] || this.make(app); if (!w) return;
    if (w._anim) { w._anim.onfinish = null; w._anim.cancel(); w._anim = null; if (w.classList.contains('closing')) w.classList.remove('open', 'closing'); }
    const def = APPS[app], was = w.classList.contains('open');
    if (!was) { w.classList.add('open'); if (!w.dataset.placed) { this.place(w, def); w.dataset.placed = '1'; } this.task(app, true); if (MOBILE) w.classList.add('max'); }
    const wasMin = w.classList.contains('minimized'); w.classList.remove('minimized'); this.focus(app);
    if (!was) {
      if (wasMin) this.flyFromTask(app);
      else { this.zoom(fromEl ? fromEl.getBoundingClientRect() : null, w.getBoundingClientRect()); anim(w, 'open'); }
      SOUND.sfx('open');
      if (fromEl) { fromEl.classList.remove('launching'); void fromEl.offsetWidth; fromEl.classList.add('launching'); }
    }
    if (def.open && (!was || arg !== undefined)) { try { def.open(arg, w); } catch (e) { console.error(e); } }
    return w;
  },
  close(app) {
    const w = this.wins[app]; if (!w) return; const def = APPS[app], wasOpen = w.classList.contains('open') && !w.classList.contains('closing');
    const finish = () => { w._anim = null; w.classList.remove('open', 'active', 'max', 'minimized', 'closing'); def && def.close && def.close(w); if (def && def.dispose) { w.remove(); delete this.wins[app]; } };
    this.task(app, false);
    if (wasOpen) { SOUND.sfx('close'); w.classList.add('closing'); w.classList.remove('active'); const a = anim(w, 'close'); if (a) { w._anim = a; a.onfinish = finish; } else finish(); }
    else finish();
    this.focusTop();
  },
  min(app) {
    const w = this.wins[app]; if (!w || !w.classList.contains('open')) return;
    const done = () => { w._anim = null; w.classList.remove('open', 'closing'); w.classList.add('minimized'); this.syncTasks(); };
    w.classList.remove('active'); w.classList.add('closing'); SOUND.sfx('min');
    const a = this.flyToTask(app); if (a) { w._anim = a; a.onfinish = done; } else done();
    this.focusTop();
  },
  restore(app) { this.open(app); },
  max(app) {
    if (MOBILE) return; const w = this.wins[app]; const f = w.getBoundingClientRect(); w.classList.toggle('max'); const t = w.getBoundingClientRect();
    if (!RM && t.width && t.height) { w.style.transformOrigin = '0 0'; const a = w.animate([{ transform: `translate(${f.left - t.left}px, ${f.top - t.top}px) scale(${f.width / t.width}, ${f.height / t.height})` }, { transform: 'none' }], { duration: 210, easing: 'cubic-bezier(.2,.8,.3,1)' }); a.onfinish = a.oncancel = () => { w.style.transformOrigin = ''; }; }
    const def = APPS[app]; def && def.resized && def.resized(w);
  },
  // the window shrinks into its taskbar button, and comes back out of it
  flyToTask(app) {
    const w = this.wins[app], b = $(`#tasks [data-task="${CSS.escape(app)}"]`); if (RM || MOBILE || !b) return null;
    const r = w.getBoundingClientRect(), t = b.getBoundingClientRect(), s = Math.max(.05, t.width / r.width);
    w.style.transformOrigin = '50% 50%';
    return w.animate([{ transform: 'none', opacity: 1, filter: 'none' }, { transform: `translate(${(t.left + t.width / 2) - (r.left + r.width / 2)}px, ${(t.top + t.height / 2) - (r.top + r.height / 2)}px) scale(${s})`, opacity: .15, filter: 'brightness(1.8)' }], { duration: 260, easing: 'cubic-bezier(.55,0,.35,1)' });
  },
  flyFromTask(app) {
    const w = this.wins[app], b = $(`#tasks [data-task="${CSS.escape(app)}"]`); if (RM || MOBILE || !b) return;
    const r = w.getBoundingClientRect(), t = b.getBoundingClientRect(), s = Math.max(.05, t.width / r.width);
    w.style.transformOrigin = '50% 50%';
    w.animate([{ transform: `translate(${(t.left + t.width / 2) - (r.left + r.width / 2)}px, ${(t.top + t.height / 2) - (r.top + r.height / 2)}px) scale(${s})`, opacity: .15, filter: 'brightness(1.8)' }, { transform: 'none', opacity: 1, filter: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.3,1)' });
  },
  retitle(app, title) { const w = this.wins[app]; if (!w) return; const s = w.querySelector('.tb .tt'); if (s) s.textContent = title; const b = $(`#tasks [data-task="${CSS.escape(app)}"] span`); if (b) b.textContent = title; },
  isOpen(app) { const w = this.wins[app]; return !!(w && w.classList.contains('open')); },
  focus(app) {
    const w = this.wins[app]; if (!w || !w.classList.contains('open')) return;
    if (!w.classList.contains('active')) { $$('.win.active').forEach(x => x.classList.remove('active')); w.classList.add('active'); }
    w.style.zIndex = ++this.z; this.syncTasks();
    const def = APPS[app]; def && def.focus && def.focus(w);
  },
  focusTop() { const open = $$('.win.open:not(.closing)').sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0)); if (open[0]) this.focus(open[0].dataset.app); else this.syncTasks(); },
  task(app, on) {
    const box = $('#tasks'); let b = $(`[data-task="${CSS.escape(app)}"]`, box);
    if (on && !b) { const def = APPS[app]; b = document.createElement('button'); b.type = 'button'; b.className = 'task'; b.dataset.task = app;
      b.innerHTML = `<img src="${def.iconURL || ICONS[def.icon] || ICONS.folder}" alt=""><span>${esc(def.short || def.title)}</span>`;
      b.onclick = () => { const w = this.wins[app]; if (w.classList.contains('minimized') || w.classList.contains('closing')) this.restore(app); else if (w.classList.contains('active')) this.min(app); else this.focus(app); };
      box.appendChild(b); }
    if (!on && b) b.remove();
    this.syncTasks();
  },
  syncTasks() { $$('#tasks .task').forEach(b => { const w = this.wins[b.dataset.task]; b.classList.toggle('on', !!(w && w.classList.contains('active') && w.classList.contains('open'))); }); },
  // a glowing outline flies from the icon to where the window opens
  zoom(f, t) {
    if (RM || MOBILE || !f || !t || !f.width || !t.width) return;
    $('#zoomr').animate([{ left: f.left + 'px', top: f.top + 'px', width: f.width + 'px', height: f.height + 'px', opacity: .9 }, { left: t.left + 'px', top: t.top + 'px', width: t.width + 'px', height: t.height + 'px', opacity: .6, offset: .85 }, { left: t.left + 'px', top: t.top + 'px', width: t.width + 'px', height: t.height + 'px', opacity: 0 }], { duration: 260, easing: 'cubic-bezier(.3,.7,.3,1)' });
  },
  drag(e, w) {
    if (e.target.closest('button') || MOBILE || w.classList.contains('max') || e.button !== 0) return;
    e.preventDefault(); const r = w.getBoundingClientRect(), area = $('#wins').getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    w.classList.add('dragging');
    const mv = ev => { w.style.left = Math.max(-r.width + 80, Math.min(area.width - 60, ev.clientX - area.left - ox)) + 'px'; w.style.top = Math.max(0, Math.min(area.height - 30, ev.clientY - area.top - oy)) + 'px'; };
    const up = () => { w.classList.remove('dragging'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  },
  resize(e, w) {
    e.preventDefault(); e.stopPropagation(); const r = w.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, def = APPS[w.dataset.app] || {};
    const mv = ev => { w.style.setProperty('--ww', Math.max(def.minW || 300, r.width + ev.clientX - x0) + 'px'); w.style.setProperty('--wh', Math.max(def.minH || 180, r.height + ev.clientY - y0) + 'px'); def.resized && def.resized(w); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  },
};
function anim(w, kind) {
  if (RM) return null; w.getAnimations().forEach(a => a.cancel());
  if (kind === 'open') return w.animate([
    { clipPath: 'inset(49.5% 46% 49.5% 46%)', filter: 'brightness(3) saturate(.3)', transform: 'scale(.99)' },
    { clipPath: 'inset(49.5% 0 49.5% 0)', filter: 'brightness(2.6) saturate(.4)', offset: .32 },
    { clipPath: 'inset(0 0 0 0)', filter: 'brightness(1.35)', transform: 'scale(1)', offset: .72 },
    { clipPath: 'inset(0 0 0 0)', filter: 'none', transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.45,.05,.25,1)' });
  return w.animate([
    { clipPath: 'inset(0 0 0 0)', filter: 'none', opacity: 1 },
    { clipPath: 'inset(49.5% 0 49.5% 0)', filter: 'brightness(2.4) saturate(.4)', opacity: 1, offset: .6 },
    { clipPath: 'inset(49.5% 50% 49.5% 50%)', filter: 'brightness(3)', opacity: 0 }], { duration: 230, easing: 'cubic-bezier(.55,0,.8,.4)' });
}
X.WM = WM; X.open = (app, arg, from) => WM.open(app, arg, from);
window.__budos = X;

// ================================================================ desktop: icons, start menu, tray, wallpaper
const DESK_ICONS = [['term', 'bud.sh'], ['launch', 'launch.exe'], ['buds', 'buddy list'], ['pipe', 'bagwork.sys'], ['stats', 'stats.exe'], ['ledger', 'ledger.db'], ['greenhouse', 'greenhouse'], ['readme', 'readme.txt'], ['bagwork', 'catch.exe'], ['paint', 'paint.exe'], ['display', 'display'], ['bin', 'recycle bin']];
function closeMenus() { $('#startm').hidden = true; $('#start').classList.remove('on'); const wm = $('#walletm'); if (wm) wm.hidden = true; }
function renderIcons() {
  const box = $('#icons'); box.innerHTML = '';
  DESK_ICONS.forEach(([app, label], i) => {
    if (!APPS[app]) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'icon'; b.dataset.open = app; b.style.setProperty('--d', (RM ? 0 : 560 + i * 42) + 'ms');
    b.innerHTML = `<img src="${ICONS[APPS[app].icon] || ICONS.folder}" alt=""><span>${esc(label)}</span>`;
    b.onclick = e => { $$('.icon.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); if (MOBILE || e.detail === 0) WM.open(app, undefined, b); };
    b.ondblclick = () => WM.open(app, undefined, b);
    b.onkeydown = e => { if (e.key === 'Enter') WM.open(app, undefined, b); };
    box.appendChild(b);
  });
}
function renderStart() {
  const m = $('#startm');
  const items = [['term', 'terminal', 'bud.sh'], ['launch', 'launch a coin', 'launch.exe'], ['buds', 'buddy list', 'every bud online'], ['pipe', 'bagwork.sys', 'watch the jobs run, live'], ['stats', 'stats.exe', 'the night shift in numbers'], ['ledger', 'ledger', 'every job, every tx'], ['greenhouse', 'greenhouse', 'watch them grow'], ['-'],
    ['bagwork', 'catch.exe', 'catch the bags'], ['paint', 'paint.exe', 'draw a coin'], ['readme', 'readme.txt', 'how it works'], ['display', 'display', 'crt, sound, pets'], ['-'], ['shutdown', 'shut down…', 'back to the greenhouse']];
  m.innerHTML = `<div class="sm-side"><span>bud OS</span></div><div class="sm-list">${items.map(([a, t, s], i) => a === '-' ? '<hr>' : `<button type="button" data-app="${a}" style="--i:${i}"><img src="${a === 'shutdown' ? ICONS.x : ICONS[(APPS[a] || {}).icon] || ICONS.folder}" alt=""><b>${esc(t)}</b><small>${esc(s)}</small></button>`).join('')}</div>`;
  $$('button', m).forEach(b => b.onclick = () => { closeMenus(); if (b.dataset.app === 'shutdown') return shutdown(); WM.open(b.dataset.app); });
}
function shutdown() {
  closeMenus(); SOUND.sfx('crtoff'); ss.del('bud:seen');
  $('#desk').classList.add('crt-off');
  setTimeout(() => { const s = document.createElement('div'); s.id = 'shut'; s.innerHTML = '<p>it is now safe to turn off your computer.</p><p class="d">the buds will keep working.</p>'; document.body.appendChild(s); }, 560);
  setTimeout(() => location.href = '/', 3200);
}

// wallet chip + picker
function renderWallet() {
  const chip = $('#wchip'), cur = WAL.current();
  chip.innerHTML = cur ? `<i class="dot on"></i>${esc(short(cur.address))}` : '<i class="dot"></i>connect';
  chip.classList.toggle('on', !!cur);
}
async function walletMenu(anchor) {
  let m = $('#walletm'); if (!m) { m = document.createElement('div'); m.id = 'walletm'; m.className = 'popm'; document.body.appendChild(m); }
  if (!m.hidden) { m.hidden = true; return; }
  const cur = WAL.current();
  if (cur) m.innerHTML = `<div class="ph">${esc(cur.name)}</div><button type="button" data-x="copy">${esc(short(cur.address))} · copy</button><button type="button" data-x="mine">my buds</button><button type="button" data-x="off">disconnect</button>`;
  else { const ws = WAL.wallets(); m.innerHTML = `<div class="ph">connect a wallet</div>` + (ws.length ? ws.map((w, i) => `<button type="button" data-w="${i}"><img src="${esc(w.icon)}" alt="">${esc(w.name)}</button>`).join('') : '<p class="pm">no Solana wallet found in this browser. install Phantom, Solflare or Backpack, then reload.</p>'); }
  const r = anchor.getBoundingClientRect(); m.style.right = Math.max(8, innerWidth - r.right) + 'px'; m.style.bottom = (innerHeight - r.top + 6) + 'px'; m.hidden = false;
  $$('button', m).forEach(b => b.onclick = async () => {
    m.hidden = true;
    if (b.dataset.x === 'copy') return copy(cur.address);
    if (b.dataset.x === 'off') { await WAL.disconnect(); return; }
    if (b.dataset.x === 'mine') return WM.open('buds', { tab: 'mine' });
    try { await WAL.connect(WAL.wallets()[+b.dataset.w]); toast('wallet connected'); } catch (e) { toast(e.message || 'the wallet said no'); }
  });
}
X.connect = async () => {
  if (WAL.current()) return WAL.current();
  const ws = WAL.wallets();
  if (!ws.length) throw new Error('No Solana wallet found in this browser. Install Phantom, Solflare or Backpack, then reload.');
  if (ws.length === 1) return WAL.connect(ws[0]);
  walletMenu($('#wchip')); throw new Error('Pick a wallet below, then press the button again.');
};

// tray: the engine's heartbeat and a clock
function renderTray() {
  const e = $('#engine'), t = X.TICK, age = t ? (Date.now() - t) / 1000 : null;
  e.className = 'tray-e ' + (age == null ? 'off' : age < 180 ? 'ok' : 'late');
  e.title = age == null ? 'engine: no tick yet' : `engine: last pass ${ago(t)} ago`;
  $('span', e).textContent = age == null ? 'engine' : `engine ${ago(t)}`;
  const d = new Date(); $('#clock').textContent = d.toTimeString().slice(0, 5);
}

// ---------------------------------------------------------------- wallpaper: the grow room after hours. light from the bars above, spores drifting,
// and one very large bud drawn in a thin green line, whose eyes follow the mouse. Everything that doesn't move is drawn once, into caches.
function wallpaper() {
  const c = $('#wall'), g = c.getContext('2d'); let W = 0, H = 0, D = 1, mx = .5, my = .5, sx = .5, sy = .5, last = 0, bar = 42;
  const spores = Array.from({ length: MOBILE ? 26 : 70 }, () => ({ x: Math.random(), y: Math.random(), z: .2 + Math.random() * .8, v: .004 + Math.random() * .012, p: Math.random() * 6 }));
  const SH = [[.15, .85], [.4, 1.15], [.66, 1], [.9, .8]];
  const mk = (w, h) => { const k = document.createElement('canvas'); k.width = Math.max(1, Math.round(w)); k.height = Math.max(1, Math.round(h)); return k; };
  let bg = null, watcher = null, flick = 0, blinkT = 2.5;
  // the watcher's three layers, from the silhouette sprite: a dark body with a thin green edge, the grin, the eyes
  function parts() {
    const src = SPR.sil; if (!src) return null; const N = 32, t = mk(N, N), tg = t.getContext('2d'); tg.drawImage(src, 0, 0); const d = tg.getImageData(0, 0, N, N).data;
    const body = mk(N, N), eyes = mk(N, N), bgc = body.getContext('2d'), eg = eyes.getContext('2d');
    const on = (x, y) => x >= 0 && y >= 0 && x < N && y < N && d[(y * N + x) * 4 + 3] > 40; let x0 = N, x1 = 0, y0 = N, y1 = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!on(x, y)) continue; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      const i = (y * N + x) * 4, r = d[i], gr = d[i + 1], edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
      bgc.fillStyle = edge ? '#144528' : '#03100a'; bgc.fillRect(x, y, 1, 1);
      if (r > 180 && gr > 180) { eg.fillStyle = '#eafff0'; eg.fillRect(x, y, 1, 1); } else if (gr > 150) { bgc.fillStyle = 'rgba(79,220,132,.72)'; bgc.fillRect(x, y, 1, 1); }
    }
    return { body, eyes, x0, x1, y0, y1 };
  }
  function build() {
    const floor = H - bar; bg = mk(W * D, H * D); const q = bg.getContext('2d'); q.scale(D, D);
    const gr = q.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#010403'); gr.addColorStop(.55, '#030d08'); gr.addColorStop(1, '#0a2615'); q.fillStyle = gr; q.fillRect(0, 0, W, H);
    for (const [fx, wd] of SH) {
      const x = fx * W, sg = q.createLinearGradient(0, 0, 0, floor); sg.addColorStop(0, 'rgba(150,255,185,.075)'); sg.addColorStop(.6, 'rgba(120,255,170,.024)'); sg.addColorStop(1, 'rgba(120,255,170,0)');
      q.fillStyle = sg; q.beginPath(); q.moveTo(x - 34 * wd, 0); q.lineTo(x + 34 * wd, 0); q.lineTo(x + 210 * wd, floor); q.lineTo(x - 210 * wd, floor); q.closePath(); q.fill();
      q.fillStyle = 'rgba(214,255,226,.55)'; q.shadowColor = '#5cf08a'; q.shadowBlur = 14; q.fillRect(x - 42 * wd, 0, 84 * wd, 3); q.shadowBlur = 0;
    }
    if (X.SET.grid) { q.strokeStyle = 'rgba(92,240,138,.03)'; q.lineWidth = 1; q.beginPath(); for (let x = 0; x < W; x += 32) { q.moveTo(x + .5, 0); q.lineTo(x + .5, H); } for (let y = 0; y < H; y += 32) { q.moveTo(0, y + .5); q.lineTo(W, y + .5); } q.stroke(); }
    const fg = q.createLinearGradient(0, floor - 90, 0, floor); fg.addColorStop(0, 'rgba(92,240,138,0)'); fg.addColorStop(1, 'rgba(92,240,138,.07)'); q.fillStyle = fg; q.fillRect(0, floor - 90, W, 90);
    // the watcher, scaled once: body and grin in one layer, the eyes with their glow in another
    const P = parts(); watcher = null;
    if (P) {
      const pw = P.x1 - P.x0 + 1, ph = P.y1 - P.y0 + 1, s = Math.max(5, Math.round(Math.min(W * .8, floor * 1.05) / 46)), S = 32 * s;
      const body = mk(S * D, S * D), bq = body.getContext('2d'); bq.imageSmoothingEnabled = false; bq.drawImage(P.body, 0, 0, S * D, S * D);
      const pad = s * 4, eyes = mk((S + pad * 2) * D, (S + pad * 2) * D), eq = eyes.getContext('2d'); eq.imageSmoothingEnabled = false; eq.scale(D, D);
      eq.shadowColor = 'rgba(190,255,215,.95)'; eq.shadowBlur = s * 1.8; eq.drawImage(P.eyes, pad, pad, S, S); eq.shadowBlur = 0; eq.drawImage(P.eyes, pad, pad, S, S);
      watcher = { body, eyes, s, S, pad, pw, ph, x0: P.x0, y0: P.y0 };
    }
  }
  const fit = () => { D = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; c.width = Math.round(W * D); c.height = Math.round(H * D); g.setTransform(D, 0, 0, D, 0, 0); bar = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar')) || 42; bg = null; };
  fit(); addEventListener('resize', fit); X.on('settings', () => { bg = null; });
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth; my = e.clientY / innerHeight; }, { passive: true });
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || now - last < (MOBILE ? 55 : 40)) return; const dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now;
    if (!bg) build();
    sx += (mx - sx) * .05; sy += (my - sy) * .05;
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bg, 0, 0); g.setTransform(D, 0, 0, D, 0, 0);
    const floor = H - bar;
    // one of the bars stutters now and then
    if (Math.random() < dt / 9) flick = now;
    if (now - flick < 260 && (now / 40 | 0) % 2) { const x = SH[2][0] * W, wd = SH[2][1]; g.fillStyle = 'rgba(1,5,3,.6)'; g.beginPath(); g.moveTo(x - 34 * wd, 0); g.lineTo(x + 34 * wd, 0); g.lineTo(x + 210 * wd, floor); g.lineTo(x - 210 * wd, floor); g.closePath(); g.fill(); }
    if (X.SET.eyes && watcher) {
      const w = watcher, cx = W / 2 + (W > 900 ? W * .05 : 0) + (sx - .5) * -18, bx = Math.round(cx - w.pw * w.s / 2 - w.x0 * w.s), by = Math.round(floor - w.ph * w.s - w.y0 * w.s - w.s * 1.5 + Math.sin(now / 1800) * 2);
      g.drawImage(w.body, bx, by, w.S, w.S);
      const ex = bx + (w.x0 + w.pw * .5) * w.s, ey = by + 16 * w.s, lx = Math.max(-1, Math.min(1, (sx * W - ex) / (W * .25))), ly = Math.max(-1, Math.min(1, (sy * H - ey) / (H * .3)));
      blinkT -= dt; if (blinkT < -.15) blinkT = 2 + Math.random() * 5;
      if (blinkT > 0) g.drawImage(w.eyes, bx + Math.round(lx) * w.s - w.pad, by + Math.round(ly * .7) * w.s - w.pad, w.S + w.pad * 2, w.S + w.pad * 2);
    }
    for (const p of spores) {
      p.y -= p.v * dt * (1 + p.z); p.x += Math.sin(now / 1900 + p.p) * .00035; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); }
      g.fillStyle = `rgba(170,255,200,${(.08 + p.z * .3).toFixed(2)})`; g.fillRect(Math.round(p.x * W + (sx - .5) * -60 * p.z), Math.round(p.y * H + (sy - .5) * -24 * p.z), 1 + p.z * 2.2, 1 + p.z * 2.2);
    }
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- settings
const SET_DEF = { crt: true, eyes: true, grid: true, pets: true, toasts: true };
X.SET = Object.assign({}, SET_DEF, (() => { try { return JSON.parse(ls.get('bud:set') || '{}'); } catch { return {}; } })());
X.saveSet = () => { ls.set('bud:set', JSON.stringify(X.SET)); applySet(); X.emit('settings', X.SET); };
function applySet() { document.body.classList.toggle('crt', !!X.SET.crt); }

// ---------------------------------------------------------------- live data: buds, the feed, the config
async function pollBuds() {
  try { const j = await api('buds', { params: { limit: 120 } }); X.BUDS = j.buds || []; X.TOTALS = j.totals || {}; X.TICK = j.tickAt || null; X.emit('buds', X.BUDS); renderTray(); }
  catch {}
}
let feedPrimed = false, lastToast = 0;
async function pollFeed() {
  try {
    const j = await api('feed', { params: { after: X.FEEDLAST } });
    const items = (j.items || []).slice().reverse().filter(i => Number(i.n) > X.FEEDLAST);
    if (items.length) X.FEEDLAST = Math.max(X.FEEDLAST, ...items.map(i => Number(i.n)));
    if (!feedPrimed) { feedPrimed = true; X.RECENT = items.slice().reverse().slice(0, 60); X.emit('feedinit', items); return; }
    for (const it of items) {
      X.RECENT.unshift(it); if (X.RECENT.length > 60) X.RECENT.length = 60;
      X.emit('feed', it);
      if (['burn', 'drop', 'dev', 'claim', 'launch'].includes(it.kind) && X.SET.toasts && Date.now() - lastToast > 2500) {
        lastToast = Date.now(); SOUND.sfx('job');
        toast(`${it.bud_name}: ${it.text}`, { icon: avatarURL(it.mint, 32), onclick: () => X.openBud(it.mint) });
      }
    }
    if (items.length) pollBuds();
  } catch {}
}
X.refresh = () => { pollBuds(); pollFeed(); };
X.budBy = key => { const k = String(key || '').toLowerCase().replace(/^\$/, ''); return X.BUDS.find(b => b.mint === key || b.id === key || b.budName.toLowerCase() === k || b.symbol.toLowerCase() === k); };

// ================================================================ init
async function initDesk() {
  await SPR.ready.catch(() => null);
  Object.assign(APPS, installApps(X), installTerm(X));
  renderIcons(); renderStart(); applySet();
  $('#start').onclick = e => { e.stopPropagation(); const m = $('#startm'); const was = !m.hidden; closeMenus(); if (!was) { m.hidden = false; $('#start').classList.add('on'); SOUND.sfx('click'); } };
  $('#wchip').onclick = e => { e.stopPropagation(); walletMenu($('#wchip')); };
  $('#engine').onclick = () => WM.open('term', 'engine');
  const sb = $('#sndb'); SOUND.onChange(st => { sb.textContent = st.muted ? '♪̸' : '♪'; sb.title = st.muted ? 'sound off' : 'sound on'; }); sb.onclick = () => SOUND.toggle();
  addEventListener('pointerdown', e => { if (!e.target.closest('#startm, #start, #walletm, #wchip')) closeMenus(); if (!e.target.closest('.icon')) $$('.icon.sel').forEach(x => x.classList.remove('sel')); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenus();
    if (e.key === '`' && !e.target.closest('input, textarea, [contenteditable]')) { e.preventDefault(); if (WM.isOpen('term') && WM.wins.term.classList.contains('active')) WM.min('term'); else WM.open('term'); }
  });
  WAL.onChange(() => { renderWallet(); X.emit('wallet', WAL.current()); });
  wallpaper();
  X.CFG = await api('config').catch(() => null);
  await pollBuds(); await pollFeed();
  setInterval(pollBuds, 20000); setInterval(pollFeed, 7000); setInterval(renderTray, 15000); renderTray();
  try { installPets(X); } catch (e) { console.error(e); }
  // the engine runs on a cron; a visit also gives it a nudge, at most once a minute from here
  if (!ss.get('bud:nudge') || Date.now() - +ss.get('bud:nudge') > 60000) { ss.set('bud:nudge', String(Date.now())); fetch('/api/tick').catch(() => {}); }
}
X.openBud = async key => {
  let b = X.budBy(key);
  if (!b) { try { const j = await api('bud', { params: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key) ? { mint: key } : { id: key } }); b = j.bud; } catch (e) { toast(e.message); return; } }
  APPS.chat && APPS.chat.spawn(b);
};

boot();
