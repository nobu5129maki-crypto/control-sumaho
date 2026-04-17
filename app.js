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

  /** 数字だけ残す（全角・互換表記は NFKC で半角寄せ） */
  function sanitizePinInput(raw) {
    let s = String(raw || "");
    try {
      s = s.normalize("NFKC");
    } catch (_) {
      /* ignore */
    }
    s = s.replace(/[\uFF10-\uFF19]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
    );
    return s.replace(/\D/g, "").slice(0, CONFIRMER_PIN_LEN);
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
        : "完了するまで画面がカラフルなパネルで覆われます。項目をタップするとその帯だけ消えます。";
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
    pinInput.type = "tel";
    pinInput.inputMode = "numeric";
    pinInput.maxLength = CONFIRMER_PIN_LEN;
    pinInput.autocomplete = "off";
    pinInput.spellcheck = false;
    pinInput.setAttribute("autocapitalize", "none");
    pinInput.setAttribute("autocorrect", "off");
    pinInput.enterKeyHint = "done";
    pinInput.placeholder = "例：1234";
    pinInput.value = state.confirmerSecret;
    let pinComposing = false;
    function applyPinFromField() {
      const next = sanitizePinInput(pinInput.value);
      pinInput.value = next;
      state.confirmerSecret = next;
      syncGo();
      err.classList.add("hidden");
    }
    pinInput.addEventListener("compositionstart", () => {
      pinComposing = true;
    });
    pinInput.addEventListener("compositionend", () => {
      pinComposing = false;
      applyPinFromField();
    });
    pinInput.addEventListener("input", () => {
      if (pinComposing) return;
      applyPinFromField();
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

  /** 完了画面の背景演出（約10種からランダム） */
  function attachDoneCelebration(container) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = document.createElement("canvas");
    canvas.className = "done-fireworks-canvas";
    canvas.setAttribute("aria-hidden", "true");
    container.insertBefore(canvas, container.firstChild);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const PAL = [
      "#ff6b6b",
      "#ffd93d",
      "#6bcb77",
      "#4d96ff",
      "#c77dff",
      "#ff9ff3",
      "#ffa94d",
      "#69db7c",
      "#20c997",
      "#fd7e14",
    ];

    const pattern = Math.floor(Math.random() * 10);

    let W = 0;
    let H = 0;
    const ro = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      W = Math.max(1, Math.floor(r.width));
      H = Math.max(1, Math.floor(r.height));
      canvas.width = W;
      canvas.height = H;
    });
    ro.observe(container);
    {
      const r = container.getBoundingClientRect();
      W = Math.max(1, Math.floor(r.width));
      H = Math.max(1, Math.floor(r.height));
      canvas.width = W;
      canvas.height = H;
    }

    /** @type {{ particles?: any[], confetti?: any[], bubbles?: any[], stars?: any[], hearts?: any[], meteors?: any[], spiral?: number, sparkles?: any[], balloons?: any[], spawn?: number, nextSpawn?: number, wave?: number }} */
    const acc = { particles: [], spawn: 0, nextSpawn: 400 };

    function burst(x, y) {
      const n = 44 + Math.floor(Math.random() * 24);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const sp = 2.2 + Math.random() * 4.2;
        acc.particles.push({
          kind: "dot",
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1,
          decay: 0.01 + Math.random() * 0.012,
          color: PAL[Math.floor(Math.random() * PAL.length)],
          size: 1.5 + Math.random() * 2.2,
        });
      }
    }

    function launchRocket() {
      const x = W * (0.12 + Math.random() * 0.76);
      acc.particles.push({
        kind: "rocket",
        x,
        y: H + 8,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -(9 + Math.random() * 4),
        color: PAL[Math.floor(Math.random() * PAL.length)],
      });
    }

    function initPattern() {
      acc.particles = [];
      acc.spawn = 0;
      acc.nextSpawn = 400;
      acc.wave = 0;
      acc.spiral = 0;
      if (pattern === 1) acc.confetti = [];
      if (pattern === 2) acc.bubbles = [];
      if (pattern === 3) acc.stars = [];
      if (pattern === 4) acc.hearts = [];
      if (pattern === 5) acc.meteors = [];
      if (pattern === 8) acc.sparkles = [];
      if (pattern === 9) acc.balloons = [];
    }

    initPattern();

    let last = 0;

    function ensureArrays() {
      if (pattern === 3 && acc.stars && acc.stars.length === 0 && W > 10 && H > 10) {
        for (let i = 0; i < 48; i++) {
          acc.stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            phase: Math.random() * Math.PI * 2,
            sp: 0.4 + Math.random() * 1.2,
            r: 1 + Math.random() * 2,
          });
        }
      }
      if (pattern === 8 && acc.sparkles && acc.sparkles.length === 0 && W > 10 && H > 10) {
        for (let i = 0; i < 36; i++) {
          acc.sparkles.push({
            x: Math.random() * W,
            y: Math.random() * H,
            phase: Math.random() * Math.PI * 2,
            size: 4 + Math.random() * 8,
            color: PAL[Math.floor(Math.random() * PAL.length)],
          });
        }
      }
    }

    function frame(t) {
      if (!canvas.isConnected) {
        ro.disconnect();
        return;
      }
      const dt = last ? Math.min(48, t - last) : 16;
      last = t;

      ctx.clearRect(0, 0, W, H);
      ensureArrays();

      if (pattern === 0) {
        acc.spawn += dt;
        if (acc.spawn >= acc.nextSpawn) {
          acc.spawn = 0;
          acc.nextSpawn = 650 + Math.random() * 900;
          if (W > 40 && H > 40) launchRocket();
        }
        for (let i = acc.particles.length - 1; i >= 0; i--) {
          const p = acc.particles[i];
          if (p.kind === "rocket") {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.18;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            if (p.vy >= -0.2 || p.y < H * 0.16) {
              burst(p.x, p.y);
              acc.particles.splice(i, 1);
            }
          } else if (p.kind === "dot") {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life -= p.decay;
            if (p.life <= 0) {
              acc.particles.splice(i, 1);
              continue;
            }
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      } else if (pattern === 1) {
        if (W > 20 && Math.random() < 0.08 * (dt / 16)) {
          acc.confetti.push({
            x: Math.random() * W,
            y: -12,
            w: 5 + Math.random() * 6,
            h: 8 + Math.random() * 8,
            vy: 1.5 + Math.random() * 3,
            vx: (Math.random() - 0.5) * 2,
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 0.15,
            color: PAL[Math.floor(Math.random() * PAL.length)],
          });
        }
        for (let i = acc.confetti.length - 1; i >= 0; i--) {
          const c = acc.confetti[i];
          c.x += c.vx;
          c.y += c.vy;
          c.vy += 0.04;
          c.rot += c.vr;
          if (c.y > H + 20) acc.confetti.splice(i, 1);
          else {
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rot);
            ctx.fillStyle = c.color;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
            ctx.restore();
            ctx.globalAlpha = 1;
          }
        }
      } else if (pattern === 2) {
        if (W > 20 && Math.random() < 0.06 * (dt / 16)) {
          acc.bubbles.push({
            x: Math.random() * W,
            y: H + 20,
            r: 12 + Math.random() * 28,
            vy: -(1.2 + Math.random() * 2),
            vx: (Math.random() - 0.5) * 0.8,
            wobble: Math.random() * Math.PI * 2,
            color: PAL[Math.floor(Math.random() * PAL.length)],
          });
        }
        for (let i = acc.bubbles.length - 1; i >= 0; i--) {
          const b = acc.bubbles[i];
          b.wobble += 0.04;
          b.x += b.vx + Math.sin(b.wobble) * 0.4;
          b.y += b.vy;
          if (b.y < -40) acc.bubbles.splice(i, 1);
          else {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.strokeStyle = b.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.45;
            ctx.stroke();
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = b.color;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      } else if (pattern === 3 && acc.stars) {
        const time = t * 0.002;
        for (const s of acc.stars) {
          const a = 0.35 + 0.65 * Math.sin(time * s.sp + s.phase);
          ctx.globalAlpha = a;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (pattern === 4) {
        if (W > 20 && Math.random() < 0.05 * (dt / 16)) {
          acc.hearts.push({
            x: Math.random() * W,
            y: -20,
            vy: 1 + Math.random() * 2,
            vx: (Math.random() - 0.5) * 1.2,
            size: 14 + Math.random() * 18,
            color: PAL[Math.floor(Math.random() * PAL.length)],
          });
        }
        for (let i = acc.hearts.length - 1; i >= 0; i--) {
          const h = acc.hearts[i];
          h.x += h.vx;
          h.y += h.vy;
          if (h.y > H + 30) acc.hearts.splice(i, 1);
          else {
            ctx.font = `${h.size}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = h.color;
            ctx.globalAlpha = 0.75;
            ctx.fillText("♥", h.x, h.y);
            ctx.globalAlpha = 1;
          }
        }
      } else if (pattern === 5) {
        if (W > 40 && Math.random() < 0.04 * (dt / 16)) {
          acc.meteors.push({
            x: W + 40,
            y: Math.random() * H * 0.5,
            vx: -(8 + Math.random() * 10),
            vy: 3 + Math.random() * 5,
            len: 40 + Math.random() * 50,
            alpha: 0.7,
          });
        }
        for (let i = acc.meteors.length - 1; i >= 0; i--) {
          const m = acc.meteors[i];
          m.x += m.vx * (dt / 16);
          m.y += m.vy * (dt / 16);
          if (m.x < -80) acc.meteors.splice(i, 1);
          else {
            const ang = Math.atan2(m.vy, m.vx);
            const x2 = m.x - Math.cos(ang) * m.len;
            const y2 = m.y - Math.sin(ang) * m.len;
            const g = ctx.createLinearGradient(m.x, m.y, x2, y2);
            g.addColorStop(0, "rgba(255,255,255,0.95)");
            g.addColorStop(0.3, "rgba(200,220,255,0.6)");
            g.addColorStop(1, "rgba(100,150,255,0)");
            ctx.strokeStyle = g;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }
      } else if (pattern === 6) {
        acc.spiral = (acc.spiral || 0) + 0.045 * (dt / 16);
        const cx = W * 0.5;
        const cy = H * 0.45;
        for (let k = 0; k < 3; k++) {
          const a = acc.spiral + (k * Math.PI * 2) / 3;
          const dist = 40 + ((t * 0.05 + k * 40) % (Math.min(W, H) * 0.35));
          const x = cx + Math.cos(a) * dist;
          const y = cy + Math.sin(a) * dist * 0.6;
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = PAL[(Math.floor(t / 50) + k) % PAL.length];
          ctx.globalAlpha = 0.85;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (Math.random() < 0.2) {
          const a = Math.random() * Math.PI * 2;
          const sp = 2 + Math.random() * 3;
          acc.particles.push({
            kind: "dot",
            x: cx,
            y: cy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 1,
            decay: 0.015,
            color: PAL[Math.floor(Math.random() * PAL.length)],
            size: 2 + Math.random() * 2,
          });
        }
        for (let i = acc.particles.length - 1; i >= 0; i--) {
          const p = acc.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= p.decay;
          if (p.life <= 0) acc.particles.splice(i, 1);
          else {
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      } else if (pattern === 7) {
        acc.wave = (acc.wave || 0) + 0.002 * dt;
        const lines = 5;
        for (let L = 0; L < lines; L++) {
          const yBase = (H / (lines + 1)) * (L + 1);
          ctx.beginPath();
          ctx.moveTo(0, yBase);
          for (let x = 0; x <= W; x += 6) {
            const y = yBase + Math.sin(x * 0.015 + acc.wave + L) * (12 + L * 4);
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = PAL[L % PAL.length];
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (pattern === 8 && acc.sparkles) {
        const time = t * 0.003;
        for (const s of acc.sparkles) {
          const a = 0.2 + 0.8 * Math.sin(time * 2 + s.phase);
          ctx.globalAlpha = a;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 2;
          const z = s.size;
          ctx.beginPath();
          ctx.moveTo(s.x - z, s.y);
          ctx.lineTo(s.x + z, s.y);
          ctx.moveTo(s.x, s.y - z);
          ctx.lineTo(s.x, s.y + z);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (pattern === 9) {
        if (W > 20 && Math.random() < 0.035 * (dt / 16)) {
          acc.balloons.push({
            x: Math.random() * W,
            y: H + 30,
            r: 14 + Math.random() * 16,
            vy: -(1.5 + Math.random() * 2),
            vx: (Math.random() - 0.5) * 0.6,
            color: PAL[Math.floor(Math.random() * PAL.length)],
          });
        }
        for (let i = acc.balloons.length - 1; i >= 0; i--) {
          const b = acc.balloons[i];
          b.x += b.vx;
          b.y += b.vy;
          if (b.y < -50) acc.balloons.splice(i, 1);
          else {
            ctx.beginPath();
            ctx.ellipse(b.x, b.y, b.r * 0.85, b.r, 0, 0, Math.PI * 2);
            ctx.fillStyle = b.color;
            ctx.globalAlpha = 0.55;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y + b.r);
            ctx.lineTo(b.x - 4, b.y + b.r + 22);
            ctx.strokeStyle = "rgba(0,0,0,0.25)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
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
    body.textContent = "お疲れ様でした。スマホを使って少し休憩しましょう。";

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
    attachDoneCelebration(wrap);
  }

  loadHistory();
  loadConfirmerMode();
  render();

  let lastLayoutWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (state.phase !== "blocked") return;
    const w = window.innerWidth;
    if (w === lastLayoutWidth) return;
    lastLayoutWidth = w;
    render();
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
