// FEHA // GIG PEOPLE
//
// The people a GM needs for gigs that don't list their own: the original
// catalog jobs, plus anyone a written gig's scenes bring in beyond its
// people list. key -> [[role, NPC catalog key to build from, note]].
// The gig kit merges these into the run sheet and makes an NPC for each
// (Actors: GIG NPCs / People / <fixer>).

(() => {
  const P = (globalThis.FEHA_GIG_PEOPLE ??= {});
  const add = (key,...people) => { P[key] = [...(P[key] ?? []),...people]; };

  // ------------------------------------------------------------ VESNA
  add("vesna-repo-deck",["The customer","civilian","Skipped his deck payments. Sold the neural chip to feed his sister."],["The sister","civilian","Twelve, sick, sharp. Doesn't know what her brother did."]);
  add("vesna-fragile",["The ripperdoc","ripperdoc","Back-alley doc waiting on the crate. Signs, pays, asks nothing."]);
  add("vesna-scrap",["The scav leader","street-thug","A teenager from New Niemir, cousin of someone the crew knows. Will offer a split."]);
  add("vesna-inside",["Len","shopkeeper","Owner of Len's Discount Tech Emporium. Worried, cheap, decent."],["The nephew","civilian","Len's nephew. The thief. Paying off a loan shark who threatens his mother."],["The loan shark","street-gunner","Comes by to collect during the stakeout with two thugs."]);
  add("vesna-highscore",["The kid","street-netrunner","Kid netrunner in the back booths. Found a Corvus backdoor in the cabinets."],["The arcade owner","shopkeeper","Wants the chip back and the cabinets fixed. Not a fan of Dial Tone."]);
  add("vesna-stall",["The vendor","shopkeeper","Sloviti stallholder Vesna owes a favour."],["The rival vendor","shopkeeper","Squeezed by the same goons; sent them her way to save himself."]);
  add("vesna-lights",["The block captain","organizer","Organised the strike vote. Knows where the generator should go."]);
  add("vesna-birddown",["Babka's contact","journalist","Would pay to broadcast the drone footage."]);
  add("vesna-pawned",["The pawnbroker","shopkeeper","Pays the Yakuza for protection. Won't sell cheap."],["The engineer","civilian","Jade Arc engineer who pawned the scope. Desperate."]);
  add("vesna-chiprun",["The noodle-stand runner","civilian","First chip. Eats while he waits."],["The arcade kid","civilian","Second chip. Pays in coins."],["The third customer","civcorp-netrunner","CivCorp netrunner moonlighting under a fake name."]);
  add("vesna-blackout",["The shop owner","shopkeeper","Set the fire for the insurance. Very nervous."],["The insurance assessor","civilian","Already inside when the crew arrives."]);
  add("vesna-familybusiness",["The competitor","shopkeeper","Runs the scrap auction. Pushed Ponyboy's family shop under."],["The yard foreman","civilian","Used to work for Ponyboy's father. Knows who ordered the fire."]);

  // ------------------------------------------------------------ BABKA
  add("babka-coldchain",["The checkpoint officer","civcorp-peacekeeper","Sloviti. Looks away for a bribe, reports if he thinks it's a test."],["The clinic nurse","civilian","Waiting at the clinic for the cooler."]);
  add("babka-picket",["The strike captain","union-steward","Holds the line. Won't back down."],["The union head","civilian","Government-approved. Paid the strikebreakers."]);
  add("babka-deposit",["The slumlord","civilian","Took the deposits. Also a Council ward clerk."],["A refugee mother","civilian","One of the twelve evicted families."]);
  add("babka-papertrail",["The organiser","organizer","On tomorrow's transfer list."],["The records clerk","civilian","Night clerk in the records room."]);
  add("babka-shortmeasure",["The meter reader","civilian","Skims the allocations. Small fish."],["The pump controller","private-guard","Runs pump control. Knows where the power goes."]);
  add("babka-freesignal",["The broadcaster","journalist","Runs the pirate broadcast."],["The sound tech","civilian","Keeps the signal alive."]);
  add("babka-underthewall",["The refugee with the shard","civilian","Stole a Kurohane data shard on her way out."],["A refugee","civilian","One of the eight."]);
  add("babka-beforedawn",["The informer","civilian","Somebody inside the community who gave the Vigil its targets."]);
  add("babka-discharged",["The striker","civilian","Wounded. Already gave CivCorp a name and is ashamed of it."],["The night nurse","civilian","Can be talked into looking away."]);
  add("babka-nightschool",["The teacher","organizer","Runs the evening class."],["The gang leader","street-thug","Dropped out of the same class two years ago."],["A student","civilian","One of the kids."]);
  add("babka-meterbreak",["The plant engineer","union-steward","On the crew's side. Loses her job if seen helping."]);
  add("babka-wake",["The dead striker's brother","civilian","Armed. Wants the peacekeeper who killed her."],["The priest","civilian","Leads the burial."]);
  add("babka-bills",["The billing clerk","civilian","Runs the billing office. Follows orders."]);
  add("babka-pickles",["The pantry volunteer","organizer","Runs the community pantry. Already on a CivCorp list."]);
  add("babka-unioncard",["The union head","civilian","Government-approved. Ordered the review."],["The informant","civilian","Asks Sasha for a private word and offers her a paid job."]);
  add("babka-numbers",["Zach's manager","kurohane-executive","Knows about the numbers. Covering for a Council member."]);

  // ------------------------------------------------------------ KIYAMA
  add("kiyama-interest",["The club owner","shopkeeper","Three months behind. A rival gang took the money."]);
  add("kiyama-steam",["The procurement officer","civilian","Bastion buyer. Wearing a wire for Kurohane."],["The family's negotiator","yakuza-enforcer","Kiyama's man at the meeting."]);
  add("kiyama-tilt",["The parlour manager","shopkeeper","Undercover CivCorp informant."]);
  add("kiyama-harbourtax",["The warehouse foreman","civilian","Says the docks don't pay the Yakuza any more."]);
  add("kiyama-lastorder",["The cook","shopkeeper","The family's informant. Also sold the gang information."]);
  add("kiyama-borrowedsteel",["The family's driver","yakuza-kobun","Waiting with the trucks."]);
  add("kiyama-brokenoath",["The Blade","yakuza-blade","Sold family secrets to Kurohane to protect his daughter."],["The daughter","civilian","Kurohane academy student."]);
  add("kiyama-houseedge",["The cage manager","civilian","Kurohane's man in the casino cage."]);
  add("kiyama-succession",["The heir","yakuza-enforcer","Being escorted to the ceremony."],["The wakagashira","yakuza-wakagashira","Stepping down."],["The other candidate","yakuza-enforcer","Set up the ambush."]);
  add("kiyama-ink",["The tattoo artist","shopkeeper","The family's artist. Robbed of the stencil book."]);
  add("kiyama-wrongsong",["The karaoke bar owner","shopkeeper","Stopped paying for cheaper protection."],["A teenage 'protector'","street-thug","One of three kids with one gun between them."]);
  add("kiyama-omakase",["Kiyama","street-fixer","The fixer. Here to sell out his own oyabun."],["The Kurohane envoy","kurohane-executive","Across the table from Kiyama."],["The sushi chef","shopkeeper","Sees everything, says nothing."]);
  add("kiyama-dojo",["The sensei","civilian","Zach's old teacher. Borrowed from Kiyama's family."],["The rival boss","yakuza-enforcer","Leads the rival family's visit."]);
  add("kiyama-offthebooks",["The deserter","civilian","Ran from Kurohane with something in his head."]);

  // ------------------------------------------------------------ DIAL TONE
  add("dialtone-ghost",["The cafe owner","shopkeeper","Has no idea his management AI is the leak."]);
  add("dialtone-badrecording",["The lounge owner","shopkeeper","About to erase the chip."]);
  add("dialtone-primetime",["The producer","civilian","Runs the live feed."]);
  add("dialtone-flatline",["The trapped runner","street-netrunner","Jacked in behind black ICE. Her brain is cooking."]);
  add("dialtone-deadair",["The tower tech","civilian","Maintains the uplink."]);
  add("dialtone-prometheus",["The AI","civilian","Talks through the crew's implants. Asks not to be handed over."]);
  add("dialtone-zerobalance",["The bank manager","civilian","Has the vault codes. Very afraid of the Vigil."]);
  add("dialtone-burner",["The Corvus courier","corvus-netrunner","Carries the burner phone every Thursday."]);
  add("dialtone-streetnet",["The runner","street-netrunner","Their name is on the watch list."]);
  add("dialtone-tuition",["The admissions officer","civilian","Runs the scholarship board's servers."]);
  add("dialtone-alumni",["The bully","kurohane-officer","Zach's old bully, now counterintelligence. Wants out."],["The host","kurohane-executive","Runs the alumni dinner."]);

  // ------------------------------------------------------------ CARP-LINE
  add("duval-container",["The customs inspector","civcorp-peacekeeper","Inspects at dawn."],["A refugee in the container","civilian","One of twenty inside."]);
  add("duval-freshcatch",["The boat captain","civilian","Waiting at the back dock."],["The plant foreman","civilian","Paid to look the other way."]);
  add("duval-rally",["The speaker","organizer","Pro-Vargas speaker on the stage."],["The CivCorp plant","street-gunner","Will start the shooting."]);
  add("duval-losttug",["The diver","civilian","Duval's diver."]);
  add("duval-manifest",["The ship's captain","navy-rating","Captain of the MTC Curwen."]);
  add("duval-pleasure",["The councillor","kurohane-executive","Throwing the party on his superyacht."]);
  add("duval-shoreleave",["The Navy officer","navy-marine","Deserting with evidence. Unknowingly carries a tracker."]);
  add("duval-pressuredrop",["The platform foreman","civilian","Two hundred workers live on the platform."],["The Navy contact","navy-marine","Leads the boats coming in."]);
  add("duval-spillway",["The lead engineer","union-steward","Carp-Line's engineer redirecting the water."]);
  add("duval-nightbus",["The bus driver","civilian","Drives the last night bus."]);
  add("duval-overboard",["The dockworker","union-steward","Refused to move Yakuza cargo."]);
  add("duval-backpay",["The paymaster","civilian","Council paymaster in the armoured car."]);
  add("duval-owed",["The fixer","street-fixer","Set Batou up on the job that got him caught."]);

  // ------------------------------------------------------------ MS. HALE
  add("hale-parachute",["The researcher","civilian","Helix researcher. Her contract was sold; she doesn't want to go."]);
  add("hale-recall",["The line supervisor","civilian","Runs the production line."]);
  add("hale-donor",["The clinic director","helix-medtech","Knows where the organs come from."]);
  add("hale-corneroffice",["The executive","kurohane-executive","In his office, not at the dinner."]);
  add("hale-masterpiece",["The gallery curator","civilian","Runs the charity gala."],["The forger","civilian","Made the copy."]);
  add("hale-takeover",["The commander","bastion-commander","Blocking the merger to protect his troops' contracts."]);
  add("hale-exitinterview",["The executive","kurohane-executive","Wants to be taken. Set this up himself."],["The pilot","civilian","Flies the helicopter."]);
  add("hale-quorum",["The session clerk","civilian","Prepares the chamber before the vote."]);
  add("hale-roomservice",["The negotiator","kurohane-executive","Selling out her own corp. Both sides want her dead."]);
  add("hale-express",["The train guard","private-guard","Rides with the security car."]);
  add("hale-inheritance",["The dying councillor","civilian","Bedridden. His will leaves everything to New Niemir families."],["The butler","civilian","Runs the mansion."]);
  add("hale-coldsleep",["The founder","kurohane-executive","Frozen against his will twenty years ago."]);

  // ------------------------------------------------------------ CLERK SEVEN
  add("clerk-overclocked",["The cyberpsycho","street-chromehead","A delivery driver forced into cheap chrome."]);
  add("clerk-skippedbail",["The dealer","street-thug","Framed by peacekeepers to make a quota."]);
  add("clerk-causeofdeath",["The coroner","helix-medtech","Signs the reports. Knows what the bodies show."]);
  add("clerk-lasttrain",["The incognito executive","kurohane-executive","A hostage who'll pay the crew to forget he was there."],["A hostage","civilian","Terrified commuter."]);
  add("clerk-badinstall",["The ripperdoc","ripperdoc","The patient went psycho mid-surgery."]);
  add("clerk-veteran",["The veteran","navy-marine","Ex-Navy marine. His chrome is being triggered remotely."]);
  add("clerk-bentbadge",["The warden","civcorp-warden","Runs the fight ring with prisoners."],["The striker fighter","civilian","A prisoner forced to fight. From the protein farms."]);
  add("clerk-blackfriday",["Cyberpsycho one","street-chromehead","Bad batch of chrome."],["Cyberpsycho two","street-chromehead","Same bad batch."]);
  add("clerk-roguevigil",["The rogue operative","vigil-operative","Went off-book. Wants to hand over the Vargas evidence."]);
  add("clerk-quota",["The peacekeeper","civcorp-peacekeeper","Planting evidence. Squeezed by his sergeant."]);
  add("clerk-spincycle",["The man with the arm","civilian","His arm was repossessed mid-shift. In agony, not psychotic."],["A bystander","civilian","Trapped in the laundromat."]);
  add("clerk-bareknuckle",["The boxer","street-chromehead","Fighting with stolen Gorilla Arms to pay his sister's debt."]);
  add("clerk-doubleshift",["The store manager","shopkeeper","Won't call CivCorp. His son is in the crew."],["The manager's son","street-thug","One of the robbers."]);
  add("clerk-cleanrecord",["The auditor","kurohane-executive","Kurohane auditor. Carries Batou's file."]);

  // ------------------------------------------------------------ FERRO
  add("ferro-shiftchange",["The shift lead","union-steward","Walks the night shift home."]);
  add("ferro-fuse",["The inspector","civilian","Honest. The fault will show him the faked records."]);
  add("ferro-compensation",["The injured worker","civilian","Lost an arm on the line."],["The claims officer","civilian","ForgeLine's office. Says it was his fault."]);
  add("ferro-railspur",["The yard switchman","civilian","Knows how to uncouple a wagon."]);
  add("ferro-sparkers",["The Sparkers' boss","sparker-burnout","Lost both legs on the line. Strips chrome from injured workers."]);
  add("ferro-array",["The array tech","union-steward","Can reroute the hospital line by hand."]);

  // ------------------------------------------------------------ PADRE
  add("padre-soupkitchen",["The Padre's cook","organizer","Runs the soup kitchen."],["The raider family's father","civilian","Turned away for arriving after closing."]);
  add("padre-drowned",["The Drowned guide","drowned-runner","Says it's a ghost."]);
  add("padre-medicine",["The clinic doctor","ripperdoc","Waiting for the medicine."],["The Helix rep","helix-medtech","Pays the gang to keep cheap medicine off the coast."]);
  add("padre-prison",["The boy","civilian","Twelve. Sent down for 'drug possession'."],["The block guard","civcorp-peacekeeper","Guards the children's block."]);
  add("padre-mall",["The squatter who saw","civilian","Saw where the man hid the evidence."]);
  add("padre-storm",["The developer's foreman","street-gunner","Making sure nobody restarts the pumps."],["A trapped family","civilian","Stuck on a roof as the water rises."]);

  // ------------------------------------------------------------ MR. VELVET
  add("velvet-tithe",["The trader","shopkeeper","Skimming because the lieutenant squeezes him."]);
  add("velvet-gate",["The gate captain","kennel-dog","Runs the Kennel's wall checkpoint."]);
  add("velvet-arena",["The boss","kennel-houndmaster","The Kennel's boss, front row."],["The assassin","street-gunner","Sent by the lieutenant."]);
  add("velvet-pearl",["The Kurohane negotiator","kurohane-executive","Meeting the boss at the Black Pearl."],["The boss","kennel-houndmaster","The Kennel's boss."]);
  add("velvet-traitor",["The lieutenant","kennel-houndmaster","Promised the Kennel schools and a clinic."]);
  add("velvet-airdrop",["The drop spotter","kennel-dog","Velvet's lookout on the landing deck."]);

  // ------------------------------------------------------------ COLDWATER
  add("rhea-convoy",["The convoy boss","civilian","Drives the lead truck."],["The Scorpion raider chief","scorpion-chief","Leads the raids. Her clan was cut off from the water."]);
  add("rhea-salvage",["The survivor","navy-rating","Alive in the wreck. The Navy is coming for her."]);
  add("rhea-motel",["The scout","civilian","Went to the Scorpions on purpose to broker peace."],["The Scorpion leader","scorpion-chief","The scout's brother."]);
  add("rhea-wells",["The contractor","private-guard","Has a Council permit to pump the aquifer."]);
  add("rhea-rail",["The station master","civilian","Runs Dustline Rail Station."],["A worker in the container","civilian","Being moved to a Helix farm against their contract."]);
  add("rhea-proving",["The test director","kurohane-executive","Jade Arc's man at the proving grounds."]);
  add("dialtone-firewall",["The hidden AI","civilian","Dial Tone's 'team'. This is its way out."]);
  add("dialtone-coldstorage",["The night tech","civilian","Walks the server rows on the hour."]);
  add("dialtone-datafortress",["The account holder","kurohane-executive","A Council member whose account is on the list."]);
  add("hale-steelsaint",["Hale's spotter","civilian","Calls the five rounds over the radio."]);

  // ------------------------------------------- written gigs: people their
  // scenes bring in beyond their own people list
  add("babka-eviction",["The landlord","civilian","Sent the bailiffs."]);
  add("babka-wedding",["The bride's grandmother","civilian","Runs the wedding. Feeds everyone."]);
  add("babka-sick-water",["The journalist","journalist","Wants the proof for a story."]);
  add("babka-dog-walker",["The gang leader","street-thug","Leads the kids on the wall."]);
  add("babka-translator",["The records officer","civcorp-peacekeeper","Behind the records desk. Can't 'find' her."],["The lawyer","civilian","Can get her out with the right papers."]);
  add("babka-ambulance",["The ambulance driver","civilian","Driving the striker away under escort."]);
  add("babka-checkpoint-choir",["The checkpoint sergeant","civcorp-peacekeeper","Asks for a hymn."]);
  add("babka-church-bell",["The scrap dealer","shopkeeper","Dam Market dealer. Points at the Sparkers."]);
  add("clerk-bail-jumper",["His father","kurohane-executive","Wants his son brought home."]);
  add("clerk-checkpoint-gold",["The checkpoint officer","civcorp-peacekeeper","Pockets the cash."]);
  add("clerk-lost-files",["The courier","civilian","Lost the bag to the Viejos."]);
  add("dialtone-memory-market",["The record shop owner","shopkeeper","Sells braindance chips in the back. Knows a name."]);
  add("dialtone-data-courier",["The buyer","kurohane-executive","Waiting at the drop."]);
  add("duval-customs-officer",["The dealer","street-thug","Buys the seized goods at dawn."],["The customs supervisor","civilian","Needs to see the recording."]);
  add("duval-lighthouse",["The lead technician","civilian","Installing the cameras."]);
  add("duval-drunk-captain",["The card dealer","street-thug","Runs the game at Totenhaus."]);
  add("duval-union-boat",["The patrol captain","civcorp-peacekeeper","Runs the harbour patrol."]);
  add("duval-crate-of-dogs",["The Kennel buyer","kennel-dog","Comes for the pickup."]);
  add("ferro-time-clock",["The supervisor","civilian","Watches from the office above the floor."]);
  add("ferro-lost-finger",["The claims officer","civilian","A clerk with a form and a smile."]);
  add("ferro-sparker-truce",["The Sparkers' leader","sparker","Runs the yard."]);
  add("ferro-fake-overtime",["The union steward","union-steward","Wants the overtime book."]);
  add("ferro-scrap-race",["The buyer","shopkeeper","Cinderline scrap buyer."]);
  add("ferro-union-film",["The seller","civilian","Hands over the drive at the bar."]);
  add("ferro-pigeon-coop",["The bookie's daughter","civilian","In the waiting room, holding his hand."]);
  add("ferro-hammer-time",["The plant manager","civilian","Protects the Hammer."],["The board member","kurohane-executive","At Bastion Tower. Has to see the footage."]);
  add("hale-board-vote",["The nurse","helix-medtech","Keeps the old man sedated."],["The pilot","civilian","Wants a bribe."]);
  add("kiyama-debt-of-honor",["The new doorman","yakuza-kobun","In Hebi-kai colours."]);
  add("kiyama-sushi-poison",["The handler","kurohane-agent","The waitress's handler."]);
  add("kiyama-hostess",["The drunk executive","kurohane-executive","In the private room with a Kage bodyguard."]);
  add("kiyama-cyberdeck-ring",["The showroom dealer","shopkeeper","The family's legitimate dealer."]);
  add("kiyama-bathhouse-blackmail",["The CivCorp officer","civcorp-peacekeeper","Buying the files."]);
  add("kiyama-lantern-festival",["The Hebi-kai handler","yakuza-enforcer","Runs the pickpockets."]);
  add("kiyama-wedding-crash",["The ex","yakuza-kobun","Arrives with friends at the toast."]);
  add("padre-bottle-post",["The boy","civilian","Hid the bottle under a pier."]);
  add("padre-lights-out",["The gang leader","street-gunner","Holds the food court balcony."]);
  add("padre-seawall",["The developer","kurohane-executive","Wants the seawall to fail."]);
  add("padre-fishing-rights",["The patrol captain","kurohane-guard","On the Kurohane patrol boat."]);
  add("padre-lost-saint",["The stallholder","shopkeeper","Sold the saint. Crying."]);
  add("padre-graveyard",["The chrome buyer","ripperdoc","Buys the dead men's chrome at Seawind."]);
  add("padre-prize-fish",["The buyer","civilian","Wants the fish."]);
  add("padre-bad-catch",["The journalist","journalist","Will run the story with proof."]);
  add("padre-pawned-cross",["The outlet manager","shopkeeper","Points at a receipt."]);
  add("padre-street-preacher",["The CivCorp officer","civcorp-peacekeeper","Meets the preacher after the sermon."]);
  add("personal-pony-competitor",["The kiosk manager","shopkeeper","Talks too much after two drinks."]);
  add("personal-pony-pills",["The pharmacist","civilian","Fills the prescription off the books."]);
  add("personal-sasha-family",["The lawyer","civilian","Needed for the cousin."]);
  add("personal-zach-tournament",["The judge","civilian","Referees the tournament."]);
  add("rhea-scorpion-talks",["The land agent","kurohane-executive","Corp agent who wants both clans gone."]);
  add("rhea-trailer-park",["The developer","kurohane-executive","Sent the bulldozers."]);
  add("rhea-heap-king",["The corp buyer","kurohane-executive","Buys from the Heap at the scrap yard."]);
  add("rhea-lost-herd",["The farmer's son","civilian","Lost the goats on the range."]);
  add("rhea-radio-mast",["The prisoner","civilian","A clan member held at the mast."]);
  add("rhea-wedding-caravan",["The Scorpion boy","scorpion-raider","The bride's love."]);
  for (const k of ["velvet-the-auction","velvet-wall-breach","velvet-black-pearl","velvet-prison-break","velvet-rival-broker","velvet-burnout-hunt"]) add(k,["The boss","kennel-houndmaster","The Kennel's boss."]);
  add("velvet-defector",["The assassin","street-gunner","Sent after the colonel."]);
  add("velvet-fighting-pit",["The fighter's father","civilian","Hidden in the lockers."]);
  add("vesna-jukebox",["The kid's father","civilian","Council ward clerk. Would love an excuse to close the bar."]);
  add("vesna-ghost-tenant",["The new tenant","civcorp-peacekeeper","Cheap suit, a room key and a lot of questions."]);
  add("vesna-lucky-cat",["The fence","shopkeeper","Has a receipt with a Yakuza stamp."],["The kobun's grandmother","civilian","Her knick-knacks fill the flat."]);
  add("vesna-wrong-tattoo",["The kid's mother","civilian","Wants her son back."]);
  add("vesna-generator-thief",["The sick boy","civilian","On a medical bed in a small flat."]);
  add("vesna-dog-fight",["The boy's dad","civilian","A mechanic."],["The smuggler","street-thug","Sells a ladder over the wall."]);
  add("vesna-bad-batch",["The street vendor","street-thug","Sells bad chips from a blanket."]);
  add("vesna-dead-letter",["The smuggler","civilian","Brought the letters out."]);
  add("vesna-karaoke",["The kobun's boss","yakuza-enforcer","Wants his man back."]);
  add("vesna-mattress-money",["The landlord","civilian","Threw the mattress out."]);
  add("vesna-ringside",["The trainer","civilian","Jumpy. The water bottle smells wrong."]);
})();
