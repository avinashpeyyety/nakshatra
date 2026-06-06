/**
 * Landing page metrics — visits & download clicks via CountAPI; stars/traffic from metrics.json.
 */
(function () {
  const NS = "nakshatra-landing";
  const KEYS = { visits: "visits", mac: "dl-mac", win: "dl-win" };

  function fmt(n) {
    if (n == null || Number.isNaN(n)) return null;
    return Number(n).toLocaleString();
  }

  async function countApi(path, key) {
    try {
      const r = await fetch(`https://api.countapi.xyz/${path}/${NS}/${key}`);
      if (!r.ok) return null;
      const d = await r.json();
      return typeof d.value === "number" ? d.value : null;
    } catch (_) {
      return null;
    }
  }

  function countHit(key) {
    return countApi("hit", key);
  }

  function countGet(key) {
    return countApi("get", key);
  }

  async function loadMetricsJson() {
    try {
      const r = await fetch("metrics.json", { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch (_) {}
    return {};
  }

  function render(el, data) {
    const items = [];
    if (data.visits != null) items.push({ label: "visits", html: `<strong>${data.visits}</strong> visits` });
    if (data.mac != null) items.push({ label: "macOS downloads", html: `<strong>${data.mac}</strong> macOS` });
    if (data.win != null) items.push({ label: "Windows downloads", html: `<strong>${data.win}</strong> Windows` });
    if (data.stars != null) items.push({ label: "GitHub stars", html: `<strong>★ ${data.stars}</strong> stars` });
    if (data.views14d != null) {
      items.push({ label: "repo views (14 days)", html: `<strong>${data.views14d}</strong> repo views <span class="metrics-hint">(14d)</span>` });
    }

    if (!items.length) {
      el.innerHTML = '<span class="metrics-hint">Metrics unavailable</span>';
      return;
    }

    el.innerHTML = items
      .map((item) => `<span class="metrics-item" title="${item.label}">${item.html}</span>`)
      .join('<span class="metrics-sep" aria-hidden="true">·</span>');
  }

  function wireDownloads(onUpdate) {
    for (const [id, key] of [
      ["dl-mac", KEYS.mac],
      ["dl-win", KEYS.win],
    ]) {
      const link = document.getElementById(id);
      if (!link || link.getAttribute("aria-disabled") === "true") continue;
      link.addEventListener("click", async () => {
        const value = await countHit(key);
        if (value != null) onUpdate(key, value);
      });
    }
  }

  async function init() {
    const el = document.getElementById("site-metrics");
    if (!el) return;

    const state = { visits: null, mac: null, win: null, stars: null, views14d: null };

    function paint() {
      render(el, {
        visits: fmt(state.visits),
        mac: fmt(state.mac),
        win: fmt(state.win),
        stars: fmt(state.stars),
        views14d: fmt(state.views14d),
      });
    }

    function onDownloadUpdate(key, value) {
      if (key === KEYS.mac) state.mac = value;
      if (key === KEYS.win) state.win = value;
      paint();
    }

    const [visits, mac, win, metrics] = await Promise.all([
      countHit(KEYS.visits),
      countGet(KEYS.mac),
      countGet(KEYS.win),
      loadMetricsJson(),
    ]);

    state.visits = visits;
    state.mac = mac;
    state.win = win;
    state.stars = metrics.stars ?? null;
    state.views14d = metrics.repoViews14d ?? null;
    paint();

    wireDownloads(onDownloadUpdate);

    if (state.stars == null) {
      try {
        const r = await fetch("https://api.github.com/repos/avinashpeyyety/nakshatra");
        if (r.ok) {
          const repo = await r.json();
          state.stars = repo.stargazers_count;
          paint();
        }
      } catch (_) {}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
