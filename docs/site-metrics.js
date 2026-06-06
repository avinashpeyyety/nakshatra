/**
 * Landing page metrics — GitHub stars (live) + traffic snapshot from metrics.json.
 */
(function () {
  const FETCH_MS = 4000;

  function fmt(n) {
    if (n == null || Number.isNaN(n)) return null;
    return Number(n).toLocaleString();
  }

  function fetchWithTimeout(url, opts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  }

  async function loadMetricsJson() {
    try {
      const r = await fetchWithTimeout("metrics.json", { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch (_) {}
    return {};
  }

  async function loadGithubStars() {
    try {
      const r = await fetchWithTimeout("https://api.github.com/repos/avinashpeyyety/nakshatra");
      if (r.ok) {
        const repo = await r.json();
        return repo.stargazers_count;
      }
    } catch (_) {}
    return null;
  }

  function render(el, data) {
    const items = [];
    if (data.views14d != null) {
      items.push({
        label: "GitHub repo page views in the last 14 days",
        html: `<strong>${data.views14d}</strong> views <span class="metrics-hint">(14d)</span>`,
      });
    }
    if (data.clones14d != null) {
      items.push({
        label: "Git clone events in the last 14 days",
        html: `<strong>${data.clones14d}</strong> clones <span class="metrics-hint">(14d)</span>`,
      });
    }
    if (data.stars != null) {
      items.push({ label: "GitHub stars", html: `<strong>★ ${data.stars}</strong> stars` });
    }
    if (data.forks != null) {
      items.push({ label: "GitHub forks", html: `<strong>${data.forks}</strong> forks` });
    }

    if (!items.length) {
      el.innerHTML = '<span class="metrics-hint">Metrics unavailable right now</span>';
      return;
    }

    el.innerHTML = items
      .map((item) => `<span class="metrics-item" title="${item.label}">${item.html}</span>`)
      .join('<span class="metrics-sep" aria-hidden="true">·</span>');

    if (data.updatedAt) {
      const when = new Date(data.updatedAt);
      if (!Number.isNaN(when.getTime())) {
        el.insertAdjacentHTML(
          "beforeend",
          `<span class="metrics-updated">Updated ${when.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>`
        );
      }
    }
  }

  async function init() {
    const el = document.getElementById("site-metrics");
    if (!el) return;

    const state = { stars: null, forks: null, views14d: null, clones14d: null, updatedAt: null };

    function paint() {
      render(el, {
        stars: fmt(state.stars),
        forks: fmt(state.forks),
        views14d: fmt(state.views14d),
        clones14d: fmt(state.clones14d),
        updatedAt: state.updatedAt,
      });
    }

    paint();

    const metricsP = loadMetricsJson();
    const starsP = loadGithubStars();

    const metrics = await metricsP;
    state.views14d = metrics.repoViews14d ?? null;
    state.clones14d = metrics.repoClones14d ?? null;
    state.forks = metrics.forks ?? null;
    state.updatedAt = metrics.updatedAt ?? null;
    if (metrics.stars != null) state.stars = metrics.stars;
    paint();

    const stars = await starsP;
    if (stars != null) state.stars = stars;
    paint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
