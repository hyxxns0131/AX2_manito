# 🎁 우리 팀 마니또 (Manito Picker)

29명 팀원을 위한 **마니또 뽑기 웹사이트**입니다.
HTML · CSS · Vanilla JavaScript로 만들고, 모바일부터 데스크톱까지 반응형으로 동작합니다.

> **용어** — **마니또**: 나를 몰래 챙겨주는 사람 · **마니띠**: 내가 몰래 챙겨주는 사람

---

## ✨ 주요 기능

| 기능 | 설명 |
|---|---|
| 🎲 마니또 랜덤 배정 | 본인은 절대 안 나오고, **서로가 서로의 마니또(쌍방)** 가 되는 일도 없음 |
| ⚖️ 남녀 비율 고려 | 배정 결과의 동성/이성 매칭 비율을 설정값에 맞춰 조정 |
| 🔐 개인 코드 로그인 | 각자 받은 4~6자리 코드로 들어와 **자기 마니띠만** 확인 |
| 📝 내 프로필 작성 | 좋아하는 것 / 싫어하는 것·못 먹는 것 입력 |
| 👀 마니띠 프로필 보기 | 내 마니띠가 적은 좋아하는 것·못 먹는 것 확인 (선물 고를 때 참고) |
| 💌 익명 쪽지 | 내 마니띠와 쪽지 주고받기 (마니띠에겐 내가 익명) + 내 마니또와 쪽지 주고받기 (마니또는 나에게 익명) |
| 🎉 정체 공개 | 관리자가 정한 시간(또는 "지금 바로 공개")에 각자의 마니또와 전체 결과 공개 |
| 🛠 관리자 페이지 | 성별 입력, 배정 실행/재실행, 전체 배정표 보기, 코드 발급, 마니띠 확인 시작·정체 공개 일시 설정 |

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
[3] 마니띠 확인       두근두근 카드 뒤집기 애니메이션 → "당신의 마니띠는 ○○○"
        │             └ ○○○ 님의 좋아하는 것 / 못 먹는 것 보기
        │
[4] 익명 쪽지         💌 내 마니띠와 쪽지 (마니띠는 내가 누군지 모름)
        │             🎁 내 마니또와 쪽지 (나는 마니또가 누군지 모름)
        │
[5] 정체 공개         관리자가 정한 시각에 "나를 몰래 챙겨준 마니또는 ○○○!" + 전체 결과
```

| 페이지 | 파일 | 주요 요소 |
|---|---|---|
| 입장 | `index.html` | 이름 드롭다운, 코드 입력, 입장 버튼 |
| 마이페이지 | `me.html` | 정체 공개 배너, 마니띠 카드, 프로필 폼, 익명 쪽지함 2개 |
| 관리자 | `admin.html` | 성별 입력 표, 모드 선택, 배정 실행, 전체 배정표, 코드 일괄 발급/복사, 확인 시작·정체 공개 일시 |

### 입력 필드
| 필드 | key | 제한 |
|---|---|---|
| 좋아하는 것 | `likes` | 최대 100자, 태그처럼 쉼표로 여러 개 |
| 싫어하는 것 / 못 먹는 것 | `dislikes` | 최대 100자 (알레르기 표시 체크박스 `allergy`) |
| 쪽지 | `text` | 한 번에 최대 200자 |

---

## 🎨 테마

참고 이미지(핑크 보석 게임 UI, 핑크 사물함 콜라주 포스터)는 다른 사람의 저작물이라 그대로 옮기지 않고, **분위기만 참고한 오리지널 테마**로 만들었습니다.

- **콘셉트**: "핑크 사물함 × Y2K 콜라주 × 핑크 보석"
- **배경**: 핫핑크 사물함 철판 질감 + 문짝 이음선 + 비스듬한 그림자
- **카드**: 마스킹 테이프로 붙인 흰 종이, 섹션 제목은 픽셀 글씨 스티커 라벨
- **버튼·입력**: 금테 두른 핑크/골드 보석 (입장·관리자 로그인은 보석 패널)
- **장식**: 랜섬 노트 글자 타일, 움직이는 눈알 스티커, 웃는 별 스티커
- **마니띠 카드**: 앞면 보석 선물 상자 → 뒷면 "MANITTI ID" 학생증
- **정체 공개**: 지그재그 끝의 영수증 "MANITO RECEIPT"
- **쪽지**: 줄 노트 위에 내 쪽지는 보석 말풍선, 상대 쪽지는 종이 스티커

```css
:root {
  --locker: #ea4c89;     /* 사물함 배경 */
  --pink-500: #ff4f9a;   /* 보석·강조 */
  --pink-700: #c0185f;
  --gold-2: #f2c14e;     /* 금테 */
  --paper: #fffdf7;      /* 종이 카드 */
  --ink: #1f1419;        /* 글자·외곽선 */
  --yellow: #ffd84d;     /* 하이라이트 */
  --blue: #4f8fd6;       /* 별 스티커 */
}
```

- **폰트**: 제목·라벨 [Galmuri11](https://github.com/quiple/galmuri) (한글 픽셀 폰트, jsDelivr), 본문 `Noto Sans KR` (Google Fonts)
- **애니메이션**: 선물 상자 흔들림 → 리본이 날아가며 카드가 뒤집힘, 영수증 출력 효과 (`prefers-reduced-motion` 시 생략)

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
│  ├─ store.js         # 데이터 저장소 (Supabase / Firebase / localStorage)
│  ├─ auth.js          # 코드 로그인
│  ├─ me.js
│  └─ admin.js
├─ supabase/
│  ├─ schema.sql       # 테이블 + RLS + 함수 (SQL Editor에서 한 번 실행)
│  └─ reset.sql        # 테스트 후 초기화
├─ firestore.rules     # Firestore 보안 규칙
└─ assets/
   └─ icons/           # 선물상자, 리본, 하트, 별 SVG
```

---

## 🗄 데이터 구조

```js
people/{id}       = { name, gender }                 // 누구나 읽기
settings/main     = { mode, customPct, revealAt, finalRevealAt, drawnAt }
                    // revealAt: 마니띠 확인 시작, finalRevealAt: 정체 공개(ms)
keys/{loginKey}   = { id, receiverId, threadId }      // loginKey = SHA-256("id:코드")
                                                      // 코드를 아는 본인만 문서를 찾을 수 있음 (목록 조회 금지)
profiles/{id}     = { likes, dislikes, allergy, updatedAt }
chats/{threadId}  = { receiverId }                    // threadId = 무작위 값 (챙겨주는 사람만 keys 문서로 앎)
chats/{threadId}/items/{auto} = { from: "giver" | "receiver", text, at }
reveal/all        = { assignment }                    // 정체 공개 시각 이후에만 읽기 가능 (보안 규칙)
admin/secret      = { codes, assignment, threads }    // 관리자 전용
```

> 배정을 다시 실행하면 모든 쪽지가 초기화됩니다. 코드 재발급 시에는 쪽지가 유지됩니다.
> 새 쪽지는 몇 초마다 자동으로 불러옵니다 (local 2초 / supabase·firebase 5초).
>
> Supabase 모드에서는 같은 내용을 `supabase/schema.sql`의 테이블(`people`, `settings`, `login_keys`, `profiles`, `chats`, `chat_items`, `admin_secret`)에 저장합니다.

---

## 💾 저장소 선택 (중요)

순수 HTML/CSS/JS만으로는 **29명이 각자 폰에서** 같은 데이터를 공유할 수 없습니다. 아래 중 하나를 고르세요.

| 방식 | 장점 | 단점 |
|---|---|---|
| **Supabase — 기본값** | 무료 범위 충분, 모든 권한을 서버 함수에서 확인 | 프로젝트 생성 필요 |
| Firebase (Firestore) | 보안 규칙으로 "본인 배정만 읽기" 가능 | 관리자 이메일 계정 필요 |
| localStorage만 사용 | 설정 없음 | **한 기기에서만** 동작 (테스트용) |

`js/store.js`에서 `STORE = "supabase" | "firebase" | "local"`로 전환합니다.

### Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (무료 플랜, 리전은 Seoul 추천)
2. **SQL Editor**에 `supabase/schema.sql` 전체를 붙여넣고 **Run**
3. 같은 곳에서 관리자 비밀번호 설정 (바꾸기 전에는 관리자 화면에 못 들어가요)
   ```sql
   update admin_secret set password_hash = extensions.crypt('원하는비밀번호', extensions.gen_salt('bf')) where id = 1;
   ```
4. **Project Settings > API**(또는 API Keys)에서 Project URL과 anon(public) 키를 복사해 `js/store.js`의 `supabaseConfig`에 입력
5. 커밋·푸시 → Vercel이 자동으로 다시 배포

- anon 키는 공개돼도 괜찮습니다. 테이블은 RLS로 모두 막혀 있고, 함수들이 로그인 키·관리자 비밀번호·공개 시각을 서버에서 확인합니다.
- 마니띠 확인 시작 전에는 서버가 배정 정보를 내려주지 않고, 쪽지는 그 쪽지함의 두 사람만 읽고 쓸 수 있습니다.
- 테스트 후 초기화: SQL Editor에서 `supabase/reset.sql` 실행 (명단·성별·비밀번호는 유지)

> ⚠️ 배정 결과 전체를 클라이언트 JS에 넣으면 개발자도구로 누구나 볼 수 있습니다. 반드시 서버 측(Firestore 보안 규칙 등)에서 **로그인한 본인 문서만 읽도록** 막아주세요.

---

## 🚀 실행 방법

```bash
# 1. 클론
git clone <repo-url> && cd manito

# 2. Supabase 사용 시 위 "Supabase 설정" 진행 후 정적 서버로 열기
#    (local 모드로 테스트하려면 js/store.js 의 STORE = "local")
npx serve .

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
   + "누가 누구의 마니또?" 전체 배정표 표시 (복사 가능)
5. **개인 코드 발급** → 각자에게 DM으로 전달
6. **마니띠 확인 시작** 설정 → 그 전엔 마니띠 카드와 쪽지가 잠겨 있음
7. **정체 공개** 예약 또는 "지금 바로 공개" → 모두에게 각자의 마니또·전체 결과 공개

---

## ✅ 체크리스트

- [ ] 29명 모두 정확히 1명씩 배정되는가
- [ ] 본인 배정 0건 / 쌍방 배정 0건
- [ ] 성별 미입력 시 배정 차단
- [ ] 타인 코드로 다른 사람 결과 조회 불가
- [ ] 정체 공개 전, 마니띠 화면에 마니또 이름이 노출되지 않음
- [ ] 정체 공개 시각 이후 "나를 몰래 챙겨준 마니또"와 전체 결과가 보임
- [ ] 360px / 768px / 1280px 화면 확인

---

## 📌 추후 아이디어

- 정체 공개 전 "내 마니또는 누구였을까?" 맞히기 이벤트
- 선물 인증 사진 업로드
- 미션 카드 (하루 한 가지 몰래 챙기기 미션)
