/**
 * Nakshatra Chakram — Formidable Metallic Cosmic Dial Renderer & Interactive Controller
 *
 * 60 FPS high-DPI canvas cosmic astrolabe displaying:
 *   - Counter-rotating machined brass/iron gears driven by solar motion
 *   - All 108 Nakshatra Padas (3°20′ etched metallic cells with Gandanta seams & Pada numerals)
 *   - All 27 Nakshatras (Devanagari + English curved engravings & ruler patina)
 *   - All 9 Transiting Navagrahas with orbital motion trails, Solar Meridian Beam & retrograde halos
 *   - All 12 Rasis with elemental metallic alloys (Agni, Prithvi, Vayu, Jala) & Roman Bhava markers
 *   - Locked Natal Planetary Pins (riveted brass markers + radial Pada anchor hairlines)
 *   - Double & Triple Transit Drishti energy arcs, shockwaves, annunciator, and Web Audio gongs/bells
 */
(function () {
  "use strict";

  const JE = window.JyotishEngine;
  const Audio = window.CosmicAudio;
  if (!JE) return;

  const DEG = Math.PI / 180;
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  // Patinated metallic alloy palettes per Nakshatra Vimshottari ruler
  const RULER_METAL = {
    Ketu:    { fill: "#1b1126", rim: "#7d4ea8" },
    Venus:   { fill: "#211221", rim: "#b55284" },
    Sun:     { fill: "#26180c", rim: "#cc8632" },
    Moon:    { fill: "#161c28", rim: "#8599b8" },
    Mars:    { fill: "#281110", rim: "#c44b3b" },
    Rahu:    { fill: "#121329", rim: "#6c63c9" },
    Jupiter: { fill: "#221d0c", rim: "#cca635" },
    Saturn:  { fill: "#101824", rim: "#5b79a3" },
    Mercury: { fill: "#0e1f1a", rim: "#3d9c7e" },
  };

  // Patinated metallic alloy palettes per Vedic Element (Agni, Prithvi, Vayu, Jala)
  const ELEM_ALLOY = [
    { top: "#2c1412", bot: "#170908", rim: "#a64d36", text: "#f2b89b", glow: "rgba(235,105,65,0.45)" }, // Agni (Fire)
    { top: "#12241b", bot: "#09140e", rim: "#4b8a66", text: "#a8e0be", glow: "rgba(92,190,130,0.40)" }, // Prithvi (Earth)
    { top: "#262112", bot: "#141109", rim: "#a88c42", text: "#f0da9c", glow: "rgba(230,190,90,0.42)" }, // Vayu (Air)
    { top: "#101d30", bot: "#08101c", rim: "#4975a8", text: "#a9ccf2", glow: "rgba(95,160,235,0.42)" }, // Jala (Water)
  ];

  // Speed presets (simulated days per real-world second)
  const SPEED_MAP = {
    day:   { daysPerSec: 1.0,  label: "1 DAY / SEC" },
    week:  { daysPerSec: 7.0,  label: "1 WEEK / SEC" },
    month: { daysPerSec: 30.0, label: "1 MONTH / SEC" },
  };

  // ---------------------------------------------------------------------------
  // Application State
  // ---------------------------------------------------------------------------

  const state = {
    ayanamsa: "lahiri",        // "lahiri" | "raman"
    speed: "week",             // "day" | "week" | "month"
    playing: true,
    direction: 1,              // 1 forward, -1 reverse
    simJD: JE.dateToJD(new Date()),
    lastCheckedDay: Math.floor(JE.dateToJD(new Date())),
    birthInput: null,          // { name, date, time, city, lat, lon, tz }
    natal: null,               // computeSiderealSnapshot result
    transit: null,             // current computeSiderealSnapshot result
    analysis: { triples: [], doubles: [], padaHits: [] },
    activeEventKeys: new Set(),
    eventLog: [],
    shockwaves: [],            // { rasiIdx, tier, bornAt, color }
    trails: {},                // planetId -> [{ deg }]
    hovered: null,             // { type: "pada"|"nak"|"rasi"|"planet", data, x, y }
    zenithDeg: 15,             // smooth animated top degree
    targetZenithDeg: 15,
    gearAngle: 0,
    lastFrameMs: performance.now(),
    lastUiUpdateMs: 0,
  };

  // Cached offscreen forged-metal static dial
  let staticCanvas = null;
  let staticCacheKey = "";
  let canvas = null;
  let ctx = null;
  let canvasSize = 680;
  let dpr = 1;

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
    // Inverse of: a = -(deg - zenith)*DEG - PI/2
    const deg = JE.norm360(state.zenithDeg - (a + Math.PI / 2) / DEG);
    return { deg, dist };
  }

  function drawWedge(c, cx, cy, r1, r2, sDeg, eDeg) {
    const a1 = dToRad(sDeg);
    const a2 = dToRad(eDeg);
    c.beginPath();
    // Since angles go counter-clockwise as sidereal deg increases, anticlockwise = true for outer arc
    c.arc(cx, cy, r2, a1, a2, true);
    c.arc(cx, cy, r1, a2, a1, false);
    c.closePath();
  }

  function drawArcLabel(c, text, cx, cy, r, midDeg, font, fill) {
    const { x, y, a } = polar(cx, cy, r, midDeg);
    let rot = a + Math.PI / 2;
    const normRot = ((rot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (normRot > Math.PI / 2 && normRot < (3 * Math.PI) / 2) {
      rot += Math.PI;
    }
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.font = font;
    c.fillStyle = fill;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 0, 0);
    c.restore();
  }

  function drawGear(c, cx, cy, outerR, innerR, teeth, toothDepth, angle, fillStyle, strokeStyle) {
    c.save();
    c.translate(cx, cy);
    c.rotate(angle);
    c.beginPath();
    const step = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const a0 = i * step;
      const a1 = a0 + step * 0.22;
      const a2 = a0 + step * 0.30;
      const a3 = a0 + step * 0.62;
      const a4 = a0 + step * 0.70;
      const rLow = outerR - toothDepth;
      if (i === 0) c.moveTo(Math.cos(a0) * rLow, Math.sin(a0) * rLow);
      else c.lineTo(Math.cos(a0) * rLow, Math.sin(a0) * rLow);
      c.lineTo(Math.cos(a1) * rLow, Math.sin(a1) * rLow);
      c.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
      c.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
      c.lineTo(Math.cos(a4) * rLow, Math.sin(a4) * rLow);
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
  // Offscreen Forged Metallic Static Dial Builder (Rebuilt on resize/rotation)
  // ---------------------------------------------------------------------------

  function ensureStaticLayer(size, pixelRatio) {
    const zKey = state.zenithDeg.toFixed(2);
    const natKey = state.natal ? `${state.natal.details.Lagna ? state.natal.details.Lagna.rasiIdx : -1}` : "sky";
    const key = `${size}:${pixelRatio}:${zKey}:${natKey}:${state.ayanamsa}`;
    if (staticCanvas && staticCacheKey === key) return staticCanvas;

    if (!staticCanvas) staticCanvas = document.createElement("canvas");
    staticCanvas.width = Math.round(size * pixelRatio);
    staticCanvas.height = Math.round(size * pixelRatio);
    const sc = staticCanvas.getContext("2d");
    sc.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.468; // leave crisp margin for protruding outer gear teeth & glow

    // 1. Heavy Gunmetal Outer Bezel Rim (R * 0.945 -> R * 1.00)
    const rimGrad = sc.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.65, cx, cy, R * 1.01);
    rimGrad.addColorStop(0, "#2b3040");
    rimGrad.addColorStop(0.55, "#151923");
    rimGrad.addColorStop(0.88, "#0c0e15");
    rimGrad.addColorStop(1, "#262018");
    sc.beginPath();
    sc.arc(cx, cy, R, 0, Math.PI * 2);
    sc.fillStyle = rimGrad;
    sc.fill();

    // Chamfered Brass Outer Ring
    const brassRing = sc.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    brassRing.addColorStop(0, "#e5c173");
    brassRing.addColorStop(0.28, "#8f692c");
    brassRing.addColorStop(0.52, "#f2d692");
    brassRing.addColorStop(0.76, "#66481a");
    brassRing.addColorStop(1, "#cfa355");
    sc.beginPath();
    sc.arc(cx, cy, R - 1.5, 0, Math.PI * 2);
    sc.strokeStyle = brassRing;
    sc.lineWidth = 3;
    sc.stroke();

    // 36 Machined Brass Perimeter Rivets + 360 Vernier Degree Ticks
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
      sc.strokeStyle = isMajor ? "rgba(235,198,118,0.85)" : (isFive ? "rgba(198,162,92,0.45)" : "rgba(160,145,115,0.22)");
      sc.lineWidth = isMajor ? 1.5 : 0.8;
      sc.stroke();

      if (isTen) {
        const rv = polar(cx, cy, R * 0.976, deg + 5);
        const rg = sc.createRadialGradient(rv.x - 1, rv.y - 1, 0.4, rv.x, rv.y, 2.8);
        rg.addColorStop(0, "#f3d796");
        rg.addColorStop(0.55, "#8c6628");
        rg.addColorStop(1, "#2a1e0c");
        sc.beginPath();
        sc.arc(rv.x, rv.y, 2.4, 0, Math.PI * 2);
        sc.fillStyle = rg;
        sc.fill();
      }
    }

    // 2. Ring 1: All 108 Nakshatra Padas (R * 0.842 -> R * 0.940)
    const rPadaIn = R * 0.842;
    const rPadaOut = R * 0.940;
    const padaFont = `600 ${Math.max(6.5, size * 0.0112).toFixed(1)}px "JetBrains Mono", monospace`;

    for (let i = 0; i < 108; i++) {
      const p = JE.PADAS[i];
      const rm = RULER_METAL[p.nak.ruler];
      drawWedge(sc, cx, cy, rPadaIn, rPadaOut, p.startDeg, p.endDeg);
      sc.fillStyle = (i % 2 === 0) ? "#11141e" : "#151926";
      sc.fill();

      // Subtle outer accent band tinted by Nakshatra ruler
      drawWedge(sc, cx, cy, rPadaOut - R * 0.014, rPadaOut, p.startDeg, p.endDeg);
      sc.fillStyle = rm.rim + "44";
      sc.fill();

      // Gandanta ember seam (Revati 4 / Ashwini 1, Ashlesha 4 / Magha 1, Jyeshtha 4 / Mula 1)
      if (p.isGandanta) {
        drawWedge(sc, cx, cy, rPadaIn, rPadaOut, p.startDeg, p.endDeg);
        sc.fillStyle = "rgba(255, 86, 36, 0.14)";
        sc.fill();
      }

      // Pada divider line
      const lineStart = polar(cx, cy, rPadaIn, p.startDeg);
      const lineEnd = polar(cx, cy, rPadaOut, p.startDeg);
      const isNakBoundary = (i % 4 === 0);
      const isRasiBoundary = (i % 9 === 0);
      sc.beginPath();
      sc.moveTo(lineStart.x, lineStart.y);
      sc.lineTo(lineEnd.x, lineEnd.y);
      sc.strokeStyle = isRasiBoundary
        ? "rgba(232, 190, 108, 0.72)"
        : (isNakBoundary ? "rgba(196, 158, 92, 0.42)" : "rgba(130, 145, 175, 0.19)");
      sc.lineWidth = isRasiBoundary ? 1.4 : (isNakBoundary ? 0.95 : 0.55);
      sc.stroke();

      // Engraved Pada numeral (1, 2, 3, 4)
      drawArcLabel(sc, String(p.padaNum), cx, cy, (rPadaIn + rPadaOut) * 0.494, p.midDeg, padaFont, p.isGandanta ? "rgba(255,152,102,0.85)" : "rgba(182,175,160,0.68)");
    }

    // Metallic groove between 108-Pada ring and 27-Nakshatra ring
    sc.beginPath();
    sc.arc(cx, cy, rPadaOut, 0, Math.PI * 2);
    sc.strokeStyle = "rgba(218,176,98,0.55)";
    sc.lineWidth = 1.4;
    sc.stroke();

    // 3. Ring 2: The 27 Nakshatras (R * 0.718 -> R * 0.842)
    const rNakIn = R * 0.718;
    const rNakOut = rPadaIn;
    const nakEngFont = `700 ${Math.max(7.2, size * 0.0122).toFixed(1)}px "Cinzel", serif`;
    const nakDevFont = `500 ${Math.max(6.8, size * 0.0112).toFixed(1)}px "Noto Sans Devanagari", sans-serif`;

    for (let i = 0; i < 27; i++) {
      const nak = JE.NAKSHATRAS[i];
      const sDeg = i * (360 / 27);
      const eDeg = (i + 1) * (360 / 27);
      const mid = (sDeg + eDeg) / 2;
      const rm = RULER_METAL[nak.ruler];

      drawWedge(sc, cx, cy, rNakIn, rNakOut, sDeg, eDeg);
      sc.fillStyle = rm.fill;
      sc.fill();
      sc.strokeStyle = "rgba(202, 168, 98, 0.26)";
      sc.lineWidth = 0.85;
      sc.stroke();

      // Engraved Nakshatra Devanagari (outer) + Short/Clean English (inner)
      drawArcLabel(sc, nak.dev, cx, cy, rNakIn + (rNakOut - rNakIn) * 0.68, mid, nakDevFont, "rgba(232, 214, 178, 0.82)");
      drawArcLabel(sc, nak.short.toUpperCase(), cx, cy, rNakIn + (rNakOut - rNakIn) * 0.31, mid, nakEngFont, "rgba(218, 178, 102, 0.92)");
    }

    // Incandescent Gandanta fault radial notches at 0°, 120°, 240°
    for (const gDeg of [0, 120, 240]) {
      const a = polar(cx, cy, rNakIn, gDeg);
      const b = polar(cx, cy, rPadaOut, gDeg);
      sc.beginPath();
      sc.moveTo(a.x, a.y);
      sc.lineTo(b.x, b.y);
      sc.strokeStyle = "rgba(255, 108, 56, 0.82)";
      sc.lineWidth = 1.8;
      sc.stroke();
    }

    // Brass dividing ring between Nakshatras & Transit Track
    sc.beginPath();
    sc.arc(cx, cy, rNakIn, 0, Math.PI * 2);
    sc.strokeStyle = brassRing;
    sc.lineWidth = 2.0;
    sc.stroke();

    // 4. Ring 3: Recessed Machined Orbital Channel for Transiting Navagrahas (R * 0.562 -> R * 0.718)
    const rTransIn = R * 0.562;
    const rTransOut = rNakIn;
    const trackGrad = sc.createRadialGradient(cx, cy, rTransIn, cx, cy, rTransOut);
    trackGrad.addColorStop(0, "#070910");
    trackGrad.addColorStop(0.5, "#0d111b");
    trackGrad.addColorStop(1, "#080a12");
    sc.beginPath();
    sc.arc(cx, cy, rTransOut, 0, Math.PI * 2);
    sc.arc(cx, cy, rTransIn, 0, Math.PI * 2, true);
    sc.fillStyle = trackGrad;
    sc.fill("evenodd");

    // Subtle concentric lathe grooves inside the orbital trough
    for (const frac of [0.60, 0.64, 0.68]) {
      sc.beginPath();
      sc.arc(cx, cy, R * frac, 0, Math.PI * 2);
      sc.strokeStyle = "rgba(180, 160, 120, 0.09)";
      sc.lineWidth = 0.8;
      sc.stroke();
    }
    // Rasi radial spokes faintly etched across the orbital trough
    for (let i = 0; i < 12; i++) {
      const p1 = polar(cx, cy, rTransIn, i * 30);
      const p2 = polar(cx, cy, rTransOut, i * 30);
      sc.beginPath();
      sc.moveTo(p1.x, p1.y);
      sc.lineTo(p2.x, p2.y);
      sc.strokeStyle = "rgba(208, 170, 96, 0.16)";
      sc.lineWidth = 0.9;
      sc.stroke();
    }

    // 5. Ring 4: The 12 Rasis — Elemental Metallic Plates (R * 0.422 -> R * 0.562)
    const rRasiIn = R * 0.422;
    const rRasiOut = rTransIn;
    const rasiGlyphFont = `600 ${Math.max(12, size * 0.022).toFixed(1)}px "DM Sans", sans-serif`;
    const rasiNameFont = `700 ${Math.max(7.2, size * 0.012).toFixed(1)}px "Cinzel", serif`;
    const rasiDevFont = `500 ${Math.max(7, size * 0.0115).toFixed(1)}px "Noto Sans Devanagari", sans-serif`;
    const bhavaFont = `700 ${Math.max(7, size * 0.011).toFixed(1)}px "Cinzel", serif`;
    const lagnaIdx = (state.natal && state.natal.details.Lagna) ? state.natal.details.Lagna.rasiIdx : null;

    for (let i = 0; i < 12; i++) {
      const rasi = JE.RASIS[i];
      const ea = ELEM_ALLOY[rasi.elIdx];
      const sDeg = i * 30;
      const eDeg = sDeg + 30;
      const mid = sDeg + 15;

      drawWedge(sc, cx, cy, rRasiIn, rRasiOut, sDeg, eDeg);
      const rg = sc.createRadialGradient(cx, cy, rRasiIn, cx, cy, rRasiOut);
      rg.addColorStop(0, ea.bot);
      rg.addColorStop(1, ea.top);
      sc.fillStyle = rg;
      sc.fill();
      sc.strokeStyle = ea.rim + "99";
      sc.lineWidth = 1.25;
      sc.stroke();

      // Element inner highlight arc
      drawWedge(sc, cx, cy, rRasiOut - R * 0.012, rRasiOut, sDeg, eDeg);
      sc.fillStyle = ea.rim + "40";
      sc.fill();

      drawArcLabel(sc, `${rasi.glyph} ${rasi.dev}`, cx, cy, rRasiIn + (rRasiOut - rRasiIn) * 0.67, mid, rasiDevFont, ea.text);
      drawArcLabel(sc, rasi.sanskrit.toUpperCase(), cx, cy, rRasiIn + (rRasiOut - rRasiIn) * 0.34, mid, rasiNameFont, "rgba(235,214,172,0.88)");

      // When natal chart is locked, etch Roman Bhava numeral (I..XII) cleanly inside each Rasi plate
      if (lagnaIdx !== null) {
        const bhavaNum = ((i - lagnaIdx) % 12 + 12) % 12;
        const bp = polar(cx, cy, rRasiIn + R * 0.022, sDeg + 5.5);
        sc.font = bhavaFont;
        sc.fillStyle = bhavaNum === 0 ? "#ffd43b" : "rgba(218,184,114,0.62)";
        sc.textAlign = "center";
        sc.textBaseline = "middle";
        sc.fillText(ROMAN[bhavaNum], bp.x, bp.y);
      }
    }

    // Brass Structural Ring separating Rasis & Natal Track
    sc.beginPath();
    sc.arc(cx, cy, rRasiOut, 0, Math.PI * 2);
    sc.strokeStyle = brassRing;
    sc.lineWidth = 2.0;
    sc.stroke();
    sc.beginPath();
    sc.arc(cx, cy, rRasiIn, 0, Math.PI * 2);
    sc.strokeStyle = "rgba(208,168,94,0.65)";
    sc.lineWidth = 1.5;
    sc.stroke();

    // 6. Ring 5: Recessed Locked Natal Pin Track (R * 0.305 -> R * 0.422)
    const rNatalIn = R * 0.305;
    const natalGrad = sc.createRadialGradient(cx, cy, rNatalIn, cx, cy, rRasiIn);
    natalGrad.addColorStop(0, "#0b0d14");
    natalGrad.addColorStop(0.5, "#121622");
    natalGrad.addColorStop(1, "#090b12");
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
      sc.strokeStyle = "rgba(212,172,96,0.14)";
      sc.lineWidth = 0.8;
      sc.stroke();
    }

    // Inner obsidian core rim
    sc.beginPath();
    sc.arc(cx, cy, rNatalIn, 0, Math.PI * 2);
    sc.strokeStyle = brassRing;
    sc.lineWidth = 2.2;
    sc.stroke();

    // Subtle radial metallic specular sweep across the whole forged disk
    const sheen = sc.createLinearGradient(cx - R, cy - R, cx + R * 0.9, cy + R * 0.9);
    sheen.addColorStop(0, "rgba(255, 240, 200, 0.06)");
    sheen.addColorStop(0.32, "rgba(255, 255, 255, 0.0)");
    sheen.addColorStop(0.52, "rgba(240, 205, 130, 0.045)");
    sheen.addColorStop(0.75, "rgba(0, 0, 0, 0.08)");
    sheen.addColorStop(1, "rgba(255, 224, 160, 0.04)");
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
    const size = canvasSize;
    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.468;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // 1. Animated Counter-Rotating Machined Gears Peering Behind the Bezel
    const gGrad1 = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.055);
    gGrad1.addColorStop(0, "#3a2c16");
    gGrad1.addColorStop(0.6, "#8c682b");
    gGrad1.addColorStop(1, "#4a3514");
    drawGear(ctx, cx, cy, R * 1.045, R * 0.94, 72, R * 0.036, state.gearAngle * 0.4, gGrad1, "rgba(240,206,132,0.28)");

    // Subtle secondary dark iron gear
    drawGear(ctx, cx, cy, R * 1.022, R * 0.94, 54, R * 0.025, -state.gearAngle * 0.65, "rgba(38,44,58,0.85)", "rgba(160,175,205,0.16)");

    // Outer ambient cosmic aura around the heavy chassis
    const aura = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.08);
    const hasTriple = state.analysis.triples.length > 0;
    const hasDouble = state.analysis.doubles.length > 0;
    aura.addColorStop(0, "rgba(0,0,0,0)");
    aura.addColorStop(0.75, hasTriple ? "rgba(255, 92, 54, 0.14)" : (hasDouble ? "rgba(240, 186, 68, 0.11)" : "rgba(120, 145, 200, 0.06)"));
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
    ctx.fillStyle = aura;
    ctx.fill();

    // 2. Blit Cached Forged-Metal Static Dial
    const bg = ensureStaticLayer(size, dpr);
    ctx.drawImage(bg, 0, 0, size, size);

    // 3. Center Obsidian Chronometer Glass Dome + Internal Rotating Brass Orrery Gear
    const rCore = R * 0.303;
    const coreGrad = ctx.createRadialGradient(cx - rCore * 0.25, cy - rCore * 0.25, rCore * 0.05, cx, cy, rCore);
    coreGrad.addColorStop(0, "#141928");
    coreGrad.addColorStop(0.65, "#080a12");
    coreGrad.addColorStop(1, "#04050a");
    ctx.beginPath();
    ctx.arc(cx, cy, rCore, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Subtle internal animated brass escapement gears visible under obsidian glass
    drawGear(ctx, cx, cy, rCore * 0.92, rCore * 0.72, 36, rCore * 0.075, -state.gearAngle * 1.2, "rgba(184, 142, 66, 0.09)", "rgba(220, 180, 102, 0.14)");
    drawGear(ctx, cx, cy, rCore * 0.64, rCore * 0.46, 24, rCore * 0.065, state.gearAngle * 2.1, "rgba(120, 145, 190, 0.07)", "rgba(165, 190, 230, 0.10)");

    // 4. Illuminate Occupied 108-Pada Cells & Hovered Cell
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
      ctx.fillStyle = col + "38";
      ctx.fill();
      ctx.strokeStyle = col + "cc";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    if (state.hovered && state.hovered.type === "pada") {
      const hp = state.hovered.data;
      drawWedge(ctx, cx, cy, rPadaIn, rPadaOut, hp.startDeg, hp.endDeg);
      ctx.fillStyle = "rgba(255, 224, 130, 0.28)";
      ctx.fill();
      ctx.strokeStyle = "#ffe082";
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // 5. Illuminate Active Double / Triple Transit Rasis & Draw Drishti Energy Arcs!
    const pulse = 0.55 + 0.45 * Math.sin(nowMs * 0.0055);
    const activeEvents = [...state.analysis.triples, ...state.analysis.doubles].slice(0, 3);
    for (const ev of activeEvents) {
      const isTriple = ev.tier === "triple";
      const sDeg = ev.rasiIdx * 30;
      const eDeg = sDeg + 30;
      const targetMid = sDeg + 15;

      // Glowing activated Rasi plate
      drawWedge(ctx, cx, cy, R * 0.422, R * 0.562, sDeg, eDeg);
      ctx.fillStyle = isTriple
        ? `rgba(255, 96, 52, ${(0.18 + 0.16 * pulse).toFixed(3)})`
        : `rgba(248, 198, 72, ${(0.14 + 0.12 * pulse).toFixed(3)})`;
      ctx.fill();
      ctx.strokeStyle = isTriple ? "#ff7849" : "#ffd43b";
      ctx.lineWidth = isTriple ? 2.4 : 1.8;
      ctx.stroke();

      // Radiant Drishti energy beams from transiting Jupiter / Saturn / Rahu-Ketu -> Target Rasi!
      const tgtPt = polar(cx, cy, R * 0.422, targetMid);
      for (const asp of ev.aspects) {
        const pDeg = state.transit.positions[asp.planet];
        const pMeta = JE.PLANET_MAP[asp.planet];
        const srcPt = polar(cx, cy, R * 0.565, pDeg);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(srcPt.x, srcPt.y);
        // Curve gently through the obsidian aspect chamber
        ctx.quadraticCurveTo(cx, cy, tgtPt.x, tgtPt.y);
        ctx.strokeStyle = isTriple
          ? (asp.planet === "Jupiter" ? "rgba(255,212,59,0.75)" : (asp.planet === "Saturn" ? "rgba(148,185,240,0.72)" : "rgba(200,130,255,0.80)"))
          : (asp.planet === "Jupiter" ? "rgba(255,212,59,0.58)" : "rgba(148,185,240,0.56)");
        ctx.lineWidth = isTriple ? 2.1 : 1.5;
        ctx.shadowColor = pMeta.color;
        ctx.shadowBlur = isTriple ? 12 : 7;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Expanding shockwaves on newly triggered Double/Triple transits
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      const age = (nowMs - sw.bornAt) / 2200;
      if (age >= 1) {
        state.shockwaves.splice(i, 1);
        continue;
      }
      const rad = R * (0.30 + age * 0.72);
      const alpha = (1 - age) * (sw.tier === "triple" ? 0.72 : 0.52);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.strokeStyle = sw.tier === "triple" ? `rgba(255, 118, 68, ${alpha.toFixed(3)})` : `rgba(255, 212, 82, ${alpha.toFixed(3)})`;
      ctx.lineWidth = (1 - age) * (sw.tier === "triple" ? 4.5 : 3.0);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Radiant Solar Meridian Beam (visually tracks Sun darting across the 365-day zodiac)
    const sunDeg = state.transit.positions.Sun;
    const sunIn = polar(cx, cy, R * 0.562, sunDeg);
    const sunOut = polar(cx, cy, R * 0.945, sunDeg);
    ctx.save();
    const beamGrad = ctx.createLinearGradient(sunIn.x, sunIn.y, sunOut.x, sunOut.y);
    beamGrad.addColorStop(0, "rgba(255, 188, 60, 0.08)");
    beamGrad.addColorStop(0.45, "rgba(255, 200, 72, 0.55)");
    beamGrad.addColorStop(1, "rgba(255, 226, 130, 0.95)");
    ctx.beginPath();
    ctx.moveTo(sunIn.x, sunIn.y);
    ctx.lineTo(sunOut.x, sunOut.y);
    ctx.strokeStyle = beamGrad;
    ctx.lineWidth = 2.0;
    ctx.shadowColor = "#ffb636";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    // 7. Locked Natal Planetary Pins (Inner Recessed Track R * 0.305 -> R * 0.422)
    if (state.natal) {
      const natalKeys = ["Lagna", "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"]
        .filter((k) => state.natal.positions[k] !== undefined);
      const natalPlaced = stackPlanets(natalKeys.map((k) => ({ id: k, deg: state.natal.positions[k] })), [R * 0.365, R * 0.332, R * 0.398], 12);

      for (const item of natalPlaced) {
        const meta = JE.PLANET_MAP[item.id];
        const pt = polar(cx, cy, item.r, item.deg);
        const rimPt = polar(cx, cy, R * 0.842, item.deg);

        // Subtle golden anchor wire from locked natal pin out to its exact Pada!
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(rimPt.x, rimPt.y);
        ctx.strokeStyle = item.id === "Lagna" || item.id === "Moon"
          ? "rgba(255, 214, 102, 0.22)"
          : "rgba(218, 184, 114, 0.09)";
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.setLineDash([]);

        // Machined riveted ivory-brass natal pin
        const pinR = Math.max(7.2, size * 0.0125);
        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pinR, 0, Math.PI * 2);
        ctx.fillStyle = item.id === "Lagna" ? "#112824" : "#1c1710";
        ctx.fill();
        ctx.strokeStyle = item.id === "Lagna" ? "#63e6be" : "#e3ba64";
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

    // 8. Live Transiting Planets + Luminous Velocity Comet Trails (R * 0.562 -> R * 0.718)
    const transitPlaced = stackPlanets(
      JE.PLANETS.map((p) => ({ id: p.id, deg: state.transit.positions[p.id] })),
      [R * 0.640, R * 0.684, R * 0.596],
      10
    );

    // Draw orbital motion trails first
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
        ctx.strokeStyle = meta.color + Math.round(frac * 95).toString(16).padStart(2, "0");
        ctx.lineWidth = 1.1 + frac * 2.2;
        ctx.stroke();
      }
    }

    // Draw transiting planet medallions
    const orbR = Math.max(9.5, size * 0.0168);
    for (const item of transitPlaced) {
      const meta = JE.PLANET_MAP[item.id];
      const retro = state.transit.retrograde[item.id];
      const pt = polar(cx, cy, item.r, item.deg);
      const tickIn = polar(cx, cy, R * 0.718, item.deg);
      const tickOut = polar(cx, cy, R * 0.732, item.deg);

      // Precision brass index needle touching the Nakshatra border
      ctx.beginPath();
      ctx.moveTo(tickIn.x, tickIn.y);
      ctx.lineTo(tickOut.x, tickOut.y);
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      // Retrograde violet-amber halo
      if (retro && item.id !== "Rahu" && item.id !== "Ketu") {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, orbR + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 136, 92, 0.72)";
        ctx.setLineDash([2.5, 2.5]);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Jewel-set metallic medallion
      ctx.shadowColor = meta.glow;
      ctx.shadowBlur = item.id === "Sun" || meta.slow ? 13 : 8;
      const og = ctx.createRadialGradient(pt.x - orbR * 0.3, pt.y - orbR * 0.3, 1, pt.x, pt.y, orbR);
      og.addColorStop(0, "#fff8e8");
      og.addColorStop(0.32, meta.color);
      og.addColorStop(1, "#181512");
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, orbR, 0, Math.PI * 2);
      ctx.fillStyle = og;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = "rgba(255,244,218,0.65)";
      ctx.lineWidth = 1.1;
      ctx.stroke();

      ctx.font = `700 ${Math.max(10, size * 0.0175).toFixed(1)}px "DM Sans", sans-serif`;
      ctx.fillStyle = "#08090f";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(meta.sym, pt.x, pt.y + 0.5);

      if (retro && item.id !== "Rahu" && item.id !== "Ketu") {
        ctx.font = `700 ${Math.max(6.5, size * 0.010).toFixed(1)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = "#ff9b70";
        ctx.fillText("℞", pt.x + orbR * 0.92, pt.y - orbR * 0.85);
      }
      ctx.restore();
    }

    // 9. Central Mechanical Chronometer Readout (Date + Day of Year + Sun Pada + Ayanamsa)
    const curDate = JE.jdToDate(state.simJD);
    const { doy, daysInYear, year } = JE.dayOfYearUtc(curDate);
    const dateLine = `${String(curDate.getUTCDate()).padStart(2, "0")} ${MONTHS[curDate.getUTCMonth()]} ${year}`;
    const sunDet = state.transit.details.Sun;

    // Subtle dark scrim behind hub text so bright Drishti arcs never obscure the date/ayanamsa
    const hubScrim = ctx.createRadialGradient(cx, cy, rCore * 0.1, cx, cy, rCore * 0.84);
    hubScrim.addColorStop(0, "rgba(6, 8, 14, 0.86)");
    hubScrim.addColorStop(0.72, "rgba(6, 8, 14, 0.68)");
    hubScrim.addColorStop(1, "rgba(6, 8, 14, 0.0)");
    ctx.beginPath();
    ctx.arc(cx, cy, rCore * 0.84, 0, Math.PI * 2);
    ctx.fillStyle = hubScrim;
    ctx.fill();

    // 365-Day curved brass progress ring inside the obsidian dome
    const rYearArc = rCore * 0.87;
    const yearFrac = (doy - 1) / daysInYear;
    ctx.beginPath();
    ctx.arc(cx, cy, rYearArc, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * yearFrac);
    ctx.strokeStyle = hasTriple ? "#ff7849" : "#e6b85c";
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Inner text hierarchy
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Top tiny crest or live convergence flash
    if (hasTriple || hasDouble) {
      ctx.font = `700 ${Math.max(8, size * 0.0125).toFixed(1)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = hasTriple ? "#ff7b54" : "#ffd43b";
      ctx.fillText(hasTriple ? "✦ TRIPLE TRANSIT" : "◆ DOUBLE TRANSIT", cx, cy - rCore * 0.48);
    } else {
      ctx.font = `600 ${Math.max(7.5, size * 0.0115).toFixed(1)}px "Cinzel", serif`;
      ctx.fillStyle = "rgba(218, 178, 102, 0.78)";
      ctx.fillText(state.natal ? "NATAL LOCKED" : "NAKSHATRA CHAKRAM", cx, cy - rCore * 0.48);
    }

    // Large crisp Date
    ctx.font = `700 ${Math.max(13, size * 0.0245).toFixed(1)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = "#f5ecd8";
    ctx.fillText(dateLine, cx, cy - rCore * 0.16);

    // Day-of-Year Grain Counter
    ctx.font = `600 ${Math.max(9.5, size * 0.0155).toFixed(1)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = "#e6b85c";
    ctx.fillText(`DAY ${String(doy).padStart(3, "0")} / ${daysInYear}`, cx, cy + rCore * 0.11);

    // Sun's live Nakshatra · Pada
    ctx.font = `500 ${Math.max(8.5, size * 0.0132).toFixed(1)}px "DM Sans", sans-serif`;
    ctx.fillStyle = "rgba(235, 224, 200, 0.82)";
    ctx.fillText(`☉ ${sunDet.nak.name} · P${sunDet.padaNum}`, cx, cy + rCore * 0.35);

    // Active Ayanamsa readout
    ctx.font = `600 ${Math.max(7.5, size * 0.0115).toFixed(1)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = "rgba(165, 178, 202, 0.72)";
    ctx.fillText(`${state.ayanamsa.toUpperCase()} ${JE.fmtDM(state.transit.ayanamsa)}`, cx, cy + rCore * 0.56);
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
    // Smooth mechanical dial spring rotation (on Lahiri <-> Raman or Natal Lock)
    let zDiff = ((state.targetZenithDeg - state.zenithDeg + 540) % 360) - 180;
    if (Math.abs(zDiff) > 0.02) {
      state.zenithDeg = JE.norm360(state.zenithDeg + zDiff * Math.min(1, dtSec * 8));
    } else {
      state.zenithDeg = state.targetZenithDeg;
    }

    if (state.playing) {
      const rate = SPEED_MAP[state.speed].daysPerSec;
      const dDays = dtSec * rate * state.direction;
      state.simJD += dDays;
      // Rotate physical cosmic gears proportionally to solar motion (scaled for tangible mechanical feel)
      state.gearAngle += dDays * 0.065;
    }

    // Compute live 60fps positions
    state.transit = JE.computeSiderealSnapshot(state.simJD, state.ayanamsa);

    // Append orbital trails smoothly
    if (state.playing) {
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

    // Zero-skip day-by-day grain check for Double/Triple transits & escapement tick
    const curIntDay = Math.floor(state.simJD);
    if (curIntDay !== state.lastCheckedDay) {
      const stepDir = curIntDay > state.lastCheckedDay ? 1 : -1;
      const totalSteps = Math.min(45, Math.abs(curIntDay - state.lastCheckedDay));
      for (let s = 1; s <= totalSteps; s++) {
        const dayJD = state.lastCheckedDay + s * stepDir + 0.5;
        const daySnap = (s === totalSteps) ? state.transit : JE.computeSiderealSnapshot(dayJD, state.ayanamsa);
        evaluateAndTriggerTransits(daySnap, dayJD, nowMs, true);
      }
      state.lastCheckedDay = curIntDay;
      if (state.playing && Audio) Audio.playTick(state.speed);
    } else if (!state.analysis) {
      evaluateAndTriggerTransits(state.transit, state.simJD, nowMs, false);
    }

    if (nowMs - state.lastUiUpdateMs > 110) {
      state.lastUiUpdateMs = nowMs;
      syncSidePanelUI();
    }
  }

  function evaluateAndTriggerTransits(snap, jd, nowMs, allowSound) {
    const res = JE.analyzeTransits(snap, state.natal);
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
        pushEventLog({ tier: "triple", date: dateLabel, summary: tr.summary, jd });
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

  function tickLoop(nowMs) {
    const dtSec = Math.min(0.1, Math.max(0.001, (nowMs - state.lastFrameMs) / 1000));
    state.lastFrameMs = nowMs;
    stepSimulation(dtSec, nowMs);
    renderFrame(nowMs);
    requestAnimationFrame(tickLoop);
  }

  // ---------------------------------------------------------------------------
  // Interactive Controls & DOM Wiring
  // ---------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);

  function flashAnnunciator(tier) {
    const box = $("transit-annunciator");
    if (!box) return;
    box.classList.remove("flash-double", "flash-triple", "flash-pada");
    void box.offsetWidth;
    box.classList.add(`flash-${tier}`);
  }

  function recomputeForAyanamsaOrNatal(playAudioMode) {
    state.trails = {};
    if (state.birthInput) {
      const b = state.birthInput;
      const bJD = JE.localBirthToJD(b.date, b.time, b.tz);
      state.natal = JE.computeSiderealSnapshot(bJD, state.ayanamsa, b.lat, b.lon);
      const lagR = state.natal.details.Lagna.rasiIdx;
      state.targetZenithDeg = lagR * 30 + 15;
    } else {
      state.natal = null;
      // Subtle visual ayanamsa clutch shift even in sky mode so user feels Lahiri <-> Raman engage!
      state.targetZenithDeg = state.ayanamsa === "raman" ? 13.55 : 15.0;
    }

    state.transit = JE.computeSiderealSnapshot(state.simJD, state.ayanamsa);
    state.activeEventKeys = new Set();
    evaluateAndTriggerTransits(state.transit, state.simJD, performance.now(), false);

    if (playAudioMode === "ayanamsa" && Audio) Audio.playAyanamsaClutch();
    if (playAudioMode === "lock" && Audio) Audio.playNatalLock(true);
    if (playAudioMode === "unlock" && Audio) Audio.playNatalLock(false);

    syncSidePanelUI();
    renderEventLog();
  }

  function syncSidePanelUI() {
    if (!state.transit) return;
    const curDate = JE.jdToDate(state.simJD);
    const { doy, daysInYear, year } = JE.dayOfYearUtc(curDate);

    // Date & Day-of-Year readout in console
    const elDate = $("chrono-date");
    const elDoy = $("chrono-doy");
    const elSlider = $("year-scrubber");
    const elAyanVal = $("ayanamsa-readout");
    if (elDate) elDate.textContent = formatShortDate(curDate);
    if (elDoy) elDoy.textContent = `DAY ${String(doy).padStart(3, "0")} / ${daysInYear}`;
    if (elSlider && document.activeElement !== elSlider) {
      elSlider.max = String(daysInYear);
      elSlider.value = String(doy);
    }
    if (elAyanVal) {
      elAyanVal.textContent = `${state.ayanamsa === "raman" ? "B.V. Raman" : "Lahiri"} · ${JE.fmtDMS(state.transit.ayanamsa)}`;
    }

    // Annunciator live status
    const annBadge = $("ann-badge");
    const annText = $("ann-text");
    const annBox = $("transit-annunciator");
    if (annBadge && annText && annBox) {
      const tr = state.analysis.triples[0];
      const db = state.analysis.doubles[0];
      const ph = state.analysis.padaHits[0];
      annBox.classList.toggle("is-triple", Boolean(tr));
      annBox.classList.toggle("is-double", !tr && Boolean(db));
      if (tr) {
        annBadge.textContent = "✦ TRIPLE TRANSIT ACTIVE";
        annText.textContent = tr.summary;
      } else if (db) {
        annBadge.textContent = "◆ DOUBLE TRANSIT ACTIVE";
        annText.textContent = db.summary;
      } else if (ph) {
        annBadge.textContent = "◈ EXACT NATAL PADA TRANSIT";
        annText.textContent = ph.summary;
      } else {
        annBadge.textContent = "○ MONITORING GOCHARA";
        annText.textContent = state.natal
          ? `Watching ♃ ${state.transit.details.Jupiter.rasi.sanskrit} · ♄ ${state.transit.details.Saturn.rasi.sanskrit} · ☊ ${state.transit.details.Rahu.rasi.sanskrit}`
          : "Enter birth details to lock natal pins & track personal Double / Triple transits";
      }
    }

    // Natal lock status summary
    const natalStatus = $("natal-lock-status");
    if (natalStatus) {
      if (state.natal) {
        const lag = state.natal.details.Lagna;
        const moo = state.natal.details.Moon;
        natalStatus.innerHTML = `<span class="lock-pill">🔒 LOCKED</span> ${lag.rasi.sanskrit} Lagna (${lag.nak.short} P${lag.padaNum}) · ☽ ${moo.rasi.sanskrit} (${moo.nak.name} P${moo.padaNum})`;
      } else {
        natalStatus.innerHTML = `<span class="lock-pill is-sky">COSMIC SKY</span> Enter birth details below to lock natal pins`;
      }
    }

    // Live Ephemeris Table (compact 9-planet live readout)
    const ephemBody = $("ephemeris-rows");
    if (ephemBody) {
      const rows = JE.PLANETS.map((p) => {
        const d = state.transit.details[p.id];
        const retro = state.transit.retrograde[p.id] && p.id !== "Rahu" && p.id !== "Ketu";
        return `<tr>
          <td><span class="p-dot" style="color:${p.color}">${p.sym}</span> ${p.short}${retro ? '<span class="retro-tag">℞</span>' : ""}</td>
          <td>${d.rasi.glyph} ${d.rasi.sanskrit}</td>
          <td class="mono">${JE.fmtDM(d.degInRasi)}</td>
          <td>${d.nak.name} <span class="pada-pill">P${d.padaNum}</span></td>
        </tr>`;
      }).join("");
      ephemBody.innerHTML = rows;
    }
  }

  function renderEventLog() {
    const list = $("transit-log-list");
    if (!list) return;
    if (!state.eventLog.length) {
      list.innerHTML = `<li class="log-empty">No Double or Triple convergence crossed yet — speed up or press Next Convergence.</li>`;
      return;
    }
    list.innerHTML = state.eventLog.slice(0, 8).map((ev) => {
      const badge = ev.tier === "triple" ? "TRIPLE" : (ev.tier === "double" ? "DOUBLE" : "PADA");
      return `<li class="log-item tier-${ev.tier}" data-jd="${ev.jd.toFixed(3)}" title="Jump dial to ${ev.date}">
        <span class="log-tag">${badge}</span>
        <span class="log-date">${ev.date}</span>
        <span class="log-msg">${ev.summary}</span>
      </li>`;
    }).join("");
  }

  // ---------------------------------------------------------------------------
  // Canvas Pointer Hover & Click Inspection (All 108 Padas, 27 Naks, 12 Rasis)
  // ---------------------------------------------------------------------------

  function handlePointerMove(e) {
    if (!canvas || !state.transit) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = canvasSize / 2;
    const cy = canvasSize / 2;
    const R = canvasSize * 0.468;
    const { deg, dist } = screenToSiderealDeg(cx, cy, mx, my);
    const tip = $("dial-tooltip");
    if (!tip) return;

    const rFrac = dist / R;
    if (rFrac < 0.305 || rFrac > 0.945) {
      state.hovered = null;
      tip.hidden = true;
      return;
    }

    let html = "";
    if (rFrac >= 0.842) {
      const pada = JE.PADAS[Math.floor(deg / JE.PADA_SPAN) % 108];
      state.hovered = { type: "pada", data: pada };
      const here = JE.PLANETS.filter((p) => state.transit.details[p.id].padaId === pada.id).map((p) => `${p.sym} ${p.id}`);
      html = `
        <div class="tt-head">${pada.nak.dev} · ${pada.nak.name} — Pada ${pada.padaNum} <span class="tt-num">#${pada.num}/108</span></div>
        <div class="tt-meta">${JE.fmtDM(pada.startDeg)} – ${JE.fmtDM(pada.endDeg)} · Rasi: ${pada.rasi.sanskrit} ${pada.rasi.glyph} · Navamsa: ${pada.navamsa.sanskrit}</div>
        <div class="tt-sub">Ruler: <b>${pada.nak.ruler}</b> · Deity: ${pada.nak.deity} · Beeja: <b>${pada.beeja}</b>${pada.isGandanta ? ' · <span class="tt-gandanta">GANDANTA</span>' : ""}</div>
        ${here.length ? `<div class="tt-live">Transiting now: ${here.join(" · ")}</div>` : ""}
      `;
    } else if (rFrac >= 0.718) {
      const nak = JE.NAKSHATRAS[Math.floor(deg / (360 / 27)) % 27];
      state.hovered = { type: "nak", data: nak };
      html = `
        <div class="tt-head">${nak.dev} · ${nak.name} <span class="tt-num">Nakshatra ${nak.idx + 1}/27</span></div>
        <div class="tt-meta">Ruler: <b>${nak.ruler}</b> · Deity: ${nak.deity} · Gana: ${nak.gana}</div>
        <div class="tt-sub">Symbol: ${nak.symbol} · Padas: ${nak.padas.join(" · ")}</div>
      `;
    } else if (rFrac >= 0.562) {
      // Check nearest transiting planet
      let best = null;
      let bestD = 9;
      for (const p of JE.PLANETS) {
        const dd = JE.angDiff(deg, state.transit.positions[p.id]);
        if (dd < bestD) { bestD = dd; best = p; }
      }
      if (best) {
        const d = state.transit.details[best.id];
        const retro = state.transit.retrograde[best.id];
        state.hovered = { type: "planet", data: best };
        html = `
          <div class="tt-head" style="color:${best.color}">${best.sym} ${best.id} (${best.dev} ${best.sanskrit})${retro ? " ℞ Retrograde" : ""}</div>
          <div class="tt-meta">${d.rasi.sanskrit} ${d.rasi.glyph} ${JE.fmtDMS(d.degInRasi)} · Speed: ${state.transit.speeds[best.id].toFixed(3)}°/day</div>
          <div class="tt-sub">${d.nak.dev} ${d.nak.name} · Pada ${d.padaNum} (#${d.pada.num}/108) · Navamsa ${d.navamsa.sanskrit}</div>
        `;
      } else {
        state.hovered = null;
        tip.hidden = true;
        return;
      }
    } else if (rFrac >= 0.422) {
      const rasi = JE.RASIS[Math.floor(deg / 30) % 12];
      state.hovered = { type: "rasi", data: rasi };
      html = `
        <div class="tt-head">${rasi.glyph} ${rasi.dev} · ${rasi.sanskrit} (${rasi.english})</div>
        <div class="tt-meta">Element: <b>${rasi.element}</b> · Ruler: <b>${rasi.ruler}</b></div>
        <div class="tt-sub">${rasi.vibe}</div>
      `;
    } else if (state.natal) {
      // Locked natal pin hover
      const keys = ["Lagna", ...JE.PLANETS.map((p) => p.id)];
      let best = null;
      let bestD = 11;
      for (const k of keys) {
        if (state.natal.positions[k] === undefined) continue;
        const dd = JE.angDiff(deg, state.natal.positions[k]);
        if (dd < bestD) { bestD = dd; best = k; }
      }
      if (best) {
        const meta = JE.PLANET_MAP[best];
        const d = state.natal.details[best];
        state.hovered = { type: "natal", data: best };
        html = `
          <div class="tt-head" style="color:${meta.color}">🔒 Natal ${best} (${meta.dev})</div>
          <div class="tt-meta">${d.rasi.sanskrit} ${d.rasi.glyph} ${JE.fmtDMS(d.degInRasi)}</div>
          <div class="tt-sub">${d.nak.name} · Pada ${d.padaNum} (#${d.pada.num}/108) · Navamsa ${d.navamsa.sanskrit}</div>
        `;
      } else {
        state.hovered = null;
        tip.hidden = true;
        return;
      }
    } else {
      state.hovered = null;
      tip.hidden = true;
      return;
    }

    tip.innerHTML = html;
    tip.hidden = false;
    const tipX = Math.min(rect.width - 280, Math.max(10, mx + 16));
    const tipY = Math.max(10, my - 22);
    tip.style.left = `${tipX}px`;
    tip.style.top = `${tipY}px`;
  }

  // ---------------------------------------------------------------------------
  // Setup & Initialization
  // ---------------------------------------------------------------------------

  function resizeCanvas() {
    if (!canvas) return;
    const stage = canvas.parentElement;
    const w = stage ? stage.clientWidth : 680;
    const h = window.innerHeight ? Math.min(720, window.innerHeight - 106) : 680;
    const target = Math.max(320, Math.min(700, Math.floor(Math.min(w, h))));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasSize = target;
    canvas.style.width = `${target}px`;
    canvas.style.height = `${target}px`;
    canvas.width = Math.round(target * dpr);
    canvas.height = Math.round(target * dpr);
    staticCacheKey = "";
  }

  function populateCityDatalist() {
    const dl = $("city-list");
    if (!dl) return;
    dl.innerHTML = JE.CITIES.map((c) => `<option value="${c.name}"></option>`).join("");
  }

  function loadSavedBirth() {
    try {
      const raw = localStorage.getItem("nakshatra-cosmic-birth");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && saved.date && saved.lat !== undefined) {
        state.birthInput = saved;
        if ($("birth-date")) $("birth-date").value = saved.date;
        if ($("birth-time")) $("birth-time").value = saved.time || "06:30";
        if ($("birth-city")) $("birth-city").value = saved.city || "Hyderabad, India";
        if ($("btn-unlock-natal")) $("btn-unlock-natal").hidden = false;
      }
    } catch (_) {}
  }

  function bindControls() {
    // Play / Pause
    const btnPlay = $("btn-play");
    if (btnPlay) {
      btnPlay.addEventListener("click", () => {
        state.playing = !state.playing;
        btnPlay.textContent = state.playing ? "❚❚ PAUSE" : "▶ ENGAGE";
        btnPlay.classList.toggle("is-active", state.playing);
      });
    }

    // Reverse / Forward direction
    const btnRev = $("btn-rev");
    if (btnRev) {
      btnRev.addEventListener("click", () => {
        state.direction = -state.direction;
        btnRev.textContent = state.direction < 0 ? "◀ REV" : "FWD ▶";
        btnRev.classList.toggle("is-active", state.direction < 0);
      });
    }

    // Snap to Today
    const btnToday = $("btn-today");
    if (btnToday) {
      btnToday.addEventListener("click", () => {
        state.simJD = JE.dateToJD(new Date());
        state.lastCheckedDay = Math.floor(state.simJD);
        state.trails = {};
        state.activeEventKeys = new Set();
        evaluateAndTriggerTransits(JE.computeSiderealSnapshot(state.simJD, state.ayanamsa), state.simJD, performance.now(), false);
        syncSidePanelUI();
      });
    }

    // Speed buttons: DAY / WEEK / MONTH
    document.querySelectorAll("[data-speed]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sp = btn.getAttribute("data-speed");
        if (!SPEED_MAP[sp]) return;
        state.speed = sp;
        document.querySelectorAll("[data-speed]").forEach((b) => b.classList.toggle("is-active", b === btn));
      });
    });

    // Ayanamsa Toggle: LAHIRI <-> RAMAN
    document.querySelectorAll("[data-ayanamsa]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-ayanamsa");
        if (mode !== "lahiri" && mode !== "raman") return;
        if (state.ayanamsa === mode) return;
        state.ayanamsa = mode;
        document.querySelectorAll("[data-ayanamsa]").forEach((b) => b.classList.toggle("is-active", b === btn));
        recomputeForAyanamsaOrNatal("ayanamsa");
      });
    });

    // Day-of-Year Scrubber
    const scrubber = $("year-scrubber");
    if (scrubber) {
      scrubber.addEventListener("input", () => {
        const d = JE.jdToDate(state.simJD);
        const yearStartJD = JE.ymdhmsToJD(d.getUTCFullYear(), 1, 1, 12);
        state.simJD = yearStartJD + (Number(scrubber.value) - 1);
        state.lastCheckedDay = Math.floor(state.simJD);
        state.trails = {};
        syncSidePanelUI();
      });
    }

    // Sound Toggle
    const btnSound = $("btn-sound");
    if (btnSound && Audio) {
      btnSound.addEventListener("click", () => {
        const on = Audio.setEnabled(!Audio.isEnabled());
        btnSound.textContent = on ? "🔊 SOUND ON" : "🔇 SOUND";
        btnSound.classList.toggle("is-active", on);
      });
    }

    // Jump to Next Major Double / Triple Transit
    const btnNext = $("btn-next-transit");
    if (btnNext) {
      btnNext.addEventListener("click", () => {
        const hit = JE.findNextConvergence(state.simJD, state.natal, state.ayanamsa, 1460);
        if (!hit) return;
        state.simJD = hit.jd;
        state.lastCheckedDay = Math.floor(hit.jd);
        state.trails = {};
        state.transit = hit.snap;
        state.activeEventKeys = new Set();
        evaluateAndTriggerTransits(hit.snap, hit.jd, performance.now(), true);
        syncSidePanelUI();
      });
    }

    // Lock Birth Chart Form
    const form = $("birth-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const date = $("birth-date")?.value;
        const time = $("birth-time")?.value || "12:00";
        const cityStr = $("birth-city")?.value || "Hyderabad, India";
        const errEl = $("birth-error");
        if (!date) {
          if (errEl) errEl.textContent = "Enter a birth date.";
          return;
        }
        const cityObj = JE.findCity(cityStr);
        if (!cityObj) {
          if (errEl) errEl.textContent = "City not found — pick from list or enter lat, lon (e.g. 17.38, 78.49).";
          return;
        }
        if (errEl) errEl.textContent = "";
        state.birthInput = {
          date,
          time,
          city: cityObj.name,
          lat: cityObj.lat,
          lon: cityObj.lon,
          tz: cityObj.tz,
        };
        try { localStorage.setItem("nakshatra-cosmic-birth", JSON.stringify(state.birthInput)); } catch (_) {}
        if ($("btn-unlock-natal")) $("btn-unlock-natal").hidden = false;
        state.eventLog = [];
        recomputeForAyanamsaOrNatal("lock");
      });
    }

    // Sample Chart quick button
    const btnSample = $("btn-sample-birth");
    if (btnSample) {
      btnSample.addEventListener("click", () => {
        if ($("birth-date")) $("birth-date").value = "1988-08-15";
        if ($("birth-time")) $("birth-time").value = "06:30";
        if ($("birth-city")) $("birth-city").value = "Hyderabad, India";
        $("birth-form")?.dispatchEvent(new Event("submit", { cancelable: true }));
      });
    }

    // Unlock / Return to Cosmic Sky Mode
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

    // Click any event log row to jump directly to that transit date
    const logList = $("transit-log-list");
    if (logList) {
      logList.addEventListener("click", (e) => {
        const li = e.target.closest("[data-jd]");
        if (!li) return;
        const jd = Number(li.getAttribute("data-jd"));
        if (!Number.isFinite(jd)) return;
        state.simJD = jd;
        state.lastCheckedDay = Math.floor(jd);
        state.trails = {};
        state.transit = JE.computeSiderealSnapshot(jd, state.ayanamsa);
        state.activeEventKeys = new Set();
        evaluateAndTriggerTransits(state.transit, jd, performance.now(), true);
        syncSidePanelUI();
      });
    }

    // Canvas hover / mouseleave
    if (canvas) {
      canvas.addEventListener("mousemove", handlePointerMove);
      canvas.addEventListener("mouseleave", () => {
        state.hovered = null;
        const tip = $("dial-tooltip");
        if (tip) tip.hidden = true;
      });
    }

    window.addEventListener("resize", resizeCanvas);
  }

  function init() {
    canvas = $("cosmicDialCanvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    populateCityDatalist();
    loadSavedBirth();
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
