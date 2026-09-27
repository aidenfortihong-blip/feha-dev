// FEHA Foundry VTT tabletop UI customization.
// Fictional cyberpunk game interface only.
// This code reads and updates Foundry actor/item/token documents in the current tabletop world.
// It does not access external systems, credentials, devices, or real computer networks.

(() => {
  try { globalThis.FEHA_TABLETOP_UI_V3?.destroy?.(); } catch {}
  globalThis.FEHA_CYBERDECK_V3_ACTIVE = true;
  try { globalThis.ADKDevPatch?.suspendCyberdeckV2?.(); } catch {}
  const VERSION = "0.8.9";
  let lifecycleActive = true;
  const ROOT_ID = "feha-cyberdeck-v2";
  const JACK_ID = "feha-jackin-overlay";
  const FLAG = "fleshEnshrouded";

  const actionLocks = new Set();

  function actionKey(kind,actorId) {
    return String(kind) + ":" + String(actorId ?? "");
  }

  function beginAction(kind,actorId) {
    const key = actionKey(kind,actorId);
    if (actionLocks.has(key)) return null;
    actionLocks.add(key);
    return key;
  }

  function endAction(key) {
    if (key) actionLocks.delete(key);
  }

  function actorActionBusy(actorId) {
    const suffix = ":" + String(actorId ?? "");
    return [...actionLocks].some(key => key.endsWith(suffix));
  }

  const norm = v => String(v ?? "").trim().toLowerCase();
  const esc = v => String(v ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  function flags(item) {
    return item?.flags?.[FLAG] ?? {};
  }

  function description(item) {
    const raw = String(item?.system?.description?.value ?? "");
    const div = document.createElement("div");
    div.innerHTML = raw;
    return String(div.textContent ?? "").replace(/\s+/g," ").trim();
  }

  function isQuickhack(item) {
    if (!item) return false;
    const f = flags(item);
    const category = String(f.sourceCategory ?? f.category ?? "").toLowerCase();
    return (
      category === "quickhacks" ||
      f.quickhack === true ||
      f.ownedQuickhack === true ||
      f.quickhackOwned === true ||
      /\/quickhacks\//i.test(String(f.sourcePath ?? "")) ||
      /category\s*:?\s*quickhacks/i.test(description(item))
    );
  }

  function isInstalledCyberware(item) {
    if (!item) return false;
    const f = flags(item);
    const category = String(f.sourceCategory ?? "").toLowerCase();
    const looksCyberware = category === "cyberware" || Boolean(f.cyberwareSlot);
    if (!looksCyberware || f.installed === false || f.isInstalled === false) return false;

    const containerId =
      item?.system?.container?.id ??
      item?.system?.container ??
      null;

    if (containerId) {
      const parent = item.parent;
      const container = parent?.items?.get?.(containerId) ?? null;
      const cf = flags(container);
      if (
        cf.cyberStorage === true ||
        norm(container?.name) === "cyberware cache"
      ) {
        return false;
      }
    }

    return true;
  }

  function isDeck(item) {
    if (!isInstalledCyberware(item)) return false;
    const n = norm(item.name);
    return (
      flags(item).cyberdeck === true ||
      flags(item).isCyberdeck === true ||
      ["cyberdeck","paraline","netdriver","tetratronic","raven micro"]
        .some(term => n.includes(term))
    );
  }

  function isSupport(item) {
    if (!isInstalledCyberware(item) || isDeck(item)) return false;
    const text = norm(item.name + " " + (flags(item).effectText || description(item)));
    return ["ram","quickhack","cyberdeck","neural","self ice","memory","cortex","netrunner","intrusion"]
      .some(term => text.includes(term));
  }

  function supportRamBonus(item) {
    const f = flags(item);
    const explicit = Number(f.ramBonus);
    if (Number.isFinite(explicit) && explicit) return explicit;
    const n = norm(item?.name);
    if (n.includes("ex disk") || n.includes("ram upgrade")) return 2;
    if (n.includes("neuro matrix")) return 1;
    return 0;
  }

  function hackCost(item) {
    const explicit = Number(flags(item).ramCost);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const match = description(item).match(/\bRAM\s+(\d+)/i);
    return match ? Number(match[1]) : 2;
  }

  function hackEffect(item) {
    const cost = hackCost(item);
    const raw = String(flags(item).effectText || description(item) || "Quickhack software.");
    return raw.replace(/\bRAM\s+\d+\b/i, "RAM " + cost);
  }

  function hackDC(actor) {
    const intMod = Number(actor?.system?.abilities?.int?.mod ?? 0);
    const prof = Number(actor?.system?.attributes?.prof ?? actor?.system?.details?.prof ?? 2);
    return 8 + prof + intMod;
  }

  const ABILITY_KEYS = {
    strength:"str",
    dexterity:"dex",
    constitution:"con",
    intelligence:"int",
    wisdom:"wis",
    charisma:"cha"
  };

  const ABILITY_LABELS = {
    str:"Strength",
    dex:"Dexterity",
    con:"Constitution",
    int:"Intelligence",
    wis:"Wisdom",
    cha:"Charisma"
  };

  function abilityModifier(actor,key) {
    const ability = actor?.system?.abilities?.[key] ?? {};
    const prepared = Number(ability.mod);
    if (Number.isFinite(prepared)) return prepared;

    const score = Number(ability.value);
    return Number.isFinite(score)
      ? Math.floor((score - 10) / 2)
      : 0;
  }

  function actorProficiency(actor) {
    const value = Number(
      actor?.system?.attributes?.prof ??
      actor?.system?.details?.prof ??
      2
    );
    return Number.isFinite(value) ? value : 2;
  }

  function saveModifier(actor,key) {
    const ability = actor?.system?.abilities?.[key] ?? {};

    for (const candidate of [
      ability?.save?.total,
      ability?.save?.value,
      ability?.saveModifier
    ]) {
      const value = Number(candidate);
      if (Number.isFinite(value)) return value;
    }

    const mod = abilityModifier(actor,key);
    const proficiencyScale = Number(ability.proficient ?? 0);
    const prof = actorProficiency(actor) *
      (Number.isFinite(proficiencyScale) ? proficiencyScale : 0);

    const localBonus = Number(ability?.bonuses?.save);
    const globalBonus = Number(actor?.system?.bonuses?.abilities?.save);

    return (
      mod +
      prof +
      (Number.isFinite(localBonus) ? localBonus : 0) +
      (Number.isFinite(globalBonus) ? globalBonus : 0)
    );
  }

  function quickhackRule(item) {
    const text = hackEffect(item);
    const lower = text.toLowerCase();

    const saveMatch = text.match(
      /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+save\b/i
    );

    const saveKey = saveMatch
      ? ABILITY_KEYS[String(saveMatch[1]).toLowerCase()]
      : null;

    const damageMatch = text.match(
      /\b(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*(?:(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\s+)?damage\b/i
    );

    const damageFormula = damageMatch
      ? String(damageMatch[1]).replace(/\s+/g,"")
      : null;

    const damageType = damageMatch?.[2]
      ? String(damageMatch[2]).toLowerCase()
      : "untyped";

    const halfOnSuccess = /half on success/i.test(text);
    const lingeringSave =
      /save\s+ends?\s+(?:the\s+)?lingering/i.test(text) ||
      /save\s+ends?\s+(?:the\s+)?ongoing/i.test(text);

    const saveControlsDamage = Boolean(
      saveKey &&
      damageFormula &&
      !lingeringSave &&
      (
        halfOnSuccess ||
        /save\s*;[^.]*damage/i.test(text) ||
        /save\s+or[^.]*\d+d\d+/i.test(text) ||
        /on\s+(?:a\s+)?failed\s+save[^.]*damage/i.test(text) ||
        /failed\s+save[^.]*damage/i.test(text)
      )
    );

    const conditional =
      /\bif the target\b/i.test(text) ||
      /\bif target\b/i.test(text) ||
      /subject to access/i.test(text) ||
      /cybernetic\/electronic/i.test(text) ||
      /carries an explosive/i.test(text);

    const timedDamage =
      /current and following round/i.test(text) ||
      /following round/i.test(text) ||
      /lingering damage/i.test(text);

    const secondaryTarget =
      /additional networked target/i.test(text) ||
      /creatures within/i.test(text) ||
      /nearby ally/i.test(text);

    return {
      text,
      saveKey,
      saveLabel:saveKey ? ABILITY_LABELS[saveKey] : null,
      damageFormula,
      damageType,
      halfOnSuccess,
      lingeringSave,
      saveControlsDamage,
      conditional,
      timedDamage,
      secondaryTarget
    };
  }

  async function evaluateRoll(formula) {
    const roll = new Roll(String(formula));
    await roll.evaluate();
    return roll;
  }

  async function resolveQuickhack(actor,item,targetToken) {
    const targetActor = targetToken?.actor ?? targetToken?.document?.actor ?? null;
    const m = model(actor);
    const rule = quickhackRule(item);

    const result = {
      operator:actor,
      item,
      targetToken,
      targetActor,
      rule,
      dc:m.dc,
      save:null,
      damage:null,
      appliedDamage:0,
      canApplyDamage:Boolean(
        targetActor &&
        (game.user?.isGM || targetActor.isOwner)
      )
    };

    if (rule.saveKey && targetActor) {
      const modifier = saveModifier(targetActor,rule.saveKey);
      const saveRoll = await evaluateRoll(
        "1d20" + (modifier >= 0 ? "+" : "") + modifier
      );

      const total = Number(saveRoll.total ?? 0);
      result.save = {
        ability:rule.saveKey,
        label:rule.saveLabel,
        modifier,
        total,
        passed:total >= m.dc,
        margin:total - m.dc,
        formula:saveRoll.formula
      };
    }

    if (rule.damageFormula) {
      const damageRoll = await evaluateRoll(rule.damageFormula);
      const raw = Math.max(0,Number(damageRoll.total ?? 0));

      let suggested = raw;

      if (
        result.save?.passed &&
        rule.saveControlsDamage
      ) {
        suggested = rule.halfOnSuccess
          ? Math.floor(raw / 2)
          : 0;
      }

      result.damage = {
        formula:rule.damageFormula,
        type:rule.damageType,
        raw,
        suggested,
        roll:damageRoll
      };
    }

    return result;
  }

  function targetHP(actor) {
    const hp = actor?.system?.attributes?.hp ?? {};
    return {
      value:Math.max(0,Number(hp.value ?? 0)),
      max:Math.max(0,Number(hp.max ?? 0)),
      temp:Math.max(0,Number(hp.temp ?? 0))
    };
  }

  async function applyResolvedDamage(targetActor,amount) {
    const damage = Math.max(0,Math.floor(Number(amount) || 0));
    const before = targetHP(targetActor);

    let remaining = damage;
    let temp = before.temp;
    let value = before.value;

    const tempSpent = Math.min(temp,remaining);
    temp -= tempSpent;
    remaining -= tempSpent;
    value = Math.max(0,value - remaining);

    const update = {
      "system.attributes.hp.value":value
    };

    if (before.temp !== temp) {
      update["system.attributes.hp.temp"] = temp;
    }

    await targetActor.update(update);

    return {
      damage,
      before,
      after:{value,max:before.max,temp}
    };
  }

  function resolutionMarkup(result) {
    const {
      item,
      targetActor,
      targetToken,
      rule,
      save,
      damage,
      dc,
      canApplyDamage
    } = result;

    const targetName =
      targetToken?.name ??
      targetToken?.document?.name ??
      targetActor?.name ??
      "UNKNOWN TARGET";

    const hp = targetHP(targetActor);

    const saveState = !save
      ? (
          rule.saveKey
            ? '<div class="qh-resolve-state is-manual"><small>SAVE</small><b>NO ACTOR DATA</b><span>'+esc(rule.saveLabel)+' save requires manual resolution.</span></div>'
            : '<div class="qh-resolve-state is-auto"><small>DEFENSE</small><b>AUTOMATIC</b><span>No save is specified by this Quickhack.</span></div>'
        )
      : (
          '<div class="qh-resolve-state '+(save.passed?"is-pass":"is-fail")+'">'+
            '<small>'+esc(save.label).toUpperCase()+' SAVE // DC '+dc+'</small>'+
            '<b>'+save.total+' <em>'+(save.passed?"RESISTED":"FAILED")+'</em></b>'+
            '<span>d20 '+(save.modifier>=0?"+":"")+save.modifier+
            ' // margin '+(save.margin>=0?"+":"")+save.margin+'</span>'+
          '</div>'
        );

    const effectLands =
      !save ||
      !save.passed ||
      rule.lingeringSave ||
      (damage && damage.suggested > 0);

    const damageBlock = damage
      ? (
          '<section class="qh-damage-panel">'+
            '<div class="qh-damage-roll">'+
              '<small>DAMAGE ROLL</small>'+
              '<b>'+damage.raw+'</b>'+
              '<span>'+esc(damage.formula)+' '+esc(damage.type).toUpperCase()+'</span>'+
            '</div>'+
            '<div class="qh-damage-apply">'+
              '<small>SUGGESTED APPLICATION</small>'+
              '<div class="qh-damage-input">'+
                '<button type="button" data-qh-action="minus-damage">−</button>'+
                '<input type="number" min="0" step="1" value="'+damage.suggested+'" data-qh-damage>'+
                '<button type="button" data-qh-action="plus-damage">+</button>'+
              '</div>'+
              '<span>HP '+hp.value+(hp.temp?' + '+hp.temp+' TEMP':'')+' / '+hp.max+'</span>'+
              '<button type="button" class="qh-apply-damage" data-qh-action="apply-damage" '+(!canApplyDamage?'disabled':'')+'>'+
                (canApplyDamage?"APPLY DAMAGE":"GM PERMISSION REQUIRED")+
              '</button>'+
            '</div>'+
          '</section>'
        )
      : "";

    const warnings = [
      rule.conditional ? "CONDITIONAL TARGET REQUIREMENT — VERIFY BEFORE APPLYING." : "",
      rule.timedDamage ? "TIMED / LINGERING DAMAGE — USE THE DAMAGE FIELD WHEN THE RULE CALLS FOR IT." : "",
      rule.secondaryTarget ? "SECONDARY / SPLASH TARGETS REQUIRE SEPARATE GM ADJUDICATION." : "",
      rule.lingeringSave && save
        ? (save.passed ? "SAVE ENDS THE LINGERING PORTION." : "SAVE FAILED — LINGERING PORTION CONTINUES.")
        : ""
    ].filter(Boolean);

    return (
      '<section class="qh-resolution" data-qh-item="'+esc(item.id)+'" data-qh-target="'+esc(targetToken?.id ?? targetToken?.document?.id ?? "")+'">'+
        '<div class="qh-resolution-shell">'+
          '<header class="qh-resolution-head">'+
            '<div>'+
              '<small>QUICKHACK RESOLUTION</small>'+
              '<h2>'+esc(item.name)+'</h2>'+
              '<span>TARGET // '+esc(targetName)+'</span>'+
            '</div>'+
            '<button type="button" data-qh-action="close-resolution">×</button>'+
          '</header>'+
          '<div class="qh-resolution-grid">'+
            '<div class="qh-resolution-target">'+
              '<img src="'+esc(targetToken?.texture?.src ?? targetActor?.img ?? "icons/svg/mystery-man.svg")+'" alt="">'+
              '<small>TARGET PROFILE</small>'+
              '<b>'+esc(targetName)+'</b>'+
              '<span>'+(
                rule.saveKey
                  ? esc(rule.saveLabel)+' defense'
                  : 'No defensive save'
              )+'</span>'+
            '</div>'+
            '<div class="qh-resolution-result">'+
              saveState+
              '<div class="qh-effect-state '+(effectLands?"is-landed":"is-resisted")+'">'+
                '<small>QUICKHACK STATE</small>'+
                '<b>'+(effectLands?"EFFECT RESOLVED":"EFFECT RESISTED")+'</b>'+
                '<span>'+esc(rule.text)+'</span>'+
              '</div>'+
            '</div>'+
          '</div>'+
          damageBlock+
          (warnings.length
            ? '<div class="qh-resolution-warnings">'+warnings.map(w => '<span>'+esc(w)+'</span>').join("")+'</div>'
            : '')+
          '<footer class="qh-resolution-foot">'+
            '<span>RAM SPENT // '+hackCost(item)+'</span>'+
            '<button type="button" data-qh-action="close-resolution">'+(damage?"RETURN TO NET":"COMPLETE")+'</button>'+
          '</footer>'+
        '</div>'+
      '</section>'
    );
  }

  function showResolution(root,result) {
    if (!root?.isConnected) return;
    root.querySelector(".qh-resolution")?.remove();
    root.insertAdjacentHTML("beforeend",resolutionMarkup(result));
    root.dataset.resolvingQuickhack = "1";
  }

  function model(actor) {
    const items = [...(actor?.items ?? [])];

    const deckCandidates = items.filter(isDeck);
    const deck =
      deckCandidates.find(item =>
        flags(item).installed === true ||
        flags(item).isInstalled === true
      ) ??
      deckCandidates[0] ??
      null;

    const quickhacks = items.filter(isQuickhack)
      .sort((a,b) => String(a.name).localeCompare(String(b.name)));

    const df = flags(deck);
    const rating = Math.max(1,Math.min(5,Number(df.rating ?? df.tier ?? 2) || 2));
    const baseRam = deck
      ? (Number(df.ramMax) || (4 + 2 * rating))
      : 0;

    const support = items.filter(isSupport);
    const supportRam = support.reduce((sum,item) => sum + supportRamBonus(item),0);
    const maxRam = deck ? baseRam + supportRam : 0;

    const stored = actor?.flags?.[FLAG]?.ramCurrent;
    const currentRam = !deck
      ? 0
      : stored == null
        ? maxRam
        : Math.max(0,Math.min(maxRam,Number(stored) || 0));

    const slots = deck
      ? (Number(df.quickhackSlots) || (2 + rating))
      : 0;

    const loadedAll = quickhacks.filter(item => flags(item).loadedQuickhack === true);
    const loaded = deck ? loadedAll.slice(0,slots) : [];
    const overflow = deck ? loadedAll.slice(slots) : loadedAll;
    const library = quickhacks.filter(item => flags(item).loadedQuickhack !== true);

    return {
      actor,
      deck,
      deckCandidates,
      deckConflict:deckCandidates.length > 1,
      quickhacks,
      loadedAll,
      loaded,
      overflow,
      library,
      support,
      maxRam,
      currentRam,
      slots,
      dc:hackDC(actor),
      manufacturer:String(df.manufacturer ?? df.company ?? "UNKNOWN"),
      mk:String(df.mk ?? df.rating ?? df.tier ?? ""),
      deckEffect: deck ? String(df.effectText || description(deck) || "") : ""
    };
  }

  function roster() {
    const order = new Map([["ponyboy",0],["derke",1],["sasha",2],["zach",3]]);
    const key = actor => norm(actor?.flags?.[FLAG]?.adkCharacter || actor?.name);
    return [...(game.actors ?? [])]
      .filter(actor => order.has(key(actor)) && (game.user?.isGM || actor.isOwner))
      .sort((a,b) => (order.get(key(a)) ?? 99) - (order.get(key(b)) ?? 99));
  }

  function actorById(id) {
    return game.actors?.get?.(id) ?? null;
  }

  function portrait(actor) {
    const k = norm(actor?.flags?.[FLAG]?.adkCharacter || actor?.name);
    const fixed = {
      derke:"https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/1%20Cyberpunk/74981913-bd87-4289-a524-7d987e699cfd.png",
      ponyboy:"https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/-yeah/40e1fb5d-6265-4dfd-93d3-d6344dc14180.png"
    };
    return fixed[k] || actor?.flags?.[FLAG]?.characterChooserPortrait || actor?.img || "icons/svg/mystery-man.svg";
  }

  function readV3PrivateAssets() {
    if (globalThis.FEHA_CP2077_ASSETS?.ui) {
      return globalThis.FEHA_CP2077_ASSETS;
    }

    try {
      const parsed = JSON.parse(
        localStorage.getItem("fehaCP2077PrivateAssetsV1") || "null"
      );
      if (!parsed || typeof parsed !== "object") return null;

      const ok = value =>
        typeof value === "string" &&
        value.startsWith("https://assets.forge-vtt.com/");

      const ui = Object.fromEntries(
        Object.entries(parsed.ui ?? {}).filter(([,value]) => ok(value))
      );
      const audio = Object.fromEntries(
        Object.entries(parsed.audio ?? {}).filter(([,value]) => ok(value))
      );

      if (!Object.keys(ui).length && !Object.keys(audio).length) return null;

      const assets = {ui,audio};
      globalThis.FEHA_CP2077_ASSETS = assets;
      return assets;
    } catch {
      return null;
    }
  }

  function applyV3Assets(root) {
    if (!root) return;
    const ui = readV3PrivateAssets()?.ui ?? {};
    const map = {
      "--v3-frame":"ffe5273fdf_frame_bg",
      "--v3-hud":"6691702ad7_hud_patch_frame",
      "--v3-highlight":"2ae8c588ae_fluff_highlight",
      "--v3-lines":"ef56f53fa5_fluff_lines",
      "--v3-crossline":"d4e7518fde_crossLine",
      "--v3-outerline":"9674e9d0b8_outerLine",
      "--v3-button":"5c8f822dbf_gog_button_holder",
      "--v3-button2":"ac81a43116_gog_button_holder_02",
      "--v3-reward":"a13706adc6_gog_frame_reward",
      "--v3-buffer-empty":"697dae4bde_buffer_empty",
      "--v3-buffer-active":"4416a73d89_buffer_activated",
      "--v3-barcode1":"7c16fcece5_fluff_barcode1",
      "--v3-barcode3":"2bead2d3f6_fluff_barcode3",
      "--v3-code1":"1a0c3eb3ee_fluff_code1",
      "--v3-glow":"59feb7cd32_frame_glow",
      "--v3-glow-small":"8cd8de72f8_frame_glow_small"
    };
    let count = 0;
    for (const [cssName,key] of Object.entries(map)) {
      const url = ui[key];
      if (url) {
        root.style.setProperty(cssName,'url("'+url+'")');
        count++;
      } else {
        root.style.removeProperty(cssName);
      }
    }
    root.dataset.v3Assets = count ? "1" : "0";
  }

  function segments(value,max,count=24) {
    const filled = max > 0 ? Math.round(Math.max(0,Math.min(1,value/max))*count) : 0;
    return '<div class="cd2-segments is-ram">' +
      Array.from({length:count},(_,i) => '<i class="'+(i<filled?"is-filled":"")+'"></i>').join("") +
      '</div>';
  }

  function hackCard(item,loaded) {
    const cost = hackCost(item);
    return [
      '<article class="cd2-hack-card v3-hack-card">',
      '<img src="'+esc(item.img || "icons/svg/item-bag.svg")+'" alt="">',
      '<div class="cd2-hack-copy">',
      '<b>'+esc(item.name)+'</b>',
      '<span>RAM '+cost+' // '+esc(flags(item).ratingLabel ?? ("MK."+String(flags(item).mk ?? flags(item).rating ?? "—")))+'</span>',
      '<small>'+esc(hackEffect(item))+'</small>',
      '</div>',
      '<button type="button" data-v3-action="'+(loaded?"unload":"load")+'" data-item-id="'+esc(item.id)+'">'+(loaded?"EJECT":"LOAD")+'</button>',
      '</article>'
    ].join("");
  }

  function loadedRack(m) {
    if (!m.deck) {
      return '<div class="cd2-no-deck"><small>HARDWARE LINK // OFFLINE</small><b>NO CYBERDECK INSTALLED</b><span>Install a Cyberdeck through Chrome Manager.</span></div>';
    }

    const cards = [];
    for (let i=0;i<m.slots;i++) {
      const item = m.loaded[i];
      if (item) cards.push(hackCard(item,true));
      else cards.push(
        '<div class="cd2-empty-slot" data-slot="'+(i+1)+'">'+
          '<em>SLOT '+String(i+1).padStart(2,"0")+'</em>'+
          '<span>+</span><b>EMPTY SLOT</b><small>ASSIGN FROM SOFTWARE LIBRARY</small>'+
        '</div>'
      );
    }
    return cards.join("");
  }

  function supportCards(m) {
    if (!m.support.length) return '<div class="cd2-empty-message">NO SUPPORT CHROME DETECTED</div>';
    return m.support.map(item =>
      '<article class="cd2-support-card">'+
        '<img src="'+esc(item.img || "icons/svg/item-bag.svg")+'" alt="">'+
        '<div><b>'+esc(item.name)+'</b><span>'+esc(flags(item).ratingLabel ?? "")+'</span><small>'+esc(flags(item).effectText || description(item))+'</small></div>'+
      '</article>'
    ).join("");
  }

  function render(actorId=null) {
    const actors = roster();
    const saved = localStorage.getItem("fehaCyberdeckActorV3");
    const chosen =
      actors.find(actor => actor.id === actorId) ??
      actors.find(actor => actor.id === saved) ??
      actors[0] ??
      null;

    if (!chosen) {
      ui?.notifications?.warn?.("FEHA // No accessible Cyberdeck roster actor available.");
      return null;
    }

    localStorage.setItem("fehaCyberdeckActorV3",chosen.id);
    const m = model(chosen);

    document.getElementById(ROOT_ID)?.remove();
    const root = document.createElement("section");
    root.id = ROOT_ID;
    root.classList.add("feha-v3");
    root.dataset.fehaV3 = "1";
    root.dataset.actor = norm(chosen?.flags?.[FLAG]?.adkCharacter ?? chosen.name);
    root.dataset.actorId = chosen.id;
    applyV3Assets(root);

    root.innerHTML = `
      <header class="cd2-header">
        <div class="cd2-brand">
          <small>NOCTURNE // NETRUNNER LOADOUT</small>
          <h1>CYBERDECK <span>OS</span></h1>
          <div class="cd2-build">FEHA / ADK // ${VERSION}</div>
        </div>
        <div class="cd2-header-status">
          <div><span>RAM</span><b>${m.currentRam}/${m.maxRam}</b></div>
          <div><span>DECK</span><b>${m.deck?"ONLINE":"NONE"}</b></div>
          <div><span>SOFTWARE</span><b>${m.loaded.length}/${m.slots}</b></div>
        </div>
        <div class="cd2-header-actions">
          <select id="v3-actor">
            ${actors.map(a => '<option value="'+esc(a.id)+'" '+(a.id===chosen.id?"selected":"")+'>'+esc(a.name)+'</option>').join("")}
          </select>
          <button type="button" class="cd2-close" data-v3-action="close">×</button>
        </div>
      </header>

      <aside class="cd2-operator">
        <div class="cd2-portrait">
          <img src="${esc(portrait(chosen))}" alt="">
          <div class="cd2-portrait-grid"></div>
          <div class="cd2-operator-tag">OPERATOR // ${esc(chosen.name.toUpperCase())}</div>
        </div>
        <div class="cd2-operator-meta">
          <div><span>SUBJECT</span><b>${esc(chosen.name)}</b></div>
          <div><span>RAM</span><b>${m.currentRam} / ${m.maxRam}</b></div>
          <div><span>QH DC</span><b>${m.deck?m.dc:"—"}</b></div>
        </div>
        <div class="cd2-deck-summary ${m.deck?"":"is-offline"} ${m.deckConflict?"has-conflict":""}">
          <small>INSTALLED CYBERDECK</small>
          ${m.deck ? '<div class="cd2-deck-head"><img src="'+esc(m.deck.img || "icons/svg/cog.svg")+'" alt=""><div><h2>'+esc(m.deck.name)+'</h2><span>'+esc(m.manufacturer)+(m.mk?" // MK."+esc(m.mk):"")+'</span></div></div><div class="cd2-deck-specs"><div><span>RAM</span><b>'+m.maxRam+'</b></div><div><span>SLOTS</span><b>'+m.slots+'</b></div><div><span>QH DC</span><b>'+m.dc+'</b></div></div>' + (m.deckConflict?'<div class="v3-deck-conflict">MULTIPLE INSTALLED CYBERDECKS DETECTED // USING '+esc(m.deck.name)+'</div>':'') : '<div class="cd2-offline-copy">NO HARDWARE LINK</div>'}
        </div>
      </aside>

      <main class="cd2-main v3-main">
        <section class="v3-ram">
          <div>
            <small>ACTIVE MEMORY // SHORT REST ONLY</small>
            <strong>${m.currentRam}<em>/ ${m.maxRam}</em></strong>
            ${segments(m.currentRam,Math.max(1,m.maxRam))}
          </div>
          <button type="button" class="cd2-rest" data-v3-action="rest" ${m.deck?"":"disabled"}>SHORT REST // RESTORE RAM</button>
        </section>

        <div class="v3-scroll">
          <section class="v3-section">
            <div class="cd2-section-head">
              <div><small>DECK MEMORY</small><h3>LOADED QUICKHACKS</h3></div>
              <span>${m.loaded.length} / ${m.slots} SLOTS</span>
            </div>
            <div class="cd2-loaded-grid">${loadedRack(m)}</div>
          </section>

          <section class="v3-section v3-library">
            <div class="cd2-section-head">
              <div><small>OWNED SOFTWARE</small><h3>SOFTWARE LIBRARY</h3></div>
              <span>${m.library.length} AVAILABLE</span>
            </div>
            ${m.overflow.length ? `
              <div class="v3-overflow">
                <div class="v3-overflow-head">OVER CAPACITY // ${m.overflow.length} SOFTWARE PACKAGE${m.overflow.length===1?"":"S"} MUST BE EJECTED</div>
                <div class="cd2-library-list v3-overflow-list">
                  ${m.overflow.map(item => hackCard(item,true)).join("")}
                </div>
              </div>
            ` : ""}
            <div class="cd2-library-list">
              ${m.library.length ? m.library.map(item => hackCard(item,false)).join("") : (m.overflow.length ? "" : '<div class="cd2-empty-message">ALL OWNED QUICKHACKS ARE LOADED</div>')}
            </div>
          </section>
        </div>

      </main>

      <aside class="cd2-right">
        <section class="cd2-bus-panel">
          <div class="cd2-subhead">DECK STATUS</div>
          <div class="cd2-right-stat"><span>RAM</span><b>${m.currentRam}/${m.maxRam}</b></div>
          <div class="cd2-right-stat"><span>LOADED</span><b>${m.loaded.length}</b></div>
          <div class="cd2-right-stat"><span>CAPACITY</span><b>${m.slots||"—"}</b></div>
          <div class="cd2-right-stat"><span>QH DC</span><b>${m.deck?m.dc:"—"}</b></div>
        </section>
        <section>
          <div class="cd2-subhead">SUPPORT CHROME</div>
          <div class="cd2-mini-support">${supportCards(m)}</div>
        </section>
        <section class="cd2-session v3-deck-passive">
          <div class="cd2-subhead">DECK PASSIVE</div>
          <p>${m.deckEffect ? esc(m.deckEffect) : "No additional deck passive detected."}</p>
        </section>
      </aside>

      <footer class="v3-bottom">
        <button type="button" class="v3-jackbar" data-v3-action="jack" ${m.deck?"":"disabled"}>
          <span class="v3-jack-state">${m.deck?"SYSTEM READY":"HARDWARE OFFLINE"}</span>
          <span class="v3-jack-main"><small>NEURAL SCENE SWEEP</small><b>JACK IN</b></span>
          <span class="v3-jack-meta">${m.loaded.length} LOADED // ${m.currentRam} RAM // SCENE SCAN</span>
        </button>
      </footer>
    `;

    document.body.appendChild(root);
    bindBase(root,m);
    return root;
  }

  async function setLoaded(actor,itemId,value) {
    const item = actor?.items?.get?.(itemId);
    if (!item || !isQuickhack(item)) return false;
    const m = model(actor);
    if (value) {
      if (!m.deck) return ui?.notifications?.warn?.("Install a Cyberdeck first.");
      if (m.loaded.length >= m.slots) return ui?.notifications?.warn?.("Cyberdeck software slots are full.");
    }
    await item.update({[`flags.${FLAG}.loadedQuickhack`]:Boolean(value)});
    return true;
  }

  function sceneModel(actor) {
    const scene = canvas?.scene ?? null;
    if (!scene) {
      return {
        scene:null,
        nodes:[],
        relays:[],
        links:[],
        selected:null,
        operator:{x:50,y:50}
      };
    }

    const targeted = new Set(
      [...(game.user?.targets ?? [])]
        .map(t => t?.id ?? t?.document?.id)
        .filter(Boolean)
    );

    const rect =
      scene.dimensions?.sceneRect ??
      canvas?.dimensions?.sceneRect ??
      {x:0,y:0,width:1,height:1};

    const rw = Math.max(1,Number(rect.width)||1);
    const rh = Math.max(1,Number(rect.height)||1);

    const all = [...(scene.tokens?.contents ?? scene.tokens ?? [])]
      .filter(t => {
        if (!(game.user?.isGM || !t.hidden) || !(t.actor || t.actorId)) return false;
        const tokenActor = t.actor ?? game.actors?.get?.(t.actorId) ?? null;
        return tokenActor?.id !== actor?.id;
      });

    const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
    const sparse = all.length <= 2;
    const operator = {x:50,y:sparse ? 53 : 50};

    const rawNodes = all.map((token,index) => {
      const a = token.actor ?? game.actors?.get?.(token.actorId) ?? null;
      const disp = Number(token.disposition ?? 0);
      const relation = disp < 0 ? "hostile" : disp > 0 ? "friendly" : "neutral";
      const rawX = ((Number(token.x??0)-Number(rect.x??0))/rw)*100;
      const rawY = ((Number(token.y??0)-Number(rect.y??0))/rh)*100;

      const count = Math.max(1,all.length);
      const sceneX = clamp(10+rawX*.80,10,90);
      const sceneY = clamp(12+rawY*.62,12,74);

      const orbitalAngle =
        (-Math.PI / 2) +
        ((Math.PI * 2 * index) / count) +
        ((index % 2) ? 0.18 : -0.12);

      const orbitalX = 50 + Math.cos(orbitalAngle) * (count <= 3 ? 32 : 35);
      const orbitalY = 44 + Math.sin(orbitalAngle) * (count <= 3 ? 28 : 30);

      const sceneWeight =
        count <= 2 ? 0.22 :
        count <= 4 ? 0.38 :
        count <= 8 ? 0.58 :
        0.72;

      return {
        id:token.id,
        name:token.name ?? a?.name ?? "UNKNOWN",
        img:token.texture?.src ?? a?.img ?? "icons/svg/mystery-man.svg",
        relation,
        self:false,
        targeted:targeted.has(token.id),
        x:clamp(orbitalX*(1-sceneWeight)+sceneX*sceneWeight,10,90),
        y:clamp(orbitalY*(1-sceneWeight)+sceneY*sceneWeight,12,72),
        index
      };
    });

    const placed = [];

    const separationScore = (x,y) => {
      let min = Infinity;

      const opDx = (x-operator.x)/13;
      const opDy = (y-operator.y)/17;
      min = Math.min(min,Math.hypot(opDx,opDy));

      for (const node of placed) {
        const dx = (x-node.x)/12;
        const dy = (y-node.y)/15;
        min = Math.min(min,Math.hypot(dx,dy));
      }

      return min;
    };

    const candidatesFor = node => {
      const points = [{x:node.x,y:node.y,drift:0}];
      const seed = (node.index * 137.507764) * Math.PI / 180;

      for (let ring=1; ring<=4; ring++) {
        const rx = 6.5 * ring;
        const ry = 8.0 * ring;
        const samples = 10 + ring * 4;

        for (let step=0; step<samples; step++) {
          const angle = seed + (Math.PI*2*step/samples);
          const x = clamp(node.x + Math.cos(angle)*rx,8,92);
          const y = clamp(node.y + Math.sin(angle)*ry,12,72);
          const drift = Math.hypot(x-node.x,y-node.y);
          points.push({x,y,drift});
        }
      }

      const gridX = [8,20,32,44,56,68,80,92];
      const gridY = [12,28,44,60,72];

      for (const x of gridX) {
        for (const y of gridY) {
          const opDx = (x-operator.x)/14;
          const opDy = (y-operator.y)/18;
          if (Math.hypot(opDx,opDy) < 1.05) continue;

          const drift = Math.hypot(x-node.x,y-node.y);
          points.push({x,y,drift});
        }
      }

      return points;
    };

    const nodes = rawNodes.map(node => {
      const candidates = candidatesFor(node);
      let best = candidates[0];
      let bestScore = -Infinity;

      for (const candidate of candidates) {
        const separation = separationScore(candidate.x,candidate.y);
        const score =
          (separation >= 1 ? 1000 : separation * 100) -
          candidate.drift * 1.35;

        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }

      const laidOut = {...node,x:best.x,y:best.y};
      placed.push(laidOut);
      return laidOut;
    });

    // Synthetic infrastructure nodes make JACK IN read as a network topology,
    // not just a line from operator -> token. They are non-interactive.
    const relayBlueprints = [
      {x:50,y:24,label:"GATE-01",kind:"gateway",parent:"operator"},
      {x:27,y:39,label:"RLY-A3",kind:"relay",parent:"relay-0"},
      {x:73,y:39,label:"RLY-B7",kind:"relay",parent:"relay-0"},
      {x:13,y:59,label:"SUB-04",kind:"subnet",parent:"relay-1"},
      {x:87,y:59,label:"SUB-09",kind:"subnet",parent:"relay-2"},
      {x:30,y:78,label:"PORT-12",kind:"edge",parent:"relay-3"},
      {x:70,y:78,label:"PORT-17",kind:"edge",parent:"relay-4"},
      {x:9,y:29,label:"EDGE-03",kind:"edge",parent:"relay-1"},
      {x:91,y:29,label:"EDGE-08",kind:"edge",parent:"relay-2"}
    ];

    const desiredRelayCount =
      nodes.length <= 2 ? 9 :
      nodes.length <= 5 ? 7 :
      nodes.length <= 9 ? 6 :
      5;

    const relays = relayBlueprints
      .slice(0,desiredRelayCount)
      .map((relay,index) => ({
        ...relay,
        id:"relay-"+index,
        index,
        pulse:(index % 5) * 0.28
      }));

    const points = new Map([
      ["operator",{id:"operator",x:operator.x,y:operator.y,kind:"operator"}],
      ...relays.map(relay => [relay.id,relay]),
      ...nodes.map(node => [node.id,node])
    ]);

    const links = [];
    const linkKeys = new Set();

    const canonicalKey = (a,b) =>
      [String(a),String(b)].sort().join("::");

    const addLink = (from,to,kind="ambient",meta={}) => {
      const a = points.get(from);
      const b = points.get(to);
      if (!a || !b) return;

      const key = canonicalKey(from,to);
      if (linkKeys.has(key)) return;
      linkKeys.add(key);

      links.push({
        id:"link-"+links.length,
        from,
        to,
        x1:a.x,
        y1:a.y,
        x2:b.x,
        y2:b.y,
        kind,
        selected:false,
        relation:meta.relation ?? null,
        targetId:meta.targetId ?? null
      });
    };

    // Backbone / branching mesh.
    for (const relay of relays) {
      addLink(relay.parent,relay.id,relay.kind === "gateway" ? "backbone" : "branch");
    }

    const crossLinks = [
      ["relay-1","relay-2"],
      ["relay-3","relay-4"],
      ["relay-1","relay-7"],
      ["relay-2","relay-8"],
      ["relay-3","relay-5"],
      ["relay-4","relay-6"]
    ];

    for (const [a,b] of crossLinks) addLink(a,b,"mesh");

    const relayDistance = (node,relay) =>
      Math.hypot((node.x-relay.x)*1.0,(node.y-relay.y)*1.18);

    const assignments = new Map();

    for (const node of nodes) {
      const ranked = [...relays]
        .sort((a,b) => relayDistance(node,a)-relayDistance(node,b));

      const primary = ranked[0] ?? null;
      const secondary = ranked[1] ?? null;

      if (primary) {
        assignments.set(node.id,primary.id);
        addLink(primary.id,node.id,"endpoint",{
          relation:node.relation,
          targetId:node.id
        });
      }

      if (secondary && nodes.length <= 6) {
        addLink(secondary.id,node.id,"shadow",{
          relation:node.relation,
          targetId:node.id
        });
      }
    }

    const selected = nodes.find(n => n.targeted) ?? null;

    if (selected) {
      const primaryId = assignments.get(selected.id);
      const selectedKeys = new Set();

      let cursor = primaryId;
      while (cursor && cursor !== "operator") {
        const relay = relays.find(r => r.id === cursor);
        if (!relay) break;
        selectedKeys.add(canonicalKey(relay.parent,cursor));
        cursor = relay.parent;
      }

      if (primaryId) {
        selectedKeys.add(canonicalKey(primaryId,selected.id));
      }

      for (const link of links) {
        if (selectedKeys.has(canonicalKey(link.from,link.to))) {
          link.selected = true;
        }
      }
    }

    return {
      scene,
      nodes,
      relays,
      links,
      selected,
      operator
    };
  }

  function codeRain() {
    const bits = ["01","10","0011","1010","1100","0110","010101","111000","001011"];
    return Array.from({length:34},(_,i) => {
      const text = Array.from({length:18},(_,j) => bits[(i+j*3)%bits.length]).join("<br>");
      return '<i style="--jack-col:'+i+'">'+text+'</i>';
    }).join("");
  }

  function jackMarkup(actor) {
    const net = sceneModel(actor);
    const m = model(actor);
    const selected = net.selected;

    const toSvgX = value => Number(value) * 10;
    const toSvgY = value => Number(value) * 7.2;

    const linkSvg = net.links.map((link,index) => {
      const x1 = toSvgX(link.x1).toFixed(1);
      const y1 = toSvgY(link.y1).toFixed(1);
      const x2 = toSvgX(link.x2).toFixed(1);
      const y2 = toSvgY(link.y2).toFixed(1);

      const relation =
        link.relation ? " is-"+link.relation : "";

      const selectedClass =
        link.selected ? " is-selected-route" : "";

      const base =
        '<line class="jack-net-line is-'+link.kind+relation+selectedClass+
        '" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" />';

      const packetCount = link.selected ? 2 : 1;
      const duration =
        link.selected ? 1.65 :
        link.kind === "backbone" ? 2.5 :
        link.kind === "endpoint" ? 2.9 :
        3.7;

      const packets = Array.from({length:packetCount},(_,packetIndex) => {
        const delay = -((index * .23) + (packetIndex * duration/packetCount)).toFixed(2);
        return (
          '<circle class="jack-packet is-'+link.kind+selectedClass+'" r="'+
          (link.selected ? "3.2" : "2.0")+'">'+
            '<animate attributeName="cx" values="'+x1+';'+x2+'" dur="'+duration+
            's" begin="'+delay+'s" repeatCount="indefinite" />'+
            '<animate attributeName="cy" values="'+y1+';'+y2+'" dur="'+duration+
            's" begin="'+delay+'s" repeatCount="indefinite" />'+
            '<animate attributeName="opacity" values="0;.9;.9;0" dur="'+duration+
            's" begin="'+delay+'s" repeatCount="indefinite" />'+
          '</circle>'
        );
      }).join("");

      return base + packets;
    }).join("");

    const relays = net.relays.map(relay =>
      '<div class="jack-relay is-'+relay.kind+'" style="--jack-x:'+relay.x+
      '%;--jack-y:'+relay.y+'%;--relay-delay:'+relay.pulse+'s">'+
        '<span class="jack-relay-core"><i></i></span>'+
        '<small>'+esc(relay.label)+'</small>'+
        '<em>'+(
          relay.kind === "gateway" ? "UPLINK" :
          relay.kind === "subnet" ? "SUBNET" :
          relay.kind === "edge" ? "EDGE" :
          "RELAY"
        )+'</em>'+
      '</div>'
    ).join("");

    const nodes = net.nodes.map((n,i) =>
      '<button class="jack-node is-'+n.relation+(n.targeted?' is-targeted':'')+
      '" style="--jack-x:'+n.x.toFixed(2)+'%;--jack-y:'+n.y.toFixed(2)+
      '%" data-jack-action="target" data-token-id="'+esc(n.id)+'">'+
        '<span class="jack-node-num">'+String(i+1).padStart(2,"0")+'</span>'+
        '<img src="'+esc(n.img)+'" alt="">'+
        '<span class="jack-node-copy"><b>'+esc(n.name)+'</b><small>'+
        n.relation.toUpperCase()+'</small></span>'+
        '<em>'+(n.targeted?'LOCKED':'ACQUIRE')+'</em>'+
      '</button>'
    ).join("");

    const operatorPorts = Array.from({length:8},(_,i) =>
      '<i style="--port:'+i+'"></i>'
    ).join("");

    const hacks = m.loaded.length
      ? m.loaded.map(item => {
          const cost = hackCost(item);
          return '<button class="jack-hack" data-jack-action="run" data-item-id="'+
            esc(item.id)+'" '+(!selected || m.currentRam < cost?'disabled':'')+'>'+
            '<img src="'+esc(item.img || "icons/svg/item-bag.svg")+'" alt="">'+
            '<span><b>'+esc(item.name)+'</b><small>RAM '+cost+' // DC '+m.dc+'</small></span>'+
            '<em><span>EXECUTE</span><b>RUN</b></em>'+
          '</button>';
        }).join("")
      : '<div class="jack-no-hacks">NO QUICKHACKS LOADED</div>';

    return `
      <header class="jack-header">
        <div><small>NOCTURNE // LIVE NEURAL SPACE</small><h1>JACKED <span>IN</span></h1></div>
        <div class="jack-head-stat"><span>SCENE</span><b>${esc(net.scene?.name ?? "NO SCENE")}</b></div>
        <div class="jack-head-stat"><span>RAM</span><b>${m.currentRam} / ${m.maxRam}</b></div>
        <button data-jack-action="close" class="jack-close">×</button>
      </header>

      <main class="jack-space ${net.nodes.length <= 2 ? "is-sparse" : ""}" data-node-count="${net.nodes.length}">
        <svg class="jack-links" viewBox="0 0 1000 720" preserveAspectRatio="none" aria-hidden="true">
          ${linkSvg}
        </svg>

        <div class="jack-net-caption">
          <small>TOPOLOGY</small>
          <b>${net.relays.length} RELAYS // ${net.nodes.length} ENDPOINT${net.nodes.length===1?"":"S"}</b>
        </div>

        ${relays}

        <div class="jack-operator">
          <div></div>
          <div class="jack-operator-hub">${operatorPorts}</div>
          <img src="${esc(portrait(actor))}" alt="">
          <span><small>OPERATOR CORE</small><b>${esc(actor.name)}</b></span>
        </div>

        ${nodes || '<div class="jack-empty-scene"><b>NO ACTOR SIGNATURES</b><span>No actor-backed tokens were found on the active scene.</span></div>'}

        <div class="jack-lock-readout">
          <small>TARGET LOCK</small>
          <b>${selected?esc(selected.name):"NO TARGET"}</b>
          <span>${net.relays.length} RELAYS // ${net.nodes.length + 1} SIGNATURES // OPERATOR INCLUDED</span>
        </div>
      </main>

      <footer class="jack-actions">
        <div class="jack-actions-title">
          <small>LOADED SOFTWARE</small>
          <b>QUICKHACK EXECUTION</b>
          <span>${selected?"TARGET // "+esc(selected.name):"SELECT A TARGET NODE"}</span>
        </div>
        <div class="jack-hacks">${hacks}</div>
      </footer>
    `;
  }

  function renderJack(actorId) {
    const root = document.getElementById(JACK_ID);
    const actor = actorById(actorId);

    if (!root) return;

    if (!actor) {
      root.remove();
      ui?.notifications?.warn?.("Cyberdeck operator is no longer available.");
      open();
      return;
    }
    root.dataset.phase = "live";
    root.dataset.actorId = actor.id;
    root.innerHTML = jackMarkup(actor);
    bindJack(root,actor);
  }

  function openJack(actor) {
    if (!lifecycleActive) return null;

    const live = model(actor);
    if (!live.deck) {
      ui?.notifications?.warn?.("Install a Cyberdeck before JACK IN.");
      return null;
    }

    document.getElementById(JACK_ID)?.remove();
    const root = document.createElement("section");
    root.id = JACK_ID;
    root.dataset.actorId = actor.id;
    root.dataset.phase = "boot";
    applyV3Assets(root);
    root.innerHTML = '<div class="jack-boot"><div class="jack-code-rain">'+codeRain()+'</div><div class="jack-boot-core"><small>NEURAL HANDSHAKE // ACTIVE SCENE SWEEP</small><h1>JACKING IN</h1><b>SCANNING ACTOR SIGNATURES...</b><span>BUILDING TABLETOP SCENE MATRIX</span></div><div class="jack-boot-scan"></div></div>';
    document.body.appendChild(root);
    globalThis.FEHA_SOUNDS?.play?.("scan",{cooldown:0});

    setTimeout(() => {
      if (!root.isConnected) return;
      root.classList.add("is-glitching");
      setTimeout(() => {
        if (!root.isConnected) return;
        renderJack(actor.id);
        root.classList.add("is-live");
        globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0});
      },180);
    },1050);
  }

  function bindBase(root,m) {
    root.onchange = event => {
      if (!event.target?.matches?.("#v3-actor")) return;
      render(String(event.target.value ?? ""));
      globalThis.FEHA_SOUNDS?.play?.("actor_switch",{cooldown:80});
    };

    root.onclick = async event => {
      const button = event.target?.closest?.("[data-v3-action]");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.v3Action;
      const actor = m.actor;

      if (action === "close") {
        root.remove();
        globalThis.FEHA_SOUNDS?.play?.("drawer_close",{cooldown:0});
        return;
      }

      if (action === "load" || action === "unload") {
        const lock = beginAction("software",actor.id);
        if (!lock) return;

        button.dataset.busy = "1";
        button.disabled = true;
        const value = action === "load";

        let changed = false;

        try {
          changed = (await setLoaded(actor,button.dataset.itemId,value)) === true;

          if (changed) {
            globalThis.FEHA_SOUNDS?.play?.(value?"install":"remove",{cooldown:0});
            if (root.isConnected) render(actor.id);
          }
        } catch (err) {
          console.error("FEHA V3 software slot update failed",err);
          ui?.notifications?.error?.("Cyberdeck software update failed.");
        } finally {
          endAction(lock);

          if (!changed && root.isConnected) {
            button.disabled = false;
            delete button.dataset.busy;
          }
        }
        return;
      }

      if (action === "rest") {
        const lock = beginAction("rest",actor.id);
        if (!lock) return;

        const live = model(actor);
        if (!live.deck) {
          endAction(lock);
          return ui?.notifications?.warn?.("No Cyberdeck installed.");
        }

        button.dataset.busy = "1";
        button.disabled = true;

        try {
          globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0});
          await actor.update({
            [`flags.${FLAG}.ramCurrent`]:live.maxRam
          });

          await ChatMessage.create({
            speaker:ChatMessage.getSpeaker({actor}),
            content:
              "<p><strong>"+esc(actor.name)+
              "</strong> completed a Short Rest. RAM restored to <strong>"+
              live.maxRam+"</strong>.</p>"
          });

          if (root.isConnected) render(actor.id);
        } catch (err) {
          console.error("FEHA V3 Short Rest failed",err);
          ui?.notifications?.error?.("Cyberdeck Short Rest failed.");
          if (root.isConnected) {
            button.disabled = false;
            delete button.dataset.busy;
          }
        } finally {
          endAction(lock);
        }
        return;
      }

      if (action === "jack") {
        openJack(actor);
      }
    };
  }

  function bindJack(root,actor) {
    root.onclick = async event => {
      const jackButton = event.target?.closest?.("[data-jack-action]") ?? null;
      const qhButton = event.target?.closest?.("[data-qh-action]") ?? null;

      if (!jackButton && !qhButton) return;
      if (jackButton && !root.contains(jackButton)) return;
      if (qhButton && !root.contains(qhButton)) return;

      if (qhButton) {
        const qhAction = qhButton.dataset.qhAction;

        if (qhAction === "close-resolution") {
          root.querySelector(".qh-resolution")?.remove();
          delete root.dataset.resolvingQuickhack;
          return;
        }

        const input = root.querySelector("[data-qh-damage]");

        if (qhAction === "minus-damage" || qhAction === "plus-damage") {
          if (!input) return;
          const delta = qhAction === "plus-damage" ? 1 : -1;
          input.value = String(Math.max(0,(Number(input.value)||0)+delta));
          return;
        }

        if (qhAction === "apply-damage") {
          if (!input || qhButton.dataset.busy === "1") return;

          const resolution = qhButton.closest(".qh-resolution");
          const tokenId = resolution?.dataset?.qhTarget ?? "";
          const token =
            canvas?.tokens?.get?.(tokenId) ??
            canvas?.tokens?.placeables?.find?.(candidate => candidate.id === tokenId) ??
            null;
          const targetActor = token?.actor ?? token?.document?.actor ?? null;

          if (!targetActor) {
            return ui?.notifications?.warn?.("Resolved target is no longer available.");
          }

          if (!(game.user?.isGM || targetActor.isOwner)) {
            return ui?.notifications?.warn?.("You do not have permission to modify that target's HP.");
          }

          qhButton.dataset.busy = "1";
          qhButton.disabled = true;

          try {
            const result = await applyResolvedDamage(targetActor,input.value);

            qhButton.textContent =
              "APPLIED // "+result.damage+" DAMAGE";

            input.disabled = true;

            await ChatMessage.create({
              speaker:ChatMessage.getSpeaker({actor}),
              content:
                "<p><strong>QUICKHACK DAMAGE APPLIED</strong></p>"+
                "<p>"+esc(targetActor.name)+": "+
                result.before.value+" → <strong>"+result.after.value+"</strong> HP"+
                (result.before.temp ? " (TEMP "+result.before.temp+" → "+result.after.temp+")" : "")+
                "</p>"
            });

            globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0});
          } catch (err) {
            console.error("FEHA V3 damage application failed",err);
            ui?.notifications?.error?.("Could not apply Quickhack damage.");
            qhButton.disabled = false;
            delete qhButton.dataset.busy;
          }

          return;
        }

        return;
      }

      const button = jackButton;
      const action = button?.dataset?.jackAction;

      if (!button || !action) return;

      if (action === "close") {
        root.remove();
        globalThis.FEHA_SOUNDS?.play?.("drawer_close",{cooldown:0});
        render(actor.id);
        return;
      }

      if (action === "target") {
        const token =
          canvas?.tokens?.get?.(button.dataset.tokenId) ??
          canvas?.tokens?.placeables?.find?.(t => t.id === button.dataset.tokenId) ??
          null;
        if (!token) return ui?.notifications?.warn?.("That scene token is no longer available.");
        try {
          await token.setTarget(true,{user:game.user,releaseOthers:true,groupSelection:true});
          globalThis.FEHA_SOUNDS?.play?.("scan",{cooldown:0});
          setTimeout(() => globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0}),90);
        } catch (err) {
          console.warn("FEHA V3 target selection failed",err);
          globalThis.FEHA_SOUNDS?.play?.("error",{cooldown:0});
          ui?.notifications?.warn?.("Could not acquire that scene target.");
          return;
        }
        renderJack(actor.id);
        return;
      }

      if (action === "run") {
        const lock = beginAction("execute",actor.id);
        if (!lock) return;

        const item = actor.items?.get?.(button.dataset.itemId);
        const target = [...(game.user?.targets ?? [])][0] ?? null;
        const targetId = target?.id ?? target?.document?.id ?? null;
        const liveNet = sceneModel(actor);

        if (
          !item ||
          !model(actor).loaded.some(h => h.id === item.id) ||
          !target ||
          !liveNet.nodes.some(node => node.id === targetId)
        ) {
          endAction(lock);
          return ui?.notifications?.warn?.(
            "Select a live scene target and load that Quickhack first."
          );
        }

        const m = model(actor);
        const cost = hackCost(item);

        if (m.currentRam < cost) {
          endAction(lock);
          return ui?.notifications?.warn?.(
            "Not enough RAM. "+m.currentRam+"/"+cost+"."
          );
        }

        root.dataset.executing = "1";
        button.disabled = true;

        try {
          await actor.update({
            [`flags.${FLAG}.ramCurrent`]:m.currentRam-cost
          });

          globalThis.FEHA_SOUNDS?.play?.("scan",{cooldown:0});

          const resolution = await resolveQuickhack(
            actor,
            item,
            target
          );

          await ChatMessage.create({
            speaker:ChatMessage.getSpeaker({actor}),
            content:
              '<div style="display:flex;gap:10px;align-items:center">'+
                '<img src="'+esc(item.img)+'" style="width:54px;height:54px;object-fit:contain">'+
                '<div>'+
                  '<h3>'+esc(item.name)+'</h3>'+
                  '<p><strong>RAM '+cost+'</strong> • DC '+m.dc+
                  ' • TARGET '+esc(target.name ?? target.document?.name ?? "UNKNOWN")+'</p>'+
                  (
                    resolution.save
                      ? '<p>'+esc(resolution.save.label)+' save: <strong>'+
                        resolution.save.total+'</strong> vs DC '+m.dc+
                        ' — '+(resolution.save.passed?'SUCCESS':'FAILURE')+'</p>'
                      : ''
                  )+
                  (
                    resolution.damage
                      ? '<p>Damage roll: <strong>'+resolution.damage.raw+
                        '</strong> '+esc(resolution.damage.type)+
                        ' • suggested '+resolution.damage.suggested+'</p>'
                      : ''
                  )+
                  '<p>'+esc(hackEffect(item))+'</p>'+
                '</div>'+
              '</div>'
          });

          renderJack(actor.id);

          const liveRoot = document.getElementById(JACK_ID);
          if (liveRoot?.isConnected) {
            showResolution(liveRoot,resolution);
          }

          globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0});
        } catch (err) {
          console.error("FEHA V3 Quickhack resolution failed",err);
          ui?.notifications?.error?.("Quickhack resolution failed.");

          if (root.isConnected) {
            delete root.dataset.executing;
            button.disabled = false;
          }
        } finally {
          endAction(lock);
        }
      }
    };
  }

  function open(actorId=null) {
    const actors = roster();
    const saved = localStorage.getItem("fehaCyberdeckActorV3");
    const actor =
      actors.find(candidate => candidate.id === actorId) ??
      actors.find(candidate => candidate.id === saved) ??
      actors[0] ??
      null;

    if (!actor) {
      return ui?.notifications?.warn?.("No accessible Cyberdeck roster actor available.");
    }

    document.getElementById(JACK_ID)?.remove();
    return render(actor.id);
  }

  const v3Hooks = [];
  let refreshQueued = false;

  function queueV3Refresh(mode = "auto") {
    if (refreshQueued) return;
    refreshQueued = true;

    requestAnimationFrame(() => {
      refreshQueued = false;
      if (!lifecycleActive) return;

      const jack = document.getElementById(JACK_ID);
      if (jack?.dataset?.phase === "live") {
        renderJack(jack.dataset.actorId);
        return;
      }

      if (mode === "jack") return;

      const root = document.getElementById(ROOT_ID);
      if (root?.dataset?.fehaV3 === "1") {
        render(root.dataset.actorId);
      }
    });
  }

  function visibleActorId() {
    return (
      document.getElementById(JACK_ID)?.dataset?.actorId ??
      document.getElementById(ROOT_ID)?.dataset?.actorId ??
      null
    );
  }

  if (globalThis.Hooks?.on) {
    v3Hooks.push([
      "updateActor",
      Hooks.on("updateActor", actor => {
        if (
          actor?.id === visibleActorId() &&
          !actorActionBusy(actor.id)
        ) {
          queueV3Refresh("auto");
        }
      })
    ]);

    for (const event of ["createItem","updateItem","deleteItem"]) {
      v3Hooks.push([
        event,
        Hooks.on(event, item => {
          if (
            item?.parent?.id === visibleActorId() &&
            !actorActionBusy(item.parent.id)
          ) {
            queueV3Refresh("auto");
          }
        })
      ]);
    }

    for (const event of ["createActor","deleteActor"]) {
      v3Hooks.push([
        event,
        Hooks.on(event, actor => {
          const root = document.getElementById(ROOT_ID);
          const jack = document.getElementById(JACK_ID);
          const visible = jack?.dataset?.actorId ?? root?.dataset?.actorId ?? null;

          if (event === "deleteActor" && actor?.id === visible) {
            jack?.remove();
            root?.remove();
            open();
            return;
          }

          if (root?.dataset?.fehaV3 === "1") {
            render(root.dataset.actorId);
          }
        })
      ]);
    }

    for (const event of ["createToken","updateToken","deleteToken","targetToken","canvasReady"]) {
      v3Hooks.push([
        event,
        Hooks.on(event, () => {
          if (document.getElementById(JACK_ID)?.dataset?.phase === "live") {
            queueV3Refresh("jack");
          }
        })
      ]);
    }
  }

  const previous = game.adk?.openCyberdeck;
  if (game.adk) {
    // Always capture the opener that exists immediately before THIS V3 install.
    // Reusing a stale value from an earlier hot reload can restore old V2 code.
    game.adk.__fehaV3PreviousOpenCyberdeck = previous;
    game.adk.openCyberdeck = open;
  }

  const reclaimV3 = () => {
    if (!lifecycleActive) return;
    if (game.adk && game.adk.openCyberdeck !== open) {
      game.adk.openCyberdeck = open;
    }
  };

  const existing = document.getElementById(ROOT_ID);
  const existingActorId = existing?.dataset?.actorId ?? null;
  const wasOpen = Boolean(existing);
  existing?.remove();

  const v3Observer = null;

  globalThis.FEHA_TABLETOP_UI_V3 = {
    version:VERSION,
    open,
    render,
    openJack,
    model,
    destroy() {
      lifecycleActive = false;
      actionLocks.clear();
      v3Observer?.disconnect?.();
      for (const [event,id] of v3Hooks) {
        try { Hooks.off(event,id); } catch {}
      }
      document.getElementById(ROOT_ID)?.remove();
      document.getElementById(JACK_ID)?.remove();
      if (game.adk) {
        const prior = game.adk.__fehaV3PreviousOpenCyberdeck;
        if (game.adk.openCyberdeck === open && typeof prior === "function") {
          game.adk.openCyberdeck = prior;
        }
        delete game.adk.__fehaV3PreviousOpenCyberdeck;
      }
      delete globalThis.FEHA_CYBERDECK_V3_ACTIVE;
    }
  };

  if (wasOpen) {
    setTimeout(() => {
      if (lifecycleActive) render(existingActorId);
    },60);
  }

  setTimeout(() => {
    if (lifecycleActive) reclaimV3();
  },120);
  ui?.notifications?.info?.("FEHA Cyberdeck V3 "+VERSION+" ready.");
})();
