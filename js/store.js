// 데이터 저장소 — STORE 값으로 Firebase(Firestore) / localStorage 전환
// participants.js 다음에 로드하세요. 전역 `store` 객체로 사용합니다.
const store = (() => {
  const STORE = "local"; // "firebase" | "local"

  // Firebase 사용 시 콘솔의 웹 앱 설정값을 입력하세요
  const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    appId: "",
  };

  // local 모드 전용 관리자 비밀번호 (firebase 모드는 Firebase Auth 이메일 로그인 사용)
  const LOCAL_ADMIN_PASSWORD = "ax2manitomato";

  const DEFAULT_SETTINGS = { mode: "balanced", customPct: 50, revealAt: null, drawnAt: null };

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // 로그인 키: 이름 id + 개인 코드의 해시. 배정 문서의 id로 쓰이므로 코드를 모르면 찾을 수 없음
  const loginKey = (id, code) => sha256(`${id}:${code.trim().toUpperCase()}`);
  const messageId = key => sha256(`msg:${key}`);

  /* ───────────── localStorage ───────────── */

  const LS_KEY = "manito-db";

  function lsLoad() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(LS_KEY)); } catch {}
    return {
      people: PARTICIPANTS.map(p => ({ ...p })),
      settings: { ...DEFAULT_SETTINGS },
      keys: {},      // { loginKey: { id, receiverId } }
      profiles: {},  // { id: { likes, dislikes, allergy, updatedAt } }
      messages: {},  // { messageId: { toId, text, updatedAt } }
      secret: { codes: {}, assignment: {} },
      ...db,
    };
  }

  function lsSave(db) {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  }

  const local = {
    async getPeople() { return lsLoad().people; },
    async getSettings() { return lsLoad().settings; },

    async findKey(key) { return lsLoad().keys[key] ?? null; },

    async getProfile(id) { return lsLoad().profiles[id] ?? null; },
    async saveProfile(id, data) {
      const db = lsLoad();
      db.profiles[id] = { ...data, updatedAt: Date.now() };
      lsSave(db);
    },

    async getMessage(msgId) { return lsLoad().messages[msgId] ?? null; },
    async saveMessage(msgId, data) {
      const db = lsLoad();
      db.messages[msgId] = { ...data, updatedAt: Date.now() };
      lsSave(db);
    },
    async getInbox(id) {
      return Object.values(lsLoad().messages).filter(m => m.toId === id);
    },

    async adminLogin({ password }) {
      if (password !== LOCAL_ADMIN_PASSWORD) throw new Error("비밀번호가 올바르지 않습니다.");
    },
    async adminLoadSecret() { return lsLoad().secret; },
    async adminSavePeople(people) {
      const db = lsLoad();
      db.people = people;
      lsSave(db);
    },
    async adminSaveSettings(patch) {
      const db = lsLoad();
      db.settings = { ...db.settings, ...patch };
      lsSave(db);
    },
    async adminCommit({ codes, assignment, keys, clearMessages }) {
      const db = lsLoad();
      db.keys = keys;
      db.secret = { codes, assignment };
      if (clearMessages) db.messages = {};
      lsSave(db);
    },
  };

  /* ───────────── Firebase (Firestore) ───────────── */

  const FB_VER = "10.12.2";
  let fbReady = null;

  function fb() {
    fbReady ??= (async () => {
      const [{ initializeApp }, fs, auth] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore.js`),
        import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`),
      ]);
      const app = initializeApp(firebaseConfig);
      return { fs, db: fs.getFirestore(app), auth, authInst: auth.getAuth(app) };
    })();
    return fbReady;
  }

  async function fbGet(path) {
    const { fs, db } = await fb();
    const snap = await fs.getDoc(fs.doc(db, path));
    return snap.exists() ? snap.data() : null;
  }

  async function fbSet(path, data, merge = false) {
    const { fs, db } = await fb();
    await fs.setDoc(fs.doc(db, path), data, { merge });
  }

  const firebase = {
    async getPeople() {
      const { fs, db } = await fb();
      const snap = await fs.getDocs(fs.collection(db, "people"));
      if (snap.empty) return PARTICIPANTS.map(p => ({ ...p }));
      return snap.docs.map(d => ({ id: Number(d.id), ...d.data() })).sort((a, b) => a.id - b.id);
    },
    async getSettings() {
      return { ...DEFAULT_SETTINGS, ...(await fbGet("settings/main")) };
    },

    findKey: key => fbGet(`keys/${key}`),

    getProfile: id => fbGet(`profiles/${id}`),
    saveProfile: (id, data) => fbSet(`profiles/${id}`, { ...data, updatedAt: Date.now() }),

    getMessage: msgId => fbGet(`messages/${msgId}`),
    saveMessage: (msgId, data) => fbSet(`messages/${msgId}`, { ...data, updatedAt: Date.now() }),
    async getInbox(id) {
      const { fs, db } = await fb();
      const q = fs.query(fs.collection(db, "messages"), fs.where("toId", "==", id));
      return (await fs.getDocs(q)).docs.map(d => d.data());
    },

    async adminLogin({ email, password }) {
      const { auth, authInst } = await fb();
      await auth.signInWithEmailAndPassword(authInst, email, password);
    },
    async adminLoadSecret() {
      return (await fbGet("admin/secret")) ?? { codes: {}, assignment: {} };
    },
    async adminSavePeople(people) {
      const { fs, db } = await fb();
      const batch = fs.writeBatch(db);
      people.forEach(p => batch.set(fs.doc(db, `people/${p.id}`), { name: p.name, gender: p.gender }));
      await batch.commit();
    },
    adminSaveSettings: patch => fbSet("settings/main", patch, true),
    async adminCommit({ codes, assignment, keys, clearMessages }) {
      const { fs, db } = await fb();
      const batch = fs.writeBatch(db);
      const old = await fs.getDocs(fs.collection(db, "keys"));
      old.forEach(d => batch.delete(d.ref));
      Object.entries(keys).forEach(([k, v]) => batch.set(fs.doc(db, `keys/${k}`), v));
      batch.set(fs.doc(db, "admin/secret"), { codes, assignment });
      if (clearMessages) {
        (await fs.getDocs(fs.collection(db, "messages"))).forEach(d => batch.delete(d.ref));
      }
      await batch.commit();
    },
  };

  const impl = STORE === "firebase" ? firebase : local;

  /* ───────────── 공개 API ───────────── */

  const getPeople = () => impl.getPeople();
  const getSettings = () => impl.getSettings();
  const getProfile = id => impl.getProfile(id);
  const getInbox = async id =>
    (await impl.getInbox(id)).filter(m => m.text).sort((a, b) => b.updatedAt - a.updatedAt);

  // 코드 확인 → 성공 시 세션 { id, key }
  async function login(id, code) {
    const key = await loginKey(id, code);
    const doc = await impl.findKey(key);
    return doc && doc.id === id ? { id, key } : null;
  }

  async function getMyReceiverId(session) {
    const doc = await impl.findKey(session.key);
    return doc?.receiverId ?? null;
  }

  const saveProfile = (session, data) => impl.saveProfile(session.id, data);

  async function getMyMessage(session) {
    return impl.getMessage(await messageId(session.key));
  }

  async function saveMyMessage(session, toId, text) {
    await impl.saveMessage(await messageId(session.key), { toId, text });
  }

  const adminLogin = cred => impl.adminLogin(cred);
  const adminLoadSecret = () => impl.adminLoadSecret();
  const adminSavePeople = people => impl.adminSavePeople(people);
  const adminSaveSettings = patch => impl.adminSaveSettings(patch);

  // 코드·배정을 저장하고 로그인 키 문서를 다시 만듦
  async function adminCommit({ codes, assignment, clearMessages = false }) {
    const keys = {};
    for (const [id, code] of Object.entries(codes)) {
      keys[await loginKey(Number(id), code)] = {
        id: Number(id),
        receiverId: assignment[id] ?? null,
      };
    }
    await impl.adminCommit({ codes, assignment, keys, clearMessages });
  }

  return {
    STORE,
    getPeople,
    getSettings,
    getProfile,
    getInbox,
    login,
    getMyReceiverId,
    saveProfile,
    getMyMessage,
    saveMyMessage,
    adminLogin,
    adminLoadSecret,
    adminSavePeople,
    adminSaveSettings,
    adminCommit,
  };
})();
