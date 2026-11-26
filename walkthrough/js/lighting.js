/* Sky, sun and interior lights, driven by one time-of-day value:
   0 = morning, 0.3 = midday, 0.55 = late afternoon, 0.72 = sunset, 1 = night.
   The sun's direction at each moment is the site's own (js/site-data.js, made in Blender by
   blender/sun_path.py: the equinox sun at the site's latitude and longitude, turned to the way
   the house faces, rear to the SE at 132 deg); it turns golden as it drops, and after dark the
   lamps and ceiling lights take over. */
(function () {
  const A = (window.APP = window.APP || {});
  const T = THREE;

  /* Key moments. d = direction to the sun (or moon), c = its colour, i = its strength,
     zen / hor = sky colours, hs = colour of the light from above, hemi = its strength,
     lamp = how bright the room lights are, glow = how bright fittings look, env = how
     much sky the shiny surfaces mirror, st = stars. */
  const KEYS = [
    { t: 0.00, h: 7.0, name: 'Morning', d: [0.30, 0.26, -0.92], c: [1.0, 0.86, 0.70], i: 3.8, zen: [0.26, 0.46, 0.78], hor: [0.98, 0.80, 0.66], hs: [0.88, 0.90, 1.0], hemi: 0.40, lamp: 0.55, glow: 0.8, env: 0.30, st: 0 },
    { t: 0.30, h: 12.5, name: 'Midday', d: [0.52, 0.84, -0.10], c: [1.0, 0.97, 0.92], i: 5.4, zen: [0.20, 0.42, 0.80], hor: [0.80, 0.87, 0.95], hs: [0.87, 0.91, 1.0], hemi: 0.50, lamp: 0.5, glow: 0.7, env: 0.36, st: 0 },
    { t: 0.55, h: 16.5, name: 'Afternoon', d: [0.36, 0.42, 0.83], c: [1.0, 0.82, 0.63], i: 5.2, zen: [0.23, 0.42, 0.74], hor: [0.95, 0.78, 0.60], hs: [0.867, 0.906, 1.0], hemi: 0.42, lamp: 1.0, glow: 1.0, env: 0.34, st: 0 },
    { t: 0.72, h: 18.25, name: 'Sunset', d: [0.26, 0.19, 0.95], c: [1.0, 0.58, 0.27], i: 4.8, zen: [0.22, 0.27, 0.52], hor: [1.0, 0.56, 0.26], hs: [1.0, 0.80, 0.66], hemi: 0.30, lamp: 1.05, glow: 1.3, env: 0.30, st: 0 },
    { t: 0.80, h: 18.9, name: 'Dusk', d: [0.22, 0.05, 0.975], c: [1.0, 0.42, 0.20], i: 1.0, zen: [0.12, 0.15, 0.36], hor: [0.85, 0.38, 0.24], hs: [0.80, 0.66, 0.72], hemi: 0.22, lamp: 1.25, glow: 1.7, env: 0.24, st: 0.15 },
    { t: 0.84, h: 19.2, name: 'Dusk', d: [0.22, 0.05, 0.975], c: [1.0, 0.42, 0.20], i: 0.0, zen: [0.07, 0.10, 0.26], hor: [0.50, 0.26, 0.24], hs: [0.66, 0.62, 0.78], hemi: 0.18, lamp: 1.35, glow: 1.9, env: 0.20, st: 0.45 },
    { t: 0.88, h: 19.5, name: 'Evening', d: [-0.35, 0.62, -0.45], c: [0.62, 0.72, 1.0], i: 0.0, zen: [0.04, 0.06, 0.17], hor: [0.24, 0.17, 0.24], hs: [0.58, 0.60, 0.80], hemi: 0.16, lamp: 1.4, glow: 2.0, env: 0.16, st: 0.7 },
    { t: 1.00, h: 21.5, name: 'Night', d: [-0.35, 0.70, -0.40], c: [0.62, 0.72, 1.0], i: 0.5, zen: [0.012, 0.018, 0.05], hor: [0.05, 0.06, 0.12], hs: [0.55, 0.58, 0.80], hemi: 0.16, lamp: 1.5, glow: 2.2, env: 0.12, st: 1 },
  ];
  // the site's sun (and moon) for each moment, where the site file is there
  const SITE = window.SITE;
  if (SITE && SITE.keys) for (const k of KEYS) { const s = SITE.keys.find((q) => q.name === k.name && Math.abs(q.h - k.h) < 0.01); if (s) k.d = s.d.slice(); }
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  function at(t) {
    t = Math.min(1, Math.max(0, t));
    let j = 1;
    while (j < KEYS.length - 1 && KEYS[j].t < t) j++;
    const a = KEYS[j - 1], b = KEYS[j], k = (t - a.t) / (b.t - a.t), o = { name: k < 0.5 ? a.name : b.name };
    for (const key of ['h', 'i', 'hemi', 'lamp', 'glow', 'env', 'st']) o[key] = lerp(a[key], b[key], k);
    for (const key of ['d', 'c', 'zen', 'hor', 'hs']) o[key] = lerp3(a[key], b[key], k);
    return o;
  }
  A.todLabel = function (t) {
    const o = at(t === undefined ? A.tod : t), m = Math.round(o.h * 4) * 15, hh = Math.floor(m / 60), mm = m % 60;
    return ((hh + 11) % 12) + 1 + ':' + String(mm).padStart(2, '0') + (hh >= 12 ? ' pm' : ' am') + ' · ' + o.name;
  };

  A.buildLighting = function (scene, renderer) {
    const P = A.plan, H = P.H, GF = P.GF, SLAB = P.SLAB, GR = P.ground, M = A.M;
    const sunDir = new T.Vector3(0.36, 0.42, 0.83).normalize();
    A.sunDir = sunDir;

    const U = {
      sun: { value: sunDir }, zen: { value: new T.Vector3() }, hor: { value: new T.Vector3() }, gnd: { value: new T.Vector3() },
      sunCol: { value: new T.Vector3(1, 0.82, 0.63) }, glow: { value: 1 },
    };
    const sky = {
      side: T.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'varying vec3 vDir; uniform vec3 sun; uniform vec3 zen; uniform vec3 hor; uniform vec3 gnd; uniform vec3 sunCol; uniform vec3 amb;',
        'uniform float glow; uniform float stars; uniform float gain;',
        'float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  vec3 c = mix(hor, zen, pow(clamp(d.y,0.0,1.0), 0.5));',
        '  c = mix(c, gnd, smoothstep(0.0,-0.10,d.y));',
        '  float s = max(dot(d,sun),0.0);',
        '  c += sunCol*(pow(s,5.0)*0.45 + pow(s,600.0)*6.0)*glow;',
        '  if (stars > 0.0 && d.y > 0.0) { float h = hash(floor(d*190.0)); c += vec3(0.9,0.95,1.0)*step(0.9972,h)*stars*smoothstep(0.0,0.25,d.y)*(0.5+0.5*fract(h*91.0)); }',
        '  gl_FragColor = vec4(c*gain + amb,1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    };
    const skyMat = new T.ShaderMaterial(Object.assign({}, sky, { uniforms: Object.assign({}, U, { stars: { value: 0 }, gain: { value: 1 }, amb: { value: new T.Vector3(0, 0, 0) } }) }));
    const skyMesh = new T.Mesh(new T.SphereGeometry(1200, 32, 16), skyMat);
    skyMesh.name = 'sky';
    scene.add(skyMesh);

    // A dimmed copy of the sky drives reflections on glass, marble and metal.
    const envMat = new T.ShaderMaterial(Object.assign({}, sky, { uniforms: Object.assign({}, U, { stars: { value: 0 }, gain: { value: 0.34 }, amb: { value: new T.Vector3(0, 0, 0) } }) }));
    const envScene = new T.Scene();
    envScene.add(new T.Mesh(skyMesh.geometry, envMat));
    let pm = null, envRT = null;
    try { pm = new T.PMREMGenerator(renderer); } catch (err) { console.warn('environment map skipped', err); }
    function refreshEnv() {
      if (!pm) return;
      try {
        const rt = pm.fromScene(envScene, 0, 1, 3000);
        scene.environment = rt.texture;
        if (envRT) envRT.dispose();
        envRT = rt;
      } catch (err) { pm = null; }
    }

    const hemi = new T.HemisphereLight(0xdde7ff, 0xcbb596, 0.42);
    scene.add(hemi);

    const sun = new T.DirectionalLight(0xffd0a0, 5.2);
    const target = new T.Vector3(14, 0, 26);
    sun.position.copy(target).addScaledVector(sunDir, 130);
    sun.target.position.copy(target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 20; sc.far = 260;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
    sun.shadow.radius = 3.2; // soft edges
    scene.add(sun, sun.target);
    A.sun = sun;

    // Interior lights: [x, y, height, intensity, reach]
    const VC = P.voidCenter;
    const lamps = [
      [5, 6, 8.3, 46, 24],         // 0 living seating
      [14.3, 7.9, 6.1, 34, 20],    // 1 dining pendant
      [23.2, 5.6, 8.8, 32, 17],    // 2 kitchen
      [23, 11.3, 8.8, 20, 13],     // 3 common washroom
      [4.6, 21, 8.4, 34, 20],      // 4 lounge
      [VC[0], VC[1], 3.4, 95, 34], // 5 chandelier in the void
      [14, 26.2, 8.6, 16, 14],     // 6 gallery
      [15.5, 36.5, 8.4, 40, 24],   // 7 master bedroom
      [25.6, 41.4, 8.6, 15, 12],   // 8 dress
      [25.6, 34, 8.6, 22, 14],     // 9 master toilet
    ];
    const OVER = { first: [0, 4, 5, 7], ground: [0, 4, 5, 7] };
    if (GR) {
      const g0 = lamps.length, HG = GR.H, gl = (x, y, h, i, r) => lamps.push([x, y, GF + h, i, r]);
      gl(4.8, 19.6, HG - 2.6, 46, 24);     // +0 hall, seating end
      gl(17.6, 20.6, HG - 2.4, 42, 26);    // +1 hall, dining end
      gl(12.6, 32.4, HG - 2.3, 30, 16);    // +2 kitchen
      gl(6.4, 9.6, HG - 2.6, 38, 20);      // +3 children's bedroom
      gl(2.3, 2.6, HG - 3.4, 16, 9);       // +4 pooja
      gl(16.4, 11.4, HG - 2.3, 18, 11);    // +5 common toilet
      gl(24.2, 6.6, HG - 2.6, 36, 20);     // +6 guest bedroom
      gl(23.4, 30.8, HG - 2.3, 20, 12);    // +7 toilet
      gl(22.6, 39, HG - 2.6, 38, 22);      // +8 master bedroom
      gl(4.2, 31, HG - 2.4, 22, 15);       // +9 entry lobby
      gl(6, 44.5, HG - 2.6, 26, 22);       // +10 car porch
      OVER.ground = [g0, g0 + 1, g0 + 3, g0 + 8];
    } else {
      lamps.push([16, 20, GF + 7.5, 38, 26]); // placeholder room below
    }
    /* Only the few lamps nearest the viewer are switched on at any moment. The
       picture looks the same, but each frame costs much less to draw. A lamp
       fades out as it becomes the furthest of the set, so nothing pops. */
    const POOL = 4, pool = [], order = lamps.map((l, i) => i), dist = lamps.map(() => 0);
    for (let k = 0; k < POOL; k++) { const l = new T.PointLight(0xffd8a8, 0, 30, 2); scene.add(l); pool.push(l); }
    let lampScale = 1;
    A.updateLights = function (p, overview) { // overview: false, or the floor being shown from above
      const pick = overview ? OVER[overview === 'ground' ? 'ground' : 'first'] : null;
      for (let i = 0; i < lamps.length; i++) dist[i] = pick ? (pick.indexOf(i) < 0 ? 1e6 : pick.indexOf(i)) : Math.hypot(lamps[i][0] - p.x, lamps[i][2] - p.y, lamps[i][1] - p.z);
      order.sort((a, b) => dist[a] - dist[b]);
      const edge = dist[order[POOL]];
      for (let k = 0; k < POOL; k++) {
        const L = lamps[order[k]], w = pick ? 1 : Math.max(0, Math.min(1, (edge - dist[order[k]]) / 6));
        pool[k].position.set(L[0], L[2], L[1]);
        pool[k].intensity = L[3] * w * lampScale;
        pool[k].distance = L[4];
      }
    };

    // Recessed downlights (visual only): small glowing squares in the ceiling, each
    // with a soft halo that comes up as it gets dark.
    const B = new A.Batcher();
    const halos = { ceil: [], gmain: [] };
    const haloTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,224,170,1)'); gr.addColorStop(0.25, 'rgba(255,205,140,0.45)'); gr.addColorStop(1, 'rgba(255,190,120,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      return t;
    })();
    const haloMat = new T.MeshBasicMaterial({ map: haloTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    function spot(x, y, top, grp) {
      B.box('downlight', x - 0.17, y - 0.17, x + 0.17, y + 0.17, top - 0.045, top, grp);
      const q = new T.PlaneGeometry(1.7, 1.7);
      q.rotateX(Math.PI / 2); // facing down
      q.translate(x, top - 0.06, y);
      halos[grp].push(q);
    }
    const grid = (x0, y0, x1, y1, nx, ny, top, grp) => {
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) spot(x0 + ((x1 - x0) * (i + 0.5)) / nx, y0 + ((y1 - y0) * (j + 0.5)) / ny, top, grp);
    };
    const f = (x0, y0, x1, y1, nx, ny) => grid(x0, y0, x1, y1, nx, ny, H + 0.01, 'ceil');
    f(0.5, 1.2, 18.5, 13.4, 4, 3);     // living
    f(20, 3.3, 27.2, 7.7, 3, 2);       // kitchen
    f(20.2, 9, 26, 13.6, 2, 2);        // common washroom
    spot(28.4, 10.5, H + 0.01, 'ceil');
    f(1, 15.6, 8.6, 27, 2, 3);         // lounge
    f(10.4, 25.2, 26, 27.2, 4, 1);     // gallery and stair
    f(10.2, 29.4, 21.4, 45.2, 3, 4);   // bedroom
    f(23.4, 39, 28.4, 43.6, 2, 2);     // dress
    f(23.4, 29.2, 28.6, 37, 2, 3);     // master toilet
    if (GR) {
      const top = -SLAB - 0.03, g = (x0, y0, x1, y1, nx, ny) => grid(x0, y0, x1, y1, nx, ny, top, 'gmain');
      g(1, 15.6, 12.6, 27, 4, 3);        // hall, under the lounge
      g(13.6, 25, 20, 27.4, 3, 1);       // hall, under the gallery
      g(0.5, 5.6, 12, 13.6, 3, 2);       // children's bedroom
      spot(2.2, 2.7, top, 'gmain');      // pooja
      spot(9, 2.4, top, 'gmain');        // court
      spot(16.2, 2.6, top, 'gmain');     // store
      g(14, 10.4, 18.6, 13.4, 2, 1);     // common toilet
      spot(17.4, 8.1, top, 'gmain');
      g(20.6, 1.8, 28.8, 11.4, 3, 3);    // guest bedroom
      g(10.8, 29.4, 15.2, 35.4, 2, 3);   // kitchen
      spot(18, 29.6, top, 'gmain'); spot(18, 32, top, 'gmain'); // passage
      g(21, 29.2, 26.4, 32.4, 3, 1);     // toilet
      g(17.4, 34.8, 28.4, 43.4, 3, 3);   // master bedroom
      g(1.5, 29.6, 6.8, 32.4, 2, 1);     // entry lobby
      g(1.5, 35.6, 7, 38.4, 2, 1);       // car porch
      g(1.6, 40, 11, 46, 3, 2);
    }
    B.flush(A.groups);
    const haloMeshes = [];
    for (const grp in halos) {
      if (!halos[grp].length) continue;
      const m = new T.Mesh(A.kit.merge(halos[grp]), haloMat);
      m.renderOrder = 8;
      m.visible = false;
      A.groups[grp].add(m);
      haloMeshes.push(m);
    }

    // --- time of day --------------------------------------------------------------
    const base = {}; // how much sky each shiny finish mirrors at the afternoon setting
    for (const k of ['marble', 'stair', 'stairMarble', 'bathwall', 'woodfloor', 'bathfloor', 'ceramic', 'quartz', 'glass', 'railglass', 'screen', 'car']) if (M[k]) base[k] = M[k].envMapIntensity;
    M.woodfloor.roughness = 0.42; // a little sheen, so lamps and windows glint on timber floors too
    M.bathfloor.roughness = 0.36;
    M.nbwin.emissive.setRGB(1, 0.76, 0.48);
    let cur = -1, goal = 0.55, envAt = -1, envT = 0, settle = 0;
    function apply(t) {
      const o = at(t), night = Math.min(1, Math.max(0, (t - 0.74) / 0.16)), day = Math.min(1, o.i / 3);
      sunDir.set(o.d[0], o.d[1], o.d[2]).normalize();
      sun.position.copy(target).addScaledVector(sunDir, 130);
      sun.color.setRGB(o.c[0], o.c[1], o.c[2]);
      sun.intensity = o.i;
      U.zen.value.set(o.zen[0], o.zen[1], o.zen[2]);
      U.hor.value.set(o.hor[0], o.hor[1], o.hor[2]);
      U.gnd.value.set(o.hor[0] * 0.52, o.hor[1] * 0.58, o.hor[2] * 0.66);
      U.sunCol.value.set(o.c[0], o.c[1], o.c[2]);
      U.glow.value = Math.min(1, o.i / 5.2) + 0.02;
      skyMat.uniforms.stars.value = o.st;
      envMat.uniforms.gain.value = o.env;
      envMat.uniforms.amb.value.set(0.10 * night, 0.075 * night, 0.05 * night); // after dark, metal mirrors the lit rooms
      hemi.color.setRGB(o.hs[0], o.hs[1], o.hs[2]);
      hemi.groundColor.setRGB(lerp(0.796, 0.95, night), lerp(0.71, 0.74, night), lerp(0.588, 0.5, night));
      hemi.intensity = o.hemi;
      lampScale = o.lamp;
      M.glow.emissiveIntensity = 2.2 * o.glow;
      M.glowSoft.emissiveIntensity = 0.9 * o.glow;
      M.downlight.emissiveIntensity = 0.35 + 0.45 * o.glow; // warm white by day, brighter (still warm) at night
      M.ceiling.emissiveIntensity = 0.1 + 0.32 * day;       // the white ceiling's lift: full by day, faint at night
      M.frost.emissiveIntensity = 0.5 * day;
      M.nbwin.emissiveIntensity = 1.5 * night;
      for (const k in base) M[k].envMapIntensity = base[k] * (k === 'glass' || k === 'railglass' ? 1 + 0.5 * night : 1);
      M.glass.opacity = 0.16 + 0.1 * night;
      haloMat.opacity = 0.75 * night;
      for (const m of haloMeshes) m.visible = night > 0.01;
      if (A.refreshShadows) A.refreshShadows();
    }
    A.tod = 0.55;
    A.setTod = function (t, instant) {
      goal = Math.min(1, Math.max(0, +t || 0));
      if (instant) { cur = goal; A.tod = cur; apply(cur); refreshEnv(); envAt = cur; settle = 0; }
    };
    /* Called every frame. Moves smoothly toward the chosen time; the sky mirrored
       by shiny surfaces is redrawn a few times a second while it changes. */
    A.todStep = function (dt) {
      if (Math.abs(goal - cur) > 0.0005) {
        cur += (goal - cur) * (1 - Math.exp(-5 * dt));
        if (Math.abs(goal - cur) <= 0.0005) cur = goal;
        A.tod = cur;
        apply(cur);
        envT += dt;
        if (envT > 0.3 && Math.abs(cur - envAt) > 0.012) { refreshEnv(); envAt = cur; envT = 0; }
        settle = 0.35;
        return true;
      }
      if (settle > 0) {
        settle -= dt;
        if (settle <= 0) { if (envAt !== cur) { refreshEnv(); envAt = cur; } if (A.onTodSettled) A.onTodSettled(); }
      }
      return false;
    };
    A.setTod(0.55, true);
    A.updateLights(new T.Vector3(17, 5, 26), false);
  };
})();
