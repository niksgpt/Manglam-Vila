/* Builds the building shell from APP.plan: walls with openings, floors, ceilings,
   both stairs, railings, windows and doors, plus simple surroundings. */
(function () {
  const A = (window.APP = window.APP || {});
  const T = THREE;

  // --- small geometry kit -------------------------------------------------
  function worldUV(g, s) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
      let u, v;
      if (ny > 0.5) { u = p.getX(i); v = p.getZ(i); }
      else if (nx > 0.5) { u = p.getZ(i); v = p.getY(i); }
      else { u = p.getX(i); v = p.getY(i); }
      uv.setXY(i, u / s, v / s);
    }
  }
  function merge(geos) {
    let nV = 0, nI = 0;
    for (const g of geos) { nV += g.attributes.position.count; nI += g.index.count; }
    const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), uv = new Float32Array(nV * 2);
    const idx = new Uint32Array(nI);
    let vo = 0, io = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      const gi = g.index.array;
      for (let k = 0; k < gi.length; k++) idx[io + k] = gi[k] + vo;
      vo += g.attributes.position.count;
      io += gi.length;
      g.dispose();
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    out.setIndex(new T.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    out.computeBoundingBox();
    return out;
  }
  /* Pieces that never move (furniture, trees) are built as many small meshes. Merge every
     mesh in a group that shares a material (and casts shadows the same way) into one mesh:
     far fewer draw calls, the same picture. Glass, sheer curtains and anything with a draw
     order of its own are left as they are, so transparency still sorts correctly. */
  function mergeStatic(grp) {
    grp.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(grp.matrixWorld).invert(), m4 = new T.Matrix4(), buckets = new Map();
    grp.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material) || o.material.transparent || o.renderOrder) return;
      const key = o.material.uuid + (o.castShadow ? '|s' : '|n');
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, list: [] });
      buckets.get(key).list.push(o);
    });
    for (const { mat, cast, list } of buckets.values()) {
      if (list.length < 2) continue;
      const geos = [];
      for (const o of list) {
        const src = o.geometry, g = new T.BufferGeometry();
        g.setAttribute('position', src.attributes.position.clone());
        g.setAttribute('normal', src.attributes.normal ? src.attributes.normal.clone() : src.attributes.position.clone());
        g.setAttribute('uv', src.attributes.uv ? src.attributes.uv.clone() : new T.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
        if (src.index) g.setIndex(src.index.clone());
        else { const n = src.attributes.position.count, ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new T.BufferAttribute(ix, 1)); }
        g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
        geos.push(g);
      }
      const mesh = new T.Mesh(merge(geos), mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      mesh.name = 'merged';
      for (const o of list) o.parent.remove(o);
      grp.add(mesh);
    }
  }
  A.kit = { worldUV, merge, mergeStatic };

  /* A batcher collects axis-aligned boxes per material and turns them into one
     mesh each, which keeps the draw-call count low. */
  function Batcher() {
    this.b = {};
  }
  Batcher.prototype.box = function (mk, x0, y0, x1, y1, z0, z1, grp) {
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return;
    const g = new T.BoxGeometry(x1 - x0, z1 - z0, y1 - y0);
    g.translate((x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2);
    worldUV(g, A.S[mk] || 4);
    const key = (grp || 'main') + '|' + mk;
    (this.b[key] = this.b[key] || []).push(g);
  };
  // any indexed geometry already in place (a stretched Blender piece), drawn with material mk
  Batcher.prototype.add = function (mk, g, grp) {
    worldUV(g, A.S[mk] || 4);
    const key = (grp || 'main') + '|' + mk;
    (this.b[key] = this.b[key] || []).push(g);
  };
  Batcher.prototype.flush = function (groups) {
    for (const key in this.b) {
      const [grp, mk] = key.split('|');
      const m = new T.Mesh(merge(this.b[key]), A.M[mk]);
      const see = mk === 'glass' || mk === 'railglass';
      m.castShadow = !see && grp !== 'ctx'; // the houses around do not shade this one, so low sun still reaches it
      m.receiveShadow = !see;
      if (see) m.renderOrder = 5;
      m.name = key;
      groups[grp].add(m);
    }
    this.b = {};
  };
  A.Batcher = Batcher;

  A.buildShell = function (scene) {
    const P = A.plan, M = A.M, GR = P.ground;
    const { H, SLAB, GF, RISE, TREAD } = P;
    /* main = first floor, gmain = ground floor, both = pieces that run through
       both floors (stairs, the tall void wall), ceil = roof, ctx = surroundings. */
    const groups = { main: new T.Group(), gmain: new T.Group(), both: new T.Group(), ceil: new T.Group(), ctx: new T.Group() };
    groups.main.name = 'shell';
    groups.gmain.name = 'ground-shell';
    groups.both.name = 'stairs';
    groups.ceil.name = 'ceilings';
    groups.ctx.name = 'context';
    const B = new Batcher();
    const extra = []; // meshes that are not boxes (glass panels, rails)
    let G = 'main'; // the group new pieces go into
    const box = (mk, x0, y0, x1, y1, z0, z1, grp) => B.box(mk, x0, y0, x1, y1, z0, z1, grp || G);
    // wall-local box: u along the wall, v across its thickness
    const lb = (mk, ax, u0, u1, v0, v1, z0, z1) =>
      ax === 'x' ? box(mk, u0, v0, u1, v1, z0, z1) : box(mk, v0, u0, v1, u1, z0, z1);
    /* A piece modelled in Blender (models-data.js), stretched and turned into place:
       x, y on plan, z = height it stands on, rot = turn about the vertical (radians),
       sx / sy / sz = stretch along its length / height / depth. mats: { role: material }. */
    const HAS = (n) => !!(A.hasModel && A.hasModel(n) && A.modelParts);
    const PM = new T.Matrix4(), PQ = new T.Quaternion(), PS = new T.Vector3(), PP = new T.Vector3(), UPV = new T.Vector3(0, 1, 0);
    function piece(name, mats, x, y, z, rot, sx, sy, sz, grp) {
      PQ.setFromAxisAngle(UPV, rot); PS.set(sx, sy, sz); PP.set(x, z, y);
      PM.compose(PP, PQ, PS);
      for (const p of A.modelParts(name)) {
        const mk = mats[p.r];
        if (!mk) continue;
        const g = p.geo.clone();
        g.applyMatrix4(PM);
        B.add(mk, g, grp || G);
      }
    }

    /* The architect's wallpaper (a print made in Blender, blender/make_wallpaper.py, for exactly this stretch)
       on one side of a wall: side +1 = the face at the higher x or y, -1 = the lower; a0 to a1 along the wall,
       z0 to z1 high; cut round the wall's windows and doors (their sills count from the wall's own base). The
       skirting stands in front of it. Nothing without the print. */
    function wallpaper(print, walls, id, side, a0, a1, z0, z1) {
      const WPp = window.WALLPAPERS && window.WALLPAPERS[print], w = walls.find((v) => v.id === id);
      if (!WPp || !w) return false;
      const tx = new T.TextureLoader().load(WPp.src);
      tx.colorSpace = T.SRGBColorSpace;
      tx.anisotropy = 8;
      const mat = new T.MeshStandardMaterial({ map: tx, roughness: 0.8 });
      const face = (w.ax === 'x' ? (side > 0 ? w.r[3] : w.r[1]) : side > 0 ? w.r[2] : w.r[0]) + side * 0.005;
      // r: which way the viewer's right runs along the wall, facing it
      const r = w.ax === 'x' ? side : -side, rot = w.ax === 'x' ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2;
      const L = a1 - a0, Hh = z1 - z0, base = w.base || 0;
      // pieces: full height between openings; below the sill and above the head across each opening
      const ops = (w.ops || []).filter((o) => o.b > a0 && o.a < a1).map((o) => [Math.max(a0, o.a), Math.min(a1, o.b), base + (o.sill || 0), base + o.head]).sort((p, q) => p[0] - q[0]);
      const rects = [];
      let u = a0;
      for (const [oa, ob, os, oh] of ops) {
        if (oa > u) rects.push([u, oa, z0, z1]);
        if (os > z0 + 0.01) rects.push([oa, ob, z0, Math.min(os, z1)]);
        if (oh < z1 - 0.01) rects.push([oa, ob, Math.max(oh, z0), z1]);
        u = Math.max(u, ob);
      }
      if (u < a1) rects.push([u, a1, z0, z1]);
      for (const [ua, ub, za, zb] of rects) {
        const pw = ub - ua, ph = zb - za, uc = (ua + ub) / 2, zc = (za + zb) / 2;
        const g = new T.PlaneGeometry(pw, ph), uv = g.attributes.uv, p = g.attributes.position;
        for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + (r > 0 ? uc - a0 : a1 - uc)) / L, (p.getY(i) + zc - z0) / Hh);
        const m = new T.Mesh(g, mat);
        m.rotation.y = rot;
        if (w.ax === 'x') m.position.set(uc, zc, face); else m.position.set(face, zc, uc);
        m.receiveShadow = true;
        m.userData.grp = G;
        extra.push(m);
      }
      return true;
    }

    // --- door leaves (fl = floor level the door stands on) --------------------
    function leaf(ax, u0, u1, v0, v1, z0, z1, glazed, fl) {
      const alongU = u1 - u0 > v1 - v0;
      if (!glazed) {
        lb('joinery',ax, u0, u1, v0, v1, z0, z1);
        // handle
        if (alongU) lb('brass', ax, u1 - 0.42, u1 - 0.3, v0 - 0.12, v1 + 0.12, fl + 3.25, fl + 3.75);
        else lb('brass', ax, u0 - 0.12, u1 + 0.12, v1 - 0.42, v1 - 0.3, fl + 3.25, fl + 3.75);
        return;
      }
      const st = 0.3, bot = 0.6;
      if (alongU) {
        lb('joinery',ax, u0, u0 + st, v0, v1, z0, z1);
        lb('joinery',ax, u1 - st, u1, v0, v1, z0, z1);
        lb('joinery',ax, u0 + st, u1 - st, v0, v1, z0, z0 + bot);
        lb('joinery',ax, u0 + st, u1 - st, v0, v1, z1 - st, z1);
        const c = (v0 + v1) / 2;
        lb('glass', ax, u0 + st, u1 - st, c - 0.015, c + 0.015, z0 + bot, z1 - st);
        lb('brass', ax, u1 - 0.22, u1 - 0.1, v0 - 0.12, v1 + 0.12, fl + 3.2, fl + 3.9);
      } else {
        lb('joinery',ax, u0, u1, v0, v0 + st, z0, z1);
        lb('joinery',ax, u0, u1, v1 - st, v1, z0, z1);
        lb('joinery',ax, u0, u1, v0 + st, v1 - st, z0, z0 + bot);
        lb('joinery',ax, u0, u1, v0 + st, v1 - st, z1 - st, z1);
        const c = (u0 + u1) / 2;
        lb('glass', ax, c - 0.015, c + 0.015, v0 + st, v1 - st, z0 + bot, z1 - st);
      }
    }

    // --- corner windows -------------------------------------------------------
    /* Two windows that meet where two walls overlap at a corner (one wall along x, one along
       y, both windows reaching into the overlap, same sill and head) become one corner window:
       each glass runs on to the other's glass line, the end frames at the corner give way to
       a single slim corner post, the sills meet without overlapping, and the overlap square
       is open between sill and head even if one window stops a little short of it. */
    function cornerWindows(list) {
      const isWin = (o) => o.type === 'win' || o.type === 'vent';
      for (const w1 of list) {
        if (w1.ax !== 'x') continue;
        for (const w2 of list) {
          if (w2.ax !== 'y' || (w1.base || 0) !== (w2.base || 0)) continue;
          const [ax0, ay0, ax1, ay1] = w1.r, [bx0, by0, bx1, by1] = w2.r;
          const cx0 = Math.max(ax0, bx0), cx1 = Math.min(ax1, bx1), cy0 = Math.max(ay0, by0), cy1 = Math.min(ay1, by1);
          if (cx1 - cx0 < 0.05 || cy1 - cy0 < 0.05) continue; // the walls do not overlap
          for (const o1 of w1.ops || []) for (const o2 of w2.ops || []) {
            if (!isWin(o1) || !isWin(o2) || o1.corner || o2.corner) continue;
            if (Math.abs((o1.sill || 0) - (o2.sill || 0)) > 0.1 || Math.abs(o1.head - o2.head) > 0.1) continue;
            const e1 = o1.a >= cx0 - 0.3 && o1.a <= cx1 && o1.b > cx1 ? 'a' : o1.b <= cx1 + 0.3 && o1.b >= cx0 && o1.a < cx0 ? 'b' : null;
            const e2 = o2.a >= cy0 - 0.3 && o2.a <= cy1 && o2.b > cy1 ? 'a' : o2.b <= cy1 + 0.3 && o2.b >= cy0 && o2.a < cy0 ? 'b' : null;
            if (!e1 || !e2) continue;
            const mx = (bx0 + bx1) / 2, my = (ay0 + ay1) / 2; // where the two glass lines cross
            // open the whole overlap square in both walls
            if (e1 === 'a') o1.a = Math.min(o1.a, cx0); else o1.b = Math.max(o1.b, cx1);
            if (e2 === 'a') o2.a = Math.min(o2.a, cy0); else o2.b = Math.max(o2.b, cy1);
            o1.corner = { end: e1, at: mx, post: [mx, my], sillTo: e1 === 'a' ? bx0 - 0.12 : bx1 + 0.12 };
            o2.corner = { end: e2, at: my, sillTo: e2 === 'a' ? ay1 + 0.1 : ay0 - 0.1 };
          }
        }
      }
    }

    // --- openings ---------------------------------------------------------
    function opening(ax, t0, t1, o, fl) {
      const c = (t0 + t1) / 2, a = o.a, b = o.b, sill = fl + (o.sill || 0), head = fl + o.head;
      if (o.type === 'win' || o.type === 'vent') {
        const f = 0.13, d = 0.11, k = o.corner;
        // at a corner the glass runs to the other glass line and the rails stop at the corner post
        const ga = k && k.end === 'a' ? k.at : a, gb = k && k.end === 'b' ? k.at : b;
        const ra = k && k.end === 'a' ? k.at + d : a, rb = k && k.end === 'b' ? k.at - d : b;
        lb('joinery', ax, ra, rb, c - d, c + d, sill, sill + f);
        lb('joinery', ax, ra, rb, c - d, c + d, head - f, head);
        if (!(k && k.end === 'a')) lb('joinery', ax, a, a + f, c - d, c + d, sill + f, head - f);
        if (!(k && k.end === 'b')) lb('joinery', ax, b - f, b, c - d, c + d, sill + f, head - f);
        if (k && k.post) box('joinery', k.post[0] - d, k.post[1] - d, k.post[0] + d, k.post[1] + d, sill, head); // one slim corner post
        const g0 = k && k.end === 'a' ? ga : a + f, g1 = k && k.end === 'b' ? gb : b - f;
        if (o.type === 'win') {
          const panes = Math.max(1, Math.round((g1 - g0) / 2.3));
          for (let i = 1; i < panes; i++) {
            const u = g0 + ((g1 - g0) * i) / panes;
            lb('joinery', ax, u - 0.05, u + 0.05, c - d, c + d, sill + f, head - f);
          }
          lb('glass', ax, g0, g1, c - 0.015, c + 0.015, sill + f, head - f);
          const sa = k && k.end === 'a' ? k.sillTo : a - 0.12, sb = k && k.end === 'b' ? k.sillTo : b + 0.12;
          lb('quartz', ax, Math.min(sa, sb), Math.max(sa, sb), t0 - 0.1, t1 + 0.1, sill - 0.09, sill);
        } else {
          lb('frost', ax, g0, g1, c - 0.02, c + 0.02, sill + f, head - f);
        }
        return;
      }
      // doors and cased openings: a lining in the door veneer (from the opening's own sill, for one high up a tall wall)
      fl = fl + (o.sill || 0);
      const j = 0.1;
      lb('joinery', ax, a, a + j, t0 - 0.03, t1 + 0.03, fl, head);
      lb('joinery', ax, b - j, b, t0 - 0.03, t1 + 0.03, fl, head);
      lb('joinery', ax, a + j, b - j, t0 - 0.03, t1 + 0.03, head - j, head);
      if (o.type === 'open') return;
      const glazed = o.type === 'gdoor', th = 0.07, z0 = fl + 0.03, z1 = head - j;
      if (o.leaves === 2) { // double door: one leaf hinged at each side
        const m = (a + b) / 2, w2 = (b - a - 2 * j) / 2;
        if (!o.isOpen) {
          leaf(ax, a + j, m - 0.01, c - th, c + th, z0, z1, glazed, fl);
          leaf(ax, m + 0.01, b - j, c - th, c + th, z0, z1, glazed, fl);
        } else {
          for (const h of [a + j + th, b - j - th]) {
            if (o.swing > 0) leaf(ax, h - th, h + th, t1, t1 + w2, z0, z1, glazed, fl);
            else leaf(ax, h - th, h + th, t0 - w2, t0, z0, z1, glazed, fl);
          }
        }
        return;
      }
      const w = b - a - 2 * j;
      if (!o.isOpen) {
        leaf(ax, a + j, b - j, c - th, c + th, z0, z1, glazed, fl);
      } else {
        const h = o.hinge === 'a' ? a + j + th : b - j - th;
        if (o.swing > 0) leaf(ax, h - th, h + th, t1, t1 + w, z0, z1, glazed, fl);
        else leaf(ax, h - th, h + th, t0 - w, t0, z0, z1, glazed, fl);
      }
    }

    // --- skirting: 4" high along the foot of every wall, on each side that faces a
    // finished floor, in that floor's own material; it stops at doors and openings.
    const SK = 4 / 12, SKT = 0.04;
    function floorAt(list, x, y) { // [x0, y0, x1, y1, material, level?] under a point, or null
      for (const f of list) if (x > f[0] && x < f[2] && y > f[1] && y < f[3]) return f;
      return null;
    }
    function skirting(w, floorList) {
      const [x0, y0, x1, y1] = w.r, ax = w.ax, fl = w.base || 0, ops = w.ops || [];
      const lo = ax === 'x' ? x0 : y0, hi = ax === 'x' ? x1 : y1, t0 = ax === 'x' ? y0 : x0, t1 = ax === 'x' ? y1 : x1;
      const z0 = w.z ? w.z[0] : 0, z1 = w.z ? w.z[1] : H;
      // cut the wall at its ends, its openings and every floor edge, then test each piece
      const cuts = [lo, hi].concat(ops.flatMap((o) => [o.a, o.b]), floorList.flatMap((f) => (ax === 'x' ? [f[0], f[2]] : [f[1], f[3]])));
      const cs = Array.from(new Set(cuts.filter((v) => v >= lo && v <= hi).map((v) => Math.round(v * 1e4) / 1e4))).sort((p, q) => p - q);
      for (const side of [-1, 1]) {
        const tf = side < 0 ? t0 : t1, probe = tf + side * 0.15;
        let run = null; // [u0, u1, floor]
        const flush = () => {
          if (run && run[1] - run[0] > 0.05) {
            const f = run[2], l = f.length > 5 ? f[5] : 0, len = run[1] - run[0], u = (run[0] + run[1]) / 2;
            if (HAS('skirting')) { // the Blender profile (rounded top edge), its back on the wall face
              if (ax === 'x') piece('skirting', { tile: f[4] }, u, tf, l, side > 0 ? 0 : Math.PI, len, 1, 1);
              else piece('skirting', { tile: f[4] }, tf, u, l, side < 0 ? -Math.PI / 2 : Math.PI / 2, len, 1, 1);
            } else lb(f[4], ax, run[0], run[1], side < 0 ? tf - SKT : tf, side < 0 ? tf : tf + SKT, l, l + SK);
          }
          run = null;
        };
        for (let i = 0; i < cs.length - 1; i++) {
          const a = cs[i], b = cs[i + 1], m = (a + b) / 2;
          const f = floorAt(floorList, ax === 'x' ? m : probe, ax === 'x' ? probe : m), l = f ? (f.length > 5 ? f[5] : 0) : 0;
          const ok = f && z0 <= l + 0.05 && z1 >= l + SK && !ops.some((o) => o.a < m && o.b > m && fl + (o.sill || 0) < l + SK && fl + o.head > l);
          if (!ok) { flush(); continue; }
          if (run && run[2] === f && Math.abs(run[1] - a) < 1e-4) run[1] = b;
          else { flush(); run = [a, b, f]; }
        }
        flush();
      }
    }

    // --- cladding: charcoal grey WPC panels -----------------------------------
    /* On the outer faces of chosen walls (a face is outer when no room, and not the stair, lies
       beyond it), stopping at openings and wrapping round outer wall ends, and all round chosen
       pillars. Chosen in the plan (wall.clad) or in this home's list. */
    /* This home's wall finishes: wall or pillar -> material ('wpc' charcoal panels, 'plaster' textured
       stone, 'felt' quilted felt), on the wall's outer faces; or { mk, face } for one chosen side of
       an inside wall (face -1 = the side at the lower x / y, +1 = the higher). */
    const CLAD = {
      'g-stair-front': 'wpc', 'g-stair-north': 'wpc', 'g-stair-south': 'wpc', 'gp-porch-1': 'wpc', 'gp-porch-2': 'wpc', 'p-terrace-1': 'wpc', 'p-terrace-2': 'wpc',
      'g-lobby-kitchen': 'plaster', 'g-hall-north': 'plaster', 'g-entrance': 'plaster', 'lounge-north': 'plaster', 'bedroom-north': 'plaster', 'lounge-terrace': 'plaster',
      'g-bed-hall': { mk: 'felt', face: 1 },  // the hall side, behind the sofa
      'g-kitchen-west': 'plaster',
      front: { mk: 'plaster', range: [-Infinity, 19] }, // its balcony side, up to the stair tower (g-stair-north)
      'g-north-porch': { mk: 'brick', face: 'both' }, 'g-front-pier': { mk: 'brick', face: 'both' }, 'gp-gate': 'brick',
    };
    const THICK = { wpc: 0.06, felt: 0.045, brick: 0.05 };  // panels and brick slips stand proud; a textured finish is thin
    function cladding(walls, pillars, interior) {
      const isIn = (x, y, list) => list.some((f) => x > f[0] && x < f[2] && y > f[1] && y < f[3]);
      const wallRects = walls.map((w) => w.r);
      for (const w of walls) {
        const spec = w.clad || CLAD[w.id], mk = spec && (typeof spec === 'string' ? spec : spec.mk), face = spec && spec.face;
        if (!mk || !M[mk]) continue;
        const T_ = THICK[mk] || 0.03;
        const ax = w.ax, [x0, y0, x1, y1] = w.r, fl = w.base || 0, z0 = w.z[0];
        // an outside finish runs on over the slab edge above the wall (to the top of the first-floor slab, or of the
        // roof slab), so no band of floor shows between the storeys; a finish on one side of an inside wall stops at its top
        const z1 = face && face !== 'both' ? w.z[1] : Math.abs(w.z[1] + SLAB) < 0.02 ? 0 : Math.abs(w.z[1] - H) < 0.02 ? H + SLAB : w.z[1];
        const lo = ax === 'x' ? x0 : y0, hi = ax === 'x' ? x1 : y1, t0 = ax === 'x' ? y0 : x0, t1 = ax === 'x' ? y1 : x1, mid = (lo + hi) / 2;
        const pt = (u, t) => (ax === 'x' ? [u, t] : [t, u]);
        const outside = (u, t) => { const [px, py] = pt(u, t); return !isIn(px, py, interior) && !isIn(px, py, wallRects.filter((r) => r !== w.r)); };
        // a finish can stop partway along the wall (range, along its length)
        const r0 = spec.range ? Math.max(lo, spec.range[0]) : lo, r1 = spec.range ? Math.min(hi, spec.range[1]) : hi;
        // bare outer wall ends get panels too (not on a chosen side of an inside wall, nor where the finish stops short)
        const wrapEnds = !face || face === 'both';
        const endA = wrapEnds && r0 <= lo + 1e-6 && outside(lo - 0.4, (t0 + t1) / 2), endB = wrapEnds && r1 >= hi - 1e-6 && outside(hi + 0.4, (t0 + t1) / 2);
        const ops = w.ops || [];
        const cuts = Array.from(new Set([r0, r1].concat(ops.flatMap((o) => [o.a, o.b])).filter((v) => v >= r0 && v <= r1))).sort((p, q) => p - q);
        const solidZ = (m) => { // heights of solid wall at a point along it, between its openings
          const holes = ops.filter((o) => o.a < m && o.b > m).map((o) => [fl + (o.sill || 0), fl + o.head]).sort((p, q) => p[0] - q[0]);
          const out = []; let cur = z0;
          for (const [h0, h1] of holes) { if (h0 - cur > 0.05) out.push([cur, h0]); cur = Math.max(cur, h1); }
          if (z1 - cur > 0.05) out.push([cur, z1]);
          return out;
        };
        for (const [s, t] of [[-1, t0], [1, t1]]) {
          if (face === 'both' ? false : face ? s !== face : !outside(mid, t + s * 0.4)) continue;
          for (let i = 0; i < cuts.length - 1; i++) {
            const a = cuts[i] - (i === 0 && endA ? T_ : 0), b = cuts[i + 1] + (i === cuts.length - 2 && endB ? T_ : 0);
            for (const [za, zb] of solidZ((cuts[i] + cuts[i + 1]) / 2)) lb(mk, ax, a, b, s < 0 ? t - T_ : t, s < 0 ? t : t + T_, za, zb);
          }
        }
        for (const [u, end] of [[lo, endA], [hi, endB]]) if (end) { // the wall's own end face
          for (const [za, zb] of solidZ(u === lo ? lo + 0.01 : hi - 0.01)) lb(mk, ax, u === lo ? lo - T_ : hi, u === lo ? lo : hi + T_, t0, t1, za, zb);
        }
      }
      for (const p of pillars) {
        const spec = p.clad || CLAD[p.id], mk = spec && (typeof spec === 'string' ? spec : spec.mk), T_ = THICK[mk] || 0.03;
        if (mk && M[mk]) box(mk, p.r[0] - T_, p.r[1] - T_, p.r[2] + T_, p.r[3] + T_, p.z[0], p.z[1]);
      }
    }

    // --- walls ------------------------------------------------------------
    function buildWalls(list, floorList) {
      cornerWindows(list);
      for (const w of list) {
        if (floorList) skirting(w, floorList);
        const [x0, y0, x1, y1] = w.r, fl = w.base || 0;
        let z0 = w.z ? w.z[0] : 0;
        const z1 = w.z ? w.z[1] : H, mk = w.mat || 'wall', ax = w.ax;
        if (z0 === fl) z0 = fl - 0.02;
        const lo = ax === 'x' ? x0 : y0, hi = ax === 'x' ? x1 : y1;
        const t0 = ax === 'x' ? y0 : x0, t1 = ax === 'x' ? y1 : x1;
        const ops = (w.ops || []).slice().sort((p, q) => p.a - q.a);
        // cut the wall at every opening edge; in each stretch build only the solid heights,
        // so openings can sit one above the other (a door on each floor of a tall wall)
        const cuts = Array.from(new Set([lo, hi].concat(ops.flatMap((o) => [o.a, o.b])).filter((v) => v >= lo && v <= hi))).sort((p, q) => p - q);
        for (let i = 0; i < cuts.length - 1; i++) {
          const a = cuts[i], b = cuts[i + 1], mid = (a + b) / 2;
          const holes = ops.filter((o) => o.a < mid && o.b > mid).map((o) => [fl + (o.sill || 0), fl + o.head]).sort((p, q) => p[0] - q[0]);
          let cur = z0;
          for (const [h0, h1] of holes) { if (h0 - cur > 0.03) lb(mk, ax, a, b, t0, t1, cur, h0); cur = Math.max(cur, h1); }
          if (z1 - cur > 1e-3) lb(mk, ax, a, b, t0, t1, cur, z1);
        }
        for (const o of ops) opening(ax, t0, t1, o, fl);
      }
    }
    buildWalls(P.walls, P.floors);
    cladding(P.walls, P.pillars, P.roomFloors.concat(P.midFloor)); // first floor: WPC panels where chosen
    for (const p of P.pillars) box(p.mat, p.r[0], p.r[1], p.r[2], p.r[3], p.z[0] === 0 ? -0.02 : p.z[0], p.z[1]);

    // --- slabs, floors, ceilings -------------------------------------------
    // the slab's edges, wherever they show (outside walls between the floors, the void), are in the wall colour;
    // a thin marble top under the room floors
    // (in by 0.005 ft so its underside never shows as a hairline below the walls' outer faces)
    for (const s of P.slabs) { box('wall', s[0] + 0.005, s[1] + 0.005, s[2] - 0.005, s[3] - 0.005, -SLAB, -0.03); box('marble', s[0], s[1], s[2], s[3], -0.03, -0.02); }
    for (const f of P.floors) box(f[4], f[0], f[1], f[2], f[3], -0.02, 0);
    // roof slab in the wall colour, the ceiling under it pulled in by 0.05 ft so its edge stays inside the walls
    // (no white line along the facades)
    for (const c of P.ceilings) { box('wall', c[0] + 0.005, c[1] + 0.005, c[2] - 0.005, c[3] - 0.005, H, H + SLAB, 'ceil'); box('ceiling', c[0] + 0.05, c[1] + 0.05, c[2] - 0.05, c[3] - 0.05, H - 0.02, H + 0.01, 'ceil'); }

    // --- main stair (round the void, joins the two floors) -------------------
    const TH = 0.56; // step thickness: reads as a folded-plate stair
    G = 'both';
    for (let i = 0; i < 7; i++) { // flight 1, heading south
      const top = -(i + 1) * RISE;
      box('stairMarble', 20.29 + i * TREAD, 24.375, 20.29 + (i + 1) * TREAD + 0.02, 27.875, top - TH, top);
    }
    box('stairMarble', 26.125, 23.96, 29.625, 27.875, -8 * RISE - TH, -8 * RISE);
    for (let j = 0; j < 7; j++) { // flight 2, heading east
      const top = -(9 + j) * RISE;
      box('stairMarble', 26.125, 23.96 - (j + 1) * TREAD - 0.02, 29.625, 23.96 - j * TREAD, top - TH, top);
    }
    box('stairMarble', 26.125, 14.625, 29.625, 18.125, -16 * RISE - TH, -16 * RISE);
    for (let k = 0; k < 3; k++) { // flight 3, heading north
      const top = -(17 + k) * RISE;
      box('stairMarble', 26.125 - (k + 1) * TREAD - 0.02, 14.625, 26.125 - k * TREAD, 18.125, top - TH, top);
    }
    // --- feature finishes ---------------------------------------------------
    // tall south wall of the double height, beside the main stair: the wallpaper print made in
    // Blender (blender/make_wallpaper.py), only over this stretch, so no other room shows it;
    // stone cladding when there is no print. The skirting stands in front of it.
    const WP = window.WALLPAPERS && window.WALLPAPERS['void-south'];
    if (WP) {
      const tx = new T.TextureLoader().load(WP.src);
      tx.colorSpace = T.SRGBColorSpace;
      tx.anisotropy = 8;
      const wp = new T.Mesh(new T.PlaneGeometry(27.875 - 14.625, H - GF), new T.MeshStandardMaterial({ map: tx, roughness: 0.78 }));
      wp.rotation.y = -Math.PI / 2;                     // facing the stair and the double height
      wp.position.set(29.62, (GF + H) / 2, (14.625 + 27.875) / 2);
      wp.receiveShadow = true;
      wp.userData.grp = 'both';
      extra.push(wp);
    } else box('cladding', 29.56, 14.625, 29.625, 27.875, GF, H);
    G = 'main';

    if (!GR) {
      // --- placeholder ground floor (no ground floor drawing) -----------------
      box('marble', 9, 14.25, 29.625, 28.25, GF - 0.3, GF);
      box('wall', -1, 0, 29.625, 14.25, GF, -SLAB);           // solid mass under the rear block
      box('wall', -0.375, 14.625, 9, 28.625, GF, -SLAB);      // under the lounge
      box('wall', 8.875, 28.25, 29.625, 47, GF, -SLAB);       // under the master suite
    } else {
      // --- ground floor, from its own plan -----------------------------------
      G = 'gmain';
      const PL = GF + GR.PORCH;
      buildWalls(GR.walls, GR.floors.concat([[19, 47, 29.625, 52.75, 'stonefloor', GF]]));
      cladding(GR.walls, GR.pillars, GR.roomFloors.concat([[19, 47, 29.625, 52.75]]));
      // the architect's wallpapers behind the beds, floor to ceiling across each room only (see wallpaper())
      wallpaper('guest-bed', GR.walls, 'g-south', -1, 0.75, 14.25, GF, -SLAB - 0.03);     // guest room
      wallpaper('kids-bed', GR.walls, 'g-north-rear', 1, 4.75, 14.25, GF, -SLAB - 0.03);  // children's room
      // the home's name plate, modelled in Blender, on the road face of the gate pier at eye level
      const pier = GR.walls.find((w) => w.id === 'g-front-pier');
      if (pier && HAS('nameplate')) {
        const base = Math.min(pier.z[1] - 1.4, GF + GR.PORCH + 4.3);
        const pc = pier.clad || CLAD[pier.id], pmk = pc && (typeof pc === 'string' ? pc : pc.mk), proud = pmk ? THICK[pmk] || 0.03 : 0; // on the cladding's face
        piece('nameplate', { plate: 'plaque', letters: 'gilt' }, (pier.r[0] + pier.r[2]) / 2, pier.r[3] + proud, base, 0, 1, 1, 1);
      }
      for (const p of GR.pillars) box(p.mat, p.r[0], p.r[1], p.r[2], p.r[3], p.z[0] === GF ? GF - 0.02 : p.z[0], p.z[1]);
      for (const r of GR.indoor) { box('stone', r[0], r[1], r[2], r[3], PL - 0.6, GF - 0.035); box('marble', r[0], r[1], r[2], r[3], GF - 0.035, GF - 0.02); }
      for (const r of GR.plinth) box('stone', r[0], r[1], r[2], r[3], PL - 0.6, GF - 0.02);
      box('stonefloor', 19, 47, 29.625, 52.75, GF - 0.02, GF);                  // floor of the front stair
      for (const f of GR.floors) box(f[4], f[0], f[1], f[2], f[3], f[5] - 0.02, f[5]);
      for (const a of GR.areaList) if (a.kind === 'porch') box('stone', a.r[0], a.r[1], a.r[2], a.r[3], PL - 0.6, PL - 0.02);
      for (const s of GR.steps) box('stone', s[0], s[1], s[2], s[3], PL - 0.3, GF + s[4]);
      // ceiling finish under the first floor slabs
      for (const s of P.slabs) box('ceiling', s[0] + 0.05, s[1] + 0.05, s[2] - 0.05, s[3] - 0.05, -SLAB - 0.03, -SLAB + 0.01); // edge kept inside the walls

      // front stair, as drawn on the ground floor: up, round a winder landing, and back
      G = 'both';
      const N = 16, RF = (0 - GF) / N, TF = 9.5 / 12, X0 = 22.13, X1 = X0 + 6 * TF;
      const fbA = P.areaById['front-balcony'];
      const yU = fbA && fbA.r[3] > 50 && fbA.r[3] < 52.3 && fbA.r[2] > X0 ? fbA.r[3] + 0.02 : 50.01; // upper flight clears the balcony slab
      for (let k = 1; k <= 6; k++) box('stair', X0 + (k - 1) * TF, 47, X0 + k * TF + 0.02, 49.76, GF + k * RF - TH, GF + k * RF);
      const wy = [47, 48.9, 50.85, 52.75];
      for (let k = 0; k < 3; k++) box('stair', X1, wy[k], 29.625, wy[k + 1] + (k < 2 ? 0.02 : 0), GF + (7 + k) * RF - TH, GF + (7 + k) * RF);
      for (let k = 1; k <= 6; k++) box('stair', X1 - k * TF - 0.02, yU, X1 - (k - 1) * TF, 52.75, GF + (9 + k) * RF - TH, GF + (9 + k) * RF);
      // second run, from the landing beside the balcony up to the roof
      const TOPL = H + SLAB, RT = TOPL / N;
      for (let k = 1; k <= 6; k++) box('stair', X0 + (k - 1) * TF, 47, X0 + k * TF + 0.02, 49.76, k * RT - TH, k * RT);
      for (let k = 0; k < 3; k++) box('stair', X1, wy[k], 29.625, wy[k + 1] + (k < 2 ? 0.02 : 0), (7 + k) * RT - TH, (7 + k) * RT);
      for (let k = 1; k <= 6; k++) box('stair', X1 - k * TF - 0.02, 50.01, X1 - (k - 1) * TF, 52.75, (9 + k) * RT - TH, (9 + k) * RT);
      box('stone', 19.375, 47, X0, 52.75, TOPL - SLAB, TOPL - 0.02);           // landing on the roof
      box('terrazzo', 19.375, 47, X0, 52.75, TOPL - 0.02, TOPL);               // roof landing: the roof's terrazzo
      // the inner side of the flights, round the gap between them: a railing, not a wall
      const yA = 49.76 - 0.07, yB = 50.01 + 0.07;
      for (const [base, R] of [[GF, RF], [0, RT]]) {
        glassRun([X0, yA, base + R], [X1, yA, base + 7 * R], 0, 'both');         // flight heading south
        glassRun([X1, yA, base + 7 * R], [X1, yB, base + 9 * R], 0, 'both');     // round the turn
        glassRun([X1, yB, base + 9 * R], [X0, yB, base + 15 * R], 0, 'both');    // flight heading back
      }
      G = 'main';
      // railings on the open sides of the upper run and its landings
      const R0 = 0.07;
      const tall = (id) => GR.walls.some((w) => w.id === id && w.z[1] > TOPL - 0.5);
      if (!tall('g-stair-south')) glassRun([29.52, 47.05, 6 * RT], [29.52, 52.68, 9 * RT], 0, 'both');   // winders, south side
      if (!tall('g-stair-front')) {
        glassRun([29.52, 52.66, 9 * RT], [X1, 52.66, 9 * RT], 0, 'both');         // winders, road side
        glassRun([X1, 52.66, 9 * RT], [X0, 52.66, 15 * RT], 0, 'both');          // top flight, road side
        glassRun([X0, 52.66, 0], [19.45, 52.66, 0], 0, 'both');                  // first floor landing, road side
      }
      if (!tall('g-stair-north')) glassRun([19.45, 52.66, 0], [19.45, 50.6, 0], 0, 'both'); // landing, north side
      // roof landing: railings only where the stair's walls stop at the roof (they can rise above it)
      const above = (id) => GR.walls.some((w) => w.id === id && w.z[1] > TOPL + 3);
      if (!above('g-stair-front')) glassRun([X0, 52.66, TOPL], [19.45, 52.66, TOPL], 0, 'both');   // roof landing, road side
      if (!above('g-stair-north')) glassRun([19.45, 52.66, TOPL], [19.45, 47.05, TOPL], 0, 'both'); //   north side
      glassRun([X0 + R0, 47.05, TOPL], [X0 + R0, 49.76, TOPL], 0, 'both');     //   over the flight below
      // roof finish: terrace tiles on top of the roof slab
      for (const c of P.ceilings) box('terrazzo', c[0], c[1], c[2], c[3], TOPL, TOPL + 0.02, 'ceil'); // terrazzo roof floor, incl. the roof over the front balcony
      // parapet round the roof (part of the roof, so the dollhouse view lifts it off too)
      for (const s of (A.frontStair || {}).parapet || []) {
        const t = 0.375, a = s.c - (s.n > 0 ? t : 0), b = s.c + (s.n < 0 ? t : 0);
        if (s.dir === 'y') { box('wall', a, s.a, b, s.b, TOPL, TOPL + 3, 'ceil'); box('stone', a - 0.05, s.a, b + 0.05, s.b, TOPL + 3, TOPL + 3.15, 'ceil'); }
        else { box('wall', s.a, a, s.b, b, TOPL, TOPL + 3, 'ceil'); box('stone', s.a, a - 0.05, s.b, b + 0.05, TOPL + 3, TOPL + 3.15, 'ceil'); }
      }
    }

    // --- pergola over the cut-out beside the terrace ------------------------
    // Pergola over the road end of the terrace (it used to cover an open gap there).
    const ter = P.areaById.terrace;
    if (ter && ter.r[3] - ter.r[1] > 12 && ter.r[2] - ter.r[0] > 5) {
      const pg = H - 0.45, pt = H + SLAB, x0 = ter.r[0] + 0.5, x1 = ter.r[2] - 0.35, y1 = ter.r[3] - 0.2, y0 = y1 - 7.8;
      box('teak', x0, y0, x1, y0 + 0.4, pg, pt);
      box('teak', x0, y1 - 0.4, x1, y1, pg, pt);
      box('teak', x0, y0, x0 + 0.4, y1, pg, pt);
      box('teak', x1 - 0.4, y0, x1, y1, pg, pt);
      const nb = Math.max(2, Math.round((y1 - y0) / 2.6));
      for (let k = 1; k < nb; k++) { const y = y0 + ((y1 - y0) * k) / nb; box('teak', x0, y - 0.18, x1, y + 0.18, pg, pt); }
      for (let x = x0 + 0.5; x < x1 - 0.3; x += 0.62) box('teak', x, y0, x + 0.16, y1, pt, pt + 0.35);
      for (const [px, py] of [[x0 + 0.07, y0 + 0.07], [x1 - 0.33, y0 + 0.07], [x0 + 0.07, y1 - 0.33], [x1 - 0.33, y1 - 0.33]]) box('metal', px, py, px + 0.26, py + 0.26, 0, pg);
    }

    // --- interior glass railings --------------------------------------------
    function glassRun(p, q, h, grp) { // p, q = [x, y, height]; follows the slope
      h = h || 3.25;
      const keep = (m) => { m.userData.grp = grp || 'main'; extra.push(m); };
      P.solids.push([Math.min(p[0], q[0]) - 0.06, Math.min(p[1], q[1]) - 0.06, Math.max(p[0], q[0]) + 0.06, Math.max(p[1], q[1]) + 0.06, Math.min(p[2], q[2]) - 0.5, Math.max(p[2], q[2]) + h]);
      const g = new T.BufferGeometry();
      const v = [p[0], p[2] + 0.12, p[1], q[0], q[2] + 0.12, q[1], q[0], q[2] + h, q[1], p[0], p[2] + h, p[1]];
      g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      const m = new T.Mesh(g, M.railglass);
      m.renderOrder = 6;
      keep(m);
      // handrail
      const a = new T.Vector3(p[0], p[2] + h, p[1]), b = new T.Vector3(q[0], q[2] + h, q[1]);
      const len = a.distanceTo(b);
      const rail = new T.Mesh(new T.BoxGeometry(0.15, 0.1, len + 0.08), M.teak);
      rail.position.copy(a).add(b).multiplyScalar(0.5);
      rail.lookAt(b);
      rail.castShadow = true;
      keep(rail);
      // base shoe
      const a0 = new T.Vector3(p[0], p[2] + 0.07, p[1]), b0 = new T.Vector3(q[0], q[2] + 0.07, q[1]);
      const shoe = new T.Mesh(new T.BoxGeometry(0.12, 0.2, len), M.steel);
      shoe.position.copy(a0).add(b0).multiplyScalar(0.5);
      shoe.lookAt(b0);
      keep(shoe);
    }
    const e = 0.1;
    for (const s of P.rails.glass) { // floor edges beside the void and the stairwell
      const c = s.c - e * s.n;
      if (s.dir === 'y') {
        glassRun([c, s.a - e, 0], [c, s.b + e, 0]);
        box('wall', Math.min(s.c, s.c + 0.045 * s.n), s.a, Math.max(s.c, s.c + 0.045 * s.n), s.b, -SLAB - 0.35, 0);
      } else {
        glassRun([s.a - e, c, 0], [s.b + e, c, 0]);
        box('wall', s.a, Math.min(s.c, s.c + 0.045 * s.n), s.b, Math.max(s.c, s.c + 0.045 * s.n), -SLAB - 0.35, 0);
      }
    }
    glassRun([20.29, 24.375 + e, 0], [26.125 + e, 24.375 + e, -8 * RISE], 0, 'both');      // flight 1
    glassRun([26.125 + e, 24.375 + e, -8 * RISE], [26.125 + e, 23.96, -8 * RISE], 0, 'both');
    glassRun([26.125 + e, 23.96, -8 * RISE], [26.125 + e, 18.125 + e, -16 * RISE], 0, 'both'); // flight 2
    glassRun([26.125 + e, 18.125 - e, -16 * RISE], [23.62, 18.125 - e, GF], 0, 'both');    // flight 3

    // --- outdoor railings: jaali, glass or metal bars ---------------------------
    /* A straight run from (xa, ya) to (xb, yb), standing on z0 and h high. onWall = it
       sits on top of a parapet, so it starts right at the wall top. */
    /* Posts and the handrail of a level run, from the Blender pieces: chamfered posts about
       every `gap` feet (the end ones rise through the rail and carry a cap), rounded rail on top. */
    function postsAndRail(alongX, u0, u1, c, z0, h, grp, gap) {
      const len = u1 - u0, rot = alongX ? 0 : -Math.PI / 2, at = (u) => (alongX ? [u, c] : [c, u]);
      const n = Math.max(1, Math.round(len / gap));
      for (let i = 0; i <= n; i++) {
        const u = Math.min(u1 - 0.08, Math.max(u0 + 0.08, u0 + (len * i) / n)), [x, y] = at(u), end = i === 0 || i === n;
        piece('rail_post', { metal: 'metal' }, x, y, z0, 0, 1, end ? h + 0.03 : h - 0.1, 1, grp);
        if (end) piece('rail_cap', { metal: 'metal' }, x, y, z0 + h + 0.03, 0, 1, 1, 1, grp);
      }
      const [mx, my] = at((u0 + u1) / 2);
      piece('rail_top', { metal: 'metal' }, mx, my, z0 + h - 0.1, rot, len, 1, 1, grp);
    }
    const MODELLED = () => HAS('rail_post') && HAS('rail_top') && HAS('rail_bar') && HAS('rail_cap');

    function jaaliRun(xa, ya, xb, yb, h, z0, grp, onWall) {
      h = h || 3.5; z0 = z0 || 0; grp = grp || 'main';
      P.solids.push([Math.min(xa, xb) - 0.07, Math.min(ya, yb) - 0.07, Math.max(xa, xb) + 0.07, Math.max(ya, yb) + 0.07, z0, z0 + h]);
      const alongX = Math.abs(xb - xa) > Math.abs(yb - ya);
      const len = alongX ? Math.abs(xb - xa) : Math.abs(yb - ya);
      const t = 0.07, foot = onWall ? 0 : 0.18; // bottom rail: on the parapet, or a little off the floor
      if (MODELLED()) {
        const u0 = alongX ? Math.min(xa, xb) : Math.min(ya, yb), u1 = u0 + len, c = alongX ? ya : xa;
        postsAndRail(alongX, u0, u1, c, z0, h, grp, 4.5);
        if (alongX) box('metal', u0, c - t, u1, c + t, z0 + foot, z0 + foot + 0.12, grp);
        else box('metal', c - t, u0, c + t, u1, z0 + foot, z0 + foot + 0.12, grp);
      } else if (alongX) {
        const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
        box('metal', x0, ya - t, x1, ya + t, z0 + h - 0.14, z0 + h, grp);
        box('metal', x0, ya - t, x1, ya + t, z0 + foot, z0 + foot + 0.12, grp);
        const n = Math.max(1, Math.round(len / 4.5));
        for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; box('metal', x - 0.08, ya - 0.08, x + 0.08, ya + 0.08, z0, z0 + h, grp); }
      } else {
        const y0 = Math.min(ya, yb), y1 = Math.max(ya, yb);
        box('metal', xa - t, y0, xa + t, y1, z0 + h - 0.14, z0 + h, grp);
        box('metal', xa - t, y0, xa + t, y1, z0 + foot, z0 + foot + 0.12, grp);
        const n = Math.max(1, Math.round(len / 4.5));
        for (let i = 0; i <= n; i++) { const y = y0 + ((y1 - y0) * i) / n; box('metal', xa - 0.08, y - 0.08, xa + 0.08, y + 0.08, z0, z0 + h, grp); }
      }
      const pb = foot + 0.12, ph = h - 0.14 - pb;
      if (ph < 0.2) return;
      const g = new T.PlaneGeometry(len, ph);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / 2.9, (uv.getY(i) * ph) / 3.06);
      const m = new T.Mesh(g, M.jaali);
      if (!alongX) m.rotation.y = Math.PI / 2;
      m.position.set((xa + xb) / 2, z0 + pb + ph / 2, (ya + yb) / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.grp = grp;
      extra.push(m);
    }
    // metal bars: flat top rail, bottom rail, square bars at 4½" centres, a post every 4 ft or so
    function barsRun(xa, ya, xb, yb, h, z0, grp, onWall) {
      h = h || 3.5; z0 = z0 || 0; grp = grp || 'main';
      P.solids.push([Math.min(xa, xb) - 0.07, Math.min(ya, yb) - 0.07, Math.max(xa, xb) + 0.07, Math.max(ya, yb) + 0.07, z0, z0 + h]);
      const alongX = Math.abs(xb - xa) > Math.abs(yb - ya), c = alongX ? ya : xa;
      const u0 = alongX ? Math.min(xa, xb) : Math.min(ya, yb), u1 = alongX ? Math.max(xa, xb) : Math.max(ya, yb), len = u1 - u0;
      const bar = (a, b, half, za, zb) => (alongX ? box('metal', a, c - half, b, c + half, za, zb, grp) : box('metal', c - half, a, c + half, b, za, zb, grp));
      const foot = onWall ? 0 : 0.15;
      bar(u0, u1, 0.05, z0 + foot, z0 + foot + 0.08);          // bottom rail
      const n = Math.max(1, Math.round(len / 0.375));
      if (MODELLED()) { // Blender pieces: round bars, chamfered posts with caps, rounded handrail
        postsAndRail(alongX, u0, u1, c, z0, h, grp, 4);
        const bz = z0 + foot + 0.08, bh = h - 0.1 - foot - 0.08;
        for (let i = 1; i < n; i++) { const u = u0 + (len * i) / n; piece('rail_bar', { metal: 'metal' }, alongX ? u : c, alongX ? c : u, bz, 0, 1, bh, 1, grp); }
        return;
      }
      bar(u0, u1, 0.11, z0 + h - 0.1, z0 + h);                 // top rail
      for (let i = 1; i < n; i++) { const u = u0 + (len * i) / n; bar(u - 0.026, u + 0.026, 0.026, z0 + foot + 0.08, z0 + h - 0.1); }
      const np = Math.max(1, Math.round(len / 4));
      for (let i = 0; i <= np; i++) { const u = Math.min(u1 - 0.045, Math.max(u0 + 0.045, u0 + (len * i) / np)); bar(u - 0.045, u + 0.045, 0.045, z0, z0 + h - 0.1); }
    }
    function railRun(kind, xa, ya, xb, yb, z0, z1, grp, onWall) {
      const h = z1 - z0;
      if (h < 0.3) return;
      if (kind === 'glass') glassRun([xa, ya, z0], [xb, yb, z0], h, grp);
      else if (kind === 'bars') barsRun(xa, ya, xb, yb, h, z0, grp, onWall);
      else jaaliRun(xa, ya, xb, yb, h, z0, grp, onWall);
    }
    for (const s of P.rails.edge) { // open edges of the terraces and balconies
      if (s.b - s.a < 0.3) continue;
      if (s.dir === 'y') railRun(s.kind, s.c, s.a, s.c, s.b, 0, s.top, 'main');
      else railRun(s.kind, s.a, s.c, s.b, s.c, 0, s.top, 'main');
    }
    for (const r of P.rails.walls) { // on top of parapets, along the middle of the wall
      if (r.ax === 'x') { const y = (r.r[1] + r.r[3]) / 2; railRun(r.kind, r.r[0], y, r.r[2], y, r.z0, r.z1, r.grp, true); }
      else { const x = (r.r[0] + r.r[2]) / 2; railRun(r.kind, x, r.r[1], x, r.r[3], r.z0, r.z1, r.grp, true); }
    }

    // --- surroundings ---------------------------------------------------------
    // E = the level everything outside stands on (a little above the outside ground)
    const E = GR ? GF + GR.PORCH + 0.2 : GF;
    const cb = (mk, x0, y0, x1, y1, z0, z1) => box(mk, x0, y0, x1, y1, z0, z1, 'ctx');
    cb('ground', -140, -120, 170, 54.5, E - 2, E - 0.3);
    cb('road', -140, 54.5, 170, 78, E - 2, E - 0.45);
    cb('ground', -140, 78, 170, 200, E - 2, E - 0.3);
    if (!GR) {
      // compound wall and gate piers, as drawn at the front of the plot
      cb('stone', 15.88, 54.1, 30.375, 54.5, GF - 0.3, GF + 5);
      cb('stone', 0, 52.8, 0.46, 54.5, GF - 0.3, GF + 6);
      cb('stone', 13.64, 53.65, 15.88, 54.5, GF - 0.3, GF + 6);
      cb('stone', 0, 47, 0.375, 52.8, GF - 0.3, GF + 5);
      cb('stone', 0, 39, 0.375, 46.25, GF - 0.3, GF + 5);
      cb('stone', 29.625, 50.54, 30.375, 54.5, GF - 0.3, GF + 5);
      for (let x = 0.9; x < 13.5; x += 0.55) cb('metal', x, 54.2, x + 0.1, 54.32, GF, GF + 5);
      cb('metal', 0.46, 54.18, 13.64, 54.34, GF + 4.8, GF + 5);
      cb('metal', 0.46, 54.18, 13.64, 54.34, GF + 0.2, GF + 0.4);
    } else {
      // entry gate between the piers drawn on the ground floor plan (11'-3" wide)
      const PL = GF + GR.PORCH;
      // two gate leaves, standing open into the porch
      const gp = GR.pillars.find((p) => p.id === 'gp-gate'), gx0 = gp ? gp.r[2] : 0.75, gx1 = 12, half = (gx1 - gx0) / 2;
      for (const [hx, dir] of [[gx0 + 0.12, 1], [gx1 - 0.12, -1]]) {
        const y1 = 54.25, y0 = y1 - half;
        for (let y = y0 + 0.25; y < y1 - 0.1; y += 0.55) cb('metal', hx - 0.06, y, hx + 0.06, y + 0.1, PL + 0.2, PL + 5.2);
        cb('metal', hx - 0.08, y0, hx + 0.08, y1, PL + 5.0, PL + 5.2);
        cb('metal', hx - 0.08, y0, hx + 0.08, y1, PL + 0.2, PL + 0.4);
        cb('metal', hx - 0.08, y0, hx + 0.08, y0 + 0.16, PL + 0.2, PL + 5.2);
        P.solids.push([hx - 0.1, y0, hx + 0.1, y1, PL, PL + 5.2]);
      }
    }
    // neighbouring buildings (plain blocks, only for depth in the views)
    const nb = (mk, x0, y0, x1, y1, h) => cb(mk, x0, y0, x1, y1, E - 0.3, E + h);
    nb('nb1', 30.4, 2, 58, 46, 11);
    nb('nb2', -74, 2, -44, 40, 22);
    // across the road: kept low (one storey) so they never stand between the dollhouse view and the home
    nb('nb3', -34, 84, -6, 122, 13);
    nb('nb1', 0, 86, 28, 124, 14);
    nb('nb2', 34, 84, 62, 120, 12);
    nb('nb3', 68, 86, 98, 122, 14);
    nb('nb1', -70, 84, -40, 120, 13);
    nb('nb2', -4, -86, 30, -50, 23);
    nb('nb3', 36, -88, 66, -52, 32);
    nb('nb1', -44, -84, -10, -50, 20);
    // windows on the facing sides of the houses across the road
    for (const [x0, x1, h, fy] of [[-34, -6, 13, 84], [0, 28, 14, 86], [34, 62, 12, 84], [68, 98, 14, 86], [-70, -40, 13, 84]])
      for (let fl = 0; fl * 10.5 + 9 < h; fl++)
        for (let x = x0 + 3; x + 4 < x1; x += 7.5) {
          cb('nbwin', x, fy - 0.06, x + 4, fy + 0.4, E + fl * 10.5 + 3.5, E + fl * 10.5 + 8);
          cb('nb1', x - 0.3, fy - 0.5, x + 4.3, fy + 0.2, E + fl * 10.5 + 8, E + fl * 10.5 + 8.4);
        }

    B.flush(groups);
    for (const m of extra) groups[m.userData.grp || 'main'].add(m);

    // trees along the road
    const trunkG = new T.CylinderGeometry(0.5, 0.7, 9, 8);
    const crownG = new T.IcosahedronGeometry(5.5, 1);
    for (const [x, y, s] of [[-14, 81, 1], [16, 81.5, 1.2], [44, 81, 0.9], [72, 82, 1.1], [-46, 81, 1], [-12, 58, 0.8], [40, 58.5, 0.9], [-17, 21, 1.0], [-16, -13, 0.9], [9, -21, 1.1], [27, -23, 0.95], [-19, 41, 0.85], [-30, 6, 1.1], [44, -30, 1.0]]) {
      const tr = new T.Mesh(trunkG, M.trunk);
      tr.position.set(x, E + 4.5 * s, y);
      tr.scale.setScalar(s);
      tr.castShadow = true;
      groups.ctx.add(tr);
      for (const [dx, dy, dz, r] of [[0, 12, 0, 1], [3, 10, 2, 0.75], [-3, 10.5, -1.5, 0.8], [0.5, 14.5, -1, 0.7]]) {
        const cr = new T.Mesh(crownG, dx > 0 ? M.leaf2 : M.leaf);
        cr.position.set(x + dx * s, E + dy * s, y + dz * s);
        cr.scale.setScalar(r * s);
        cr.castShadow = true;
        groups.ctx.add(cr);
      }
    }

    mergeStatic(groups.ctx); // the trees: a trunk and four crowns each
    scene.add(groups.main, groups.gmain, groups.both, groups.ceil, groups.ctx);
    A.groups = groups;
    return groups;
  };
})();
