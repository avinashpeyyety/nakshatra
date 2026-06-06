/**
 * Landing-page nakshatra wheel — drawn from the same SVG logic as the app
 * (agent/static/index.html). Natal chart is fixed; transits advance on a timer
 * like the in-app Time Dial playback.
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const CX = 380;
  const CY = 380;
  const NAK_SPAN = 360 / 27;

  const NAK_ABBR = [
    "Ash", "Bha", "Kri", "Roh", "Mri", "Ard",
    "Pun", "Pus", "Asl", "Mag", "PPh", "UPh",
    "Has", "Chi", "Swa", "Vis", "Anu", "Jye",
    "Mul", "PAs", "UAs", "Shr", "Dha", "Sha",
    "PBh", "UBh", "Rev",
  ];
  const NAK_FULL = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
  ];
  const NAK_RULER = [
    "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu",
    "Jupiter", "Saturn", "Mercury", "Ketu", "Venus", "Sun",
    "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
    "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu",
    "Jupiter", "Saturn", "Mercury",
  ];
  const RASI_SHORT = ["Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis"];
  const RASI_FULL = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];
  const RASI_ELEM = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
  const BHAVA_ABBR = ["", "Lag", "Dha", "Sah", "Suk", "Put", "Sha", "Kal", "Ayu", "Dhr", "Kar", "Lab", "Vya"];

  const RULER_BG = {
    Ketu: "#1e0d2e", Venus: "#100828", Sun: "#271000", Moon: "#111126", Mars: "#270400",
    Rahu: "#07070f", Jupiter: "#111100", Saturn: "#050c18", Mercury: "#051208",
  };
  const RULER_ACCENT = {
    Ketu: "#7e22ce", Venus: "#9d174d", Sun: "#92400e", Moon: "#374151", Mars: "#991b1b",
    Rahu: "#3730a3", Jupiter: "#854d0e", Saturn: "#1e3a5f", Mercury: "#065f46",
  };
  const EL_BG = ["#2a0808", "#081a08", "#20200a", "#07091e"];
  const EL_BORDER = ["#7f1d1d", "#14532d", "#713f12", "#1e3a8a"];
  const EL_TEXT = ["#fca5a5", "#86efac", "#fde68a", "#93c5fd"];

  const P_COLOR = {
    Sun: "#f59e0b", Moon: "#c0c8d8", Mercury: "#34d399", Venus: "#f472b6",
    Mars: "#ef4444", Jupiter: "#facc15", Saturn: "#94a3b8",
    Rahu: "#a855f7", Ketu: "#fb923c", Lagna: "#60a5fa",
  };
  const P_SYM = {
    Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
    Jupiter: "♃", Saturn: "♄", Rahu: "☊", Ketu: "☋", Lagna: "L",
  };
  const P_NAME_SHORT = {
    Sun: "Sun", Moon: "Moon", Mercury: "Mer", Venus: "Ven", Mars: "Mars",
    Jupiter: "Jup", Saturn: "Sat", Rahu: "Rahu", Ketu: "Ketu", Lagna: "Asc",
  };
  const PLANET_ORDER = ["Lagna", "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Rahu", "Ketu"];

  const GANDANTA_ZONES = [
    [356.667, 360], [0, 3.333],
    [116.667, 120], [120, 123.333],
    [236.667, 240], [240, 243.333],
  ];

  const DEMO = {
    positions: {
      Lagna: 248.42,
      Sun: 64.18,
      Moon: 291.55,
      Mars: 152.87,
      Mercury: 48.33,
      Jupiter: 197.64,
      Venus: 22.91,
      Saturn: 320.15,
      Rahu: 212.40,
      Ketu: 32.40,
    },
    lagna_rasi_idx: 8,
    ayanamsa: 23.72,
    sarva: [28, 24, 22, 31, 26, 19, 27, 25, 30, 23, 21, 29],
    retrograde: { Mercury: false, Venus: false, Mars: false, Jupiter: false, Saturn: false, Rahu: true, Ketu: true },
    dignity: { Sun: null, Moon: null, Mars: null, Mercury: "own", Jupiter: "exalted", Venus: null, Saturn: null },
    combust: {},
  };

  const TRANSIT_BASE = {
    Sun: 70.8, Moon: 162.4, Mercury: 58.2, Venus: 35.6,
    Mars: 118.3, Jupiter: 82.1, Saturn: 337.5, Rahu: 329.2, Ketu: 149.2,
  };
  const TRANSIT_SPEED = {
    Sun: 0.9856, Moon: 13.176, Mercury: 1.15, Venus: 1.02,
    Mars: 0.524, Jupiter: 0.0831, Saturn: 0.0335, Rahu: -0.05295, Ketu: -0.05295,
  };

  const TICK_MS = 600;
  const DAYS_PER_TICK = 1;

  let transitDays = 0;
  let timer = null;
  let playing = true;

  function normDeg(d) {
    return ((d % 360) + 360) % 360;
  }

  function transitPositions(days) {
    const t = {};
    for (const p of Object.keys(TRANSIT_BASE)) {
      t[p] = normDeg(TRANSIT_BASE[p] + TRANSIT_SPEED[p] * days);
    }
    return t;
  }

  function wheelData() {
    return { ...DEMO, transit_positions: transitPositions(transitDays) };
  }

  function el(tag, attrs, txt) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  function drawNakshatraWheel(wd) {
    const svg = document.getElementById("heroWheelSvg");
    if (!svg) return;
    svg.innerHTML = "";

    const lagnaRawDeg = wd.positions.Lagna;
    const lagnaRasiIdx = wd.lagna_rasi_idx;
    const bhava1Mid = lagnaRasiIdx * 30 + 15;
    const dToRad = (d) => -(d - bhava1Mid) * Math.PI / 180 - Math.PI / 2;
    const pt = (r, d) => ({
      x: parseFloat((CX + r * Math.cos(dToRad(d))).toFixed(3)),
      y: parseFloat((CY + r * Math.sin(dToRad(d))).toFixed(3)),
    });
    const seg = (r1, r2, s, e) => {
      const span = ((e - s) + 3600) % 360;
      const large = span > 180 ? 1 : 0;
      const { x: x1, y: y1 } = pt(r2, s);
      const { x: x2, y: y2 } = pt(r2, e);
      const { x: x3, y: y3 } = pt(r1, e);
      const { x: x4, y: y4 } = pt(r1, s);
      return `M${x1} ${y1}A${r2} ${r2} 0 ${large} 0 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 ${large} 1 ${x4} ${y4}Z`;
    };
    const add = (tag, attrs, txt) => {
      const node = el(tag, attrs, txt);
      svg.appendChild(node);
      return node;
    };
    const arcText = (txt, r, midDeg, size, fill, bold = false) => {
      const { x, y } = pt(r, midDeg);
      const svgDeg = ((dToRad(midDeg) * 180 / Math.PI) % 360 + 360) % 360;
      let rot = svgDeg - 90;
      if (((rot % 360) + 360) % 360 > 90 && rot % 360 < 270) rot += 180;
      add("text", {
        x, y, "font-size": size, fill, "text-anchor": "middle",
        "dominant-baseline": "central",
        "font-family": bold ? "Cinzel, serif" : "Lato, sans-serif",
        "font-weight": bold ? "700" : "400",
        transform: `rotate(${rot.toFixed(1)},${x},${y})`,
      }, txt);
    };

    add("circle", { cx: CX, cy: CY, r: 375, fill: "#05050e" });

    for (let i = 0; i < 27; i++) {
      const s = i * NAK_SPAN;
      const e = s + NAK_SPAN;
      const mid = s + NAK_SPAN / 2;
      const rl = NAK_RULER[i];
      const g = el("g", {});
      g.appendChild(el("path", { d: seg(285, 362, s, e), fill: RULER_BG[rl], stroke: "#15103a", "stroke-width": "0.6" }));
      g.appendChild(el("path", { d: seg(358, 362, s, e), fill: RULER_ACCENT[rl] + "55", stroke: "none" }));
      svg.appendChild(g);
      arcText(NAK_ABBR[i], 351, mid, "8", "#cfc6e6");
      const t = el("title", {});
      t.textContent = `${i + 1}. ${NAK_FULL[i]} — ${rl}`;
      g.appendChild(t);
    }

    for (const [gs, ge] of GANDANTA_ZONES) {
      const start = gs;
      const end = ge <= gs ? ge + 360 : ge;
      add("path", {
        d: seg(285, 362, start, end),
        fill: "#ff4400", "fill-opacity": "0.18",
        stroke: "#ff6622", "stroke-width": "0.8", "stroke-opacity": "0.5",
      });
    }

    const STACK_RADII = [308, 293, 322, 285];
    const sorted = PLANET_ORDER
      .filter((p) => wd.positions[p] !== undefined)
      .map((p) => ({ p, deg: wd.positions[p] }))
      .sort((a, b) => a.deg - b.deg);
    const nakPlaced = [];
    for (const { p, deg } of sorted) {
      const used = new Set();
      for (const prev of nakPlaced) {
        const diff = Math.min(Math.abs(deg - prev.deg), 360 - Math.abs(deg - prev.deg));
        if (diff < 11) used.add(prev.level);
      }
      let level = 0;
      while (used.has(level)) level++;
      nakPlaced.push({ p, deg, r: STACK_RADII[Math.min(level, STACK_RADII.length - 1)], level });
    }

    for (const { p, deg, r } of nakPlaced) {
      const color = P_COLOR[p];
      const isLagna = p === "Lagna";
      const { x, y } = pt(r, deg);
      const retro = !!(wd.retrograde && wd.retrograde[p]);
      const dignity = wd.dignity ? wd.dignity[p] : null;

      const { x: tx1, y: ty1 } = pt(362, deg);
      const { x: tx2, y: ty2 } = pt(354, deg);
      add("line", { x1: tx1, y1: ty1, x2: tx2, y2: ty2, stroke: color, "stroke-width": "2" });

      let dotStroke = color;
      let dotStrokeW = isLagna ? "2.5" : "0";
      if (!isLagna) {
        if (dignity === "exalted") { dotStroke = "#c9a84c"; dotStrokeW = "2.5"; }
        else if (dignity === "debilitated") { dotStroke = "#ef4444"; dotStrokeW = "2.5"; }
        else if (dignity === "own") { dotStroke = "#94a3b8"; dotStrokeW = "1.8"; }
      }
      add("circle", {
        cx: x, cy: y, r: isLagna ? "10" : "9",
        fill: isLagna ? "#0d0d22" : color,
        stroke: dotStroke, "stroke-width": dotStrokeW,
      });
      add("text", {
        x, y, "font-size": isLagna ? "8" : (retro ? "7" : "10"),
        fill: isLagna ? color : "#04040e",
        "text-anchor": "middle", "dominant-baseline": "central", "font-weight": "bold",
      }, P_SYM[p] + (retro && !isLagna ? "℞" : ""));

      const svgDeg = ((dToRad(deg) * 180 / Math.PI) % 360 + 360) % 360;
      let lblRot = svgDeg - 90;
      if (((lblRot % 360) + 360) % 360 > 90 && lblRot % 360 < 270) lblRot += 180;

      const { x: nx, y: ny } = pt(r - 15, deg);
      add("text", {
        x: nx, y: ny, "font-size": "7", fill: color,
        "text-anchor": "middle", "dominant-baseline": "central", "font-weight": "700",
        transform: `rotate(${lblRot.toFixed(1)},${nx},${ny})`,
      }, P_NAME_SHORT[p]);
    }

    const sarva = wd.sarva || [];
    for (let i = 0; i < 12; i++) {
      const s = i * 30;
      const e = s + 30;
      const mid = s + 15;
      const elem = RASI_ELEM[i];
      const g = el("g", {});
      g.appendChild(el("path", { d: seg(205, 285, s, e), fill: EL_BG[elem], stroke: EL_BORDER[elem], "stroke-width": "1.2" }));
      svg.appendChild(g);
      arcText(RASI_SHORT[i], 248, mid, "11", EL_TEXT[elem], true);
      if (sarva.length > i) {
        const score = sarva[i];
        const sCol = score >= 28 ? "#c9a84c" : score >= 20 ? "#94a3b8" : "#ef4444";
        arcText(String(score), 225, mid, "9", sCol, true);
      }
    }

    for (let b = 0; b < 12; b++) {
      const rasiIdx = (lagnaRasiIdx + b) % 12;
      const s = rasiIdx * 30;
      const e = s + 30;
      const mid = s + 15;
      const bhava = b + 1;
      const bg = b % 2 === 0 ? "#09071e" : "#0c0b26";
      const g = el("g", {});
      g.appendChild(el("path", { d: seg(125, 205, s, e), fill: bg, stroke: "#241d52", "stroke-width": "0.8" }));
      svg.appendChild(g);
      const { x: bx, y: by } = pt(165, mid);
      const svgDeg = ((dToRad(mid) * 180 / Math.PI) % 360 + 360) % 360;
      let rot = svgDeg - 90;
      if (((rot % 360) + 360) % 360 > 90 && rot % 360 < 270) rot += 180;
      add("text", {
        x: bx, y: by - 7, "font-size": "13", fill: "#c9a84c",
        "text-anchor": "middle", "dominant-baseline": "central",
        "font-family": "Cinzel,serif", "font-weight": "700",
        transform: `rotate(${rot.toFixed(1)},${bx},${by})`,
      }, String(bhava));
      add("text", {
        x: bx, y: by + 8, "font-size": "6.5", fill: "#6b5fa0",
        "text-anchor": "middle", "dominant-baseline": "central",
        transform: `rotate(${rot.toFixed(1)},${bx},${by})`,
      }, BHAVA_ABBR[bhava]);
    }

    add("circle", { cx: CX, cy: CY, r: "118", fill: "#07071a", stroke: "#241d52", "stroke-width": "0.8" });

    const { x: lm1x, y: lm1y } = pt(125, lagnaRawDeg);
    const { x: lm2x, y: lm2y } = pt(115, lagnaRawDeg);
    add("line", { x1: lm1x, y1: lm1y, x2: lm2x, y2: lm2y, stroke: "#60a5fa", "stroke-width": "2.5", "stroke-linecap": "round" });

    add("circle", { cx: CX, cy: CY, r: "68", fill: "#0d0d22", stroke: "#c9a84c", "stroke-width": "1.2" });
    add("text", {
      x: CX, y: CY - 30, "font-size": "7.5", fill: "#c9a84c",
      "text-anchor": "middle", "dominant-baseline": "central",
      "font-family": "Cinzel,serif", "letter-spacing": "2",
    }, "LAGNA");
    add("text", {
      x: CX, y: CY + 2, "font-size": "12", fill: "#e8d5a3",
      "text-anchor": "middle", "dominant-baseline": "central",
      "font-family": "Cinzel,serif", "font-weight": "700",
    }, RASI_FULL[lagnaRasiIdx]);
    add("text", {
      x: CX, y: CY + 34, "font-size": "6", fill: "#6b5fa0",
      "text-anchor": "middle", "dominant-baseline": "central",
    }, `Ayanamsa ${wd.ayanamsa.toFixed(2)}°`);

    add("circle", { cx: CX, cy: CY, r: "372", fill: "none", stroke: "#3a2e10", "stroke-width": "3" });
    add("circle", { cx: CX, cy: CY, r: "285", fill: "none", stroke: "#3a2e10", "stroke-width": "1.5" });
    add("circle", { cx: CX, cy: CY, r: "205", fill: "none", stroke: "#241d52", "stroke-width": "1" });
    add("circle", { cx: CX, cy: CY, r: "125", fill: "none", stroke: "#241d52", "stroke-width": "1" });

    const la = dToRad(lagnaRawDeg);
    const tip = { x: CX + 378 * Math.cos(la), y: CY + 378 * Math.sin(la) };
    const base = { x: CX + 362 * Math.cos(la), y: CY + 362 * Math.sin(la) };
    const perp = la + Math.PI / 2;
    const w = 7;
    const w1 = { x: base.x + w * Math.cos(perp), y: base.y + w * Math.sin(perp) };
    const w2 = { x: base.x - w * Math.cos(perp), y: base.y - w * Math.sin(perp) };
    add("polygon", { points: `${tip.x},${tip.y} ${w1.x},${w1.y} ${w2.x},${w2.y}`, fill: "#c9a84c" });

    if (wd.transit_positions) {
      drawSaJuDiamonds(svg, wd, dToRad, pt);
      drawTransitOverlay(svg, wd, dToRad, pt);
    }
  }

  function drawSaJuDiamonds(svg, wd, dToRad, pt) {
    const t = wd.transit_positions;
    if (!t) return;
    const RING_R = 373;
    svg.appendChild(el("circle", {
      cx: CX, cy: CY, r: RING_R, fill: "none", stroke: "#1e2d4a",
      "stroke-width": "0.8", "stroke-dasharray": "2 5",
    }));
    for (const { planet, sym, color } of [
      { planet: "Saturn", sym: "♄", color: "#94b4d4" },
      { planet: "Jupiter", sym: "♃", color: "#fde68a" },
    ]) {
      const deg = t[planet];
      if (deg == null) continue;
      const size = 8;
      const { x, y } = pt(RING_R, deg);
      const a = dToRad(deg);
      const pts = [
        { x, y: y - size }, { x: x + size, y }, { x, y: y + size }, { x: x - size, y },
      ].map((p2) => {
        const cos = Math.cos(a + Math.PI / 2);
        const sin = Math.sin(a + Math.PI / 2);
        const dx = p2.x - x;
        const dy = p2.y - y;
        return `${(x + dx * cos - dy * sin).toFixed(1)},${(y + dx * sin + dy * cos).toFixed(1)}`;
      }).join(" ");
      const poly = el("polygon", {
        points: pts, fill: color, "fill-opacity": "0.18",
        stroke: color, "stroke-width": "1.8", "stroke-opacity": "0.95",
      });
      svg.appendChild(poly);
      const symEl = el("text", {
        x, y, "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": "7", fill: color, "font-weight": "700",
      }, sym);
      svg.appendChild(symEl);
    }
  }

  function drawTransitOverlay(svg, wd, dToRad, pt) {
    const t = wd.transit_positions;
    if (!t) return;

    const T_COLOR = {
      Sun: "#fcd34d", Moon: "#e2e8f0", Mercury: "#6ee7b7", Venus: "#f9a8d4",
      Mars: "#fca5a5", Jupiter: "#fde68a", Saturn: "#cbd5e1", Rahu: "#d8b4fe", Ketu: "#fdba74",
    };
    const T_SYM = {
      Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
      Jupiter: "♃", Saturn: "♄", Rahu: "☊", Ketu: "☋",
    };
    const TRANSIT_R = 380;
    svg.appendChild(el("circle", {
      cx: CX, cy: CY, r: TRANSIT_R, fill: "none", stroke: "#1e3a5a",
      "stroke-width": "1", "stroke-dasharray": "3 4", class: "transit-orbit-ring",
    }));

    const lbl = el("text", {
      x: CX, y: CY - TRANSIT_R - 20, "text-anchor": "middle", "font-size": "9", fill: "#4a7aa5",
    }, "TRANSITS");
    svg.appendChild(lbl);

    const placed = {};
    for (const [p, deg] of Object.entries(t)) {
      const color = T_COLOR[p] || "#aaa";
      const sym = T_SYM[p] || p[0];
      const key = Math.floor(deg / 8);
      placed[key] = (placed[key] || 0) + 1;
      const stackR = TRANSIT_R - (placed[key] - 1) * 10;
      const { x, y } = pt(stackR, deg);
      const size = 7;
      const a = dToRad(deg);
      const pts = [
        { x, y: y - size }, { x: x + size, y }, { x, y: y + size }, { x: x - size, y },
      ].map((p2) => {
        const cos = Math.cos(a + Math.PI / 2);
        const sin = Math.sin(a + Math.PI / 2);
        const dx = p2.x - x;
        const dy = p2.y - y;
        return `${(x + dx * cos - dy * sin).toFixed(1)},${(y + dx * sin + dy * cos).toFixed(1)}`;
      }).join(" ");
      svg.appendChild(el("polygon", {
        points: pts, fill: "none", stroke: color, "stroke-width": "1.6",
        "fill-opacity": "0.15", "stroke-opacity": "0.9", class: "transit-marker",
      }));
      svg.appendChild(el("text", {
        x, y, "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": "7", fill: color, "font-weight": "700",
      }, sym));

      if (wd.positions && wd.positions[p] != null) {
        const { x: nx, y: ny } = pt(308, wd.positions[p]);
        svg.appendChild(el("line", {
          x1: x, y1: y, x2: nx, y2: ny, stroke: color, "stroke-width": "0.7",
          "stroke-dasharray": "3 3", "stroke-opacity": "0.45",
        }));
      }
    }
  }

  function tick() {
    if (!playing) return;
    transitDays += DAYS_PER_TICK;
    drawNakshatraWheel(wheelData());
    const label = document.getElementById("wheel-day-label");
    if (label) label.textContent = `+${transitDays} day${transitDays === 1 ? "" : "s"}`;
  }

  function start() {
    drawNakshatraWheel(wheelData());
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      playing = false;
      const live = document.querySelector(".wheel-live");
      if (live) live.textContent = "Transits (paused)";
      return;
    }
    timer = setInterval(tick, TICK_MS);
  }

  function stop() {
    playing = false;
    if (timer) clearInterval(timer);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      playing = true;
      timer = setInterval(tick, TICK_MS);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
