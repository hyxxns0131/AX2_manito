// 마이페이지 — 내 프로필, 마니또 공개, 한마디, 받은 편지함
const session = requireSession();
const $ = sel => document.querySelector(sel);

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

async function initProfile() {
  const form = $("#profile-form");
  const p = (await store.getProfile(session.id)) ?? {};
  form.likes.value = p.likes ?? "";
  form.dislikes.value = p.dislikes ?? "";
  form.allergy.checked = !!p.allergy;
  bindCounter(form.likes, $("#likes-count"));
  bindCounter(form.dislikes, $("#dislikes-count"));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    await store.saveProfile(session, {
      likes: form.likes.value.trim(),
      dislikes: form.dislikes.value.trim(),
      allergy: form.allergy.checked,
    });
    flash($("#profile-saved"));
  });
}

async function initManito(people, settings) {
  const receiverId = await store.getMyReceiverId(session);
  const receiver = people.find(p => p.id === receiverId);
  const revealAt = settings.revealAt ? new Date(settings.revealAt).getTime() : null;

  if (!receiver) {
    $("#manito-status").textContent = "아직 마니또 배정 전이에요. 조금만 기다려 주세요!";
    return null;
  }
  if (revealAt && Date.now() < revealAt) {
    $("#manito-status").textContent = `${formatDate(revealAt)}에 공개돼요 🔒`;
    return null;
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

  // 재배정되면 새 마니또는 다시 뒤집어 보도록 receiverId까지 키에 포함
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

  return receiver;
}

async function initMessage(receiver) {
  const form = $("#message-form");
  bindCounter(form.message, $("#message-count"));
  if (!receiver) {
    form.message.disabled = true;
    form.querySelector("button").disabled = true;
    form.message.placeholder = "마니또가 공개되면 한마디를 남길 수 있어요.";
    return;
  }
  $("#message-to").textContent = receiver.name;
  const mine = await store.getMyMessage(session);
  if (mine?.toId === receiver.id) form.message.value = mine.text;
  form.message.dispatchEvent(new Event("input"));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    await store.saveMyMessage(session, receiver.id, form.message.value.trim());
    flash($("#message-saved"));
  });
}

async function initInbox() {
  const list = $("#inbox");
  const msgs = await store.getInbox(session.id);
  $("#inbox-empty").hidden = msgs.length > 0;
  list.replaceChildren(...msgs.map(m => {
    const li = document.createElement("li");
    li.className = "letter";
    const from = document.createElement("p");
    from.className = "letter-from";
    from.textContent = "💌 누군가로부터";
    const body = document.createElement("p");
    body.className = "letter-body";
    body.textContent = m.text;
    li.append(from, body);
    return li;
  }));
}

if (session) (async () => {
  $("#logout").addEventListener("click", logout);
  const [people, settings] = await Promise.all([store.getPeople(), store.getSettings()]);
  $("#me-name").textContent = people.find(p => p.id === session.id)?.name ?? "";
  initProfile();
  initInbox();
  initMessage(await initManito(people, settings));
})();
