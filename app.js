(function () {
  "use strict";

  const TITLE_HISTORY_KEY = "yarubekikoto_title_history_v1";
  const MAX_TITLE_HISTORY = 50;

  const SEGMENT_GRADIENTS = [
    ["#6c5ce7", "#a29bfe"],
    ["#e17055", "#fdcb6e"],
    ["#00b894", "#55efc4"],
    ["#0984e3", "#74b9ff"],
    ["#d63031", "#ff7675"],
    ["#fd79a8", "#e84393"],
    ["#a29bfe", "#6c5ce7"],
    ["#fab1a0", "#ff7675"],
  ];

  function newId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /** @type {{ phase: 'edit'|'blocked'|'done', tasks: {id:string,title:string}[], titleHistory: string[], confirmations: Record<string,boolean> }} */
  const state = {
    phase: "edit",
    tasks: [],
    titleHistory: [],
    confirmations: {},
  };

  const appEl = document.getElementById("app");
  if (!appEl) return;

  function loadHistory() {
    try {
      const raw = localStorage.getItem(TITLE_HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.titleHistory = parsed.filter((x) => typeof x === "string");
      }
    } catch (_) {
      /* ignore */
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(TITLE_HISTORY_KEY, JSON.stringify(state.titleHistory));
    } catch (_) {
      /* ignore */
    }
  }

  function pushTitleHistory(title) {
    state.titleHistory = [title, ...state.titleHistory.filter((t) => t !== title)].slice(
      0,
      MAX_TITLE_HISTORY
    );
    saveHistory();
  }

  function getHistoryChips(draft) {
    const q = draft.trim().toLowerCase();
    if (!q) return state.titleHistory.slice(0, 16);
    return state.titleHistory.filter((t) => t.toLowerCase().includes(q)).slice(0, 16);
  }

  function render() {
    appEl.innerHTML = "";
    if (state.phase === "blocked") {
      renderBlocked();
      return;
    }
    if (state.phase === "done") {
      renderDone();
      return;
    }
    renderEdit();
  }

  function renderEdit() {
    const wrap = document.createElement("div");
    wrap.className = "view-edit";

    const h1 = document.createElement("h1");
    h1.className = "edit-heading";
    h1.textContent = "やるべきこと";

    const sub = document.createElement("p");
    sub.className = "edit-sub";
    sub.textContent =
      "完了するまで画面がカラフルなパネルで覆われます。項目をタップするとその帯だけ外れ、下の画面が見えます。";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input";
    input.placeholder = "やるべきこと（項目）";
    input.autocomplete = "off";

    let historyBlock = null;

    function rebuildChips() {
      const next = getHistoryChips(input.value);
      if (next.length === 0) {
        if (historyBlock) {
          historyBlock.remove();
          historyBlock = null;
        }
        return;
      }
      if (!historyBlock) {
        historyBlock = document.createElement("div");
        historyBlock.className = "history-block";
        const lbl = document.createElement("p");
        lbl.className = "history-label";
        lbl.textContent = "以前入力した項目";
        const row = document.createElement("div");
        row.className = "chip-row";
        row.setAttribute("data-chip-row", "1");
        historyBlock.appendChild(lbl);
        historyBlock.appendChild(row);
        input.insertAdjacentElement("afterend", historyBlock);
      }
      const row = historyBlock.querySelector(".chip-row");
      row.innerHTML = "";
      next.forEach((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = t;
        b.addEventListener("click", () => {
          input.value = t;
          input.dispatchEvent(new Event("input"));
        });
        row.appendChild(b);
      });
    }

    input.addEventListener("input", rebuildChips);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "add-btn";
    addBtn.textContent = "項目を追加";
    addBtn.addEventListener("click", () => {
      const title = input.value.trim();
      if (!title) return;
      state.tasks.push({ id: newId(), title });
      pushTitleHistory(title);
      input.value = "";
      rebuildChips();
      render();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addBtn.click();
      }
    });

    const listWrap = document.createElement("div");
    listWrap.className = "task-list";

    if (state.tasks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "list-empty";
      empty.textContent = "まだ項目がありません。やるべきことを入力して追加してください。";
      listWrap.appendChild(empty);
    } else {
      state.tasks.forEach((t) => {
        const row = document.createElement("div");
        row.className = "list-row";
        const text = document.createElement("div");
        text.className = "list-text";
        text.textContent = t.title;
        const del = document.createElement("button");
        del.type = "button";
        del.className = "delete-btn";
        del.textContent = "削除";
        del.addEventListener("click", () => {
          state.tasks = state.tasks.filter((x) => x.id !== t.id);
          render();
        });
        row.appendChild(text);
        row.appendChild(del);
        listWrap.appendChild(row);
      });
    }

    const startBtn = document.createElement("button");
    startBtn.type = "button";
    startBtn.className = "start-btn";
    startBtn.textContent = "画面を覆って集中する";
    startBtn.disabled = state.tasks.length === 0;
    startBtn.addEventListener("click", () => {
      if (state.tasks.length === 0) return;
      state.confirmations = {};
      state.tasks.forEach((t) => {
        state.confirmations[t.id] = false;
      });
      state.phase = "blocked";
      render();
    });

    wrap.appendChild(h1);
    wrap.appendChild(sub);
    wrap.appendChild(input);
    rebuildChips();
    wrap.appendChild(addBtn);
    wrap.appendChild(listWrap);
    wrap.appendChild(startBtn);

    appEl.appendChild(wrap);
  }

  function renderBlocked() {
    const total = state.tasks.length;
    const root = document.createElement("div");
    root.className = "view-blocked";

    state.tasks.forEach((task, index) => {
      if (state.confirmations[task.id] === true) return;

      const topPct = (index / total) * 100;
      const heightPct = 100 / total;
      const [c0, c1] = SEGMENT_GRADIENTS[index % SEGMENT_GRADIENTS.length];

      const panel = document.createElement("div");
      panel.className = "panel";
      panel.style.top = `${topPct}%`;
      panel.style.height = `${heightPct}%`;

      const inner = document.createElement("div");
      inner.className = "panel-inner";
      inner.style.background = `linear-gradient(135deg, ${c0}, ${c1})`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "panel-hit";
      btn.setAttribute("aria-label", `完了: ${task.title}`);

      const title = document.createElement("p");
      title.className = "panel-title";
      title.textContent = task.title;

      btn.appendChild(title);
      btn.addEventListener("click", () => {
        state.confirmations[task.id] = true;
        const allDone = state.tasks.every((t) => state.confirmations[t.id] === true);
        if (allDone) {
          state.phase = "done";
        }
        render();
      });

      panel.appendChild(inner);
      panel.appendChild(btn);
      root.appendChild(panel);
    });

    appEl.appendChild(root);
  }

  function renderDone() {
    const wrap = document.createElement("div");
    wrap.className = "view-done";
    const inner = document.createElement("div");
    inner.className = "done-inner";

    const h2 = document.createElement("h2");
    h2.className = "done-title";
    h2.textContent = "すべて完了";

    const body = document.createElement("p");
    body.className = "done-body";
    body.textContent = "パネルをすべて外しました。スマホを使って大丈夫です。";

    const back = document.createElement("button");
    back.type = "button";
    back.className = "primary-btn";
    back.textContent = "やるべきことリストに戻る";
    back.addEventListener("click", () => {
      state.phase = "edit";
      state.confirmations = {};
      render();
    });

    inner.appendChild(h2);
    inner.appendChild(body);
    inner.appendChild(back);
    wrap.appendChild(inner);
    appEl.appendChild(wrap);
  }

  loadHistory();
  render();

  window.addEventListener("resize", () => {
    if (state.phase === "blocked") {
      render();
    }
  });
})();

/** PWA: Service Worker + インストールボタン（Chrome 系など） */
(function registerPwa() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const swUrl = new URL("sw.js", document.baseURI).href;
    const scope = new URL("./", document.baseURI).href;
    navigator.serviceWorker.register(swUrl, { scope }).catch(() => {});
  });

  let deferredPrompt = null;
  const banner = document.createElement("div");
  banner.id = "pwa-install-banner";
  banner.hidden = true;
  banner.innerHTML =
    '<button type="button" class="pwa-install-btn">アプリとしてインストール</button>' +
    '<button type="button" class="pwa-install-dismiss" aria-label="閉じる">×</button>';

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.body.appendChild(banner);
    banner.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    banner.remove();
  });

  banner.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".pwa-install-dismiss")) {
      banner.remove();
      return;
    }
    if (target.closest(".pwa-install-btn") && deferredPrompt) {
      const p = deferredPrompt;
      deferredPrompt = null;
      p.prompt();
      p.userChoice.finally(() => banner.remove());
    }
  });
})();
