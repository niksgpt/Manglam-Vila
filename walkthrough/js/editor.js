/* Floor plan editor: every wall, window, door and pillar can be selected, moved,
   resized, edited by typing sizes, or deleted. One floor is edited at a time
   (editor.html = first floor, editor.html?floor=ground = ground floor). Changes are
   saved in this browser under the key the 3D walkthrough reads, and can be
   downloaded as that floor's plan file. */
(function () {
  const A = window.APP;
  const GROUND = new URLSearchParams(location.search).get('floor') === 'ground' && !!window.PLAN_DATA_GROUND;
  const BASE = GROUND ? window.PLAN_DATA_GROUND : window.PLAN_DATA, KEY = GROUND ? A.PLAN_KEY_G : A.PLAN_KEY;
  const FILE = GROUND ? 'plan-data-ground.js' : 'plan-data.js', VAR = GROUND ? 'PLAN_DATA_GROUND' : 'PLAN_DATA', QS = GROUND ? '?floor=ground' : '';
  const PV = GROUND ? A.plan.ground : A.plan;   // this floor's fixed parts (room floors, room names)
  // the compass: the true directions of the plan's sides, from the site file (js/site-data.js, made in
  // Blender); without it, the old fixed labels (rear east, road west)
  const BEARING = window.SITE ? window.SITE.rearBearing : 90, NAMES8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const dir8 = (b) => NAMES8[Math.floor(((((b % 360) + 360) % 360) + 22.5) / 45) % 8];
  const SIDE = { rear: dir8(BEARING), front: dir8(BEARING + 180), xLow: dir8(BEARING - 90), xHigh: dir8(BEARING + 90) };
  const AREA_NAMES = { void: 'Double-height opening', terrace: 'Terrace', balcony: 'Balcony', porch: 'Car porch', platform: 'Raised floor (lobby / walkway)', court: 'Open court' };
  const $ = (id) => document.getElementById(id);
  const svg = $('svg'), world = $('world');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const r4 = (v) => Math.round(v * 10000) / 10000;

  // --- the plan being edited ----------------------------------------------------
  const pick = (d) => ({ version: BASE.version, H: d.H, walls: clone(d.walls), pillars: clone(d.pillars), areas: clone(d.areas || (GROUND ? [] : A.DEFAULT_AREAS)), wardrobes: clone(d.wardrobes || (GROUND ? [] : A.DEFAULT_WARDROBES)) });
  let plan = pick(BASE), browserCopy = null;
  try {
    const s = localStorage.getItem(KEY);
    if (s) { const o = JSON.parse(s); if (o && o.version === BASE.version && Array.isArray(o.walls) && Array.isArray(o.pillars)) browserCopy = pick(o); }
  } catch (err) { /* no storage: work from the file */ }

  let sel = null;            // { kind: 'wall' | 'op' | 'pillar' | 'area', i, j }
  let tool = 'select';       // 'select' | 'wall' | 'pillar'
  let drag = null;
  const undo = [], redo = [];
  const view = { x: -8, y: -6, w: 46, h: 62 };

  // --- feet and inches ------------------------------------------------------------
  function fmt(v) {
    const neg = v < -1e-6, t = Math.round(Math.abs(v) * 24); // half inches
    const ft = Math.floor(t / 24), half = t - ft * 24, inch = Math.floor(half / 2), fr = half % 2 ? '½' : '';
    return (neg ? '-' : '') + ft + "'-" + inch + fr + '"';
  }
  function parse(str) {
    let s = String(str).trim().replace(/[″”“]/g, '"').replace(/[′’‘]/g, "'").replace(/\s*½/, '.5').replace(/\s*¼/, '.25').replace(/\s*¾/, '.75');
    let m;
    if ((m = s.match(/^(-?)\s*(\d+(?:\.\d+)?)\s*'\s*-?\s*(?:(\d+(?:\.\d+)?)\s*"?)?$/))) return (m[1] ? -1 : 1) * (+m[2] + (m[3] ? +m[3] / 12 : 0));
    if ((m = s.match(/^(-?)\s*(\d+(?:\.\d+)?)\s*"$/))) return ((m[1] ? -1 : 1) * +m[2]) / 12;
    if (/^-?\d+(\.\d+)?$/.test(s)) return +s;
    return NaN;
  }
  const snapStep = () => +$('g-snap').value;
  const snap = (v) => { const st = snapStep(); return st ? Math.round(v / st) * st : v; };

  // --- geometry helpers -------------------------------------------------------------
  const along = (w) => (w.ax === 'x' ? [0, 2] : [1, 3]);   // indices of the wall's start / end in r
  const across = (w) => (w.ax === 'x' ? [1, 3] : [0, 2]);
  const lo = (w) => w.r[along(w)[0]], hi = (w) => w.r[along(w)[1]];
  const ops = (w) => w.ops || (w.ops = []);
  const isLow = (w) => Array.isArray(w.z) && w.z[0] === 0 && typeof w.z[1] === 'number';
  // Named heights on this floor, in feet above its own floor finish.
  const SLABT = +BASE.SLAB || 0.4167;
  const otherH = () => +((GROUND ? window.PLAN_DATA : window.PLAN_DATA_GROUND) || {}).H || plan.H;
  function levels() {
    const t = { H: plan.H, TOP: plan.H + SLABT };
    if (GROUND) { t.PORCH = -1.5; t.ROOF = plan.H + SLABT + otherH() + SLABT; }
    else { t.GF = -(otherH() + SLABT); t['-SLAB'] = -SLABT; }
    return t;
  }
  const LEVEL_NAMES = { H: 'ceiling', TOP: 'top of the slab', PORCH: 'car porch level', ROOF: 'top of the roof', GF: 'ground floor', '-SLAB': 'underside of the floor slab' };
  const zFeet = (v) => (typeof v === 'number' ? v : levels()[v] !== undefined ? levels()[v] : +v || 0);
  const zToken = (v) => { const t = levels(); for (const k in t) if (Math.abs(t[k] - v) < 0.006) return k; return Math.round(v * 10000) / 10000; };
  const zRange = (w, full) => (w.z ? [zFeet(w.z[0]), zFeet(w.z[1])] : full);
  const levelHint = () => 'Heights are from this floor\'s finish: ' + Object.keys(levels()).map((k) => LEVEL_NAMES[k] + ' ' + fmt(levels()[k])).join(', ') + '.';
  // Walls of the ground floor that rise up through this floor (shown on the first floor, edited on the ground floor tab).
  const through = () => (!GROUND && A.plan.ground ? A.plan.ground.walls.map((w, i) => ({ w, i })).filter((o) => o.w.z[1] > 1) : []);
  const item = () => (!sel ? null : sel.kind === 'wall' ? plan.walls[sel.i] : sel.kind === 'op' ? plan.walls[sel.i].ops[sel.j] : sel.kind === 'area' ? plan.areas[sel.i] : sel.kind === 'wardrobe' ? plan.wardrobes[sel.i] : sel.kind === 'through' ? A.plan.ground.walls[sel.i] : plan.pillars[sel.i]);
  function opRect(w, o) {
    return w.ax === 'x' ? [o.a, w.r[1], o.b, w.r[3]] : [w.r[0], o.a, w.r[2], o.b];
  }
  function limits(w, j) { // free stretch of wall around opening j
    let a = lo(w), b = hi(w);
    ops(w).forEach((o, k) => { if (k === j) return; const me = ops(w)[j]; if (o.b <= me.a + 1e-6) a = Math.max(a, o.b); if (o.a >= me.b - 1e-6) b = Math.min(b, o.a); });
    return [a, b];
  }
  function tidy() {
    for (const w of plan.walls) {
      w.r = w.r.map(r4);
      if (w.ops) {
        w.ops.forEach((o) => { o.a = r4(Math.max(lo(w), o.a)); o.b = r4(Math.min(hi(w), o.b)); });
        if (!w.ops.length) delete w.ops;
      }
    }
    for (const p of plan.pillars) p.r = p.r.map(r4);
    for (const a of plan.areas) a.r = a.r.map(r4);
    for (const a of plan.wardrobes) a.r = a.r.map(r4);
  }

  // --- history and saving ---------------------------------------------------------------
  const snapshot = () => JSON.stringify({ plan, sel });
  function checkpoint() { undo.push(snapshot()); if (undo.length > 200) undo.shift(); redo.length = 0; }
  function restore(s) { const o = JSON.parse(s); plan = o.plan; sel = o.sel; }
  /* Saving. When the page comes from the local server (serve.py) every change is
     written into js/plan-data.js on disk. Otherwise it is kept in this browser. */
  let disk = false, diskTimer = null, diskState = '', checked = false, fileStamp = '';
  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Plan-Editor': '1', 'X-Plan-Stamp': fileStamp }, body: body || '{}' }).then((r) => r.json());
  function pushDisk() {
    diskState = 'busy';
    clearTimeout(diskTimer);
    diskTimer = setTimeout(() => {
      post('api/plan' + QS, JSON.stringify(plan)).then((j) => {
        diskState = j && j.ok ? 'ok' : j && j.error === 'stale' ? 'stale' : 'fail';
        if (j && j.ok) fileStamp = j.stamp || fileStamp;
        if (diskState === 'ok') { try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ } }
        showStatus(true);
      }).catch(() => { diskState = 'fail'; showStatus(true); });
    }, 300);
  }
  function showStatus(ok) {
    const same = JSON.stringify(pick(BASE)) === JSON.stringify(plan);
    const pill = $('savepill');
    if (pill) {
      const st = disk ? (diskState === 'stale' ? ['bad', 'NOT saved: the plan changed elsewhere. Reload this page'] : diskState === 'fail' ? ['bad', 'NOT saved: could not write the plan file'] : diskState === 'busy' ? ['busy', 'Saving…'] : ['good', diskState === 'ok' ? 'Saved to plan file at ' + new Date().toTimeString().slice(0, 5) : 'Connected to plan file'])
        : checked ? ['bad', 'NOT saving to the plan file. Open http://localhost:8765/editor.html' + QS] : ['busy', 'Checking…'];
      pill.className = 'pill ' + st[0];
      pill.textContent = st[1];
    }
    if (disk) {
      if (diskState === 'stale') { $('status').innerHTML = '<b>Not saved.</b> This floor\'s plan file was changed after this page opened (in another tab, or by an update). Reload the page to get the latest plan, then make the change again.'; return; }
      $('status').innerHTML = diskState === 'ok' ? '<b>Saved to the plan file.</b> The 3D walkthrough uses it.'
        : diskState === 'fail' ? '<b>Could not write the plan file.</b> Your changes are kept in this browser; use Download plan file as well.'
        : diskState === 'busy' ? 'Saving to the plan file…' : '<b>Plan file loaded.</b> Changes are saved into it as you make them.';
      return;
    }
    $('status').innerHTML = !ok ? '<b>Could not save in this browser.</b> Use Download plan file to keep your changes.'
      : same ? '<b>Matches the original plan.</b>' : '<b>Edited.</b> Saved in this browser only. Open the editor from http://localhost:8765/editor.html' + QS + ' to save into the plan file.';
    if (same && ok) { try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ } }
  }
  function save(initial) {
    tidy();
    let ok = true;
    if (initial) return showStatus(true); // opening the editor saves nothing; the plan file stays the record
    try { localStorage.setItem(KEY, JSON.stringify(plan)); } catch (err) { ok = false; }
    if (disk) pushDisk();
    showStatus(ok);
  }
  function changed() { save(); render(); panel(); }

  // --- drawing the plan --------------------------------------------------------------------
  // the original drawing laid under the plan: points per foot, plot corner and sheet size, per floor
  const SHEET = GROUND ? { img: 'debug/plan-ground.png', k: 48.61, x: 675.03, y: 173.2, w: 2382.83, h: 3368.83 } : { img: 'debug/plan.png', k: 11.307, x: 131.6, y: 79.35, w: 595, h: 842 };
  function px() { return view.w / svg.clientWidth; } // feet per screen pixel
  function render() {
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    const u = px(), P = PV, out = [], TREAD = A.plan.TREAD;
    const rect = (r, attrs) => `<rect x="${r[0]}" y="${r[1]}" width="${Math.max(0, r[2] - r[0])}" height="${Math.max(0, r[3] - r[1])}" ${attrs}/>`;
    // context: floors, void, stair, room names
    for (const f of P.roomFloors) out.push(rect(f, `fill="${f[4] === 'woodfloor' ? '#eadfcb' : f[4] === 'bathfloor' ? '#e3e6e3' : '#efe9dd'}"`));
    if (!GROUND) out.push(rect([-0.375, 14.625, 29.625, 27.875], 'fill="#efe9dd"')); // lounge and gallery floor
    if ($('g-other') && $('g-other').checked) { // the other floor's walls, faintly, to line things up
      const other = GROUND ? A.plan.walls : (A.plan.ground ? A.plan.ground.walls : []);
      for (const w of other) out.push(rect(w.r, 'fill="#b9c6d6" opacity="0.55" style="pointer-events:none"'));
    }
    const thin = `stroke="#b3a793" stroke-width="${u}" fill="none" style="pointer-events:none"`;
    // open areas, live: terraces and balconies first, then the double-height opening
    const dash = `stroke-width="${1.3 * u}" stroke-dasharray="${5 * u} ${3 * u}" style="cursor:pointer"`;
    const areaFill = { terrace: '#dde3cc', balcony: '#e4e2d0', porch: '#e6ddd0', platform: '#e9e4d6', court: '#dbe6e1' };
    plan.areas.forEach((a, i) => { if (a.kind !== 'void') out.push(rect(a.r, `data-kind="area" data-i="${i}" fill="${areaFill[a.kind] || '#e4e2d0'}" stroke="#8f9872" ${dash}`)); });
    plan.areas.forEach((a, i) => {
      if (a.kind !== 'void') return;
      out.push(rect(a.r, `data-kind="area" data-i="${i}" fill="#d9cfbd" stroke="#9a8a72" ${dash}`));
      out.push(`<path d="M${a.r[0]} ${a.r[1]} L${a.r[2]} ${a.r[3]} M${a.r[2]} ${a.r[1]} L${a.r[0]} ${a.r[3]}" ${thin} stroke-dasharray="${6 * u} ${5 * u}"/>`);
    });
    // the main stair is fixed
    out.push(rect([20.29, 24.375, 29.625, 27.875], 'fill="#e6dfd2" style="pointer-events:none"'), rect([26.125, 14.625, 29.625, 24.375], 'fill="#e6dfd2" style="pointer-events:none"'));
    let st = '';
    for (let i = 0; i <= 7; i++) st += `M${20.29 + i * TREAD} 24.375 V27.875 `;
    for (let i = 0; i <= 7; i++) st += `M26.125 ${23.96 - i * TREAD} H29.625 `;
    for (let i = 0; i <= 3; i++) st += `M${26.125 - i * TREAD} 14.625 V18.125 `;
    if (GROUND) { // the front stair, as drawn (fixed)
      out.push(rect([22.13, 47, 29.625, 52.75], 'fill="#e6dfd2" style="pointer-events:none"'));
      for (let i = 0; i <= 6; i++) st += `M${22.13 + i * 0.7917} 47 V52.75 `;
      st += 'M22.13 49.88 H26.88 ';
    }
    out.push(`<path d="${st}" ${thin}/>`);
    if ($('g-img').checked) out.push(`<image href="${SHEET.img}" x="${-SHEET.x / SHEET.k}" y="${-SHEET.y / SHEET.k}" width="${SHEET.w / SHEET.k}" height="${SHEET.h / SHEET.k}" opacity="${$('g-op').value}" preserveAspectRatio="none" style="pointer-events:none"/>`);
    if ($('g-rooms').checked) {
      const seen = {};
      const label = (name, x, y) => out.push(`<text x="${x}" y="${y}" font-size="${11 * u}" text-anchor="middle" dominant-baseline="middle" fill="#8a7f70" style="pointer-events:none">${name}</text>`);
      for (const r of P.rooms) {
        if (r.area || r.name === 'Gallery' || seen[r.name]) continue;
        seen[r.name] = 1;
        label(r.name, (r.r[0] + r.r[2]) / 2, (r.r[1] + r.r[3]) / 2);
      }
      if (!GROUND) label('Gallery', 14.8, 26.1);
      for (const a of plan.areas) {
        if (seen[a.name]) continue;
        seen[a.name] = 1;
        label(String(a.name).replace(/</g, '&lt;'), (a.r[0] + a.r[2]) / 2, (a.r[1] + a.r[3]) / 2);
      }
      out.push(`<text x="14.5" y="${54.5 + 20 * u}" font-size="${11 * u}" text-anchor="middle" fill="#8a7f70" style="pointer-events:none">ROAD (${SIDE.front}) ↓</text>`);
      out.push(`<text x="14.5" y="${-2 - 10 * u}" font-size="${11 * u}" text-anchor="middle" fill="#8a7f70" style="pointer-events:none">↑ REAR (${SIDE.rear})   ·   ← ${SIDE.xLow}   ${SIDE.xHigh} →</text>`);
      // north arrow beside the plan (true north from the site file)
      { const b = (BEARING * Math.PI) / 180, nx = -Math.sin(b), ny = -Math.cos(b), cx = -4.3, cy = 6, r = 2.3;
        out.push(`<g style="pointer-events:none"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#b8a88e" stroke-width="${0.8 * u}"/>`
          + `<path d="M${cx + nx * r} ${cy + ny * r} L${cx - ny * 0.8} ${cy + nx * 0.8} L${cx + ny * 0.8} ${cy - nx * 0.8} Z" fill="#b8503c"/>`
          + `<path d="M${cx - nx * r} ${cy - ny * r} L${cx - ny * 0.8} ${cy + nx * 0.8} L${cx + ny * 0.8} ${cy - nx * 0.8} Z" fill="#cdbf9f"/>`
          + `<text x="${cx + nx * (r + 1.3)}" y="${cy + ny * (r + 1.3)}" font-size="${12 * u}" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#8a5a40">N</text></g>`); }
    }
    const hit = `stroke="transparent" stroke-width="${9 * u}" style="cursor:pointer"`;
    // walls of the ground floor that run up through this floor, with their openings at this level
    for (const { w, i } of through()) {
      out.push(rect(w.r, `data-kind="through" data-i="${i}" fill="var(--wall)" ${hit}`));
      out.push(rect(w.r, `fill="url(#up)" style="pointer-events:none"`));
      for (const o of w.ops || []) {
        if (w.base + (o.sill || 0) < -0.5 || w.base + o.head < 1) continue;   // openings on the floor below
        const r = w.ax === 'x' ? [o.a, w.r[1], o.b, w.r[3]] : [w.r[0], o.a, w.r[2], o.b];
        out.push(rect(r, o.type === 'win' || o.type === 'vent' ? `fill="#dcecf6" stroke="var(--win)" stroke-width="${1.5 * u}" style="pointer-events:none"` : `fill="var(--paper)" stroke="var(--door)" stroke-width="${1.5 * u}" stroke-dasharray="${4 * u} ${3 * u}" style="pointer-events:none"`));
      }
    }
    // walls
    plan.walls.forEach((w, i) => {
      if (w.hidden) return;
      out.push(rect(w.r, `data-kind="wall" data-i="${i}" fill="${isLow(w) ? 'var(--low)' : 'var(--wall)'}" ${hit}`));
    });
    // walls with a railing on top: a dotted white line down the middle
    plan.walls.forEach((w) => {
      if (w.hidden) return;
      const zr = zRange(w, [0, plan.H]);
      if (!A.wallRail(w.r, zr[0], zr[1], w.rail, w.railTop, plan.areas)) return;
      const c = (w.r[across(w)[0]] + w.r[across(w)[1]]) / 2, dots = `stroke="#fff" stroke-width="${1.8 * u}" stroke-dasharray="${1.6 * u} ${2.4 * u}" style="pointer-events:none"`;
      out.push(w.ax === 'x' ? `<path d="M${w.r[0]} ${c} H${w.r[2]}" ${dots}/>` : `<path d="M${c} ${w.r[1]} V${w.r[3]}" ${dots}/>`);
    });
    // openings
    plan.walls.forEach((w, i) => {
      if (w.hidden) return;
      ops(w).forEach((o, j) => {
        const r = opRect(w, o), win = o.type === 'win' || o.type === 'vent', d = `data-kind="op" data-i="${i}" data-j="${j}"`;
        if (win) {
          out.push(rect(r, `${d} fill="#dcecf6" stroke="var(--win)" stroke-width="${1.5 * u}" style="cursor:pointer"`));
          const c = (w.r[across(w)[0]] + w.r[across(w)[1]]) / 2;
          out.push(w.ax === 'x' ? `<path d="M${o.a} ${c} H${o.b}" stroke="var(--win)" stroke-width="${1.5 * u}" style="pointer-events:none"/>` : `<path d="M${c} ${o.a} V${o.b}" stroke="var(--win)" stroke-width="${1.5 * u}" style="pointer-events:none"/>`);
        } else {
          const cased = o.type === 'open';
          out.push(rect(r, `${d} fill="var(--paper)" stroke="var(--door)" stroke-width="${1.5 * u}" ${cased ? `stroke-dasharray="${4 * u} ${3 * u}"` : ''} style="cursor:pointer"`));
          if (!cased) { // leaf and swing arc (two half leaves for a double door)
            const sg = o.swing > 0 ? 1 : -1, face = w.r[across(w)[sg > 0 ? 1 : 0]];
            const leaves = o.leaves === 2 ? [[o.a, 1], [o.b, -1]] : [[o.hinge === 'a' ? o.a : o.b, o.hinge === 'a' ? 1 : -1]];
            const wd = (o.b - o.a) / leaves.length;
            for (const [hp, dirA] of leaves) {
              const tip = face + sg * wd, far = hp + dirA * wd, sweep = (sg * dirA > 0) === (w.ax === 'x') ? 0 : 1;
              const pth = w.ax === 'x' ? `M${hp} ${face} L${hp} ${tip} A${wd} ${wd} 0 0 ${sweep} ${far} ${face}` : `M${face} ${hp} L${tip} ${hp} A${wd} ${wd} 0 0 ${1 - sweep} ${face} ${far}`;
              out.push(`<path d="${pth}" fill="none" stroke="var(--door)" stroke-width="${1.2 * u}" ${o.type === 'gdoor' ? `stroke-dasharray="${5 * u} ${2 * u}"` : ''} style="pointer-events:none"/>`);
            }
          }
        }
      });
    });
    // wardrobes: brown box, a diagonal, and a heavy line on the side the doors are on
    plan.wardrobes.forEach((w, i) => {
      const r = w.r, f = w.face;
      out.push(rect(r, `data-kind="wardrobe" data-i="${i}" fill="#c9a276" stroke="#7a5230" stroke-width="${1.2 * u}" style="cursor:pointer"`));
      const door = f === 'rear' ? `M${r[0]} ${r[1]} H${r[2]}` : f === 'front' ? `M${r[0]} ${r[3]} H${r[2]}` : f === 'north' ? `M${r[0]} ${r[1]} V${r[3]}` : `M${r[2]} ${r[1]} V${r[3]}`;
      out.push(`<path d="M${r[0]} ${r[3]} L${r[2]} ${r[1]}" stroke="#7a5230" stroke-width="${u}" fill="none" style="pointer-events:none"/>`);
      out.push(`<path d="${door}" stroke="#4a2f18" stroke-width="${3.5 * u}" fill="none" style="pointer-events:none"/>`);
    });
    // pillars
    plan.pillars.forEach((p, i) => out.push(rect(p.r, `data-kind="pillar" data-i="${i}" fill="var(--pillar)" stroke="#fff" stroke-width="${0.8 * u}" style="cursor:pointer"`)));
    // drawing a new wall
    if (drag && drag.mode === 'draw' && drag.r) out.push(rect(drag.r, `fill="var(--sel)" opacity="0.5"`));
    // selection outline, size label and handles
    const it = item();
    if (it) {
      const w = sel.kind === 'op' ? plan.walls[sel.i] : null, r = sel.kind === 'op' ? opRect(w, it) : it.r;
      out.push(rect(r, `fill="none" stroke="var(--sel)" stroke-width="${2.5 * u}" style="pointer-events:none"`));
      const hs = [];
      const boxy = sel.kind === 'pillar' || sel.kind === 'area' || sel.kind === 'wardrobe', fixed = sel.kind === 'through';
      const off = (sel.kind === 'area' ? 0 : 10) * u, cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2; // handles sit just outside small items
      if (boxy) hs.push(['x0', r[0] - off, cy], ['x1', r[2] + off, cy], ['y0', cx, r[1] - off], ['y1', cx, r[3] + off]);
      else if ((w || it).ax === 'x') hs.push(['a', r[0] - (w ? 0 : off), cy], ['b', r[2] + (w ? 0 : off), cy]);
      else hs.push(['a', cx, r[1] - (w ? 0 : off)], ['b', cx, r[3] + (w ? 0 : off)]);
      if (fixed) hs.length = 0;
      for (const [h, x, y] of hs) out.push(`<circle data-kind="handle" data-h="${h}" cx="${x}" cy="${y}" r="${6.5 * u}" fill="#fff" stroke="var(--sel)" stroke-width="${2 * u}" style="cursor:${(boxy ? h[0] === 'x' : (w || it).ax === 'x') ? 'ew-resize' : 'ns-resize'}"/>`);
      const len = boxy ? fmt(r[2] - r[0]) + ' × ' + fmt(r[3] - r[1]) : fmt(sel.kind === 'op' ? it.b - it.a : hi(it) - lo(it));
      out.push(`<text x="${(r[0] + r[2]) / 2}" y="${r[1] - (sel.kind === 'pillar' ? 24 : 12) * u}" font-size="${12.5 * u}" font-weight="600" text-anchor="middle" fill="var(--sel)" stroke="var(--paper)" stroke-width="${3.5 * u}" paint-order="stroke" style="pointer-events:none">${len}</text>`);
    }
    world.innerHTML = `<defs><pattern id="up" width="${6 * u}" height="${6 * u}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${2 * u}" height="${6 * u}" fill="rgba(255,255,255,0.45)"/></pattern></defs>` + out.join('');
    svg.classList.toggle('draw', tool !== 'select');
    $('t-wall').classList.toggle('on', tool === 'wall');
    $('t-pillar').classList.toggle('on', tool === 'pillar');
    $('t-wardrobe').classList.toggle('on', tool === 'wardrobe');
    $('undo').disabled = !undo.length;
    $('redo').disabled = !redo.length;
    const onWall = sel && (sel.kind === 'wall' || sel.kind === 'op');
    for (const id of ['a-win', 'a-door', 'a-open']) $(id).disabled = !onWall;
    $('addhint').textContent = tool === 'wall' ? 'Drag on the plan to draw the wall. Esc cancels.' : tool === 'wardrobe' ? 'Click on the plan to place a 4 ft wardrobe, then drag, resize and set its door side. Esc cancels.' : tool === 'pillar' ? 'Click on the plan to place the pillar. Esc cancels.' : onWall ? 'Window, Door and Opening are added to the selected wall.' : 'Select a wall first to add a window, door or opening to it.';
  }

  // --- the properties panel ---------------------------------------------------------------------
  const TYPES = { win: 'Window', vent: 'Ventilator', door: 'Door (wood)', gdoor: 'Door (glazed)', open: 'Opening, no door' };
  function panel() {
    const box = $('props'), it = item();
    if (!it) { box.innerHTML = '<p class="hint">Nothing selected. Click any wall, window, door, pillar, terrace, balcony or the double-height opening.</p>'; return; }
    const rows = [], field = (key, label, value, kind, options) => rows.push({ key, label, value, kind: kind || 'len', options });
    let title;
    if (sel.kind === 'wall') {
      const w = it, x = w.ax === 'x', [a0] = across(w);
      title = 'Wall';
      field('id', 'Name', w.id, 'text');
      field('start', x ? `Start (X, ${SIDE.xLow} end)` : 'Start (Y, rear end)', lo(w));
      field('end', x ? `End (X, ${SIDE.xHigh} end)` : 'End (Y, front end)', hi(w));
      field('len', 'Length', hi(w) - lo(w));
      field('pos', x ? 'Position (Y, from rear)' : `Position (X, from ${SIDE.xLow})`, w.r[a0]);
      field('th', 'Thickness', w.r[across(w)[1]] - w.r[a0]);
      const hk = !w.z ? 'full' : isLow(w) ? 'low' : GROUND && w.z[0] === 0 && w.z[1] === 'ROOF' ? 'roof' : 'custom';
      const kinds = { full: 'Floor to ceiling', low: 'Low wall', custom: 'Set bottom and top' };
      if (GROUND) kinds.roof = 'Up to the roof (through the first floor)';
      field('kind', 'Height', hk, 'select', kinds);
      if (hk === 'low') field('top', 'Low wall height', w.z[1]);
      if (hk === 'custom' || hk === 'roof') { const zr = zRange(w, [0, plan.H]); field('zb', 'Bottom', zr[0]); field('zt', 'Top', zr[1]); rows.push({ note: levelHint() }); }
      if (hk === 'low' || hk === 'custom') { // a railing on top of the wall
        const zr = zRange(w, [0, plan.H]), rr = A.wallRail(w.r, zr[0], zr[1], w.rail, w.railTop, plan.areas);
        field('rail', 'Railing on top', A.RAIL_KINDS[w.rail] ? w.rail : 'auto', 'select', Object.assign({ auto: 'Automatic' }, A.RAIL_KINDS));
        if (rr) field('railTop', 'Railing top (from floor)', rr.top);
        rows.push({ note: rr ? 'In 3D: ' + A.RAIL_KINDS[rr.kind].toLowerCase() + ' railing from the top of this wall up to ' + fmt(rr.top) + ' above the floor.'
          : w.rail === 'none' ? 'No railing on this wall.'
          : A.RAIL_KINDS[w.rail] ? 'No railing shows: the wall must start at the floor and be lower than the railing top.'
          : 'Automatic: a low wall (under 3 ft) along a terrace or balcony gets that area\'s railing on top.' });
      }
      rows.push({ note: x ? `Runs ${SIDE.xLow} to ${SIDE.xHigh}.` : 'Runs rear to front.' });
    } else if (sel.kind === 'op') {
      const o = it, w = plan.walls[sel.i], x = w.ax === 'x';
      title = TYPES[o.type];
      field('type', 'Type', o.type, 'select', TYPES);
      field('off', 'From wall start', o.a - lo(w));
      field('w', 'Width', o.b - o.a);
      if (o.type === 'win' || o.type === 'vent') field('sill', 'Sill height', o.sill);
      field('head', 'Top height', o.head);
      if (o.type === 'door' || o.type === 'gdoor') {
        field('swing', 'Opens toward', String(o.swing > 0 ? 1 : -1), 'select', x ? { '-1': `Rear (${SIDE.rear})`, 1: `Road (${SIDE.front})` } : { '-1': SIDE.xLow + ' side', 1: SIDE.xHigh + ' side' });
        field('leaves', 'Leaves', o.leaves === 2 ? '2' : '1', 'select', { 1: 'Single door', 2: 'Double door (two leaves)' });
        if (o.leaves !== 2) field('hinge', 'Hinge at', o.hinge || 'a', 'select', x ? { a: SIDE.xLow + ' side', b: SIDE.xHigh + ' side' } : { a: 'Rear side', b: 'Front side' });
        field('isOpen', 'Shown in 3D', o.isOpen ? '1' : '0', 'select', { 1: 'Open', 0: 'Closed' });
      }
      if ((o.sill || 0) > plan.H) rows.push({ note: 'This opening is on the floor above (the wall runs up through it).' });
      rows.push({ note: 'In wall "' + w.id + '".' });
    } else if (sel.kind === 'wardrobe') {
      const w = it;
      title = 'Wardrobe';
      field('id', 'Name', w.id, 'text');
      field('x', `X (${SIDE.xLow} side)`, w.r[0]);
      field('y', 'Y (rear side)', w.r[1]);
      field('pw', `Size ${SIDE.xLow} to ${SIDE.xHigh}`, w.r[2] - w.r[0]);
      field('pd', 'Size rear to front', w.r[3] - w.r[1]);
      field('face', 'Doors face', w.face || 'rear', 'select', { rear: `Rear (${SIDE.rear})`, front: `Road (${SIDE.front})`, north: SIDE.xLow + ' side', south: SIDE.xHigh + ' side' });
      field('tall', 'Height', w.h ? 'custom' : 'full', 'select', { full: 'Up to the ceiling', custom: 'Set a height' });
      if (w.h) field('wh', 'Wardrobe height', w.h);
      field('mirror', 'Mirror on doors', w.mirror ? '1' : '0', 'select', { 0: 'No', 1: 'Yes' });
      rows.push({ note: 'The heavy line on the plan is the door side.' });
    } else if (sel.kind === 'area') {
      const a = it, isVoid = a.kind === 'void';
      title = AREA_NAMES[a.kind] || 'Open area';
      field('name', 'Name', a.name, 'text');
      field('x', `X (${SIDE.xLow} edge)`, a.r[0]);
      field('y', 'Y (rear edge)', a.r[1]);
      field('pw', `Width (${SIDE.xLow} to ${SIDE.xHigh})`, a.r[2] - a.r[0]);
      field('pd', 'Depth (rear to front)', a.r[3] - a.r[1]);
      if (!isVoid && !GROUND && (a.kind === 'terrace' || a.kind === 'balcony')) {
        field('rail', 'Railing on open sides', A.RAIL_KINDS[a.rail] ? a.rail : 'jaali', 'select', A.RAIL_KINDS);
        if (a.rail !== 'none') field('railTop', 'Railing height', +a.railTop || A.RAIL_TOP);
        rows.push({ note: 'Low walls (parapets) along its edge carry the same railing on top, unless the wall is set otherwise.' });
      }
      rows.push({ note: isVoid ? 'The floor fills in wherever this opening is made smaller, and glass railing follows its edges. The main stair stays where it is.' : GROUND ? 'The paved floor follows this outline. A car porch sits 1\'-6" below the house floor; the steps and furniture do not move with it.' : 'The floor and the railing on its open sides follow this outline. Furniture on it does not move.' });
    } else {
      const p = it;
      title = 'Pillar';
      field('id', 'Name', p.id, 'text');
      field('x', `X (${SIDE.xLow} face)`, p.r[0]);
      field('y', 'Y (rear face)', p.r[1]);
      field('pw', `Width (${SIDE.xLow} to ${SIDE.xHigh})`, p.r[2] - p.r[0]);
      field('pd', 'Depth (rear to front)', p.r[3] - p.r[1]);
      field('kind', 'Height', p.z ? 'custom' : 'full', 'select', { full: 'Floor to ceiling', custom: 'Set bottom and top' });
      if (p.z) { const zr = zRange(p, [0, plan.H]); field('zb', 'Bottom', zr[0]); field('zt', 'Top', zr[1]); rows.push({ note: levelHint() }); }
    }
    if (sel.kind === 'through') { // a wall of the ground floor seen from the first floor: shown here, edited there
      const w = it, raw = (window.PLAN_DATA_GROUND.walls || []).find((q) => q.id === w.id);
      box.innerHTML = `<div class="what">Wall from the ground floor</div><p class="hint"><b>${String(w.id).replace(/</g, '&lt;')}</b> stands on the ground floor and rises up through this floor${raw && raw.z && raw.z[1] === 'ROOF' ? ' to the roof' : ''}. Its openings at this level are drawn here.</p><p class="hint">It belongs to the ground floor plan, so change it there.</p><div class="row"><a class="btn primary" href="editor.html?floor=ground&sel=${encodeURIComponent(w.id)}">Edit on the Ground floor tab</a></div>`;
      return;
    }
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    box.innerHTML = `<div class="what">${esc(title)}</div>` + rows.map((r) => {
      if (r.note) return `<p class="hint">${esc(r.note)}</p>`;
      const id = 'f-' + r.key;
      const input = r.kind === 'select'
        ? `<select id="${id}" data-key="${r.key}">${Object.keys(r.options).map((k) => `<option value="${k}"${String(r.value) === k ? ' selected' : ''}>${esc(r.options[k])}</option>`).join('')}</select>`
        : `<input id="${id}" data-key="${r.key}" data-kind="${r.kind}" type="text" value="${esc(r.kind === 'len' ? fmt(r.value) : r.value)}" autocomplete="off">`;
      return `<div class="field"><label for="${id}">${esc(r.label)}</label>${input}</div>`;
    }).join('') + '<div class="row" style="margin-top:10px"><button id="del" type="button" class="danger">Delete</button></div>';
    box.querySelectorAll('[data-key]').forEach((el) => el.addEventListener('change', () => apply(el)));
    $('del').addEventListener('click', removeSel);
  }

  function apply(el) {
    const key = el.dataset.key, it = item();
    if (!it) return;
    let v = el.value;
    if (el.dataset.kind === 'len') {
      v = parse(v);
      if (!isFinite(v)) { el.classList.add('bad'); return; }
    }
    checkpoint();
    if (sel.kind === 'wall') {
      const w = it, [s, e] = along(w), [t0, t1] = across(w), firstOp = Math.min(...ops(w).map((o) => o.a), Infinity), lastOp = Math.max(...ops(w).map((o) => o.b), -Infinity);
      if (key === 'id') w.id = String(v).trim() || w.id;
      if (key === 'start') w.r[s] = Math.min(v, firstOp, w.r[e] - 0.25);
      if (key === 'end') w.r[e] = Math.max(v, lastOp, w.r[s] + 0.25);
      if (key === 'len') w.r[e] = Math.max(w.r[s] + Math.max(0.25, v), lastOp);
      if (key === 'pos') { const th = w.r[t1] - w.r[t0]; w.r[t0] = v; w.r[t1] = v + th; }
      if (key === 'th') w.r[t1] = w.r[t0] + Math.max(0.1, v);
      if (key === 'kind') {
        if (v === 'low') w.z = [0, 3.5];
        else if (v === 'roof') w.z = [0, 'ROOF'];
        else if (v === 'custom') { const zr = zRange(w, [0, plan.H]); w.z = [zToken(zr[0]), zToken(zr[1])]; }
        else delete w.z;
      }
      if (key === 'top') w.z = [0, Math.max(0.5, v)];
      if (key === 'rail') { if (v === 'auto') delete w.rail; else w.rail = v; }
      if (key === 'railTop') { const t = Math.min(Math.max(v, 1), 8); if (Math.abs(t - A.RAIL_TOP) < 0.01) delete w.railTop; else w.railTop = r4(t); }
      if (key === 'zb' || key === 'zt') {
        const zr = zRange(w, [0, plan.H]);
        if (key === 'zb') zr[0] = Math.min(v, zr[1] - 0.25); else zr[1] = Math.max(v, zr[0] + 0.25);
        w.z = [zToken(zr[0]), zToken(zr[1])];
      }
    } else if (sel.kind === 'op') {
      const o = it, w = plan.walls[sel.i], [la, lb] = limits(w, sel.j), wd = o.b - o.a;
      if (key === 'type') {
        o.type = v;
        if (v === 'win') { o.sill = o.sill || 3; } else if (v === 'vent') { o.sill = o.sill || 6; o.head = Math.max(o.head, o.sill + 1); } else o.sill = 0;
        if (v === 'door' || v === 'gdoor') { o.hinge = o.hinge || 'a'; o.swing = o.swing || 1; if (o.isOpen === undefined) o.isOpen = true; }
      }
      if (key === 'off') { const a = Math.min(Math.max(lo(w) + v, la), lb - wd); o.a = a; o.b = a + wd; }
      if (key === 'w') o.b = Math.min(o.a + Math.max(0.5, v), lb);
      if (key === 'sill') o.sill = Math.min(Math.max(0, v), o.head - 0.5);
      if (key === 'head') o.head = Math.max(v, (o.sill || 0) + 0.5);
      if (key === 'hinge') o.hinge = v;
      if (key === 'swing') o.swing = +v;
      if (key === 'isOpen') o.isOpen = v === '1';
      if (key === 'leaves') { if (v === '2') o.leaves = 2; else delete o.leaves; }
    } else {
      const p = it, pw = p.r[2] - p.r[0], pd = p.r[3] - p.r[1];
      if (key === 'id') p.id = String(v).trim() || p.id;
      if (key === 'name') p.name = String(v).trim() || p.name;
      if (key === 'face') p.face = v;
      if (key === 'tall') { if (v === 'full') delete p.h; else p.h = 7; }
      if (key === 'wh') p.h = Math.min(Math.max(1, v), plan.H);
      if (key === 'mirror') { if (v === '1') p.mirror = true; else delete p.mirror; }
      if (key === 'rail') { if (v === 'jaali') delete p.rail; else p.rail = v; }
      if (key === 'railTop') { const t = Math.min(Math.max(v, 1), 8); if (Math.abs(t - A.RAIL_TOP) < 0.01) delete p.railTop; else p.railTop = r4(t); }
      if (sel.kind === 'pillar') {
        if (key === 'kind') { if (v === 'full') delete p.z; else { const zr = zRange(p, [0, plan.H]); p.z = [zToken(zr[0]), zToken(zr[1])]; } }
        if (key === 'zb' || key === 'zt') {
          const zr = zRange(p, [0, plan.H]);
          if (key === 'zb') zr[0] = Math.min(v, zr[1] - 0.25); else zr[1] = Math.max(v, zr[0] + 0.25);
          p.z = [zToken(zr[0]), zToken(zr[1])];
        }
      }
      if (key === 'x') { p.r[0] = v; p.r[2] = v + pw; }
      if (key === 'y') { p.r[1] = v; p.r[3] = v + pd; }
      if (key === 'pw') p.r[2] = p.r[0] + Math.max(0.25, v);
      if (key === 'pd') p.r[3] = p.r[1] + Math.max(0.25, v);
    }
    changed();
  }

  // --- adding and removing ----------------------------------------------------------------------
  function removeSel() {
    if (!sel || sel.kind === 'through') return;
    checkpoint();
    if (sel.kind === 'wall') plan.walls.splice(sel.i, 1);
    else if (sel.kind === 'op') plan.walls[sel.i].ops.splice(sel.j, 1);
    else if (sel.kind === 'wardrobe') plan.wardrobes.splice(sel.i, 1);
    else if (sel.kind === 'area') plan.areas.splice(sel.i, 1);
    else plan.pillars.splice(sel.i, 1);
    sel = null;
    changed();
  }
  function addOpening(type) {
    if (!sel || (sel.kind !== 'wall' && sel.kind !== 'op')) return;
    const i = sel.i, w = plan.walls[i], list = ops(w).slice().sort((p, q) => p.a - q.a);
    const gaps = [];
    let cur = lo(w);
    for (const o of list) { gaps.push([cur, o.a]); cur = o.b; }
    gaps.push([cur, hi(w)]);
    const mid = (lo(w) + hi(w)) / 2;
    let best = null;
    for (const want of [3, 2.5, 2, 1.5]) {
      for (const [a, b] of gaps) {
        if (b - a < want + 0.5) continue;
        const c = Math.min(Math.max(mid, a + 0.25 + want / 2), b - 0.25 - want / 2);
        if (!best || Math.abs(c - mid) < Math.abs(best.c - mid)) best = { c, want };
      }
      if (best) break;
    }
    if (!best) { $('addhint').textContent = 'There is no free stretch on this wall long enough. Shorten or remove an opening first.'; return; }
    checkpoint();
    const a = snap(best.c - best.want / 2), o = { type, a, b: a + best.want, sill: type === 'win' ? 3 : 0, head: BASE.DOOR };
    if (type === 'door' || type === 'gdoor') Object.assign(o, { hinge: 'a', swing: 1, isOpen: true });
    ops(w).push(o);
    sel = { kind: 'op', i, j: w.ops.length - 1 };
    changed();
  }
  const newId = (list, stem) => { let n = list.length + 1; while (list.some((x) => x.id === stem + '-' + n)) n++; return stem + '-' + n; };

  // --- pointer work --------------------------------------------------------------------------------
  function toPlan(e) {
    const b = svg.getBoundingClientRect();
    return { x: view.x + ((e.clientX - b.left) / b.width) * view.w, y: view.y + ((e.clientY - b.top) / b.height) * view.h };
  }
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const p = toPlan(e), t = e.target.closest ? e.target.closest('[data-kind]') : null;
    if (tool === 'wall') { drag = { mode: 'draw', x0: snap(p.x), y0: snap(p.y), r: null }; return; }
    if (tool === 'wardrobe') {
      checkpoint();
      const x = snap(p.x - 2), y = snap(p.y - 1);
      plan.wardrobes.push({ id: newId(plan.wardrobes, 'wardrobe'), r: [x, y, x + 4, y + 2], face: 'rear' });
      sel = { kind: 'wardrobe', i: plan.wardrobes.length - 1 };
      tool = 'select';
      changed();
      return;
    }
    if (tool === 'pillar') {
      checkpoint();
      const x = snap(p.x - 0.375), y = snap(p.y - 0.375);
      plan.pillars.push({ id: newId(plan.pillars, 'pillar'), r: [x, y, x + 0.75, y + 0.75] });
      sel = { kind: 'pillar', i: plan.pillars.length - 1 };
      tool = 'select';
      changed();
      return;
    }
    if (t && t.dataset.kind === 'handle') { drag = { mode: 'handle', h: t.dataset.h, start: p, orig: clone(item()), first: true }; return; }
    if (t && t.dataset.kind === 'area') {
      sel = { kind: 'area', i: +t.dataset.i };
      drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, still: true, keep: true };
      render(); panel();
      return;
    }
    if (t) {
      sel = { kind: t.dataset.kind, i: +t.dataset.i, j: t.dataset.j === undefined ? undefined : +t.dataset.j };
      drag = sel.kind === 'through' ? null : { mode: 'move', start: p, orig: clone(item()), first: true };
      render(); panel();
      return;
    }
    drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, still: true };
  });
  svg.addEventListener('pointermove', (e) => {
    const p = toPlan(e);
    $('coord').textContent = 'X ' + fmt(p.x) + '   Y ' + fmt(p.y);
    if (!drag) return;
    if (drag.mode === 'pan') {
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.hypot(dx, dy) > 4) { drag.still = false; svg.classList.add('pan'); }
      if (!drag.still) { view.x = drag.vx - dx * px(); view.y = drag.vy - dy * px(); render(); }
      return;
    }
    if (drag.mode === 'draw') {
      const x = snap(p.x), y = snap(p.y), th = +$('g-th').value;
      drag.ax = Math.abs(x - drag.x0) >= Math.abs(y - drag.y0) ? 'x' : 'y';
      drag.r = drag.ax === 'x' ? [Math.min(drag.x0, x), drag.y0, Math.max(drag.x0, x), drag.y0 + th] : [drag.x0, Math.min(drag.y0, y), drag.x0 + th, Math.max(drag.y0, y)];
      render();
      return;
    }
    const dx = snap(p.x - drag.start.x), dy = snap(p.y - drag.start.y);
    if (drag.first) { if (!dx && !dy) return; checkpoint(); drag.first = false; }
    const it = item(), o0 = drag.orig;
    if (drag.mode === 'move') {
      if (sel.kind === 'wall') {
        it.r = [o0.r[0] + dx, o0.r[1] + dy, o0.r[2] + dx, o0.r[3] + dy];
        const d = it.ax === 'x' ? dx : dy;
        (o0.ops || []).forEach((o, k) => { it.ops[k].a = o.a + d; it.ops[k].b = o.b + d; });
      } else if (sel.kind === 'op') {
        const w = plan.walls[sel.i], d = w.ax === 'x' ? dx : dy, wd = o0.b - o0.a;
        it.a = o0.a; it.b = o0.b;
        const [la, lb] = limits(w, sel.j), a = Math.min(Math.max(o0.a + d, la), lb - wd);
        it.a = a; it.b = a + wd;
      } else it.r = [o0.r[0] + dx, o0.r[1] + dy, o0.r[2] + dx, o0.r[3] + dy];
    } else { // handle
      if (sel.kind === 'wall') {
        const [s, e2] = along(it), d = it.ax === 'x' ? dx : dy;
        const firstOp = Math.min(...ops(it).map((o) => o.a), Infinity), lastOp = Math.max(...ops(it).map((o) => o.b), -Infinity);
        if (drag.h === 'a') it.r[s] = Math.min(o0.r[s] + d, firstOp, o0.r[e2] - 0.25);
        else it.r[e2] = Math.max(o0.r[e2] + d, lastOp, o0.r[s] + 0.25);
      } else if (sel.kind === 'op') {
        const w = plan.walls[sel.i], d = w.ax === 'x' ? dx : dy;
        it.a = o0.a; it.b = o0.b;
        const [la, lb] = limits(w, sel.j);
        if (drag.h === 'a') it.a = Math.min(Math.max(o0.a + d, la), o0.b - 0.5);
        else it.b = Math.max(Math.min(o0.b + d, lb), o0.a + 0.5);
      } else {
        const k = { x0: 0, y0: 1, x1: 2, y1: 3 }[drag.h], d = k % 2 ? dy : dx;
        it.r = o0.r.slice();
        it.r[k] = k < 2 ? Math.min(o0.r[k] + d, o0.r[k + 2] - 0.25) : Math.max(o0.r[k] + d, o0.r[k - 2] + 0.25);
      }
    }
    render(); panel();
  });
  function endDrag() {
    svg.classList.remove('pan');
    const d = drag;
    drag = null;
    if (!d) return;
    if (d.mode === 'pan') { if (d.still && sel && !d.keep) { sel = null; render(); panel(); } return; }
    if (d.mode === 'draw') {
      tool = 'select';
      if (d.r && Math.max(d.r[2] - d.r[0], d.r[3] - d.r[1]) >= 0.5) {
        checkpoint();
        plan.walls.push({ id: newId(plan.walls, 'wall'), ax: d.ax, r: d.r.map(r4) });
        sel = { kind: 'wall', i: plan.walls.length - 1 };
        changed();
      } else render();
      return;
    }
    if (!d.first) changed();
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  function zoom(f, cx, cy) {
    const nw = Math.min(160, Math.max(4, view.w * f)), k = nw / view.w;
    view.x = cx - (cx - view.x) * k; view.y = cy - (cy - view.y) * k; view.w = nw; view.h *= k;
    render();
  }
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const p = toPlan(e); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y); }, { passive: false });
  function fit() {
    const b = svg.getBoundingClientRect(), asp = b.width / Math.max(1, b.height), X0 = -6.5, X1 = 33.5, Y0 = -6, Y1 = 58;
    let w = X1 - X0, h = Y1 - Y0;
    if (w / h < asp) w = h * asp; else h = w / asp;
    view.x = (X0 + X1) / 2 - w / 2; view.y = (Y0 + Y1) / 2 - h / 2; view.w = w; view.h = h;
    render();
  }

  // --- buttons and keys ---------------------------------------------------------------------------------
  $('fit').addEventListener('click', fit);
  $('zin').addEventListener('click', () => zoom(1 / 1.3, view.x + view.w / 2, view.y + view.h / 2));
  $('zout').addEventListener('click', () => zoom(1.3, view.x + view.w / 2, view.y + view.h / 2));
  $('t-wall').addEventListener('click', () => { tool = tool === 'wall' ? 'select' : 'wall'; render(); });
  $('t-pillar').addEventListener('click', () => { tool = tool === 'pillar' ? 'select' : 'pillar'; render(); });
  $('t-wardrobe').addEventListener('click', () => { tool = tool === 'wardrobe' ? 'select' : 'wardrobe'; render(); });
  $('a-win').addEventListener('click', () => addOpening('win'));
  $('a-door').addEventListener('click', () => addOpening('door'));
  $('a-open').addEventListener('click', () => addOpening('open'));
  function doUndo() { if (!undo.length) return; redo.push(snapshot()); restore(undo.pop()); changed(); }
  function doRedo() { if (!redo.length) return; undo.push(snapshot()); restore(redo.pop()); changed(); }
  $('undo').addEventListener('click', doUndo);
  $('redo').addEventListener('click', doRedo);
  for (const id of ['g-img', 'g-op', 'g-rooms', 'g-other']) if ($(id)) $(id).addEventListener('input', render);
  // floor tabs and the texts that name the floor
  document.querySelectorAll('[data-floortab]').forEach((el) => {
    const g = el.dataset.floortab === 'ground';
    el.classList.toggle('on', g === GROUND);
    if (g && !window.PLAN_DATA_GROUND) el.style.display = 'none';
  });
  document.querySelectorAll('.floorname').forEach((el) => { el.textContent = GROUND ? 'Ground floor' : 'First floor'; });
  document.querySelectorAll('.planfile').forEach((el) => { el.textContent = 'js/' + FILE; });
  document.querySelectorAll('.editorurl').forEach((el) => { el.textContent = 'http://localhost:8765/editor.html' + QS; });
  document.body.classList.toggle('ground', GROUND);
  $('g-h').addEventListener('change', () => {
    const v = parse($('g-h').value);
    if (!isFinite(v) || v < 8 || v > 20) { $('g-h').classList.add('bad'); return; }
    $('g-h').classList.remove('bad');
    checkpoint(); plan.H = r4(v); $('g-h').value = fmt(plan.H); changed();
  });
  $('reset').addEventListener('click', () => {
    if (!window.confirm('Discard every change made in this editor and go back to the original plan?')) return;
    if (disk) {
      post('api/reset' + QS).then(() => { try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ } location.reload(); });
      return;
    }
    checkpoint(); plan = pick(BASE); sel = null; $('g-h').value = fmt(plan.H); changed();
  });
  $('download').addEventListener('click', () => {
    tidy();
    const lines = [
      '/* Floor plan saved from the plan editor on ' + new Date().toISOString().slice(0, 10) + '.',
      '   Replace walkthrough/js/' + FILE + ' with this file. Units are feet; see the editor for the axes. */',
      'window.' + VAR + ' = {', '  version: ' + BASE.version + ',', '  H: ' + plan.H + ',', '  SLAB: ' + BASE.SLAB + ',', '  DOOR: ' + BASE.DOOR + ',',
      '  walls: [', plan.walls.map((w) => '    ' + JSON.stringify(w)).join(',\n'), '  ],',
      '  pillars: [', plan.pillars.map((p) => '    ' + JSON.stringify(p)).join(',\n'), '  ],',
      '  areas: [', plan.areas.map((p) => '    ' + JSON.stringify(p)).join(',\n'), '  ],',
      '  wardrobes: [', plan.wardrobes.map((p) => '    ' + JSON.stringify(p)).join(',\n'), '  ]', '};', '',
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/javascript' }));
    a.download = FILE;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  window.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
    if (typing) return;
    if (e.key === 'Escape') { tool = 'select'; sel = null; drag = null; render(); panel(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); removeSel(); return; }
    const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (arrow && sel && sel.kind !== 'through') {
      e.preventDefault();
      const st = (snapStep() || 1 / 12) * (e.shiftKey ? 6 : 1), dx = arrow[0] * st, dy = arrow[1] * st, it = item();
      checkpoint();
      if (sel.kind === 'op') {
        const w = plan.walls[sel.i], d = w.ax === 'x' ? dx : dy, wd = it.b - it.a, [la, lb] = limits(w, sel.j), a = Math.min(Math.max(it.a + d, la), lb - wd);
        it.a = a; it.b = a + wd;
      } else {
        it.r = [it.r[0] + dx, it.r[1] + dy, it.r[2] + dx, it.r[3] + dy];
        if (sel.kind === 'wall') { const d = it.ax === 'x' ? dx : dy; ops(it).forEach((o) => { o.a += d; o.b += d; }); }
      }
      changed();
    }
  });
  window.addEventListener('resize', fit);

  // exposed for checking
  A.editor = { floor: GROUND ? 'ground' : 'first', get plan() { return plan; }, get sel() { return sel; }, select: (s) => { sel = s; render(); panel(); }, fmt, parse };

  $('g-h').value = fmt(plan.H);
  fit();
  save(true);
  { const want = new URLSearchParams(location.search).get('sel'), wi = want ? plan.walls.findIndex((w) => w.id === want) : -1; if (wi >= 0) sel = { kind: 'wall', i: wi }; }
  render();
  panel();
  // always open the walkthrough fresh, never a remembered copy of the page
  document.querySelectorAll('a[href="index.html"]').forEach((el) => el.addEventListener('click', () => { el.href = 'index.html?t=' + Date.now(); }));
  // Is the local server there to write the plan file?
  const differs = browserCopy && JSON.stringify(browserCopy) !== JSON.stringify(pick(BASE));
  function useBrowserCopy() { checkpoint(); plan = browserCopy; browserCopy = null; $('g-h').value = fmt(plan.H); changed(); }
  function dropBrowserCopy() { browserCopy = null; try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ } showStatus(true); }
  fetch('api/ping' + QS).then((r) => r.json()).then((j) => {
    checked = true;
    if (!j || !j.canSave) { if (browserCopy) useBrowserCopy(); else showStatus(true); return; }
    disk = true;
    fileStamp = j.stamp || '';
    showStatus(true);
    if (differs) { // an unsaved copy from earlier: the plan file wins unless asked otherwise
      $('status').innerHTML = '<b>The plan file is open.</b> This browser also kept an unsaved copy from earlier, which differs from the file. <button type="button" id="usecopy">Use the browser copy</button> <button type="button" id="dropcopy">Discard it</button>';
      $('usecopy').addEventListener('click', useBrowserCopy);
      $('dropcopy').addEventListener('click', dropBrowserCopy);
    } else if (browserCopy) dropBrowserCopy();
  }).catch(() => { checked = true; if (browserCopy) useBrowserCopy(); else showStatus(true); /* opened as a plain file: browser storage only */ });
})();
