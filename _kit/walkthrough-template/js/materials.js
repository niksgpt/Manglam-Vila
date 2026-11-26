/* Procedural textures and the material palette: warm contemporary with Jaipur touches. */
(function () {
  const A = (window.APP = window.APP || {});
  const T = THREE;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function tex(size, draw, seed) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    draw(g, size, rng(seed || 1));
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }

  function clouds(g, s, R, n, cols, amin, amax) {
    for (let i = 0; i < n; i++) {
      const x = R() * s, y = R() * s, r = s * (0.04 + R() * 0.14);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const c = cols[(R() * cols.length) | 0], a = amin + R() * (amax - amin);
      gr.addColorStop(0, `rgba(${c},${a})`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  }
  function speckle(g, s, R, n, col, a) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(${col},${R() * a})`;
      g.fillRect(R() * s, R() * s, 1 + R() * 2, 1 + R() * 2);
    }
  }
  function grout(g, s, nx, ny, col, w) {
    g.fillStyle = col;
    for (let i = 0; i < nx; i++) g.fillRect((i * s) / nx - w / 2, 0, w, s);
    for (let j = 0; j < ny; j++) g.fillRect(0, (j * s) / ny - w / 2, s, w);
    g.fillRect(s - w / 2, 0, w, s);
    g.fillRect(0, s - w / 2, s, w);
  }

  function marble(g, s, R, base, vein, nx, ny) {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    clouds(g, s, R, 70, ['255,255,255', '196,180,154'], 0.04, 0.1);
    for (let i = 0; i < 16; i++) {
      let x = R() * s, y = R() * s, ang = R() * Math.PI * 2;
      g.beginPath();
      g.moveTo(x, y);
      const n = 20 + R() * 30;
      for (let k = 0; k < n; k++) {
        ang += (R() - 0.5) * 0.7;
        x += Math.cos(ang) * 14;
        y += Math.sin(ang) * 14;
        g.lineTo(x, y);
      }
      g.strokeStyle = `rgba(${vein},${0.08 + R() * 0.16})`;
      g.lineWidth = 0.6 + R() * 1.8;
      g.stroke();
    }
    grout(g, s, nx, ny, 'rgba(120,108,92,0.55)', 2);
  }

  function wood(g, s, R, hue, sat, lum, plank, gap, vary) {
    for (let y = 0; y < s; y += plank) {
      let x = -R() * s * 0.5;
      while (x < s) {
        const len = s * (0.45 + R() * 0.5);
        g.fillStyle = `hsl(${hue + (R() - 0.5) * 6},${sat}%,${lum + (R() - 0.5) * vary}%)`;
        g.fillRect(x, y, len, plank);
        for (let k = 0; k < plank * 0.5; k++) {
          const yy = y + R() * plank;
          g.strokeStyle = `rgba(50,28,10,${0.03 + R() * 0.07})`;
          g.lineWidth = 0.5 + R();
          g.beginPath();
          g.moveTo(x, yy);
          g.bezierCurveTo(x + len * 0.3, yy + (R() - 0.5) * 4, x + len * 0.6, yy + (R() - 0.5) * 4, x + len, yy + (R() - 0.5) * 3);
          g.stroke();
        }
        g.fillStyle = `rgba(25,14,6,${gap})`;
        g.fillRect(x + len - 1.5, y, 1.5, plank);
        x += len;
      }
      g.fillStyle = `rgba(25,14,6,${gap})`;
      g.fillRect(0, y, s, 1.5);
    }
  }

  function stoneTile(g, s, R, base, nx, ny) {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    clouds(g, s, R, 50, ['255,235,220', '150,95,75'], 0.03, 0.08);
    speckle(g, s, R, 5000, '90,50,35', 0.12);
    speckle(g, s, R, 3000, '255,240,230', 0.12);
    grout(g, s, nx, ny, 'rgba(110,80,66,0.6)', 3);
  }

  function cladding(g, s, R) {
    g.fillStyle = '#8f8271';
    g.fillRect(0, 0, s, s);
    let y = 0;
    while (y < s) {
      const h = 14 + R() * 22;
      let x = -R() * 80;
      while (x < s) {
        const w = 60 + R() * 150;
        const l = 62 + R() * 16;
        g.fillStyle = `hsl(${32 + R() * 8},${18 + R() * 10}%,${l}%)`;
        g.fillRect(x + 1, y + 1, w - 2, h - 2);
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(x + 1, y + 1, w - 2, 2);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(x + 1, y + h - 3, w - 2, 2);
        x += w;
      }
      y += h;
    }
    speckle(g, s, R, 6000, '60,45,30', 0.1);
  }

  function fluted(g, s, R) {
    const n = 16, w = s / n;
    for (let i = 0; i < n; i++) {
      const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      gr.addColorStop(0, '#5f4029');
      gr.addColorStop(0.25, '#a47550');
      gr.addColorStop(0.6, '#8b603f');
      gr.addColorStop(1, '#4b301d');
      g.fillStyle = gr;
      g.fillRect(i * w, 0, w + 1, s);
    }
    speckle(g, s, R, 4000, '40,22,10', 0.08);
  }

  function rug(g, s, R, bg, fg, ac) {
    g.fillStyle = bg;
    g.fillRect(0, 0, s, s);
    speckle(g, s, R, 9000, '255,255,255', 0.06);
    g.strokeStyle = fg;
    g.lineWidth = s * 0.012;
    g.strokeRect(s * 0.04, s * 0.04, s * 0.92, s * 0.92);
    g.lineWidth = s * 0.006;
    g.strokeRect(s * 0.075, s * 0.075, s * 0.85, s * 0.85);
    const n = 5, c = (s * 0.8) / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const cx = s * 0.1 + c * (i + 0.5), cy = s * 0.1 + c * (j + 0.5), r = c * 0.36;
        g.beginPath();
        g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy);
        g.closePath();
        g.strokeStyle = (i + j) % 2 ? fg : ac;
        g.lineWidth = s * 0.006;
        g.stroke();
        g.fillStyle = (i + j) % 2 ? ac : fg;
        g.fillRect(cx - r * 0.14, cy - r * 0.14, r * 0.28, r * 0.28);
      }
  }

  function art(g, s, R, pal) {
    g.fillStyle = pal[0];
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 7; i++) {
      g.fillStyle = pal[1 + ((R() * (pal.length - 1)) | 0)];
      g.globalAlpha = 0.75 + R() * 0.25;
      if (R() < 0.5) {
        g.beginPath();
        g.arc(R() * s, R() * s, s * (0.1 + R() * 0.25), R() * 6.3, R() * 6.3);
        g.closePath();
        g.fill();
      } else {
        g.fillRect(R() * s * 0.8, R() * s * 0.8, s * (0.1 + R() * 0.4), s * (0.08 + R() * 0.3));
      }
    }
    g.globalAlpha = 1;
    speckle(g, s, R, 5000, '255,255,255', 0.08);
  }

  /* A painting w x h pixels, so every frame on the walls can be different. kind picks the
     composition; pal = [ground, four paint colours]; R makes each one its own. */
  function painting(g, w, h, R, pal, kind) {
    const [bg, a, b, c, d] = pal, m = Math.min(w, h);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
    if (kind === 'landscape') { // dusk sky, a low sun, three ridges of hills
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, bg); sky.addColorStop(0.7, c); sky.addColorStop(1, c);
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = d; g.globalAlpha = 0.9;
      g.beginPath(); g.arc(w * (0.25 + R() * 0.5), h * (0.32 + R() * 0.12), m * (0.07 + R() * 0.05), 0, 6.3); g.fill();
      [a, b, d].forEach((col, k) => {
        g.fillStyle = col; g.globalAlpha = 0.8 + k * 0.07;
        const base = h * (0.5 + k * 0.15), ph = R() * 6, fr = 1 + R() * 2;
        g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += w / 40) g.lineTo(x, base - Math.sin((x / w) * Math.PI * fr + ph) * h * (0.05 + 0.02 * k));
        g.lineTo(w, h); g.closePath(); g.fill();
      });
    } else if (kind === 'field') { // colour field: two or three soft-edged blocks
      const n = 2 + (R() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        g.fillStyle = [a, b, c][k]; g.shadowColor = [a, b, c][k]; g.shadowBlur = m * 0.04; g.globalAlpha = 0.88;
        const y0 = h * (0.08 + (k * 0.86) / n), hh = h * (0.86 / n - 0.05);
        g.fillRect(w * 0.1, y0, w * 0.8, hh);
      }
      g.shadowBlur = 0;
    } else if (kind === 'arches') { // nested arches rising from the bottom edge
      const cx = w * (0.35 + R() * 0.3), base = h * 0.92, n = 4 + ((R() * 2) | 0), r0 = Math.min(w * 0.42, h * 0.75);
      for (let k = 0; k < n; k++) {
        g.fillStyle = [a, b, c, d, bg][k % 5];
        const r = r0 * (1 - k / (n + 0.6));
        g.beginPath(); g.moveTo(cx - r, base); g.arc(cx, base - r * 0.35, r, Math.PI, 0); g.lineTo(cx + r, base); g.closePath(); g.fill();
      }
      g.fillStyle = d; g.fillRect(0, base, w, h - base);
    } else if (kind === 'lines') { // calm horizontal bands, as if brushed
      let y = h * 0.06;
      while (y < h * 0.94) {
        const t = h * (0.02 + R() * 0.07);
        g.fillStyle = [a, b, c, d][(R() * 4) | 0]; g.globalAlpha = 0.65 + R() * 0.3;
        g.beginPath(); g.moveTo(w * 0.08, y);
        for (let x = w * 0.08; x <= w * 0.92; x += w / 30) g.lineTo(x, y + (R() - 0.5) * t * 0.25);
        for (let x = w * 0.92; x >= w * 0.08; x -= w / 30) g.lineTo(x, y + t + (R() - 0.5) * t * 0.25);
        g.closePath(); g.fill();
        y += t + h * (0.01 + R() * 0.03);
      }
    } else if (kind === 'botanical') { // a single stem with leaves, drawn simply
      const sx = w * 0.5, sy = h * 0.92, top = h * 0.1;
      g.strokeStyle = d; g.lineWidth = m * 0.012;
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + w * (R() - 0.5) * 0.3, (sy + top) / 2, sx + w * (R() - 0.5) * 0.15, top); g.stroke();
      const n = 7 + ((R() * 4) | 0);
      for (let k = 0; k < n; k++) {
        const t = 0.15 + (k / n) * 0.8, y = sy - (sy - top) * t, side = k % 2 ? 1 : -1, len = m * (0.16 + R() * 0.1) * (1.1 - t * 0.5);
        g.save(); g.translate(sx, y); g.rotate(side * (0.6 + R() * 0.4) - Math.PI / 2 * side * 0.2);
        g.fillStyle = [a, b, c][k % 3]; g.globalAlpha = 0.9;
        g.beginPath(); g.ellipse(side * len * 0.55, 0, len * 0.55, len * 0.2, 0, 0, 6.3); g.fill();
        g.restore();
      }
    } else if (kind === 'moon') { // a large disc, a small one, a horizon line
      g.fillStyle = a; g.globalAlpha = 0.95;
      g.beginPath(); g.arc(w * (0.4 + R() * 0.2), h * (0.38 + R() * 0.1), m * (0.26 + R() * 0.08), 0, 6.3); g.fill();
      g.fillStyle = b; g.beginPath(); g.arc(w * (0.15 + R() * 0.7), h * (0.15 + R() * 0.2), m * 0.06, 0, 6.3); g.fill();
      g.fillStyle = c; g.fillRect(0, h * 0.78, w, h * 0.22);
      g.fillStyle = d; g.fillRect(0, h * 0.78, w, h * 0.012);
    } else if (kind === 'grid') { // blocks on a fine grid, with a few left plain
      const cols = 3 + ((R() * 2) | 0), rows = Math.max(3, Math.round((cols * h) / w)), gw = (w * 0.84) / cols, gh = (h * 0.84) / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (R() < 0.3) continue;
        g.fillStyle = [a, b, c, d][(R() * 4) | 0]; g.globalAlpha = 0.85;
        g.fillRect(w * 0.08 + i * gw + gw * 0.06, h * 0.08 + j * gh + gh * 0.06, gw * 0.88, gh * 0.88);
      }
    } else { // abstract: overlapping shapes
      for (let i = 0; i < 7; i++) {
        g.fillStyle = [a, b, c, d][(R() * 4) | 0];
        g.globalAlpha = 0.75 + R() * 0.25;
        if (R() < 0.5) { g.beginPath(); g.arc(R() * w, R() * h, m * (0.1 + R() * 0.25), R() * 6.3, R() * 6.3); g.closePath(); g.fill(); }
        else g.fillRect(R() * w * 0.8, R() * h * 0.8, w * (0.1 + R() * 0.4), h * (0.08 + R() * 0.3));
      }
    }
    g.globalAlpha = 1;
    // canvas grain over everything
    for (let k = 0; k < (w * h) / 40; k++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'; g.fillRect(R() * w, R() * h, 1.5, 1.5); }
  }

  function jaali(g, s) {
    g.clearRect(0, 0, s, s);
    g.fillStyle = '#3b2f28';
    g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'destination-out';
    const n = 2, c = s / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const cx = c * (i + 0.5), cy = c * (j + 0.5), r = c * 0.36;
        // eight-point star: two overlapping squares
        for (let k = 0; k < 2; k++) {
          g.save();
          g.translate(cx, cy);
          g.rotate((k * Math.PI) / 4);
          g.fillRect(-r * 0.78, -r * 0.78, r * 1.56, r * 1.56);
          g.restore();
        }
      }
    // small diamonds at the corners of each cell
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n; j++) {
        g.save();
        g.translate(i * c, j * c);
        g.rotate(Math.PI / 4);
        g.fillRect(-c * 0.11, -c * 0.11, c * 0.22, c * 0.22);
        g.restore();
      }
    g.globalCompositeOperation = 'source-over';
  }

  A.texKit = { tex, marble, wood, rug, art, painting, rng };

  A.buildMaterials = function () {
    const M = {}, S = {}; // S = feet per texture repeat, used for world-scale UVs
    const std = (o) => new T.MeshStandardMaterial(o);

    const tMarble = tex(1024, (g, s, R) => marble(g, s, R, '#e9e2d5', '140,122,98', 2, 1), 11);
    const tBath = tex(512, (g, s, R) => marble(g, s, R, '#cfc8bb', '120,112,100', 2, 2), 12);
    const tBathW = tex(512, (g, s, R) => marble(g, s, R, '#e2dccf', '150,138,120', 1, 2), 13);
    const tWoodF = tex(1024, (g, s, R) => wood(g, s, R, 30, 36, 50, 128, 0.5, 9), 21);
    const tDeck = tex(512, (g, s, R) => wood(g, s, R, 28, 16, 42, 64, 0.8, 8), 22);
    const tTeak = tex(512, (g, s, R) => wood(g, s, R, 26, 44, 36, 512, 0, 3), 23);
    const tTeakV = tTeak.clone(); tTeakV.rotation = Math.PI / 2; tTeakV.needsUpdate = true;
    const tWalnut = tex(512, (g, s, R) => wood(g, s, R, 24, 30, 20, 512, 0, 3), 24);
    const tStone = tex(1024, (g, s, R) => stoneTile(g, s, R, '#d6a48c', 2, 2), 31);
    const tStoneW = tex(1024, (g, s, R) => stoneTile(g, s, R, '#d9ab93', 1, 3), 32);
    const tClad = tex(1024, cladding, 33);
    const tFlute = tex(512, fluted, 34);
    const tJaali = tex(256, jaali, 1);
    tJaali.anisotropy = 4;

    M.wall = std({ color: 0xf2ede3, roughness: 0.93 });
    // pure white in every style; a faint neutral glow (set with the daylight in lighting.js) keeps it reading white,
    // since a ceiling only gets the warm light bounced up from the floor and would otherwise match the walls
    M.ceiling = std({ color: 0xffffff, roughness: 0.95, emissive: 0xffffff, emissiveIntensity: 0.4 });
    M.marble = std({ map: tMarble, roughness: 0.22, metalness: 0.0, envMapIntensity: 0.55 }); S.marble = 4;
    M.stair = std({ map: tMarble, color: 0xe8dcc8, roughness: 0.3, envMapIntensity: 0.5 }); S.stair = 4;
    M.bathfloor = std({ map: tBath, roughness: 0.45 }); S.bathfloor = 4;
    M.bathwall = std({ map: tBathW, roughness: 0.3, envMapIntensity: 0.5 }); S.bathwall = 4;
    M.woodfloor = std({ map: tWoodF, roughness: 0.5 }); S.woodfloor = 4;
    M.deck = std({ map: tDeck, roughness: 0.8 }); S.deck = 3;
    M.stonefloor = std({ map: tStone, roughness: 0.85 }); S.stonefloor = 4;
    M.stone = std({ map: tStoneW, roughness: 0.9 }); S.stone = 4;
    M.cladding = std({ map: tClad, roughness: 0.92 }); S.cladding = 5;
    M.teak = std({ map: tTeak, roughness: 0.55 }); S.teak = 3;
    M.teakV = std({ map: tTeakV, roughness: 0.55 }); S.teakV = 3;
    M.walnut = std({ map: tWalnut, roughness: 0.5 }); S.walnut = 3;
    // Doors and window frames: one material, coloured by the style (styles.js). No furniture uses it.
    // Furniture woods and stones: the same in every style, and never the colour of the doors.
    M.oak = std({ map: tex(512, (g, s, R) => wood(g, s, R, 36, 10, 60, 512, 0, 3), 25), roughness: 0.5 }); S.oak = 3; // grey-washed oak, well apart from the golden door veneer
    M.ash = std({ map: tex(512, (g, s, R) => wood(g, s, R, 40, 20, 74, 512, 0, 3), 26), roughness: 0.5 }); S.ash = 3;
    M.honey = std({ map: tex(512, (g, s, R) => wood(g, s, R, 30, 46, 46, 512, 0, 3), 27), roughness: 0.46 }); S.honey = 3;
    M.travertine = std({ map: tex(512, (g, s, R) => marble(g, s, R, '#dacfbb', '170,150,122', 1, 3), 28), roughness: 0.55 }); S.travertine = 3;
    // WPC wall panels, charcoal grey: vertical slats about 3" wide with a shadow groove between, faint grain
    const tWpc = tex(256, (g, s, R) => {
      const n = 6, w = s / n;
      for (let i = 0; i < n; i++) {
        const gr = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
        gr.addColorStop(0, '#2a2b2d'); gr.addColorStop(0.12, '#45474a'); gr.addColorStop(0.5, '#4d5054'); gr.addColorStop(0.88, '#404245'); gr.addColorStop(1, '#232426');
        g.fillStyle = gr; g.fillRect(i * w, 0, w, s);
        g.fillStyle = '#151617'; g.fillRect(i * w, 0, Math.max(1, w * 0.05), s);
      }
      for (let k = 0; k < 220; k++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; g.fillRect(R() * s, R() * s, 1, 6 + R() * 30); }
    }, 35);
    M.wpc = std({ map: tWpc, roughness: 0.62 }); S.wpc = 1.5;
    /* Wall finishes from the architect's own textures (prints made in Blender, js/wallpaper-data.js):
       repeating at a true size, mirrored at alternate repeats so no seam shows; a plain colour
       stands in when the print is missing. */
    const printFinish = (key, print, feet, rough, fallback, tiles) => { // tiles: the print already repeats seamlessly (brick bond)
      const PT = window.WALLPAPERS && window.WALLPAPERS[print];
      if (PT) {
        const t = new T.TextureLoader().load(PT.src);
        t.colorSpace = T.SRGBColorSpace;
        t.wrapS = t.wrapT = tiles ? T.RepeatWrapping : T.MirroredRepeatWrapping;
        t.anisotropy = 8;
        M[key] = std({ map: t, roughness: rough });
      } else M[key] = std({ color: fallback, roughness: rough });
      S[key] = feet;
    };
    printFinish('plaster', 'tex-plaster', 2.5, 0.92, 0xd8ccba); // textured beige stone, outer walls
    printFinish('felt', 'tex-felt', 3.0, 1.0, 0xb0727a);         // quilted rose felt panels
    printFinish('terrazzo', 'tex-terrazzo', 2.5, 0.35, 0xe6ebea); // terrazzo, the roof floor
    printFinish('brick', 'tex-brick', 2.75, 0.9, 0xcfc5b6, true); // beige brick slips, porch wall, gate pier and pillar
    printFinish('stairMarble', 'tex-statuario', 4.0, 0.15, 0xf4f4f2); // white statuario, every face of the main stair
    M.stairMarble.envMapIntensity = 0.5;
    // doors and windows (leaves, frames, linings, window frames): the architect's oak veneer, the same in every
    // style; the grain runs up, 5 ft across a repeat and one repeat per storey height, so no door shows a joint across it
    printFinish('joinery', 'tex-veneer', 5.0, 0.48, 0xb98a5c);
    if (M.joinery.map) M.joinery.map.repeat.set(1, 5 / ((A.plan && -A.plan.GF) || 11.42));
    printFinish('curtainFab', 'tex-curtain', 3.0, 0.95, 0xd9d3cb); // the architect's curtain fabric, every curtain in the house
    // the gate pier's name plate: polished dark stone, brass lettering (the same in every style)
    M.plaque = std({ color: 0x23201d, roughness: 0.22, metalness: 0.1, envMapIntensity: 0.9 });
    M.gilt = std({ color: 0xc9a45c, roughness: 0.28, metalness: 1.0 });
    M.compassRed = std({ color: 0x9a3a2b, roughness: 0.4 }); // the north point of the compass rose
    M.marbleW = std({ map: tex(512, (g, s, R) => marble(g, s, R, '#f1efeb', '118,116,114', 2, 2), 29), roughness: 0.16, envMapIntensity: 0.6 }); S.marbleW = 3;
    M.fluted = std({ map: tFlute, roughness: 0.6 }); S.fluted = 2.2;
    M.frame = std({ color: 0x2f2a27, roughness: 0.45, metalness: 0.6 });
    M.metal = std({ color: 0x3a302a, roughness: 0.5, metalness: 0.7 });
    M.brass = std({ color: 0xc9a25a, roughness: 0.28, metalness: 1.0 });
    M.chrome = std({ color: 0xdadada, roughness: 0.12, metalness: 1.0 });
    M.glass = new T.MeshStandardMaterial({ color: 0xcfe3e6, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.2 });
    M.railglass = new T.MeshStandardMaterial({ color: 0xbfe0dc, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.2, depthWrite: false, side: T.DoubleSide, envMapIntensity: 1.3 });
    M.frost = std({ color: 0xdfe9ea, roughness: 0.6, emissive: 0x9fb4b8, emissiveIntensity: 0.5 });
    // one mirror material per room: each gets its own reflection of that room (see main.js)
    for (const k of ['mirror', 'mirror2', 'mirror3', 'mirror4', 'mirror5']) M[k] = std({ color: 0xe6ecee, roughness: 0.04, metalness: 1.0, envMapIntensity: 1.0 });
    M.jaali = std({ map: tJaali, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.5, metalness: 0.6 });
    M.white = std({ color: 0xf6f4ef, roughness: 0.35 });
    M.ceramic = std({ color: 0xfbfbf8, roughness: 0.12, envMapIntensity: 0.9 });
    M.quartz = std({ color: 0xf1eee8, roughness: 0.2, envMapIntensity: 0.7 });
    M.sage = std({ color: 0x8c9a84, roughness: 0.6 });
    M.black = std({ color: 0x141414, roughness: 0.35, metalness: 0.3 });
    M.screen = std({ color: 0x07090c, roughness: 0.08, metalness: 0.4, envMapIntensity: 1.0 });
    M.steel = std({ color: 0xb9bcbf, roughness: 0.3, metalness: 0.9 });
    M.car = std({ color: 0x8a9096, roughness: 0.32, metalness: 0.65, envMapIntensity: 0.9 });
    // fabrics
    M.fabIvory = std({ color: 0xe7dfd0, roughness: 0.97 });
    M.fabSand = std({ color: 0xc9b79c, roughness: 0.97 });
    M.fabTerra = std({ color: 0xb8674a, roughness: 0.97 });
    M.fabMustard = std({ color: 0xc99a3c, roughness: 0.97 });
    M.fabTeal = std({ color: 0x3f6f73, roughness: 0.97 });
    M.fabGrey = std({ color: 0x8c8a85, roughness: 0.97 });
    M.fabWhite = std({ color: 0xf5f2ec, roughness: 0.97 });
    M.sheer = new T.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 1, transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false });
    M.leaf = std({ color: 0x4f7a45, roughness: 0.8, flatShading: true });
    M.leaf2 = std({ color: 0x6b9156, roughness: 0.8, flatShading: true });
    M.leafFine = std({ color: 0x4a7a40, roughness: 0.55, side: T.DoubleSide });
    M.leafFine2 = std({ color: 0x5f8f4c, roughness: 0.6, side: T.DoubleSide });
    M.soil = std({ color: 0x3a2c22, roughness: 1 });
    M.pot = std({ color: 0xb5694d, roughness: 0.85 });
    M.potWhite = std({ color: 0xe9e4da, roughness: 0.7 });
    M.glow = std({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 2.2, roughness: 0.6 });
    M.glowSoft = std({ color: 0xfff1d6, emissive: 0xffd39a, emissiveIntensity: 0.9, roughness: 0.8 });
    // recessed ceiling downlights: warm white, kept below glare so they read apart from the pure white ceiling
    M.downlight = std({ color: 0xffe2b8, emissive: 0xffc27a, emissiveIntensity: 1.0, roughness: 0.5 });
    // context
    M.ground = std({ color: 0xa7a38f, roughness: 1 });
    M.road = std({ color: 0x4a4a4c, roughness: 1 });
    M.grass = std({ color: 0x7c9462, roughness: 1 });
    M.trunk = std({ color: 0x6a4e37, roughness: 1 });
    M.nb1 = std({ color: 0xe6d9c6, roughness: 0.95 });
    M.nb2 = std({ color: 0xd9b8a3, roughness: 0.95 });
    M.nb3 = std({ color: 0xcfd6d2, roughness: 0.95 });
    M.nbwin = std({ color: 0x38454d, roughness: 0.2, metalness: 0.3 });

    const rugTex = (bg, fg, ac, seed) => { const t = tex(512, (g, s, R) => rug(g, s, R, bg, fg, ac), seed); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; return t; };
    M.rugLiving = std({ map: rugTex('#b46a4c', '#f0e4cf', '#e3b65c', 41), roughness: 1 });
    M.rugLounge = std({ map: rugTex('#c7a04a', '#f3ead8', '#7a4a33', 42), roughness: 1 });
    M.rugBed = std({ map: rugTex('#6f8587', '#efe8da', '#d9c08a', 43), roughness: 1 });
    M.rugGF = std({ map: rugTex('#8b8478', '#e9e1d2', '#c7a877', 44), roughness: 1 });
    const artTex = (pal, seed) => { const t = tex(512, (g, s, R) => art(g, s, R, pal), seed); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; return t; };
    M.art1 = std({ map: artTex(['#efe6d6', '#b8674a', '#c99a3c', '#3f6f73', '#2e2a28'], 51), roughness: 0.9 });
    M.art2 = std({ map: artTex(['#e9dfd0', '#3f6f73', '#d6a48c', '#c99a3c'], 52), roughness: 0.9 });
    M.art3 = std({ map: artTex(['#f1e9db', '#b8674a', '#8c9a84', '#2e2a28'], 53), roughness: 0.9 });
    M.art4 = std({ map: artTex(['#d9c9b0', '#7a4a33', '#3f6f73', '#f3ead8'], 54), roughness: 0.9 });

    // A fine woven texture on every fabric, so cushions, bedding and curtains read as cloth up close.
    const weave = (() => {
      const s = 256, c = document.createElement('canvas');
      c.width = c.height = s;
      const g = c.getContext('2d'), img = g.createImageData(s, s), R = rng(77);
      const cells = 32, hgt = new Float32Array(s * s);
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const fx = (x * cells) / s, fy = (y * cells) / s, ix = Math.floor(fx), iy = Math.floor(fy);
        const warp = (ix + iy) % 2 === 0;           // over-under weave
        const u = fx - ix, v = fy - iy;
        hgt[y * s + x] = (warp ? Math.sin(Math.PI * u) * (0.7 + 0.3 * Math.sin(Math.PI * v)) : Math.sin(Math.PI * v) * (0.7 + 0.3 * Math.sin(Math.PI * u))) + (R() - 0.5) * 0.25;
      }
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const hx = hgt[y * s + ((x + 1) % s)] - hgt[y * s + ((x - 1 + s) % s)], hy = hgt[((y + 1) % s) * s + x] - hgt[((y - 1 + s) % s) * s + x];
        const nx = -hx * 0.9, ny = -hy * 0.9, nz = 1, l = Math.hypot(nx, ny, nz), o = (y * s + x) * 4;
        img.data[o] = ((nx / l) * 0.5 + 0.5) * 255; img.data[o + 1] = ((ny / l) * 0.5 + 0.5) * 255; img.data[o + 2] = ((nz / l) * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const t = new T.CanvasTexture(c);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(2.5, 2.5);
      t.anisotropy = 8;
      return t;
    })();
    for (const k of ['fabIvory', 'fabSand', 'fabTerra', 'fabMustard', 'fabTeal', 'fabGrey', 'fabWhite']) {
      M[k].normalMap = weave;
      M[k].normalScale.set(0.45, 0.45);
      M[k].roughness = 0.92;
    }

    for (const k in S) M[k].userData.s = S[k];
    A.M = M;
    A.S = S;
    return M;
  };
})();
