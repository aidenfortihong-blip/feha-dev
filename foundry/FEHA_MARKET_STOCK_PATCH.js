// FEHA // MARKET STOCK PATCH
// Patches the world ADK Market macro in-place so vendors stock healthy,
// category-aware inventories instead of 8-12 fully random items.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_MARKET_STOCK_PATCH requires FEHA_CYBER_CORE.");

  const VERSION = "1.6.0";
  const STOCK_SCHEMA_VERSION = "1.4.3";
  const FLAG = "fleshEnshrouded";
  const PACKAGE = "flesh-enshrouded-heart-ablaze";
  const VERSION_KEY = "marketStockPatchVersionV1";
  const STOCK_KEY = "adkMarketStockV16";
  const START = "/* FEHA MARKET STOCK PATCH START */";
  const END = "/* FEHA MARKET STOCK PATCH END */";
  let marketClickSyncHandler = null;
  let marketSyncScheduled = false;
  let marketSyncRunning = false;
  const MARKET_STYLE_ID = "feha-market-weapon-description-style";

  const PATCH_BLOCK = [
    START,
    "const FEHA_VENDOR_STOCK_RULES = {",
    "  street: {",
    "    min:14, max:18,",
    "    guarantee:{Weapons:3,Armor_Outer:2,Consumables:2}",
    "  },",
    "  arms: {",
    "    min:16, max:20,",
    "    guarantee:{Weapons:7,Armor_Outer:3,Grenades:3}",
    "  },",
    "  chrome: {",
    "    min:12, max:16,",
    "    guarantee:{Cyberware:8}",
    "  },",
    "  net: {",
    "    min:14, max:18,",
    "    guarantee:{Quickhacks:6,Cyberware:4}",
    "  },",
    "  black: {",
    "    min:16, max:20,",
    "    guarantee:{Weapons:4,Quickhacks:3,Cyberware:3,Grenades:2}",
    "  },",
    "  corporate: {",
    "    min:14, max:18,",
    "    guarantee:{Weapons:3,Armor_Outer:2,Cyberware:2}",
    "  }",
    "};",
    "",
    "function fehaStockWeight(item) {",
    "  const flags = item?.flags?.[FLAG] ?? {};",
    "  const rarity = Math.max(0.005,Number(flags.marketStockWeight ?? 1) || 1);",
    "  const tierWeight = Math.max(",
    "    1,",
    "    5 - 2 * Math.max(0,state.shopTier - tier(item))",
    "  );",
    "  return Math.max(0.005,tierWeight * rarity);",
    "}",
    "",
    "function fehaWeaponAllowedInShop(item,shop) {",
    "  if (item?.type !== \"weapon\") return true;",
    "  const flags = item?.flags?.[FLAG] ?? {};",
    "  if (flags.marketReady !== true) return false;",
    "  if (tier(item) > state.shopTier) return false;",
    "  const allowed = Array.isArray(flags.marketAllowedShops)",
    "    ? flags.marketAllowedShops",
    "    : [\"street\",\"arms\",\"black\",\"corporate\"];",
    "  return allowed.includes(shop);",
    "}",
    "",
    "function fehaDrawFrom(candidates,predicate=()=>true) {",
    "  const eligible = candidates",
    "    .map((item,index) => ({item,index}))",
    "    .filter(entry => predicate(entry.item));",
    "",
    "  if (!eligible.length) return null;",
    "",
    "  const weights = eligible.map(entry => fehaStockWeight(entry.item));",
    "  let draw = Math.random() * weights.reduce((a,b) => a+b,0);",
    "  let local = weights.findIndex(weight => (draw -= weight) < 0);",
    "",
    "  if (local < 0) local = eligible.length - 1;",
    "",
    "  const sourceIndex = eligible[local].index;",
    "  return candidates.splice(sourceIndex,1)[0] ?? null;",
    "}",
    "",
    "function fehaStockSize(shop,poolLength) {",
    "  const rule = FEHA_VENDOR_STOCK_RULES[shop] ?? {min:12,max:16};",
    "  const span = Math.max(1,rule.max - rule.min + 1);",
    "  return Math.min(",
    "    poolLength,",
    "    rule.min + Math.floor(Math.random() * span)",
    "  );",
    "}",
    "",
    "function fehaBuildStock(shop,pool,size) {",
    "  const rule = FEHA_VENDOR_STOCK_RULES[shop] ?? {};",
    "  const candidates = [...pool];",
    "  const selected = [];",
    "",
    "  for (const [categoryName,count] of Object.entries(rule.guarantee ?? {})) {",
    "    for (let i=0;i<count && selected.length<size;i++) {",
    "      const item = fehaDrawFrom(",
    "        candidates,",
    "        candidate => category(candidate) === categoryName",
    "      );",
    "      if (!item) break;",
    "      selected.push(item);",
    "    }",
    "  }",
    "",
    "  while (selected.length < size && candidates.length) {",
    "    const item = fehaDrawFrom(candidates);",
    "    if (!item) break;",
    "    selected.push(item);",
    "  }",
    "",
    "  return selected.map(item => item.id);",
    "}",
    "",
    "function adkRollStock(",
    "  shop = state.shop,",
    "  force = false",
    ") {",
    "  if (!shop) return [];",
    "",
    "  const key = adkStockKey(shop);",
    "  const ordinaryPool = availableInShop(shop)",
    "    .filter(item => item?.type !== \"weapon\");",
    "  const weaponPool = (game.items?.contents ?? [])",
    "    .filter(item =>",
    "      item?.type === \"weapon\" &&",
    "      fehaWeaponAllowedInShop(item,shop)",
    "    );",
    "  const pool = [...new Map(",
    "    [...ordinaryPool,...weaponPool].map(item => [item.id,item])",
    "  ).values()];",
    "",
    "  const previous = adkStockCache[key] || [];",
    "  const size = fehaStockSize(shop,pool.length);",
    "",
    "  if (!force && previous.length) {",
    "    const valid = previous.filter(id =>",
    "      pool.some(item => item.id === id)",
    "    );",
    "",
    "    const rule = FEHA_VENDOR_STOCK_RULES[shop] ?? {min:12};",
    "    const minimum = Math.min(pool.length,rule.min ?? 12);",
    "",
    "    if (valid.length >= minimum) {",
    "      adkStockCache[key] = valid;",
    "      return valid;",
    "    }",
    "  }",
    "",
    "  let selected = fehaBuildStock(shop,pool,size);",
    "",
    "  if (force && previous.length && pool.length > size) {",
    "    for (let attempt=0;attempt<20;attempt++) {",
    "      if (selected.some(id => !previous.includes(id))) break;",
    "      selected = fehaBuildStock(shop,pool,size);",
    "    }",
    "  }",
    "",
    "  adkStockCache[key] = selected;",
    "",
    "  if (!force) {",
    "    void adkSaveStock().catch(error =>",
    "      console.error(\"ADK STOCK SAVE\",error)",
    "    );",
    "  }",
    "",
    "  return selected;",
    "}",
    END
  ].join("\n");

  function registerSetting() {
    const full = PACKAGE+"."+VERSION_KEY;
    if (game.settings?.settings?.has?.(full)) return;

    game.settings.register(
      PACKAGE,
      VERSION_KEY,
      {
        name:"FEHA Market Stock Patch Version",
        scope:"world",
        config:false,
        type:String,
        default:""
      }
    );
  }

  function marketMacros() {
    return (game.macros?.contents ?? []).filter(macro => {
      const command = String(macro?.command ?? "");
      return (
        command.includes('const ADK_STOCK_KEY = "adkMarketStockV16";') &&
        (
          command.includes("function adkRollStock(") ||
          (
            command.includes(START) &&
            command.includes(END)
          )
        )
      );
    });
  }

  function patchCommand(command) {
    let source = String(command ?? "");

    // Weapons do not use Mk. Keep a hidden marketBand only for vendor-quality
    // gating, and never expose it as rating/tier/Mk in the Market.
    const tierStart = source.indexOf("function tier(item) {");
    const manufacturerStart = source.indexOf(
      "function manufacturer(item)",
      tierStart
    );

    if (tierStart >= 0 && manufacturerStart > tierStart) {
      source =
        source.slice(0,tierStart) +
        [
          "function tier(item) {",
          "  const flags = item?.flags?.[FLAG] ?? {};",
          "  const raw =",
          "    category(item) === \"Weapons\"",
          "      ? (flags.marketBand ?? 1)",
          "      : (flags.rating ?? flags.tier ?? 1);",
          "",
          "  return clamp(raw,1,5);",
          "}",
          "",
          ""
        ].join("\n") +
        source.slice(manufacturerStart);
    }

    // Tag weapon cards and remove the Mk badge from weapon HTML entirely.
    source = source.replace(
      'class="item-card"',
      'class="item-card ${c === "Weapons" ? "feha-weapon-card" : ""}"'
    );

    source = source.replace(
      /<span class="item-mk">\s*\$\{mkLabel\(itemTier\)\}\s*<\/span>/m,
      '${c === "Weapons" ? "" : `<span class="item-mk">${mkLabel(itemTier)}</span>`}'
    );

    // Mk filter chips should not hide/show guns because guns have no Mk.
    source = source.replace(
      /if \(\s*state\.itemTier\s*&&\s*tier\(\s*item\s*\)\s*!==\s*state\.itemTier\s*\) \{/m,
      'if (state.itemTier && category(item) !== "Weapons" && tier(item) !== state.itemTier) {'
    );

    const markedStart = source.indexOf(START);
    const markedEnd = source.indexOf(END);

    if (markedStart >= 0 && markedEnd > markedStart) {
      return (
        source.slice(0,markedStart) +
        PATCH_BLOCK +
        source.slice(markedEnd + END.length)
      );
    }

    const start = source.indexOf("function adkRollStock(");
    const next = source.indexOf("function adkCurrentStock(",start);

    if (start < 0 || next < 0) {
      throw new Error(
        "Could not locate ADK Market stock function boundaries."
      );
    }

    return (
      source.slice(0,start) +
      PATCH_BLOCK +
      "\n\n" +
      source.slice(next)
    );
  }

  function weaponItemForCard(card) {
    const node =
      card?.querySelector?.("[data-buy-item]") ??
      card?.querySelector?.("[data-open-item]") ??
      null;

    const id =
      String(
        node?.dataset?.buyItem ??
        node?.dataset?.openItem ??
        ""
      );

    if (!id) return null;

    return game.items?.get?.(id) ?? null;
  }

  function catalogDefinition(item) {
    return (
      globalThis.FEHA_WEAPON_CATALOG?.definition?.(item) ??
      globalThis.FEHA_UNIQUE_WEAPON_CATALOG?.definition?.(item) ??
      globalThis.FEHA_MELEE_CATALOG?.definition?.(item) ??
      null
    );
  }

  function marketRangeText(def,item) {
    if (def?.reach && !def?.range) {
      const thrown =
        def?.thrownRange != null
          ? " // THROWN "+String(def.thrownRange)+
            (def?.thrownLong != null ? "/"+String(def.thrownLong) : "")+
            " FT"
          : "";

      return String(def.reach)+" FT REACH"+thrown;
    }

    const range =
      def?.range ??
      item?.flags?.[FLAG]?.rangeFt ??
      item?.system?.range?.value ??
      null;

    const long =
      def?.longRange ??
      item?.flags?.[FLAG]?.longRangeFt ??
      item?.system?.range?.long ??
      null;

    if (range == null) return "—";
    return long != null
      ? String(range)+"/"+String(long)+" FT"
      : String(range)+" FT";
  }

  function marketWeaponCopy(item) {
    const def = catalogDefinition(item);
    const f = item?.flags?.[FLAG] ?? {};

    const weaponClass =
      String(
        def?.weaponClass ??
        f.weaponClass ??
        item?.system?.type?.value ??
        "WEAPON"
      ).toUpperCase();

    const damage =
      String(
        def?.damage ??
        f.damageFormula ??
        f.baseDamageFormula ??
        item?.system?.damage?.base?.custom?.formula ??
        "—"
      );

    const doctrine =
      String(
        def?.doctrine ??
        def?.effect?.text ??
        def?.special?.text ??
        f.effectText ??
        ""
      ).trim();

    const attacks =
      Number(
        def?.functionalAttacks ??
        f.functionalMagazine ??
        f.magazineSize ??
        0
      ) || 0;

    const reload =
      Number(
        def?.reloadPoints ??
        def?.reloadActions ??
        f.reloadPoints ??
        f.reloadActions ??
        0
      ) || 0;

    const isMelee =
      String(def?.weaponKind ?? f.weaponKind ?? "").toLowerCase() === "melee" ||
      Boolean(f.meleeWeapon);

    const primary =
      doctrine ||
      (
        isMelee
          ? weaponClass+" built for close combat."
          : weaponClass+" // canonical FEHA weapon profile."
      );

    const stats = [
      damage !== "—" ? "DMG "+damage : null,
      "RANGE "+marketRangeText(def,item),
      !isMelee && attacks > 0 ? attacks+" ATTACK"+(attacks===1?"":"S")+" / RELOAD" : null,
      !isMelee && reload > 0 ? "RELOAD "+reload+" PT"+(reload===1?"":"S") : null,
      "TO HIT DEX"
    ].filter(Boolean);

    return {
      primary,
      stats,
      weaponClass,
      manufacturer:String(
        def?.company ??
        f.manufacturer ??
        f.company ??
        ""
      )
    };
  }

  function ensureMarketWeaponStyles() {
    let style = document.getElementById(MARKET_STYLE_ID);
    if (style) return style;

    style = document.createElement("style");
    style.id = MARKET_STYLE_ID;
    style.textContent = `
      #adk-market-15 .feha-weapon-card {
        align-self:start !important;
        height:auto !important;
        min-height:0 !important;
        max-height:none !important;
      }

      #adk-market-15 .feha-weapon-card .item-actions,
      #adk-market-15 .feha-weapon-card .card-actions,
      #adk-market-15 .feha-weapon-card .actions {
        position:static !important;
        inset:auto !important;
        margin-top:10px !important;
      }

      #adk-market-15 .feha-market-weapon-copy {
        order:initial;
        width:100%;
        margin:8px 0 0;
        padding:10px 11px;
        border:1px solid rgba(80,205,228,.24);
        background:
          linear-gradient(180deg,rgba(5,19,24,.92),rgba(3,12,16,.92));
        box-shadow:inset 0 0 20px rgba(46,205,233,.035);
      }

      #adk-market-15 .feha-market-weapon-copy > p {
        margin:0;
        color:#bccbd0;
        font-size:10px;
        line-height:1.45;
      }

      #adk-market-15 .feha-market-weapon-stats {
        display:flex;
        flex-wrap:wrap;
        gap:5px 12px;
        margin-top:8px;
        padding-top:7px;
        border-top:1px solid rgba(80,205,228,.14);
        color:#6edff3;
        font-size:8px;
        font-weight:1000;
        letter-spacing:.055em;
      }

      #adk-market-15 .feha-market-weapon-stats span {
        white-space:nowrap;
      }
    `;

    document.head.appendChild(style);
    return style;
  }

  function legacyWeaponDescriptionNodes(card,item) {
    const copy = marketWeaponCopy(item);
    const primary = String(copy.primary ?? "")
      .replace(/\s+/g," ")
      .trim();

    const blocked = node =>
      node?.closest?.(
        ".feha-market-weapon-copy,.item-actions,.card-actions,.actions,"+
        "button,[data-buy-item],[data-open-item]"
      );

    const textOf = node =>
      String(node?.textContent ?? "")
        .replace(/\s+/g," ")
        .trim();

    const candidates = [
      ...card.querySelectorAll(
        ".item-description,.item-desc,.description,.desc,.item-summary,"+
        ".item-flavor,.flavor,p,div,section,article,span"
      )
    ]
      .filter(node =>
        node !== card &&
        !blocked(node)
      )
      .map(node => ({
        node,
        text:textOf(node)
      }))
      .filter(entry => {
        const text = entry.text;
        if (!text || text.length < 18 || text.length > 1400) return false;

        const exactPrimary =
          primary.length >= 24 &&
          (
            text === primary ||
            text.startsWith(primary) ||
            primary.startsWith(text)
          );

        const genericOld =
          /base damage|ability modifier|\bdamage\s+\d+d\d+/i.test(text);

        const flattenedFeha =
          /FEHA\s*\/\//i.test(text) &&
          /(DAMAGE|REACH|RANGE|STR REQUIREMENT|CLASS DIE|ONE STRIKE)/i.test(text);

        return exactPrimary || genericOld || flattenedFeha;
      });

    // Keep deepest/smallest matches. Parent wrappers often repeat a child's
    // textContent; replacing the parent is what caused oversized/duplicated
    // Market cards in earlier builds.
    const depth = node => {
      let d = 0;
      let current = node;
      while (current && current !== card) {
        d++;
        current = current.parentElement;
      }
      return d;
    };

    candidates.sort((a,b) =>
      depth(b.node)-depth(a.node) ||
      a.text.length-b.text.length
    );

    const chosen = [];

    for (const entry of candidates) {
      if (
        chosen.some(node =>
          node === entry.node ||
          node.contains?.(entry.node) ||
          entry.node.contains?.(node)
        )
      ) {
        continue;
      }

      chosen.push(entry.node);
    }

    return chosen;
  }

  function weaponSummarySignature(item) {
    const copy = marketWeaponCopy(item);
    return JSON.stringify({
      id:String(item?.id ?? ""),
      primary:copy.primary,
      stats:copy.stats
    });
  }

  function weaponSummaryElement(item) {
    const copy = marketWeaponCopy(item);
    const node = document.createElement("div");
    node.className = "feha-market-weapon-copy";
    node.dataset.fehaWeaponDescription = String(item?.id ?? "");
    node.dataset.fehaWeaponSignature = weaponSummarySignature(item);

    const p = document.createElement("p");
    p.textContent = copy.primary;
    node.appendChild(p);

    const stats = document.createElement("div");
    stats.className = "feha-market-weapon-stats";

    for (const value of copy.stats) {
      const span = document.createElement("span");
      span.textContent = value;
      stats.appendChild(span);
    }

    node.appendChild(stats);
    return node;
  }

  function syncWeaponMarketCards() {
    if (marketSyncRunning) return;

    const root = document.getElementById("adk-market-15");
    if (!root) return;

    marketSyncRunning = true;

    try {
      ensureMarketWeaponStyles();

      for (const card of root.querySelectorAll(".item-card")) {
        const item = weaponItemForCard(card);
        if (item?.type !== "weapon") continue;

        card.classList.add("feha-weapon-card");

        for (const badge of card.querySelectorAll(".item-mk")) {
          badge.remove();
        }

        const signature = weaponSummarySignature(item);
        let summary =
          card.querySelector(".feha-market-weapon-copy");

        if (
          !summary ||
          summary.dataset.fehaWeaponSignature !== signature
        ) {
          const fresh = weaponSummaryElement(item);

          if (summary) summary.replaceWith(fresh);
          summary = fresh;
        }

        const legacyNodes =
          legacyWeaponDescriptionNodes(card,item);

        for (const node of legacyNodes) {
          if (node === summary || node.contains?.(summary)) continue;
          node.remove();
        }

        // Remove accidental duplicate FEHA summaries from older patches.
        for (const duplicate of card.querySelectorAll(".feha-market-weapon-copy")) {
          if (duplicate !== summary) duplicate.remove();
        }

        const actionButton =
          card.querySelector("[data-buy-item],[data-open-item]") ??
          null;

        const actionRow =
          actionButton?.closest?.(
            ".item-actions,.card-actions,.actions"
          ) ??
          card.querySelector(
            ".item-actions,.card-actions,.actions"
          ) ??
          actionButton;

        // Canonical placement is directly before the Market buttons. Moving
        // an already-correct node is harmless and prevents the huge blank gap
        // caused by old summaries being appended after bottom-pinned actions.
        if (summary) {
          if (actionRow && actionRow.parentElement) {
            if (summary.nextElementSibling !== actionRow) {
              actionRow.parentElement.insertBefore(summary,actionRow);
            }
          } else if (summary.parentElement !== card) {
            card.appendChild(summary);
          } else if (!summary.isConnected) {
            card.appendChild(summary);
          }
        }
      }
    } finally {
      marketSyncRunning = false;
    }
  }

  function scheduleWeaponMarketSync() {
    if (marketSyncScheduled) return;
    marketSyncScheduled = true;

    requestAnimationFrame(() => {
      marketSyncScheduled = false;
      syncWeaponMarketCards();
    });
  }

  function stripWeaponMkBadges() {
    syncWeaponMarketCards();
  }

  function scheduleMarketSyncBurst() {
    for (const delay of [0,80,220,500,1000]) {
      setTimeout(() => {
        if (!document.getElementById("adk-market-15")) return;
        scheduleWeaponMarketSync();
      },delay);
    }
  }

  function installNoMkGuard() {
    // IMPORTANT: there is intentionally NO MutationObserver here.
    // The previous observer watched document.body and reacted while the Market
    // was constructing/rerendering itself. Even with idempotent card writes,
    // the sheer mutation storm could lock the Foundry client on Shop open.
    //
    // Instead, synchronize once on load and after user interaction. Market
    // rerolls, filters, DETAILS, and shop switching are all user-driven, so a
    // short delayed burst is enough to catch the finished DOM without ever
    // observing our own mutations.
    if (!marketClickSyncHandler) {
      marketClickSyncHandler = () => {
        scheduleMarketSyncBurst();
      };

      document.addEventListener(
        "click",
        marketClickSyncHandler,
        true
      );
    }

    scheduleMarketSyncBurst();
  }

  function removeNoMkGuard() {
    if (marketClickSyncHandler) {
      document.removeEventListener(
        "click",
        marketClickSyncHandler,
        true
      );
      marketClickSyncHandler = null;
    }

    marketSyncScheduled = false;
    marketSyncRunning = false;
    document.getElementById(MARKET_STYLE_ID)?.remove?.();
  }

  async function resetPersistentStock() {
    const full = "world."+STOCK_KEY;

    if (!game.settings?.settings?.has?.(full)) {
      return false;
    }

    await game.settings.set(
      "world",
      STOCK_KEY,
      {}
    );

    return true;
  }

  async function patchMarketMacro() {
    if (!game.user?.isGM) {
      return {
        skipped:true,
        patched:0,
        reset:false,
        restarted:false
      };
    }

    registerSetting();

    // Price / rarity flags must exist before a stock reset or first roll.
    // This keeps first-load stock from briefly treating every weapon as Band 1.
    try {
      await globalThis.FEHA_WEAPON_ECONOMY?.migrateAll?.();
    } catch (error) {
      console.warn(
        "FEHA MARKET STOCK PATCH // weapon economy pre-stock migration failed",
        error
      );
    }

    const macros = marketMacros();

    if (!macros.length) {
      console.warn(
        "FEHA MARKET STOCK PATCH // no ADK Market macro found"
      );

      return {
        skipped:false,
        patched:0,
        reset:false,
        restarted:false,
        missing:true
      };
    }

    let patched = 0;

    for (const macro of macros) {
      const before = String(macro.command ?? "");
      const after = patchCommand(before);

      if (after !== before) {
        await macro.update({command:after});
        patched++;
      }
    }

    const currentVersion =
      String(
        game.settings.get(
          PACKAGE,
          VERSION_KEY
        ) ?? ""
      );

    const needsReset =
      currentVersion !== STOCK_SCHEMA_VERSION;

    const wasOpen =
      Boolean(
        document.getElementById(
          "adk-market-15"
        )
      );

    let reset = false;
    let restarted = false;

    if (needsReset) {
      reset = await resetPersistentStock();

      await game.settings.set(
        PACKAGE,
        VERSION_KEY,
        STOCK_SCHEMA_VERSION
      );

      if (wasOpen) {
        try {
          globalThis.ADKMarket?.destroy?.();
        } catch {}

        const macro = macros[0];

        setTimeout(
          () => {
            try {
              macro.execute();
            } catch (error) {
              console.warn(
                "FEHA MARKET STOCK PATCH // market restart failed",
                error
              );
            }
          },
          50
        );

        restarted = true;
      }
    }

    const result = {
      skipped:false,
      patched,
      reset,
      restarted,
      macros:macros.length,
      version:VERSION
    };

    console.log(
      "FEHA MARKET STOCK PATCH",
      result
    );

    if (patched || reset) {
      ui.notifications?.info?.(
        "FEHA Market stock upgraded: larger vendor inventories with category guarantees."
      );
    }

    return result;
  }

  const api = {
    version:VERSION,
    stockSchemaVersion:STOCK_SCHEMA_VERSION,
    patchMarketMacro,
    syncWeaponMarketCards,
    marketWeaponCopy,

    async init() {
      globalThis.FEHA_MARKET_STOCK_PATCH = api;
      game.adk ??= {};
      game.adk.marketStockPatch = api;

      installNoMkGuard();

      if (game.user?.isGM) {
        await patchMarketMacro();
      }

      syncWeaponMarketCards();
    },

    async destroy() {
      removeNoMkGuard();
      if (game?.adk?.marketStockPatch === api) {
        delete game.adk.marketStockPatch;
      }

      if (globalThis.FEHA_MARKET_STOCK_PATCH === api) {
        delete globalThis.FEHA_MARKET_STOCK_PATCH;
      }
    }
  };

  core.registerModule("marketStockPatch",api);
  globalThis.FEHA_MARKET_STOCK_PATCH = api;
})();
