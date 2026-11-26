/**
 * Nakshatra Chakram — Cosmic Machine Web Audio Synthesizer
 *
 * Synthesizes:
 *   - Subtle deep-space metallic machine drone (D2 / A2 / D3 tanpura-astrolabe hum)
 *   - Rate-limited mechanical escapement tick synced to daily / weekly / monthly clock steps
 *   - Heavy brass clutch detent on Lahiri <-> Raman ayanamsa switches
 *   - Metallic vault latch + harmonic chime when locking a user's Natal Chart
 *   - DOUBLE TRANSIT (Jupiter + Saturn): Resonant temple bronze bell + fifth shimmer
 *   - TRIPLE TRANSIT (Jupiter + Saturn + Rahu/Ketu): Colossal sub-bass cosmic gong + Lydian cascade
 *   - EXACT PADA CONJUNCTION: Crystalline astrolabe chime
 */
(function (root) {
  "use strict";

  const STORAGE_KEY = "nakshatra-cosmic-sound";

  let ctx = null;
  let master = null;
  let droneNodes = null;
  let droneGain = null;
  let enabled = false;
  let lastTickAt = 0;
  let lastAlertAt = 0;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);

      droneGain = ctx.createGain();
      droneGain.gain.value = 0.14;
      droneGain.connect(master);
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function startDrone() {
    if (droneNodes || !ctx) return;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 340;
    lp.Q.value = 1.2;
    lp.connect(droneGain);

    // D2 (73.42), A2 (110.0), D3 (146.83) — colossal cosmic astrolabe hum
    const voices = [
      { freq: 73.42,  type: "sawtooth", gain: 0.22, detune: -3, lfoHz: 0.05 },
      { freq: 73.42,  type: "triangle", gain: 0.28, detune: 4,  lfoHz: 0.07 },
      { freq: 110.00, type: "triangle", gain: 0.18, detune: -2, lfoHz: 0.09 },
      { freq: 146.83, type: "sine",     gain: 0.15, detune: 2,  lfoHz: 0.06 },
    ];

    droneNodes = voices.map((v) => {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.value = v.freq;
      osc.detune.value = v.detune;

      const g = ctx.createGain();
      g.gain.value = v.gain;

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = v.lfoHz;
      const lg = ctx.createGain();
      lg.gain.value = v.gain * 0.18;
      lfo.connect(lg);
      lg.connect(g.gain);

      osc.connect(g);
      g.connect(lp);
      osc.start();
      lfo.start();
      return { osc, lfo };
    });
  }

  function stopDrone() {
    if (!droneNodes) return;
    for (const n of droneNodes) {
      try { n.osc.stop(); n.lfo.stop(); } catch (_) {}
    }
    droneNodes = null;
  }

  function setEnabled(on) {
    enabled = Boolean(on);
    try { localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0"); } catch (_) {}
    if (enabled) {
      const c = ensureCtx();
      if (!c) return false;
      startDrone();
      const t = c.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
      master.gain.exponentialRampToValueAtTime(0.65, t + 0.35);
    } else if (ctx && master) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
      master.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      setTimeout(() => { if (!enabled) stopDrone(); }, 300);
    }
    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  function noiseClick(time, duration, freq, q, gainVal) {
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
    g.connect(master);
    src.start(time);
    src.stop(time + duration + 0.02);
  }

  function partialTone(time, freq, duration, peakGain, type = "sine", glideTo = null) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (glideTo) {
      osc.frequency.exponentialRampToValueAtTime(glideTo, time + duration);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peakGain, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(g);
    g.connect(master);
    osc.start(time);
    osc.stop(time + duration + 0.04);
  }

  /** Subtle mechanical escapement tick as days advance */
  function playTick(speedMode = "day") {
    if (!enabled || !ctx) return;
    const nowMs = performance.now();
    const minInterval = speedMode === "month" ? 130 : (speedMode === "week" ? 160 : 190);
    if (nowMs - lastTickAt < minInterval) return;
    lastTickAt = nowMs;
    const t = ctx.currentTime;
    const pitch = speedMode === "month" ? 1380 : (speedMode === "week" ? 1120 : 920);
    noiseClick(t, 0.028, pitch, 5.5, 0.055);
    partialTone(t, 110, 0.055, 0.032, "triangle", 72);
  }

  /** Heavy metallic gear clutch when switching Lahiri <-> Raman ayanamsa */
  function playAyanamsaClutch() {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime;
    noiseClick(t, 0.06, 620, 3.2, 0.16);
    noiseClick(t + 0.075, 0.045, 1650, 6.0, 0.11);
    partialTone(t, 185, 0.35, 0.12, "triangle", 146.83);
    partialTone(t + 0.075, 440, 0.55, 0.07, "sine");
  }

  /** Vault lock / unlock metallic latch for Natal Chart */
  function playNatalLock(locking = true) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime;
    noiseClick(t, 0.055, 480, 2.5, 0.22);
    noiseClick(t + 0.09, 0.04, 1900, 7.0, 0.14);
    if (locking) {
      partialTone(t + 0.02, 146.83, 1.4, 0.14, "triangle");
      partialTone(t + 0.11, 220.00, 1.5, 0.12, "sine");
      partialTone(t + 0.20, 293.66, 1.8, 0.11, "sine");
      partialTone(t + 0.29, 440.00, 1.9, 0.08, "sine");
    } else {
      partialTone(t, 293.66, 0.5, 0.10, "sine", 146.83);
    }
  }

  /** DOUBLE TRANSIT (Jupiter + Saturn): Temple bronze bell + luminous fifth shimmer */
  function playDoubleTransit() {
    if (!enabled) return;
    const nowMs = performance.now();
    if (nowMs - lastAlertAt < 900) return;
    lastAlertAt = nowMs;
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime;

    // Bronze strike transient
    noiseClick(t, 0.08, 1250, 2.2, 0.20);
    // Inharmonic temple bronze bell partials around D3 (146.83 Hz)
    partialTone(t, 146.83, 3.2, 0.24, "sine");
    partialTone(t, 293.66, 2.6, 0.15, "sine");
    partialTone(t, 405.25, 2.0, 0.09, "sine"); // ~2.76x bell partial
    partialTone(t, 597.60, 1.4, 0.05, "sine"); // ~4.07x bell partial
    // Warm fifth + major third shimmer
    partialTone(t + 0.12, 220.00, 3.0, 0.13, "triangle");
    partialTone(t + 0.24, 369.99, 2.8, 0.11, "sine"); // F#4
    partialTone(t + 0.36, 587.33, 2.5, 0.07, "sine"); // D5
  }

  /** TRIPLE TRANSIT (Jupiter + Saturn + Rahu/Ketu): Colossal sub-bass cosmic gong + golden cascade */
  function playTripleTransit() {
    if (!enabled) return;
    const nowMs = performance.now();
    if (nowMs - lastAlertAt < 1100) return;
    lastAlertAt = nowMs;
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime;

    // Massive forged gong wash
    noiseClick(t, 0.38, 420, 1.1, 0.30);
    noiseClick(t + 0.04, 0.55, 1600, 1.8, 0.14);

    // Sub-bass D2 + D3 foundation
    partialTone(t, 73.42, 4.8, 0.34, "sine", 71.5);
    partialTone(t, 146.83, 4.4, 0.26, "triangle");
    partialTone(t, 207.65, 3.4, 0.11, "sine"); // deep gong metallic tritone/in-harmonic

    // Golden cosmic cascade: A3 -> C#4 -> E4 -> A4 -> D5
    const notes = [220.00, 277.18, 329.63, 440.00, 587.33];
    notes.forEach((hz, idx) => {
      partialTone(t + 0.10 + idx * 0.13, hz, 3.8 - idx * 0.2, 0.12 - idx * 0.012, "sine");
    });
  }

  /** Exact Slow-Planet Pada Conjunction: delicate astrolabe chime */
  function playPadaHit() {
    if (!enabled) return;
    const nowMs = performance.now();
    if (nowMs - lastAlertAt < 650) return;
    lastAlertAt = nowMs;
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime;
    partialTone(t, 587.33, 1.5, 0.09, "sine");
    partialTone(t + 0.09, 880.00, 1.7, 0.07, "sine");
  }

  root.CosmicAudio = {
    setEnabled,
    isEnabled,
    playTick,
    playAyanamsaClutch,
    playNatalLock,
    playDoubleTransit,
    playTripleTransit,
    playPadaHit,
  };
})(typeof window !== "undefined" ? window : globalThis);
