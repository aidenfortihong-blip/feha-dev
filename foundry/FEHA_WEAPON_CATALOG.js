// FEHA // FINAL REVIEWED GUN CATALOG
// Permanent source of truth generated from the GM-reviewed "Do these" export.
// 78 finished weapons. World migration only touches items inside "Do these";
// actor-owned copies with matching final names are also synchronized.
(() => {
  try { globalThis.FEHA_WEAPON_CATALOG?.destroy?.(); } catch {}
  const VERSION="3.3.4", REWRITE="3.3-unified-card", REVIEW_SEED="do-these-final-2026-09-30-h", FLAG="fleshEnshrouded";
  const COMPANY={"BAS":{"name":"Bastion Strategic","doctrine":"Professional military firearms built to turn confirmed kills into immediate follow-up violence.","trait":["ACTION SURGE","Once per turn, when you kill a creature with a Bastion firearm, immediately gain one additional Action. That Action can only be used to make an attack with a Bastion firearm, expires at the end of the turn, and ACTION SURGE cannot trigger again during that same turn."]},"COR":{"name":"Corvus Neural","doctrine":"Neural-linked weapons designed to prey on cyberware users and convert enemy network resources into your own.","trait":["RAM THIEF","When you kill a creature with a Corvus weapon, if that creature has a cyberdeck with current RAM, its current RAM becomes 0 and you restore that much RAM up to your maximum. Any excess is lost."]},"FOR":{"name":"ForgeLine Industries","doctrine":"Heavy frames and oversized firepower engineered to dominate when the shooter plants their feet.","trait":["ANCHOR","If you do not move at any point during your turn, attacks you make with ForgeLine weapons have Advantage. Moving at any point during the turn prevents ANCHOR from applying that turn."]},"HEL":{"name":"Helix Vitae","doctrine":"Self-sustaining energy weapons designed to recover completely during brief pauses in fire.","trait":["SELF-CHARGING CELL","At the end of a turn in which you did not fire the Helix weapon you are wielding, it fully restores its magazine, charge, or heat capacity to maximum with no Action required."]},"JAD":{"name":"Jade Arc Systems","doctrine":"Overdriven energy weapons built to turn a kill into an immediate secondary detonation.","trait":["ARC CHAIN","When a Jade Arc weapon kills an enemy, choose one other enemy within 5 feet of the killed target. That enemy immediately takes the weapon's full normal damage with no second attack roll. Damage dealt by ARC CHAIN cannot trigger ARC CHAIN again."]},"KUR":{"name":"Kurohane Group","doctrine":"Purpose-built covert firearms whose report is effectively nonexistent.","trait":["DEAD SILENT","Kurohane firearms are completely silent. Firing one produces no audible report and cannot reveal the shooter through sound."]},"VEK":{"name":"Vektor Dynamics","doctrine":"Mobile combat weapons designed around movement, repositioning, and keeping initiative.","trait":["CUNNING ACTION","While actively wielding a Vektor firearm, you may Dash, Disengage, or Hide as a Bonus Action."]}};
  const SPECIALS={"Ashura":{"key":"darkvision-optic","name":"NEURAL OPTIC","text":"While actively wielded, the integrated neural optic provides Darkvision 60 ft.","darkvisionFt":60,"automation":"manual"},"Dian":{"key":"camera-dart","name":"CAMERA DART","text":"The integrated camera dart can be fired and deployed as a camera token. Its feed can be viewed and used as an IoT origin for Quickhacks.","automation":"manual"},"Kyokokukamusari":{"key":"flashbang-magazine","name":"FLASHBANG MAGAZINE","text":"On reload, the integrated flashbang magazine may trigger. Resolve the blast using the campaign's Flashbang Grenade rules.","automation":"manual"},"Masamune":{"key":"neural-relay","name":"NEURAL RELAY","text":"2 charges per Long Rest. Expend 1 charge to route a Quickhack through the weapon's targeting link.","charges":2,"recovery":"long","automation":"manual"},"Metel":{"key":"tracker","name":"TRACKER","text":"Twice per Long Rest, designate a target. One Quickhack may target that creature without direct visual contact even if it leaves network range. Reloading erases the signature.","charges":2,"recovery":"long","automation":"manual"},"Palica":{"key":"distributed-lock","name":"DISTRIBUTED LOCK","text":"The smart scatter system may split the pellet pool between two nearby valid targets instead of placing the entire blast on one target.","automation":"manual"},"Razor Choir":{"key":"truesight-optic","name":"TRUESIGHT OPTIC","text":"While actively wielded, the integrated neural optic provides Truesight 30 ft.","truesightFt":30,"automation":"manual"}};
  const ROWS=[["Breachhound","BAS","Shotgun","14d2",15,30,8,8,2,11,"P","s"],["Crusher","BAS","Shotgun","20d2",15,30,5,5,2,12,"P","s"],["Hexburst","BAS","Assault Rifle","6d8",60,180,30,5,2,11,"P","r"],["Igla","BAS","Shotgun","16d2",20,40,2,2,1,11,"P","s"],["Lexington","BAS","Pistol","5d6",30,60,15,3,1,null,"P","r"],["Liberty","BAS","Heavy Pistol","2d20",40,100,4,2,1,11,"P","r"],["Overture","BAS","Heavy Pistol","1d30+12",40,180,6,6,2,11,"P","r"],["Saratoga","BAS","SMG","8d6",40,100,40,5,1,null,"P","r"],["Tactician","BAS","Shotgun","24d2",15,30,5,5,3,12,"P","s"],["Umbra","BAS","Assault Rifle","7d8",60,150,35,5,2,11,"P","r"],["Unity","BAS","Pistol","3d6",30,70,15,5,1,null,"P","r"],["Warwake","BAS","LMG","7d12",50,200,70,10,8,16,"P","r"],["Ashura","COR","Sniper Rifle","1d20+14",300,1000,3,3,3,13,"S","r"],["Dian","COR","SMG","5d6",40,100,30,6,1,null,"S","r"],["Kyokokukamusari","COR","Assault Rifle","4d8",60,180,28,7,1,11,"S","r"],["Masamune","COR","Assault Rifle","3d8",60,180,30,10,2,11,"S","r"],["Metel","COR","Heavy Pistol","1d30+6",40,120,8,8,1,10,"P","r"],["Palica","COR","Shotgun","14d2",20,40,4,4,2,10,"S","s"],["Razor Choir","COR","SMG","15d6",40,80,null,6,1,null,"T","b"],["Borg4a","FOR","Pistol","15d6",30,60,15,1,1,11,"P","r"],["Burya","FOR","Heavy Pistol","1d30+16",40,120,6,6,2,13,"P","r"],["Carnage","FOR","Shotgun","30d2",15,30,5,5,4,14,"P","s"],["Deadrail","FOR","Assault Rifle","8d8",60,180,32,4,3,13,"P","r"],["Defender","FOR","LMG","8d12",50,200,96,12,8,16,"P","r"],["Grad","FOR","Sniper Rifle","1d20+46",300,1000,4,4,3,16,"P","r"],["Iron Psalm","FOR","LMG","6d12",50,200,96,16,8,16,"T","r"],["Mirefang","FOR","Shotgun Pistol","18d2",20,40,4,4,2,12,"P","s"],["Monarch Zero","FOR","Sniper Rifle","5d20+16",300,1000,3,3,3,16,"T","r"],["Nova","FOR","Heavy Pistol","1d30+12",40,100,6,6,2,12,"P","r"],["Osprey Prototype","FOR","DMR","10d10",90,200,30,3,3,null,"P","r"],["Watchtower","FOR","Sniper Rifle","1d20+28",300,1000,5,5,3,16,"P","r"],["Arcspike","HEL","DMR","3d10",90,200,null,10,2,10,"E","c"],["Cinderjack","HEL","SMG","5d6",40,100,null,12,1,null,"E","c"],["Grit","HEL","Pistol","3d6",30,70,null,20,1,null,"E","c"],["Guillotine","HEL","SMG","10d6",40,100,null,5,1,null,"E","c"],["Kappa","HEL","Pistol","6d6",30,80,null,15,1,null,"E","c"],["Omaha","HEL","Pistol","4d6",30,90,null,8,1,null,"E","c"],["Quasar","HEL","Heavy Pistol","1d20+5",40,120,null,8,1,10,"E","c"],["Senkoh","HEL","SMG","5d6",40,120,null,10,1,null,"E","c"],["Shingen","HEL","SMG","5d6",40,100,null,10,1,null,"E","c"],["Starforge","HEL","LMG","5d12",50,200,null,18,4,13,"E","h"],["Ticon","HEL","Pistol","4d6",30,60,null,10,0,null,"E","c"],["Triskelion","HEL","DMR","3d10",90,250,null,10,2,11,"E","c"],["Twin Viper","HEL","SMG","10d6",40,80,null,30,1,null,"E","c"],["Warden","HEL","SMG","5d6",40,100,null,15,1,null,"E","c"],["Achilles","JAD","DMR","6d10",100,300,null,3,3,14,"E","c"],["Black Requiem","JAD","Heavy Pistol","5d20+20",30,60,null,1,1,null,"E","c"],["Choirbreaker","JAD","LMG","9d12",50,200,null,5,8,16,"E","c"],["Gravetide","JAD","Shotgun","28d2",20,40,null,4,3,13,"E","c"],["Hercules Prototype","JAD","Assault Rifle","9d8",60,180,null,4,2,12,"E","c"],["HMG","JAD","LMG","10d12",50,200,null,5,10,17,"E","c"],["MA70","JAD","LMG","10d12",50,200,null,4,10,17,"E","c"],["Nekomata","JAD","Sniper Rifle","3d20+40",300,1000,null,1,4,12,"E","c"],["Nemora","JAD","Assault Rifle","7d8",60,180,null,5,3,12,"E","c"],["Nullstorm","JAD","Assault Rifle","9d8",60,180,null,4,3,13,"E","c"],["Rasetsu Prototype","JAD","Sniper Rifle","8d20+30",300,1000,null,4,5,16,"E","c"],["Satara","JAD","Shotgun","30d2",20,40,null,2,3,13,"E","c"],["Sunlance","JAD","Sniper Rifle","1d20+50",400,1200,null,1,5,14,"E","c"],["Testera","JAD","Shotgun","36d2",10,20,null,2,3,14,"E","c"],["Trucebreaker","JAD","Shotgun","28d2",20,50,null,3,3,13,"E","c"],["Chao","KUR","Pistol","3d6",30,80,12,4,1,null,"S","r"],["Cinder-20","KUR","Pistol","2d6",30,60,12,6,1,null,"P","r"],["Copperhead","KUR","Assault Rifle","4d8",60,180,28,7,2,10,"P","r"],["Dreadline","KUR","Assault Rifle","5d8",60,180,25,5,1,10,"P","r"],["Kenshin","KUR","Pistol","2d6",30,90,12,6,1,null,"T","r"],["Quickscar","KUR","SMG","6d6",40,80,24,4,1,null,"P","r"],["Quietus","KUR","Bow","2d10",90,250,null,null,1,11,"P","a"],["Sidewinder","KUR","Assault Rifle","3d8",60,180,30,10,2,10,"S","r"],["Yukimura","KUR","Pistol","3d6",30,80,15,5,1,null,"S","r"],["Ajax","VEK","Assault Rifle","5d8",60,180,30,6,2,12,"P","r"],["Arcflash","VEK","SMG","5d6",40,100,null,10,1,null,"E","c"],["Kolac","VEK","DMR","4d10",90,250,20,5,3,12,"P","r"],["Kyubi","VEK","Assault Rifle","2d8+4",90,240,30,15,2,10,"P","r"],["Long Vigil","VEK","Sniper Rifle","2d20+10",300,1000,8,8,3,16,"T","r"],["Pale Kestrel","VEK","DMR","3d10",90,200,30,10,3,13,"T","r"],["Pozhar","VEK","Shotgun","16d2",15,30,10,10,3,11,"P","s"],["Pulsar","VEK","SMG","6d6",40,100,30,5,1,null,"P","r"],["Red Wisp","VEK","Pistol","8d6",30,60,16,2,1,null,"T","r"]];
  const TECH={P:"Power",S:"Smart",T:"Tech",E:"Energy"}, CAP={r:"rounds",s:"shells",c:"charge",h:"heat",b:"bursts",a:"arrows"};
  const norm=v=>String(v??"").normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g," ").trim().toLowerCase();
  const slug=v=>norm(v).replace(/\\s+/g,"-");
  const list=c=>Array.isArray(c)?c:Array.isArray(c?.contents)?c.contents:(()=>{try{return [...(c??[])]}catch{return []}})();
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\x27/g,"&#039;");
  const definitions=ROWS.map(r=>{ const [name,cc,weaponClass,damage,range,longRange,physicalCapacity,functionalAttacks,reloadActions,strengthRequirement,tc,cap]=r; const co=COMPANY[cc],sp=SPECIALS[name]??null; return {key:slug(name),name,company:co.name,weaponClass,damage,range,longRange,physicalCapacity,functionalAttacks,reloadActions,strengthRequirement,technology:TECH[tc],capacityType:CAP[cap],doctrine:co.doctrine,familyTraitName:co.trait?.[0]??null,familyTraitText:co.trait?.[1]??null,special:sp?{...sp}:null}; });
  const byName=new Map(definitions.map(d=>[norm(d.name),d])), byKey=new Map(definitions.map(d=>[norm(d.key),d]));
  function definition(v){ if(!v)return null; if(typeof v==="string")return byKey.get(norm(v))??byName.get(norm(v))??null; return byName.get(norm(v.name))??null; }
  const rangeText=d=>d.longRange?(d.range+"/"+d.longRange+" ft"):(d.range+" ft");
  const capLabel=d=>d.capacityType==="shells"?"PHYSICAL SHELLS":d.capacityType==="charge"?"ENERGY CAPACITY":d.capacityType==="heat"?"HEAT ENDURANCE":d.capacityType==="bursts"?"BURST CAPACITY":d.capacityType==="arrows"?"AMMO":"PHYSICAL MAG";
  const capText=d=>(d.capacityType==="charge"||d.capacityType==="heat"||d.capacityType==="bursts")?String(d.functionalAttacks??"—"):String(d.physicalCapacity??"—");
  const reloadLabel=d=>(d.capacityType==="charge"||d.capacityType==="heat")?"RECHARGE":"RELOAD";
  function rewriteDescription(d){
    const fam=d.familyTraitText
      ? "<div style=\"margin-top:10px;padding:10px;border:1px solid #24404a;background:#09171c\"><small style=\"display:block;color:#72dff2;font-size:10px;font-weight:900;letter-spacing:.11em;margin-bottom:5px\">"+esc(d.familyTraitName)+"</small><p style=\"margin:0;line-height:1.5;color:#dce8ec !important\">"+esc(d.familyTraitText)+"</p></div>"
      : "";
    const spec=d.special?.text
      ? "<div style=\"margin-top:10px;padding:10px;border:1px solid #5d4d20;background:#171308\"><small style=\"display:block;color:#f0c85a;font-size:10px;font-weight:900;letter-spacing:.11em;margin-bottom:5px\">SPECIAL SYSTEM // "+esc(d.special.name)+"</small><p style=\"margin:0;line-height:1.5;color:#f4ead0 !important\">"+esc(d.special.text)+"</p></div>"
      : "";
    const rr=(d.capacityType==="charge"||d.capacityType==="heat")?"RECHARGE":"RELOAD";
    const die=(String(d.damage).match(/d\d+/i)?.[0]??"—").toUpperCase();
    return "<section data-feha-ui=\"item-card-v1\" data-feha-weapon-card=\""+REWRITE+"\" data-feha-review-seed=\""+REVIEW_SEED+"\" style=\"border:1px solid #2b5662;background:#071116;padding:13px 14px;color:#dce8ec !important\">"+
      "<div style=\"display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:9px;border-bottom:1px solid #263941\"><small style=\"color:#72dff2;font-size:10px;font-weight:900;letter-spacing:.12em\">FEHA // "+esc(d.company.toUpperCase())+" // WEAPON</small><strong style=\"color:#eefaff;font-size:12px\">"+esc(d.weaponClass.toUpperCase())+"</strong></div>"+
      "<h2 style=\"margin:10px 0 4px;color:#fff\">"+esc(d.name)+"</h2>"+
      "<p style=\"margin:0 0 11px;font-size:11px;line-height:1.45;color:#8ba0a8 !important\">"+esc(d.doctrine)+"</p>"+
      "<div style=\"display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px;padding:10px 0;border-top:1px solid #1f3239;border-bottom:1px solid #1f3239\">"+
        "<div><small style=\"color:#8ca2ac\">DAMAGE</small><br><strong style=\"color:#fff\">"+esc(d.damage)+"</strong></div>"+
        "<div><small style=\"color:#8ca2ac\">RANGE</small><br><strong style=\"color:#fff\">"+esc(rangeText(d))+"</strong></div>"+
        "<div><small style=\"color:#8ca2ac\">"+esc(capLabel(d))+"</small><br><strong style=\"color:#fff\">"+esc(capText(d))+"</strong></div>"+
        "<div><small style=\"color:#8ca2ac\">ATTACKS BEFORE "+rr+"</small><br><strong style=\"color:#fff\">"+esc(d.functionalAttacks??"—")+"</strong></div>"+
        "<div><small style=\"color:#8ca2ac\">"+esc(reloadLabel(d))+"</small><br><strong style=\"color:#fff\">"+esc(d.reloadActions)+" action"+(d.reloadActions===1?"":"s")+"</strong></div>"+
        "<div><small style=\"color:#8ca2ac\">STR REQUIREMENT</small><br><strong style=\"color:#fff\">"+esc(d.strengthRequirement??"—")+"</strong></div>"+
        "<div><small style=\"color:#8ca2ac\">TECHNOLOGY</small><br><strong style=\"color:#fff\">"+esc(d.technology)+"</strong></div>"+
        "<div><small style=\"color:#8ca2ac\">CLASS DIE</small><br><strong style=\"color:#fff\">"+esc(die)+"</strong></div>"+
      "</div>"+fam+spec+
    "</section>";
  }
  function diceParts(f){const m=String(f??"").match(/^(\\d+)d(\\d+)/i);return m?{count:+m[1],die:+m[2]}:{count:null,die:null}}
  function flagValues(d){const dice=diceParts(d.damage);return {weaponCatalogKey:d.key,weaponCatalogVersion:VERSION,weaponRewriteVersion:REWRITE,manufacturer:d.company,company:d.company,weaponGroup:d.company,weaponClass:d.weaponClass,weaponKind:d.weaponClass==="Bow"?"bow":"firearm",weaponTechnology:d.technology,weaponSystem:d.technology,weaponDiceCount:dice.count,weaponDie:dice.die,baseDamageFormula:d.damage,damageFormula:d.damage,rangeFt:d.range,longRangeFt:d.longRange,physicalMagazine:d.physicalCapacity,capacityType:d.capacityType,functionalMagazine:d.functionalAttacks,magazineSize:d.functionalAttacks,reloadActions:d.reloadActions,strengthRequirement:d.strengthRequirement,familyTrait:d.familyTraitText?{name:d.familyTraitName,text:d.familyTraitText}:null,specialRule:d.special??null,effectText:d.special?.text??d.doctrine,sourceCategory:"Weapons",shopType:"arms",curatedCatalogV10:true,catalogEnabled:true,marketReady:true,weaponReadiness:"done",weaponReadinessVersion:VERSION,marketPass:"weapon-catalog-3.0-final",marketCategory:"Weapons",bodyArmor:false,quickhack:false,needsReview:false,doTheseFinalized:true,doTheseFinalizedVersion:VERSION,noMk:true};}
  function insideDoThese(item){
    let folder=item?.folder??null, guard=0;
    while(folder&&guard++<50){
      if(String(folder?.name??"").trim().toLowerCase()==="do these") return true;
      folder=folder?.folder??folder?.parent??null;
    }
    return false;
  }
  function managedWorldCopy(item){
    const f=item?.flags?.[FLAG]??{}, pass=String(f.marketPass??"");
    const desc=String(item?.system?.description?.value??"");
    const canonical=Boolean(definition(item));
    const staleFehaCard=
      /data-feha-weapon-card=|FINAL GUN|REVIEW STATUS|GM REVIEW NOTES|GUN REVIEW/i.test(desc);

    // Canonical FEHA gun copies can exist outside the current Do these tree
    // (old library copies, moved items, duplicated shop/library items). If a
    // canonical-name weapon still carries one of our old FEHA gun wrappers,
    // treat it as managed so the unified sheet migration cannot miss it.
    return insideDoThese(item)
      || f.doTheseFinalized===true
      || f.marketReady===true
      || Boolean(f.weaponCatalogKey)
      || pass.startsWith("weapon-catalog-")
      || pass.startsWith("do-these-finalized")
      || (canonical && staleFehaCard);
  }
  async function repairInvalidSourceIdentifier(item,d){
    const rawSystem=item?._source?.system;
    const rawIdentifier=String(rawSystem?.identifier??"");
    if(/^[a-z0-9_-]+$/i.test(rawIdentifier)) return false;

    const clone=
      globalThis.foundry?.utils?.deepClone?.(rawSystem) ??
      structuredClone(rawSystem ?? {});
    clone.identifier=slug(d.name);

    // dnd5e 5.3.x legacy weapon activities can carry blank optional
    // visibility identifiers. They are harmless at rest but can poison a full
    // SchemaField update while repairing the parent Item identifier. Remove
    // only blank visibility identifiers; preserve every nonblank value.
    const activities=clone?.activities;
    if(activities && typeof activities==="object"){
      for(const activity of Object.values(activities)){
        if(
          activity?.visibility &&
          String(activity.visibility.identifier??"")===""
        ){
          delete activity.visibility.identifier;
        }
      }
    }

    await item.update(
      {system:clone},
      {diff:false,recursive:false,fallback:true}
    );
    return true;
  }

  async function migrateItem(item){
    if(!item||item.type!=="weapon")return false;
    const owned=Boolean(item.parent?.documentName==="Actor");
    if(!owned&&!managedWorldCopy(item))return false;
    const d=definition(item); if(!d)return false;
    // Repair truly invalid persisted identifiers before any ordinary partial
    // system update. This is intentionally narrow: valid items never take the
    // full-system repair path.
    try { await repairInvalidSourceIdentifier(item,d); }
    catch(error){
      console.warn("FEHA WEAPON CATALOG // identifier source repair failed",item?.name,error);
      throw error;
    }
    const f=item.flags?.[FLAG]??{},u={},vals=flagValues(d);
    for(const stale of ["mk","rating","tier","ratingLabel","marketTier"])if(Object.prototype.hasOwnProperty.call(f,stale))u["flags."+FLAG+".-="+stale]=null;
    for(const [k,v] of Object.entries(vals)){let same=false;try{same=JSON.stringify(f[k]??null)===JSON.stringify(v)}catch{same=f[k]===v}if(!same)u["flags."+FLAG+"."+k]=v}
    const desc=String(item.system?.description?.value??"");
    const hasCurrentCard=desc.includes('data-feha-weapon-card="'+REWRITE+'"')&&desc.includes('data-feha-review-seed="'+REVIEW_SEED+'"');
    if(String(f.weaponReviewSeedVersion??"")!==REVIEW_SEED||!hasCurrentCard){u["system.description.value"]=rewriteDescription(d);u["flags."+FLAG+".weaponReviewSeedVersion"]=REVIEW_SEED;}
    const dp={"system.damage.base.number":0,"system.damage.base.denomination":0,"system.damage.base.bonus":"","system.damage.base.types":["piercing"],"system.damage.base.custom.enabled":true,"system.damage.base.custom.formula":d.damage};
    for(const [k,v] of Object.entries(dp)){let cur=item.system;for(const s of k.replace(/^system\\./,"").split("."))cur=cur?.[s];let same=false;try{same=JSON.stringify(cur??null)===JSON.stringify(v)}catch{same=cur===v}if(!same)u[k]=v}
    if(Number(item.system?.range?.value??0)!==Number(d.range))u["system.range.value"]=Number(d.range);
    if(JSON.stringify(item.system?.range?.long??null)!==JSON.stringify(d.longRange??null))u["system.range.long"]=d.longRange??null;
    if(String(item.system?.range?.units??"")!=="ft")u["system.range.units"]="ft";
    // dnd5e can prepare a usable identifier even when the persisted source is
    // still blank. Compare the raw source, not only the prepared system value,
    // or a legacy blank identifier can survive until another system update
    // triggers SchemaField validation.
    const desiredIdentifier=slug(d.name);
    const sourceIdentifier=String(item?._source?.system?.identifier??"");
    if(sourceIdentifier!==desiredIdentifier)u["system.identifier"]=desiredIdentifier;
    if(String(item.system?.type?.value??"")!=="martialR")u["system.type.value"]="martialR";
    if(!Object.keys(u).length)return false;
    const repairingIdentifier=!/^[a-z0-9_-]+$/i.test(sourceIdentifier);
    await item.update(u,repairingIdentifier?{fallback:true}:{});
    return true;
  }
  async function migrateAll(){
    if(!game.user?.isGM)return {world:0,owned:0,canonicalCount:definitions.length,skipped:true}; let world=0,owned=0;
    const missing=definitions.filter(d=>!list(game.items).some(i=>insideDoThese(i)&&definition(i)?.key===d.key)).map(d=>d.name);
    for(const i of list(game.items))try{if(await migrateItem(i))world++}catch(e){console.warn("FEHA WEAPON CATALOG // world migration failed",i?.name,e)}
    for(const a of list(game.actors))for(const i of list(a.items))try{if(await migrateItem(i))owned++}catch(e){console.warn("FEHA WEAPON CATALOG // owned migration failed",a?.name,i?.name,e)}
    const result={world,owned,canonicalCount:definitions.length,missing,skipped:false}; console.log("FEHA WEAPON CATALOG",VERSION,"final reviewed catalog canonicalized",result);
    if(missing.length)ui?.notifications?.warn?.("FEHA Final Gun Catalog: "+missing.length+" canonical gun(s) missing. Check console."); try{globalThis.ADKMarket?.refresh?.()}catch{} return result;
  }
  const api={version:VERSION,rewriteVersion:REWRITE,reviewSeed:REVIEW_SEED,definitions:Object.freeze(Object.fromEntries(definitions.map(d=>[d.key,Object.freeze({...d,special:d.special?Object.freeze({...d.special}):null})]))),list:()=>definitions.map(d=>({...d,special:d.special?{...d.special}:null})),definition,rewriteDescription,migrateItem,migrateAll,destroy(){if(globalThis.FEHA_WEAPON_CATALOG===api)delete globalThis.FEHA_WEAPON_CATALOG;if(game?.adk?.weapons===api)delete game.adk.weapons;}};
  game.adk??={}; game.adk.weapons=api; globalThis.FEHA_WEAPON_CATALOG=api; console.log("FEHA WEAPON CATALOG",VERSION,"ready //",definitions.length,"final reviewed guns");
})();