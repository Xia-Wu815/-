"use strict";

/**
 * 关系 · 角色列表 + 关系网详情
 */
(function () {
  const K_STORE = "RELATION_GRAPH_V1";

  const STAGE_META = {
    lover: { label: "恋人", color: "#a84352" },
    ambiguous: { label: "暧昧", color: "#c96b4a" },
    friend: { label: "朋友", color: "#5a8a6a" },
    cold: { label: "冷战", color: "#5a6d8a" },
    confidant: { label: "知己", color: "#7a5a9a" },
    family: { label: "家人", color: "#8a7355" }
  };

  const STAGE_KEYS = Object.keys(STAGE_META);

  /** 关系网连线 · TA 与其他人 */
  const LINK_KIND = {
    lover: { label: "恋人", color: "#a84352" },
    ambiguous: { label: "暧昧", color: "#c96b4a" },
    friend: { label: "朋友", color: "#5a8a6a" },
    confidant: { label: "知己", color: "#7a5a9a" },
    family: { label: "家人", color: "#8a7355" },
    cold: { label: "冷战", color: "#5a6d8a" },
    rival: { label: "对手", color: "#7a5050" },
    colleague: { label: "同事", color: "#5a6d7a" },
    acquaintance: { label: "熟人", color: "#8a8078" }
  };

  const LINK_KIND_KEYS = Object.keys(LINK_KIND);

  const screen = document.getElementById("relation-screen");
  const viewHub = document.getElementById("relation-view-hub");
  const viewGraph = document.getElementById("relation-view-graph");
  const listEl = document.getElementById("relation-char-list");
  const emptyEl = document.getElementById("relation-empty");
  const countEl = document.getElementById("relation-char-count");
  const graphPane = document.getElementById("relation-graph-pane");
  const graphHeadName = document.getElementById("relation-graph-head-name");
  const charPicker = document.getElementById("relation-char-picker");
  const charPickerList = document.getElementById("relation-char-picker-list");
  const charPickerHint = document.getElementById("relation-char-picker-hint");
  const charPickerTitle = document.getElementById("relation-char-picker-title");
  const linkSetSheet = document.getElementById("relation-link-set");
  const linkSetTarget = document.getElementById("relation-link-set-target");
  const linkSetNameWrap = document.getElementById("relation-link-set-name-wrap");
  const linkSetNameInput = document.getElementById("relation-link-set-name");
  const linkSetStages = document.getElementById("relation-link-set-stages");
  const linkSetCustom = document.getElementById("relation-link-set-custom");
  const linkSetDetail = document.getElementById("relation-link-set-detail");

  /** @type {string} */
  let activeCharId = "";
  /** @type {"hub" | "npc"} */
  let pickerMode = "hub";
  /** @type {{ charId: string, name: string, avatar: string, manual: boolean } | null} */
  let pendingLink = null;
  /** @type {string} */
  let pendingSetStage = "";
  /** @type {ReturnType<typeof setTimeout> | null} */
  let npcSaveTimer = null;

  function toast(msg) {
    if (typeof showToast === "function") showToast(msg);
  }

  function readRelationStore() {
    const D = window.XXJ_DB;
    if (!D) return { v: 1, byMask: {} };
    const raw = D.getKv(K_STORE);
    if (raw && raw.v === 1 && raw.byMask && typeof raw.byMask === "object") return raw;
    return { v: 1, byMask: {} };
  }

  function writeRelationStore(store) {
    const D = window.XXJ_DB;
    if (!D) return;
    D.setKv(K_STORE, store);
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

  function readActiveMask() {
    const D = window.XXJ_DB;
    if (!D) return { id: "", displayName: "你", avatar: "" };
    const st = D.getKv(D.K.USER_MASK_STORE);
    if (!st || !Array.isArray(st.items)) return { id: "", displayName: "你", avatar: "" };
    const id = getActiveMaskId();
    const row = st.items.find((x) => String(x?.id || "") === id);
    return {
      id,
      displayName: String(row?.displayName || "").trim() || "你",
      avatar: String(row?.avatar || "").trim()
    };
  }

  function maskBucketKey(maskId) {
    return String(maskId || "_default");
  }

  function readInbox() {
    const D = window.XXJ_DB;
    if (!D) return { v: 1, byMask: {} };
    const raw = D.getKv(D.K.CHAT_INBOX_STORE);
    if (raw && raw.byMask) return raw;
    return { v: 1, byMask: {} };
  }

  function readCharStore() {
    const D = window.XXJ_DB;
    if (!D) return { items: [] };
    const raw = D.getKv(D.K.CHAR_PERSONA_STORE);
    if (raw && Array.isArray(raw.items)) return raw;
    return { items: [] };
  }

  function charById(charId) {
    const cid = String(charId || "").trim();
    if (!cid) return null;
    return readCharStore().items.find((x) => String(x?.id || "") === cid) || null;
  }

  /**
   * @param {string} raw
   * @returns {{ name: string, note: string }[]}
   */
  function parseNpcEntries(raw) {
    const text = String(raw || "").trim();
    if (!text) return [];
    /** @type {{ name: string, note: string }[]} */
    const out = [];
    /** @type {Set<string>} */
    const seen = new Set();
    for (let line of text.split(/\n+/).map((s) => String(s || "").trim()).filter(Boolean)) {
      line = line.replace(/^[-*•·\d]+[.)）、\s]*/u, "").trim();
      if (!line) continue;
      let name = "";
      let note = "";
      const m1 = line.match(/^([^:：\-—–|｜]+?)[:：\-—–|｜]\s*(.+)$/u);
      if (m1) {
        name = m1[1].trim();
        note = m1[2].trim();
      } else {
        const m2 = line.match(/^(.+?)（([^）]+)）\s*$/u);
        if (m2) {
          name = m2[1].trim();
          note = m2[2].trim();
        } else if (line.length <= 20 && !/[，,。；;]/u.test(line)) {
          name = line;
        } else {
          continue;
        }
      }
      name = name.replace(/^[@＠]/u, "").trim();
      if (name.length < 2 || name.length > 24) continue;
      if (/^(?:NPC|npc|角色|人物|关系)$/iu.test(name)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, note: note.slice(0, 200) });
    }
    return out.slice(0, 24);
  }

  /**
   * @param {{ stage?: string, label?: string, detail?: string, note?: string }} entry
   */
  function linkKindLabel(entry) {
    const custom = String(entry?.label || "").trim();
    if (custom) return custom;
    const stage = String(entry?.stage || "").trim();
    if (stage && LINK_KIND[stage]) return LINK_KIND[stage].label;
    const legacy = String(entry?.detail || entry?.note || "").trim();
    if (!legacy) return "";
    const parsed = parseLinkFields(legacy);
    if (parsed.label) return parsed.label;
    if (parsed.stage && LINK_KIND[parsed.stage]) return LINK_KIND[parsed.stage].label;
    return legacy.split(" · ")[0].slice(0, 12);
  }

  function linkKindColor(entry) {
    const stage = String(entry?.stage || "").trim();
    if (stage && LINK_KIND[stage]) return LINK_KIND[stage].color;
    return "#8a7355";
  }

  /**
   * @param {string} rawNote
   */
  function parseLinkFields(rawNote) {
    const text = String(rawNote || "").trim();
    if (!text) return { stage: "", label: "", detail: "" };
    for (const [key, meta] of Object.entries(LINK_KIND)) {
      if (text === meta.label) return { stage: key, label: "", detail: "" };
      const prefix = `${meta.label} · `;
      if (text.startsWith(prefix)) {
        return { stage: key, label: "", detail: text.slice(prefix.length).trim() };
      }
    }
    const parts = text.split(" · ");
    if (parts.length >= 2) {
      const first = parts[0].trim();
      for (const [key, meta] of Object.entries(LINK_KIND)) {
        if (first === meta.label) {
          return { stage: key, label: "", detail: parts.slice(1).join(" · ").trim() };
        }
      }
      if (first.length <= 12) {
        return { stage: "", label: first, detail: parts.slice(1).join(" · ").trim() };
      }
    }
    return { stage: "", label: "", detail: text };
  }

  /**
   * @param {{ stage?: string, label?: string, detail?: string, note?: string }} entry
   */
  function formatLinkText(entry) {
    const main = String(entry?.label || "").trim() || linkKindLabel({ stage: entry?.stage, label: "" });
    const detail = String(entry?.detail || "").trim();
    if (!main && !detail) return "";
    if (!detail) return main;
    if (!main) return detail;
    return `${main} · ${detail}`;
  }

  /**
   * @param {{ name: string, stage?: string, label?: string, detail?: string, note?: string }[]} entries
   */
  function serializeNpcEntries(entries) {
    return entries
      .map((e) => ({
        name: String(e?.name || "").trim(),
        stage: String(e?.stage || "").trim(),
        label: String(e?.label || "").trim(),
        detail: String(e?.detail || e?.note || "").trim().slice(0, 200)
      }))
      .filter((e) => e.name.length >= 2)
      .map((e) => {
        const rel = formatLinkText(e);
        return rel ? `${e.name}：${rel}` : e.name;
      })
      .join("\n");
  }

  function getCharRow(maskId, charId) {
    const store = readRelationStore();
    const bucket = store.byMask[maskBucketKey(maskId)] || {};
    return bucket[String(charId || "")] || {};
  }

  function getCharUserLink(maskId, charId) {
    const row = getCharRow(maskId, charId);
    return row.userLink && typeof row.userLink === "object" ? row.userLink : {};
  }

  function setCharUserLink(maskId, charId, patch) {
    const store = readRelationStore();
    const bkey = maskBucketKey(maskId);
    if (!store.byMask[bkey]) store.byMask[bkey] = {};
    const cid = String(charId || "");
    const prev = store.byMask[bkey][cid] || {};
    const prevLink = prev.userLink && typeof prev.userLink === "object" ? prev.userLink : {};
    store.byMask[bkey][cid] = {
      ...prev,
      userLink: { ...prevLink, ...patch, updatedAt: Date.now() }
    };
    writeRelationStore(store);
  }

  /**
   * 首次 A→B 时，若对方尚无 B→A，用相同关系镜像（单箭头；之后各自改各自）。
   * @returns {boolean} 是否写入了反向关系
   */
  function mirrorRelationLinkToPeerIfAbsent(maskId, ownerCharId, entry) {
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    const peerCharId = String(entry?.charId || "").trim();
    if (!mid || !oid || !peerCharId || oid === peerCharId) return false;
    const owner = charById(oid);
    if (!owner) return false;
    const peerLinks = mergeNpcEntriesForChar(mid, peerCharId);
    const reverse = {
      charId: oid,
      name: charDisplayName(owner),
      stage: String(entry.stage || "").trim(),
      label: String(entry.label || "").trim(),
      detail: String(entry.detail || "").trim().slice(0, 200),
      avatar: String(owner.avatar || "").trim()
    };
    if (findNpcEntryIndex(peerLinks, reverse) >= 0) return false;
    peerLinks.push(reverse);
    const deduped = dedupeNpcEntries(peerLinks);
    setCharNpcLinks(mid, peerCharId, deduped);
    writeCharNpcRelations(peerCharId, serializeNpcEntries(deduped));
    return true;
  }

  function writeCharNpcRelations(charId, rawText) {
    const D = window.XXJ_DB;
    if (!D) return false;
    const raw = D.getKv(D.K.CHAR_PERSONA_STORE);
    if (!raw || !Array.isArray(raw.items)) return false;
    const idx = raw.items.findIndex((x) => String(x?.id || "") === String(charId || ""));
    if (idx < 0) return false;
    raw.items[idx] = { ...raw.items[idx], npcRelations: String(rawText || "") };
    D.setKv(D.K.CHAR_PERSONA_STORE, raw);
    return true;
  }

  /**
   * @returns {{ charId: string, name: string, stage: string, label: string, detail: string }[]}
   */
  function getCharNpcLinks(maskId, charId) {
    const row = getCharRow(maskId, charId);
    const links = row.npcLinks;
    if (!Array.isArray(links)) return [];
    return links
      .map((l) => ({
        charId: String(l?.charId || "").trim(),
        name: String(l?.name || "").trim(),
        stage: String(l?.stage || "").trim(),
        label: String(l?.label || "").trim(),
        detail: String(l?.detail || l?.note || "").trim().slice(0, 200)
      }))
      .filter((l) => l.name.length >= 2)
      .slice(0, 24);
  }

  /**
   * @param {{ charId?: string, name: string, stage?: string, label?: string, detail?: string, note?: string }[]} links
   */
  function setCharNpcLinks(maskId, charId, links) {
    const store = readRelationStore();
    const bkey = maskBucketKey(maskId);
    if (!store.byMask[bkey]) store.byMask[bkey] = {};
    const cid = String(charId || "");
    const prev = store.byMask[bkey][cid] || {};
    const normalized = dedupeNpcEntries(
      links.slice(0, 24).map((l) => ({
        charId: String(l.charId || "").trim(),
        name: String(l.name || "").trim(),
        stage: String(l.stage || "").trim(),
        label: String(l.label || "").trim(),
        detail: String(l.detail || l.note || "").trim().slice(0, 200),
        avatar: String(l.avatar || "").trim()
      }))
    );
    store.byMask[bkey][cid] = {
      ...prev,
      npcLinks: normalized.map((l) => ({
        charId: l.charId,
        name: l.name,
        stage: l.stage,
        label: l.label,
        detail: l.detail
      }))
    };
    writeRelationStore(store);
  }

  function charDisplayName(ch) {
    return String(ch?.displayName || "").trim() || "未命名角色";
  }

  function listPersonaChars() {
    return readCharStore().items.filter((c) => String(c?.id || "").trim());
  }

  /**
   * @param {{ charId?: string, name?: string }} entry
   * @returns {string[]}
   */
  function npcIdentityKeys(entry) {
    /** @type {string[]} */
    const keys = [];
    const cid = String(entry?.charId || "").trim();
    if (cid) keys.push(`id:${cid}`);
    const name = String(entry?.name || "").trim().toLowerCase();
    if (name) keys.push(`name:${name}`);
    if (cid) {
      const ch = charById(cid);
      if (ch) {
        const dn = charDisplayName(ch).toLowerCase();
        if (dn) keys.push(`name:${dn}`);
      }
    }
    return keys;
  }

  /**
   * 同一人只保留一条：charId 与显示名交叉匹配。
   * @param {{ charId?: string, name?: string, stage?: string, label?: string, detail?: string, avatar?: string }[]} entries
   */
  function dedupeNpcEntries(entries) {
    /** @type {Map<string, number>} */
    const keyToIdx = new Map();
    /** @type {typeof entries} */
    const out = [];
    for (const raw of entries) {
      const entry = { ...raw };
      let targetIdx = -1;
      for (const k of npcIdentityKeys(entry)) {
        if (keyToIdx.has(k)) {
          targetIdx = keyToIdx.get(k);
          break;
        }
      }
      if (targetIdx >= 0) {
        const prev = out[targetIdx];
        out[targetIdx] = {
          charId: String(entry.charId || prev.charId || "").trim(),
          name: String(entry.name || prev.name || "").trim(),
          stage: String(entry.stage || prev.stage || "").trim(),
          label: String(entry.label || prev.label || "").trim(),
          detail: String(entry.detail || prev.detail || "").trim(),
          avatar: String(entry.avatar || prev.avatar || "").trim()
        };
      } else {
        targetIdx = out.length;
        out.push({
          charId: String(entry.charId || "").trim(),
          name: String(entry.name || "").trim(),
          stage: String(entry.stage || "").trim(),
          label: String(entry.label || "").trim(),
          detail: String(entry.detail || "").trim(),
          avatar: String(entry.avatar || "").trim()
        });
      }
      for (const k of npcIdentityKeys(out[targetIdx])) {
        keyToIdx.set(k, targetIdx);
      }
    }
    return out.slice(0, 24);
  }

  /**
   * @param {{ charId?: string, name?: string }[]} entries
   * @param {{ charId?: string, name?: string }} entry
   */
  function findNpcEntryIndex(entries, entry) {
    const keys = new Set(npcIdentityKeys(entry));
    if (!keys.size) return -1;
    for (let i = 0; i < entries.length; i++) {
      const rowKeys = npcIdentityKeys(entries[i]);
      if (rowKeys.some((k) => keys.has(k))) return i;
    }
    return -1;
  }

  function normalizeStoredNpcLinks(maskId, charId) {
    const raw = getCharNpcLinks(maskId, charId);
    const mapped = raw.map((l) => {
      const linked = l.charId ? charById(l.charId) : null;
      return {
        charId: l.charId,
        name: linked ? charDisplayName(linked) : l.name,
        stage: l.stage,
        label: l.label,
        detail: l.detail,
        avatar: linked ? String(linked.avatar || "").trim() : ""
      };
    });
    const deduped = dedupeNpcEntries(mapped);
    if (deduped.length !== mapped.length) {
      setCharNpcLinks(maskId, charId, deduped);
      writeCharNpcRelations(charId, serializeNpcEntries(deduped));
    }
    return deduped;
  }

  /**
   * @returns {{ charId: string, name: string, stage: string, label: string, detail: string, avatar: string }[]}
   */
  function mergeNpcEntriesForChar(maskId, charId) {
    const fromStore = normalizeStoredNpcLinks(maskId, charId);
    /** @type {{ charId: string, name: string, stage: string, label: string, detail: string, avatar: string }[]} */
    const out = fromStore.map((l) => ({ ...l }));
    const keyToIdx = new Map();
    out.forEach((e, i) => {
      for (const k of npcIdentityKeys(e)) keyToIdx.set(k, i);
    });
    const fromText = parseNpcEntries(charById(charId)?.npcRelations);
    for (const e of fromText) {
      const match = readCharStore().items.find(
        (c) => charDisplayName(c).toLowerCase() === e.name.toLowerCase()
      );
      const parsed = parseLinkFields(e.note);
      const candidate = {
        charId: match ? String(match.id || "") : "",
        name: e.name,
        stage: parsed.stage,
        label: parsed.label,
        detail: parsed.detail,
        avatar: match ? String(match.avatar || "").trim() : ""
      };
      const exists = npcIdentityKeys(candidate).some((k) => keyToIdx.has(k));
      if (exists) continue;
      const idx = out.length;
      out.push(candidate);
      for (const k of npcIdentityKeys(candidate)) keyToIdx.set(k, idx);
    }
    return dedupeNpcEntries(out);
  }

  /**
   * 更新已有关系；默认不新建（allowCreate 时才新增）。
   * @returns {{ ok: boolean, created: boolean, updated: boolean }}
   */
  function upsertCharNpcLink(maskId, ownerCharId, patch, opts) {
    const allowCreate = opts?.allowCreate === true;
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    if (!mid || !oid || !patch || typeof patch !== "object") {
      return { ok: false, created: false, updated: false };
    }
    const merged = mergeNpcEntriesForChar(mid, oid);
    const entry = {
      charId: String(patch.charId || "").trim(),
      name: String(patch.name || "").trim(),
      stage: String(patch.stage || "").trim(),
      label: String(patch.label || "").trim(),
      detail: String(patch.detail || patch.note || "").trim().slice(0, 200),
      avatar: String(patch.avatar || "").trim()
    };
    if (entry.charId && !entry.name) {
      entry.name = charDisplayName(charById(entry.charId));
    }
    if (entry.name.length < 2) return { ok: false, created: false, updated: false };
    const idx = findNpcEntryIndex(merged, entry);
    if (idx < 0 && !allowCreate) return { ok: false, created: false, updated: false };
    if (idx >= 0) {
      merged[idx] = {
        ...merged[idx],
        ...entry,
        stage: entry.stage || merged[idx].stage,
        label: entry.label || merged[idx].label,
        detail: entry.detail || merged[idx].detail
      };
    } else {
      merged.push(entry);
    }
    const deduped = dedupeNpcEntries(merged);
    setCharNpcLinks(mid, oid, deduped);
    writeCharNpcRelations(oid, serializeNpcEntries(deduped));
    const created = idx < 0;
    if (created && entry.charId) {
      const savedIdx = findNpcEntryIndex(deduped, entry);
      const saved = savedIdx >= 0 ? deduped[savedIdx] : entry;
      mirrorRelationLinkToPeerIfAbsent(mid, oid, saved);
    }
    return { ok: true, created, updated: idx >= 0 };
  }

  window.upsertCharNpcLink = upsertCharNpcLink;

  function excludedPickerCharIds() {
    /** @type {Set<string>} */
    const set = new Set();
    if (activeCharId) set.add(activeCharId);
    if (pickerMode === "npc") {
      collectNpcDraft().forEach((e) => {
        if (e.charId) set.add(e.charId);
      });
    }
    return set;
  }

  function openCharPicker(mode) {
    pickerMode = mode;
    if (!charPicker || !charPickerList) return;
    const excluded = excludedPickerCharIds();
    const items = listPersonaChars().filter((c) => !excluded.has(String(c.id)));
    if (charPickerTitle) {
      charPickerTitle.textContent = mode === "hub" ? "选择角色" : "选择要加入圈子";
    }
    if (charPickerHint) {
      charPickerHint.textContent =
        mode === "hub"
          ? "从角色档案选一位 · 编辑关系网"
          : "从角色档案选一位 · 也可手动添加非角色 NPC";
    }
    charPickerList.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "relation-char-picker-empty";
      empty.textContent =
        mode === "npc" && listPersonaChars().length <= 1
          ? "没有其他角色 · 可用手动添加"
          : "还没有可选角色 · 先去人设库创建";
      charPickerList.appendChild(empty);
    } else {
      items.forEach((c) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relation-char-picker-item";
        btn.dataset.charId = String(c.id);
        btn.setAttribute("role", "listitem");

        const av = document.createElement("div");
        av.className = "relation-char-picker-av";
        const avatar = String(c.avatar || "").trim();
        const name = charDisplayName(c);
        if (avatar) {
          const img = document.createElement("img");
          img.src = avatar;
          img.alt = "";
          av.appendChild(img);
        } else {
          av.textContent = name.slice(0, 1) || "?";
        }

        const meta = document.createElement("div");
        meta.className = "relation-char-picker-meta";
        const nm = document.createElement("span");
        nm.className = "relation-char-picker-name";
        nm.textContent = name;
        meta.appendChild(nm);
        const sub = String(c.summary || c.voice || "").trim().slice(0, 40);
        if (sub) {
          const sb = document.createElement("span");
          sb.className = "relation-char-picker-sub";
          sb.textContent = sub;
          meta.appendChild(sb);
        }
        btn.append(av, meta);
        charPickerList.appendChild(btn);
      });
    }
    charPicker.hidden = false;
    charPicker.setAttribute("aria-hidden", "false");
  }

  function closeCharPicker() {
    if (!charPicker) return;
    charPicker.hidden = true;
    charPicker.setAttribute("aria-hidden", "true");
  }

  function renderLinkStageGrid(container, selectedStage, chipClass) {
    if (!container) return;
    container.replaceChildren();
    for (const key of LINK_KIND_KEYS) {
      const meta = LINK_KIND[key];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = chipClass;
      btn.dataset.stage = key;
      btn.textContent = meta.label;
      if (selectedStage === key) btn.classList.add("is-on");
      container.appendChild(btn);
    }
  }

  function resolveLinkFromCustom(customText) {
    const text = String(customText || "").trim();
    if (!text) return { stage: "", label: "" };
    for (const [key, meta] of Object.entries(LINK_KIND)) {
      if (text === meta.label) return { stage: key, label: "" };
    }
    return { stage: "", label: text };
  }

  function openLinkSetSheet(pending) {
    pendingLink = pending;
    pendingSetStage = String(pending.stage || "").trim();
    if (!linkSetSheet) return;
    const center = charById(activeCharId);
    const centerName = charDisplayName(center);
    const otherName = pending.manual ? "" : pending.name;
    const isEdit = typeof pending.editIndex === "number" && pending.editIndex >= 0;
    const titleEl = document.getElementById("relation-link-set-title");
    const confirmEl = document.getElementById("relation-link-set-confirm");
    if (titleEl) titleEl.textContent = isEdit ? "修改关系" : "设定关系";
    if (confirmEl) confirmEl.textContent = isEdit ? "保存" : "加入关系网";
    if (linkSetTarget) {
      linkSetTarget.textContent = pending.manual
        ? `${centerName} 与 …`
        : `${centerName} 与 ${otherName || "…"}`;
    }
    if (linkSetNameWrap) linkSetNameWrap.hidden = !pending.manual;
    if (linkSetNameInput) {
      linkSetNameInput.value = pending.manual ? pending.name || "" : pending.name;
    }
    if (linkSetCustom) {
      if (pending.stage && LINK_KIND[pending.stage]) {
        linkSetCustom.value = pending.label || LINK_KIND[pending.stage].label;
      } else {
        linkSetCustom.value = pending.label || "";
      }
    }
    if (linkSetDetail) linkSetDetail.value = pending.detail || "";
    renderLinkStageGrid(linkSetStages, pendingSetStage, "relation-link-chip");
    linkSetSheet.hidden = false;
    linkSetSheet.setAttribute("aria-hidden", "false");
    if (pending.manual && !isEdit) linkSetNameInput?.focus();
    else linkSetCustom?.focus();
  }

  function closeLinkSetSheet() {
    pendingLink = null;
    pendingSetStage = "";
    if (!linkSetSheet) return;
    linkSetSheet.hidden = true;
    linkSetSheet.setAttribute("aria-hidden", "true");
  }

  function readLinkSetDraft() {
    const custom = String(linkSetCustom?.value || "").trim();
    const fromPreset =
      pendingSetStage && LINK_KIND[pendingSetStage] && custom === LINK_KIND[pendingSetStage].label
        ? { stage: pendingSetStage, label: "" }
        : resolveLinkFromCustom(custom);
    return {
      ...fromPreset,
      detail: String(linkSetDetail?.value || "").trim()
    };
  }

  function confirmLinkSet() {
    if (!pendingLink || !activeCharId) return;
    const draft = readLinkSetDraft();
    const name = pendingLink.manual
      ? String(linkSetNameInput?.value || "").trim()
      : pendingLink.name;
    if (name.length < 2) {
      toast("请填写名字");
      linkSetNameInput?.focus();
      return;
    }
    if (!draft.stage && !draft.label) {
      toast("请填写关系名称");
      linkSetCustom?.focus();
      return;
    }
    document.getElementById("relation-npc-feed")?.querySelector(".relation-npc-empty")?.remove();
    const npcs = collectNpcDraft();
    const entry = {
      charId: pendingLink.charId,
      name,
      stage: draft.stage,
      label: draft.label,
      detail: draft.detail,
      avatar: pendingLink.avatar
    };
    const editIndex = pendingLink.editIndex;
    const existingIdx =
      typeof editIndex === "number" && editIndex >= 0 ? editIndex : findNpcEntryIndex(npcs, entry);
    const isNew = existingIdx < 0;
    if (existingIdx >= 0) {
      npcs[existingIdx] = { ...npcs[existingIdx], ...entry };
    } else {
      npcs.push(entry);
    }
    renderNpcFeed(dedupeNpcEntries(npcs));
    persistNpcDraft(true);
    let mirrored = false;
    if (isNew && entry.charId) {
      mirrored = mirrorRelationLinkToPeerIfAbsent(getActiveMaskId(), activeCharId, entry);
    }
    closeLinkSetSheet();
    if (isNew) {
      toast(
        mirrored
          ? `已加入 · ${linkKindLabel({ stage: draft.stage, label: draft.label })} · 双方关系网已同步`
          : `已加入 · ${linkKindLabel({ stage: draft.stage, label: draft.label })}`
      );
    } else {
      toast("关系已更新（仅本侧）");
    }
  }

  function openLinkSetForCard(index) {
    const npcs = mergeNpcEntriesForChar(getActiveMaskId(), activeCharId);
    const npc = npcs[index];
    if (!npc) return;
    openLinkSetSheet({
      charId: npc.charId,
      name: npc.name,
      avatar: npc.avatar,
      manual: !npc.charId,
      editIndex: index,
      stage: npc.stage,
      label: npc.label,
      detail: npc.detail
    });
  }

  function onPickerCharSelected(charId) {
    closeCharPicker();
    if (pickerMode === "hub") {
      openCharGraph(charId);
      return;
    }
    const ch = charById(charId);
    if (!ch) return;
    openLinkSetSheet({
      charId: String(charId),
      name: charDisplayName(ch),
      avatar: String(ch.avatar || "").trim(),
      manual: false
    });
  }

  /**
   * @param {string} centerName
   * @param {string} centerAvatar
   * @param {{ name: string, stage?: string, label?: string, detail?: string, avatar?: string }[]} links
   */
  function renderRelationWebMap(centerName, centerAvatar, links) {
    const el = document.getElementById("relation-web-map");
    if (!el) return;
    const nodes = links.filter((l) => l.name && linkKindLabel(l));
    el.replaceChildren();
    if (!nodes.length) {
      const ph = document.createElement("p");
      ph.className = "relation-web-map-empty";
      ph.textContent = "设定关系后会在这里连成网";
      el.appendChild(ph);
      return;
    }

    const inner = document.createElement("div");
    inner.className = "relation-web-map-inner";

    const center = document.createElement("div");
    center.className = "relation-web-map-center";
    const cOrbit = document.createElement("div");
    cOrbit.className = "relation-av-orbit relation-av-orbit--map";
    const cAv = document.createElement("div");
    cAv.className = "relation-av relation-av--map";
    if (centerAvatar) {
      const img = document.createElement("img");
      img.src = centerAvatar;
      img.alt = "";
      cAv.appendChild(img);
    } else {
      const ph = document.createElement("span");
      ph.className = "relation-av-ph";
      ph.textContent = centerName.slice(0, 1) || "?";
      cAv.appendChild(ph);
    }
    cOrbit.appendChild(cAv);
    const cLab = document.createElement("span");
    cLab.className = "relation-web-map-center-name";
    cLab.textContent = centerName;
    center.append(cOrbit, cLab);

    const ring = document.createElement("div");
    ring.className = "relation-web-map-ring";
    nodes.forEach((link) => {
      const node = document.createElement("div");
      node.className = "relation-web-map-node";
      node.style.setProperty("--link-color", linkKindColor(link));
      const nav = document.createElement("div");
      nav.className = "relation-web-map-node-av";
      if (link.avatar) {
        const img = document.createElement("img");
        img.src = link.avatar;
        img.alt = "";
        nav.appendChild(img);
      } else {
        nav.textContent = link.name.slice(0, 1) || "?";
      }
      const nm = document.createElement("span");
      nm.className = "relation-web-map-node-name";
      nm.textContent = link.name;
      const kind = document.createElement("span");
      kind.className = "relation-web-map-node-kind";
      kind.textContent = linkKindLabel(link);
      node.append(nav, nm, kind);
      ring.appendChild(node);
    });

    inner.append(center, ring);
    el.appendChild(inner);
  }

  function formatStage(link) {
    const stage = String(link?.stage || "").trim();
    if (stage && STAGE_META[stage]) return STAGE_META[stage];
    const custom = String(link?.label || "").trim();
    if (custom) return { label: custom, color: "#8a7355" };
    return { label: "未设定", color: "#b09a8f" };
  }

  function formatRelativeTime(ts) {
    const t = Number(ts);
    if (!Number.isFinite(t) || t <= 0) return "";
    const diff = Date.now() - t;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    try {
      const d = new Date(t);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
      return "";
    }
  }

  /** @returns {{ charId: string, threadId: string, updatedAt: number, remark: string }[]} */
  function listMaskCharThreads(maskId) {
    const mid = String(maskId || "").trim();
    if (!mid) return [];
    const bucket = readInbox().byMask[maskBucketKey(mid)];
    if (!bucket || !Array.isArray(bucket.threads)) return [];
    /** @type {Map<string, { charId: string, threadId: string, updatedAt: number, remark: string }>} */
    const map = new Map();
    for (const th of bucket.threads) {
      if (!th || th.kind === "group") continue;
      const cid = String(th.charId || "").trim();
      if (!cid) continue;
      const at = Number(th.updatedAt) || 0;
      const prev = map.get(cid);
      const remark =
        String(th.charThreadRemarkName || th.charRemarkForUser || "").trim().slice(0, 32);
      if (!prev || at >= prev.updatedAt) {
        map.set(cid, {
          charId: cid,
          threadId: String(th.id || ""),
          updatedAt: at,
          remark
        });
      }
    }
    return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function buildCharListRows(maskId) {
    const threads = listMaskCharThreads(maskId);
    const seen = new Set(threads.map((t) => t.charId));
    /** @type {{ charId: string, threadId: string, updatedAt: number, remark: string }[]} */
    const rows = threads.slice();
    for (const it of readCharStore().items) {
      const cid = String(it?.id || "").trim();
      if (!cid || seen.has(cid)) continue;
      rows.push({ charId: cid, threadId: "", updatedAt: 0, remark: "" });
    }
    return rows.map((row) => {
      const ch = charById(row.charId);
      const name = String(ch?.displayName || "").trim() || "未命名角色";
      const avatar = String(ch?.avatar || "").trim();
      const network = mergeNpcEntriesForChar(maskId, row.charId);
      const linkN = network.filter((l) => linkKindLabel(l)).length;
      const metaParts = [];
      if (row.remark) metaParts.push(row.remark);
      if (linkN > 0) metaParts.push(`${linkN} 条关系`);
      else if (network.length > 0) metaParts.push(`${network.length} 位待设定`);
      const rel = formatRelativeTime(row.updatedAt);
      if (rel) metaParts.push(`密谈 ${rel}`);
      return {
        charId: row.charId,
        threadId: row.threadId,
        name,
        avatar,
        aside: linkN > 0 ? `${String(linkN).padStart(2, "0")} 条` : "—",
        sub: metaParts.join(" · ") || "点进编辑关系网"
      };
    });
  }

  function renderCharList() {
    if (!listEl) return;
    const maskId = getActiveMaskId();
    const rows = buildCharListRows(maskId);
    listEl.innerHTML = "";
    if (countEl) countEl.textContent = String(rows.length).padStart(2, "0");
    if (emptyEl) emptyEl.hidden = rows.length > 0;
    listEl.hidden = rows.length === 0;

    rows.forEach((row, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "relation-feed-item";
      btn.dataset.charId = row.charId;
      btn.dataset.threadId = row.threadId;
      btn.setAttribute("role", "listitem");

      const idx = document.createElement("span");
      idx.className = "relation-feed-idx";
      idx.textContent = String(i + 1).padStart(2, "0");

      const orbit = document.createElement("div");
      orbit.className = "relation-av-orbit";
      const av = document.createElement("div");
      av.className = "relation-av";
      if (row.avatar) {
        const img = document.createElement("img");
        img.src = row.avatar;
        img.alt = "";
        av.appendChild(img);
      } else {
        const ph = document.createElement("span");
        ph.className = "relation-av-ph";
        ph.textContent = row.name.slice(0, 1) || "?";
        av.appendChild(ph);
      }
      orbit.appendChild(av);

      const meta = document.createElement("div");
      meta.className = "relation-feed-meta";
      const nameEl = document.createElement("p");
      nameEl.className = "relation-feed-name";
      nameEl.textContent = row.name;
      const subEl = document.createElement("p");
      subEl.className = "relation-feed-sub";
      subEl.textContent = row.sub;
      meta.append(nameEl, subEl);

      const asideEl = document.createElement("span");
      asideEl.className = "relation-feed-stage";
      asideEl.textContent = row.aside;

      const go = document.createElement("i");
      go.className = "ph ph-arrow-up-right relation-feed-go";
      go.setAttribute("aria-hidden", "true");

      btn.append(idx, orbit, meta, asideEl, go);
      listEl.appendChild(btn);
    });
  }

  const viewInteract = document.getElementById("relation-view-interact");

  function showView(which) {
    const isHub = which === "hub";
    const isGraph = which === "graph";
    const isInteract = which === "interact";
    if (viewHub) viewHub.hidden = !isHub;
    if (viewGraph) viewGraph.hidden = !isGraph;
    if (viewInteract) viewInteract.hidden = !isInteract;
  }

  window.relationShowView = showView;

  /** 私聊页返回：有 owner 则回到其关系图，否则回列表 */
  window.relationNavigateAfterInteractClose = function (ownerCharId) {
    const oid = String(ownerCharId || "").trim();
    if (oid && charById(oid)) openCharGraph(oid);
    else backToHub();
  };

  /**
   * @param {string} name
   * @param {string} avatar
   * @param {boolean} large
   */
  function buildAvatarNode(name, avatar, large) {
    const wrap = document.createElement("div");
    wrap.className = "relation-graph-node" + (large ? " relation-graph-node--hero" : "");
    const orbit = document.createElement("div");
    orbit.className = large ? "relation-av-orbit relation-av-orbit--hero" : "relation-av-orbit relation-av-orbit--sm";
    const av = document.createElement("div");
    av.className = "relation-av" + (large ? " relation-av--hero" : " relation-av--sm");
    if (avatar) {
      const img = document.createElement("img");
      img.src = avatar;
      img.alt = "";
      av.appendChild(img);
    } else {
      const ph = document.createElement("span");
      ph.className = "relation-av-ph";
      ph.textContent = name.slice(0, 1) || "?";
      av.appendChild(ph);
    }
    orbit.appendChild(av);
    const lab = document.createElement("span");
    lab.className = "relation-graph-node-label";
    lab.textContent = name;
    wrap.append(orbit, lab);
    return wrap;
  }

  function renderGraphDetail() {
    if (!graphPane || !activeCharId) return;
    const maskId = getActiveMaskId();
    const ch = charById(activeCharId);
    const charName = String(ch?.displayName || "").trim() || "未命名角色";
    const charAvatar = String(ch?.avatar || "").trim();
    const npcs = mergeNpcEntriesForChar(maskId, activeCharId);

    if (graphHeadName) graphHeadName.textContent = charName;

    graphPane.replaceChildren();

    const hero = document.createElement("div");
    hero.className = "relation-graph-hero";
    hero.appendChild(buildAvatarNode(charName, charAvatar, true));
    graphPane.appendChild(hero);

    const npcLabel = document.createElement("div");
    npcLabel.className = "relation-section-label";
    npcLabel.innerHTML = `<span>关系网</span><i id="relation-npc-count">${String(npcs.length).padStart(2, "0")}</i>`;
    graphPane.appendChild(npcLabel);

    const aiRow = document.createElement("div");
    aiRow.className = "relation-graph-ai-row";
    const aiBtn = document.createElement("button");
    aiBtn.type = "button";
    aiBtn.className = "relation-ai-organize-btn";
    aiBtn.id = "relation-ai-organize-btn";
    aiBtn.innerHTML = '<i class="ph ph-sparkle" aria-hidden="true"></i><span>AI 整理关系网</span>';
    aiRow.appendChild(aiBtn);
    graphPane.appendChild(aiRow);

    const webMap = document.createElement("div");
    webMap.className = "relation-web-map";
    webMap.id = "relation-web-map";
    graphPane.appendChild(webMap);
    renderRelationWebMap(charName, charAvatar, npcs);

    const npcFeed = document.createElement("div");
    npcFeed.className = "relation-npc-feed";
    npcFeed.id = "relation-npc-feed";
    graphPane.appendChild(npcFeed);

    renderNpcFeed(npcs);

    const sumRow = document.createElement("div");
    sumRow.className = "relation-graph-summary-settings";
    const sumGet =
      typeof window.relationGetCharDmSummarySettings === "function"
        ? window.relationGetCharDmSummarySettings
        : null;
    const sumSet =
      typeof window.relationSetCharDmSummarySettings === "function"
        ? window.relationSetCharDmSummarySettings
        : null;
    const sumCfg = sumGet ? sumGet(maskId) : { rollAt: 72, keepAfterRoll: 36 };
    const sumLab = document.createElement("span");
    sumLab.className = "relation-graph-summary-label";
    sumLab.textContent = "私聊摘要：满";
    const rollInp = document.createElement("input");
    rollInp.type = "number";
    rollInp.className = "relation-graph-summary-num";
    rollInp.min = "24";
    rollInp.max = "200";
    rollInp.step = "1";
    rollInp.value = String(sumCfg.rollAt);
    rollInp.title = "该面具下 char 私聊累计多少条后触发 AI 摘要（会多一次 API）";
    const midLab = document.createElement("span");
    midLab.textContent = "条压缩，保留";
    const keepInp = document.createElement("input");
    keepInp.type = "number";
    keepInp.className = "relation-graph-summary-num";
    keepInp.min = "12";
    keepInp.max = "120";
    keepInp.step = "1";
    keepInp.value = String(sumCfg.keepAfterRoll);
    keepInp.title = "压缩后仍保留的原文条数";
    const endLab = document.createElement("span");
    endLab.textContent = "条原文";
    let sumSaveTimer = null;
    const persistSummarySettings = () => {
      if (!sumSet) return;
      sumSet(maskId, {
        rollAt: Number(rollInp.value),
        keepAfterRoll: Number(keepInp.value)
      });
    };
    const scheduleSummarySave = () => {
      if (sumSaveTimer) clearTimeout(sumSaveTimer);
      sumSaveTimer = setTimeout(() => {
        sumSaveTimer = null;
        persistSummarySettings();
      }, 400);
    };
    rollInp.addEventListener("change", persistSummarySettings);
    keepInp.addEventListener("change", persistSummarySettings);
    rollInp.addEventListener("input", scheduleSummarySave);
    keepInp.addEventListener("input", scheduleSummarySave);
    sumRow.append(sumLab, rollInp, midLab, keepInp, endLab);
    graphPane.appendChild(sumRow);

    const sumNote = document.createElement("p");
    sumNote.className = "relation-graph-summary-note";
    sumNote.textContent =
      "滚动摘要 API 跟随「聊天详情 → 记忆摘要」专用 API；未选专用档案则用主聊天 API。";
    graphPane.appendChild(sumNote);

    const addRow = document.createElement("div");
    addRow.className = "relation-npc-add-row";
    const pickBtn = document.createElement("button");
    pickBtn.type = "button";
    pickBtn.className = "relation-npc-add relation-npc-add--pick";
    pickBtn.id = "relation-npc-pick-char";
    pickBtn.innerHTML = '<i class="ph ph-identification-card" aria-hidden="true"></i><span>选择角色</span>';
    const manualBtn = document.createElement("button");
    manualBtn.type = "button";
    manualBtn.className = "relation-npc-add relation-npc-add--manual";
    manualBtn.id = "relation-npc-add-manual";
    manualBtn.innerHTML = '<i class="ph ph-pencil-simple" aria-hidden="true"></i><span>手动添加</span>';
    addRow.append(pickBtn, manualBtn);
    graphPane.appendChild(addRow);

    const hint = document.createElement("p");
    hint.className = "relation-graph-hint";
    hint.textContent =
      "关系为单箭头 · 首次设定会同步到对方关系网 · 之后各自修改只改本侧 · 私聊记录双方共用";
    graphPane.appendChild(hint);
  }

  /**
   * @param {{ charId?: string, name: string, stage?: string, label?: string, detail?: string, avatar?: string }[]} npcs
   */
  function renderNpcFeed(npcs) {
    const feed = document.getElementById("relation-npc-feed");
    const countBadge = document.getElementById("relation-npc-count");
    if (!feed) return;
    feed.replaceChildren();
    if (countBadge) countBadge.textContent = String(npcs.length).padStart(2, "0");

    const center = charById(activeCharId);
    renderRelationWebMap(
      charDisplayName(center),
      String(center?.avatar || "").trim(),
      npcs
    );

    if (!npcs.length) {
      const empty = document.createElement("p");
      empty.className = "relation-npc-empty";
      empty.textContent = "还没有关系 · 选择角色并设定关系";
      feed.appendChild(empty);
      return;
    }

    npcs.forEach((npc, i) => {
      const hasKind = Boolean(linkKindLabel(npc));
      const row = document.createElement("div");
      row.className = "relation-link-card" + (hasKind ? "" : " is-unset");
      row.dataset.idx = String(i);
      if (npc.charId) row.dataset.charId = npc.charId;
      row.dataset.stage = String(npc.stage || "");
      row.dataset.linkLabel = String(npc.label || "");
      row.style.setProperty("--link-color", linkKindColor(npc));

      const spine = document.createElement("span");
      spine.className = "relation-link-card-spine";
      spine.setAttribute("aria-hidden", "true");

      const idx = document.createElement("span");
      idx.className = "relation-feed-idx";
      idx.textContent = String(i + 1).padStart(2, "0");

      const av = document.createElement("div");
      av.className = "relation-npc-av";
      if (npc.avatar) {
        const img = document.createElement("img");
        img.src = npc.avatar;
        img.alt = "";
        av.appendChild(img);
      } else {
        av.textContent = npc.name.slice(0, 1) || "?";
      }

      const body = document.createElement("div");
      body.className = "relation-link-card-body";

      const nameRow = document.createElement("div");
      nameRow.className = "relation-npc-name-row";
      if (npc.charId) {
        const nameEl = document.createElement("span");
        nameEl.className = "relation-link-name";
        nameEl.textContent = npc.name;
        nameRow.appendChild(nameEl);
        const tag = document.createElement("span");
        tag.className = "relation-npc-tag";
        tag.textContent = "角色";
        nameRow.appendChild(tag);
      } else {
        const nameIn = document.createElement("input");
        nameIn.type = "text";
        nameIn.className = "relation-npc-name";
        nameIn.placeholder = "名字";
        nameIn.maxLength = 24;
        nameIn.value = npc.name;
        nameRow.appendChild(nameIn);
      }

      const kindRow = document.createElement("div");
      kindRow.className = "relation-link-kind-row";
      if (hasKind) {
        const pill = document.createElement("span");
        pill.className = "relation-link-kind-pill";
        pill.textContent = linkKindLabel(npc);
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "relation-link-edit";
        edit.dataset.editIdx = String(i);
        edit.textContent = "修改";
        const dmBtn = document.createElement("button");
        dmBtn.type = "button";
        dmBtn.className = "relation-link-dm-btn";
        dmBtn.dataset.dmCharId = npc.charId || "";
        dmBtn.dataset.dmName = npc.name || "";
        dmBtn.textContent = "私聊";
        kindRow.append(pill, edit, dmBtn);
      } else {
        const setBtn = document.createElement("button");
        setBtn.type = "button";
        setBtn.className = "relation-link-set-btn";
        setBtn.dataset.editIdx = String(i);
        setBtn.textContent = "设定关系";
        kindRow.appendChild(setBtn);
      }

      const detailIn = document.createElement("input");
      detailIn.type = "text";
      detailIn.className = "relation-link-detail";
      detailIn.placeholder = "补充说明（可选）";
      detailIn.maxLength = 120;
      detailIn.value = String(npc.detail || "").trim();

      body.append(nameRow, kindRow, detailIn);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "relation-npc-del";
      del.setAttribute("aria-label", "删除");
      del.innerHTML = '<i class="ph ph-x" aria-hidden="true"></i>';

      row.append(spine, idx, av, body, del);
      feed.appendChild(row);
    });
  }

  function collectNpcDraft() {
    const feed = document.getElementById("relation-npc-feed");
    if (!feed) return [];
    /** @type {{ charId: string, name: string, stage: string, label: string, detail: string, avatar: string }[]} */
    const out = [];
    feed.querySelectorAll(".relation-link-card").forEach((row) => {
      const charId = row.dataset.charId || "";
      const name =
        row.querySelector(".relation-link-name")?.textContent?.trim() ||
        row.querySelector(".relation-npc-name")?.value?.trim() ||
        "";
      const stage = row.dataset.stage || "";
      const label = row.dataset.linkLabel || "";
      const detail = row.querySelector(".relation-link-detail")?.value?.trim() || "";
      const avatar = row.querySelector(".relation-npc-av img")?.getAttribute("src") || "";
      if (name.length >= 2) out.push({ charId, name, stage, label, detail, avatar });
    });
    return out;
  }

  function scheduleNpcSave() {
    if (npcSaveTimer) clearTimeout(npcSaveTimer);
    npcSaveTimer = setTimeout(() => {
      npcSaveTimer = null;
      persistNpcDraft(false);
    }, 500);
  }

  function persistNpcDraft(quiet) {
    if (!activeCharId) return;
    const entries = dedupeNpcEntries(collectNpcDraft());
    const maskId = getActiveMaskId();
    setCharNpcLinks(maskId, activeCharId, entries);
    const ok = writeCharNpcRelations(activeCharId, serializeNpcEntries(entries));
    const countBadge = document.getElementById("relation-npc-count");
    if (countBadge) countBadge.textContent = String(entries.length).padStart(2, "0");
    if (!quiet && ok) toast("关系网已保存");
    if (screen?.classList.contains("is-open") && viewHub && !viewHub.hidden) renderCharList();
  }

  function openCharGraph(charId) {
    activeCharId = String(charId || "").trim();
    if (!activeCharId || !charById(activeCharId)) {
      toast("找不到该角色");
      return;
    }
    renderGraphDetail();
    showView("graph");
    graphPane?.scrollTo(0, 0);
  }

  function backToHub() {
    activeCharId = "";
    showView("hub");
    renderCharList();
  }

  function closeOtherScreens() {
    if (typeof closeSettings === "function") closeSettings();
    if (typeof closeMyScreen === "function") closeMyScreen();
    if (typeof closeCharScreen === "function") closeCharScreen();
    if (typeof closeChatScreen === "function") closeChatScreen();
    if (typeof closeChatListScreen === "function") closeChatListScreen();
    if (typeof closeCheckupScreen === "function") closeCheckupScreen();
    if (typeof closeRoamScreen === "function") closeRoamScreen();
    if (typeof closeStickerScreen === "function") closeStickerScreen();
    if (typeof closeWardrobeScreen === "function") closeWardrobeScreen();
    if (typeof closeWorldBookScreen === "function") closeWorldBookScreen();
    if (typeof closeRoleplayScreen === "function") closeRoleplayScreen();
    document.getElementById("drawer")?.classList.remove("open");
  }

  function openRelationScreen() {
    closeOtherScreens();
    activeCharId = "";
    showView("hub");
    screen?.classList.add("is-open");
    screen?.setAttribute("aria-hidden", "false");
    renderCharList();
    if (typeof window.syncRelationApiEntryMeta === "function") window.syncRelationApiEntryMeta();
    if (typeof window.syncRelationBgFormFromStore === "function") window.syncRelationBgFormFromStore();
  }

  function closeRelationScreen() {
    activeCharId = "";
    closeCharPicker();
    closeLinkSetSheet();
    if (typeof window.relationInteractClose === "function") window.relationInteractClose();
    showView("hub");
    screen?.classList.remove("is-open");
    screen?.setAttribute("aria-hidden", "true");
  }

  window.openRelationScreen = openRelationScreen;
  window.closeRelationScreen = closeRelationScreen;
  window.openRelationCharGraph = openCharGraph;

  document.getElementById("relation-close")?.addEventListener("click", closeRelationScreen);
  document.getElementById("relation-graph-back")?.addEventListener("click", backToHub);
  document.getElementById("relation-hub-add")?.addEventListener("click", () => openCharPicker("hub"));
  document.getElementById("relation-char-picker-cancel")?.addEventListener("click", closeCharPicker);
  document.getElementById("relation-char-picker-backdrop")?.addEventListener("click", closeCharPicker);
  charPickerList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".relation-char-picker-item");
    if (!btn?.dataset.charId) return;
    onPickerCharSelected(btn.dataset.charId);
  });

  document.getElementById("relation-link-set-cancel")?.addEventListener("click", closeLinkSetSheet);
  document.getElementById("relation-link-set-backdrop")?.addEventListener("click", closeLinkSetSheet);
  document.getElementById("relation-link-set-confirm")?.addEventListener("click", confirmLinkSet);
  linkSetStages?.addEventListener("click", (e) => {
    const chip = e.target.closest(".relation-link-chip");
    if (!chip) return;
    linkSetStages.querySelectorAll(".relation-link-chip").forEach((el) => el.classList.remove("is-on"));
    chip.classList.add("is-on");
    pendingSetStage = chip.dataset.stage || "";
    if (linkSetCustom && pendingSetStage && LINK_KIND[pendingSetStage]) {
      linkSetCustom.value = LINK_KIND[pendingSetStage].label;
    }
  });
  linkSetCustom?.addEventListener("input", () => {
    linkSetStages?.querySelectorAll(".relation-link-chip").forEach((el) => el.classList.remove("is-on"));
    pendingSetStage = "";
  });

  listEl?.addEventListener("click", (e) => {
    const card = e.target.closest(".relation-feed-item");
    if (!card) return;
    openCharGraph(card.dataset.charId);
  });

  graphPane?.addEventListener("click", (e) => {
    const dmBtn = e.target.closest(".relation-link-dm-btn");
    if (dmBtn) {
      e.stopPropagation();
      const peerCharId = String(dmBtn.dataset.dmCharId || "").trim();
      const peerName = String(dmBtn.dataset.dmName || "").trim();
      if (!activeCharId || (!peerCharId && !peerName)) {
        toast("缺少对方信息");
        return;
      }
      if (typeof window.relationInteractOpen === "function") {
        window.relationInteractOpen({
          ownerCharId: activeCharId,
          peerCharId,
          peerName,
          isNpc: !peerCharId
        });
      }
      return;
    }

    const linkEdit = e.target.closest(".relation-link-edit, .relation-link-set-btn");
    if (linkEdit) {
      const idx = Number(linkEdit.dataset.editIdx);
      if (Number.isFinite(idx)) openLinkSetForCard(idx);
      return;
    }

    if (e.target.closest("#relation-npc-pick-char")) {
      openCharPicker("npc");
      return;
    }

    if (e.target.closest("#relation-npc-add-manual")) {
      openLinkSetSheet({ charId: "", name: "", avatar: "", manual: true });
      return;
    }

    const del = e.target.closest(".relation-npc-del");
    if (del) {
      const row = del.closest(".relation-link-card");
      row?.remove();
      const feed = document.getElementById("relation-npc-feed");
      if (feed && !feed.querySelector(".relation-link-card")) {
        renderNpcFeed([]);
      } else {
        renderRelationWebMap(
          charDisplayName(charById(activeCharId)),
          String(charById(activeCharId)?.avatar || "").trim(),
          collectNpcDraft()
        );
      }
      scheduleNpcSave();
    }
  });

  graphPane?.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.classList.contains("relation-npc-name") || t.classList.contains("relation-link-detail")) {
      scheduleNpcSave();
    }
  });

  function resolveRoamCharLink(charLink, charLinkDetail) {
    const linkText = String(charLink || "").trim();
    const detail = String(charLinkDetail || "").trim();
    if (linkText) {
      const parsed = parseLinkFields(linkText);
      if (parsed.stage || parsed.label) {
        return {
          stage: parsed.stage,
          label: parsed.label,
          detail: detail || parsed.detail
        };
      }
      const fromCustom = resolveLinkFromCustom(linkText);
      if (fromCustom.stage || fromCustom.label) {
        return { ...fromCustom, detail: detail || fromCustom.detail };
      }
      return { stage: "", label: linkText.slice(0, 16), detail };
    }
    if (detail) return { stage: "", label: "", detail };
    return { stage: "acquaintance", label: "", detail: "" };
  }

  /**
   * 漫游 · 认识主角色的路人进密谈后，写入该角色的关系网。
   * @returns {{ ok: boolean, created: boolean }}
   */
  function addRoamKnowsCharToRelationGraph(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    if (!o.knowsChar) return { ok: false, created: false };
    const maskId = String(o.maskId || "").trim();
    const ownerCharId = String(o.ownerCharId || "").trim();
    const npcCharId = String(o.npcCharId || "").trim();
    const npcName = String(o.npcName || "").trim();
    if (!maskId || !ownerCharId || !npcCharId || npcName.length < 2) {
      return { ok: false, created: false };
    }
    if (ownerCharId === npcCharId) return { ok: false, created: false };

    const rel = resolveRoamCharLink(o.charLink, o.charLinkDetail);
    const merged = mergeNpcEntriesForChar(maskId, ownerCharId);
    const row = {
      charId: npcCharId,
      name: npcName,
      stage: rel.stage,
      label: rel.label,
      detail: rel.detail
    };
    const idx = findNpcEntryIndex(merged, row);
    const isNew = idx < 0;
    if (idx >= 0) merged[idx] = { ...merged[idx], ...row };
    else merged.push(row);

    const deduped = dedupeNpcEntries(merged);
    setCharNpcLinks(maskId, ownerCharId, deduped);
    writeCharNpcRelations(ownerCharId, serializeNpcEntries(deduped));
    if (isNew) mirrorRelationLinkToPeerIfAbsent(maskId, ownerCharId, row);
    return { ok: true, created: isNew };
  }

  window.addRoamKnowsCharToRelationGraph = addRoamKnowsCharToRelationGraph;

  /**
   * 供朋友圈等模块读取：某角色关系网里已设定关系的人。
   * @returns {{ charId: string, name: string }[]}
   */
  function listCharRelationNetworkEntries(maskId, charId) {
    const mid = String(maskId || "").trim();
    const cid = String(charId || "").trim();
    if (!cid) return [];
    return mergeNpcEntriesForChar(mid, cid)
      .filter((l) => linkKindLabel(l))
      .map((l) => {
        const linkedId = String(l.charId || "").trim();
        const linked = linkedId ? charById(linkedId) : null;
        return {
          charId: linked ? linkedId : "",
          name: l.name
        };
      });
  }

  window.listCharRelationNetworkEntries = listCharRelationNetworkEntries;

  function readLinkedCharPersonaSnippet(ch) {
    if (!ch) return "";
    const bits = [ch.persona, ch.summary, ch.boundaries].filter((x) => String(x || "").trim());
    return bits.join("\n").slice(0, 600);
  }

  /**
   * 供查岗等 AI 生成手机内容时读取：关系网名单 + 已关联角色的人设。
   * @returns {string}
   */
  function buildCharRelationNetworkAiContext(maskId, charId, opts) {
    const mid = String(maskId || "").trim();
    const cid = String(charId || "").trim();
    const npcOnly = !!(opts && opts.npcOnly);
    if (!cid) return "";
    const entries = mergeNpcEntriesForChar(mid, cid).filter((l) => linkKindLabel(l));
    const scoped = npcOnly
      ? entries.filter((e) => !String(e.charId || "").trim())
      : entries;
    if (!scoped.length) return "";
    const ownerName = charDisplayName(charById(cid));
    const lines = [
      npcOnly
        ? `【${ownerName} 的关系网 · 手机内容可引用以下 NPC（不含其它可玩角色）】`
        : `【${ownerName} 的关系网 · 手机内容可引用以下熟人】`
    ];
    for (const e of scoped) {
      const linked = e.charId ? charById(e.charId) : null;
      const rel = linkKindLabel(e);
      const detail = String(e.detail || "").trim();
      if (linked) {
        const persona = readLinkedCharPersonaSnippet(linked);
        const bits = [`· ${e.name}`];
        if (rel) bits.push(`（与 ${ownerName}：${rel}）`);
        if (persona) bits.push(`\n  其人设：${persona}`);
        if (detail) bits.push(`\n  补充：${detail.slice(0, 120)}`);
        lines.push(bits.join(""));
      } else {
        const tail = [rel, detail].filter(Boolean).join(" · ");
        lines.push(`· ${e.name}${tail ? `（${tail.slice(0, 100)}）` : ""}`);
      }
    }
    lines.push(
      npcOnly
        ? "【引用原则】微信/通话/备忘录里可引用以上 NPC 与虚构路人；**禁止**写关系网里其它可玩角色与 TA 的私聊，避免 OOC。"
        : "【引用原则】微信/通话/备忘录里只写人名与自然对话；有档案者言行须符合其人设；不要在正文里写「关系：xxx」标签。"
    );
    return lines.join("\n");
  }

  window.buildCharRelationNetworkAiContext = buildCharRelationNetworkAiContext;

  /** 供关系网私聊等：某角色眼中与另一关联角色的关系（各侧可不同）。 */
  window.relationGetLinkEntryForPeer = function (maskId, ownerCharId, peerCharId) {
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    const pid = String(peerCharId || "").trim();
    if (!oid || !pid) return null;
    const entry = mergeNpcEntriesForChar(mid, oid).find(
      (l) => String(l.charId || "").trim() === pid
    );
    if (!entry || !linkKindLabel(entry)) return null;
    return {
      rel: linkKindLabel(entry),
      detail: String(entry.detail || "").trim(),
      name: String(entry.name || "").trim()
    };
  };

  /** 供关系网 NPC 互动：按名字取关系条目（无关联 char 档案）。 */
  window.relationGetLinkEntryForNpc = function (maskId, ownerCharId, npcName) {
    const mid = String(maskId || "").trim();
    const oid = String(ownerCharId || "").trim();
    const nk = String(npcName || "").trim();
    if (!oid || !nk) return null;
    const entry = mergeNpcEntriesForChar(mid, oid).find(
      (l) => !String(l.charId || "").trim() && String(l.name || "").trim() === nk
    );
    if (!entry || !linkKindLabel(entry)) return null;
    return {
      rel: linkKindLabel(entry),
      detail: String(entry.detail || "").trim(),
      name: nk
    };
  };

  /** 供关系网私聊主动调度：已设关系且有关联档案的角色对 */
  window.relationListOwnerLinkedCharPeers = function (maskId, ownerCharId) {
    return mergeNpcEntriesForChar(maskId, ownerCharId)
      .filter((l) => linkKindLabel(l) && String(l.charId || "").trim())
      .map((l) => ({
        charId: String(l.charId || "").trim(),
        name: l.name
      }));
  };

  /** 供后台互动调度：关系网里所有已设定关系的人（含 NPC）。 */
  window.relationListOwnerNetworkPeers = function (maskId, ownerCharId) {
    return mergeNpcEntriesForChar(maskId, ownerCharId)
      .filter((l) => linkKindLabel(l))
      .map((l) => {
        const charId = String(l.charId || "").trim();
        return {
          charId,
          name: String(l.name || "").trim(),
          isNpc: !charId,
          rel: linkKindLabel(l),
          detail: String(l.detail || "").trim()
        };
      });
  };

  document.addEventListener("xxj-mask-changed", () => {
    if (!screen?.classList.contains("is-open")) return;
    if (viewGraph && !viewGraph.hidden && activeCharId) renderGraphDetail();
    else renderCharList();
  });

  window.__relationInternals = {
    mergeNpcEntriesForChar,
    setCharNpcLinks,
    writeCharNpcRelations,
    mirrorRelationLinkToPeerIfAbsent,
    dedupeNpcEntries,
    findNpcEntryIndex,
    serializeNpcEntries,
    charById,
    charDisplayName,
    readCharStore,
    getActiveMaskId,
    getActiveCharId: () => activeCharId,
    renderGraphDetail,
    LINK_KIND,
    LINK_KIND_KEYS
  };
})();
