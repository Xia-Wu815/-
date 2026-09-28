/**
 * 聊天/表情等图片：data URL 外置到 IndexedDB Blob，KV 内只留 xxj-blob: 短引用，减轻 inbox JSON 解析峰值。
 */
(function () {
  const XXJ_BLOB_REF_PREFIX = "xxj-blob:";
  /** 小于此长度的 data URL 仍内联，避免小图标反复读写 */
  const MIN_DATA_URL_EXTERNALIZE = 8192;

  /** @type {Map<string, string>} */
  const displayUrlCache = new Map();

  function isBlobRef(url) {
    return String(url || "")
      .trim()
      .toLowerCase()
      .startsWith(XXJ_BLOB_REF_PREFIX);
  }

  function blobRefFromId(id) {
    return XXJ_BLOB_REF_PREFIX + String(id || "").trim();
  }

  function idFromBlobRef(url) {
    const s = String(url || "").trim();
    if (!s.toLowerCase().startsWith(XXJ_BLOB_REF_PREFIX)) return "";
    return s.slice(XXJ_BLOB_REF_PREFIX.length).trim();
  }

  function isExternalizableDataImageUrl(url) {
    const s = String(url || "").trim();
    if (!/^data:image\//i.test(s)) return false;
    if (isBlobRef(s)) return false;
    return s.length >= MIN_DATA_URL_EXTERNALIZE;
  }

  function revokeDisplayUrlCache() {
    for (const u of displayUrlCache.values()) {
      try {
        URL.revokeObjectURL(u);
      } catch (_) {
        /* ignore */
      }
    }
    displayUrlCache.clear();
  }

  async function dataUrlToBlob(dataUrl) {
    const res = await fetch(String(dataUrl));
    return res.blob();
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(r.error || new Error("read blob failed"));
      r.readAsDataURL(blob);
    });
  }

  async function hydrateImageUrlForExport(url) {
    const s = String(url || "").trim();
    if (!isBlobRef(s)) return s;
    const id = idFromBlobRef(s);
    if (!id) return s;
    const D = window.XXJ_DB;
    if (!D || typeof D.getMediaBlob !== "function") return s;
    try {
      await D.ready;
      const blob = await D.getMediaBlob(id);
      if (!blob) return s;
      return await blobToDataUrl(blob);
    } catch (err) {
      console.warn("[XXJ_MEDIA] hydrate export failed", id, err);
      return s;
    }
  }

  /**
   * 备份导出：xxj-blob 引用还原为 data URL，保证 ZIP 可跨设备恢复。
   * @param {unknown} inbox
   */
  async function hydrateChatInboxMediaForExport(inbox) {
    if (!inbox || typeof inbox !== "object" || !inbox.byMask) return inbox;
    const out = JSON.parse(JSON.stringify(inbox));
    const threadFields = [
      "chatHeroBgImage",
      "chatBodyBgImage",
      "chatIdentityPanelBgImage",
      "chatComposerBgImage",
      "chatImageRefDataUrl",
      "chatThreadUserAvatar",
      "chatThreadCharAvatar"
    ];
    for (const bucket of Object.values(out.byMask)) {
      if (!bucket || typeof bucket !== "object") continue;
      const threads = Array.isArray(bucket.threads) ? bucket.threads : [];
      for (const th of threads) {
        if (!th || typeof th !== "object") continue;
        for (const f of threadFields) {
          if (!th[f]) continue;
          th[f] = await hydrateImageUrlForExport(th[f]);
        }
        const messages = Array.isArray(th.messages) ? th.messages : [];
        for (const m of messages) {
          if (!m || typeof m !== "object") continue;
          if (m.sticker && typeof m.sticker === "object" && m.sticker.url) {
            m.sticker.url = await hydrateImageUrlForExport(m.sticker.url);
          }
          if (m.image && typeof m.image === "object" && m.image.url) {
            m.image.url = await hydrateImageUrlForExport(m.image.url);
          }
        }
      }
      const moments = Array.isArray(bucket.moments) ? bucket.moments : [];
      for (const mo of moments) {
        if (!mo || typeof mo !== "object") continue;
        if (mo.imageUrl) mo.imageUrl = await hydrateImageUrlForExport(mo.imageUrl);
        if (mo.mediaUrl) mo.mediaUrl = await hydrateImageUrlForExport(mo.mediaUrl);
        if (Array.isArray(mo.images)) {
          for (let i = 0; i < mo.images.length; i++) {
            const prev = String(mo.images[i] || "");
            if (!prev) continue;
            mo.images[i] = await hydrateImageUrlForExport(prev);
          }
        }
      }
      if (Array.isArray(bucket.profileDecor)) {
        for (let i = 0; i < 3; i++) {
          const prev = String(bucket.profileDecor[i] || "");
          if (!prev) continue;
          bucket.profileDecor[i] = await hydrateImageUrlForExport(prev);
        }
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    return out;
  }

  /**
   * @param {string} url
   * @returns {Promise<string>}
   */
  async function externalizeImageUrl(url) {
    const s = String(url || "").trim();
    if (!s || isBlobRef(s) || /^https?:\/\//i.test(s) || /^blob:/i.test(s)) return s;
    if (!isExternalizableDataImageUrl(s)) return s;
    const D = window.XXJ_DB;
    if (!D || typeof D.putMediaBlob !== "function") return s;
    try {
      await D.ready;
      const blob = await dataUrlToBlob(s);
      const id = await D.putMediaBlob(blob);
      const ref = blobRefFromId(id);
      const old = displayUrlCache.get(idFromBlobRef(s));
      if (old) {
        try {
          URL.revokeObjectURL(old);
        } catch (_) {}
        displayUrlCache.delete(idFromBlobRef(s));
      }
      return ref;
    } catch (err) {
      console.warn("[XXJ_MEDIA] externalize failed", err);
      return s;
    }
  }

  /**
   * @param {string} url
   * @returns {Promise<string>}
   */
  async function resolveDisplayUrl(url) {
    const s = String(url || "").trim();
    if (!s) return "";
    if (!isBlobRef(s)) return s;
    const id = idFromBlobRef(s);
    if (!id) return "";
    if (displayUrlCache.has(id)) return displayUrlCache.get(id) || "";
    const D = window.XXJ_DB;
    if (!D || typeof D.getMediaBlob !== "function") return "";
    try {
      await D.ready;
      const blob = await D.getMediaBlob(id);
      if (!blob) return "";
      const obj = URL.createObjectURL(blob);
      displayUrlCache.set(id, obj);
      return obj;
    } catch (err) {
      console.warn("[XXJ_MEDIA] resolve failed", id, err);
      return "";
    }
  }

  /**
   * @param {HTMLImageElement} img
   * @param {string} url
   */
  function applyImageToElement(img, url) {
    if (!img) return;
    const raw = String(url || "").trim();
    if (!raw) {
      img.removeAttribute("src");
      img.removeAttribute("data-xxj-blob-ref");
      return;
    }
    if (!isBlobRef(raw)) {
      img.removeAttribute("data-xxj-blob-ref");
      img.src = raw;
      return;
    }
    img.dataset.xxjBlobRef = raw;
    img.src =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"/>'
      );
    void resolveDisplayUrl(raw).then((resolved) => {
      if (!img.isConnected) return;
      if (img.dataset.xxjBlobRef !== raw) return;
      if (resolved) img.src = resolved;
    });
  }

  /**
   * @param {unknown} inbox
   * @returns {Promise<{ externalized: number }>}
   */
  async function externalizeChatInboxMedia(inbox) {
    if (!inbox || typeof inbox !== "object" || !inbox.byMask) {
      return { externalized: 0 };
    }
    let externalized = 0;
    const threadFields = [
      "chatHeroBgImage",
      "chatBodyBgImage",
      "chatIdentityPanelBgImage",
      "chatComposerBgImage",
      "chatImageRefDataUrl",
      "chatThreadUserAvatar",
      "chatThreadCharAvatar"
    ];
    for (const bucket of Object.values(inbox.byMask)) {
      if (!bucket || typeof bucket !== "object") continue;
      const threads = Array.isArray(bucket.threads) ? bucket.threads : [];
      for (const th of threads) {
        if (!th || typeof th !== "object") continue;
        for (const f of threadFields) {
          if (!th[f]) continue;
          const prev = String(th[f]);
          const next = await externalizeImageUrl(prev);
          if (next !== prev) externalized++;
          th[f] = next;
        }
        const messages = Array.isArray(th.messages) ? th.messages : [];
        for (const m of messages) {
          if (!m || typeof m !== "object") continue;
          if (m.sticker && typeof m.sticker === "object" && m.sticker.url) {
            const prev = String(m.sticker.url);
            const next = await externalizeImageUrl(prev);
            if (next !== prev) externalized++;
            m.sticker.url = next;
          }
          if (m.image && typeof m.image === "object" && m.image.url) {
            const prev = String(m.image.url);
            const next = await externalizeImageUrl(prev);
            if (next !== prev) externalized++;
            m.image.url = next;
          }
        }
      }
      const moments = Array.isArray(bucket.moments) ? bucket.moments : [];
      for (const mo of moments) {
        if (!mo || typeof mo !== "object") continue;
        if (mo.imageUrl) {
          const prev = String(mo.imageUrl);
          const next = await externalizeImageUrl(prev);
          if (next !== prev) externalized++;
          mo.imageUrl = next;
        }
        if (mo.mediaUrl) {
          const prev = String(mo.mediaUrl);
          const next = await externalizeImageUrl(prev);
          if (next !== prev) externalized++;
          mo.mediaUrl = next;
        }
        if (Array.isArray(mo.images)) {
          for (let i = 0; i < mo.images.length; i++) {
            const prev = String(mo.images[i] || "");
            if (!prev) continue;
            const next = await externalizeImageUrl(prev);
            if (next !== prev) externalized++;
            mo.images[i] = next;
          }
        }
      }
      if (Array.isArray(bucket.profileDecor)) {
        while (bucket.profileDecor.length < 3) bucket.profileDecor.push("");
        for (let i = 0; i < 3; i++) {
          const prev = String(bucket.profileDecor[i] || "");
          if (!prev) continue;
          const next = await externalizeImageUrl(prev);
          if (next !== prev) externalized++;
          bucket.profileDecor[i] = next;
        }
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    return { externalized };
  }

  /** 同会话内已解析过的 blob: URL（供 API 多模态等同步读取）。 */
  function resolveDisplayUrlCachedSync(url) {
    const id = idFromBlobRef(url);
    if (!id) return "";
    return displayUrlCache.get(id) || "";
  }

  window.XXJ_MEDIA = {
    XXJ_BLOB_REF_PREFIX,
    isBlobRef,
    blobRefFromId,
    idFromBlobRef,
    isExternalizableDataImageUrl,
    externalizeImageUrl,
    resolveDisplayUrl,
    resolveDisplayUrlCachedSync,
    applyImageToElement,
    externalizeChatInboxMedia,
    hydrateImageUrlForExport,
    hydrateChatInboxMediaForExport,
    revokeDisplayUrlCache
  };

  window.addEventListener("pagehide", revokeDisplayUrlCache, { capture: true });
})();
