# bud

every coin gets a bud. it does the bagwork while you sleep.

launch a pump.fun coin and it comes with a bud: a wallet made for that coin and set as its creator. every minute the engine claims the coin's creator fees into the bud and runs the launcher's locked mix: buy back + burn, SOL drops to the top 20 holders, dev pay. every job is a public transaction.

- `index.html`, `assets/` — the greenhouse intro (three.js) and bud OS (the desktop, terminal, buddy list, chats, launch wizard, ledger, greenhouse, bagwork.exe, paint).
- `api/bud.js` — the one function: config, prepare, paybuild, relay, status, buds, bud, feed, tick, meta/img, selftest.
- `api/_engine.js` — the custodial engine (keys derived from one master secret, PumpPortal for create / claim / buy, spl-token for burns).
- `dev/` — a pretend chain + PGlite server for local work (`node dev/srv.cjs`).

needs `DATABASE_URL` (Postgres). optional: `RPC_URL` (or `RPC_URLS`), `BUD_FEE_WALLET`, `PINATA_JWT`, `PRIORITY_FEE`.
