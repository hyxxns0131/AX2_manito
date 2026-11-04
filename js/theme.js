// 콘솔 색 — 각자 고른 색을 이 브라우저에 사람별로 기억
// 화면이 깜빡이지 않도록 <head>에서 CSS보다 먼저 불러옵니다.
(() => {
  const PRESETS = [
    { name: "민트 블루", console: "#3fb7c4", bezel: "#f0639f" },
    { name: "딸기 핑크", console: "#f27fb2", bezel: "#3fb7c4" },
    { name: "라벤더", console: "#a892e6", bezel: "#ffd35c" },
    { name: "레몬", console: "#f5cb4f", bezel: "#f0639f" },
    { name: "메론", console: "#7fd4a0", bezel: "#f0639f" },
    { name: "밤하늘", console: "#39406e", bezel: "#f0639f" },
  ];
  const BASE_KEY = "manito-theme"; // 로그인 전 화면은 마지막에 고른 색을 씀

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

  // 밝은 색 위에는 어두운 글자, 어두운 색 위에는 흰 글자
  function textOn(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return r * 0.299 + g * 0.587 + b * 0.114 > 165 ? "#2b1c28" : "#ffffff";
  }

  let current = load();

  function apply(theme) {
    current = theme;
    const root = document.documentElement.style;
    root.setProperty("--console", theme.console);
    root.setProperty("--bezel", theme.bezel);
    root.setProperty("--on-console", textOn(theme.console));
  }

  function choose(theme) {
    apply(theme);
    try {
      const saved = JSON.stringify(theme);
      localStorage.setItem(userKey(), saved);
      localStorage.setItem(BASE_KEY, saved);
    } catch {}
    document.querySelectorAll(".theme-swatch").forEach(el => {
      el.setAttribute("aria-pressed", String(el.dataset.color === theme.console));
    });
    document.querySelectorAll(".theme-custom input").forEach(el => (el.value = theme.console));
  }

  function buildPicker(host) {
    const box = document.createElement("details");
    box.className = "theme-picker";
    const summary = document.createElement("summary");
    summary.textContent = "🎨 색";
    summary.setAttribute("aria-label", "콘솔 색 바꾸기");
    const pop = document.createElement("div");
    pop.className = "theme-pop";

    PRESETS.forEach(preset => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "theme-swatch";
      b.dataset.color = preset.console;
      b.style.setProperty("--swatch", preset.console);
      b.style.setProperty("--swatch-bezel", preset.bezel);
      b.setAttribute("aria-label", preset.name);
      b.setAttribute("aria-pressed", String(preset.console === current.console));
      b.addEventListener("click", () => choose(preset));
      pop.append(b);
    });

    const custom = document.createElement("label");
    custom.className = "theme-custom";
    custom.textContent = "직접 고르기 ";
    const input = document.createElement("input");
    input.type = "color";
    input.value = current.console;
    input.addEventListener("input", () => choose({ ...current, name: "직접 고른 색", console: input.value }));
    custom.append(input);
    pop.append(custom);

    box.append(summary, pop);
    host.append(box);
  }

  apply(current);

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-theme-picker]").forEach(buildPicker);

    // 콘솔 다이얼: 돌릴 때마다 다음 색
    document.querySelectorAll("[data-theme-next]").forEach(dial => {
      let turn = 0;
      dial.addEventListener("click", () => {
        const i = PRESETS.findIndex(p => p.console === current.console);
        turn += 60;
        dial.style.setProperty("--turn", `${turn}deg`);
        choose(PRESETS[(i + 1) % PRESETS.length]);
      });
    });
  });
})();
