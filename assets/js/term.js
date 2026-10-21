// bud.sh: a real terminal. Every command that shows numbers reads the live engine; nothing here is made up.
export function installTerm(X) {
  const { esc, api, fsol, ftok, ago, short, solscan, pumpfun, acct, SOUND } = X;
  let out, inp, wrap, hist = [], hi = 0, follow = null, booted = false, busy = false;
  try { hist = JSON.parse(X.ls.get('bud:hist') || '[]'); } catch {}
  const PS = () => `<span class="ps"><b>night</b>@bud:<i>~</i>$</span> `;
  function print(html, cls) {
    const d = document.createElement('div'); d.className = 'tl' + (cls ? ' ' + cls : ''); d.innerHTML = html; out.appendChild(d);
    while (out.children.length > 600) out.firstChild.remove();
    out.scrollTop = out.scrollHeight; return d;
  }
  const say = (t, cls) => print(esc(t), cls);
  const blank = () => print('&nbsp;');
  async function slow(lines, ms = 14) { for (const l of lines) { typeof l === 'string' ? print(l) : print(l[0], l[1]); if (ms && !X.RM) await X.sleep(ms); } }
  const pad = (s, n) => { s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); };
  const lpad = (s, n) => { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; };
  const link = (href, text) => `<a class="tx" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
  const budLink = b => `<a class="budl" data-bud="${esc(b.mint)}">${esc(b.budName)}</a>`;
  const lvl = l => `<span class="lvl ${esc(l)}">${esc(l)}</span>`;
  const bar = (k, w = 20, ch = '█') => ch.repeat(Math.round(k * w)) + '<span class="mute">' + '░'.repeat(w - Math.round(k * w)) + '</span>';
  const stopFollow = () => { if (follow) { follow(); follow = null; say('^C', 'dim'); } };

  // ---------------------------------------------------------------- commands
  const C = {};
  const add = (names, help, fn, group = 'buds') => names.split(' ').forEach((n, i) => C[n] = { fn, help: i ? null : help, group, name: n });

  add('help ?', 'this list', () => {
    const groups = {};
    for (const k in C) if (C[k].help) (groups[C[k].group] = groups[C[k].group] || []).push(C[k]);
    for (const g of ['buds', 'launch', 'wallet', 'system', 'fun']) {
      if (!groups[g]) continue; print(`<span class="hl">${g}</span>`);
      groups[g].forEach(c => print(`  <span class="ok">${esc(pad(c.name + (c.args ? ' ' + c.args : ''), 22))}</span><span class="dim">${esc(c.help)}</span>`));
    }
    print('<span class="dim">tab completes. ↑ ↓ for history. ctrl+c stops a follow. ` toggles this window.</span>');
  }, 'system');

  add('buds ls', 'every bud, newest first (try: buds top, buds active)', async a => {
    const sort = ['top', 'active', 'recent'].includes(a[0]) ? a[0] : 'recent';
    const j = await api('buds', { params: { sort, limit: 40 } });
    if (!j.buds.length) return print('<span class="dim">no buds yet. the greenhouse is empty. type</span> <span class="ok">launch</span> <span class="dim">to plant the first one.</span>');
    if (out.clientWidth < 620) { j.buds.forEach(b => { print(`${budLink(b)} <span class="ok">$${esc(b.symbol)}</span> ${lvl(b.level)} <span class="am">${fsol(b.claimed)} SOL</span>`); print(`  <span class="dim">${esc((b.last || 'waiting for fees').slice(0, 44))}</span>`); }); return print(`<span class="dim">${j.buds.length} shown · tap a name to chat</span>`); }
    print(`<span class="dim">${esc(pad('bud', 14))}${esc(pad('coin', 10))}${esc(pad('level', 11))}${esc(lpad('claimed', 9))}  last job</span>`);
    j.buds.forEach(b => print(`${budLink(b)}${esc(' '.repeat(Math.max(1, 14 - b.budName.length)))}${esc(pad('$' + b.symbol, 10))}${lvl(b.level)}${esc(' '.repeat(Math.max(1, 11 - b.level.length - 2)))}<span class="am">${esc(lpad(fsol(b.claimed), 9))}</span>  <span class="dim">${esc((b.last || 'waiting for fees').slice(0, 40))}</span>`));
    print(`<span class="dim">${j.buds.length} shown · ${j.totals.buds} working · click a name to open its chat</span>`);
  });
  C.buds.args = '[top|active]';

  async function findBud(key) {
    if (!key) throw new Error('which bud? try: bud moss.27 or bud $TICKER');
    let b = X.budBy(key); if (b) return b;
    const j = await api('bud', { params: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key) ? { mint: key } : { id: key } }).catch(() => null);
    if (j && j.bud) return j.bud;
    throw new Error(`no bud called "${key}". type buds to see them all.`);
  }
  add('bud who', 'one bud: its mix, what it has done, its last jobs', async a => {
    const b0 = await findBud(a[0]); const j = await api('bud', { params: { id: b0.id } }); const b = j.bud;
    print(`<img class="tav" src="${X.avatarURL(b.mint, 48)}" alt=""><span class="hl big">${esc(b.budName)}</span>  <span class="dim">works for</span> <span class="ok">$${esc(b.symbol)}</span> ${lvl(b.level)}`);
    print(`<span class="dim">mix     </span> burn <span class="ok">${b.mix.burn}%</span> · drop <span class="ok">${b.mix.drop}%</span> · dev <span class="ok">${b.mix.dev}%</span>  <span class="mute">(locked)</span>`);
    print(`<span class="dim">claimed </span><span class="am">${fsol(b.claimed)} SOL</span>   <span class="dim">burned</span> <span class="am">${ftok(b.burnedTokens)}</span> <span class="dim">for</span> ${fsol(b.burnedSol)} SOL   <span class="dim">dropped</span> <span class="am">${fsol(b.dropped)} SOL</span>   <span class="dim">dev</span> <span class="am">${fsol(b.devPaid)} SOL</span>`);
    print(`<span class="dim">jobs    </span>${b.jobs}   <span class="dim">last worked</span> ${b.workedAt ? ago(b.workedAt) + ' ago' : '—'}   <span class="dim">state</span> ${esc(b.state)}`);
    print(`<span class="dim">links   </span>${link(pumpfun(b.mint), 'pump.fun')} · ${link(acct(b.wallet), 'the bud’s wallet')} · ${link(acct(b.mint), 'the mint')}`);
    const logs = j.logs.filter(l => l.kind !== 'error').slice(0, 8);
    if (logs.length) { blank(); print('<span class="hl">last jobs</span>'); logs.forEach(l => print(`<span class="mute">${esc(lpad(ago(l.at), 4))}</span>  <span class="k-${esc(l.kind)}">${esc(pad(l.kind, 7))}</span>${esc(l.text)}${l.sig ? '  ' + link(solscan(l.sig), 'tx ↗') : ''}`)); }
  });
  C.bud.args = '<name|$TICKER>';

  add('watch tail', 'follow one bud’s work live (ctrl+c to stop)', async a => {
    const b = await findBud(a[0]); stopFollow();
    print(`<span class="dim">watching</span> ${budLink(b)} <span class="dim">… jobs appear as they land on-chain. ctrl+c stops.</span>`);
    const off = X.on('feed', it => { if (it.mint === b.mint) print(`<span class="mute">${new Date(it.at).toTimeString().slice(0, 8)}</span>  <span class="k-${esc(it.kind)}">${esc(pad(it.kind, 7))}</span>${esc(it.text)}${it.sig ? '  ' + link(solscan(it.sig), 'tx ↗') : ''}`); });
    const t = setInterval(() => X.refresh(), 5000);
    follow = () => { off(); clearInterval(t); };
  });
  C.watch.args = '<bud>';

  add('feed log', 'the latest jobs across every bud (feed -f to follow)', async a => {
    const j = await api('feed');
    if (!j.items.length) return say('nothing yet. the engine is quiet.', 'dim');
    j.items.slice(0, 16).reverse().forEach(it => print(`<span class="mute">${esc(lpad(ago(it.at), 4))}</span>  <a class="budl" data-bud="${esc(it.mint)}">${esc(pad(it.bud_name, 12))}</a> <span class="k-${esc(it.kind)}">${esc(pad(it.kind, 7))}</span>${esc(it.text)}${it.sig ? '  ' + link(solscan(it.sig), 'tx ↗') : ''}`));
    if (a[0] === '-f') { stopFollow(); say('following… ctrl+c stops.', 'dim');
      const off = X.on('feed', it => print(`<span class="mute">${new Date(it.at).toTimeString().slice(0, 8)}</span>  <a class="budl" data-bud="${esc(it.mint)}">${esc(pad(it.bud_name, 12))}</a> <span class="k-${esc(it.kind)}">${esc(pad(it.kind, 7))}</span>${esc(it.text)}${it.sig ? '  ' + link(solscan(it.sig), 'tx ↗') : ''}`));
      const t = setInterval(() => X.refresh(), 5000); follow = () => { off(); clearInterval(t); }; }
  });

  add('stats top', 'what all the buds have done together', async () => {
    const j = await api('buds', { params: { limit: 1 } }); const t = j.totals || {};
    const rows = [['buds working', t.buds], ['fees claimed', fsol(t.claimed) + ' SOL'], ['bought back + burned', fsol(t.burned) + ' SOL'], ['dropped to holders', fsol(t.dropped) + ' SOL'], ['paid to devs', fsol(t.dev) + ' SOL'], ['jobs done', t.jobs]];
    await slow(rows.map(([k, v]) => `<span class="dim">${esc(pad(k, 24))}</span><span class="am">${esc(String(v ?? '—'))}</span>`), 40);
    print(`<span class="dim">${esc(pad('engine', 24))}</span>${j.tickAt ? 'last pass ' + ago(j.tickAt) + ' ago' : 'no pass yet'}`);
  });

  add('launch new', 'open launch.exe (launch NAME TICKER pre-fills it)', a => { X.open('launch', a.length ? { name: a.slice(0, -1).join(' ') || a[0], symbol: a.length > 1 ? a[a.length - 1] : '' } : undefined); say('opening launch.exe …', 'dim'); }, 'launch');
  C.launch.args = '[name ticker]';
  add('mix', 'what a bud does with 1 SOL of fees: mix 50 30 20', a => {
    let [b, d, v] = a.map(Number); if (![b, d, v].every(Number.isFinite)) { b = 50; d = 30; v = 20; say('no mix given, showing 50 30 20', 'dim'); }
    const cap = (X.CFG && X.CFG.devCap) || 50;
    if (b + d + v !== 100) return say('the mix has to add up to 100.', 'bad');
    if (v > cap) return say(`the dev cut is ${cap}% at most.`, 'bad');
    print('<span class="dim">for every 1 SOL of creator fees, the bud:</span>');
    print(`  <span class="k-burn">burn</span>  ${bar(b / 100)} <span class="am">${(b / 100).toFixed(2)} SOL</span> <span class="dim">bought back, then burned</span>`);
    print(`  <span class="k-drop">drop</span>  ${bar(d / 100)} <span class="am">${(d / 100).toFixed(2)} SOL</span> <span class="dim">to the top 20 holders, by size</span>`);
    print(`  <span class="k-dev">dev </span>  ${bar(v / 100)} <span class="am">${(v / 100).toFixed(2)} SOL</span> <span class="dim">to the launcher</span>`);
  }, 'launch');
  C.mix.args = '<burn drop dev>';
  add('fees cost', 'what a launch costs (fees 0.5 shows it with a 0.5 SOL first buy)', a => {
    const c = X.CFG || { fee: .05, createSol: .03, reserveSol: .015 }; const dev = Math.max(c.minDev || .01, Number(a[0]) || .1);
    const rows = [['launch fee', c.fee], ['pump.fun create (rent, unused part comes back)', c.createSol], [`first buy (${dev} SOL + 2% slippage room)`, +(dev * 1.02).toFixed(4)], ['the bud’s gas tank (stays with it)', c.reserveSol]];
    rows.forEach(([k, v]) => print(`<span class="dim">${esc(pad(k, 46))}</span><span class="am">${esc(lpad(v.toFixed(4), 8))} SOL</span>`));
    print(`<span class="hl">${esc(pad('total, one transfer', 46))}${esc(lpad(rows.reduce((s, r) => s + r[1], 0).toFixed(4), 8))} SOL</span>`);
  }, 'launch');
  C.fees.args = '[first buy]';
  add('levels', 'how buds level up', () => {
    const L = (X.CFG && X.CFG.levels) || [['rookie', 0], ['grinder', .5], ['workhorse', 5], ['legend', 50]];
    L.forEach(([n, m]) => print(`${lvl(n)}  <span class="dim">from</span> <span class="am">${m} SOL</span> <span class="dim">of fees worked</span>`));
  }, 'launch');

  add('connect login', 'connect a wallet', async () => { const w = await X.connect(); say(`connected: ${w.address}`, 'ok'); }, 'wallet');
  add('disconnect logout', 'disconnect the wallet', async () => { await X.WAL.disconnect(); say('disconnected.', 'dim'); }, 'wallet');
  add('whoami', 'your wallet, if connected', () => { const w = X.WAL.current(); say(w ? w.address : 'night shift. (no wallet connected)', w ? 'ok' : 'dim'); }, 'wallet');
  add('mybuds mine', 'the buds you launched', async () => {
    const w = X.WAL.current(); if (!w) return say('connect a wallet first: type connect', 'warn');
    const j = await api('buds', { params: { owner: w.address } });
    if (!j.buds.length) return say('you have no buds yet. type launch.', 'dim');
    j.buds.forEach(b => print(`${budLink(b)}  <span class="ok">$${esc(b.symbol)}</span>  <span class="dim">${esc(b.state)}</span>  ${lvl(b.level)}  <span class="am">${fsol(b.devPaid)} SOL</span> <span class="dim">paid to you</span>`));
  }, 'wallet');

  add('engine status', 'the engine: when it last ran, what it does', async () => {
    const j = await api('buds', { params: { limit: 1 } });
    print(`<span class="dim">last pass   </span>${j.tickAt ? `<span class="ok">${ago(j.tickAt)} ago</span>` : '<span class="warn">none yet</span>'}`);
    print('<span class="dim">schedule    </span>every minute, around the clock');
    print('<span class="dim">each pass   </span>claim fees → split by the locked mix → buy back + burn, drop SOL to the top holders, pay the dev');
    print('<span class="dim">custody     </span>each bud is a wallet held by this engine. it can claim, buy, burn and send to holders and the dev. it cannot sell.');
  }, 'system');
  add('open run', 'open a window: open ledger', a => { const m = { terminal: 'term', term: 'term', launch: 'launch', buds: 'buds', ledger: 'ledger', greenhouse: 'greenhouse', readme: 'readme', bagwork: 'bagwork', game: 'bagwork', paint: 'paint', display: 'display', bin: 'bin' }[a[0]]; if (!m) return say('open what? launch, buds, ledger, greenhouse, readme, bagwork, paint, display', 'dim'); X.open(m); }, 'system');
  C.open.args = '<app>';
  add('ls dir', 'list files', () => print(['readme.txt', 'launch.exe', 'bagwork.exe', 'paint.exe', 'ledger.db', '<span class="mute">sleep.exe (deleted)</span>'].map(f => `<span class="ok">${f}</span>`).join('   ')), 'system');
  add('cat type', 'print a file', a => {
    if (!a[0]) return say('cat what?', 'dim');
    if (/readme/.test(a[0])) { ['every coin gets a bud.', 'the bud is the coin’s creator wallet. every minute it claims the creator fees and does the bagwork:', '  burn: buys the coin back and burns it', '  drop: sends SOL to the top 20 holders', '  dev:  pays the launcher', 'the launcher picks the mix once. it is locked forever.', 'open readme.txt for the long version.'].forEach(l => say(l)); return; }
    if (/sleep/.test(a[0])) return say('cat: sleep.exe: no such file. buds don’t sleep.', 'bad');
    say(`cat: ${a[0]}: binary file. try opening it.`, 'dim');
  }, 'system');
  add('date time', 'the time', () => say(new Date().toString()), 'system');
  add('echo', 'say it back', a => say(a.join(' ')), 'system');
  add('history', 'what you typed', () => hist.slice(-20).forEach((h, i) => say(`${lpad(i + 1, 3)}  ${h}`, 'dim')), 'system');
  add('clear cls', 'clear the screen', () => { out.innerHTML = ''; }, 'system');
  add('ping', 'how fast the engine answers', async () => { const t0 = performance.now(); await api('config'); say(`pong from the engine in ${Math.round(performance.now() - t0)} ms`, 'ok'); }, 'system');
  add('budfetch neofetch', 'about this machine', () => {
    const t = X.TOTALS || {};
    print(`<img class="tav big" src="${X.avatarURL('budfetch', 96)}" alt=""><div class="fetch">${[['os', 'bud OS 2.0 (night shift)'], ['host', 'the greenhouse'], ['kernel', 'photosynthetic 33 MHz'], ['uptime', 'since the lights came on'], ['buds', String(t.buds ?? '—') + ' working'], ['claimed', fsol(t.claimed) + ' SOL'], ['sleep', 'not found']].map(([k, v]) => `<div><span class="ok">${k}</span><span class="dim">:</span> ${esc(v)}</div>`).join('')}<div class="sw">${['#0b3d1f', '#1d8a45', '#5cf08a', '#c6ffd6', '#f2c14e', '#7fe3c4'].map(c => `<i style="background:${c}"></i>`).join('')}</div></div>`, 'fetchl');
  }, 'system');
  add('exit quit', 'close the terminal', () => X.WM.close('term'), 'system');
  add('pet', 'let a bud out onto the taskbar', a => { X.emit('pet:spawn', a[0] || null); say('a bud climbed onto the taskbar.', 'ok'); }, 'fun');
  add('grow', 'watch a seed grow', async () => {
    const F = ['        .', '       \\|/', '      \\ | /', '    `\\\\|//´', '   ( o  o )  <- it sees you', '    \\ ‿‿ /'];
    for (let i = 0; i < F.length; i++) { print(`<span class="ok">${esc(F[i])}</span>`); await X.sleep(260); }
  }, 'fun');
  add('matrix rain', 'green rain', async () => {
    const d = print('', 'rainbox'); const cols = 64; let n = 0;
    const id = setInterval(() => { d.textContent = Array.from({ length: 10 }, () => Array.from({ length: cols }, () => Math.random() < .14 ? 'ｱｲｳｴｵ01$◎bud'[Math.random() * 13 | 0] : ' ').join('')).join('\n'); if (++n > 40) { clearInterval(id); d.remove(); } }, 80);
  }, 'fun');
  add('sudo', null, () => say('no root here. only roots.', 'dim'), 'fun');
  add('sleep', 'try it', () => say('buds don’t sleep.', 'bad'), 'fun');
  add('sell', null, () => say('buds don’t sell. they buy back.', 'warn'), 'fun');
  add('rug', null, () => say('not on my watch.', 'warn'), 'fun');
  add('gm', null, () => say('gm. i didn’t sleep.', 'ok'), 'fun');
  add('wen', null, () => say('bagwork first.', 'ok'), 'fun');
  add('bagwork', 'play bagwork.exe', () => X.open('bagwork'), 'fun');

  // ---------------------------------------------------------------- input
  async function run(raw) {
    const line = raw.trim(); print(PS() + `<span class="cmd">${esc(raw)}</span>`);
    if (!line) return;
    hist.push(line); hist = hist.slice(-80); hi = hist.length; X.ls.set('bud:hist', JSON.stringify(hist));
    const [name, ...args] = line.split(/\s+/); const c = C[name.toLowerCase()];
    if (!c) return say(`${name}: command not found. type help.`, 'bad');
    busy = true; inp.disabled = true;
    try { await c.fn(args); } catch (e) { say(e.message || String(e), 'bad'); }
    busy = false; inp.disabled = false; if (X.WM.isOpen('term')) inp.focus();
  }
  function complete() {
    const v = inp.value, parts = v.split(/\s+/);
    const pool = parts.length > 1 ? X.BUDS.map(b => b.budName).concat(X.BUDS.map(b => '$' + b.symbol)) : Object.keys(C);
    const last = parts[parts.length - 1].toLowerCase(), hits = pool.filter(p => p.toLowerCase().startsWith(last));
    if (hits.length === 1) { parts[parts.length - 1] = hits[0]; inp.value = parts.join(' ') + ' '; }
    else if (hits.length > 1) print(hits.slice(0, 30).map(h => `<span class="ok">${esc(h)}</span>`).join('  '));
  }
  async function bootText() {
    if (booted) return; booted = true;
    await slow([
      `<img class="tav big" src="${X.avatarURL('term', 64)}" alt=""><span class="hl big">bud.sh</span> <span class="dim">· bud OS terminal · night shift</span>`,
      '<span class="dim">every coin gets a bud. it does the bagwork while you sleep.</span>',
      `<span class="dim">type</span> <span class="ok">help</span><span class="dim">, or try</span> <span class="ok">buds</span><span class="dim">,</span> <span class="ok">stats</span><span class="dim">,</span> <span class="ok">feed -f</span><span class="dim">,</span> <span class="ok">mix 50 30 20</span><span class="dim">,</span> <span class="ok">launch</span>`,
      '&nbsp;'], 60);
  }
  return {
    term: {
      title: 'bud.sh — terminal', short: 'bud.sh', icon: 'term', w: 820, h: 500, minW: 360, minH: 220, cls: 'termw',
      build(el) {
        el.innerHTML = `<div class="term"><div class="tout scroll"></div><label class="tin">${PS()}<input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="command"></label></div>`;
        out = el.querySelector('.tout'); inp = el.querySelector('input'); wrap = el.querySelector('.term');
        wrap.addEventListener('pointerup', () => { if (!getSelection().toString()) inp.focus(); });
        out.addEventListener('click', e => { const a = e.target.closest('.budl'); if (a) { e.preventDefault(); X.openBud(a.dataset.bud); } });
        inp.addEventListener('keydown', e => {
          if (e.key !== 'Tab') SOUND.sfx('key');
          if (e.key === 'Enter') { const v = inp.value; inp.value = ''; run(v); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, hi - 1); inp.value = hist[hi] || ''; }
          else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; }
          else if (e.key === 'Tab') { e.preventDefault(); complete(); }
          else if ((e.key === 'c' || e.key === 'C') && e.ctrlKey && !getSelection().toString()) { e.preventDefault(); stopFollow(); inp.value = ''; }
          else if ((e.key === 'l' || e.key === 'L') && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
        });
      },
      async open(arg) { await bootText(); if (typeof arg === 'string' && arg) run(arg); setTimeout(() => inp && inp.focus(), 60); },
      focus() { setTimeout(() => inp && !busy && inp.focus(), 0); },
      close() { stopFollow(); },
    },
  };
}
