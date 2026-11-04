// 마이페이지 — 내 프로필·힌트, 마니띠 확인, 힌트 뽑기, 익명 쪽지, 정체 공개
// 마니또 = 나를 챙겨주는 사람, 마니띠 = 내가 챙겨주는 사람
const session = requireSession();
const $ = sel => document.querySelector(sel);
const POLL_MS = store.STORE === "local" ? 2000 : 5000;

function chips(text) {
  const frag = document.createDocumentFragment();
  (text || "").split(",").map(s => s.trim()).filter(Boolean).forEach(t => {
    const li = document.createElement("li");
    li.className = "chip";
    li.textContent = t;
    frag.append(li);
  });
  return frag;
}

function flash(el) {
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.hidden = true), 2000);
}

function bindCounter(input, counter) {
  const update = () => (counter.textContent = `${input.value.length} / ${input.maxLength}`);
  input.addEventListener("input", update);
  update();
}

function formatDate(ts) {
  return new Date(ts).toLocaleString("ko-KR", {
    month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit",
  });
}

function formatTime(ts) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString("ko-KR", sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function initProfile() {
  const form = $("#profile-form");
  const p = (await store.getProfile(session.id)) ?? {};
  form.likes.value = p.likes ?? "";
  form.dislikes.value = p.dislikes ?? "";
  form.allergy.checked = !!p.allergy;
  bindCounter(form.likes, $("#likes-count"));
  bindCounter(form.dislikes, $("#dislikes-count"));

  // 불러오지 못했을 때 저장하면 빈칸으로 덮어쓰므로 입력을 막음
  const hintFields = $("#hints-fields");
  const hintInputs = [...hintFields.querySelectorAll("input")];
  try {
    (await store.getOwnHints(session)).forEach((h, i) => (hintInputs[i].value = h));
  } catch {
    hintFields.disabled = true;
  }
  hintInputs.forEach((input, i) => bindCounter(input, $(`#hint${i + 1}-count`)));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const error = $("#profile-error");
    error.hidden = true;
    try {
      await store.saveProfile(session, {
        likes: form.likes.value.trim(),
        dislikes: form.dislikes.value.trim(),
        allergy: form.allergy.checked,
      });
      if (!hintFields.disabled) await store.saveHints(session, hintInputs.map(i => i.value.trim()));
      flash($("#profile-saved"));
    } catch (err) {
      error.textContent = `저장하지 못했어요: ${err.message}`;
      error.hidden = false;
    }
  });
}

// 반환: { receiver, lockedUntil } — receiver가 null이면 아직 볼 수 없음
async function initManito(people, settings, receiverId) {
  const receiver = people.find(p => p.id === receiverId);
  const revealAt = settings.revealAt ? new Date(settings.revealAt).getTime() : null;

  // supabase 모드는 확인 시작 전에 receiverId 자체를 안 내려주므로 잠금부터 확인
  if (revealAt && Date.now() < revealAt) {
    $("#manito-status").textContent = `${formatDate(revealAt)}에 공개돼요 🔒`;
    return { receiver: null, lockedUntil: revealAt };
  }
  if (!receiver) {
    $("#manito-status").textContent = "아직 배정 전이에요. 조금만 기다려 주세요!";
    return { receiver: null, lockedUntil: null };
  }

  $("#manito-status").hidden = true;
  $("#reveal").hidden = false;
  $("#manito-name").textContent = receiver.name;

  const card = $("#flip-card");
  const showProfile = async () => {
    const prof = (await store.getProfile(receiver.id)) ?? {};
    $("#their-name").textContent = receiver.name;
    $("#their-likes").replaceChildren(chips(prof.likes));
    $("#their-dislikes").replaceChildren(chips(prof.dislikes));
    $("#their-allergy").hidden = !prof.allergy;
    $("#their-empty").hidden = !!(prof.likes || prof.dislikes);
    $("#their-profile").hidden = false;
  };

  // 재배정되면 새 마니띠는 다시 뒤집어 보도록 receiverId까지 키에 포함
  const openedKey = `manito-opened-${session.id}-${receiverId}`;
  const open = () => {
    card.classList.add("is-open");
    card.setAttribute("aria-pressed", "true");
    try { localStorage.setItem(openedKey, "1"); } catch {}
    showProfile();
  };

  let opened = false;
  try { opened = localStorage.getItem(openedKey) === "1"; } catch {}
  if (opened) open();
  else card.addEventListener("click", open, { once: true });

  return { receiver, lockedUntil: null };
}

/* ───── 익명 쪽지 ───── */

// role: 이 화면에서 나의 역할 ("giver" = 내가 챙겨주는 쪽, "receiver" = 챙김 받는 쪽)
function createChat(root, role) {
  const log = root.querySelector(".chat-log");
  const form = root.querySelector(".chat-form");
  const empty = root.querySelector(".chat-empty");
  let threadId = null;
  let count = -1;

  function render(items) {
    if (items.length === count) return;
    if (count >= 0 && items.at(-1)?.from !== role) {   // 상대 쪽지 도착 → 통통
      root.classList.remove("is-ping");
      void root.offsetWidth;
      root.classList.add("is-ping");
    }
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    count = items.length;
    empty.hidden = items.length > 0;
    log.replaceChildren(...items.map(m => {
      const li = document.createElement("li");
      li.className = `bubble ${m.from === role ? "is-mine" : "is-theirs"}`;
      const text = document.createElement("p");
      text.textContent = m.text;
      const time = document.createElement("time");
      time.textContent = formatTime(m.at);
      li.append(text, time);
      return li;
    }));
    if (nearBottom || items.at(-1)?.from === role) log.scrollTop = log.scrollHeight;
  }

  async function refresh() {
    if (threadId) render(await store.getChat(session, threadId));
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const text = form.text.value.trim();
    if (!text || !threadId) return;
    form.text.value = "";
    await store.sendChat(session, threadId, role, text);
    await refresh();
    form.text.focus();
  });

  return {
    refresh,
    open(id) {
      threadId = id;
      root.classList.remove("is-locked");
      form.text.disabled = false;
      form.querySelector("button").disabled = false;
      return refresh();
    },
    lock(message) {
      root.classList.add("is-locked");
      form.text.disabled = true;
      form.querySelector("button").disabled = true;
      empty.textContent = message;
      empty.hidden = false;
    },
    setTitle(text) { root.querySelector(".chat-title-name").textContent = text; },
  };
}

/* ───── 정체 공개 ───── */

function renderFinal(people, assignment) {
  const section = $("#final");
  if (!assignment) { section.hidden = true; return null; }
  const byId = Object.fromEntries(people.map(p => [p.id, p]));
  const giverId = Object.keys(assignment).find(g => assignment[g] === session.id);
  const myGiver = byId[giverId];

  $("#final-giver").textContent = myGiver?.name ?? "?";
  $("#final-list").replaceChildren(...people.map(p => {
    const li = document.createElement("li");
    li.className = "assign-row";
    if (p.id === session.id || assignment[p.id] === session.id) li.classList.add("is-me");
    const from = document.createElement("span");
    from.className = "assign-name";
    from.textContent = p.name;
    const arrow = document.createElement("span");
    arrow.className = "assign-arrow";
    arrow.textContent = "→";
    const to = document.createElement("span");
    to.className = "assign-name assign-to";
    to.textContent = byId[assignment[p.id]]?.name ?? "?";
    li.append(from, arrow, to);
    return li;
  }));
  section.hidden = false;
  return myGiver;
}

/* ───── 시작 ───── */

if (session) (async () => {
  $("#logout").addEventListener("click", logout);
  const [people, settings, mine] = await Promise.all([
    store.getPeople(), store.getSettings(), store.getMyAssignment(session),
  ]);
  $("#me-name").textContent = people.find(p => p.id === session.id)?.name ?? "";
  initProfile();

  const { receiver, lockedUntil } = await initManito(people, settings, mine.receiverId);
  const toManitti = createChat($("#chat-giver"), "giver");   // 내가 마니또 → 마니띠에게 익명
  const toManito = createChat($("#chat-receiver"), "receiver"); // 익명의 내 마니또와
  const clawGame = createClawGame($("#hint-game"), session);

  if (receiver) {
    await clawGame.open(receiver.name);
    toManitti.setTitle(receiver.name);
    await toManitti.open(mine.threadId);
    const inThread = await store.findThreadFor(session);
    if (inThread) await toManito.open(inThread);
    else toManito.lock("쪽지함이 아직 준비되지 않았어요.");
  } else {
    const msg = lockedUntil
      ? `${formatDate(lockedUntil)}부터 쪽지를 주고받을 수 있어요 🔒`
      : "배정 후에 쪽지를 주고받을 수 있어요.";
    toManitti.lock(msg);
    toManito.lock(msg);
    clawGame.lock(lockedUntil
      ? `${formatDate(lockedUntil)}부터 뽑을 수 있어요 🔒`
      : "배정 후에 뽑을 수 있어요.");
  }

  let revealed = false;
  async function checkFinal() {
    const giver = renderFinal(people, await store.getFinalReveal());
    revealed = !!giver;
    toManito.setTitle(giver ? giver.name : "???");
  }
  await checkFinal();

  // 새 쪽지·공개 시각·재배정을 주기적으로 확인
  setInterval(async () => {
    if (lockedUntil && Date.now() >= lockedUntil) return location.reload();
    const s = await store.getSettings();
    if (s.drawnAt !== settings.drawnAt) return location.reload();
    if (store.isFinalRevealed(s) !== revealed) await checkFinal();
    toManitti.refresh();
    toManito.refresh();
    clawGame.refresh();
  }, POLL_MS);
})();
