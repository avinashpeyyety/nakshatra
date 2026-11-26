/**
 * Nakshatra Chakram — Built-In High-Precision Sidereal Astronomical & Jyotish Engine
 *
 * Zero external dependencies. Runs 100% locally in the browser at 60 FPS.
 * Supports:
 *   - Lahiri (Chitrapaksha) and B.V. Raman ayanamsas (calibrated against Swiss Ephemeris)
 *   - Real Keplerian + perturbation geocentric positions for all 9 Navagrahas (with true retrograde loops)
 *   - Exact Sidereal Lagna (Ascendant) for any birth date, time, and geographic location
 *   - All 12 Rasis, 27 Nakshatras, and 108 Nakshatra Padas (with Sanskrit, Deity, Symbol, Gana, Beeja, Navamsa)
 *   - Classical Vedic Graha Drishti, Double Transits (Jupiter + Saturn), Triple Transits (Jupiter + Saturn + Rahu/Ketu),
 *     and Exact Slow-Planet Pada Crossings
 */
(function (root) {
  "use strict";

  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;
  const J2000 = 2451545.0;

  function norm360(d) {
    return ((d % 360) + 360) % 360;
  }

  function angDiff(a, b) {
    let d = Math.abs(norm360(a) - norm360(b));
    return d > 180 ? 360 - d : d;
  }

  function fmtDMS(deg) {
    const v = norm360(deg);
    const d = Math.floor(v);
    const mf = (v - d) * 60;
    const m = Math.floor(mf);
    const s = Math.floor((mf - m) * 60);
    return `${String(d).padStart(2, "0")}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″`;
  }

  function fmtDM(deg) {
    const v = ((deg % 360) + 360) % 360;
    let d = Math.floor(v);
    let m = Math.round((v - d) * 60);
    if (m === 60) { d += 1; m = 0; }
    return `${d}°${String(m).padStart(2, "0")}′`;
  }

  // ---------------------------------------------------------------------------
  // Julian Day & Calendar Utilities
  // ---------------------------------------------------------------------------

  function ymdhmsToJD(year, month, day, hourUtc = 0) {
    let y = year;
    let m = month;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + hourUtc / 24 + B - 1524.5;
  }

  function dateToJD(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  function jdToDate(jd) {
    return new Date((jd - 2440587.5) * 86400000);
  }

  function dayOfYearUtc(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const cur = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const doy = Math.floor((cur - start) / 86400000) + 1;
    const y = date.getUTCFullYear();
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    return { doy, daysInYear: isLeap ? 366 : 365, year: y };
  }

  /**
   * Convert local birth date/time + IANA timezone (or numeric UTC offset hours) to exact Julian Day UTC.
   */
  function localBirthToJD(dateStr, timeStr, tzOrOffset) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = (timeStr || "12:00").split(":").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      return dateToJD(new Date());
    }
    const hour = Number.isFinite(hh) ? hh : 12;
    const min = Number.isFinite(mm) ? mm : 0;

    if (typeof tzOrOffset === "number" && Number.isFinite(tzOrOffset)) {
      return ymdhmsToJD(y, m, d, hour + min / 60 - tzOrOffset);
    }

    if (typeof tzOrOffset === "string" && tzOrOffset.includes("/")) {
      try {
        // Compute exact historical/DST offset for that IANA timezone using Intl API
        const guessUtcMs = Date.UTC(y, m - 1, d, hour, min, 0);
        const fmt = new Intl.DateTimeFormat("en-US", {
          timeZone: tzOrOffset,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false,
        });
        const partsToMs = (ms) => {
          const p = {};
          for (const it of fmt.formatToParts(new Date(ms))) p[it.type] = it.value;
          const hr = Number(p.hour) === 24 ? 0 : Number(p.hour);
          return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hr, Number(p.minute), Number(p.second));
        };
        let utcMs = guessUtcMs;
        for (let iter = 0; iter < 2; iter++) {
          const wallMs = partsToMs(utcMs);
          utcMs += (guessUtcMs - wallMs);
        }
        return utcMs / 86400000 + 2440587.5;
      } catch (_) {
        // fallback below
      }
    }
    return ymdhmsToJD(y, m, d, hour + min / 60);
  }

  // ---------------------------------------------------------------------------
  // Ayanamsa Engine (Lahiri Chitrapaksha & B.V. Raman — Calibrated to swisseph)
  // ---------------------------------------------------------------------------

  const LAHIRI_J2000 = 23.857092; // 23°51′25.53″ (Swiss Ephemeris SIDM_LAHIRI at J2000.0)
  const RAMAN_OFFSET = 1.44630;   // Exact Swiss Ephemeris SIDM_LAHIRI - SIDM_RAMAN delta

  function getAyanamsa(jd, mode = "lahiri") {
    const T = (jd - J2000) / 36525.0;
    // IAU / Newcomb general precession in longitude matching Swiss Ephemeris Lahiri to <0.002° across 1900–2100
    const lahiri = LAHIRI_J2000 + 1.39697137 * T + 0.0003088 * T * T;
    if (String(mode).toLowerCase() === "raman") {
      return lahiri - RAMAN_OFFSET;
    }
    return lahiri;
  }

  // ---------------------------------------------------------------------------
  // Canonical Vedic Metadata: 12 Rasis, 27 Nakshatras, 108 Padas
  // ---------------------------------------------------------------------------

  const RASIS = [
    { idx: 0,  sanskrit: "Mesha",      dev: "मेष",    english: "Aries",       glyph: "♈\uFE0E", element: "Agni",    elIdx: 0, ruler: "Mars",    vibe: "Initiating Fire · Cardinal Force" },
    { idx: 1,  sanskrit: "Vrishabha",  dev: "वृषभ",   english: "Taurus",      glyph: "♉\uFE0E", element: "Prithvi", elIdx: 1, ruler: "Venus",   vibe: "Steadfast Earth · Abundance" },
    { idx: 2,  sanskrit: "Mithuna",    dev: "मिथुन",  english: "Gemini",      glyph: "♊\uFE0E", element: "Vayu",    elIdx: 2, ruler: "Mercury", vibe: "Quicksilver Air · Dual Intellect" },
    { idx: 3,  sanskrit: "Karka",      dev: "कर्क",   english: "Cancer",      glyph: "♋\uFE0E", element: "Jala",    elIdx: 3, ruler: "Moon",    vibe: "Tidal Water · Sanctuary" },
    { idx: 4,  sanskrit: "Simha",      dev: "सिंह",   english: "Leo",         glyph: "♌\uFE0E", element: "Agni",    elIdx: 0, ruler: "Sun",     vibe: "Sovereign Fire · Solar Throne" },
    { idx: 5,  sanskrit: "Kanya",      dev: "कन्या",  english: "Virgo",       glyph: "♍\uFE0E", element: "Prithvi", elIdx: 1, ruler: "Mercury", vibe: "Analytical Earth · Precision" },
    { idx: 6,  sanskrit: "Tula",       dev: "तुला",   english: "Libra",       glyph: "♎\uFE0E", element: "Vayu",    elIdx: 2, ruler: "Venus",   vibe: "Equilibrium Air · Scales" },
    { idx: 7,  sanskrit: "Vrishchika", dev: "वृश्चिक", english: "Scorpio",     glyph: "♏\uFE0E", element: "Jala",    elIdx: 3, ruler: "Mars",    vibe: "Alchemical Water · Occult Depth" },
    { idx: 8,  sanskrit: "Dhanu",      dev: "धनु",    english: "Sagittarius", glyph: "♐\uFE0E", element: "Agni",    elIdx: 0, ruler: "Jupiter", vibe: "Dharmic Fire · Arrow of Truth" },
    { idx: 9,  sanskrit: "Makara",     dev: "मकर",    english: "Capricorn",   glyph: "♑\uFE0E", element: "Prithvi", elIdx: 1, ruler: "Saturn",  vibe: "Crystalline Earth · Endurance" },
    { idx: 10, sanskrit: "Kumbha",     dev: "कुम्भ",  english: "Aquarius",    glyph: "♒\uFE0E", element: "Vayu",    elIdx: 2, ruler: "Saturn",  vibe: "Cosmic Air · Vessel of Currents" },
    { idx: 11, sanskrit: "Meena",      dev: "मीन",    english: "Pisces",      glyph: "♓\uFE0E", element: "Jala",    elIdx: 3, ruler: "Jupiter", vibe: "Oceanic Water · Dissolution" },
  ];

  const NAKSHATRAS = [
    { idx: 0,  name: "Ashwini",           short: "Ash", dev: "अश्विनी",         ruler: "Ketu",    deity: "Ashwini Kumaras", symbol: "Horse Head",      gana: "Deva",      padas: ["Chu", "Che", "Cho", "La"] },
    { idx: 1,  name: "Bharani",           short: "Bha", dev: "भरणी",            ruler: "Venus",   deity: "Yama",            symbol: "Yoni",            gana: "Manushya",  padas: ["Lee", "Lu", "Le", "Lo"] },
    { idx: 2,  name: "Krittika",          short: "Kri", dev: "कृत्तिका",        ruler: "Sun",     deity: "Agni",            symbol: "Flame / Blade",   gana: "Rakshasa",  padas: ["A", "Ee", "U", "Ea"] },
    { idx: 3,  name: "Rohini",            short: "Roh", dev: "रोहिणी",          ruler: "Moon",    deity: "Brahma",          symbol: "Chariot",         gana: "Manushya",  padas: ["O", "Va", "Vi", "Vu"] },
    { idx: 4,  name: "Mrigashira",        short: "Mri", dev: "मृगशिरा",         ruler: "Mars",    deity: "Soma",            symbol: "Deer Head",       gana: "Deva",      padas: ["Ve", "Vo", "Ka", "Ki"] },
    { idx: 5,  name: "Ardra",             short: "Ard", dev: "आर्द्रा",         ruler: "Rahu",    deity: "Rudra",           symbol: "Teardrop",        gana: "Manushya",  padas: ["Ku", "Gha", "Ng", "Chha"] },
    { idx: 6,  name: "Punarvasu",         short: "Pun", dev: "पुनर्वसु",        ruler: "Jupiter", deity: "Aditi",           symbol: "Quiver of Arrows", gana: "Deva",      padas: ["Ke", "Ko", "Ha", "Hi"] },
    { idx: 7,  name: "Pushya",            short: "Pus", dev: "पुष्य",           ruler: "Saturn",  deity: "Brihaspati",      symbol: "Lotus / Wheel",   gana: "Deva",      padas: ["Hu", "He", "Ho", "Da"] },
    { idx: 8,  name: "Ashlesha",          short: "Asl", dev: "आश्लेषा",         ruler: "Mercury", deity: "Sarpas",          symbol: "Coiled Serpent",  gana: "Rakshasa",  padas: ["Di", "Du", "De", "Do"] },
    { idx: 9,  name: "Magha",             short: "Mag", dev: "मघा",             ruler: "Ketu",    deity: "Pitris",          symbol: "Royal Throne",    gana: "Rakshasa",  padas: ["Ma", "Mi", "Mu", "Me"] },
    { idx: 10, name: "Purva Phalguni",    short: "PPh", dev: "पूर्वाफाल्गुनी", ruler: "Venus",   deity: "Bhaga",           symbol: "Hammock / Couch", gana: "Manushya",  padas: ["Mo", "Ta", "Ti", "Tu"] },
    { idx: 11, name: "Uttara Phalguni",   short: "UPh", dev: "उत्तराफाल्गुनी", ruler: "Sun",     deity: "Aryaman",         symbol: "Bed / Pillar",    gana: "Manushya",  padas: ["Te", "To", "Pa", "Pi"] },
    { idx: 12, name: "Hasta",             short: "Has", dev: "हस्त",            ruler: "Moon",    deity: "Savitr",          symbol: "Open Palm",       gana: "Deva",      padas: ["Pu", "Sha", "Na", "Tha"] },
    { idx: 13, name: "Chitra",            short: "Chi", dev: "चित्रा",          ruler: "Mars",    deity: "Tvashtar",        symbol: "Shining Jewel",   gana: "Rakshasa",  padas: ["Pe", "Po", "Ra", "Ri"] },
    { idx: 14, name: "Swati",             short: "Swa", dev: "स्वाती",          ruler: "Rahu",    deity: "Vayu",            symbol: "Coral Shoot",     gana: "Deva",      padas: ["Ru", "Re", "Ro", "Ta"] },
    { idx: 15, name: "Vishakha",          short: "Vis", dev: "विशाखा",          ruler: "Jupiter", deity: "Indra-Agni",      symbol: "Triumphal Arch",  gana: "Rakshasa",  padas: ["Ti", "Tu", "Te", "To"] },
    { idx: 16, name: "Anuradha",          short: "Anu", dev: "अनुराधा",         ruler: "Saturn",  deity: "Mitra",           symbol: "Lotus Staff",     gana: "Deva",      padas: ["Na", "Ni", "Nu", "Ne"] },
    { idx: 17, name: "Jyeshtha",          short: "Jye", dev: "ज्येष्ठा",        ruler: "Mercury", deity: "Indra",           symbol: "Talisman Ring",   gana: "Rakshasa",  padas: ["No", "Ya", "Yi", "Yu"] },
    { idx: 18, name: "Mula",              short: "Mul", dev: "मूल",             ruler: "Ketu",    deity: "Nirrti",          symbol: "Tied Roots",      gana: "Rakshasa",  padas: ["Ye", "Yo", "Bha", "Bhi"] },
    { idx: 19, name: "Purva Ashadha",     short: "PAs", dev: "पूर्वाषाढ़ा",     ruler: "Venus",   deity: "Apas",            symbol: "Winnowing Fan",   gana: "Manushya",  padas: ["Bhu", "Dha", "Pha", "Dha"] },
    { idx: 20, name: "Uttara Ashadha",    short: "UAs", dev: "उत्तराषाढ़ा",     ruler: "Sun",     deity: "Vishvedevas",     symbol: "Elephant Tusk",   gana: "Manushya",  padas: ["Bhe", "Bho", "Ja", "Ji"] },
    { idx: 21, name: "Shravana",          short: "Shr", dev: "श्रवण",           ruler: "Moon",    deity: "Vishnu",          symbol: "Three Footprints", gana: "Deva",      padas: ["Ju", "Je", "Jo", "Gha"] },
    { idx: 22, name: "Dhanishtha",        short: "Dha", dev: "धनिष्ठा",         ruler: "Mars",    deity: "Eight Vasus",     symbol: "Damaru Drum",     gana: "Rakshasa",  padas: ["Ga", "Gi", "Gu", "Ge"] },
    { idx: 23, name: "Shatabhisha",       short: "Sha", dev: "शतभिषा",          ruler: "Rahu",    deity: "Varuna",          symbol: "Empty Circle",    gana: "Rakshasa",  padas: ["Go", "Sa", "Si", "Su"] },
    { idx: 24, name: "Purva Bhadrapada",  short: "PBh", dev: "पूर्वभाद्रपद",    ruler: "Jupiter", deity: "Aja Ekapada",     symbol: "Two-Faced Sword", gana: "Manushya",  padas: ["Se", "So", "Da", "Di"] },
    { idx: 25, name: "Uttara Bhadrapada", short: "UBh", dev: "उत्तरभाद्रपद",    ruler: "Saturn",  deity: "Ahir Budhnya",    symbol: "Twins / Ocean",   gana: "Manushya",  padas: ["Du", "Tha", "Jha", "Da"] },
    { idx: 26, name: "Revati",            short: "Rev", dev: "रेवती",           ruler: "Mercury", deity: "Pushan",          symbol: "Mridanga / Fish", gana: "Deva",      padas: ["De", "Do", "Cha", "Chi"] },
  ];

  const NAVAMSA_START = [0, 9, 6, 3]; // Fire->Aries, Earth->Capricorn, Air->Libra, Water->Cancer
  const PADA_SPAN = 360 / 108; // 3°20′ exactly

  const PADAS = [];
  for (let p = 0; p < 108; p++) {
    const nakIdx = Math.floor(p / 4);
    const padaNum = (p % 4) + 1;
    const startDeg = p * PADA_SPAN;
    const endDeg = (p + 1) * PADA_SPAN;
    const midDeg = startDeg + PADA_SPAN / 2;
    const rasiIdx = Math.floor(midDeg / 30) % 12;
    const degInSign = midDeg % 30;
    const navNum = Math.floor((degInSign * 9) / 30);
    const navamsaIdx = (NAVAMSA_START[rasiIdx % 4] + navNum) % 12;
    const isGandanta = p === 0 || p === 107 || p === 35 || p === 36 || p === 71 || p === 72;
    PADAS.push({
      id: p,
      num: p + 1,
      nakIdx,
      nak: NAKSHATRAS[nakIdx],
      padaNum,
      beeja: NAKSHATRAS[nakIdx].padas[padaNum - 1],
      rasiIdx,
      rasi: RASIS[rasiIdx],
      navamsaIdx,
      navamsa: RASIS[navamsaIdx],
      startDeg,
      endDeg,
      midDeg,
      isGandanta,
    });
  }

  const PLANETS = [
    { id: "Sun",     sym: "☉", short: "Sun",  sanskrit: "Surya",   dev: "सूर्य",  color: "#ffb636", glow: "rgba(255,182,54,0.85)",  slow: false },
    { id: "Moon",    sym: "☽", short: "Moon", sanskrit: "Chandra", dev: "चन्द्र", color: "#e6ecf7", glow: "rgba(220,232,255,0.85)", slow: false },
    { id: "Mercury", sym: "☿", short: "Mer",  sanskrit: "Budha",   dev: "बुध",    color: "#38d9a9", glow: "rgba(56,217,169,0.75)",  slow: false },
    { id: "Venus",   sym: "♀", short: "Ven",  sanskrit: "Shukra",  dev: "शुक्र",  color: "#f783ac", glow: "rgba(247,131,172,0.75)", slow: false },
    { id: "Mars",    sym: "♂", short: "Mars", sanskrit: "Mangala", dev: "मंगल",   color: "#ff5c47", glow: "rgba(255,92,71,0.85)",   slow: false },
    { id: "Jupiter", sym: "♃", short: "Jup",  sanskrit: "Guru",    dev: "गुरु",   color: "#ffd43b", glow: "rgba(255,212,59,0.9)",   slow: true  },
    { id: "Saturn",  sym: "♄", short: "Sat",  sanskrit: "Shani",   dev: "शनि",    color: "#8ea8cc", glow: "rgba(142,168,204,0.85)", slow: true  },
    { id: "Rahu",    sym: "☊", short: "Rahu", sanskrit: "Rahu",    dev: "राहु",   color: "#b197fc", glow: "rgba(177,151,252,0.85)", slow: true  },
    { id: "Ketu",    sym: "☋", short: "Ketu", sanskrit: "Ketu",    dev: "केतु",   color: "#ff922b", glow: "rgba(255,146,43,0.8)",   slow: true  },
  ];
  const PLANET_MAP = Object.fromEntries(PLANETS.map((p) => [p.id, p]));
  PLANET_MAP.Lagna = { id: "Lagna", sym: "Asc", short: "Asc", sanskrit: "Lagna", dev: "लग्न", color: "#63e6be", glow: "rgba(99,230,190,0.9)", slow: false };

  // ---------------------------------------------------------------------------
  // High-Precision Astronomical Orbital Elements (J2000.0 + Centennial Rates)
  // Standard Standish / Schlyter / Meeus Keplerian elements + Jup-Sat perturbations
  // ---------------------------------------------------------------------------

  function solveKepler(Mdeg, e) {
    const M = norm360(Mdeg) * DEG;
    let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
    for (let i = 0; i < 8; i++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-9) break;
    }
    return E;
  }

  /** Heliocentric ecliptic rectangular coords (x, y, z in AU) in J2000 ecliptic, precessed to equinox of date */
  function helioRect(el, d) {
    const N = norm360(el.N0 + el.N1 * d) * DEG;
    const i = (el.i0 + el.i1 * d) * DEG;
    const w = norm360(el.w0 + el.w1 * d) * DEG;
    const a = el.a0 + (el.a1 || 0) * d;
    const e = el.e0 + el.e1 * d;
    const M = norm360(el.M0 + el.M1 * d);
    const E = solveKepler(M, e);
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    const r = Math.hypot(xv, yv);
    const u = v + w;
    const cosN = Math.cos(N), sinN = Math.sin(N);
    const cosU = Math.cos(u), sinU = Math.sin(u);
    const cosI = Math.cos(i), sinI = Math.sin(i);
    const x = r * (cosN * cosU - sinN * sinU * cosI);
    const y = r * (sinN * cosU + cosN * sinU * cosI);
    const z = r * (sinU * sinI);
    return { x, y, z, r, lon: norm360(Math.atan2(y, x) * RAD), M };
  }

  // Epoch: 2000 Jan 0.0 UT = JD 2451543.5 (Paul Schlyter / JPL elements, equinox of date)
  const ORBIT_EL = {
    Sun: { // Earth inverse (gives geocentric Sun directly)
      N0: 0, N1: 0, i0: 0, i1: 0,
      w0: 282.9404, w1: 4.70935e-5,
      a0: 1.0, e0: 0.016709, e1: -1.151e-9,
      M0: 356.0470, M1: 0.9856002585,
    },
    Mercury: {
      N0: 48.3313, N1: 3.24587e-5,
      i0: 7.0047, i1: 5.00e-8,
      w0: 29.1241, w1: 1.01444e-5,
      a0: 0.387098, e0: 0.205635, e1: 5.59e-10,
      M0: 168.6562, M1: 4.0923344368,
    },
    Venus: {
      N0: 76.6799, N1: 2.46590e-5,
      i0: 3.3946, i1: 2.75e-8,
      w0: 54.8910, w1: 1.38374e-5,
      a0: 0.723330, e0: 0.006773, e1: -1.302e-9,
      M0: 48.0052, M1: 1.6021302244,
    },
    Mars: {
      N0: 49.5574, N1: 2.11081e-5,
      i0: 1.8497, i1: -1.78e-8,
      w0: 286.5016, w1: 2.92961e-5,
      a0: 1.523688, e0: 0.093405, e1: 2.516e-9,
      M0: 18.6021, M1: 0.5240207766,
    },
    Jupiter: {
      N0: 100.4542, N1: 2.76854e-5,
      i0: 1.3030, i1: -1.557e-7,
      w0: 273.8777, w1: 1.64505e-5,
      a0: 5.20256, e0: 0.048498, e1: 4.469e-9,
      M0: 19.8950, M1: 0.0830853001,
    },
    Saturn: {
      N0: 113.6634, N1: 2.38980e-5,
      i0: 2.4886, i1: -1.081e-7,
      w0: 339.3939, w1: 2.97661e-5,
      a0: 9.55475, e0: 0.055546, e1: -9.499e-9,
      M0: 316.9670, M1: 0.0334442282,
    },
  };

  /** High-precision geocentric tropical longitudes for all 9 Navagrahas (degrees, equinox of date) */
  function computeTropical(jd) {
    const d = jd - 2451543.5; // days since 2000 Jan 0.0 UT
    const T = (jd - J2000) / 36525.0;

    // 1. Sun (geocentric ecliptic coords = -Earth heliocentric coords)
    const sunEl = ORBIT_EL.Sun;
    const wS = norm360(sunEl.w0 + sunEl.w1 * d);
    const eS = sunEl.e0 + sunEl.e1 * d;
    const Ms = norm360(sunEl.M0 + sunEl.M1 * d);
    const Es = solveKepler(Ms, eS);
    const xs = Math.cos(Es) - eS;
    const ys = Math.sqrt(1 - eS * eS) * Math.sin(Es);
    const rs = Math.hypot(xs, ys);
    const vs = Math.atan2(ys, xs) * RAD;
    const sunLon = norm360(vs + wS);
    const xsEcl = rs * Math.cos(sunLon * DEG);
    const ysEcl = rs * Math.sin(sunLon * DEG);

    // 2. Moon (Meeus Ch. 47 periodic lunar series — ~0.03° accuracy)
    const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
    const D  = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T);
    const M  = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T);
    const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T);
    const F  = norm360(93.2720950  + 483202.0175233 * T - 0.0036539 * T * T);
    const A1 = norm360(119.75 + 131.849 * T);
    const A2 = norm360(53.09  + 479264.290 * T);
    const Ecorr = 1 - 0.002516 * T - 0.0000074 * T * T;

    const s = (deg) => Math.sin(deg * DEG);
    let dL = 0;
    dL += 6.288774 * s(Mp);
    dL += 1.274027 * s(2 * D - Mp);
    dL += 0.658314 * s(2 * D);
    dL += 0.213618 * s(2 * Mp);
    dL -= 0.185116 * Ecorr * s(M);
    dL -= 0.114332 * s(2 * F);
    dL += 0.058793 * s(2 * D - 2 * Mp);
    dL += 0.057066 * Ecorr * s(2 * D - M - Mp);
    dL += 0.053322 * s(2 * D + Mp);
    dL += 0.045758 * Ecorr * s(2 * D - M);
    dL -= 0.040923 * Ecorr * s(M - Mp);
    dL -= 0.034720 * s(D);
    dL -= 0.030383 * Ecorr * s(M + Mp);
    dL += 0.015327 * s(2 * D - 2 * F);
    dL -= 0.012528 * s(Mp + 2 * F);
    dL += 0.010980 * s(Mp - 2 * F);
    dL += 0.010675 * s(4 * D - Mp);
    dL += 0.010034 * s(3 * Mp);
    dL += 0.008548 * s(4 * D - 2 * Mp);
    dL -= 0.007888 * Ecorr * s(2 * D + M - Mp);
    dL -= 0.006766 * Ecorr * s(2 * D + M);
    dL -= 0.005163 * s(D - Mp);
    dL += 0.004987 * Ecorr * s(D + M);
    dL += 0.004036 * Ecorr * s(2 * D - M + Mp);
    dL += 0.003994 * s(2 * D + 2 * Mp);
    dL += 0.003861 * s(4 * D);
    dL += 0.003665 * s(2 * D - 3 * Mp);
    dL += 0.003958 * s(A1) + 0.001962 * s(Lp - F) + 0.000318 * s(A2);
    const moonLon = norm360(Lp + dL);

    // 3. Rahu (Mean Ascending Lunar Node) & Ketu (Meeus Ch. 47)
    const rahuLon = norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441);
    const ketuLon = norm360(rahuLon + 180);

    // 4. Inner & Outer Planets (Keplerian heliocentric + Jupiter/Saturn Great Inequality perturbations)
    const hMer = helioRect(ORBIT_EL.Mercury, d);
    const hVen = helioRect(ORBIT_EL.Venus, d);
    const hMar = helioRect(ORBIT_EL.Mars, d);
    const hJup = helioRect(ORBIT_EL.Jupiter, d);
    const hSat = helioRect(ORBIT_EL.Saturn, d);

    // Mutual Jupiter-Saturn Great Inequality perturbations (Schlyter / Meeus)
    const Mj = hJup.M;
    const Msa = hSat.M;
    const jupPert = -0.332 * s(2 * Mj - 5 * Msa - 67.6)
      - 0.056 * s(2 * Mj - 2 * Msa + 21)
      + 0.042 * s(3 * Mj - 5 * Msa + 21)
      - 0.036 * s(Mj - 2 * Msa)
      + 0.022 * Math.cos((Mj - Msa) * DEG)
      + 0.023 * s(2 * Mj - 3 * Msa + 52)
      - 0.016 * s(Mj - 5 * Msa - 69);
    const satPert = 0.812 * s(2 * Mj - 5 * Msa - 67.6)
      - 0.229 * Math.cos((2 * Mj - 4 * Msa - 2) * DEG)
      + 0.119 * s(Mj - 2 * Msa - 3)
      + 0.046 * s(2 * Mj - 6 * Msa - 69)
      + 0.014 * s(Mj - 3 * Msa + 32);

    const rotLon = (h, dLonDeg) => {
      if (!dLonDeg) return h;
      const rad = dLonDeg * DEG;
      const c = Math.cos(rad), sn = Math.sin(rad);
      return { x: h.x * c - h.y * sn, y: h.x * sn + h.y * c, z: h.z };
    };

    const geoLon = (h) => norm360(Math.atan2(h.y + ysEcl, h.x + xsEcl) * RAD);

    return {
      Sun: sunLon,
      Moon: moonLon,
      Mercury: geoLon(hMer),
      Venus: geoLon(hVen),
      Mars: geoLon(hMar),
      Jupiter: geoLon(rotLon(hJup, jupPert)),
      Saturn: geoLon(rotLon(hSat, satPert)),
      Rahu: rahuLon,
      Ketu: ketuLon,
    };
  }

  /** Compute tropical Ascendant (Lagna) for given Julian Day UT and geographic lat/lon (degrees, East +) */
  function computeTropicalAscendant(jd, latDeg, lonDeg) {
    const T = (jd - J2000) / 36525.0;
    // Greenwich Mean Sidereal Time (Meeus Ch. 12)
    const gmst = norm360(
      280.46061837
      + 360.98564736629 * (jd - J2000)
      + 0.000387933 * T * T
      - (T * T * T) / 38710000
    );
    const lst = norm360(gmst + lonDeg) * DEG;
    const eps = (23.4392911 - 0.013004167 * T) * DEG;
    const lat = latDeg * DEG;
    // Standard spherical astronomy Ascendant formula
    const asc = Math.atan2(Math.cos(lst), -(Math.sin(lst) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps))) * RAD;
    return norm360(asc);
  }

  /** Full sidereal state for a timestamp JD + ayanamsa mode ("lahiri" | "raman") + optional lat/lon for Lagna */
  function computeSiderealSnapshot(jd, ayanamsaMode = "lahiri", lat = null, lon = null) {
    const ayanamsa = getAyanamsa(jd, ayanamsaMode);
    const tropNow = computeTropical(jd);
    // Compute speed via symmetric finite difference (±0.25 day) for accurate retrograde flags
    const tropPrev = computeTropical(jd - 0.25);
    const tropNext = computeTropical(jd + 0.25);

    const positions = {};
    const speeds = {};
    const retrograde = {};
    const details = {};

    for (const p of PLANETS) {
      const sid = norm360(tropNow[p.id] - ayanamsa);
      let dLon = tropNext[p.id] - tropPrev[p.id];
      if (dLon > 180) dLon -= 360;
      if (dLon < -180) dLon += 360;
      const spd = dLon * 2; // deg/day
      const isRetro = (p.id === "Rahu" || p.id === "Ketu") ? true : (p.id === "Sun" || p.id === "Moon" ? false : spd < 0);
      positions[p.id] = sid;
      speeds[p.id] = spd;
      retrograde[p.id] = isRetro;
      details[p.id] = locateDegree(sid);
    }

    if (typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon)) {
      const lag = norm360(computeTropicalAscendant(jd, lat, lon) - ayanamsa);
      positions.Lagna = lag;
      speeds.Lagna = 0;
      retrograde.Lagna = false;
      details.Lagna = locateDegree(lag);
    }

    return { jd, ayanamsaMode, ayanamsa, positions, speeds, retrograde, details };
  }

  function locateDegree(sidDeg) {
    const deg = norm360(sidDeg);
    const rasiIdx = Math.floor(deg / 30) % 12;
    const degInRasi = deg % 30;
    const padaId = Math.floor(deg / PADA_SPAN) % 108;
    const pada = PADAS[padaId];
    return {
      deg,
      rasiIdx,
      rasi: RASIS[rasiIdx],
      degInRasi,
      padaId,
      pada,
      nakIdx: pada.nakIdx,
      nak: pada.nak,
      padaNum: pada.padaNum,
      navamsa: pada.navamsa,
    };
  }

  // ---------------------------------------------------------------------------
  // Classical Jyotish Aspects (Graha Drishti) & Double / Triple Transit Detector
  // ---------------------------------------------------------------------------

  function aspectsTargetRasi(planetId, fromRasiIdx, targetRasiIdx) {
    const diff = ((targetRasiIdx - fromRasiIdx) % 12 + 12) % 12; // 0 = conjunction (1st)
    if (diff === 0 || diff === 6) return true; // 1st & 7th universal
    if (planetId === "Jupiter" || planetId === "Rahu" || planetId === "Ketu") {
      return diff === 4 || diff === 8; // 5th & 9th
    }
    if (planetId === "Saturn") {
      return diff === 2 || diff === 9; // 3rd & 10th
    }
    if (planetId === "Mars") {
      return diff === 3 || diff === 7; // 4th & 8th
    }
    return false;
  }

  function getAspectLabel(planetId, fromRasiIdx, targetRasiIdx) {
    const diff = ((targetRasiIdx - fromRasiIdx) % 12 + 12) % 12;
    if (diff === 0) return "1st (Conj)";
    return `${diff + 1}${diff === 2 ? "rd" : "th"}`;
  }

  const BHAVA_META = [
    { num: 1,  label: "Natal Lagna (I)",     prio: 10 },
    { num: 2,  label: "2nd House (Dhana)",   prio: 5 },
    { num: 3,  label: "3rd House (Sahaja)",  prio: 4 },
    { num: 4,  label: "4th House (Sukha)",   prio: 6 },
    { num: 5,  label: "5th House (Putra)",   prio: 6 },
    { num: 6,  label: "6th House (Ari)",     prio: 4 },
    { num: 7,  label: "7th House (Kalatra)", prio: 8 },
    { num: 8,  label: "8th House (Randhra)", prio: 5 },
    { num: 9,  label: "9th House (Dharma)",  prio: 6 },
    { num: 10, label: "10th House (Karma)",  prio: 8 },
    { num: 11, label: "11th House (Labha)",  prio: 7 },
    { num: 12, label: "12th House (Vyaya)",  prio: 5 },
  ];

  const TRIPLE_IMPACT_BY_BHAVA = {
    1: {
      Rahu: "Identity, vitality & life direction — catalytic personal reinvention or bold new chapter.",
      Ketu: "Self-definition & body-mind — shedding old roles for clearer authentic alignment.",
    },
    2: {
      Rahu: "Wealth, family & voice — accelerated financial restructuring or major family shift.",
      Ketu: "Savings, values & lineage — simplifying assets and redefining material priorities.",
    },
    3: {
      Rahu: "Initiative, siblings & communication — daring venture, skill leap, or decisive move.",
      Ketu: "Courage, craft & short journeys — distilling effort toward high-conviction pursuits.",
    },
    4: {
      Rahu: "Home, property & inner foundation — relocation, real-estate turn, or domestic renewal.",
      Ketu: "Roots, homeland & emotional peace — releasing past ties to rebuild inner sanctuary.",
    },
    5: {
      Rahu: "Creativity, children & speculation — bold creative birth or high-stakes inflection.",
      Ketu: "Intellect, children & purva-punya — karmic fruition in craft, mentorship, or calling.",
    },
    6: {
      Rahu: "Work routine, health & competition — decisive breakthrough over rivals, obstacles, or debt.",
      Ketu: "Service, wellness & daily discipline — resolving chronic friction through focused regimen.",
    },
    7: {
      Rahu: "Marriage, partnerships & public dealings — pivotal alliance, contract, or relational turn.",
      Ketu: "Spouse, collaborators & agreements — karmic milestone or deep renegotiation of bonds.",
    },
    8: {
      Rahu: "Transformation, joint finances & research — sudden structural pivot or hidden windfall.",
      Ketu: "Shared resources & occult insight — deep release and lasting inner metamorphosis.",
    },
    9: {
      Rahu: "Higher learning, travel & fortune — foreign horizon, publication, or dharmic leap.",
      Ketu: "Philosophy, pilgrimage & grace — spiritual clarity, ancestral karma, or detached wisdom.",
    },
    10: {
      Rahu: "Career, status & authority — rapid elevation, leadership pivot, or visibility surge.",
      Ketu: "Vocation, reputation & duty — crowning karmic work or shift toward purpose-led authority.",
    },
    11: {
      Rahu: "Income, networks & ambitions — surging gains, influential allies, or major milestone.",
      Ketu: "Fulfillment & social circles — harvesting past efforts while outgrowing old networks.",
    },
    12: {
      Rahu: "Foreign lands, retreat & expenditure — international chapter, investment, or liberation.",
      Ketu: "Solitude, subconscious & moksha — quiet closure, spiritual retreat, or karmic release.",
    },
  };

  const SKY_TRIPLE_IMPACT_BY_RASI = [
    "Collective leadership, bold initiatives & geopolitical flashpoints.",
    "Markets, currency, agriculture & material security.",
    "Media, trade networks, communications & intellectual shifts.",
    "Homeland, real estate, public sentiment & domestic resilience.",
    "Governance, sovereign authority, creative power & prominence.",
    "Public health, labor systems, analytics & precision reforms.",
    "Diplomacy, treaties, legal balance & strategic alliances.",
    "Deep finance, covert restructuring, crisis & regeneration.",
    "Law, global travel, higher ideals & institutional dharma.",
    "Infrastructure, executive institutions, industry & governance.",
    "Technology, collective movements, networks & systemic innovation.",
    "Maritime, spirituality, global compassion & dissolution of old orders.",
  ];

  function getTripleImpact(bhavaNum, nodeName, hasNatalMoon, rasiIdx) {
    if (bhavaNum && TRIPLE_IMPACT_BY_BHAVA[bhavaNum]) {
      const base = TRIPLE_IMPACT_BY_BHAVA[bhavaNum][nodeName === "Ketu" ? "Ketu" : "Rahu"];
      if (hasNatalMoon && bhavaNum !== 1) {
        return `${base.replace(/\.$/, "")} (deep emotional turning point).`;
      }
      return base;
    }
    return SKY_TRIPLE_IMPACT_BY_RASI[rasiIdx % 12];
  }

  /**
   * Analyze live transits for Major Double Transits (Jupiter + Saturn), Rare Triple Transits
   * (Jupiter + Saturn + Rahu/Ketu), and Exact Slow-Planet Pada Crossings.
   */
  function analyzeTransits(transitSnap, natalSnap, dashaInfo = null) {
    const juR = transitSnap.details.Jupiter.rasiIdx;
    const saR = transitSnap.details.Saturn.rasiIdx;
    const raR = transitSnap.details.Rahu.rasiIdx;
    const keR = transitSnap.details.Ketu.rasiIdx;
    const activeDashaLords = new Set();
    if (dashaInfo && !dashaInfo.isPreBirth) {
      if (dashaInfo.maha) activeDashaLords.add(dashaInfo.maha.lord);
      if (dashaInfo.antar) activeDashaLords.add(dashaInfo.antar.lord);
    }

    const triples = [];
    const doubles = [];
    const padaHits = [];

    if (natalSnap) {
      const lagR = natalSnap.details.Lagna ? natalSnap.details.Lagna.rasiIdx : null;
      const moonR = natalSnap.details.Moon.rasiIdx;
      const sunR = natalSnap.details.Sun.rasiIdx;
      const MAJOR_DOUBLE_BHAVAS = new Set([1, 4, 5, 7, 9, 10, 11]);

      const targets = [];
      const seenRasi = new Map();
      const pushTarget = (rasiIdx, label, priority, bhavaNum = null, allowDouble = true) => {
        if (rasiIdx === null || rasiIdx === undefined) return;
        if (seenRasi.has(rasiIdx)) {
          const prev = seenRasi.get(rasiIdx);
          if (!prev.labels.includes(label)) prev.labels.push(label);
          prev.priority = Math.max(prev.priority, priority);
          if (bhavaNum !== null) prev.bhavaNum = bhavaNum;
          prev.allowDouble = prev.allowDouble || allowDouble;
        } else {
          const entry = { rasiIdx, labels: [label], priority, bhavaNum, allowDouble };
          seenRasi.set(rasiIdx, entry);
          targets.push(entry);
        }
      };

      if (lagR !== null) {
        for (const bm of BHAVA_META) {
          pushTarget((lagR + bm.num - 1) % 12, bm.label, bm.prio, bm.num, MAJOR_DOUBLE_BHAVAS.has(bm.num));
        }
      }
      pushTarget(moonR, "Natal Moon", 9, lagR !== null ? (((moonR - lagR) % 12 + 12) % 12) + 1 : 1, true);
      pushTarget(sunR, "Natal Sun", 7, lagR !== null ? (((sunR - lagR) % 12 + 12) % 12) + 1 : null, true);

      for (const t of targets) {
        const jHit = aspectsTargetRasi("Jupiter", juR, t.rasiIdx);
        const sHit = aspectsTargetRasi("Saturn", saR, t.rasiIdx);
        if (!jHit || !sHit) continue;
        const rHit = aspectsTargetRasi("Rahu", raR, t.rasiIdx);
        const kHit = aspectsTargetRasi("Ketu", keR, t.rasiIdx);
        const rasi = RASIS[t.rasiIdx];
        const targetText = `${t.labels.slice(0, 2).join(" / ")} · ${rasi.sanskrit}`;
        const natalOccupants = PLANETS.filter((p) => natalSnap.details[p.id] && natalSnap.details[p.id].rasiIdx === t.rasiIdx).map((p) => p.id);
        const dashaHit = activeDashaLords.has(rasi.ruler) || natalOccupants.some((id) => activeDashaLords.has(id));
        const dashaSuffix = dashaHit ? " ★ DASHA" : "";

        if (rHit || kHit) {
          const nodeName = rHit ? "Rahu" : "Ketu";
          const nodeR = rHit ? raR : keR;
          const impact = getTripleImpact(t.bhavaNum, nodeName, t.rasiIdx === moonR, t.rasiIdx);
          triples.push({
            tier: "triple",
            key: `T:${t.rasiIdx}:${juR}:${saR}:${nodeName}:${nodeR}`,
            rasiIdx: t.rasiIdx,
            bhavaNum: t.bhavaNum,
            targetLabel: targetText,
            dashaActivated: dashaHit,
            priority: t.priority + 5 + (dashaHit ? 4 : 0),
            planets: ["Jupiter", "Saturn", nodeName],
            aspects: [
              { planet: "Jupiter", fromRasi: juR, label: getAspectLabel("Jupiter", juR, t.rasiIdx) },
              { planet: "Saturn",  fromRasi: saR, label: getAspectLabel("Saturn",  saR, t.rasiIdx) },
              { planet: nodeName,  fromRasi: nodeR, label: getAspectLabel(nodeName, nodeR, t.rasiIdx) },
            ],
            impact,
            summary: `♃ ${RASIS[juR].sanskrit} · ♄ ${RASIS[saR].sanskrit} · ${PLANET_MAP[nodeName].sym} ${RASIS[nodeR].sanskrit} → ${targetText}${dashaSuffix}`,
          });
        } else if (t.allowDouble) {
          doubles.push({
            tier: "double",
            key: `D:${t.rasiIdx}:${juR}:${saR}`,
            rasiIdx: t.rasiIdx,
            bhavaNum: t.bhavaNum,
            targetLabel: targetText,
            dashaActivated: dashaHit,
            priority: t.priority + (dashaHit ? 3 : 0),
            planets: ["Jupiter", "Saturn"],
            aspects: [
              { planet: "Jupiter", fromRasi: juR, label: getAspectLabel("Jupiter", juR, t.rasiIdx) },
              { planet: "Saturn",  fromRasi: saR, label: getAspectLabel("Saturn",  saR, t.rasiIdx) },
            ],
            summary: `♃ ${RASIS[juR].sanskrit} · ♄ ${RASIS[saR].sanskrit} → ${targetText}${dashaSuffix}`,
          });
        }
      }

      // Exact 1-of-108 Pada crossings by slow grahas onto Natal Lagna / Moon / Sun / Jupiter / Saturn
      const slowTransits = ["Jupiter", "Saturn", "Rahu", "Ketu"];
      const natalPins = ["Lagna", "Moon", "Sun", "Jupiter", "Saturn", "Mars", "Venus", "Mercury"];
      for (const tp of slowTransits) {
        const tPada = transitSnap.details[tp].padaId;
        for (const np of natalPins) {
          if (!natalSnap.details[np]) continue;
          if (natalSnap.details[np].padaId === tPada) {
            const pObj = PADAS[tPada];
            padaHits.push({
              tier: "pada",
              key: `P:${tp}:${np}:${tPada}`,
              rasiIdx: pObj.rasiIdx,
              padaId: tPada,
              transitPlanet: tp,
              natalPlanet: np,
              summary: `${PLANET_MAP[tp].sym} ${tp} transits Natal ${np} Pada (${pObj.nak.name} P${pObj.padaNum})`,
            });
          }
        }
      }
    } else {
      // Cosmic Sky Mode (no natal chart locked): detect Rasis receiving zodiacal Double/Triple Drishti
      for (let r = 0; r < 12; r++) {
        const jHit = aspectsTargetRasi("Jupiter", juR, r);
        const sHit = aspectsTargetRasi("Saturn", saR, r);
        if (!jHit || !sHit) continue;
        const rHit = aspectsTargetRasi("Rahu", raR, r);
        const kHit = aspectsTargetRasi("Ketu", keR, r);
        const rasi = RASIS[r];
        if (rHit || kHit) {
          const nodeName = rHit ? "Rahu" : "Ketu";
          const nodeR = rHit ? raR : keR;
          const impact = getTripleImpact(null, nodeName, false, r);
          triples.push({
            tier: "triple",
            key: `SKY-T:${r}:${juR}:${saR}:${nodeName}:${nodeR}`,
            rasiIdx: r,
            targetLabel: `${rasi.dev} ${rasi.sanskrit} (${rasi.english})`,
            priority: 10,
            planets: ["Jupiter", "Saturn", nodeName],
            aspects: [
              { planet: "Jupiter", fromRasi: juR, label: getAspectLabel("Jupiter", juR, r) },
              { planet: "Saturn",  fromRasi: saR, label: getAspectLabel("Saturn",  saR, r) },
              { planet: nodeName,  fromRasi: nodeR, label: getAspectLabel(nodeName, nodeR, r) },
            ],
            impact,
            summary: `♃ ♄ ${PLANET_MAP[nodeName].sym} Triple Activation → ${rasi.sanskrit} ${rasi.glyph}`,
          });
        } else {
          doubles.push({
            tier: "double",
            key: `SKY-D:${r}:${juR}:${saR}`,
            rasiIdx: r,
            targetLabel: `${rasi.dev} ${rasi.sanskrit} (${rasi.english})`,
            priority: 6,
            planets: ["Jupiter", "Saturn"],
            aspects: [
              { planet: "Jupiter", fromRasi: juR, label: getAspectLabel("Jupiter", juR, r) },
              { planet: "Saturn",  fromRasi: saR, label: getAspectLabel("Saturn",  saR, r) },
            ],
            summary: `♃ ♄ Double Activation → ${rasi.sanskrit} ${rasi.glyph}`,
          });
        }
      }
    }

    triples.sort((a, b) => b.priority - a.priority);
    doubles.sort((a, b) => b.priority - a.priority);
    return { triples, doubles, padaHits };
  }

  /** Scan forward or backward to find the next/previous distinct Double or Triple Transit */
  function findConvergence(startJD, natalSnap, ayanamsaMode = "lahiri", direction = 1, maxDays = 1825, minJD = null) {
    const dir = direction < 0 ? -1 : 1;
    const curState = analyzeTransits(computeSiderealSnapshot(startJD, ayanamsaMode), natalSnap);
    const curKeys = new Set([
      ...curState.triples.map((x) => x.key),
      ...curState.doubles.map((x) => x.key),
    ]);
    for (let step = 2; step <= maxDays; step += 2) {
      const jd = startJD + step * dir;
      if (minJD !== null && jd < minJD) break;
      const snap = computeSiderealSnapshot(jd, ayanamsaMode);
      const res = analyzeTransits(snap, natalSnap);
      const newTriple = res.triples.find((x) => !curKeys.has(x.key));
      if (newTriple) return { jd, event: newTriple, snap };
      const newDouble = res.doubles.find((x) => !curKeys.has(x.key));
      if (newDouble) return { jd, event: newDouble, snap };
    }
    return null;
  }

  function findNextConvergence(startJD, natalSnap, ayanamsaMode = "lahiri", maxDays = 1825) {
    return findConvergence(startJD, natalSnap, ayanamsaMode, 1, maxDays, null);
  }

  function findPrevConvergence(startJD, natalSnap, ayanamsaMode = "lahiri", maxDays = 1825, minJD = null) {
    return findConvergence(startJD, natalSnap, ayanamsaMode, -1, maxDays, minJD);
  }

  // ---------------------------------------------------------------------------
  // Planetary Dignity, Vimshottari Dasha, Life Epochs, Panchanga & Drishti Web
  // ---------------------------------------------------------------------------

  const DIGNITY_TABLE = {
    Sun:     { exalted: 0,  debilitated: 6,  own: [4] },
    Moon:    { exalted: 1,  debilitated: 7,  own: [3] },
    Mars:    { exalted: 9,  debilitated: 3,  own: [0, 7] },
    Mercury: { exalted: 5,  debilitated: 11, own: [2, 5] },
    Jupiter: { exalted: 3,  debilitated: 9,  own: [8, 11] },
    Venus:   { exalted: 11, debilitated: 5,  own: [1, 6] },
    Saturn:  { exalted: 6,  debilitated: 0,  own: [9, 10] },
    Rahu:    { exalted: 1,  debilitated: 7,  own: [10] },
    Ketu:    { exalted: 7,  debilitated: 1,  own: [7] },
  };

  function getDignity(planetId, rasiIdx) {
    const row = DIGNITY_TABLE[planetId];
    if (!row) return { code: "neutral", label: "Neutral", mark: "" };
    if (rasiIdx === row.exalted) return { code: "exalted", label: "Uchcha · Exalted", mark: "↑" };
    if (rasiIdx === row.debilitated) return { code: "debilitated", label: "Neecha · Debilitated", mark: "↓" };
    if (row.own.includes(rasiIdx)) return { code: "own", label: "Swakshetra · Own", mark: "★" };
    return { code: "neutral", label: "Neutral", mark: "" };
  }

  const VIM_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
  const VIM_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
  const YEAR_DAYS = 365.2425;

  /**
   * Compute active Vimshottari Mahadasha, Antardasha, and Pratyantardasha at targetJD
   * directly from exact natal sidereal Moon longitude & birth JD.
   */
  function computeVimshottariDasha(natalMoonDeg, natalJD, targetJD) {
    if (!Number.isFinite(natalMoonDeg) || !Number.isFinite(natalJD)) return null;
    if (targetJD < natalJD - 0.01) {
      return { isPreBirth: true, maha: null, antar: null, pratyantar: null };
    }
    const nakSpan = 360 / 27;
    const normMoon = norm360(natalMoonDeg);
    const nakIdx = Math.floor(normMoon / nakSpan) % 27;
    const elapsedFrac = (normMoon - nakIdx * nakSpan) / nakSpan;
    const startLordIdx = nakIdx % 9;
    const firstLord = VIM_ORDER[startLordIdx];
    const firstStartJD = natalJD - elapsedFrac * VIM_YEARS[firstLord] * YEAR_DAYS;

    // Wrap smoothly across 120-year cycles if user scrolls past age 120
    const cycleDays = 120 * YEAR_DAYS;
    const offsetFromFirst = targetJD - firstStartJD;
    const cycles = Math.floor(offsetFromFirst / cycleDays);
    let cursor = firstStartJD + cycles * cycleDays;

    let maha = null;
    for (let i = 0; i < 9; i++) {
      const idx = (startLordIdx + i) % 9;
      const lord = VIM_ORDER[idx];
      const dur = VIM_YEARS[lord] * YEAR_DAYS;
      if (targetJD >= cursor && targetJD < cursor + dur) {
        maha = {
          lord,
          idx,
          startJD: cursor,
          endJD: cursor + dur,
          frac: Math.max(0, Math.min(1, (targetJD - cursor) / dur)),
        };
        break;
      }
      cursor += dur;
    }
    if (!maha) return null;

    // Antardasha (Bhukti)
    let adCursor = maha.startJD;
    const mdDur = maha.endJD - maha.startJD;
    let antar = null;
    for (let i = 0; i < 9; i++) {
      const idx = (maha.idx + i) % 9;
      const lord = VIM_ORDER[idx];
      const dur = mdDur * (VIM_YEARS[lord] / 120);
      if (targetJD >= adCursor && targetJD < adCursor + dur) {
        antar = {
          lord,
          idx,
          startJD: adCursor,
          endJD: adCursor + dur,
          frac: Math.max(0, Math.min(1, (targetJD - adCursor) / dur)),
        };
        break;
      }
      adCursor += dur;
    }
    if (!antar) antar = { lord: maha.lord, idx: maha.idx, startJD: maha.startJD, endJD: maha.endJD, frac: 0 };

    // Pratyantardasha
    let pdCursor = antar.startJD;
    const adDur = antar.endJD - antar.startJD;
    let pratyantar = null;
    for (let i = 0; i < 9; i++) {
      const idx = (antar.idx + i) % 9;
      const lord = VIM_ORDER[idx];
      const dur = adDur * (VIM_YEARS[lord] / 120);
      if (targetJD >= pdCursor && targetJD < pdCursor + dur) {
        pratyantar = {
          lord,
          idx,
          startJD: pdCursor,
          endJD: pdCursor + dur,
          frac: Math.max(0, Math.min(1, (targetJD - pdCursor) / dur)),
        };
        break;
      }
      pdCursor += dur;
    }
    if (!pratyantar) pratyantar = { lord: antar.lord, idx: antar.idx, startJD: antar.startJD, endJD: antar.endJD, frac: 0 };

    return { isPreBirth: false, maha, antar, pratyantar };
  }

  /**
   * Detect active life epochs at a single instant: Sade Sati, Ashtama Shani, Saturn/Jupiter Return.
   */
  function getActiveLifeEpoch(transitSnap, natalSnap) {
    if (!transitSnap || !natalSnap) return { badges: [], sadeSatiPhase: null, sadeSatiRasis: [] };
    const moonR = natalSnap.details.Moon.rasiIdx;
    const natSatR = natalSnap.details.Saturn.rasiIdx;
    const natJupR = natalSnap.details.Jupiter.rasiIdx;
    const trSatR = transitSnap.details.Saturn.rasiIdx;
    const trJupR = transitSnap.details.Jupiter.rasiIdx;
    const satFromMoon = ((trSatR - moonR) % 12 + 12) % 12; // 0 = 1st, 11 = 12th, 1 = 2nd, 7 = 8th

    const badges = [];
    let sadeSatiPhase = null;
    const sadeSatiRasis = [(moonR + 11) % 12, moonR, (moonR + 1) % 12];

    if (satFromMoon === 11) {
      sadeSatiPhase = "Rising";
      badges.push({ type: "sadesati", label: "♄ SADE SATI · RISING (12th from ☽)" });
    } else if (satFromMoon === 0) {
      sadeSatiPhase = "Peak";
      badges.push({ type: "sadesati", label: "♄ SADE SATI · PEAK (Janma Shani)" });
    } else if (satFromMoon === 1) {
      sadeSatiPhase = "Setting";
      badges.push({ type: "sadesati", label: "♄ SADE SATI · SETTING (2nd from ☽)" });
    } else if (satFromMoon === 7) {
      badges.push({ type: "ashtama", label: "♄ ASHTAMA SHANI (8th from ☽)" });
    }

    if (trSatR === natSatR) {
      badges.push({ type: "saturn-return", label: "♄ SATURN RETURN" });
    }
    if (trJupR === natJupR) {
      badges.push({ type: "jupiter-return", label: "♃ JUPITER RETURN" });
    }
    return { badges, sadeSatiPhase, sadeSatiRasis };
  }

  /**
   * Scan lifespan [minJD, maxJD] at 20-day resolution to produce timeline epoch bands.
   */
  function computeLifeEpochs(natalSnap, minJD, maxJD, ayanamsaMode = "lahiri") {
    if (!natalSnap || maxJD <= minJD) return [];
    const moonR = natalSnap.details.Moon.rasiIdx;
    const natSatR = natalSnap.details.Saturn.rasiIdx;
    const natJupR = natalSnap.details.Jupiter.rasiIdx;
    const stepDays = 20;
    const bands = [];
    const open = { sadesati: null, saturnReturn: null, jupiterReturn: null };

    const closeBand = (kind, endJD) => {
      if (open[kind]) {
        open[kind].endJD = endJD;
        bands.push(open[kind]);
        open[kind] = null;
      }
    };

    for (let jd = minJD; jd <= maxJD; jd += stepDays) {
      const ayan = getAyanamsa(jd, ayanamsaMode);
      const trop = computeTropical(jd);
      const satR = Math.floor(norm360(trop.Saturn - ayan) / 30) % 12;
      const jupR = Math.floor(norm360(trop.Jupiter - ayan) / 30) % 12;
      const fromMoon = ((satR - moonR) % 12 + 12) % 12;
      const isAfterFirstOrbitJup = (jd - minJD) > 365 * 8;
      const isAfterFirstOrbitSat = (jd - minJD) > 365 * 22;
      const inSS = (fromMoon === 11 || fromMoon === 0 || fromMoon === 1);
      const inSR = isAfterFirstOrbitSat && (satR === natSatR);
      const inJR = isAfterFirstOrbitJup && (jupR === natJupR);

      if (inSS) { if (!open.sadesati) open.sadesati = { type: "sadesati", startJD: jd, endJD: jd, label: "Sade Sati" }; }
      else closeBand("sadesati", jd);

      if (inSR) { if (!open.saturnReturn) open.saturnReturn = { type: "saturn-return", startJD: jd, endJD: jd, label: "Saturn Return" }; }
      else closeBand("saturnReturn", jd);

      if (inJR) { if (!open.jupiterReturn) open.jupiterReturn = { type: "jupiter-return", startJD: jd, endJD: jd, label: "Jupiter Return" }; }
      else closeBand("jupiterReturn", jd);
    }
    closeBand("sadesati", maxJD);
    closeBand("saturnReturn", maxJD);
    closeBand("jupiterReturn", maxJD);
    return bands;
  }

  const TITHI_NAMES = [
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
    "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima",
  ];
  const VARA_NAMES = [
    "Ravivara", "Somavara", "Mangalavara", "Budhavara",
    "Guruvara", "Shukravara", "Shanivara",
  ];

  /**
   * Compute live Vedic Panchanga (Tithi, Paksha, Vara, Moon Illumination & Solar/Lunar Eclipses).
   */
  function computePanchanga(transitSnap, jd) {
    const sunDeg = transitSnap.positions.Sun;
    const moonDeg = transitSnap.positions.Moon;
    const rahuDeg = transitSnap.positions.Rahu;
    const ketuDeg = transitSnap.positions.Ketu;

    const elong = norm360(moonDeg - sunDeg); // 0=New Moon, 180=Full Moon
    const phaseFrac = elong / 360;
    const illumination = (1 - Math.cos(elong * DEG)) / 2; // 0..1
    const tithiIndex = Math.floor(elong / 12) % 30; // 0..29
    const paksha = tithiIndex < 15 ? "Shukla" : "Krishna";
    const tithiInPaksha = tithiIndex % 15;
    let tithiName = TITHI_NAMES[tithiInPaksha];
    if (tithiIndex === 29) tithiName = "Amavasya";
    else if (tithiIndex === 14) tithiName = "Purnima";

    const varaIdx = ((Math.floor(jd + 1.5) % 7) + 7) % 7;
    const vara = VARA_NAMES[varaIdx];

    const sunNodeDist = Math.min(angDiff(sunDeg, rahuDeg), angDiff(sunDeg, ketuDeg));
    const moonNodeDist = Math.min(angDiff(moonDeg, rahuDeg), angDiff(moonDeg, ketuDeg));
    const sunMoonSep = angDiff(sunDeg, moonDeg);

    let eclipse = null;
    if (sunMoonSep <= 9.5 && sunNodeDist <= 16.5) {
      eclipse = { type: "solar", label: "SURYA GRAHAN · SOLAR ECLIPSE", planet: "Sun", deg: sunDeg };
    } else if (Math.abs(sunMoonSep - 180) <= 9.5 && moonNodeDist <= 13.5) {
      eclipse = { type: "lunar", label: "CHANDRA GRAHAN · LUNAR ECLIPSE", planet: "Moon", deg: moonDeg };
    }

    return {
      elong,
      phaseFrac,
      illumination,
      paksha,
      tithiNum: tithiIndex + 1,
      tithiName,
      tithiFull: (tithiName === "Purnima" || tithiName === "Amavasya") ? tithiName : `${paksha} ${tithiName}`,
      isPurnima: tithiIndex === 14,
      isAmavasya: tithiIndex === 29,
      vara,
      eclipse,
    };
  }

  /**
   * Compute all live special Vedic Graha Drishti rays (Mars, Jupiter, Saturn, Rahu, Ketu) for optical lens.
   */
  function computeAllDrishtiRays(transitSnap) {
    const rays = [];
    const casters = [
      { id: "Jupiter", offsets: [4, 6, 8] },
      { id: "Saturn",  offsets: [2, 6, 9] },
      { id: "Mars",    offsets: [3, 6, 7] },
      { id: "Rahu",    offsets: [4, 8] },
      { id: "Ketu",    offsets: [4, 8] },
    ];
    for (const c of casters) {
      const fromDeg = transitSnap.positions[c.id];
      const fromR = transitSnap.details[c.id].rasiIdx;
      for (const off of c.offsets) {
        const toR = (fromR + off) % 12;
        rays.push({
          planet: c.id,
          fromDeg,
          toRasiIdx: toR,
          toDeg: toR * 30 + 15,
          aspectNum: off + 1,
          color: PLANET_MAP[c.id].color,
        });
      }
    }
    return rays;
  }

  /**
   * Compute exact degree-level harmonic resonances (<= orbDeg) between live transiting and locked natal planets.
   */
  function computeNatalResonances(transitSnap, natalSnap, orbDeg = 2.5) {
    if (!transitSnap || !natalSnap) return [];
    const hits = [];
    const natalKeys = ["Lagna", ...PLANETS.map((p) => p.id)];
    for (const tp of PLANETS) {
      const tDeg = transitSnap.positions[tp.id];
      for (const nk of natalKeys) {
        const nDeg = natalSnap.positions[nk];
        if (nDeg === undefined) continue;
        const diff = angDiff(tDeg, nDeg);
        if (diff <= orbDeg) {
          hits.push({
            transit: tp.id,
            natal: nk,
            tDeg,
            nDeg,
            orb: diff,
            type: "conjunction",
            color: tp.color,
          });
        } else if (Math.abs(diff - 180) <= orbDeg * 0.85 && tp.slow) {
          hits.push({
            transit: tp.id,
            natal: nk,
            tDeg,
            nDeg,
            orb: Math.abs(diff - 180),
            type: "opposition",
            color: tp.color,
          });
        }
      }
    }
    hits.sort((a, b) => a.orb - b.orb);
    return hits;
  }

  // ---------------------------------------------------------------------------
  // Built-In Curated Birth City Atlas (140+ Indian & Major World Cities)
  // ---------------------------------------------------------------------------

  const CITIES = [
    ["Hyderabad, India", 17.3850, 78.4867, "Asia/Kolkata"],
    ["Bengaluru, India", 12.9716, 77.5946, "Asia/Kolkata"],
    ["Mumbai, India", 19.0760, 72.8777, "Asia/Kolkata"],
    ["New Delhi, India", 28.6139, 77.2090, "Asia/Kolkata"],
    ["Chennai, India", 13.0827, 80.2707, "Asia/Kolkata"],
    ["Kolkata, India", 22.5726, 88.3639, "Asia/Kolkata"],
    ["Vijayawada, India", 16.5062, 80.6480, "Asia/Kolkata"],
    ["Visakhapatnam, India", 17.6868, 83.2185, "Asia/Kolkata"],
    ["Tirupati, India", 13.6288, 79.4192, "Asia/Kolkata"],
    ["Guntur, India", 16.3067, 80.4365, "Asia/Kolkata"],
    ["Warangal, India", 17.9689, 79.5941, "Asia/Kolkata"],
    ["Rajahmundry, India", 17.0005, 81.8040, "Asia/Kolkata"],
    ["Kakinada, India", 16.9891, 82.2475, "Asia/Kolkata"],
    ["Nellore, India", 14.4426, 79.9865, "Asia/Kolkata"],
    ["Kurnool, India", 15.8281, 78.0373, "Asia/Kolkata"],
    ["Pune, India", 18.5204, 73.8567, "Asia/Kolkata"],
    ["Ahmedabad, India", 23.0225, 72.5714, "Asia/Kolkata"],
    ["Jaipur, India", 26.9124, 75.7873, "Asia/Kolkata"],
    ["Lucknow, India", 26.8467, 80.9462, "Asia/Kolkata"],
    ["Varanasi, India", 25.3176, 82.9739, "Asia/Kolkata"],
    ["Kochi, India", 9.9312, 76.2673, "Asia/Kolkata"],
    ["Thiruvananthapuram, India", 8.5241, 76.9366, "Asia/Kolkata"],
    ["Coimbatore, India", 11.0168, 76.9558, "Asia/Kolkata"],
    ["Madurai, India", 9.9252, 78.1198, "Asia/Kolkata"],
    ["Mysuru, India", 12.2958, 76.6394, "Asia/Kolkata"],
    ["Mangaluru, India", 12.9141, 74.8560, "Asia/Kolkata"],
    ["Chandigarh, India", 30.7333, 76.7794, "Asia/Kolkata"],
    ["Indore, India", 22.7196, 75.8577, "Asia/Kolkata"],
    ["Bhopal, India", 23.2599, 77.4126, "Asia/Kolkata"],
    ["Nagpur, India", 21.1458, 79.0882, "Asia/Kolkata"],
    ["Surat, India", 21.1702, 72.8311, "Asia/Kolkata"],
    ["Vadodara, India", 22.3072, 73.1812, "Asia/Kolkata"],
    ["Patna, India", 25.5941, 85.1376, "Asia/Kolkata"],
    ["Bhubaneswar, India", 20.2961, 85.8245, "Asia/Kolkata"],
    ["Guwahati, India", 26.1445, 91.7362, "Asia/Kolkata"],
    ["Ujjain, India", 23.1765, 75.7885, "Asia/Kolkata"],
    ["Haridwar, India", 29.9457, 78.1642, "Asia/Kolkata"],
    ["Rishikesh, India", 30.0869, 78.2676, "Asia/Kolkata"],
    ["Amritsar, India", 31.6340, 74.8723, "Asia/Kolkata"],
    ["Srinagar, India", 34.0837, 74.7973, "Asia/Kolkata"],
    ["Kathmandu, Nepal", 27.7172, 85.3240, "Asia/Kathmandu"],
    ["Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo"],
    ["Dhaka, Bangladesh", 23.8103, 90.4125, "Asia/Dhaka"],
    ["Karachi, Pakistan", 24.8607, 67.0011, "Asia/Karachi"],
    ["Lahore, Pakistan", 31.5204, 74.3587, "Asia/Karachi"],
    ["Dubai, UAE", 25.2048, 55.2708, "Asia/Dubai"],
    ["Abu Dhabi, UAE", 24.4539, 54.3773, "Asia/Dubai"],
    ["Riyadh, Saudi Arabia", 24.7136, 46.6753, "Asia/Riyadh"],
    ["Doha, Qatar", 25.2854, 51.5310, "Asia/Qatar"],
    ["Singapore", 1.3521, 103.8198, "Asia/Singapore"],
    ["Kuala Lumpur, Malaysia", 3.1390, 101.6869, "Asia/Kuala_Lumpur"],
    ["Bangkok, Thailand", 13.7563, 100.5018, "Asia/Bangkok"],
    ["Jakarta, Indonesia", -6.2088, 106.8456, "Asia/Jakarta"],
    ["Hong Kong", 22.3193, 114.1694, "Asia/Hong_Kong"],
    ["Taipei, Taiwan", 25.0330, 121.5654, "Asia/Taipei"],
    ["Beijing, China", 39.9042, 116.4074, "Asia/Shanghai"],
    ["Shanghai, China", 31.2304, 121.4737, "Asia/Shanghai"],
    ["Tokyo, Japan", 35.6762, 139.6503, "Asia/Tokyo"],
    ["Seoul, South Korea", 37.5665, 126.9780, "Asia/Seoul"],
    ["Sydney, Australia", -33.8688, 151.2093, "Australia/Sydney"],
    ["Melbourne, Australia", -37.8136, 144.9631, "Australia/Melbourne"],
    ["Auckland, New Zealand", -36.8485, 174.7633, "Pacific/Auckland"],
    ["London, UK", 51.5074, -0.1278, "Europe/London"],
    ["Manchester, UK", 53.4808, -2.2426, "Europe/London"],
    ["Dublin, Ireland", 53.3498, -6.2603, "Europe/Dublin"],
    ["Paris, France", 48.8566, 2.3522, "Europe/Paris"],
    ["Berlin, Germany", 52.5200, 13.4050, "Europe/Berlin"],
    ["Frankfurt, Germany", 50.1109, 8.6821, "Europe/Berlin"],
    ["Munich, Germany", 48.1351, 11.5820, "Europe/Berlin"],
    ["Amsterdam, Netherlands", 52.3676, 4.9041, "Europe/Amsterdam"],
    ["Zurich, Switzerland", 47.3769, 8.5417, "Europe/Zurich"],
    ["Madrid, Spain", 40.4168, -3.7038, "Europe/Madrid"],
    ["Barcelona, Spain", 41.3874, 2.1686, "Europe/Madrid"],
    ["Rome, Italy", 41.9028, 12.4964, "Europe/Rome"],
    ["Milan, Italy", 45.4642, 9.1900, "Europe/Rome"],
    ["Stockholm, Sweden", 59.3293, 18.0686, "Europe/Stockholm"],
    ["Warsaw, Poland", 52.2297, 21.0122, "Europe/Warsaw"],
    ["Athens, Greece", 37.9838, 23.7275, "Europe/Athens"],
    ["Istanbul, Turkey", 41.0082, 28.9784, "Europe/Istanbul"],
    ["Cairo, Egypt", 30.0444, 31.2357, "Africa/Cairo"],
    ["Nairobi, Kenya", -1.2921, 36.8219, "Africa/Nairobi"],
    ["Johannesburg, South Africa", -26.2041, 28.0473, "Africa/Johannesburg"],
    ["Lagos, Nigeria", 6.5244, 3.3792, "Africa/Lagos"],
    ["New York, USA", 40.7128, -74.0060, "America/New_York"],
    ["Boston, USA", 42.3601, -71.0589, "America/New_York"],
    ["Washington DC, USA", 38.9072, -77.0369, "America/New_York"],
    ["Atlanta, USA", 33.7490, -84.3880, "America/New_York"],
    ["Miami, USA", 25.7617, -80.1918, "America/New_York"],
    ["Chicago, USA", 41.8781, -87.6298, "America/Chicago"],
    ["Dallas, USA", 32.7767, -96.7970, "America/Chicago"],
    ["Houston, USA", 29.7604, -95.3698, "America/Chicago"],
    ["Austin, USA", 30.2672, -97.7431, "America/Chicago"],
    ["Denver, USA", 39.7392, -104.9903, "America/Denver"],
    ["Phoenix, USA", 33.4484, -112.0740, "America/Phoenix"],
    ["Los Angeles, USA", 34.0522, -118.2437, "America/Los_Angeles"],
    ["San Francisco, USA", 37.7749, -122.4194, "America/Los_Angeles"],
    ["San Jose, USA", 37.3382, -121.8863, "America/Los_Angeles"],
    ["Seattle, USA", 47.6062, -122.3321, "America/Los_Angeles"],
    ["Toronto, Canada", 43.6532, -79.3832, "America/Toronto"],
    ["Vancouver, Canada", 49.2827, -123.1207, "America/Vancouver"],
    ["Montreal, Canada", 45.5017, -73.5673, "America/Toronto"],
    ["Mexico City, Mexico", 19.4326, -99.1332, "America/Mexico_City"],
    ["Bogota, Colombia", 4.7110, -74.0721, "America/Bogota"],
    ["Lima, Peru", -12.0464, -77.0428, "America/Lima"],
    ["Sao Paulo, Brazil", -23.5505, -46.6333, "America/Sao_Paulo"],
    ["Buenos Aires, Argentina", -34.6037, -58.3816, "America/Argentina/Buenos_Aires"],
  ].map(([name, lat, lon, tz]) => ({ name, lat, lon, tz }));

  function findCity(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return CITIES[0];
    // Allow raw "lat, lon" input too
    const coordMatch = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lon = Number(coordMatch[2]);
      const approxOffset = Math.round(lon / 15);
      return { name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, lat, lon, tz: approxOffset };
    }
    const exact = CITIES.find((c) => c.name.toLowerCase() === q);
    if (exact) return exact;
    const starts = CITIES.find((c) => c.name.toLowerCase().startsWith(q));
    if (starts) return starts;
    const partial = CITIES.find((c) => c.name.toLowerCase().includes(q));
    return partial || null;
  }

  root.JyotishEngine = {
    RASIS,
    NAKSHATRAS,
    PADAS,
    PLANETS,
    PLANET_MAP,
    CITIES,
    PADA_SPAN,
    norm360,
    angDiff,
    fmtDMS,
    fmtDM,
    ymdhmsToJD,
    dateToJD,
    jdToDate,
    dayOfYearUtc,
    localBirthToJD,
    getAyanamsa,
    computeSiderealSnapshot,
    locateDegree,
    aspectsTargetRasi,
    getAspectLabel,
    analyzeTransits,
    findConvergence,
    findNextConvergence,
    findPrevConvergence,
    getDignity,
    computeVimshottariDasha,
    getActiveLifeEpoch,
    computeLifeEpochs,
    computePanchanga,
    computeAllDrishtiRays,
    computeNatalResonances,
    findCity,
  };
})(typeof window !== "undefined" ? window : globalThis);
