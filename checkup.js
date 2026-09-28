"use strict";

/**
 * 查岗 · UI（案卷台 + 取证 + AI 生成 + 密谈结案回写）
 */
(function () {
  const ASSET_V = "351";
  const K_STORE = "CHECKUP_CASES_V1";
  const REASONS = [
    { id: "jealous", label: "吃醋" },
    { id: "doubt", label: "怀疑" },
    { id: "routine", label: "例行" },
    { id: "plot", label: "剧情需要" },
    { id: "custom", label: "自定义" }
  ];
  const INTENSITIES = [
    { id: "low", label: "低", catchBase: 0.08 },
    { id: "mid", label: "中", catchBase: 0.22 },
    { id: "high", label: "高", catchBase: 0.42 }
  ];
  const INTENSITY_FORM = [...INTENSITIES, { id: "random", label: "随机" }];
  const DIRECTIONS = [
    { id: "forward", label: "我查 TA" },
    { id: "reverse", label: "TA 查我" }
  ];

  const GEN_MODULES = [
    { id: "overview", label: "设备总览" },
    { id: "chats", label: "聊天" },
    { id: "calls", label: "通话记录" },
    { id: "notes", label: "备忘录" },
    { id: "web", label: "浏览搜索" },
    { id: "secrets", label: "秘密空间" },
    { id: "shop", label: "购物外卖" },
    { id: "album", label: "相册" }
  ];

  const APPS = [
    { id: "chats", label: "聊天", icon: "ph-chats-circle", kicker: "Chats", hint: "TA 的联系人 · 可代发" },
    { id: "calls", label: "通话", icon: "ph-phone", kicker: "Calls", hint: "来电 · 去电 · 未接" },
    { id: "notes", label: "备忘录", icon: "ph-note-pencil", kicker: "Notes", hint: "文字 · 录音" },
    { id: "web", label: "浏览搜索", icon: "ph-globe", kicker: "Web", hint: "搜索与网页记录" },
    { id: "secrets", label: "秘密空间", icon: "ph-lock-key", kicker: "Secrets", hint: "草稿 · 收藏 · 心愿" },
    { id: "shop", label: "购物外卖", icon: "ph-shopping-bag", kicker: "Shop", hint: "订单 · 购物车 · 外卖" },
    { id: "album", label: "相册", icon: "ph-images", kicker: "Album", hint: "未发送的照片" }
  ];

  const screen = document.getElementById("checkup-screen");
  const viewHub = document.getElementById("checkup-view-hub");
  const viewPhone = document.getElementById("checkup-view-phone");
  const viewReverse = document.getElementById("checkup-view-reverse");
  const viewApp = document.getElementById("checkup-view-app");
  const caseListEl = document.getElementById("checkup-case-list");
  const hubEmptyEl = document.getElementById("checkup-hub-empty");
  const phoneAppsEl = document.getElementById("checkup-phone-apps");
  const evidenceChipsEl = document.getElementById("checkup-evidence-chips");
  const evidenceCountEl = document.getElementById("checkup-evidence-count");
  const questionInput = document.getElementById("checkup-question-input");
  const appBodyEl = document.getElementById("checkup-app-body");
  const appTitleEl = document.getElementById("checkup-app-title");
  const starBtn = document.getElementById("checkup-star-btn");
  const finishBodyEl = document.getElementById("checkup-finish-body");

  let cases = [];
  let activeCaseId = null;
  let activeAppId = null;
  let activeChatThreadId = null;
  let activeWebItemId = null;
  let formReason = "doubt";
  let formIntensity = "mid";
  let formDirection = "forward";
  let genBusy = false;

  function loadCss() {
    if (document.getElementById("xxj-checkup-css")) return;
    const link = document.createElement("link");
    link.id = "xxj-checkup-css";
    link.rel = "stylesheet";
    link.href = "checkup.css?v=" + ASSET_V;
    document.head.appendChild(link);
  }

  function toast(msg) {
    if (typeof showToast === "function") showToast(msg);
  }

  function readStore() {
    const D = window.XXJ_DB;
    if (!D) return [];
    const raw = D.getKv(K_STORE);
    return Array.isArray(raw) ? raw : [];
  }

  function writeStore() {
    const D = window.XXJ_DB;
    if (!D) return;
    D.setKv(K_STORE, cases);
  }

  function caseReasonLabel(c) {
    if (!c) return "—";
    if (c.reason === "custom") {
      const text = String(c.reasonCustom || "").trim();
      return text || "自定义";
    }
    return REASONS.find((r) => r.id === c.reason)?.label || "—";
  }

  function intensityLabel(id) {
    return INTENSITIES.find((r) => r.id === id)?.label || "—";
  }

  function resolveFormIntensity(formId) {
    if (formId === "random") {
      const pool = INTENSITIES;
      return pool[Math.floor(Math.random() * pool.length)].id;
    }
    return formId;
  }

  function activeCase() {
    return cases.find((c) => c.id === activeCaseId) || null;
  }

  function listDmThreads() {
    if (typeof readChatInboxStore !== "function" || typeof getActiveMaskIdForInbox !== "function") {
      return [];
    }
    const maskId = getActiveMaskIdForInbox();
    if (!maskId) return [];
    const inbox = readChatInboxStore();
    const key = typeof maskBucketKey === "function" ? maskBucketKey(maskId) : maskId;
    const bucket = inbox?.byMask?.[key];
    const threads = Array.isArray(bucket?.threads) ? bucket.threads : [];
    return threads.filter((t) => t && String(t.kind || "dm") !== "group" && String(t.charId || "").trim());
  }

  function resolvePersonaName(charId, thread) {
    if (typeof getThreadCharDisplayAlias === "function" && thread) {
      const alias = String(getThreadCharDisplayAlias(thread) || "").trim();
      if (alias) return alias.slice(0, 32);
    }
    if (typeof readCharPersonaStore === "function") {
      const st = readCharPersonaStore();
      const items = Array.isArray(st?.items) ? st.items : [];
      const ch = items.find((x) => x && String(x.id || "") === String(charId || ""));
      return String(ch?.name || ch?.displayName || "未命名").trim() || "未命名";
    }
    return "未命名";
  }

  /** 密谈显示名：角色名；有备注时加（备注），不用场景 */
  function resolveThreadLabel(thread) {
    const cid = String(thread?.charId || "").trim();
    const nm = resolvePersonaName(cid, thread);
    const remark = thread && String(thread.charThreadRemarkName || "").trim();
    if (remark) return `${nm}（${remark.slice(0, 10)}）`;
    return nm;
  }

  function caseThreadLabel(c) {
    const th = listDmThreads().find((t) => String(t.id) === String(c?.threadId || ""));
    if (th) return resolveThreadLabel(th);
    return String(c?.threadLabel || "").trim();
  }

  function resolveCharAvatar(charId) {
    if (typeof readCharPersonaStore !== "function") return "";
    const st = readCharPersonaStore();
    const items = Array.isArray(st?.items) ? st.items : [];
    const ch = items.find((x) => x && String(x.id || "") === String(charId || ""));
    return typeof ch?.avatar === "string" ? ch.avatar : "";
  }

  function formatCaseTime(at) {
    if (!at) return "";
    const d = new Date(Number(at));
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function charInitial(name) {
    const s = String(name || "").trim();
    return s ? s.slice(0, 1) : "?";
  }

  function openSheet(id) {
    const root = document.getElementById(id);
    if (!root) return;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => root.classList.add("is-open"));
  }

  function closeSheet(id) {
    const root = document.getElementById(id);
    if (!root) return;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      root.hidden = true;
    }, 180);
  }

  function showView(name) {
    viewHub.hidden = name !== "hub";
    viewPhone.hidden = name !== "phone";
    if (viewReverse) viewReverse.hidden = name !== "reverse";
    viewApp.hidden = name !== "app";
  }

  function isReverseCase(c) {
    return window.XXJ_CheckupReverse?.isReverseCase?.(c) === true;
  }

  function deleteCase(caseId) {
    const id = String(caseId || "").trim();
    if (!id) return;
    if (!window.confirm("删除这条案卷记录？此操作不可恢复。")) return;
    window.XXJ_CheckupReverse?.stopAutoplay?.();
    window.XXJ_CheckupReverse?.syncMinimizedPill?.(null);
    cases = cases.filter((c) => c.id !== id);
    if (activeCaseId === id) {
      activeCaseId = null;
      activeAppId = null;
      activeChatThreadId = null;
      activeWebItemId = null;
    }
    writeStore();
    renderCaseList();
    toast("已删除案卷");
  }

  function renderCaseList() {
    if (!caseListEl) return;
    caseListEl.replaceChildren();
    const open = cases.filter((c) => c.status === "open");
    const done = cases.filter((c) => c.status === "done");
    const ordered = [...open, ...done].sort((a, b) => Number(b.updatedAt || b.createdAt) - Number(a.updatedAt || a.createdAt));
    if (!ordered.length) {
      hubEmptyEl.hidden = false;
      return;
    }
    hubEmptyEl.hidden = true;
    ordered.forEach((c, i) => {
      const isOpen = c.status === "open";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "checkup-feed-item" + (isOpen ? "" : " is-done");
      btn.dataset.caseId = c.id;
      const idx = document.createElement("span");
      idx.className = "checkup-feed-idx";
      idx.textContent = String(i + 1).padStart(2, "0");
      idx.setAttribute("aria-hidden", "true");
      const thumb = document.createElement("span");
      thumb.className = "checkup-feed-thumb";
      const url = String(c.charAvatar || "").trim();
      if (url) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        img.loading = "lazy";
        thumb.appendChild(img);
      } else {
        const ph = document.createElement("span");
        ph.className = "checkup-feed-ph";
        ph.textContent = charInitial(c.charName);
        thumb.appendChild(ph);
      }
      const copy = document.createElement("span");
      copy.className = "checkup-feed-copy";
      const threadLab = caseThreadLabel(c);
      const charName = c.charName || "未命名";
      const title = document.createElement("span");
      title.className = "checkup-feed-title";
      title.textContent = threadLab && threadLab !== charName ? threadLab : charName;
      const sub = document.createElement("span");
      sub.className = "checkup-feed-sub";
      const evCount = Array.isArray(c.evidence) ? c.evidence.length : 0;
      const head =
        threadLab && threadLab !== charName ? `${charName} · ` : "";
      const dirLab = isReverseCase(c) ? "TA查我" : "我查TA";
      sub.textContent = `${dirLab} · ${head}${caseReasonLabel(c)} · ${isReverseCase(c) ? "旁观" : intensityLabel(c.intensity)}${evCount ? ` · ${evCount} 证据` : ""}`;
      copy.append(title, sub);
      const date = document.createElement("span");
      date.className = "checkup-feed-date";
      date.textContent = isOpen ? "进行中" : isReverseCase(c) ? "已结案" : c.caught ? "被发现" : "已结案";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "checkup-feed-del";
      del.setAttribute("aria-label", "删除案卷");
      del.innerHTML = '<i class="ph ph-trash" aria-hidden="true"></i>';
      del.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        deleteCase(c.id);
      });
      btn.append(idx, thumb, copy, date, del);
      btn.addEventListener("click", () => openCasePhone(c.id));
      caseListEl.appendChild(btn);
    });
  }

  function buildChipRow(container, options, activeId, onPick) {
    if (!container) return;
    container.replaceChildren();
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "checkup-chip" + (opt.id === activeId ? " is-active" : "");
      b.textContent = opt.label;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", opt.id === activeId ? "true" : "false");
      b.addEventListener("click", () => onPick(opt.id));
      container.appendChild(b);
    }
  }

  function syncNewCaseForm() {
    buildChipRow(document.getElementById("checkup-form-direction"), DIRECTIONS, formDirection, (id) => {
      formDirection = id;
      syncNewCaseForm();
    });
    buildChipRow(document.getElementById("checkup-form-reason"), REASONS, formReason, (id) => {
      formReason = id;
      syncNewCaseForm();
    });
    const customWrap = document.getElementById("checkup-form-reason-custom-wrap");
    if (customWrap) customWrap.hidden = formReason !== "custom";
    const intenWrap = document.getElementById("checkup-form-intensity-wrap");
    const intenHint = document.getElementById("checkup-form-intensity-hint");
    const isRev = formDirection === "reverse";
    if (intenWrap) intenWrap.hidden = isRev;
    if (intenHint && isRev) intenHint.textContent = "反向查岗无需强度";
    buildChipRow(document.getElementById("checkup-form-intensity"), INTENSITY_FORM, formIntensity, (id) => {
      formIntensity = id;
      syncNewCaseForm();
    });
    const sel = document.getElementById("checkup-form-char");
    if (!sel) return;
    const prev = String(sel.value || "");
    sel.replaceChildren();
    const threads = listDmThreads();
    if (!threads.length) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "暂无单聊卷宗";
      sel.appendChild(o);
      return;
    }
    for (const t of threads) {
      const cid = String(t.charId || "").trim();
      const o = document.createElement("option");
      o.value = `${t.id}::${cid}`;
      o.textContent = resolveThreadLabel(t);
      sel.appendChild(o);
    }
    if (prev && Array.from(sel.options).some((o) => o.value === prev)) sel.value = prev;
  }

  function openNewCaseSheet() {
    syncNewCaseForm();
    openSheet("checkup-sheet-new");
  }

  function closeNewCaseSheet() {
    closeSheet("checkup-sheet-new");
  }

  function hasOpenReverseCase() {
    return cases.some((c) => c.status === "open" && isReverseCase(c));
  }

  function createProactiveReverseCase(p) {
    const threadId = String(p?.threadId || "").trim();
    const charId = String(p?.charId || "").trim();
    if (!threadId || !charId) return null;
    if (hasOpenReverseCase()) return null;
    const th = listDmThreads().find((t) => String(t.id) === threadId);
    const now = Date.now();
    const reasonPool = ["jealous", "doubt", "routine", "plot"];
    const reason = reasonPool[Math.floor(Math.random() * reasonPool.length)];
    const c = {
      id: `case_${now}`,
      direction: "reverse",
      threadId,
      charId,
      charName: String(p?.charName || resolvePersonaName(charId, th) || "Ta"),
      threadLabel: resolveThreadLabel(th),
      charAvatar: String(p?.charAvatar || resolveCharAvatar(charId) || ""),
      maskId: typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "",
      reason,
      reasonCustom: "",
      intensity: "mid",
      timerMinutes: 0,
      timerEndsAt: 0,
      status: "open",
      createdAt: now,
      updatedAt: now,
      evidence: [],
      question: "",
      viewedApps: [],
      caught: null,
      proactive: true
    };
    cases.unshift(c);
    activeCaseId = c.id;
    writeStore();
    return c.id;
  }

  function startCaseFromForm() {
    const sel = document.getElementById("checkup-form-char");
    if (!sel || !(sel instanceof HTMLSelectElement)) return;
    const raw = String(sel.value || "").trim();
    if (!raw) {
      toast("请先选择对象");
      return;
    }
    const [threadId, charId] = raw.split("::");
    const th = listDmThreads().find((t) => String(t.id) === threadId);
    const now = Date.now();
    let reasonCustom = "";
    if (formReason === "custom") {
      const customInput = document.getElementById("checkup-form-reason-custom");
      reasonCustom = String(customInput?.value || "").trim();
      if (!reasonCustom) {
        toast("请填写自定义理由");
        return;
      }
    }
    const direction = formDirection === "reverse" ? "reverse" : "forward";
    const intensity = direction === "reverse" ? "mid" : resolveFormIntensity(formIntensity);
    const c = {
      id: `case_${now}`,
      direction,
      threadId: String(threadId || ""),
      charId: String(charId || ""),
      charName: resolvePersonaName(charId, th),
      threadLabel: resolveThreadLabel(th),
      charAvatar: resolveCharAvatar(charId),
      maskId: typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "",
      reason: formReason,
      reasonCustom,
      intensity,
      timerMinutes: 0,
      timerEndsAt: 0,
      status: "open",
      createdAt: now,
      updatedAt: now,
      evidence: [],
      question: "",
      viewedApps: [],
      caught: null
    };
    cases.unshift(c);
    writeStore();
    closeNewCaseSheet();
    renderCaseList();
    if (direction === "reverse") {
      window.XXJ_CheckupReverse?.openReverseCase?.(c.id);
      toast("反向查岗已开始");
    } else {
      openCasePhone(c.id);
      toast(formIntensity === "random" ? `查岗已开始 · 强度 ${intensityLabel(intensity)}` : "查岗已开始");
    }
  }

  function normalizeViewedAppId(id) {
    if (id === "search" || id === "browser") return "web";
    if (id === "rank") return "secrets";
    return id;
  }

  function migrateCaseLegacyAppIds(c) {
    if (!c || typeof c !== "object") return;
    if (c.demo?.rank) {
      delete c.demo.rank;
    }
    if (c.demoSources?.rank) {
      if (!c.demoSources.secrets) c.demoSources.secrets = c.demoSources.rank;
      delete c.demoSources.rank;
    }
    if (Array.isArray(c.viewedApps)) {
      c.viewedApps = c.viewedApps.map((id) => (id === "rank" ? "secrets" : id));
    }
    if (Array.isArray(c.evidence)) {
      for (const e of c.evidence) {
        if (e?.appId === "rank") {
          e.appId = "secrets";
          if (!e.label || e.label === "使用排行") e.label = "秘密空间";
        }
      }
    }
  }

  function migrateAllCasesLegacyAppIds() {
    let changed = false;
    for (const c of cases) {
      const before = JSON.stringify({
        rank: c.demo?.rank,
        sources: c.demoSources?.rank,
        viewed: c.viewedApps,
        evidence: c.evidence
      });
      migrateCaseLegacyAppIds(c);
      const after = JSON.stringify({
        rank: c.demo?.rank,
        sources: c.demoSources?.rank,
        viewed: c.viewedApps,
        evidence: c.evidence
      });
      if (before !== after) changed = true;
    }
    if (changed) writeStore();
  }

  function countViewedApps(c) {
    const viewed = Array.isArray(c?.viewedApps) ? c.viewedApps : [];
    const seen = new Set();
    for (const raw of viewed) {
      const id = normalizeViewedAppId(raw);
      if (id === "overview" || !APPS.some((a) => a.id === id) || seen.has(id)) continue;
      seen.add(id);
    }
    return seen.size;
  }

  function syncDeviceGlance(c) {
    const data = resolveAppPayload(c, "overview");
    const unlock = document.getElementById("checkup-device-unlock");
    const battery = document.getElementById("checkup-device-battery");
    const screen = document.getElementById("checkup-device-screen");
    const apps = document.getElementById("checkup-device-apps");
    if (unlock) unlock.textContent = data.unlock || "—";
    if (battery) battery.textContent = data.battery || "—";
    if (screen) screen.textContent = data.screen || "—";
    if (apps) apps.textContent = (data.topApps || []).join(" · ") || "—";
  }

  function sourcePreview(c, appId) {
    const app = APPS.find((a) => a.id === appId);
    const hint = app?.hint || "";
    const data = resolveAppPayload(c, appId);
    if (appId === "chats") {
      const n = (data.threads || []).length;
      if (!n) return hint;
      const th = data.threads[0];
      const preview = th.preview || (th.messages || [])[0]?.text || "";
      return `${n} 个对话 · ${preview.slice(0, 24)}`;
    }
    if (appId === "calls") {
      const items = data.items || [];
      const missed = items.filter((x) => x.type === "missed").length;
      const first = items[0];
      if (!first) return hint;
      const tag = missed ? `${missed} 通未接 · ` : "";
      return `${tag}${first.peer || "—"}`.slice(0, 32);
    }
    if (appId === "web") {
      const items = data.items || [];
      if (!items.length) return hint;
      const it = items[0];
      const preview = it.kind === "search" ? it.q : it.preview || it.title || "";
      return `${items.length} 条 · ${String(preview).slice(0, 22)}`;
    }
    if (appId === "secrets") {
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const first = entries[0];
      if (!first) return hint;
      const title = String(first.title || "").trim();
      const body = String(first.body || "")
        .split("\n")
        .find((x) => x.trim()) || "";
      const preview = title || body.replace(/^•\s*/, "");
      return `${entries.length} 条 · ${preview.slice(0, 22)}`;
    }
    if (appId === "notes") {
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const voiceN = entries.filter((e) => e.type === "voice").length;
      const first = entries[0];
      if (first?.type === "voice") {
        return `${voiceN ? voiceN + " 条录音 · " : ""}${(first.transcript || first.label || "").slice(0, 24)}`;
      }
      const line = String(first?.body || data.body || "")
        .split("\n")
        .find((x) => x.trim()) || "";
      return `${voiceN ? voiceN + " 条录音 · " : ""}${line.replace(/^•\s*/, "").slice(0, 24)}` || hint;
    }
    if (appId === "shop") {
      const item = (data.items || [])[0];
      if (!item) return hint;
      const price = item.price ? `${item.price} · ` : "";
      return `${price}${item.title || ""}`.slice(0, 32);
    }
    if (appId === "album") {
      const photos = Array.isArray(data.photos) ? data.photos : [];
      if (!photos.length) return hint;
      return `${photos.length} 张 · ${String(photos[0].caption || "").slice(0, 22)}`;
    }
    return hint;
  }

  function makeTileApp(app, c, viewed, index) {
    const src = appContentSource(c, app.id);
    const starred = (Array.isArray(c.evidence) ? c.evidence : []).some((e) => e.appId === app.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "checkup-app-row" +
      (viewed.has(app.id) ? " is-seen" : "") +
      (starred ? " is-starred" : "") +
      (src === "ai" ? " is-ai" : "");
    btn.dataset.appId = app.id;
    const idx = document.createElement("span");
    idx.className = "checkup-app-row-idx";
    idx.textContent = String(Number(index) + 1).padStart(2, "0");
    idx.setAttribute("aria-hidden", "true");
    const ico = document.createElement("span");
    ico.className = "checkup-app-row-ico";
    const i = document.createElement("i");
    i.className = `ph ${app.icon}`;
    i.setAttribute("aria-hidden", "true");
    ico.appendChild(i);
    const body = document.createElement("span");
    body.className = "checkup-app-row-body";
    const label = document.createElement("span");
    label.className = "checkup-app-row-label";
    label.textContent = app.label;
    const hint = document.createElement("span");
    hint.className = "checkup-app-row-hint";
    const prev = sourcePreview(c, app.id) || app.hint || "";
    hint.textContent = src === "ai" ? prev : app.hint || "尚未生成";
    body.append(label, hint);
    const arrow = document.createElement("i");
    arrow.className = "ph ph-caret-right checkup-app-row-arrow";
    arrow.setAttribute("aria-hidden", "true");
    btn.append(idx, ico, body, arrow);
    btn.addEventListener("click", () => openApp(app.id));
    return btn;
  }

  function renderPhoneApps() {
    if (!phoneAppsEl) return;
    phoneAppsEl.replaceChildren();
    const c = activeCase();
    if (!c) return;
    const viewed = new Set((Array.isArray(c.viewedApps) ? c.viewedApps : []).map(normalizeViewedAppId));
    for (let i = 0; i < APPS.length; i++) {
      phoneAppsEl.appendChild(makeTileApp(APPS[i], c, viewed, i));
    }
  }

  function isStaleWebDemo(payload) {
    const items = payload?.items;
    if (!Array.isArray(items) || !items.length) return true;
    return items.some((it) => !it?.id || !it?.kind || !String(it.content || "").trim());
  }

  function isStaleChatsDemo(payload) {
    const threads = payload?.threads;
    if (!Array.isArray(threads) || !threads.length) return true;
    return threads.some((th) => !th?.id);
  }

  function isStaleNotesDemo(payload) {
    if (!payload) return true;
    return !(Array.isArray(payload.entries) && payload.entries.length);
  }

  function emptyAppPayload(appId) {
    switch (appId) {
      case "overview":
        return { unlock: "", battery: "", screen: "", topApps: [] };
      case "chats":
        return { threads: [] };
      case "calls":
        return { items: [] };
      case "notes":
        return { title: "备忘录", entries: [] };
      case "web":
        return { items: [] };
      case "secrets":
        return { entries: [] };
      case "shop":
        return { items: [] };
      case "album":
        return { photos: [], caption: "" };
      default:
        return {};
    }
  }

  function renderEmptyPanel(panel, text) {
    const p = document.createElement("p");
    p.className = "checkup-empty";
    p.textContent = text || "尚无内容";
    panel.appendChild(p);
  }

  function renderNotesEntries(panel, data) {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    for (const entry of entries) {
      const block = document.createElement("article");
      block.className = "checkup-note-entry";
      const head = document.createElement("header");
      head.className = "checkup-note-entry-head";
      const lab = document.createElement("span");
      lab.textContent = entry.type === "voice" ? "录音" : "文字";
      const time = document.createElement("span");
      time.className = "checkup-search-hint";
      time.textContent = entry.at || "";
      head.append(lab, time);
      block.appendChild(head);
      if (entry.type === "voice") {
        const voice = document.createElement("div");
        voice.className = "checkup-voice-memo";
        const play = document.createElement("button");
        play.type = "button";
        play.className = "checkup-voice-play";
        play.innerHTML = '<i class="ph ph-play" aria-hidden="true"></i>';
        play.setAttribute("aria-label", "播放录音");
        play.addEventListener("click", () => toast("暂无音频文件"));
        const meta = document.createElement("span");
        meta.className = "checkup-voice-meta";
        const wave = document.createElement("span");
        wave.className = "checkup-voice-wave";
        wave.setAttribute("aria-hidden", "true");
        wave.textContent = "▁▂▃▅▃▂▁▅▃▂▁▃▅▂";
        const dur = document.createElement("span");
        dur.className = "checkup-voice-dur";
        dur.textContent = entry.duration || "0:00";
        meta.append(wave, dur);
        const title = document.createElement("span");
        title.className = "checkup-voice-label";
        title.textContent = entry.label || "语音备忘";
        voice.append(play, meta, title);
        block.appendChild(voice);
        if (entry.transcript) {
          const tx = document.createElement("p");
          tx.className = "checkup-voice-transcript";
          setCheckupInlineTransEl(tx, entry.transcript, entry.translation);
          block.appendChild(tx);
        }
        if (entry.inner) {
          const inner = document.createElement("blockquote");
          inner.className = "checkup-voice-inner";
          const k = document.createElement("span");
          k.className = "checkup-voice-k";
          k.textContent = "录的时候在想";
          const t = document.createElement("p");
          t.textContent = entry.inner;
          inner.append(k, t);
          block.appendChild(inner);
        }
      } else {
        const p = document.createElement("p");
        p.className = "checkup-note-body";
        setCheckupInlineTransEl(p, entry.body, entry.translation);
        block.appendChild(p);
      }
      panel.appendChild(block);
    }
  }

  function findWebItem(data, itemId) {
    const items = Array.isArray(data?.items) ? data.items : [];
    let it = items.find((x) => x.id === itemId);
    if (!it) {
      const m = String(itemId || "").match(/^(?:web|br)_(\d+)$/);
      if (m) {
        const idx = Number(m[1]);
        if (idx >= 0 && idx < items.length) it = items[idx];
      }
    }
    return it || null;
  }

  function findChatThread(data, threadId) {
    const threads = Array.isArray(data?.threads) ? data.threads : [];
    let th = threads.find((x) => x.id === threadId);
    if (!th) {
      const m = String(threadId || "").match(/^chat_(\d+)$/);
      if (m) {
        const idx = Number(m[1]);
        if (idx >= 0 && idx < threads.length) th = threads[idx];
      }
    }
    return th || null;
  }

  function callTypeLabel(type) {
    if (type === "missed") return "未接";
    if (type === "out") return "去电";
    return "来电";
  }

  function renderCallsList(parent, items) {
    const list = document.createElement("div");
    list.className = "checkup-call-list";
    list.setAttribute("role", "list");
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const row = document.createElement("div");
      row.className = "checkup-call-row checkup-call-row--" + (it.type || "in");
      row.setAttribute("role", "listitem");
      const ico = document.createElement("span");
      ico.className = "checkup-call-ico";
      const icon =
        it.type === "missed"
          ? "ph-phone-x"
          : it.type === "out"
            ? "ph-phone-outgoing"
            : "ph-phone-incoming";
      ico.innerHTML = `<i class="ph ${icon}" aria-hidden="true"></i>`;
      const body = document.createElement("span");
      body.className = "checkup-call-body";
      const top = document.createElement("span");
      top.className = "checkup-call-top";
      const name = document.createElement("span");
      name.className = "checkup-call-name";
      name.textContent = it.peer || "—";
      const time = document.createElement("span");
      time.className = "checkup-thread-time";
      time.textContent = it.at || "";
      top.append(name, time);
      const sub = document.createElement("span");
      sub.className = "checkup-call-sub";
      const bits = [callTypeLabel(it.type)];
      if (it.duration) bits.push(it.duration);
      if (it.number) bits.push(it.number);
      if (it.note) bits.push(it.note);
      sub.textContent = bits.join(" · ");
      body.append(top, sub);
      row.append(ico, body);
      list.appendChild(row);
    }
    parent.appendChild(list);
  }

  function appContentSource(c, appId) {
    if (!c) return "";
    return String(c.demoSources?.[appId] || "").trim();
  }

  function genModuleLabel(appId) {
    return GEN_MODULES.find((m) => m.id === appId)?.label || APPS.find((a) => a.id === appId)?.label || appId;
  }

  function readAiCompletionText(data) {
    const fn = window.__XXJ_GROUP_CHAT_DEPS?.readChatCompletionChoiceText;
    if (typeof fn === "function") return String(fn(data) || "").trim();
    const ch = data?.choices?.[0];
    const c = ch?.message?.content;
    return typeof c === "string" ? c.trim() : "";
  }

  function parseAiJsonObject(text) {
    let s = String(text || "").trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("未找到 JSON 对象");
    s = s.slice(start, end + 1);
    try {
      return JSON.parse(s);
    } catch {
      throw new Error("JSON 解析失败（可能被截断或含非法字符）");
    }
  }

  function maybeWarnCompletionTruncated(data, label) {
    const r = String(data?.choices?.[0]?.finish_reason ?? "").trim();
    if (r === "length" || r === "max_tokens") {
      toast(label ? `${label}：输出可能不完整，已尽量采用` : "输出可能不完整，已尽量采用");
    }
  }

  function moduleShapeKeys(appId) {
    const map = {
      overview: ["unlock", "battery", "screen", "topApps"],
      chats: ["threads"],
      calls: ["items"],
      notes: ["entries", "title", "body"],
      web: ["items"],
      secrets: ["entries"],
      shop: ["items"],
      album: ["photos", "caption"]
    };
    return map[appId] || [];
  }

  function hasModuleShape(raw, appId) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
    return moduleShapeKeys(appId).some((k) => raw[k] != null);
  }

  function unwrapModuleRaw(raw, appId) {
    if (!raw || typeof raw !== "object") return raw;
    if (hasModuleShape(raw, appId)) return raw;
    const nested = extractBundleModuleRaw(raw, appId);
    if (nested != null && typeof nested === "object" && !Array.isArray(nested)) {
      if (hasModuleShape(nested, appId) || nested.items || nested.threads || nested.entries) {
        return nested;
      }
    }
    const keys = Object.keys(raw);
    if (keys.length === 1) {
      const only = raw[keys[0]];
      if (only && typeof only === "object" && !Array.isArray(only)) return only;
    }
    return raw;
  }

  function mapChatMessageWho(m) {
    const who = String(m?.who || "").toLowerCase();
    if (who === "me" || who === "char" || who === "self" || who === "ta") return "me";
    if (who === "them" || who === "npc" || who === "contact" || who === "peer") return "them";
    const role = String(m?.role || "").toLowerCase();
    if (role === "assistant") return "me";
    if (role === "user") return "them";
    return "them";
  }

  function resolveCheckupUserDisplayName(c) {
    const maskId =
      String(c?.maskId || "").trim() ||
      (typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "");
    if (typeof readUserMask === "function") {
      const m = readUserMask(maskId);
      const name = String(m?.displayName || m?.name || "").trim();
      if (name) return name;
    }
    if (typeof charLockUserMaskDisplayName === "function") {
      const name = String(charLockUserMaskDisplayName() || "").trim();
      if (name) return name;
    }
    return "你";
  }

  function checkupPeerSelfNames(c) {
    const names = new Set();
    const add = (s) => {
      const t = String(s || "").trim();
      if (t) names.add(t);
    };
    add(resolveCheckupUserDisplayName(c));
    const maskId =
      String(c?.maskId || "").trim() ||
      (typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "");
    if (typeof readUserMask === "function" && maskId) {
      const m = readUserMask(maskId);
      add(m?.displayName);
      add(m?.name);
    }
    if (typeof charLockUserMaskDisplayName === "function") add(charLockUserMaskDisplayName());
    return names;
  }

  /** 生成聊天里联系人即主控本人（对应案卷密谈线程） */
  function isCheckupPeerSelf(c, th) {
    if (!th || th.relation === "群聊") return false;
    const peer = String(th.peer || "").trim();
    if (!peer) return false;
    return checkupPeerSelfNames(c).has(peer);
  }

  function isCheckupImChatLogMessage(m) {
    if (!m || typeof m !== "object") return false;
    if (m.charLockSessionOnly) return false;
    if (typeof isPersonaFoldBoundaryMessage === "function" && isPersonaFoldBoundaryMessage(m)) return false;
    if (typeof isChatSystemNotice === "function" && isChatSystemNotice(m)) return false;
    if (typeof chatMessageDmSurface === "function") return chatMessageDmSurface(m) !== "offline";
    return m.dmSurface !== "offline";
  }

  function checkupImMessageDisplayText(m) {
    if (!m || typeof m !== "object") return "";
    let raw = String(m.content ?? "").trim();
    if (typeof stripOfflineMeetupTagFromAssistantReply === "function") {
      raw = stripOfflineMeetupTagFromAssistantReply(raw);
    }
    raw = raw.replace(/\[OFFLINE:\s*[\s\S]*?\]/gi, "").replace(/\s+/g, " ").trim();
    const segs = raw
      ? raw
          .split(/\|\|\|/)
          .map((s) => s.replace(/\s+/g, " ").trim())
          .filter(Boolean)
      : [];
    let text = segs.join("|||");
    if (!text && typeof chatMessagePlainLastBubbleSegment === "function") {
      text = String(chatMessagePlainLastBubbleSegment(m.content, m) || "")
        .replace(/\s+/g, " ")
        .trim();
    }
    if (!text && m.redpack) text = "【红包】";
    return text;
  }

  function checkupTranslationSegmentSkipped(s) {
    const t = String(s ?? "").trim();
    if (!t) return true;
    if (typeof isTranslationSegmentSkipped === "function") return isTranslationSegmentSkipped(t);
    return t === "[SKIP]" || t === "SKIP";
  }

  function checkupNormalizeTransCompare(s) {
    return String(s || "")
      .replace(/\s+/g, "")
      .replace(/[，,。.!！?？…~～\-—]/g, "")
      .trim();
  }

  /** 译本与原文相同时不展示（密谈对照翻译在中文对白时常会重复写入）。 */
  function checkupTranslationWorthShowing(text, translation) {
    const main = String(text || "").trim();
    const tr = String(translation || "").trim();
    if (!main || !tr || checkupTranslationSegmentSkipped(tr)) return false;
    return checkupNormalizeTransCompare(main) !== checkupNormalizeTransCompare(tr);
  }

  /** 去掉 text 里已嵌的重复括号译本，如「你好。（你好。）」 */
  function checkupStripRedundantInlineTranslation(text, translation) {
    let main = String(text || "").trim();
    if (!main) return main;
    const tr = String(translation || "").trim();
    const m = main.match(/^(.+?)[（(]([^）)\n]{1,800})[）)]\s*$/u);
    if (!m) return main;
    const body = m[1].trim();
    const inline = m[2].trim();
    if (
      checkupNormalizeTransCompare(inline) === checkupNormalizeTransCompare(body) ||
      (tr && checkupNormalizeTransCompare(inline) === checkupNormalizeTransCompare(tr))
    ) {
      return body;
    }
    return main;
  }

  function checkupImMessageTranslationJoined(m) {
    const tr = String(m?.translation ?? "").trim();
    if (!tr) return "";
    if (typeof translationJoinedHasAnyVisible === "function") {
      return translationJoinedHasAnyVisible(tr) ? tr : "";
    }
    return tr.split(/\|\|\|/).some((seg) => !checkupTranslationSegmentSkipped(seg)) ? tr : "";
  }

  /** text / translation 均用 ||| 对齐分段，与密谈 log 一致。 */
  function checkupAlignTextTranslationPairs(textJoined, transJoined) {
    const texts = String(textJoined || "")
      .split(/\|\|\|/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!texts.length) return [];
    const transArr =
      typeof padTranslationSegments === "function"
        ? padTranslationSegments(transJoined, texts.length)
        : String(transJoined || "").split(/\|\|\|/);
    return texts.map((text, i) => {
      const rawText = checkupStripRedundantInlineTranslation(text, "");
      const rawTr = String(transArr[i] ?? "").trim();
      const translation = checkupTranslationWorthShowing(rawText, rawTr) ? rawTr : "";
      return { text: rawText, translation };
    });
  }

  /** 查岗展示：译本写在括号里（与线下晤面正文内对照一致）。 */
  function checkupFormatInlineTranslation(text, translation) {
    const main = checkupStripRedundantInlineTranslation(text, translation);
    const tr = String(translation || "").trim();
    if (!checkupTranslationWorthShowing(main, tr)) return main;
    if (typeof formatOfflineTextWithInlineTranslation === "function" && /「[^」]*」/u.test(main)) {
      return formatOfflineTextWithInlineTranslation(main, tr);
    }
    return `${main}（${tr}）`;
  }

  function setCheckupInlineTransEl(el, text, translation) {
    if (!el) return;
    el.replaceChildren();
    const formatted = checkupFormatInlineTranslation(text, translation);
    if (!String(translation || "").trim() || !/（[^）\n]{1,800}）/u.test(formatted)) {
      el.textContent = formatted;
      return;
    }
    const re = /(（[^）\n]{1,800}）)/gu;
    let last = 0;
    for (const m of formatted.matchAll(re)) {
      const idx = m.index ?? 0;
      if (idx > last) el.appendChild(document.createTextNode(formatted.slice(last, idx)));
      const span = document.createElement("span");
      span.className = "checkup-inline-trans";
      span.textContent = m[1];
      el.appendChild(span);
      last = idx + m[0].length;
    }
    if (last < formatted.length) el.appendChild(document.createTextNode(formatted.slice(last)));
  }

  function readRealMitalkAsCheckupMessages(c, max) {
    if (typeof readChatLogForMaskThread !== "function" || !c?.threadId) return [];
    const maskId =
      String(c.maskId || "").trim() ||
      (typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "");
    const threadId = String(c.threadId || "").trim();
    if (!maskId || !threadId) return [];
    const log = readChatLogForMaskThread(maskId, threadId);
    const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : 80;
    const out = [];
    for (let i = log.length - 1; i >= 0 && out.length < cap; i--) {
      const m = log[i];
      if (!isCheckupImChatLogMessage(m)) continue;
      if (m.role !== "user" && m.role !== "assistant") continue;
      if (m.role === "assistant" && m.restoring) continue;
      const text = checkupStripRedundantInlineTranslation(
        checkupImMessageDisplayText(m),
        checkupImMessageTranslationJoined(m)
      );
      if (!text) continue;
      const translationRaw = checkupImMessageTranslationJoined(m);
      const row = {
        who: m.role === "assistant" ? "me" : "them",
        text: text.slice(0, 320),
        proxy: m.checkupProxySend === true
      };
      if (checkupTranslationWorthShowing(text, translationRaw)) {
        row.translation = translationRaw.slice(0, 960);
      }
      out.unshift(row);
    }
    return out;
  }

  function resolveCheckupChatDisplayMessages(c, th) {
    if (!isCheckupPeerSelf(c, th)) return th.messages || [];
    const real = readRealMitalkAsCheckupMessages(c, 80);
    return real.length ? real : th.messages || [];
  }

  function resolveCheckupThreadPreview(c, th) {
    if (isCheckupPeerSelf(c, th)) {
      const real = readRealMitalkAsCheckupMessages(c, 1);
      if (real.length) return real[real.length - 1].text || "";
    }
    return th.preview || (th.messages || [])[0]?.text || "";
  }

  function appendCharLineToMitalk(c, text) {
    const maskId =
      String(c?.maskId || "").trim() ||
      (typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "");
    const threadId = String(c?.threadId || "").trim();
    const msg = String(text || "").trim();
    if (!maskId || !threadId || !msg) return false;
    if (typeof readChatLogForMaskThread !== "function" || typeof saveChatLogForMaskThread !== "function") {
      return false;
    }
    const log = readChatLogForMaskThread(maskId, threadId);
    log.push({
      role: "assistant",
      content: msg,
      at: Date.now(),
      checkupProxySend: true
    });
    saveChatLogForMaskThread(maskId, threadId, log);
    if (typeof scheduleRenderChatMessages === "function") scheduleRenderChatMessages();
    if (typeof scheduleChatContextTokenLabelUpdate === "function") scheduleChatContextTokenLabelUpdate();
    return true;
  }

  function readCharPersonaSnippet(charId) {
    if (typeof readCharPersonaStore !== "function") return "";
    const st = readCharPersonaStore();
    const items = Array.isArray(st?.items) ? st.items : [];
    const ch = items.find((x) => x && String(x.id || "") === String(charId || ""));
    if (!ch) return "";
    const bits = [ch.persona, ch.summary, ch.boundaries].filter((x) => String(x || "").trim());
    return bits.join("\n").slice(0, 1600);
  }

  function readCasePlotSnippet(c) {
    if (typeof readChatLogForMaskThread !== "function" || !c?.threadId) return "";
    const maskId =
      String(c.maskId || "").trim() ||
      (typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "");
    if (!maskId) return "";
    const log = readChatLogForMaskThread(maskId, c.threadId);
    if (!Array.isArray(log) || !log.length) return "";
    const lines = [];
    for (let i = Math.max(0, log.length - 8); i < log.length; i++) {
      const row = log[i];
      if (!row || row.restoring) continue;
      const role = row.role === "user" ? resolveCheckupUserDisplayName(c) : c.charName || "TA";
      const text = String(row.content || "")
        .replace(/\|\|\|/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140);
      if (text) lines.push(`${role}：${text}`);
    }
    return lines.join("\n").slice(0, 900);
  }

  function buildCaseContextBlock(c) {
    const name = c.charName || "Ta";
    const persona = readCharPersonaSnippet(c.charId);
    const plot = readCasePlotSnippet(c);
    const maskId =
      String(c.maskId || "").trim() ||
      (typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "");
    const relNet =
      typeof window.buildCharRelationNetworkAiContext === "function"
        ? window.buildCharRelationNetworkAiContext(maskId, c.charId, { npcOnly: true })
        : "";
    const reasonLine = `查岗理由：${caseReasonLabel(c)}（强度 ${intensityLabel(c.intensity)}）`;
    const userName = resolveCheckupUserDisplayName(c);
    return [
      `【角色】${name}`,
      persona ? `【人设】\n${persona}` : "",
      relNet || "",
      plot ? `【近期密谈剧情（手机内容须与此一致）】\n${plot}` : "",
      `【查岗】${reasonLine}`,
      `【主控】显示名「${userName}」；若生成与主控的私聊，peer 须用此名（便于同步真实密谈）。`,
      "【生成原则】手机痕迹主要来自角色人设、关系网与密谈剧情，像 TA 平时真的会留下的记录。",
      "查岗理由供角色知情/氛围参考（TA 可能心虚、防备或装没事），但不要为「配合翻手机动机」定制证据式内容。"
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function genSchemaHint(appId) {
    const name = "CHAR";
    const map = {
      overview:
        '{ "unlock":"今天 02:14", "battery":"38%", "screen":"4h 12m", "topApps":["微信","Safari","相册"] }',
      chats:
        '{ "threads":[{ "id":"chat_1", "peer":"林屿", "relation":"同事", "at":"昨天 23:18", "preview":"…", "messages":[{"who":"them","text":"…","translation":"仅外语对白时填写"}],"decode":"可选内心OS" }] } 4～6个对话含1个群聊，重点对话15～25条；**禁止**写关系网里其它可玩 char 与 TA 的私聊（只写主控、NPC、虚构路人）；中文对白不要写 translation',
      calls:
        '{ "items":[{ "id":"call_1", "peer":"林屿", "number":"138****8821", "type":"missed|in|out", "duration":"12:04或空", "at":"昨天 23:52", "note":"可选" }] } 5～7条含未接与深夜长通话',
      notes:
        '{ "title":"备忘录", "entries":[{ "id":"note_1", "type":"text|voice", "at":"今天", "body":"多行文字/清单", "translation":"可选·中文读本", "duration":"0:47", "label":"语音备忘", "transcript":"…", "inner":"录的时候在想" }] } 6～10条，含3～4条文字、2～3条语音，每条有实质内容；外语正文/transcript 须另写 translation（程序以括号对照展示，勿在正文里自写括号译本）',
      web:
        '{ "items":[{ "id":"web_1", "kind":"search|page", "q":"搜索词", "title":"网页标题", "host":"zhihu.com", "at":"今天 01:02", "preview":"…", "content":"多行正文", "voice":"心声" }] } 含3条搜索+若干网页',
      secrets:
        '{ "entries":[{ "id":"sec_1", "kind":"draft|note|keepsake|wish", "title":"短标题", "body":"多行正文", "at":"三天前", "translation":"可选·中文读本" }] } 5～8 条；须像 TA 藏在手机里的私人痕迹（未发送草稿、上锁笔记、小收藏、心愿清单），**不是**全知内心独白；与备忘录（生活备忘）、浏览（搜索焦虑）分工；低强度偏 keepsake/wish 清单，高强度可含 draft；对主控可含蓄暗示勿直球告白；不得与密谈气泡矛盾；**禁止**关系网其它可玩 char；外语 body 须另写 translation（勿在正文自写括号译本）',
      shop:
        '{ "items":[{ "title":"…", "price":"¥128.00", "state":"购物车|订单|外卖订单|已浏览", "kind":"shop|delivery", "at":"昨晚", "note":"收货人/地址/备注等" }] } 8～12条，购物与外卖都要有，每条须有合理价格（外卖多为¥15～80，网购单品/订单¥29～999），细节具体',
      album:
        '{ "photos":[{ "id":"ph_1", "caption":"…", "at":"昨天 23:41", "withWho":"独自|与某人", "note":"可选" }], "caption":"可选相册总述" } 6～10张未发送照片（自拍/合照/风景/截图/夜景等）'
    };
    return map[appId] || "{}";
  }

  const SECRETS_GEN_RULES = [
    "秘密空间 entries 是 TA 不愿留在桌面的私人痕迹，不是配合查岗理由定制的证据。",
    "锚定人设与近期密谈，延伸已有情绪，勿凭空发明重大新剧情。",
    "秘密内容里**禁止**出现关系网里其它可玩角色；对主控宜含蓄暗示，勿与密谈气泡矛盾。",
    "强度低：清单/收藏/心愿为主；强度高：可含未发送 draft，但仍须像真实手机记录而非作者旁白。"
  ].join("\n");

  const GEN_SYSTEM_RULES = [
    "依据 user 提供的人设、密谈剧情与查岗理由生成，各板块之间细节可呼应。",
    "查岗理由影响角色心态与氛围，不要据此编造「专门给玩家看」的定制证据。",
    "可暧昧、有张力、留疑点，但须像真实手机痕迹；不要血腥违法。",
    "NPC 为第三者，不是被查角色本人；messages 里 who 只能是 them 或 me（me=被查角色）。",
    "手机私聊/通话对象只能是：主控（用户）、关系网 NPC、或虚构路人；**禁止**让关系网里其它可玩角色（有独立 char 档案者）出现在微信/通话里与 TA 私聊，避免 OOC。",
    "messages[].translation **仅在外语对白时**填写中文读本（||| 与 text 对齐）；**中文对白不要写 translation**，勿在 text 里自写括号译本。",
    "备忘录 entries 的 body / transcript 若有外语，另写 translation（中文读本）；程序会在正文后以括号对照展示，勿在 body 里自写括号译本。"
  ].join("\n");

  function buildGenSystemPrompt(appId) {
    const lines = [
      "你是中文剧情向手机内容生成器。输出**单个 JSON 对象**，不要 markdown 围栏，不要解释。",
      "根对象**直接**是板块内容本身，不要用板块 id 再包一层（错误示例：{\"chats\":{...}}）。",
      GEN_SYSTEM_RULES,
      `JSON 根对象结构：${genSchemaHint(appId)}`
    ];
    if (appId === "secrets") lines.splice(3, 0, SECRETS_GEN_RULES);
    return lines.join("\n");
  }

  function buildBundleGenSystemPrompt(appIds) {
    const schemaLines = appIds.map((id) => `"${id}": ${genSchemaHint(id)}`);
    const lines = [
      "你是中文剧情向手机内容生成器。",
      "输出**单个 JSON 对象**；顶层键只能是 user 列出的板块 id，每个键对应该板块完整内容。",
      "不要 markdown 围栏，不要解释，不要多余顶层键。",
      GEN_SYSTEM_RULES,
      "各板块结构：",
      schemaLines.join("\n")
    ];
    if (appIds.includes("secrets")) lines.splice(5, 0, SECRETS_GEN_RULES);
    return lines.join("\n");
  }

  function normalizeOverviewPayload(raw) {
    return {
      unlock: String(raw?.unlock || "—").slice(0, 28),
      battery: String(raw?.battery || "—").slice(0, 12),
      screen: String(raw?.screen || "—").slice(0, 20),
      topApps: (Array.isArray(raw?.topApps) ? raw.topApps : [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .slice(0, 5)
    };
  }

  function caseCharPhoneLabel(c) {
    return `${c?.charName || "Ta"}的手机`;
  }

  function normalizeChatsPayload(raw) {
    const threads = Array.isArray(raw?.threads) ? raw.threads : [];
    const out = [];
    for (let i = 0; i < threads.length && i < 6; i++) {
      const th = threads[i] || {};
      const messages = (Array.isArray(th.messages) ? th.messages : [])
        .map((m) => {
          const text = checkupStripRedundantInlineTranslation(
            String(m?.text || m?.content || "").slice(0, 320),
            String(m?.translation || "").trim()
          );
          const translation = String(m?.translation || "").trim().slice(0, 960);
          const row = { who: mapChatMessageWho(m), text };
          if (checkupTranslationWorthShowing(text, translation)) row.translation = translation;
          return row;
        })
        .filter((m) => m.text);
      if (!messages.length) continue;
      out.push({
        id: String(th.id || `chat_${i}`).slice(0, 32),
        peer: String(th.peer || "未命名").slice(0, 24),
        relation: String(th.relation || "").slice(0, 16),
        at: String(th.at || "").slice(0, 20),
        preview: String(th.preview || messages[messages.length - 1]?.text || "").slice(0, 48),
        messages: messages.slice(0, 36),
        decode: th.decode ? String(th.decode).slice(0, 240) : undefined
      });
    }
    if (!out.length) throw new Error("聊天 threads 为空");
    return { threads: out };
  }

  function normalizeNotesPayload(raw) {
    const entries = Array.isArray(raw?.entries) ? raw.entries : [];
    const out = [];
    for (let i = 0; i < entries.length && i < 10; i++) {
      const e = entries[i] || {};
      const type = e.type === "voice" ? "voice" : "text";
      const row = {
        id: String(e.id || `note_${i}`).slice(0, 24),
        type,
        at: String(e.at || "").slice(0, 20)
      };
      if (type === "voice") {
        row.duration = String(e.duration || "0:30").slice(0, 8);
        row.label = String(e.label || "语音备忘").slice(0, 24);
        const trVoice = String(e.translation || "").trim().slice(0, 500);
        row.transcript = checkupStripRedundantInlineTranslation(
          String(e.transcript || "").slice(0, 500),
          trVoice
        );
        if (checkupTranslationWorthShowing(row.transcript, trVoice)) row.translation = trVoice;
        if (e.inner) row.inner = String(e.inner).slice(0, 240);
      } else {
        const trText = String(e.translation || "").trim().slice(0, 900);
        row.body = checkupStripRedundantInlineTranslation(String(e.body || "").slice(0, 900), trText);
        if (checkupTranslationWorthShowing(row.body, trText)) row.translation = trText;
      }
      if (type === "voice" ? row.transcript : row.body) out.push(row);
    }
    if (!out.length) throw new Error("备忘录 entries 为空");
    return { title: String(raw?.title || "备忘录").slice(0, 16), entries: out };
  }

  function normalizeWebPayload(raw) {
    const items = Array.isArray(raw?.items) ? raw.items : [];
    const out = [];
    for (let i = 0; i < items.length && i < 10; i++) {
      const it = items[i] || {};
      const kind = it.kind === "search" ? "search" : "page";
      const row = {
        id: String(it.id || `web_${i}`).slice(0, 32),
        kind,
        at: String(it.at || "").slice(0, 20),
        preview: String(it.preview || "").slice(0, 48),
        content: String(it.content || "").slice(0, 1200),
        voice: String(it.voice || "").slice(0, 240)
      };
      if (kind === "search") row.q = String(it.q || it.title || "—").slice(0, 48);
      else {
        row.title = String(it.title || "—").slice(0, 48);
        row.host = String(it.host || "").slice(0, 32);
      }
      if (!row.content.trim()) continue;
      out.push(row);
    }
    if (!out.length) throw new Error("浏览搜索 items 为空");
    return { items: out };
  }

  function normalizeSecretKind(v) {
    const s = String(v || "").toLowerCase();
    if (s === "draft" || s === "草稿" || s === "未发送") return "draft";
    if (s === "keepsake" || s === "收藏" || s === "keep") return "keepsake";
    if (s === "wish" || s === "心愿" || s === "愿望") return "wish";
    return "note";
  }

  function secretKindLabel(kind) {
    const map = { draft: "未发送草稿", note: "私密笔记", keepsake: "收藏", wish: "心愿" };
    return map[kind] || "私密笔记";
  }

  function normalizeSecretsPayload(raw) {
    const entries = (Array.isArray(raw?.entries) ? raw.entries : [])
      .map((it, i) => {
        const kind = normalizeSecretKind(it?.kind);
        const body = checkupStripRedundantInlineTranslation(
          String(it?.body || "").slice(0, 1200),
          String(it?.translation || "").trim()
        );
        const translation = String(it?.translation || "").trim().slice(0, 960);
        const title = String(it?.title || "").trim().slice(0, 48);
        const at = String(it?.at || "").slice(0, 20);
        if (!body.trim() && !title) return null;
        const row = {
          id: String(it?.id || `sec_${i}`).slice(0, 32),
          kind,
          title: title || secretKindLabel(kind),
          body,
          at
        };
        if (checkupTranslationWorthShowing(body, translation)) row.translation = translation;
        return row;
      })
      .filter(Boolean)
      .slice(0, 10);
    if (!entries.length) throw new Error("秘密空间 entries 为空");
    return { entries };
  }

  function normalizeShopPrice(raw) {
    if (raw == null || raw === "") return undefined;
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      return raw % 1 === 0 ? `¥${raw}` : `¥${raw.toFixed(2)}`;
    }
    const s = String(raw).trim().replace(/元$/u, "").trim();
    if (!s) return undefined;
    if (/^[¥￥]/u.test(s)) return s.slice(0, 16);
    const n = parseFloat(s.replace(/[,，]/g, ""));
    if (Number.isFinite(n) && n >= 0) return n % 1 === 0 ? `¥${n}` : `¥${n.toFixed(2)}`;
    return s.slice(0, 16);
  }

  function normalizeShopPayload(raw) {
    const items = (Array.isArray(raw?.items) ? raw.items : [])
      .map((it) => ({
        title: String(it?.title || "—").slice(0, 64),
        price: normalizeShopPrice(it?.price),
        state: String(it?.state || "订单").slice(0, 20),
        kind: it?.kind === "delivery" ? "delivery" : "shop",
        at: String(it?.at || "").slice(0, 20),
        note: it?.note ? String(it.note).slice(0, 80) : undefined
      }))
      .filter((it) => it.title !== "—")
      .slice(0, 12);
    if (!items.length) throw new Error("购物外卖 items 为空");
    return { items };
  }

  function normalizeAlbumPayload(raw) {
    const photos = Array.isArray(raw?.photos) ? raw.photos : [];
    const out = [];
    for (let i = 0; i < photos.length && i < 12; i++) {
      const p = photos[i] || {};
      const caption = String(p.caption || p.note || "").trim();
      const at = String(p.at || "").trim();
      const withWho = String(p.withWho || "").trim();
      if (!caption && !at && !withWho) continue;
      const row = {
        id: String(p.id || `ph_${i}`).slice(0, 24),
        caption: caption.slice(0, 140),
        at: at.slice(0, 20),
        withWho: withWho.slice(0, 16)
      };
      const note = String(p.note || "").trim();
      if (note && note !== row.caption) row.note = note.slice(0, 100);
      out.push(row);
    }
    if (!out.length) {
      const legacyCaption = String(raw?.caption || "").trim();
      if (!legacyCaption) throw new Error("相册 photos 为空");
      out.push({
        id: "ph_0",
        caption: legacyCaption.slice(0, 140),
        at: String(raw?.at || "").slice(0, 20),
        withWho: String(raw?.withWho || "").slice(0, 16)
      });
    }
    return {
      photos: out,
      caption: String(raw?.caption || "").trim().slice(0, 200)
    };
  }

  function normalizeCallType(v) {
    const s = String(v || "").toLowerCase();
    if (s === "missed" || s === "未接") return "missed";
    if (s === "out" || s === "outgoing" || s === "去电" || s === "拨出") return "out";
    return "in";
  }

  function normalizeCallsPayload(raw) {
    const items = (Array.isArray(raw?.items) ? raw.items : [])
      .map((it, i) => {
        const type = normalizeCallType(it?.type);
        const row = {
          id: String(it?.id || `call_${i}`).slice(0, 24),
          peer: String(it?.peer || "未知号码").slice(0, 24),
          number: String(it?.number || "").slice(0, 20),
          type,
          at: String(it?.at || "").slice(0, 20),
          note: it?.note ? String(it.note).slice(0, 48) : undefined
        };
        const dur = String(it?.duration || "").trim();
        if (dur && type !== "missed") row.duration = dur.slice(0, 12);
        return row;
      })
      .filter((it) => it.peer)
      .slice(0, 10);
    if (!items.length) throw new Error("通话记录 items 为空");
    return { items };
  }

  function normalizeAiPayload(appId, raw, charName) {
    if (appId === "overview") return normalizeOverviewPayload(raw);
    if (appId === "chats") return normalizeChatsPayload(raw);
    if (appId === "calls") return normalizeCallsPayload(raw);
    if (appId === "notes") return normalizeNotesPayload(raw);
    if (appId === "web") return normalizeWebPayload(raw);
    if (appId === "secrets") return normalizeSecretsPayload(raw);
    if (appId === "shop") return normalizeShopPayload(raw);
    if (appId === "album") return normalizeAlbumPayload(raw);
    throw new Error("未知板块");
  }

  async function requestCheckupAiCompletion(messages) {
    const ai = window.RP_AI;
    if (!ai?.chatCompletions) throw new Error("AI 模块未加载");
    const cfg = ai.getConfig?.() || {};
    if (!String(cfg.apiKey || "").trim()) throw new Error("请先在设置中配置 API Key");
    const req = window.__XXJ_GROUP_CHAT_DEPS?.requestChatAssistantCompletion;
    // 不传 max_tokens，走网关/模型默认输出上限（与密谈记忆摘要一致）
    const payload = {
      messages,
      temperature: 0.88,
      response_format: { type: "json_object" }
    };
    if (typeof req === "function") return req(ai, payload);
    try {
      return await ai.chatCompletions(payload);
    } catch (e) {
      const msg = e && e.message ? String(e.message) : "";
      if (!/response_format|json|unsupported|not supported/i.test(msg)) throw e;
      const retry = { ...payload };
      delete retry.response_format;
      return ai.chatCompletions(retry);
    }
  }

  function extractBundleModuleRaw(raw, appId) {
    if (!raw || typeof raw !== "object") return null;
    if (raw[appId] != null) return raw[appId];
    const mods = raw.modules;
    if (mods && typeof mods === "object" && mods[appId] != null) return mods[appId];
    return null;
  }

  function secretsIntensityHint(c) {
    const id = c?.intensity || "mid";
    if (id === "low") return "秘密空间强度提示：以 keepsake/wish 清单、小收藏为主，情绪含蓄。";
    if (id === "high") return "秘密空间强度提示：可含 1～2 条未发送 draft，但仍须像真实手机记录。";
    return "秘密空间强度提示：draft/note/keepsake/wish 混合，程度适中。";
  }

  async function requestCheckupAiPayload(c, appId) {
    const moduleLabel = genModuleLabel(appId);
    const userParts = [
      buildCaseContextBlock(c),
      "",
      `请生成板块「${moduleLabel}」（id: ${appId}）。`,
      "输出 JSON 根对象即为该板块内容本身，不要用 id 再包一层。"
    ];
    if (appId === "secrets") userParts.push(secretsIntensityHint(c));
    const messages = [
      { role: "system", content: buildGenSystemPrompt(appId) },
      { role: "user", content: userParts.join("\n") }
    ];
    const data = await requestCheckupAiCompletion(messages);
    maybeWarnCompletionTruncated(data, moduleLabel);
    const text = readAiCompletionText(data);
    if (!text) throw new Error(`${moduleLabel}：模型无正文`);
    const raw = unwrapModuleRaw(parseAiJsonObject(text), appId);
    try {
      return normalizeAiPayload(appId, raw, c.charName || "Ta");
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      throw new Error(`${moduleLabel}：${msg}`);
    }
  }

  async function requestCheckupAiBundle(c, appIds) {
    const labels = appIds.map((id) => genModuleLabel(id)).join("、");
    const userParts = [
      buildCaseContextBlock(c),
      "",
      `请**一次性**生成以下板块：${labels}。`,
      `顶层 JSON 键名必须是（仅这些）：${appIds.join(", ")}`
    ];
    if (appIds.includes("secrets")) userParts.push(secretsIntensityHint(c));
    const user = userParts.join("\n");
    const messages = [
      { role: "system", content: buildBundleGenSystemPrompt(appIds) },
      { role: "user", content: user }
    ];
    const data = await requestCheckupAiCompletion(messages);
    maybeWarnCompletionTruncated(data, "一键生成");
    const text = readAiCompletionText(data);
    if (!text) throw new Error("批量生成：模型无正文");
    const raw = parseAiJsonObject(text);
    const charName = c.charName || "Ta";
    const out = {};
    for (const appId of appIds) {
      const label = genModuleLabel(appId);
      let moduleRaw = extractBundleModuleRaw(raw, appId);
      if (moduleRaw == null) throw new Error(`缺少板块「${label}」`);
      moduleRaw = unwrapModuleRaw(moduleRaw, appId);
      try {
        out[appId] = normalizeAiPayload(appId, moduleRaw, charName);
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        throw new Error(`${label}：${msg}`);
      }
    }
    return out;
  }

  function clearAppPayload(c, appId) {
    if (!c.demo) c.demo = {};
    delete c.demo[appId];
    if (appId === "web") {
      delete c.demo.search;
      delete c.demo.browser;
    }
    if (c.demoSources) delete c.demoSources[appId];
  }

  async function generateOneCheckupApp(c, appId) {
    const label = genModuleLabel(appId);
    const payload = await requestCheckupAiPayload(c, appId);
    clearAppPayload(c, appId);
    if (!c.demo) c.demo = {};
    c.demo[appId] = payload;
    if (!c.demoSources) c.demoSources = {};
    c.demoSources[appId] = "ai";
    c.updatedAt = Date.now();
    writeStore();
    return label;
  }

  function applyGeneratedPayloads(c, payloads) {
    if (!c.demo) c.demo = {};
    if (!c.demoSources) c.demoSources = {};
    for (const appId of Object.keys(payloads)) {
      c.demo[appId] = payloads[appId];
      c.demoSources[appId] = "ai";
    }
    c.updatedAt = Date.now();
    writeStore();
    if (payloads.overview) syncDeviceGlance(c);
    renderPhoneApps();
    renderGenPickList();
    if (activeAppId) renderAppBody(activeAppId);
  }

  async function generateCheckupBundle(appIds) {
    const c = activeCase();
    if (!c || !appIds.length) return;
    if (genBusy) return;
    if (!window.RP_AI) {
      toast("请先配置 API");
      return;
    }
    genBusy = true;
    syncGenUi();
    const statusEl = document.getElementById("checkup-gen-status");
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent =
        appIds.length === GEN_MODULES.length
          ? "正在一键生成（单次请求）…"
          : `正在生成已选 ${appIds.length} 个板块（单次请求）…`;
    }
    try {
      for (const appId of appIds) clearAppPayload(c, appId);
      const payloads = await requestCheckupAiBundle(c, appIds);
      applyGeneratedPayloads(c, payloads);
      if (statusEl) statusEl.textContent = `已生成 ${appIds.length} 个板块`;
      toast(`已生成 ${appIds.length} 个板块`);
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      if (statusEl) statusEl.textContent = `生成失败：${msg}`;
      toast(`生成失败：${msg}`);
      renderPhoneApps();
      renderGenPickList();
    }
    genBusy = false;
    syncGenUi();
  }

  async function generateCheckupAppsSequential(appIds) {
    const c = activeCase();
    if (!c || !appIds.length) return;
    if (genBusy) return;
    if (!window.RP_AI) {
      toast("请先配置 API");
      return;
    }
    genBusy = true;
    syncGenUi();
    const statusEl = document.getElementById("checkup-gen-status");
    const total = appIds.length;
    let ok = 0;
    let fail = 0;
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = `逐个生成（0/${total}）…`;
    }
    for (let i = 0; i < appIds.length; i++) {
      const appId = appIds[i];
      const label = genModuleLabel(appId);
      if (statusEl) statusEl.textContent = `正在生成 ${label}（${i + 1}/${total}）…`;
      try {
        await generateOneCheckupApp(c, appId);
        ok++;
        toast(`已生成 · ${label}`);
        if (appId === "overview") syncDeviceGlance(c);
        renderPhoneApps();
        renderGenPickList();
        if (activeAppId === appId) renderAppBody(appId);
      } catch (e) {
        fail++;
        const msg = e && e.message ? e.message : String(e);
        toast(`${label} 失败：${msg}`);
      }
    }
    genBusy = false;
    syncGenUi();
    if (statusEl) {
      statusEl.textContent =
        fail > 0 ? `逐个完成：${ok} 成功，${fail} 失败` : `逐个完成（${ok} 个板块）`;
    }
    renderPhoneApps();
    renderGenPickList();
    if (activeAppId) renderAppBody(activeAppId);
  }

  function getCheckedGenAppIds() {
    const root = document.getElementById("checkup-gen-picks");
    if (!root) return [];
    const ids = [];
    root.querySelectorAll(".checkup-gen-chip.is-on[data-gen-app]").forEach((el) => {
      ids.push(el.getAttribute("data-gen-app"));
    });
    return ids.filter(Boolean);
  }

  function syncGenToggleAllLabel() {
    const btn = document.getElementById("checkup-gen-toggle-all");
    const root = document.getElementById("checkup-gen-picks");
    if (!btn || !root) return;
    const chips = root.querySelectorAll(".checkup-gen-chip[data-gen-app]");
    const on = root.querySelectorAll(".checkup-gen-chip.is-on[data-gen-app]").length;
    btn.textContent = on === chips.length ? "全不选" : "全选";
  }

  function renderGenPickList() {
    const root = document.getElementById("checkup-gen-picks");
    const c = activeCase();
    if (!root || !c) return;
    const prevOn = new Set(getCheckedGenAppIds());
    const firstPaint = !root.childElementCount;
    root.replaceChildren();
    for (const mod of GEN_MODULES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "checkup-gen-chip" + ((firstPaint || prevOn.has(mod.id)) ? " is-on" : "");
      btn.setAttribute("data-gen-app", mod.id);
      const name = document.createElement("span");
      name.className = "checkup-gen-chip-name";
      name.textContent = mod.label;
      const tag = document.createElement("span");
      tag.className = "checkup-gen-chip-tag";
      tag.textContent = appContentSource(c, mod.id) === "ai" ? "AI" : "—";
      btn.append(name, tag);
      btn.addEventListener("click", () => {
        btn.classList.toggle("is-on");
        syncGenToggleAllLabel();
      });
      root.appendChild(btn);
    }
    syncGenToggleAllLabel();
  }

  function syncGenUi() {
    const busy = genBusy;
    [
      "checkup-gen-all-btn",
      "checkup-gen-pick-btn",
      "checkup-gen-seq-btn",
      "checkup-gen-btn",
      "checkup-gen-toggle-all"
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = busy;
    });
    document.querySelectorAll(".checkup-gen-one-btn").forEach((el) => {
      el.disabled = busy;
    });
  }

  function openGenSheet() {
    const c = activeCase();
    if (!c) return;
    renderGenPickList();
    const statusEl = document.getElementById("checkup-gen-status");
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.textContent = "";
    }
    openSheet("checkup-sheet-gen");
  }

  function closeGenSheet() {
    if (genBusy) return;
    closeSheet("checkup-sheet-gen");
  }

  function resolveAppPayload(c, appId) {
    if (!c.demo) c.demo = {};
    if (appId === "web") {
      if (c.demo.search) delete c.demo.search;
      if (c.demo.browser) delete c.demo.browser;
      if (c.demo.web && isStaleWebDemo(c.demo.web)) delete c.demo.web;
    }
    if (appId === "chats" && c.demo[appId] && isStaleChatsDemo(c.demo[appId])) {
      delete c.demo[appId];
    }
    if (appId === "notes" && c.demo[appId] && isStaleNotesDemo(c.demo[appId])) {
      delete c.demo[appId];
    }
    if (appId === "secrets" && c.demo.rank) {
      delete c.demo.rank;
    }
    if (c.demo[appId]) return c.demo[appId];
    return emptyAppPayload(appId);
  }

  function renderAlbumPanel(panel, data) {
    let photos = Array.isArray(data?.photos) ? data.photos : [];
    if (!photos.length && String(data?.caption || "").trim()) {
      photos = [
        {
          id: "ph_0",
          caption: String(data.caption || "").trim(),
          at: String(data.at || "").trim(),
          withWho: String(data.withWho || "").trim()
        }
      ];
    }
    if (!photos.length) {
      renderEmptyPanel(panel, "尚无内容，请生成本板块");
      return;
    }
    if (data.caption) {
      const overall = document.createElement("p");
      overall.className = "checkup-demo-note";
      overall.textContent = data.caption;
      panel.appendChild(overall);
    }
    const grid = document.createElement("div");
    grid.className = "checkup-album-grid";
    for (const ph of photos) {
      const cell = document.createElement("figure");
      cell.className = "checkup-album-cell";
      const imgPh = document.createElement("div");
      imgPh.className = "checkup-album-ph";
      imgPh.innerHTML = '<i class="ph ph-image" aria-hidden="true"></i>';
      const cap = document.createElement("figcaption");
      cap.className = "checkup-album-cap";
      cap.textContent = ph.caption || ph.note || "";
      const meta = document.createElement("span");
      meta.className = "checkup-search-hint";
      meta.textContent = [ph.at, ph.withWho].filter(Boolean).join(" · ");
      cell.append(imgPh, cap, meta);
      grid.appendChild(cell);
    }
    panel.appendChild(grid);
  }

  function appendCheckupBubble(wrap, m) {
    const pairs = checkupAlignTextTranslationPairs(m.text, m.translation);
    const list = pairs.length
      ? pairs
      : [{ text: String(m.text || "").trim(), translation: "" }].filter((p) => p.text);
    list.forEach(({ text, translation }) => {
      const displayText = checkupStripRedundantInlineTranslation(text, translation);
      const showTr = checkupTranslationWorthShowing(displayText, translation);
      const b = document.createElement("div");
      let cls = "checkup-bubble " + (m.who === "me" ? "checkup-bubble--me" : "checkup-bubble--them");
      if (m.proxy) cls += " checkup-bubble--proxy";
      if (showTr) cls += " checkup-bubble--bilingual";
      b.className = cls;
      if (showTr) {
        const primary = document.createElement("div");
        primary.className = "checkup-bubble-text";
        primary.textContent = displayText;
        const rule = document.createElement("div");
        rule.className = "checkup-bubble-trans-rule";
        rule.setAttribute("aria-hidden", "true");
        const trEl = document.createElement("div");
        trEl.className = "checkup-bubble-trans";
        trEl.textContent = translation;
        b.append(primary, rule, trEl);
      } else {
        b.textContent = displayText;
      }
      wrap.appendChild(b);
    });
  }

  function renderChatBubbles(panel, th, c) {
    const wrap = document.createElement("div");
    wrap.className = "checkup-decode-wrap";
    const msgs = c ? resolveCheckupChatDisplayMessages(c, th) : th.messages || [];
    if (c && isCheckupPeerSelf(c, th) && msgs.length) {
      const note = document.createElement("p");
      note.className = "checkup-demo-note";
      note.textContent = "已与密谈同步 · 显示真实聊天记录";
      wrap.appendChild(note);
    }
    for (const m of msgs) appendCheckupBubble(wrap, m);
    if (th.decode) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "checkup-decode-toggle";
      toggle.textContent = "DECODE";
      toggle.addEventListener("click", () => {
        wrap.classList.toggle("is-decode-on");
        toggle.classList.toggle("is-on", wrap.classList.contains("is-decode-on"));
      });
      const dec = document.createElement("div");
      dec.className = "checkup-decode";
      dec.textContent = th.decode;
      wrap.append(toggle, dec);
    }
    panel.appendChild(wrap);
  }

  function canProxyReply(th) {
    return Boolean(th && th.relation !== "群聊" && th.peer);
  }

  function countCheckupBlockActions(c) {
    return (Array.isArray(c?.impersonationBlocks) ? c.impersonationBlocks : []).filter(
      (b) => b && b.blocked === true
    ).length;
  }

  function renderCharProxyComposer(panel, th) {
    if (!canProxyReply(th)) return;
    const c = activeCase();
    const wrap = document.createElement("div");
    wrap.className = "checkup-proxy-compose";
    const hint = document.createElement("p");
    hint.className = "checkup-proxy-hint";
    const selfPeer = isCheckupPeerSelf(c, th);
    hint.textContent = selfPeer
      ? `代发 · 写入密谈`
      : `代发 · 回复 ${th.peer || "对方"}`;
    const row = document.createElement("div");
    row.className = "checkup-proxy-row";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "checkup-proxy-input";
    input.maxLength = 120;
    input.placeholder = "代发一句…";
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        row.querySelector(".checkup-proxy-send")?.click();
      }
    });
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "checkup-proxy-send";
    btn.textContent = "发送";
    btn.addEventListener("click", () => {
      const text = String(input.value || "").trim();
      if (!text) {
        toast("写点什么");
        return;
      }
      sendCharProxyReply(activeChatThreadId, text);
      input.value = "";
    });
    row.append(input, btn);
    wrap.append(hint, row);
    const blocked = th.blocked === true;
    const blockRow = document.createElement("div");
    blockRow.className = "checkup-proxy-block-row";
    const blockHint = document.createElement("p");
    blockHint.className = "checkup-proxy-hint checkup-proxy-hint--block";
    blockHint.textContent = blocked ? "已拉黑" : "可选";
    const blockBtn = document.createElement("button");
    blockBtn.type = "button";
    blockBtn.className = "checkup-proxy-block" + (blocked ? " is-blocked" : "");
    blockBtn.textContent = blocked ? "取消拉黑" : "拉黑 TA";
    blockBtn.addEventListener("click", () => {
      toggleCharProxyBlock(activeChatThreadId, !blocked);
    });
    blockRow.append(blockHint, blockBtn);
    wrap.appendChild(blockRow);
    panel.appendChild(wrap);
  }

  function toggleCharProxyBlock(threadId, wantBlock) {
    const c = activeCase();
    if (!c || c.kickedOut || activeAppId !== "chats" || !threadId) return;
    const data = resolveAppPayload(c, "chats");
    const th = findChatThread(data, threadId);
    if (!canProxyReply(th)) {
      toast("无法在此对话操作");
      return;
    }
    if (wantBlock && th.blocked === true) {
      toast("已经拉黑了");
      return;
    }
    if (!wantBlock && th.blocked !== true) {
      toast("尚未拉黑");
      return;
    }
    if (wantBlock) th.blocked = true;
    else delete th.blocked;
    if (!Array.isArray(c.impersonationBlocks)) c.impersonationBlocks = [];
    c.impersonationBlocks.push({
      threadId: th.id,
      peer: th.peer,
      blocked: wantBlock,
      at: Date.now()
    });
    c.updatedAt = Date.now();
    writeStore();
    renderAppBody("chats");
    toast(wantBlock ? `已拉黑 · ${th.peer || "对方"}` : `已取消拉黑 · ${th.peer || "对方"}`);
    tryCheckupDiscovery(c, wantBlock ? "block" : "unblock");
  }

  function sendCharProxyReply(threadId, text) {
    const c = activeCase();
    if (!c || c.kickedOut || activeAppId !== "chats" || !threadId) return;
    const data = resolveAppPayload(c, "chats");
    const th = findChatThread(data, threadId);
    if (!canProxyReply(th)) {
      toast("无法在此对话代发");
      return;
    }
    if (!Array.isArray(th.messages)) th.messages = [];
    th.messages.push({ who: "me", text, proxy: true });
    th.preview = text;
    th.at = "刚刚";
    const selfPeer = isCheckupPeerSelf(c, th);
    let wroteReal = false;
    if (selfPeer) wroteReal = appendCharLineToMitalk(c, text);
    if (!Array.isArray(c.impersonationSends)) c.impersonationSends = [];
    c.impersonationSends.push({
      threadId: th.id,
      peer: th.peer,
      text,
      at: Date.now()
    });
    c.updatedAt = Date.now();
    writeStore();
    renderAppBody("chats");
    toast(
      selfPeer && wroteReal
        ? `已代发 · 已写入密谈`
        : selfPeer && !wroteReal
          ? `已代发 · 写入密谈失败`
          : `已代发 · ${th.peer || "对方"}会收到`
    );
    tryCheckupDiscovery(c, "proxy");
  }

  function renderChatThreadList(parent, threads) {
    const c = activeCase();
    const list = document.createElement("div");
    list.className = "checkup-thread-list";
    list.setAttribute("role", "list");
    for (let i = 0; i < threads.length; i++) {
      const th = threads[i];
      const threadId = th.id || `chat_${i}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "checkup-thread-row";
      btn.setAttribute("role", "listitem");
      const av = document.createElement("span");
      av.className = "checkup-thread-av";
      av.textContent = charInitial(th.peer);
      const body = document.createElement("span");
      body.className = "checkup-thread-body";
      const top = document.createElement("span");
      top.className = "checkup-thread-top";
      const name = document.createElement("span");
      name.className = "checkup-thread-name";
      name.textContent = th.peer || "未命名";
      const time = document.createElement("span");
      time.className = "checkup-thread-time";
      time.textContent = th.at || "";
      top.append(name, time);
      const preview = document.createElement("span");
      preview.className = "checkup-thread-preview";
      const rel = th.relation ? `${th.relation} · ` : "";
      const blk = th.blocked ? "已拉黑 · " : "";
      preview.textContent = blk + rel + resolveCheckupThreadPreview(c, th);
      body.append(top, preview);
      const arrow = document.createElement("i");
      arrow.className = "ph ph-caret-right checkup-thread-arrow";
      arrow.setAttribute("aria-hidden", "true");
      btn.append(av, body, arrow);
      btn.addEventListener("click", () => openChatThread(threadId));
      list.appendChild(btn);
    }
    parent.appendChild(list);
  }

  function openChatThread(threadId) {
    const c = activeCase();
    if (!c || c.kickedOut || activeAppId !== "chats") return;
    if (!threadId) return;
    activeChatThreadId = threadId;
    const data = resolveAppPayload(c, "chats");
    const th = findChatThread(data, threadId);
    if (appTitleEl) appTitleEl.textContent = th?.peer || "聊天";
    renderAppBody("chats");
    if (th?.decode) tryCheckupDiscovery(c, "sensitive");
  }

  function renderWebList(parent, items) {
    const list = document.createElement("div");
    list.className = "checkup-browser-list";
    list.setAttribute("role", "list");
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const itemId = it.id || `web_${i}`;
      const isSearch = it.kind === "search";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "checkup-browser-row" + (isSearch ? " checkup-web-row--search" : "");
      btn.setAttribute("role", "listitem");
      const ico = document.createElement("span");
      ico.className = "checkup-browser-row-ico";
      ico.innerHTML = isSearch
        ? '<i class="ph ph-magnifying-glass" aria-hidden="true"></i>'
        : '<i class="ph ph-globe" aria-hidden="true"></i>';
      const body = document.createElement("span");
      body.className = "checkup-browser-row-body";
      const top = document.createElement("span");
      top.className = "checkup-browser-row-top";
      const title = document.createElement("span");
      title.className = "checkup-browser-row-title";
      title.textContent = isSearch ? it.q || "—" : it.title || "—";
      const time = document.createElement("span");
      time.className = "checkup-thread-time";
      time.textContent = it.at || "";
      top.append(title, time);
      const sub = document.createElement("span");
      sub.className = "checkup-browser-row-sub";
      if (isSearch) {
        sub.textContent = `搜索${it.preview ? ` · ${it.preview}` : ""}`;
      } else {
        sub.textContent = `${it.host || ""}${it.preview ? ` · ${it.preview}` : ""}`;
      }
      body.append(top, sub);
      const arrow = document.createElement("i");
      arrow.className = "ph ph-caret-right checkup-thread-arrow";
      arrow.setAttribute("aria-hidden", "true");
      btn.append(ico, body, arrow);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openWebItem(itemId);
      });
      list.appendChild(btn);
    }
    parent.appendChild(list);
  }

  function renderWebDetail(panel, it) {
    const isSearch = it.kind === "search";
    const url = document.createElement("p");
    url.className = "checkup-detail-k";
    url.textContent = isSearch ? "搜索记录" : it.host || "";
    panel.appendChild(url);
    const page = document.createElement("div");
    page.className = "checkup-browser-page";
    const pageLab = document.createElement("span");
    pageLab.className = "checkup-browser-page-k";
    pageLab.textContent = isSearch ? "搜索结果" : "页面内容";
    const pageBody = document.createElement("pre");
    pageBody.className = "checkup-browser-page-body";
    pageBody.textContent = it.content || "（无缓存）";
    page.append(pageLab, pageBody);
    panel.appendChild(page);
    if (it.voice) {
      const voice = document.createElement("blockquote");
      voice.className = "checkup-voice";
      const voiceK = document.createElement("span");
      voiceK.className = "checkup-voice-k";
      voiceK.textContent = "心声";
      const voiceT = document.createElement("p");
      voiceT.className = "checkup-voice-t";
      voiceT.textContent = it.voice;
      voice.append(voiceK, voiceT);
      panel.appendChild(voice);
    }
  }

  function renderSecretsEntries(panel, data) {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    for (const entry of entries) {
      const block = document.createElement("article");
      block.className = "checkup-secret-entry" + (entry.kind === "draft" ? " is-draft" : "");
      const head = document.createElement("header");
      head.className = "checkup-secret-entry-head";
      const lab = document.createElement("span");
      lab.className = "checkup-secret-kind";
      lab.textContent = secretKindLabel(entry.kind);
      const time = document.createElement("span");
      time.className = "checkup-search-hint";
      time.textContent = entry.at || "";
      head.append(lab, time);
      block.appendChild(head);
      if (entry.title && entry.title !== secretKindLabel(entry.kind)) {
        const title = document.createElement("h3");
        title.className = "checkup-secret-title";
        title.textContent = entry.title;
        block.appendChild(title);
      }
      if (entry.body) {
        const p = document.createElement("p");
        p.className = "checkup-secret-body";
        setCheckupInlineTransEl(p, entry.body, entry.translation);
        block.appendChild(p);
      }
      panel.appendChild(block);
    }
  }

  function openWebItem(itemId) {
    const c = activeCase();
    if (!c || activeAppId !== "web" || !itemId) return;
    activeWebItemId = itemId;
    const data = resolveAppPayload(c, "web");
    const it = findWebItem(data, itemId);
    if (!it) {
      activeWebItemId = null;
      renderAppBody("web");
      return;
    }
    const title = it.kind === "search" ? it.q : it.title;
    if (appTitleEl) appTitleEl.textContent = String(title || "浏览搜索").slice(0, 18);
    renderAppBody("web");
    if (it.voice) tryCheckupDiscovery(c, "sensitive");
  }

  function appendDetailSection(parent, idx, label, bodyFn) {
    const sec = document.createElement("article");
    sec.className = "checkup-piece";
    const head = document.createElement("header");
    head.className = "checkup-piece-head";
    const lab = document.createElement("span");
    lab.className = "checkup-piece-title";
    lab.textContent = label;
    const idxEl = document.createElement("span");
    idxEl.className = "checkup-piece-n";
    idxEl.textContent = idx;
    head.append(lab, idxEl);
    const panel = document.createElement("div");
    panel.className = "checkup-piece-body";
    bodyFn(panel);
    sec.append(head, panel);
    parent.appendChild(sec);
  }

  function renderAppBody(appId) {
    const c = activeCase();
    if (!c || !appBodyEl) return;
    const data = resolveAppPayload(c, appId);
    appBodyEl.replaceChildren();

    appendDetailSection(appBodyEl, "01", caseCharPhoneLabel(c), (panel) => {
      const src = appContentSource(c, appId);
      const noteSec = document.createElement("p");
      noteSec.className = "checkup-demo-note";
      noteSec.textContent = src === "ai" ? "可重新生成本板块" : `${caseCharPhoneLabel(c)} · 尚未生成`;
      const row = document.createElement("div");
      row.className = "checkup-gen-one-row";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "checkup-gen-one-btn";
      btn.textContent = genBusy ? "生成中…" : src === "ai" ? "重新生成" : "生成本板块";
      btn.disabled = genBusy;
      btn.addEventListener("click", () => {
        void generateCheckupAppsSequential([appId]);
      });
      row.appendChild(btn);
      panel.append(noteSec, row);
    });

    if (appId === "chats") {
      const threads = data.threads || [];
      if (!activeChatThreadId) {
        appendDetailSection(appBodyEl, "02", `对话 · ${threads.length}`, (panel) => {
          if (!threads.length) renderEmptyPanel(panel, "尚无内容，请生成本板块");
          else renderChatThreadList(panel, threads);
        });
      } else {
        const th = findChatThread(data, activeChatThreadId);
        if (!th) {
          activeChatThreadId = null;
          renderAppBody("chats");
          return;
        }
        appendDetailSection(appBodyEl, "02", th.peer || "对话", (panel) => {
          if (th.relation) {
            const rel = document.createElement("p");
            rel.className = "checkup-detail-k";
            rel.textContent = `${th.relation}${th.at ? ` · ${th.at}` : ""}`;
            panel.appendChild(rel);
          }
          renderChatBubbles(panel, th, c);
          renderCharProxyComposer(panel, th);
        });
      }
    } else if (appId === "calls") {
      const items = data.items || [];
      appendDetailSection(appBodyEl, "02", `通话 · ${items.length}`, (panel) => {
        if (!items.length) renderEmptyPanel(panel, "尚无内容，请生成本板块");
        else renderCallsList(panel, items);
      });
    } else if (appId === "notes") {
      const entries = Array.isArray(data.entries) ? data.entries : [];
      appendDetailSection(appBodyEl, "02", data.title || "备忘录", (panel) => {
        if (!entries.length) renderEmptyPanel(panel, "尚无内容，请生成本板块");
        else renderNotesEntries(panel, data);
      });
    } else if (appId === "web") {
      const items = data.items || [];
      if (!activeWebItemId) {
        appendDetailSection(appBodyEl, "02", `足迹 · ${items.length}`, (panel) => {
          if (!items.length) renderEmptyPanel(panel, "尚无内容，请生成本板块");
          else renderWebList(panel, items);
        });
      } else {
        const it = findWebItem(data, activeWebItemId);
        if (!it) {
          activeWebItemId = null;
          renderAppBody("web");
          return;
        }
        const secTitle = it.kind === "search" ? it.q : it.title;
        appendDetailSection(appBodyEl, "02", secTitle || "详情", (panel) => {
          renderWebDetail(panel, it);
        });
      }
    } else if (appId === "secrets") {
      appendDetailSection(appBodyEl, "02", "秘密空间", (panel) => {
        const entries = data.entries || [];
        if (!entries.length) renderEmptyPanel(panel, "尚无内容，请生成本板块");
        else renderSecretsEntries(panel, data);
      });
    } else if (appId === "shop") {
      appendDetailSection(appBodyEl, "02", "购物 · 外卖", (panel) => {
        const shopItems = data.items || [];
        if (!shopItems.length) {
          renderEmptyPanel(panel, "尚无内容，请生成本板块");
          return;
        }
        for (const it of shopItems) {
          const row = document.createElement("div");
          row.className = "checkup-shop-item";
          const main = document.createElement("span");
          main.className = "checkup-shop-main";
          const kind = it.kind === "delivery" ? "外卖" : "购物";
          const titleEl = document.createElement("strong");
          titleEl.textContent = it.title || "—";
          const subEl = document.createElement("em");
          subEl.textContent = `${kind} · ${it.state || ""}${it.note ? ` · ${it.note}` : ""}`;
          main.append(titleEl, subEl);
          const aside = document.createElement("span");
          aside.className = "checkup-shop-aside";
          if (it.price) {
            const priceEl = document.createElement("span");
            priceEl.className = "checkup-shop-price";
            priceEl.textContent = it.price;
            aside.appendChild(priceEl);
          }
          const meta = document.createElement("span");
          meta.className = "checkup-search-hint";
          meta.textContent = it.at || "";
          aside.appendChild(meta);
          row.append(main, aside);
          panel.appendChild(row);
        }
      });
    } else if (appId === "album") {
      appendDetailSection(appBodyEl, "02", "相册", (panel) => {
        renderAlbumPanel(panel, data);
      });
    }

    syncStarButton();
    tryCheckupDiscovery(c, appId);
  }

  function evidenceKey(appId) {
    const app = APPS.find((a) => a.id === appId);
    return app ? app.label : appId;
  }

  function isStarred(appId) {
    const c = activeCase();
    if (!c) return false;
    return (c.evidence || []).some((e) => e.appId === appId);
  }

  function syncStarButton() {
    if (!starBtn || !activeAppId) return;
    const on = isStarred(activeAppId);
    starBtn.classList.toggle("is-starred", on);
    starBtn.setAttribute("aria-pressed", on ? "true" : "false");
    starBtn.title = on ? "已标为证据 · 再点取消" : "标为证据";
    const ic = starBtn.querySelector("i");
    if (ic) ic.className = on ? "ph-fill ph-star" : "ph ph-star";
  }

  function syncEvidenceTray() {
    const c = activeCase();
    if (!evidenceChipsEl || !evidenceCountEl) return;
    const list = c && Array.isArray(c.evidence) ? c.evidence : [];
    evidenceCountEl.textContent = String(list.length);
    const evSection = document.querySelector("#checkup-screen .checkup-section-label--evidence");
    evSection?.classList.toggle("has-evidence", list.length > 0);
    evidenceChipsEl.replaceChildren();
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "checkup-evidence-empty";
      p.textContent = "在条目内点 ★ 标星证据";
      evidenceChipsEl.appendChild(p);
      if (questionInput && c) questionInput.value = String(c.question || "");
      return;
    }
    for (const e of list) {
      const chip = document.createElement("span");
      chip.className = "checkup-evidence-chip";
      chip.setAttribute("role", "listitem");
      chip.textContent = e.label || evidenceKey(e.appId);
      evidenceChipsEl.appendChild(chip);
    }
    if (questionInput && c) questionInput.value = String(c.question || "");
  }

  function toggleStar() {
    const c = activeCase();
    if (!c || !activeAppId || c.kickedOut) return;
    if (!Array.isArray(c.evidence)) c.evidence = [];
    const idx = c.evidence.findIndex((e) => e.appId === activeAppId);
    if (idx >= 0) {
      c.evidence.splice(idx, 1);
      toast("已取消标星");
    } else {
      c.evidence.push({ appId: activeAppId, label: evidenceKey(activeAppId), at: Date.now() });
      toast("已标为证据");
      if (activeAppId === "chats" || activeAppId === "notes") tryCheckupDiscovery(c, "star");
    }
    c.updatedAt = Date.now();
    writeStore();
    syncStarButton();
    syncEvidenceTray();
    renderPhoneApps();
    syncSessionMasthead();
  }

  function computeCheckupCatchScore(c, trigger) {
    const inten = INTENSITIES.find((x) => x.id === c.intensity) || INTENSITIES[1];
    let catchScore = inten.catchBase;
    const viewedNorm = new Set((c.viewedApps || []).map(normalizeViewedAppId));
    if (viewedNorm.has("chats")) catchScore += 0.12;
    if (viewedNorm.has("notes")) catchScore += 0.06;
    if (viewedNorm.has("web")) catchScore += 0.05;
    if ((c.evidence || []).length >= 2) catchScore += 0.1;
    const proxyN = Array.isArray(c.impersonationSends) ? c.impersonationSends.length : 0;
    if (proxyN) catchScore += Math.min(0.35, 0.18 + proxyN * 0.08);
    const blockN = countCheckupBlockActions(c);
    if (blockN) catchScore += Math.min(0.28, 0.14 + blockN * 0.1);
    const trig = String(trigger || "").trim();
    if (trig === "sensitive") catchScore += 0.08;
    if (trig === "proxy") catchScore += 0.12;
    if (trig === "block") catchScore += 0.16;
    if (trig === "star") catchScore += 0.06;
    if (trig === "chats" || trig === "notes" || trig === "web") catchScore += 0.05;
    return Math.min(0.92, catchScore);
  }

  function writeCheckupCaughtDividerToMitalk(c) {
    if (!c || c.caughtDividerWritten) return true;
    const maskId =
      String(c.maskId || "").trim() ||
      (typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "");
    const threadId = String(c.threadId || "").trim();
    if (!maskId || !threadId) return false;
    if (typeof readChatLogForMaskThread !== "function" || typeof saveChatLogForMaskThread !== "function") {
      return false;
    }
    const log = readChatLogForMaskThread(maskId, threadId);
    log.push({
      role: "notice",
      kind: "checkup_caught",
      at: Date.now(),
      content: "",
      checkupLive: true,
      charName: c.charName || "Ta",
      userName: resolveCheckupUserDisplayName(c)
    });
    c.caughtDividerWritten = true;
    writeStore();
    saveChatLogForMaskThread(maskId, threadId, log);
    if (typeof scheduleRenderChatMessages === "function") scheduleRenderChatMessages();
    if (typeof scheduleChatContextTokenLabelUpdate === "function") scheduleChatContextTokenLabelUpdate();
    return true;
  }

  function kickUserFromCheckup() {
    const c = activeCase();
    if (!c || c.kickedOut) return;
    c.kickedOut = true;
    c.updatedAt = Date.now();
    writeStore();
    toast(`${c.charName || "Ta"}夺回手机，查岗中断`);
    activeAppId = null;
    activeChatThreadId = null;
    activeWebItemId = null;
    showView("phone");
    renderPhoneApps();
    syncSessionMasthead();
  }

  function onCheckupCaught(c) {
    if (!c || c.caught) return;
    c.caught = true;
    c.caughtAt = Date.now();
    writeStore();
    toast(`${c.charName || "Ta"}察觉你在翻手机`);
    writeCheckupCaughtDividerToMitalk(c);
    const runRound =
      typeof runCheckupCaughtAssistantRound === "function" ? runCheckupCaughtAssistantRound : null;
    if (!runRound) return;
    void runRound(c.maskId, c.threadId, { phase: "live" }).then((kick) => {
      if (kick) kickUserFromCheckup();
    });
  }

  function tryCheckupDiscovery(c, trigger) {
    if (!c || c.status !== "open" || c.caught || c.kickedOut) return;
    const score = computeCheckupCatchScore(c, trigger);
    if (Math.random() >= score) return;
    onCheckupCaught(c);
  }

  function openApp(appId) {
    const c = activeCase();
    if (!c) return;
    if (c.kickedOut) {
      toast("已被赶出，无法继续翻看");
      return;
    }
    activeAppId = appId;
    activeChatThreadId = null;
    activeWebItemId = null;
    if (!Array.isArray(c.viewedApps)) c.viewedApps = [];
    const normId = normalizeViewedAppId(appId);
    if (!c.viewedApps.some((id) => normalizeViewedAppId(id) === normId)) c.viewedApps.push(appId);
    c.updatedAt = Date.now();
    writeStore();
    const app = APPS.find((a) => a.id === appId);
    if (appTitleEl) appTitleEl.textContent = app?.label || appId;
    renderAppBody(appId);
    renderPhoneApps();
    showView("app");
  }

  function syncSessionMasthead() {
    const c = activeCase();
    if (!c) return;
    const kicker = document.getElementById("checkup-session-kicker");
    const title = document.getElementById("checkup-session-title");
    const desc = document.getElementById("checkup-session-desc");
    const avImg = document.getElementById("checkup-subject-avatar");
    const avPh = document.getElementById("checkup-subject-ph");
    const statViewed = document.getElementById("checkup-stat-viewed");
    const statEvidence = document.getElementById("checkup-stat-evidence");
    const statIntensity = document.getElementById("checkup-stat-intensity");
    const name = c.charName || "未命名";
    const threadLab = caseThreadLabel(c);
    if (kicker) {
      kicker.textContent = c.status === "open" ? "进行中" : "已结案";
      kicker.classList.toggle("is-live", c.status === "open");
    }
    if (title) title.textContent = threadLab && threadLab !== name ? threadLab : name;
    const viewed = countViewedApps(c);
    const evCount = Array.isArray(c.evidence) ? c.evidence.length : 0;
    if (desc) {
      const parts = [];
      if (threadLab && threadLab !== name) parts.push(name);
      parts.push(caseReasonLabel(c));
      desc.textContent = parts.join(" · ");
    }
    syncDeviceGlance(c);
    if (statViewed) statViewed.textContent = String(viewed);
    if (statEvidence) statEvidence.textContent = String(evCount);
    if (statIntensity) statIntensity.textContent = intensityLabel(c.intensity);
    const url = String(c.charAvatar || "").trim();
    if (avImg && avPh) {
      avImg.className = "checkup-subject-img";
      avPh.className = "checkup-subject-ph";
      if (url) {
        avImg.src = url;
        avImg.alt = "";
        avImg.classList.remove("is-hidden");
        avPh.classList.add("is-hidden");
      } else {
        avImg.removeAttribute("src");
        avImg.classList.add("is-hidden");
        avPh.textContent = charInitial(c.charName);
        avPh.classList.remove("is-hidden");
      }
    }
  }

  function openCasePhone(caseId) {
    activeCaseId = caseId;
    const c = activeCase();
    if (!c) return;
    if (isReverseCase(c)) {
      window.XXJ_CheckupReverse?.openReverseCase?.(caseId);
      return;
    }
    syncSessionMasthead();
    renderPhoneApps();
    syncEvidenceTray();
    if (questionInput) questionInput.value = String(c.question || "");
    showView("phone");
  }

  function openFinishSheet() {
    const c = activeCase();
    if (!c) return;
    if (isReverseCase(c)) {
      window.XXJ_CheckupReverse?.openReverseKickOut?.();
      return;
    }
    if (!finishBodyEl) return;
    if (questionInput) c.question = String(questionInput.value || "").trim();
    const caught = c.caught === true;
    const proxyN = Array.isArray(c.impersonationSends) ? c.impersonationSends.length : 0;
    const blockN = countCheckupBlockActions(c);
    const evCount = (c.evidence || []).length;
    const proxyNote = proxyN ? `代发过 ${proxyN} 条消息。` : "";
    const blockNote = blockN ? `拉黑过 ${blockN} 人。` : "";
    const kickedNote = c.kickedOut ? "查岗已被中断。" : "";
    finishBodyEl.replaceChildren();
    const outcome = document.createElement("p");
    outcome.className = "checkup-finish-outcome " + (caught ? "checkup-finish-outcome--caught" : "checkup-finish-outcome--safe");
    outcome.textContent = caught ? "已被察觉" : "暂未被发现";
    const note = document.createElement("p");
    note.className = "checkup-finish-note";
    note.textContent = caught
      ? `${kickedNote}${c.charName || "Ta"} 察觉你翻看过手机。${proxyNote}${blockNote}确认结案后将写入密谈。${evCount ? `已标星 ${evCount} 条证据。` : ""}`
      : `${kickedNote}你悄悄合上了手机。${proxyNote}${blockNote}确认结案后将写入密谈一条查岗票根。${evCount ? `共标星 ${evCount} 条。` : "尚未标星。"}`;
    finishBodyEl.append(outcome, note);
    openSheet("checkup-sheet-finish");
  }

  function closeFinishSheet() {
    closeSheet("checkup-sheet-finish");
  }

  function clipExcerptText(s, max) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function formatStarredAppExcerpt(appId, payload) {
    if (!payload || typeof payload !== "object") return "";
    switch (appId) {
      case "chats": {
        const threads = Array.isArray(payload.threads) ? payload.threads : [];
        return threads
          .slice(0, 3)
          .map((th) => {
            const peer = clipExcerptText(th.peer, 16) || "对话";
            const tail = (Array.isArray(th.messages) ? th.messages : [])
              .slice(-2)
              .map((m) => `${m.who === "me" ? "我" : peer}：${clipExcerptText(m.text, 48)}`)
              .join("；");
            return `${peer}：${tail || clipExcerptText(th.preview, 64)}`;
          })
          .join("\n");
      }
      case "notes": {
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        return entries
          .slice(0, 3)
          .map((e) => {
            if (e.type === "voice") return `录音：${clipExcerptText(e.transcript || e.label, 88)}`;
            return clipExcerptText(String(e.body || "").replace(/\n/g, " "), 100);
          })
          .join("\n");
      }
      case "web": {
        const items = Array.isArray(payload.items) ? payload.items : [];
        return items
          .slice(0, 4)
          .map((it) =>
            it.kind === "search" ? `搜：${clipExcerptText(it.q, 48)}` : `页：${clipExcerptText(it.title, 48)}`
          )
          .join("\n");
      }
      case "calls": {
        const items = Array.isArray(payload.items) ? payload.items : [];
        return items
          .slice(0, 4)
          .map((it) => {
            const typ = it.type === "missed" ? "未接" : it.type === "in" ? "来电" : "去电";
            const dur = clipExcerptText(it.duration, 12);
            return `${typ} ${clipExcerptText(it.peer, 14)} ${clipExcerptText(it.at, 14)}${dur ? " " + dur : ""}`;
          })
          .join("\n");
      }
      case "secrets": {
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        return entries
          .slice(0, 4)
          .map((e) => {
            const kind = secretKindLabel(e.kind);
            const title = clipExcerptText(e.title, 20);
            const body = clipExcerptText(String(e.body || "").replace(/\n/g, " "), 56);
            return `${kind}${title ? " · " + title : ""}${body ? "：" + body : ""}`;
          })
          .join("\n");
      }
      case "shop": {
        const items = Array.isArray(payload.items) ? payload.items : [];
        return items
          .slice(0, 4)
          .map((it) => {
            const price = it.price ? `${clipExcerptText(it.price, 12)} ` : "";
            return `${price}${clipExcerptText(it.state, 8)} ${clipExcerptText(it.title, 48)}`;
          })
          .join("\n");
      }
      case "album": {
        const photos = Array.isArray(payload.photos) ? payload.photos : [];
        if (photos.length) {
          return photos
            .slice(0, 5)
            .map((ph) => clipExcerptText(ph.caption || ph.note, 56))
            .filter(Boolean)
            .join("\n");
        }
        return clipExcerptText(payload.caption, 88);
      }
      default:
        return "";
    }
  }

  function buildStarredEvidenceDetails(c) {
    const ev = Array.isArray(c.evidence) ? c.evidence : [];
    const out = [];
    for (const e of ev) {
      const appId = String(e.appId || "").trim();
      if (!appId) continue;
      out.push({
        appId,
        label: e.label || evidenceKey(appId),
        excerpt: formatStarredAppExcerpt(appId, c.demo?.[appId])
      });
    }
    return out;
  }

  function buildCheckupFinishReport(c) {
    if (!c) return "";
    const lines = [];
    lines.push(`查岗 · ${c.charName || "Ta"}`);
    lines.push(`理由：${caseReasonLabel(c)}`);
    lines.push(`强度：${intensityLabel(c.intensity)}`);
    if (c.kickedOut) lines.push("状态：查岗被中断（Ta 夺回手机）");
    lines.push(`结果：${c.caught ? "被发现" : "未被发现"}`);
    const details = buildStarredEvidenceDetails(c);
    lines.push("");
    if (details.length) {
      lines.push("标星证据（仅含 ★ 板块）：");
      for (const d of details) {
        lines.push(`· ${d.label}`);
        if (d.excerpt) {
          for (const row of d.excerpt.split("\n")) {
            if (row.trim()) lines.push(`  ${row}`);
          }
        }
      }
    } else {
      lines.push("标星证据：无");
    }
    const q = String(c.question || "").trim();
    if (q) {
      lines.push("");
      lines.push(`质问：${q}`);
    }
    const proxy = Array.isArray(c.impersonationSends) ? c.impersonationSends : [];
    if (proxy.length) {
      lines.push("");
      lines.push(`代发 ${proxy.length} 条（均非 ${c.charName || "Ta"} 本人笔迹，是他人持其手机发出）：`);
      for (const p of proxy) {
        const peer = String(p.peer || "某人").trim() || "某人";
        const text = String(p.text || "").replace(/\s+/g, " ").trim().slice(0, 160);
        lines.push(`· 发给 ${peer}：${text || "…"}`);
      }
    }
    const blocks = Array.isArray(c.impersonationBlocks) ? c.impersonationBlocks : [];
    if (blocks.length) {
      lines.push("");
      lines.push("拉黑变动：");
      for (const b of blocks) {
        const peer = String(b.peer || "某人").trim() || "某人";
        lines.push(`· ${b.blocked ? "拉黑" : "取消拉黑"} ${peer}`);
      }
    }
    return lines.join("\n").slice(0, 12_000);
  }

  function writeCheckupFinishToMitalk(c) {
    if (!c) return false;
    const maskId =
      String(c.maskId || "").trim() ||
      (typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "");
    const threadId = String(c.threadId || "").trim();
    if (!maskId || !threadId) {
      toast("无法写回密谈：缺少线程信息");
      return false;
    }
    if (typeof readChatLogForMaskThread !== "function" || typeof saveChatLogForMaskThread !== "function") {
      toast("无法写回密谈：聊天模块未就绪");
      return false;
    }
    const q = String(c.question || "").trim();
    const evDetails = buildStarredEvidenceDetails(c);
    const evLabels = evDetails.map((d) => d.label);
    const at = Date.now();
    const report = buildCheckupFinishReport(c);
    const log = readChatLogForMaskThread(maskId, threadId);
    const noticeBase = {
      role: "notice",
      at,
      content: "",
      checkupReport: report,
      checkupReason: caseReasonLabel(c),
      checkupQuestion: q,
      checkupEvidence: evLabels,
      checkupEvidenceDetail: evDetails,
      charName: c.charName || "Ta",
      userName: resolveCheckupUserDisplayName(c)
    };
    if (c.kickedOut === true) noticeBase.kickedOut = true;
    if (c.caught === true) {
      let patched = false;
      if (c.caughtDividerWritten) {
        for (let i = log.length - 1; i >= 0; i--) {
          if (log[i]?.kind === "checkup_caught") {
            Object.assign(log[i], noticeBase);
            delete log[i].checkupLive;
            patched = true;
            break;
          }
        }
      }
      if (!patched) {
        log.push({ ...noticeBase, kind: "checkup_caught" });
      }
    } else {
      log.push({ ...noticeBase, kind: "checkup_finish" });
    }
    if (q) {
      log.push({
        role: "user",
        content: q,
        at: at + 1
      });
    }
    saveChatLogForMaskThread(maskId, threadId, log);
    if (typeof scheduleRenderChatMessages === "function") scheduleRenderChatMessages();
    if (typeof scheduleChatContextTokenLabelUpdate === "function") scheduleChatContextTokenLabelUpdate();
    return true;
  }

  function confirmFinish() {
    const c = activeCase();
    if (!c) return;
    if (questionInput) c.question = String(questionInput.value || "").trim();
    c.status = "done";
    c.updatedAt = Date.now();
    writeStore();
    const wrote = writeCheckupFinishToMitalk(c);
    closeFinishSheet();
    activeCaseId = null;
    activeAppId = null;
    activeChatThreadId = null;
    activeWebItemId = null;
    showView("hub");
    renderCaseList();
    if (wrote) toast("已结案");
    else toast("写回密谈失败");
  }

  function openCheckupScreenShell() {
    loadCss();
    screen?.classList.add("is-open");
    screen?.setAttribute("aria-hidden", "false");
  }

  function openCheckupScreen() {
    loadCss();
    cases = readStore();
    migrateAllCasesLegacyAppIds();
    if (typeof closeSettings === "function") closeSettings();
    if (typeof closeMyScreen === "function") closeMyScreen();
    if (typeof closeCharScreen === "function") closeCharScreen();
    if (typeof closeChatScreen === "function") closeChatScreen();
    if (typeof closeChatListScreen === "function") closeChatListScreen();
    if (typeof closeStickerScreen === "function") closeStickerScreen();
    if (typeof closeWardrobeScreen === "function") closeWardrobeScreen();
    if (typeof closeWorldBookScreen === "function") closeWorldBookScreen();
    if (typeof closeRoamScreen === "function") closeRoamScreen();
    if (typeof closeRelationScreen === "function") closeRelationScreen();
    if (typeof closeRoleplayScreen === "function") closeRoleplayScreen();
    document.getElementById("drawer")?.classList.remove("open");
    activeCaseId = null;
    activeAppId = null;
    activeChatThreadId = null;
    activeWebItemId = null;
    showView("hub");
    renderCaseList();
    openCheckupScreenShell();
  }

  function closeCheckupScreen() {
    window.XXJ_CheckupReverse?.stopAutoplay?.();
    closeNewCaseSheet();
    closeGenSheet();
    closeFinishSheet();
    screen?.classList.remove("is-open");
    screen?.setAttribute("aria-hidden", "true");
  }

  window.openCheckupScreen = openCheckupScreen;
  window.closeCheckupScreen = closeCheckupScreen;

  document.getElementById("checkup-close")?.addEventListener("click", closeCheckupScreen);
  document.getElementById("checkup-new-case-btn")?.addEventListener("click", openNewCaseSheet);
  document.getElementById("checkup-sheet-new-close")?.addEventListener("click", closeNewCaseSheet);
  document.getElementById("checkup-sheet-new-backdrop")?.addEventListener("click", closeNewCaseSheet);
  document.getElementById("checkup-form-start")?.addEventListener("click", startCaseFromForm);
  document.getElementById("checkup-phone-to-hub")?.addEventListener("click", () => {
    activeCaseId = null;
    activeAppId = null;
    activeChatThreadId = null;
    activeWebItemId = null;
    showView("hub");
    renderCaseList();
  });
  document.getElementById("checkup-app-back")?.addEventListener("click", () => {
    if (activeAppId === "chats" && activeChatThreadId) {
      activeChatThreadId = null;
      const app = APPS.find((a) => a.id === "chats");
      if (appTitleEl) appTitleEl.textContent = app?.label || "聊天";
      renderAppBody("chats");
      return;
    }
    if (activeAppId === "web" && activeWebItemId) {
      activeWebItemId = null;
      const app = APPS.find((a) => a.id === "web");
      if (appTitleEl) appTitleEl.textContent = app?.label || "浏览搜索";
      renderAppBody("web");
      return;
    }
    activeAppId = null;
    activeChatThreadId = null;
    activeWebItemId = null;
    showView("phone");
  });
  document.getElementById("checkup-star-btn")?.addEventListener("click", toggleStar);
  document.getElementById("checkup-gen-btn")?.addEventListener("click", openGenSheet);
  document.getElementById("checkup-sheet-gen-close")?.addEventListener("click", closeGenSheet);
  document.getElementById("checkup-sheet-gen-backdrop")?.addEventListener("click", closeGenSheet);
  document.getElementById("checkup-gen-toggle-all")?.addEventListener("click", () => {
    const root = document.getElementById("checkup-gen-picks");
    if (!root) return;
    const chips = [...root.querySelectorAll(".checkup-gen-chip[data-gen-app]")];
    const allOn = chips.every((el) => el.classList.contains("is-on"));
    for (const el of chips) el.classList.toggle("is-on", !allOn);
    syncGenToggleAllLabel();
  });
  document.getElementById("checkup-gen-all-btn")?.addEventListener("click", () => {
    void generateCheckupBundle(GEN_MODULES.map((m) => m.id));
  });
  document.getElementById("checkup-gen-pick-btn")?.addEventListener("click", () => {
    const ids = getCheckedGenAppIds();
    if (!ids.length) {
      toast("请至少选一个板块");
      return;
    }
    void generateCheckupBundle(ids);
  });
  document.getElementById("checkup-gen-seq-btn")?.addEventListener("click", () => {
    const ids = getCheckedGenAppIds();
    if (!ids.length) {
      toast("请至少选一个板块");
      return;
    }
    void generateCheckupAppsSequential(ids);
  });
  document.getElementById("checkup-finish-btn")?.addEventListener("click", openFinishSheet);
  document.getElementById("checkup-sheet-finish-close")?.addEventListener("click", closeFinishSheet);
  document.getElementById("checkup-sheet-finish-backdrop")?.addEventListener("click", closeFinishSheet);
  document.getElementById("checkup-finish-stay")?.addEventListener("click", closeFinishSheet);
  document.getElementById("checkup-finish-confirm")?.addEventListener("click", confirmFinish);
  questionInput?.addEventListener("change", () => {
    const c = activeCase();
    if (!c) return;
    c.question = String(questionInput.value || "").trim();
    c.updatedAt = Date.now();
    writeStore();
  });

  loadCss();

  const checkupCoreHooks = {
    activeCase,
    getCaseById: (id) => cases.find((c) => c.id === id) || null,
    setActiveCaseId: (id) => {
      activeCaseId = id;
    },
    hasOpenReverseCase,
    createProactiveReverseCase,
    openCheckupScreenShell,
    writeStore,
    showView,
    toast,
    openSheet,
    closeSheet,
    caseReasonLabel,
    caseThreadLabel,
    renderCaseList,
    buildCaseContextBlock
  };
  window.XXJ_CheckupCore = checkupCoreHooks;
  window.XXJ_CheckupReverse?.init?.(checkupCoreHooks);
})();

