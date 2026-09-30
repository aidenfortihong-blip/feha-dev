// FEHA // WEAPON ECONOMY
// Prices every firearm, melee weapon, and true unique from the completed 1-100
// power audit. Weapons still have no Mk: marketBand is hidden vendor gating only.
(() => {
  try { globalThis.FEHA_WEAPON_ECONOMY?.destroy?.(); } catch {}

  const VERSION = "1.2.1";
  const FLAG = "fleshEnshrouded";
  const POWER_AUDIT = "manufacturer-passives-manual-simplification-2026-09-30";
  // Manufacturer passives are intentionally player-tracked. Current weapon
  // power ratings/prices are retained for this cleanup build; Corvus' simplified
  // Cyberdeck-gated RAM recovery will be rechecked during the post-cyberware
  // balance regression once Cyberdeck Mk/RAM values are final.

  const GUN_RATINGS = Object.freeze({"Breachhound":47,"Crusher":62,"Hexburst":63,"Igla":52,"Lexington":44,"Liberty":50,"Overture":63,"Saratoga":64,"Tactician":70,"Umbra":69,"Unity":33,"Warwake":83,"Ashura":67,"Dian":56,"Kyokokukamusari":57,"Masamune":55,"Metel":62,"Palica":55,"Razor Choir":85,"Borg4a":78,"Burya":63,"Carnage":69,"Deadrail":67,"Defender":80,"Grad":87,"Iron Psalm":71,"Mirefang":54,"Monarch Zero":92,"Nova":59,"Osprey Prototype":84,"Watchtower":76,"Arcspike":48,"Cinderjack":45,"Grit":33,"Guillotine":64,"Kappa":48,"Omaha":38,"Quasar":42,"Senkoh":45,"Shingen":45,"Starforge":62,"Ticon":38,"Triskelion":47,"Twin Viper":65,"Warden":45,"Achilles":61,"Black Requiem":90,"Choirbreaker":79,"Gravetide":66,"Hercules Prototype":70,"HMG":82,"MA70":80,"Nekomata":88,"Nemora":60,"Nullstorm":68,"Rasetsu Prototype":100,"Satara":66,"Sunlance":82,"Testera":72,"Trucebreaker":65,"Chao":43,"Cinder-20":38,"Copperhead":56,"Dreadline":61,"Kenshin":39,"Quickscar":57,"Quietus":41,"Sidewinder":51,"Yukimura":43,"Ajax":62,"Arcflash":59,"Kolac":65,"Kyubi":56,"Long Vigil":76,"Pale Kestrel":59,"Pozhar":61,"Pulsar":62,"Red Wisp":65});
  const MELEE_RATINGS = Object.freeze({"Baseball Bat":29,"Baton Beta":26,"Baton Murphy":35,"Baton Tinker Bell":26,"Butcher's Knife":29,"Cane Fingers":21,"Chainsword Legendary":81,"Chef's Knife":21,"Crowbar":26,"Dildo Stout":84,"Errata":88,"Fanged Axe Military":48,"Hammer":39,"Iron Pipe":26,"Kanabo":53,"Katana":44,"Katana Go G":44,"Katana Takemura":54,"Knife Kurtz":29,"Knife Military":29,"Knife Stinger":29,"Kukri":35,"Kukri Voodoo":35,"Machete":35,"Machete Maelstrom":41,"Machete Valentinos":43,"Neurotoxin Knife":45,"Punk Knife Pimp":29,"Sword Witcher":49,"Tanto":29,"Tire Iron":26,"Tomahawk":42,"VB Axe":57});
  const UNIQUE_RATINGS = Object.freeze({"Ghost Key":67,"Igla Sovereign":88,"Motor Lock":73,"Optic Zero":52,"Shovel Caretaker":10,"Silverhand 3516":92,"Slaughtomatic":1});

  const ICONIC = Object.freeze({
    "Rasetsu Prototype":{weight:0.06,priceMult:1.35,minBand:5,rarity:"prototype"},
    "Osprey Prototype":{weight:0.12,priceMult:1.25,minBand:5,rarity:"prototype"},
    "Hercules Prototype":{weight:0.14,priceMult:1.20,minBand:4,rarity:"prototype"},
    "Monarch Zero":{weight:0.15,priceMult:1.25,minBand:5,rarity:"iconic"},
    "Black Requiem":{weight:0.12,priceMult:1.30,minBand:5,rarity:"iconic"},
    "Razor Choir":{weight:0.18,priceMult:1.20,minBand:5,rarity:"iconic"},
    "Errata":{weight:0.04,priceMult:1.60,minBand:5,rarity:"iconic"},
    "Chainsword Legendary":{weight:0.05,priceMult:1.50,minBand:5,rarity:"iconic"},
    "Dildo Stout":{weight:0.06,priceMult:1.35,minBand:5,rarity:"iconic"},
    "Neurotoxin Knife":{weight:0.20,priceMult:1.20,minBand:3,rarity:"rare"}
  });

  const UNIQUE_OVERRIDES = Object.freeze({
    "Ghost Key":{weight:0.025,priceMult:1.80,minBand:4},
    "Igla Sovereign":{weight:0.010,priceMult:2.00,minBand:5},
    "Motor Lock":{weight:0.020,priceMult:1.80,minBand:4},
    "Optic Zero":{weight:0.030,priceMult:1.70,minBand:4},
    "Shovel Caretaker":{weight:0.015,priceMult:3.50,minBand:4},
    "Silverhand 3516":{weight:0.005,priceMult:2.25,minBand:5},
    "Slaughtomatic":{weight:0.040,priceMult:4.00,minBand:4}
  });

  const norm = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  const same = (a,b) => {
    try { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); }
    catch { return a === b; }
  };

  function ancestorNames(item) {
    const names = [];
    let folder = item?.folder ?? null;
    let guard = 0;
    while (folder && guard++ < 50) {
      names.push(String(folder?.name ?? "").trim().toLowerCase());
      folder = folder?.folder ?? folder?.parent ?? null;
    }
    return names;
  }

  function kind(item) {
    if (!item || item.type !== "weapon") return null;
    const flags = item.flags?.[FLAG] ?? {};
    const folders = ancestorNames(item);
    const name = String(item.name ?? "");

    if (
      flags.uniqueWeapon === true ||
      folders.some(x => ["-other","other","-unique","unique"].includes(x))
    ) {
      return UNIQUE_RATINGS[name] != null ? "unique" : null;
    }

    if (
      flags.meleeWeapon === true ||
      folders.some(x => ["melee","-melee"].includes(x))
    ) {
      return MELEE_RATINGS[name] != null ? "melee" : null;
    }

    if (
      flags.weaponCatalogKey ||
      flags.doTheseFinalized === true ||
      GUN_RATINGS[name] != null
    ) {
      return GUN_RATINGS[name] != null ? "gun" : null;
    }

    return null;
  }

  function powerRating(item) {
    const k = kind(item);
    if (k === "unique") return UNIQUE_RATINGS[item.name] ?? null;
    if (k === "melee") return MELEE_RATINGS[item.name] ?? null;
    if (k === "gun") return GUN_RATINGS[item.name] ?? null;
    return null;
  }

  function baseBand(rating) {
    if (rating <= 29) return 1;
    if (rating <= 44) return 2;
    if (rating <= 59) return 3;
    if (rating <= 74) return 4;
    return 5;
  }

  function basePrice(rating) {
    // Smooth curve from cheap street junk to elite military hardware.
    const raw = 150 + 7 * Math.pow(Math.max(1,rating),1.75);
    return Math.max(100,Math.round(raw / 50) * 50);
  }

  function profile(item) {
    const k = kind(item);
    const rating = powerRating(item);
    if (!k || rating == null) return null;

    let rarity = "standard";
    let weight = 1;
    let priceMult = 1;
    let minBand = 1;
    let allowedShops = ["street","arms","black","corporate"];

    const iconic = ICONIC[item.name] ?? null;
    if (iconic) {
      rarity = iconic.rarity ?? "iconic";
      weight = iconic.weight ?? weight;
      priceMult = iconic.priceMult ?? priceMult;
      minBand = iconic.minBand ?? minBand;
      allowedShops = ["arms","black","corporate"];
    }

    if (k === "unique") {
      const unique = UNIQUE_OVERRIDES[item.name] ?? {};
      rarity = "unique";
      weight = unique.weight ?? 0.02;
      priceMult = unique.priceMult ?? 1.8;
      minBand = unique.minBand ?? 4;
      allowedShops = ["arms","black","corporate"];
    }

    const marketBand = Math.max(baseBand(rating),minBand);
    const price = Math.max(
      100,
      Math.round((basePrice(rating) * priceMult) / 50) * 50
    );

    return {
      kind:k,
      rating,
      price,
      marketBand,
      rarity,
      weight,
      allowedShops
    };
  }

  function legacyIdentifierQuarantined(item) {
    if (item?.type !== "weapon") return false;

    const build = Number(game.release?.build ?? 0);
    if (build >= 368) return false;

    const root = item?._source?.system;
    if (!root || typeof root !== "object") return false;

    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      if (!current || typeof current !== "object") continue;

      for (const [key,value] of Object.entries(current)) {
        if (key === "identifier") {
          const text = String(value ?? "");
          if (!/^[a-z0-9_-]+$/i.test(text)) return true;
        }

        if (value && typeof value === "object") stack.push(value);
      }
    }

    return false;
  }

  async function migrateItem(item) {
    const p = profile(item);
    if (!p) return false;
    if (legacyIdentifierQuarantined(item)) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const update = {};

    const values = {
      powerRating:p.rating,
      marketBand:p.marketBand,
      marketPrice:p.price,
      priceCredits:p.price,
      marketRarity:p.rarity,
      marketStockWeight:p.weight,
      marketAllowedShops:p.allowedShops,
      marketReady:true,
      catalogEnabled:true,
      sourceCategory:"Weapons",
      marketCategory:"Weapons",
      shopType:"arms",
      noMk:true
    };

    for (const [key,value] of Object.entries(values)) {
      if (!same(flags[key],value)) {
        update["flags."+FLAG+"."+key] = value;
      }
    }

    if (
      item.system?.price &&
      Number(item.system.price.value ?? 0) !== Number(p.price)
    ) {
      update["system.price.value"] = p.price;
    }

    if (
      item.system?.price &&
      String(item.system.price.denomination ?? "") !== "gp"
    ) {
      update["system.price.denomination"] = "gp";
    }

    if (!Object.keys(update).length) return false;
    await item.update(update);
    return true;
  }

  async function migrateAll() {
    if (!game.user?.isGM) {
      return {skipped:true,world:0,owned:0,total:0};
    }

    let world = 0;
    let owned = 0;
    let total = 0;

    for (const item of list(game.items)) {
      if (!profile(item)) continue;
      total++;
      try { if (await migrateItem(item)) world++; }
      catch (error) {
        console.warn("FEHA WEAPON ECONOMY // world migration failed",item?.name,error);
      }
    }

    for (const actor of list(game.actors)) {
      for (const item of list(actor.items)) {
        if (!profile(item)) continue;
        try { if (await migrateItem(item)) owned++; }
        catch (error) {
          console.warn("FEHA WEAPON ECONOMY // owned migration failed",actor?.name,item?.name,error);
        }
      }
    }

    try { globalThis.ADKMarket?.refresh?.(); } catch {}

    const result = {skipped:false,world,owned,total,version:VERSION};
    console.log("FEHA WEAPON ECONOMY",result);
    return result;
  }

  const api = {
    version:VERSION,
    gunRatings:GUN_RATINGS,
    meleeRatings:MELEE_RATINGS,
    uniqueRatings:UNIQUE_RATINGS,
    kind,
    powerRating,
    profile,
    migrateItem,
    migrateAll,
    destroy() {
      if (globalThis.FEHA_WEAPON_ECONOMY === api) delete globalThis.FEHA_WEAPON_ECONOMY;
      if (game?.adk?.weaponEconomy === api) delete game.adk.weaponEconomy;
    }
  };

  game.adk ??= {};
  game.adk.weaponEconomy = api;
  globalThis.FEHA_WEAPON_ECONOMY = api;
  console.log(
    "FEHA WEAPON ECONOMY",
    VERSION,
    "ready //",
    Object.keys(GUN_RATINGS).length,
    "guns //",
    Object.keys(MELEE_RATINGS).length,
    "melee //",
    Object.keys(UNIQUE_RATINGS).length,
    "unique"
  );
})();