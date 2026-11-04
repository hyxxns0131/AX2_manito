// 맛(색 테마) — 각자 고른 맛을 이 브라우저에 사람별로 기억
// 화면이 깜빡이지 않도록 <head>에서 CSS보다 먼저 불러옵니다.
(() => {
  const PRESETS = [
    { name: "딸기", flavor: "#ffd9e3", accent: "#ee6f8f" },
    { name: "민트초코", flavor: "#cdeee2", accent: "#4fa58c" },
    { name: "말차", flavor: "#e2edc2", accent: "#7f9f45" },
    { name: "블루베리", flavor: "#dcdcf8", accent: "#7c71cf" },
    { name: "레몬", flavor: "#fff0b8", accent: "#e39a2d" },
    { name: "초코", flavor: "#efdac6", accent: "#96603e" },
  ];
  const BASE_KEY = "manito-flavor"; // 로그인 전 화면은 마지막에 고른 맛을 씀

  function userKey() {
    try {
      const id = JSON.parse(sessionStorage.getItem("manito-session"))?.id; // auth.js의 세션
      return id ? `${BASE_KEY}-${id}` : BASE_KEY;
    } catch {
      return BASE_KEY;
    }
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(userKey()) ?? localStorage.getItem(BASE_KEY)) ?? PRESETS[0];
    } catch {
      return PRESETS[0];
    }
  }

  let current = load();

  function apply(theme) {
    current = theme;
    const root = document.documentElement.style;
    root.setProperty("--flavor", theme.flavor);
    root.setProperty("--accent", theme.accent);
  }

  function choose(theme) {
    apply(theme);
    try {
      const saved = JSON.stringify(theme);
      localStorage.setItem(userKey(), saved);
      localStorage.setItem(BASE_KEY, saved);
    } catch {}
    document.querySelectorAll(".theme-swatch").forEach(el => {
      el.setAttribute("aria-pressed", String(el.dataset.color === theme.flavor));
    });
    document.querySelectorAll(".theme-custom input").forEach(el => (el.value = theme.flavor));
  }

  function buildPicker(host) {
    const box = document.createElement("details");
    box.className = "theme-picker";
    const summary = document.createElement("summary");
    summary.textContent = "🍓 맛";
    summary.setAttribute("aria-label", "맛 바꾸기");
    const pop = document.createElement("div");
    pop.className = "theme-pop";

    PRESETS.forEach(preset => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "theme-swatch";
      b.dataset.color = preset.flavor;
      b.style.setProperty("--swatch", preset.flavor);
      b.style.setProperty("--swatch-accent", preset.accent);
      b.textContent = preset.name;
      b.setAttribute("aria-pressed", String(preset.flavor === current.flavor));
      b.addEventListener("click", () => choose(preset));
      pop.append(b);
    });

    const custom = document.createElement("label");
    custom.className = "theme-custom";
    custom.textContent = "직접 고르기 ";
    const input = document.createElement("input");
    input.type = "color";
    input.value = current.flavor;
    input.addEventListener("input", () => choose({ ...current, name: "직접 고른 맛", flavor: input.value }));
    custom.append(input);
    pop.append(custom);

    box.append(summary, pop);
    host.append(box);
  }

  apply(current);

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-theme-picker]").forEach(buildPicker);
  });
})();
