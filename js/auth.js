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

// 한글 자판 상태로 친 글자를 영문 자판 키로 되돌림 (예: "ㅗㄱㅡ" → "HRM")
const JAMO_KEYS = ("r R rt s sw sg e E f fr fa fq ft fx fv fg a q Q qt t T d w W c z x v g " +
  "k o i O j p u P h hk ho hl y n nj np nl b m ml l").split(" ");           // U+3131 ㄱ ~ U+3163 ㅣ
const INITIAL = [0, 1, 3, 6, 7, 8, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]; // 초성 → 호환 자모
const FINAL = [null, 0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29];

function hangulToKeys(text) {
  return [...text].map(ch => {
    const c = ch.charCodeAt(0);
    if (c >= 0x3131 && c <= 0x3163) return JAMO_KEYS[c - 0x3131];
    if (c >= 0xac00 && c <= 0xd7a3) {
      const s = c - 0xac00;
      const fin = FINAL[s % 28];
      return JAMO_KEYS[INITIAL[Math.floor(s / 588)]] + JAMO_KEYS[30 + Math.floor(s / 28) % 21] +
        (fin == null ? "" : JAMO_KEYS[fin]);
    }
    return ch;
  }).join("");
}

// 붙여넣은 문장("김도훈님의 마니또 코드: AB12CD")이나 공백이 섞여도 코드만 뽑아냄
function normalizeCode(raw) {
  let text = raw.includes(":") ? raw.slice(raw.lastIndexOf(":") + 1) : raw;
  const token = text.match(/[A-Za-z0-9]{6}/);
  if (token) return token[0].toUpperCase();
  return hangulToKeys(text).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

async function initLoginPage(form) {
  const select = form.querySelector("#name");
  const codeInput = form.querySelector("#code");
  const error = form.querySelector("#login-error");
  const button = form.querySelector('button[type="submit"]');

  if (getSession()) return location.replace("me.html");

  const people = await store.getPeople();
  [...people]
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
    .forEach(p => select.add(new Option(p.name, p.id)));

  // 한글 조합 중에는 건드리지 않고, 조합이 끝나면 정리
  const tidy = () => (codeInput.value = normalizeCode(codeInput.value));
  codeInput.addEventListener("input", e => { if (!e.isComposing) tidy(); });
  codeInput.addEventListener("compositionend", tidy);

  const glitch = () => {
    form.classList.remove("is-glitch");
    void form.offsetWidth; // 애니메이션 다시 시작
    form.classList.add("is-glitch");
  };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    error.hidden = true;
    button.disabled = true;
    try {
      tidy();
      if (!select.value) throw new Error("이름을 선택해 주세요.");
      const session = await store.login(Number(select.value), codeInput.value);
      if (!session && !(await store.hasIssuedCodes())) {
        throw new Error("이 브라우저에는 발급된 코드가 없어요. 관리자 화면을 연 브라우저·주소와 같은 곳에서 열어주세요.");
      }
      if (!session) throw new Error("이름 또는 코드가 맞지 않아요.");
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      document.body.classList.add("is-leaving"); // 크림이 화면을 덮는 효과
      setTimeout(() => (location.href = "me.html"), REDUCE_MOTION ? 0 : 650);
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      glitch();
    } finally {
      button.disabled = false;
    }
  });
}

const loginForm = document.getElementById("login-form");
if (loginForm) initLoginPage(loginForm);
