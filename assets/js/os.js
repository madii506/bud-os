// bud OS: the greenhouse, the dive through the night-shift PC, a short boot, then a dark phosphor desktop where every
// window works and the buds live on the taskbar. The windows, the terminal and the pets all read the same live engine.
import { createSound } from './sound.js?v=1';
import * as WAL from './wallet.js?v=1';
import { ICONS, SPR, avatarURL, hueOf, tinted, walkFrames } from './sprites.js?v=1';
import { installApps } from './apps.js?v=1';
import { installTerm } from './term.js?v=1';
import { installPets } from './pets.js?v=1';

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
  BUDS: [], TOTALS: {}, TICK: null, CFG: null, FEEDLAST: 0,
  on(ev, fn) { if (!BUS.has(ev)) BUS.set(ev, new Set()); BUS.get(ev).add(fn); return () => BUS.get(ev).delete(fn); },
  emit(ev, d) { (BUS.get(ev) || []).forEach(fn => { try { fn(d); } catch (e) { console.error(e); } }); },
};
const APPS = {};
X.APPS = APPS; X.define = (id, def) => { APPS[id] = def; return def; };

// ---------------------------------------------------------------- toasts
function toast(text, opt = {}) {
  const box = $('#toasts'); if (!box) return;
  const t = document.createElement('div'); t.className = 'toast' + (opt.kind ? ' ' + opt.kind : '');
  t.innerHTML = (opt.icon ? `<img src="${opt.icon}" alt="">` : '') + `<span>${esc(text)}</span>`;
  if (opt.onclick) { t.classList.add('click'); t.onclick = () => { opt.onclick(); t.remove(); }; }
  box.appendChild(t); requestAnimationFrame(() => t.classList.add('in'));
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, opt.ms || 4200);
}
X.toast = toast;

// ================================================================ boot: greenhouse → dive → boot screen → desktop
async function boot() {
  const qs = new URLSearchParams(location.search);
  if (ss.get('bud:seen') || RM || qs.has('bud') || qs.has('app') || qs.has('skip')) return desktop(qs.get('app') || '', true);
  const canvas = $('#room');
  let started = false;
  const go = cmd => { if (go.done) return; go.done = true; ss.set('bud:seen', '1'); flashThen(() => desktop(cmd)); };
  $$('#itouch button').forEach(b => b.onclick = () => { if (window.__bud && window.__bud.go) window.__bud.go(b.dataset.go); else go(b.dataset.go); });
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) throw new Error('no webgl');
    const { run } = await import('./intro.js?v=1');
    const sb = $('#isound');
    if (sb) { SOUND.onChange(st => { sb.textContent = st.muted ? '♪ sound off' : '♪ sound on'; sb.setAttribute('aria-pressed', String(!st.muted)); }); sb.onclick = e => { e.stopPropagation(); SOUND.toggle(); }; }
    window.__bud = await run({ canvas, mobile: MOBILE, onEnter: go, status: null, audio: SOUND, onReady: () => { $('#ihint').classList.add('on'); $('#itouch').classList.add('on'); } });
    started = true;
    requestAnimationFrame(() => { canvas.classList.add('on'); const l = $('#iload'); if (l) l.remove(); });
  } catch (e) { console.warn(e); const l = $('#iload'); if (l) l.remove(); if (!started) fallbackBoot(go); }
}
function flashThen(fn) { const f = $('#iflash'); f.classList.add('go'); setTimeout(fn, 320); }
async function fallbackBoot(go) {
  const pre = $('#ifall'); pre.hidden = false; const r = $('#room'); if (r) r.remove(); $$('#iskip').forEach(e => e.remove());
  const lines = ['BUD LABS BIOS v2.0  (c) the night shift', 'cpu: photosynthetic @ 33 MHz', 'memory test: 65536K ok', '', 'detecting grow lights ........ on', 'detecting seed trays ......... wet', 'detecting buds ............... awake', 'detecting sleep .............. not found', '', 'every coin gets a bud.', 'it does the bagwork while you sleep.', '', 'press enter.'];
  for (const l of lines) { pre.textContent += l + '\n'; await sleep(70); }
  $('#itouch').classList.add('on');
  addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') go(''); }, { once: true });
}
async function bootScreen() {
  const b = $('#boot'); b.hidden = false; b.classList.add('in');
  const bar = $('#boot .bb i'), w = $('#boot .bw');
  const steps = ['loading the greenhouse', 'waking the buds', 'counting the fees', 'checking the bags', 'starting bud OS'];
  for (let i = 0; i <= 20; i++) { bar.style.width = (i * 5) + '%'; if (w) w.style.left = `calc(${i * 5}% - 16px)`; $('#boot .bs').textContent = steps[Math.min(4, i / 4.2 | 0)] + '…'; await sleep(RM ? 0 : 55 + Math.random() * 40); }
  await sleep(180); b.classList.add('out'); setTimeout(() => b.remove(), 600);
}
async function desktop(cmd, instant) {
  const intro = $('#intro');
  if (!instant) { await sleep(200); intro.remove(); await bootScreen(); }
  else { intro.remove(); const b = $('#boot'); if (b) b.remove(); }
  document.body.classList.remove('booting');
  const d = $('#desk'); d.hidden = false; d.classList.add('in');
  SOUND.scene('desk'); if (!instant) setTimeout(() => SOUND.sfx('chime'), 250);
  await initDesk();
  const qs = new URLSearchParams(location.search);
  const target = qs.get('bud');
  if (target) X.openBud(target);
  const app = { launch: 'launch', buds: 'buds', ledger: 'ledger', terminal: 'term', term: 'term', greenhouse: 'greenhouse', docs: 'readme', readme: 'readme', game: 'bagwork', bagwork: 'bagwork' }[cmd];
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
    const area = $('#wins').getBoundingClientRect(), n = $$('.win.open').length;
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
    const def = APPS[app], was = w.classList.contains('open');
    if (!was) { w.classList.add('open'); if (!w.dataset.placed) { this.place(w, def); w.dataset.placed = '1'; } this.task(app, true); if (MOBILE) w.classList.add('max'); }
    w.classList.remove('minimized'); this.focus(app);
    if (!was) { this.zoom(fromEl ? fromEl.getBoundingClientRect() : null, w.getBoundingClientRect()); SOUND.sfx('open'); w.classList.remove('pop'); void w.offsetWidth; w.classList.add('pop'); }
    if (def.open && (!was || arg !== undefined)) { try { def.open(arg, w); } catch (e) { console.error(e); } }
    return w;
  },
  close(app) { const w = this.wins[app]; if (!w) return; if (w.classList.contains('open')) SOUND.sfx('close'); w.classList.remove('open', 'active', 'max', 'minimized'); this.task(app, false); const def = APPS[app]; def && def.close && def.close(w); if (def && def.dispose) { w.remove(); delete this.wins[app]; } this.focusTop(); },
  min(app) { const w = this.wins[app], b = $(`#tasks [data-task="${CSS.escape(app)}"]`); if (b) this.zoom(w.getBoundingClientRect(), b.getBoundingClientRect()); w.classList.remove('open', 'active'); w.classList.add('minimized'); this.syncTasks(); this.focusTop(); },
  restore(app) { const w = this.wins[app], b = $(`#tasks [data-task="${CSS.escape(app)}"]`); w.classList.remove('minimized'); w.classList.add('open'); this.focus(app); if (b) this.zoom(b.getBoundingClientRect(), w.getBoundingClientRect()); },
  max(app) { if (MOBILE) return; const w = this.wins[app]; const f = w.getBoundingClientRect(); w.classList.toggle('max'); this.zoom(f, w.getBoundingClientRect()); const def = APPS[app]; def && def.resized && def.resized(w); },
  retitle(app, title) { const w = this.wins[app]; if (!w) return; const s = w.querySelector('.tb .tt'); if (s) s.textContent = title; const b = $(`#tasks [data-task="${CSS.escape(app)}"] span`); if (b) b.textContent = title; },
  isOpen(app) { const w = this.wins[app]; return !!(w && w.classList.contains('open')); },
  focus(app) {
    const w = this.wins[app]; if (!w || !w.classList.contains('open')) return;
    if (!w.classList.contains('active')) { $$('.win.active').forEach(x => x.classList.remove('active')); w.classList.add('active'); }
    w.style.zIndex = ++this.z; this.syncTasks();
    const def = APPS[app]; def && def.focus && def.focus(w);
  },
  focusTop() { const open = $$('.win.open').sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0)); if (open[0]) this.focus(open[0].dataset.app); else this.syncTasks(); },
  task(app, on) {
    const box = $('#tasks'); let b = $(`[data-task="${CSS.escape(app)}"]`, box);
    if (on && !b) { const def = APPS[app]; b = document.createElement('button'); b.type = 'button'; b.className = 'task'; b.dataset.task = app;
      b.innerHTML = `<img src="${def.iconURL || ICONS[def.icon] || ICONS.folder}" alt=""><span>${esc(def.short || def.title)}</span>`;
      b.onclick = () => { const w = this.wins[app]; if (w.classList.contains('minimized')) this.restore(app); else if (w.classList.contains('active')) this.min(app); else this.focus(app); };
      box.appendChild(b); }
    if (!on && b) b.remove();
    this.syncTasks();
  },
  syncTasks() { $$('#tasks .task').forEach(b => { const w = this.wins[b.dataset.task]; b.classList.toggle('on', !!(w && w.classList.contains('active') && w.classList.contains('open'))); }); },
  zoom(f, t) {
    if (RM || MOBILE || !f || !t || !f.width || !t.width) return;
    $('#zoomr').animate([{ left: f.left + 'px', top: f.top + 'px', width: f.width + 'px', height: f.height + 'px', opacity: 1 }, { left: t.left + 'px', top: t.top + 'px', width: t.width + 'px', height: t.height + 'px', opacity: .7 }], { duration: 190, easing: 'cubic-bezier(.3,.7,.4,1)' });
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
X.WM = WM; X.open = (app, arg, from) => WM.open(app, arg, from);
window.__budos = X;

// ================================================================ desktop: icons, start menu, tray, wallpaper
const DESK_ICONS = [['term', 'bud.sh'], ['launch', 'launch.exe'], ['buds', 'buddy list'], ['ledger', 'ledger.db'], ['greenhouse', 'greenhouse'], ['readme', 'readme.txt'], ['bagwork', 'bagwork.exe'], ['paint', 'paint.exe'], ['display', 'display'], ['bin', 'recycle bin']];
function closeMenus() { $('#startm').hidden = true; $('#start').classList.remove('on'); const wm = $('#walletm'); if (wm) wm.hidden = true; }
function renderIcons() {
  const box = $('#icons'); box.innerHTML = '';
  for (const [app, label] of DESK_ICONS) {
    if (!APPS[app]) continue;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'icon'; b.dataset.open = app;
    b.innerHTML = `<img src="${ICONS[APPS[app].icon] || ICONS.folder}" alt=""><span>${esc(label)}</span>`;
    b.onclick = e => { $$('.icon.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); if (MOBILE || e.detail === 0) WM.open(app, undefined, b); };
    b.ondblclick = () => WM.open(app, undefined, b);
    b.onkeydown = e => { if (e.key === 'Enter') WM.open(app, undefined, b); };
    box.appendChild(b);
  }
}
function renderStart() {
  const m = $('#startm');
  const items = [['term', 'terminal', 'bud.sh'], ['launch', 'launch a coin', 'launch.exe'], ['buds', 'buddy list', 'every bud online'], ['ledger', 'ledger', 'every job, every tx'], ['greenhouse', 'greenhouse', 'watch them grow'], ['-'],
    ['bagwork', 'bagwork.exe', 'catch the bags'], ['paint', 'paint.exe', 'draw a coin'], ['readme', 'readme.txt', 'how it works'], ['display', 'display', 'crt, sound, pets'], ['-'], ['shutdown', 'shut down…', 'back to the greenhouse']];
  m.innerHTML = `<div class="sm-side"><span>bud OS</span></div><div class="sm-list">${items.map(([a, t, s]) => a === '-' ? '<hr>' : `<button type="button" data-app="${a}"><img src="${a === 'shutdown' ? ICONS.term : ICONS[(APPS[a] || {}).icon] || ICONS.folder}" alt=""><b>${esc(t)}</b><small>${esc(s)}</small></button>`).join('')}</div>`;
  $$('button', m).forEach(b => b.onclick = () => { closeMenus(); if (b.dataset.app === 'shutdown') return shutdown(); WM.open(b.dataset.app); });
}
function shutdown() {
  const s = document.createElement('div'); s.id = 'shut'; s.innerHTML = '<p>it is now safe to turn off your computer.</p><p class="d">the buds will keep working.</p>'; document.body.appendChild(s);
  SOUND.sfx('power'); ss.del('bud:seen'); setTimeout(() => location.href = '/', 2600);
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

// ---------------------------------------------------------------- wallpaper: dark glass, spores, and a very large bud that watches the mouse
function wallpaper() {
  const c = $('#wall'), g = c.getContext('2d'); let W = 0, H = 0, mx = .5, my = .5, raf = 0, last = 0;
  const spores = Array.from({ length: MOBILE ? 18 : 46 }, () => ({ x: Math.random(), y: Math.random(), s: .2 + Math.random() * .9, v: .004 + Math.random() * .012, p: Math.random() * 6 }));
  const fit = () => { W = c.width = innerWidth; H = c.height = innerHeight; };
  fit(); addEventListener('resize', fit);
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth; my = e.clientY / innerHeight; }, { passive: true });
  let blinkT = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden || now - last < 33) return; const dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now;
    const gr = g.createRadialGradient(W * .7, H * .85, 40, W * .6, H * .7, Math.max(W, H)); gr.addColorStop(0, '#0b2414'); gr.addColorStop(.5, '#06120b'); gr.addColorStop(1, '#020604');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (X.SET.grid) { g.strokeStyle = 'rgba(92,240,138,.035)'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x < W; x += 32) { g.moveTo(x + .5, 0); g.lineTo(x + .5, H); } for (let y = 0; y < H; y += 32) { g.moveTo(0, y + .5); g.lineTo(W, y + .5); } g.stroke(); }
    // the watcher
    if (SPR.sil && X.SET.eyes) {
      const s = Math.round(Math.min(W, H) / 52), bw = 32 * s, bx = W - bw - (MOBILE ? -s * 6 : s * 3), by = H - bw + s * 3;
      g.imageSmoothingEnabled = false; if (X.BODY) { g.globalAlpha = .55; g.drawImage(X.BODY, bx, by, bw, bw); g.globalAlpha = 1; }
      if (!X.EYES) { const split = keep => { const ec = document.createElement('canvas'); ec.width = ec.height = 32; const eg = ec.getContext('2d'); eg.drawImage(SPR.sil, 0, 0); const d = eg.getImageData(0, 0, 32, 32); for (let i = 0; i < d.data.length; i += 4) { const eye = d.data[i] > 200 && d.data[i + 1] > 200; if (keep ? !eye : eye) { if (keep) d.data[i + 3] = 0; else d.data.set([2, 6, 4, 255], i); } } eg.putImageData(d, 0, 0); return ec; }; X.EYES = split(true); X.BODY = split(false); }
      const cx = (bx + bw * .35) / W, cy = (by + bw * .5) / H, dx = Math.max(-1, Math.min(1, (mx - cx) * 4)), dy = Math.max(-1, Math.min(1, (my - cy) * 4));
      blinkT -= dt; if (blinkT < -.14) blinkT = 2 + Math.random() * 5;
      if (blinkT > 0) { g.shadowColor = 'rgba(200,255,220,.9)'; g.shadowBlur = s * 3; g.globalAlpha = .9; g.drawImage(X.EYES, bx + Math.round(dx) * s, by + Math.round(dy * .6) * s, bw, bw); g.globalAlpha = 1; g.shadowBlur = 0; }
    }
    for (const p of spores) { p.y -= p.v * dt * 3; p.x += Math.sin(now / 1800 + p.p) * .0004; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); }
      g.fillStyle = `rgba(160,255,190,${.12 + p.s * .25})`; g.fillRect(p.x * W, p.y * H, p.s * 2.2, p.s * 2.2); }
  }
  raf = requestAnimationFrame(frame);
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
    if (!feedPrimed) { feedPrimed = true; X.emit('feedinit', items); return; }
    for (const it of items) {
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
