"use strict";

/**
 * 关系网 · char↔char 私聊线（完整存档 + AI 摘要注入 + 可选转发密谈）
 * 注意：私聊只写入 RELATION_CHAR_DM_V1（pairs 共用存档），不会新增/修改关系网条目（RELATION_GRAPH_V1）。
 */
(function () {
  const K_STORE = "RELATION_CHAR_DM_V1";
  const MSG_MAX = 240;
  const RECENT_INJECT = 16;
  const SUMMARY_EACH = 700;
  const DEFAULT_SUMMARY_ROLL_AT = 72;
  const DEFAULT_SUMMARY_KEEP_AFTER_ROLL = 36;
  const SUMMARY_ROLL_AT_MIN = 24;
  const SUMMARY_ROLL_AT_MAX = 200;
  const SUMMARY_KEEP_MIN = 12;
  const SUMMARY_KEEP_MAX = 120;
  const SEGMENT_LINES_MIN = 16;
  const SEGMENT_LINES_MAX = 28;
  /** 关系网生成时注入密谈最近气泡条数（与群聊关联私聊 bridge 同源）。 */
  const RELATION_MITALK_RECENT_CAP = 10;
  const RELATION_MITALK_REF_MAX = 2800;

  const viewInteract = document.getElementById("relation-view-interact");
  const interactHead = document.getElementById("relation-interact-head");
  const interactTranscript = document.getElementById("relation-interact-transcript");
  const interactContinueBtn = document.getElementById("relation-interact-continue");
  const interactClearBtn = document.getElementById("relation-interact-clear");

  /** @type {{ ownerCharId: string, peerCharId: string, peerName: string, isNpc: boolean } | null} */
  let session = null;
  let busy = false;

  function toast(msg) {
    if (typeof showToast === "function") showToast(msg);
  }

  async function relationDmChatCompletions(payload, fetchOpts) {
    const ai = window.RP_AI;
    if (!ai?.chatCompletions) throw new Error("AI 未加载");
    const resolveFn = typeof window.resolveRelationCompletionConfig === "function"
      ? window.resolveRelationCompletionConfig
      : null;
    const completionConfig = resolveFn ? resolveFn() : null;
    const key = String(completionConfig?.apiKey || "").trim();
    if (key) {
      return ai.chatCompletions(payload, { ...(fetchOpts || {}), completionConfig });
    }
    if (typeof window.relationAiKeyMissingMessage === "function") {
      const msg = window.relationAiKeyMissingMessage();
      const main = ai.getConfig?.();
      if (!String(main?.apiKey || "").trim()) throw new Error(msg);
    }
    return ai.chatCompletions(payload, fetchOpts);
  }

  function uid() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `rdm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function readStore() {
    const D = window.XXJ_DB;
    if (!D) return { v: 1, byMask: {}, summarySettings: {} };
    const raw = D.getKv(K_STORE);
    if (raw && raw.v === 1 && raw.byMask && typeof raw.byMask === "object") {
      if (!raw.summarySettings || typeof raw.summarySettings !== "object") raw.summarySettings = {};
      return raw;
    }
    return { v: 1, byMask: {}, summarySettings: {} };
  }

  function writeStore(st) {
    const D = window.XXJ_DB;
    if (D) D.setKv(K_STORE, st);
  }

  function clampSummarySettings(raw) {
    let rollAt = Math.floor(Number(raw?.rollAt ?? DEFAULT_SUMMARY_ROLL_AT));
    let keepAfterRoll = Math.floor(Number(raw?.keepAfterRoll ?? DEFAULT_SUMMARY_KEEP_AFTER_ROLL));
    if (!Number.isFinite(rollAt)) rollAt = DEFAULT_SUMMARY_ROLL_AT;
    if (!Number.isFinite(keepAfterRoll)) keepAfterRoll = DEFAULT_SUMMARY_KEEP_AFTER_ROLL;
    rollAt = Math.min(SUMMARY_ROLL_AT_MAX, Math.max(SUMMARY_ROLL_AT_MIN, rollAt));
    keepAfterRoll = Math.min(SUMMARY_KEEP_MAX, Math.max(SUMMARY_KEEP_MIN, keepAfterRoll));
    if (keepAfterRoll >= rollAt) keepAfterRoll = Math.max(SUMMARY_KEEP_MIN, rollAt - 12);
    return { rollAt, keepAfterRoll };
  }

  function getSummarySettings(maskId) {
    const mid = String(maskId || "").trim();
    if (!mid) return clampSummarySettings(null);
    return clampSummarySettings(readStore().summarySettings?.[mid]);
  }

  function setSummarySettings(maskId, patch) {
    const mid = String(maskId || "").trim();
    if (!mid) return clampSummarySettings(null);
    const st = readStore();
    if (!st.summarySettings) st.summarySettings = {};
    const next = clampSummarySettings({ ...getSummarySettings(mid), ...(patch || {}) });
    st.summarySettings[mid] = next;
    writeStore(st);
    return next;
  }

  function getActiveMaskId() {
    const D = window.XXJ_DB;
    if (!D) return "";
    const st = D.getKv(D.K.USER_MASK_STORE);
    if (!st || !Array.isArray(st.items)) return "";
    const id = String(st.activeId || "").trim();
    if (id && st.items.some((x) => String(x?.id || "") === id)) return id;
    return String(st.items[0]?.id || "").trim();
  }

  function personaSnippet(ch) {
    if (!ch) return "";
    return [ch.persona, ch.summary, ch.voice, ch.boundaries]
      .filter((x) => String(x || "").trim())
      .join("\n")
      .slice(0, 900);
  }

  function charWorldBookBlock(ch, userName) {
    const fn = window.buildCharWorldBookBlockForPrompt;
    if (typeof fn !== "function" || !ch) return "";
    return String(fn(ch, charDisplayName(ch), userName) || "").trim();
  }

  function relationViewLine(maskId, viewerCharId, peerCharId, viewerName, peerName) {
    const fn = window.relationGetLinkEntryForPeer;
    if (typeof fn !== "function") return "";
    const entry = fn(maskId, viewerCharId, peerCharId);
    if (!entry?.rel) return "";
    const tail = entry.detail ? ` · ${entry.detail.slice(0, 160)}` : "";
    return `【${viewerName} 眼中与 ${peerName} 的关系】${entry.rel}${tail}`;
  }

  function readActiveMask() {
    const D = window.XXJ_DB;
    if (!D) return { id: "", displayName: "你" };
    const st = D.getKv(D.K.USER_MASK_STORE);
    const id = getActiveMaskId();
    const row = (st?.items || []).find((x) => String(x?.id || "") === id);
    return { id, displayName: String(row?.displayName || "").trim() || "你" };
  }

  function readCharStore() {
    const D = window.XXJ_DB;
    if (!D) return { items: [] };
    const raw = D.getKv(D.K.CHAR_PERSONA_STORE);
    return raw && Array.isArray(raw.items) ? raw : { items: [] };
  }

  function charById(charId) {
    const cid = String(charId || "").trim();
    if (!cid) return null;
    return readCharStore().items.find((x) => String(x?.id || "") === cid) || null;
  }

  function charDisplayName(ch) {
    return String(ch?.displayName || "").trim() || "未命名角色";
  }

  function charUsesForeignDialogue(ch) {
    const dlg = String(ch?.dialogueLang || "").trim();
    if (!dlg) return false;
    return !/^中文|汉语|简体|繁体|普通话|国语|zh/i.test(dlg);
  }

  /** @param {object | null} owner @param {object | null} peer @param {{ npcOnly?: boolean }} [opts] */
  function relationTranslationPromptLines(owner, peer, opts) {
    const npcOnly = opts && opts.npcOnly === true;
    /** @type {string[]} */
    const hints = [];
    if (owner && charUsesForeignDialogue(owner)) {
      hints.push(`${charDisplayName(owner)}（${String(owner.dialogueLang || "").trim()}）`);
    }
    if (!npcOnly && peer && charUsesForeignDialogue(peer)) {
      hints.push(`${charDisplayName(peer)}（${String(peer.dialogueLang || "").trim()}）`);
    }
    if (!hints.length) return [];
    return [
      `[对照翻译 · 关系网私聊 · 与密谈/查岗同源]`,
      `${hints.join("、")} 的 lines[].text 写常用对白语言原文；须同时写 lines[].translation（中文读本）。`,
      `text 与 translation 均可用 ||| 分段一一对齐；勿改 text 原文，勿在 text 里自写括号译本。`,
      `JSON：{"lines":[{"who":"owner"|"peer","text":"…","translation":"…"}, …]}。`
    ];
  }

  function relationFormatMsgDisplayText(text, translation) {
    const main = String(text || "").trim();
    const tr = String(translation || "").trim();
    if (!main || !tr) return main;
    if (typeof formatOfflineTextWithInlineTranslation === "function" && /「[^」]*」/u.test(main)) {
      return formatOfflineTextWithInlineTranslation(main, tr);
    }
    return `${main}（${tr}）`;
  }

  /** NPC 线无 peerCharId；勿对空 id 调 charDisplayName（会得到「未命名角色」）。 */
  function resolvePeerDisplayName(viewPeerCharId, lane, fallback = "对方") {
    const cid = String(viewPeerCharId || "").trim();
    if (cid) {
      const ch = charById(cid);
      if (ch) return charDisplayName(ch);
    }
    return String(lane?.peerName || "").trim() || fallback;
  }

  /** char↔char 私聊生成：勿捏造密谈未发生之事 */
  function mitalkFactGuardLine(userName) {
    const u = String(userName || "").trim() || "用户";
    return [
      `**严禁编造 ${u} 密谈剧情**：下方「密谈参考」里的记忆摘要与最近消息节选，只能引用其中**明确写过**的事与对白。`,
      `不得虚构密谈里未发生过的具体事件（约会、见面、吵架、承诺、礼物、亲密、行程、告白等）。`,
      `无依据时宁可聊关系网私聊既有线、日常或情绪，不要捏造「${u} 刚才/最近在密谈里怎样了」。`
    ].join("");
  }

  function peerKey(peerCharId, peerName) {
    const cid = String(peerCharId || "").trim();
    if (cid) return `c:${cid}`;
    const nk = String(peerName || "").trim().toLowerCase();
    return nk ? `n:${nk}` : "";
  }

  /** 两角色共用私聊线的 canonical key（与关系网视角无关） */
  function pairStoreKey(charIdA, charIdB) {
    const a = String(charIdA || "").trim();
    const b = String(charIdB || "").trim();
    if (!a || !b || a === b) return "";
    return a < b ? `p:${a}:${b}` : `p:${b}:${a}`;
  }

  function sortedPairIds(charIdA, charIdB) {
    const a = String(charIdA || "").trim();
    const b = String(charIdB || "").trim();
    if (!a || !b) return ["", ""];
    return a < b ? [a, b] : [b, a];
  }

  function getLane(maskId, ownerCharId, pk) {
    const st = readStore();
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    const key = String(pk || "").trim();
    if (!mid || !oid || !key) return null;
    const row = st.byMask[mid]?.[oid]?.[key];
    return row && typeof row === "object" ? row : null;
  }

  function saveOwnerLane(maskId, ownerCharId, pk, lane) {
    const st = readStore();
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    const key = String(pk || "").trim();
    if (!mid || !oid || !key || !lane) return;
    if (!st.byMask[mid]) st.byMask[mid] = {};
    if (!st.byMask[mid][oid]) st.byMask[mid][oid] = {};
    lane.updatedAt = Date.now();
    st.byMask[mid][oid][key] = lane;
    writeStore(st);
  }

  function ensureOwnerNpcLane(maskId, ownerCharId, npcName) {
    const pk = peerKey("", npcName);
    if (!pk) return null;
    const existing = getLane(maskId, ownerCharId, pk);
    if (existing) return existing;
    const lane = {
      peerName: String(npcName || "").trim(),
      isNpc: true,
      messages: [],
      summaryRolled: "",
      summaryChunks: [],
      updatedAt: Date.now()
    };
    saveOwnerLane(maskId, ownerCharId, pk, lane);
    return lane;
  }

  function resolveSpeakerCharId(msg, lane, fallbackOwnerCharId, fallbackPeerCharId) {
    const sid = String(msg?.speakerCharId || "").trim();
    if (sid) return sid;
    if (msg?.who === "user") return "";
    const anchorOwner = String(lane?.anchorOwnerCharId || fallbackOwnerCharId || "").trim();
    const anchorPeer = String(lane?.peerCharId || fallbackPeerCharId || "").trim();
    if (msg?.who === "peer") return anchorPeer;
    if (msg?.who === "owner") return anchorOwner;
    return anchorOwner;
  }

  function messageSideForView(msg, viewOwnerCharId, viewPeerCharId, lane) {
    if (msg?.who === "user") return "user";
    const sid = resolveSpeakerCharId(msg, lane, viewOwnerCharId, viewPeerCharId);
    if (sid && sid === viewOwnerCharId) return "owner";
    if (sid && sid === viewPeerCharId) return "peer";
    return msg?.who === "peer" ? "peer" : "owner";
  }

  function migrateMessageSpeaker(msg, legacyOwnerCharId, legacyPeerCharId) {
    const m = { ...(msg && typeof msg === "object" ? msg : {}) };
    if (!String(m.speakerCharId || "").trim() && m.who !== "user") {
      m.speakerCharId = m.who === "peer" ? legacyPeerCharId : legacyOwnerCharId;
    }
    return m;
  }

  function mergeMessagesUnique(listA, listB) {
    /** @type {object[]} */
    const out = [];
    const seen = new Set();
    for (const src of [listA, listB]) {
      if (!Array.isArray(src)) continue;
      for (const m of src) {
        const key =
          String(m?.id || "").trim() ||
          `${Number(m?.at || 0)}|${String(m?.speakerCharId || m?.who || "")}|${String(m?.text || "").trim()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(m);
      }
    }
    out.sort((x, y) => Number(x?.at || 0) - Number(y?.at || 0));
    return out;
  }

  function getLegacyLane(maskId, ownerCharId, peerCharId) {
    const pk = peerKey(peerCharId, "");
    if (!pk) return null;
    return getLane(maskId, ownerCharId, pk);
  }

  function buildPairLaneFromLegacy(maskId, charA, charB, peerNameHint) {
    const laneAB = getLegacyLane(maskId, charA, charB);
    const laneBA = getLegacyLane(maskId, charB, charA);
    if (!laneAB && !laneBA) return null;
    const [idLow, idHigh] = sortedPairIds(charA, charB);
    let messages = [];
    if (laneAB) {
      messages = mergeMessagesUnique(
        messages,
        (Array.isArray(laneAB.messages) ? laneAB.messages : []).map((m) =>
          migrateMessageSpeaker(m, charA, charB)
        )
      );
    }
    if (laneBA) {
      messages = mergeMessagesUnique(
        messages,
        (Array.isArray(laneBA.messages) ? laneBA.messages : []).map((m) =>
          migrateMessageSpeaker(m, charB, charA)
        )
      );
    }
    const pick = laneAB || laneBA;
    const chunks = [
      ...(Array.isArray(laneAB?.summaryChunks) ? laneAB.summaryChunks : []),
      ...(Array.isArray(laneBA?.summaryChunks) ? laneBA.summaryChunks : [])
    ].slice(-8);
    return {
      charA: idLow,
      charB: idHigh,
      peerCharId: charB,
      peerName:
        String(peerNameHint || pick?.peerName || "").trim() ||
        charDisplayName(charById(charB)),
      messages,
      summaryRolled: [laneAB?.summaryRolled, laneBA?.summaryRolled]
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .join("\n")
        .slice(0, 2000),
      summaryChunks: chunks,
      anchorOwnerCharId: String(pick?.anchorOwnerCharId || charA).trim(),
      updatedAt: Math.max(Number(laneAB?.updatedAt || 0), Number(laneBA?.updatedAt || 0)) || Date.now()
    };
  }

  function savePairLane(maskId, charIdA, charIdB, lane) {
    const st = readStore();
    const mid = String(maskId || "").trim();
    const pk = pairStoreKey(charIdA, charIdB);
    if (!mid || !pk || !lane) return;
    const [idLow, idHigh] = sortedPairIds(charIdA, charIdB);
    if (!st.byMask[mid]) st.byMask[mid] = {};
    if (!st.byMask[mid].pairs) st.byMask[mid].pairs = {};
    lane.updatedAt = Date.now();
    lane.charA = idLow;
    lane.charB = idHigh;
    st.byMask[mid].pairs[pk] = lane;
    writeStore(st);
  }

  function getPairLane(maskId, viewOwnerCharId, peerCharId) {
    const mid = String(maskId || "").trim();
    const a = String(viewOwnerCharId || "").trim();
    const b = String(peerCharId || "").trim();
    const pk = pairStoreKey(a, b);
    if (!mid || !pk) return null;
    const st = readStore();
    const row = st.byMask[mid]?.pairs?.[pk];
    if (row && typeof row === "object") return row;
    const migrated = buildPairLaneFromLegacy(mid, a, b, "");
    if (migrated) {
      savePairLane(mid, a, b, migrated);
      return migrated;
    }
    return null;
  }

  function ensurePairLane(maskId, viewOwnerCharId, peerCharId, peerName) {
    const existing = getPairLane(maskId, viewOwnerCharId, peerCharId);
    if (existing) return existing;
    const mid = String(maskId || "").trim();
    const oid = String(viewOwnerCharId || "").trim();
    const pid = String(peerCharId || "").trim();
    if (!mid || !oid || !pid) return null;
    const [idLow, idHigh] = sortedPairIds(oid, pid);
    const lane = {
      charA: idLow,
      charB: idHigh,
      peerCharId: pid,
      peerName: String(peerName || "").trim() || charDisplayName(charById(pid)),
      messages: [],
      summaryRolled: "",
      summaryChunks: [],
      anchorOwnerCharId: oid,
      updatedAt: Date.now()
    };
    savePairLane(mid, oid, pid, lane);
    return lane;
  }

  /**
   * 关系网私聊生成用：该 char 与 user 的密谈记忆摘要 + 最近气泡节选（与群聊关联私聊 bridge 同源）。
   * @param {string} charId
   * @param {string} maskId
   * @param {string} [charNameHint]
   */
  function buildRelationDmMitalkRefBlock(charId, maskId, charNameHint) {
    const mid = String(maskId || "").trim();
    const cid = String(charId || "").trim();
    if (!mid || !cid) return "";
    const listFn = typeof window.listDmThreadsForChar === "function" ? window.listDmThreadsForChar : null;
    if (!listFn) return "";
    const dm = listFn(mid, cid)[0];
    if (!dm) return "";
    const charNm =
      String(charNameHint || "").trim() || charDisplayName(charById(cid)) || "角色";
    const userName = readActiveMask().displayName;
    const dmId = String(dm.id || "").trim();
    /** @type {string[]} */
    const parts = [];

    const memFn =
      typeof window.buildCharThreadMemoryTimelineForPrompt === "function"
        ? window.buildCharThreadMemoryTimelineForPrompt
        : null;
    if (memFn) {
      const memRaw = String(memFn(dm) || "").trim();
      if (memRaw) {
        parts.push(
          memRaw.replace(
            "[本密谈 · 记忆摘要时间线]",
            `[${charNm} · 与 ${userName} 密谈 · 记忆摘要（只读）]`
          )
        );
      }
    }

    const recentFn =
      typeof window.formatLinkedDmRecentMessagesForPrompt === "function"
        ? window.formatLinkedDmRecentMessagesForPrompt
        : null;
    const logFn = typeof readChatLogForMaskThread === "function" ? readChatLogForMaskThread : null;
    const maskFn = typeof readUserMask === "function" ? readUserMask : null;
    if (recentFn && logFn && maskFn && dmId) {
      const log = logFn(mid, dmId);
      const mask = maskFn();
      const recent = recentFn(log, dm, cid, mask, RELATION_MITALK_RECENT_CAP);
      if (recent) {
        parts.push(
          `[${charNm} · 与 ${userName} 密谈 · 最近消息（节选 · 只读）]\n${recent}\n（标签 [P|…] 表密谈气泡；生成关系网私聊时只可引用已有事实，勿向对话对象泄露其不该知道的密谈细节。）`
        );
      }
    }

    if (!parts.length) return "";
    return parts.join("\n\n").slice(0, RELATION_MITALK_REF_MAX);
  }

  function formatMsgTimeShort(at) {
    const t = Number(at || 0);
    if (!t) return "";
    return new Date(t).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  /** 注入 AI 用：带每条时间，避免把旧对白当「刚才」 */
  function formatRecentMessagesForInject(msgs, viewOwnerCharId, viewPeerCharId, userName, lane) {
    const ownerName = charDisplayName(charById(viewOwnerCharId));
    const peerName = resolvePeerDisplayName(viewPeerCharId, lane);
    return msgs
      .slice(-RECENT_INJECT)
      .map((m) => {
        const side = messageSideForView(m, viewOwnerCharId, viewPeerCharId, lane);
        const who = side === "peer" ? peerName : side === "user" ? userName : ownerName;
        const rawText = String(m.text || "").trim();
        const text = relationFormatMsgDisplayText(rawText, m.translation);
        const ts = formatMsgTimeShort(m.at);
        return ts ? `[${ts}] ${who}：${text}` : `${who}：${text}`;
      })
      .join("\n");
  }

  function buildSummaryInject(lane, viewOwnerCharId, viewPeerCharId) {
    const parts = [];
    const rolled = String(lane.summaryRolled || "").trim();
    if (rolled) {
      parts.push(`（历史合并摘要 · 较早私聊 · 勿当作刚发生）\n${rolled.slice(0, SUMMARY_EACH)}`);
    }
    const chunks = Array.isArray(lane.summaryChunks) ? lane.summaryChunks : [];
    for (const c of chunks.slice(-3)) {
      const t = String(c?.text || "").trim();
      if (t) {
        parts.push(
          `— 摘要 · ${new Date(c.at || 0).toLocaleString("zh-CN")} —\n${t.slice(0, SUMMARY_EACH)}`
        );
      }
    }
    const msgs = Array.isArray(lane.messages) ? lane.messages : [];
    if (msgs.length) {
      const lastActive = lane.updatedAt
        ? new Date(lane.updatedAt).toLocaleString("zh-CN")
        : "未知";
      parts.push(
        `（保留原文 · 该线最后活跃 ${lastActive} · 下列方括号内为各条时间，勿统称「刚才/刚聊」）\n${formatRecentMessagesForInject(
          msgs,
          viewOwnerCharId,
          viewPeerCharId,
          readActiveMask().displayName,
          lane
        )}`
      );
    }
    return parts.join("\n\n").slice(0, 3200);
  }

  function buildRelationCharDmPromptBlock(maskId, ownerCharId) {
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    if (!mid || !oid) return "";
    const owner = charById(oid);
    const ownerName = charDisplayName(owner);
    const lines = [`【${ownerName} · 关系网互动 · 供语气参考 · 勿主动翻旧账】`];
    const listFn =
      typeof window.relationListOwnerNetworkPeers === "function"
        ? window.relationListOwnerNetworkPeers
        : typeof window.relationListOwnerLinkedCharPeers === "function"
          ? window.relationListOwnerLinkedCharPeers
          : null;
    const peers = listFn ? listFn(mid, oid) : [];
    let added = 0;
    for (const peer of peers) {
      const peerCharId = String(peer?.charId || "").trim();
      const peerName = String(peer?.name || "").trim();
      let lane = null;
      if (peerCharId) {
        lane = getPairLane(mid, oid, peerCharId);
      } else if (peerName) {
        const pk = peerKey("", peerName);
        lane = pk ? getLane(mid, oid, pk) : null;
      }
      if (!lane) continue;
      const peerLabel =
        peerName ||
        (peerCharId ? charDisplayName(charById(peerCharId)) : "") ||
        String(lane.peerName || "").trim() ||
        "对方";
      const block = buildSummaryInject(lane, oid, peerCharId);
      if (!block) continue;
      lines.push(`· 与 ${peerLabel}\n${block}`);
      added++;
      if (added >= 6) break;
    }
    if (added === 0) return "";
    lines.push(
      "除非 user 问起或当下自然相关，不要主动复述几天前私聊细节；与当前密谈气泡矛盾时以气泡为准。",
      "关系网互动里提到 user 时，不得编造密谈未发生过的事；只能依据密谈气泡与记忆摘要里已有内容。",
      "注入里带日期的保留原文：若日期距现在较远，视为历史往来，勿当作刚发生。"
    );
    return lines.join("\n\n").slice(0, 4500);
  }

  async function requestSummary(lane, viewOwnerCharId, viewPeerCharId, userName, maskId) {
    const ai = window.RP_AI;
    if (!ai?.chatCompletions) return "";
    const { rollAt } = getSummarySettings(maskId);
    const body = formatRecentMessagesForInject(
      (Array.isArray(lane.messages) ? lane.messages : []).slice(-rollAt),
      viewOwnerCharId,
      viewPeerCharId,
      userName,
      lane
    );
    if (!body) return "";
    const sys = [
      "你是中文剧情摘要员。将以下角色私聊对白整理为一条短摘要（不超过 400 字），自然段表述：关键事实与情绪走向。",
      `称呼用户时用「${userName}」，不要使用「主控」一词。`,
      "不要编造；只归纳片段里**实际出现**的对白与事实，不得追加密谈或私聊里未写过的具体事件。",
      "不要 markdown；不要条列小标题。"
    ].join("\n");
    try {
      const completionConfig =
        typeof ai.getMemoSummaryCompletionConfig === "function"
          ? ai.getMemoSummaryCompletionConfig()
          : null;
      const fetchOpts = completionConfig ? { completionConfig } : undefined;
      const data = await ai.chatCompletions(
        {
          messages: [
            { role: "system", content: sys },
            { role: "user", content: `角色私聊片段：\n${body}` }
          ],
          temperature: 0.35
        },
        fetchOpts
      );
      const text =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        "";
      return String(text || "").trim().slice(0, SUMMARY_EACH);
    } catch (e) {
      console.warn("[relation-dm] summary failed", e);
      return "";
    }
  }

  async function maybeRollSummary(maskId, ownerCharId, peerCharId, lane) {
    const msgs = Array.isArray(lane.messages) ? lane.messages : [];
    const { rollAt, keepAfterRoll } = getSummarySettings(maskId);
    if (msgs.length < rollAt) return lane;
    const userName = readActiveMask().displayName;
    const chunkText = await requestSummary(lane, ownerCharId, peerCharId, userName, maskId);
    if (!chunkText) return lane;
    if (!Array.isArray(lane.summaryChunks)) lane.summaryChunks = [];
    lane.summaryChunks.push({ id: uid(), at: Date.now(), text: chunkText });
    if (lane.summaryChunks.length > 8) {
      const merged = lane.summaryChunks
        .slice(0, -2)
        .map((c) => String(c.text || "").trim())
        .filter(Boolean)
        .join("\n");
      lane.summaryRolled = `${String(lane.summaryRolled || "").trim()}\n${merged}`.trim().slice(0, 2000);
      lane.summaryChunks = lane.summaryChunks.slice(-2);
    }
    lane.messages = msgs.slice(-keepAfterRoll);
    savePairLane(maskId, ownerCharId, peerCharId, lane);
    return lane;
  }

  function parseTurnJson(raw) {
    let text = String(raw || "").trim();
    if (!text) return { lines: [] };
    text = text.replace(/^```json?\s*/i, "").replace(/```$/g, "").trim();
    try {
      const o = JSON.parse(text);
      const lines = Array.isArray(o?.lines) ? o.lines : [];
      return {
        lines: lines
          .map((x) => {
            const row = {
              who: x?.who === "peer" ? "peer" : "owner",
              text: String(x?.text || "").trim().slice(0, MSG_MAX)
            };
            const tr = String(x?.translation || "").trim();
            if (tr) row.translation = tr.slice(0, MSG_MAX * 2);
            return row;
          })
          .filter((x) => x.text)
      };
    } catch {
      return { lines: [{ who: "owner", text: text.slice(0, MSG_MAX) }] };
    }
  }

  /**
   * @param {{ maskId: string, ownerCharId: string, peerCharId: string, peerName: string, lane: object }} opts
   */
  async function requestTurn(opts) {
    const ai = window.RP_AI;
    if (!ai?.chatCompletions) throw new Error("AI 未加载");
    const { maskId, ownerCharId, peerCharId, peerName, lane } = opts;
    const owner = charById(ownerCharId);
    const peer = charById(peerCharId);
    const ownerName = charDisplayName(owner);
    const peerNameFinal = peerName || charDisplayName(peer);
    const userName = readActiveMask().displayName;
    const memOwner = buildRelationDmMitalkRefBlock(ownerCharId, maskId, ownerName);
    const memPeer = buildRelationDmMitalkRefBlock(peerCharId, maskId, peerNameFinal);
    const ownerWb = charWorldBookBlock(owner, userName);
    const peerWb = charWorldBookBlock(peer, userName);
    const ownerRelLine = relationViewLine(maskId, ownerCharId, peerCharId, ownerName, peerNameFinal);
    const peerRelLine = relationViewLine(maskId, peerCharId, ownerCharId, peerNameFinal, ownerName);
    const ownerPersona = personaSnippet(owner);
    const peerPersona = personaSnippet(peer);
    const hist = buildSummaryInject(lane, ownerCharId, peerCharId);
    const sys = [
      `你在生成「${ownerName}」与「${peerNameFinal}」之间的私下聊天记录（不是与 ${userName} 的密谈）。`,
      [
        `输出 JSON：{"lines":[{"who":"owner"|"peer","text":"…","translation":"可选·中文读本"}, …]}。`,
        `这是**一整段**私聊，建议 ${SEGMENT_LINES_MIN}～${SEGMENT_LINES_MAX} 条，宁可多写也不要只写几句就停。`,
        "像微信私聊：有话题切入、情绪起伏、自然收束；前后句要接得上。",
        "同一人可**连发多条**（不必一人一句严格交替）；但 owner 与 peer 都要有戏份。",
        "单条可稍长（一两句口语）。"
      ].join("\n"),
      `${userName} 不在场；不要写 who 为 user 的行。`,
      "按她们私下会聊的深度写满一整段，不要写成试探性短聊或敷衍几句。",
      "**严禁 OOC**：每条必须是该角色当下会说的人话；禁止作者旁白、禁止解释设定、禁止 meta、禁止破第四墙。",
      "语气、用词、认知范围必须符合各自人设、说话方式与边界；不要假懂、不要网络梗除非人设会用。",
      "禁止在对话里出现「角色」「人设」「prompt」「OOC」「AI」等创作层词汇。",
      `摘要与称呼：提到用户时用「${userName}」，不要用「主控」。`,
      memOwner || memPeer ? mitalkFactGuardLine(userName) : `若聊到 ${userName}，勿编造密谈未发生过的具体剧情；无密谈参考注入则勿断言 ${userName} 的密谈细节。`,
      memOwner
        ? `【${ownerName} · 密谈参考 · 勿泄露给 ${peerNameFinal} 不该知道的部分 · 仅作事实边界】\n${memOwner}`
        : "",
      memPeer
        ? `【${peerNameFinal} · 密谈参考 · 勿泄露给 ${ownerName} 不该知道的部分 · 仅作事实边界】\n${memPeer}`
        : "",
      ownerRelLine,
      peerRelLine,
      ownerPersona ? `【${ownerName} 人设】\n${ownerPersona}` : "",
      peerPersona ? `【${peerNameFinal} 人设】\n${peerPersona}` : "",
      ownerWb ? `【${ownerName} · 世界设定参考】\n${ownerWb.slice(0, 2400)}` : "",
      peerWb ? `【${peerNameFinal} · 世界设定参考】\n${peerWb.slice(0, 2400)}` : "",
      ...relationTranslationPromptLines(owner, peer),
      hist ? `【已有私聊上下文】\n${hist}` : "",
      "不要输出 markdown 围栏；不要旁白键。"
    ]
      .filter(Boolean)
      .join("\n\n");
    const userContent = `请生成她们私下聊的完整一段 JSON：${SEGMENT_LINES_MIN} 条以上；同一人可连发多条；两人都有戏份；全程 in-character、严禁 OOC；话题连贯、有收束。若提到 ${userName} 的密谈，只能使用上文记忆参考里已有的事实，禁止编造密谈未发生的事。`;
    const data = await relationDmChatCompletions({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userContent }
      ],
      temperature: 0.9,
      max_tokens: 4096
    });
    const raw =
      data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
    return parseTurnJson(raw);
  }

  function appendLines(lane, lines, ownerCharId, peerCharId) {
    if (!Array.isArray(lane.messages)) lane.messages = [];
    lane.anchorOwnerCharId = String(ownerCharId || lane.anchorOwnerCharId || "").trim();
    lane.peerCharId = String(peerCharId || lane.peerCharId || "").trim();
    const now = Date.now();
    const hadMsgs = lane.messages.length > 0;
    let firstInBatch = true;
    for (const ln of lines) {
      if (ln.who === "user") continue;
      const msg = {
        id: uid(),
        who: ln.who === "peer" ? "peer" : "owner",
        speakerCharId: ln.who === "peer" ? peerCharId : ownerCharId,
        text: ln.text,
        at: now
      };
      const tr = String(ln.translation || "").trim();
      if (tr) msg.translation = tr.slice(0, MSG_MAX * 2);
      if (hadMsgs && firstInBatch) {
        msg.segmentStart = true;
        firstInBatch = false;
      }
      lane.messages.push(msg);
    }
    return lane;
  }

  function appendSegmentDivider(parent) {
    const row = document.createElement("div");
    row.className = "relation-interact-segment-divider";
    row.setAttribute("role", "separator");
    row.setAttribute("aria-label", "新记录");
    const lineA = document.createElement("span");
    lineA.className = "relation-interact-segment-divider-line";
    lineA.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "relation-interact-segment-divider-label";
    label.textContent = "新记录";
    const lineB = document.createElement("span");
    lineB.className = "relation-interact-segment-divider-line";
    lineB.setAttribute("aria-hidden", "true");
    row.append(lineA, label, lineB);
    parent.appendChild(row);
  }

  function renderTranscript(lane, viewOwnerCharId, viewPeerCharId) {
    if (!interactTranscript) return;
    interactTranscript.replaceChildren();
    const userName = readActiveMask().displayName;
    const ownerName = charDisplayName(charById(viewOwnerCharId));
    const peerName = resolvePeerDisplayName(viewPeerCharId, lane);
    const msgs = Array.isArray(lane?.messages) ? lane.messages : [];
    if (!msgs.length) {
      const em = document.createElement("p");
      em.className = "relation-interact-empty";
      em.textContent = "还没有对话 · 开启关系网后台互动后会自动生成；也可点「生成一段」";
      interactTranscript.appendChild(em);
      return;
    }
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m && m.segmentStart && i > 0) appendSegmentDivider(interactTranscript);
      const side = messageSideForView(m, viewOwnerCharId, viewPeerCharId, lane);
      const row = document.createElement("div");
      row.className = `relation-interact-msg relation-interact-msg--${side}`;
      const name = document.createElement("span");
      name.className = "relation-interact-msg-name";
      name.textContent =
        side === "peer" ? peerName : side === "user" ? userName : ownerName;
      const bubble = document.createElement("div");
      bubble.className = "relation-interact-msg-bubble";
      bubble.textContent = relationFormatMsgDisplayText(m.text, m.translation);
      row.append(name, bubble);
      interactTranscript.appendChild(row);
    }
    interactTranscript.scrollTop = interactTranscript.scrollHeight;
  }

  function clearCurrentLane() {
    if (!session || busy) return;
    const maskId = getActiveMaskId();
    const { ownerCharId, peerCharId, peerName, isNpc } = session;
    let lane = null;
    if (isNpc) {
      const pk = peerKey("", peerName);
      lane = pk ? getLane(maskId, ownerCharId, pk) : null;
    } else {
      lane = getPairLane(maskId, ownerCharId, peerCharId);
    }
    const msgs = Array.isArray(lane?.messages) ? lane.messages : [];
    if (!lane || !msgs.length) {
      toast("暂无聊天记录");
      return;
    }
    if (
      !window.confirm(
        "清空与对方的全部私聊记录？\n\n摘要记忆也会一并清除，此操作不可恢复。"
      )
    ) {
      return;
    }
    lane.messages = [];
    lane.summaryRolled = "";
    lane.summaryChunks = [];
    if (isNpc) {
      const pk = peerKey("", peerName);
      saveOwnerLane(maskId, ownerCharId, pk, lane);
      renderTranscript(lane, ownerCharId, "");
    } else {
      savePairLane(maskId, ownerCharId, peerCharId, lane);
      renderTranscript(lane, ownerCharId, peerCharId);
    }
    toast("已清空聊天记录");
  }

  function syncInteractChromeBusy() {
    if (interactContinueBtn) interactContinueBtn.disabled = busy;
    if (interactClearBtn) interactClearBtn.disabled = busy;
  }

  async function runTurn() {
    if (!session || busy) return;
    const ai = window.RP_AI;
    if (!ai?.chatCompletions) {
      toast("AI 未加载");
      return;
    }
    busy = true;
    syncInteractChromeBusy();
    try {
      const maskId = getActiveMaskId();
      const { ownerCharId, peerCharId, peerName, isNpc } = session;
      if (isNpc) {
        const npcName = String(peerName || "").trim();
        if (!npcName) return;
        let lane = ensureOwnerNpcLane(maskId, ownerCharId, npcName);
        if (!lane) return;
        const parsed = await requestNpcTurn({
          maskId,
          ownerCharId,
          npcName,
          lane
        });
        lane = appendNpcLines(lane, parsed.lines, ownerCharId, npcName);
        const pk = peerKey("", npcName);
        saveOwnerLane(maskId, ownerCharId, pk, lane);
        lane = await maybeRollNpcSummary(maskId, ownerCharId, npcName, lane);
        renderTranscript(lane, ownerCharId, "");
        return;
      }
      let lane = ensurePairLane(maskId, ownerCharId, peerCharId, peerName);
      if (!lane) return;
      const parsed = await requestTurn({
        maskId,
        ownerCharId,
        peerCharId,
        peerName,
        lane
      });
      lane = appendLines(lane, parsed.lines, ownerCharId, peerCharId);
      savePairLane(maskId, ownerCharId, peerCharId, lane);
      lane = await maybeRollSummary(maskId, ownerCharId, peerCharId, lane);
      renderTranscript(lane, ownerCharId, peerCharId);
    } catch (e) {
      console.warn("[relation-dm] turn failed", e);
      toast("生成失败");
    } finally {
      busy = false;
      syncInteractChromeBusy();
    }
  }

  function openInteract(opts) {
    const ownerCharId = String(opts?.ownerCharId || "").trim();
    const peerCharId = String(opts?.peerCharId || "").trim();
    const peerName = String(opts?.peerName || "").trim();
    const isNpc = Boolean(opts?.isNpc) || (!peerCharId && Boolean(peerName));
    if (!ownerCharId) return;
    if (!peerCharId && !peerName) {
      toast("缺少对方信息");
      return;
    }
    if (!isNpc && !peerCharId) {
      toast("需要关联角色档案才能私聊");
      return;
    }
    session = {
      ownerCharId,
      peerCharId: isNpc ? "" : peerCharId,
      peerName: isNpc ? peerName : peerName || charDisplayName(charById(peerCharId)),
      isNpc
    };
    const ownerName = charDisplayName(charById(ownerCharId));
    const maskId = getActiveMaskId();
    const lane = isNpc
      ? ensureOwnerNpcLane(maskId, ownerCharId, session.peerName)
      : ensurePairLane(maskId, ownerCharId, peerCharId, session.peerName);
    if (interactHead) interactHead.textContent = `${ownerName} · ${session.peerName}`;
    renderTranscript(lane || { messages: [], peerName: session.peerName }, ownerCharId, isNpc ? "" : peerCharId);
    if (typeof window.relationShowView === "function") window.relationShowView("interact");
  }

  function closeInteract() {
    const ownerCharId = session?.ownerCharId || "";
    session = null;
    if (typeof window.relationNavigateAfterInteractClose === "function") {
      window.relationNavigateAfterInteractClose(ownerCharId);
    } else if (typeof window.relationShowView === "function") {
      window.relationShowView("graph");
    } else if (viewInteract) {
      viewInteract.hidden = true;
    }
  }

  async function maybeRollNpcSummary(maskId, ownerCharId, npcName, lane) {
    const msgs = Array.isArray(lane.messages) ? lane.messages : [];
    const { rollAt, keepAfterRoll } = getSummarySettings(maskId);
    if (msgs.length < rollAt) return lane;
    const userName = readActiveMask().displayName;
    const chunkText = await requestSummary(lane, ownerCharId, "", userName, maskId);
    if (!chunkText) return lane;
    if (!Array.isArray(lane.summaryChunks)) lane.summaryChunks = [];
    lane.summaryChunks.push({ id: uid(), at: Date.now(), text: chunkText });
    if (lane.summaryChunks.length > 8) {
      const merged = lane.summaryChunks
        .slice(0, -2)
        .map((c) => String(c.text || "").trim())
        .filter(Boolean)
        .join("\n");
      lane.summaryRolled = `${String(lane.summaryRolled || "").trim()}\n${merged}`.trim().slice(0, 2000);
      lane.summaryChunks = lane.summaryChunks.slice(-2);
    }
    lane.messages = msgs.slice(-keepAfterRoll);
    const pk = peerKey("", npcName);
    saveOwnerLane(maskId, ownerCharId, pk, lane);
    return lane;
  }

  function relationNpcViewLine(maskId, ownerCharId, npcName) {
    const fn = window.relationGetLinkEntryForNpc;
    if (typeof fn !== "function") return "";
    const entry = fn(maskId, ownerCharId, npcName);
    if (!entry?.rel) return "";
    const tail = entry.detail ? ` · ${entry.detail.slice(0, 160)}` : "";
    return `【与 ${npcName} 的关系】${entry.rel}${tail}`;
  }

  /**
   * @param {{ maskId: string, ownerCharId: string, npcName: string, lane: object }} opts
   */
  async function requestNpcTurn(opts) {
    const ai = window.RP_AI;
    if (!ai?.chatCompletions) throw new Error("AI 未加载");
    const { maskId, ownerCharId, npcName, lane } = opts;
    const owner = charById(ownerCharId);
    const ownerName = charDisplayName(owner);
    const npcNameFinal = String(npcName || "").trim();
    const userName = readActiveMask().displayName;
    const memOwner = buildRelationDmMitalkRefBlock(ownerCharId, maskId, ownerName);
    const ownerWb = charWorldBookBlock(owner, userName);
    const ownerPersona = personaSnippet(owner);
    const relLine = relationNpcViewLine(maskId, ownerCharId, npcNameFinal);
    const hist = buildSummaryInject(lane, ownerCharId, "");
    const sys = [
      `你在生成「${ownerName}」与「${npcNameFinal}」之间的私下往来记录（${npcNameFinal} 无独立 char 档案，按关系网设定与其互动；不是与 ${userName} 的密谈）。`,
      [
        `输出 JSON：{"lines":[{"who":"owner"|"peer","text":"…","translation":"可选·中文读本"}, …]}。`,
        `peer 表示 ${npcNameFinal} 的对白或动作描写；owner 表示 ${ownerName}。`,
        `建议 ${SEGMENT_LINES_MIN}～${SEGMENT_LINES_MAX} 条，像微信或当面交谈，有起承转合。`
      ].join("\n"),
      `${userName} 不在场；不要写 who 为 user 的行。`,
      `**严禁 OOC**：${npcNameFinal} 的言行须符合关系设定与常识，勿编造密谈未发生的事。`,
      memOwner ? mitalkFactGuardLine(userName) : "",
      memOwner
        ? `【${ownerName} · 密谈参考 · 仅作事实边界 · 勿向 ${npcNameFinal} 泄露 ${userName} 不该被第三者知道的密谈细节】\n${memOwner}`
        : "",
      relLine,
      ownerPersona ? `【${ownerName} 人设】\n${ownerPersona}` : "",
      ownerWb ? `【${ownerName} · 世界设定参考】\n${ownerWb.slice(0, 2400)}` : "",
      ...relationTranslationPromptLines(owner, null, { npcOnly: true }),
      hist ? `【已有往来上下文】\n${hist}` : "",
      "不要输出 markdown 围栏；不要旁白键。"
    ]
      .filter(Boolean)
      .join("\n\n");
    const data = await relationDmChatCompletions({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `请生成 ${ownerName} 与 ${npcNameFinal} 的完整一段 JSON；全程 in-character。`
        }
      ],
      temperature: 0.9,
      max_tokens: 4096
    });
    const raw =
      data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
    return parseTurnJson(raw);
  }

  function appendNpcLines(lane, lines, ownerCharId, npcName) {
    if (!Array.isArray(lane.messages)) lane.messages = [];
    lane.peerName = String(npcName || lane.peerName || "").trim();
    lane.isNpc = true;
    const now = Date.now();
    const hadMsgs = lane.messages.length > 0;
    let firstInBatch = true;
    for (const ln of lines) {
      if (ln.who === "user") continue;
      const msg = {
        id: uid(),
        who: ln.who === "peer" ? "peer" : "owner",
        speakerCharId: ln.who === "peer" ? "" : ownerCharId,
        text: ln.text,
        at: now
      };
      const tr = String(ln.translation || "").trim();
      if (tr) msg.translation = tr.slice(0, MSG_MAX * 2);
      if (hadMsgs && firstInBatch) {
        msg.segmentStart = true;
        firstInBatch = false;
      }
      lane.messages.push(msg);
    }
    return lane;
  }

  function listNetworkPeersForOwner(maskId, ownerCharId) {
    const listFn =
      typeof window.relationListOwnerNetworkPeers === "function"
        ? window.relationListOwnerNetworkPeers
        : typeof window.relationListOwnerLinkedCharPeers === "function"
          ? window.relationListOwnerLinkedCharPeers
          : null;
    return listFn ? listFn(maskId, ownerCharId) : [];
  }

  async function requestProactiveDecision(maskId, ownerCharId, userChatSummary) {
    const ai = window.RP_AI;
    if (!ai?.chatCompletions) return { act: false };
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    const peers = listNetworkPeersForOwner(mid, oid);
    if (!peers.length) return { act: false };
    const owner = charById(oid);
    const ownerName = charDisplayName(owner);
    const userName = readActiveMask().displayName;
    const roster = peers
      .map((p) => {
        const cid = String(p?.charId || "").trim();
        if (cid) return `${p.name}（char · peerCharId: ${cid}）`;
        return `${p.name}（NPC · peerNpcName）`;
      })
      .join("；");
    const ownerPersona = personaSnippet(owner);
    const sys = [
      `你是「${ownerName}」。判断此刻是否会**主动**与关系网里某人往来（微信式私聊、电话、当面短谈等；不是找 ${userName} 密谈）。`,
      `宁少勿勤：须**人设 + 与 ${userName} 最近密谈剧情 + 关系网动机**三者同时成立才 act:true。`,
      "禁止为刷存在感硬聊；禁止 OOC。",
      ownerPersona ? `【${ownerName} 人设】\n${ownerPersona}` : "",
      userChatSummary
        ? `【与 ${userName} 最近密谈 · 据此判断】\n${userChatSummary}\n（只能依据上文已有内容判断。）`
        : `（暂无最近密谈摘要；默认 act:false。）`,
      `【关系网可互动对象】${roster}`,
      '输出 JSON：{"act":true|false,"peerType":"char"|"npc","peerCharId":"…","peerNpcName":"…"}。',
      "选 char 时 peerType=char 且填 peerCharId；选 NPC 时 peerType=npc 且填 peerNpcName。act 为 false 时可省略其余字段。"
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      const data = await relationDmChatCompletions({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: "此刻是否会主动与关系网某人互动？只输出 JSON。" }
        ],
        temperature: 0.35,
        max_tokens: 320
      });
      let text = String(
        data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || ""
      ).trim();
      text = text.replace(/^```json?\s*/i, "").replace(/```$/g, "").trim();
      const o = JSON.parse(text);
      const act = o?.act === true || o?.act === "true";
      if (!act) return { act: false };
      const peerType = String(o?.peerType || "").trim();
      if (peerType === "npc") {
        const peerNpcName = String(o?.peerNpcName || "").trim();
        if (
          !peerNpcName ||
          !peers.some((p) => !String(p?.charId || "").trim() && String(p?.name || "") === peerNpcName)
        ) {
          return { act: false };
        }
        return { act: true, peerType: "npc", peerNpcName };
      }
      const peerCharId = String(o?.peerCharId || "").trim();
      if (!peerCharId || !peers.some((p) => String(p?.charId || "") === peerCharId)) {
        return { act: false };
      }
      return { act: true, peerType: "char", peerCharId };
    } catch (e) {
      console.warn("[relation-dm] proactive decision failed", e);
      return { act: false };
    }
  }

  function resolveCanonicalNpcName(maskId, ownerCharId, nameHint) {
    const nk = String(nameHint || "").trim().toLowerCase();
    if (!nk) return "";
    const peers = listNetworkPeersForOwner(maskId, ownerCharId);
    const hit = peers.find(
      (p) => !String(p?.charId || "").trim() && String(p?.name || "").trim().toLowerCase() === nk
    );
    return hit ? String(hit.name || "").trim() : String(nameHint || "").trim();
  }

  function findNpcLaneByNameHint(maskId, ownerCharId, nameHint) {
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    const nk = String(nameHint || "").trim().toLowerCase();
    if (!mid || !oid || !nk) return null;
    const pk = peerKey("", nameHint);
    const direct = pk ? getLane(mid, oid, pk) : null;
    if (direct) {
      return {
        peerKey: pk,
        peerNpcName: resolveCanonicalNpcName(mid, oid, direct.peerName || nameHint),
        peerName: String(direct.peerName || nameHint || "").trim()
      };
    }
    const st = readStore();
    const bucket = st.byMask[mid]?.[oid];
    if (!bucket || typeof bucket !== "object") return null;
    for (const [key, lane] of Object.entries(bucket)) {
      if (!key.startsWith("n:") || !lane || typeof lane !== "object") continue;
      const ln = String(lane.peerName || key.slice(2) || "")
        .trim()
        .toLowerCase();
      if (ln !== nk && key.slice(2) !== nk) continue;
      const canonical = resolveCanonicalNpcName(mid, oid, lane.peerName || key.slice(2));
      return {
        peerKey: key,
        peerNpcName: canonical || String(lane.peerName || key.slice(2)).trim(),
        peerName: String(lane.peerName || canonical || key.slice(2)).trim()
      };
    }
    return null;
  }

  /**
   * 解析转发目标（含 NPC 名大小写、仅 peerName、已有 lane 但不在候选列表等）。
   * @param {string} maskId
   * @param {string} ownerCharId
   * @param {{ peerCharId?: string, peerNpcName?: string, peerKey?: string, peerName?: string }} partial
   */
  window.relationResolveForwardPeerSpec = function (maskId, ownerCharId, partial) {
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    const p = partial && typeof partial === "object" ? partial : {};
    let peerCharId = String(p.peerCharId || "").trim();
    let peerNpcName = String(p.peerNpcName || "").trim();
    let pkOut = String(p.peerKey || "").trim();
    let peerName = String(p.peerName || "").trim();
    if (peerName === "未命名角色") peerName = "";
    const norm = (s) => String(s || "").trim().toLowerCase();

    if (peerCharId && !pkOut) pkOut = `c:${peerCharId}`;
    if (peerNpcName && !pkOut) pkOut = `n:${peerNpcName.toLowerCase()}`;
    if (!peerCharId && pkOut.startsWith("c:")) peerCharId = pkOut.slice(2);
    if (!peerNpcName && pkOut.startsWith("n:")) {
      peerNpcName = peerName || pkOut.slice(2);
    }
    if (!peerCharId && !peerNpcName && peerName) {
      const listFn =
        typeof window.relationListOwnerNetworkPeers === "function"
          ? window.relationListOwnerNetworkPeers
          : null;
      const peers = listFn ? listFn(mid, oid) : [];
      const nk = norm(peerName);
      const charHit = peers.find((row) => {
        const cid = String(row?.charId || "").trim();
        if (!cid) return false;
        const dn = charDisplayName(charById(cid));
        return norm(dn) === nk || norm(row?.name) === nk;
      });
      if (charHit) {
        peerCharId = String(charHit.charId || "").trim();
        peerNpcName = "";
        pkOut = pkOut || `c:${peerCharId}`;
        peerName = peerName || String(charHit.name || "").trim() || charDisplayName(charById(peerCharId));
      } else {
        const npcHit = peers.find(
          (row) => !String(row?.charId || "").trim() && norm(row?.name) === nk
        );
        if (npcHit) {
          peerNpcName = String(npcHit.name || "").trim();
          pkOut = pkOut || peerKey("", peerNpcName);
          peerName = peerName || peerNpcName;
        }
      }
    }
    if (!peerCharId && (peerNpcName || peerName || (pkOut.startsWith("n:") && pkOut))) {
      const hint = peerNpcName || peerName || pkOut.slice(2);
      const laneHit = findNpcLaneByNameHint(mid, oid, hint);
      if (laneHit) {
        pkOut = laneHit.peerKey;
        peerNpcName = laneHit.peerNpcName;
        peerName = peerName || laneHit.peerName;
      } else if (!peerNpcName && hint) {
        peerNpcName = resolveCanonicalNpcName(mid, oid, hint) || hint;
        pkOut = pkOut || peerKey("", peerNpcName);
      }
    }
    if (peerNpcName) peerNpcName = resolveCanonicalNpcName(mid, oid, peerNpcName) || peerNpcName;
    if (!peerName && peerCharId) peerName = charDisplayName(charById(peerCharId));
    if (!peerName && peerNpcName) peerName = peerNpcName;
    if (!pkOut && peerCharId) pkOut = `c:${peerCharId}`;
    if (!pkOut && peerNpcName) pkOut = `n:${peerNpcName.toLowerCase()}`;
    return { peerCharId, peerNpcName, peerKey: pkOut, peerName };
  };

  async function runProactiveNpcSegment(maskId, ownerCharId, npcName, opts) {
    const skipBusy = opts && opts.skipBusyCheck === true;
    const npcNameFinal = resolveCanonicalNpcName(maskId, ownerCharId, npcName) || String(npcName || "").trim();
    const pk = peerKey("", npcNameFinal);
    if (!pk || (busy && !skipBusy)) return null;
    busy = true;
    syncInteractChromeBusy();
    let lane = ensureOwnerNpcLane(maskId, ownerCharId, npcNameFinal);
    if (!lane) {
      busy = false;
      syncInteractChromeBusy();
      return null;
    }
    try {
      const parsed = await requestNpcTurn({
        maskId,
        ownerCharId,
        npcName: npcNameFinal,
        lane
      });
      if (!parsed.lines.length) return null;
      lane = appendNpcLines(lane, parsed.lines, ownerCharId, npcNameFinal);
      saveOwnerLane(maskId, ownerCharId, pk, lane);
      lane = await maybeRollNpcSummary(maskId, ownerCharId, npcNameFinal, lane);
      const preview = parsed.lines.map((ln) => String(ln.text || "").trim()).filter(Boolean)[0] || "";
      return { preview: preview.slice(0, 96), kind: "npc" };
    } catch (e) {
      console.warn("[relation-dm] proactive npc segment failed", e);
      return null;
    } finally {
      busy = false;
      syncInteractChromeBusy();
    }
  }

  async function runProactiveSegmentScheduled(maskId, ownerCharId, opts) {
    if (busy) return null;
    const summary = String(opts?.userChatSummary || "").trim();
    const decision = await requestProactiveDecision(maskId, ownerCharId, summary);
    if (!decision.act) return null;
    const peers = listNetworkPeersForOwner(maskId, ownerCharId);
    if (decision.peerType === "npc" && decision.peerNpcName) {
      const peerNpcName = String(decision.peerNpcName || "").trim();
      const peer = peers.find((p) => !String(p?.charId || "").trim() && String(p?.name || "") === peerNpcName);
      const seg = await runProactiveNpcSegment(maskId, ownerCharId, peerNpcName);
      if (!seg) return null;
      const owner = charById(ownerCharId);
      return {
        ownerCharId,
        ownerName: charDisplayName(owner),
        peerCharId: "",
        peerName: peerNpcName,
        peerNpcName,
        kind: "npc",
        preview: String(seg.preview || "").trim()
      };
    }
    const peerCharId = String(decision.peerCharId || "").trim();
    if (!peerCharId) return null;
    const peer = peers.find((p) => String(p?.charId || "") === peerCharId);
    const peerName = String(peer?.name || "").trim();
    const seg = await runProactiveSegment(maskId, ownerCharId, peerCharId, peerName);
    if (!seg) return null;
    const owner = charById(ownerCharId);
    return {
      ownerCharId,
      ownerName: charDisplayName(owner),
      peerCharId,
      peerName: peerName || charDisplayName(charById(peerCharId)),
      kind: "char",
      preview: String(seg.preview || "").trim()
    };
  }

  const FORWARD_LANE_RECENT = 16;
  const FORWARD_PREP_MIN_MSGS = 2;

  function laneMessagesToForwardEntries(lane, ownerCharId, peerCharId, peerName) {
    const ownerName = charDisplayName(charById(ownerCharId));
    const peerDisplay = resolvePeerDisplayName(peerCharId, lane, peerName);
    const msgs = Array.isArray(lane?.messages) ? lane.messages : [];
    return msgs
      .filter((m) => m && m.who !== "user" && String(m.text || "").trim())
      .map((m) => {
        const side = messageSideForView(m, ownerCharId, peerCharId, lane);
        const name =
          side === "peer"
            ? peerDisplay
            : side === "user"
              ? readActiveMask().displayName
              : ownerName;
        return {
          name,
          text: relationFormatMsgDisplayText(String(m.text || "").trim(), m.translation).slice(0, 800)
        };
      });
  }

  function selectForwardEntriesFromLane(allEntries, excerptHint, max) {
    const cap = Math.max(1, Math.min(Number(max) || FORWARD_LANE_RECENT, FORWARD_LANE_RECENT));
    const hint = String(excerptHint || "").trim();
    if (!hint || !allEntries.length) return allEntries.slice(-cap);
    const hintTexts = hint
      .split(/\n+/)
      .map((line) => {
        const m = line.match(/^[^：:\n]+[：:]\s*(.+)$/);
        return (m ? m[1] : line).trim();
      })
      .filter((t) => t.length >= 2);
    if (!hintTexts.length) return allEntries.slice(-cap);
    const matched = [];
    for (const entry of allEntries) {
      const text = String(entry.text || "").trim();
      if (!text) continue;
      if (hintTexts.some((h) => text.includes(h) || h.includes(text.slice(0, Math.min(24, text.length))))) {
        matched.push(entry);
      }
    }
    return (matched.length ? matched : allEntries).slice(-cap);
  }

  /** 密谈转发前：对指定对象补生成一段关系网私聊（不经过主动调度决策）。 */
  async function runForwardPrepSegment(maskId, ownerCharId, spec) {
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    if (!mid || !oid || !spec) return null;
    const prepOpts = { skipBusyCheck: true };
    const resolved =
      typeof window.relationResolveForwardPeerSpec === "function"
        ? window.relationResolveForwardPeerSpec(mid, oid, spec)
        : spec;
    const peerCharId = String(resolved?.peerCharId || "").trim();
    const peerNpcName = String(resolved?.peerNpcName || "").trim();
    const peerName = String(resolved?.peerName || "").trim();
    if (peerCharId) {
      return runProactiveSegment(mid, oid, peerCharId, peerName, prepOpts);
    }
    if (peerNpcName || (resolved?.peerKey || "").startsWith("n:")) {
      const npcHint = peerNpcName || peerName || String(resolved?.peerKey || "").slice(2);
      return runProactiveNpcSegment(mid, oid, npcHint, prepOpts);
    }
    return null;
  }

  async function runProactiveSegment(maskId, ownerCharId, peerCharId, peerName, opts) {
    const skipBusy = opts && opts.skipBusyCheck === true;
    if (!pairStoreKey(ownerCharId, peerCharId) || (busy && !skipBusy)) return null;
    busy = true;
    syncInteractChromeBusy();
    let lane = ensurePairLane(maskId, ownerCharId, peerCharId, peerName);
    if (!lane) {
      busy = false;
      syncInteractChromeBusy();
      return null;
    }
    const peerNameFinal = peerName || charDisplayName(charById(peerCharId));
    try {
      const parsed = await requestTurn({
        maskId,
        ownerCharId,
        peerCharId,
        peerName: peerNameFinal,
        lane
      });
      if (!parsed.lines.length) return null;
      lane = appendLines(lane, parsed.lines, ownerCharId, peerCharId);
      savePairLane(maskId, ownerCharId, peerCharId, lane);
      lane = await maybeRollSummary(maskId, ownerCharId, peerCharId, lane);
      if (
        session &&
        ((session.ownerCharId === ownerCharId && session.peerCharId === peerCharId) ||
          (session.ownerCharId === peerCharId && session.peerCharId === ownerCharId))
      ) {
        renderTranscript(lane, session.ownerCharId, session.peerCharId);
      }
      const preview = parsed.lines.map((ln) => String(ln.text || "").trim()).filter(Boolean)[0] || "";
      return { preview: preview.slice(0, 96) };
    } catch (e) {
      console.warn("[relation-dm] proactive segment failed", e);
      return null;
    } finally {
      busy = false;
      syncInteractChromeBusy();
    }
  }

  document.getElementById("relation-interact-back")?.addEventListener("click", closeInteract);
  interactContinueBtn?.addEventListener("click", () => void runTurn());
  interactClearBtn?.addEventListener("click", () => clearCurrentLane());

  window.buildRelationCharDmPromptBlock = buildRelationCharDmPromptBlock;
  window.relationInteractOpen = openInteract;
  window.relationInteractClose = closeInteract;
  window.relationGetCharDmSummarySettings = getSummarySettings;
  window.relationSetCharDmSummarySettings = setSummarySettings;
  window.relationRunProactiveSegment = runProactiveSegment;
  window.relationRunProactiveSegmentScheduled = runProactiveSegmentScheduled;
  window.relationGetCharDmLastActiveMsForOwner = function (maskId, ownerCharId) {
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    if (!mid || !oid) return 0;
    let max = 0;
    const peers = listNetworkPeersForOwner(mid, oid);
    for (const peer of peers) {
      const peerCharId = String(peer?.charId || "").trim();
      if (peerCharId) {
        const lane = getPairLane(mid, oid, peerCharId);
        const t = Number(lane?.updatedAt || 0);
        if (t > max) max = t;
      } else {
        const pk = peerKey("", peer.name);
        const lane = pk ? getLane(mid, oid, pk) : null;
        const t = Number(lane?.updatedAt || 0);
        if (t > max) max = t;
      }
    }
    return max;
  };
  window.relationRunForwardPrepSegment = runForwardPrepSegment;
  window.relationBuildForwardEntriesFromLane = function (maskId, ownerCharId, spec, opts) {
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    const peerKey = String(spec?.peerKey || "").trim();
    if (!mid || !oid || !peerKey) return [];
    const lane = getRelationCharDmLanePublic(mid, oid, peerKey);
    if (!lane) return [];
    const peerCharId = String(spec?.peerCharId || "").trim();
    const peerName = String(spec?.peerName || "").trim();
    const all = laneMessagesToForwardEntries(lane, oid, peerCharId, peerName);
    const max = Number(opts?.maxEntries) || FORWARD_LANE_RECENT;
    const excerptHint = String(opts?.excerptHint || spec?.excerpt || "").trim();
    return selectForwardEntriesFromLane(all, excerptHint, max);
  };
  window.relationForwardPrepMinMsgs = function () {
    return FORWARD_PREP_MIN_MSGS;
  };

  function getRelationCharDmLanePublic(maskId, ownerCharId, peerKeyArg) {
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    const key = String(peerKeyArg || "").trim();
    if (!mid || !oid || !key) return null;
    if (key.startsWith("n:")) return getLane(mid, oid, key);
    let peerCharId = "";
    if (key.startsWith("c:")) peerCharId = key.slice(2);
    if (!peerCharId) {
      return getLane(mid, oid, key);
    }
    return getPairLane(mid, oid, peerCharId);
  }
  window.getRelationCharDmLanePublic = getRelationCharDmLanePublic;

  /** @returns {{ peerCharId: string, peerNpcName: string, peerName: string, peerKey: string, isNpc: boolean }[]} */
  window.listRelationCharDmForwardCandidates = function (maskId, ownerCharId) {
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    if (!mid || !oid) return [];
    const listFn =
      typeof window.relationListOwnerNetworkPeers === "function"
        ? window.relationListOwnerNetworkPeers
        : typeof window.relationListOwnerLinkedCharPeers === "function"
          ? window.relationListOwnerLinkedCharPeers
          : null;
    const peers = listFn ? listFn(mid, oid) : [];
    /** @type {{ peerCharId: string, peerNpcName: string, peerName: string, peerKey: string, isNpc: boolean }[]} */
    const out = [];
    for (const peer of peers) {
      const peerCharId = String(peer?.charId || "").trim();
      const peerName = String(peer?.name || "").trim();
      if (peerCharId) {
        const lane = getPairLane(mid, oid, peerCharId);
        if (!lane || !(Array.isArray(lane.messages) ? lane.messages : []).length) continue;
        out.push({
          peerCharId,
          peerNpcName: "",
          peerName: peerName || charDisplayName(charById(peerCharId)),
          peerKey: peerKey(peerCharId, peer.name),
          isNpc: false
        });
        continue;
      }
      if (!peerName) continue;
      const pk = peerKey("", peerName);
      const lane = pk ? getLane(mid, oid, pk) : null;
      if (!lane || !(Array.isArray(lane.messages) ? lane.messages : []).length) continue;
      out.push({
        peerCharId: "",
        peerNpcName: peerName,
        peerName,
        peerKey: pk,
        isNpc: true
      });
    }
    return out;
  };

})();
