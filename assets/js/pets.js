// The buds on the taskbar. Each one walks, stops, blinks, and when its bud does a real job it picks up the bag
// and says what it did. Click one to open its chat; pick one up and drop it.
export function installPets(X) {
  const { $, esc, SPR, tinted, hueOf, walkFrames } = X;
  const layer = $('#pets'); if (!layer || !SPR.pet) return;
  const MAX = X.MOBILE ? 3 : 6, S = X.MOBILE ? 40 : 48, pets = new Map();
  const IDLE = ['bagwork.', 'still here.', 'fees?', 'i don’t sleep.', '…', 'buying back.', 'checking the chart.', 'launch a coin. i need a friend.'];
  function make(key, b) {
    const el = document.createElement('div'); el.className = 'pet'; el.style.width = S + 'px'; el.style.height = S + 'px';
    const c = document.createElement('canvas'); c.width = 32; c.height = 33; el.appendChild(c);
    const tag = document.createElement('span'); tag.className = 'ptag'; tag.textContent = b ? b.budName : 'bud'; el.appendChild(tag);
    const say = document.createElement('div'); say.className = 'psay'; el.appendChild(say);
    layer.appendChild(el);
    const hue = hueOf(key), walk = walkFrames(tinted(SPR.pet, hue)), bag = walkFrames(tinted(SPR.bag, hue));
    const p = { key, b, el, c, g: c.getContext('2d'), tag, say, walk, bag, x: Math.random() * (innerWidth - S - 260) + 120, v: 0, dir: Math.random() < .5 ? -1 : 1, state: 'idle', t: 0, f: 0, bagT: 0, sayT: 0, y: 0, vy: 0, drag: false, blink: 0 };
    el.addEventListener('pointerdown', e => { e.preventDefault(); p.drag = true; p.dragged = false; el.setPointerCapture(e.pointerId); const ox = e.clientX - p.x;
      const mv = ev => { p.dragged = true; p.x = ev.clientX - ox; p.y = Math.max(0, innerHeight - ev.clientY - 60); };
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); p.drag = false; if (!p.dragged && p.b) X.openBud(p.b.mint); else if (!p.dragged) speak(p, IDLE[Math.random() * IDLE.length | 0]); X.SOUND.sfx('squeak'); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); });
    pets.set(key, p); return p;
  }
  function speak(p, text, ms = 4200) { pets.forEach(q => { if (q !== p && Math.abs(q.x - p.x) < 230 && q.say.classList.contains('on')) { q.say.classList.remove('on'); q.sayT = 0; } }); p.say.textContent = text; p.say.classList.add('on'); p.sayT = performance.now() + ms; }
  function sync() {
    if (!X.SET.pets) { pets.forEach(p => p.el.remove()); pets.clear(); return; }
    const live = X.BUDS.filter(b => b.state === 'live').sort((a, b) => new Date(b.workedAt || b.liveAt || 0) - new Date(a.workedAt || a.liveAt || 0)).slice(0, MAX);
    const want = new Set(live.map(b => b.mint)); if (!live.length) want.add('__house');
    pets.forEach((p, k) => { if (!want.has(k) && !p.pinned) { p.el.remove(); pets.delete(k); } });
    live.forEach(b => { const p = pets.get(b.mint) || make(b.mint, b); p.b = b; p.tag.textContent = b.budName; });
    if (!live.length && !pets.has('__house')) { const p = make('__house', null); setTimeout(() => speak(p, 'no buds yet. launch one.'), 2500); }
  }
  X.on('buds', sync); X.on('settings', sync); sync();
  X.on('feed', it => { const p = pets.get(it.mint); if (!p) return; p.bagT = performance.now() + 5000; speak(p, it.text.length > 46 ? it.text.slice(0, 44) + '…' : it.text, 5000); p.state = 'walk'; p.v = 60; });
  X.on('pet:spawn', key => {
    const b = key ? X.budBy(key) : X.BUDS[Math.random() * X.BUDS.length | 0];
    const k = b ? b.mint : '__extra' + Math.random(); const p = pets.get(k) || make(k, b || null); p.pinned = true; p.x = innerWidth / 2; p.y = 120; p.vy = 0; speak(p, b ? `${b.budName} reporting for bagwork.` : 'hi.');
  });
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame); const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; if (document.hidden) return;
    const W = innerWidth;
    pets.forEach(p => {
      if (!p.drag) {
        p.t -= dt;
        if (p.t <= 0) { const r = Math.random(); p.state = r < .55 ? 'walk' : r < .85 ? 'idle' : 'hop'; p.t = 1.5 + Math.random() * 4; p.v = 20 + Math.random() * 30; if (Math.random() < .4) p.dir *= -1; if (p.state === 'hop' && p.y === 0) p.vy = 160; if (Math.random() < .06 && !p.say.classList.contains('on')) speak(p, IDLE[Math.random() * IDLE.length | 0], 2600); }
        if (p.state === 'walk' || p.bagT > now) p.x += p.dir * p.v * dt;
        if (p.x < 100) { p.x = 100; p.dir = 1; } if (p.x > W - S - 220) { p.x = W - S - 220; p.dir = -1; }
        if (p.y > 0 || p.vy) { p.vy -= 520 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y === 0) p.vy = 0; }
      }
      const moving = p.state === 'walk' || p.bagT > now || p.drag;
      p.f += dt * (moving ? 6 : 1.2); p.blink -= dt; if (p.blink < -.12) p.blink = 2 + Math.random() * 4;
      const frames = p.bagT > now ? p.bag : p.walk, fr = frames[moving ? Math.abs(p.f | 0) % 2 : 0] || frames[0];
      p.g.clearRect(0, 0, 32, 33); p.g.drawImage(fr, 0, 0);
      if (p.blink < 0) { p.g.fillStyle = '#2c8a4c'; p.g.fillRect(6, 15, 3, 3); p.g.fillRect(12, 15, 3, 3); }
      p.el.style.transform = `translate(${p.x}px, ${-S - p.y}px) scaleX(${p.dir < 0 ? -1 : 1})`;
      p.say.style.transform = `translateX(-50%) scaleX(${p.dir < 0 ? -1 : 1})`; p.tag.style.transform = `translateX(-50%) scaleX(${p.dir < 0 ? -1 : 1})`;
      if (p.sayT && now > p.sayT) { p.say.classList.remove('on'); p.sayT = 0; }
    });
  }
  requestAnimationFrame(frame);
}
