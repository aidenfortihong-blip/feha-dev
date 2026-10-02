// FEHA // MARKET STOCK
// Gives vendors healthy, category-aware inventories instead of the Market
// module's 8-12 fully random items, and formats weapon cards in the Market.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_MARKET_STOCK_PATCH requires FEHA_CYBER_CORE.");

  const VERSION = "2.1.1";
  const STOCK_SCHEMA_VERSION = "2.0.0";
  const FLAG = "fleshEnshrouded";
  const PACKAGE = "flesh-enshrouded-heart-ablaze";
  const VERSION_KEY = "marketStockPatchVersionV1";
  const STOCK_KEY = "adkMarketStockV16";
  const MARKET_SYNC_EVENTS = ["click","input","change","keyup"];
  let marketClickSyncHandler = null;
  let marketSyncScheduled = false;
  let marketSyncRunning = false;
  const MARKET_STYLE_ID = "feha-market-weapon-description-style";

  // ---- Vendor stock ---------------------------------------------------------
  // The Market runs from the installed module
  // (scripts/legacy/market-legacy.js). Every time it opens it reads the world
  // setting "adkMarketStockV16" and only rolls its own stock (8-12 fully
  // random items, no guarantees, every weapon treated as Mk.I) for a
  // "shop:tier" key that is still empty. FEHA therefore owns vendor stock by
  // filling every key in that setting with stock built from the rules below,
  // and by handling REROLL STOCK itself.
  //
  // (Before 0.11.89 this file patched the source of a world Market macro. That
  // macro no longer exists, so none of these rules were being applied.)
  const VENDOR_STOCK_RULES = Object.freeze({
    street:{min:14,max:18,guarantee:{Weapons:3,Armor_Outer:2,Consumables:2}},
    arms:{min:16,max:20,guarantee:{Weapons:7,Armor_Outer:3,Grenades:3}},
    chrome:{min:12,max:16,guarantee:{Cyberware:8}},
    net:{min:14,max:18,guarantee:{Quickhacks:6,Cyberware:4}},
    black:{min:16,max:20,guarantee:{Weapons:4,Quickhacks:3,Cyberware:3,Grenades:2}},
    corporate:{min:14,max:18,guarantee:{Weapons:3,Armor_Outer:2,Cyberware:2}}
  });

  // Mirrors SHOP_TYPES in the module; used until the Market has been opened
  // once (ADKMarket.shops only exists after that).
  const SHOP_CATEGORIES = Object.freeze({
    street:["Weapons","Armor_Outer","Grenades","Consumables","Mods"],
    arms:["Weapons","Armor_Outer","Grenades","Mods"],
    chrome:["Cyberware"],
    net:["Quickhacks","Cyberware"],
    black:["Weapons","Armor_Outer","Grenades","Consumables","Mods","Cyberware","Quickhacks"],
    corporate:["Weapons","Armor_Outer","Grenades","Consumables","Mods","Cyberware","Quickhacks"]
  });

  const CATALOG_CATEGORIES = new Set([
    "Weapons","Armor_Outer","Grenades","Consumables","Mods","Cyberware","Quickhacks"
  ]);

  const NET_CYBERWARE_WORDS = [
    "cyberdeck","paraline","netdriver","tetratronic","raven","ram upgrade",
    "ex disk","neuro matrix","self ice","self-ice","neural defense","quickhack"
  ];

  const SHOP_TIERS = [1,2,3,4,5];

  const stockNorm = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const stockClamp = (value,min,max) =>
    Math.min(max,Math.max(min,Math.floor(Number(value) || min)));

  function stockCategory(item) {
    return String(item?.flags?.[FLAG]?.sourceCategory ?? "");
  }

  // Weapons have no Mk: their hidden marketBand gates which vendor tier may
  // sell them. Everything else uses its Mk.
  function stockTier(item) {
    const flags = item?.flags?.[FLAG] ?? {};
    return stockClamp(
      stockCategory(item) === "Weapons"
        ? (flags.marketBand ?? 1)
        : (flags.rating ?? flags.tier ?? 1),
      1,
      5
    );
  }

  function inCuratedFolder(item) {
    let folder = item?.folder ?? null;
    let guard = 0;

    while (folder && guard++ < 20) {
      const name = stockNorm(folder.name);
      if (name.includes("adk v10") && name.includes("curated")) return true;
      folder = folder.folder ?? null;
    }

    return false;
  }

  function isCatalogItem(item) {
    const flags = item?.flags?.[FLAG] ?? {};

    return (
      CATALOG_CATEGORIES.has(stockCategory(item)) &&
      (
        flags.curatedCatalogV10 === true ||
        flags.adkBuilder === true ||
        flags.adkGenerated === true ||
        Boolean(flags.sourcePath) ||
        Boolean(flags.weaponCatalogId) ||
        Boolean(flags.gearCatalogId) ||
        Boolean(flags.cyberwareId) ||
        inCuratedFolder(item)
      )
    );
  }

  function isNetCyberware(item) {
    const flags = item?.flags?.[FLAG] ?? {};
    const text = stockNorm(
      [item?.name,flags.cyberwareSlot,flags.archetype,flags.category]
        .filter(Boolean)
        .join(" ")
    );

    return NET_CYBERWARE_WORDS.some(word => text.includes(stockNorm(word)));
  }

  function shopCategories(shopKey) {
    return (
      globalThis.ADKMarket?.shops?.[shopKey]?.categories ??
      SHOP_CATEGORIES[shopKey] ??
      []
    );
  }

  function stockEligible(item,shopKey,shopTier) {
    if (!isCatalogItem(item)) return false;

    const category = stockCategory(item);
    if (!shopCategories(shopKey).includes(category)) return false;
    if (stockTier(item) > shopTier) return false;

    if (shopKey === "net" && category === "Cyberware" && !isNetCyberware(item)) {
      return false;
    }

    if (item.type === "weapon") {
      const flags = item.flags?.[FLAG] ?? {};
      if (flags.marketReady !== true) return false;

      const allowed = Array.isArray(flags.marketAllowedShops)
        ? flags.marketAllowedShops
        : ["street","arms","black","corporate"];

      if (!allowed.includes(shopKey)) return false;
    }

    return true;
  }

  // Items closer to the vendor's tier are more likely; marketStockWeight
  // carries rarity (unique weapons, five-tier grenade lines).
  function stockWeight(item,shopTier) {
    const rarity = Math.max(
      0.005,
      Number(item?.flags?.[FLAG]?.marketStockWeight ?? 1) || 1
    );
    const tierWeight = Math.max(
      1,
      5 - 2 * Math.max(0,shopTier - stockTier(item))
    );

    return Math.max(0.005,tierWeight * rarity);
  }

  function drawStockItem(candidates,shopTier,predicate=() => true) {
    const eligible = candidates
      .map((item,index) => ({item,index}))
      .filter(entry => predicate(entry.item));

    if (!eligible.length) return null;

    const weights = eligible.map(entry => stockWeight(entry.item,shopTier));
    let draw = Math.random() * weights.reduce((a,b) => a + b,0);
    let local = weights.findIndex(weight => (draw -= weight) < 0);
    if (local < 0) local = eligible.length - 1;

    return candidates.splice(eligible[local].index,1)[0] ?? null;
  }

  function buildStock(shopKey,shopTier) {
    const rule = VENDOR_STOCK_RULES[shopKey] ?? {min:12,max:16,guarantee:{}};
    const pool = (game.items?.contents ?? [])
      .filter(item => stockEligible(item,shopKey,shopTier));

    const span = Math.max(1,rule.max - rule.min + 1);
    const size = Math.min(
      pool.length,
      rule.min + Math.floor(Math.random() * span)
    );

    const candidates = [...pool];
    const selected = [];

    for (const [category,count] of Object.entries(rule.guarantee ?? {})) {
      for (let i = 0; i < count && selected.length < size; i++) {
        const item = drawStockItem(
          candidates,
          shopTier,
          candidate => stockCategory(candidate) === category
        );
        if (!item) break;
        selected.push(item);
      }
    }

    while (selected.length < size && candidates.length) {
      const item = drawStockItem(candidates,shopTier);
      if (!item) break;
      selected.push(item);
    }

    return selected.map(item => item.id);
  }

  function registerSettings() {
    if (!game.settings?.settings?.has?.(PACKAGE+"."+VERSION_KEY)) {
      game.settings.register(PACKAGE,VERSION_KEY,{
        name:"FEHA Market Stock Version",
        scope:"world",
        config:false,
        type:String,
        default:""
      });
    }

    // Same registration the Market module performs when it first opens.
    if (!game.settings?.settings?.has?.("world."+STOCK_KEY)) {
      game.settings.register("world",STOCK_KEY,{
        scope:"world",
        config:false,
        type:Object,
        default:{}
      });
    }
  }

  function readStock() {
    return foundry.utils.deepClone(
      game.settings.get("world",STOCK_KEY) || {}
    );
  }

  // Fill every shop:tier key the Market could ask for. Existing stock is kept
  // (it is finite: bought items stay gone until the GM rerolls); a key is only
  // rebuilt when it is empty, or once for everything when the stock rules
  // change (STOCK_SCHEMA_VERSION).
  async function ensureStock({force=false}={}) {
    if (!game.user?.isGM) {
      return {skipped:true,built:0,pruned:0};
    }

    registerSettings();

    const schemaChanged =
      String(game.settings.get(PACKAGE,VERSION_KEY) ?? "") !==
      STOCK_SCHEMA_VERSION;

    const stock = readStock();
    let built = 0;
    let pruned = 0;

    for (const shopKey of Object.keys(VENDOR_STOCK_RULES)) {
      for (const shopTier of SHOP_TIERS) {
        const key = shopKey+":"+shopTier;
        const previous = Array.isArray(stock[key]) ? stock[key] : [];
        const alive = previous.filter(id => game.items?.has?.(id));

        if (force || schemaChanged || !alive.length) {
          stock[key] = buildStock(shopKey,shopTier);
          built++;
        } else if (alive.length !== previous.length) {
          stock[key] = alive;
          pruned++;
        }
      }
    }

    if (built || pruned) {
      await game.settings.set("world",STOCK_KEY,stock);
    }

    if (schemaChanged) {
      await game.settings.set(PACKAGE,VERSION_KEY,STOCK_SCHEMA_VERSION);
    }

    const result = {
      skipped:false,
      built,
      pruned,
      schema:STOCK_SCHEMA_VERSION,
      version:VERSION
    };

    console.log("FEHA MARKET STOCK",result);
    return result;
  }

  // REROLL STOCK for the shop on screen. The module keeps its stock cache in
  // a closure that is only read when the Market opens, so the new stock is
  // saved and the Market reopened on the same shop.
  async function rerollShop(shopKey,shopTier) {
    if (!game.user?.isGM) {
      ui.notifications?.warn?.("Only the GM can reroll vendor stock.");
      return null;
    }

    if (!VENDOR_STOCK_RULES[shopKey]) return null;

    registerSettings();

    const key = shopKey+":"+shopTier;
    const stock = readStock();
    const previous = Array.isArray(stock[key]) ? stock[key] : [];

    let next = buildStock(shopKey,shopTier);
    for (let attempt = 0; attempt < 20; attempt++) {
      if (next.some(id => !previous.includes(id))) break;
      next = buildStock(shopKey,shopTier);
    }

    stock[key] = next;
    await game.settings.set("world",STOCK_KEY,stock);

    return next;
  }

  // A player's purchase cannot save the reduced stock itself (world settings
  // are GM-only; the module logs the failure and moves on), so the item stayed
  // on the shelf. The active GM removes it when the purchased copy appears.
  let purchaseHookId = null;

  async function onMarketPurchase(item) {
    if (game.users?.activeGM?.isSelf !== true) return;
    if (item?.parent?.documentName !== "Actor") return;

    const flags = item.flags?.[FLAG] ?? {};
    if (flags.marketPurchased !== true || !flags.marketSourceId) return;
    if (!flags.marketShop || !flags.marketShopTier) return;

    // A copy of a bought item keeps the purchase flags; only a buy stamped in
    // the last ten minutes takes the item off the shelf.
    const boughtAt = Date.parse(flags.marketPurchasedAt ?? "");
    if (!Number.isFinite(boughtAt) || Math.abs(Date.now() - boughtAt) > 600000) return;

    try {
      registerSettings();

      const key = flags.marketShop+":"+flags.marketShopTier;
      const stock = readStock();
      const current = Array.isArray(stock[key]) ? stock[key] : [];
      if (!current.includes(flags.marketSourceId)) return;

      stock[key] = current.filter(id => id !== flags.marketSourceId);
      await game.settings.set("world",STOCK_KEY,stock);
    } catch (error) {
      console.warn("FEHA MARKET STOCK // purchase stock update failed",error);
    }
  }

  async function onRerollClick(event) {
    const button =
      event.target?.closest?.("#adk-market-15 #reroll-stock") ?? null;
    if (!button) return;

    // Replace the module's handler (8-12 fully random items).
    event.preventDefault();
    event.stopImmediatePropagation();

    const state = globalThis.ADKMarket?.state ?? null;
    if (!state?.shop) return;

    try {
      const next = await rerollShop(state.shop,state.shopTier);
      if (!next) return;

      globalThis.ADKMarket?.close?.();
      await game.adk?.openMarket?.();
      scheduleMarketSyncBurst();
    } catch (error) {
      console.error("FEHA MARKET STOCK // reroll failed",error);
      ui.notifications?.error?.("Vendor stock reroll failed. Check console.");
    }
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

    const handling =
      globalThis.FEHA_WEAPON_HANDLING?.profile?.(def ?? item) ?? null;
    const reach = Boolean(def?.reach && !def?.range);
    const strength =
      Number(def?.strengthRequirement ?? f.strengthRequirement ?? 0) || 0;

    // Fixed stat grid: every weapon card shows the same slots in the same
    // order so cards can be compared at a glance.
    const stats = [
      {label:"DMG",value:damage},
      reach
        ? {label:"REACH",value:String(def.reach)+" FT"}
        : {label:"RANGE",value:marketRangeText(def,item)},
      reach
        ? {
            label:"THROWN",
            value:def?.thrownRange != null
              ? String(def.thrownRange)+(def?.thrownLong != null ? "/"+String(def.thrownLong) : "")+" FT"
              : "—"
          }
        : {label:"MAG",value:attacks > 0 ? String(attacks) : "—"},
      {
        label:"RELOAD",
        value:isMelee || reach
          ? "—"
          : handling?.reloadLabel ?? (reload > 0 ? reload+" PT"+(reload===1?"":"S") : "—")
      },
      {label:"STR",value:strength ? String(strength) : "—"}
    ];

    // Rules that matter at the table, in one consistent style: manufacturer
    // trait, then the weapon's own special/unique effect.
    const clean = text => String(text ?? "")
      .replace(/\s*Track this manually\.?\s*$/i,"")
      .replace(/\s+/g," ")
      .trim();

    const traits = [];
    if (def?.familyTraitName || def?.familyTraitText) {
      traits.push({
        kind:"maker",
        name:String(def.familyTraitName ?? "TRAIT"),
        text:clean(def.familyTraitText)
      });
    }
    for (const raw of [def?.effect,def?.special]) {
      const extra = typeof raw === "string" ? {text:raw} : raw;
      if (!extra?.text) continue;
      traits.push({
        kind:"special",
        name:String(extra.name ?? "SPECIAL"),
        text:clean(extra.text)
      });
    }
    if (!traits.length && f.effectText) {
      traits.push({kind:"special",name:"SPECIAL",text:clean(f.effectText)});
    }

    return {
      stats,
      traits,
      weaponClass,
      manufacturer:String(
        def?.company ??
        f.manufacturer ??
        f.company ??
        ""
      )
    };
  }

  // Structural rules only; the look lives in market-cp.css.
  const MARKET_WEAPON_CSS = `
      #adk-market-15 .feha-weapon-card {
        height:auto !important;
        min-height:0 !important;
        max-height:none !important;
      }

      #adk-market-15 .feha-weapon-card .item-actions,
      #adk-market-15 .feha-weapon-card .card-actions,
      #adk-market-15 .feha-weapon-card .actions {
        position:static !important;
        inset:auto !important;
        margin-top:auto !important;
      }

      #adk-market-15 .feha-market-weapon-copy {
        width:100%;
        margin:0;
      }

      #adk-market-15 .feha-market-weapon-stats {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        margin:0;
      }

      #adk-market-15 .feha-mws-stat {
        min-width:0;
        margin:0;
      }

      #adk-market-15 .feha-mws-stat dd {
        margin:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      #adk-market-15 .feha-mws-trait p {
        margin:0;
        display:-webkit-box;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:3;
        overflow:hidden;
      }
    `;

  function ensureMarketWeaponStyles() {
    let style = document.getElementById(MARKET_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = MARKET_STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== MARKET_WEAPON_CSS) {
      style.textContent = MARKET_WEAPON_CSS;
    }
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
      stats:copy.stats,
      traits:copy.traits
    });
  }

  function weaponSummaryElement(item) {
    const copy = marketWeaponCopy(item);
    const node = document.createElement("div");
    node.className = "feha-market-weapon-copy";
    node.dataset.fehaWeaponDescription = String(item?.id ?? "");
    node.dataset.fehaWeaponSignature = weaponSummarySignature(item);

    const stats = document.createElement("dl");
    stats.className = "feha-market-weapon-stats";

    for (const stat of copy.stats) {
      const cell = document.createElement("div");
      cell.className = "feha-mws-stat";
      if (stat.value === "—") cell.classList.add("is-empty");
      const dt = document.createElement("dt");
      dt.textContent = stat.label;
      const dd = document.createElement("dd");
      dd.textContent = stat.value;
      cell.append(dt,dd);
      stats.appendChild(cell);
    }

    node.appendChild(stats);

    for (const trait of copy.traits) {
      const box = document.createElement("div");
      box.className = "feha-mws-trait is-"+trait.kind;
      // Full rule on hover; the card clamps it to keep cards even.
      box.title = trait.name+": "+trait.text;
      const name = document.createElement("strong");
      name.textContent = trait.name;
      const text = document.createElement("p");
      text.textContent = trait.text;
      box.append(name,text);
      node.appendChild(box);
    }

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

        // Rarity drives the CP2077 skin's card stripe (market-cp.css).
        const rarity = String(item?.system?.rarity ?? "");
        if (rarity && card.dataset.fehaRarity !== rarity) {
          card.dataset.fehaRarity = rarity;
        }

        // The module labels cyberware "BUY + INSTALL", but a purchase only
        // stashes it; installing happens in the Chrome Manager.
        for (const buy of card.querySelectorAll("[data-buy-item]")) {
          if (buy.textContent.trim() === "BUY + INSTALL") {
            buy.textContent = "BUY";
            buy.title = "Goes to your stash. Install it in the Chrome Manager.";
          }
        }

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

        // The weapon's special now lives in the summary's trait box.
        for (const node of card.querySelectorAll(".item-effect")) {
          node.remove();
        }

        // Tags: the generic WEAPONS chip becomes the weapon class.
        const tags = card.querySelector(".item-tags");
        if (tags) {
          const cls = marketWeaponCopy(item).weaponClass;
          for (const tag of [...tags.children]) {
            if (/^weapons?$/i.test(tag.textContent.trim())) tag.remove();
          }
          if (cls && !tags.querySelector(".feha-mws-class")) {
            const chip = document.createElement("span");
            chip.className = "feha-mws-class";
            chip.textContent = cls;
            tags.prepend(chip);
          }
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

      // Clicks cover shop switching and buttons. Typing in the search box
      // and opening the Market from a hotbar key rerender it without a
      // click, which left cards unformatted until the next click.
      for (const type of MARKET_SYNC_EVENTS) {
        document.addEventListener(
          type,
          marketClickSyncHandler,
          true
        );
      }
    }

    scheduleMarketSyncBurst();
  }

  function removeNoMkGuard() {
    if (marketClickSyncHandler) {
      for (const type of MARKET_SYNC_EVENTS) {
        document.removeEventListener(
          type,
          marketClickSyncHandler,
          true
        );
      }
      marketClickSyncHandler = null;
    }

    marketSyncScheduled = false;
    marketSyncRunning = false;
    document.getElementById(MARKET_STYLE_ID)?.remove?.();
  }

  const api = {
    version:VERSION,
    stockSchemaVersion:STOCK_SCHEMA_VERSION,
    ensureStock,
    rerollShop,
    buildStock,
    syncWeaponMarketCards,
    marketWeaponCopy,

    async init() {
      globalThis.FEHA_MARKET_STOCK_PATCH = api;
      game.adk ??= {};
      game.adk.marketStockPatch = api;

      installNoMkGuard();
      document.addEventListener("click",onRerollClick,true);

      if (purchaseHookId == null) {
        purchaseHookId = Hooks.on("createItem",onMarketPurchase);
      }

      if (game.user?.isGM) {
        // Price / rarity flags must exist before stock is built.
        try {
          await globalThis.FEHA_WEAPON_ECONOMY?.migrateAll?.();
        } catch (error) {
          console.warn(
            "FEHA MARKET STOCK // weapon economy pre-stock migration failed",
            error
          );
        }

        try {
          await ensureStock();
        } catch (error) {
          console.warn("FEHA MARKET STOCK // stock build failed",error);
        }
      }

      syncWeaponMarketCards();
    },

    async destroy() {
      removeNoMkGuard();
      document.removeEventListener("click",onRerollClick,true);

      if (purchaseHookId != null) {
        try { Hooks.off("createItem",purchaseHookId); } catch {}
        purchaseHookId = null;
      }
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
