// FEHA // UNIQUE WEAPON CATALOG
// Canonical pass for the seven one-off weapons kept in Do these/-Other.
// These are intentionally separate from the permanent 78-gun manufacturer catalog
// and are never inserted into normal random Market stock.
(() => {
  try { globalThis.FEHA_UNIQUE_WEAPON_CATALOG?.destroy?.(); } catch {}

  const VERSION = "1.0.2";
  const REWRITE = "unique-1.0-c";
  const FLAG = "fleshEnshrouded";
  const ROOT_NAME = "Do these";
  const UNIQUE_FOLDERS = new Set(["-other","other","-unique","unique"]);

  const DEFINITIONS = Object.freeze([
    {
      key:"ghost-key",
      name:"Ghost Key",
      weaponClass:"DMR",
      damage:"4d10+8",
      damageType:"piercing",
      range:120,
      longRange:300,
      physicalCapacity:6,
      functionalAttacks:6,
      reloadActions:2,
      strengthRequirement:11,
      technology:"Tech",
      typeValue:"martialR",
      effect:{
        key:"ghost-key",
        name:"GHOST KEY",
        text:"A hit against a door or electronic lock shorts its locking mechanism and immediately unlocks and opens it. It cannot open a barrier that is physically impossible to move or explicitly plot-sealed.",
        automation:"manual",
        doorShort:true
      }
    },
    {
      key:"igla-sovereign",
      name:"Igla Sovereign",
      weaponClass:"Shotgun",
      damage:"40d2",
      damageType:"piercing",
      range:15,
      longRange:30,
      physicalCapacity:2,
      functionalAttacks:2,
      reloadActions:2,
      strengthRequirement:15,
      technology:"Power",
      typeValue:"martialR",
      effect:{
        key:"sovereign-overload",
        name:"SOVEREIGN OVERLOAD",
        text:"This outlaw double-barrel can be pushed into an overload cycle. Declare Overload before firing: the weapon can make up to 6 full-power shots without reloading. After the sixth overload shot, or when the overload cycle is ended early, the weapon enters COOLING and cannot fire until the end of your next turn. It cannot be reloaded while overloaded.",
        automation:"manual",
        overloadShots:6,
        cooldownTurns:1
      }
    },
    {
      key:"motor-lock",
      name:"Motor Lock",
      weaponClass:"DMR",
      damage:"5d10+6",
      damageType:"piercing",
      range:150,
      longRange:500,
      physicalCapacity:5,
      functionalAttacks:5,
      reloadActions:2,
      strengthRequirement:12,
      technology:"Tech",
      typeValue:"martialR",
      effect:{
        key:"dead-stop",
        name:"DEAD STOP",
        text:"When a shot from Motor Lock hits a vehicle, the vehicle is stopped dead: its speed immediately becomes 0 and its drive system is disabled until the end of the shooter's next turn. Explicitly hardened or plot-critical vehicles may require GM adjudication.",
        automation:"manual",
        vehicleStop:true,
        disabledTurns:1
      }
    },
    {
      key:"optic-zero",
      name:"Optic Zero",
      weaponClass:"Pistol",
      damage:"4d6",
      damageType:"piercing",
      range:40,
      longRange:100,
      physicalCapacity:12,
      functionalAttacks:4,
      reloadActions:1,
      strengthRequirement:null,
      technology:"Smart",
      typeValue:"martialR",
      effect:{
        key:"zero-sight",
        name:"ZERO SIGHT",
        text:"Once per turn on a hit against a target using cybernetic eyes, cameras, a visor, or other electronic optics, you may zero its vision. The target is Blinded until the end of its next turn. Targets with no electronic or cybernetic visual system are unaffected by this rider.",
        automation:"manual",
        blindsOptics:true,
        blindTurns:1
      }
    },
    {
      key:"shovel-caretaker",
      name:"Shovel Caretaker",
      weaponClass:"Shovel",
      damage:"1d6",
      damageType:"bludgeoning",
      range:5,
      longRange:null,
      physicalCapacity:null,
      functionalAttacks:null,
      reloadActions:null,
      strengthRequirement:null,
      technology:"Melee",
      typeValue:"simpleM",
      effect:null
    },
    {
      key:"silverhand-3516",
      name:"Silverhand 3516",
      weaponClass:"Heavy Pistol",
      damage:"1d30+75",
      damageType:"piercing",
      range:60,
      longRange:180,
      physicalCapacity:6,
      functionalAttacks:6,
      reloadActions:2,
      strengthRequirement:18,
      technology:"Power",
      typeValue:"martialR",
      effect:{
        key:"gorilla-frame",
        name:"GORILLA FRAME",
        text:"Best-in-slot hand cannon. The recoil and frame impulse are beyond an unaugmented arm: Silverhand 3516 cannot be fired unless the wielder has Gorilla Arms installed. With Gorilla Arms, the requirement is fully satisfied.",
        automation:"manual",
        requiresCyberware:"Gorilla Arms"
      }
    },
    {
      key:"slaughtomatic",
      name:"Slaughtomatic",
      weaponClass:"Pistol",
      damage:"100d100-9000",
      damageType:"piercing",
      range:30,
      longRange:60,
      physicalCapacity:12,
      functionalAttacks:12,
      reloadActions:0,
      strengthRequirement:null,
      technology:"Power",
      typeValue:"martialR",
      effect:{
        key:"murder-lottery",
        name:"MURDER LOTTERY",
        text:"Damage is 100d100 - 9000. A total below 0 deals 0 damage. The weapon is a sealed disposable: it holds 12 shots, cannot be reloaded, and becomes junk after its final shot.",
        automation:"manual",
        minimumDamage:0,
        sealedDisposable:true
      }
    }
  ]);

  const norm = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const slug = value => norm(value).replace(/\s+/g,"-");
  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };
  const esc = value => String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
  const same = (a,b) => {
    try { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); }
    catch { return a === b; }
  };

  const byName = new Map(DEFINITIONS.map(d => [norm(d.name),d]));
  const byKey = new Map(DEFINITIONS.map(d => [norm(d.key),d]));

  function definition(value) {
    if (!value) return null;
    if (typeof value === "string") return byKey.get(norm(value)) ?? byName.get(norm(value)) ?? null;
    return byName.get(norm(value.name)) ?? null;
  }

  function ancestorChain(folder) {
    const chain = [];
    let current = folder;
    let guard = 0;
    while (current && guard++ < 50) {
      chain.push(current);
      current = current.folder ?? current.parent ?? null;
    }
    return chain;
  }

  function isUniqueSource(item) {
    if (!item?.folder) return false;
    const chain = ancestorChain(item.folder);
    // The actual world authority is the unique folder itself. Do not require
    // it to be nested under Do these; the user's current world keeps -Other
    // as its own folder.
    return chain.some(
      f => UNIQUE_FOLDERS.has(
        String(f?.name ?? "").trim().toLowerCase()
      )
    );
  }

  function rangeText(d) {
    return d.longRange == null ? String(d.range)+" ft" : String(d.range)+"/"+String(d.longRange)+" ft";
  }

  function rewriteDescription(d) {
    const capacity = d.physicalCapacity == null ? "—" : String(d.physicalCapacity);
    const attacks = d.functionalAttacks == null ? "—" : String(d.functionalAttacks);
    const reload = d.reloadActions == null ? "—" : (String(d.reloadActions)+" action"+(d.reloadActions===1?"":"s"));
    const strength = d.strengthRequirement == null ? "—" : String(d.strengthRequirement);
    const effect = d.effect
      ? '<div style="margin-top:12px;padding:11px;border:1px solid #7f6323;background:#181205"><small style="display:block;color:#ffd35a;font-size:10px;font-weight:900;letter-spacing:.13em;margin-bottom:6px">UNIQUE EFFECT // '+esc(d.effect.name)+'</small><p style="margin:0;line-height:1.5;color:#fff1bd !important">'+esc(d.effect.text)+'</p></div>'
      : '<div style="margin-top:12px;padding:11px;border:1px solid #3e4b50;background:#0b1114"><small style="display:block;color:#9aaab0;font-size:10px;font-weight:900;letter-spacing:.13em;margin-bottom:6px">UNIQUE EFFECT</small><p style="margin:0;color:#c7d0d3 !important">None. It is a shovel.</p></div>';

    return '<section data-feha-unique-weapon-card="'+REWRITE+'" style="border:1px solid #80651f;background:#090d10;padding:13px 14px;color:#e7eef0 !important">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:9px;border-bottom:1px solid #40391f"><small style="color:#ffd35a;font-size:10px;font-weight:900;letter-spacing:.12em">FEHA // UNIQUE WEAPON</small><strong style="color:#fff3bd;font-size:12px">ONE-OFF</strong></div>'+
      '<h2 style="margin:10px 0 4px;color:#fff">'+esc(d.name)+'</h2>'+
      '<p style="margin:0 0 11px;font-size:11px;color:#9dafb5 !important">One-off hardware. Extremely rare and normally found only through high-tier specialist, black-market, or corporate stock.</p>'+
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px;padding:10px 0;border-top:1px solid #263238;border-bottom:1px solid #263238">'+
      '<div><small>CLASS</small><br><strong>'+esc(d.weaponClass)+'</strong></div>'+
      '<div><small>DAMAGE</small><br><strong>'+esc(d.damage)+'</strong></div>'+
      '<div><small>RANGE</small><br><strong>'+esc(rangeText(d))+'</strong></div>'+
      '<div><small>CAPACITY</small><br><strong>'+esc(capacity)+'</strong></div>'+
      '<div><small>ATTACKS / LOAD</small><br><strong>'+esc(attacks)+'</strong></div>'+
      '<div><small>RELOAD</small><br><strong>'+esc(reload)+'</strong></div>'+
      '<div><small>SYSTEM</small><br><strong>'+esc(d.technology)+'</strong></div>'+
      '<div><small>STR</small><br><strong>'+esc(strength)+'</strong></div>'+
      '<div><small>RARITY</small><br><strong style="color:#ffd35a">EXTREMELY RARE</strong></div>'+
      '</div>'+effect+'</section>';
  }

  function flagValues(d) {
    return {
      uniqueWeapon:true,
      uniqueWeaponKey:d.key,
      uniqueWeaponCatalogVersion:VERSION,
      uniqueWeaponRewriteVersion:REWRITE,
      manufacturer:"Unique",
      company:"Unique",
      weaponGroup:"Unique",
      weaponClass:d.weaponClass,
      weaponKind:d.typeValue.endsWith("M") ? "melee" : "firearm",
      weaponTechnology:d.technology,
      weaponSystem:d.technology,
      baseDamageFormula:d.damage,
      damageFormula:d.damage,
      rangeFt:d.range,
      longRangeFt:d.longRange,
      physicalMagazine:d.physicalCapacity,
      functionalMagazine:d.functionalAttacks,
      magazineSize:d.functionalAttacks,
      reloadActions:d.reloadActions,
      strengthRequirement:d.strengthRequirement,
      specialRule:d.effect,
      effectText:d.effect?.text ?? "None.",
      sourceCategory:"Weapons_Unique",
      marketCategory:"Weapons_Unique",
      shopType:"none",
      curatedCatalogV10:true,
      catalogEnabled:true,
      marketReady:false,
      weaponReadiness:"unique",
      needsReview:false,
      noMk:true,
      quickhack:false,
      ramCost:null,
      priceCredits:null,
      marketPrice:null,
      availability:null,
      tierIdentity:null
    };
  }

  async function migrateItem(item) {
    if (!item || item.type !== "weapon") return false;
    const d = definition(item);
    if (!d) return false;

    const owned = Boolean(item.parent?.documentName === "Actor");
    if (!owned && !isUniqueSource(item)) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const update = {};
    const values = flagValues(d);

    for (const stale of [
      "mk","rating","tier","ratingLabel","marketTier",
      "quickhackRewriteVersion"
    ]) {
      if (Object.prototype.hasOwnProperty.call(flags,stale)) {
        update["flags."+FLAG+".-="+stale] = null;
      }
    }

    for (const [key,value] of Object.entries(values)) {
      if (!same(flags[key],value)) update["flags."+FLAG+"."+key] = value;
    }

    const desc = String(item.system?.description?.value ?? "");
    if (
      String(flags.uniqueWeaponRewriteVersion ?? "") !== REWRITE ||
      !desc.includes('data-feha-unique-weapon-card="'+REWRITE+'"')
    ) {
      update["system.description.value"] = rewriteDescription(d);
    }

    const damageBase = item.system?.damage?.base ?? {};
    const damageChanged =
      String(damageBase?.custom?.formula ?? "") !== String(d.damage) ||
      damageBase?.custom?.enabled !== true;

    if (damageChanged) {
      update["system.damage.base.number"] = 0;
      update["system.damage.base.denomination"] = 0;
      update["system.damage.base.bonus"] = "";
      update["system.damage.base.types"] = [d.damageType];
      update["system.damage.base.custom.enabled"] = true;
      update["system.damage.base.custom.formula"] = d.damage;
    }

    if (Number(item.system?.range?.value ?? 0) !== Number(d.range)) {
      update["system.range.value"] = Number(d.range);
    }
    if (!same(item.system?.range?.long ?? null,d.longRange ?? null)) {
      update["system.range.long"] = d.longRange ?? null;
    }
    if (d.typeValue.endsWith("M")) {
      if (Number(item.system?.range?.reach ?? 0) !== Number(d.range)) {
        update["system.range.reach"] = Number(d.range);
      }
    }
    if (String(item.system?.range?.units ?? "") !== "ft") {
      update["system.range.units"] = "ft";
    }
    if (String(item.system?.type?.value ?? "") !== d.typeValue) {
      update["system.type.value"] = d.typeValue;
    }
    if (String(item.system?.identifier ?? "") !== slug(d.name)) {
      update["system.identifier"] = slug(d.name);
    }

    // These are one-off rewards, not Quickhack shop entries. Clear any
    // leftover price written by the old name-collision migration.
    if (
      item.system?.price &&
      Number(item.system.price.value ?? 0) !== 0
    ) {
      update["system.price.value"] = 0;
    }

    if (!Object.keys(update).length) return false;
    await item.update(update);
    return true;
  }

  async function migrateAll() {
    if (!game.user?.isGM) {
      return {skipped:true,world:0,owned:0,canonicalCount:DEFINITIONS.length};
    }

    let world = 0;
    let owned = 0;
    const sourceItems = list(game.items).filter(item => item?.type === "weapon" && isUniqueSource(item));
    const missing = DEFINITIONS
      .filter(d => !sourceItems.some(item => definition(item)?.key === d.key))
      .map(d => d.name);

    for (const item of sourceItems) {
      try { if (await migrateItem(item)) world++; }
      catch (error) { console.warn("FEHA UNIQUE WEAPON // world migration failed",item?.name,error); }
    }

    for (const actor of list(game.actors)) {
      for (const item of list(actor.items)) {
        if (!definition(item)) continue;
        try { if (await migrateItem(item)) owned++; }
        catch (error) { console.warn("FEHA UNIQUE WEAPON // owned migration failed",actor?.name,item?.name,error); }
      }
    }

    const result = {skipped:false,world,owned,canonicalCount:DEFINITIONS.length,missing};
    console.log("FEHA UNIQUE WEAPON CATALOG",VERSION,"canonicalized",result);
    if (missing.length) {
      ui.notifications?.warn?.("FEHA Unique Weapons: "+missing.length+" expected weapon(s) missing from Do these/-Other. Check console.");
    }
    return result;
  }

  const api = {
    version:VERSION,
    rewriteVersion:REWRITE,
    list:() => DEFINITIONS.map(d => ({...d,effect:d.effect?{...d.effect}:null})),
    definition,
    rewriteDescription,
    migrateItem,
    migrateAll,
    destroy() {
      if (globalThis.FEHA_UNIQUE_WEAPON_CATALOG === api) delete globalThis.FEHA_UNIQUE_WEAPON_CATALOG;
      if (game?.adk?.uniqueWeapons === api) delete game.adk.uniqueWeapons;
    }
  };

  game.adk ??= {};
  game.adk.uniqueWeapons = api;
  globalThis.FEHA_UNIQUE_WEAPON_CATALOG = api;
  console.log("FEHA UNIQUE WEAPON CATALOG",VERSION,"ready //",DEFINITIONS.length,"one-off weapons");
})();