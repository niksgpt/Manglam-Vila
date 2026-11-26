/* Guided tour, free look and walking, room captions and labels, the small map,
   the dollhouse view and the controls on the bar. */
(function () {
  const A = (window.APP = window.APP || {});

  A.initTour = function ({ scene, camera, renderer, canvas }) {
    const T = THREE, P = A.plan, EYE = 5.25, SPEED = 2.9, GR = P.ground;
    const R = P.RISE, GFL = P.GF, PL = GR ? GFL + GR.PORCH : GFL;
    const L1 = -8 * R; // level of the upper stair landing
    const g = (h) => GFL + h; // a height above the ground floor

    /* Key points of the walk, planned for THIS home: in at the gate, through the
       ground floor room by room, up the main stair, then the first floor.
       p = [x, y] on plan, h = floor level there, look = point to face while
       standing, hold = seconds to pause, pan = further points to turn to during
       the pause, stop = name of the chip, label = [room, size, selling point]. */
    const KG = !GR ? [
      { p: [28.2, 26.2], h: L1, look: [19, 25.9, 1.6], hold: 2.4, stop: 'Stair', label: ['Main Stair', "3'-6\" wide", 'Marble steps with a glass balustrade, wrapping the double height'] },
      { p: [26.0, 26.2], h: L1 },
    ] : [
      { p: [14.5, 67.0], h: PL - 0.25, look: [15, 44, g(11)], hold: 4.2, pan: [[24.5, 50, g(14)]], stop: 'Street', label: ['Street View', "30' × 54'-6\" plot · 1,635 sq ft", 'Two storeys facing west, with its own stair up to the first floor and the roof'] },
      { p: [10.5, 61.5], h: PL - 0.25 },
      { p: [6.6, 57.2], h: PL - 0.25 },
      { p: [4.3, 54.2], h: PL },
      { p: [3.4, 51.2], h: PL, look: [6.5, 30, g(6)], hold: 3.0, stop: 'Arrival', label: ['Car Porch', '169 sq ft', 'Covered parking behind an 11 ft gated entry'] },
      { p: [3.2, 45.0], h: PL },
      { p: [4.0, 38.0], h: PL },
      { p: [4.25, 34.0], h: GFL - 0.75 },
      { p: [4.25, 31.0], h: GFL, look: [4.25, 22, g(4.8)], hold: 2.4, stop: 'Entry', label: ['Entry Lobby', '25 sq ft', 'A raised, sheltered lobby with a wide double door'] },
      { p: [4.25, 28.2], h: GFL },
      { p: [4.4, 25.4], h: GFL },
      { p: [7.2, 24.9], h: GFL },
      { p: [10.6, 24.7], h: GFL, look: [18.6, 19.8, g(4.4)], hold: 5.6, pan: [[19, 19.4, g(11.5)], [4.6, 17.2, g(3.4)]], stop: 'Hall', label: ['Living / Dining Hall', '336 sq ft', 'Double-height ceiling with a chandelier over the dining table'] },
      { p: [14.25, 26.2], h: GFL },
      { p: [14.25, 29.6], h: GFL },
      { p: [13.2, 32.4], h: GFL, look: [9.6, 35.6, g(3.6)], hold: 3.0, pan: [[13, 37.6, g(4.2)]], stop: 'Kitchen', label: ['Kitchen', '74 sq ft', 'L-shaped counter with a corner window, steps from the dining table'] },
      { p: [14.25, 29.6], h: GFL },
      { p: [14.0, 26.0], h: GFL },
      { p: [11.6, 21.5], h: GFL },
      { p: [11.2, 16.6], h: GFL },
      { p: [11.2, 13.4], h: GFL },
      { p: [9.2, 10.4], h: GFL, look: [2.5, 9.5, g(2.8)], hold: 3.0, pan: [[8.2, 5.2, g(3.6)]], stop: "Kids' Room", label: ["Children's Bedroom", '125 sq ft', 'Twin beds, a study desk at the window and a built-in wardrobe'] },
      { p: [11.3, 7.2], h: GFL },
      { p: [11.0, 3.5], h: GFL },
      { p: [6.6, 3.15], h: GFL },
      { p: [4.0, 3.6], h: GFL, look: [1.9, 0.6, g(4.7)], hold: 3.0, stop: 'Pooja', label: ['Pooja Room', '20 sq ft', 'A quiet prayer room with a marble mandir, off its own open court'] },
      { p: [6.6, 3.15], h: GFL },
      { p: [11.0, 3.5], h: GFL },
      { p: [11.3, 7.4], h: GFL },
      { p: [11.2, 13.2], h: GFL },
      { p: [11.6, 16.3], h: GFL },
      { p: [15.0, 16.2], h: GFL },
      { p: [17.5, 15.6], h: GFL },
      { p: [17.3, 12.7], h: GFL, look: [14.0, 11.9, g(4.2)], hold: 2.6, pan: [[17.6, 7.6, g(2.6)]], stop: 'C. Toilet', label: ['Common Toilet', '40 sq ft', 'Opens off the hall for guests, with a separate W.C. alcove'] },
      { p: [17.5, 15.7], h: GFL },
      { p: [21.2, 16.3], h: GFL },
      { p: [21.4, 13.2], h: GFL },
      { p: [21.2, 9.6], h: GFL, look: [26.5, 5.8, g(2.6)], hold: 3.0, pan: [[26.5, 12.3, g(4.6)]], stop: 'Guest Room', label: ['Guest Bedroom', '115 sq ft', 'Rear-facing and private, with a full-width wardrobe'] },
      { p: [21.4, 13.2], h: GFL },
      { p: [21.4, 16.6], h: GFL },
      { p: [21.6, 21.0], h: GFL },
      { p: [20.6, 25.2], h: GFL },
      { p: [18.2, 26.6], h: GFL },
      { p: [18.0, 29.4], h: GFL },
      { p: [18.3, 31.7], h: GFL },
      { p: [21.3, 31.9], h: GFL, look: [25.4, 29.2, g(3.9)], hold: 2.8, pan: [[28.4, 32.2, g(2.8)]], stop: 'Toilet', label: ['Toilet', '48 sq ft', 'Beside the master bedroom, with a glass-screened shower'] },
      { p: [18.3, 31.7], h: GFL },
      { p: [18.0, 33.5], h: GFL },
      { p: [19.2, 36.5], h: GFL, look: [25.5, 39.2, g(2.6)], hold: 3.2, pan: [[19.6, 45.8, g(4.4)]], stop: 'Master', label: ['Master Bedroom', '138 sq ft', 'Road-side windows, a full wardrobe wall and its own side entry'] },
      { p: [18.0, 33.5], h: GFL },
      { p: [18.0, 29.4], h: GFL },
      { p: [18.6, 26.4], h: GFL },
      { p: [21.2, 24.6], h: GFL },
      { p: [21.8, 20.0], h: GFL },
      { p: [22.6, 16.5], h: GFL },
      { p: [23.6, 16.4], h: GFL },
      { p: [26.2, 16.4], h: -16 * R },
      { p: [27.9, 16.5], h: -16 * R },
      { p: [27.9, 18.2], h: -16 * R },
      { p: [27.9, 23.9], h: -8 * R },
      { p: [28.0, 26.1], h: L1, look: [18, 20.5, g(5)], hold: 2.6, stop: 'Stair', label: ['Main Stair', "3'-6\" wide", 'Marble steps with a glass balustrade, wrapping the double height'] },
      { p: [26.1, 26.2], h: L1 },
    ];
    const KF = [
      { p: [20.2, 26.2] },
      { p: [17.0, 26.15], look: [23.5, 18, -3.5], hold: 3.2, pan: [[14.5, 17.5, 3.4]], stop: 'Gallery', label: ['Gallery', 'first floor landing', 'Looks down over the dining hall through a glass balustrade'] },
      { p: [13.6, 26.2] },
      { p: [10.8, 25.2], look: [2.2, 19.5, 3.4], hold: 2.8, stop: 'Lounge', label: ['Family Lounge', '170 sq ft', 'A second sitting room upstairs, opening onto the terrace'] },
      { p: [5.6, 25.0] },
      { p: [4.3, 28.3] },
      { p: [6.4, 30.8], look: [2.2, 38.4, 3.0], hold: 2.6, pan: [[4.5, 45, 4.5]], stop: 'Terrace', label: ['Terrace', '163 sq ft', 'Open-air seating and dining under a timber pergola'] },
      { p: [6.9, 36.5], look: [4.2, 42.3, 2.6], hold: 2.2 },
      { p: [6.4, 31.0] },
      { p: [4.3, 28.2] },
      { p: [5.6, 24.6] },
      { p: [8.6, 18.5] },
      { p: [10.6, 13.6], look: [5.6, 3.6, 3], hold: 3.2, stop: 'Living', label: ['Living & Dining', '271 sq ft', 'One open room from the TV wall to the dining table'] },
      { p: [11.0, 9.5] },
      { p: [11.0, 6.6], look: [14.3, 7.9, 2.8], hold: 2.4, stop: 'Dining', label: ['Dining', 'part of the living room', 'Seats four under a row of pendant lights'] },
      { p: [11.4, 3.7] },
      { p: [17.3, 3.6] },
      { p: [18.2, 5.5] },
      { p: [20.2, 5.9] },
      { p: [21.7, 5.3] },
      { p: [22.9, 4.3], look: [27.6, 2.0, 3.4], hold: 3.2, pan: [[28.3, 9.5, 4]], stop: 'Kitchen 2', label: ['Kitchen', '89 sq ft', 'Stone counters on two sides and a utility leg for storage'] },
      { p: [21.7, 5.3] },
      { p: [20.0, 5.9] },
      { p: [18.2, 5.5] },
      { p: [17.3, 3.6] },
      { p: [11.4, 3.7] },
      { p: [11.0, 9.5] },
      { p: [10.4, 14.5] },
      { p: [9.6, 20] },
      { p: [10.2, 25.6] },
      { p: [11.0, 27.9] },
      { p: [11.6, 30.6], look: [18.4, 35, 2.6], hold: 3.2, pan: [[12.4, 45.6, 3.8]], stop: 'Bedroom', label: ['Master Bedroom', '234 sq ft', 'The largest room in the home, with its own balcony, dress and bath'] },
      { p: [12.1, 34.5] },
      { p: [12.6, 39.6] },
      { p: [15.8, 42.2] },
      { p: [18.15, 45.2] },
      { p: [18.1, 48.2], look: [13, 80, -7], hold: 3.4, pan: [[36, 62, -3]], stop: 'Balcony', label: ['Front Balcony', '51 sq ft', 'A road-facing sit-out straight off the bedroom'] },
      { p: [18.15, 45.4] },
      { p: [20.4, 43.0] },
      { p: [23.4, 42.9], look: [27.2, 40.0, 4.2], hold: 2.6, pan: [[25.8, 45.2, 4]], stop: 'Dress', label: ['Dress', '56 sq ft', 'A walk-in dressing room lined with wardrobes'] },
      { p: [26.1, 42.2] },
      { p: [25.8, 39.8] },
      { p: [25.6, 36.7], look: [24.3, 30.2, 3.3], hold: 2.8, pan: [[28.9, 34.6, 4.0]], stop: 'Bath', label: ['Master Toilet', '67 sq ft', 'A long vanity and a glass-screened shower'] },
      { p: [25.8, 39.8] },
      { p: [26.1, 42.2] },
      { p: [23.6, 42.9] },
      { p: [20.0, 42.9] },
      { p: [14.0, 40.0] },
      { p: [12.1, 34.0] },
      { p: [11.2, 30.0] },
      { p: [11.0, 27.6] },
      { p: [14.4, 25.75], look: [16.2, 15.2, -1.6], hold: 3.4, stop: 'Void', label: ['Double Height', '126 sq ft open to below', 'Two storeys of light over the dining hall'] },
    ];
    const K = KG.concat(KF);
    const pts = K.map((k) => new T.Vector3(k.p[0], (k.h || 0) + EYE, k.p[1]));
    const curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const N = K.length;
    const at = (s) => curve.getPoint(Math.min(1, Math.max(0, s / (N - 1)))); // s = key index, may be fractional

    // --- timeline: moves between keys, holds at keys --------------------------
    const items = [];
    let total = 0;
    // length tables, so the walk keeps an even pace along each curved stretch
    const TAB = 24, tabs = [];
    for (let i = 0; i < N - 1; i++) {
      const cum = [0];
      let a = at(i);
      for (let j = 1; j <= TAB; j++) { const b = at(i + j / TAB); cum.push(cum[j - 1] + a.distanceTo(b)); a = b; }
      tabs.push(cum);
    }
    const segLen = (i) => tabs[i][TAB];
    const byLength = (i, f) => { // fraction of the stretch's length -> curve parameter
      const cum = tabs[i], want = f * cum[TAB];
      let j = 1;
      while (j < TAB && cum[j] < want) j++;
      const span = cum[j] - cum[j - 1];
      return (j - 1 + (span > 1e-6 ? (want - cum[j - 1]) / span : 0)) / TAB;
    };
    for (let i = 0; i < N; i++) {
      if (K[i].hold) { items.push({ type: 'hold', i, t0: total, dur: K[i].hold }); total += K[i].hold; }
      if (i < N - 1) {
        const a = !!K[i].hold || i === 0, b = !!K[i + 1].hold || i === N - 2;
        const ease = a && b ? 'both' : a ? 'in' : b ? 'out' : 'lin';
        const dur = (segLen(i) / SPEED) * (ease === 'both' ? 1.5 : 1);
        items.push({ type: 'move', i, t0: total, dur, ease });
        total += dur;
      }
    }
    const END = 7; // seconds of rising to the dollhouse view at the end
    const easeF = { lin: (u) => u, in: (u) => u * u * (2 - u), out: (u) => 1 - (1 - u) * (1 - u) * (1 + u), both: (u) => u * u * (3 - 2 * u) };
    const stops = K.map((k, i) => (k.stop ? { name: k.stop, i, t: items.find((it) => it.type === 'hold' && it.i === i).t0 } : null)).filter(Boolean);
    stops.push({ name: 'Dollhouse', i: -1, t: total });
    const itemAt = (t) => { for (const c of items) if (t < c.t0 + c.dur) return c; return items[items.length - 1]; };

    function sample(t) { // -> { s: key position, target: point to look at }
      const it = itemAt(t);
      const u = Math.min(1, Math.max(0, (t - it.t0) / it.dur));
      if (it.type === 'hold') {
        const k = K[it.i], views = [k.look].concat(k.pan || []);
        const share = it.dur / views.length, vi = Math.min(views.length - 1, Math.floor((t - it.t0) / share));
        return { s: it.i, look: views[vi], holding: true };
      }
      const s = it.i + byLength(it.i, easeF[it.ease](u)), nk = K[it.i + 1];
      // while walking, look along the path; turn to the next view on arrival
      if (nk.look && s > it.i + 0.72) return { s, look: nk.look };
      const a = at(s), b = at(Math.min(N - 1, s + 0.35));
      if (a.distanceTo(b) < 0.05) return { s, look: nk.look || null };
      return { s, look: [b.x, b.z, a.y + (b.y - a.y) * 0.3 - 0.15], ahead: true };
    }

    // --- camera state ---------------------------------------------------------
    const st = { mode: 'free', playing: false, t: 0, yaw: 0, pitch: 0, floor: 0, ov: 0, ended: false, dfloor: 'first', spin: false };
    const pos = new T.Vector3();
    camera.rotation.order = 'YXZ';
    const angTo = (from, look) => {
      const dx = look[0] - from.x, dz = look[1] - from.z;
      // look[2] is a height above the first floor; the camera eye is at from.y
      const ddy = (look[2] === undefined ? from.y : look[2]) - from.y;
      return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(ddy, Math.hypot(dx, dz)) };
    };
    const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const baseFov = () => (canvas.clientWidth >= canvas.clientHeight ? 64 : 78);
    function applyCam() {
      camera.position.copy(pos);
      camera.rotation.set(st.pitch, st.yaw, 0);
    }
    function poseAt(t, snap, dt) {
      const q = sample(t);
      pos.copy(at(q.s));
      st.floor = pos.y - EYE;
      if (q.look) {
        const a = angTo(pos, q.look);
        if (snap) { st.yaw = a.yaw; st.pitch = a.pitch; }
        else {
          const k = 1 - Math.exp(-(q.holding ? 1.9 : 2.6) * dt);
          st.yaw += wrap(a.yaw - st.yaw) * k;
          st.pitch += (a.pitch - st.pitch) * k;
        }
      }
    }

    // --- where can you stand? -------------------------------------------------
    const BODY = 0.45; // how close a person can get to a wall or railing
    function ground(x, y, cur) {
      let best = null;
      for (const r of P.areas) {
        if (x < r[0] || x > r[2] || y < r[1] || y > r[3]) continue;
        const h = typeof r[4] === 'function' ? r[4](x, y) : r[4];
        if (Math.abs(h - cur) < 1.7 && (best === null || Math.abs(h - cur) < Math.abs(best - cur))) best = h;
      }
      if (best === null) return null;
      // walls, pillars and railings come straight from the plan, so edits are respected
      for (const s of P.solids)
        if (x > s[0] - BODY && x < s[2] + BODY && y > s[1] - BODY && y < s[3] + BODY && s[4] < best + 4.5 && s[5] > best + 1) return null;
      for (const b of A.blockers || []) if (x > b[0] && x < b[2] && y > b[1] && y < b[3] && Math.abs(b[4] - best) < 3) return null;
      return best;
    }
    A.ground = ground;
    A.checkTour = function () { // reports any tour point that is inside a wall or furniture
      const bad = [];
      for (let s = 0; s <= N - 1; s += 0.02) {
        const p = at(s), gl = ground(p.x, p.z, p.y - EYE);
        if (gl === null) bad.push([+s.toFixed(2), +p.x.toFixed(2), +p.z.toFixed(2)]);
      }
      return bad;
    };

    // --- DOM ------------------------------------------------------------------
    const $ = (id) => document.getElementById(id);
    const elPlay = $('play'), elFill = $('fill'), elTime = $('time'), elStops = $('stops'), elFade = $('fade');
    const elEnd = $('end'), elHint = $('hint'), elCap = $('caption'), elMap = $('map'), elStart = $('start'), elLabel = $('label');
    const capName = elCap.querySelector('.name'), capSize = elCap.querySelector('.size'), capTag = elCap.querySelector('.tag');
    const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    const chips = stops.map((sp) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = sp.name;
      b.addEventListener('click', () => jump(sp));
      elStops.appendChild(b);
      return b;
    });

    function setPlaying(on) {
      st.playing = on;
      elPlay.textContent = on ? '❚❚ Pause' : st.t > 0.5 && !st.ended ? '▶ Resume tour' : '▶ Start tour';
      if (on) { elHint.classList.add('hide'); if (elStart) elStart.classList.add('gone'); if (A.music) A.music.start(); }
    }
    // --- dollhouse: the roof (and, for the ground floor, the first floor) lifted off ---
    const ovC = new T.Vector3(14.5, 0, 25);
    function showOverview(on) {
      A.setCut(on ? st.dfloor : 'none');
      A.viewFloor = on ? st.dfloor : null;
      ovC.y = on && st.dfloor === 'ground' ? GFL : 0;
      if (on) st.mode = 'overview';
      camera.fov = on ? 40 : baseFov();
      camera.updateProjectionMatrix();
      document.body.classList.toggle('doll', on);
    }
    document.querySelectorAll('[data-floor]').forEach((b) => b.addEventListener('click', () => {
      st.dfloor = b.dataset.floor === 'ground' && GR ? 'ground' : 'first';
      st.spin = false;
      if (st.mode === 'overview') showOverview(true);
      setDollLabel();
    }));
    if (!GR) document.body.classList.add('onefloor');
    // the label, the Start Tour button and the hint always sit just above the bar, however tall it is
    function aboveBar() {
      const h = $('bar').offsetHeight + 30;
      if (elLabel) elLabel.style.bottom = h + 'px';
      if (elStart) elStart.style.bottom = h + 8 + 'px';
      elHint.style.bottom = h + 66 + 'px';
    }
    window.addEventListener('resize', aboveBar);
    setTimeout(aboveBar, 0);
    function fadeThen(fn) {
      elFade.classList.remove('hide');
      elFade.style.opacity = 1;
      setTimeout(() => { fn(); elFade.style.opacity = 0; }, 560);
    }
    function enterTour(t, snap) {
      st.doll = false;
      elEnd.style.display = 'none';
      st.ended = false;
      if (st.mode === 'overview' || st.mode === 'rise') showOverview(false);
      st.mode = 'tour';
      st.t = t;
      if (snap) poseAt(t, true, 0);
      else blend.k = 0, blend.p.copy(pos), blend.yaw = st.yaw, blend.pitch = st.pitch;
    }
    const blend = { k: 1, p: new T.Vector3(), yaw: 0, pitch: 0 };
    function jump(sp) {
      if (sp.i < 0) { // dollhouse
        fadeThen(() => { st.t = total; st.ov = 0; st.doll = true; st.az = 0.55; st.el = 1.05; st.spin = false; showOverview(true); setPlaying(false); elEnd.style.display = 'none'; st.ended = false; setDollLabel(); });
        return;
      }
      const wasPlaying = st.playing;
      fadeThen(() => {
        enterTour(sp.t + 0.01, true);
        if (!wasPlaying) st.mode = 'free';
        setPlaying(wasPlaying);
      });
    }
    A.jump = (name) => { // instant, used for checking each stop
      const sp = stops.find((s) => s.name === name);
      if (!sp) return false;
      if (sp.i < 0) { st.t = total; st.doll = true; st.az = 0.55; st.el = 1.05; st.spin = false; showOverview(true); setPlaying(false); return true; }
      enterTour(sp.t + 0.01, true);
      st.mode = 'free';
      setPlaying(false);
      return true;
    };
    A.tourInfo = () => ({ total: total + END, stops: stops.map((s) => [s.name, +s.t.toFixed(1)]), t: st.t, mode: st.mode, floor: st.floor });
    A.place = (x, y, lx, ly, lh, lvl) => { // stand anywhere, facing a point (for checking views); lvl = floor level, 0 = first floor
      if (st.mode === 'overview' || st.mode === 'rise') showOverview(false);
      st.mode = 'free'; setPlaying(false);
      lvl = lvl || 0;
      pos.set(x, lvl + EYE, y); st.floor = lvl;
      const a = angTo(pos, [lx, ly, lh === undefined ? lvl + 4 : lh]); st.yaw = a.yaw; st.pitch = a.pitch;
    };
    A.seek = (t) => { enterTour(Math.min(t, total - 0.01), true); st.mode = 'free'; setPlaying(false); };
    A.dollFloor = (f) => { st.dfloor = f === 'ground' && GR ? 'ground' : 'first'; if (st.mode === 'overview') showOverview(true); };

    function startTour() { fadeThen(() => { enterTour(0, true); setPlaying(true); }); }
    if (elStart) elStart.addEventListener('click', startTour);
    elPlay.addEventListener('click', () => {
      if (st.playing) { setPlaying(false); if (st.mode === 'tour') st.mode = 'free'; return; }
      if (st.ended || st.mode === 'overview' || st.mode === 'rise') { startTour(); return; }
      const far = pos.distanceTo(at(sample(st.t).s)) > 5;
      if (far) fadeThen(() => { enterTour(st.t, true); setPlaying(true); });
      else { enterTour(st.t, false); setPlaying(true); }
    });
    $('restart').addEventListener('click', startTour);
    $('again').addEventListener('click', startTour);
    function standInside() { // a good place to begin walking around on your own
      if (GR) { pos.set(10.6, GFL + EYE, 24.7); st.floor = GFL; const a = angTo(pos, [18, 19.6, g(6)]); st.yaw = a.yaw; st.pitch = a.pitch; }
      else { pos.set(14, EYE, 26.1); st.floor = 0; const a = angTo(pos, [17, 19.6, 3]); st.yaw = a.yaw; st.pitch = a.pitch; }
    }
    $('explore').addEventListener('click', () => fadeThen(() => {
      elEnd.style.display = 'none';
      showOverview(false);
      st.mode = 'free'; st.ended = false; st.t = 0; st.doll = false;
      standInside();
      setPlaying(false);
      setDollLabel();
      elHint.classList.remove('hide');
    }));
    $('track').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect(), f = (e.clientX - r.left) / r.width, t = f * (total + END);
      if (t >= total) { jump(stops[stops.length - 1]); return; }
      const wasPlaying = st.playing;
      fadeThen(() => { enterTour(t, true); if (!wasPlaying) st.mode = 'free'; setPlaying(wasPlaying); });
    });

    // --- dollhouse view: one button there and back --------------------------------
    const elDoll = $('doll');
    function setDollLabel() {
      const on = st.mode === 'overview';
      if (elDoll) { elDoll.textContent = on ? 'Back to walking' : 'Dollhouse view'; elDoll.classList.toggle('on', on); }
      document.querySelectorAll('[data-floor]').forEach((b) => b.classList.toggle('on', on && b.dataset.floor === st.dfloor));
    }
    if (elDoll) elDoll.addEventListener('click', () => {
      if (document.pointerLockElement) document.exitPointerLock();
      if (st.mode !== 'overview') {
        if (st.mode !== 'rise') st.back = { p: pos.clone(), yaw: st.yaw, pitch: st.pitch, floor: st.floor };
        // open on the floor you are standing on
        st.dfloor = GR && st.floor < GFL / 2 ? 'ground' : 'first';
        fadeThen(() => { setPlaying(false); elEnd.style.display = 'none'; st.ended = false; st.ov = 0; st.doll = true; st.az = 0.55; st.el = 1.05; st.spin = false; showOverview(true); setDollLabel(); });
      } else {
        fadeThen(() => {
          elEnd.style.display = 'none'; st.ended = false; st.doll = false;
          showOverview(false); st.mode = 'free'; setPlaying(false);
          if (st.back) { pos.copy(st.back.p); st.yaw = st.back.yaw; st.pitch = st.back.pitch; st.floor = st.back.floor; }
          else standInside();
          setDollLabel();
        });
      }
    });

    // --- mouse look: the pointer is captured and moving the mouse turns your head ---
    const elLook = $('mlook');
    if (elLook) {
      elLook.addEventListener('click', () => {
        if (document.pointerLockElement === canvas) { document.exitPointerLock(); return; }
        if (st.mode === 'overview' || st.mode === 'rise') return;
        takeOver();
        if (canvas.requestPointerLock) canvas.requestPointerLock();
      });
      document.addEventListener('pointerlockchange', () => {
        const on = document.pointerLockElement === canvas;
        elLook.classList.toggle('on', on);
        elLook.textContent = on ? 'Mouse look on (Esc to release)' : 'Mouse look';
      });
      document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement !== canvas || st.mode === 'overview' || st.mode === 'rise') return;
        if (st.mode === 'tour') takeOver();
        st.yaw -= e.movementX * 0.0024;
        st.pitch = Math.max(-1.25, Math.min(1.25, st.pitch - e.movementY * 0.0024));
      });
    }

    // --- time of day and music ---------------------------------------------------------
    const elTod = $('tod'), elTodLbl = $('todlbl');
    if (elTod && A.setTod) {
      elTod.value = Math.round((A.tod === undefined ? 0.55 : A.tod) * 1000);
      elTod.addEventListener('input', () => A.setTod(elTod.value / 1000));
      document.querySelectorAll('[data-tod]').forEach((b) => b.addEventListener('click', () => { elTod.value = Math.round(b.dataset.tod * 1000); A.setTod(+b.dataset.tod); }));
    }
    const elMute = $('mute');
    function muteLabel() { if (elMute && A.music) { elMute.textContent = A.music.muted ? '♪ Music off' : '♪ Music on'; elMute.classList.toggle('on', !A.music.muted && A.music.on); } }
    if (elMute && A.music) {
      elMute.addEventListener('click', () => { A.music.setMuted(!A.music.muted); muteLabel(); });
      A.music.onChange = muteLabel;
      muteLabel();
    }

    // --- free look and walking --------------------------------------------------
    const keys = {};
    let drag = null, goal = null;
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    function takeOver() {
      if (st.mode === 'overview' || st.mode === 'rise') return false;
      if (st.mode === 'tour') { st.mode = 'free'; setPlaying(false); }
      if (elStart) elStart.classList.add('gone');
      blend.k = 1;
      return true;
    }
    canvas.addEventListener('pointerdown', (e) => {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
      canvas.classList.add('dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (st.mode === 'overview') { // drag turns and tilts the dollhouse
        st.doll = true; st.spin = false;
        st.az -= dx * 0.006; st.el = Math.max(0.45, Math.min(1.5, st.el + dy * 0.005));
        drag.x = e.clientX; drag.y = e.clientY; drag.moved = true;
        return;
      }
      if (st.mode === 'rise') return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      if (!drag.moved) { drag.moved = true; if (!takeOver()) { drag = null; return; } goal = null; }
      drag.x = e.clientX; drag.y = e.clientY;
      st.yaw += dx * 0.0042;
      st.pitch = Math.max(-1.25, Math.min(1.25, st.pitch + dy * 0.0042));
    });
    const endDrag = (e) => {
      canvas.classList.remove('dragging');
      if (drag && !drag.moved && performance.now() - drag.t < 450 && st.mode !== 'overview' && st.mode !== 'rise') {
        // a tap: walk to that spot on the floor
        const r = canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const G = A.groups, hits = ray.intersectObjects(G.main.children.concat(G.gmain.children, G.both.children), false);
        for (const h of hits) {
          if (h.object.material && h.object.material.transparent) continue;
          if (h.face && h.face.normal.y > 0.7 && h.distance < 60) { takeOver(); goal = new T.Vector2(h.point.x, h.point.z); }
          break;
        }
      }
      drag = null;
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('dragging'); });
    const MOVE = { KeyW: 1, KeyS: 1, KeyA: 1, KeyD: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };
    window.addEventListener('keydown', (e) => {
      if (/^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '') && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) return; // the time slider keeps its arrow keys
      if (e.code === 'Space') { e.preventDefault(); elPlay.click(); return; }
      if (!MOVE[e.code]) return;
      e.preventDefault();
      keys[e.code] = true;
      if (takeOver()) goal = null;
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

    function tryMove(dx, dz) {
      const steps = [[dx, dz], [dx, 0], [0, dz]];
      for (const [mx, mz] of steps) {
        if (!mx && !mz) continue;
        const gl = ground(pos.x + mx, pos.z + mz, st.floor);
        if (gl !== null) { pos.x += mx; pos.z += mz; st.floor = gl; return true; }
      }
      return false;
    }
    function freeStep(dt) {
      const turn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
      st.yaw += turn * 1.7 * dt;
      let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      let s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      const sp = 5.2 * dt;
      if (f || s) {
        const sn = Math.sin(st.yaw), cs = Math.cos(st.yaw), n = Math.hypot(f, s);
        tryMove(((-sn * f + cs * s) / n) * sp, ((-cs * f - sn * s) / n) * sp);
      } else if (goal) {
        const dx = goal.x - pos.x, dz = goal.y - pos.z, d = Math.hypot(dx, dz);
        if (d < 0.25 || !tryMove((dx / d) * Math.min(sp, d), (dz / d) * Math.min(sp, d))) goal = null;
      }
      pos.y += (st.floor + EYE - pos.y) * (1 - Math.exp(-12 * dt));
    }

    // --- caption, tour label and map ----------------------------------------------
    const onGround = () => !!GR && st.floor < GFL / 2;
    let lastRoom = null;
    function caption() {
      let name = '', size = '', tag = GR ? (onGround() ? 'Ground floor' : 'First floor') : 'First floor';
      if (st.mode === 'overview' || st.mode === 'rise') { name = 'Dollhouse view'; size = "Plot 30' × 54'-6\""; tag = st.mode === 'rise' || !GR ? 'Whole home' : st.dfloor === 'ground' ? 'Ground floor' : 'First floor, roof off'; }
      else if (st.floor > P.H) { name = 'Roof'; size = 'reached by the front stair'; tag = 'Roof'; }
      else if (onGround()) {
        for (const r of GR.rooms) if (pos.x >= r.r[0] && pos.x <= r.r[2] && pos.z >= r.r[1] && pos.z <= r.r[3]) { name = r.name; size = r.size; break; }
      } else {
        for (const r of P.rooms) if (pos.x >= r.r[0] && pos.x <= r.r[2] && pos.z >= r.r[1] && pos.z <= r.r[3]) { name = r.name; size = r.size; break; }
        if (!GR && st.floor < -9) { name = 'Below the Void'; size = 'placeholder, ground floor not drawn'; tag = 'Ground floor'; }
      }
      const key = name + size + tag;
      if (key === lastRoom) return;
      lastRoom = key;
      capName.textContent = name || ' ';
      capSize.textContent = size || ' ';
      capTag.textContent = tag;
    }
    // The small label shown while the tour pauses in a room: name, size, one selling point.
    let lastLabel = -1;
    function label() {
      if (!elLabel) return;
      let idx = -1;
      if (st.mode === 'tour' && st.playing) { const it = itemAt(st.t); if (it.type === 'hold' && K[it.i].label && st.t - it.t0 > 0.25) idx = it.i; }
      if (idx === lastLabel) return;
      lastLabel = idx;
      if (idx < 0) { elLabel.classList.add('hide'); return; }
      const l = K[idx].label;
      elLabel.querySelector('.n').textContent = l[0];
      elLabel.querySelector('.a').textContent = l[1];
      elLabel.querySelector('.s').textContent = l[2];
      elLabel.querySelector('.f').textContent = GR ? ((K[idx].h || 0) < GFL / 2 ? 'Ground floor' : 'First floor') : 'First floor';
      elLabel.classList.remove('hide');
    }
    A.labelAt = (name) => { const k = K.find((q) => q.stop === name); return k ? k.label : null; };

    const mctx = elMap.getContext('2d'), MW = elMap.width, MH = elMap.height;
    const MS = Math.min(MW / 35.4, MH / 58.6), MX = (x) => (x + 4.3) * MS, MY = (y) => (y + 2.8) * MS;
    const tint = { marble: '#6f665b', woodfloor: '#7d6650', bathfloor: '#5f666b', deck: '#59614f', stonefloor: '#59614f' };
    function drawBase(floorList, wallList, pillarList, lvl, stairs) {
      const c = document.createElement('canvas');
      c.width = MW; c.height = MH;
      const gx = c.getContext('2d');
      gx.fillStyle = '#3d3833';
      gx.fillRect(MX(P.ZONE[0]), MY(P.ZONE[1]), (29.625 - P.ZONE[0]) * MS, (P.ZONE[3] - P.ZONE[1]) * MS);
      for (const f of floorList) { gx.fillStyle = tint[f[4]] || '#666'; gx.fillRect(MX(f[0]), MY(f[1]), (f[2] - f[0]) * MS, (f[3] - f[1]) * MS); }
      gx.strokeStyle = 'rgba(244,239,230,0.28)'; gx.lineWidth = 1;
      if (stairs !== 'low') for (let i = 0; i <= 7; i++) { const x = MX(20.29 + i * P.TREAD); gx.beginPath(); gx.moveTo(x, MY(24.375)); gx.lineTo(x, MY(27.875)); gx.stroke(); }
      for (let i = 0; i <= 7; i++) { const y = MY(23.96 - i * P.TREAD); gx.beginPath(); gx.moveTo(MX(26.125), y); gx.lineTo(MX(29.625), y); gx.stroke(); }
      if (stairs === 'low') for (let i = 0; i <= 3; i++) { const x = MX(26.125 - i * P.TREAD); gx.beginPath(); gx.moveTo(x, MY(14.625)); gx.lineTo(x, MY(18.125)); gx.stroke(); }
      gx.fillStyle = '#f4efe6';
      for (const w of wallList) {
        const z0 = w.z[0] - lvl, z1 = w.z[1] - lvl;
        if (z1 < 3 || z0 > 1) continue;
        const [x0, y0, x1, y1] = w.r, ops = (w.ops || []).slice().sort((a, b) => a.a - b.a);
        let cur = w.ax === 'x' ? x0 : y0;
        const end = w.ax === 'x' ? x1 : y1;
        const seg = (a, b, thin) => {
          if (b - a < 0.01) return;
          gx.globalAlpha = thin ? 0.45 : 1;
          if (w.ax === 'x') gx.fillRect(MX(a), MY(y0), (b - a) * MS, Math.max(1.5, (y1 - y0) * MS));
          else gx.fillRect(MX(x0), MY(a), Math.max(1.5, (x1 - x0) * MS), (b - a) * MS);
          gx.globalAlpha = 1;
        };
        for (const o of ops) { seg(cur, o.a); if (o.type === 'win' || o.type === 'vent') seg(o.a, o.b, true); cur = o.b; }
        seg(cur, end);
      }
      for (const p of pillarList) gx.fillRect(MX(p.r[0]), MY(p.r[1]), (p.r[2] - p.r[0]) * MS, (p.r[3] - p.r[1]) * MS);
      // north arrow in the corner, true north from the site file (the plan's rear faces SITE.rearBearing)
      if (window.SITE) {
        const b = (window.SITE.rearBearing * Math.PI) / 180, nx = -Math.sin(b), ny = -Math.cos(b), cx = 13, cy = 13, r = 9;
        gx.save(); gx.globalAlpha = 0.9;
        gx.strokeStyle = '#d2a85c'; gx.lineWidth = 1; gx.beginPath(); gx.arc(cx, cy, r, 0, 6.3); gx.stroke();
        gx.fillStyle = '#c0533e'; gx.beginPath(); gx.moveTo(cx + nx * r, cy + ny * r); gx.lineTo(cx - ny * 3, cy + nx * 3); gx.lineTo(cx + ny * 3, cy - nx * 3); gx.closePath(); gx.fill();
        gx.fillStyle = '#d2a85c'; gx.beginPath(); gx.moveTo(cx - nx * r, cy - ny * r); gx.lineTo(cx - ny * 3, cy + nx * 3); gx.lineTo(cx + ny * 3, cy - nx * 3); gx.closePath(); gx.fill();
        gx.fillStyle = '#efe6d6'; gx.font = 'bold 8px sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle';
        gx.fillText('N', cx + nx * (r + 7), cy + ny * (r + 7));
        gx.restore();
      }
      return c;
    }
    const baseF = drawBase(P.floors, P.walls, P.pillars, 0, 'high');
    const baseG = GR ? drawBase(GR.floors, GR.walls, GR.pillars, GFL, 'low') : baseF;
    function drawMap() {
      mctx.clearRect(0, 0, MW, MH);
      const over = st.mode === 'overview' || st.mode === 'rise';
      mctx.drawImage((over ? st.dfloor === 'ground' && st.mode !== 'rise' : onGround()) ? baseG : baseF, 0, 0);
      if (over) return;
      const x = MX(pos.x), y = MY(pos.z), sn = -Math.sin(st.yaw), cs = -Math.cos(st.yaw);
      mctx.fillStyle = 'rgba(210,168,92,0.28)';
      mctx.beginPath();
      mctx.moveTo(x, y);
      mctx.arc(x, y, 44, Math.atan2(cs, sn) - 0.55, Math.atan2(cs, sn) + 0.55);
      mctx.closePath();
      mctx.fill();
      mctx.fillStyle = '#d2a85c';
      mctx.beginPath(); mctx.arc(x, y, 6.5, 0, 6.3); mctx.fill();
      mctx.strokeStyle = '#1d1712'; mctx.lineWidth = 2; mctx.stroke();
    }

    // --- the end of the tour: rise out through the roof to the dollhouse view -------
    const rise = { t: 0, p0: new T.Vector3(), l0: new T.Vector3(), p1: new T.Vector3(), fov0: 64 };
    // In the dollhouse view the house sits in the clear space above the control bar: the
    // camera stands further back, and the picture is shifted up by half the bar's height.
    let viewShift = false;
    function frameAboveBar(k) {
      const w = canvas.clientWidth, h = canvas.clientHeight, bar = $('bar') ? $('bar').offsetHeight + 16 : 0;
      const d = Math.round((bar / 2) * k);
      if (d > 0 && h > bar + 120) { camera.setViewOffset(w, h, 0, d, w, h); viewShift = true; }
      else if (viewShift) { camera.clearViewOffset(); viewShift = false; }
    }
    const dollPos = (out) => {
      const Rr = 116;
      return out.set(ovC.x + Rr * Math.cos(st.el) * Math.sin(st.az), ovC.y + Rr * Math.sin(st.el), ovC.z + Rr * Math.cos(st.el) * Math.cos(st.az));
    };
    function startRise() {
      st.mode = 'rise';
      st.dfloor = 'first'; st.az = 0.55; st.el = 1.05; st.doll = true;
      A.setCut('first');               // the roof comes off, and the camera lifts through the opening
      A.viewFloor = 'first';
      ovC.y = 0;
      rise.t = 0;
      rise.p0.copy(pos);
      rise.l0.set(pos.x - Math.sin(st.yaw) * Math.cos(st.pitch) * 12, pos.y + Math.sin(st.pitch) * 12, pos.z - Math.cos(st.yaw) * Math.cos(st.pitch) * 12);
      dollPos(rise.p1);
      rise.fov0 = camera.fov;
      document.body.classList.add('doll');
      setDollLabel();
    }
    const tmpL = new T.Vector3();
    function riseStep(dt) {
      rise.t += dt;
      const u = Math.min(1, rise.t / END), e = u * u * (3 - 2 * u), up = 1 - (1 - u) * (1 - u);
      camera.position.set(rise.p0.x + (rise.p1.x - rise.p0.x) * e, rise.p0.y + (rise.p1.y - rise.p0.y) * up, rise.p0.z + (rise.p1.z - rise.p0.z) * e);
      tmpL.copy(rise.l0).lerp(ovC, Math.min(1, e * 1.6));
      camera.lookAt(tmpL);
      camera.fov = rise.fov0 + (40 - rise.fov0) * e;
      camera.updateProjectionMatrix();
      frameAboveBar(e);
      if (u >= 1) { st.mode = 'overview'; st.ov = 0; st.spin = true; showOverview(true); setDollLabel(); }
    }
    A.riseNow = () => { st.t = total; startRise(); }; // for checking

    // --- per-frame update ---------------------------------------------------------
    let uiTick = 0;
    function tick(dt) {
      if (st.mode !== 'overview' && st.mode !== 'rise') frameAboveBar(0); // walking views fill the screen
      if (st.mode === 'tour' && st.playing) {
        st.t += dt;
        if (st.t >= total) {
          st.t = total;
          startRise();
        } else {
          poseAt(st.t, false, dt);
          if (blend.k < 1) {
            blend.k = Math.min(1, blend.k + dt / 0.9);
            const e = blend.k * blend.k * (3 - 2 * blend.k);
            pos.lerpVectors(blend.p, pos, e);
          }
          applyCam();
        }
      } else if (st.mode === 'rise') {
        riseStep(dt);
      } else if (st.mode === 'overview') {
        if (st.playing || st.spin) st.ov += dt;
        if (st.spin) st.az += dt * 0.045; // a slow turn after the tour, until you take hold of it
        if (st.spin && st.ov >= 4 && !st.ended) { st.ended = true; setPlaying(false); elEnd.style.display = 'block'; }
        dollPos(camera.position);
        camera.lookAt(ovC);
        frameAboveBar(1);
      } else if (st.mode === 'free') {
        freeStep(dt);
        applyCam();
      } else {
        applyCam();
      }
      // progress, chips, caption, map (every third frame is plenty)
      if (uiTick++ % 3) return;
      const tt = st.mode === 'overview' ? (st.t >= total ? total + END : st.t) : st.mode === 'rise' ? total + Math.min(rise.t, END) : st.t;
      elFill.style.width = ((tt / (total + END)) * 100).toFixed(2) + '%';
      elTime.textContent = fmt(tt) + ' / ' + fmt(total + END);
      let cur = -1;
      for (let i = 0; i < stops.length; i++) if (tt >= stops[i].t - 0.05) cur = i;
      chips.forEach((c, i) => c.classList.toggle('on', i === cur && (st.playing || st.mode === 'overview' || st.mode === 'rise')));
      if (cur >= 0 && cur !== tick.lastChip && st.playing) { tick.lastChip = cur; const c = chips[cur]; if (c.scrollIntoView) elStops.scrollLeft = Math.max(0, c.offsetLeft - elStops.clientWidth / 2 + c.offsetWidth / 2); }
      caption();
      label();
      drawMap();
      if (elTodLbl && A.todLabel) elTodLbl.textContent = A.todLabel();
    }

    if (window.PLAN_SOURCE) { // single-file build: say where the layout came from
      const n0 = document.getElementById('notice');
      if (n0) {
        n0.textContent = window.PLAN_SOURCE === 'editor' ? "Layout read from the plan editor's files." : 'Layout: the copy built into this file (editor files not found).';
        n0.style.display = 'block';
        setTimeout(() => { n0.style.display = 'none'; }, 9000);
      }
    }
    if (A.planEdited) {
      const n = document.getElementById('notice');
      if (n) {
        const hit = A.checkTour().length > 0;
        n.innerHTML = (hit ? 'Edited plan in use. Part of the guided tour now passes through a wall; free walking still works. ' : 'Edited plan in use. ') + '<a href="editor.html">Open editor</a>';
        n.style.display = 'block';
      }
    }
    const ed = document.getElementById('editlink');
    if (ed) ed.addEventListener('click', () => { ed.href = 'editor.html?t=' + Date.now(); });
    // start at the first point of the tour, ready to play
    enterTour(0, true);
    st.mode = 'free';
    setPlaying(false);
    applyCam();
    setDollLabel();
    const q = new URLSearchParams(location.search);
    if (q.get('stop')) A.jump(q.get('stop'));
    if (q.get('play') === '1') { st.mode = 'tour'; st.playing = true; elPlay.textContent = '❚❚ Pause'; elHint.classList.add('hide'); if (elStart) elStart.classList.add('gone'); }
    return tick;
  };
})();
