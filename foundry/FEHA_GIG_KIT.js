// FEHA // GIG KIT
//
// Everything a GM needs to run a job from the board (FEHA_JOBS):
//
//   runSheet(job)   how to run it: the hook, beats (where, what happens,
//                   checks, enemies), named NPCs, the twist and the wrap-up.
//                   Written gigs carry their own (job.run); every other job
//                   gets one built from its fixer, spot, enemies and kind.
//   rewardFor(job)  what it pays besides credits: items from this world's
//                   catalogs and sometimes a favour. Written gigs name theirs
//                   (job.reward); others get items matched to level and kind.
//   prep(job)       GM: builds the gig's kit in the world: a Scene folder with
//                   a clean copy of each beat's battle map and a compact
//                   journal (run sheet with recommended enemies, plus a player
//                   handout). cleanup(prep) removes it again.
//   giveReward(...) GM: hands reward items to crew members.
//
// On load it only hooks gig journals so they open compact; the rest is
// called by the board.

(() => {
  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const ROOT = "GIGS";
  const CATS = ["01 — WEAPONS","02 — CYBERWARE","03 — ARMOR","04 — GRENADES","05 — QUICKHACKS","06 — CONSUMABLES","FIREARMS"];

  const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const norm = v => String(v ?? "").normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
  const city = () => globalThis.FEHA_CITY ?? null;
  const cat = () => globalThis.FEHA_JOB_CATALOG ?? null;
  const fixerOf = job => cat()?.FIXERS?.find(f => f.key === job?.fixer) ?? null;
  const npcApi = () => globalThis.FEHA_CYBER_CORE?.module?.("npcCatalog") ?? game.adk?.npcs ?? null;
  const npcDefs = () => npcApi()?.definitions ?? [];

  // Seeded random from a string, so a job's reward and auto beats stay the
  // same every time they are looked at.
  function seeded(seed) {
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0),16777619);
    return () => {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15),t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7),t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sceneFor(name) {
    if (!name) return null;
    const lower = norm(name);
    return game.scenes.find(s => s.name === name) ?? game.scenes.find(s => norm(s.name) === lower) ??
      game.scenes.find(s => norm(s.name).startsWith(lower)) ?? null;
  }

  // A beat's "at": a city spot id ("22"), "scene:<scene name or prefix>", or
  // "<spot>@<scene name>" for a pin whose own battle map doesn't fit the beat
  // (the stairwell or the roof of a block rather than its usual map).
  function resolveAt(at) {
    if (!at) return {label:null,scene:null,spot:null};
    const split = String(at).match(/^([^@:]+)@(.+)$/);
    if (split) {
      const place = city()?.place?.(split[1]);
      return {label:place?.label ?? split[1],scene:sceneFor(split[2]),spot:place?.id ?? null};
    }
    if (String(at).startsWith("scene:")) {
      const name = String(at).slice(6);
      const scene = sceneFor(name);
      return {label:scene?.name ?? name,scene,spot:null};
    }
    const place = city()?.place?.(String(at));
    return {label:place?.label ?? String(at),scene:sceneFor(place?.map),spot:place?.id ?? null};
  }

  // ---------------------------------------------------------- run sheets

  const KIND_CHECKS = {
    "Recovery":["Investigation or Streetwise DC 12 to find where it's kept","Stealth DC 13 to reach it unseen, or Intimidation DC 14 to make them hand it over"],
    "Delivery":["Perception DC 12 to spot the tail","Deception DC 13 at the checkpoint, or Athletics DC 13 to take the long way over the rooftops"],
    "Theft":["Stealth DC 14 to get in unseen","Sleight of Hand or Tech DC 14 for the lock or safe","Each failure raises the alarm one step"],
    "Sabotage":["Tech DC 14 to break it so it looks like an accident (DC 10 if they don't care)","Stealth DC 13 to get out before anyone checks"],
    "Bounty":["Streetwise DC 13 to track the target","Insight DC 12 to read whether they'll run, bargain or fight"],
    "Cyberpsycho":["Medicine or Tech DC 14 on a downed psycho to shut the chrome off safely (non-lethal)","Persuasion DC 16 can buy one round of hesitation"],
    "Protection":["Perception DC 13 each hour of the watch to spot trouble early","Insight DC 13 to spot the inside man"],
    "Rescue":["Stealth DC 13 to reach the captive","Medicine DC 12 to move them without making it worse","Athletics DC 12 to carry them out under fire"],
    "Data Heist":["Tech or Netrunning DC 14 to break the ICE","Each failed check gives the defenders a trace (3 traces = they know who you are)"],
    "Collection":["Intimidation or Persuasion DC 13 to get paid without a fight","Insight DC 12 to see why they can't pay"],
    "Smuggling":["Deception DC 13 at each checkpoint","Driving or Athletics DC 12 if it turns into a chase"],
    "Investigation":["Investigation DC 13 for each solid lead (three solves it)","Persuasion DC 12 to get a witness talking"],
    "Extraction":["Stealth DC 14 to reach the package","Persuasion DC 13 if the package doesn't want to come"]
  };

  // Built for jobs without a written run sheet: meet the fixer, do the job,
  // get paid.
  function autoRun(job) {
    const f = fixerOf(job);
    const enemies = job.enemies ?? [];
    const beats = [];
    if (f?.spot) beats.push({at:f.spot,title:"The meet",text:`${f.handle} lays out the job. Pay is ${(job.pay ?? 0).toLocaleString("en-US")} each, half up front if the crew asks nicely. ${job.brief ?? ""}`});
    // The job's own battle map, labelled with its city pin when it has one.
    const jobAt = job.spot && job.map ? job.spot + "@" + job.map : job.spot ?? (job.map ? "scene:" + job.map : null);
    beats.push({at:jobAt,title:"The job",
      text:(job.objectives ?? []).join(". ") + ".",checks:KIND_CHECKS[job.kind] ?? [],enemies});
    if (job.twist) beats.push({at:jobAt,title:"The turn",text:job.twist});
    if (f?.spot) beats.push({at:f.spot,title:"Payday",text:`Back to ${f.handle} to get paid.`});
    return {hook:f ? `“${f.voice}” — ${f.handle}` : "",beats,npcs:[],wrap:"Pay out on the board. Partial results: pay less, or keep the cred."};
  }

  function runSheet(job) {
    const raw = job.run ?? autoRun(job);
    const beats = (raw.beats ?? []).map((b,i) => {
      const where = resolveAt(b.at);
      return {n:i + 1,title:b.title ?? "Beat " + (i + 1),text:b.text ?? "",checks:b.checks ?? [],enemies:b.enemies ?? [],
        at:b.at ?? null,label:where.label,scene:where.scene,spot:where.spot};
    });
    // People: the gig's own list, the extra people book (FEHA_GIGS_PEOPLE)
    // and, for generated gigs, whoever the brief is about.
    const people = [...(raw.npcs ?? []),...(globalThis.FEHA_GIG_PEOPLE?.[job.key] ?? []),...(job.people ?? [])];
    return {hook:raw.hook ?? "",beats,npcs:people.map(([name,base,note]) => ({name,base,note})),
      wrap:raw.wrap ?? "",twist:job.twist ?? "",written:Boolean(job.run)};
  }

  // Every enemy across the beats (or the job's list), merged.
  function enemiesOf(job) {
    const out = new Map();
    const beats = job.run?.beats ?? [];
    const lists = beats.some(b => b.enemies?.length) ? beats.map(b => b.enemies ?? []) : [job.enemies ?? []];
    for (const list of lists) for (const [name,count] of list) out.set(name,(out.get(name) ?? 0) + count);
    return [...out.entries()];
  }

  // -------------------------------------------------------------- rewards

  function itemBand(item) {
    const f = item.flags?.[FLAG] ?? {};
    return Number(f.mk ?? f.tier ?? f.cyberwareTier ?? f.band ?? f.marketBand) || null;
  }

  function itemCat(item) {
    const top = item.folder?.folder?.name ?? item.folder?.name ?? "";
    return CATS.find(c => top === c) ?? null;
  }

  let pools = null;
  function rewardPools() {
    if (pools) return pools;
    pools = {};
    for (const item of game.items) {
      const c = itemCat(item);
      if (!c || c === "05 — QUICKHACKS") continue;
      if (/UNIQUE/i.test(item.folder?.name ?? "")) continue;
      const band = c === "06 — CONSUMABLES" ? 0 : itemBand(item);
      if (band == null) continue;
      ((pools[c] ??= {})[band] ??= []).push(item.name);
    }
    return pools;
  }

  const KIND_LOOT = {
    "Theft":["02 — CYBERWARE","FIREARMS"],"Data Heist":["02 — CYBERWARE","06 — CONSUMABLES"],
    "Bounty":["FIREARMS","03 — ARMOR"],"Protection":["03 — ARMOR","FIREARMS"],
    "Delivery":["06 — CONSUMABLES","04 — GRENADES"],"Smuggling":["04 — GRENADES","FIREARMS"],
    "Rescue":["06 — CONSUMABLES","03 — ARMOR"],"Recovery":["FIREARMS","02 — CYBERWARE"],
    "Sabotage":["04 — GRENADES","03 — ARMOR"],"Collection":["FIREARMS","06 — CONSUMABLES"],
    "Cyberpsycho":["02 — CYBERWARE","04 — GRENADES"],"Investigation":["02 — CYBERWARE","06 — CONSUMABLES"],
    "Extraction":["03 — ARMOR","02 — CYBERWARE"]
  };

  // Item reward for a job without a written one: one piece of kit at the
  // job's level that fits the kind of work, and a consumable on the low end.
  function autoReward(job) {
    const rnd = seeded(job.key ?? job.id);
    const pick = list => list?.length ? list[Math.floor(rnd() * list.length)] : null;
    const P = rewardPools();
    const tier = Math.max(1,Math.min(5,job.tier ?? 1));
    const prefs = KIND_LOOT[job.kind] ?? ["FIREARMS","06 — CONSUMABLES"];
    const items = [];
    const c = prefs[Math.floor(rnd() * prefs.length)];
    const band = c === "06 — CONSUMABLES" ? 0 : tier;
    const main = pick(P[c]?.[band]) ?? pick(P[c]?.[Math.max(1,band - 1)]) ?? pick(P["06 — CONSUMABLES"]?.[0]);
    if (main) items.push(c === "06 — CONSUMABLES" || c === "04 — GRENADES" ? main + " x2" : main);
    if (tier <= 2) {
      const extra = pick(P["06 — CONSUMABLES"]?.[0]);
      if (extra && !items.some(i => i.startsWith(extra))) items.push(extra);
    }
    const f = fixerOf(job);
    const favor = f && rnd() < 0.25 ? `${f.handle} owes the crew a favour (one free tip, ride or contact).` : null;
    return {items,favor};
  }

  // [{name, qty, item}] plus the favour.
  function rewardFor(job) {
    const raw = job.reward ?? autoReward(job);
    const items = (raw.items ?? []).map(entry => {
      const m = String(entry).match(/^(.*?)(?:\s+x(\d+))?$/);
      const name = m[1].trim();
      return {name,qty:Number(m[2] ?? 1),item:game.items.getName(name) ?? null};
    });
    return {items,favor:raw.favor ?? null,written:Boolean(job.reward)};
  }

  function rewardText(job) {
    const r = rewardFor(job);
    const parts = r.items.map(i => (i.qty > 1 ? i.qty + "× " : "") + i.name);
    if (r.favor) parts.push(r.favor);
    return parts.join(" · ");
  }

  // GM: put a reward item on a crew member's sheet.
  async function giveItem(actor,name,qty = 1) {
    const source = game.items.getName(name);
    if (!actor || !source) return false;
    const data = source.toObject();
    delete data._id;
    delete data.folder;
    if (qty > 1 && data.system && "quantity" in data.system) data.system.quantity = qty;
    const docs = qty > 1 && !(data.system && "quantity" in data.system) ? Array.from({length:qty},() => foundry.utils.deepClone(data)) : [data];
    await actor.createEmbeddedDocuments("Item",docs);
    return true;
  }

  // ---------------------------------------------------------------- prep

  async function folderFor(type,name,parent = null) {
    const found = game.folders.find(f => f.type === type && f.name === name && (f.folder?.id ?? null) === (parent?.id ?? null));
    return found ?? Folder.create({name,type,folder:parent?.id ?? null,sorting:"a"});
  }

  // The board's own NPCs: one of every catalog NPC in the Actors folder
  // "GIG NPCs", sorted by faction, ready to drag onto a gig map. Kept apart
  // from the campaign's imported NPCs so gigs never touch those.
  const NPC_ROOT = "GIG NPCs";
  const poolActor = d => game.actors.find(a => a.flags?.[FLAG]?.npcKey === d.key && a.flags?.[FLAG]?.gigPool) ?? null;

  // GM: create whichever GIG NPCs are missing (all of them the first time).
  async function stockNpcs(keys = null,{people = !keys} = {}) {
    if (!game.user.isGM || !npcApi()?.import) return null;
    const todo = npcDefs().filter(d => (!keys || keys.includes(d.key)) && !poolActor(d)).map(d => d.key);
    const result = todo.length ? await npcApi().import({keys:todo,root:NPC_ROOT,pool:true}) : {created:[],missing:{}};
    if (people) result.people = await stockPeople();
    return result;
  }

  // The people in each gig (the bartender, the old priest): one NPC each,
  // built from their base catalog NPC, in GIG NPCs / People / <fixer> /
  // <gig>. Every gig has its own, so two gigs' "kid"s are never mixed up.
  const PEOPLE = "People";
  const personName = role => {
    const s = String(role ?? "").replace(/^(the|his|her|a|an)\s+/i,"").trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const personGroup = job => job.for ? "Personal" : (fixerOf(job)?.handle ?? "Other");
  const personKey = (job,n) => job.key + ":" + personName(n.name).toLowerCase();
  const personActor = (job,n) => game.actors.find(a => a.flags?.[FLAG]?.gigPerson === personKey(job,n)) ?? null;

  // ------------------------------------------------- gig people stat blocks
  // Every gig person gets a stat block that fits who they are. Fighters
  // (a base catalog NPC that fights: thugs, cops, netrunners) keep that NPC's
  // stats and gear; everyone else is built from an archetype below. The bio
  // tells the GM their part in the gig, how to handle them and what they do
  // if it turns violent. DCs scale with the gig's level.
  const PERSON_TYPES = {
    child:{label:"Child",ab:[6,14,10,10,11,11],hp:6,ac:11,size:"sm",skills:["ste","slt","prc"],gear:false,
      who:"A child. Small, quick and frightened, or braver than is sensible.",
      talk:dc => `Kindness works (Persuasion DC ${dc - 3}). Threats make them cry, freeze or bolt.`,
      fight:"Doesn't fight. Hides, runs or freezes. Anyone who hurts a child answers for it."},
    elder:{label:"Elder",ab:[7,8,9,11,14,11],hp:7,ac:10,skills:["ins","his","med"],gear:false,
      who:"Old, slow on the stairs and quick in the head. Has seen worse than the crew.",
      talk:dc => `Respect opens them up (Persuasion DC ${dc - 2}). Pressure shuts them for good (Intimidation DC ${dc + 4}).`,
      fight:"Can't fight. Will stand in the doorway anyway."},
    clergy:{label:"Clergy",ab:[9,9,10,12,15,14],hp:9,ac:10,skills:["rel","ins","per","med"],gear:false,
      who:"Keeps a congregation going in a city that would rather it didn't.",
      talk:dc => `Talks to anyone (Persuasion DC ${dc - 2}) and is hard to lie to (Deception DC ${dc + 3}).`,
      fight:"Won't fight. Shields others and prays loudly."},
    medic:{label:"Medic",ab:[10,12,11,14,14,11],hp:12,ac:11,skills:["med","ins","prc"],gear:"medical",
      who:"Patches people up for a living. Calm hands, tired eyes.",
      talk:dc => `Cares about patients first (Persuasion DC ${dc}). Bribes work if someone sick benefits.`,
      fight:"Ducks, then treats whoever is bleeding, on either side."},
    official:{label:"Official",ab:[9,10,10,14,12,13],hp:10,ac:10,skills:["inv","ins","per","dec"],gear:false,
      who:"Paperwork, rules and a desk between them and the crew.",
      talk:dc => `Follows procedure (Persuasion DC ${dc + 1}); a bribe or the right forms (Deception DC ${dc}) go further. Intimidation works but gets reported.`,
      fight:"Hits the alarm, then hides under the desk."},
    executive:{label:"Executive",base:"kurohane-executive",ab:[10,11,11,15,13,15],hp:18,ac:12,skills:["dec","per","ins","his"],gear:true,
      who:"Corporate. Used to being obeyed and to someone else doing the shooting.",
      talk:dc => `Negotiates hard (Persuasion DC ${dc + 3}) and lies smoothly (beat their Deception with Insight DC ${dc + 2}). Leverage beats charm.`,
      fight:"Calls security, then shoots only to get to the exit."},
    tech:{label:"Tech",ab:[9,12,10,15,12,10],hp:10,ac:11,skills:["inv","arc","prc"],gear:false,
      who:"Knows how the machines work. Usually more than they're paid to.",
      talk:dc => `Respects competence (a Tech/Int check DC ${dc} earns their help); Persuasion DC ${dc}.`,
      fight:"Unplugs something important and runs."},
    worker:{label:"Worker",ab:[13,11,13,9,11,10],hp:13,ac:11,skills:["ath","prc","sur"],gear:false,
      who:"Hard hands, long shifts, short patience for corps and cops.",
      talk:dc => `Straight talk works (Persuasion DC ${dc - 1}); talking down to them doesn't.`,
      fight:"Swings a tool if cornered. Mostly gets their mates out."},
    merchant:{label:"Trader",base:"shopkeeper",ab:[10,11,11,12,13,14],hp:14,ac:11,skills:["per","ins","dec"],gear:true,
      who:"Buys, sells and remembers who owes what.",
      talk:dc => `Everything has a price (Persuasion DC ${dc}, cheaper with a deal). Spots a bluff (Insight DC ${dc + 1}).`,
      fight:"Warns once, fires once from behind the counter, then hides."},
    organizer:{label:"Organiser",base:"organizer",ab:[10,11,12,13,14,16],hp:16,ac:11,skills:["per","ins","prf","his"],gear:true,
      who:"Holds the neighbourhood together with meetings, lists and nerve.",
      talk:dc => `On the people's side (Persuasion DC ${dc - 2} if the crew is too). Won't be bullied (Intimidation DC ${dc + 4}).`,
      fight:"Gets everyone out the back while someone else buys time."},
    journalist:{label:"Journalist",base:"journalist",ab:[9,13,10,14,13,13],hp:12,ac:11,skills:["inv","ste","per","prc"],gear:true,
      who:"Records everything. Wants the story more than safety.",
      talk:dc => `Trades in information (Persuasion DC ${dc}). Anything said near them may end up on air.`,
      fight:"Hides and keeps recording."},
    ai:{label:"AI",type:"construct",ab:[1,1,10,18,14,14],hp:1,ac:10,skills:["dec","ins","inv"],gear:false,
      who:"Not a body: a voice in the speakers or in the crew's implants. No token needed; the NPC is here for its sheet.",
      talk:dc => `Reasons like a person (Persuasion DC ${dc + 1}); a Tech/Int check DC ${dc + 2} gets past its guard.`,
      fight:"Can't be shot. Can lock doors, cut lights and call for help."},
    animal:{label:"Animal",type:"beast",ab:[13,14,12,3,12,7],hp:9,ac:12,size:"sm",skills:["prc"],gear:false,
      who:"An animal.",
      talk:dc => `Animal Handling DC ${dc - 2}.`,
      fight:"Bites if its person is threatened."},
    civilian:{label:"Civilian",ab:[10,10,10,10,11,10],hp:9,ac:10,skills:["prc","ins"],gear:false,
      who:"An ordinary person caught up in this.",
      talk:dc => `Helps if it's safe (Persuasion DC ${dc}). Scares easily (Intimidation DC ${dc - 2}), but will remember it.`,
      fight:"Runs. Might tell CivCorp afterwards."}
  };

  const AGE_WORDS = {seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,
    eighteen:18,nineteen:19,twenty:20,sixty:60,seventy:70,eighty:80,ninety:90};
  function ageOf(note) {
    // An age is a number said as one: "Nine,", "Ninety-four.", "Twelve-year-old",
    // "Sixty years old". "Twelve evicted families" or "Block 6" are not ages.
    const s = String(note ?? "").toLowerCase();
    const m = s.match(/\b(seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|sixty|seventy|eighty|ninety)(-(?:one|two|three|four|five|six|seven|eight|nine))?(?=[,.]|-year| years? old)/);
    if (m) return AGE_WORDS[m[1]] + (m[2] ? 4 : 0);
    const n = s.match(/\b(\d{1,2})(?:-year| years? old)/);
    return n ? Number(n[1]) : null;
  }

  // Which archetype a non-fighting person is. The role's last word is who
  // they are ("the boy's dad" is a dad); their age, when the note gives one,
  // wins for children and the very old.
  function personType(n) {
    const role = String(n.name ?? "").toLowerCase();
    const head = role.split(/\s+/).pop() ?? "";
    const note = String(n.note ?? "").toLowerCase();
    const age = ageOf(n.note);
    if (/\bai\b|uploaded mind|concierge/.test(role + " " + note) || /\bvoice\b/.test(role)) return "ai";
    if (/^(the )?dog$/.test(role)) return "animal";
    if ((age !== null && age < 17) || (age === null && /^(kid|kids|boy|girl|child|son|daughter|teenager|pickpocket|student|queen)$/.test(head))) return "child";
    if ((age !== null && age >= 70) || /\b(old|grand|elder|widow|granny|babcia|grandfather|grandmother|oldest)\b/.test(role)) {
      return /\b(priest|preacher|nun|monk)\b/.test(role) ? "clergy" : "elder";
    }
    if (/\b(priest|preacher|nun|choirmaster|monk)\b/.test(role)) return "clergy";
    if (n.base === "ripperdoc" || /\b(nurse|doctor|doc|medic|coroner|pharmacist|surgeon)\b/.test(role)) return "medic";
    if (n.base === "kurohane-executive" || /\b(executive|ceo|director|councillor|board member|founder|negotiator|envoy|land agent|corp buyer|developer)\b/.test(role)) return "executive";
    if (n.base === "journalist" || /\b(journalist|anchor|broadcaster|photographer|reporter)\b/.test(role)) return "journalist";
    if (/\b(engineer|tech|technician|operator|projectionist|printer|scientist|researcher|archivist|analyst|rigger|forger|spotter|switchman|chemist)\b/.test(role)) return "tech";
    if (n.base === "organizer" || n.base === "union-steward" || /\b(steward|organiser|organizer|strike|spokes|activist|volunteer|candidate|leader of|teacher)\b/.test(role)) return "organizer";
    if (/\b(clerk|inspector|lawyer|attorney|judge|supervisor|manager|registrar|interviewer|assessor|admissions|paymaster|station master|harbour master|claims|warden|speaker|curator|cadet|officer)\b/.test(role) && !/\bstore manager\b/.test(role)) return "official";
    if (n.base === "shopkeeper" || /\b(owner|vendor|stallholder|trader|dealer|fence|bookie|landlord|slumlord|seller|buyer|broker|auctioneer|bartender|host|cook|chef)\b/.test(role)) return "merchant";
    if (/\b(worker|driver|fisherman|dockworker|mechanic|farmer|diver|boatman|crane|repairman|foreman|gravedigger|scav|keeper|butler|pilot|captain|bosun|loadmaster|courier|smuggler|switchman|sailor|dad|father)\b/.test(role)) return "worker";
    return "civilian";
  }

  // NPC catalog keys that are fighters keep their own stat block.
  const FIGHTER_SKILLS = {
    "street-netrunner":["inv","ste","arc"],"civcorp-netrunner":["inv","arc","prc"],"corvus-netrunner":["inv","arc","dec"],
    "kurohane-netrunner":["inv","arc","prc"],"drowned-runner":["inv","arc","ste"],"drowned-oracle":["inv","arc","ins"],
    "street-fixer":["per","ins","dec","itm"],"kurohane-agent":["dec","ins","ste","prc"],"kurohane-officer":["dec","ins","inv","itm"],
    "yakuza-kobun":["itm","ath","prc"],"yakuza-enforcer":["itm","ath","ins"],"yakuza-blade":["acr","ste","prc"],"yakuza-wakagashira":["itm","ins","dec","per"]
  };
  // Rank-and-file units: their people share one look (officers don't).
  const TROOP_RE = /^(civcorp-|bastion-(?!commander)|vigil-(?!captain)|navy-|private-guard$|kurohane-(trooper|guard|elite|sniper|oni|kage|agent|netrunner)$)/;
  const isFighter = key => {
    const def = npcDefs().find(d => d.key === key);
    return Boolean(def && def.hostile !== false);
  };

  // People whose role makes them a fighter even though their gig lists them
  // as a civilian: [role pattern, NPC catalog key to build from].
  const ROLE_FIGHTERS = [
    [/\b(peacekeeper|desk sergeant|last officer|officer who wants out|checkpoint officer|records officer)\b/,"civcorp-peacekeeper"],
    [/\bblockade sergeant\b/,"civcorp-rifleman"],
    [/\b(depot sergeant|range sergeant|bastion guard)\b/,"bastion-trooper"],
    [/\bcolonel\b/,"bastion-commander"],
    [/\bconvoy commander\b/,"kurohane-elite"],
    [/\b(night guard|gate guard|^guard$|guard)\b/,"private-guard"],
    [/\bcivcorp netrunner\b|\binfiltrator\b/,"civcorp-netrunner"],
    [/\bkurohane netrunner\b/,"kurohane-netrunner"],
    [/^runner$/,"street-netrunner"],
    [/\bsniper\b/,"kurohane-sniper"],
    [/\bbully\b/,"kurohane-officer"],
    [/\brecruiter\b|^handler$/,"kurohane-agent"],
    [/^(oyabun|rival boss)$/,"yakuza-wakagashira"],
    [/\b(admiral|fleet admiral)\b/,"navy-marine"],
    [/\bdeserter\b|^brother$/,"navy-rating"],
    [/\bbig sparker\b/,"sparker"],
    [/^boxer$|\bstriker fighter\b/,"bouncer"],
    [/\bfake sergeant\b/,"street-gunner"],
    [/\bpatrol captain\b/,"kurohane-guard"]
  ];
  // One-off fixes by gig: "<gig key>:<role>" -> archetype or {base}.
  const PERSON_FIXES = {
    "velvet-velvet-secret:daughter":"civilian",
    "kiyama-debt-collector-2:old man":{base:"kurohane-kage"},
    "ferro-hammer-time:foreman":{base:"bouncer"},
    "babka-wake:dead striker's brother":{base:"street-thug"},
    "kiyama-bathhouse-blackmail:lieutenant":{base:"yakuza-enforcer"},
    "duval-payroll-ship:lieutenant":{base:"navy-marine"},
    "rhea-convoy-ghost:clan driver":{base:"street-gunner"},
    "vesna-jukebox:kid's father":"official",
    "padre-prize-fish:steward":"worker",
    "hale-cryo-heir:heir":"executive",
    "hale-forge-strike:labour chief":"executive",
    "dialtone-memory-market:head of research":"tech",
    "dialtone-primetime:producer":"tech",
    "hale-black-ledger:croupier":"merchant",
    "hale-mayor-ghost:sancho vargas":"elder",
    "dialtone-ghost:cafe owner":"merchant",
    "babka-underthewall:refugee":"civilian",
    "duval-rally:speaker":"organizer",
    "velvet-dog-show:handler":"worker",
    "clerk-causeofdeath:coroner":"medic",
    "hale-board-vote:nurse":"medic"
  };

  // What a gig person is: {fighter:true, base} (keeps that NPC's stat block)
  // or {type} (an archetype above).
  function personKind(job,n) {
    const role = personName(n.name).toLowerCase();
    const fix = PERSON_FIXES[job.key + ":" + role];
    if (fix?.base) return {fighter:true,base:fix.base};
    if (typeof fix === "string") return {type:fix};
    // Kennel people are listed under the dog; only actual dogs use its block.
    if (n.base === "kennel-dog" && !/\b(dogs?|hounds?|mutt)\b/.test(role)) return {fighter:true,base:"kennel-houndmaster"};
    if (isFighter(n.base)) return {fighter:true,base:n.base};
    const hit = ROLE_FIGHTERS.find(([re]) => re.test(role));
    if (hit && !/^(kid|boy|girl)/.test(role)) return {fighter:true,base:hit[1]};
    return {type:personType(n)};
  }

  function scenesWith(job,n) {
    const words = personName(n.name).toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !/^(the|with|from|and|old|man)$/.test(w));
    const hits = runSheet(job).beats.filter(b => words.some(w => (b.title + " " + b.text).toLowerCase().includes(w)));
    return hits.map(b => `${b.n}. ${b.title}`);
  }

  // The stat block and write-up for one gig person, as overrides on the
  // base actor's data.
  function personData(job,n,baseData) {
    const tier = Math.max(1,Math.min(5,Number(job.tier) || 1));
    const dc = 10 + tier;
    const kind = personKind(job,n);
    const def = npcDefs().find(d => d.key === (kind.base ?? n.base)) ?? null;
    const type = kind.fighter ? null : PERSON_TYPES[kind.type];
    const data = baseData ? foundry.utils.deepClone(baseData) : {type:"npc",system:{},items:[]};
    delete data._id;
    const name = personName(n.name);
    data.name = name;
    data.type = "npc";
    const sys = data.system ??= {};
    if (type) {
      const keys = ["str","dex","con","int","wis","cha"];
      sys.abilities = Object.fromEntries(keys.map((k,i) => [k,{value:type.ab[i]}]));
      const hp = Math.round(type.hp * (1 + (tier - 1) * 0.15));
      foundry.utils.setProperty(sys,"attributes.hp",{value:hp,max:hp});
      foundry.utils.setProperty(sys,"attributes.ac",{calc:"flat",flat:type.ac});
      foundry.utils.setProperty(sys,"details.cr",type.label === "Executive" ? 0.25 : 0);
      foundry.utils.setProperty(sys,"details.type",{value:type.type === "construct" ? "construct" : type.type === "beast" ? "beast" : "humanoid"});
      foundry.utils.setProperty(sys,"traits.size",type.size ?? "med");
      // Gear: only what this kind of person would carry.
      if (type.gear === false) data.items = [];
      else if (type.gear === "medical") data.items = (data.items ?? []).filter(i => !["weapon"].includes(i.type));
    }
    const skills = type ? type.skills : (FIGHTER_SKILLS[kind.base] ?? ["ath","itm","prc"]);
    for (const s of skills) foundry.utils.setProperty(sys,`skills.${s}.value`,1);

    const scenes = scenesWith(job,n);
    const fixer = fixerOf(job);
    const sections = [
      `<p><strong>${esc(job.title)}</strong>${fixer ? ` · ${esc(fixer.handle)}` : ""}${job.for ? ` · about ${esc(job.for)}` : ""}</p>`,
      `<p><strong>Role:</strong> ${esc(n.note ?? "")}</p>`,
      `<p><strong>Shows up:</strong> ${scenes.length ? esc(scenes.join(", ")) : "wherever you need them in this gig"}.</p>`,
      `<p><strong>Who they are:</strong> ${esc(type ? type.who : def && def.name.toLowerCase() === name.toLowerCase() ? def.bio : `A fighter. Uses the ${def?.name ?? "street"} stat block and gear.`)}</p>`,
      `<p><strong>Dealing with them:</strong> ${esc(type ? type.talk(dc) : `They're dangerous. Talking them down: Persuasion or Intimidation DC ${dc + 2}; seeing through them: Insight DC ${dc + 1}.`)}</p>`,
      `<p><strong>If it gets violent:</strong> ${esc(type ? type.fight : (def?.tactics ?? "Fights."))}</p>`
    ];
    foundry.utils.setProperty(sys,"details.biography.value",sections.join(""));

    foundry.utils.setProperty(data,"prototypeToken.name",name);
    foundry.utils.setProperty(data,"prototypeToken.appendNumber",false);
    foundry.utils.setProperty(data,"prototypeToken.actorLink",false);
    foundry.utils.setProperty(data,"prototypeToken.disposition",CONST.TOKEN_DISPOSITIONS.NEUTRAL);
    if (type?.size === "sm") {
      foundry.utils.setProperty(data,"prototypeToken.width",1);
      foundry.utils.setProperty(data,"prototypeToken.height",1);
    }
    const flags = {...(data.flags?.[FLAG] ?? {})};
    delete flags.npcKey; delete flags.gigPool;
    data.flags = {...(data.flags ?? {}),[FLAG]:{...flags,gigPerson:personKey(job,n),npcBase:n.base ?? null,personType:type?.label ?? "Fighter",gigTier:tier}};
    // Troopers wear their unit's look; anyone else is their own person, so
    // they don't inherit the base NPC's portrait.
    if (!(kind.fighter && TROOP_RE.test(kind.base))) {
      data.img = "icons/svg/mystery-man.svg";
      foundry.utils.setProperty(data,"prototypeToken.texture.src","icons/svg/mystery-man.svg");
    }
    return data;
  }

  // The base catalog NPC a person is built from: fighters keep their own,
  // others take their archetype's base for its gear (the executive's pistol,
  // the trader's gun under the counter) or the civilian.
  const personBase = (job,n) => { const k = personKind(job,n); return k.fighter ? k.base : (PERSON_TYPES[k.type]?.base ?? "civilian"); };

  async function stockPeople(jobs = cat()?.JOBS ?? [],{rebuild = false} = {}) {
    if (!game.user.isGM) return [];
    const want = new Map();
    for (const job of jobs) {
      for (const n of runSheet(job).npcs) {
        const key = personKey(job,n);
        if (!want.has(key)) want.set(key,{key,job,n,group:personGroup(job),gig:String(job.title).slice(0,60)});
      }
    }
    let todo = [...want.values()];
    // A rebuild keeps each person's portrait and token art.
    const looks = new Map();
    if (rebuild) {
      const old = game.actors.filter(a => want.has(a.flags?.[FLAG]?.gigPerson)).map(a => a.id);
      for (const id of old) { const a = game.actors.get(id); if (!/mystery-man/.test(a.img)) looks.set(a.flags[FLAG].gigPerson,{img:a.img,tok:a.prototypeToken.texture.src}); }
      for (let i = 0; i < old.length; i += 50) await Actor.deleteDocuments(old.slice(i,i + 50));
    } else todo = todo.filter(e => !game.actors.find(a => a.flags?.[FLAG]?.gigPerson === e.key));
    if (!todo.length) return [];
    const bases = await ensureNpcs([...new Set(todo.map(e => personBase(e.job,e.n)).concat("civilian"))]);
    const root = await folderFor("Actor",NPC_ROOT);
    const people = await folderFor("Actor",PEOPLE,root);
    const groups = new Map();
    const made = [];
    for (const e of todo) {
      if (!groups.has(e.group)) groups.set(e.group,await folderFor("Actor",e.group,people));
      const gigKey = e.group + "/" + e.gig;
      if (!groups.has(gigKey)) groups.set(gigKey,await folderFor("Actor",e.gig,groups.get(e.group)));
      const base = bases.get(personBase(e.job,e.n)) ?? bases.get("civilian") ?? null;
      const data = personData(e.job,e.n,base?.toObject() ?? null);
      data.folder = groups.get(gigKey).id;
      data.img ??= "icons/svg/mystery-man.svg";
      const look = looks.get(e.key);
      if (look) { data.img = look.img; foundry.utils.setProperty(data,"prototypeToken.texture.src",look.tok); }
      made.push(data);
    }
    const created = [];
    for (let i = 0; i < made.length; i += 25) created.push(...await Actor.create(made.slice(i,i + 25),{renderSheet:false}));
    return created.map(a => a.name);
  }

  // The GIG NPCs a gig needs (stocked if missing), as name -> actor.
  async function ensureNpcs(names) {
    const defs = npcDefs();
    const want = [...new Set(names)].map(n => defs.find(d => d.name === n || d.key === n)).filter(Boolean);
    const have = poolActor;
    const missing = want.filter(d => !have(d)).map(d => d.key);
    if (missing.length) {
      try { await stockNpcs(missing); } catch (err) { console.warn("FEHA GIG KIT // NPC import failed",err); }
    }
    const out = new Map();
    for (const d of want) { const a = have(d); if (a) { out.set(d.name,a); out.set(d.key,a); } }
    return out;
  }

  // Enemy suggestions for the whole gig: name -> {actor, count, where}.
  function opposition(sheet,actors) {
    const out = new Map();
    for (const b of sheet.beats) for (const [name,count] of b.enemies) {
      const e = out.get(name) ?? {name,actor:actors.get(name) ?? null,count:0,where:[]};
      e.count += count;
      e.where.push(b.n);
      out.set(name,e);
    }
    return [...out.values()];
  }

  // The run sheet as building blocks: short, scannable, nothing the GM
  // has to follow word for word.
  function sheetHtml(job,sheet,links,actors) {
    const f = fixerOf(job);
    const r = rewardFor(job);
    const risk = cat()?.TIERS?.[job.tier]?.label ?? "";
    const beat = b => {
      const mapName = b.scene?.name ?? b.label ?? "—";
      const map = links.scenes[b.n] ? `@UUID[${links.scenes[b.n]}]{${esc(mapName)}}` : esc(mapName);
      const place = b.label && b.label !== mapName ? ` <span class="gk-dim">· ${esc(b.label)}</span>` : "";
      const foes = b.enemies.map(([n,c]) => `${esc(n)}${c > 1 ? " ×" + c : ""}`).join(", ");
      return `<div class="gk-beat"><p class="gk-bh"><b>${b.n}</b> ${esc(b.title)}</p>
<p class="gk-map">Map: ${map}${place}</p>
<p>${esc(b.text)}</p>
${b.checks.length ? `<p class="gk-small"><b>Checks</b> ${b.checks.map(esc).join(" · ")}</p>` : ""}
${foes ? `<p class="gk-small"><b>Opposition</b> ${foes}</p>` : ""}</div>`;
    };
    const foes = opposition(sheet,actors).map(e =>
      `<li>${e.actor ? `@UUID[${e.actor.uuid}]{${esc(e.name)}}` : esc(e.name)} <span class="gk-dim">×${e.count} · scene ${e.where.join(", ")}</span></li>`).join("");
    const people = sheet.npcs.map(n => {
      const actor = personActor(job,n);
      return `<li><b>${actor ? `@UUID[${actor.uuid}]{${esc(personName(n.name))}}` : esc(personName(n.name))}</b>${n.note ? ` — ${esc(n.note)}` : ""}</li>`;
    }).join("");
    return `<div class="feha-gig">
<p class="gk-meta"><b>${esc(f?.handle ?? "")}</b> · ${esc(risk)} · ${esc(job.kind)} · €$ ${Number(job.pay ?? 0).toLocaleString("en-US")} each · +${job.cred ?? 0} cred</p>
<p class="gk-tip">Building blocks, not a script. Rename, cut, swap or stretch anything.</p>
${sheet.hook ? `<h3>Hook</h3><p><em>${esc(sheet.hook)}</em></p>` : ""}
<h3>The job</h3><p>${esc(job.brief)}</p>
${(job.objectives ?? []).length ? `<ul>${job.objectives.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
<h3>Scenes</h3>${sheet.beats.map(beat).join("")}
${foes ? `<h3>Recommended enemies</h3><ul class="gk-list">${foes}</ul><p class="gk-small gk-dim">Drag them in as you need them. Scale the numbers to your table.</p>` : ""}
${people ? `<h3>People</h3><ul class="gk-list">${people}</ul><p class="gk-small gk-dim">Their NPCs are in GIG NPCs → People. Name them yourself.</p>` : ""}
${sheet.twist ? `<h3>Twist (optional)</h3><p>${esc(sheet.twist)}</p>` : ""}
${sheet.wrap ? `<h3>Endings</h3><p>${esc(sheet.wrap)}</p>` : ""}
<h3>Reward</h3><p>€$ ${Number(job.pay ?? 0).toLocaleString("en-US")} each${r.items.length ? " · " + r.items.map(i => (i.qty > 1 ? i.qty + "× " : "") + esc(i.name)).join(", ") : ""}${r.favor ? `<br><span class="gk-dim">Favour: ${esc(r.favor)}</span>` : ""}</p>
<p class="gk-small gk-dim">Pay out from the Jobs board: GM desk → the job → Pay out.</p>
</div>`;
  }

  function handoutHtml(job) {
    const f = fixerOf(job);
    return `<p><strong>${esc(f?.handle ?? "")}</strong>: “${esc(f?.voice ?? "")}”</p><h2>${esc(job.title)}</h2><p>${esc(job.brief)}</p>
${(job.objectives ?? []).length ? `<ol>${job.objectives.map(o => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}
<p><strong>Pay:</strong> ${Number(job.pay ?? 0).toLocaleString("en-US")} credits each.</p>`;
  }

  // GM: build the gig's kit: a clean copy of each beat's battle map and a
  // compact journal. Enemies are only recommended (catalog NPCs linked in
  // the journal, imported if missing); nothing is placed on the maps.
  async function prep(job) {
    if (!game.user.isGM) throw new Error("GM only.");
    const sheet = runSheet(job);
    const title = String(job.title).slice(0,48);
    const sceneRoot = await folderFor("Scene",ROOT);
    const sceneFolder = await folderFor("Scene",title,sceneRoot);
    const journalRoot = await folderFor("JournalEntry",ROOT);

    const actors = await ensureNpcs(sheet.beats.flatMap(b => b.enemies.map(([n]) => n)));
    if (sheet.npcs.length) await stockPeople([job]);
    const links = {scenes:{}};
    const made = {scenes:[]};

    // A copy of each beat's map (once per map) so the GM can drop tokens and
    // draw on it without touching the original.
    const copies = new Map();
    for (const b of sheet.beats) {
      if (!b.scene) continue;
      let copy = copies.get(b.scene.id);
      if (!copy) {
        const data = b.scene.toObject();
        delete data._id;
        data.name = `GIG · ${title} · ${b.n}. ${b.title}`;
        data.folder = sceneFolder.id;
        data.navigation = false;
        data.active = false;
        data.ownership = {default:0};
        data.tokens = [];
        foundry.utils.setProperty(data,`flags.${FLAG}.gigScene`,job.id);
        foundry.utils.setProperty(data,`flags.${FLAG}.gigSource`,b.scene.id);
        copy = await Scene.create(data);
        copies.set(b.scene.id,copy);
        made.scenes.push(copy.id);
      }
      links.scenes[b.n] = copy.uuid;
    }

    const journal = await JournalEntry.create({
      name:`GIG · ${title}`,
      folder:journalRoot.id,
      ownership:{default:0},
      flags:{[FLAG]:{gigJournal:job.id}},
      pages:[
        {name:"Run sheet (GM)",type:"text",text:{content:sheetHtml(job,sheet,links,actors)},sort:0},
        {name:"Handout (show players)",type:"text",text:{content:handoutHtml(job)},sort:100}
      ]
    });

    // A generated gig's people are one-offs: they go when its files do.
    const oneOff = String(job.key ?? "").startsWith("gen-")
      ? game.actors.filter(a => String(a.flags?.[FLAG]?.gigPerson ?? "").startsWith(job.key + ":")).map(a => a.id) : [];
    return {sceneFolder:sceneFolder.id,actorFolder:null,journal:journal.id,scenes:made.scenes,actors:[],people:oneOff,beatScenes:Object.fromEntries(Object.entries(links.scenes).map(([n,u]) => [n,u.split(".").pop()]))};
  }

  // ------------------------------------------------- compact gig journal
  // A gig journal opens as a narrow window docked on the left, page list
  // folded away, so it can stay open beside the map while the GM runs the
  // gig. Where the GM last left it is remembered on this computer.
  const POS_KEY = "fehaGigSheetPos";
  const SHEET_CSS = `
.feha-gig-sheet{min-width:0 !important}
.feha-gig-sheet .journal-header{display:none}
.feha-gig-sheet .journal-page-content{font-size:13px;line-height:1.4}
.feha-gig-sheet .journal-entry-page h1{font-size:18px;margin:0 0 4px}
.feha-gig-sheet .journal-page-header{margin-bottom:2px}
.feha-gig h3{font-size:13px;letter-spacing:.12em;text-transform:uppercase;margin:12px 0 4px;padding-bottom:2px;border-bottom:1px solid currentColor;opacity:.85}
.feha-gig p{margin:0 0 5px}
.feha-gig ul{margin:0 0 6px;padding-left:18px}
.feha-gig li{margin:0 0 2px}
.feha-gig .gk-meta{font-size:12px;opacity:.85}
.feha-gig .gk-tip{font-size:12px;font-style:italic;opacity:.7}
.feha-gig .gk-beat{margin:0 0 10px;padding-left:8px;border-left:2px solid currentColor}
.feha-gig .gk-bh{margin:0 0 2px;font-weight:600}
.feha-gig .gk-bh b{display:inline-block;min-width:16px;opacity:.7}
.feha-gig .gk-map{font-size:12px;margin:0 0 3px}
.feha-gig .gk-small{font-size:12px}
.feha-gig .gk-dim{opacity:.65}
.feha-gig .gk-list{list-style:none;padding-left:0}`;

  function savedPos() {
    try { return JSON.parse(localStorage.getItem(POS_KEY) || "null"); } catch { return null; }
  }

  function compactSheet(app,options) {
    const doc = app.document;
    if (!doc?.flags?.[FLAG]?.gigJournal || !game.user.isGM) return;
    app.element?.classList.add("feha-gig-sheet");
    if (!document.getElementById("feha-gig-sheet-css")) {
      const style = document.createElement("style");
      style.id = "feha-gig-sheet-css";
      style.textContent = SHEET_CSS;
      document.head.append(style);
    }
    // Only when the window opens, so the GM can still move it while it's up.
    if (!options?.isFirstRender) return;
    const pos = savedPos() ?? {left:72,top:90,width:380,height:Math.max(360,Math.min(720,window.innerHeight - 200))};
    // The sheet sets its own size and place on first render; move it after.
    requestAnimationFrame(() => { try { app.setPosition(pos); } catch {} });
    try { if (app.element?.classList.contains("expanded") || app.sidebarState?.expanded) app.toggleSidebar?.(); } catch {}
  }

  function rememberPos(app) {
    if (!app.document?.flags?.[FLAG]?.gigJournal) return;
    const {left,top,width,height} = app.position ?? {};
    if ([left,top,width,height].every(Number.isFinite)) {
      try { localStorage.setItem(POS_KEY,JSON.stringify({left,top,width,height})); } catch {}
    }
  }

  const prior = globalThis.__fehaGigSheetHooks;
  if (prior) for (const [name,id] of prior) Hooks.off(name,id);
  globalThis.__fehaGigSheetHooks = [
    ["renderJournalEntrySheet",Hooks.on("renderJournalEntrySheet",(app,element,context,options) => compactSheet(app,options))],
    ["closeJournalEntrySheet",Hooks.on("closeJournalEntrySheet",app => rememberPos(app))]
  ];

  // A map link in a gig journal takes the GM to that map (Foundry's default
  // for a Scene link is its settings window).
  if (globalThis.__fehaGigMapClick) document.removeEventListener("click",globalThis.__fehaGigMapClick,true);
  globalThis.__fehaGigMapClick = async event => {
    const link = event.target?.closest?.(".feha-gig a[data-uuid^=\"Scene.\"]");
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    const scene = await fromUuid(link.dataset.uuid);
    if (scene?.documentName === "Scene" && game.user.isGM) scene.view();
  };
  document.addEventListener("click",globalThis.__fehaGigMapClick,true);

  // GM: rewrite a built gig's run sheet from the current gig text, keeping
  // its map copies. A beat whose map has changed since the gig was built
  // links the new original map instead of the old copy.
  async function refreshJournal(job) {
    const p = job.prep;
    const journal = p?.journal ? game.journal.get(p.journal) : null;
    if (!journal || !game.user.isGM) return false;
    const sheet = runSheet(job);
    const actors = await ensureNpcs(sheet.beats.flatMap(b => b.enemies.map(([n]) => n)));
    if (sheet.npcs.length) await stockPeople([job]);
    const links = {scenes:{}};
    for (const b of sheet.beats) {
      const copy = game.scenes.get(p.beatScenes?.[b.n] ?? "");
      const source = copy?.flags?.[FLAG]?.gigSource;
      const same = copy && b.scene && (source ? source === b.scene.id : copy.thumb && copy.thumb === b.scene.thumb);
      if (same) links.scenes[b.n] = copy.uuid;
      else if (b.scene) links.scenes[b.n] = b.scene.uuid;
    }
    const page = journal.pages.find(pg => pg.name === "Run sheet (GM)") ?? journal.pages.contents[0];
    if (page) await page.update({"text.content":sheetHtml(job,sheet,links,actors)});
    return true;
  }

  // GM: remove what prep() made (only those documents).
  async function cleanup(p) {
    if (!p || !game.user.isGM) return;
    const scenes = (p.scenes ?? []).filter(id => game.scenes.get(id));
    if (scenes.length) await Scene.deleteDocuments(scenes);
    const actors = (p.actors ?? []).filter(id => game.actors.get(id));
    if (actors.length) await Actor.deleteDocuments(actors);
    // A generated gig's people, then their gig folder if that leaves it empty.
    const people = (p.people ?? []).map(id => game.actors.get(id)).filter(Boolean);
    const peopleFolders = new Set(people.map(a => a.folder).filter(Boolean));
    if (people.length) await Actor.deleteDocuments(people.map(a => a.id));
    for (const folder of peopleFolders) if (!folder.contents.length && !folder.children?.length) await folder.delete();
    if (p.journal && game.journal.get(p.journal)) await JournalEntry.deleteDocuments([p.journal]);
    for (const id of [p.sceneFolder,p.actorFolder]) {
      const f = id ? game.folders.get(id) : null;
      if (f && !f.contents.length && !f.children?.length) await f.delete();
    }
  }

  const api = {VERSION,runSheet,enemiesOf,rewardFor,rewardText,giveItem,prep,cleanup,resolveAt,stockNpcs,stockPeople,personActor,personType,personKind,personData,refreshJournal,personName,NPC_ROOT,KIND_CHECKS,
    resetPools() { pools = null; }};
  globalThis.FEHA_GIG_KIT = api;
  try {
    game.adk ??= {};
    game.adk.gigKit = api;
  } catch {}
})();
