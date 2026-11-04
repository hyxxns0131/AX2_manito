// 미니홈피 — 탭 전환, 날짜·멤버 수 표시, 새 쪽지 알림
(() => {
  const panels = [...document.querySelectorAll("[data-panel]")];
  const navTabs = [...document.querySelectorAll(".hompy-tabs [data-tab]")];
  const noteTabs = [...document.querySelectorAll("[data-note]")];

  function showTab(name) {
    const target = panels.some(p => p.dataset.panel === name) ? name : "home";
    panels.forEach(p => (p.hidden = p.dataset.panel !== target));
    navTabs.forEach(t => {
      t.setAttribute("aria-selected", String(t.dataset.tab === target));
      if (t.dataset.tab === target) t.classList.remove("has-new");
    });
    // 숨겨져 있던 쪽지함은 높이가 0이라 보일 때 맨 아래로 내림
    document.querySelectorAll(".chat-log").forEach(log => (log.scrollTop = log.scrollHeight));
    window.scrollTo(0, 0);
  }

  function showNote(id) {
    noteTabs.forEach(t => {
      const on = t.dataset.note === id;
      t.setAttribute("aria-selected", String(on));
      document.getElementById(t.dataset.note).hidden = !on;
      if (on) t.classList.remove("has-new");
    });
    const log = document.querySelector(`#${id} .chat-log`);
    log.scrollTop = log.scrollHeight;
  }

  document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => {
    location.hash = btn.dataset.tab;
  }));
  noteTabs.forEach(t => t.addEventListener("click", () => showNote(t.dataset.note)));
  addEventListener("hashchange", () => showTab(location.hash.slice(1)));
  if (panels.length) showTab(location.hash.slice(1));

  // 지금 안 보고 있는 쪽지함에 쪽지가 오면 탭에 표시
  document.addEventListener("manito:ping", e => {
    const noteOpen = location.hash === "#note";
    const tab = noteTabs.find(t => t.dataset.note === e.detail);
    if (!noteOpen) navTabs.find(t => t.dataset.tab === "note")?.classList.add("has-new");
    if (tab?.getAttribute("aria-selected") !== "true") tab?.classList.add("has-new");
  });

  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  document.querySelectorAll("[data-today]").forEach(el => {
    el.textContent = `${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
  });

  // 다음 11월 11일까지 남은 날
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let day = new Date(now.getFullYear(), 10, 11);
  if (day < today) day = new Date(now.getFullYear() + 1, 10, 11);
  const left = Math.round((day - today) / 86400000);
  document.querySelectorAll("[data-dday]").forEach(el => {
    el.textContent = left ? `마니또 종료 D-${left}` : "오늘은 마니또 마지막 날! ♡";
  });

  store.getPeople().then(people => {
    document.querySelectorAll("[data-members]").forEach(el => (el.textContent = people.length));
  }).catch(() => {});
})();
