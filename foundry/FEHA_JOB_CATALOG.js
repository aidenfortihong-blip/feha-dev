// FEHA // JOB CATALOG
//
// Data only: the fixers of Alabastra, the hand-written jobs they offer and
// the tables the job board uses to roll endless generated gigs. The board
// itself (FEHA_JOBS.js) reads globalThis.FEHA_JOB_CATALOG.
//
// Job fields: key, fixer, tier (1-5), kind, title, district, map (scene name
// or name prefix), enemies [[NPC catalog name, count]], pay (credits per
// crew member), brief and objectives (players see these), twist (GM only).
// Street Cred and the cred needed to take a job come from TIERS.

(() => {
  const VERSION = "1.0.0";

  // Pay is per crew member. cred = Street Cred earned; need = Street Cred
  // the requesting character must have to take a job of this tier.
  const TIERS = {
    1:{label:"TIER I",  pay:[400,900],     cred:6,  need:0},
    2:{label:"TIER II", pay:[1200,2400],   cred:10, need:20},
    3:{label:"TIER III",pay:[3000,5500],   cred:15, need:50},
    4:{label:"TIER IV", pay:[7000,12000],  cred:22, need:100},
    5:{label:"TIER V",  pay:[15000,30000], cred:30, need:170}
  };

  // Street Cred ranks shown on the board (minimum cred for each rank).
  const RANKS = [
    [0,"NOBODY"],[20,"KNOWN"],[50,"RELIABLE"],[100,"RESPECTED"],[170,"NAMED"],[260,"LEGEND"]
  ];

  const FIXERS = [
    {
      key:"len", name:"Len Ortega", handle:"LEN", district:"New Niemir", tiers:[1,2],
      blurb:"Sasha's boss at Len's Discount Tech Emporium. Runs a cramped repair counter and a longer list of favours. Pays late, pays fair.",
      voice:"Bring it back in one piece. The device, I mean. You too, ideally."
    },
    {
      key:"babka", name:"Babka Ilinova", handle:"BABKA", district:"New Niemir", tiers:[1,3],
      blurb:"Sloviti grandmother who came over on the third refugee wave and never stopped organising. Her jobs keep people fed, housed and out of CivCorp cells. She pays in what she has.",
      voice:"Nobody is coming to save us. So. You will do."
    },
    {
      key:"kiyama", name:"Saburo Kiyama", handle:"KIYAMA", district:"Orient Quarter", tiers:[2,4],
      blurb:"Soft-spoken go-between for the Yakuza family that runs out of the HQ tower. Collections, protection, problems that need to go away quietly.",
      voice:"The family remembers who was useful. It also remembers who was not."
    },
    {
      key:"dialtone", name:"Reyna Castell", handle:"DIAL TONE", district:"Downtown", tiers:[2,5],
      blurb:"Netrunner turned broker. Never meets in person; her voice comes out of whatever speaker is closest. Data jobs, corp secrets, anything with a firewall.",
      voice:"Data wants to be free. I just charge a finder's fee."
    },
    {
      key:"duval", name:"Maurice Duval", handle:"CARP-LINE", district:"The Docks", tiers:[2,4],
      blurb:"Ex-Navy quartermaster and loud Vargas loyalist who idolises Admiral Rosa. Moves cargo the Council's customs never see and talks politics the whole time.",
      voice:"The Admiral says the harbour belongs to the people. I say it belongs to whoever's paying the tug."
    },
    {
      key:"hale", name:"Verity Hale", handle:"MS. HALE", district:"Corporate Plaza", tiers:[3,5],
      blurb:"Corporate facilitator with a spotless suit and no listed employer. Pays the most, explains the least, and has never once said which corp she works for.",
      voice:"Discretion is the deliverable. Everything else is a detail."
    },
    {
      key:"clerk", name:"Clerk Seven", handle:"CLERK SEVEN", district:"Old Capital", tiers:[1,4],
      blurb:"A CivCorp records clerk who sells off-book warrants and cyberpsycho sightings before the peacekeepers get to them. Never gives a real name. Non-lethal takedowns pay double.",
      voice:"Officially this file doesn't exist. Unofficially, it pays."
    }
  ];

  const J = (fixer,key,tier,kind,title,district,map,enemies,pay,brief,objectives,twist) =>
    ({key:fixer+"-"+key,fixer,tier,kind,title,district,map,enemies,pay,brief,objectives,twist});

  const JOBS = [
    // ---------------------------------------------------------------- LEN
    J("len","repo-deck",1,"Recovery","Unpaid Deck","New Niemir","Booster Basement",
      [["Street Thug",3],["Street Netrunner",1]],600,
      "A customer walked out with a refurbished cyberdeck on a payment plan and stopped paying after week one. He's crashing at a booster den. Len wants the deck back, not a body.",
      ["Find Tomasz Wren at the booster den","Recover the cyberdeck (intact pays in full)","Optional: settle it without anyone getting shot"],
      "Tomasz sold the deck's neural chip to buy food for his sister. The deck is there, the chip is at a Yakuza-protected pawn shop. Len will pay half without the chip."),
    J("len","fragile",1,"Delivery","Fragile, This Side Up","New Niemir","Ripperdoc Clinic",
      [["Street Gunner",2]],500,
      "A crate of Helix diagnostic boards needs to reach a back-alley ripperdoc across the district before curfew. Don't drop it, don't open it, don't be late.",
      ["Pick up the crate at the Emporium","Deliver it to the ripperdoc before curfew","Get the ripperdoc's signature"],
      "The boards are stolen Helix stock with live trackers. A Helix recovery team (Helix Medtech + 2 Street Gunners on contract) arrives at the clinic ten minutes after the crew."),
    J("len","scrap",1,"Recovery","Scrap Run","Old Capital","Car Scrap Yard",
      [["Street Thug",4],["Chromehead",1]],650,
      "There's a burnt-out Vektor hauler at the scrap yard with its power cells still in it. A scav crew is stripping the yard tonight. Get the cells first.",
      ["Reach the hauler before the scavs","Pull at least four power cells","Get out of the yard"],
      "The scavs are teenagers from New Niemir and their leader is a cousin of someone the crew knows. She offers a split if the crew helps them instead."),
    J("len","inside",1,"Investigation","Inside Job","New Niemir","Electronics Repair Workshop",
      [["Street Thug",2]],450,
      "Stock keeps vanishing from the Emporium's back room and the locks aren't broken. Len wants to know who, and he wants it quiet.",
      ["Stake out the workshop overnight","Identify the thief","Bring Len proof"],
      "It's Len's nephew, paying off a loan shark who threatens his mother. The loan shark and two thugs come by to collect during the stakeout."),
    J("len","highscore",1,"Recovery","High Score","Downtown","Video Games Arcade",
      [["Street Netrunner",1],["Street Thug",2]],550,
      "Someone hacked the arcade's cabinets to pay out jackpots. The owner traced it to a kid netrunner who hangs around the back booths. Recover the payout chip.",
      ["Find the kid at the arcade","Recover the payout chip","Make sure the cabinets stop paying out"],
      "The kid found a Corvus Neural backdoor in the cabinet firmware. The chip is worth far more to Dial Tone than to the arcade owner."),
    J("len","stall",1,"Protection","Stall Guard","New Niemir","Market Stalls",
      [["Street Thug",3],["Street Gunner",1]],400,
      "Len's running a market stall during the night festival. A rival vendor has been sending goons to knock over tables. Keep the stall standing until close.",
      ["Guard the stall until close","Keep the stock safe","Optional: find out who sent the goons"],
      "The rival vendor is being squeezed by the same goons and sent them to Len to get them off his own back."),
    J("len","lights",2,"Delivery","Lights On","New Niemir","Slum Streets",
      [["CivCorp Peacekeeper",3]],1300,
      "A whole block lost its Cinder allocation overnight. Len has a generator that fell off a truck. Get it there, get it wired, get out before the patrol comes round.",
      ["Move the generator to the block","Wire it into the building's grid","Leave before the patrol arrives"],
      "The cut was punishment for a strike vote. Anyone seen installing the generator goes into CivCorp files as a sympathiser."),
    J("len","birddown",2,"Recovery","Bird Down","New Niemir","The Old Rooftop",
      [["CivCorp Peacekeeper",2],["CivCorp Netrunner",1]],1600,
      "A CivCorp surveillance drone crashed on a rooftop. Len wants its optics before the retrieval team gets there. They are already on their way.",
      ["Reach the rooftop before CivCorp","Strip the drone's optics","Wipe or take its memory core"],
      "The memory core holds footage of a peacekeeper shooting an unarmed striker. Babka would pay to have it broadcast; CivCorp would kill to stop it."),
    J("len","pawned",2,"Theft","Pawned Prototype","Orient Quarter","Cyberpunk Old Pawn Shop",
      [["Yakuza Kobun",3],["Yakuza Enforcer",1]],1800,
      "A desperate Jade Arc engineer pawned a prototype scope. Len has a buyer. Buy it back or take it, but the pawn shop is not going to sell cheap.",
      ["Get the prototype scope","Don't burn the shop down","Get the scope to Len"],
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
      "He wants to give the crew the evidence of how Vargas was removed from office.")
  ];

  // ----------------------------------------------------------- GENERATOR
  // The board rolls a gig from these tables: a fixer, a job type, a target
  // faction for the enemies and a place. Each type has a few title and
  // brief templates; {item}, {who}, {place} and {faction} are filled in.

  const FACTIONS = {
    "Street":        {tiers:[1,2], roster:[["Street Thug",1],["Street Gunner",1],["Chromehead",2],["Street Netrunner",2]]},
    "Yakuza":        {tiers:[1,4], roster:[["Yakuza Kobun",1],["Yakuza Enforcer",2],["Yakuza Blade",3],["Yakuza Wakagashira",4]]},
    "CivCorp":       {tiers:[1,3], roster:[["CivCorp Peacekeeper",1],["CivCorp Rifleman",2],["CivCorp Riot Enforcer",2],["CivCorp Netrunner",2],["CivCorp Warden",3]]},
    "Marble Vigil":  {tiers:[3,5], roster:[["Marble Vigil Operative",3],["Marble Vigil Marksman",3],["Marble Vigil Breacher",3],["Marble Vigil Netrunner",3],["Marble Vigil Captain",4]]},
    "Kurohane":      {tiers:[2,5], roster:[["Kurohane Security",2],["Kurohane Trooper",2],["Kurohane Agent",3],["Kurohane Elite Guard",3],["Kurohane Netrunner",3],["Kurohane Sniper",3],["Kurohane Oni",4]]},
    "Bastion":       {tiers:[2,5], roster:[["Bastion Trooper",2],["Bastion Grenadier",2],["Bastion Marksman",3],["Bastion Sergeant",3],["Bastion Heavy",3],["Bastion Commander",4]]},
    "Navy":          {tiers:[1,3], roster:[["Navy Rating",1],["Navy Marine",2]]}
  };

  const ITEMS = [
    "a prototype Corvus neural chip","a stolen Helix Vitae med-crate","a Jade Arc rifle scope","a Kurohane access card",
    "a ledger of Cinder allocations","a braindance master recording","a crate of ForgeLine ammunition","a cyberdeck full of stolen identities",
    "a Bastion drone's flight recorder","an encrypted Council memo","a box of untraceable credsticks","a Sandevistan straight from the factory",
    "a list of CivCorp informants","the deed to a New Niemir tenement","a black-market Mk.III cyberarm","a vial of combat stims"
  ];

  const WHO = [
    "a union organiser","a corp accountant","a runaway academy student","a ripperdoc who knows too much","a Navy deserter",
    "a refugee family","a street kid netrunner","a CivCorp whistleblower","a fixer's courier","a Kurohane middle manager",
    "a striker's daughter","a journalist from an indie station"
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

  const DISTRICTS = ["New Niemir","Downtown","The Docks","Old Capital","Orient Quarter","Corporate Plaza","Undercity","The Barrens"];

  // Job types for generated gigs. places = PLACES keys that fit.
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
    "Data Heist":{places:["corp","medical","club"],
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
    "Doing this job will annoy another fixer on the board."
  ];

  globalThis.FEHA_JOB_CATALOG = {
    VERSION,TIERS,RANKS,FIXERS,JOBS,
    gen:{FACTIONS,ITEMS,WHO,PLACES,DISTRICTS,KINDS,TWISTS}
  };

  try {
    game.adk ??= {};
    game.adk.jobCatalog = globalThis.FEHA_JOB_CATALOG;
  } catch {}
})();
