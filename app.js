(function () {
  "use strict";

  const TITLE_HISTORY_KEY = "yarubekikoto_title_history_v1";
  const CONFIRMER_MODE_KEY = "yarubekikoto_confirmer_mode_v1";
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

  const CONFIRMER_PIN_LEN = 4;

  function isValidConfirmerPin(s) {
    return typeof s === "string" && new RegExp(`^[0-9]{${CONFIRMER_PIN_LEN}}$`).test(s);
  }

  function sanitizePinInput(raw) {
    return String(raw || "").replace(/\D/g, "").slice(0, CONFIRMER_PIN_LEN);
  }

  /** @type {{ phase: 'edit'|'setPassword'|'blocked'|'done', confirmPasswordMode: boolean, confirmerSecret: string, tasks: {id:string,title:string}[], titleHistory: string[], confirmations: Record<string,boolean> }} */
  const state = {
    phase: "edit",
    confirmPasswordMode: false,
    confirmerSecret: "",
    tasks: [],
    titleHistory: [],
    confirmations: {},
  };

  function loadConfirmerMode() {
    try {
      const raw = localStorage.getItem(CONFIRMER_MODE_KEY);
      state.confirmPasswordMode = raw === "1";
    } catch (_) {
      state.confirmPasswordMode = false;
    }
  }

  function saveConfirmerMode() {
    try {
      localStorage.setItem(CONFIRMER_MODE_KEY, state.confirmPasswordMode ? "1" : "0");
    } catch (_) {
      /* ignore */
    }
  }

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
    if (state.phase === "setPassword") {
      renderSetPassword();
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
    function syncSubText() {
      sub.textContent = state.confirmPasswordMode
        ? "確認者は次の「パスワードを決める」画面で4桁の数字を決めます。そのあと画面が覆われ、各帯で同じ4桁を入力して解除します。"
        : "完了するまで画面がカラフルなパネルで覆われます。項目をタップするとその帯だけ外れ、下の画面が見えます。";
    }
    syncSubText();

    const modeRow = document.createElement("div");
    modeRow.className = "mode-row";
    const modeLabel = document.createElement("span");
    modeLabel.className = "mode-label";
    modeLabel.textContent = "確認者モード（パスワードで解除）";
    const modeSwitch = document.createElement("button");
    modeSwitch.type = "button";
    modeSwitch.className = "mode-switch";
    modeSwitch.setAttribute("role", "switch");
    modeSwitch.setAttribute("aria-checked", state.confirmPasswordMode ? "true" : "false");
    modeSwitch.setAttribute("aria-label", "確認者モードの切り替え");
    const modeKnob = document.createElement("span");
    modeKnob.className = "mode-switch-knob";
    modeSwitch.appendChild(modeKnob);
    if (state.confirmPasswordMode) modeSwitch.classList.add("is-on");
    modeSwitch.addEventListener("click", () => {
      state.confirmPasswordMode = !state.confirmPasswordMode;
      saveConfirmerMode();
      render();
    });
    modeRow.appendChild(modeLabel);
    modeRow.appendChild(modeSwitch);

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

    function onEnterAdd(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        addBtn.click();
      }
    }
    input.addEventListener("keydown", onEnterAdd);

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
      if (state.confirmPasswordMode) {
        state.confirmerSecret = "";
        state.phase = "setPassword";
        render();
        return;
      }
      state.confirmerSecret = "";
      state.confirmations = {};
      state.tasks.forEach((t) => {
        state.confirmations[t.id] = false;
      });
      state.phase = "blocked";
      render();
    });

    wrap.appendChild(h1);
    wrap.appendChild(sub);
    wrap.appendChild(modeRow);
    wrap.appendChild(input);
    rebuildChips();
    wrap.appendChild(addBtn);
    wrap.appendChild(listWrap);
    wrap.appendChild(startBtn);

    appEl.appendChild(wrap);
  }

  function renderSetPassword() {
    const wrap = document.createElement("div");
    wrap.className = "view-set-password";

    const h1 = document.createElement("h1");
    h1.className = "setpw-heading";
    h1.textContent = "確認者：パスワードを決める";

    const lead = document.createElement("p");
    lead.className = "setpw-lead";
    lead.textContent = "パスワードは4桁の数字です。";

    const sub = document.createElement("p");
    sub.className = "setpw-sub";
    sub.textContent =
      "決めた4桁は、このあと画面が覆われたときに各項目の解除でも同じものを入力します。";

    const err = document.createElement("p");
    err.className = "setpw-err hidden";
    err.setAttribute("aria-live", "polite");

    const pinWrap = document.createElement("div");
    pinWrap.className = "setpw-pin-wrap";
    const pinLabel = document.createElement("label");
    pinLabel.className = "setpw-pin-label";
    pinLabel.setAttribute("for", "confirmer-pin-input");
    pinLabel.textContent = "4桁の数字（半角）";
    const pinInput = document.createElement("input");
    pinInput.id = "confirmer-pin-input";
    pinInput.className = "input setpw-pin-input";
    pinInput.type = "text";
    pinInput.inputMode = "numeric";
    pinInput.pattern = "[0-9]*";
    pinInput.maxLength = CONFIRMER_PIN_LEN;
    pinInput.autocomplete = "off";
    pinInput.placeholder = "例：1234";
    pinInput.value = state.confirmerSecret;
    pinInput.addEventListener("input", () => {
      const next = sanitizePinInput(pinInput.value);
      pinInput.value = next;
      state.confirmerSecret = next;
      err.classList.add("hidden");
    });
    pinWrap.appendChild(pinLabel);
    pinWrap.appendChild(pinInput);

    const goBtn = document.createElement("button");
    goBtn.type = "button";
    goBtn.className = "start-btn";
    goBtn.textContent = "画面を覆る";
    function syncGo() {
      goBtn.disabled = !isValidConfirmerPin(state.confirmerSecret);
    }
    syncGo();

    goBtn.addEventListener("click", () => {
      if (!isValidConfirmerPin(state.confirmerSecret)) {
        err.textContent = "4桁の半角数字を入力してください。";
        err.classList.remove("hidden");
        pinInput.focus();
        return;
      }
      state.confirmations = {};
      state.tasks.forEach((t) => {
        state.confirmations[t.id] = false;
      });
      state.phase = "blocked";
      render();
    });

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "ghost-btn";
    backBtn.textContent = "やるべきことに戻る";
    backBtn.addEventListener("click", () => {
      state.confirmerSecret = "";
      state.phase = "edit";
      render();
    });

    wrap.appendChild(h1);
    wrap.appendChild(lead);
    wrap.appendChild(sub);
    wrap.appendChild(pinWrap);
    wrap.appendChild(err);
    wrap.appendChild(goBtn);
    wrap.appendChild(backBtn);

    appEl.appendChild(wrap);
    pinInput.focus();
  }

  function renderBlocked() {
    const total = state.tasks.length;
    const root = document.createElement("div");
    root.className = "view-blocked";

    if (state.confirmPasswordMode) {
      if (!isValidConfirmerPin(state.confirmerSecret)) {
        state.phase = "setPassword";
        render();
        return;
      }
      const banner = document.createElement("div");
      banner.className = "blocked-confirmer-banner";
      const bannerInner = document.createElement("div");
      bannerInner.className = "blocked-confirmer-banner-inner";
      const line1 = document.createElement("p");
      line1.className = "blocked-confirmer-banner-text";
      line1.textContent = "パスワードは4桁の数字です。";
      const line2 = document.createElement("p");
      line2.className = "blocked-confirmer-banner-text";
      line2.textContent = "確認者は、決めた4桁を各帯の入力欄に入れて解除してください。";
      bannerInner.appendChild(line1);
      bannerInner.appendChild(line2);
      banner.appendChild(bannerInner);
      root.appendChild(banner);
    }

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

      const hit = state.confirmPasswordMode ? document.createElement("div") : document.createElement("button");
      if (!state.confirmPasswordMode) {
        hit.type = "button";
      }
      hit.className = "panel-hit";
      hit.setAttribute(
        "aria-label",
        state.confirmPasswordMode ? `パスワードで解除: ${task.title}` : `完了: ${task.title}`
      );

      const title = document.createElement("p");
      title.className = "panel-title";
      title.textContent = task.title;

      if (state.confirmPasswordMode) {
        hit.classList.add("panel-hit--password");
        const form = document.createElement("div");
        form.className = "panel-password-form";
        const err = document.createElement("p");
        err.className = "panel-password-err hidden";
        err.setAttribute("aria-live", "polite");
        const pwdLbl = document.createElement("label");
        pwdLbl.className = "panel-password-label";
        pwdLbl.textContent = "確認者のパスワード（4桁の数字）";
        const pwdIn = document.createElement("input");
        pwdIn.type = "password";
        pwdIn.className = "panel-password-input";
        pwdIn.id = `confirmer-pwd-${task.id}`;
        pwdIn.inputMode = "numeric";
        pwdIn.maxLength = CONFIRMER_PIN_LEN;
        pwdIn.placeholder = "4桁の数字";
        pwdIn.autocomplete = "off";
        pwdIn.addEventListener("input", () => {
          pwdIn.value = sanitizePinInput(pwdIn.value);
        });
        pwdLbl.setAttribute("for", pwdIn.id);
        const submit = document.createElement("button");
        submit.type = "button";
        submit.className = "panel-password-submit";
        submit.textContent = "解除";

        function tryUnlock() {
          const expected = state.confirmerSecret;
          const got = sanitizePinInput(pwdIn.value);
          if (!isValidConfirmerPin(got) || got !== expected) {
            err.textContent = "4桁の数字が違います";
            err.classList.remove("hidden");
            pwdIn.select();
            return;
          }
          err.classList.add("hidden");
          state.confirmations[task.id] = true;
          const allDone = state.tasks.every((t) => state.confirmations[t.id] === true);
          if (allDone) {
            state.phase = "done";
          }
          render();
        }
        submit.addEventListener("click", (e) => {
          e.stopPropagation();
          tryUnlock();
        });
        pwdIn.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            tryUnlock();
          }
        });
        pwdIn.addEventListener("click", (e) => e.stopPropagation());
        form.appendChild(title);
        form.appendChild(pwdLbl);
        form.appendChild(pwdIn);
        form.appendChild(submit);
        form.appendChild(err);
        hit.appendChild(form);
      } else {
        hit.appendChild(title);
        hit.addEventListener("click", () => {
          state.confirmations[task.id] = true;
          const allDone = state.tasks.every((t) => state.confirmations[t.id] === true);
          if (allDone) {
            state.phase = "done";
          }
          render();
        });
      }

      panel.appendChild(inner);
      panel.appendChild(hit);
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
      state.confirmerSecret = "";
      render();
    });

    inner.appendChild(h2);
    inner.appendChild(body);
    inner.appendChild(back);
    wrap.appendChild(inner);
    appEl.appendChild(wrap);
  }

  loadHistory();
  loadConfirmerMode();
  render();

  window.addEventListener("resize", () => {
    if (state.phase === "blocked" || state.phase === "setPassword") {
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
