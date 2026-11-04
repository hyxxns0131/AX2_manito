// 관리자 — 성별 입력, 배정 실행, 코드 발급, 마니띠 확인 시작 · 정체 공개 일시 설정
const $ = sel => document.querySelector(sel);
const CODE_CHARS = "0123456789"; // 입장 화면 폰 키패드로 누를 수 있게 숫자만
const CODE_LEN = 6;

let people = [];
let settings = {};
let secret = { codes: {}, assignment: {}, threads: {} };

const pct = r => `${Math.round(r * 100)}%`;
const hasAssignment = () => Object.keys(secret.assignment).length > 0;
const hasCodes = () => people.every(p => secret.codes[p.id]);

// 명단에서 빠진 사람의 코드·배정이 서버에 남아 있어도 화면과 저장이 깨지지 않게 걸러냄
function pruneSecret() {
  const known = new Set(people.map(p => String(p.id)));
  const keep = obj => Object.fromEntries(Object.entries(obj ?? {}).filter(([id]) => known.has(id)));
  secret = {
    codes: keep(secret.codes),
    threads: keep(secret.threads),
    assignment: Object.fromEntries(
      Object.entries(keep(secret.assignment)).filter(([, receiver]) => known.has(String(receiver)))),
  };
}

function makeCodes() {
  const used = new Set();
  const codes = {};
  for (const p of people) {
    let code;
    do {
      code = Array.from(crypto.getRandomValues(new Uint32Array(CODE_LEN)),
        n => CODE_CHARS[n % CODE_CHARS.length]).join("");
    } while (used.has(code));
    used.add(code);
    codes[p.id] = code;
  }
  return codes;
}

// 쪽지함 id: 추측할 수 없는 무작위 값
function makeThreads() {
  const threads = {};
  for (const p of people) {
    threads[p.id] = Array.from(crypto.getRandomValues(new Uint8Array(16)),
      b => b.toString(16).padStart(2, "0")).join("");
  }
  return threads;
}

// 클립보드 API가 막힌 환경(file://, 일부 브라우저)에서는 execCommand로 대체
// 그래도 실패하면 selectEl을 선택해 두어 Ctrl+C로 복사할 수 있게 함
async function copy(text, button, selectEl) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.append(ta);
    ta.select();
    try { ok = document.execCommand("copy"); } catch {}
    ta.remove();
  }
  if (!ok && selectEl) getSelection().selectAllChildren(selectEl);

  clearTimeout(button._t);
  button.dataset.label ??= button.textContent;
  button.textContent = ok ? "복사됨!" : "Ctrl+C로 복사";
  button._t = setTimeout(() => (button.textContent = button.dataset.label), 1500);
}

/* ───── 성별 ───── */

function renderGender() {
  const list = $("#gender-list");
  list.replaceChildren(...people.map(p => {
    const row = document.createElement("li");
    row.className = "gender-row";
    row.innerHTML = `
      <span class="gender-no">${p.id}</span>
      <span class="gender-name"></span>
      <span class="segmented" role="radiogroup">
        <label><input type="radio" name="g-${p.id}" value="M"><span>남</span></label>
        <label><input type="radio" name="g-${p.id}" value="F"><span>여</span></label>
      </span>`;
    row.querySelector(".gender-name").textContent = p.name;
    row.querySelector(".segmented").setAttribute("aria-label", `${p.name} 성별`);
    const checked = row.querySelector(`input[value="${p.gender}"]`);
    if (checked) checked.checked = true;
    row.addEventListener("change", async e => {
      p.gender = e.target.value;
      renderStats();
      await store.adminSavePeople(people);
    });
    return row;
  }));
  renderStats();
}

function renderStats() {
  const m = people.filter(p => p.gender === "M").length;
  const f = people.filter(p => p.gender === "F").length;
  const missing = people.length - m - f;
  $("#gender-stats").textContent = `남 ${m} · 여 ${f} · 미입력 ${missing}`;
  $("#gender-notice").hidden = missing === 0;
  $("#gender-notice").textContent = `성별이 비어 있는 사람이 ${missing}명 있어요. 모두 입력해야 배정할 수 있어요.`;
  $("#draw-btn").disabled = missing > 0;
  if (!missing) $("#balanced-hint").textContent = `(현재 구성 기준 약 ${pct(expectedCross(people))})`;
}

/* ───── 모드 & 배정 ───── */

function currentMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function renderMode() {
  $("#custom-wrap").hidden = currentMode() !== "custom";
}

async function runDraw() {
  if (hasAssignment() &&
      !confirm("이미 배정된 결과가 있어요.\n다시 배정하면 기존 결과와 모든 쪽지가 초기화됩니다. 계속할까요?")) return;

  const mode = currentMode();
  const customPct = Number($("#custom-pct").value);
  const btn = $("#draw-btn");
  btn.disabled = true;
  btn.textContent = "배정 중…";
  try {
    const assignment = draw(people, targetFor(mode, people, customPct));
    const codes = hasCodes() ? secret.codes : makeCodes();
    const threads = makeThreads();
    await store.adminCommit({ codes, assignment, threads, resetChats: true });
    settings = { ...settings, mode, customPct, drawnAt: Date.now() };
    await store.adminSaveSettings({ mode, customPct, drawnAt: settings.drawnAt });
    secret = { codes, assignment, threads };
    renderResult();
    renderCodes();
  } catch (err) {
    alert(`배정에 실패했어요: ${err.message}`);
  } finally {
    btn.textContent = "배정 실행";
    renderStats();
  }
}

function renderResult() {
  const box = $("#draw-result");
  if (!hasAssignment()) { box.hidden = true; return; }
  const v = verify(secret.assignment, people);
  const target = targetFor(settings.mode, people, settings.customPct);
  const ok = v.self === 0 && v.mutual === 0 && v.oneToOne;
  box.hidden = false;
  box.className = `result ${ok ? "is-ok" : "is-bad"}`;
  $("#result-summary").innerHTML = `
    <li><span>전원 1:1</span><b>${v.oneToOne ? "✅" : "❌"}</b></li>
    <li><span>본인 배정</span><b>${v.self}건</b></li>
    <li><span>쌍방 배정</span><b>${v.mutual}건</b></li>
    <li><span>이성 매칭</span><b>${pct(v.cross)} <small>(목표 ${pct(target)})</small></b></li>`;
  $("#result-time").textContent = !v.oneToOne
    ? "명단이 바뀌어 배정이 맞지 않아요. 배정을 다시 실행해 주세요."
    : settings.drawnAt ? `${new Date(settings.drawnAt).toLocaleString("ko-KR")} 배정` : "";

  renderAssignment();
}

const genderLabel = g => ({ M: "남", F: "여" })[g] ?? "";

function assignmentPairs() {
  const byId = Object.fromEntries(people.map(p => [p.id, p]));
  return people.map(p => [p, byId[secret.assignment[p.id]]]);
}

// 전체 배정 현황: 마니또(챙겨주는 사람) → 마니띠(챙김 받는 사람)
function renderAssignment() {
  const ready = hasAssignment();
  $("#assign-empty").hidden = ready;
  $("#copy-assign").hidden = !ready;
  if (!ready) { $("#assignment-list").replaceChildren(); return; }

  $("#assignment-list").replaceChildren(...assignmentPairs().map(([giver, receiver]) => {
    const li = document.createElement("li");
    li.className = "assign-row";
    const from = document.createElement("span");
    from.className = "assign-name";
    from.textContent = giver.name;
    const g1 = document.createElement("small");
    g1.textContent = genderLabel(giver.gender);
    from.append(" ", g1);
    const arrow = document.createElement("span");
    arrow.className = "assign-arrow";
    arrow.textContent = "→";
    const to = document.createElement("span");
    to.className = "assign-name assign-to";
    to.textContent = receiver?.name ?? "?";
    const g2 = document.createElement("small");
    g2.textContent = genderLabel(receiver?.gender);
    to.append(" ", g2);
    li.append(from, arrow, to);
    return li;
  }));
}

/* ───── 코드 ───── */

function renderCodes() {
  const list = $("#codes-list");
  const ready = hasCodes();
  $("#codes-empty").hidden = ready;
  $("#copy-all").hidden = !ready;
  $("#issue-codes").textContent = ready ? "코드 재발급" : "코드 발급";
  if (!ready) { list.replaceChildren(); return; }

  list.replaceChildren(...people.map(p => {
    const li = document.createElement("li");
    li.className = "code-row";
    const name = document.createElement("span");
    name.textContent = p.name;
    const code = document.createElement("code");
    code.textContent = secret.codes[p.id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost btn-sm";
    btn.textContent = "복사";
    btn.addEventListener("click", () => copy(secret.codes[p.id], btn, code));
    li.append(name, code, btn);
    return li;
  }));
}

async function issueCodes() {
  if (hasCodes() &&
      !confirm("코드를 재발급하면 기존 코드로는 들어올 수 없어요. (쪽지는 유지돼요) 계속할까요?")) return;
  const codes = makeCodes();
  try {
    await store.adminCommit({ codes, assignment: secret.assignment, threads: secret.threads });
    secret = { ...secret, codes };
    renderCodes();
  } catch (err) {
    alert(`코드 발급에 실패했어요: ${err.message}`);
  }
}

/* ───── 마니띠 확인 시작 ───── */

const fmt = t => new Date(t).toLocaleString("ko-KR");

function toLocalInput(t) {
  if (t == null) return "";
  const d = new Date(t);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function renderReveal() {
  $("#reveal-at").value = toLocalInput(settings.revealAt);
  $("#reveal-status").textContent = settings.revealAt
    ? `${fmt(settings.revealAt)}부터 참가자가 자기 마니띠를 볼 수 있어요`
    : "설정 안 함 — 배정 즉시 볼 수 있어요";
}

async function saveReveal(value) {
  settings.revealAt = value ? new Date(value).toISOString() : null;
  await store.adminSaveSettings({ revealAt: settings.revealAt });
  renderReveal();
}

/* ───── 정체 공개 ───── */

function renderFinal() {
  const at = settings.finalRevealAt;
  const done = store.isFinalRevealed(settings);
  $("#final-at").value = done ? "" : toLocalInput(at);
  $("#final-status").textContent =
    at == null ? "아직 공개 안 함" :
    done ? `🎉 ${fmt(at)}에 공개됐어요` :
    `⏰ ${fmt(at)}에 공개 예약됨`;
  $("#final-status").classList.toggle("is-done", done);
  $("#final-now").disabled = done;
  $("#final-cancel").hidden = at == null;
}

async function saveFinal(ms, message) {
  if (message && !confirm(message)) return;
  settings.finalRevealAt = ms;
  await store.adminSaveSettings({ finalRevealAt: ms });
  renderFinal();
}

/* ───── 시작 ───── */

function bindPanel() {
  $("#mode-group").addEventListener("change", renderMode);
  $("#draw-btn").addEventListener("click", runDraw);
  $("#issue-codes").addEventListener("click", issueCodes);
  $("#copy-all").addEventListener("click", e =>
    copy(people.map(p => `${p.name}: ${secret.codes[p.id]}`).join("\n"), e.currentTarget));
  $("#copy-assign").addEventListener("click", e =>
    copy("마니또 → 마니띠\n" + assignmentPairs().map(([g, r]) => `${g.name} → ${r?.name ?? "?"}`).join("\n"), e.currentTarget));
  $("#save-reveal").addEventListener("click", () => saveReveal($("#reveal-at").value));
  $("#clear-reveal").addEventListener("click", () => saveReveal(""));
  $("#save-final").addEventListener("click", () => {
    const v = $("#final-at").value;
    if (!v) return alert("공개할 날짜와 시간을 골라주세요.");
    saveFinal(new Date(v).getTime());
  });
  $("#final-now").addEventListener("click", () =>
    saveFinal(Date.now(), "지금 바로 모든 참가자에게 누가 누구의 마니또였는지 공개할까요?"));
  $("#final-cancel").addEventListener("click", () =>
    saveFinal(null, "정체 공개를 취소할까요? (공개 예약도 지워져요)"));
}

async function openPanel() {
  [people, settings, secret] = await Promise.all([
    store.getPeople(), store.getSettings(), store.adminLoadSecret(),
  ]);
  pruneSecret();
  bindPanel();
  $("#admin-login").hidden = true;
  $("#admin-panel").hidden = false;

  const modeInput = document.querySelector(`input[name="mode"][value="${settings.mode}"]`);
  if (modeInput) modeInput.checked = true;
  $("#custom-pct").value = settings.customPct ?? 50;

  renderGender();
  renderMode();
  renderResult();
  renderCodes();
  renderReveal();
  renderFinal();

  // 쪽지 기능 이전에 배정된 데이터면 쪽지함만 새로 만듦
  if (hasAssignment() && !Object.keys(secret.threads ?? {}).length && hasCodes()) {
    secret.threads = makeThreads();
    await store.adminCommit({ ...secret, resetChats: true });
  }
}

const loginForm = $("#admin-login");
if (store.STORE !== "firebase") loginForm.email.closest(".field").hidden = true;
else loginForm.email.required = true;

loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#admin-error");
  err.hidden = true;
  try {
    await store.adminLogin({ email: loginForm.email.value, password: loginForm.password.value });
    await openPanel();
  } catch (ex) {
    if (!$("#admin-panel").hidden) return alert(`관리자 화면 오류: ${ex.message}`);
    err.textContent = ex.message || "로그인에 실패했어요.";
    err.hidden = false;
  }
});
