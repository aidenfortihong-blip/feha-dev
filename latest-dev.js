(() => {
  const BUILD = "0.3.2";
  let observer = null;

  const norm = value => String(value ?? "").trim().toLowerCase();

  function findCache(actor) {
    return actor?.items?.find?.(item =>
      item.flags?.fleshEnshrouded?.cyberStorage === true
    ) ?? actor?.items?.find?.(item =>
      ["backpack", "container"].includes(item.type) &&
      norm(item.name) === "cyberware cache"
    ) ?? null;
  }

  function isInCache(item, cache) {
    if (!item || !cache) return false;
    const container = item.system?.container;
    return container === cache.id || container?.id === cache.id;
  }

  function installOwnedBridge(api) {
    if (!api || api.__fehaOwnedBridge021) return;
    api.__fehaOwnedBridge021 = true;

    const originalGetOwned = api.getOwned?.bind(api);

    api.getOwned = (slotName = null) => {
      const actor = api.getActor?.();
      const cache = findCache(actor);

      const actorOwned = [...(actor?.items ?? [])].filter(item => {
        const stashed = isInCache(item, cache);
        const explicitlyUninstalled =
          item.flags?.fleshEnshrouded?.installed === false ||
          item.flags?.fleshEnshrouded?.isInstalled === false;

        // The Cyberware Cache itself is never hardware.
        if (item.id === cache?.id) return false;

        // Anything physically inside the dedicated cache is owned chrome.
        // Explicitly-uninstalled chrome is also considered owned even when
        // older data lost its container link.
        return stashed || explicitlyUninstalled;
      });

      // Deduplicate by embedded item id.
      const deduped = [...new Map(actorOwned.map(item => [item.id, item])).values()];

      const filtered = slotName
        ? deduped.filter(item => api.slotOf?.(item) === slotName)
        : deduped;

      if (globalThis.FEHA_DEV_DIAGNOSTICS) {
        console.table(filtered.map(item => ({
          item: item.name,
          slot: api.slotOf?.(item),
          container: item.system?.container?.id ?? item.system?.container ?? null,
          purchased: item.flags?.fleshEnshrouded?.marketPurchased,
          installed: item.flags?.fleshEnshrouded?.installed
        })));
      }

      return filtered;
    };

    api.__fehaOriginalGetOwned021 = originalGetOwned;
  }

  async function repairCacheMetadata(api) {
    const actor = api?.getActor?.();
    if (!actor) return;

    const cache = findCache(actor);
    if (!cache) return;

    const repairs = [...actor.items]
      .filter(item => item.id !== cache.id && isInCache(item, cache))
      .map(item => {
        const f = item.flags?.fleshEnshrouded ?? {};
        const update = { _id: item.id };
        let dirty = false;

        // Legacy installer requires marketPurchased=true. Physical presence
        // in this actor's dedicated Cyberware Cache is sufficient proof of
        // ownership, so normalize old data once.
        if (f.marketPurchased !== true) {
          update["flags.fleshEnshrouded.marketPurchased"] = true;
          dirty = true;
        }

        if (f.installed !== false) {
          update["flags.fleshEnshrouded.installed"] = false;
          dirty = true;
        }

        if (f.isInstalled !== false) {
          update["flags.fleshEnshrouded.isInstalled"] = false;
          dirty = true;
        }

        const slot = api.slotOf?.(item);
        if (slot && f.cyberwareSlot !== slot) {
          update["flags.fleshEnshrouded.cyberwareSlot"] = slot;
          dirty = true;
        }

        return dirty ? update : null;
      })
      .filter(Boolean);

    if (!repairs.length) return;

    try {
      await actor.updateEmbeddedDocuments("Item", repairs);
      console.info("FEHA DEV 0.2.6 // repaired cached chrome metadata", repairs.length);
    } catch (err) {
      console.warn("FEHA DEV 0.2.1 // cache metadata repair failed", err);
    }
  }

  function patchBackend() {
    const api = globalThis.ADKChromeBackend;
    if (!api) return false;
    installOwnedBridge(api);
    return true;
  }


  function normalizeDossierSchematics() {
    const root = document.getElementById("adk-chrome-manager-34");
    if (!root) return;

    // These viewBoxes frame the actual authored system artwork, not the huge
    // generic 1000x800 canvas. Each keeps the full system drawing visible while
    // removing the dead margin that made the art look microscopic.
    const frames = {
      cortex:      "230 80 540 420",
      face:        "255 95 490 530",
      os:          "255 75 490 540",
      arms:        "95 145 810 485",
      hands:       "175 195 650 370",
      structure:   "125 55 750 690",
      neural:      "195 65 610 665",
      circulatory: "175 145 650 510",
      dermal:      "195 125 610 550",
      legs:        "205 145 590 565"
    };

    root
      .querySelectorAll(".dossier-visual .adk-v6-system-viz")
      .forEach(svg => {
        const modeClass = [...svg.classList].find(name => name.startsWith("mode-"));
        const mode = modeClass?.slice(5) ?? "";
        const frame = frames[mode];

        if (frame) {
          svg.setAttribute("viewBox", frame);
        }

        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      });
  }

  function markRoot() {
    const root = document.getElementById("adk-chrome-manager-34");
    if (!root) return false;
    root.classList.add("adk-live-dev");
    root.dataset.fehaDevBuild = BUILD;
    patchBackend();
    normalizeDossierSchematics();
    return true;
  }

  function installCacheSelectionUX() {
    if (globalThis.__FEHA_CACHE_SELECTION_UX_025) return;

    const handler = event => {
      const root = event.target?.closest?.("#adk-chrome-manager-34");
      if (!root) return;

      const cacheItem = event.target.closest?.("[data-cache-item]");
      if (cacheItem) {
        // Let the native handler set selectedItemId and rerender the hardware
        // dossier, then retract the cache visually so the result is obvious.
        setTimeout(() => {
          document
            .getElementById("adk-chrome-manager-34")
            ?.classList.add("feha-cache-selection-focus");
        }, 0);
        return;
      }

      const openCache = event.target.closest?.("[data-open-cache]");
      if (openCache) {
        root.classList.remove("feha-cache-selection-focus");
        return;
      }

      const closeCache = event.target.closest?.("[data-close-cache]");
      if (closeCache) {
        root.classList.remove("feha-cache-selection-focus");
      }
    };

    document.addEventListener("click", handler, true);
    globalThis.__FEHA_CACHE_SELECTION_UX_025 = { handler };
  }

  function removeCacheSelectionUX() {
    const ux = globalThis.__FEHA_CACHE_SELECTION_UX_025;
    if (!ux) return;
    document.removeEventListener("click", ux.handler, true);
    delete globalThis.__FEHA_CACHE_SELECTION_UX_025;
  }

  function installSoundEngine() {
    if (globalThis.__FEHA_SOUND_ENGINE_032) return;

    const OriginalPlay = HTMLMediaElement.prototype.play;
    let ctx = null;
    let masterBus = null;

    const STATE = {
      volume: 0.76,
      style: localStorage.getItem("fehaSoundStyle") || "A"
    };

    const PER_EVENT = {
      hover: 0.30,
      select: 0.72,
      drawer: 0.80,
      scan: 0.74,
      install: 0.98,
      remove: 0.88,
      error: 0.86,
      confirm: 0.78
    };

    function audioCtx() {
      if (!ctx || ctx.state === "closed") {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterBus = null;
      }

      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      if (!masterBus) {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 7;
        comp.ratio.value = 9;
        comp.attack.value = 0.002;
        comp.release.value = 0.18;

        const master = ctx.createGain();
        master.gain.value = STATE.volume;

        comp.connect(master);
        master.connect(ctx.destination);
        masterBus = { comp, master };
      }

      masterBus.master.gain.value = STATE.volume;
      return ctx;
    }

    function distortion(amount = 45) {
      const c = audioCtx();
      const shaper = c.createWaveShaper();
      const n = 4096;
      const curve = new Float32Array(n);
      const k = Math.max(1, amount);

      for (let i = 0; i < n; i++) {
        const x = i * 2 / n - 1;
        curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
      }

      shaper.curve = curve;
      shaper.oversample = "4x";
      return shaper;
    }

    function dest(kind, drive = 0) {
      const c = audioCtx();
      const g = c.createGain();
      g.gain.value = PER_EVENT[kind] ?? 0.65;

      if (drive > 0) {
        const d = distortion(drive);
        g.connect(d);
        d.connect(masterBus.comp);
      } else {
        g.connect(masterBus.comp);
      }

      return g;
    }

    function tone(kind, {
      type = "sine",
      freq = 120,
      endFreq = null,
      delay = 0,
      dur = 0.10,
      gain = 0.12,
      pan = 0,
      drive = 0,
      lowpass = null,
      highpass = null
    } = {}) {
      const c = audioCtx();
      const startAt = c.currentTime + delay;
      const endAt = startAt + dur;

      const o = c.createOscillator();
      const a = c.createGain();
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      let node = o;

      o.type = type;
      o.frequency.setValueAtTime(Math.max(20, freq), startAt);
      if (endFreq != null) {
        o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), endAt);
      }

      if (highpass) {
        const hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = highpass;
        node.connect(hp);
        node = hp;
      }

      if (lowpass) {
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = lowpass;
        node.connect(lp);
        node = lp;
      }

      a.gain.setValueAtTime(0.0001, startAt);
      a.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), startAt + 0.003);
      a.gain.exponentialRampToValueAtTime(0.0001, endAt);

      node.connect(a);

      if (p) {
        p.pan.value = Math.max(-1, Math.min(1, pan));
        a.connect(p);
        p.connect(dest(kind, drive));
      } else {
        a.connect(dest(kind, drive));
      }

      o.start(startAt);
      o.stop(endAt + 0.03);
    }

    function noise(kind, {
      delay = 0,
      dur = 0.08,
      gain = 0.10,
      low = 100,
      high = 6000,
      pan = 0,
      drive = 0,
      crush = 5
    } = {}) {
      const c = audioCtx();
      const startAt = c.currentTime + delay;
      const length = Math.max(1, Math.floor(c.sampleRate * dur));
      const buffer = c.createBuffer(1, length, c.sampleRate);
      const data = buffer.getChannelData(0);

      let hold = 0;
      const step = Math.max(1, Math.round(crush));

      for (let i = 0; i < length; i++) {
        if (i % step === 0) hold = Math.random() * 2 - 1;
        const env = Math.pow(1 - i / length, 1.25);
        data[i] = hold * env;
      }

      const src = c.createBufferSource();
      const hp = c.createBiquadFilter();
      const lp = c.createBiquadFilter();
      const a = c.createGain();
      const p = c.createStereoPanner ? c.createStereoPanner() : null;

      hp.type = "highpass";
      hp.frequency.value = low;
      lp.type = "lowpass";
      lp.frequency.value = high;

      a.gain.setValueAtTime(Math.max(0.0001, gain), startAt);
      a.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);

      src.buffer = buffer;
      src.connect(hp);
      hp.connect(lp);
      lp.connect(a);

      if (p) {
        p.pan.value = Math.max(-1, Math.min(1, pan));
        a.connect(p);
        p.connect(dest(kind, drive));
      } else {
        a.connect(dest(kind, drive));
      }

      src.start(startAt);
      src.stop(startAt + dur + 0.03);
    }

    function metal(kind, {
      delay = 0,
      base = 620,
      dur = 0.11,
      gain = 0.06,
      drive = 55,
      pan = 0
    } = {}) {
      [1, 1.43, 2.07, 2.81].forEach((ratio, i) => {
        tone(kind, {
          type: i % 2 ? "square" : "triangle",
          freq: base * ratio,
          endFreq: base * ratio * 0.71,
          delay: delay + i * 0.002,
          dur: dur * (1 - i * 0.10),
          gain: gain * (1 - i * 0.15),
          drive,
          highpass: 180,
          pan: pan + (i - 1.5) * 0.03
        });
      });
    }

    function sub(kind, {
      delay = 0,
      freq = 74,
      endFreq = 31,
      dur = 0.17,
      gain = 0.25,
      drive = 36
    } = {}) {
      tone(kind, {
        type: "sine",
        freq,
        endFreq,
        delay,
        dur,
        gain,
        drive,
        lowpass: 180
      });
    }

    function servo(kind, {
      delay = 0,
      from = 150,
      to = 55,
      dur = 0.20,
      gain = 0.11,
      drive = 72
    } = {}) {
      tone(kind, {
        type: "sawtooth",
        freq: from,
        endFreq: to,
        delay,
        dur,
        gain,
        drive,
        lowpass: 900
      });
      noise(kind, {
        delay,
        dur,
        gain: gain * 0.7,
        low: 180,
        high: 2400,
        drive,
        crush: 11
      });
    }

    function dataRip(kind, {
      delay = 0,
      dur = 0.09,
      gain = 0.085,
      drive = 92,
      pan = 0
    } = {}) {
      noise(kind, {
        delay,
        dur,
        gain,
        low: 850,
        high: 7800,
        drive,
        crush: 13,
        pan
      });
      tone(kind, {
        type: "square",
        freq: 880,
        endFreq: 190,
        delay,
        dur: dur * 0.72,
        gain: gain * 0.42,
        drive: drive + 10,
        pan: -pan
      });
    }

    function relay(kind, { delay = 0, gain = 0.10, drive = 66 } = {}) {
      metal(kind, { delay, base: 1050, dur: 0.035, gain, drive });
      noise(kind, { delay, dur: 0.022, gain: gain * 0.8, low: 1400, high: 9200, drive: drive + 12, crush: 3 });
    }

    function playVariant(kind = "select", style = STATE.style) {
      try {
        audioCtx();

        const A = style === "A"; // MEAT//MACHINE
        const B = style === "B"; // DATA//VIOLENCE
        const C = style === "C"; // SURGICAL//BRUTAL

        switch (kind) {
          case "hover":
            if (A) {
              relay(kind, { gain: 0.035, drive: 52 });
            } else if (B) {
              dataRip(kind, { dur: 0.025, gain: 0.038, drive: 90 });
            } else {
              metal(kind, { base: 1450, dur: 0.025, gain: 0.028, drive: 45 });
            }
            break;

          case "select":
            if (A) {
              sub(kind, { freq: 88, endFreq: 44, dur: 0.10, gain: 0.16 });
              relay(kind, { delay: 0.006, gain: 0.075, drive: 70 });
              dataRip(kind, { delay: 0.025, dur: 0.045, gain: 0.055, drive: 82 });
            } else if (B) {
              dataRip(kind, { dur: 0.07, gain: 0.11, drive: 110 });
              tone(kind, { type: "square", freq: 420, endFreq: 110, delay: 0.018, dur: 0.07, gain: 0.08, drive: 96 });
            } else {
              relay(kind, { gain: 0.095, drive: 58 });
              sub(kind, { delay: 0.004, freq: 104, endFreq: 58, dur: 0.075, gain: 0.12 });
            }
            break;

          case "drawer":
            if (A) {
              sub(kind, { freq: 65, endFreq: 29, dur: 0.23, gain: 0.20 });
              servo(kind, { from: 122, to: 43, dur: 0.26, gain: 0.13, drive: 78 });
              metal(kind, { delay: 0.20, base: 510, dur: 0.08, gain: 0.055, drive: 64 });
            } else if (B) {
              dataRip(kind, { dur: 0.19, gain: 0.10, drive: 105, pan: -0.15 });
              dataRip(kind, { delay: 0.10, dur: 0.12, gain: 0.08, drive: 112, pan: 0.15 });
              relay(kind, { delay: 0.19, gain: 0.075, drive: 82 });
            } else {
              servo(kind, { from: 210, to: 82, dur: 0.18, gain: 0.10, drive: 54 });
              relay(kind, { delay: 0.15, gain: 0.10, drive: 48 });
            }
            break;

          case "scan":
            if (A) {
              noise(kind, { dur: 0.18, gain: 0.075, low: 350, high: 4800, drive: 72, crush: 9 });
              tone(kind, { type: "square", freq: 210, endFreq: 760, dur: 0.19, gain: 0.07, drive: 75 });
              sub(kind, { delay: 0.17, freq: 58, endFreq: 35, dur: 0.07, gain: 0.09 });
            } else if (B) {
              dataRip(kind, { dur: 0.08, gain: 0.10, drive: 120, pan: -0.25 });
              dataRip(kind, { delay: 0.07, dur: 0.08, gain: 0.10, drive: 120 });
              dataRip(kind, { delay: 0.14, dur: 0.09, gain: 0.11, drive: 120, pan: 0.25 });
            } else {
              tone(kind, { type: "square", freq: 390, endFreq: 1180, dur: 0.15, gain: 0.07, drive: 52 });
              relay(kind, { delay: 0.14, gain: 0.06, drive: 48 });
            }
            break;

          case "install":
            if (A) {
              sub(kind, { freq: 57, endFreq: 24, dur: 0.30, gain: 0.34, drive: 48 });
              metal(kind, { delay: 0.006, base: 420, dur: 0.12, gain: 0.085, drive: 86 });
              servo(kind, { delay: 0.05, from: 138, to: 46, dur: 0.27, gain: 0.15, drive: 92 });
              dataRip(kind, { delay: 0.18, dur: 0.10, gain: 0.09, drive: 112 });
              relay(kind, { delay: 0.30, gain: 0.11, drive: 72 });
            } else if (B) {
              sub(kind, { freq: 71, endFreq: 30, dur: 0.18, gain: 0.24, drive: 72 });
              dataRip(kind, { delay: 0.00, dur: 0.13, gain: 0.14, drive: 130, pan: -0.18 });
              dataRip(kind, { delay: 0.08, dur: 0.14, gain: 0.13, drive: 130, pan: 0.18 });
              tone(kind, { type: "square", freq: 188, endFreq: 61, delay: 0.17, dur: 0.16, gain: 0.11, drive: 118 });
              metal(kind, { delay: 0.29, base: 830, dur: 0.07, gain: 0.07, drive: 98 });
            } else {
              relay(kind, { gain: 0.12, drive: 58 });
              metal(kind, { delay: 0.035, base: 570, dur: 0.10, gain: 0.08, drive: 58 });
              sub(kind, { delay: 0.02, freq: 92, endFreq: 39, dur: 0.16, gain: 0.20, drive: 42 });
              servo(kind, { delay: 0.10, from: 175, to: 72, dur: 0.14, gain: 0.085, drive: 50 });
              relay(kind, { delay: 0.245, gain: 0.095, drive: 54 });
            }
            break;

          case "remove":
            if (A) {
              metal(kind, { base: 390, dur: 0.08, gain: 0.08, drive: 88 });
              servo(kind, { delay: 0.025, from: 250, to: 52, dur: 0.23, gain: 0.14, drive: 90 });
              noise(kind, { delay: 0.04, dur: 0.20, gain: 0.13, low: 90, high: 2300, drive: 84, crush: 10 });
              sub(kind, { delay: 0.17, freq: 74, endFreq: 31, dur: 0.12, gain: 0.19 });
            } else if (B) {
              dataRip(kind, { dur: 0.17, gain: 0.14, drive: 125 });
              tone(kind, { type: "square", freq: 650, endFreq: 75, delay: 0.02, dur: 0.18, gain: 0.11, drive: 110 });
              sub(kind, { delay: 0.14, freq: 61, endFreq: 28, dur: 0.10, gain: 0.16 });
            } else {
              relay(kind, { gain: 0.10, drive: 62 });
              servo(kind, { delay: 0.02, from: 220, to: 68, dur: 0.16, gain: 0.09, drive: 58 });
              metal(kind, { delay: 0.145, base: 470, dur: 0.07, gain: 0.07, drive: 62 });
            }
            break;

          case "error":
            if (A) {
              sub(kind, { freq: 69, endFreq: 31, dur: 0.16, gain: 0.20, drive: 68 });
              dataRip(kind, { dur: 0.14, gain: 0.12, drive: 125 });
              tone(kind, { type: "square", freq: 171, endFreq: 91, dur: 0.16, gain: 0.09, drive: 120 });
            } else if (B) {
              dataRip(kind, { dur: 0.20, gain: 0.16, drive: 145 });
              tone(kind, { type: "square", freq: 255, endFreq: 74, dur: 0.20, gain: 0.12, drive: 130 });
            } else {
              relay(kind, { gain: 0.10, drive: 78 });
              tone(kind, { type: "square", freq: 205, endFreq: 145, delay: 0.025, dur: 0.12, gain: 0.08, drive: 86 });
            }
            break;

          case "confirm":
            if (A) {
              sub(kind, { freq: 96, endFreq: 53, dur: 0.08, gain: 0.13 });
              relay(kind, { delay: 0.012, gain: 0.075, drive: 58 });
              tone(kind, { type: "square", freq: 420, endFreq: 710, delay: 0.055, dur: 0.06, gain: 0.05, drive: 62 });
            } else if (B) {
              dataRip(kind, { dur: 0.055, gain: 0.08, drive: 105 });
              tone(kind, { type: "square", freq: 540, endFreq: 980, delay: 0.045, dur: 0.07, gain: 0.065, drive: 86 });
            } else {
              relay(kind, { gain: 0.09, drive: 48 });
              tone(kind, { type: "triangle", freq: 510, endFreq: 760, delay: 0.045, dur: 0.06, gain: 0.05, drive: 40 });
            }
            break;
        }
      } catch (err) {
        console.warn("FEHA DEV 0.3.2 // sound variant failed", err);
      }
    }

    function play(kind = "select") {
      return playVariant(kind, STATE.style);
    }

    async function openLab() {
      const labels = {
        A: "A // MEAT + MACHINE",
        B: "B // DATA VIOLENCE",
        C: "C // SURGICAL BRUTAL"
      };

      const rows = [
        ["select", "SELECT"],
        ["drawer", "DRAWER"],
        ["scan", "SCAN"],
        ["install", "INSTALL"],
        ["remove", "REMOVE"],
        ["error", "ERROR"],
        ["confirm", "CONFIRM"]
      ];

      const rowHtml = rows.map(([kind, title]) => `
        <div style="display:grid;grid-template-columns:110px repeat(3,1fr);gap:6px;align-items:center;margin:6px 0">
          <b style="font-family:monospace;letter-spacing:1px">${title}</b>
          <button data-feha-audition="${kind}|A">A</button>
          <button data-feha-audition="${kind}|B">B</button>
          <button data-feha-audition="${kind}|C">C</button>
        </div>
      `).join("");

      const dlg = new Dialog({
        title: "FEHA // SOUND LAB",
        content: `
          <div style="padding:10px;min-width:520px">
            <p style="opacity:.8">Pick the MATERIAL LANGUAGE first. These are deliberately different, not tiny EQ tweaks.</p>
            <div style="display:grid;grid-template-columns:110px repeat(3,1fr);gap:6px;margin:10px 0 8px">
              <span></span>
              <b>A // MEAT<br>+ MACHINE</b>
              <b>B // DATA<br>VIOLENCE</b>
              <b>C // SURGICAL<br>BRUTAL</b>
            </div>
            ${rowHtml}
            <hr>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px">
              <button data-feha-use-style="A">USE A</button>
              <button data-feha-use-style="B">USE B</button>
              <button data-feha-use-style="C">USE C</button>
            </div>
            <p style="margin-top:10px;font-size:12px;opacity:.65">Current: <b id="feha-current-sound-style">${labels[STATE.style]}</b></p>
          </div>
        `,
        buttons: {
          close: {
            label: "CLOSE"
          }
        },
        render: html => {
          html[0].querySelectorAll("[data-feha-audition]").forEach(btn => {
            btn.addEventListener("click", () => {
              const [kind, style] = btn.dataset.fehaAudition.split("|");
              playVariant(kind, style);
            });
          });

          html[0].querySelectorAll("[data-feha-use-style]").forEach(btn => {
            btn.addEventListener("click", () => {
              STATE.style = btn.dataset.fehaUseStyle;
              localStorage.setItem("fehaSoundStyle", STATE.style);
              const label = html[0].querySelector("#feha-current-sound-style");
              if (label) label.textContent = labels[STATE.style];
              playVariant("confirm", STATE.style);
              ui?.notifications?.info?.("FEHA SOUND STYLE // " + labels[STATE.style]);
            });
          });
        }
      });

      dlg.render(true);
    }

    HTMLMediaElement.prototype.play = function(...args) {
      try {
        const src = String(
          this.currentSrc ||
          this.src ||
          this.getAttribute?.("src") ||
          ""
        );

        const match = src.match(
          /\/assets\/audio\/chrome\/(hover|select|drawer|scan|install|remove|error|confirm)\.wav(?:[?#].*)?$/i
        );

        if (match) {
          play(match[1].toLowerCase());
          return Promise.resolve();
        }
      } catch (err) {
        console.warn("FEHA DEV 0.3.2 // sound routing failed", err);
      }

      return OriginalPlay.apply(this, args);
    };

    globalThis.FEHA_SOUNDS = {
      play,
      playVariant,
      openLab,
      state: STATE,
      setStyle(style) {
        if (!["A", "B", "C"].includes(style)) return STATE.style;
        STATE.style = style;
        localStorage.setItem("fehaSoundStyle", style);
        return STATE.style;
      },
      setVolume(value) {
        STATE.volume = Math.max(0, Math.min(1, Number(value) || 0));
        if (masterBus?.master) masterBus.master.gain.value = STATE.volume;
        return STATE.volume;
      }
    };

    globalThis.__FEHA_SOUND_ENGINE_032 = {
      originalPlay: OriginalPlay,
      get context() { return ctx; }
    };

    console.info(
      "FEHA DEV 0.3.2 // Sound Lab armed. Run FEHA_SOUNDS.openLab()"
    );
  }

  function removeSoundEngine() {
    const engine =
      globalThis.__FEHA_SOUND_ENGINE_032 ??
      globalThis.__FEHA_SOUND_ENGINE_029 ??
      globalThis.__FEHA_SOUND_ENGINE_028;

    if (!engine) return;

    if (HTMLMediaElement.prototype.play !== engine.originalPlay) {
      HTMLMediaElement.prototype.play = engine.originalPlay;
    }

    try {
      engine.context?.close?.();
    } catch {}

    delete globalThis.FEHA_SOUNDS;
    delete globalThis.__FEHA_SOUND_ENGINE_032;
    delete globalThis.__FEHA_SOUND_ENGINE_029;
    delete globalThis.__FEHA_SOUND_ENGINE_028;
  }

  function installActorSwitchFix() {
    if (globalThis.__FEHA_ACTOR_SWITCH_FIX_026) return;

    let switching = false;

    const handler = async event => {
      const select = event.target?.closest?.("#adk-chrome-manager-34 #actor-select");
      if (!select) return;

      // Own the subject-switch transaction so the native delayed handler and
      // the theme service cannot race one another.
      event.stopImmediatePropagation();

      const actorId = String(select.value ?? "");
      const api = globalThis.ADKChromeBackend;
      const root = document.getElementById("adk-chrome-manager-34");

      if (!actorId || !api || switching) return;
      if (api.getActor?.()?.id === actorId) {
        globalThis.ADKTheme?.refresh?.();
        return;
      }

      switching = true;
      root?.classList.add("is-subject-switching");

      try {
        const desired = game.actors.get(actorId);
        if (!desired) throw new Error("Actor not found: " + actorId);

        // setActor updates the private legacy backend state. Its internal render
        // is allowed to fail without leaving us stuck; we force the native pass
        // immediately afterward from the now-correct backend state.
        try {
          api.setActor(actorId);
        } catch (renderErr) {
          console.warn(
            "FEHA DEV 0.2.6 // backend switched actor but its inline render failed; forcing native render",
            renderErr
          );
        }

        if (api.getActor?.()?.id !== actorId) {
          throw new Error(
            "Backend actor mismatch after switch. Expected " +
            actorId +
            ", got " +
            (api.getActor?.()?.id ?? "null")
          );
        }

        await repairCacheMetadata(api);

        // Clear any cache/item selection state visually before the new subject
        // frame resolves.
        document
          .getElementById("adk-chrome-manager-34")
          ?.classList.remove("feha-cache-selection-focus");

        globalThis.ADKChromeNative?.render?.();

        requestAnimationFrame(() => {
          const liveRoot = document.getElementById("adk-chrome-manager-34");
          const liveSelect = liveRoot?.querySelector("#actor-select");
          if (liveSelect && liveSelect.value !== actorId) liveSelect.value = actorId;

          globalThis.ADKTheme?.refresh?.();

          setTimeout(() => {
            globalThis.ADKChromeNative?.render?.();
            globalThis.ADKTheme?.refresh?.();
            document
              .getElementById("adk-chrome-manager-34")
              ?.classList.remove("is-subject-switching");
          }, 80);
        });

        console.info(
          "FEHA DEV 0.2.6 // subject switch complete:",
          desired.name,
          actorId
        );
      } catch (err) {
        console.error("FEHA DEV 0.2.6 // actor switch failed", err);
        ui?.notifications?.error?.(
          "FEHA subject switch failed — press F12 and send the red FEHA error."
        );

        // Put the selector back on the backend's actual actor so the UI can no
        // longer show Florence while the backend still thinks Ponyboy.
        const actualId = api?.getActor?.()?.id;
        const liveSelect = document
          .getElementById("adk-chrome-manager-34")
          ?.querySelector("#actor-select");
        if (liveSelect && actualId) liveSelect.value = actualId;

        try {
          globalThis.ADKChromeNative?.render?.();
          globalThis.ADKTheme?.refresh?.();
        } catch (fallbackErr) {
          console.error("FEHA DEV 0.2.6 // actor switch fallback render failed", fallbackErr);
        }
      } finally {
        switching = false;
        setTimeout(() => {
          document
            .getElementById("adk-chrome-manager-34")
            ?.classList.remove("is-subject-switching");
        }, 260);
      }
    };

    document.addEventListener("change", handler, true);
    globalThis.__FEHA_ACTOR_SWITCH_FIX_026 = { handler };
  }

  function removeActorSwitchFix() {
    const fix = globalThis.__FEHA_ACTOR_SWITCH_FIX_026;
    if (!fix) return;
    document.removeEventListener("change", fix.handler, true);
    delete globalThis.__FEHA_ACTOR_SWITCH_FIX_026;
  }

  function startObserver() {
    observer?.disconnect?.();
    observer = new MutationObserver(() => {
      patchBackend();
      markRoot();
      normalizeDossierSchematics();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const state = {
    build: BUILD,
    cleanup() {
      observer?.disconnect?.();
      observer = null;
      const root = document.getElementById("adk-chrome-manager-34");
      root?.classList?.remove("adk-live-dev");
      if (root?.dataset) delete root.dataset.fehaDevBuild;

      const api = globalThis.ADKChromeBackend;
      if (api?.__fehaOriginalGetOwned021) {
        api.getOwned = api.__fehaOriginalGetOwned021;
        delete api.__fehaOriginalGetOwned021;
        delete api.__fehaOwnedBridge021;
      }

      removeCacheSelectionUX();
      removeActorSwitchFix();
      removeSoundEngine();
      document
        .getElementById("adk-chrome-manager-34")
        ?.classList.remove("feha-cache-selection-focus");
      delete globalThis.ADKDevPatch;
    },
    reopenChrome() {
      try {
        document.getElementById("adk-chrome-manager-34")?.remove();
        if (globalThis.game?.adk?.openChrome) {
          setTimeout(async () => {
            game.adk.openChrome();
            setTimeout(async () => {
              patchBackend();
              await repairCacheMetadata(globalThis.ADKChromeBackend);
              globalThis.ADKChromeBackend?.refresh?.();
              setTimeout(markRoot, 80);
            }, 180);
          }, 80);
        }
      } catch (err) {
        console.error("FEHA dev reopen failed", err);
      }
    }
  };

  globalThis.ADKDevPatch = state;
  globalThis.FEHA_DEV_DIAGNOSTICS = globalThis.FEHA_DEV_DIAGNOSTICS ?? false;

  installSoundEngine();
  installCacheSelectionUX();
  installActorSwitchFix();
  startObserver();
  patchBackend();
  markRoot();

  console.log(
    "%cFEHA DEV PATCH %c" + BUILD,
    "color:#70f7e7;font-weight:900",
    "color:#fff"
  );

  ui?.notifications?.info?.(
    "FEHA DEV " + BUILD + " // sound lab loaded"
  );

  state.reopenChrome();
})();