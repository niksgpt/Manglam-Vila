/* Three interior styles for the same home. A style only changes finishes
   (paint, floor, timber, fabric, metal, rugs, art), so switching is instant. */
(function () {
  const A = (window.APP = window.APP || {});

  // wood = [hue, saturation %, lightness %]
  A.STYLES = {
    modern: {
      label: 'Modern', wall: 0xf3f3f1, ceiling: 0xffffff,
      floor: { kind: 'stone', base: '#d9d9d6', vein: '96,98,104', rough: 0.2 },
      bedfloor: [28, 12, 40], wood: [24, 20, 26], dark: [20, 8, 13], flute: ['#1f2022', '#4a4c50', '#35373a', '#17181a'],
      accent: { c: 0x1d1d1f, r: 0.38, m: 0.85 }, frame: 0x151516, cab: 0x2f3337, counter: 0xf4f4f2,
      fab: { Ivory: 0xe8e8e5, Sand: 0xbfc1c2, Terra: 0x3b4046, Mustard: 0xc6c1b7, Teal: 0x2f4a66, Grey: 0x6f7377 },
      rugs: [['#3e4247', '#e6e6e3', '#9aa0a6'], ['#c9c9c5', '#3a3d41', '#2f4a66'], ['#55595f', '#e9e9e6', '#b9bcc0'], ['#8a8d91', '#ececea', '#3a3d41']],
      art: [['#ececea', '#1d1d1f', '#2f4a66', '#9aa0a6'], ['#dedede', '#2f4a66', '#1d1d1f', '#c6c1b7'], ['#f1f1ef', '#3b4046', '#9aa0a6', '#1d1d1f'], ['#cfd2d6', '#1d1d1f', '#2f4a66', '#f1f1ef']],
      clad: 0xc9ccd1, pot: 0x2b2b2d, glow: 0xfff0dc,
    },
    scandi: {
      label: 'Scandinavian', wall: 0xfbfaf6, ceiling: 0xffffff,
      floor: { kind: 'wood', wood: [36, 34, 70], rough: 0.55 },
      bedfloor: [36, 32, 68], wood: [36, 40, 63], dark: [33, 30, 50], flute: ['#b9976b', '#e6cfa6', '#d3b88a', '#a78458'],
      accent: { c: 0x2a2a2a, r: 0.5, m: 0.6 }, frame: 0xe7e5df, cab: 0xe9e6de, counter: 0xe7e1d6,
      fab: { Ivory: 0xf2eee5, Sand: 0xdad3c5, Terra: 0xc9a79a, Mustard: 0xdcc99a, Teal: 0x9db0a3, Grey: 0xb9b8b1 },
      rugs: [['#e7e0d2', '#8f9c8f', '#c9a79a'], ['#dcd6c8', '#6f7b70', '#dcc99a'], ['#e9e3d6', '#9db0a3', '#b7a58a'], ['#d8d2c4', '#f4f0e8', '#8f9c8f']],
      art: [['#f4f0e8', '#9db0a3', '#c9a79a', '#3a3a38'], ['#efe9dd', '#dcc99a', '#9db0a3', '#6f7b70'], ['#f6f2ea', '#c9a79a', '#3a3a38', '#b7a58a'], ['#e9e3d6', '#6f7b70', '#f6f2ea', '#dcc99a']],
      clad: 0xf1ede5, pot: 0xe6e0d4, glow: 0xffe9c8,
    },
    luxury: {
      label: 'Warm luxury', wall: 0xf2ede3, ceiling: 0xffffff,
      floor: { kind: 'stone', base: '#e9e2d5', vein: '140,122,98', rough: 0.22 },
      bedfloor: [30, 36, 50], wood: [26, 44, 36], dark: [24, 30, 20], flute: ['#5f4029', '#a47550', '#8b603f', '#4b301d'],
      accent: { c: 0xc9a25a, r: 0.28, m: 1.0 }, frame: 0x2f2a27, cab: 0x8c9a84, counter: 0xf1eee8,
      fab: { Ivory: 0xe7dfd0, Sand: 0xc9b79c, Terra: 0xb8674a, Mustard: 0xc99a3c, Teal: 0x3f6f73, Grey: 0x8c8a85 },
      rugs: [['#b46a4c', '#f0e4cf', '#e3b65c'], ['#c7a04a', '#f3ead8', '#7a4a33'], ['#6f8587', '#efe8da', '#d9c08a'], ['#8b8478', '#e9e1d2', '#c7a877']],
      art: [['#efe6d6', '#b8674a', '#c99a3c', '#3f6f73', '#2e2a28'], ['#e9dfd0', '#3f6f73', '#d6a48c', '#c99a3c'], ['#f1e9db', '#b8674a', '#8c9a84', '#2e2a28'], ['#d9c9b0', '#7a4a33', '#3f6f73', '#f3ead8']],
      clad: 0xffffff, pot: 0xb5694d, glow: 0xffd9a0,
    },
  };

  const cache = {};
  function textures(name) {
    if (cache[name]) return cache[name];
    const T = THREE, K = A.texKit, st = A.STYLES[name], seed = { modern: 100, scandi: 200, luxury: 300 }[name];
    const woodTex = (w, plank, gap, vary, size, sd) => K.tex(size, (g, s, R) => K.wood(g, s, R, w[0], w[1], w[2], plank, gap, vary), seed + sd);
    const clampT = (t) => { t.wrapS = t.wrapT = T.ClampToEdgeWrapping; return t; };
    const o = {};
    o.floor = st.floor.kind === 'wood' ? woodTex(st.floor.wood, 128, 0.4, 7, 1024, 1) : K.tex(1024, (g, s, R) => K.marble(g, s, R, st.floor.base, st.floor.vein, 2, 1), seed + 1);
    o.bedfloor = woodTex(st.bedfloor, 128, 0.5, 9, 1024, 2);
    o.wood = woodTex(st.wood, 512, 0, 3, 512, 3);
    o.woodV = o.wood.clone(); o.woodV.rotation = Math.PI / 2; o.woodV.needsUpdate = true;
    o.dark = woodTex(st.dark, 512, 0, 3, 512, 4);
    o.darkV = o.dark.clone(); o.darkV.rotation = Math.PI / 2; o.darkV.needsUpdate = true; // upright grain, for doors
    o.flute = K.tex(512, (g, s, R) => {
      const n = 16, w = s / n;
      for (let i = 0; i < n; i++) {
        const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
        gr.addColorStop(0, st.flute[0]); gr.addColorStop(0.25, st.flute[1]); gr.addColorStop(0.6, st.flute[2]); gr.addColorStop(1, st.flute[3]);
        g.fillStyle = gr; g.fillRect(i * w, 0, w + 1, s);
      }
    }, seed + 5);
    o.rugs = st.rugs.map((c, i) => clampT(K.tex(512, (g, s, R) => K.rug(g, s, R, c[0], c[1], c[2]), seed + 10 + i)));
    o.art = st.art.map((pal, i) => clampT(K.tex(512, (g, s, R) => K.art(g, s, R, pal), seed + 20 + i)));
    return (cache[name] = o);
  }

  A.setStyle = function (name) {
    if (!A.STYLES[name]) name = 'luxury';
    const st = A.STYLES[name], M = A.M, t = textures(name);
    const map = (m, tex) => { m.map = tex; m.needsUpdate = true; };
    A.style = name;
    M.wall.color.setHex(st.wall);
    M.ceiling.color.setHex(st.ceiling);
    map(M.marble, t.floor); M.marble.roughness = st.floor.rough; M.marble.color.setHex(0xffffff);
    map(M.stair, t.floor); M.stair.roughness = st.floor.rough + 0.08; M.stair.color.setHex(st.floor.kind === 'wood' ? 0xffffff : 0xf1e9dc);
    map(M.woodfloor, t.bedfloor);
    map(M.teak, t.wood); map(M.teakV, t.woodV); map(M.walnut, t.dark); map(M.fluted, t.flute);
    M.brass.color.setHex(st.accent.c); M.brass.roughness = st.accent.r; M.brass.metalness = st.accent.m;
    M.frame.color.setHex(st.frame); M.frame.metalness = name === 'scandi' ? 0.1 : 0.6;
    // doors and windows keep the architect's oak veneer ('joinery', materials.js) in every style
    M.sage.color.setHex(st.cab);
    M.quartz.color.setHex(st.counter);
    for (const k in st.fab) M['fab' + k].color.setHex(st.fab[k]);
    [M.rugLiving, M.rugLounge, M.rugBed, M.rugGF].forEach((m, i) => map(m, t.rugs[i]));
    [M.art1, M.art2, M.art3, M.art4].forEach((m, i) => map(m, t.art[i]));
    M.cladding.color.setHex(st.clad);
    M.pot.color.setHex(st.pot);
    M.glow.emissive.setHex(st.glow); M.glowSoft.emissive.setHex(st.glow);
    document.querySelectorAll('[data-style]').forEach((b) => b.classList.toggle('on', b.dataset.style === name));
    if (A.onStyle) A.onStyle(name);
  };

  A.bindStyleButtons = function () {
    document.querySelectorAll('[data-style]').forEach((b) => b.addEventListener('click', () => A.setStyle(b.dataset.style)));
  };
})();
