// stats.exe (the dashboard) and bagwork.sys (the live machine: fees in, the bud, three ways out). Both read the real engine;
// every packet that runs a wire is a job that happened, and every number is the database's.
export function installDash(X) {
  const { $, $$, esc, api, fsol, ago, SOUND, WM } = X;
  const A = {};
  const COL = { burn: '#ff8a5c', drop: '#7fe3c4', dev: '#5cf08a', claim: '#f2c14e', launch: '#c6ffd6', refund: '#ff6b6b' };
  const PX = s => `${s}px PX, 'Pixelify Sans', monospace`, VT = s => `${s}px VT, 'VT323', monospace`;
  const lvl = l => `<span class="lvl ${esc(l)}">${esc(l)}</span>`;
  const trim = v => v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v >= .01 ? v.toFixed(3) : v.toFixed(4);
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1e-9)))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
  const visible = app => { const w = WM.wins[app]; return !!(w && w.classList.contains('open') && !document.hidden); };

  // ================================================================ the machine, drawn on a canvas; used full size in bagwork.sys and small in the welcome window
  X.makePipe = function makePipe(wrap, opt = {}) {
    const small = !!opt.small, cv = document.createElement('canvas'); wrap.appendChild(cv);
    const g = cv.getContext('2d'); let W = 0, H = 0, DPR = 1, L = null, raf = 0, alive = true, last = performance.now(), bgc = null, lastDraw = 0;
    const S = { packets: [], queue: [], lastJob: 0, fedT: -9, flash: { fees: -9, burn: -9, drop: -9, dev: -9 }, sparks: [], tot: { burn: 0, drop: 0, dev: 0 }, jobs: 0, replay: 0, born: [] };
    const syncTot = () => { const t = X.TOTALS || {}; S.tot.burn = Math.max(S.tot.burn, t.burned || 0); S.tot.drop = Math.max(S.tot.drop, t.dropped || 0); S.tot.dev = Math.max(S.tot.dev, t.dev || 0); };
    syncTot();
    function fit() {
      const r = wrap.getBoundingClientRect(); DPR = Math.min(2, devicePixelRatio || 1); W = Math.max(240, Math.round(r.width)); H = Math.max(small ? 110 : 220, Math.round(r.height));
      cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.setTransform(DPR, 0, 0, DPR, 0, 0); L = layout();
      // the parts that never move are drawn once
      bgc = document.createElement('canvas'); bgc.width = W * DPR; bgc.height = H * DPR; const q = bgc.getContext('2d'); q.scale(DPR, DPR);
      q.fillStyle = '#020a05'; q.fillRect(0, 0, W, H); q.strokeStyle = 'rgba(92,240,138,.05)'; q.lineWidth = 1; q.beginPath();
      for (let x = 0; x <= W; x += 16) { q.moveTo(x + .5, 0); q.lineTo(x + .5, H); } for (let y = 0; y <= H; y += 16) { q.moveTo(0, y + .5); q.lineTo(W, y + .5); } q.stroke();
      if (!small) { q.fillStyle = '#0a2414'; q.fillRect(0, 0, W, 28); q.fillStyle = '#173d25'; q.fillRect(0, 28, W, 2); q.font = PX(17); q.fillStyle = '#5cf08a'; q.fillText('BAGWORK.SYS', 12, 20); if (!L.v) { q.font = VT(15); q.fillStyle = '#2f8a52'; q.fillText('pump.fun vaults', L.fees.x, L.fees.y + L.fees.h + 18); } }
    }
    function layout() {
      const top = small ? 8 : 40, bot = H - (small ? 8 : 12);
      if (!small && W < 560) {
        // narrow: top to bottom. fees, then the bud, then the three ways out in a row
        const cx = Math.round(W / 2), fw = Math.round(Math.min(220, W * .62)), fh = 62, fees = { x: cx - Math.round(fw / 2), y: top + 14, w: fw, h: fh };
        const ow = Math.round((W - 32) / 3), oh = 62, oy = bot - oh - 4, avail = oy - (fees.y + fh) - 70, bh = Math.max(90, Math.min(150, avail)), bw = Math.round(Math.min(170, W * .46));
        const bud = { x: cx - Math.round(bw / 2), y: Math.round(fees.y + fh + 34 + Math.max(0, (avail - bh) / 2)), w: bw, h: bh };
        const outs = { burn: { x: 10, y: oy, w: ow, h: oh }, drop: { x: cx - Math.round(ow / 2), y: oy, w: ow, h: oh }, dev: { x: W - 10 - ow, y: oy, w: ow, h: oh } };
        const by = Math.round((bud.y + bud.h + oy) / 2), e = bud.y + bud.h, bc = o => Math.round(o.x + o.w / 2);
        const paths = { in: [[cx, fees.y + fh], [cx, bud.y]], burn: [[cx - 10, e], [cx - 10, by], [bc(outs.burn), by], [bc(outs.burn), oy]], drop: [[cx, e], [cx, oy]], dev: [[cx + 10, e], [cx + 10, by], [bc(outs.dev), by], [bc(outs.dev), oy]] };
        return { v: true, top, mid: Math.round(bud.y + bud.h / 2), fees, bud, outs, paths, oh, heads: [[cx, bud.y - 2, 'd', COL.claim], ...['burn', 'drop', 'dev'].map(k => [bc(outs[k]), oy - 2, 'd', COL[k]])] };
      }
      const mid = Math.round((top + bot) / 2);
      const fw = Math.round(Math.max(small ? 92 : 120, Math.min(small ? 120 : 176, W * .2))), fh = small ? 58 : 92;
      const fees = { x: Math.round(W * .025), y: Math.round(mid - fh / 2), w: fw, h: fh };
      const bw = Math.round(Math.max(small ? 96 : 130, Math.min(small ? 124 : 190, W * .22))), bh = Math.round(Math.min(small ? bot - top : 170, (bot - top) * (small ? 1 : .66)));
      const bud = { x: Math.round(W * .47 - bw / 2), y: Math.round(mid - bh / 2), w: bw, h: bh };
      const ow = Math.round(Math.max(small ? 86 : 118, Math.min(small ? 112 : 178, W * .21))), oh = Math.round(small ? Math.min(30, (bot - top - 8) / 3) : Math.min(70, (bot - top - 24) / 3));
      const ox = Math.round(W * .975 - ow), gy = Math.round(Math.max(oh + (small ? 4 : 12), Math.min((bot - top - oh) / 2, small ? 40 : 118)));
      const outs = { burn: { x: ox, y: mid - gy - Math.round(oh / 2), w: ow, h: oh }, drop: { x: ox, y: mid - Math.round(oh / 2), w: ow, h: oh }, dev: { x: ox, y: mid + gy - Math.round(oh / 2), w: ow, h: oh } };
      const bx = Math.round((bud.x + bud.w + ox) / 2), e = bud.x + bud.w;
      const paths = { in: [[fees.x + fees.w, mid], [bud.x, mid]], burn: [[e, mid - 10], [bx, mid - 10], [bx, outs.burn.y + oh / 2], [ox, outs.burn.y + oh / 2]], drop: [[e, mid], [ox, mid]], dev: [[e, mid + 10], [bx, mid + 10], [bx, outs.dev.y + oh / 2], [ox, outs.dev.y + oh / 2]] };
      return { top, mid, fees, bud, outs, paths, oh, heads: [[bud.x - 2, mid, 'r', COL.claim], ...['burn', 'drop', 'dev'].map(k => [ox - 2, outs[k].y + oh / 2, 'r', COL[k]])] };
    }
    const along = (pts, f) => { const seg = []; let tl = 0; for (let i = 1; i < pts.length; i++) { const l = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]); seg.push(l); tl += l; }
      let d = Math.max(0, Math.min(1, f)) * tl; for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const a = pts[i], b = pts[i + 1], k = seg[i] ? d / seg[i] : 0; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; } d -= seg[i]; } return pts[pts.length - 1]; };
    const box = (b, c, th = 3, a = 1) => { g.globalAlpha = a; g.fillStyle = c; g.fillRect(b.x, b.y, b.w, th); g.fillRect(b.x, b.y + b.h - th, b.w, th); g.fillRect(b.x, b.y, th, b.h); g.fillRect(b.x + b.w - th, b.y, th, b.h); g.globalAlpha = 1; };
    const text = (t, x, y, f, c, al = 'left') => { g.font = f; g.fillStyle = c; g.textAlign = al; g.fillText(t, x, y); };
    function wire(pts, c, on, now) {
      const step = small ? 10 : 14, sz = small ? 3 : 4, off = (now / (on ? 22 : 60)) % step;
      g.fillStyle = c; g.globalAlpha = on ? .95 : .42;
      for (let i = 1; i < pts.length; i++) { const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], len = Math.abs(x2 - x1) + Math.abs(y2 - y1), dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
        for (let d = (i === 1 ? off : 0); d < len; d += step) g.fillRect(Math.round(x1 + dx * d - sz / 2), Math.round(y1 + dy * d - sz / 2), sz, sz); }
      g.globalAlpha = 1;
    }
    function head(x, y, d, c) { const s = small ? 3 : 4; g.fillStyle = c;
      if (d === 'd') { g.fillRect(x - s / 2, y - s * 2, s, s); g.fillRect(x - s * 1.5, y - s * 3, s * 3, s); g.fillRect(x - s * 2.5, y - s * 4, s * 5, s); }
      else { g.fillRect(x - s * 2, y - s / 2, s, s); g.fillRect(x - s * 3, y - s * 1.5, s, s * 3); g.fillRect(x - s * 4, y - s * 2.5, s, s * 5); } }
    // a packet runs one wire, then something happens where it lands
    function launchPacket(it) {
      const k = it.kind, sol = Number(it.sol || 0), dur = small ? 900 : 1250;
      if (k === 'claim') S.packets.push({ path: 'in', t0: performance.now(), dur, c: COL.claim, label: small ? '' : `${it.bud_name} +${fsol(sol)}`, done: () => { S.fedT = performance.now(); S.flash.fees = S.fedT; } });
      else if (k === 'burn' || k === 'drop' || k === 'dev') S.packets.push({ path: k, t0: performance.now(), dur, c: COL[k], label: small ? '' : `${fsol(sol)} SOL`, done: () => { S.flash[k] = performance.now(); S.tot[k] += sol; S.jobs++; spark(k); } });
      else if (k === 'launch' && / is live/.test(it.text || '')) { S.flash.fees = performance.now(); S.born.push({ t0: performance.now(), name: it.bud_name || 'a new bud' }); }
    }
    function spark(k) { const b = L.outs[k]; for (let i = 0; i < (small ? 6 : 12); i++) S.sparks.push(L.v ? { x: b.x + b.w / 2, y: b.y + 6, vx: (Math.random() - .5) * 110, vy: 20 + Math.random() * 70, t0: performance.now(), c: COL[k] } : { x: b.x + 6, y: b.y + b.h / 2, vx: 30 + Math.random() * 90, vy: (Math.random() - .5) * 110, t0: performance.now(), c: COL[k] }); }
    function feed(it, replay) { if (!['claim', 'burn', 'drop', 'dev', 'launch'].includes(it.kind)) return; S.queue.push({ it, replay }); if (replay) S.replay++; }
    function frame(now) {
      if (!alive) return; raf = requestAnimationFrame(frame);
      if (opt.isVisible && !opt.isVisible()) return;
      if (small && now - lastDraw < 30) return; lastDraw = now;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!L || !W || !bgc) return;
      // let one queued job out at a time so they read one by one
      if (S.queue.length && now - S.lastJob > (S.queue[0].replay ? 420 : 300)) { const q = S.queue.shift(); if (q.replay) S.replay--; S.lastJob = now; launchPacket(q.it); }
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bgc, 0, 0); g.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (!small) {
        const live = S.replay > 0 || S.queue.some(q => q.replay) ? 'REPLAY' : 'LIVE', on = (now / 700 | 0) % 2 === 0;
        g.fillStyle = live === 'LIVE' ? '#ff6b6b' : '#f2c14e'; if (on) g.fillRect(W - 66, 10, 8, 8); text(live, W - 54, 19, VT(17), live === 'LIVE' ? '#ff6b6b' : '#f2c14e');
        const tk = X.TICK ? `last pass ${ago(X.TICK)} ago` : 'engine: waiting for the first pass';
        text(tk, W - 82, 19, VT(16), '#4c7a5a', 'right');
        if (W >= 560) text(`jobs this visit ${String(S.jobs).padStart(3, '0')}`, Math.max(140, W * .32), 19, VT(16), '#2f8a52');
      }
      const busy = S.packets.length > 0;
      // wires
      wire(L.paths.in, COL.claim, S.packets.some(p => p.path === 'in'), now);
      for (const k of ['burn', 'drop', 'dev']) wire(L.paths[k], COL[k], S.packets.some(p => p.path === k), now);
      for (const [hx, hy, hd, hc] of L.heads) head(hx, hy, hd, hc);
      // fees in
      const fl = Math.max(0, 1 - (now - S.flash.fees) / 600), F = L.fees;
      g.fillStyle = 'rgba(242,193,78,' + (.05 + fl * .18) + ')'; g.fillRect(F.x, F.y, F.w, F.h); box(F, fl > 0 ? '#ffe8a3' : '#5cf08a');
      if (small) text('FEES', F.x + 10, F.y + 24, PX(15), '#eafff0');
      else if (L.v) { text('CREATOR FEES', F.x + 10, F.y + 26, PX(15), '#eafff0'); text('pump.fun vaults', F.x + 10, F.y + 48, VT(15), '#2f8a52'); }
      else { text('CREATOR', F.x + 10, F.y + 30, PX(16), '#eafff0'); text('FEES', F.x + 10, F.y + 58, PX(26), '#5cf08a'); }
      const cs = small ? 3 : 4; for (let k = 0; k < (small ? 3 : 4); k++) { const y = F.y + F.h - (small ? 12 : 16) - k * cs * 2.4, x = F.x + F.w - (small ? 26 : 36) + [0, 2, -2, 1][k]; g.fillStyle = '#6b5216'; g.fillRect(x, y, cs * 6, cs * 2.4); g.fillStyle = '#f2c14e'; g.fillRect(x, y, cs * 6, cs * 1.4); }
      // the bud
      const B = L.bud, fed = Math.max(0, 1 - (now - S.fedT) / 700);
      g.save(); g.shadowColor = '#5cf08a'; g.shadowBlur = 14 + fed * 24; box(B, '#5cf08a'); g.restore();
      g.fillStyle = 'rgba(92,240,138,' + (.03 + fed * .1) + ')'; g.fillRect(B.x + 3, B.y + 3, B.w - 6, B.h - 6);
      const spr = (fed > 0 || (busy && (now / 500 | 0) % 3 === 0)) ? X.SPR.bag : X.SPR.pet;
      if (spr) { const sc = Math.max(1, Math.floor(Math.min(B.w - 16, B.h - (small ? 10 : 34)) / 32)), sz = 32 * sc, bob = Math.round(Math.sin(now / 420) * (busy ? 2 : 1)) - Math.round(fed * 4);
        g.imageSmoothingEnabled = false; g.drawImage(spr, Math.round(B.x + (B.w - sz) / 2), Math.round(B.y + (B.h - sz) / 2 - (small ? 0 : 10) + bob), sz, sz); }
      if (!small) { text('THE BUD', B.x + B.w / 2, B.y + B.h - 10, PX(15), '#5cf08a', 'center'); if (!L.v) text(busy ? 'working' : 'watching the vaults', B.x + B.w / 2, B.y + B.h + 18, VT(15), '#2f8a52', 'center'); }
      // three ways out
      const NAMES = { burn: 'BURN', drop: 'DROP', dev: 'DEV' }, SUB = { burn: 'bought back, gone', drop: 'SOL to top 20', dev: 'paid to launcher' };
      for (const k of ['burn', 'drop', 'dev']) {
        const o = L.outs[k], f = Math.max(0, 1 - (now - S.flash[k]) / 650);
        g.fillStyle = COL[k]; g.globalAlpha = .06 + f * .22; g.fillRect(o.x, o.y, o.w, o.h); g.globalAlpha = 1; box(o, f > 0 ? '#ffffff' : COL[k], small ? 2 : 3);
        if (small) text(NAMES[k], o.x + 8, o.y + o.h / 2 + 5, PX(13), COL[k]);
        else if (L.v) { text(NAMES[k], o.x + 8, o.y + 24, PX(16), COL[k]); text(`${fsol(S.tot[k])}`, o.x + 8, o.y + 46, VT(17), '#eafff0'); }
        else { text(NAMES[k], o.x + 10, o.y + 24, PX(18), COL[k]); text(`${fsol(S.tot[k])} SOL`, o.x + o.w - 10, o.y + 24, VT(18), '#eafff0', 'right'); if (L.oh > 52) text(SUB[k], o.x + 10, o.y + o.h - 12, VT(15), '#4c7a5a'); }
      }
      // packets
      S.packets = S.packets.filter(p => {
        const k = (now - p.t0) / p.dur; if (k >= 1) { p.done && p.done(); return false; }
        const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, [x, y] = along(L.paths[p.path], e), s = small ? 6 : 10;
        g.save(); g.shadowColor = p.c; g.shadowBlur = 12; g.fillStyle = p.c; g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); g.restore();
        if (p.label) { g.font = VT(15); const tw = g.measureText(p.label).width + 8; g.fillStyle = 'rgba(2,10,5,.85)'; g.fillRect(Math.round(x - tw / 2), Math.round(y - 26), tw, 15); text(p.label, x, y - 15, VT(15), p.c, 'center'); }
        return true;
      });
      // sparks where a job lands
      S.sparks = S.sparks.filter(s => { const a = (now - s.t0) / 600; if (a >= 1) return false; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 160 * dt; g.globalAlpha = 1 - a; g.fillStyle = s.c; g.fillRect(Math.round(s.x), Math.round(s.y), 3, 3); g.globalAlpha = 1; return true; });
      // a new bud sprouts in the fees box
      S.born = S.born.filter(b => { const a = (now - b.t0) / 2200; if (a >= 1) return false; if (!small) { g.globalAlpha = a < .8 ? 1 : (1 - a) / .2; text(`+ ${b.name} woke up`, F.x + F.w / 2, F.y - 10 - a * 16, VT(16), '#c6ffd6', 'center'); g.globalAlpha = 1; } return true; });
      if (!small && !L.v && !busy && !S.queue.length && now - S.lastJob > 6000) { const msg = 'waiting for fees · the engine checks every minute', n = Math.min(msg.length, ((now - S.lastJob - 6000) / 40) | 0); text(msg.slice(0, n) + ((now / 500 | 0) % 2 ? '_' : ''), W / 2, H - 14, VT(16), '#4c7a5a', 'center'); }
    }
    const ro = new ResizeObserver(fit); ro.observe(wrap); fit(); raf = requestAnimationFrame(frame);
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => alive && fit());
    const offFeed = X.on('feed', it => feed(it)), offBuds = X.on('buds', syncTot);
    return { feed, replay(items) { items.slice().reverse().forEach(it => feed(it, true)); }, destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); offFeed(); offBuds(); cv.remove(); } };
  };

  // ================================================================ bagwork.sys: the machine, live, with the last jobs under it
  A.pipe = {
    title: 'bagwork.sys — live', short: 'bagwork.sys', icon: 'pipe', w: 780, h: 500, minW: 440, minH: 360,
    build(el) {
      el.innerHTML = `<div class="pp"><div class="pp-cvw"></div><div class="pp-log"></div></div>`;
      const pipe = X.makePipe($('.pp-cvw', el), { isVisible: () => visible('pipe') });
      const log = $('.pp-log', el);
      const row = (it, fresh) => `<div class="pp-row${fresh ? ' fresh' : ''}"><span class="mute">${esc(ago(it.at))}</span><a class="budl" data-bud="${esc(it.mint)}">${esc(it.bud_name)}</a><span class="k-${esc(it.kind)}">${esc(it.kind)}</span><span class="pp-x">${esc(it.text)}</span>${it.sig ? `<a class="tx" href="https://solscan.io/tx/${esc(it.sig)}" target="_blank" rel="noopener noreferrer">tx ↗</a>` : ''}</div>`;
      const fill = () => { const items = (X.RECENT || []).slice(0, 4); log.innerHTML = items.length ? items.map(it => row(it)).join('') : '<div class="pp-row mute">no jobs yet. when a bud claims fees, every job runs through here.</div>'; };
      fill(); pipe.replay((X.RECENT || []).slice(0, 8));
      X.on('feed', it => { if (!['claim', 'burn', 'drop', 'dev', 'launch'].includes(it.kind)) return; log.insertAdjacentHTML('afterbegin', row(it, true)); while (log.children.length > 4) log.lastChild.remove(); const e0 = log.querySelector('.mute:only-child'); if (e0 && log.children.length > 1) e0.parentElement.remove(); });
      log.addEventListener('click', e => { const a = e.target.closest('.budl'); if (a) { e.preventDefault(); X.openBud(a.dataset.bud); } });
    },
  };

  // ================================================================ stats.exe: the dashboard
  const ST = { d: null, view: 'hours', hover: -1, t0: 0, timer: 0, soon: 0 };
  A.stats = {
    title: 'stats.exe — the night shift in numbers', short: 'stats.exe', icon: 'stats', w: 820, h: 672, minW: 420, minH: 380,
    build(el) {
      const TILES = [['buds', 'buds working', ''], ['claimed', 'fees claimed', 'SOL'], ['burned', 'burned', 'SOL'], ['dropped', 'to holders', 'SOL'], ['dev', 'to devs', 'SOL'], ['jobs', 'jobs done', '']];
      el.innerHTML = `<div class="dash">
        <div class="st-top">${TILES.map(([k, t, u]) => `<div class="st-n st-${k}"><b data-k="${k}">0</b>${u ? `<small>${u}</small>` : ''}<span>${t}</span></div>`).join('')}</div>
        <div class="st-grid">
          <section class="st-card st-act"><header><span class="st-t">activity</span><span class="st-span dim"></span><span class="st-leg"><i class="k-burn">burn</i><i class="k-drop">drop</i><i class="k-dev">dev</i></span></header><div class="st-cvw"><canvas class="st-cv"></canvas><div class="st-tip" hidden></div></div></section>
          <section class="st-card st-where"><header><span class="st-t">where the fees went</span></header><div class="st-ringw"><canvas class="st-ring" width="48" height="48"></canvas><div class="st-rc"><b data-k="claimedc">0</b><span>SOL worked</span></div></div><ul class="st-split"></ul></section>
          <section class="st-card st-lead"><header><span class="st-t">top buds</span><span class="dim">by fees worked</span></header><ol class="st-board"></ol></section>
          <section class="st-card st-side"><header><span class="st-t">last 24 hours</span></header><dl class="st-day"></dl>
            <header><span class="st-t">engine</span></header><div class="st-eng off"><svg viewBox="0 0 120 22" class="st-ecg" aria-hidden="true"><polyline points="0,13 34,13 40,13 44,3 48,20 52,9 56,13 120,13"/></svg><span class="st-et dim">—</span></div>
            <header><span class="st-t">newest buds</span></header><ul class="st-new"></ul></section>
        </div></div>`;
      const cv = $('.st-cv', el), g = cv.getContext('2d'), tip = $('.st-tip', el); let W = 0, H = 0;
      const fit = () => { const r = cv.parentElement.getBoundingClientRect(), D = Math.min(2, devicePixelRatio || 1); W = Math.max(200, Math.round(r.width)); H = Math.max(110, Math.round(r.height)); cv.width = W * D; cv.height = H * D; cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.setTransform(D, 0, 0, D, 0, 0); draw(); };
      const series = () => { const d = ST.d; if (!d || !d.hours) return []; const quiet = d.hours.slice(1).every(b => !b.jobs && !b.claims && !b.launches); ST.view = quiet ? 'mins' : 'hours'; return (quiet ? d.mins : d.hours).slice().reverse(); };
      const M = { L: 40, R: 8, T: 10, B: 22 };
      function draw() {
        if (!W) return; const now = performance.now(), arr = series(), n = arr.length || 24;
        g.clearRect(0, 0, W, H);
        const cw = W - M.L - M.R, ch = H - M.T - M.B, tot = b => b.burn + b.drop + b.dev, max = Math.max(...arr.map(tot), 0);
        const stp = nice(Math.max(max, .003) / 3), top = Math.max(stp, Math.ceil(Math.max(max, .003) / stp) * stp);
        g.font = VT(14); g.textAlign = 'right';
        for (let k = 0; k <= 3; k++) { const v = top * k / 3, y = Math.round(M.T + ch - ch * v / top) + .5; g.strokeStyle = k ? 'rgba(92,240,138,.08)' : 'rgba(92,240,138,.3)'; g.beginPath(); g.moveTo(M.L, y); g.lineTo(W - M.R, y); g.stroke(); g.fillStyle = '#4c7a5a'; g.fillText(v ? trim(v) : '0', M.L - 6, y + 4); }
        const bw = cw / n, gap = Math.max(1, Math.round(bw * .24));
        let moving = false;
        arr.forEach((b, i) => {
          const k = Math.min(1, Math.max(0, (now - ST.t0 - i * 16) / 520)), e = 1 - Math.pow(1 - k, 3); if (k < 1) moving = true;
          const x = Math.round(M.L + i * bw + gap / 2), w = Math.max(1, Math.round(bw - gap)); let y = M.T + ch;
          if (i === ST.hover) { g.fillStyle = 'rgba(234,255,240,.07)'; g.fillRect(Math.round(M.L + i * bw), M.T, Math.ceil(bw), ch); }
          for (const kind of ['burn', 'drop', 'dev']) { const h = Math.round(ch * b[kind] / top * e); if (!h) continue; y -= h; g.fillStyle = COL[kind]; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y, w, 1); }
          if (b.launches) { g.fillStyle = COL.launch; g.fillRect(x + Math.floor(w / 2) - 1, M.T + ch + 4, 3, 3); }
        });
        g.font = VT(14); g.fillStyle = '#4c7a5a'; g.textAlign = 'left'; g.fillText(ST.view === 'mins' ? '60 min ago' : '24 h ago', M.L, H - 5); g.textAlign = 'center'; g.fillText(ST.view === 'mins' ? '30 min' : '12 h', M.L + cw / 2, H - 5); g.textAlign = 'right'; g.fillText('now', W - M.R, H - 5);
        $('.st-span', el).textContent = ST.view === 'mins' ? 'last hour · SOL per 2 min' : 'last 24 hours · SOL per hour';
        if (moving) requestAnimationFrame(draw);
      }
      cv.addEventListener('pointermove', e => {
        const r = cv.getBoundingClientRect(), x = e.clientX - r.left, arr = series(), n = arr.length || 24, i = Math.floor((x - M.L) / ((W - M.L - M.R) / n));
        const h = i >= 0 && i < n ? i : -1; if (h !== ST.hover) { ST.hover = h; draw(); }
        if (h < 0) { tip.hidden = true; return; } const b = arr[h], back = n - 1 - h;
        const when = ST.view === 'mins' ? (back ? `${back * 2}–${back * 2 + 2} min ago` : 'the last 2 minutes') : (back ? `${back}–${back + 1} h ago` : 'this hour');
        tip.innerHTML = `<b>${when}</b>${['burn', 'drop', 'dev'].map(k => `<div><span class="k-${k}">${k}</span><span>${fsol(b[k])} SOL</span></div>`).join('')}<div class="dim"><span>claims · jobs</span><span>${b.claims} · ${b.jobs}</span></div>${b.launches ? `<div class="dim"><span>new buds</span><span>${b.launches}</span></div>` : ''}`;
        tip.hidden = false; tip.style.left = Math.min(W - 170, Math.max(0, x + 12)) + 'px'; tip.style.top = '8px';
      });
      cv.addEventListener('pointerleave', () => { ST.hover = -1; tip.hidden = true; draw(); });
      // the ring: where every claimed SOL went, as a pixel donut
      const rc = $('.st-ring', el), rg = rc.getContext('2d');
      function ring(k = 1) {
        const t = (ST.d && ST.d.totals) || {}, parts = [['burn', t.burned || 0], ['drop', t.dropped || 0], ['dev', t.dev || 0]], sum = parts.reduce((s, p) => s + p[1], 0), N = 48, c = N / 2;
        const img = rg.createImageData(N, N), hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const dx = x + .5 - c, dy = y + .5 - c, r = Math.hypot(dx, dy); if (r < 14 || r > 22) continue;
          let a = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1, col = [16, 46, 28];
          if (sum > 0 && a <= k) { let acc = 0; for (const [kind, v] of parts) { acc += v / sum; if (a <= acc + 1e-9) { col = hex(COL[kind]); break; } } }
          const i = (y * N + x) * 4; img.data.set([...col, 255], i);
        }
        rg.putImageData(img, 0, 0);
        $('.st-split', el).innerHTML = parts.map(([kind, v]) => `<li><i style="background:${COL[kind]}"></i><b class="k-${kind}">${kind}</b><span>${fsol(v)} SOL</span><em>${sum ? Math.round(v / sum * 100) : 0}%</em></li>`).join('');
      }
      function ringAnim() { const t0 = performance.now(); const st = now => { const k = Math.min(1, (now - t0) / 800); ring(1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(st); }; requestAnimationFrame(st); }
      function render(first) {
        const d = ST.d; if (!d) return; const t = d.totals || {};
        const fmt = { buds: v => String(Math.round(v)), jobs: v => String(Math.round(v)), claimed: fsol, burned: fsol, dropped: fsol, dev: fsol };
        $$('.st-top b[data-k]', el).forEach(b => X.fx.countTo(b, t[b.dataset.k] || 0, fmt[b.dataset.k]));
        X.fx.countTo($('[data-k=claimedc]', el), (t.burned || 0) + (t.dropped || 0) + (t.dev || 0), fsol);
        if (first) { ST.t0 = performance.now(); ringAnim(); } else ring(1);
        draw();
        const top = d.top || [], mx = Math.max(.000001, ...top.map(b => b.claimed));
        $('.st-board', el).innerHTML = top.length ? top.map((b, i) => `<li data-m="${esc(b.mint)}" style="--i:${i}"><span class="rk">${i + 1}</span><img src="${X.avatarURL(b.mint, 24)}" alt=""><span class="nm"><b>${esc(b.budName)}</b><i>$${esc(b.symbol)}</i></span>${lvl(b.level)}<span class="bar"><i style="width:${Math.max(2, b.claimed / mx * 100).toFixed(1)}%"></i></span><b class="am">${fsol(b.claimed)}</b></li>`).join('')
          : `<li class="empty">no buds yet. the first one to launch is on top.</li>`;
        if (first) X.fx.stagger($$('.st-board li', el), 'in', 45, 150);
        const dd = d.day || {};
        $('.st-day', el).innerHTML = [['fees claimed', `${fsol(dd.claimed || 0)} SOL`], ['claims', dd.claims || 0], ['jobs', dd.jobs || 0], ['new buds', dd.launches || 0], ['buds that worked', dd.working || 0]].map(([k, v]) => `<dt>${k}</dt><dd>${esc(String(v))}</dd>`).join('');
        const tk = d.tickAt || X.TICK, age = tk ? (Date.now() - tk) / 1000 : null, eng = $('.st-eng', el);
        eng.className = 'st-eng ' + (age == null ? 'off' : age < 180 ? 'ok' : 'late'); $('.st-et', el).textContent = age == null ? 'no pass yet' : `last pass ${ago(tk)} ago`;
        $('.st-new', el).innerHTML = (d.fresh || []).map(b => `<li data-m="${esc(b.mint)}"><img src="${X.avatarURL(b.mint, 20)}" alt=""><b>${esc(b.budName)}</b><i>$${esc(b.symbol)}</i><span class="mute">${esc(ago(b.liveAt))}</span></li>`).join('') || '<li class="mute">none yet</li>';
      }
      async function load(first) { try { ST.d = await api('stats'); render(first); } catch (e) { if (first) $('.st-board', el).innerHTML = `<li class="empty">${esc(e.message)}</li>`; } }
      el.addEventListener('click', e => { const li = e.target.closest('li[data-m]'); if (li) X.openBud(li.dataset.m); });
      new ResizeObserver(fit).observe(cv.parentElement);
      X.on('feed', () => { clearTimeout(ST.soon); ST.soon = setTimeout(() => { if (visible('stats')) load(false); }, 3500); });
      ST.load = load; load(true);
      clearInterval(ST.timer); ST.timer = setInterval(() => { if (visible('stats')) load(false); }, 20000);
    },
    open(arg, w) { if (ST.load && w && w.dataset.seen) { ST.t0 = performance.now(); ST.load(true); } if (w) w.dataset.seen = '1'; },
  };
  return A;
}
