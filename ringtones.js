/**
 * 提示音与铃声（Web Audio 内置音色 + 自定义上传，存 IndexedDB KV）
 */
(function () {
  "use strict";

  const RT_SETTINGS_KEY = "app_ringtone_settings";
  const CUSTOM_RT_KEY = "app_custom_ringtones";
  const IN_CHAT_SOUND_KEY = "chat_in_chat_sound_enabled";

  const DEFAULT_SETTINGS = {
    messageSoundId: "tri_tone",
    voiceCallRingtoneId: "classic_ring",
    videoCallRingtoneId: "starlight",
    outgoingCallToneId: "classic_dial",
    perCharacter: {}
  };

  function getD() {
    return typeof window !== "undefined" ? window.D : null;
  }

  function persistKv(key, value) {
    const D = getD();
    if (D && typeof D.setKv === "function") D.setKv(key, value);
    else {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_) {}
    }
  }

  function readKv(key, fallback) {
    const D = getD();
    if (D && typeof D.getKv === "function") {
      const v = D.getKv(key);
      if (v !== undefined) return v;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch (_) {}
    return fallback;
  }

  function playTime(ctx) {
    return ctx.currentTime + 0.06;
  }

  function note(ctx, dest, freq, type, startTime, duration, gainVal, fadeOut) {
    gainVal = gainVal === undefined ? 0.35 : gainVal;
    fadeOut = fadeOut === undefined ? 0.05 : fadeOut;
    startTime = Math.max(startTime, ctx.currentTime + 0.01);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.linearRampToValueAtTime(0, startTime + duration - fadeOut);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration);
    return { osc, gain };
  }

  function createLoopingRingtone(playOnce, cycleDuration) {
    return function (ctx, dest) {
      let stopped = false;
      let timeoutId = 0;
      const playLoop = function () {
        if (stopped) return;
        playOnce(ctx, dest, playTime(ctx));
        timeoutId = window.setTimeout(playLoop, cycleDuration * 1000);
      };
      playLoop();
      return {
        stop: function () {
          stopped = true;
          window.clearTimeout(timeoutId);
        }
      };
    };
  }

  const msgTriTone = {
    id: "tri_tone", name: "三全音", nameEn: "Tri-Tone",
    play: function (ctx, dest) {
      const t = playTime(ctx);
      const nodes = [
        note(ctx, dest, 1046.5, "sine", t, 0.12, 0.3),
        note(ctx, dest, 1318.5, "sine", t + 0.14, 0.12, 0.3),
        note(ctx, dest, 1568, "sine", t + 0.28, 0.18, 0.3)
      ];
      return { stop: function () { nodes.forEach(function (n) { try { n.osc.stop(); } catch (_) {} }); } };
    }
  };

  const msgBamboo = {
    id: "bamboo", name: "竹韵", nameEn: "Bamboo",
    play: function (ctx, dest) {
      const t = playTime(ctx);
      const nodes = [
        note(ctx, dest, 880, "triangle", t, 0.08, 0.35),
        note(ctx, dest, 1100, "triangle", t + 0.1, 0.08, 0.25)
      ];
      return { stop: function () { nodes.forEach(function (n) { try { n.osc.stop(); } catch (_) {} }); } };
    }
  };

  const msgChime = {
    id: "chime", name: "风铃", nameEn: "Chime",
    play: function (ctx, dest) {
      const t = playTime(ctx);
      const nodes = [
        note(ctx, dest, 2093, "sine", t, 0.25, 0.2),
        note(ctx, dest, 1568, "sine", t + 0.05, 0.3, 0.12)
      ];
      return { stop: function () { nodes.forEach(function (n) { try { n.osc.stop(); } catch (_) {} }); } };
    }
  };

  const msgGlass = {
    id: "glass", name: "水晶", nameEn: "Glass",
    play: function (ctx, dest) {
      const t = playTime(ctx);
      const nodes = [
        note(ctx, dest, 3136, "sine", t, 0.15, 0.18),
        note(ctx, dest, 2637, "sine", t + 0.03, 0.2, 0.1),
        note(ctx, dest, 3520, "sine", t + 0.08, 0.12, 0.08)
      ];
      return { stop: function () { nodes.forEach(function (n) { try { n.osc.stop(); } catch (_) {} }); } };
    }
  };

  const msgDrop = {
    id: "drop", name: "水滴", nameEn: "Drop",
    play: function (ctx, dest) {
      const t = playTime(ctx);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1800, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.2);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.2);
      return { stop: function () { try { osc.stop(); } catch (_) {} } };
    }
  };

  const msgPulse = {
    id: "pulse", name: "脉冲", nameEn: "Pulse",
    play: function (ctx, dest) {
      const t = playTime(ctx);
      const nodes = [
        note(ctx, dest, 660, "square", t, 0.06, 0.2),
        note(ctx, dest, 880, "square", t + 0.08, 0.06, 0.2)
      ];
      return { stop: function () { nodes.forEach(function (n) { try { n.osc.stop(); } catch (_) {} }); } };
    }
  };

  const silent = {
    id: "silent", name: "无", nameEn: "Silent",
    play: function () { return { stop: function () {} }; }
  };

  const callClassic = {
    id: "classic_ring", name: "经典", nameEn: "Classic",
    play: createLoopingRingtone(function (ctx, dest, t) {
      [0, 0.15, 0.3, 0.45].forEach(function (offset, i) {
        note(ctx, dest, i % 2 === 0 ? 880 : 698, "sine", t + offset, 0.12, 0.25);
      });
    }, 1.5)
  };

  const callRipple = {
    id: "ripple", name: "涟漪", nameEn: "Ripple",
    play: createLoopingRingtone(function (ctx, dest, t) {
      [0, 0.12, 0.24, 0.36, 0.48].forEach(function (offset, i) {
        note(ctx, dest, 600 + i * 150, "sine", t + offset, 0.1, 0.2);
      });
    }, 1.8)
  };

  const callStarlight = {
    id: "starlight", name: "星光", nameEn: "Starlight",
    play: createLoopingRingtone(function (ctx, dest, t) {
      [0, 0.2, 0.4].forEach(function (offset, i) {
        note(ctx, dest, [1047, 1319, 1568][i], "sine", t + offset, 0.18, 0.22);
      });
    }, 1.6)
  };

  const callGentle = {
    id: "gentle", name: "轻柔", nameEn: "Gentle",
    play: createLoopingRingtone(function (ctx, dest, t) {
      note(ctx, dest, 523, "sine", t, 0.4, 0.2);
      note(ctx, dest, 659, "sine", t + 0.15, 0.35, 0.15);
      note(ctx, dest, 784, "sine", t + 0.3, 0.3, 0.12);
    }, 2.0)
  };

  const callUrgent = {
    id: "urgent", name: "急促", nameEn: "Urgent",
    play: createLoopingRingtone(function (ctx, dest, t) {
      [0, 0.08, 0.16, 0.24, 0.5, 0.58, 0.66, 0.74].forEach(function (offset) {
        note(ctx, dest, 1000, "square", t + offset, 0.06, 0.2);
      });
    }, 1.4)
  };

  const outClassicDial = {
    id: "classic_dial", name: "经典拨号", nameEn: "Classic Dial",
    play: createLoopingRingtone(function (ctx, dest, t) {
      note(ctx, dest, 440, "sine", t, 0.8, 0.15);
    }, 3.0)
  };

  const outDigital = {
    id: "digital", name: "数字", nameEn: "Digital",
    play: createLoopingRingtone(function (ctx, dest, t) {
      note(ctx, dest, 480, "sine", t, 0.4, 0.12);
      note(ctx, dest, 620, "sine", t, 0.4, 0.12);
    }, 2.5)
  };

  const outSoft = {
    id: "soft_dial", name: "柔和", nameEn: "Soft",
    play: createLoopingRingtone(function (ctx, dest, t) {
      note(ctx, dest, 392, "sine", t, 0.6, 0.12);
      note(ctx, dest, 523, "sine", t + 0.02, 0.55, 0.08);
    }, 2.8)
  };

  const MESSAGE_SOUNDS = [msgTriTone, msgBamboo, msgChime, msgGlass, msgDrop, msgPulse, silent];
  const VOICE_CALL_RINGTONES = [callClassic, callRipple, callStarlight, callGentle, callUrgent, silent];
  const VIDEO_CALL_RINGTONES = [callClassic, callRipple, callStarlight, callGentle, callUrgent, silent];
  const OUTGOING_CALL_TONES = [outClassicDial, outDigital, outSoft, silent];

  const CATEGORY_META = {
    message: { label: "消息提示音", presets: MESSAGE_SOUNDS, settingsKey: "messageSoundId" },
    voiceCall: { label: "语音来电铃声", presets: VOICE_CALL_RINGTONES, settingsKey: "voiceCallRingtoneId" },
    videoCall: { label: "视频来电铃声", presets: VIDEO_CALL_RINGTONES, settingsKey: "videoCallRingtoneId" },
    outgoing: { label: "去电提示音", presets: OUTGOING_CALL_TONES, settingsKey: "outgoingCallToneId" }
  };

  function getPresetsForCategory(cat) {
    return CATEGORY_META[cat] ? CATEGORY_META[cat].presets : MESSAGE_SOUNDS;
  }

  let cachedSettings = null;
  let customRingtonesCache = null;
  let audioCtx = null;
  let currentHandle = null;
  let playingPreviewId = null;

  function loadRingtoneSettings() {
    if (cachedSettings) return cachedSettings;
    const raw = readKv(RT_SETTINGS_KEY, null);
    if (raw && typeof raw === "object") {
      cachedSettings = Object.assign({}, DEFAULT_SETTINGS, raw);
      if (!cachedSettings.perCharacter || typeof cachedSettings.perCharacter !== "object") {
        cachedSettings.perCharacter = {};
      }
      return cachedSettings;
    }
    cachedSettings = Object.assign({}, DEFAULT_SETTINGS);
    return cachedSettings;
  }

  function saveRingtoneSettings(settings) {
    cachedSettings = settings;
    persistKv(RT_SETTINGS_KEY, settings);
  }

  function getEffectiveSoundId(personaId, category) {
    const s = loadRingtoneSettings();
    if (personaId && s.perCharacter[personaId] && s.perCharacter[personaId][category]) {
      return s.perCharacter[personaId][category];
    }
    const meta = CATEGORY_META[category];
    if (meta) return s[meta.settingsKey] || DEFAULT_SETTINGS[meta.settingsKey];
    return DEFAULT_SETTINGS.messageSoundId;
  }

  function isInChatSoundEnabled() {
    const v = readKv(IN_CHAT_SOUND_KEY, null);
    if (v === true || v === "true") return true;
    try {
      return localStorage.getItem(IN_CHAT_SOUND_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  function setInChatSoundEnabled(enabled) {
    persistKv(IN_CHAT_SOUND_KEY, enabled ? "true" : "false");
    try {
      localStorage.setItem(IN_CHAT_SOUND_KEY, enabled ? "true" : "false");
    } catch (_) {}
  }

  function getAudioContextCtor() {
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function getAudioContext() {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    if (!audioCtx || audioCtx.state === "closed") audioCtx = new Ctor();
    return audioCtx;
  }

  /** 须在用户手势后 await，否则内置 Web Audio 无声 */
  function ensureAudioContextRunning() {
    const ctx = getAudioContext();
    if (!ctx) return Promise.reject(new Error("Web Audio 不可用"));
    if (ctx.state === "suspended") {
      return ctx.resume().then(function () { return ctx; });
    }
    return Promise.resolve(ctx);
  }

  function bindGlobalAudioUnlockOnce() {
    if (bindGlobalAudioUnlockOnce.done) return;
    bindGlobalAudioUnlockOnce.done = true;
    const unlock = function () {
      ensureAudioContextRunning().catch(function () {});
    };
    document.addEventListener("pointerdown", unlock, { capture: true, passive: true });
    document.addEventListener("keydown", unlock, { capture: true, passive: true });
  }
  bindGlobalAudioUnlockOnce.done = false;

  function stopCurrentSound() {
    if (currentHandle) {
      currentHandle.stop();
      currentHandle = null;
    }
    playingPreviewId = null;
  }

  function playSound(soundId, category) {
    stopCurrentSound();
    const presets = getPresetsForCategory(category);
    const preset = presets.find(function (p) { return p.id === soundId; }) || presets[0];
    if (!preset || preset.id === "silent") return { stop: function () {} };

    const ref = { inner: null, cancelled: false };
    const wrapper = {
      stop: function () {
        ref.cancelled = true;
        if (ref.inner) {
          try { ref.inner.stop(); } catch (_) {}
        }
        if (currentHandle === wrapper) currentHandle = null;
      }
    };
    currentHandle = wrapper;

    ensureAudioContextRunning().then(function (ctx) {
      if (ref.cancelled) return;
      ref.inner = preset.play(ctx, ctx.destination);
      if (!ref.cancelled) currentHandle = ref.inner;
    }).catch(function (err) {
      console.warn("[Ringtones] 内置音色播放失败", err);
    });

    return wrapper;
  }

  function loadCustomRingtones() {
    if (customRingtonesCache) return Promise.resolve(customRingtonesCache);
    const data = readKv(CUSTOM_RT_KEY, []);
    customRingtonesCache = Array.isArray(data) ? data : [];
    return Promise.resolve(customRingtonesCache);
  }

  function saveCustomRingtones(list) {
    customRingtonesCache = list;
    persistKv(CUSTOM_RT_KEY, list);
    return Promise.resolve();
  }

  function playCustomRingtone(id, category) {
    stopCurrentSound();
    return loadCustomRingtones().then(function (all) {
      const entry = all.find(function (r) { return r.id === id; });
      if (!entry) return { stop: function () {} };
      const isLoop = category !== "message";
      let audio = null;
      let stopped = false;
      try {
        audio = new Audio(entry.dataUrl);
        audio.loop = isLoop;
        audio.volume = 1;
        const p = audio.play();
        if (p && typeof p.catch === "function") p.catch(function () {});
      } catch (_) {
        return { stop: function () {} };
      }
      const handle = {
        stop: function () {
          stopped = true;
          if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.src = "";
            audio = null;
          }
        }
      };
      currentHandle = handle;
      if (isLoop) {
        window.setTimeout(function () {
          if (!stopped) handle.stop();
          if (currentHandle === handle) currentHandle = null;
        }, 3000);
      }
      return handle;
    });
  }

  function playSoundEnhanced(soundId, category) {
    if (String(soundId).indexOf("custom_") === 0) {
      const ref = { h: null };
      playCustomRingtone(soundId, category).then(function (h) { ref.h = h; });
      return {
        stop: function () {
          if (ref.h) ref.h.stop();
          stopCurrentSound();
        }
      };
    }
    return playSound(soundId, category);
  }

  function playSoundForPersona(personaId, category) {
    return playSoundEnhanced(getEffectiveSoundId(personaId, category), category);
  }

  function previewSound(soundId, category) {
    playingPreviewId = soundId;
    if (String(soundId).indexOf("custom_") === 0) {
      stopCurrentSound();
      playCustomRingtone(soundId, category);
      window.setTimeout(function () { playingPreviewId = null; }, 3000);
      return;
    }
    ensureAudioContextRunning().then(function () {
      const handle = playSound(soundId, category);
      if (category !== "message") {
        window.setTimeout(function () {
          try { handle.stop(); } catch (_) {}
          playingPreviewId = null;
        }, 3000);
      } else {
        window.setTimeout(function () { playingPreviewId = null; }, 900);
      }
    }).catch(function () {});
  }

  const CUSTOM_RINGTONE_MAX_SIZE = 1024 * 1024;
  const CUSTOM_RINGTONE_MAX_COUNT = 20;
  const CUSTOM_RINGTONE_ACCEPT = "audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/x-m4a,.mp3,.wav,.ogg,.m4a,.aac";

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function uploadCustomRingtone(file, category, customName) {
    if (!file || file.size > CUSTOM_RINGTONE_MAX_SIZE) {
      return Promise.resolve("文件过大（最大 " + formatFileSize(CUSTOM_RINGTONE_MAX_SIZE) + "）。");
    }
    const validTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/x-m4a", "audio/mp3"];
    if (!validTypes.includes(file.type) && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)) {
      return Promise.resolve("不支持的格式，请上传 MP3、WAV、OGG、M4A 或 AAC。");
    }
    return loadCustomRingtones().then(function (existing) {
      if (existing.length >= CUSTOM_RINGTONE_MAX_COUNT) {
        return "自定义铃声已达上限（" + CUSTOM_RINGTONE_MAX_COUNT + " 个）。";
      }
      return new Promise(function (resolve) {
        const reader = new FileReader();
        reader.onload = function () {
          const dataUrl = String(reader.result || "");
          const displayName = (customName || file.name.replace(/\.[^.]+$/, "")).slice(0, 30);
          const entry = {
            id: "custom_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
            name: displayName,
            category: category,
            dataUrl: dataUrl,
            fileSize: file.size,
            mimeType: file.type || "audio/mpeg",
            createdAt: Date.now()
          };
          return saveCustomRingtones(existing.concat([entry])).then(function () { resolve(entry); });
        };
        reader.onerror = function () { resolve("读取文件失败"); };
        reader.readAsDataURL(file);
      });
    });
  }

  const MAX_RINGTONE_SECONDS = 30;

  function saveVoiceAsRingtone(dataUrl, category, displayName, mimeType) {
    mimeType = mimeType || "audio/wav";
    return loadCustomRingtones().then(function (existing) {
      if (existing.length >= CUSTOM_RINGTONE_MAX_COUNT) {
        return "自定义铃声已达上限（" + CUSTOM_RINGTONE_MAX_COUNT + " 个）。";
      }
      const estimatedSize = Math.ceil(String(dataUrl || "").length * 0.75);
      const entry = {
        id: "custom_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        name: String(displayName || "语音").slice(0, 30),
        category: category,
        dataUrl: dataUrl,
        fileSize: estimatedSize,
        mimeType: mimeType,
        createdAt: Date.now()
      };
      return saveCustomRingtones(existing.concat([entry])).then(function () {
        return entry;
      });
    });
  }

  function deleteCustomRingtone(id) {
    return loadCustomRingtones().then(function (existing) {
      return saveCustomRingtones(existing.filter(function (r) { return r.id !== id; })).then(function () {
        const settings = loadRingtoneSettings();
        let changed = false;
        if (settings.messageSoundId === id) { settings.messageSoundId = DEFAULT_SETTINGS.messageSoundId; changed = true; }
        if (settings.voiceCallRingtoneId === id) { settings.voiceCallRingtoneId = DEFAULT_SETTINGS.voiceCallRingtoneId; changed = true; }
        if (settings.videoCallRingtoneId === id) { settings.videoCallRingtoneId = DEFAULT_SETTINGS.videoCallRingtoneId; changed = true; }
        if (settings.outgoingCallToneId === id) { settings.outgoingCallToneId = DEFAULT_SETTINGS.outgoingCallToneId; changed = true; }
        Object.keys(settings.perCharacter).forEach(function (pid) {
          const pc = settings.perCharacter[pid];
          Object.keys(pc).forEach(function (cat) {
            if (pc[cat] === id) { delete pc[cat]; changed = true; }
          });
          if (!Object.keys(pc).length) delete settings.perCharacter[pid];
        });
        if (changed) saveRingtoneSettings(settings);
      });
    });
  }

  /** ─── 设置页 UI（沿用没心机 settings-api-field 样式） ─── */
  let settingsUiBound = false;
  const RT_CATS = ["message", "voiceCall", "videoCall", "outgoing"];

  function renderCategoryList(cat, customList) {
    const host = document.getElementById("rt-list-" + cat);
    if (!host) return;
    const meta = CATEGORY_META[cat];
    const settings = loadRingtoneSettings();
    const currentId = settings[meta.settingsKey];
    const customs = (customList || []).filter(function (r) { return r.category === cat; });
    host.innerHTML = "";

    function addItem(id, name, sub, isCustom) {
      const selected = id === currentId;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "settings-row" + (selected ? " is-selected" : "");
      btn.dataset.soundId = id;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", selected ? "true" : "false");

      const left = document.createElement("span");
      left.className = "settings-row-l";
      const label = document.createElement("span");
      label.textContent = name;
      left.appendChild(label);
      if (sub) {
        const subEl = document.createElement("span");
        subEl.className = "settings-row-r mono";
        subEl.textContent = isCustom ? sub : sub;
        left.appendChild(document.createTextNode(" "));
        left.appendChild(subEl);
      }

      const right = document.createElement("span");
      right.className = "settings-row-r";
      if (selected) {
        right.innerHTML = '<i class="ph ph-check" aria-hidden="true"></i>';
      } else {
        right.textContent = "试听";
      }

      btn.append(left, right);
      btn.addEventListener("click", function () {
        ensureAudioContextRunning().then(function () {
          const next = loadRingtoneSettings();
          next[meta.settingsKey] = id;
          saveRingtoneSettings(next);
          previewSound(id, cat);
          refreshRingtoneSettingsUi();
        }).catch(function () {});
      });
      host.appendChild(btn);
    }

    meta.presets.forEach(function (p) {
      addItem(p.id, p.name, p.nameEn || "", false);
    });
    if (customs.length) {
      const cap = document.createElement("p");
      cap.className = "settings-ai-key-note rt-sound-cap";
      cap.textContent = "已上传";
      host.appendChild(cap);
      customs.forEach(function (cr) {
        addItem(cr.id, cr.name, formatFileSize(cr.fileSize), true);
      });
    }
  }

  function renderCustomList(customList) {
    const list = document.getElementById("rt-custom-list");
    const countEl = document.getElementById("rt-custom-count");
    if (countEl) countEl.textContent = String(customList.length) + " / " + CUSTOM_RINGTONE_MAX_COUNT;
    if (!list) return;
    list.innerHTML = "";
    if (!customList.length) {
      const empty = document.createElement("p");
      empty.className = "settings-ai-key-note";
      empty.textContent = "暂无自定义铃声";
      list.appendChild(empty);
      return;
    }
    customList.forEach(function (cr) {
      const row = document.createElement("div");
      row.className = "rt-custom-row";
      const catLabel = CATEGORY_META[cr.category] ? CATEGORY_META[cr.category].label : cr.category;
      const info = document.createElement("span");
      info.className = "rt-custom-row-info";
      info.textContent = cr.name + " · " + catLabel + " · " + formatFileSize(cr.fileSize);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "chip ghost chip-xs";
      del.textContent = "删除";
      del.addEventListener("click", function () {
        stopCurrentSound();
        deleteCustomRingtone(cr.id).then(refreshRingtoneSettingsUi);
      });
      row.append(info, del);
      list.appendChild(row);
    });
  }

  function refreshRingtoneSettingsUi() {
    const cached = customRingtonesCache || [];
    RT_CATS.forEach(function (cat) {
      renderCategoryList(cat, cached);
    });
    renderCustomList(cached);
    const toggle = document.getElementById("rt-in-chat-toggle");
    if (toggle) toggle.setAttribute("aria-pressed", isInChatSoundEnabled() ? "true" : "false");

    return loadCustomRingtones().then(function (customList) {
      RT_CATS.forEach(function (cat) {
        renderCategoryList(cat, customList);
      });
      renderCustomList(customList);
      if (toggle) toggle.setAttribute("aria-pressed", isInChatSoundEnabled() ? "true" : "false");
    });
  }

  let charDetailUiBound = false;
  let charDetailPersonaId = null;
  let charDetailPickerOpen = false;

  function readPerCharacterOverrides(personaId) {
    if (!personaId) return {};
    const s = loadRingtoneSettings();
    const raw = s.perCharacter && s.perCharacter[personaId];
    return raw && typeof raw === "object" ? Object.assign({}, raw) : {};
  }

  function writePerCharacterOverrides(personaId, overrides) {
    if (!personaId) return;
    const settings = loadRingtoneSettings();
    if (!settings.perCharacter || typeof settings.perCharacter !== "object") {
      settings.perCharacter = {};
    }
    const next = overrides && typeof overrides === "object" ? overrides : {};
    if (!Object.keys(next).length) delete settings.perCharacter[personaId];
    else settings.perCharacter[personaId] = next;
    saveRingtoneSettings(settings);
  }

  function syncCharDetailRtSummary(personaId) {
    const el = document.getElementById("chat-detail-char-rt-summary");
    if (!el) return;
    if (!personaId) {
      el.textContent = "跟随全局设置";
      return;
    }
    const n = Object.keys(readPerCharacterOverrides(personaId)).length;
    el.textContent = n > 0 ? "已自定义 " + n + " 项" : "跟随全局设置";
  }

  function renderCharDetailRingtones(personaId, customList) {
    const host = document.getElementById("chat-detail-char-rt-picker");
    if (!host) return;
    if (!personaId) {
      host.innerHTML = "";
      return;
    }
    const overrides = readPerCharacterOverrides(personaId);
    host.innerHTML = "";
    RT_CATS.forEach(function (cat) {
      const meta = CATEGORY_META[cat];
      if (!meta) return;
      const block = document.createElement("div");
      block.className = "rt-char-cat";
      const label = document.createElement("span");
      label.className = "rt-char-cat-k";
      label.textContent = meta.label;
      const chips = document.createElement("div");
      chips.className = "rt-char-chips";
      chips.setAttribute("role", "listbox");
      chips.setAttribute("aria-label", meta.label);

      function pick(soundId) {
        const next = Object.assign({}, readPerCharacterOverrides(personaId));
        if (!soundId) delete next[cat];
        else next[cat] = soundId;
        writePerCharacterOverrides(personaId, next);
        syncCharDetailRtSummary(personaId);
        renderCharDetailRingtones(personaId, customList);
      }

      const defBtn = document.createElement("button");
      defBtn.type = "button";
      defBtn.className = "rt-char-chip" + (!overrides[cat] ? " is-selected" : "");
      defBtn.textContent = "默认";
      defBtn.setAttribute("role", "option");
      defBtn.setAttribute("aria-selected", !overrides[cat] ? "true" : "false");
      defBtn.addEventListener("click", function () {
        stopCurrentSound();
        pick(null);
      });
      chips.appendChild(defBtn);

      meta.presets.forEach(function (p) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rt-char-chip" + (overrides[cat] === p.id ? " is-selected" : "");
        btn.textContent = p.name;
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", overrides[cat] === p.id ? "true" : "false");
        btn.addEventListener("click", function () {
          ensureAudioContextRunning().then(function () {
            stopCurrentSound();
            pick(p.id);
            previewSound(p.id, cat);
          }).catch(function () {});
        });
        chips.appendChild(btn);
      });

      const customs = (customList || []).filter(function (r) {
        return r.category === cat;
      });
      customs.forEach(function (cr) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "rt-char-chip rt-char-chip--custom" + (overrides[cat] === cr.id ? " is-selected" : "");
        btn.textContent = cr.name;
        btn.title = cr.name;
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", overrides[cat] === cr.id ? "true" : "false");
        btn.addEventListener("click", function () {
          ensureAudioContextRunning().then(function () {
            stopCurrentSound();
            pick(cr.id);
            previewSound(cr.id, cat);
          }).catch(function () {});
        });
        chips.appendChild(btn);
      });

      block.append(label, chips);
      host.appendChild(block);
    });
  }

  function refreshCharDetailRingtonesUi(personaId) {
    charDetailPersonaId = personaId && String(personaId).trim() ? String(personaId).trim() : null;
    const field = document.getElementById("chat-detail-char-rt-field");
    if (field) field.hidden = !charDetailPersonaId;
    syncCharDetailRtSummary(charDetailPersonaId);
    const picker = document.getElementById("chat-detail-char-rt-picker");
    const toggle = document.getElementById("chat-detail-char-rt-toggle");
    if (!charDetailPersonaId) {
      if (picker) picker.hidden = true;
      if (toggle) {
        toggle.textContent = "自定义";
        toggle.setAttribute("aria-expanded", "false");
      }
      charDetailPickerOpen = false;
      const host = document.getElementById("chat-detail-char-rt-picker");
      if (host) host.innerHTML = "";
      return Promise.resolve();
    }
    if (!charDetailPickerOpen && picker) picker.hidden = true;
    if (!charDetailPickerOpen) return Promise.resolve();
    return loadCustomRingtones().then(function (list) {
      customRingtonesCache = list;
      renderCharDetailRingtones(charDetailPersonaId, list);
    });
  }

  function bindCharDetailRingtonesOnce() {
    if (charDetailUiBound) return;
    charDetailUiBound = true;
    document.getElementById("chat-detail-char-rt-toggle")?.addEventListener("click", function () {
      const picker = document.getElementById("chat-detail-char-rt-picker");
      if (!picker || !charDetailPersonaId) return;
      charDetailPickerOpen = !charDetailPickerOpen;
      picker.hidden = !charDetailPickerOpen;
      this.textContent = charDetailPickerOpen ? "收起" : "自定义";
      this.setAttribute("aria-expanded", charDetailPickerOpen ? "true" : "false");
      if (charDetailPickerOpen) {
        void refreshCharDetailRingtonesUi(charDetailPersonaId);
      } else {
        stopCurrentSound();
      }
    });
  }

  function bindRingtoneSettingsUiOnce() {
    if (settingsUiBound) return;
    settingsUiBound = true;

    document.getElementById("rt-in-chat-toggle")?.addEventListener("click", function () {
      const next = !isInChatSoundEnabled();
      setInChatSoundEnabled(next);
      const btn = document.getElementById("rt-in-chat-toggle");
      if (btn) btn.setAttribute("aria-pressed", next ? "true" : "false");
    });

    document.getElementById("rt-upload-btn")?.addEventListener("click", function () {
      document.getElementById("rt-upload-file")?.click();
    });

    document.getElementById("rt-upload-file")?.addEventListener("change", function (e) {
      const input = /** @type {HTMLInputElement} */ (e.target);
      const file = input.files && input.files[0];
      if (!file) return;
      const catSel = document.getElementById("rt-upload-cat");
      const category = catSel && catSel.value ? catSel.value : "message";
      const errEl = document.getElementById("rt-upload-error");
      if (errEl) errEl.textContent = "";
      uploadCustomRingtone(file, category).then(function (result) {
        input.value = "";
        if (typeof result === "string") {
          if (errEl) errEl.textContent = result;
          return;
        }
        refreshRingtoneSettingsUi();
        if (errEl) errEl.textContent = "已上传「" + result.name + "」，可在对应下拉框选用。";
      });
    });
  }

  function initSettingsUi() {
    bindGlobalAudioUnlockOnce();
    bindRingtoneSettingsUiOnce();
    bindCharDetailRingtonesOnce();
    refreshRingtoneSettingsUi();
  }

  bindGlobalAudioUnlockOnce();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSettingsUi);
  } else {
    initSettingsUi();
  }

  window.Ringtones = {
    MESSAGE_SOUNDS: MESSAGE_SOUNDS,
    VOICE_CALL_RINGTONES: VOICE_CALL_RINGTONES,
    VIDEO_CALL_RINGTONES: VIDEO_CALL_RINGTONES,
    OUTGOING_CALL_TONES: OUTGOING_CALL_TONES,
    CUSTOM_RINGTONE_ACCEPT: CUSTOM_RINGTONE_ACCEPT,
    loadRingtoneSettings: loadRingtoneSettings,
    saveRingtoneSettings: saveRingtoneSettings,
    getEffectiveSoundId: getEffectiveSoundId,
    isInChatSoundEnabled: isInChatSoundEnabled,
    setInChatSoundEnabled: setInChatSoundEnabled,
    playSound: playSound,
    playSoundForPersona: playSoundForPersona,
    stopCurrentSound: stopCurrentSound,
    previewSound: previewSound,
    loadCustomRingtones: loadCustomRingtones,
    uploadCustomRingtone: uploadCustomRingtone,
    deleteCustomRingtone: deleteCustomRingtone,
    formatFileSize: formatFileSize,
    saveVoiceAsRingtone: saveVoiceAsRingtone,
    MAX_RINGTONE_SECONDS: MAX_RINGTONE_SECONDS,
    initSettingsUi: initSettingsUi,
    refreshSettingsUi: refreshRingtoneSettingsUi,
    refreshCharDetailRingtonesUi: refreshCharDetailRingtonesUi
  };
})();
