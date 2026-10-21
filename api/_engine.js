// The engine. It is custodial, and says so: every coin launched on bud gets its own wallet (the bud), derived on this
// server from one master secret, and that wallet is the coin's pump.fun creator. Every minute the engine claims the
// coin's creator fees into the bud and does the bagwork the launcher picked at launch: buy back and burn, drop SOL to
// the top holders, pay the dev. The mix is locked. Every job is a public Solana transaction, logged with its signature.
// There is no sell job and no withdraw job.
const crypto = require('crypto');
const L = require('./_lib');

let web3 = null, spl = null;
const w3 = () => web3 || (web3 = require('@solana/web3.js'));
const sp = () => spl || (spl = require('@solana/spl-token'));

const LAMPORTS = 1e9;
const FEE = 0.05 * LAMPORTS;               // the launch fee, forwarded to the house once the coin is live
const RESERVE = 0.015 * LAMPORTS;          // stays in every bud for gas and token-account rent
const CREATE_COST = 0.03 * LAMPORTS;       // pump.fun rent for a new coin, plus margin; whatever is unused goes back
const MIN_DEV = 0.01, MAX_DEV = 10, DEV_CAP = 50;
const CLAIM_MIN = 0.003 * LAMPORTS;        // claim when at least this much is waiting
const JOB_MIN = { burn: 0.004 * LAMPORTS, drop: 0.01 * LAMPORTS, dev: 0.004 * LAMPORTS };   // a job waits until its share is worth a transaction
const PORTAL = 'https://pumpportal.fun/api/trade-local';
const PRIORITY = Number(process.env.PRIORITY_FEE || 0.0002);
const LEVELS = [['rookie', 0], ['grinder', .5], ['workhorse', 5], ['legend', 50]];
const level = claimedLamports => { const s = Number(claimedLamports) / LAMPORTS; let l = LEVELS[0]; for (const x of LEVELS) if (s >= x[1]) l = x; return l[0]; };
const need = devBuy => Math.ceil((FEE + CREATE_COST + devBuy * 1.02 * LAMPORTS + RESERVE) / 1e6) * 1e6;   // rounded up to 0.001 SOL

// ---------- keys: derived, never stored ----------
let MASTER = null;
async function master() {
  if (MASTER) return MASTER;
  if (process.env.BUD_MASTER && process.env.BUD_MASTER.length >= 32) return (MASTER = process.env.BUD_MASTER);
  await L.ready();
  await L.q(`INSERT INTO bud_meta (k, v) VALUES ('master', $1) ON CONFLICT (k) DO NOTHING`, [crypto.randomBytes(32).toString('hex')]);
  const r = await L.q(`SELECT v FROM bud_meta WHERE k='master'`);
  return (MASTER = r[0].v);
}
async function keys(id) {
  const m = await master(); const { Keypair } = w3();
  const seed = tag => crypto.createHmac('sha256', m).update(tag + ':' + id).digest();
  return { wallet: Keypair.fromSeed(seed('bud')), mint: Keypair.fromSeed(seed('mint')) };
}
const newId = () => crypto.randomBytes(9).toString('base64url');

// ---------- sending ----------
async function blockhash() { const r = await L.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]); return r.value; }
async function confirm(sig, ms = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await L.rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: false }]);
      const s = r.value && r.value[0];
      if (s) { if (s.err) return { ok: false, err: JSON.stringify(s.err) }; if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') return { ok: true }; }
    } catch {}
    await new Promise(r => setTimeout(r, L.MOCK ? 20 : 1500));
  }
  return { ok: false, err: 'not confirmed in time' };
}
async function sendRaw(bytes, skipPreflight = false) {
  const b64 = Buffer.from(bytes).toString('base64');
  const j = await L.rpcRaw('sendTransaction', [b64, { encoding: 'base64', skipPreflight, maxRetries: 3, preflightCommitment: 'confirmed' }], 20000);
  if (j.error) { const logs = j.error.data && j.error.data.logs; throw new Error((j.error.message || 'send failed') + (logs ? ' | ' + logs.slice(-3).join(' | ') : '')); }
  return j.result;
}
async function sendAndConfirm(bytes) { const sig = await sendRaw(bytes); const c = await confirm(sig); if (!c.ok) { const e = new Error(c.err); e.sig = sig; throw e; } return sig; }
async function sendIxs(payer, ixs) {
  const { Transaction, ComputeBudgetProgram } = w3();
  const bh = await blockhash();
  const tx = new Transaction({ feePayer: payer.publicKey, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }), ...ixs); tx.sign(payer);
  return sendAndConfirm(tx.serialize());
}
// PumpPortal's local API writes the pump.fun transaction; we sign it here with the bud's own keys
async function portal(args, signers) {
  if (L.MOCK && L.MOCK.portal) return L.MOCK.portal(args, signers);
  const r = await fetch(PORTAL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(15000) });
  if (r.status !== 200) throw new Error('pumpportal ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 160));
  const { VersionedTransaction } = w3();
  const tx = VersionedTransaction.deserialize(new Uint8Array(await r.arrayBuffer()));
  tx.sign(signers); return tx;
}

// ---------- reading a bud ----------
async function mintInfo(mint) {
  return L.remember('mi:' + mint, 36e5, async () => { const [m] = await L.accounts([mint]); if (!m) throw new Error('mint not found'); return { program: m.owner, decimals: m.data[44] }; });
}
async function tokenBal(owner, mint) {
  const { program } = await mintInfo(mint); const [a] = await L.accounts([L.ataOf(owner, mint, program)]);
  return L.tokenAmount(a);
}
async function waiting(wallet) {   // creator fees waiting to be claimed, in lamports (bonding curve vault + PumpSwap vault)
  const v1 = L.creatorVaultOf(wallet), v2 = L.ammVaultOf(wallet);
  const [a, b] = await L.accounts([v1, L.ataOf(v2, L.SOL, L.TOKEN)]);
  return Math.max(0, (a ? a.lamports - L.RENT0 : 0)) + Number(L.tokenAmount(b));
}
const fmtTok = (raw, decimals = 6) => { const ui = Number(raw) / 10 ** decimals; return ui >= 1e9 ? (ui / 1e9).toFixed(2) + 'B' : ui >= 1e6 ? (ui / 1e6).toFixed(2) + 'M' : ui >= 1e3 ? (ui / 1e3).toFixed(1) + 'K' : ui.toFixed(0); };
const sol4 = l => (l / LAMPORTS).toFixed(4);
async function say(c, kind, text, extra = {}) { await L.log(c.id, kind, text, extra); if (kind !== 'error') await L.q(`UPDATE bud_coins SET last_text=$2 WHERE id=$1`, [c.id, String(text).slice(0, 200)]).catch(() => {}); }

// ---------- the launch ----------
async function create(c) {
  const k = await keys(c.id);
  await say(c, 'launch', `deposit in. ${c.bud_name} is creating $${c.symbol} on pump.fun`);
  let sig;
  try {
    const tx = await portal({ publicKey: k.wallet.publicKey.toBase58(), action: 'create', tokenMetadata: { name: c.name, symbol: c.symbol, uri: c.meta_uri },
      mint: k.mint.publicKey.toBase58(), denominatedInSol: 'true', amount: c.dev_buy, slippage: 10, priorityFee: PRIORITY, pool: 'pump' }, [k.mint, k.wallet]);
    sig = await sendAndConfirm(tx.serialize());
  } catch (e) {
    const [bc] = await L.accounts([L.bondingCurveOf(c.mint)]).catch(() => [null]);   // it may have landed even though we did not see it confirm
    if (!bc) {
      await L.q(`UPDATE bud_coins SET state='failed', err=$2 WHERE id=$1`, [c.id, String(e.message).slice(0, 300)]);
      await say(c, 'error', 'launch failed: ' + String(e.message).slice(0, 200), { sig: e.sig });
      await refund(c, 'launch failed, the whole deposit went back');
      return { ok: false, error: String(e.message) };
    }
    sig = e.sig || null;
  }
  await L.q(`UPDATE bud_coins SET state='live', live_at=now(), create_sig=$2, err=NULL WHERE id=$1`, [c.id, sig]);
  await say(c, 'launch', `$${c.symbol} is live. ${c.bud_name} is the creator now`, { sig });
  await payFee(c, k).catch(e => L.log(c.id, 'error', 'launch fee transfer failed, will retry: ' + String(e.message).slice(0, 160)));
  await handOut(c, k).catch(e => L.log(c.id, 'error', 'sending the first buy back failed: ' + String(e.message).slice(0, 160)));
  return { ok: true, sig };
}
async function payFee(c, k) {
  if (c.fee_sig || !L.isAddr(L.FEE_WALLET)) return null;
  const { SystemProgram, PublicKey } = w3();
  const sig = await sendIxs(k.wallet, [SystemProgram.transfer({ fromPubkey: k.wallet.publicKey, toPubkey: new PublicKey(L.FEE_WALLET), lamports: FEE })]);
  await L.q(`UPDATE bud_coins SET fee_sig=$2 WHERE id=$1`, [c.id, sig]);
  await L.log(c.id, 'fee', `launch fee paid (${sol4(FEE)} SOL)`, { sig, sol: FEE / LAMPORTS });
  c.fee_sig = sig; return sig;
}
// after launch: the launcher's first-buy tokens and any SOL beyond the bud's gas reserve go back to the launcher
async function handOut(c, k) {
  k = k || await keys(c.id);
  const { PublicKey, SystemProgram } = w3(); const S = sp();
  const owner = k.wallet.publicKey, to = new PublicKey(c.launcher), mint = new PublicKey(c.mint);
  const { program, decimals } = await mintInfo(c.mint); const prog = new PublicKey(program);
  const ixs = [];
  const amt = await tokenBal(owner.toBase58(), c.mint);
  if (amt > 0n) {
    const src = new PublicKey(L.ataOf(owner.toBase58(), c.mint, program)), dst = new PublicKey(L.ataOf(c.launcher, c.mint, program));
    ixs.push(S.createAssociatedTokenAccountIdempotentInstruction(owner, dst, to, mint, prog), S.createTransferCheckedInstruction(src, mint, dst, owner, amt, decimals, [], prog));
  }
  const bal = await L.balance(owner.toBase58());
  const extra = bal - RESERVE - (c.fee_sig ? 0 : FEE) - 0.0025 * LAMPORTS;     // the reserve (and an unpaid fee) stay; ATA rent comes from the rest
  if (extra > 0.002 * LAMPORTS) ixs.push(SystemProgram.transfer({ fromPubkey: owner, toPubkey: to, lamports: Math.floor(extra) }));
  if (!ixs.length) return null;
  const sig = await sendIxs(k.wallet, ixs);
  await L.q(`UPDATE bud_coins SET out_sig=$2 WHERE id=$1`, [c.id, sig]);
  await say(c, 'launch', `first buy (${fmtTok(amt, decimals)} $${c.symbol})${extra > 0.002 * LAMPORTS ? ' and unused SOL' : ''} sent to the dev`, { sig, sol: extra > 0 ? extra / LAMPORTS : null, tokens: amt });
  return sig;
}
async function refund(c, why) {
  const k = await keys(c.id); const { SystemProgram, PublicKey } = w3();
  const bal = await L.balance(k.wallet.publicKey.toBase58());
  const amt = bal - 10000;
  if (amt <= 0) return null;
  try {
    const sig = await sendIxs(k.wallet, [SystemProgram.transfer({ fromPubkey: k.wallet.publicKey, toPubkey: new PublicKey(c.launcher), lamports: amt })]);
    await L.q(`UPDATE bud_coins SET refund_sig=$2, state=CASE WHEN state='live' THEN state ELSE 'refunded' END WHERE id=$1`, [c.id, sig]);
    await say(c, 'refund', why, { sig, sol: amt / LAMPORTS });
    return sig;
  } catch (e) { await L.log(c.id, 'error', 'refund failed, will retry: ' + String(e.message).slice(0, 160)); return null; }
}
// move a launch forward: called by the launch window while it waits, and by every engine tick
async function advance(c) {
  if (c.state === 'waiting') {
    const bal = await L.balance(c.wallet);
    if (bal >= Number(c.need) * 0.995) {
      const got = await L.q(`UPDATE bud_coins SET state='creating', ticked_at=now() WHERE id=$1 AND state='waiting' RETURNING *`, [c.id]);
      if (got.length) return create(got[0]);
    } else if (Date.now() - new Date(c.created_at) > 3 * 36e5) {
      await L.q(`UPDATE bud_coins SET state='expired' WHERE id=$1 AND state='waiting'`, [c.id]);
      if (bal > 10000) await refund({ ...c, state: 'expired' }, 'never fully funded, deposit returned');
    }
    return { ok: true, state: 'waiting', balance: bal };
  }
  if (c.state === 'creating' && Date.now() - new Date(c.ticked_at || c.created_at) > 4 * 6e4) {
    const [bc] = await L.accounts([L.bondingCurveOf(c.mint)]);
    if (bc) await L.q(`UPDATE bud_coins SET state='live', live_at=COALESCE(live_at, now()) WHERE id=$1`, [c.id]);
    else { await L.q(`UPDATE bud_coins SET state='failed', err='creation did not land' WHERE id=$1`, [c.id]); await refund(c, 'launch did not land, deposit returned'); }
  }
  if ((c.state === 'expired' || c.state === 'failed') && !c.refund_sig) { const bal = await L.balance(c.wallet); if (bal > 10000) await refund(c, 'deposit returned'); }
  return { ok: true, state: c.state };
}

// ---------- fees: claim, then split into the three jobs by the locked mix ----------
async function claim(c, k) {
  const w = await waiting(c.wallet);
  if (w < CLAIM_MIN) return 0;
  const before = await L.balance(c.wallet);
  const tx = await portal({ publicKey: c.wallet, action: 'collectCreatorFee', priorityFee: 0.00001, pool: 'pump' }, [k.wallet]);
  const sig = await sendAndConfirm(tx.serialize());
  const got = Math.max(0, (await L.balance(c.wallet)) - before);
  if (got <= 0) return 0;
  const b = Math.floor(got * c.mix_burn / 100), d = Math.floor(got * c.mix_drop / 100), v = got - b - d;
  await L.q(`UPDATE bud_coins SET claimed=claimed+$2, owed_burn=owed_burn+$3, owed_drop=owed_drop+$4, owed_dev=owed_dev+$5 WHERE id=$1`, [c.id, got, b, d, v]);
  c.owed_burn = Number(c.owed_burn) + b; c.owed_drop = Number(c.owed_drop) + d; c.owed_dev = Number(c.owed_dev) + v;
  await say(c, 'claim', `claimed ${sol4(got)} SOL of creator fees`, { sig, sol: got / LAMPORTS });
  return got;
}
async function chest(c) { return Math.max(0, (await L.balance(c.wallet)) - RESERVE); }

// ---------- holders: the largest token accounts, minus pools, the curve and the bud itself ----------
async function holders(c) {
  const r = await L.rpc('getTokenLargestAccounts', [c.mint, { commitment: 'confirmed' }]);
  const accts = (r.value || []).filter(a => Number(a.amount) > 0);
  const raw = await L.accounts(accts.map(a => a.address));
  const curve = L.bondingCurveOf(c.mint), out = [];
  raw.forEach((a, i) => {
    const owner = L.tokenOwner(a); if (!owner) return;
    if (owner === c.wallet || owner === curve || !L.onCurve(L.b58dec(owner))) return;   // program-owned accounts (curve, pools) are not holders
    out.push({ owner, account: accts[i].address, amount: BigInt(accts[i].amount) });
  });
  return out.slice(0, 20);
}

// ---------- the jobs ----------
async function buy(c, k, lamports) {
  const before = await tokenBal(c.wallet, c.mint).catch(() => 0n);
  const tx = await portal({ publicKey: c.wallet, action: 'buy', mint: c.mint, denominatedInSol: 'true', amount: +(lamports / LAMPORTS).toFixed(6), slippage: 15, priorityFee: PRIORITY, pool: 'auto' }, [k.wallet]);
  const sig = await sendAndConfirm(tx.serialize());
  const after = await tokenBal(c.wallet, c.mint);
  return { sig, tokens: after > before ? after - before : 0n };
}
async function jobBurn(c, k, lam) {
  const { PublicKey } = w3(); const S = sp();
  const b = await buy(c, k, lam);
  if (b.tokens <= 0n) return { sigs: [b.sig], spent: lam, text: `bought back with ${sol4(lam)} SOL (nothing arrived to burn)` };
  const { program, decimals } = await mintInfo(c.mint); const prog = new PublicKey(program), mint = new PublicKey(c.mint);
  const src = new PublicKey(L.ataOf(c.wallet, c.mint, program));
  const s2 = await sendIxs(k.wallet, [S.createBurnCheckedInstruction(src, mint, k.wallet.publicKey, b.tokens, decimals, [], prog)]);
  await L.q(`UPDATE bud_coins SET burned_sol=burned_sol+$2, burned_tokens=burned_tokens+$3 WHERE id=$1`, [c.id, lam, b.tokens.toString()]);
  return { sigs: [b.sig, s2], spent: lam, tokens: b.tokens, text: `bought back ${fmtTok(b.tokens, decimals)} $${c.symbol} with ${sol4(lam)} SOL and burned them` };
}
async function jobDrop(c, k, lam) {
  const { PublicKey, SystemProgram } = w3();
  const hs = await holders(c); if (!hs.length) return { sigs: [], spent: 0, skip: true, text: 'no holders to drop to yet' };
  const live = await L.accounts(hs.map(h => h.owner));
  const tot = hs.reduce((s, h) => s + h.amount, 0n);
  const pays = hs.map((h, i) => ({ to: h.owner, lam: Number(BigInt(lam) * h.amount / tot), ok: live[i] && live[i].lamports > 0 })).filter(p => p.ok && p.lam >= 50000);
  if (!pays.length) return { sigs: [], spent: 0, skip: true, text: 'the share per holder is still too small' };
  const sigs = [];
  for (let i = 0; i < pays.length; i += 12) sigs.push(await sendIxs(k.wallet, pays.slice(i, i + 12).map(p => SystemProgram.transfer({ fromPubkey: k.wallet.publicKey, toPubkey: new PublicKey(p.to), lamports: p.lam }))));
  const spent = pays.reduce((s, p) => s + p.lam, 0);
  await L.q(`UPDATE bud_coins SET dropped=dropped+$2, drops=drops+$3 WHERE id=$1`, [c.id, spent, pays.length]);
  return { sigs, spent, n: pays.length, text: `dropped ${sol4(spent)} SOL to the top ${pays.length} holders` };
}
async function jobDev(c, k, lam) {
  const { PublicKey, SystemProgram } = w3();
  const sig = await sendIxs(k.wallet, [SystemProgram.transfer({ fromPubkey: k.wallet.publicKey, toPubkey: new PublicKey(c.launcher), lamports: lam })]);
  await L.q(`UPDATE bud_coins SET dev_paid=dev_paid+$2 WHERE id=$1`, [c.id, lam]);
  return { sigs: [sig], spent: lam, text: `paid the dev ${sol4(lam)} SOL` };
}
const JOBS = { burn: jobBurn, drop: jobDrop, dev: jobDev };
async function work(c, k, deadline) {
  for (const job of ['burn', 'drop', 'dev']) {
    if (Date.now() > deadline) break;
    const owed = Number(c['owed_' + job]); if (owed < JOB_MIN[job]) continue;
    const lam = Math.min(owed, await chest(c)); if (lam < JOB_MIN[job]) continue;
    try {
      const out = await JOBS[job](c, k, lam);
      if (out.skip) { await L.q(`UPDATE bud_coins SET worked_at=now() WHERE id=$1`, [c.id]); continue; }
      await L.q(`UPDATE bud_coins SET owed_${job}=GREATEST(0, owed_${job}-$2), jobs=jobs+1, worked_at=now() WHERE id=$1`, [c.id, out.spent]);
      c['owed_' + job] = Math.max(0, owed - out.spent);
      for (const s of out.sigs.slice(0, -1)) await L.log(c.id, 'tx', `${job} step`, { sig: s });
      await say(c, job, out.text, { sig: out.sigs[out.sigs.length - 1], sol: out.spent / LAMPORTS, tokens: out.tokens != null ? out.tokens : (out.n != null ? out.n : null) });
    } catch (e) { await L.log(c.id, 'error', `${job} failed, the bud will try again: ` + String(e.message).slice(0, 150), { sig: e.sig }); }
  }
}

// ---------- the market: progress on the curve, or the pool once it graduates ----------
async function market(c) {
  const [bc] = await L.accounts([L.bondingCurveOf(c.mint)]);
  if (bc && bc.data && bc.data.length >= 49) {
    const vTok = bc.data.readBigUInt64LE(8), vSol = bc.data.readBigUInt64LE(16), rTok = bc.data.readBigUInt64LE(24), complete = bc.data[48] === 1;
    const mcapSol = vTok > 0n ? Number(vSol) / 1e9 / (Number(vTok) / 1e6) * 1e9 : null;
    const progress = Math.max(0, Math.min(1, Number(793100000000000n - rTok) / 793100000000000));
    return { mcapSol, progress: complete ? 1 : progress, complete };
  }
  return { mcapSol: null, progress: null, complete: false };
}

// ---------- one tick for one live bud ----------
async function tickCoin(c, deadline) {
  const k = await keys(c.id);
  if (k.wallet.publicKey.toBase58() !== c.wallet) throw new Error('key mismatch');
  if (!c.fee_sig) await payFee(c, k).catch(() => null);
  try { await claim(c, k); } catch (e) { await L.log(c.id, 'error', 'claim failed: ' + String(e.message).slice(0, 160)); }
  await work(c, k, deadline);
  const m = await market(c).catch(() => null);
  if (m) await L.q(`UPDATE bud_coins SET mcap_usd=$2, complete=$3 WHERE id=$1`, [c.id, m.mcapSol, !!m.complete]);
  await L.q(`UPDATE bud_coins SET ticked_at=now() WHERE id=$1`, [c.id]);
}

// ---------- the tick: launches waiting for deposits, then live buds, oldest-ticked first ----------
async function tick(budgetMs = 40000) {
  await L.ready();
  const lock = await L.q(`INSERT INTO bud_meta (k, v) VALUES ('tick', $1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v WHERE bud_meta.v::bigint < $2 RETURNING v`, [String(Date.now()), Date.now() - (L.MOCK ? 1500 : 50000)]);
  if (!lock.length) return { ok: true, skipped: 'a tick ran under a minute ago' };
  const deadline = Date.now() + budgetMs; const done = { launches: 0, buds: 0, errors: 0 };
  const pend = await L.q(`SELECT * FROM bud_coins WHERE state IN ('waiting','creating') OR (state IN ('expired','failed') AND refund_sig IS NULL) ORDER BY created_at LIMIT 20`);
  for (const c of pend) { if (Date.now() > deadline) break; try { await advance(c); done.launches++; } catch { done.errors++; } }
  const live = await L.q(`SELECT * FROM bud_coins WHERE state='live' ORDER BY ticked_at NULLS FIRST LIMIT 30`);
  for (const c of live) { if (Date.now() > deadline - Math.min(8000, budgetMs / 4)) break; try { await tickCoin(c, deadline); done.buds++; } catch (e) { done.errors++; await L.log(c.id, 'error', 'tick: ' + String(e.message).slice(0, 160)); } }
  await L.q(`INSERT INTO bud_meta (k, v) VALUES ('tick_done', $1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`, [String(Date.now())]);
  return { ok: true, ...done, at: new Date().toISOString() };
}

module.exports = { keys, newId, need, advance, tick, blockhash, sendRaw, confirm, portal, waiting, chest, holders, market, level, LEVELS,
  FEE, RESERVE, CREATE_COST, MIN_DEV, MAX_DEV, DEV_CAP, LAMPORTS, JOB_MIN };
