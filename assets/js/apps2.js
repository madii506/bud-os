// more windows: the greenhouse (every bud in a pot, sized by its level), bagwork.exe (a small game) and paint.exe.
export function installMore(X) {
  const { $, $$, esc, fsol, SOUND, ICONS } = X;
  const A = {};

  // ================================================================ greenhouse: every bud in a pot on the shelves
  A.greenhouse = {
    title: 'greenhouse — watch them grow', short: 'greenhouse', icon: 'greenhouse', w: 780, h: 520, minW: 360, minH: 300,
    build(el) {
      el.innerHTML = `<div class="gh"><canvas></canvas><div class="gh-tip" hidden></div><div class="gh-empty" hidden><p>no buds planted yet.</p><button class="btn go" type="button">plant the first one</button></div></div>`;
      const cv = $('canvas', el), g = cv.getContext('2d'), tip = $('.gh-tip', el); let W = 0, H = 0, slots = [], hover = null, mx = -1, my = -1, raf = 0;
      $('.gh-empty button', el).onclick = () => X.open('launch');
      const SC = { rookie: 1, grinder: 1.25, workhorse: 1.5, legend: 1.85 };
      function layout() {
        const r = el.getBoundingClientRect(); W = cv.width = Math.max(200, r.width); H = cv.height = Math.max(160, r.height);
        const buds = X.BUDS.slice().sort((a, b) => b.claimed - a.claimed), per = Math.max(3, Math.floor((W - 40) / 96)), shelves = Math.max(2, Math.ceil(buds.length / per)), sh = Math.max(150, (H - 30) / Math.min(shelves, 3));
        slots = buds.map((b, i) => ({ b, x: 40 + (i % per) * ((W - 80) / Math.max(1, per - 1 || 1)), y: 30 + (Math.floor(i / per) + 1) * sh - 18, s: SC[b.level] || 1, ph: Math.random() * 6 }));
        if (per === 1) slots.forEach(s => s.x = W / 2);
        $('.gh-empty', el).hidden = buds.length > 0;
        X.GH_SH = sh;
      }
      function draw(now) {
        raf = requestAnimationFrame(draw); if (!document.body.contains(cv) || !X.WM.isOpen('greenhouse')) return;
        g.fillStyle = '#030a06'; g.fillRect(0, 0, W, H);
        const sh = X.GH_SH || 160;
        for (let y = 30 + sh - 18; y < H + sh; y += sh) {
          // a grow bar above, its light falling onto the shelf, then the shelf
          const top = y - sh + 26; const gr = g.createLinearGradient(0, top, 0, y); gr.addColorStop(0, 'rgba(92,240,138,.18)'); gr.addColorStop(1, 'rgba(92,240,138,0)'); g.fillStyle = gr; g.fillRect(20, top, W - 40, y - top);
          g.fillStyle = '#c8ffd8'; g.shadowColor = '#5cf08a'; g.shadowBlur = 16; g.fillRect(30, top - 3, W - 60, 3); g.shadowBlur = 0;
          g.fillStyle = '#1a2a22'; g.fillRect(14, y, W - 28, 8); g.fillStyle = '#0c1611'; g.fillRect(14, y + 8, W - 28, 4);
        }
        g.imageSmoothingEnabled = false; hover = null;
        for (const s of slots) {
          const size = 44 * s.s, bob = Math.round(Math.sin(now / 600 + s.ph) * 1.5), x = s.x - size / 2, y = s.y - size - 14 + bob;
          // the pot
          g.fillStyle = '#7a3f22'; g.fillRect(s.x - 18, s.y - 16, 36, 4); g.fillStyle = '#a85a32'; g.fillRect(s.x - 15, s.y - 12, 30, 12);
          if (s.b.level === 'legend') { g.shadowColor = 'rgba(242,193,78,.8)'; g.shadowBlur = 22; }
          const working = s.b.workedAt && Date.now() - new Date(s.b.workedAt) < 30 * 60e3;
          g.drawImage(X.tinted(working && (now / 900 | 0) % 6 === 0 ? X.SPR.bag : X.SPR.pet, X.hueOf(s.b.mint)) || X.SPR.pet, x, y, size, size); g.shadowBlur = 0;
          const over = mx > x && mx < x + size && my > y && my < s.y; if (over) hover = s;
          g.fillStyle = over ? '#eafff0' : 'rgba(180,230,195,.75)'; g.font = '12px PX, monospace'; g.textAlign = 'center'; g.fillText(s.b.budName, s.x, s.y + 22);
          if (working && (now / 300 | 0) % 8 === 0) { g.fillStyle = '#f2c14e'; g.fillRect(s.x + size / 3, y - 6 - ((now / 60) % 10), 3, 3); }
        }
        cv.style.cursor = hover ? 'pointer' : 'default';
        if (hover) { tip.hidden = false; const b = hover.b; tip.innerHTML = `<b>${esc(b.budName)}</b> <span class="lvl ${esc(b.level)}">${esc(b.level)}</span><br><span class="ok">$${esc(b.symbol)}</span> · claimed <b class="am">${fsol(b.claimed)} SOL</b><br><small class="dim">${esc(b.last || 'waiting for fees')}</small>`;
          tip.style.left = Math.min(W - 230, Math.max(4, hover.x - 110)) + 'px'; tip.style.top = Math.max(4, hover.y - 44 * hover.s - 96) + 'px'; } else tip.hidden = true;
      }
      cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
      cv.addEventListener('pointerleave', () => { mx = my = -1; });
      cv.addEventListener('click', () => { if (hover) X.openBud(hover.b.mint); });
      X.on('buds', layout); new ResizeObserver(layout).observe(el); layout(); raf = requestAnimationFrame(draw);
    },
  };

  // ================================================================ bagwork.exe: catch the bags, dodge the red candles
  A.bagwork = {
    title: 'bagwork.exe', short: 'bagwork.exe', icon: 'bagwork', w: 460, h: 470, nomax: true, noresize: true,
    build(el) {
      el.innerHTML = `<div class="game"><div class="g-hud"><span>score <b class="g-s">0</b></span><span>best <b class="g-b">0</b></span><span class="g-l"></span></div><canvas width="420" height="360"></canvas><p class="hint">← → or drag to move. coins +1, bags +5. red candles cost a life.</p></div>`;
      const cv = $('canvas', el), g = cv.getContext('2d'), W = 420, H = 360;
      let st = 'title', px = W / 2, score = 0, best = +(X.ls.get('bud:best') || 0), lives = 3, items = [], t0 = 0, last = 0, keys = {}, spawnT = 0, raf = 0, hurtT = 0, fx = [];
      $('.g-b', el).textContent = best;
      const lifeH = () => { $('.g-l', el).innerHTML = '♥'.repeat(lives).replace(/♥/g, '<b class="bad">♥</b>') + '<span class="mute">' + '♥'.repeat(3 - lives) + '</span>'; };
      const start = () => { st = 'play'; score = 0; lives = 3; items = []; t0 = performance.now(); spawnT = 0; lifeH(); $('.g-s', el).textContent = 0; SOUND.sfx('beep'); };
      const key = (e, v) => { const w = X.WM.wins.bagwork; if (!w || !w.classList.contains('active') || !w.classList.contains('open')) return; if (['ArrowLeft', 'ArrowRight', 'a', 'd', ' '].includes(e.key)) { e.preventDefault(); keys[e.key] = v; if (v && e.key === ' ' && st !== 'play') start(); } };
      addEventListener('keydown', e => key(e, true)); addEventListener('keyup', e => key(e, false));
      cv.addEventListener('pointerdown', e => { if (st !== 'play') start(); cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType !== 'mouse') { const r = cv.getBoundingClientRect(); px = (e.clientX - r.left) / r.width * W; } });
      function spawn(el2) { const k = Math.random(), lvl = Math.min(1, el2 / 60); items.push({ x: 20 + Math.random() * (W - 40), y: -20, v: 70 + lvl * 110 + Math.random() * 40, t: k < .62 ? 'coin' : k < .72 ? 'bag' : 'candle' }); }
      function draw(now) {
        raf = requestAnimationFrame(draw); if (!document.body.contains(cv)) return cancelAnimationFrame(raf);
        const dt = Math.max(0, Math.min(.05, (now - (last || now)) / 1000)); last = now;
        g.fillStyle = '#030a06'; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(92,240,138,.06)'; for (let x = 0; x < W; x += 20) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); }
        g.fillStyle = '#0e2416'; g.fillRect(0, H - 22, W, 22); g.fillStyle = '#2a6e42'; g.fillRect(0, H - 22, W, 2);
        if (st === 'play') {
          const el2 = (now - t0) / 1000; if ((keys.ArrowLeft || keys.a)) px -= 260 * dt; if ((keys.ArrowRight || keys.d)) px += 260 * dt; px = Math.max(22, Math.min(W - 22, px));
          spawnT -= dt; if (spawnT <= 0) { spawn(el2); spawnT = Math.max(.28, .9 - el2 / 90); }
          for (const it of items) it.y += it.v * dt;
          items = items.filter(it => {
            if (it.y > H - 52 && it.y < H - 18 && Math.abs(it.x - px) < 26) {
              if (it.t === 'candle') { lives--; lifeH(); SOUND.sfx('hurt'); hurtT = now; if (lives <= 0) { st = 'over'; if (score > best) { best = score; X.ls.set('bud:best', best); $('.g-b', el).textContent = best; SOUND.sfx('chime'); } } }
              else { const p = it.t === 'bag' ? 5 : 1; score += p; $('.g-s', el).textContent = score; SOUND.sfx('coin'); fx.push({ x: it.x, y: it.y, t: now, p }); }
              return false;
            }
            return it.y < H;
          });
        }
        g.imageSmoothingEnabled = false;
        for (const it of items) {
          if (it.t === 'coin') { g.fillStyle = '#8f5a17'; g.fillRect(it.x - 7, it.y - 7, 14, 14); g.fillStyle = '#f2c14e'; g.fillRect(it.x - 6, it.y - 6, 12, 12); g.fillStyle = '#fff1a6'; g.fillRect(it.x - 4, it.y - 4, 3, 3); }
          else if (it.t === 'bag') { g.drawImage(X.SPR.bag, 21, 7, 11, 17, it.x - 11, it.y - 17, 22, 34); }
          else { g.fillStyle = '#ff6b6b'; g.fillRect(it.x - 5, it.y - 14, 10, 28); g.fillRect(it.x - 1, it.y - 22, 2, 44); }
        }
        const flash = now - hurtT < 300 && (now / 60 | 0) % 2;
        if (!flash) g.drawImage(X.SPR.bag, px - 30, H - 22 - 56, 60, 60);
        fx = fx.filter(f => now - f.t < 600); for (const f of fx) { g.fillStyle = `rgba(242,193,78,${1 - (now - f.t) / 600})`; g.font = '16px PX, monospace'; g.textAlign = 'center'; g.fillText('+' + f.p, f.x, f.y - (now - f.t) / 20); }
        if (st !== 'play') {
          g.fillStyle = 'rgba(2,8,4,.72)'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.fillStyle = '#5cf08a'; g.font = '30px PX, monospace';
          g.fillText(st === 'title' ? 'bagwork.exe' : 'the bag dropped.', W / 2, H / 2 - 30);
          g.font = '15px PX, monospace'; g.fillStyle = '#c6ffd6'; g.fillText(st === 'title' ? 'catch the bags. dodge the red candles.' : `score ${score} · best ${best}`, W / 2, H / 2 + 2);
          g.fillStyle = '#7fa98b'; g.fillText((now / 500 | 0) % 2 ? 'press space or tap to start' : '', W / 2, H / 2 + 34);
        }
      }
      lifeH(); raf = requestAnimationFrame(draw);
    },
  };

  // ================================================================ paint.exe: a 32×32 coin picture
  A.paint = {
    title: 'paint.exe — untitled.bud', short: 'paint.exe', icon: 'paint', w: 600, h: 500, minW: 420, minH: 420,
    build(el) {
      const PAL = ['#000000', '#1b2a23', '#5b6b63', '#d9e6dc', '#ffffff', '#0b3d1f', '#1d8a45', '#5cf08a', '#c6ffd6', '#7fe3c4', '#2f8a72', '#f2c14e', '#a8721c', '#ff6b6b', '#b5653a', '#6e3a1f'];
      const N = 32; let grid = Array(N * N).fill(null), col = '#5cf08a', tool = 'pen', down = false;
      el.innerHTML = `<div class="paint"><div class="pt-tools">${[['pen', 'pencil'], ['fill', 'fill'], ['erase', 'eraser']].map(([k, t]) => `<button type="button" class="chip ${k === 'pen' ? 'on' : ''}" data-t="${k}">${t}</button>`).join('')}<button type="button" class="chip" data-x="bud">start from a bud</button><button type="button" class="chip" data-x="clear">clear</button></div>
        <div class="pt-main"><canvas class="pt-c" width="512" height="512"></canvas><div class="pt-pal">${PAL.map(c => `<button type="button" style="background:${c}" data-c="${c}" title="${c}"></button>`).join('')}</div></div>
        <div class="pt-f"><span class="dim">draw a coin picture, then send it to launch.exe</span><button class="btn go" type="button" data-x="use">use as coin picture</button></div></div>`;
      const cv = $('.pt-c', el), g = cv.getContext('2d');
      const paint = () => { g.fillStyle = '#06120b'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < N * N; i++) if (grid[i]) { g.fillStyle = grid[i]; g.fillRect((i % N) * 16, (i / N | 0) * 16, 16, 16); }
        g.strokeStyle = 'rgba(92,240,138,.07)'; g.beginPath(); for (let k = 0; k <= N; k++) { g.moveTo(k * 16 + .5, 0); g.lineTo(k * 16 + .5, 512); g.moveTo(0, k * 16 + .5); g.lineTo(512, k * 16 + .5); } g.stroke(); };
      const at = e => { const r = cv.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) / r.width * N), y = Math.floor((e.clientY - r.top) / r.height * N); return x >= 0 && y >= 0 && x < N && y < N ? y * N + x : -1; };
      const fill = (i, from, to) => { if (from === to) return; const st = [i]; while (st.length) { const k = st.pop(); if (k < 0 || k >= N * N || grid[k] !== from) continue; grid[k] = to; const x = k % N; st.push(k - N, k + N); if (x > 0) st.push(k - 1); if (x < N - 1) st.push(k + 1); } };
      const act = e => { const i = at(e); if (i < 0) return; if (tool === 'fill') { fill(i, grid[i], col); down = false; } else grid[i] = tool === 'erase' ? null : col; paint(); };
      cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); act(e); SOUND.sfx('tick'); });
      cv.addEventListener('pointermove', e => { if (down && tool !== 'fill') act(e); });
      cv.addEventListener('pointerup', () => down = false);
      $$('[data-t]', el).forEach(b => b.onclick = () => { tool = b.dataset.t; $$('[data-t]', el).forEach(x => x.classList.toggle('on', x === b)); });
      $$('[data-c]', el).forEach(b => b.onclick = () => { col = b.dataset.c; $$('[data-c]', el).forEach(x => x.classList.toggle('on', x === b)); if (tool === 'erase') { tool = 'pen'; $$('[data-t]', el).forEach(x => x.classList.toggle('on', x.dataset.t === 'pen')); } });
      $('[data-x=clear]', el).onclick = () => { grid.fill(null); paint(); };
      $('[data-x=bud]', el).onclick = () => { const c = document.createElement('canvas'); c.width = c.height = N; const q = c.getContext('2d'); q.drawImage(X.SPR.pet, 0, 0, N, N); const d = q.getImageData(0, 0, N, N).data; for (let i = 0; i < N * N; i++) grid[i] = d[i * 4 + 3] > 100 ? `rgb(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]})` : grid[i]; paint(); };
      $('[data-x=use]', el).onclick = () => { const c = document.createElement('canvas'); c.width = c.height = 512; const q = c.getContext('2d'); q.fillStyle = '#06120b'; q.fillRect(0, 0, 512, 512); for (let i = 0; i < N * N; i++) if (grid[i]) { q.fillStyle = grid[i]; q.fillRect((i % N) * 16, (i / N | 0) * 16, 16, 16); } X.emit('paint:use', c.toDataURL('image/png')); };
      paint(); $(`[data-c="${col}"]`, el).classList.add('on');
    },
  };
  return A;
}
