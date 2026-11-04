// 장식용 모션 — 창 등장, 콘솔 버튼 눌림 (데이터와 무관)
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

  // 2) 실제 키보드를 누르면 콘솔 버튼도 눌림
  document.addEventListener("keydown", e => {
    const el = document.querySelector(`.num-btn[data-k="${CSS.escape(e.key.toLowerCase())}"]`);
    if (!el) return;
    el.classList.add("is-down");
    setTimeout(() => el.classList.remove("is-down"), 140);
  });
})();
