// 코드 로그인 + 세션 관리 (index.html 입장 화면 포함)
const SESSION_KEY = "manito-session";

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function requireSession() {
  const s = getSession();
  if (!s) location.replace("index.html");
  return s;
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.replace("index.html");
}

async function initLoginPage(form) {
  const select = form.querySelector("#name");
  const codeInput = form.querySelector("#code");
  const error = form.querySelector("#login-error");
  const button = form.querySelector("button");

  if (getSession()) return location.replace("me.html");

  const people = await store.getPeople();
  [...people]
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
    .forEach(p => select.add(new Option(p.name, p.id)));

  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    error.hidden = true;
    button.disabled = true;
    try {
      const session = await store.login(Number(select.value), codeInput.value);
      if (!session) throw new Error("이름 또는 코드가 맞지 않아요.");
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      location.href = "me.html";
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  });
}

const loginForm = document.getElementById("login-form");
if (loginForm) initLoginPage(loginForm);
