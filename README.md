# 🎁 우리 팀 마니또 (Manito Picker)

29명 팀원을 위한 **마니또 뽑기 웹사이트**입니다.
HTML · CSS · Vanilla JavaScript로 만들고, 모바일부터 데스크톱까지 반응형으로 동작합니다.

---

## ✨ 주요 기능

| 기능 | 설명 |
|---|---|
| 🎲 마니또 랜덤 배정 | 본인은 절대 안 나오고, **서로가 서로의 마니또(쌍방)** 가 되는 일도 없음 |
| ⚖️ 남녀 비율 고려 | 배정 결과의 동성/이성 매칭 비율을 설정값에 맞춰 조정 |
| 🔐 개인 코드 로그인 | 각자 받은 4~6자리 코드로 들어와 **자기 마니또만** 확인 |
| 📝 내 프로필 작성 | 좋아하는 것 / 싫어하는 것·못 먹는 것 입력 |
| 👀 마니또 프로필 보기 | 내 마니또가 적은 좋아하는 것·못 먹는 것 확인 (선물 고를 때 참고) |
| 💌 한마디 남기기 | 내 마니또에게 익명 메시지 작성 → 받는 사람은 "누군가"로부터 받은 메시지로 확인 |
| 🛠 관리자 페이지 | 성별 입력, 배정 실행/재실행, 코드 발급, 공개일 설정 |

---

## 👥 참가자 명단 (29명)

> `gender`는 이름만으로 판단하지 않고 **관리자가 직접 입력**합니다. (`M` / `F`)

| # | 이름 | gender |
|---|---|---|
| 1 | 김도훈 | |
| 2 | 맹민지 | |
| 3 | 강현서 | |
| 4 | 권해원 | |
| 5 | 김민정 | |
| 6 | 김민 | |
| 7 | 박진혁 | |
| 8 | 권혁주 | |
| 9 | 김민서 | |
| 10 | 유정현 | |
| 11 | 이정빈 | |
| 12 | 장희주 | |
| 13 | 소준희 | |
| 14 | 문승호 | |
| 15 | 정은진 | |
| 16 | 최가은 | |
| 17 | 정주연 | |
| 18 | 양효선 | |
| 19 | 이상협 | |
| 20 | 한윤수 | |
| 21 | 황주현 | |
| 22 | 주상준 | |
| 23 | 이나원 | |
| 24 | 이수연 | |
| 25 | 홍은주 | |
| 26 | 황준영 | |
| 27 | 최유진 | |
| 28 | 이현경 | |
| 29 | 채주현 | |

`js/participants.js`

```js
export const PARTICIPANTS = [
  { id: 1,  name: "김도훈", gender: "" },
  { id: 2,  name: "맹민지", gender: "" },
  { id: 3,  name: "강현서", gender: "" },
  { id: 4,  name: "권해원", gender: "" },
  { id: 5,  name: "김민정", gender: "" },
  { id: 6,  name: "김민", gender: "" },
  { id: 7,  name: "박진혁", gender: "" },
  { id: 8,  name: "권혁주", gender: "" },
  { id: 9,  name: "김민서", gender: "" },
  { id: 10, name: "유정현", gender: "" },
  { id: 11, name: "이정빈", gender: "" },
  { id: 12, name: "장희주", gender: "" },
  { id: 13, name: "소준희", gender: "" },
  { id: 14, name: "문승호", gender: "" },
  { id: 15, name: "정은진", gender: "" },
  { id: 16, name: "최가은", gender: "" },
  { id: 17, name: "정주연", gender: "" },
  { id: 18, name: "양효선", gender: "" },
  { id: 19, name: "이상협", gender: "" },
  { id: 20, name: "한윤수", gender: "" },
  { id: 21, name: "황주현", gender: "" },
  { id: 22, name: "주상준", gender: "" },
  { id: 23, name: "이나원", gender: "" },
  { id: 24, name: "이수연", gender: "" },
  { id: 25, name: "홍은주", gender: "" },
  { id: 26, name: "황준영", gender: "" },
  { id: 27, name: "최유진", gender: "" },
  { id: 28, name: "이현경", gender: "" },
  { id: 29, name: "채주현", gender: "" },
];
```

---

## 🎲 매칭 규칙 & 알고리즘

### 규칙
1. **본인 제외** — A의 마니또는 A가 될 수 없음
2. **쌍방 금지** — A→B 이면 B→A 는 불가
3. **전원 1:1** — 모든 사람이 정확히 한 명을 챙기고, 정확히 한 명에게 챙김 받음
4. **남녀 비율 고려** — 아래 모드 중 하나로 조정

### 방법: "한 바퀴 원(Single Cycle)" 셔플
명단을 무작위로 섞은 뒤, **각자 다음 사람의 마니또**가 되도록 원형으로 연결합니다.

```
섞은 순서: 이나원 → 문승호 → 김민정 → … → 홍은주 → (다시 이나원)
```

- 원의 길이가 29이므로 자기 자신이 나올 수 없고 (규칙 1)
- 3명 이상인 원에서는 A→B, B→A가 동시에 생길 수 없음 (규칙 2)
- 별도의 재시도 없이 **항상** 두 규칙을 만족합니다.

```js
function shuffle(arr) {               // Fisher–Yates
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeCycle(people) {
  const order = shuffle(people);
  const result = {};                  // { giverId: receiverId }
  order.forEach((p, i) => {
    result[p.id] = order[(i + 1) % order.length].id;
  });
  return result;
}
```

### ⚖️ 남녀 비율 처리
셔플 후보를 여러 번(기본 3,000회) 만들고, 아래 모드의 목표에 **가장 가까운 결과**를 채택합니다.

| 모드 | 목표 | 설명 |
|---|---|---|
| `balanced` (기본) | 이성 매칭 비율 ≈ 전체 남녀 구성에서 자연스럽게 기대되는 비율 | 한쪽으로 쏠리지 않게 |
| `same` | 동성 매칭 최대화 | 선물·메시지 부담을 줄이고 싶을 때 |
| `mixed` | 이성 매칭 최대화 | 섞어서 친해지기 |
| `custom` | 관리자가 지정한 이성 매칭 비율 (예: 50%) | |

```js
function crossRatio(assign, byId) {
  const pairs = Object.entries(assign);
  const cross = pairs.filter(([g, r]) => byId[g].gender !== byId[r].gender).length;
  return cross / pairs.length;
}

function expectedCross(people) {      // balanced 모드의 목표값
  const n = people.length;
  const m = people.filter(p => p.gender === "M").length;
  const f = n - m;
  return (2 * m * f) / (n * (n - 1));
}

function draw(people, target, tries = 3000) {
  const byId = Object.fromEntries(people.map(p => [p.id, p]));
  let best = null, bestDiff = Infinity;
  for (let t = 0; t < tries; t++) {
    const cand = makeCycle(people);
    const diff = Math.abs(crossRatio(cand, byId) - target);
    if (diff < bestDiff) { best = cand; bestDiff = diff; }
    if (diff === 0) break;
  }
  return best;
}
```

> 성별이 비어 있는 사람이 있으면 배정 버튼이 비활성화되고 안내 문구가 뜹니다.

---

## 🖥 화면 구성

```
[1] 입장(로그인)      이름 선택 + 개인 코드 입력
        │
[2] 내 프로필 작성    😍 좋아하는 것   🙅 싫어하는 것 / 못 먹는 것
        │
[3] 마니또 공개       두근두근 카드 뒤집기 애니메이션 → "당신의 마니또는 ○○○"
        │             └ ○○○ 님의 좋아하는 것 / 못 먹는 것 보기
        │
[4] 한마디 남기기     내 마니또에게 익명 메시지 (최대 200자, 수정 가능)
        │
[5] 받은 편지함       나에게 온 익명 한마디 확인
```

| 페이지 | 파일 | 주요 요소 |
|---|---|---|
| 입장 | `index.html` | 이름 드롭다운, 코드 입력, 입장 버튼 |
| 마이페이지 | `me.html` | 프로필 폼, 마니또 카드, 한마디 입력, 받은 메시지 |
| 관리자 | `admin.html` | 성별 입력 표, 모드 선택, 배정 실행, 코드 일괄 발급/복사, 공개 일시 설정 |

### 입력 필드
| 필드 | key | 제한 |
|---|---|---|
| 좋아하는 것 | `likes` | 최대 100자, 태그처럼 쉼표로 여러 개 |
| 싫어하는 것 / 못 먹는 것 | `dislikes` | 최대 100자 (알레르기 표시 체크박스 `allergy`) |
| 마니또에게 한마디 | `message` | 최대 200자 |

---

## 🎨 테마

보내주신 앨범 커버 이미지는 해당 아티스트의 저작물이라 그 디자인(로고·타이틀 레터링·접힌 편지 오브젝트·구름+별 하늘 구성)을 그대로 옮기지는 않고, **비슷한 파스텔 핑크 × 하늘색 분위기의 오리지널 테마**로 설계했습니다.

- **콘셉트**: "비밀 선물 상자" — 리본 묶인 선물 상자, 물방울(폴카닷) 패턴, 작은 하트 스티커
- **배경**: 하늘색 → 연하늘 그라데이션 + 은은한 흰색 폴카닷
- **카드**: 핑크 카드, 둥근 모서리, 살짝 기울어진 스티커 느낌의 그림자
- **포인트 컬러**: 진핑크 버튼, 노란색 하이라이트 배지

```css
:root {
  --sky-1: #5fa8e0;      /* 배경 위 */
  --sky-2: #a9d4f5;      /* 배경 아래 */
  --pink-100: #fde3ef;   /* 카드 배경 */
  --pink-300: #f6a6c8;
  --pink-500: #e83f8a;   /* 버튼·강조 */
  --pink-700: #b8236a;   /* 제목 텍스트 */
  --yellow: #ffd84d;     /* 배지·하이라이트 */
  --ink: #3b2a3a;
  --radius: 20px;
  --shadow: 0 8px 0 rgba(184, 35, 106, .15);
}
```

- **폰트** (Google Fonts): 제목 `Jua`, 본문 `Gowun Dodum`
- **애니메이션**: 마니또 공개 시 선물 상자 리본이 풀리며 카드가 뒤집히는 효과 (`prefers-reduced-motion` 시 생략)

---

## 📱 반응형

| 구간 | 너비 | 레이아웃 |
|---|---|---|
| Mobile | ~ 599px | 1열, 하단 고정 버튼, 좌우 여백 16px |
| Tablet | 600 ~ 1023px | 카드 2열 |
| Desktop | 1024px ~ | 최대 폭 960px 중앙 정렬, 관리자 표 전체 노출 |

- 모바일 우선(Mobile-first) CSS
- 관리자 성별 입력 표는 모바일에서 카드 리스트로 변환
- 터치 영역 최소 44px

---

## 📁 폴더 구조

```
manito/
├─ index.html          # 입장
├─ me.html             # 마이페이지
├─ admin.html          # 관리자
├─ css/
│  ├─ base.css         # 리셋, 변수, 폰트
│  ├─ components.css   # 버튼, 카드, 폼, 배지
│  └─ pages.css        # 페이지별 + 반응형
├─ js/
│  ├─ participants.js  # 명단
│  ├─ draw.js          # 매칭 알고리즘
│  ├─ store.js         # 데이터 저장소 (Firebase / localStorage)
│  ├─ auth.js          # 코드 로그인
│  ├─ me.js
│  └─ admin.js
├─ firestore.rules     # Firestore 보안 규칙
└─ assets/
   └─ icons/           # 선물상자, 리본, 하트 SVG
```

---

## 🗄 데이터 구조

```js
people/{id}       = { name, gender }                 // 누구나 읽기
settings/main     = { mode, customPct, revealAt, drawnAt }
keys/{loginKey}   = { id, receiverId }                // loginKey = SHA-256("id:코드")
                                                      // 코드를 아는 본인만 문서를 찾을 수 있음 (목록 조회 금지)
profiles/{id}     = { likes, dislikes, allergy, updatedAt }
messages/{msgId}  = { toId, text, updatedAt }         // msgId = SHA-256("msg:" + loginKey)
                                                      // 받는 사람에겐 보낸 사람이 드러나지 않음
admin/secret      = { codes, assignment }             // 관리자 전용
```

> 배정을 다시 실행하거나 코드를 재발급하면 기존 한마디는 초기화됩니다.

---

## 💾 저장소 선택 (중요)

순수 HTML/CSS/JS만으로는 **29명이 각자 폰에서** 같은 데이터를 공유할 수 없습니다. 아래 중 하나를 고르세요.

| 방식 | 장점 | 단점 |
|---|---|---|
| **Firebase (Firestore) — 추천** | 무료 범위 충분, 보안 규칙으로 "본인 배정만 읽기" 가능 | 프로젝트 생성 필요 |
| Supabase | SQL 기반, RLS로 권한 제어 | 설정 약간 더 필요 |
| Google Sheets + Apps Script | 시트로 결과 관리 쉬움 | 권한 제어가 약함 |
| localStorage만 사용 | 설정 없음 | **한 기기에서만** 동작 (테스트용) |

`js/store.js`에서 `STORE = "firebase" | "local"`로 전환합니다.

> ⚠️ 배정 결과 전체를 클라이언트 JS에 넣으면 개발자도구로 누구나 볼 수 있습니다. 반드시 서버 측(Firestore 보안 규칙 등)에서 **로그인한 본인 문서만 읽도록** 막아주세요.

---

## 🚀 실행 방법

```bash
# 1. 클론
git clone <repo-url> && cd manito

# 2. 로컬 서버 (ES Module 사용으로 file:// 대신 서버 필요)
npx serve .
# 또는 VS Code Live Server

# 3. Firebase 사용 시 js/store.js 의 STORE = "firebase", firebaseConfig 입력
#    + firestore.rules 배포, Authentication에서 관리자 이메일 계정 생성
#    (local 모드 관리자 비밀번호: js/store.js 의 LOCAL_ADMIN_PASSWORD)
```

배포: GitHub Pages / Netlify / Vercel (정적 호스팅)

---

## 🛠 관리자 진행 순서

1. `admin.html` 접속 (관리자 비밀번호)
2. 29명 **성별 입력**
3. 매칭 **모드 선택** (`balanced` 기본)
4. **배정 실행** → 결과 검증(본인 0건, 쌍방 0건, 이성 매칭 비율) 표시
5. **개인 코드 발급** → 각자에게 DM으로 전달
6. **공개 일시** 설정 → 그 전엔 마니또 카드가 잠겨 있음

---

## ✅ 체크리스트

- [ ] 29명 모두 정확히 1명씩 배정되는가
- [ ] 본인 배정 0건 / 쌍방 배정 0건
- [ ] 성별 미입력 시 배정 차단
- [ ] 타인 코드로 다른 사람 결과 조회 불가
- [ ] 한마디 수신자 화면에 보낸 사람 이름이 노출되지 않음
- [ ] 360px / 768px / 1280px 화면 확인

---

## 📌 추후 아이디어

- 마니또 종료일에 "내 마니또는 누구였을까?" 맞히기 이벤트 & 전체 공개
- 선물 인증 사진 업로드
- 미션 카드 (하루 한 가지 몰래 챙기기 미션)
