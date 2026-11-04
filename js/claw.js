// 힌트 뽑기 — 마니띠가 클로 머신을 조종해 자기 마니또가 쓴 정체 힌트를 뽑음
// 마카롱을 집으면 어떤 힌트가 나올지는 서버가 무작위로 정함 (마카롱 위치·색은 장식)
const CLAW_HOME = 50;      // 아래 값은 모두 유리창 너비 기준 %
const CLAW_MIN = 14;
const CLAW_MAX = 90;
const CHUTE_X = 11;
const CATCH_RANGE = 9;
const CLAW_SPEED = 45;     // 초당 %
const CLAW_STEP = 6;       // 키보드로 한 번 움직이는 거리
const CAPSULE_COLORS = ["pink", "mint", "lilac"];

function createClawGame(root, session) {
  const $in = sel => root.querySelector(sel);
  const status = $in("#hint-status");
  const play = $in("#hint-play");
  const glass = $in(".machine-glass");
  const claw = $in(".claw");
  const grip = $in(".claw-grip");
  const marquee = $in(".machine-marquee");
  const stick = $in(".machine-stick");
  const goBtn = $in("#claw-go");
  const moveBtns = [$in("#claw-left"), $in("#claw-right")];
  const message = $in("#claw-message");
  const list = $in("#hint-list");
  const listEmpty = $in("#hint-list-empty");
  const dialog = $in("#hint-dialog");
  const face = $in("#claw-face");

  let game = { total: 0, drawn: [] };
  let x = CLAW_HOME;
  let busy = false;
  let ready = false;

  const wait = ms => new Promise(r => setTimeout(r, REDUCE_MOTION ? 0 : ms));
  const remaining = () => Math.max(0, game.total - game.drawn.length);
  const capsules = () => [...glass.querySelectorAll(":scope > .capsule")];

  function setX(value, ms = 0) {
    x = Math.min(CLAW_MAX, Math.max(CHUTE_X, value));
    claw.style.transitionDuration = `${REDUCE_MOTION ? 0 : ms}ms`;
    claw.style.left = `${x}%`;
  }

  function setCable(px, ms) {
    claw.style.setProperty("--cable-ms", `${REDUCE_MOTION ? 0 : ms}ms`);
    claw.style.setProperty("--cable", `${px}px`);
  }

  function setBusy(value) {
    busy = value;
    moveBtns.forEach(b => (b.disabled = value || !remaining()));
    goBtn.disabled = value || !remaining();
  }

  function fillCapsules() {
    const want = remaining();
    const have = capsules();
    have.slice(want).forEach(c => c.remove());
    for (let i = have.length; i < want; i++) {
      const c = document.createElement("span");
      c.className = `capsule capsule-${CAPSULE_COLORS[i % CAPSULE_COLORS.length]}`;
      // 칸을 나눠 겹치지 않게 놓고, 칸 안에서만 무작위
      c.dataset.x = String(28 + i * 26 + Math.random() * 8);
      c.style.left = `${c.dataset.x}%`;
      glass.append(c);
    }
  }

  function render() {
    const left = remaining();
    marquee.textContent = game.total ? `남은 마카롱 ${left}개` : "SWEET CATCHER";
    status.hidden = false;
    status.textContent =
      !game.total ? "내 마니또가 아직 힌트를 쓰지 않았어요. 쓰면 마카롱이 들어와요!" :
      !left ? "힌트를 전부 뽑았어요! 내 마니또는 누구일까요? 🎉" :
      "◀ ▶ 로 집게를 마카롱 위에 맞추고 빨간 버튼을 눌러요.";
    fillCapsules();
    setBusy(busy);

    listEmpty.hidden = game.drawn.length > 0;
    list.replaceChildren(...game.drawn.map(text => {
      const li = document.createElement("li");
      li.className = "hint-item";
      li.textContent = text;
      return li;
    }));
  }

  async function load() {
    game = await store.getHintGame(session);
    render();
  }

  function react(mood) {
    face.src = `assets/img/ichigo-${mood}.jpg`;
    face.classList.remove("is-react");
    void face.offsetWidth;
    face.classList.add("is-react");
  }

  function say(text) {
    message.textContent = text;
  }

  function showHint(text) {
    const out = $in("#hint-dialog-text");
    out.textContent = "";
    dialog.showModal();
    burstConfetti(dialog);
    setTimeout(() => scrambleText(out, text, 900), REDUCE_MOTION ? 0 : 700);
  }

  async function grab() {
    if (busy || !remaining()) return;
    setBusy(true);
    say("");
    react("smile");
    const reach = glass.clientHeight - 118;   // 집게 끝이 마카롱에 닿는 길이

    setCable(reach, 900);
    await wait(950);
    claw.classList.add("is-closed");
    await wait(280);

    const target = capsules()
      .map(el => ({ el, gap: Math.abs(Number(el.dataset.x) - x) }))
      .sort((a, b) => a.gap - b.gap)[0];
    const hit = target && target.gap <= CATCH_RANGE ? target.el : null;
    if (hit) {
      hit.classList.add("is-held");
      hit.style.left = "";
      grip.append(hit);
    }
    const drawing = hit ? store.drawHint(session) : null;
    drawing?.catch(() => {});                 // 실패는 아래 await에서 처리

    setCable(24, 900);
    await wait(950);

    if (!hit) {
      claw.classList.remove("is-closed");
      react("shock");
      say("아깝다! 마카롱 바로 위에서 다시 해봐요.");
      setBusy(false);
      return;
    }

    setX(CHUTE_X, 800);
    await wait(850);
    claw.classList.remove("is-closed");
    hit.classList.add("is-falling");
    await wait(520);
    hit.remove();

    try {
      const result = await drawing;
      if (result) {
        game.drawn = [...game.drawn, result.text];
        react("laugh");
        await playGacha();
        showHint(result.text);
      } else {
        say("남은 힌트가 없어요.");
      }
      await load();
    } catch (err) {
      say(`뽑기에 실패했어요: ${err.message}`);
      await load().catch(() => {});
    }

    setX(CLAW_HOME, 700);
    await wait(720);
    setBusy(false);
    render();
  }

  // ◀ ▶ 버튼을 누르고 있는 동안 이동
  function bindMove(button, dir) {
    let frame = 0;
    let last = 0;
    const step = now => {
      setX(Math.max(CLAW_MIN, x + dir * CLAW_SPEED * (now - last) / 1000));
      last = now;
      frame = requestAnimationFrame(step);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      stick.classList.remove("is-left", "is-right");
    };
    button.addEventListener("pointerdown", e => {
      if (busy) return;
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      stick.classList.add(dir < 0 ? "is-left" : "is-right");
      last = performance.now();
      frame = requestAnimationFrame(step);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(t => button.addEventListener(t, stop));
    button.addEventListener("click", e => {   // 키보드로 누른 경우만 (detail 0)
      if (e.detail === 0 && !busy) setX(Math.max(CLAW_MIN, x + dir * CLAW_STEP));
    });
  }

  bindMove(moveBtns[0], -1);
  bindMove(moveBtns[1], 1);
  goBtn.addEventListener("click", grab);
  $in("#hint-dialog-close").addEventListener("click", () => dialog.close());
  $in(".machine").addEventListener("keydown", e => {
    if (busy || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    setX(Math.max(CLAW_MIN, x + (e.key === "ArrowLeft" ? -CLAW_STEP : CLAW_STEP)));
  });

  return {
    async open() {
      try {
        await load();
        setX(CLAW_HOME);
        setCable(24, 0);
        play.hidden = false;
        ready = true;
      } catch {
        status.textContent = "힌트 뽑기를 준비 중이에요. 잠시 후 다시 와주세요!";
      }
    },
    lock(text) {
      status.textContent = text;
    },
    // 마니또가 힌트를 새로 쓰면 마카롱이 들어옴
    async refresh() {
      if (!ready || busy || dialog.open) return;
      const next = await store.getHintGame(session).catch(() => null);
      if (!next || (next.total === game.total && next.drawn.length === game.drawn.length)) return;
      game = next;
      render();
    },
  };
}
