// 장식용 모션 — 창 등장, 키보드 그리기·눌림 (데이터와 무관)
const REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

(() => {
  // 1) 스크롤하며 창이 하나씩 떠오름
  const targets = document.querySelectorAll(".card, .final");
  if (!REDUCE_MOTION && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    }), { threshold: 0.08 });
    targets.forEach((el, i) => {
      el.classList.add("will-reveal");
      el.style.setProperty("--delay", `${(i % 3) * 90}ms`);
      io.observe(el);
    });
  }

  // 2) 핑크 키보드: 숫자 줄은 실제로 누를 수 있고, 글자 줄은 장식
  const kb = document.querySelector("[data-keyboard]");
  if (kb) {
    const make = (label, { tag = "span", cls = "", k = label, attrs = {} } = {}) => {
      const el = document.createElement(tag);
      el.className = `kb-key ${cls}`.trim();
      el.textContent = label;
      el.dataset.k = k;
      if (tag === "button") el.type = "button";
      Object.entries(attrs).forEach(([name, v]) => el.setAttribute(name, v));
      return el;
    };
    const row = (cls, keys) => {
      const r = document.createElement("div");
      r.className = `kb-row ${cls}`;
      r.append(...keys);
      return r;
    };

    const nums = [..."1234567890"].map(d => make(d, { tag: "button", attrs: { "data-key": d } }));
    const del = make("⌫", { tag: "button", cls: "kb-del", k: "backspace", attrs: { "data-del": "", "aria-label": "한 글자 지우기" } });
    const enter = make("enter ♡", { tag: "button", cls: "kb-enter", k: "enter", attrs: { type: "submit" } });
    enter.type = "submit";

    kb.append(
      row("kb-num", [...nums, del, enter]),
      row("kb-letters", [..."qwertyuiop"].map(c => make(c))),
      row("kb-letters", [..."asdfghjkl"].map(c => make(c))),
      row("kb-letters", [..."zxcvbnm"].map(c => make(c))),
      row("kb-letters", [make("", { cls: "kb-space", k: " " })]),
    );
  }

  // 3) 실제 키보드를 누르면 화면 속 키도 눌림
  document.addEventListener("keydown", e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
    const el = document.querySelector(`.kb-key[data-k="${CSS.escape(key)}"]`);
    if (!el) return;
    el.classList.add("is-down");
    setTimeout(() => el.classList.remove("is-down"), 140);
  });
})();
