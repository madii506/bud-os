// The greenhouse: an abandoned grow house at night. Rain on dirty glass, two long benches of seed trays under
// magenta grow lights, old CRTs wired into the soil, buds in pots that turn their heads, and the night-shift PC at the end.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

let seed = 7; export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BEIGE = 0xd2c6a6, BEIGE2 = 0xc2b590;
export const G1 = new THREE.Color(.32, 1.0, .46), G2 = new THREE.Color(.18, .95, .66);

export function tex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const noise = (g, w, h, n, a, light = .5) => { for (let i = 0; i < n; i++) { g.fillStyle = rnd() < light ? `rgba(255,255,255,${rnd() * a})` : `rgba(0,0,0,${rnd() * a * 1.5})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); } };

// ---------------------------------------------------------------- pieces
// a sprout: a thin stem and two leaves in a V, one small geometry used thousands of times
function sproutGeo() {
  const P = [], s = .5;
  const quad = (a, b, c, d) => P.push(...a, ...b, ...c, ...a, ...c, ...d);
  const st = .004, h = .05 * s * 2;
  quad([-st, 0, 0], [st, 0, 0], [st, h, 0], [-st, h, 0]); quad([0, 0, -st], [0, 0, st], [0, h, st], [0, h, -st]);
  for (const sx of [-1, 1]) {            // a leaf: a diamond from the stem top, tilted up and out
    const L = .034, W = .014, ang = sx * .62;
    const tip = [Math.sin(ang) * L, h + Math.cos(ang) * L * .55, 0], mid = [Math.sin(ang) * L * .5, h + Math.cos(ang) * L * .3, 0];
    quad([0, h, 0], [mid[0], mid[1] + W * .4, -W], tip, [mid[0], mid[1] - W * .2, W]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}
// the haze under a grow bar: four soft sides of a wedge, bright at the bar, gone by the bench
function hazeGeo(tw, tl, bw, bl, h) {
  const P = [], U = [];
  const c = [[-tw / 2, 0, -tl / 2], [tw / 2, 0, -tl / 2], [tw / 2, 0, tl / 2], [-tw / 2, 0, tl / 2]], d = [[-bw / 2, -h, -bl / 2], [bw / 2, -h, -bl / 2], [bw / 2, -h, bl / 2], [-bw / 2, -h, bl / 2]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; P.push(...c[i], ...d[i], ...d[j], ...c[i], ...d[j], ...c[j]); U.push(0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); return g;
}
// a leaf shape for the bigger buds
function leafGeo(len, wid) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(wid, len * .45, 0, len); s.quadraticCurveTo(-wid, len * .45, 0, 0);
  const g = new THREE.ShapeGeometry(s, 10); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, -Math.pow(y / len, 2) * len * .35 + Math.abs(x) * .4); }
  g.computeVertexNormals(); return g;
}
// a bud: a dark round body, two leaves, glowing slanted eyes and a thin grin. The head turns to whatever it watches.
export function makeBud(parent, scale = 1, opt = {}) {
  const root = new THREE.Group(); parent.add(root); root.scale.setScalar(scale);
  const head = new THREE.Group(); head.position.y = .12; root.add(head);
  const skin = new THREE.MeshStandardMaterial({ color: opt.color || 0x0e1a13, roughness: .62, metalness: 0 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(.12, 28, 20), skin); body.scale.set(1, .98, .94); body.castShadow = true; head.add(body);
  const leafM = new THREE.MeshStandardMaterial({ color: opt.leaf || 0x2f7a43, roughness: .55, side: THREE.DoubleSide });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.006, .009, .05, 8), leafM); stem.position.y = .125; head.add(stem);
  const lg = leafGeo(.11, .05);
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(lg, leafM); l.position.set(0, .145, 0); l.rotation.z = -sx * .95; l.rotation.y = sx * .2; l.castShadow = true; head.add(l); }
  const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.8, 2.4), toneMapped: false, side: THREE.DoubleSide });
  const eyeShape = new THREE.Shape(); eyeShape.moveTo(-.016, .012); eyeShape.lineTo(.016, -.002); eyeShape.lineTo(.016, -.022); eyeShape.lineTo(-.016, -.022); eyeShape.lineTo(-.016, .012);
  const eg = new THREE.ShapeGeometry(eyeShape);
  const eyes = [];
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(eg, eyeM); e.position.set(sx * .042, .018, .113); e.scale.x = -sx; e.rotation.y = sx * .32; head.add(e); eyes.push(e); }
  const grinM = new THREE.MeshBasicMaterial({ color: new THREE.Color(.5, 1.3, .75), toneMapped: false });
  const grin = new THREE.Mesh(new THREE.TorusGeometry(.04, .0042, 6, 20, Math.PI * .8), grinM); grin.rotation.z = Math.PI + Math.PI * .1; grin.position.set(0, -.008, .112); grin.scale.set(1, .55, 1); head.add(grin);
  for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 10), skin); a.position.set(sx * .118, .09, .01); a.scale.set(.8, 1.1, .8); root.add(a); }
  root.userData = { head, eyes, eyeM, grinM, look: new THREE.Vector3(0, 0, 1), yaw: 0, pitch: 0, lag: .03 + rnd() * .05, blinkT: rnd() * 5 };
  return root;
}
// the HALO-era CRT: bezel, tapered back, a curved screen with whatever canvas texture it is given
export function crt(parent, map, mats, sc = 1) {
  const mon = new THREE.Group(); mon.scale.setScalar(sc); parent.add(mon);
  const [pl, pl2] = mats;
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; mon.add(o); return o; };
  add(new RoundedBoxGeometry(.8, .64, .1, 5, .03), pl, 0, .32, .06);
  const back = new THREE.BoxGeometry(.74, .58, .5); const p = back.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getZ(i) < 0) { p.setX(i, p.getX(i) * .68); p.setY(i, p.getY(i) * .72 + .01); }
  back.computeVertexNormals(); add(back, pl2, 0, .32, -.2);
  add(new THREE.BoxGeometry(.64, .49, .02), new THREE.MeshStandardMaterial({ color: 0x141513, roughness: .4 }), 0, .335, .105);
  const sg = new THREE.PlaneGeometry(.6, .45, 20, 14); const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) { const u = sp.getX(i) / .3, v = sp.getY(i) / .225; sp.setZ(i, .016 * (1 - .5 * (u * u + v * v))); }
  sg.computeVertexNormals();
  const scr = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map, toneMapped: false })); scr.position.set(0, .335, .118); mon.add(scr);
  const led = new THREE.MeshBasicMaterial({ color: 0x3dff8a, toneMapped: false }); add(new THREE.BoxGeometry(.012, .012, .01), led, .3, .045, .116);
  mon.userData = { screen: scr, led };
  return mon;
}

// ---------------------------------------------------------------- the house
export function build(scene, mobile) {
  const std = o => new THREE.MeshStandardMaterial(o);
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = !mobile) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = shadow; parent.add(m); return m; };
  const P = { lights: [], bars: [], cones: [], buds: [], crts: [], mist: [] };
  const W = 3.5, Z0 = -7, Z1 = 9, EAVE = 2.7, RIDGE = 4.15;

  // floor: wet concrete, a few puddles that catch the light
  const conc = tex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#3a3b3d'; g.fillRect(0, 0, w, h); noise(g, w, h, 60000, .09);
    for (let i = 0; i < 26; i++) { const x = rnd() * w, y = rnd() * h, r = 40 + rnd() * 160, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(10,12,10,${.15 + rnd() * .25})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 256); g.lineTo(w, i * 256); g.moveTo(i * 256, 0); g.lineTo(i * 256, h); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2; for (let i = 0; i < 14; i++) { let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 18; k++) { x += (rnd() - .5) * 40; y += (rnd() - .5) * 40; g.lineTo(x, y); } g.stroke(); }
  }, [8, 8]);
  const wet = tex(512, 512, (g, w, h) => { g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { const x = rnd() * w, y = rnd() * h, r = 30 + rnd() * 110, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(25,25,25,.95)'); gr.addColorStop(.7, 'rgba(25,25,25,.6)'); gr.addColorStop(1, 'rgba(25,25,25,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 1.6, r, rnd() * 3, 0, 7); g.fill(); } }, [5, 5], false);
  const floor = mesh(new THREE.PlaneGeometry(40, 40), std({ map: conc, roughnessMap: wet, roughness: .9, metalness: .15, color: 0x8a8a8a }), 0, 0, 0); floor.rotation.x = -Math.PI / 2;


  // outside: night sky, a moon behind cloud, tree silhouettes all around
  const sky = tex(1024, 512, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#04050c'); s.addColorStop(.55, '#0c1024'); s.addColorStop(.8, '#1b1532'); s.addColorStop(1, '#241a35'); g.fillStyle = s; g.fillRect(0, 0, w, h);
    const m = g.createRadialGradient(w * .7, h * .28, 0, w * .7, h * .28, 120); m.addColorStop(0, 'rgba(200,215,255,.55)'); m.addColorStop(.12, 'rgba(160,180,240,.25)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const x = rnd() * w, y = rnd() * h * .7, r = 40 + rnd() * 140, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(30,32,55,${.3 + rnd() * .3})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(34, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, toneMapped: false, color: 0x9a9a9a })); scene.add(dome); P.sky = dome;
  const treeT = tex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#020204'; g.fillStyle = '#020204'; g.lineCap = 'round';
    const br = (x, y, a, len, wd) => { if (len < 6) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); const n = 2 + (rnd() * 2 | 0); for (let i = 0; i < n; i++) br(x2, y2, a + (rnd() - .5) * 1.3, len * (.62 + rnd() * .15), wd * .68); };
    br(w / 2, h, -Math.PI / 2, 140, 22);
  });
  for (let i = 0; i < (mobile ? 10 : 22); i++) {
    const a = rnd() * Math.PI * 2, r = 11 + rnd() * 10, s = 6 + rnd() * 7;
    const t = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: treeT, transparent: true, alphaTest: .3, fog: false, depthWrite: false }));
    t.position.set(Math.cos(a) * r, s / 2 - .2, Math.sin(a) * r + 1); t.lookAt(0, s / 2, 1); scene.add(t);
  }

  // the frame: posts, rafters, ridge, purlins; a low concrete knee wall
  const steel = std({ color: 0x3b3f3d, roughness: .55, metalness: .6 }), rust = std({ color: 0x4a3426, roughness: .8, metalness: .3 });
  const knee = std({ color: 0x5b5a56, roughness: .9 });
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(.18, .6, Z1 - Z0), knee, sx * W, .3, (Z0 + Z1) / 2);
  const posts = []; for (let z = Z0; z <= Z1 + .01; z += 1.6) posts.push(z);
  const slope = Math.atan2(RIDGE - EAVE, W), raft = Math.hypot(W, RIDGE - EAVE);
  posts.forEach((z, i) => {
    const m = i % 3 === 1 ? rust : steel;
    for (const sx of [-1, 1]) {
      mesh(new THREE.BoxGeometry(.07, EAVE - .6, .07), m, sx * W, .6 + (EAVE - .6) / 2, z);
      const r = mesh(new THREE.BoxGeometry(raft, .07, .06), m, sx * W / 2, (EAVE + RIDGE) / 2, z); r.rotation.z = -sx * slope;
    }
  });
  mesh(new THREE.BoxGeometry(.08, .08, Z1 - Z0), steel, 0, RIDGE, (Z0 + Z1) / 2);
  for (const sx of [-1, 1]) {
    mesh(new THREE.BoxGeometry(.07, .07, Z1 - Z0), steel, sx * W, EAVE, (Z0 + Z1) / 2);
    mesh(new THREE.BoxGeometry(.04, .04, Z1 - Z0), steel, sx * W, 1.65, (Z0 + Z1) / 2);
    const pu = mesh(new THREE.BoxGeometry(.05, .05, Z1 - Z0), steel, sx * W / 2, (EAVE + RIDGE) / 2, (Z0 + Z1) / 2);
  }
  // glass: grimy, streaked, a few panes broken out; rain runs down the roof
  const grime = tex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, 'rgba(120,140,130,.10)'); s.addColorStop(.7, 'rgba(90,110,80,.22)'); s.addColorStop(1, 'rgba(60,80,40,.5)'); g.fillStyle = s; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${150 + rnd() * 60 | 0},${160 + rnd() * 60 | 0},${140 + rnd() * 50 | 0},${rnd() * .08})`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 2 + rnd() * 5); }
    for (let i = 0; i < 70; i++) { const x = rnd() * w; g.strokeStyle = `rgba(160,180,170,${.03 + rnd() * .06})`; g.lineWidth = 1 + rnd() * 3; g.beginPath(); g.moveTo(x, rnd() * h * .5); g.lineTo(x + (rnd() - .5) * 8, h); g.stroke(); }
  }, [1, 1]);
  const streaks = (n, a0, a1) => tex(512, 1024, (g, w, h) => { g.clearRect(0, 0, w, h); for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h, L = 14 + rnd() * 70; g.strokeStyle = `rgba(190,205,235,${a0 + rnd() * a1})`; g.lineWidth = 1 + rnd() * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - L * .05, y + L); g.stroke(); } for (let i = 0; i < n * .8; i++) { g.fillStyle = `rgba(210,220,245,${.08 + rnd() * .22})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, 1 + rnd() * 3.5, 0, 7); g.fill(); } }, [6, 2]);
  const rainT = streaks(240, .06, .18); rainT.center.set(.5, .5); rainT.rotation = Math.PI / 2;
  const glassM = new THREE.MeshStandardMaterial({ color: 0x8fa6b4, map: grime, transparent: true, opacity: .55, roughness: .15, metalness: .2, side: THREE.DoubleSide, depthWrite: false });
  const rainM = new THREE.MeshBasicMaterial({ map: rainT, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide });
  const pane = (w, h, x, y, z, rx, ry, rz, rain) => { const g = new THREE.PlaneGeometry(w, h); const a = new THREE.Mesh(g, glassM); a.position.set(x, y, z); a.rotation.set(rx, ry, rz); a.renderOrder = 2; scene.add(a); if (rain) { const b = new THREE.Mesh(g, rainM); b.position.copy(a.position); b.rotation.copy(a.rotation); b.renderOrder = 3; scene.add(b); } return a; };
  for (const sx of [-1, 1]) {
    for (let z = Z0; z < Z1 - .01; z += 1.6) if (!(sx > 0 && Math.abs(z - 1.0) < .1)) pane(1.6, EAVE - .6, sx * W, .6 + (EAVE - .6) / 2, z + .8, 0, Math.PI / 2, 0, false);
    const rg = new THREE.Group(); rg.position.set(sx * W / 2, (EAVE + RIDGE) / 2, (Z0 + Z1) / 2); rg.rotation.z = -sx * slope; scene.add(rg);
    const pg = new THREE.PlaneGeometry(raft, Z1 - Z0);
    const ga = new THREE.Mesh(pg, glassM); ga.rotation.x = -Math.PI / 2; ga.renderOrder = 2; rg.add(ga);
    const gb = new THREE.Mesh(pg, rainM); gb.rotation.x = -Math.PI / 2; gb.position.y = .01; gb.renderOrder = 3; rg.add(gb);
  }
  // the gable ends: glass above, a door in the front, the back wall behind the desk
  for (const [z, door] of [[Z1, true], [Z0, false]]) {
    const tri = new THREE.Shape(); tri.moveTo(-W, EAVE); tri.lineTo(W, EAVE); tri.lineTo(0, RIDGE); tri.lineTo(-W, EAVE);
    const tg = new THREE.ShapeGeometry(tri); const t = new THREE.Mesh(tg, glassM); t.position.z = z; scene.add(t);
    for (let x = -W; x < W - .01; x += 1.4) { const ww = Math.min(1.4, W - x); if (door && x + ww / 2 > -.8 && x + ww / 2 < .8) continue; pane(ww, EAVE - .6, x + ww / 2, .6 + (EAVE - .6) / 2, z, 0, 0, 0, false); }
    if (door) { for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(.08, 2.3, .08), steel, sx * .72, 1.15, z); mesh(new THREE.BoxGeometry(1.52, .08, .08), steel, 0, 2.3, z);
      const d = new THREE.Group(); d.position.set(.72, 0, z); scene.add(d); P.door = d;     // the door hangs open, creaking
      const dm = mesh(new THREE.BoxGeometry(.04, 2.2, .04), steel, -.02, 1.12, 0, d); mesh(new THREE.BoxGeometry(.04, 2.2, .04), steel, -.7, 1.12, 0, d); mesh(new THREE.BoxGeometry(.7, .04, .04), steel, -.36, 2.2, 0, d); mesh(new THREE.BoxGeometry(.7, .04, .04), steel, -.36, .9, 0, d);
      const dp = new THREE.Mesh(new THREE.PlaneGeometry(.66, 2.1), glassM); dp.position.set(-.36, 1.12, 0); d.add(dp); d.rotation.y = 1.75; }
    for (let x = -W; x <= W + .01; x += 1.4) mesh(new THREE.BoxGeometry(.06, EAVE, .06), steel, x, EAVE / 2, z);
  }

  // benches: two long rows of steel tables, seed trays end to end, thousands of sprouts
  const benchM = std({ color: 0x2c302e, roughness: .6, metalness: .55 }), topM = std({ color: 0x232625, roughness: .7, metalness: .4 });
  const trayG = new THREE.BoxGeometry(.54, .055, .27), soilG = new THREE.PlaneGeometry(.5, .24);
  const soilT = tex(256, 128, (g, w, h) => { g.fillStyle = '#2a1d14'; g.fillRect(0, 0, w, h); noise(g, w, h, 4000, .25, .4); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * w / 6, 0); g.lineTo(i * w / 6, h); g.stroke(); } for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(0, i * h / 3); g.lineTo(w, i * h / 3); g.stroke(); } });
  const trayM = std({ color: 0x0c0d0d, roughness: .45 }), soilM = std({ map: soilT, roughness: .95 });
  const segs = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) segs.push({ x: sx * 1.75, z: 6.3 - i * 2.95, len: 2.75, side: sx });
  const nTray = segs.length * 20;
  const trays = new THREE.InstancedMesh(trayG, trayM, nTray), soils = new THREE.InstancedMesh(soilG, soilM, nTray);
  trays.castShadow = trays.receiveShadow = !mobile; soils.receiveShadow = !mobile;
  const spG = sproutGeo(), spM = std({ color: 0xffffff, roughness: .6, side: THREE.DoubleSide });
  const per = mobile ? 9 : 18, sprouts = new THREE.InstancedMesh(spG, spM, nTray * per); sprouts.castShadow = !mobile;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3(), col = new THREE.Color();
  let ti = 0, si = 0; const TOP = .86;
  segs.forEach(sg => {
    const L = sg.len;
    for (const lx of [-.78, .78]) for (const lz of [-L / 2 + .05, 0, L / 2 - .05]) mesh(new THREE.BoxGeometry(.05, TOP, .05), benchM, sg.x + lx * .95, TOP / 2, sg.z + lz);
    mesh(new THREE.BoxGeometry(1.62, .04, L), topM, sg.x, TOP - .02, sg.z);
    mesh(new THREE.BoxGeometry(1.66, .07, .04), benchM, sg.x, TOP - .02, sg.z - L / 2); mesh(new THREE.BoxGeometry(1.66, .07, .04), benchM, sg.x, TOP - .02, sg.z + L / 2);
    mesh(new THREE.BoxGeometry(1.62, .03, L), benchM, sg.x, .25, sg.z);
    for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++) {
      if (ti >= nTray) break;
      const x = sg.x - .6 + a * .3 + (rnd() - .5) * .02, z = sg.z - L / 2 + .4 + b * .64 + (rnd() - .5) * .02, y = TOP + .028, ry = (rnd() - .5) * .06 + Math.PI / 2;
      Q.setFromEuler(new THREE.Euler(0, ry, 0)); M.compose(T.set(x, y, z), Q, S.set(1, 1, 1)); trays.setMatrixAt(ti, M);
      Q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, ry)); M.compose(T.set(x, y + .029, z), Q, S.set(1, 1, 1)); soils.setMatrixAt(ti, M); ti++;
      const dead = rnd() < .12;
      for (let k = 0; k < per; k++) {
        if (rnd() < .2) continue;
        const cx = (k % 6) / 5 - .5, cz = (Math.floor(k / 6) % 3) / 2 - .5;
        const px = x + cz * .16 + (rnd() - .5) * .02, pz = z + cx * .42 + (rnd() - .5) * .02, s = (.6 + rnd() * .9) * (dead ? .7 : 1);
        Q.setFromEuler(new THREE.Euler((rnd() - .5) * .3, rnd() * 6.3, (rnd() - .5) * .3 + (dead ? .9 : 0))); M.compose(T.set(px, y + .03, pz), Q, S.set(s, s, s)); sprouts.setMatrixAt(si, M);
        sprouts.setColorAt(si, dead ? col.setHSL(.09, .35, .16) : col.setHSL(.27 + rnd() * .06, .55, .22 + rnd() * .14)); si++;
      }
    }
  });
  trays.count = ti; soils.count = ti; sprouts.count = si; scene.add(trays, soils, sprouts);

  // grow lights: a bar over every bench section on chains, a haze cone under each, a magenta spot doing the real lighting
  const coneT = tex(128, 256, (g, w, h) => { const d = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = y / h, a = Math.pow(1 - v, 2.2) * Math.pow(Math.sin(Math.PI * x / (w - 1)), 1.4); d.data.set([255, 255, 255, Math.round(a * 200)], (y * w + x) * 4); } g.putImageData(d, 0, 0); }, null, false);
  const housing = std({ color: 0x1a1b1c, roughness: .5, metalness: .7 });
  segs.forEach((sg, i) => {
    const c = (i % 3 === 2 ? G2 : G1).clone();
    const g = new THREE.Group(); g.position.set(sg.x, 2.02, sg.z); scene.add(g);
    mesh(new THREE.BoxGeometry(.22, .05, sg.len * .92), housing, 0, .03, 0, g);
    const barM = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(.05), toneMapped: false });
    for (const ox of [-.06, .06]) mesh(new THREE.BoxGeometry(.035, .012, sg.len * .9), barM, ox, 0, 0, g, false);
    for (const oz of [-sg.len * .4, sg.len * .4]) mesh(new THREE.CylinderGeometry(.006, .006, .66, 5), steel, 0, .36, oz, g, false);
    const coneG = hazeGeo(.12, sg.len * .9, 1.7, sg.len * 1.05, 1.12);
    const cone = new THREE.Mesh(coneG, new THREE.MeshBasicMaterial({ color: c, map: coneT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    g.add(cone);
    const spot = (mobile && i % 2) ? null : new THREE.SpotLight(c, 0, 0, 1.15, .75, 2);
    if (spot) { spot.position.set(sg.x, 1.98, sg.z); spot.target.position.set(sg.x, 0, sg.z);
    if (i === 1 || i === 5) { spot.castShadow = !mobile; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.002; spot.shadow.radius = 3; }
    scene.add(spot, spot.target); }
    P.bars.push({ g, barM, cone, spot, c, z: sg.z, x: sg.x, on: 0, want: 0, flick: i === 3 ? 1 : 0 });
  });

  // CRTs on the benches, cables running down into the soil; their buds watch the aisle
  const mats = [[std({ color: BEIGE, roughness: .55 }), std({ color: BEIGE2, roughness: .6 })], [std({ color: 0xb9b6ad, roughness: .55 }), std({ color: 0xa3a097, roughness: .6 })]];
  const cable = std({ color: 0x0b0b0b, roughness: .6 });
  [[-1, 4.6, .55], [1, 2.2, -.5], [-1, -.9, .4], [1, -3.4, -.45]].forEach(([sx, z, ry], i) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 384; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = crt(scene, t, mats[i % 2], .62); m.position.set(sx * 1.25, TOP + .06, z); m.rotation.y = -sx * Math.PI / 2 + ry * sx * .5 + (sx > 0 ? 0 : 0);
    m.rotation.y = sx > 0 ? -Math.PI / 2 + .45 : Math.PI / 2 - .45;
    const pts = [V(sx * 1.45, TOP + .2, z), V(sx * 1.7, TOP + .12, z + .3), V(sx * 1.9, TOP + .06, z + .7), V(sx * 2.1, TOP + .03, z + .9)];
    const tb = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, .008, 5), cable); scene.add(tb);
    const glow = new THREE.PointLight(0x5cf08a, 0, 2.4, 2); glow.position.set(sx * 1.05, TOP + .25, z); scene.add(glow);
    P.crts.push({ m, c, g: c.getContext('2d'), t, glow, on: 0, seed: i, eye: 0 });
  });

  // buds in pots along the benches and on the floor; they turn to watch
  const potM = std({ color: 0x8a4630, roughness: .85 }), potS = std({ color: 0x24170f, roughness: 1 });
  const potAt = (x, y, z, s) => { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    mesh(new THREE.CylinderGeometry(.11 * s, .08 * s, .14 * s, 20), potM, 0, .07 * s, 0, g); mesh(new THREE.CylinderGeometry(.115 * s, .115 * s, .02 * s, 20), potM, 0, .14 * s, 0, g);
    const so = mesh(new THREE.CircleGeometry(.1 * s, 20), potS, 0, .135 * s, 0, g); so.rotation.x = -Math.PI / 2;
    const b = makeBud(g, s, {}); b.position.y = .1 * s; P.buds.push(b); return g; };
  [[-1.1, TOP, 5.4, 1], [1.1, TOP, 3.9, .9], [-1.1, TOP, 1.6, 1.05], [1.1, TOP, .2, 1], [-1.1, TOP, -2.2, .95], [1.1, TOP, -3.6, 1.1], [-2.6, 0, -4.9, 1.6], [2.5, 0, -5.0, 1.4], [-.82, 0, 7.7, 1.25]]
    .forEach(([x, y, z, s]) => potAt(x, y, z, s));

  // tiny buds sitting in the trays among the sprouts: lots of them, three instanced draws in total. a third already watch the door;
  // the rest face the back wall until you come close, then turn, one after another.
  const tinyBody = new THREE.SphereGeometry(.12, 16, 12), tinyLeaf = leafGeo(.11, .05);
  const tinySkin = std({ color: 0x172b1d, roughness: .5 }), tinyLeafM = std({ color: 0x3b8f52, roughness: .5, side: THREE.DoubleSide });
  P.tinyEyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.05, 1.75), toneMapped: false, side: THREE.DoubleSide });
  const tEye = new THREE.Shape(); tEye.moveTo(-.016, .012); tEye.lineTo(.016, -.002); tEye.lineTo(.016, -.022); tEye.lineTo(-.016, -.022); tEye.lineTo(-.016, .012);
  const tEyeG = new THREE.ShapeGeometry(tEye);
  const TN = mobile ? 30 : 84;
  const tB = new THREE.InstancedMesh(tinyBody, tinySkin, TN), tL = new THREE.InstancedMesh(tinyLeaf, tinyLeafM, TN * 2), tE = new THREE.InstancedMesh(tEyeG, P.tinyEyeM, TN * 2);
  tB.castShadow = !mobile; [tB, tL, tE].forEach(m => { m.frustumCulled = false; scene.add(m); });
  const keepOut = [[-1.1, 5.4, .3], [1.1, 3.9, .3], [-1.1, 1.6, .3], [1.1, .2, .3], [-1.1, -2.2, .3], [1.1, -3.6, .3], [-1.25, 4.6, .48], [1.25, 2.2, .48], [-1.25, -.9, .48], [1.25, -3.4, .48]];
  const LB = new THREE.Matrix4().compose(V(0, .12, 0), new THREE.Quaternion(), V(1, .96, .94));
  const tEyes = [-1, 1].map(sx => ({ p: V(sx * .042, .138, .113), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sx * .32, 0)), sx }));
  P.tiny = [];
  for (let i = 0; i < TN; i++) {
    const sg = segs[i % segs.length], sc = .42 + rnd() * .38;
    let x = 0, z = 0;
    for (let k = 0; k < 14; k++) {
      x = sg.x + (rnd() - .5) * 1.25; z = sg.z + (rnd() - .5) * 2.45;
      if (keepOut.every(([kx, kz, r]) => Math.hypot(x - kx, z - kz) > r) && P.tiny.every(o => Math.hypot(x - o.position.x, z - o.position.z) > .16)) break;
    }
    const o = new THREE.Object3D(); o.position.set(x, TOP + .05, z); o.scale.setScalar(sc);
    const watching = rnd() < .32;
    o.rotation.y = watching ? (rnd() - .5) * .9 : Math.PI + (rnd() - .5) * .8;
    const leaves = [-1, 1].map(sx => new THREE.Matrix4().compose(V(0, .23, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sx * .2, -sx * (.8 + rnd() * .3))), V(1, 1, 1)));
    o.userData = { leaves, lag: .015 + rnd() * .05, nb: rnd() * 6000, wake: 3.5 + rnd() * 4.5, blink: 1, bob: rnd() * 6 };
    P.tiny.push(o);
  }
  const tm = new THREE.Matrix4(), em = new THREE.Matrix4(), es = new THREE.Vector3();
  P.tinyUpdate = (t = 0) => {
    P.tiny.forEach((o, i) => {
      const u = o.userData; o.scale.y = o.scale.x * (1 + Math.sin(t * 1.6 + u.bob) * .025); o.updateMatrix();
      tB.setMatrixAt(i, tm.multiplyMatrices(o.matrix, LB));
      u.leaves.forEach((L, k) => tL.setMatrixAt(i * 2 + k, tm.multiplyMatrices(o.matrix, L)));
      tEyes.forEach((e, k) => { em.compose(e.p, e.q, es.set(-e.sx, Math.max(.001, u.blink), 1)); tE.setMatrixAt(i * 2 + k, tm.multiplyMatrices(o.matrix, em)); });
    });
    tB.instanceMatrix.needsUpdate = tL.instanceMatrix.needsUpdate = tE.instanceMatrix.needsUpdate = true;
  };
  P.tinyUpdate();

  // the end of the room: a lab desk, the night-shift PC, a green banker's lamp, a specimen jar, a whiteboard
  const deskZ = -5.75, DH = .78;
  const deskTop = mesh(new THREE.BoxGeometry(2.2, .05, .9), std({ color: 0x2a2621, roughness: .5, metalness: .2 }), 0, DH - .025, deskZ + .1);
  for (const lx of [-1.02, 1.02]) for (const lz of [-.36, .36]) mesh(new THREE.BoxGeometry(.05, DH - .05, .05), benchM, lx, (DH - .05) / 2, deskZ + .1 + lz);
  const pc = new THREE.Group(); pc.position.set(0, DH, deskZ); scene.add(pc); P.pc = pc;
  const plastic = mats[0][0], plastic2 = mats[0][1], dark = std({ color: 0x2a2a26, roughness: .7 }), black = std({ color: 0x0b0b0c, roughness: .5 });
  mesh(new RoundedBoxGeometry(.98, .2, .78, 4, .02), plastic, 0, .1, -.12, pc);
  const front = (w, h, x, y, m = black) => mesh(new THREE.BoxGeometry(w, h, .01), m, x, y, .272, pc);
  front(.3, .016, .2, .12); front(.3, .016, .2, .07); front(.12, .03, -.3, .1, dark); for (let i = 0; i < 7; i++) front(.004, .1, -.15 + i * .018, .1, dark);
  P.ledMat = new THREE.MeshBasicMaterial({ color: 0x0b2614, toneMapped: false }); P.hddMat = new THREE.MeshBasicMaterial({ color: 0x2a1c08, toneMapped: false });
  mesh(new THREE.BoxGeometry(.014, .014, .01), P.ledMat, -.42, .06, .274, pc); mesh(new THREE.BoxGeometry(.014, .014, .01), P.hddMat, -.39, .06, .274, pc);
  const mon = new THREE.Group(); mon.position.set(0, .26, -.05); pc.add(mon); P.mon = mon;
  mesh(new THREE.CylinderGeometry(.16, .2, .05, 32), plastic2, 0, -.035, -.05, mon);
  mesh(new RoundedBoxGeometry(.8, .64, .1, 5, .03), plastic, 0, .32, .06, mon);
  const back = new THREE.BoxGeometry(.74, .58, .5); const bp = back.attributes.position;
  for (let i = 0; i < bp.count; i++) if (bp.getZ(i) < 0) { bp.setX(i, bp.getX(i) * .66); bp.setY(i, bp.getY(i) * .7 + .02); }
  back.computeVertexNormals(); mesh(back, plastic2, 0, .32, -.2, mon);
  mesh(new THREE.BoxGeometry(.64, .49, .02), std({ color: 0x1a1a18, roughness: .4 }), 0, .335, .105, mon);
  P.monLed = new THREE.MeshBasicMaterial({ color: 0x2a1c08, toneMapped: false }); mesh(new THREE.BoxGeometry(.012, .012, .01), P.monLed, .23, .045, .116, mon);
  const sg = new THREE.PlaneGeometry(.6, .45, 24, 18); const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i) / .3, y = sp.getY(i) / .225; sp.setZ(i, .016 * (1 - .5 * (x * x + y * y))); }
  sg.computeVertexNormals(); P.screenGeo = sg;
  P.screenAt = (map) => { const s = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map, toneMapped: false })); s.position.set(0, .335, .118); mon.add(s); P.screen = s; return s; };
  P.SCREEN_C = V(0, DH + .26 + .335, deskZ - .05 + .118);
  // keyboard with every key its own instance so typing can press it
  const kb = new THREE.Group(); kb.position.set(0, DH + .018, deskZ + .43); kb.rotation.x = .05; scene.add(kb);
  mesh(new RoundedBoxGeometry(.86, .03, .27, 3, .01), plastic, 0, 0, 0, kb);
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(.034, .014, .034), plastic2, 120); let n = 0; const base = [], kidx = {};
  for (let r = 0; r < 6; r++) for (let c = 0; c < 20; c++) { if (r === 5 && c > 3 && c < 12) continue; M.makeTranslation(-.38 + c * .04, .021, -.1 + r * .042); keys.setMatrixAt(n, M); base[n] = M.clone(); kidx[r + ':' + c] = n; n++; }
  M.makeScale(8, 1, 1).setPosition(-.06, .021, .11); keys.setMatrixAt(n, M); base[n] = M.clone(); kidx.space = n; n++;
  keys.count = n; keys.castShadow = keys.receiveShadow = !mobile; kb.add(keys); Object.assign(P, { keys, base, kidx });
  mesh(new RoundedBoxGeometry(.12, .05, .2, 4, .024), plastic, .66, DH + .025, deskZ + .45);
  // banker's lamp: brass stem, green glass shade, a warm pool of light on the desk
  const lamp = new THREE.Group(); lamp.position.set(-.78, DH, deskZ + .05); scene.add(lamp);
  const brass = std({ color: 0x8a6a2a, roughness: .35, metalness: .85 });
  mesh(new THREE.CylinderGeometry(.09, .1, .025, 24), brass, 0, .012, 0, lamp); mesh(new THREE.CylinderGeometry(.008, .008, .32, 8), brass, 0, .17, -.02, lamp);
  const shadeG = new THREE.CylinderGeometry(.06, .07, .3, 24, 1, true, 0, Math.PI); shadeG.rotateZ(Math.PI / 2); shadeG.rotateY(Math.PI / 2);
  P.shadeM = std({ color: 0x0c5a30, roughness: .18, metalness: .25, emissive: 0x1f8a4a, emissiveIntensity: 0, side: THREE.DoubleSide });
  const shade = mesh(new THREE.CylinderGeometry(.07, .07, .3, 24, 1, true, -Math.PI / 2, Math.PI), P.shadeM, 0, .34, .06, lamp); shade.rotation.z = Math.PI / 2;
  P.lamp = new THREE.SpotLight(0xffc977, 0, 1.4, mobile ? .55 : .9, .8, 2); P.lamp.position.set(-.78, DH + .32, deskZ + .1); P.lamp.target.position.set(-.45, DH, deskZ + .3);
  P.lamp.castShadow = !mobile; P.lamp.shadow.mapSize.set(1024, 1024); P.lamp.shadow.bias = -.0015; scene.add(P.lamp, P.lamp.target);
  // specimen jar: a bud floating in green liquid
  const jar = new THREE.Group(); jar.position.set(.72, DH, deskZ - .02); scene.add(jar); P.jar = jar;
  const glassJ = new THREE.MeshStandardMaterial({ color: 0xbfe8d0, transparent: true, opacity: .18, roughness: .05, metalness: .1, depthWrite: false, side: THREE.DoubleSide });
  const liq = new THREE.MeshBasicMaterial({ color: new THREE.Color(.1, .5, .22), transparent: true, opacity: .45, depthWrite: false, toneMapped: false });
  const jb = makeBud(jar, .62, { color: 0x0a120d }); jb.position.y = .1; jb.userData.floaty = true; P.buds.push(jb); P.jarBud = jb;
  const lq = new THREE.Mesh(new THREE.CylinderGeometry(.105, .105, .26, 28), liq); lq.position.y = .14; lq.renderOrder = 4; jar.add(lq);
  const jg = new THREE.Mesh(new THREE.CylinderGeometry(.115, .115, .32, 28, 1, true), glassJ); jg.position.y = .16; jg.renderOrder = 5; jar.add(jg);
  mesh(new THREE.CylinderGeometry(.12, .12, .03, 28), std({ color: 0x3a3c3e, roughness: .4, metalness: .8 }), 0, .335, 0, jar);
  P.jarGlow = new THREE.PointLight(0x3cff8a, .25, 1.6, 2); P.jarGlow.position.set(.72, DH + .2, deskZ + .1); scene.add(P.jarGlow);
  // clipboard + seed packets
  const clip = mesh(new THREE.BoxGeometry(.24, .008, .32), std({ color: 0x6b4a2a, roughness: .8 }), -.42, DH + .004, deskZ + .42); clip.rotation.y = .25;
  const paperT = tex(256, 340, (g, w, h) => { g.fillStyle = '#d8d3c4'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a3a52'; g.font = '18px VT, monospace'; ['NIGHT SHIFT LOG', '', 'tray 4 - awake', 'tray 7 - awake', 'tray 9 - watching', '', 'do NOT turn off', 'the grow lights', '', 'they work better', 'in the dark.'].forEach((s, i) => g.fillText(s, 18, 34 + i * 26)); });
  const paper = mesh(new THREE.PlaneGeometry(.2, .27), std({ map: paperT, roughness: .9 }), 0, .006, .01, clip); paper.rotation.x = -Math.PI / 2;
  // whiteboard on an easel to the left: how the bud works, in marker
  const wb = new THREE.Group(); wb.position.set(-1.65, 0, deskZ + .45); wb.rotation.y = .5; scene.add(wb);
  for (const lx of [-.46, .46]) { const l = mesh(new THREE.BoxGeometry(.035, 1.7, .035), std({ color: 0x2a2d2b, roughness: .5, metalness: .6 }), lx, .85, 0, wb); l.rotation.z = lx > 0 ? -.05 : .05; }
  // the chart: a dark pixel panel, BAGWORK.SYS. fees go into the bud and out three ways. while you are close, packets run the wires,
  // the trace scrolls and the eye in the corner looks around.
  const CW = 1024, CH = 720, CG = '#5cf08a', CD = '#1f6a3a', CM = '#2f8a52', CWt = '#eafff0', CA = '#f2c14e', CR = '#ff6b6b', CC = '#7fe3c4';
  const cpx = (g, x, y, c, sz = 8) => { g.fillStyle = c; g.fillRect(x, y, sz, sz); };
  const cbox = (g, x, y, bw, bh, c, th = 4) => { g.fillStyle = c; g.fillRect(x, y, bw, th); g.fillRect(x, y + bh - th, bw, th); g.fillRect(x, y, th, bh); g.fillRect(x + bw - th, y, th, bh); };
  const ctxt = (g, t, x, y, sz, c, f = 'PX') => { g.font = `${sz}px ${f}, VT, monospace`; g.fillStyle = c; g.fillText(t, x, y); };
  const sprite = (g, rows, x, y, cell, pal) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) cpx(g, x + i * cell, y + j * cell, pal[ch], cell); }));
  const WIRES = { in: [[256, 330], [372, 330]], burn: [[604, 316], [680, 316], [680, 148], [768, 148]], drop: [[604, 330], [768, 330]], dev: [[604, 344], [680, 344], [680, 512], [768, 512]] };
  const BUDPX = ['....kk....kk....', '...kggk..kggk...', '....kggkkggk....', '......kggk......', '....kkkkkkkk....', '...kkkkkkkkkk...', '..kkkwwkkwwkkk..', '..kkwwkkkkwwkk..', '..kkkkkkkkkkkk..', '..kkkGGGGGGkkk..', '...kkkkkkkkkk...', '....kkkkkkkk....', '....kk....kk....'];
  const BUDX = 392, BUDY = 234;
  const OUTB = [['burn', 'BURN', 'buy back · gone forever', CR, '#c98a8a', 102], ['drop', 'DROP', 'sol to the top 20', CC, '#6fb8a4', 284], ['dev', 'DEV', 'paid to whoever launched', CA, '#bfa060', 466]];
  const chartBase = document.createElement('canvas'); chartBase.width = CW; chartBase.height = CH;
  (g => {
    g.fillStyle = '#020a05'; g.fillRect(0, 0, CW, CH);
    g.strokeStyle = 'rgba(92,240,138,.055)'; g.lineWidth = 1; for (let x = 0; x <= CW; x += 16) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, CH); g.stroke(); } for (let y = 0; y <= CH; y += 16) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(CW, y + .5); g.stroke(); }
    // header
    g.fillStyle = '#0a2414'; g.fillRect(0, 0, CW, 64); g.fillStyle = CD; g.fillRect(0, 64, CW, 4);
    ctxt(g, 'NODE 07', 28, 44, 26, CM); ctxt(g, 'LIVE', 924, 44, 24, CR);
    ctxt(g, 'pid 0007   uptime 19d 04:13   sleep: none   owner: ???', 28, 98, 20, CM, 'VT');
    // wires: dotted, square, arrowheads at the end
    const wire = (pts, c) => { for (let i = 1; i < pts.length; i++) { const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 16 | 0; for (let k = 0; k <= n; k++) cpx(g, Math.round(x1 + (x2 - x1) * k / Math.max(1, n)) - 4, Math.round(y1 + (y2 - y1) * k / Math.max(1, n)) - 4, c, 8); } };
    const head = (x, y, c) => { cpx(g, x - 12, y - 4, c); for (const dy of [-12, -4, 4]) cpx(g, x - 20, y + dy, c); for (const dy of [-20, -12, -4, 4, 12]) cpx(g, x - 28, y + dy, c); };
    wire(WIRES.in, CD); head(366, 330, CG);
    wire(WIRES.burn, '#3a1a1a'); wire(WIRES.drop, '#16382e'); wire(WIRES.dev, '#3a2e12');
    head(762, 148, CR); head(762, 330, CC); head(762, 512, CA);
    // fees in
    cbox(g, 40, 262, 214, 136, CG); ctxt(g, 'CREATOR', 62, 312, 28, CWt); ctxt(g, 'FEES', 62, 358, 38, CG);
    [0, 2, -2, 1].forEach((dx, k) => { const y = 366 - k * 12; g.fillStyle = '#6b5216'; g.fillRect(194 + dx, y, 36, 12); g.fillStyle = CA; g.fillRect(194 + dx, y, 36, 7); g.fillStyle = '#fff3c4'; g.fillRect(198 + dx, y + 2, 8, 2); });
    ctxt(g, 'pump.fun creator vault', 40, 424, 18, CM, 'VT');
    // the bud
    sprite(g, BUDPX, BUDX, BUDY, 12, { k: '#0b1f12', g: '#3fbf6a', w: CWt, G: CG });
    g.shadowColor = CG; g.shadowBlur = 22; cbox(g, 372, 214, 232, 196, CG); g.shadowBlur = 0;
    ctxt(g, 'BUD #0007', 412, 448, 30, CG); ctxt(g, 'awake · claims every pass', 398, 474, 18, CM, 'VT');
    // three ways out
    OUTB.forEach(([, n, sub, c, c2, y]) => { cbox(g, 768, y, 220, 92, c); ctxt(g, n, 790, y + 50, 34, c); ctxt(g, sub, 790, y + 78, 18, c2, 'VT'); });
    sprite(g, ['..r...', '..rr..', '.rar..', '.raar.', 'rraarr', 'raaaar', '.rrrr.'], 932, 118, 6, { r: CR, a: CA });
    sprite(g, ['...c...', '..ccc..', '.ccwcc.', '.cwccc.', 'ccccccc', 'ccccccc', '.ccccc.', '..ccc..'], 930, 296, 6, { c: CC, w: CWt });
    ctxt(g, '$', 940, 514, 40, CA);
    // the strange part
    ctxt(g, 'FEE FLOW · 24H', 40, 566, 18, CM, 'VT'); g.fillStyle = '#0d2a17'; g.fillRect(40, 640, 560, 2);
    ctxt(g, 'SLEEP: NOT FOUND', 40, 688, 24, CR, 'VT'); ctxt(g, 'IT WATCHES THE CHART', 330, 688, 24, CD, 'VT');
    ctxt(g, '04:13:52 · TRAY 07 · DO NOT FEED AFTER MIDNIGHT', 600, 710, 16, CD, 'VT');
    sprite(g, ['..wwww..', '.w....w.', 'w......w', 'w......w', '.w....w.', '..wwww..'], 876, 584, 10, { w: CG });
  })(chartBase.getContext('2d'));
  const chartC = document.createElement('canvas'); chartC.width = CW; chartC.height = CH; const cg = chartC.getContext('2d');
  const board = new THREE.CanvasTexture(chartC); board.colorSpace = THREE.SRGBColorSpace; board.anisotropy = 4;
  const along = (pts, f) => { const seg = []; let L = 0; for (let i = 1; i < pts.length; i++) { const l = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; }
    let d = Math.max(0, Math.min(1, f)) * L; for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const p0 = pts[i], p1 = pts[i + 1], k = seg[i] ? d / seg[i] : 0; return [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k]; } d -= seg[i]; } return pts[pts.length - 1]; };
  const snap = v => Math.round(v / 4) * 4;
  P.chartTick = t => {
    const g = cg; g.drawImage(chartBase, 0, 0);
    const T = t % 2.6, loop = Math.floor(t / 2.6);
    ctxt(g, 'JOBS ' + String(1337 + loop).padStart(6, '0'), 690, 44, 24, CG, 'VT');
    if ((t * 1.25 | 0) % 2 === 0) cpx(g, 900, 26, CR, 14);
    if (T < .9) { const [x, y] = along(WIRES.in, T / .9); cpx(g, snap(x) - 8, snap(y) - 8, CA, 16); }
    const fed = T >= .9 && T < 1.35, blink = (t % 4.3) < .15;
    if (fed || blink) BUDPX.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'w') cpx(g, BUDX + i * 12, BUDY + j * 12, fed ? CA : '#0b1f12', 12); }));
    if (fed) { g.globalAlpha = 1 - (T - .9) / .45; cbox(g, 368, 210, 240, 204, CWt, 3); g.globalAlpha = 1; }
    if (T >= 1.1 && T < 2.1) OUTB.forEach(([k, , , c]) => { const [x, y] = along(WIRES[k], (T - 1.1) / 1); cpx(g, snap(x) - 6, snap(y) - 6, c, 12); });
    if (T >= 2.1 && T < 2.55) { g.globalAlpha = 1 - (T - 2.1) / .45; OUTB.forEach(([, , , c, , y]) => cbox(g, 764, y - 4, 228, 100, CWt, 3)); g.globalAlpha = 1; }
    g.strokeStyle = CG; g.lineWidth = 3; g.beginPath();
    for (let x = 40; x < 600; x += 4) { const u = x + t * 46, y = 612 + Math.sin(u / 13) * 7 + Math.sin(u / 3.1) * 2 - ((u % 420) > 396 ? 26 : 0); x === 40 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke(); const cx = 40 + ((t * 120) % 560); g.fillStyle = 'rgba(234,255,240,.5)'; g.fillRect(cx, 584, 2, 56);
    const look = Math.round(Math.sin(t * .6) * 1.4 + Math.sin(t * 1.7) * .4); cpx(g, 906 + look * 10, 604, CR, 20);
    if ((t % 5.3) < .14) { const y = 110 + ((t * 7919 | 0) % 480); g.putImageData(g.getImageData(0, y, CW, 5), 22, y); }
    g.fillStyle = 'rgba(0,0,0,.26)'; for (let y = 0; y < CH; y += 4) g.fillRect(0, y, CW, 2);
    board.needsUpdate = true;
  };
  P.chartTick(0);
  mesh(new THREE.BoxGeometry(1.04, .74, .04), std({ color: 0x141614, roughness: .45, metalness: .5 }), 0, 1.3, .015, wb);
  const chart = new THREE.Mesh(new THREE.PlaneGeometry(.98, .69), new THREE.MeshBasicMaterial({ map: board, toneMapped: false, color: 0xc4c4c4 })); chart.position.set(0, 1.3, .04); wb.add(chart);
  P.chartGlow = new THREE.PointLight(0x5cf08a, .25, 1.6, 2); P.chartGlow.position.set(-1.45, 1.3, deskZ + .85); scene.add(P.chartGlow);
  // shelves of jars on the back wall
  const shelf = new THREE.Group(); shelf.position.set(1.7, 0, deskZ - .7); scene.add(shelf);
  for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(1.4, .03, .35), benchM, 0, .4 + k * .45, 0, shelf);
  for (const lx of [-.68, .68]) mesh(new THREE.BoxGeometry(.03, 1.8, .03), benchM, lx, .9, .15, shelf);
  const jarCols = [[.1, .55, .25], [.35, .55, .1], [.1, .45, .4], [.55, .42, .12]];
  for (let k = 0; k < 4; k++) for (let j = 0; j < 5; j++) { if (rnd() < .25) continue; const h = .12 + rnd() * .1, c = jarCols[(rnd() * 4) | 0];
    const jm = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, h, 14), new THREE.MeshStandardMaterial({ color: new THREE.Color(c[0], c[1], c[2]), emissive: new THREE.Color(c[0] * .35, c[1] * .35, c[2] * .35), roughness: .15, metalness: .1, transparent: true, opacity: .62 })); jm.position.set(-.55 + j * .27, .415 + k * .45 + h / 2, (rnd() - .5) * .1); shelf.add(jm); }

  // spores drifting in the light, rain falling outside the door
  const N = mobile ? 260 : 700, sp3 = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { sp3[i * 3] = (rnd() - .5) * 6.4; sp3[i * 3 + 1] = .2 + rnd() * 2.3; sp3[i * 3 + 2] = Z0 + rnd() * (Z1 - Z0); }
  const spg = new THREE.BufferGeometry(); spg.setAttribute('position', new THREE.BufferAttribute(sp3, 3));
  const dot = tex(32, 32, g => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); }, null, false);
  P.sporeM = new THREE.PointsMaterial({ color: 0xbfffd0, size: .022, map: dot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  P.spores = new THREE.Points(spg, P.sporeM); scene.add(P.spores);
  const RN = mobile ? 500 : 1400, rp = new Float32Array(RN * 6);
  for (let i = 0; i < RN; i++) { const x = (rnd() - .5) * 16, y = rnd() * 6, z = Z1 + .4 + rnd() * 8; rp.set([x, y, z, x - .01, y - .18, z], i * 6); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  P.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x8a9ac8, transparent: true, opacity: .35, fog: false })); scene.add(P.rain);

  // light: moon through the roof, a cold fill, lightning, the CRT glow of the main PC
  P.moon = new THREE.DirectionalLight(0x6d86d8, .35); P.moon.position.set(4, 9, 3); P.moon.target.position.set(0, 0, 0);
  P.moon.castShadow = !mobile; P.moon.shadow.mapSize.set(2048, 2048); Object.assign(P.moon.shadow.camera, { left: -6, right: 6, top: 9, bottom: -9, far: 30 }); P.moon.shadow.bias = -.0008;
  scene.add(P.moon, P.moon.target);
  P.hemi = new THREE.HemisphereLight(0x2a2f4a, 0x0c0a0c, .25); scene.add(P.hemi);
  P.bolt = new THREE.DirectionalLight(0xcfe0ff, 0); P.bolt.position.set(-3, 10, 2); scene.add(P.bolt);
  P.glow = new THREE.PointLight(0x5cf08a, 0, 3, 2); P.glow.position.set(0, DH + .55, deskZ + .7); scene.add(P.glow);
  P.rainT = rainT; P.TOP = TOP; P.deskZ = deskZ; P.DH = DH;
  return P;
}
