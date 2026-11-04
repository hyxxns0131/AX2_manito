// 생동감 효과 — 텍스트 스크램블, 컨페티, 가챠 머신, 흐르는 띠 (motion.js 다음에 로드)
const SCRAMBLE_CHARS = "마니또띠비밀선물쪽지힌트?!★♥#%";

function scrambleText(el, text, ms = 700) {
  cancelAnimationFrame(el._scramble);
  if (REDUCE_MOTION) { el.textContent = text; return; }
  const chars = [...text];
  const start = performance.now();
  const tick = now => {
    const done = Math.floor(chars.length * Math.min(1, (now - start) / ms));
    if (done >= chars.length) { el.textContent = text; return; }
    el.textContent = chars.map((c, i) => (i < done || c === " " ? c
      : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)])).join("");
    el._scramble = requestAnimationFrame(tick);
  };
  el._scramble = requestAnimationFrame(tick);
}

// Memphis 도형이 터지는 컨페티. host 가운데에서 퍼짐
function burstConfetti(host, count = 26) {
  if (REDUCE_MOTION) return;
  const colors = ["#ff4fa0", "#ffd84d", "#3fb7c4", "#a892e6", "#2d2340"];
  const shapes = ["dot", "tri", "bar", "ring"];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("i");
    const angle = Math.random() * Math.PI * 2;
    const dist = 110 + Math.random() * 170;
    el.className = `confetti confetti-${shapes[i % shapes.length]}`;
    el.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    el.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    el.style.setProperty("--spin", `${Math.random() * 720 - 360}deg`);
    el.style.setProperty("--c", colors[i % colors.length]);
    el.addEventListener("animationend", () => el.remove());
    host.append(el);
  }
}

const GACHA_BALLS = [
  [12, 58, "pink"], [38, 66, "mint"], [64, 60, "lilac"], [24, 30, "lemon"],
  [50, 34, "pink"], [72, 26, "mint"], [6, 8, "lilac"], [40, 4, "lemon"],
];

function buildGacha(host) {
  const clickable = host.dataset.gacha !== "deco";
  const knob = clickable
    ? '<button class="gacha-knob" type="button" aria-label="가챠 돌리기"><i></i></button>'
    : '<span class="gacha-knob"><i></i></span>';
  const balls = GACHA_BALLS.map(([x, y, color], i) =>
    `<i class="gacha-ball ball-${color}" style="left:${x}%;top:${y}%;--i:${i}"></i>`).join("");

  host.classList.add("gacha-wrap");
  host.innerHTML = `
    <span class="gacha-blob" aria-hidden="true"></span>
    <svg class="gacha-lines" viewBox="0 0 300 340" aria-hidden="true">
      <path pathLength="1" d="M34 80l8 22 22 8-22 8-8 22-8-22-22-8 22-8z"/>
      <path pathLength="1" d="M262 54c-14-20-44-4-28 24l28 28 28-28c16-28-14-44-28-24z"/>
      <path pathLength="1" d="M10 250c16-22 30 22 46 0s30 22 46 0"/>
      <path pathLength="1" d="M214 292c16-22 30 22 46 0s30 22 36 6"/>
    </svg>
    <div class="gacha">
      <div class="gacha-roof"><span>MANITO</span></div>
      <div class="gacha-dome" aria-hidden="true">${balls}<span class="gacha-glare"></span></div>
      <div class="gacha-body">
        ${knob}
        <span class="gacha-door" aria-hidden="true"><i class="gacha-out"></i></span>
        <span class="gacha-sticker" aria-hidden="true">♥</span>
      </div>
      <div class="gacha-base" aria-hidden="true"></div>
    </div>`;

  let running = false;
  async function play() {
    if (running) return;
    running = true;
    const wait = ms => new Promise(r => setTimeout(r, REDUCE_MOTION ? 0 : ms));
    host.classList.add("is-turning");
    await wait(620);
    host.classList.add("is-dropping");
    await wait(520);
    burstConfetti(host.querySelector(".gacha-door"), 14);
    await wait(620);
    host.classList.remove("is-turning", "is-dropping");
    running = false;
  }
  host.querySelector("button.gacha-knob")?.addEventListener("click", play);
  host._play = play;
}

// 화면에 보이는 가챠 머신을 돌림 (폰에서 숨겨져 있으면 바로 끝남)
async function playGacha() {
  const host = [...document.querySelectorAll(".gacha-wrap")].find(el => el.offsetParent);
  if (host) await host._play();
}

(() => {
  document.querySelectorAll("[data-gacha]").forEach(buildGacha);

  // 흐르는 띠: 같은 내용을 두 번 넣어 끊김 없이 반복
  document.querySelectorAll("[data-ticker]").forEach(el => {
    const text = `${el.dataset.ticker} ✿ `.repeat(6);
    const track = document.createElement("div");
    track.className = "ticker-track";
    track.innerHTML = "<span></span><span></span>";
    track.querySelectorAll("span").forEach(s => (s.textContent = text));
    el.append(track);
  });

  // 글자를 하나씩 나눠 튀어 오르게
  document.querySelectorAll("[data-kinetic]").forEach(el => {
    const node = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (!node) return;
    el.setAttribute("aria-label", el.textContent.trim());
    const frag = document.createDocumentFragment();
    [...node.textContent.trim()].forEach((c, i) => {
      const span = document.createElement("span");
      span.className = "k-char";
      span.setAttribute("aria-hidden", "true");
      span.style.setProperty("--i", i);
      span.textContent = c === " " ? " " : c;
      frag.append(span);
    });
    node.replaceWith(frag);
  });

  document.querySelectorAll("[data-scramble]").forEach(el => {
    const text = el.textContent;
    setTimeout(() => scrambleText(el, text, 900), 1100);
  });
})();
