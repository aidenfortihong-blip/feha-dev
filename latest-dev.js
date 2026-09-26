(() => {
  const BUILD = "0.3.0";
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

    root.querySelectorAll(".dossier-visual .adk-v6-system-viz").forEach(svg => {
      // The production SVGs ship as xMidYMid slice, which deliberately crops
      // their top/bottom edges. For the inspector we want the entire schematic.
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
    if (globalThis.__FEHA_SOUND_ENGINE_029) return;

    const OriginalPlay = HTMLMediaElement.prototype.play;
    let ctx = null;
    let masterBus = null;

    const MASTER = {
      volume: 0.74,
      hover: 0.30,
      select: 0.70,
      drawer: 0.78,
      scan: 0.70,
      install: 0.92,
      remove: 0.82,
      error: 0.82,
      confirm: 0.76
    };

    function audioCtx() {
      if (!ctx || ctx.state === "closed") {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterBus = null;
      }

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      if (!masterBus) {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.knee.value = 10;
        comp.ratio.value = 7;
        comp.attack.value = 0.003;
        comp.release.value = 0.16;

        const master = ctx.createGain();
        master.gain.value = MASTER.volume;

        comp.connect(master);
        master.connect(ctx.destination);

        masterBus = { comp, master };
      }

      masterBus.master.gain.value = MASTER.volume;
      return ctx;
    }

    function makeDistortion(amount = 35) {
      const c = audioCtx();
      const shaper = c.createWaveShaper();
      const n = 2048;
      const curve = new Float32Array(n);
      const k = Math.max(1, amount);

      for (let i = 0; i < n; i++) {
        const x = i * 2 / n - 1;
        curve[i] = ((3 + k) * x * 20 * Math.PI / 180) /
          (Math.PI + k * Math.abs(x));
      }

      shaper.curve = curve;
      shaper.oversample = "4x";
      return shaper;
    }

    function destination(kind, drive = 0) {
      const c = audioCtx();
      const g = c.createGain();
      g.gain.value = Math.max(
        0,
        Math.min(1.2, MASTER[kind] ?? 0.6)
      );

      if (drive > 0) {
        const d = makeDistortion(drive);
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
      gain = 0.16,
      attack = 0.003,
      pan = 0,
      drive = 0,
      lowpass = null,
      highpass = null
    } = {}) {
      const c = audioCtx();
      const start = c.currentTime + delay;
      const endAt = start + dur;

      const o = c.createOscillator();
      const amp = c.createGain();
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      const lp = lowpass ? c.createBiquadFilter() : null;
      const hp = highpass ? c.createBiquadFilter() : null;

      o.type = type;
      o.frequency.setValueAtTime(Math.max(20, freq), start);

      if (endFreq != null) {
        o.frequency.exponentialRampToValueAtTime(
          Math.max(20, endFreq),
          endAt
        );
      }

      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, gain),
        start + attack
      );
      amp.gain.exponentialRampToValueAtTime(0.0001, endAt);

      let node = o;

      if (hp) {
        hp.type = "highpass";
        hp.frequency.value = highpass;
        node.connect(hp);
        node = hp;
      }

      if (lp) {
        lp.type = "lowpass";
        lp.frequency.value = lowpass;
        node.connect(lp);
        node = lp;
      }

      node.connect(amp);

      if (p) {
        p.pan.value = Math.max(-1, Math.min(1, pan));
        amp.connect(p);
        p.connect(destination(kind, drive));
      } else {
        amp.connect(destination(kind, drive));
      }

      o.start(start);
      o.stop(endAt + 0.03);
    }

    function noise(kind, {
      delay = 0,
      dur = 0.08,
      gain = 0.10,
      low = 120,
      high = 5000,
      pan = 0,
      drive = 0
    } = {}) {
      const c = audioCtx();
      const start = c.currentTime + delay;
      const length = Math.max(1, Math.floor(c.sampleRate * dur));
      const buffer = c.createBuffer(1, length, c.sampleRate);
      const data = buffer.getChannelData(0);

      let hold = 0;
      for (let i = 0; i < length; i++) {
        // Slight sample-and-hold roughness: less "hiss", more digital tearing.
        if (i % 7 === 0) hold = Math.random() * 2 - 1;
        const env = Math.pow(1 - i / length, 1.5);
        data[i] = hold * env;
      }

      const src = c.createBufferSource();
      const hp = c.createBiquadFilter();
      const lp = c.createBiquadFilter();
      const amp = c.createGain();
      const p = c.createStereoPanner ? c.createStereoPanner() : null;

      src.buffer = buffer;

      hp.type = "highpass";
      hp.frequency.value = low;

      lp.type = "lowpass";
      lp.frequency.value = high;

      amp.gain.setValueAtTime(Math.max(0.0001, gain), start);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      src.connect(hp);
      hp.connect(lp);
      lp.connect(amp);

      if (p) {
        p.pan.value = Math.max(-1, Math.min(1, pan));
        amp.connect(p);
        p.connect(destination(kind, drive));
      } else {
        amp.connect(destination(kind, drive));
      }

      src.start(start);
      src.stop(start + dur + 0.03);
    }

    function impact(kind, {
      delay = 0,
      freq = 72,
      endFreq = 34,
      dur = 0.16,
      gain = 0.22,
      drive = 55
    } = {}) {
      tone(kind, {
        type: "sine",
        freq,
        endFreq,
        delay,
        dur,
        gain,
        drive,
        lowpass: 220
      });

      tone(kind, {
        type: "square",
        freq: freq * 1.9,
        endFreq: endFreq * 1.4,
        delay,
        dur: dur * 0.62,
        gain: gain * 0.20,
        drive: drive + 18,
        lowpass: 520
      });

      noise(kind, {
        delay,
        dur: Math.min(0.065, dur * 0.45),
        gain: gain * 0.33,
        low: 90,
        high: 1500,
        drive: drive + 12
      });
    }

    function play(kind = "select") {
      try {
        audioCtx();

        switch (kind) {
          case "hover":
            // Tiny electrical tooth-click, not a friendly UI chirp.
            noise(kind, {
              dur: 0.018,
              gain: 0.052,
              low: 1800,
              high: 7200,
              drive: 75
            });
            tone(kind, {
              type: "square",
              freq: 1120,
              endFreq: 760,
              dur: 0.026,
              gain: 0.032,
              drive: 52,
              highpass: 500
            });
            break;

          case "select":
            // Hard relay thunk + short corrupted lock tone.
            impact(kind, {
              freq: 86,
              endFreq: 42,
              dur: 0.105,
              gain: 0.19,
              drive: 62
            });
            noise(kind, {
              delay: 0.018,
              dur: 0.042,
              gain: 0.085,
              low: 700,
              high: 4200,
              pan: 0.10,
              drive: 88
            });
            tone(kind, {
              type: "square",
              freq: 510,
              endFreq: 295,
              delay: 0.038,
              dur: 0.055,
              gain: 0.055,
              pan: -0.08,
              drive: 74
            });
            break;

          case "drawer":
            // Low motor strain, scraping servo, physical latch.
            tone(kind, {
              type: "sawtooth",
              freq: 74,
              endFreq: 43,
              dur: 0.22,
              gain: 0.13,
              drive: 72,
              lowpass: 480
            });
            noise(kind, {
              delay: 0.018,
              dur: 0.19,
              gain: 0.12,
              low: 150,
              high: 2600,
              drive: 68
            });
            impact(kind, {
              delay: 0.155,
              freq: 96,
              endFreq: 45,
              dur: 0.11,
              gain: 0.15,
              drive: 58
            });
            break;

          case "scan":
            // Data scrape + stepping digital interrogation, less "pretty scanner".
            noise(kind, {
              dur: 0.20,
              gain: 0.078,
              low: 600,
              high: 6800,
              drive: 76
            });
            tone(kind, {
              type: "square",
              freq: 168,
              endFreq: 285,
              dur: 0.07,
              gain: 0.065,
              pan: -0.24,
              drive: 65
            });
            tone(kind, {
              type: "square",
              freq: 312,
              endFreq: 520,
              delay: 0.07,
              dur: 0.07,
              gain: 0.07,
              drive: 72
            });
            tone(kind, {
              type: "square",
              freq: 590,
              endFreq: 980,
              delay: 0.14,
              dur: 0.075,
              gain: 0.075,
              pan: 0.24,
              drive: 78
            });
            impact(kind, {
              delay: 0.185,
              freq: 58,
              endFreq: 34,
              dur: 0.09,
              gain: 0.10,
              drive: 55
            });
            break;

          case "install":
            // Visceral cyberware event: impact -> machinery -> dirty handshake -> seal.
            impact(kind, {
              freq: 62,
              endFreq: 29,
              dur: 0.22,
              gain: 0.30,
              drive: 82
            });
            noise(kind, {
              delay: 0.025,
              dur: 0.18,
              gain: 0.15,
              low: 120,
              high: 3200,
              drive: 92
            });
            tone(kind, {
              type: "sawtooth",
              freq: 118,
              endFreq: 74,
              delay: 0.055,
              dur: 0.19,
              gain: 0.12,
              drive: 88,
              lowpass: 650
            });
            tone(kind, {
              type: "square",
              freq: 330,
              endFreq: 176,
              delay: 0.16,
              dur: 0.085,
              gain: 0.065,
              pan: -0.16,
              drive: 92
            });
            tone(kind, {
              type: "square",
              freq: 620,
              endFreq: 410,
              delay: 0.205,
              dur: 0.075,
              gain: 0.065,
              pan: 0.16,
              drive: 88
            });
            impact(kind, {
              delay: 0.255,
              freq: 104,
              endFreq: 48,
              dur: 0.12,
              gain: 0.18,
              drive: 70
            });
            break;

          case "remove":
            // Mechanical tear-away, decompression, dead relay snap.
            impact(kind, {
              freq: 72,
              endFreq: 38,
              dur: 0.13,
              gain: 0.20,
              drive: 74
            });
            noise(kind, {
              delay: 0.028,
              dur: 0.19,
              gain: 0.15,
              low: 110,
              high: 2900,
              drive: 90
            });
            tone(kind, {
              type: "sawtooth",
              freq: 240,
              endFreq: 58,
              delay: 0.035,
              dur: 0.19,
              gain: 0.11,
              drive: 80,
              lowpass: 720
            });
            tone(kind, {
              type: "square",
              freq: 510,
              endFreq: 105,
              delay: 0.17,
              dur: 0.065,
              gain: 0.055,
              drive: 85
            });
            break;

          case "error":
            // Malfunction buzz + low body hit.
            impact(kind, {
              freq: 68,
              endFreq: 33,
              dur: 0.14,
              gain: 0.18,
              drive: 82
            });
            noise(kind, {
              dur: 0.16,
              gain: 0.13,
              low: 220,
              high: 3600,
              drive: 100
            });
            tone(kind, {
              type: "square",
              freq: 178,
              endFreq: 142,
              dur: 0.095,
              gain: 0.085,
              pan: -0.12,
              drive: 100
            });
            tone(kind, {
              type: "square",
              freq: 132,
              endFreq: 98,
              delay: 0.095,
              dur: 0.105,
              gain: 0.09,
              pan: 0.12,
              drive: 100
            });
            break;

          case "confirm":
            // Positive, but still physical: relay punch + dirty authorization chirp.
            impact(kind, {
              freq: 92,
              endFreq: 48,
              dur: 0.095,
              gain: 0.16,
              drive: 58
            });
            tone(kind, {
              type: "square",
              freq: 450,
              endFreq: 640,
              delay: 0.045,
              dur: 0.06,
              gain: 0.055,
              drive: 66
            });
            tone(kind, {
              type: "square",
              freq: 680,
              endFreq: 980,
              delay: 0.10,
              dur: 0.07,
              gain: 0.065,
              drive: 72
            });
            noise(kind, {
              delay: 0.095,
              dur: 0.03,
              gain: 0.05,
              low: 1900,
              high: 7200,
              drive: 82
            });
            break;

          default:
            play("select");
        }
      } catch (err) {
        console.warn("FEHA DEV 0.2.9 // visceral sound failed", err);
      }
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
        console.warn("FEHA DEV 0.2.9 // sound routing failed", err);
      }

      return OriginalPlay.apply(this, args);
    };

    globalThis.FEHA_SOUNDS = {
      play,
      profile: MASTER,

      setVolume(value) {
        MASTER.volume = Math.max(
          0,
          Math.min(1, Number(value) || 0)
        );

        if (masterBus?.master) {
          masterBus.master.gain.value = MASTER.volume;
        }

        return MASTER.volume;
      },

      demo() {
        const order = [
          "hover",
          "select",
          "drawer",
          "scan",
          "install",
          "remove",
          "error",
          "confirm"
        ];

        order.forEach(
          (kind, i) =>
            setTimeout(() => play(kind), i * 650)
        );
      },

      visceralDemo() {
        ["select", "drawer", "scan", "install", "remove", "error"]
          .forEach(
            (kind, i) =>
              setTimeout(() => play(kind), i * 760)
          );
      }
    };

    globalThis.__FEHA_SOUND_ENGINE_029 = {
      originalPlay: OriginalPlay,
      get context() { return ctx; }
    };

    console.info(
      "FEHA DEV 0.2.9 // GUTTURAL DIGITAL sound engine armed. Test FEHA_SOUNDS.visceralDemo()"
    );
  }

  function removeSoundEngine() {
    const engine =
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
    "FEHA DEV " + BUILD + " // clean schematics + port text fix loaded"
  );

  state.reopenChrome();
})();