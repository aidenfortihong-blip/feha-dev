// FEHA // ENTRY GATEWAY DEV PATCH
// Keeps the installed gateway's native animation/auth flow, but normalizes the
// Cyberpunk title and playable roster to Ponyboy / Derke / Sasha / Zach.

(() => {
  try {
    globalThis.FEHA_ENTRY_GATEWAY_PATCH?.destroy?.();
  } catch {}

  const ROOT_ID = "adk-entry-gateway";
  const DERKE_ART =
    "https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/1%20Cyberpunk/74981913-bd87-4289-a524-7d987e699cfd.png";

  const DISPLAY_ORDER = [
    "Ponyboy",
    "Derke",
    "Sasha",
    "Zach"
  ];

  const norm = value =>
    String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-zA-Z0-9]+/g," ")
      .trim()
      .toLowerCase();

  const originalGateway = globalThis.ADKEntryGateway ?? null;
  const original = originalGateway
    ? {
        open:originalGateway.open,
        reopen:originalGateway.reopen,
        close:originalGateway.close,
        reset:originalGateway.reset,
        candidates:Array.isArray(originalGateway.candidates)
          ? [...originalGateway.candidates]
          : originalGateway.candidates
      }
    : null;

  let rootObserver = null;
  let bodyObserver = null;
  let activeRoot = null;
  let derkeProxyActive = false;
  let restoringInput = false;

  function displayNameForUnderlying(name) {
    const key = norm(name);
    if (key === "jing") return "Derke";
    if (key === "ponyboy") return "Ponyboy";
    if (key === "sasha" || key.startsWith("sasha ")) return "Sasha";
    if (key === "zach" || key === "raiden") return "Zach";
    return null;
  }

  function rewriteVisibleText(root) {
    if (!root) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      const before = node.nodeValue ?? "";
      const after = before
        .replace(/FLESH\s+ENSHROUDED\s*\/\/\s*HEART\s+ABLAZE/gi,"CYBERPUNK")
        .replace(/\bJING\b/g,"DERKE")
        .replace(/\bJing\b/g,"Derke")
        .replace(/\bSASHA\s+BOGDANOV\b/gi,"SASHA");

      if (after !== before) node.nodeValue = after;
    }

    root
      .querySelectorAll("[title],[aria-label],[data-tooltip],[placeholder],[alt]")
      .forEach(el => {
        for (const attr of ["title","aria-label","data-tooltip","placeholder","alt"]) {
          if (!el.hasAttribute(attr)) continue;

          const before = el.getAttribute(attr) ?? "";
          const after = before
            .replace(/FLESH\s+ENSHROUDED\s*\/\/\s*HEART\s+ABLAZE/gi,"CYBERPUNK")
            .replace(/\bJING\b/g,"DERKE")
            .replace(/\bJing\b/g,"Derke")
            .replace(/\bSASHA\s+BOGDANOV\b/gi,"SASHA");

          if (after !== before) el.setAttribute(attr,after);
        }
      });
  }

  function assignedDisplayName() {
    const name = norm(game.user?.character?.name);

    if (name === "ponyboy") return "Ponyboy";
    if (name === "derke") return "Derke";
    if (name === "sasha" || name.startsWith("sasha ")) return "Sasha";
    if (name === "zach" || name === "raiden") return "Zach";

    return null;
  }

  function normalizeCandidates(root) {
    const panel = root?.querySelector(".adk-eg-candidates");
    if (!panel) return;

    const byDisplay = new Map();

    for (const button of [...panel.querySelectorAll("[data-candidate]")]) {
      const underlying = String(button.dataset.candidate ?? "");
      const display = displayNameForUnderlying(underlying);

      if (!display) {
        button.remove();
        continue;
      }

      button.dataset.fehaUnderlyingCandidate = underlying;
      button.dataset.fehaDisplayCandidate = display;

      const nameEl = button.querySelector(".adk-eg-candidate-name");
      if (nameEl) nameEl.textContent = display.toUpperCase();

      byDisplay.set(display,button);
    }

    for (const display of DISPLAY_ORDER) {
      const button = byDisplay.get(display);
      if (button) panel.appendChild(button);
    }

    const assigned = assignedDisplayName();

    [...panel.querySelectorAll("[data-candidate]")].forEach((button,index) => {
      const display = button.dataset.fehaDisplayCandidate;
      const indexEl = button.querySelector(".adk-eg-candidate-index");
      const stateEl = button.querySelector(".adk-eg-candidate-state");

      if (indexEl) {
        indexEl.textContent = String(index + 1).padStart(2,"0");
      }

      if (stateEl) {
        stateEl.textContent = assigned === display ? "ASSIGNED" : "STANDBY";
      }
    });

    const headingCount =
      root.querySelector(".adk-eg-panel-heading span:last-child");

    if (headingCount) headingCount.textContent = "04 RECORDS";
  }

  function normalizeTitle(root) {
    const title = root?.querySelector(".adk-eg-header h1");
    if (title) title.textContent = "CYBERPUNK";
  }

  function normalizeDerkeProfile(root) {
    if (!derkeProxyActive || !root) return;

    const art = root.querySelector("[data-profile-art]");
    if (art) {
      art.src = DERKE_ART;
      art.alt = "Derke";
    }

    const id = root.querySelector("[data-profile-id]");
    if (id && /jing|derke/i.test(id.textContent ?? "")) {
      id.textContent = "DERKE";
    }
  }

  function normalizeRoot(root) {
    if (!root) return;

    normalizeTitle(root);
    normalizeCandidates(root);
    rewriteVisibleText(root);
    normalizeDerkeProfile(root);
  }

  function proxyValueForDerke(raw) {
    const typed = norm(raw);
    if (!typed || !"derke".startsWith(typed)) return null;

    const length = Math.min(typed.length,4);
    return "jing".slice(0,length);
  }

  function installRoot(root) {
    if (!root || root === activeRoot) {
      normalizeRoot(root);
      return;
    }

    rootObserver?.disconnect?.();
    activeRoot = root;
    derkeProxyActive = false;

    const input = root.querySelector("#adk-eg-id-input");

    root.addEventListener(
      "input",
      event => {
        if (restoringInput) return;
        if (event.target !== input) return;

        const originalTyped = String(input.value ?? "");
        const proxy = proxyValueForDerke(originalTyped);

        if (!proxy) {
          derkeProxyActive = false;
          return;
        }

        derkeProxyActive = norm(originalTyped) === "derke";

        // Original gateway listener runs after this capture handler and sees
        // JING, keeping the native selection/auth flow fully functional.
        input.value = proxy;

        queueMicrotask(() => {
          restoringInput = true;
          input.value = originalTyped;
          restoringInput = false;
          normalizeRoot(root);
        });
      },
      true
    );

    root.addEventListener(
      "click",
      event => {
        const button =
          event.target?.closest?.("[data-candidate]") ??
          null;

        if (!button || !root.contains(button)) return;

        if (norm(button.dataset.fehaUnderlyingCandidate) === "jing") {
          derkeProxyActive = true;

          queueMicrotask(() => {
            if (input) input.value = "Derke";
            normalizeRoot(root);
          });
        } else {
          derkeProxyActive = false;
        }
      },
      true
    );

    rootObserver = new MutationObserver(() => {
      normalizeRoot(root);
    });

    rootObserver.observe(root,{
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:["src","alt","hidden","class"]
    });

    normalizeRoot(root);
  }

  function findAndInstall() {
    const root = document.getElementById(ROOT_ID);
    if (root) installRoot(root);
  }

  bodyObserver = new MutationObserver(() => findAndInstall());
  bodyObserver.observe(document.body,{
    childList:true,
    subtree:true
  });

  if (originalGateway) {
    originalGateway.open = async (...args) => {
      const result = await original.open?.(...args);
      findAndInstall();
      setTimeout(findAndInstall,50);
      setTimeout(findAndInstall,450);
      return result;
    };

    originalGateway.reopen = async (...args) => {
      const result = await original.reopen?.(...args);
      findAndInstall();
      setTimeout(findAndInstall,50);
      setTimeout(findAndInstall,450);
      return result;
    };

    originalGateway.candidates = [...DISPLAY_ORDER];
  }

  findAndInstall();

  globalThis.FEHA_ENTRY_GATEWAY_PATCH = {
    version:"0.10.56",
    candidates:[...DISPLAY_ORDER],
    refresh:findAndInstall,
    destroy() {
      rootObserver?.disconnect?.();
      bodyObserver?.disconnect?.();
      rootObserver = null;
      bodyObserver = null;
      activeRoot = null;

      if (originalGateway && original) {
        if (original.open) originalGateway.open = original.open;
        if (original.reopen) originalGateway.reopen = original.reopen;
        if (original.close) originalGateway.close = original.close;
        if (original.reset) originalGateway.reset = original.reset;
        originalGateway.candidates = original.candidates;
      }

      delete globalThis.FEHA_ENTRY_GATEWAY_PATCH;
    }
  };

  console.info(
    "FEHA ENTRY GATEWAY // CYBERPUNK roster active:",
    DISPLAY_ORDER.join(", ")
  );
})();
