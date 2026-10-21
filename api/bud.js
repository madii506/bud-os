// bud's one function. Every route the site uses comes through here (vercel.json rewrites /api/<op> to ?op=<op>).
//  GET  config                 what launching costs, the levels, whether launching is open
//  POST prepare                record the coin, its bud and the locked mix; returns the bud's wallet and the deposit it needs
//  POST paybuild {id}          the deposit as an unsigned transfer, for the launcher's wallet to sign
//  POST relay {id, tx}         sends the signed deposit (only to a bud that is waiting for one)
//  GET  status?id=             where a launch is; a full deposit starts the coin
//  GET  buds[?sort=&owner=]    every bud and what it has done
//  GET  bud?id=|mint=          one bud and its work log
//  GET  feed[?after=]          the latest jobs across all buds
//  GET  tick                   one engine pass (the cron calls it every minute)
//  GET  meta?id= / img?id=     the metadata JSON and picture a coin's on-chain uri points at (/m/<id>, /i/<id>)
//  GET  selftest               builds and simulates a create and a claim with a throwaway key (no funds move)
const crypto = require('crypto');
const L = require('./_lib');
const E = require('./_engine');

const SOL = n => +(Number(n) / 1e9).toFixed(4);
const NAMES = ['moss', 'sprig', 'fern', 'thorn', 'sprout', 'clover', 'sap', 'pip', 'root', 'basil', 'ivy', 'kelp', 'reed', 'bramble', 'seedling', 'nettle', 'sorrel', 'lichen', 'mint', 'tendril'];

async function upload(img, f, site, id) {
  // 1) pump.fun's own IPFS upload, when it still takes them  2) Pinata, when the house has a key  3) this site
  try {
    if (!L.MOCK) {
      const fd = new FormData();
      fd.append('file', new Blob([img], { type: 'image/jpeg' }), 'coin.jpg');
      for (const [k, v] of Object.entries({ name: f.name, symbol: f.symbol, description: f.description, twitter: f.twitter || '', telegram: f.telegram || '', website: f.website, showName: 'true' })) fd.append(k, v);
      const r = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: fd, signal: AbortSignal.timeout(12000) });
      const j = await r.json().catch(() => null);
      if (j && j.metadataUri && /^https?:\/\//.test(j.metadataUri)) return { uri: j.metadataUri, via: 'pump.fun ipfs' };
    }
  } catch {}
  const jwt = (process.env.PINATA_JWT || '').trim();
  if (jwt && !L.MOCK) {
    try {
      const put = async (blob, name) => { const fd = new FormData(); fd.append('network', 'public'); fd.append('file', blob, name);
        const r = await fetch('https://uploads.pinata.cloud/v3/files', { method: 'POST', headers: { Authorization: 'Bearer ' + jwt }, body: fd, signal: AbortSignal.timeout(15000) });
        const j = await r.json(); if (!j || !j.data || !j.data.cid) throw new Error('pinata'); return 'https://ipfs.io/ipfs/' + j.data.cid; };
      const image = await put(new Blob([img], { type: 'image/jpeg' }), 'coin.jpg');
      const meta = await put(new Blob([JSON.stringify({ name: f.name, symbol: f.symbol, description: f.description, image, showName: true, createdOn: site, twitter: f.twitter || undefined, telegram: f.telegram || undefined, website: f.website })], { type: 'application/json' }), 'meta.json');
      return { uri: meta, via: 'pinata ipfs' };
    } catch {}
  }
  return { uri: site + '/m/' + id, via: 'bud' };
}
async function picture(dataUrl) {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const raw = Buffer.from(m[2], 'base64');
  try { return await require('sharp')(raw, { animated: false }).rotate().resize(512, 512, { fit: 'cover' }).flatten({ background: '#06120b' }).jpeg({ quality: 88, mozjpeg: true }).toBuffer(); }
  catch { return /jpe?g/.test(m[1]) ? raw : null; }
}

function mixOf(b) {
  const mx = b && b.mix || {}; const burn = Math.round(Number(mx.burn)), drop = Math.round(Number(mx.drop)), dev = Math.round(Number(mx.dev));
  if (![burn, drop, dev].every(v => Number.isInteger(v) && v >= 0 && v <= 100)) return null;
  if (burn + drop + dev !== 100 || dev > E.DEV_CAP) return null;
  return { burn, drop, dev };
}

async function prepare(req, res) {
  if (!L.MOCK && L.limited('prep:' + L.ip(req), 8, 600000)) return L.send(res, 200, { ok: false, error: 'Too many launches from here. Wait a few minutes.' });
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'The engine’s records are offline, so launching is paused.' });
  const b = await L.body(req, 2.6 * 1024 * 1024);
  if (b.tooBig) return L.send(res, 200, { ok: false, error: 'That picture is too big. Use one under 1.5 MB.' });
  const launcher = String(b.launcher || '').trim();
  if (!L.isAddr(launcher)) return L.send(res, 200, { ok: false, error: 'Connect a wallet first. The first buy, the dev pay and any refund go there.' });
  const name = L.clean(b.name, 32), symbol = L.clean(b.symbol, 10).replace(/^\$/, '').toUpperCase();
  const description = L.clean(b.description, 400);
  if (!name || Buffer.byteLength(name) > 32) return L.send(res, 200, { ok: false, error: 'Give the coin a name of up to 32 characters.' });
  if (!/^[A-Z0-9]{1,10}$/.test(symbol)) return L.send(res, 200, { ok: false, error: 'The ticker is 1–10 letters or numbers.' });
  if (L.BANNED.test(name + ' ' + symbol + ' ' + description + ' ' + (b.budName || ''))) return L.send(res, 200, { ok: false, error: 'Pick other words. Those break the house rules.' });
  const tw = String(b.twitter || '').trim(), tg = String(b.telegram || '').trim(), web = String(b.website || '').trim();
  if (tw && !/^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]{1,15}(\/status\/\d+)?\/?$/.test(tw)) return L.send(res, 200, { ok: false, error: 'The X link should look like https://x.com/yourcoin.' });
  if (tg && !/^https:\/\/t\.me\/[A-Za-z0-9_+]{3,64}\/?$/.test(tg)) return L.send(res, 200, { ok: false, error: 'The Telegram link should look like https://t.me/yourcoin.' });
  if (web && !/^https:\/\/[^\s"'<>]{3,200}$/.test(web)) return L.send(res, 200, { ok: false, error: 'The website should start with https://.' });
  const dev = Number(b.devBuy);
  if (!(dev >= E.MIN_DEV && dev <= E.MAX_DEV)) return L.send(res, 200, { ok: false, error: `The first buy is between ${E.MIN_DEV} and ${E.MAX_DEV} SOL.` });
  const mix = mixOf(b);
  if (!mix) return L.send(res, 200, { ok: false, error: `The mix has to add up to 100%, with the dev cut at ${E.DEV_CAP}% or less.` });
  let budName = String(b.budName || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 16);
  if (!budName) budName = NAMES[crypto.randomInt(NAMES.length)] + '.' + String(crypto.randomInt(100)).padStart(2, '0');
  const img = await picture(b.image);
  if (!img) return L.send(res, 200, { ok: false, error: 'Add a picture for the coin (PNG, JPG, WEBP or GIF).' });
  try {
    await L.ready();
    const id = E.newId(); const k = await E.keys(id);
    const wallet = k.wallet.publicKey.toBase58(), mint = k.mint.publicKey.toBase58();
    const site = L.origin(req), page = site + '/?bud=' + mint;
    const desc = (description ? description + '\n\n' : '') + `this coin has a bud. it claims the creator fees and does the bagwork: burn ${mix.burn}% · drop ${mix.drop}% · dev ${mix.dev}%. ${page.replace(/^https?:\/\//, '')}`;
    const up = await upload(img, { name, symbol, description: desc, twitter: tw, telegram: tg, website: web || page }, site, id);
    const needL = E.need(dev);
    await L.q(`INSERT INTO bud_coins (id, wallet, mint, launcher, name, symbol, bud_name, description, twitter, telegram, website, img, meta_uri, dev_buy, need, mix_burn, mix_drop, mix_dev)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, [id, wallet, mint, launcher, name, symbol, budName, desc, tw || null, tg || null, web || null, img, up.uri, dev, needL, mix.burn, mix.drop, mix.dev]);
    await L.log(id, 'launch', `${budName} is waiting for ${SOL(needL)} SOL to launch $${symbol}`);
    L.send(res, 200, { ok: true, id, wallet, mint, budName, need: needL, needSol: SOL(needL), parts: { fee: SOL(E.FEE), create: SOL(E.CREATE_COST), dev: +(dev * 1.02).toFixed(4), gas: SOL(E.RESERVE) }, uri: up.uri, via: up.via, mix });
  } catch (e) { L.send(res, 200, { ok: false, error: 'The launch didn’t save. Try again.' }); }
}

async function row(id) { const r = await L.q('SELECT * FROM bud_coins WHERE id=$1', [id]); return r[0] || null; }
const okId = id => /^[A-Za-z0-9_-]{6,20}$/.test(String(id || ''));

async function paybuild(req, res) {
  const b = await L.body(req, 4096);
  if (!okId(b.id)) return L.send(res, 200, { ok: false, error: 'No such launch.' });
  await L.ready(); const c = await row(b.id);
  if (!c || c.state !== 'waiting') return L.send(res, 200, { ok: false, error: 'That launch isn’t waiting for a deposit.' });
  const bal = await L.balance(c.wallet).catch(() => 0);
  const left = Math.max(0, Number(c.need) - bal);
  if (left <= 0) return L.send(res, 200, { ok: true, paid: true });
  const { Transaction, SystemProgram, PublicKey, ComputeBudgetProgram } = require('@solana/web3.js');
  const bh = await E.blockhash();
  const from = new PublicKey(c.launcher);
  const tx = new Transaction({ feePayer: from, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight })
    .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20000 }), SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(c.wallet), lamports: left }));
  L.send(res, 200, { ok: true, tx: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), lamports: left, sol: SOL(left) });
}

async function relay(req, res) {
  if (!L.MOCK && L.limited('relay:' + L.ip(req), 12, 600000)) return L.send(res, 200, { ok: false, error: 'Too many from here.' });
  const b = await L.body(req, 4096);
  try {
    const { Transaction, SystemProgram } = require('@solana/web3.js');
    const buf = Buffer.from(String(b.tx || ''), 'base64'); const tx = Transaction.from(buf);
    const to = tx.instructions.filter(i => i.programId.equals(SystemProgram.programId)).map(i => i.keys[1] && i.keys[1].pubkey.toBase58()).filter(Boolean);
    if (!to.length) return L.send(res, 200, { ok: false, error: 'That isn’t a deposit.' });
    await L.ready();
    const ok = await L.q(`SELECT id FROM bud_coins WHERE wallet = ANY($1) AND state='waiting'`, [to]);
    if (!ok.length) return L.send(res, 200, { ok: false, error: 'That deposit isn’t for a bud that is waiting.' });
    const sig = await E.sendRaw(buf);
    await L.q(`UPDATE bud_coins SET pay_sig=$2 WHERE id=$1`, [ok[0].id, sig]);
    L.send(res, 200, { ok: true, sig });
  } catch (e) { L.send(res, 200, { ok: false, error: 'Sending failed: ' + String(e.message).slice(0, 140) }); }
}

async function status(req, res) {
  const id = String(L.query(req).id || '');
  if (!okId(id) || !L.dbReady()) return L.send(res, 200, { ok: false, error: 'No such launch.' });
  await L.ready();
  let c = await row(id); if (!c) return L.send(res, 200, { ok: false, error: 'No such launch.' });
  let bal = null, note = null;
  if (['waiting', 'creating', 'failed', 'expired'].includes(c.state)) {
    try { const a = await E.advance(c); if (a && a.balance != null) bal = a.balance; if (a && a.error) note = a.error; } catch (e) { note = String(e.message).slice(0, 160); }
    c = await row(id);
  }
  if (bal == null && c.state === 'waiting') bal = await L.balance(c.wallet).catch(() => null);
  const logs = await L.q(`SELECT kind, text, sig, sol, at FROM bud_log WHERE id=$1 AND kind<>'tx' ORDER BY n DESC LIMIT 12`, [id]);
  L.send(res, 200, { ok: true, id: c.id, state: c.state, wallet: c.wallet, mint: c.mint, symbol: c.symbol, budName: c.bud_name, need: Number(c.need), needSol: SOL(c.need), balance: bal,
    pay_sig: c.pay_sig, create_sig: c.create_sig, fee_sig: c.fee_sig, out_sig: c.out_sig, refund_sig: c.refund_sig, err: c.err, note, logs });
}

function pub(c) {
  return { id: c.id, n: c.n, name: c.name, symbol: c.symbol, budName: c.bud_name, mint: c.mint, wallet: c.wallet, launcher: c.launcher, state: c.state,
    mix: { burn: c.mix_burn, drop: c.mix_drop, dev: c.mix_dev }, level: E.level(c.claimed), claimed: SOL(c.claimed), burnedSol: SOL(c.burned_sol), burnedTokens: String(c.burned_tokens || '0'),
    dropped: SOL(c.dropped), drops: c.drops, devPaid: SOL(c.dev_paid), jobs: c.jobs, owed: { burn: SOL(c.owed_burn), drop: SOL(c.owed_drop), dev: SOL(c.owed_dev) },
    last: c.last_text, liveAt: c.live_at, workedAt: c.worked_at, tickedAt: c.ticked_at, createdAt: c.created_at, mcapSol: c.mcap_usd, complete: c.complete,
    img: '/i/' + c.id, twitter: c.twitter, telegram: c.telegram, website: c.website, createSig: c.create_sig };
}
const COLS = `id, n, name, symbol, bud_name, mint, wallet, launcher, state, mix_burn, mix_drop, mix_dev, claimed, burned_sol, burned_tokens, dropped, drops, dev_paid, jobs,
  owed_burn, owed_drop, owed_dev, last_text, live_at, worked_at, ticked_at, created_at, mcap_usd, complete, twitter, telegram, website, create_sig`;
async function buds(req, res) {
  if (!L.dbReady()) return L.send(res, 200, { ok: true, buds: [], totals: {}, offline: true });
  await L.ready();
  const qy = L.query(req), owner = String(qy.owner || ''), lim = Math.max(1, Math.min(200, Number(qy.limit) || 100));
  const order = { top: 'claimed DESC', active: 'worked_at DESC NULLS LAST', recent: 'COALESCE(live_at, created_at) DESC' }[qy.sort] || 'COALESCE(live_at, created_at) DESC';
  const rows = L.isAddr(owner)
    ? await L.q(`SELECT ${COLS} FROM bud_coins WHERE launcher=$1 ORDER BY created_at DESC LIMIT $2`, [owner, lim])
    : await L.q(`SELECT ${COLS} FROM bud_coins WHERE state IN ('live','creating') ORDER BY ${order} LIMIT $1`, [lim]);
  const t = (await L.q(`SELECT count(*)::int AS buds, COALESCE(sum(claimed),0) AS claimed, COALESCE(sum(burned_sol),0) AS burned, COALESCE(sum(dropped),0) AS dropped,
    COALESCE(sum(dev_paid),0) AS dev, COALESCE(sum(jobs),0)::int AS jobs FROM bud_coins WHERE state='live'`))[0];
  const tick = await L.q(`SELECT v FROM bud_meta WHERE k='tick_done'`).catch(() => []);
  L.send(res, 200, { ok: true, buds: rows.map(pub), totals: { buds: t.buds, claimed: SOL(t.claimed), burned: SOL(t.burned), dropped: SOL(t.dropped), dev: SOL(t.dev), jobs: t.jobs },
    tickAt: tick[0] ? Number(tick[0].v) : null }, L.isAddr(owner) ? 'no-store' : L.CACHE(8, 30));
}
async function bud(req, res) {
  const qy = L.query(req); if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'offline' });
  await L.ready();
  const r = okId(qy.id) ? await L.q(`SELECT ${COLS}, description FROM bud_coins WHERE id=$1`, [qy.id]) : L.isAddr(String(qy.mint || '')) ? await L.q(`SELECT ${COLS}, description FROM bud_coins WHERE mint=$1`, [qy.mint]) : [];
  if (!r.length) return L.send(res, 200, { ok: false, error: 'No bud by that name.' });
  const logs = await L.q(`SELECT n, kind, text, sol, tokens, sig, at FROM bud_log WHERE id=$1 AND kind NOT IN ('tx') ORDER BY n DESC LIMIT 80`, [r[0].id]);
  L.send(res, 200, { ok: true, bud: { ...pub(r[0]), description: r[0].description }, logs }, L.CACHE(6, 20));
}
async function feed(req, res) {
  if (!L.dbReady()) return L.send(res, 200, { ok: true, items: [] });
  await L.ready();
  const qy = L.query(req), after = Math.max(0, Number(qy.after) || 0), before = Math.max(0, Number(qy.before) || 0), lim = Math.max(1, Math.min(100, Number(qy.limit) || 40));
  const kinds = ['launch', 'claim', 'burn', 'drop', 'dev', 'refund'].includes(qy.kind) ? [qy.kind] : ['launch', 'claim', 'burn', 'drop', 'dev', 'refund'];
  const items = await L.q(`SELECT l.n, l.id, l.kind, l.text, l.sol, l.tokens, l.sig, l.at, c.symbol, c.bud_name, c.mint FROM bud_log l JOIN bud_coins c ON c.id=l.id
    WHERE l.n > $1 AND ($2 = 0 OR l.n < $2) AND l.kind = ANY($3) ORDER BY l.n DESC LIMIT $4`, [after, before, kinds, lim]);
  L.send(res, 200, { ok: true, items, last: items[0] ? Number(items[0].n) : after }, L.CACHE(4, 12));
}
// the dashboard: activity in buckets (24 hours by the hour, the last hour by 2 minutes), the top buds, the newest buds
const KINDS = ['claim', 'burn', 'drop', 'dev'];
async function stats(req, res) {
  if (!L.dbReady()) return L.send(res, 200, { ok: true, offline: true, hours: [], mins: [], top: [], fresh: [], day: {}, totals: {} });
  await L.ready();
  const bucket = (rows, born, n) => { const out = Array.from({ length: n }, (_, i) => ({ i, claims: 0, jobs: 0, launches: 0, claim: 0, burn: 0, drop: 0, dev: 0 }));
    for (const r of rows) { const b = out[Math.max(0, Math.min(n - 1, r.b))]; if (r.kind === 'claim') b.claims += r.n; else b.jobs += r.n; b[r.kind] += +Number(r.sol || 0).toFixed(6); }
    for (const r of born) out[Math.max(0, Math.min(n - 1, r.b))].launches += r.n;
    return out; };
  const [hr, mn, hb, mb, top, fresh, day, born, t, tick] = await Promise.all([
    L.q(`SELECT floor(extract(epoch from (now() - at)) / 3600)::int AS b, kind, count(*)::int AS n, COALESCE(sum(sol),0)::float8 AS sol FROM bud_log WHERE at > now() - interval '24 hours' AND kind = ANY($1) GROUP BY 1, 2`, [KINDS]),
    L.q(`SELECT floor(extract(epoch from (now() - at)) / 120)::int AS b, kind, count(*)::int AS n, COALESCE(sum(sol),0)::float8 AS sol FROM bud_log WHERE at > now() - interval '60 minutes' AND kind = ANY($1) GROUP BY 1, 2`, [KINDS]),
    L.q(`SELECT floor(extract(epoch from (now() - live_at)) / 3600)::int AS b, count(*)::int AS n FROM bud_coins WHERE live_at > now() - interval '24 hours' GROUP BY 1`),
    L.q(`SELECT floor(extract(epoch from (now() - live_at)) / 120)::int AS b, count(*)::int AS n FROM bud_coins WHERE live_at > now() - interval '60 minutes' GROUP BY 1`),
    L.q(`SELECT ${COLS} FROM bud_coins WHERE state='live' ORDER BY claimed DESC, live_at ASC LIMIT 8`),
    L.q(`SELECT ${COLS} FROM bud_coins WHERE state='live' ORDER BY live_at DESC NULLS LAST LIMIT 5`),
    L.q(`SELECT count(*) FILTER (WHERE kind='claim')::int AS claims, count(*) FILTER (WHERE kind IN ('burn','drop','dev'))::int AS jobs,
      count(DISTINCT id) FILTER (WHERE kind='claim')::int AS working, COALESCE(sum(sol) FILTER (WHERE kind='claim'),0)::float8 AS claimed FROM bud_log WHERE at > now() - interval '24 hours'`),
    L.q(`SELECT count(*)::int AS n FROM bud_coins WHERE live_at > now() - interval '24 hours'`),
    L.q(`SELECT count(*)::int AS buds, COALESCE(sum(claimed),0) AS claimed, COALESCE(sum(burned_sol),0) AS burned, COALESCE(sum(dropped),0) AS dropped, COALESCE(sum(dev_paid),0) AS dev,
      COALESCE(sum(jobs),0)::int AS jobs, COALESCE(sum(drops),0)::int AS drops FROM bud_coins WHERE state='live'`),
    L.q(`SELECT v FROM bud_meta WHERE k='tick_done'`).catch(() => []),
  ]);
  const d = day[0] || {}, tt = t[0] || {};
  L.send(res, 200, { ok: true, hours: bucket(hr, hb, 24), mins: bucket(mn, mb, 30), top: top.map(pub), fresh: fresh.map(pub),
    day: { claims: d.claims || 0, jobs: d.jobs || 0, launches: (born[0] && born[0].n) || 0, working: d.working || 0, claimed: +Number(d.claimed || 0).toFixed(4) },
    totals: { buds: tt.buds || 0, claimed: SOL(tt.claimed || 0), burned: SOL(tt.burned || 0), dropped: SOL(tt.dropped || 0), dev: SOL(tt.dev || 0), jobs: tt.jobs || 0, drops: tt.drops || 0 },
    tickAt: tick[0] ? Number(tick[0].v) : null, now: Date.now() }, L.CACHE(10, 40));
}
async function meta(req, res) {
  const qy = L.query(req);
  if (!L.dbReady()) return L.send(res, 404, { error: 'not found' });
  await L.ready();
  if (qy.img) {
    const id = String(qy.img).replace(/\.\w+$/, '');
    const r = okId(id) ? await L.q('SELECT img FROM bud_coins WHERE id=$1 AND img IS NOT NULL', [id]).catch(() => []) : [];
    if (!r.length) { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=30'); return res.end(); }
    res.statusCode = 200; res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
    return res.end(Buffer.from(r[0].img));
  }
  const id = String(qy.id || '').replace(/\.json$/, '');
  if (!okId(id)) return L.send(res, 404, { error: 'not found' });
  const r = await L.q('SELECT id, mint, name, symbol, description, twitter, telegram, website FROM bud_coins WHERE id=$1', [id]).catch(() => []);
  if (!r.length) return L.send(res, 404, { error: 'not found' }, 'public, max-age=30');
  const k = r[0], site = L.origin(req), page = site + '/?bud=' + k.mint;
  L.send(res, 200, { name: k.name, symbol: k.symbol, description: k.description, image: site + '/i/' + k.id, showName: true, createdOn: site,
    twitter: k.twitter || undefined, telegram: k.telegram || undefined, website: k.website || page, external_url: page }, 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
}
async function selftest(req, res) {
  if (L.limited('st:' + L.ip(req), 6, 600000)) return L.send(res, 200, { ok: false, error: 'Wait a few minutes.' });
  const { Keypair } = require('@solana/web3.js');
  const sim = async tx => { const j = await L.rpcRaw('simulateTransaction', [Buffer.from(tx.serialize()).toString('base64'), { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed' }]);
    const v = j.result && j.result.value; return { err: v ? v.err : j.error && j.error.message, logs: v && v.logs ? v.logs.slice(-4) : [] }; };
  const out = {}; const w = Keypair.generate(), mk = Keypair.generate();
  const step = async (name, fn) => { const t0 = Date.now(); try { out[name] = { ok: true, ...(await fn()), ms: Date.now() - t0 }; } catch (e) { out[name] = { ok: false, error: String(e.message).slice(0, 200), ms: Date.now() - t0 }; } };
  await step('create', async () => { const tx = await E.portal({ publicKey: w.publicKey.toBase58(), action: 'create', tokenMetadata: { name: 'bud selftest', symbol: 'TEST', uri: L.origin(req) + '/m/selftest' }, mint: mk.publicKey.toBase58(), denominatedInSol: 'true', amount: 0.01, slippage: 10, priorityFee: 0.0001, pool: 'pump' }, [mk, w]);
    return { bytes: tx.serialize().length, sim: await sim(tx) }; });
  await step('claim', async () => { const tx = await E.portal({ publicKey: w.publicKey.toBase58(), action: 'collectCreatorFee', priorityFee: 0.00001, pool: 'pump' }, [w]); return { bytes: tx.serialize().length, sim: await sim(tx) }; });
  await step('keys', async () => { if (!L.dbReady()) return { db: false }; const a = await E.keys('selftest-x'), b2 = await E.keys('selftest-x'); return { stable: a.wallet.publicKey.equals(b2.wallet.publicKey), distinct: !a.wallet.publicKey.equals(a.mint.publicKey) }; });
  L.send(res, 200, { ok: true, note: 'throwaway keys, nothing is sent; insufficient-funds errors in the simulation are expected', ...out });
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return L.send(res, 204, {});
  const op = String(L.query(req).op || 'config');
  try {
    if (req.method === 'POST' && op === 'prepare') return await prepare(req, res);
    if (req.method === 'POST' && op === 'paybuild') return await paybuild(req, res);
    if (req.method === 'POST' && op === 'relay') return await relay(req, res);
    if (op === 'status') return await status(req, res);
    if (op === 'buds') return await buds(req, res);
    if (op === 'bud') return await bud(req, res);
    if (op === 'feed') return await feed(req, res);
    if (op === 'stats') return await stats(req, res);
    if (op === 'meta') return await meta(req, res);
    if (op === 'img') { req.query = { ...(L.query(req)), img: L.query(req).id }; return await meta(req, res); }
    if (op === 'tick') { if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'engine offline: no database' }); return L.send(res, 200, await E.tick(40000)); }
    if (op === 'blockhash') return L.send(res, 200, { ok: true, ...(await E.blockhash()) });
    if (op === 'selftest') return await selftest(req, res);
    L.send(res, 200, { ok: true, open: L.dbReady(), fee: SOL(E.FEE), feeWallet: L.FEE_WALLET, createSol: SOL(E.CREATE_COST), reserveSol: SOL(E.RESERVE), minDev: E.MIN_DEV, maxDev: E.MAX_DEV,
      devCap: E.DEV_CAP, levels: E.LEVELS, jobMin: { burn: SOL(E.JOB_MIN.burn), drop: SOL(E.JOB_MIN.drop), dev: SOL(E.JOB_MIN.dev) }, mock: !!L.MOCK }, L.CACHE(60));
  } catch (e) { L.send(res, 200, { ok: false, error: 'Something broke: ' + String(e && e.message).slice(0, 120) }); }
};
