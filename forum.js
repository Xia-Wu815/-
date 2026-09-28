"use strict";

/**
 * 论坛 · 广场信息流
 */
(function () {
  const screen = document.getElementById("forum-screen");
  const feedEl = document.getElementById("forum-feed");
  const feedEmptyEl = document.getElementById("forum-feed-empty");
  const feedPanel = document.getElementById("forum-panel-feed");
  const messagesPanel = document.getElementById("forum-panel-messages");
  const profilePanel = document.getElementById("forum-panel-profile");
  const msgListEl = document.getElementById("forum-msg-list");
  const msgEmptyEl = document.getElementById("forum-msg-empty");
  const msgNotifsEl = document.getElementById("forum-msg-notifs");
  const msgNotifsWrap = document.getElementById("forum-msg-notifs-wrap");
  const dmEl = document.getElementById("forum-dm");
  const dmScrollEl = document.getElementById("forum-dm-scroll");
  const dmInputEl = document.getElementById("forum-dm-input");
  const dmSendEl = document.getElementById("forum-dm-send");
  const dmPeerNameEl = document.getElementById("forum-dm-peer-name");
  const dmPeerAvEl = document.getElementById("forum-dm-peer-av");
  const detailEl = document.getElementById("forum-detail");
  const detailScrollEl = document.getElementById("forum-detail-scroll");
  const detailCommentsEl = document.getElementById("forum-detail-comments");
  const detailInputEl = document.getElementById("forum-detail-input");
  const detailSendEl = document.getElementById("forum-detail-send");
  const composeSheet = document.getElementById("forum-compose-wrap");
  const composeInputEl = document.getElementById("forum-compose-input");
  const composeSubmitEl = document.getElementById("forum-compose-submit");
  const profilePostsListEl = document.getElementById("forum-profile-posts-list");
  const profilePostsEmptyEl = document.getElementById("forum-profile-posts-empty");
  const profileDisplayNameEl = document.getElementById("forum-profile-display-name");
  const profileIdTextEl = document.getElementById("forum-profile-id-text");
  const profileIdInputEl = document.getElementById("forum-profile-id-input");
  const profileIdBtnEl = document.getElementById("forum-profile-id-btn");
  const profileCmtsEl = document.getElementById("forum-profile-cmts");
  const profileNameEl = document.getElementById("forum-profile-name");
  const profileNameBtnEl = document.getElementById("forum-profile-name-btn");
  const topbarKickerEl = document.getElementById("forum-topbar-kicker");
  const topbarTitleEl = document.getElementById("forum-topbar-title");
  const refreshBtnEl = document.getElementById("forum-refresh-btn");
  const composeTopBtn = document.getElementById("forum-compose-top");
  const sectorSettingsBtn = document.getElementById("forum-sector-settings-btn");
  const sectorChipsEl = document.getElementById("forum-sector-chips");
  const sectorWbBannerEl = document.getElementById("forum-sector-wb-banner");
  const sectorWbBannerTextEl = document.getElementById("forum-sector-wb-banner-text");
  const sectorSheet = document.getElementById("forum-sector-sheet");
  const sectorSheetSectorsEl = document.getElementById("forum-sector-sheet-sectors");
  const sectorWbSearchEl = document.getElementById("forum-sector-wb-search");
  const sectorWbChipsEl = document.getElementById("forum-sector-wb-chips");
  const sectorWbEmptyEl = document.getElementById("forum-sector-wb-empty");
  const sectorWbCountEl = document.getElementById("forum-sector-wb-count");
  const sectorGenChipsEl = document.getElementById("forum-sector-gen-chips");
  const sectorCustomPromptEl = document.getElementById("forum-sector-custom-prompt");
  const sectorBgToggleEl = document.getElementById("forum-sector-bg-toggle");
  const globalBgToggleEl = document.getElementById("forum-global-bg-toggle");
  const globalBgCooldownEl = document.getElementById("forum-global-bg-cooldown");
  const refreshSheet = document.getElementById("forum-refresh-sheet");
  const refreshSectorNameEl = document.getElementById("forum-refresh-sector-name");
  const refreshMinEl = document.getElementById("forum-refresh-min");
  const refreshMaxEl = document.getElementById("forum-refresh-max");
  const refreshPassersEl = document.getElementById("forum-refresh-passers");
  const refreshCastListEl = document.getElementById("forum-refresh-cast-list");
  const refreshCastEmptyEl = document.getElementById("forum-refresh-cast-empty");
  const composeMediaEl = document.getElementById("forum-compose-media");
  const composeTitleEl = document.getElementById("forum-compose-title");
  const composeModesEl = document.querySelector("#forum-compose-wrap .forum-compose-modes");
  const composeRepostEl = document.getElementById("forum-compose-repost");
  const bgNotifyEl = document.getElementById("forum-bg-notify");
  const bgNotifyTitleEl = document.getElementById("forum-bg-notify-title");
  const bgNotifyDescEl = document.getElementById("forum-bg-notify-desc");
  const forumApiSheet = document.getElementById("forum-api-sheet");
  const forumApiEntryMetaEl = document.getElementById("forum-api-entry-meta");
  const forumAiSourceEl = document.getElementById("forum-ai-source");
  const forumAiProfileWrapEl = document.getElementById("forum-ai-profile-wrap");
  const forumAiProfileEl = document.getElementById("forum-ai-profile");
  const forumAiFieldsEl = document.getElementById("forum-ai-fields");
  const forumAiBaseEl = document.getElementById("forum-ai-base");
  const forumAiKeyEl = document.getElementById("forum-ai-key");
  const forumAiKeyNoteEl = document.getElementById("forum-ai-key-note");
  const forumAiModelEl = document.getElementById("forum-ai-model");
  const forumAiTempEl = document.getElementById("forum-ai-temperature");
  const forumAiTempValueEl = document.getElementById("forum-ai-temp-value");
  const forumAiStatusEl = document.getElementById("forum-ai-status");
  const sectorNameInputEl = document.getElementById("forum-sector-name-input");
  const shareSheet = document.getElementById("forum-share-sheet");
  const shareCharListEl = document.getElementById("forum-share-char-list");
  const shareCharEmptyEl = document.getElementById("forum-share-char-empty");

  let pendingSharePostId = null;

  const FORUM_SECTOR_WB_MAX = 6;
  const FORUM_CAST_CHAT_RECENT_CAP = 20;
  const FORUM_BG_CHECK_MS = 60000;
  const FORUM_BG_POST_MIN = 1;
  const FORUM_BG_POST_MAX = 2;
  const FORUM_GEN_TYPES = ["general", "daily", "gossip", "fanfic", "plain"];
  const FORUM_GEN_LABELS = {
    general: "综合",
    daily: "日常",
    gossip: "八卦",
    fanfic: "同人",
    plain: "跟随世界书"
  };
  const FORUM_GEN_HINTS = {
    general: "综合广场：日常、吐槽、求助、见闻、短评均可，语气像真实网友混刷。",
    daily: "偏日常碎碎念：吃喝、通勤、天气、小确幸与小倒霉，轻松真实。",
    gossip: "偏八卦吃瓜：传闻、半真半假、围观、站队、阴阳怪气但别人身攻击。",
    fanfic: "偏同人/脑洞：AU、if线、小剧场、梗图配文感，标明虚构娱乐向。",
    plain:
      "不要强加广场类型或语气标签；帖子与评论须严格贴合【世界观与板块设定】，像该世界里真实的论坛动态。"
  };

  let activeTab = "square";
  let activePostId = null;
  let posts = [];
  let conversations = [];
  let readTimestamps = {};
  let activeConvId = null;
  const lastTapAt = new Map();
  let maskForum = null;
  let sectorWbDraftIds = [];
  let sectorSheetEditingId = null;
  let refreshCastDraftIds = [];
  let composeMode = "short";
  let composeRepostSource = null;
  let profileIdEditing = false;
  let profileIdDraft = "";
  let forumRefreshRunning = false;
  let forumContinueRunning = false;
  let forumBgRunning = false;
  let forumBgTimerId = 0;

  function toast(msg) {
    if (typeof showToast === "function") showToast(msg);
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function resolveUserName() {
    if (typeof readUserMask === "function") {
      const m = readUserMask(typeof getActiveMaskIdForInbox === "function" ? getActiveMaskIdForInbox() : "");
      const n = String(m?.displayName || m?.name || "").trim();
      if (n) return n;
    }
    return "你";
  }

  function resolveMaskId() {
    if (typeof getActiveMaskIdForInbox === "function") {
      const id = String(getActiveMaskIdForInbox() || "").trim();
      if (id) return id;
    }
    const D = window.XXJ_DB;
    const raw = D?.getKv(D.K.USER_MASK_STORE);
    return String(raw?.activeId || "").trim();
  }

  function defaultSectorFields(name, id) {
    return {
      id: id || uid("sec"),
      name: String(name || "板块").trim().slice(0, 16) || "板块",
      worldBookVolumeIds: [],
      genType: "general",
      customPrompt: "",
      sectorBgActivity: false,
      castCharIds: [],
      refreshPostMin: 3,
      refreshPostMax: 6,
      includePassers: true
    };
  }

  function defaultMaskForumState() {
    return {
      forumHandle: "",
      sectors: [defaultSectorFields("综合", "main")],
      activeSectorId: "main",
      posts: [],
      conversations: [],
      readTimestamps: {},
      bgActivityEnabled: false,
      bgCooldownMin: 30,
      bgLastActivityAt: 0
    };
  }

  const FORUM_DEMO_CONV_IDS = new Set(["conv_shen", "conv_lin"]);

  function isForumDemoPost(p) {
    const id = String(p?.id || "").trim();
    return id.startsWith("demo_");
  }

  function stripForumDemoContent(st) {
    if (!st || typeof st !== "object") return;
    if (Array.isArray(st.posts)) {
      st.posts = st.posts.filter((p) => !isForumDemoPost(p));
    }
    if (Array.isArray(st.conversations)) {
      st.conversations = st.conversations.filter(
        (c) => !FORUM_DEMO_CONV_IDS.has(String(c?.id || "").trim())
      );
    }
    if (st.readTimestamps && typeof st.readTimestamps === "object") {
      for (const id of FORUM_DEMO_CONV_IDS) delete st.readTimestamps[id];
    }
    delete st.seeded;
  }

  function normalizeMaskForumState(raw) {
    const st = { ...defaultMaskForumState(), ...(raw && typeof raw === "object" ? raw : {}) };
    if (!Array.isArray(st.sectors) || !st.sectors.length) {
      st.sectors = [defaultSectorFields("综合", "main")];
    }
    st.sectors = st.sectors.map((s, i) => {
      const base = defaultSectorFields(s?.name, s?.id || `sec_${i}`);
      const genRaw = String(s?.genType || "general");
      const gen = genRaw === "char" || genRaw === "custom" ? "plain" : genRaw;
      return {
        ...base,
        name: String(s?.name || base.name).trim().slice(0, 16) || base.name,
        worldBookVolumeIds: Array.isArray(s?.worldBookVolumeIds)
          ? s.worldBookVolumeIds.map((x) => String(x || "").trim()).filter(Boolean).slice(0, FORUM_SECTOR_WB_MAX)
          : [],
        genType: FORUM_GEN_TYPES.includes(gen) ? gen : "general",
        customPrompt: String(s?.customPrompt || ""),
        sectorBgActivity: Boolean(s?.sectorBgActivity),
        castCharIds: Array.isArray(s?.castCharIds)
          ? s.castCharIds.map((x) => String(x || "").trim()).filter(Boolean)
          : [],
        refreshPostMin: Math.min(20, Math.max(1, Number(s?.refreshPostMin) || 3)),
        refreshPostMax: Math.min(20, Math.max(1, Number(s?.refreshPostMax) || 6)),
        includePassers: s?.includePassers !== false
      };
    });
    if (!st.sectors.some((s) => s.id === st.activeSectorId)) st.activeSectorId = st.sectors[0].id;
    st.forumHandle = sanitizeForumHandle(st.forumHandle, "");
    st.bgActivityEnabled = Boolean(st.bgActivityEnabled);
    st.bgCooldownMin = Math.min(240, Math.max(5, Number(st.bgCooldownMin) || 30));
    st.bgLastActivityAt = Math.max(0, Number(st.bgLastActivityAt) || 0);
    if (!Array.isArray(st.posts)) st.posts = [];
    if (!Array.isArray(st.conversations)) st.conversations = [];
    if (!st.readTimestamps || typeof st.readTimestamps !== "object") st.readTimestamps = {};
    stripForumDemoContent(st);
    return st;
  }

  function readForumStoreRoot() {
    const D = window.XXJ_DB;
    if (!D) return { v: 1, byMask: {} };
    const raw = D.getKv(D.K.FORUM_STORE);
    if (raw && raw.v === 1 && raw.byMask && typeof raw.byMask === "object") return raw;
    return { v: 1, byMask: {} };
  }

  function writeForumStoreRoot(root) {
    const D = window.XXJ_DB;
    if (!D) return;
    D.setKv(D.K.FORUM_STORE, root);
  }

  function ensureMaskForum() {
    if (maskForum) return maskForum;
    const maskId = resolveMaskId();
    const root = readForumStoreRoot();
    maskForum = normalizeMaskForumState(maskId ? root.byMask[maskId] : null);
    return maskForum;
  }

  function saveMaskForum() {
    const maskId = resolveMaskId();
    if (!maskId || !maskForum) return;
    const root = readForumStoreRoot();
    root.byMask[maskId] = maskForum;
    writeForumStoreRoot(root);
  }

  function persistForumRuntime() {
    if (!maskForum) return;
    maskForum.posts = posts;
    maskForum.conversations = conversations;
    maskForum.readTimestamps = readTimestamps;
    saveMaskForum();
  }

  function defaultForumHandle(name) {
    const hex = String(name || "")
      .split("")
      .map((c) => c.charCodeAt(0).toString(16))
      .join("")
      .slice(0, 10);
    return hex ? `wx_${hex}` : "wx_forum";
  }

  function sanitizeForumHandle(raw, fallbackName) {
    let s = String(raw || "").trim().toLowerCase();
    if (!s && fallbackName) s = defaultForumHandle(fallbackName);
    s = s.replace(/^@+/, "").replace(/\s+/g, "");
    s = s.replace(/[^a-z0-9_]/g, "").slice(0, 24);
    if (!s) s = defaultForumHandle(fallbackName || "你");
    if (!s.startsWith("wx_")) s = `wx_${s.replace(/^wx_/, "")}`.slice(0, 24);
    return s;
  }

  function resolveForumHandle() {
    const mf = ensureMaskForum();
    const name = resolveUserName();
    return sanitizeForumHandle(mf.forumHandle, name);
  }

  function worldBookStoreVolumeCount(raw) {
    if (!raw || typeof raw !== "object") return 0;
    if (Array.isArray(raw.volumes)) return raw.volumes.length;
    if (Array.isArray(raw.items)) return raw.items.length;
    return 0;
  }

  /** 世界书 KV 为 lazy 加载；论坛打开早于后台灌入时会读空。 */
  async function ensureForumKvHydrated(key) {
    const D = window.XXJ_DB;
    if (!D || !key || typeof D.readKvFromIdb !== "function") return;
    if (key === D.K.WORLD_BOOK_STORE) {
      await ensureForumWorldBookHydrated();
      return;
    }
    const cur = D.getKv(key);
    if (worldBookStoreVolumeCount(cur) > 0) return;
    if (cur !== undefined && cur !== null) return;
    try {
      const fromIdb = await D.readKvFromIdb(key);
      if (fromIdb !== undefined && fromIdb !== null) D.setKv(key, fromIdb);
    } catch {
      /* ignore */
    }
  }

  async function ensureForumPersonaHydrated() {
    const D = window.XXJ_DB;
    if (!D?.K?.CHAR_PERSONA_STORE) return;
    await ensureForumKvHydrated(D.K.CHAR_PERSONA_STORE);
  }

  function readWorldBookVolumes() {
    if (typeof readWorldBookStore === "function") {
      try {
        const st = readWorldBookStore();
        if (st && Array.isArray(st.volumes)) {
          return st.volumes.map(normalizeForumWorldBookVolume).filter(Boolean);
        }
      } catch {
        /* fall through */
      }
    }
    const D = window.XXJ_DB;
    const raw = D?.getKv(D.K.WORLD_BOOK_STORE);
    return normalizeForumWorldBookVolumesFromRaw(raw);
  }

  function forumWorldBookSearchHaystack(vol) {
    const parts = [String(vol?.title || ""), String(vol?.scope || "")];
    if (Array.isArray(vol?.entries)) {
      for (const e of vol.entries) {
        if (!e) continue;
        parts.push(String(e.title || ""), String(e.keywords || ""), String(e.content || "").slice(0, 240));
      }
    }
    return parts.join("\n").toLowerCase();
  }

  function forumWorldBookMatchesQuery(vol, q) {
    if (!q) return true;
    return forumWorldBookSearchHaystack(vol).includes(q);
  }

  function normalizeForumWorldBookVolume(vol) {
    if (!vol || typeof vol !== "object") return null;
    const id = String(vol.id || "").trim() || uid("wb");
    const title = String(vol.title || vol.name || "未命名").trim() || "未命名";
    const scopeRaw = String(vol.scope || "").trim().toLowerCase();
    const scope = scopeRaw === "global" ? "global" : "local";
    const entries = Array.isArray(vol.entries)
      ? vol.entries
          .map((e) => {
            if (!e || typeof e !== "object") return null;
            return {
              id: String(e.id || "").trim() || uid("wbe"),
              title: String(e.title || e.name || "条目").trim() || "条目",
              content: String(e.content || e.text || ""),
              keywords: String(e.keywords || e.keyword || ""),
              enabled: e.enabled !== false
            };
          })
          .filter(Boolean)
      : [];
    return { id, title, scope, entries };
  }

  function normalizeForumWorldBookVolumesFromRaw(raw) {
    if (!raw || typeof raw !== "object") return [];
    if (Array.isArray(raw.volumes)) {
      return raw.volumes.map(normalizeForumWorldBookVolume).filter(Boolean);
    }
    if (Array.isArray(raw.items) && raw.items.length) {
      return raw.items
        .map((it) => {
          if (!it || typeof it !== "object") return null;
          const title = String(it.title || it.name || "未命名").trim() || "未命名";
          return normalizeForumWorldBookVolume({
            id: it.id,
            title,
            scope: "local",
            entries: [
              {
                id: it.id,
                title,
                content: it.content || it.text,
                keywords: it.keywords || it.keyword,
                enabled: it.enabled !== false
              }
            ]
          });
        })
        .filter(Boolean);
    }
    return [];
  }

  function countForumWorldBookVolumes(raw) {
    return normalizeForumWorldBookVolumesFromRaw(raw).filter((v) => v && v.id).length;
  }

  async function ensureForumWorldBookHydrated() {
    const D = window.XXJ_DB;
    if (!D?.K?.WORLD_BOOK_STORE) return;
    if (D.ready) {
      try {
        await D.ready;
      } catch {
        /* ignore */
      }
    }
    const key = D.K.WORLD_BOOK_STORE;
    let cur = D.getKv(key);
    let curN = countForumWorldBookVolumes(cur);
    if (typeof D.readKvFromIdb === "function") {
      try {
        const fromIdb = await D.readKvFromIdb(key);
        if (fromIdb && typeof fromIdb === "object") {
          const idbN = countForumWorldBookVolumes(fromIdb);
          if (idbN > curN || (cur === undefined && idbN > 0)) {
            D.setKv(key, fromIdb);
            cur = fromIdb;
            curN = idbN;
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (typeof readWorldBookStore === "function") {
      try {
        readWorldBookStore();
      } catch {
        /* ignore */
      }
    }
  }

  function getActiveSector() {
    const mf = ensureMaskForum();
    return mf.sectors.find((s) => s.id === mf.activeSectorId) || mf.sectors[0];
  }

  function buildForumWorldContext(sector) {
    const sec = sector || getActiveSector();
    const volIds = new Set(
      Array.isArray(sec?.worldBookVolumeIds) ? sec.worldBookVolumeIds.map((x) => String(x || "").trim()).filter(Boolean) : []
    );
    const vols = readWorldBookVolumes();
    for (const v of vols) {
      if (v && v.scope === "global" && v.id) volIds.add(String(v.id));
    }
    const lines = [];
    for (const vid of volIds) {
      const vol = vols.find((x) => x && String(x.id) === String(vid));
      if (!vol || !Array.isArray(vol.entries)) continue;
      for (const e of vol.entries) {
        if (e && e.enabled === false) continue;
        const t = String(e.title || "").trim();
        const c = String(e.content || "").trim();
        if (t || c) lines.push(`[${t || "设定"}]: ${c}`);
      }
    }
    const wb = lines.join("\n");
    const extra = String(sec?.customPrompt || "").trim();
    if (!extra) return wb;
    return (wb ? wb + "\n\n" : "") + `[板块补充]\n${extra}`;
  }

  /** @param {string} name @param {string} [avatarUrl] @param {string} [classBase] */
  function buildForumAvHtml(name, avatarUrl, classBase) {
    const cls = String(classBase || "forum-cast-av").trim() || "forum-cast-av";
    const url = String(avatarUrl || "").trim();
    if (url) {
      return `<span class="${cls} ${cls}--img"><img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" /></span>`;
    }
    return `<span class="${cls}" style="--fm-av-h:${avHue(name)}">${escapeHtml(name.slice(0, 1))}</span>`;
  }

  /** @param {string} name @param {string} [avatarUrl] */
  function buildForumCastAvHtml(name, avatarUrl) {
    return buildForumAvHtml(name, avatarUrl, "forum-cast-av");
  }

  function avHue(name) {
    let h = 0;
    const s = String(name || "?");
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return Math.abs(h) % 360;
  }

  function formatRelTime(at) {
    const diff = Date.now() - Number(at);
    if (!Number.isFinite(diff) || diff < 0) return "刚刚";
    const m = Math.floor(diff / 60000);
    if (m < 1) return "刚刚";
    if (m < 60) return `${m} 分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} 小时前`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d} 天前`;
    const dt = new Date(Number(at));
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMsgTime(at) {
    const dt = new Date(Number(at));
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  function peerIdFromName(name) {
    return `peer_${String(name || "anon").replace(/\s+/g, "_")}`;
  }

  function isOwnPost(post) {
    const userName = resolveUserName();
    return post.authorName === userName && post.badge !== "角色";
  }

  function isMeSender(senderId) {
    return senderId === "user" || senderId === "main";
  }

  function findConv(id) {
    return conversations.find((c) => c.id === id) || null;
  }

  function findConvByPeer(peerName) {
    const pid = peerIdFromName(peerName);
    return conversations.find((c) => c.peerId === pid || c.peerName === peerName) || null;
  }

  function convHasUnread(conv) {
    const readTs = readTimestamps[conv.id] || 0;
    const last = conv.messages[conv.messages.length - 1];
    if (!last || last.senderId === "system") return false;
    return last.at > readTs && !isMeSender(last.senderId);
  }

  function syncUnreadDot() {
    const dot = document.getElementById("forum-msg-dot");
    if (!dot) return;
    dot.hidden = !conversations.some(convHasUnread);
  }

  function getCommentNotifs() {
    const userName = resolveUserName();
    const out = [];
    for (const p of posts) {
      if (p.authorName !== userName) continue;
      for (const c of Array.isArray(p.comments) ? p.comments : []) {
        if (c.authorName === userName) continue;
        out.push({
          name: c.authorName || "网友",
          initial: c.authorInitial || "?",
          text: `评论了你的帖子：${String(c.text || "").slice(0, 40)}`,
          at: c.at || p.at
        });
      }
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 8);
  }

  function convUnreadCount(conv) {
    const readTs = readTimestamps[conv.id] || 0;
    let n = 0;
    for (const m of conv.messages) {
      if (m.senderId === "system") continue;
      if (m.at > readTs && !isMeSender(m.senderId)) n++;
    }
    return n;
  }

  function buildConvRow(conv) {
    const last = conv.messages[conv.messages.length - 1];
    const unreadN = convUnreadCount(conv);
    const unread = unreadN > 0;
    const isSys = last?.senderId === "system";
    let preview = "打个招呼吧";
    if (last) {
      if (isSys) preview = last.content || "";
      else if (isMeSender(last.senderId)) preview = `我：${last.content || ""}`;
      else preview = last.content || "";
    }
    const badge =
      unread ? `<span class="forum-wx-chat-badge">${unreadN > 99 ? "99+" : unreadN}</span>` : "";
    const row = document.createElement("div");
    row.className = "forum-wx-chat-row-wrap";
    row.innerHTML =
      `<div class="forum-wx-chat-delete"><button type="button" class="forum-wx-chat-del-btn" data-del-conv="${escapeHtml(conv.id)}" aria-label="删除"><i class="ph ph-trash" aria-hidden="true"></i></button></div>` +
      `<button type="button" class="forum-wx-chat-row${unread ? " is-unread" : ""}" data-open-conv="${escapeHtml(conv.id)}">` +
      `<span class="forum-wx-chat-av-wrap">${badge}<span class="forum-wx-chat-av" style="--fm-av-h:${avHue(conv.peerName)}">${escapeHtml(conv.peerInitial || "?")}</span></span>` +
      `<span class="forum-wx-chat-body"><span class="forum-wx-chat-top"><strong>${escapeHtml(conv.peerName)}</strong><time>${escapeHtml(last ? formatRelTime(last.at) : "")}</time></span>` +
      `<span class="forum-wx-chat-preview">${escapeHtml(preview)}</span></span></button>`;
    return row;
  }

  function renderMessages() {
    const sorted = [...conversations].sort((a, b) => b.lastAt - a.lastAt);
    const notifs = getCommentNotifs();

    if (msgListEl) {
      msgListEl.replaceChildren();
      for (const conv of sorted) msgListEl.appendChild(buildConvRow(conv));
    }

    if (msgNotifsEl && msgNotifsWrap) {
      msgNotifsEl.replaceChildren();
      msgNotifsWrap.hidden = !notifs.length;
      for (const n of notifs) {
        const item = document.createElement("div");
        item.className = "forum-wx-notif-row";
        item.style.setProperty("--fm-av-h", String(avHue(n.name)));
        item.innerHTML =
          `<span class="forum-wx-notif-av">${escapeHtml(n.initial)}</span>` +
          `<span class="forum-wx-notif-body"><span class="forum-wx-notif-top"><strong>${escapeHtml(n.name)}</strong><time>${escapeHtml(formatRelTime(n.at))}</time></span>` +
          `<span class="forum-wx-notif-text">${escapeHtml(n.text)}</span></span>`;
        msgNotifsEl.appendChild(item);
      }
    }

    if (msgEmptyEl) msgEmptyEl.hidden = sorted.length > 0 || notifs.length > 0;
    syncUnreadDot();
  }

  function groupMessages(messages) {
    const groups = [];
    for (const m of messages) {
      const last = groups[groups.length - 1];
      if (m.senderId === "system") {
        groups.push({ system: true, msgs: [m] });
        continue;
      }
      if (last && !last.system && last.senderId === m.senderId) last.msgs.push(m);
      else groups.push({ senderId: m.senderId, msgs: [m] });
    }
    return groups;
  }

  function renderConvChat(conv) {
    if (!dmScrollEl || !conv) return;
    dmScrollEl.replaceChildren();

    const banner = document.createElement("div");
    banner.className = "forum-dm-id-banner";
    banner.innerHTML =
      `<span class="forum-dm-id-dot" aria-hidden="true"></span><span>主号 · ${escapeHtml(resolveUserName())}</span>`;
    dmScrollEl.appendChild(banner);

    const list = document.createElement("div");
    list.className = "forum-dm-bubbles";

    for (const group of groupMessages(conv.messages)) {
      if (group.system) {
        for (const m of group.msgs) {
          const sys = document.createElement("div");
          sys.className = "forum-dm-system";
          sys.textContent = m.content;
          list.appendChild(sys);
        }
        continue;
      }

      const me = isMeSender(group.senderId);
      const first = group.msgs[0];
      const row = document.createElement("div");
      row.className = "forum-dm-group" + (me ? " is-me" : " is-peer");

      let html = "";
      if (!me) {
        html += `<span class="forum-dm-bubble-av" style="--fm-av-h:${avHue(first.senderName)}">${escapeHtml(first.senderInitial || "?")}</span>`;
      } else {
        html += `<span class="forum-dm-bubble-spacer" aria-hidden="true"></span>`;
      }

      html += `<div class="forum-dm-stack">`;
      if (!me) html += `<span class="forum-dm-sender">${escapeHtml(first.senderName || conv.peerName)}</span>`;

      group.msgs.forEach((m, i) => {
        const pos =
          group.msgs.length === 1 ? "single" : i === 0 ? "first" : i === group.msgs.length - 1 ? "last" : "mid";
        html += `<div class="forum-dm-bubble is-${pos}${me ? " is-me" : ""}">${escapeHtml(m.content)}</div>`;
      });

      html += `<time class="forum-dm-time">${escapeHtml(formatMsgTime(group.msgs[group.msgs.length - 1].at))}</time></div>`;
      row.innerHTML = html;
      list.appendChild(row);
    }

    dmScrollEl.appendChild(list);
    window.requestAnimationFrame(() => {
      dmScrollEl.scrollTop = dmScrollEl.scrollHeight;
    });
  }

  function openConv(convId) {
    const conv = findConv(convId);
    if (!conv || !dmEl) return;
    activeConvId = convId;
    readTimestamps[convId] = Date.now();
    if (dmPeerNameEl) dmPeerNameEl.textContent = conv.peerName;
    if (dmPeerAvEl) {
      dmPeerAvEl.textContent = conv.peerInitial || "?";
      dmPeerAvEl.style.setProperty("--fm-av-h", String(avHue(conv.peerName)));
    }
    renderConvChat(conv);
    dmEl.hidden = false;
    if (dmInputEl) {
      dmInputEl.value = "";
      window.setTimeout(() => dmInputEl.focus(), 80);
    }
    syncDmSend();
    syncUnreadDot();
  }

  function closeConv() {
    activeConvId = null;
    if (dmEl) dmEl.hidden = true;
  }

  function ensureConv(peerName, peerInitial) {
    let conv = findConvByPeer(peerName);
    if (conv) return conv;
    conv = {
      id: uid("conv"),
      peerId: peerIdFromName(peerName),
      peerName,
      peerInitial: peerInitial || peerName.slice(0, 1) || "?",
      messages: [],
      lastAt: Date.now()
    };
    conversations.unshift(conv);
    return conv;
  }

  function openDmWith(peerName, peerInitial) {
    const name = String(peerName || "").trim();
    if (!name) return;
    const conv = ensureConv(name, peerInitial);
    if (activeTab !== "messages") {
      activeTab = "messages";
      syncTabs();
    }
    openConv(conv.id);
  }

  function appendDmMessage(conv, msg) {
    conv.messages.push(msg);
    conv.lastAt = msg.at;
  }

  function sendDm() {
    const text = String(dmInputEl?.value || "").trim();
    if (!text || !activeConvId) return;
    const conv = findConv(activeConvId);
    if (!conv) return;
    const userName = resolveUserName();
    appendDmMessage(conv, {
      id: uid("dm"),
      senderId: "user",
      senderName: userName,
      senderInitial: userName.slice(0, 1) || "你",
      content: text,
      at: Date.now()
    });
    if (dmInputEl) dmInputEl.value = "";
    syncDmSend();
    renderConvChat(conv);
    renderMessages();
    persistForumRuntime();
  }

  function deleteConv(convId) {
    conversations = conversations.filter((c) => c.id !== convId);
    delete readTimestamps[convId];
    if (activeConvId === convId) closeConv();
    renderMessages();
    persistForumRuntime();
  }

  function syncDmSend() {
    if (!dmSendEl || !dmInputEl) return;
    dmSendEl.disabled = !String(dmInputEl.value || "").trim();
  }

  function filterPosts(list) {
    const mf = ensureMaskForum();
    const sid = mf.activeSectorId || "main";
    return list.filter((p) => !p.sectorId || p.sectorId === sid);
  }

  function renderSectorBar() {
    const mf = ensureMaskForum();
    if (!sectorChipsEl) return;
    sectorChipsEl.replaceChildren();
    for (const sec of mf.sectors) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "forum-sector-chip" + (sec.id === mf.activeSectorId ? " is-active" : "");
      btn.dataset.sectorId = sec.id;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", sec.id === mf.activeSectorId ? "true" : "false");
      btn.textContent = sec.name;
      sectorChipsEl.appendChild(btn);
    }
    syncSectorWbBanner();
  }

  function syncSectorWbBanner() {
    const sec = getActiveSector();
    const vols = readWorldBookVolumes();
    const bound = (sec?.worldBookVolumeIds || [])
      .map((id) => vols.find((v) => v && String(v.id) === String(id)))
      .filter(Boolean);
    const globalN = vols.filter((v) => v && v.scope === "global").length;
    if (!sectorWbBannerEl || !sectorWbBannerTextEl) return;
    if (!bound.length && !globalN) {
      sectorWbBannerEl.hidden = true;
      return;
    }
    const names = bound.map((v) => String(v.title || "未命名").trim() || "未命名");
    let text = names.length ? `世界观：${names.join("、")}` : "";
    if (globalN) text += (text ? " · " : "") + `全局 ${globalN} 本`;
    sectorWbBannerTextEl.textContent = text;
    sectorWbBannerEl.hidden = false;
  }

  function listForumChars() {
    if (typeof readCharPersonaStore !== "function") return [];
    const st = readCharPersonaStore();
    return (st.items || []).filter((c) => c && c.id && !c.isGroup);
  }

  function charDisplayName(c) {
    return String(c?.displayName || c?.name || "").trim() || "未命名角色";
  }

  function resolveForumGenStyleBlock(sec) {
    const gen = String(sec?.genType || "general");
    const genLabel = FORUM_GEN_LABELS[gen] || "综合";
    return {
      label: genLabel,
      hint: FORUM_GEN_HINTS[gen] || FORUM_GEN_HINTS.general
    };
  }

  function syncSectorSheetFieldsFromSector(sec) {
    const gen = String(sec?.genType || "general");
    if (sectorGenChipsEl) {
      sectorGenChipsEl.querySelectorAll(".forum-gen-chip").forEach((btn) => {
        const on = btn.getAttribute("data-gen-type") === gen;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    if (sectorCustomPromptEl) sectorCustomPromptEl.value = String(sec?.customPrompt || "");
    if (sectorNameInputEl) sectorNameInputEl.value = String(sec?.name || "").trim();
    if (sectorBgToggleEl) sectorBgToggleEl.checked = Boolean(sec?.sectorBgActivity);
    const mf = ensureMaskForum();
    if (globalBgToggleEl) globalBgToggleEl.checked = Boolean(mf.bgActivityEnabled);
    if (globalBgCooldownEl) globalBgCooldownEl.value = String(mf.bgCooldownMin || 30);
  }

  function applySectorSheetFieldsToSector(sec) {
    if (!sec) return;
    const activeGen = sectorGenChipsEl?.querySelector(".forum-gen-chip.is-active");
    sec.genType = FORUM_GEN_TYPES.includes(activeGen?.getAttribute("data-gen-type"))
      ? activeGen.getAttribute("data-gen-type")
      : "general";
    sec.customPrompt = String(sectorCustomPromptEl?.value || "").trim();
    const nameRaw = String(sectorNameInputEl?.value || "").trim().slice(0, 16);
    if (nameRaw) sec.name = nameRaw;
    sec.sectorBgActivity = Boolean(sectorBgToggleEl?.checked);
    const mf = ensureMaskForum();
    mf.bgActivityEnabled = Boolean(globalBgToggleEl?.checked);
    mf.bgCooldownMin = Math.min(240, Math.max(5, Number(globalBgCooldownEl?.value) || 30));
  }

  function renderRefreshCastList() {
    if (!refreshCastListEl) return;
    const chars = listForumChars();
    if (refreshCastEmptyEl) refreshCastEmptyEl.hidden = chars.length > 0;
    refreshCastListEl.replaceChildren();
    for (const c of chars) {
      const id = String(c.id);
      const name = charDisplayName(c);
      const on = refreshCastDraftIds.includes(id);
      const row = document.createElement("label");
      row.className = "forum-cast-row" + (on ? " is-on" : "");
      row.innerHTML =
        `<input type="checkbox" ${on ? "checked" : ""} data-cast-char-id="${escapeHtml(id)}" />` +
        buildForumCastAvHtml(name, String(c.avatar || "").trim()) +
        `<span class="forum-cast-name">${escapeHtml(name)}</span>`;
      refreshCastListEl.appendChild(row);
    }
  }

  function openRefreshSheet() {
    const mf = ensureMaskForum();
    const sec = getActiveSector();
    if (refreshSectorNameEl) refreshSectorNameEl.textContent = `当前板块 · ${sec?.name || "综合"}`;
    if (refreshMinEl) refreshMinEl.value = String(sec?.refreshPostMin ?? 3);
    if (refreshMaxEl) refreshMaxEl.value = String(sec?.refreshPostMax ?? 6);
    if (refreshPassersEl) refreshPassersEl.checked = sec?.includePassers !== false;
    refreshCastDraftIds = [...(sec?.castCharIds || [])];
    renderRefreshCastList();
    if (!refreshSheet) return;
    refreshSheet.hidden = false;
    refreshSheet.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => refreshSheet.classList.add("is-open"));
    void ensureForumPersonaHydrated().then(() => renderRefreshCastList());
  }

  function closeRefreshSheet() {
    if (!refreshSheet) return;
    refreshSheet.classList.remove("is-open");
    refreshSheet.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      refreshSheet.hidden = true;
    }, 280);
  }

  function saveRefreshSheetToSector() {
    const mf = ensureMaskForum();
    const sec = getActiveSector();
    if (!sec) return;
    let minN = Math.max(1, Number(refreshMinEl?.value) || 3);
    let maxN = Math.max(1, Number(refreshMaxEl?.value) || 6);
    if (minN > maxN) [minN, maxN] = [maxN, minN];
    sec.refreshPostMin = Math.min(20, minN);
    sec.refreshPostMax = Math.min(20, maxN);
    sec.includePassers = Boolean(refreshPassersEl?.checked);
    sec.castCharIds = [...refreshCastDraftIds];
    saveMaskForum();
  }

  function normalizeForumAiTemperature(v, fallback) {
    const n = Number(v);
    const fb = Number(fallback);
    const base = Number.isFinite(n) ? n : Number.isFinite(fb) ? fb : 0.92;
    return Math.min(2, Math.max(0, Math.round(base * 100) / 100));
  }

  function normalizeForumAiConfig(raw) {
    const ai = window.RP_AI;
    const defBase = ai?.DEFAULT_BASE || "https://api.openai.com/v1";
    const defModel = ai?.DEFAULT_MODEL || "gpt-4o-mini";
    const defTemp = ai?.DEFAULT_TEMPERATURE ?? 0.92;
    const o = raw && typeof raw === "object" ? raw : {};
    let apiMode = String(o.apiMode || "").trim();
    if (!apiMode) {
      if (o.useMainApi == null || o.useMainApi) apiMode = "main";
      else if (String(o.profileId || "").trim()) apiMode = "profile";
      else apiMode = "custom";
    }
    if (!["main", "profile", "custom"].includes(apiMode)) apiMode = "main";
    let baseUrl = String(o.baseUrl || "").trim();
    if (ai?.resolveOpenAiV1Base) baseUrl = ai.resolveOpenAiV1Base(baseUrl || defBase);
    else if (!baseUrl) baseUrl = defBase;
    return {
      v: 1,
      apiMode,
      profileId: String(o.profileId || "").trim(),
      baseUrl,
      apiKey: String(o.apiKey || "").trim(),
      model: (String(o.model || "").trim() || defModel),
      temperature: normalizeForumAiTemperature(o.temperature, defTemp)
    };
  }

  function forumProfileToCompletionConfig(profile) {
    const ai = window.RP_AI;
    const p = profile && typeof profile === "object" ? profile : {};
    const defBase = ai?.DEFAULT_BASE || "https://api.openai.com/v1";
    const defModel = ai?.DEFAULT_MODEL || "gpt-4o-mini";
    const defTemp = ai?.DEFAULT_TEMPERATURE ?? 0.92;
    let baseUrl = String(p.baseUrl || "").trim() || defBase;
    if (ai?.resolveOpenAiV1Base) baseUrl = ai.resolveOpenAiV1Base(baseUrl);
    return {
      baseUrl,
      apiKey: String(p.apiKey || "").trim(),
      model: (String(p.model || "").trim() || defModel),
      temperature: normalizeForumAiTemperature(p.temperature, defTemp)
    };
  }

  function readForumAiProfiles() {
    const ai = window.RP_AI;
    if (!ai?.readProfiles) return [];
    return ai.readProfiles().filter((p) => p && p.id);
  }

  function refreshForumAiProfileSelect() {
    if (!forumAiProfileEl) return;
    const list = readForumAiProfiles();
    const saved = String(readForumAiConfig().profileId || "").trim();
    forumAiProfileEl.replaceChildren();
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = list.length ? "— 请选择档案 —" : "— 请先在设置里保存档案 —";
    forumAiProfileEl.appendChild(opt0);
    for (const p of list) {
      const o = document.createElement("option");
      o.value = String(p.id || "");
      o.textContent = `${p.name || "未命名"} · ${p.model || ""}`;
      forumAiProfileEl.appendChild(o);
    }
    forumAiProfileEl.value = saved && list.some((p) => String(p.id) === saved) ? saved : "";
  }

  function readForumAiConfig() {
    const D = window.XXJ_DB;
    if (!D?.K?.FORUM_AI_CONFIG) return normalizeForumAiConfig(null);
    const raw = D.getKv(D.K.FORUM_AI_CONFIG);
    if (raw && raw.v === 1) return normalizeForumAiConfig(raw);
    const init = normalizeForumAiConfig(null);
    D.setKv(D.K.FORUM_AI_CONFIG, init);
    return init;
  }

  function writeForumAiConfig(cfg) {
    const D = window.XXJ_DB;
    if (!D?.K?.FORUM_AI_CONFIG) return;
    D.setKv(D.K.FORUM_AI_CONFIG, normalizeForumAiConfig(cfg));
  }

  function resolveForumCompletionConfig() {
    const ai = window.RP_AI;
    if (!ai?.getConfig) return null;
    const cfg = readForumAiConfig();
    const main = ai.getConfig();
    if (cfg.apiMode === "main") return main;
    if (cfg.apiMode === "profile") {
      const pid = String(cfg.profileId || "").trim();
      const p = readForumAiProfiles().find((x) => String(x.id) === pid);
      if (!p) return null;
      const c = forumProfileToCompletionConfig(p);
      return String(c.apiKey || "").trim() ? c : null;
    }
    const apiKey = String(cfg.apiKey || "").trim();
    if (!apiKey) return null;
    return {
      baseUrl: cfg.baseUrl || main.baseUrl,
      apiKey,
      model: cfg.model || main.model,
      temperature: cfg.temperature ?? main.temperature
    };
  }

  function forumAiKeyMissingMessage() {
    const cfg = readForumAiConfig();
    if (cfg.apiMode === "main") return "请先在「我的 → 连接 API」填写 API Key";
    if (cfg.apiMode === "profile") return "请在论坛 API 接入里选择配置档案";
    return "请先在论坛 API 接入里填写 Key";
  }

  function hasForumAiKey() {
    const c = resolveForumCompletionConfig();
    return Boolean(String(c?.apiKey || "").trim());
  }

  function syncForumApiEntryMeta() {
    if (!forumApiEntryMetaEl) return;
    const cfg = readForumAiConfig();
    if (!hasForumAiKey()) {
      forumApiEntryMetaEl.textContent = "未配置";
      return;
    }
    if (cfg.apiMode === "main") {
      forumApiEntryMetaEl.textContent = "密谈主 API";
      return;
    }
    if (cfg.apiMode === "profile") {
      const p = readForumAiProfiles().find((x) => String(x.id) === cfg.profileId);
      forumApiEntryMetaEl.textContent = p ? `档案 · ${p.name}` : "配置档案";
      return;
    }
    forumApiEntryMetaEl.textContent = "独立填写";
  }

  function syncForumApiSourceUi() {
    const mode = String(forumAiSourceEl?.value || "main").trim();
    if (forumAiProfileWrapEl) forumAiProfileWrapEl.hidden = mode !== "profile";
    if (forumAiFieldsEl) forumAiFieldsEl.hidden = mode !== "custom";
  }

  function syncForumAiKeyNote() {
    if (!forumAiKeyNoteEl) return;
    const cfg = readForumAiConfig();
    const has = Boolean(cfg.apiKey);
    if (forumAiKeyEl) {
      forumAiKeyEl.value = "";
      forumAiKeyEl.placeholder = has
        ? "本机已保存 Key · 输入新值可覆盖，留空保存不改"
        : "在此粘贴 sk-…";
    }
    forumAiKeyNoteEl.textContent = has
      ? "Key 保存在本机；留空点保存不会删除"
      : "尚未保存论坛专用 Key";
  }

  function fillForumAiFormFromConfig() {
    const cfg = readForumAiConfig();
    refreshForumAiProfileSelect();
    if (forumAiSourceEl) forumAiSourceEl.value = cfg.apiMode || "main";
    if (forumAiProfileEl) {
      forumAiProfileEl.value =
        cfg.profileId && readForumAiProfiles().some((p) => String(p.id) === cfg.profileId)
          ? cfg.profileId
          : "";
    }
    if (forumAiBaseEl) forumAiBaseEl.value = cfg.baseUrl || "";
    if (forumAiModelEl) forumAiModelEl.value = cfg.model || "";
    if (forumAiTempEl) forumAiTempEl.value = String(cfg.temperature ?? 0.92);
    if (forumAiTempValueEl) {
      forumAiTempValueEl.textContent = Number(cfg.temperature ?? 0.92).toFixed(2);
    }
    syncForumAiKeyNote();
    syncForumApiSourceUi();
    if (forumAiStatusEl) forumAiStatusEl.textContent = "";
  }

  function openForumApiSheet() {
    if (!forumApiSheet) return;
    fillForumAiFormFromConfig();
    forumApiSheet.hidden = false;
    forumApiSheet.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => forumApiSheet.classList.add("is-open"));
  }

  function closeForumApiSheet() {
    if (!forumApiSheet) return;
    forumApiSheet.classList.remove("is-open");
    forumApiSheet.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      forumApiSheet.hidden = true;
    }, 280);
    syncForumApiEntryMeta();
  }

  function saveForumApiSheet() {
    const ai = window.RP_AI;
    const prev = readForumAiConfig();
    const main = ai?.getConfig?.() || {};
    const apiMode = String(forumAiSourceEl?.value || "main").trim();
    if (!["main", "profile", "custom"].includes(apiMode)) {
      toast("请选择接口来源");
      return;
    }
    let patch;
    if (apiMode === "main") {
      patch = {
        apiMode: "main",
        profileId: "",
        baseUrl: prev.baseUrl,
        apiKey: prev.apiKey,
        model: prev.model,
        temperature: prev.temperature
      };
    } else if (apiMode === "profile") {
      const profileId = String(forumAiProfileEl?.value || "").trim();
      if (!profileId) {
        toast("请选择配置档案");
        return;
      }
      const p = readForumAiProfiles().find((x) => String(x.id) === profileId);
      if (!p || !String(p.apiKey || "").trim()) {
        toast("该档案没有 Key，请先在设置里保存");
        return;
      }
      patch = {
        apiMode: "profile",
        profileId,
        baseUrl: prev.baseUrl,
        apiKey: prev.apiKey,
        model: prev.model,
        temperature: prev.temperature
      };
    } else {
      let apiKey = prev.apiKey;
      const keyRaw = String(forumAiKeyEl?.value || "").trim();
      if (keyRaw) apiKey = keyRaw;
      if (!apiKey) {
        toast("请填写 API Key");
        return;
      }
      patch = {
        apiMode: "custom",
        profileId: "",
        baseUrl: String(forumAiBaseEl?.value || "").trim() || main.baseUrl,
        apiKey,
        model: String(forumAiModelEl?.value || "").trim() || main.model,
        temperature: normalizeForumAiTemperature(forumAiTempEl?.value, main.temperature)
      };
    }
    writeForumAiConfig(patch);
    syncForumAiKeyNote();
    syncForumApiEntryMeta();
    if (forumAiStatusEl) forumAiStatusEl.textContent = "已保存";
    toast("论坛 API 已保存");
    closeForumApiSheet();
  }

  function parseForumJsonFromAi(raw) {
    let clean = String(raw || "").trim();
    if (!clean) return null;
    clean = clean.replace(/```json/gi, "").replace(/```/g, "").trim();
    const fb = clean.indexOf("[");
    const lb = clean.lastIndexOf("]");
    const fo = clean.indexOf("{");
    const lo = clean.lastIndexOf("}");
    if (fb !== -1 && lb > fb) {
      try {
        return JSON.parse(clean.slice(fb, lb + 1));
      } catch {
        /* fall through */
      }
    }
    if (fo !== -1 && lo > fo) {
      try {
        return JSON.parse(clean.slice(fo, lo + 1));
      } catch {
        return null;
      }
    }
    try {
      return JSON.parse(clean);
    } catch {
      return null;
    }
  }

  function getForumCastChars(sec) {
    const ids = new Set(
      Array.isArray(sec?.castCharIds) ? sec.castCharIds.map((x) => String(x || "").trim()).filter(Boolean) : []
    );
    if (!ids.size) return [];
    return listForumChars().filter((c) => ids.has(String(c.id)));
  }

  function buildForumCastChatSnippet(maskId, castChar) {
    const mid = String(maskId || "").trim();
    const cid = String(castChar?.id || "").trim();
    if (!mid || !cid || typeof listDmThreadsForChar !== "function") return "";
    const dmList = listDmThreadsForChar(mid, cid);
    const dmTh = dmList && dmList[0];
    if (!dmTh) return "";
    const dmId = String(dmTh.id || "").trim();
    if (!dmId) return "";

    const charNm = charDisplayName(castChar);
    const mask = typeof readUserMask === "function" ? readUserMask(mid) : null;
    const parts = [];

    if (typeof buildCharThreadMemoryTimelineForPrompt === "function") {
      const mem = buildCharThreadMemoryTimelineForPrompt(dmTh);
      if (mem) {
        parts.push(
          mem.replace(
            "[本密谈 · 记忆摘要时间线]",
            `[${charNm} · 密谈记忆摘要]`
          )
        );
      }
    }

    if (
      typeof readChatLogForMaskThread === "function" &&
      typeof formatLinkedDmRecentMessagesForPrompt === "function"
    ) {
      const log = readChatLogForMaskThread(mid, dmId);
      const recent = formatLinkedDmRecentMessagesForPrompt(
        log,
        dmTh,
        cid,
        mask,
        FORUM_CAST_CHAT_RECENT_CAP
      ).replace(/\[P\|私聊·/g, "[密谈·");
      if (recent) {
        parts.push(
          `[${charNm} · 密谈最近消息（节选）]\n${recent}\n（与当前私聊气泡矛盾时以气泡为准。）`
        );
      }
    }

    return parts.length ? parts.join("\n\n") : "";
  }

  function buildForumCastChatBlock(castChars, maskId) {
    if (!castChars.length) return "";
    const snippets = [];
    for (const c of castChars) {
      const block = buildForumCastChatSnippet(maskId, c);
      if (block) snippets.push(block);
    }
    if (!snippets.length) return "";
    return [
      "【密谈记忆参考（只读）】",
      "摘自出镜角色与主控的密谈：把握口吻、情绪与近期私下剧情。论坛是公开广场，勿照搬私聊原句，勿泄露仅密谈可知的信息。",
      "",
      snippets.join("\n\n---\n\n")
    ].join("\n");
  }

  function buildForumCastBlock(castChars) {
    if (!castChars.length) return "【出镜角色】未指定；可用符合世界观的网友昵称发帖。";
    const lines = ["【出镜角色】发帖作者须使用下列显示名（至少一半帖子来自他们）："];
    for (const c of castChars) {
      const name = charDisplayName(c);
      const bits = [];
      const summary = String(c?.summary || "").trim();
      const tags = String(c?.tags || "").trim();
      const voice = String(c?.voice || "").trim();
      if (summary) bits.push(summary.slice(0, 160));
      if (tags) bits.push(`标签：${tags.slice(0, 60)}`);
      if (voice) bits.push(`口吻：${voice.slice(0, 80)}`);
      lines.push(`- ${name}${bits.length ? "：" + bits.join("；") : ""}`);
    }
    return lines.join("\n");
  }

  function buildForumRefreshMessages(sec, postCount, worldContext) {
    const { label: genLabel, hint: genHint } = resolveForumGenStyleBlock(sec);
    const castChars = getForumCastChars(sec);
    const castChatBlock = buildForumCastChatBlock(castChars, resolveMaskId());
    const includePassers = sec?.includePassers !== false;
    const userName = resolveUserName();
    const passersRule = includePassers
      ? "允许路人网友（非出镜角色）发帖与评论；路人名 2～6 字，像网名或真名，禁止「神秘人」「某网友」。"
      : "禁止路人：所有 author 必须来自【出镜角色】显示名；若未指定角色则只用世界观内合理人名。";
    const sys = [
      "你是论坛广场帖生成器。只输出一个 JSON 对象，不要 markdown 代码围栏，不要解释文字。",
      "必填键 posts：数组，长度须等于用户要求的篇数。每项包含：",
      "- author（字符串，2～8 字人名/昵称）",
      "- content（字符串，可短可长：说说几十字、长帖可千字以上，按内容需要写满，可换行）",
      "- tags（可选，字符串数组，1～3 个短标签，不带 #）",
      "- comments（可选，0～6 条，每项 { author, text }，长短自然）",
      "",
      "内容须有具体细节、情绪或观点；禁止空泛鸡汤与营销腔。",
      "评论可接梗、吐槽、追问，但不要写成连续剧本对话。",
      "评论 author **禁止**使用主控/广场用户昵称（主控只在密谈里手动评论，AI 不要代写）。",
      "禁止露骨色情；可暗示、可吃瓜、可阴阳怪气但别人身攻击。"
    ].join("\n");
    const userParts = [
      `板块：${sec?.name || "综合"}（风格：${genLabel}）`,
      genHint,
      "",
      passersRule,
      "",
      buildForumCastBlock(castChars)
    ];
    if (castChatBlock) userParts.push(castChatBlock);
    userParts.push(
      "",
      `主控广场昵称（仅作识别，**禁止**出现在评论 author 中）：${userName}`,
      "",
      "【世界观与板块设定】",
      String(worldContext || "").trim() ||
        "（未绑定世界书也未写板块补充：请按板块风格与出镜角色自由发挥，内容仍要具体、像真网友发帖。）",
      "",
      `请生成 ${postCount} 篇新帖，输出 JSON：{ "posts": [ ... ] }`
    );
    const user = userParts.join("\n");
    return [
      { role: "system", content: sys },
      { role: "user", content: user }
    ];
  }

  async function forumAiComplete(messages, opts) {
    const ai = window.RP_AI;
    if (!ai?.chatCompletions) throw new Error("AI 模块未加载");
    const completionConfig = resolveForumCompletionConfig();
    if (!String(completionConfig?.apiKey || "").trim()) {
      throw new Error(forumAiKeyMissingMessage());
    }
    const o = opts && typeof opts === "object" ? opts : {};
    const reqOpts = {
      messages,
      response_format: o.response_format || { type: "json_object" },
      completionConfig
    };
    const maxTok =
      o.max_tokens != null && Number.isFinite(Number(o.max_tokens)) ? Number(o.max_tokens) : null;
    if (maxTok != null && maxTok > 0) {
      if (typeof spreadOptionalMaxTokens === "function") {
        Object.assign(reqOpts, spreadOptionalMaxTokens(maxTok));
      } else {
        reqOpts.max_tokens = maxTok;
      }
    }
    const temp =
      o.temperature != null && Number.isFinite(Number(o.temperature))
        ? Number(o.temperature)
        : completionConfig.temperature;
    if (typeof requestChatAssistantCompletion === "function") {
      const data = await requestChatAssistantCompletion(ai, reqOpts);
      const text =
        typeof readChatCompletionChoiceText === "function" ? readChatCompletionChoiceText(data) : "";
      if (!String(text || "").trim()) throw new Error("模型未返回内容，请换模型或稍后重试");
      return text;
    }
    const fetchOpts = { completionConfig };
    const payload = { ...reqOpts, temperature: temp };
    const data = await ai.chatCompletions(payload, fetchOpts);
    const text =
      typeof readChatCompletionChoiceText === "function"
        ? readChatCompletionChoiceText(data)
        : String(data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "").trim();
    if (!text) throw new Error("模型未返回内容，请换模型或稍后重试");
    return text;
  }

  function forumAiSkipsUserCommentAuthor(authorName, userName) {
    const a = String(authorName || "").trim();
    const b = String(userName || "").trim();
    return a && b && a === b;
  }

  function normalizeForumAiPosts(parsed, sec, opts) {
    const castChars = opts?.castChars || [];
    const castNames = new Set(castChars.map((c) => charDisplayName(c)));
    const includePassers = opts?.includePassers !== false;
    const me = resolveUserName();
    let rawPosts = [];
    if (Array.isArray(parsed)) rawPosts = parsed;
    else if (parsed && typeof parsed === "object" && Array.isArray(parsed.posts)) rawPosts = parsed.posts;
    const now = Date.now();
    const out = [];
    for (let i = 0; i < rawPosts.length; i++) {
      const p = rawPosts[i];
      if (!p || typeof p !== "object") continue;
      const author = String(p.author || p.authorName || "").trim().slice(0, 24);
      const content = String(p.content || p.text || "").trim();
      if (!author || !content) continue;
      if (!includePassers && !castNames.has(author) && author !== me) continue;
      const isCast = castNames.has(author);
      const comments = [];
      const rawCmts = Array.isArray(p.comments) ? p.comments : [];
      for (let j = 0; j < rawCmts.length && comments.length < 12; j++) {
        const c = rawCmts[j];
        const ca = String(c?.author || c?.authorName || "").trim().slice(0, 24);
        const ct = String(c?.text || c?.content || "").trim();
        if (!ca || !ct) continue;
        if (forumAiSkipsUserCommentAuthor(ca, me)) continue;
        if (!includePassers && !castNames.has(ca)) continue;
        const cRow = forumCommentAuthorFields(ca);
        comments.push({
          id: uid("fc"),
          ...cRow,
          text: ct,
          at: now - (rawCmts.length - j) * 45000 - i * 120000
        });
      }
      const tags = Array.isArray(p.tags)
        ? p.tags.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean).slice(0, 5)
        : [];
      const stagger = (rawPosts.length - i) * (10 + Math.floor(Math.random() * 35)) * 60000;
      const authorRow = forumCommentAuthorFields(author);
      const row = {
        id: uid("fp"),
        ...authorRow,
        content,
        tags,
        likes: [],
        comments,
        at: now - stagger,
        sectorId: sec?.id || "main"
      };
      if (isCast) row.badge = "角色";
      out.push(row);
    }
    return out;
  }

  function getSectorById(sectorId) {
    const mf = ensureMaskForum();
    const sid = String(sectorId || "").trim();
    if (!sid) return getActiveSector();
    return mf.sectors.find((s) => s.id === sid) || getActiveSector();
  }

  function findForumCharByDisplayName(name) {
    const n = String(name || "").trim();
    if (!n) return null;
    return listForumChars().find((c) => charDisplayName(c) === n) || null;
  }

  /** @param {unknown} charRec */
  function forumCharAvatarUrl(charRec) {
    return String(charRec?.avatar || "").trim();
  }

  /** @param {string} authorName */
  function forumAvatarForAuthorName(authorName) {
    const ch = findForumCharByDisplayName(authorName);
    return ch ? forumCharAvatarUrl(ch) : "";
  }

  /** @param {unknown} stored @param {string} authorName */
  function resolveForumAuthorAvatar(stored, authorName) {
    const s = String(stored || "").trim();
    return s || forumAvatarForAuthorName(authorName);
  }

  /** @param {string} authorName @returns {{ authorName: string, authorInitial: string, authorAvatar?: string }} */
  function forumCommentAuthorFields(authorName) {
    const name = String(authorName || "").trim().slice(0, 24);
    const ch = findForumCharByDisplayName(name);
    const avatar = ch ? forumCharAvatarUrl(ch) : "";
    const row = {
      authorName: name,
      authorInitial: name.slice(0, 1) || "?"
    };
    if (avatar) row.authorAvatar = avatar;
    return row;
  }

  function formatForumCommentsForPrompt(post) {
    const cmts = Array.isArray(post?.comments) ? post.comments : [];
    if (!cmts.length) return "（暂无评论）";
    return cmts
      .map((c) => `${String(c.authorName || "网友").trim()}：${String(c.text || "").trim()}`)
      .join("\n");
  }

  function buildForumContinueMessages(post, sec, worldContext) {
    const castChars = getForumCastChars(sec);
    const authorChar = findForumCharByDisplayName(post?.authorName);
    const castChatBlock = authorChar
      ? buildForumCastChatBlock([authorChar], resolveMaskId())
      : "";
    const includePassers = sec?.includePassers !== false;
    const passersRule = includePassers
      ? "评论者可含路人网友与出镜角色；网名 2～6 字，禁止「神秘人」「某网友」。**禁止**主控/广场用户昵称作评论 author。"
      : "禁止路人：评论 author 须来自【出镜角色】显示名或帖主。**禁止**主控/广场用户昵称。";
    const tags =
      Array.isArray(post?.tags) && post.tags.length
        ? post.tags.map((t) => `#${String(t).replace(/^#/, "")}`).join(" ")
        : "";
    const sys = [
      "你是论坛帖子评论区续写器。只输出一个 JSON 对象，不要 markdown 代码围栏，不要解释文字。",
      "必填键 comments：数组，长度 3～6。每项 { author（2～8 字）, text（评论正文，长短自然） }。",
      "承接已有评论与帖文，可接梗、吐槽、追问、站队；不要重复已出现过的观点原句。",
      "不要写成连续剧本对话；禁止露骨色情与人身攻击。",
      "评论 author **禁止**使用主控/广场用户昵称（主控只在密谈里手动评论）。"
    ].join("\n");
    const userParts = [
      `板块：${sec?.name || "综合"}`,
      passersRule,
      "",
      buildForumCastBlock(castChars),
      castChatBlock || null,
      "",
      "【原帖】",
      `作者：${String(post?.authorName || "网友").trim()}`,
      tags ? `标签：${tags}` : null,
      String(post?.content || "").trim() || "（无正文）",
      "",
      "【已有评论】",
      formatForumCommentsForPrompt(post),
      "",
      "【世界观与板块设定】",
      String(worldContext || "").trim() || "（按板块与出镜角色自由发挥，评论要具体、像真网友。）",
      "",
      "请续写 3～6 条新评论，输出 JSON：{ \"comments\": [ ... ] }"
    ];
    const user = userParts.filter((line) => line != null).join("\n");
    return [
      { role: "system", content: sys },
      { role: "user", content: user }
    ];
  }

  function normalizeForumContinueComments(parsed, post, sec) {
    const castChars = getForumCastChars(sec);
    const castNames = new Set(castChars.map((c) => charDisplayName(c)));
    const includePassers = sec?.includePassers !== false;
    const me = resolveUserName();
    const op = String(post?.authorName || "").trim();
    let raw = [];
    if (Array.isArray(parsed)) raw = parsed;
    else if (parsed && typeof parsed === "object" && Array.isArray(parsed.comments)) raw = parsed.comments;
    const baseAt = Date.now();
    const out = [];
    for (let i = 0; i < raw.length && out.length < 8; i++) {
      const c = raw[i];
      const ca = String(c?.author || c?.authorName || "").trim().slice(0, 24);
      const ct = String(c?.text || c?.content || "").trim();
      if (!ca || !ct) continue;
      if (forumAiSkipsUserCommentAuthor(ca, me)) continue;
      if (!includePassers && !castNames.has(ca) && ca !== op) continue;
      out.push({
        id: uid("fc"),
        ...forumCommentAuthorFields(ca),
        text: ct,
        at: baseAt + i * 45000
      });
    }
    return out;
  }

  function setDetailToolsBusy(on) {
    const continueBtn = document.getElementById("forum-detail-continue-btn");
    const shareBtn = document.getElementById("forum-detail-share-btn");
    if (on) {
      continueBtn?.setAttribute("disabled", "true");
      shareBtn?.setAttribute("disabled", "true");
    } else {
      continueBtn?.removeAttribute("disabled");
      shareBtn?.removeAttribute("disabled");
    }
  }

  async function runForumDetailContinue() {
    if (forumContinueRunning || forumBgRunning || !activePostId) return;
    const post = findPost(activePostId);
    if (!post) return;
    if (!hasForumAiKey()) {
      toast(forumAiKeyMissingMessage());
      return;
    }
    const sec = getSectorById(post.sectorId);
    forumContinueRunning = true;
    setDetailToolsBusy(true);
    toast("续聊中…");
    try {
      await ensureForumWorldBookHydrated();
      if (typeof ensureChatInboxForUi === "function") {
        await ensureChatInboxForUi();
      }
      const messages = buildForumContinueMessages(post, sec, buildForumWorldContext(sec));
      const raw = await forumAiComplete(messages, {
        temperature: 0.92,
        response_format: { type: "json_object" }
      });
      const parsed = parseForumJsonFromAi(raw);
      const newCmts = normalizeForumContinueComments(parsed, post, sec);
      if (!newCmts.length) {
        toast("没有生成新评论，请换模型或稍后重试");
        return;
      }
      if (!Array.isArray(post.comments)) post.comments = [];
      post.comments.push(...newCmts);
      persistForumRuntime();
      renderFeed();
      renderDetail(post);
      toast(`续聊 +${newCmts.length} 条评论`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e || "续聊失败");
      toast(msg.length > 72 ? msg.slice(0, 72) + "…" : msg);
    } finally {
      forumContinueRunning = false;
      setDetailToolsBusy(false);
    }
  }

  function buildForumShareSnapshot(post, maskId, sectorName) {
    if (!post) return null;
    const cmts = Array.isArray(post.comments) ? post.comments : [];
    const tags = Array.isArray(post.tags)
      ? post.tags.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean).slice(0, 5)
      : [];
    let imageUrl = "";
    if (Array.isArray(post.images) && post.images.length) {
      imageUrl = String(post.images[0] || "").trim();
    } else if (post.repostOf && Array.isArray(post.repostOf.images) && post.repostOf.images.length) {
      imageUrl = String(post.repostOf.images[0] || "").trim();
    }
    const snap = {
      postId: String(post.id || "").trim(),
      maskId: String(maskId || "").trim(),
      sectorId: String(post.sectorId || "").trim(),
      sectorName: String(sectorName || "综合").trim().slice(0, 16) || "综合",
      authorName: String(post.authorName || "网友").trim(),
      authorInitial: String(post.authorInitial || "?").trim().slice(0, 1) || "?",
      badge: String(post.badge || "").trim(),
      content: String(post.content || "").trim().slice(0, 800),
      tags,
      imageUrl: imageUrl.slice(0, 2048),
      commentCount: cmts.length,
      commentPreview: cmts.slice(-3).map((c) => ({
        authorName: String(c.authorName || "网友").trim(),
        text: String(c.text || "").trim().slice(0, 120)
      }))
    };
    if (post.repostOf && typeof post.repostOf === "object") {
      const inner = post.repostOf;
      snap.repostOf = {
        authorName: String(inner.authorName || "网友").trim(),
        content: String(inner.content || "").trim().slice(0, 200)
      };
    }
    return snap.postId ? snap : null;
  }

  function applyForumCommentFromMitalk(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const maskId = String(o.maskId || resolveMaskId() || "").trim();
    const postId = String(o.postId || "").trim();
    const text = String(o.text || "").trim();
    if (!maskId || !postId || !text) return false;
    const authorName = String(o.authorName || "网友").trim().slice(0, 24) || "网友";
    const authorRow = forumCommentAuthorFields(authorName);
    if (String(o.authorInitial || "").trim()) {
      authorRow.authorInitial = String(o.authorInitial).trim().slice(0, 1) || authorRow.authorInitial;
    }
    const root = readForumStoreRoot();
    const mf = normalizeMaskForumState(root.byMask[maskId]);
    const post = (Array.isArray(mf.posts) ? mf.posts : []).find((p) => p && String(p.id) === postId);
    if (!post) return false;
    if (!Array.isArray(post.comments)) post.comments = [];
    post.comments.push({
      id: uid("fc"),
      ...authorRow,
      text: text.slice(0, 500),
      at: Date.now()
    });
    root.byMask[maskId] = mf;
    writeForumStoreRoot(root);
    if (maskForum && resolveMaskId() === maskId) {
      const i = posts.findIndex((p) => p && String(p.id) === postId);
      if (i >= 0) posts[i] = post;
      persistForumRuntime();
      if (screen?.classList.contains("is-open")) {
        if (activeTab === "square") renderFeed();
        if (activePostId === postId) renderDetail(post);
      }
    }
    return true;
  }

  async function ensureForumShareThread(maskId, charId) {
    if (typeof ensureChatInboxForUi === "function") {
      await ensureChatInboxForUi();
    }
    const mid = String(maskId || "").trim();
    const cid = String(charId || "").trim();
    if (!mid || !cid || typeof listDmThreadsForChar !== "function") return "";
    const dm = listDmThreadsForChar(mid, cid)[0];
    if (dm) return String(dm.id || "").trim();
    if (
      typeof readChatInboxStore !== "function" ||
      typeof writeChatInboxStore !== "function" ||
      typeof ensureMaskBucket !== "function" ||
      typeof maskBucketKey !== "function"
    ) {
      return "";
    }
    const inbox = readChatInboxStore();
    ensureMaskBucket(inbox, mid);
    const bucket = inbox.byMask[maskBucketKey(mid)];
    if (!bucket || !Array.isArray(bucket.threads)) return "";
    const id = typeof newEntityId === "function" ? newEntityId() : uid("th");
    bucket.threads.push({
      id,
      charId: cid,
      kind: "dm",
      messages: [],
      updatedAt: Date.now()
    });
    writeChatInboxStore(inbox);
    return id;
  }

  function getForumShareSnapshotByPostId(maskId, postId) {
    const mid = String(maskId || resolveMaskId() || "").trim();
    const pid = String(postId || "").trim();
    if (!mid || !pid) return null;
    const root = readForumStoreRoot();
    const mf = normalizeMaskForumState(root.byMask[mid]);
    const post = (Array.isArray(mf.posts) ? mf.posts : []).find((p) => p && String(p.id) === pid);
    if (!post) return null;
    const sec = mf.sectors.find((s) => s.id === post.sectorId) || getSectorById(post.sectorId);
    return buildForumShareSnapshot(post, mid, sec?.name || "综合");
  }

  function listForumPostSummariesForMitalk(maskId, limit) {
    const mid = String(maskId || resolveMaskId() || "").trim();
    if (!mid) return [];
    const cap = Math.min(12, Math.max(1, Math.floor(Number(limit) || 8)));
    const root = readForumStoreRoot();
    const mf = normalizeMaskForumState(root.byMask[mid]);
    const posts = Array.isArray(mf.posts) ? mf.posts : [];
    const sectorName = (id) => {
      const sec = mf.sectors.find((s) => s.id === id);
      return sec?.name || "综合";
    };
    return posts
      .slice()
      .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0))
      .slice(0, cap)
      .map((p) => {
        const content = String(p.content || "").trim();
        const preview = content || (p.repostOf ? String(p.repostOf.content || "").trim() : "");
        return {
          postId: String(p.id || "").trim(),
          author: String(p.authorName || "网友").trim(),
          sectorName: sectorName(p.sectorId),
          preview: (preview || "（转发动态）").slice(0, 72)
        };
      })
      .filter((r) => r.postId);
  }

  function renderForumShareCharList() {
    if (!shareCharListEl) return;
    const chars = listForumChars();
    if (shareCharEmptyEl) shareCharEmptyEl.hidden = chars.length > 0;
    shareCharListEl.replaceChildren();
    const st = typeof readCharPersonaStore === "function" ? readCharPersonaStore() : null;
    const activeId = String(st?.activeId || "").trim();
    for (const c of chars) {
      const id = String(c.id);
      const name = charDisplayName(c);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "forum-cast-row forum-cast-row--pick" + (id === activeId ? " is-on" : "");
      row.dataset.shareCharId = id;
      row.innerHTML =
        buildForumCastAvHtml(name, String(c.avatar || "").trim()) +
        `<span class="forum-cast-name">${escapeHtml(name)}</span>` +
        `<span class="forum-share-pick-go" aria-hidden="true"><i class="ph ph-chevron-right"></i></span>`;
      shareCharListEl.appendChild(row);
    }
  }

  function openForumShareSheet(postId) {
    const pid = String(postId || activePostId || "").trim();
    if (!pid || !findPost(pid)) {
      toast("帖子不存在");
      return;
    }
    pendingSharePostId = pid;
    renderForumShareCharList();
    if (!shareSheet) return;
    shareSheet.hidden = false;
    shareSheet.setAttribute("aria-hidden", "false");
    document.querySelector("#forum-screen .forum-app")?.classList.add("forum-overlay-open");
    window.requestAnimationFrame(() => shareSheet.classList.add("is-open"));
    void ensureForumPersonaHydrated().then(() => renderForumShareCharList());
  }

  function closeForumShareSheet() {
    pendingSharePostId = null;
    if (!shareSheet) return;
    shareSheet.classList.remove("is-open");
    shareSheet.setAttribute("aria-hidden", "true");
    document.querySelector("#forum-screen .forum-app")?.classList.remove("forum-overlay-open");
    window.setTimeout(() => {
      shareSheet.hidden = true;
    }, 280);
  }

  async function deliverForumShareToChar(charId, post) {
    const cid = String(charId || "").trim();
    if (!cid || !post) return false;
    const maskId = resolveMaskId();
    if (!maskId) {
      toast("请先选择面具");
      return false;
    }
    const threadId = await ensureForumShareThread(maskId, cid);
    if (!threadId) {
      toast("无法打开密谈会话");
      return false;
    }
    if (typeof window.appendChatLogEntryForMaskThread !== "function") {
      toast("密谈模块未就绪");
      return false;
    }
    const sec = getSectorById(post.sectorId);
    const forumShare = buildForumShareSnapshot(post, maskId, sec?.name || "综合");
    if (!forumShare) return false;
    if (
      !window.appendChatLogEntryForMaskThread(maskId, threadId, {
        role: "user",
        content: "分享了广场帖子",
        at: Date.now(),
        forumShare
      })
    ) {
      toast("无法写入密谈记录");
      return false;
    }
    if (typeof activateCharPersonaById === "function") activateCharPersonaById(cid);
    if (typeof writeChatActiveThreadRef === "function") {
      writeChatActiveThreadRef({ maskId, threadId });
    }
    if (typeof renderChatThreadList === "function") renderChatThreadList();
    if (typeof scheduleChatUiRefreshForRound === "function") {
      scheduleChatUiRefreshForRound(maskId, threadId, { flush: true });
    }
    closeForumShareSheet();
    closeForumScreen();
    if (typeof openChatScreen === "function") openChatScreen();
    const name = charDisplayName(listForumChars().find((c) => String(c.id) === cid) || { displayName: "角色" });
    toast(`已分享给 ${name}`);
    return true;
  }

  async function sharePostToMitalk() {
    if (!activePostId) return;
    const post = findPost(activePostId);
    if (!post) return;
    if (typeof readCharPersonaStore !== "function") {
      toast("人设模块未就绪");
      return;
    }
    const chars = listForumChars();
    if (!chars.length) {
      toast("请先在人设添加角色");
      return;
    }
    openForumShareSheet(activePostId);
  }

  function isForumAiBusy() {
    return forumRefreshRunning || forumContinueRunning || forumBgRunning;
  }

  async function generateForumPostsForSector(sec, postCount) {
    await ensureForumPersonaHydrated();
    await ensureForumWorldBookHydrated();
    if (typeof ensureChatInboxForUi === "function") {
      await ensureChatInboxForUi();
    }
    const messages = buildForumRefreshMessages(sec, postCount, buildForumWorldContext(sec));
    const raw = await forumAiComplete(messages, {
      temperature: 0.96,
      response_format: { type: "json_object" }
    });
    const parsed = parseForumJsonFromAi(raw);
    const castChars = getForumCastChars(sec);
    return normalizeForumAiPosts(parsed, sec, {
      castChars,
      includePassers: sec?.includePassers !== false
    });
  }

  function applyNewForumPosts(newPosts) {
    if (!Array.isArray(newPosts) || !newPosts.length) return 0;
    posts = [...newPosts, ...posts];
    persistForumRuntime();
    if (screen?.classList.contains("is-open")) {
      if (activeTab === "square") renderFeed();
      if (activeTab === "profile") syncProfile();
    }
    return newPosts.length;
  }

  function loadMaskForumFromStore(maskId) {
    const mid = String(maskId || resolveMaskId() || "").trim();
    if (!mid) return null;
    const root = readForumStoreRoot();
    const mf = normalizeMaskForumState(root.byMask[mid]);
    maskForum = mf;
    posts = Array.isArray(mf.posts) ? mf.posts : [];
    conversations = Array.isArray(mf.conversations) ? mf.conversations : [];
    readTimestamps = mf.readTimestamps || {};
    return mf;
  }

  function listBgActiveSectors(mf) {
    return (mf?.sectors || []).filter((s) => s && s.sectorBgActivity);
  }

  function forumBgCooldownMs(mf) {
    return Math.min(240, Math.max(5, Number(mf?.bgCooldownMin) || 30)) * 60000;
  }

  function shouldRunForumBgActivity(mf) {
    if (!mf?.bgActivityEnabled) return false;
    if (!listBgActiveSectors(mf).length) return false;
    if (!hasForumAiKey()) return false;
    if (isForumAiBusy()) return false;
    if (!resolveMaskId()) return false;
    const last = Number(mf.bgLastActivityAt) || 0;
    if (last && Date.now() - last < forumBgCooldownMs(mf)) return false;
    return true;
  }

  function isForumSquareVisible() {
    return Boolean(
      screen?.classList.contains("is-open") && activeTab === "square" && !activePostId
    );
  }

  function closeForumBgNotify() {
    if (!bgNotifyEl) return;
    bgNotifyEl.hidden = true;
    bgNotifyEl.setAttribute("aria-hidden", "true");
    bgNotifyEl.classList.remove("is-open");
  }

  function showForumBgNotifyDialog(opts) {
    const count = Math.max(1, Number(opts?.count) || 1);
    const sectorName = String(opts?.sectorName || "广场").trim() || "广场";
    const preview = String(opts?.preview || "").trim().slice(0, 96);
    if (isForumSquareVisible()) {
      toast(`广场 · ${sectorName} 后台刷入 ${count} 篇新帖`);
      return;
    }
    if (!bgNotifyEl) {
      toast(`广场 · ${sectorName} 刷入 ${count} 篇新帖`);
      return;
    }
    if (bgNotifyTitleEl) {
      bgNotifyTitleEl.textContent = count === 1 ? "广场有新帖" : `广场有 ${count} 篇新帖`;
    }
    if (bgNotifyDescEl) {
      bgNotifyDescEl.textContent = preview
        ? `${sectorName} · ${preview}${preview.length >= 96 ? "…" : ""}`
        : `${sectorName} 后台活跃刚刷入 ${count} 篇新帖`;
    }
    bgNotifyEl.hidden = false;
    bgNotifyEl.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => bgNotifyEl.classList.add("is-open"));
  }

  function notifyForumBgPosts(opts) {
    showForumBgNotifyDialog(opts);
  }

  function scheduleForumBgTimer() {
    if (forumBgTimerId) window.clearTimeout(forumBgTimerId);
    forumBgTimerId = window.setTimeout(() => {
      forumBgTimerId = 0;
      void tickForumBgActivity().finally(() => scheduleForumBgTimer());
    }, FORUM_BG_CHECK_MS);
  }

  async function tickForumBgActivity() {
    const maskId = resolveMaskId();
    if (!maskId) return;
    const mf = loadMaskForumFromStore(maskId);
    if (!mf || !shouldRunForumBgActivity(mf)) return;

    const activeSecs = listBgActiveSectors(mf);
    const sec = activeSecs[Math.floor(Math.random() * activeSecs.length)];
    if (!sec) return;

    const postCount =
      FORUM_BG_POST_MIN +
      Math.floor(Math.random() * (FORUM_BG_POST_MAX - FORUM_BG_POST_MIN + 1));

    forumBgRunning = true;
    try {
      const newPosts = await generateForumPostsForSector(sec, postCount);
      if (!newPosts.length) return;
      const count = applyNewForumPosts(newPosts);
      const now = Date.now();
      mf.bgLastActivityAt = now;
      maskForum.bgLastActivityAt = now;
      saveMaskForum();
      notifyForumBgPosts({
        count,
        sectorName: sec.name || "板块",
        preview: String(newPosts[0]?.content || "").trim()
      });
    } catch (e) {
      console.warn("[forum-bg]", e);
    } finally {
      forumBgRunning = false;
    }
  }

  function setForumRefreshBusy(on) {
    const runBtn = document.getElementById("forum-refresh-run-btn");
    if (on) {
      refreshBtnEl?.classList.add("is-busy");
      runBtn?.classList.add("is-busy");
      runBtn?.setAttribute("disabled", "true");
    } else {
      refreshBtnEl?.classList.remove("is-busy");
      runBtn?.classList.remove("is-busy");
      runBtn?.removeAttribute("disabled");
    }
  }

  async function runForumRefresh() {
    if (forumRefreshRunning || forumBgRunning) return;
    saveRefreshSheetToSector();
    closeRefreshSheet();
    const sec = getActiveSector();
    if (!hasForumAiKey()) {
      toast(forumAiKeyMissingMessage());
      return;
    }
    const minN = Math.max(1, Number(sec?.refreshPostMin) || 3);
    const maxN = Math.max(minN, Number(sec?.refreshPostMax) || 6);
    const postCount = minN + Math.floor(Math.random() * (maxN - minN + 1));
    forumRefreshRunning = true;
    setForumRefreshBusy(true);
    toast(`刷帖中 · ${sec?.name || "综合"} · ${postCount} 篇…`);
    try {
      const newPosts = await generateForumPostsForSector(sec, postCount);
      if (!newPosts.length) {
        toast("生成结果为空，请换模型或调整设定后重试");
        return;
      }
      applyNewForumPosts(newPosts);
      toast(`已刷入 ${newPosts.length} 篇新帖`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e || "刷帖失败");
      toast(msg.length > 72 ? msg.slice(0, 72) + "…" : msg);
    } finally {
      forumRefreshRunning = false;
      setForumRefreshBusy(false);
    }
  }

  function renderSectorSheetSectors() {
    const mf = ensureMaskForum();
    if (!sectorSheetSectorsEl) return;
    const editingId = sectorSheetEditingId || mf.activeSectorId;
    sectorSheetSectorsEl.replaceChildren();
    for (const sec of mf.sectors) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "forum-sector-sheet-tab" + (sec.id === editingId ? " is-editing" : "");
      btn.dataset.editSectorId = sec.id;
      btn.textContent = sec.name;
      sectorSheetSectorsEl.appendChild(btn);
    }
    syncSectorDeleteButton();
  }

  function syncSectorDeleteButton() {
    const btn = document.getElementById("forum-sector-delete-btn");
    if (!btn) return;
    const mf = ensureMaskForum();
    btn.disabled = mf.sectors.length <= 1;
    btn.title = mf.sectors.length <= 1 ? "至少保留一个板块" : "删除正在编辑的板块";
  }

  function deleteForumSector() {
    const mf = ensureMaskForum();
    if (mf.sectors.length <= 1) {
      toast("至少保留一个板块");
      return;
    }
    const editId = sectorSheetEditingId || mf.activeSectorId;
    const sec = mf.sectors.find((s) => s.id === editId);
    if (!sec) return;
    const name =
      String(sectorNameInputEl?.value || sec.name || "板块")
        .trim()
        .slice(0, 16) || "板块";
    const removedId = sec.id;
    const fallback =
      mf.sectors.find((s) => s.id !== removedId && s.id === mf.activeSectorId) ||
      mf.sectors.find((s) => s.id !== removedId);
    if (!fallback) return;
    const migrateTo = String(fallback.name || "其他板块").trim();
    if (!window.confirm(`删除板块「${name}」？\n该板块下的帖子会移到「${migrateTo}」。`)) {
      return;
    }
    mf.sectors = mf.sectors.filter((s) => s.id !== removedId);
    for (const p of posts) {
      if (String(p?.sectorId || "") === removedId) p.sectorId = fallback.id;
    }
    if (mf.activeSectorId === removedId) mf.activeSectorId = fallback.id;
    sectorSheetEditingId = fallback.id;
    sectorWbDraftIds = (fallback.worldBookVolumeIds || [])
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    saveMaskForum();
    persistForumRuntime();
    renderSectorBar();
    renderSectorSheetSectors();
    syncSectorSheetFieldsFromSector(fallback);
    renderSectorWbPicker();
    if (activeTab === "square") renderFeed();
    scheduleForumBgTimer();
    toast(`已删除「${name}」`);
  }

  function renderSectorWbPicker() {
    if (!sectorWbChipsEl) return;
    const q = String(sectorWbSearchEl?.value || "").trim().toLowerCase();
    const draftIds = new Set(sectorWbDraftIds.map((x) => String(x || "").trim()).filter(Boolean));
    const vols = readWorldBookVolumes().filter((v) => v && v.id);
    const filtered = q ? vols.filter((v) => forumWorldBookMatchesQuery(v, q)) : vols;
    if (sectorWbEmptyEl) {
      sectorWbEmptyEl.hidden = filtered.length > 0;
      if (!filtered.length) {
        if (q && vols.length) {
          sectorWbEmptyEl.textContent = `没有匹配「${String(sectorWbSearchEl?.value || "").trim()}」的世界书（书架共 ${vols.length} 本，可搜书名 / 条目 / 关键词）`;
        } else {
          sectorWbEmptyEl.textContent = "书架空空的。去桌面 → 世界书，先写一本设定。";
        }
      }
    }
    if (sectorWbCountEl) {
      const shelfHint = vols.length ? `书架 ${vols.length} 本 · ` : "";
      sectorWbCountEl.textContent = `${shelfHint}已选 ${draftIds.size} / ${FORUM_SECTOR_WB_MAX} 本（不含自动注入的全局卷）`;
    }
    sectorWbChipsEl.replaceChildren();
    for (const vol of filtered) {
      const vid = String(vol.id || "").trim();
      const on = draftIds.has(vid);
      const scope = vol.scope === "global" ? "全局" : "局部";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "forum-sector-wb-chip" + (on ? " is-on" : "");
      btn.dataset.forumWbId = vid;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.innerHTML =
        `<span>${escapeHtml(String(vol.title || "未命名").trim() || "未命名")}</span>` +
        `<span class="forum-sector-wb-chip-badge">${scope}</span>`;
      sectorWbChipsEl.appendChild(btn);
    }
  }

  async function openSectorSheet() {
    const mf = ensureMaskForum();
    sectorSheetEditingId = mf.activeSectorId;
    const sec = getActiveSector();
    sectorWbDraftIds = (sec?.worldBookVolumeIds || []).map((x) => String(x || "").trim()).filter(Boolean);
    if (sectorWbSearchEl) sectorWbSearchEl.value = "";
    syncSectorSheetFieldsFromSector(sec);
    renderSectorSheetSectors();
    if (!sectorSheet) return;
    sectorSheet.hidden = false;
    sectorSheet.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => sectorSheet.classList.add("is-open"));
    if (sectorWbCountEl) sectorWbCountEl.textContent = "正在读取书架…";
    if (sectorWbEmptyEl) {
      sectorWbEmptyEl.hidden = false;
      sectorWbEmptyEl.textContent = "正在从本地读取世界书…";
    }
    sectorWbChipsEl?.replaceChildren();
    await ensureForumWorldBookHydrated();
    renderSectorWbPicker();
    syncForumApiEntryMeta();
  }

  function closeSectorSheet() {
    if (!sectorSheet) return;
    sectorSheet.classList.remove("is-open");
    sectorSheet.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      sectorSheet.hidden = true;
    }, 280);
  }

  function saveSectorSheet() {
    const mf = ensureMaskForum();
    const editId = sectorSheetEditingId || mf.activeSectorId;
    const sec = mf.sectors.find((s) => s.id === editId);
    const name = String(sectorNameInputEl?.value || "").trim().slice(0, 16);
    if (!name) {
      toast("请填写板块名称");
      if (sectorNameInputEl) sectorNameInputEl.focus();
      return;
    }
    if (sec) {
      sec.name = name;
      sec.worldBookVolumeIds = sectorWbDraftIds.slice(0, FORUM_SECTOR_WB_MAX);
      applySectorSheetFieldsToSector(sec);
    }
    saveMaskForum();
    closeSectorSheet();
    renderSectorBar();
    if (activeTab === "square") renderFeed();
    scheduleForumBgTimer();
    toast("板块设定已保存");
  }

  function toggleSectorWbDraft(volumeId) {
    const id = String(volumeId || "").trim();
    if (!id) return;
    sectorWbDraftIds = sectorWbDraftIds.map((x) => String(x || "").trim()).filter(Boolean);
    const has = sectorWbDraftIds.includes(id);
    if (has) sectorWbDraftIds = sectorWbDraftIds.filter((x) => x !== id);
    else {
      if (sectorWbDraftIds.length >= FORUM_SECTOR_WB_MAX) {
        toast(`每个板块最多绑定 ${FORUM_SECTOR_WB_MAX} 本`);
        return;
      }
      sectorWbDraftIds = [...sectorWbDraftIds, id];
    }
    renderSectorWbPicker();
  }

  function addForumSector() {
    const mf = ensureMaskForum();
    const sec = defaultSectorFields("新板块");
    mf.sectors.push(sec);
    mf.activeSectorId = sec.id;
    sectorSheetEditingId = sec.id;
    sectorWbDraftIds = [];
    syncSectorSheetFieldsFromSector(sec);
    saveMaskForum();
    renderSectorBar();
    renderSectorSheetSectors();
    renderSectorWbPicker();
    if (activeTab === "square") renderFeed();
    if (sectorNameInputEl) {
      window.requestAnimationFrame(() => {
        try {
          sectorNameInputEl.focus({ preventScroll: true });
        } catch {
          sectorNameInputEl.focus();
        }
        sectorNameInputEl.select();
      });
    }
    toast("输入板块名称后点保存");
  }

  function buildRepostSnapshot(post) {
    if (!post) return null;
    const images = Array.isArray(post.images) && post.images.length
      ? [String(post.images[0] || "").trim()].filter(Boolean)
      : post.repostOf && Array.isArray(post.repostOf.images) && post.repostOf.images.length
        ? [String(post.repostOf.images[0] || "").trim()].filter(Boolean)
        : [];
    const snap = {
      postId: String(post.id || "").trim(),
      authorName: String(post.authorName || "网友").trim(),
      authorInitial: String(post.authorInitial || "?").trim().slice(0, 1) || "?",
      content: String(post.content || "").trim().slice(0, 500),
      images
    };
    if (post.repostOf && typeof post.repostOf === "object") {
      const inner = post.repostOf;
      snap.repostOf = {
        postId: String(inner.postId || "").trim(),
        authorName: String(inner.authorName || "网友").trim(),
        authorInitial: String(inner.authorInitial || "?").trim().slice(0, 1) || "?",
        content: String(inner.content || "").trim().slice(0, 300)
      };
    }
    return snap;
  }

  function repostQuotePreviewText(snap) {
    if (!snap) return "（转发动态）";
    const text = String(snap.content || "").trim();
    if (text) return text;
    if (snap.repostOf) {
      const inner = String(snap.repostOf.content || "").trim();
      if (inner) return `@${snap.repostOf.authorName || "网友"}：${inner}`;
    }
    return "（转发动态）";
  }

  function buildRepostQuoteHtml(snap, opts) {
    if (!snap) return "";
    const clickable = !opts || opts.clickable !== false;
    const openAttr = clickable && snap.postId
      ? ` data-open-id="${escapeHtml(snap.postId)}"`
      : "";
    const tag = clickable && snap.postId ? "button" : "div";
    const typeAttr = tag === "button" ? " type=\"button\"" : "";
    const preview = escapeHtml(repostQuotePreviewText(snap));
    const author = escapeHtml(snap.authorName || "网友");
    let imgHtml = "";
    if (Array.isArray(snap.images) && snap.images.length) {
      imgHtml = `<span class="forum-feed-repost-thumb"><img src="${escapeHtml(snap.images[0])}" alt="" loading="lazy" /></span>`;
    }
    let nestedHtml = "";
    if (snap.repostOf) {
      const inner = snap.repostOf;
      nestedHtml =
        `<div class="forum-feed-repost-nested">` +
        `<p><strong>${escapeHtml(inner.authorName || "网友")}</strong> ` +
        `<span>${escapeHtml(String(inner.content || "").trim() || "（转发动态）")}</span></p></div>`;
    }
    return (
      `<${tag} class="forum-feed-repost"${typeAttr}${openAttr}>` +
      `<div class="forum-feed-repost-inner">` +
      imgHtml +
      `<div class="forum-feed-repost-text">` +
      `<p><strong>${author}</strong> <span>${preview}</span></p>` +
      nestedHtml +
      `</div></div></${tag}>`
    );
  }

  function findPost(id) {
    return posts.find((p) => p.id === id) || null;
  }

  function userLiked(post, name) {
    return Array.isArray(post.likes) && post.likes.includes(name);
  }

  function userSaved(post, name) {
    return Array.isArray(post.savedBy) && post.savedBy.includes(name);
  }

  function buildFeedCard(post, opts) {
    const userName = resolveUserName();
    const liked = userLiked(post, userName);
    const saved = userSaved(post, userName);
    const likes = Array.isArray(post.likes) ? post.likes : [];
    const cmts = Array.isArray(post.comments) ? post.comments : [];
    const own = isOwnPost(post);
    const card = document.createElement("article");
    card.className = "forum-feed-card";
    card.dataset.postId = post.id;
    const authorAv = resolveForumAuthorAvatar(post.authorAvatar, post.authorName);
    const authorAvHtml = buildForumAvHtml(post.authorName, authorAv, "forum-feed-av");

    let mediaHtml = "";
    if (!post.repostOf && Array.isArray(post.images) && post.images.length) {
      const n = Math.min(post.images.length, 6);
      const gridCls =
        n === 1 ? "forum-feed-media--1" : n === 2 ? "forum-feed-media--2" : "forum-feed-media--many";
      mediaHtml = `<div class="forum-feed-media ${gridCls}">`;
      for (let i = 0; i < n; i++) {
        mediaHtml += `<img src="${escapeHtml(post.images[i])}" alt="" loading="lazy" />`;
      }
      mediaHtml += `</div>`;
    }

    const dmAct = own
      ? `<button type="button" class="forum-feed-act" data-open-id="${escapeHtml(post.id)}" aria-label="查看"><i class="ph ph-paper-plane-tilt" aria-hidden="true"></i></button>`
      : `<button type="button" class="forum-feed-act" data-dm-name="${escapeHtml(post.authorName)}" data-dm-initial="${escapeHtml(post.authorInitial || "?")}" aria-label="私信"><i class="ph ph-envelope-simple" aria-hidden="true"></i></button>`;

    const tagLine =
      !post.repostOf && Array.isArray(post.tags) && post.tags.length
        ? `<div class="forum-feed-tags">${post.tags.map((t) => `<span>#${escapeHtml(t)}</span>`).join("")}</div>`
        : "";

    let bodyInner = "";
    if (post.repostOf) {
      const comment = String(post.content || "").trim();
      if (comment) {
        bodyInner +=
          `<p class="forum-feed-caption"><strong>${escapeHtml(post.authorName)}</strong> <span>${escapeHtml(comment)}</span></p>`;
      }
      bodyInner += buildRepostQuoteHtml(post.repostOf);
    } else {
      bodyInner =
        `<p class="forum-feed-caption"><strong>${escapeHtml(post.authorName)}</strong> <span>${escapeHtml(post.content || "")}</span></p>` +
        tagLine;
    }

    let cmtsHtml = "";
    if (cmts.length) {
      cmtsHtml = `<div class="forum-feed-cmts">`;
      if (cmts.length > 2) {
        cmtsHtml += `<button type="button" class="forum-feed-cmts-more" data-open-id="${escapeHtml(post.id)}">查看全部 ${cmts.length} 条评论</button>`;
      }
      cmtsHtml += cmts
        .slice(-2)
        .map(
          (c) =>
            `<p class="forum-feed-cmt"><strong>${escapeHtml(c.authorName || "网友")}</strong> ${escapeHtml(c.text || "")}</p>`
        )
        .join("");
      cmtsHtml += `</div>`;
    }

    const quickOpen = opts && opts.openComments ? " is-open" : "";
    const likeLine =
      likes.length > 0
        ? `<p class="forum-feed-likes">${likes.length === 1 ? "1 个赞" : likes.length + " 个赞"}</p>`
        : "";

    card.innerHTML =
      `<header class="forum-feed-head">` +
      `<button type="button" class="forum-feed-author" data-dm-name="${escapeHtml(post.authorName)}" data-dm-initial="${escapeHtml(post.authorInitial || "?")}">` +
      authorAvHtml +
      `<span class="forum-feed-author-text"><strong>${escapeHtml(post.authorName || "网友")}</strong><time>${escapeHtml(formatRelTime(post.at))}</time></span>` +
      `</button></header>` +
      `<div class="forum-feed-body" data-open-post="${escapeHtml(post.id)}">` +
      bodyInner +
      `</div>` +
      mediaHtml +
      `<div class="forum-feed-actions">` +
      `<button type="button" class="forum-feed-act${liked ? " is-liked" : ""}" data-like-id="${escapeHtml(post.id)}" aria-label="赞"><i class="ph${liked ? "-fill" : ""} ph-heart" aria-hidden="true"></i></button>` +
      `<button type="button" class="forum-feed-act" data-comment-id="${escapeHtml(post.id)}" aria-label="评论"><i class="ph ph-chat-circle" aria-hidden="true"></i></button>` +
      `<button type="button" class="forum-feed-act" data-repost-id="${escapeHtml(post.id)}" aria-label="转发"><i class="ph ph-arrows-left-right" aria-hidden="true"></i></button>` +
      `<button type="button" class="forum-feed-act${saved ? " is-saved" : ""}" data-save-id="${escapeHtml(post.id)}" aria-label="收藏"><i class="ph${saved ? "-fill" : ""} ph-bookmark-simple" aria-hidden="true"></i></button>` +
      dmAct +
      `</div>` +
      likeLine +
      cmtsHtml +
      `<form class="forum-feed-compose${quickOpen}" data-post-id="${escapeHtml(post.id)}">` +
      `<input type="text" class="forum-feed-compose-input" data-quick-input="${escapeHtml(post.id)}" maxlength="200" placeholder="添加评论…" />` +
      `<button type="submit" class="forum-feed-compose-post">发布</button></form>`;

    if (own) {
      const authorBtn = card.querySelector(".forum-feed-author");
      if (authorBtn) authorBtn.removeAttribute("data-dm-name");
    }

    return card;
  }

  function renderFeed() {
    if (!feedEl) return;
    const list = filterPosts(posts);
    feedEl.replaceChildren();
    if (feedEmptyEl) feedEmptyEl.hidden = list.length > 0;
    for (const post of list) feedEl.appendChild(buildFeedCard(post));
  }

  function renderDetailComments(post) {
    if (!detailCommentsEl) return;
    detailCommentsEl.hidden = false;
    const cmts = Array.isArray(post.comments) ? post.comments : [];
    detailCommentsEl.replaceChildren();
    const title = document.createElement("p");
    title.className = "forum-comments-title";
    title.textContent = `全部评论 · ${cmts.length}`;
    detailCommentsEl.appendChild(title);
    if (!cmts.length) {
      const empty = document.createElement("p");
      empty.style.margin = "0";
      empty.style.fontSize = "0.84rem";
      empty.style.color = "var(--fm-muted)";
      empty.textContent = "还没有评论 · 写第一句";
      detailCommentsEl.appendChild(empty);
      return;
    }
    for (const c of cmts) {
      const row = document.createElement("div");
      row.className = "forum-comment";
      const cAv = resolveForumAuthorAvatar(c.authorAvatar, c.authorName);
      row.innerHTML =
        buildForumAvHtml(c.authorName, cAv, "forum-comment-av") +
        `<span><span class="forum-comment-name">${escapeHtml(c.authorName || "网友")}</span>` +
        `<p class="forum-comment-text">${escapeHtml(c.text || "")}</p></span>`;
      detailCommentsEl.appendChild(row);
    }
  }

  function renderDetail(post) {
    if (!detailScrollEl || !post) return;
    detailScrollEl.replaceChildren();
    detailScrollEl.appendChild(buildFeedCard(post, { openComments: true }));
    if (detailCommentsEl) detailScrollEl.appendChild(detailCommentsEl);
    renderDetailComments(post);
  }

  function syncBottomIcons() {
    document.querySelectorAll("#forum-screen .chat-list-dock-tab").forEach((btn) => {
      const on = btn.classList.contains("is-active");
      const tab = btn.dataset.forumTab;
      const wrap = btn.querySelector(".forum-dock-ico-wrap");
      const icon = wrap ? wrap.querySelector("i") : btn.querySelector("i");
      if (!icon) return;
      if (tab === "square") icon.className = on ? "ph-fill ph-house" : "ph ph-house";
      else if (tab === "messages") icon.className = on ? "ph-fill ph-chat-circle-dots" : "ph ph-chat-circle-dots";
      else if (tab === "profile") icon.className = on ? "ph-fill ph-user" : "ph ph-user";
    });
  }

  const TAB_TOPBAR = {
    square: { kicker: "SQUARE FEED", title: "Square." },
    messages: { kicker: "MESSAGES", title: "Chat." },
    profile: { kicker: "PROFILE", title: "Me." }
  };

  function syncTabs() {
    document.querySelectorAll("#forum-screen .chat-list-dock-tab").forEach((btn) => {
      const on = btn.dataset.forumTab === activeTab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    syncBottomIcons();

    const showSquare = activeTab === "square";
    const showMessages = activeTab === "messages";
    const showProfile = activeTab === "profile";

    if (feedPanel) feedPanel.hidden = !showSquare;
    if (messagesPanel) messagesPanel.hidden = !showMessages;
    if (profilePanel) profilePanel.hidden = !showProfile;

    if (composeTopBtn) composeTopBtn.hidden = !showSquare;
    if (sectorSettingsBtn) sectorSettingsBtn.hidden = !showSquare;
    if (refreshBtnEl) refreshBtnEl.hidden = !showSquare;
    const topMeta = TAB_TOPBAR[activeTab] || TAB_TOPBAR.square;
    if (topbarKickerEl) topbarKickerEl.textContent = topMeta.kicker;
    if (topbarTitleEl) topbarTitleEl.textContent = topMeta.title;

    if (showSquare) {
      renderSectorBar();
      renderFeed();
    } else if (showMessages) renderMessages();
    else syncProfile();

    syncUnreadDot();
  }

  let profileNameEditing = false;
  let profileNameDraft = "";

  function saveForumDisplayName(name) {
    const D = window.XXJ_DB;
    if (!D || typeof readUserMask !== "function") return false;
    const raw = D.getKv(D.K.USER_MASK_STORE);
    if (!raw || raw.v !== 2 || !Array.isArray(raw.items)) return false;
    const st = { ...raw, items: raw.items.map((x) => ({ ...x })) };
    const id = String(st.activeId || "").trim();
    if (!id) return false;
    const idx = st.items.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    const dn = String(name || "").trim().slice(0, 64) || "你";
    st.items[idx] = { ...st.items[idx], displayName: dn };
    D.setKv(D.K.USER_MASK_STORE, st);
    const cur = { ...readUserMask(), displayName: dn };
    D.setKv(D.K.USER_MASK, cur);
    const formEl = document.getElementById("user-mask-display-name");
    if (formEl) formEl.value = dn;
    return true;
  }

  function startProfileNameEdit() {
    if (!profileNameEl || !profileNameBtnEl || profileNameEditing) return;
    profileNameEditing = true;
    profileNameDraft = resolveUserName();
    profileNameEl.value = profileNameDraft;
    profileNameBtnEl.hidden = true;
    profileNameEl.hidden = false;
    profileNameEl.focus();
    profileNameEl.select();
  }

  function finishProfileNameEdit(save) {
    if (!profileNameEl || !profileNameBtnEl) return;
    const prev = profileNameDraft || resolveUserName();
    let next = String(profileNameEl.value || "").trim();
    if (!save) next = prev;
    if (!next) next = "你";
    profileNameEditing = false;
    profileNameEl.hidden = true;
    profileNameBtnEl.hidden = false;
    if (save && next !== prev) {
      saveForumDisplayName(next);
      toast("昵称已更新");
    }
    syncProfile();
  }

  function startProfileIdEdit() {
    if (!profileIdInputEl || !profileIdBtnEl || profileIdEditing) return;
    profileIdEditing = true;
    profileIdDraft = resolveForumHandle();
    profileIdInputEl.value = profileIdDraft;
    profileIdBtnEl.hidden = true;
    profileIdInputEl.hidden = false;
    profileIdInputEl.focus();
    profileIdInputEl.select();
  }

  function finishProfileIdEdit(save) {
    if (!profileIdInputEl || !profileIdBtnEl || !maskForum) return;
    const prev = profileIdDraft || resolveForumHandle();
    let next = save ? sanitizeForumHandle(profileIdInputEl.value, resolveUserName()) : prev;
    profileIdEditing = false;
    profileIdInputEl.hidden = true;
    profileIdBtnEl.hidden = false;
    if (save && next !== prev) {
      maskForum.forumHandle = next;
      saveMaskForum();
      toast("论坛 ID 已更新");
    }
    syncProfile();
  }

  function forumProfileId(name) {
    return defaultForumHandle(name);
  }

  function renderProfilePosts(userName) {
    if (!profilePostsListEl) return;
    const mine = posts
      .filter((p) => p.authorName === userName)
      .sort((a, b) => Number(b.at) - Number(a.at));
    profilePostsListEl.replaceChildren();
    if (profilePostsEmptyEl) profilePostsEmptyEl.hidden = mine.length > 0;
    for (const post of mine) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "forum-profile-post-row";
      btn.dataset.openPost = post.id;
      const likeN = Array.isArray(post.likes) ? post.likes.length : 0;
      const cmtN = Array.isArray(post.comments) ? post.comments.length : 0;
      const preview = String(post.content || "").trim().slice(0, 120);
      btn.innerHTML =
        `<p class="forum-profile-post-text">${escapeHtml(preview || "（无正文）")}</p>` +
        `<div class="forum-profile-post-meta">` +
        `<span>${escapeHtml(formatRelTime(post.at))}</span>` +
        `<span><i class="ph ph-heart" aria-hidden="true"></i>${likeN}</span>` +
        `<span><i class="ph ph-chat-circle" aria-hidden="true"></i>${cmtN}</span>` +
        `</div>`;
      profilePostsListEl.appendChild(btn);
    }
  }

  function syncProfile() {
    const userName = resolveUserName();
    if (!profileNameEditing) {
      if (profileDisplayNameEl) profileDisplayNameEl.textContent = userName || "论坛用户";
      if (profileNameEl) profileNameEl.value = userName;
    }
    if (!profileIdEditing) {
      const handle = resolveForumHandle();
      if (profileIdTextEl) profileIdTextEl.textContent = handle;
      if (profileIdInputEl) profileIdInputEl.value = handle;
    }
    const avEl = document.getElementById("forum-profile-av");
    if (avEl) {
      avEl.textContent = userName.slice(0, 1) || "你";
      avEl.style.setProperty("--fm-av-h", String(avHue(userName)));
    }
    let myPosts = 0;
    let myLikes = 0;
    let myCmts = 0;
    for (const p of posts) {
      if (p.authorName === userName) {
        myPosts++;
        myCmts += Array.isArray(p.comments) ? p.comments.length : 0;
        if (Array.isArray(p.likes)) myLikes += p.likes.length;
      }
    }
    const postsEl = document.getElementById("forum-profile-posts");
    const likesEl = document.getElementById("forum-profile-likes");
    if (postsEl) postsEl.textContent = String(myPosts);
    if (likesEl) likesEl.textContent = String(myLikes);
    if (profileCmtsEl) profileCmtsEl.textContent = String(myCmts);
    renderProfilePosts(userName);
  }

  function openDetail(postId) {
    const post = findPost(postId);
    if (!post || !detailEl) return;
    activePostId = postId;
    renderDetail(post);
    detailEl.hidden = false;
    if (detailInputEl) detailInputEl.value = "";
    syncDetailSend();
  }

  function closeDetail() {
    activePostId = null;
    if (detailEl) detailEl.hidden = true;
  }

  function syncDetailSend() {
    if (!detailSendEl || !detailInputEl) return;
    detailSendEl.disabled = !String(detailInputEl.value || "").trim();
  }

  function toggleLike(postId, ev) {
    if (ev) ev.stopPropagation();
    const post = findPost(postId);
    if (!post) return;
    const name = resolveUserName();
    if (!Array.isArray(post.likes)) post.likes = [];
    const i = post.likes.indexOf(name);
    if (i >= 0) post.likes.splice(i, 1);
    else post.likes.push(name);
    renderFeed();
    if (activePostId === postId) renderDetail(post);
    persistForumRuntime();
  }

  function addComment(postId, text) {
    const post = findPost(postId);
    const msg = String(text || "").trim();
    if (!post || !msg) return;
    if (!Array.isArray(post.comments)) post.comments = [];
    const name = resolveUserName();
    post.comments.push({
      id: uid("fc"),
      authorName: name,
      authorInitial: name.slice(0, 1) || "你",
      text: msg,
      at: Date.now()
    });
    renderFeed();
    if (activePostId === postId) renderDetail(post);
    persistForumRuntime();
  }

  function toggleSave(postId, ev) {
    if (ev) ev.stopPropagation();
    const post = findPost(postId);
    if (!post) return;
    const name = resolveUserName();
    if (!Array.isArray(post.savedBy)) post.savedBy = [];
    const i = post.savedBy.indexOf(name);
    if (i >= 0) post.savedBy.splice(i, 1);
    else post.savedBy.push(name);
    renderFeed();
    if (activePostId === postId) renderDetail(post);
    persistForumRuntime();
    toast(i >= 0 ? "已取消收藏" : "已收藏");
  }

  function syncComposeModeUi() {
    document.querySelectorAll(".forum-compose-mode").forEach((btn) => {
      const on = btn.getAttribute("data-compose-mode") === composeMode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (composeInputEl) {
      if (composeRepostSource) {
        composeInputEl.placeholder = "说点什么…（可不写，直接转发）";
      } else {
        composeInputEl.placeholder =
          composeMode === "long" ? "写长帖、故事、讨论…" : "分享此刻的想法…";
      }
      composeInputEl.removeAttribute("maxlength");
    }
    if (composeMediaEl) composeMediaEl.hidden = composeMode !== "long" || composeRepostSource;
  }

  function syncComposeRepostUi() {
    const reposting = Boolean(composeRepostSource);
    if (composeTitleEl) composeTitleEl.textContent = reposting ? "转发" : "发帖";
    if (composeModesEl) composeModesEl.hidden = reposting;
    if (composeRepostEl) {
      composeRepostEl.hidden = !reposting;
      if (reposting) composeRepostEl.innerHTML = buildRepostQuoteHtml(composeRepostSource, { clickable: false });
    }
    syncComposeModeUi();
    syncComposeSubmit();
  }

  function openComposeSheet() {
    composeRepostSource = null;
    if (!composeSheet) return;
    composeMode = "short";
    composeSheet.hidden = false;
    composeSheet.setAttribute("aria-hidden", "false");
    document.querySelector("#forum-screen .forum-app")?.classList.add("forum-overlay-open");
    window.requestAnimationFrame(() => composeSheet.classList.add("is-open"));
    if (composeInputEl) {
      composeInputEl.value = "";
      window.requestAnimationFrame(() => {
        try {
          composeInputEl.focus({ preventScroll: true });
        } catch {
          composeInputEl.focus();
        }
      });
    }
    syncComposeRepostUi();
  }

  function openRepostCompose(postId) {
    const post = findPost(postId);
    if (!post) return;
    composeRepostSource = buildRepostSnapshot(post);
    if (!composeSheet) return;
    composeMode = "short";
    composeSheet.hidden = false;
    composeSheet.setAttribute("aria-hidden", "false");
    document.querySelector("#forum-screen .forum-app")?.classList.add("forum-overlay-open");
    window.requestAnimationFrame(() => composeSheet.classList.add("is-open"));
    if (composeInputEl) {
      composeInputEl.value = "";
      window.requestAnimationFrame(() => {
        try {
          composeInputEl.focus({ preventScroll: true });
        } catch {
          composeInputEl.focus();
        }
      });
    }
    syncComposeRepostUi();
  }

  function closeComposeSheet() {
    if (!composeSheet) return;
    composeRepostSource = null;
    composeSheet.classList.remove("is-open");
    composeSheet.setAttribute("aria-hidden", "true");
    document.querySelector("#forum-screen .forum-app")?.classList.remove("forum-overlay-open");
    window.setTimeout(() => {
      composeSheet.hidden = true;
    }, 280);
    syncComposeRepostUi();
  }

  function syncComposeSubmit() {
    if (!composeSubmitEl || !composeInputEl) return;
    const hasText = Boolean(String(composeInputEl.value || "").trim());
    composeSubmitEl.disabled = !hasText && !composeRepostSource;
  }

  function publishPost() {
    const text = String(composeInputEl?.value || "").trim();
    if (!text && !composeRepostSource) return;
    const userName = resolveUserName();
    const mf = ensureMaskForum();
    const repostOf = composeRepostSource ? { ...composeRepostSource } : undefined;
    if (repostOf?.repostOf) repostOf.repostOf = { ...repostOf.repostOf };
    posts.unshift({
      id: uid("fp"),
      authorName: userName,
      authorInitial: userName.slice(0, 1) || "你",
      badge: "",
      content: text,
      tags: [],
      likes: [],
      comments: [],
      at: Date.now(),
      sectorId: mf.activeSectorId || "main",
      ...(repostOf ? { repostOf } : {})
    });
    composeRepostSource = null;
    persistForumRuntime();
    closeComposeSheet();
    if (activeTab === "profile") activeTab = "square";
    syncTabs();
    toast(repostOf ? "已转发到广场" : "已发布到广场");
  }

  function closeOtherScreens() {
    if (typeof closeSettings === "function") closeSettings();
    if (typeof closeMyScreen === "function") closeMyScreen();
    if (typeof closeCharScreen === "function") closeCharScreen();
    if (typeof closeChatScreen === "function") closeChatScreen();
    if (typeof closeChatListScreen === "function") closeChatListScreen();
    if (typeof closeCheckupScreen === "function") closeCheckupScreen();
    if (typeof closeRelationScreen === "function") closeRelationScreen();
    if (typeof closeRoleplayScreen === "function") closeRoleplayScreen();
    if (typeof closeRoamScreen === "function") closeRoamScreen();
    if (typeof closeStickerScreen === "function") closeStickerScreen();
    if (typeof closeWardrobeScreen === "function") closeWardrobeScreen();
    if (typeof closeWorldBookScreen === "function") closeWorldBookScreen();
    document.getElementById("drawer")?.classList.remove("open");
  }

  function openForumScreen() {
    if (!screen) return;
    maskForum = null;
    const mf = ensureMaskForum();
    posts = Array.isArray(mf.posts) ? mf.posts : [];
    conversations = Array.isArray(mf.conversations) ? mf.conversations : [];
    readTimestamps = mf.readTimestamps && typeof mf.readTimestamps === "object" ? mf.readTimestamps : {};
    saveMaskForum();
    activeTab = "square";
    activePostId = null;
    activeConvId = null;
    closeOtherScreens();
    closeDetail();
    closeConv();
    closeComposeSheet();
    screen.classList.add("is-open");
    screen.setAttribute("aria-hidden", "false");
    syncTabs();
    void ensureForumWorldBookHydrated().then(() => {
      renderSectorBar();
      if (activeTab === "square") renderFeed();
    });
    scheduleForumBgTimer();
  }

  function closeForumScreen() {
    closeDetail();
    closeConv();
    closeComposeSheet();
    closeSectorSheet();
    closeRefreshSheet();
    closeForumShareSheet();
    closeForumApiSheet();
    persistForumRuntime();
    maskForum = null;
    screen?.classList.remove("is-open");
    screen?.setAttribute("aria-hidden", "true");
  }

  window.openForumScreen = openForumScreen;
  window.closeForumScreen = closeForumScreen;

  profileNameBtnEl?.addEventListener("click", () => startProfileNameEdit());
  profileNameEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishProfileNameEdit(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finishProfileNameEdit(false);
    }
  });
  profileNameEl?.addEventListener("blur", () => {
    if (profileNameEditing) finishProfileNameEdit(true);
  });

  profileIdBtnEl?.addEventListener("click", () => startProfileIdEdit());
  profileIdInputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishProfileIdEdit(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finishProfileIdEdit(false);
    }
  });
  profileIdInputEl?.addEventListener("blur", () => {
    if (profileIdEditing) finishProfileIdEdit(true);
  });

  sectorSettingsBtn?.addEventListener("click", openSectorSheet);
  document.getElementById("forum-open-api-sheet")?.addEventListener("click", openForumApiSheet);
  document.getElementById("forum-api-sheet-backdrop")?.addEventListener("click", closeForumApiSheet);
  document.getElementById("forum-api-sheet-close")?.addEventListener("click", closeForumApiSheet);
  document.getElementById("forum-api-save-btn")?.addEventListener("click", saveForumApiSheet);
  forumAiSourceEl?.addEventListener("change", syncForumApiSourceUi);
  forumAiTempEl?.addEventListener("input", () => {
    if (forumAiTempValueEl) forumAiTempValueEl.textContent = Number(forumAiTempEl.value).toFixed(2);
  });
  document.getElementById("forum-sector-sheet-backdrop")?.addEventListener("click", closeSectorSheet);
  document.getElementById("forum-sector-sheet-close")?.addEventListener("click", closeSectorSheet);
  document.getElementById("forum-sector-sheet-save")?.addEventListener("click", saveSectorSheet);
  document.getElementById("forum-sector-add-btn")?.addEventListener("click", addForumSector);
  document.getElementById("forum-sector-delete-btn")?.addEventListener("click", deleteForumSector);
  sectorWbSearchEl?.addEventListener("input", () => {
    void ensureForumWorldBookHydrated().then(() => renderSectorWbPicker());
  });
  sectorSheetSectorsEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit-sector-id]");
    if (!btn) return;
    const mf = ensureMaskForum();
    const prevSec = mf.sectors.find((s) => s.id === sectorSheetEditingId);
    if (prevSec) {
      prevSec.worldBookVolumeIds = sectorWbDraftIds.slice(0, FORUM_SECTOR_WB_MAX);
      applySectorSheetFieldsToSector(prevSec);
    }
    sectorSheetEditingId = btn.getAttribute("data-edit-sector-id");
    const sec = mf.sectors.find((s) => s.id === sectorSheetEditingId);
    sectorWbDraftIds = (sec?.worldBookVolumeIds || []).map((x) => String(x || "").trim()).filter(Boolean);
    syncSectorSheetFieldsFromSector(sec);
    renderSectorSheetSectors();
    renderSectorWbPicker();
  });
  sectorGenChipsEl?.addEventListener("click", (e) => {
    const chip = e.target.closest(".forum-gen-chip");
    if (!chip) return;
    sectorGenChipsEl.querySelectorAll(".forum-gen-chip").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
  });
  document.getElementById("forum-refresh-sheet-backdrop")?.addEventListener("click", closeRefreshSheet);
  document.getElementById("forum-refresh-sheet-close")?.addEventListener("click", closeRefreshSheet);
  document.getElementById("forum-share-sheet-backdrop")?.addEventListener("click", closeForumShareSheet);
  document.getElementById("forum-share-sheet-close")?.addEventListener("click", closeForumShareSheet);
  shareCharListEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-share-char-id]");
    if (!btn) return;
    const charId = btn.getAttribute("data-share-char-id");
    const post = pendingSharePostId ? findPost(pendingSharePostId) : null;
    if (!charId || !post) return;
    void deliverForumShareToChar(charId, post);
  });
  document.getElementById("forum-refresh-run-btn")?.addEventListener("click", runForumRefresh);
  refreshCastListEl?.addEventListener("change", (e) => {
    const input = e.target.closest("[data-cast-char-id]");
    if (!input) return;
    const id = input.getAttribute("data-cast-char-id");
    if (input.checked) {
      if (!refreshCastDraftIds.includes(id)) refreshCastDraftIds.push(id);
    } else refreshCastDraftIds = refreshCastDraftIds.filter((x) => x !== id);
    renderRefreshCastList();
  });
  sectorWbChipsEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-forum-wb-id]");
    if (btn) toggleSectorWbDraft(btn.getAttribute("data-forum-wb-id"));
  });
  sectorChipsEl?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-sector-id]");
    if (!chip) return;
    const mf = ensureMaskForum();
    mf.activeSectorId = chip.getAttribute("data-sector-id");
    saveMaskForum();
    renderSectorBar();
    if (activeTab === "square") renderFeed();
  });

  document.getElementById("forum-panel-profile")?.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open-post]");
    if (openBtn) openDetail(openBtn.getAttribute("data-open-post"));
  });

  document.querySelectorAll(".forum-moments-back").forEach((btn) => {
    btn.addEventListener("click", closeForumScreen);
  });
  document.getElementById("forum-refresh-btn")?.addEventListener("click", openRefreshSheet);
  document.getElementById("forum-detail-continue-btn")?.addEventListener("click", () => {
    void runForumDetailContinue();
  });
  document.getElementById("forum-detail-share-btn")?.addEventListener("click", () => {
    void sharePostToMitalk();
  });
  document.querySelectorAll(".forum-compose-mode").forEach((btn) => {
    btn.addEventListener("click", () => {
      composeMode = String(btn.getAttribute("data-compose-mode") || "short");
      syncComposeModeUi();
    });
  });
  composeTopBtn?.addEventListener("click", openComposeSheet);
  document.getElementById("forum-compose-backdrop")?.addEventListener("click", closeComposeSheet);
  document.getElementById("forum-compose-close")?.addEventListener("click", closeComposeSheet);
  composeSubmitEl?.addEventListener("click", publishPost);
  composeInputEl?.addEventListener("input", syncComposeSubmit);

  document.querySelectorAll("#forum-screen .chat-list-dock-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = String(btn.dataset.forumTab || "");
      if (!tab) return;
      activeTab = tab;
      syncTabs();
    });
  });

  feedEl?.addEventListener("click", (e) => {
    const dmBtn = e.target.closest("[data-dm-name]");
    if (dmBtn) {
      openDmWith(dmBtn.getAttribute("data-dm-name"), dmBtn.getAttribute("data-dm-initial"));
      return;
    }
    const quoteBtn = e.target.closest(".forum-feed-repost[data-open-id]");
    if (quoteBtn) {
      const targetId = quoteBtn.getAttribute("data-open-id");
      if (targetId && findPost(targetId)) openDetail(targetId);
      else if (targetId) toast("原帖已不存在");
      return;
    }
    const openPost = e.target.closest("[data-open-post]");
    if (openPost) {
      openDetail(openPost.getAttribute("data-open-post"));
      return;
    }
    const likeBtn = e.target.closest("[data-like-id]");
    if (likeBtn) {
      toggleLike(likeBtn.getAttribute("data-like-id"), e);
      return;
    }
    const saveBtn = e.target.closest("[data-save-id]");
    if (saveBtn) {
      toggleSave(saveBtn.getAttribute("data-save-id"), e);
      return;
    }
    const repostBtn = e.target.closest("[data-repost-id]");
    if (repostBtn) {
      e.stopPropagation();
      openRepostCompose(repostBtn.getAttribute("data-repost-id"));
      return;
    }
    const openBtn = e.target.closest("[data-open-id]");
    if (openBtn && !openBtn.hasAttribute("data-dm-name")) {
      openDetail(openBtn.getAttribute("data-open-id"));
      return;
    }
    const cmtBtn = e.target.closest("[data-comment-id]");
    if (cmtBtn) {
      const post = cmtBtn.closest(".forum-feed-card");
      if (post) {
        const form = post.querySelector(".forum-feed-compose");
        if (form) {
          form.classList.toggle("is-open");
          const input = form.querySelector(".forum-feed-compose-input");
          if (input) window.setTimeout(() => input.focus(), 80);
        }
      }
    }
  });

  feedEl?.addEventListener("submit", (e) => {
    const form = e.target.closest(".forum-feed-compose");
    if (!form) return;
    e.preventDefault();
    const id = form.getAttribute("data-post-id");
    const input = form.querySelector("[data-quick-input]");
    addComment(id, input?.value);
    if (input) input.value = "";
    form.classList.remove("is-open");
    toast("评论已发布 · AI 跟评即将上线");
  });

  detailScrollEl?.addEventListener("click", (e) => {
    const dmBtn = e.target.closest("[data-dm-name]");
    if (dmBtn) {
      openDmWith(dmBtn.getAttribute("data-dm-name"), dmBtn.getAttribute("data-dm-initial"));
      return;
    }
    const likeBtn = e.target.closest("[data-like-id]");
    if (likeBtn) {
      toggleLike(likeBtn.getAttribute("data-like-id"), e);
      return;
    }
    const repostBtn = e.target.closest("[data-repost-id]");
    if (repostBtn) {
      e.stopPropagation();
      openRepostCompose(repostBtn.getAttribute("data-repost-id"));
      return;
    }
    const openBtn = e.target.closest("[data-open-id]");
    if (openBtn) {
      const targetId = openBtn.getAttribute("data-open-id");
      if (targetId && findPost(targetId)) openDetail(targetId);
      else if (targetId) toast("原帖已不存在");
      return;
    }
  });

  document.getElementById("forum-detail-back")?.addEventListener("click", closeDetail);
  detailInputEl?.addEventListener("input", syncDetailSend);
  detailSendEl?.addEventListener("click", () => {
    if (!activePostId) return;
    addComment(activePostId, detailInputEl?.value);
    if (detailInputEl) detailInputEl.value = "";
    syncDetailSend();
    toast("评论已发布 · AI 跟评即将上线");
  });

  document.getElementById("forum-dm-back")?.addEventListener("click", closeConv);
  dmInputEl?.addEventListener("input", syncDmSend);
  dmSendEl?.addEventListener("click", sendDm);
  dmInputEl?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    if (!dmSendEl?.disabled) sendDm();
  });

  msgListEl?.addEventListener("click", (e) => {
    const delBtn = e.target.closest("[data-del-conv]");
    if (delBtn) {
      deleteConv(delBtn.getAttribute("data-del-conv"));
      return;
    }
    const openBtn = e.target.closest("[data-open-conv]");
    if (openBtn) openConv(openBtn.getAttribute("data-open-conv"));
  });

  msgListEl?.addEventListener("touchstart", (e) => {
    const row = e.target.closest(".forum-wx-chat-row-wrap");
    if (!row) return;
    row.dataset.touchX = String(e.touches[0].clientX);
  }, { passive: true });

  msgListEl?.addEventListener("touchmove", (e) => {
    const row = e.target.closest(".forum-wx-chat-row-wrap");
    if (!row || row.dataset.touchX == null) return;
    const dx = e.touches[0].clientX - Number(row.dataset.touchX);
    const shift = Math.max(-72, Math.min(0, dx));
    row.style.setProperty("--fm-swipe", `${shift}px`);
  }, { passive: true });

  msgListEl?.addEventListener("touchend", (e) => {
    const row = e.target.closest(".forum-wx-chat-row-wrap");
    if (!row) return;
    const shift = Number(String(row.style.getPropertyValue("--fm-swipe") || "0px").replace("px", "")) || 0;
    row.style.setProperty("--fm-swipe", shift < -36 ? "-72px" : "0px");
    delete row.dataset.touchX;
  });

  document.getElementById("forum-bg-notify-open")?.addEventListener("click", () => {
    closeForumBgNotify();
    if (typeof openForumScreen === "function") openForumScreen();
  });
  document.getElementById("forum-bg-notify-dismiss")?.addEventListener("click", closeForumBgNotify);
  document.getElementById("forum-bg-notify-backdrop")?.addEventListener("click", closeForumBgNotify);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleForumBgTimer();
  });

  scheduleForumBgTimer();
  window.scheduleForumBgTimer = scheduleForumBgTimer;
  window.applyForumCommentFromMitalk = applyForumCommentFromMitalk;
  window.getForumShareSnapshotByPostId = getForumShareSnapshotByPostId;
  window.listForumPostSummariesForMitalk = listForumPostSummariesForMitalk;
  syncForumApiEntryMeta();
})();
