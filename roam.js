"use strict";

/**
 * 漫游 · 虚拟位置 + 本地地图 + AI 附近路人
 */
(function () {
  const K_STORE = "ROAM_STATE_V1";
  const MAP_TAP_MAX_M = 680;
  const RUMOR_HEAT_START = 100;
  const RUMOR_FADE_STROLLS = 4;
  const RUMOR_EXPIRE_STROLLS = 7;
  /** 每次「随便走走」触发的片段数（含主事件 + 沿途余味） */
  const STROLL_BEATS_MIN = 2;
  const STROLL_BEATS_MAX = 4;
  /** 突发事件选项数（本地 / AI） */
  const STROLL_CHOICE_MIN = 4;
  const STROLL_CHOICE_MAX = 6;
  const NEARBY_MOVE_TICK_MS = 4200;
  const NEARBY_LEAVE_MAX_M = 1350;
  const NEARBY_CHASE_CLOSE_M = 90;
  const NEARBY_AUTO_GREET_M = 110;
  const NEARBY_EXPIRE_MS = 15 * 60 * 1000;
  const FRIEND_REJECT_COOLDOWN_MS = 90 * 1000;
  const FRIEND_REJECT_RETRY_MSGS = 2;
  /** 出马 UI 暂关；改 true 可恢复 */
  const ROAM_CHAR_FIGHT_ENABLED = false;

  const MISS_WHISPERS = [
    "……等等。",
    "（听不清的一句）",
    "下次再说。",
    "算了。",
    "你本来可以追上的。",
    "风把话吹散了。",
    "（笑声渐远）",
    "别回头。"
  ];
  const ROAM_WB_MAX = 8;
  const SPAWN_NPC_AI_CHANCE = 0.55;
  /** 漫游聊天空输入代发（与密谈一致，仅进 API 不进气泡） */
  const ROAM_EMPTY_AFTER_ASSISTANT =
    "（界面代发、勿复述本句：对方没打新字，请你接着上文像真人一样自然接话。）";
  const ROAM_EMPTY_OPENING =
    "（界面代发、勿复述本句：对方还没发第一句，请你抛一句自然开场或接应。）";
  const METERS_PER_PX = 2.2;
  const BLOCK_M = 84;
  const MAJOR_EVERY = 5;
  const MINOR_EVERY = 2;

  const SPAWN_SPOTS = [
    { lat: 31.2401, lng: 121.4902, place: "中山东一路" },
    { lat: 39.9289, lng: 116.3883, place: "鼓楼东大街" },
    { lat: 30.657, lng: 104.065, place: "春熙路" },
    { lat: 23.125, lng: 113.326, place: "天河路" },
    { lat: 22.533, lng: 113.934, place: "海德三道" },
    { lat: 30.274, lng: 120.155, place: "延安路" }
  ];

  const STREET_A = ["梧桐", "槐安", "锦江", "星海", "安宁", "光复", "长信", "春熙", "海德", "福里", "望江", "静园"];
  const STREET_B = ["路", "街", "巷", "里", "道"];

  const STROLL_EVENTS = [
    { tag: "日常", text: "拐进一条没走过的小巷，风里有刚出炉的面包味。" },
    { tag: "日常", text: "路口红灯久了一点，你顺手帮路人指了路。" },
    { tag: "日常", text: "书店的清仓区堆满了旧杂志，封面年份对不上。" },
    { tag: "日常", text: "快递柜在响，但取件码不属于任何你的订单。" },
    { tag: "日常", text: "街角有人在调吉他，走调走得很真诚。" },
    { tag: "偶遇", text: "有人和你撞了肩，道歉时口音不像本地人。" },
    { tag: "偶遇", text: "长椅另一端坐着一个读信的人，信纸边沿发黄。" },
    { tag: "偶遇", text: "有人尾随你半条街，在你回头前拐进了便利店。" },
    { tag: "意外", text: "自动贩卖机吐出一罐没见过的限定口味。" },
    { tag: "意外", text: "天桥下有人在卖旧地图，标注的地点你从没听过。" },
    { tag: "意外", text: "广告牌在换画面，新一版的模特像在哪里见过。" },
    { tag: "穿缝", text: "一眨眼，街角的招牌字体变成了另一种写法——像从别处借来的。" },
    { tag: "穿缝", text: "广播里播的歌，旋律熟悉，歌词却完全对不上记忆。" },
    { tag: "穿缝", text: "雨停后地面反光里，映出的 skyline 和抬头看见的不太一样。" },
    { tag: "穿缝", text: "同一家店两次经过，门牌号差了一位。" },
    { tag: "同人感", text: "路过的人讨论着某个你只在故事里见过的名字，语气像真认识。" },
    { tag: "同人感", text: "二手店橱窗里摆着一件道具，和某段剧情里的描述过分相似。" },
    { tag: "同人感", text: "咖啡馆黑板上的今日特调，名字像是某个世界的 inside joke。" },
    { tag: "同人感", text: "有人叫错了你的名字，叫的那个名字你却听懂了。" },
    { tag: "深夜", text: "便利店员说「您也常这个点来」，可你确定这是第一次。" },
    { tag: "深夜", text: "末班地铁里只剩你和一个戴帽子的乘客，对方在数站名。" },
    { tag: "深夜", text: "24 小时洗衣店灯还亮着，滚筒里空转。" },
    { tag: "线索", text: "墙上有新贴的小广告，电话号码的区号不属于本市。" },
    { tag: "线索", text: "垃圾桶边有张撕了一半的电影票，日期是下周。" },
    { tag: "传闻", text: "两个学生在争论某个名字是不是真有其人——你只在故事里见过。" },
    { tag: "传闻", text: "报刊亭老板压低声音：「那条线最近又有人走了。」" },
    { tag: "岔路", text: "导航说直行，但箭头涂鸦被人改成了左转。" },
    { tag: "岔路", text: "同一家便利店，两次路过时收银员换了人，工牌名字一样。" }
  ];

  const STROLL_CHOICE_EVENTS = [
    {
      tag: "选择",
      text: "有人掉落一个信封，封口没粘牢，里面似乎有张硬卡。",
      choices: [
        { label: "追上去还", hint: "开聊", effect: "spawn_greet", msg: "你的东西掉了。" },
        { label: "先收着", hint: "风传", effect: "seed_rumor", rumorSeed: "未署名的信封" },
        { label: "拆开看一眼", hint: "风传", effect: "seed_rumor", rumorSeed: "信封里的硬卡" },
        { label: "交给附近的人", hint: "遇人", effect: "spawn_nearby" },
        { label: "当没看见", hint: "观望", effect: "log" }
      ]
    },
    {
      tag: "选择",
      text: "巷口有猫蹲着，朝你身后的方向炸毛。",
      choices: [
        { label: "回头看", hint: "可能有人", effect: "spawn_nearby" },
        { label: "摸猫", hint: "风传", effect: "seed_rumor", rumorSeed: "炸毛的猫" },
        { label: "学猫叫", hint: "怪", effect: "spawn_greet", msg: "……你也看见了？" },
        { label: "拍张照", hint: "风传", effect: "seed_rumor", rumorSeed: "炸毛瞬间" },
        { label: "绕路", hint: "离开", effect: "advance_quiet" }
      ]
    },
    {
      tag: "选择",
      text: "广播突然插播一条寻物启事，描述的物品你刚见过。",
      choices: [
        { label: "去看看", hint: "刷路人", effect: "spawn_nearby" },
        { label: "记下启事", hint: "风传", effect: "boost_rumor" },
        { label: "发一条动态", hint: "开聊", effect: "spawn_greet", msg: "我好像见过…" },
        { label: "对照口袋物", hint: "核实", effect: "peek_rumor" },
        { label: "当没听见", hint: "观望", effect: "log" }
      ]
    },
    {
      tag: "选择",
      text: "自动门反复开合，像在给谁留路。",
      choices: [
        { label: "进去", hint: "小线+1", effect: "advance" },
        { label: "挡门看一眼", hint: "识主", effect: "spawn_knows_char" },
        { label: "问店员", hint: "开聊", effect: "spawn_greet", msg: "这门怎么老自己开？" },
        { label: "录一段", hint: "风传", effect: "seed_rumor", rumorSeed: "门反复开合" },
        { label: "走开", hint: "安全", effect: "advance_quiet" }
      ]
    },
    {
      tag: "选择",
      text: "墙上海报被人撕了一角，露出底下另一张脸。",
      choices: [
        { label: "撕下来", hint: "风传", effect: "seed_rumor", rumorSeed: "撕角海报" },
        { label: "对照传闻", hint: "核实", effect: "peek_rumor" },
        { label: "问贴的人", hint: "遇人", effect: "spawn_nearby" },
        { label: "拍下来发群", hint: "风传", effect: "boost_rumor" },
        { label: "不管", hint: "观望", effect: "log" }
      ]
    },
    {
      tag: "选择",
      text: "路口红灯久不转绿，对面有人朝你招了招手又缩回去。",
      choices: [
        { label: "穿过去", hint: "遇人", effect: "spawn_nearby" },
        { label: "等下一盏灯", hint: "风传", effect: "boost_rumor" },
        { label: "也招招手", hint: "开聊", effect: "spawn_greet", msg: "你在叫我？" },
        { label: "躲进便利店", hint: "回避", effect: "advance_quiet" },
        { label: "原路折返", hint: "离开", effect: "advance_quiet" }
      ]
    },
    {
      tag: "选择",
      text: "自动贩卖机吐出一罐没标签的饮料，还在冒冷气。",
      choices: [
        { label: "收进兜里", hint: "风传", effect: "seed_rumor", rumorSeed: "无标饮料" },
        { label: "问路过的人", hint: "开聊", effect: "spawn_greet", msg: "这罐东西是你落下的吗？" },
        { label: "摇一摇听声", hint: "线索", effect: "advance" },
        { label: "塞回机器", hint: "观望", effect: "log" },
        { label: "放回去", hint: "离开", effect: "advance_quiet" }
      ]
    }
  ];

  const CHOICE_EFFECT_HINTS = {
    advance: "继续",
    advance_quiet: "离开",
    log: "观望",
    spawn_nearby: "遇人",
    spawn_knows_char: "识主",
    spawn_greet: "开聊",
    seed_rumor: "风传",
    boost_rumor: "风传",
    peek_rumor: "核实"
  };

  const CHOICE_OUTCOME_LINES = {
    advance: ["你往前迈了一步，后面的选项还在等你。", "事情按你的意思往下走了。"],
    advance_quiet: ["你选择绕开。街角恢复寻常。", "没介入，但你不确定这是赢。"],
    log: ["什么也没立刻发生——也可能是延迟。", "你先记下了，继续走。"],
    spawn_nearby: ["附近多了个身影，距离在缩短。", "有人出现在这一带，像被你的选择召来的。"],
    spawn_knows_char: ["有人朝这边看过来，眼神像在认脸。", "一个和主角色圈子有关的人晃进了附近。"],
    spawn_greet: ["你发出了第一句话，对方很快会回应。", "消息已发出，等人接话。"],
    seed_rumor: ["闲话像从这一带走开，传到了别处。", "你做的事，后来成了别人嘴里的版本。"],
    boost_rumor: ["风言风语又传开了一格。", "传闻像被你的选择推了一把。"],
    peek_rumor: ["你对照了刚听见的传闻，心里有了数。", "核实之后，传闻要么更真，要么更假。"]
  };

  const STROLL_CHOICE_EFFECTS = new Set([
    "advance",
    "advance_quiet",
    "log",
    "spawn_nearby",
    "spawn_knows_char",
    "spawn_greet",
    "seed_rumor",
    "keep_item",
    "boost_rumor",
    "peek_rumor"
  ]);

  const STROLL_TAGS = [
    "日常",
    "偶遇",
    "意外",
    "穿缝",
    "同人感",
    "深夜",
    "线索",
    "传闻",
    "岔路",
    "选择",
    "物证"
  ];

  const RUMOR_TEMPLATES = [
    { text: "后巷旧书店的灯半夜还亮着，据说老板早就不在了。", source: "街角" },
    { text: "有人看见穿灰外套的人总在同一棵树下等，像在等错的人。", source: "帖子" },
    { text: "这条街的门牌号最近老对不上，像是地图少画了一格。", source: "路人" },
    { text: "传闻里那个名字，在主角色圈子里也听过一嘴。", source: "风传" }
  ];

  const NEARBY_TEMPLATES = [
    { name: "周安", hint: "背包贴满各地贴纸" },
    { name: "Marco", hint: "游客 · 意语口音" },
    { name: "橘座", hint: "流浪猫 · 不怕人" },
    { name: "孟青", hint: "收摊前最后一眼" },
    { name: "Yuki", hint: "在找便利店" },
    { name: "方雨", hint: "伞下在看信" },
    { name: "老槐", hint: "树下的常客" },
    { name: "何宁", hint: "对着地图转了一圈" }
  ];

  const ROAM_NAME_POOL_CN = [
    "林悦", "周安", "孟青", "方雨", "何宁", "苏晚", "顾北辰", "沈星河", "陈言", "赵晓",
    "叶知秋", "江予", "陆迟", "程野", "宋清和", "许半夏", "唐念", "韩朔", "傅临", "温乔",
    "秦屿", "裴照", "谢临川", "梁予安", "白川", "杜若", "姜迟", "季扬", "莫宁", "邵青",
    "老周", "阿苓", "小北", "张叔", "李姨", "王哥", "刘婶"
  ];
  const ROAM_NAME_POOL_FOREIGN = ["Marco", "Yuki", "Emma", "Luca", "Sora", "Hana", "James", "Nina", "Leo", "Mia"];
  const ROAM_NAME_POOL_PET = ["橘座", "小白", "阿黄", "团子", "黑豆", "灰灰", "元宝"];

  const NEARBY_NAME_GUIDE =
    "   - **name 必须是称呼/名字**（2～4 字中文人名、外国名、或宠物名），像通讯录里会存的，**不是**身份说明。\n" +
    "   - **好例子**：林悦、顾北辰、Marco、Yuki、老槐、橘座、沈星河、阿苓。\n" +
    "   - **坏例子（禁止当 name）**：孤独患者、深夜旅人、咖啡店老板、神秘来客、一位游客、User_123、@小明。\n" +
    "   - 职业/物种/状态写进 **signature**（如「游客 · 找路」「流浪猫 · 不怕生」），不要写进 name。\n" +
    "   - 约 **70%** 为 2～3 字中文真人名；其余可为外国名或动物名。\n" +
    "   - 禁止：@ID、下划线网名、emoji 前缀、乱码 ID、「XX的XX」式网感昵称。";

  const screen = document.getElementById("roam-screen");
  const locationLine = document.getElementById("roam-location-line");
  const strollBtn = document.getElementById("roam-stroll-btn");
  const strollFeed = document.getElementById("roam-stroll-feed");
  const strollEmpty = document.getElementById("roam-stroll-empty");
  const strollCount = document.getElementById("roam-stroll-count");
  const nearbyList = document.getElementById("roam-nearby-list");
  const nearbyEmpty = document.getElementById("roam-nearby-empty");
  const msgList = document.getElementById("roam-msg-list");
  const msgEmpty = document.getElementById("roam-msg-empty");
  const refreshNearbyBtn = document.getElementById("roam-refresh-nearby");
  const mapStage = document.getElementById("roam-map-stage");
  const mapBase = document.getElementById("roam-map-base");
  const mapOverlay = document.getElementById("roam-map-overlay");
  const mapMarkers = document.getElementById("roam-map-markers");
  const mapRecenterBtn = document.getElementById("roam-map-recenter");
  const mapUserPin = mapStage?.querySelector(".roam-map-user");
  const roamLoading = document.getElementById("roam-loading");
  const roamLoadingText = document.getElementById("roam-loading-text");
  const roamChat = document.getElementById("roam-chat");
  const roamChatTitle = document.getElementById("roam-chat-title");
  const roamChatSub = document.getElementById("roam-chat-sub");
  const roamChatMsgs = document.getElementById("roam-chat-msgs");
  const roamChatInput = document.getElementById("roam-chat-input");
  const roamChatSend = document.getElementById("roam-chat-send");
  const roamChatClose = document.getElementById("roam-chat-close");
  const roamSendChoice = document.getElementById("roam-send-choice");
  const roamSendChoiceContinue = document.getElementById("roam-send-choice-continue");
  const roamSendChoiceReroll = document.getElementById("roam-send-choice-reroll");
  const roamSendChoiceCancel = document.getElementById("roam-send-choice-cancel");
  const roamSendChoiceBackdrop = document.getElementById("roam-send-choice-backdrop");
  const roamCharFightBtn = document.getElementById("roam-char-fight-btn");
  const roamCharFightStop = document.getElementById("roam-char-fight-stop");
  const roamCharFightBar = document.getElementById("roam-char-fight-bar");
  const roamCharFightLabel = document.getElementById("roam-char-fight-label");
  const roamCharPicker = document.getElementById("roam-char-picker");
  const roamCharPickerList = document.getElementById("roam-char-picker-list");
  const roamCharPickerCancel = document.getElementById("roam-char-picker-cancel");
  const roamWorldBtn = document.getElementById("roam-world-btn");
  const roamWorldDot = document.getElementById("roam-world-dot");
  const roamWorldSheet = document.getElementById("roam-world-sheet");
  const roamWorldBackdrop = document.getElementById("roam-world-backdrop");
  const roamWorldClose = document.getElementById("roam-world-close");
  const roamWorldSave = document.getElementById("roam-world-save");
  const roamWorldSummary = document.getElementById("roam-world-summary");
  const roamWorldviewText = document.getElementById("roam-worldview-text");
  const roamWbSearch = document.getElementById("roam-wb-search");
  const roamWbChips = document.getElementById("roam-wb-chips");
  const roamWbEmpty = document.getElementById("roam-wb-empty");
  const roamWbCount = document.getElementById("roam-wb-count");
  const rumorsList = document.getElementById("roam-rumors-list");
  const rumorsEmpty = document.getElementById("roam-rumors-empty");
  const rumorGatherBtn = document.getElementById("roam-rumor-gather");
  const secretsBadge = document.getElementById("roam-secrets-badge");
  const roamChatFriendBtn = document.getElementById("roam-chat-friend-btn");
  const roamChatFriendInbound = document.getElementById("roam-chat-friend-inbound");
  const roamChatFriendInboundText = document.getElementById("roam-chat-friend-inbound-text");
  const roamChatFriendAccept = document.getElementById("roam-chat-friend-accept");
  const roamChatFriendDecline = document.getElementById("roam-chat-friend-decline");

  let state = null;
  let activeTab = "stroll";
  let strollBusy = false;
  let nearbyGenerating = false;
  let chatBusy = false;
  let friendRequestInflight = false;
  const openingInflight = new Set();
  const ROAM_MSG_SWIPE_DEL_W = 76;
  let roamMsgSwipeOpenId = null;
  /** @type {{ row: HTMLElement, main: HTMLElement, id: string, startX: number, startTx: number, moved: boolean, pointerId: number } | null} */
  let roamMsgSwipeDrag = null;
  let roamMsgSwipeSuppressClick = false;
  /** @type {ReturnType<typeof setInterval> | null} */
  let nearbyMoveTimer = null;
  let activeThreadId = null;
  /** @type {{ threadId: string, nearbyId: string, charId: string, charName: string, active: boolean, busy: boolean } | null} */
  let charFight = null;
  /** @type {ResizeObserver | null} */
  let mapResizeObs = null;
  let mapRenderQueued = false;

  function uid() {
    return "rm_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function hash2(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function isDarkMap() {
    return document.body.classList.contains("dark");
  }

  function pickSpawnSpot() {
    return SPAWN_SPOTS[Math.floor(Math.random() * SPAWN_SPOTS.length)];
  }

  let roamWorldDraftIds = [];
  let roamWorldSheetOpen = false;

  function defaultState() {
    const spot = pickSpawnSpot();
    return {
      v: 7,
      pos: { lat: spot.lat, lng: spot.lng, place: spot.place, at: Date.now() },
      strollLog: [],
      nearby: [],
      threads: [],
      rumors: [],
      mysteries: [],
      strollCounter: 0,
      strollHooks: [],
      worldBookVolumeIds: [],
      worldviewText: ""
    };
  }

  function normalizePos(raw) {
    if (!raw || typeof raw !== "object") return null;
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      place: String(raw.place || "").trim(),
      at: Number(raw.at) || Date.now()
    };
  }

  function normalizeRoamWorldBookIds(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = new Set();
    raw.forEach((id) => {
      const s = String(id || "").trim();
      if (!s || seen.has(s)) return;
      seen.add(s);
      out.push(s);
    });
    return out.slice(0, ROAM_WB_MAX);
  }

  function getRoamBoundWorldBookIds() {
    return normalizeRoamWorldBookIds(state?.worldBookVolumeIds);
  }

  function roamWorldSettingsActive() {
    return getRoamBoundWorldBookIds().length > 0 || Boolean(String(state?.worldviewText || "").trim());
  }

  function syncRoamWorldDot() {
    if (!roamWorldDot) return;
    roamWorldDot.hidden = !roamWorldSettingsActive();
  }

  function readStore() {
    const D = window.XXJ_DB;
    const raw = D?.getKv?.(K_STORE) ?? D?.getKv?.(window.XXJ_DB?.K?.ROAM_STATE);
    if (!raw || typeof raw !== "object") return defaultState();
    const o = /** @type {Record<string, unknown>} */ (raw);
    let pos = normalizePos(o.pos);
    if (!pos && o.lastGeo && typeof o.lastGeo === "object") pos = normalizePos(o.lastGeo);
    if (!pos) {
      const spot = pickSpawnSpot();
      pos = { lat: spot.lat, lng: spot.lng, place: spot.place, at: Date.now() };
    }
    if (!pos.place) pos.place = localPlaceName(pos.lat, pos.lng);
    return {
      v: 7,
      pos,
      strollLog: Array.isArray(o.strollLog) ? o.strollLog : [],
      nearby: Array.isArray(o.nearby) ? o.nearby.map(normalizeNearbyPerson).filter(Boolean) : [],
      threads: Array.isArray(o.threads) ? o.threads : [],
      rumors: Array.isArray(o.rumors) ? o.rumors : [],
      mysteries: Array.isArray(o.mysteries) ? o.mysteries : [],
      strollCounter: Number(o.strollCounter) || 0,
      strollHooks: Array.isArray(o.strollHooks) ? o.strollHooks : [],
      worldBookVolumeIds: normalizeRoamWorldBookIds(o.worldBookVolumeIds),
      worldviewText: String(o.worldviewText || "").slice(0, 8000)
    };
  }

  function normalizeNearbyPerson(p) {
    if (!p || typeof p !== "object") return null;
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const mode = String(p.moveMode || "idle");
    return {
      ...p,
      lat,
      lng,
      moveMode: mode === "approaching" || mode === "leaving" ? mode : "idle",
      moveSpeed: Number(p.moveSpeed) || 12,
      expiresAt: p.expiresAt != null && Number.isFinite(Number(p.expiresAt)) ? Number(p.expiresAt) : null,
      lastWhisper: String(p.lastWhisper || ""),
      autoGreeted: Boolean(p.autoGreeted)
    };
  }

  function personSocialKey(name) {
    return String(name || "路人")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .slice(0, 32);
  }

  function ensurePersonSocial(person) {
    if (!person || typeof person !== "object") return person;
    if (!person.friendStatus) person.friendStatus = person.isFriend ? "friend" : "stranger";
    return person;
  }

  function friendMetaFrom(person, thread) {
    ensurePersonSocial(person);
    const st = String(person?.friendStatus || thread?.friendStatus || "stranger");
    return {
      friendStatus: st,
      lastFriendRejectAt: Number(person?.lastFriendRejectAt || thread?.lastFriendRejectAt) || 0,
      isFriend: st === "friend"
    };
  }

  function applyFriendMeta(person, thread, patch) {
    const o = patch && typeof patch === "object" ? patch : {};
    if (person) {
      ensurePersonSocial(person);
      if (o.friendStatus != null) {
        person.friendStatus = o.friendStatus;
        person.isFriend = o.friendStatus === "friend";
      }
      if (o.lastFriendRejectAt != null) person.lastFriendRejectAt = o.lastFriendRejectAt;
      if (o.clearReject) delete person.lastFriendRejectAt;
    }
    if (thread) {
      if (o.friendStatus != null) thread.friendStatus = o.friendStatus;
      if (o.lastFriendRejectAt != null) thread.lastFriendRejectAt = o.lastFriendRejectAt;
      if (o.clearReject) delete thread.lastFriendRejectAt;
    }
    writeStore();
  }

  function addRumorFromChoice(entry, choice) {
    const seed = String(choice.rumorSeed || choice.item || choice.label || entry?.text || "刚才那件事")
      .trim()
      .slice(0, 60);
    const place = String(entry?.place || getPos()?.place || "").trim();
    const action = String(choice.label || "那件事").trim();
    const lines = [
      `${place ? place + "一带" : "附近"}有人在传：有人${action}了。`,
      `风言风语：关于「${seed}」的说法开始变多。`,
      `闲话从刚才的路口散开，像真有其事。`
    ];
    addRumor({ text: lines[Math.floor(Math.random() * lines.length)], source: "闲逛", place });
  }

  function maybeRumorFromChat(thread, person, reply) {
    if (!thread || !person) return;
    const dialogue = (thread.messages || []).filter(
      (m) => m.role === "user" || m.role === "stranger" || m.role === "char_proxy"
    ).length;
    if (dialogue < 2) return;
    if (Math.random() > 0.14) return;
    const snippet = String(
      reply?.lines?.[0] || thread.preview || person.signature || ""
    )
      .trim()
      .slice(0, 36);
    if (!snippet) return;
    const name = String(person.name || "某人").trim();
    const place = String(getPos()?.place || "").trim();
    const who = person.knowsChar ? `${name}（似乎和主角色圈子有关）` : name;
    const variants = [
      `${place ? place + " " : ""}有人在传：${who} 刚和一个陌生人聊得挺久。`,
      `风里有句零碎话，像是从「${snippet}…」传开的。`,
      `附近多了条闲话，说是 ${who} 在漫游 App 里说了些有意思的话。`
    ];
    addRumor({
      text: variants[Math.floor(Math.random() * variants.length)],
      source: name,
      place
    });
    if (typeof showToast === "function") showToast("风言风语传开了");
  }

  function writeStore() {
    const D = window.XXJ_DB;
    if (!D?.setKv) return;
    D.setKv(D.K?.ROAM_STATE || K_STORE, state);
  }

  function getPos() {
    return normalizePos(state?.pos);
  }

  function toRad(d) {
    return (d * Math.PI) / 180;
  }

  function toDeg(r) {
    return (r * 180) / Math.PI;
  }

  function haversineM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function bearingFromTo(lat1, lng1, lat2, lng2) {
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lng2 - lng1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function pickMissWhisper(person) {
    const sig = String(person?.signature || person?.hint || "").trim();
    if (sig && Math.random() < 0.35) return `「${sig.slice(0, 18)}…」`;
    return MISS_WHISPERS[Math.floor(Math.random() * MISS_WHISPERS.length)];
  }

  function decorateNearbyMovement(row) {
    const roll = Math.random();
    if (roll < 0.34) row.moveMode = "approaching";
    else if (roll < 0.58) row.moveMode = "leaving";
    else row.moveMode = "idle";
    row.moveSpeed = 9 + Math.floor(Math.random() * 12);
    if (Math.random() < 0.3) {
      row.expiresAt = Date.now() + Math.floor(NEARBY_EXPIRE_MS * (0.55 + Math.random() * 0.7));
    }
    if (row.moveMode === "leaving") row.lastWhisper = pickMissWhisper(row);
    row.moveInit = true;
    return row;
  }

  function syncNearbyPersonDistance(person, userPos) {
    if (!person || !userPos) return person;
    const distanceM = haversineM(userPos.lat, userPos.lng, Number(person.lat), Number(person.lng));
    person.distanceM = distanceM;
    person.dist = formatDistanceM(distanceM);
    return person;
  }

  function nearbyMoveStatusLabel(person) {
    if (!person) return "";
    if (person.moveMode === "approaching") return "正在靠近";
    if (person.moveMode === "leaving") return "正在远离";
    if (person.expiresAt && person.expiresAt - Date.now() < 8 * 60 * 1000) return "即将离开";
    return "";
  }

  function nearbyDisplayAvatar(person) {
    const name = String(person?.name || "?").trim();
    return name.length ? name.slice(0, 1) : "?";
  }

  function archiveMissedNearby(person) {
    if (!person) return;
    state.nearby = (state.nearby || []).filter((p) => p.id !== person.id);
    const whisper = String(person.lastWhisper || pickMissWhisper(person)).slice(0, 80);
    pushStrollReactionBeat(
      whisper ? `${person.name} 消失在街角 · ${whisper}` : `${person.name} 消失在街角。`,
      "擦肩"
    );
    writeStore();
    renderNearbyList();
    queueMapRender();
    if (typeof showToast === "function") showToast(`${person.name} 已离开附近`);
  }

  function nearbyInboundPingActive(person) {
    if (!person) return false;
    const thread = findThreadByNearby(person.id);
    if (!thread || thread.exited) return false;
    if (activeThreadId === thread.id) return false;
    if (Number(thread.unread) <= 0) return false;
    const msgs = thread.messages || [];
    if (msgs.some((m) => m.role === "user" || m.role === "char_proxy")) return false;
    return Boolean(thread.awaitingOpening || threadHasStrangerSpeech(thread));
  }

  function maybeAutoGreetApproaching(person) {
    if (!person || person.autoGreeted || findThreadByNearby(person.id)) return;
    if (Number(person.distanceM) > NEARBY_AUTO_GREET_M) return;
    person.autoGreeted = true;
    writeStore();
    const thread = createThreadFromNearby(person, { withGreeting: true, markUnread: true });
    void ensureThreadOpening(thread.id, { markUnread: true, quiet: true });
    renderMsgList();
    queueMapRender();
    if (typeof showToast === "function") showToast(`${person.name} 主动找你了`);
  }

  function tickNearbyMovement() {
    const userPos = getPos();
    if (!userPos || !(state.nearby || []).length) return false;
    let changed = false;
    const missed = [];
    const now = Date.now();
    (state.nearby || []).forEach((person) => {
      if (!person || !Number.isFinite(Number(person.lat))) return;
      if (person.expiresAt && now > person.expiresAt) {
        person.moveMode = "leaving";
        if (!person.lastWhisper) person.lastWhisper = pickMissWhisper(person);
      }
      const speed = Number(person.moveSpeed) || 12;
      if (person.moveMode === "approaching") {
        const br = bearingFromTo(Number(person.lat), Number(person.lng), userPos.lat, userPos.lng);
        const pt = offsetLatLng(Number(person.lat), Number(person.lng), speed, br);
        person.lat = pt.lat;
        person.lng = pt.lng;
        changed = true;
      } else if (person.moveMode === "leaving") {
        const br = bearingFromTo(userPos.lat, userPos.lng, Number(person.lat), Number(person.lng));
        const pt = offsetLatLng(Number(person.lat), Number(person.lng), speed * 1.05, br);
        person.lat = pt.lat;
        person.lng = pt.lng;
        changed = true;
      }
      syncNearbyPersonDistance(person, userPos);
      if (person.moveMode === "approaching") maybeAutoGreetApproaching(person);
      if (person.moveMode === "leaving" && Number(person.distanceM) > NEARBY_LEAVE_MAX_M) {
        missed.push(person);
      }
    });
    missed.forEach((p) => archiveMissedNearby(p));
    if (changed || missed.length) {
      state.nearby.sort((a, b) => Number(a.distanceM || 0) - Number(b.distanceM || 0));
      writeStore();
      if (activeTab === "nearby") renderNearbyList();
      queueMapRender();
    }
    return changed || missed.length > 0;
  }

  function chaseNearbyPerson(nearbyId) {
    const person = findNearby(nearbyId);
    const userPos = getPos();
    if (!person || !userPos || person.moveMode !== "leaving") return false;
    person.moveMode = "approaching";
    person.moveSpeed = Math.min(28, (Number(person.moveSpeed) || 12) * 1.55);
    person.expiresAt = null;
    const dist = Number(person.distanceM) || 200;
    const br = bearingFromTo(userPos.lat, userPos.lng, Number(person.lat), Number(person.lng));
    const step = Math.min(85, Math.max(28, dist - NEARBY_CHASE_CLOSE_M));
    if (step > 0) {
      const next = offsetLatLng(userPos.lat, userPos.lng, step * 0.45, br);
      applyVirtualPos({
        lat: next.lat,
        lng: next.lng,
        place: localPlaceName(next.lat, next.lng),
        at: Date.now()
      });
    }
    syncNearbyPersonDistance(person, getPos());
    writeStore();
    renderNearbyList();
    queueMapRender();
    if (typeof showToast === "function") showToast(`追向 ${person.name}…`);
    return true;
  }

  function scheduleStrollHook(hook) {
    const h = hook && typeof hook === "object" ? hook : {};
    if (h.kind !== "follow_up") return;
    state.strollHooks = [
      ...(state.strollHooks || []),
      {
        id: uid(),
        kind: "follow_up",
        afterStrolls: Math.max(1, Number(h.afterStrolls) || 2),
        payload: h.payload && typeof h.payload === "object" ? h.payload : {},
        at: Date.now()
      }
    ].slice(-12);
    writeStore();
  }

  function tickStrollHooks() {
    const hooks = state.strollHooks || [];
    if (!hooks.length) return;
    const fired = [];
    const remain = [];
    hooks.forEach((h) => {
      const left = Math.max(0, Number(h.afterStrolls) || 1) - 1;
      if (left > 0) {
        remain.push({ ...h, afterStrolls: left });
        return;
      }
      fired.push(h);
    });
    state.strollHooks = remain;
    fired.forEach((h) => {
      const p = h.payload || {};
      if (h.kind === "follow_up") {
        pushStrollReactionBeat(String(p.text || "上次的选择还在发酵。"), String(p.tag || "余波"));
      }
    });
    if (fired.length) writeStore();
  }

  function startNearbyMoveLoop() {
    stopNearbyMoveLoop();
    nearbyMoveTimer = window.setInterval(() => {
      if (!screen?.classList.contains("is-open")) return;
      tickNearbyMovement();
    }, NEARBY_MOVE_TICK_MS);
  }

  function stopNearbyMoveLoop() {
    if (nearbyMoveTimer != null) {
      window.clearInterval(nearbyMoveTimer);
      nearbyMoveTimer = null;
    }
  }

  function offsetLatLng(lat, lng, distanceM, bearingDeg) {
    const R = 6371000;
    const br = toRad(bearingDeg);
    const lat1 = toRad(lat);
    const lng1 = toRad(lng);
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distanceM / R) +
        Math.cos(lat1) * Math.sin(distanceM / R) * Math.cos(br)
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(br) * Math.sin(distanceM / R) * Math.cos(lat1),
        Math.cos(distanceM / R) - Math.sin(lat1) * Math.sin(lat2)
      );
    return { lat: toDeg(lat2), lng: toDeg(lng2) };
  }

  function formatDistanceM(m) {
    const n = Math.max(0, Math.round(Number(m) || 0));
    if (n < 1000) return n + "m";
    if (n < 10000) return (n / 1000).toFixed(1) + "km";
    return Math.round(n / 1000) + "km";
  }

  function formatTime(at) {
    const d = new Date(Number(at) || Date.now());
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readCompletionText(data) {
    const ch0 = data?.choices?.[0];
    if (!ch0) return "";
    if (typeof ch0.text === "string" && ch0.text.trim()) return ch0.text.trim();
    const msg = ch0.message;
    if (!msg || typeof msg !== "object") return "";
    const c = msg.content;
    if (typeof c === "string") return c.trim();
    if (Array.isArray(c)) {
      const bits = c
        .filter((p) => p && typeof p === "object" && String(p.type || "").toLowerCase() === "text")
        .map((p) => (typeof p.text === "string" ? p.text : typeof p.content === "string" ? p.content : ""))
        .join("")
        .trim();
      if (bits) return bits;
    }
    const rc =
      (typeof msg.reasoning_content === "string" && msg.reasoning_content.trim()) ||
      (typeof msg.reasoning === "string" && msg.reasoning.trim()) ||
      "";
    return String(rc || "").trim();
  }

  /** 漫游 IM：只用 message.content，避免把 reasoning 链误当对白 JSON。 */
  function readRoamCompletionText(data) {
    const ch0 = data?.choices?.[0];
    if (!ch0) return "";
    if (typeof ch0.text === "string" && ch0.text.trim()) return ch0.text.trim();
    const msg = ch0.message;
    if (!msg || typeof msg !== "object") return "";
    const c = msg.content;
    if (typeof c === "string") return c.trim();
    if (Array.isArray(c)) {
      return c
        .filter((p) => p && typeof p === "object" && String(p.type || "").toLowerCase() === "text")
        .map((p) => (typeof p.text === "string" ? p.text : typeof p.content === "string" ? p.content : ""))
        .join("")
        .trim();
    }
    return "";
  }

  function parseJsonFromAi(raw) {
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

  function readActiveCharPersona() {
    const D = window.XXJ_DB;
    if (!D) return null;
    const st = D.getKv(D.K.CHAR_PERSONA_STORE);
    if (st && Array.isArray(st.items) && st.activeId) {
      const cur = st.items.find((x) => x && x.id === st.activeId);
      if (cur) return cur;
    }
    const leg = D.getKv(D.K.CHAR_PERSONA);
    if (leg && typeof leg === "object" && String(leg.displayName || "").trim()) return leg;
    return null;
  }

  function readActiveUserMask() {
    const D = window.XXJ_DB;
    if (!D) return null;
    const st = D.getKv(D.K.USER_MASK_STORE);
    if (st && Array.isArray(st.items) && st.activeId) {
      return st.items.find((x) => x && x.id === st.activeId) || null;
    }
    const leg = D.getKv(D.K.USER_MASK);
    if (leg && typeof leg === "object") return leg;
    return null;
  }

  function readWorldBookVolumes() {
    const D = window.XXJ_DB;
    if (!D) return [];
    const raw = D.getKv(D.K.WORLD_BOOK_STORE);
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.volumes)) return [];
    return raw.volumes;
  }

  function wbRepl(text, charName, userName) {
    return String(text ?? "")
      .replace(/\{\{\s*char\s*\}\}/gi, charName)
      .replace(/\{\{\s*user\s*\}\}/gi, userName);
  }

  function collectRoamWorldBookVolumeIds(char) {
    const ids = [];
    const seen = new Set();
    const push = (id) => {
      const s = String(id || "").trim();
      if (!s || seen.has(s)) return;
      seen.add(s);
      ids.push(s);
    };
    getRoamBoundWorldBookIds().forEach(push);
    if (char && Array.isArray(char.worldBookVolumeIds)) char.worldBookVolumeIds.forEach(push);
    if (char && char.defaultWorldBookVolumeId) push(char.defaultWorldBookVolumeId);
    readWorldBookVolumes()
      .filter((v) => v && v.scope === "global")
      .forEach((v) => push(v.id));
    return ids.slice(0, ROAM_WB_MAX);
  }

  function buildRoamWorldBookContext(char, userMask) {
    const charName = String(char?.displayName || "Ta").trim() || "Ta";
    const userName = String(userMask?.displayName || "你").trim() || "你";
    const vols = readWorldBookVolumes();
    const ids = collectRoamWorldBookVolumeIds(char);
    const parts = [];
    ids.forEach((id) => {
      const vol = vols.find((v) => v && v.id === id);
      if (!vol || !Array.isArray(vol.entries)) return;
      const chunks = [];
      vol.entries.forEach((e) => {
        if (!e || e.enabled === false) return;
        const body = wbRepl(String(e.content || "").trim(), charName, userName);
        if (!body) return;
        const title = wbRepl(String(e.title || "").trim(), charName, userName);
        const keys = wbRepl(String(e.keywords || "").trim(), charName, userName);
        const head = [keys ? `〔${keys}〕` : "", title].filter(Boolean).join(" ");
        chunks.push(head ? `${head}\n${body}` : body);
      });
      if (chunks.length) {
        const vtitle = wbRepl(String(vol.title || "世界书").trim(), charName, userName);
        parts.push(`[世界书 · ${vtitle}]\n${chunks.join("\n\n—\n\n")}`);
      }
    });
    let text = parts.join("\n\n");
    const custom = wbRepl(String(state?.worldviewText || "").trim(), charName, userName);
    if (custom) {
      const block = `[漫游 · 自定义世界观]\n${custom.slice(0, 4000)}`;
      text = text ? `${text}\n\n${block}` : block;
    }
    return text;
  }

  function buildCharContextBlock(char, userMask) {
    if (!char) return "";
    const charName = String(char.displayName || "Ta").trim() || "Ta";
    const userName = String(userMask?.displayName || "你").trim() || "你";
    const bits = [`主角色名：${charName}`];
    if (char.summary) bits.push(`摘要：${wbRepl(char.summary, charName, userName).slice(0, 1200)}`);
    if (char.tags) bits.push(`标签：${wbRepl(char.tags, charName, userName).slice(0, 400)}`);
    if (char.npcRelations) bits.push(`已知人际网：\n${wbRepl(char.npcRelations, charName, userName).slice(0, 900)}`);
    return bits.join("\n");
  }

  function buildUserMaskPromptBlock(userMask, userName) {
    if (!userMask) return "";
    const st = (s) => wbRepl(String(s || "").trim(), "Ta", userName);
    const parts = [];
    const persona = st(userMask.persona);
    const summary = st(userMask.summary);
    if (persona) parts.push(`[主控面具 · 人设]\n${persona.slice(0, 3500)}`);
    if (summary && summary !== persona) parts.push(`[主控面具 · 一句话补充]\n${summary.slice(0, 800)}`);
    if (userMask.voice) parts.push(`[主控面具 · 说话方式]\n${st(userMask.voice).slice(0, 1200)}`);
    if (userMask.boundaries) parts.push(`[主控面具 · 边界与备注]\n${st(userMask.boundaries).slice(0, 1200)}`);
    return parts.join("\n\n");
  }

  function buildRoamImLivelinessBlock(name, userCall) {
    if (typeof window.XXJ_buildImChatLivelinessBlock === "function") {
      return window.XXJ_buildImChatLivelinessBlock(name, userCall).join("\n");
    }
    return [
      `[即时消息 · 活人感]`,
      `你和「${userCall}」是手机两头打字，不是同场演出。语气随「${name}」：口语、省略、敷衍/慢回/嘴硬都行；禁客服腔、百科腔、破墙。`,
      `读上条抓一个线头，能短则短；你是「${name}」本人，标签仅供理解，勿进 lines。`
    ].join("\n");
  }

  function buildRoamNarratorImBlock(name, userCall) {
    return [
      `[旁白模式 · 本密谈已开启（与线上 IM 一致）]`,
      `聊天气泡 lines 仍像即时互发消息；另在 JSON 顶层输出字符串键 **narration**，界面会在本条所有气泡上方居中展示第三人称旁白，形成「读段落 + 看对话」层次。`,
      `**narration** 可写环境氛围、${name} 与「${userCall}」的可见动作、神态、停顿；不要写软件 UI（不要写「发来消息」「聊天记录」）；不要复述 lines 原文。`,
      `**硬边界**：说出口、会发进聊天框的字**只能**写在 **lines**；**禁止**写进 narration（含带「」的对白）。`,
      `**lines** 里不要用【旁白】等前缀写场面（场面只放 narration）。`,
      `**内心独白**（给读者看的）用半角 * 包裹，如 *指尖顿了一下*，界面显示为斜体。`,
      `**旁白密度（标准）**：约 2～4 句、160 字内。若无旁白可写 narration 为 "-" 或空字符串。`,
      `JSON 键顺序：**先 lines、后 narration**（勿先写很长 narration 导致 lines 被截断）。`
    ].join("\n");
  }

  function buildRoamImOutputProtocol(name) {
    return [
      `[输出协议 — 仅约束格式]`,
      `回复以 **一个** JSON 对象为主体（不要 markdown 代码块）：`,
      `- **lines**（字符串数组，必填）：${name} 说出口、会发进聊天框的对白；1～4 条，短句为主；多条用分段，勿写成一整段论文。`,
      `- **narration**（字符串，必填）：旁白正文，见上。`,
      `- **thinking**（字符串，强烈建议）：看见消息到拇指动之间的半秒内过程；**不要**写进 lines；对方看不见。宜 150～280 字；深层心理放 heartVoice。`,
      `- **endChat**（布尔，可选）：true 表示你要结束对话离开；可选 **exitNote**。`,
      `- **friendRequest**（布尔，可选）：你想**主动**加对方为好友时**必须**设为 true（只说不设无效）；可选 **friendRequestNote**。已是好友则不要发。`,
      `也可在 JSON 外单独一行使用 [EXIT:原因:可选留言] 结束对话。`,
      `[格式硬性要求] 每轮**只输出一个** JSON 对象；禁止 markdown 代码块；禁止 JSON 前后任何解释文字。`,
      `不要说明自己是 AI。`
    ].join("\n");
  }

  function buildRoamImThinkingBlock(name, userCall) {
    if (typeof window.buildThinkingChainBeatLines === "function") {
      return window
        .buildThinkingChainBeatLines({ surface: "im", sceneOffline: false, name, userCall })
        .join("\n");
    }
    return [
      `[回复前 · 内化思维链（绝不能让对方看见）]`,
      `写在 JSON \`thinking\` 里（**不要** \`<thinking>\` XML；**不要**在 lines 里写思维过程）。`,
      `对方只看 lines 气泡；thinking 是半秒内过程（宜 150～280 字，为 lines 留劲）。`,
      `Style：第一人称 murmur；半句碎语可；**snag → drift → read → feel → send** 五拍可 blur。`,
      `**snag** 勾住你的词/语气。**drift** 手边+口癖——还像「${name}」吗？**read** 与「${userCall}」之间的气，只抓一个线头。**feel** 内天气。**send** 一种意图+预演开头。`,
      `lines 只写会发出去的字；不破墙。`
    ].join("\n");
  }

  function buildStrangerPersonaBlock(person, userName) {
    const name = String(person.name || "路人").trim() || "路人";
    const st = (s) => wbRepl(String(s || "").trim(), name, userName);
    const parts = [`[角色设定 · ${name}]`];
    if (person.signature || person.hint) {
      parts.push(`[签名/status]\n${st(person.signature || person.hint).slice(0, 200)}`);
    }
    if (person.desc) parts.push(`[角色设定 · 人设（须严格照此说话）]\n${st(person.desc).slice(0, 4500)}`);
    if (person.scenario) parts.push(`[场景定位]\n${st(person.scenario).slice(0, 1200)}`);
    if (person.language) parts.push(`[常用语言]\n${st(person.language).slice(0, 40)}`);
    const fm = st(person.firstMessage);
    if (fm) {
      parts.push(
        `[开场白参考 · 勿机械复读]\n${fm.slice(0, 400)}\n（保持同一人物感与信息密度；正常对话时不要照抄，除非剧情需要。）`
      );
    }
    return parts.join("\n\n");
  }

  function buildStrollAiContext(extra) {
    const pos = getPos();
    const char = readActiveCharPersona();
    const userMask = readActiveUserMask();
    const hour = new Date().getHours();
    const recent = (state.strollLog || [])
      .slice(-8)
      .map((e) => {
        let line = `[${e.tag || "闲逛"}] ${String(e.text || "").slice(0, 120)}`;
        if (e.choiceLabel) line += ` → 你选了「${e.choiceLabel}」`;
        if (e.afterText) line += `（${String(e.afterText).slice(0, 60)}）`;
        return line;
      })
      .join("\n");
    return {
      place: String(pos?.place || localPlaceName(pos?.lat || 0, pos?.lng || 0)).trim(),
      hour,
      recentStroll: recent,
      charBlock: buildCharContextBlock(char, userMask),
      wb: buildRoamWorldBookContext(char, userMask),
      extra: String(extra || "").trim()
    };
  }

  function normalizeStrollChoices(raw) {
    if (!Array.isArray(raw)) return undefined;
    const out = raw
      .slice(0, STROLL_CHOICE_MAX)
      .map((c) => {
        if (!c || typeof c !== "object") return null;
        const label = String(c.label || "").trim().slice(0, 24);
        let effect = String(c.effect || "log").trim();
        if (!STROLL_CHOICE_EFFECTS.has(effect)) effect = "log";
        if (!label) return null;
        const choice = { label, effect };
        if (!c.hint && CHOICE_EFFECT_HINTS[effect]) choice.hint = CHOICE_EFFECT_HINTS[effect];
        else if (c.hint) choice.hint = String(c.hint).slice(0, 10);
        if (c.outcome) choice.outcome = String(c.outcome).trim().slice(0, 80);
        if (effect === "seed_rumor" || effect === "keep_item") {
          choice.rumorSeed = String(c.rumorSeed || c.item || c.label || "怪事").trim().slice(0, 40);
        }
        if (effect === "spawn_greet") choice.msg = String(c.msg || "你好？").trim().slice(0, 80) || "你好？";
        return choice;
      })
      .filter(Boolean);
    return out.length ? out : undefined;
  }

  function normalizeStrollStep(raw) {
    if (!raw || typeof raw !== "object") return null;
    const tag = STROLL_TAGS.includes(String(raw.tag || "")) ? String(raw.tag) : "偶遇";
    const text = String(raw.text || "").trim().slice(0, 280);
    if (!text) return null;
    const choices = normalizeStrollChoices(raw.choices);
    return choices ? { tag, text, choices } : { tag, text };
  }

  function strollAiSystemPrompt() {
    return (
      "你是漫游 App 的街景叙事生成器。简体中文，活人感，有随机性和可玩性。\n" +
      "遵守世界观与主角色设定；可暗示、穿缝、传闻，但不要写死主线结论。\n" +
      "不要模板化姓名或套路桥段；每次要有新细节、新动机。\n" +
      "只输出合法 JSON，不要 markdown 或解释。"
    );
  }

  function strollAiContextBlock(ctx) {
    const timeHint =
      ctx.hour >= 22 || ctx.hour < 6 ? "深夜" : ctx.hour >= 17 ? "傍晚" : ctx.hour >= 11 ? "白天" : "上午";
    let block =
      `当前位置：${ctx.place || "附近街区"}\n时段：${timeHint}（${ctx.hour} 点）\n`;
    if (ctx.recentStroll) block += `\n最近闲逛（可延续、呼应，勿复述）：\n${ctx.recentStroll}\n`;
    const rumorLines = (state?.rumors || [])
      .filter((r) => r.status === "fresh" || r.status === "mutated" || r.status === "verified")
      .slice(0, 4)
      .map((r) => `- ${r.text}`)
      .join("\n");
    if (rumorLines) block += `\n街区传闻：\n${rumorLines}\n`;
    if (ctx.charBlock) block += `\n主角色：\n${ctx.charBlock}\n`;
    if (ctx.wb) block += `\n世界观：\n${ctx.wb}\n`;
    if (ctx.extra) block += `\n${ctx.extra}\n`;
    return block;
  }

  async function generateStrollWalkBatchWithAI(ctx) {
    const tagPool = STROLL_TAGS.filter((t) => t !== "选择").join("、");
    const raw = await aiChat(
      [
        { role: "system", content: strollAiSystemPrompt() },
        {
          role: "user",
          content:
            strollAiContextBlock(ctx) +
            `\n生成一次完整的「随便走走」路段（${STROLL_BEATS_MIN}～${STROLL_BEATS_MAX} 段连续偶遇，一次输出全部）。\n` +
            `要求：\n` +
            `- beats 数组按走路顺序；前后要有因果或氛围连贯，像一段 mini 冒险。\n` +
            `- **必须**有且仅有 1 段 tag 为「选择」的**突发事件**（紧张/怪诞/温情/误会/穿缝均可），带 **${STROLL_CHOICE_MIN}～${STROLL_CHOICE_MAX} 个**不同选项，每个选项后果明显不同、不要同义重复。\n` +
            `- 其余段为无选项的氛围/线索/余味（tag 从 ${tagPool} 中选）。\n` +
            `- 「选择」段建议放在中间或偏后，让玩家先进入情境。\n` +
            `选项 rules：\n` +
            `- label 2～10 字；hint 2～6 字（后果暗示）。\n` +
            `- effect 只能是：advance, advance_quiet, log, spawn_nearby, spawn_knows_char, spawn_greet, seed_rumor, boost_rumor, peek_rumor\n` +
            `- spawn_greet 须带 msg；seed_rumor 须带 rumorSeed（会化为风言风语）；至少 2 个选项应能 spawn_nearby / spawn_knows_char / spawn_greet 之一。\n` +
            `- 每个选项可带 outcome（10～40 字，选后立即发生的余波一句，不要重复 label）。\n` +
            `输出 JSON：{ "beats": [ { "tag","text","choices"?: [...] }, ... ] }`
        }
      ],
      { temperature: 1.07, max_tokens: 2800, response_format: { type: "json_object" } }
    );
    const parsed = parseJsonFromAi(raw);
    return normalizeStrollWalkBatch(parsed);
  }

  function normalizeStrollWalkBatch(parsed) {
    if (!parsed || typeof parsed !== "object") return null;
    const steps = (Array.isArray(parsed.beats) ? parsed.beats : [])
      .map((s) => normalizeStrollStep(s))
      .filter(Boolean)
      .slice(0, STROLL_BEATS_MAX);
    if (steps.length < STROLL_BEATS_MIN) return null;
    const withChoices = steps.filter((s) => s.choices?.length);
    if (!withChoices.length) return null;
    let mainIdx = steps.findIndex((s) => s.tag === "选择" && s.choices?.length);
    if (mainIdx < 0) {
      mainIdx = steps.reduce(
        (best, s, i) => ((s.choices?.length || 0) > (steps[best]?.choices?.length || 0) ? i : best),
        0
      );
    }
    const mainStep = steps[mainIdx];
    if (!mainStep?.choices || mainStep.choices.length < 3) return null;
    mainStep.choices = padLocalChoices(mainStep.choices).slice(0, STROLL_CHOICE_MAX);
    return steps.map((step, i) => ({
      tag: step.tag,
      text: step.text,
      choices: step.choices,
      aiGenerated: true,
      isMain: i === mainIdx,
      isAmbient: i !== mainIdx && !step.choices?.length
    }));
  }

  async function generateStrollNpcWithAI(knowsChar, ctx, triggerText) {
    const char = readActiveCharPersona();
    const charName = String(char?.displayName || "Ta").trim() || "Ta";
    const raw = await aiChat(
      [
        { role: "system", content: "你是 JSON 生成器。只输出一个附近遇见的对象。name 必须是 2～3 字中文人名/外国名/宠物名，禁止身份描述或网名；身份写 signature。" },
        {
          role: "user",
          content:
            strollAiContextBlock(ctx) +
            `\n因闲逛事件要在「附近的人」刷出 1 个对象。\n` +
            `触发片段：${String(triggerText || "").slice(0, 200)}\n` +
            `${NEARBY_NAME_GUIDE}\n` +
            (knowsChar
              ? `此人须 knowsChar:true，与主角色「${charName}」有弱关联（charLink + charLinkDetail）。firstMessage 可间接提到 ${charName}。\n`
              : `knowsChar:false，但要有鲜明 signature 和 firstMessage，和触发片段有关。\n`) +
            `输出 JSON：{ "name","signature","distance"(如 180m),"firstMessage","knowsChar"(bool),"charLink","charLinkDetail" }`
        }
      ],
      { temperature: 1.05, max_tokens: 520, response_format: { type: "json_object" } }
    );
    const parsed = parseJsonFromAi(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      name: resolveNearbyPersonName(parsed.name, { signature: parsed.signature }),
      signature: String(parsed.signature || "").trim(),
      distance: String(parsed.distance || formatDistanceM(120 + Math.floor(Math.random() * 400))).trim(),
      firstMessage: String(parsed.firstMessage || "……").trim(),
      knowsChar: Boolean(knowsChar || parsed.knowsChar),
      charLink: String(parsed.charLink || "").trim(),
      charLinkDetail: String(parsed.charLinkDetail || "").trim()
    };
  }

  function padLocalChoices(choices) {
    const base = [...(choices || [])];
    const used = new Set(base.map((c) => c.label));
    const extras = [
      { label: "喊一嗓子", hint: "惹注意", effect: "spawn_nearby" },
      { label: "装没事走开", hint: "回避", effect: "advance_quiet" },
      { label: "先拍下来", hint: "风传", effect: "seed_rumor", rumorSeed: "随手照片" },
      { label: "问问路人", hint: "开聊", effect: "spawn_greet", msg: "请问一下…" },
      { label: "发条动态", hint: "风传", effect: "boost_rumor" },
      { label: "对照传闻", hint: "核实", effect: "peek_rumor" }
    ];
    for (const e of extras) {
      if (base.length >= STROLL_CHOICE_MIN) break;
      if (!used.has(e.label)) {
        base.push(e);
        used.add(e.label);
      }
    }
    return base.slice(0, STROLL_CHOICE_MAX);
  }

  function pickLocalChoiceOutcome(choice) {
    const effect = String(choice?.effect || "log");
    const pool = CHOICE_OUTCOME_LINES[effect] || CHOICE_OUTCOME_LINES.log;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pickStrollChoiceLocal() {
    const pool = [...STROLL_CHOICE_EVENTS];
    const rumors = (state.rumors || []).filter((r) => r.status === "fresh" || r.status === "mutated");
    if (rumors.length) {
      const r = rumors[0];
      pool.push({
        tag: "选择",
        text: `风言风语还在耳边：「${String(r.text).slice(0, 36)}…」要怎么做？`,
        choices: [
          { label: "去打听", hint: "核实", effect: "peek_rumor" },
          { label: "加一把火", hint: "风传", effect: "boost_rumor" },
          { label: "换条路走", hint: "遇人", effect: "spawn_nearby" },
          { label: "当作没听见", hint: "观望", effect: "log" }
        ]
      });
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pushStrollReactionBeat(text, tag) {
    const t = String(text || "").trim();
    if (!t) return;
    const pos = getPos();
    state.strollLog = [
      ...(state.strollLog || []),
      {
        id: uid(),
        tag: tag || "余波",
        text: t,
        at: Date.now(),
        place: pos?.place || "",
        isReaction: true
      }
    ].slice(-80);
  }

  function pickStrollPayloadSync() {
    if (Math.random() < 0.85) {
      const evt = pickStrollChoiceLocal();
      return {
        tag: evt.tag,
        text: evt.text,
        choices: padLocalChoices(evt.choices),
        aiGenerated: false
      };
    }
    const flat = pickStrollEvent();
    return { tag: flat.tag, text: flat.text, aiGenerated: false };
  }

  function pickStrollAmbientBeat() {
    const flat = pickStrollEvent();
    return {
      tag: flat.tag,
      text: flat.text,
      aiGenerated: false,
      isAmbient: true
    };
  }

  function pickUniqueAmbientBeat(usedTexts) {
    const seen = usedTexts instanceof Set ? usedTexts : new Set();
    for (let t = 0; t < 10; t++) {
      const beat = pickStrollAmbientBeat();
      if (!seen.has(beat.text)) {
        seen.add(beat.text);
        return beat;
      }
    }
    const beat = pickStrollAmbientBeat();
    seen.add(beat.text);
    return beat;
  }

  function buildStrollBeatBatchSync() {
    const target =
      STROLL_BEATS_MIN + Math.floor(Math.random() * (STROLL_BEATS_MAX - STROLL_BEATS_MIN + 1));
    const main = pickStrollPayloadSync();
    const usedTexts = new Set();
    const beats = [];
    const lead = 1 + (Math.random() < 0.55 ? 1 : 0);
    for (let i = 0; i < lead && beats.length + 1 < target; i++) {
      beats.push(pickUniqueAmbientBeat(usedTexts));
    }
    beats.push({
      ...main,
      isAmbient: false,
      isMain: true,
      choices: main.choices?.length ? padLocalChoices(main.choices) : undefined
    });
    usedTexts.add(String(main.text || ""));
    while (beats.length < target) {
      if (main.choices?.length && beats.length >= Math.max(2, target - 1)) break;
      beats.push(pickUniqueAmbientBeat(usedTexts));
    }
    return beats.slice(0, target);
  }

  async function resolveStrollBeatBatch() {
    state.strollCounter = (Number(state.strollCounter) || 0) + 1;
    writeStore();

    if (hasAiKey()) {
      const ctx = buildStrollAiContext();
      try {
        const aiBeats = await generateStrollWalkBatchWithAI(ctx);
        if (aiBeats?.length) return { beats: aiBeats, usedAi: true };
      } catch (_) {
        /* fallback local */
      }
    }
    return { beats: buildStrollBeatBatchSync(), usedAi: false };
  }

  function buildFriendDecisionPromptBlock(name, userCall) {
    return [
      `[好友申请 · 用户发起]`,
      `用户「${userCall}」在漫游 App 里点了「加好友」，向你发来好友申请——**不是**你在主动 friendRequest。`,
      `请根据上文聊天、你的人设与边界，自主决定 **accept** 或 **reject**。`,
      `已聊了几轮、气氛不差：多数情况应 **accept**；只有明显不合、骚扰、或人设会拒才 **reject**。`,
      `[输出协议 — 好友申请专用 · 必须严格遵守]`,
      `只输出一个 JSON 对象（不要 markdown）：`,
      `- **friendDecision**（必填，只能是字符串）："accept" 或 "reject"（二选一，不可省略）`,
      `- **lines**（字符串数组，必填）：1～3 条，明确说出同意或拒绝（如「行，加吧」/「先不加好友」）`,
      `- **narration**（字符串，必填）：旁白；无则 "-"`,
      `示例同意：{"friendDecision":"accept","lines":["行啊，加吧。"],"narration":"-"}`,
      `示例拒绝：{"friendDecision":"reject","lines":["先不加了吧，我们还不太熟。"],"narration":"-"}`,
      `不要输出 friendRequest / endChat；不要说明自己是 AI。`
    ].join("\n");
  }

  function inferFriendSpeechIntent(lines, narration) {
    const parts = (Array.isArray(lines) ? lines : [])
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    const joined = [...parts, normalizeRoamNarration(narration)].filter(Boolean).join(" ");
    if (!joined) return null;
    if (/不想加|别加|不加好友|拒绝好友|好友算了|先不加|暂不|不熟.*加|不加.*好友/i.test(joined)) return null;
    const mutual =
      /(通过|同意|接受).{0,10}(好友|申请)|加好了|加上了|好友加上了|那就加|已经加你|我加你了|加过好友了|好友通过了|我们是好友|已经是好友|好友关系了|好友加上了/i.test(
        joined
      );
    const inbound =
      /(想|要|来).{0,8}加.{0,6}你|加你为好友|加个好友|加一下好友|好友申请|发.{0,6}好友|申请.{0,6}好友|要不要加好友|加好友吗/i.test(
        joined
      );
    if (mutual) return { kind: "mutual" };
    if (inbound) return { kind: "inbound" };
    return null;
  }

  function threadHasPendingOutboundFriendRequest(thread) {
    if (!thread) return false;
    if (thread.outboundFriendPending) return true;
    return friendMetaFrom(null, thread).friendStatus === "pending";
  }

  function applyVerbalFriendAcceptance(thread, person, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    if (!thread || !person) return;
    const meta = friendMetaFrom(person, thread);
    if (meta.friendStatus === "friend") return;
    const fromOutbound = o.fromOutbound === true;
    applyFriendMeta(person, thread, { friendStatus: "friend", clearReject: true });
    delete thread.outboundFriendPending;
    delete thread.inboundFriendRequest;
    thread.messages.push({
      id: uid(),
      role: "system",
      text: fromOutbound
        ? `${person.name} 通过了你的好友申请`
        : `你和 ${person.name} 已成为漫游好友`,
      at: Date.now()
    });
    upsertThread(thread);
    syncChatFriendBtn(person);
    syncInboundFriendBanner(thread, person);
    renderNearbyList();
    if (typeof showToast === "function") {
      showToast(`你和 ${person.name} 成为好友了 · 可点「进密谈」`);
    }
  }

  function inferFriendDecisionFromSpeech(lines, narration) {
    const parts = (Array.isArray(lines) ? lines : [])
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    const joined = [...parts, normalizeRoamNarration(narration)].filter(Boolean).join(" ");
    if (!joined) return null;
    if (/【同意】|\[ACCEPT\]/i.test(joined)) {
      return {
        accepted: true,
        rejected: false,
        lines: parts.length ? parts : ["行啊，加吧。"],
        narration: normalizeRoamNarration(narration),
        note: ""
      };
    }
    if (/【拒绝】|\[REJECT\]/i.test(joined)) {
      return {
        accepted: false,
        rejected: true,
        lines: parts.length ? parts : ["……先不加了吧。"],
        narration: normalizeRoamNarration(narration),
        note: ""
      };
    }
    const rejected =
      /不想加|别加|不加好友|拒绝|不了|算了|先别|暂不|不熟|不认识|算了吧|下次再说|先不|婉拒|不方便/i.test(
        joined
      );
    if (rejected) {
      return {
        accepted: false,
        rejected: true,
        lines: parts.length ? parts : ["……先不加了吧。"],
        narration: normalizeRoamNarration(narration),
        note: ""
      };
    }
    const intent = inferFriendSpeechIntent(lines, narration);
    if (intent?.kind === "mutual") {
      return {
        accepted: true,
        rejected: false,
        lines: parts.length ? parts : ["行啊，加吧。"],
        narration: normalizeRoamNarration(narration),
        note: ""
      };
    }
    if (/行啊|加吧|可以啊|好啊|没问题|通过|同意|加好友|加上|ok|sure/i.test(joined)) {
      return {
        accepted: true,
        rejected: false,
        lines: parts.length ? parts : ["行啊，加吧。"],
        narration: normalizeRoamNarration(narration),
        note: ""
      };
    }
    return null;
  }

  function resolveFriendDecisionFromAiRaw(raw) {
    let parsed = parseFriendDecisionPayload(raw);
    if (parsed) return parsed;
    if (!raw) return null;
    const roamReply = parseRoamStrangerPayload(raw);
    if (roamReply?.lines?.length) {
      return inferFriendDecisionFromSpeech(roamReply.lines, roamReply.narration);
    }
    return null;
  }

  function fallbackFriendDecision(thread) {
    const turns = countThreadDialogueSince(thread, 0);
    const accepted = turns >= 2;
    return {
      accepted,
      rejected: !accepted,
      lines: accepted ? ["好啊，加上吧。"] : ["……我们再聊聊再说吧。"],
      narration: "",
      note: ""
    };
  }

  function parseFriendDecisionPayload(raw) {
    const parsed = parseJsonFromAi(String(raw || "").trim());
    if (parsed && typeof parsed === "object") {
      const pick = (arr) =>
        Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : [];
      let lineParts = pick(parsed.lines);
      if (!lineParts.length && typeof parsed.reply === "string" && parsed.reply.trim()) {
        lineParts = [parsed.reply.trim()];
      }
      const decRaw = String(
        parsed.friendDecision || parsed.decision || parsed.friend_decision || parsed.result || ""
      ).trim().toLowerCase();
      let accepted =
        parsed.accept === true ||
        parsed.accepted === true ||
        parsed.agreed === true ||
        parsed.approve === true ||
        decRaw === "accept" ||
        decRaw === "accepted" ||
        decRaw === "yes" ||
        decRaw === "agree" ||
        decRaw === "true";
      let rejected =
        parsed.reject === true ||
        parsed.rejected === true ||
        parsed.declined === true ||
        decRaw === "reject" ||
        decRaw === "rejected" ||
        decRaw === "no" ||
        decRaw === "decline" ||
        decRaw === "false";
      if (!accepted && !rejected && lineParts.length) {
        const inferred = inferFriendDecisionFromSpeech(lineParts, parsed.narration);
        if (inferred) return inferred;
      }
      if (accepted && !rejected) {
        lineParts = lineParts.map((s) =>
          s.replace(/^【同意】|\[ACCEPT\]|^同意[：:,，\s]*/i, "").trim()
        ).filter(Boolean);
      }
      if (rejected && !accepted) {
        lineParts = lineParts.map((s) =>
          s.replace(/^【拒绝】|\[REJECT\]|^拒绝[：:,，\s]*/i, "").trim()
        ).filter(Boolean);
      }
      const narration = normalizeRoamNarration(parsed.narration);
      if (accepted || rejected) {
        return {
          accepted,
          rejected,
          lines: lineParts,
          narration,
          note: String(parsed.rejectReason || parsed.reason || "").trim()
        };
      }
    }
    const text = String(raw || "").trim();
    const lineParts = text
      .split("|||")
      .map((s) => s.trim())
      .filter(Boolean);
    const inferred = inferFriendDecisionFromSpeech(lineParts, "");
    if (inferred) return inferred;
    return null;
  }

  async function tryRepairFriendDecisionPayload(raw) {
    const snippet = String(raw || "").trim().slice(0, 4500);
    if (!snippet || snippet.length < 4) return null;
    try {
      const repRaw = await aiChat(
        [
          {
            role: "system",
            content: "你是 JSON 修复器。只输出一个合法 JSON 对象，不要 markdown，不要解释。"
          },
          {
            role: "user",
            content:
              `修复为好友申请回复 JSON。原文：\n${snippet}\n\n` +
              `必须包含 friendDecision（"accept"或"reject"）、lines（string[]）、narration（无则"-"）。只输出 JSON。`
          }
        ],
        { temperature: 0.12, max_tokens: 900, response_format: { type: "json_object" } }
      );
      return parseFriendDecisionPayload(repRaw);
    } catch {
      return null;
    }
  }

  async function callStrangerFriendDecisionAI(thread, person) {
    const userMask = readActiveUserMask();
    const userName = String(userMask?.displayName || "你").trim() || "你";
    const name = String(person.name || "路人").trim() || "路人";
    let history = (thread.messages || [])
      .filter((m) => m.role !== "system")
      .slice(-18)
      .map((m) => ({
        role: m.role === "user" || m.role === "char_proxy" ? "user" : "assistant",
        content: roamMsgToApiText(m)
      }))
      .filter((m) => String(m.content || "").trim());
    const sys =
      buildStrangerSystemPrompt(person) +
      "\n\n" +
      buildFriendDecisionPromptBlock(name, userName);
    const userTail =
      `（系统：用户「${userName}」刚向你发送漫游好友申请。` +
      `你必须输出 friendDecision 为 "accept" 或 "reject"，并在 lines 里明确表态。）`;
    const chatOpts = { temperature: 0.82, max_tokens: 1100, response_format: { type: "json_object" } };
    let raw = await aiChat(
      [{ role: "system", content: sys }, ...history, { role: "user", content: userTail }],
      chatOpts
    );
    let parsed = resolveFriendDecisionFromAiRaw(raw);
    if (!parsed) {
      parsed = await tryRepairFriendDecisionPayload(raw);
    }
    if (!parsed) {
      raw = await aiChat(
        [
          { role: "system", content: sys },
          ...history,
          {
            role: "user",
            content:
              '（系统：上次输出无效。只输出 JSON：{"friendDecision":"accept或reject","lines":["…"],"narration":"-"}）'
          }
        ],
        { ...chatOpts, temperature: 0.55 }
      );
      parsed = resolveFriendDecisionFromAiRaw(raw);
    }
    if (!parsed) {
      parsed = fallbackFriendDecision(thread);
    }
    if (!parsed.lines.length) {
      parsed.lines = parsed.accepted
        ? ["行啊，加吧。"]
        : ["……先这样吧，好友就算了。"];
    }
    return parsed;
  }

  function countThreadDialogueSince(thread, sinceAt) {
    const t0 = Number(sinceAt) || 0;
    return (thread?.messages || []).filter((m) => {
      if (m.role !== "user" && m.role !== "stranger" && m.role !== "char_proxy") return false;
      return Number(m.at) > t0;
    }).length;
  }

  function canSendOutboundFriendRequest(meta, thread) {
    if (!meta || meta.friendStatus === "friend" || meta.friendStatus === "pending") return { ok: false };
    const lastReject = Number(meta.lastFriendRejectAt) || 0;
    if (lastReject && Date.now() - lastReject < FRIEND_REJECT_COOLDOWN_MS) {
      const since = countThreadDialogueSince(thread, lastReject);
      if (since < FRIEND_REJECT_RETRY_MSGS) {
        return { ok: false, reason: "对方刚拒绝过，先聊几句再试" };
      }
    }
    return { ok: true };
  }

  function acceptInboundFriendRequest() {
    if (!activeThreadId) return;
    const thread = findThread(activeThreadId);
    const person = thread ? findNearby(thread.nearbyId) : null;
    if (!thread || !person) return;
    applyFriendMeta(person, thread, { friendStatus: "friend", clearReject: true });
    delete thread.inboundFriendRequest;
    upsertThread(thread);
    syncChatFriendBtn(person);
    syncInboundFriendBanner(thread, person);
    renderNearbyList();
    if (typeof showToast === "function") showToast(`你和 ${person.name} 成为好友了 · 可点「进密谈」`);
  }

  function declineInboundFriendRequest() {
    if (!activeThreadId) return;
    const thread = findThread(activeThreadId);
    const person = thread ? findNearby(thread.nearbyId) : null;
    if (!thread) return;
    delete thread.inboundFriendRequest;
    writeStore();
    upsertThread(thread);
    syncInboundFriendBanner(thread, person);
    if (typeof showToast === "function" && person) showToast(`已忽略 ${person.name} 的好友申请`);
  }

  function syncInboundFriendBanner(thread, person) {
    const req = thread?.inboundFriendRequest;
    const meta = friendMetaFrom(person, thread);
    const show = Boolean(req && meta.friendStatus !== "friend");
    if (roamChatFriendInbound) {
      roamChatFriendInbound.hidden = !show;
      roamChatFriendInbound.toggleAttribute("aria-hidden", !show);
    }
    if (show && roamChatFriendInboundText && person) {
      const note = String(req.note || "").trim();
      roamChatFriendInboundText.textContent = note
        ? `${person.name} 想加你为好友：${note}`
        : `${person.name} 想加你为漫游好友`;
    }
  }

  async function sendFriendRequestForActiveChat() {
    if (!activeThreadId || friendRequestInflight || chatBusy) return;
    const thread = findThread(activeThreadId);
    const person = thread ? findNearby(thread.nearbyId) : null;
    if (!person || thread.exited) return;
    ensurePersonSocial(person);
    const meta = friendMetaFrom(person, thread);
    if (meta.friendStatus === "friend") {
      if (typeof showToast === "function") showToast("已经是好友了");
      return;
    }
    if (meta.friendStatus === "pending") {
      if (typeof showToast === "function") showToast("好友申请处理中…");
      return;
    }
    const gate = canSendOutboundFriendRequest(meta, thread);
    if (!gate.ok) {
      if (typeof showToast === "function") showToast(gate.reason || "暂时无法发送");
      return;
    }
    if (!hasAiKey()) {
      if (typeof showToast === "function") showToast("请先在「我的 → 连接 API」填写 API Key");
      return;
    }

    applyFriendMeta(person, thread, { friendStatus: "pending" });
    thread.outboundFriendPending = { at: Date.now() };
    thread.messages.push({
      id: uid(),
      role: "system",
      text: `你向 ${person.name} 发送了好友申请`,
      at: Date.now()
    });
    thread.updatedAt = Date.now();
    upsertThread(thread);
    syncChatFriendBtn(person);
    renderChatMessages(thread);

    friendRequestInflight = true;
    roamChatFriendBtn?.classList.add("is-busy");
    roamChatSend?.classList.add("is-busy");
    if (roamChatInput) roamChatInput.disabled = true;
    if (typeof showToast === "function") showToast("等待对方回应…");

    try {
      if (person.isStub) await hydrateNearbyPersona(person.id);
      const livePerson = findNearby(thread.nearbyId) || person;
      applyFriendMeta(livePerson, thread, { friendStatus: "pending" });
      const decision = await callStrangerFriendDecisionAI(thread, livePerson);
      const reply = {
        lines: decision.lines,
        narration: decision.narration || "",
        text: decision.lines.join("|||"),
        friendRequest: false,
        endChat: false,
        exited: false
      };
      pushStrangerReplyToThread(thread, reply);
      thread.preview = decision.lines[0] || thread.preview;
      thread.updatedAt = Date.now();
      delete thread.outboundFriendPending;

      if (decision.accepted) {
        applyFriendMeta(livePerson, thread, { friendStatus: "friend", clearReject: true });
        thread.messages.push({
          id: uid(),
          role: "system",
          text: `${livePerson.name} 通过了你的好友申请`,
          at: Date.now()
        });
        if (typeof showToast === "function") showToast(`${livePerson.name} 通过了好友申请 · 可点「进密谈」`);
      } else {
        applyFriendMeta(livePerson, thread, {
          friendStatus: "stranger",
          lastFriendRejectAt: Date.now()
        });
        thread.messages.push({
          id: uid(),
          role: "system",
          text: `${livePerson.name} 暂不想加好友`,
          at: Date.now()
        });
        if (typeof showToast === "function") showToast(`${livePerson.name} 拒绝了好友申请`);
      }

      upsertThread(thread);
      syncChatFriendBtn(livePerson);
      renderChatMessages(thread);
      renderMsgList();
      renderNearbyList();
    } catch (err) {
      applyFriendMeta(person, thread, { friendStatus: "stranger" });
      delete thread.outboundFriendPending;
      upsertThread(thread);
      syncChatFriendBtn(person);
      if (typeof showToast === "function") showToast(String(err?.message || err || "好友申请失败"));
    } finally {
      friendRequestInflight = false;
      roamChatFriendBtn?.classList.remove("is-busy");
      roamChatSend?.classList.remove("is-busy");
      if (roamChatInput && !thread.exited) roamChatInput.disabled = false;
      syncChatFriendBtn(findNearby(thread.nearbyId) || person);
    }
  }

  function recoverStaleFriendPending(thread, person) {
    if (!thread || !person || friendRequestInflight) return;
    const meta = friendMetaFrom(person, thread);
    if (meta.friendStatus !== "pending") return;
    const pendingAt = Number(thread.outboundFriendPending?.at) || 0;
    if (pendingAt && Date.now() - pendingAt < 120000) return;
    applyFriendMeta(person, thread, { friendStatus: "stranger" });
    delete thread.outboundFriendPending;
  }

  async function openRoamFriendInMainChat() {
    if (!activeThreadId) {
      roamNotify("请先打开和路人的聊天");
      return;
    }
    const thread = findThread(activeThreadId);
    const person = thread ? resolveThreadPerson(thread) : null;
    if (!thread || !person) {
      roamNotify("找不到当前会话");
      return;
    }
    const meta = friendMetaFrom(person, thread);
    if (meta.friendStatus !== "friend") {
      roamNotify("成为好友后才能进密谈");
      return;
    }
    if (thread.linkedMainChat?.threadId && typeof window.openRoamLinkedMainChat === "function") {
      if (window.openRoamLinkedMainChat(thread.linkedMainChat)) {
        if (typeof closeRoamScreen === "function") closeRoamScreen();
      }
      return;
    }
    if (typeof window.promoteRoamFriendToMainChat !== "function") {
      roamNotify("密谈模块未就绪，请刷新后重试");
      return;
    }
    setRoamLoading(true, "正在导入密谈…");
    try {
      if (person.isStub) await hydrateNearbyPersona(person.id);
      const livePerson = resolveThreadPerson(thread) || person;
      const result = window.promoteRoamFriendToMainChat({
        roamThreadId: thread.id,
        nearbyId: livePerson.id,
        person: snapshotNearbyPerson(livePerson),
        messages: (thread.messages || []).slice(),
        place: getPos()?.place || livePerson.place || ""
      });
      if (result?.threadId) {
        thread.linkedMainChat = {
          charId: result.charId,
          threadId: result.threadId,
          maskId: result.maskId,
          at: Date.now()
        };
        writeStore();
        syncChatFriendBtn(livePerson);
        if (typeof closeRoamScreen === "function") closeRoamScreen();
        roamNotify(result.reused ? `已打开与 ${livePerson.name} 的密谈` : `已与 ${livePerson.name} 进入密谈`);
      }
    } catch (err) {
      roamNotify(String(err?.message || err || "导入密谈失败"));
    } finally {
      setRoamLoading(false);
    }
  }

  function syncChatFriendBtn(person) {
    if (!roamChatFriendBtn || !person) return;
    const thread = activeThreadId ? findThread(activeThreadId) : null;
    const meta = friendMetaFrom(person, thread);
    const st = meta.friendStatus;
    if (friendRequestInflight || st === "pending") {
      roamChatFriendBtn.textContent = "申请中…";
      roamChatFriendBtn.disabled = true;
      roamChatFriendBtn.title = "";
      return;
    }
    if (st === "friend") {
      if (thread?.linkedMainChat?.threadId) {
        roamChatFriendBtn.textContent = "已在密谈";
        roamChatFriendBtn.disabled = false;
        roamChatFriendBtn.title = "打开密谈继续聊（含手帐记忆）";
      } else {
        roamChatFriendBtn.textContent = "进密谈";
        roamChatFriendBtn.disabled = false;
        roamChatFriendBtn.title = "导入漫游聊天记录并进入密谈";
      }
      return;
    }
    roamChatFriendBtn.textContent = "加好友";
    const gate = thread ? canSendOutboundFriendRequest(meta, thread) : { ok: true };
    roamChatFriendBtn.disabled = !gate.ok;
    roamChatFriendBtn.title = gate.reason || "";
  }

  function mutateRumorLocal(rumor) {
    rumor.prevText = rumor.text;
    const twists = [
      "细节对不上",
      "版本变了",
      "有人添油加醋",
      "主语被换了一个"
    ];
    const tw = twists[Math.floor(Math.random() * twists.length)];
    rumor.text = `${String(rumor.text).slice(0, 90)}……${tw}。`;
    rumor.status = "mutated";
    rumor.version = Number(rumor.version || 1) + 1;
    rumor.updatedAt = Date.now();
    rumor.heat = Math.min(RUMOR_HEAT_START, Number(rumor.heat || 0) + 35);
    rumor.strollsSeen = 0;
    return rumor;
  }

  async function mutateRumorWithAI(rumor) {
    if (!hasAiKey() || Math.random() > 0.15) return mutateRumorLocal(rumor);
    try {
      const raw = await aiChat(
        [
          { role: "system", content: "你是传闻演变生成器。只输出 JSON。" },
          {
            role: "user",
            content:
              `原传闻：${rumor.text}\n` +
              `写一条「同一传闻被传歪 / 更新」的新版本，50～100字，保留核心但细节变化。\n` +
              `输出：{ "text":"..." }`
          }
        ],
        { temperature: 1.05, max_tokens: 280, response_format: { type: "json_object" } }
      );
      const parsed = parseJsonFromAi(raw);
      if (parsed?.text) {
        rumor.prevText = rumor.text;
        rumor.text = String(parsed.text).slice(0, 220);
        rumor.status = "mutated";
        rumor.version = Number(rumor.version || 1) + 1;
        rumor.updatedAt = Date.now();
        rumor.heat = Math.min(RUMOR_HEAT_START, Number(rumor.heat || 0) + 40);
      }
    } catch (_) {
      /* keep */
    }
    return rumor;
  }

  async function tickRumorsLifecycle() {
    const list = state.rumors || [];
    if (!list.length) return;
    const next = [];
    for (const raw of list) {
      const r = { ...raw };
      r.strollsSeen = Number(r.strollsSeen || 0) + 1;
      r.heat = Number(r.heat != null ? r.heat : RUMOR_HEAT_START);
      const decay = r.status === "verified" ? 6 : r.status === "faded" ? 18 : 10 + Math.floor(Math.random() * 8);
      r.heat = Math.max(0, r.heat - decay);

      if (r.status === "faded" && r.strollsSeen >= RUMOR_EXPIRE_STROLLS) {
        continue;
      }

      if ((r.status === "fresh" || r.status === "mutated") && r.strollsSeen >= RUMOR_FADE_STROLLS) {
        const roll = Math.random();
        if (roll < 0.38) {
          mutateRumorLocal(r);
        } else if (roll < 0.72) {
          r.status = "faded";
          r.text = `${String(r.text).slice(0, 100)}（越传越模糊，快要散了。）`;
          r.updatedAt = Date.now();
        } else {
          continue;
        }
      } else if (r.heat <= 0 && r.status !== "verified") {
        r.status = "faded";
        r.updatedAt = Date.now();
      }

      next.push(r);
    }
    state.rumors = next.slice(0, 40);
    writeStore();
    renderSecretsPanel();
    updateSecretsTabBadge();
  }

  function addRumor(row) {
    const text = String(row?.text || "").trim();
    if (!text) return null;
    const pos = getPos();
    const rumor = {
      id: uid(),
      text: text.slice(0, 220),
      place: String(row?.place || pos?.place || "").trim(),
      source: String(row?.source || "风传").trim().slice(0, 12) || "风传",
      status: "fresh",
      at: Date.now(),
      updatedAt: Date.now(),
      heat: RUMOR_HEAT_START,
      strollsSeen: 0,
      version: 1,
      linkedMysteryId: row?.linkedMysteryId || null
    };
    state.rumors = [rumor, ...(state.rumors || [])].slice(0, 40);
    writeStore();
    renderSecretsPanel();
    updateSecretsTabBadge();
    return rumor;
  }

  async function generateRumorWithAI() {
    const pos = getPos();
    if (!hasAiKey()) {
      const tpl = RUMOR_TEMPLATES[Math.floor(Math.random() * RUMOR_TEMPLATES.length)];
      return addRumor({ ...tpl, place: pos?.place });
    }
    const ctx = buildStrollAiContext();
    try {
      const raw = await aiChat(
        [
          { role: "system", content: strollAiSystemPrompt() },
          {
            role: "user",
            content:
              strollAiContextBlock(ctx) +
              `\n写一条可在街区流传的「风言风语」：半真半假，50～120字，不要结论。\n` +
              `可影射主角色或已有传闻，但要模糊。\n` +
              `输出 JSON：{ "text":"...", "source":"街角|帖子|路人|风传" }`
          }
        ],
        { temperature: 1.08, max_tokens: 320, response_format: { type: "json_object" } }
      );
      const parsed = parseJsonFromAi(raw);
      if (!parsed?.text) {
        const tpl = RUMOR_TEMPLATES[Math.floor(Math.random() * RUMOR_TEMPLATES.length)];
        return addRumor({ ...tpl, place: pos?.place });
      }
      return addRumor({ text: parsed.text, source: parsed.source, place: pos?.place });
    } catch (_) {
      const tpl = RUMOR_TEMPLATES[Math.floor(Math.random() * RUMOR_TEMPLATES.length)];
      return addRumor({ ...tpl, place: pos?.place });
    }
  }

  function maybeStrollSecretsHook(entry) {
    if (Math.random() < 0.2) {
      const tpl = RUMOR_TEMPLATES[Math.floor(Math.random() * RUMOR_TEMPLATES.length)];
      addRumor({ ...tpl, place: entry?.place || getPos()?.place });
      if (entry) {
        entry.afterText = entry.afterText ? `${entry.afterText} 也听见一点风言风语。` : "也听见一点风言风语。";
      }
    }
  }

  function maybeRefreshNearbyOnStroll() {
    if (!(state.nearby || []).length) {
      generateNearbyFallback();
      return;
    }
    if (Math.random() < 0.18) spawnStrollNearbyLocal(Math.random() < 0.28);
  }

  function strollChoiceEffectToast(effect, choice, person) {
    if (effect === "spawn_nearby" && person) return `${person.name} 出现在附近`;
    if (effect === "spawn_knows_char" && person) return `${person.name} 似乎认出了什么`;
    if (effect === "spawn_greet" && person) return `已向 ${person.name} 发消息`;
    if ((effect === "seed_rumor" || effect === "keep_item") && choice) {
      return "风言风语传开了";
    }
    if (effect === "boost_rumor") return "风言风语传开了";
    if (effect === "peek_rumor") return "传闻核实过了";
    if (choice?.label) return `你选择了：${choice.label}`;
    return "";
  }

  async function investigateRumor(rumorId) {
    const rumor = (state.rumors || []).find((r) => r.id === rumorId);
    if (!rumor || (rumor.status !== "fresh" && rumor.status !== "mutated")) return;
    rumor.status = "verified";
    rumor.investigatedAt = Date.now();
    rumor.heat = RUMOR_HEAT_START;
    rumor.strollsSeen = 0;
    const person = spawnStrollNearbyLocal(Math.random() < 0.45);
    if (person) {
      rumor.linkedNearbyId = person.id;
      rumor.afterText = `${person.name} 可能知道内情。`;
    } else {
      rumor.afterText = "线索断了，但传闻不像完全是假的。";
    }
    writeStore();
    renderSecretsPanel();
    if (typeof showToast === "function") showToast("已打听这条传闻");
  }

  function updateSecretsTabBadge() {
    if (!secretsBadge) return;
    const fresh = (state.rumors || []).filter((r) => r.status === "fresh" || r.status === "mutated").length;
    secretsBadge.textContent = fresh > 0 ? String(fresh) : "";
    secretsBadge.hidden = fresh <= 0;
  }

  function renderSecretsPanel() {
    const rumors = state.rumors || [];

    if (rumorsList) {
      rumorsList.innerHTML = rumors
        .slice(0, 20)
        .map((r) => {
          const statusLabel =
            r.status === "verified"
              ? "已打听"
              : r.status === "mutated"
                ? `变体 v${r.version || 2}`
                : r.status === "faded"
                  ? "将散"
                  : r.status === "fresh"
                    ? "未核实"
                    : String(r.status || "");
          const faded = r.status === "faded" ? " is-faded" : r.status === "mutated" ? " is-mutated" : "";
          const btn =
            r.status === "fresh" || r.status === "mutated"
              ? `<button type="button" class="roam-rumor-investigate" data-rumor-id="${escapeHtml(r.id)}">打听</button>`
              : "";
          return (
            `<article class="roam-card roam-rumor-card${faded}" role="listitem">` +
            `<div class="roam-card-head">` +
            `<span class="roam-card-tag">${escapeHtml(r.source || "风传")}</span>` +
            `<time class="roam-card-time">${formatTime(r.at)} · ${escapeHtml(statusLabel)}</time>` +
            `</div>` +
            `<p class="roam-card-text">${escapeHtml(r.text)}</p>` +
            (r.prevText ? `<p class="roam-card-after">此前：${escapeHtml(String(r.prevText).slice(0, 80))}…</p>` : "") +
            (r.afterText ? `<p class="roam-card-after">${escapeHtml(r.afterText)}</p>` : "") +
            (r.place ? `<p class="roam-card-place"><i class="ph ph-map-pin"></i>${escapeHtml(r.place)}</p>` : "") +
            btn +
            `</article>`
          );
        })
        .join("");
    }
    if (rumorsEmpty) rumorsEmpty.hidden = rumors.length > 0;
    updateSecretsTabBadge();
  }

  function parseDistanceToMeters(distStr, fallback) {
    const s = String(distStr || "").trim().toLowerCase();
    const m = s.match(/([\d.]+)\s*(km|m|公里|米)/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) {
        const unit = m[2];
        if (unit === "km" || unit === "公里") return Math.round(n * 1000);
        return Math.round(n);
      }
    }
    return fallback;
  }

  function setRoamLoading(on, text) {
    if (!roamLoading) return;
    roamLoading.hidden = !on;
    roamLoading.classList.toggle("is-busy", on);
    if (roamLoadingText && text) roamLoadingText.textContent = text;
  }

  function getAi() {
    return window.RP_AI;
  }

  function hasAiKey() {
    const ai = getAi();
    return Boolean(String(ai?.getConfig?.()?.apiKey || "").trim());
  }

  async function aiChat(messages, opts) {
    const ai = getAi();
    if (!ai?.chatCompletions) throw new Error("AI 模块未加载");
    const key = String(ai.getConfig()?.apiKey || "").trim();
    if (!key) throw new Error("请先在「我的 → 连接 API」填写 API Key");
    const o = opts && typeof opts === "object" ? opts : {};
    const payload = {
      messages,
      temperature: o.temperature != null ? o.temperature : 0.92,
      max_tokens: o.max_tokens != null ? o.max_tokens : 2048
    };
    if (o.response_format) payload.response_format = o.response_format;
    const data = await ai.chatCompletions(payload);
    const text = o.roamIm ? readRoamCompletionText(data) : readCompletionText(data);
    if (o.roamIm && !text) {
      throw new Error("模型未返回对白内容（若开了深度思考，请换模型或关思考链）");
    }
    return text;
  }

  function isCompoundChineseSurname(name) {
    return /^(欧阳|司马|上官|诸葛|令狐|皇甫|慕容|宇文|长孙|东方|独孤|南宫|西门|公孙)/.test(
      String(name || "")
    );
  }

  function looksLikeNonPersonName(name) {
    const n = String(name || "").trim();
    if (!n) return true;
    if (/[@#]|_{2,}|^\w+\d{2,}$/i.test(n)) return true;
    if (/[·•|/\\…]/.test(n)) return true;
    if (/的/.test(n) && n.length > 2) return true;
    if (
      /游客|旅人|来客|路人|神秘|未知|某位|一位|男子|女子|少年|少女|青年|老板|主理|店员|摊主|骑手|司机|保安|邻居|网友|过客|旅者|行者|患者|观察者|收藏家|爱好者|旅客|过客|游民|浪人|过客|异客|过客/.test(
        n
      )
    ) {
      return true;
    }
    if (/^(某|陌|陌生|未知|匿名|无名|神秘)/.test(n)) return true;
    const cjk = n.replace(/[^\u4e00-\u9fff]/g, "");
    if (cjk.length >= 5 && !isCompoundChineseSurname(n)) return true;
    if (cjk.length === 4 && /(?:孤独|寂寞|深海|星空|温柔|冷漠|丧系|治愈|复古|街角|深夜|凌晨|午后|旧城|迷失|失落|无名|追风|听风|看海|等雨|拾光|落雪|听潮|归途|远行|夜行|晨雾|暮色|微光|余温|旧梦|新愁)/.test(n)) {
      return true;
    }
    if (/^[A-Za-z]+$/.test(n) && /^(user|guest|traveler|tourist|stranger|unknown|admin|test|npc)/i.test(n)) {
      return true;
    }
    return false;
  }

  function isLikelyValidNearbyName(name) {
    const n = String(name || "").trim();
    if (!n || n === "路人") return false;
    if (looksLikeNonPersonName(n)) return false;
    if (/^[\u4e00-\u9fff]{2,4}$/.test(n)) return true;
    if (/^[老阿小][\u4e00-\u9fff]{1,2}$/.test(n)) return true;
    if (isCompoundChineseSurname(n) && /^[\u4e00-\u9fff]{2,5}$/.test(n)) return true;
    if (/^[A-Z][a-z]{1,14}$/.test(n)) return true;
    if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)?$/.test(n)) return true;
    if (/^[A-Za-z]{2,12}$/.test(n) && !/[_-]/.test(n)) return true;
    return false;
  }

  function pickUniqueNearbyName(usedSet, preferPet) {
    const used = usedSet instanceof Set ? usedSet : new Set();
    const fromTemplates = NEARBY_TEMPLATES.map((t) => t.name);
    const pools = preferPet
      ? [ROAM_NAME_POOL_PET, ROAM_NAME_POOL_CN, fromTemplates]
      : [ROAM_NAME_POOL_CN, ROAM_NAME_POOL_FOREIGN, ROAM_NAME_POOL_PET, fromTemplates];
    const bag = [];
    pools.forEach((p) => bag.push(...p));
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    for (const name of bag) {
      const n = String(name || "").trim();
      if (n && !used.has(n) && isLikelyValidNearbyName(n)) return n;
    }
    for (const name of ROAM_NAME_POOL_CN) {
      const alt = used.has(name) ? `${name}${used.size}` : name;
      if (!used.has(alt)) return alt.slice(0, 4);
    }
    return "林悦";
  }

  function resolveNearbyPersonName(raw, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    let name = String(raw || "").trim();
    name = name.replace(/^[\s@#~·•|/\\]+/, "").trim();
    name = name.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}]+\s*/u, "").trim();
    if (/_{2,}/.test(name) || /^\w+\d{3,}$/i.test(name)) name = "";
    if (/^[a-z0-9._-]+$/i.test(name) && /[_-]/.test(name) && !/^[A-Z][a-z]+-[A-Z][a-z]+$/.test(name)) {
      name = "";
    }
    if (name.length > 16) name = name.slice(0, 16);
    if (isLikelyValidNearbyName(name)) return name;
    const sig = String(o.signature || "").trim();
    const preferPet = Boolean(o.preferPet || /猫|狗|鸟|兽|宠物|动物|橘|爪|喵|汪/.test(sig));
    return pickUniqueNearbyName(o.usedNames, preferPet);
  }

  /** @deprecated internal alias */
  function normalizeNearbyPersonName(raw, opts) {
    return resolveNearbyPersonName(raw, opts);
  }

  function sanitizeNearbyNamesInState() {
    if (!state || !(state.nearby || []).length) return false;
    const used = new Set();
    let changed = false;
    for (const person of state.nearby) {
      if (!person) continue;
      const sig = String(person.signature || person.hint || "").trim();
      const next = resolveNearbyPersonName(person.name, { signature: sig, usedNames: used });
      used.add(next);
      if (next !== person.name) {
        person.name = next;
        changed = true;
        const thread = findThreadByNearby(person.id);
        if (thread) {
          thread.name = next;
          if (thread.personSnapshot && typeof thread.personSnapshot === "object") {
            thread.personSnapshot.name = next;
          }
        }
      }
    }
    if (changed) writeStore();
    return changed;
  }

  function nearbyFromAiRow(row, pos, index, usedNames) {
    const distanceM = parseDistanceToMeters(row.distance, 120 + index * 180 + Math.floor(Math.random() * 400));
    const bearing = Math.random() * 360;
    const point = offsetLatLng(pos.lat, pos.lng, distanceM, bearing);
    const signature = String(row.signature || row.hint || "").trim();
    const used = usedNames instanceof Set ? usedNames : new Set();
    const name = resolveNearbyPersonName(row.name, { signature, usedNames: used });
    used.add(name);
    const base = {
      id: uid(),
      name,
      hint: signature,
      signature,
      gender: String(row.gender || "other"),
      firstMessage: String(row.firstMessage || row.signature || "你好？").trim(),
      originalMessage: row.originalMessage ? String(row.originalMessage) : "",
      language: String(row.language || "Chinese"),
      lat: point.lat,
      lng: point.lng,
      distanceM,
      dist: String(row.distance || formatDistanceM(distanceM)).trim() || formatDistanceM(distanceM),
      knowsChar: Boolean(row.knowsChar),
      charLink: String(row.charLink || "").trim(),
      charLinkDetail: String(row.charLinkDetail || "").trim(),
      knownCharId: Boolean(row.knowsChar) ? String(readActiveCharPersona()?.id || "").trim() : "",
      isStub: true,
      desc: "",
      scenario: "",
      at: Date.now(),
      moveMode: "idle",
      moveSpeed: 12,
      expiresAt: null,
      lastWhisper: "",
      autoGreeted: false
    };
    return decorateNearbyMovement(base);
  }

  function demoNearbyList(pos) {
    const demos = [
      { name: "林悦", signature: "下班路过", distance: "320m", firstMessage: "你也走这条小路？", knowsChar: false },
      { name: "Marco", signature: "游客 · 找路", distance: "480m", firstMessage: "Excuse me—这边能出去吗？", knowsChar: false },
      {
        name: "苏晚",
        signature: "深夜食堂主理人",
        distance: "650m",
        firstMessage: "你朋友常提起你。",
        knowsChar: true,
        charLink: "熟人朋友",
        charLinkDetail: "在附近开过店，听说过主角色的事"
      },
      { name: "橘座", signature: "流浪猫 · 不怕生", distance: "890m", firstMessage: "喵。（它蹭了蹭你的裤脚）", knowsChar: false },
      { name: "Yuki", signature: "在找便利店", distance: "1.1km", firstMessage: "请问……这附近还有开的店吗？", knowsChar: false },
      {
        name: "顾北辰",
        signature: "吟游诗人",
        distance: "1.4km",
        firstMessage: "你们那个圈子的人，都挺有意思。",
        knowsChar: true,
        charLink: "听说过",
        charLinkDetail: "没见过面，但听过传闻"
      },
      { name: "沈星河", signature: "调酒师", distance: "210m", firstMessage: "外面风大了，别站太久。", knowsChar: false },
      { name: "老槐", signature: "树下的常客", distance: "760m", firstMessage: "……风是从那边来的。", knowsChar: false }
    ];
    return demos.map((row, i) => nearbyFromAiRow(row, pos, i, new Set()));
  }

  async function generateNearbyListWithAI() {
    const pos = getPos();
    if (!pos) return [];
    const char = readActiveCharPersona();
    const userMask = readActiveUserMask();
    const charName = String(char?.displayName || "").trim() || "Ta";
    const wb = buildRoamWorldBookContext(char, userMask);
    const charBlock = buildCharContextBlock(char, userMask);
    const hasWb = Boolean(wb && wb.trim());

    if (!hasAiKey()) {
      await new Promise((r) => window.setTimeout(r, 400));
      return demoNearbyList(pos);
    }

    const charSection = charBlock
      ? `\n\n**主角色（密谈对象，附近路人可能认识或听说过）**：\n${charBlock}\n\n` +
        `约 10% 的路人应与「${charName}」存在弱关联（同事、同学、前任、邻居、客户、粉丝、债主、rival、家人朋友等）。\n` +
        `这些人在 JSON 里标记 knowsChar:true，并填写 charLink（关系类型）与 charLinkDetail（一句话说明）。\n` +
        `firstMessage 或 signature 可间接提到 ${charName}，但要像真人随口提，不要像正式介绍。\n` +
        `其余人为普通陌生人，knowsChar:false。`
      : "";

    const wbSection = hasWb
      ? `\n\n**世界观设定（须遵守）**：\n---\n${wb}\n---\n` +
        `附近出现的可以是各种居民/生物/存在；**name** 写称呼，**signature** 写身份/物种/状态，首句可呼应设定，但不要全员同一模板。`
      : "";

    const strollCtx = buildStrollAiContext();
    const strollSection = strollCtx.recentStroll
      ? `\n\n**玩家最近闲逛（附近路人可自然呼应，勿照搬原文）**：\n${strollCtx.recentStroll}\n` +
        `当前街区：${strollCtx.place}\n`
      : `\n当前街区：${pos.place || strollCtx.place || "附近"}\n`;

    const roleDistribution = hasWb
      ? `   - 贴合世界观，混不同阶层/派系/物种/性格。\n` +
        `   - 约 35% 普通人类；约 20% 外国人或异域名字；约 15% 动物/灵兽/非人存在；约 20% 与设定或传闻有关；约 10% knowsChar。`
      : `   - 高度多样化：中国人/外国人/动物/轻微怪诞存在均可，像一条街上真能撞见的。\n` +
        `   - 约 35% 普通人类（各年龄、职业）。\n` +
        `   - 约 20% 外国人或名字明显异域的路人。\n` +
        `   - 约 15% 动物（宠物名作 name，signature 注明品种/状态；firstMessage 可拟声或主人代发）。\n` +
        `   - 约 20% 有故事感或略怪（穿缝、过于神秘，但仍像附近会遇见的）。\n` +
        `   - 约 10% knowsChar（见上，若已指定主角色）。`;

    const firstMsgGuide = hasWb
      ? `   - 像附近遇见后开口：传闻、求助、误认、随口一句；动物可用动作/拟声。\n` +
        `   - 语气词汇贴合设定，口语、可不完整。`
      : `   - 像路上/附近偶然搭话：问路、误认、随口评论；动物可蹭人、吠叫、留字条等。\n` +
        `   - 口语、可短、可带停顿，让人想回一句。`;

    const prompt =
      `为「漫游 / 附近的人」生成 8～10 个附近会出现的对象 profile。全部简体中文（firstMessage 可夹外语）。\n` +
      `核心：**活人感/活物感** + **高度随机**；这是线下附近遇见，**不是**线上社交软件的网名列表。\n` +
      charSection +
      wbSection +
      strollSection +
      `\n\n**多样性指引**：\n` +
      `1. **类型混搭**：人类/外国人/动物/非人存在均可；gender 可填男/女/其他/未知。\n` +
      `2. **称呼（name 字段）**：\n${NEARBY_NAME_GUIDE}\n` +
      `3. **首句（firstMessage）**：\n${firstMsgGuide}\n` +
      `4. **角色配比**：\n${roleDistribution}\n` +
      `\n**输出要求**：\n` +
      `- name：**仅**称呼/名字（2～3 字中文人名为主；外国名/宠物名少量即可）。职业身份写 signature，**禁止**把「游客/老板/旅人/神秘人」写进 name。\n` +
      `- firstMessage：像附近先开口的一句话（或动物的行为描述）。\n` +
      `- originalMessage：若主语言非中文，可填原文；否则 null。\n` +
      `- distance：中文距离（如 320m、1.2km）。\n` +
      `- signature：身份/物种/状态一行，不是第二网名。\n` +
      `\n严格 JSON 数组，每项字段：\n` +
      `{ "name", "gender", "distance", "signature", "firstMessage", "originalMessage"(可null), "knowsChar"(bool), "charLink", "charLinkDetail", "language" }\n` +
      `只输出 JSON 数组。`;

    const raw = await aiChat(
      [
        {
          role: "system",
          content:
            "你是 JSON 生成器。只输出合法 JSON 数组，不要解释。name 字段必须是真人名/外国名/宠物名，不能是身份描述或网名。"
        },
        { role: "user", content: prompt }
      ],
      { temperature: 1.08, max_tokens: 6000 }
    );
    const parsed = parseJsonFromAi(raw);
    if (!Array.isArray(parsed) || !parsed.length) throw new Error("AI 返回格式无效");
    const usedNames = new Set((state.nearby || []).map((p) => String(p.name || "").trim()).filter(Boolean));
    let list = parsed.slice(0, 10).map((row, i) => nearbyFromAiRow(row, pos, i, usedNames));
    list = list.sort((a, b) => Number(a.distanceM || 0) - Number(b.distanceM || 0));
    return list;
  }

  async function hydrateNearbyPersona(nearbyId) {
    const person = (state.nearby || []).find((x) => x.id === nearbyId);
    if (!person || !person.isStub) return person;
    const char = readActiveCharPersona();
    const userMask = readActiveUserMask();
    const charName = String(char?.displayName || "Ta").trim() || "Ta";
    const userName = String(userMask?.displayName || "你").trim() || "你";

    if (!hasAiKey()) {
      throw new Error("请先在「我的 → 连接 API」填写 API Key");
    }

    const prompt =
      `根据以下 stub 生成完整「附近的人」persona JSON（简体中文）：\n` +
      `name: ${person.name}\n` +
      `signature: ${person.signature || person.hint}\n` +
      `firstMessage: ${person.firstMessage}\n` +
      `knowsChar: ${person.knowsChar}\n` +
      `charLink: ${person.charLink || "无"}\n` +
      `charLinkDetail: ${person.charLinkDetail || "无"}\n` +
      `主角色 ${charName} 信息：\n${buildCharContextBlock(char, userMask).slice(0, 1500)}\n\n` +
      `输出 JSON：{ "desc": "…", "scenario": "…" }\n\n` +
      `**desc 必须包含以下四段（用标题分行）：**\n` +
      `1. 基本信息（姓名/称呼、物种或身份、年龄感、背景；若是动物或非人类须写清）\n` +
      `2. 性格特点（含缺点、矛盾、坏情绪，不要只有「善良友好」）\n` +
      `3. 说话风格（须具体：句式、口头禅、语气、emoji/标点习惯、打字快慢感）\n` +
      `4. 行为习惯（小动作、怪癖、生活细节）\n\n` +
      `**scenario**：与「${userName}」在漫游 App「附近的人」临时 IM 会话中的关系定位与开场语境（线上打字，不是街头偶遇）。\n` +
      `若 knowsChar 为 true，desc/scenario 须自然体现与 ${charName} 的弱关联。\n` +
      `角色要有棱有角、说话有辨识度。只输出 JSON。`;

    const raw = await aiChat(
      [
        { role: "system", content: "你是 JSON 生成器。" },
        { role: "user", content: prompt }
      ],
      { temperature: 0.75, max_tokens: 2200, response_format: { type: "json_object" } }
    );
    const parsed = parseJsonFromAi(raw);
    if (parsed && typeof parsed === "object") {
      person.desc = String(parsed.desc || person.signature || "").trim();
      person.scenario = String(parsed.scenario || "").trim();
    }
    person.isStub = false;
    writeStore();
    const thread = findThreadByNearby(nearbyId);
    if (thread) {
      syncThreadPersonSnapshot(thread, person);
      upsertThread(thread);
    }
    return person;
  }

  function threadHasStrangerSpeech(thread) {
    return (thread?.messages || []).some((m) => {
      if (m.role !== "stranger") return false;
      return Boolean(normalizeRoamNarration(m.narration) || String(m.text || "").trim());
    });
  }

  function pushStrangerReplyToThread(thread, reply) {
    if (!reply) return false;
    const lineParts = pickRoamSpeechLines(
      reply.lines?.length
        ? reply.lines
        : String(reply.text || "")
            .split("|||")
            .map((s) => s.trim())
            .filter(Boolean)
    );
    const nar = normalizeRoamNarration(reply.narration);
    if (!lineParts.length && !nar) return false;
    thread.messages.push({
      id: uid(),
      role: "stranger",
      text: lineParts.join("|||"),
      lines: lineParts,
      narration: reply.narration || "",
      at: Date.now()
    });
    thread.preview = lineParts[0] || String(reply.narration || "").slice(0, 48) || "…";
    thread.updatedAt = Date.now();
    return true;
  }

  function markThreadExited(thread, person, note) {
    if (!thread || thread.exited) return;
    thread.exited = true;
    const tail = String(note || "").trim();
    thread.messages.push({
      id: uid(),
      role: "system",
      text: tail ? `${person.name} 离开了附近 · ${tail}` : `${person.name} 离开了附近`,
      at: Date.now()
    });
    if (charFight?.active && charFight.threadId === thread.id) void stopCharFight();
  }

  function applyInboundFriendRequest(thread, person, note) {
    const meta = friendMetaFrom(person, thread);
    if (meta.friendStatus === "friend") return;
    thread.inboundFriendRequest = {
      note: String(note || "").trim().slice(0, 120),
      at: Date.now(),
      from: person.name
    };
    writeStore();
    syncInboundFriendBanner(thread, person);
    if (typeof showToast === "function") showToast(`${person.name} 想加你为好友`);
  }

  function applyStrangerSideEffects(thread, person, reply) {
    if (!thread || !person || !reply) return;
    const meta = friendMetaFrom(person, thread);
    const lines = Array.isArray(reply.lines) ? reply.lines : [];
    const narration = reply.narration || "";

    if (meta.friendStatus !== "friend") {
      const speechIntent = inferFriendSpeechIntent(lines, narration);
      const pendingOutbound = threadHasPendingOutboundFriendRequest(thread);
      const outboundAccept =
        pendingOutbound && inferFriendDecisionFromSpeech(lines, narration)?.accepted;
      if (reply.friendRequest || speechIntent?.kind === "inbound") {
        applyInboundFriendRequest(thread, person, reply.friendRequestNote);
      } else if (speechIntent?.kind === "mutual" || outboundAccept) {
        applyVerbalFriendAcceptance(thread, person, { fromOutbound: pendingOutbound });
      }
    }

    if (reply.exited || reply.endChat) {
      markThreadExited(thread, person, reply.exitNote);
    }
  }

  async function generateStrangerOpening(person) {
    const hint = String(person.firstMessage || person.signature || "主动搭讪").trim();
    const userMask = readActiveUserMask();
    const userName = String(userMask?.displayName || "你").trim() || "你";
    const raw = await aiChat(
      [
        { role: "system", content: buildStrangerSystemPrompt(person) },
        {
          role: "user",
          content:
            `（界面代发、勿复述：${person.name} 通过漫游「附近的人」向「${userName}」发来第一条 IM 消息。` +
            `可参考意图「${hint.slice(0, 120)}」，不必照抄 firstMessage。` +
            `输出旁白 narration + 对白 lines 的 JSON 开场；不要 endChat，不要 friendRequest。）`
        }
      ],
      { temperature: 0.92, max_tokens: 2048, response_format: { type: "json_object" }, roamIm: true }
    );
    let reply = await resolveRoamStrangerReply(raw);
    if (!reply) {
      const raw2 = await aiChat(
        [
          { role: "system", content: buildStrangerSystemPrompt(person) },
          {
            role: "user",
            content:
              `（界面代发：${person.name} 向「${userName}」发来第一条 IM。` +
              `参考「${hint.slice(0, 120)}」。` +
              `只输出 JSON：{"lines":["…"],"narration":"…"}，不要 markdown，不要解释。）`
          }
        ],
        { temperature: 0.75, max_tokens: 2048, response_format: { type: "json_object" }, roamIm: true }
      );
      reply = await resolveRoamStrangerReply(raw2);
    }
    if (!reply) {
      throw new Error("开场格式无效，请关闭后重新打开或重试");
    }
    reply.endChat = false;
    reply.exited = false;
    reply.friendRequest = false;
    return reply;
  }

  async function ensureThreadOpening(threadId, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const thread = findThread(threadId);
    if (!thread || thread.exited) return false;
    if (!thread.awaitingOpening && threadHasStrangerSpeech(thread)) return false;
    if (openingInflight.has(threadId)) return false;
    if (!hasAiKey()) {
      if (!o.quiet && typeof showToast === "function") {
        showToast("请先在「我的 → 连接 API」填写 API Key");
      }
      return false;
    }

    const person = resolveThreadPerson(thread);
    if (!person) {
      if (!o.quiet && typeof showToast === "function") showToast("找不到对话对象");
      return false;
    }

    openingInflight.add(threadId);
    if (!o.quiet) setRoamLoading(true, "对方正在开口…");
    try {
      if (person.isStub) await hydrateNearbyPersona(person.id);
      const live = resolveThreadPerson(thread) || person;
      const reply = await generateStrangerOpening(live);
      if (!pushStrangerReplyToThread(thread, reply)) return false;
      thread.awaitingOpening = false;
      if (o.markUnread) thread.unread = Math.max(Number(thread.unread) || 0, 1);
      applyStrangerSideEffects(thread, live, reply);
      upsertThread(thread);
      if (activeThreadId === threadId) {
        renderChatMessages(thread);
        syncChatPersonSub(live);
        syncInboundFriendBanner(thread, live);
        if (roamChatInput) roamChatInput.disabled = Boolean(thread.exited);
        if (roamChatSend) roamChatSend.disabled = Boolean(thread.exited);
      }
      renderMsgList();
      queueMapRender();
      return true;
    } catch (err) {
      if (!o.quiet && typeof showToast === "function") {
        showToast(String(err?.message || err || "开场失败"));
      }
      return false;
    } finally {
      openingInflight.delete(threadId);
      if (!o.quiet) setRoamLoading(false);
    }
  }

  function findNearby(id) {
    return (state.nearby || []).find((x) => x.id === id) || null;
  }

  function snapshotNearbyPerson(person) {
    if (!person) return null;
    return {
      id: person.id,
      name: person.name,
      signature: person.signature,
      hint: person.hint,
      desc: person.desc,
      scenario: person.scenario,
      firstMessage: person.firstMessage,
      language: person.language,
      originalMessage: person.originalMessage,
      knowsChar: person.knowsChar,
      charLink: person.charLink,
      charLinkDetail: person.charLinkDetail,
      knownCharId: person.knownCharId,
      isStub: person.isStub,
      isFriend: person.isFriend,
      dist: person.dist
    };
  }

  function syncThreadPersonSnapshot(thread, person) {
    if (!thread || !person) return;
    thread.personSnapshot = snapshotNearbyPerson(person);
    thread.name = person.name || thread.name;
  }

  function resolveThreadPerson(thread) {
    if (!thread) return null;
    const live = findNearby(thread.nearbyId);
    const snap = thread.personSnapshot && typeof thread.personSnapshot === "object" ? thread.personSnapshot : null;
    if (live) {
      return {
        ...(snap || {}),
        ...live,
        desc: String(live.desc || snap?.desc || "").trim(),
        scenario: String(live.scenario || snap?.scenario || "").trim(),
        isStub: live.isStub
      };
    }
    return snap;
  }

  function findThread(id) {
    return (state.threads || []).find((x) => x.id === id) || null;
  }

  function findThreadByNearby(nearbyId) {
    return (state.threads || []).find((x) => x.nearbyId === nearbyId) || null;
  }

  function upsertThread(thread) {
    const list = state.threads || [];
    const i = list.findIndex((x) => x.id === thread.id);
    if (i >= 0) list[i] = thread;
    else list.unshift(thread);
    state.threads = list;
    writeStore();
  }

  function createThreadFromNearby(person, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    let thread = findThreadByNearby(person.id);
    if (thread) return thread;
    thread = {
      id: uid(),
      nearbyId: person.id,
      name: person.name,
      preview: person.firstMessage || "…",
      unread: 0,
      exited: false,
      messages: [],
      updatedAt: Date.now()
    };
    if (o.withGreeting) {
      thread.awaitingOpening = true;
      thread.preview = "…";
      if (o.markUnread) thread.unread = 1;
    }
    syncThreadPersonSnapshot(thread, person);
    upsertThread(thread);
    return thread;
  }

  function syncChatForeignToggle(person) {
    let el = document.getElementById("roam-chat-foreign");
    if (!roamChat || !person) {
      if (el) el.hidden = true;
      return;
    }
    const orig = String(person.originalMessage || "").trim();
    const lang = String(person.language || "").trim();
    const show = orig && !/^chinese|中文|汉语$/i.test(lang);
    if (!el) {
      el = document.createElement("button");
      el.type = "button";
      el.id = "roam-chat-foreign";
      el.className = "roam-chat-foreign";
      el.hidden = true;
      roamChat.querySelector(".roam-chat-head")?.appendChild(el);
      el.addEventListener("click", () => {
        const p = activeThreadId ? findNearby(findThread(activeThreadId)?.nearbyId) : null;
        if (!p?.originalMessage) return;
        el.dataset.showOrig = el.dataset.showOrig === "1" ? "0" : "1";
        el.textContent = el.dataset.showOrig === "1" ? "看译文" : "看原文";
        syncChatPersonSub(p);
      });
    }
    el.hidden = !show;
    el.dataset.showOrig = el.dataset.showOrig || "0";
    el.textContent = el.dataset.showOrig === "1" ? "看译文" : "看原文";
  }

  function syncChatPersonSub(person) {
    if (!roamChatSub || !person) return;
    const char = readActiveCharPersona();
    const parts = [];
    if (person.dist) parts.push(String(person.dist));
    const moveLab = nearbyMoveStatusLabel(person);
    if (moveLab) parts.push(moveLab);
    if (person.knowsChar) {
      parts.push(`识${String(char?.displayName || "Ta").slice(0, 1)}`);
    }
    const sig = String(person.signature || person.hint || "").trim();
    const desc = String(person.desc || "").trim();
    if (desc) parts.push(desc.slice(0, 36) + (desc.length > 36 ? "…" : ""));
    else if (sig) parts.push(sig);
    const foreignBtn = document.getElementById("roam-chat-foreign");
    const showOrig = foreignBtn && foreignBtn.dataset.showOrig === "1";
    const orig = String(person.originalMessage || "").trim();
    if (showOrig && orig) {
      roamChatSub.textContent = orig.slice(0, 120);
      roamChatSub.title = `${sig}\n${orig}`;
      return;
    }
    roamChatSub.textContent = parts.join(" · ") || "附近路人";
    roamChatSub.title = desc ? `${sig ? sig + "\n" : ""}${desc}` : sig || "";
  }

  function scheduleAutoGreetings() {
    const list = (state.nearby || []).slice();
    if (!list.length) return;
    let sent = 0;
    list.forEach((person) => {
      if (sent >= 2) return;
      if (Math.random() > 0.32) return;
      if (findThreadByNearby(person.id)) return;
      sent += 1;
      const delay = 2000 + Math.floor(Math.random() * 5000);
      window.setTimeout(() => {
        if (!state) return;
        const p = findNearby(person.id);
        if (!p || findThreadByNearby(p.id)) return;
        const thread = createThreadFromNearby(p, { withGreeting: true, markUnread: true });
        void ensureThreadOpening(thread.id, { markUnread: true, quiet: true });
        renderMsgList();
        queueMapRender();
        if (typeof showToast === "function") showToast(`${p.name} 给你发了消息`);
      }, delay);
    });
  }

  async function generateNearbyAsync(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const pos = getPos();
    if (!pos || nearbyGenerating) return false;
    nearbyGenerating = true;
    if (!o.quiet) {
      refreshNearbyBtn?.classList.add("is-busy");
      setRoamLoading(true, "正在搜索附近…");
    }
    try {
      const list = await generateNearbyListWithAI();
      list.sort((a, b) => a.distanceM - b.distanceM);
      state.nearby = list;
      writeStore();
      queueMapRender();
      renderNearbyList();
      scheduleAutoGreetings();
      if (!o.quiet && typeof showToast === "function") showToast(`附近 ${list.length} 人`);
      return true;
    } catch (err) {
      if (generateNearbyFallback()) {
        scheduleAutoGreetings();
        renderNearbyList();
        if (!o.quiet && typeof showToast === "function") showToast("网络异常，已加载示例路人");
      } else if (!o.quiet && typeof showToast === "function") {
        showToast(String(err?.message || err || "生成失败"));
      }
      return false;
    } finally {
      nearbyGenerating = false;
      refreshNearbyBtn?.classList.remove("is-busy");
      if (!o.quiet) setRoamLoading(false);
    }
  }

  function roamMsgToApiText(m) {
    if (!m) return "";
    // 出马气泡对路人 API 与 user 相同：对方只以为主控在打字
    if (m.role === "char_proxy") {
      return String(m.text || "").trim();
    }
    const lines =
      Array.isArray(m.lines) && m.lines.length
        ? m.lines.map((s) => String(s).trim()).filter(Boolean)
        : String(m.text || "")
            .split("|||")
            .map((s) => s.trim())
            .filter(Boolean);
    const speech = lines.join("\n");
    const nar = String(m.narration || "").trim();
    if (nar && speech) return `（旁白）${nar}\n（对白）${speech}`;
    if (nar) return `（旁白）${nar}`;
    return speech;
  }

  function appendRoamEmptySendTail(history) {
    const last = history.length ? history[history.length - 1] : null;
    if (!last) {
      history.push({ role: "user", content: ROAM_EMPTY_OPENING });
    } else if (last.role === "assistant") {
      history.push({ role: "user", content: ROAM_EMPTY_AFTER_ASSISTANT });
    }
  }

  function normalizeRoamNarration(s) {
    const t = String(s || "").trim();
    if (!t || t === "-") return "";
    return t;
  }

  function parseRoamStrangerPayload(raw) {
    let text = String(raw || "").trim();
    let exited = false;
    let exitNote = "";
    const exitM = text.match(/\[EXIT:([^:\]]+)(?::([^\]]*))?\]/i);
    if (exitM) {
      exited = true;
      exitNote = String(exitM[2] || exitM[1] || "").trim();
      text = text.replace(exitM[0], "").trim();
    }

    const parsed = parseJsonFromAi(text);
    if (Array.isArray(parsed)) {
      const lineParts = parsed.map((x) => String(x).trim()).filter(Boolean);
      if (lineParts.length) {
        return finalizeRoamReply({
          text: lineParts.join("|||"),
          lines: lineParts,
          narration: "",
          exited,
          exitNote,
          endChat: exited,
          friendRequest: false,
          friendRequestNote: "",
          fromJson: true
        });
      }
    }
    if (parsed && typeof parsed === "object") {
      const pick = (arr) =>
        Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : [];
      let lineParts = pick(parsed.lines);
      if (!lineParts.length) lineParts = pick(parsed.replies);
      if (!lineParts.length && typeof parsed.reply === "string" && parsed.reply.trim()) {
        lineParts = [parsed.reply.trim()];
      }
      if (!lineParts.length && typeof parsed.message === "string" && parsed.message.trim()) {
        lineParts = [parsed.message.trim()];
      }
      if (!lineParts.length && typeof parsed.content === "string" && parsed.content.trim()) {
        lineParts = [parsed.content.trim()];
      }
      if (!lineParts.length && typeof parsed.text === "string" && parsed.text.trim()) {
        lineParts = [parsed.text.trim()];
      }
      const narration = normalizeRoamNarration(parsed.narration);
      const endChat =
        parsed.endChat === true ||
        parsed.exitChat === true ||
        /^true$/i.test(String(parsed.endChat || parsed.exitChat || ""));
      const friendRequest =
        parsed.friendRequest === true ||
        parsed.addFriend === true ||
        parsed.requestFriend === true ||
        /^true$|^1$|^yes$/i.test(String(parsed.friendRequest || parsed.addFriend || ""));
      const friendRequestNote = String(
        parsed.friendRequestNote || parsed.friendNote || parsed.friendRequestMsg || ""
      ).trim();
      if (endChat) {
        exited = true;
        const jsonNote = String(parsed.exitNote || parsed.exitReason || "").trim();
        if (jsonNote) exitNote = jsonNote;
      }
      const joined = lineParts.join("|||");
      if (joined || narration || endChat || friendRequest) {
        return finalizeRoamReply({
          text: joined,
          lines: lineParts,
          narration,
          exited,
          exitNote,
          endChat,
          friendRequest,
          friendRequestNote,
          fromJson: true
        });
      }
    }

    if (!text && exitNote) text = exitNote;
    const lineParts = text
      ? text
          .split("|||")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return finalizeRoamReply({
      text: lineParts.join("|||") || text,
      lines: lineParts.length ? lineParts : text ? [text] : [],
      narration: "",
      exited,
      exitNote,
      endChat: exited,
      friendRequest: false,
      friendRequestNote: "",
      fromJson: false
    });
  }

  function formatRoamNarrationHtml(raw) {
    const s = String(raw || "");
    const re = /\*([^*]+)\*/g;
    let last = 0;
    let html = "";
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) html += escapeHtml(s.slice(last, m.index));
      html += `<em class="roam-chat-narration-em">${escapeHtml(m[1])}</em>`;
      last = m.index + m[0].length;
    }
    if (last < s.length) html += escapeHtml(s.slice(last));
    return html;
  }

  function buildStrangerSystemPrompt(person) {
    const char = readActiveCharPersona();
    const userMask = readActiveUserMask();
    const charName = String(char?.displayName || "Ta").trim() || "Ta";
    const userName = String(userMask?.displayName || "你").trim() || "你";
    const wb = buildRoamWorldBookContext(char, userMask);
    const name = String(person.name || "路人").trim() || "路人";

    const lines = [
      `[你是谁 · 活人感优先]`,
      `你是「${name}」。你和「${userName}」是在 **线上聊天**（漫游 App「附近的人」临时会话），各自在屏幕两端打字——不是街头同场偶遇，也不是舞台剧台词腔。`,
      `这是附近陌生人 IM：保持陌生感与边界；熟了可以放松，但不要一上来就像多年老友。`,
      buildRoamImLivelinessBlock(name, userName),
      buildStrangerPersonaBlock(person, userName),
      buildUserMaskPromptBlock(userMask, userName)
    ];

    if (person.knowsChar) {
      lines.push(
        `[与主角色的弱关联]`,
        `你认识或听说过主角色「${charName}」（关系：${person.charLink || "间接认识"}）。`,
        `细节：${person.charLinkDetail || "只是听说过一些事"}`,
        `可以偶尔提到 ${charName}，但要像真人打字随口提，不要像汇报。`
      );
    }
    if (person.isFriend) {
      lines.push(`你与 ${userName} 已是漫游好友，说话可以熟一点，能提以前聊过的事。`);
    }
    const recentRumors = (state.rumors || [])
      .filter((r) => r.status === "fresh" || r.status === "mutated")
      .slice(0, 2)
      .map((r) => r.text);
    if (recentRumors.length) {
      lines.push(`街区最近在传（可自然提及，勿照搬）：\n${recentRumors.map((t) => `- ${t}`).join("\n")}`);
    }
    const strollCtx = buildStrollAiContext();
    if (strollCtx.recentStroll) {
      lines.push(
        `对方（${userName}）最近在附近闲逛时遇到过一些事，聊天时可自然呼应，不要生硬复述：\n${strollCtx.recentStroll.slice(0, 900)}`
      );
    }
    if (wb) lines.push(`[世界观]\n${wb}`);

    lines.push(
      buildRoamNarratorImBlock(name, userName),
      buildRoamImThinkingBlock(name, userName),
      buildRoamImOutputProtocol(name)
    );

    return lines.filter(Boolean).join("\n\n");
  }

  function looksLikeBrokenRoamJsonText(s) {
    const t = String(s || "").trim();
    if (!t) return false;
    if (
      (/^\s*[\[{]/.test(t) && /"(?:lines|narration|thinking)"\s*:/i.test(t)) ||
      (/^```/.test(t) && t.includes("lines"))
    ) {
      return true;
    }
    if (/^\s*\[\s*"/.test(t) && /"\s*\]/.test(t)) {
      try {
        const arr = JSON.parse(t);
        return Array.isArray(arr);
      } catch {
        return true;
      }
    }
    return false;
  }

  /** 把误输出的 JSON 数组字符串拆成多条对白。 */
  function pickRoamSpeechLines(rawLines) {
    const out = [];
    const src = Array.isArray(rawLines) ? rawLines : [];
    for (const item of src) {
      const t = String(item || "").trim();
      if (!t) continue;
      if (/^\s*\[/.test(t)) {
        try {
          const arr = parseJsonFromAi(t);
          if (Array.isArray(arr) && arr.length) {
            arr.forEach((x) => {
              const s = String(x).trim();
              if (s && !looksLikeBrokenRoamJsonText(s)) out.push(s);
            });
            continue;
          }
        } catch {
          /* fall through */
        }
      }
      if (!looksLikeBrokenRoamJsonText(t)) out.push(t);
    }
    return out.slice(0, 6);
  }

  function finalizeRoamReply(reply) {
    if (!reply || typeof reply !== "object") return reply;
    const fromLines = reply.lines?.length
      ? reply.lines
      : String(reply.text || "")
          .split("|||")
          .map((s) => s.trim())
          .filter(Boolean);
    const lines = pickRoamSpeechLines(fromLines);
    reply.lines = lines;
    reply.text = lines.join("|||");
    return reply;
  }

  function coercePlainTextRoamReply(raw) {
    let text = String(raw || "").trim();
    if (!text || looksLikeBrokenRoamJsonText(text)) return null;
    text = text.replace(/^```(?:json)?\s*/gi, "").replace(/```\s*$/g, "").trim();
    if (!text || looksLikeBrokenRoamJsonText(text)) return null;
    let narration = "";
    const narBits = [];
    text = text
      .replace(/\*([^*\n]{2,240})\*/g, (_, g) => {
        narBits.push(String(g).trim());
        return "";
      })
      .trim();
    if (narBits.length) narration = narBits.join(" ");
    const lineParts = text
      .split(/\n+|(?:\|\|\|)/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
    if (!lineParts.length && !narration) return null;
    return {
      text: lineParts.join("|||"),
      lines: lineParts,
      narration,
      exited: false,
      exitNote: "",
      endChat: false,
      friendRequest: false,
      friendRequestNote: "",
      fromJson: false
    };
  }

  function salvageRoamJsonFromText(raw) {
    const text = String(raw || "").trim();
    if (!text) return null;
    let parsed = parseJsonFromAi(text);
    if (!parsed || typeof parsed !== "object") {
      const fo = text.indexOf("{");
      if (fo >= 0) {
        let slice = text.slice(fo).replace(/```/g, "").trim();
        if (!slice.endsWith("}")) slice += "}";
        try {
          parsed = JSON.parse(slice);
        } catch {
          parsed = null;
        }
      }
    }
    if (parsed && typeof parsed === "object") {
      const reply = parseRoamStrangerPayload(JSON.stringify(parsed));
      if (isRoamReplyDisplayable(reply)) return reply;
    }
    const linesMatch = text.match(/"lines"\s*:\s*\[([\s\S]*?)\]/i);
    if (linesMatch) {
      try {
        const arr = JSON.parse(`[${linesMatch[1]}]`);
        if (Array.isArray(arr) && arr.length) {
          const lineParts = arr.map((x) => String(x).trim()).filter(Boolean);
          let narration = "";
          const narMatch = text.match(/"narration"\s*:\s*"((?:\\.|[^"\\])*)"/i);
          if (narMatch) {
            try {
              narration = JSON.parse(`"${narMatch[1]}"`);
            } catch {
              narration = narMatch[1];
            }
          }
          const reply = parseRoamStrangerPayload(
            JSON.stringify({ lines: lineParts, narration: narration || "-" })
          );
          if (isRoamReplyDisplayable(reply)) return reply;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  async function resolveRoamStrangerReply(raw) {
    let reply = parseRoamStrangerPayload(raw);
    if (isRoamReplyDisplayable(reply)) return finalizeRoamReply(reply);
    const repaired = await tryRepairRoamStrangerPayload(raw);
    if (repaired && isRoamReplyDisplayable(repaired)) return finalizeRoamReply(repaired);
    reply = salvageRoamJsonFromText(raw);
    if (isRoamReplyDisplayable(reply)) return finalizeRoamReply(reply);
    reply = coercePlainTextRoamReply(raw);
    if (isRoamReplyDisplayable(reply)) return finalizeRoamReply(reply);
    return null;
  }

  function isRoamReplyDisplayable(reply) {
    if (!reply || typeof reply !== "object") return false;
    const lines = Array.isArray(reply.lines) ? reply.lines : [];
    const hasSpeech = lines.some((l) => {
      const t = String(l || "").trim();
      return t && !looksLikeBrokenRoamJsonText(t);
    });
    const hasNar = Boolean(normalizeRoamNarration(reply.narration));
    return hasSpeech || hasNar || reply.endChat || reply.friendRequest;
  }

  async function tryRepairRoamStrangerPayload(raw) {
    const snippet = String(raw || "").trim().slice(0, 4500);
    if (!snippet || snippet.length < 4) return null;
    if (!/"(?:lines|narration|reply|replies)"\s*:/i.test(snippet) && !/^\s*[\[{]/.test(snippet)) {
      return null;
    }
    try {
      const repRaw = await aiChat(
        [
          {
            role: "system",
            content:
              "你是 JSON 修复器。只输出一个合法 JSON 对象，不要 markdown 代码块，不要解释。"
          },
          {
            role: "user",
            content:
              `以下模型回复格式损坏、被 markdown 包裹或缺字段。请修复为漫游 IM 聊天 JSON。\n\n` +
              `原文：\n${snippet}\n\n` +
              `必须包含：\n` +
              `- lines: string[]（1～4 条短气泡对白）\n` +
              `- narration: string（旁白；无则 "-"）\n` +
              `可选：thinking, endChat, exitNote, friendRequest, friendRequestNote\n` +
              `只输出 JSON。`
          }
        ],
        { temperature: 0.15, max_tokens: 1400, response_format: { type: "json_object" }, roamIm: true }
      );
      const repaired = parseRoamStrangerPayload(repRaw);
      return isRoamReplyDisplayable(repaired) ? repaired : null;
    } catch {
      return null;
    }
  }

  function findLastStrangerMsgIndex(thread) {
    const msgs = thread?.messages || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]?.role === "stranger") return i;
    }
    return -1;
  }

  function threadLastBubbleIsStranger(thread) {
    const msgs = thread?.messages || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (!m || m.role === "system") continue;
      return m.role === "stranger";
    }
    return false;
  }

  function closeRoamMsgSwipeRows(exceptId) {
    if (!msgList) return;
    msgList.querySelectorAll(".roam-msg-swipe.is-open").forEach((el) => {
      if (exceptId && el instanceof HTMLElement && el.dataset.threadId === exceptId) return;
      el.classList.remove("is-open");
      el.querySelector(".roam-msg-swipe-main")?.style.removeProperty("transform");
    });
    if (!exceptId) roamMsgSwipeOpenId = null;
  }

  function deleteRoamThread(threadId) {
    const id = String(threadId || "").trim();
    if (!id || !findThread(id)) return;
    if (charFight?.active && charFight.threadId === id) void stopCharFight();
    if (activeThreadId === id) closeChatPanel();
    state.threads = (state.threads || []).filter((t) => t.id !== id);
    if (roamMsgSwipeOpenId === id) roamMsgSwipeOpenId = null;
    writeStore();
    renderMsgList();
    if (typeof showToast === "function") showToast("已删除临时对话");
  }

  function openRoamSendChoiceDialog() {
    if (!roamSendChoice) return;
    roamSendChoice.hidden = false;
    roamSendChoice.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => roamSendChoiceContinue?.focus());
  }

  function closeRoamSendChoiceDialog() {
    if (!roamSendChoice) return;
    roamSendChoice.hidden = true;
    roamSendChoice.setAttribute("aria-hidden", "true");
  }

  function popLastStrangerTurn(thread) {
    const idx = findLastStrangerMsgIndex(thread);
    if (idx < 0) return null;
    const removed = thread.messages[idx];
    thread.messages.splice(idx, 1);
    if (thread.exited) {
      thread.exited = false;
      const last = thread.messages[thread.messages.length - 1];
      if (last?.role === "system" && String(last.text || "").includes("离开了附近")) {
        thread.messages.pop();
      }
    }
    thread.inboundFriendRequest = null;
    let preview = "…";
    for (let i = thread.messages.length - 1; i >= 0; i--) {
      const m = thread.messages[i];
      if (!m || m.role === "system") continue;
      if (m.role === "user" || m.role === "char_proxy") {
        preview = String(m.text || "").slice(0, 48) || "…";
        break;
      }
      if (m.role === "stranger") {
        const lp = Array.isArray(m.lines) && m.lines.length ? m.lines[0] : m.text;
        preview = String(lp || m.narration || "…").slice(0, 48);
        break;
      }
    }
    thread.preview = preview;
    return removed;
  }

  async function callStrangerAI(thread, person, opts) {
    if (!hasAiKey()) throw new Error("请先在「我的 → 连接 API」填写 API Key");
    const o = opts && typeof opts === "object" ? opts : {};
    let history = (thread.messages || [])
      .filter((m) => m.role !== "system")
      .slice(-20)
      .map((m) => ({
        role: m.role === "user" || m.role === "char_proxy" ? "user" : "assistant",
        content: roamMsgToApiText(m)
      }))
      .filter((m) => String(m.content || "").trim());
    if (o.emptySend) appendRoamEmptySendTail(history);

    const sys = buildStrangerSystemPrompt(person);
    const baseMsgs = [{ role: "system", content: sys }, ...history];
    const chatOpts = {
      temperature: 0.88,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      roamIm: true
    };

    let raw = await aiChat(baseMsgs, chatOpts);
    let reply = await resolveRoamStrangerReply(raw);

    if (!reply) {
      raw = await aiChat(
        [
          ...baseMsgs,
          {
            role: "user",
            content:
              "（系统：上一轮输出不是合法 JSON 或缺少 lines/narration。请严格只输出一个 JSON 对象，必填 lines 与 narration，不要 markdown 代码块与前后说明。）"
          }
        ],
        { ...chatOpts, temperature: 0.72 }
      );
      reply = await resolveRoamStrangerReply(raw);
    }
    if (!reply) {
      raw = await aiChat(baseMsgs, { temperature: 0.88, max_tokens: 2048, roamIm: true });
      reply = await resolveRoamStrangerReply(raw);
    }
    if (!reply) {
      throw new Error("回复格式无效，请点「重 roll」再试");
    }
    return reply;
  }

  function renderChatMessages(thread) {
    if (!roamChatMsgs || !thread) return;
    roamChatMsgs.innerHTML = (thread.messages || [])
      .map((m) => {
        if (m.role === "system") {
          return `<div class="roam-chat-system">${escapeHtml(m.text)}</div>`;
        }
        const mine = m.role === "user";
        const proxy = m.role === "char_proxy";
        const stranger = m.role === "stranger";
        const lineParts = stranger
          ? pickRoamSpeechLines(
              Array.isArray(m.lines) && m.lines.length
                ? m.lines
                : String(m.text || "")
                    .split("|||")
                    .map((s) => s.trim())
                    .filter(Boolean)
            )
          : Array.isArray(m.lines) && m.lines.length
            ? m.lines.map((s) => String(s).trim()).filter(Boolean)
            : String(m.text || "")
                .split("|||")
                .map((s) => s.trim())
                .filter(Boolean);
        const nar = stranger ? normalizeRoamNarration(m.narration) : "";
        const narHtml = nar
          ? `<div class="roam-chat-narration">${formatRoamNarrationHtml(nar)}</div>`
          : "";
        const bubbles = (lineParts.length ? lineParts : [String(m.text || "").trim() || "…"])
          .map(
            (line) =>
              `<div class="roam-chat-bubble${mine ? " is-mine" : ""}${proxy ? " is-proxy" : ""}">` +
              (proxy ? `<span class="roam-chat-proxy-tag">${escapeHtml(m.charName || "出马")} · 代聊</span>` : "") +
              `<p>${escapeHtml(line)}</p>` +
              `<time>${formatTime(m.at)}</time>` +
              `</div>`
          )
          .join("");
        if (stranger && (narHtml || lineParts.length)) {
          return `<div class="roam-chat-turn">${narHtml}${bubbles}</div>`;
        }
        return bubbles;
      })
      .join("");
    roamChatMsgs.scrollTop = roamChatMsgs.scrollHeight;
  }

  function openChatPanel(threadId) {
    activeThreadId = threadId;
    const thread = findThread(threadId);
    const person = thread ? resolveThreadPerson(thread) : null;
    if (!thread || !person || !roamChat) return;
    ensurePersonSocial(person);
    recoverStaleFriendPending(thread, person);
    thread.unread = 0;
    upsertThread(thread);
    roamChat.hidden = false;
    roamChat.classList.add("is-open");
    if (roamChatTitle) roamChatTitle.textContent = person.name;
    syncChatPersonSub(person);
    syncChatForeignToggle(person);
    renderChatMessages(thread);
    renderMsgList();
    if (roamChatInput) {
      roamChatInput.disabled = Boolean(thread.exited);
      roamChatInput.focus();
    }
    if (roamChatSend) roamChatSend.disabled = Boolean(thread.exited);
    syncChatFriendBtn(person);
    syncInboundFriendBanner(thread, person);
    syncCharFightUi();
    queueMapRender();
  }

  function closeChatPanel() {
    if (charFight?.active) void stopCharFight();
    activeThreadId = null;
    if (roamChat) {
      roamChat.hidden = true;
      roamChat.classList.remove("is-open");
    }
    queueMapRender();
  }

  async function openChatWithThread(threadId) {
    const thread = findThread(threadId);
    if (!thread) return;
    const person = resolveThreadPerson(thread);
    if (!person) {
      if (typeof showToast === "function") showToast("此人已不在附近");
      return;
    }
    setRoamLoading(true, "正在连接…");
    try {
      await hydrateNearbyPersona(thread.nearbyId);
      openChatPanel(threadId);
      await ensureThreadOpening(threadId, { quiet: false });
    } catch (err) {
      if (typeof showToast === "function") showToast(String(err?.message || err || "打开失败"));
    } finally {
      setRoamLoading(false);
    }
  }

  async function openChatWithNearby(nearbyId) {
    let person = findNearby(nearbyId);
    if (!person) return;
    setRoamLoading(true, "正在连接…");
    try {
      person = await hydrateNearbyPersona(nearbyId);
      let thread = findThreadByNearby(nearbyId);
      if (!thread) {
        thread = createThreadFromNearby(person, { withGreeting: true, markUnread: false });
      } else {
        syncThreadPersonSnapshot(thread, person);
        upsertThread(thread);
      }
      closeChatPanel();
      openChatPanel(thread.id);
      await ensureThreadOpening(thread.id, { quiet: false });
    } catch (err) {
      if (typeof showToast === "function") showToast(String(err?.message || err || "打开失败"));
    } finally {
      setRoamLoading(false);
    }
  }

  function roamNotify(text) {
    const msg = String(text || "").trim();
    if (!msg) return;
    try {
      if (typeof window.showToast === "function") window.showToast(msg);
      else if (typeof showToast === "function") showToast(msg);
      else console.warn("[roam]", msg);
    } catch (err) {
      console.warn("[roam]", msg, err);
    }
  }

  function roamEl(id) {
    return document.getElementById(id);
  }

  function readCharPersonaStoreRoam() {
    try {
      if (typeof readCharPersonaStore === "function") return readCharPersonaStore();
      if (typeof window.readCharPersonaStore === "function") return window.readCharPersonaStore();
    } catch (_) {
      /* fallback below */
    }
    const D = window.XXJ_DB;
    if (!D) return { items: [], activeId: "" };
    const st = D.getKv(D.K.CHAR_PERSONA_STORE);
    if (st && Array.isArray(st.items)) return st;
    const leg = D.getKv(D.K.CHAR_PERSONA);
    if (leg && typeof leg === "object" && String(leg.displayName || "").trim()) {
      const id = String(leg.id || "legacy_char").trim() || "legacy_char";
      return { v: 2, activeId: id, items: [{ id, ...leg }] };
    }
    return { items: [], activeId: "" };
  }

  function charPersonaDisplayName(char) {
    return String(char?.displayName || char?.name || "").trim();
  }

  function listRoamCharPersonas() {
    try {
      const st = readCharPersonaStoreRoam();
      return (st.items || []).filter((c) => c && c.id && charPersonaDisplayName(c));
    } catch (_) {
      return [];
    }
  }

  function pickCharFightTargetId(items) {
    if (!items.length) return "";
    if (items.length === 1) return items[0].id;
    const st = readCharPersonaStoreRoam();
    const activeId = String(st?.activeId || "").trim();
    if (activeId && items.some((c) => c.id === activeId)) return activeId;
    return "";
  }

  async function handleCharFightButtonClick() {
    if (!ROAM_CHAR_FIGHT_ENABLED) return;
    if (!activeThreadId) {
      roamNotify("请先打开和路人的聊天");
      return;
    }
    const thread = findThread(activeThreadId);
    if (!thread || thread.exited) {
      roamNotify("对话已结束，无法出马");
      return;
    }
    if (charFight?.active) {
      roamNotify("已在出马中，点「停手」结束");
      return;
    }
    if (!hasAiKey()) {
      roamNotify("请先在「我的 → 连接 API」填写 API Key");
      return;
    }
    const items = listRoamCharPersonas();
    if (!items.length) {
      roamNotify("请先在角色档案里创建主角色");
      return;
    }
    const quickId = pickCharFightTargetId(items);
    if (quickId) {
      await startCharFight(quickId);
      return;
    }
    openCharPicker();
  }

  function syncCharFightUi() {
    const btn = roamCharFightBtn || roamEl("roam-char-fight-btn");
    const bar = roamCharFightBar || roamEl("roam-char-fight-bar");
    if (!ROAM_CHAR_FIGHT_ENABLED) {
      btn?.setAttribute("hidden", "");
      if (bar) bar.hidden = true;
      if (charFight?.active) void stopCharFight();
      closeCharPicker();
      return;
    }
    const on = Boolean(charFight?.active && charFight.threadId === activeThreadId);
    const label = roamCharFightLabel || roamEl("roam-char-fight-label");
    const stopBtn = roamCharFightStop || roamEl("roam-char-fight-stop");
    if (bar) {
      bar.classList.toggle("is-active", on);
      bar.hidden = !on;
    }
    btn?.toggleAttribute("hidden", on);
    if (label && charFight?.charName) {
      label.textContent = `${charFight.charName} 替你打字 · 直到你点停手`;
    }
    if (roamChatInput && activeThreadId) {
      const th = findThread(activeThreadId);
      roamChatInput.disabled = Boolean(th?.exited || on);
    }
    if (stopBtn) stopBtn.disabled = Boolean(charFight?.busy);
  }

  function openCharPicker() {
    if (!ROAM_CHAR_FIGHT_ENABLED) return;
    const picker = roamCharPicker || roamEl("roam-char-picker");
    const list = roamCharPickerList || roamEl("roam-char-picker-list");
    if (!picker || !list) {
      roamNotify("出马界面未就绪，请刷新后重试");
      return;
    }
    if (!activeThreadId) {
      roamNotify("请先打开和路人的聊天");
      return;
    }
    const thread = findThread(activeThreadId);
    if (!thread || thread.exited) {
      roamNotify("对话已结束，无法出马");
      return;
    }
    if (charFight?.active) {
      roamNotify("已在出马中");
      return;
    }
    if (!hasAiKey()) {
      roamNotify("请先在「我的 → 连接 API」填写 API Key");
      return;
    }
    const items = listRoamCharPersonas();
    if (!items.length) {
      roamNotify("请先在角色档案里创建主角色");
      return;
    }
    list.innerHTML = items
      .map(
        (c) =>
          `<button type="button" class="roam-char-pick-item" data-char-id="${escapeHtml(c.id)}">` +
          `<span class="roam-char-pick-name">${escapeHtml(charPersonaDisplayName(c))}</span>` +
          (String(c.summary || c.voice || "").trim()
            ? `<span class="roam-char-pick-sub">${escapeHtml(String(c.summary || c.voice || "").trim().slice(0, 36))}</span>`
            : "") +
          `</button>`
      )
      .join("");
    picker.hidden = false;
    picker.removeAttribute("aria-hidden");
  }

  function closeCharPicker() {
    const picker = roamCharPicker || roamEl("roam-char-picker");
    if (!picker) return;
    picker.hidden = true;
    picker.setAttribute("aria-hidden", "true");
  }

  async function buildCharFightReply(person, thread, char) {
    const userMask = readActiveUserMask();
    const userName = String(userMask?.displayName || "你").trim() || "你";
    const charName = charPersonaDisplayName(char) || "Ta";
    const userVoice = String(userMask?.voice || userMask?.persona || "").trim().slice(0, 600);
    const recent = (thread.messages || [])
      .slice(-12)
      .map((m) => {
        if (m.role === "stranger") {
          return `${person.name}: ${String(m.text || "").slice(0, 120)}`;
        }
        return `${userName}: ${String(m.text || "").slice(0, 120)}`;
      })
      .join("\n");
    const prompt =
      `你是「${charName}」，正在悄悄替「${userName}」操作漫游 App「附近的人」聊天。\n\n` +
      `[关键 · 只有你和 ${userName} 知道出马]\n` +
      `- 屏幕上的 ${person.name} **只会以为对面是 ${userName}**，不知道 ${charName} 在代打。\n` +
      `- 你输出的话会进 ${userName} 的气泡；**禁止**在正文里写「代聊」「出马」「${charName}帮你」等暴露词。\n` +
      `- 按 ${charName} 的判断与人设替 ${userName} 回话；语气优先像 ${userName} 本人发消息` +
      (userVoice ? `（参考：${userVoice.slice(0, 280)}）` : "") +
      `，可带 ${charName} 暗中偏着的措辞，但**不能**让陌生人认出是第三者在操作。\n` +
      `${charName} 人设参考：${String(char.summary || char.voice || "").slice(0, 500)}\n\n` +
      `对方 ${person.name}：${person.desc || person.signature || ""}\n` +
      (person.knowsChar
        ? `（对方可能听说过 ${charName}，但此刻会话身份仍是 ${userName}，勿主动自曝 ${charName} 在代打。）\n`
        : "") +
      `\n最近对话（${userName} 侧含你代发的字，对外都显示为 ${userName}）：\n${recent || "(尚无)"}\n\n` +
      `规则：短句 1～3 条即可；像真人 IM；只输出要说的话，不要解释、不要 JSON。`;
    return aiChat(
      [
        { role: "system", content: prompt },
        { role: "user", content: `替 ${userName} 回 ${person.name} 的下一条消息。` }
      ],
      { temperature: 0.92, max_tokens: 280 }
    );
  }

  async function pushCharProxyMessage(text) {
    if (!activeThreadId || !charFight?.active) return;
    const thread = findThread(activeThreadId);
    if (!thread || thread.exited) return;
    const t = String(text || "").trim();
    if (!t) return;
    thread.messages.push({
      id: uid(),
      role: "char_proxy",
      charName: charFight.charName,
      text: t,
      at: Date.now()
    });
    thread.preview = t;
    thread.updatedAt = Date.now();
    upsertThread(thread);
    renderChatMessages(thread);
    renderMsgList();
    await triggerStrangerReply(thread, { noBusy: true, silent: true });
  }

  function clearCharFightTurnTimer() {
    if (charFight?.turnTimer != null) {
      window.clearTimeout(charFight.turnTimer);
      charFight.turnTimer = null;
    }
  }

  function scheduleCharFightTurn() {
    if (!charFight?.active || charFight.busy) return;
    const thread = findThread(charFight.threadId);
    if (!thread || thread.exited) return;
    clearCharFightTurnTimer();
    charFight.turnTimer = window.setTimeout(() => {
      if (charFight) charFight.turnTimer = null;
      void runCharFightTurn();
    }, 2500 + Math.floor(Math.random() * 2000));
  }

  async function triggerStrangerReply(thread, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const person = resolveThreadPerson(thread);
    if (!person || thread.exited) {
      if (!o.silent && typeof showToast === "function") showToast("对方已离开，无法继续对话");
      return;
    }
    if (!o.noBusy) {
      chatBusy = true;
      roamChatSend?.classList.add("is-busy");
    }
    try {
      if (person.isStub && findNearby(thread.nearbyId)) await hydrateNearbyPersona(person.id);
      const livePerson = resolveThreadPerson(thread) || person;
      const reply = await callStrangerAI(thread, livePerson, o);
      if (pushStrangerReplyToThread(thread, reply)) {
        /* preview set in push */
      }
      applyStrangerSideEffects(thread, livePerson, reply);
      if (thread.exited) {
        if (roamChatInput) roamChatInput.disabled = true;
        if (roamChatSend) roamChatSend.disabled = true;
      }
      thread.updatedAt = Date.now();
      upsertThread(thread);
      renderChatMessages(thread);
      renderMsgList();
      if (activeThreadId === thread.id) syncInboundFriendBanner(thread, livePerson);
      maybeRumorFromChat(thread, livePerson, reply);
      if (charFight?.active && charFight.threadId === thread.id && !thread.exited) {
        scheduleCharFightTurn();
      }
    } catch (err) {
      if (typeof showToast === "function") showToast(String(err?.message || err || "回复失败"));
    } finally {
      if (!o.noBusy) {
        chatBusy = false;
        roamChatSend?.classList.remove("is-busy");
      }
    }
  }

  async function rerollLastStrangerReply() {
    if (chatBusy || !activeThreadId) return;
    const thread = findThread(activeThreadId);
    const person = thread ? resolveThreadPerson(thread) : null;
    if (!thread || !person) return;
    if (thread.exited) {
      if (typeof showToast === "function") showToast("对话已结束");
      return;
    }
    if (charFight?.active && charFight.threadId === thread.id) {
      if (typeof showToast === "function") showToast("出马中，请先点「停手」");
      return;
    }
    const idx = findLastStrangerMsgIndex(thread);
    if (idx < 0) {
      if (typeof showToast === "function") showToast("没有可重 roll 的回复");
      return;
    }
    if (!hasAiKey()) {
      if (typeof showToast === "function") showToast("请先在「我的 → 连接 API」填写 API Key");
      return;
    }

    const backupTail = thread.messages.slice(idx).map((m) => ({ ...m }));
    const backupExited = thread.exited;
    const backupInbound = thread.inboundFriendRequest ? { ...thread.inboundFriendRequest } : null;
    const backupPreview = thread.preview;

    popLastStrangerTurn(thread);
    upsertThread(thread);
    renderChatMessages(thread);
    renderMsgList();
    syncInboundFriendBanner(thread, person);

    chatBusy = true;
    roamChatSend?.classList.add("is-busy");
    try {
      if (person.isStub && findNearby(thread.nearbyId)) await hydrateNearbyPersona(person.id);
      const livePerson = resolveThreadPerson(thread) || person;
      const reply = await callStrangerAI(thread, livePerson, { reroll: true });
      if (!pushStrangerReplyToThread(thread, reply)) {
        throw new Error("回复格式无效，请再试一次");
      }
      applyStrangerSideEffects(thread, livePerson, reply);
      if (thread.exited) {
        if (roamChatInput) roamChatInput.disabled = true;
        if (roamChatSend) roamChatSend.disabled = true;
      }
      thread.updatedAt = Date.now();
      upsertThread(thread);
      renderChatMessages(thread);
      renderMsgList();
      syncInboundFriendBanner(thread, livePerson);
      maybeRumorFromChat(thread, livePerson, reply);
      if (typeof showToast === "function") showToast("已重 roll");
    } catch (err) {
      thread.messages.splice(idx, 0, ...backupTail);
      thread.exited = backupExited;
      thread.inboundFriendRequest = backupInbound;
      thread.preview = backupPreview;
      upsertThread(thread);
      renderChatMessages(thread);
      renderMsgList();
      syncInboundFriendBanner(thread, person);
      if (typeof showToast === "function") showToast(String(err?.message || err || "重 roll 失败"));
    } finally {
      chatBusy = false;
      roamChatSend?.classList.remove("is-busy");
    }
  }

  async function continueStrangerAfterEmptySend() {
    closeRoamSendChoiceDialog();
    if (chatBusy || !activeThreadId) return;
    const thread = findThread(activeThreadId);
    const person = thread ? resolveThreadPerson(thread) : null;
    if (!thread || !person || thread.exited) return;
    chatBusy = true;
    roamChatSend?.classList.add("is-busy");
    try {
      await triggerStrangerReply(thread, { emptySend: true, noBusy: true });
    } finally {
      chatBusy = false;
      roamChatSend?.classList.remove("is-busy");
    }
  }

  async function runCharFightTurn() {
    if (!charFight?.active || charFight.busy) return;
    if (chatBusy) {
      scheduleCharFightTurn();
      return;
    }
    const thread = findThread(charFight.threadId);
    const person = thread ? resolveThreadPerson(thread) : null;
    const char = readCharPersonaStoreRoam().items.find((x) => x.id === charFight.charId);
    if (!thread || !person || !char || thread.exited) {
      if (charFight?.active && thread?.exited && typeof showToast === "function") {
        showToast("对话已结束，出马停住");
      }
      if (charFight?.active && thread?.exited) void stopCharFight();
      return;
    }
    charFight.busy = true;
    syncCharFightUi();
    try {
      const reply = String((await buildCharFightReply(person, thread, char)) || "").trim();
      if (reply) {
        await pushCharProxyMessage(reply);
      } else if (charFight?.active) {
        scheduleCharFightTurn();
      }
    } catch (err) {
      if (typeof showToast === "function") showToast(String(err?.message || err || "出马失败"));
      if (charFight?.active) scheduleCharFightTurn();
    } finally {
      if (charFight) charFight.busy = false;
      syncCharFightUi();
    }
  }

  async function startCharFight(charId) {
    if (!activeThreadId) {
      roamNotify("请先打开和路人的聊天");
      return;
    }
    if (charFight?.active) {
      roamNotify("已在出马中");
      return;
    }
    if (!hasAiKey()) {
      roamNotify("请先在「我的 → 连接 API」填写 API Key");
      return;
    }
    const thread = findThread(activeThreadId);
    const person = thread ? resolveThreadPerson(thread) : null;
    const char = readCharPersonaStoreRoam().items.find((x) => x.id === charId);
    if (!thread || !person) {
      roamNotify("找不到当前会话");
      return;
    }
    if (thread.exited) {
      roamNotify("对话已结束，无法出马");
      return;
    }
    if (!char) {
      roamNotify("角色不存在");
      return;
    }
    closeCharPicker();
    setRoamLoading(false);
    charFight = {
      threadId: thread.id,
      nearbyId: person.id,
      charId: char.id,
      charName: charPersonaDisplayName(char) || "Ta",
      active: true,
      busy: false,
      turnTimer: null
    };
    syncCharFightUi();
    roamNotify(`${charFight.charName} 替你打字中（直到你点停手）`);
    await runCharFightTurn();
  }

  async function stopCharFight() {
    if (!charFight) return;
    clearCharFightTurnTimer();
    charFight = null;
    syncCharFightUi();
  }

  async function sendChatMessage() {
    if (chatBusy || !activeThreadId || !roamChatInput) return;
    const text = String(roamChatInput.value || "").trim();
    const emptySend = !text;
    const thread = findThread(activeThreadId);
    const person = thread ? resolveThreadPerson(thread) : null;
    if (!thread || !person || thread.exited) return;
    if (!hasAiKey()) {
      if (typeof showToast === "function") showToast("请先在「我的 → 连接 API」填写 API Key");
      return;
    }
    if (charFight?.active && charFight.threadId === thread.id) {
      if (typeof showToast === "function") showToast("出马中，请先点「停手」");
      return;
    }

    // 空回车且上一条是对方：弹「继续说 / 重 roll」（与密谈一致）
    if (emptySend && threadLastBubbleIsStranger(thread)) {
      openRoamSendChoiceDialog();
      return;
    }

    // 有内容：只发出气泡，不立刻请求 AI（与密谈线上一致）
    if (!emptySend) {
      thread.messages.push({ id: uid(), role: "user", text, at: Date.now() });
      thread.preview = text;
      thread.updatedAt = Date.now();
      upsertThread(thread);
      renderChatMessages(thread);
      renderMsgList();
      roamChatInput.value = "";
      return;
    }

    // 空回车：催对方接话（须先发出你的那句，或尚无开场）
    chatBusy = true;
    roamChatSend?.classList.add("is-busy");
    try {
      if (thread.awaitingOpening && !threadHasStrangerSpeech(thread)) {
        await ensureThreadOpening(thread.id, { quiet: false });
      } else {
        await triggerStrangerReply(thread, { emptySend: true, noBusy: true });
      }
    } catch (_) {
      /* toast in triggerStrangerReply / ensureThreadOpening */
    } finally {
      chatBusy = false;
      roamChatSend?.classList.remove("is-busy");
    }
  }

  function metersFromLatLng(lat, lng) {
    const cos = Math.cos(lat * Math.PI / 180);
    return { mx: lng * 111320 * cos, my: lat * 110540 };
  }

  function latLngToOffsetPx(lat, lng, centerLat, centerLng) {
    const c = metersFromLatLng(centerLat, centerLng);
    const p = metersFromLatLng(lat, lng);
    return {
      x: (p.mx - c.mx) / METERS_PER_PX,
      y: (p.my - c.my) / METERS_PER_PX
    };
  }

  function offsetPxToLatLng(pxX, pxY, centerLat, centerLng) {
    const c = metersFromLatLng(centerLat, centerLng);
    const mx = c.mx + pxX * METERS_PER_PX;
    const my = c.my + pxY * METERS_PER_PX;
    const lat = my / 110540;
    const cos = Math.cos(centerLat * Math.PI / 180);
    const lng = mx / (111320 * (cos || 1));
    return { lat, lng };
  }

  function moveUserToMapPoint(clientX, clientY) {
    if (!mapStage) return false;
    const pos = getPos();
    if (!pos) return false;
    const rect = mapStage.getBoundingClientRect();
    const w = mapStage.clientWidth;
    const h = mapStage.clientHeight;
    if (w <= 0 || h <= 0) return false;
    const pxX = clientX - rect.left - w / 2;
    const pxY = clientY - rect.top - h / 2;
    const next = offsetPxToLatLng(pxX, pxY, pos.lat, pos.lng);
    const dist = haversineM(pos.lat, pos.lng, next.lat, next.lng);
    if (dist < 8) return false;
    if (dist > MAP_TAP_MAX_M) {
      if (typeof showToast === "function") showToast(`太远了（${formatDistanceM(dist)}），走近一点再点`);
      return false;
    }
    const place = localPlaceName(next.lat, next.lng);
    applyVirtualPos({ lat: next.lat, lng: next.lng, place, at: Date.now() });
    recalcNearbyDistances();
    pulseMapUser();
    if (typeof showToast === "function") showToast(`走到了 ${place}`);
    return true;
  }

  function handleMapStagePointer(e) {
    if (!(mapStage instanceof HTMLElement)) return;
    if (e.target.closest(".roam-map-stroll, .roam-map-recenter, .roam-map-loc-chip, .roam-map-hint, .roam-map-marker")) {
      return;
    }
    if (roamChat && !roamChat.hidden) return;
    moveUserToMapPoint(e.clientX, e.clientY);
  }

  function localPlaceName(lat, lng) {
    const { mx, my } = metersFromLatLng(lat, lng);
    const bx = Math.floor(mx / BLOCK_M);
    const by = Math.floor(my / BLOCK_M);
    const ha = hash2(bx, by);
    const hb = hash2(bx + 11, by - 5);
    const a = STREET_A[Math.floor(ha * STREET_A.length) % STREET_A.length];
    const b = STREET_B[Math.floor(hb * STREET_B.length) % STREET_B.length];
    const nearMajor = bx % MAJOR_EVERY === 0 || by % MAJOR_EVERY === 0;
    return nearMajor ? a + b : a + "弄 · " + b + "口";
  }

  function hash3(x, y, z) {
    return hash2(x + z * 17.3, y - z * 9.1);
  }

  function drawRoundRect(ctx, x, y, rw, rh, r) {
    const rad = Math.min(r, rw / 2, rh / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + rw, y, x + rw, y + rh, rad);
    ctx.arcTo(x + rw, y + rh, x, y + rh, rad);
    ctx.arcTo(x, y + rh, x, y, rad);
    ctx.arcTo(x, y, x + rw, y, rad);
    ctx.closePath();
  }

  function blockType(bx, by) {
    const h = hash2(bx, by);
    if (h < 0.055) return "water";
    if (h < 0.13) return "park";
    if (h < 0.58) return "residential";
    return "commercial";
  }

  function roadKind(axis, index) {
    if (index % MAJOR_EVERY === 0) return "major";
    if (index % MINOR_EVERY === 0) return "minor";
    if (hash2(index, axis * 31) < 0.22) return "alley";
    return "none";
  }

  function roadWidth(kind) {
    if (kind === "major") return 13;
    if (kind === "minor") return 8;
    if (kind === "alley") return 5;
    return 0;
  }

  function streetLabel(bx, by, horizontal) {
    const ha = hash2(bx + (horizontal ? 0 : 7), by + (horizontal ? 11 : 0));
    const a = STREET_A[Math.floor(ha * STREET_A.length) % STREET_A.length];
    const b = STREET_B[Math.floor(hash2(bx, by + 3) * STREET_B.length) % STREET_B.length];
    return horizontal ? a + b : a + "巷";
  }

  function subdivideBuildings(ctx, x, y, bw, bh, bx, by, palette) {
    const gap = 3;
    const innerX = x + gap;
    const innerY = y + gap;
    const innerW = bw - gap * 2;
    const innerH = bh - gap * 2;
    if (innerW < 10 || innerH < 10) return;

    const count = 2 + Math.floor(hash3(bx, by, 1) * 3);
    const splitH = hash3(bx, by, 2) > 0.5;
    const pads = [0.28, 0.42, 0.55, 0.68, 0.82];

    if (count <= 2) {
      if (splitH) {
        const mid = innerW * (0.42 + hash3(bx, by, 3) * 0.16);
        drawFootprint(ctx, innerX, innerY, mid - 1.5, innerH, bx, by, 0, palette);
        drawFootprint(ctx, innerX + mid + 1.5, innerY, innerW - mid - 1.5, innerH, bx, by, 1, palette);
      } else {
        const mid = innerH * (0.42 + hash3(bx, by, 4) * 0.16);
        drawFootprint(ctx, innerX, innerY, innerW, mid - 1.5, bx, by, 0, palette);
        drawFootprint(ctx, innerX, innerY + mid + 1.5, innerW, innerH - mid - 1.5, bx, by, 1, palette);
      }
      return;
    }

    const cuts = pads.slice(0, count - 1).map((p, i) => p + (hash3(bx, by, 5 + i) - 0.5) * 0.08);
    if (splitH) {
      let cx = innerX;
      cuts.forEach((p, i) => {
        const nx = innerX + innerW * p;
        drawFootprint(ctx, cx, innerY, nx - cx - 1, innerH, bx, by, i, palette);
        cx = nx + 2;
      });
      drawFootprint(ctx, cx, innerY, innerX + innerW - cx, innerH, bx, by, count, palette);
    } else {
      let cy = innerY;
      cuts.forEach((p, i) => {
        const ny = innerY + innerH * p;
        drawFootprint(ctx, innerX, cy, innerW, ny - cy - 1, bx, by, i, palette);
        cy = ny + 2;
      });
      drawFootprint(ctx, innerX, cy, innerW, innerY + innerH - cy, bx, by, count, palette);
    }
  }

  function drawFootprint(ctx, x, y, fw, fh, bx, by, idx, palette) {
    if (fw < 6 || fh < 6) return;
    const tone = hash3(bx, by, idx + 9);
    const fill =
      tone < 0.35 ? palette.buildA : tone < 0.7 ? palette.buildB : palette.buildC;
    const r = Math.min(3, fw / 4, fh / 4);
    drawRoundRect(ctx, x, y, fw, fh, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = palette.buildEdge;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  function drawWaterBlock(ctx, x, y, bw, bh, bx, by, palette) {
    const wave = hash2(bx, by) * Math.PI * 2;
    ctx.fillStyle = palette.water;
    ctx.beginPath();
    ctx.moveTo(x, y + bh * 0.72);
    ctx.bezierCurveTo(
      x + bw * 0.25, y + bh * (0.35 + Math.sin(wave) * 0.08),
      x + bw * 0.75, y + bh * (0.55 + Math.cos(wave) * 0.06),
      x + bw, y + bh * 0.68
    );
    ctx.lineTo(x + bw, y + bh);
    ctx.lineTo(x, y + bh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = palette.waterEdge;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  function drawParkBlock(ctx, x, y, bw, bh, bx, by, palette) {
    drawRoundRect(ctx, x + 2, y + 2, bw - 4, bh - 4, 5);
    ctx.fillStyle = palette.park;
    ctx.fill();
    const trees = 2 + Math.floor(hash3(bx, by, 8) * 3);
    ctx.fillStyle = palette.parkTree;
    for (let i = 0; i < trees; i++) {
      const tx = x + 8 + hash3(bx, by, 20 + i) * (bw - 16);
      const ty = y + 8 + hash3(bx, by, 30 + i) * (bh - 16);
      ctx.beginPath();
      ctx.arc(tx, ty, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawProceduralMap(ctx, centerLat, centerLng, w, h) {
    const dark = isDarkMap();
    const palette = dark
      ? {
          bg: "#1a1c1f",
          land: "#23262a",
          road: "#3a3f45",
          roadMajor: "#454b52",
          roadEdge: "#2e3237",
          roadDash: "#5c636b",
          buildA: "#2e3236",
          buildB: "#34393e",
          buildC: "#3a4046",
          buildEdge: "#454b52",
          park: "#243328",
          parkTree: "#355a42",
          water: "#1a3348",
          waterEdge: "#2a5570",
          label: "rgba(174, 174, 178, 0.85)"
        }
      : {
          bg: "#ebe6dc",
          land: "#f4f1ea",
          road: "#ffffff",
          roadMajor: "#ffffff",
          roadEdge: "#ddd8cf",
          roadDash: "#c8c2b8",
          buildA: "#e8e3da",
          buildB: "#ded8cf",
          buildC: "#d4cec4",
          buildEdge: "#cbc4ba",
          park: "#bfe0b8",
          parkTree: "#7fb069",
          water: "#a8d4f5",
          waterEdge: "#7eb8e8",
          label: "rgba(99, 99, 102, 0.88)"
        };

    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);

    const cos = Math.cos((centerLat * Math.PI) / 180);
    const centerMx = centerLng * 111320 * cos;
    const centerMy = centerLat * 110540;
    const viewWM = w * METERS_PER_PX;
    const viewHM = h * METERS_PER_PX;
    const halfW = w / 2;
    const halfH = h / 2;
    const invMpp = 1 / METERS_PER_PX;

    const bx0 = Math.floor((centerMx - viewWM / 2) / BLOCK_M) - 1;
    const bx1 = Math.ceil((centerMx + viewWM / 2) / BLOCK_M) + 1;
    const by0 = Math.floor((centerMy - viewHM / 2) / BLOCK_M) - 1;
    const by1 = Math.ceil((centerMy + viewHM / 2) / BLOCK_M) + 1;

    /** @type {{ x:number, y:number, w:number, h:number, label:string }[]} */
    const labels = [];

    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const leftM = bx * BLOCK_M;
        const topM = by * BLOCK_M;
        const rightM = (bx + 1) * BLOCK_M;
        const bottomM = (by + 1) * BLOCK_M;

        const leftKind = roadKind(0, bx);
        const topKind = roadKind(1, by);
        const rightKind = roadKind(0, bx + 1);
        const bottomKind = roadKind(1, by + 1);

        const lx = Math.round(halfW + (leftM - centerMx) * invMpp + roadWidth(leftKind) / 2);
        const ty = Math.round(halfH + (topM - centerMy) * invMpp + roadWidth(topKind) / 2);
        const rx = Math.round(halfW + (rightM - centerMx) * invMpp - roadWidth(rightKind) / 2);
        const byy = Math.round(halfH + (bottomM - centerMy) * invMpp - roadWidth(bottomKind) / 2);
        const bw = rx - lx;
        const bh = byy - ty;
        if (bw < 8 || bh < 8) continue;

        const kind = blockType(bx, by);
        if (kind === "water") {
          drawWaterBlock(ctx, lx, ty, bw, bh, bx, by, palette);
        } else if (kind === "park") {
          drawParkBlock(ctx, lx, ty, bw, bh, bx, by, palette);
        } else {
          drawRoundRect(ctx, lx, ty, bw, bh, 2);
          ctx.fillStyle = palette.land;
          ctx.fill();
          subdivideBuildings(ctx, lx, ty, bw, bh, bx, by, palette);
        }
      }
    }

    for (let bx = bx0; bx <= bx1 + 1; bx++) {
      const kind = roadKind(0, bx);
      const rw = roadWidth(kind);
      if (!rw) continue;
      const worldMx = bx * BLOCK_M;
      const sx = Math.round(halfW + (worldMx - centerMx) * invMpp);
      ctx.fillStyle = kind === "major" ? palette.roadMajor : palette.road;
      ctx.fillRect(sx - Math.floor(rw / 2), 0, rw, h);
      ctx.fillStyle = palette.roadEdge;
      ctx.fillRect(sx - Math.floor(rw / 2), 0, 1, h);
      ctx.fillRect(sx + Math.floor(rw / 2) - 1, 0, 1, h);
      if (kind === "major" && bx % MAJOR_EVERY === 0) {
        labels.push({
          x: sx + 6,
          y: halfH - 28,
          w: 0,
          h: 0,
          label: streetLabel(bx, 0, false)
        });
      }
    }

    for (let by = by0; by <= by1 + 1; by++) {
      const kind = roadKind(1, by);
      const rw = roadWidth(kind);
      if (!rw) continue;
      const worldMy = by * BLOCK_M;
      const sy = Math.round(halfH + (worldMy - centerMy) * invMpp);
      ctx.fillStyle = kind === "major" ? palette.roadMajor : palette.road;
      ctx.fillRect(0, sy - Math.floor(rw / 2), w, rw);
      ctx.fillStyle = palette.roadEdge;
      ctx.fillRect(0, sy - Math.floor(rw / 2), w, 1);
      ctx.fillRect(0, sy + Math.floor(rw / 2) - 1, w, 1);
      if (kind === "major" && by % MAJOR_EVERY === 0) {
        labels.push({
          x: halfW - 36,
          y: sy - 4,
          w: 0,
          h: 0,
          label: streetLabel(0, by, true)
        });
      }
    }

    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = palette.roadDash;
    ctx.lineWidth = 0.8;
    for (let bx = bx0; bx <= bx1 + 1; bx++) {
      if (roadKind(0, bx) !== "major") continue;
      const sx = Math.round(halfW + (bx * BLOCK_M - centerMx) * invMpp);
      ctx.beginPath();
      ctx.moveTo(sx, 4);
      ctx.lineTo(sx, h - 4);
      ctx.stroke();
    }
    for (let by = by0; by <= by1 + 1; by++) {
      if (roadKind(1, by) !== "major") continue;
      const sy = Math.round(halfH + (by * BLOCK_M - centerMy) * invMpp);
      ctx.beginPath();
      ctx.moveTo(4, sy);
      ctx.lineTo(w - 4, sy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.font = '600 9px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans SC", sans-serif';
    ctx.textBaseline = "middle";
    labels.slice(0, 4).forEach((item) => {
      if (item.x < 4 || item.y < 4 || item.x > w - 40 || item.y > h - 8) return;
      ctx.fillStyle = palette.label;
      ctx.fillText(item.label, item.x, item.y);
    });
  }

  function queueMapRender() {
    if (mapRenderQueued) return;
    mapRenderQueued = true;
    requestAnimationFrame(() => {
      mapRenderQueued = false;
      renderRoamMap();
    });
  }

  function setupCanvas(canvas, w, h) {
    if (!(canvas instanceof HTMLCanvasElement) || w <= 0 || h <= 0) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function renderMapBase(centerLat, centerLng, w, h) {
    const ctx = setupCanvas(mapBase, w, h);
    if (!ctx) return;
    drawProceduralMap(ctx, centerLat, centerLng, w, h);
  }

  function renderMapOverlay(centerLat, centerLng, w, h) {
    const ctx = setupCanvas(mapOverlay, w, h);
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const trail = (state?.strollLog || [])
      .map((entry) => entry.pos || entry.geo)
      .filter((p) => p && Number.isFinite(Number(p.lat)))
      .slice(-14);
    if (trail.length >= 2) {
      ctx.strokeStyle = "rgba(0, 122, 255, 0.55)";
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      trail.forEach((p, i) => {
        const off = latLngToOffsetPx(Number(p.lat), Number(p.lng), centerLat, centerLng);
        const x = w / 2 + off.x;
        const y = h / 2 + off.y;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.strokeStyle = "rgba(0, 122, 255, 0.92)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      trail.forEach((p, i) => {
        const off = latLngToOffsetPx(Number(p.lat), Number(p.lng), centerLat, centerLng);
        const x = w / 2 + off.x;
        const y = h / 2 + off.y;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  function renderMapMarkers(centerLat, centerLng, w, h) {
    if (!mapMarkers) return;
    const parts = [];
    (state?.nearby || []).forEach((item) => {
      if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) return;
      const off = latLngToOffsetPx(Number(item.lat), Number(item.lng), centerLat, centerLng);
      const x = w / 2 + off.x;
      const y = h / 2 + off.y;
      if (x < -24 || y < -40 || x > w + 24 || y > h + 24) return;
      const moveLab = nearbyMoveStatusLabel(item);
      const moveCls =
        item.moveMode === "leaving" ? " is-leaving" : item.moveMode === "approaching" ? " is-approaching" : "";
      const inbound = nearbyInboundPingActive(item);
      const inboundCls = inbound ? " is-inbound" : "";
      parts.push(
        `<button type="button" class="roam-map-marker is-nearby is-clickable${item.knowsChar ? " knows-char" : ""}${moveCls}${inboundCls}" ` +
          `data-nearby-id="${escapeHtml(item.id)}" style="left:${x}px;top:${y}px" ` +
          `title="${escapeHtml(String(item.name || "路人") + (inbound ? " · 主动找你" : "") + (item.hint ? " · " + item.hint : ""))}">` +
          `<span class="roam-map-marker-pin-wrap${inboundCls}">` +
          `<span class="roam-map-marker-pin"></span>` +
          (inbound ? `<span class="roam-map-marker-ping" aria-hidden="true"></span>` : "") +
          `</span>` +
          `<span class="roam-map-marker-label">${escapeHtml(String(item.name || "路人"))}</span>` +
          (moveLab ? `<span class="roam-map-marker-move">${escapeHtml(moveLab)} · ${escapeHtml(item.dist || "")}</span>` : "") +
          `</button>`
      );
    });
    mapMarkers.innerHTML = parts.join("");
  }

  function renderRoamMap() {
    if (!mapStage) return;
    const w = mapStage.clientWidth;
    const h = mapStage.clientHeight;
    const pos = getPos();
    if (!pos || w <= 0 || h <= 0) return;
    renderMapBase(pos.lat, pos.lng, w, h);
    renderMapOverlay(pos.lat, pos.lng, w, h);
    renderMapMarkers(pos.lat, pos.lng, w, h);
    mapStage.classList.add("is-ready");
  }

  function pulseMapUser() {
    mapUserPin?.classList.remove("is-pulse");
    void mapUserPin?.offsetWidth;
    mapUserPin?.classList.add("is-pulse");
  }

  function ensureMapResizeObserver() {
    if (!mapStage || mapResizeObs) return;
    mapResizeObs = new ResizeObserver(() => queueMapRender());
    mapResizeObs.observe(mapStage);
  }

  function teardownMapResizeObserver() {
    mapResizeObs?.disconnect();
    mapResizeObs = null;
  }

  function updateLocationLine() {
    if (!locationLine) return;
    const pos = getPos();
    if (!pos) {
      locationLine.textContent = "附近街区";
      return;
    }
    locationLine.textContent = pos.place || localPlaceName(pos.lat, pos.lng);
  }

  function syncStrollButton() {
    if (!strollBtn) return;
    strollBtn.disabled = strollBusy;
    strollBtn.classList.toggle("is-busy", strollBusy);
    if (hasAiKey()) {
      strollBtn.title = "一次 API 生成整段偶遇 · 含 4～6 选项突发事件";
    } else {
      strollBtn.title = "本地多选项事件，不消耗 API";
    }
  }

  function pickStrollEvent() {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      const night = STROLL_EVENTS.filter((e) => e.tag === "深夜" || e.tag === "穿缝" || e.tag === "线索");
      if (night.length && Math.random() < 0.48) return night[Math.floor(Math.random() * night.length)];
    }
    const roll = Math.random();
    if (roll < 0.2) {
      const cross = STROLL_EVENTS.filter((e) => e.tag === "穿缝" || e.tag === "同人感" || e.tag === "传闻");
      if (cross.length) return cross[Math.floor(Math.random() * cross.length)];
    }
    if (roll < 0.32) {
      const clue = STROLL_EVENTS.filter((e) => e.tag === "线索" || e.tag === "岔路" || e.tag === "意外");
      if (clue.length) return clue[Math.floor(Math.random() * clue.length)];
    }
    return STROLL_EVENTS[Math.floor(Math.random() * STROLL_EVENTS.length)];
  }

  function appendStrollFollowUp(entry, text) {
    const t = String(text || "").trim();
    if (!t) return;
    entry.afterText = entry.afterText ? `${entry.afterText} ${t}` : t;
  }


  function spawnStrollNearbyFallback(knowsChar) {
    const pos = getPos();
    if (!pos) return null;
    const tpl = NEARBY_TEMPLATES[Math.floor(Math.random() * NEARBY_TEMPLATES.length)];
    const char = readActiveCharPersona();
    const charName = String(char?.displayName || "Ta").trim() || "Ta";
    const row = {
      name: tpl.name,
      signature: tpl.hint,
      distance: formatDistanceM(90 + Math.floor(Math.random() * 520)),
      firstMessage: knowsChar ? `……你也认识${charName}？` : "你好？",
      knowsChar: Boolean(knowsChar),
      charLink: knowsChar ? "传闻" : "",
      charLinkDetail: knowsChar ? "刚才闲逛里听见的风言风语" : ""
    };
    return nearbyFromAiRow(row, pos, (state.nearby || []).length);
  }

  function spawnStrollNearbyLocal(knowsChar) {
    const person = spawnStrollNearbyFallback(knowsChar);
    if (!person) return null;
    ensurePersonSocial(person);
    state.nearby = [...(state.nearby || []), person].sort(
      (a, b) => Number(a.distanceM || 0) - Number(b.distanceM || 0)
    );
    writeStore();
    renderNearbyList();
    queueMapRender();
    return person;
  }

  async function spawnStrollNearbyAsync(knowsChar, triggerEntry) {
    const useAi = hasAiKey() && Math.random() < SPAWN_NPC_AI_CHANCE;
    const pos = getPos();
    if (!pos) return null;
    let row = null;
    if (useAi) {
      try {
        const ctx = buildStrollAiContext();
        const triggerText = triggerEntry
          ? `${triggerEntry.text || ""}${triggerEntry.choiceLabel ? ` / 选择：${triggerEntry.choiceLabel}` : ""}`
          : ctx.recentStroll;
        row = await generateStrollNpcWithAI(knowsChar, ctx, triggerText);
      } catch (_) {
        row = null;
      }
    }
    const usedNames = new Set((state.nearby || []).map((p) => String(p?.name || "").trim()).filter(Boolean));
    const person = row
      ? nearbyFromAiRow(row, pos, (state.nearby || []).length, usedNames)
      : spawnStrollNearbyFallback(knowsChar);
    if (!person) return null;
    ensurePersonSocial(person);
    state.nearby = [...(state.nearby || []), person].sort(
      (a, b) => Number(a.distanceM || 0) - Number(b.distanceM || 0)
    );
    writeStore();
    renderNearbyList();
    queueMapRender();
    return person;
  }

  async function triggerStrangerReplyForThread(threadId) {
    const thread = findThread(threadId);
    if (!thread) return;
    let person = findNearby(thread.nearbyId);
    if (!person) return;
    try {
      await hydrateNearbyPersona(person.id);
      person = findNearby(thread.nearbyId);
      await triggerStrangerReply(thread);
    } catch (_) {
      /* stroll side-effect */
    }
  }

  function spawnStrollPersonFromChoice(knowsChar, entry) {
    const triggerEntry = entry
      ? { text: entry.text, choiceLabel: entry.choiceLabel }
      : null;
    if (hasAiKey()) return spawnStrollNearbyAsync(knowsChar, triggerEntry);
    return Promise.resolve(spawnStrollNearbyLocal(knowsChar));
  }

  async function applyStrollChoice(entryId, choiceIdx) {
    const log = state.strollLog || [];
    const entry = log.find((e) => e.id === entryId);
    if (!entry || entry.choicePicked != null || !Array.isArray(entry.choices) || !entry.choices.length) return;
    const choice = entry.choices[choiceIdx];
    if (!choice) return;
    entry.choicePicked = choiceIdx;
    entry.choiceLabel = choice.label;
    const effect = String(choice.effect || "log");
    let spawnedPerson = null;

    try {
      if (effect === "seed_rumor" || effect === "keep_item") {
        addRumorFromChoice(entry, choice);
      } else if (effect === "spawn_nearby") {
        spawnedPerson = await spawnStrollPersonFromChoice(false, entry);
      } else if (effect === "spawn_knows_char") {
        spawnedPerson = await spawnStrollPersonFromChoice(true, entry);
      } else if (effect === "spawn_greet") {
        spawnedPerson = await spawnStrollPersonFromChoice(false, entry);
        if (spawnedPerson) {
          const thread = createThreadFromNearby(spawnedPerson, { withGreeting: false });
          const msg = String(choice.msg || "你好？").trim();
          thread.messages.push({ id: uid(), role: "user", text: msg, at: Date.now() });
          thread.preview = msg;
          thread.updatedAt = Date.now();
          upsertThread(thread);
          window.setTimeout(() => void triggerStrangerReplyForThread(thread.id), 900);
          renderMsgList();
        }
      } else if (effect === "boost_rumor") {
        const r = (state.rumors || []).find((x) => x.status === "fresh" || x.status === "mutated");
        if (r) {
          r.heat = Math.min(RUMOR_HEAT_START, Number(r.heat || 0) + 28);
          r.updatedAt = Date.now();
        } else {
          const tpl = RUMOR_TEMPLATES[Math.floor(Math.random() * RUMOR_TEMPLATES.length)];
          addRumor({ ...tpl, place: entry.place });
        }
      } else if (effect === "peek_rumor") {
        const r = (state.rumors || []).find((x) => x.status === "fresh" || x.status === "mutated");
        if (r) {
          r.status = "verified";
          r.investigatedAt = Date.now();
          r.heat = RUMOR_HEAT_START;
          spawnedPerson = await spawnStrollPersonFromChoice(Math.random() < 0.4, entry);
        } else {
          const tpl = RUMOR_TEMPLATES[Math.floor(Math.random() * RUMOR_TEMPLATES.length)];
          addRumor({ ...tpl, place: entry.place });
        }
      }

      const outcome = String(choice.outcome || "").trim() || pickLocalChoiceOutcome(choice);
      entry.choiceOutcome = outcome;
      appendStrollFollowUp(entry, outcome);
      if (spawnedPerson) {
        pushStrollReactionBeat(`${spawnedPerson.name} 在地图上出现了。`, "遇人");
        renderNearbyList();
        queueMapRender();
      }

      writeStore();
      renderStrollFeed();
      renderSecretsPanel();
      updateSecretsTabBadge();
      const toast = strollChoiceEffectToast(effect, choice, spawnedPerson);
      if (typeof showToast === "function" && toast) showToast(toast);
    } catch (err) {
      if (typeof showToast === "function") showToast(String(err?.message || err || "选择失败"));
    }
  }

  function walkVirtualPos() {
    const pos = getPos();
    if (!pos) return null;
    const stepM = 45 + Math.floor(Math.random() * 140);
    const bearing = Math.random() * 360;
    const next = offsetLatLng(pos.lat, pos.lng, stepM, bearing);
    return {
      lat: next.lat,
      lng: next.lng,
      place: localPlaceName(next.lat, next.lng),
      at: Date.now()
    };
  }

  function applyVirtualPos(next) {
    if (!next) return null;
    state.pos = next;
    writeStore();
    queueMapRender();
    pulseMapUser();
    return { ...state.pos };
  }

  function recalcNearbyDistances() {
    const pos = getPos();
    if (!pos || !Array.isArray(state.nearby) || !state.nearby.length) return;
    let changed = false;
    state.nearby = state.nearby.map((item) => {
      if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) return item;
      const distanceM = haversineM(pos.lat, pos.lng, Number(item.lat), Number(item.lng));
      const dist = formatDistanceM(distanceM);
      if (item.distanceM !== distanceM || item.dist !== dist) changed = true;
      return { ...item, distanceM, dist };
    });
    state.nearby.sort((a, b) => Number(a.distanceM || 0) - Number(b.distanceM || 0));
    if (changed) writeStore();
    if (activeTab === "nearby") renderNearbyList();
    queueMapRender();
  }

  function generateNearbyFallback() {
    const pos = getPos();
    if (!pos) return false;
    state.nearby = demoNearbyList(pos);
    writeStore();
    queueMapRender();
    return true;
  }

  function renderStrollFeed() {
    const log = state.strollLog || [];
    if (strollCount) strollCount.textContent = String(log.length);
    if (!strollFeed) return;
    strollFeed.innerHTML = log
      .slice()
      .reverse()
      .map((entry) => {
        const place =
          entry.place ||
          (entry.pos && entry.pos.place) ||
          (entry.geo && entry.geo.place) ||
          "";
        const arcHead = entry.arcTitle
          ? `<p class="roam-card-arc"><i class="ph ph-path" aria-hidden="true"></i>${escapeHtml(entry.arcTitle)}${entry.arcDone ? " · 完" : ""}${entry.ai ? " · AI" : ""}</p>`
          : entry.ai
            ? `<p class="roam-card-arc roam-card-arc--muted"><i class="ph ph-sparkle" aria-hidden="true"></i>即兴</p>`
            : "";
        const after = entry.afterText ? `<p class="roam-card-after">${escapeHtml(entry.afterText)}</p>` : "";
        const picked =
          entry.choicePicked != null && entry.choiceLabel
            ? `<p class="roam-card-picked">已选：${escapeHtml(entry.choiceLabel)}</p>`
            : "";
        const outcome = entry.choiceOutcome
          ? `<p class="roam-card-outcome">${escapeHtml(entry.choiceOutcome)}</p>`
          : "";
        const choices =
          entry.choicePicked == null && Array.isArray(entry.choices) && entry.choices.length
            ? `<div class="roam-stroll-choices${entry.choices.length >= 5 ? " is-many" : ""}">${entry.choices
                .map(
                  (c, i) =>
                    `<button type="button" class="roam-stroll-choice" data-entry-id="${escapeHtml(entry.id)}" data-choice-idx="${i}">` +
                    `<span class="roam-stroll-choice-label">${escapeHtml(c.label)}</span>` +
                    (c.hint ? `<span class="roam-stroll-choice-hint">${escapeHtml(c.hint)}</span>` : "") +
                    `</button>`
                )
                .join("")}</div>`
            : "";
        const reaction = entry.isReaction || entry.isAmbient ? " is-reaction" : "";
        return (
          `<article class="roam-card${entry.choices?.length ? " has-choices" : ""}${reaction}" role="listitem" data-entry-id="${escapeHtml(entry.id)}">` +
          `<div class="roam-card-head">` +
          `<span class="roam-card-tag">${escapeHtml(String(entry.tag || "闲逛"))}</span>` +
          `<time class="roam-card-time">${formatTime(entry.at)}</time>` +
          `</div>` +
          arcHead +
          `<p class="roam-card-text">${escapeHtml(String(entry.text || ""))}</p>` +
          after +
          picked +
          outcome +
          choices +
          (place
            ? `<p class="roam-card-place"><i class="ph ph-map-pin" aria-hidden="true"></i>${escapeHtml(place)}</p>`
            : "") +
          `</article>`
        );
      })
      .join("");
    if (strollEmpty) {
      strollEmpty.hidden = log.length > 0;
      strollEmpty.textContent = `点「随便走走」——一路 ${STROLL_BEATS_MIN}～${STROLL_BEATS_MAX} 段偶遇，中间必有突发事件，${STROLL_CHOICE_MIN}～${STROLL_CHOICE_MAX} 个选项；你的选择会变成风言风语。`;
    }
  }

  function renderNearbyList() {
    const list = state.nearby?.length ? state.nearby : [];
    if (!nearbyList) return;
    nearbyList.innerHTML = list
      .map((item) => {
        const friendBadge = item.isFriend ? `<span class="roam-nearby-badge is-friend">友</span>` : "";
        const badge = item.knowsChar
          ? `<span class="roam-nearby-badge">识${escapeHtml(String(readActiveCharPersona()?.displayName || "Ta").slice(0, 1))}</span>`
          : "";
        const moveLab = nearbyMoveStatusLabel(item);
        const moveBadge = moveLab
          ? `<span class="roam-nearby-badge is-move${item.moveMode === "leaving" ? " is-leaving" : " is-approach"}">${escapeHtml(moveLab)}</span>`
          : "";
        const av = escapeHtml(nearbyDisplayAvatar(item));
        const chaseBtn =
          item.moveMode === "leaving"
            ? `<button type="button" class="roam-nearby-chase" data-chase-id="${escapeHtml(item.id)}" aria-label="追">追</button>`
            : "";
        return (
          `<div class="roam-nearby-row">` +
          `<button type="button" class="roam-nearby-item is-clickable" data-nearby-id="${escapeHtml(item.id)}" role="listitem">` +
          `<div class="roam-nearby-av" aria-hidden="true">${av}</div>` +
          `<div class="roam-nearby-meta">` +
          `<p class="roam-nearby-name">${escapeHtml(item.name || "路人")}${friendBadge}${badge}${moveBadge}</p>` +
          `<p class="roam-nearby-sub">${escapeHtml(item.signature || item.hint || "")}</p>` +
          `</div>` +
          `<span class="roam-nearby-dist">${escapeHtml(item.dist || "—")}</span>` +
          `</button>${chaseBtn}</div>`
        );
      })
      .join("");
    if (nearbyEmpty) {
      nearbyEmpty.hidden = list.length > 0;
      nearbyEmpty.textContent = nearbyGenerating ? "正在搜索附近…" : "点右上角刷新，重新搜索附近。";
    }
  }

  function renderMsgList() {
    const threads = (state.threads || []).slice().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    if (!msgList) return;
    msgList.innerHTML = threads
      .map((t) => {
        const unread = Number(t.unread) > 0 ? `<span class="roam-msg-unread">${t.unread}</span>` : "";
        const open = roamMsgSwipeOpenId === t.id ? " is-open" : "";
        return (
          `<div class="roam-msg-swipe${open}" data-thread-id="${escapeHtml(t.id)}">` +
          `<div class="roam-msg-swipe-actions">` +
          `<button type="button" class="roam-msg-swipe-del">删除</button>` +
          `</div>` +
          `<button type="button" class="roam-msg-swipe-main roam-nearby-item is-clickable" data-thread-id="${escapeHtml(t.id)}" role="listitem">` +
          `<div class="roam-nearby-av" aria-hidden="true">?</div>` +
          `<div class="roam-nearby-meta">` +
          `<p class="roam-nearby-name">${escapeHtml(t.name || "临时会话")}${unread}</p>` +
          `<p class="roam-nearby-sub">${escapeHtml(t.preview || "…")}</p>` +
          `</div>` +
          `</button>` +
          `</div>`
        );
      })
      .join("");
    if (msgEmpty) msgEmpty.hidden = threads.length > 0;
  }

  function finishRoamMsgSwipeDrag(open) {
    if (!roamMsgSwipeDrag) return;
    const { row, main, id } = roamMsgSwipeDrag;
    main.classList.remove("is-dragging");
    main.style.removeProperty("transform");
    row.classList.toggle("is-open", open);
    roamMsgSwipeOpenId = open ? id : roamMsgSwipeOpenId === id ? null : roamMsgSwipeOpenId;
    roamMsgSwipeDrag = null;
  }

  function bindRoamMsgListSwipe() {
    if (!msgList || msgList.dataset.swipeBound === "1") return;
    msgList.dataset.swipeBound = "1";

    msgList.addEventListener(
      "pointerdown",
      (e) => {
        const main = e.target.closest(".roam-msg-swipe-main");
        if (!(main instanceof HTMLElement) || !msgList.contains(main)) return;
        const row = main.closest(".roam-msg-swipe");
        if (!(row instanceof HTMLElement)) return;
        closeRoamMsgSwipeRows(row.dataset.threadId);
        roamMsgSwipeDrag = {
          row,
          main,
          id: String(row.dataset.threadId || ""),
          startX: e.clientX,
          startTx: row.classList.contains("is-open") ? -ROAM_MSG_SWIPE_DEL_W : 0,
          moved: false,
          pointerId: e.pointerId
        };
        main.classList.add("is-dragging");
        try {
          main.setPointerCapture(e.pointerId);
        } catch (_) {
          /* ignore */
        }
      },
      { passive: true }
    );

    msgList.addEventListener("pointermove", (e) => {
      if (!roamMsgSwipeDrag || e.pointerId !== roamMsgSwipeDrag.pointerId) return;
      const dx = e.clientX - roamMsgSwipeDrag.startX;
      if (Math.abs(dx) > 6) roamMsgSwipeDrag.moved = true;
      let tx = roamMsgSwipeDrag.startTx + dx;
      tx = Math.max(-ROAM_MSG_SWIPE_DEL_W, Math.min(0, tx));
      roamMsgSwipeDrag.main.style.transform = `translateX(${tx}px)`;
    });

    const endSwipe = (e) => {
      if (!roamMsgSwipeDrag || e.pointerId !== roamMsgSwipeDrag.pointerId) return;
      const { main, moved } = roamMsgSwipeDrag;
      const m = main.style.transform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
      const tx = m ? Number(m[1]) : 0;
      if (moved) roamMsgSwipeSuppressClick = true;
      finishRoamMsgSwipeDrag(tx <= -ROAM_MSG_SWIPE_DEL_W / 2);
      if (moved) window.setTimeout(() => { roamMsgSwipeSuppressClick = false; }, 0);
      try {
        main.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    };
    msgList.addEventListener("pointerup", endSwipe);
    msgList.addEventListener("pointercancel", endSwipe);

    msgList.addEventListener("click", (e) => {
      const del = e.target.closest(".roam-msg-swipe-del");
      if (del instanceof HTMLElement) {
        e.preventDefault();
        const row = del.closest(".roam-msg-swipe");
        const id = row instanceof HTMLElement ? row.dataset.threadId : "";
        if (id) deleteRoamThread(id);
        return;
      }
      const btn = e.target.closest(".roam-msg-swipe-main[data-thread-id]");
      if (!(btn instanceof HTMLElement)) return;
      if (roamMsgSwipeSuppressClick) {
        e.preventDefault();
        return;
      }
      const row = btn.closest(".roam-msg-swipe");
      if (row instanceof HTMLElement && row.classList.contains("is-open")) {
        e.preventDefault();
        closeRoamMsgSwipeRows();
        return;
      }
      const id = btn.getAttribute("data-thread-id");
      if (id) void openChatWithThread(id);
    });
  }

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll("#roam-screen .roam-tab").forEach((btn) => {
      const on = btn instanceof HTMLElement && btn.dataset.roamTab === tab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const panels = {
      stroll: document.getElementById("roam-panel-stroll"),
      nearby: document.getElementById("roam-panel-nearby"),
      messages: document.getElementById("roam-panel-messages"),
      secrets: document.getElementById("roam-panel-secrets")
    };
    for (const [id, el] of Object.entries(panels)) {
      if (!el) continue;
      const on = id === tab;
      el.classList.toggle("is-active", on);
      el.toggleAttribute("hidden", !on);
    }
    if (tab === "nearby") {
      if (!(state.nearby || []).length) generateNearbyFallback();
      else recalcNearbyDistances();
    }
    renderNearbyList();
    renderMsgList();
    if (tab === "secrets") renderSecretsPanel();
  }

  async function runStroll() {
    if (strollBusy) return;
    strollBusy = true;
    syncStrollButton();
    strollBtn?.classList.add("is-busy");
    const aiStroll = hasAiKey();
    if (aiStroll) setRoamLoading(true, "随便走走 · 生成偶遇…");
    /** @type {{ beats: object[], usedAi: boolean }} */
    let batch = { beats: buildStrollBeatBatchSync(), usedAi: false };
    try {
      batch = await resolveStrollBeatBatch();
    } catch (_) {
      batch = { beats: buildStrollBeatBatchSync(), usedAi: false };
    }
    const usedAi = Boolean(batch.usedAi);
    const delayBase = usedAi ? 80 : 120 + Math.floor(Math.random() * 80);
    window.setTimeout(() => {
      const beats = Array.isArray(batch.beats) && batch.beats.length ? batch.beats : buildStrollBeatBatchSync();
      const newEntries = [];
      let mainEntry = null;
      let lastPlace = "";
      beats.forEach((payload, i) => {
        const nextPos = walkVirtualPos();
        const posSnap = applyVirtualPos(nextPos);
        const place = posSnap?.place || "";
        if (place) lastPlace = place;
        const entry = {
          id: uid(),
          tag: payload.tag,
          text: payload.text,
          choices: payload.choices?.length ? padLocalChoices(payload.choices) : undefined,
          arcId: payload.arcId,
          arcTitle: payload.arcTitle,
          arcStep: payload.arcStep,
          ai: Boolean(payload.aiGenerated),
          isAmbient: Boolean(payload.isAmbient),
          at: Date.now() + i * (320 + Math.floor(Math.random() * 420)),
          place,
          pos: posSnap ? { lat: posSnap.lat, lng: posSnap.lng, place } : null
        };
        newEntries.push(entry);
        if (payload.isMain || !payload.isAmbient) mainEntry = entry;
      });
      state.strollLog = [...(state.strollLog || []), ...newEntries].slice(-80);
      writeStore();
      renderStrollFeed();
      updateLocationLine();
      void tickRumorsLifecycle();
      if (mainEntry) maybeStrollSecretsHook(mainEntry);
      maybeRefreshNearbyOnStroll();
      tickStrollHooks();
      tickNearbyMovement();
      strollBusy = false;
      strollBtn?.classList.remove("is-busy");
      syncStrollButton();
      if (aiStroll) setRoamLoading(false);
      if (typeof showToast === "function") {
        const n = newEntries.length;
        const choiceEntry = newEntries.find((e) => e.choices?.length);
        const choiceHint = choiceEntry ? ` · ${choiceEntry.choices.length} 项可选` : "";
        const placeHint = lastPlace ? `在 ${lastPlace} ` : "";
        showToast(`${placeHint}一路遇见 ${n} 段${choiceHint}`);
      }
    }, delayBase);
  }

  function renderAll() {
    renderStrollFeed();
    renderNearbyList();
    renderMsgList();
    renderSecretsPanel();
    updateLocationLine();
    syncStrollButton();
    syncRoamWorldDot();
    updateRoamWorldSummary();
    queueMapRender();
  }

  function updateRoamWorldSummary() {
    if (!roamWorldSummary) return;
    const roamN = roamWorldSheetOpen ? roamWorldDraftIds.length : getRoamBoundWorldBookIds().length;
    const char = readActiveCharPersona();
    let charN = 0;
    if (char) {
      const seen = new Set();
      (char.worldBookVolumeIds || []).forEach((id) => {
        const s = String(id || "").trim();
        if (s) seen.add(s);
      });
      const def = String(char.defaultWorldBookVolumeId || "").trim();
      if (def) seen.add(def);
      charN = seen.size;
    }
    const globalN = readWorldBookVolumes().filter((v) => v && v.scope === "global").length;
    const custom = roamWorldSheetOpen
      ? String(roamWorldviewText?.value || "").trim()
      : String(state?.worldviewText || "").trim();
    const parts = [];
    if (roamN) parts.push(`漫游绑 ${roamN} 本`);
    if (charN) parts.push(`角色 ${charN} 本`);
    if (globalN) parts.push(`全局 ${globalN} 本`);
    if (custom) parts.push("手写设定");
    roamWorldSummary.textContent = parts.length
      ? `当前生效：${parts.join(" · ")}。影响闲逛、附近、聊天生成。`
      : "未单独设置时将沿用角色档案与全局世界书；也可下方手写。";
  }

  function renderRoamWorldBookPicker() {
    if (!roamWbChips) return;
    const q = String(roamWbSearch?.value || "").trim().toLowerCase();
    const vols = readWorldBookVolumes().filter((v) => v && v.id);
    const filtered = q
      ? vols.filter((v) => String(v.title || "").toLowerCase().includes(q))
      : vols;
    if (roamWbEmpty) roamWbEmpty.hidden = filtered.length > 0;
    if (roamWbCount) roamWbCount.textContent = `${roamWorldDraftIds.length} / ${ROAM_WB_MAX}`;
    if (!filtered.length) {
      roamWbChips.innerHTML = "";
      return;
    }
    roamWbChips.innerHTML = filtered
      .map((vol) => {
        const on = roamWorldDraftIds.includes(vol.id);
        const scope = vol.scope === "global" ? "全局" : "局部";
        const title = escapeHtml(String(vol.title || "未命名").trim() || "未命名");
        const vid = escapeHtml(vol.id);
        return `<button type="button" class="roam-wb-chip${on ? " is-on" : ""}" data-roam-wb-id="${vid}" role="option" aria-selected="${on}"><span>${title}</span><span class="roam-wb-chip-badge">${scope}</span></button>`;
      })
      .join("");
  }

  function toggleRoamWorldBookDraft(volumeId) {
    const id = String(volumeId || "").trim();
    if (!id) return;
    const has = roamWorldDraftIds.includes(id);
    if (has) roamWorldDraftIds = roamWorldDraftIds.filter((x) => x !== id);
    else {
      if (roamWorldDraftIds.length >= ROAM_WB_MAX) {
        if (typeof showToast === "function") showToast(`漫游最多绑定 ${ROAM_WB_MAX} 本`);
        return;
      }
      roamWorldDraftIds = [...roamWorldDraftIds, id];
    }
    renderRoamWorldBookPicker();
    updateRoamWorldSummary();
  }

  function openRoamWorldSheet() {
    if (!state) state = readStore();
    roamWorldDraftIds = [...getRoamBoundWorldBookIds()];
    if (roamWorldviewText) roamWorldviewText.value = String(state?.worldviewText || "");
    if (roamWbSearch) roamWbSearch.value = "";
    roamWorldSheetOpen = true;
    renderRoamWorldBookPicker();
    updateRoamWorldSummary();
    roamWorldSheet?.removeAttribute("hidden");
    roamWorldSheet?.setAttribute("aria-hidden", "false");
  }

  function closeRoamWorldSheet() {
    roamWorldSheet?.setAttribute("hidden", "");
    roamWorldSheet?.setAttribute("aria-hidden", "true");
    roamWorldSheetOpen = false;
    updateRoamWorldSummary();
  }

  function saveRoamWorldSettings() {
    if (!state) state = readStore();
    state.worldBookVolumeIds = normalizeRoamWorldBookIds(roamWorldDraftIds);
    state.worldviewText = String(roamWorldviewText?.value || "").trim().slice(0, 8000);
    writeStore();
    syncRoamWorldDot();
    closeRoamWorldSheet();
    if (typeof showToast === "function") showToast("世界观已保存");
  }

  function scheduleMapRenderAfterOpen() {
    queueMapRender();
    requestAnimationFrame(() => {
      queueMapRender();
      requestAnimationFrame(() => queueMapRender());
    });
  }

  function bindRoamCharFightEvents() {
    if (document.documentElement.dataset.roamCharFightBound === "1") return;
    document.documentElement.dataset.roamCharFightBound = "1";

    document.addEventListener("click", (e) => {
      const roamRoot = document.getElementById("roam-screen");
      if (!roamRoot?.classList.contains("is-open")) return;

      const fightBtn = e.target.closest?.("#roam-char-fight-btn, .roam-char-fight-btn");
      if (fightBtn instanceof HTMLElement && roamRoot.contains(fightBtn)) {
        e.preventDefault();
        e.stopPropagation();
        fightBtn.classList.add("is-pressed");
        window.setTimeout(() => fightBtn.classList.remove("is-pressed"), 140);
        void handleCharFightButtonClick();
        return;
      }
      const stopBtn = e.target.closest?.("#roam-char-fight-stop, .roam-char-fight-stop");
      if (stopBtn instanceof HTMLElement && roamRoot.contains(stopBtn)) {
        e.preventDefault();
        void stopCharFight();
        return;
      }
      const pickBtn = e.target.closest?.(".roam-char-pick-item");
      if (pickBtn instanceof HTMLElement && roamRoot.contains(pickBtn)) {
        e.preventDefault();
        e.stopPropagation();
        const charId = pickBtn.getAttribute("data-char-id");
        if (charId) void startCharFight(charId);
        return;
      }
      if (e.target instanceof HTMLElement) {
        if (
          e.target.id === "roam-char-picker-cancel" ||
          e.target.id === "roam-char-picker-backdrop"
        ) {
          closeCharPicker();
        }
      }
    });
  }

  function openRoamScreen() {
    state = readStore();
    sanitizeNearbyNamesInState();
    if (typeof closeSettings === "function") closeSettings();
    if (typeof closeMyScreen === "function") closeMyScreen();
    if (typeof closeCharScreen === "function") closeCharScreen();
    if (typeof closeChatScreen === "function") closeChatScreen();
    if (typeof closeChatListScreen === "function") closeChatListScreen();
    if (typeof closeCheckupScreen === "function") closeCheckupScreen();
    if (typeof closeRelationScreen === "function") closeRelationScreen();
    if (typeof closeRoleplayScreen === "function") closeRoleplayScreen();
    if (typeof closeStickerScreen === "function") closeStickerScreen();
    if (typeof closeWardrobeScreen === "function") closeWardrobeScreen();
    document.getElementById("drawer")?.classList.remove("open");
    screen?.classList.add("is-open");
    screen?.setAttribute("aria-hidden", "false");
    setTab("stroll");
    renderAll();
    ensureMapResizeObserver();
    scheduleMapRenderAfterOpen();
    (state.nearby || []).forEach((p) => {
      if (p && !p.moveInit && p.moveMode === "idle") decorateNearbyMovement(p);
    });
    writeStore();
    startNearbyMoveLoop();
    tickNearbyMovement();
    bindRoamCharFightEvents();
  }

  function closeRoamScreen() {
    stopNearbyMoveLoop();
    teardownMapResizeObserver();
    closeChatPanel();
    closeRoamWorldSheet();
    screen?.classList.remove("is-open");
    screen?.setAttribute("aria-hidden", "true");
  }

  window.openRoamScreen = openRoamScreen;
  window.closeRoamScreen = closeRoamScreen;

  document.getElementById("roam-close")?.addEventListener("click", closeRoamScreen);
  mapRecenterBtn?.addEventListener("click", () => {
    queueMapRender();
    pulseMapUser();
    if (typeof showToast === "function") showToast("已回到当前位置");
  });
  mapStage?.addEventListener("click", handleMapStagePointer);
  mapMarkers?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nearby-id]");
    if (!(btn instanceof HTMLElement)) return;
    e.stopPropagation();
    const id = btn.getAttribute("data-nearby-id");
    if (id) void openChatWithNearby(id);
  });
  rumorGatherBtn?.addEventListener("click", () => void generateRumorWithAI());
  rumorsList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".roam-rumor-investigate");
    if (!(btn instanceof HTMLElement)) return;
    const id = btn.getAttribute("data-rumor-id");
    if (id) void investigateRumor(id);
  });
  strollBtn?.addEventListener("click", () => void runStroll());
  strollFeed?.addEventListener("click", (e) => {
    const btn = e.target.closest(".roam-stroll-choice");
    if (!(btn instanceof HTMLElement)) return;
    const entryId = btn.getAttribute("data-entry-id");
    const idx = Number(btn.getAttribute("data-choice-idx"));
    if (entryId && Number.isFinite(idx)) void applyStrollChoice(entryId, idx);
  });
  bindRoamCharFightEvents();
  bindRoamMsgListSwipe();
  roamChatFriendBtn?.addEventListener("click", () => {
    const thread = activeThreadId ? findThread(activeThreadId) : null;
    const person = thread ? resolveThreadPerson(thread) : null;
    const meta = friendMetaFrom(person, thread);
    if (meta.friendStatus === "friend") {
      void openRoamFriendInMainChat();
      return;
    }
    void sendFriendRequestForActiveChat();
  });
  roamChatFriendAccept?.addEventListener("click", () => acceptInboundFriendRequest());
  roamChatFriendDecline?.addEventListener("click", () => declineInboundFriendRequest());
  roamWorldBtn?.addEventListener("click", openRoamWorldSheet);
  roamWorldBackdrop?.addEventListener("click", closeRoamWorldSheet);
  roamWorldClose?.addEventListener("click", closeRoamWorldSheet);
  roamWorldSave?.addEventListener("click", saveRoamWorldSettings);
  roamWbSearch?.addEventListener("input", renderRoamWorldBookPicker);
  roamWbChips?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-roam-wb-id]");
    if (!(btn instanceof HTMLElement)) return;
    toggleRoamWorldBookDraft(btn.getAttribute("data-roam-wb-id"));
  });
  roamWorldviewText?.addEventListener("input", updateRoamWorldSummary);
  refreshNearbyBtn?.addEventListener("click", () => {
    void generateNearbyAsync();
  });
  nearbyList?.addEventListener("click", (e) => {
    const chase = e.target.closest(".roam-nearby-chase");
    if (chase instanceof HTMLElement) {
      e.preventDefault();
      e.stopPropagation();
      const id = chase.getAttribute("data-chase-id");
      if (id) chaseNearbyPerson(id);
      return;
    }
    const btn = e.target.closest("[data-nearby-id]");
    if (!(btn instanceof HTMLElement)) return;
    const id = btn.getAttribute("data-nearby-id");
    if (id) void openChatWithNearby(id);
  });
  roamChatClose?.addEventListener("click", closeChatPanel);
  roamChatSend?.addEventListener("click", () => void sendChatMessage());
  roamSendChoiceContinue?.addEventListener("click", () => void continueStrangerAfterEmptySend());
  roamSendChoiceReroll?.addEventListener("click", () => {
    closeRoamSendChoiceDialog();
    void rerollLastStrangerReply();
  });
  roamSendChoiceCancel?.addEventListener("click", closeRoamSendChoiceDialog);
  roamSendChoiceBackdrop?.addEventListener("click", closeRoamSendChoiceDialog);
  roamChatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendChatMessage();
    }
  });
  document.querySelectorAll("#roam-screen .roam-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn instanceof HTMLElement ? btn.dataset.roamTab : "";
      if (tab) setTab(tab);
    });
  });
})();
