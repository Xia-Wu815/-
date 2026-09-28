/**
 * MiniMax 语音气泡 → 裁剪保存为自定义铃声（与小心机 VoiceRingtonePicker 同源能力）
 */
(function () {
  "use strict";

  const WAVEFORM_BARS = 80;
  const TARGET_SAMPLE_RATE = 22050;

  const CATEGORIES = [
    { cat: "message", label: "消息提示音", desc: "收到新消息时播放", icon: "ph-bell" },
    { cat: "voiceCall", label: "语音来电铃声", desc: "语音通话来电时播放", icon: "ph-phone" },
    { cat: "videoCall", label: "视频来电铃声", desc: "视频通话来电时播放", icon: "ph-video-camera" },
    { cat: "outgoing", label: "去电提示音", desc: "拨出通话时播放", icon: "ph-phone-outgoing" }
  ];

  /** @type {{ audioUrl: string, personaId: string, personaName: string } | null} */
  let state = null;
  let audioBuffer = null;
  let duration = 0;
  let waveform = [];
  let trimStart = 0;
  let trimEnd = 0;
  let isPlaying = false;
  let playProgress = 0;
  let autoSetForCharacter = true;
  let saving = false;
  /** @type {AudioContext | null} */
  let playCtx = null;
  /** @type {AudioBufferSourceNode | null} */
  let playSource = null;
  let playRaf = 0;
  let playStartWall = 0;
  let dragging = null;

  function rt() {
    return window.Ringtones || null;
  }

  function maxSec() {
    const R = rt();
    return R && R.MAX_RINGTONE_SECONDS ? R.MAX_RINGTONE_SECONDS : 30;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function encodeWav(samples, sampleRate) {
    const numSamples = samples.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = function (offset, s) {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, numSamples * 2, true);
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  function extractPeaks(buffer, numBars) {
    const raw = buffer.getChannelData(0);
    const step = Math.floor(raw.length / numBars) || 1;
    const peaks = [];
    for (let i = 0; i < numBars; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(start + step, raw.length);
      for (let j = start; j < end; j++) {
        const abs = Math.abs(raw[j]);
        if (abs > max) max = abs;
      }
      peaks.push(max);
    }
    const globalMax = Math.max.apply(null, peaks.concat([0.01]));
    return peaks.map(function (p) {
      return p / globalMax;
    });
  }

  function resampleMono(buffer, targetRate) {
    const src = buffer.getChannelData(0);
    const srcRate = buffer.sampleRate;
    if (srcRate === targetRate) return src;
    const ratio = srcRate / targetRate;
    const outLen = Math.ceil(src.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const srcIdx = i * ratio;
      const idx = Math.floor(srcIdx);
      const frac = srcIdx - idx;
      const a = src[idx] || 0;
      const b = src[Math.min(idx + 1, src.length - 1)] || 0;
      out[i] = a + (b - a) * frac;
    }
    return out;
  }

  function fmtTime(s) {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const frac = Math.floor((s % 1) * 10);
    return mins > 0
      ? mins + ":" + String(secs).padStart(2, "0") + "." + frac
      : secs + "." + frac;
  }

  function stopPlayback() {
    window.cancelAnimationFrame(playRaf);
    playRaf = 0;
    if (playSource) {
      try {
        playSource.stop();
      } catch (_) {}
      playSource = null;
    }
    if (playCtx && playCtx.state !== "closed") {
      playCtx.close().catch(function () {});
      playCtx = null;
    }
    isPlaying = false;
    playProgress = 0;
    updatePlayUi();
  }

  function updatePlayUi() {
    const playBtn = $("vr-pick-play");
    if (playBtn) {
      playBtn.innerHTML = isPlaying
        ? '<i class="ph ph-pause" aria-hidden="true"></i> 停止'
        : '<i class="ph ph-play" aria-hidden="true"></i> 试听';
    }
    renderWaveform();
  }

  function pxToTime(clientX) {
    const box = $("vr-pick-wave");
    if (!box || duration <= 0) return 0;
    const rect = box.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }

  function onTrimPointerDown(which, e) {
    e.preventDefault();
    dragging = which;
    const onMove = function (ev) {
      if (!dragging) return;
      ev.preventDefault();
      const time = pxToTime(ev.clientX);
      const minClip = 0.5;
      const cap = maxSec();
      if (dragging === "start") {
        let clamped = Math.max(0, Math.min(time, trimEnd - minClip));
        if (trimEnd - clamped > cap) return;
        trimStart = clamped;
      } else {
        let clamped = Math.min(duration, Math.max(time, trimStart + minClip));
        if (clamped - trimStart > cap) return;
        trimEnd = clamped;
      }
      if (isPlaying) stopPlayback();
      updateTrimUi();
    };
    const onUp = function () {
      dragging = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  function renderWaveform() {
    const host = $("vr-pick-bars");
    if (!host) return;
    const startPct = duration > 0 ? (trimStart / duration) * 100 : 0;
    const endPct = duration > 0 ? (trimEnd / duration) * 100 : 100;
    const progressPct = startPct + playProgress * (endPct - startPct);
    host.innerHTML = "";
    for (let i = 0; i < waveform.length; i++) {
      const barPct = ((i + 0.5) / WAVEFORM_BARS) * 100;
      const inSelection = barPct >= startPct && barPct <= endPct;
      const isPlayed = isPlaying && barPct <= progressPct;
      const bar = document.createElement("div");
      bar.className = "vr-pick-bar";
      bar.style.height = Math.max(4, waveform[i] * 64) + "px";
      bar.style.backgroundColor = isPlayed ? "var(--accent, #07c160)" : inSelection ? "var(--text-main, #1a1a1a)" : "var(--line, #d1d5db)";
      host.appendChild(bar);
    }
    const dimL = $("vr-pick-dim-l");
    const dimR = $("vr-pick-dim-r");
    const sel = $("vr-pick-sel");
    const prog = $("vr-pick-progress");
    if (dimL) dimL.style.width = startPct + "%";
    if (dimR) dimR.style.width = 100 - endPct + "%";
    if (sel) {
      sel.style.left = startPct + "%";
      sel.style.right = 100 - endPct + "%";
    }
    if (prog) {
      prog.hidden = !isPlaying;
      prog.style.left = progressPct + "%";
    }
    const hStart = $("vr-pick-handle-start");
    const hEnd = $("vr-pick-handle-end");
    if (hStart) hStart.style.left = startPct + "%";
    if (hEnd) hEnd.style.left = endPct + "%";
  }

  function updateTrimUi() {
    const selDur = trimEnd - trimStart;
    const t0 = $("vr-pick-t0");
    const t1 = $("vr-pick-t1");
    const td = $("vr-pick-dur");
    const capHint = $("vr-pick-cap-hint");
    if (t0) t0.textContent = fmtTime(trimStart);
    if (t1) t1.textContent = fmtTime(trimEnd);
    if (td) td.textContent = selDur.toFixed(1) + "s";
    if (capHint) capHint.hidden = selDur < maxSec() - 0.05;
    renderWaveform();
  }

  function handlePlayPause() {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    if (!audioBuffer) return;
    playCtx = new AudioContext();
    playSource = playCtx.createBufferSource();
    playSource.buffer = audioBuffer;
    playSource.connect(playCtx.destination);
    const selDuration = trimEnd - trimStart;
    playSource.start(0, trimStart, selDuration);
    playStartWall = playCtx.currentTime;
    isPlaying = true;
    updatePlayUi();
    const tick = function () {
      if (!playCtx) return;
      const elapsed = playCtx.currentTime - playStartWall;
      playProgress = Math.min(elapsed / selDuration, 1);
      renderWaveform();
      if (playProgress >= 1) {
        stopPlayback();
        return;
      }
      playRaf = window.requestAnimationFrame(tick);
    };
    playRaf = window.requestAnimationFrame(tick);
    playSource.onended = function () {
      stopPlayback();
    };
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("read failed"));
      };
      reader.readAsDataURL(blob);
    });
  }

  function handleSave(cat, label) {
    if (!audioBuffer || !state || saving) return;
    const R = rt();
    if (!R || typeof R.saveVoiceAsRingtone !== "function") return;
    saving = true;
    const saveBtns = document.querySelectorAll("#vr-pick-cats [data-vr-cat]");
    saveBtns.forEach(function (b) {
      b.disabled = true;
    });
    const needsTrim = trimStart > 0.05 || duration - trimEnd > 0.05;
    const work = needsTrim
      ? (function () {
          const srcRate = audioBuffer.sampleRate;
          const startSample = Math.floor(trimStart * srcRate);
          const endSample = Math.min(Math.floor(trimEnd * srcRate), audioBuffer.length);
          const sliceLen = endSample - startSample;
          const fullChannel = audioBuffer.getChannelData(0);
          const slice = fullChannel.slice(startSample, startSample + sliceLen);
          const tmpCtx = new OfflineAudioContext(1, sliceLen, srcRate);
          const tmpBuf = tmpCtx.createBuffer(1, sliceLen, srcRate);
          tmpBuf.getChannelData(0).set(slice);
          const resampled = resampleMono(tmpBuf, TARGET_SAMPLE_RATE);
          const wavBlob = encodeWav(resampled, TARGET_SAMPLE_RATE);
          return blobToDataUrl(wavBlob).then(function (url) {
            return { dataUrl: url, mimeType: "audio/wav" };
          });
        })()
      : Promise.resolve({ dataUrl: state.audioUrl, mimeType: "audio/mpeg" });

    work
      .then(function (pack) {
        const selDur = (trimEnd - trimStart).toFixed(1);
        const name = (state.personaName || "角色") + "的语音 (" + selDur + "s)";
        return R.saveVoiceAsRingtone(pack.dataUrl, cat, name, pack.mimeType).then(function (result) {
          return { result: result, cat: cat, label: label };
        });
      })
      .then(function (out) {
        if (typeof out.result === "string") {
          if (typeof window.showToast === "function") window.showToast(out.result);
          return;
        }
        if (autoSetForCharacter && state.personaId && typeof R.loadRingtoneSettings === "function") {
          const settings = R.loadRingtoneSettings();
          if (!settings.perCharacter) settings.perCharacter = {};
          if (!settings.perCharacter[state.personaId]) settings.perCharacter[state.personaId] = {};
          settings.perCharacter[state.personaId][out.cat] = out.result.id;
          R.saveRingtoneSettings(settings);
        }
        if (typeof R.refreshSettingsUi === "function") R.refreshSettingsUi();
        if (autoSetForCharacter && state.personaId && typeof R.refreshCharDetailRingtonesUi === "function") {
          R.refreshCharDetailRingtonesUi(state.personaId);
        }
        if (typeof window.showToast === "function") {
          window.showToast(
            autoSetForCharacter
              ? "已设为 " + (state.personaName || "角色") + " 的" + out.label
              : "铃声已保存"
          );
        }
        close();
      })
      .catch(function () {
        if (typeof window.showToast === "function") window.showToast("保存失败，请重试");
      })
      .finally(function () {
        saving = false;
        saveBtns.forEach(function (b) {
          b.disabled = false;
        });
      });
  }

  function setLoading(on, errText) {
    const loadEl = $("vr-pick-loading");
    const errEl = $("vr-pick-error");
    const mainEl = $("vr-pick-main");
    if (loadEl) loadEl.hidden = !on;
    if (errEl) {
      errEl.hidden = !errText;
      if (errText) errEl.textContent = errText;
    }
    if (mainEl) mainEl.hidden = on || !!errText;
    if (!on && !errText && mainEl) mainEl.hidden = false;
  }

  function decodeAudio(url) {
    setLoading(true, "");
    return fetch(url)
      .then(function (r) {
        return r.arrayBuffer();
      })
      .then(function (buf) {
        const ctx = new AudioContext();
        return ctx.decodeAudioData(buf).then(function (decoded) {
          ctx.close().catch(function () {});
          return decoded;
        });
      })
      .then(function (decoded) {
        audioBuffer = decoded;
        duration = decoded.duration;
        waveform = extractPeaks(decoded, WAVEFORM_BARS);
        trimStart = 0;
        trimEnd = Math.min(decoded.duration, maxSec());
        setLoading(false, "");
        updateTrimUi();
      })
      .catch(function () {
        setLoading(false, "无法解析音频文件");
      });
  }

  function bindOnce() {
    if (window.__vrPickBound) return;
    window.__vrPickBound = true;
    $("vr-pick-backdrop")?.addEventListener("click", close);
    $("vr-pick-close")?.addEventListener("click", close);
    $("vr-pick-cancel")?.addEventListener("click", close);
    $("vr-pick-play")?.addEventListener("click", handlePlayPause);
    $("vr-pick-handle-start")?.addEventListener("pointerdown", function (e) {
      onTrimPointerDown("start", e);
    });
    $("vr-pick-handle-end")?.addEventListener("pointerdown", function (e) {
      onTrimPointerDown("end", e);
    });
    $("vr-pick-auto-toggle")?.addEventListener("click", function () {
      autoSetForCharacter = !autoSetForCharacter;
      this.setAttribute("aria-pressed", autoSetForCharacter ? "true" : "false");
      this.classList.toggle("is-on", autoSetForCharacter);
    });
    const cats = $("vr-pick-cats");
    if (cats) {
      CATEGORIES.forEach(function (c) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "vr-pick-cat-row";
        btn.dataset.vrCat = c.cat;
        btn.innerHTML =
          '<span class="vr-pick-cat-icon"><i class="ph ' +
          c.icon +
          '" aria-hidden="true"></i></span>' +
          '<span class="vr-pick-cat-text"><span class="vr-pick-cat-label">' +
          c.label +
          '</span><span class="vr-pick-cat-desc">' +
          c.desc +
          "</span></span>";
        btn.addEventListener("click", function () {
          handleSave(c.cat, c.label);
        });
        cats.appendChild(btn);
      });
    }
  }

  function open(opts) {
    bindOnce();
    if (!opts || !opts.audioUrl) return;
    state = {
      audioUrl: String(opts.audioUrl),
      personaId: String(opts.personaId || ""),
      personaName: String(opts.personaName || "角色")
    };
    autoSetForCharacter = true;
    const toggle = $("vr-pick-auto-toggle");
    if (toggle) {
      toggle.setAttribute("aria-pressed", "true");
      toggle.classList.add("is-on");
    }
    const sub = $("vr-pick-sub");
    if (sub) sub.textContent = state.personaName + "的语音 · 解析中…";
    const autoLabel = $("vr-pick-auto-name");
    if (autoLabel) autoLabel.textContent = state.personaName;
    setLoading(true, "");
    const root = $("voice-ringtone-picker");
    if (!root) return;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(function () {
      root.classList.add("is-open");
    });
    void decodeAudio(state.audioUrl).then(function () {
      if (sub) sub.textContent = state.personaName + "的语音 · " + duration.toFixed(1) + "s";
    });
  }

  function close() {
    stopPlayback();
    const root = $("voice-ringtone-picker");
    if (root) {
      root.classList.remove("is-open");
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
    }
    state = null;
    audioBuffer = null;
  }

  window.VoiceRingtonePicker = { open: open, close: close };
})();
