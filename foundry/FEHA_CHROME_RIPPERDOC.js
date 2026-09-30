// FEHA // CHROME MANAGER — CP2077 RIPPERDOC BODY MAP
//
// Adds a Cyberpunk-2077-style body map around the character portrait: every
// body system with its label, "AVAILABLE ITEMS" count and a row of square
// slot tiles (installed chrome or an empty "+" port).
//
// Presentation only. It never installs, ejects or uses anything itself:
// tiles route through the installed module's own renderer
// (ADKChromeNative.selectSystem / inventory and its [data-inspect-item]
// buttons), so the existing install / eject / use buttons in the inspector
// and cache drawer remain the only mutation paths.
//
// Called from latest-dev.js markRoot() after every Chrome DOM change. It is
// idempotent: an unchanged signature is a no-op, so its own DOM insertions
// cannot loop the observer.

(() => {
  const VERSION = "1.0.0";
  const ROOT_ID = "adk-chrome-manager-34";

  const SYSTEMS = {
    "Frontal Cortex": "CORTEX",
    "Face": "FACE / OPTICS",
    "Circulatory System": "CIRCULATORY",
    "Nervous System": "NERVOUS SYSTEM",
    "Integumentary System": "DERMAL SHELL",
    "Operating System": "OPERATING SYSTEM",
    "Arms": "ARMS",
    "Hands": "HANDS",
    "Skeleton": "STRUCTURAL FRAME",
    "Legs": "LOWER MOBILITY"
  };

  const LEFT = [
    "Frontal Cortex",
    "Face",
    "Circulatory System",
    "Nervous System",
    "Integumentary System"
  ];

  const RIGHT = [
    "Operating System",
    "Arms",
    "Hands",
    "Skeleton",
    "Legs"
  ];

  const esc = value => {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  };

  function activeSlot(root) {
    return (
      root.querySelector(".adk-v6-system.is-active")?.dataset?.system ??
      null
    );
  }

  function slotState(api, slot) {
    let installed = [];
    let owned = [];

    try { installed = api.getInstalled(slot) ?? []; } catch {}
    try { owned = api.getOwned(slot) ?? []; } catch {}

    const limit = Math.max(1, Number(api.slotLimits?.[slot] ?? 1));
    return { installed, owned, limit };
  }

  function signature(root, api) {
    const actor = api.getActor?.();
    const cacheOpen = root.querySelector(".adk-v6-cache.is-open") ? 1 : 0;

    return [
      actor?.id ?? "none",
      activeSlot(root) ?? "",
      cacheOpen,
      ...[...LEFT, ...RIGHT].map(slot => {
        const s = slotState(api, slot);
        return slot + ":" + s.installed.map(i => i.id).join(",") + ":" + s.owned.length;
      })
    ].join("|");
  }

  function tileHTML(item, slot) {
    if (item) {
      return (
        '<button type="button" class="cp-rd-tile is-filled" ' +
        'data-cp-inspect="' + esc(item.id) + '" data-cp-slot="' + esc(slot) + '" ' +
        'title="' + esc(item.name) + '" aria-label="' + esc(item.name) + '">' +
        '<img src="' + esc(item.img) + '" alt="">' +
        "</button>"
      );
    }

    return (
      '<button type="button" class="cp-rd-tile is-empty" ' +
      'data-cp-open="' + esc(slot) + '" ' +
      'aria-label="Open ' + esc(SYSTEMS[slot] ?? slot) + ' hardware cache">' +
      "<span>+</span>" +
      "</button>"
    );
  }

  function systemHTML(api, slot, side, active) {
    const { installed, owned, limit } = slotState(api, slot);
    const tiles = Array.from(
      { length: limit },
      (_, i) => tileHTML(installed[i] ?? null, slot)
    ).join("");

    const status = owned.length
      ? '<span class="cp-rd-avail">AVAILABLE ITEMS <i>' + owned.length + "</i></span>"
      : '<span class="cp-rd-none">NO CYBERWARE TO INSTALL</span>';

    return (
      '<section class="cp-rd-sys is-' + side + (active ? " is-active" : "") + '" data-cp-system="' + esc(slot) + '">' +
      '<button type="button" class="cp-rd-label" data-cp-select="' + esc(slot) + '">' +
      "<b>" + esc(SYSTEMS[slot] ?? slot) + "</b>" + status +
      "</button>" +
      '<div class="cp-rd-tiles">' + tiles + "</div>" +
      "</section>"
    );
  }

  function bind(map) {
    const nativeApi = () => globalThis.ADKChromeNative;

    map.addEventListener("click", event => {
      const target = event.target?.closest?.("[data-cp-select],[data-cp-open],[data-cp-inspect]");
      if (!target) return;

      const native = nativeApi();
      if (!native) return;

      if (target.dataset.cpSelect) {
        native.selectSystem?.(target.dataset.cpSelect);
        return;
      }

      if (target.dataset.cpOpen) {
        native.selectSystem?.(target.dataset.cpOpen);
        native.inventory?.(true);
        return;
      }

      if (target.dataset.cpInspect) {
        const itemId = target.dataset.cpInspect;
        native.selectSystem?.(target.dataset.cpSlot);

        // The module renders synchronously; its inspector port button owns
        // item selection, so delegate to it rather than duplicating state.
        requestAnimationFrame(() => {
          document
            .getElementById(ROOT_ID)
            ?.querySelector('.adk-v6-inspector [data-inspect-item="' + CSS.escape(itemId) + '"]')
            ?.click();
        });
      }
    });
  }

  function augment(root = document.getElementById(ROOT_ID)) {
    const api = globalThis.ADKChromeBackend;
    const app = root?.querySelector?.(".adk-v6-app");
    const subject = app?.querySelector?.(".adk-v6-subject");
    if (!api?.getActor?.() || !app || !subject) return false;

    const sig = signature(root, api);
    const existing = subject.querySelector(":scope > .cp-rd-map");
    if (existing?.dataset.cpSignature === sig) return false;

    const active = activeSlot(root);
    const map = document.createElement("div");
    map.className = "cp-rd-map";
    map.dataset.cpSignature = sig;
    map.innerHTML =
      '<div class="cp-rd-col is-left">' +
      LEFT.map(slot => systemHTML(api, slot, "left", slot === active)).join("") +
      "</div>" +
      '<div class="cp-rd-col is-right">' +
      RIGHT.map(slot => systemHTML(api, slot, "right", slot === active)).join("") +
      "</div>";

    bind(map);

    if (existing) existing.replaceWith(map);
    else subject.appendChild(map);

    app.classList.add("cp-rd");
    return true;
  }

  globalThis.FEHA_CHROME_RIPPERDOC = {
    version: VERSION,
    augment
  };
})();
