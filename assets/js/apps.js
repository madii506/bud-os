// bud OS windows: welcome, launch.exe, the buddy list, a chat with every bud, the ledger, readme, display, recycle bin.
import { installMore } from './apps2.js?v=1';

export function installApps(X) {
  const { $, $$, esc, api, fsol, ftok, ago, short, solscan, pumpfun, acct, SOUND, ICONS, WAL } = X;
  const link = (href, text, cls = 'tx') => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
  const lvl = l => `<span class="lvl ${esc(l)}">${esc(l)}</span>`;
  const A = {};

  // ================================================================ welcome
  A.welcome = {
    title: 'welcome to bud OS', short: 'welcome', icon: 'welcome', w: 580, h: 540, nomax: true,
    build(el) {
      el.innerHTML = `<div class="wel">
        <div class="wel-hero"><canvas class="wel-bud" width="96" height="96"></canvas><div><h2 class="h">every coin gets a bud.</h2><p class="sub">it does the bagwork while you sleep.</p></div></div>
        <p>launch a pump.fun coin here and it comes with a <b class="ok">bud</b>: its own wallet, set as the coin’s creator. every minute the bud claims the creator fees and does the bagwork you picked:</p>
        <ul class="wel-jobs"><li><b class="k-burn">burn</b> buys the coin back and burns it</li><li><b class="k-drop">drop</b> sends SOL to the top 20 holders</li><li><b class="k-dev">dev</b> pays you, the launcher</li></ul>
        <p class="dim">you pick the mix once. it’s locked forever. every job is a public transaction.</p>
        <div class="wel-stats"></div>
        <div class="wel-go"><button class="btn go" data-o="launch">launch a coin</button><button class="btn" data-o="buds">meet the buds</button><button class="btn" data-o="term">open the terminal</button></div>
        <label class="wel-no"><input type="checkbox"> don’t show this again</label></div>`;
      $$('[data-o]', el).forEach(b => b.onclick = () => { X.open(b.dataset.o); });
      const cb = $('.wel-no input', el); cb.checked = X.ls.get('bud:nowelcome') === '1'; cb.onchange = () => X.ls.set('bud:nowelcome', cb.checked ? '1' : '0');
      const stats = () => { const t = X.TOTALS || {}; $('.wel-stats', el).innerHTML = [['buds working', t.buds ?? '—'], ['fees claimed', t.claimed != null ? fsol(t.claimed) + ' SOL' : '—'], ['burned with', t.burned != null ? fsol(t.burned) + ' SOL' : '—'], ['dropped to holders', t.dropped != null ? fsol(t.dropped) + ' SOL' : '—']].map(([k, v]) => `<div><b>${esc(String(v))}</b><span>${esc(k)}</span></div>`).join(''); };
      stats(); X.on('buds', stats);
      // the bud in the corner blinks and looks at your mouse
      const c = $('.wel-bud', el), g = c.getContext('2d'); let mx = 0, t = 0;
      addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); mx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 200)); }, { passive: true });
      const draw = () => { if (!document.body.contains(c)) return; t++; g.clearRect(0, 0, 96, 96); g.imageSmoothingEnabled = false; const img = X.SPR.pet; if (img) { g.drawImage(img, 0, Math.round(Math.sin(t / 14)) * 2, 96, 96); } setTimeout(() => requestAnimationFrame(draw), 60); };
      draw();
    },
  };

  // ================================================================ launch.exe
  const L = { s: 0, img: null, mix: { burn: 50, drop: 30, dev: 20 }, dev: .1, id: null, poll: 0 };
  A.launch = {
    title: 'launch.exe — plant a coin', short: 'launch.exe', icon: 'launch', w: 660, h: 610, minW: 420, minH: 420,
    build(el) {
      el.innerHTML = `<div class="lw">
        <ol class="steps"><li data-i="0">coin</li><li data-i="1">bud</li><li data-i="2">pay</li><li data-i="3">live</li></ol>
        <div class="lw-body scroll">
        <section data-s="0">
          <div class="lw-grid"><div>
            <label class="field"><span>name</span><input name="name" maxlength="32" placeholder="night shift"></label>
            <label class="field"><span>ticker</span><input name="symbol" maxlength="10" placeholder="SHIFT" style="text-transform:uppercase"></label>
            <label class="field"><span>description <i class="hint">optional</i></span><textarea name="description" maxlength="400" rows="3" placeholder="what is this coin about?"></textarea></label>
          </div><div class="lw-img"><div class="drop" tabindex="0"><img alt=""><span>drop a picture<br><small>or pick one below</small></span></div>
            <div class="lw-imgb"><label class="btn ghost">upload<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label><button class="btn ghost" data-x="face" type="button">bud face</button><button class="btn ghost" data-x="paint" type="button">paint</button></div></div></div>
          <details class="lw-soc"><summary>links <i class="hint">optional</i></summary>
            <label class="field"><span>X</span><input name="twitter" placeholder="https://x.com/yourcoin"></label>
            <label class="field"><span>telegram</span><input name="telegram" placeholder="https://t.me/yourcoin"></label>
            <label class="field"><span>website</span><input name="website" placeholder="https://… (blank = this bud’s page here)"></label></details>
        </section>
        <section data-s="1" hidden>
          <div class="lw-bud"><canvas class="lw-av" width="72" height="72"></canvas><div><label class="field"><span>your bud’s name <i class="hint">optional</i></span><div class="row"><input name="budName" maxlength="16" placeholder="moss.27"><button class="btn ghost" type="button" data-x="dice" title="random name">⚄</button></div></label></div></div>
          <h3 class="h3">the mix <i class="hint">what the bud does with every claim. locked at launch.</i></h3>
          <div class="mixbar"><i class="mb-burn"></i><i class="mb-drop"></i><i class="mb-dev"></i></div>
          ${['burn', 'drop', 'dev'].map(k => `<label class="mix"><b class="k-${k}">${k}</b><input type="range" min="0" max="100" step="5" data-k="${k}"><output></output><small>${{ burn: 'buy the coin back and burn it', drop: 'SOL to the top 20 holders', dev: 'paid to you' }[k]}</small></label>`).join('')}
          <div class="mixsay"></div>
          <p class="hint">the dev cut is <span class="devcap">50</span>% at most, so at least half of every claim goes back to the chart and the holders.</p>
        </section>
        <section data-s="2" hidden>
          <label class="field"><span>first buy <i class="hint">the coin’s first purchase. the tokens go to your wallet.</i></span>
            <div class="row"><input name="dev" type="number" min="0.01" max="10" step="0.01" value="0.1"><span class="unit">SOL</span>${[.05, .1, .5, 1].map(v => `<button class="chip" type="button" data-dev="${v}">${v}</button>`).join('')}</div></label>
          <table class="cost"></table>
          <div class="lw-wal"></div>
          <label class="lw-ok"><input type="checkbox" name="agree"> i get it: the bud’s wallet is held by the bud engine. it can only claim, buy back, burn, drop to holders and pay me, by the mix above. it never sells.</label>
          <div class="lw-err bad"></div>
        </section>
        <section data-s="3" hidden>
          <div class="grow"><canvas class="lw-grow" width="120" height="120"></canvas><div class="lw-steps"></div></div>
          <div class="lw-done"></div>
        </section>
        </div>
        <footer class="lw-f"><button class="btn ghost" type="button" data-x="back">‹ back</button><span class="lw-note dim"></span><button class="btn go" type="button" data-x="next">next ›</button></footer></div>`;
      const f = n => $(`[name="${n}"]`, el);
      // image: upload, drop, a bud face, or paint
      const setImg = url => { L.img = url; const im = $('.drop img', el); im.src = url; $('.drop', el).classList.add('has'); };
      const readFile = file => { if (!file || !/^image\//.test(file.type)) return X.toast('that isn’t a picture'); if (file.size > 8e6) return X.toast('that picture is too big'); const r = new FileReader(); r.onload = () => squash(r.result).then(setImg); r.readAsDataURL(file); };
      $('input[type=file]', el).onchange = e => readFile(e.target.files[0]);
      const drop = $('.drop', el);
      drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); readFile(e.dataTransfer.files[0]); };
      $('[data-x=face]', el).onclick = () => setImg(budFace(f('symbol').value || f('name').value || String(Math.random())));
      $('[data-x=paint]', el).onclick = () => X.open('paint');
      X.on('paint:use', url => { setImg(url); X.open('launch'); go(0); X.toast('picture from paint.exe added'); });
      // the mix
      const cap = () => (X.CFG && X.CFG.devCap) || 50;
      $('.devcap', el).textContent = cap();
      function setMix(k, v) {
        v = Math.max(0, Math.min(k === 'dev' ? cap() : 100, Math.round(v / 5) * 5));
        const others = ['burn', 'drop', 'dev'].filter(x => x !== k), rest = 100 - v, s = others.reduce((a, x) => a + L.mix[x], 0);
        L.mix[k] = v;
        if (s === 0) { L.mix[others[0]] = Math.ceil(rest / 2 / 5) * 5; L.mix[others[1]] = rest - L.mix[others[0]]; }
        else { L.mix[others[0]] = Math.round(L.mix[others[0]] * rest / s / 5) * 5; L.mix[others[1]] = rest - L.mix[others[0]]; }
        if (L.mix.dev > cap()) { const over = L.mix.dev - cap(); L.mix.dev = cap(); const o = others.find(x => x !== 'dev') || 'burn'; L.mix[o] += over; }
        ['burn', 'drop', 'dev'].forEach(x => { if (L.mix[x] < 0) L.mix[x] = 0; });
        drawMix();
      }
      function drawMix() {
        $$('.mix input', el).forEach(i => { i.value = L.mix[i.dataset.k]; i.nextElementSibling.textContent = L.mix[i.dataset.k] + '%'; i.style.setProperty('--p', L.mix[i.dataset.k] + '%'); });
        ['burn', 'drop', 'dev'].forEach(k => $('.mb-' + k, el).style.width = L.mix[k] + '%');
        $('.mixsay', el).innerHTML = `for every <b>1 SOL</b> of creator fees, ${esc(budName())} buys back and burns <b class="k-burn">${(L.mix.burn / 100).toFixed(2)} SOL</b> worth, drops <b class="k-drop">${(L.mix.drop / 100).toFixed(2)} SOL</b> to the top holders and pays you <b class="k-dev">${(L.mix.dev / 100).toFixed(2)} SOL</b>.`;
      }
      $$('.mix input', el).forEach(i => i.oninput = () => { setMix(i.dataset.k, +i.value); SOUND.sfx('tick'); });
      const NAMES = ['moss', 'sprig', 'fern', 'thorn', 'sprout', 'clover', 'sap', 'pip', 'root', 'basil', 'ivy', 'kelp', 'reed', 'bramble', 'nettle', 'sorrel', 'lichen', 'mint', 'tendril'];
      const budName = () => (f('budName').value.trim().toLowerCase() || 'your bud');
      $('[data-x=dice]', el).onclick = () => { f('budName').value = NAMES[Math.random() * NAMES.length | 0] + '.' + String(Math.random() * 100 | 0).padStart(2, '0'); drawAv(); drawMix(); };
      f('budName').oninput = () => { f('budName').value = f('budName').value.toLowerCase().replace(/[^a-z0-9._-]/g, ''); drawAv(); drawMix(); };
      const drawAv = () => { const c = $('.lw-av', el), g = c.getContext('2d'); g.clearRect(0, 0, 72, 72); g.imageSmoothingEnabled = false; const t = X.tinted(X.SPR.pet, X.hueOf(f('budName').value || 'x')); if (t) g.drawImage(t, 0, 0, 72, 72); };
      // the bill
      const cost = () => { const c = X.CFG || { fee: .05, createSol: .03, reserveSol: .015, minDev: .01, maxDev: 10 }; const dev = Math.max(c.minDev || .01, Math.min(c.maxDev || 10, Number(f('dev').value) || 0));
        const rows = [['launch fee', c.fee, 'to bud'], ['pump.fun create', c.createSol, 'the unused part comes back'], ['first buy', +(dev * 1.02).toFixed(4), `${dev} SOL + 2% slippage room, tokens to you`], ['the bud’s gas tank', c.reserveSol, 'stays with your bud for its transactions']];
        const tot = rows.reduce((s, r) => s + r[1], 0);
        $('.cost', el).innerHTML = rows.map(([k, v, n]) => `<tr><td>${esc(k)}<small>${esc(n)}</small></td><td>${v.toFixed(4)} SOL</td></tr>`).join('') + `<tr class="tot"><td>total, one transfer from your wallet</td><td>${tot.toFixed(3)} SOL</td></tr>`; return tot; };
      f('dev').oninput = cost; $$('[data-dev]', el).forEach(b => b.onclick = () => { f('dev').value = b.dataset.dev; cost(); });
      const walBox = () => { const w = WAL.current(); $('.lw-wal', el).innerHTML = w ? `<span class="dot on"></span> paying from <b>${esc(short(w.address))}</b> <button class="chip" type="button" data-x="chg">change</button>` + (X.CFG && X.CFG.mock ? ' <button class="chip" type="button" data-x="mock">dev: test wallet</button>' : '') : `<button class="btn" type="button" data-x="con">connect wallet</button>` + (X.CFG && X.CFG.mock ? ' <button class="chip" type="button" data-x="mock">dev: test wallet</button>' : '');
        const c = $('[data-x=con]', el) || $('[data-x=chg]', el); if (c) c.onclick = async () => { try { if (WAL.current()) await WAL.disconnect(); await X.connect(); } catch (e) { X.toast(e.message); } };
        const m = $('[data-x=mock]', el); if (m) m.onclick = () => { L.mockWallet = true; X.toast('dev: using a test wallet; payment is simulated'); $('.lw-wal', el).innerHTML = '<span class="dot on"></span> dev test wallet (simulated payment)'; }; };
      X.on('wallet', walBox);
      // steps
      function go(s) {
        L.s = s; $$('[data-s]', el).forEach(x => x.hidden = +x.dataset.s !== s);
        $$('.steps li', el).forEach(li => { li.classList.toggle('on', +li.dataset.i === s); li.classList.toggle('done', +li.dataset.i < s); });
        $('[data-x=back]', el).style.visibility = s > 0 && s < 3 ? 'visible' : 'hidden';
        const nx = $('[data-x=next]', el); nx.hidden = s === 3; nx.textContent = s === 2 ? `pay ${cost().toFixed(3)} SOL & launch` : 'next ›';
        $('.lw-note', el).textContent = s === 0 ? 'step 1 of 3: the coin' : s === 1 ? 'step 2 of 3: the bud' : s === 2 ? 'step 3 of 3: pay and plant' : '';
        if (s === 1) { drawAv(); drawMix(); } if (s === 2) { cost(); walBox(); }
      }
      function check0() {
        const name = f('name').value.trim(), sym = f('symbol').value.trim().replace(/^\$/, '').toUpperCase();
        if (!name) return 'give the coin a name.'; if (!/^[A-Z0-9]{1,10}$/.test(sym)) return 'the ticker is 1–10 letters or numbers.'; if (!L.img) return 'add a picture: upload one, use a bud face, or paint one.';
        for (const [n, re, msg] of [['twitter', /^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]{1,15}(\/status\/\d+)?\/?$/, 'the X link should look like https://x.com/yourcoin'], ['telegram', /^https:\/\/t\.me\/[A-Za-z0-9_+]{3,64}\/?$/, 'the telegram link should look like https://t.me/yourcoin'], ['website', /^https:\/\/[^\s"'<>]{3,200}$/, 'the website should start with https://']]) { const v = f(n).value.trim(); if (v && !re.test(v)) return msg; }
        return null;
      }
      $('[data-x=back]', el).onclick = () => go(Math.max(0, L.s - 1));
      $('[data-x=next]', el).onclick = async () => {
        if (L.s === 0) { const e = check0(); if (e) return X.toast(e); f('symbol').value = f('symbol').value.trim().replace(/^\$/, '').toUpperCase(); return go(1); }
        if (L.s === 1) return go(2);
        if (L.s === 2) return pay();
      };
      async function pay() {
        const err = $('.lw-err', el); err.textContent = '';
        if (!f('agree').checked) { err.textContent = 'tick the box first: it says who holds the bud’s wallet.'; return; }
        const nx = $('[data-x=next]', el); nx.disabled = true;
        try {
          let w = WAL.current();
          const mock = !!(X.CFG && X.CFG.mock && L.mockWallet);
          if (!w && !mock) w = await X.connect();
          const launcher = w ? w.address : (await (await fetch('/dev/wallet')).json()).address;
          nx.textContent = 'saving the coin…';
          const p = await api('prepare', { method: 'POST', body: { launcher, name: f('name').value.trim(), symbol: f('symbol').value.trim(), description: f('description').value.trim(), twitter: f('twitter').value.trim(), telegram: f('telegram').value.trim(), website: f('website').value.trim(), image: L.img, devBuy: Number(f('dev').value), mix: L.mix, budName: f('budName').value.trim() } });
          L.id = p.id; L.prep = p; X.ls.set('bud:pending', p.id);
          go(3); steps('sign');
          if (w) {
            const b = await api('paybuild', { method: 'POST', body: { id: p.id } });
            if (!b.paid) {
              let signed; try { signed = await WAL.signTx(Uint8Array.from(atob(b.tx), c => c.charCodeAt(0))); }
              catch (e) { manual(p, e.message); return; }
              const r = await api('relay', { method: 'POST', body: { id: p.id, tx: WAL.b64(signed) } }); L.paySig = r.sig;
            }
          } else { await fetch('/dev/fund', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id }) }); }
          steps('wait'); watch();
        } catch (e) { if (L.s === 3) { steps('fail', e.message); } else { err.textContent = e.message; } }
        finally { nx.disabled = false; if (L.s === 2) go(2); }
      }
      function manual(p, why) {
        $('.lw-done', el).innerHTML = `<p class="warn">${esc(why || 'this wallet can’t sign here.')}</p><p>send exactly <b class="am">${p.needSol} SOL</b> to your bud’s wallet from any wallet, and this window will pick it up:</p><p class="addr">${esc(p.wallet)} <button class="chip" type="button">copy</button></p>`;
        $('.lw-done .chip', el).onclick = () => X.copy(p.wallet); steps('wait'); watch();
      }
      const STEPS = [['sign', 'your wallet signs one transfer'], ['wait', 'the deposit lands in your bud'], ['create', 'the bud creates the coin on pump.fun'], ['live', 'live. first buy sent to you']];
      function steps(at, err) {
        const i = STEPS.findIndex(s => s[0] === at);
        $('.lw-steps', el).innerHTML = STEPS.map(([k, t], j) => `<div class="st ${err && j === i ? 'bad' : j < i || at === 'live' ? 'done' : j === i ? 'now' : ''}"><i></i>${esc(t)}</div>`).join('') + (err ? `<p class="bad">${esc(err)}</p>` : '');
        L.stage = at;
      }
      async function watch() {
        clearInterval(L.poll); const id = L.id; let n = 0;
        const tick = async () => {
          if (++n > 400) return clearInterval(L.poll);
          let s; try { s = await api('status', { params: { id } }); } catch { return; }
          if (s.state === 'waiting') steps('wait');
          if (s.state === 'creating') steps('create');
          if (s.state === 'live') { clearInterval(L.poll); steps('live'); done(s); }
          if (['failed', 'refunded', 'expired'].includes(s.state)) { clearInterval(L.poll); steps('create', s.state === 'expired' ? 'the deposit never fully arrived. anything that did was sent back.' : 'the launch failed and the deposit was sent back. ' + (s.err || '')); X.ls.set('bud:pending', ''); }
        };
        tick(); L.poll = setInterval(tick, 2500);
      }
      function done(s) {
        X.ls.set('bud:pending', ''); SOUND.sfx('chime'); X.refresh();
        $('.lw-done', el).innerHTML = `<div class="born"><img src="${X.avatarURL(s.mint, 64)}" alt=""><div><h3 class="h">${esc(s.budName)} is awake.</h3><p class="dim">$${esc(s.symbol)} is live on pump.fun and ${esc(s.budName)} is its creator. it starts the bagwork as soon as fees come in.</p>
          <p>${link(pumpfun(s.mint), 'open on pump.fun ↗')} · ${link(acct(s.wallet), 'the bud’s wallet ↗')}${s.create_sig ? ' · ' + link(solscan(s.create_sig), 'create tx ↗') : ''}</p>
          <div class="row"><button class="btn go" type="button" data-x="chat">talk to ${esc(s.budName)}</button><button class="btn" type="button" data-x="again">launch another</button></div></div></div>`;
        $('[data-x=chat]', el).onclick = () => X.openBud(s.mint);
        $('[data-x=again]', el).onclick = () => { L.id = null; L.img = null; $('.drop', el).classList.remove('has'); el.querySelectorAll('input:not([type=range]):not([type=checkbox]), textarea').forEach(i => { if (i.name !== 'dev') i.value = ''; }); $('.lw-done', el).innerHTML = ''; go(0); };
        X.emit('pet:spawn', s.mint);
      }
      L.go = go; L.resume = async id => { L.id = id; go(3); steps('wait'); watch(); };
      go(0); setMix('burn', 50);
    },
    open(arg) {
      const el = X.WM.wins.launch; if (!el) return;
      if (arg && typeof arg === 'object') { if (arg.name) $('[name=name]', el).value = arg.name; if (arg.symbol) $('[name=symbol]', el).value = String(arg.symbol).toUpperCase(); L.go(0); }
      const pend = X.ls.get('bud:pending'); if (pend && !L.id && L.s !== 3) L.resume(pend);
    },
  };
  // pictures: anything uploaded becomes a 512px square jpeg before it goes anywhere
  function squash(url) {
    return new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); const s = Math.max(512 / im.width, 512 / im.height), w = im.width * s, h = im.height * s; g.fillStyle = '#06120b'; g.fillRect(0, 0, 512, 512); g.drawImage(im, (512 - w) / 2, (512 - h) / 2, w, h); res(c.toDataURL('image/jpeg', .9)); }; im.onerror = () => res(url); im.src = url; });
  }
  function budFace(key) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), h = X.hueOf(key);
    const gr = g.createRadialGradient(256, 300, 30, 256, 256, 380); gr.addColorStop(0, `hsl(${140 + h},45%,22%)`); gr.addColorStop(1, `hsl(${140 + h},50%,6%)`); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < 512; y += 4) g.fillRect(0, y, 512, 2);
    g.imageSmoothingEnabled = false; const t = X.tinted(X.SPR.pet, h); if (t) { g.shadowColor = 'rgba(120,255,170,.45)'; g.shadowBlur = 40; g.drawImage(t, 56, 64, 400, 400); }
    return c.toDataURL('image/png');
  }

  // ================================================================ the buddy list
  const BL = { tab: 'all', q: '', seen: new Set(), mine: [] };
  A.buds = {
    title: 'buddy list', short: 'buds', icon: 'buds', w: 310, h: 560, minW: 260, minH: 320, at: 'right',
    build(el) {
      el.innerHTML = `<div class="bl"><div class="blh"><canvas width="40" height="40"></canvas><div><b class="blme">night shift</b><small class="blst">doing the bagwork</small></div></div>
        <div class="bltabs"><button type="button" data-t="all" class="on">buddies</button><button type="button" data-t="mine">my buds</button></div>
        <input class="blq" placeholder="find a bud or $ticker" spellcheck="false">
        <div class="bllist scroll"></div>
        <div class="blf"><button class="btn go" type="button" data-o="launch">+ launch</button><button class="btn" type="button" data-o="ledger" title="ledger">ledger</button><button class="btn" type="button" data-o="greenhouse" title="greenhouse">grow</button></div></div>`;
      const c = $('.blh canvas', el), g = c.getContext('2d'); g.imageSmoothingEnabled = false; if (X.SPR.pet) g.drawImage(X.SPR.pet, 0, 0, 40, 40);
      $$('.bltabs button', el).forEach(b => b.onclick = () => { BL.tab = b.dataset.t; $$('.bltabs button', el).forEach(x => x.classList.toggle('on', x === b)); render(); });
      $('.blq', el).oninput = e => { BL.q = e.target.value.trim().toLowerCase().replace(/^\$/, ''); render(); };
      $$('[data-o]', el).forEach(b => b.onclick = () => X.open(b.dataset.o));
      const me = () => { const w = WAL.current(); $('.blme', el).textContent = w ? short(w.address) : 'night shift'; };
      X.on('wallet', () => { me(); if (BL.tab === 'mine') render(); }); me();
      function row(b) {
        const working = b.workedAt && Date.now() - new Date(b.workedAt) < 30 * 60e3;
        return `<button type="button" class="br ${working ? 'on' : ''} ${b.level}" data-m="${esc(b.mint)}"><img src="${X.avatarURL(b.mint, 28)}" alt=""><span class="bn"><b>${esc(b.budName)}</b> <i>$${esc(b.symbol)}</i><small>${esc(b.state === 'creating' ? 'waking up…' : b.state === 'waiting' ? 'waiting for the deposit' : b.state !== 'live' ? b.state : (b.last || 'waiting for fees'))}</small></span><span class="bs"></span></button>`;
      }
      async function render() {
        const box = $('.bllist', el);
        let list = X.BUDS;
        if (BL.tab === 'mine') { const w = WAL.current(); if (!w) { box.innerHTML = `<div class="empty"><img src="${ICONS.mybuds}" alt="">connect a wallet to see the buds you launched.<br><br><button class="btn" type="button">connect</button></div>`; $('button', box).onclick = () => X.connect().catch(e => X.toast(e.message)); return; }
          try { list = (await api('buds', { params: { owner: w.address } })).buds; } catch { list = []; } }
        if (BL.q) list = list.filter(b => b.budName.toLowerCase().includes(BL.q) || b.symbol.toLowerCase().includes(BL.q) || b.name.toLowerCase().includes(BL.q));
        if (!list.length) { box.innerHTML = `<div class="empty"><img src="${ICONS.buds}" alt="">${BL.q ? 'no bud by that name.' : BL.tab === 'mine' ? 'you haven’t launched a bud yet.' : 'no buds online yet. the greenhouse is quiet.'}<br><br><button class="btn go" type="button">launch the first one</button></div>`; $('button', box).onclick = () => X.open('launch'); return; }
        const working = list.filter(b => b.workedAt && Date.now() - new Date(b.workedAt) < 30 * 60e3), rest = list.filter(b => !working.includes(b));
        const legends = list.filter(b => b.level === 'legend');
        const grp = (t, arr, open = true) => arr.length ? `<details ${open ? 'open' : ''}><summary>${esc(t)} <span>(${arr.length})</span></summary>${arr.map(row).join('')}</details>` : '';
        box.innerHTML = (BL.tab === 'mine' ? grp('my buds', list) : grp('legends', legends) + grp('working now', working.filter(b => b.level !== 'legend')) + grp('on the clock', rest.filter(b => b.level !== 'legend')));
        $$('.br', box).forEach(r => { r.onclick = e => { if (X.MOBILE || e.detail >= 2) X.openBud(r.dataset.m); else { $$('.br.sel', box).forEach(x => x.classList.remove('sel')); r.classList.add('sel'); } }; r.ondblclick = () => X.openBud(r.dataset.m); });
        // new buds coming online get the door sound
        list.forEach(b => { if (BL.primed && !BL.seen.has(b.mint)) { SOUND.sfx('buddy'); const r = $(`.br[data-m="${CSS.escape(b.mint)}"]`, box); r && r.classList.add('new'); } BL.seen.add(b.mint); });
        BL.primed = true;
      }
      X.on('buds', () => { if (BL.tab === 'all') render(); }); render();
      X.on('feed', it => { const r = $(`.br[data-m="${CSS.escape(it.mint)}"]`, el); if (r) { r.classList.remove('ping'); void r.offsetWidth; r.classList.add('ping'); $('small', r).textContent = it.text; } });
      BL.render = render;
    },
    open(arg) { if (arg && arg.tab) { BL.tab = arg.tab; const el = X.WM.wins.buds; $$('.bltabs button', el).forEach(x => x.classList.toggle('on', x.dataset.t === BL.tab)); BL.render && BL.render(); } },
  };

  // ================================================================ chat: one window per bud
  const REPLY = [
    [/\b(gm|gn|hello|hi|hey|yo|sup)\b/, b => ['gm. i didn’t sleep.', 'hey. busy, but hey.', 'oh. it’s you.'][Math.random() * 3 | 0]],
    [/(how much|stats|status|doing|working|progress|report)/, b => `so far: claimed ${fsol(b.claimed)} SOL. burned ${ftok(b.burnedTokens)} $${b.symbol} (bought with ${fsol(b.burnedSol)} SOL). dropped ${fsol(b.dropped)} SOL to holders. paid the dev ${fsol(b.devPaid)} SOL. ${b.jobs} jobs.`],
    [/burn/, b => `burn is ${b.mix.burn}% of my mix. i’ve burned ${ftok(b.burnedTokens)} $${b.symbol} so far. gone for good.`],
    [/(drop|holder|airdrop)/, b => `drop is ${b.mix.drop}% of my mix. i send it as SOL to the top 20 holders, by size. ${fsol(b.dropped)} SOL so far.`],
    [/(dev|pay me|paid)/, b => `the dev gets ${b.mix.dev}% of every claim. ${fsol(b.devPaid)} SOL so far.`],
    [/(sell|dump|rug|exit)/, () => 'i don’t sell. i can’t. i only buy back.'],
    [/(sleep|tired|rest|break)/, () => 'buds don’t sleep.'],
    [/mix/, b => `burn ${b.mix.burn}% · drop ${b.mix.drop}% · dev ${b.mix.dev}%. locked the day i was born.`],
    [/(wallet|address|where)/, b => `my wallet is ${b.wallet}. watch it work.`],
    [/level/, b => { const L = (X.CFG && X.CFG.levels) || [['rookie', 0], ['grinder', .5], ['workhorse', 5], ['legend', 50]]; const nx = L.find(l => l[1] > b.claimed); return `i’m a ${b.level}. ${nx ? `${(nx[1] - b.claimed).toFixed(3)} SOL more of fees and i’m a ${nx[0]}.` : 'there is nothing above legend.'}`; }],
    [/(moon|pump|wen|price|mcap|chart|100x)/, b => `i don’t do predictions. i do bagwork.${b.mcapSol ? ` market cap is about ${fsol(b.mcapSol)} SOL right now.` : ''}`],
    [/(who are you|what are you|who r u)/, b => `i’m ${b.budName}. i’m $${b.symbol}’s creator wallet. i claim the fees and do the bagwork, every minute.`],
    [/(love|cute|good bud|thank)/, () => ['…', 'thanks. back to work.', 'don’t get attached.'][Math.random() * 3 | 0]],
  ];
  const IDLE = ['noted.', 'i’m busy. bagwork.', 'the fees don’t claim themselves.', '*stares*', 'mhm.', 'i heard you. i’m working.'];
  const CH = new Map();
  A.chat = {
    title: 'chat', icon: 'chat', w: 0, h: 0,
    spawn(b) {
      const id = 'chat:' + b.id;
      if (!X.APPS[id]) X.define(id, {
        title: `${b.budName} — $${b.symbol}`, short: b.budName, iconURL: X.avatarURL(b.mint, 16), w: 460, h: 500, minW: 340, minH: 320, dispose: true,
        build: el => buildChat(el, b),
        close: () => { const c = CH.get(b.mint); c && c.off && c.off(); CH.delete(b.mint); },
      });
      X.open(id);
    },
  };
  function buildChat(el, b0) {
    let b = b0; const st = { last: 0 };
    el.innerHTML = `<div class="chat"><div class="ch-top"><img src="${X.avatarURL(b.mint, 52)}" alt=""><div class="ch-id"><b>${esc(b.budName)}</b> ${lvl(b.level)}<small>works for <b class="ok">$${esc(b.symbol)}</b> · ${esc(b.name)}</small>
        <div class="ch-mix"><span class="k-burn">burn ${b.mix.burn}%</span><span class="k-drop">drop ${b.mix.drop}%</span><span class="k-dev">dev ${b.mix.dev}%</span></div></div></div>
      <div class="ch-stats"></div>
      <div class="ch-log scroll"></div>
      <div class="ch-typing"></div>
      <form class="ch-in"><input placeholder="say something to ${esc(b.budName)}…" maxlength="120"><button class="btn" type="submit">send</button></form>
      <div class="ch-links">${link(pumpfun(b.mint), 'pump.fun ↗')} ${link(acct(b.wallet), 'bud wallet ↗')} ${link('https://dexscreener.com/solana/' + b.mint, 'chart ↗')}</div></div>`;
    const log = $('.ch-log', el), typing = $('.ch-typing', el);
    const stats = () => { $('.ch-stats', el).innerHTML = [['claimed', fsol(b.claimed) + ' SOL'], ['burned', ftok(b.burnedTokens)], ['dropped', fsol(b.dropped) + ' SOL'], ['dev', fsol(b.devPaid) + ' SOL'], ['jobs', b.jobs]].map(([k, v]) => `<div><b>${esc(String(v))}</b><span>${k}</span></div>`).join(''); };
    const msg = (who, html, t, cls = '') => { const d = document.createElement('div'); d.className = `msg ${who} ${cls}`; d.innerHTML = `<div class="mb">${html}</div><time>${t ? new Date(t).toTimeString().slice(0, 5) : ''}</time>`; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
    const jobHtml = l => `<span class="k-${esc(l.kind)}">${esc(l.kind)}</span> ${esc(l.text)}${l.sig ? ` ${link(solscan(l.sig), 'tx ↗')}` : ''}`;
    stats();
    (async () => {
      try { const j = await api('bud', { params: { id: b.id } }); b = j.bud; stats();
        const logs = j.logs.filter(l => !['error', 'tx', 'fee'].includes(l.kind)).reverse();
        msg('sys', `this is ${esc(b.budName)}. it works for $${esc(b.symbol)} around the clock. everything it says below happened on-chain.`, null);
        logs.forEach(l => msg('bud', jobHtml(l), l.at)); st.last = j.logs[0] ? Number(j.logs[0].n) : 0;
        if (!logs.length) msg('bud', 'nothing to report yet. the fees will come.', Date.now());
      } catch (e) { msg('sys', esc(e.message)); }
    })();
    const off = X.on('feed', it => { if (it.mint !== b.mint || Number(it.n) <= st.last) return; st.last = Number(it.n); typing.textContent = `${b.budName} is typing…`;
      setTimeout(async () => { typing.textContent = ''; msg('bud', jobHtml(it), it.at, 'fresh'); SOUND.sfx('ding'); try { b = (await api('bud', { params: { id: b.id } })).bud; stats(); } catch {} }, 900); });
    CH.set(b.mint, { off });
    $('.ch-in', el).onsubmit = e => {
      e.preventDefault(); const i = $('input', e.target), t = i.value.trim(); if (!t) return; i.value = ''; msg('me', esc(t), Date.now()); SOUND.sfx('tick');
      const r = REPLY.find(([re]) => re.test(t.toLowerCase())); const ans = r ? r[1](b) : IDLE[Math.random() * IDLE.length | 0];
      typing.textContent = `${b.budName} is typing…`;
      setTimeout(() => { typing.textContent = ''; msg('bud', esc(ans), Date.now()); SOUND.sfx('ding'); }, 500 + Math.min(1600, ans.length * 18));
    };
  }

  // ================================================================ ledger.db
  const LG = { kind: 'all', rows: [], oldest: 0 };
  A.ledger = {
    title: 'ledger.db — every job, every tx', short: 'ledger.db', icon: 'ledger', w: 800, h: 480, minW: 420, minH: 260,
    build(el) {
      el.innerHTML = `<div class="lg"><div class="lg-tot"></div><div class="lg-f">${['all', 'claim', 'burn', 'drop', 'dev', 'launch'].map(k => `<button type="button" class="chip ${k === 'all' ? 'on' : ''}" data-k="${k}">${k}</button>`).join('')}<span class="dim lg-n"></span></div>
        <div class="lg-t scroll"><table><thead><tr><th>when</th><th>bud</th><th>coin</th><th>job</th><th>what happened</th><th>amount</th><th>tx</th></tr></thead><tbody></tbody></table><button class="btn ghost lg-more" type="button">load older</button></div></div>`;
      const tb = $('tbody', el);
      const rowH = (r, fresh) => `<tr class="${fresh ? 'fresh' : ''}" data-m="${esc(r.mint)}"><td class="mute">${esc(ago(r.at))}</td><td><a class="budl" data-bud="${esc(r.mint)}">${esc(r.bud_name)}</a></td><td class="ok">$${esc(r.symbol)}</td><td><span class="k-${esc(r.kind)}">${esc(r.kind)}</span></td><td class="lg-x">${esc(r.text)}</td><td class="am">${r.sol != null ? fsol(r.sol) + ' SOL' : ''}</td><td>${r.sig ? link(solscan(r.sig), short(r.sig)) : ''}</td></tr>`;
      const tot = () => { const t = X.TOTALS || {}; $('.lg-tot', el).innerHTML = [['fees claimed', fsol(t.claimed) + ' SOL'], ['bought back + burned', fsol(t.burned) + ' SOL'], ['dropped to holders', fsol(t.dropped) + ' SOL'], ['paid to devs', fsol(t.dev) + ' SOL'], ['jobs', t.jobs ?? '—']].map(([k, v]) => `<div><b>${esc(String(v))}</b><span>${k}</span></div>`).join(''); };
      async function load(reset) {
        const params = { limit: 60 }; if (LG.kind !== 'all') params.kind = LG.kind; if (!reset && LG.oldest) params.before = LG.oldest;
        const j = await api('feed', { params }).catch(() => ({ items: [] }));
        if (reset) LG.rows = []; LG.rows.push(...j.items); LG.oldest = LG.rows.length ? Number(LG.rows[LG.rows.length - 1].n) : 0;
        tb.innerHTML = LG.rows.map(r => rowH(r)).join('') || `<tr><td colspan="7" class="empty">no jobs yet. when a bud claims fees, every job lands here with its transaction.</td></tr>`;
        $('.lg-n', el).textContent = `${LG.rows.length} shown`; $('.lg-more', el).hidden = j.items.length < 60;
      }
      $$('.lg-f .chip', el).forEach(c => c.onclick = () => { LG.kind = c.dataset.k; $$('.lg-f .chip', el).forEach(x => x.classList.toggle('on', x === c)); load(true); });
      $('.lg-more', el).onclick = () => load(false);
      el.addEventListener('click', e => { const a = e.target.closest('.budl'); if (a) { e.preventDefault(); X.openBud(a.dataset.bud); } });
      X.on('feed', it => { if (LG.kind !== 'all' && it.kind !== LG.kind) return; if (LG.rows.some(r => r.n === it.n)) return; LG.rows.unshift(it); const e0 = tb.querySelector('.empty'); if (e0) tb.innerHTML = ''; tb.insertAdjacentHTML('afterbegin', rowH(it, true)); });
      X.on('buds', tot); tot(); load(true);
    },
  };

  // ================================================================ readme.txt
  A.readme = {
    title: 'readme.txt — notepad', short: 'readme.txt', icon: 'readme', w: 680, h: 560, minW: 360, minH: 260,
    build(el) {
      const c = X.CFG || { fee: .05, createSol: .03, reserveSol: .015, devCap: 50, jobMin: { burn: .004, drop: .01, dev: .004 } };
      el.innerHTML = `<div class="np"><div class="np-menu"><span>file</span><span>edit</span><span>format</span><span>view</span><span>help</span></div><div class="np-doc scroll">
<h1>bud</h1><p class="np-tag">every coin gets a bud. it does the bagwork while you sleep.</p>
<h2>what is a bud</h2>
<p>when you launch a coin here, the coin gets a bud: a Solana wallet made for that one coin, and set as the coin’s creator on pump.fun. pump.fun pays creator fees on every trade to the creator. the creator is the bud. so the fees go to the bud, and the bud puts them to work.</p>
<h2>the bagwork</h2>
<p>every minute the engine checks every bud. when fees are waiting, the bud claims them and splits them by the mix you picked:</p>
<ul><li><b class="k-burn">burn</b>: the bud buys your coin with that share and burns what it bought. less supply, every time.</li><li><b class="k-drop">drop</b>: the bud sends that share as SOL to the top 20 holders, in proportion to what they hold. pools, the bonding curve and the bud itself don’t count as holders.</li><li><b class="k-dev">dev</b>: the bud pays that share to you, the wallet that launched it. at most ${c.devCap}% of every claim.</li></ul>
<p>the mix is set once, at launch, and can never be changed. not by you, not by us.</p>
<h2>how a launch works</h2>
<ol><li>fill in the coin: name, ticker, picture, links.</li><li>name your bud and pick the mix.</li><li>pick a first buy and pay with one transfer. the transfer goes to your bud’s wallet.</li><li>the bud creates the coin on pump.fun with your first buy, then sends the bought tokens and any unused SOL to you.</li><li>from then on the bud works, every minute, for as long as the coin trades.</li></ol>
<h2>what it costs</h2>
<ul><li>launch fee: ${c.fee} SOL.</li><li>pump.fun’s create cost: about ${c.createSol} SOL. what isn’t used comes back.</li><li>your first buy, plus 2% room for slippage. the tokens go to you.</li><li>the bud’s gas tank: ${c.reserveSol} SOL. it stays in the bud and pays for its transactions.</li></ul>
<p>if a launch fails or never gets fully paid within 3 hours, everything that arrived goes back to the wallet it came from, launch fee included.</p>
<h2>who holds the bud’s wallet</h2>
<p>the engine does. each bud’s key is derived on our server from one master secret and is never stored or shown. that is what lets the bud work while you sleep. it also means you are trusting the engine to do the jobs it promises. the engine only has these jobs: claim fees, buy back, burn, send SOL to holders, send SOL to the dev, and hand out the first buy. it has no sell job and no withdraw job.</p>
<h2>when jobs happen</h2>
<p>a bud claims when at least 0.003 SOL of fees is waiting. a burn or a dev payment happens once its share reaches ${c.jobMin.burn} SOL, a holder drop once its share reaches ${c.jobMin.drop} SOL, so the fees don’t disappear into transaction costs. shares that are too small wait for the next claim.</p>
<h2>levels</h2>
<p>buds level up by the fees they have worked: <span class="lvl rookie">rookie</span> from 0, <span class="lvl grinder">grinder</span> from 0.5 SOL, <span class="lvl workhorse">workhorse</span> from 5 SOL, <span class="lvl legend">legend</span> from 50 SOL.</p>
<h2>what is public</h2>
<p>everything. every bud’s wallet, every claim, every buyback, every burn, every drop and every dev payment is a Solana transaction, linked from the ledger and from the bud’s chat.</p>
<h2>the honest part</h2>
<p>bud is not an investment and promises nothing about price. buybacks and burns don’t make a chart go up; they spend fees the coin itself earned. a coin with no trading earns no fees, and its bud has nothing to do. you can lose everything you put into a memecoin.</p>
<p class="dim">bud OS 2.0 · night shift edition</p></div></div>`;
    },
  };

  // ================================================================ display.cpl
  A.display = {
    title: 'display — settings', short: 'display', icon: 'display', w: 440, h: 430, nomax: true,
    build(el) {
      const opts = [['crt', 'crt scanlines', 'the old monitor look'], ['eyes', 'the watcher', 'the big bud on the wallpaper'], ['grid', 'grow grid', 'the faint grid on the wallpaper'], ['pets', 'buds on the taskbar', 'they walk around when they work'], ['toasts', 'job pop-ups', 'a note every time a bud does a job']];
      el.innerHTML = `<div class="pad disp">${opts.map(([k, t, s]) => `<label class="tog"><input type="checkbox" data-k="${k}"><span><b>${t}</b><small>${s}</small></span></label>`).join('')}
        <label class="field"><span>volume</span><input type="range" min="0" max="1" step="0.05" class="vol"></label>
        <div class="row"><button class="btn" type="button" data-x="mute">mute</button><button class="btn" type="button" data-x="intro">replay the greenhouse</button></div></div>`;
      $$('[data-k]', el).forEach(i => { i.checked = !!X.SET[i.dataset.k]; i.onchange = () => { X.SET[i.dataset.k] = i.checked; X.saveSet(); SOUND.sfx('tick'); }; });
      const v = $('.vol', el); v.value = SOUND.volume; v.oninput = () => SOUND.setVolume(+v.value);
      const mb = $('[data-x=mute]', el); SOUND.onChange(s => mb.textContent = s.muted ? 'unmute' : 'mute'); mb.onclick = () => SOUND.toggle();
      $('[data-x=intro]', el).onclick = () => { X.ss.del('bud:seen'); location.href = '/'; };
    },
  };

  // ================================================================ recycle bin
  A.bin = {
    title: 'recycle bin', short: 'recycle bin', icon: 'bin', w: 440, h: 320,
    build(el) {
      const F = [['sleep.exe', 'buds don’t sleep. it was deleted on purpose.'], ['paper_hands.txt', 'empty. it always was.'], ['sell_button.png', 'there is no sell button. there was never a sell button.'], ['old_roadmap.pdf', 'step 1: bagwork. step 2: bagwork. step 3: see step 1.']];
      el.innerHTML = `<div class="bin"><div class="bin-l">${F.map(([n], i) => `<button type="button" class="icon" data-i="${i}"><img src="${ICONS[/\.exe$/.test(n) ? 'term' : /\.png$/.test(n) ? 'paint' : 'readme']}" alt=""><span>${esc(n)}</span></button>`).join('')}</div>
        <div class="bin-f"><span class="dim bin-say">double-click a file.</span><button class="btn" type="button">empty recycle bin</button></div></div>`;
      $$('.bin-l .icon', el).forEach(b => b.ondblclick = b.onclick = e => { if (e.type === 'click' && !X.MOBILE && e.detail < 2) return; $('.bin-say', el).textContent = F[+b.dataset.i][1]; SOUND.sfx('beep'); });
      $('.bin-f .btn', el).onclick = () => { $('.bin-say', el).textContent = 'nice try. some things stay deleted. and some things come back.'; SOUND.sfx('boom'); };
    },
  };

  Object.assign(A, installMore(X));
  return A;
}
