/**
 * Ambient tanpura (Sa = D, Pa fifth) + soft ektaal tabla for the landing page.
 * Mix v4 — tanpura 0.018, tabla 0.45. Boot v7 — best-effort load autoplay.
 */
(function () {
  const AUDIO_MIX_VERSION = 7;
  const SA = 146.83;
  const PA = 220;
  const SA_HIGH = 293.66;
  const MATRA_BPM = 45;
  const MATRA_SEC = 60 / MATRA_BPM;
  const STORAGE_KEY = "nakshatra-ambient-audio";

  const EKTAAL = [
    { bol: "dhin", sam: true },
    { bol: "dhin" },
    { bol: "dha" },
    { bol: "ge" },
    { bol: "tu" },
    { bol: "na" },
    { bol: "kat" },
    { bol: "ta" },
    { bol: "dha" },
    { bol: "ge" },
    { bol: "tu" },
    { bol: "na" },
  ];

  let ctx = null;
  let tanpuraNodes = null;
  let tablaGain = null;
  let tanpuraGain = null;
  let masterGain = null;
  let matraIndex = 0;
  let nextMatraTime = 0;
  let schedulerTimer = null;
  let playing = false;
  let enabled = true;
  let reducedMotion = false;
  let cancelBoot = null;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isExplicitlyOff() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "0";
    } catch (_) {
      return false;
    }
  }

  function shouldEnableByDefault() {
    return !reducedMotion && !isExplicitlyOff();
  }

  function persistPreference(on) {
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch (_) {}
  }

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(ctx.destination);

      tanpuraGain = ctx.createGain();
      tanpuraGain.gain.value = 0.018;
      tanpuraGain.connect(masterGain);

      tablaGain = ctx.createGain();
      tablaGain.gain.value = 0.45;
      tablaGain.connect(masterGain);
    }
    return ctx;
  }

  function startTanpura() {
    if (tanpuraNodes || !ctx) return;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 750;
    filter.Q.value = 0.6;
    filter.connect(tanpuraGain);

    const strings = [
      { freq: SA, gain: 0.30, detune: -4 },
      { freq: SA, gain: 0.24, detune: 5 },
      { freq: PA, gain: 0.20, detune: -2 },
      { freq: SA_HIGH, gain: 0.06, detune: 3 },
    ];

    tanpuraNodes = strings.map(({ freq, gain, detune }) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.detune.value = detune;

      const g = ctx.createGain();
      g.gain.value = gain;

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.07 + Math.random() * 0.04;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.025;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);

      osc.connect(g);
      g.connect(filter);
      osc.start();
      lfo.start();
      return { osc, lfo };
    });
  }

  function stopTanpura() {
    if (!tanpuraNodes) return;
    for (const { osc, lfo } of tanpuraNodes) {
      try { osc.stop(); lfo.stop(); } catch (_) {}
    }
    tanpuraNodes = null;
  }

  function noiseBurst(time, duration, freq, q, gain, dest) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.18));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);

    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(time);
    src.stop(time + duration + 0.02);
  }

  function toneBurst(time, freq, duration, gain, dest) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.82, time + duration);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  function playBol(bol, time, accent) {
    const dest = tablaGain;
    const vol = accent ? 1.15 : 1;

    switch (bol) {
      case "dhin":
        toneBurst(time, 118, 0.42, 0.55 * vol, dest);
        noiseBurst(time, 0.35, 180, 1.2, 0.28 * vol, dest);
        break;
      case "dha":
        toneBurst(time, 98, 0.38, 0.48 * vol, dest);
        noiseBurst(time, 0.28, 140, 0.9, 0.22 * vol, dest);
        break;
      case "ge":
        noiseBurst(time, 0.07, 220, 2.5, 0.12 * vol, dest);
        break;
      case "tu":
        toneBurst(time, 248, 0.22, 0.3 * vol, dest);
        noiseBurst(time, 0.14, 320, 2, 0.14 * vol, dest);
        break;
      case "na":
        toneBurst(time, 285, 0.32, 0.34 * vol, dest);
        noiseBurst(time, 0.2, 400, 2.2, 0.16 * vol, dest);
        break;
      case "kat":
        noiseBurst(time, 0.05, 280, 3, 0.14 * vol, dest);
        break;
      case "ta":
        toneBurst(time, 310, 0.18, 0.26 * vol, dest);
        noiseBurst(time, 0.12, 450, 2.5, 0.12 * vol, dest);
        break;
      default:
        break;
    }
  }

  function scheduleTabla() {
    if (!ctx || !playing) return;
    const horizon = 0.12;
    while (nextMatraTime < ctx.currentTime + horizon) {
      const step = EKTAAL[matraIndex];
      playBol(step.bol, nextMatraTime, step.sam);
      matraIndex = (matraIndex + 1) % EKTAAL.length;
      nextMatraTime += MATRA_SEC;
    }
  }

  function startScheduler() {
    if (schedulerTimer) return;
    matraIndex = 0;
    nextMatraTime = ctx.currentTime + 0.08;
    schedulerTimer = setInterval(scheduleTabla, 40);
    scheduleTabla();
  }

  function stopScheduler() {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  }

  function fadeMaster(to, duration) {
    if (!masterGain || !ctx) return;
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.linearRampToValueAtTime(to, t + duration);
  }

  function startAudioNodes() {
    startTanpura();
    startScheduler();
    fadeMaster(1, 1.8);
    playing = true;
  }

  /** Sync resume — must run inside a user-gesture handler (Safari/iOS). */
  function startAudio() {
    if (playing) return true;
    const c = ensureContext();
    if (!c) return false;
    if (c.state === "suspended") c.resume();
    startAudioNodes();
    return true;
  }

  /** Browsers may allow this for returning visitors (Chrome MEI, etc.). */
  async function tryAutoplayOnLoad(btn) {
    if (!enabled || playing) return;
    const c = ensureContext();
    if (!c) return;
    try {
      await c.resume();
    } catch (_) {}
    if (c.state !== "running") return;
    cancelBoot?.();
    cancelBoot = null;
    startAudioNodes();
    persistPreference(true);
    updateToggle(btn, true, false);
  }

  function stopAudio() {
    if (!playing) return;
    fadeMaster(0, 0.6);
    playing = false;
    stopScheduler();
    setTimeout(stopTanpura, 700);
  }

  function buildToggle() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "ambient-audio-toggle";
    btn.className = "ambient-audio-toggle";
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Toggle tanpura and tabla background sound");
    btn.innerHTML = '<span class="ambient-audio-icon" aria-hidden="true">♪</span><span class="ambient-audio-label">Sound off</span>';
    document.body.appendChild(btn);
    return btn;
  }

  function updateToggle(btn, on, armed) {
    const active = on || armed;
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    btn.classList.toggle("is-on", on);
    btn.classList.toggle("is-armed", armed && !on);
    btn.querySelector(".ambient-audio-label").textContent = active ? "Sound on" : "Sound off";
  }

  function beginPlayback(btn) {
    if (playing) return true;
    cancelBoot?.();
    cancelBoot = null;
    const ok = startAudio();
    if (!ok) {
      enabled = false;
      persistPreference(false);
      updateToggle(btn, false, false);
      return false;
    }
    enabled = true;
    persistPreference(true);
    updateToggle(btn, true, false);
    return true;
  }

  function toggle(btn) {
    if (enabled && playing) {
      enabled = false;
      cancelBoot?.();
      cancelBoot = null;
      stopAudio();
      persistPreference(false);
      updateToggle(btn, false, false);
      return;
    }
    beginPlayback(btn);
  }

  function registerBoot(btn) {
    const BOOT_EVENTS = ["pointerdown", "keydown"];
    const opts = { capture: true, passive: true };
    const boot = (e) => {
      if (!enabled || playing) return;
      if (e.target?.closest?.("#ambient-audio-toggle")) return;
      if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
      beginPlayback(btn);
    };
    cancelBoot = () => {
      BOOT_EVENTS.forEach((ev) => document.removeEventListener(ev, boot, opts));
    };
    BOOT_EVENTS.forEach((ev) => document.addEventListener(ev, boot, opts));
  }

  function init() {
    reducedMotion = prefersReducedMotion();
    enabled = shouldEnableByDefault();
    const btn = buildToggle();
    updateToggle(btn, false, enabled);

    btn.addEventListener("click", () => toggle(btn));

    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) {
        if (playing) ctx.suspend();
      } else if (playing && enabled) {
        ctx.resume();
      }
    });

    if (enabled) {
      registerBoot(btn);
      tryAutoplayOnLoad(btn);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.__nakshatraAudioMix = AUDIO_MIX_VERSION;
})();
