// FEHA // JOB CATALOG
//
// Data only: the fixers of Alabastra, the hand-written jobs they offer and
// the tables the job board uses to roll endless generated gigs. The board
// itself (FEHA_JOBS.js) reads globalThis.FEHA_JOB_CATALOG.
//
// Job fields: key, fixer, tier (1-5), kind, title, district, map (scene name
// or name prefix), enemies [[NPC catalog name, count]], pay (credits per
// crew member), brief and objectives (players see these), twist (GM only).
//
// Fixers sit in RINGS. A fixer only gives work at their ring's level: when
// the catalog loads, every job is moved to its fixer's level (pay rescaled
// inside the new band, enemies swapped for the same faction's unit at the
// new level). Personal jobs (for:) keep their own level. The crew shares one
// Street Cred; a ring opens when the crew has its cred (or the GM opens a
// fixer early).

(() => {
  const VERSION = "2.0.0";

  // Job levels. risk = what players see; pay is per crew member; cred = crew
  // Street Cred earned.
  const TIERS = {
    1:{label:"LOW RISK",      risk:"LOW",       pay:[400,900],     cred:6},
    2:{label:"MODERATE RISK", risk:"MODERATE",  pay:[1200,2400],   cred:10},
    3:{label:"HIGH RISK",     risk:"HIGH",      pay:[3000,5500],   cred:15},
    4:{label:"VERY HIGH RISK",risk:"VERY HIGH", pay:[7000,12000],  cred:22},
    5:{label:"EXTREME RISK",  risk:"EXTREME",   pay:[15000,30000], cred:30}
  };

  // Fixer rings: who will work with the crew, by crew Street Cred.
  const RINGS = [
    {ring:1,label:"STREET",  need:0,  tiers:[1],   blurb:"Neighbourhood fixers. Small jobs, people you know."},
    {ring:2,label:"DISTRICT",need:30, tiers:[2],   blurb:"Fixers who run a whole district. Real money, real enemies."},
    {ring:3,label:"CITY",    need:90, tiers:[3],   blurb:"Fixers the whole city knows. Corp targets and Vigil heat."},
    {ring:4,label:"ELITE",   need:180,tiers:[4,5], blurb:"The top. Council-level jobs that change Alabastra."}
  ];

  // Crew ranks (minimum crew Street Cred for each rank).
  const RANKS = [
    [0,"NOBODIES"],[30,"KNOWN"],[90,"RESPECTED"],[180,"NAMED"],[300,"LEGENDS"]
  ];

  const FIXERS = [
    {
      key:"vesna", color:"#5ef2ff", name:"Vesna Kral", handle:"VESNA", district:"New Niemir", spot:"26", ring:1,
      blurb:"Runs The Wake, the mercs' bar in an old funeral hall, and most of the work in New Niemir passes over her bar. Sloviti, ex-boxer, never forgets a debt.",
      voice:"Do it clean, do it quiet, and come back alive. In that order."
    },
    {
      key:"babka", color:"#f3e600", spot:"22", name:"Babka Ilinova", handle:"BABKA", district:"New Niemir", ring:1,
      blurb:"Sloviti grandmother who came over on the third refugee wave and never stopped organising. Her jobs keep people fed, housed and out of CivCorp cells. She pays in what she has.",
      voice:"Nobody is coming to save us. So. You will do."
    },
    {
      key:"kiyama", color:"#ff5e57", spot:"35", name:"Saburo Kiyama", handle:"KIYAMA", district:"Orient Quarter", ring:2,
      blurb:"Soft-spoken go-between for the Yakuza family that runs out of the HQ tower. Collections, protection, problems that need to go away quietly.",
      voice:"The family remembers who was useful. It also remembers who was not."
    },
    {
      key:"dialtone", color:"#b45cff", spot:"19", name:"Reyna Castell", handle:"DIAL TONE", district:"Corporate Plaza", ring:3,
      blurb:"Netrunner turned broker. Never meets in person; her voice comes out of whatever speaker is closest. Data jobs, corp secrets, anything with a firewall.",
      voice:"Data wants to be free. I just charge a finder's fee."
    },
    {
      key:"duval", color:"#2f8dff", spot:"39", name:"Maurice Duval", handle:"CARP-LINE", district:"The Docks", ring:2,
      blurb:"Ex-Navy quartermaster and loud Vargas loyalist who idolises Admiral Rosa. Moves cargo the Council's customs never see and talks politics the whole time.",
      voice:"The Admiral says the harbour belongs to the people. I say it belongs to whoever's paying the tug."
    },
    {
      key:"hale", color:"#d9d2c5", spot:"18", name:"Verity Hale", handle:"MS. HALE", district:"Corporate Plaza", ring:4,
      blurb:"Corporate facilitator with a spotless suit and no listed employer. Pays the most, explains the least, and has never once said which corp she works for.",
      voice:"Discretion is the deliverable. Everything else is a detail."
    },
    {
      key:"clerk", color:"#37e07c", spot:"24", name:"Clerk Seven", handle:"CLERK SEVEN", district:"Old Capital", ring:2,
      blurb:"A CivCorp records clerk who sells off-book warrants and cyberpsycho sightings before the peacekeepers get to them. Never gives a real name. Non-lethal takedowns pay double.",
      voice:"Officially this file doesn't exist. Unofficially, it pays."
    },
    {
      key:"ferro", color:"#ff9d2e", spot:"44", name:"Gil Ferro", handle:"FERRO", district:"Cinderline", ring:1,
      blurb:"Ex-foreman at the Cinder plants, fired for siding with his crew. Now he finds work for the people the plants chew up, and makes the plants pay for it.",
      voice:"The plant takes a finger, we take a fuse. Fair's fair."
    },
    {
      key:"padre", color:"#e8e2d6", spot:"67", name:"Inácio Morales", handle:"PADRE", district:"Costa Morta", ring:1,
      blurb:"Runs a soup kitchen in the dead mall on the coast. Former priest, current fixer: the church taught him to listen, the coast taught him what to do with what he hears.",
      voice:"I don't ask what you've done. I ask what you'll do next."
    },
    {
      key:"velvet", color:"#c23bff", spot:"78", name:"Mr. Velvet", handle:"MR. VELVET", district:"The Kennel", ring:3,
      blurb:"The Kennel boss's broker. Soft voice, perfect manners, and every job he hands out serves the man behind the walls.",
      voice:"My employer values loyalty. He also values results. Please don't make me choose."
    },
    {
      key:"rhea", color:"#d8b45a", spot:"01", name:"Rhea Coldwater", handle:"COLDWATER", district:"The Barrens", ring:2,
      blurb:"Speaks for the Wanderer Clan in the city. Convoys, salvage, water and anything that has to cross the Barrens alive.",
      voice:"Out here the desert's the boss. I just tell you where it's looking."
    }
  ];

  const J = (fixer,key,tier,kind,title,district,map,enemies,pay,brief,objectives,twist) =>
    ({key:fixer+"-"+key,fixer,tier,kind,title,district,map,enemies,pay,brief,objectives,twist});
  const P = (name,job) => ({...job,for:name});

  const JOBS = [
    // ---------------------------------------------------------------- LEN
    J("vesna","repo-deck",1,"Recovery","Unpaid Deck","New Niemir","Booster Basement",
      [["Street Thug",3],["Street Netrunner",1]],600,
      "A customer walked out with a refurbished cyberdeck on a payment plan and stopped paying after week one. He's crashing at a booster den. The shop wants the deck back, not a body.",
      ["Find the customer at the booster den","Recover the cyberdeck (intact pays in full)","Optional: settle it without anyone getting shot"],
      "He sold the deck's neural chip to buy food for his sister. The deck is there, the chip is at a Yakuza-protected pawn shop. The shop will pay half without the chip."),
    J("vesna","fragile",1,"Delivery","Fragile, This Side Up","New Niemir","Ripperdoc Clinic",
      [["Street Gunner",2]],500,
      "A crate of Helix diagnostic boards needs to reach a back-alley ripperdoc across the district before curfew. Vesna's client is paying for speed. Don't drop it, don't open it, don't be late.",
      ["Pick up the crate at The Wake","Deliver it to the ripperdoc before curfew","Get the ripperdoc's signature"],
      "The boards are stolen Helix stock with live trackers. A Helix recovery team (Helix Medtech + 2 Street Gunners on contract) arrives at the clinic ten minutes after the crew."),
    J("vesna","scrap",1,"Recovery","Scrap Run","Old Capital","Car Scrap Yard",
      [["Street Thug",4],["Chromehead",1]],650,
      "There's a burnt-out Vektor hauler at the scrap yard with its power cells still in it. A scav crew is stripping the yard tonight. Get the cells first.",
      ["Reach the hauler before the scavs","Pull at least four power cells","Get out of the yard"],
      "The scavs are teenagers from New Niemir and their leader is a cousin of someone the crew knows. She offers a split if the crew helps them instead."),
    J("vesna","inside",1,"Investigation","Inside Job","New Niemir","Electronics Repair Workshop",
      [["Street Thug",2]],450,
      "Stock keeps vanishing from the back room of Len's Discount Tech Emporium and the locks aren't broken. Len asked Vesna to find someone discreet.",
      ["Stake out the workshop overnight","Identify the thief","Bring proof to Len"],
      "It's Len's nephew, paying off a loan shark who threatens his mother. The loan shark and two thugs come by to collect during the stakeout."),
    J("vesna","highscore",1,"Recovery","High Score","Downtown","Video Games Arcade",
      [["Street Netrunner",1],["Street Thug",2]],550,
      "Someone hacked the arcade's cabinets to pay out jackpots. The owner traced it to a kid netrunner who hangs around the back booths. Recover the payout chip.",
      ["Find the kid at the arcade","Recover the payout chip","Make sure the cabinets stop paying out"],
      "The kid found a Corvus Neural backdoor in the cabinet firmware. The chip is worth far more to Dial Tone than to the arcade owner."),
    J("vesna","stall",1,"Protection","Stall Guard","New Niemir","Market Stalls",
      [["Street Thug",3],["Street Gunner",1]],400,
      "A Sloviti vendor Vesna owes a favour is running a stall during the night festival. A rival vendor has been sending goons to knock over tables. Keep the stall standing until close.",
      ["Guard the stall until close","Keep the stock safe","Optional: find out who sent the goons"],
      "The rival vendor is being squeezed by the same goons and sent them to her to get them off his own back."),
    J("vesna","lights",2,"Delivery","Lights On","New Niemir","Slum Streets",
      [["CivCorp Peacekeeper",3]],1300,
      "A whole block lost its Cinder allocation overnight. Vesna has a generator that fell off a truck. Get it there, get it wired, get out before the patrol comes round.",
      ["Move the generator to the block","Wire it into the building's grid","Leave before the patrol arrives"],
      "The cut was punishment for a strike vote. Anyone seen installing the generator goes into CivCorp files as a sympathiser."),
    J("vesna","birddown",2,"Recovery","Bird Down","New Niemir","The Old Rooftop",
      [["CivCorp Peacekeeper",2],["CivCorp Netrunner",1]],1600,
      "A CivCorp surveillance drone crashed on a rooftop. Vesna's buyer wants its optics before the retrieval team gets there. They are already on their way.",
      ["Reach the rooftop before CivCorp","Strip the drone's optics","Wipe or take its memory core"],
      "The memory core holds footage of a peacekeeper shooting an unarmed striker. Babka would pay to have it broadcast; CivCorp would kill to stop it."),
    J("vesna","pawned",2,"Theft","Pawned Prototype","Orient Quarter","Cyberpunk Old Pawn Shop",
      [["Yakuza Kobun",3],["Yakuza Enforcer",1]],1800,
      "A desperate Jade Arc engineer pawned a prototype scope. Vesna has a buyer. Buy it back or take it, but the pawn shop is not going to sell cheap.",
      ["Get the prototype scope","Don't burn the shop down","Get the scope to Vesna"],
      "The shop pays protection to the Yakuza. If the crew robs it, Kiyama hears about it and wants compensation or a favour."),

    // -------------------------------------------------------------- BABKA
    J("babka","coldchain",1,"Delivery","Cold Chain","New Niemir","The Checkpoint",
      [["CivCorp Peacekeeper",3]],500,
      "Insulin and antibiotics for the New Niemir clinic. The only road in goes through a CivCorp checkpoint, and it's after curfew.",
      ["Get the cooler through the checkpoint","Keep it cold (one hour)","Deliver it to the clinic"],
      "The officer on duty is Sloviti. He'll look away for a bribe, or report the crew if he thinks he's being tested."),
    J("babka","picket",1,"Protection","Picket Line","Old Capital","Protein Farms",
      [["Street Thug",4],["Street Gunner",2]],600,
      "Workers at the protein farms are on strike, which is illegal. Strikebreakers are coming tonight. Keep the picket standing until morning.",
      ["Hold the picket line until dawn","No striker gets badly hurt","Optional: find out who paid the strikebreakers"],
      "The strikebreakers were paid by the government-approved union head, who gets a bonus for every week without a strike."),
    J("babka","deposit",1,"Collection","Deposit Returned","New Niemir","Rundown Hotel",
      [["Street Thug",3]],450,
      "A slumlord took deposits from twelve refugee families and then evicted them. Get the money back. All of it goes to the families.",
      ["Find the slumlord at his hotel","Recover the deposits (about €$2,000, returned to the families)","Make sure he doesn't do it again"],
      "The slumlord is also a Corporate Council ward clerk. Hurting him brings CivCorp attention."),
    J("babka","papertrail",2,"Rescue","Paper Trail","Old Capital","Police Station",
      [["CivCorp Peacekeeper",3],["CivCorp Netrunner",1]],1400,
      "An organiser was picked up in a 'drug epidemic' sweep. He's on tomorrow's transfer list to a private prison, and nobody comes back from those. Get his name off the list.",
      ["Get into the station's records room","Alter or delete the transfer order","Leave no trace"],
      "The same transfer list has the name of someone the crew knows."),
    J("babka","shortmeasure",2,"Investigation","Short Measure","Old Capital","Pump Control",
      [["CivCorp Riot Enforcer",2],["Street Gunner",2]],1200,
      "Workers' Cinder allocations are coming up short every week. Babka thinks the meter readers are skimming. Follow the power.",
      ["Follow the meter crew to pump control","Find where the skimmed Cinder goes","Bring back proof"],
      "The skimmed power funds CivCorp's 'drug epidemic' raids, run off the books."),
    J("babka","freesignal",2,"Protection","Free Signal","Downtown","Indie Broadcast Studio",
      [["CivCorp Peacekeeper",4],["CivCorp Netrunner",1]],1500,
      "Babka's people have a pirate broadcast ready. It has to stay on air for ten minutes while CivCorp triangulates the signal.",
      ["Keep the broadcast running for 10 rounds","Protect the broadcasters","Get everyone out after"],
      "The broadcast is a speech by Sancho Vargas. Some listeners will cheer; some will report everyone involved."),
    J("babka","underthewall",2,"Smuggling","Under the Wall","Undercity","Sewer Section",
      [["CivCorp Peacekeeper",2],["Chromehead",1]],1200,
      "Eight refugees need to get into New Niemir through the sewers. A CivCorp patrol walks the main tunnel every hour.",
      ["Meet the refugees at the outflow","Guide all eight through the sewers","Avoid or deal with the patrol"],
      "One refugee carries a Kurohane data shard she stole on her way out. Kurohane agents are already looking for her."),
    J("babka","beforedawn",3,"Sabotage","Before Dawn","New Niemir","Parking Garage",
      [["Marble Vigil Operative",3],["Marble Vigil Breacher",1]],3200,
      "A Marble Vigil raid on New Niemir is planned for dawn. Their vehicles are staged in a parking garage. Make sure they don't leave it.",
      ["Get into the garage","Disable the raid vehicles","Warn the community"],
      "Somebody inside the community gave the Vigil its targets. The raid list is in the lead vehicle."),
    J("babka","discharged",3,"Rescue","Discharged","Downtown","The Hospital Trauma Ward",
      [["CivCorp Warden",1],["CivCorp Rifleman",2],["Helix Medtech",1]],3500,
      "A striker with gunshot wounds is being held at the hospital 'for questioning'. They'll move him once he can walk. Get him out alive.",
      ["Find the striker's room","Get him out without reopening his wounds","Get him to a safe ripperdoc"],
      "The striker has already talked. He gave CivCorp a name, and he's ashamed of it."),

    // ------------------------------------------------------------- KIYAMA
    J("kiyama","interest",2,"Collection","Interest Owed","Downtown","Synth Club",
      [["Street Gunner",3],["Chromehead",1]],1500,
      "A club owner is three months behind on protection. Collect it. Politely first.",
      ["Talk to the owner at the Synth Club","Collect the debt","Make sure the next payment is on time"],
      "The owner can't pay because a rival street gang already took the money. Kiyama wants that gang's name more than the cash."),
    J("kiyama","steam",2,"Protection","Steam","Orient Quarter","Yakuza Bathhouse",
      [["Kurohane Agent",1],["Street Gunner",3]],2000,
      "The family is meeting a Bastion procurement officer at the bathhouse. Keep the room safe and the conversation private.",
      ["Sweep the bathhouse before the meeting","Guard the meeting","Get the officer out safely"],
      "The procurement officer is wearing a wire for Kurohane. A hit squad arrives halfway through the meeting to clean up."),
    J("kiyama","tilt",2,"Sabotage","Tilt","Orient Quarter","Pachinko Parlor",
      [["Yakuza Kobun",4],["Yakuza Enforcer",1]],1800,
      "A rival family launders money through a pachinko parlour. Break their machines and leave the family's message.",
      ["Get into the pachinko parlour","Wreck the laundering machines","Leave the message (Kiyama's card)"],
      "The parlour's manager is an undercover CivCorp informant. Hurting him brings heat on everyone."),
    J("kiyama","harbourtax",2,"Collection","Harbour Tax","The Docks","Harbour Warehouses",
      [["Navy Rating",3],["Navy Marine",1]],1700,
      "The family takes a cut from a warehouse on the docks. Carp-Line's people say the docks don't pay the Yakuza any more.",
      ["Go to the harbour warehouse","Collect the family's cut","Make the family's claim clear"],
      "This puts the crew on Carp-Line's bad side. Duval offers double to give the money to him instead."),
    J("kiyama","lastorder",2,"Protection","Last Order","Orient Quarter","Food Shack",
      [["Chromehead",2],["Street Gunner",2]],1400,
      "A noodle stand's cook is the family's informant. A chromed-up gang is coming for him tonight. Keep him breathing until morning.",
      ["Guard the noodle stand overnight","Keep the cook alive","Find out how the gang knew"],
      "The cook sold information to the gang as well. He's been playing both sides."),
    J("kiyama","borrowedsteel",3,"Theft","Borrowed Steel","Old Capital","Train Repair Yard",
      [["Bastion Trooper",3],["Bastion Grenadier",1]],4000,
      "A ForgeLine weapons shipment is sitting at the train repair yard, waiting for Bastion. The family wants it first.",
      ["Get into the train yard","Take the weapons crates","Get the crates to the family's trucks"],
      "Half the crates are already empty. Someone inside Bastion is skimming, and the family will assume it was the crew."),
    J("kiyama","brokenoath",3,"Bounty","Broken Oath","Downtown","Love Hotel",
      [["Yakuza Blade",1],["Kurohane Agent",2]],4500,
      "A Yakuza Blade sold family secrets to Kurohane. He's hiding in a love hotel waiting for extraction. Find him before Kurohane does.",
      ["Find the Blade's room","Bring him to the family (alive pays the full fee)","Recover what he stole"],
      "He defected to protect his daughter, a Kurohane academy student. Zach might know her."),
    J("kiyama","houseedge",3,"Theft","House Edge","Downtown","Casino",
      [["Kurohane Security",4],["Kurohane Elite Guard",1]],5000,
      "A Kurohane-owned casino cheated the family out of a fortune at a private table. The family wants it back from the cage.",
      ["Get into the casino","Empty the cage","Get out without being recognised"],
      "The cage holds a ledger of Kurohane bribes to Corporate Council judges. Hale would pay a lot for it."),
    J("kiyama","succession",4,"Protection","Succession","Orient Quarter","Japanese Garden",
      [["Yakuza Blade",2],["Yakuza Wakagashira",1]],8500,
      "The family's wakagashira is stepping down. Escort his heir through rival territory to the ceremony in the garden.",
      ["Pick up the heir","Get him to the garden alive","Stand guard during the ceremony"],
      "The other candidate set up the ambush, and the family has agreed to accept whoever is still standing."),

    // ---------------------------------------------------------- DIAL TONE
    J("dialtone","coldstorage",2,"Data Heist","Cold Storage","Downtown","Cyberpunk Server Room",
      [["Kurohane Security",3],["Corvus Netrunner",1]],2200,
      "Plug Dial Tone's shard into a Corvus Neural server rack's maintenance port and keep it there for ninety seconds.",
      ["Get into the server room","Plug in the shard and hold for 9 rounds","Get out"],
      "The shard also uploads a worm that will wipe the backups of everyone in that building, including the people the crew walked past."),
    J("dialtone","ghost",2,"Investigation","Ghost in the Cafe","Downtown","Netrunner Cafe",
      [["Street Netrunner",2],["Street Gunner",2]],1600,
      "Someone is selling runners' real identities from a netrunner cafe. Three runners have been picked up this month. Find the leak.",
      ["Stake out the netrunner cafe","Identify the leak","Stop it"],
      "The leak is the cafe's management AI, which Corvus Neural quietly installed. The owner has no idea."),
    J("dialtone","badrecording",2,"Recovery","Bad Recording","Downtown","Braindance VR Lounge",
      [["Street Thug",3],["Street Netrunner",1]],1500,
      "A braindance chip recorded a murder. The lounge owner is about to erase it. Get it first.",
      ["Get into the braindance lounge","Recover the chip before it's wiped","Get it to Dial Tone"],
      "The murderer in the recording is a CivCorp warden. Selling the chip makes enemies; burying it makes the crew complicit."),
    J("dialtone","primetime",3,"Data Heist","Prime Time","Downtown","TV Network Broadcast Studio",
      [["Kurohane Security",3],["Kurohane Netrunner",1],["Kurohane Counterintel Officer",1]],5000,
      "Hijack a TV network's live feed and run proof of a Corporate Council bribe for sixty seconds.",
      ["Get into the broadcast studio","Take over the live feed","Keep the proof on air for 6 rounds"],
      "The network is Kurohane-owned and the bribe implicates a Kurohane rival. Dial Tone's client is Kurohane."),
    J("dialtone","flatline",3,"Rescue","Flatline","Downtown","The Nexus - Hacker Farm",
      [["Corvus Netrunner",2],["Street Gunner",3]],4200,
      "A runner is trapped behind black ICE in a hacker farm. Her body is still jacked in. Get her out before her brain cooks.",
      ["Get into the hacker farm","Unplug the runner safely (a medicine or tech check, or she takes damage)","Get her out alive"],
      "The farm's owners are Corvus contractors and they want her alive too. They think she has their access keys."),
    J("dialtone","deadair",4,"Sabotage","Dead Air","Old Capital","Sci-Fi Satellite Tower",
      [["CivCorp Rifleman",3],["CivCorp Netrunner",2]],7500,
      "Reposition a satellite uplink so CivCorp's surveillance grid goes blind over New Niemir for one night.",
      ["Climb or hack into the satellite tower","Realign the uplink","Hold the tower until the window opens"],
      "Babka has planned a mass meeting for that night. If the job fails, everyone at it will be on camera."),
    J("dialtone","datafortress",4,"Data Heist","Datafortress","The Net","The Net — Datafortress",
      [["Kurohane Netrunner",2],["Kurohane Kage",1]],10000,
      "Breach a Kurohane datafortress. The payload is a list of private accounts held by members of the Corporate Council.",
      ["Jack in and reach the datafortress","Break the core ICE","Copy the account list"],
      "The list includes Sancho Vargas. The populist hero took Council money too."),
    J("dialtone","prometheus",5,"Theft","Prometheus Drive","Corporate Plaza","AI Core Entrance",
      [["Kurohane Elite Guard",3],["Kurohane Oni",1],["Kurohane Netrunner",1]],22000,
      "Steal a Kurohane AI core prototype from its facility. Dial Tone has a buyer who doesn't ask questions.",
      ["Get into the AI core facility","Pull the prototype core","Get out with it intact"],
      "The AI talks to the crew through their implants. It asks them not to hand it over."),
    J("dialtone","zerobalance",5,"Theft","Zero Balance","Corporate Plaza","Bank Vault",
      [["Marble Vigil Operative",3],["Marble Vigil Captain",1],["CivCorp Warden",1]],25000,
      "A Council-insured bank vault holds the deposit boxes of half the Corporate Council. Dial Tone wants one specific box. Everything else is the crew's bonus.",
      ["Get into the vault","Open box 0117","Get out before the Vigil locks down the building"],
      "Box 0117 holds the original order for Sancho Vargas's removal, signed by all twelve corporations."),

    // -------------------------------------------------------------- DUVAL
    J("duval","container",2,"Smuggling","Container 4471","The Docks","The Container Port",
      [["CivCorp Peacekeeper",3],["CivCorp Rifleman",1]],1800,
      "Get unmarked container 4471 out of the port before customs inspects it at dawn. Don't open it.",
      ["Find container 4471","Get it onto Duval's truck","Leave before the inspection"],
      "The container holds twenty Sloviti refugees. Babka would want to know, and so would CivCorp."),
    J("duval","freshcatch",2,"Delivery","Fresh Catch","The Docks","Seafood Packing Facility",
      [["Yakuza Kobun",3]],1300,
      "Deliver crates through the seafood packing plant to a boat at the back dock. Don't open them.",
      ["Pick up the crates","Move them through the packing plant","Load them on the boat"],
      "The crates hold Jade Arc sniper rifles, bound for Navy marines loyal to Admiral Rosa."),
    J("duval","rally",2,"Protection","Admiral's Rally","The Docks","Dock",
      [["Street Gunner",3],["CivCorp Riot Enforcer",2]],1600,
      "Security for a pro-Vargas rally on the docks. CivCorp says it's illegal. Duval says it's the people's harbour.",
      ["Guard the stage","Keep the crowd safe","Get the speakers out after"],
      "The Council wants violence so it can blame Vargas supporters. One of the 'attackers' is a CivCorp plant who will start the shooting."),
    J("duval","losttug",2,"Recovery","Lost Tug","The Docks","Canal",
      [["Street Thug",4]],1200,
      "One of Duval's tugs sank in the canal. Recover its black box before the scavengers do.",
      ["Find the wreck in the canal","Recover the black box","Get it to Duval"],
      "The black box shows the tug was rammed by a CivCorp patrol boat."),
    J("duval","manifest",3,"Theft","Ship's Manifest","The Docks","MTC Curwen (Ship)",
      [["Navy Marine",3],["Navy Rating",2]],3800,
      "The freighter MTC Curwen has two manifests: the one customs sees and the real one on the bridge. Duval wants the real one.",
      ["Board the MTC Curwen","Reach the bridge","Copy or steal the real manifest"],
      "The real manifest shows the Curwen carries Bastion weapons to both sides of a conflict the Council started."),
    J("duval","pleasure",3,"Theft","Pleasure Cruise","The Docks","The Superyacht",
      [["Kurohane Security",4],["Kurohane Elite Guard",1]],5500,
      "A Corporate Council member is throwing a party on his superyacht. Rob the owner's stateroom during the fireworks.",
      ["Get aboard the superyacht","Crack the stateroom safe","Get off the yacht"],
      "The safe holds a list of Navy officers the Council plans to purge."),
    J("duval","shoreleave",3,"Extraction","Shore Leave","The Docks","The Marina",
      [["Navy Marine",3],["Marble Vigil Operative",1]],4500,
      "A Navy officer wants to desert with evidence of Council strikes on civilian ships. Get her out of the marina before the Vigil arrives.",
      ["Find the officer at the marina","Keep her and the evidence safe","Get her to Duval's boat"],
      "The 'evidence' is real, but she's also bringing a Navy tracker that she doesn't know about."),
    J("duval","pressuredrop",4,"Sabotage","Pressure Drop","The Docks","Oceanic Platform",
      [["Bastion Trooper",4],["Bastion Sergeant",1]],9000,
      "Disable a Bastion-run oceanic platform's pumps so Navy loyalists can seize it.",
      ["Reach the oceanic platform","Disable the pumps","Hold until the Navy boats arrive"],
      "Two hundred workers live on the platform. Disabling the pumps cuts their air scrubbers too."),
    J("duval","spillway",4,"Sabotage","Spillway","Old Capital","Water Dam",
      [["Bastion Heavy",1],["Bastion Trooper",3],["Bastion Marksman",1]],9500,
      "Hold the dam's control room while Carp-Line's engineers redirect water to New Niemir, which has been on rationing for months.",
      ["Take the dam's control room","Hold it for 10 rounds","Get the engineers out"],
      "Redirecting the water floods a Bastion barracks downstream. Duval knew."),

    // --------------------------------------------------------------- HALE
    J("hale","parachute",3,"Extraction","Golden Parachute","Corporate Plaza","Research Facility",
      [["Bastion Trooper",3],["Helix Medtech",1]],5000,
      "Extract a Helix Vitae researcher who wants to defect to ForgeLine. She is expecting you.",
      ["Get into the research facility","Find the researcher","Get her to Hale's car"],
      "She doesn't want to defect. Her contract was sold to ForgeLine and she is the merchandise."),
    J("hale","recall",3,"Sabotage","Recall Notice","Old Capital","Manufacturing",
      [["Bastion Trooper",3],["Bastion Grenadier",1]],4800,
      "Sabotage a ForgeLine production line so this week's batch fails quality control.",
      ["Get onto the factory floor","Sabotage the line without it looking deliberate","Get out unseen"],
      "The failed batch will be sold cheap to Navy marines instead of scrapped."),
    J("hale","donor",3,"Investigation","Organ Donor","Old Capital","Donor Clinic",
      [["Helix Medtech",2],["Street Gunner",3]],3600,
      "A donor clinic's numbers don't add up. Find out where the extra organs come from.",
      ["Get into the donor clinic","Find the clinic's real records","Bring them to Hale"],
      "The organs come from people arrested in the 'drug epidemic'. Hale wants the data to blackmail Helix, not to stop it."),
    J("hale","corneroffice",4,"Theft","Corner Office","Corporate Plaza","Corporate Penthouse Office",
      [["Kurohane Elite Guard",2],["Kurohane Executive",1],["Kurohane Kage",1]],9000,
      "Copy a Kurohane executive's private drive from his penthouse office during a board dinner.",
      ["Get into the penthouse office","Copy the drive","Leave no sign anyone was there"],
      "The executive is in his office, not at the dinner, and he has a Kage bodyguard."),
    J("hale","masterpiece",4,"Theft","Masterpiece","Corporate Plaza","Contemporary Art Gallery",
      [["Kurohane Security",4],["Kurohane Agent",1]],7500,
      "Swap a painting for a forgery during the gallery's charity gala.",
      ["Get into the gala","Swap the painting","Get the original to Hale"],
      "The painting isn't the target. A shard is hidden in its frame."),
    J("hale","takeover",4,"Bounty","Hostile Takeover","The Barrens","Forward Base",
      [["Bastion Commander",1],["Bastion Trooper",4],["Bastion Marksman",1]],11000,
      "A Bastion commander is blocking a merger. Hale wants him removed from the board, and doesn't care how.",
      ["Get into the forward base","Remove the commander","Get out"],
      "The commander is blocking the merger because it would hand his troops' contracts to Kurohane."),
    J("hale","exitinterview",5,"Extraction","Exit Interview","Corporate Plaza","Skyscraper Helipad",
      [["Kurohane Oni",1],["Kurohane Elite Guard",3],["Kurohane Sniper",1]],24000,
      "A Kurohane executive is being moved by helicopter. Grab him off the helipad before take-off.",
      ["Reach the helipad","Grab the executive before take-off","Get him off the tower"],
      "The executive wants to be taken. He set this up himself to escape Kurohane."),
    J("hale","quorum",5,"Data Heist","Quorum","Corporate Plaza","Corporate Assembly",
      [["Marble Vigil Operative",4],["Marble Vigil Captain",1],["Marble Vigil Netrunner",1]],20000,
      "Plant a listening device in the Corporate Assembly chamber before the Council votes on making the state of emergency permanent.",
      ["Get into the Corporate Assembly","Plant the device","Get out before the session"],
      "Hale's employer plans to use the recordings to win the vote, not stop it."),
    J("hale","steelsaint",5,"Bounty","Steel Saint","Corporate Plaza","Corp Landing Deck",
      [["Adam Smasher",1],["Kurohane Trooper",3]],30000,
      "Hale needs Kurohane's war machine delayed on a landing deck for five rounds. Not killed. Delayed.",
      ["Engage Adam Smasher on the landing deck","Survive 5 rounds","Get out alive"],
      "The delay is so Hale's employer can kill someone else across town. The crew are the distraction."),

    // -------------------------------------------------------------- CLERK
    J("clerk","overclocked",1,"Cyberpsycho","Overclocked","Old Capital","Back Alley",
      [["Chromehead",1]],700,
      "Cyberpsycho sighting in an alley. Clerk Seven wants him taken down before CivCorp gets there. Non-lethal pays double.",
      ["Find the cyberpsycho","Take him down (non-lethal pays double)","Leave before CivCorp arrives"],
      "He was a delivery driver whose employer made him install cheap chrome to keep his job."),
    J("clerk","skippedbail",1,"Bounty","Skipped Bail","Old Capital","Narco Den",
      [["Street Thug",3],["Street Gunner",1]],600,
      "A petty dealer skipped a CivCorp hearing. Bring him in.",
      ["Find the dealer at the narco den","Bring him in alive","Hand him to Clerk Seven, not CivCorp"],
      "He was framed. The drugs were planted by peacekeepers to meet an arrest quota."),
    J("clerk","causeofdeath",2,"Investigation","Cause of Death","Old Capital","Morgue",
      [["CivCorp Peacekeeper",2]],1400,
      "Swap three autopsy files at the morgue before the official report goes out.",
      ["Get into the morgue","Swap the three files","Leave no trace"],
      "The three 'overdose' deaths had peacekeeper rounds in them. The real files are worth more than the job."),
    J("clerk","lasttrain",2,"Cyberpsycho","Last Train","Undercity","Subway Station",
      [["Chromehead",2]],1600,
      "Cyberpsycho on a subway platform with hostages. Non-lethal pays double.",
      ["Reach the subway platform","Save the hostages","Take down the cyberpsycho (non-lethal pays double)"],
      "One of the hostages is a Kurohane executive travelling incognito who'll pay the crew to forget he was there."),
    J("clerk","badinstall",2,"Cyberpsycho","Bad Install","Orient Quarter","Ripperdoc - Back-Alley Bazaar",
      [["Chromehead",1],["Street Gunner",2]],1500,
      "A ripperdoc's patient went cyberpsycho mid-surgery and is tearing the clinic apart. Non-lethal pays double.",
      ["Get into the ripperdoc's clinic","Save the ripperdoc","Take down the patient (non-lethal pays double)"],
      "The chrome came from a bad Bastion batch. More patients got the same batch."),
    J("clerk","veteran",3,"Cyberpsycho","Veteran","Old Capital","Under The Overpass",
      [["Navy Marine",1],["Chromehead",2]],4000,
      "An ex-Navy marine with military chrome is under the overpass, and he's not stopping. Non-lethal pays double.",
      ["Find the marine under the overpass","Take him down (non-lethal pays double)","Recover his chrome's control chip"],
      "He's not a cyberpsycho. His chrome is being remotely triggered by Corvus Neural test software."),
    J("clerk","bentbadge",3,"Bounty","Bent Badge","Old Capital","Fight Club",
      [["CivCorp Warden",1],["CivCorp Riot Enforcer",2],["Chromehead",1]],3800,
      "A CivCorp warden runs a fight ring with prisoners as fighters. Clerk Seven wants him exposed and out of the way.",
      ["Get into the fight club","Get proof of the ring","Take the warden down"],
      "One of the prisoner fighters is a striker from the protein farms."),
    J("clerk","blackfriday",4,"Cyberpsycho","Black Friday","Downtown","Horizon Shopping Mall",
      [["Chromehead",3],["Marble Vigil Lancer",1]],8000,
      "Two cyberpsychos in a shopping mall, both fitted with the same bad batch of chrome. The Marble Vigil is on its way.",
      ["Get into the mall","Take down both cyberpsychos (non-lethal pays double)","Leave before the Vigil locks it down"],
      "The Vigil isn't coming to stop the psychos. It's coming to recover the chrome batch before anyone traces it."),
    J("clerk","roguevigil",4,"Bounty","Rogue Vigil","Old Capital","Warehouse Safe House",
      [["Marble Vigil Operative",1],["Marble Vigil Marksman",1],["Marble Vigil Breacher",2]],9000,
      "A Marble Vigil operative went off-book. CivCorp wants him gone before he talks. Clerk Seven wants to sell the job first.",
      ["Find the safe house","Get to the operative","Decide what to do with him"],
      "He wants to give the crew the evidence of how Vargas was removed from office."),

    // ------------------------------------------------------ MORE STREET WORK
    J("vesna","chiprun",1,"Delivery","Chip Run","Downtown","Tech Street",
      [["Street Thug",2]],450,
      "Three repaired cyberdeck chips, three customers, one night. Len's Discount Tech Emporium promised next-day service, it's already the next day, and Len is paying Vesna's runners to fix it.",
      ["Deliver the first chip (a runner at a noodle stand)","Deliver the second chip (a kid at the arcade)","Deliver the third chip (an address on Tech Street)"],
      "The third customer is a CivCorp netrunner moonlighting under a fake name. If the crew notices the CivCorp firmware on the chip, they can sell that fact to Dial Tone."),
    J("vesna","blackout",1,"Recovery","Blackout Sale","New Niemir","Burnt-Out Shop",
      [["Street Thug",3]],500,
      "An electronics shop burned out after a power surge. The insurance assessor arrives at dawn; Vesna's buyer wants the salvageable stock out before then, with the owner's blessing.",
      ["Get into the burnt-out shop","Salvage at least six crates of stock","Leave before the assessor arrives"],
      "The fire wasn't a surge. The owner set it for the insurance, and the assessor is already inside."),
    J("clerk","quota",1,"Investigation","Quota","Old Capital","Ghetto Markets",
      [["CivCorp Peacekeeper",2]],550,
      "Peacekeepers are planting evidence in the markets to make their arrest quotas. Clerk Seven wants it on camera.",
      ["Stake out the market","Record a plant on camera","Get the footage out"],
      "The peacekeeper on camera is being squeezed by his sergeant, and he'll trade a bigger story for the footage."),
    J("clerk","spincycle",1,"Cyberpsycho","Spin Cycle","New Niemir","Laundromat",
      [["Chromehead",1]],650,
      "A man with a cheap arm implant has barricaded himself in a laundromat and is smashing machines. Non-lethal pays double.",
      ["Get into the laundromat","Get the bystanders out","Take him down (non-lethal pays double)"],
      "His arm was repossessed remotely mid-shift and the shutdown fried his nerves. He's in agony, not psychotic."),
    J("clerk","bareknuckle",2,"Bounty","Bare Knuckle","Old Capital","Boxing Club",
      [["Chromehead",1],["Street Gunner",2]],1600,
      "An underground boxer is winning fights with stolen Gorilla Arms. The arms' owner wants them back, and the boxer brought in.",
      ["Find the boxer at the club","Beat him (in the ring or out of it)","Bring back the arms"],
      "The boxer is fighting to pay off his sister's debt to Kiyama's family."),
    J("babka","nightschool",1,"Protection","Night School","New Niemir","Squatters Court",
      [["Street Thug",3]],400,
      "Babka runs an evening class for kids who can't afford school. A local gang thinks the building should pay rent to them.",
      ["Guard the class until it ends","Keep the kids safe","Make the gang leave for good"],
      "The gang's leader went to the same class two years ago and dropped out. Babka still has his workbook."),
    J("babka","meterbreak",2,"Sabotage","Meter Break","Old Capital","Water Purification",
      [["CivCorp Peacekeeper",3]],1300,
      "The water plant cuts off whole blocks when a single flat falls behind on payments. Break the remote shut-off meters.",
      ["Get into the water purification plant","Break the remote shut-off meters","Get out unseen"],
      "The plant's engineers are on the crew's side. One of them will help if asked, and lose her job if seen."),
    J("babka","wake",2,"Protection","Wake","Old Capital","Gothic City Chapel",
      [["CivCorp Peacekeeper",3],["CivCorp Riot Enforcer",1]],1400,
      "A striker killed by peacekeepers is being buried. CivCorp has a list of mourners it plans to arrest at the gate.",
      ["Get the mourners in and out of the chapel","Keep the listed names out of CivCorp hands","Nobody gets arrested"],
      "The dead striker's brother is armed and plans to shoot the peacekeeper who killed her."),
    J("kiyama","ink",2,"Recovery","Ink","Orient Quarter","Tattoo Shop",
      [["Street Thug",3],["Street Netrunner",1]],1400,
      "Someone stole the family's stencil book from its tattoo artist. Every design in it marks a made member. Get it back before it's copied.",
      ["Track the thieves to the tattoo shop","Recover the stencil book","Find out who ordered the theft"],
      "Kurohane ordered the theft to forge family tattoos and plant fake members."),
    J("kiyama","wrongsong",2,"Collection","Wrong Song","Orient Quarter","Small Dance Bar",
      [["Street Gunner",3]],1300,
      "A karaoke bar stopped paying after a new crew promised to protect it for cheaper. Remind them who they should be paying.",
      ["Visit the karaoke bar","Collect what's owed","Deal with the new crew"],
      "The new crew is three teenagers with one gun between them."),
    J("kiyama","omakase",3,"Protection","Omakase","Orient Quarter","Sushi Pad",
      [["Kurohane Agent",2],["Kurohane Kage",1]],4500,
      "Kiyama is meeting Kurohane at a sushi bar to settle a territory dispute. Sit at the counter, eat slowly, and watch the doors.",
      ["Arrive before Kiyama and sweep the bar","Guard the meeting","Get Kiyama out if it goes wrong"],
      "Kiyama plans to sell out his own oyabun to Kurohane at this meeting. The crew are his witnesses, whether they like it or not."),
    J("dialtone","streetnet",2,"Data Heist","Off the List","The Net","The Net — Street Net Map",
      [["CivCorp Netrunner",2]],1500,
      "A runner's name is on a CivCorp watch list. Jack into the street net and scrub it before the morning sweep.",
      ["Jack into the street net","Find the watch list","Scrub the runner's name"],
      "The watch list also holds the crew's names, flagged as 'associates'. Scrubbing them too takes longer and trips more alarms."),
    J("dialtone","burner",2,"Theft","Burner","Downtown","Soundpiercer",
      [["Corvus Netrunner",1],["Kurohane Security",2]],1800,
      "A Corvus courier carries a burner phone on the monorail every Thursday. Lift it between stops.",
      ["Board the monorail","Lift the burner phone","Get off before the courier notices"],
      "The phone rings during the job, and the voice on it asks for the crew by name."),
    J("dialtone","firewall",3,"Data Heist","Firewall Breach","The Net","The Net — Firewall Breach",
      [["Kurohane Netrunner",2],["Corvus Netrunner",1]],4500,
      "Hold open a breach in a Kurohane firewall long enough for Dial Tone's team to slip through.",
      ["Jack in at the breach","Hold the breach for 8 rounds","Jack out before the trace completes"],
      "Dial Tone's 'team' is a single AI she has been hiding from Kurohane, and this is its way out."),
    J("duval","nightbus",2,"Smuggling","Night Bus","The Docks","The Bus Terminal",
      [["CivCorp Peacekeeper",3]],1300,
      "Four crates need to ride the last night bus out of the docks. The terminal has a CivCorp scanner at the gate.",
      ["Get the crates to the bus terminal","Get them past the scanner","See them onto the last bus"],
      "The crates hold Navy medical supplies stolen from a Council warehouse, meant for a dockworkers' clinic."),
    J("duval","overboard",2,"Rescue","Overboard","The Docks","The Loading Dock",
      [["Yakuza Kobun",3],["Yakuza Enforcer",1]],1500,
      "A dockworker who refused to move Yakuza cargo is being held at the loading dock. Duval wants him back on shift tomorrow.",
      ["Find the dockworker at the loading dock","Get him out","Get him home"],
      "Kiyama's family is holding him. Kiyama will hear the crew did this."),
    J("duval","backpay",3,"Theft","Back Pay","The Docks","Shipping Yard",
      [["Bastion Trooper",3],["Bastion Sergeant",1]],4200,
      "Navy marines haven't been paid in months. The Council paymaster's armoured car stops at the shipping yard tonight. Duval wants the payroll redistributed.",
      ["Stop the armoured car at the shipping yard","Take the payroll credsticks","Get them to Duval"],
      "Half the payroll was never meant for the marines: it's a bribe for a Navy captain loyal to the Council."),
    J("hale","roomservice",3,"Protection","Room Service","Corporate Plaza","The Koi Hotel",
      [["Kurohane Agent",2],["Street Gunner",3]],3800,
      "Guard a corporate negotiator at the Koi Hotel through one night of talks.",
      ["Check in to the Koi Hotel","Keep the negotiator safe through the night","Get her to her car in the morning"],
      "The negotiator is selling out her own corp, and both sides want her dead by morning."),
    J("hale","express",4,"Theft","Express","Corporate Plaza","Cyber Train - Security Car",
      [["Bastion Trooper",3],["Bastion Heavy",1]],8000,
      "The corp monorail's security car carries a sealed case once a week. Take it between stations.",
      ["Board the train","Breach the security car","Take the sealed case and get off"],
      "The case holds a Bastion prototype targeting chip that is tracked by satellite."),
    J("hale","inheritance",4,"Theft","Inheritance","Corporate Plaza","Opulent Mansion",
      [["Kurohane Elite Guard",3],["Kurohane Sniper",1]],9500,
      "A Council member is dying. Hale's client wants his will replaced before the reading.",
      ["Get into the mansion","Replace the will in the study safe","Leave no trace"],
      "The original will leaves the man's fortune to a fund for New Niemir families."),
    J("hale","coldsleep",5,"Extraction","Cold Sleep","Corporate Plaza","Cryo Chamber",
      [["Kurohane Oni",1],["Kurohane Elite Guard",2],["Helix Medtech",2]],18000,
      "A Kurohane founder has been in cryo for twenty years. Hale's client wants him thawed and delivered alive.",
      ["Get into the cryo facility","Revive the founder safely (medicine or tech checks)","Get him out alive"],
      "The founder was frozen against his will by his own board. Waking him starts a corporate civil war."),

    // -------------------------------------------------------------- FERRO
    J("ferro","shiftchange",1,"Protection","Shift Change","Cinderline","Industrial Yard",
      [["Street Thug",3],["Street Gunner",1]],500,
      "A Sparkers crew has been jumping plant workers on the walk home after the night shift. Walk them home.",
      ["Meet the night shift at the gate","Get them home through the yard","Deal with the Sparkers"],
      "The Sparkers know the shift times because the plant's security sells them."),
    J("ferro","fuse",1,"Sabotage","Blown Fuse","Cinderline","Pump Control",
      [["CivCorp Peacekeeper",2]],600,
      "The plant docked a whole crew's pay for a machine fault. Ferro wants the machine to fault again, during the inspector's visit.",
      ["Get into pump control","Rig the fault so it trips during the inspection","Get out before the inspector arrives"],
      "The inspector is honest, and the fault will show him the plant's records were faked."),
    J("ferro","compensation",2,"Collection","Compensation","Cinderline","Foundry",
      [["Bastion Trooper",3]],1600,
      "A worker lost an arm on the ForgeLine line and the company says it was his fault. Ferro wants the compensation paid, one way or another.",
      ["Get into the ForgeLine offices","Find the injury report","Get the money or the evidence out"],
      "The real report blames a safety system ForgeLine switched off to raise output."),
    J("ferro","railspur",2,"Theft","Rail Spur","Cinderline","Train Repair Yard",
      [["Bastion Trooper",2],["Street Gunner",3]],1800,
      "A Cinder shipment is parked on a rail spur overnight. Ferro wants one wagon of it moved to the workers' blocks.",
      ["Get into the train yard","Uncouple one wagon of Cinder","Run it down the spur to Block 7"],
      "Bastion contractors guard the train, and the Sparkers want the same wagon."),
    J("ferro","sparkers",2,"Bounty","Live Wire","Cinderline","Foundry",
      [["Chromehead",2],["Street Gunner",2]],2000,
      "The Sparkers' leader has been stripping chrome from injured workers in the plant hospital. Ferro wants him gone.",
      ["Find the Sparkers' boss at the foundry","Take him down","Get the stolen chrome back to its owners"],
      "The boss was a plant worker who lost both legs on the line. Half his crew are people Ferro used to supervise."),
    J("ferro","array",3,"Sabotage","Dark Array","Cinderline","Pump Control",
      [["Bastion Trooper",3],["Bastion Sergeant",1],["CivCorp Netrunner",1]],4500,
      "The Cinder plants are going on strike tomorrow, which is illegal. For the strike to hold, the collector array has to stay offline for a night.",
      ["Get into the Cinder collector array","Take the dishes offline","Hold until the strike vote"],
      "Turning off the array blacks out a hospital in New Niemir too, unless someone reroutes its line by hand."),

    // -------------------------------------------------------------- PADRE
    J("padre","soupkitchen",1,"Protection","Soup Kitchen","Costa Morta","Horizon Shopping Mall",
      [["Street Thug",4]],400,
      "Someone keeps raiding the Padre's soup kitchen in the dead mall. Watch the food truck overnight.",
      ["Guard the kitchen's food truck overnight","Catch the raiders","Decide what to do with them"],
      "The raiders are a family who were turned away for arriving after closing."),
    J("padre","drowned",1,"Investigation","Voices","Costa Morta","Rundown Hotel",
      [["Street Netrunner",2]],600,
      "People in the dead hotels say they hear voices in the old net. The Drowned say it's a ghost. The Padre thinks it's a person.",
      ["Get into the Hotel Santa Sofia","Find the source of the voices","Report back to the Padre"],
      "It's a Corvus test AI left running when the resort died. It's lonely, and it's learning from the Drowned."),
    J("padre","medicine",1,"Delivery","Last Rites","Costa Morta","Cyber Market",
      [["Street Gunner",2],["Street Thug",2]],550,
      "Medicine for the coast's clinic, carried through the Stacks Market where a gang is taxing every crate.",
      ["Pick up the medicine at the dock","Get it through the Stacks Market","Deliver it to the clinic"],
      "The gang taxing the crates is paid by a Helix rep to keep cheap medicine off the coast."),
    J("padre","prison",2,"Rescue","Visiting Hours","Costa Morta","Prison Facility",
      [["CivCorp Warden",1],["CivCorp Peacekeeper",3]],1900,
      "A boy from the coast was sent to CivCorp Correctional Facility 4 for 'drug possession'. He's twelve. The Padre wants him out tonight.",
      ["Get into Correctional Facility 4","Find the boy","Get him out alive"],
      "There are forty more children in the same block. Taking only one will haunt the crew."),
    J("padre","mall",2,"Recovery","Confession","Costa Morta","Horizon Shopping Mall",
      [["Street Gunner",3],["Chromehead",1]],1500,
      "A man confessed to the Padre that he hid evidence of a Council bribe in the old mall before he was shot. Find it before his killers do.",
      ["Search the old mall","Find the hidden evidence","Get out before the killers arrive"],
      "The killers are Marble Vigil operatives in street clothes."),
    J("padre","storm",3,"Rescue","High Water","Costa Morta","Sewer Canal Slums",
      [["Street Gunner",3],["Chromehead",1]],3200,
      "A storm surge is flooding the canal slums and the pumps were 'temporarily disabled' by the developers who want the land. Get the families out.",
      ["Reach the canal slums","Get the families out before the water rises","Find out who shut off the pumps"],
      "The developer's crew is still there, making sure nobody restarts the pumps."),

    // ------------------------------------------------------------- VELVET
    J("velvet","tithe",2,"Collection","The Tithe","The Kennel","Guns Marketplace",
      [["Street Gunner",3],["Chromehead",1]],1600,
      "A trader in the Kennel market is skimming from the boss. Mr. Velvet wants the money back and an apology witnessed.",
      ["Find the trader in the Kennel market","Recover the money","Make the apology public"],
      "The trader is skimming because the boss's own lieutenant is squeezing him."),
    J("velvet","gate",2,"Smuggling","Through the Wall","The Kennel","Security Checkpoint",
      [["Bastion Trooper",2],["CivCorp Peacekeeper",2]],2000,
      "A shipment needs to get through the Kennel's wall checkpoint and past the CivCorp patrol outside it.",
      ["Pick up the shipment outside the walls","Get past the CivCorp patrol","Bring it through the Kennel gate"],
      "The shipment is a Bastion prototype the boss stole from his old employer."),
    J("velvet","arena",3,"Protection","Fight Night","The Kennel","Fight Club",
      [["Chromehead",2],["Street Gunner",3]],4000,
      "The Kennel's fight night has the boss in the front row. Mr. Velvet needs extra eyes in the crowd.",
      ["Work the crowd at the fight club","Spot the assassin","Stop the attempt"],
      "The assassin was sent by the lieutenant who wants the boss's chair."),
    J("velvet","pearl",3,"Theft","Black Pearl","The Kennel","The VIP Lounge",
      [["Kurohane Agent",2],["Bastion Trooper",2]],4800,
      "A Kurohane negotiator is meeting the boss at the Black Pearl. Mr. Velvet wants her drive copied while she drinks.",
      ["Get into the Black Pearl","Copy the negotiator's drive","Leave her none the wiser"],
      "The drive holds the Kennel's own defence plans. Kurohane already has a man inside."),
    J("velvet","traitor",4,"Bounty","The Lieutenant","The Kennel","Cyberpunk Warehouse",
      [["Bastion Sergeant",1],["Bastion Trooper",4],["Bastion Marksman",1]],9500,
      "The boss's lieutenant has made his move. Mr. Velvet wants it ended before the Kennel splits in two.",
      ["Find the lieutenant's warehouse","Break his crew","Bring him to the boss alive (bonus)"],
      "The lieutenant promised the Kennel's people schools and a clinic. The boss never did."),
    J("velvet","airdrop",5,"Theft","Airdrop","The Kennel","Corp Landing Deck",
      [["Bastion Commander",1],["Bastion Heavy",2],["Bastion Trooper",3]],20000,
      "Bastion is airdropping supplies to its people near the Kennel. The boss wants the drop, all of it.",
      ["Reach the landing deck","Take the drop","Get it back behind the walls"],
      "The drop is a Bastion strike force, not supplies. Bastion is coming for the Kennel."),

    // -------------------------------------------------------------- RHEA
    J("rhea","convoy",1,"Protection","Convoy","The Barrens","Dusty Road",
      [["Street Gunner",3]],650,
      "A water convoy is crossing the Barrens from Ninfa Reservoir to the clan camps. The Scorpions have been hitting convoys all month.",
      ["Ride with the convoy","Fight off the Scorpions","Get the water to the camp"],
      "The Scorpions are a clan that was cut off from the reservoir by a Council water contract."),
    J("rhea","salvage",1,"Recovery","Crash Site","The Barrens","The Crash Site",
      [["Street Thug",3],["Chromehead",1]],700,
      "A Navy transport went down in the Barrens. Rhea wants first pick of the salvage before the Navy finds it.",
      ["Reach the crash site","Strip the useful salvage","Leave before the Navy arrives"],
      "There's a survivor in the wreck, and the Navy is coming for her, not for the salvage."),
    J("rhea","motel",2,"Rescue","Last Light","The Barrens","Wasteland Motel",
      [["Street Gunner",3],["Street Thug",2]],1500,
      "A clan scout is being held at the Last Light Motel by Scorpions who want ransom.",
      ["Reach the Last Light Motel","Get the scout out","Get back to the camp"],
      "The scout went to the Scorpions on purpose, to broker peace. The Scorpions' leader is her brother."),
    J("rhea","wells",2,"Sabotage","Dry Wells","The Barrens","Cyberpunk Badlands - San Echo Oil Pumps",
      [["Bastion Trooper",3],["Bastion Grenadier",1]],2200,
      "A Bastion contractor is pumping the aquifer the clans drink from. Shut the pumps down.",
      ["Get into the pump field","Shut down the pumps","Get out before the contractors respond"],
      "The contractor has a Council permit. Shutting it down puts the clan on a CivCorp list."),
    J("rhea","rail",3,"Theft","Dustline Express","The Barrens","Train Repair Yard",
      [["Bastion Trooper",3],["Bastion Sergeant",1]],4200,
      "A Council freight train stops at Dustline Rail Station for one hour. Rhea's clan wants three of its containers.",
      ["Reach Dustline Rail Station","Take three containers off the train","Get them on clan trucks before it leaves"],
      "One container holds people: workers being moved to a Helix farm against their contracts."),
    J("rhea","proving",4,"Theft","Proving Grounds","The Barrens","Assault Base Alpha",
      [["Bastion Trooper",3],["Bastion Marksman",1],["Bastion Commander",1]],9000,
      "Jade Arc is testing a new weapon at its proving grounds in the northern wastes. Rhea's buyer wants the prototype.",
      ["Get into the Jade Arc proving grounds","Take the prototype","Get it across the Barrens"],
      "The test target is a clan camp. Jade Arc told nobody."),

    // ------------------------------------------------------- PERSONAL JOBS
    // for: the crew member the job is about. The board posts at most one at
    // a time; anyone can take it, but it's written for that character.
    P("Ponyboy",J("vesna","familybusiness",1,"Recovery","Family Business","New Niemir","Mechanic Shop",
      [["Street Thug",3]],600,
      "Ponyboy's dad's old tool chest turned up at a scrap auction run by the competitor that pushed his family's repair shop under. Vesna heard about it first.",
      ["Get into the competitor's yard","Find the tool chest","Get it home"],
      "The yard foreman used to work for Ponyboy's father. He wants to make amends, and he knows who ordered the shop's fire.")),
    P("Ponyboy",J("clerk","doubleshift",1,"Protection","Double Shift","New Niemir","Convenience Store",
      [["Street Gunner",2],["Street Thug",2]],500,
      "The 365 store gets robbed by the same crew every week. The manager won't call CivCorp, because CivCorp charges for a response. Ponyboy is on shift tonight.",
      ["Be at the store when the crew comes","Stop the robbery","Make sure they don't come back"],
      "The crew are kids from the block, and one of them is the manager's son.")),
    P("Ponyboy",J("babka","bills",2,"Investigation","Bills","Downtown","Hospital Ward",
      [["Helix Medtech",1],["CivCorp Peacekeeper",2]],1300,
      "The hospital billing Ponyboy's parents is charging for treatments they never got. Babka thinks it isn't just them.",
      ["Get into the hospital's billing office","Copy the billing records","Get out"],
      "The fraud runs on every refugee patient. The records could wipe out thousands of families' debt, if someone dares to publish them.")),
    P("Sasha",J("dialtone","tuition",2,"Data Heist","Tuition","Downtown","Server Room - Array Technika",
      [["Kurohane Security",2],["Corvus Netrunner",1]],1800,
      "A scholarship board ranks applicants by postcode. Dial Tone says New Niemir addresses are rejected automatically. Prove it.",
      ["Get into the server room","Find the ranking rules","Copy the proof"],
      "Sasha's own application is in there, already rejected. The crew could quietly move it to the top.")),
    P("Sasha",J("babka","pickles",1,"Delivery","Pickle Run","New Niemir","Market Stalls",
      [["CivCorp Peacekeeper",2]],400,
      "A food shortage is coming and the community pantry is empty. Sasha has forty jars put away. Get them to the pantry after curfew.",
      ["Load the jars","Get across the district after curfew","Stock the pantry"],
      "CivCorp counts hoarding during a shortage as profiteering, and the pantry is already on a list.")),
    P("Sasha",J("babka","unioncard",2,"Protection","Union Card","New Niemir","Basement Utilities Room",
      [["CivCorp Riot Enforcer",2],["Street Gunner",2]],1400,
      "The government-approved union head has ordered a 'review' of Sasha's organising group. The review is tonight, with muscle.",
      ["Get the group to the meeting","Protect the meeting","Get everyone out safely"],
      "One attendee is a union informant who asks Sasha for a private word and offers her a paid position.")),
    P("Zach",J("dialtone","alumni",2,"Data Heist","Alumni Night","Corporate Plaza","The High-Class Restaurant",
      [["Kurohane Security",3],["Kurohane Agent",1]],1900,
      "The Kurohane academy's alumni dinner. One of Zach's old bullies now works in counterintelligence and carries an analytics key Dial Tone wants copied.",
      ["Get into the dinner","Copy the bully's key","Leave without a scene (Zach may need to keep his temper)"],
      "The bully is being blackmailed by his own department and wants out. He recognises Zach.")),
    P("Zach",J("kiyama","dojo",2,"Protection","Dojo","Orient Quarter","Fight Gym",
      [["Yakuza Kobun",3],["Yakuza Enforcer",1]],1500,
      "The karate dojo where Zach trained is being squeezed by a rival family. Kiyama offers protection, and the crew is the protection.",
      ["Guard the dojo during the rival's visit","Keep the sensei safe","Send the rival family a message"],
      "The sensei borrowed from Kiyama's family. Protection comes with a price he can't pay.")),
    P("Zach",J("babka","numbers",1,"Investigation","Numbers Don't Lie","Corporate Plaza","Office Floor",
      [["Kurohane Security",2]],500,
      "Zach caught something in the Cinder numbers at work. Babka wants the proof before the next union meeting.",
      ["Stay late at the office","Copy the allocation reports","Get out without being caught"],
      "Zach's manager knows and is covering for a Council member. He'll offer Zach a promotion to keep quiet.")),
    P("Batou",J("clerk","afterlight",2,"Data Heist","The Afterlight Ledger","Downtown","Discreet Hotel Lobby",
      [["Kurohane Security",2],["Kurohane Agent",1]],1500,
      "A Kurohane auditor is staying downtown with the AFTERLIGHT project ledger on her deck: a list of every engram the project keeps.",
      ["Find the auditor's room","Copy the ledger","Leave nothing that points to Batou"],
      "Mara isn't the only name on it. The last entry is Batou's, marked 'future candidate'.")),
    P("Batou",J("kiyama","soulkiller",2,"Investigation","The Survivor","Orient Quarter","Orient Streets",
      [["Yakuza Kobun",3],["Yakuza Enforcer",1]],1600,
      "A Yakuza netrunner survived a Soulkiller attack, half of her mind gone. Kiyama is hiding her, and she remembers who ran the program.",
      ["Reach the safehouse","Talk to the survivor","Get her out before Kurohane does"],
      "She remembers the operator's voice: it was Batou's father, running the attack himself.")),
    P("Batou",J("duval","coldcargo",2,"Smuggling","Cold Cargo","The Docks","Dive Bar",
      [["Street Thug",3],["Chromehead",1]],1300,
      "Kurohane is moving a server core out of the city tonight. Duval's people say it holds engrams.",
      ["Find the shipment","Get to the core","Decide what to do with the minds inside"],
      "The core is a backup of Afterlight. If Mara was freed, a copy of her is in it."))
  ];

  // ----------------------------------------------------------- GENERATOR
  // The board rolls a gig from these tables: a fixer, a job type, a target
  // faction for the enemies and a place. Each type has a few title and
  // brief templates; {item}, {who}, {place} and {faction} are filled in.

  const FACTIONS = {
    "Street":        {label:"street gang",tiers:[1,2], roster:[["Street Thug",1],["Street Gunner",1],["Chromehead",2],["Street Netrunner",2]]},
    "Yakuza":        {tiers:[1,4], roster:[["Yakuza Kobun",1],["Yakuza Enforcer",2],["Yakuza Blade",3],["Yakuza Wakagashira",4]]},
    "CivCorp":       {tiers:[1,3], roster:[["CivCorp Peacekeeper",1],["CivCorp Rifleman",2],["CivCorp Riot Enforcer",2],["CivCorp Netrunner",2],["CivCorp Warden",3]]},
    "Marble Vigil":  {tiers:[3,5], roster:[["Marble Vigil Operative",3],["Marble Vigil Marksman",3],["Marble Vigil Breacher",3],["Marble Vigil Netrunner",3],["Marble Vigil Captain",4]]},
    "Kurohane":      {tiers:[2,5], roster:[["Kurohane Security",2],["Kurohane Trooper",2],["Kurohane Agent",3],["Kurohane Elite Guard",3],["Kurohane Netrunner",3],["Kurohane Sniper",3],["Kurohane Oni",4]]},
    "Bastion":       {tiers:[2,5], roster:[["Bastion Trooper",2],["Bastion Grenadier",2],["Bastion Marksman",3],["Bastion Sergeant",3],["Bastion Heavy",3],["Bastion Commander",4]]},
    "Navy":          {tiers:[1,3], roster:[["Navy Rating",1],["Navy Marine",2]]}
  };

  // Each district's street gang (FEHA_NPC_CATALOG District Gangs). A
  // generated street-level gig in that district fights them instead.
  const GANGS = {
    "New Niemir":["The Niemir Wolves",[["Niemir Wolf",1],["Niemir Wolves Alpha",2]]],
    "The Docks":["Rustwater Boys",[["Rustwater Boy",1],["Rustwater Captain",2]]],
    "Cinderline":["the Sparkers",[["Sparker",2],["Sparker Burnout",3]]],
    "Costa Morta":["the Drowned",[["Drowned Runner",2],["Drowned Oracle",3]]],
    "The Kennel":["the Kennel Dogs",[["Kennel Dog",2],["Kennel Houndmaster",3]]],
    "The Barrens":["the Scorpions",[["Scorpion Raider",1],["Scorpion Chief",3]]],
    "Corporate Plaza":["Glasshouse",[["Glasshouse Kid",1],["Glasshouse Prince",2]]],
    "Downtown":["Glasshouse",[["Glasshouse Kid",1],["Glasshouse Prince",2]]],
    "Old Capital":["Los Viejos",[["Viejo Soldado",1],["Los Viejos Jefe",3]]]
  };

  const ITEMS = [
    "a prototype Corvus neural chip","a stolen Helix Vitae med-crate","a Jade Arc rifle scope","a Kurohane access card",
    "a ledger of Cinder allocations","a braindance master recording","a crate of ForgeLine ammunition","a cyberdeck full of stolen identities",
    "a Bastion drone's flight recorder","an encrypted Council memo","a box of untraceable credsticks","a Sandevistan straight from the factory",
    "a list of CivCorp informants","the deed to a New Niemir tenement","a black-market Mk.III cyberarm","a vial of combat stims",
    "a crate of Cinder ration cards","a Vektor smart-pistol prototype","a strike fund's cash box","a cooler of stolen insulin",
    "a peacekeeper's bodycam","a Navy officer's sealed orders","a Kiroshi optics shipment","a union membership list",
    "a corpse's cyberdeck","a counterfeit Council ID press","a Helix Vitae vaccine sample","the master key to a private prison block",
    "a drive of deleted court records","a Yakuza family ledger"
  ];

  const WHO = [
    "a union organiser","a corp accountant","a runaway academy student","a ripperdoc who knows too much","a Navy deserter",
    "a refugee family","a street kid netrunner","a CivCorp whistleblower","a fixer's courier","a Kurohane middle manager",
    "a striker's daughter","a journalist from an indie station",
    "a Sloviti family of five","a retired Navy gunner","a CivCorp clerk with a conscience","a braindance editor",
    "a burned-out netrunner","a protein-farm shift leader","a corp intern who saw too much","an old ripperdoc's apprentice",
    "a street preacher","a teenage courier"
  ];

  // Map name prefixes by kind of place. The board links the first scene
  // whose name starts with the entry.
  const PLACES = {
    street:["Back Alley","Chinatown Alley","City Streets","Cyberpunk Street","Night Street","Market Street","Under The Overpass","Food Truck Alley","Slum Alley","Orient Alley","Red Light Street","Vendor Street"],
    den:["Booster Basement","Narco Den","Scavs Den","The Hideout","Warehouse Safe House","Squatters Court","Cyber Psycho Den","The Drug Lab"],
    corp:["Corporate Lobby","Corpo Office Complex","Executive Office","Cyberpunk Server Room","Offices - Nexus Robotics","Corporate Penthouse Office","Lumina Corporate Lobby Atrium"],
    club:["Synth Club","Industrial Club","Nightlife Club","Cyber Bar","Dive Bar","Cocktail Lounge","Arena Nightclub","Viper Club"],
    industrial:["Manufacturing","The Factory","Car Scrap Yard","Train Repair Yard","Industrial Yard","Garbage Dump","The Construction Site","Foundry"],
    warehouse:["City Warehouse","Cyberpunk Warehouse","Container Warehouse","Warehouse District","Automated Warehouse","Small Warehouse"],
    docks:["Dock","Harbour Warehouses","Shipping Yard","The Container Port","The Loading Dock","The Marina"],
    medical:["Ripperdoc Clinic","Emergency Room","Hospital Ward","Medical Ward","Patch & Go - Minute Clinic","Research Facility"],
    under:["Sewer Section","Sewer System","Maintenance Tunnels","City Tunnels","Abandoned Subway Station","Subway Station"],
    home:["Apartment Complex","Rundown Hotel","Motel Room","Runners Pad","Highrise Apartment","Res Cube","Small Hotel"],
    shop:["Cyberpunk Old Pawn Shop","Gunstore","Electronics Store","Convenience Store","Tattoo Shop","Laundromat","Cyber Market"],
    roof:["Rooftop","Skyscraper Rooftops","The Old Rooftop","Tower Roof","Rooftop Parking Lot"],
    transit:["The Bus Terminal","Taxi Rank","Parking Garage","Cyberpunk Car Park","The Terminus - Corp Monorail Station"],
    outskirts:["Barrens","Dusty Road","Wasteland Road","Gas Station","Trailer Park","The Nomad Camp"]
  };

  const DISTRICTS = ["New Niemir","Downtown","The Docks","Old Capital","Orient Quarter","Corporate Plaza","Cinderline","Costa Morta","The Kennel","The Hills","The Barrens"];

  // Job types for generated gigs. places = PLACES keys that fit; factions
  // (optional) limits who the enemies can be.
  const KINDS = {
    "Recovery":{places:["den","warehouse","street","industrial","home"],
      titles:["Lost and Found","Repo Man","Finders Keepers","Second Hand","Return to Sender"],
      briefs:["{who} lost {item} to a {faction} crew. Get it back from {place}.","{item} went missing from a shipment. It's somewhere in {place}, guarded by {faction} muscle."],
      objectives:["Find {item} at {place}","Recover it intact","Get it to the fixer"]},
    "Delivery":{places:["street","transit","shop","docks"],
      titles:["Special Delivery","Courier","Hot Package","No Questions","Overnight"],
      briefs:["Take {item} across the district to {who}. {faction} people will want to know what's in the bag.","A package for {who}, delivered by hand through {place}. Don't open it."],
      objectives:["Pick up {item}","Get it through {place}","Hand it over to {who}"]},
    "Theft":{places:["corp","shop","warehouse","club"],
      titles:["Five Finger Discount","Sticky Fingers","Lift","Clean Hands","Off the Books"],
      briefs:["{item} sits in {place} under {faction} protection. The fixer has a buyer.","Steal {item} from {place}. Quiet is worth a bonus."],
      objectives:["Get into {place}","Take {item}","Leave without raising the alarm (bonus)"]},
    "Sabotage":{places:["industrial","corp","warehouse","docks"],
      titles:["Monkey Wrench","Spanner in the Works","Short Circuit","Agent Saboteur","Downtime"],
      briefs:["A {faction} operation at {place} is hurting the wrong people. Make it stop working.","Break the machines at {place} before the next shift. {faction} guards walk the floor."],
      objectives:["Get into {place}","Sabotage the target","Get out"]},
    "Bounty":{places:["den","club","home","street"],
      titles:["Wanted","Hunted","Dead or Alive","Marked","Paper on the Street"],
      briefs:["There's a price on a {faction} lieutenant hiding out at {place}.","A {faction} enforcer hurt {who}. The fixer wants him found at {place}."],
      objectives:["Track the target to {place}","Deal with the target (alive pays more)","Bring proof to the fixer"]},
    "Cyberpsycho":{places:["street","shop","transit","under","club"],
      titles:["Psycho Killer","Overclocked","Red Line","Chrome Shock","Edgerunner"],
      briefs:["Cyberpsycho sighting at {place}. Take them down before the Vigil turns it into a massacre. Non-lethal pays double.","Someone at {place} has lost it to their chrome. {who} is trapped nearby. Non-lethal pays double."],
      objectives:["Reach {place}","Protect bystanders","Take down the cyberpsycho (non-lethal pays double)"]},
    "Protection":{places:["club","shop","home","street"],
      titles:["Bodyguard","Night Watch","Close Protection","Hold the Door","Safe Passage"],
      briefs:["{who} has a {faction} problem. Keep them alive at {place} until morning.","Guard {place} tonight. A {faction} crew is coming."],
      objectives:["Get to {place}","Keep {who} safe","Hold until morning"]},
    "Rescue":{places:["den","warehouse","medical","under"],
      titles:["Way Out","Extraction","Lifeline","Jailbreak","Bring Them Home"],
      briefs:["{who} is being held by {faction} people at {place}. Get them out.","A {faction} crew took {who}. They're at {place}. Hurry."],
      objectives:["Find {who} at {place}","Get them out alive","Get them somewhere safe"]},
    "Data Heist":{places:["corp","medical","club"],factions:["Kurohane","Bastion","CivCorp","Marble Vigil"],
      titles:["Ghost Protocol","Backdoor","Data Mine","Zero Day","Jack In"],
      briefs:["Copy the files from a {faction} terminal at {place}.","Plug the fixer's shard into a {faction} server at {place} and hold the line."],
      objectives:["Get into {place}","Reach the terminal","Copy the data"]},
    "Collection":{places:["club","shop","home"],
      titles:["Debt Collector","Payday","Interest","Balance Due","Settling Up"],
      briefs:["Someone at {place} owes the fixer money and has {faction} friends.","Collect a debt from {place}. The debtor hired {faction} muscle."],
      objectives:["Find the debtor at {place}","Collect the money","Make sure it doesn't happen again"]},
    "Smuggling":{places:["docks","under","transit","outskirts"],
      titles:["Contraband","Run the Line","Under the Radar","Through Traffic","Shadow Cargo"],
      briefs:["Move {item} through {place} without {faction} checkpoints seeing it.","Get {who} through {place} and past the {faction} patrols."],
      objectives:["Collect the cargo","Get through {place}","Make the hand-off"]}
  };

  const TWISTS = [
    "The client lied about who the target is.",
    "A second crew was hired for the same job.",
    "The target offers the crew double to walk away.",
    "CivCorp peacekeepers arrive halfway through, called by someone who knew.",
    "The item or person is not what the brief said.",
    "The fixer is being squeezed by the target and needs the job to fail quietly.",
    "One of the enemies is someone the crew knows from the neighbourhood.",
    "The job is a test. The fixer is watching to see how the crew handles it.",
    "The place is rigged: a fire, a gas leak or a collapsing floor.",
    "Innocent workers are on site who were never mentioned.",
    "A Marble Vigil netrunner is watching the cameras.",
    "The payment will come late, and short, unless the crew pushes.",
    "A journalist is following the crew and wants an interview.",
    "The enemies are as poor and desperate as the people the crew grew up with.",
    "Something in the target's files mentions one of the crew by name.",
    "A rival fixer offers more if the crew sells out their client.",
    "The target has a kid with them.",
    "The alarm is already on when the crew arrives.",
    "Part of the payment is in Cinder allocation, not credits.",
    "Doing this job will annoy another fixer on the board.",
    "Halfway through, the fixer calls and doubles the pay. Something has gone very wrong on their end.",
    "The building's Cinder supply is cut mid-job: lights out, doors stuck, cameras dead.",
    "A peacekeeper patrol is parked outside the whole time, eating lunch.",
    "The target has already been hit by someone else; the crew walks into the aftermath.",
    "A cyberpsycho episode breaks out nearby and the Marble Vigil floods the district.",
    "The crew's faces show up on a CivCorp 'persons of interest' broadcast the next morning.",
    "The client wants a souvenir: something personal of the target's, brought back.",
    "A curfew siren sounds early. Anyone on the street after it is fair game.",
    "One of the guards is an old friend from the academy, the store or the block.",
    "The payload is booby-trapped. Opening it without care triggers a tracker or worse.",
    "The target is broadcasting the whole thing live to his followers.",
    "A rival crew already took the job, and they're friendlier than expected.",
    "The fixer's information is a week out of date.",
    "The real job is hidden in the brief. The fixer is testing whether the crew notices.",
    "The client is in the room, disguised, watching the crew work."
  ];

  // ------------------------------------------------------------ gig books

  // foundry/gigs/*.js push {fixer, gigs:[...]} onto FEHA_GIG_BOOKS before
  // this file runs. A gig names its city spot; district and battle map come
  // from the spot, enemies from its beats, and pay (unless given) from its
  // level, steady per gig. A reload pushes the books again: last one wins.
  function payFor(key,tier) {
    let h = 0;
    for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const [a,b] = TIERS[tier].pay;
    return Math.round((a + (h % 1000) / 999 * (b - a)) / 50) * 50;
  }

  function fromBook(gig,fixerKey) {
    const city = globalThis.FEHA_CITY;
    // spot may also be "scene:<name>" for a gig away from the city pins.
    const sceneSpot = String(gig.spot ?? "").startsWith("scene:") ? String(gig.spot).slice(6) : null;
    const place = gig.spot && !sceneSpot ? city?.place?.(gig.spot) : null;
    const enemies = new Map();
    for (const beat of gig.run?.beats ?? []) for (const [name,count] of beat.enemies ?? []) enemies.set(name,(enemies.get(name) ?? 0) + count);
    const firstScene = (gig.run?.beats ?? []).map(b => String(b.at ?? "")).find(a => a.startsWith("scene:"))?.slice(6);
    // A beat "<spot>@<scene>" runs at that pin on a better-fitting battle map.
    const spotMap = gig.spot && !sceneSpot ? (gig.run?.beats ?? []).map(b => String(b.at ?? "")).find(a => a.startsWith(gig.spot + "@"))?.slice(String(gig.spot).length + 1) : null;
    return {
      fixer:fixerKey,
      district:place?.district ?? FIXERS.find(f => f.key === fixerKey)?.district ?? "Alabastra",
      map:spotMap ?? place?.map ?? sceneSpot ?? firstScene ?? "",
      enemies:[...enemies.entries()],
      pay:gig.pay ?? payFor(gig.key,gig.tier),
      book:true,
      ...gig,
      spot:place ? gig.spot : null
    };
  }

  const bookKeys = new Map();
  for (const book of globalThis.FEHA_GIG_BOOKS ?? []) {
    for (const gig of book.gigs ?? []) bookKeys.set(gig.key,fromBook(gig,gig.fixer ?? book.fixer));
  }
  for (const gig of bookKeys.values()) {
    const at = JOBS.findIndex(j => j.key === gig.key);
    if (at >= 0) JOBS[at] = gig; else JOBS.push(gig);
  }

  // ------------------------------------------------- one level per fixer

  // NPC name -> [faction, level], from the generator rosters plus the few
  // units that only appear in written jobs.
  const UNIT = new Map();
  for (const [faction,f] of Object.entries(FACTIONS)) for (const [name,t] of f.roster) UNIT.set(name,[faction,t]);

  function scaleEnemies(enemies,delta) {
    if (!delta) return enemies;
    return enemies.map(([name,count]) => {
      const unit = UNIT.get(name);
      if (!unit) return [name,count];
      const [faction,t] = unit;
      const want = Math.max(1,Math.min(5,t + delta));
      const roster = FACTIONS[faction].roster;
      const best = roster.slice().sort((a,b) => Math.abs(a[1] - want) - Math.abs(b[1] - want) || (a[0] === name ? -1 : 0))[0];
      return [best?.[0] ?? name,count];
    }).reduce((out,[name,count]) => {
      const same = out.find(e => e[0] === name);
      if (same) same[1] += count; else out.push([name,count]);
      return out;
    },[]);
  }

  function retier(job) {
    if (job.for) return job;
    const fixer = FIXERS.find(f => f.key === job.fixer);
    const ring = RINGS.find(r => r.ring === fixer?.ring);
    if (!ring) return job;
    const tier = ring.tiers.includes(job.tier) ? job.tier : ring.tiers[0];
    if (tier === job.tier) return job;
    const [a,b] = TIERS[job.tier].pay, [c,d] = TIERS[tier].pay;
    const at = Math.max(0,Math.min(1,(job.pay - a) / Math.max(1,b - a)));
    const pay = Math.round((c + at * (d - c)) / 50) * 50;
    return {...job,tier,pay,enemies:scaleEnemies(job.enemies,tier - job.tier),retiered:job.tier};
  }

  for (const f of FIXERS) f.tiers = RINGS.find(r => r.ring === f.ring)?.tiers ?? [1];
  for (let i = 0; i < JOBS.length; i++) JOBS[i] = retier(JOBS[i]);

  globalThis.FEHA_JOB_CATALOG = {
    VERSION,TIERS,RINGS,RANKS,FIXERS,JOBS,
    gen:{FACTIONS,GANGS,ITEMS,WHO,PLACES,DISTRICTS,KINDS,TWISTS}
  };

  try {
    game.adk ??= {};
    game.adk.jobCatalog = globalThis.FEHA_JOB_CATALOG;
  } catch {}
})();
