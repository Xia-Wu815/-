"use strict";

/**
 * 主线 · 命运卡牌 · 独立玩法 + 剧本库
 */
(function () {
  const ASSET_V = "16";
  const K_SCRIPTS = "rp_roleplay_script_library_v1";
  const K_SAVES = "rp_roleplay_saves_v1";
  const K_ENDINGS = "rp_roleplay_endings_v1";
  const MAX_SAVES = 6;
  const MAX_ENDINGS = 50;
  const SUMMARY_THRESHOLD = 20;
  const RECENT_KEEP = 10;
  const LOADING_LABELS = ["聆听命运的低语", "星辰排列成新的图案", "五条命运线逐渐清晰", "故事的种子正在萌芽"];
  const PORTAL_MS = 2800;
  const PORTAL_MIN_MS = 1400;
  const TRAIN_COST = 1;
  const TRAIN_GAIN = 5;

  const ICON_LIST = "compass/sword/shield/wind/flame/moon/star/sun/sparkle";

  const ENDING_LABELS = {
    death: { label: "陨落" },
    madness: { label: "崩溃" },
    victory: { label: "达成" },
    failure: { label: "失败" },
    rival: { label: "被抢先" },
    other: { label: "未知" }
  };

  const EVENT_ICON_MAP = {
    flame: "ph-flame",
    bolt: "ph-lightning",
    eye: "ph-eye",
    heart: "ph-heart",
    skull: "ph-skull",
    star: "ph-star",
    moon: "ph-moon",
    crown: "ph-crown",
    sword: "ph-sword",
    shield: "ph-shield",
    compass: "ph-compass",
    wind: "ph-wind",
    warning: "ph-warning",
    sparkle: "ph-sparkle",
    sun: "ph-sun"
  };

  const WORLD_ICON_PH = {
    flame: "ph-flame",
    compass: "ph-compass",
    wind: "ph-wind",
    moon: "ph-moon",
    crown: "ph-crown",
    star: "ph-star",
    sword: "ph-sword",
    shield: "ph-shield"
  };

  const THEME_ICONS = {
    crimson: "ph-flame",
    ocean: "ph-compass",
    emerald: "ph-wind",
    violet: "ph-moon",
    amber: "ph-crown"
  };

  const THEME_COLORS = {
    crimson: { accent: "#c4908b", rgb: "196,144,139" },
    ocean: { accent: "#8da8c8", rgb: "141,168,200" },
    emerald: { accent: "#8fb5a3", rgb: "143,181,163" },
    violet: { accent: "#b0a0c4", rgb: "176,160,196" },
    amber: { accent: "#c8b490", rgb: "200,180,144" }
  };

  const THEME_TAG = {
    crimson: "烬",
    ocean: "潮",
    emerald: "灵",
    violet: "夜",
    amber: "权"
  };

  const MIST_COLORS = [
    { base: "180,170,210", accent: "140,120,190" },
    { base: "170,185,210", accent: "110,140,190" },
    { base: "175,195,170", accent: "120,165,110" },
    { base: "210,180,160", accent: "190,140,100" },
    { base: "160,185,210", accent: "100,150,200" }
  ];

  const DEFAULT_STAT_KEYS = ["hp", "sanity", "charm", "luck"];
  const DEFAULT_STAT_NAMES = { hp: "体质", sanity: "心智", charm: "魅力", luck: "运气" };
  const CARD_THEMES = ["crimson", "violet", "emerald", "amber", "ocean"];

  const DEMO_CARDS = [
    {
      id: "1",
      worldName: "末日废土",
      worldIcon: "flame",
      worldDesc: "核战后的荒芜世界，稀缺的资源引发无尽的争夺",
      userRole: "流浪赏金猎人",
      userRoleDesc: "背负神秘过去的独行者",
      userMission: "找到传说中的净土避难所并活着抵达",
      charRoles: [],
      hookLine: "你在废墟酒馆的角落发现了一张泛黄的藏宝图…",
      theme: "crimson",
      statNames: { survival: "生存", willpower: "意志", intimidation: "威慑", instinct: "嗅觉" }
    },
    {
      id: "2",
      worldName: "星际航行",
      worldIcon: "compass",
      worldDesc: "人类已殖民银河系，但未知的威胁正在逼近",
      userRole: "星舰副官",
      userRoleDesc: "刚被调任到神秘的幽灵号战舰",
      userMission: "调查幽灵号上一任副官失踪的真相",
      charRoles: [],
      hookLine: "舰长室的门缓缓打开，里面传来一声叹息…",
      theme: "ocean",
      statNames: { hull: "舰体", system: "系统", diplomacy: "外交", firepower: "火力" }
    },
    {
      id: "3",
      worldName: "仙侠修真",
      worldIcon: "wind",
      worldDesc: "灵气复苏的古老世界，各大宗门暗流涌动",
      userRole: "废柴弟子",
      userRoleDesc: "灵根被封印的天才，无人知晓你的真实身份",
      userMission: "在不暴露真实身份的前提下赢得宗门大比",
      charRoles: [],
      hookLine: "师门大比前夜，一只漆黑的乌鸦停在你窗前…",
      theme: "emerald",
      statNames: { qi: "气血", dao: "道心", grace: "仙姿", destiny: "天命" }
    },
    {
      id: "4",
      worldName: "校园悬疑",
      worldIcon: "moon",
      worldDesc: "名校连续发生离奇事件，真相隐藏在日常之下",
      userRole: "转学生",
      userRoleDesc: "带着秘密使命转入这所学校",
      userMission: "在期末前找出校园怪事的幕后黑手",
      charRoles: [],
      hookLine: "课桌抽屉里，你发现了一封不属于你的匿名信…",
      theme: "violet",
      statNames: { stamina: "体力", mood: "心态", social: "人缘", luck: "运气" }
    },
    {
      id: "5",
      worldName: "古代宫廷",
      worldIcon: "crown",
      worldDesc: "权谋交织的皇城，每个微笑背后都藏着刀锋",
      userRole: "落魄皇子",
      userRoleDesc: "被放逐边疆十年，今日奉诏还朝",
      userMission: "在登基大典前争取到至少两位重臣的支持",
      charRoles: [],
      hookLine: "午夜的御花园，有人在暗处低声唤你的名字…",
      theme: "amber",
      statNames: { dragonQi: "龙气", cunning: "心机", bearing: "气度", fortune: "国运" }
    }
  ];

  const screen = document.getElementById("roleplay-screen");
  const views = {
    hub: document.getElementById("roleplay-view-hub"),
    select: document.getElementById("roleplay-view-select"),
    mode: document.getElementById("roleplay-view-mode"),
    custom: document.getElementById("roleplay-view-custom"),
    loading: document.getElementById("roleplay-view-loading"),
    cards: document.getElementById("roleplay-view-cards"),
    portal: document.getElementById("roleplay-view-portal"),
    play: document.getElementById("roleplay-view-play"),
    ending: document.getElementById("roleplay-view-ending"),
    library: document.getElementById("roleplay-view-library"),
    libraryEdit: document.getElementById("roleplay-view-library-edit")
  };

  let phase = "hub";
  let selectedCharIds = [];
  let playMode = "story";
  let cardMode = "open";
  let customWorldText = "";
  let selectedWbVolumeId = "";
  let cards = [];
  let activeCard = null;
  let storyMessages = [];
  let relationships = [];
  let currentChoices = [];
  let currentEvent = null;
  let turnCount = 0;
  let missionProgress = { user: 50, chars: [] };
  let playerStats = {};
  let expPoints = 0;
  let storySummary = "";
  let isAiThinking = false;
  let pendingScriptId = "";
  let libraryEditId = "";
  let endingType = "";
  let endingCategory = "";
  let missionCompleter = null;
  let loadingTimer = null;
  let expandedCardIndex = null;
  let revealedCardIndex = null;
  let cardDissolving = false;
  let overlayMode = "";
  let portalOpeningPromise = null;
  let portalTimer = null;
  let portalFinishing = false;
  let isGeneratingNewMission = false;
  let activeWorldContext = "";
  let activeWorldBookVolumeId = "";

  function toast(msg) {
    if (typeof showToast === "function") showToast(msg);
  }

  function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "rp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  function loadCss() {
    const href = "roleplay.css?v=" + ASSET_V;
    let link = document.getElementById("xxj-roleplay-css");
    if (link) {
      if (link.getAttribute("href") !== href) link.href = href;
      return;
    }
    link = document.createElement("link");
    link.id = "xxj-roleplay-css";
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function getKvKey(name) {
    const D = window.XXJ_DB;
    if (D && D.K && D.K[name]) return D.K[name];
    if (name === "ROLEPLAY_SCRIPT_LIBRARY") return K_SCRIPTS;
    if (name === "ROLEPLAY_SAVES") return K_SAVES;
    if (name === "ROLEPLAY_ENDINGS") return K_ENDINGS;
    return name;
  }

  function readScriptLibrary() {
    const D = window.XXJ_DB;
    if (!D) return { v: 1, items: [] };
    const raw = D.getKv(getKvKey("ROLEPLAY_SCRIPT_LIBRARY"));
    if (raw && raw.v === 1 && Array.isArray(raw.items)) return raw;
    return { v: 1, items: [] };
  }

  function writeScriptLibrary(store) {
    const D = window.XXJ_DB;
    if (!D) return;
    D.setKv(getKvKey("ROLEPLAY_SCRIPT_LIBRARY"), store);
  }

  function readSaves() {
    const D = window.XXJ_DB;
    if (!D) return Array(MAX_SAVES).fill(null);
    const raw = D.getKv(getKvKey("ROLEPLAY_SAVES"));
    if (!Array.isArray(raw)) return Array(MAX_SAVES).fill(null);
    const arr = raw.slice(0, MAX_SAVES);
    while (arr.length < MAX_SAVES) arr.push(null);
    return arr;
  }

  function writeSaves(arr) {
    const D = window.XXJ_DB;
    if (!D) return;
    D.setKv(getKvKey("ROLEPLAY_SAVES"), arr.slice(0, MAX_SAVES));
  }

  function readEndings() {
    const D = window.XXJ_DB;
    if (!D) return [];
    const raw = D.getKv(getKvKey("ROLEPLAY_ENDINGS"));
    return Array.isArray(raw) ? raw : [];
  }

  function writeEndings(arr) {
    const D = window.XXJ_DB;
    if (!D) return;
    D.setKv(getKvKey("ROLEPLAY_ENDINGS"), arr.slice(0, MAX_ENDINGS));
  }

  function addEnding(entry) {
    const all = readEndings();
    all.unshift(entry);
    writeEndings(all);
  }

  function readCharStore() {
    const D = window.XXJ_DB;
    if (!D) return { items: [], activeId: "" };
    const raw = D.getKv(D.K.CHAR_PERSONA_STORE);
    if (raw && Array.isArray(raw.items)) return raw;
    return { items: [], activeId: "" };
  }

  function listAvailableChars() {
    return readCharStore().items.filter((p) => {
      if (!p || !p.id) return false;
      if (p.isGroup || p.isStub || p.isStranger) return false;
      const name = String(p.displayName || p.name || "").trim();
      return !!name;
    });
  }

  function getCharById(id) {
    return readCharStore().items.find((p) => p && p.id === id) || null;
  }

  function readActiveUserMask() {
    const D = window.XXJ_DB;
    if (!D) return null;
    const st = D.getKv(D.K.USER_MASK_STORE);
    if (st && Array.isArray(st.items)) {
      const id = String(st.activeId || "").trim();
      return st.items.find((x) => x && x.id === id) || st.items[0] || null;
    }
    const leg = D.getKv(D.K.USER_MASK);
    return leg && typeof leg === "object" ? leg : null;
  }

  function readWorldBookVolumes() {
    const D = window.XXJ_DB;
    if (!D) return [];
    const raw = D.getKv(D.K.WORLD_BOOK_STORE);
    if (!raw || !Array.isArray(raw.volumes)) return [];
    return raw.volumes;
  }

  function getUserGenderHint() {
    const mask = readActiveUserMask();
    const g = String(mask?.gender || mask?.sex || "").trim().toLowerCase();
    if (g === "male" || g === "男" || g === "m") return "male";
    if (g === "female" || g === "女" || g === "f") return "female";
    const blob = [mask?.persona, mask?.summary, mask?.displayName, mask?.boundaries]
      .map((x) => String(x || ""))
      .join("\n");
    return inferGenderFromPersonaBlob(blob);
  }

  function inferGenderFromPersonaBlob(blob) {
    const text = String(blob || "");
    if (!text.trim()) return "";
    const female = /(?:\b1\s*girl\b|\bfemale\b|\bwoman\b|女性|女生|女孩|女子|少女|小姐姐|美少女|女主|女孩子)/iu.test(
      text
    );
    const male = /(?:\b1\s*boy\b|\bmale\b|\bman\b|男性|男生|男孩|男子|少年|小哥哥|美少年|男主|男孩子)/iu.test(
      text
    );
    if (female && !male) return "female";
    if (male && !female) return "male";
    const she = (text.match(/她/g) || []).length;
    const he = (text.match(/他/g) || []).length;
    if (she > he && she >= 1) return "female";
    if (he > she && he >= 1) return "male";
    if (/女/u.test(text) && !/男/u.test(text)) return "female";
    if (/男/u.test(text) && !/女/u.test(text)) return "male";
    return "";
  }

  function getCharPersonaBlob(char) {
    if (!char) return "";
    return [
      char.persona,
      char.desc,
      char.summary,
      char.tags,
      char.voice,
      char.boundaries,
      char.displayName,
      char.name,
      Array.isArray(char.openings) ? char.openings[0] : "",
      char.scenario,
      char.opening
    ]
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .join("\n");
  }

  function sanitizePromptJsonStr(s, maxLen) {
    return String(s || "")
      .replace(/[\r\n]+/g, " ")
      .replace(/"/g, "'")
      .trim()
      .slice(0, maxLen || 200);
  }

  function buildCharProfileForCardGen(char) {
    const name = String(char.displayName || char.name || "").trim();
    const blob = getCharPersonaBlob(char);
    const gender = inferGenderFromPersonaBlob(blob);
    const persona = sanitizePromptJsonStr(char.persona || char.desc || blob, 400);
    const summary = sanitizePromptJsonStr(char.summary, 150);
    const tags = sanitizePromptJsonStr(char.tags, 80);
    const scenario = sanitizePromptJsonStr(
      char.scenario || char.opening || (Array.isArray(char.openings) ? char.openings[0] : ""),
      120
    );
    return (
      `{charId:"${char.id}", charName:"${name}"` +
      (gender ? `, gender:"${gender === "female" ? "女" : "男"}"` : "") +
      `, personality:"${persona || "性格待补充"}"` +
      (summary ? `, summary:"${summary}"` : "") +
      (tags ? `, tags:"${tags}"` : "") +
      (scenario ? `, scenario:"${scenario}"` : "") +
      `}`
    );
  }

  function normalizeCardThemes(rawCards) {
    const used = new Set();
    return (rawCards || []).map((card, i) => {
      let theme = String(card?.theme || "")
        .trim()
        .toLowerCase();
      if (CARD_THEMES.includes(theme) && !used.has(theme)) {
        used.add(theme);
        return { ...card, theme };
      }
      const next = CARD_THEMES.find((t) => !used.has(t)) || CARD_THEMES[i % CARD_THEMES.length];
      used.add(next);
      return { ...card, theme: next };
    });
  }

  function normalizeCharRolesOnCard(card, selectedChars) {
    const aiRoles = Array.isArray(card?.charRoles) ? card.charRoles : [];
    return selectedChars.map((p) => {
      const name = String(p.displayName || p.name || "").trim();
      const hit =
        aiRoles.find((r) => r && r.charId === p.id) ||
        aiRoles.find((r) => r && (r.charName === name || r.charName === p.name));
      const blob = getCharPersonaBlob(p);
      const gender = inferGenderFromPersonaBlob(blob);
      const fallbackRole = gender === "female" ? "神秘女子" : gender === "male" ? "神秘男子" : "神秘角色";
      return {
        charId: p.id,
        charName: name,
        role: String(hit?.role || "").trim() || fallbackRole,
        roleDesc: String(hit?.roleDesc || "").trim() || "身份成谜，性格却与人设一脉相承",
        mission: String(hit?.mission || "").trim()
      };
    });
  }

  function getActiveKeys(card) {
    if (card?.statNames && Object.keys(card.statNames).length) return Object.keys(card.statNames);
    return DEFAULT_STAT_KEYS;
  }

  function getStatNames(card) {
    if (card?.statNames && Object.keys(card.statNames).length) return card.statNames;
    return DEFAULT_STAT_NAMES;
  }

  function buildDefaultStats(card) {
    const keys = getActiveKeys(card);
    const s = {};
    keys.forEach((k, i) => {
      s[k] = i < 2 ? 100 : 50;
    });
    return s;
  }

  function hasAnySave() {
    return readSaves().some((s) => s !== null);
  }

  function syncHubBadges() {
    const lib = readScriptLibrary().items.length;
    const countEl = document.getElementById("roleplay-library-count");
    if (countEl) {
      countEl.textContent = String(lib);
      countEl.hidden = lib <= 0;
    }
    const endings = readEndings().length;
    const endEl = document.getElementById("roleplay-endings-count");
    if (endEl) {
      endEl.textContent = String(endings);
      endEl.hidden = endings <= 0;
    }
    const resumeBtn = document.getElementById("roleplay-resume-btn");
    if (resumeBtn) resumeBtn.hidden = !hasAnySave();
  }

  function formatSaveTime(ts) {
    if (!ts) return "未知时间";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function getWorldIconPh(name) {
    return WORLD_ICON_PH[name] || "ph-star";
  }

  function resolveEventIcon(icon) {
    const k = String(icon || "sparkle").trim().toLowerCase();
    return EVENT_ICON_MAP[k] || EVENT_ICON_MAP.sparkle;
  }

  function closeOverlay() {
    overlayMode = "";
    const ov = document.getElementById("roleplay-overlay");
    if (ov) ov.hidden = true;
    const panel = document.getElementById("roleplay-sheet-panel");
    if (panel) panel.innerHTML = "";
  }

  function openOverlay(mode) {
    if (mode === "save" && !activeCard) {
      toast("当前没有可保存的对局");
      return;
    }
    overlayMode = mode;
    const ov = document.getElementById("roleplay-overlay");
    if (ov) ov.hidden = false;
    if (mode === "save" || mode === "load") renderSaveLoadPanel(mode);
    else if (mode === "train") renderTrainingPanel();
    else if (mode === "endings") renderEndingGallery();
  }

  function showView(name) {
    phase = name;
    if (name !== "play" && name !== "ending") closeOverlay();
    Object.entries(views).forEach(([k, el]) => {
      if (!el) return;
      el.hidden = k !== name;
    });
  }

  function closeOtherScreens() {
    if (typeof closeSettings === "function") closeSettings();
    if (typeof closeMyScreen === "function") closeMyScreen();
    if (typeof closeCharScreen === "function") closeCharScreen();
    if (typeof closeChatScreen === "function") closeChatScreen();
    if (typeof closeChatListScreen === "function") closeChatListScreen();
    if (typeof closeCheckupScreen === "function") closeCheckupScreen();
    if (typeof closeRoamScreen === "function") closeRoamScreen();
    if (typeof closeRelationScreen === "function") closeRelationScreen();
    if (typeof closeStickerScreen === "function") closeStickerScreen();
    if (typeof closeWardrobeScreen === "function") closeWardrobeScreen();
    if (typeof closeWorldBookScreen === "function") closeWorldBookScreen();
    document.getElementById("drawer")?.classList.remove("open");
  }

  function resetPlayState() {
    cards = [];
    activeCard = null;
    storyMessages = [];
    relationships = [];
    currentChoices = [];
    currentEvent = null;
    turnCount = 0;
    missionProgress = { user: 50, chars: [] };
    playerStats = {};
    expPoints = 0;
    storySummary = "";
    isAiThinking = false;
    isGeneratingNewMission = false;
    endingType = "";
    endingCategory = "";
    missionCompleter = null;
    pendingScriptId = "";
    expandedCardIndex = null;
    revealedCardIndex = null;
    cardDissolving = false;
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
    if (portalTimer) {
      clearTimeout(portalTimer);
      portalTimer = null;
    }
    portalOpeningPromise = null;
    portalFinishing = false;
    activeWorldContext = "";
    activeWorldBookVolumeId = "";
    closeAllLayers();
  }

  function openRoleplayScreen(tab) {
    loadCss();
    closeOtherScreens();
    resetPlayState();
    selectedCharIds = [];
    playMode = "story";
    cardMode = "open";
    customWorldText = "";
    selectedWbVolumeId = "";
    screen?.classList.add("is-open");
    screen?.setAttribute("aria-hidden", "false");
    syncHubBadges();
    if (tab === "library") {
      showView("library");
      renderLibrary();
    } else {
      showView("hub");
    }
  }

  function closeRoleplayScreen() {
    if (phase === "play" && storyMessages.length > 1) {
      if (!window.confirm("退出将丢失未保存剧情，确定？")) return;
    }
    resetPlayState();
    screen?.classList.remove("is-open");
    screen?.setAttribute("aria-hidden", "true");
    showView("hub");
  }

  function mapCharsToCard(card, charIds) {
    const sel = charIds.map((id) => getCharById(id)).filter(Boolean);
    const slots = card.charRoleSlots || [];
    const charRoles = sel.map((p, i) => {
      const slot = slots[i] || {};
      return {
        charId: p.id,
        charName: String(p.displayName || p.name || "角色").trim(),
        role: slot.role || "神秘角色",
        roleDesc: slot.roleDesc || "身份成谜",
        mission: slot.mission || ""
      };
    });
    return { ...card, charRoles };
  }

  function cardToScriptItem(card, meta) {
    const charRoleSlots = (card.charRoles || []).map(({ role, roleDesc, mission }) => ({
      role: role || "神秘角色",
      roleDesc: roleDesc || "",
      mission: mission || ""
    }));
    return {
      id: uid(),
      title: card.worldName || "未命名剧本",
      note: "",
      source: meta?.source || "ai",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      playCount: 0,
      pinned: false,
      card: {
        worldName: card.worldName,
        worldIcon: card.worldIcon || "star",
        worldDesc: card.worldDesc || "",
        userRole: card.userRole || "旅人",
        userRoleDesc: card.userRoleDesc || "",
        userMission: card.userMission || "",
        hookLine: card.hookLine || "",
        theme: card.theme || "crimson",
        statNames: card.statNames || {},
        charRoleSlots
      },
      worldContext: meta?.worldContext || "",
      worldBookVolumeId: meta?.worldBookVolumeId || "",
      suggestedCharCount: meta?.suggestedCharCount || charRoleSlots.length || 1,
      defaultPlayMode: meta?.playMode || playMode,
      defaultCardMode: meta?.cardMode || cardMode
    };
  }

  function scriptItemToCard(item, charIds) {
    const c = item.card || {};
    const base = {
      id: uid(),
      worldName: c.worldName,
      worldIcon: c.worldIcon,
      worldDesc: c.worldDesc,
      userRole: c.userRole,
      userRoleDesc: c.userRoleDesc,
      userMission: c.userMission,
      hookLine: c.hookLine,
      theme: c.theme,
      statNames: c.statNames || {},
      charRoleSlots: c.charRoleSlots || []
    };
    return mapCharsToCard(base, charIds);
  }

  function addScriptFromCard(card, meta) {
    const store = readScriptLibrary();
    const item = cardToScriptItem(card, meta);
    store.items.unshift(item);
    writeScriptLibrary(store);
    syncHubBadges();
    toast("已收入剧本库");
    return item.id;
  }

  function bumpScriptPlayCount(id) {
    const store = readScriptLibrary();
    const item = store.items.find((x) => x.id === id);
    if (!item) return;
    item.playCount = (item.playCount || 0) + 1;
    item.updatedAt = Date.now();
    writeScriptLibrary(store);
  }

  function deleteScript(id) {
    const store = readScriptLibrary();
    store.items = store.items.filter((x) => x.id !== id);
    writeScriptLibrary(store);
    syncHubBadges();
  }

  function getScriptById(id) {
    return readScriptLibrary().items.find((x) => x.id === id) || null;
  }

  function normalizeModelJsonText(raw) {
    let s = String(raw || "")
      .replace(/^\uFEFF/, "")
      .trim();
    s = s.replace(/^(?:json|JSON)(?:\s*\r?\n|\s+)(?=[\[{])/, "").trim();
    if (s.startsWith("```")) {
      s = s.replace(/^```(?:json|JSON|[A-Za-z0-9_+-]{1,32})?\s*\r?\n/i, "");
      s = s.replace(/\r?\n```[\t ]*$/i, "").trim();
      if (s.endsWith("```")) s = s.slice(0, -3).trim();
    }
    return s.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  }

  function repairJsonCommas(s) {
    return String(s || "").replace(/,\s*([}\]])/g, "$1");
  }

  function sliceBalancedJson(text, kind) {
    const open = kind === "array" ? "[" : "{";
    const close = kind === "array" ? "]" : "}";
    const t = String(text || "");
    const start = t.indexOf(open);
    if (start < 0) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < t.length; i++) {
      const c = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return t.slice(start, i + 1);
      }
    }
    return null;
  }

  function findLastBalancedJson(text, kind) {
    const open = kind === "array" ? "[" : "{";
    const t = String(text || "");
    let pos = t.lastIndexOf(open);
    while (pos >= 0) {
      const slice = sliceBalancedJson(t.slice(pos), kind);
      if (slice) return slice;
      pos = t.lastIndexOf(open, pos - 1);
    }
    return null;
  }

  function unwrapJsonArray(obj) {
    if (Array.isArray(obj)) return obj;
    if (!obj || typeof obj !== "object") return null;
    for (const key of ["cards", "choices", "items", "data", "results", "charMissions"]) {
      if (Array.isArray(obj[key]) && obj[key].length) return obj[key];
    }
    return null;
  }

  function tryParseJsonCandidate(text, kind) {
    for (const raw of [text, repairJsonCommas(text)]) {
      if (!raw) continue;
      try {
        const v = JSON.parse(raw);
        if (kind === "array") {
          const arr = unwrapJsonArray(v);
          if (arr) return arr;
        } else if (v && typeof v === "object" && !Array.isArray(v)) {
          return v;
        }
      } catch {
        /* next */
      }
    }
    return null;
  }

  function parseJsonFromText(content, kind) {
    const normalized = normalizeModelJsonText(content);
    if (!normalized) throw new Error("AI 未返回有效 JSON");
    const candidates = new Set();
    candidates.add(normalized);
    const balanced = sliceBalancedJson(normalized, kind);
    if (balanced) candidates.add(balanced);
    const lastBalanced = findLastBalancedJson(normalized, kind);
    if (lastBalanced) candidates.add(lastBalanced);
    if (kind === "array") {
      const objSlice = sliceBalancedJson(normalized, "object");
      if (objSlice) candidates.add(objSlice);
      const lastObj = findLastBalancedJson(normalized, "object");
      if (lastObj) candidates.add(lastObj);
    } else {
      const arrSlice = sliceBalancedJson(normalized, "array");
      if (arrSlice) candidates.add(arrSlice);
    }
    for (const cand of candidates) {
      const parsed = tryParseJsonCandidate(cand, kind);
      if (parsed) return parsed;
    }
    throw new Error("AI 未返回有效 JSON");
  }

  function extractAiResponseText(data) {
    const ch0 = data?.choices?.[0];
    if (!ch0) return "";
    if (typeof ch0.text === "string" && ch0.text.trim()) return ch0.text.trim();
    const msg = ch0.message;
    if (!msg || typeof msg !== "object") return "";
    let content = "";
    const c = msg.content;
    if (typeof c === "string") content = c.trim();
    else if (Array.isArray(c)) {
      content = c
        .map((part) => {
          if (!part || typeof part !== "object") return "";
          if (String(part.type || "").toLowerCase() === "text") {
            return String(part.text || part.content || "");
          }
          return "";
        })
        .join("")
        .trim();
    }
    const reasoning = String(
      msg.reasoning_content || msg.reasoning || ch0.reasoning || ""
    ).trim();
    if (content && /[\[{]/.test(content)) return content;
    if (content) return content;
    if (reasoning && /[\[{]/.test(reasoning)) return reasoning;
    return reasoning || content;
  }

  function checkThresholdCrossings(prevStats, newStats, statNames) {
    const msgs = [];
    Object.keys(newStats || {}).forEach((key) => {
      const name = statNames[key] || key;
      const prev = prevStats[key] ?? 50;
      const cur = newStats[key] ?? 50;
      if (prev > 20 && cur <= 20) msgs.push(`你的「${name}」已接近极限，每一步都变得愈发艰难…`);
      if (prev > 10 && cur <= 10) msgs.push(`「${name}」的微光即将熄灭，危机迫在眉睫…`);
      if (prev < 80 && cur >= 80) msgs.push(`你的「${name}」已臻化境，周围的一切都为之侧目。`);
    });
    return msgs;
  }

  function resolveEndingCategory(result, statEnding, sk, stats) {
    if (statEnding) {
      if (sk[0] && (stats[sk[0]] ?? 50) <= 0) return "death";
      if (sk[1] && (stats[sk[1]] ?? 50) <= 0) return "madness";
      return "death";
    }
    const userP = missionProgress.user;
    if (result.missionComplete?.isUser && userP >= 100) return "victory";
    if (result.missionComplete?.isUser && userP <= 0) return "failure";
    if (result.missionComplete && !result.missionComplete.isUser) return "rival";
    return "other";
  }

  function getEndingCategoryLabel(cat) {
    return ENDING_LABELS[cat]?.label || ENDING_LABELS.other.label;
  }

  function getAi() {
    return window.RP_AI;
  }

  function hasAiKey() {
    const ai = getAi();
    return Boolean(String(ai?.getConfig?.()?.apiKey || "").trim());
  }

  async function aiChat(userPrompt, systemPrompt, maxTokens, temperature, opts) {
    const ai = getAi();
    if (!ai?.chatCompletions) throw new Error("AI 模块未加载");
    if (!hasAiKey()) throw new Error("请先在「我的 → 连接 API」填写 API Key");
    const o = opts && typeof opts === "object" ? opts : {};
    const payload = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: temperature ?? 0.9,
      max_tokens: maxTokens ?? 1500
    };
    if (o.jsonObject) payload.response_format = { type: "json_object" };
    let data;
    try {
      data = await ai.chatCompletions(payload);
    } catch (e) {
      if (
        o.jsonObject &&
        /response_format|json|JSON mode|unsupported|not supported/i.test(String(e?.message || ""))
      ) {
        delete payload.response_format;
        data = await ai.chatCompletions(payload);
      } else {
        throw e;
      }
    }
    if (o.jsonObject && !extractAiResponseText(data)) {
      delete payload.response_format;
      data = await ai.chatCompletions(payload);
    }
    const text = extractAiResponseText(data);
    if (!text.trim()) throw new Error("AI 返回内容为空，请检查模型或更换模型");
    const fr = String(data?.choices?.[0]?.finish_reason || "");
    if (fr === "length" || fr === "max_tokens") {
      const err = new Error("AI 输出被截断，请换更长输出上限的模型或简化设定");
      err.truncated = true;
      throw err;
    }
    return text;
  }

  function getWorldContextBlock() {
    const ctx = String(activeWorldContext || "").trim();
    if (!ctx) return "";
    return `\n【核心世界观约束】以下设定必须严格遵守，不可违背：\n${ctx}\n`;
  }

  function resolveScriptWorldContext(item) {
    if (!item) return "";
    if (String(item.worldContext || "").trim()) return String(item.worldContext).trim();
    const volId = String(item.worldBookVolumeId || "").trim();
    if (!volId) return "";
    const vol = readWorldBookVolumes().find((v) => v.id === volId);
    if (!vol) return "";
    const entries = (vol.entries || []).filter((e) => e.enabled !== false);
    const combined = entries.map((e) => `【${e.title}】${e.content}`).join("\n");
    return combined ? `[世界书：${vol.title || ""}]\n${combined}` : "";
  }

  function resolveCharDialogueSpeaker(charName) {
    const name = String(charName || "").trim();
    const rel = relationships.find((r) => r.charName === name);
    if (rel) {
      return { sender: rel.charId, senderName: name, senderAvatar: rel.charAvatar || "", isNpc: false };
    }
    const sel = selectedCharIds.map((id) => getCharById(id)).filter(Boolean);
    const persona = sel.find((p) => {
      const cr = activeCard?.charRoles?.find((c) => c.charId === p.id);
      return cr?.charName === name || String(p.displayName || p.name).trim() === name;
    });
    if (persona) {
      return { sender: persona.id, senderName: name, senderAvatar: persona.avatar || "", isNpc: false };
    }
    return { sender: "npc", senderName: name, senderAvatar: "", isNpc: true };
  }

  function pushCharDialogues(list) {
    if (!Array.isArray(list) || !list.length) return;
    list.forEach((cd) => {
      if (!cd?.charName || !cd?.text) return;
      const sp = resolveCharDialogueSpeaker(cd.charName);
      storyMessages.push({
        id: `c-${Date.now()}-${Math.random()}`,
        sender: sp.sender,
        senderName: sp.senderName,
        senderAvatar: sp.senderAvatar,
        isNpc: sp.isNpc,
        text: String(cd.text),
        type: "dialogue"
      });
    });
  }

  function isNpcMessage(msg) {
    if (msg.isNpc === false) return false;
    if (msg.isNpc === true || msg.sender === "npc") return true;
    if (msg.type !== "dialogue") return false;
    if (msg.senderAvatar) return false;
    return !relationships.some((r) => r.charId === msg.sender || r.charName === msg.senderName);
  }

  function buildStoryDirectorRules(isStoryOnly, sk, sn) {
    const rules = [
      "每个角色的对话必须严格符合其性格与说话习惯。",
      "每个角色都有隐藏任务，通过行为暗示而非直说。",
      "charDialogues 可包含同行角色与场景 NPC 的台词；NPC 为世界中出现的非同行人物，charName 用 NPC 名字。",
      "4个选项风格各异：至少1个与玩家任务相关，至少1个有风险或可能让进度倒退。",
      `event 的 icon 从 ${ICON_LIST} 选一个；choices 的 icon 也从 ${ICON_LIST} 选。`,
      "每3-5回合可触发一次 event（不要每回合都有）。",
      "relationChanges 单次 delta 在 -10 到 +10 之间。",
      "每回合必须返回所有参与者的 missionProgress（0-100），根据行动合理增减（通常 ±3~15）。",
      "当任意一方任务进度达 100，或玩家进度降到 0 时触发结局。",
      "触发结局时设 isEnding true，endingName 为 2-6 字诗意名称，不要用 HE/BE/SE。"
    ];
    if (!isStoryOnly && sk.length >= 2) {
      rules.push(
        `statChanges 每回合返回各属性增减（key 用 ${sk.join("/")}）。`,
        `第1项(${sn[sk[0]] || sk[0]})为核心生存属性：受创 -5~-20，恢复 +5~+15；归零触发结局。`,
        `第2项(${sn[sk[1]] || sk[1]})同上。`,
        "expGained 每回合 1-3。",
        "前两项属性任一归零也触发结局。"
      );
    }
    return rules.map((r, i) => `${i + 1}. ${r}`).join("\n");
  }

  async function generateCardsViaAI(selectedChars, worldCtx) {
    const charProfiles = selectedChars.map((c) => buildCharProfileForCardGen(c)).join(",\n");
    const gender = getUserGenderHint();
    const genderHint = gender
      ? `\n【玩家性别】玩家是${gender === "male" ? "男性" : "女性"}，userRole 与 userRoleDesc 必须符合该性别，禁止生成相反性别身份。`
      : "";
    const worldConstraint = worldCtx
      ? `\n【核心世界观约束】以下设定必须全部遵守，5张卡牌都必须基于此世界观（可是不同时代/地区/视角/阵营，不可脱离）：\n${worldCtx}\n`
      : "\n要求：5张世界观完全不同；";
    const statHint =
      "statNames(4-8项，key为英文，value为2-3字中文，前两项为核心生存属性，归零触发结局。例宫斗:{dragonQi:龙气,cunning:心机};末世:{survival:生存,willpower:意志};仙侠:{qi:气血,dao:道心})";
    const charRoleHint =
      selectedChars.length > 0
        ? `charRoles 必须包含以下每个角色的条目（charId/charName 一一对应）：${selectedChars.map((c) => `${c.id}=${String(c.displayName || c.name).trim()}`).join("、")}。每个 role(2-5字)/roleDesc(8-15字)/mission(10-20字) 必须贴合该角色 personality、gender、summary，穿越后身份与人设性格呼应，不可全员「神秘角色」。`
        : "charRoles 可为空数组。";
    const prompt =
      `为角色扮演游戏生成5张命运卡牌。参与角色：${selectedChars.map((c) => String(c.displayName || c.name).trim()).join("、")}${genderHint}\n` +
      `【角色详细人设（穿越后必须保留核心性格与性别特征）】\n${charProfiles}\n` +
      `每张含 worldName(2-4字), worldIcon(flame/compass/wind/moon/crown/sword/shield/star), worldDesc(15-25字), userRole(2-5字), userRoleDesc(8-15字), userMission(10-20字), charRoles[{charId,charName,role,roleDesc,mission}], hookLine(15-30字), theme, ${statHint}。\n` +
      `【theme 硬性要求】5张卡的 theme 必须分别使用 crimson、violet、emerald、amber、ocean 各一次，绝对不可重复或省略。\n` +
      `${charRoleHint}\n` +
      `${worldConstraint}任务之间要有张力；hookLine 引人入胜。\n` +
      `只返回 JSON 对象，格式 {"cards":[5张卡牌数组]}，不要 markdown 或其它说明文字。`;
    const content = await aiChat(
      prompt,
      "你是创意游戏设计师。只返回 JSON 对象 {\"cards\":[...]}，不要 markdown。",
      4096,
      0.9,
      { jsonObject: true }
    );
    const parsed = parseJsonFromText(content, "object");
    const arr = unwrapJsonArray(parsed) || (Array.isArray(parsed) ? parsed : null);
    if (!arr?.length) throw new Error("AI 未返回有效 JSON");
    return arr.slice(0, 5);
  }

  function attachCharRolesToCards(rawCards, selectedChars) {
    return normalizeCardThemes(rawCards).map((c, i) => ({
      ...c,
      id: String(i + 1),
      charRoles: normalizeCharRolesOnCard(c, selectedChars)
    }));
  }

  function templateOpeningChoices(card) {
    const firstChar = card?.charRoles?.[0];
    const fc = firstChar?.charName || "";
    const role = card?.userRole || "你";
    const TEMPLATES = {
      crimson: [
        { id: "1", icon: "shield", text: `以${role}的直觉警惕地扫视四周` },
        { id: "2", icon: "sword", text: fc ? `径直走向${fc}，质问来意` : "拔出武器，喝问暗处的人" },
        { id: "3", icon: "moon", text: "按捺不安，在阴影中寻找线索" },
        { id: "4", icon: "wind", text: "假装毫不在意，暗中观察所有人" }
      ],
      violet: [
        { id: "1", icon: "compass", text: "感受空气中的异常，尝试解读" },
        { id: "2", icon: "star", text: fc ? `向${fc}询问这里的秘密` : "低声念出一段古老的咒文" },
        { id: "3", icon: "shield", text: "谨慎地试探周围是否有陷阱" },
        { id: "4", icon: "moon", text: "闭目冥想，试图感知隐藏的存在" }
      ],
      emerald: [
        { id: "1", icon: "compass", text: "仔细观察周围的地形和植被" },
        { id: "2", icon: "wind", text: fc ? `向${fc}挥手示意同行` : "沿着小径大步向前走去" },
        { id: "3", icon: "sun", text: "登上高处，俯瞰整片区域" },
        { id: "4", icon: "shield", text: "原地不动，倾听自然的声音" }
      ],
      amber: [
        { id: "1", icon: "compass", text: "翻看手中的地图，确认方位" },
        { id: "2", icon: "flame", text: fc ? `拉住${fc}，低声交换情报` : "点燃火把，照亮前方的通道" },
        { id: "3", icon: "star", text: "检查随身携带的物资和装备" },
        { id: "4", icon: "wind", text: "悄无声息地向前方摸去" }
      ],
      ocean: [
        { id: "1", icon: "compass", text: "凝视远方，寻找异常的迹象" },
        { id: "2", icon: "star", text: fc ? `向${fc}打听最近发生的事` : "向附近的人打听消息" },
        { id: "3", icon: "shield", text: "深吸一口气，让自己冷静下来" },
        { id: "4", icon: "wind", text: "沿着边缘小心翼翼地前行" }
      ]
    };
    return TEMPLATES[card?.theme] || TEMPLATES.crimson;
  }

  function normalizeChoiceList(arr) {
    const out = (Array.isArray(arr) ? arr : [])
      .slice(0, 4)
      .map((c, i) => ({
        id: String(i + 1),
        text: String(c?.text || "").trim(),
        icon: c?.icon ? String(c.icon) : ""
      }))
      .filter((c) => c.text.length >= 2);
    const seen = new Set();
    return out.filter((c) => {
      if (seen.has(c.text)) return false;
      seen.add(c.text);
      return true;
    });
  }

  async function generateOpeningChoices(card, chars) {
    if (!getAi()?.chatCompletions || !hasAiKey()) {
      return templateOpeningChoices(card);
    }
    const sel = selectedCharIds.map((id) => getCharById(id)).filter(Boolean);
    const cDescs = chars
      .map((c) => {
        const persona = sel.find((p) => {
          const cr = card.charRoles?.find((r) => r.charName === c.charName);
          return cr?.charId === p.id;
        });
        const blob = getCharPersonaBlob(persona).slice(0, 120);
        return `${c.charName}(${c.role}${blob ? `; ${blob}` : ""})`;
      })
      .join(", ");
    const missionHint = card.userMission ? `\n【玩家秘密任务】${card.userMission}` : "";
    const prompt =
      `你是沉浸式互动小说的 AI 导演。\n【世界】${card.worldName}：${card.worldDesc}${getWorldContextBlock()}\n` +
      `【玩家】${card.userRole}：${card.userRoleDesc}${missionHint}\n【同行】${cDescs || "无"}\n【开场悬念】${card.hookLine}\n\n` +
      `为这个故事的开场生成 4 个风格各异的初始行动选项（8-15 字）。\n` +
      `要求：\n1. 必须紧密贴合当前世界观、开场悬念与角色身份\n2. 四选一：谨慎 / 大胆 / 社交 / 独行，差异要大\n3. 至少一个涉及与同行角色互动\n4. 避免「继续观察」「说点什么」等空泛套话\n` +
      `icon 从 ${ICON_LIST} 选。\n` +
      `只返回 JSON 对象：{"choices":[{"id":"1","text":"","icon":""},…共4个]}`;

    async function fetchChoices(jsonObject) {
      const content = await aiChat(
        prompt,
        jsonObject ? '只返回 JSON 对象 {"choices":[...]}。' : "只返回 JSON 数组 [{id,text,icon},…]。",
        800,
        0.92,
        jsonObject ? { jsonObject: true } : undefined
      );
      if (jsonObject) {
        const obj = parseJsonFromText(content, "object");
        return normalizeChoiceList(unwrapJsonArray(obj));
      }
      return normalizeChoiceList(parseJsonFromText(content, "array"));
    }

    try {
      let list = await fetchChoices(true);
      if (list.length < 2) {
        list = await fetchChoices(false);
      }
      if (list.length < 2) throw new Error("选项不足");
      while (list.length < 4) {
        const pad = templateOpeningChoices(card)[list.length];
        if (pad && !list.some((x) => x.text === pad.text)) list.push(pad);
        else break;
      }
      return list.slice(0, 4);
    } catch (e) {
      console.warn("[roleplay] opening choices:", e?.message || e);
      toast("开场选项 AI 生成失败，已用备用选项");
      return templateOpeningChoices(card);
    }
  }

  async function summarizeHistory(history, existingSummary, userRole) {
    if (history.length <= SUMMARY_THRESHOLD) return { summary: existingSummary, trimmedHistory: history };
    const toSummarize = history.slice(0, history.length - RECENT_KEEP);
    const keep = history.slice(history.length - RECENT_KEEP);
    const oldText = toSummarize
      .map((m) => {
        if (m.type === "narration") return `[旁白] ${m.text}`;
        if (m.type === "event") return `[事件] ${m.text}`;
        if (m.sender === "user") return `[${userRole}(你)] ${m.text}`;
        return `[${m.senderName}] ${m.text}`;
      })
      .join("\n");
    const prompt = existingSummary
      ? `已有摘要：\n${existingSummary}\n\n新增：\n${oldText}\n\n合并为150-250字摘要，只返回文字。`
      : `剧情：\n${oldText}\n\n总结为150-250字摘要，只返回文字。`;
    try {
      const summary = (await aiChat(prompt, "你是剧情总结专家。", 500, 0.3)).trim();
      return { summary: summary || existingSummary, trimmedHistory: keep };
    } catch {
      return { summary: existingSummary, trimmedHistory: history };
    }
  }

  async function continueStory(action) {
    const userRole = activeCard?.userRole || "你";
    const sel = selectedCharIds.map((id) => getCharById(id)).filter(Boolean);
    const chars = (activeCard?.charRoles || []).map((cr) => {
      const persona = sel.find((p) => p.id === cr.charId);
      return {
        name: cr.charName,
        role: cr.role,
        roleDesc: cr.roleDesc,
        personality: getCharPersonaBlob(persona).slice(0, 200),
        mission: cr.mission
      };
    });
    const recentMsgs = storyMessages
      .slice(-15)
      .map((m) => {
        if (m.type === "narration") return `[旁白] ${m.text}`;
        if (m.type === "event") return `[事件] ${m.text}`;
        if (m.sender === "user") return `[${userRole}(你)] ${m.text}`;
        return `[${m.senderName}] ${m.text}`;
      })
      .join("\n");
    const hText = storySummary ? `[前情提要] ${storySummary}\n---\n${recentMsgs}` : recentMsgs;
    const rText = relationships.map((r) => `${r.charName}: ${r.value}%`).join(", ");
    const cDescs = chars
      .map(
        (c) =>
          `${c.name}(${c.role}: ${c.roleDesc}${c.personality ? `; 性格:${c.personality}` : ""}${c.mission ? `; 隐藏任务:${c.mission}` : ""})`
      )
      .join(", ");
    const isStoryOnly = playMode === "story";
    const sk = getActiveKeys(activeCard);
    const sn = getStatNames(activeCard);
    const worldBlock = getWorldContextBlock();
    const missionBlock = activeCard.userMission ? `【玩家秘密任务】${activeCard.userMission}\n` : "";
    const progressBlock = `【任务进度】玩家 ${missionProgress.user}%${missionProgress.chars.map((c) => `；${c.charName} ${c.progress}%`).join("")}\n`;
    const rules = buildStoryDirectorRules(isStoryOnly, sk, sn);
    const jsonShape = isStoryOnly
      ? `{"narration":"50-120字场景","charDialogues":[{"charName":"","text":""}],"event":null或{"text":"","icon":"从${ICON_LIST}选"},"choices":[{"id":"1","text":"","icon":"从${ICON_LIST}选"},共4个],"relationChanges":[{"charName":"","delta":数}],"missionProgress":{"user":0-100,"chars":[{"charName":"","progress":0-100}]},"isEnding":false,"endingName":null,"missionComplete":null}`
      : `{"narration":"50-120字场景","charDialogues":[{"charName":"","text":""}],"event":null或{"text":"","icon":"从${ICON_LIST}选"},"choices":[{"id":"1","text":"","icon":"从${ICON_LIST}选"},共4个],"relationChanges":[{"charName":"","delta":数}],"missionProgress":{"user":0-100,"chars":[{"charName":"","progress":0-100}]},"statChanges":{${sk.map((k) => `"${k}":增减值`).join(",")}},"expGained":1-3,"isEnding":false,"endingName":null,"missionComplete":null}`;
    let prompt;
    if (isStoryOnly) {
      prompt =
        `你是沉浸式互动小说 AI 导演。\n【世界】${activeCard.worldName}：${activeCard.worldDesc}${worldBlock}\n【角色】用户"${userRole}"；同行：${cDescs}\n` +
        missionBlock +
        progressBlock +
        `【关系】${rText}\n【历史】\n${hText}\n【用户行动】${action}\n\n` +
        `返回 JSON 对象（单个对象，不要数组）：${jsonShape}\n\n要求：\n${rules}`;
    } else {
      const statsBlock = sk.map((k) => `${sn[k] || k}:${playerStats[k] ?? 50}`).join(" ");
      prompt =
        `你是沉浸式互动小说 AI 导演。\n【世界】${activeCard.worldName}：${activeCard.worldDesc}${worldBlock}\n【角色】用户"${userRole}"；同行：${cDescs}\n` +
        missionBlock +
        `【属性】${statsBlock}\n【关系】${rText}\n【历史】\n${hText}\n【用户行动】${action}\n\n` +
        `返回 JSON 对象（单个对象，不要数组）：${jsonShape}\n\n要求：\n${rules}`;
    }
    const content = await aiChat(
      prompt,
      "你是顶级互动小说 AI。只返回一个 JSON 对象，不要 markdown。",
      isStoryOnly ? 2200 : 2800,
      0.85,
      { jsonObject: true }
    );
    return parseJsonFromText(content, "object");
  }

  function demoContinueStory() {
    const npcPool = ["路过的商贩", "神秘来客", "守夜人", "街角老人"];
    const npcName = npcPool[Math.floor(Math.random() * npcPool.length)];
    const charDialogues = [];
    if (relationships.length) {
      charDialogues.push({
        charName: relationships[0].charName,
        text: "「有意思…没想到你会这么做。」"
      });
    }
    if (Math.random() > 0.35) {
      charDialogues.push({
        charName: npcName,
        text: "「这地方不太平，你们最好小心些。」"
      });
    }
    return {
      narration: "空气中弥漫着紧张的气息。你的选择引发了一连串意想不到的反应…",
      charDialogues,
      event: Math.random() > 0.6 ? { text: "远处传来一声闷响，大地微微颤抖…" } : null,
      choices: [
        { id: "1", text: "做好战斗准备" },
        { id: "2", text: "趁乱赶紧撤离" },
        { id: "3", text: "向对方伸出援手" },
        { id: "4", text: "仔细调查异常" }
      ],
      relationChanges: [],
      missionProgress: { user: Math.min(100, missionProgress.user + 8), chars: missionProgress.chars },
      isEnding: false
    };
  }

  function startLoading() {
    showView("loading");
    let step = 0;
    const el = document.getElementById("roleplay-loading-text");
    if (el) el.textContent = LOADING_LABELS[0];
    loadingTimer = setInterval(() => {
      step = (step + 1) % LOADING_LABELS.length;
      if (el) el.textContent = LOADING_LABELS[step];
    }, 2600);
  }

  function stopLoading() {
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
  }

  async function handleGenerateCards(worldCtx) {
    activeWorldContext = worldCtx ? String(worldCtx).trim() : "";
    activeWorldBookVolumeId = activeWorldContext && selectedWbVolumeId ? selectedWbVolumeId : "";
    startLoading();
    const sel = selectedCharIds.map((id) => getCharById(id)).filter(Boolean);
    try {
      if (getAi()?.chatCompletions && hasAiKey()) {
        const raw = await generateCardsViaAI(sel, worldCtx);
        cards = attachCharRolesToCards(raw, sel);
      } else {
        if (!hasAiKey()) toast("未配置 API Key · 使用演示卡牌");
        await new Promise((r) => setTimeout(r, 1200));
        cards = attachCharRolesToCards(DEMO_CARDS.map((c) => ({ ...c })), sel);
      }
    } catch (e) {
      toast(e?.message || "生成失败，使用演示卡牌");
      cards = attachCharRolesToCards(DEMO_CARDS.map((c) => ({ ...c })), sel);
    }
    stopLoading();
    renderCards();
    showView("cards");
  }

  function getCustomWorldContext() {
    if (!selectedWbVolumeId && !customWorldText.trim()) return "";
    if (selectedWbVolumeId) {
      const vol = readWorldBookVolumes().find((v) => v.id === selectedWbVolumeId);
      const entries = (vol?.entries || []).filter((e) => e.enabled !== false);
      const combined = entries.map((e) => `【${e.title}】${e.content}`).join("\n");
      const extra = customWorldText.trim() ? `\n【附加】${customWorldText.trim()}` : "";
      return `[世界书：${vol?.title || ""}]\n${combined}${extra}`;
    }
    return customWorldText.trim();
  }

  function renderCharSelect() {
    const grid = document.getElementById("roleplay-char-grid");
    const empty = document.getElementById("roleplay-char-empty");
    const confirm = document.getElementById("roleplay-select-confirm");
    if (!grid) return;
    const list = listAvailableChars();
    grid.innerHTML = "";
    if (!list.length) {
      if (empty) empty.hidden = false;
      if (confirm) confirm.disabled = true;
      return;
    }
    if (empty) empty.hidden = true;
    list.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "roleplay-char-tile" + (selectedCharIds.includes(p.id) ? " is-on" : "");
      btn.dataset.charId = p.id;
      const av = String(p.avatar || "").trim() || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
      btn.innerHTML =
        `<img src="${av.replace(/"/g, "&quot;")}" alt="">` +
        `<span class="roleplay-char-tile-overlay"></span>` +
        `<span class="roleplay-char-tile-name">${escapeHtml(String(p.displayName || p.name).trim())}</span>` +
        (selectedCharIds.includes(p.id) ? `<span class="roleplay-char-tile-check"><i class="ph ph-check"></i></span>` : "");
      grid.appendChild(btn);
    });
    if (confirm) {
      confirm.disabled = selectedCharIds.length <= 0;
      confirm.textContent =
        selectedCharIds.length > 0 ? `选定 ${selectedCharIds.length} 位同行者` : "选定同行者";
    }
  }

  function renderWbChips() {
    const wrap = document.getElementById("roleplay-wb-chips");
    if (!wrap) return;
    wrap.innerHTML = "";
    readWorldBookVolumes().forEach((vol) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "roleplay-wb-chip" + (selectedWbVolumeId === vol.id ? " is-on" : "");
      btn.textContent = `${vol.title || "未命名"} (${(vol.entries || []).length})`;
      btn.addEventListener("click", () => {
        selectedWbVolumeId = selectedWbVolumeId === vol.id ? "" : vol.id;
        renderWbChips();
      });
      wrap.appendChild(btn);
    });
  }

  function getTheme(card) {
    return THEME_COLORS[card?.theme] || THEME_COLORS.crimson;
  }

  function getFanGeometry(count) {
    const spread = Math.min(count * 9, 40);
    return Array.from({ length: count }, (_, i) => {
      const norm = count > 1 ? (i / (count - 1) - 0.5) * 2 : 0;
      return {
        rotate: norm * spread,
        x: norm * (count > 3 ? 34 : 24),
        y: Math.abs(norm) * 24
      };
    });
  }

  function buildMistCardHtml(index, compact) {
    const mc = MIST_COLORS[index % MIST_COLORS.length];
    const num = String(index + 1).padStart(2, "0");
    return (
      `<div class="roleplay-fcard roleplay-fcard--sealed${compact ? " roleplay-fcard--sm" : ""}" style="--fc-r:${mc.accent};--fc-b:${mc.base}">` +
      `<div class="roleplay-fcard-seal-pattern" aria-hidden="true"></div>` +
      `<div class="roleplay-fcard-seal-scan" aria-hidden="true"></div>` +
      `<div class="roleplay-fcard-seal-core">` +
      `<span class="roleplay-fcard-seal-no">${num}</span>` +
      `<span class="roleplay-fcard-seal-k">${compact ? "?" : "未开"}</span>` +
      `<span class="roleplay-fcard-seal-sub">sealed line</span>` +
      `</div></div>`
    );
  }

  function buildCardFaceHtml(card, expanded, index) {
    const t = getTheme(card);
    const icon = THEME_ICONS[card.theme] || "ph-star";
    const tag = THEME_TAG[card.theme] || "途";
    const num = index != null ? String(index + 1).padStart(2, "0") : "";
    const statKeys = card.statNames ? Object.keys(card.statNames).slice(0, 6) : [];
    const statsHtml = statKeys.length
      ? `<div class="roleplay-fcard-stats">${statKeys
          .map((k) => `<span>${escapeHtml(card.statNames[k] || k)}</span>`)
          .join("")}</div>`
      : "";
    const companions =
      expanded && card.charRoles?.length
        ? `<section class="roleplay-fcard-section">` +
          `<h4 class="roleplay-fcard-section-k">同行者 <i>${String(card.charRoles.length).padStart(2, "0")}</i></h4>` +
          `<ul class="roleplay-fcard-list">${card.charRoles
            .map(
              (cr) =>
                `<li><strong>${escapeHtml(cr.charName)}</strong><span>${escapeHtml(cr.role)}</span></li>`
            )
            .join("")}</ul></section>`
        : "";
    const mission = card.userMission
      ? `<section class="roleplay-fcard-section roleplay-fcard-section--mission">` +
        `<h4 class="roleplay-fcard-section-k">秘密任务</h4>` +
        `<p class="roleplay-fcard-mission">${escapeHtml(card.userMission)}</p></section>`
      : "";

    if (!expanded) {
      return (
        `<div class="roleplay-fcard roleplay-fcard--sm roleplay-fcard--face" style="--fc-r:${t.rgb};--fc-a:${t.accent}">` +
        `<span class="roleplay-fcard-accent" aria-hidden="true"></span>` +
        `<span class="roleplay-fcard-watermark" aria-hidden="true"><i class="ph ${icon}"></i></span>` +
        `<div class="roleplay-fcard-top">` +
        `<span class="roleplay-fcard-no">${num || "·"}</span>` +
        `<span class="roleplay-fcard-tag">${tag}</span>` +
        `</div>` +
        `<div class="roleplay-fcard-body roleplay-fcard-body--sm">` +
        `<h3 class="roleplay-fcard-title">${escapeHtml(card.worldName || "未知")}</h3>` +
        `<span class="roleplay-fcard-rule"></span>` +
        `<p class="roleplay-fcard-role">${escapeHtml(card.userRole || "")}</p>` +
        `</div></div>`
      );
    }

    return (
      `<div class="roleplay-fcard roleplay-fcard--face roleplay-fcard--lg" style="--fc-r:${t.rgb};--fc-a:${t.accent}">` +
      `<span class="roleplay-fcard-accent" aria-hidden="true"></span>` +
      `<span class="roleplay-fcard-watermark roleplay-fcard-watermark--lg" aria-hidden="true"><i class="ph ${icon}"></i></span>` +
      `<header class="roleplay-fcard-header">` +
      `<div class="roleplay-fcard-header-row">` +
      `<span class="roleplay-fcard-no">${num || "·"}</span>` +
      `<span class="roleplay-fcard-tag">${tag}线</span>` +
      `<span class="roleplay-fcard-icon"><i class="ph ${icon}"></i></span>` +
      `</div>` +
      `<h3 class="roleplay-fcard-title roleplay-fcard-title--lg">${escapeHtml(card.worldName || "未知")}</h3>` +
      `<p class="roleplay-fcard-desc">${escapeHtml(card.worldDesc || "")}</p>` +
      `</header>` +
      `<div class="roleplay-fcard-scroll">` +
      `<section class="roleplay-fcard-section">` +
      `<h4 class="roleplay-fcard-section-k">你的身份</h4>` +
      `<p class="roleplay-fcard-lead"><strong>${escapeHtml(card.userRole || "")}</strong></p>` +
      `<p class="roleplay-fcard-copy">${escapeHtml(card.userRoleDesc || "")}</p>` +
      `</section>` +
      mission +
      companions +
      (card.hookLine
        ? `<blockquote class="roleplay-fcard-verse">${escapeHtml(card.hookLine)}</blockquote>`
        : "") +
      statsHtml +
      `</div></div>`
    );
  }

  function closeFateOverlay() {
    expandedCardIndex = null;
    revealedCardIndex = null;
    cardDissolving = false;
    const overlay = document.getElementById("roleplay-fate-overlay");
    if (overlay) overlay.hidden = true;
    const fan = document.getElementById("roleplay-fate-fan");
    if (fan && cards.length) renderCards();
  }

  function closeAllLayers() {
    closeOverlay();
    closeFateOverlay();
  }

  function renderFateOverlay(idx) {
    const card = cards[idx];
    const overlay = document.getElementById("roleplay-fate-overlay");
    const sheet = document.getElementById("roleplay-fate-sheet");
    if (!card || !overlay || !sheet) return;
    overlay.hidden = false;
    const isBlind = cardMode === "blind";
    const isRevealed = revealedCardIndex === idx;
    let cardHtml = "";
    if (isBlind && !isRevealed) {
      cardHtml = `<div class="roleplay-fate-sheet-card roleplay-fate-sheet-card--sealed">${buildMistCardHtml(idx, false)}</div>`;
    } else if (cardDissolving && isBlind) {
      cardHtml =
        `<div class="roleplay-fate-sheet-card roleplay-fate-sheet-card--sealed">` +
        `<div class="roleplay-fan-dissolve">${buildCardFaceHtml(card, true, idx)}${buildMistCardHtml(idx, false)}</div></div>`;
    } else {
      cardHtml = `<div class="roleplay-fate-sheet-card">${buildCardFaceHtml(card, true, idx)}</div>`;
    }
    let actions = "";
    if (isBlind && !isRevealed) {
      actions =
        `<button type="button" class="roleplay-primary" id="roleplay-fate-reveal">揭示命运</button>` +
        `<button type="button" class="roleplay-ghost" id="roleplay-fate-collapse">收起</button>`;
    } else {
      actions =
        `<button type="button" class="roleplay-primary" id="roleplay-fate-pick">进入此线</button>` +
        `<button type="button" class="roleplay-ghost" id="roleplay-fate-save">收进剧本库</button>` +
        `<button type="button" class="roleplay-link-btn" id="roleplay-fate-collapse">收起</button>`;
    }
    sheet.innerHTML = cardHtml + `<div class="roleplay-fate-sheet-actions">${actions}</div>`;
    document.getElementById("roleplay-fate-reveal")?.addEventListener("click", () => {
      cardDissolving = true;
      renderCards();
      window.setTimeout(() => {
        revealedCardIndex = idx;
        cardDissolving = false;
        renderCards();
        renderFateOverlay(idx);
      }, 900);
    });
    document.getElementById("roleplay-fate-pick")?.addEventListener("click", () => {
      void enterPlayViaPortal(card);
    });
    document.getElementById("roleplay-fate-save")?.addEventListener("click", () => {
      addScriptFromCard(card, {
        source: "ai",
        worldContext: getCustomWorldContext(),
        worldBookVolumeId: selectedWbVolumeId,
        suggestedCharCount: selectedCharIds.length,
        playMode,
        cardMode
      });
    });
    document.getElementById("roleplay-fate-collapse")?.addEventListener("click", closeFateOverlay);
  }

  function renderCards() {
    const fan = document.getElementById("roleplay-fate-fan");
    const hint = document.getElementById("roleplay-cards-hint");
    if (!fan) return;
    if (hint) {
      if (expandedCardIndex !== null) {
        hint.textContent = cardMode === "blind" && revealedCardIndex !== expandedCardIndex ? "迷雾未散 · 揭示后择路" : "择一条命途，或收入剧本库";
      } else {
        hint.textContent = cardMode === "blind" ? "轻触迷雾卡牌 · 揭开命运" : "轻触一张卡牌 · 展开择路";
      }
    }
    fan.innerHTML = "";
    const geom = getFanGeometry(cards.length);
    cards.forEach((card, idx) => {
      const g = geom[idx] || { rotate: 0, x: 0, y: 0 };
      const isExpanded = expandedCardIndex === idx;
      const isHidden = expandedCardIndex !== null && expandedCardIndex !== idx;
      const wrap = document.createElement("button");
      wrap.type = "button";
      wrap.className =
        "roleplay-fan-card" +
        (isExpanded ? " is-expanded" : "") +
        (isHidden ? " is-hidden" : "") +
        (cardDissolving && isExpanded ? " is-dissolving" : "");
      wrap.dataset.cardIndex = String(idx);
      wrap.style.setProperty("--rp-rot", isExpanded ? "0deg" : `${g.rotate}deg`);
      wrap.style.setProperty("--rp-x", isExpanded ? "0px" : `${g.x}px`);
      wrap.style.setProperty("--rp-y", isExpanded ? "-24px" : `${g.y}px`);
      wrap.style.zIndex = String(isExpanded ? 50 : 10 + idx);
      if (isExpanded) {
        wrap.className += " is-sheet-open";
        wrap.innerHTML = `<span class="roleplay-fan-card-anchor" aria-hidden="true"></span>`;
      } else if (cardMode === "open") {
        wrap.innerHTML = buildCardFaceHtml(card, false, idx);
      } else {
        wrap.innerHTML = buildMistCardHtml(idx, true);
      }
      wrap.addEventListener("click", (e) => {
        e.stopPropagation();
        if (expandedCardIndex !== null && expandedCardIndex !== idx) return;
        if (expandedCardIndex === null) {
          expandedCardIndex = idx;
          renderCards();
          renderFateOverlay(idx);
          return;
        }
      });
      fan.appendChild(wrap);
    });
    if (expandedCardIndex === null) {
      const overlay = document.getElementById("roleplay-fate-overlay");
      if (overlay) overlay.hidden = true;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function preparePlayFromCard(card) {
    activeCard = card;
    const sel = selectedCharIds.map((id) => getCharById(id)).filter(Boolean);
    relationships = sel.map((p) => {
      const cr = activeCard.charRoles.find((c) => c.charId === p.id);
      return {
        charId: p.id,
        charName: cr?.charName || String(p.displayName || p.name).trim(),
        charAvatar: p.avatar || "",
        value: 50,
        label: "好感"
      };
    });
    missionProgress = {
      user: 50,
      chars: activeCard.charRoles.filter((cr) => cr.mission).map((cr) => ({ charName: cr.charName, progress: 50 }))
    };
    if (playMode === "rpg") playerStats = buildDefaultStats(activeCard);
    else playerStats = {};
    expPoints = 0;
    turnCount = 0;
    storySummary = "";
    storyMessages = [
      {
        id: "opening",
        sender: "narrator",
        senderName: "旁白",
        text:
          `【${activeCard.worldName}】${activeCard.worldDesc}\n\n你是「${activeCard.userRole}」—— ${activeCard.userRoleDesc}。` +
          (activeCard.userMission ? `\n\n🎯 秘密任务：${activeCard.userMission}` : "") +
          `\n\n${activeCard.hookLine}`,
        type: "narration"
      }
    ];
    currentEvent = null;
    currentChoices = [];
    document.getElementById("roleplay-play-world-title").textContent = activeCard.worldName || "Story";
    syncPlayHero();
    const chars = activeCard.charRoles.map((cr) => ({
      charName: cr.charName,
      role: cr.role,
      roleDesc: cr.roleDesc
    }));
    portalOpeningPromise = generateOpeningChoices(activeCard, chars);
  }

  function renderPortal() {
    const root = document.getElementById("roleplay-portal-root");
    if (!root || !activeCard) return;
    const t = THEME_COLORS[activeCard.theme] || THEME_COLORS.crimson;
    const tag = THEME_TAG[activeCard.theme] || "途";
    const icon = THEME_ICONS[activeCard.theme] || "ph-compass";
    root.innerHTML =
      `<div class="roleplay-portal-glow" style="--fc-r:${t.rgb};--fc-a:${t.accent}"></div>` +
      `<div class="roleplay-portal-card roleplay-fcard roleplay-fcard--face" style="--fc-r:${t.rgb};--fc-a:${t.accent}">` +
      `<span class="roleplay-fcard-accent" aria-hidden="true"></span>` +
      `<span class="roleplay-fcard-watermark" aria-hidden="true"><i class="ph ${icon}"></i></span>` +
      `<div class="roleplay-fcard-top"><span class="roleplay-fcard-no">·</span><span class="roleplay-fcard-tag">${tag}</span></div>` +
      `<div class="roleplay-fcard-body roleplay-fcard-body--sm">` +
      `<h3 class="roleplay-fcard-title">${escapeHtml(activeCard.worldName || "")}</h3>` +
      `<span class="roleplay-fcard-rule"></span>` +
      `<p class="roleplay-fcard-role">${escapeHtml(activeCard.userRole || "")}</p>` +
      `</div></div>` +
      `<p class="roleplay-portal-k">命途开启</p>` +
      `<p class="roleplay-portal-sub">${escapeHtml(activeCard.hookLine || "").slice(0, 36)}</p>` +
      `<div class="roleplay-portal-bar" aria-hidden="true"><span class="roleplay-portal-bar-fill"></span></div>`;
  }

  async function finishPortalEntry() {
    if (portalFinishing) return;
    if (!activeCard || phase !== "portal") return;
    portalFinishing = true;
    if (portalTimer) {
      clearTimeout(portalTimer);
      portalTimer = null;
    }
    try {
      currentChoices = await portalOpeningPromise;
    } catch {
      currentChoices = templateOpeningChoices(activeCard);
    }
    portalOpeningPromise = null;
    renderPlayPanels();
    renderStory();
    renderChoices();
    showView("play");
  }

  function enterPlayViaPortal(card) {
    closeFateOverlay();
    preparePlayFromCard(card);
    portalFinishing = false;
    renderPortal();
    showView("portal");
    if (portalTimer) clearTimeout(portalTimer);
    portalTimer = null;
    const minWait = new Promise((r) => {
      portalTimer = window.setTimeout(() => {
        portalTimer = null;
        r();
      }, PORTAL_MIN_MS);
    });
    const genWait = portalOpeningPromise ? portalOpeningPromise.catch(() => null) : Promise.resolve();
    void Promise.all([minWait, genWait]).then(() => {
      void finishPortalEntry();
    });
  }

  function renderPlayPanels() {
    const wrap = document.getElementById("roleplay-play-panels");
    if (!wrap || !activeCard) return;
    const parts = [];
    if (playMode === "rpg") {
      const sk = getActiveKeys(activeCard);
      const sn = getStatNames(activeCard);
      parts.push(
        `<button type="button" class="roleplay-panel-toggle" data-panel="stats">属性 · 阅历 ${expPoints} ▾</button>` +
          `<div class="roleplay-panel-body" id="roleplay-panel-stats" hidden>` +
          sk
            .map((k) => {
              const v = playerStats[k] ?? 50;
              return `<div class="roleplay-meter"><div class="roleplay-meter-head"><span>${escapeHtml(sn[k] || k)}</span><span>${v}</span></div><div class="roleplay-meter-bar"><div class="roleplay-meter-fill" style="width:${v}%"></div></div></div>`;
            })
            .join("") +
          `<button type="button" class="roleplay-train-open" id="roleplay-train-open-btn">修炼 · 消耗阅历提升属性</button>` +
          `</div>`
      );
    }
    if (activeCard.userMission || activeCard.charRoles.some((cr) => cr.mission)) {
      parts.push(
        `<button type="button" class="roleplay-panel-toggle" data-panel="mission">任务 ${missionProgress.user}% ▾</button>` +
          `<div class="roleplay-panel-body" id="roleplay-panel-mission" hidden>` +
          `<div class="roleplay-meter"><div class="roleplay-meter-head"><span>你 · ${escapeHtml(activeCard.userRole || "你")}</span><span>${missionProgress.user}%</span></div><div class="roleplay-meter-bar"><div class="roleplay-meter-fill" style="width:${missionProgress.user}%"></div></div></div>` +
          missionProgress.chars
            .map(
              (cp) =>
                `<div class="roleplay-meter"><div class="roleplay-meter-head"><span>${escapeHtml(cp.charName)}</span><span>${cp.progress}%</span></div><div class="roleplay-meter-bar"><div class="roleplay-meter-fill" style="width:${cp.progress}%"></div></div></div>`
            )
            .join("") +
          `</div>`
      );
    }
    parts.push(
      `<button type="button" class="roleplay-panel-toggle" data-panel="rel">关系 ▾</button>` +
        `<div class="roleplay-panel-body" id="roleplay-panel-rel" hidden>` +
        relationships
          .map(
            (r) =>
              `<div class="roleplay-meter"><div class="roleplay-meter-head"><span>${escapeHtml(r.charName)}</span><span>${r.value}%</span></div><div class="roleplay-meter-bar"><div class="roleplay-meter-fill" style="width:${r.value}%"></div></div></div>`
          )
          .join("") +
        `</div>`
    );
    wrap.innerHTML = parts.join("");
  }

  function syncPlayHero() {
    const k = document.getElementById("roleplay-play-hero-k");
    const title = document.getElementById("roleplay-play-hero-title");
    const role = document.getElementById("roleplay-play-hero-role");
    const headTitle = document.getElementById("roleplay-play-world-title");
    if (k) k.textContent = `STORY · 第 ${turnCount} 回合${storySummary ? " · 已摘要" : ""}`;
    if (title) title.textContent = activeCard?.worldName || "Story";
    if (role) role.textContent = activeCard?.userRole || "";
    if (headTitle) headTitle.textContent = activeCard?.worldName || "Story";
    const badge = document.getElementById("roleplay-play-mode-badge");
    if (badge) {
      badge.textContent = playMode === "story" ? "剧情" : "养成";
      badge.dataset.mode = playMode;
      badge.hidden = false;
    }
    const turnEl = document.getElementById("roleplay-turn-label");
    if (turnEl) turnEl.textContent = `第 ${turnCount} 回合${storySummary ? " · 已摘要" : ""}`;
  }

  function renderStory() {
    const root = document.getElementById("roleplay-story");
    if (!root) return;
    root.innerHTML = storyMessages
      .map((msg) => {
        if (msg.type === "narration") {
          return `<div class="roleplay-msg roleplay-msg--narr"><span class="roleplay-msg-tag">旁白</span><div class="roleplay-bubble">${escapeHtml(msg.text)}</div></div>`;
        }
        if (msg.type === "event") {
          return `<div class="roleplay-msg roleplay-msg--event"><span class="roleplay-msg-tag">异变</span><div class="roleplay-bubble roleplay-bubble--event">${escapeHtml(msg.text)}</div></div>`;
        }
        if (msg.sender === "user" || msg.type === "choice") {
          return `<div class="roleplay-msg roleplay-msg--user"><div class="roleplay-bubble">${escapeHtml(msg.text)}</div></div>`;
        }
        if (msg.type === "dialogue" && isNpcMessage(msg)) {
          return (
            `<div class="roleplay-msg roleplay-msg--npc"><div class="roleplay-msg-name">${escapeHtml(msg.senderName || "路人")}</div>` +
            `<div class="roleplay-bubble roleplay-bubble--npc">${escapeHtml(msg.text)}</div></div>`
          );
        }
        if (msg.type === "dialogue" || (msg.sender !== "narrator" && msg.sender !== "user")) {
          const av = msg.senderAvatar
            ? `<img src="${String(msg.senderAvatar).replace(/"/g, "&quot;")}" alt="">`
            : `<span class="roleplay-msg-av-fallback" aria-hidden="true"><i class="ph ph-user"></i></span>`;
          return (
            `<div class="roleplay-msg roleplay-msg--dlg">${av}<div><div class="roleplay-msg-name">${escapeHtml(msg.senderName || "")}</div>` +
            `<div class="roleplay-bubble roleplay-bubble--dlg">${escapeHtml(msg.text)}</div></div></div>`
          );
        }
        return `<div class="roleplay-msg"><div class="roleplay-bubble">${escapeHtml(msg.text || "")}</div></div>`;
      })
      .join("");
    if (isAiThinking) {
      root.innerHTML += `<div class="roleplay-thinking">命运之轮转动中…</div>`;
    }
    root.scrollTop = root.scrollHeight;
    syncPlayHero();
  }

  function renderChoices() {
    const root = document.getElementById("roleplay-choices");
    const eventEl = document.getElementById("roleplay-event");
    if (!root) return;
    if (currentEvent && eventEl) {
      eventEl.hidden = false;
      const ic = resolveEventIcon(currentEvent.icon);
      eventEl.innerHTML = `<i class="ph ${ic}" aria-hidden="true"></i><span>${escapeHtml(currentEvent.text)}</span>`;
    } else if (eventEl) {
      eventEl.hidden = true;
      eventEl.innerHTML = "";
    }
    root.innerHTML = "";
    if (isAiThinking || !currentChoices.length) return;
    currentChoices.forEach((ch) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "roleplay-choice-btn";
      const ic = ch.icon ? resolveEventIcon(ch.icon) : "";
      btn.innerHTML =
        (ic ? `<i class="ph ${ic} roleplay-choice-ico" aria-hidden="true"></i>` : "") +
        `<span>${escapeHtml(ch.text)}</span>`;
      btn.addEventListener("click", () => handleChoice(ch.text));
      root.appendChild(btn);
    });
  }

  async function handleChoice(choiceText) {
    if (isAiThinking || !choiceText.trim()) return;
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: "user",
      senderName: activeCard?.userRole || "你",
      text: choiceText.trim(),
      type: "choice"
    };
    storyMessages.push(userMsg);
    currentChoices = [];
    currentEvent = null;
    document.getElementById("roleplay-custom-act").hidden = true;
    isAiThinking = true;
    turnCount += 1;
    renderStory();
    renderChoices();

    let result;
    try {
      if (getAi()?.chatCompletions && hasAiKey()) {
        if (storyMessages.length > SUMMARY_THRESHOLD) {
          const sumResult = await summarizeHistory(storyMessages, storySummary, activeCard?.userRole || "你");
          storySummary = sumResult.summary;
          storyMessages = sumResult.trimmedHistory;
        }
        result = await continueStory(choiceText);
      } else {
        await new Promise((r) => setTimeout(r, 900));
        result = demoContinueStory();
      }
    } catch (e) {
      turnCount -= 1;
      toast(
        e?.truncated
          ? "输出被截断，请换更长输出模型"
          : e?.message?.includes("JSON") || e?.message?.includes("json")
            ? "模型未按格式返回，请重试或换模型"
            : "剧情推进失败"
      );
      currentChoices = templateOpeningChoices(activeCard || { userRole: "你" });
      isAiThinking = false;
      renderStory();
      renderChoices();
      return;
    }

    if (result.narration) {
      storyMessages.push({
        id: `n-${Date.now()}`,
        sender: "narrator",
        senderName: "旁白",
        text: result.narration,
        type: "narration"
      });
    }
    if (result.charDialogues?.length) pushCharDialogues(result.charDialogues);
    if (result.relationChanges?.length) {
      relationships = relationships.map((r) => {
        const ch = result.relationChanges.find((rc) => rc.charName === r.charName);
        return ch ? { ...r, value: Math.max(0, Math.min(100, r.value + (ch.delta || 0))) } : r;
      });
    }
    if (result.missionProgress) {
      missionProgress = {
        user: Math.max(0, Math.min(100, result.missionProgress.user ?? missionProgress.user)),
        chars: result.missionProgress.chars?.length
          ? result.missionProgress.chars.map((c) => ({
              charName: c.charName,
              progress: Math.max(0, Math.min(100, c.progress))
            }))
          : missionProgress.chars
      };
    }
    if (playMode === "rpg" && result.statChanges) {
      const sk = getActiveKeys(activeCard);
      const sn = getStatNames(activeCard);
      const prevStats = { ...playerStats };
      const newStats = { ...playerStats };
      sk.forEach((k) => {
        if (result.statChanges[k]) {
          newStats[k] = Math.max(0, Math.min(100, (newStats[k] ?? 50) + result.statChanges[k]));
        }
      });
      checkThresholdCrossings(prevStats, newStats, sn).forEach((msg) => {
        storyMessages.push({
          id: `threshold-${Date.now()}-${Math.random()}`,
          sender: "narrator",
          senderName: "旁白",
          text: msg,
          type: "event"
        });
      });
      playerStats = newStats;
      if (result.expGained) expPoints += Math.max(0, Math.min(5, result.expGained));
    }
    if (result.event) currentEvent = result.event;
    currentChoices =
      result.choices?.length >= 2
        ? result.choices.slice(0, 4).map((c, i) => ({
            id: String(i + 1),
            text: String(c.text || "继续"),
            icon: c.icon ? String(c.icon) : ""
          }))
        : templateOpeningChoices(activeCard);

    const sk = getActiveKeys(activeCard);
    const sn = getStatNames(activeCard);
    const k0 = sk[0];
    const k1 = sk[1];
    const statEnding =
      playMode === "rpg" &&
      !result.isEnding &&
      ((k0 && (playerStats[k0] ?? 50) <= 0) || (k1 && (playerStats[k1] ?? 50) <= 0));
    if (result.isEnding || statEnding) {
      const statEndingName = statEnding
        ? k0 && (playerStats[k0] ?? 50) <= 0
          ? `${sn[k0] || k0}殆尽`
          : k1 && (playerStats[k1] ?? 50) <= 0
            ? `${sn[k1] || k1}崩塌`
            : null
        : null;
      endingType = statEnding ? statEndingName || "未知结局" : result.endingName || "未知结局";
      endingCategory = resolveEndingCategory(result, statEnding, sk, playerStats);
      if (statEnding && !result.missionComplete) {
        const reason =
          k0 && (playerStats[k0] ?? 50) <= 0
            ? `「${sn[k0] || k0}」耗尽，倒在了命运的旅途中`
            : `「${sn[k1] || k1}」崩溃，迷失在无尽的深渊`;
        missionCompleter = { name: activeCard?.userRole || "你", mission: reason, isUser: true };
      } else if (result.missionComplete) {
        missionCompleter = result.missionComplete;
      } else {
        missionCompleter = {
          name: activeCard?.userRole || "你",
          mission: activeCard?.userMission || "",
          isUser: true
        };
      }
      addEnding({
        endingName: endingType,
        completerName: statEnding
          ? activeCard?.userRole || "你"
          : result.missionComplete?.name || missionCompleter.name || "未知",
        mission: statEnding
          ? k0 && (playerStats[k0] ?? 50) <= 0
            ? `${sn[k0] || k0}耗尽`
            : `${sn[k1] || k1}归零`
          : result.missionComplete?.mission || missionCompleter.mission || "",
        isUser: statEnding ? true : result.missionComplete?.isUser ?? missionCompleter.isUser ?? false,
        worldName: activeCard?.worldName,
        worldIcon: activeCard?.worldIcon,
        theme: activeCard?.theme,
        turnCount,
        timestamp: Date.now(),
        endingCategory
      });
      syncHubBadges();
      isAiThinking = false;
      renderEnding();
      showView("ending");
      return;
    }

    isAiThinking = false;
    renderPlayPanels();
    renderStory();
    renderChoices();
  }

  function canOfferNewMission() {
    if (!activeCard) return false;
    return endingCategory !== "death" && endingCategory !== "madness";
  }

  function demoNewMissions() {
    const world = activeCard?.worldName || "此世";
    return {
      userMission: `在${world}中追查刚刚浮现的新线索，揭开下一层真相`,
      charMissions: (activeCard?.charRoles || [])
        .filter((cr) => cr.charName)
        .map((cr, i) => ({
          charName: cr.charName,
          mission: i % 2 ? "在暗中布局下一步" : "抢先一步达成自己的目的"
        })),
      bridgeNarration: `「${endingType || "命运转折"}」之后，${world}并未归于平静。新的目标在迷雾中浮现——这一次，你要走向何方？`
    };
  }

  async function generateNewMissionsViaAI() {
    const prevMission = missionCompleter?.mission || activeCard?.userMission || "";
    const chars = (activeCard?.charRoles || []).filter((cr) => cr.charName);
    const recent = storyMessages
      .slice(-10)
      .map((m) => {
        if (m.type === "narration") return `[旁白] ${String(m.text).slice(0, 120)}`;
        if (m.type === "event") return `[事件] ${String(m.text).slice(0, 80)}`;
        if (m.sender === "user") return `[你] ${String(m.text).slice(0, 80)}`;
        return `[${m.senderName}] ${String(m.text).slice(0, 80)}`;
      })
      .join("\n");
    const prompt =
      `互动小说续章任务设计。\n【世界】${activeCard.worldName}：${activeCard.worldDesc}${getWorldContextBlock()}\n` +
      `【玩家身份】${activeCard.userRole}：${activeCard.userRoleDesc || ""}\n` +
      `【同行角色】${chars.map((c) => `${c.charName}(${c.role})`).join("、") || "无"}\n` +
      `【刚结束的任务】${prevMission}\n【结局名】${endingType || "未知"}\n` +
      (storySummary ? `【前情】${storySummary}\n` : "") +
      (recent ? `【近期剧情】\n${recent}\n` : "") +
      `请设计下一轮秘密任务：与上一任务相关但目标全新，保持张力。\n` +
      `只返回 JSON 对象：{"userMission":"","charMissions":[{"charName":"","mission":""}],"bridgeNarration":""}\n` +
      `charMissions 需覆盖：${chars.map((c) => c.charName).join("、") || "无同行者则返回空数组"}`;
    const content = await aiChat(prompt, "你是剧情策划。只返回 JSON 对象。", 900, 0.85, { jsonObject: true });
    return parseJsonFromText(content, "object");
  }

  function applyNewMissions(data) {
    if (!activeCard || !data) return;
    const userMission = String(data.userMission || "").trim() || demoNewMissions().userMission;
    const charMissionMap = {};
    (Array.isArray(data.charMissions) ? data.charMissions : []).forEach((row) => {
      if (row?.charName && row?.mission) charMissionMap[String(row.charName).trim()] = String(row.mission).trim();
    });
    activeCard = {
      ...activeCard,
      userMission,
      charRoles: (activeCard.charRoles || []).map((cr) =>
        charMissionMap[cr.charName] ? { ...cr, mission: charMissionMap[cr.charName] } : cr
      )
    };
    missionProgress = {
      user: 50,
      chars: (activeCard.charRoles || [])
        .filter((cr) => cr.mission)
        .map((cr) => ({ charName: cr.charName, progress: 50 }))
    };
    const bridge =
      String(data.bridgeNarration || "").trim() ||
      `新篇章开启。🎯 新任务：${userMission}`;
    storyMessages.push({
      id: `new-mission-${Date.now()}`,
      sender: "narrator",
      senderName: "旁白",
      text: bridge.includes("🎯") ? bridge : `${bridge}\n\n🎯 新任务：${userMission}`,
      type: "narration"
    });
    endingType = "";
    endingCategory = "";
    missionCompleter = null;
    currentEvent = null;
    currentChoices = [];
  }

  async function refreshOpeningChoices() {
    if (!activeCard) return templateOpeningChoices({ userRole: "你" });
    const chars = (activeCard.charRoles || []).map((cr) => ({
      charName: cr.charName,
      role: cr.role,
      roleDesc: cr.roleDesc
    }));
    return generateOpeningChoices(activeCard, chars);
  }

  async function continueWithNewMission() {
    if (!canOfferNewMission() || isGeneratingNewMission) return;
    isGeneratingNewMission = true;
    const btn = document.getElementById("roleplay-ending-new-mission");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "编织新任务中…";
    }
    try {
      let data;
      if (getAi()?.chatCompletions && hasAiKey()) {
        data = await generateNewMissionsViaAI();
      } else {
        await new Promise((r) => setTimeout(r, 700));
        data = demoNewMissions();
      }
      applyNewMissions(data);
      currentChoices = await refreshOpeningChoices();
      renderPlayPanels();
      renderStory();
      renderChoices();
      showView("play");
      toast("已接取新任务");
    } catch (e) {
      toast(e?.message?.includes("JSON") ? "新任务生成失败，请重试" : "接取新任务失败");
      renderEnding();
    } finally {
      isGeneratingNewMission = false;
    }
  }

  function renderEnding() {
    const body = document.getElementById("roleplay-ending-body");
    if (!body) return;
    const catLabel = endingCategory ? getEndingCategoryLabel(endingCategory) : "";
    body.innerHTML =
      (catLabel ? `<span class="roleplay-ending-cat roleplay-ending-cat--${escapeHtml(endingCategory)}">${escapeHtml(catLabel)}</span>` : "") +
      `<h2 class="roleplay-ending-title">「${escapeHtml(endingType)}」</h2>` +
      `<p class="roleplay-ending-sub">${escapeHtml(activeCard?.worldName || "")} · 第 ${turnCount} 回合</p>` +
      (missionCompleter
        ? `<div class="roleplay-ending-card"><strong>${escapeHtml(missionCompleter.name)}</strong><br>${escapeHtml(missionCompleter.mission)}</div>`
        : "") +
      (canOfferNewMission()
        ? `<div class="roleplay-ending-continue">` +
          `<p class="roleplay-ending-continue-k">任务已告一段落，是否续写命运？</p>` +
          `<button type="button" class="roleplay-primary roleplay-primary--sm" id="roleplay-ending-new-mission">接取新任务，继续冒险</button>` +
          `</div>`
        : "") +
      `<div class="roleplay-ending-actions">` +
      `<button type="button" class="roleplay-ghost" id="roleplay-ending-gallery">结局图鉴</button>` +
      `<button type="button" class="roleplay-ghost" id="roleplay-ending-again">再来一局</button>` +
      `<button type="button" class="roleplay-primary roleplay-primary--sm" id="roleplay-ending-home">合上书页</button>` +
      `</div>`;
    document.getElementById("roleplay-ending-new-mission")?.addEventListener("click", () => {
      void continueWithNewMission();
    });
    document.getElementById("roleplay-ending-gallery")?.addEventListener("click", () => openOverlay("endings"));
    document.getElementById("roleplay-ending-again")?.addEventListener("click", () => {
      resetPlayState();
      selectedCharIds = [];
      showView("hub");
      syncHubBadges();
    });
    document.getElementById("roleplay-ending-home")?.addEventListener("click", closeRoleplayScreen);
  }

  function renderLibrary() {
    const list = document.getElementById("roleplay-lib-list");
    const empty = document.getElementById("roleplay-lib-empty");
    if (!list) return;
    const items = readScriptLibrary().items;
    list.innerHTML = "";
    if (!items.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    items.forEach((item) => {
      const card = item.card || {};
      const fakeCard = {
        worldName: card.worldName,
        worldIcon: card.worldIcon,
        userRole: card.userRole,
        theme: card.theme || "crimson",
        statNames: card.statNames
      };
      const el = document.createElement("article");
      el.className = "roleplay-lib-card";
      el.innerHTML =
        `<div class="roleplay-lib-card-visual">${buildCardFaceHtml(fakeCard, false, 0)}</div>` +
        `<div class="roleplay-lib-card-body">` +
        `<div class="roleplay-lib-item-head">` +
        `<h3>${escapeHtml(item.title || card.worldName || "未命名")}</h3>` +
        (item.pinned ? `<span class="roleplay-lib-pin">★</span>` : "") +
        `</div>` +
        `<p class="roleplay-lib-meta">${escapeHtml(card.userRole || "")} · 建议 ${item.suggestedCharCount || 1} 角色 · 玩过 ${item.playCount || 0} 次</p>` +
        `<p class="roleplay-lib-meta">${escapeHtml((card.hookLine || card.worldDesc || "").slice(0, 72))}</p>` +
        `<div class="roleplay-lib-actions">` +
        `<button type="button" class="roleplay-lib-play" data-id="${item.id}">开一局</button>` +
        `<button type="button" data-edit="${item.id}">编辑</button>` +
        `<button type="button" data-pin="${item.id}">${item.pinned ? "取消置顶" : "置顶"}</button>` +
        `<button type="button" data-del="${item.id}">删除</button>` +
        `</div></div>`;
      list.appendChild(el);
    });
  }

  function renderLibEditStats(statNames) {
    const root = document.getElementById("roleplay-lib-edit-stats-list");
    if (!root) return;
    const entries = Object.entries(statNames || {});
    const rows = entries.length ? entries : Object.entries(DEFAULT_STAT_NAMES);
    root.innerHTML = rows
      .map(
        ([key, label]) =>
          `<div class="roleplay-edit-stat-row">` +
          `<input type="text" class="roleplay-input roleplay-edit-stat-key" value="${escapeHtml(key)}" maxlength="16" placeholder="key">` +
          `<input type="text" class="roleplay-input roleplay-edit-stat-label" value="${escapeHtml(label)}" maxlength="8" placeholder="中文名">` +
          `<button type="button" class="roleplay-edit-del" data-del-stat aria-label="删除"><i class="ph ph-x"></i></button></div>`
      )
      .join("");
  }

  function renderLibEditSlots(slots) {
    const root = document.getElementById("roleplay-lib-edit-slots-list");
    if (!root) return;
    const list = slots?.length ? slots : [{ role: "神秘角色", roleDesc: "身份成谜", mission: "" }];
    root.innerHTML = list
      .map(
        (slot, i) =>
          `<article class="roleplay-edit-slot" data-slot-idx="${i}">` +
          `<div class="roleplay-edit-slot-head"><span>槽位 ${String(i + 1).padStart(2, "0")}</span>` +
          `<button type="button" class="roleplay-edit-del" data-del-slot aria-label="删除"><i class="ph ph-x"></i></button></div>` +
          `<label class="roleplay-field roleplay-field--compact"><span class="roleplay-field-k">穿越身份</span>` +
          `<input type="text" class="roleplay-input roleplay-edit-slot-role" value="${escapeHtml(slot.role || "")}" maxlength="24"></label>` +
          `<label class="roleplay-field roleplay-field--compact"><span class="roleplay-field-k">身份说明</span>` +
          `<input type="text" class="roleplay-input roleplay-edit-slot-desc" value="${escapeHtml(slot.roleDesc || "")}" maxlength="80"></label>` +
          `<label class="roleplay-field roleplay-field--compact"><span class="roleplay-field-k">隐藏任务</span>` +
          `<input type="text" class="roleplay-input roleplay-edit-slot-mission" value="${escapeHtml(slot.mission || "")}" maxlength="80"></label></article>`
      )
      .join("");
  }

  function collectLibEditStats() {
    const rows = document.querySelectorAll("#roleplay-lib-edit-stats-list .roleplay-edit-stat-row");
    const statNames = {};
    rows.forEach((row) => {
      const key = row.querySelector(".roleplay-edit-stat-key")?.value?.trim();
      const label = row.querySelector(".roleplay-edit-stat-label")?.value?.trim();
      if (key && label) statNames[key] = label;
    });
    return statNames;
  }

  function collectLibEditSlots() {
    const articles = document.querySelectorAll("#roleplay-lib-edit-slots-list .roleplay-edit-slot");
    return Array.from(articles).map((el) => ({
      role: el.querySelector(".roleplay-edit-slot-role")?.value?.trim() || "神秘角色",
      roleDesc: el.querySelector(".roleplay-edit-slot-desc")?.value?.trim() || "",
      mission: el.querySelector(".roleplay-edit-slot-mission")?.value?.trim() || ""
    }));
  }

  function openLibraryEdit(id) {
    libraryEditId = id || "";
    const item = id ? getScriptById(id) : null;
    const card = item?.card || {};
    document.getElementById("roleplay-lib-edit-title").value = item?.title || "";
    document.getElementById("roleplay-lib-edit-world").value = card.worldName || "";
    document.getElementById("roleplay-lib-edit-desc").value = card.worldDesc || "";
    document.getElementById("roleplay-lib-edit-role").value = card.userRole || "";
    document.getElementById("roleplay-lib-edit-roledesc").value = card.userRoleDesc || "";
    document.getElementById("roleplay-lib-edit-mission").value = card.userMission || "";
    document.getElementById("roleplay-lib-edit-hook").value = card.hookLine || "";
    document.getElementById("roleplay-lib-edit-note").value = item?.note || "";
    document.getElementById("roleplay-lib-edit-theme").value = card.theme || "crimson";
    document.getElementById("roleplay-lib-edit-icon").value = card.worldIcon || "star";
    renderLibEditStats(card.statNames);
    renderLibEditSlots(card.charRoleSlots);
    document.getElementById("roleplay-lib-edit-delete").hidden = !id;
    showView("libraryEdit");
  }

  function saveLibraryEdit() {
    const title = document.getElementById("roleplay-lib-edit-title")?.value?.trim() || "未命名剧本";
    const statNames = collectLibEditStats();
    const charRoleSlots = collectLibEditSlots();
    if (!charRoleSlots.length) {
      toast("至少保留一个角色槽位");
      return;
    }
    const card = {
      worldName: document.getElementById("roleplay-lib-edit-world")?.value?.trim() || title,
      worldIcon: document.getElementById("roleplay-lib-edit-icon")?.value?.trim() || "star",
      worldDesc: document.getElementById("roleplay-lib-edit-desc")?.value?.trim() || "",
      userRole: document.getElementById("roleplay-lib-edit-role")?.value?.trim() || "旅人",
      userRoleDesc: document.getElementById("roleplay-lib-edit-roledesc")?.value?.trim() || "",
      userMission: document.getElementById("roleplay-lib-edit-mission")?.value?.trim() || "",
      hookLine: document.getElementById("roleplay-lib-edit-hook")?.value?.trim() || "",
      theme: document.getElementById("roleplay-lib-edit-theme")?.value?.trim() || "crimson",
      statNames,
      charRoleSlots
    };
    const store = readScriptLibrary();
    if (libraryEditId) {
      const item = store.items.find((x) => x.id === libraryEditId);
      if (item) {
        item.title = title;
        item.note = document.getElementById("roleplay-lib-edit-note")?.value?.trim() || "";
        item.card = { ...item.card, ...card };
        item.updatedAt = Date.now();
      }
    } else {
      store.items.unshift({
        id: uid(),
        title,
        note: document.getElementById("roleplay-lib-edit-note")?.value?.trim() || "",
        source: "manual",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        playCount: 0,
        pinned: false,
        card,
        worldContext: "",
        worldBookVolumeId: "",
        suggestedCharCount: charRoleSlots.length || 1,
        defaultPlayMode: "story",
        defaultCardMode: "open"
      });
    }
    writeScriptLibrary(store);
    syncHubBadges();
    toast("已保存");
    showView("library");
    renderLibrary();
  }

  function startFromScript(scriptId) {
    const item = getScriptById(scriptId);
    if (!item) {
      toast("剧本不存在");
      return;
    }
    pendingScriptId = scriptId;
    playMode = item.defaultPlayMode || "story";
    selectedCharIds = [];
    showView("select");
    renderCharSelect();
    toast(`已载入「${item.title || item.card?.worldName}」· 请选择角色`);
  }

  function confirmScriptStart() {
    if (!pendingScriptId || selectedCharIds.length <= 0) {
      toast("请至少选择一位角色");
      return;
    }
    const item = getScriptById(pendingScriptId);
    if (!item) return;
    const suggested = item.suggestedCharCount || item.card?.charRoleSlots?.length || 1;
    if (suggested > 0 && selectedCharIds.length !== suggested) {
      if (
        !window.confirm(
          `此剧本建议 ${suggested} 位角色，你选了 ${selectedCharIds.length} 位。角色数不同可能影响任务分配，仍要继续？`
        )
      ) {
        return;
      }
    }
    const card = scriptItemToCard(item, selectedCharIds);
    activeWorldContext = resolveScriptWorldContext(item);
    activeWorldBookVolumeId = item.worldBookVolumeId || "";
    bumpScriptPlayCount(pendingScriptId);
    pendingScriptId = "";
    playMode = item.defaultPlayMode || playMode;
    enterPlayViaPortal(card);
  }

  function loadFromSave(save) {
    if (!save?.card) return;
    activeCard = save.card;
    storyMessages = save.messages || [];
    relationships = save.relationships || [];
    currentChoices = save.currentChoices || [];
    turnCount = save.turnCount || 0;
    selectedCharIds = save.selectedChars || [];
    storySummary = save.storySummary || "";
    missionProgress = save.missionProgress || { user: 50, chars: [] };
    playerStats = save.playerStats || {};
    expPoints = save.expPoints || 0;
    playMode = save.playMode || "story";
    activeWorldContext = save.worldContext || "";
    activeWorldBookVolumeId = save.worldBookVolumeId || "";
    document.getElementById("roleplay-play-world-title").textContent = activeCard?.worldName || "Story";
    closeOverlay();
    syncPlayHero();
    renderPlayPanels();
    renderStory();
    renderChoices();
    showView("play");
    toast(`已读取档位 #${(save.slot ?? 0) + 1}`);
  }

  function saveToSlot(slot) {
    if (!activeCard) return;
    const saves = readSaves();
    if (saves[slot]) {
      if (!window.confirm(`覆盖档位 #${slot + 1}？`)) return;
    }
    saves[slot] = buildSavePayload(slot);
    writeSaves(saves);
    syncHubBadges();
    closeOverlay();
    toast(`已存档到档位 #${slot + 1}`);
  }

  function deleteSaveSlot(slot) {
    if (!window.confirm(`删除档位 #${slot + 1}？`)) return;
    const saves = readSaves();
    saves[slot] = null;
    writeSaves(saves);
    syncHubBadges();
    renderSaveLoadPanel(overlayMode === "load" ? "load" : "save");
    toast("已删除存档");
  }

  function renderSaveLoadPanel(mode) {
    const panel = document.getElementById("roleplay-sheet-panel");
    if (!panel) return;
    const saves = readSaves();
    const isSave = mode === "save";
    panel.innerHTML =
      `<header class="roleplay-sheet-head">` +
      `<button type="button" class="roleplay-head-ico" id="roleplay-sheet-close" aria-label="关闭"><i class="ph ph-x"></i></button>` +
      `<div class="roleplay-sheet-head-text"><span class="roleplay-sheet-k">${isSave ? "SAVE" : "LOAD"}</span><h2>${isSave ? "存档" : "读档"}</h2></div>` +
      `<span class="roleplay-head-spacer"></span></header>` +
      `<div class="roleplay-sheet-body">${saves
        .map((save, i) => {
          if (save) {
            const t = THEME_COLORS[save.card?.theme] || THEME_COLORS.crimson;
            const icon = getWorldIconPh(save.card?.worldIcon);
            const lastNarr = [...(save.messages || [])].reverse().find((m) => m.type === "narration");
            const preview = lastNarr ? String(lastNarr.text).slice(0, 72) : "";
            return (
              `<article class="roleplay-save-slot">` +
              `<div class="roleplay-save-slot-top">` +
              `<span class="roleplay-save-slot-icon" style="--fc-r:${t.rgb}"><i class="ph ${icon}"></i></span>` +
              `<div><h3>${escapeHtml(save.card?.worldName || "未知")}</h3>` +
              `<p>${escapeHtml(save.card?.userRole || "")} · 第 ${save.turnCount || 0} 回合</p></div>` +
              `<span class="roleplay-save-slot-no">#${i + 1}</span></div>` +
              `<p class="roleplay-save-slot-meta">${formatSaveTime(save.timestamp)} · ${save.playMode === "rpg" ? "养成" : "剧情"}</p>` +
              (preview ? `<p class="roleplay-save-slot-preview">${escapeHtml(preview)}${preview.length >= 72 ? "…" : ""}</p>` : "") +
              `<div class="roleplay-save-slot-actions">` +
              (isSave
                ? `<button type="button" class="roleplay-ghost roleplay-save-overwrite" data-slot="${i}">覆盖保存</button>`
                : `<button type="button" class="roleplay-primary roleplay-primary--sm roleplay-save-load" data-slot="${i}">继续冒险</button>`) +
              `<button type="button" class="roleplay-save-del" data-del-slot="${i}" aria-label="删除"><i class="ph ph-trash"></i></button>` +
              `</div></article>`
            );
          }
          if (isSave) {
            return (
              `<button type="button" class="roleplay-save-empty" data-slot="${i}">` +
              `<span class="roleplay-save-empty-ico"><i class="ph ph-plus"></i></span>` +
              `<span><strong>空档位 #${i + 1}</strong><small>点击保存当前进度</small></span></button>`
            );
          }
          return `<div class="roleplay-save-empty roleplay-save-empty--ghost"><span class="roleplay-save-empty-ico"><i class="ph ph-archive"></i></span><span>空档位 #${i + 1}</span></div>`;
        })
        .join("")}</div>`;
    document.getElementById("roleplay-sheet-close")?.addEventListener("click", closeOverlay);
    panel.querySelectorAll(".roleplay-save-overwrite, .roleplay-save-empty[data-slot]").forEach((btn) => {
      btn.addEventListener("click", () => saveToSlot(Number(btn.dataset.slot)));
    });
    panel.querySelectorAll(".roleplay-save-load").forEach((btn) => {
      btn.addEventListener("click", () => loadFromSave(saves[Number(btn.dataset.slot)]));
    });
    panel.querySelectorAll(".roleplay-save-del").forEach((btn) => {
      btn.addEventListener("click", () => deleteSaveSlot(Number(btn.dataset.delSlot)));
    });
  }

  function renderTrainingPanel() {
    const panel = document.getElementById("roleplay-sheet-panel");
    if (!panel || !activeCard || playMode !== "rpg") return;
    const sk = getActiveKeys(activeCard);
    const sn = getStatNames(activeCard);
    panel.innerHTML =
      `<header class="roleplay-sheet-head">` +
      `<button type="button" class="roleplay-head-ico" id="roleplay-sheet-close" aria-label="关闭"><i class="ph ph-x"></i></button>` +
      `<div class="roleplay-sheet-head-text"><span class="roleplay-sheet-k">TRAIN</span><h2>修炼</h2></div>` +
      `<span class="roleplay-sheet-exp">阅历 ${expPoints}</span></header>` +
      `<p class="roleplay-sheet-lead">消耗 ${TRAIN_COST} 点阅历，属性 +${TRAIN_GAIN}（上限 100）</p>` +
      `<div class="roleplay-sheet-body">${sk
        .map((k) => {
          const v = playerStats[k] ?? 50;
          const can = expPoints >= TRAIN_COST && v < 100;
          return (
            `<div class="roleplay-train-row">` +
            `<div class="roleplay-train-row-head"><span>${escapeHtml(sn[k] || k)}</span><strong>${v}</strong></div>` +
            `<div class="roleplay-meter-bar"><div class="roleplay-meter-fill" style="width:${v}%"></div></div>` +
            `<button type="button" class="roleplay-primary roleplay-primary--sm roleplay-train-btn" data-stat="${escapeHtml(k)}" ${can ? "" : "disabled"}>+${TRAIN_GAIN}</button></div>`
          );
        })
        .join("")}</div>`;
    document.getElementById("roleplay-sheet-close")?.addEventListener("click", closeOverlay);
    panel.querySelectorAll(".roleplay-train-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.stat;
        if (!key || expPoints < TRAIN_COST) return;
        const v = playerStats[key] ?? 50;
        if (v >= 100) return;
        playerStats[key] = Math.min(100, v + TRAIN_GAIN);
        expPoints -= TRAIN_COST;
        renderPlayPanels();
        renderTrainingPanel();
        toast(`${sn[key] || key} +${TRAIN_GAIN}`);
      });
    });
  }

  function renderEndingGallery() {
    const panel = document.getElementById("roleplay-sheet-panel");
    if (!panel) return;
    const items = readEndings();
    panel.innerHTML =
      `<header class="roleplay-sheet-head">` +
      `<button type="button" class="roleplay-head-ico" id="roleplay-sheet-close" aria-label="关闭"><i class="ph ph-x"></i></button>` +
      `<div class="roleplay-sheet-head-text"><span class="roleplay-sheet-k">ARCHIVE</span><h2>结局图鉴</h2></div>` +
      `<span class="roleplay-sheet-exp">${items.length}</span></header>` +
      `<div class="roleplay-sheet-body">` +
      (items.length
        ? items
            .map((e) => {
              const t = THEME_COLORS[e.theme] || THEME_COLORS.crimson;
              const icon = getWorldIconPh(e.worldIcon);
              const d = e.timestamp ? new Date(e.timestamp).toLocaleDateString() : "";
              const cat = e.endingCategory ? getEndingCategoryLabel(e.endingCategory) : "";
              return (
                `<article class="roleplay-ending-item" style="--fc-r:${t.rgb};--fc-a:${t.accent}">` +
                `<div class="roleplay-ending-item-top">` +
                `<span class="roleplay-ending-item-icon"><i class="ph ${icon}"></i></span>` +
                `<div><div class="roleplay-ending-item-head">` +
                (cat ? `<span class="roleplay-ending-cat roleplay-ending-cat--${escapeHtml(e.endingCategory)}">${escapeHtml(cat)}</span>` : "") +
                `<h3>「${escapeHtml(e.endingName || "未知")}」</h3></div>` +
                `<p>${escapeHtml(e.worldName || "")} · 第 ${e.turnCount || 0} 回合 · ${d}</p></div></div>` +
                `<p class="roleplay-ending-item-mission">${escapeHtml(e.completerName || "")}${e.mission ? " — " + escapeHtml(e.mission) : ""}</p>` +
                `</article>`
              );
            })
            .join("")
        : `<p class="roleplay-empty roleplay-empty--sheet">还没有收集到结局 · 完成一局即可解锁</p>`) +
      `</div>`;
    document.getElementById("roleplay-sheet-close")?.addEventListener("click", closeOverlay);
  }

  function exportScriptLibrary() {
    const store = readScriptLibrary();
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `roleplay-scripts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("已导出剧本库");
  }

  function importScriptLibraryFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ""));
        const incoming = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : null;
        if (!incoming) throw new Error("格式不对");
        const store = readScriptLibrary();
        let added = 0;
        incoming.forEach((item) => {
          if (!item || !item.card) return;
          store.items.push({
            ...item,
            id: uid(),
            createdAt: item.createdAt || Date.now(),
            updatedAt: Date.now(),
            playCount: item.playCount || 0,
            pinned: !!item.pinned
          });
          added += 1;
        });
        store.items.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
        writeScriptLibrary(store);
        syncHubBadges();
        renderLibrary();
        toast(`已导入 ${added} 个剧本`);
      } catch (e) {
        toast(e?.message || "导入失败");
      }
    };
    reader.readAsText(file);
  }

  function buildSavePayload(slot) {
    return {
      slot,
      card: activeCard,
      messages: storyMessages,
      relationships,
      currentChoices,
      turnCount,
      selectedChars: selectedCharIds,
      timestamp: Date.now(),
      storySummary,
      missionProgress,
      playerStats,
      expPoints,
      playMode,
      worldContext: activeWorldContext,
      worldBookVolumeId: activeWorldBookVolumeId
    };
  }

  function bindEvents() {
    document.getElementById("roleplay-close")?.addEventListener("click", closeRoleplayScreen);
    document.getElementById("roleplay-start-btn")?.addEventListener("click", () => {
      pendingScriptId = "";
      selectedCharIds = [];
      showView("select");
      renderCharSelect();
    });
    document.getElementById("roleplay-library-btn")?.addEventListener("click", () => {
      showView("library");
      renderLibrary();
    });
    document.getElementById("roleplay-endings-btn")?.addEventListener("click", () => openOverlay("endings"));
    document.getElementById("roleplay-resume-btn")?.addEventListener("click", () => openOverlay("load"));
    document.getElementById("roleplay-overlay-backdrop")?.addEventListener("click", closeOverlay);
    document.getElementById("roleplay-library-export")?.addEventListener("click", exportScriptLibrary);
    document.getElementById("roleplay-library-import")?.addEventListener("click", () => {
      document.getElementById("roleplay-library-import-file")?.click();
    });
    document.getElementById("roleplay-library-import-file")?.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (f) importScriptLibraryFile(f);
      e.target.value = "";
    });

    document.getElementById("roleplay-select-back")?.addEventListener("click", () => {
      const fromScript = !!pendingScriptId;
      pendingScriptId = "";
      if (fromScript) {
        showView("library");
        renderLibrary();
      } else {
        showView("hub");
      }
    });
    document.getElementById("roleplay-char-grid")?.addEventListener("click", (e) => {
      const tile = e.target.closest(".roleplay-char-tile");
      if (!tile?.dataset.charId) return;
      const id = tile.dataset.charId;
      if (selectedCharIds.includes(id)) selectedCharIds = selectedCharIds.filter((x) => x !== id);
      else selectedCharIds.push(id);
      renderCharSelect();
    });
    document.getElementById("roleplay-select-confirm")?.addEventListener("click", () => {
      if (pendingScriptId) {
        void confirmScriptStart();
        return;
      }
      if (selectedCharIds.length <= 0) {
        toast("请至少选择一位角色");
        return;
      }
      showView("mode");
    });

    document.getElementById("roleplay-mode-back")?.addEventListener("click", () => showView("select"));
    document.getElementById("roleplay-play-mode-row")?.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-play-mode]");
      if (!chip) return;
      playMode = chip.dataset.playMode || "story";
      document.querySelectorAll("#roleplay-play-mode-row .roleplay-mode-chip").forEach((el) => {
        el.classList.toggle("is-on", el.dataset.playMode === playMode);
      });
    });
    document.getElementById("roleplay-card-mode-list")?.addEventListener("click", (e) => {
      const card = e.target.closest("[data-card-mode]");
      if (!card) return;
      const mode = card.dataset.cardMode;
      if (mode === "custom") {
        renderWbChips();
        showView("custom");
        return;
      }
      cardMode = mode;
      activeWorldContext = "";
      activeWorldBookVolumeId = "";
      void handleGenerateCards();
    });

    document.getElementById("roleplay-custom-back")?.addEventListener("click", () => showView("mode"));
    document.getElementById("roleplay-custom-generate")?.addEventListener("click", () => {
      customWorldText = document.getElementById("roleplay-custom-world")?.value || "";
      if (!selectedWbVolumeId && !customWorldText.trim()) {
        toast("请选择世界书或输入世界观");
        return;
      }
      const blindChip = document.querySelector("[data-blind-mode].is-on");
      cardMode = blindChip?.dataset.blindMode || "open";
      void handleGenerateCards(getCustomWorldContext());
    });
    document.querySelector("#roleplay-view-custom")?.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-blind-mode]");
      if (!chip) return;
      document.querySelectorAll("[data-blind-mode]").forEach((el) => el.classList.toggle("is-on", el === chip));
    });

    document.getElementById("roleplay-cards-back")?.addEventListener("click", () => {
      closeFateOverlay();
      showView("mode");
    });
    document.getElementById("roleplay-fate-backdrop")?.addEventListener("click", () => {
      if (cardMode === "open") closeFateOverlay();
    });

    document.getElementById("roleplay-play-back")?.addEventListener("click", () => {
      if (!window.confirm("退出将丢失未保存剧情，确定？")) return;
      resetPlayState();
      syncHubBadges();
      showView("hub");
    });
    document.getElementById("roleplay-play-save")?.addEventListener("click", () => openOverlay("save"));
    document.getElementById("roleplay-play-panels")?.addEventListener("click", (e) => {
      if (e.target.closest("#roleplay-train-open-btn")) {
        openOverlay("train");
        return;
      }
      const btn = e.target.closest(".roleplay-panel-toggle");
      if (!btn) return;
      const id = "roleplay-panel-" + (btn.dataset.panel || "");
      const panel = document.getElementById(id);
      if (panel) panel.hidden = !panel.hidden;
    });
    document.getElementById("roleplay-free-act-btn")?.addEventListener("click", () => {
      document.getElementById("roleplay-custom-act").hidden = false;
      document.getElementById("roleplay-custom-input")?.focus();
    });
    document.getElementById("roleplay-custom-cancel")?.addEventListener("click", () => {
      document.getElementById("roleplay-custom-act").hidden = true;
    });
    document.getElementById("roleplay-custom-send")?.addEventListener("click", () => {
      const v = document.getElementById("roleplay-custom-input")?.value?.trim();
      if (!v) return;
      document.getElementById("roleplay-custom-input").value = "";
      void handleChoice(v);
    });

    document.getElementById("roleplay-library-back")?.addEventListener("click", () => showView("hub"));
    document.getElementById("roleplay-library-add")?.addEventListener("click", () => openLibraryEdit(""));
    document.getElementById("roleplay-lib-list")?.addEventListener("click", (e) => {
      const play = e.target.closest("[data-id]");
      const edit = e.target.closest("[data-edit]");
      const pin = e.target.closest("[data-pin]");
      const del = e.target.closest("[data-del]");
      if (play?.dataset.id) {
        startFromScript(play.dataset.id);
        return;
      }
      if (edit?.dataset.edit) {
        openLibraryEdit(edit.dataset.edit);
        return;
      }
      if (pin?.dataset.pin) {
        const store = readScriptLibrary();
        const item = store.items.find((x) => x.id === pin.dataset.pin);
        if (item) {
          item.pinned = !item.pinned;
          item.updatedAt = Date.now();
          store.items.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
          writeScriptLibrary(store);
          renderLibrary();
        }
        return;
      }
      if (del?.dataset.del) {
        if (!window.confirm("删除此剧本？")) return;
        deleteScript(del.dataset.del);
        renderLibrary();
      }
    });

    document.getElementById("roleplay-lib-edit-back")?.addEventListener("click", () => {
      showView("library");
      renderLibrary();
    });
    document.getElementById("roleplay-lib-edit-save")?.addEventListener("click", saveLibraryEdit);
    document.getElementById("roleplay-lib-edit-stats-add")?.addEventListener("click", () => {
      const statNames = collectLibEditStats();
      statNames[`stat${Object.keys(statNames).length + 1}`] = "属性";
      renderLibEditStats(statNames);
    });
    document.getElementById("roleplay-lib-edit-slots-add")?.addEventListener("click", () => {
      const slots = collectLibEditSlots();
      slots.push({ role: "神秘角色", roleDesc: "", mission: "" });
      renderLibEditSlots(slots);
    });
    document.getElementById("roleplay-lib-edit-slots-list")?.addEventListener("click", (e) => {
      const del = e.target.closest("[data-del-slot]");
      if (!del) return;
      const slots = collectLibEditSlots();
      const article = del.closest(".roleplay-edit-slot");
      const idx = article ? Number(article.dataset.slotIdx) : -1;
      if (idx >= 0) slots.splice(idx, 1);
      if (!slots.length) slots.push({ role: "神秘角色", roleDesc: "", mission: "" });
      renderLibEditSlots(slots);
    });
    document.getElementById("roleplay-lib-edit-stats-list")?.addEventListener("click", (e) => {
      const del = e.target.closest("[data-del-stat]");
      if (!del) return;
      const row = del.closest(".roleplay-edit-stat-row");
      row?.remove();
      const root = document.getElementById("roleplay-lib-edit-stats-list");
      if (root && !root.querySelector(".roleplay-edit-stat-row")) {
        renderLibEditStats(DEFAULT_STAT_NAMES);
      }
    });
    document.getElementById("roleplay-lib-edit-delete")?.addEventListener("click", () => {
      if (!libraryEditId) return;
      if (!window.confirm("删除此剧本？")) return;
      deleteScript(libraryEditId);
      showView("library");
      renderLibrary();
    });
  }

  window.openRoleplayScreen = openRoleplayScreen;
  window.openRoleplayScriptLibrary = () => openRoleplayScreen("library");
  window.closeRoleplayScreen = closeRoleplayScreen;

  bindEvents();
})();
