/* Turns the editable plans (plan-data.js for the first floor, plan-data-ground.js
   for the ground floor, or the copies saved by the plan editor in this browser)
   into everything the 3D model needs. Units are feet; see plan-data.js for the
   axes. Heights are measured up from the first floor finish, so the ground floor
   sits at a negative height (GF). */
(function () {
  const A = (window.APP = window.APP || {});
  const KEY = 'arch.plan.firstfloor', GKEY = 'arch.plan.ground';
  A.PLAN_KEY = KEY;
  A.PLAN_KEY_G = GKEY;

  // Used when a plan file or a saved copy has no "areas" list yet.
  A.DEFAULT_AREAS = [
    { id: 'void', name: 'Double Height', kind: 'void', r: [9.375, 14.625, 26.125, 24.375] },
    { id: 'terrace', name: 'Terrace', kind: 'terrace', r: [0, 28.625, 8.875, 39] },
    { id: 'terrace-strip', name: 'Terrace', kind: 'terrace', r: [5.39, 39, 8.875, 47] },
    { id: 'front-balcony', name: 'Front Balcony', kind: 'balcony', r: [5.39, 47, 30.375, 50.54] },
    { id: 'rear-balcony', name: 'Rear Balcony', kind: 'balcony', r: [-3.5, -2, 30.375, 0] },
    { id: 'north-balcony', name: 'Rear Balcony', kind: 'balcony', r: [-3.5, 0, -1, 14.625] },
  ];

  A.DEFAULT_WARDROBES = [
    { id: 'dress-wardrobe-1', r: [22.625, 44.25, 29.25, 46.25], face: 'rear' },
    { id: 'dress-wardrobe-2', r: [27.25, 38.25, 29.25, 44.25], face: 'north', mirror: true },
  ];

  // --- pick the plans: the editor's saved copy wins, unless ?original=1 --------
  A.planEdited = false;
  function chosen(base, key) {
    if (!base) return null;
    try {
      const q = new URLSearchParams(location.search);
      // A copy kept in the browser is only used when the pages are opened as plain files (no local
      // server to save to). With the server running, the plan files are always the record.
      const s = window.PLAN_STANDALONE || q.get('original') === '1' || location.protocol !== 'file:' ? null : localStorage.getItem(key);
      if (s) {
        const o = JSON.parse(s);
        if (o && o.version === base.version && Array.isArray(o.walls) && Array.isArray(o.pillars)) {
          A.planEdited = true;
          return Object.assign({}, base, { H: o.H, walls: o.walls, pillars: o.pillars, areas: o.areas || base.areas, wardrobes: o.wardrobes || base.wardrobes });
        }
      }
    } catch (err) { /* storage not available: use the file as it is */ }
    return base;
  }
  const D = chosen(window.PLAN_DATA, KEY);
  const G = chosen(window.PLAN_DATA_GROUND || null, GKEY);   // null when the home has no ground floor drawing

  const H = +D.H || 11;                 // first floor: floor to ceiling
  const SLAB = D.SLAB;                  // slab thickness (assumed)
  const HG = G ? +G.H || H : H;         // ground floor: floor to ceiling
  const GF = -(HG + SLAB);              // ground floor level below the first floor
  const PORCH = -1.5;                   // car porch, below the ground floor finish
  const DOOR = D.DOOR;                  // door and window head height (assumed)
  const zval = (v) => (v === 'GF' ? GF : v === 'H' ? H : v === 'TOP' ? H + SLAB : v === '-SLAB' ? -SLAB : +v);
  // With a real ground floor below, first-floor pieces stop at the underside of their own slab.
  const zr = (z) => { const o = z ? [zval(z[0]), zval(z[1])] : [0, H]; if (G && o[0] < -SLAB) o[0] = -SLAB; return o; };

  const walls = D.walls.filter((w) => !(G && w.hidden)).map((w) => ({
    id: w.id, ax: w.ax, r: w.r.slice(), z: zr(w.z), base: 0, mat: w.mat || 'wall', rail: w.rail, railTop: w.railTop,
    ops: (w.ops || []).map((o) => Object.assign({}, o, { head: Math.min(o.head, zr(w.z)[1]) })),
  })).filter((w) => w.z[1] - w.z[0] > 0.01);
  const pillars = D.pillars.map((p) => ({ id: p.id, r: p.r.slice(), z: zr(p.z), mat: p.mat || 'wall' }));
  const areaList = (D.areas || A.DEFAULT_AREAS).map((a) => ({ id: a.id, name: a.name || a.id, kind: a.kind, r: a.r.slice(), rail: a.rail, railTop: a.railTop }));
  const areaById = {};
  for (const a of areaList) areaById[a.id] = a;
  // Wardrobes: footprint, the side the doors are on, and height (ceiling if not given).
  const wardrobes = (D.wardrobes || A.DEFAULT_WARDROBES).map((w) => ({ id: w.id, r: w.r.slice(), face: w.face || 'rear', h: Math.min(+w.h || H, H), mirror: !!w.mirror }));
  const voids = areaList.filter((a) => a.kind === 'void');
  const outdoor = areaList.filter((a) => a.kind !== 'void');

  // --- small rectangle kit ----------------------------------------------------
  const inRect = (x, y, r) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
  function subtract(rects, hole) {
    const out = [];
    for (const r of rects) {
      const x0 = Math.max(r[0], hole[0]), y0 = Math.max(r[1], hole[1]), x1 = Math.min(r[2], hole[2]), y1 = Math.min(r[3], hole[3]);
      if (x1 <= x0 + 1e-6 || y1 <= y0 + 1e-6) { out.push(r); continue; }
      if (r[1] < y0) out.push([r[0], r[1], r[2], y0]);
      if (y1 < r[3]) out.push([r[0], y1, r[2], r[3]]);
      if (r[0] < x0) out.push([r[0], y0, x0, y1]);
      if (x1 < r[2]) out.push([x1, y0, r[2], y1]);
    }
    return out;
  }
  const uniq = (list) => Array.from(new Set(list.map((v) => Math.round(v * 1000) / 1000))).sort((a, b) => a - b);

  /* Railings, set in the editor. Kinds: 'jaali' (pattern panel, the default), 'glass',
     'bars' (metal bars) or 'none'.
     - A terrace or balcony puts its kind on its open sides (area.rail), up to area.railTop.
     - A wall can carry one on top (wall.rail), up to wall.railTop. Left on automatic, a low
       wall (a parapet under 3 ft) along a terrace or balcony takes that area's railing.
     Heights are above the floor; 3'-6" when not given. */
  A.RAIL_KINDS = { jaali: 'Jaali (pattern panel)', glass: 'Glass', bars: 'Metal bars', none: 'None' };
  A.RAIL_TOP = 3.5;
  // The railing on top of a wall: { kind, top } or null. z0 / z1 / railTop are feet above that floor.
  A.wallRail = function (r, z0, z1, rail, railTop, areas) {
    if (rail === 'none' || z0 > 0.5) return null;
    let kind = rail, top = +railTop || 0;
    if (!A.RAIL_KINDS[kind]) { // automatic
      if (z1 >= 3 || z1 < 0.75) return null;
      let best = null, most = 0;
      for (const a of areas || []) { // the terrace or balcony this parapet edges (the one it overlaps most)
        if (a.kind !== 'terrace' && a.kind !== 'balcony') continue;
        const ox = Math.min(r[2], a.r[2] + 0.6) - Math.max(r[0], a.r[0] - 0.6), oy = Math.min(r[3], a.r[3] + 0.6) - Math.max(r[1], a.r[1] - 0.6);
        if (ox > 0 && oy > 0 && ox * oy > most) { most = ox * oy; best = a; }
      }
      if (!best || best.rail === 'none') return null;
      kind = A.RAIL_KINDS[best.rail] ? best.rail : 'jaali';
      top = top || +best.railTop || 0;
    }
    top = top || A.RAIL_TOP;
    return top > z1 + 0.25 ? { kind, top } : null;
  };
  /* Edges of a set of floor rectangles that need a railing. needsRail(x, y, nx, ny)
     is asked about each edge piece, n being the direction away from the floor.
     Returns [{ dir, c, a, b, n }]: dir "y" runs along Y at X = c, dir "x" along X at Y = c. */
  function boundary(rects, needsRail, cutsX, cutsY) {
    const xs = uniq(rects.flatMap((r) => [r[0], r[2]]).concat(cutsX || [])), ys = uniq(rects.flatMap((r) => [r[1], r[3]]).concat(cutsY || []));
    const inside = (x, y) => rects.some((r) => inRect(x, y, r));
    const raw = [], e = 0.03;
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      if (!inside(cx, cy)) continue;
      if (!inside(xs[i] - e, cy) && needsRail(xs[i], cy, -1, 0)) raw.push(['y', xs[i], ys[j], ys[j + 1], -1]);
      if (!inside(xs[i + 1] + e, cy) && needsRail(xs[i + 1], cy, 1, 0)) raw.push(['y', xs[i + 1], ys[j], ys[j + 1], 1]);
      if (!inside(cx, ys[j] - e) && needsRail(cx, ys[j], 0, -1)) raw.push(['x', ys[j], xs[i], xs[i + 1], -1]);
      if (!inside(cx, ys[j + 1] + e) && needsRail(cx, ys[j + 1], 0, 1)) raw.push(['x', ys[j + 1], xs[i], xs[i + 1], 1]);
    }
    raw.sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : p[1] - q[1] || p[4] - q[4] || p[2] - q[2]));
    const out = [];
    for (const s of raw) {
      const last = out[out.length - 1];
      if (last && last.dir === s[0] && Math.abs(last.c - s[1]) < 1e-6 && last.n === s[4] && Math.abs(last.b - s[2]) < 1e-6) last.b = s[3];
      else out.push({ dir: s[0], c: s[1], a: s[2], b: s[3], n: s[4] });
    }
    return out;
  }

  // --- fixed parts of the building (not in the editor) -----------------------
  const ZONE = [-0.375, 14.625, 30.375, 27.875];   // lounge + gallery + void + main stair
  const STAIRWELL = [[20.29, 24.375, 30.375, 27.875], [26.125, 14.625, 30.375, 24.375]];
  // Floor of the middle zone: everything that is not the void or the stairwell.
  let midFloor = [ZONE];
  for (const v of voids) midFloor = subtract(midFloor, v.r);
  for (const s of STAIRWELL) midFloor = subtract(midFloor, s);

  const indoorSlabs = [
    [-1, 0, 30.375, 14.625],          // rear block
    [-0.375, 27.875, 8.875, 28.625],  // under the lounge / terrace wall
    [8.875, 27.875, 30.375, 47],      // master suite
  ];
  // Structural slab pieces (top just below finish level).
  const slabs = indoorSlabs.concat(midFloor, outdoor.map((a) => a.r));
  // The front stair (drawn on the ground floor) climbs to a landing beside the front
  // balcony at first floor level, then on to the roof.
  const FRONT_LANDING = G ? [19, 47, 22.13, 52.75] : null;   // runs through the opening in the stair's north wall to the balcony
  if (FRONT_LANDING) slabs.push(FRONT_LANDING);

  // Finish floors of the rooms: [x0, y0, x1, y1, material]. The whole house has the living
  // room's tile ('marble', which each style sets), bedrooms and toilets included.
  const roomFloors = [
    [-0.25, 0.375, 19.25, 14.25, 'marble'],       // living and dining
    [-0.25, 14.25, 13.72, 14.625, 'marble'],      // where the wall to the lounge was taken out
    [19.25, 0.75, 29.625, 7.75, 'marble'],        // kitchen
    [27.125, 7.75, 29.625, 14.25, 'marble'],      // kitchen utility leg
    [19.2085, 8.125, 26.75, 14.25, 'marble'],     // common washroom
    [9.25, 28.25, 22.25, 46.25, 'marble'],        // master bedroom
    [22.625, 38.25, 29.625, 46.25, 'marble'],     // dress
    [22.625, 28.25, 29.625, 37.875, 'marble'],    // master toilet
  ];
  const floors = roomFloors
    .concat(midFloor.map((r) => [r[0], r[1], r[2], r[3], 'marble']))
    .concat(outdoor.map((a) => [a.r[0], a.r[1], a.r[2], a.r[3], a.kind === 'terrace' ? 'deck' : 'stonefloor']));

  if (FRONT_LANDING) floors.push(FRONT_LANDING.concat('stonefloor'));
  // Ceilings at H, plus a roof projection over the front balcony.
  const ceilings = [
    [-1, 0, 30.375, 14.625],
    [-0.375, 14.625, 30.375, 27.875],
    [-0.375, 27.875, 8.875, 28.625],
    [8.875, 27.875, 30.375, 47],
  ];
  const fb = areaById['front-balcony'];
  if (fb && fb.r[3] > 47.5) ceilings.push([Math.max(8.875, fb.r[0]), 47, fb.r[2], fb.r[3] + 0.36]);

  // Main stair between the floors: 20 risers, three flights round the void.
  const RISE = (HG + SLAB) / 20, TREAD = 10 / 12;

  // Rooms, for captions and the map.
  const ft = (v) => { const t = Math.round(Math.abs(v) * 24), f = Math.floor(t / 24), h = t - f * 24; return f + "'-" + Math.floor(h / 2) + (h % 2 ? '½' : '') + '"'; };
  const rooms = [
    { name: 'Living & Dining', size: "19'-6\" × 13'-10½\", open to the lounge", r: [-0.25, 0.375, 19.25, 14.625] },
    { name: 'Kitchen', size: "10'-4½\" × 7'-0\" + utility 2'-6\" × 6'-6\"", r: [19.25, 0.75, 29.625, 7.75] },
    { name: 'Kitchen', size: "10'-4½\" × 7'-0\" + utility 2'-6\" × 6'-6\"", r: [27.125, 7.75, 29.625, 14.25] },
    { name: 'Common Washroom', size: "7'-6\" × 6'-1½\"", r: [19.2085, 8.125, 26.75, 14.25] },
    { name: 'Master Bedroom', size: "13'-0\" × 18'-0\"", r: [9.25, 28.25, 22.25, 46.25] },
    { name: 'Dress', size: "7'-0\" × 8'-0\"", r: [22.625, 38.25, 29.625, 46.25] },
    { name: 'Master Toilet', size: "7'-0\" × 9'-7½\"", r: [22.625, 28.25, 29.625, 37.875] },
  ];
  for (const a of areaList) rooms.push({ name: a.name, size: ft(a.r[2] - a.r[0]) + ' × ' + ft(a.r[3] - a.r[1]), r: a.r, area: true });
  rooms.push(
    { name: 'Main Stair', size: "3'-6\" wide", r: [20.29, 24.375, 29.625, 27.875] },
    { name: 'Main Stair', size: "3'-6\" wide", r: [23.6, 14.625, 29.625, 24.375] },
    { name: 'Family Lounge', size: "12'-10\" × 13'-3\"", r: [0.375, 14.625, 13.2, 27.875] },
    { name: 'Gallery', size: "beside the double height", r: [9.375, 14.625, 29.625, 27.875] }
  );
  if (FRONT_LANDING) rooms.unshift({ name: 'Front Stair', size: 'ground floor, balcony and roof', r: [19.375, 47, 29.625, 52.75] });

  /* Where there is a floor to stand on: [x0, y0, x1, y1, height]. Height may be
     a function of (x, y) on the stairs. Walls, railings and furniture are
     checked separately, so these are the plain floor areas. */
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const f1 = (x) => -clamp01((x - 20.29) / 5.835) * 8 * RISE;
  const f2 = (x, y) => -8 * RISE - clamp01((23.96 - y) / 5.835) * 8 * RISE;
  const f3 = (x) => -16 * RISE - clamp01((26.125 - x) / 2.5) * 4 * RISE;
  const areas = slabs.map((s) => [s[0], s[1], s[2], s[3], 0]).concat([
    [20.29, 24.375, 26.125, 27.875, f1],      // main stair, top flight
    [26.125, 23.96, 29.625, 27.875, -8 * RISE],
    [26.125, 18.125, 29.625, 23.96, f2],
    [26.125, 14.625, 29.625, 18.125, -16 * RISE],
    [23.62, 14.625, 26.125, 18.125, f3],
  ]);
  if (!G) areas.push([9.375, 14.625, 23.62, 27.875, GF], [23.62, 18.125, 26.125, 27.875, GF]); // placeholder room under the void

  /* Solid pieces a person cannot walk through, worked out from the walls:
     [x0, y0, x1, y1, bottom, top]. Open doors and cased openings leave a gap. */
  const solids = [];
  function addSolids(wallList, pillarList) {
    for (const w of wallList) {
      const [x0, y0, x1, y1] = w.r, [z0, z1] = w.z, base = w.base || 0;
      const lo = w.ax === 'x' ? x0 : y0, hi = w.ax === 'x' ? x1 : y1;
      const piece = (a, b, za, zb) => { if (b - a > 1e-4 && zb - za > 1e-4) solids.push(w.ax === 'x' ? [a, y0, b, y1, za, zb] : [x0, a, x1, b, za, zb]); };
      // cut the wall at every opening edge; in each stretch, leave out the open (walkable) heights
      const cuts = Array.from(new Set([lo, hi].concat(w.ops.flatMap((o) => [o.a, o.b])).filter((v) => v >= lo && v <= hi))).sort((p, q) => p - q);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1], mid = (a + b) / 2;
        const holes = w.ops.filter((o) => o.a < mid && o.b > mid && (o.type === 'open' || ((o.type === 'door' || o.type === 'gdoor') && o.isOpen)))
          .map((o) => [base + (o.sill || 0), base + o.head]).sort((p, q) => p[0] - q[0]);
        let cur = z0;
        for (const [h0, h1] of holes) { piece(a, b, cur, Math.max(cur, h0)); cur = Math.max(cur, h1); }
        piece(a, b, cur, z1);
      }
    }
    for (const p of pillarList) solids.push([p.r[0], p.r[1], p.r[2], p.r[3], p.z[0], p.z[1]]);
  }
  addSolids(walls, pillars);

  // --- railings, worked out from the floor edges ------------------------------
  // Glass railing wherever first-floor floor meets the void or the stairwell,
  // except across the top step of the main stair.
  const holes = voids.map((v) => v.r).concat(STAIRWELL);
  const glass = boundary(midFloor, (x, y, nx, ny) => {
    const qx = x + nx * 0.05, qy = y + ny * 0.05;
    if (!holes.some((h) => inRect(qx, qy, h))) return false;
    if (nx === 1 && Math.abs(x - 20.29) < 0.01 && y > 24.375 && y < 27.875) return false;
    return true;
  });
  // Railing on every open edge of a terrace or balcony, of the kind chosen for that area:
  // not where it meets the building, another open area, or a wall / parapet / pillar (a
  // parapet lower than the railing carries its own railing on top, below).
  const guards = walls.concat(pillars).filter((w) => w.z[0] < 0.5 && w.z[1] >= 1).map((w) => w.r);
  const edge = [];
  for (const kind of ['jaali', 'glass', 'bars']) {
    const segs = boundary(outdoor.map((a) => a.r), (x, y, nx, ny) => {
      const ox = x + nx * 0.1, oy = y + ny * 0.1, ix = x - nx * 0.1, iy = y - ny * 0.1;
      if (slabs.some((s) => inRect(ox, oy, s))) return false;
      if (guards.some((g) => inRect(ox, oy, g) || inRect(ix, iy, g))) return false;
      const own = outdoor.find((a) => inRect(ix, iy, a.r));
      return !!own && (A.RAIL_KINDS[own.rail] ? own.rail : 'jaali') === kind;
    }, guards.flatMap((g) => [g[0], g[2]]), guards.flatMap((g) => [g[1], g[3]]));
    for (const s of segs) {
      const mx = s.dir === 'y' ? s.c - s.n * 0.1 : (s.a + s.b) / 2, my = s.dir === 'y' ? (s.a + s.b) / 2 : s.c - s.n * 0.1;
      const own = outdoor.find((a) => inRect(mx, my, a.r));
      edge.push(Object.assign(s, { kind, top: (own && +own.railTop) || A.RAIL_TOP }));
    }
  }
  const jaali = edge.filter((s) => s.kind === 'jaali');
  /* Railings on top of walls: [{ ax, r, z0, z1, kind, grp }], z in model heights.
     base = the floor level the wall stands on. */
  const wallRails = [];
  function railsOnWalls(list, base, areaSet, grp) {
    for (const w of list) {
      const rr = A.wallRail(w.r, w.z[0] - base, w.z[1] - base, w.rail, w.railTop, areaSet);
      if (rr) wallRails.push({ id: w.id, ax: w.ax, r: w.r, z0: w.z[1], z1: base + rr.top, kind: rr.kind, grp });
    }
  }
  railsOnWalls(walls, 0, areaList, 'main');

  const v0 = voids[0];
  const voidCenter = v0 ? [(v0.r[0] + Math.min(v0.r[2], 24.5)) / 2, (v0.r[1] + v0.r[3]) / 2] : [17, 19.6];

  // ===== ground floor ===========================================================
  let ground = null;
  if (G) {
    const gv = (v) => (v === 'H' ? HG : v === 'PORCH' ? PORCH : v === 'TOP' ? HG + SLAB : v === 'ROOF' ? HG + SLAB + H + SLAB : +v);
    const gzr = (z) => (z ? [GF + gv(z[0]), GF + gv(z[1])] : [GF, GF + HG]);
    const gwalls = G.walls.map((w) => {
      const z = gzr(w.z);
      return { id: w.id, ax: w.ax, r: w.r.slice(), z, base: GF, grp: 'gmain', mat: w.mat || 'wall', rail: w.rail, railTop: w.railTop, clad: w.clad,
        ops: (w.ops || []).map((o) => Object.assign({}, o, { head: Math.min(o.head, z[1] - GF) })) };
    });
    const gpillars = G.pillars.map((p) => ({ id: p.id, r: p.r.slice(), z: gzr(p.z), mat: p.mat || 'wall', grp: 'gmain', clad: p.clad }));
    const gareas = (G.areas || []).map((a) => ({ id: a.id, name: a.name || a.id, kind: a.kind, r: a.r.slice(), lvl: GF + (a.kind === 'porch' ? PORCH : 0) }));
    const gwardrobes = (G.wardrobes || []).map((w) => ({ id: w.id, r: w.r.slice(), face: w.face || 'rear', h: Math.min(+w.h || HG, HG), mirror: !!w.mirror }));

    // Solid base under the building, up to the floor finish.
    const indoor = [[-1, 0, 30.375, 14.625], [-0.375, 14.625, 30.375, 28.625], [7.75, 28.625, 30.375, 39], [15.875, 39, 30.375, 47]];
    const plinth = [[19, 47, 30.375, 53.5]].concat(gareas.filter((a) => a.kind !== 'porch').map((a) => a.r));
    // Finish floors of the rooms: [x0, y0, x1, y1, material]. One tile through the house, as in the living room.
    const gRoomFloors = [
      [0.375, 14.625, 29.625, 27.875, 'marble'],      // living / dining hall
      [-0.25, 4.75, 12.885, 14.25, 'marble'],         // children's bedroom
      [-0.25, 0.375, 4.75, 4.375, 'marble'],          // pooja
      [13.26, 0.75, 19.25, 4.375, 'marble'],          // store
      [15.26, 4.375, 19.25, 6.38, 'marble'],
      [13.26, 9.5, 19.25, 14.25, 'marble'],           // common toilet
      [15.26, 6.75, 19.25, 9.5, 'marble'],            // w.c.
      [19.625, 0.75, 29.625, 14.25, 'marble'],        // guest bedroom
      [8.5, 28.25, 15.875, 38.25, 'marble'],          // kitchen
      [16.25, 28.25, 19.75, 33.25, 'marble'],         // passage
      [20.125, 28.25, 29.625, 33.25, 'marble'],       // toilet (the duct was taken out)
      [16.25, 33.25, 19.75, 33.625, 'marble'],        // passage opens into the master bedroom
      [16.25, 33.625, 29.25, 46.25, 'marble'],        // master bedroom
    ];
    // Steps between the porch and the raised floor: [x0, y0, x1, y1, top above the ground floor].
    // The walkway's two steps go down from its front end, wherever the editor puts it.
    const wk = gareas.find((a) => a.id === 'walkway'), wy = wk ? wk.r[3] : 49.14, wx0 = wk ? wk.r[0] : 12, wx1 = wk ? wk.r[2] : 15.875;
    const steps = [
      [0.375, 33.13, 7.75, 33.965, -0.5], [0.375, 33.965, 7.75, 34.8, -1.0],
      [wx0, wy, wx1, wy + 0.83, -0.5], [wx0, wy + 0.83, wx1, wy + 1.66, -1.0],
    ];
    const sq = (w, d) => Math.round(w * d) + ' sq ft';
    const grooms = [
      { name: 'Living / Dining Hall', size: "25'-4½\" × 13'-3\" · " + sq(25.375, 13.25), r: [0.375, 14.625, 29.625, 27.875] },
      { name: "Children's Bedroom", size: "13'-1½\" × 9'-6\" · " + sq(13.125, 9.5), r: [-0.25, 4.75, 12.885, 14.25] },
      { name: 'Pooja', size: "5'-0\" × 4'-0\" · 20 sq ft", r: [-0.25, 0.375, 4.75, 4.375] },
      { name: 'Store', size: "6'-0\" × 3'-7½\"", r: [13.26, 0.75, 19.25, 6.38] },
      { name: 'Common Toilet', size: "6'-0\" × 4'-9\" + W.C. 4'-0\" × 2'-9\"", r: [13.26, 6.75, 19.25, 14.25] },
      { name: 'Guest Bedroom', size: "10'-0\" × 11'-6\" · " + sq(10, 11.5), r: [19.625, 0.75, 29.625, 14.25] },
      { name: 'Kitchen', size: "7'-4½\" × 10'-0\" · " + sq(7.375, 10), r: [8.5, 28.25, 15.875, 38.25] },
      { name: 'Passage', size: "3'-6\" wide", r: [16.25, 28.25, 19.75, 33.25] },
      { name: 'Toilet', size: "9'-6\" × 5'-0\" · " + sq(9.5, 5), r: [20.125, 28.25, 29.625, 33.25] },
      { name: 'Master Bedroom', size: "13'-0\" × 10'-7½\" · " + sq(13, 10.625), r: [16.25, 33.625, 29.25, 46.25] },
    ];
    // the car porch is drawn as a few rectangles: its caption gives the whole porch, as on the drawing
    for (const a of gareas) grooms.push({ name: a.name, size: a.kind === 'porch' ? "11'-7½\" × 14'-6\" · 169 sq ft" : ft(a.r[2] - a.r[0]) + ' × ' + ft(a.r[3] - a.r[1]), r: a.r, area: true });
    grooms.push({ name: 'Front Stair', size: 'to the first floor and the roof', r: [19, 47, 29.625, 52.75] });
    const FRONT_DIR = window.SITE ? window.SITE.sides.front.name : 'W';   // the road side, from the site file
    grooms.push({ name: 'Road', size: "in front of the house (" + FRONT_DIR + ") · plot 30' × 54'-6\"", r: [-40, 54.5, 70, 78] });

    // Where you can stand on the ground floor.
    const ramp = (y0, y1) => (x, y) => GF + PORCH * clamp01((y - y0) / (y1 - y0));
    areas.push(
      [-0.25, 0.375, 29.625, 14.625, GF],             // rear block
      [0.375, 14.25, 23.62, 28.625, GF],              // hall, up to the foot of the main stair
      [23.62, 18.125, 26.125, 28.25, GF],
      [7.75, 27.875, 29.625, 39, GF],                 // kitchen, passage, toilet
      [15.875, 39, 29.625, 46.25, GF],                // master bedroom
      [0.375, 33.13, 7.75, 34.8, ramp(33.13, 34.8)],  // lobby steps
      [wx0, wy, wx1, wy + 1.66, ramp(wy, wy + 1.66)]  // walkway steps
    );
    for (const a of gareas) areas.push([a.r[0], a.r[1], a.r[2], a.r[3], a.lvl]);
    const ROAD = GF + PORCH - 0.25;                                // road surface, a little below the porch
    areas.push([-40, 54.5, 70, 78, ROAD]);
    for (const [tx, ty, ts] of [[-12, 58, 0.8], [40, 58.5, 0.9]]) solids.push([tx - 0.75 * ts, ty - 0.75 * ts, tx + 0.75 * ts, ty + 0.75 * ts, ROAD - 1, ROAD + 9]);
    addSolids(gwalls, gpillars);
    railsOnWalls(gwalls, GF, gareas, 'gmain'); // ground floor: only railings chosen in the editor
    /* Front stair: two runs, each a flight heading south, three winders and a
       flight heading back north. The first run reaches the landing beside the
       front balcony, the second the roof. */
    const TOP = H + SLAB, FX0 = 22.13, FX1 = 22.13 + 6 * (9.5 / 12), RF = -GF / 16, RT = TOP / 16;
    const frontRun = (base, R) => [
      [FX0, 47, FX1, 49.76, (x) => base + clamp01((x - FX0) / (FX1 - FX0)) * 6 * R],
      [FX1, 47, 29.625, 52.75, (x, y) => base + (6 + 3 * clamp01((y - 47) / 5.75)) * R],
      [FX0, 50.01, FX1, 52.75, (x) => base + (9 + 6 * clamp01((FX1 - x) / (FX1 - FX0))) * R],
    ];
    areas.push([19, 47, FX0, 50, GF]);                           // through the stair door and inside it
    areas.push(...frontRun(GF, RF), ...frontRun(0, RT));
    areas.push([19.375, 47, FX0, 52.75, TOP]);                   // landing on the roof
    // the whole roof, including the roof over the front balcony (a roof terrace, part of the roof)
    const roof = ceilings.slice();
    for (const c of roof) areas.push([c[0], c[1], c[2], c[3], TOP]);
    solids.push([FX0, 49.76, FX1, 50.01, GF, TOP]);              // the wall between the flights
    /* A 3 ft parapet round the roof, open only where the stair landing joins it (the edge is cut
       at the landing's sides, so the wall stays on either side of the opening), and left out
       where a wall of the floor below rises above the roof (the stair tower). */
    const above = gwalls.filter((w) => w.z[1] > TOP + 1).map((w) => w.r);
    const parapet = boundary(roof, (x, y, nx, ny) => {
      if (ny === 1 && Math.abs(y - 47) < 0.01 && x > 19.375 && x < FX0) return false;
      const ox = x + nx * 0.1, oy = y + ny * 0.1;
      return !above.some((r) => ox > r[0] && ox < r[2] && oy > r[1] && oy < r[3]);
    }, [19.375, FX0].concat(above.flatMap((r) => [r[0], r[2]])), above.flatMap((r) => [r[1], r[3]]));
    for (const s of parapet) {
      const t = 0.375, a = s.c - (s.n > 0 ? t : 0), b = s.c + (s.n < 0 ? t : 0);
      solids.push(s.dir === 'y' ? [a, s.a, b, s.b, TOP, TOP + 3] : [s.a, a, s.b, b, TOP, TOP + 3]);
    }
    A.frontStair = { X0: FX0, X1: FX1, RF, RT, TOP, parapet };

    ground = {
      H: HG, PORCH, walls: gwalls, pillars: gpillars, areaList: gareas, wardrobes: gwardrobes, plinth, indoor,
      roomFloors: gRoomFloors, steps, rooms: grooms,
      floors: gRoomFloors.map((f) => [f[0], f[1], f[2], f[3], f[4], GF]).concat(gareas.map((a) => [a.r[0], a.r[1], a.r[2], a.r[3], 'stonefloor', a.lvl])),
    };
  }

  A.plan = {
    H, SLAB, GF, HG, PORCH, DOOR, RISE, TREAD, walls, pillars, slabs, floors, roomFloors, ceilings, rooms, areas, solids,
    areaList, areaById, voids, midFloor, wardrobes, ZONE, STAIRWELL, rails: { glass, jaali, edge, walls: wallRails }, voidCenter, ground,
  };
})();
