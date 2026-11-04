// 매칭 알고리즘 — "한 바퀴 원(Single Cycle)" 셔플 + 남녀 비율 조정

function randomInt(max) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}

function shuffle(arr) {        // Fisher–Yates
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
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

function crossRatio(assign, byId) {
  // 명단에서 빠진 사람이 예전 배정에 남아 있어도 관리자 화면이 멈추지 않도록 건너뜀
  const pairs = Object.entries(assign).filter(([g, r]) => byId[g] && byId[r]);
  if (!pairs.length) return 0;
  const cross = pairs.filter(([g, r]) => byId[g].gender !== byId[r].gender).length;
  return cross / pairs.length;
}

function expectedCross(people) { // balanced 모드의 목표값
  const n = people.length;
  const m = people.filter(p => p.gender === "M").length;
  const f = n - m;
  return (2 * m * f) / (n * (n - 1));
}

function targetFor(mode, people, customPct = 50) {
  switch (mode) {
    case "same":   return 0;
    case "mixed":  return 1;
    case "custom": return Math.min(100, Math.max(0, Number(customPct) || 0)) / 100;
    default:       return expectedCross(people);
  }
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

// 배정 결과 검증: 본인 0건, 쌍방 0건, 전원 1:1
function verify(assign, people) {
  const byId = Object.fromEntries(people.map(p => [p.id, p]));
  const givers = Object.keys(assign).map(Number);
  const receivers = Object.values(assign).map(Number);
  const self = givers.filter(g => assign[g] === g).length;
  const mutual = givers.filter(g => assign[assign[g]] === g).length / 2;
  const oneToOne =
    givers.length === people.length &&
    new Set(receivers).size === people.length &&
    people.every(p => p.id in assign);
  return { self, mutual, oneToOne, cross: crossRatio(assign, byId) };
}
