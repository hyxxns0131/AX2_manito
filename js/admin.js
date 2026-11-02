// 관리자 — 성별 입력, 배정 실행, 코드 발급, 공개 일시 설정
const $ = sel => document.querySelector(sel);
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O, 1/I/L 제외
const CODE_LEN = 6;

let people = [];
let settings = {};
let secret = { codes: {}, assignment: {} };

const pct = r => `${Math.round(r * 100)}%`;
const hasAssignment = () => Object.keys(secret.assignment).length > 0;
const hasCodes = () => people.every(p => secret.codes[p.id]);

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

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const label = button.textContent;
  button.textContent = "복사됨!";
  setTimeout(() => (button.textContent = label), 1200);
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
      !confirm("이미 배정된 결과가 있어요.\n다시 배정하면 기존 결과와 모든 한마디가 초기화됩니다. 계속할까요?")) return;

  const mode = currentMode();
  const customPct = Number($("#custom-pct").value);
  const btn = $("#draw-btn");
  btn.disabled = true;
  btn.textContent = "배정 중…";
  try {
    const assignment = draw(people, targetFor(mode, people, customPct));
    const codes = hasCodes() ? secret.codes : makeCodes();
    await store.adminCommit({ codes, assignment, clearMessages: hasAssignment() });
    settings = { ...settings, mode, customPct, drawnAt: Date.now() };
    await store.adminSaveSettings({ mode, customPct, drawnAt: settings.drawnAt });
    secret = { codes, assignment };
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
  $("#result-time").textContent = settings.drawnAt
    ? `${new Date(settings.drawnAt).toLocaleString("ko-KR")} 배정` : "";

  renderAssignment();
}

const genderLabel = g => ({ M: "남", F: "여" })[g] ?? "";

function assignmentPairs() {
  const byId = Object.fromEntries(people.map(p => [p.id, p]));
  return people.map(p => [p, byId[secret.assignment[p.id]]]);
}

// 전체 배정 현황: 챙겨주는 사람 → 마니또
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
    btn.addEventListener("click", () => copy(`${p.name}님의 마니또 코드: ${secret.codes[p.id]}`, btn));
    li.append(name, code, btn);
    return li;
  }));
}

async function issueCodes() {
  if (hasCodes() &&
      !confirm("코드를 재발급하면 기존 코드로는 들어올 수 없고, 남긴 한마디도 초기화됩니다. 계속할까요?")) return;
  const codes = makeCodes();
  await store.adminCommit({ codes, assignment: secret.assignment, clearMessages: hasCodes() });
  secret = { ...secret, codes };
  renderCodes();
}

/* ───── 공개 일시 ───── */

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function renderReveal() {
  $("#reveal-at").value = toLocalInput(settings.revealAt);
  $("#reveal-status").textContent = settings.revealAt
    ? `${new Date(settings.revealAt).toLocaleString("ko-KR")}부터 공개`
    : "설정 안 함 — 배정 즉시 공개";
}

async function saveReveal(value) {
  settings.revealAt = value ? new Date(value).toISOString() : null;
  await store.adminSaveSettings({ revealAt: settings.revealAt });
  renderReveal();
}

/* ───── 시작 ───── */

async function openPanel() {
  [people, settings, secret] = await Promise.all([
    store.getPeople(), store.getSettings(), store.adminLoadSecret(),
  ]);
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

  $("#mode-group").addEventListener("change", renderMode);
  $("#draw-btn").addEventListener("click", runDraw);
  $("#issue-codes").addEventListener("click", issueCodes);
  $("#copy-all").addEventListener("click", e =>
    copy(people.map(p => `${p.name}: ${secret.codes[p.id]}`).join("\n"), e.currentTarget));
  $("#copy-assign").addEventListener("click", e =>
    copy(assignmentPairs().map(([g, r]) => `${g.name} → ${r?.name ?? "?"}`).join("\n"), e.currentTarget));
  $("#save-reveal").addEventListener("click", () => saveReveal($("#reveal-at").value));
  $("#clear-reveal").addEventListener("click", () => saveReveal(""));
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
    err.textContent = ex.message || "로그인에 실패했어요.";
    err.hidden = false;
  }
});
