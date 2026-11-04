// 데이터 저장소 — STORE 값으로 Supabase / Firebase(Firestore) / localStorage 전환
// participants.js 다음에 로드하세요. 전역 `store` 객체로 사용합니다.
const store = (() => {
  const STORE = "supabase"; // "supabase" | "firebase" | "local"

  // Supabase 대시보드 > Project Settings > API 의 Project URL과 anon(public) 키
  // anon 키는 공개돼도 괜찮아요. 권한은 supabase/schema.sql 의 함수들이 서버에서 확인합니다.
  const supabaseConfig = {
    url: "https://uwvqpigynrkrhwaqrzae.supabase.co",
    anonKey: "sb_publishable_-zYksklDdnCiYMHhGYgc1Q_7ghFz5Cm",
  };

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
      hints: {},     // { id: [힌트1, 힌트2, 힌트3] }
      hintDraws: {}, // { "마니또id:마니띠id": [뽑은 칸 번호] }
      ...db,
    };
    merged.settings = { ...DEFAULT_SETTINGS, ...db?.settings };
    merged.secret = { codes: {}, assignment: {}, threads: {}, ...db?.secret };
    return merged;
  }

  function lsSave(db) {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  }

  function lsHintState(db, session) {
    const target = db.keys[session.key]?.receiverId;
    const drawKey = `${session.id}:${target}`;
    return { hints: db.hints[target] ?? [], drawn: db.hintDraws[drawKey] ?? [], drawKey };
  }

  const local = {
    async getPeople() { return lsLoad().people; },
    async getSettings() { return lsLoad().settings; },

    async findKey(key) { return lsLoad().keys[key] ?? null; },
    async hasIssuedCodes() { return Object.keys(lsLoad().keys).length > 0; },

    async getProfile(id) { return lsLoad().profiles[id] ?? null; },
    async saveProfile(session, data) {
      const db = lsLoad();
      db.profiles[session.id] = { ...data, updatedAt: Date.now() };
      lsSave(db);
    },

    async findThreadFor(session) {
      const entry = Object.entries(lsLoad().chats).find(([, c]) => c.receiverId === session.id);
      return entry?.[0] ?? null;
    },
    async getChat(session, threadId) { return lsLoad().chats[threadId]?.items ?? []; },
    async sendChat(session, threadId, item) {
      const db = lsLoad();
      const chat = db.chats[threadId];
      if (!chat) throw new Error("쪽지함을 찾을 수 없어요.");
      chat.items.push(item);
      lsSave(db);
    },

    async getOwnHints(session) { return lsLoad().hints[session.id] ?? ["", "", ""]; },
    async saveHints(session, hints) {
      const db = lsLoad();
      db.hints[session.id] = hints.map(h => h.trim().slice(0, 100));
      lsSave(db);
    },
    async getHintGame(session) {
      const { hints, drawn } = lsHintState(lsLoad(), session);
      return { total: hints.filter(Boolean).length, drawn: drawn.map(i => hints[i]).filter(Boolean) };
    },
    async drawHint(session) {
      const db = lsLoad();
      const { hints, drawn, drawKey } = lsHintState(db, session);
      const left = hints.flatMap((h, i) => (h && !drawn.includes(i) ? [i] : []));
      if (!left.length) return null;
      const pick = left[Math.floor(Math.random() * left.length)];
      db.hintDraws[drawKey] = [...drawn, pick];
      lsSave(db);
      return { text: hints[pick] };
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
        db.hintDraws = {};
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

  // 힌트를 뽑기 전까지 숨기려면 서버 함수가 필요해서 firebase 모드는 지원하지 않음
  const hintsUnsupported = async () => { throw new Error("힌트 뽑기는 supabase 모드에서만 쓸 수 있어요."); };

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
    hasIssuedCodes: async () => true, // 목록 조회가 막혀 있어 확인 불가

    getProfile: id => fbGet(`profiles/${id}`),
    saveProfile: (session, data) => fbSet(`profiles/${session.id}`, { ...data, updatedAt: Date.now() }),

    async findThreadFor(session) {
      const { fs, db } = await fb();
      const q = fs.query(fs.collection(db, "chats"), fs.where("receiverId", "==", session.id), fs.limit(1));
      const snap = await fs.getDocs(q);
      return snap.empty ? null : snap.docs[0].id;
    },
    async getChat(session, threadId) {
      const { fs, db } = await fb();
      const q = fs.query(fs.collection(db, `chats/${threadId}/items`), fs.orderBy("at"));
      return (await fs.getDocs(q)).docs.map(d => d.data());
    },
    async sendChat(session, threadId, item) {
      const { fs, db } = await fb();
      await fs.addDoc(fs.collection(db, `chats/${threadId}/items`), item);
    },

    getOwnHints: hintsUnsupported,
    saveHints: hintsUnsupported,
    getHintGame: hintsUnsupported,
    drawHint: hintsUnsupported,

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

  /* ───────────── Supabase ───────────── */

  // 테이블은 RLS로 막혀 있고 schema.sql의 함수(RPC)로만 읽고 씀
  async function rpc(fn, args = {}) {
    const { url, anonKey } = supabaseConfig;
    if (!url || !anonKey) throw new Error("js/store.js 의 supabaseConfig를 먼저 채워주세요.");
    const headers = { apikey: anonKey, "Content-Type": "application/json" };
    if (anonKey.startsWith("eyJ")) headers.Authorization = `Bearer ${anonKey}`; // 예전 JWT 형식 키
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers,
      body: JSON.stringify(args),
    });
    const data = await res.json().catch(() => null); // 반환값 없는 함수는 본문이 비어 있음
    if (!res.ok) throw new Error(data?.message || `서버 오류 (${res.status})`);
    return data;
  }

  // 관리자 함수는 매번 서버에서 비밀번호를 다시 확인
  let adminPassword = null;
  const asAdmin = (fn, args = {}) => rpc(fn, { p_password: adminPassword, ...args });

  const supabase = {
    async getPeople() {
      const people = await rpc("get_people");
      return people?.length ? people : PARTICIPANTS.map(p => ({ ...p }));
    },
    async getSettings() {
      return { ...DEFAULT_SETTINGS, ...(await rpc("get_settings")) };
    },

    findKey: key => rpc("find_key", { p_key: key }),
    hasIssuedCodes: async () => true, // 서버에 있으니 브라우저와 무관

    getProfile: id => rpc("get_profile", { p_id: id }),
    saveProfile: (session, data) => rpc("save_profile", {
      p_key: session.key, p_likes: data.likes, p_dislikes: data.dislikes, p_allergy: data.allergy,
    }),

    findThreadFor: session => rpc("find_thread_for", { p_key: session.key }),
    getChat: (session, threadId) => rpc("get_chat", { p_key: session.key, p_thread: threadId }),
    sendChat: (session, threadId, item) =>
      rpc("send_chat", { p_key: session.key, p_thread: threadId, p_text: item.text }),

    getOwnHints: session => rpc("get_own_hints", { p_key: session.key }),
    saveHints: (session, hints) => rpc("save_hints", { p_key: session.key, p_hints: hints }),
    getHintGame: session => rpc("get_hint_game", { p_key: session.key }),
    drawHint: session => rpc("draw_hint", { p_key: session.key }),

    getFinalReveal: () => rpc("get_final_reveal"),

    async adminLogin({ password }) {
      await rpc("admin_login", { p_password: password });
      adminPassword = password;
    },
    adminLoadSecret: () => asAdmin("admin_load_secret"),
    adminSavePeople: people => asAdmin("admin_save_people", { p_people: people }),
    adminSaveSettings: patch => asAdmin("admin_save_settings", { p_patch: patch }),
    adminCommit: ({ codes, assignment, threads, keys, resetChats }) => asAdmin("admin_commit", {
      p_codes: codes, p_assignment: assignment, p_threads: threads, p_keys: keys,
      p_reset_chats: !!resetChats,
    }),
  };

  const impl = { supabase, firebase, local }[STORE];

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

  const hasIssuedCodes = () => impl.hasIssuedCodes();

  const saveProfile = (session, data) => impl.saveProfile(session, data);

  // 익명 쪽지: 쪽지함 하나 = 마니또(giver, 챙겨주는 사람) ↔ 마니띠(receiver, 챙김 받는 사람)
  // 쪽지함 id는 무작위라 마니띠 쪽에서는 마니또가 누군지 알 수 없음
  // findThreadFor: 나(session)를 챙겨주는 마니또와의 쪽지함
  const findThreadFor = session => impl.findThreadFor(session);
  const getChat = (session, threadId) => impl.getChat(session, threadId);
  const sendChat = (session, threadId, from, text) =>
    impl.sendChat(session, threadId, { from, text, at: Date.now() });

  // 힌트 뽑기: 안 뽑은 힌트의 내용은 drawHint로만 받을 수 있음
  const getOwnHints = session => impl.getOwnHints(session);
  const saveHints = (session, hints) => impl.saveHints(session, hints);
  const getHintGame = session => impl.getHintGame(session);
  const drawHint = session => impl.drawHint(session);

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
    hasIssuedCodes,
    getMyAssignment,
    saveProfile,
    findThreadFor,
    getChat,
    sendChat,
    getOwnHints,
    saveHints,
    getHintGame,
    drawHint,
    getFinalReveal,
    adminLogin,
    adminLoadSecret,
    adminSavePeople,
    adminSaveSettings,
    adminCommit,
  };
})();
