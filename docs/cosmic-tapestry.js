/**
 * Nakshatra Chakram — Living Celestial Zodiac Constellation Tapestry
 *
 * Renders a full-viewport slowly revolving astronomical tapestry of all 12 Zodiac
 * constellations (authentic iconic star asterisms, gossamer starlight filaments,
 * 4-point alpha star diffraction spikes, faint celestial coordinate meridians,
 * and nebula depth) adapting gracefully between Night Obsidian and Daylight
 * Engraved Star-Atlas Parchment themes.
 */
(function (root) {
  "use strict";

  const DEG = Math.PI / 180;

  // Authentic iconic 12 Zodiac Constellation asterisms (normalized coordinates in [-1, 1])
  // stars: [x, y, mag (0=alpha brightest .. 2=faint)], edges: [[i, j], ...]
  const CONSTELLATIONS = [
    {
      name: "MESHA · ARIES",
      stars: [[-0.65, -0.18, 0], [-0.08, -0.05, 1], [0.42, 0.14, 1], [0.68, 0.36, 2]],
      edges: [[0, 1], [1, 2], [2, 3]],
    },
    {
      name: "VRISHABHA · TAURUS",
      stars: [
        [-0.78, -0.42, 1], [-0.15, -0.10, 0], [0.08, 0.02, 1], [0.22, 0.18, 2],
        [0.05, 0.30, 1], [-0.22, 0.14, 1], [-0.72, 0.34, 1], [0.58, -0.32, 1], [0.72, -0.22, 2],
      ],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [5, 6], [2, 7], [7, 8]],
    },
    {
      name: "MITHUNA · GEMINI",
      stars: [
        [-0.45, -0.68, 0], [0.22, -0.58, 0], [-0.36, -0.18, 1], [0.24, -0.10, 1],
        [-0.54, 0.32, 1], [-0.14, 0.42, 2], [0.16, 0.48, 1], [0.56, 0.36, 1],
      ],
      edges: [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [2, 5], [3, 6], [3, 7]],
    },
    {
      name: "KARKA · CANCER",
      stars: [[0.0, -0.62, 1], [-0.04, -0.04, 1], [-0.48, 0.50, 1], [0.52, 0.44, 0], [0.12, -0.26, 2]],
      edges: [[0, 4], [4, 1], [1, 2], [1, 3]],
    },
    {
      name: "SIMHA · LEO",
      stars: [
        [-0.70, 0.20, 0], [-0.58, -0.10, 1], [-0.46, -0.42, 1], [-0.20, -0.56, 1],
        [-0.08, -0.34, 2], [-0.28, -0.12, 1], [0.22, -0.16, 1], [0.68, 0.14, 0], [0.16, 0.24, 1],
      ],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 7], [7, 8], [8, 0]],
    },
    {
      name: "KANYA · VIRGO",
      stars: [
        [-0.64, -0.32, 1], [-0.22, -0.44, 1], [0.16, -0.26, 1], [0.58, -0.38, 1],
        [-0.12, 0.08, 1], [0.34, 0.16, 1], [0.56, 0.56, 0], [-0.52, 0.36, 2],
      ],
      edges: [[0, 1], [1, 2], [2, 3], [1, 4], [2, 5], [4, 5], [5, 6], [4, 7]],
    },
    {
      name: "TULA · LIBRA",
      stars: [[0.0, -0.58, 0], [-0.52, -0.02, 0], [0.52, 0.06, 1], [0.06, 0.54, 1], [-0.36, 0.58, 2]],
      edges: [[0, 1], [0, 2], [1, 2], [1, 4], [2, 3]],
    },
    {
      name: "VRISHCHIKA · SCORPIO",
      stars: [
        [-0.72, -0.46, 1], [-0.58, -0.22, 1], [-0.66, 0.04, 1], [-0.30, -0.18, 0],
        [-0.04, 0.04, 1], [0.12, 0.34, 1], [0.38, 0.54, 1], [0.64, 0.44, 1], [0.68, 0.18, 0], [0.52, 0.12, 2],
      ],
      edges: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]],
    },
    {
      name: "DHANU · SAGITTARIUS",
      stars: [
        [-0.58, 0.14, 1], [-0.28, -0.28, 1], [0.04, -0.54, 1], [0.32, -0.22, 0],
        [0.62, -0.04, 1], [0.36, 0.32, 0], [-0.14, 0.34, 1], [0.08, 0.02, 1],
      ],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [1, 7], [7, 3], [7, 5]],
    },
    {
      name: "MAKARA · CAPRICORN",
      stars: [
        [-0.68, -0.36, 0], [-0.22, -0.16, 1], [0.24, -0.18, 1], [0.66, -0.38, 0],
        [0.42, 0.24, 1], [0.02, 0.48, 1], [-0.36, 0.20, 1],
      ],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]],
    },
    {
      name: "KUMBHA · AQUARIUS",
      stars: [
        [-0.62, -0.32, 0], [-0.24, -0.44, 1], [0.16, -0.22, 0], [0.44, -0.34, 1],
        [0.06, 0.08, 1], [0.38, 0.22, 1], [0.64, 0.46, 1], [-0.26, 0.36, 2],
      ],
      edges: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6], [4, 7]],
    },
    {
      name: "MEENA · PISCES",
      stars: [
        [-0.66, -0.44, 1], [-0.48, -0.54, 2], [-0.38, -0.32, 1], [-0.54, -0.22, 1],
        [-0.18, 0.14, 1], [0.18, 0.48, 0], [0.46, 0.10, 1], [0.66, -0.24, 1],
      ],
      edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6], [6, 7]],
    },
  ];

  // Deep parallax field stars (160 deterministic stars across the sky)
  const FIELD_STARS = Array.from({ length: 160 }, (_, i) => ({
    angle: (i * 137.508 + (i % 7) * 11.3) % 360,
    distFrac: 0.16 + ((i * 53) % 100) / 108,
    size: 0.55 + ((i * 17) % 10) * 0.15,
    phase: i * 0.85,
    twinkleSpeed: 0.0008 + ((i * 13) % 9) * 0.00022,
    warm: i % 3 === 0,
  }));

  let canvas = null;
  let ctx = null;
  let W = 1280;
  let H = 800;
  let dpr = 1;
  let dialAngleRad = 0;

  function resize() {
    if (!canvas) return;
    W = window.innerWidth || 1280;
    H = window.innerHeight || 800;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }

  function getAnchorCenter() {
    const dial = document.getElementById("cosmicDialCanvas");
    if (dial) {
      const r = dial.getBoundingClientRect();
      if (r.width > 100) {
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, dialR: r.width / 2 };
      }
    }
    return { cx: W * 0.42, cy: H * 0.5, dialR: Math.min(W, H) * 0.42 };
  }

  function drawStar(x, y, radius, alpha, colorRgb, isAlphaStar) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${colorRgb}, ${alpha.toFixed(3)})`;
    ctx.fill();

    if (isAlphaStar) {
      const spike = radius * 3.8;
      ctx.beginPath();
      ctx.moveTo(x - spike, y);
      ctx.lineTo(x + spike, y);
      ctx.moveTo(x, y - spike);
      ctx.lineTo(x, y + spike);
      ctx.strokeStyle = `rgba(${colorRgb}, ${(alpha * 0.52).toFixed(3)})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  function render(nowMs) {
    if (!ctx) return;
    const isLight = document.documentElement.dataset.theme === "light";
    const { cx, cy, dialR } = getAnchorCenter();
    const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Subtle slow independent sidereal drift + gentle coupling to dial rotation
    const drift = nowMs * 0.000018 + dialAngleRad * 0.04;

    // 1. Faint Engraved Astronomical Tapestry Coordinate Rings & Meridians
    const gridStroke = isLight ? "rgba(132, 98, 42, 0.085)" : "rgba(218, 184, 114, 0.06)";
    ctx.strokeStyle = gridStroke;
    ctx.lineWidth = 0.85;
    for (const mult of [1.18, 1.48, 1.82]) {
      ctx.beginPath();
      ctx.arc(cx, cy, dialR * mult, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const a = i * 30 * DEG + drift;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * dialR * 1.06, cy + Math.sin(a) * dialR * 1.06);
      ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
      ctx.stroke();
    }

    // 2. Deep Twinkling Starfield Parallax
    const warmRgb = isLight ? "148, 102, 34" : "248, 222, 162";
    const coolRgb = isLight ? "96, 112, 146" : "188, 212, 255";
    for (const s of FIELD_STARS) {
      const a = s.angle * DEG + drift * 0.55;
      const rr = dialR * 0.95 + s.distFrac * (maxR - dialR * 0.7);
      const sx = cx + Math.cos(a) * rr;
      const sy = cy + Math.sin(a) * rr;
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
      const tw = 0.45 + 0.55 * Math.sin(nowMs * s.twinkleSpeed + s.phase);
      const alpha = tw * (isLight ? 0.34 : 0.52);
      drawStar(sx, sy, s.size, alpha, s.warm ? warmRgb : coolRgb, false);
    }

    // 3. The 12 Revolving Zodiac Constellations Tapestry Ring
    const ringR = dialR * 1.38;
    const scale = Math.max(46, Math.min(76, dialR * 0.19));
    const lineColor = isLight ? "rgba(138, 96, 30, 0.24)" : "rgba(226, 192, 118, 0.24)";
    const labelColor = isLight ? "rgba(118, 82, 24, 0.36)" : "rgba(218, 184, 118, 0.32)";

    for (let i = 0; i < 12; i++) {
      const c = CONSTELLATIONS[i];
      // Counter-clockwise ecliptic arrangement matching the cosmic dial
      const baseA = -i * 30 * DEG - Math.PI / 2 + drift;
      const ox = cx + Math.cos(baseA) * ringR;
      const oy = cy + Math.sin(baseA) * ringR;
      if (ox < -120 || ox > W + 120 || oy < -120 || oy > H + 120) continue;

      const cosR = Math.cos(baseA + Math.PI / 2);
      const sinR = Math.sin(baseA + Math.PI / 2);
      const pts = c.stars.map(([sx, sy, mag]) => {
        const rx = sx * scale;
        const ry = sy * scale;
        return {
          x: ox + rx * cosR - ry * sinR,
          y: oy + rx * sinR + ry * cosR,
          mag,
        };
      });

      // Gossamer constellation filament lines
      ctx.beginPath();
      for (const [aIdx, bIdx] of c.edges) {
        const pa = pts[aIdx];
        const pb = pts[bIdx];
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
      }
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 0.95;
      ctx.stroke();

      // Constellation Stars with twinkling magnitude & alpha spikes
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k];
        const tw = 0.72 + 0.28 * Math.sin(nowMs * 0.0018 + i * 2.1 + k * 1.3);
        const rad = p.mag === 0 ? 2.3 : (p.mag === 1 ? 1.55 : 1.05);
        const alpha = (p.mag === 0 ? 0.85 : (p.mag === 1 ? 0.62 : 0.42)) * tw * (isLight ? 0.75 : 1.0);
        drawStar(p.x, p.y, rad, alpha, p.mag === 0 ? warmRgb : coolRgb, p.mag === 0);
      }

      // Faint engraved tapestry constellation label
      ctx.save();
      ctx.font = `600 8.5px "Cinzel", serif`;
      ctx.fillStyle = labelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lx = cx + Math.cos(baseA) * (ringR + scale * 0.78);
      const ly = cy + Math.sin(baseA) * (ringR + scale * 0.78);
      ctx.fillText(c.name, lx, ly);
      ctx.restore();
    }

    requestAnimationFrame(render);
  }

  function init() {
    canvas = document.getElementById("celestialTapestry");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(render);
  }

  root.CelestialTapestry = {
    setDialAngle(rad) { dialAngleRad = rad; },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
