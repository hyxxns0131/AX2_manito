// 스킨 — 미니홈피 배경·메뉴 색. 각자 고른 스킨을 이 브라우저에 사람별로 기억
// 화면이 깜빡이지 않도록 <head>에서 CSS보다 먼저 불러옵니다.
(() => {
  const PRESETS = [
    { name: "하늘", skin: "#9fd0ee", accent: "#2b7fc4" },
    { name: "핑크", skin: "#f7bfd3", accent: "#d9467c" },
    { name: "민트", skin: "#a8e2cf", accent: "#25936f" },
    { name: "보라", skin: "#cdbdf0", accent: "#6f52c4" },
    { name: "레몬", skin: "#f6e08e", accent: "#c27a00" },
    { name: "회색", skin: "#cfcfcf", accent: "#4f5b66" },
  ];
  const BASE_KEY = "manito-skin"; // 로그인 전 화면은 마지막에 고른 스킨을 씀

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
      const saved = JSON.parse(localStorage.getItem(userKey()) ?? localStorage.getItem(BASE_KEY));
      return saved?.skin ? saved : PRESETS[0];
    } catch {
      return PRESETS[0];
    }
  }

  let current = load();

  function apply(theme) {
    current = theme;
    const root = document.documentElement.style;
    root.setProperty("--skin", theme.skin);
    root.setProperty("--accent", theme.accent);
  }

  // 직접 고른 배경색에 어울리는 진한 메뉴 색
  function deepen(hex) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => Math.round(((n >> s) & 255) * 0.55);
    return `#${[16, 8, 0].map(s => ch(s).toString(16).padStart(2, "0")).join("")}`;
  }

  function choose(theme) {
    apply(theme);
    try {
      const saved = JSON.stringify(theme);
      localStorage.setItem(userKey(), saved);
      localStorage.setItem(BASE_KEY, saved);
    } catch {}
    document.querySelectorAll(".theme-swatch").forEach(el => {
      el.setAttribute("aria-pressed", String(el.dataset.color === theme.skin));
    });
    document.querySelectorAll(".theme-custom input").forEach(el => (el.value = theme.skin));
  }

  function buildPicker(host) {
    const box = document.createElement("details");
    box.className = "theme-picker";
    const summary = document.createElement("summary");
    summary.textContent = "🎨 스킨";
    summary.setAttribute("aria-label", "스킨 바꾸기");
    const pop = document.createElement("div");
    pop.className = "theme-pop";

    PRESETS.forEach(preset => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "theme-swatch";
      b.dataset.color = preset.skin;
      b.style.setProperty("--swatch", preset.skin);
      b.style.setProperty("--swatch-accent", preset.accent);
      b.textContent = preset.name;
      b.setAttribute("aria-pressed", String(preset.skin === current.skin));
      b.addEventListener("click", () => choose(preset));
      pop.append(b);
    });

    const custom = document.createElement("label");
    custom.className = "theme-custom";
    custom.textContent = "직접 고르기 ";
    const input = document.createElement("input");
    input.type = "color";
    input.value = current.skin;
    input.addEventListener("input", () => choose({ name: "직접 고른 스킨", skin: input.value, accent: deepen(input.value) }));
    custom.append(input);
    pop.append(custom);

    // 바깥을 누르면 닫힘
    document.addEventListener("click", e => { if (!box.contains(e.target)) box.open = false; });

    box.append(summary, pop);
    host.append(box);
  }

  apply(current);

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-theme-picker]").forEach(buildPicker);
  });
})();
