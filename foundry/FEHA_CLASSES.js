// FEHA // CLASSES
// Three classes for the crew, levels 1-5: Solo, Netrunner, Techie. A class is
// a real dnd5e class item (level, proficiency and hit dice come from it) plus
// one feat per feature. Players pick their own class the first time they load
// in without one; the GM levels the crew from the Actors tab (Crew Level).
// Max HP is set by this module (characters in this world have a hand-set
// maximum that installed chrome adds to), not by dnd5e's HP advancement.
// Other modules read class bonuses through FEHA_CLASSES.bonus(actor,key):
// ram, hackDc, grenadeDc, grenadeRange, grenadesPerTurn.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_CLASSES requires FEHA_CYBER_CORE.");

  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const CH = "feha.classes";
  const MAX_LEVEL = 5;
  const BUTTON_CLASS = "feha-crew-level-button";
  const PLAYABLE = ["ponyboy","batou","sasha","zach"];

  const list = c => {
    if (!c) return [];
    if (Array.isArray(c)) return c;
    if (Array.isArray(c.contents)) return c.contents;
    try { return [...c]; } catch { return []; }
  };
  const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const rid = () => foundry.utils.randomID();
  const flags = doc => doc?.flags?.[FLAG] ?? {};

  // ------------------------------------------------------------ features
  // use: activity spec. uses: {max, per}. bonus: class bonus flags.
  // effect: transfer effect on the feat (passive). apply: effect the
  // activity applies to its targets.
  const once = per => ({max:"1",per});
  const prof = per => ({max:"@prof",per});

  const CLASSES = {
    solo:{
      name:"Solo", hd:"d10", hpBase:24, hpPer:6, saves:["str","con"],
      img:"icons/weapons/guns/gun-pistol-flintlock-metal.webp",
      blurb:"Hired muscle. Guns, blades and combat chrome; the one who walks in first.",
      features:{
        1:[
          {key:"combat-awareness",name:"Combat Awareness",img:"icons/magic/perception/eye-ringed-glow-yellow.webp",
            text:"Add your Wisdom modifier to initiative. Heavy weapons never slow you down (no weapon load speed penalty).",
            handling:{negateWeaponWeight:true},
            effect:[{key:"system.attributes.init.bonus",value:"@abilities.wis.mod",type:"add"}]},
          {key:"patch-up",name:"Patch Up",img:"icons/magic/life/cross-worn-green.webp",
            text:"Bonus Action: slap on a trauma patch and regain 1d10 + your level hit points. Once per short rest.",
            uses:once("sr"),use:{type:"heal",activation:"bonus",heal:{number:1,denomination:10,bonus:"@details.level",types:["healing"]},self:true}}
        ],
        2:[
          {key:"called-shot",name:"Called Shot",img:"icons/skills/targeting/crosshair-pointed-orange.webp",
            text:"Once per turn when you hit with a weapon, before damage, call where it lands:<ul><li><strong>Head:</strong> add one more damage die of the weapon's type.</li><li><strong>Legs:</strong> the target's speed is halved until the end of its next turn.</li><li><strong>Weapon:</strong> the target has disadvantage on its next attack.</li></ul>Uses equal to your proficiency bonus per short rest.",
            uses:prof("sr"),use:{type:"utility",activation:"special"}}
        ],
        3:[
          {key:"suppressive-fire",name:"Suppressive Fire",img:"icons/weapons/ammunition/bullets-cartridge-shell-gray.webp",
            text:"Action, with an SMG, assault rifle or LMG: hose down a 20 ft cube within the weapon's range. Each creature in it makes a Dexterity save (DC 8 + your proficiency + Dexterity). On a failure it is <strong>Pinned</strong> until the end of your next turn: speed 0 and disadvantage on attack rolls. Once per short rest.",
            uses:once("sr"),use:{type:"save",activation:"action",save:"dex",dcAbility:"dex",template:{type:"cube",size:20}},
            apply:{name:"Pinned",img:"icons/svg/net.svg",text:"Speed 0 and disadvantage on attack rolls until the end of the Solo's next turn.",
              changes:[{key:"system.attributes.movement.walk",value:"0",type:"override"}],rounds:1}}
        ],
        4:[{key:"asi",name:"Ability Score Improvement",img:"icons/magic/life/heart-cross-strong-flame-green.webp",
          text:"Raise one ability score by 2, or two by 1 (max 20). Change the scores on your sheet; the GM checks it."}],
        5:[{key:"extra-attack",name:"Extra Attack",img:"icons/skills/melee/blade-tips-triple-steel.webp",
          text:"When you take the Attack action, you attack twice instead of once."}]
      }
    },

    netrunner:{
      name:"Netrunner", hd:"d6", hpBase:16, hpPer:4, saves:["int","wis"],
      img:"icons/magic/symbols/circled-gem-pink.webp",
      blurb:"Jacked in. Quickhacks, RAM and the Cyberdeck; fights through the net.",
      features:{
        1:[
          {key:"jack-in",name:"Jack In",img:"icons/magic/symbols/circled-gem-pink.webp",
            text:"Your Cyberdeck has +2 max RAM.",bonus:{ram:2}},
          {key:"breach-protocol",name:"Breach Protocol",img:"icons/magic/control/hypnosis-mesmerism-swirl.webp",
            text:"Bonus Action: run a breach on the local net and regain RAM equal to your Intelligence modifier (at least 1). Once per short rest.",
            uses:once("sr"),use:{type:"utility",activation:"bonus"},action:"breach"}
        ],
        2:[
          {key:"overclock",name:"Overclock",img:"icons/magic/lightning/bolt-strike-purple-pink.webp",
            text:"Bonus Action: push your deck past its limits. Regain 2 RAM and take 2d6 psychic damage. No limit, except what your brain can take.",
            use:{type:"utility",activation:"bonus"},action:"overclock"}
        ],
        3:[
          {key:"daisy-chain",name:"Daisy Chain",img:"icons/magic/lightning/orb-ball-purple.webp",
            text:"Right after you upload a quickhack, regain the RAM it cost and upload the same quickhack again at a second target within 30 ft of the first, as part of the same action. Once per short rest.",
            uses:once("sr"),use:{type:"utility",activation:"special"},action:"daisy"}
        ],
        4:[{key:"asi",name:"Ability Score Improvement",img:"icons/magic/life/heart-cross-strong-flame-green.webp",
          text:"Raise one ability score by 2, or two by 1 (max 20). Change the scores on your sheet; the GM checks it."}],
        5:[{key:"daemon",name:"Daemon",img:"icons/magic/control/silhouette-hold-change-blue.webp",
          text:"Your quickhack DC is 1 higher and your Cyberdeck has +2 more max RAM.",bonus:{hackDc:1,ram:2}}]
      }
    },

    techie:{
      name:"Techie", hd:"d8", hpBase:20, hpPer:5, saves:["dex","int"],
      img:"icons/tools/hand/wrench-steel-grey.webp",
      blurb:"Gear, grenades, drones and repairs. Keeps the crew's kit working and the enemy's not.",
      features:{
        1:[
          {key:"grenadier",name:"Grenadier",img:"icons/weapons/thrown/grenade-round.webp",
            text:"You throw grenades 20 ft farther, and their save DC is 1 higher.",bonus:{grenadeRange:20,grenadeDc:1}},
          {key:"jury-rig",name:"Jury Rig",img:"icons/tools/hand/wrench-steel-grey.webp",
            text:"Action: patch an ally's armor or chrome within 5 ft (or your own). They gain temporary hit points equal to 1d8 + your Intelligence modifier. Uses equal to your proficiency bonus per long rest.",
            uses:prof("lr"),use:{type:"heal",activation:"action",heal:{number:1,denomination:8,bonus:"@abilities.int.mod",types:["temphp"]}}}
        ],
        2:[
          {key:"overcharge",name:"Overcharge",img:"icons/magic/lightning/bolt-blue.webp",
            text:"Bonus Action: overcharge your weapon or an ally's within 5 ft. Its attacks deal an extra 1d6 damage until the end of your next turn. Uses equal to your proficiency bonus per long rest.",
            uses:prof("lr"),use:{type:"utility",activation:"bonus"},
            apply:{name:"Overcharged",img:"icons/magic/lightning/bolt-blue.webp",text:"Weapon attacks deal an extra 1d6 damage.",
              changes:[{key:"system.bonuses.rwak.damage",value:"+1d6",type:"add"},{key:"system.bonuses.mwak.damage",value:"+1d6",type:"add"}],rounds:1}}
        ],
        3:[
          {key:"fpv-drone",name:"FPV Drone",img:"icons/magic/perception/eye-tendrils-web-purple.webp",
            text:"Action: launch your scout drone from your space. It appears as its own token you control: it flies 60 ft a turn, sees 60 ft in the dark, AC 14, HP 5 × your level, and can't attack. You see what it sees. It stays up for an hour or until destroyed (the GM removes it).<p><strong>Spotter:</strong> Bonus Action, mark a creature your drone can see. The next attack roll against it before your next turn has advantage.</p>Launch once per short rest.",
            uses:once("sr"),use:{type:"utility",activation:"action"},action:"drone"}
        ],
        4:[{key:"asi",name:"Ability Score Improvement",img:"icons/magic/life/heart-cross-strong-flame-green.webp",
          text:"Raise one ability score by 2, or two by 1 (max 20). Change the scores on your sheet; the GM checks it."}],
        5:[{key:"ordnance-expert",name:"Ordnance Expert",img:"icons/weapons/thrown/grenade-round.webp",
          text:"You can throw a second grenade in the same turn.",bonus:{grenadesPerTurn:2}}]
      }
    }
  };

  // ------------------------------------------------------------ builders
  function activityData(spec,f) {
    const u = f.use;
    const id = rid();
    const data = {
      _id:id,
      type:u.type,
      activation:{type:u.activation,value:1,condition:""},
      consumption:{targets:f.uses ? [{type:"itemUses",target:"",value:"1",scaling:{mode:"",formula:""}}] : [],scaling:{allowed:false,max:""}},
      target:{affects:{type:u.self ? "self" : (u.type === "save" ? "creature" : "creature"),count:"",choice:false,special:""},
        template:u.template ? {type:u.template.type,size:String(u.template.size),units:"ft",count:"",contiguous:false,width:"",height:""} : {}},
      range:u.self ? {units:"self"} : {units:"ft",value:u.type === "save" ? "120" : "5"}
    };

    if (u.type === "heal") {
      data.healing = {number:u.heal.number,denomination:u.heal.denomination,bonus:u.heal.bonus,types:u.heal.types,custom:{enabled:false,formula:""},scaling:{mode:"",number:null,formula:""}};
    }

    if (u.type === "save") {
      data.save = {ability:[u.save],dc:{calculation:u.dcAbility,formula:""}};
      data.damage = {onSave:"none",parts:[]};
    }

    return data;
  }

  function featureData(clsKey,level,f) {
    const cls = CLASSES[clsKey];
    const effects = [];
    const system = {
      description:{value:"<p>"+f.text+"</p>"},
      type:{value:"class",subtype:""},
      requirements:cls.name+" "+level,
      activities:{}
    };

    if (f.uses) system.uses = {spent:0,max:f.uses.max,recovery:[{period:f.uses.per,type:"recoverAll"}]};

    if (f.effect) {
      effects.push({_id:rid(),name:f.name,img:f.img,type:"base",transfer:true,disabled:false,
        system:{changes:f.effect.map(c => ({...c,priority:null}))}});
    }

    if (f.use) {
      const activity = activityData(f.use,f);
      if (f.apply) {
        const effectId = rid();
        effects.push({_id:effectId,name:f.apply.name,img:f.apply.img,type:"base",transfer:false,disabled:false,
          description:"<p>"+f.apply.text+"</p>",duration:{value:f.apply.rounds,units:"rounds"},
          system:{changes:f.apply.changes.map(c => ({...c,priority:null}))}});
        activity.effects = [{_id:effectId,onSave:false}];
      }
      system.activities[activity._id] = activity;
    }

    return {
      name:f.name,type:"feat",img:f.img,system,effects,
      flags:{[FLAG]:{
        classFeature:{cls:clsKey,level,key:f.key},
        ...(f.bonus ? {classBonus:f.bonus} : {}),
        ...(f.handling ? {handling:f.handling} : {}),
        ...(f.action ? {classAction:f.action} : {})
      }}
    };
  }

  function classData(clsKey,level) {
    const cls = CLASSES[clsKey];
    const rows = Object.entries(cls.features).map(([lv,fs]) =>
      "<li><strong>"+lv+":</strong> "+fs.map(f => esc(f.name)).join(", ")+"</li>").join("");
    return {
      name:cls.name,type:"class",img:cls.img,
      system:{
        identifier:clsKey,levels:level,
        hd:{denomination:cls.hd,spent:0,additional:""},
        description:{value:"<p>"+esc(cls.blurb)+"</p><p>Hit points: "+cls.hpBase+" + CON at level 1, then "+cls.hpPer+" + CON per level.</p><ul>"+rows+"</ul>"},
        advancement:[]
      },
      flags:{[FLAG]:{fehaClass:clsKey}}
    };
  }

  // ------------------------------------------------------------ state
  const classItem = actor => list(actor?.items).find(i => i.type === "class" && flags(i).fehaClass) ?? null;
  const classOf = actor => flags(classItem(actor)).fehaClass ?? null;
  const levelOf = actor => Number(classItem(actor)?.system?.levels ?? 0) || 0;
  const isPC = actor => actor?.type === "character" && PLAYABLE.includes(String(flags(actor).adkCharacter ?? actor?.name ?? "").toLowerCase());

  function bonus(actor,key) {
    return list(actor?.items).reduce((sum,item) => sum + (Number(flags(item).classBonus?.[key]) || 0),0);
  }

  function maxHp(actor,clsKey,level) {
    const cls = CLASSES[clsKey];
    const con = Number(actor?.system?.abilities?.con?.mod ?? 0) || 0;
    return Math.max(1,cls.hpBase + cls.hpPer*(level-1) + con*level);
  }

  // Max HP this module wrote last time, so a CON change or level change moves
  // current HP by the same amount instead of healing or hurting.
  async function syncHp(actor) {
    const clsKey = classOf(actor);
    if (!clsKey) return;
    const want = maxHp(actor,clsKey,levelOf(actor));
    const src = Number(actor._source?.system?.attributes?.hp?.max ?? 0) || 0;
    if (src === want) return;
    const value = Number(actor._source?.system?.attributes?.hp?.value ?? want) || 0;
    await actor.update({
      "system.attributes.hp.max":want,
      "system.attributes.hp.value":Math.max(0,Math.min(want,value + (want - src)))
    });
  }

  async function syncFeatures(actor) {
    const clsKey = classOf(actor);
    const level = levelOf(actor);
    const have = list(actor.items).filter(i => flags(i).classFeature);
    const stale = have.filter(i => i.flags[FLAG].classFeature.cls !== clsKey || i.flags[FLAG].classFeature.level > level).map(i => i.id);
    if (stale.length) await actor.deleteEmbeddedDocuments("Item",stale);

    const owned = new Set(have.filter(i => !stale.includes(i.id)).map(i => i.flags[FLAG].classFeature.cls+":"+i.flags[FLAG].classFeature.key));
    const add = [];
    if (clsKey) {
      for (let lv = 1; lv <= level; lv++) {
        for (const f of CLASSES[clsKey].features[lv] ?? []) {
          if (!owned.has(clsKey+":"+f.key)) add.push(featureData(clsKey,lv,f));
        }
      }
    }
    if (add.length) await actor.createEmbeddedDocuments("Item",add,{keepId:false});
  }

  // Before classes, PCs got their level from a "Power Level" effect that
  // overrides level and proficiency. A class replaces it.
  async function dropPowerLevel(actor) {
    const ids = list(actor.effects).filter(e => flags(e).adkPowerLevel).map(e => e.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect",ids);
  }

  async function assign(actor,clsKey,level = 1) {
    if (!CLASSES[clsKey]) throw new Error("Unknown class "+clsKey+".");
    if (!actor?.isOwner) throw new Error("You don't own "+(actor?.name ?? "that character")+".");
    if (classItem(actor)) throw new Error(actor.name+" already has a class.");
    level = Math.max(1,Math.min(MAX_LEVEL,Math.floor(level)));

    await dropPowerLevel(actor);
    const saves = {};
    for (const key of Object.keys(actor.system.abilities)) saves["system.abilities."+key+".proficient"] = CLASSES[clsKey].saves.includes(key) ? 1 : 0;
    await actor.update(saves);
    await actor.createEmbeddedDocuments("Item",[classData(clsKey,level)]);
    await syncFeatures(actor);
    await syncHp(actor);
    const hp = maxHp(actor,clsKey,level);
    await actor.update({"system.attributes.hp.value":hp});
    return {actor:actor.name,cls:CLASSES[clsKey].name,level,hp};
  }

  async function setLevel(actor,level) {
    const item = classItem(actor);
    if (!item) throw new Error(actor.name+" has no class yet.");
    level = Math.max(1,Math.min(MAX_LEVEL,Math.floor(level)));
    if (level === levelOf(actor)) return level;
    await item.update({"system.levels":level});
    await syncFeatures(actor);
    await syncHp(actor);
    return level;
  }

  async function reset(actor) {
    const ids = list(actor.items).filter(i => (i.type === "class" && flags(i).fehaClass) || flags(i).classFeature).map(i => i.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("Item",ids);
  }

  // ------------------------------------------------------------ class actions
  const ramModel = actor => globalThis.FEHA_TABLETOP_UI_V3?.model?.(actor) ?? null;

  async function gainRam(actor,amount) {
    const m = ramModel(actor);
    if (!m || !m.maxRam) {
      ui.notifications?.warn?.("No Cyberdeck installed: no RAM to restore.");
      return null;
    }
    const next = Math.min(m.maxRam,m.currentRam + Math.max(0,amount));
    await actor.update({["flags."+FLAG+".ramCurrent"]:next});
    return next - m.currentRam;
  }

  async function announce(actor,html) {
    await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:'<div class="feha-class-note">'+html+'</div>'});
  }

  async function onUse(activity) {
    const item = activity?.item;
    const actor = item?.actor;
    const action = flags(item).classAction;
    if (!action || !actor?.isOwner) return;

    if (action === "breach") {
      const got = await gainRam(actor,Math.max(1,Number(actor.system.abilities.int.mod) || 0));
      if (got === null) return;
      await announce(actor,"<strong>Breach Protocol</strong>: +"+got+" RAM.");
    } else if (action === "overclock") {
      const got = await gainRam(actor,2);
      if (got === null) return;
      const roll = await new Roll("2d6").evaluate();
      await actor.applyDamage([{value:roll.total,type:"psychic"}]);
      await announce(actor,"<strong>Overclock</strong>: +"+got+" RAM, "+roll.total+" psychic damage.");
    } else if (action === "daisy") {
      const cost = Number(flags(actor).lastQuickhackRam) || 0;
      const got = await gainRam(actor,cost);
      if (got === null) return;
      await announce(actor,"<strong>Daisy Chain</strong>: +"+got+" RAM. Upload the same quickhack at a second target within 30 ft of the first.");
    } else if (action === "drone") {
      const token = actor.getActiveTokens?.()[0]?.document ?? null;
      if (!token) return ui.notifications?.warn?.("Put "+actor.name+" on the map to launch the drone.");
      const payload = {actorId:actor.id,sceneId:token.parent.id,x:token.x,y:token.y,userId:game.user.id};
      if (game.user.isGM) await launchDrone(payload);
      else {
        const gm = game.users.activeGM;
        if (!gm) return ui.notifications?.warn?.("A GM has to be online to launch the drone.");
        await gm.query(CH,{kind:"drone",payload},{timeout:15000});
      }
      await announce(actor,"<strong>FPV Drone</strong> is up.");
    }
  }

  // Runs on the GM: one drone actor per Techie, owned by the Techie's owners,
  // and a token for it next to the Techie. Tagged as a camera token so FEHA's
  // camera vision lets its owners see through it.
  async function launchDrone({actorId,sceneId,x,y}) {
    const techie = game.actors.get(actorId);
    const scene = game.scenes.get(sceneId);
    if (!techie || !scene) throw new Error("Drone: Techie or scene not found.");
    const level = Math.max(1,levelOf(techie));
    const owners = Object.fromEntries(Object.entries(techie.ownership).filter(([k,v]) => k !== "default" && v >= 3));
    let drone = game.actors.find(a => flags(a).droneOf === techie.id);
    const name = "DRONE // "+techie.name;
    const base = {
      "system.attributes.hp.max":5*level,"system.attributes.hp.value":5*level,
      "system.attributes.ac.flat":14,"system.attributes.ac.calc":"flat",
      "system.attributes.movement.fly":60,"system.attributes.movement.walk":0,"system.attributes.movement.hover":true,
      "system.attributes.senses.darkvision":60,ownership:{default:0,...owners}
    };
    if (!drone) {
      const folder = game.folders.find(f => f.type === "Actor" && f.name === "Camera") ?? null;
      drone = await Actor.create({name,type:"npc",img:"icons/magic/perception/eye-tendrils-web-purple.webp",folder:folder?.id ?? null,
        flags:{[FLAG]:{droneOf:techie.id}},
        prototypeToken:{name,actorLink:true,width:0.5,height:0.5,disposition:1,texture:{src:"icons/magic/perception/eye-tendrils-web-purple.webp"}}},{renderSheet:false});
    }
    await drone.update(base);
    for (const t of list(scene.tokens).filter(t => t.actorId === drone.id)) await t.delete();
    const grid = scene.grid.size;
    await scene.createEmbeddedDocuments("Token",[{
      name,actorId:drone.id,actorLink:true,x:x + grid,y,width:0.5,height:0.5,disposition:1,elevation:10,
      texture:{src:drone.img},sight:{enabled:true,range:60,angle:360,visionMode:"darkvision"},
      flags:{[FLAG]:{cameraToken:{enabled:true,ownerUserId:Object.keys(owners)[0] ?? null,createdAt:new Date().toISOString()},drone:true}}
    }]);
    return true;
  }

  async function onQuery({kind,payload} = {}) {
    if (!game.user.isGM) return false;
    if (kind === "drone") return launchDrone(payload);
    return false;
  }

  // ------------------------------------------------------------ player picker
  let picking = false;

  async function pick(actor) {
    if (picking || !actor || classItem(actor)) return null;
    picking = true;
    try {
      const card = ([key,c]) => `
        <label class="feha-class-card">
          <input type="radio" name="cls" value="${key}">
          <img src="${esc(c.img)}" alt="">
          <strong>${esc(c.name)}</strong>
          <span>${esc(c.blurb)}</span>
          <em>HP ${c.hpBase} + CON. Saves ${c.saves.map(s => s.toUpperCase()).join(", ")}.</em>
          <ul>${Object.entries(c.features).map(([lv,fs]) => "<li><b>"+lv+"</b> "+fs.map(f => esc(f.name)).join(", ")+"</li>").join("")}</ul>
        </label>`;
      const result = await foundry.applications.api.DialogV2.wait({
        window:{title:"Choose "+actor.name+"'s class"},
        position:{width:760},
        content:`<style>
          .feha-class-pick{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
          .feha-class-card{display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid #4a2a2e;background:#120b0d;cursor:pointer}
          .feha-class-card:has(input:checked){border-color:#ffd34d;box-shadow:0 0 0 1px #ffd34d inset}
          .feha-class-card input{display:none}
          .feha-class-card img{width:42px;height:42px;border:0}
          .feha-class-card strong{font-size:16px;color:#ffd34d;letter-spacing:.06em;text-transform:uppercase}
          .feha-class-card span,.feha-class-card em{font-size:12px}
          .feha-class-card ul{margin:0;padding-left:0;list-style:none;font-size:12px}
          .feha-class-card li b{display:inline-block;width:14px;color:#ff4f64}
          </style>
          <p>Pick a class. It starts at level 1; the GM levels the crew up to 5. Ask the GM if you need to change it later.</p>
          <div class="feha-class-pick">${Object.entries(CLASSES).map(card).join("")}</div>`,
        buttons:[
          {action:"ok",label:"Lock it in",default:true,callback:(event,button) => button.form.elements.cls.value || null},
          {action:"later",label:"Later"}
        ],
        rejectClose:false
      });
      if (!result || result === "later" || !CLASSES[result]) return null;
      const out = await assign(actor,result,1);
      ui.notifications?.info?.(actor.name+" is a "+out.cls+".");
      return out;
    } finally {
      picking = false;
    }
  }

  function promptIfNeeded() {
    if (game.user.isGM) return;
    const actor = game.user.character;
    if (isPC(actor) && actor.isOwner && !classItem(actor)) setTimeout(() => pick(actor),1500);
  }

  // ------------------------------------------------------------ GM crew tool
  async function openCrewTool() {
    if (!game.user.isGM) return;
    const pcs = list(game.actors).filter(isPC);
    const row = a => {
      const c = classOf(a);
      return `<tr data-id="${a.id}"><td>${esc(a.name)}</td><td>${c ? esc(CLASSES[c].name) : "<em>not chosen</em>"}</td><td>${c ? levelOf(a) : "-"}</td><td>${esc(a.system.attributes.hp.value)}/${esc(a.system.attributes.hp.max)}</td>
        <td><button type="button" data-act="down" ${c ? "" : "disabled"}>-1</button><button type="button" data-act="up" ${c ? "" : "disabled"}>+1</button><button type="button" data-act="reset" ${c ? "" : "disabled"}>Reset</button></td></tr>`;
    };
    const content = () => `<p>Level the crew (1-${MAX_LEVEL}). Reset takes a class off so the player picks again.</p>
      <table class="feha-crew"><thead><tr><th>Character</th><th>Class</th><th>Lv</th><th>HP</th><th></th></tr></thead><tbody>${pcs.map(row).join("")}</tbody></table>`;

    const dialog = new foundry.applications.api.DialogV2({
      window:{title:"Crew Level"},position:{width:560},content:content(),
      buttons:[{action:"all",label:"Level up everyone"},{action:"close",label:"Close",default:true}],
      submit:async result => {
        if (result !== "all") return;
        for (const a of pcs) if (classItem(a)) await setLevel(a,levelOf(a)+1);
        ui.notifications?.info?.("Crew levelled up.");
      }
    });
    await dialog.render({force:true});
    dialog.element.addEventListener("click",async event => {
      const btn = event.target.closest("button[data-act]");
      if (!btn) return;
      event.preventDefault();
      const actor = game.actors.get(btn.closest("tr").dataset.id);
      const act = btn.dataset.act;
      try {
        if (act === "up") await setLevel(actor,levelOf(actor)+1);
        if (act === "down") await setLevel(actor,levelOf(actor)-1);
        if (act === "reset") {
          const ok = await foundry.applications.api.DialogV2.confirm({window:{title:"Reset class"},content:"<p>Take "+esc(actor.name)+"'s class and class features off? The player picks a class again next time they load in.</p>"});
          if (ok) await reset(actor);
        }
      } catch (err) {
        ui.notifications?.error?.(err.message);
      }
      dialog.element.querySelector(".feha-crew").outerHTML = content().slice(content().indexOf("<table"));
    });
  }

  function addCrewButton() {
    if (!game.user?.isGM) return;
    const actions = document.querySelector("#actors .directory-header .header-actions");
    if (!actions || actions.querySelector("."+BUTTON_CLASS)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.innerHTML = '<i class="fa-solid fa-arrow-up-right-dots" inert></i> <span>Crew Level</span>';
    button.addEventListener("click",() => openCrewTool());
    actions.appendChild(button);
  }

  // ------------------------------------------------------------ api
  const hooks = [];
  let queryHandler = null;

  const api = {
    VERSION,CLASSES,MAX_LEVEL,
    bonus,classOf,levelOf,assign,setLevel,reset,pick,openCrewTool,launchDrone,

    async init() {
      await api.destroy();
      CONFIG.queries[CH] = queryHandler = onQuery;
      hooks.push(["dnd5e.postUseActivity",Hooks.on("dnd5e.postUseActivity",activity => { void onUse(activity).catch(err => ui.notifications?.error?.(err.message)); })]);
      hooks.push(["renderActorDirectory",Hooks.on("renderActorDirectory",addCrewButton)]);
      // CON changes move max HP; only the active GM writes it.
      hooks.push(["updateActor",Hooks.on("updateActor",(actor,change) => {
        if (game.users.activeGM?.isSelf && classOf(actor) && foundry.utils.hasProperty(change,"system.abilities.con")) void syncHp(actor);
      })]);
      hooks.push(["deleteItem",Hooks.on("deleteItem",item => {
        if (item.type === "class" && flags(item).fehaClass && item.parent === game.user.character) promptIfNeeded();
      })]);
      addCrewButton();
      promptIfNeeded();
      globalThis.FEHA_CLASSES = api;
      if (game.adk) game.adk.classes = api;
      console.log("FEHA CLASSES",VERSION,"ready");
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }
      if (CONFIG.queries?.[CH] === queryHandler) delete CONFIG.queries[CH];
      queryHandler = null;
      document.querySelector("#actors ."+BUTTON_CLASS)?.remove();
      if (globalThis.FEHA_CLASSES === api) delete globalThis.FEHA_CLASSES;
    }
  };

  core.registerModule("classes",api);
  globalThis.FEHA_CLASSES = api;
})();
