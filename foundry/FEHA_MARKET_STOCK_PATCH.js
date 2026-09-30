// FEHA // MARKET STOCK PATCH
// Patches the world ADK Market macro in-place so vendors stock healthy,
// category-aware inventories instead of 8-12 fully random items.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_MARKET_STOCK_PATCH requires FEHA_CYBER_CORE.");

  const VERSION = "1.4.1";
  const FLAG = "fleshEnshrouded";
  const PACKAGE = "flesh-enshrouded-heart-ablaze";
  const VERSION_KEY = "marketStockPatchVersionV1";
  const STOCK_KEY = "adkMarketStockV16";
  const START = "/* FEHA MARKET STOCK PATCH START */";
  const END = "/* FEHA MARKET STOCK PATCH END */";
  let noMkObserver = null;

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

  function stripWeaponMkBadges() {
    const root =
      document.getElementById("adk-market-15");

    if (!root) return;

    for (const card of root.querySelectorAll(".item-card")) {
      const item = weaponItemForCard(card);

      if (item?.type !== "weapon") continue;

      card.classList.add("feha-weapon-card");

      for (const badge of card.querySelectorAll(".item-mk")) {
        badge.remove();
      }
    }
  }

  function installNoMkGuard() {
    if (noMkObserver) {
      stripWeaponMkBadges();
      return;
    }

    noMkObserver =
      new MutationObserver(() => {
        queueMicrotask(stripWeaponMkBadges);
      });

    noMkObserver.observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );

    stripWeaponMkBadges();
  }

  function removeNoMkGuard() {
    try {
      noMkObserver?.disconnect?.();
    } catch {}

    noMkObserver = null;
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
      currentVersion !== VERSION;

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
        VERSION
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
    patchMarketMacro,

    async init() {
      globalThis.FEHA_MARKET_STOCK_PATCH = api;
      game.adk ??= {};
      game.adk.marketStockPatch = api;

      installNoMkGuard();

      if (game.user?.isGM) {
        await patchMarketMacro();
      }

      stripWeaponMkBadges();
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
