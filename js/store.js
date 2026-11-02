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

  const DEFAULT_SETTINGS = {
    mode: "balanced",
    customPct: 50,
    revealAt: null,       // 참가자가 자기 마니띠를 볼 수 있는 시각 (ISO)
    finalRevealAt: null,  // 누가 누구의 마니또였는지 정체 공개 시각 (ms)
    drawnAt: null,
  };

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // 로그인 키: 이름 id + 개인 코드의 해시. 배정 문서의 id로 쓰이므로 코드를 모르면 찾을 수 없음
  const loginKey = (id, code) => sha256(`${id}:${code.trim().toUpperCase()}`);

  const isFinalRevealed = s => s.finalRevealAt != null && Date.now() >= s.finalRevealAt;

  /* ───────────── localStorage ───────────── */

  const LS_KEY = "manito-db";

  function lsLoad() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(LS_KEY)); } catch {}
    const merged = {
      people: PARTICIPANTS.map(p => ({ ...p })),
      keys: {},      // { loginKey: { id, receiverId, threadId } }
      profiles: {},  // { id: { likes, dislikes, allergy, updatedAt } }
      chats: {},     // { threadId: { receiverId, items: [{ from, text, at }] } }
      ...db,
    };
    merged.settings = { ...DEFAULT_SETTINGS, ...db?.settings };
    merged.secret = { codes: {}, assignment: {}, threads: {}, ...db?.secret };
    return merged;
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

    async findThreadFor(receiverId) {
      const entry = Object.entries(lsLoad().chats).find(([, c]) => c.receiverId === receiverId);
      return entry?.[0] ?? null;
    },
    async getChat(threadId) { return lsLoad().chats[threadId]?.items ?? []; },
    async sendChat(threadId, item) {
      const db = lsLoad();
      const chat = db.chats[threadId];
      if (!chat) throw new Error("쪽지함을 찾을 수 없어요.");
      chat.items.push(item);
      lsSave(db);
    },

    async getFinalReveal() {
      const db = lsLoad();
      return isFinalRevealed(db.settings) ? db.secret.assignment : null;
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
    async adminCommit({ codes, assignment, threads, keys, resetChats }) {
      const db = lsLoad();
      db.keys = keys;
      db.secret = { codes, assignment, threads };
      if (resetChats) {
        db.chats = {};
        for (const [giverId, threadId] of Object.entries(threads)) {
          db.chats[threadId] = { receiverId: assignment[giverId], items: [] };
        }
      }
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

    async findThreadFor(receiverId) {
      const { fs, db } = await fb();
      const q = fs.query(fs.collection(db, "chats"), fs.where("receiverId", "==", receiverId), fs.limit(1));
      const snap = await fs.getDocs(q);
      return snap.empty ? null : snap.docs[0].id;
    },
    async getChat(threadId) {
      const { fs, db } = await fb();
      const q = fs.query(fs.collection(db, `chats/${threadId}/items`), fs.orderBy("at"));
      return (await fs.getDocs(q)).docs.map(d => d.data());
    },
    async sendChat(threadId, item) {
      const { fs, db } = await fb();
      await fs.addDoc(fs.collection(db, `chats/${threadId}/items`), item);
    },

    // 보안 규칙이 공개 시각 전에는 읽기를 막음
    async getFinalReveal() {
      try { return (await fbGet("reveal/all"))?.assignment ?? null; } catch { return null; }
    },

    async adminLogin({ email, password }) {
      const { auth, authInst } = await fb();
      await auth.signInWithEmailAndPassword(authInst, email, password);
    },
    async adminLoadSecret() {
      return { codes: {}, assignment: {}, threads: {}, ...(await fbGet("admin/secret")) };
    },
    async adminSavePeople(people) {
      const { fs, db } = await fb();
      const batch = fs.writeBatch(db);
      people.forEach(p => batch.set(fs.doc(db, `people/${p.id}`), { name: p.name, gender: p.gender }));
      await batch.commit();
    },
    adminSaveSettings: patch => fbSet("settings/main", patch, true),
    async adminCommit({ codes, assignment, threads, keys, resetChats }) {
      const { fs, db } = await fb();
      const batch = fs.writeBatch(db);
      (await fs.getDocs(fs.collection(db, "keys"))).forEach(d => batch.delete(d.ref));
      Object.entries(keys).forEach(([k, v]) => batch.set(fs.doc(db, `keys/${k}`), v));
      batch.set(fs.doc(db, "admin/secret"), { codes, assignment, threads });
      batch.set(fs.doc(db, "reveal/all"), { assignment });
      if (resetChats) {
        for (const chat of (await fs.getDocs(fs.collection(db, "chats"))).docs) {
          (await fs.getDocs(fs.collection(db, `chats/${chat.id}/items`))).forEach(d => batch.delete(d.ref));
          batch.delete(chat.ref);
        }
        for (const [giverId, threadId] of Object.entries(threads)) {
          batch.set(fs.doc(db, `chats/${threadId}`), { receiverId: assignment[giverId] });
        }
      }
      await batch.commit();
    },
  };

  const impl = STORE === "firebase" ? firebase : local;

  /* ───────────── 공개 API ───────────── */

  const getPeople = () => impl.getPeople();
  const getSettings = () => impl.getSettings();
  const getProfile = id => impl.getProfile(id);

  // 코드 확인 → 성공 시 세션 { id, key }
  async function login(id, code) {
    const key = await loginKey(id, code);
    const doc = await impl.findKey(key);
    return doc && doc.id === id ? { id, key } : null;
  }

  // 내 배정: { receiverId, threadId } (배정 전이면 null 값)
  async function getMyAssignment(session) {
    const doc = await impl.findKey(session.key);
    return { receiverId: doc?.receiverId ?? null, threadId: doc?.threadId ?? null };
  }

  const saveProfile = (session, data) => impl.saveProfile(session.id, data);

  // 익명 쪽지: 쪽지함 하나 = 마니또(giver, 챙겨주는 사람) ↔ 마니띠(receiver, 챙김 받는 사람)
  // 쪽지함 id는 무작위라 마니띠 쪽에서는 마니또가 누군지 알 수 없음
  const findThreadFor = receiverId => impl.findThreadFor(receiverId);
  const getChat = threadId => impl.getChat(threadId);
  const sendChat = (threadId, from, text) => impl.sendChat(threadId, { from, text, at: Date.now() });

  const getFinalReveal = () => impl.getFinalReveal();

  const adminLogin = cred => impl.adminLogin(cred);
  const adminLoadSecret = () => impl.adminLoadSecret();
  const adminSavePeople = people => impl.adminSavePeople(people);
  const adminSaveSettings = patch => impl.adminSaveSettings(patch);

  // 코드·배정을 저장하고 로그인 키 문서를 다시 만듦 (resetChats면 쪽지함도 새로 만듦)
  async function adminCommit({ codes, assignment, threads, resetChats = false }) {
    const keys = {};
    for (const [id, code] of Object.entries(codes)) {
      keys[await loginKey(Number(id), code)] = {
        id: Number(id),
        receiverId: assignment[id] ?? null,
        threadId: threads[id] ?? null,
      };
    }
    await impl.adminCommit({ codes, assignment, threads, keys, resetChats });
  }

  return {
    STORE,
    isFinalRevealed,
    getPeople,
    getSettings,
    getProfile,
    login,
    getMyAssignment,
    saveProfile,
    findThreadFor,
    getChat,
    sendChat,
    getFinalReveal,
    adminLogin,
    adminLoadSecret,
    adminSavePeople,
    adminSaveSettings,
    adminCommit,
  };
})();
