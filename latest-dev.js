(() => {
  const BUILD = "0.2.8";
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

  function markRoot() {
    const root = document.getElementById("adk-chrome-manager-34");
    if (!root) return false;
    root.classList.add("adk-live-dev");
    root.dataset.fehaDevBuild = BUILD;
    patchBackend();
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
    if (globalThis.__FEHA_SOUND_ENGINE_028) return;

    const OriginalPlay = HTMLMediaElement.prototype.play;
    let ctx = null;

    const MASTER = {
      volume: 0.72,
      hover: 0.34,
      select: 0.62,
      drawer: 0.72,
      scan: 0.66,
      install: 0.82,
      remove: 0.72,
      error: 0.76,
      confirm: 0.68
    };

    function audioCtx() {
      if (!ctx || ctx.state === "closed") {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return ctx;
    }

    function outGain(kind) {
      const c = audioCtx();
      const g = c.createGain();
      g.gain.value = Math.max(
        0,
        Math.min(1, MASTER.volume * (MASTER[kind] ?? 0.6))
      );
      g.connect(c.destination);
      return g;
    }

    function osc(kind, {
      type = "sine",
      freq = 440,
      endFreq = null,
      delay = 0,
      dur = 0.08,
      gain = 0.12,
      attack = 0.004,
      pan = 0
    } = {}) {
      const c = audioCtx();
      const start = c.currentTime + delay;
      const end = start + dur;

      const o = c.createOscillator();
      const g = c.createGain();
      const p = c.createStereoPanner ? c.createStereoPanner() : null;

      o.type = type;
      o.frequency.setValueAtTime(Math.max(20, freq), start);
      if (endFreq != null) {
        o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), end);
      }

      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, end);

      if (p) {
        p.pan.value = Math.max(-1, Math.min(1, pan));
        o.connect(g);
        g.connect(p);
        p.connect(outGain(kind));
      } else {
        o.connect(g);
        g.connect(outGain(kind));
      }

      o.start(start);
      o.stop(end + 0.02);
    }

    function noise(kind, {
      delay = 0,
      dur = 0.06,
      gain = 0.07,
      low = 600,
      high = 6000,
      pan = 0
    } = {}) {
      const c = audioCtx();
      const start = c.currentTime + delay;
      const length = Math.max(1, Math.floor(c.sampleRate * dur));
      const buffer = c.createBuffer(1, length, c.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const env = 1 - i / length;
        data[i] = (Math.random() * 2 - 1) * env;
      }

      const src = c.createBufferSource();
      const hp = c.createBiquadFilter();
      const lp = c.createBiquadFilter();
      const g = c.createGain();
      const p = c.createStereoPanner ? c.createStereoPanner() : null;

      src.buffer = buffer;

      hp.type = "highpass";
      hp.frequency.value = low;

      lp.type = "lowpass";
      lp.frequency.value = high;

      g.gain.setValueAtTime(Math.max(0.0001, gain), start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      src.connect(hp);
      hp.connect(lp);
      lp.connect(g);

      if (p) {
        p.pan.value = Math.max(-1, Math.min(1, pan));
        g.connect(p);
        p.connect(outGain(kind));
      } else {
        g.connect(outGain(kind));
      }

      src.start(start);
      src.stop(start + dur + 0.02);
    }

    function play(kind = "select") {
      try {
        audioCtx();

        switch (kind) {
          case "hover":
            // Tiny glass/servo tick. Audible but never fatiguing.
            noise(kind, { dur: 0.022, gain: 0.045, low: 2100, high: 9000 });
            osc(kind, { type: "sine", freq: 1850, endFreq: 1320, dur: 0.032, gain: 0.045 });
            break;

          case "select":
            // Mechanical click with a clean digital lock-on.
            noise(kind, { dur: 0.026, gain: 0.075, low: 850, high: 5200, pan: -0.06 });
            osc(kind, { type: "triangle", freq: 145, endFreq: 82, dur: 0.072, gain: 0.13 });
            osc(kind, { type: "sine", freq: 920, endFreq: 1420, delay: 0.018, dur: 0.052, gain: 0.075, pan: 0.08 });
            break;

          case "drawer":
            // Servo door / hardware tray.
            osc(kind, { type: "sawtooth", freq: 112, endFreq: 58, dur: 0.15, gain: 0.095 });
            noise(kind, { delay: 0.015, dur: 0.13, gain: 0.095, low: 420, high: 3200 });
            osc(kind, { type: "triangle", freq: 430, endFreq: 265, delay: 0.085, dur: 0.075, gain: 0.055 });
            break;

          case "scan":
            // Fast biometric scanner sweep.
            noise(kind, { dur: 0.13, gain: 0.055, low: 1200, high: 7200 });
            osc(kind, { type: "sine", freq: 520, endFreq: 760, dur: 0.055, gain: 0.075, pan: -0.18 });
            osc(kind, { type: "sine", freq: 780, endFreq: 1120, delay: 0.055, dur: 0.055, gain: 0.08 });
            osc(kind, { type: "sine", freq: 1160, endFreq: 1680, delay: 0.11, dur: 0.065, gain: 0.085, pan: 0.18 });
            break;

          case "install":
            // Important event: clamp, handshake, then authorization confirmation.
            osc(kind, { type: "sine", freq: 92, endFreq: 48, dur: 0.18, gain: 0.18 });
            noise(kind, { delay: 0.015, dur: 0.075, gain: 0.11, low: 240, high: 2600 });
            osc(kind, { type: "triangle", freq: 460, endFreq: 610, delay: 0.08, dur: 0.07, gain: 0.07, pan: -0.12 });
            osc(kind, { type: "triangle", freq: 730, endFreq: 980, delay: 0.15, dur: 0.07, gain: 0.08 });
            osc(kind, { type: "sine", freq: 1180, endFreq: 1740, delay: 0.225, dur: 0.105, gain: 0.115, pan: 0.12 });
            break;

          case "remove":
            // Reverse disengage / pneumatic release.
            osc(kind, { type: "triangle", freq: 1320, endFreq: 390, dur: 0.14, gain: 0.085 });
            noise(kind, { delay: 0.025, dur: 0.12, gain: 0.105, low: 330, high: 3000 });
            osc(kind, { type: "sine", freq: 105, endFreq: 62, delay: 0.09, dur: 0.11, gain: 0.14 });
            break;

          case "error":
            // Short hostile digital rejection, not a generic Windows beep.
            noise(kind, { dur: 0.12, gain: 0.095, low: 500, high: 4100 });
            osc(kind, { type: "square", freq: 245, endFreq: 210, dur: 0.07, gain: 0.07, pan: -0.12 });
            osc(kind, { type: "square", freq: 188, endFreq: 155, delay: 0.075, dur: 0.085, gain: 0.075, pan: 0.12 });
            break;

          case "confirm":
            // Crisp positive two-stage handshake.
            osc(kind, { type: "sine", freq: 880, endFreq: 1040, dur: 0.055, gain: 0.085, pan: -0.08 });
            osc(kind, { type: "sine", freq: 1320, endFreq: 1580, delay: 0.065, dur: 0.075, gain: 0.105, pan: 0.08 });
            noise(kind, { delay: 0.058, dur: 0.022, gain: 0.035, low: 2600, high: 8500 });
            break;

          default:
            play("select");
        }
      } catch (err) {
        console.warn("FEHA DEV 0.2.8 // synth sound failed", err);
      }
    }

    HTMLMediaElement.prototype.play = function(...args) {
      try {
        const src = String(this.currentSrc || this.src || this.getAttribute?.("src") || "");
        const match = src.match(
          /\/assets\/audio\/chrome\/(hover|select|drawer|scan|install|remove|error|confirm)\.wav(?:[?#].*)?$/i
        );

        if (match) {
          play(match[1].toLowerCase());
          return Promise.resolve();
        }
      } catch (err) {
        console.warn("FEHA DEV 0.2.8 // sound routing failed", err);
      }

      return OriginalPlay.apply(this, args);
    };

    globalThis.FEHA_SOUNDS = {
      play,
      profile: MASTER,
      setVolume(value) {
        MASTER.volume = Math.max(0, Math.min(1, Number(value) || 0));
        return MASTER.volume;
      },
      demo() {
        const order = ["hover", "select", "drawer", "scan", "install", "remove", "error", "confirm"];
        order.forEach((kind, i) => setTimeout(() => play(kind), i * 520));
      }
    };

    globalThis.__FEHA_SOUND_ENGINE_028 = {
      originalPlay: OriginalPlay,
      get context() { return ctx; }
    };

    console.info(
      "FEHA DEV 0.2.8 // cyber sound engine armed. Test with FEHA_SOUNDS.demo()"
    );
  }

  function removeSoundEngine() {
    const engine = globalThis.__FEHA_SOUND_ENGINE_028;
    if (!engine) return;

    if (HTMLMediaElement.prototype.play !== engine.originalPlay) {
      HTMLMediaElement.prototype.play = engine.originalPlay;
    }

    try {
      engine.context?.close?.();
    } catch {}

    delete globalThis.FEHA_SOUNDS;
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
    "FEHA DEV " + BUILD + " // cyber sound redesign loaded"
  );

  state.reopenChrome();
})();