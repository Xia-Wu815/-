"use strict";

/**
 * 关系网 · AI 整理（单角色 · 人设 + 绑定世界书全文 · 预览后写入）
 */
(function () {
  const R = () => window.__relationInternals;
  const apiSheet = document.getElementById("relation-api-sheet");
  const apiEntryMeta = document.getElementById("relation-api-entry-meta");
  const aiSourceEl = document.getElementById("relation-ai-source");
  const aiProfileWrapEl = document.getElementById("relation-ai-profile-wrap");
  const aiProfileEl = document.getElementById("relation-ai-profile");
  const aiFieldsEl = document.getElementById("relation-ai-fields");
  const aiBaseEl = document.getElementById("relation-ai-base");
  const aiKeyEl = document.getElementById("relation-ai-key");
  const aiKeyNoteEl = document.getElementById("relation-ai-key-note");
  const aiModelEl = document.getElementById("relation-ai-model");
  const aiTempEl = document.getElementById("relation-ai-temperature");
  const aiTempValueEl = document.getElementById("relation-ai-temp-value");
  const aiStatusEl = document.getElementById("relation-ai-status");
  const previewSheet = document.getElementById("relation-ai-preview");
  const previewTargetEl = document.getElementById("relation-ai-preview-target");
  const previewListEl = document.getElementById("relation-ai-preview-list");
  const previewEmptyEl = document.getElementById("relation-ai-preview-empty");
  const previewApplyBtn = document.getElementById("relation-ai-preview-apply");

  /** @type {{ kind: string, checked: boolean, existingIdx: number, charId: string, name: string, stage: string, label: string, detail: string, avatar: string }[]} */
  let previewRows = [];
  let organizeBusy = false;

  function toast(msg) {
    if (typeof showToast === "function") showToast(msg);
  }

  function wbRepl(text, charName, userName) {
    const fn = typeof replaceCharUserWorldBookPlaceholders === "function"
      ? replaceCharUserWorldBookPlaceholders
      : null;
    if (fn) return fn(String(text || ""), charName, userName);
    return String(text || "");
  }

  function normalizeRelationAiTemperature(v, fallback) {
    const n = Number(v);
    const fb = Number(fallback);
    const base = Number.isFinite(n) ? n : Number.isFinite(fb) ? fb : 0.35;
    return Math.min(2, Math.max(0, Math.round(base * 100) / 100));
  }

  function normalizeRelationAiConfig(raw) {
    const ai = window.RP_AI;
    const defBase = ai?.DEFAULT_BASE || "https://api.openai.com/v1";
    const defModel = ai?.DEFAULT_MODEL || "gpt-4o-mini";
    const o = raw && typeof raw === "object" ? raw : {};
    let apiMode = String(o.apiMode || "").trim();
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
      model: String(o.model || "").trim() || defModel,
      temperature: normalizeRelationAiTemperature(o.temperature, 0.35)
    };
  }

  function readRelationAiProfiles() {
    const ai = window.RP_AI;
    if (!ai?.readProfiles) return [];
    return ai.readProfiles().filter((p) => p && p.id);
  }

  function profileToCompletionConfig(profile) {
    const ai = window.RP_AI;
    const p = profile && typeof profile === "object" ? profile : {};
    const defBase = ai?.DEFAULT_BASE || "https://api.openai.com/v1";
    const defModel = ai?.DEFAULT_MODEL || "gpt-4o-mini";
    let baseUrl = String(p.baseUrl || "").trim() || defBase;
    if (ai?.resolveOpenAiV1Base) baseUrl = ai.resolveOpenAiV1Base(baseUrl);
    return {
      baseUrl,
      apiKey: String(p.apiKey || "").trim(),
      model: String(p.model || "").trim() || defModel,
      temperature: normalizeRelationAiTemperature(p.temperature, 0.35)
    };
  }

  function readRelationAiConfig() {
    const D = window.XXJ_DB;
    if (!D?.K?.RELATION_AI_CONFIG) return normalizeRelationAiConfig(null);
    const raw = D.getKv(D.K.RELATION_AI_CONFIG);
    if (raw && raw.v === 1) return normalizeRelationAiConfig(raw);
    const init = normalizeRelationAiConfig(null);
    D.setKv(D.K.RELATION_AI_CONFIG, init);
    return init;
  }

  function writeRelationAiConfig(cfg) {
    const D = window.XXJ_DB;
    if (!D?.K?.RELATION_AI_CONFIG) return;
    D.setKv(D.K.RELATION_AI_CONFIG, normalizeRelationAiConfig(cfg));
  }

  function resolveRelationCompletionConfig() {
    const ai = window.RP_AI;
    if (!ai?.getConfig) return null;
    const cfg = readRelationAiConfig();
    const main = ai.getConfig();
    if (cfg.apiMode === "main") return main;
    if (cfg.apiMode === "profile") {
      const pid = String(cfg.profileId || "").trim();
      const p = readRelationAiProfiles().find((x) => String(x.id) === pid);
      if (!p) return null;
      const c = profileToCompletionConfig(p);
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

  function relationAiKeyMissingMessage() {
    const cfg = readRelationAiConfig();
    if (cfg.apiMode === "main") return "请先在「我的 → 连接 API」填写 API Key";
    if (cfg.apiMode === "profile") return "请在关系网 API 里选择配置档案";
    return "请先在关系网 API 里填写 Key";
  }

  function hasRelationAiKey() {
    return Boolean(String(resolveRelationCompletionConfig()?.apiKey || "").trim());
  }

  function syncRelationApiEntryMeta() {
    if (!apiEntryMeta) return;
    const cfg = readRelationAiConfig();
    if (!hasRelationAiKey()) {
      apiEntryMeta.textContent = "未配置";
      return;
    }
    if (cfg.apiMode === "main") {
      apiEntryMeta.textContent = "密谈主 API";
      return;
    }
    if (cfg.apiMode === "profile") {
      const p = readRelationAiProfiles().find((x) => String(x.id) === cfg.profileId);
      apiEntryMeta.textContent = p ? `档案 · ${p.name}` : "配置档案";
      return;
    }
    apiEntryMeta.textContent = "独立填写";
  }

  function syncRelationApiSourceUi() {
    const mode = String(aiSourceEl?.value || "main").trim();
    if (aiProfileWrapEl) aiProfileWrapEl.hidden = mode !== "profile";
    if (aiFieldsEl) aiFieldsEl.hidden = mode !== "custom";
  }

  function syncRelationAiKeyNote() {
    if (!aiKeyNoteEl) return;
    const cfg = readRelationAiConfig();
    const has = Boolean(cfg.apiKey);
    if (aiKeyEl) {
      aiKeyEl.value = "";
      aiKeyEl.placeholder = has
        ? "本机已保存 Key · 输入新值可覆盖，留空保存不改"
        : "在此粘贴 sk-…";
    }
    aiKeyNoteEl.textContent = has
      ? "Key 保存在本机；留空点保存不会删除"
      : "尚未保存关系网专用 Key";
  }

  function refreshRelationAiProfileSelect() {
    if (!aiProfileEl) return;
    const list = readRelationAiProfiles();
    const saved = String(readRelationAiConfig().profileId || "").trim();
    aiProfileEl.replaceChildren();
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = list.length ? "— 请选择档案 —" : "— 请先在设置里保存档案 —";
    aiProfileEl.appendChild(opt0);
    for (const p of list) {
      const o = document.createElement("option");
      o.value = String(p.id || "");
      o.textContent = `${p.name || "未命名"} · ${p.model || ""}`;
      aiProfileEl.appendChild(o);
    }
    aiProfileEl.value = saved && list.some((p) => String(p.id) === saved) ? saved : "";
  }

  function fillRelationAiFormFromConfig() {
    const cfg = readRelationAiConfig();
    refreshRelationAiProfileSelect();
    if (aiSourceEl) aiSourceEl.value = cfg.apiMode || "main";
    if (aiProfileEl) {
      aiProfileEl.value =
        cfg.profileId && readRelationAiProfiles().some((p) => String(p.id) === cfg.profileId)
          ? cfg.profileId
          : "";
    }
    if (aiBaseEl) aiBaseEl.value = cfg.baseUrl || "";
    if (aiModelEl) aiModelEl.value = cfg.model || "";
    if (aiTempEl) aiTempEl.value = String(cfg.temperature ?? 0.35);
    if (aiTempValueEl) aiTempValueEl.textContent = Number(cfg.temperature ?? 0.35).toFixed(2);
    syncRelationAiKeyNote();
    syncRelationApiSourceUi();
    if (aiStatusEl) aiStatusEl.textContent = "";
  }

  function openRelationApiSheet() {
    if (!apiSheet) return;
    fillRelationAiFormFromConfig();
    syncRelationBgFormFromStore();
    apiSheet.hidden = false;
    apiSheet.setAttribute("aria-hidden", "false");
  }

  function closeRelationApiSheet() {
    if (!apiSheet) return;
    apiSheet.setAttribute("aria-hidden", "true");
    apiSheet.hidden = true;
    syncRelationApiEntryMeta();
  }

  function saveRelationApiSheet() {
    const ai = window.RP_AI;
    const prev = readRelationAiConfig();
    const main = ai?.getConfig?.() || {};
    const apiMode = String(aiSourceEl?.value || "main").trim();
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
      const profileId = String(aiProfileEl?.value || "").trim();
      if (!profileId) {
        toast("请选择配置档案");
        return;
      }
      const p = readRelationAiProfiles().find((x) => String(x.id) === profileId);
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
      const keyRaw = String(aiKeyEl?.value || "").trim();
      if (keyRaw) apiKey = keyRaw;
      if (!apiKey) {
        toast("请填写 API Key");
        return;
      }
      patch = {
        apiMode: "custom",
        profileId: "",
        baseUrl: String(aiBaseEl?.value || "").trim() || main.baseUrl,
        apiKey,
        model: String(aiModelEl?.value || "").trim() || main.model,
        temperature: normalizeRelationAiTemperature(aiTempEl?.value, 0.35)
      };
    }
    writeRelationAiConfig(patch);
    syncRelationAiKeyNote();
    syncRelationApiEntryMeta();
    if (aiStatusEl) aiStatusEl.textContent = "已保存";
    toast("关系网 API 已保存");
    closeRelationApiSheet();
  }

  function parseRelationAiJson(raw) {
    let clean = String(raw || "").trim();
    if (!clean) return null;
    clean = clean.replace(/```json/gi, "").replace(/```/g, "").trim();
    const fo = clean.indexOf("{");
    const lo = clean.lastIndexOf("}");
    if (fo !== -1 && lo > fo) {
      try {
        return JSON.parse(clean.slice(fo, lo + 1));
      } catch {
        /* fall through */
      }
    }
    try {
      return JSON.parse(clean);
    } catch {
      return null;
    }
  }

  async function relationAiComplete(messages, opts) {
    const ai = window.RP_AI;
    if (!ai?.chatCompletions) throw new Error("AI 模块未加载");
    const completionConfig = resolveRelationCompletionConfig();
    if (!String(completionConfig?.apiKey || "").trim()) {
      throw new Error(relationAiKeyMissingMessage());
    }
    const o = opts && typeof opts === "object" ? opts : {};
    const reqOpts = {
      messages,
      response_format: { type: "json_object" },
      completionConfig
    };
    const maxTok =
      o.max_tokens != null && Number.isFinite(Number(o.max_tokens)) ? Number(o.max_tokens) : 8192;
    if (typeof spreadOptionalMaxTokens === "function") {
      Object.assign(reqOpts, spreadOptionalMaxTokens(maxTok));
    } else {
      reqOpts.max_tokens = maxTok;
    }
    const temp =
      o.temperature != null && Number.isFinite(Number(o.temperature))
        ? Number(o.temperature)
        : completionConfig.temperature;
    if (typeof requestChatAssistantCompletion === "function") {
      const data = await requestChatAssistantCompletion(ai, { ...reqOpts, temperature: temp });
      const text =
        typeof readChatCompletionChoiceText === "function" ? readChatCompletionChoiceText(data) : "";
      if (!String(text || "").trim()) throw new Error("模型未返回内容，请换模型或稍后重试");
      return text;
    }
    const data = await ai.chatCompletions({ ...reqOpts, temperature: temp }, { completionConfig });
    const text =
      typeof readChatCompletionChoiceText === "function"
        ? readChatCompletionChoiceText(data)
        : String(data?.choices?.[0]?.message?.content || "").trim();
    if (!text) throw new Error("模型未返回内容，请换模型或稍后重试");
    return text;
  }

  function buildOrganizeSourceBlock(char) {
    const int = R();
    if (!int || !char) return "";
    const charName = int.charDisplayName(char);
    const userName = "对方";
    const parts = [`[中心角色 · ${charName}]`];
    const summary = wbRepl(char.summary, charName, userName).trim();
    const boundaries = wbRepl(char.boundaries, charName, userName).trim();
    const npcRaw = wbRepl(char.npcRelations, charName, userName).trim();
    if (summary) parts.push(`[摘要]\n${summary}`);
    if (boundaries) parts.push(`[边界与备注]\n${boundaries}`);
    if (npcRaw) parts.push(`[NPC 与人际（人设字段）]\n${npcRaw}`);
    const wbFn = window.buildCharWorldBookBlockForPrompt;
    if (typeof wbFn === "function") {
      const wb = String(wbFn(char, charName, userName) || "").trim();
      if (wb) parts.push(wb);
    }
    return parts.join("\n\n");
  }

  function normalizeAiEntry(raw, int, ownerCharId) {
    if (!raw || typeof raw !== "object") return null;
    const name = String(raw.name || "").trim().replace(/^[@＠]/u, "");
    if (name.length < 2 || name.length > 24) return null;
    const owner = int.charById(ownerCharId);
    if (owner && int.charDisplayName(owner).toLowerCase() === name.toLowerCase()) return null;
    let stage = String(raw.stage || "").trim();
    if (!int.LINK_KIND[stage]) stage = "";
    let label = stage ? "" : String(raw.label || raw.relation || "").trim().slice(0, 16);
    const detail = String(raw.detail || raw.note || "").trim().slice(0, 200);
    if (!stage && !label && !detail) return null;
    let charId = String(raw.matchedCharId || raw.charId || "").trim();
    if (charId && !int.charById(charId)) charId = "";
    if (!charId) {
      for (const it of int.readCharStore().items) {
        const cid = String(it?.id || "").trim();
        if (!cid || cid === ownerCharId) continue;
        if (int.charDisplayName(it).toLowerCase() === name.toLowerCase()) {
          charId = cid;
          break;
        }
      }
    }
    const linked = charId ? int.charById(charId) : null;
    return {
      charId,
      name: linked ? int.charDisplayName(linked) : name,
      stage,
      label,
      detail,
      avatar: linked ? String(linked.avatar || "").trim() : ""
    };
  }

  function buildPreviewRows(existing, aiEntries, ownerCharId) {
    const int = R();
    if (!int) return [];
    /** @type {typeof previewRows} */
    const rows = [];
    const seen = new Set();
    for (const raw of aiEntries) {
      const entry = normalizeAiEntry(raw, int, ownerCharId);
      if (!entry) continue;
      const sk = entry.charId ? `id:${entry.charId}` : `name:${entry.name.toLowerCase()}`;
      if (seen.has(sk)) continue;
      seen.add(sk);
      const idx = int.findNpcEntryIndex(existing, entry);
      if (idx < 0) {
        rows.push({ ...entry, kind: "new", checked: true, existingIdx: -1 });
        continue;
      }
      const prev = existing[idx];
      const relChanged =
        (entry.stage && entry.stage !== prev.stage) ||
        (entry.label && entry.label !== prev.label) ||
        (entry.detail && entry.detail !== prev.detail);
      if (relChanged) {
        rows.push({
          ...entry,
          kind: "update",
          checked: false,
          existingIdx: idx,
          name: prev.name || entry.name
        });
      } else {
        rows.push({
          charId: prev.charId,
          name: prev.name,
          stage: prev.stage,
          label: prev.label,
          detail: prev.detail,
          avatar: prev.avatar,
          kind: "skip",
          checked: false,
          existingIdx: idx
        });
      }
    }
    return rows;
  }

  function linkLabelForRow(row) {
    const int = R();
    if (!int) return "";
    if (row.label) return row.label;
    if (row.stage && int.LINK_KIND[row.stage]) return int.LINK_KIND[row.stage].label;
    return "未设定";
  }

  function kindLabel(kind) {
    if (kind === "new") return "新增";
    if (kind === "update") return "更新";
    return "已有";
  }

  function renderPreviewList() {
    if (!previewListEl || !previewEmptyEl || !previewApplyBtn) return;
    previewListEl.replaceChildren();
    const actionable = previewRows.filter((r) => r.kind === "new" || r.kind === "update");
    previewEmptyEl.hidden = actionable.length > 0;
    previewApplyBtn.disabled = !previewRows.some((r) => r.checked && r.kind !== "skip");
    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i];
      if (row.kind === "skip") continue;
      const item = document.createElement("label");
      item.className = "relation-ai-preview-item";
      item.dataset.idx = String(i);
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "relation-ai-preview-check";
      cb.checked = row.checked;
      cb.disabled = row.kind === "skip";
      const body = document.createElement("div");
      body.className = "relation-ai-preview-item-body";
      const top = document.createElement("div");
      top.className = "relation-ai-preview-item-top";
      const nm = document.createElement("span");
      nm.className = "relation-ai-preview-name";
      nm.textContent = row.name;
      const badge = document.createElement("span");
      badge.className = `relation-ai-preview-badge relation-ai-preview-badge--${row.kind}`;
      badge.textContent = kindLabel(row.kind);
      top.append(nm, badge);
      const rel = document.createElement("p");
      rel.className = "relation-ai-preview-rel";
      rel.textContent = linkLabelForRow(row);
      body.append(top, rel);
      if (row.detail) {
        const det = document.createElement("p");
        det.className = "relation-ai-preview-detail";
        det.textContent = row.detail;
        body.appendChild(det);
      }
      if (row.charId) {
        const tag = document.createElement("p");
        tag.className = "relation-ai-preview-tag";
        tag.textContent = "已关联角色卡";
        body.appendChild(tag);
      }
      item.append(cb, body);
      previewListEl.appendChild(item);
    }
  }

  function openPreviewSheet(charName) {
    if (!previewSheet) return;
    if (previewTargetEl) previewTargetEl.textContent = `角色：${charName}`;
    renderPreviewList();
    previewSheet.hidden = false;
    previewSheet.setAttribute("aria-hidden", "false");
  }

  function closePreviewSheet() {
    if (!previewSheet) return;
    previewSheet.setAttribute("aria-hidden", "true");
    previewSheet.hidden = true;
    previewRows = [];
  }

  function applyPreviewRows() {
    const int = R();
    if (!int) return;
    const ownerCharId = int.getActiveCharId();
    const maskId = int.getActiveMaskId();
    if (!ownerCharId) return;
    let merged = int.mergeNpcEntriesForChar(maskId, ownerCharId).slice();
    const toApply = previewRows.filter((r) => r.checked && r.kind !== "skip");
    if (!toApply.length) {
      toast("请至少勾选一条");
      return;
    }
    /** @type {typeof toApply} */
    const created = [];
    for (const row of toApply) {
      const entry = {
        charId: row.charId,
        name: row.name,
        stage: row.stage,
        label: row.label,
        detail: row.detail,
        avatar: row.avatar
      };
      const idx = int.findNpcEntryIndex(merged, entry);
      if (row.kind === "new" && idx < 0) {
        merged.push(entry);
        created.push(entry);
      } else if (row.kind === "update" && idx >= 0) {
        merged[idx] = {
          ...merged[idx],
          stage: entry.stage || merged[idx].stage,
          label: entry.label || merged[idx].label,
          detail: entry.detail || merged[idx].detail,
          charId: entry.charId || merged[idx].charId,
          avatar: entry.avatar || merged[idx].avatar
        };
      }
    }
    merged = int.dedupeNpcEntries(merged);
    int.setCharNpcLinks(maskId, ownerCharId, merged);
    int.writeCharNpcRelations(ownerCharId, int.serializeNpcEntries(merged));
    for (const entry of created) {
      if (entry.charId) int.mirrorRelationLinkToPeerIfAbsent(maskId, ownerCharId, entry);
    }
    closePreviewSheet();
    int.renderGraphDetail();
    toast(`已写入 ${toApply.length} 条关系`);
  }

  async function runRelationOrganize() {
    if (organizeBusy) return;
    const int = R();
    if (!int) return;
    const ownerCharId = int.getActiveCharId();
    const char = int.charById(ownerCharId);
    if (!char) {
      toast("请先选择角色");
      return;
    }
    if (!hasRelationAiKey()) {
      toast(relationAiKeyMissingMessage());
      openRelationApiSheet();
      return;
    }
    const charName = int.charDisplayName(char);
    const source = buildOrganizeSourceBlock(char);
    if (!source.trim()) {
      toast("该角色暂无人设或世界书可读");
      return;
    }
    const existing = int.mergeNpcEntriesForChar(int.getActiveMaskId(), ownerCharId);
    const stageList = int.LINK_KIND_KEYS.join("、");
    organizeBusy = true;
    const btn = document.getElementById("relation-ai-organize-btn");
    btn?.classList.add("is-busy");
    btn?.setAttribute("disabled", "true");
    toast("AI 整理中…");
    try {
      const sys =
        "你是关系网整理助手。只从用户提供的角色设定与世界书中提取「与中心角色有关的具体人物」及其关系。\n" +
        "规则：\n" +
        "1. 只输出设定里明确出现的人名/称呼，禁止编造。\n" +
        "2. 不要输出中心角色本人、主控用户、泛称（如「朋友们」「同事们」）。\n" +
        `3. stage 只能从以下取值选一项，或留空并用 label 写自定义关系名：${stageList}\n` +
        "4. detail 写一句话补充（≤200字）。\n" +
        "5. 若名字与已有角色卡完全一致，可在 matchedCharId 填该角色 id（可选）。\n" +
        '6. 严格 JSON：{"entries":[{"name":"","stage":"","label":"","detail":"","matchedCharId":""}]}';
      const knownCards = int
        .readCharStore()
        .items.map((it) => {
          const cid = String(it?.id || "").trim();
          if (!cid || cid === ownerCharId) return "";
          return `${int.charDisplayName(it)} → id:${cid}`;
        })
        .filter(Boolean)
        .join("\n");
      const existLines = existing
        .map((e) => {
          const rel = e.label || (e.stage && int.LINK_KIND[e.stage] ? int.LINK_KIND[e.stage].label : "");
          return `- ${e.name}${rel ? `（${rel}）` : ""}`;
        })
        .join("\n");
      const userParts = [
        `请整理「${charName}」的关系网。`,
        source,
        knownCards ? `[已有角色卡（可选关联）]\n${knownCards}` : "",
        existLines ? `[当前关系网（已有条目勿重复输出为新增；仅当设定有更新时才输出 update）]\n${existLines}` : ""
      ].filter(Boolean);
      const raw = await relationAiComplete(
        [
          { role: "system", content: sys },
          { role: "user", content: userParts.join("\n\n") }
        ],
        { temperature: 0.35, max_tokens: 8192 }
      );
      const parsed = parseRelationAiJson(raw);
      const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
      if (!entries.length) {
        toast("未提取到关系，请检查人设或世界书");
        return;
      }
      previewRows = buildPreviewRows(existing, entries, ownerCharId);
      if (!previewRows.some((r) => r.kind === "new" || r.kind === "update")) {
        toast("与现有关系网一致，无需写入");
        return;
      }
      openPreviewSheet(charName);
    } catch (e) {
      console.warn("[relation-ai]", e);
      toast(String(e?.message || e || "整理失败").slice(0, 120));
    } finally {
      organizeBusy = false;
      btn?.classList.remove("is-busy");
      btn?.removeAttribute("disabled");
    }
  }

  document.getElementById("relation-screen")?.addEventListener("click", (e) => {
    if (e.target.closest(".relation-settings-btn")) {
      openRelationApiSheet();
      return;
    }
    if (e.target.closest("#relation-ai-organize-btn")) {
      void runRelationOrganize();
    }
  });
  document.getElementById("relation-api-sheet-backdrop")?.addEventListener("click", closeRelationApiSheet);
  document.getElementById("relation-api-sheet-close")?.addEventListener("click", closeRelationApiSheet);
  document.getElementById("relation-api-save-btn")?.addEventListener("click", saveRelationApiSheet);
  aiSourceEl?.addEventListener("change", syncRelationApiSourceUi);
  aiTempEl?.addEventListener("input", () => {
    if (aiTempValueEl && aiTempEl) aiTempValueEl.textContent = Number(aiTempEl.value).toFixed(2);
  });

  document.getElementById("relation-ai-preview-backdrop")?.addEventListener("click", closePreviewSheet);
  document.getElementById("relation-ai-preview-close")?.addEventListener("click", closePreviewSheet);
  document.getElementById("relation-ai-preview-apply")?.addEventListener("click", applyPreviewRows);

  previewListEl?.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains("relation-ai-preview-check")) return;
    const item = t.closest(".relation-ai-preview-item");
    const idx = Number(item?.dataset.idx);
    if (!Number.isFinite(idx) || !previewRows[idx]) return;
    previewRows[idx].checked = t.checked;
    if (previewApplyBtn) {
      previewApplyBtn.disabled = !previewRows.some((r) => r.checked && r.kind !== "skip");
    }
  });

  document.addEventListener("DOMContentLoaded", syncRelationApiEntryMeta);
  if (document.readyState !== "loading") syncRelationApiEntryMeta();

  window.syncRelationApiEntryMeta = syncRelationApiEntryMeta;
  window.resolveRelationCompletionConfig = resolveRelationCompletionConfig;
  window.hasRelationAiKey = hasRelationAiKey;
  window.relationAiKeyMissingMessage = relationAiKeyMissingMessage;

  // ── 关系网后台互动（论坛式总开关 + 冷却 + 提醒） ──
  const RELATION_BG_CHECK_MS = 60000;
  const RELATION_BG_DEFAULT_INTERVAL_SEC = 30 * 60;
  const RELATION_BG_RANDOM_MIN_MS = 30 * 60 * 1000;
  const RELATION_BG_RANDOM_MAX_MS = 10 * 3600 * 1000;
  const RELATION_BG_RANDOM_RANGE_MS = RELATION_BG_RANDOM_MAX_MS - RELATION_BG_RANDOM_MIN_MS;
  const globalBgToggleEl = document.getElementById("relation-global-bg-toggle");
  const globalBgCooldownEl = document.getElementById("relation-global-bg-cooldown");
  const globalBgIntervalEl = document.getElementById("relation-global-bg-interval-minutes");
  const globalBgIntervalFixedWrap = document.getElementById("relation-bg-interval-fixed-wrap");
  const globalBgIntervalModeEl = document.getElementById("relation-bg-interval-mode-chips");
  const relationBgCastListEl = document.getElementById("relation-bg-cast-list");
  const relationBgCastEmptyEl = document.getElementById("relation-bg-cast-empty");
  const bgNotifyEl = document.getElementById("relation-bg-notify");
  const bgNotifyTitleEl = document.getElementById("relation-bg-notify-title");
  const bgNotifyDescEl = document.getElementById("relation-bg-notify-desc");
  let relationBgTimerId = 0;
  let relationBgNotifyOwnerCharId = "";
  /** @type {string[]} */
  let relationBgCastDraftIds = [];

  function escapeHtmlLite(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function avHue(name) {
    let h = 0;
    const s = String(name || "?");
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return Math.abs(h) % 360;
  }

  /** @param {string} name @param {string} [avatarUrl] */
  function buildRelationBgCastAvHtml(name, avatarUrl) {
    const url = String(avatarUrl || "").trim();
    if (url) {
      return `<span class="relation-bg-cast-av relation-bg-cast-av--img"><img src="${escapeHtmlLite(url)}" alt="" loading="lazy" decoding="async" /></span>`;
    }
    return `<span class="relation-bg-cast-av" style="--rel-av-h:${avHue(name)}">${escapeHtmlLite(name.slice(0, 1))}</span>`;
  }

  function renderRelationBgCastList() {
    if (!relationBgCastListEl) return;
    const mid = getActiveMaskId();
    const listFn =
      typeof window.listCharsWithRelationNetwork === "function"
        ? window.listCharsWithRelationNetwork
        : null;
    const chars = listFn ? listFn(mid) : [];
    if (relationBgCastEmptyEl) relationBgCastEmptyEl.hidden = chars.length > 0;
    relationBgCastListEl.replaceChildren();
    for (const ch of chars) {
      const id = String(ch.charId || "").trim();
      if (!id) continue;
      const name = String(ch.name || "").trim() || "未命名角色";
      const on = relationBgCastDraftIds.includes(id);
      const row = document.createElement("label");
      row.className = "relation-bg-cast-row" + (on ? " is-on" : "");
      row.innerHTML =
        `<input type="checkbox" ${on ? "checked" : ""} data-relation-bg-char-id="${escapeHtmlLite(id)}" />` +
        buildRelationBgCastAvHtml(name, String(ch.avatar || "").trim()) +
        `<span class="relation-bg-cast-name">${escapeHtmlLite(name)}</span>`;
      relationBgCastListEl.appendChild(row);
    }
  }

  function maskBucketKey(maskId) {
    const mid = String(maskId || "").trim();
    return mid || "__nomask__";
  }

  function readRelationBgStore() {
    const D = window.XXJ_DB;
    if (!D?.K?.RELATION_BG_STORE) return { v: 1, byMask: {} };
    const raw = D.getKv(D.K.RELATION_BG_STORE);
    if (raw && raw.v === 1 && raw.byMask && typeof raw.byMask === "object") return raw;
    return { v: 1, byMask: {} };
  }

  function writeRelationBgStore(st) {
    const D = window.XXJ_DB;
    if (!D?.K?.RELATION_BG_STORE) return;
    D.setKv(D.K.RELATION_BG_STORE, st);
  }

  function getActiveMaskId() {
    const D = window.XXJ_DB;
    if (!D) return "";
    const st = D.getKv(D.K.USER_MASK_STORE);
    return String(st?.activeId || "").trim();
  }

  function loadMaskRelationBg(maskId) {
    const st = readRelationBgStore();
    const key = maskBucketKey(maskId);
    const row = st.byMask[key];
    if (row && typeof row === "object") return row;
    return {
      bgActivityEnabled: false,
      bgCooldownMin: 30,
      bgLastActivityAt: 0,
      bgAutoMode: true,
      bgIntervalSec: RELATION_BG_DEFAULT_INTERVAL_SEC,
      bgCharIds: [],
      charLastAt: {}
    };
  }

  function normalizeMaskRelationBgRow(row) {
    const prev = row && typeof row === "object" ? row : {};
    const charLastAt =
      prev.charLastAt && typeof prev.charLastAt === "object" ? { ...prev.charLastAt } : {};
    const bgCharIds = Array.isArray(prev.bgCharIds)
      ? prev.bgCharIds.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    return {
      bgActivityEnabled: Boolean(prev.bgActivityEnabled),
      bgCooldownMin: Math.min(240, Math.max(5, Number(prev.bgCooldownMin) || 30)),
      bgLastActivityAt: Number(prev.bgLastActivityAt) || 0,
      bgAutoMode: prev.bgAutoMode !== false,
      bgIntervalSec: Math.max(0, Math.floor(Number(prev.bgIntervalSec) || RELATION_BG_DEFAULT_INTERVAL_SEC)),
      bgCharIds,
      charLastAt
    };
  }

  function getRelationBgCharIds(maskId) {
    return normalizeMaskRelationBgRow(loadMaskRelationBg(maskId)).bgCharIds;
  }

  function saveMaskRelationBg(maskId, patch) {
    const st = readRelationBgStore();
    const key = maskBucketKey(maskId);
    const prev = normalizeMaskRelationBgRow(loadMaskRelationBg(maskId));
    st.byMask[key] = normalizeMaskRelationBgRow({ ...prev, ...patch });
    writeRelationBgStore(st);
  }

  function relationBgIntervalMsForMask(maskId) {
    const mf = normalizeMaskRelationBgRow(loadMaskRelationBg(maskId));
    if (mf.bgAutoMode) {
      return RELATION_BG_RANDOM_MIN_MS + Math.floor(Math.random() * RELATION_BG_RANDOM_RANGE_MS);
    }
    return Math.max(0, Math.floor(Number(mf.bgIntervalSec) || 0)) * 1000;
  }

  function getRelationBgCharLastAtMs(maskId, charId) {
    const mf = normalizeMaskRelationBgRow(loadMaskRelationBg(maskId));
    const iso = String(mf.charLastAt?.[String(charId || "").trim()] || "").trim();
    if (iso) {
      const t = Date.parse(iso);
      if (Number.isFinite(t)) return t;
    }
    if (typeof window.relationGetCharDmLastActiveMsForOwner === "function") {
      const t = window.relationGetCharDmLastActiveMsForOwner(maskId, charId);
      if (t > 0) return t;
    }
    return Date.now();
  }

  function touchRelationBgCharLastAt(maskId, charId) {
    const cid = String(charId || "").trim();
    if (!cid) return;
    const mf = normalizeMaskRelationBgRow(loadMaskRelationBg(maskId));
    const charLastAt = { ...(mf.charLastAt || {}) };
    charLastAt[cid] = new Date().toISOString();
    saveMaskRelationBg(maskId, { charLastAt });
  }

  function hasRelationNetworkCharsForMask(maskId) {
    const mid = String(maskId || "").trim();
    if (!mid) return false;
    const listFn =
      typeof window.listCharsWithRelationNetworkForBg === "function"
        ? window.listCharsWithRelationNetworkForBg
        : typeof window.listCharsWithRelationNetwork === "function"
          ? window.listCharsWithRelationNetwork
          : null;
    return listFn ? listFn(mid).length > 0 : false;
  }

  function relationBgCooldownMs(row) {
    return Math.min(240, Math.max(5, Number(row?.bgCooldownMin) || 30)) * 60000;
  }

  function syncRelationBgFormFromStore() {
    const mid = getActiveMaskId();
    const mf = normalizeMaskRelationBgRow(loadMaskRelationBg(mid));
    relationBgCastDraftIds = [...(mf.bgCharIds || [])];
    renderRelationBgCastList();
    if (globalBgToggleEl) globalBgToggleEl.checked = Boolean(mf.bgActivityEnabled);
    if (globalBgCooldownEl) globalBgCooldownEl.value = String(mf.bgCooldownMin || 30);
    if (globalBgIntervalEl) {
      globalBgIntervalEl.value = String(Math.max(0, Math.round((mf.bgIntervalSec || 0) / 60)));
    }
    if (globalBgIntervalFixedWrap) globalBgIntervalFixedWrap.hidden = Boolean(mf.bgAutoMode);
    if (globalBgIntervalModeEl) {
      const autoOn = Boolean(mf.bgAutoMode);
      for (const b of globalBgIntervalModeEl.querySelectorAll(".relation-bg-interval-chip")) {
        const mode = String(b?.dataset?.relationBgIntervalMode || "");
        const active = autoOn ? mode === "random" : mode === "custom";
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      }
    }
  }

  function persistRelationBgFromForm() {
    const mid = getActiveMaskId();
    if (!mid) return;
    const prev = normalizeMaskRelationBgRow(loadMaskRelationBg(mid));
    const autoBtn = globalBgIntervalModeEl?.querySelector(".relation-bg-interval-chip.is-active");
    const autoMode = String(autoBtn?.dataset?.relationBgIntervalMode || "random") !== "custom";
    let intervalSec = prev.bgIntervalSec;
    if (!autoMode && globalBgIntervalEl) {
      const n = Math.floor(Number(globalBgIntervalEl.value));
      if (Number.isFinite(n) && n >= 0) intervalSec = n * 60;
    }
    saveMaskRelationBg(mid, {
      bgActivityEnabled: Boolean(globalBgToggleEl?.checked),
      bgCooldownMin: Math.min(240, Math.max(5, Number(globalBgCooldownEl?.value) || 30)),
      bgAutoMode: autoMode,
      bgIntervalSec: intervalSec,
      bgCharIds: [...relationBgCastDraftIds]
    });
    if (typeof syncBgKeepAliveState === "function") syncBgKeepAliveState();
  }

  function isRelationBgActivityEnabledForMask(maskId) {
    return Boolean(loadMaskRelationBg(maskId).bgActivityEnabled);
  }

  function canRunRelationBgForMask(maskId) {
    const mid = String(maskId || "").trim();
    if (!mid) return false;
    const mf = normalizeMaskRelationBgRow(loadMaskRelationBg(mid));
    if (!mf.bgActivityEnabled) return false;
    if (!hasRelationNetworkCharsForMask(mid)) return false;
    if (!hasRelationAiKey()) return false;
    const last = Number(mf.bgLastActivityAt) || 0;
    if (last && Date.now() - last < relationBgCooldownMs(mf)) return false;
    return true;
  }

  function markRelationBgActivity(maskId) {
    saveMaskRelationBg(maskId, { bgLastActivityAt: Date.now() });
  }

  function relationBgStoreHasActivePolling() {
    const st = readRelationBgStore();
    for (const key of Object.keys(st.byMask || {})) {
      const row = st.byMask[key];
      if (!row?.bgActivityEnabled) continue;
      const maskId = key === "__nomask__" ? "__nomask__" : key;
      if (hasRelationNetworkCharsForMask(maskId)) return true;
    }
    return false;
  }

  function isRelationGraphVisible() {
    const screen = document.getElementById("relation-screen");
    const viewGraph = document.getElementById("relation-view-graph");
    const viewInteract = document.getElementById("relation-view-interact");
    return Boolean(
      screen?.classList.contains("is-open") &&
        ((viewGraph && !viewGraph.hidden) || (viewInteract && !viewInteract.hidden))
    );
  }

  function closeRelationBgNotify() {
    if (!bgNotifyEl) return;
    bgNotifyEl.hidden = true;
    bgNotifyEl.setAttribute("aria-hidden", "true");
    bgNotifyEl.classList.remove("is-open");
    relationBgNotifyOwnerCharId = "";
  }

  function notifyRelationBgDm(meta) {
    const ownerName = String(meta?.ownerName || "角色").trim() || "角色";
    const peerName = String(meta?.peerName || "对方").trim() || "对方";
    const preview = String(meta?.preview || "").trim().slice(0, 96);
    const isNpc = meta?.kind === "npc" || Boolean(meta?.peerNpcName);
    relationBgNotifyOwnerCharId = String(meta?.ownerCharId || "").trim();
    const verb = isNpc ? "与" : "↔";
    if (isRelationGraphVisible()) {
      toast(`${ownerName} ${verb} ${peerName} 刚有一段互动`);
      return;
    }
    if (!bgNotifyEl) {
      toast(`关系网 · ${ownerName} ${verb} ${peerName} 有新互动`);
      return;
    }
    if (bgNotifyTitleEl) bgNotifyTitleEl.textContent = "关系网有新互动";
    if (bgNotifyDescEl) {
      bgNotifyDescEl.textContent = preview
        ? `${ownerName} ${verb} ${peerName} · ${preview}${preview.length >= 96 ? "…" : ""}`
        : `${ownerName} 与 ${peerName} 后台刚生成一段互动`;
    }
    bgNotifyEl.hidden = false;
    bgNotifyEl.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => bgNotifyEl.classList.add("is-open"));
  }

  async function tickRelationBgActivity() {
    if (typeof window.runRelationDmProactiveScanOnce !== "function") return;
    const needKa = document.hidden;
    if (needKa && typeof isBgKeepAliveEnabled === "function" && !isBgKeepAliveEnabled()) return;
    const meta = await window.runRelationDmProactiveScanOnce({
      requireKeepAlive: needKa
    });
    if (meta && typeof meta === "object") {
      notifyRelationBgDm(meta);
    }
  }

  function scheduleRelationBgTimer() {
    if (relationBgTimerId) window.clearTimeout(relationBgTimerId);
    relationBgTimerId = window.setTimeout(() => {
      relationBgTimerId = 0;
      void tickRelationBgActivity().finally(() => scheduleRelationBgTimer());
    }, RELATION_BG_CHECK_MS);
  }

  globalBgToggleEl?.addEventListener("change", () => {
    persistRelationBgFromForm();
  });
  globalBgCooldownEl?.addEventListener("change", persistRelationBgFromForm);
  globalBgCooldownEl?.addEventListener("input", () => {
    window.clearTimeout(globalBgCooldownEl._saveTimer);
    globalBgCooldownEl._saveTimer = window.setTimeout(persistRelationBgFromForm, 400);
  });
  globalBgIntervalEl?.addEventListener("change", persistRelationBgFromForm);
  globalBgIntervalEl?.addEventListener("input", () => {
    window.clearTimeout(globalBgIntervalEl._saveTimer);
    globalBgIntervalEl._saveTimer = window.setTimeout(persistRelationBgFromForm, 400);
  });
  globalBgIntervalModeEl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".relation-bg-interval-chip");
    if (!btn) return;
    const mode = String(btn.dataset.relationBgIntervalMode || "");
    if (mode !== "random" && mode !== "custom") return;
    const autoMode = mode === "random";
    if (globalBgIntervalFixedWrap) globalBgIntervalFixedWrap.hidden = autoMode;
    for (const b of globalBgIntervalModeEl.querySelectorAll(".relation-bg-interval-chip")) {
      const m = String(b?.dataset?.relationBgIntervalMode || "");
      const active = autoMode ? m === "random" : m === "custom";
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    }
    persistRelationBgFromForm();
  });
  relationBgCastListEl?.addEventListener("change", (e) => {
    const input = e.target.closest("[data-relation-bg-char-id]");
    if (!input) return;
    const id = String(input.getAttribute("data-relation-bg-char-id") || "").trim();
    if (!id) return;
    if (input.checked) {
      if (!relationBgCastDraftIds.includes(id)) relationBgCastDraftIds.push(id);
    } else {
      relationBgCastDraftIds = relationBgCastDraftIds.filter((x) => x !== id);
    }
    renderRelationBgCastList();
    persistRelationBgFromForm();
  });

  document.getElementById("relation-bg-notify-backdrop")?.addEventListener("click", closeRelationBgNotify);
  document.getElementById("relation-bg-notify-dismiss")?.addEventListener("click", closeRelationBgNotify);
  document.getElementById("relation-bg-notify-open")?.addEventListener("click", () => {
    const cid = relationBgNotifyOwnerCharId;
    closeRelationBgNotify();
    if (typeof window.openRelationScreen === "function") window.openRelationScreen();
    if (cid && typeof window.openRelationCharGraph === "function") {
      window.setTimeout(() => window.openRelationCharGraph(cid), 60);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleRelationBgTimer();
  });
  document.addEventListener("xxj-mask-changed", syncRelationBgFormFromStore);

  syncRelationBgFormFromStore();
  scheduleRelationBgTimer();

  window.syncRelationBgFormFromStore = syncRelationBgFormFromStore;
  window.canRunRelationBgForMask = canRunRelationBgForMask;
  window.markRelationBgActivity = markRelationBgActivity;
  window.relationBgStoreHasActivePolling = relationBgStoreHasActivePolling;
  window.notifyRelationBgDm = notifyRelationBgDm;
  window.scheduleRelationBgTimer = scheduleRelationBgTimer;
  window.relationBgIntervalMsForMask = relationBgIntervalMsForMask;
  window.getRelationBgCharLastAtMs = getRelationBgCharLastAtMs;
  window.touchRelationBgCharLastAt = touchRelationBgCharLastAt;
  window.hasRelationNetworkCharsForMask = hasRelationNetworkCharsForMask;
  window.getRelationBgCharIds = getRelationBgCharIds;
})();
