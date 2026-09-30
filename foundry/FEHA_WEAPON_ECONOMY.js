// FEHA // WEAPON ECONOMY
// Prices every firearm, melee weapon, and true unique from the completed 1-100
// power audit. Weapons still have no Mk: marketBand is hidden vendor gating only.
(() => {
  try { globalThis.FEHA_WEAPON_ECONOMY?.destroy?.(); } catch {}

  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";

  const GUN_RATINGS = Object.freeze({"Breachhound":42,"Crusher":52,"Hexburst":55,"Igla":46,"Lexington":40,"Liberty":45,"Overture":55,"Saratoga":56,"Tactician":57,"Umbra":60,"Unity":30,"Warwake":67,"Ashura":62,"Dian":50,"Kyokokukamusari":51,"Masamune":49,"Metel":56,"Palica":48,"Razor Choir":83,"Borg4a":72,"Burya":57,"Carnage":63,"Deadrail":61,"Defender":72,"Grad":81,"Iron Psalm":63,"Mirefang":49,"Monarch Zero":86,"Nova":53,"Osprey Prototype":77,"Watchtower":70,"Arcspike":46,"Cinderjack":43,"Grit":31,"Guillotine":63,"Kappa":47,"Omaha":37,"Quasar":41,"Senkoh":44,"Shingen":43,"Starforge":60,"Ticon":37,"Triskelion":46,"Twin Viper":64,"Warden":44,"Achilles":59,"Black Requiem":84,"Choirbreaker":73,"Gravetide":62,"Hercules Prototype":67,"HMG":75,"MA70":74,"Nekomata":83,"Nemora":58,"Nullstorm":65,"Rasetsu Prototype":97,"Satara":62,"Sunlance":77,"Testera":67,"Trucebreaker":61,"Chao":34,"Cinder-20":28,"Copperhead":48,"Dreadline":54,"Kenshin":29,"Quickscar":50,"Quietus":39,"Sidewinder":43,"Yukimura":34,"Ajax":50,"Arcflash":43,"Kolac":50,"Kyubi":42,"Long Vigil":65,"Pale Kestrel":43,"Pozhar":46,"Pulsar":48,"Red Wisp":53});
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

  async function migrateItem(item) {
    const p = profile(item);
    if (!p) return false;

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