// FEHA // CYBERWARE CATALOG
// What every piece of chrome does, written to follow Cyberpunk 2077 and
// Edgerunners as closely as a turn-based table allows.
//
// The installed Chrome Manager module owns installing, slots and capacity
// (capacity cost = Mk, +1 for Operating System and Arms). This file owns the
// item data it reads: slot, Mk, maker, price and effect text, plus the
// machine-readable effect used by FEHA_CYBERWARE_RUNTIME.
//
// Active chrome spends CHARGE: the cyberware capacity a character has left
// unused. See FEHA_CYBERWARE_RUNTIME.

(() => {
  const VERSION = "2.3.0";
  const FLAG = "fleshEnshrouded";
  const BACKUP_KEY = "fehaCyberwareBackup2026-10-01";
  const ROOT_FOLDER = "02 — CYBERWARE";

  const FC = "Frontal Cortex";
  const OS = "Operating System";
  const ARMS = "Arms";
  const FACE = "Face";
  const HANDS = "Hands";
  const SKEL = "Skeleton";
  const NERV = "Nervous System";
  const CIRC = "Circulatory System";
  const SKIN = "Integumentary System";
  const LEGS = "Legs";

  const KUROHANE = "Kurohane Group";
  const BASTION = "Bastion Strategic";
  const VEKTOR = "Vektor Dynamics";
  const HELIX = "Helix Vitae";
  const FORGE = "ForgeLine Industries";
  const JADE = "Jade Arc Systems";
  const CORVUS = "Corvus Neural";

  const PRICE = {1:500,2:1200,3:3000,4:7500,5:18000};
  const AVAILABILITY = {1:"Common",2:"Professional",3:"Restricted",4:"Black Market",5:"Prototype"};
  const POWER_BAND = {1:"Civilian",2:"Professional",3:"Restricted",4:"Elite",5:"Prototype"};
  const PHYSICAL = ["bludgeoning","piercing","slashing"];
  const ALL_DAMAGE = [
    "acid","bludgeoning","cold","fire","force","lightning","necrotic",
    "piercing","poison","psychic","radiant","slashing","thunder"
  ];

  // Active Effect change builders.
  const add = (key,value) => ({key,value:String(value),type:"add"});
  const set = (key,value) => ({key,value:String(value),type:"override"});
  const upgrade = (key,value) => ({key,value:String(value),type:"upgrade"});
  const multiply = (key,value) => ({key,value:String(value),type:"multiply"});

  const skill = (id,value) => add("system.skills."+id+".bonuses.check","+"+value);
  const speed = value => add("system.attributes.movement.walk",value);
  const initiative = value => add("system.attributes.init.bonus","+"+value);
  const armorClass = value => add("system.attributes.ac.bonus","+"+value);
  const darkvision = value => upgrade("system.attributes.senses.darkvision",value);
  const crit19 = () => set("flags.dnd5e.weaponCriticalThreshold",19);
  const attack = (kind,value) => add("system.bonuses."+kind+".attack","+"+value);
  const damage = (kind,value) => add("system.bonuses."+kind+".damage","+"+value);
  const save = (ability,value) => add("system.abilities."+ability+".bonuses.save","+"+value);
  const check = (ability,value) => add("system.abilities."+ability+".bonuses.check","+"+value);
  const resist = (...types) => types.map(type => add("system.traits.dr.value",type));
  const soak = (types,value) => types.map(type => add("system.traits.dm.amount."+type,"-"+value));

  // Durations for activated chrome.
  const untilNextTurn = {value:1,units:"rounds",expiry:"turnStart"};
  // Reactions against one attack: the runtime ends them when the current
  // turn ends (turnOnly); the duration is only a fallback.
  const thisAttack = {value:1,units:"rounds",expiry:"turnStart"};
  const forRounds = value => ({value,units:"rounds",expiry:"turnEnd"});

  // [name, slot, mk, maker, effect text, extras]
  //   changes        applied while installed
  //   active         {charge, action, duration?, changes?, heal?, tempHp?,
  //                   ram?, roll?, halfHp?, statuses?, turnOnly?,
  //                   attackAdvantage?, label?}
  //   hpPerLevel     maximum HP per character level (worked out per actor)
  //   weapon         a weapon the chrome puts in the owner's inventory while
  //                  installed: {name, damage, type, ability, reach, crit?}
  //   smartBonus     attack bonus with Smart weapons
  //   rider          a conditional attack / damage bonus the runtime applies
  //   chargeBonus    extra cyberware charge
  //   chargeDiscount activations cost this much less (slots: only these slots)
  //   regen          HP regained at the start of each of your turns in combat
  //   restHealHalf   regain half max HP on a rest
  //   flags          extra item flags (RAM bonus, weapon handling grants)
  //   deck           a cyberdeck: FEHA_TABLETOP_UI_V3 owns its numbers
  //   deckSpec       numbers for a deck this catalog adds itself
  //   from           a new item: cloned in the world from this existing one
  const ROWS = [
    // ---- Frontal Cortex ----------------------------------------------------
    ["Ram Upgrade",FC,1,CORVUS,"+2 maximum RAM.",{flags:{ramBonus:2}}],
    ["Neuro Matrix",FC,3,CORVUS,"+3 maximum RAM.",{flags:{ramBonus:3}}],
    ["Ex Disk",FC,4,CORVUS,"+5 maximum RAM.",{flags:{ramBonus:5}}],
    ["Memory Boost",FC,2,CORVUS,"Once per turn, when a creature you hit with a Quickhack this turn drops to 0 HP, regain 2 RAM."],
    ["Camillo Ram Manager",FC,3,CORVUS,"Bonus action, once per rest: flush and reallocate memory to regain 4 RAM.",{active:{charge:3,action:"Bonus action",ram:4,oncePerRest:true}}],
    ["Self Ice",FC,2,CORVUS,"+2 to saving throws against hostile Quickhacks. Reaction, when a hostile Quickhack targets you: it fails and its RAM is wasted.",{active:{charge:3,action:"Reaction"}}],
    ["Bio Conductors",FC,3,HELIX,"Activating cyberware costs you 1 less charge (minimum 1).",{chargeDiscount:1}],
    ["Mechatronic Core",FC,4,FORGE,"Your weapon attacks deal +3d6 damage to robots, drones, turrets and mechs, and you have advantage on saving throws against their effects."],
    ["Cogito Frame",FC,5,CORVUS,"+2 to Intelligence checks and saving throws, and your Quickhack save DC increases by 1.",{changes:[check("int",2),save("int",2)],flags:{quickhackDcBonus:1}}],
    ["Detector Rush",FC,1,CORVUS,"+2 to initiative.",{changes:[initiative(2)]}],
    ["Visual Cortex Support",FC,2,CORVUS,"Your weapon attacks score a critical hit on a 19 or 20.",{changes:[crit19()]}],
    ["Charge System",FC,1,JADE,"Auxiliary cell: +2 cyberware charge.",{chargeBonus:2}],
    ["Cyberware Capacity Booster",FC,3,FORGE,"+5 maximum Cyberware Capacity while installed."],
    ["Stamina Regen Booster",FC,1,HELIX,"+5 ft Speed.",{changes:[speed(5)]}],
    ["Rapid Muscle Nourisher",FC,1,HELIX,"+2 to Strength (Athletics) checks.",{changes:[skill("ath",2)]}],
    ["Subdermal Co-Processor",FC,2,CORVUS,"+2 to Dexterity saving throws.",{changes:[save("dex",2)]}],
    ["Rockerboy Interface Tattoo",FC,5,KUROHANE,"+5 to Charisma (Performance, Persuasion and Intimidation) checks, advantage on saving throws against being Charmed or Frightened, and once per rest you can reroll a failed Charisma check.",{changes:[skill("prf",5),skill("per",5),skill("itm",5)]}],
    ["Tactical Icon Processor",FC,4,BASTION,"Bonus action: mark one creature you can see. Until the end of your next turn, you and your allies gain +2 to attack rolls against it.",{active:{charge:3,action:"Bonus action",duration:forRounds(2)}}],
    ["ForgeLine Sigma",FC,4,FORGE,"Load-bearing firmware: you ignore the Strength requirement of every weapon.",{flags:{handling:{negateStrRequirement:true}}}],
    ["Kurohane Shadow",FC,4,KUROHANE,"+5 to Dexterity (Stealth) checks. The first attack you make in a combat while unseen has advantage and deals +3d6 damage.",{changes:[skill("ste",5)]}],
    ["Smart Return Actuator",FC,3,KUROHANE,"Weapons you throw return to your hand at the end of your turn, and your thrown weapon attacks deal +2d6 damage."],
    ["Throwing Ballistic Calibrator",FC,3,BASTION,"+2 to attack rolls with thrown weapons, and the save DC of grenades you throw increases by 1."],
    ["Throwing Range Servos",FC,5,FORGE,"The range of weapons and grenades you throw is doubled, the save DC of your grenades increases by 2, and once per turn you can throw a grenade as a bonus action."],
    ["Oil Dispenser",FC,3,FORGE,"Bonus action: spray a 10-ft square within 15 ft with lubricant for 1 minute. It is difficult terrain, and a creature that enters it or starts its turn there must succeed on a DC 14 Dexterity save or fall Prone.",{active:{charge:2,action:"Bonus action"}}],
    ["Mask CW",FC,3,KUROHANE,"Facial scrambler: cameras and scanners cannot identify you, and you have advantage on checks made to hide your identity."],
    ["Electroshock Mechanism",FC,3,JADE,"When a creature hits you with a melee attack, it takes 3d6 lightning damage."],

    // ---- Operating System --------------------------------------------------
    ["Corvus Paraline",OS,1,CORVUS,null,{deck:true}],
    ["Corvus Netdriver",OS,3,CORVUS,null,{deck:true}],
    ["Haunted Cyberdeck",OS,3,CORVUS,null,{deck:true}],
    ["Tetratronic Rippler",OS,3,FORGE,null,{deck:true}],
    ["Raven Microcyber",OS,4,FORGE,null,{deck:true}],
    ["Corvus Apex Cyberdeck",OS,5,CORVUS,null,{deck:true,from:"Raven Microcyber",deckSpec:{ramMax:14,quickhackSlots:7,effectText:"14 base RAM and 7 loaded Quickhack slots. Once per turn, reduce the RAM cost of a Quickhack costing 4 or more by 2, to a minimum of 1."}}],

    ["Sandevistan C1",OS,1,VEKTOR,"No action, on your turn: time stops for an instant. Immediately move up to your Speed and make one weapon attack. While time is stopped no other creature can move, act or react, and you cannot be targeted.",{active:{charge:3,action:"No action, on your turn",duration:untilNextTurn,turnOnly:true,label:"TIME STOPPED"}}],
    ["Sandevistan C2",OS,2,VEKTOR,"No action, on your turn: time stops. Immediately take one extra turn (movement, action and bonus action). While time is stopped no other creature can move, act or react, and you cannot be targeted.",{active:{charge:5,action:"No action, on your turn",duration:untilNextTurn,turnOnly:true,label:"TIME STOPPED"}}],
    ["Sandevistan C3",OS,3,VEKTOR,"No action, on your turn: time stops. Immediately take one extra turn, and your attacks during it have advantage. While time is stopped no other creature can move, act or react, and you cannot be targeted.",{active:{charge:6,action:"No action, on your turn",duration:untilNextTurn,turnOnly:true,label:"TIME STOPPED",attackAdvantage:true}}],
    ["Sandevistan C4",OS,4,VEKTOR,"No action, on your turn: time stops. Immediately take two extra turns in a row, and your attacks during them have advantage. While time is stopped no other creature can move, act or react, and you cannot be targeted.",{active:{charge:9,action:"No action, on your turn",duration:untilNextTurn,turnOnly:true,label:"TIME STOPPED",attackAdvantage:true}}],
    ["Sandevistan Apogee",OS,5,VEKTOR,"No action, on your turn: time stops. Immediately take three extra turns in a row, and your attacks during them have advantage. While time is stopped no other creature can move, act or react, and you cannot be targeted.",{active:{charge:12,action:"No action, on your turn",duration:untilNextTurn,turnOnly:true,label:"TIME STOPPED",attackAdvantage:true}}],

    ["Berserk C1",OS,1,BASTION,"Bonus action, lasts until the end of your next turn: resistance to bludgeoning, piercing and slashing damage and +1d6 melee damage. You cannot make ranged attacks while it is active.",{active:{charge:3,action:"Bonus action",duration:forRounds(2),changes:[...resist(...PHYSICAL),damage("mwak","1d6")]}}],
    ["Berserk C2",OS,2,BASTION,"Bonus action, lasts until the end of your next turn: gain 10 temporary HP, resistance to bludgeoning, piercing and slashing damage and +2d6 melee damage. You cannot make ranged attacks while it is active.",{active:{charge:4,action:"Bonus action",duration:forRounds(2),tempHp:"10",changes:[...resist(...PHYSICAL),damage("mwak","2d6")]}}],
    ["Berserk C3",OS,3,BASTION,"Bonus action, lasts until the end of your next turn: gain 15 temporary HP, resistance to bludgeoning, piercing and slashing damage and +3d6 melee damage, and you cannot be reduced below 1 HP. You cannot make ranged attacks while it is active.",{active:{charge:6,action:"Bonus action",duration:forRounds(2),tempHp:"15",changes:[...resist(...PHYSICAL),damage("mwak","3d6")]}}],
    ["Berserk C4",OS,4,BASTION,"Bonus action, lasts 3 rounds: gain 25 temporary HP, resistance to bludgeoning, piercing and slashing damage, +4d6 melee damage and advantage on Strength checks and saves, and you cannot be reduced below 1 HP. You cannot make ranged attacks while it is active.",{active:{charge:8,action:"Bonus action",duration:forRounds(3),tempHp:"25",changes:[...resist(...PHYSICAL),damage("mwak","4d6")]}}],
    ["Berserk C5",OS,5,BASTION,"Bonus action, lasts 3 rounds: gain 40 temporary HP, +10 ft Speed, resistance to bludgeoning, piercing and slashing damage, +6d6 melee damage and advantage on Strength checks and saves, and you cannot be reduced below 1 HP. You cannot make ranged attacks while it is active.",{from:"Berserk C4",active:{charge:10,action:"Bonus action",duration:forRounds(3),tempHp:"40",changes:[speed(10),...resist(...PHYSICAL),damage("mwak","6d6")]}}],

    // ---- Arms --------------------------------------------------------------
    ["Power Grip",ARMS,2,FORGE,"Your unarmed strikes deal 5d8 bludgeoning damage. +2 to Athletics checks, and you ignore weapon Strength requirements.",{changes:[skill("ath",2)],weapon:{name:"Power Grip Fists",damage:"5d8",type:"bludgeoning",ability:"str",reach:5}}],
    ["Strong Arms",ARMS,5,FORGE,"Gorilla arms: your unarmed strikes deal 9d10 bludgeoning damage and push the target 10 ft. +5 to Athletics checks, advantage on checks to force doors or break objects, and you ignore weapon Strength requirements.",{changes:[skill("ath",5)],weapon:{name:"Gorilla Arms",damage:"9d10",type:"bludgeoning",ability:"str",reach:5}}],
    ["Mantis Blades",ARMS,3,KUROHANE,"Integrated blades: a melee weapon attack that deals 8d8 slashing damage (finesse). Once per turn, before you attack, you can leap up to 20 ft to your target without provoking opportunity attacks.",{weapon:{name:"Mantis Blades",damage:"8d8",type:"slashing",ability:"dex",finesse:true,reach:5}}],
    ["Mantis Blades Apex",ARMS,5,KUROHANE,"Integrated blades: a melee weapon attack that deals 12d8 slashing damage (finesse) and scores a critical hit on a 19 or 20. Once per turn, before you attack, you can leap up to 30 ft to your target without provoking opportunity attacks.",{from:"Mantis Blades",weapon:{name:"Mantis Blades Apex",damage:"12d8",type:"slashing",ability:"dex",finesse:true,reach:5,crit:19}}],
    ["Nano Wires",ARMS,5,KUROHANE,"Monowire: a melee weapon attack that deals 9d8 slashing damage (finesse, reach 15 ft). One swing can strike two creatures within 5 ft of each other; roll one attack and compare it to both.",{weapon:{name:"Monowire",damage:"9d8",type:"slashing",ability:"dex",finesse:true,reach:15}}],
    ["Projectile Launcher",ARMS,3,BASTION,"Action: fire an explosive round at a point within 90 ft. Each creature within 10 ft of it takes 8d6 damage, or half on a successful DC 14 Dexterity save.",{active:{charge:4,action:"Action",roll:"8d6"}}],
    ["Projectile Launcher Apex",ARMS,5,BASTION,"Action: fire a heavy explosive round at a point within 120 ft. Each creature within 15 ft of it takes 12d6 damage, or half on a successful DC 16 Dexterity save.",{from:"Projectile Launcher",active:{charge:5,action:"Action",roll:"12d6"}}],

    // ---- Face --------------------------------------------------------------
    ["Kiroshi Optics",FACE,2,CORVUS,"+2 to Perception and Investigation checks that rely on sight, and darkvision out to 60 ft.",{changes:[skill("prc",2),skill("inv",2),darkvision(60)]}],
    ["Kiroshi Optics Piercing",FACE,2,CORVUS,"+2 to Perception checks that rely on sight, and you can see the outlines of creatures through up to 1 ft of wall within 30 ft.",{changes:[skill("prc",2)]}],
    ["Kiroshi Optics Hunter",FACE,5,CORVUS,"+4 to Perception checks that rely on sight. Your ranged attacks ignore cover and have no disadvantage at long range, and once per turn a ranged hit from 60 ft or more deals +3d10 damage.",{changes:[skill("prc",4)]}],
    ["Kiroshi Optics Combined",FACE,4,CORVUS,"+3 to Perception and Investigation checks that rely on sight, darkvision out to 120 ft, and you can see Invisible creatures within 30 ft.",{changes:[skill("prc",3),skill("inv",3),darkvision(120)]}],
    ["Iconic Kiroshi Optics Bare",FACE,4,CORVUS,"+3 to Perception and Investigation checks that rely on sight, darkvision out to 120 ft, and your weapon attacks score a critical hit on a 19 or 20.",{changes:[skill("prc",3),skill("inv",3),darkvision(120),crit19()]}],
    ["Trouble Finder",FACE,5,CORVUS,"+5 to Perception checks, you cannot be surprised, you have advantage on initiative rolls, and you sense hidden creatures, traps and electronics within 60 ft.",{changes:[skill("prc",5),set("flags.dnd5e.initiativeAdv",true)]}],

    // ---- Hands -------------------------------------------------------------
    ["Smart Link",HANDS,3,JADE,"+2 to attack rolls with Smart weapons, and they ignore half and three-quarters cover.",{smartBonus:2}],
    ["Smartlink Tattoo",HANDS,4,KUROHANE,"+2 to attack rolls with Smart weapons, they ignore half and three-quarters cover, and you have no disadvantage on ranged attacks for having a hostile creature next to you.",{smartBonus:2}],
    ["Syndicate Interface Tattoo",HANDS,1,KUROHANE,"Gang-ink smart link: you can use the targeting of Smart weapons, and gain +1 to attack rolls with them.",{smartBonus:1}],
    ["Gun Stabilizer",HANDS,4,BASTION,"You ignore weapon Strength requirements, and you have no disadvantage on ranged attacks for having a hostile creature next to you."],
    ["Ballistic Coprocessor",HANDS,5,BASTION,"+2 to ranged attack rolls, your weapon attacks score a critical hit on a 19 or 20, and once per turn you can reroll a ranged attack that missed.",{from:"Gun Stabilizer",changes:[attack("rwak",2),crit19()]}],
    ["Discharge Connector",HANDS,2,JADE,"You have advantage on reload checks, and drawing or stowing a weapon costs you nothing.",{flags:{handling:{reloadAdvantage:true}}}],
    ["Shock Absorber",HANDS,3,BASTION,"+1 to ranged attack rolls, and you ignore the LMG Brace penalty for moving.",{changes:[attack("rwak",1)]}],
    ["Knife Sharpener",HANDS,4,KUROHANE,"Blades you wield, including Mantis Blades, deal +2d8 damage and score a critical hit on a 19 or 20.",{rider:"sharpBlades"}],

    // ---- Skeleton ----------------------------------------------------------
    ["Titanium Infused Bones",SKEL,1,FORGE,"+2 to Athletics checks, your carrying capacity doubles, and falling damage you take is halved.",{changes:[skill("ath",2)]}],
    ["Joint Lock",SKEL,1,FORGE,"Advantage on saving throws against being knocked Prone or moved against your will."],
    ["Bionic Joints",SKEL,2,FORGE,"+1 to ranged attack rolls.",{changes:[attack("rwak",1)]}],
    ["Endoskeleton",SKEL,2,FORGE,"Your maximum HP increases by 4 per level.",{hpPerLevel:4}],
    ["Compiling Skeleton",SKEL,2,FORGE,"+2 to Constitution saving throws.",{changes:[save("con",2)]}],
    ["Reinforced Muscles",SKEL,2,FORGE,"+2 to Athletics checks, and you ignore weapon Strength requirements.",{changes:[skill("ath",2)]}],
    ["Bone Marrow Cells",SKEL,3,HELIX,"Your maximum HP increases by 6 per level.",{hpPerLevel:6}],
    ["Dense Marrow",SKEL,4,FORGE,"+2d6 melee and unarmed damage, and advantage on saving throws against being moved against your will.",{changes:[damage("mwak","2d6")]}],
    ["Cyber Rotors",SKEL,3,FORGE,"Microrotors: +1 to melee attack rolls and +1d8 melee damage.",{changes:[attack("mwak",1),damage("mwak","1d8")]}],

    // ---- Nervous System ----------------------------------------------------
    ["Kerenzikov",NERV,4,VEKTOR,"Reaction, when an attack targets you: time slows. Gain +4 AC against that attack, then move up to 15 ft without provoking opportunity attacks. Your next attack before the end of your next turn has advantage.",{active:{charge:3,action:"Reaction",duration:thisAttack,turnOnly:true,changes:[armorClass(4)]}}],
    ["Kerenzikov Boost System",NERV,4,VEKTOR,"Your Nervous System reactions (Kerenzikov, Reflex Recorder, Proximity Reducer) cost 1 less charge (minimum 1), and once per round you can use one of them without spending your reaction.",{chargeDiscount:1,discountSlots:[NERV]}],
    ["Reflex Recorder",NERV,3,VEKTOR,"Reaction, when an attack targets you: gain +3 AC against that attack.",{active:{charge:2,action:"Reaction",duration:thisAttack,turnOnly:true,changes:[armorClass(3)]}}],
    ["Proximity Reducer",NERV,1,VEKTOR,"Reaction, when an attack targets you: gain +2 AC against that attack.",{active:{charge:1,action:"Reaction",duration:thisAttack,turnOnly:true,changes:[armorClass(2)]}}],
    ["Synaptic Accelerator",NERV,3,VEKTOR,"+3 to initiative, you cannot be surprised, and you have advantage on attack rolls during the first round of combat.",{changes:[initiative(3)]}],
    ["Catch Me If You Can",NERV,2,VEKTOR,"+5 ft Speed, and opportunity attacks against you are made with disadvantage.",{changes:[speed(5)]}],
    ["Time Bank",NERV,2,VEKTOR,"Reserve capacitor: +3 cyberware charge.",{chargeBonus:3}],
    ["Neo Fiber",NERV,2,VEKTOR,"+2 to Dexterity saving throws.",{changes:[save("dex",2)]}],
    ["No Pain No Gain",NERV,3,BASTION,"While you are below half your maximum HP, you gain +2 to attack rolls and +2d6 to weapon damage rolls.",{rider:"woundedFury"}],
    ["Pain Distributor",NERV,3,HELIX,"Resistance to psychic damage, and advantage on saving throws against being Stunned or Incapacitated.",{changes:[...resist("psychic")]}],
    ["Pain Reductor",NERV,3,HELIX,"Pain editor: reduce all damage you take by 4.",{changes:[...soak(ALL_DAMAGE,4)]}],
    ["Tyrosine Injector",NERV,5,HELIX,"+5 to initiative, and +15 ft Speed during the first round of combat.",{changes:[initiative(5)]}],

    // ---- Circulatory System ------------------------------------------------
    ["Biomonitor",CIRC,1,HELIX,"Reaction, when you drop below half your maximum HP: regain 3d8 + your proficiency bonus HP.",{active:{charge:2,action:"Reaction",heal:"3d8 + @prof"}}],
    ["Blood Pump",CIRC,4,HELIX,"Bonus action: regain 6d8 + 10 HP.",{active:{charge:6,action:"Bonus action",heal:"6d8 + 10"}}],
    ["Sudden Aid",CIRC,4,HELIX,"Bonus action: you or a creature you touch regains 4d8 + your Constitution modifier HP and ends the Poisoned, Blinded, Deafened or Stunned condition. Target the creature first to treat someone else.",{active:{charge:4,action:"Bonus action",heal:"4d8 + @abilities.con.mod",healsTarget:true}}],
    ["Heal On Kill",CIRC,2,HELIX,"Once per turn, when you reduce a hostile creature to 0 HP, regain 2d8 HP."],
    ["Blood Depleter",CIRC,3,KUROHANE,"Your melee attacks deal +2d6 damage to creatures that are below half their maximum HP.",{rider:"bloodDepleter"}],
    ["Enhanced Blood Vessels",CIRC,3,HELIX,"When you finish a rest, regain HP equal to half your maximum.",{restHealHalf:true}],
    ["Viral Venom",CIRC,4,HELIX,"Once per turn, one of your melee hits also deals 3d6 poison damage, and the target must succeed on a DC 15 Constitution save or be Poisoned until the end of its next turn."],
    ["Micro Generator",CIRC,4,JADE,"Reaction, when you take damage: discharge. Each creature within 10 ft of you takes 6d6 lightning damage, or half on a successful DC 15 Dexterity save.",{active:{charge:4,action:"Reaction",roll:"6d6"}}],
    ["Regeneration Lattice",CIRC,3,HELIX,"At the start of each of your turns in combat, if you have at least 1 HP and are below your maximum, regain 5 HP.",{regen:5}],
    ["Second Heart",CIRC,5,HELIX,"Reaction, when you drop to 0 HP: your second heart kicks in and you are instead set to half your maximum HP.",{active:{charge:10,action:"Reaction",halfHp:true}}],

    // ---- Integumentary System ----------------------------------------------
    ["Nano Tech Plates",SKIN,1,BASTION,"Reduce bludgeoning, piercing and slashing damage you take by 2.",{changes:[...soak(PHYSICAL,2)]}],
    ["Heavy Reactive Plating",SKIN,2,BASTION,"Reduce bludgeoning, piercing and slashing damage you take by 3, and you have advantage on saving throws against being knocked Prone.",{changes:[...soak(PHYSICAL,3)]}],
    ["Reactive Plating",SKIN,3,BASTION,"Reduce bludgeoning, piercing and slashing damage you take by 4. A creature that hits you with a melee attack takes 2d6 piercing damage.",{changes:[...soak(PHYSICAL,4)]}],
    ["Subdermal Plating",SKIN,3,BASTION,"Subdermal armor: reduce bludgeoning, piercing and slashing damage you take by 6.",{changes:[...soak(PHYSICAL,6)]}],
    ["Subdermal Skin Lattice",SKIN,4,BASTION,"+1 AC, and reduce bludgeoning, piercing and slashing damage you take by 5.",{changes:[armorClass(1),...soak(PHYSICAL,5)]}],
    ["Chiton",SKIN,5,BASTION,"Chitin shell: +2 AC, and reduce bludgeoning, piercing and slashing damage you take by 6.",{changes:[armorClass(2),...soak(PHYSICAL,6)]}],
    ["Optical Camo",SKIN,3,KUROHANE,"Bonus action: you become Invisible until the end of your next turn. Attacking does not end it.",{active:{charge:5,action:"Bonus action",duration:forRounds(2),statuses:["invisible"]}}],

    // ---- Legs --------------------------------------------------------------
    ["Boosted Tendons",LEGS,1,FORGE,"Your jump distance is doubled and you gain +5 ft Speed.",{changes:[speed(5)]}],
    ["Jenkins Tendons",LEGS,3,FORGE,"+10 ft Speed, and you can Dash as a bonus action.",{changes:[speed(10)]}],
    ["Iconic Jenkins Tendons",LEGS,4,FORGE,"+15 ft Speed, and you can Dash as a bonus action.",{changes:[speed(15)]}],
    ["Agile Joints",LEGS,4,FORGE,"+10 ft Speed, your jump distance is tripled, and you take no damage from falls of 30 ft or less.",{changes:[speed(10)]}],
    ["Cat Paws",LEGS,5,KUROHANE,"Lynx paws: +5 to Stealth checks and +10 ft Speed. You can move at full speed while sneaking, and you take no damage from falls of 40 ft or less.",{changes:[skill("ste",5),speed(10)]}]
  ];

  const norm = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const slug = value => norm(value).replace(/\s+/g,"-");

  const esc = value => String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  const definitions = ROWS.map(([name,slot,mk,company,effectText,extra]) => ({
    key:slug(name),
    name,
    slot,
    mk,
    company,
    effectText,
    capacityCost:mk + (slot === OS || slot === ARMS ? 1 : 0),
    price:PRICE[mk],
    ...(extra ?? {})
  }));

  const byName = new Map(definitions.map(def => [norm(def.name),def]));

  function isCyberware(item) {
    return (
      item?.documentName === "Item" &&
      item.flags?.[FLAG]?.sourceCategory === "Cyberware"
    );
  }

  function definition(value) {
    if (!value) return null;
    if (typeof value === "string") return byName.get(norm(value)) ?? null;

    return (
      byName.get(norm(value.flags?.[FLAG]?.originalLibraryName)) ??
      byName.get(norm(value.name)) ??
      null
    );
  }

  const mkLabel = mk => "Mk." + ["0","I","II","III","IV","V"][mk];

  function activationLine(def) {
    if (def.deck) {
      return (
        "CYBERDECK // "+def.ramMax+" RAM // "+def.quickhackSlots+
        " QUICKHACK SLOTS"
      );
    }

    if (!def.active) return "PASSIVE // ALWAYS ON WHILE INSTALLED";
    return (
      "ACTIVE // "+String(def.active.action).toUpperCase()+
      " // "+def.active.charge+" CHARGE"
    );
  }

  function describe(def) {
    const cell = (label,value) =>
      '<div><small style="color:#8ca2ac">'+label+'</small><br><strong style="color:#fff">'+esc(value)+'</strong></div>';

    return (
      '<section data-feha-ui="item-card-v1" data-feha-cyberware-card="'+VERSION+'" '+
      'style="border:1px solid #2b5662;background:#071116;padding:13px 14px;color:#dce8ec !important">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:9px;border-bottom:1px solid #263941">'+
          '<small style="color:#72dff2;font-size:10px;font-weight:900;letter-spacing:.12em">'+
            esc(def.company.toUpperCase())+' // CYBERWARE'+
          '</small>'+
          '<strong style="color:#eefaff;font-size:12px">'+mkLabel(def.mk)+'</strong>'+
        '</div>'+
        '<h2 style="margin:10px 0 4px;color:#fff">'+esc(def.name)+'</h2>'+
        '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px;padding:10px 0;border-top:1px solid #1f3239;border-bottom:1px solid #1f3239">'+
          cell("BODY SLOT",def.slot.toUpperCase())+
          cell("CAPACITY",String(def.capacityCost))+
          cell("MARKET","CR "+Number(def.price).toLocaleString())+
        '</div>'+
        '<div style="margin-top:10px;padding:10px;border:1px solid #24404a;background:#09171c">'+
          '<small style="display:block;color:#72dff2;font-size:10px;font-weight:900;letter-spacing:.11em;margin-bottom:5px">EFFECT</small>'+
          '<p style="margin:0;line-height:1.5;color:#dce8ec !important">'+esc(def.effectText)+'</p>'+
        '</div>'+
        '<div style="margin-top:10px;padding:9px 10px;border-left:3px solid #4b7180;background:#0a151a">'+
          '<small style="display:block;color:#7ee6ff;font-size:10px;font-weight:900;letter-spacing:.11em">'+esc(activationLine(def))+'</small>'+
          (def.active
            ? '<p style="margin:4px 0 0;line-height:1.45;color:#b9cbd2 !important">Charge is your unused Cyberware Capacity. It returns when you rest.</p>'
            : '')+
        '</div>'+
      '</section>'
    );
  }

  const same = (a,b) => {
    try { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); }
    catch { return a === b; }
  };

  function updateData(item,def,folderId=null) {
    const flags = item.flags?.[FLAG] ?? {};
    const update = {};

    // The catalog folder is organised by maker; a world item follows its maker.
    if (
      folderId &&
      !item.parent &&
      String(item.folder?.id ?? "") !== String(folderId)
    ) {
      update.folder = folderId;
    }

    const flagValues = {
      cyberwareCatalogVersion:VERSION,
      manufacturer:def.company,
      company:def.company,
      originalLibraryName:def.name,
      cyberwareSlot:def.slot,
      rating:def.mk,
      tier:def.mk,
      mk:def.mk,
      ratingLabel:mkLabel(def.mk),
      cyberwarePowerBand:POWER_BAND[def.mk],
      availability:AVAILABILITY[def.mk]
    };

    if (def.deckSpec) {
      Object.assign(flagValues,{
        cyberdeck:true,
        ramMax:def.deckSpec.ramMax,
        quickhackSlots:def.deckSpec.quickhackSlots,
        effectText:def.deckSpec.effectText
      });
    }

    // Cyberdecks keep the numbers FEHA_TABLETOP_UI_V3 reads from them.
    if (!def.deck) {
      Object.assign(flagValues,{
        cyberwareCapacityCost:def.capacityCost,
        priceCredits:def.price,
        effectText:def.effectText,
        cyberwareActive:Boolean(def.active),
        cyberwareChargeCost:def.active?.charge ?? 0,
        needsReview:false,
        ...(def.flags ?? {})
      });
    }

    for (const [key,value] of Object.entries(flagValues)) {
      if (!same(flags[key],value)) {
        update["flags."+FLAG+"."+key] = value;
      }
    }

    const system = item.system ?? {};

    // A cyberdeck keeps its own numbers and effect text (FEHA_TABLETOP_UI_V3
    // reads them from the item); only its card and price are brought in line
    // with the rest of the catalog.
    if (def.deck) {
      const deckCard = describe({
        ...def,
        effectText:def.deckSpec?.effectText ?? flags.effectText ?? "",
        ramMax:def.deckSpec?.ramMax ?? (Number(flags.ramMax) || 0),
        quickhackSlots:def.deckSpec?.quickhackSlots ?? (Number(flags.quickhackSlots) || 0)
      });

      if (String(system.description?.value ?? "") !== deckCard) {
        update["system.description.value"] = deckCard;
      }

      if (system.price && Number(system.price.value ?? 0) !== def.price) {
        update["system.price.value"] = def.price;
      }

      // A deck is not something you activate; no USE counter.
      if (system.uses && String(system.uses.max ?? "") !== "") {
        update["system.uses.max"] = "";
      }

      for (const [key,value] of Object.entries({
        cyberwareCapacityCost:def.capacityCost,
        priceCredits:def.price,
        needsReview:false
      })) {
        if (!same(flags[key],value)) update["flags."+FLAG+"."+key] = value;
      }

      return update;
    }

    const description = describe(def);

    if (String(system.description?.value ?? "") !== description) {
      update["system.description.value"] = description;
    }

    if (system.price && Number(system.price.value ?? 0) !== def.price) {
      update["system.price.value"] = def.price;
    }

    // The Chrome Manager only shows a USE button when the item has uses.
    // Charge, not this counter, is what limits active chrome.
    const wantMax = def.active ? "1" : "";

    if (system.uses) {
      if (String(system.uses.max ?? "") !== wantMax) {
        update["system.uses.max"] = wantMax;
      }

      if (Number(system.uses.spent ?? 0) !== 0) {
        update["system.uses.spent"] = 0;
      }

      if (list(system.uses.recovery).length) {
        update["system.uses.recovery"] = [];
      }
    }

    return update;
  }

  async function backupOnce(items) {
    if (!game.settings?.settings?.has?.("world."+BACKUP_KEY)) {
      game.settings.register("world",BACKUP_KEY,{
        scope:"world",
        config:false,
        type:Object,
        default:{}
      });
    }

    const existing = game.settings.get("world",BACKUP_KEY) ?? {};
    if (Object.keys(existing).length) return false;

    const snapshot = {};

    for (const item of items) {
      snapshot[item.uuid] = {
        name:item.name,
        flags:foundry.utils.deepClone(item.flags?.[FLAG] ?? {}),
        description:item.system?.description?.value ?? "",
        price:item.system?.price?.value ?? null,
        uses:foundry.utils.deepClone(item.system?.uses ?? null)
      };
    }

    await game.settings.set("world",BACKUP_KEY,snapshot);
    return true;
  }

  // One folder per maker under the cyberware catalog folder. Returns a map of
  // maker -> folder id, or an empty map if the catalog folder is not there.
  async function makerFolders() {
    const root = list(game.folders).find(folder =>
      folder.type === "Item" && folder.name === ROOT_FOLDER
    );
    const folders = new Map();
    if (!root) return folders;

    for (const company of new Set(definitions.map(def => def.company))) {
      const folder =
        list(game.folders).find(candidate =>
          candidate.type === "Item" &&
          candidate.name === company &&
          String(candidate.folder?.id ?? "") === String(root.id)
        ) ??
        await Folder.create({name:company,type:"Item",folder:root.id,sorting:"a"});

      folders.set(company,folder.id);
    }

    return folders;
  }

  // Catalog entries with `from` do not exist in the world yet: each is
  // created once as a copy of its template (same art, same catalog flags) and
  // then filled in by the normal migration.
  async function createMissing() {
    const created = [];

    for (const def of definitions.filter(entry => entry.from)) {
      const exists = list(game.items).some(item =>
        isCyberware(item) && item.name === def.name
      );
      if (exists) continue;

      const template = list(game.items).find(item =>
        isCyberware(item) && item.name === def.from
      );

      if (!template) {
        console.warn("FEHA CYBERWARE // no template for",def.name,"<-",def.from);
        continue;
      }

      const data = template.toObject();
      delete data._id;
      data.name = def.name;
      data.flags[FLAG] = {
        ...data.flags[FLAG],
        originalLibraryName:def.name,
        catalogSourceUuid:null
      };

      await Item.create(data,{renderSheet:false});
      created.push(def.name);
    }

    return created;
  }

  function allCyberware() {
    return [
      ...list(game.items).filter(isCyberware),
      ...list(game.actors).flatMap(actor =>
        list(actor.items).filter(isCyberware)
      )
    ];
  }

  async function migrateAll() {
    if (!game.user?.isGM) {
      return {skipped:true,updated:0,unknown:[]};
    }

    const created = await createMissing();
    const items = allCyberware();
    const folders = await makerFolders();
    const pending = [];
    const unknown = new Set();

    for (const item of items) {
      const def = definition(item);

      if (!def) {
        unknown.add(item.name);
        continue;
      }

      const update = updateData(item,def,folders.get(def.company) ?? null);
      if (Object.keys(update).length) pending.push([item,update]);
    }

    if (pending.length) {
      await backupOnce(items);

      for (const [item,update] of pending) {
        await item.update(update);
      }
    }

    const result = {
      skipped:false,
      version:VERSION,
      catalog:definitions.length,
      updated:pending.length,
      created,
      unknown:[...unknown]
    };

    console.log("FEHA CYBERWARE CATALOG",result);
    return result;
  }

  globalThis.FEHA_CYBERWARE_CATALOG = {
    version:VERSION,
    definitions,
    definition,
    isCyberware,
    migrateAll,
    backupKey:BACKUP_KEY
  };
})();
