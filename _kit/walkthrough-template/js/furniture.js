/* Furniture and fittings, built from simple shapes and sized to each room.
   Loose pieces are made facing "front" (+z) and then turned and placed.
   Built-ins (kitchen, wardrobes, panels) are drawn straight in plan coordinates. */
(function () {
  const A = (window.APP = window.APP || {});
  const T = THREE;

  A.buildFurniture = function (scene) {
    const P = A.plan, M = A.M, H = P.H, GF = P.GF;
    // one holder for everything, with a group per floor so a floor can be hidden on its own
    const all = new T.Group(), ff = new T.Group(), gf = new T.Group();
    all.name = 'furniture';
    ff.name = 'furniture-first';
    gf.name = 'furniture-ground';
    all.add(ff, gf);
    A.groups.furnAll = all;
    A.groups.furn = ff;
    A.groups.gfurn = gf;
    let root = ff, FG = 'furn'; // where new pieces go: switched to the ground floor further down
    A.blockers = [];
    const B = new A.Batcher();
    const pb = (mk, x0, y0, x1, y1, z0, z1) => B.box(mk, x0, y0, x1, y1, z0, z1, FG);
    // [x0, y0, x1, y1, floor level, top]: top = how high the piece reaches (unknown = tall)
    const block = (x0, y0, x1, y1, lvl, top) => A.blockers.push([x0 - 0.35, y0 - 0.35, x1 + 0.35, y1 + 0.35, lvl || 0, top === undefined ? Infinity : top]);

    // --- kit -----------------------------------------------------------------
    const cache = {};
    cache.ico = new T.IcosahedronGeometry(1, 1);
    function fix(geo, mat) { if (mat.userData && mat.userData.s) A.kit.worldUV(geo, mat.userData.s); return geo; }
    function mesh(geo, mat, x, y, z) {
      const m = new T.Mesh(geo, mat);
      m.castShadow = m.receiveShadow = true;
      m.position.set(x || 0, y || 0, z || 0);
      return m;
    }
    function bx(w, h, d, mat, x, y, z) { // y = height of the underside
      return mesh(fix(new T.BoxGeometry(w, h, d), mat), mat, x, (y || 0) + h / 2, z);
    }
    function rgeo(w, h, d, r) {
      const key = [w, h, d, r].map((v) => v.toFixed(3)).join('_');
      if (cache[key]) return cache[key];
      r = Math.min(r, w / 2 - 0.01, d / 2 - 0.01, h / 2 - 0.005);
      const b = r * 0.6, hw = w / 2 - b, hd = d / 2 - b, rr = Math.max(r - b, 0.01);
      const s = new T.Shape();
      s.moveTo(-hw + rr, -hd); s.lineTo(hw - rr, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + rr);
      s.lineTo(hw, hd - rr); s.quadraticCurveTo(hw, hd, hw - rr, hd);
      s.lineTo(-hw + rr, hd); s.quadraticCurveTo(-hw, hd, -hw, hd - rr);
      s.lineTo(-hw, -hd + rr); s.quadraticCurveTo(-hw, -hd, -hw + rr, -hd);
      const g = new T.ExtrudeGeometry(s, { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 5 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, b, 0);
      return (cache[key] = g);
    }
    function rb(w, h, d, r, mat, x, y, z) { return mesh(rgeo(w, h, d, r), mat, x, y || 0, z); }
    /* Soft furnishings modelled in Blender (blender/make_furniture.py): kind = 'seat', 'back',
       'pillow' or 'bedpillow', stretched to w x h x d and placed like rb (y = underside). */
    function soft(kind, w, h, d, mat, x, y, z) {
      if (!A.hasModel || !A.hasModel(kind)) return rb(w, h, d, Math.min(0.18, h * 0.4, w * 0.3, d * 0.3), mat, x, y, z);
      const s = A.modelSize(kind), g = A.model(kind, { fab: mat, pipe: mat });
      g.scale.set(w / s[0], h / s[1], d / s[2]);
      g.position.set(x || 0, y || 0, z || 0);
      return g;
    }
    // bedding draped in Blender: head edge at z0, lying on a mattress whose top is at y
    function bedding(name, duvet, runner, y, z0) {
      if (!A.hasModel || !A.hasModel(name)) return null;
      const g = A.model(name, { duvet, runner });
      g.position.set(0, y, z0);
      return g;
    }
    let plantTurn = 0;
    function cyl(r0, r1, h, mat, x, y, z, seg) {
      return mesh(new T.CylinderGeometry(r0, r1, h, seg || 24), mat, x, (y || 0) + h / 2, z);
    }
    function put(obj, X, Y, rot, z, solid) {
      obj.position.set(X, z || 0, Y);
      obj.rotation.y = ((rot || 0) * Math.PI) / 180;
      root.add(obj);
      if (solid !== false && obj.userData.foot) { // plants: only the pot is in the way, the leaves are not
        const f = obj.userData.foot;
        block(X - f, Y - f, X + f, Y + f, z || 0);
      } else if (solid !== false) {
        obj.updateMatrixWorld(true);
        const b = new T.Box3().setFromObject(obj);
        block(b.min.x, b.min.z, b.max.x, b.max.z, z || 0, b.max.y);
      }
      return obj;
    }

    // --- style variants: each style has its own furniture shapes, lights, frames and fittings ---
    const STYLE = A.style || 'luxury';
    const HW = { modern: 'black', scandi: 'black', luxury: 'brass' }[STYLE];    // cabinet handles
    const TAP = { modern: 'black', scandi: 'chrome', luxury: 'brass' }[STYLE];  // taps, rails, shower fittings
    const FRAME = { modern: 'black', scandi: 'teak', luxury: 'brass' }[STYLE];  // picture frames

    // --- room designs ---------------------------------------------------------------
    /* Every room has its own design: a calm palette (no bright colours), a furniture wood, a
       stone for table tops, a painted finish for its wardrobes, and its own sofa, chair and bed
       shapes, modelled in Blender. Doors and windows share one finish ('joinery', the architect's oak
       veneer, the same in every style); no furniture uses it. The style still changes the architecture, lights, frames,
       accessories, and the living rooms' sofa shape. */
    const DESIGN = {
      gHall: { title: 'Oat linen and cognac', sofa: STYLE === 'modern' ? 'tux' : 'track', chair: 'lounge', chairFab: 'leather',
        main: 0xd8d0c2, second: 0xa89c8c, accent: 0x9a6e4f, leather: 0x8b5e3f, wood: 'oak', top: 'travertine', lacquer: 0xd9d0c2, rug: ['#e7e0d3', '#b5a993', '#8f7e69'] },
      fLiving: { title: 'Ivory and charcoal', sofa: STYLE === 'scandi' ? 'track' : 'tux', chair: 'track', chairFab: 'second',
        main: 0xe6e1d8, second: 0x4d4d50, accent: 0xb4a38b, wood: 'oak', top: 'marbleW', lacquer: 0xe2ddd4, rug: ['#ebe7e0', '#4d4d50', '#b4a38b'] },
      fLounge: { title: 'Slate and linen', sofa: STYLE === 'modern' ? 'tux' : 'track', chair: 'tux', chairFab: 'second',
        main: 0x7d8893, second: 0xe3ded4, accent: 0x3e4752, wood: 'honey', top: 'travertine', lacquer: 0xd9d6cf, rug: ['#e3ded4', '#7d8893', '#3e4752'] },
      fMaster: { title: 'Greige and taupe', bed: 'channel', chair: 'lounge', chairFab: 'accent',
        main: 0xbcb1a2, second: 0xe9e3d9, accent: 0x7d6f62, duvet: 0xf3f0ea, throw: 0x9d8d7c, wood: 'oak', top: 'marbleW', lacquer: 0xd6cdc0, rug: ['#efebe4', '#bcb1a2', '#7d6f62'] },
      gMaster: { title: 'Mushroom and champagne', bed: 'wing', chair: 'lounge', chairFab: 'second',
        main: 0x8f8174, second: 0xc2ab84, accent: 0x6b5f55, duvet: 0xf0ebe3, throw: 0xb19c7c, wood: 'honey', top: 'travertine', lacquer: 0xcdc2b4, rug: ['#ece5da', '#8f8174', '#c2ab84'] },
      gGuest: { title: 'Dove grey and charcoal', bed: 'panel',
        main: 0x9da0a3, second: 0xe6e5e2, accent: 0x55595d, duvet: 0xf2f0eb, throw: 0x7c7f83, wood: 'oak', top: 'marbleW', lacquer: 0xd5d3ce, rug: ['#e9e7e2', '#9da0a3', '#55595d'] },
      gKids: { title: 'Sage and oat', bed: 'arch',
        main: 0xaeb7a6, second: 0xe6e1d5, accent: 0x7f8c7c, duvet: 0xeeebe3, throw: 0xd3cdbd, wood: 'ash', top: 'ash', lacquer: 0xc7cdbf, rug: ['#ece8df', '#aeb7a6', '#7f8c7c'] },
      terrace: { title: 'Stone and charcoal, outdoors', sofa: 'track',
        main: 0xcbc6bc, second: 0x5b5d60, accent: 0xa79a86, wood: 'honey', top: 'travertine', lacquer: 0xcbc6bc, rug: ['#d9d4ca', '#5b5d60', '#a79a86'] },
    };
    // curtains: the architect's fabric (print 'tex-curtain') everywhere; without the print, a deeper colour
    // from each room's own palette, so they stand out against the pale walls
    const CURTAIN = { gHall: 0x7a5641, fLiving: 0x46474a, fLounge: 0x3e4752, fMaster: 0x6f6256, gMaster: 0x5e5249, gGuest: 0x4e5257, gKids: 0x6f7d6c, terrace: 0x5b5d60 };
    const curtainDefault = () => A._curtainDefault || (A._curtainDefault = (() => { const f = M.fabIvory.clone(); f.color.setHex(0x7a6c5e); return f; })());
    // materials are made once per room and kept when the style changes
    const ROOMS = A._roomMats || (A._roomMats = {});
    function room(key) {
      const d = DESIGN[key];
      let m = ROOMS[key];
      if (!m) {
        const fab = (hex) => { const f = M.fabIvory.clone(); f.color.setHex(hex); return f; };
        const K = A.texKit, rt = K.tex(512, (g, s, Rn) => K.rug(g, s, Rn, d.rug[0], d.rug[1], d.rug[2]), 400 + Object.keys(ROOMS).length);
        rt.wrapS = rt.wrapT = T.ClampToEdgeWrapping;
        m = ROOMS[key] = {
          main: fab(d.main), second: fab(d.second), accent: fab(d.accent), duvet: fab(d.duvet || 0xf1eee8), throw: fab(d.throw || d.accent), curtain: fab(CURTAIN[key] || d.accent),
          leather: new T.MeshStandardMaterial({ color: d.leather || d.accent, roughness: 0.48, metalness: 0.0 }),
          lacquer: new T.MeshStandardMaterial({ color: d.lacquer, roughness: 0.5 }),
          rug: new T.MeshStandardMaterial({ map: rt, roughness: 1 }),
        };
        M['lac_' + key] = m.lacquer; // so wardrobes and built-ins can be drawn in it
      }
      return Object.assign({ key }, d, m, { wood: M[d.wood], woodKey: d.wood, top: M[d.top], topKey: d.top, metal: M.brass });
    }
    // which room a point is in (for wardrobes): the room list from plan.js, by name
    const ROOM_OF = { 'Living & Dining': 'fLiving', 'Family Lounge': 'fLounge', 'Master Bedroom': 'fMaster', Dress: 'fMaster', 'Master Toilet': 'fMaster',
      'Living / Dining Hall': 'gHall', "Children's Bedroom": 'gKids', 'Guest Bedroom': 'gGuest', 'G:Master Bedroom': 'gMaster' };
    function roomAt(x, y, ground) {
      const list = ground ? (P.ground ? P.ground.rooms : []) : P.rooms;
      for (const r of list) if (x > r.r[0] && x < r.r[2] && y > r.r[1] && y < r.r[3]) return ROOM_OF[(ground && r.name === 'Master Bedroom' ? 'G:' : '') + r.name] || (r.name === 'Kitchen' ? 'kitchen' : null);
      return null;
    }

    // --- furniture modelled in Blender, painted in a room's design ------------------------
    const has = (n) => !!(A.hasModel && A.hasModel(n));
    function sofaR(w, R) { // a sofa w feet long: the room's family (track arm or tuxedo), three or two seats
      const fam = R.sofa || 'track', name = 'sofa_' + fam + (w >= 6 ? '3' : '2');
      if (!has(name)) return sofa(w, R.main, R.second, R.accent);
      const g = new T.Group(), s = A.modelSize(name), m = A.model(name, { body: R.main, cushion: R.main, leg: R.wood });
      m.scale.x = w / s[0];
      g.add(m);
      const seat = (fam === 'tux' ? 0.84 : 0.97) + 0.4;
      const pil = [[-w / 2 + 1.15, R.second, 0.3], [-w / 2 + 1.95, R.accent, 0.12], [w / 2 - 1.15, R.second, -0.3]];
      for (const [x, mat, turn] of w >= 6 ? pil : [pil[0], pil[2]]) {
        const p = soft('pillow', 1.3, 1.3, 0.42, mat, x, seat, -0.6);
        p.rotation.set(-0.3, turn, 0);
        g.add(p);
      }
      return g;
    }
    function armchair(R) { // the room's chair: track arm, tuxedo or an armless lounge chair
      const kind = R.chair || 'track', name = kind === 'lounge' ? 'chair_lounge' : 'chair_' + kind;
      const fabm = R.chairFab === 'leather' ? R.leather : R[R.chairFab] || R.main;
      if (!has(name)) return sofa(2.9, fabm, null, null, 2.8);
      const g = new T.Group();
      g.add(A.model(name, { body: fabm, cushion: fabm, leg: R.wood }));
      if (kind !== 'lounge') { const p = soft('pillow', 1.1, 1.1, 0.4, R.main === fabm ? R.accent : R.main, 0, 1.3, -0.55); p.rotation.x = -0.3; g.add(p); }
      return g;
    }
    /* the room's bed with layered bedding: white sheets, a pale duvet, a throw. size: [width, length] of the
       mattress in feet (as beds are sold: 6 x 6, 6 x 6.5), the frame and headboard round it; the headboard
       stays where it was, the bed shortens or lengthens at its foot. userData.footIn: how far the foot moved in. */
    function bedR(R, twin, size) {
      const kind = twin ? 'arch' : R.bed || 'panel', name = 'bed_' + kind, W = twin ? 3.4 : 6, L = twin ? 6.5 : 6.75, top = 1.75;
      if (!has(name)) return bed();
      const outer = new T.Group(), g = new T.Group();
      outer.add(g);
      g.add(A.model(name, { head: R.main, base: R.main, mattress: M.fabWhite, leg: R.wood }));
      outer.userData.footIn = 0;
      if (size) {
        const box = (r) => { const p = A.modelParts(name).find((q) => q.r === r); if (!p) return null; p.geo.computeBoundingBox(); return p.geo.boundingBox; };
        const mat = box('mattress'), head = box('head'), base = box('base');
        if (mat && head) {
          const kx = size[0] / (mat.max.x - mat.min.x), kz = size[1] / (mat.max.z - mat.min.z), zh = head.min.z, zf = Math.max(mat.max.z, base ? base.max.z : mat.max.z);
          outer.scale.set(kx, 1, kz);
          g.position.z = (zh * (1 - kz)) / kz; // the headboard's back stays put
          outer.userData.footIn = (1 - kz) * (zf - zh);
        }
      }
      const dv = bedding(twin ? 'bedding_twin' : 'bedding', R.duvet, R.throw, top, -L / 2 + 0.05);
      if (dv) g.add(dv); else g.add(rb(W + 0.2, 0.26, L * 0.6, 0.1, R.duvet, 0, top - 0.05, L / 2 - L * 0.3 + 0.08));
      const sides = twin ? [0] : [-1, 1];
      for (const sx of sides) {
        const p = soft('bedpillow', twin ? 2.3 : 2.6, 1.3, 0.5, M.fabWhite, sx * 1.45, top - 0.02, -L / 2 + 0.55); p.rotation.x = -0.3; g.add(p);
        const q = soft('pillow', twin ? 1.4 : 1.8, 0.95, 0.42, sx < 0 ? R.second : R.main, sx * 1.25, top + 0.02, -L / 2 + 1.12); q.rotation.x = -0.36; g.add(q);
      }
      if (!twin) { const lum = soft('pillow', 2.0, 0.7, 0.36, R.accent, 0, top + 0.05, -L / 2 + 1.55); lum.rotation.x = -0.4; g.add(lum); }
      return outer;
    }
    function benchR(R) {
      if (!has('bench')) return bench(R.main);
      return A.model('bench', { fab: R.main, wood: R.wood });
    }
    function chairR(R, fabm) { // dining or desk chair
      if (!has('chair_dining')) return chair(fabm || R.second);
      return A.model('chair_dining', { fab: fabm || R.second, wood: R.wood });
    }
    function nightstand(R, k) { // bedside chest of drawers in the room's painted finish, with a lamp and books
      if (!has('nightstand')) return roundTable(0.75, 1.9, R.wood, M.brass);
      const g = new T.Group(), m = A.model('nightstand', { body: R.lacquer, front: R.lacquer, pull: M.brass, leg: R.wood });
      if (k) m.scale.set(k, 1, 1);
      g.add(m);
      const lp = tableLamp(); lp.position.set(-0.35, 2.0, -0.15); g.add(lp);
      if (has('books')) { const bk = A.model('books', { cover: R.accent, pages: M.white }); bk.scale.setScalar(0.7); bk.position.set(0.45, 2.0, 0.2); bk.rotation.y = 0.3; g.add(bk); }
      return g;
    }
    function consoleR(R, w) { // reeded sideboard, w feet wide
      if (!has('console')) { const g = new T.Group(); g.add(bx(w, 2.0, 1.4, R.lacquer, 0, 0.55, 0)); return g; }
      const g = new T.Group(), m = A.model('console', { body: R.wood, front: R.wood, top: R.top, pull: M.brass, leg: R.wood });
      m.scale.x = w / A.modelSize('console')[0];
      g.add(m);
      return g;
    }
    function diningR(R) { // racetrack table on turned pedestals, four upholstered chairs, laid for four
      if (!has('table_dining')) return dining();
      const g = new T.Group();
      g.add(A.model('table_dining', { top: R.top, base: R.wood }));
      for (const sx of [-1.1, 1.1]) {
        const c1 = chairR(R); c1.position.set(sx, 0, -1.95); g.add(c1);
        const c2 = chairR(R); c2.position.set(sx, 0, 1.95); c2.rotation.y = Math.PI; g.add(c2);
        for (const sz of [-0.98, 0.98]) {
          g.add(cyl(0.44, 0.44, 0.03, M.ceramic, sx, 2.5, sz, 28));
          g.add(cyl(0.27, 0.27, 0.03, R.second, sx, 2.53, sz, 20));
          const gl = cyl(0.09, 0.07, 0.36, M.glass, sx + 0.48, 2.5, sz - Math.sign(sz) * 0.3, 12);
          gl.castShadow = false;
          g.add(gl);
        }
      }
      g.add(bx(3.9, 0.014, 0.9, R.second, 0, 2.5, 0)); // linen runner
      if (has('candles')) { const c = A.model('candles', { holder: M.brass, wax: M.white }); c.position.set(-0.5, 2.5, 0); g.add(c); }
      if (has('bowl')) { const b = A.model('bowl', { ceramic: M.ceramic }); b.position.set(0.55, 2.5, 0); g.add(b); }
      return g;
    }
    // a print made in Blender (blender/make_wallpaper.py) as a material: a carpet with a soft woven feel
    function printMat(name) {
      const P2 = window.WALLPAPERS && window.WALLPAPERS[name];
      if (!P2) return null;
      const cache2 = A._prints || (A._prints = {});
      if (cache2[name]) return cache2[name];
      const tx = new T.TextureLoader().load(P2.src);
      tx.colorSpace = T.SRGBColorSpace;
      tx.anisotropy = 8;
      const m = new T.MeshStandardMaterial({ map: tx, roughness: 1, normalMap: M.fabIvory.normalMap, normalScale: new T.Vector2(0.35, 0.35) });
      m.userData.aspect = P2.w / P2.h;
      return (cache2[name] = m);
    }
    /* A panel in one of the architect's prints (made in Blender), solid: the print on its face and wrapped round
       its edges and top, so its thickness shows the same material. On a wall running along ax, from a0 to a1
       along it, standing on the wall face at 'wall' and coming out toward dir (+1 or -1) by 'thick', z0 to z1
       high. fit 'height': the design's height fills the panel and a centred slice of its width shows; a
       number: the print already repeats seamlessly and tiles, that many feet across one repeat. False if no print. */
    function printPanel(name, ax, a0, a1, wall, dir, thick, z0, z1, fit) {
      const P2 = window.WALLPAPERS && window.WALLPAPERS[name];
      if (!P2) return false;
      const cache2 = A._prints || (A._prints = {}), key = 'panel:' + name;
      let mat = cache2[key];
      if (!mat) {
        const tx = new T.TextureLoader().load(P2.src);
        tx.colorSpace = T.SRGBColorSpace;
        tx.anisotropy = 8;
        tx.wrapS = tx.wrapT = T.RepeatWrapping;
        mat = cache2[key] = new T.MeshStandardMaterial({ map: tx, roughness: 0.7 });
      }
      const w = a1 - a0, h = z1 - z0, d = thick, asp = P2.w / P2.h;
      // texture coordinates on the face, per foot along (du) and up (dv)
      const fr = fit === 'height' ? Math.min(1, w / (h * asp)) : 0;
      const du = fit === 'height' ? fr / w : 1 / fit, dv = fit === 'height' ? 1 / h : asp / fit, u0 = fit === 'height' ? 0.5 - fr / 2 : 0;
      const bg = new T.BoxGeometry(w, h, d), p = bg.attributes.position, n = bg.attributes.normal, uv = bg.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + w / 2, y = p.getY(i) + h / 2, back = d / 2 - p.getZ(i); // back: depth in from the face
        let u = u0 + x * du, v = y * dv;
        if (Math.abs(n.getX(i)) > 0.5) u += (n.getX(i) > 0 ? back : -back) * du; // the ends: the print runs on round the edge
        else if (Math.abs(n.getY(i)) > 0.5) v += (n.getY(i) > 0 ? back : -back) * dv; // top and bottom
        uv.setXY(i, u, v);
      }
      const m = new T.Mesh(bg, mat);
      if (ax === 'x') { m.rotation.y = dir > 0 ? 0 : Math.PI; m.position.set((a0 + a1) / 2, (z0 + z1) / 2, wall + (dir * d) / 2); }
      else { m.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; m.position.set(wall + (dir * d) / 2, (z0 + z1) / 2, (a0 + a1) / 2); }
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
      return true;
    }
    function decorOn(x, y, z, R, kind) { // a small still life on a table or sideboard top
      const g = new T.Group();
      if (kind === 'vase' && has('vase_tall')) { const v = A.model('vase_tall', { ceramic: R.lacquer }); g.add(v); }
      if (kind === 'pair' && has('vase_round')) { const v = A.model('vase_round', { ceramic: M.ceramic }); v.position.x = -0.35; g.add(v); if (has('books')) { const b = A.model('books', { cover: R.accent, pages: M.white }); b.position.set(0.55, 0, 0.05); b.rotation.y = -0.2; g.add(b); } }
      if (kind === 'books' && has('books')) g.add(A.model('books', { cover: R.accent, pages: M.white }));
      g.position.set(x, z, y);
      root.add(g);
      return g;
    }
    function legs(g, w, d, h, mat, r, splay) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const l = cyl(r, r * 0.6, h, mat, sx * (w / 2 - 0.2), 0, sz * (d / 2 - 0.2), 10);
        if (splay) { l.rotation.z = -sx * splay; l.rotation.x = sz * splay; }
        g.add(l);
      }
    }
    function sofaV(w, fab, pA, pB, d) {
      d = d || 3.0;
      const g = new T.Group();
      if (STYLE === 'modern') { // low and square on a recessed plinth
        g.add(bx(w - 0.5, 0.22, d - 0.5, M.black, 0, 0, 0));
        g.add(rb(w, 0.4, d, 0.04, fab, 0, 0.22, 0));
        { const ns = Math.max(1, Math.round((w - 1.5) / 2.2)), sw = (w - 1.5) / ns;
          for (let i = 0; i < ns; i++) g.add(soft('seat', sw - 0.03, 0.44, d - 0.8, fab, -(w - 1.5) / 2 + sw * (i + 0.5), 0.6, 0.3)); }
        g.add(rb(w, 1.25, 0.55, 0.05, fab, 0, 0.62, -d / 2 + 0.275));
        for (const sx of [-1, 1]) g.add(rb(0.75, 0.75, d, 0.05, fab, sx * (w / 2 - 0.375), 0.62, 0));
        if (pA) { const p = soft('pillow', 1.5, 0.8, 0.4, pA, -w / 2 + 1.7, 1.02, -d / 2 + 0.85); p.rotation.x = -0.25; g.add(p); }
      } else { // light, on tapered timber legs, loose cushions and a throw
        legs(g, w, d, 0.65, M.teak, 0.09, 0.12);
        g.add(rb(w, 0.32, d, 0.1, fab, 0, 0.65, 0));
        const n = Math.max(1, Math.round((w - 0.6) / 2.3)), cw = (w - 0.6) / n;
        for (let i = 0; i < n; i++) {
          const x = -(w - 0.6) / 2 + cw * (i + 0.5);
          g.add(soft('seat', cw - 0.05, 0.46, d - 0.6, fab, x, 0.93, 0.22));
          const b = soft('back', cw - 0.08, 1.15, 0.46, fab, x, 1.3, -d / 2 + 0.5);
          b.rotation.x = -0.16;
          g.add(b);
        }
        g.add(rb(w, 1.3, 0.22, 0.08, fab, 0, 0.9, -d / 2 + 0.11));
        for (const sx of [-1, 1]) g.add(rb(0.26, 1.0, d, 0.1, fab, sx * (w / 2 - 0.13), 0.9, 0));
        if (pA) {
          g.add(rb(0.5, 0.06, d * 0.9, 0.02, pA, w / 2 - 0.4, 1.92, 0));
          const p = soft('pillow', 1.2, 1.2, 0.4, pB || pA, -w / 2 + 1.0, 1.36, -d / 2 + 0.95);
          p.rotation.set(-0.3, 0.2, 0);
          g.add(p);
        }
      }
      return g;
    }
    function tableV(r, h, top) {
      const g = new T.Group();
      if (STYLE === 'modern') { // stone slab on a dark block
        if (h < 1.5) { g.add(bx(r * 1.7, h - 0.22, r * 1.0, M.black, 0, 0, 0)); g.add(bx(r * 2.3, 0.14, r * 1.35, M.quartz, 0, h - 0.2, 0)); }
        else { g.add(cyl(r * 0.75, r * 0.75, h, M.black, 0, 0, 0, 32)); g.add(cyl(r * 0.8, r * 0.8, 0.05, M.quartz, 0, h, 0, 32)); }
      } else { // round timber top on three splayed legs
        g.add(cyl(r, r, 0.09, top, 0, h - 0.09, 0, 40));
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI * 2) / 3, l = cyl(0.06, 0.04, h - 0.05, M.teak, Math.cos(a) * r * 0.55, 0, Math.sin(a) * r * 0.55, 8);
          l.rotation.z = -Math.cos(a) * 0.16; l.rotation.x = Math.sin(a) * 0.16;
          g.add(l);
        }
      }
      return g;
    }
    function lampV() {
      const g = new T.Group();
      if (STYLE === 'modern') { // thin black stem with a small directed head
        g.add(cyl(0.45, 0.45, 0.05, M.black, 0, 0, 0)); g.add(cyl(0.03, 0.03, 5.4, M.black, 0, 0.05, 0, 8));
        g.add(bx(1.5, 0.05, 0.05, M.black, 0.72, 5.4, 0)); g.add(cyl(0.28, 0.34, 0.3, M.black, 1.45, 5.1, 0, 20));
        const d = cyl(0.26, 0.26, 0.03, M.glow, 1.45, 5.08, 0, 20); d.castShadow = false; g.add(d);
      } else { // timber tripod with a linen drum shade
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI * 2) / 3, l = cyl(0.04, 0.05, 4.4, M.teak, Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5, 8);
          l.rotation.z = Math.cos(a) * 0.2; l.rotation.x = -Math.sin(a) * 0.2;
          g.add(l);
        }
        if (A.hasModel && A.hasModel('shade_drum')) { const sh = A.model('shade_drum', { shade: M.glowSoft, bulb: M.glow }, { shadow: false }); sh.position.y = 4.2; g.add(sh); }
        else { const sh = cyl(0.7, 0.7, 1.0, M.glowSoft, 0, 4.2, 0, 28); sh.castShadow = false; g.add(sh); }
      }
      return g;
    }
    function chairV(fab) {
      const g = new T.Group();
      if (STYLE === 'modern') { // slim seat and low back on a black frame
        for (const sx of [-1, 1]) { g.add(bx(0.07, 1.3, 0.07, M.black, sx * 0.66, 0, 0.6)); g.add(bx(0.07, 2.6, 0.07, M.black, sx * 0.66, 0, -0.62)); g.add(bx(0.07, 0.07, 1.3, M.black, sx * 0.66, 0, 0)); }
        g.add(rb(1.4, 0.16, 1.4, 0.05, fab, 0, 1.3, 0)); g.add(rb(1.4, 0.75, 0.14, 0.05, fab, 0, 1.9, -0.62));
      } else { // timber chair with spindles, a top rail and a seat pad
        legs(g, 1.5, 1.45, 1.34, M.teak, 0.06, 0.08);
        g.add(rb(1.4, 0.1, 1.35, 0.04, M.teak, 0, 1.32, 0)); g.add(rb(1.2, 0.09, 1.15, 0.04, fab, 0, 1.42, 0.02));
        for (const sx of [-1, 1]) g.add(cyl(0.045, 0.045, 1.35, M.teak, sx * 0.6, 1.4, -0.62, 8));
        for (const sx of [-0.3, 0, 0.3]) g.add(cyl(0.025, 0.025, 1.1, M.teak, sx, 1.4, -0.62, 6));
        g.add(rb(1.45, 0.28, 0.12, 0.05, M.teak, 0, 2.55, -0.62));
      }
      return g;
    }
    function diningV() {
      const g = new T.Group();
      if (STYLE === 'modern') { // stone top on two dark slab legs
        g.add(bx(4.8, 0.12, 3.0, M.quartz, 0, 2.38, 0));
        for (const sx of [-1, 1]) g.add(bx(0.22, 2.38, 2.2, M.black, sx * 1.6, 0, 0));
        g.add(bx(1.6, 0.06, 0.5, M.black, 0, 2.5, 0));
        for (const sx of [-0.45, 0, 0.45]) g.add(mesh(new T.SphereGeometry(0.16, 14, 10), M.ceramic, sx, 2.72, 0));
      } else { // soft-cornered timber table, a vase of branches
        g.add(rb(4.6, 0.13, 3.0, 0.5, M.teak, 0, 2.37, 0));
        legs(g, 4.2, 2.6, 2.37, M.teak, 0.11, 0.1);
        g.add(cyl(0.2, 0.28, 0.75, M.potWhite, 0, 2.5, 0, 16));
        for (let k = 0; k < 5; k++) {
          const b = cyl(0.012, 0.012, 1.3, M.trunk, (k - 2) * 0.05, 3.2, 0, 5);
          b.rotation.z = (k - 2) * 0.16;
          g.add(b);
          g.add(mesh(new T.IcosahedronGeometry(0.14, 0), M.leaf2, (k - 2) * 0.24, 4.45 - Math.abs(k - 2) * 0.08, 0));
        }
      }
      for (const sx of [-1.1, 1.1]) {
        const c1 = chairV(M.fabSand); c1.position.set(sx, 0, -1.95); g.add(c1);
        const c2 = chairV(M.fabSand); c2.position.set(sx, 0, 1.95); c2.rotation.y = Math.PI; g.add(c2);
        for (const sz of [-0.98, 0.98]) {
          g.add(cyl(0.44, 0.44, 0.03, M.ceramic, sx, 2.5, sz, 28));
          const gl = cyl(0.09, 0.07, 0.36, M.glass, sx + 0.48, 2.5, sz - Math.sign(sz) * 0.3, 12);
          gl.castShadow = false;
          g.add(gl);
        }
      }
      return g;
    }
    function bedV() {
      const g = new T.Group(), W = 6, L = 6.75;
      if (STYLE === 'modern') { // low platform, wide flat headboard with a ledge
        g.add(bx(W + 1.8, 0.45, L + 0.9, M.walnut, 0, 0.12, 0.3)); g.add(bx(W + 1.0, 0.12, L + 0.2, M.black, 0, 0, 0.3));
        g.add(rb(W, 0.7, L - 0.15, 0.08, M.fabWhite, 0, 0.57, 0.05));
        const dv = bedding('bedding', M.fabGrey, null, 1.27, -L / 2 + 0.05);
        if (dv) g.add(dv); else g.add(rb(W + 0.1, 0.24, L * 0.62, 0.06, M.fabGrey, 0, 1.2, L / 2 - L * 0.31 + 0.08));
        for (const sx of [-1, 1]) {
          const p = soft('bedpillow', 2.6, 1.3, 0.5, M.fabWhite, sx * 1.45, 1.22, -L / 2 + 0.55); p.rotation.x = -0.32; g.add(p);
          const q = soft('pillow', 1.9, 0.95, 0.42, sx < 0 ? M.fabTeal : M.fabTerra, sx * 1.25, 1.25, -L / 2 + 1.1); q.rotation.x = -0.36; g.add(q);
        }
        g.add(bx(W + 3.4, 2.9, 0.22, M.walnut, 0, 0.12, -L / 2 - 0.2)); g.add(bx(W + 3.4, 0.08, 0.5, M.black, 0, 3.02, -L / 2 - 0.06));
      } else { // timber frame on legs, slatted headboard, layered linen
        legs(g, W + 0.2, L, 0.7, M.teak, 0.1, 0);
        g.add(bx(W + 0.3, 0.3, L + 0.15, M.teak, 0, 0.7, 0)); g.add(rb(W, 0.75, L - 0.15, 0.14, M.fabWhite, 0, 1.0, 0.05));
        const dv = bedding('bedding', M.fabIvory, M.fabTeal, 1.75, -L / 2 + 0.05);
        if (dv) g.add(dv); else { g.add(rb(W + 0.2, 0.28, L * 0.6, 0.12, M.fabIvory, 0, 1.7, L / 2 - L * 0.3 + 0.08)); g.add(rb(W + 0.26, 0.1, 1.6, 0.04, M.fabTeal, 0, 1.97, L / 2 - 1.2)); }
        for (const sx of [-1, 1]) {
          const p = soft('bedpillow', 2.5, 1.25, 0.5, M.fabWhite, sx * 1.45, 1.7, -L / 2 + 0.55); p.rotation.x = -0.3; g.add(p);
          const q = soft('pillow', 1.6, 0.95, 0.4, sx < 0 ? M.fabTerra : M.fabMustard, sx * 1.2, 1.74, -L / 2 + 1.12); q.rotation.x = -0.36; g.add(q);
        }
        for (let k = 0; k < 11; k++) g.add(bx(0.2, 2.6, 0.1, M.teak, -3.0 + k * 0.6, 1.0, -L / 2 - 0.1));
        g.add(bx(W + 0.5, 0.22, 0.16, M.teak, 0, 3.6, -L / 2 - 0.1));
      }
      return g;
    }
    function pendantV(X, Y, drop, r, shadeMat, lvl, ceil) {
      const g = new T.Group();
      g.add(cyl(0.012, 0.012, (ceil || H) - drop, M.black, 0, drop, 0, 6));
      if (STYLE === 'modern') { // slim black tube
        const len = shadeMat ? 1.2 : 0.7;
        g.add(cyl(0.085, 0.085, len, M.black, 0, drop - len, 0, 14));
        const d = cyl(0.075, 0.075, 0.04, M.glow, 0, drop - len - 0.03, 0, 12); d.castShadow = false; g.add(d);
      } else if (shadeMat) { // wide white dome
        if (A.hasModel && A.hasModel('dome')) {
          const k = (r * 3.4) / A.modelSize('dome')[0], dm = A.model('dome', { shade: M.white, bulb: M.glow }, { shadow: false });
          dm.scale.setScalar(k); dm.position.y = drop - A.modelSize('dome')[1] * k; g.add(dm);
        } else {
          g.add(cyl(0.16, r * 1.7, r * 1.15, M.white, 0, drop - r * 1.15, 0, 28));
          const d = cyl(r * 1.3, r * 1.3, 0.03, M.glow, 0, drop - r * 1.15 - 0.01, 0, 20); d.castShadow = false; g.add(d);
        }
      } else { // paper globe
        const sp = mesh(new T.SphereGeometry(r * 1.35, 20, 14), M.glowSoft, 0, drop - r * 1.35, 0); sp.castShadow = false; g.add(sp);
      }
      g.position.set(X, lvl || 0, Y);
      root.add(g);
    }

    // --- loose pieces --------------------------------------------------------
    function sofa(w, fab, pillowA, pillowB, d) {
      if (STYLE !== 'luxury') return sofaV(w, fab, pillowA, pillowB, d);
      d = d || 3.0;
      const g = new T.Group(), arm = 0.5;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(0.16, 0.36, 0.16, M.walnut, sx * (w / 2 - 0.25), 0, sz * (d / 2 - 0.25)));
      g.add(rb(w, 0.55, d, 0.12, fab, 0, 0.35, 0));
      g.add(rb(w, 2.0, 0.42, 0.14, fab, 0, 0.35, -d / 2 + 0.21));
      for (const sx of [-1, 1]) g.add(rb(arm, 1.5, d, 0.16, fab, sx * (w / 2 - arm / 2), 0.35, 0));
      const inner = w - 2 * arm, n = Math.max(1, Math.round(inner / 2.1)), cw = inner / n;
      for (let i = 0; i < n; i++) {
        const x = -inner / 2 + cw * (i + 0.5);
        g.add(soft('seat', cw - 0.04, 0.54, d - 0.75, fab, x, 0.86, 0.3));
        const bk = soft('back', cw - 0.06, 1.24, 0.54, fab, x, 1.3, -d / 2 + 0.68);
        bk.rotation.x = -0.14;
        g.add(bk);
      }
      if (pillowA) {
        const p1 = soft('pillow', 1.25, 1.25, 0.44, pillowA, -inner / 2 + 0.75, 1.34, -d / 2 + 1.12);
        p1.rotation.set(-0.3, 0.25, 0);
        g.add(p1);
        const p2 = soft('pillow', 1.15, 1.15, 0.42, pillowB || pillowA, inner / 2 - 0.7, 1.34, -d / 2 + 1.12);
        p2.rotation.set(-0.3, -0.3, 0);
        g.add(p2);
      }
      return g;
    }
    function roundTable(r, h, top, base) { // coffee table (low) or side table, modelled in Blender
      const name = h < 1.5 ? 'table_coffee' : 'table_side';
      if (has(name)) {
        const s = A.modelSize(name), k = (2 * r) / s[0], g = new T.Group(), m = A.model(name, { top, base });
        m.scale.set(k, h / s[1], k);
        g.add(m);
        return g;
      }
      if (STYLE !== 'luxury') return tableV(r, h, top);
      const g = new T.Group();
      g.add(cyl(r, r, 0.12, top, 0, h - 0.12, 0, 40));
      g.add(cyl(0.09, 0.09, h - 0.16, base, 0, 0.04, 0, 12));
      g.add(cyl(r * 0.55, r * 0.6, 0.06, base, 0, 0, 0, 32));
      return g;
    }
    function floorLamp() {
      if (STYLE !== 'luxury') return lampV();
      const g = new T.Group();
      g.add(cyl(0.5, 0.55, 0.08, M.brass, 0, 0, 0));
      g.add(cyl(0.04, 0.04, 4.7, M.brass, 0, 0.08, 0, 8));
      if (A.hasModel && A.hasModel('shade_cone')) { const sh = A.model('shade_cone', { shade: M.glowSoft, bulb: M.glow }, { shadow: false }); sh.position.y = 4.45; g.add(sh); return g; }
      const sh = cyl(0.55, 0.75, 0.95, M.glowSoft, 0, 4.5, 0, 28);
      sh.castShadow = false;
      g.add(sh);
      return g;
    }
    function tableLamp() {
      if (A.hasModel && A.hasModel('tablelamp')) return A.model('tablelamp', { base: STYLE === 'scandi' ? M.potWhite : STYLE === 'modern' ? M.black : M.pot, shade: M.glowSoft, bulb: M.glow }, { shadow: false });
      const g = new T.Group();
      g.add(cyl(0.16, 0.24, 0.7, M.pot, 0, 0, 0));
      const sh = cyl(0.3, 0.45, 0.55, M.glowSoft, 0, 0.72, 0, 24);
      sh.castShadow = false;
      g.add(sh);
      return g;
    }
    function plant(h, pot, big) {
      const name = big ? 'plant_tall' : 'plant_bush';
      if (A.hasModel && A.hasModel(name)) { // modelled in Blender: real leaves on stems in a turned pot
        const s = A.modelSize(name), k = big ? h / s[1] : Math.min(1.35, Math.pow(h / s[1], 0.6));
        const inner = A.model(name, { pot: pot || M.pot, soil: M.soil, stem: M.trunk, leaf: M.leafFine, leaf2: M.leafFine2 });
        inner.scale.setScalar(k);
        inner.rotation.y = (plantTurn++ * 2.39996) % (Math.PI * 2); // each plant turned differently
        const g = new T.Group();
        g.add(inner);
        g.userData.foot = (big ? 0.8 : 0.55) * k + 0.1;
        return g;
      }
      const g = new T.Group(), R = big ? 0.8 : 0.55;
      g.add(cyl(R, R * 0.72, R * 1.7, pot || M.pot, 0, 0, 0, 20));
      const geo = cache.ico || (cache.ico = new T.IcosahedronGeometry(1, 1));
      const n = big ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const a = i * 2.4, rr = (i % 3) * R * 0.45, m = mesh(geo, i % 2 ? M.leaf : M.leaf2);
        const s = R * (0.75 + ((i * 37) % 10) / 22);
        m.scale.set(s, s * 1.5, s);
        m.position.set(Math.cos(a) * rr, R * 1.7 + (h - R * 1.7) * (0.25 + (i / n) * 0.7), Math.sin(a) * rr);
        g.add(m);
      }
      return g;
    }
    function chair(fab) {
      if (STYLE !== 'luxury') return chairV(fab);
      const g = new T.Group();
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(0.11, 1.32, 0.11, M.walnut, sx * 0.62, 0, sz * 0.6));
      g.add(soft('seat', 1.45, 0.28, 1.45, fab, 0, 1.28, 0));
      const bk = soft('back', 1.45, 1.5, 0.24, fab, 0, 1.5, -0.66);
      bk.rotation.x = -0.1;
      g.add(bk);
      return g;
    }
    function dining() {
      if (STYLE !== 'luxury') return diningV();
      const g = new T.Group();
      g.add(rb(4.6, 0.15, 3.0, 0.06, M.teak, 0, 2.35, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(0.2, 2.35, 0.2, M.teak, sx * 1.95, 0, sz * 1.15));
      for (const sx of [-1.1, 1.1]) {
        const c1 = chair(M.fabSand); c1.position.set(sx, 0, -1.95); g.add(c1);
        const c2 = chair(M.fabSand); c2.position.set(sx, 0, 1.95); c2.rotation.y = Math.PI; g.add(c2);
      }
      g.add(cyl(0.55, 0.35, 0.3, M.brass, 0, 2.52, 0, 24));
      g.add(bx(4.1, 0.014, 0.95, M.fabTerra, 0, 2.5, 0)); // table runner
      for (const sx of [-1.1, 1.1]) for (const sz of [-0.98, 0.98]) { // four place settings
        g.add(cyl(0.44, 0.44, 0.03, M.ceramic, sx, 2.5, sz, 28));
        g.add(cyl(0.27, 0.27, 0.03, M.fabSand, sx, 2.53, sz, 20));
        const gl = cyl(0.09, 0.07, 0.36, M.glass, sx + 0.48, 2.5, sz - Math.sign(sz) * 0.3, 12);
        gl.castShadow = false;
        g.add(gl);
      }
      return g;
    }
    function bed() {
      if (STYLE !== 'luxury') return bedV();
      const g = new T.Group(), W = 6, L = 6.75;
      g.add(bx(W + 0.3, 0.75, L + 0.2, M.walnut, 0, 0.25, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(0.2, 0.25, 0.2, M.black, sx * (W / 2 - 0.2), 0, sz * (L / 2 - 0.2)));
      g.add(rb(W, 0.8, L - 0.15, 0.12, M.fabWhite, 0, 1.0, 0.05));
      const dv = bedding('bedding', M.fabSand, M.fabTerra, 1.8, -L / 2 + 0.05);
      if (dv) g.add(dv);
      else {
        g.add(rb(W + 0.24, 0.3, L * 0.6, 0.1, M.fabSand, 0, 1.72, L / 2 - L * 0.3 + 0.08));
        g.add(rb(W + 0.24, 0.2, 0.9, 0.08, M.fabIvory, 0, 1.86, L / 2 - L * 0.6 - 0.3));
        g.add(rb(W + 0.3, 0.12, 1.5, 0.05, M.fabTerra, 0, 2.02, L / 2 - 1.15));
      }
      for (const sx of [-1, 1]) {
        const p = soft('bedpillow', 2.6, 1.35, 0.52, M.fabWhite, sx * 1.45, 1.73, -L / 2 + 0.55);
        p.rotation.x = -0.28;
        g.add(p);
        const q = soft('pillow', 1.9, 1.0, 0.44, sx < 0 ? M.fabTeal : M.fabMustard, sx * 1.25, 1.76, -L / 2 + 1.15);
        q.rotation.x = -0.35;
        g.add(q);
      }
      g.add(bx(W + 2.8, 4.5, 0.2, M.walnut, 0, 0.2, -L / 2 - 0.2));
      const n = 7, cw = (W + 0.7) / n;
      for (let i = 0; i < n; i++) g.add(rb(cw - 0.05, 3.3, 0.3, 0.1, M.fabSand, -(W + 0.7) / 2 + cw * (i + 0.5), 1.15, -L / 2 - 0.02));
      return g;
    }
    function bench(fab) {
      const g = new T.Group();
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(0.1, 0.95, 0.1, M.brass, sx * 1.9, 0, sz * 0.5));
      g.add(rb(4.2, 0.45, 1.3, 0.14, fab, 0, 0.95, 0));
      return g;
    }
    function wc() {
      const g = new T.Group();
      g.add(rb(1.2, 1.1, 1.75, 0.4, M.ceramic, 0, 0.25, 0.02));
      g.add(rb(1.16, 0.1, 1.5, 0.35, M.white, 0, 1.36, 0.1));
      g.add(bx(0.9, 0.55, 0.05, M[TAP], 0, 3.1, -0.86));
      return g;
    }
    function curtain(w, h) {
      const geo = new T.PlaneGeometry(w, h, Math.max(8, Math.round(w * 14)), 1), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9.5) * 0.09 + Math.sin(p.getX(i) * 23) * 0.02);
      geo.computeVertexNormals();
      const m = new T.Mesh(geo, M.sheer);
      m.receiveShadow = true;
      m.renderOrder = 7;
      return m;
    }
    function hang(c, X, Y, rot, top) { // curtain placed by its centre, top edge at "top"
      const h = c.geometry.parameters.height;
      c.position.set(X, top - h / 2, Y);
      c.rotation.y = ((rot || 0) * Math.PI) / 180;
      root.add(c);
    }
    function rugAt(mat, X, Y, w, d, z) {
      const m = mesh(new T.BoxGeometry(w, 0.04, d), mat, X, (z || 0) + 0.02, Y);
      m.castShadow = false;
      root.add(m);
    }
    /* Every painting on the walls is different: its own composition (landscape, colour field,
       arches, bands, botanical, moon, grid, abstract), palette and brushwork, drawn to the
       frame's own proportions. Each style hangs a different set. */
    const PALETTES = [
      ['#efe9df', '#b49a7c', '#6e6458', '#d8c7ad', '#3f3a35'], ['#e8e4dc', '#8c9a8f', '#c9bfae', '#4f5a55', '#e2d5c0'],
      ['#f1ece4', '#c4a484', '#8a7360', '#e6d8c4', '#2f2b28'], ['#e6e3de', '#9aa3ab', '#5d6670', '#d9d4cb', '#c2b39b'],
      ['#ede6da', '#a98f73', '#d4c3a8', '#7c6a58', '#f6f1e8'], ['#e9e2d6', '#b9a99a', '#7f8c86', '#d8cdbd', '#45403b'],
      ['#f0ebe5', '#c7b8a6', '#8f8174', '#b9c2bd', '#3d3a37'], ['#e5ded3', '#a77b5f', '#d9c3a5', '#5f5a52', '#efe6d8'],
      ['#e7e7e3', '#b8bdb5', '#7d8580', '#d7cfc2', '#2e3231'], ['#efe8dd', '#cdb89a', '#9c8466', '#e4d9c8', '#514840'],
    ];
    const KINDS = ['landscape', 'field', 'arches', 'lines', 'botanical', 'moon', 'grid', 'abstract'];
    const ART = A._artCache || (A._artCache = {});
    let artN = 0;
    function uniqueArt(w, h) {
      const n = artN++, off = { modern: 0, scandi: 3, luxury: 5 }[STYLE] || 0, key = STYLE + ':' + n;
      if (ART[key]) return ART[key];
      const cw = 512, ch = Math.max(192, Math.min(1024, Math.round((512 * h) / w))), c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      A.texKit.painting(c.getContext('2d'), cw, ch, A.texKit.rng(900 + n * 31 + off * 7), PALETTES[(n * 3 + off) % PALETTES.length], KINDS[(n + off) % KINDS.length]);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = 8;
      return (ART[key] = new T.MeshStandardMaterial({ map: t, roughness: 0.9 }));
    }
    function artAt(mat, ax, a0, a1, face, dir, z0, z1) {
      if (STYLE === 'scandi' && a1 - a0 > 2.6 && !artAt.inner) { // a row of three smaller frames, three different pictures
        artAt.inner = true;
        const gap = 0.25, w3 = (a1 - a0 - 2 * gap) / 3;
        for (let k = 0; k < 3; k++) artAt(mat, ax, a0 + k * (w3 + gap), a0 + k * (w3 + gap) + w3, face, dir, z0 + (k === 1 ? 0 : 0.35), z1 - (k === 1 ? 0 : 0.35));
        artAt.inner = false;
        return;
      }
      if (A.texKit && A.texKit.painting) mat = uniqueArt(a1 - a0, z1 - z0); // this frame's own painting
      if (STYLE === 'luxury') { // a brass picture light over each painting
        const m = (a0 + a1) / 2, e0 = Math.min(face, face + 0.16 * dir), e1 = Math.max(face, face + 0.16 * dir);
        if (ax === 'x') { pb('brass', m - 0.7, e0, m + 0.7, e1, z1 + 0.3, z1 + 0.38); pb('glow', m - 0.6, e0, m + 0.6, e1, z1 + 0.27, z1 + 0.3); }
        else { pb('brass', e0, m - 0.7, e1, m + 0.7, z1 + 0.3, z1 + 0.38); pb('glow', e0, m - 0.6, e1, m + 0.6, z1 + 0.27, z1 + 0.3); }
      } // framed canvas on a wall face
      const f = 0.09, t = 0.1;
      if (ax === 'x') {
        const y0 = dir > 0 ? face : face - t, y1 = dir > 0 ? face + t : face;
        pb(FRAME, a0 - f, y0, a1 + f, y1, z0 - f, z1 + f);
        const m = mesh(new T.PlaneGeometry(a1 - a0, z1 - z0), mat, (a0 + a1) / 2, (z0 + z1) / 2, dir > 0 ? y1 + 0.006 : y0 - 0.006);
        if (dir < 0) m.rotation.y = Math.PI;
        m.castShadow = false;
        root.add(m);
      } else {
        const x0 = dir > 0 ? face : face - t, x1 = dir > 0 ? face + t : face;
        pb(FRAME, x0, a0 - f, x1, a1 + f, z0 - f, z1 + f);
        const m = mesh(new T.PlaneGeometry(a1 - a0, z1 - z0), mat, dir > 0 ? x1 + 0.006 : x0 - 0.006, (z0 + z1) / 2, (a0 + a1) / 2);
        m.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        m.castShadow = false;
        root.add(m);
      }
    }
    function pendant(X, Y, drop, r, shadeMat, lvl, ceil) { // lvl = floor level, ceil = that floor's ceiling height
      if (STYLE !== 'luxury') return pendantV(X, Y, drop, r, shadeMat, lvl, ceil); // hangs from the ceiling
      const g = new T.Group();
      g.add(cyl(0.012, 0.012, (ceil || H) - drop, M.black, 0, drop, 0, 6));
      if (shadeMat) {
        g.add(cyl(0.12, r, r * 1.1, shadeMat, 0, drop - r * 1.1, 0, 24));
        const d = cyl(r * 0.8, r * 0.8, 0.03, M.glow, 0, drop - r * 1.1 - 0.01, 0, 20);
        d.castShadow = false;
        g.add(d);
      } else {
        const s = mesh(new T.SphereGeometry(r, 20, 14), M.glow, 0, drop - r, 0);
        s.castShadow = false;
        g.add(s);
        g.add(cyl(0.07, 0.07, 0.12, M.brass, 0, drop - 0.02, 0, 10));
      }
      g.position.set(X, lvl || 0, Y);
      root.add(g);
    }
    // a run of cabinet doors on a face. ax = direction the run goes along.
    function cabRun(mk, ax, a0, a1, face, dir, z0, z1, depth, doorW) {
      if (ax === 'x') pb(mk, a0, dir > 0 ? face - depth : face, a1, dir > 0 ? face : face + depth, z0, z1);
      else pb(mk, dir > 0 ? face - depth : face, a0, dir > 0 ? face : face + depth, a1, z0, z1);
      const n = Math.max(1, Math.round((a1 - a0) / doorW)), w = (a1 - a0) / n, g = 0.012, e = 0.012 * dir;
      for (let i = 0; i <= n; i++) {
        const u = a0 + i * w;
        if (ax === 'x') pb('black', u - g, Math.min(face, face + e), u + g, Math.max(face, face + e), z0, z1);
        else pb('black', Math.min(face, face + e), u - g, Math.max(face, face + e), u + g, z0, z1);
      }
      if (STYLE === 'modern') return; // handleless fronts
      for (let i = 0; i < n; i++) {
        const u = a0 + (i + 0.5) * w, hz = z1 - z0 > 4 ? (z0 + z1) / 2 : z0 > 3 ? z0 + 0.25 : z1 - 0.3, hh = STYLE === 'scandi' ? 0.05 : z1 - z0 > 4 ? 0.5 : 0.04, hw = STYLE === 'scandi' ? 0.05 : z1 - z0 > 4 ? 0.03 : 0.4; // small knobs or long bars
        const f0 = Math.min(face, face + 0.06 * dir), f1 = Math.max(face, face + 0.06 * dir);
        const off = z1 - z0 > 4 ? (i % 2 ? -w / 2 + 0.14 : w / 2 - 0.14) : 0;
        if (ax === 'x') pb(HW, u + off - hw, f0, u + off + hw, f1, hz - hh, hz + hh);
        else pb(HW, f0, u + off - hw, f1, u + off + hw, hz - hh, hz + hh);
      }
    }

    // ===== Living and dining (open to the lounge) ==============================
    // design: ivory boucle and charcoal, oak, white marble
    const RL = room('fLiving');
    // TV wall between the rear window (ends 6'-0¾") and the glazed door: a panel 2" thick, up to 8 ft, faced with
    // the architect's print ('tv-panel', made in Blender) when it is there, fluted otherwise. The design's height
    // fills the panel and a slice of its width shows, so its shapes keep a true size. The TV and console stand
    // off the panel's face (PF).
    const PF = 0.375 + 2 / 12;
    printPanel('tv-panel', 'x', 6.15, 9.36, 0.375, 1, PF - 0.375, 0, 8, 'height') || pb('fluted', 6.15, 0.375, 9.36, PF, 0, 8);
    pb(RL.woodKey, 6.25, PF, 9.3, PF + 1.3, 0.55, 1.6);
    pb('black', 6.45, PF + 0.15, 9.1, PF + 1.15, 0.25, 0.55);
    pb('screen', 6.33, PF, 9.18, PF + 0.12, 3.0, 4.6);
    block(6.15, 0.4, 9.36, PF + 1.3);
    put(sofaR(6, RL), 7.0, 8.6, 180);
    put(armchair(RL), 2.2, 5.1, 70);
    put(roundTable(1.35, 1.25, RL.top, RL.wood), 7.0, 5.1, 0);
    if (STYLE !== 'luxury') decorOn(6.6, 4.8, 1.25, RL, 'pair'); // (Warm luxury has its brass tray there)
    rugAt(RL.rug, 6.6, 5.9, 8.6, 6.4);
    put(floorLamp(), 0.6, 1.4, 0, 0, false);
    put(plant(4.6, M.potWhite, true), 0.9, 12.0, 0);
    put(diningR(RL), 14.3, 7.9, 0);
    pendant(13.3, 7.9, 6.5, 0.42, M.brass);
    pendant(14.3, 7.9, 6.2, 0.42, M.brass);
    pendant(15.3, 7.9, 6.5, 0.42, M.brass);
    put(consoleR(RL, 5.3), 15.95, 1.55, 0);                // reeded sideboard against the rear wall
    put(tableLamp(), 17.7, 1.4, 0, 2.65, false);
    decorOn(16.5, 1.45, 2.65, RL, 'vase');
    artAt(M.art1, 'x', 14.1, 17.3, 0.75, 1, 4.0, 6.5);
    artAt(M.art2, 'y', 11.0, 13.9, -0.25, 1, 3.8, 6.4);

    // ===== Kitchen: main room plus a utility leg along the south wall =========
    pb('black', 19.3, 0.75, 29.625, 2.6, 0, 0.3);
    cabRun('sage', 'x', 19.3, 27.625, 2.75, 1, 0.3, 2.75, 2.0, 1.9);
    pb('sage', 27.625, 0.75, 29.625, 5.2, 0.3, 2.75);
    cabRun('sage', 'y', 2.75, 5.2, 27.625, -1, 0.3, 2.75, 0.02, 1.25);
    pb('quartz', 19.25, 0.75, 29.625, 2.82, 2.75, 2.9);
    pb('quartz', 27.56, 2.82, 29.625, 5.26, 2.75, 2.9);
    pb('steel', 23.6, 1.15, 25.6, 2.4, 2.9, 2.915);
    pb('black', 23.75, 1.3, 25.45, 2.25, 2.905, 2.92);
    pb(TAP, 24.55, 0.95, 24.65, 1.05, 2.9, 3.85);
    pb(TAP, 24.55, 0.95, 24.65, 1.75, 3.78, 3.85);
    pb('black', 20.2, 1.1, 21.9, 2.3, 2.9, 2.93);      // hob
    pb('steel', 20.1, 0.78, 22.0, 2.0, 5.3, 5.75);     // hood
    pb('steel', 20.7, 0.78, 21.4, 1.4, 5.75, H);
    cabRun('teak', 'x', 26.95, 29.625, 1.95, 1, 4.6, 7.2, 1.2, 1.35);
    cabRun('teak', 'y', 1.95, 5.2, 28.45, -1, 4.6, 7.2, 1.175, 1.1);
    // tiles above the counter, round the window (22'-5½" to 25'-11½", sill 3'-10")
    pb('bathwall', 19.3, 0.75, 29.625, 0.78, 2.9, 3.74);
    pb('bathwall', 19.3, 0.75, 22.45, 0.78, 3.74, 5.3);
    pb('bathwall', 25.95, 0.75, 29.625, 0.78, 3.74, 4.6);
    pb('bathwall', 29.595, 0.75, 29.625, 5.2, 2.9, 4.6);
    block(19.25, 0.75, 29.625, 2.82);
    block(27.56, 2.75, 29.625, 5.26);
    pb('teak', 22.3, 1.25, 23.3, 2.05, 2.9, 2.95);      // counter styling
    pb('ceramic', 26.0, 1.0, 26.35, 1.35, 2.9, 3.5);
    pb('pot', 26.5, 1.0, 26.8, 1.3, 2.9, 3.35);
    root.add(cyl(0.42, 0.28, 0.2, M.ceramic, 28.6, 2.9, 3.6, 24));
    for (const [fx, fy] of [[28.5, 3.55], [28.72, 3.68], [28.6, 3.78]]) root.add(mesh(new T.SphereGeometry(0.13, 12, 10), M.fabMustard, fx, 3.14, fy));
    // the utility leg is left clear: the wardrobe drawn there in the editor fills its end

    // ===== Common washroom ====================================================
    pb('bathwall', 19.2085, 14.215, 26.75, 14.25, 0, H);
    pb('bathwall', 19.2085, 8.125, 26.75, 8.16, 0, H);
    pb('bathwall', 26.715, 8.125, 26.75, 14.25, 0, H);
    pb('bathwall', 19.2085, 10.4, 19.245, 14.25, 0, H);
    pb('bathwall', 19.2085, 8.125, 19.245, 10.4, 7, H);
    pb('oak', 22.0, 8.16, 25.5, 9.85, 1.3, 2.6);
    pb('quartz', 21.95, 8.16, 25.55, 9.9, 2.6, 2.75);
    root.add(cyl(0.6, 0.45, 0.4, M.ceramic, 23.75, 2.75, 9.05, 32));
    pb(TAP, 23.7, 8.3, 23.8, 8.4, 2.75, 3.6);
    pb(TAP, 23.7, 8.3, 23.8, 8.8, 3.52, 3.6);
    pb('mirror3', 22.2, 8.16, 25.3, 8.2, 3.5, 6.5);
    pb('glow', 22.2, 8.16, 25.3, 8.215, 6.58, 6.7);
    block(22.0, 8.16, 25.5, 9.9);
    put(wc(), 20.9, 13.34, 180);
    pb('glass', 23.55, 11.7, 23.6, 14.215, 0.05, 7);    // shower corner
    pb('glass', 24.9, 10.95, 26.715, 11.0, 0.05, 7);
    pb(TAP, 23.55, 11.7, 23.6, 14.215, 7, 7.08);
    pb(TAP, 24.9, 10.95, 26.715, 11.0, 7, 7.08);
    pb(TAP, 25.4, 12.6, 26.715, 12.7, 7.4, 7.48);
    root.add(cyl(0.5, 0.5, 0.06, M[TAP], 25.3, 7.28, 12.65, 28));
    pb(TAP, 26.64, 12.4, 26.715, 12.9, 3.6, 4.4);

    // ===== Family lounge ======================================================
    // design: slate blue-grey and linen, honey teak, travertine
    const RF = room('fLounge');
    put(sofaR(4.8, RF), 1.97, 21.1, 90);
    put(armchair(RF), 2.7, 17.3, 40);
    put(roundTable(0.8, 1.7, RF.top, RF.wood), 4.5, 18.9, 0);
    decorOn(4.5, 18.9, 1.7, RF, 'books');
    rugAt(RF.rug, 3.7, 21.0, 5.2, 7.6);
    put(floorLamp(), 0.95, 24.7, 0, 0, false);
    put(plant(4.2, M.pot, true), 1.2, 26.95, 0);
    put(plant(3.2, M.potWhite), 0.95, 15.25, 0);
    artAt(M.art3, 'y', 15.3, 17.5, 0.375, 1, 3.8, 6.4);
    put(plant(4.4, M.pot, true), 12.2, 15.9, 0);
    artN++; // bedroom-east, gallery side: no painting (the architect's call); the count stays so the other paintings keep their pictures

    // chandelier dropping into the void
    {
      const cx = P.voidCenter[0], cy = P.voidCenter[1];
      root.add(cyl(1.5, 1.5, 0.08, M.brass, cx, H - 0.08, cy, 40));
      for (let i = 0; i < 13; i++) {
        const a = i * 2.39996, rr = 0.35 + 0.115 * i;
        pendant(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 7.2 - i * 0.44, 0.27 + (i % 3) * 0.05, null);
      }
    }

    // ===== Master bedroom =====================================================
    // design: greige channel-tufted bed, taupe, oak, white marble
    const RM = room('fMaster');
    const bedM = put(bedR(RM, false, [6, 6.5]), 18.6, 34.9, -90); // a 6' x 6'-6" bed, the 6' side on the wall
    put(benchR(RM), 14.1 + bedM.userData.footIn, 34.9, -90);       // the bench stays at the bed's foot
    put(nightstand(RM), 21.4, 30.75, -90);
    put(nightstand(RM), 21.4, 39.05, -90);
    pendant(21.4, 30.75, 4.9, 0.3, null);
    pendant(21.4, 39.05, 4.9, 0.3, null);
    rugAt(RM.rug, 17.0, 34.9, 9.2, 8.6);
    // TV wall: a panel 2" thick up to 7 ft, all in the architect's hexagon wood ('tex-hexwood', made in
    // Blender, tiling 6 ft across a repeat, about 9" a hexagon), fluted to the ceiling without the print;
    // the TV and console stand off the panel's face (MF). It runs 31'-7" to 38'-2", centred on the bed: the
    // bedroom door opens flat against this wall up to 31'-6", and its edge would otherwise meet the panel
    const MF = 9.25 + 2 / 12, HEX = !!(window.WALLPAPERS && window.WALLPAPERS['tex-hexwood']), P0 = HEX ? 31.6 : 31.3, P1 = HEX ? 38.2 : 38.5;
    printPanel('tex-hexwood', 'y', P0, P1, 9.25, 1, MF - 9.25, 0, 7, 6) || pb('fluted', 9.25, P0, 9.31, P1, 0, H);
    const MC = HEX ? MF : 9.31;
    pb(RM.woodKey, MC, 32.0, MC + 1.24, 37.8, 0.55, 1.7);
    pb('black', MC + 0.14, 32.2, MC + 1.09, 37.6, 0.25, 0.55);
    pb('screen', MC, 32.9, MC + 0.12, 36.9, 2.9, 5.2);
    block(9.25, 32.0, MC + 1.24, 37.8);
    put(armchair(RM), 11.3, 43.7, 35);
    put(roundTable(0.65, 1.6, RM.top, RM.metal), 13.6, 44.9, 0);
    put(floorLamp(), 9.95, 45.5, 0, 0, false);
    artAt(M.art2, 'y', 33.3, 36.5, 22.25, -1, 5.7, 7.5);

    // ===== Dress ==============================================================
    // wardrobes come from the plan (they can be added and moved in the editor)
    function wardrobeSet(list, lvl) {
      for (const w of list) {
        const [x0, y0, x1, y1] = w.r, alongX = w.face === 'rear' || w.face === 'front', dir = w.face === 'front' || w.face === 'south' ? 1 : -1;
        const a0 = alongX ? x0 : y0, a1 = alongX ? x1 : y1, depth = alongX ? y1 - y0 : x1 - x0;
        const face = alongX ? (dir > 0 ? y1 : y0) : (dir > 0 ? x1 : x0);
        if (a1 - a0 < 0.5 || depth < 0.3) continue;
        // painted in the finish of the room it stands in (never the doors' colour)
        const rk = roomAt((x0 + x1) / 2, (y0 + y1) / 2, lvl < -1);
        const fin = rk === 'kitchen' ? 'sage' : rk && DESIGN[rk] ? (room(rk), 'lac_' + rk) : 'oak';
        cabRun(fin, alongX ? 'x' : 'y', a0, a1, face, dir, lvl, lvl + w.h, depth, 1.6);
        if (w.mirror) {
          const m0 = a0 + (a1 - a0) * 0.26, m1 = a0 + (a1 - a0) * 0.74, f0 = Math.min(face, face + 0.035 * dir), f1 = Math.max(face, face + 0.035 * dir), top = lvl + Math.min(w.h - 0.3, 7.4);
          if (alongX) pb('mirror', m0, f0, m1, f1, lvl + 0.4, top); else pb('mirror', f0, m0, f1, m1, lvl + 0.4, top);
        }
        block(x0, y0, x1, y1, lvl);
      }
    }
    wardrobeSet(P.wardrobes, 0);
    { const pf = new T.Group(); pf.add(cyl(0.6, 0.55, 1.3, RM.accent, 0, 0, 0, 28)); put(pf, 24.2, 43.3, 0, 0, false); }

    // ===== Master toilet ======================================================
    pb('bathwall', 22.625, 28.25, 22.66, 37.875, 0, H);
    pb('bathwall', 22.625, 28.25, 29.625, 28.285, 0, H);
    pb('bathwall', 29.59, 31.25, 29.625, 37.875, 0, H);
    pb('bathwall', 29.215, 28.25, 29.25, 31.25, 0, H);
    pb('bathwall', 22.625, 37.84, 24.0, 37.875, 0, H);
    pb('bathwall', 26.75, 37.84, 29.625, 37.875, 0, H);
    pb('oak', 27.95, 33.4, 29.59, 37.4, 1.3, 2.6);
    pb('quartz', 27.9, 33.35, 29.59, 37.45, 2.6, 2.75);
    root.add(cyl(0.62, 0.45, 0.42, M.ceramic, 28.72, 2.75, 35.4, 32));
    pb(TAP, 29.3, 35.35, 29.4, 35.45, 2.75, 3.6);
    pb(TAP, 28.9, 35.35, 29.4, 35.45, 3.52, 3.6);
    pb('mirror2', 29.55, 33.6, 29.59, 37.2, 3.4, 6.7);
    pb('glow', 29.535, 33.6, 29.59, 37.2, 6.78, 6.9);
    block(27.95, 33.4, 29.625, 37.4);
    put(wc(), 23.54, 33.9, 90);
    pb('glass', 22.66, 31.55, 27.0, 31.6, 0.05, 7);
    pb(TAP, 22.66, 31.53, 27.0, 31.62, 7, 7.08);
    pb(TAP, 25.75, 28.285, 25.85, 30.0, 7.4, 7.48);
    root.add(cyl(0.5, 0.5, 0.06, M[TAP], 25.8, 7.28, 30.0, 28));
    pb(TAP, 24.6, 28.285, 25.0, 28.36, 3.6, 4.4);
    pb(TAP, 22.66, 35.5, 22.74, 37.3, 4.2, 4.27);
    pb('fabWhite', 22.68, 35.7, 22.8, 37.0, 2.6, 4.25);

    // ===== Terrace and balconies ==============================================
    // design: stone and charcoal outdoor seating, honey teak, travertine
    const RT = room('terrace');
    put(sofaR(5, RT), 1.97, 33.6, 90);
    put(roundTable(1.1, 1.25, RT.top, RT.wood), 4.6, 33.6, 0);
    put(plant(4.4, M.pot, true), 1.3, 29.8, 0);
    pb('pot', 0.95, 45.75, 5.35, 46.5, 0, 1.3);
    block(0.95, 45.75, 5.35, 46.5);
    for (let i = 0; i < 6; i++) {
      const s = mesh(cache.ico, i % 2 ? M.leaf : M.leaf2, 1.1 + i * 0.72, 1.75 + (i % 3) * 0.12, 46.12);
      s.scale.set(0.55, 0.62, 0.45);
      root.add(s);
    }
    put(plant(3.4, M.potWhite), 8.3, 38.2, 0);
    // the pergola stays open: no dining table or chairs (the architect's call)
    put(plant(4.0, M.pot, true), 8.15, 45.2, 0);
    put(plant(3.6, M.pot, true), 6.4, 49.5, 0);        // clear of the balcony parapets
    put(plant(3.0, M.potWhite), 16.9, 49.6, 0);
    put(plant(3.2, M.potWhite), -2.3, 1.2, 0);
    put(plant(3.6, M.pot, true), -2.3, 12.9, 0);
    put(plant(3.0, M.pot), 6.5, -1.1, 0);
    put(plant(3.2, M.potWhite), 20.5, -1.1, 0);

    if (!P.ground) { // ===== Placeholder room under the void (no ground floor drawing) =====
      put(sofa(7, M.fabGrey, M.fabSand, M.fabSand), 15.5, 16.3, 0, GF);
      put(sofa(2.9, M.fabSand, null, null, 2.8), 10.9, 20.2, 90, GF);
      put(roundTable(1.5, 1.25, M.teak, M.metal), 15.5, 20.2, 0, GF);
      rugAt(M.rugGF, 15.5, 19.6, 10.5, 7.2, GF);
      put(plant(6, M.potWhite, true), 22.2, 23.0, 0, GF);
    }

    // ===== Accessories, different in each style ================================
    if (STYLE === 'modern') { // sculptural vase and sphere, a tray, one block sculpture
      root.add(cyl(0.12, 0.2, 1.3, M.black, 6.2, 1.6, 1.1, 18));
      root.add(mesh(new T.SphereGeometry(0.28, 16, 12), M.ceramic, 8.6, 1.88, 1.1));
      pb('black', 14.2, 1.0, 15.6, 1.9, 2.65, 2.71);
      root.add(cyl(0.3, 0.3, 0.5, M.ceramic, 14.9, 2.71, 1.45, 20));
      pb('black', 9.6, 33.6, 10.3, 34.3, 1.7, 2.6);
    } else if (STYLE === 'scandi') { // more plants, a basket with a throw, books, candles
      put(plant(3.6, M.potWhite, true), 12.2, 22.9, 0);
      put(plant(2.6, M.potWhite), 15.5, 1.4, 0, 2.65, false);
      put(plant(3.0, M.potWhite), 21.6, 45.4, 0);
      { const bk = new T.Group(); bk.add(cyl(0.7, 0.55, 1.1, M.fabSand, 0, 0, 0, 20)); bk.add(rb(1.0, 0.5, 1.0, 0.2, M.fabIvory, 0, 0.85, 0)); put(bk, 3.2, 9.4, 0); }
      for (let k = 0; k < 4; k++) pb(k % 2 ? 'fabGrey' : 'fabIvory', 13.6 + k * 0.32, 1.0, 13.86 + k * 0.32, 1.7, 2.65, 3.4 - k * 0.08);
      root.add(cyl(0.09, 0.09, 0.5, M.white, 6.2, 1.6, 1.1, 12));
      root.add(cyl(0.09, 0.09, 0.7, M.white, 6.55, 1.6, 1.15, 12));
    } else { // brass vase, a tray with candles, a ceramic urn
      root.add(cyl(0.18, 0.3, 1.1, M.brass, 6.2, 1.6, 1.1, 20));
      root.add(cyl(0.6, 0.6, 0.04, M.brass, 7.0, 1.25, 5.1, 28));
      root.add(cyl(0.1, 0.1, 0.45, M.white, 6.8, 1.29, 5.0, 12));
      root.add(cyl(0.1, 0.1, 0.3, M.white, 7.2, 1.29, 5.2, 12));
      root.add(cyl(0.22, 0.14, 0.8, M.pot, 14.4, 2.65, 1.4, 18));
      pb('brass', 9.6, 33.7, 10.3, 34.2, 1.7, 1.76);
    }

    // ===== Curtains on every outside window and glazed door ======================
    /* Found from the plan, so they follow the editor: an opening with a room on one side and
       the outdoors (or a terrace, balcony or porch) on the other gets a rod with ball finials on
       two brackets above it, and two pleated drapes pulled back to its sides, on the room side,
       in a colour from that room's palette that stands out from the walls. Drapes reach the
       floor, or stop at the sill where a window sits above a counter. Toilets keep their frosted
       glass; high clerestory windows are left bare. Rod, finials, brackets and drapes are modelled
       in Blender. */
    function roomNameAt(x, y, ground) {
      const list = ground ? (P.ground ? P.ground.rooms : []) : P.rooms;
      for (const r of list) if (!r.area && x > r.r[0] && x < r.r[2] && y > r.r[1] && y < r.r[3]) return r.name;
      return '';
    }
    // a printed fabric keeps one true size on every drape: the drape (1 ft square, stretched to the panel) gets
    // its own texture coordinates in feet, s feet to a repeat, so a wide or tall panel is not a stretched picture
    function fabricUV(g, w, h, s) {
      g.traverse((o) => {
        if (!o.isMesh) return;
        const geo = o.geometry.clone(), p = geo.attributes.position, uv = geo.attributes.uv;
        for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) * w) / s, (p.getY(i) * h) / s);
        o.geometry = geo;
      });
    }
    /* How far the furniture under some drapes comes out from the wall face (feet): rays toward the wall, across
       each drape's stretch [u0, u1] and from z0 to z1 above this floor, against the pieces placed so far. */
    function standOff(spans, face, side, z0, z1, ax, lvl) {
      const rc = new T.Raycaster(), meshes = [];
      root.updateMatrixWorld(true);
      root.traverse((o) => { if (o.isMesh) meshes.push(o); });
      let far = 0;
      for (const [u0, u1] of spans) {
        if (u1 - u0 < 0.4) continue;
        for (let i = 0; i <= 4; i++) for (let k = 0; k <= 3; k++) {
          const u = u0 + ((u1 - u0) * i) / 4, z = lvl + z0 + ((z1 - z0) * k) / 3;
          rc.set(ax === 'x' ? new T.Vector3(u, z, face + side * 3) : new T.Vector3(face + side * 3, z, u), ax === 'x' ? new T.Vector3(0, 0, -side) : new T.Vector3(-side, 0, 0));
          rc.far = 3;
          const hit = rc.intersectObjects(meshes, false)[0];
          if (hit) far = Math.max(far, 3 - hit.distance);
        }
      }
      return far;
    }
    function curtainsFor(walls, floors, lvl, ceil, ground) {
      if (!has('drape') || !has('rod') || !has('finial') || !has('bracket')) return 0;
      const inside = (x, y) => floors.find((f) => x > f[0] && x < f[2] && y > f[1] && y < f[3]);
      let n = 0;
      for (const w of walls) {
        const base = w.base || 0, ax = w.ax, t0 = ax === 'x' ? w.r[1] : w.r[0], t1 = ax === 'x' ? w.r[3] : w.r[2];
        // this wall's outside openings on this floor: windows, glazed and timber doors, open doorways
        const outs = [];
        for (const o of w.ops || []) {
          if (!['win', 'gdoor', 'door', 'open'].includes(o.type)) continue;
          const sill = base + (o.sill || 0) - lvl, head = base + o.head - lvl; // above this floor's finish
          if (sill < -0.5 || sill > 6 || head > ceil + 0.5) continue;           // another floor's opening, or a clerestory
          const k = o.corner, a = k && k.end === 'a' ? k.at : o.a, b = k && k.end === 'b' ? k.at : o.b, uc = (a + b) / 2;
          const p0 = ax === 'x' ? [uc, t0 - 0.4] : [t0 - 0.4, uc], p1 = ax === 'x' ? [uc, t1 + 0.4] : [t1 + 0.4, uc];
          const f0 = inside(p0[0], p0[1]), f1 = inside(p1[0], p1[1]);
          if (!!f0 === !!f1) continue; // a room on both sides, or on neither: not an outside opening
          const pr = f0 ? p0 : p1;
          if (/toilet|washroom|w\.c|bath|kitchen|store/i.test(roomNameAt(pr[0], pr[1], ground))) continue; // no curtains in toilets, kitchens or the store
          // a door whose leaves stand open on the room side keeps drapes off it (they would meet the leaves)
          const leavesIn = (o.type === 'door' || o.type === 'gdoor') && o.isOpen && (o.swing > 0 ? 1 : -1) === (f0 ? -1 : 1);
          outs.push({ a, b, sill, head, side: f0 ? -1 : 1, f: f0 || f1, pr, low: o.type !== 'win', ca: !!(k && k.end === 'a'), cb: !!(k && k.end === 'b'), doors: leavesIn ? [[a, b]] : [] });
        }
        // openings side by side (a door between two narrow windows) hang from one rod, drapes at the outer ends
        outs.sort((p, q) => p.a - q.a);
        const groups = [];
        for (const s of outs) {
          const gl = groups[groups.length - 1];
          if (gl && gl.side === s.side && s.a - gl.b < 1.0) Object.assign(gl, { b: Math.max(gl.b, s.b), head: Math.max(gl.head, s.head), sill: Math.min(gl.sill, s.sill), low: gl.low || s.low, cb: s.cb, n: gl.n + 1, doors: gl.doors.concat(s.doors) });
          else groups.push(Object.assign({ n: 1 }, s));
        }
        for (const gp of groups) {
          const { a, b, side, f, pr, ca, cb } = gp, uc = (a + b) / 2;
          const rk = roomAt(pr[0], pr[1], ground), mat = M.curtainFab.map ? M.curtainFab : rk && DESIGN[rk] ? room(rk).curtain : curtainDefault();
          const lo = (ax === 'x' ? f[0] : f[1]) + 0.08, hi = (ax === 'x' ? f[2] : f[3]) - 0.08; // stay inside the room
          const pw = Math.min(1.8, Math.max(1.0, 0.18 * (b - a) + 0.8));
          const l0 = Math.max(lo, a - 0.65 * pw), r1 = Math.min(hi, b + 0.65 * pw);
          const rodZ = Math.min(gp.head + 0.4, ceil - 0.2);
          // a corner window keeps its corner clear: no drape and no finial there, the two rods meet
          let D = 0.27; // the rod's stand-off from the wall face
          const rl = ca ? lo - 0.08 + D : Math.max(lo, l0 - 0.2), rr = cb ? hi + 0.08 - D : Math.min(hi, r1 + 0.2);
          // furniture standing where a drape would hang (a bed head, a sofa, a desk): the drape moves to
          // the nearest free stretch on its own side of the opening, rather than vanish
          const hits = [], dz0 = side > 0 ? t1 : t0 - 0.5, dz1 = side > 0 ? t1 + 0.5 : t0;
          for (const bk of A.blockers || []) {
            if (Math.abs(bk[4] - lvl) > 1) continue;
            const x0 = bk[0] + 0.35, y0 = bk[1] + 0.35, x1 = bk[2] - 0.35, y1 = bk[3] - 0.35; // the piece itself, without the walking margin
            const bv0 = ax === 'x' ? y0 : x0, bv1 = ax === 'x' ? y1 : x1;
            if (bv1 >= dz0 && bv0 <= dz1) hits.push(ax === 'x' ? [x0, x1, bk[5] - lvl] : [y0, y1, bk[5] - lvl]);
          }
          const place = (bottom) => { // the two drapes for a hem at this height: only furniture reaching above it is in the way
            const ps = [ca ? [0, 0] : [l0, Math.min(l0 + pw, uc - 0.05)], cb ? [0, 0] : [Math.max(r1 - pw, uc + 0.05), r1]];
            // drapes never hang across a door (its leaves swing there): they keep to either side of it
            const hs = hits.filter((h) => h[2] > bottom - 0.02).concat(gp.doors.map(([d0, d1]) => [d0 - 0.12, d1 + 0.12, Infinity]));
            const fit = (p, left) => {
              if (p[1] - p[0] <= 0) return;
              let segs = [left ? [p[0], uc - 0.05] : [uc + 0.05, p[1]]];
              for (const [h0, h1] of hs) segs = segs.flatMap(([q0, q1]) => (h1 <= q0 || h0 >= q1 ? [[q0, q1]] : [[q0, Math.min(q1, h0 - 0.05)], [Math.max(q0, h1 + 0.05), q1]])).filter(([q0, q1]) => q1 - q0 >= 0.45);
              if (!segs.length) { p[0] = p[1] = 0; return; }
              const s = left ? segs[0] : segs[segs.length - 1], wd = Math.min(p[1] - p[0], s[1] - s[0]);
              if (left) { p[0] = s[0]; p[1] = s[0] + wd; } else { p[1] = s[1]; p[0] = s[1] - wd; }
            };
            fit(ps[0], true);
            fit(ps[1], false);
            return ps;
          };
          const whole = (ps) => ps.every((p, i) => (i === 0 ? ca : cb) || p[1] - p[0] >= 0.4);
          let bottom = gp.low || gp.sill < 3.3 ? 0.05 : gp.sill - 0.15, panels = place(bottom);
          // no room for both floor-length drapes (furniture against the wall): hang both to the sill instead
          if (!whole(panels) && !gp.low && gp.sill > 1.5 && bottom < 1) { bottom = gp.sill - 0.05; panels = place(bottom); }
          // still no room (bed heads either side of a window): the drapes still hang to the sill, in front of the
          // pieces in the way, the rod standing off the wall far enough for them to clear (measured on the pieces)
          if (!whole(panels) && !gp.low && gp.sill > 1.5) {
            const ps = place(Infinity), tops = hits.filter((h) => h[1] > l0 && h[0] < r1 && isFinite(h[2])).map((h) => h[2]);
            if (whole(ps) && tops.length) {
              bottom = gp.sill - 0.05;
              panels = ps;
              D = Math.max(D, standOff(ps, side > 0 ? t1 : t0, side, bottom + 0.05, Math.min(Math.max(...tops), gp.head), ax, lvl) + 0.15);
            }
          }
          (A.curtainList = A.curtainList || []).push([w.id, gp.n, panels.filter((p) => p[1] - p[0] >= 0.4).length, +bottom.toFixed(2), +D.toFixed(2)]);
          const sgn = ax === 'x' ? side : -side, lx = (u) => (u - uc) * sgn; // the set is built facing the room, then turned
          const g = new T.Group();
          const rod = A.model('rod', { metal: M.brass });
          rod.scale.x = rr - rl;
          rod.position.set(lx((rl + rr) / 2), rodZ, D);
          g.add(rod);
          for (const [u, dir] of [[rl, -1], [rr, 1]]) {
            if (!((dir < 0 && ca) || (dir > 0 && cb))) {
              const fi = A.model('finial', { metal: M.brass });
              fi.position.set(lx(u), rodZ, D);
              if (dir * sgn < 0) fi.rotation.y = Math.PI;
              g.add(fi);
            }
            const br = A.model('bracket', { metal: M.brass });
            br.position.set(lx(u - dir * 0.22), rodZ, 0);
            if (D > 0.27) br.scale.z = (D - 0.02) / 0.25; // a longer arm for a rod standing further off the wall
            g.add(br);
          }
          for (const [u0, u1] of panels) {
            if (u1 - u0 < 0.4) continue;
            const dp = A.model('drape', { fab: mat });
            dp.scale.set(u1 - u0, rodZ - 0.06 - bottom, 1);
            if (mat.map) fabricUV(dp, u1 - u0, rodZ - 0.06 - bottom, (A.S && A.S.curtainFab) || 3);
            dp.position.set(lx((u0 + u1) / 2), bottom, D - 0.09);
            g.add(dp);
          }
          const face = side > 0 ? t1 : t0;
          put(g, ax === 'x' ? uc : face, ax === 'x' ? face : uc, ax === 'x' ? (side > 0 ? 0 : 180) : (side > 0 ? 90 : -90), lvl, false);
          n++;
        }
      }
      return n;
    }
    A.curtainList = [];
    A.curtainCount = curtainsFor(P.walls, P.roomFloors.concat(P.midFloor), 0, H, false);

    // ===== Ground floor: its own file, using the same kit ======================
    if (P.ground && A.furnishGround) {
      root = gf; FG = 'gfurn';
      A.furnishGround({
        T, P, M, GF, STYLE, HW, TAP, FRAME, cache, pb, block, mesh, bx, rb, soft, cyl, put, legs, sofa, roundTable, floorLamp, tableLamp, plant, chair, dining, bed, bench, wc,
        room, sofaR, armchair, bedR, benchR, chairR, nightstand, consoleR, diningR, decorOn, printMat,
        curtain, hang, rugAt, artAt, skipArt: () => { artN++; }, printPanel, pendant, cabRun, wardrobeSet, add: (o) => { root.add(o); return o; },
      });
      A.curtainCount += curtainsFor(P.ground.walls, P.ground.roomFloors, GF, P.ground.H, true); // after the furniture, so drapes clear it
      root = ff; FG = 'furn';
    }

    // furniture never moves: one mesh per material on each floor keeps the frame rate up
    A.kit.mergeStatic(ff);
    A.kit.mergeStatic(gf);
    B.flush(A.groups);
    scene.add(all);
    return all;
  };
})();
