/**
 * Nakshatra Chakram — Tabla & Tanpura Cosmic Ambience + Transit Sound Synthesizer
 *
 * Synthesizes 100% locally via Web Audio API:
 *   - 4-String Classical Tanpura (Pa A2 -> Sa' D3 -> Sa' D3 -> Kharaj Sa D2) with warm jawari bloom
 *   - Meditative 8-Matra Keherwa Tabla (Dayan tuned to D4 Sa + pitch-gliding Bayan Ge/Ghe)
 *   - Runs by default unless explicitly muted by the user (auto-arms seamlessly on first user gesture)
 *   - Mechanical escapement & hand-crank brass ratchet ticks
 *   - Heavy brass clutch on Lahiri <-> Raman switches & vault chime on Natal Lock
 *   - Double Transit bronze temple bell, Triple Transit sub-bass cosmic gong, and Pada chime
 */
(function (root) {
  "use strict";

  const STORAGE_KEY = "nakshatra-cosmic-sound-v2";

  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let mode = "full"; // "full" (Tabla+Tanpura+Gongs, default) | "mech" (Gongs+Ticks only) | "off" (Muted)
  let running = false;
  let armed = false;

  let tanpuraTimer = null;
  let tablaTimer = null;
  let tanpuraStep = 0;
  let tablaStep = 0;

  let lastTickAt = 0;
  let lastRatchetAt = 0;
  let lastAlertAt = 0;
  const listeners = new Set();

  // Load saved user preference (defaults to "full" ON unless explicitly turned off!)
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "off" || saved === "mech" || saved === "full") {
      mode = saved;
    }
  } catch (_) {}

  function notify() {
    for (const fn of listeners) {
      try { fn(mode, running); } catch (_) {}
    }
  }

  function onChange(fn) {
    listeners.add(fn);
    fn(mode, running);
  }

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);

      musicBus = ctx.createGain();
      musicBus.gain.value = 0.72;
      musicBus.connect(master);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.85;
      sfxBus.connect(master);
    }
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        if (mode !== "off" && !running) startAudioGraph();
      }).catch(() => {});
    }
    return ctx;
  }

  // ---------------------------------------------------------------------------
  // 1. Classical 4-String Tanpura Pluck Engine (D Tonic — Pa, Sa', Sa', Sa)
  // ---------------------------------------------------------------------------

  const TANPURA_STRINGS = [
    { freq: 110.00, gain: 0.16, bright: 950,  dur: 5.4 }, // Pa (A2)
    { freq: 146.83, gain: 0.15, bright: 1200, dur: 5.2 }, // Sa' (D3) +1.5c
    { freq: 146.70, gain: 0.14, bright: 1120, dur: 5.2 }, // Sa' (D3) -1.5c (shimmering jawari chorus)
    { freq: 73.42,  gain: 0.21, bright: 680,  dur: 6.4 }, // Kharaj Sa (D2)
  ];

  function pluckTanpura(str, time) {
    if (!ctx || !musicBus) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc2.type = "triangle";
    osc1.frequency.setValueAtTime(str.freq, time);
    osc2.frequency.setValueAtTime(str.freq * 2.0, time); // octave jawari overtone

    // Characteristic Tanpura jawari formant filter sweep (blooms smoothly after pluck)
    const bp = ctx.createBiquadFilter();
    bp.type = "lowpass";
    bp.Q.value = 2.6;
    bp.frequency.setValueAtTime(str.freq * 2.2, time);
    bp.frequency.exponentialRampToValueAtTime(str.bright, time + 0.55);
    bp.frequency.exponentialRampToValueAtTime(str.freq * 2.8, time + str.dur);

    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.0001, time);
    g1.gain.linearRampToValueAtTime(str.gain, time + 0.14);
    g1.gain.exponentialRampToValueAtTime(str.gain * 0.42, time + 1.8);
    g1.gain.exponentialRampToValueAtTime(0.0001, time + str.dur);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, time);
    g2.gain.linearRampToValueAtTime(str.gain * 0.34, time + 0.32);
    g2.gain.exponentialRampToValueAtTime(0.0001, time + str.dur * 0.85);

    osc1.connect(g1);
    g1.connect(bp);
    osc2.connect(g2);
    g2.connect(bp);
    bp.connect(musicBus);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + str.dur + 0.08);
    osc2.stop(time + str.dur + 0.08);
  }

  // ---------------------------------------------------------------------------
  // 2. Authentic Synthesized Tabla Engine (Dayan D4 + Pitch-Gliding Bayan)
  // ---------------------------------------------------------------------------

  function hitBayan(time, accent = 1.0, bendUp = true) {
    if (!ctx || !musicBus) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    // Signature Bayan "Ghe/Ge" warm palm-pressure upward pitch bloom
    osc.frequency.setValueAtTime(84, time);
    if (bendUp) {
      osc.frequency.exponentialRampToValueAtTime(118, time + 0.09);
      osc.frequency.exponentialRampToValueAtTime(76, time + 0.42);
    } else {
      osc.frequency.exponentialRampToValueAtTime(68, time + 0.24);
    }

    const sub = ctx.createOscillator();
    sub.type = "triangle";
    sub.frequency.setValueAtTime(146.83, time);
    sub.frequency.exponentialRampToValueAtTime(110, time + 0.16);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 260;

    const g = ctx.createGain();
    const peak = 0.22 * accent;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(peak, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + (bendUp ? 0.46 : 0.22));

    const gSub = ctx.createGain();
    gSub.gain.setValueAtTime(0.0001, time);
    gSub.gain.linearRampToValueAtTime(peak * 0.28, time + 0.006);
    gSub.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);

    osc.connect(g);
    sub.connect(gSub);
    g.connect(lp);
    gSub.connect(lp);
    lp.connect(musicBus);

    osc.start(time);
    sub.start(time);
    osc.stop(time + 0.52);
    sub.stop(time + 0.22);
  }

  function hitDayan(time, kind = "na", accent = 1.0) {
    if (!ctx || !musicBus) return;
    // Tuned cleanly to Tonic Sa = D4 (293.66 Hz) with classical syahi harmonic ratio (~1.5x / 2.0x)
    const baseHz = 293.66;
    if (kind === "ti" || kind === "ka") {
      // Muted crisp finger articulation
      noiseBurst(time, 0.032, kind === "ka" ? 760 : 1950, 3.2, 0.065 * accent, musicBus);
      return;
    }

    const isOpen = (kind === "tin");
    const dur = isOpen ? 0.42 : 0.28;

    // Fundamental + syahi overtone
    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(baseHz * (isOpen ? 1.0 : 1.015), time);
    o1.frequency.exponentialRampToValueAtTime(baseHz, time + 0.06);

    const o2 = ctx.createOscillator();
    o2.type = "triangle";
    o2.frequency.setValueAtTime(baseHz * 2.0, time);

    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.0001, time);
    g1.gain.linearRampToValueAtTime(0.11 * accent, time + 0.005);
    g1.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, time);
    g2.gain.linearRampToValueAtTime(0.045 * accent, time + 0.004);
    g2.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.65);

    o1.connect(g1); g1.connect(musicBus);
    o2.connect(g2); g2.connect(musicBus);
    o1.start(time); o2.start(time);
    o1.stop(time + dur + 0.04); o2.stop(time + dur + 0.04);

    // Subtle crisp skin attack transient
    noiseBurst(time, 0.022, 2400, 4.0, 0.045 * accent, musicBus);
  }

  // Serene 8-Beat Keherwa Bol Pattern (~74 BPM -> 405ms per half-beat / 810ms per beat)
  // Dha (1) · Ge (2) · Na (3) · Ti (4) | Na (5, Khali) · Ka (6) · Dhi (7) · Na (8)
  const KEHERWA_BOLS = [
    () => { const t = ctx.currentTime + 0.02; hitBayan(t, 1.0, true);  hitDayan(t, "na", 1.0); },   // 1: Dha (Sam)
    () => { const t = ctx.currentTime + 0.02; hitBayan(t, 0.72, true); },                           // 2: Ge
    () => { const t = ctx.currentTime + 0.02; hitDayan(t, "na", 0.78); },                           // 3: Na
    () => { const t = ctx.currentTime + 0.02; hitDayan(t, "ti", 0.65); },                           // 4: Ti
    () => { const t = ctx.currentTime + 0.02; hitDayan(t, "tin", 0.92); },                          // 5: Na/Tin (Khali)
    () => { const t = ctx.currentTime + 0.02; hitDayan(t, "ka", 0.62); },                           // 6: Ka
    () => { const t = ctx.currentTime + 0.02; hitBayan(t, 0.85, true); hitDayan(t, "tin", 0.82); }, // 7: Dhi
    () => { const t = ctx.currentTime + 0.02; hitDayan(t, "na", 0.75); },                           // 8: Na
  ];

  function startMusicLoops() {
    if (!ctx || mode !== "full") return;
    stopMusicLoops();

    // Immediate opening Tanpura chord swell
    const now = ctx.currentTime + 0.03;
    pluckTanpura(TANPURA_STRINGS[3], now);
    pluckTanpura(TANPURA_STRINGS[0], now + 0.35);
    tanpuraStep = 1;
    tablaStep = 0;

    tanpuraTimer = setInterval(() => {
      if (!ctx || ctx.state !== "running" || mode !== "full") return;
      pluckTanpura(TANPURA_STRINGS[tanpuraStep % 4], ctx.currentTime + 0.03);
      tanpuraStep = (tanpuraStep + 1) % 4;
    }, 1220);

    // Gentle meditative Tabla (~74 BPM = 405ms per matra subdivision -> 810ms per beat)
    tablaTimer = setInterval(() => {
      if (!ctx || ctx.state !== "running" || mode !== "full") return;
      KEHERWA_BOLS[tablaStep % KEHERWA_BOLS.length]();
      tablaStep = (tablaStep + 1) % KEHERWA_BOLS.length;
    }, 560);
  }

  function stopMusicLoops() {
    if (tanpuraTimer) { clearInterval(tanpuraTimer); tanpuraTimer = null; }
    if (tablaTimer) { clearInterval(tablaTimer); tablaTimer = null; }
  }

  function startAudioGraph() {
    const c = ensureCtx();
    if (!c) return false;
    if (c.state !== "running") return false;
    running = true;
    const t = c.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
    master.gain.exponentialRampToValueAtTime(0.62, t + 0.45);
    if (mode === "full") startMusicLoops();
    else stopMusicLoops();
    notify();
    return true;
  }

  function armAutoStart() {
    if (armed || mode === "off") return;
    armed = true;

    // Try immediate playback (works if browser already permits audio)
    const c = ensureCtx();
    if (c && c.state === "running") {
      startAudioGraph();
      return;
    }

    // Seamless gesture unlock on first click / touch / keydown if user hasn't turned music off
    const unlock = () => {
      if (mode === "off") {
        cleanup();
        return;
      }
      const ac = ensureCtx();
      if (!ac) return;
      ac.resume().then(() => {
        if (mode !== "off") startAudioGraph();
        cleanup();
      }).catch(() => {});
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
  }

  function setMode(nextMode) {
    const valid = (nextMode === "mech" || nextMode === "full") ? nextMode : "off";
    mode = valid;
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) {}

    if (mode === "off") {
      stopMusicLoops();
      running = false;
      if (ctx && master) {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
        master.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      }
      notify();
      return mode;
    }

    const c = ensureCtx();
    if (!c) { mode = "off"; running = false; notify(); return mode; }
    c.resume().then(() => {
      if (mode !== "off") startAudioGraph();
    }).catch(() => {});
    if (c.state === "running") startAudioGraph();
    else notify();
    return mode;
  }

  function toggleMusic() {
    return setMode(mode === "off" ? "full" : "off");
  }

  function cycleMode() {
    if (mode === "full") return setMode("mech");
    if (mode === "mech") return setMode("off");
    return setMode("full");
  }

  function getMode() { return mode; }
  function isEnabled() { return mode !== "off"; }
  function setEnabled(on) { return setMode(on ? "full" : "off") !== "off"; }

  // ---------------------------------------------------------------------------
  // 3. Mechanical Clockwork, Ayanamsa Clutch, & Transit Gongs / Temple Bells
  // ---------------------------------------------------------------------------

  function noiseBurst(time, duration, freq, q, gainVal, dest = sfxBus) {
    if (!ctx || !dest) return;
    const len = Math.max(64, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.22));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(time);
    src.stop(time + duration + 0.02);
  }

  function partialTone(time, freq, duration, peakGain, type = "sine", glideTo = null) {
    if (!ctx || !sfxBus) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, time + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peakGain, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(g);
    g.connect(sfxBus);
    osc.start(time);
    osc.stop(time + duration + 0.04);
  }

  function playTick(speedMode = "day") {
    if (mode === "off" || !ctx || ctx.state !== "running") return;
    const nowMs = performance.now();
    const minInterval = speedMode === "month" ? 135 : (speedMode === "week" ? 165 : 195);
    if (nowMs - lastTickAt < minInterval) return;
    lastTickAt = nowMs;
    const t = ctx.currentTime;
    const pitch = speedMode === "month" ? 1380 : (speedMode === "week" ? 1120 : 920);
    // Keep mechanical ticks extra subtle when Tabla + Tanpura is playing
    const vol = mode === "full" ? 0.024 : 0.055;
    noiseBurst(t, 0.025, pitch, 5.5, vol, sfxBus);
  }

  function playRatchet() {
    if (mode === "off" || !ctx || ctx.state !== "running") return;
    const nowMs = performance.now();
    if (nowMs - lastRatchetAt < 55) return;
    lastRatchetAt = nowMs;
    const t = ctx.currentTime;
    noiseBurst(t, 0.018, 1520, 6.2, 0.075, sfxBus);
    partialTone(t, 165, 0.032, 0.035, "triangle", 118);
  }

  function playAyanamsaClutch() {
    if (mode === "off" || !ctx || ctx.state !== "running") return;
    const t = ctx.currentTime;
    noiseBurst(t, 0.06, 620, 3.2, 0.14, sfxBus);
    noiseBurst(t + 0.075, 0.045, 1650, 6.0, 0.10, sfxBus);
    partialTone(t, 185, 0.35, 0.10, "triangle", 146.83);
    partialTone(t + 0.075, 440, 0.55, 0.06, "sine");
  }

  function playNatalLock(locking = true) {
    if (mode === "off" || !ctx || ctx.state !== "running") return;
    const t = ctx.currentTime;
    noiseBurst(t, 0.055, 480, 2.5, 0.18, sfxBus);
    noiseBurst(t + 0.09, 0.04, 1900, 7.0, 0.12, sfxBus);
    if (locking) {
      partialTone(t + 0.02, 146.83, 1.4, 0.12, "triangle");
      partialTone(t + 0.11, 220.00, 1.5, 0.10, "sine");
      partialTone(t + 0.20, 293.66, 1.8, 0.09, "sine");
      partialTone(t + 0.29, 440.00, 1.9, 0.07, "sine");
    } else {
      partialTone(t, 293.66, 0.5, 0.09, "sine", 146.83);
    }
  }

  function playDoubleTransit() {
    if (mode === "off" || !ctx || ctx.state !== "running") return;
    const nowMs = performance.now();
    if (nowMs - lastAlertAt < 900) return;
    lastAlertAt = nowMs;
    const t = ctx.currentTime;
    noiseBurst(t, 0.08, 1250, 2.2, 0.18, sfxBus);
    partialTone(t, 146.83, 3.2, 0.20, "sine");
    partialTone(t, 293.66, 2.6, 0.13, "sine");
    partialTone(t, 405.25, 2.0, 0.08, "sine");
    partialTone(t + 0.12, 220.00, 3.0, 0.11, "triangle");
    partialTone(t + 0.24, 369.99, 2.8, 0.09, "sine");
    partialTone(t + 0.36, 587.33, 2.5, 0.06, "sine");
  }

  function playTripleTransit() {
    if (mode === "off" || !ctx || ctx.state !== "running") return;
    const nowMs = performance.now();
    if (nowMs - lastAlertAt < 1100) return;
    lastAlertAt = nowMs;
    const t = ctx.currentTime;
    noiseBurst(t, 0.36, 420, 1.1, 0.24, sfxBus);
    noiseBurst(t + 0.04, 0.52, 1600, 1.8, 0.12, sfxBus);
    partialTone(t, 73.42, 4.8, 0.28, "sine", 71.5);
    partialTone(t, 146.83, 4.4, 0.22, "triangle");
    partialTone(t, 207.65, 3.4, 0.09, "sine");
    [220.00, 277.18, 329.63, 440.00, 587.33].forEach((hz, idx) => {
      partialTone(t + 0.10 + idx * 0.13, hz, 3.8 - idx * 0.2, 0.10 - idx * 0.01, "sine");
    });
  }

  function playPadaHit() {
    if (mode === "off" || !ctx || ctx.state !== "running") return;
    const nowMs = performance.now();
    if (nowMs - lastAlertAt < 650) return;
    lastAlertAt = nowMs;
    const t = ctx.currentTime;
    partialTone(t, 587.33, 1.5, 0.08, "sine");
    partialTone(t + 0.09, 880.00, 1.7, 0.06, "sine");
  }

  // Arm default-ON Tabla & Tanpura ambience cleanly on load
  if (typeof window !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", armAutoStart);
    } else {
      armAutoStart();
    }
  }

  root.CosmicAudio = {
    setMode,
    toggleMusic,
    cycleMode,
    getMode,
    setEnabled,
    isEnabled,
    onChange,
    playTick,
    playRatchet,
    playAyanamsaClutch,
    playNatalLock,
    playDoubleTransit,
    playTripleTransit,
    playPadaHit,
  };
})(typeof window !== "undefined" ? window : globalThis);
