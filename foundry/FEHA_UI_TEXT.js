// FEHA // UI TEXT
// The Market and Chrome Manager are drawn by the installed module, so their
// wording cannot be edited from this repo. This rewrites the few labels there
// that break the fiction (Foundry permission jargon, a second currency name,
// rules-engine phrasing) as they appear. Display text only.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;

  if (!core) {
    throw new Error("FEHA_UI_TEXT requires FEHA_CYBER_CORE.");
  }

  const VERSION = "1.0.0";
  const ROOTS = "#adk-market-15, #adk-chrome-manager-34, #notifications";
  const ATTRIBUTES = ["title","aria-label","data-tooltip"];

  // Whole-label replacements, matched after collapsing whitespace.
  const EXACT = new Map([
    [
      "Choose vendor clearance here, then enter a storefront. Trusted Players can browse the curated catalog at Observer access; vendor clearance only controls what the current shop is actually selling.",
      "Set your vendor clearance, then pick a storefront. Higher clearance means the vendor will show you higher-grade stock."
    ],
    [
      "Body-slot chrome with direct installation and capacity checks.",
      "Cyberware for every body slot, fitted by a licensed ripperdoc."
    ],
    [
      "Focused professional stock with manufacturer filtering.",
      "Corporate-grade stock, sold direct by the manufacturers."
    ],
    [
      "Change your filters or return to the directory and choose another vendor tier.",
      "Change your filters, or go back to the directory and raise your vendor clearance."
    ],
    ["Insufficient Eurodollars.","Not enough credits."],
    ["FEHA // AUGMENTATION CONTROL","ADK // AUGMENTATION CONTROL"]
  ]);

  // Partial replacements for labels with a name or number in them.
  const RULES = [
    [/ does not have enough Eurodollars\./," does not have enough credits."]
  ];

  let observer = null;

  function rewrite(value) {
    const raw = String(value ?? "");
    const flat = raw.replace(/\s+/g," ").trim();
    if (!flat) return null;

    const exact = EXACT.get(flat);
    if (exact) return exact;

    for (const [pattern,replacement] of RULES) {
      if (pattern.test(flat)) return flat.replace(pattern,replacement);
    }

    return null;
  }

  function fixTextNode(node) {
    const next = rewrite(node.nodeValue);
    if (next !== null && next !== node.nodeValue) node.nodeValue = next;
  }

  function fixElement(element) {
    for (const name of ATTRIBUTES) {
      if (!element.hasAttribute?.(name)) continue;

      const next = rewrite(element.getAttribute(name));
      if (next !== null) element.setAttribute(name,next);
    }
  }

  function fixTree(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement?.closest?.(ROOTS)) fixTextNode(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE) return;

    const inside = root.closest?.(ROOTS);
    const scopes = inside ? [root] : [...root.querySelectorAll(ROOTS)];

    for (const scope of scopes) {
      fixElement(scope);

      for (const element of scope.querySelectorAll("[title],[aria-label],[data-tooltip]")) {
        fixElement(element);
      }

      const walker = document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) fixTextNode(walker.currentNode);
    }
  }

  function onMutations(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        fixTree(mutation.target);
        continue;
      }

      for (const node of mutation.addedNodes) fixTree(node);
    }
  }

  const api = {
    version:VERSION,
    rewrite,

    async init() {
      observer?.disconnect();
      observer = new MutationObserver(onMutations);
      observer.observe(document.body,{
        childList:true,
        subtree:true,
        characterData:true
      });

      fixTree(document.body);
      console.log("FEHA UI TEXT",VERSION,"ready");
    },

    async destroy() {
      observer?.disconnect();
      observer = null;
    }
  };

  core.registerModule("uiText",api);
})();
