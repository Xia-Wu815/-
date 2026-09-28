/**
 * 聊天中插 HTML 卡片：自由 HTML 即兴道具（与功能卡、小剧场分离）。
 */
(function () {
  "use strict";

  const MARKER_PREFIX = "【插卡】";

  const MOOD_IDS = [
    "warm",
    "cool",
    "blush",
    "mint",
    "sunset",
    "dusk",
    "lavender",
    "amber",
    "rain",
    "ocean",
    "rose",
    "peach"
  ];

  const MOOD_ALIASES = {
    warm: "warm",
    暖: "warm",
    温馨: "warm",
    温暖: "warm",
    cool: "cool",
    冷: "cool",
    清冷: "cool",
    清爽: "cool",
    清: "cool",
    blush: "blush",
    粉: "blush",
    害羞: "blush",
    甜: "blush",
    mint: "mint",
    薄荷: "mint",
    清新: "mint",
    绿: "mint",
    sunset: "sunset",
    夕阳: "sunset",
    黄昏: "sunset",
    橙: "sunset",
    dusk: "dusk",
    夜: "dusk",
    深夜: "dusk",
    暗: "dusk",
    lavender: "lavender",
    紫: "lavender",
    薰衣草: "lavender",
    amber: "amber",
    金: "amber",
    琥珀: "amber",
    rain: "rain",
    雨: "rain",
    忧郁: "rain",
    灰: "rain",
    ocean: "ocean",
    海: "ocean",
    蓝: "ocean",
    rose: "rose",
    玫瑰: "rose",
    peach: "peach",
    桃: "peach"
  };

  /** @param {Record<string, string>} slots */
  function normalizeMoodId(slots) {
    const raw = String(slots.mood || slots.tint || slots.vibe || slots.color || "").trim();
    if (!raw) return "";
    const key = raw.toLowerCase();
    if (MOOD_ALIASES[raw]) return MOOD_ALIASES[raw];
    if (MOOD_ALIASES[key]) return MOOD_ALIASES[key];
    if (MOOD_IDS.includes(key)) return key;
    return "";
  }

  /** @param {Record<string, string>} slots */
  function moodClass(slots) {
    const id = normalizeMoodId(slots);
    return id ? ` xxj-ih--tint-${id}` : "";
  }

  /** 互动向形态（灵感池优先抽取） */
  const INLINE_HTML_INTERACT_INSPIRATION = [
    "刮刮乐/盲盒",
    "翻面证件/工牌",
    "旋转看背面",
    "二选一按钮",
    "折叠 details 展开",
    "刮开隐藏层",
    "点选签文/运势",
    "Tab 切换多页",
    "点按展开明细"
  ];

  function buildInlineHtmlInteractPolicyLines() {
    return [
      `【互动 · 优先】约 **2/3** 轮次的插卡须带 **≥1 种可点击互动**（纯静态展示卡仅用于极短寒暄或本轮确实无合适互动点）。`,
      `互动须**贴合道具**：盲盒/秘密/隐藏内容 → 刮刮乐；证件/工牌/卡片 → 翻面或点转；要不要/选哪个 → 二选一；长条款/日记/说明书 → \`<details><summary>…</summary>…</details>\`；多页菜单/报告 → Tab 或折叠。`,
      `近轮若是纯静态卡，本轮**优先**换互动形态（仍可保持同类道具外形）。`
    ];
  }

  function buildInlineHtmlInteractLines() {
    return [
      `互动写法（**勿写 onclick**）：`,
      `· 刮刮乐：\`<div data-xxj-scratch class="xxj-ihc-scratch">\` + \`.xxj-ihc-scratch-cover\`（写「刮开」）+ \`.xxj-ihc-scratch-body\`（可多 tap \`data-xxj-scratch-taps="2"\`）`,
      `· 翻面：\`data-xxj-flip\` 的 \`.xxj-ih__flip-stage\` > \`.xxj-ih__flip-inner\` > 正/反面两 \`.xxj-ih__flip-face\``,
      `· 点转：根元素 \`data-xxj-rotate\`（可选 \`data-xxj-rotate-deg="180"\`）`,
      `· 二选一：\`data-xxj-pick\` 按钮/chip + \`data-xxj-pick-msg="…"\`；同容器内 \`.xxj-ih__pick-reveal\` 或 \`[data-xxj-reveal-out]\` 显示反馈`,
      `· 折叠：\`data-xxj-toggle data-xxj-for="k"\` + \`[data-xxj-panel="k"]\`；或 Tab：\`data-xxj-tab\` / \`data-xxj-tab-panel\` / \`data-xxj-tab-group\``,
      `· 原生：\`<details><summary>…</summary>…</details>\` 可直接用（无需 data-*）`
    ];
  }

  /** 道具形似 + 样式自写（prompt 用，非固定模板） */
  function buildInlineHtmlPropFidelityLines() {
    return [
      `【形似 · 第一优先】须让人**一眼认出**本轮在发什么实物：先定道具类型，再用 **HTML 结构 + inline style** 捏出该实物的典型外观；**禁止**一律做成「圆角 div + 小标签 + 正文」。`,
      `各类型须自造 ≥2 条视觉线索（文案自拟，**style 自写**）：`,
      `· 奖状/证书 → 双线或金边 border、居中大字标题、受奖人姓名突出、正文、落款区、圆形印章（border-radius:50% + border）`,
      `· 小票/账单 → 窄长热敏纸比例、等宽 font-family、虚线分隔、合计行、可选条码块`,
      `· 优惠券 → 虚线券框、面额大字、撕口（clip-path 或 border 模拟）`,
      `· 处方/病历 → 白底表单、Rx 标记、字段行 label+值`,
      `· 通缉令 → 黄纸 background、粗黑大字居中`,
      `· 工牌 → 证件卡 grid、照片区色块、姓名+编号`,
      `· 警告牌 → 黄黑条纹 background 或高对比边框`,
      `**外形优先自写**：border、background、box-shadow、clip-path、font-family、letter-spacing、transform 等 inline 样式均可直接用；\`xxj-ih\` / \`xxj-ihc-*\` **仅作可选**（刮刮乐/翻面/点转须用约定 data-*），勿依赖预置 class 换字。`,
      `结构示例（须自改 style 与文案，勿照抄）：\`<div style="border:3px double #c8a048;padding:20px;text-align:center;background:#fffdf6;font-family:Georgia,serif"><div style="font-size:1rem;font-weight:900;letter-spacing:.3em">荣誉证书</div><div style="font-size:1.2rem;font-weight:800;margin:12px 0">姓名</div><div>事由…</div><div style="margin-top:14px;text-align:right"><span style="display:inline-flex;width:3rem;height:3rem;border:3px solid #c62828;border-radius:50%">章</span></div></div>\``
    ];
  }

  /** 即兴道具形态灵感池（仅作方向，非模板） */
  const INLINE_HTML_INSPIRATION = [
    "奖状/荣誉证书",
    "结业证/毕业证",
    "收银小票/外卖单",
    "优惠券/兑奖券",
    "警告牌/立入禁止",
    "黑板粉笔字",
    "霓虹灯牌",
    "便利贴/便签条",
    "快递面单",
    "叠放卡片/票根",
    "和纸胶带拼贴",
    "拍立得/相片角",
    "时间轴/行程表",
    "进度条/好感条",
    "检验报告/化验单",
    "菜单/价目表",
    "通缉令/寻人启事",
    "合同条款/签字页",
    "日记一页",
    "歌词条/playlist",
    "天气/温度/widget",
    "聊天截图/对话泡",
    "游戏 HUD/任务卡",
    "塔罗/签文/运势",
    "处方笺/病历",
    "登机牌/车票",
    "工牌/学生证",
    "包装标签/成分表"
  ];

  /** @param {string[]} recentHints @param {number} [count] */
  function pickInlineHtmlInspirationLines(recentHints, count = 4) {
    const n = Math.max(2, Math.min(6, count || 4));
    const nInteract = Math.min(3, Math.max(2, Math.ceil(n * 0.55)));
    const nStatic = Math.max(1, n - nInteract);
    const recent = (recentHints || []).map((h) => String(h || "").trim().toLowerCase()).filter(Boolean);
    const filterRecent = (idea) => {
      const low = idea.toLowerCase();
      return !recent.some((r) => low.includes(r.slice(0, 8)) || r.includes(low.slice(0, 6)));
    };
    const pickFrom = (bag, k) => {
      const filtered = bag.filter(filterRecent);
      const pool = filtered.length >= k ? filtered : bag;
      return pool
        .map((x) => ({ x, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .slice(0, k)
        .map((o) => o.x);
    };
    const interact = pickFrom(INLINE_HTML_INTERACT_INSPIRATION, nInteract);
    const stat = pickFrom(INLINE_HTML_INSPIRATION, nStatic);
    const merged = [...interact, ...stat]
      .map((x) => ({ x, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map((o) => o.x);
    return [
      `【形态灵感】${merged.slice(0, n).join(" · ")}（前 ${nInteract} 项偏**互动**；须**形似**且与近轮不同）`
    ];
  }

  /** @param {unknown[]} messages @param {number} [limit] */
  function collectRecentInlineHtmlMeta(messages, limit) {
    const max = Math.max(1, Math.min(5, limit || 3));
    /** @type {string[]} */
    const hints = [];
    if (!Array.isArray(messages)) return { hints };
    for (let i = messages.length - 1; i >= 0 && hints.length < max; i--) {
      const cards = peekCardsFromMessage(messages[i]);
      for (let j = cards.length - 1; j >= 0 && hints.length < max; j--) {
        const c = cards[j];
        const hint =
          extractCardStructureHint(c.html) ||
          String(c.title || "")
            .trim()
            .slice(0, 40);
        if (hint) hints.push(hint);
      }
    }
    return { hints };
  }

  /** @param {{ hints?: string[] }} recent */
  function buildInlineHtmlDiversityLines(recent) {
    const hints = recent?.hints || [];
    const lines = [
      `在**形似**前提下追求差异：每轮结构/配色/材质须不同；**不可**为差异而改成不像原物。`,
      `鼓励：**非常规**比例（窄长/横条/叠层/倾斜）、**非常规**材质（纸/玻璃/霓虹/粉笔/热敏纸）、**非常规**布局（表格/时间轴/价签/对话泡）。`,
      ...pickInlineHtmlInspirationLines(hints, 4)
    ];
    if (hints.length) {
      lines.push(`【勿重复】近轮：${hints.slice(0, 3).join(" │ ")} → 本轮换**不同**视觉，但须仍**像**本轮道具类型。`);
      if (!hints.some((h) => String(h).startsWith("interact:"))) {
        lines.push(`【互动】近轮插卡偏静态 → 本轮**须**带可点击互动。`);
      }
    }
    return lines;
  }

  function buildInlineHtmlRenderableRulesLines() {
    return [
      `【可见 · 硬规则】inlineHtmlCards[].html 经程序消毒后**仍须**有可展示内容：至少一处**可见简体中文**、有效 \`<img src="https://…">\`，或完整互动结构（刮刮乐/翻面/点转/二选一等须带文案或隐藏层）。`,
      `**禁止空壳占位**：仅 \`min-height\` / 空白 \`background\` 而无正文；未填写的 \`[AI填:…]\` / \`{{…}}\` 占位；正文全靠 \`script/style\` / \`onclick\`（会被剥离）；**白字白底**致不可读。`,
      `做不到合格插卡 → **omit 整个 inlineHtmlCards 键**（勿输出空白 div 占坑；程序也不会展示空壳）。`
    ];
  }

  /** @param {{ lastCardHint?: string, recentMeta?: { hints?: string[] } }} [opts] */
  function buildInlineHtmlAutoPrompt(opts) {
    const recent =
      opts?.recentMeta ||
      (opts?.lastCardHint ? { hints: [String(opts.lastCardHint)] } : { hints: [] });
    const lines = [
      `[插卡 · 即兴道具 · 自由 html]`,
      `插卡 = 聊天里**当场手做**的小道具：帮角色**做一件事**；**不是**摘要、**不是**摘原话、**不是**固定模板换字。`,
      ...buildInlineHtmlInteractPolicyLines(),
      ...buildInlineHtmlPropFidelityLines(),
      ...buildInlineHtmlDiversityLines(recent),
      ...buildInlineHtmlInteractLines(),
      ...buildInlineHtmlRenderableRulesLines(),
      `禁止 presetId、blocks、mini-chat。**禁止** fieldset/legend 与把 title/「小道具」写进可见 HTML；**必须**用 inlineHtmlCards[].html 写自由 HTML。`,
    ];
    return lines;
  }

  function makeCardId() {
    return `ih_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function stripInlineHtmlBrackets(html) {
    return String(html ?? "").replace(/[\[\]]/g, "");
  }

  /** @param {string} raw 模型误写入 lines/content 的 HTML 片段 */
  function looksLikeInlineHtmlCardFragment(raw) {
    const s = String(raw ?? "").trim();
    if (s.length < 12) return false;
    if (!/<\s*[a-z][\w-]*(?:\s[^>]*)?>/i.test(s)) return false;
    if (/\bxxj-ih\b/i.test(s)) return true;
    if (/^<\s*(div|section|article|aside|figure|table|ul|ol|details|button)\b/i.test(s)) return true;
    const tagCount = (s.match(/<\s*[a-z][\w-]*/gi) || []).length;
    return tagCount >= 2 && /<\/\s*[a-z]/i.test(s);
  }

  const INLINE_HTML_MARKER_HEAD = /(?:插卡|中插\s*HTML?)/iu;

  /** @param {string} t */
  function escapeInlineHtmlText(t) {
    return String(t ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** @param {string} title @param {string} body */
  function buildMarkerInlineHtmlCard(title, body) {
    const rawTitle = String(title || "").trim() || "小道具";
    const tag = escapeInlineHtmlText(rawTitle).slice(0, 80);
    const bodyHtml = escapeInlineHtmlText(String(body || "").trim()).replace(/\n/g, "<br>");
    if (!bodyHtml) return null;
    let html;
    if (/奖|证书|荣誉|结业|毕业|奖状/u.test(rawTitle)) {
      html = `<div style="border:3px double #c8a048;padding:20px 16px;text-align:center;background:linear-gradient(168deg,#fffdf6,#f6ecd8);font-family:Georgia,serif;color:#3a2e18"><div style="font-size:1rem;font-weight:900;letter-spacing:.28em;margin-bottom:12px">${tag}</div><div style="font-size:.9rem;line-height:1.8">${bodyHtml}</div></div>`;
    } else if (/小票|账单|收据|外卖/u.test(rawTitle)) {
      html = `<div style="max-width:17rem;margin:0 auto;padding:12px;font-family:ui-monospace,monospace;font-size:.78rem;line-height:1.55;background:#f4f2ee;color:#2a2824">${bodyHtml}</div>`;
    } else {
      html = `<div style="padding:14px 16px;border-radius:12px;border:1px solid rgba(140,160,200,.35);background:#faf8f5"><div style="font-size:.64rem;font-weight:800;letter-spacing:.12em;opacity:.7;margin-bottom:8px">${tag}</div><div style="font-size:.92rem;line-height:1.75">${bodyHtml}</div></div>`;
    }
    return { title: rawTitle.slice(0, 80), html };
  }

  /** 模型误用 `[插卡 小道具]：正文` 等纯文本（非 inlineHtmlCards.html） @param {string} raw */
  function parseInlineHtmlMarkerSegment(raw) {
    const s = String(raw ?? "").trim();
    if (!s || !INLINE_HTML_MARKER_HEAD.test(s)) return null;
    const patterns = [
      /^[[【]\s*(?:插卡|中插\s*HTML?)\s*[·•.\-—\s]*(.+?)[\]】]\s*[：:]\s*([\s\S]+)$/u,
      /^[[【]\s*(?:插卡|中插\s*HTML?)\s+(.+?)[\]】]\s*([\s\S]+)$/u,
      /^[[【]\s*(?:插卡|中插\s*HTML?)\s*[·•.\-—\s]*([^\]】]+)[\]】]\s*([\s\S]+)$/u,
      /^[[【](?:插卡|中插\s*HTML?)[\]】]\s*[：:]\s*([\s\S]+)$/u
    ];
    for (const re of patterns) {
      const m = re.exec(s);
      if (!m) continue;
      const title = (m.length >= 3 ? m[1] : "小道具").trim() || "小道具";
      const body = (m.length >= 3 ? m[2] : m[1]).trim().replace(/^[：:\s]+/u, "");
      const card = buildMarkerInlineHtmlCard(title, body);
      if (card) return card;
    }
    return null;
  }

  /** 一行里夹带 `[插卡 …]：…` 时抽出卡片，并返回去掉插卡后的剩余正文。 @param {string} raw */
  function scanInlineHtmlMarkerCards(raw) {
    const s = String(raw ?? "");
    if (!s.trim() || !INLINE_HTML_MARKER_HEAD.test(s)) return { cards: [], rest: s.trim() };
    const whole = parseInlineHtmlMarkerSegment(s);
    if (whole) return { cards: [whole], rest: "" };
    /** @type {{ title?: string, html?: string }[]} */
    const cards = [];
    let rest = s;
    const embeddedRe =
      /[[【]\s*(?:插卡|中插\s*HTML?)\s*[·•.\-—\s]*([^\]】]*)[\]】]\s*[：:]\s*([^\n【\[]+?)(?=\s*(?:[[【][^\]]*(?:插卡|中插)|$))/gu;
    let m;
    while ((m = embeddedRe.exec(s))) {
      const card = buildMarkerInlineHtmlCard(m[1], m[2]);
      if (card) cards.push(card);
    }
    if (cards.length) {
      rest = s
        .replace(
          /[[【]\s*(?:插卡|中插\s*HTML?)\s*[·•.\-—\s]*[^\]]*[\]】]\s*[：:]\s*[^\n【\[]+/gu,
          ""
        )
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    return { cards, rest };
  }

  /** 整段都是插卡（用于过滤气泡，不含「你好 [插卡]：…」这种混合段） @param {string} raw */
  function isWholeInlineHtmlBubbleSegment(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return false;
    if (s.startsWith(MARKER_PREFIX)) return true;
    const split = splitLeadingHtmlFromText(s);
    if (split) return !split.rest;
    if (parseInlineHtmlMarkerSegment(s)) return true;
    const scanned = scanInlineHtmlMarkerCards(s);
    if (scanned.cards.length && !String(scanned.rest || "").trim()) return true;
    return /^\[[^\]]*(?:插卡|中插\s*HTML?)[^\]]*\]\s*[：:]?\s*$/u.test(s);
  }

  /** 已从同段抽出卡片后，气泡里还应显示的剩余正文。 @param {string} raw */
  function bubbleTextAfterInlineHtmlExtract(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "";
    if (isWholeInlineHtmlBubbleSegment(s)) return "";
    const scanned = scanInlineHtmlMarkerCards(s);
    if (scanned.cards.length) return scanned.rest;
    return s;
  }

  /** @param {string} raw @returns {{ html: string, rest: string } | null} */
  function splitLeadingHtmlFromText(raw) {
    const s = String(raw ?? "").trim();
    if (!/^<\s*[a-z]/i.test(s)) return null;
    const box = document.createElement("div");
    box.innerHTML = s;
    const firstEl = box.firstElementChild;
    if (!(firstEl instanceof Element)) return null;
    const html = firstEl.outerHTML;
    if (html.length < 12) return null;
    const idx = s.indexOf(html);
    if (idx < 0) return null;
    const rest = s.slice(idx + html.length).trim();
    return { html, rest };
  }

  /** @param {string} html */
  function inlineHtmlBodyKey(html) {
    return String(html || "").replace(/\s+/g, " ").trim();
  }

  /** @param {{ html?: string, title?: string }[]} cards @param {string} html */
  function pushHoistedInlineHtmlCard(cards, html, title) {
    const h = String(html || "").trim();
    if (!h) return;
    const key = inlineHtmlBodyKey(h);
    if (cards.some((c) => inlineHtmlBodyKey(c.html) === key)) return;
    cards.push(...normalizeCardsOnMessage(title ? { html: h, title } : { html: h }));
  }

  /** @param {string} raw */
  function liftInlineHtmlCardFromLooseSegment(raw) {
    const t = String(raw ?? "").trim();
    if (!t) return null;
    if (looksLikeInlineHtmlCardFragment(t)) return { html: t };
    const marker = parseInlineHtmlMarkerSegment(t);
    if (marker) return marker;
    const scanned = scanInlineHtmlMarkerCards(t);
    if (scanned.cards.length === 1 && !scanned.rest) return scanned.cards[0];
    return null;
  }

  /** @param {string[]} parts @param {{ html?: string, title?: string }[]} [seed] */
  function hoistInlineHtmlCardsFromLineParts(parts, seed) {
    /** @type {{ html?: string, title?: string }[]} */
    const cards = Array.isArray(seed) ? seed.map((c) => ({ ...c })) : [];
    /** @type {string[]} */
    const kept = [];
    for (let i = 0; i < parts.length; i++) {
      const t = String(parts[i] ?? "").trim();
      if (!t) continue;
      const split = splitLeadingHtmlFromText(t);
      if (split) {
        pushHoistedInlineHtmlCard(cards, split.html);
        if (split.rest) kept.push(split.rest);
        continue;
      }
      const lifted = liftInlineHtmlCardFromLooseSegment(t);
      if (lifted) {
        pushHoistedInlineHtmlCard(cards, lifted.html, lifted.title);
        continue;
      }
      const scanned = scanInlineHtmlMarkerCards(t);
      if (scanned.cards.length) {
        for (const c of scanned.cards) pushHoistedInlineHtmlCard(cards, c.html, c.title);
        if (scanned.rest) kept.push(scanned.rest);
        continue;
      }
      if (/^\[[^\]]*(?:插卡|中插\s*HTML?)[^\]]*\]\s*[：:]?\s*$/u.test(t) && i + 1 < parts.length) {
        const merged = `${t}：${String(parts[i + 1] ?? "").trim()}`;
        const mergedSplit = splitLeadingHtmlFromText(merged);
        if (mergedSplit) {
          pushHoistedInlineHtmlCard(cards, mergedSplit.html);
          if (mergedSplit.rest) kept.push(mergedSplit.rest);
          i += 1;
          continue;
        }
        const mergedLift = liftInlineHtmlCardFromLooseSegment(merged);
        if (mergedLift) {
          pushHoistedInlineHtmlCard(cards, mergedLift.html, mergedLift.title);
          i += 1;
          continue;
        }
        const mergedScan = scanInlineHtmlMarkerCards(merged);
        if (mergedScan.cards.length) {
          for (const c of mergedScan.cards) pushHoistedInlineHtmlCard(cards, c.html, c.title);
          if (mergedScan.rest) kept.push(mergedScan.rest);
          i += 1;
          continue;
        }
      }
      kept.push(parts[i]);
    }
    return { parts: kept, cards: normalizeCardsOnMessage(cards) };
  }

  /**
   * 把 content 里夹带的 HTML 抽到 inlineHtmlCards，并从 content 剥离（修复混段 / 未入库）。
   * @param {Record<string, unknown>} m
   */
  function materializeInlineHtmlOnMessage(m) {
    if (!m || typeof m !== "object" || String(m.role || "") !== "assistant") return;
    const content = String(m.content ?? "").trim();
    const segs = content ? (content.includes("|||") ? content.split("|||") : [content]) : [];
    const seed = normalizeCardsOnMessage(m.inlineHtmlCards ?? null);
    const hoisted = hoistInlineHtmlCardsFromLineParts(segs, seed);
    const renderable = hoisted.cards.filter((c) => inlineHtmlCardIsRenderable(c));
    if (renderable.length) {
      m.inlineHtmlCards = renderable;
    } else if (seed.some((c) => inlineHtmlCardIsRenderable(c))) {
      m.inlineHtmlCards = seed.filter((c) => inlineHtmlCardIsRenderable(c));
    } else {
      delete m.inlineHtmlCards;
    }
    const nextContent = hoisted.parts
      .map((p) => String(p ?? "").trim())
      .filter(Boolean)
      .join("|||");
    if (nextContent !== content) m.content = nextContent;
  }

  /** @param {string} html */
  function extractCardStructureHint(html) {
    const h = String(html || "").trim();
    if (!h) return "";
    /** @type {string[]} */
    const classes = [];
    const re = /\bclass="([^"]*)"/g;
    let m;
    while ((m = re.exec(h))) {
      m[1].split(/\s+/).forEach((c) => {
        if (!c || classes.length >= 8) return;
        if (/^xxj-ih--(?!tint-)/.test(c) || /^xxj-ihc-/.test(c) || /^[a-z][\w-]{2,}$/i.test(c)) classes.push(c);
      });
    }
    if (classes.length) return [...new Set(classes)].slice(0, 6).join(" ");
    if (/data-xxj-scratch|xxj-ihc-scratch/i.test(h)) return "interact:scratch";
    if (/data-xxj-flip|xxj-ih__flip-stage/i.test(h)) return "interact:flip";
    if (/data-xxj-rotate/i.test(h)) return "interact:rotate";
    if (/data-xxj-pick|xxj-ih__pick-chip/i.test(h)) return "interact:pick";
    if (/data-xxj-toggle|data-xxj-tab|<details/i.test(h)) return "interact:expand";
    if (/border:\s*[^;]*double/i.test(h)) return "inline:cert-border";
    if (/ui-monospace|Consolas|monospace/i.test(h)) return "inline:receipt";
    if (/repeating-linear-gradient[^;]*(?:#f0c020|yellow)/i.test(h)) return "inline:warning";
    return "";
  }

  /** @param {unknown[]} messages */
  function hintFromRecentInlineHtmlCard(messages) {
    if (!Array.isArray(messages)) return "";
    for (let i = messages.length - 1; i >= 0; i--) {
      const cards = peekCardsFromMessage(messages[i]);
      if (!cards.length) continue;
      const last = cards[cards.length - 1];
      return extractCardStructureHint(last.html) || String(last.title || "").trim();
    }
    return "";
  }

  /** @param {HTMLElement} root */
  function normalizeInlineHtmlDom(root) {
    if (!(root instanceof HTMLElement)) return;
    root.querySelectorAll("fieldset").forEach((fs) => {
      if (!(fs instanceof HTMLFieldSetElement)) return;
      const legend = fs.querySelector(":scope > legend");
      if (legend instanceof HTMLElement) {
        const legText = String(legend.textContent || "").trim();
        if (/^(?:插卡[·•.\s-]*)?(?:小道具|卡片)$/u.test(legText)) legend.remove();
      }
      const div = document.createElement("div");
      if (fs.getAttribute("style")) div.setAttribute("style", fs.getAttribute("style") || "");
      if (fs.getAttribute("class")) div.setAttribute("class", fs.getAttribute("class") || "");
      while (fs.firstChild) div.appendChild(fs.firstChild);
      fs.replaceWith(div);
    });
    root.querySelectorAll(".xxj-ihc-tag").forEach((tag) => {
      if (!(tag instanceof HTMLElement)) return;
      const txt = String(tag.textContent || "").trim();
      if (/^(?:插卡[·•.\s-]*)?(?:小道具|卡片)$/u.test(txt)) tag.remove();
    });
  }

  /** 消毒/归一化后是否无可读内容（避免只剩 min-height 白壳占位）。 @param {HTMLElement} root */
  function isInlineHtmlProseVisuallyEmpty(root) {
    if (!(root instanceof HTMLElement)) return true;
    const text = String(root.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) return false;
    if (
      root.querySelector(
        "img[src], video, audio, canvas, svg, hr, iframe, [data-xxj-scratch], .xxj-ihc-scratch, .xxj-ih__flip-stage, [data-xxj-flip], [data-xxj-rotate], [data-xxj-pick], details, button, input, textarea"
      )
    ) {
      return false;
    }
    return true;
  }

  /** @param {{ html?: string } | string | null | undefined} cardOrHtml */
  function inlineHtmlCardIsRenderable(cardOrHtml) {
    const raw =
      typeof cardOrHtml === "string"
        ? cardOrHtml
        : String(
            cardOrHtml && typeof cardOrHtml === "object" ? cardOrHtml.html : ""
          ).trim();
    if (!raw) return false;
    const s = stripInlineHtmlBrackets(raw);
    if (!s) return false;
    const san =
      typeof window.sanitizeInlineHtmlCardHtml === "function"
        ? window.sanitizeInlineHtmlCardHtml(s)
        : typeof window.sanitizeRichHtml === "function"
          ? window.sanitizeRichHtml(s)
          : s;
    if (!String(san || "").trim()) return false;
    const box = document.createElement("div");
    box.innerHTML = san || s;
    normalizeInlineHtmlDom(box);
    return !isInlineHtmlProseVisuallyEmpty(box);
  }

  /** @param {HTMLElement|null} el @param {string} raw @returns {boolean} */
  function fillInlineHtmlProseEl(el, raw) {
    if (!el) return false;
    initInlineHtmlChatDelegation();
    const s = stripInlineHtmlBrackets(String(raw ?? ""));
    el.classList.toggle("rich-prose--html", Boolean(s));
    if (!s) {
      el.textContent = "";
      return false;
    }
    const san =
      typeof window.sanitizeInlineHtmlCardHtml === "function"
        ? window.sanitizeInlineHtmlCardHtml(s)
        : typeof window.sanitizeRichHtml === "function"
          ? window.sanitizeRichHtml(s)
          : s;
    el.innerHTML = san || s;
    normalizeInlineHtmlDom(el);
    wireInteractiveInProse(el);
    if (isInlineHtmlProseVisuallyEmpty(el)) {
      el.textContent = "";
      el.classList.remove("rich-prose--html");
      return false;
    }
    return true;
  }

  function bindPressable(el, fn) {
    if (!(el instanceof HTMLElement) || el.dataset.xxjPressWired === "1") return;
    el.dataset.xxjPressWired = "1";
    const run = (e) => {
      if (e instanceof Event) {
        e.preventDefault();
        e.stopPropagation();
      }
      fn();
    };
    el.addEventListener("click", run);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        fn();
      }
    });
  }

  const SCRATCH_HINT_RE = /刮(?:开|一刮|掉|层|看看)/;

  /** 模型自由 html 常漏 data-xxj-scratch；按「刮开」文案自动补全结构。 @param {HTMLElement} root */
  function upgradeFreeformScratch(root) {
    if (!(root instanceof HTMLElement)) return;
    const seen = new Set();
    root.querySelectorAll("*").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.closest("[data-xxj-scratch], .xxj-ihc-scratch")) return;
      if (/\bscratch\b/i.test(node.className) || /刮/.test(node.className)) {
        const host = node.classList.contains("xxj-ihc-scratch-cover") ? node.parentElement : node;
        if (host instanceof HTMLElement && !host.hasAttribute("data-xxj-scratch") && !seen.has(host)) {
          host.classList.add("xxj-ihc-scratch");
          host.setAttribute("data-xxj-scratch", "");
          seen.add(host);
        }
        return;
      }
      const ownText = Array.from(node.childNodes)
        .filter(
          (n) =>
            n.nodeType === Node.TEXT_NODE ||
            (n.nodeType === Node.ELEMENT_NODE && /** @type {Element} */ (n).tagName === "BR")
        )
        .map((n) => n.textContent || "")
        .join("")
        .trim();
      if (!ownText || !SCRATCH_HINT_RE.test(ownText) || ownText.length > 48) return;
      if (node.querySelector("[data-xxj-scratch], .xxj-ihc-scratch")) return;
      const parent = node.parentElement;
      if (!(parent instanceof HTMLElement) || seen.has(parent)) return;
      if (parent === root) {
        seen.add(node);
        node.classList.add("xxj-ihc-scratch");
        node.setAttribute("data-xxj-scratch", "");
        return;
      }
      seen.add(parent);
      parent.classList.add("xxj-ihc-scratch");
      parent.setAttribute("data-xxj-scratch", "");
      node.classList.add("xxj-ihc-scratch-cover");
      node.setAttribute("data-xxj-scratch-cover", "");
    });
  }

  /** 补全刮刮乐遮罩/内容两层（模型常只写 data-xxj-scratch 或单层 div）。 @param {HTMLElement} box */
  function normalizeScratchDom(box) {
    if (!(box instanceof HTMLElement)) return;
    box.classList.add("xxj-ihc-scratch");
    if (!box.hasAttribute("data-xxj-scratch")) box.setAttribute("data-xxj-scratch", "");
    /** @type {HTMLElement[]} */
    const kids = [...box.children].filter((c) => c instanceof HTMLElement);
    let cover = box.querySelector(":scope > [data-xxj-scratch-cover], :scope > .xxj-ihc-scratch-cover");
    let body = box.querySelector(":scope > [data-xxj-scratch-body], :scope > .xxj-ihc-scratch-body");
    if (!cover && !body && kids.length >= 2) {
      cover = kids[0];
      cover.classList.add("xxj-ihc-scratch-cover");
      cover.setAttribute("data-xxj-scratch-cover", "");
      body = document.createElement("div");
      body.className = "xxj-ihc-scratch-body";
      body.setAttribute("data-xxj-scratch-body", "");
      for (let i = 1; i < kids.length; i++) body.appendChild(kids[i]);
      box.appendChild(body);
    } else if (!cover && body instanceof HTMLElement && kids.length >= 2) {
      const bi = kids.indexOf(body);
      if (bi > 0) {
        cover = kids[bi - 1];
        cover.classList.add("xxj-ihc-scratch-cover");
        cover.setAttribute("data-xxj-scratch-cover", "");
      }
    } else if (!cover && !body && kids.length === 1) {
      const only = kids[0];
      const txt = String(only.textContent || "").trim();
      if (SCRATCH_HINT_RE.test(txt) || /\bscratch-cover\b/i.test(only.className)) {
        only.classList.add("xxj-ihc-scratch-cover");
        only.setAttribute("data-xxj-scratch-cover", "");
        body = document.createElement("div");
        body.className = "xxj-ihc-scratch-body";
        body.setAttribute("data-xxj-scratch-body", "");
        body.innerHTML = "<span class=\"xxj-ihc-meta\">（刮开可见）</span>";
        box.appendChild(body);
      }
    }
    if (cover instanceof HTMLElement && !(body instanceof HTMLElement)) {
      body = document.createElement("div");
      body.className = "xxj-ihc-scratch-body";
      body.setAttribute("data-xxj-scratch-body", "");
      body.innerHTML = "<span class=\"xxj-ihc-meta\">（已刮开）</span>";
      box.appendChild(body);
    }
  }

  /** @param {HTMLElement} box */
  function scratchRevealStep(box) {
    if (!(box instanceof HTMLElement) || box.classList.contains("is-revealed")) return;
    const need = Math.max(1, Math.min(5, Number(box.getAttribute("data-xxj-scratch-taps")) || 1));
    const n = Number(box.dataset.xxjScratchCount || "0") + 1;
    box.dataset.xxjScratchCount = String(n);
    for (let s = 1; s <= 5; s++) box.classList.remove(`xxj-ihc-scratch--step-${s}`);
    box.classList.add(`xxj-ihc-scratch--step-${Math.min(n, need)}`);
    box.classList.add("is-scratch-tap");
    window.setTimeout(() => box.classList.remove("is-scratch-tap"), 180);
    try {
      navigator.vibrate?.(n >= need ? 14 : 8);
    } catch {
      /* ignore */
    }
    if (n >= need) {
      box.classList.add("is-revealed");
      box.setAttribute("aria-label", "已刮开");
      box.querySelectorAll("[data-xxj-scratch-cover], .xxj-ihc-scratch-cover").forEach((cover) => {
        if (cover instanceof HTMLElement) {
          cover.classList.add("is-revealed");
          cover.setAttribute("aria-hidden", "true");
        }
      });
    }
  }

  /** @param {HTMLElement} box */
  function bindScratchBox(box) {
    if (!(box instanceof HTMLElement)) return;
    normalizeScratchDom(box);
    if (box.dataset.xxjScratchWired === "1") return;
    box.dataset.xxjScratchWired = "1";
    if (!box.hasAttribute("tabindex")) box.setAttribute("tabindex", "0");
    if (!box.hasAttribute("role")) box.setAttribute("role", "button");
    if (!box.getAttribute("aria-label")) box.setAttribute("aria-label", "刮刮卡，点按刮开");
  }

  /** 聊天区统一委托：避免行 DOM 复用 / 移动端 click 丢失。 */
  function initInlineHtmlChatDelegation() {
    const root = document.getElementById("chat-messages");
    if (!root || root.dataset.xxjIhScratchDelegate === "1") return;
    root.dataset.xxjIhScratchDelegate = "1";
    root.addEventListener(
      "pointerup",
      (e) => {
        if (!e.isPrimary) return;
        const t = e.target instanceof Element ? e.target : null;
        if (!t?.closest(".chat-inline-html-prose")) return;
        if (
          t.closest(
            "[data-xxj-flip], .xxj-ih__flip-stage, [data-xxj-rotate], [data-xxj-pick], [data-xxj-toggle], [data-xxj-tab], .xxj-ih__pick-chip, .xxj-ihc-chip[data-xxj-pick]"
          )
        ) {
          return;
        }
        const box = t.closest("[data-xxj-scratch], .xxj-ihc-scratch");
        if (!(box instanceof HTMLElement)) return;
        e.stopPropagation();
        normalizeScratchDom(box);
        scratchRevealStep(box);
      },
      true
    );
    root.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const t = e.target instanceof Element ? e.target : null;
        if (
          t?.closest(
            "[data-xxj-flip], .xxj-ih__flip-stage, [data-xxj-rotate], [data-xxj-pick], [data-xxj-toggle], [data-xxj-tab], .xxj-ih__pick-chip, .xxj-ihc-chip[data-xxj-pick]"
          )
        ) {
          return;
        }
        const box = t?.closest("[data-xxj-scratch], .xxj-ihc-scratch");
        if (!(box instanceof HTMLElement) || !box.closest(".chat-inline-html-prose")) return;
        e.preventDefault();
        e.stopPropagation();
        normalizeScratchDom(box);
        scratchRevealStep(box);
      },
      true
    );
  }

  /** @param {Element|null} el */
  function isInteractiveInlineHtmlTarget(el) {
    if (!(el instanceof Element)) return false;
    return Boolean(
      el.closest(
        "[data-xxj-scratch], [data-xxj-flip], [data-xxj-rotate], [data-xxj-pick], [data-xxj-toggle], [data-xxj-tab], .xxj-ih__flip-stage, .xxj-ihc-scratch, .xxj-ih__pick-chip, .xxj-ihc-scratch-cover, [data-xxj-scratch-cover]"
      )
    );
  }

  /** @param {HTMLElement} root */
  function wireInteractiveInProse(root) {
    if (!(root instanceof HTMLElement)) return;
    upgradeFreeformScratch(root);
    const flipStages = new Set();
    root.querySelectorAll("[data-xxj-flip], .xxj-ih__flip-stage").forEach((stage) => {
      if (!(stage instanceof HTMLElement)) return;
      flipStages.add(stage);
    });
    flipStages.forEach((stage) => {
      if (!stage.hasAttribute("data-xxj-flip")) stage.setAttribute("data-xxj-flip", "");
      if (!stage.hasAttribute("tabindex")) stage.setAttribute("tabindex", "0");
      if (!stage.hasAttribute("role")) stage.setAttribute("role", "button");
      bindPressable(stage, () => stage.classList.toggle("is-flipped"));
    });
    root.querySelectorAll("[data-xxj-rotate]").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const rawDeg = String(el.getAttribute("data-xxj-rotate-deg") || "180").trim();
      const deg = /deg$/i.test(rawDeg) ? rawDeg : `${rawDeg}deg`;
      el.style.setProperty("--xxj-rot-deg", deg);
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      if (!el.hasAttribute("role")) el.setAttribute("role", "button");
      bindPressable(el, () => el.classList.toggle("is-rotated"));
    });
    root.querySelectorAll("[data-xxj-pick]").forEach((chip) => {
      if (!(chip instanceof HTMLElement)) return;
      bindPressable(chip, () => {
        const host = chip.closest(".xxj-ih--pick, .xxj-ih--compose, .xxj-ihc-stack, .xxj-ih");
        host?.querySelectorAll("[data-xxj-pick]").forEach((c) => c.classList.remove("is-picked"));
        chip.classList.add("is-picked");
        const msg = chip.getAttribute("data-xxj-pick-msg") || chip.textContent || "";
        const reveal =
          host?.querySelector("[data-xxj-reveal-out]") ||
          host?.querySelector(".xxj-ih__pick-reveal") ||
          host?.querySelector(".xxj-ihc-reveal");
        if (reveal instanceof HTMLElement) reveal.textContent = msg;
      });
    });
    root.querySelectorAll("[data-xxj-toggle]").forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      bindPressable(btn, () => {
        const key = btn.getAttribute("data-xxj-for") || btn.getAttribute("data-xxj-target") || "";
        if (!key) return;
        const panel = root.querySelector(`[data-xxj-panel="${CSS.escape(key)}"]`);
        if (panel instanceof HTMLElement) panel.classList.toggle("xxj-ihc-collapsed");
      });
    });
    root.querySelectorAll("[data-xxj-tab]").forEach((tab) => {
      if (!(tab instanceof HTMLElement)) return;
      bindPressable(tab, () => {
        const key = tab.getAttribute("data-xxj-tab") || "";
        const group = tab.closest("[data-xxj-tab-group]") || root;
        if (!key || !(group instanceof HTMLElement)) return;
        group.querySelectorAll("[data-xxj-tab]").forEach((t) => t.classList.remove("is-picked"));
        tab.classList.add("is-picked");
        group.querySelectorAll("[data-xxj-tab-panel]").forEach((p) => {
          if (!(p instanceof HTMLElement)) return;
          const on = p.getAttribute("data-xxj-tab-panel") === key;
          p.classList.toggle("xxj-ihc-collapsed", !on);
        });
      });
    });
    root.querySelectorAll("[data-xxj-scratch], .xxj-ihc-scratch").forEach((box) => {
      if (box instanceof HTMLElement) bindScratchBox(box);
    });
  }

  /** @param {Record<string, unknown>} rec @param {Record<string, string>} slots */
  function mergeCardMoodSlots(rec, slots) {
    /** @type {Record<string, string>} */
    const merged = { ...slots };
    const topMood = rec.mood ?? rec.tint ?? rec.vibe;
    if (topMood != null && String(topMood).trim()) merged.mood = String(topMood).trim();
    return merged;
  }

  /** @param {string} html @param {Record<string, string>} slots */
  function applyMoodToHtml(html, slots) {
    if (!normalizeMoodId(slots) || /\bxxj-ih--tint-/.test(html)) return html;
    const mc = moodClass(slots);
    if (!mc) return html;
    const replaced = html.replace(/class="([^"]*\bxxj-ih\b[^"]*)"/, (_, cls) => `class="${cls}${mc}"`);
    return replaced !== html ? replaced : html;
  }

  /** @param {string} html @param {Record<string, unknown>} rec @param {Record<string, string>} slots */
  function finalizeCardHtml(html, rec, slots) {
    const merged = mergeCardMoodSlots(rec, slots);
    let h = stripInlineHtmlBrackets(html).trim();
    if (!h) return "";
    if (/\bxxj-ih\b/.test(h)) h = applyMoodToHtml(h, merged);
    return h;
  }

  /** @param {{ lastCardHint?: string, recentMeta?: { hints?: string[] } }} [opts] */
  function buildRerollPromptLines(opts) {
    const lastHint = String(opts?.lastCardHint || "").trim();
    const recent =
      opts?.recentMeta || (lastHint ? { hints: [lastHint] } : { hints: [] });
    return [
      `[插卡重 roll · 仅 JSON]`,
      `用户要求**只重生成**本条回复的插卡。请**仅**输出一个 JSON 对象，根字段只要 **inlineHtmlCards**（数组长度 1）。`,
      `**不要**输出 lines、heartVoice、thinking 等其它键；不要 markdown 围栏。`,
      ...buildInlineHtmlAutoPrompt({ recentMeta: recent }),
      ...buildInlineHtmlRenderableRulesLines(),
      lastHint ? `须与当前插卡（${lastHint.slice(0, 80)}）**不同**视觉；若近轮为静态卡则本轮**须带互动**。` : "本轮插卡**须带至少一种可点击互动**。",
      `html 禁止半角方括号。`
    ].filter(Boolean);
  }

  /** @param {unknown} raw @returns {{ id: string, presetId: string, title: string, html: string, insertAfterSeg?: number }[]} */
  function normalizeCardsOnMessage(raw) {
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    /** @type {{ id: string, presetId: string, title: string, html: string, insertAfterSeg?: number }[]} */
    const out = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const rec = /** @type {Record<string, unknown>} */ (item);
      const htmlRaw = String(rec.html || "").trim();
      if (!htmlRaw) continue;
      const slots =
        rec.slots && typeof rec.slots === "object" && !Array.isArray(rec.slots)
          ? /** @type {Record<string, string>} */ (rec.slots)
          : {};
      const html = finalizeCardHtml(htmlRaw, rec, slots);
      if (!html) continue;
      const iasRaw = rec.insertAfterSeg;
      const insertAfterSeg = Number.isFinite(Number(iasRaw)) ? Math.floor(Number(iasRaw)) : undefined;
      out.push({
        id: String(rec.id || makeCardId()).trim() || makeCardId(),
        presetId: "custom",
        title: String(rec.title || "小道具").trim().slice(0, 80),
        html: html.slice(0, 48_000),
        ...(insertAfterSeg !== undefined ? { insertAfterSeg } : {})
      });
    }
    return out;
  }

  /** 只读预览卡片（不改写 content / inlineHtmlCards）。 @param {unknown} m */
  function peekCardsFromMessage(m) {
    if (!m || typeof m !== "object") return [];
    const rec = /** @type {Record<string, unknown>} */ (m);
    const seed = normalizeCardsOnMessage(rec.inlineHtmlCards ?? null);
    const content = String(rec.content ?? "").trim();
    if (!content && seed.length) return seed;
    const segs = content ? (content.includes("|||") ? content.split("|||") : [content]) : [];
    return hoistInlineHtmlCardsFromLineParts(segs, seed).cards;
  }

  /** @param {unknown} m */
  function readCardsFromMessage(m) {
    if (!m || typeof m !== "object") return [];
    materializeInlineHtmlOnMessage(/** @type {Record<string, unknown>} */ (m));
    return normalizeCardsOnMessage(
      /** @type {Record<string, unknown>} */ (m).inlineHtmlCards ?? null
    );
  }

  /** @param {unknown} m */
  function messageHasInlineHtmlCards(m) {
    return peekCardsFromMessage(m).some((c) => inlineHtmlCardIsRenderable(c));
  }

  /** @param {unknown} m */
  function countRenderableInlineHtmlCardsFromMessage(m) {
    return readCardsFromMessage(m).filter((c) => inlineHtmlCardIsRenderable(c)).length;
  }

  /** @param {unknown} o */
  function parseFromAssistantJson(o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return [];
    const rec = /** @type {Record<string, unknown>} */ (o);
    const raw = rec.inlineHtmlCards ?? rec.inlineHtmlCard ?? rec.inlineHtml ?? null;
    return normalizeCardsOnMessage(raw);
  }

  /** @param {{ title?: string, presetId?: string, html?: string }[]} cards */
  function formatCardsForApi(cards) {
    const arr = (Array.isArray(cards) ? cards : []).filter((c) => inlineHtmlCardIsRenderable(c));
    if (!arr.length) return "";
    return arr
      .map((c) => {
        const plain =
          typeof window.htmlToPlainTextForPrompt === "function"
            ? window.htmlToPlainTextForPrompt(c.html)
            : String(c.html || "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        return `[插卡·${c.title || "卡片"}] ${plain.slice(0, 400)}`;
      })
      .join("\n");
  }

  /**
   * @param {HTMLElement} stack
   * @param {{ id?: string, title?: string, html?: string }} card
   * @param {unknown} m
   * @param {string} role
   * @param {number} cardIdx
   * @param {number | null | "trailing"} afterSeg
   * @param {number} ordInGroup
   * @param {number} [segStart]
   */
  function appendOneInlineHtmlCardToStack(stack, card, m, role, cardIdx, afterSeg, ordInGroup, segStart) {
    if (!inlineHtmlCardIsRenderable(card)) return;
    const wrap = document.createElement("div");
    wrap.className = "chat-msg-card chat-msg-card--inline-html";
    const placementKey = afterSeg === "trailing" ? null : afterSeg;
    const domSeg =
      typeof window.resolveSheetDomSegForInlineHtmlCardPlacement === "function"
        ? window.resolveSheetDomSegForInlineHtmlCardPlacement(m, role, placementKey, ordInGroup)
        : typeof window.resolveSheetDomSegForInlineHtmlCard === "function"
          ? window.resolveSheetDomSegForInlineHtmlCard(m, role, cardIdx)
          : null;
    wrap.dataset.chatBubbleSeg = String(domSeg != null ? domSeg : (segStart ?? 0) + cardIdx);
    wrap.setAttribute("role", "article");
    wrap.setAttribute("aria-label", card.title || "插卡");
    const prose = document.createElement("div");
    prose.className = "chat-inline-html-prose rich-prose rich-prose--html";
    fillInlineHtmlProseEl(prose, card.html);
    wrap.appendChild(prose);
    stack.appendChild(wrap);
  }

  /**
   * 全部卡片固定追加在 stack 末尾（忽略 insertAfterSeg，与 render 一致）。
   * @param {HTMLElement} stack
   * @param {unknown} m
   * @param {number} [segStart]
   */
  function appendCardsToStack(stack, m, segStart) {
    if (!(stack instanceof HTMLElement)) return 0;
    const cards = readCardsFromMessage(m);
    if (!cards.length) return 0;
    const role = m && typeof m === "object" ? String(m.role || "") : "";
    cards.forEach((card, ci) => {
      appendOneInlineHtmlCardToStack(stack, card, m, role, ci, "trailing", ci, segStart);
    });
    return cards.length;
  }

  /** @param {unknown} m */
  function messageReuseFingerprint(m) {
    const cards = readCardsFromMessage(m).filter((c) => inlineHtmlCardIsRenderable(c));
    if (!cards.length) return "";
    return cards.map((c) => `${c.title}|${String(c.html || "").length}`).join(";");
  }

  /** @param {string} name @param {string} userCall @param {{ autoEnabled?: boolean, timeAwareEnabled?: boolean, lastCardHint?: string, recentMeta?: { hints?: string[] } }} [opts] @returns {string[]} */
  function buildPromptLines(name, userCall, opts) {
    const auto = Boolean(opts && opts.autoEnabled === true);
    const timeAware = Boolean(opts && opts.timeAwareEnabled);
    const recentMeta =
      opts?.recentMeta ||
      (opts?.lastCardHint ? { hints: [String(opts.lastCardHint)] } : { hints: [] });

    if (!auto) {
      return [
        `[中插 HTML · 已关闭自动 · ${name} 发给 ${userCall}]`,
        `本密谈**已关闭**中插 HTML：**不要**输出 inlineHtmlCards（勿在 JSON 根写该字段）。`
      ];
    }

    return [
      `[中插 HTML · 自动 · ${name} 发给 ${userCall}]`,
      `本密谈已开启中插 HTML：**除极短寒暄外，本轮尽量带 inlineHtmlCards**（1 张，与 lines 同轮）；**优先可点击互动**（刮开/翻面/点转/二选一/details），勿只做静态展示。做不出**可见**插卡则 **omit 整键**，禁止空壳占位。`,
      ...buildInlineHtmlAutoPrompt({ recentMeta }),
      `贴合本轮场面（不限情绪），但勿复述对话；**道具外形须贴合角色本轮在发的东西**。`,
      ...(timeAware
        ? [`插卡须符合 **[REAL TIME AWARENESS] / Wall-Clock Anchor** 当前时段。`]
        : [])
    ];
  }

  /** @param {string} userCall */
  function buildUserLexiconLine(userCall) {
    return `- ${MARKER_PREFIX}…：仅旧记录可能出现；${userCall} 侧已不能新发插卡。若见到，按卡片接戏，勿复述标签。`;
  }

  window.XXJ_InlineHtml = {
    normalizeCardsOnMessage,
    readCardsFromMessage,
    messageHasInlineHtmlCards,
    inlineHtmlCardIsRenderable,
    countRenderableInlineHtmlCardsFromMessage,
    parseFromAssistantJson,
    formatCardsForApi,
    appendCardsToStack,
    messageReuseFingerprint,
    makeCardId,
    buildPromptLines,
    buildRerollPromptLines,
    buildUserLexiconLine,
    hintFromRecentInlineHtmlCard,
    collectRecentInlineHtmlMeta,
    looksLikeInlineHtmlCardFragment,
    isWholeInlineHtmlBubbleSegment,
    bubbleTextAfterInlineHtmlExtract,
    materializeInlineHtmlOnMessage,
    hoistInlineHtmlCardsFromLineParts,
    fillInlineHtmlProseEl,
    wireInteractiveInProse,
    isInteractiveInlineHtmlTarget,
    MARKER_PREFIX
  };

  window.fillInlineHtmlProseEl = fillInlineHtmlProseEl;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initInlineHtmlChatDelegation);
  } else {
    initInlineHtmlChatDelegation();
  }
})();
