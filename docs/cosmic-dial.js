/**
 * Nakshatra Chakram — Formidable Metallic Cosmic Dial Renderer & Interactive Observatory
 *
 * Features:
 *   - Obsidian Forge (Dark) & Daylight Brass/Ivory (Light) forged-metal canvas palettes
 *   - All 108 Nakshatra Padas, 27 Nakshatras (Devanagari + English), 12 elemental metallic Rasis
 *   - Counter-rotating machined involute gears + drifting ambient starlight dust
 *   - True rendered Lunar Phase (Purnima/Amavasya), Vedic Panchanga (Tithi/Vara) & Eclipse Corona
 *   - Live Vimshottari Mahadasha / Antardasha / Pratyantardasha + sovereign planetary halos
 *   - Lifespan Epoch bands (Sade Sati, Ashtama Shani, Saturn Return, Jupiter Return)
 *   - 3-Way Drishti Optical Lens (Convergences / All Vedic Rays / Natal Degree Resonance)
 *   - Zero-obstruction Docked Hover Telemetry + Click-to-Pin Lore Card + Grab-and-Spin Dial Cranking
 *   - Bidirectional Lifespan Time Travel (Birth Date <-> Today <-> Future) + Fullscreen Zen Mode
 */
(function () {
  "use strict";

  const JE = window.JyotishEngine;
  const Audio = window.CosmicAudio;
  if (!JE) return;

  const DEG = Math.PI / 180;
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  // ---------------------------------------------------------------------------
  // Dual Horological Canvas Palettes (Obsidian Forge vs. Solar Ivory & Brass)
  // ---------------------------------------------------------------------------

  const THEMES = {
    dark: {
      isLight: false,
      gear1: ["#3a2c16", "#8c682b", "#4a3514"],
      gear1Stroke: "rgba(240,206,132,0.28)",
      gear2Fill: "rgba(38,44,58,0.85)",
      gear2Stroke: "rgba(160,175,205,0.16)",
      bezelStops: ["#2b3040", "#151923", "#0c0e15", "#262018"],
      brassStops: ["#e5c173", "#8f692c", "#f2d692", "#66481a", "#cfa355"],
      rivetStops: ["#f3d796", "#8c6628", "#2a1e0c"],
      tickMajor: "rgba(235,198,118,0.85)",
      tickFive: "rgba(198,162,92,0.45)",
      tickMinor: "rgba(160,145,115,0.22)",
      padaEven: "#11141e",
      padaOdd: "#151926",
      padaRasiLine: "rgba(232, 190, 108, 0.72)",
      padaNakLine: "rgba(196, 158, 92, 0.42)",
      padaLine: "rgba(130, 145, 175, 0.19)",
      padaNum: "rgba(182,175,160,0.68)",
      padaNumGan: "rgba(255,152,102,0.88)",
      gandantaFill: "rgba(255, 86, 36, 0.14)",
      gandantaLine: "rgba(255, 108, 56, 0.85)",
      nakStroke: "rgba(202, 168, 98, 0.26)",
      nakDev: "rgba(232, 214, 178, 0.84)",
      nakEng: "rgba(218, 178, 102, 0.94)",
      trackStops: ["#070910", "#0d111b", "#080a12"],
      trackGroove: "rgba(180, 160, 120, 0.09)",
      trackSpoke: "rgba(208, 170, 96, 0.16)",
      rasiName: "rgba(235,214,172,0.90)",
      bhavaTop: "#ffd43b",
      bhavaOther: "rgba(218,184,114,0.65)",
      natalStops: ["#0b0d14", "#121622", "#090b12"],
      natalSpoke: "rgba(212,172,96,0.14)",
      natalPinBg: "#1c1710",
      natalLagnaBg: "#112824",
      natalPinRim: "#e3ba64",
      coreStops: ["#141928", "#080a12", "#04050a"],
      coreGear1Fill: "rgba(184, 142, 66, 0.09)",
      coreGear1Stroke: "rgba(220, 180, 102, 0.14)",
      coreGear2Fill: "rgba(120, 145, 190, 0.07)",
      coreGear2Stroke: "rgba(165, 190, 230, 0.10)",
      hubScrim0: "rgba(6, 8, 14, 0.88)",
      hubScrim1: "rgba(6, 8, 14, 0.70)",
      hubScrim2: "rgba(6, 8, 14, 0.0)",
      hubCrest: "rgba(218, 178, 102, 0.82)",
      hubDate: "#f5ecd8",
      hubDoy: "#e6b85c",
      hubSun: "rgba(235, 224, 200, 0.86)",
      hubSub: "rgba(165, 178, 202, 0.76)",
      yearArc: "#e6b85c",
      yearArcTriple: "#ff7849",
      orbDark: "#181512",
      orbGlyph: "#08090f",
      orbRim: "rgba(255,244,218,0.68)",
      dustColor: "238, 206, 138",
      rulerMetal: {
        Ketu:    { fill: "#1b1126", rim: "#7d4ea8" },
        Venus:   { fill: "#211221", rim: "#b55284" },
        Sun:     { fill: "#26180c", rim: "#cc8632" },
        Moon:    { fill: "#161c28", rim: "#8599b8" },
        Mars:    { fill: "#281110", rim: "#c44b3b" },
        Rahu:    { fill: "#121329", rim: "#6c63c9" },
        Jupiter: { fill: "#221d0c", rim: "#cca635" },
        Saturn:  { fill: "#101824", rim: "#5b79a3" },
        Mercury: { fill: "#0e1f1a", rim: "#3d9c7e" },
      },
      elemAlloy: [
        { top: "#2c1412", bot: "#170908", rim: "#a64d36", text: "#f2b89b" }, // Agni
        { top: "#12241b", bot: "#09140e", rim: "#4b8a66", text: "#a8e0be" }, // Prithvi
        { top: "#262112", bot: "#141109", rim: "#a88c42", text: "#f0da9c" }, // Vayu
        { top: "#101d30", bot: "#08101c", rim: "#4975a8", text: "#a9ccf2" }, // Jala
      ],
    },
    light: {
      isLight: true,
      gear1: ["#7d5e2b", "#c8a156", "#6b4d1e"],
      gear1Stroke: "rgba(92,64,22,0.45)",
      gear2Fill: "rgba(116,104,88,0.68)",
      gear2Stroke: "rgba(74,62,48,0.28)",
      bezelStops: ["#d8c6a3", "#b89c68", "#8d703d", "#b5965e"],
      brassStops: ["#7d5a20", "#caa256", "#634414", "#e3c47e", "#7a561e"],
      rivetStops: ["#fff2cc", "#a67c32", "#473210"],
      tickMajor: "rgba(66,46,16,0.92)",
      tickFive: "rgba(88,64,26,0.58)",
      tickMinor: "rgba(102,80,44,0.32)",
      padaEven: "#f7f1e3",
      padaOdd: "#ede4cf",
      padaRasiLine: "rgba(130, 88, 22, 0.85)",
      padaNakLine: "rgba(142, 102, 40, 0.52)",
      padaLine: "rgba(130, 112, 82, 0.28)",
      padaNum: "rgba(62,48,28,0.82)",
      padaNumGan: "rgba(186,46,16,0.96)",
      gandantaFill: "rgba(218, 62, 24, 0.16)",
      gandantaLine: "rgba(202, 52, 18, 0.92)",
      nakStroke: "rgba(138, 102, 42, 0.36)",
      nakDev: "#2d2214",
      nakEng: "#6d4b12",
      trackStops: ["#dfd5c2", "#ece4d4", "#d6cab4"],
      trackGroove: "rgba(112, 88, 48, 0.15)",
      trackSpoke: "rgba(128, 92, 34, 0.25)",
      rasiName: "#2a2013",
      bhavaTop: "#a34600",
      bhavaOther: "rgba(86,62,24,0.78)",
      natalStops: ["#e8decb", "#f3ecdc", "#ddd2bd"],
      natalSpoke: "rgba(128,94,38,0.22)",
      natalPinBg: "#2a2117",
      natalLagnaBg: "#12423a",
      natalPinRim: "#b5852c",
      coreStops: ["#fdfaf2", "#f3ead6", "#e4d7bc"],
      coreGear1Fill: "rgba(146, 108, 42, 0.11)",
      coreGear1Stroke: "rgba(132, 94, 34, 0.22)",
      coreGear2Fill: "rgba(106, 98, 86, 0.08)",
      coreGear2Stroke: "rgba(102, 92, 76, 0.18)",
      hubScrim0: "rgba(251, 247, 238, 0.90)",
      hubScrim1: "rgba(246, 239, 224, 0.72)",
      hubScrim2: "rgba(246, 239, 224, 0.0)",
      hubCrest: "#875c16",
      hubDate: "#1c160e",
      hubDoy: "#9e5c0a",
      hubSun: "#33281a",
      hubSub: "#5e5344",
      yearArc: "#b57a1c",
      yearArcTriple: "#c93818",
      orbDark: "#241e16",
      orbGlyph: "#0b0907",
      orbRim: "rgba(44,32,16,0.75)",
      dustColor: "145, 106, 44",
      rulerMetal: {
        Ketu:    { fill: "#ebe3f0", rim: "#7c4da6" },
        Venus:   { fill: "#f2e3ea", rim: "#a84476" },
        Sun:     { fill: "#f5ead6", rim: "#bf741b" },
        Moon:    { fill: "#e4ebf4", rim: "#5675a6" },
        Mars:    { fill: "#f4e1de", rim: "#b53e2d" },
        Rahu:    { fill: "#e5e6f4", rim: "#5a51b8" },
        Jupiter: { fill: "#f4eed6", rim: "#ad861a" },
        Saturn:  { fill: "#e2e8f0", rim: "#466894" },
        Mercury: { fill: "#e0efe8", rim: "#2a8567" },
      },
      elemAlloy: [
        { top: "#edd5cb", bot: "#e2bfb2", rim: "#9c3e26", text: "#702412" }, // Agni
        { top: "#d4e6da", bot: "#bfd8c8", rim: "#2f734d", text: "#1a4d32" }, // Prithvi
        { top: "#f0e5c2", bot: "#e3d3a2", rim: "#8f6e18", text: "#5c4408" }, // Vayu
        { top: "#d0dfef", bot: "#bad0e8", rim: "#2d5d94", text: "#163b66" }, // Jala
      ],
    },
  };

  // Speed presets (simulated days per real-world second)
  const SPEED_MAP = {
    day:   { daysPerSec: 1.0,  label: "1 DAY / SEC" },
    week:  { daysPerSec: 7.0,  label: "1 WEEK / SEC" },
    month: { daysPerSec: 30.0, label: "1 MONTH / SEC" },
  };

  // Deterministic ambient cosmic dust motes orbiting outside the bezel
  const DUST_MOTES = Array.from({ length: 42 }, (_, i) => ({
    angle: (i * 137.508) % 360,
    radFrac: 1.035 + ((i * 37) % 100) / 1450,
    size: 0.7 + ((i * 19) % 10) * 0.14,
    speed: (i % 2 === 0 ? 1 : -1) * (0.002 + ((i * 11) % 7) * 0.0007),
    phase: i * 0.7,
  }));

  // ---------------------------------------------------------------------------
  // Application State
  // ---------------------------------------------------------------------------

  const state = {
    theme: "dark",             // "dark" | "light"
    zen: false,
    lens: "convergences",      // "convergences" | "all" | "resonance"
    ayanamsa: "lahiri",        // "lahiri" | "raman"
    speed: "week",             // "day" | "week" | "month"
    playing: true,
    direction: 1,              // 1 forward, -1 reverse
    simJD: JE.dateToJD(new Date()),
    lastCheckedDay: Math.floor(JE.dateToJD(new Date())),
    birthInput: null,          // { date, time, city, lat, lon, tz }
    natalJD: null,             // exact birth JD when locked
    natal: null,               // computeSiderealSnapshot result
    transit: null,             // current computeSiderealSnapshot result
    dasha: null,               // computeVimshottariDasha result
    panchanga: null,           // computePanchanga result
    epochs: [],                // lifespan epoch bands
    tripleWindows: [],         // clickable D1..D60 Triple Transit markers on timeline
    hoveredMarker: null,       // hovered ▼ Triple Transit marker object
    activeEpoch: { badges: [], sadeSatiPhase: null, sadeSatiRasis: [] },
    analysis: { triples: [], doubles: [], padaHits: [] },
    activeEventKeys: new Set(),
    eventLog: [],
    shockwaves: [],
    trails: {},
    hovered: null,             // { type, data, telemetryHtml, loreHtml }
    pinned: null,              // pinned lore object (on click)
    zenithDeg: 15,
    targetZenithDeg: 15,
    gearAngle: 0,
    lastFrameMs: performance.now(),
    lastUiUpdateMs: 0,
  };

  let staticCanvas = null;
  let staticCacheKey = "";
  let canvas = null;
  let ctx = null;
  let canvasSize = 680;
  let dpr = 1;

  // Grab-and-Spin cranking state
  const crank = {
    active: false,
    moved: false,
    wasPlaying: false,
    startX: 0,
    startY: 0,
    lastAngle: 0,
    accumDeg: 0,
  };

  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------------------
  // Geometry Helpers
  // ---------------------------------------------------------------------------

  function dToRad(deg) {
    return -(deg - state.zenithDeg) * DEG - Math.PI / 2;
  }

  function polar(cx, cy, r, deg) {
    const a = dToRad(deg);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), a };
  }

  function screenToSiderealDeg(cx, cy, mx, my) {
    const dx = mx - cx;
    const dy = my - cy;
    const dist = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const deg = JE.norm360(state.zenithDeg - (a + Math.PI / 2) / DEG);
    return { deg, dist, a };
  }

  function drawWedge(c, cx, cy, r1, r2, sDeg, eDeg) {
    const a1 = dToRad(sDeg);
    const a2 = dToRad(eDeg);
    c.beginPath();
    c.arc(cx, cy, r2, a1, a2, true);
    c.arc(cx, cy, r1, a2, a1, false);
    c.closePath();
  }

  function drawArcLabel(c, text, cx, cy, r, midDeg, font, fill) {
    const p = polar(cx, cy, r, midDeg);
    let rot = p.a + Math.PI / 2;
    const normA = ((p.a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (normA > 0 && normA < Math.PI) rot += Math.PI;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(rot);
    c.font = font;
    c.fillStyle = fill;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 0, 0);
    c.restore();
  }

  function drawGear(c, cx, cy, outerR, innerR, teeth, toothDepth, angleRad, fillStyle, strokeStyle) {
    const step = (Math.PI * 2) / teeth;
    c.save();
    c.translate(cx, cy);
    c.rotate(angleRad);
    c.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = i * step;
      const a1 = a0 + step * 0.22;
      const a2 = a0 + step * 0.34;
      const a3 = a0 + step * 0.66;
      const a4 = a0 + step * 0.78;
      const rBase = outerR - toothDepth;
      if (i === 0) c.moveTo(Math.cos(a0) * rBase, Math.sin(a0) * rBase);
      else c.lineTo(Math.cos(a0) * rBase, Math.sin(a0) * rBase);
      c.lineTo(Math.cos(a1) * rBase, Math.sin(a1) * rBase);
      c.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
      c.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
      c.lineTo(Math.cos(a4) * rBase, Math.sin(a4) * rBase);
    }
    c.closePath();
    if (innerR > 0) {
      c.moveTo(innerR, 0);
      c.arc(0, 0, innerR, 0, Math.PI * 2, true);
    }
    c.fillStyle = fillStyle;
    c.fill("evenodd");
    if (strokeStyle) {
      c.strokeStyle = strokeStyle;
      c.lineWidth = 1;
      c.stroke();
    }
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Offscreen Forged Metallic Static Dial Builder (Theme-Aware)
  // ---------------------------------------------------------------------------

  function ensureStaticLayer(size, pixelRatio) {
    const T = THEMES[state.theme] || THEMES.dark;
    const zKey = state.zenithDeg.toFixed(2);
    const natKey = state.natal ? `${state.natal.details.Lagna ? state.natal.details.Lagna.rasiIdx : -1}` : "sky";
    const key = `${state.theme}:${size}:${pixelRatio}:${zKey}:${natKey}:${state.ayanamsa}`;
    if (staticCanvas && staticCacheKey === key) return staticCanvas;

    if (!staticCanvas) staticCanvas = document.createElement("canvas");
    staticCanvas.width = Math.round(size * pixelRatio);
    staticCanvas.height = Math.round(size * pixelRatio);
    const sc = staticCanvas.getContext("2d");
    sc.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.468;

    // 1. Heavy Gunmetal / Antique Brass Outer Bezel
    const rimGrad = sc.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.65, cx, cy, R * 1.01);
    rimGrad.addColorStop(0, T.bezelStops[0]);
    rimGrad.addColorStop(0.55, T.bezelStops[1]);
    rimGrad.addColorStop(0.88, T.bezelStops[2]);
    rimGrad.addColorStop(1, T.bezelStops[3]);
    sc.beginPath();
    sc.arc(cx, cy, R, 0, Math.PI * 2);
    sc.fillStyle = rimGrad;
    sc.fill();

    const brassRing = sc.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    brassRing.addColorStop(0, T.brassStops[0]);
    brassRing.addColorStop(0.28, T.brassStops[1]);
    brassRing.addColorStop(0.52, T.brassStops[2]);
    brassRing.addColorStop(0.76, T.brassStops[3]);
    brassRing.addColorStop(1, T.brassStops[4]);
    sc.beginPath();
    sc.arc(cx, cy, R - 1.5, 0, Math.PI * 2);
    sc.strokeStyle = brassRing;
    sc.lineWidth = 3;
    sc.stroke();

    // 36 Rivets + 360 Vernier Ticks
    for (let deg = 0; deg < 360; deg++) {
      const isMajor = deg % 30 === 0;
      const isTen = deg % 10 === 0;
      const isFive = deg % 5 === 0;
      const tLen = isMajor ? 8 : (isFive ? 5 : 2.5);
      const p1 = polar(cx, cy, R * 0.944, deg);
      const p2 = polar(cx, cy, R * 0.944 + tLen, deg);
      sc.beginPath();
      sc.moveTo(p1.x, p1.y);
      sc.lineTo(p2.x, p2.y);
      sc.strokeStyle = isMajor ? T.tickMajor : (isFive ? T.tickFive : T.tickMinor);
      sc.lineWidth = isMajor ? 1.5 : 0.8;
      sc.stroke();

      if (isTen) {
        const rv = polar(cx, cy, R * 0.976, deg + 5);
        const rg = sc.createRadialGradient(rv.x - 1, rv.y - 1, 0.4, rv.x, rv.y, 2.8);
        rg.addColorStop(0, T.rivetStops[0]);
        rg.addColorStop(0.55, T.rivetStops[1]);
        rg.addColorStop(1, T.rivetStops[2]);
        sc.beginPath();
        sc.arc(rv.x, rv.y, 2.4, 0, Math.PI * 2);
        sc.fillStyle = rg;
        sc.fill();
      }
    }

    // 2. Ring 1: All 108 Nakshatra Padas
    const rPadaIn = R * 0.842;
    const rPadaOut = R * 0.940;
    const padaFont = `600 ${Math.max(6.5, size * 0.0112).toFixed(1)}px "JetBrains Mono", monospace`;

    for (let i = 0; i < 108; i++) {
      const p = JE.PADAS[i];
      const rm = T.rulerMetal[p.nak.ruler];
      drawWedge(sc, cx, cy, rPadaIn, rPadaOut, p.startDeg, p.endDeg);
      sc.fillStyle = (i % 2 === 0) ? T.padaEven : T.padaOdd;
      sc.fill();

      drawWedge(sc, cx, cy, rPadaOut - R * 0.014, rPadaOut, p.startDeg, p.endDeg);
      sc.fillStyle = rm.rim + (T.isLight ? "66" : "44");
      sc.fill();

      if (p.isGandanta) {
        drawWedge(sc, cx, cy, rPadaIn, rPadaOut, p.startDeg, p.endDeg);
        sc.fillStyle = T.gandantaFill;
        sc.fill();
      }

      const lineStart = polar(cx, cy, rPadaIn, p.startDeg);
      const lineEnd = polar(cx, cy, rPadaOut, p.startDeg);
      const isNakBoundary = (i % 4 === 0);
      const isRasiBoundary = (i % 9 === 0);
      sc.beginPath();
      sc.moveTo(lineStart.x, lineStart.y);
      sc.lineTo(lineEnd.x, lineEnd.y);
      sc.strokeStyle = isRasiBoundary ? T.padaRasiLine : (isNakBoundary ? T.padaNakLine : T.padaLine);
      sc.lineWidth = isRasiBoundary ? 1.4 : (isNakBoundary ? 0.95 : 0.55);
      sc.stroke();

      drawArcLabel(sc, String(p.padaNum), cx, cy, (rPadaIn + rPadaOut) * 0.494, p.midDeg, padaFont, p.isGandanta ? T.padaNumGan : T.padaNum);
    }

    sc.beginPath();
    sc.arc(cx, cy, rPadaOut, 0, Math.PI * 2);
    sc.strokeStyle = brassRing;
    sc.lineWidth = 1.4;
    sc.stroke();

    // 3. Ring 2: 27 Nakshatras
    const rNakIn = R * 0.718;
    const rNakOut = rPadaIn;
    const nakEngFont = `700 ${Math.max(7.2, size * 0.0122).toFixed(1)}px "Cinzel", serif`;
    const nakDevFont = `500 ${Math.max(6.8, size * 0.0112).toFixed(1)}px "Noto Sans Devanagari", sans-serif`;

    for (let i = 0; i < 27; i++) {
      const nak = JE.NAKSHATRAS[i];
      const sDeg = i * (360 / 27);
      const eDeg = (i + 1) * (360 / 27);
      const mid = (sDeg + eDeg) / 2;
      const rm = T.rulerMetal[nak.ruler];

      drawWedge(sc, cx, cy, rNakIn, rNakOut, sDeg, eDeg);
      sc.fillStyle = rm.fill;
      sc.fill();
      sc.strokeStyle = T.nakStroke;
      sc.lineWidth = 0.85;
      sc.stroke();

      drawArcLabel(sc, nak.dev, cx, cy, rNakIn + (rNakOut - rNakIn) * 0.68, mid, nakDevFont, T.nakDev);
      drawArcLabel(sc, nak.short.toUpperCase(), cx, cy, rNakIn + (rNakOut - rNakIn) * 0.31, mid, nakEngFont, T.nakEng);
    }

    for (const gDeg of [0, 120, 240]) {
      const a = polar(cx, cy, rNakIn, gDeg);
      const b = polar(cx, cy, rPadaOut, gDeg);
      sc.beginPath();
      sc.moveTo(a.x, a.y);
      sc.lineTo(b.x, b.y);
      sc.strokeStyle = T.gandantaLine;
      sc.lineWidth = 1.8;
      sc.stroke();
    }

    sc.beginPath();
    sc.arc(cx, cy, rNakIn, 0, Math.PI * 2);
    sc.strokeStyle = brassRing;
    sc.lineWidth = 2.0;
    sc.stroke();

    // 4. Ring 3: Recessed Orbital Channel for Transiting Navagrahas
    const rTransIn = R * 0.562;
    const rTransOut = rNakIn;
    const trackGrad = sc.createRadialGradient(cx, cy, rTransIn, cx, cy, rTransOut);
    trackGrad.addColorStop(0, T.trackStops[0]);
    trackGrad.addColorStop(0.5, T.trackStops[1]);
    trackGrad.addColorStop(1, T.trackStops[2]);
    sc.beginPath();
    sc.arc(cx, cy, rTransOut, 0, Math.PI * 2);
    sc.arc(cx, cy, rTransIn, 0, Math.PI * 2, true);
    sc.fillStyle = trackGrad;
    sc.fill("evenodd");

    for (const frac of [0.60, 0.64, 0.68]) {
      sc.beginPath();
      sc.arc(cx, cy, R * frac, 0, Math.PI * 2);
      sc.strokeStyle = T.trackGroove;
      sc.lineWidth = 0.8;
      sc.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const p1 = polar(cx, cy, rTransIn, i * 30);
      const p2 = polar(cx, cy, rTransOut, i * 30);
      sc.beginPath();
      sc.moveTo(p1.x, p1.y);
      sc.lineTo(p2.x, p2.y);
      sc.strokeStyle = T.trackSpoke;
      sc.lineWidth = 0.9;
      sc.stroke();
    }

    // 5. Ring 4: The 12 Rasis (Elemental Metallic / Mineral Enamel Plates)
    const rRasiIn = R * 0.422;
    const rRasiOut = rTransIn;
    const rasiNameFont = `700 ${Math.max(7.2, size * 0.012).toFixed(1)}px "Cinzel", serif`;
    const rasiDevFont = `600 ${Math.max(7, size * 0.0115).toFixed(1)}px "Noto Sans Devanagari", sans-serif`;
    const bhavaFont = `700 ${Math.max(7, size * 0.011).toFixed(1)}px "Cinzel", serif`;
    const lagnaIdx = (state.natal && state.natal.details.Lagna) ? state.natal.details.Lagna.rasiIdx : null;

    for (let i = 0; i < 12; i++) {
      const rasi = JE.RASIS[i];
      const ea = T.elemAlloy[rasi.elIdx];
      const sDeg = i * 30;
      const eDeg = sDeg + 30;
      const mid = sDeg + 15;

      drawWedge(sc, cx, cy, rRasiIn, rRasiOut, sDeg, eDeg);
      const rg = sc.createRadialGradient(cx, cy, rRasiIn, cx, cy, rRasiOut);
      rg.addColorStop(0, ea.bot);
      rg.addColorStop(1, ea.top);
      sc.fillStyle = rg;
      sc.fill();
      sc.strokeStyle = ea.rim + (T.isLight ? "bb" : "99");
      sc.lineWidth = 1.25;
      sc.stroke();

      drawWedge(sc, cx, cy, rRasiOut - R * 0.012, rRasiOut, sDeg, eDeg);
      sc.fillStyle = ea.rim + "44";
      sc.fill();

      drawArcLabel(sc, `${rasi.glyph} ${rasi.dev}`, cx, cy, rRasiIn + (rRasiOut - rRasiIn) * 0.67, mid, rasiDevFont, ea.text);
      drawArcLabel(sc, rasi.sanskrit.toUpperCase(), cx, cy, rRasiIn + (rRasiOut - rRasiIn) * 0.34, mid, rasiNameFont, T.rasiName);

      if (lagnaIdx !== null) {
        const bhavaNum = ((i - lagnaIdx) % 12 + 12) % 12;
        const bp = polar(cx, cy, rRasiIn + R * 0.022, sDeg + 5.5);
        sc.font = bhavaFont;
        sc.fillStyle = bhavaNum === 0 ? T.bhavaTop : T.bhavaOther;
        sc.textAlign = "center";
        sc.textBaseline = "middle";
        sc.fillText(ROMAN[bhavaNum], bp.x, bp.y);
      }
    }

    sc.beginPath();
    sc.arc(cx, cy, rRasiOut, 0, Math.PI * 2);
    sc.strokeStyle = brassRing;
    sc.lineWidth = 2.0;
    sc.stroke();
    sc.beginPath();
    sc.arc(cx, cy, rRasiIn, 0, Math.PI * 2);
    sc.strokeStyle = brassRing;
    sc.lineWidth = 1.5;
    sc.stroke();

    // 6. Ring 5: Recessed Locked Natal Pin Track
    const rNatalIn = R * 0.305;
    const natalGrad = sc.createRadialGradient(cx, cy, rNatalIn, cx, cy, rRasiIn);
    natalGrad.addColorStop(0, T.natalStops[0]);
    natalGrad.addColorStop(0.5, T.natalStops[1]);
    natalGrad.addColorStop(1, T.natalStops[2]);
    sc.beginPath();
    sc.arc(cx, cy, rRasiIn, 0, Math.PI * 2);
    sc.arc(cx, cy, rNatalIn, 0, Math.PI * 2, true);
    sc.fillStyle = natalGrad;
    sc.fill("evenodd");

    for (let i = 0; i < 12; i++) {
      const p1 = polar(cx, cy, rNatalIn, i * 30);
      const p2 = polar(cx, cy, rRasiIn, i * 30);
      sc.beginPath();
      sc.moveTo(p1.x, p1.y);
      sc.lineTo(p2.x, p2.y);
      sc.strokeStyle = T.natalSpoke;
      sc.lineWidth = 0.8;
      sc.stroke();
    }

    sc.beginPath();
    sc.arc(cx, cy, rNatalIn, 0, Math.PI * 2);
    sc.strokeStyle = brassRing;
    sc.lineWidth = 2.2;
    sc.stroke();

    // Subtle diagonal metallic specular sweep across forged disk
    const sheen = sc.createLinearGradient(cx - R, cy - R, cx + R * 0.9, cy + R * 0.9);
    sheen.addColorStop(0, T.isLight ? "rgba(255, 250, 236, 0.22)" : "rgba(255, 240, 200, 0.06)");
    sheen.addColorStop(0.35, "rgba(255, 255, 255, 0.0)");
    sheen.addColorStop(0.55, T.isLight ? "rgba(180, 140, 68, 0.06)" : "rgba(240, 205, 130, 0.045)");
    sheen.addColorStop(0.78, T.isLight ? "rgba(80, 58, 22, 0.06)" : "rgba(0, 0, 0, 0.08)");
    sheen.addColorStop(1, T.isLight ? "rgba(255, 246, 224, 0.14)" : "rgba(255, 224, 160, 0.04)");
    sc.beginPath();
    sc.arc(cx, cy, R, 0, Math.PI * 2);
    sc.fillStyle = sheen;
    sc.fill();

    staticCacheKey = key;
    return staticCanvas;
  }

  // ---------------------------------------------------------------------------
  // 60 FPS Live Frame Renderer
  // ---------------------------------------------------------------------------

  function renderFrame(nowMs) {
    if (!ctx || !state.transit) return;
    const T = THEMES[state.theme] || THEMES.dark;
    const size = canvasSize;
    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.468;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // 0. Subtle drifting cosmic dust motes orbiting outside the bezel
    for (const m of DUST_MOTES) {
      const ang = (m.angle + nowMs * m.speed) * DEG;
      const rr = R * m.radFrac;
      const alpha = (0.18 + 0.22 * Math.sin(nowMs * 0.0014 + m.phase)) * (T.isLight ? 0.65 : 1);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, m.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${T.dustColor}, ${alpha.toFixed(3)})`;
      ctx.fill();
    }

    // 1. Animated Counter-Rotating Machined Gears Peering Behind the Bezel
    const gGrad1 = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.055);
    gGrad1.addColorStop(0, T.gear1[0]);
    gGrad1.addColorStop(0.6, T.gear1[1]);
    gGrad1.addColorStop(1, T.gear1[2]);
    drawGear(ctx, cx, cy, R * 1.045, R * 0.94, 72, R * 0.036, state.gearAngle * 0.4, gGrad1, T.gear1Stroke);
    drawGear(ctx, cx, cy, R * 1.022, R * 0.94, 54, R * 0.025, -state.gearAngle * 0.65, T.gear2Fill, T.gear2Stroke);

    const hasTriple = state.analysis.triples.length > 0;
    const hasDouble = state.analysis.doubles.length > 0;
    const eclipse = state.panchanga ? state.panchanga.eclipse : null;

    // Outer ambient cosmic aura around the heavy chassis
    const aura = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.08);
    aura.addColorStop(0, "rgba(0,0,0,0)");
    aura.addColorStop(
      0.75,
      eclipse ? "rgba(232, 76, 38, 0.16)"
        : (hasTriple ? "rgba(255, 92, 54, 0.14)"
          : (hasDouble ? "rgba(240, 186, 68, 0.11)" : "rgba(120, 145, 200, 0.05)"))
    );
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
    ctx.fillStyle = aura;
    ctx.fill();

    // 2. Blit Cached Forged-Metal Static Dial
    const bg = ensureStaticLayer(size, dpr);
    ctx.drawImage(bg, 0, 0, size, size);

    // 3. Center Chronometer Glass Dome + Internal Rotating Brass Escapement Gears
    const rCore = R * 0.303;
    const coreGrad = ctx.createRadialGradient(cx - rCore * 0.25, cy - rCore * 0.25, rCore * 0.05, cx, cy, rCore);
    coreGrad.addColorStop(0, T.coreStops[0]);
    coreGrad.addColorStop(0.65, T.coreStops[1]);
    coreGrad.addColorStop(1, T.coreStops[2]);
    ctx.beginPath();
    ctx.arc(cx, cy, rCore, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    drawGear(ctx, cx, cy, rCore * 0.92, rCore * 0.72, 36, rCore * 0.075, -state.gearAngle * 1.2, T.coreGear1Fill, T.coreGear1Stroke);
    drawGear(ctx, cx, cy, rCore * 0.64, rCore * 0.46, 24, rCore * 0.065, state.gearAngle * 2.1, T.coreGear2Fill, T.coreGear2Stroke);

    // 4. Illuminate Occupied 108-Pada Cells & Clean Non-Obstructing Hover Highlight
    const rPadaIn = R * 0.842;
    const rPadaOut = R * 0.940;
    const occupiedPadas = new Map();
    for (const p of JE.PLANETS) {
      const pid = state.transit.details[p.id].padaId;
      if (!occupiedPadas.has(pid)) occupiedPadas.set(pid, p.color);
    }
    for (const [pid, col] of occupiedPadas.entries()) {
      const p = JE.PADAS[pid];
      drawWedge(ctx, cx, cy, rPadaIn, rPadaOut, p.startDeg, p.endDeg);
      ctx.fillStyle = col + (T.isLight ? "44" : "38");
      ctx.fill();
      ctx.strokeStyle = col + "cc";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Subtle hairline sector highlight on hover (ZERO floating popup obstruction!)
    if (state.hovered) {
      const h = state.hovered;
      const hiStroke = T.isLight ? "#8f5900" : "#ffe082";
      const hiFill = T.isLight ? "rgba(184, 128, 22, 0.22)" : "rgba(255, 224, 130, 0.22)";
      if (h.type === "pada") {
        drawWedge(ctx, cx, cy, rPadaIn, rPadaOut, h.data.startDeg, h.data.endDeg);
        ctx.fillStyle = hiFill; ctx.fill();
        ctx.strokeStyle = hiStroke; ctx.lineWidth = 1.8; ctx.stroke();
      } else if (h.type === "nak") {
        const sD = h.data.idx * (360 / 27);
        drawWedge(ctx, cx, cy, R * 0.718, rPadaIn, sD, sD + 360 / 27);
        ctx.fillStyle = hiFill; ctx.fill();
        ctx.strokeStyle = hiStroke; ctx.lineWidth = 1.6; ctx.stroke();
      } else if (h.type === "rasi") {
        const sD = h.data.idx * 30;
        drawWedge(ctx, cx, cy, R * 0.422, R * 0.562, sD, sD + 30);
        ctx.fillStyle = hiFill; ctx.fill();
        ctx.strokeStyle = hiStroke; ctx.lineWidth = 1.8; ctx.stroke();
      }
    }

    // 4b. Sade Sati Subtle Lunar-Indigo Shroud on Moon's 12th/1st/2nd Rasis when active
    const pulse = 0.55 + 0.45 * Math.sin(nowMs * 0.0055);
    if (state.activeEpoch && state.activeEpoch.sadeSatiPhase) {
      for (const sr of state.activeEpoch.sadeSatiRasis) {
        drawWedge(ctx, cx, cy, R * 0.422, R * 0.562, sr * 30, sr * 30 + 30);
        ctx.fillStyle = T.isLight
          ? `rgba(74, 88, 176, ${(0.12 + 0.06 * pulse).toFixed(3)})`
          : `rgba(104, 128, 232, ${(0.11 + 0.07 * pulse).toFixed(3)})`;
        ctx.fill();
        ctx.strokeStyle = T.isLight ? "rgba(74, 88, 176, 0.7)" : "rgba(130, 158, 255, 0.58)";
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
    }

    // 5. Drishti Optical Lens Layer (Convergences / All Vedic Rays / Natal Resonance)
    if (state.lens === "all") {
      const rays = JE.computeAllDrishtiRays(state.transit);
      for (const r of rays) {
        const srcPt = polar(cx, cy, R * 0.565, r.fromDeg);
        const tgtPt = polar(cx, cy, R * 0.422, r.toDeg);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(srcPt.x, srcPt.y);
        ctx.quadraticCurveTo(cx, cy, tgtPt.x, tgtPt.y);
        ctx.strokeStyle = r.color + (T.isLight ? "88" : "58");
        ctx.lineWidth = 1.15;
        ctx.stroke();
        ctx.restore();
      }
    }

    if (state.lens === "resonance" && state.natal) {
      const resHits = JE.computeNatalResonances(state.transit, state.natal, 2.8);
      for (const rh of resHits) {
        const tPt = polar(cx, cy, R * 0.57, rh.tDeg);
        const nPt = polar(cx, cy, R * 0.40, rh.nDeg);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tPt.x, tPt.y);
        if (rh.type === "opposition") ctx.quadraticCurveTo(cx, cy, nPt.x, nPt.y);
        else ctx.lineTo(nPt.x, nPt.y);
        ctx.strokeStyle = rh.type === "conjunction"
          ? (T.isLight ? "#b56400" : "#ffe066")
          : (T.isLight ? "#9e2d48" : "#ff85a2");
        ctx.lineWidth = 2.2;
        ctx.shadowColor = rh.color;
        ctx.shadowBlur = 9;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Always illuminate Double / Triple Transit Rasis & draw Convergence Arcs (strongest in convergences lens)
    const activeEvents = [...state.analysis.triples, ...state.analysis.doubles].slice(0, 3);
    for (const ev of activeEvents) {
      const isTriple = ev.tier === "triple";
      const sDeg = ev.rasiIdx * 30;
      const eDeg = sDeg + 30;
      const targetMid = sDeg + 15;

      drawWedge(ctx, cx, cy, R * 0.422, R * 0.562, sDeg, eDeg);
      ctx.fillStyle = isTriple
        ? `rgba(${T.isLight ? "214, 62, 24" : "255, 96, 52"}, ${(0.16 + 0.14 * pulse).toFixed(3)})`
        : `rgba(${T.isLight ? "204, 146, 22" : "248, 198, 72"}, ${(0.14 + 0.11 * pulse).toFixed(3)})`;
      ctx.fill();
      ctx.strokeStyle = isTriple ? (T.isLight ? "#c43814" : "#ff7849") : (T.isLight ? "#a87008" : "#ffd43b");
      ctx.lineWidth = isTriple ? 2.4 : 1.8;
      ctx.stroke();

      if (state.lens === "convergences") {
        const tgtPt = polar(cx, cy, R * 0.422, targetMid);
        for (const asp of ev.aspects) {
          const pDeg = state.transit.positions[asp.planet];
          const pMeta = JE.PLANET_MAP[asp.planet];
          const srcPt = polar(cx, cy, R * 0.565, pDeg);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(srcPt.x, srcPt.y);
          ctx.quadraticCurveTo(cx, cy, tgtPt.x, tgtPt.y);
          if (T.isLight) {
            ctx.strokeStyle = asp.planet === "Jupiter" ? "rgba(176,118,8,0.82)" : (asp.planet === "Saturn" ? "rgba(48,86,154,0.80)" : "rgba(128,46,168,0.84)");
          } else {
            ctx.strokeStyle = isTriple
              ? (asp.planet === "Jupiter" ? "rgba(255,212,59,0.75)" : (asp.planet === "Saturn" ? "rgba(148,185,240,0.72)" : "rgba(200,130,255,0.80)"))
              : (asp.planet === "Jupiter" ? "rgba(255,212,59,0.58)" : "rgba(148,185,240,0.56)");
          }
          ctx.lineWidth = isTriple ? 2.1 : 1.5;
          ctx.shadowColor = pMeta.color;
          ctx.shadowBlur = T.isLight ? 4 : (isTriple ? 12 : 7);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Eclipse Nodal Axis & Corona Flash during Surya / Chandra Grahan
    if (eclipse) {
      const rPt = polar(cx, cy, R * 0.562, state.transit.positions.Rahu);
      const kPt = polar(cx, cy, R * 0.562, state.transit.positions.Ketu);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(rPt.x, rPt.y);
      ctx.lineTo(kPt.x, kPt.y);
      ctx.strokeStyle = eclipse.type === "solar" ? "rgba(255, 110, 42, 0.52)" : "rgba(210, 72, 92, 0.52)";
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Expanding shockwaves
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      const age = (nowMs - sw.bornAt) / 2200;
      if (age >= 1) { state.shockwaves.splice(i, 1); continue; }
      const rad = R * (0.30 + age * 0.72);
      const alpha = (1 - age) * (sw.tier === "triple" ? 0.72 : 0.52);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.strokeStyle = sw.tier === "triple"
        ? `rgba(${T.isLight ? "196, 56, 20" : "255, 118, 68"}, ${alpha.toFixed(3)})`
        : `rgba(${T.isLight ? "178, 120, 12" : "255, 212, 82"}, ${alpha.toFixed(3)})`;
      ctx.lineWidth = (1 - age) * (sw.tier === "triple" ? 4.5 : 3.0);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Radiant Solar Meridian Beam
    const sunDeg = state.transit.positions.Sun;
    const sunIn = polar(cx, cy, R * 0.562, sunDeg);
    const sunOut = polar(cx, cy, R * 0.945, sunDeg);
    ctx.save();
    const beamGrad = ctx.createLinearGradient(sunIn.x, sunIn.y, sunOut.x, sunOut.y);
    beamGrad.addColorStop(0, T.isLight ? "rgba(196, 124, 16, 0.14)" : "rgba(255, 188, 60, 0.08)");
    beamGrad.addColorStop(0.45, T.isLight ? "rgba(214, 134, 14, 0.65)" : "rgba(255, 200, 72, 0.55)");
    beamGrad.addColorStop(1, T.isLight ? "rgba(184, 96, 6, 0.96)" : "rgba(255, 226, 130, 0.95)");
    ctx.beginPath();
    ctx.moveTo(sunIn.x, sunIn.y);
    ctx.lineTo(sunOut.x, sunOut.y);
    ctx.strokeStyle = beamGrad;
    ctx.lineWidth = 2.0;
    ctx.shadowColor = "#ffb636";
    ctx.shadowBlur = T.isLight ? 4 : 10;
    ctx.stroke();
    ctx.restore();

    // 7. Locked Natal Planetary Pins (Inner Recessed Track)
    if (state.natal) {
      const natalKeys = ["Lagna", "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"]
        .filter((k) => state.natal.positions[k] !== undefined);
      const natalPlaced = stackPlanets(natalKeys.map((k) => ({ id: k, deg: state.natal.positions[k] })), [R * 0.365, R * 0.332, R * 0.398], 12);

      for (const item of natalPlaced) {
        const meta = JE.PLANET_MAP[item.id];
        const pt = polar(cx, cy, item.r, item.deg);
        const rimPt = polar(cx, cy, R * 0.842, item.deg);

        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(rimPt.x, rimPt.y);
        ctx.strokeStyle = item.id === "Lagna" || item.id === "Moon"
          ? (T.isLight ? "rgba(146, 98, 18, 0.32)" : "rgba(255, 214, 102, 0.22)")
          : (T.isLight ? "rgba(128, 96, 44, 0.14)" : "rgba(218, 184, 114, 0.09)");
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.setLineDash([]);

        const pinR = Math.max(7.2, size * 0.0125);
        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pinR, 0, Math.PI * 2);
        ctx.fillStyle = item.id === "Lagna" ? T.natalLagnaBg : T.natalPinBg;
        ctx.fill();
        ctx.strokeStyle = item.id === "Lagna" ? "#45c49e" : T.natalPinRim;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.font = `700 ${Math.max(7.5, size * 0.0125).toFixed(1)}px "DM Sans", sans-serif`;
        ctx.fillStyle = meta.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(item.id === "Lagna" ? "L" : meta.sym, pt.x, pt.y + 0.5);
        ctx.restore();
      }
    }

    // 8. Live Transiting Planets + Orbital Trails + Sovereign Dasha Halos + Real Moon Phase
    const transitPlaced = stackPlanets(
      JE.PLANETS.map((p) => ({ id: p.id, deg: state.transit.positions[p.id] })),
      [R * 0.640, R * 0.684, R * 0.596],
      10
    );

    for (const item of transitPlaced) {
      const trail = state.trails[item.id];
      if (!trail || trail.length < 2) continue;
      const meta = JE.PLANET_MAP[item.id];
      for (let t = 1; t < trail.length; t++) {
        const dPrev = trail[t - 1];
        const dCur = trail[t];
        if (JE.angDiff(dPrev, dCur) > 45) continue;
        const p1 = polar(cx, cy, item.r, dPrev);
        const p2 = polar(cx, cy, item.r, dCur);
        const frac = t / trail.length;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = meta.color + Math.round(frac * (T.isLight ? 140 : 95)).toString(16).padStart(2, "0");
        ctx.lineWidth = 1.1 + frac * 2.2;
        ctx.stroke();
      }
    }

    const mdLord = (state.dasha && !state.dasha.isPreBirth && state.dasha.maha) ? state.dasha.maha.lord : null;
    const adLord = (state.dasha && !state.dasha.isPreBirth && state.dasha.antar) ? state.dasha.antar.lord : null;
    const orbR = Math.max(9.5, size * 0.0168);

    for (const item of transitPlaced) {
      const meta = JE.PLANET_MAP[item.id];
      const retro = state.transit.retrograde[item.id];
      const pt = polar(cx, cy, item.r, item.deg);
      const tickIn = polar(cx, cy, R * 0.718, item.deg);
      const tickOut = polar(cx, cy, R * 0.732, item.deg);

      ctx.beginPath();
      ctx.moveTo(tickIn.x, tickIn.y);
      ctx.lineTo(tickOut.x, tickOut.y);
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();

      // Hover reticle on planet
      if (state.hovered && state.hovered.type === "planet" && state.hovered.data.id === item.id) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, orbR + 6.5, 0, Math.PI * 2);
        ctx.strokeStyle = T.isLight ? "#8f5900" : "#ffe082";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Sovereign Vimshottari Mahadasha (MD) / Antardasha (AD) Halo
      if (item.id === mdLord) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, orbR + 5.2, 0, Math.PI * 2);
        ctx.strokeStyle = T.isLight ? "rgba(176, 114, 0, 0.92)" : "rgba(255, 218, 92, 0.92)";
        ctx.lineWidth = 1.8;
        ctx.shadowColor = "#ffd43b";
        ctx.shadowBlur = T.isLight ? 4 : 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (item.id === adLord) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, orbR + 4.0, 0, Math.PI * 2);
        ctx.strokeStyle = T.isLight ? "rgba(70, 110, 175, 0.85)" : "rgba(165, 205, 255, 0.82)";
        ctx.setLineDash([3, 2]);
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Eclipse Umbral Corona around eclipsed Sun or Moon
      if (eclipse && eclipse.planet === item.id) {
        const eclGrad = ctx.createRadialGradient(pt.x, pt.y, orbR * 0.7, pt.x, pt.y, orbR * 2.1);
        eclGrad.addColorStop(0, "rgba(0, 0, 0, 0.85)");
        eclGrad.addColorStop(0.52, eclipse.type === "solar" ? "rgba(255, 130, 42, 0.85)" : "rgba(218, 62, 72, 0.80)");
        eclGrad.addColorStop(1, "rgba(255, 90, 30, 0)");
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, orbR * 2.1, 0, Math.PI * 2);
        ctx.fillStyle = eclGrad;
        ctx.fill();
      }

      // Retrograde dashed halo
      if (retro && item.id !== "Rahu" && item.id !== "Ketu") {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, orbR + 3.2, 0, Math.PI * 2);
        ctx.strokeStyle = T.isLight ? "rgba(198, 64, 24, 0.82)" : "rgba(255, 136, 92, 0.72)";
        ctx.setLineDash([2.5, 2.5]);
        ctx.lineWidth = 1.35;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Medallion Body — True Lunar Phase rendering for Moon, jewel-set orb for others
      if (item.id === "Moon" && state.panchanga) {
        drawMoonPhaseMedallion(ctx, pt.x, pt.y, orbR, state.panchanga, T);
      } else {
        ctx.shadowColor = meta.glow;
        ctx.shadowBlur = T.isLight ? 4 : (item.id === "Sun" || meta.slow ? 13 : 8);
        const og = ctx.createRadialGradient(pt.x - orbR * 0.3, pt.y - orbR * 0.3, 1, pt.x, pt.y, orbR);
        og.addColorStop(0, "#fff8e8");
        og.addColorStop(0.35, meta.color);
        og.addColorStop(1, T.orbDark);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, orbR, 0, Math.PI * 2);
        ctx.fillStyle = og;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = T.orbRim;
        ctx.lineWidth = 1.1;
        ctx.stroke();

        ctx.font = `700 ${Math.max(10, size * 0.0175).toFixed(1)}px "DM Sans", sans-serif`;
        ctx.fillStyle = T.orbGlyph;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(meta.sym, pt.x, pt.y + 0.5);
      }

      // Retrograde micro-tag
      if (retro && item.id !== "Rahu" && item.id !== "Ketu") {
        ctx.font = `700 ${Math.max(6.5, size * 0.010).toFixed(1)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = T.isLight ? "#b83610" : "#ff9b70";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("℞", pt.x + orbR * 0.92, pt.y - orbR * 0.85);
      }
      ctx.restore();
    }

    // 9. Central Mechanical Chronometer Readout
    const curDate = JE.jdToDate(state.simJD);
    const { doy, daysInYear, year } = JE.dayOfYearUtc(curDate);
    const dateLine = `${String(curDate.getUTCDate()).padStart(2, "0")} ${MONTHS[curDate.getUTCMonth()]} ${year}`;
    const sunDet = state.transit.details.Sun;

    const hubScrim = ctx.createRadialGradient(cx, cy, rCore * 0.1, cx, cy, rCore * 0.85);
    hubScrim.addColorStop(0, T.hubScrim0);
    hubScrim.addColorStop(0.74, T.hubScrim1);
    hubScrim.addColorStop(1, T.hubScrim2);
    ctx.beginPath();
    ctx.arc(cx, cy, rCore * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = hubScrim;
    ctx.fill();

    // 365-Day curved brass progress ring
    const rYearArc = rCore * 0.88;
    const yearFrac = (doy - 1) / daysInYear;
    ctx.beginPath();
    ctx.arc(cx, cy, rYearArc, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * yearFrac);
    ctx.strokeStyle = (eclipse || hasTriple) ? T.yearArcTriple : T.yearArc;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (eclipse) {
      ctx.font = `700 ${Math.max(7.5, size * 0.0115).toFixed(1)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = T.yearArcTriple;
      ctx.fillText(eclipse.type === "solar" ? "◐ SURYA GRAHAN" : "● CHANDRA GRAHAN", cx, cy - rCore * 0.50);
    } else if (hasTriple || hasDouble) {
      ctx.font = `700 ${Math.max(7.8, size * 0.0122).toFixed(1)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = hasTriple ? T.yearArcTriple : (T.isLight ? "#a36800" : "#ffd43b");
      ctx.fillText(hasTriple ? "✦ TRIPLE TRANSIT" : "◆ DOUBLE TRANSIT", cx, cy - rCore * 0.50);
    } else {
      ctx.font = `600 ${Math.max(7.4, size * 0.0112).toFixed(1)}px "Cinzel", serif`;
      ctx.fillStyle = T.hubCrest;
      ctx.fillText(state.natal ? "NATAL LOCKED" : "NAKSHATRA CHAKRAM", cx, cy - rCore * 0.50);
    }

    // Large Crisp Date
    ctx.font = `700 ${Math.max(13, size * 0.024).toFixed(1)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = T.hubDate;
    ctx.fillText(dateLine, cx, cy - rCore * 0.19);

    // Day-of-Year Grain Counter
    ctx.font = `600 ${Math.max(9.2, size * 0.015).toFixed(1)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = T.hubDoy;
    ctx.fillText(`DAY ${String(doy).padStart(3, "0")} / ${daysInYear}`, cx, cy + rCore * 0.08);

    // Sun Nakshatra + Live Tithi
    ctx.font = `500 ${Math.max(8, size * 0.0124).toFixed(1)}px "DM Sans", sans-serif`;
    ctx.fillStyle = T.hubSun;
    ctx.fillText(`☉ ${sunDet.nak.name} · P${sunDet.padaNum}`, cx, cy + rCore * 0.30);

    // Panchanga Tithi & Ayanamsa
    const tithiStr = state.panchanga ? state.panchanga.tithiFull : "";
    ctx.font = `600 ${Math.max(7, size * 0.0106).toFixed(1)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = T.hubSub;
    ctx.fillText(`${tithiStr} · ${state.ayanamsa.toUpperCase()}`, cx, cy + rCore * 0.52);
  }

  /** Render true illuminated Lunar Phase directly on the Moon's orbital medallion */
  function drawMoonPhaseMedallion(c, x, y, r, panch, T) {
    // Purnima / Amavasya aura
    if (panch.isPurnima) {
      c.shadowColor = "rgba(225, 240, 255, 0.9)";
      c.shadowBlur = T.isLight ? 6 : 16;
    }
    // Dark lunar base
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = "#161b28";
    c.fill();
    c.shadowBlur = 0;

    // Illuminated limb via analytical phase terminator
    const phase = panch.phaseFrac; // 0=New, 0.25=FirstQ, 0.5=Full, 0.75=LastQ
    c.save();
    c.beginPath();
    c.arc(x, y, r - 0.8, 0, Math.PI * 2);
    c.clip();

    const waxing = phase <= 0.5;
    const k = Math.cos(phase * Math.PI * 2); // 1 at New, 0 at Quarter, -1 at Full
    const termRx = Math.abs(k) * r;

    c.fillStyle = "#eef4ff";
    c.beginPath();
    if (waxing) {
      // Right semicircle lit; gibbous (k < 0) curves left (anticlockwise=false), crescent (k > 0) curves right (anticlockwise=true)
      c.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false);
      c.ellipse(x, y, termRx, r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
    } else {
      // Left semicircle lit; gibbous (k < 0) curves right (anticlockwise=false), crescent (k > 0) curves left (anticlockwise=true)
      c.arc(x, y, r, Math.PI / 2, -Math.PI / 2, false);
      c.ellipse(x, y, termRx, r, 0, -Math.PI / 2, Math.PI / 2, k > 0);
    }
    c.closePath();
    c.fill();
    c.restore();

    // Rim & crisp glyph
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.strokeStyle = panch.isPurnima ? "#ffffff" : (panch.isAmavasya ? "#8b97b4" : T.orbRim);
    c.lineWidth = panch.isPurnima ? 1.8 : 1.15;
    c.stroke();

    c.font = `700 ${Math.max(9, r * 0.92).toFixed(1)}px "DM Sans", sans-serif`;
    c.fillStyle = panch.illumination > 0.55 ? "#141926" : "#dce8ff";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("☽", x, y + 0.5);
  }

  function stackPlanets(items, radii, minSepDeg) {
    const sorted = [...items].sort((a, b) => a.deg - b.deg);
    const placed = [];
    for (const it of sorted) {
      const used = new Set();
      for (const prev of placed) {
        if (JE.angDiff(it.deg, prev.deg) < minSepDeg) used.add(prev.level);
      }
      let level = 0;
      while (used.has(level)) level++;
      placed.push({ ...it, level, r: radii[Math.min(level, radii.length - 1)] });
    }
    return placed;
  }

  // ---------------------------------------------------------------------------
  // Simulation Loop (Zero-Skip Daily Grain & Transit Detection)
  // ---------------------------------------------------------------------------

  function stepSimulation(dtSec, nowMs) {
    let zDiff = ((state.targetZenithDeg - state.zenithDeg + 540) % 360) - 180;
    if (Math.abs(zDiff) > 0.02) {
      state.zenithDeg = JE.norm360(state.zenithDeg + zDiff * Math.min(1, dtSec * 8));
    } else {
      state.zenithDeg = state.targetZenithDeg;
    }

    if (state.playing && !crank.active) {
      const rate = SPEED_MAP[state.speed].daysPerSec;
      const dDays = dtSec * rate * state.direction;
      const prevJD = state.simJD;
      state.simJD += dDays;

      if (state.direction < 0 && state.natalJD !== null && prevJD > state.natalJD && state.simJD <= state.natalJD) {
        state.simJD = state.natalJD;
        state.playing = false;
        syncPlayButtons();
        if (Audio) Audio.playNatalLock(true);
      }
      state.gearAngle += (state.simJD - prevJD) * 0.065;
      if (window.CelestialTapestry) window.CelestialTapestry.setDialAngle(state.gearAngle);
    }

    state.transit = JE.computeSiderealSnapshot(state.simJD, state.ayanamsa);
    state.panchanga = JE.computePanchanga(state.transit, state.simJD);
    state.dasha = (state.natal && state.natalJD !== null)
      ? JE.computeVimshottariDasha(state.natal.positions.Moon, state.natalJD, state.simJD)
      : null;
    state.activeEpoch = JE.getActiveLifeEpoch(state.transit, state.natal);

    if (state.playing && !crank.active) {
      for (const p of JE.PLANETS) {
        if (!state.trails[p.id]) state.trails[p.id] = [];
        const arr = state.trails[p.id];
        const curDeg = state.transit.positions[p.id];
        if (arr.length === 0 || JE.angDiff(arr[arr.length - 1], curDeg) >= 0.45) {
          arr.push(curDeg);
          const maxLen = p.slow ? 12 : (p.id === "Moon" ? 16 : 22);
          if (arr.length > maxLen) arr.shift();
        }
      }
    }

    const curIntDay = Math.floor(state.simJD);
    if (curIntDay !== state.lastCheckedDay) {
      const stepDir = curIntDay > state.lastCheckedDay ? 1 : -1;
      const totalSteps = Math.min(45, Math.abs(curIntDay - state.lastCheckedDay));
      for (let s = 1; s <= totalSteps; s++) {
        const dayJD = state.lastCheckedDay + s * stepDir + 0.5;
        const daySnap = (s === totalSteps) ? state.transit : JE.computeSiderealSnapshot(dayJD, state.ayanamsa);
        const dayDasha = (state.natal && state.natalJD !== null)
          ? JE.computeVimshottariDasha(state.natal.positions.Moon, state.natalJD, dayJD)
          : null;
        evaluateAndTriggerTransits(daySnap, dayJD, nowMs, !crank.active, dayDasha);
      }
      state.lastCheckedDay = curIntDay;
      if (state.playing && !crank.active && Audio) Audio.playTick(state.speed);
    } else if (!state.analysis) {
      evaluateAndTriggerTransits(state.transit, state.simJD, nowMs, false, state.dasha);
    }

    if (nowMs - state.lastUiUpdateMs > 110) {
      state.lastUiUpdateMs = nowMs;
      syncSidePanelUI();
    }
  }

  function evaluateAndTriggerTransits(snap, jd, nowMs, allowSound, dashaObj = null) {
    const res = JE.analyzeTransits(snap, state.natal, dashaObj || state.dasha);
    state.analysis = res;

    const nextKeys = new Set();
    let firedTriple = false;
    let firedDouble = false;
    let firedPada = false;
    const dateLabel = formatShortDate(JE.jdToDate(jd));

    for (const tr of res.triples) {
      nextKeys.add(tr.key);
      if (!state.activeEventKeys.has(tr.key)) {
        firedTriple = true;
        pushEventLog({ tier: "triple", date: dateLabel, summary: tr.summary, impact: tr.vargaSummary || tr.impact || "", jd });
        state.shockwaves.push({ rasiIdx: tr.rasiIdx, tier: "triple", bornAt: nowMs });
      }
    }
    for (const db of res.doubles) {
      nextKeys.add(db.key);
      if (!state.activeEventKeys.has(db.key)) {
        firedDouble = true;
        pushEventLog({ tier: "double", date: dateLabel, summary: db.summary, jd });
        state.shockwaves.push({ rasiIdx: db.rasiIdx, tier: "double", bornAt: nowMs });
      }
    }
    for (const ph of res.padaHits) {
      nextKeys.add(ph.key);
      if (!state.activeEventKeys.has(ph.key)) {
        firedPada = true;
        pushEventLog({ tier: "pada", date: dateLabel, summary: ph.summary, jd });
      }
    }

    state.activeEventKeys = nextKeys;

    if (allowSound && Audio) {
      if (firedTriple) Audio.playTripleTransit();
      else if (firedDouble) Audio.playDoubleTransit();
      else if (firedPada) Audio.playPadaHit();
    }
    if (firedTriple || firedDouble || firedPada) {
      renderEventLog();
      flashAnnunciator(firedTriple ? "triple" : (firedDouble ? "double" : "pada"));
    }
  }

  function pushEventLog(item) {
    state.eventLog.unshift(item);
    if (state.eventLog.length > 24) state.eventLog.pop();
  }

  function formatShortDate(d) {
    return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  function formatIsoDate(d) {
    return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function getTimelineBounds() {
    const todayJD = JE.dateToJD(new Date());
    const baseMin = state.natalJD !== null ? state.natalJD : JE.ymdhmsToJD(1950, 1, 1, 12);
    const baseMax = todayJD + 30 * 365.25;
    const minJD = Math.min(baseMin, state.simJD - 1);
    const maxJD = Math.max(baseMax, state.simJD + 1);
    return { minJD, maxJD, todayJD };
  }

  function jumpToJD(jd, playSound = false) {
    const oldJD = state.simJD;
    state.simJD = jd;
    state.lastCheckedDay = Math.floor(jd);
    state.gearAngle += Math.max(-18, Math.min(18, (jd - oldJD) * 0.025));
    state.trails = {};
    state.transit = JE.computeSiderealSnapshot(jd, state.ayanamsa);
    state.panchanga = JE.computePanchanga(state.transit, jd);
    state.dasha = (state.natal && state.natalJD !== null)
      ? JE.computeVimshottariDasha(state.natal.positions.Moon, state.natalJD, jd)
      : null;
    state.activeEpoch = JE.getActiveLifeEpoch(state.transit, state.natal);
    state.activeEventKeys = new Set();
    evaluateAndTriggerTransits(state.transit, jd, performance.now(), playSound, state.dasha);
    syncSidePanelUI();
  }

  function stepByUnit(unit, delta) {
    const d = JE.jdToDate(state.simJD);
    let targetJD = state.simJD;
    if (unit === "d") targetJD = state.simJD + delta;
    else if (unit === "m") { const n = new Date(d.getTime()); n.setUTCMonth(n.getUTCMonth() + delta); targetJD = JE.dateToJD(n); }
    else if (unit === "y") { const n = new Date(d.getTime()); n.setUTCFullYear(n.getUTCFullYear() + delta); targetJD = JE.dateToJD(n); }
    jumpToJD(targetJD, true);
  }

  function tickLoop(nowMs) {
    const dtSec = Math.min(0.1, Math.max(0.001, (nowMs - state.lastFrameMs) / 1000));
    state.lastFrameMs = nowMs;
    stepSimulation(dtSec, nowMs);
    renderFrame(nowMs);
    requestAnimationFrame(tickLoop);
  }

  // ---------------------------------------------------------------------------
  // DOM Sync, Life Epoch Track Bands, Dasha Strip & Zen Dock
  // ---------------------------------------------------------------------------

  function syncPlayButtons() {
    const btnPlay = $("btn-play");
    const zenPlay = $("zen-play");
    if (btnPlay) {
      btnPlay.textContent = state.playing ? "❚❚ PAUSE" : "▶ ENGAGE";
      btnPlay.classList.toggle("is-active", state.playing);
    }
    if (zenPlay) {
      zenPlay.textContent = state.playing ? "❚❚" : "▶";
    }
  }

  function flashAnnunciator(tier) {
    const box = $("transit-annunciator");
    if (!box) return;
    box.classList.remove("flash-double", "flash-triple", "flash-pada");
    void box.offsetWidth;
    box.classList.add(`flash-${tier}`);
  }

  function formatMonthYear(jd) {
    const d = JE.jdToDate(jd);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  function renderEpochBands() {
    const hosts = [$("timeline-epochs"), $("zen-epochs")].filter(Boolean);
    if (!hosts.length) return;
    if (!state.natal || !state.epochs.length) {
      hosts.forEach((h) => { h.innerHTML = ""; });
      return;
    }
    const { minJD, maxJD } = getTimelineBounds();
    const span = Math.max(1, maxJD - minJD);
    const html = state.epochs.map((ep) => {
      const left = Math.max(0, Math.min(100, ((ep.startJD - minJD) / span) * 100));
      const right = Math.max(0, Math.min(100, ((ep.endJD - minJD) / span) * 100));
      const width = Math.max(0.9, right - left);
      const y1 = JE.jdToDate(ep.startJD).getUTCFullYear();
      const y2 = JE.jdToDate(ep.endJD).getUTCFullYear();
      return `<span class="epoch-band ep-${ep.type}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%" title="${ep.label} (${y1}–${y2})"></span>`;
    }).join("");
    hosts.forEach((h) => { h.innerHTML = html; });
  }

  function renderTripleMarkers() {
    const hosts = [$("main-triple-markers"), $("zen-triple-markers")].filter(Boolean);
    if (!hosts.length) return;
    if (!state.tripleWindows.length) {
      hosts.forEach((h) => { h.innerHTML = ""; });
      return;
    }
    const { minJD, maxJD } = getTimelineBounds();
    const span = Math.max(1, maxJD - minJD);
    const html = state.tripleWindows.map((w, idx) => {
      const pct = Math.max(0.8, Math.min(99.2, ((w.peakJD - minJD) / span) * 100));
      const dateStr = formatMonthYear(w.peakJD);
      const isKetu = w.nodeName === "Ketu";
      return `<button type="button" class="tt-arrow${isKetu ? " is-ketu" : ""}" data-tt-idx="${idx}" style="left:${pct.toFixed(2)}%" aria-label="Triple Transit ${dateStr}: ${w.vargaSummary.replace(/"/g, "&quot;")}">▼</button>`;
    }).join("");
    hosts.forEach((h) => { h.innerHTML = html; });
  }

  let lastZenVargaHtml = "";
  let lastZenVargaWidth = 0;
  let lastTelemetryHtml = "";

  function applyInPlaceMarquee(bar, textEl) {
    if (!bar || !textEl) return;
    textEl.classList.remove("is-scrolling");
    bar.classList.remove("is-overflowing");
    textEl.style.removeProperty("--marquee-shift");
    textEl.style.removeProperty("--marquee-dur");
    const availW = bar.clientWidth;
    if (availW <= 0) return;
    const cs = window.getComputedStyle(bar);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const innerW = Math.max(0, availW - padX);
    const overflow = Math.ceil(textEl.scrollWidth - innerW);
    if (overflow > 4) {
      const shift = overflow + 18;
      const dur = Math.max(9.5, Math.min(28, shift / 28 + 4.5));
      textEl.style.setProperty("--marquee-shift", `-${shift}px`);
      textEl.style.setProperty("--marquee-dur", `${dur.toFixed(1)}s`);
      bar.classList.add("is-overflowing");
      void textEl.offsetWidth;
      textEl.classList.add("is-scrolling");
    }
  }

  function updateZenVargaBar(forceMeasure = false) {
    const bar = $("zen-varga-bar");
    const textEl = $("zen-varga-text") || bar;
    if (!bar || !textEl) return;

    let active = false;
    let nextHtml = "Hover any ▼ arrow on timeline for D1–D60 Multi-Varga Triple Transit impact · Click ▼ to jump directly";

    if (state.hoveredMarker) {
      const w = state.hoveredMarker;
      const d1 = formatMonthYear(w.startJD);
      const d2 = formatMonthYear(w.endJD);
      const spanStr = d1 === d2 ? d1 : `${d1}–${d2}`;
      active = true;
      nextHtml = `<span class="zv-tag">✦ ${spanStr}</span> ${w.vargaSummary}`;
    } else if (state.zen && state.hovered && state.hovered.telemetryHtml) {
      active = true;
      nextHtml = state.hovered.telemetryHtml;
    } else {
      const liveTr = state.analysis && state.analysis.triples[0];
      if (liveTr && liveTr.vargaSummary) {
        active = true;
        nextHtml = `<span class="zv-tag">✦ ACTIVE TRIPLE</span> ${liveTr.vargaSummary}`;
      }
    }

    bar.classList.toggle("is-active", active);
    const curW = bar.clientWidth;
    if (!forceMeasure && nextHtml === lastZenVargaHtml && curW === lastZenVargaWidth) return;

    lastZenVargaHtml = nextHtml;
    lastZenVargaWidth = curW;
    textEl.innerHTML = nextHtml;
    if (curW > 0) applyInPlaceMarquee(bar, textEl);
  }

  function recomputeForAyanamsaOrNatal(playAudioMode) {
    state.trails = {};
    if (state.birthInput) {
      const b = state.birthInput;
      const bJD = JE.localBirthToJD(b.date, b.time, b.tz);
      state.natalJD = bJD;
      state.natal = JE.computeSiderealSnapshot(bJD, state.ayanamsa, b.lat, b.lon);
      const lagR = state.natal.details.Lagna.rasiIdx;
      state.targetZenithDeg = lagR * 30 + 15;
    } else {
      state.natalJD = null;
      state.natal = null;
      state.targetZenithDeg = state.ayanamsa === "raman" ? 13.55 : 15.0;
    }

    const bounds = getTimelineBounds();
    state.epochs = state.natal ? JE.computeLifeEpochs(state.natal, bounds.minJD, bounds.maxJD, state.ayanamsa) : [];
    state.tripleWindows = JE.computeTripleTransitWindows(state.natal, bounds.minJD, bounds.maxJD, state.ayanamsa);
    state.hoveredMarker = null;

    state.transit = JE.computeSiderealSnapshot(state.simJD, state.ayanamsa);
    state.panchanga = JE.computePanchanga(state.transit, state.simJD);
    state.dasha = (state.natal && state.natalJD !== null)
      ? JE.computeVimshottariDasha(state.natal.positions.Moon, state.natalJD, state.simJD)
      : null;
    state.activeEpoch = JE.getActiveLifeEpoch(state.transit, state.natal);
    state.activeEventKeys = new Set();
    evaluateAndTriggerTransits(state.transit, state.simJD, performance.now(), false, state.dasha);

    if (playAudioMode === "ayanamsa" && Audio) Audio.playAyanamsaClutch();
    if (playAudioMode === "lock" && Audio) Audio.playNatalLock(true);
    if (playAudioMode === "unlock" && Audio) Audio.playNatalLock(false);

    renderEpochBands();
    renderTripleMarkers();
    syncSidePanelUI();
    renderEventLog();
  }

  function syncSidePanelUI() {
    if (!state.transit) return;
    const curDate = JE.jdToDate(state.simJD);
    const { doy, daysInYear } = JE.dayOfYearUtc(curDate);
    const { minJD, maxJD, todayJD } = getTimelineBounds();
    const shortDate = formatShortDate(curDate);

    const elDate = $("chrono-date");
    const elDoy = $("chrono-doy");
    const elAge = $("chrono-age");
    const elJump = $("jump-date");
    const elSlider = $("timeline-scrubber");
    const elTlStart = $("tl-start");
    const elTlEnd = $("tl-end");
    const elTodayMark = $("timeline-today-mark");
    const elBtnBirth = $("btn-birth");
    const elAyanVal = $("ayanamsa-readout");

    if (elDate) elDate.textContent = shortDate;
    if (elDoy) {
      const tithi = state.panchanga ? state.panchanga.tithiFull : "";
      elDoy.textContent = `DAY ${String(doy).padStart(3, "0")} / ${daysInYear} · ${tithi}`;
    }

    let ageText = "PRESENT SKY";
    let zenAgeShort = "LIVE";
    if (state.natalJD !== null) {
      const diffDays = state.simJD - state.natalJD;
      if (Math.abs(diffDays) < 0.6) {
        ageText = "BIRTH MOMENT";
        zenAgeShort = "BIRTH";
      } else {
        const yrs = diffDays / 365.2425;
        ageText = yrs >= 0 ? `AGE ${yrs.toFixed(1)} YRS` : `${yrs.toFixed(1)}Y PRE-BIRTH`;
        zenAgeShort = `${yrs >= 0 ? "" : ""}${yrs.toFixed(1)}Y`;
      }
    } else {
      const diffDays = state.simJD - todayJD;
      if (Math.abs(diffDays) >= 0.8) {
        const yrs = diffDays / 365.2425;
        ageText = `${yrs >= 0 ? "+" : ""}${yrs.toFixed(1)} YRS`;
        zenAgeShort = `${yrs >= 0 ? "+" : ""}${yrs.toFixed(1)}Y`;
      }
    }
    if (elAge) elAge.textContent = ageText;

    if (elJump && document.activeElement !== elJump) elJump.value = formatIsoDate(curDate);
    const tlFrac = Math.max(0, Math.min(1, (state.simJD - minJD) / Math.max(1, maxJD - minJD)));
    const tlValStr = String(Math.round(tlFrac * 10000));
    if (elSlider && document.activeElement !== elSlider) elSlider.value = tlValStr;
    const zenSlider = $("zen-scrubber");
    if (zenSlider && document.activeElement !== zenSlider) zenSlider.value = tlValStr;

    const startYr = JE.jdToDate(minJD).getUTCFullYear();
    const startTxt = state.natalJD !== null ? `BORN ${startYr}` : String(startYr);
    const endTxt = String(JE.jdToDate(maxJD).getUTCFullYear());
    if (elTlStart) elTlStart.textContent = startTxt;
    if (elTlEnd) elTlEnd.textContent = endTxt;
    if ($("zen-tl-start")) $("zen-tl-start").textContent = startTxt;
    if ($("zen-tl-end")) $("zen-tl-end").textContent = endTxt;

    const tFrac = Math.max(0, Math.min(1, (todayJD - minJD) / Math.max(1, maxJD - minJD)));
    const tPct = `${(tFrac * 100).toFixed(2)}%`;
    if (elTodayMark) elTodayMark.style.left = tPct;
    if ($("zen-today-mark")) $("zen-today-mark").style.left = tPct;
    if (elBtnBirth) {
      elBtnBirth.disabled = state.natalJD === null;
      elBtnBirth.title = state.natalJD !== null
        ? "Jump back to exact birth date & time"
        : "Lock a birth chart below to jump to your birth moment";
    }
    if (elAyanVal) {
      elAyanVal.textContent = `${state.ayanamsa === "raman" ? "B.V. Raman" : "Lahiri"} · ${JE.fmtDMS(state.transit.ayanamsa)}`;
    }

    // Live Vimshottari Dasha & Active Life-Epoch strip
    const dashaEl = $("dasha-strip");
    if (dashaEl) {
      if (state.dasha && !state.dasha.isPreBirth && state.dasha.maha) {
        const mP = JE.PLANET_MAP[state.dasha.maha.lord];
        const aP = JE.PLANET_MAP[state.dasha.antar.lord];
        const pP = JE.PLANET_MAP[state.dasha.pratyantar.lord];
        const mdPct = Math.round(state.dasha.maha.frac * 100);
        const epochHtml = (state.activeEpoch && state.activeEpoch.badges.length)
          ? state.activeEpoch.badges.map((b) => `<span class="epoch-pill ep-${b.type}">${b.label}</span>`).join("")
          : "";
        dashaEl.hidden = false;
        dashaEl.innerHTML = `
          <div class="dasha-row">
            <span class="dasha-tag">VIMSHOTTARI</span>
            <span class="dasha-lords">
              <b style="color:${mP.color}">${mP.sym} ${mP.id}</b>
              <span class="dasha-sep">›</span>
              <b style="color:${aP.color}">${aP.sym} ${aP.id}</b>
              <span class="dasha-sep">›</span>
              <span>${pP.sym} ${pP.short}</span>
            </span>
            <span class="dasha-pct">${mdPct}%</span>
          </div>
          <div class="dasha-bar"><span style="width:${mdPct}%"></span></div>
          ${epochHtml ? `<div class="epoch-row">${epochHtml}</div>` : ""}
        `;
      } else if (state.dasha && state.dasha.isPreBirth) {
        dashaEl.hidden = false;
        dashaEl.innerHTML = `<div class="dasha-row"><span class="dasha-tag">VIMSHOTTARI</span><span class="dasha-lords">Pre-Birth Epoch</span></div>`;
      } else {
        dashaEl.hidden = true;
      }
    }

    // Zen Stabilized Deck telemetry & Multi-Varga bar
    const zenDate = $("zen-date");
    const zenMeta = $("zen-meta");
    if (zenDate) zenDate.textContent = `${shortDate} · ${zenAgeShort}`;
    if (zenMeta) {
      const ascStr = (state.natal && state.natal.details.Lagna)
        ? `Asc ${state.natal.details.Lagna.rasi.sanskrit} ${JE.fmtDM(state.natal.details.Lagna.degInRasi)} · `
        : "";
      const mdStr = (state.dasha && !state.dasha.isPreBirth && state.dasha.maha)
        ? ` · ${JE.PLANET_MAP[state.dasha.maha.lord].sym} ${state.dasha.maha.lord}/${state.dasha.antar.lord}`
        : "";
      const tiStr = state.panchanga ? state.panchanga.tithiFull : "";
      zenMeta.textContent = `${ascStr}${tiStr}${mdStr}`;
    }
    updateZenVargaBar();

    // Annunciator live status + 1-line expected impact summary for Triple Transits
    const annBadge = $("ann-badge");
    const annText = $("ann-text");
    const annImpact = $("ann-impact");
    const annBox = $("transit-annunciator");
    if (annBadge && annText && annBox) {
      const tr = state.analysis.triples[0];
      const db = state.analysis.doubles[0];
      const ph = state.analysis.padaHits[0];
      const ecl = state.panchanga ? state.panchanga.eclipse : null;
      annBox.classList.toggle("is-triple", Boolean(tr || ecl));
      annBox.classList.toggle("is-double", !tr && !ecl && Boolean(db));
      if (ecl) {
        annBadge.textContent = `◐ ${ecl.label}`;
        annText.textContent = tr ? tr.summary : (db ? db.summary : `${state.panchanga.tithiFull} · Node alignment within eclipse orb`);
      } else if (tr) {
        annBadge.textContent = tr.dashaActivated ? "✦ TRIPLE TRANSIT · ★ DASHA" : "✦ TRIPLE TRANSIT ACTIVE";
        annText.textContent = tr.summary;
      } else if (db) {
        annBadge.textContent = db.dashaActivated ? "◆ DOUBLE TRANSIT · ★ DASHA" : "◆ DOUBLE TRANSIT ACTIVE";
        annText.textContent = db.summary;
      } else if (ph) {
        annBadge.textContent = "◈ EXACT NATAL PADA TRANSIT";
        annText.textContent = ph.summary;
      } else {
        annBadge.textContent = "○ MONITORING GOCHARA";
        annText.textContent = state.natal
          ? `♃ ${state.transit.details.Jupiter.rasi.sanskrit} · ♄ ${state.transit.details.Saturn.rasi.sanskrit} · ☊ ${state.transit.details.Rahu.rasi.sanskrit}`
          : "Lock birth details to track personal Double / Triple transits & Dasha";
      }
      if (annImpact) {
        if (tr && (tr.vargaSummary || tr.impact)) {
          annImpact.textContent = tr.vargaSummary || `Impact: ${tr.impact}`;
          annImpact.title = tr.vargaSummary || tr.impact;
          annImpact.hidden = false;
        } else {
          annImpact.textContent = "";
          annImpact.hidden = true;
        }
      }
    }

    // Natal lock summary
    const natalStatus = $("natal-lock-status");
    if (natalStatus) {
      if (state.natal) {
        const lag = state.natal.details.Lagna;
        const moo = state.natal.details.Moon;
        const cityShort = state.birthInput ? String(state.birthInput.city || "").split(",")[0] : "";
        const timeShort = state.birthInput ? (state.birthInput.time || "") : "";
        const stamp = (timeShort || cityShort) ? ` · ${[timeShort, cityShort].filter(Boolean).join(" ")}` : "";
        natalStatus.innerHTML = `<span class="lock-pill">LOCKED</span> ${lag.rasi.sanskrit} ${JE.fmtDM(lag.degInRasi)} (${lag.nak.short} P${lag.padaNum})${stamp} · ☽ ${moo.rasi.sanskrit} P${moo.padaNum}`;
      } else {
        natalStatus.innerHTML = `<span class="lock-pill is-sky">COSMIC SKY</span> Enter birth details below to lock natal pins`;
      }
    }

    // Live Ephemeris Table (includes Dignity ↑ / ★ / ↓)
    const ephemBody = $("ephemeris-rows");
    if (ephemBody) {
      ephemBody.innerHTML = JE.PLANETS.map((p) => {
        const d = state.transit.details[p.id];
        const retro = state.transit.retrograde[p.id] && p.id !== "Rahu" && p.id !== "Ketu";
        const dig = JE.getDignity(p.id, d.rasiIdx);
        const digTag = dig.mark ? `<span class="dig-tag dig-${dig.code}" title="${dig.label}">${dig.mark}</span>` : "";
        return `<tr>
          <td><span class="p-dot" style="color:${p.color}">${p.sym}</span>${p.short}${retro ? '<span class="retro-tag">℞</span>' : ""}${digTag}</td>
          <td>${d.rasi.glyph} ${d.rasi.sanskrit}</td>
          <td class="mono">${JE.fmtDM(d.degInRasi)}</td>
          <td>${d.nak.name} <span class="pada-pill">P${d.padaNum}</span></td>
        </tr>`;
      }).join("");
    }
  }

  function renderEventLog() {
    const list = $("transit-log-list");
    if (!list) return;
    if (!state.eventLog.length) {
      list.innerHTML = `<li class="log-empty">Scrub timeline or press Prev / Next to locate Double &amp; Triple convergences.</li>`;
      return;
    }
    list.innerHTML = state.eventLog.slice(0, 8).map((ev) => {
      const badge = ev.tier === "triple" ? "TRIPLE" : (ev.tier === "double" ? "DOUBLE" : "PADA");
      const tip = ev.impact ? `Jump dial to ${ev.date} — Impact: ${ev.impact}` : `Jump dial to ${ev.date}`;
      const impactHtml = (ev.tier === "triple" && ev.impact) ? `<span class="log-impact">${ev.impact}</span>` : "";
      return `<li class="log-item tier-${ev.tier}" data-jd="${ev.jd.toFixed(3)}" title="${tip.replace(/"/g, "&quot;")}">
        <span class="log-tag">${badge}</span>
        <span class="log-date">${ev.date}</span>
        <span class="log-msg">${ev.summary}</span>
        ${impactHtml}
      </li>`;
    }).join("");
  }

  // ---------------------------------------------------------------------------
  // Zero-Obstruction Hover Telemetry, Click-to-Pin Lore & Tactile Dial Cranking
  // ---------------------------------------------------------------------------

  function hitTestDial(mx, my) {
    const cx = canvasSize / 2;
    const cy = canvasSize / 2;
    const R = canvasSize * 0.468;
    const { deg, dist } = screenToSiderealDeg(cx, cy, mx, my);
    const rFrac = dist / R;
    if (rFrac < 0.305 || rFrac > 0.945) return null;

    if (rFrac >= 0.842) {
      const pada = JE.PADAS[Math.floor(deg / JE.PADA_SPAN) % 108];
      const here = JE.PLANETS.filter((p) => state.transit.details[p.id].padaId === pada.id).map((p) => `${p.sym} ${p.id}`);
      return {
        type: "pada",
        data: pada,
        telemetryHtml: `<span class="tel-badge">PADA #${pada.num}/108</span> <b>${pada.nak.dev} · ${pada.nak.name} P${pada.padaNum}</b> <span class="tel-sep">·</span> ${JE.fmtDM(pada.startDeg)}–${JE.fmtDM(pada.endDeg)} <span class="tel-sep">·</span> ${pada.rasi.glyph} ${pada.rasi.sanskrit} <span class="tel-sep">·</span> Navamsa: <b>${pada.navamsa.sanskrit}</b> <span class="tel-sep">·</span> Beeja: <b>${pada.beeja}</b>${pada.isGandanta ? ' <span class="tel-gan">GANDANTA</span>' : ""}${here.length ? ` <span class="tel-live">${here.join(" ")}</span>` : ""}`,
        loreHtml: `
          <div class="lore-head">${pada.nak.dev} · ${pada.nak.name} — Pada ${pada.padaNum} <span class="lore-num">#${pada.num}/108</span></div>
          <div class="lore-grid">
            <span>Span</span><b>${JE.fmtDM(pada.startDeg)} – ${JE.fmtDM(pada.endDeg)}</b>
            <span>Rasi / D9</span><b>${pada.rasi.glyph} ${pada.rasi.sanskrit} · Navamsa ${pada.navamsa.sanskrit}</b>
            <span>Ruler / Deity</span><b>${pada.nak.ruler} · ${pada.nak.deity}</b>
            <span>Beeja / Gana</span><b>${pada.beeja} · ${pada.nak.gana} (${pada.nak.symbol})</b>
          </div>
          ${pada.isGandanta ? `<div class="lore-warn">Gandanta Karmic Knot — Water/Fire spiritual junction</div>` : ""}
          ${here.length ? `<div class="lore-live">Transiting now: ${here.join(" · ")}</div>` : ""}
        `,
      };
    }

    if (rFrac >= 0.718) {
      const nak = JE.NAKSHATRAS[Math.floor(deg / (360 / 27)) % 27];
      return {
        type: "nak",
        data: nak,
        telemetryHtml: `<span class="tel-badge">NAKSHATRA ${nak.idx + 1}/27</span> <b>${nak.dev} · ${nak.name}</b> <span class="tel-sep">·</span> Ruler: <b>${nak.ruler}</b> <span class="tel-sep">·</span> Deity: ${nak.deity} <span class="tel-sep">·</span> Gana: ${nak.gana} <span class="tel-sep">·</span> Padas: ${nak.padas.join(" · ")}`,
        loreHtml: `
          <div class="lore-head">${nak.dev} · ${nak.name} <span class="lore-num">${nak.idx + 1}/27</span></div>
          <div class="lore-grid">
            <span>Vimshottari</span><b>${nak.ruler}</b>
            <span>Deity</span><b>${nak.deity}</b>
            <span>Symbol</span><b>${nak.symbol}</b>
            <span>Gana / Beeja</span><b>${nak.gana} · ${nak.padas.join(", ")}</b>
          </div>
        `,
      };
    }

    if (rFrac >= 0.562) {
      let best = null;
      let bestD = 9;
      for (const p of JE.PLANETS) {
        const dd = JE.angDiff(deg, state.transit.positions[p.id]);
        if (dd < bestD) { bestD = dd; best = p; }
      }
      if (!best) return null;
      const d = state.transit.details[best.id];
      const retro = state.transit.retrograde[best.id] && best.id !== "Rahu" && best.id !== "Ketu";
      const dig = JE.getDignity(best.id, d.rasiIdx);
      const speedStr = `${state.transit.speeds[best.id] >= 0 ? "+" : ""}${state.transit.speeds[best.id].toFixed(2)}°/d`;
      const extraMoon = best.id === "Moon" && state.panchanga ? ` · ${state.panchanga.tithiFull} (${Math.round(state.panchanga.illumination * 100)}% lit)` : "";
      return {
        type: "planet",
        data: best,
        telemetryHtml: `<span class="tel-badge" style="color:${best.color}">${best.sym} ${best.id.toUpperCase()}${retro ? " ℞" : ""}</span> <b>${d.rasi.glyph} ${d.rasi.sanskrit} ${JE.fmtDM(d.degInRasi)}</b> <span class="tel-sep">·</span> ${d.nak.name} P${d.padaNum} (#${d.pada.num}) <span class="tel-sep">·</span> ${dig.label} <span class="tel-sep">·</span> ${speedStr}${extraMoon}`,
        loreHtml: `
          <div class="lore-head" style="color:${best.color}">${best.sym} ${best.id} (${best.dev} ${best.sanskrit})${retro ? " · ℞ Retrograde" : ""}</div>
          <div class="lore-grid">
            <span>Position</span><b>${d.rasi.glyph} ${d.rasi.sanskrit} ${JE.fmtDMS(d.degInRasi)}</b>
            <span>Nakshatra</span><b>${d.nak.dev} ${d.nak.name} · P${d.padaNum} (#${d.pada.num}/108)</b>
            <span>Navamsa</span><b>${d.navamsa.sanskrit} · ${dig.label}</b>
            <span>Motion</span><b>${speedStr}${extraMoon}</b>
          </div>
        `,
      };
    }

    if (rFrac >= 0.422) {
      const rasi = JE.RASIS[Math.floor(deg / 30) % 12];
      const activeTr = state.analysis.triples.find((t) => t.rasiIdx === rasi.idx);
      const trSummary = activeTr ? (activeTr.vargaSummary || activeTr.impact) : "";
      const trTel = trSummary ? ` <span class="tel-sep">·</span> <span class="tel-gan">D1–D60 TRIPLE</span> ${trSummary}` : "";
      const trLore = trSummary ? `<div class="lore-warn">✦ ${trSummary}</div>` : "";
      return {
        type: "rasi",
        data: rasi,
        telemetryHtml: `<span class="tel-badge">${rasi.glyph} RASI ${rasi.idx + 1}/12</span> <b>${rasi.dev} · ${rasi.sanskrit} (${rasi.english})</b> <span class="tel-sep">·</span> ${rasi.element} <span class="tel-sep">·</span> Ruler: <b>${rasi.ruler}</b>${trTel || ` <span class="tel-sep">·</span> ${rasi.vibe}`}`,
        loreHtml: `
          <div class="lore-head">${rasi.glyph} ${rasi.dev} · ${rasi.sanskrit} (${rasi.english})</div>
          <div class="lore-grid">
            <span>Element</span><b>${rasi.element}</b>
            <span>Ruler</span><b>${rasi.ruler}</b>
            <span>Essence</span><b>${rasi.vibe}</b>
          </div>
          ${trLore}
        `,
      };
    }

    if (state.natal) {
      const keys = ["Lagna", ...JE.PLANETS.map((p) => p.id)];
      let best = null;
      let bestD = 11;
      for (const k of keys) {
        if (state.natal.positions[k] === undefined) continue;
        const dd = JE.angDiff(deg, state.natal.positions[k]);
        if (dd < bestD) { bestD = dd; best = k; }
      }
      if (!best) return null;
      const meta = JE.PLANET_MAP[best];
      const d = state.natal.details[best];
      const dig = best === "Lagna" ? { label: "Ascendant · 1st House" } : JE.getDignity(best, d.rasiIdx);
      return {
        type: "natal",
        data: best,
        telemetryHtml: `<span class="tel-badge">NATAL ${best.toUpperCase()}</span> <b>${meta.sym} ${d.rasi.glyph} ${d.rasi.sanskrit} ${JE.fmtDM(d.degInRasi)}</b> <span class="tel-sep">·</span> ${d.nak.name} P${d.padaNum} (#${d.pada.num}) <span class="tel-sep">·</span> Navamsa: ${d.navamsa.sanskrit} <span class="tel-sep">·</span> ${dig.label}`,
        loreHtml: `
          <div class="lore-head" style="color:${meta.color}">🔒 Natal ${best} (${meta.dev})</div>
          <div class="lore-grid">
            <span>Locked Pos</span><b>${d.rasi.glyph} ${d.rasi.sanskrit} ${JE.fmtDMS(d.degInRasi)}</b>
            <span>Nakshatra</span><b>${d.nak.name} · P${d.padaNum} (#${d.pada.num}/108)</b>
            <span>Navamsa</span><b>${d.navamsa.sanskrit} · ${dig.label}</b>
          </div>
        `,
      };
    }
    return null;
  }

  function updateHoverTelemetry(hit) {
    // In Zen Mode, route hover telemetry cleanly into the fixed-height #zen-varga-bar (0px wheel movement!)
    if (state.zen) {
      updateZenVargaBar();
      return;
    }
    const bar = $("dial-telemetry-bar");
    const textEl = $("dial-telemetry-text") || bar;
    const legend = $("dial-legend");
    if (!bar || !legend) return;
    if (hit) {
      bar.hidden = false;
      legend.hidden = true;
      if (hit.telemetryHtml !== lastTelemetryHtml) {
        lastTelemetryHtml = hit.telemetryHtml;
        textEl.innerHTML = hit.telemetryHtml;
        applyInPlaceMarquee(bar, textEl);
      }
    } else {
      lastTelemetryHtml = "";
      bar.hidden = true;
      legend.hidden = false;
    }
  }

  function renderPinnedLore() {
    const card = $("pinned-lore");
    const body = $("pinned-lore-body");
    if (!card || !body) return;
    if (!state.pinned) {
      card.hidden = true;
      return;
    }
    body.innerHTML = state.pinned.loreHtml;
    card.hidden = false;
  }

  function handlePointerDown(e) {
    if (!canvas || !state.transit || e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = canvasSize / 2;
    const cy = canvasSize / 2;
    const R = canvasSize * 0.468;
    const { dist, a } = screenToSiderealDeg(cx, cy, mx, my);
    if (dist < R * 0.305 || dist > R * 1.05) return;

    crank.active = true;
    crank.moved = false;
    crank.wasPlaying = state.playing;
    crank.startX = e.clientX;
    crank.startY = e.clientY;
    crank.lastAngle = a;
    crank.accumDeg = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function handlePointerMove(e) {
    if (!canvas || !state.transit) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = canvasSize / 2;
    const cy = canvasSize / 2;

    if (crank.active) {
      const dragDist = Math.hypot(e.clientX - crank.startX, e.clientY - crank.startY);
      if (dragDist >= 5) {
        crank.moved = true;
        canvas.classList.add("is-cranking");
        const curA = Math.atan2(my - cy, mx - cx);
        let dRad = curA - crank.lastAngle;
        if (dRad > Math.PI) dRad -= Math.PI * 2;
        if (dRad < -Math.PI) dRad += Math.PI * 2;
        crank.lastAngle = curA;
        // Counter-clockwise drag advances zodiac forward in time; 360° crank = 1 solar year!
        const dDeg = -dRad / DEG;
        const dDays = dDeg * (365.25 / 360);
        state.simJD += dDays;
        state.gearAngle += dDays * 0.065;
        crank.accumDeg += Math.abs(dDeg);
        if (crank.accumDeg >= 4) {
          crank.accumDeg = 0;
          if (Audio) Audio.playRatchet();
        }
        state.trails = {};
        state.transit = JE.computeSiderealSnapshot(state.simJD, state.ayanamsa);
        state.panchanga = JE.computePanchanga(state.transit, state.simJD);
        state.dasha = (state.natal && state.natalJD !== null)
          ? JE.computeVimshottariDasha(state.natal.positions.Moon, state.natalJD, state.simJD)
          : null;
        state.activeEpoch = JE.getActiveLifeEpoch(state.transit, state.natal);
        evaluateAndTriggerTransits(state.transit, state.simJD, performance.now(), false, state.dasha);
        syncSidePanelUI();
      }
      return;
    }

    const hit = hitTestDial(mx, my);
    state.hovered = hit;
    updateHoverTelemetry(hit);
  }

  function handlePointerUp(e) {
    if (!crank.active) return;
    const wasMoved = crank.moved;
    crank.active = false;
    crank.moved = false;
    canvas.classList.remove("is-cranking");
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

    if (wasMoved) {
      state.lastCheckedDay = Math.floor(state.simJD);
      return;
    }

    // Clean click -> Pin or Dismiss Lore Card
    const rect = canvas.getBoundingClientRect();
    const hit = hitTestDial(e.clientX - rect.left, e.clientY - rect.top);
    state.pinned = hit;
    renderPinnedLore();
  }

  // ---------------------------------------------------------------------------
  // Theme, Zen Mode & Resize Setup
  // ---------------------------------------------------------------------------

  function applyTheme(nextTheme) {
    state.theme = nextTheme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = state.theme;
    try { localStorage.setItem("nakshatra-theme", state.theme); } catch (_) {}
    const btn = $("btn-theme");
    const zenTheme = $("zen-theme");
    const label = state.theme === "light" ? "☾ NIGHT" : "☀ DAY";
    if (btn) btn.textContent = label;
    if (zenTheme) {
      zenTheme.textContent = state.theme === "light" ? "☾" : "☀";
      zenTheme.title = state.theme === "light" ? "Switch to Night Obsidian theme" : "Switch to Daylight Brass theme";
    }
    staticCacheKey = "";
  }

  function setZenMode(on) {
    state.zen = Boolean(on);
    document.body.classList.toggle("is-zen", state.zen);
    const btn = $("btn-zen");
    if (btn) btn.textContent = state.zen ? "✕ EXIT ZEN" : "⛶ ZEN";
    const dock = $("zen-dock");
    if (dock) dock.hidden = !state.zen;
    requestAnimationFrame(() => {
      resizeCanvas();
      if (state.zen) updateZenVargaBar(true);
    });
  }

  function resizeCanvas() {
    if (!canvas) return;
    const stage = canvas.parentElement;
    const w = stage ? stage.clientWidth : 680;
    const maxCap = state.zen ? 860 : 696;
    const vMargin = state.zen ? 142 : 114;
    const h = window.innerHeight ? Math.min(maxCap, window.innerHeight - vMargin) : 680;
    const target = Math.max(320, Math.min(maxCap, Math.floor(Math.min(w, h))));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasSize = target;
    canvas.style.width = `${target}px`;
    canvas.style.height = `${target}px`;
    canvas.width = Math.round(target * dpr);
    canvas.height = Math.round(target * dpr);
    staticCacheKey = "";
    if (state.zen) updateZenVargaBar(true);
  }

  function populateCityDatalist() {
    const dl = $("city-list");
    if (!dl) return;
    dl.innerHTML = JE.CITIES.map((c) => `<option value="${c.name}"></option>`).join("");
  }

  function loadSavedPreferences() {
    try {
      const savedTheme = localStorage.getItem("nakshatra-theme");
      if (savedTheme === "light" || savedTheme === "dark") state.theme = savedTheme;
    } catch (_) {}
    applyTheme(state.theme);

    try {
      const raw = localStorage.getItem("nakshatra-cosmic-birth");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && saved.date && saved.lat !== undefined) {
        // Heal legacy raw-coord numeric tz values (e.g. India +5 -> Asia/Kolkata +5:30)
        if (typeof saved.tz !== "string" || !saved.tz.includes("/")) {
          const resolved = (saved.city && JE.findCity(saved.city)) || null;
          saved.tz = (resolved && resolved.tz) || (JE.inferTzForCoords ? JE.inferTzForCoords(saved.lat, saved.lon) : saved.tz);
        }
        state.birthInput = saved;
        if ($("birth-date")) $("birth-date").value = saved.date;
        if ($("zen-birth-date")) $("zen-birth-date").value = saved.date;
        if ($("birth-time")) $("birth-time").value = saved.time || "06:30";
        if ($("zen-birth-time")) $("zen-birth-time").value = saved.time || "06:30";
        if ($("birth-city")) $("birth-city").value = saved.city || "Hyderabad, India";
        if ($("zen-birth-city")) $("zen-birth-city").value = saved.city || "Hyderabad, India";
        if ($("btn-unlock-natal")) $("btn-unlock-natal").hidden = false;
      }
    } catch (_) {}
  }

  function bindControls() {
    // Theme Toggle (Night <-> Day)
    const toggleTheme = () => applyTheme(state.theme === "dark" ? "light" : "dark");
    $("btn-theme")?.addEventListener("click", toggleTheme);
    $("zen-theme")?.addEventListener("click", toggleTheme);

    // Zen / Cinema Mode
    $("btn-zen")?.addEventListener("click", () => setZenMode(!state.zen));
    $("zen-exit")?.addEventListener("click", () => setZenMode(false));
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (document.activeElement && document.activeElement.id === "zen-birth-city") {
          document.activeElement.blur();
        } else if (state.pinned) {
          state.pinned = null;
          renderPinnedLore();
        } else if (state.zen) {
          setZenMode(false);
        }
      }
    });

    // Close Pinned Lore Card
    $("pinned-lore-close")?.addEventListener("click", () => {
      state.pinned = null;
      renderPinnedLore();
    });

    // Play / Pause
    const togglePlay = () => {
      state.playing = !state.playing;
      syncPlayButtons();
    };
    $("btn-play")?.addEventListener("click", togglePlay);
    $("zen-play")?.addEventListener("click", togglePlay);

    // Reverse / Forward (synced between Main & Zen decks)
    const toggleDir = () => {
      state.direction = -state.direction;
      const btnRev = $("btn-rev");
      const zenRev = $("zen-rev");
      if (btnRev) {
        btnRev.textContent = state.direction < 0 ? "◀ REV" : "FWD ▶";
        btnRev.classList.toggle("is-active", state.direction < 0);
      }
      if (zenRev) {
        zenRev.textContent = state.direction < 0 ? "REV" : "FWD";
        zenRev.classList.toggle("is-active", state.direction < 0);
      }
    };
    $("btn-rev")?.addEventListener("click", toggleDir);
    $("zen-rev")?.addEventListener("click", toggleDir);

    // Today & Birth buttons
    const jumpToday = () => jumpToJD(JE.dateToJD(new Date()), false);
    $("btn-today")?.addEventListener("click", jumpToday);
    $("zen-today")?.addEventListener("click", jumpToday);
    $("btn-birth")?.addEventListener("click", () => {
      if (state.natalJD === null) return;
      jumpToJD(state.natalJD, true);
      if (Audio) Audio.playNatalLock(true);
    });

    // Direct Date Picker
    const elJump = $("jump-date");
    if (elJump) {
      elJump.addEventListener("change", () => {
        const val = elJump.value;
        if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return;
        const [y, m, d] = val.split("-").map(Number);
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return;
        if (state.birthInput && state.birthInput.date === val && state.natalJD !== null) {
          jumpToJD(state.natalJD, true);
        } else {
          jumpToJD(JE.ymdhmsToJD(y, m, d, 12), true);
        }
      });
    }

    // Time Step Buttons (-1Y, -1M, +1M, +1Y)
    document.querySelectorAll("[data-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const spec = btn.getAttribute("data-step") || "";
        const m = spec.match(/^([+-]?\d+)([dmy])$/);
        if (m) stepByUnit(m[2], Number(m[1]));
      });
    });

    // Speed buttons: DAY / WEEK / MONTH
    document.querySelectorAll("[data-speed]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sp = btn.getAttribute("data-speed");
        if (!SPEED_MAP[sp]) return;
        state.speed = sp;
        document.querySelectorAll("[data-speed]").forEach((b) => {
          b.classList.toggle("is-active", b.getAttribute("data-speed") === sp);
        });
      });
    });

    // Drishti Optical Lens Toggle
    document.querySelectorAll("[data-lens]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ln = btn.getAttribute("data-lens");
        if (!ln) return;
        state.lens = ln;
        document.querySelectorAll("[data-lens]").forEach((b) => {
          b.classList.toggle("is-active", b.getAttribute("data-lens") === ln);
        });
      });
    });

    // Ayanamsa Toggle: CHITRAPAKSHA (LAHIRI) <-> B.V. RAMAN (synced across Main Console & Zen Deck)
    document.querySelectorAll("[data-ayanamsa]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-ayanamsa");
        if (mode !== "lahiri" && mode !== "raman") return;
        if (state.ayanamsa === mode) return;
        state.ayanamsa = mode;
        document.querySelectorAll("[data-ayanamsa]").forEach((b) => {
          b.classList.toggle("is-active", b.getAttribute("data-ayanamsa") === mode);
        });
        recomputeForAyanamsaOrNatal("ayanamsa");
      });
    });

    // Bidirectional Lifespan Scrubbers (Main Console & Stabilized Zen Deck)
    const bindScrubber = (el) => {
      if (!el) return;
      let dragBounds = null;
      el.addEventListener("pointerdown", () => { dragBounds = getTimelineBounds(); });
      el.addEventListener("input", () => {
        const b = dragBounds || getTimelineBounds();
        const frac = Number(el.value) / 10000;
        jumpToJD(b.minJD + frac * (b.maxJD - b.minJD), false);
      });
      const clearDrag = () => { dragBounds = null; };
      el.addEventListener("change", clearDrag);
      el.addEventListener("pointerup", clearDrag);
    };
    bindScrubber($("timeline-scrubber"));
    bindScrubber($("zen-scrubber"));

    // Clickable & Hoverable ▼ Triple Transit Timeline Markers (Main & Zen)
    const bindTripleMarkerHost = (host, isZenHost) => {
      if (!host) return;
      const showMarker = (btn) => {
        const idx = Number(btn.getAttribute("data-tt-idx"));
        const w = state.tripleWindows[idx];
        if (!w) return;
        state.hoveredMarker = w;
        if (isZenHost || state.zen) {
          updateZenVargaBar();
        } else {
          const d1 = formatMonthYear(w.startJD);
          const d2 = formatMonthYear(w.endJD);
          const spanStr = d1 === d2 ? d1 : `${d1}–${d2}`;
          updateHoverTelemetry({
            telemetryHtml: `<span class="tel-gan">✦ ${spanStr}</span> ${w.vargaSummary}`,
          });
        }
      };
      const clearMarker = () => {
        state.hoveredMarker = null;
        if (isZenHost || state.zen) updateZenVargaBar();
        else updateHoverTelemetry(null);
      };
      host.addEventListener("mouseover", (e) => {
        const btn = e.target.closest("[data-tt-idx]");
        if (btn) showMarker(btn);
      });
      host.addEventListener("focusin", (e) => {
        const btn = e.target.closest("[data-tt-idx]");
        if (btn) showMarker(btn);
      });
      host.addEventListener("mouseleave", clearMarker);
      host.addEventListener("focusout", clearMarker);
      host.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tt-idx]");
        if (!btn) return;
        const idx = Number(btn.getAttribute("data-tt-idx"));
        const w = state.tripleWindows[idx];
        if (!w) return;
        jumpToJD(w.peakJD, true);
        // Pause gently on click so user can inspect the Triple Transit & D1-D60 summary peacefully
        state.playing = false;
        syncPlayButtons();
        updateZenVargaBar();
      });
    };
    bindTripleMarkerHost($("main-triple-markers"), false);
    bindTripleMarkerHost($("zen-triple-markers"), true);

    // Synced Tabla & Tanpura Soundscape Controls (Main Console + Zen Deck, ON by default)
    const btnSound = $("btn-sound");
    const zenSound = $("zen-sound");
    const syncSoundButtons = (m) => {
      if (btnSound) {
        btnSound.textContent = m === "full" ? "🔊 MUSIC" : (m === "mech" ? "⚙ CHIMES" : "🔇 MUTE");
        btnSound.classList.toggle("is-active", m !== "off");
      }
      if (zenSound) {
        zenSound.textContent = m === "off" ? "🔇" : (m === "mech" ? "⚙" : "🔊");
        zenSound.classList.toggle("is-active", m !== "off");
        zenSound.title = m === "off"
          ? "Turn Tabla & Tanpura cosmic ambience ON"
          : "Turn background sound OFF";
      }
    };
    if (Audio) {
      Audio.onChange((m) => syncSoundButtons(m));
      btnSound?.addEventListener("click", () => Audio.cycleMode());
      zenSound?.addEventListener("click", () => Audio.toggleMusic());
    }

    // Inline Birth Date, Local Time & Place Editor right inside the Zen Mode bottom toolbar!
    const zenBirth = $("zen-birth-date");
    const zenTime = $("zen-birth-time");
    const zenCity = $("zen-birth-city");
    const applyZenBirthInputs = () => {
      const dateVal = zenBirth?.value || $("birth-date")?.value;
      const timeVal = zenTime?.value || $("birth-time")?.value || "06:30";
      const cityRaw = (zenCity?.value || $("birth-city")?.value || "Hyderabad, India").trim();
      if (!dateVal || !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return;
      if (!/^\d{2}:\d{2}/.test(timeVal)) return;
      const cityObj = JE.findCity(cityRaw);
      if (!cityObj) {
        if (zenCity) zenCity.classList.add("is-invalid");
        return;
      }
      if (zenCity) {
        zenCity.classList.remove("is-invalid");
        zenCity.value = cityObj.name;
      }
      if ($("birth-date")) $("birth-date").value = dateVal;
      if ($("birth-time")) $("birth-time").value = timeVal;
      if ($("birth-city")) $("birth-city").value = cityObj.name;
      if ($("birth-error")) $("birth-error").textContent = "";
      state.birthInput = {
        date: dateVal,
        time: timeVal,
        city: cityObj.name,
        lat: cityObj.lat,
        lon: cityObj.lon,
        tz: cityObj.tz,
      };
      try { localStorage.setItem("nakshatra-cosmic-birth", JSON.stringify(state.birthInput)); } catch (_) {}
      if ($("btn-unlock-natal")) $("btn-unlock-natal").hidden = false;
      state.eventLog = [];
      recomputeForAyanamsaOrNatal("lock");
    };
    zenBirth?.addEventListener("change", applyZenBirthInputs);
    zenTime?.addEventListener("change", applyZenBirthInputs);
    zenCity?.addEventListener("change", applyZenBirthInputs);
    zenCity?.addEventListener("input", () => zenCity.classList.remove("is-invalid"));
    zenCity?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyZenBirthInputs();
        zenCity.blur();
      }
    });

    // Prev / Next Convergence Scanners (Main & Zen)
    const jumpPrevConv = () => {
      const hit = JE.findPrevConvergence(state.simJD, state.natal, state.ayanamsa, 1825, state.natalJD);
      if (hit) jumpToJD(hit.jd, true);
    };
    const jumpNextConv = () => {
      const hit = JE.findNextConvergence(state.simJD, state.natal, state.ayanamsa, 1825);
      if (hit) jumpToJD(hit.jd, true);
    };
    $("btn-prev-transit")?.addEventListener("click", jumpPrevConv);
    $("zen-prev-transit")?.addEventListener("click", jumpPrevConv);
    $("btn-next-transit")?.addEventListener("click", jumpNextConv);
    $("zen-next-transit")?.addEventListener("click", jumpNextConv);

    // Birth Form Lock / Sample / Unlock
    const form = $("birth-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const date = $("birth-date")?.value;
        const time = $("birth-time")?.value || "12:00";
        const cityStr = $("birth-city")?.value || "Hyderabad, India";
        const errEl = $("birth-error");
        if (!date) { if (errEl) errEl.textContent = "Enter a birth date."; return; }
        const cityObj = JE.findCity(cityStr);
        if (!cityObj) {
          if (errEl) errEl.textContent = "City not found — pick from list or enter lat, lon.";
          return;
        }
        if (errEl) errEl.textContent = "";
        state.birthInput = { date, time, city: cityObj.name, lat: cityObj.lat, lon: cityObj.lon, tz: cityObj.tz };
        if ($("zen-birth-date")) $("zen-birth-date").value = date;
        if ($("zen-birth-time")) $("zen-birth-time").value = time;
        if ($("zen-birth-city")) {
          $("zen-birth-city").value = cityObj.name;
          $("zen-birth-city").classList.remove("is-invalid");
        }
        try { localStorage.setItem("nakshatra-cosmic-birth", JSON.stringify(state.birthInput)); } catch (_) {}
        if ($("btn-unlock-natal")) $("btn-unlock-natal").hidden = false;
        state.eventLog = [];
        recomputeForAyanamsaOrNatal("lock");
      });

      // Keep Ascendant & Natal pins live-synced whenever birth date, time, or city changes while locked
      ["birth-date", "birth-time", "birth-city"].forEach((id) => {
        $(id)?.addEventListener("change", () => {
          if (id === "birth-date" && $("zen-birth-date") && $("birth-date").value) {
            $("zen-birth-date").value = $("birth-date").value;
          }
          if (id === "birth-time" && $("zen-birth-time") && $("birth-time").value) {
            $("zen-birth-time").value = $("birth-time").value;
          }
          if (id === "birth-city" && $("zen-birth-city") && $("birth-city").value) {
            $("zen-birth-city").value = $("birth-city").value;
          }
          if (state.birthInput) {
            form.dispatchEvent(new Event("submit", { cancelable: true }));
          }
        });
      });
    }

    $("btn-sample-birth")?.addEventListener("click", () => {
      if ($("birth-date")) $("birth-date").value = "1988-08-15";
      if ($("birth-time")) $("birth-time").value = "06:30";
      if ($("birth-city")) $("birth-city").value = "Hyderabad, India";
      $("birth-form")?.dispatchEvent(new Event("submit", { cancelable: true }));
    });

    const btnUnlock = $("btn-unlock-natal");
    if (btnUnlock) {
      btnUnlock.addEventListener("click", () => {
        state.birthInput = null;
        try { localStorage.removeItem("nakshatra-cosmic-birth"); } catch (_) {}
        btnUnlock.hidden = true;
        state.eventLog = [];
        recomputeForAyanamsaOrNatal("unlock");
      });
    }

    // Event log row click -> jump directly to date
    $("transit-log-list")?.addEventListener("click", (e) => {
      const li = e.target.closest("[data-jd]");
      if (!li) return;
      const jd = Number(li.getAttribute("data-jd"));
      if (Number.isFinite(jd)) jumpToJD(jd, true);
    });

    // Canvas pointer interactions (Hover Telemetry + Click-to-Pin + Grab-and-Spin Crank)
    if (canvas) {
      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("pointermove", handlePointerMove);
      canvas.addEventListener("pointerup", handlePointerUp);
      canvas.addEventListener("pointercancel", handlePointerUp);
      canvas.addEventListener("pointerleave", () => {
        if (!crank.active) {
          state.hovered = null;
          updateHoverTelemetry(null);
        }
      });
    }

    window.addEventListener("resize", resizeCanvas);
  }

  function init() {
    canvas = $("cosmicDialCanvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    populateCityDatalist();
    loadSavedPreferences();
    resizeCanvas();
    bindControls();
    recomputeForAyanamsaOrNatal(null);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { staticCacheKey = ""; });
    }
    state.lastFrameMs = performance.now();
    requestAnimationFrame(tickLoop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
