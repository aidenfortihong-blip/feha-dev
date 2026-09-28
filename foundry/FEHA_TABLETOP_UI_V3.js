// FEHA Foundry VTT tabletop UI customization.
// Fictional cyberpunk game interface only.
// This code reads and updates Foundry actor/item/token documents in the current tabletop world.
// It does not access external systems, credentials, devices, or real computer networks.

(() => {
  try { globalThis.FEHA_TABLETOP_UI_V3?.destroy?.(); } catch {}
  globalThis.FEHA_CYBERDECK_V3_ACTIVE = true;
  try { globalThis.ADKDevPatch?.suspendCyberdeckV2?.(); } catch {}
  const VERSION = "0.10.76";
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
        die:Number(saveRoll?.dice?.[0]?.total ?? (total - modifier)),
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

  async function commitQuickhackRam(actor,resolution) {
    if (!actor || !resolution) return false;

    if (resolution.dataset.qhRamCommitted === "1") {
      return true;
    }

    const itemId = resolution.dataset.qhItem ?? "";
    const item = actor.items?.get?.(itemId) ?? null;

    if (!item || !isQuickhack(item)) {
      ui?.notifications?.warn?.(
        "Quickhack is no longer available."
      );
      return false;
    }

    const cost = hackCost(item);
    const m = model(actor);

    if (m.currentRam < cost) {
      ui?.notifications?.warn?.(
        "Not enough RAM. "+m.currentRam+"/"+cost+"."
      );
      return false;
    }

    resolution.dataset.qhRamCommitted = "1";

    try {
      await actor.update({
        [`flags.${FLAG}.ramCurrent`]:
          m.currentRam-cost
      });

      const ramLabel =
        resolution.querySelector("[data-qh-ram-state]");

      if (ramLabel) {
        ramLabel.textContent =
          "RAM SPENT // "+cost;
      }

      const next = model(actor);

      const headerRam =
        document.querySelector(
          "#"+JACK_ID+" [data-jack-ram-readout]"
        );

      if (headerRam) {
        headerRam.textContent =
          next.currentRam+" / "+next.maxRam;
      }

      const liveRoot =
        document.getElementById(JACK_ID);

      for (
        const runButton of
        liveRoot?.querySelectorAll?.(
          '.jack-hack[data-jack-action="run"]'
        ) ?? []
      ) {
        const runItem =
          actor.items?.get?.(
            runButton.dataset.itemId
          );

        const runCost =
          runItem ? hackCost(runItem) : Infinity;

        runButton.disabled =
          next.currentRam < runCost;
      }

      return true;
    } catch (err) {
      delete resolution.dataset.qhRamCommitted;
      console.error(
        "FEHA V3 RAM commit failed",
        err
      );
      ui?.notifications?.error?.(
        "Could not spend Quickhack RAM."
      );
      return false;
    }
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
            '<span>'+save.die+' '+(save.modifier>=0?"+ ":"− ")+Math.abs(save.modifier)+
            ' = '+save.total+' // margin '+(save.margin>=0?"+":"")+save.margin+'</span>'+
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
              '<span data-qh-hp>HP '+hp.value+(hp.temp?' + '+hp.temp+' TEMP':'')+' / '+hp.max+'</span>'+
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
            '<button type="button" data-qh-action="return-net">×</button>'+
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
            '<span data-qh-ram-state>RAM COST // '+hackCost(item)+'</span>'+
            '<div class="qh-resolution-actions">'+
              (!damage
                ? '<button type="button" class="qh-apply-effect" data-qh-action="apply-effect">APPLY EFFECT</button>'
                : '')+
              '<button type="button" data-qh-action="return-net">RETURN TO NET</button>'+
              '<button type="button" class="is-danger" data-qh-action="close-cyberdeck">CLOSE CYBERDECK</button>'+
            '</div>'+
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
        <section class="cd2-bus-panel cd2-net-telemetry ${m.deck ? "is-online" : "is-offline"}">
          <div class="cd2-net-head">
            <div>
              <div class="cd2-subhead">NETWORK TELEMETRY</div>
              <small>NEURAL BUS // LIVE ROUTING</small>
            </div>
            <b>${m.deck ? "LINK ONLINE" : "LINK OFFLINE"}</b>
          </div>

          <div class="cd2-net-stage" aria-label="Cyberdeck network telemetry">
            <svg class="cd2-net-svg" viewBox="0 0 320 176" preserveAspectRatio="none" aria-hidden="true">
              <path class="cd2-net-path is-a" d="M38 88 C82 88 86 42 138 42" />
              <path class="cd2-net-path is-b" d="M138 42 C190 42 190 88 230 88" />
              <path class="cd2-net-path is-c" d="M138 42 C182 42 170 136 230 136" />

              <circle class="cd2-net-node is-operator" cx="38" cy="88" r="8" />
              <circle class="cd2-net-node is-deck" cx="138" cy="42" r="9" />
              <circle class="cd2-net-node is-software" cx="230" cy="88" r="8" />
              <circle class="cd2-net-node is-scene" cx="230" cy="136" r="8" />

              <circle class="cd2-net-packet is-p1" r="3">
                <animateMotion dur="5.2s" calcMode="linear" repeatCount="indefinite"
                  path="M38 88 C82 88 86 42 138 42" />
              </circle>
              <circle class="cd2-net-packet is-p2" r="3">
                <animateMotion dur="6.0s" begin="-2.4s" calcMode="linear" repeatCount="indefinite"
                  path="M138 42 C190 42 190 88 230 88" />
              </circle>
              <circle class="cd2-net-packet is-p3" r="3">
                <animateMotion dur="6.8s" begin="-3.7s" calcMode="linear" repeatCount="indefinite"
                  path="M138 42 C182 42 170 136 230 136" />
              </circle>
            </svg>

            <span class="cd2-net-label is-operator">OPERATOR</span>
            <span class="cd2-net-label is-deck">DECK</span>
            <span class="cd2-net-label is-software">SOFTWARE</span>
            <span class="cd2-net-label is-scene">SCENE LINK</span>

            <i class="cd2-net-scanline"></i>
          </div>
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

  function cyberModule(name) {
    return (
      globalThis.FEHA_CYBER_CORE?.module?.(name) ??
      game?.adk?.cyberdeck?.module?.(name) ??
      null
    );
  }

  function sceneNetworkDevices(scene) {
    try {
      return cyberModule("devices")?.scanScene?.(scene) ?? [];
    } catch (err) {
      console.warn("FEHA V3 // Network Device scan failed",err);
      return [];
    }
  }

  function sceneCameras(scene) {
    try {
      return cyberModule("cameras")?.scanScene?.(scene) ?? [];
    } catch (err) {
      console.warn("FEHA V3 // Camera scan failed",err);
      return [];
    }
  }

  function sceneModel(actor) {
    const scene = canvas?.scene ?? null;

    if (!scene) {
      return {
        scene:null,
        backgroundSrc:"",
        nodes:[],
        devices:[],
        cameras:[],
        relays:[],
        links:[],
        selected:null,
        operator:{x:50,y:50,tokenId:null}
      };
    }

    const targeted = new Set(
      [...(game.user?.targets ?? [])]
        .map(token => token?.id ?? token?.document?.id)
        .filter(Boolean)
    );

    const rect =
      scene.dimensions?.sceneRect ??
      canvas?.dimensions?.sceneRect ??
      {x:0,y:0,width:1,height:1};

    const rw = Math.max(1,Number(rect.width)||1);
    const rh = Math.max(1,Number(rect.height)||1);
    const gridSize = Math.max(
      1,
      Number(
        scene?.grid?.size ??
        canvas?.grid?.size ??
        canvas?.dimensions?.size ??
        100
      ) || 100
    );

    const cameraService = cyberModule("cameras");

    const allSceneTokens =
      [...(scene.tokens?.contents ?? scene.tokens ?? [])]
        .filter(token =>
          (game.user?.isGM || !token.hidden) &&
          (token.actor || token.actorId) &&
          !cameraService?.isCameraToken?.(token)
        );

    const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

    const centerOf = token => {
      const placeable =
        canvas?.tokens?.get?.(token.id) ??
        canvas?.tokens?.placeables?.find?.(candidate => candidate.id === token.id) ??
        null;

      const center = placeable?.center;

      if (
        Number.isFinite(Number(center?.x)) &&
        Number.isFinite(Number(center?.y))
      ) {
        return {
          x:Number(center.x),
          y:Number(center.y)
        };
      }

      return {
        x:
          Number(token.x ?? 0) +
          (Number(token.width ?? 1) * gridSize / 2),
        y:
          Number(token.y ?? 0) +
          (Number(token.height ?? 1) * gridSize / 2)
      };
    };

    const percentOf = token => {
      const center = centerOf(token);

      return {
        x:clamp(
          ((center.x - Number(rect.x ?? 0)) / rw) * 100,
          1.5,
          98.5
        ),
        y:clamp(
          ((center.y - Number(rect.y ?? 0)) / rh) * 100,
          1.5,
          98.5
        )
      };
    };

    const controlledOperator =
      canvas?.tokens?.controlled?.find?.(
        token => token?.actor?.id === actor?.id
      )?.document ??
      null;

    const operatorToken =
      controlledOperator ??
      allSceneTokens.find(token => {
        const tokenActor =
          token.actor ??
          game.actors?.get?.(token.actorId) ??
          null;
        return tokenActor?.id === actor?.id;
      }) ??
      null;

    const operatorPos = operatorToken
      ? percentOf(operatorToken)
      : {x:50,y:52};

    const operatorPlaceable =
      operatorToken
        ? (
            canvas?.tokens?.get?.(operatorToken.id) ??
            canvas?.tokens?.placeables?.find?.(
              candidate => candidate.id === operatorToken.id
            ) ??
            null
          )
        : null;

    const operatorPixelWidth = operatorToken
      ? Math.max(
          1,
          Number(operatorPlaceable?.w) ||
          Number(operatorToken.width ?? 1)*gridSize
        )
      : gridSize;

    const operatorPixelHeight = operatorToken
      ? Math.max(
          1,
          Number(operatorPlaceable?.h) ||
          Number(operatorToken.height ?? 1)*gridSize
        )
      : gridSize;

    const operator = {
      x:operatorPos.x,
      y:operatorPos.y,
      tokenId:operatorToken?.id ?? null,
      tokenWidthPct:(operatorPixelWidth/rw)*100,
      tokenHeightPct:(operatorPixelHeight/rh)*100
    };

    const endpointTokens = allSceneTokens.filter(token => {
      const tokenActor =
        token.actor ??
        game.actors?.get?.(token.actorId) ??
        null;

      // The operator's chosen scene token is represented by the operator core.
      return token.id !== operatorToken?.id && tokenActor?.id !== actor?.id;
    });

    // Count duplicated Actor documents before assigning visible endpoint labels.
    const actorCounts = new Map();

    for (const token of endpointTokens) {
      const tokenActor =
        token.actor ??
        game.actors?.get?.(token.actorId) ??
        null;

      const key =
        tokenActor?.id ??
        token.actorId ??
        token.name ??
        token.id;

      actorCounts.set(key,(actorCounts.get(key) ?? 0) + 1);
    }

    const actorSeen = new Map();

    const nodes = endpointTokens.map((token,index) => {
      const tokenActor =
        token.actor ??
        game.actors?.get?.(token.actorId) ??
        null;

      const actorKey =
        tokenActor?.id ??
        token.actorId ??
        token.name ??
        token.id;

      const duplicateCount = actorCounts.get(actorKey) ?? 1;
      const ordinal = (actorSeen.get(actorKey) ?? 0) + 1;
      actorSeen.set(actorKey,ordinal);

      const baseName =
        token.name ??
        tokenActor?.name ??
        "UNKNOWN";

      const displayName =
        duplicateCount > 1
          ? baseName+" // "+String(ordinal).padStart(2,"0")
          : baseName;

      const disp = Number(token.disposition ?? 0);
      const relation =
        disp < 0 ? "hostile" :
        disp > 0 ? "friendly" :
        "neutral";

      const pos = percentOf(token);

      const placeable =
        canvas?.tokens?.get?.(token.id) ??
        canvas?.tokens?.placeables?.find?.(
          candidate => candidate.id === token.id
        ) ??
        null;

      const tokenPixelWidth = Math.max(
        1,
        Number(placeable?.w) ||
        Number(token.width ?? 1)*gridSize
      );

      const tokenPixelHeight = Math.max(
        1,
        Number(placeable?.h) ||
        Number(token.height ?? 1)*gridSize
      );

      const tokenWidthPct =
        (tokenPixelWidth/rw)*100;

      const tokenHeightPct =
        (tokenPixelHeight/rh)*100;

      return {
        id:token.id,
        actorId:tokenActor?.id ?? token.actorId ?? null,
        name:baseName,
        displayName,
        signature:
          duplicateCount > 1
            ? "TOKEN "+String(ordinal).padStart(2,"0")+
              " / "+String(duplicateCount).padStart(2,"0")
            : "TOKEN "+String(index+1).padStart(2,"0"),
        img:
          tokenActor
            ? portrait(tokenActor)
            : (
                token.texture?.src ??
                "icons/svg/mystery-man.svg"
              ),
        relation,
        self:false,
        targeted:targeted.has(token.id),
        x:pos.x,
        y:pos.y,
        tokenWidthPct,
        tokenHeightPct,
        index
      };
    });

    const selected =
      nodes.find(node => node.targeted) ??
      null;

    const centroid =
      nodes.length
        ? {
            x:nodes.reduce((sum,node) => sum+node.x,0)/nodes.length,
            y:nodes.reduce((sum,node) => sum+node.y,0)/nodes.length
          }
        : {x:50,y:26};

    const relays = [];
    const links = [];

    const points = new Map([
      ["operator",{
        id:"operator",
        x:operator.x,
        y:operator.y,
        kind:"operator"
      }]
    ]);

    const addRelay = relay => {
      relays.push(relay);
      points.set(relay.id,relay);
      return relay;
    };

    const gatewayVector = {
      x:centroid.x-operator.x,
      y:centroid.y-operator.y
    };

    const gatewayLength = Math.max(
      1,
      Math.hypot(
        gatewayVector.x,
        gatewayVector.y
      )
    );

    const gatewayTravel = Math.max(
      11,
      Math.min(18,gatewayLength*.44)
    );

    const gateway = addRelay({
      id:"relay-gateway",
      kind:"gateway",
      label:"SCENE GATE",
      x:clamp(
        operator.x +
        (gatewayVector.x/gatewayLength)*gatewayTravel,
        7,
        93
      ),
      y:clamp(
        operator.y +
        (gatewayVector.y/gatewayLength)*gatewayTravel,
        8,
        92
      ),
      pulse:0
    });

    for (const node of nodes) {
      points.set(node.id,node);

      const dx = node.x-operator.x;
      const dy = node.y-operator.y;
      const length = Math.max(1,Math.hypot(dx,dy));
      const perpendicular = {
        x:-dy/length,
        y:dx/length
      };

      const side = node.index % 2 ? 1 : -1;
      const offset = Math.min(5.5,2.4 + length*.035) * side;

      const relay = addRelay({
        id:"relay-endpoint-"+node.index,
        kind:"relay",
        label:"RLY-"+String(node.index+1).padStart(2,"0"),
        x:clamp(
          operator.x + dx*.74 + perpendicular.x*offset,
          5,
          95
        ),
        y:clamp(
          operator.y + dy*.74 + perpendicular.y*offset,
          6,
          94
        ),
        pulse:(node.index%5)*.24,
        targetId:node.id
      });

      links.push({
        id:"link-gateway-"+node.index,
        from:gateway.id,
        to:relay.id,
        x1:gateway.x,
        y1:gateway.y,
        x2:relay.x,
        y2:relay.y,
        kind:"branch",
        selected:Boolean(node.targeted),
        relation:node.relation,
        targetId:node.id
      });

      links.push({
        id:"link-endpoint-"+node.index,
        from:relay.id,
        to:node.id,
        x1:relay.x,
        y1:relay.y,
        x2:node.x,
        y2:node.y,
        kind:"endpoint",
        selected:Boolean(node.targeted),
        relation:node.relation,
        targetId:node.id
      });
    }

    links.unshift({
      id:"link-operator-gateway",
      from:"operator",
      to:gateway.id,
      x1:operator.x,
      y1:operator.y,
      x2:gateway.x,
      y2:gateway.y,
      kind:"backbone",
      selected:Boolean(selected),
      relation:null,
      targetId:selected?.id ?? null
    });

    // Cross-connect branch relays so multi-target scenes still read as one net.
    for (let i=1;i<relays.length-1;i++) {
      const a = relays[i];
      const b = relays[i+1];

      links.push({
        id:"link-mesh-"+i,
        from:a.id,
        to:b.id,
        x1:a.x,
        y1:a.y,
        x2:b.x,
        y2:b.y,
        kind:"mesh",
        selected:false,
        relation:null,
        targetId:null
      });
    }

    const cameraNodes = sceneCameras(scene)
      .map((camera,index) => ({
        ...camera,
        index,
        x:Number(camera.xPct),
        y:Number(camera.yPct)
      }))
      .filter(camera =>
        Number.isFinite(camera.x) &&
        Number.isFinite(camera.y)
      );

    const networkDevices = sceneNetworkDevices(scene)
      .map((device,index) => ({
        ...device,
        index,
        x:Number(device.xPct),
        y:Number(device.yPct)
      }))
      .filter(device =>
        Number.isFinite(device.x) &&
        Number.isFinite(device.y)
      );

    // Devices join the same topology graph but keep their exact scene
    // coordinates. They never need to know how JACK IN renders them.
    for (const device of networkDevices) {
      const relay = relays.length
        ? [...relays].sort((a,b) => {
            const da = Math.hypot(device.x-a.x,device.y-a.y);
            const db = Math.hypot(device.x-b.x,device.y-b.y);
            return da-db;
          })[0]
        : gateway;

      if (!relay) continue;

      links.push({
        id:"link-device-"+device.id,
        from:relay.id,
        to:"device:"+device.id,
        x1:relay.x,
        y1:relay.y,
        x2:device.x,
        y2:device.y,
        kind:"device",
        selected:false,
        relation:"device",
        targetId:null,
        deviceId:device.id
      });
    }

    const backgroundSrc =
      String(
        scene?.background?.src ??
        scene?.img ??
        ""
      ).trim();

    return {
      scene,
      backgroundSrc,
      nodes,
      devices:networkDevices,
      cameras:cameraNodes,
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

  function jackViewportState(root) {
    const number = (key,fallback) => {
      const value = Number(root?.dataset?.[key]);
      return Number.isFinite(value) ? value : fallback;
    };

    return {
      zoom:number("jackZoom",1),
      panX:number("jackPanX",0),
      panY:number("jackPanY",0)
    };
  }

  function clampJackViewport(root,state) {
    const space = root?.querySelector?.(".jack-space");
    if (!space) return state;

    const width = Math.max(1,space.clientWidth);
    const height = Math.max(1,space.clientHeight);
    const zoom = Math.max(1,Math.min(3,Number(state.zoom)||1));

    let panX = Number(state.panX)||0;
    let panY = Number(state.panY)||0;

    // Always leave real overscan around the transformed world so RMB pan works
    // even at 100% or when zoomed out. This intentionally permits some empty
    // margin at the edges; the map should feel like a movable tabletop.
    const padX = Math.max(260,width*.22);
    const padY = Math.max(180,height*.24);

    const scaledWidth = width*zoom;
    const scaledHeight = height*zoom;

    const centeredX = (width-scaledWidth)/2;
    const centeredY = (height-scaledHeight)/2;

    let minX;
    let maxX;
    let minY;
    let maxY;

    if (scaledWidth <= width) {
      minX = centeredX-padX;
      maxX = centeredX+padX;
    } else {
      minX = width-scaledWidth-padX;
      maxX = padX;
    }

    if (scaledHeight <= height) {
      minY = centeredY-padY;
      maxY = centeredY+padY;
    } else {
      minY = height-scaledHeight-padY;
      maxY = padY;
    }

    panX = Math.max(minX,Math.min(maxX,panX));
    panY = Math.max(minY,Math.min(maxY,panY));

    if (zoom === 1) {
      panX = Math.round(panX);
      panY = Math.round(panY);
    }

    return {zoom,panX,panY};
  }

  function syncJackOperatorTokenSize(root) {
    const world = root?.querySelector?.(".jack-world");
    const operator = world?.querySelector?.(".jack-operator");
    if (!world || !operator) return;

    const widthPct =
      Math.max(
        0,
        Number(operator.dataset.tokenWidthPct) || 0
      );

    const heightPct =
      Math.max(
        0,
        Number(operator.dataset.tokenHeightPct) || 0
      );

    const tokenWorldWidth =
      world.clientWidth*(widthPct/100);

    const tokenWorldHeight =
      world.clientHeight*(heightPct/100);

    const tokenWorldSize = Math.max(
      32,
      Math.round(
        Math.max(
          tokenWorldWidth,
          tokenWorldHeight
        )
      )
    );

    operator.style.setProperty(
      "--jack-operator-size",
      tokenWorldSize+"px"
    );
  }

  function syncJackActorConstantSize(root) {
    const world = root?.querySelector?.(".jack-world");
    if (!world) return;

    const worldWidth = Math.max(1,world.clientWidth);
    const worldHeight = Math.max(1,world.clientHeight);

    for (
      const node of
      world.querySelectorAll(".jack-node[data-token-id]")
    ) {
      const widthPct =
        Math.max(0,Number(node.dataset.tokenWidthPct)||0);

      const heightPct =
        Math.max(0,Number(node.dataset.tokenHeightPct)||0);

      const tokenWidth =
        worldWidth*(widthPct/100);

      const tokenHeight =
        worldHeight*(heightPct/100);

      // Square node uses the larger token dimension so the portrait fully
      // covers the token footprint without becoming smaller than it.
      const size = Math.max(
        32,
        Math.round(Math.max(tokenWidth,tokenHeight))
      );

      node.style.setProperty(
        "--jack-node-size",
        size+"px"
      );
    }
  }

  function syncJackRouteScale(root,state) {
    const zoom = Math.max(
      1,
      Number(state?.zoom) || 1
    );

    for (
      const packet of
      root?.querySelectorAll?.(".jack-packet") ?? []
    ) {
      const baseRadius =
        packet.classList.contains("is-selected-route")
          ? 3.2
          : 2.0;

      packet.setAttribute(
        "r",
        (baseRadius/zoom).toFixed(3)
      );
    }

    for (
      const line of
      root?.querySelectorAll?.(".jack-net-line") ?? []
    ) {
      let dash = [8,8];

      if (line.classList.contains("is-selected-route")) {
        dash = [13,5];
      } else if (line.classList.contains("is-backbone")) {
        dash = [10,8];
      } else if (line.classList.contains("is-branch")) {
        dash = [7,10];
      } else if (line.classList.contains("is-mesh")) {
        dash = [3,12];
      } else if (line.classList.contains("is-shadow")) {
        dash = [2,11];
      } else if (line.classList.contains("is-device")) {
        dash = [4,8];
      }

      line.style.setProperty(
        "stroke-dasharray",
        (dash[0]/zoom).toFixed(3)+" "+
        (dash[1]/zoom).toFixed(3),
        "important"
      );
    }
  }

  function setJackViewport(root,next) {
    if (!root?.isConnected) return;

    const state = clampJackViewport(
      root,
      {
        ...jackViewportState(root),
        ...(next ?? {})
      }
    );

    root.dataset.jackZoom = String(state.zoom);
    root.dataset.jackPanX = String(state.panX);
    root.dataset.jackPanY = String(state.panY);

    const world = root.querySelector(".jack-world");
    if (world) {
      world.style.setProperty("--jack-zoom",String(state.zoom));
      const zoom = Math.max(1,state.zoom);

      // Pure visual compensation only. These values MUST NOT alter topology
      // coordinates or collision placement.
      //
      // Because the entire world already scales by zoom, a factor below 1/zoom
      // makes semantic UI shrink slightly as the user zooms deeper.
      const precision = Math.max(
        .90,
        1-(zoom-1)*.05
      );

      // Relays are screen-space HUD markers. Their coordinates still
      // follow the zoomed world, but their box/text size stays constant.
      const relayReadability = 1;

      world.style.setProperty(
        "--jack-card-scale",
        String(precision/zoom)
      );

      world.style.setProperty(
        "--jack-camera-scale",
        String(1/zoom)
      );

      // Actor nodes are constant screen-size. Their world coordinates still
      // move with zoom/pan, but the square itself never grows or shrinks.
      world.style.setProperty(
        "--jack-actor-scale",
        String(1/zoom)
      );

      world.style.setProperty(
        "--jack-relay-scale",
        String(relayReadability/zoom)
      );

      // Wielder/operator core:
      // normal size at 100% zoom, growing smoothly to 1.5x at max zoom.
      const operatorScreenScale =
        1 + ((zoom-1) / 2) * .5;

      world.style.setProperty(
        "--jack-operator-scale",
        String(operatorScreenScale/zoom)
      );

      world.style.setProperty(
        "--jack-anchor-scale",
        String(1/zoom)
      );

      world.style.setProperty(
        "--jack-ui-scale",
        String(precision/zoom)
      );
      world.style.setProperty("--jack-pan-x",state.panX+"px");
      world.style.setProperty("--jack-pan-y",state.panY+"px");
    }

    const readout = root.querySelector("[data-jack-zoom-readout]");
    if (readout) {
      readout.textContent = Math.round(state.zoom*100)+"%";
    }

    syncJackOperatorTokenSize(root);
    syncJackActorConstantSize(root);
    syncJackRouteScale(root,state);

    return state;
  }

  function zoomJackAt(root,nextZoom,clientX=null,clientY=null) {
    const space = root?.querySelector?.(".jack-space");
    if (!space) return;

    const rect = space.getBoundingClientRect();
    const current = jackViewportState(root);
    const zoom = Math.max(1,Math.min(3,Number(nextZoom)||1));

    const focusX =
      clientX == null
        ? rect.width/2
        : Number(clientX)-rect.left;

    const focusY =
      clientY == null
        ? rect.height/2
        : Number(clientY)-rect.top;

    const worldX = (focusX-current.panX)/current.zoom;
    const worldY = (focusY-current.panY)/current.zoom;

    setJackViewport(root,{
      zoom,
      panX:focusX-worldX*zoom,
      panY:focusY-worldY*zoom
    });
  }

  function resetJackViewport(root) {
    setJackViewport(root,{zoom:1,panX:0,panY:0});
  }

  function fitJackViewport(root) {
    const space = root?.querySelector?.(".jack-space");
    if (!space) return;

    const width = Math.max(1,space.clientWidth);
    const height = Math.max(1,space.clientHeight);

    const points = [
      ...space.querySelectorAll("[data-jack-anchor-x][data-jack-anchor-y]")
    ]
      .map(element => ({
        x:Number(element.dataset.jackAnchorX),
        y:Number(element.dataset.jackAnchorY)
      }))
      .filter(point =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y)
      )
      .map(point => ({
        x:(point.x/100)*width,
        y:(point.y/100)*height
      }));

    if (!points.length) {
      resetJackViewport(root);
      return;
    }

    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    const maxY = Math.max(...points.map(point => point.y));

    const centerX = (minX+maxX)/2;
    const centerY = (minY+maxY)/2;

    // FIT is now a native-resolution framing operation. The old behavior
    // downscaled the entire UI subtree, softening portraits and typography.
    setJackViewport(root,{
      zoom:1,
      panX:Math.round(width/2-centerX),
      panY:Math.round(height/2-centerY)
    });
  }

  function jackWorldPercentAt(
    root,
    clientX,
    clientY
  ) {
    const space = root?.querySelector?.(".jack-space");
    const world = root?.querySelector?.(".jack-world");

    if (!space || !world) return null;

    const rect = space.getBoundingClientRect();
    const state = jackViewportState(root);
    const zoom = Math.max(1,Number(state.zoom)||1);

    const worldX =
      (Number(clientX)-rect.left-state.panX)/zoom;

    const worldY =
      (Number(clientY)-rect.top-state.panY)/zoom;

    const clamp = (n,min,max) =>
      Math.max(min,Math.min(max,n));

    return {
      xPct:clamp(
        (worldX/Math.max(1,world.clientWidth))*100,
        0,
        100
      ),
      yPct:clamp(
        (worldY/Math.max(1,world.clientHeight))*100,
        0,
        100
      )
    };
  }

  function setJackCameraGhost(
    root,
    position
  ) {
    const world =
      root?.querySelector?.(".jack-world");

    if (!world || !position) return null;

    let ghost =
      world.querySelector(".jack-camera-ghost");

    if (!ghost) {
      ghost = document.createElement("div");
      ghost.className = "jack-camera-ghost";
      ghost.innerHTML =
        '<i class="fa-solid fa-video"></i>'+
        '<span>PLACE</span>';

      world.appendChild(ghost);
    }

    ghost.style.setProperty(
      "--jack-x",
      Number(position.xPct).toFixed(3)+"%"
    );

    ghost.style.setProperty(
      "--jack-y",
      Number(position.yPct).toFixed(3)+"%"
    );

    ghost.dataset.xPct =
      Number(position.xPct).toFixed(6);

    ghost.dataset.yPct =
      Number(position.yPct).toFixed(6);

    return ghost;
  }

  function cancelJackCameraPlacement(
    root,
    {silent=false}={}
  ) {
    if (!root) return;

    delete root.dataset.cameraPlacement;

    root.querySelector(
      ".jack-camera-ghost"
    )?.remove();

    root.querySelector(
      '[data-jack-action="camera-place"]'
    )?.classList.remove("is-active");

    if (!silent) {
      globalThis.FEHA_SOUNDS?.play?.(
        "drawer_close",
        {cooldown:0}
      );
    }
  }

  async function beginJackCameraPlacement(
    root,
    actor
  ) {
    const cameras = cyberModule("cameras");
    const world =
      root?.querySelector?.(".jack-world");

    if (!cameras || !world || !canvas?.scene) {
      ui?.notifications?.warn?.(
        "Camera placement is not available."
      );
      return;
    }

    if (root.dataset.cameraPlacement === "1") {
      cancelJackCameraPlacement(root);
      return;
    }

    const button =
      root.querySelector(
        '[data-jack-action="camera-place"]'
      );

    if (button?.dataset.busy === "1") return;

    if (button) {
      button.dataset.busy = "1";
      button.disabled = true;
    }

    try {
      await cameras.ensureCameraActor(
        actor.id,
        game.user?.id
      );

      root.dataset.cameraPlacement = "1";
      button?.classList.add("is-active");

      const operator =
        root.querySelector(".jack-operator");

      setJackCameraGhost(
        root,
        {
          xPct:Number(
            operator?.dataset.jackAnchorX ?? 50
          ),
          yPct:Number(
            operator?.dataset.jackAnchorY ?? 50
          )
        }
      );

      ui?.notifications?.info?.(
        "CAMERA READY // move over JACK IN and click to deploy"
      );

      globalThis.FEHA_SOUNDS?.play?.(
        "scan",
        {cooldown:0}
      );
    } catch (err) {
      console.error(
        "FEHA V3 camera preparation failed",
        err
      );

      ui?.notifications?.error?.(
        err?.message ??
        "Could not prepare Camera placement."
      );
    } finally {
      if (button) {
        button.disabled = false;
        delete button.dataset.busy;
      }
    }
  }

  function appendJackCameraNode(
    root,
    camera
  ) {
    const world =
      root?.querySelector?.(".jack-world");

    if (!world || !camera?.tokenId) return;

    const existing =
      [...world.querySelectorAll(
        ".jack-camera-node[data-camera-token-id]"
      )].find(
        node =>
          node.dataset.cameraTokenId ===
          String(camera.tokenId)
      );

    const node =
      existing ??
      document.createElement("div");

    node.className = "jack-camera-node";
    node.dataset.cameraTokenId =
      String(camera.tokenId);

    node.style.setProperty(
      "--jack-x",
      Number(camera.xPct).toFixed(3)+"%"
    );

    node.style.setProperty(
      "--jack-y",
      Number(camera.yPct).toFixed(3)+"%"
    );

    node.innerHTML =
      '<i class="fa-solid fa-video"></i>'+
      '<small>CAM</small>';

    if (!existing) {
      world.appendChild(node);
    }
  }

  function rectOverlapArea(a,b) {
    const width = Math.max(
      0,
      Math.min(a.right,b.right)-Math.max(a.left,b.left)
    );

    const height = Math.max(
      0,
      Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)
    );

    return width*height;
  }

  function layoutJackEndpointCards(root) {
    const space = root?.querySelector?.(".jack-space");
    const world = root?.querySelector?.(".jack-world");
    if (!space || !world) return;

    const width = Math.max(1,world.clientWidth);
    const height = Math.max(1,world.clientHeight);

    const cards = [
      ...world.querySelectorAll(
        ".jack-node[data-token-id], .jack-device-node[data-device-id]"
      )
    ];

    if (!cards.length) return;

    const operator = world.querySelector(".jack-operator");

    const operatorAnchor = operator
      ? {
          x:(Number(operator.dataset.jackAnchorX)||50)/100*width,
          y:(Number(operator.dataset.jackAnchorY)||50)/100*height
        }
      : {x:width/2,y:height/2};

    const operatorWidth = operator?.offsetWidth ?? 176;
    const operatorHeight = operator?.offsetHeight ?? 176;

    const protectedRects = [
      {
        left:operatorAnchor.x-operatorWidth*.62,
        right:operatorAnchor.x+operatorWidth*.62,
        top:operatorAnchor.y-operatorHeight*.62,
        bottom:operatorAnchor.y+operatorHeight*.62,
        weight:5
      }
    ];

    // Small route boxes can be covered if necessary, but prefer not to.
    for (const relay of world.querySelectorAll(".jack-relay")) {
      const x=(Number(relay.dataset.jackAnchorX)||0)/100*width;
      const y=(Number(relay.dataset.jackAnchorY)||0)/100*height;
      const rw=Math.max(20,relay.offsetWidth);
      const rh=Math.max(20,relay.offsetHeight);

      protectedRects.push({
        left:x-rw*.58,
        right:x+rw*.58,
        top:y-rh*.60,
        bottom:y+rh*.60,
        weight:.08
      });
    }

    const placed = [];
    const leaders = new Map(
      [...world.querySelectorAll("[data-card-leader]")]
        .map(line => [line.dataset.cardLeader,line])
    );

    const ordered = [...cards].sort((a,b) => {
      const selectedA = a.classList.contains("is-targeted") ? 1 : 0;
      const selectedB = b.classList.contains("is-targeted") ? 1 : 0;
      if (selectedA !== selectedB) return selectedB-selectedA;
      return Number(a.dataset.nodeIndex||0)-Number(b.dataset.nodeIndex||0);
    });

    for (const card of ordered) {
      const anchorX =
        (Number(card.dataset.jackAnchorX)||50)/100*width;

      const anchorY =
        (Number(card.dataset.jackAnchorY)||50)/100*height;

      const cardWidth = Math.max(180,card.offsetWidth);
      const cardHeight = Math.max(90,card.offsetHeight);

      // ACTOR TOPOLOGY RULE:
      // A real scene Token owns its endpoint coordinates. Never let the
      // collision solver move an actor card away from that Token.
      if (card.matches(".jack-node[data-token-id]")) {
        card.style.setProperty(
          "--jack-card-x",
          anchorX+"px"
        );

        card.style.setProperty(
          "--jack-card-y",
          anchorY+"px"
        );

        const halfW = cardWidth/2;
        const halfH = cardHeight/2;

        const cardId = card.dataset.tokenId ?? "";

        placed.push({
          id:cardId,
          rect:{
            left:anchorX-halfW-7,
            right:anchorX+halfW+7,
            top:anchorY-halfH-6,
            bottom:anchorY+halfH+6
          },
          x:anchorX,
          y:anchorY
        });

        const leader = leaders.get(cardId);

        if (leader) {
          const sx=((anchorX/width)*1000).toFixed(2);
          const sy=((anchorY/height)*720).toFixed(2);

          leader.setAttribute("x1",sx);
          leader.setAttribute("y1",sy);
          leader.setAttribute("x2",sx);
          leader.setAttribute("y2",sy);
          leader.classList.remove("is-displaced");
        }

        continue;
      }

      const halfW = cardWidth/2;
      const halfH = cardHeight/2;
      const margin = 20;

      const outwardAngle = Math.atan2(
        anchorY-operatorAnchor.y,
        anchorX-operatorAnchor.x
      );

      const seed =
        Number(card.dataset.nodeIndex||0)*0.83;

      const candidates = [{
        x:anchorX,
        y:anchorY,
        distance:0
      }];

      const rings = [64,96,132,168];

      for (const radius of rings) {
        const samples = 16;

        for (let step=0;step<samples;step++) {
          const angle =
            outwardAngle +
            seed +
            (Math.PI*2*step/samples);

          candidates.push({
            x:anchorX+Math.cos(angle)*radius,
            y:anchorY+Math.sin(angle)*radius,
            distance:radius
          });
        }
      }

      let best = null;
      let bestScore = Infinity;

      for (const candidate of candidates) {
        const x = Math.max(
          margin+halfW,
          Math.min(width-margin-halfW,candidate.x)
        );

        const y = Math.max(
          margin+halfH,
          Math.min(height-margin-halfH,candidate.y)
        );

        const rect = {
          left:x-halfW-7,
          right:x+halfW+7,
          top:y-halfH-6,
          bottom:y+halfH+6
        };

        let score = candidate.distance*2.4;

        for (const other of placed) {
          const overlap = rectOverlapArea(rect,other.rect);
          if (overlap) score += overlap*1.55+9000;
        }

        for (const protectedRect of protectedRects) {
          const overlap = rectOverlapArea(rect,protectedRect);
          if (overlap) {
            score += overlap*(protectedRect.weight??1)+
              8200*(protectedRect.weight??1);
          }
        }

        // Prefer cards outside the operator's immediate core when their
        // anchors are stacked directly onto the operator.
        const opDistance = Math.hypot(
          x-operatorAnchor.x,
          y-operatorAnchor.y
        );

        if (opDistance < Math.max(108,operatorWidth*.58)) {
          score +=
            (Math.max(108,operatorWidth*.58)-opDistance)*90;
        }

        if (score < bestScore) {
          bestScore = score;
          best = {x,y,rect};
        }
      }

      if (!best) continue;

      card.style.setProperty("--jack-card-x",best.x+"px");
      card.style.setProperty("--jack-card-y",best.y+"px");

      const cardId =
        card.dataset.tokenId ??
        (card.dataset.deviceId
          ? "device:"+card.dataset.deviceId
          : "");

      placed.push({
        id:cardId,
        rect:best.rect,
        x:best.x,
        y:best.y
      });

      const leader = leaders.get(cardId);

      if (leader) {
        leader.setAttribute(
          "x1",
          ((anchorX/width)*1000).toFixed(2)
        );

        leader.setAttribute(
          "y1",
          ((anchorY/height)*720).toFixed(2)
        );

        leader.setAttribute(
          "x2",
          ((best.x/width)*1000).toFixed(2)
        );

        leader.setAttribute(
          "y2",
          ((best.y/height)*720).toFixed(2)
        );

        const moved = Math.hypot(
          best.x-anchorX,
          best.y-anchorY
        );

        leader.classList.toggle("is-displaced",moved>18);
      }
    }
  }

  function bindJackViewport(root) {
    const space = root?.querySelector?.(".jack-space");
    if (!space) return;

    root.__jackResizeObserver?.disconnect?.();

    const refresh = () => {
      if (!root.isConnected) return;
      layoutJackEndpointCards(root);
      setJackViewport(root,jackViewportState(root));
    };

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            requestAnimationFrame(refresh);
          })
        : null;

    resizeObserver?.observe?.(space);
    root.__jackResizeObserver = resizeObserver;

    root.onwheel = event => {
      if (!space.contains(event.target)) return;
      if (event.target?.closest?.(".qh-resolution")) return;

      event.preventDefault();

      const current = jackViewportState(root);
      const factor = event.deltaY < 0 ? 1.12 : .89;

      zoomJackAt(
        root,
        current.zoom*factor,
        event.clientX,
        event.clientY
      );
    };

    space.oncontextmenu = event => {
      if (
        event.target?.closest?.(
          "input,select,textarea"
        )
      ) {
        return;
      }

      event.preventDefault();
    };

    // JACK IN NAVIGATION: RMB only.
    space.onpointerdown = event => {
      if (event.button !== 2) return;

      if (root.dataset.cameraPlacement === "1") {
        event.preventDefault();
        cancelJackCameraPlacement(root);
        return;
      }

      if (
        event.target?.closest?.(
          "input,select,textarea,.qh-resolution,.jack-viewport-controls,.jack-lock-readout,.jack-net-caption,.jack-device-panel"
        )
      ) {
        return;
      }

      event.preventDefault();

      const current = jackViewportState(root);

      root.__jackDrag = {
        pointerId:event.pointerId,
        button:2,
        startX:event.clientX,
        startY:event.clientY,
        panX:current.panX,
        panY:current.panY
      };

      space.classList.add("is-panning");

      try {
        space.setPointerCapture?.(event.pointerId);
      } catch {}
    };

    root.onpointermove = event => {
      if (
        root.dataset.cameraPlacement === "1" &&
        space.contains(event.target)
      ) {
        const position =
          jackWorldPercentAt(
            root,
            event.clientX,
            event.clientY
          );

        if (position) {
          setJackCameraGhost(
            root,
            position
          );
        }
      }

      const drag = root.__jackDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;

      setJackViewport(root,{
        panX:drag.panX+(event.clientX-drag.startX),
        panY:drag.panY+(event.clientY-drag.startY)
      });
    };

    const endDrag = event => {
      const drag = root.__jackDrag;
      if (!drag) return;

      if (
        event?.pointerId != null &&
        drag.pointerId !== event.pointerId
      ) {
        return;
      }

      delete root.__jackDrag;
      space.classList.remove("is-panning");

      try {
        space.releasePointerCapture?.(drag.pointerId);
      } catch {}
    };

    root.onpointerup = endDrag;
    root.onpointercancel = endDrag;
    root.onlostpointercapture = endDrag;

    space.addEventListener(
      "click",
      async event => {
        if (root.dataset.cameraPlacement !== "1") {
          return;
        }

        if (
          event.target?.closest?.(
            ".jack-viewport-controls,.jack-lock-readout,.jack-net-caption,.jack-node,.jack-operator,.jack-device-node,.jack-camera-node"
          )
        ) {
          return;
        }

        const position =
          jackWorldPercentAt(
            root,
            event.clientX,
            event.clientY
          );

        if (!position) return;

        event.preventDefault();
        event.stopPropagation();

        const ghost =
          setJackCameraGhost(
            root,
            position
          );

        ghost?.classList.add(
          "is-deploying"
        );

        root.dataset.cameraPlacement =
          "deploying";

        try {
          const cameras =
            cyberModule("cameras");

          const camera =
            await cameras?.placeCamera?.({
              operatorActorId:root.dataset.actorId,
              userId:game.user?.id,
              sceneId:canvas?.scene?.id,
              xPct:position.xPct,
              yPct:position.yPct
            });

          if (!camera) {
            throw new Error(
              "Camera placement returned no token."
            );
          }

          appendJackCameraNode(
            root,
            camera
          );

          cancelJackCameraPlacement(
            root,
            {silent:true}
          );

          globalThis.FEHA_SOUNDS?.play?.(
            "confirm",
            {cooldown:0}
          );

          ui?.notifications?.info?.(
            "CAMERA DEPLOYED // Foundry token placed"
          );
        } catch (err) {
          console.error(
            "FEHA V3 camera placement failed",
            err
          );

          root.dataset.cameraPlacement =
            "1";

          ghost?.classList.remove(
            "is-deploying"
          );

          ui?.notifications?.error?.(
            err?.message ??
            "Could not place Camera."
          );
        }
      }
    );

    requestAnimationFrame(refresh);
  }

  function jackMarkup(actor) {
    const net = sceneModel(actor);
    const m = model(actor);
    const selected = net.selected;

    // 0.10.26 visual topology simplification:
    // keep relay/link data in sceneModel for later, but render none of it now.
    const linkSvg = "";
    const relays = "";

    const traces = net.nodes.map(node =>
      '<line class="jack-trace-line is-'+node.relation+
      (node.targeted?' is-selected-route':'')+
      '" data-link-target="'+esc(node.id)+
      '" x1="'+(net.operator.x*10).toFixed(2)+
      '" y1="'+(net.operator.y*7.2).toFixed(2)+
      '" x2="'+(node.x*10).toFixed(2)+
      '" y2="'+(node.y*7.2).toFixed(2)+
      '" vector-effect="non-scaling-stroke" />'
    ).join("");

    const cameraNodes = (net.cameras ?? []).map(camera =>
      '<div class="jack-camera-node"'+
      ' style="--jack-x:'+Number(camera.x).toFixed(3)+
      '%;--jack-y:'+Number(camera.y).toFixed(3)+'%"'+
      ' data-camera-token-id="'+esc(camera.tokenId)+'">'+
        '<i class="fa-solid fa-video"></i>'+
        '<small>CAM</small>'+
      '</div>'
    ).join("");

    const nodes = net.nodes.map((n,i) =>
      '<button class="jack-node is-'+n.relation+(n.targeted?' is-targeted':'')+
      '" style="--jack-x:'+n.x.toFixed(2)+'%;--jack-y:'+n.y.toFixed(2)+
      '%" data-jack-action="target" data-token-id="'+esc(n.id)+
      '" data-node-index="'+i+
      '" data-token-width-pct="'+Number(n.tokenWidthPct||0).toFixed(6)+
      '" data-token-height-pct="'+Number(n.tokenHeightPct||0).toFixed(6)+
      '" data-jack-anchor-x="'+n.x.toFixed(4)+
      '" data-jack-anchor-y="'+n.y.toFixed(4)+'">'+
        '<img src="'+esc(n.img)+'" alt="'+esc(n.displayName)+'">'+
        (n.targeted?'<em>LOCKED</em>':'')+
      '</button>'
    ).join("");

    const deviceActionService = cyberModule("deviceActions");

    const deviceNodes = (net.devices ?? []).map((device,deviceIndex) => {
      const access = deviceActionService?.hasAccess?.(actor,device) ?? false;
      const state = access ? "ACCESS" : "DC "+device.securityDC;

      return (
        '<button class="jack-device-node is-'+esc(device.type)+
        (access?' has-access':'')+
        '" style="--jack-x:'+Number(device.x).toFixed(2)+
        '%;--jack-y:'+Number(device.y).toFixed(2)+
        '%" data-jack-action="device" data-device-id="'+esc(device.id)+
        '" data-jack-anchor-x="'+Number(device.x).toFixed(4)+
        '" data-jack-anchor-y="'+Number(device.y).toFixed(4)+'">'+
          '<i class="'+esc(device.icon || "fa-solid fa-microchip")+'"></i>'+
          '<span><b>'+esc(device.name)+'</b><small>'+
            esc(device.typeLabel)+' // '+
            esc(device.accessScopeLabel ?? "ENDPOINT")+
            ' // '+esc(state)+
          '</small></span>'+
        '</button>'
      );
    }).join("");

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
        <div class="jack-head-stat" data-jack-ram-stat><span>RAM</span><b data-jack-ram-readout>${m.currentRam} / ${m.maxRam}</b></div>
        <div class="jack-head-actions">
          <button type="button" data-jack-action="return-deck">RETURN TO DECK</button>
          <button type="button" data-jack-action="close-cyberdeck" class="is-danger">CLOSE CYBERDECK</button>
        </div>
      </header>

      <main class="jack-space ${net.nodes.length <= 2 ? "is-sparse" : ""} ${net.backgroundSrc ? "has-scene-map" : ""}" data-node-count="${net.nodes.length}" data-map="${net.backgroundSrc ? "1" : "0"}">
        <div class="jack-world">
          ${net.backgroundSrc
            ? '<div class="jack-scene-map"><img draggable="false" src="'+esc(net.backgroundSrc)+'" alt=""></div>'
            : ''
          }




          <svg class="jack-traces"
            viewBox="0 0 1000 720"
            preserveAspectRatio="none"
            aria-hidden="true">
            ${traces}
          </svg>

          <div class="jack-operator"
            style="--jack-x:${net.operator.x.toFixed(2)}%;--jack-y:${net.operator.y.toFixed(2)}%"
            data-jack-anchor-x="${net.operator.x.toFixed(4)}"
            data-jack-anchor-y="${net.operator.y.toFixed(4)}"
            data-token-width-pct="${Number(net.operator.tokenWidthPct||0).toFixed(6)}"
            data-token-height-pct="${Number(net.operator.tokenHeightPct||0).toFixed(6)}">
            <div></div>
            <div class="jack-operator-hub">${operatorPorts}</div>
            <img src="${esc(portrait(actor))}" alt="">
            <span><small>OPERATOR CORE</small><b>${esc(actor.name)}</b></span>
          </div>

          ${nodes || '<div class="jack-empty-scene"><b>NO ACTOR SIGNATURES</b><span>No actor-backed tokens were found on the active scene.</span></div>'}
          ${cameraNodes}
          ${deviceNodes}
        </div>

        <div class="jack-viewport-controls">
          <button type="button" data-jack-action="zoom-out" title="Zoom out">−</button>
          <b data-jack-zoom-readout>100%</b>
          <button type="button" data-jack-action="zoom-in" title="Zoom in">+</button>
          <button type="button" data-jack-action="fit-view">FIT</button>
          <button type="button" data-jack-action="reset-view">RESET</button>
        </div>

        <div class="jack-net-caption">
          <small>DIRECT TRACE // WHEEL = ZOOM // RMB DRAG = PAN</small>
          <b>${net.nodes.length} ACTORS // ${net.devices.length} DEVICES // ${net.cameras.length} CAMERAS</b>
        </div>

        <div class="jack-lock-readout${selected?" has-target is-"+selected.relation:""}">
          <img class="jack-lock-portrait"
            src="${selected?esc(selected.img):""}"
            alt=""
            ${selected?"":"hidden"}>
          <div class="jack-lock-copy">
            <small>TARGET LOCK</small>
            <b>${selected?esc(selected.displayName):"NO TARGET"}</b>
            <span>${selected?"LOCKED":"SELECT ACTOR"}</span>
          </div>
        </div>
      </main>

      <footer class="jack-actions">
        <div class="jack-actions-title">
          <small>LOADED SOFTWARE</small>
          <b>QUICKHACK EXECUTION</b>
          <span>${selected?"TARGET // "+esc(selected.displayName):"SELECT A TARGET NODE"}</span>
        </div>
        <div class="jack-hacks">${hacks}</div>
      </footer>
    `;
  }

  function liveNetworkDevice(id) {
    const scene = canvas?.scene;
    if (!scene) return null;

    return sceneNetworkDevices(scene)
      .find(device => device.id === id) ??
      null;
  }

  function devicePanelMarkup(actor,device,status=null) {
    const deviceService = cyberModule("devices");
    const actionService = cyberModule("deviceActions");
    const hasAccess = actionService?.hasAccess?.(actor,device) ?? false;

    const capabilityButtons = (device.capabilities ?? [])
      .map(capability => {
        const def = deviceService?.capabilities?.[capability] ?? {
          label:capability
        };

        return (
          '<button type="button" data-device-action="capability" '+
          'data-capability="'+esc(capability)+'" '+
          (hasAccess ? "" : "disabled")+
          '>'+esc(def.label)+'</button>'
        );
      })
      .join("");

    const result = status
      ? (
          '<div class="jack-device-result '+esc(status.kind ?? "")+'">'+
            '<b>'+esc(status.title ?? "NETWORK RESULT")+'</b>'+
            '<span>'+esc(status.body ?? "")+'</span>'+
          '</div>'
        )
      : "";

    return (
      '<section class="jack-device-panel" data-device-id="'+esc(device.id)+'">'+
        '<header>'+
          '<div><small>NETWORK DEVICE</small><h3>'+esc(device.name)+'</h3>'+
          '<span>'+esc(device.typeLabel)+' // '+
          esc(device.accessScopeLabel ?? "ENDPOINT")+
          ' // '+esc(device.origin.toUpperCase())+'</span></div>'+
          '<button type="button" data-device-action="close">×</button>'+
        '</header>'+
        '<div class="jack-device-security">'+
          '<div><small>SECURITY</small><b>DC '+device.securityDC+'</b><span>'+esc(device.securityLabel)+'</span></div>'+
          '<div><small>SCOPE</small><b>'+esc(device.accessScopeLabel ?? "ENDPOINT")+'</b><span>CONTROL BREADTH</span></div>'+
          '<div><small>ACCESS</small><b>'+(hasAccess?"GRANTED":"LOCKED")+'</b><span>'+
            (hasAccess?"SESSION AUTHORIZED":"BREACH REQUIRED")+
          '</span></div>'+
        '</div>'+
        (!hasAccess
          ? '<button type="button" class="jack-device-breach" data-device-action="breach">BREACH // DC '+device.securityDC+'</button>'
          : ''
        )+
        '<div class="jack-device-capabilities">'+
          '<small>CAPABILITIES</small>'+
          '<div>'+capabilityButtons+'</div>'+
        '</div>'+
        result+
      '</section>'
    );
  }

  function showDevicePanel(root,actor,device,status=null) {
    root.querySelector(".jack-device-panel")?.remove();
    root.insertAdjacentHTML(
      "beforeend",
      devicePanelMarkup(actor,device,status)
    );
  }

  function updateJackTargetUI(root,actor) {
    if (!root?.isConnected || !actor) return;

    const net = sceneModel(actor);
    const m = model(actor);
    const selected = net.selected ?? null;
    const selectedId = selected?.id ?? "";

    for (const node of root.querySelectorAll(".jack-node[data-token-id]")) {
      if (node.dataset.jackStableSize !== "1") {
        node.style.setProperty(
          "width",
          Math.round(node.offsetWidth)+"px",
          "important"
        );

        node.style.setProperty(
          "min-height",
          Math.round(node.offsetHeight)+"px",
          "important"
        );

        node.dataset.jackStableSize = "1";
      }

      const active = node.dataset.tokenId === selectedId;
      node.classList.toggle("is-targeted",active);
      node.setAttribute("aria-pressed",active ? "true" : "false");

      let state = node.querySelector(":scope > em");

      if (active) {
        if (!state) {
          state = document.createElement("em");
          node.appendChild(state);
        }
        state.textContent = "LOCKED";
      } else {
        state?.remove();
      }
    }

    for (const anchor of root.querySelectorAll(".jack-token-anchor[data-token-id]")) {
      anchor.classList.toggle(
        "is-targeted",
        anchor.dataset.tokenId === selectedId
      );
    }

    for (const leader of root.querySelectorAll("[data-card-leader]")) {
      const leaderId = String(leader.dataset.cardLeader ?? "");
      leader.classList.toggle(
        "is-targeted",
        Boolean(selectedId) && leaderId === selectedId
      );
    }

    for (const route of root.querySelectorAll("[data-link-target]")) {
      const routeId = String(route.dataset.linkTarget ?? "");
      route.classList.toggle(
        "is-selected-route",
        Boolean(selectedId) && routeId === selectedId
      );
    }

    const lockPanel = root.querySelector(".jack-lock-readout");
    const lockPortrait = lockPanel?.querySelector(".jack-lock-portrait");
    const lockName = lockPanel?.querySelector(".jack-lock-copy > b");
    const lockState = lockPanel?.querySelector(".jack-lock-copy > span");

    if (lockPanel) {
      lockPanel.classList.toggle("has-target",Boolean(selected));
      lockPanel.classList.remove(
        "is-hostile",
        "is-friendly",
        "is-neutral"
      );

      if (selected?.relation) {
        lockPanel.classList.add("is-"+selected.relation);
      }
    }

    if (lockPortrait) {
      if (selected?.img) {
        lockPortrait.src = selected.img;
        lockPortrait.alt = selected.displayName ?? "";
        lockPortrait.hidden = false;
      } else {
        lockPortrait.removeAttribute("src");
        lockPortrait.alt = "";
        lockPortrait.hidden = true;
      }
    }

    if (lockName) {
      lockName.textContent =
        selected?.displayName ?? "NO TARGET";
    }

    if (lockState) {
      lockState.textContent =
        selected ? "LOCKED" : "SELECT ACTOR";
    }

    const actionTarget = root.querySelector(".jack-actions-title > span");
    if (actionTarget) {
      actionTarget.textContent = selected
        ? "TARGET // "+selected.displayName
        : "SELECT A TARGET NODE";
    }

    for (const button of root.querySelectorAll('.jack-hack[data-jack-action="run"]')) {
      const item = actor.items?.get?.(button.dataset.itemId);
      const cost = item ? hackCost(item) : Infinity;
      button.disabled = !selected || m.currentRam < cost;
    }

    syncJackRouteScale(
      root,
      jackViewportState(root)
    );
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
    bindJackViewport(root);
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
      const deviceButton = event.target?.closest?.("[data-device-action]") ?? null;

      if (!jackButton && !qhButton && !deviceButton) return;
      if (jackButton && !root.contains(jackButton)) return;
      if (qhButton && !root.contains(qhButton)) return;
      if (deviceButton && !root.contains(deviceButton)) return;

      if (deviceButton) {
        const deviceAction = deviceButton.dataset.deviceAction;
        const panel = deviceButton.closest(".jack-device-panel");
        const deviceId = panel?.dataset?.deviceId ?? "";
        const device = liveNetworkDevice(deviceId);
        const actionService = cyberModule("deviceActions");
        const deviceService = cyberModule("devices");

        if (deviceAction === "close") {
          panel?.remove();
          globalThis.FEHA_SOUNDS?.play?.("drawer_close",{cooldown:0});
          return;
        }

        if (!device || !actionService) {
          ui?.notifications?.warn?.("Network Device is no longer available.");
          panel?.remove();
          return;
        }

        if (deviceAction === "breach") {
          if (deviceButton.dataset.busy === "1") return;
          globalThis.FEHA_SOUNDS?.play?.("scan",{cooldown:80});
          deviceButton.dataset.busy = "1";
          deviceButton.disabled = true;

          try {
            const result = await actionService.breach(actor,device);

            const math = result.automatic
              ? "UNSECURED DEVICE // ACCESS AUTOMATIC"
              : result.cached
                ? "SESSION ACCESS ALREADY ESTABLISHED"
                : (
                    result.die+" "+
                    (result.modifier >= 0 ? "+ " : "− ")+
                    Math.abs(result.modifier)+
                    " = "+result.total+
                    " // DC "+result.dc
                  );

            showDevicePanel(
              root,
              actor,
              liveNetworkDevice(device.id) ?? device,
              {
                kind:result.passed ? "is-success" : "is-failure",
                title:result.passed ? "BREACH ACCEPTED" : "BREACH REJECTED",
                body:math
              }
            );

            globalThis.FEHA_SOUNDS?.play?.(
              result.passed ? "confirm" : "error",
              {cooldown:0}
            );

            await ChatMessage.create({
              speaker:ChatMessage.getSpeaker({actor}),
              content:
                "<p><strong>NETWORK BREACH // "+esc(device.name)+"</strong></p>"+
                "<p>"+esc(math)+" — <strong>"+
                (result.passed ? "SUCCESS" : "FAILURE")+
                "</strong></p>"
            });
          } catch (err) {
            console.error("FEHA V3 Network breach failed",err);
            ui?.notifications?.error?.("Network breach failed.");
            deviceButton.disabled = false;
            delete deviceButton.dataset.busy;
          }

          return;
        }

        if (deviceAction === "capability") {
          const capability = String(deviceButton.dataset.capability ?? "");
          if (!capability) return;
          if (deviceButton.dataset.busy === "1") return;

          globalThis.FEHA_SOUNDS?.play?.("subsystem_select",{cooldown:80});
          deviceButton.dataset.busy = "1";
          deviceButton.disabled = true;

          try {
            const result = await actionService.executeCapability(
              actor,
              device,
              capability,
              {root}
            );

            const capabilityLabel =
              deviceService?.capabilities?.[capability]?.label ??
              capability;

            if (result?.denied) {
              const access = result.access ?? {};
              showDevicePanel(
                root,
                actor,
                device,
                {
                  kind:"is-failure",
                  title:"ACCESS DENIED",
                  body:
                    (access.total == null
                      ? "DEVICE REJECTED ACCESS"
                      : access.total+" vs DC "+access.dc)
                }
              );
              globalThis.FEHA_SOUNDS?.play?.("error",{cooldown:0});
              return;
            }

            if (result?.error) {
              showDevicePanel(
                root,
                actor,
                device,
                {
                  kind:"is-failure",
                  title:capabilityLabel+" // FAILED",
                  body:String(result.error)
                }
              );

              globalThis.FEHA_SOUNDS?.play?.("error",{cooldown:0});
              return;
            }

            if (result?.requiresAdapter) {
              showDevicePanel(
                root,
                actor,
                device,
                {
                  kind:"is-pending",
                  title:capabilityLabel+" // ADAPTER",
                  body:
                    result.requiresAdapter.toUpperCase()+
                    " adapter is registered as a separate subsystem."
                }
              );
              ui?.notifications?.warn?.(
                capabilityLabel+" requires the "+
                result.requiresAdapter+" adapter."
              );
              globalThis.FEHA_SOUNDS?.play?.("error",{cooldown:0});
              return;
            }

            showDevicePanel(
              root,
              actor,
              liveNetworkDevice(device.id) ?? device,
              {
                kind:"is-success",
                title:capabilityLabel+" // EXECUTED",
                body:"NETWORK COMMAND ACCEPTED"
              }
            );

            globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0});

            await ChatMessage.create({
              speaker:ChatMessage.getSpeaker({actor}),
              content:
                "<p><strong>NETWORK DEVICE // "+esc(device.name)+"</strong></p>"+
                "<p>"+esc(capabilityLabel)+" — <strong>EXECUTED</strong></p>"
            });
          } catch (err) {
            console.error("FEHA V3 device capability failed",err);
            ui?.notifications?.error?.("Network Device action failed.");
            deviceButton.disabled = false;
            delete deviceButton.dataset.busy;
          }

          return;
        }

        return;
      }

      if (qhButton) {
        const qhAction = qhButton.dataset.qhAction;

        if (
          qhAction === "close-resolution" ||
          qhAction === "return-net"
        ) {
          root.querySelector(".qh-resolution")?.remove();
          delete root.dataset.resolvingQuickhack;

          // Previewing a Quickhack no longer spends RAM, so closing the
          // resolution must immediately restore RUN availability.
          updateJackTargetUI(root,actor);

          globalThis.FEHA_SOUNDS?.play?.("drawer_close",{cooldown:0});
          return;
        }

        if (qhAction === "close-cyberdeck") {
          root.remove();
          document.getElementById(ROOT_ID)?.remove();
          globalThis.FEHA_SOUNDS?.play?.("drawer_close",{cooldown:0});
          return;
        }

        const input = root.querySelector("[data-qh-damage]");

        if (qhAction === "minus-damage" || qhAction === "plus-damage") {
          if (!input) return;
          globalThis.FEHA_SOUNDS?.play?.("cyberware_select",{cooldown:45});
          const delta = qhAction === "plus-damage" ? 1 : -1;
          input.value = String(Math.max(0,(Number(input.value)||0)+delta));
          return;
        }

        if (qhAction === "apply-effect") {
          if (qhButton.dataset.busy === "1") return;

          globalThis.FEHA_SOUNDS?.play?.("subsystem_select",{cooldown:80});

          const resolution =
            qhButton.closest(".qh-resolution");

          if (!resolution) return;

          qhButton.dataset.busy = "1";
          qhButton.disabled = true;

          try {
            const committed =
              await commitQuickhackRam(
                actor,
                resolution
              );

            if (!committed) {
              qhButton.disabled = false;
              delete qhButton.dataset.busy;
              return;
            }

            qhButton.textContent = "EFFECT APPLIED";

            await ChatMessage.create({
              speaker:ChatMessage.getSpeaker({actor}),
              content:
                "<p><strong>QUICKHACK EFFECT APPLIED</strong></p>"+
                "<p>"+esc(
                  actor.items?.get?.(
                    resolution.dataset.qhItem ?? ""
                  )?.name ?? "Quickhack"
                )+"</p>"
            });

            globalThis.FEHA_SOUNDS?.play?.(
              "confirm",
              {cooldown:0}
            );
          } catch (err) {
            console.error(
              "FEHA V3 effect application failed",
              err
            );
            ui?.notifications?.error?.(
              "Could not apply Quickhack effect."
            );
            qhButton.disabled = false;
            delete qhButton.dataset.busy;
          }

          return;
        }

        if (qhAction === "apply-damage") {
          if (!input || qhButton.dataset.busy === "1") return;

          globalThis.FEHA_SOUNDS?.play?.("cyberware_select",{cooldown:80});

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

            const ramCommitted =
              await commitQuickhackRam(actor,resolution);

            if (!ramCommitted) {
              throw new Error(
                "Quickhack RAM commit failed after damage application."
              );
            }

            qhButton.textContent =
              "APPLIED // "+result.damage+" DAMAGE";

            input.disabled = true;

            const hpReadout = resolution?.querySelector?.("[data-qh-hp]");
            if (hpReadout) {
              hpReadout.textContent =
                "HP "+result.after.value+
                (result.after.temp ? " + "+result.after.temp+" TEMP" : "")+
                " / "+result.after.max;
            }

            for (const adjuster of resolution?.querySelectorAll?.(
              '[data-qh-action="minus-damage"],[data-qh-action="plus-damage"]'
            ) ?? []) {
              adjuster.disabled = true;
            }

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

      if (action === "device") {
        const device = liveNetworkDevice(button.dataset.deviceId);
        if (!device) {
          return ui?.notifications?.warn?.("Network Device is no longer available.");
        }

        showDevicePanel(root,actor,device);
        globalThis.FEHA_SOUNDS?.play?.("scan",{cooldown:70});
        return;
      }

      if (action === "camera-place") {
        await beginJackCameraPlacement(
          root,
          actor
        );
        return;
      }

      if (action === "zoom-in") {
        const state = jackViewportState(root);
        zoomJackAt(root,state.zoom*1.18);
        globalThis.FEHA_SOUNDS?.play?.("select",{cooldown:70});
        return;
      }

      if (action === "zoom-out") {
        const state = jackViewportState(root);
        zoomJackAt(root,state.zoom*.84);
        globalThis.FEHA_SOUNDS?.play?.("select",{cooldown:0});
        return;
      }

      if (action === "fit-view") {
        fitJackViewport(root);
        globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:70});
        return;
      }

      if (action === "reset-view") {
        resetJackViewport(root);
        globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:70});
        return;
      }

      if (
        action === "close" ||
        action === "return-deck"
      ) {
        root.remove();
        globalThis.FEHA_SOUNDS?.play?.("drawer_close",{cooldown:0});
        render(actor.id);
        return;
      }

      if (action === "close-cyberdeck") {
        root.remove();
        document.getElementById(ROOT_ID)?.remove();
        globalThis.FEHA_SOUNDS?.play?.("drawer_close",{cooldown:0});
        return;
      }

      if (action === "target") {
        const token =
          canvas?.tokens?.get?.(button.dataset.tokenId) ??
          canvas?.tokens?.placeables?.find?.(
            t => t.id === button.dataset.tokenId
          ) ??
          null;

        if (!token) {
          return ui?.notifications?.warn?.(
            "That scene token is no longer available."
          );
        }

        const tokenId =
          token.id ??
          token.document?.id ??
          button.dataset.tokenId;

        const alreadyTargeted =
          [...(game.user?.targets ?? [])].some(
            current =>
              (current?.id ?? current?.document?.id) === tokenId
          );

        try {
          if (alreadyTargeted) {
            await token.setTarget(
              false,
              {
                user:game.user,
                releaseOthers:false,
                groupSelection:true
              }
            );

            globalThis.FEHA_SOUNDS?.play?.(
              "drawer_close",
              {cooldown:0}
            );
          } else {
            await token.setTarget(
              true,
              {
                user:game.user,
                releaseOthers:true,
                groupSelection:true
              }
            );

            globalThis.FEHA_SOUNDS?.play?.(
              "scan",
              {cooldown:0}
            );

            setTimeout(
              () =>
                globalThis.FEHA_SOUNDS?.play?.(
                  "confirm",
                  {cooldown:0}
                ),
              90
            );
          }
        } catch (err) {
          console.warn(
            "FEHA V3 target toggle failed",
            err
          );

          globalThis.FEHA_SOUNDS?.play?.(
            "error",
            {cooldown:0}
          );

          ui?.notifications?.warn?.(
            alreadyTargeted
              ? "Could not release that scene target."
              : "Could not acquire that scene target."
          );
          return;
        }

        updateJackTargetUI(root,actor);
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
          // Resolution is preview-only. RAM is committed only when
          // APPLY DAMAGE / APPLY EFFECT is actually confirmed.
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
                  '<p><strong>RAM COST '+cost+'</strong> • DC '+m.dc+
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

          const liveRoot =
            document.getElementById(JACK_ID);

          if (liveRoot?.isConnected) {
            delete liveRoot.dataset.executing;
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
  const cyberUnsubscribers = [];
  let refreshQueued = false;

  const deviceChangeOff =
    globalThis.FEHA_CYBER_CORE?.on?.(
      "devices:changed",
      payload => {
        const jack = document.getElementById(JACK_ID);

        if (
          jack?.dataset?.phase === "live" &&
          (!payload?.sceneId || payload.sceneId === canvas?.scene?.id)
        ) {
          queueV3Refresh("jack");
        }
      }
    );

  if (typeof deviceChangeOff === "function") {
    cyberUnsubscribers.push(deviceChangeOff);
  }

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

    v3Hooks.push([
      "targetToken",
      Hooks.on("targetToken", () => {
        const jack = document.getElementById(JACK_ID);
        if (jack?.dataset?.phase !== "live") return;

        const actor = actorById(jack.dataset.actorId);
        if (actor) updateJackTargetUI(jack,actor);
      })
    ]);

    for (const event of [
      "createToken","updateToken","deleteToken",
      "createWall","updateWall","deleteWall",
      "createAmbientLight","updateAmbientLight","deleteAmbientLight",
      "createTile","updateTile","deleteTile",
      "canvasReady"
    ]) {
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
      for (const unsubscribe of cyberUnsubscribers) {
        try { unsubscribe(); } catch {}
      }
      document.getElementById(ROOT_ID)?.remove();
      const jackRoot = document.getElementById(JACK_ID);
      jackRoot?.__jackResizeObserver?.disconnect?.();
      jackRoot?.remove();
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
