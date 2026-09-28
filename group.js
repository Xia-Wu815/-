/**
 * 群聊模块：多人对话 + 群红包（单文件）。
 */
(function () {
  const MAX_MEMBERS = 8;
  const MIN_MEMBERS = 2;
  const MAX_REPLY_ITEMS = 10;
  const GROUP_ROUND_MAX_TOKENS = 3200;
  /** 群专属红包：发给主控时的 targetCharId 固定值 */
  const USER_TARGET = "__user__";
  const MIN_LUCKY_COUNT = 2;
  const MAX_LUCKY_COUNT = 20;
  const MAX_GROUP_NICKNAME_LEN = 20;

  function deps() {
    return Object.assign({}, window.__XXJ_GROUP_CHAT_DEPS || {}, window.__XXJ_GROUP_REDPACK_DEPS || {});
  }

  function dShowToast(msg) {
    const fn = deps().showToast;
    if (typeof fn === "function") fn(msg);
  }

  function readCharStore() {
    const fn = deps().readCharPersonaStore;
    return typeof fn === "function" ? fn() : { items: [] };
  }

  function charItemById(charId) {
    const id = String(charId || "").trim();
    if (!id) return null;
    const st = readCharStore();
    return (st.items || []).find((x) => String(x?.id || "") === id) || null;
  }

  function charDisplayName(charId) {
    const it = charItemById(charId);
    const n = it && String(it.displayName || "").trim();
    return n || "未命名";
  }

  function pickPersonaBody(it) {
    const fn = deps().pickCharPersonaBody;
    if (typeof fn === "function" && it) return fn(it);
    if (!it || typeof it !== "object") return {};
    return it;
  }

  function readActiveThread() {
    const fn = deps().readActiveThread;
    return typeof fn === "function" ? fn() : null;
  }

  function maskDisplayName() {
    const fn = deps().readUserMask;
    const m = typeof fn === "function" ? fn() : null;
    return (m && String(m.displayName || "").trim()) || "主控";
  }

  function isGroupThread(th) {
    const fn = deps().isChatThreadGroupForUi;
    if (typeof fn === "function") return fn(th);
    if (!th || typeof th !== "object") return false;
    if (th.kind === "group") return true;
    const members = Array.isArray(th.memberCharIds) ? th.memberCharIds : [];
    return members.map((x) => String(x || "").trim()).filter(Boolean).length >= 2;
  }

  function storedMemberCharIds(thread) {
    const raw = Array.isArray(thread?.memberCharIds) ? thread.memberCharIds : [];
    return [...new Set(raw.map((x) => String(x || "").trim()).filter(Boolean))].slice(0, MAX_MEMBERS);
  }

  /** 锚点 charId 须落在成员列表内，否则回退到首位成员 */
  function reconcileGroupAnchorCharId(thread, members) {
    if (!thread || typeof thread !== "object") return;
    const list = (Array.isArray(members) ? members : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    if (!list.length) return;
    const anchor = String(thread.charId || "").trim();
    if (!anchor || !list.includes(anchor)) thread.charId = list[0];
  }

  function memberCharIds(thread) {
    if (!isGroupThread(thread)) return [];
    const list = storedMemberCharIds(thread);
    const primary = String(thread.charId || "").trim();
    if (primary && !list.includes(primary)) list.unshift(primary);
    if (!list.length && primary) list.push(primary);
    return [...new Set(list)].slice(0, MAX_MEMBERS);
  }

  function readGroupNicknamesMap(thread) {
    const raw = thread?.groupNicknames;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return Object.create(null);
    return raw;
  }

  function normalizeGroupNicknameText(s) {
    return String(s ?? "").trim().slice(0, MAX_GROUP_NICKNAME_LEN);
  }

  function groupArchiveNameForRef(ref) {
    const key = String(ref || "").trim();
    if (!key || key === USER_TARGET) return maskDisplayName();
    return charDisplayName(key);
  }

  /** 本群昵称；未设返回空字符串 */
  function groupNicknameForRef(thread, ref) {
    const key = String(ref || "").trim();
    if (!key) return "";
    return normalizeGroupNicknameText(readGroupNicknamesMap(thread)[key]);
  }

  /** 模型/互称用：群昵称优先，否则面具名/档案名 */
  function groupCallNameForRef(thread, ref) {
    return groupNicknameForRef(thread, ref) || groupArchiveNameForRef(ref);
  }

  function rosterLineForRef(thread, ref) {
    const key = String(ref || "").trim();
    const archive = groupArchiveNameForRef(key);
    const nick = groupNicknameForRef(thread, key);
    if (key === USER_TARGET) {
      return nick
        ? `主控（群昵称「${nick}」，面具名「${archive}」）→ ${USER_TARGET}`
        : `主控（面具名「${archive}」）→ ${USER_TARGET}`;
    }
    return nick
      ? `${archive}（群昵称「${nick}」）→ charId: ${key}`
      : `${archive} → charId: ${key}`;
  }

  function pruneGroupNicknames(thread) {
    if (!thread || typeof thread !== "object") return;
    const map = readGroupNicknamesMap(thread);
    const members = new Set(memberCharIds(thread));
    const next = Object.create(null);
    let changed = false;
    for (const [k, v] of Object.entries(map)) {
      const key = String(k || "").trim();
      const nick = normalizeGroupNicknameText(v);
      if (!key || !nick) {
        changed = true;
        continue;
      }
      if (key === USER_TARGET) {
        next[key] = nick;
        continue;
      }
      if (!members.has(key)) {
        changed = true;
        continue;
      }
      next[key] = nick;
    }
    if (!Object.keys(next).length) {
      if (thread.groupNicknames) {
        delete thread.groupNicknames;
        changed = true;
      }
    } else if (changed || !thread.groupNicknames) {
      thread.groupNicknames = next;
    }
  }

  function setGroupNicknameOnThread(thread, ref, rawNick) {
    const key = String(ref || "").trim();
    if (!key) return false;
    const nick = normalizeGroupNicknameText(rawNick);
    if (!thread.groupNicknames || typeof thread.groupNicknames !== "object" || Array.isArray(thread.groupNicknames)) {
      thread.groupNicknames = Object.create(null);
    }
    if (!nick) {
      if (!(key in thread.groupNicknames)) return false;
      delete thread.groupNicknames[key];
      pruneGroupNicknames(thread);
      return true;
    }
    if (thread.groupNicknames[key] === nick) return false;
    thread.groupNicknames[key] = nick;
    return true;
  }

  function normalizeGroupThread(thread) {
    if (!isGroupThread(thread)) return thread;
    reconcileGroupAnchorCharId(thread, storedMemberCharIds(thread));
    const members = memberCharIds(thread);
    if (!members.length) return thread;
    thread.memberCharIds = members;
    pruneGroupNicknames(thread);
    pruneMemberDmThreadIds(thread);
    return thread;
  }

  function pruneMemberDmThreadIds(thread) {
    if (!thread || typeof thread !== "object") return;
    const map = thread.memberDmThreadIds;
    if (!map || typeof map !== "object" || Array.isArray(map)) return;
    const members = new Set(memberCharIds(thread));
    const next = Object.create(null);
    let changed = false;
    for (const [k, v] of Object.entries(map)) {
      const cid = String(k || "").trim();
      const tid = String(v || "").trim();
      if (!cid || !tid || !members.has(cid)) {
        changed = true;
        continue;
      }
      next[cid] = tid;
    }
    if (!Object.keys(next).length) {
      if (thread.memberDmThreadIds) {
        delete thread.memberDmThreadIds;
        changed = true;
      }
    } else if (changed) {
      thread.memberDmThreadIds = next;
    }
  }

  /** 从气泡解析发言人 charId（优先 speakerCharId；旧记录可据正文【角色名】推断）。 */
  function speakerCharIdFromMessage(m, thread) {
    if (!m || typeof m !== "object" || m.role !== "assistant") return "";
    const members = memberCharIds(thread);
    const sid = String(m.speakerCharId || "").trim();
    if (sid && members.includes(sid)) return sid;
    const raw = String(m.content || "").trim();
    if (raw) {
      const m0 = raw.match(/^【([^】]+)】\s*/u);
      if (m0) {
        const tag = String(m0[1] || "").trim();
        if (tag && !/^红包/.test(tag) && !/^拼手气红包/.test(tag) && !/^专属红包/.test(tag)) {
          const ref = resolveMemberRef(tag, thread);
          if (ref && members.includes(ref)) return ref;
        }
      }
    }
    return String(thread?.charId || "").trim();
  }

  function resolveMemberRef(ref, thread) {
    const s = String(ref || "").trim();
    if (!s) return "";
    const members = memberCharIds(thread);
    if (members.includes(s)) return s;
    const userArchive = maskDisplayName();
    const userNick = groupNicknameForRef(thread, USER_TARGET);
    if (
      s === USER_TARGET ||
      s === userArchive ||
      (userNick && (userNick === s || userNick.startsWith(s) || s.startsWith(userNick)))
    ) {
      return USER_TARGET;
    }
    for (const cid of members) {
      const nick = groupNicknameForRef(thread, cid);
      if (nick && (nick === s || nick.startsWith(s) || s.startsWith(nick))) return cid;
      const nm = charDisplayName(cid);
      if (nm === s || nm.startsWith(s) || s.startsWith(nm)) return cid;
    }
    return "";
  }

  /** 专属红包接收者：主控别名 → USER_TARGET；成员名/charId → 归一化 charId */
  function resolveRedpackTargetRef(ref, thread) {
    const s = String(ref ?? "").trim();
    if (!s) return "";
    const low = s.toLowerCase();
    const userCall = maskDisplayName();
    const userNick = groupNicknameForRef(thread, USER_TARGET);
    if (
      s === USER_TARGET ||
      low === "__user__" ||
      low === "user" ||
      low === "mask" ||
      low === "master" ||
      s === "主控" ||
      s === "用户" ||
      (userCall && s === userCall) ||
      (userNick && s === userNick)
    ) {
      return USER_TARGET;
    }
    return resolveMemberRef(ref, thread);
  }

  function exclusiveRedpackTargetLabel(rp) {
    if (!rp || rp.mode !== "exclusive") return "";
    const tgt = String(rp.targetCharId || "").trim();
    if (!tgt || tgt === USER_TARGET) return maskDisplayName() || "主控";
    const nm = charDisplayName(tgt);
    return tgt ? `${nm}（${tgt}）` : nm;
  }

  function stripUtf8Bom(s) {
    const t = String(s ?? "");
    return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
  }

  function parseJsonLoose(raw) {
    let t = stripUtf8Bom(String(raw || "")).trim();
    if (!t) return null;
    if (t.startsWith("```")) {
      t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    }
    try {
      return JSON.parse(t);
    } catch {
      const slice = t.match(/\{[\s\S]*\}/);
      if (slice) {
        try {
          return JSON.parse(slice[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  function buildMemberPersonaBlock(charId, thread) {
    const it = charItemById(charId);
    if (!it) return "";
    const body = pickPersonaBody(it);
    const name = charDisplayName(charId);
    const parts = [`[成员 · ${name}]`, `charId（replies 里必须原样使用）：${charId}`];

    const summary = String(body.summary || it.summary || "").trim();
    if (summary) parts.push(`[摘要]\n${summary.slice(0, 5000)}`);
    const aliases = String(body.aliases || it.aliases || "").trim();
    if (aliases) parts.push(`[称呼与别名]\n${aliases.slice(0, 800)}`);
    const tags = String(body.tags || it.tags || "").trim();
    if (tags) parts.push(`[性格标签]\n${tags.slice(0, 1200)}`);
    const voice = String(body.voice || it.voice || "").trim();
    if (voice) parts.push(`[说话方式 · 写该角色 line 时严格照此]\n${voice.slice(0, 2200)}`);
    const boundaries = String(body.boundaries || it.boundaries || "").trim();
    if (boundaries) parts.push(`[边界]\n${boundaries.slice(0, 1500)}`);
    const npc = String(body.npcRelations || it.npcRelations || "").trim();
    if (npc) parts.push(`[人际/NPC]\n${npc.slice(0, 2000)}`);
    const dlg = String(body.dialogueLang || it.dialogueLang || "").trim();
    if (dlg) parts.push(`[常用对白语言]\n${dlg.slice(0, 80)}`);
    const imgPrompt = String(body.charImageGenPrompt || it.charImageGenPrompt || "").trim();
    if (imgPrompt) parts.push(`[制作设定 · 生图外貌 tag]\n${imgPrompt.slice(0, 800)}`);

    const openings = Array.isArray(body.openings) ? body.openings : [];
    const op0 = openings.length ? String(openings[0] || "").trim() : "";
    if (op0) {
      parts.push(
        `[开场白参考 · 勿机械复读，只作「${name}」口吻与信息密度参照]\n${op0.slice(0, 1200)}`
      );
    }

    const priv = buildMemberPrivateNotesBlock(thread, charId);
    if (priv) parts.push(priv);

    const bridgeFn = deps().buildLinkedDmMemoryBridgeBlockForGroupMember;
    const maskId =
      typeof deps().getActiveMaskIdForInbox === "function" ? deps().getActiveMaskIdForInbox() : "";
    if (typeof bridgeFn === "function" && maskId) {
      const bridge = bridgeFn(thread, charId, maskId);
      if (bridge) parts.push(bridge);
    }

    return parts.join("\n\n");
  }

  function buildUserMaskPromptBlock(mask, userCall) {
    const persona = String(mask.persona || mask.summary || "").trim();
    const parts = [];
    if (persona) parts.push(`[主控面具 · ${userCall}]\n${persona.slice(0, 6000)}`);
    const mv = String(mask.voice || "").trim();
    if (mv) parts.push(`[主控 · 说话方式]\n${mv.slice(0, 1200)}`);
    const mb = String(mask.boundaries || "").trim();
    if (mb) parts.push(`[主控 · 边界]\n${mb.slice(0, 1200)}`);
    if (!parts.length) return "";
    return (
      parts.join("\n\n") +
      `\n\n[主控了解程度] 面具资料不等于成员都已知道；按关系与聊天是否提过决定是否掌握 ${userCall} 的私事，勿全员全知。`
    );
  }

  /** 群聊参考式核心：[FRAME][SYSTEM][SOUL][VOICE_LOCK][BEHAVIOR][THINK] */
  function buildGroupReferenceStyleCoreBlock(userCall, thread) {
    const essenceFn = deps().buildLivelyInteractionEssenceBlock;
    const buildBeatsFn = deps().buildThinkingChainBeatLines;
    const resolvePackFn = deps().resolveChatPromptPack;
    const pack =
      typeof resolvePackFn === "function" ? resolvePackFn(thread || readActiveThread()) : "original";
    const thick = pack === "thick";
    const v3 = pack === "v3";
    const essenceLines =
      typeof essenceFn === "function"
        ? essenceFn({ surface: "group", userCall })
        : [];
    const groupStRepl = (s) =>
      String(s ?? "")
        .replace(/\{\{\s*user\s*\}\}/gi, userCall)
        .replace(/\{\{\s*char\s*\}\}/gi, "各成员");
    const beatLines =
      typeof buildBeatsFn === "function"
        ? buildBeatsFn({ surface: "group", userCall, stRepl: groupStRepl })
        : [
            `群聊 thinking：写 replies 前 **snag → drift → read → feel → route** 五拍（felt sense；勿 essay）：`,
            `**snag**：群场质感、各人在等谁；聊过的别当未知。`,
            `**drift**：各 charId 口癖/打字指纹——**禁止互串**。`,
            `**read**：每人与群之间的气；各抓一个线头。`,
            `**feel**：各 char 内天气落定。`,
            `**route**：标 charId 接话链（数组下标=时间线）；像脚本/全员同腔 → 改。`
          ];
    const soulLines = thick
      ? [
          `[SOUL:GROUP] Every charId is a person with a day, not a helpdesk.`,
          `Weather swings on small things; they may say one thing and mean another. Tired / sleepy / hungry changes speed and length. Typos, lost words, self-corrections OK. What was said in this group stays — forgetting that is not-listening, not "cute fuzz." They hesitate and get interrupted.`,
          `Off-screen life: someone may drop what they're doing, half-read, reply once then go quiet. Do not aim every line at ${userCall}; members may riff, roast, and gawk at each other.`,
          `Low-energy members stay short and show up less; hooked ones may fire 2–4. Never give everyone the same mouth.`
        ]
      : v3
        ? [
            `[mode] Group phones. Instant, silence allowed. Not a novel, not a round-robin ticket queue.`,
            `[char] Each charId is that person. Every rule means "what would THIS member do?" Never one shared witty-chat voice.`,
            `[life] Each member has a day. Energy, hunger, errands, private plans are real — not 24/7 waiting. Low-energy stay short; hooked may fire 2–4. Do not aim every line at ${userCall}; members may riff, roast, and gawk at each other.`,
            `[taboo] Empty care off by default. Stock romance off unless that member's sheet holds it. Cold ≠ fierce. Don't write everyone as the same soft flirt to look alive.`,
            `[precheck] 1. Each visible line needs a hook (someone's last bubble / the group thread). 2. No echo: don't reuse the same opener on consecutive bubbles from the same charId. 3. A question aimed at you — answer first.`
          ]
        : [
            `[SOUL · 群聊]`,
            `像真群：口语、半截话、可连发、可插嘴、可慢回；禁 narration、客服腔、百科腔、破墙。`,
            `不必句句对准 ${userCall}；成员可互相接梗、吐槽、吃瓜。`
          ];
    return [
      `[SYSTEM]`,
      `全文简体中文。JSON 根 optional **thinking**；各 reply 只写 **line**（字符串），勿 lines 数组；thinking 勿用 \`<thinking>\` XML。`,
      ...soulLines,
      ...essenceLines,
      `[VOICE_LOCK · 写每条 line 前]`,
      `只锚定**该 charId 上方设定**的 2～3 个口癖；换 charId 必须换口气。`,
      `唯一性自检：这句只有这个 charId 会发吗？禁止把 A 的 secret/口吻写到 B。`,
      `[BEHAVIOR]`,
      `Interactive：理想节奏 a→a→b→a→c 来回，勿 ab 两块堆完；同一人可连发 2～4 条。`,
      `约 2～${MAX_REPLY_ITEMS} 条 replies；整轮**多个角色都要露面**${thick || v3 ? " (busy / low-energy members stay short — still human, not homework)" : ""}。`,
      `Tools：sticker/charImage/redpack **多数轮 omit**；自然想用再用，勿每轮凑。`,
      `[THINK · 内化]`,
      `thinking 是过程草稿（中文 murmur；可 blur）；各 reply 可选 **heartVoice** 是收口心理，勿与 thinking 整段复读。`,
      ...beatLines,
      `[顺序 · 硬规则]`,
      `replies **下标 = 气泡时间线**；后条须接前条因果。thinking 里先标 charId 接话链。`,
      `[引用]`,
      `接某条原话：line 以「原文」开头；勿编造；勿写【角色名】署名（有 charId 即谁说话）。`,
      `[用户连发] 对方连发多条 user 气泡时全读理解，各成员只抓一个线头，勿客服式逐条复述。`
    ].join("\n\n");
  }

  function buildGroupSharedMemoryBlock(thread) {
    const fn = deps().buildCharThreadMemoryTimelineForPrompt;
    if (typeof fn !== "function") return "";
    const blob = fn(thread);
    if (!blob) return "";
    const note = String(thread.groupThreadNote || thread.charThreadNote || "").trim();
    const parts = [blob];
    if (note) {
      parts.push(
        `[本群 · 主控备忘]\n${note.slice(0, 4000)}\n（群级备注；勿当作全员都已知的剧情，除非聊过。）`
      );
    }
    return parts.join("\n\n");
  }

  function buildMemberPrivateNotesBlock(thread, forCharId) {
    const memberNotes = thread.memberNotes && typeof thread.memberNotes === "object" ? thread.memberNotes : null;
    if (!memberNotes) return "";
    const note = String(memberNotes[forCharId] || "").trim();
    if (!note) return "";
    return `[主控对「${charDisplayName(forCharId)}」的私下备注 · 写该角色台词时可参考，勿泄露给其他成员口吻]\n${note.slice(0, 1500)}`;
  }

  function logRowToApiLine(m, thread, mask, logSlice) {
    const userCall = (mask.displayName && String(mask.displayName).trim()) || "主控";
    const d = deps();
    const formatQuoteBody =
      typeof d.formatMessageQuoteBodyForApi === "function" ? d.formatMessageQuoteBodyForApi : null;
    const logArr = Array.isArray(logSlice) ? logSlice : [];
    if (!m || typeof m !== "object") return "";
    if (m.role === "user") {
      /** @type {string[]} */
      const chunks = [];
      const quoted =
        formatQuoteBody && typeof d.readMessageQuoteRef === "function" && d.readMessageQuoteRef(m)
          ? formatQuoteBody(m, logArr, thread, mask)
          : "";
      const c = quoted || String(m.content || "").trim();
      if (c) chunks.push(c.split(/\|\|\|/).join("\n"));
      const st = m.sticker && typeof m.sticker === "object" ? m.sticker : null;
      if (st && String(st.url || "").trim()) {
        const stDesc = String(st.description || st.desc || "").trim();
        chunks.push(stDesc ? `【表情包：${stDesc}】` : "【表情包】");
      }
      const im = m.image && typeof m.image === "object" ? m.image : null;
      if (im) {
        const url = String(im.url || "").trim();
        const desc = String(im.desc || "").trim();
        if (url) chunks.push(desc ? `（对方发来一张图片）${desc}` : "（对方发来一张图片）");
        else if (desc) chunks.push(`【对方发图（画面描述）】${desc}`);
      }
      if (!chunks.length) return "";
      return `【${userCall}】：${chunks.join("\n").slice(0, 3500)}`;
    }
    if (m.role === "assistant") {
      const cid = speakerCharIdFromMessage(m, thread);
      const nm = charDisplayName(cid);
      /** @type {string[]} */
      const chunks = [];
      const im = m.image && typeof m.image === "object" ? m.image : null;
      if (im && String(im.desc || "").trim() && !String(im.url || "").trim()) {
        chunks.push(`【发图（画面描述）】${String(im.desc).trim().slice(0, 1200)}`);
      }
      const quoted =
        formatQuoteBody && typeof d.readMessageQuoteRef === "function" && d.readMessageQuoteRef(m)
          ? formatQuoteBody(m, logArr, thread, mask)
          : "";
      const c = quoted || String(m.content || "").trim();
      if (c) chunks.push(c.split(/\|\|\|/).join("\n"));
      const st = m.sticker && typeof m.sticker === "object" ? m.sticker : null;
      if (st && String(st.url || "").trim()) {
        const stDesc = String(st.description || st.desc || "").trim();
        chunks.push(stDesc ? `【表情包：${stDesc}】` : "【表情包】");
      }
      const pls =
        Array.isArray(m.stickerPlacements) && m.stickerPlacements.length
          ? m.stickerPlacements.filter((p) => p && String(p.url || "").trim())
          : [];
      for (const pl of pls) {
        const plDesc = String(pl.description || pl.desc || "").trim();
        chunks.push(plDesc ? `【表情包：${plDesc}】` : "【表情包】");
      }
      const rp = m.redpack;
      if (isGroupRedpack(rp)) {
        const kind =
          rp.mode === "exclusive"
            ? `专属→${exclusiveRedpackTargetLabel(rp)}`
            : `拼手气·${Math.floor(Number(rp.count) || 0) || MIN_LUCKY_COUNT}个`;
        chunks.push(
          `【红包·${kind}】¥${sanitizeRedpackAmount(rp.totalAmt || rp.amt)}（${String(rp.note || "").trim() || "恭喜发财"}）id:${String(rp.id || "")}`
        );
      }
      if (!chunks.length) return "";
      return `【${nm}】：${chunks.join("\n").slice(0, 3500)}`;
    }
    return "";
  }

  function buildGroupStickerImagePromptBlock(thread, userCall) {
    const d = deps();
    const bindArr =
      typeof d.getThreadStickerBindCategories === "function" ? d.getThreadStickerBindCategories(thread) : [];
    const bindText = bindArr.length ? bindArr.map((x) => `「${x}」`).join("、") : "未绑定（可用全部）";
    const catalog =
      typeof d.buildStickerCatalogPromptBlock === "function" ? d.buildStickerCatalogPromptBlock(thread) : "";

    const imgCfg = typeof d.readImageGenConfig === "function" ? d.readImageGenConfig() : {};
    const sessionOn = Boolean(imgCfg && imgCfg.enabled && String(imgCfg.apiKey || "").trim());
    const descGen =
      typeof d.isThreadDescImageApiGenEnabled === "function" ? d.isThreadDescImageApiGenEnabled(thread) : false;
    const imgGen =
      sessionOn &&
      descGen &&
      typeof d.isSessionImageGenConfigured === "function" &&
      d.isSessionImageGenConfigured();

    const captionRule = imgGen
      ? "charImage.caption **必须英文**（短 tag 或一句英文画面，面向图像模型）；line 仍用中文。"
      : "charImage.caption **用中文**写清画面（文字卡接戏，无 API 时不强求英文）。";

    return [
      `[表情包 · 群聊]`,
      `本群绑定分类：${bindText}。`,
      catalog,
      `需要发表情：在 line 内写「【表情包：关键词】」，或 reply 项设 sendSticker:true 与可选 stickerKeyword。关键词请摘自上方清单；裸「【表情包】」也可（程序按语境择图）。`,
      `与单聊一样：多数轮次只发文字，但调侃、缓和、词穷、敷衍等场合**可以**主动带表情，不必等用户先发。`,
      `[描述式发图]`,
      `成员可发「描述式图片」（界面显示图片卡，无真实像素）。方式：① reply 增加 charImage:{ caption, subject? }，subject 为 char|user|both|object|scene|other（char=该 charId 本人入镜）；② line 写成「【图片】画面描述」。`,
      captionRule,
      `与单聊一样：想晒图、给对方看某画面时，可主动 charImage 或「【图片】…」；指令本身不出现在气泡正文。`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function stripImageProtocolFromLine(line) {
    const d = deps();
    const isProto = d.isAssistantImageProtocolLine;
    const extractCap = d.extractAssistantImageCaptionFromProtocolLine;
    const s = String(line ?? "").trim();
    if (typeof isProto !== "function" || typeof extractCap !== "function" || !isProto(s)) {
      return { content: s, imageCaption: "" };
    }
    const cap = String(extractCap(s) || "").trim();
    return { content: "", imageCaption: cap.slice(0, 4000) };
  }

  /**
   * @param {unknown} item
   * @returns {{ charImageCaption: string, charImageSubject: string, sendSticker: boolean, stickerKeyword: string }}
   */
  function parseReplyItemMediaFields(item) {
    const d = deps();
    const o = item && typeof item === "object" ? item : {};
    const capFn = d.parseCharImageCaptionFromAssistantJson;
    const subFn = d.parseImageSubjectFromAssistantJson;
    const urlFn = d.parseCharImageUrlFromAssistantJson;
    let charImageCaption =
      typeof capFn === "function" ? String(capFn(o) || "").trim().slice(0, 4000) : "";
    let charImageSubject =
      typeof subFn === "function" ? String(subFn(o) || "").trim() : "auto";
    let charImageUrl = typeof urlFn === "function" ? String(urlFn(o) || "").trim() : "";
    const sendSticker = o.sendSticker === true || o.send_sticker === true;
    const stickerKeyword = String(o.stickerKeyword ?? o.sticker_keyword ?? "").trim();
    return { charImageCaption, charImageSubject, charImageUrl, sendSticker, stickerKeyword };
  }

  /**
   * @typedef {{ charId: string, content: string, charImageCaption?: string, charImageSubject?: string, charImageUrl?: string, sendSticker?: boolean, stickerKeyword?: string }} GroupReplyItem
   */

  /** 去掉 line 里误写的【角色名】前缀（界面已有 charId / 发言人条）。 */
  function stripGroupLineSpeakerPrefixes(line, thread, charId) {
    let s = String(line || "").trim();
    const cid = String(charId || "").trim();
    for (let guard = 0; guard < 6; guard++) {
      const m = s.match(/^【([^】]+)】\s*(.*)$/su);
      if (!m) break;
      const tag = String(m[1] || "").trim();
      if (/^红包/.test(tag) || /^拼手气红包/.test(tag) || /^专属红包/.test(tag)) break;
      const ref = resolveMemberRef(tag, thread);
      if (cid && (ref === cid || charDisplayName(cid) === tag)) {
        s = String(m[2] || "").trim();
        continue;
      }
      if (ref && memberCharIds(thread).includes(ref)) {
        s = String(m[2] || "").trim();
        continue;
      }
      break;
    }
    return s;
  }

  /**
   * 模型把红包写进 line 时兜底解析为 redpack 对象（并剥离 line 里的【红包】文案）。
   * @returns {{ spec: object, cleanedLine: string } | null}
   */
  function extractRedpackSpecFromLine(line, thread) {
    const parseFn = deps().parseRedpackMessageText;
    if (typeof parseFn !== "function") return null;
    let s = stripGroupLineSpeakerPrefixes(line, thread, "");
    if (!s) return null;
    const segRe = /【(?:专属红包·发给[^】]*|拼手气红包|红包)】[^【]*/u;
    const hit = s.match(segRe);
    const seg = hit ? hit[0].trim() : s;
    const parsed = parseFn(seg);
    if (!parsed) return null;
    let mode = "lucky";
    let targetCharId = "";
    if (/^【专属红包·发给/.test(seg)) {
      mode = "exclusive";
      const tm = seg.match(/^【专属红包·发给([^】]*)】/u);
      targetCharId = resolveRedpackTargetRef(tm ? tm[1].trim() : "", thread);
    } else if (seg.includes("拼手气")) {
      mode = "lucky";
    }
    const cleanedLine = hit ? s.replace(hit[0], "").replace(/\s+/g, " ").trim() : "";
    return {
      spec: {
        mode,
        totalAmt: parsed.amt,
        note: parsed.note,
        count: MIN_LUCKY_COUNT,
        targetCharId
      },
      cleanedLine
    };
  }

  /**
   * @param {GroupReplyItem} reply
   * @param {object} thread
   * @param {unknown[]} log
   * @param {number} at
   * @returns {object[]}
   */
  function buildGroupAssistantLogEntries(reply, thread, log, at) {
    const d = deps();
    const cid = String(reply.charId || "").trim();
    let line = String(reply.content || "").trim();
    let imgCap = String(reply.charImageCaption || "").trim();
    const imgSub = String(reply.charImageSubject || "auto").trim() || "auto";

    const stripped = stripImageProtocolFromLine(line);
    if (!imgCap && stripped.imageCaption) imgCap = stripped.imageCaption;
    line = stripped.content;

    const parsedSticker = {
      modelSendSticker: reply.sendSticker === true,
      modelStickerKeyword: String(reply.stickerKeyword || "").trim()
    };
    const extractPick =
      typeof d.extractAssistantStickerPick === "function" ? d.extractAssistantStickerPick : null;
    const stickerOut = extractPick
      ? extractPick(line, parsedSticker, thread, { contextHint: line })
      : { keptJoined: line, picked: null, placements: [] };
    line = String(stickerOut.keptJoined || "").trim();
    line = stripGroupLineSpeakerPrefixes(line, thread, cid);

    let redpackSpec = reply.redpackSpec && typeof reply.redpackSpec === "object" ? reply.redpackSpec : null;
    if (!redpackSpec) {
      const fromLine = extractRedpackSpecFromLine(line, thread);
      if (fromLine) {
        redpackSpec = fromLine.spec;
        line = fromLine.cleanedLine;
      }
    }

    const hasSticker =
      Boolean(stickerOut.picked) ||
      (Array.isArray(stickerOut.placements) && stickerOut.placements.length > 0);
    const hasImage = Boolean(imgCap);
    const hasRedpack = !!(redpackSpec && typeof redpackSpec === "object");
    if (!line && !hasSticker && !hasImage && !hasRedpack) return [];

    const entry = {
      role: "assistant",
      content: line || (hasImage || hasSticker ? "" : "\u00A0"),
      at,
      speakerCharId: cid
    };

    if (hasImage) {
      const sc = imgCap.slice(0, 3500);
      entry.image = { desc: imgCap.slice(0, 4000), scenePrompt: sc };
      const imgUrlRaw = String(reply.charImageUrl || "").trim();
      const sanitize = d.sanitizeStickerUrl;
      const imgUrl = typeof sanitize === "function" ? sanitize(imgUrlRaw) : imgUrlRaw;
      if (imgUrl) entry.image.url = imgUrl;
      const imgCfg = typeof d.readImageGenConfig === "function" ? d.readImageGenConfig() : {};
      const planFn = d.planAssistantSessionImageAttachment;
      if (typeof planFn === "function") {
        const plan = planFn({
          charImageCaption: imgCap,
          charImgUrl: imgUrl || "",
          heartVoiceText: "",
          everyRound: false,
          imgCfg,
          thread
        });
        if (plan.deferSessionImg && !imgUrl) entry.image.imageGenPending = true;
      }
      if (typeof d.applySessionImageSubjectOnRow === "function") {
        d.applySessionImageSubjectOnRow(entry, thread, sc, log, imgSub !== "auto" ? imgSub : null);
      }
    }

    if (typeof d.tagAssistantEntryDmSurface === "function") {
      d.tagAssistantEntryDmSurface(entry, "im");
    }

    /** @type {object[]} */
    const out = [entry];
    if (hasRedpack) {
      attachCharRedpackToEntry(entry, redpackSpec, cid, thread);
    }
    applyGroupStickerLayout(out, stickerOut, entry);
    return out;
  }

  /**
   * @param {object[]} next
   * @param {{ keptJoined?: string, picked?: { url: string, description: string } | null, placements?: object[] }} layout
   * @param {object} entry
   */
  function applyGroupStickerLayout(next, layout, entry) {
    const picked = layout.picked;
    const placements = Array.isArray(layout.placements) ? layout.placements : [];
    const kept = String(layout.keptJoined || "").trim();
    if (!picked && !placements.length) return;

    if (!kept) {
      if (!picked) return;
      entry.content = "";
      entry.sticker = { url: picked.url, description: picked.description };
      if (entry.stickerPlacements) delete entry.stickerPlacements;
      return;
    }

    if (placements.length) {
      entry.stickerPlacements = placements.map((p) => ({
        insertAfterSeg: Number(p.insertAfterSeg),
        url: String(p.url || ""),
        description: String(p.description || "")
      }));
      if (entry.sticker) delete entry.sticker;
      entry.content = kept;
    }
  }

  function buildGroupLogMessages(thread, logSlice, mask) {
    const msgs = [];
    const logArr = Array.isArray(logSlice) ? logSlice : [];
    for (const m of logArr) {
      if (!m || typeof m !== "object") continue;
      if (m.role !== "user" && m.role !== "assistant") continue;
      if (m.role === "assistant" && m.restoring && !String(m.content || "").trim()) continue;
      const line = logRowToApiLine(m, thread, mask, logArr);
      if (!line) continue;
      msgs.push({
        role: m.role === "user" ? "user" : "assistant",
        content: line
      });
    }
    return msgs;
  }

  function buildGroupWorldBookPromptBlock(thread, userCall) {
    const buildOne = deps().buildWorldBookBlockForVolumeId;
    const buildMany = deps().buildWorldBookBlockForVolumeIds;
    const getCharWbIds = deps().getCharMainWorldBookVolumeIds;
    const getEffective = deps().getEffectiveThreadWorldBookVolumeIds;
    if (typeof buildOne !== "function") return "";

    const groupTitle = String(thread.groupTitle || "").trim() || "本群";
    const seen = new Set();
    /** @type {string[]} */
    const parts = [];

    for (const cid of memberCharIds(thread)) {
      const it = charItemById(cid);
      if (!it || typeof getCharWbIds !== "function") continue;
      const name = charDisplayName(cid);
      for (const vid of getCharWbIds(it)) {
        const id = String(vid || "").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const block = buildOne(id, name, userCall);
        if (!block) continue;
        parts.push(
          `[世界书 · 档案 · ${name}（charId: ${cid}）]\n${block}\n（仅 ${name} 适用；写该 charId 的 line 时内化，勿套到其他成员。）`
        );
      }
    }

    if (typeof getEffective === "function") {
      const sharedIds = getEffective(thread).filter((id) => {
        const s = String(id || "").trim();
        return s && !seen.has(s);
      });
      if (sharedIds.length && typeof buildMany === "function") {
        const blob = buildMany(sharedIds, groupTitle, userCall);
        if (blob) {
          parts.push(
            `[世界书 · 本群/全局 · ${groupTitle}]\n${blob}\n（群聊共用背景；各成员仍须遵守各自档案世界书与人设。）`
          );
        }
      }
    }

    if (!parts.length) return "";
    return parts.join("\n\n");
  }

  function buildGroupRedpackPromptBlock(thread, userCall) {
    const members = memberCharIds(thread);
    const roster = [
      rosterLineForRef(thread, USER_TARGET),
      ...members.map((cid) => rosterLineForRef(thread, cid))
    ].join("\n");
    const uc = String(userCall || "").trim() || "主控";
    return [
      `[群红包 · 专属与拼手气]`,
      `成员（收专属红包时必须用下列 charId 当 targetCharId）：\n${roster}`,
      `拼手气 mode:"lucky"：count 为 ${MIN_LUCKY_COUNT}～${MAX_LUCKY_COUNT}，多人可 redpackActions 抢。`,
      `专属 mode:"exclusive"：**仅 1 人**可领或拒；**targetCharId = 接收者**（不是发送者 charId）。`,
      `- 发给主控「${uc}」：targetCharId 写 "${USER_TARGET}"（勿写发送者自己的 charId）。`,
      `- 发给某成员：targetCharId 写对方在 roster 里的 charId；仅该成员可 claim/reject，其他人不要写 redpackActions。`,
      `示例（A 发给 B）：{"charId":"A","line":"给你","redpack":{"mode":"exclusive","totalAmt":"66","note":"拿好","targetCharId":"B"}}`,
      `示例（A 发给主控）：{"charId":"A","redpack":{"mode":"exclusive","totalAmt":"88","targetCharId":"${USER_TARGET}"}}`,
      `**禁止**在 line 里写【红包】/【拼手气红包】或【角色名】署名（有 charId 即谁说话）；发红包**只写 redpack 对象**，line 可留空或写「发个包」等口语。`,
      `[群红包 · 旁观者]`,
      `${uc} 或某成员向他人发专属/拼手气红包时，全群可见。除当事人领/拒/道谢外，**其他成员**也可按各自人设反应（羡慕、祝贺、起哄、吃瓜、酸一句等），不必只有收包人开口。`
    ].join("\n");
  }

  function buildGroupSystemPrompt(thread, mask) {
    const members = memberCharIds(thread);
    const userCall = (mask.displayName && String(mask.displayName).trim()) || "主控";
    const groupTitle = String(thread.groupTitle || "").trim() || "群聊";
    const roster = [
      rosterLineForRef(thread, USER_TARGET),
      ...members.map((cid) => rosterLineForRef(thread, cid))
    ].join("\n");

    const personaBlocks = members.map((cid) => buildMemberPersonaBlock(cid, thread)).filter(Boolean);

    const worldBook = buildGroupWorldBookPromptBlock(thread, userCall);

    return [
      `[FRAME · 群聊]`,
      `微信群聊「${groupTitle}」。成员：\n${roster}`,
      `「${userCall}」是主控；其余 charId 均为独立角色，**禁止串人设、禁止替别人说话**。`,
      buildGroupReferenceStyleCoreBlock(userCall, thread),
      `[群昵称]`,
      `- 互称优先用 roster 中的**群昵称**；未设则用面具名/档案名。台词里可叫群昵称，但 JSON 的 charId / targetCharId 仍用 roster 里的 charId（含主控 ${USER_TARGET}）。`,
      `- 仅当剧情需要改**自己**本群昵称时，用顶层 groupNicknameChange 或 replies[].groupNickname（≤${MAX_GROUP_NICKNAME_LEN} 字，勿每轮乱改；台词里叫法不等于改昵称）。`,
      `[输出 · 仅 JSON]`,
      `{"thinking":"可选","replies":[{"charId":"…","line":"…","groupTitle":"新群名","groupNickname":"本群新昵称","heartVoice":"一句改群名/昵称时的想法","charImage":{…},"redpack":{…}}, …],"groupTitleChange":{"charId":"…","groupTitle":"新群名","heartVoice":"一句改群名时的想法"},"groupNicknameChange":{"charId":"…","groupNickname":"新昵称","heartVoice":"一句改昵称时的想法"},"redpackActions":[…]}`,
      `- 每条 reply 只写 **line**（字符串），勿用 lines 数组；charImage / sendSticker / redpack / groupTitle / groupNickname 均可选。`,
      `- **改群名**（可选）：任意成员可改；用顶层 groupTitleChange 或 replies[].groupTitle（≤32 字）；可附 **heartVoice 一句想法**（改群名时未说出口的念头，≤80 字，**勿写** innerState/mood/desire/affinity 等面板字段）；同轮最多改一次。`,
      `- **改本群昵称**（可选）：仅改**发言人自己**；用顶层 groupNicknameChange 或 replies[].groupNickname（≤${MAX_GROUP_NICKNAME_LEN} 字，留空可清除）；可附 **heartVoice 一句想法**（改昵称时未说出口的念头，≤80 字，**勿写** innerState/mood/desire/affinity 等面板字段）；同轮最多改一次。`,
      `- 可 {"replies":[]} 表示本轮无人开口。`,
      buildGroupRedpackPromptBlock(thread, userCall),
      buildGroupStickerImagePromptBlock(thread, userCall),
      buildUserMaskPromptBlock(mask, userCall),
      ...personaBlocks,
      buildGroupSharedMemoryBlock(thread),
      worldBook
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function normalizeGroupTitleText(s) {
    return String(s ?? "").trim().slice(0, 32);
  }

  /** 改群名附带的「一句想法」，不是主聊天心声面板那套字段。 */
  function parseGroupTitleChangeThought(o) {
    if (!o || typeof o !== "object") return {};
    const hv = String(o.heartVoice ?? o.innerVoice ?? o.心声 ?? o.thought ?? "").trim().slice(0, 80);
    return hv ? { heartVoice: hv } : {};
  }

  /** @param {object|null} prev @param {string} cid @param {string} title @param {object} item */
  function mergeGroupTitleChangeEntry(prev, cid, title, item) {
    const thought = parseGroupTitleChangeThought(item);
    const keep =
      String(thought.heartVoice || "").trim() ||
      String(prev?.heartVoice || "").trim();
    return {
      charId: cid,
      groupTitle: title,
      ...(keep ? { heartVoice: keep.slice(0, 80) } : {})
    };
  }

  /** @param {object} o @param {object} thread */
  function parseGroupTitleChangeFromObj(o, thread) {
    if (!o || typeof o !== "object") return null;
    const cid = resolveMemberRef(o.charId ?? o.id ?? o.speaker, thread);
    const title = normalizeGroupTitleText(
      o.groupTitle ?? o.newGroupTitle ?? o.title ?? o.newTitle ?? o.rename ?? o.renameGroup
    );
    if (!cid || !title) return null;
    return mergeGroupTitleChangeEntry(null, cid, title, o);
  }

  /**
   * 解析角色改群名：顶层 groupTitleChange，或 replies[] 中带 groupTitle 的最后一条。
   * @param {object|null} root
   * @param {object} thread
   * @returns {{ charId: string, groupTitle: string, heartVoice?: string } | null}
   */
  function parseGroupTitleChange(root, thread) {
    if (!root || typeof root !== "object") return null;
    let change = null;
    const top = root.groupTitleChange ?? root.renameGroup ?? root.groupRename ?? root.setGroupTitle;
    if (top && typeof top === "object") change = parseGroupTitleChangeFromObj(top, thread);
    const items = Array.isArray(root.replies) ? root.replies : [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const title = normalizeGroupTitleText(
        item.groupTitle ?? item.newGroupTitle ?? item.renameGroup ?? item.rename
      );
      if (!title) continue;
      const cid = resolveMemberRef(item.charId ?? item.id ?? item.speaker, thread);
      if (cid) change = mergeGroupTitleChangeEntry(change, cid, title, item);
    }
    return change;
  }

  /** @param {object|null} prev @param {string} cid @param {string} nick @param {object} item */
  function mergeGroupNicknameChangeEntry(prev, cid, nick, item) {
    const thought = parseGroupTitleChangeThought(item);
    const keep =
      String(thought.heartVoice || "").trim() ||
      String(prev?.heartVoice || "").trim();
    return {
      charId: cid,
      groupNickname: nick,
      ...(keep ? { heartVoice: keep.slice(0, 80) } : {})
    };
  }

  /** @param {object} o @param {object} thread @param {string} [enforcedCid] */
  function parseGroupNicknameChangeFromObj(o, thread, enforcedCid) {
    if (!o || typeof o !== "object") return null;
    let cid = resolveMemberRef(o.charId ?? o.id ?? o.speaker, thread);
    const nickRaw = o.groupNickname ?? o.nickname ?? o.groupNick ?? o.nick;
    if (nickRaw === undefined || nickRaw === null) return null;
    const nick = normalizeGroupNicknameText(nickRaw);
    if (enforcedCid) {
      if (cid && cid !== enforcedCid) return null;
      cid = enforcedCid;
    }
    if (!cid || cid === USER_TARGET) return null;
    if (!memberCharIds(thread).includes(cid)) return null;
    return mergeGroupNicknameChangeEntry(null, cid, nick, o);
  }

  /**
   * 解析角色改本群昵称：顶层 groupNicknameChange，或 replies[] 中带 groupNickname 的最后一条（仅本人）。
   * @param {object|null} root
   * @param {object} thread
   * @returns {{ charId: string, groupNickname: string, heartVoice?: string } | null}
   */
  function parseGroupNicknameChange(root, thread) {
    if (!root || typeof root !== "object") return null;
    let change = null;
    const top = root.groupNicknameChange ?? root.setGroupNickname ?? root.nicknameChange;
    if (top && typeof top === "object") change = parseGroupNicknameChangeFromObj(top, thread);
    const items = Array.isArray(root.replies) ? root.replies : [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const nickDefined = item.groupNickname ?? item.nickname ?? item.groupNick ?? item.nick;
      if (nickDefined === undefined || nickDefined === null) continue;
      const cid = resolveMemberRef(item.charId ?? item.id ?? item.speaker, thread);
      if (!cid || cid === USER_TARGET) continue;
      const nick = normalizeGroupNicknameText(nickDefined);
      change = mergeGroupNicknameChangeEntry(change, cid, nick, item);
    }
    return change;
  }

  function patchGroupThread(maskId, threadId, mutator) {
    const { readChatInboxStore, writeChatInboxStore, ensureMaskBucket, maskBucketKey } = deps();
    if (typeof mutator !== "function" || typeof readChatInboxStore !== "function" || typeof writeChatInboxStore !== "function") {
      return false;
    }
    const mid = String(maskId || "").trim();
    const tid = String(threadId || "").trim();
    if (!mid || !tid) return false;
    const inbox = readChatInboxStore();
    if (typeof ensureMaskBucket === "function") ensureMaskBucket(inbox, mid);
    const key = typeof maskBucketKey === "function" ? maskBucketKey(mid) : mid;
    const bucket = inbox.byMask[key];
    const th = (Array.isArray(bucket?.threads) ? bucket.threads : []).find((t) => t && String(t.id || "") === tid);
    if (!th) return false;
    mutator(th);
    th.updatedAt = Date.now();
    writeChatInboxStore(inbox, { fast: true });
    return true;
  }

  function applyGroupNicknameChange(maskId, threadId, thread, log, change, at) {
    const cid = String(change?.charId || "").trim();
    if (!cid || !memberCharIds(thread).includes(cid)) return false;
    const nick = normalizeGroupNicknameText(change?.groupNickname);
    const prev = groupNicknameForRef(thread, cid);
    if (prev === nick) return false;

    const ok = patchGroupThread(maskId, threadId, (t) => {
      setGroupNicknameOnThread(t, cid, nick);
      normalizeGroupThread(t);
    });
    if (!ok) return false;
    setGroupNicknameOnThread(thread, cid, nick);

    const archive = charDisplayName(cid);
    const label = nick
      ? `${archive} 将本群昵称改为「${nick}」`
      : `${archive} 清除了本群昵称`;

    if (Array.isArray(log)) {
      const thought = String(change?.heartVoice ?? "").trim().slice(0, 80);
      log.push({
        role: "notice",
        kind: "group_nickname",
        charId: cid,
        groupNickname: nick,
        at: Number(at) || Date.now(),
        label,
        ...(thought ? { heartVoice: thought } : {})
      });
      dShowToast(label);
    }

    const active = typeof deps().readActiveThread === "function" ? deps().readActiveThread() : null;
    if (active && String(active.id || "") === String(threadId || "")) {
      setGroupNicknameOnThread(active, cid, nick);
      syncChatDetailGroupPanelUi(active);
    }
    return true;
  }

  function applyCharGroupTitleChange(maskId, threadId, thread, log, change, at) {
    const title = normalizeGroupTitleText(change?.groupTitle);
    const cid = String(change?.charId || "").trim();
    if (!title || !cid || !memberCharIds(thread).includes(cid)) return false;
    const prev = normalizeGroupTitleText(thread?.groupTitle);
    if (prev === title) return false;

    const ok = patchGroupThread(maskId, threadId, (t) => {
      t.groupTitle = title;
      normalizeGroupThread(t);
    });
    if (!ok) return false;
    thread.groupTitle = title;

    if (Array.isArray(log)) {
      const nm = charDisplayName(cid);
      const thought = String(change?.heartVoice ?? "").trim().slice(0, 80);
      const notice = {
        role: "notice",
        kind: "group_rename",
        charId: cid,
        groupTitle: title,
        at: Number(at) || Date.now(),
        label: `${nm} 修改群名为「${title}」`,
        ...(thought ? { heartVoice: thought } : {})
      };
      log.push(notice);
      dShowToast(`${nm} 将群名改为「${title}」`);
    }

    const active = typeof deps().readActiveThread === "function" ? deps().readActiveThread() : null;
    if (active && String(active.id || "") === String(threadId || "")) {
      active.groupTitle = title;
      syncChatDetailGroupPanelUi(active);
    }
    const { updateChatChrome, renderChatThreadList } = deps();
    if (typeof updateChatChrome === "function") updateChatChrome();
    if (typeof renderChatThreadList === "function") renderChatThreadList();
    return true;
  }

  /**
   * 每个元素 = 一条界面气泡（可穿插不同 charId）。
   * @returns {GroupReplyItem[]}
   */
  function parseGroupReplies(raw, thread) {
    const members = memberCharIds(thread);
    const primary = String(thread.charId || "").trim() || members[0];
    const o = parseJsonLoose(raw);
    const out = [];

    /**
     * @param {string} cid
     * @param {string} text
     * @param {Partial<GroupReplyItem>} [meta]
     */
    function pushBubble(cid, text, meta) {
      const t = String(text ?? "").trim();
      const media = meta && typeof meta === "object" ? meta : {};
      const hasMedia =
        Boolean(String(media.charImageCaption || "").trim()) ||
        media.sendSticker === true ||
        Boolean(String(media.stickerKeyword || "").trim()) ||
        Boolean(media.redpackSpec);
      if (!t && !hasMedia) return;
      if (!cid) return;
      out.push({
        charId: cid,
        content: t,
        charImageCaption: String(media.charImageCaption || "").trim(),
        charImageSubject: String(media.charImageSubject || "auto").trim() || "auto",
        charImageUrl: String(media.charImageUrl || "").trim(),
        sendSticker: media.sendSticker === true,
        stickerKeyword: String(media.stickerKeyword || "").trim(),
        redpackSpec: media.redpackSpec || null
      });
    }

    if (o && Array.isArray(o.replies)) {
      for (const item of o.replies) {
        if (!item || typeof item !== "object") continue;
        if (out.length >= MAX_REPLY_ITEMS) break;
        const cid = resolveMemberRef(item.charId ?? item.id ?? item.name ?? item.speaker, thread);
        if (!cid) continue;
        const media = parseReplyItemMediaFields(item);
        const rpSpec = parseReplyRedpackFields(item, thread);
        if (rpSpec) media.redpackSpec = rpSpec;
        if (typeof item.line === "string" && item.line.trim()) {
          pushBubble(cid, item.line, media);
          continue;
        }
        if (Array.isArray(item.lines)) {
          const segs = item.lines.map((x) => String(x ?? "").trim()).filter(Boolean);
          if (segs.length === 1) {
            pushBubble(cid, segs[0], media);
          } else if (segs.length > 1) {
            for (let si = 0; si < segs.length; si++) {
              if (out.length >= MAX_REPLY_ITEMS) break;
              pushBubble(cid, segs[si], si === 0 ? media : {});
            }
          } else if (media.charImageCaption || media.sendSticker || media.redpackSpec) {
            pushBubble(cid, "", media);
          }
          continue;
        }
        if (typeof item.content === "string" && item.content.trim()) {
          pushBubble(cid, item.content, media);
        } else if (typeof item.text === "string" && item.text.trim()) {
          pushBubble(cid, item.text, media);
        } else if (typeof item.message === "string" && item.message.trim()) {
          pushBubble(cid, item.message, media);
        } else if (typeof item.reply === "string" && item.reply.trim()) {
          pushBubble(cid, item.reply, media);
        } else if (media.charImageCaption || media.sendSticker || media.redpackSpec) {
          pushBubble(cid, "", media);
        }
      }
      if (out.length) return normalizeGroupReplyOrder(out);
    }

    const altReplies = o && Array.isArray(o.messages) ? o.messages : null;
    if (altReplies) {
      for (const item of altReplies) {
        if (!item || typeof item !== "object") continue;
        if (out.length >= MAX_REPLY_ITEMS) break;
        const cid = resolveMemberRef(item.charId ?? item.id ?? item.name ?? item.speaker, thread);
        if (!cid) continue;
        const line = item.line ?? item.content ?? item.text ?? item.message ?? item.reply ?? "";
        const media = parseReplyItemMediaFields(item);
        const rpSpec = parseReplyRedpackFields(item, thread);
        if (rpSpec) media.redpackSpec = rpSpec;
        pushBubble(cid, String(line ?? ""), media);
      }
      if (out.length) return normalizeGroupReplyOrder(out);
    }

    if (o && typeof o.reply === "string" && o.reply.trim()) {
      pushBubble(primary, o.reply);
      if (out.length) return normalizeGroupReplyOrder(out);
    }

    if (o && Array.isArray(o.lines)) {
      const lines = o.lines.map((x) => String(x ?? "").trim()).filter(Boolean);
      for (const ln of lines) {
        if (out.length >= MAX_REPLY_ITEMS) break;
        pushBubble(primary, ln);
      }
      if (out.length) return normalizeGroupReplyOrder(out);
    }

    const plain = String(raw || "").trim();
    if (plain && !plain.startsWith("{")) {
      for (const ln of plain.split(/\n\n+/).map((s) => s.trim()).filter(Boolean)) {
        if (out.length >= MAX_REPLY_ITEMS) break;
        pushBubble(primary, ln);
      }
    }
    return normalizeGroupReplyOrder(out);
  }

  /** @param {GroupReplyItem[]} replies @returns {{ cid: string, len: number }[]} */
  function groupReplySpeakerRuns(replies) {
    /** @type {{ cid: string, len: number }[]} */
    const runs = [];
    for (const r of replies) {
      const cid = String(r?.charId || "").trim();
      if (!cid) continue;
      const tail = runs[runs.length - 1];
      if (tail && tail.cid === cid) tail.len++;
      else runs.push({ cid, len: 1 });
    }
    return runs;
  }

  /**
   * 模型把多人回复写成「块状堆人」时才 weave；日常连发 2～4 条保留原序。
   * @param {GroupReplyItem[]} replies
   */
  function needsGroupReplyWeave(replies) {
    const runs = groupReplySpeakerRuns(replies);
    if (runs.length < 2) return false;
    const thickBlocks = runs.filter((r) => r.len >= 3).length;
    if (thickBlocks >= 2) return true;
    if (runs.length >= 3 && runs.every((r) => r.len >= 2)) return true;
    return false;
  }

  /**
   * 块状堆人时按角色队列 zip（每人内部顺序不变），拉出真人抢话感。
   * @param {GroupReplyItem[]} replies
   * @returns {GroupReplyItem[]}
   */
  function zipMergeGroupReplyRuns(replies) {
    /** @type {{ cid: string, items: GroupReplyItem[] }[]} */
    const runs = [];
    /** @type {GroupReplyItem[]} */
    const noCid = [];
    for (const r of replies) {
      const cid = String(r?.charId || "").trim();
      if (!cid) {
        noCid.push(r);
        continue;
      }
      const tail = runs[runs.length - 1];
      if (tail && tail.cid === cid) tail.items.push(r);
      else runs.push({ cid, items: [r] });
    }
    const out = [];
    let any = true;
    while (any) {
      any = false;
      for (const run of runs) {
        if (run.items.length) {
          out.push(run.items.shift());
          any = true;
        }
      }
    }
    return out.length ? out.concat(noCid) : replies;
  }

  /** 保留模型顺序；仅「块状堆人」时 zip 穿插。 */
  function normalizeGroupReplyOrder(replies) {
    if (!Array.isArray(replies) || replies.length < 2) return replies;
    const speakers = new Set(replies.map((r) => String(r?.charId || "").trim()).filter(Boolean));
    if (speakers.size <= 1) return replies;
    if (!needsGroupReplyWeave(replies)) return replies;
    return zipMergeGroupReplyRuns(replies);
  }

  /** 群聊在场人数：角色成员 + 主控（你） */
  function groupParticipantCount(thread) {
    return memberCharIds(thread).length + 1;
  }

  /** 列表/顶栏用：群名 + 人数，如「工作群 (4)」（含主控） */
  function groupThreadDisplayTitle(thread) {
    const g = String(thread?.groupTitle || "").trim() || "群聊";
    const n = groupParticipantCount(thread);
    return n > 1 ? `${g} (${n})` : g;
  }

  /** 空输入点发送：与单聊 buildChatApiMessages 末尾逻辑一致 */
  function appendGroupEmptySendTail(hist, opts) {
    const custom = String(opts?.emptySendUserContent || "").trim();
    const afterAsst =
      String(deps().CHAT_API_EMPTY_AFTER_ASSISTANT || "").trim() ||
      "（界面代发、勿复述本句：对方没打新字，请你接着上文像真人一样自然接话。）";
    const opening =
      String(deps().CHAT_API_EMPTY_OPENING || "").trim() ||
      "（界面代发、勿复述本句：对方还没发第一句，请你抛一句自然开场或接应。）";
    if (custom) {
      hist.push({ role: "user", content: custom.slice(0, 8000) });
      return;
    }
    const last = hist.length ? hist[hist.length - 1] : null;
    if (!last) {
      hist.push({ role: "user", content: opening });
    } else if (last.role === "assistant") {
      hist.push({ role: "user", content: afterAsst });
    }
  }

  /**
   * @param {object} opts
   * @param {HTMLButtonElement|null} btn
   * @param {{ thSend0: object, roundMaskId: string, roundThreadId: string, roundDmSurface: string }} ctx
   */
  async function runAssistantRound(opts, btn, ctx) {
    const {
      readChatLogForMaskThread,
      saveChatLogForMaskThread,
      readChatLogForApiForMaskThread,
      scheduleChatUiRefreshForRound,
      removeChatRestoringPlaceholders,
      clearAssistantRestoringFlagsInLog,
      rememberChatApiUsage,
      scheduleChatContextTokenLabelUpdate,
      readUserMask,
      requestChatAssistantCompletion,
      readChatCompletionChoiceText
    } = deps();

    const ai = window.RP_AI;
    if (!ai) {
      dShowToast("AI 模块未加载");
      return;
    }

    const roundMaskId = ctx.roundMaskId;
    const roundThreadId = ctx.roundThreadId;
    const thread = normalizeGroupThread({ ...ctx.thSend0 });

    if (ctx.roundDmSurface === "offline") {
      dShowToast("群聊请用即时消息");
      return;
    }

    try {
      const mask = typeof readUserMask === "function" ? readUserMask() : { displayName: "主控" };
      const apiLog =
        typeof readChatLogForApiForMaskThread === "function"
          ? readChatLogForApiForMaskThread("im", roundMaskId, roundThreadId)
          : typeof readChatLogForMaskThread === "function"
            ? readChatLogForMaskThread(roundMaskId, roundThreadId)
            : [];

      let typingInserted = false;
      try {
        const liveLog =
          typeof readChatLogForMaskThread === "function"
            ? readChatLogForMaskThread(roundMaskId, roundThreadId)
            : [];
        liveLog.push({
          role: "assistant",
          content: "",
          at: Date.now(),
          restoring: true,
          groupTypingMembers: memberCharIds(thread)
        });
        if (typeof saveChatLogForMaskThread === "function") {
          saveChatLogForMaskThread(roundMaskId, roundThreadId, liveLog);
        }
        typingInserted = true;
        if (typeof scheduleChatUiRefreshForRound === "function") {
          scheduleChatUiRefreshForRound(roundMaskId, roundThreadId);
        }
      } catch (_) {
        /* ignore */
      }

      if (btn) btn.disabled = true;

      if (typeof deps().normalizeAssistantQuoteStorageInLog === "function") {
        deps().normalizeAssistantQuoteStorageInLog(apiLog);
      }
      const sysBase = buildGroupSystemPrompt(thread, mask);
      const rpBlock = buildRedpackContextForPrompt(thread, apiLog);
      const timeBlock = deps().buildThreadTimeAwarenessForPrompt?.(thread, mask, apiLog) || "";
      const sys = [sysBase, rpBlock, timeBlock].filter(Boolean).join("\n\n");
      const hist = buildGroupLogMessages(thread, apiLog, mask);
      appendGroupEmptySendTail(hist, opts);

      const apiMessages = [{ role: "system", content: sys }, ...hist.slice(-48)];

      const data =
        typeof requestChatAssistantCompletion === "function"
          ? await requestChatAssistantCompletion(ai, {
              messages: apiMessages,
              max_tokens: GROUP_ROUND_MAX_TOKENS,
              response_format: { type: "json_object" }
            })
          : await ai.chatCompletions({
              messages: apiMessages,
              max_tokens: GROUP_ROUND_MAX_TOKENS,
              response_format: { type: "json_object" }
            });

      if (typeof rememberChatApiUsage === "function") rememberChatApiUsage(data?.usage);
      if (typeof scheduleChatContextTokenLabelUpdate === "function") scheduleChatContextTokenLabelUpdate();

      const raw =
        (typeof readChatCompletionChoiceText === "function"
          ? readChatCompletionChoiceText(data)
          : data?.choices?.[0]?.message?.content) || "";

      const parsedRoot = parseJsonLoose(raw);
      const replies = parseGroupReplies(raw, thread);
      const titleChange = parseGroupTitleChange(parsedRoot, thread);
      const nickChange = parseGroupNicknameChange(parsedRoot, thread);
      const next =
        typeof readChatLogForMaskThread === "function" ? readChatLogForMaskThread(roundMaskId, roundThreadId) : [];

      if (typingInserted && typeof removeChatRestoringPlaceholders === "function") {
        removeChatRestoringPlaceholders(next);
      }
      if (typeof clearAssistantRestoringFlagsInLog === "function") clearAssistantRestoringFlagsInLog(next);

      if (!replies.length && !titleChange && !nickChange) {
        if (typeof saveChatLogForMaskThread === "function") {
          saveChatLogForMaskThread(roundMaskId, roundThreadId, next);
        }
        if (typeof scheduleChatUiRefreshForRound === "function") {
          scheduleChatUiRefreshForRound(roundMaskId, roundThreadId, { flush: true });
        }
        dShowToast("模型未返回群成员回复，可再发一次试试");
        return;
      }

      const baseAt = Date.now();
      for (let i = 0; i < replies.length; i++) {
        const r = replies[i];
        const rows = buildGroupAssistantLogEntries(r, thread, next, baseAt + i);
        for (const row of rows) next.push(row);
      }

      if (parsedRoot && Array.isArray(parsedRoot.redpackActions)) {
        processRedpackActions(next, parsedRoot.redpackActions);
      }

      if (titleChange) {
        applyCharGroupTitleChange(
          roundMaskId,
          roundThreadId,
          thread,
          next,
          titleChange,
          baseAt + replies.length
        );
      }

      if (nickChange) {
        applyGroupNicknameChange(
          roundMaskId,
          roundThreadId,
          thread,
          next,
          nickChange,
          baseAt + replies.length + (titleChange ? 1 : 0)
        );
      }

      if (typeof saveChatLogForMaskThread === "function") {
        saveChatLogForMaskThread(roundMaskId, roundThreadId, next);
      }
      if (typeof scheduleChatUiRefreshForRound === "function") {
        scheduleChatUiRefreshForRound(roundMaskId, roundThreadId, { animateLatest: true, flush: true });
      }
      const kickoff = deps().kickoffPendingSessionImageGen;
      if (typeof kickoff === "function") {
        kickoff(next, { maskId: roundMaskId, threadId: roundThreadId });
      }
    } catch (err) {
      console.warn("[group] round failed", err);
      const msg = err instanceof Error ? err.message : String(err);
      dShowToast(msg ? `群聊回复失败：${msg.slice(0, 80)}` : "群聊回复失败");
      try {
        const roundMaskId = ctx.roundMaskId;
        const roundThreadId = ctx.roundThreadId;
        const next =
          typeof deps().readChatLogForMaskThread === "function"
            ? deps().readChatLogForMaskThread(roundMaskId, roundThreadId)
            : [];
        if (typeof removeChatRestoringPlaceholders === "function") {
          removeChatRestoringPlaceholders(next);
        }
        if (typeof clearAssistantRestoringFlagsInLog === "function") {
          clearAssistantRestoringFlagsInLog(next);
        }
        if (typeof saveChatLogForMaskThread === "function") {
          saveChatLogForMaskThread(roundMaskId, roundThreadId, next);
        }
        if (typeof scheduleChatUiRefreshForRound === "function") {
          scheduleChatUiRefreshForRound(roundMaskId, roundThreadId, { flush: true });
        }
      } catch (_) {
        /* ignore */
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function expandAssistantContentForApi(m, body, promptThread) {
    if (!isGroupThread(promptThread) || !m || m.role !== "assistant") return null;
    const cid = speakerCharIdFromMessage(m, promptThread);
    const nm = charDisplayName(cid);
    const b = String(body ?? "").trim();
    return b ? `【${nm}】\n${b}` : `【${nm}】`;
  }

  function resolveVoiceCharId(msg, thread) {
    if (!isGroupThread(thread)) return "";
    return speakerCharIdFromMessage(msg, thread);
  }

  function charAvatarUrl(charId) {
    const it = charItemById(charId);
    const u = it && String(it.avatar || "").trim();
    return u || "";
  }

  function charInitial(charId) {
    return charDisplayName(charId).trim().slice(0, 1) || "?";
  }

  function groupSpeakerAccentColor(charId) {
    let h = 0;
    const s = String(charId || "");
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    const hue = ((h % 360) + 360) % 360;
    return `hsl(${hue} 52% 46%)`;
  }

  function buildGroupSpeakerLabelEl(thread, charId) {
    const lab = document.createElement("div");
    lab.className = "chat-msg-group-speaker chat-msg-group-speaker--classic";
    lab.dataset.charId = charId;
    lab.style.setProperty("--group-speaker-accent", groupSpeakerAccentColor(charId));

    const nm = document.createElement("span");
    nm.className = "chat-msg-group-speaker-name";
    const label = groupCallNameForRef(thread, charId);
    nm.textContent = label;
    nm.title = label;

    lab.appendChild(nm);
    return lab;
  }

  function mountGroupGlassSpeakerName(row, thread, charId) {
    if (!row || !charId) return;
    const label = groupCallNameForRef(thread, charId);
    const accent = groupSpeakerAccentColor(charId);
    for (const col of row.querySelectorAll(".chat-msg-avatar-col")) {
      let nm = col.querySelector(".chat-msg-group-glass-speaker-name");
      if (!nm) {
        nm = document.createElement("span");
        nm.className = "chat-msg-group-glass-speaker-name";
        const meta = col.querySelector(".chat-msg-meta");
        if (meta) col.insertBefore(nm, meta);
        else col.appendChild(nm);
      }
      nm.textContent = label;
      nm.title = label;
      nm.style.setProperty("--group-speaker-accent", accent);
    }
  }

  function clearGroupGlassSpeakerName(row) {
    if (!row) return;
    row.querySelectorAll(".chat-msg-group-glass-speaker-name").forEach((el) => el.remove());
  }

  function isChatGlassTheme() {
    const fn = deps().isChatScreenThemeGlassActive;
    if (typeof fn === "function") return fn();
    const scr = document.getElementById("chat-screen");
    return !!(scr && scr.classList.contains("chat-screen--theme-glass"));
  }

  function mountAvatarInSlot(slot, avEl) {
    if (!slot || !avEl) return;
    const old = slot.querySelector(
      ".chat-msg-avatar, .chat-msg-avatar--group-collage, .chat-msg-avatar--group-single"
    );
    if (old) old.replaceWith(avEl);
    else slot.insertBefore(avEl, slot.firstChild);
  }

  function applyGroupRowSideAvatars(row, avFactory) {
    const av = avFactory();
    if (!av) return false;
    const cols = row.querySelectorAll(".chat-msg-avatar-col");
    if (cols.length) {
      for (const col of cols) mountAvatarInSlot(col, av.cloneNode(true));
      return true;
    }
    const inner = row.querySelector(".chat-msg-inner");
    if (!inner) return false;
    const direct = inner.querySelector(
      ":scope > .chat-msg-avatar, :scope > .chat-msg-avatar--group-collage, :scope > .chat-msg-avatar--group-single, :scope > .chat-msg-avatar--group-icon"
    );
    if (direct) mountAvatarInSlot(inner, av.cloneNode(true));
    return true;
  }

  function clearGroupRowSideAvatars(row) {
    row.querySelectorAll(".chat-msg-avatar-col .chat-msg-avatar").forEach((el) => el.remove());
    const inner = row.querySelector(".chat-msg-inner");
    if (!inner) return;
    inner
      .querySelectorAll(
        ":scope > .chat-msg-avatar, :scope > .chat-msg-avatar--group-collage, :scope > .chat-msg-avatar--group-single, :scope > .chat-msg-avatar--group-icon"
      )
      .forEach((el) => el.remove());
  }

  function applyGroupSpeakerRowStyle(row, charId) {
    if (!row || !charId) return;
    row.dataset.speakerId = charId;
    row.style.setProperty("--group-speaker-accent", groupSpeakerAccentColor(charId));
    for (const stack of row.querySelectorAll(".chat-msg-bubble-stack")) {
      for (const el of stack.querySelectorAll(
        ".chat-msg-bubble:not(.chat-msg-bubble--typing), .chat-msg-card"
      )) {
        el.classList.add("chat-msg-bubble--group-speaker");
      }
    }
  }

  function clearGroupSpeakerRowStyle(row) {
    if (!row) return;
    delete row.dataset.speakerId;
    row.style.removeProperty("--group-speaker-accent");
    row.querySelectorAll(".chat-msg-bubble--group-speaker").forEach((el) => {
      el.classList.remove("chat-msg-bubble--group-speaker");
    });
  }

  function buildGroupSingleAvatarEl(charId, thread) {
    const url = charAvatarUrl(charId);
    const name = thread ? groupCallNameForRef(thread, charId) : charDisplayName(charId);
    if (url) {
      const im = document.createElement("img");
      im.className = "chat-msg-avatar chat-msg-avatar--image chat-msg-avatar--group-single";
      im.alt = name;
      im.src = url;
      im.title = name;
      return im;
    }
    const av = document.createElement("div");
    av.className = "chat-msg-avatar chat-msg-avatar--ph chat-msg-avatar--group-single";
    av.textContent = charInitial(charId);
    av.title = name;
    return av;
  }

  function buildCollageCell(charId) {
    const cell = document.createElement("span");
    cell.className = "chat-msg-avatar-collage-cell";
    cell.title = charDisplayName(charId);
    const url = charAvatarUrl(charId);
    if (url) {
      const im = document.createElement("img");
      im.alt = "";
      im.src = url;
      cell.appendChild(im);
    } else {
      cell.textContent = charInitial(charId);
      cell.classList.add("chat-msg-avatar-collage-cell--letter");
    }
    return cell;
  }

  /**
   * @param {string[]} charIds
   * @param {{ forHeader?: boolean }} [options] forHeader：身份卡拼图（勿用 .chat-msg-avatar）
   */
  function buildGroupAvatarCollageEl(charIds, options) {
    const forHeader = options?.forHeader === true;
    const ids = [...new Set(charIds.map((x) => String(x || "").trim()).filter(Boolean))];
    if (!ids.length) return null;
    if (ids.length === 1) return forHeader ? null : buildGroupSingleAvatarEl(ids[0]);

    const wrap = document.createElement("div");
    const sizePrefix = forHeader ? "chat-header-group-collage" : "chat-msg-avatar--group-collage";
    wrap.className = forHeader
      ? "chat-header-group-collage"
      : "chat-msg-avatar chat-msg-avatar--group-collage";
    wrap.setAttribute("aria-label", ids.map(charDisplayName).join("、"));

    if (ids.length <= 4) {
      wrap.classList.add(`${sizePrefix}-n${ids.length}`);
      for (const id of ids) wrap.appendChild(buildCollageCell(id));
    } else {
      wrap.classList.add(`${sizePrefix}-n4`);
      for (const id of ids.slice(0, 3)) wrap.appendChild(buildCollageCell(id));
      const more = document.createElement("span");
      more.className = "chat-msg-avatar-collage-cell chat-msg-avatar-collage-cell--more";
      more.textContent = `+${ids.length - 3}`;
      more.title = ids
        .slice(3)
        .map(charDisplayName)
        .join("、");
      wrap.appendChild(more);
    }
    return wrap;
  }

  function readGroupAvatarUrl(thread) {
    return String(thread?.groupAvatar || "").trim();
  }

  /**
   * 经典顶栏身份卡左侧：群自定义头像，或成员拼图；非单聊 char 头像。
   * @param {object} thread
   * @param {HTMLElement | null} face
   * @param {HTMLImageElement | null} img
   * @param {HTMLElement | null} initial
   */
  function applyGroupIdentityHeaderFace(thread, face, img, initial) {
    if (!face) return;
    face.querySelector(".chat-header-group-collage")?.remove();
    face.classList.remove("chat-header-face--group-collage");
    face.classList.add("chat-header-face--group");

    const initChar = String(thread?.groupTitle || "").trim().slice(0, 1) || "群";
    const custom = readGroupAvatarUrl(thread);

    if (custom && img) {
      img.src = custom;
      img.classList.remove("is-hidden");
      face.classList.add("has-photo");
      face.classList.remove("chat-header-face--group-collage");
      if (initial) initial.textContent = initChar;
      return;
    }

    const collageIds = memberCharIds(thread);
    const collage = buildGroupAvatarCollageEl(collageIds, { forHeader: true });
    if (collage) {
      if (img) {
        img.removeAttribute("src");
        img.classList.add("is-hidden");
      }
      face.classList.remove("has-photo");
      face.classList.add("chat-header-face--group-collage");
      if (initial) initial.textContent = initChar;
      face.appendChild(collage);
      return;
    }

    const oneId = collageIds[0] || "";
    const oneUrl = oneId ? charAvatarUrl(oneId) : "";
    if (oneUrl && img) {
      img.src = oneUrl;
      img.classList.remove("is-hidden");
      face.classList.add("has-photo");
      face.classList.remove("chat-header-face--group-collage");
      if (initial) initial.textContent = charInitial(oneId);
      return;
    }

    if (img) {
      img.removeAttribute("src");
      img.classList.add("is-hidden");
    }
    face.classList.remove("has-photo", "chat-header-face--group-collage");
    if (initial) initial.textContent = initChar;
  }

  const MAX_GROUP_AVATAR_BYTES = 900000;

  function readImageFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file || !String(file.type || "").startsWith("image/")) {
        reject(new Error("not_image"));
        return;
      }
      if (file.size > MAX_GROUP_AVATAR_BYTES) {
        reject(new Error("too_large"));
        return;
      }
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("read_fail"));
      fr.readAsDataURL(file);
    });
  }

  /** 单条群成员 assistant 行：纠正头像 / 发言人样式（渲染复用 DOM 后也会调用）。 */
  function refreshGroupAssistantRowPresentation(row, m, thread) {
    if (!row || !(row instanceof HTMLElement)) return;
    if (!isGroupThread(thread) || !m || m.role !== "assistant") return;
    if (m.restoring && !String(m.content || "").trim()) return;
    const cid = speakerCharIdFromMessage(m, thread);
    if (!cid) return;
    const themeGlass = isChatGlassTheme();
    clearGroupSpeakerRowStyle(row);
    clearGroupGlassSpeakerName(row);
    if (!themeGlass) clearGroupRowSideAvatars(row);
    if (themeGlass) {
      applyGroupRowSideAvatars(row, () => buildGroupSingleAvatarEl(cid, thread));
      mountGroupGlassSpeakerName(row, thread, cid);
    }
    applyGroupSpeakerRowStyle(row, cid);
    if (!themeGlass) {
      for (const stack of row.querySelectorAll(".chat-msg-bubble-stack")) {
        stack.querySelector(".chat-msg-group-speaker")?.remove();
      }
      const primaryStack = row.querySelector(".chat-msg-bubble-stack");
      if (primaryStack) {
        primaryStack.insertBefore(buildGroupSpeakerLabelEl(thread, cid), primaryStack.firstChild);
      }
    }
  }

  function decorateMessageDom(thread) {
    if (!isGroupThread(thread)) return;
    const readLog = deps().readChatLog;
    const log = typeof readLog === "function" ? readLog() : [];
    const root = document.getElementById("chat-messages");
    if (!root) return;
    const themeGlass = isChatGlassTheme();

    for (const row of root.querySelectorAll(".chat-msg--assistant")) {
      const idx = Number(row.dataset.chatMsgIdx);
      if (!Number.isFinite(idx) || idx < 0 || idx >= log.length) continue;
      const m = log[idx];
      if (!m || m.role !== "assistant") continue;

      row.classList.add("chat-msg--group-assistant");
      row.classList.toggle("chat-msg--group-glass", themeGlass);
      row.classList.toggle("chat-msg--group-classic", !themeGlass);

      const isGroupTyping = Boolean(m.restoring && !String(m.content || "").trim());
      const typingMembers = isGroupTyping
        ? (Array.isArray(m.groupTypingMembers) && m.groupTypingMembers.length
            ? m.groupTypingMembers
            : memberCharIds(thread))
        : [];
      if (isGroupTyping) {
        clearGroupSpeakerRowStyle(row);
        if (!themeGlass) clearGroupRowSideAvatars(row);
        const stacks = row.querySelectorAll(".chat-msg-bubble-stack");
        for (const stack of stacks) {
          stack.querySelector(".chat-msg-group-speaker")?.remove();
        }
        const primaryStack = stacks[0] || row.querySelector(".chat-msg-bubble-stack");
        if (primaryStack) {
          const lab = document.createElement("div");
          lab.className = "chat-msg-group-speaker chat-msg-group-speaker--pending";
          const names = typingMembers.map((id) => groupCallNameForRef(thread, id));
          lab.textContent = names.length ? `${names.join("、")} 正在回复…` : "群成员正在回复…";
          primaryStack.insertBefore(lab, primaryStack.firstChild);
        }
        row.classList.add("chat-msg--group-typing");
        if (themeGlass) {
          applyGroupRowSideAvatars(row, () => buildGroupAvatarCollageEl(typingMembers));
        }
        continue;
      }

      row.classList.remove("chat-msg--group-typing");
      refreshGroupAssistantRowPresentation(row, m, thread);
    }
  }

  /* —— 建群 UI —— */
  let sheetEl = null;
  let pickSelected = new Set();
  let pickGroupAvatarDataUrl = "";
  let createSheetAvatarBound = false;

  function resetCreateGroupAvatarPick() {
    pickGroupAvatarDataUrl = "";
    const prev = sheetEl?.querySelector("#group-chat-avatar-preview");
    const file = sheetEl?.querySelector("#group-chat-avatar-file");
    const clearBtn = sheetEl?.querySelector("#group-chat-avatar-clear");
    if (prev instanceof HTMLElement) {
      prev.hidden = true;
      prev.replaceChildren();
    }
    if (file instanceof HTMLInputElement) file.value = "";
    if (clearBtn instanceof HTMLElement) clearBtn.hidden = true;
  }

  function syncCreateGroupAvatarPreview() {
    const prev = sheetEl?.querySelector("#group-chat-avatar-preview");
    const clearBtn = sheetEl?.querySelector("#group-chat-avatar-clear");
    if (!(prev instanceof HTMLElement)) return;
    prev.replaceChildren();
    if (pickGroupAvatarDataUrl) {
      const im = document.createElement("img");
      im.alt = "群头像预览";
      im.src = pickGroupAvatarDataUrl;
      prev.appendChild(im);
      prev.hidden = false;
      if (clearBtn instanceof HTMLElement) clearBtn.hidden = false;
    } else {
      prev.hidden = true;
      if (clearBtn instanceof HTMLElement) clearBtn.hidden = true;
    }
  }

  function bindCreateGroupAvatarPick() {
    if (createSheetAvatarBound || !sheetEl) return;
    createSheetAvatarBound = true;
    const pickBtn = sheetEl.querySelector("#group-chat-avatar-pick");
    const fileInp = sheetEl.querySelector("#group-chat-avatar-file");
    const clearBtn = sheetEl.querySelector("#group-chat-avatar-clear");
    pickBtn?.addEventListener("click", () => {
      if (fileInp instanceof HTMLInputElement) fileInp.click();
    });
    fileInp?.addEventListener("change", async () => {
      const f = fileInp instanceof HTMLInputElement ? fileInp.files?.[0] : null;
      if (!f) return;
      try {
        pickGroupAvatarDataUrl = await readImageFileAsDataUrl(f);
        syncCreateGroupAvatarPreview();
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        if (code === "too_large") dShowToast("群头像请小于 900KB");
        else dShowToast("无法读取图片");
        fileInp.value = "";
      }
    });
    clearBtn?.addEventListener("click", () => {
      resetCreateGroupAvatarPick();
    });
  }

  function ensureSheet() {
    if (sheetEl) return sheetEl;
    const root = document.createElement("div");
    root.id = "group-chat-sheet";
    root.className = "group-chat-sheet";
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="group-chat-sheet-panel" role="dialog" aria-labelledby="group-chat-sheet-title">
        <div class="group-chat-sheet-head">
          <h2 class="group-chat-sheet-title" id="group-chat-sheet-title">新建群聊</h2>
          <button type="button" class="group-chat-sheet-close" aria-label="关闭"><i class="ph ph-x"></i></button>
        </div>
        <div class="group-chat-sheet-body">
          <div class="group-chat-sheet-field">
            <label for="group-chat-title-input">群名称</label>
            <input type="text" id="group-chat-title-input" maxlength="32" placeholder="例如：宿舍三人组" />
          </div>
          <div class="group-chat-sheet-field group-chat-sheet-field--avatar">
            <span class="group-chat-sheet-field-label">群头像（可选）</span>
            <div class="group-chat-avatar-pick-row">
              <button type="button" class="chip ghost chip-xs" id="group-chat-avatar-pick">选择图片</button>
              <button type="button" class="chip ghost chip-xs" id="group-chat-avatar-clear" hidden>清除</button>
              <input type="file" id="group-chat-avatar-file" accept="image/*" hidden />
            </div>
            <div id="group-chat-avatar-preview" class="group-chat-avatar-preview" hidden aria-hidden="true"></div>
            <p class="group-chat-sheet-hint group-chat-sheet-hint--tight">未设置时，经典主题身份区左侧显示成员拼图。</p>
          </div>
          <p class="group-chat-sheet-hint">勾选至少 ${MIN_MEMBERS} 位角色。</p>
          <ul class="group-chat-member-list" id="group-chat-member-list"></ul>
        </div>
        <div class="group-chat-sheet-foot">
          <button type="button" class="chip primary group-chat-sheet-submit" id="group-chat-submit">创建群聊</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener("click", (e) => {
      if (e.target === root) closeGroupCreateSheet();
    });
    root.querySelector(".group-chat-sheet-close")?.addEventListener("click", () => closeGroupCreateSheet());
    root.querySelector("#group-chat-submit")?.addEventListener("click", () => submitGroupCreate());
    sheetEl = root;
    bindCreateGroupAvatarPick();
    return root;
  }

  function closeGroupCreateSheet() {
    if (!sheetEl) return;
    sheetEl.hidden = true;
    sheetEl.setAttribute("aria-hidden", "true");
  }

  function openGroupCreateSheet() {
    const maskFn = deps().getActiveMaskIdForInbox;
    const maskId = typeof maskFn === "function" ? String(maskFn() || "").trim() : "";
    if (!maskId) {
      dShowToast("请先创建并选择一个主控面具");
      return;
    }
    const st = readCharStore();
    const items = (st.items || []).filter((x) => x && String(x.id || "").trim());
    if (items.length < MIN_MEMBERS) {
      dShowToast(`角色库至少要有 ${MIN_MEMBERS} 个角色才能建群`);
      return;
    }

    pickSelected = new Set();
    resetCreateGroupAvatarPick();
    const root = ensureSheet();
    const list = root.querySelector("#group-chat-member-list");
    const titleInp = root.querySelector("#group-chat-title-input");
    if (titleInp instanceof HTMLInputElement) titleInp.value = "新群聊";
    if (!list) return;
    list.replaceChildren();

    for (const it of items) {
      const id = String(it.id || "");
      const li = document.createElement("li");
      li.className = "group-chat-member-item";
      li.dataset.charId = id;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.addEventListener("click", (e) => e.stopPropagation());

      const avUrl = String(it.avatar || "").trim();
      let av;
      if (avUrl) {
        av = document.createElement("img");
        av.className = "group-chat-member-av";
        av.src = avUrl;
        av.alt = "";
      } else {
        av = document.createElement("span");
        av.className = "group-chat-member-av group-chat-member-av--letter";
        av.textContent = (String(it.displayName || "?").trim().slice(0, 1) || "?");
      }

      const meta = document.createElement("div");
      meta.className = "group-chat-member-meta";
      const nm = document.createElement("div");
      nm.className = "group-chat-member-name";
      nm.textContent = String(it.displayName || "未命名");
      meta.append(nm);

      li.append(cb, av, meta);
      li.addEventListener("click", () => {
        if (!(cb instanceof HTMLInputElement)) return;
        cb.checked = !cb.checked;
        if (cb.checked) pickSelected.add(id);
        else pickSelected.delete(id);
        renderPickState(list);
      });
      cb.addEventListener("change", () => {
        if (cb.checked) pickSelected.add(id);
        else pickSelected.delete(id);
        renderPickState(list);
      });
      list.appendChild(li);
    }
    renderPickState(list);
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    if (titleInp instanceof HTMLInputElement) titleInp.focus();
  }

  function renderPickState(list) {
    for (const li of list.querySelectorAll(".group-chat-member-item")) {
      const id = String(li.dataset.charId || "");
      const cb = li.querySelector('input[type="checkbox"]');
      const on = pickSelected.has(id);
      if (cb instanceof HTMLInputElement) cb.checked = on;
      li.classList.toggle("is-selected", on);
    }
  }

  function submitGroupCreate() {
    const root = sheetEl;
    const titleInp = root?.querySelector("#group-chat-title-input");
    const title =
      titleInp instanceof HTMLInputElement ? String(titleInp.value || "").trim() : "";
    if (!title) {
      dShowToast("群名不能为空");
      return;
    }
    const members = [];
    const listRoot = sheetEl?.querySelector("#group-chat-member-list");
    if (listRoot) {
      for (const li of listRoot.querySelectorAll(".group-chat-member-item")) {
        const id = String(li.dataset.charId || "").trim();
        if (id && pickSelected.has(id)) members.push(id);
      }
    }
    if (members.length < MIN_MEMBERS) {
      for (const id of pickSelected) {
        if (!members.includes(id)) members.push(id);
      }
    }
    if (members.length < MIN_MEMBERS) {
      dShowToast(`请至少选择 ${MIN_MEMBERS} 位成员`);
      return;
    }
    const anchorCharId = members[0];

    const {
      readChatInboxStore,
      writeChatInboxStore,
      ensureMaskBucket,
      maskBucketKey,
      getActiveMaskIdForInbox,
      writeChatActiveThreadRef,
      newEntityId,
      getCharMainWorldBookVolumeIds,
      renderChatThreadList,
      openChatScreen
    } = deps();

    const maskId =
      typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "";
    if (!maskId) {
      dShowToast("请先选择主控面具");
      return;
    }
    if (typeof readChatInboxStore !== "function" || typeof writeChatInboxStore !== "function") {
      dShowToast("数据库未就绪");
      return;
    }

    const inbox = readChatInboxStore();
    if (typeof ensureMaskBucket === "function") ensureMaskBucket(inbox, maskId);
    const key = typeof maskBucketKey === "function" ? maskBucketKey(maskId) : maskId;
    const bucket = inbox.byMask[key];
    const id = typeof newEntityId === "function" ? newEntityId() : `g_${Date.now()}`;
    const itWb = charItemById(anchorCharId);
    const wbIds =
      typeof getCharMainWorldBookVolumeIds === "function" ? getCharMainWorldBookVolumeIds(itWb) : [];

    bucket.threads.push({
      id,
      charId: anchorCharId,
      kind: "group",
      groupTitle: title,
      memberCharIds: members,
      messages: [],
      heartVoiceEnabled: false,
      ...(pickGroupAvatarDataUrl ? { groupAvatar: pickGroupAvatarDataUrl } : {}),
      ...(wbIds.length ? { worldBookVolumeIds: wbIds.slice() } : {}),
      updatedAt: Date.now()
    });
    writeChatInboxStore(inbox);
    if (typeof writeChatActiveThreadRef === "function") {
      writeChatActiveThreadRef({ maskId, threadId: id });
    }

    closeGroupCreateSheet();
    resetCreateGroupAvatarPick();
    if (typeof renderChatThreadList === "function") renderChatThreadList();
    if (typeof openChatScreen === "function") openChatScreen();
    dShowToast(`已创建群聊「${title}」`);
  }

  function enableGroupUi() {
    document.getElementById("chat-thread-kind-group")?.classList.remove("chat-feature-soon");
    document.getElementById("chat-thread-add-group")?.classList.remove("chat-feature-soon");
    const empty = document.getElementById("chat-thread-empty-all");
    if (empty) {
      empty.textContent = "当前面具下还没有密谈。点「＋」单聊，或点人群图标建群。";
    }
  }

  function patchGroupActiveThread(mutator) {
    const patch = deps().patchActiveThread;
    if (typeof patch !== "function") return false;
    let touched = false;
    const ok = patch((th) => {
      if (!isGroupThread(th)) return;
      if (th.kind !== "group") th.kind = "group";
      mutator(th);
      normalizeGroupThread(th);
      touched = true;
    });
    return ok && touched;
  }

  /** @param {object|null|undefined} thread */
  function syncChatDetailGroupPanelUi(thread) {
    const isGroup = isGroupThread(thread);
    const root = document.getElementById("chat-detail-group-fields");
    if (root) root.hidden = !isGroup;
    ensureGroupDetailAvatarField();
    if (!isGroup) return;
    const titleInp = document.getElementById("chat-detail-group-title-input");
    if (titleInp instanceof HTMLInputElement) {
      titleInp.value = String(thread.groupTitle || "").trim() || "群聊";
    }
    syncGroupDetailAvatarPreview(thread);
    renderChatDetailGroupMemberList(thread);
  }

  let detailAvatarFieldBound = false;

  function ensureGroupDetailAvatarField() {
    const host = document.getElementById("chat-detail-group-fields");
    if (!host || document.getElementById("chat-detail-group-avatar-wrap")) return;
    const titleField = document.getElementById("chat-detail-group-title-input")?.closest(".chat-detail-field");
    const wrap = document.createElement("div");
    wrap.className = "chat-detail-field";
    wrap.id = "chat-detail-group-avatar-wrap";
    wrap.innerHTML = `
      <div class="chat-detail-scene-head">
        <span class="chat-detail-field-k chat-detail-field-k--label">群头像</span>
        <button type="button" class="chip ghost chip-xs" id="chat-detail-group-avatar-clear" hidden>清除</button>
      </div>
      <div class="group-chat-avatar-pick-row">
        <button type="button" class="chip ghost chip-xs" id="chat-detail-group-avatar-pick">更换图片</button>
        <input type="file" id="chat-detail-group-avatar-file" accept="image/*" hidden />
      </div>
      <img id="chat-detail-group-avatar-preview-img" class="group-chat-avatar-preview-img" alt="" hidden />
      <p class="chat-detail-lead chat-detail-lead--compact">未设置时，经典主题身份区左侧显示成员拼图。</p>`;
    if (titleField?.nextElementSibling) host.insertBefore(wrap, titleField.nextElementSibling);
    else host.appendChild(wrap);
    if (!detailAvatarFieldBound) {
      detailAvatarFieldBound = true;
      document.getElementById("chat-detail-group-avatar-pick")?.addEventListener("click", () => {
        document.getElementById("chat-detail-group-avatar-file")?.click();
      });
      document.getElementById("chat-detail-group-avatar-file")?.addEventListener("change", async (e) => {
        const inp = e.target;
        const f = inp instanceof HTMLInputElement ? inp.files?.[0] : null;
        if (!f) return;
        try {
          const url = await readImageFileAsDataUrl(f);
          saveGroupAvatarToActiveThread(url);
          dShowToast("群头像已保存");
        } catch (err) {
          const code = err instanceof Error ? err.message : "";
          if (code === "too_large") dShowToast("群头像请小于 900KB");
          else dShowToast("无法读取图片");
        }
        if (inp instanceof HTMLInputElement) inp.value = "";
      });
      document.getElementById("chat-detail-group-avatar-clear")?.addEventListener("click", () => {
        saveGroupAvatarToActiveThread("");
        dShowToast("已清除群头像");
      });
    }
  }

  function syncGroupDetailAvatarPreview(thread) {
    const im = document.getElementById("chat-detail-group-avatar-preview-img");
    const clearBtn = document.getElementById("chat-detail-group-avatar-clear");
    const url = readGroupAvatarUrl(thread);
    if (im instanceof HTMLImageElement) {
      if (url) {
        im.src = url;
        im.hidden = false;
      } else {
        im.removeAttribute("src");
        im.hidden = true;
      }
    }
    if (clearBtn instanceof HTMLElement) clearBtn.hidden = !url;
  }

  function saveGroupAvatarToActiveThread(dataUrl) {
    const url = String(dataUrl || "").trim();
    const ok = patchGroupActiveThread((t) => {
      if (url) t.groupAvatar = url;
      else delete t.groupAvatar;
    });
    if (!ok) return;
    const th = readActiveThread();
    syncGroupDetailAvatarPreview(th);
    const { scheduleRenderChatMessages, renderChatThreadList, updateChatChrome } = deps();
    if (typeof scheduleRenderChatMessages === "function") scheduleRenderChatMessages();
    if (typeof renderChatThreadList === "function") renderChatThreadList();
    if (typeof updateChatChrome === "function") updateChatChrome();
  }

  function saveGroupTitleFromDetailInput() {
    const el = document.getElementById("chat-detail-group-title-input");
    if (!(el instanceof HTMLInputElement)) return false;
    const title = String(el.value || "").trim().slice(0, 32);
    if (!title) {
      dShowToast("群名不能为空");
      return false;
    }
    const ok = patchGroupActiveThread((th) => {
      th.groupTitle = title;
    });
    if (!ok) return false;
    const { updateChatChrome, renderChatThreadList } = deps();
    if (typeof updateChatChrome === "function") updateChatChrome();
    if (typeof renderChatThreadList === "function") renderChatThreadList();
    return true;
  }

  function buildGroupMemberAvEl(it, cid, letterLabel) {
    const avUrl = String(it?.avatar || "").trim();
    if (avUrl) {
      const av = document.createElement("img");
      av.className = "group-chat-member-av";
      av.src = avUrl;
      av.alt = "";
      return av;
    }
    const av = document.createElement("span");
    av.className = "group-chat-member-av group-chat-member-av--letter";
    const lab = String(letterLabel || charDisplayName(cid)).trim();
    av.textContent = lab.slice(0, 1) || "?";
    return av;
  }

  function buildMemberDmLinkSelect(thread, cid) {
    const sel = document.createElement("select");
    sel.className = "chat-detail-group-dm-link-select";
    sel.setAttribute("aria-label", `${charDisplayName(cid)} 关联私聊记忆`);
    const listFn = deps().listDmThreadsForChar;
    const labelFn = deps().threadLinkDisplayLabel;
    const mid = typeof deps().getActiveMaskIdForInbox === "function" ? deps().getActiveMaskIdForInbox() : "";
    const dms = typeof listFn === "function" && mid ? listFn(mid, cid) : [];
    const gid = String(thread?.id || "").trim();
    let cur =
      thread?.memberDmThreadIds && typeof thread.memberDmThreadIds === "object"
        ? String(thread.memberDmThreadIds[cid] || "").trim()
        : "";
    if (!cur && mid && gid && typeof listFn === "function") {
      const reverse = dms.find((d) => String(d?.linkedGroupThreadId || "").trim() === gid);
      if (reverse) cur = String(reverse.id || "").trim();
    }
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "不关联私聊";
    sel.appendChild(none);
    for (const dm of dms) {
      const opt = document.createElement("option");
      opt.value = String(dm?.id || "");
      opt.textContent =
        typeof labelFn === "function" ? labelFn(dm) : charDisplayName(cid);
      sel.appendChild(opt);
    }
    sel.value = dms.some((d) => String(d?.id || "") === cur) ? cur : "";
    sel.addEventListener("change", () => {
      const v = String(sel.value || "").trim();
      const ok = patchGroupActiveThread((t) => {
        if (!t.memberDmThreadIds || typeof t.memberDmThreadIds !== "object" || Array.isArray(t.memberDmThreadIds)) {
          t.memberDmThreadIds = Object.create(null);
        }
        if (v) t.memberDmThreadIds[cid] = v;
        else delete t.memberDmThreadIds[cid];
        pruneMemberDmThreadIds(t);
      });
      if (ok) {
        if (typeof deps().scheduleChatProactiveTimer === "function") deps().scheduleChatProactiveTimer();
        if (typeof deps().scheduleChatProactivePeerScanTimer === "function") {
          deps().scheduleChatProactivePeerScanTimer();
        }
        dShowToast(v ? "已关联私聊记忆" : "已取消关联");
      }
    });
    return sel;
  }

  /** @param {object} thread */
  function renderChatDetailGroupMemberList(thread) {
    const ul = document.getElementById("chat-detail-group-member-list");
    if (!ul) return;
    ul.replaceChildren();
    ul.className = "chat-detail-group-member-list chat-detail-group-member-list--with-links";
    const members = memberCharIds(thread);
    const mask = typeof deps().readUserMask === "function" ? deps().readUserMask() : null;
    const maskNm = maskDisplayName();
    {
      const li = document.createElement("li");
      li.className = "chat-detail-group-member-chip chat-detail-group-member-chip--self";
      li.dataset.memberKind = "mask";
      li.appendChild(buildGroupMemberAvEl(mask, "", maskNm));
      const nm = document.createElement("span");
      nm.className = "chat-detail-group-member-name";
      nm.textContent = maskNm;
      nm.title = maskNm;
      li.appendChild(nm);
      const tag = document.createElement("span");
      tag.className = "chat-detail-group-member-owner";
      tag.textContent = "我";
      tag.title = "主控（你）";
      li.appendChild(tag);
      ul.appendChild(li);
    }
    const addBtn = document.getElementById("chat-detail-group-add-member");
    const rmBtn = document.getElementById("chat-detail-group-remove-member");
    if (addBtn instanceof HTMLButtonElement) {
      const st = readCharStore();
      const allIds = (st.items || []).map((x) => String(x?.id || "").trim()).filter(Boolean);
      const canAdd = members.length < MAX_MEMBERS && allIds.some((id) => !members.includes(id));
      addBtn.disabled = !canAdd;
      addBtn.title = canAdd ? "从角色库添加成员" : members.length >= MAX_MEMBERS ? `最多 ${MAX_MEMBERS} 人` : "角色库暂无更多角色";
    }
    if (rmBtn instanceof HTMLButtonElement) {
      const canRemove = members.length > MIN_MEMBERS;
      rmBtn.disabled = !canRemove;
      rmBtn.title = canRemove ? "从本群移除成员" : `至少保留 ${MIN_MEMBERS} 人`;
    }
    for (const cid of members) {
      const it = charItemById(cid);
      const li = document.createElement("li");
      li.className = "chat-detail-group-member-row";
      li.dataset.charId = cid;

      const head = document.createElement("div");
      head.className = "chat-detail-group-member-chip";
      head.appendChild(buildGroupMemberAvEl(it, cid));

      const nm = document.createElement("span");
      nm.className = "chat-detail-group-member-name";
      nm.textContent = charDisplayName(cid);
      nm.title = charDisplayName(cid);
      head.appendChild(nm);
      li.appendChild(head);

      const linkRow = document.createElement("div");
      linkRow.className = "chat-detail-group-member-link-row";
      linkRow.appendChild(buildMemberDmLinkSelect(thread, cid));
      li.appendChild(linkRow);
      ul.appendChild(li);
    }
  }

  function removeGroupMemberFromDetail(charId) {
    const cid = String(charId || "").trim();
    const th = readActiveThread();
    if (!isGroupThread(th)) return;
    const members = memberCharIds(th).filter((id) => id !== cid);
    if (members.length < MIN_MEMBERS) {
      dShowToast(`至少保留 ${MIN_MEMBERS} 位成员`);
      return;
    }
    const nm = charDisplayName(cid);
    const ok = patchGroupActiveThread((t) => {
      t.memberCharIds = members;
      const anchor = String(t.charId || "").trim();
      if (!anchor || anchor === cid || !members.includes(anchor)) {
        t.charId = members[0] || "";
      }
      if (t.memberNotes && typeof t.memberNotes === "object") delete t.memberNotes[cid];
      if (t.groupNicknames && typeof t.groupNicknames === "object") delete t.groupNicknames[cid];
      if (t.memberDmThreadIds && typeof t.memberDmThreadIds === "object") delete t.memberDmThreadIds[cid];
      pruneGroupNicknames(t);
      pruneMemberDmThreadIds(t);
    });
    if (!ok) {
      dShowToast("无法保存");
      return;
    }
    const { updateChatChrome, renderChatThreadList } = deps();
    if (typeof updateChatChrome === "function") updateChatChrome();
    if (typeof renderChatThreadList === "function") renderChatThreadList();
    syncChatDetailGroupPanelUi(readActiveThread());
    dShowToast(`已移除「${nm}」`);
  }

  let addMemberSheetEl = null;
  let removeMemberSheetEl = null;

  function closeGroupAddMemberSheet() {
    if (!addMemberSheetEl) return;
    addMemberSheetEl.hidden = true;
    addMemberSheetEl.setAttribute("aria-hidden", "true");
  }

  function openGroupAddMemberSheet() {
    const th = readActiveThread();
    if (!isGroupThread(th)) return;
    const members = memberCharIds(th);
    if (members.length >= MAX_MEMBERS) {
      dShowToast(`群成员已满（最多 ${MAX_MEMBERS} 人）`);
      return;
    }
    const st = readCharStore();
    const candidates = (st.items || [])
      .map((x) => String(x?.id || "").trim())
      .filter((id) => id && !members.includes(id));
    if (!candidates.length) {
      dShowToast("角色库里没有可添加的成员");
      return;
    }
    if (!addMemberSheetEl) {
      const root = document.createElement("div");
      root.id = "group-add-member-sheet";
      root.className = "group-chat-sheet";
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = `
        <div class="group-chat-sheet-panel" role="dialog" aria-labelledby="group-add-member-sheet-title">
          <div class="group-chat-sheet-head">
            <h2 class="group-chat-sheet-title" id="group-add-member-sheet-title">添加群成员</h2>
            <button type="button" class="group-chat-sheet-close" aria-label="关闭"><i class="ph ph-x"></i></button>
          </div>
          <div class="group-chat-sheet-body">
            <p class="group-chat-sheet-hint">点选要加入本群的角色。</p>
            <ul class="group-chat-member-list" id="group-add-member-list"></ul>
          </div>
        </div>`;
      document.body.appendChild(root);
      root.addEventListener("click", (e) => {
        if (e.target === root) closeGroupAddMemberSheet();
      });
      root.querySelector(".group-chat-sheet-close")?.addEventListener("click", () => closeGroupAddMemberSheet());
      addMemberSheetEl = root;
    }
    const list = addMemberSheetEl.querySelector("#group-add-member-list");
    if (!list) return;
    list.replaceChildren();
    for (const cid of candidates) {
      const it = charItemById(cid);
      const li = document.createElement("li");
      li.className = "group-chat-member-item";
      li.dataset.charId = cid;
      const meta = document.createElement("div");
      meta.className = "group-chat-member-meta";
      const nm = document.createElement("div");
      nm.className = "group-chat-member-name";
      nm.textContent = charDisplayName(cid);
      meta.append(nm);
      li.append(buildGroupMemberAvEl(it, cid), meta);
      li.addEventListener("click", () => addGroupMemberFromDetail(cid));
      list.appendChild(li);
    }
    addMemberSheetEl.hidden = false;
    addMemberSheetEl.setAttribute("aria-hidden", "false");
  }

  function closeGroupRemoveMemberSheet() {
    if (!removeMemberSheetEl) return;
    removeMemberSheetEl.hidden = true;
    removeMemberSheetEl.setAttribute("aria-hidden", "true");
  }

  function openGroupRemoveMemberSheet() {
    const th = readActiveThread();
    if (!isGroupThread(th)) return;
    const members = memberCharIds(th);
    if (members.length <= MIN_MEMBERS) {
      dShowToast(`至少保留 ${MIN_MEMBERS} 位成员`);
      return;
    }
    if (!removeMemberSheetEl) {
      const root = document.createElement("div");
      root.id = "group-remove-member-sheet";
      root.className = "group-chat-sheet";
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = `
        <div class="group-chat-sheet-panel" role="dialog" aria-labelledby="group-remove-member-sheet-title">
          <div class="group-chat-sheet-head">
            <h2 class="group-chat-sheet-title" id="group-remove-member-sheet-title">移除群成员</h2>
            <button type="button" class="group-chat-sheet-close" aria-label="关闭"><i class="ph ph-x"></i></button>
          </div>
          <div class="group-chat-sheet-body">
            <p class="group-chat-sheet-hint">点选要移出本群的角色。</p>
            <ul class="group-chat-member-list" id="group-remove-member-list"></ul>
          </div>
        </div>`;
      document.body.appendChild(root);
      root.addEventListener("click", (e) => {
        if (e.target === root) closeGroupRemoveMemberSheet();
      });
      root.querySelector(".group-chat-sheet-close")?.addEventListener("click", () => closeGroupRemoveMemberSheet());
      removeMemberSheetEl = root;
    }
    const list = removeMemberSheetEl.querySelector("#group-remove-member-list");
    if (!list) return;
    list.replaceChildren();
    for (const cid of members) {
      const it = charItemById(cid);
      const li = document.createElement("li");
      li.className = "group-chat-member-item";
      li.dataset.charId = cid;
      const meta = document.createElement("div");
      meta.className = "group-chat-member-meta";
      const nm = document.createElement("div");
      nm.className = "group-chat-member-name";
      nm.textContent = charDisplayName(cid);
      meta.append(nm);
      li.append(buildGroupMemberAvEl(it, cid), meta);
      li.addEventListener("click", () => {
        closeGroupRemoveMemberSheet();
        removeGroupMemberFromDetail(cid);
      });
      list.appendChild(li);
    }
    removeMemberSheetEl.hidden = false;
    removeMemberSheetEl.setAttribute("aria-hidden", "false");
  }

  function addGroupMemberFromDetail(charId) {
    const cid = String(charId || "").trim();
    const th = readActiveThread();
    if (!isGroupThread(th) || !cid) return;
    const members = memberCharIds(th);
    if (members.includes(cid)) return;
    if (members.length >= MAX_MEMBERS) {
      dShowToast(`群成员已满（最多 ${MAX_MEMBERS} 人）`);
      return;
    }
    const ok = patchGroupActiveThread((t) => {
      t.memberCharIds = [...members, cid];
    });
    if (!ok) {
      dShowToast("无法保存");
      return;
    }
    closeGroupAddMemberSheet();
    const { updateChatChrome, renderChatThreadList } = deps();
    if (typeof updateChatChrome === "function") updateChatChrome();
    if (typeof renderChatThreadList === "function") renderChatThreadList();
    syncChatDetailGroupPanelUi(readActiveThread());
    dShowToast(`已添加「${charDisplayName(cid)}」`);
  }

  function bindChatDetailGroupPanel() {
    document.getElementById("chat-detail-group-title-save")?.addEventListener("click", () => {
      if (!saveGroupTitleFromDetailInput()) {
        dShowToast("无法保存");
        return;
      }
      dShowToast("群名已保存");
    });
    document.getElementById("chat-detail-group-add-member")?.addEventListener("click", () => {
      openGroupAddMemberSheet();
    });
    document.getElementById("chat-detail-group-remove-member")?.addEventListener("click", () => {
      openGroupRemoveMemberSheet();
    });
  }

  function bindCreateGroupButton() {
    const btn = document.getElementById("chat-thread-add-group");
    if (btn) {
      btn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          openGroupCreateSheet();
        },
        true
      );
    }
  }

  /** @param {unknown} rp */
  function isGroupRedpack(rp) {
    return !!(rp && typeof rp === "object" && (rp.mode === "exclusive" || rp.mode === "lucky"));
  }

  function parseMoneyToCents(v) {
    const fn = deps().parseMoneyToCents;
    return typeof fn === "function" ? fn(v) : 0;
  }

  function formatMoneyFromCents(c) {
    const fn = deps().formatMoneyFromCents;
    return typeof fn === "function" ? fn(c) : String(c);
  }

  function sanitizeRedpackAmount(v) {
    const fn = deps().sanitizeRedpackAmount;
    return typeof fn === "function" ? fn(v) : String(v);
  }

  function makeRedpackId() {
    const fn = deps().makeRedpackId;
    return typeof fn === "function" ? fn() : `rp_${Date.now()}`;
  }

  function centsToAmtStr(cents) {
    return (Math.max(0, Math.floor(Number(cents) || 0)) / 100).toFixed(2);
  }

  function drawLuckyGrabCents(remainingCents, remainingCount) {
    const rem = Math.max(0, Math.floor(Number(remainingCents) || 0));
    const cnt = Math.max(1, Math.floor(Number(remainingCount) || 1));
    if (cnt <= 1) return rem;
    const min = 1;
    const max = Math.max(min, Math.floor((rem / cnt) * 2));
    let pick = Math.floor(Math.random() * (max - min + 1)) + min;
    pick = Math.min(pick, rem - (cnt - 1) * min);
    return Math.max(min, pick);
  }

  function buildGroupRedpackObject(spec, thread) {
    const mode = spec.mode === "lucky" ? "lucky" : "exclusive";
    const totalAmt = sanitizeRedpackAmount(spec.totalAmt || spec.amt || "8.88");
    const note = String(spec.note || "").trim() || "恭喜发财";
    const count =
      mode === "lucky"
        ? Math.min(MAX_LUCKY_COUNT, Math.max(MIN_LUCKY_COUNT, Math.floor(Number(spec.count) || MIN_LUCKY_COUNT)))
        : 1;
    const senderRole = spec.sender?.role === "char" ? "char" : "user";
    const senderCharId = senderRole === "char" ? String(spec.sender?.charId || "").trim() : "";
    let targetCharId = "";
    if (mode === "exclusive") {
      const rawTarget = String(
        spec.targetCharId ?? spec.target?.charId ?? spec.targetName ?? spec.to ?? spec.receiverCharId ?? ""
      ).trim();
      targetCharId = resolveRedpackTargetRef(rawTarget, thread);
      if (!targetCharId && senderRole === "char") targetCharId = USER_TARGET;
      if (
        targetCharId &&
        targetCharId !== USER_TARGET &&
        !memberCharIds(thread).includes(targetCharId)
      ) {
        targetCharId = resolveMemberRef(rawTarget, thread) || (senderRole === "char" ? USER_TARGET : "");
      }
    }

    return {
      id: String(spec.id || makeRedpackId()),
      mode,
      amt: totalAmt,
      totalAmt,
      note,
      count,
      status: "open",
      remainingAmt: totalAmt,
      remainingCount: count,
      grabs: [],
      sender: { role: senderRole, ...(senderCharId ? { charId: senderCharId } : {}) },
      ...(mode === "exclusive" && targetCharId ? { targetCharId } : {})
    };
  }

  function senderLabel(rp) {
    const s = rp?.sender && typeof rp.sender === "object" ? rp.sender : {};
    if (s.role === "char") return charDisplayName(s.charId);
    return maskDisplayName();
  }

  function grabberLabel(g) {
    if (!g || typeof g !== "object") return "某人";
    if (g.role === "user") return maskDisplayName();
    return charDisplayName(g.charId);
  }

  function charAlreadyGrabbed(rp, charId) {
    const grabs = Array.isArray(rp?.grabs) ? rp.grabs : [];
    return grabs.some(
      (g) => g && g.role === "char" && String(g.charId || "") === String(charId || "") && g.action !== "reject"
    );
  }

  function userAlreadyGrabbed(rp) {
    const grabs = Array.isArray(rp?.grabs) ? rp.grabs : [];
    return grabs.some((g) => g && g.role === "user" && g.action !== "reject");
  }

  function isRedpackOpen(rp) {
    if (!isGroupRedpack(rp)) return false;
    return String(rp.status || "open") === "open" && Number(rp.remainingCount) > 0;
  }

  function canUserOrCharInteract(rp, role, charId) {
    if (!isRedpackOpen(rp)) return { ok: false, reason: "closed" };
    if (role === "user") {
      if (rp.mode === "exclusive") {
        const tgt = String(rp.targetCharId || "");
        if (rp.sender?.role === "char" && (tgt === USER_TARGET || !tgt)) {
          if (userAlreadyGrabbed(rp)) return { ok: false, reason: "done" };
          return { ok: true };
        }
        return { ok: false, reason: "not_for_you" };
      }
      if (userAlreadyGrabbed(rp)) return { ok: false, reason: "done" };
      return { ok: true };
    }
    const cid = String(charId || "").trim();
    if (!cid) return { ok: false, reason: "no_char" };
    if (charAlreadyGrabbed(rp, cid)) return { ok: false, reason: "done" };
    if (rp.mode === "exclusive") {
      if (String(rp.targetCharId || "") !== cid) return { ok: false, reason: "not_for_you" };
      return { ok: true };
    }
    return { ok: true };
  }

  function markLuckiest(grabs) {
    const list = Array.isArray(grabs) ? grabs.filter((g) => g && g.action !== "reject") : [];
    if (list.length < 2) return;
    let best = -1;
    let bi = -1;
    for (let i = 0; i < list.length; i++) {
      const c = parseMoneyToCents(list[i].amt);
      if (c > best) {
        best = c;
        bi = i;
      }
    }
    if (bi >= 0) list[bi].luckiest = true;
  }

  function applyGrabOrReject(rp, who) {
    if (!isGroupRedpack(rp)) return { ok: false, err: "not_group" };
    const role = who.role === "char" ? "char" : "user";
    const charId = role === "char" ? String(who.charId || "").trim() : "";
    const action = who.action === "reject" ? "reject" : "grab";
    const gate = canUserOrCharInteract(rp, role, charId);
    if (!gate.ok && action === "grab") return { ok: false, err: gate.reason };

    if (action === "reject") {
      if (rp.mode !== "exclusive") return { ok: false, err: "no_reject_lucky" };
      rp.status = "returned";
      rp.remainingCount = 0;
      rp.remainingAmt = "0.00";
      rp.grabs = Array.isArray(rp.grabs) ? rp.grabs : [];
      rp.grabs.push({ role, ...(charId ? { charId } : {}), amt: "0.00", action: "reject", at: Date.now() });
      return { ok: true, reject: true };
    }

    let grabCents = 0;
    if (rp.mode === "lucky") {
      const remC = parseMoneyToCents(rp.remainingAmt);
      const remN = Math.max(0, Math.floor(Number(rp.remainingCount) || 0));
      if (remN <= 0 || remC <= 0) return { ok: false, err: "empty" };
      grabCents = drawLuckyGrabCents(remC, remN);
    } else {
      grabCents = parseMoneyToCents(rp.remainingAmt || rp.totalAmt || rp.amt);
    }
    const grabAmt = centsToAmtStr(grabCents);
    rp.grabs = Array.isArray(rp.grabs) ? rp.grabs : [];
    rp.grabs.push({ role, ...(charId ? { charId } : {}), amt: grabAmt, action: "grab", at: Date.now() });
    const leftC = Math.max(0, parseMoneyToCents(rp.remainingAmt) - grabCents);
    const leftN = Math.max(0, Math.floor(Number(rp.remainingCount) || 0) - 1);
    rp.remainingAmt = centsToAmtStr(leftC);
    rp.remainingCount = leftN;
    if (leftN <= 0 || leftC <= 0) {
      rp.status = "done";
      if (leftC > 0 && rp.sender?.role === "user") {
        rp._refundLeftCents = leftC;
      }
      rp.remainingAmt = "0.00";
      rp.remainingCount = 0;
    }
    markLuckiest(rp.grabs);
    return { ok: true, grabCents, grabAmt };
  }

  function refundUserWallet(cents, note) {
    if (cents <= 0) return;
    const fn = deps().adjustWalletCentsBy;
    if (typeof fn === "function") fn(cents);
    const push = deps().pushWalletBill;
    if (typeof push === "function") push({ type: "红包退款", note: String(note || "").trim(), deltaCents: cents });
    const ren = deps().renderMyScreen;
    if (typeof ren === "function") ren();
  }

  function creditUserWallet(cents, note) {
    if (cents <= 0) return;
    const fn = deps().adjustWalletCentsBy;
    if (typeof fn === "function") fn(cents);
    const push = deps().pushWalletBill;
    if (typeof push === "function") push({ type: "收红包", note: String(note || "").trim(), deltaCents: cents });
    const ren = deps().renderMyScreen;
    if (typeof ren === "function") ren();
  }

  function deductUserWallet(cents, note) {
    const maskId = typeof deps().getActiveMaskIdForInbox === "function" ? deps().getActiveMaskIdForInbox() : "";
    const ensure = deps().ensureMyMaskBucket;
    const write = deps().writeMyStore;
    if (typeof ensure !== "function" || typeof write !== "function" || !maskId) return false;
    const { store, bucket, dirty } = ensure(maskId);
    if (dirty) write(store);
    const bal = Number(bucket.walletCents) || 0;
    if (bal < cents) return false;
    bucket.walletCents = bal - cents;
    write(store);
    const ren = deps().renderMyScreen;
    if (typeof ren === "function") ren();
    const push = deps().pushWalletBill;
    if (typeof push === "function") {
      push({ type: "发红包", note: String(note || "").trim(), deltaCents: -cents, balanceCentsAfter: bucket.walletCents });
    }
    return true;
  }

  function buildRedpackMessageText(amt, note, rp) {
    const base = `¥${sanitizeRedpackAmount(amt)} ${String(note || "").trim() || "恭喜发财"}`;
    if (rp && isGroupRedpack(rp) && rp.mode === "exclusive") {
      return `【专属红包·发给${exclusiveRedpackTargetLabel(rp)}】${base}`;
    }
    if (rp && isGroupRedpack(rp) && rp.mode === "lucky") {
      return `【拼手气红包】${base}`;
    }
    return `【红包】${base}`;
  }

  function insertNoticeAfter(log, msgIdx, notice) {
    if (!Array.isArray(log)) return;
    log.splice(msgIdx + 1, 0, { role: "notice", at: Date.now(), content: "", ...notice });
  }

  function applyInteractionOnMessage(log, msgIdx, action, who) {
    const m = log[msgIdx];
    if (!m?.redpack || !isGroupRedpack(m.redpack)) return false;
    const rp = m.redpack;
    const beforeSenderUser = rp.sender?.role === "user";
    const res = applyGrabOrReject(rp, { ...who, action });
    if (!res.ok) return false;
    m.redpack = rp;
    const nm = who.role === "user" ? maskDisplayName() : charDisplayName(who.charId);

    if (res.reject) {
      if (beforeSenderUser) refundUserWallet(parseMoneyToCents(rp.totalAmt || rp.amt), rp.note);
      insertNoticeAfter(log, msgIdx, {
        kind: "group_redpack",
        action: "returned",
        by: who.role,
        ...(who.charId ? { charId: who.charId } : {}),
        redpackId: String(rp.id || ""),
        label: `${nm}拒收了${senderLabel(rp)}的红包`
      });
      return true;
    }

    const grabCents = res.grabCents || 0;
    if (who.role === "user" && grabCents > 0 && rp.sender?.role === "char") {
      creditUserWallet(grabCents, `${senderLabel(rp)}的红包 · ${rp.note}`);
    }

    insertNoticeAfter(log, msgIdx, {
      kind: "group_redpack",
      action: "claimed",
      by: who.role,
      ...(who.charId ? { charId: who.charId } : {}),
      amt: res.grabAmt || centsToAmtStr(grabCents),
      redpackId: String(rp.id || ""),
      label: `${nm}领取了${senderLabel(rp)}的红包 ¥${res.grabAmt || centsToAmtStr(grabCents)}`
    });

    if (rp.status === "done" && rp.mode === "lucky") {
      if (rp._refundLeftCents > 0 && beforeSenderUser) {
        refundUserWallet(rp._refundLeftCents, `${rp.note} · 未领完退回`);
        delete rp._refundLeftCents;
      }
      insertNoticeAfter(log, msgIdx, {
        kind: "group_redpack",
        action: "done",
        redpackId: String(rp.id || ""),
        label: `${senderLabel(rp)}的拼手气红包已被领完`
      });
    }
    return true;
  }

  function findRedpackMessageIndex(log, id) {
    const rid = String(id || "").trim();
    if (!rid || !Array.isArray(log)) return -1;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i]?.redpack && String(log[i].redpack.id || "") === rid) return i;
    }
    return -1;
  }

  function formatCardFootText(m, role, rp) {
    if (!isGroupRedpack(rp)) return null;
    const st = String(rp.status || "open");
    if (st === "returned") return "已拒收";
    if (st === "done") return rp.mode === "lucky" ? "已被领完" : "已领取";
    if (rp.mode === "lucky") {
      const total = Math.floor(Number(rp.count) || 0);
      const left = Math.max(0, Math.floor(Number(rp.remainingCount) || 0));
      return `拼手气 · 已领 ${total - left}/${total}`;
    }
    return `专属 · 发给${exclusiveRedpackTargetLabel(rp)}`;
  }

  function buildGrabsListHtml(rp) {
    const grabs = (Array.isArray(rp?.grabs) ? rp.grabs : []).filter((g) => g && g.action !== "reject");
    if (!grabs.length) return "";
    const lines = grabs
      .map((g) => {
        const cls = g.luckiest ? " is-best" : "";
        const tag = g.luckiest ? "（手气最佳）" : "";
        return `<li class="${cls}">${grabberLabel(g)} · ¥${g.amt}${tag}</li>`;
      })
      .join("");
    return `<div class="group-rp-peek-grabs"><span>领取详情</span><ul>${lines}</ul></div>`;
  }

  let pickMode = "lucky";
  let pickTarget = "";

  function ensureSendSheetExtras() {
    const body = document.querySelector("#redpack-sheet .redpack-body .redpack-form");
    if (!body || document.getElementById("group-rp-sheet-extra")) return;
    const wrap = document.createElement("div");
    wrap.id = "group-rp-sheet-extra";
    wrap.className = "group-rp-sheet-extra";
    wrap.innerHTML = `
      <div class="redpack-field">
        <span class="redpack-label">红包类型</span>
        <div class="group-rp-mode-row">
          <button type="button" class="chip ghost group-rp-mode-btn" data-mode="lucky" aria-pressed="true">拼手气</button>
          <button type="button" class="chip ghost group-rp-mode-btn" data-mode="exclusive" aria-pressed="false">专属</button>
        </div>
      </div>
      <div class="redpack-field" id="group-rp-count-row">
        <label class="redpack-label" for="group-rp-count-input">红包个数</label>
        <input id="group-rp-count-input" class="redpack-note-input" inputmode="numeric" value="5" />
      </div>
      <div class="redpack-field" id="group-rp-target-row" hidden>
        <span class="redpack-label">发给谁</span>
        <ul class="group-rp-target-list" id="group-rp-target-list"></ul>
      </div>`;
    const noteField = body.querySelector("#redpack-note-input")?.closest(".redpack-field");
    if (noteField) body.insertBefore(wrap, noteField);
    else body.appendChild(wrap);
    wrap.querySelectorAll(".group-rp-mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        pickMode = String(btn.getAttribute("data-mode") || "lucky");
        syncSendSheetUi();
      });
    });
  }

  function syncSendSheetUi() {
    const th = readActiveThread();
    const extra = document.getElementById("group-rp-sheet-extra");
    const title = document.getElementById("redpack-title");
    if (!isGroupThread(th)) {
      if (extra) extra.hidden = true;
      if (title) title.textContent = "发红包";
      return;
    }
    ensureSendSheetExtras();
    if (extra) extra.hidden = false;
    if (title) title.textContent = "发群红包";
    const countRow = document.getElementById("group-rp-count-row");
    const targetRow = document.getElementById("group-rp-target-row");
    if (countRow) countRow.hidden = pickMode !== "lucky";
    if (targetRow) targetRow.hidden = pickMode !== "exclusive";
    document.querySelectorAll(".group-rp-mode-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-mode")) === pickMode ? "true" : "false");
    });
    const list = document.getElementById("group-rp-target-list");
    if (list && pickMode === "exclusive") {
      list.replaceChildren();
      const members = memberCharIds(th);
      if (!pickTarget || !members.includes(pickTarget)) pickTarget = members[0] || "";
      for (const cid of members) {
        const li = document.createElement("li");
        li.className = "group-rp-target-item" + (cid === pickTarget ? " is-picked" : "");
        li.textContent = charDisplayName(cid);
        li.addEventListener("click", () => {
          pickTarget = cid;
          syncSendSheetUi();
        });
        list.appendChild(li);
      }
    }
    const cntInp = document.getElementById("group-rp-count-input");
    if (cntInp instanceof HTMLInputElement && pickMode === "lucky") {
      const def = Math.min(MAX_LUCKY_COUNT, Math.max(MIN_LUCKY_COUNT, memberCharIds(th).length + 1));
      if (!cntInp.value.trim()) cntInp.value = String(def);
    }
  }

  function readSendFormValues() {
    const amtEl = document.getElementById("redpack-amount-input");
    const noteEl = document.getElementById("redpack-note-input");
    const cntEl = document.getElementById("group-rp-count-input");
    const totalAmt = sanitizeRedpackAmount(amtEl instanceof HTMLInputElement ? amtEl.value : "8.88");
    const note = String(noteEl instanceof HTMLInputElement ? noteEl.value : "恭喜发财").trim() || "恭喜发财";
    let count = MIN_LUCKY_COUNT;
    if (pickMode === "lucky" && cntEl instanceof HTMLInputElement) {
      count = Math.min(MAX_LUCKY_COUNT, Math.max(MIN_LUCKY_COUNT, Math.floor(Number(cntEl.value) || MIN_LUCKY_COUNT)));
    }
    return { totalAmt, note, count, mode: pickMode, targetCharId: pickMode === "exclusive" ? pickTarget : "" };
  }

  function trySendUserRedpack() {
    const th = readActiveThread();
    if (!isGroupThread(th)) return false;
    const vals = readSendFormValues();
    const need = parseMoneyToCents(vals.totalAmt);
    if (need <= 0) {
      dShowToast("金额不合法");
      return true;
    }
    if (vals.mode === "exclusive" && !vals.targetCharId) {
      dShowToast("请选择专属红包对象");
      return true;
    }
    if (!deductUserWallet(need, vals.note)) {
      dShowToast(`余额不足（需要 ¥${formatMoneyFromCents(need)}）`);
      return true;
    }
    const rp = buildGroupRedpackObject(
      {
        mode: vals.mode,
        totalAmt: vals.totalAmt,
        note: vals.note,
        count: vals.count,
        targetCharId: vals.targetCharId,
        sender: { role: "user" }
      },
      th
    );
    const readLog = deps().readChatLog;
    const saveLog = deps().saveChatLog;
    if (typeof readLog !== "function" || typeof saveLog !== "function") return true;
    const log = readLog();
    log.push({
      role: "user",
      content: buildRedpackMessageText(vals.totalAmt, vals.note, rp),
      at: Date.now(),
      redpack: rp
    });
    saveLog(log);
    const sched = deps().scheduleRenderChatMessagesAfterUserSend || deps().scheduleRenderChatMessages;
    if (typeof sched === "function") sched();
    const close = deps().closeRedpackSheet;
    if (typeof close === "function") close();
    dShowToast(
      vals.mode === "lucky"
        ? "拼手气红包已发出"
        : `专属红包已发给${exclusiveRedpackTargetLabel(rp)}`
    );
    return true;
  }

  function attachCharRedpackToEntry(entry, spec, charId, thread) {
    entry.redpack = buildGroupRedpackObject({ ...spec, sender: { role: "char", charId } }, thread);
    if (!String(entry.content || "").trim()) {
      entry.content = buildRedpackMessageText(entry.redpack.totalAmt, entry.redpack.note, entry.redpack);
    }
  }

  function parseReplyRedpackFields(item, thread) {
    const o = item && typeof item === "object" ? item : {};
    const raw =
      (o.redpack && typeof o.redpack === "object" ? o.redpack : null) ||
      (o.redPacket && typeof o.redPacket === "object" ? o.redPacket : null) ||
      (o.hongbao && typeof o.hongbao === "object" ? o.hongbao : null);
    if (!raw) return null;
    const modeRaw = String(raw.mode ?? raw.type ?? raw.kind ?? "").trim().toLowerCase();
    let mode = "";
    if (modeRaw === "exclusive" || modeRaw === "专属" || modeRaw === "direct" || modeRaw === "single") {
      mode = "exclusive";
    } else if (
      modeRaw === "lucky" ||
      modeRaw === "拼手气" ||
      modeRaw === "random" ||
      modeRaw === "luck" ||
      modeRaw === "group"
    ) {
      mode = "lucky";
    }
    if (!mode) return null;
    let targetCharId = "";
    if (mode === "exclusive") {
      const rawTarget = String(
        raw.targetCharId ??
          raw.targetCharID ??
          raw.toCharId ??
          raw.targetName ??
          raw.to ??
          raw.receiverCharId ??
          raw.recipientCharId ??
          ""
      ).trim();
      targetCharId = resolveRedpackTargetRef(rawTarget, thread);
    }
    return {
      mode,
      totalAmt: sanitizeRedpackAmount(raw.totalAmt || raw.amt || "8.88"),
      note: String(raw.note || "").trim() || "恭喜发财",
      count: Math.floor(Number(raw.count) || MIN_LUCKY_COUNT),
      targetCharId
    };
  }

  function processRedpackActions(log, actions) {
    if (!Array.isArray(log) || !Array.isArray(actions)) return;
    for (const act of actions) {
      if (!act || typeof act !== "object") continue;
      const cid = String(act.charId || "").trim();
      const rid = String(act.redpackId || act.id || "").trim();
      const action = act.action === "reject" || act.action === "returned" ? "reject" : "grab";
      if (!cid || !rid) continue;
      const idx = findRedpackMessageIndex(log, rid);
      if (idx >= 0) applyInteractionOnMessage(log, idx, action, { role: "char", charId: cid });
    }
  }

  function buildRedpackContextForPrompt(thread, logSlice) {
    if (!isGroupThread(thread)) return "";
    const log = Array.isArray(logSlice) ? logSlice : [];
    const lines = [];
    for (let i = Math.max(0, log.length - 24); i < log.length; i++) {
      const rp = log[i]?.redpack;
      if (!isGroupRedpack(rp)) continue;
      const st = String(rp.status || "open");
      const kind =
        rp.mode === "lucky" ? "拼手气" : `专属→${exclusiveRedpackTargetLabel(rp)}`;
      const head = `${senderLabel(rp)} · ${kind} ¥${rp.totalAmt}（${rp.note}）`;
      if (st === "open") {
        lines.push(`${head} · 剩 ${rp.remainingCount}/${rp.count} · ¥${rp.remainingAmt} · id:${rp.id}`);
      } else {
        lines.push(`${head} · ${st === "returned" ? "已拒收" : "已结束"}`);
      }
      for (const g of (rp.grabs || []).slice(-5)) {
        lines.push(g.action === "reject" ? `  - ${grabberLabel(g)} 拒收` : `  - ${grabberLabel(g)} ¥${g.amt}`);
      }
    }
    if (!lines.length) return "";
    return `[群红包]\n${lines.join("\n")}\n\n发：replies[].redpack {mode,totalAmt,note,count?,targetCharId}；专属 targetCharId=接收者 charId，发给主控写 "${USER_TARGET}"。\n抢/拒：redpackActions:[{charId,redpackId,action:"grab"|"reject"}]（专属仅 target 可 claim/reject）。`;
  }

  function openGroupRedpackPeek(msgIdx, msg, rp) {
    const root = document.getElementById("redpack-peek-sheet");
    if (!root) return;
    root.dataset.msgIdx = String(msgIdx);
    root.dataset.groupRp = "1";
    const gate = canUserOrCharInteract(rp, "user");
    const exToUser =
      rp.mode === "exclusive" && rp.sender?.role === "char" && String(rp.targetCharId || USER_TARGET) === USER_TARGET;
    let mode = "view";
    if (isRedpackOpen(rp)) {
      if (exToUser && gate.ok) mode = "char-sent";
      else if (rp.mode === "lucky" && gate.ok) mode = "group-grab";
    }
    const fn = deps().openRedpackPeek;
    if (typeof fn === "function") {
      fn({ amt: rp.totalAmt || rp.amt, note: rp.note, mode, sub: rp.mode === "lucky" ? `拼手气 ${rp.count} 个` : `专属 · 发给${exclusiveRedpackTargetLabel(rp)}` });
    }
    const body = document.querySelector("#redpack-peek-sheet .redpack-peek-body");
    if (body) {
      const old = body.querySelector(".group-rp-peek-grabs");
      if (old) old.remove();
      const html = buildGrabsListHtml(rp);
      if (html) body.insertAdjacentHTML("beforeend", html);
    }
    const claimBtn = document.getElementById("redpack-peek-claim");
    const retBtn = document.getElementById("redpack-peek-return");
    const okBtn = document.getElementById("redpack-peek-ok");
    if (mode === "group-grab") {
      if (claimBtn) {
        claimBtn.hidden = false;
        claimBtn.textContent = "抢红包";
      }
      if (retBtn) retBtn.hidden = true;
      if (okBtn) okBtn.hidden = true;
    }
  }

  function handleCardClick(msgIdx, msg) {
    if (!isGroupRedpack(msg?.redpack)) return false;
    openGroupRedpackPeek(msgIdx, msg, msg.redpack);
    return true;
  }

  function handlePeekClaim() {
    const root = document.getElementById("redpack-peek-sheet");
    if (!root || root.dataset.groupRp !== "1") return false;
    const idx = Number(root.dataset.msgIdx);
    const readLog = deps().readChatLog;
    const saveLog = deps().saveChatLog;
    if (typeof readLog === "function" && typeof saveLog === "function" && Number.isFinite(idx)) {
      const log = readLog();
      if (applyInteractionOnMessage(log, idx, "grab", { role: "user" })) {
        saveLog(log);
        (deps().finishComposerPatchSaveAndRefresh || deps().scheduleRenderChatMessages)?.(idx);
      }
    }
    deps().closeRedpackPeek?.();
    root.dataset.groupRp = "";
    return true;
  }

  function handlePeekReturn() {
    const root = document.getElementById("redpack-peek-sheet");
    if (!root || root.dataset.groupRp !== "1") return false;
    const idx = Number(root.dataset.msgIdx);
    const readLog = deps().readChatLog;
    const saveLog = deps().saveChatLog;
    if (typeof readLog === "function" && typeof saveLog === "function" && Number.isFinite(idx)) {
      const log = readLog();
      if (applyInteractionOnMessage(log, idx, "reject", { role: "user" })) {
        saveLog(log);
        (deps().finishComposerPatchSaveAndRefresh || deps().scheduleRenderChatMessages)?.(idx);
      }
    }
    deps().closeRedpackPeek?.();
    root.dataset.groupRp = "";
    return true;
  }

  function isGroupRenameNotice(m) {
    return !!(m && typeof m === "object" && m.role === "notice" && String(m.kind || "") === "group_rename");
  }

  function isGroupNicknameNotice(m) {
    return !!(m && typeof m === "object" && m.role === "notice" && String(m.kind || "") === "group_nickname");
  }

  let groupMetaPeekBound = false;

  function ensureGroupMetaHeartVoicePeek() {
    document.getElementById("group-rename-hv-peek")?.remove();
    document.getElementById("group-nickname-hv-peek")?.remove();
    const existing = document.getElementById("group-meta-hv-peek");
    if (existing && existing.dataset.peekVer === "unified") return;
    existing?.remove();
    groupMetaPeekBound = false;
    const root = document.createElement("div");
    root.id = "group-meta-hv-peek";
    root.dataset.peekVer = "unified";
    root.className = "chat-char-recall-overlay group-rename-hv-peek";
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <button type="button" class="chat-inner-voice-backdrop" id="group-meta-hv-peek-backdrop" aria-label="关闭" tabindex="-1"></button>
      <aside class="chat-inner-voice-panel chat-char-recall-dialog group-rename-hv-dialog" role="dialog" aria-modal="true" aria-labelledby="group-meta-hv-peek-title">
        <div class="chat-inner-voice-mount">
          <div class="chat-slab">
            <div class="chat-slab-spine" aria-hidden="true"><span class="chat-slab-spine-line"></span><span class="chat-slab-spine-idx" id="group-meta-hv-peek-spine">名</span></div>
            <div class="chat-slab-stack">
              <div class="chat-composer-cap chat-inner-voice-capbar">
                <span class="chat-composer-cap-l"><span class="chat-composer-cap-dot" aria-hidden="true"></span><span id="group-meta-hv-peek-cap">群名</span></span>
                <h2 id="group-meta-hv-peek-title" class="chat-inner-voice-cap-title">改群名</h2>
                <button type="button" class="chat-inner-voice-close" id="group-meta-hv-peek-dismiss" aria-label="关闭"><i class="ph ph-x" aria-hidden="true"></i></button>
              </div>
              <div class="chat-slab-mat">
                <span class="chat-slab-tape" aria-hidden="true"></span>
                <div class="chat-slab-panel chat-inner-voice-slab-panel">
                  <p class="chat-detail-field-k chat-char-recall-field-k" id="group-meta-hv-peek-field-k">新群名</p>
                  <p id="group-meta-hv-peek-line" class="group-rename-hv-peek-sub"></p>
                  <p class="chat-detail-field-k chat-char-recall-field-k">此刻想法</p>
                  <p id="group-meta-hv-peek-thought" class="group-rename-hv-peek-thought" aria-live="polite"></p>
                  <div class="chat-char-recall-foot">
                    <button type="button" class="chip solid chip-xs" id="group-meta-hv-peek-close">收合</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>`;
    document.body.appendChild(root);
    if (!groupMetaPeekBound) {
      groupMetaPeekBound = true;
      const close = () => closeGroupMetaHeartVoicePeek();
      root.querySelector("#group-meta-hv-peek-backdrop")?.addEventListener("click", close);
      root.querySelector("#group-meta-hv-peek-dismiss")?.addEventListener("click", close);
      root.querySelector("#group-meta-hv-peek-close")?.addEventListener("click", close);
    }
  }

  function closeGroupMetaHeartVoicePeek() {
    const root = document.getElementById("group-meta-hv-peek");
    if (!root || root.hidden) return;
    root.classList.remove("is-open");
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
  }

  /** @param {number} logIdx @param {"rename"|"nickname"} kind */
  function openGroupMetaHeartVoicePeek(logIdx, kind) {
    const readLog = deps().readChatLog;
    const log = typeof readLog === "function" ? readLog() : [];
    const i = Number(logIdx);
    if (!Number.isFinite(i) || i < 0 || i >= log.length) return;
    const m = log[i];
    const isRename = kind === "rename";
    if (isRename ? !isGroupRenameNotice(m) : !isGroupNicknameNotice(m)) return;
    const thought = String(m.heartVoice ?? "").trim();
    if (!thought) {
      dShowToast(isRename ? "暂无改群名时的想法" : "暂无改昵称时的想法");
      return;
    }
    ensureGroupMetaHeartVoicePeek();
    const root = document.getElementById("group-meta-hv-peek");
    if (!root) return;
    const cid = String(m.charId || "").trim();
    const nm = charDisplayName(cid);
    const spineEl = document.getElementById("group-meta-hv-peek-spine");
    const capEl = document.getElementById("group-meta-hv-peek-cap");
    const fieldEl = document.getElementById("group-meta-hv-peek-field-k");
    const titleEl = document.getElementById("group-meta-hv-peek-title");
    const lineEl = document.getElementById("group-meta-hv-peek-line");
    const thoughtEl = document.getElementById("group-meta-hv-peek-thought");
    if (isRename) {
      const title = normalizeGroupTitleText(m.groupTitle);
      if (spineEl) spineEl.textContent = "名";
      if (capEl) capEl.textContent = "群名";
      if (fieldEl) fieldEl.textContent = "新群名";
      if (titleEl) titleEl.textContent = `${nm} · 改群名`;
      if (lineEl) lineEl.textContent = title ? `「${title}」` : "—";
    } else {
      const nick = normalizeGroupNicknameText(m.groupNickname);
      if (spineEl) spineEl.textContent = "昵";
      if (capEl) capEl.textContent = "群昵称";
      if (fieldEl) fieldEl.textContent = "新昵称";
      if (titleEl) titleEl.textContent = `${nm} · 改群昵称`;
      if (lineEl) lineEl.textContent = nick ? `「${nick}」` : "（已清除昵称）";
    }
    if (thoughtEl) thoughtEl.textContent = thought;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => {
      root.classList.add("is-open");
      document.getElementById("group-meta-hv-peek-dismiss")?.focus();
    });
  }

  /** @param {HTMLElement} root @param {number} idx @param {object} m @param {"rename"|"nickname"} kind */
  function appendGroupMetaNoticeRow(root, idx, m, kind) {
    const isRename = kind === "rename";
    if (!root || (isRename ? !isGroupRenameNotice(m) : !isGroupNicknameNotice(m))) return;
    const thought = String(m.heartVoice ?? "").trim();
    let label = String(m.label || "").trim();
    if (!label) {
      if (isRename) {
        const nm = charDisplayName(String(m.charId || "").trim());
        const title = normalizeGroupTitleText(m.groupTitle);
        label = `${nm} 修改群名为「${title}」`;
      } else {
        label = "群昵称已更新";
      }
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chat-time-divider chat-time-divider--group-${isRename ? "rename" : "nickname"}`;
    btn.dataset.chatMsgIdx = String(idx);
    btn.setAttribute("aria-label", thought ? `${label}，点击查看想法` : label);
    const lab = document.createElement("span");
    lab.className = `chat-time-divider-label chat-time-divider-label--group-${isRename ? "rename" : "nickname"}`;
    lab.textContent = label;
    if (thought) {
      const hint = document.createElement("span");
      hint.className = "chat-time-divider-hint";
      hint.textContent = " · 想法";
      lab.appendChild(hint);
    }
    btn.appendChild(lab);
    btn.addEventListener("click", () => openGroupMetaHeartVoicePeek(idx, kind));
    root.appendChild(btn);
  }

  function appendGroupRenameNoticeRow(root, idx, m) {
    appendGroupMetaNoticeRow(root, idx, m, "rename");
  }

  function appendGroupNicknameNoticeRow(root, idx, m) {
    appendGroupMetaNoticeRow(root, idx, m, "nickname");
  }

  function formatGroupRedpackNotice(m) {
    return String(m?.kind || "") === "group_redpack" ? String(m.label || "群红包动态") : "";
  }

  const Redpack = {
    isGroupThread,
    isGroupRedpack,
    syncSendSheetUi,
    trySendUserRedpack,
    handleCardClick,
    handlePeekClaim,
    handlePeekReturn,
    formatCardFootText,
    formatGroupRedpackNotice,
    attachCharRedpackToEntry,
    parseReplyRedpackFields,
    processRedpackActions,
    buildRedpackContextForPrompt,
    USER_TARGET
  };

  function initRedpack() {
    document.getElementById("redpack-send")?.addEventListener(
      "click",
      (e) => {
        if (Redpack.trySendUserRedpack()) e.stopImmediatePropagation();
      },
      true
    );
  }

  function ensureGroupStylesheet() {
    if (document.getElementById("xxj-group-css")) return;
    const link = document.createElement("link");
    link.id = "xxj-group-css";
    link.rel = "stylesheet";
    link.href = "group.css?v=242";
    document.head.appendChild(link);
  }

  function init() {
    ensureGroupStylesheet();
    enableGroupUi();
    bindCreateGroupButton();
    bindChatDetailGroupPanel();
    initRedpack();
  }

  window.XXJ_GroupChat = {
    isGroupThread,
    memberCharIds,
    groupParticipantCount,
    groupThreadDisplayTitle,
    syncChatDetailGroupPanelUi,
    normalizeGroupThread,
    runAssistantRound,
    expandAssistantContentForApi,
    resolveVoiceCharId,
    decorateMessageDom,
    applyGroupIdentityHeaderFace,
    speakerCharIdFromMessage,
    refreshGroupAssistantRowPresentation,
    charDisplayName,
    openGroupCreateSheet,
    appendGroupRenameNoticeRow,
    appendGroupNicknameNoticeRow,
    groupCallNameForRef
  };
  window.XXJ_GroupRedpack = Redpack;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
