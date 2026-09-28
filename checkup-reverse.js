"use strict";

/**
 * 查岗 · 反向（TA 查我）旁观流 + 真实副作用
 */
(function () {
  const ASSET_V = "348";
  const NOTIFY_GATE_AUTO_SEC = 8;
  const DWELL_NOTIFY_MS = 2200;
  const DWELL_PANEL_MS = 3200;
  const DWELL_CHAT_MS = 4000;
  const DWELL_BETWEEN_MS = 900;
  const DWELL_AFTER_ACTION_MIN_MS = 2400;
  const PROACTIVE_FIRST_MIN_MS = 12 * 60 * 1000;
  const PROACTIVE_FIRST_MAX_MS = 20 * 60 * 1000;
  const PROACTIVE_INTERVAL_MIN_MS = 28 * 60 * 1000;
  const PROACTIVE_INTERVAL_MAX_MS = 42 * 60 * 1000;
  const PROACTIVE_CHAR_COOLDOWN_MS = 4 * 60 * 60 * 1000;
  const K_SNOOP_LAST = "CHECKUP_REVERSE_SNOOP_LAST_V1";
  const PILL_POS_KEY = "checkup_reverse_pill_pos";
  const DWELL_AFTER_THOUGHT_MIN_MS = 2800;
  const DWELL_AFTER_THOUGHT_MAX_MS = 5000;
  const THOUGHT_MAX_LEN = 160;
  const reverseBody = document.getElementById("checkup-reverse-body");
  const reverseThought = document.getElementById("checkup-reverse-thought");
  const reverseThoughtWrap = document.getElementById("checkup-reverse-thought-wrap");
  const reverseBarState = document.getElementById("checkup-reverse-bar-state");
  const reverseBarName = document.getElementById("checkup-reverse-bar-name");
  const reverseStepLab = document.getElementById("checkup-reverse-step");
  const reverseAvImg = document.getElementById("checkup-reverse-avatar");
  const reverseAvPh = document.getElementById("checkup-reverse-avatar-ph");
  const reverseNextBtn = document.getElementById("checkup-reverse-next");
  const reverseAppbar = document.getElementById("checkup-reverse-appbar");
  const reverseAppbarK = document.getElementById("checkup-reverse-appbar-k");
  const reverseAppbarT = document.getElementById("checkup-reverse-appbar-t");
  const reverseAppbarBack = document.getElementById("checkup-reverse-appbar-back");
  const reverseTabs = document.getElementById("checkup-reverse-tabs");
  const reverseOpFloat = document.getElementById("checkup-reverse-op-float");
  const reverseOpFloatText = document.getElementById("checkup-reverse-op-float-t");
  const reverseOpFloatTime = document.getElementById("checkup-reverse-op-float-time");
  let operationHintTimer = 0;
  let lastRecState = "";
  let proactiveTimer = 0;
  let proactiveInterval = 0;
  let proactiveBusy = false;
  let pillDrag = { active: false, moved: false, suppressClick: false, startX: 0, startY: 0, origLeft: 0, origTop: 0, w: 0, h: 0 };
  const reverseMinimizeBtn = document.getElementById("checkup-reverse-minimize-btn");
  const reverseMinimizedPill = document.getElementById("checkup-reverse-minimized-pill");
  const reverseMinimizedPillT = document.getElementById("checkup-reverse-minimized-pill-t");
  const reverseMinimizedPillSub = document.getElementById("checkup-reverse-minimized-pill-sub");
  const reverseMinimizedPillAv = document.getElementById("checkup-reverse-minimized-pill-av");
  const reverseMinimizedPillPh = document.getElementById("checkup-reverse-minimized-pill-ph");
  const checkupScreenEl = document.getElementById("checkup-screen");
  const reverseNotifyGate = document.getElementById("checkup-reverse-notify-gate");
  const reverseNotifyGateTitle = document.getElementById("checkup-reverse-notify-gate-title");
  const reverseNotifyGateHint = document.getElementById("checkup-reverse-notify-gate-hint");
  const reverseNotifyGateImg = document.getElementById("checkup-reverse-notify-gate-img");
  const reverseNotifyGatePh = document.getElementById("checkup-reverse-notify-gate-ph");
  const reverseNotifyAcceptBtn = document.getElementById("checkup-reverse-notify-accept");
  const reverseNotifyMinimizeBtn = document.getElementById("checkup-reverse-notify-minimize");
  const reverseNotifyRefuseBtn = document.getElementById("checkup-reverse-notify-refuse");

  /** @type {null | Record<string, unknown>} */
  let deps = null;
  let wired = false;
  let aiBusy = false;
  let autoplayToken = 0;
  let autoplayRunning = false;
  let autoplayPaused = false;
  /** @type {null | ((v: string) => void)} */
  let notifyGateResolver = null;
  let notifyGateCountdownTimer = 0;
  let notifyGateCountdownLeft = NOTIFY_GATE_AUTO_SEC;
  let reverseLastPanelId = "";

  function delay(ms) {
    return new Promise((r) => window.setTimeout(r, ms));
  }

  function stopAutoplay() {
    autoplayToken += 1;
    autoplayRunning = false;
    if (notifyGateResolver) resolveNotifyGate("cancel");
    else hideNotifyGate();
  }

  function panelDwellMs(panelId) {
    if (panelId === "notify") return DWELL_NOTIFY_MS;
    if (String(panelId || "").startsWith("chat:")) return DWELL_CHAT_MS;
    return DWELL_PANEL_MS;
  }

  function thoughtDwellMs(text) {
    const n = String(text || "").trim().length;
    if (!n) return DWELL_AFTER_THOUGHT_MIN_MS;
    return Math.min(DWELL_AFTER_THOUGHT_MAX_MS, Math.max(DWELL_AFTER_THOUGHT_MIN_MS, n * 65));
  }

  function syncReverseStepLabel(c) {
    const rs = ensureReverseState(c);
    if (!reverseStepLab || !rs.script.length) return;
    const cur = Math.min(rs.step + 1, rs.script.length);
    reverseStepLab.textContent = `${cur}/${rs.script.length}`;
  }

  /** 本页动作结果展示停留（不含内心独白，独白单独 dwell） */
  function resolvePanelCompleteDwellMs(spec, result, panelId) {
    const action = String(spec?.action || "LOOK_ONLY").toUpperCase();
    const applied = result?.applied === true;
    if (applied && action !== "LOOK_ONLY" && action !== "REACT") {
      return Math.max(DWELL_AFTER_ACTION_MIN_MS, Math.floor(panelDwellMs(panelId) * 0.55));
    }
    return Math.max(1200, Math.floor(panelDwellMs(panelId) * 0.28));
  }

  function advancePastNotifyStep(c) {
    const rs = ensureReverseState(c);
    rs.step += 1;
    if (rs.step >= rs.script.length) rs.done = true;
    c.updatedAt = Date.now();
    deps?.writeStore?.();
  }

  function clipThought(s) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    if (t.length <= THOUGHT_MAX_LEN) return t;
    return `${t.slice(0, THOUGHT_MAX_LEN - 1)}…`;
  }

  function sanitizeThoughtForDisplay(text, ownerName) {
    let t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    const name = String(ownerName || "").trim() || "他";
    t = t
      .replace(/主控/g, name)
      .replace(/机主/g, name)
      .replace(/用户(?!名)/g, name)
      .replace(/查岗/g, "翻手机")
      .replace(/\b(JSON|action|SEND_\w+)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return clipThought(t);
  }

  function displayThought(c, text) {
    if (!reverseThought) return;
    const owner = resolveUserDisplay().name;
    const clean = sanitizeThoughtForDisplay(text, owner);
    reverseThought.textContent = clean || "—";
    if (reverseThoughtWrap) {
      reverseThoughtWrap.classList.toggle("is-empty", !clean || clean === "—");
    }
  }

  function clearOperationHint() {
    if (operationHintTimer) window.clearTimeout(operationHintTimer);
    operationHintTimer = 0;
    if (reverseOpFloat) {
      reverseOpFloat.hidden = true;
      reverseOpFloat.classList.remove("is-show");
    }
    if (reverseOpFloatText) reverseOpFloatText.textContent = "";
    if (reverseOpFloatTime) reverseOpFloatTime.textContent = "";
    if (reverseBarState && lastRecState) reverseBarState.textContent = lastRecState;
  }

  function showOperationFloat(text, holdMs) {
    const t = String(text || "").trim();
    if (!t || !reverseOpFloat || !reverseOpFloatText) return;
    reverseOpFloatText.textContent = t;
    if (reverseOpFloatTime) {
      const d = new Date();
      reverseOpFloatTime.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    reverseOpFloat.hidden = false;
    reverseOpFloat.classList.add("is-show");
    if (operationHintTimer) window.clearTimeout(operationHintTimer);
    const ms = Number(holdMs) > 0 ? Number(holdMs) : 6200;
    operationHintTimer = window.setTimeout(() => {
      reverseOpFloat.classList.remove("is-show");
      reverseOpFloat.hidden = true;
      if (reverseBarState) {
        reverseBarState.textContent = lastRecState || "旁观中";
        reverseBarState.classList.remove("is-op");
      }
    }, ms);
  }

  function showOperationHint(c, text, shortState, holdMs) {
    const t = String(text || "").trim();
    if (!t) return;
    showOperationFloat(t, holdMs || 6200);
    if (reverseBarState) {
      if (!lastRecState || /旁观|翻看|暂停/.test(String(reverseBarState.textContent || ""))) {
        lastRecState = String(reverseBarState.textContent || "旁观中");
      }
      reverseBarState.textContent = String(shortState || "操作中").slice(0, 12);
      reverseBarState.classList.add("is-op");
    }
  }

  function toast(msg) {
    if (deps?.toast) deps.toast(msg);
    else if (typeof showToast === "function") showToast(msg);
  }

  function isReverseCase(c) {
    return !!(c && String(c.direction || "forward") === "reverse");
  }

  function ensureReverseState(c) {
    if (!c.reverse || typeof c.reverse !== "object") {
      c.reverse = {
        step: 0,
        script: [],
        viewed: [],
        actions: [],
        reactions: [],
        done: false,
        minimized: false
      };
    }
    if (c.reverse.minimized !== true) c.reverse.minimized = false;
    if (!Array.isArray(c.reverse.viewed)) c.reverse.viewed = [];
    if (!Array.isArray(c.reverse.actions)) c.reverse.actions = [];
    if (!Array.isArray(c.reverse.reactions)) c.reverse.reactions = [];
    return c.reverse;
  }

  function maskKey(maskId) {
    return typeof maskBucketKey === "function" ? maskBucketKey(maskId) : String(maskId || "");
  }

  function isGroupThread(thread) {
    if (!thread) return false;
    if (typeof isChatThreadGroupForUi === "function") return isChatThreadGroupForUi(thread);
    return String(thread.kind || "") === "group";
  }

  function listDmThreadsForMask(maskId) {
    if (typeof readChatInboxStore !== "function") return [];
    const inbox = readChatInboxStore();
    const key = maskKey(maskId);
    const bucket = inbox?.byMask?.[key];
    const threads = Array.isArray(bucket?.threads) ? bucket.threads : [];
    return threads.filter((t) => t && !isGroupThread(t) && String(t.charId || "").trim());
  }

  function listBrowsableThreadsForMask(maskId, checkerCharId) {
    if (typeof readChatInboxStore !== "function") return [];
    const inbox = readChatInboxStore();
    const key = maskKey(maskId);
    const bucket = inbox?.byMask?.[key];
    const threads = Array.isArray(bucket?.threads) ? bucket.threads : [];
    const cid = String(checkerCharId || "").trim();
    const out = [];
    for (const t of threads) {
      if (!t) continue;
      if (isGroupThread(t)) {
        const members = Array.isArray(t.memberCharIds) ? t.memberCharIds : [];
        if (!cid || members.map((x) => String(x || "").trim()).includes(cid)) out.push(t);
      } else if (String(t.charId || "").trim()) {
        out.push(t);
      }
    }
    out.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    return out;
  }

  function findThreadInMask(maskId, threadId, checkerCharId) {
    const tid = String(threadId || "").trim();
    if (!tid) return null;
    const hit = listBrowsableThreadsForMask(maskId, checkerCharId).find((t) => String(t.id) === tid);
    if (hit) return hit;
    if (typeof findInboxThreadById === "function") return findInboxThreadById(maskId, tid);
    return listDmThreadsForMask(maskId).find((t) => String(t.id) === tid) || null;
  }

  function groupSpeakerName(thread, msg) {
    const speakerFn = window.XXJ_GroupChat?.speakerCharIdFromMessage;
    const callFn = window.XXJ_GroupChat?.groupCallNameForRef;
    const nameFn = window.XXJ_GroupChat?.charDisplayName;
    const cid =
      (typeof speakerFn === "function" ? speakerFn(msg, thread) : "") ||
      String(msg?.speakerCharId || "").trim();
    if (typeof callFn === "function" && cid) return callFn(thread, cid);
    if (typeof nameFn === "function" && cid) return nameFn(cid);
    if (cid && typeof getCharPersonaItemById === "function") {
      const ch = getCharPersonaItemById(cid);
      if (ch) return String(ch.name || ch.displayName || "").trim() || "成员";
    }
    return "成员";
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

  function isImChatLogMessage(m) {
    if (!m || typeof m !== "object") return false;
    if (m.charLockSessionOnly) return false;
    if (typeof isPersonaFoldBoundaryMessage === "function" && isPersonaFoldBoundaryMessage(m)) return false;
    if (typeof isChatSystemNotice === "function" && isChatSystemNotice(m)) return false;
    if (typeof chatMessageDmSurface === "function") return chatMessageDmSurface(m) !== "offline";
    return m.dmSurface !== "offline";
  }

  function stripOfflineProseFromImText(text) {
    let t = String(text || "").trim();
    if (!t) return "";
    if (typeof stripOfflineMeetupTagFromAssistantReply === "function") {
      t = stripOfflineMeetupTagFromAssistantReply(t);
    }
    t = t.replace(/\[OFFLINE:\s*[\s\S]*?\]/gi, "").replace(/\s+/g, " ").trim();
    return t;
  }

  /** 翻手机可见的线上气泡正文（不含旁白/线下块） */
  function imMessageDisplayText(m) {
    if (!m || typeof m !== "object") return "";
    const raw = String(m.content ?? "").trim();
    const segs = raw
      ? raw
          .split(/\|\|\|/)
          .map((s) => stripOfflineProseFromImText(s))
          .filter(Boolean)
      : [];
    let text = segs.join("|||");
    if (!text && typeof chatMessagePlainLastBubbleSegment === "function") {
      text = stripOfflineProseFromImText(chatMessagePlainLastBubbleSegment(m.content, m) || "");
    }
    if (!text && m.redpack) text = "【红包】";
    return text;
  }

  function translationSegmentSkipped(s) {
    const t = String(s ?? "").trim();
    if (!t) return true;
    if (typeof isTranslationSegmentSkipped === "function") return isTranslationSegmentSkipped(t);
    return t === "[SKIP]" || t === "SKIP";
  }

  function normalizeTransCompare(s) {
    return String(s || "")
      .replace(/\s+/g, "")
      .replace(/[，,。.!！?？…~～\-—]/g, "")
      .trim();
  }

  function translationWorthShowing(text, translation) {
    const main = String(text || "").trim();
    const tr = String(translation || "").trim();
    if (!main || !tr || translationSegmentSkipped(tr)) return false;
    return normalizeTransCompare(main) !== normalizeTransCompare(tr);
  }

  function stripRedundantInlineTranslation(text, translation) {
    let main = String(text || "").trim();
    if (!main) return main;
    const tr = String(translation || "").trim();
    const m = main.match(/^(.+?)[（(]([^）)\n]{1,800})[）)]\s*$/u);
    if (!m) return main;
    const body = m[1].trim();
    const inline = m[2].trim();
    if (
      normalizeTransCompare(inline) === normalizeTransCompare(body) ||
      (tr && normalizeTransCompare(inline) === normalizeTransCompare(tr))
    ) {
      return body;
    }
    return main;
  }

  function imMessageTranslationJoined(m) {
    const tr = String(m?.translation ?? "").trim();
    if (!tr) return "";
    if (typeof translationJoinedHasAnyVisible === "function") {
      return translationJoinedHasAnyVisible(tr) ? tr : "";
    }
    return tr.split(/\|\|\|/).some((seg) => !translationSegmentSkipped(seg)) ? tr : "";
  }

  function alignTextTranslationPairs(textJoined, transJoined) {
    const texts = splitBubbleSegments(textJoined);
    if (!texts.length) return [];
    const transArr =
      typeof padTranslationSegments === "function"
        ? padTranslationSegments(transJoined, texts.length)
        : String(transJoined || "").split(/\|\|\|/);
    return texts.map((text, i) => {
      const rawText = stripRedundantInlineTranslation(text, "");
      const rawTr = String(transArr[i] ?? "").trim();
      const translation = translationWorthShowing(rawText, rawTr) ? rawTr : "";
      return { text: rawText, translation };
    });
  }

  function lastImMessagePreview(maskId, threadId, threadHint, checkerCharId) {
    if (typeof readChatLogForMaskThread !== "function") return null;
    const log = readChatLogForMaskThread(maskId, threadId);
    let m = null;
    if (typeof chatLogLastBubbleMessageImOnly === "function") {
      m = chatLogLastBubbleMessageImOnly(log);
    } else {
      for (let i = log.length - 1; i >= 0; i--) {
        const row = log[i];
        if (isImChatLogMessage(row) && (row.role === "user" || row.role === "assistant")) {
          m = row;
          break;
        }
      }
    }
    if (!m) return null;
    const text = imMessageDisplayText(m);
    if (!text) return null;
    return { role: m.role, text, at: Number(m.at) || 0 };
  }

  /** 列表/顶栏备注名（与主界面密谈列表一致） */
  function resolveThreadLabel(thread) {
    if (!thread) return "密谈";
    if (typeof threadListDisplayName === "function") return threadListDisplayName(thread);
    if (isGroupThread(thread)) {
      if (typeof threadLinkDisplayLabel === "function") return threadLinkDisplayLabel(thread);
      return String(thread?.groupTitle || "").trim() || "群聊";
    }
    const cid = String(thread?.charId || "").trim();
    const al = typeof getThreadCharDisplayAlias === "function" ? getThreadCharDisplayAlias(thread) : "";
    if (al) return al;
    if (typeof charDisplayNameById === "function" && cid) return charDisplayNameById(cid);
    return resolvePersonaName(cid, null);
  }

  /** 私聊对白泡展示名：角色人设名（避免备注与对白错位） */
  function resolveDmAssistantBubbleName(thread) {
    if (!thread || isGroupThread(thread)) return "Ta";
    const cid = String(thread?.charId || "").trim();
    if (typeof charDisplayNameById === "function" && cid) return charDisplayNameById(cid);
    return resolvePersonaName(cid, null);
  }

  function findCaseThread(c) {
    const maskId = String(c?.maskId || "").trim();
    const tid = String(c?.threadId || "").trim();
    if (!maskId || !tid) return null;
    return findThreadInMask(maskId, tid, c?.charId);
  }

  function findThreadById(c, threadId) {
    const maskId = String(c?.maskId || "").trim();
    return findThreadInMask(maskId, threadId, c?.charId);
  }

  function isCheckerSelfThread(c, thread) {
    if (!thread || isGroupThread(thread)) return false;
    return String(thread?.charId || "").trim() === String(c?.charId || "").trim();
  }

  function buildReversePersonaContext(c) {
    const owner = resolveUserDisplay().name;
    const name = c.charName || "Ta";
    const bindTh = findCaseThread(c);
    const bindTid = String(c.threadId || "").trim();
    const parts = [];
    const base = deps?.buildCaseContextBlock?.(c);
    if (base) parts.push(base);
    if (bindTid && bindTh) {
      parts.push(
        `【你的密谈窗口】threadId=${bindTid}，是「${owner}」手机里你和${owner}的私聊；翻查结束会写回这里。其它 threadId 是${owner}与第三方的对话。`
      );
    }
    parts.push(
      `【说话风格 · ${name}】`,
      `- 内心 thought：按人设口语，像脑子里嘀咕；禁官方腔、禁分析报告、禁「综上所述」「怀疑谁」式审讯话术。`,
      `- 代发 message：用${owner}微信口吻，短句、可省略主语标点随意；禁客服/公文/翻译腔。`,
      `- 你清楚：绿泡是${owner}的历史发言；白泡在「你的窗口」才是你以前说的，在别人的窗口白泡是第三方。`,
      `- 手机上只能看到线上微信密谈；线下晤面记录不会出现。`
    );
    return parts.filter(Boolean).join("\n\n").slice(0, 8000);
  }

  function readThreadLog(maskId, threadId, max, threadHint, checkerCharId) {
    if (typeof readChatLogForMaskThread !== "function") return [];
    const log = readChatLogForMaskThread(maskId, threadId);
    const th =
      threadHint ||
      findThreadInMask(maskId, threadId, checkerCharId) ||
      null;
    const isGroup = th && isGroupThread(th);
    const rows = [];
    for (let i = log.length - 1; i >= 0 && rows.length < max; i--) {
      const m = log[i];
      if (!m || typeof m !== "object") continue;
      if (!isImChatLogMessage(m)) continue;
      if (m.role !== "user" && m.role !== "assistant") continue;
      if (m.role === "assistant" && m.restoring) continue;
      const text = stripRedundantInlineTranslation(imMessageDisplayText(m), "");
      if (!text) continue;
      const translationRaw = imMessageTranslationJoined(m);
      const row = {
        role: m.role,
        text: text.slice(0, 2000),
        at: Number(m.at) || 0
      };
      if (translationWorthShowing(text, translationRaw)) row.translation = translationRaw.slice(0, 6000);
      if (isGroup && m.role === "assistant") row.speakerName = groupSpeakerName(th, m);
      rows.unshift(row);
    }
    return rows;
  }

  function buildScriptForCase(c) {
    const maskId = String(c.maskId || "").trim();
    const bindTid = String(c.threadId || "").trim();
    const threads = listBrowsableThreadsForMask(maskId, c.charId);
    const scored = threads
      .map((t) => {
        const msgs = readThreadLog(maskId, t.id, 1);
        const lastAt = msgs.length ? msgs[msgs.length - 1].at : 0;
        return { t, lastAt, isBind: String(t.id) === bindTid };
      })
      .sort((a, b) => b.lastAt - a.lastAt);
    const chatIds = [];
    if (bindTid) chatIds.push(bindTid);
    for (const row of scored) {
      const tid = String(row.t.id || "");
      if (!tid || chatIds.includes(tid)) continue;
      if (chatIds.length >= 3) break;
      if (row.lastAt > 0) chatIds.push(tid);
    }
    const script = ["notify", "threads", "moments"];
    for (const tid of chatIds) script.push(`chat:${tid}`);
    script.push("wallet");
    return script;
  }

  function resolveUserDisplay() {
    if (typeof readUserMask === "function") {
      const m = readUserMask();
      return {
        name: String(m?.displayName || m?.name || "主控").trim() || "主控",
        avatar: String(m?.avatar || "").trim()
      };
    }
    return { name: "主控", avatar: "" };
  }

  function resolveCharAvatarUrl(charId) {
    if (typeof readCharPersonaStore !== "function") return "";
    const st = readCharPersonaStore();
    const items = Array.isArray(st?.items) ? st.items : [];
    const ch = items.find((x) => x && String(x.id || "") === String(charId || ""));
    return typeof ch?.avatar === "string" ? ch.avatar : "";
  }

  function formatListTime(at) {
    if (typeof formatThreadListTime === "function") return formatThreadListTime(at);
    if (!at) return "";
    const d = new Date(Number(at));
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function msgPreviewText(text) {
    const segs = splitBubbleSegments(text);
    const t = segs.length ? segs[segs.length - 1] : String(text || "").trim();
    if (!t) return "…";
    if (/^【红包】|^【拼手气红包】/.test(t)) return "[红包]";
    if (/^【专属红包/.test(t)) return "[红包]";
    const flat = t.replace(/\s+/g, " ").trim();
    return flat.length > 30 ? `${flat.slice(0, 30)}…` : flat;
  }

  function splitBubbleSegments(text) {
    const raw = String(text ?? "").trim();
    if (!raw) return [];
    const parts = raw
      .split(/\|\|\|/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return parts.length ? parts : [raw.replace(/\s+/g, " ").trim()];
  }

  function bubbleDisplayText(seg) {
    const t = String(seg || "").trim();
    if (msgPreviewText(t) === "[红包]") {
      return t.replace(/^【红包】/, "🧧 ").replace(/^【拼手气红包】/, "🧧 ");
    }
    return t;
  }

  function fillAvatar(el, phEl, url, fallback) {
    if (!el || !phEl) return;
    const u = String(url || "").trim();
    if (u) {
      el.src = u;
      el.classList.remove("is-hidden");
      phEl.classList.add("is-hidden");
    } else {
      el.removeAttribute("src");
      el.classList.add("is-hidden");
      phEl.textContent = String(fallback || "?").slice(0, 1);
      phEl.classList.remove("is-hidden");
    }
  }

  function panelTab(panelId) {
    if (panelId === "notify") return "system";
    if (panelId === "threads") return "chat";
    if (panelId === "contacts") return "contacts";
    if (panelId.startsWith("chat:")) return "chat-detail";
    if (panelId === "moments") return "discover";
    if (panelId === "wallet") return "me";
    return "chat";
  }

  function syncPhoneChrome(c, panelId) {
    const user = resolveUserDisplay();
    const tab = panelId ? panelTab(panelId) : "done";
    const tabs = reverseTabs ? [...reverseTabs.querySelectorAll(".xxj-hijack-tab")] : [];
    for (const el of tabs) {
      const id = String(el.dataset.tab || "");
      let on = false;
      if (tab === "chat" && id === "chat") on = true;
      if (tab === "chat-detail" && id === "chat") on = true;
      if (tab === "contacts" && id === "contacts") on = true;
      if (tab === "discover" && id === "discover") on = true;
      if (tab === "me" && id === "me") on = true;
      if (tab === "system") on = id === "chat";
      el.classList.toggle("is-active", on);
    }
    const inDetail = tab === "chat-detail";
    if (reverseAppbarBack) {
      reverseAppbarBack.hidden = !inDetail;
      reverseAppbarBack.setAttribute("aria-hidden", inDetail ? "false" : "true");
    }
    if (reverseAppbar) reverseAppbar.classList.toggle("is-detail", inDetail);
    if (reverseAppbarK && reverseAppbarT) {
      if (tab === "system") {
        reverseAppbarK.textContent = "SECURITY";
        reverseAppbarT.textContent = "Alert.";
      } else if (tab === "chat-detail") {
        reverseAppbarK.textContent = "";
        reverseAppbarT.textContent = panelLabel(panelId, c);
      } else if (tab === "contacts") {
        reverseAppbarK.textContent = "CONTACTS";
        reverseAppbarT.textContent = "通讯录";
      } else if (tab === "discover") {
        reverseAppbarK.textContent = "MOMENTS";
        reverseAppbarT.textContent = "朋友圈";
      } else if (tab === "me") {
        reverseAppbarK.textContent = "WALLET";
        reverseAppbarT.textContent = "零钱";
      } else {
        reverseAppbarK.textContent = "MESSAGES";
        reverseAppbarT.textContent = "Chat.";
      }
    }
    if (reverseBarName) {
      reverseBarName.textContent = `账号：${user.name} · ${c.charName || "Ta"} 在操作`;
    }
  }

  function panelLabel(panelId, c) {
    if (panelId === "notify") return "异地登录";
    if (panelId === "threads") return "密谈列表";
    if (panelId === "contacts") return "通讯录";
    if (panelId === "moments") return "朋友圈";
    if (panelId === "wallet") return "我的 · 钱包";
    if (panelId.startsWith("chat:")) {
      const tid = panelId.slice(5);
      const th = findThreadById(c, tid);
      return th ? resolveThreadLabel(th) : "密谈";
    }
    return panelId;
  }

  function formatMomentsExcerptForAi(maskId, max) {
    return readMomentsSlice(maskId, max)
      .map((mm) => {
        const who = mm.kind === "user" ? resolveUserDisplay().name : String(mm.displayName || "Ta");
        const body = String(mm.text || "").replace(/\s+/g, " ").trim() || "（配图动态）";
        const cmts = (Array.isArray(mm.comments) ? mm.comments : [])
          .slice(-4)
          .map((c) => `  · ${String(c.authorName || "—")}：${String(c.text || "").replace(/\s+/g, " ").slice(0, 48)}`)
          .join("\n");
        return `[momentId=${mm.id}] ${who}：${body.slice(0, 100)}${cmts ? `\n${cmts}` : ""}`;
      })
      .join("\n\n")
      .slice(0, 2200);
  }

  function readMomentsSlice(maskId, max) {
    if (typeof readChatInboxStore !== "function" || typeof normalizeMoment !== "function") return [];
    const inbox = readChatInboxStore();
    const bucket = inbox?.byMask?.[maskKey(maskId)];
    const list = Array.isArray(bucket?.moments) ? bucket.moments : [];
    const visible = (mm) =>
      typeof momentRowLooksVisible === "function" ? momentRowLooksVisible(mm) : Boolean(String(mm?.text || "").trim());
    return list
      .map((m) => normalizeMoment(m))
      .filter(visible)
      .sort((a, b) => new Date(b.timeIso).getTime() - new Date(a.timeIso).getTime())
      .slice(0, max);
  }

  function readWalletSlice(maskId) {
    if (typeof readMyStore !== "function" || typeof ensureMyMaskBucket !== "function") {
      return { balance: "0.00", bills: [] };
    }
    const { bucket } = ensureMyMaskBucket(maskId);
    const bal = typeof formatMoneyFromCents === "function" ? formatMoneyFromCents(Number(bucket.walletCents) || 0) : "0.00";
    const bills = (Array.isArray(bucket.bills) ? bucket.bills : []).slice(0, 8).map((b) => ({
      type: String(b.type || "记录"),
      note: String(b.note || ""),
      delta:
        typeof formatMoneyFromCents === "function"
          ? formatMoneyFromCents(Math.abs(Number(b.deltaCents) || 0))
          : "0.00",
      sign: Number(b.deltaCents) >= 0 ? "+" : "-",
      at: typeof formatBillTime === "function" ? formatBillTime(b.at) : ""
    }));
    return { balance: bal, bills };
  }

  function buildPanelExcerpt(panelId, c) {
    const maskId = String(c.maskId || "").trim();
    if (panelId === "threads") {
      const threads = listBrowsableThreadsForMask(maskId, c.charId);
      return threads
        .slice(0, 10)
        .map((t) => `${resolveThreadLabel(t)}${isGroupThread(t) ? "（群）" : ""}`)
        .join(" · ")
        .slice(0, 400);
    }
    if (panelId === "contacts") {
      const threads = listBrowsableThreadsForMask(maskId, c.charId);
      return threads
        .slice(0, 12)
        .map((t) => `${resolveThreadLabel(t)}${isGroupThread(t) ? " · 群聊" : " · 好友"}`)
        .join("\n")
        .slice(0, 800);
    }
    if (panelId.startsWith("chat:")) {
      const tid = panelId.slice(5);
      const th = findThreadInMask(maskId, tid, c.charId);
      const peer = th ? resolveThreadLabel(th) : "对方";
      const owner = resolveUserDisplay().name;
      const selfWin = th && isCheckerSelfThread(c, th);
      const charNm = c.charName || "Ta";
      if (th && isGroupThread(th) && typeof formatLinkedGroupRecentMessagesForPrompt === "function") {
        const log = readChatLogForMaskThread(maskId, tid).filter(isImChatLogMessage);
        const mask = typeof readUserMask === "function" ? readUserMask() : {};
        const block = formatLinkedGroupRecentMessagesForPrompt(log, th, mask, 8);
        if (block) return block.slice(0, 1400);
      }
      const dmPeer = th && !isGroupThread(th) ? resolveDmAssistantBubbleName(th) : peer;
      return readThreadLog(maskId, tid, 8, th, c.charId)
        .map((r) => {
          if (r.role === "user") return `${owner}：${r.text}`;
          if (th && isGroupThread(th)) return `${r.speakerName || "成员"}：${r.text}`;
          return selfWin ? `${charNm}（你）：${r.text}` : `${dmPeer}：${r.text}`;
        })
        .join("\n")
        .slice(0, 1400);
    }
    if (panelId === "moments") {
      return formatMomentsExcerptForAi(maskId, 8);
    }
    if (panelId === "wallet") {
      const w = readWalletSlice(maskId);
      const billLines = w.bills.map((b) => `${b.type} ${b.sign}¥${b.delta}`).join("；");
      return `余额 ¥${w.balance}${billLines ? ` · ${billLines}` : ""}`.slice(0, 600);
    }
    return "收到异地登录提醒";
  }

  function recordView(c, panelId) {
    if (panelId === "notify") return;
    const rs = ensureReverseState(c);
    const excerpt = buildPanelExcerpt(panelId, c);
    rs.viewed.push({
      panel: panelId,
      target: panelLabel(panelId, c),
      excerpt: excerpt.slice(0, 800),
      at: Date.now()
    });
    c.updatedAt = Date.now();
    deps?.writeStore?.();
  }

  function formatRecentActions(rs) {
    const acts = Array.isArray(rs.actions) ? rs.actions : [];
    const ops = acts.filter((a) => {
      const k = String(a.kind || "").toUpperCase();
      return (
        (k === "SEND_MSG" ||
          k === "SEND_REDPACKET" ||
          k === "SEND_TRANSFER" ||
          k === "ADD_WALLET" ||
          k === "POST_MOMENT" ||
          k === "MOMENT_COMMENT" ||
          k === "BLOCK_CHAR" ||
          k === "UNBLOCK_CHAR") &&
        a.ok !== false
      );
    });
    const inner = acts.filter((a) => {
      const k = String(a.kind || "").toUpperCase();
      return k === "LOOK_ONLY" || k === "REACT";
    });
    const lines = [];
    if (ops.length) {
      lines.push(
        ...ops.slice(-4).map((a) => {
          const k = String(a.kind || "");
          if (k === "SEND_MSG") return `· 代主控发消息 → ${a.target || "某人"}：${String(a.message || "").slice(0, 40)}`;
          if (k === "SEND_REDPACKET") return `· 代主控发红包 ¥${a.amount || "?"} → ${a.target || "某人"}`;
          if (k === "SEND_TRANSFER") return `· 代主控转账 ¥${a.amount || "?"} → ${a.target || "某人"}`;
          if (k === "ADD_WALLET") return `· ${a.by || "Ta"} 代充 ¥${a.amount || "?"}`;
          if (k === "POST_MOMENT") return `· 代主控发朋友圈：${String(a.momentText || a.message || "").slice(0, 40)}`;
          if (k === "MOMENT_COMMENT") return `· 代主控评朋友圈：${String(a.momentText || a.message || "").slice(0, 40)}`;
          if (k === "BLOCK_CHAR") return `· 代主控拉黑 ${a.target || "某人"}`;
          if (k === "UNBLOCK_CHAR") return `· 代主控取消拉黑 ${a.target || "某人"}`;
          return `· ${k}`;
        })
      );
    } else {
      lines.push("（本轮尚未代主控发过消息/红包/转账/充值）");
    }
    if (inner.length) {
      lines.push(
        "——",
        ...inner.slice(-3).map((a) => `· 内心：${String(a.thought || "").slice(0, 36)}`)
      );
    }
    return lines.join("\n");
  }

  function buildCurrentScreenBrief(c, panelId) {
    const owner = resolveUserDisplay().name;
    const name = c.charName || "Ta";
    const bindTid = String(c.threadId || "").trim();
    if (panelId === "notify") {
      return `你（${name}）正拿着「${owner}」的手机，刚弹异地登录提醒。`;
    }
    if (panelId === "threads") {
      const selfTag = bindTid ? `你的窗口 threadId=${bindTid}` : "（案卷未标你的窗口）";
      return [
        `你（${name}）正在翻「${owner}」的微信密谈列表（含群聊）。此页不要代发消息。`,
        `${selfTag}；其它行是${owner}和别人的私聊或群。`
      ].join("\n");
    }
    if (panelId === "contacts") {
      return [
        `你（${name}）正在翻「${owner}」的通讯录（好友与群）。`,
        `此页只看不操作；想发消息须先点进对应私聊/群聊窗口。`
      ].join("\n");
    }
    if (panelId.startsWith("chat:")) {
      const peer = panelLabel(panelId, c);
      const tid = panelId.slice(5);
      const th = findThreadById(c, tid);
      const selfWin = th && isCheckerSelfThread(c, th);
      if (th && isGroupThread(th)) {
        return [
          `【群聊】你（${name}）正在看「${owner}」手机里的群「${peer}」（threadId=${tid}）。`,
          `绿泡 = ${owner}；白泡 = 群成员发言（可能是你或别人）。`,
          `若要代发，targetThreadId=${tid}，message 须接群聊语境，用${owner}口吻。`
        ].join("\n");
      }
      if (selfWin) {
        const blk = blockStatePromptLine(th, owner, name);
        return [
          `【你的窗口】你（${name}）正在看「${owner}」手机里你和${owner}的私聊（threadId=${tid}）。`,
          `绿泡 = ${owner}说的；白泡 = 你（${name}）以前说的。`,
          blk,
          `若要代发，targetThreadId=${tid}，message 须接你俩的对话，用${owner}口吻。`,
          `若剧情与人设支持（示好、赌气、试探、补偿等），也可用 SEND_TRANSFER / SEND_REDPACKET 转给此窗口；**多数轮次不必**，没有自然动机就 LOOK_ONLY 或 REACT。`
        ]
          .filter(Boolean)
          .join("\n");
      }
      const blk = blockStatePromptLine(th, owner, peer);
      return [
        `【第三方窗口】你（${name}）正在旁观「${owner}」和「${peer}」的私聊（threadId=${tid}），不是你的窗口。`,
        `绿泡 = ${owner}；白泡 = ${peer}（不是你）。`,
        blk,
        `若要代发，targetThreadId=${tid}，message 须接${owner}与${peer}的对话语境，用${owner}口吻装${owner}说话。`,
        `转账/红包也仅当人设与剧情需要时用；没有动机不要硬转。`
      ]
        .filter(Boolean)
        .join("\n");
    }
    if (panelId === "moments") {
      return [
        `你（${name}）正在翻「${owner}」的朋友圈。`,
        `可用 POST_MOMENT 用${owner}的号发一条动态，或 MOMENT_COMMENT 在某条下评论（须 momentId）。`,
        `文案须贴合你的人设与当下剧情；可试探、留痕、装没事，也可恶意搞事——由你定。`
      ].join("\n");
    }
    if (panelId === "wallet") {
      return `你（${name}）正在看「${owner}」的钱包。此页只能 ADD_WALLET，不要发密谈。`;
    }
    return `你（${name}）正在翻看「${owner}」的手机。`;
  }

  function blockStatePromptLine(th, owner, peerLabel) {
    if (!th || isGroupThread(th)) return "";
    if (isDmThreadUserBlockedChar(th)) {
      return `当前状态：${owner}已将${peerLabel}拉黑；若你的人设与剧情撑得住「想和解」，才用 UNBLOCK_CHAR。`;
    }
    return "";
  }

  function resolveActionThreadId(c, spec, panelId) {
    if (panelId.startsWith("chat:")) return panelId.slice(5);
    const bind = String(c.threadId || "").trim();
    if (bind) return bind;
    return String(spec.targetThreadId || "").trim();
  }

  function buildReverseSystemPrompt(c) {
    const name = c.charName || "Ta";
    const owner = resolveUserDisplay().name;
    const personaCtx = buildReversePersonaContext(c);
    return [
      personaCtx,
      "",
      `[系统] 你是${name}，正在远程操作「${owner}」的手机。你不是${owner}。`,
      `[系统] 你清楚自己在干什么：旁观哪一页、代谁发、发给谁；「你的窗口」vs「第三方窗口」不要搞混。`,
      `[系统] 绿泡是${owner}原有聊天；只有你选下列 action 才会真实写入。`,
      "禁止删除任何聊天记录、朋友圈或账单；不要转发名片。",
      "可用 action：",
      "- LOOK_ONLY：只看不操作",
      "- REACT：仅内心独白",
      `- SEND_MSG：用${owner}的号代发密谈，需 targetThreadId + message（须贴合当前窗口对话）`,
      `- SEND_REDPACKET：用${owner}的号发红包，需 targetThreadId + amount + note；可发给第三方或「你的窗口」，**仅当人设与剧情自然需要**（示好/赌气/试探/补偿/搞事等），勿为刷存在感每轮都发`,
      `- SEND_TRANSFER：用${owner}的号转账，需 targetThreadId + amount + note；同上，含可转给「你的窗口」（即转给${owner}本人），**没有动机就省略**`,
      `- ADD_WALLET：以你的身份给${owner}钱包充值，需 walletAdd（元，正数）；账单会记为你充入`,
      `- POST_MOMENT：仅在朋友圈页，用${owner}的号发一条动态，需 momentText（像${owner}会发的口吻，也可由你故意搞事）`,
      `- MOMENT_COMMENT：仅在朋友圈页，用${owner}的号评论某条动态，需 momentId + momentText`,
      `- BLOCK_CHAR：用${owner}的号拉黑某私聊角色，需 targetThreadId（仅私聊；群聊不可）`,
      `- UNBLOCK_CHAR：用${owner}的号取消拉黑，需 targetThreadId`,
      "输出单个 JSON 对象：{ thought, action, targetThreadId?, message?, amount?, note?, walletAdd?, momentId?, momentText? }",
      `thought：第一人称内心独白，1～3 句、≤40 字，按人设口语，忌官方分析腔。`,
      `thought 禁止：主控、用户、机主、查岗、JSON、action、targetThreadId 等词；称${owner}用「${owner}」或他/她。`,
      `message：代发时像${owner}在微信里打字，短、自然，禁客服/公文腔。`,
      `[钱 · 人设优先] 转账/红包/充值都是**剧情工具**，不是每轮必做。默认 LOOK_ONLY 或 REACT；只有你的性格、查岗理由与当下情绪撑得住时，才 SEND_TRANSFER / SEND_REDPACKET / ADD_WALLET。`,
      `[拉黑 · 人设优先] 拉黑/取消拉黑**不是必选项**，更不是每轮都要做。默认只看不操作；**只有**你的人设（占有欲、狠劲、赌气、搞事、护短等）加上眼前剧情（暧昧 rival、刚吵完架、撞见刺眼的聊天等）**真的撑得住**时，才 BLOCK_CHAR 或 UNBLOCK_CHAR；没有自然动机就 LOOK_ONLY / REACT / 代发，**不要为了刷操作感硬拉黑**。`,
      "在私聊窗口外不要随意 SEND_MSG；message 必须接得上屏内聊天。",
      "POST_MOMENT / MOMENT_COMMENT 仅在本屏为朋友圈时使用；momentText 必填。"
    ].join("\n");
  }

  function buildReverseUserPrompt(c, panelId) {
    const rs = ensureReverseState(c);
    const owner = resolveUserDisplay().name;
    const ctx = buildPanelExcerpt(panelId, c);
    const threads = listBrowsableThreadsForMask(c.maskId, c.charId)
      .map((t) => {
        let tag = "第三方";
        if (isGroupThread(t)) tag = "群聊";
        else if (isCheckerSelfThread(c, t)) tag = "你的窗口";
        return `${t.id}=${resolveThreadLabel(t)}（${tag}）`;
      })
      .join("；");
    return [
      `[系统] 你是${c.charName || "Ta"}，操作的是「${owner}」的手机，不是你自己的。`,
      "",
      "【此刻你在干什么】",
      buildCurrentScreenBrief(c, panelId),
      "",
      "本屏所见：",
      ctx || "（空）",
      "",
      "密谈 threadId 对照：",
      threads || "（无）",
      "",
      `[系统] 本轮你已代${owner}执行（仅实际写入的操作）：`,
      formatRecentActions(rs),
      "",
      "请输出 JSON。内心按人设；代发前确认：这是谁的窗口、该用什么口吻。"
    ].join("\n");
  }

  async function requestReverseAiCompletion(messages, opts) {
    const ai = window.RP_AI;
    if (!ai?.chatCompletions) throw new Error("AI 未就绪");
    const cfg = ai.getConfig?.() || {};
    if (!String(cfg.apiKey || "").trim()) throw new Error("请先配置 API Key");
    const req = window.__XXJ_GROUP_CHAT_DEPS?.requestChatAssistantCompletion;
    const o = opts && typeof opts === "object" ? opts : {};
    const payload = {
      messages,
      temperature: Number.isFinite(o.temperature) ? o.temperature : 0.9
    };
    if (Number.isFinite(o.max_tokens) && o.max_tokens > 0) payload.max_tokens = Math.floor(o.max_tokens);
    if (o.json !== false) payload.response_format = { type: "json_object" };
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

  function readAiText(data) {
    const ch = data?.choices?.[0]?.message?.content;
    return String(ch || "").trim();
  }

  function parseAiAction(raw) {
    if (!raw || typeof raw !== "object") return null;
    const action = String(raw.action || raw.kind || "LOOK_ONLY").trim().toUpperCase();
    return {
      thought: sanitizeThoughtForDisplay(raw.thought || raw.innerVoice || "", resolveUserDisplay().name),
      action,
      targetThreadId: String(raw.targetThreadId || raw.threadId || "").trim(),
      message: String(raw.message || raw.text || "").trim().slice(0, 500),
      amount: String(raw.amount || "").trim(),
      note: String(raw.note || "恭喜发财").trim().slice(0, 40),
      walletAdd: String(raw.walletAdd || raw.addWallet || "").trim(),
      momentId: String(raw.momentId || "").trim(),
      momentText: String(raw.momentText || raw.comment || raw.momentComment || "").trim().slice(0, 500)
    };
  }

  function patchMomentForMask(maskId, momentId, mutator) {
    const mid = String(maskId || "").trim();
    const moid = String(momentId || "").trim();
    if (!mid || !moid || typeof mutator !== "function") return null;
    if (typeof readChatInboxStore !== "function" || typeof writeChatInboxStore !== "function" || typeof normalizeMoment !== "function") {
      return null;
    }
    const inbox = readChatInboxStore();
    if (typeof ensureMaskBucket === "function") ensureMaskBucket(inbox, mid);
    const bucket = inbox?.byMask?.[maskKey(mid)];
    if (!bucket) return null;
    const arr = Array.isArray(bucket.moments) ? bucket.moments : [];
    const i = arr.findIndex((m) => String(m?.id || "") === moid);
    if (i < 0) return null;
    const base = normalizeMoment(arr[i]);
    const next = { ...base };
    mutator(next);
    arr[i] = normalizeMoment(next);
    bucket.moments = arr;
    writeChatInboxStore(inbox, { fast: true });
    if (typeof flushChatInboxKvPersist === "function") flushChatInboxKvPersist();
    return normalizeMoment(arr[i]);
  }

  function postMomentAsUserForMask(maskId, text) {
    const mid = String(maskId || "").trim();
    const body = String(text || "").trim();
    if (!mid || !body) return { ok: false, err: "缺少内容" };
    if (typeof readChatInboxStore !== "function" || typeof writeChatInboxStore !== "function" || typeof normalizeMoment !== "function") {
      return { ok: false, err: "朋友圈模块未就绪" };
    }
    const user = resolveUserDisplay();
    const inbox = readChatInboxStore();
    if (typeof ensureMaskBucket === "function") ensureMaskBucket(inbox, mid);
    const bucket = inbox?.byMask?.[maskKey(mid)];
    if (!bucket) return { ok: false, err: "面具不存在" };
    const newId = typeof newEntityId === "function" ? newEntityId() : `mm_${Date.now()}`;
    const row = normalizeMoment({
      id: newId,
      kind: "user",
      displayName: user.name,
      timeIso: new Date().toISOString(),
      text: body.slice(0, 2000),
      images: [],
      likedByMe: false,
      likeCount: 0,
      shareCount: 0,
      comments: []
    });
    const arr = Array.isArray(bucket.moments) ? bucket.moments.slice() : [];
    arr.unshift(row);
    bucket.moments = arr;
    writeChatInboxStore(inbox, { fast: true });
    if (typeof flushChatInboxKvPersist === "function") flushChatInboxKvPersist();
    if (typeof recordUserMomentFeedNoticesForMask === "function") {
      try {
        recordUserMomentFeedNoticesForMask(mid, row, user.name);
      } catch (_) {
        /* ignore */
      }
    }
    if (typeof renderMomentsFeed === "function") renderMomentsFeed();
    return { ok: true, momentId: newId, momentText: body };
  }

  function commentMomentAsUserForMask(maskId, momentId, text, c) {
    const mid = String(maskId || "").trim();
    const moid = String(momentId || "").trim();
    const body = String(text || "").trim();
    if (!mid || !moid || !body) return { ok: false, err: "缺少动态或评论" };
    const user = resolveUserDisplay();
    const commentId = typeof newEntityId === "function" ? newEntityId() : `mc_${Date.now()}`;
    const mm = patchMomentForMask(mid, moid, (m) => {
      const arr = Array.isArray(m.comments) ? m.comments : [];
      arr.push({
        id: commentId,
        authorKind: "user",
        authorName: user.name,
        timeIso: new Date().toISOString(),
        text: body.slice(0, 500),
        replyToCommentId: ""
      });
      m.comments = arr;
    });
    if (!mm) return { ok: false, err: "动态不存在" };
    if (mm.kind === "char" && typeof recordMomentsFeedNoticeInChatThread === "function") {
      const tid = String(mm.threadId || c?.threadId || "").trim();
      if (tid) {
        try {
          recordMomentsFeedNoticeInChatThread(
            mid,
            tid,
            `用户 ${user.name} 评论了你的朋友圈：${body.slice(0, 80)}`
          );
        } catch (_) {
          /* ignore */
        }
      }
    }
    if (typeof renderMomentsFeed === "function") renderMomentsFeed();
    return { ok: true, momentId: moid, momentText: body, commentId };
  }

  function isDmThreadUserBlockedChar(thread) {
    return Boolean(thread && thread.userBlockedChar === true);
  }

  function formatBlockNoticeLabel(kind, charName, userName) {
    if (typeof formatChatBlockNoticeLabel === "function") {
      return formatChatBlockNoticeLabel({ kind, charName, userName });
    }
    if (kind === "block_user_char") return `${userName} 已将 ${charName} 拉黑`;
    if (kind === "unblock_user_char") return `${userName} 已取消拉黑 ${charName}`;
    return "拉黑状态变更";
  }

  function applyUserBlockCharToggle(maskId, threadId, wantBlock) {
    const mid = String(maskId || "").trim();
    const tid = String(threadId || "").trim();
    if (!mid || !tid) return { ok: false, err: "缺少线程" };
    const th = findThreadInMask(mid, tid);
    if (!th) return { ok: false, err: "密谈不存在" };
    if (isGroupThread(th)) return { ok: false, err: "群聊不可拉黑" };
    const prev = isDmThreadUserBlockedChar(th);
    if (wantBlock && prev) return { ok: false, err: "已拉黑", noop: true };
    if (!wantBlock && !prev) return { ok: false, err: "未拉黑", noop: true };
    const patchFn =
      typeof patchChatThreadForMask === "function"
        ? patchChatThreadForMask
        : window.__XXJ_GROUP_CHAT_DEPS?.patchChatThreadForMask;
    if (typeof patchFn !== "function") return { ok: false, err: "聊天模块未就绪" };
    const patched = patchFn(mid, tid, (t) => {
      if (wantBlock) t.userBlockedChar = true;
      else delete t.userBlockedChar;
    });
    if (!patched) return { ok: false, err: "写入失败" };
    const user = resolveUserDisplay();
    const userName = String(user.name || "").trim() || "你";
    const charName =
      (typeof getCharPersonaDisplayNameForThread === "function"
        ? String(getCharPersonaDisplayNameForThread(th) || "").trim()
        : "") ||
      resolveThreadLabel(th) ||
      "Ta";
    const noticeKind = wantBlock ? "block_user_char" : "unblock_user_char";
    const at = Date.now();
    if (typeof readChatLogForMaskThread === "function" && typeof saveChatLogForMaskThread === "function") {
      const log = readChatLogForMaskThread(mid, tid);
      log.push({
        role: "notice",
        kind: noticeKind,
        at,
        charName,
        userName,
        label: formatBlockNoticeLabel(noticeKind, charName, userName)
      });
      saveChatLogForMaskThread(mid, tid, log);
      if (typeof scheduleRenderChatMessages === "function") scheduleRenderChatMessages();
    }
    return {
      ok: true,
      target: resolveThreadLabel(th),
      charName,
      userName,
      blocked: wantBlock
    };
  }

  function appendUserLineToThread(maskId, threadId, content, opts) {
    if (typeof readChatLogForMaskThread !== "function" || typeof saveChatLogForMaskThread !== "function") {
      return false;
    }
    const log = readChatLogForMaskThread(maskId, threadId);
    const at = Date.now();
    const entry = { role: "user", content: String(content || "").trim(), at };
    if (opts && opts.redpack && typeof opts.redpack === "object") entry.redpack = opts.redpack;
    log.push(entry);
    saveChatLogForMaskThread(maskId, threadId, log);
    if (typeof scheduleRenderChatMessages === "function") scheduleRenderChatMessages();
    return true;
  }

  function pushWalletBillForMask(maskId, p) {
    if (typeof ensureMyMaskBucket !== "function" || typeof writeMyStore !== "function") return;
    const { store, bucket } = ensureMyMaskBucket(maskId);
    const arr = Array.isArray(bucket.bills) ? bucket.bills.slice() : [];
    const id = String(p?.id || `bill_${Date.now()}`);
    arr.unshift({
      id,
      at: Number(p?.at) || Date.now(),
      type: String(p?.type || "").trim().slice(0, 24),
      note: String(p?.note || "").trim().slice(0, 80),
      deltaCents: Math.floor(Number(p?.deltaCents) || 0),
      balanceCentsAfter: Math.max(0, Math.floor(Number(p?.balanceCentsAfter) || Number(bucket.walletCents) || 0))
    });
    if (arr.length > 200) arr.length = 200;
    bucket.bills = arr;
    writeMyStore(store);
  }

  function sendRedpackAsUser(maskId, threadId, amount, note) {
    if (typeof parseMoneyToCents !== "function" || typeof ensureMyMaskBucket !== "function") return { ok: false, err: "钱包模块未就绪" };
    const amt =
      typeof sanitizeRedpackAmount === "function"
        ? sanitizeRedpackAmount(amount)
        : String(amount || "").trim();
    const need = parseMoneyToCents(amt);
    if (need <= 0) return { ok: false, err: "金额无效" };
    const { store, bucket } = ensureMyMaskBucket(maskId);
    const bal = Number(bucket.walletCents) || 0;
    if (bal < need) return { ok: false, err: "余额不足" };
    bucket.walletCents = bal - need;
    if (typeof writeMyStore === "function") writeMyStore(store);
    if (typeof renderMyScreen === "function") renderMyScreen();
    pushWalletBillForMask(maskId, {
      type: "发红包",
      note: String(note || "").trim(),
      deltaCents: -need,
      balanceCentsAfter: Number(bucket.walletCents) || 0
    });
    const composed = `【红包】¥${amt} ${String(note || "恭喜发财").trim() || "恭喜发财"}`;
    if (!appendUserLineToThread(maskId, threadId, composed)) return { ok: false, err: "写入密谈失败" };
    return { ok: true, amt };
  }

  function sendTransferAsUser(maskId, threadId, amount, note) {
    if (typeof parseMoneyToCents !== "function" || typeof ensureMyMaskBucket !== "function") {
      return { ok: false, err: "钱包模块未就绪" };
    }
    const amt =
      typeof sanitizeRedpackAmount === "function"
        ? sanitizeRedpackAmount(amount)
        : String(amount || "").trim();
    const need = parseMoneyToCents(amt);
    if (need <= 0) return { ok: false, err: "金额无效" };
    const { store, bucket } = ensureMyMaskBucket(maskId);
    const bal = Number(bucket.walletCents) || 0;
    if (bal < need) return { ok: false, err: "余额不足" };
    bucket.walletCents = bal - need;
    if (typeof writeMyStore === "function") writeMyStore(store);
    if (typeof renderMyScreen === "function") renderMyScreen();
    const noteText = String(note || "转账给你").trim() || "转账给你";
    pushWalletBillForMask(maskId, {
      type: "转账",
      note: noteText,
      deltaCents: -need,
      balanceCentsAfter: Number(bucket.walletCents) || 0
    });
    const composed = `【红包】¥${amt} ${noteText}`;
    const rpId = typeof makeRedpackId === "function" ? makeRedpackId() : `rp_${Date.now()}`;
    if (
      !appendUserLineToThread(maskId, threadId, composed, {
        redpack: { id: rpId, amt, note: noteText, status: "sent" }
      })
    ) {
      return { ok: false, err: "写入密谈失败" };
    }
    return { ok: true, amt };
  }

  function walletTopupNoteByChar(charName) {
    const name = String(charName || "").trim() || "Ta";
    return `${name} 充入`;
  }

  function addWalletAsChar(maskId, yuan, charName) {
    if (typeof parseMoneyToCents !== "function" || typeof ensureMyMaskBucket !== "function") return { ok: false };
    const need = parseMoneyToCents(yuan);
    if (need <= 0) return { ok: false, err: "金额无效" };
    const byName = String(charName || "").trim() || "Ta";
    const { store, bucket } = ensureMyMaskBucket(maskId);
    const bal = Number(bucket.walletCents) || 0;
    bucket.walletCents = Math.min(9_999_999_00, bal + need);
    if (typeof writeMyStore === "function") writeMyStore(store);
    if (typeof renderMyScreen === "function") renderMyScreen();
    pushWalletBillForMask(maskId, {
      type: "查岗充值",
      note: walletTopupNoteByChar(byName),
      byCharName: byName,
      deltaCents: need,
      balanceCentsAfter: Number(bucket.walletCents) || 0
    });
    return {
      ok: true,
      amt: typeof formatMoneyFromCents === "function" ? formatMoneyFromCents(need) : yuan,
      byName
    };
  }

  function applyReverseAction(c, spec, panelId) {
    if (!spec) return { applied: false, note: "" };
    const maskId = String(c.maskId || "").trim();
    const rs = ensureReverseState(c);
    const action = String(spec.action || "LOOK_ONLY").toUpperCase();
    const thought = String(spec.thought || "").trim();
    if (thought) {
      rs.reactions.push({ text: thought, at: Date.now() });
    }
    const base = { kind: action, thought, at: Date.now() };
    if (action === "LOOK_ONLY" || action === "REACT") {
      rs.actions.push(base);
      c.updatedAt = Date.now();
      deps?.writeStore?.();
      return { applied: true, note: thought || "继续翻看" };
    }
    if (action === "SEND_MSG") {
      const tid = resolveActionThreadId(c, spec, panelId);
      const msg = String(spec.message || "").trim();
      if (!tid || !msg) {
        rs.actions.push({ ...base, err: "缺少线程或内容" });
        deps?.writeStore?.();
        return { applied: false, note: "未能发消息" };
      }
      const th = findThreadInMask(maskId, tid, c.charId);
      const ok = appendUserLineToThread(maskId, tid, msg);
      rs.actions.push({
        ...base,
        targetThreadId: tid,
        target: th ? resolveThreadLabel(th) : tid,
        message: msg,
        ok
      });
      deps?.writeStore?.();
      return { applied: ok, note: ok ? `已代发：${msg.slice(0, 40)}` : "发消息失败" };
    }
    if (action === "SEND_REDPACKET") {
      const tid = resolveActionThreadId(c, spec, panelId);
      const th = findThreadInMask(maskId, tid, c.charId);
      const r = sendRedpackAsUser(maskId, tid, spec.amount, spec.note);
      rs.actions.push({
        ...base,
        targetThreadId: tid,
        target: th ? resolveThreadLabel(th) : tid,
        amount: spec.amount,
        note: spec.note,
        ok: r.ok,
        err: r.err || ""
      });
      deps?.writeStore?.();
      return { applied: r.ok, note: r.ok ? `已发红包 ¥${r.amt}` : r.err || "红包失败" };
    }
    if (action === "SEND_TRANSFER") {
      const tid = resolveActionThreadId(c, spec, panelId);
      const th = findThreadInMask(maskId, tid, c.charId);
      const transferNote = String(spec.note || "转账给你").trim() || "转账给你";
      const r = sendTransferAsUser(maskId, tid, spec.amount, transferNote);
      rs.actions.push({
        ...base,
        targetThreadId: tid,
        target: th ? resolveThreadLabel(th) : tid,
        amount: spec.amount,
        note: transferNote,
        ok: r.ok,
        err: r.err || ""
      });
      deps?.writeStore?.();
      return { applied: r.ok, note: r.ok ? `已转账 ¥${r.amt}` : r.err || "转账失败" };
    }
    if (action === "ADD_WALLET") {
      const r = addWalletAsChar(maskId, spec.walletAdd, c.charName);
      rs.actions.push({
        ...base,
        amount: spec.walletAdd,
        by: r.byName || c.charName || "Ta",
        ok: r.ok,
        err: r.err || ""
      });
      deps?.writeStore?.();
      const who = r.byName || c.charName || "Ta";
      return { applied: r.ok, note: r.ok ? `${who} 已充值 ¥${r.amt}` : r.err || "充值失败" };
    }
    if (action === "POST_MOMENT") {
      if (panelId !== "moments") {
        rs.actions.push({ ...base, err: "仅朋友圈页可发动态" });
        deps?.writeStore?.();
        return { applied: false, note: "不在朋友圈页" };
      }
      const text = String(spec.momentText || spec.message || "").trim();
      const r = postMomentAsUserForMask(maskId, text);
      rs.actions.push({
        ...base,
        momentText: text,
        momentId: r.momentId || "",
        ok: r.ok,
        err: r.err || ""
      });
      deps?.writeStore?.();
      return { applied: r.ok, note: r.ok ? `已发动态：${text.slice(0, 36)}` : r.err || "发动态失败" };
    }
    if (action === "MOMENT_COMMENT") {
      if (panelId !== "moments") {
        rs.actions.push({ ...base, err: "仅朋友圈页可评论" });
        deps?.writeStore?.();
        return { applied: false, note: "不在朋友圈页" };
      }
      const moid = String(spec.momentId || "").trim();
      const text = String(spec.momentText || spec.message || "").trim();
      const r = commentMomentAsUserForMask(maskId, moid, text, c);
      rs.actions.push({
        ...base,
        momentId: moid,
        momentText: text,
        ok: r.ok,
        err: r.err || ""
      });
      deps?.writeStore?.();
      return { applied: r.ok, note: r.ok ? `已评论：${text.slice(0, 36)}` : r.err || "评论失败" };
    }
    if (action === "BLOCK_CHAR" || action === "UNBLOCK_CHAR") {
      const tid = resolveActionThreadId(c, spec, panelId);
      if (!tid) {
        rs.actions.push({ ...base, err: "缺少线程" });
        deps?.writeStore?.();
        return { applied: false, note: "未能拉黑" };
      }
      const th = findThreadInMask(maskId, tid, c.charId);
      const wantBlock = action === "BLOCK_CHAR";
      const r = applyUserBlockCharToggle(maskId, tid, wantBlock);
      rs.actions.push({
        ...base,
        targetThreadId: tid,
        target: th ? resolveThreadLabel(th) : tid,
        ok: r.ok,
        err: r.err || ""
      });
      deps?.writeStore?.();
      if (r.ok) {
        return {
          applied: true,
          note: wantBlock ? `已拉黑 ${r.target || "对方"}` : `已取消拉黑 ${r.target || "对方"}`
        };
      }
      if (r.noop) return { applied: false, note: r.err || "状态未变" };
      return { applied: false, note: r.err || "拉黑失败" };
    }
    rs.actions.push(base);
    deps?.writeStore?.();
    return { applied: false, note: "未知动作" };
  }

  async function runAiRoundForPanel(c, panelId) {
    if (panelId === "notify") return { spec: null, result: { thought: "", note: "" } };
    aiBusy = true;
    syncReverseControls(c);
    if (reverseThought) reverseThought.textContent = "…";
    try {
      const messages = [
        { role: "system", content: buildReverseSystemPrompt(c) },
        { role: "user", content: buildReverseUserPrompt(c, panelId) }
      ];
      const data = await requestReverseAiCompletion(messages);
      const text = readAiText(data);
      let raw = null;
      try {
        raw = JSON.parse(text);
      } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) raw = JSON.parse(m[0]);
      }
      const spec = parseAiAction(raw);
      if (!spec) throw new Error("模型 JSON 无效");
      const result = applyReverseAction(c, spec, panelId);
      displayThought(c, spec.thought || result.note || "");
      return { spec, result };
    } catch (e) {
      const msg = e && e.message ? String(e.message) : "AI 失败";
      if (reverseThought) reverseThought.textContent = msg;
      return { spec: null, result: { applied: false, note: msg } };
    } finally {
      aiBusy = false;
      syncReverseControls(c);
    }
  }

  function clearNotifyGateCountdown() {
    if (notifyGateCountdownTimer) window.clearInterval(notifyGateCountdownTimer);
    notifyGateCountdownTimer = 0;
  }

  function hideNotifyGate() {
    clearNotifyGateCountdown();
    notifyGateResolver = null;
    if (reverseNotifyGate) reverseNotifyGate.hidden = true;
  }

  function resolveNotifyGate(decision) {
    const fn = notifyGateResolver;
    notifyGateResolver = null;
    clearNotifyGateCountdown();
    if (reverseNotifyGate) reverseNotifyGate.hidden = true;
    if (typeof fn === "function") fn(String(decision || "accept"));
  }

  function syncNotifyGateCountdownLabel() {
    if (!reverseNotifyGateHint) return;
    reverseNotifyGateHint.textContent = `${notifyGateCountdownLeft} 秒后自动收成浮窗`;
  }

  function showNotifyGate(c) {
    if (!reverseNotifyGate) return;
    const name = c.charName || "Ta";
    if (reverseNotifyGateTitle) {
      reverseNotifyGateTitle.textContent = `${name} 正在查看你的微信`;
    }
    const url = String(c.charAvatar || "").trim();
    if (reverseNotifyGateImg && reverseNotifyGatePh) {
      if (url) {
        reverseNotifyGateImg.src = url;
        reverseNotifyGateImg.classList.remove("is-hidden");
        reverseNotifyGatePh.classList.add("is-hidden");
      } else {
        reverseNotifyGateImg.removeAttribute("src");
        reverseNotifyGateImg.classList.add("is-hidden");
        reverseNotifyGatePh.textContent = name.slice(0, 1) || "?";
        reverseNotifyGatePh.classList.remove("is-hidden");
      }
    }
    notifyGateCountdownLeft = NOTIFY_GATE_AUTO_SEC;
    syncNotifyGateCountdownLabel();
    reverseNotifyGate.hidden = false;
    clearNotifyGateCountdown();
    notifyGateCountdownTimer = window.setInterval(() => {
      notifyGateCountdownLeft -= 1;
      if (notifyGateCountdownLeft <= 0) {
        resolveNotifyGate("minimize");
        return;
      }
      syncNotifyGateCountdownLabel();
    }, 1000);
  }

  function waitForNotifyGateDecision(c, token) {
    return new Promise((resolve) => {
      if (token !== autoplayToken) {
        resolve("cancel");
        return;
      }
      notifyGateResolver = (decision) => {
        if (token !== autoplayToken) resolve("cancel");
        else resolve(decision);
      };
      showNotifyGate(c);
    });
  }

  function renderNotifyPanel(root, c) {
    const user = resolveUserDisplay();
    const wrap = document.createElement("div");
    wrap.className = "xxj-hijack-sys";
    const card = document.createElement("article");
    card.className = "xxj-hijack-sys-card";
    const ico = document.createElement("span");
    ico.className = "xxj-hijack-sys-ico";
    ico.innerHTML = '<i class="ph ph-shield-warning" aria-hidden="true"></i>';
    const t = document.createElement("h3");
    t.textContent = "异地登录提醒";
    const p = document.createElement("p");
    p.textContent = `${c.charName || "Ta"} 正在你的设备上登录「${user.name}」的账号。`;
    const sub = document.createElement("p");
    sub.className = "xxj-hijack-sys-sub";
    sub.textContent = "你没有收到验证码——是 Ta 直接翻开了你的手机。";
    card.append(ico, t, p, sub);
    wrap.appendChild(card);
    root.appendChild(wrap);
  }

  function makeChatListRow(thread, maskId, index) {
    const row = document.createElement("div");
    row.className = "xxj-hijack-chat-row";
    row.dataset.threadId = String(thread.id || "");
    const avWrap = document.createElement("div");
    avWrap.className = "xxj-hijack-chat-av";
    const avImg = document.createElement("img");
    avImg.alt = "";
    avImg.loading = "lazy";
    const avPh = document.createElement("span");
    avPh.className = "xxj-hijack-chat-av-ph";
    const nm = resolveThreadLabel(thread);
    const avFallback = isGroupThread(thread) ? "群" : nm;
    const avUrl = isGroupThread(thread) ? "" : resolveCharAvatarUrl(thread.charId);
    fillAvatar(avImg, avPh, avUrl, avFallback);
    avWrap.append(avImg, avPh);
    const body = document.createElement("div");
    body.className = "xxj-hijack-chat-row-body";
    const top = document.createElement("div");
    top.className = "xxj-hijack-chat-row-top";
    const name = document.createElement("span");
    name.className = "xxj-hijack-chat-row-name";
    name.textContent = isGroupThread(thread) ? `${nm}（群）` : nm;
    const prev = lastImMessagePreview(maskId, thread.id, thread, null);
    const time = document.createElement("span");
    time.className = "xxj-hijack-chat-row-time";
    time.textContent = prev ? formatListTime(prev.at) : "";
    top.append(name, time);
    const hint = document.createElement("p");
    hint.className = "xxj-hijack-chat-row-hint";
    hint.textContent = prev ? msgPreviewText(prev.text) : "尚无消息";
    body.append(top, hint);
    row.append(avWrap, body);
    if (index === 0 && prev) {
      const badge = document.createElement("span");
      badge.className = "xxj-hijack-chat-badge";
      badge.textContent = "1";
      avWrap.appendChild(badge);
    }
    return row;
  }

  function renderContactsPanel(root, c) {
    const threads = listBrowsableThreadsForMask(c.maskId, c.charId);
    const list = document.createElement("div");
    list.className = "xxj-hijack-contacts";
    if (!threads.length) {
      const empty = document.createElement("p");
      empty.className = "xxj-hijack-empty";
      empty.textContent = "通讯录为空";
      list.appendChild(empty);
    } else {
      for (const t of threads) {
        const row = document.createElement("div");
        row.className = "xxj-hijack-contact-row";
        const av = document.createElement("div");
        av.className = "xxj-hijack-contact-av";
        const avImg = document.createElement("img");
        avImg.alt = "";
        const avPh = document.createElement("span");
        avPh.className = "xxj-hijack-chat-av-ph";
        const nm = resolveThreadLabel(t);
        fillAvatar(avImg, avPh, isGroupThread(t) ? "" : resolveCharAvatarUrl(t.charId), isGroupThread(t) ? "群" : nm);
        av.append(avImg, avPh);
        const body = document.createElement("div");
        body.className = "xxj-hijack-contact-body";
        const name = document.createElement("span");
        name.className = "xxj-hijack-contact-name";
        name.textContent = nm;
        const tag = document.createElement("span");
        tag.className = "xxj-hijack-contact-tag";
        tag.textContent = isGroupThread(t) ? "群聊" : isCheckerSelfThread(c, t) ? "你的密谈" : "好友";
        body.append(name, tag);
        row.append(av, body);
        list.appendChild(row);
      }
    }
    root.appendChild(list);
  }

  function renderThreadsPanel(root, c) {
    const threads = listBrowsableThreadsForMask(c.maskId, c.charId);
    const list = document.createElement("div");
    list.className = "xxj-hijack-chat-list";
    if (!threads.length) {
      const empty = document.createElement("p");
      empty.className = "xxj-hijack-empty";
      empty.textContent = "暂无消息";
      list.appendChild(empty);
    } else {
      threads.forEach((t, i) => list.appendChild(makeChatListRow(t, c.maskId, i)));
    }
    root.appendChild(list);
  }

  function appendChatBubble(stack, opts) {
    const { isUser, name, text, translation, avatar, fallback, showMeta = true, isLive = false } = opts;
    const seg = stripRedundantInlineTranslation(bubbleDisplayText(text), translation);
    const tr = translationWorthShowing(seg, translation) ? String(translation || "").trim() : "";
    const isRed = /^🧧|【红包】|红包/.test(seg);
    const row = document.createElement("div");
    row.className =
      `xxj-hijack-bubble-row${isUser ? " is-user" : " is-peer"}${showMeta ? "" : " is-follow"}${isLive ? " is-live-in" : ""}`;
    if (!isUser) {
      const av = document.createElement("div");
      av.className = "xxj-hijack-bubble-av";
      if (!showMeta) av.setAttribute("aria-hidden", "true");
      const img = document.createElement("img");
      img.alt = "";
      const ph = document.createElement("span");
      ph.className = "xxj-hijack-bubble-av-ph";
      fillAvatar(img, ph, avatar, fallback);
      av.append(img, ph);
      row.appendChild(av);
    }
    const col = document.createElement("div");
    col.className = "xxj-hijack-bubble-col";
    if (showMeta) {
      const who = document.createElement("span");
      who.className = "xxj-hijack-bubble-who";
      who.textContent = name;
      col.appendChild(who);
    }
    const bub = document.createElement("div");
    bub.className = `xxj-hijack-bubble${isRed ? " is-redpack" : ""}${tr ? " is-bilingual" : ""}`;
    if (tr) {
      const primary = document.createElement("div");
      primary.className = "xxj-hijack-bubble-text";
      primary.textContent = seg;
      const rule = document.createElement("div");
      rule.className = "xxj-hijack-bubble-trans-rule";
      rule.setAttribute("aria-hidden", "true");
      const trEl = document.createElement("div");
      trEl.className = "xxj-hijack-bubble-trans";
      trEl.textContent = tr;
      bub.append(primary, rule, trEl);
    } else {
      bub.textContent = seg;
    }
    col.appendChild(bub);
    row.appendChild(col);
    if (isUser) {
      const av = document.createElement("div");
      av.className = "xxj-hijack-bubble-av";
      if (!showMeta) av.setAttribute("aria-hidden", "true");
      const img = document.createElement("img");
      img.alt = "";
      const ph = document.createElement("span");
      ph.className = "xxj-hijack-bubble-av-ph";
      fillAvatar(img, ph, avatar, fallback);
      av.append(img, ph);
      row.appendChild(av);
    }
    stack.appendChild(row);
    if (isLive) {
      const scroller = stack.closest(".xxj-hijack-stage") || stack.parentElement;
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    }
    return row;
  }

  function appendMessageBubbles(stack, opts) {
    const pairs = alignTextTranslationPairs(opts.text, opts.translation);
    const list = pairs.length
      ? pairs
      : [{ text: String(opts.text || "").trim(), translation: "" }].filter((p) => p.text);
    list.forEach((pair, i) => {
      appendChatBubble(stack, {
        ...opts,
        text: pair.text,
        translation: pair.translation,
        showMeta: i === 0
      });
    });
  }

  function refreshWalletBalanceLive(c) {
    const w = readWalletSlice(c.maskId);
    const num = reverseBody?.querySelector(".xxj-hijack-wallet-num");
    if (num) {
      num.textContent = w.balance;
      num.closest(".xxj-hijack-wallet-card")?.classList.add("is-live-in");
    }
    const sheet = reverseBody?.querySelector(".xxj-hijack-wallet-sheet");
    if (sheet && w.bills.length) {
      const first = w.bills[0];
      let row = sheet.querySelector(".xxj-hijack-wallet-row.is-live-in");
      if (!row) {
        row = document.createElement("div");
        row.className = "xxj-hijack-wallet-row is-live-in";
        const left = document.createElement("div");
        left.className = "xxj-hijack-wallet-row-l";
        const t1 = document.createElement("span");
        t1.textContent = first.type;
        const t2 = document.createElement("span");
        t2.className = "xxj-hijack-wallet-row-note";
        t2.textContent = first.note || first.at;
        left.append(t1, t2);
        const amt = document.createElement("span");
        amt.className = `xxj-hijack-wallet-row-amt${first.sign === "+" ? " is-pos" : ""}`;
        amt.textContent = `${first.sign}¥${first.delta}`;
        row.append(left, amt);
        const title = sheet.querySelector(".xxj-hijack-wallet-sheet-t");
        if (title?.nextSibling) sheet.insertBefore(row, title.nextSibling);
        else sheet.appendChild(row);
      }
    }
  }

  function showReverseActionFx(c, panelId, spec, result) {
    if (!spec || !result) return;
    const action = String(spec.action || "LOOK_ONLY").toUpperCase();
    const rs = ensureReverseState(c);
    const lastAct = rs.actions.length ? rs.actions[rs.actions.length - 1] : null;
    const holdMs = 4800;
    if (action === "SEND_MSG" && result.applied && lastAct) {
      const target = lastAct.target || "某人";
      showOperationHint(c, `代发 → ${target}`, "代发", holdMs);
      updateMinimizedPillHint(c, `代发 → ${target}`);
    } else if (action === "SEND_REDPACKET" && result.applied && lastAct) {
      const target = lastAct.target || "某人";
      const amt = String(lastAct.amount || "").trim();
      showOperationHint(c, `红包 → ${target} ¥${amt}`, "红包", holdMs);
      updateMinimizedPillHint(c, `红包 → ${target} ¥${amt}`);
    } else if (action === "SEND_TRANSFER" && result.applied && lastAct) {
      const target = lastAct.target || "某人";
      const amt = String(lastAct.amount || "").trim();
      showOperationHint(c, `转账 → ${target} ¥${amt}`, "转账", holdMs);
      updateMinimizedPillHint(c, `转账 → ${target} ¥${amt}`);
    } else if (action === "ADD_WALLET" && result.applied) {
      const amt = String(spec.walletAdd || lastAct?.amount || "").trim();
      const who = String(lastAct?.by || c.charName || "Ta").trim() || "Ta";
      showOperationHint(c, `${who} 充值 ¥${amt}`, "充值", holdMs);
      updateMinimizedPillHint(c, `${who} 充值 ¥${amt}`);
      if (panelId === "wallet") refreshWalletBalanceLive(c);
    } else if (action === "POST_MOMENT" && result.applied) {
      const tx = String(lastAct?.momentText || spec.momentText || "").trim();
      showOperationHint(c, `发朋友圈：${tx.slice(0, 28)}`, "朋友圈", holdMs);
      updateMinimizedPillHint(c, "发了条朋友圈");
    } else if (action === "MOMENT_COMMENT" && result.applied) {
      const tx = String(lastAct?.momentText || spec.momentText || "").trim();
      showOperationHint(c, `评朋友圈：${tx.slice(0, 28)}`, "朋友圈", holdMs);
      updateMinimizedPillHint(c, "评论了朋友圈");
    } else if (action === "BLOCK_CHAR" && result.applied && lastAct) {
      const target = lastAct.target || "某人";
      showOperationHint(c, `拉黑 → ${target}`, "拉黑", holdMs);
      updateMinimizedPillHint(c, `拉黑 → ${target}`);
    } else if (action === "UNBLOCK_CHAR" && result.applied && lastAct) {
      const target = lastAct.target || "某人";
      showOperationHint(c, `取消拉黑 → ${target}`, "取消拉黑", holdMs);
      updateMinimizedPillHint(c, `取消拉黑 → ${target}`);
    }
  }

  function updateMinimizedPillHint(c, text) {
    const rs = ensureReverseState(c);
    if (!rs.minimized || !reverseMinimizedPillSub) return;
    const t = String(text || "").trim();
    if (!t) return;
    reverseMinimizedPillSub.textContent = t;
    reverseMinimizedPillSub.hidden = false;
  }

  function clampPillPos(left, top, w, h) {
    const maxL = Math.max(8, window.innerWidth - w - 8);
    const maxT = Math.max(8, window.innerHeight - h - 8);
    return {
      left: Math.min(maxL, Math.max(8, left)),
      top: Math.min(maxT, Math.max(8, top))
    };
  }

  function applyPillPosition(left, top) {
    if (!reverseMinimizedPill) return;
    const rect = reverseMinimizedPill.getBoundingClientRect();
    const w = rect.width || pillDrag.w || 220;
    const h = rect.height || pillDrag.h || 48;
    const p = clampPillPos(left, top, w, h);
    reverseMinimizedPill.style.left = `${p.left}px`;
    reverseMinimizedPill.style.top = `${p.top}px`;
    reverseMinimizedPill.style.right = "auto";
    reverseMinimizedPill.style.bottom = "auto";
  }

  function loadPillPosition() {
    if (!reverseMinimizedPill) return;
    try {
      const raw = localStorage.getItem(PILL_POS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (!Number.isFinite(p?.left) || !Number.isFinite(p?.top)) return;
      applyPillPosition(p.left, p.top);
    } catch (_) {
      /* ignore */
    }
  }

  function savePillPosition() {
    if (!reverseMinimizedPill) return;
    const rect = reverseMinimizedPill.getBoundingClientRect();
    try {
      localStorage.setItem(PILL_POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
    } catch (_) {
      /* ignore */
    }
  }

  function wireMinimizedPillDrag() {
    if (!reverseMinimizedPill) return;
    loadPillPosition();
    reverseMinimizedPill.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const rect = reverseMinimizedPill.getBoundingClientRect();
      pillDrag.active = true;
      pillDrag.moved = false;
      pillDrag.suppressClick = false;
      pillDrag.startX = e.clientX;
      pillDrag.startY = e.clientY;
      pillDrag.origLeft = rect.left;
      pillDrag.origTop = rect.top;
      pillDrag.w = rect.width;
      pillDrag.h = rect.height;
      reverseMinimizedPill.setPointerCapture(e.pointerId);
      reverseMinimizedPill.classList.add("is-dragging");
    });
    reverseMinimizedPill.addEventListener("pointermove", (e) => {
      if (!pillDrag.active) return;
      const dx = e.clientX - pillDrag.startX;
      const dy = e.clientY - pillDrag.startY;
      if (!pillDrag.moved && Math.abs(dx) + Math.abs(dy) > 8) pillDrag.moved = true;
      if (!pillDrag.moved) return;
      applyPillPosition(pillDrag.origLeft + dx, pillDrag.origTop + dy);
    });
    const endDrag = (e) => {
      if (!pillDrag.active) return;
      pillDrag.active = false;
      reverseMinimizedPill.classList.remove("is-dragging");
      try {
        reverseMinimizedPill.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      if (pillDrag.moved) {
        pillDrag.suppressClick = true;
        savePillPosition();
      }
      pillDrag.moved = false;
    };
    reverseMinimizedPill.addEventListener("pointerup", endDrag);
    reverseMinimizedPill.addEventListener("pointercancel", endDrag);
    reverseMinimizedPill.addEventListener("click", (e) => {
      if (pillDrag.suppressClick) {
        pillDrag.suppressClick = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const c = deps?.activeCase?.();
      if (!c) return;
      restoreReverseView(c);
    });
  }

  function syncMinimizedPill(c) {
    if (!reverseMinimizedPill) return;
    const rs = c ? ensureReverseState(c) : null;
    const show = !!(c && isReverseCase(c) && rs && !rs.done && rs.minimized);
    reverseMinimizedPill.hidden = !show;
    if (!show) {
      if (reverseMinimizedPillSub) {
        reverseMinimizedPillSub.textContent = "";
        reverseMinimizedPillSub.hidden = true;
      }
      return;
    }
    const name = c.charName || "Ta";
    if (reverseMinimizedPillT) reverseMinimizedPillT.textContent = `${name} 在翻你手机`;
    const url = String(c.charAvatar || "").trim();
    if (reverseMinimizedPillAv && reverseMinimizedPillPh) {
      if (url) {
        reverseMinimizedPillAv.src = url;
        reverseMinimizedPillAv.classList.remove("is-hidden");
        reverseMinimizedPillPh.classList.add("is-hidden");
      } else {
        reverseMinimizedPillAv.removeAttribute("src");
        reverseMinimizedPillAv.classList.add("is-hidden");
        reverseMinimizedPillPh.textContent = name.slice(0, 1) || "?";
        reverseMinimizedPillPh.classList.remove("is-hidden");
      }
    }
  }

  function minimizeReverseView(c) {
    if (!c || !isReverseCase(c)) return false;
    if (notifyGateResolver) {
      resolveNotifyGate("minimize");
      return true;
    }
    const rs = ensureReverseState(c);
    if (rs.done) return false;
    rs.minimized = true;
    c.updatedAt = Date.now();
    deps?.writeStore?.();
    checkupScreenEl?.classList.remove("is-open");
    checkupScreenEl?.setAttribute("aria-hidden", "true");
    syncMinimizedPill(c);
    toast("已最小化，Ta 还在后台翻看");
    return true;
  }

  function restoreReverseView(c) {
    if (!c || !isReverseCase(c)) return false;
    const rs = ensureReverseState(c);
    rs.minimized = false;
    c.updatedAt = Date.now();
    deps?.writeStore?.();
    checkupScreenEl?.classList.add("is-open");
    checkupScreenEl?.setAttribute("aria-hidden", "false");
    deps?.showView?.("reverse");
    syncReverseHero(c);
    renderReversePanel(c);
    syncMinimizedPill(c);
    return true;
  }

  function renderChatPanel(root, c, panelId) {
    const user = resolveUserDisplay();
    const tid = panelId.slice(5);
    const th = findThreadById(c, tid);
    const listName = th ? resolveThreadLabel(th) : "密谈";
    const isGroup = th && isGroupThread(th);
    const dmPeerName = th && !isGroup ? resolveDmAssistantBubbleName(th) : listName;
    const peerAv = th && !isGroup ? resolveCharAvatarUrl(th.charId) : "";
    const banner = document.createElement("div");
    banner.className = "xxj-hijack-chat-banner";
    if (isGroup) {
      banner.textContent = `📱 ${user.name} 的微信 · ${c.charName || "Ta"} 在翻看群聊「${listName}」`;
    } else if (listName !== dmPeerName) {
      banner.textContent = `📱 ${user.name} 的微信 · ${c.charName || "Ta"} 在翻看「${listName}」（${dmPeerName}）`;
    } else {
      banner.textContent = `📱 ${user.name} 的微信 · ${c.charName || "Ta"} 在翻看与 ${listName} 的对话`;
    }
    root.appendChild(banner);
    const stack = document.createElement("div");
    stack.className = "xxj-hijack-chat-thread";
    const msgs = readThreadLog(c.maskId, tid, 14, th, c.charId);
    if (!msgs.length) {
      const empty = document.createElement("p");
      empty.className = "xxj-hijack-empty";
      empty.textContent = "暂无线上消息";
      stack.appendChild(empty);
    } else {
      for (const m of msgs) {
        const isUser = m.role === "user";
        const peerLabel = isGroup && !isUser ? m.speakerName || "成员" : dmPeerName;
        const av = isUser ? user.avatar : peerAv;
        const fb = isUser ? user.name : isGroup ? String(peerLabel).slice(0, 1) : dmPeerName;
        appendMessageBubbles(stack, {
          isUser,
          name: isUser ? user.name : peerLabel,
          text: m.text,
          translation: m.translation,
          avatar: av,
          fallback: fb
        });
      }
    }
    root.appendChild(stack);
  }

  function renderMomentsPanel(root, c) {
    const user = resolveUserDisplay();
    const posts = readMomentsSlice(c.maskId, 8);
    const feed = document.createElement("div");
    feed.className = "xxj-hijack-moments";
    if (!posts.length) {
      const empty = document.createElement("p");
      empty.className = "xxj-hijack-empty";
      empty.textContent = "朋友圈没有动态";
      feed.appendChild(empty);
    } else {
      for (const mm of posts) {
        const item = document.createElement("article");
        item.className = "xxj-hijack-moment";
        const head = document.createElement("div");
        head.className = "xxj-hijack-moment-head";
        const av = document.createElement("div");
        av.className = "xxj-hijack-moment-av";
        const isUser = mm.kind === "user";
        const avUrl =
          isUser && typeof getMomentAvatarUrl === "function"
            ? getMomentAvatarUrl(mm)
            : isUser
              ? user.avatar
              : "";
        const avImg = document.createElement("img");
        avImg.alt = "";
        const avPh = document.createElement("span");
        const whoName = isUser ? user.name : String(mm.displayName || "Ta");
        fillAvatar(avImg, avPh, avUrl, whoName);
        av.append(avImg, avPh);
        const who = document.createElement("span");
        who.className = "xxj-hijack-moment-who";
        who.textContent = whoName;
        head.append(av, who);
        const tx = document.createElement("p");
        tx.className = "xxj-hijack-moment-text";
        tx.textContent = String(mm.text || "").replace(/\s+/g, " ").trim() || "（配图动态）";
        const meta = document.createElement("span");
        meta.className = "xxj-hijack-moment-meta";
        const t = mm.timeIso ? new Date(mm.timeIso) : null;
        meta.textContent = t && !Number.isNaN(t.getTime()) ? formatListTime(t.getTime()) : "";
        item.append(head, tx, meta);
        const cmts = Array.isArray(mm.comments) ? mm.comments : [];
        if (cmts.length) {
          const cwrap = document.createElement("div");
          cwrap.className = "xxj-hijack-moment-cmts";
          for (const cmt of cmts.slice(-3)) {
            const crow = document.createElement("p");
            crow.className = "xxj-hijack-moment-cmt";
            crow.textContent = `${String(cmt.authorName || "—")}：${String(cmt.text || "").replace(/\s+/g, " ").trim()}`;
            cwrap.appendChild(crow);
          }
          item.appendChild(cwrap);
        }
        feed.appendChild(item);
      }
    }
    root.appendChild(feed);
  }

  function renderWalletPanel(root, c) {
    const w = readWalletSlice(c.maskId);
    const page = document.createElement("div");
    page.className = "xxj-hijack-wallet";
    const card = document.createElement("div");
    card.className = "xxj-hijack-wallet-card";
    const lab = document.createElement("span");
    lab.className = "xxj-hijack-wallet-lab";
    lab.textContent = "零钱余额";
    const bal = document.createElement("div");
    bal.className = "xxj-hijack-wallet-bal";
    bal.innerHTML = `<span class="xxj-hijack-wallet-cur">¥</span><span class="xxj-hijack-wallet-num">${w.balance}</span>`;
    card.append(lab, bal);
    page.appendChild(card);
    const sheet = document.createElement("div");
    sheet.className = "xxj-hijack-wallet-sheet";
    const title = document.createElement("span");
    title.className = "xxj-hijack-wallet-sheet-t";
    title.textContent = "交易记录";
    sheet.appendChild(title);
    if (!w.bills.length) {
      const empty = document.createElement("p");
      empty.className = "xxj-hijack-empty";
      empty.textContent = "暂无账单记录";
      sheet.appendChild(empty);
    } else {
      for (const b of w.bills) {
        const row = document.createElement("div");
        row.className = "xxj-hijack-wallet-row";
        const left = document.createElement("div");
        left.className = "xxj-hijack-wallet-row-l";
        const t1 = document.createElement("span");
        t1.textContent = b.type;
        const t2 = document.createElement("span");
        t2.className = "xxj-hijack-wallet-row-note";
        t2.textContent = b.note || b.at;
        left.append(t1, t2);
        const amt = document.createElement("span");
        amt.className = `xxj-hijack-wallet-row-amt${b.sign === "+" ? " is-pos" : ""}`;
        amt.textContent = `${b.sign}¥${b.delta}`;
        row.append(left, amt);
        sheet.appendChild(row);
      }
    }
    page.appendChild(sheet);
    root.appendChild(page);
  }

  function paintReversePanelBody(root, c, panelId) {
    if (panelId === "notify") renderNotifyPanel(root, c);
    else if (panelId === "threads") renderThreadsPanel(root, c);
    else if (panelId === "contacts") renderContactsPanel(root, c);
    else if (panelId.startsWith("chat:")) renderChatPanel(root, c, panelId);
    else if (panelId === "moments") renderMomentsPanel(root, c);
    else if (panelId === "wallet") renderWalletPanel(root, c);
  }

  function reversePanelMotionEnabled() {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function resolveReversePanelEnterMotion(panelId, prevId) {
    const cur = String(panelId || "");
    const prev = String(prevId || "");
    if (cur.startsWith("chat:") && prev && !prev.startsWith("chat:")) return "is-enter-push";
    if (prev.startsWith("chat:") && cur && !cur.startsWith("chat:")) return "is-enter-pop";
    return "is-enter-fade";
  }

  function mountReversePanelShell(c, panelId, opts = {}) {
    const shell = document.createElement("div");
    shell.className = "xxj-hijack-panel";
    const animate = opts.animate !== false && reversePanelMotionEnabled();
    if (animate) {
      shell.classList.add("is-enter", resolveReversePanelEnterMotion(panelId, reverseLastPanelId));
      shell.addEventListener(
        "animationend",
        () => shell.classList.remove("is-enter", "is-enter-push", "is-enter-pop", "is-enter-fade"),
        { once: true }
      );
    }
    reverseLastPanelId = String(panelId || "");
    syncPhoneChrome(c, panelId);
    paintReversePanelBody(shell, c, panelId);
    return shell;
  }

  function renderReversePanelAt(c, panelId, opts = {}) {
    if (!reverseBody || !panelId) return;
    reverseBody.replaceChildren(mountReversePanelShell(c, panelId, opts));
  }

  function renderReversePanel(c, opts = {}) {
    if (!reverseBody) return;
    const rs = ensureReverseState(c);
    if (!rs.script.length) rs.script = buildScriptForCase(c);
    const panelId = rs.script[rs.step] || null;
    reverseBody.replaceChildren();
    if (!panelId) {
      reverseLastPanelId = "";
      rs.done = true;
      syncPhoneChrome(c, null);
      const done = document.createElement("div");
      done.className = "xxj-hijack-done";
      done.innerHTML = `<p>${c.charName || "Ta"} 已看完你的手机</p><span>正在写回密谈…</span>`;
      reverseBody.appendChild(done);
      syncReverseControls(c);
      return;
    }
    reverseBody.replaceChildren(mountReversePanelShell(c, panelId, opts));
    syncReverseStepLabel(c);
    syncReverseControls(c);
  }

  function syncReverseHero(c) {
    const user = resolveUserDisplay();
    const name = c.charName || "未命名";
    if (reverseBarName) reverseBarName.textContent = `账号：${user.name} · ${name} 在操作`;
    const url = String(c.charAvatar || "").trim();
    if (reverseAvImg && reverseAvPh) {
      if (url) {
        reverseAvImg.src = url;
        reverseAvImg.classList.remove("is-hidden");
        reverseAvPh.classList.add("is-hidden");
      } else {
        reverseAvImg.removeAttribute("src");
        reverseAvImg.classList.add("is-hidden");
        reverseAvPh.textContent = name.slice(0, 1) || "?";
        reverseAvPh.classList.remove("is-hidden");
      }
    }
  }

  function syncReverseControls(c) {
    const rs = ensureReverseState(c);
    const atEnd = rs.done || rs.step >= rs.script.length;
    if (reverseMinimizeBtn) {
      reverseMinimizeBtn.disabled = atEnd || aiBusy;
    }
    if (reverseNextBtn) {
      reverseNextBtn.disabled = atEnd || aiBusy;
      if (atEnd) reverseNextBtn.textContent = "已全部看完";
      else if (aiBusy) reverseNextBtn.textContent = autoplayRunning ? "翻看中…" : "思考中…";
      else if (autoplayRunning) reverseNextBtn.textContent = "暂停";
      else if (autoplayPaused) reverseNextBtn.textContent = "继续翻看";
      else reverseNextBtn.textContent = "暂停";
    }
    if (reverseBarState) {
      if (atEnd) reverseBarState.textContent = "已看完";
      else if (autoplayRunning && !autoplayPaused) reverseBarState.textContent = "自动翻看";
      else if (autoplayPaused) reverseBarState.textContent = "已暂停";
      else reverseBarState.textContent = "旁观中";
    }
  }

  async function processCurrentPanel(c, opts = {}) {
    const token = opts.token;
    const rs = ensureReverseState(c);
    if (rs.done || rs.step >= rs.script.length) return { hasMore: false };

    const panelId = rs.script[rs.step];
    if (!panelId || panelId === "notify") return { hasMore: !rs.done };
    if (panelId === "contacts") {
      rs.step += 1;
      if (rs.step >= rs.script.length) rs.done = true;
      c.updatedAt = Date.now();
      deps?.writeStore?.();
      return { hasMore: !rs.done, skipped: true };
    }

    renderReversePanelAt(c, panelId);
    syncReverseStepLabel(c);
    syncReverseControls(c);

    if (opts.browseFirst && autoplayRunning) {
      await delay(Math.floor(panelDwellMs(panelId) * 0.45));
      if (token != null && token !== autoplayToken) return { cancelled: true };
    }

    recordView(c, panelId);
    const { spec, result } = await runAiRoundForPanel(c, panelId);
    if (token != null && token !== autoplayToken) return { cancelled: true };

    if (spec) showReverseActionFx(c, panelId, spec, result);
    renderReversePanelAt(c, panelId, { animate: false });

    await delay(resolvePanelCompleteDwellMs(spec, result, panelId));
    if (token != null && token !== autoplayToken) return { cancelled: true };

    const thoughtSnap = String(reverseThought?.textContent || "").trim();
    if (
      thoughtSnap &&
      thoughtSnap !== "…" &&
      thoughtSnap !== "自动翻看中…" &&
      thoughtSnap !== "—"
    ) {
      await delay(thoughtDwellMs(thoughtSnap));
      if (token != null && token !== autoplayToken) return { cancelled: true };
    }

    rs.step += 1;
    if (rs.step >= rs.script.length) rs.done = true;
    c.updatedAt = Date.now();
    deps?.writeStore?.();
    return { hasMore: !rs.done, thought: thoughtSnap };
  }

  async function handleNotifyGateStep(c, token) {
    renderReversePanel(c);
    const decision = await waitForNotifyGateDecision(c, token);
    if (decision === "cancel") return { cancel: true };
    if (decision === "refuse") {
      await autoRefuseReverseCase(c);
      return { done: true };
    }
    if (decision === "minimize") minimizeReverseView(c);
    if (decision === "accept" || decision === "minimize") {
      writeSnoopLast(c.charId, Date.now());
    }
    return { ok: true };
  }

  async function advanceReverseStep(c) {
    stopAutoplay();
    autoplayPaused = true;
    syncReverseControls(c);
    const rs = ensureReverseState(c);
    if (!rs.done && rs.step < rs.script.length && rs.script[rs.step] === "notify") {
      const gate = await handleNotifyGateStep(c, autoplayToken);
      if (gate.cancel || gate.done) {
        syncReverseControls(c);
        return;
      }
      advancePastNotifyStep(c);
      if (rs.done) {
        syncReverseControls(c);
        return;
      }
    }
    await processCurrentPanel(c, { browseFirst: false });
    syncReverseControls(c);
  }

  async function runAutoplay(c) {
    const token = ++autoplayToken;
    autoplayRunning = true;
    autoplayPaused = false;
    syncReverseControls(c);
    if (reverseThought && !aiBusy) reverseThought.textContent = "自动翻看中…";

    while (token === autoplayToken) {
      const rs = ensureReverseState(c);
      if (rs.done || rs.step >= rs.script.length) break;

      const panelId = rs.script[rs.step];
      if (panelId === "notify") {
        const gate = await handleNotifyGateStep(c, token);
        if (token !== autoplayToken) return;
        if (gate.cancel || gate.done) return;
        advancePastNotifyStep(c);
        syncReverseControls(c);
        if (rs.done) break;
        await delay(DWELL_BETWEEN_MS);
        continue;
      }

      const beat = await processCurrentPanel(c, { browseFirst: true, token });
      if (token !== autoplayToken) return;
      if (beat.cancelled) return;
      syncReverseControls(c);
      if (!beat.hasMore) break;
      await delay(DWELL_BETWEEN_MS);
    }

    if (token !== autoplayToken) return;
    autoplayRunning = false;
    autoplayPaused = false;
    syncReverseControls(c);
    const rs = ensureReverseState(c);
    if (rs.done) {
      const last = rs.reactions.length ? rs.reactions[rs.reactions.length - 1].text : "";
      if (reverseThought) {
        const cur = String(reverseThought.textContent || "").trim();
        if (!cur || cur === "自动翻看中…" || cur === "…") {
          reverseThought.textContent = sanitizeThoughtForDisplay(last, resolveUserDisplay().name) || "看完了。";
        }
      }
      if (last) await delay(thoughtDwellMs(last));
      if (token !== autoplayToken) return;
      await autoFinishReverseCase(c);
    }
  }

  function resumeAutoplay(c) {
    const rs = ensureReverseState(c);
    if (rs.done || rs.step >= rs.script.length) return;
    autoplayPaused = false;
    void runAutoplay(c);
  }

  function readSnoopLastMap() {
    const raw = window.XXJ_DB?.getKv?.(K_SNOOP_LAST);
    return raw && typeof raw === "object" ? raw : {};
  }

  function writeSnoopLast(charId, at) {
    const cid = String(charId || "").trim();
    if (!cid || typeof window.XXJ_DB?.setKv !== "function") return;
    const m = { ...readSnoopLastMap(), [cid]: Number(at) || Date.now() };
    window.XXJ_DB.setKv(K_SNOOP_LAST, m);
  }

  function getReverseSnoopScore(charItem, thread) {
    const text = [
      charItem?.desc,
      charItem?.scenario,
      charItem?.firstMessage,
      thread?.scenePrompt,
      thread?.charThreadRemarkName
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    let score = 0.08;
    const highTraits = ["占有", "嫉妒", "控制", "偷看", "偷偷", "监视", "窥探", "疑心", "多疑", "病娇", "腹黑", "小心眼"];
    const medTraits = ["好奇", "八卦", "调皮", "淘气", "在意", "傲娇", "别扭"];
    const lowTraits = ["温柔", "害羞", "内向", "安静", "乖巧"];
    for (const t of highTraits) if (text.includes(t)) score += 0.12;
    for (const t of medTraits) if (text.includes(t)) score += 0.06;
    for (const t of lowTraits) if (text.includes(t)) score -= 0.03;
    return Math.max(0.04, Math.min(0.55, score));
  }

  function listThreadsForProactiveSnoop(maskId) {
    if (typeof readChatInboxStore !== "function") return [];
    const inbox = readChatInboxStore();
    const key = maskKey(maskId);
    const bucket = inbox?.byMask?.[key];
    const threads = Array.isArray(bucket?.threads) ? bucket.threads : [];
    const out = [];
    for (const t of threads) {
      if (!t || isGroupThread(t)) continue;
      const cid = String(t.charId || "").trim();
      if (!cid || t.charReverseSnoopEnabled !== true) continue;
      out.push(t);
    }
    return out;
  }

  function pickWeightedThread(threads, maskId) {
    if (!threads.length) return null;
    const lastMap = readSnoopLastMap();
    const now = Date.now();
    const eligible = threads.filter((t) => {
      const cid = String(t.charId || "").trim();
      const last = Number(lastMap[cid]) || 0;
      return now - last >= PROACTIVE_CHAR_COOLDOWN_MS;
    });
    if (!eligible.length) return null;
    const scored = eligible.map((t) => {
      const cid = String(t.charId || "").trim();
      const ch = typeof getCharPersonaItemById === "function" ? getCharPersonaItemById(cid) : null;
      return { t, score: getReverseSnoopScore(ch, t) };
    });
    const total = scored.reduce((s, x) => s + x.score, 0);
    let r = Math.random() * total;
    for (const row of scored) {
      r -= row.score;
      if (r <= 0) return row.t;
    }
    return scored[0].t;
  }

  async function shouldCharacterReverseSnoop(c, thread) {
    const ai = window.RP_AI;
    if (!ai?.chatCompletions) return false;
    const cfg = ai.getConfig?.() || {};
    if (!String(cfg.apiKey || "").trim()) return false;
    const charItem = typeof getCharPersonaItemById === "function" ? getCharPersonaItemById(c.charId) : null;
    const owner = resolveUserDisplay().name;
    const persona = [
      `角色：${c.charName || "Ta"}`,
      charItem?.desc ? `人设：${String(charItem.desc).slice(0, 500)}` : "",
      thread?.scenePrompt ? `剧情：${String(thread.scenePrompt).slice(0, 300)}` : ""
    ]
      .filter(Boolean)
      .join("\n");
    try {
      const data = await requestReverseAiCompletion(
        [
          {
            role: "system",
            content:
              "你判断角色在给定人设与剧情下，此刻是否会主动想偷偷翻看对方手机微信。只回复 YES 或 NO，不要解释。"
          },
          {
            role: "user",
            content: `${persona}\n\n对方昵称：${owner}\n\n此时 TA 会不会想偷偷翻 ${owner} 的手机？`
          }
        ],
        { temperature: 0.4, max_tokens: 16, json: false }
      );
      const raw = readAiText(data).toUpperCase();
      return raw.includes("YES");
    } catch {
      return false;
    }
  }

  function randMs(min, max) {
    return min + Math.floor(Math.random() * Math.max(1, max - min));
  }

  function stopProactiveScheduler() {
    if (proactiveTimer) window.clearTimeout(proactiveTimer);
    if (proactiveInterval) window.clearInterval(proactiveInterval);
    proactiveTimer = 0;
    proactiveInterval = 0;
  }

  function scheduleProactiveReverseScan(delayMs) {
    stopProactiveScheduler();
    const wait =
      Number(delayMs) > 0 ? Number(delayMs) : randMs(PROACTIVE_FIRST_MIN_MS, PROACTIVE_FIRST_MAX_MS);
    proactiveTimer = window.setTimeout(() => {
      void tryProactiveReverseSnoop();
      proactiveInterval = window.setInterval(() => {
        void tryProactiveReverseSnoop();
      }, randMs(PROACTIVE_INTERVAL_MIN_MS, PROACTIVE_INTERVAL_MAX_MS));
    }, wait);
  }

  async function tryProactiveReverseSnoop() {
    if (proactiveBusy || autoplayRunning || aiBusy) return;
    if (deps?.hasOpenReverseCase?.()) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const maskId =
      typeof getActiveMaskIdForInbox === "function" ? String(getActiveMaskIdForInbox() || "").trim() : "";
    if (!maskId) return;
    const threads = listThreadsForProactiveSnoop(maskId);
    const pick = pickWeightedThread(threads, maskId);
    if (!pick) return;
    const threadId = String(pick.id || "").trim();
    const charId = String(pick.charId || "").trim();
    if (!threadId || !charId) return;
    proactiveBusy = true;
    try {
      const probe = {
        charId,
        charName: resolvePersonaName(charId, pick),
        charAvatar: resolveCharAvatarUrl(charId),
        threadId,
        maskId
      };
      const ok = await shouldCharacterReverseSnoop(probe, pick);
      if (!ok) return;
      const caseId = deps?.createProactiveReverseCase?.(probe);
      if (!caseId) return;
      openReverseCase(caseId);
    } finally {
      proactiveBusy = false;
    }
  }

  function openReverseCase(caseId) {
    if (!ensureDeps()) {
      toast("反向查岗模块未就绪，请刷新页面");
      return false;
    }
    const c = deps?.activeCase?.() || deps?.getCaseById?.(caseId);
    if (!c || !isReverseCase(c)) return false;
    stopAutoplay();
    reverseLastPanelId = "";
    deps?.setActiveCaseId?.(caseId);
    ensureReverseState(c);
    if (!c.reverse.script.length) c.reverse.script = buildScriptForCase(c);
    deps?.writeStore?.();
    syncReverseHero(c);
    const rs = ensureReverseState(c);
    if (c.proactive === true) {
      deps?.openCheckupScreenShell?.();
      toast(`${c.charName || "Ta"} 正在翻看你的手机`);
    }
    renderReversePanel(c);
    c.reverse.minimized = false;
    deps?.writeStore?.();
    syncMinimizedPill(c);
    deps?.showView?.("reverse");
    if (rs.done) {
      autoplayPaused = false;
      syncReverseControls(c);
      if (!c.reverse?.finishWritten) void autoFinishReverseCase(c);
    } else {
      autoplayPaused = false;
      void runAutoplay(c);
    }
    return true;
  }

  function isReverseCaseInterrupted(c) {
    const rs = ensureReverseState(c);
    return !rs.done && rs.step < rs.script.length;
  }

  function buildReverseFinishReport(c, opts) {
    const rs = ensureReverseState(c);
    const userKicked = opts && opts.userKicked === true;
    const lines = [];
    lines.push(`反向查岗 · ${c.charName || "Ta"} 翻看你的手机`);
    lines.push(`理由：${deps?.caseReasonLabel?.(c) || "—"}`);
    if (userKicked) {
      lines.push("状态：主控中途夺回手机，翻查被强行中断（以下为已看到的部分）");
    }
    lines.push("");
    if (rs.viewed.length) {
      lines.push("已看：");
      for (const v of rs.viewed) {
        if (String(v?.panel || "") === "notify") continue;
        lines.push(`· ${v.target || v.panel}`);
        if (v.excerpt) lines.push(`  ${String(v.excerpt).slice(0, 200)}`);
      }
    }
    if (rs.actions.length) {
      lines.push("");
      lines.push("行动：");
      for (const a of rs.actions) {
        const k = String(a.kind || "");
        if (k === "SEND_MSG" && a.ok) lines.push(`· 代发 ${a.target}：${String(a.message || "").slice(0, 120)}`);
        else if (k === "SEND_REDPACKET" && a.ok) lines.push(`· 红包 ¥${a.amount} → ${a.target}`);
        else if (k === "SEND_TRANSFER" && a.ok) lines.push(`· 转账 ¥${a.amount} → ${a.target}`);
        else if (k === "ADD_WALLET" && a.ok) lines.push(`· ${a.by || c.charName || "Ta"} 充值 ¥${a.amount}`);
        else if (k === "POST_MOMENT" && a.ok) lines.push(`· 发朋友圈：${String(a.momentText || "").slice(0, 80)}`);
        else if (k === "MOMENT_COMMENT" && a.ok) lines.push(`· 评朋友圈：${String(a.momentText || "").slice(0, 80)}`);
        else if (k === "BLOCK_CHAR" && a.ok) lines.push(`· 拉黑 ${a.target || "某人"}`);
        else if (k === "UNBLOCK_CHAR" && a.ok) lines.push(`· 取消拉黑 ${a.target || "某人"}`);
        else if (a.thought) lines.push(`· ${k}：${String(a.thought).slice(0, 80)}`);
      }
    }
    return lines.join("\n").slice(0, 12_000);
  }

  function writeReverseFinishToMitalk(c, opts) {
    const maskId = String(c.maskId || "").trim();
    const threadId = String(c.threadId || "").trim();
    if (!maskId || !threadId) return false;
    if (typeof readChatLogForMaskThread !== "function" || typeof saveChatLogForMaskThread !== "function") {
      return false;
    }
    const userKicked = opts && opts.userKicked === true;
    const user = resolveUserDisplay();
    const at = Date.now();
    const report = buildReverseFinishReport(c, { userKicked });
    const log = readChatLogForMaskThread(maskId, threadId);
    const notice = {
      role: "notice",
      kind: "checkup_reverse_finish",
      at,
      content: "",
      checkupReport: report,
      checkupReason: deps?.caseReasonLabel?.(c) || "",
      charName: c.charName || "Ta",
      checkupReverseViewed: ensureReverseState(c).viewed
        .filter((v) => String(v?.panel || "") !== "notify")
        .map((v) => ({
          panel: v.panel,
          target: v.target,
          excerpt: String(v.excerpt || "").slice(0, 400)
        })),
      checkupReverseActions: ensureReverseState(c).actions.slice(0, 20)
    };
    if (userKicked) {
      notice.userKicked = true;
      notice.userName = user.name;
    }
    log.push(notice);
    saveChatLogForMaskThread(maskId, threadId, log);
    if (typeof scheduleRenderChatMessages === "function") scheduleRenderChatMessages();
    if (typeof scheduleChatContextTokenLabelUpdate === "function") scheduleChatContextTokenLabelUpdate();
    if (typeof runCheckupReverseFinishAssistantRound === "function") {
      void runCheckupReverseFinishAssistantRound(maskId, threadId, { userKicked });
    }
    return true;
  }

  function writeReverseRefuseToMitalk(c) {
    const maskId = String(c.maskId || "").trim();
    const threadId = String(c.threadId || "").trim();
    if (!maskId || !threadId) return false;
    if (typeof readChatLogForMaskThread !== "function" || typeof saveChatLogForMaskThread !== "function") {
      return false;
    }
    const at = Date.now();
    const user = resolveUserDisplay();
    const log = readChatLogForMaskThread(maskId, threadId);
    log.push({
      role: "notice",
      kind: "checkup_reverse_refused",
      at,
      content: "",
      charName: c.charName || "Ta",
      userName: user.name,
      checkupReason: deps?.caseReasonLabel?.(c) || ""
    });
    saveChatLogForMaskThread(maskId, threadId, log);
    if (typeof scheduleRenderChatMessages === "function") scheduleRenderChatMessages();
    if (typeof scheduleChatContextTokenLabelUpdate === "function") scheduleChatContextTokenLabelUpdate();
    if (typeof runCheckupReverseRefuseAssistantRound === "function") {
      void runCheckupReverseRefuseAssistantRound(maskId, threadId);
    }
    return true;
  }

  async function autoRefuseReverseCase(c) {
    if (!c || !isReverseCase(c)) return false;
    const rs = ensureReverseState(c);
    if (c.reverse.refuseWritten) return true;
    hideNotifyGate();
    rs.done = true;
    rs.refused = true;
    c.refused = true;
    c.status = "done";
    c.updatedAt = Date.now();
    c.reverse.refuseWritten = true;
    deps?.writeStore?.();
    if (reverseBarState) reverseBarState.textContent = "已拒绝";
    const wrote = writeReverseRefuseToMitalk(c);
    toast(wrote ? `已拒绝，${c.charName || "Ta"} 会知道` : "写回密谈失败");
    await delay(900);
    stopAutoplay();
    syncMinimizedPill(null);
    deps?.setActiveCaseId?.(null);
    deps?.showView?.("hub");
    deps?.renderCaseList?.();
    return wrote;
  }

  async function autoFinishReverseCase(c, opts) {
    if (!c || !isReverseCase(c)) return false;
    const rs = ensureReverseState(c);
    if (c.reverse.finishWritten) return true;
    const userKicked = opts && opts.userKick === true;
    rs.done = true;
    if (userKicked) {
      rs.kicked = true;
      c.kickedOut = true;
    }
    c.status = "done";
    c.updatedAt = Date.now();
    c.reverse.finishWritten = true;
    deps?.writeStore?.();
    const doneSub = reverseBody?.querySelector(".xxj-hijack-done span");
    if (doneSub) doneSub.textContent = "正在写回密谈…";
    if (reverseBarState) reverseBarState.textContent = userKicked ? "已中断" : "写回中";
    const wrote = writeReverseFinishToMitalk(c, { userKicked });
    if (doneSub) doneSub.textContent = wrote ? "已写入绑定密谈" : "写回失败";
    if (reverseThought && wrote) {
      reverseThought.textContent = userKicked
        ? "你夺回了手机，Ta 会记得这次没看完。"
        : "已悄悄写进密谈，Ta 会记得。";
    }
    toast(
      wrote
        ? userKicked
          ? `已夺回手机，${c.charName || "Ta"} 会知道没看完`
          : `${c.charName || "Ta"} 翻查结束，已写入密谈`
        : "写回密谈失败"
    );
    await delay(1800);
    stopAutoplay();
    syncMinimizedPill(null);
    deps?.setActiveCaseId?.(null);
    deps?.showView?.("hub");
    deps?.renderCaseList?.();
    return wrote;
  }

  function openReverseKickOut() {
    if (!ensureDeps()) return;
    stopAutoplay();
    const c = deps?.activeCase?.();
    if (!c) return;
    void autoFinishReverseCase(c, { userKick: isReverseCaseInterrupted(c) });
  }

  function ensureDeps() {
    if (deps) return true;
    const core = window.XXJ_CheckupCore;
    if (!core || typeof core !== "object") return false;
    init(core);
    return !!deps;
  }

  function init(hooks) {
    deps = hooks || {};
    if (wired) return;
    wired = true;
    document.getElementById("checkup-reverse-to-hub")?.addEventListener("click", () => {
      stopAutoplay();
      deps?.setActiveCaseId?.(null);
      deps?.showView?.("hub");
      deps?.renderCaseList?.();
    });
    document.getElementById("checkup-reverse-finish-btn")?.addEventListener("click", openReverseKickOut);
    reverseMinimizeBtn?.addEventListener("click", () => {
      const c = deps?.activeCase?.();
      if (!c) return;
      minimizeReverseView(c);
    });
    wireMinimizedPillDrag();
    reverseNextBtn?.addEventListener("click", () => {
      const c = deps?.activeCase?.();
      if (!c) return;
      const rs = ensureReverseState(c);
      if (rs.done || rs.step >= rs.script.length) return;
      if (autoplayRunning) {
        autoplayPaused = true;
        stopAutoplay();
        syncReverseControls(c);
        toast("已暂停");
        return;
      }
      if (autoplayPaused) {
        resumeAutoplay(c);
        return;
      }
      if (aiBusy) return;
      void advanceReverseStep(c);
    });
    reverseNotifyAcceptBtn?.addEventListener("click", () => resolveNotifyGate("accept"));
    reverseNotifyMinimizeBtn?.addEventListener("click", () => resolveNotifyGate("minimize"));
    reverseNotifyRefuseBtn?.addEventListener("click", () => resolveNotifyGate("refuse"));
    scheduleProactiveReverseScan(randMs(PROACTIVE_FIRST_MIN_MS, PROACTIVE_FIRST_MAX_MS));
  }

  window.XXJ_CheckupReverse = {
    init,
    isReverseCase,
    openReverseCase,
    openReverseKickOut,
    minimizeReverseView,
    restoreReverseView,
    syncMinimizedPill,
    kickProactiveReverseScan: () => void tryProactiveReverseSnoop(),
    stopAutoplay,
    ASSET_V
  };

  if (window.XXJ_CheckupCore) {
    init(window.XXJ_CheckupCore);
  }
})();
