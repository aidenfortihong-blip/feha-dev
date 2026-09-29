// FEHA // QUICKHACK RUNTIME
// Finalized one-click Quickhack execution layer.
// Quickhacks use a Bonus Action and are limited to one per turn in combat.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_QUICKHACK_RUNTIME requires FEHA_CYBER_CORE.");

  const VERSION = "1.0.1";
  const FLAG = "fleshEnshrouded";
  const PICKER_ID = "feha-qh-runtime-picker";

  const TARGETLESS = new Set([
    "ghost-key",
    "network-sweep",
    "toxic-bloom"
  ]);

  const ABILITIES = [
    {value:"str",label:"Strength"},
    {value:"dex",label:"Dexterity"},
    {value:"con",label:"Constitution"},
    {value:"int",label:"Intelligence"},
    {value:"wis",label:"Wisdom"},
    {value:"cha",label:"Charisma"}
  ];

  const esc = value => String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  function catalog() {
    return globalThis.FEHA_QUICKHACK_CATALOG ?? null;
  }

  function authority() {
    const service =
      globalThis.FEHA_QUICKHACK_AUTHORITY ??
      core.module?.("quickhackAuthority") ??
      null;

    if (!service) {
      throw new Error(
        "Quickhack authority is unavailable."
      );
    }

    return service;
  }

  function definition(item) {
    return catalog()?.definition?.(item) ?? null;
  }

  function handles(item) {
    return Boolean(definition(item));
  }

  function requiresTarget(item) {
    const def = definition(item);
    if (!def) return true;
    return !TARGETLESS.has(def.key);
  }

  function hackDC(actor) {
    const intMod =
      Number(
        actor?.system?.abilities?.int?.mod ??
        0
      ) || 0;

    const prof =
      Number(
        actor?.system?.attributes?.prof ??
        actor?.system?.details?.prof ??
        2
      ) || 2;

    return 8 + prof + intMod;
  }

  function targetId(token) {
    return (
      token?.id ??
      token?.document?.id ??
      null
    );
  }

  function targetActor(token) {
    return (
      token?.actor ??
      token?.document?.actor ??
      null
    );
  }

  function targetName(token) {
    return (
      token?.name ??
      token?.document?.name ??
      targetActor(token)?.name ??
      "UNKNOWN TARGET"
    );
  }

  function sceneIdFor(token=null) {
    return (
      token?.document?.parent?.id ??
      token?.parent?.id ??
      canvas?.scene?.id ??
      null
    );
  }

  function basePayload(prepared) {
    return {
      operatorActorId:prepared.operator.id,
      quickhackItemId:prepared.item.id,
      targetTokenId:
        prepared.targetToken
          ? targetId(prepared.targetToken)
          : null,
      sceneId:prepared.sceneId
    };
  }

  function combatForActor(actor) {
    const combat = game.combat;
    if (!combat?.started) return null;

    const combatant =
      list(combat.combatants)
        .find(entry =>
          String(entry?.actorId ?? entry?.actor?.id ?? "") ===
          String(actor?.id ?? "")
        ) ??
      null;

    return combatant ? combat : null;
  }

  function turnStamp(actor) {
    const combat = combatForActor(actor);
    if (!combat) return null;

    return [
      combat.id,
      Number(combat.round ?? 0),
      Number(combat.turn ?? -1)
    ].join(":");
  }

  function assertTurnAvailable(actor) {
    const stamp = turnStamp(actor);
    if (!stamp) return true;

    const used =
      String(
        actor?.flags?.[FLAG]?.quickhackTurnStamp ??
        ""
      );

    if (used === stamp) {
      throw new Error(
        "You already used a Quickhack this turn."
      );
    }

    return true;
  }

  async function markTurnUsed(actor) {
    const stamp = turnStamp(actor);
    if (!stamp) return false;

    await actor.update({
      ["flags."+FLAG+".quickhackTurnStamp"]:
        stamp
    });

    return true;
  }

  function cancelled(message="Quickhack cancelled.") {
    const error = new Error(message);
    error.code = "FEHA_QH_CANCELLED";
    return error;
  }

  function pickerCss() {
    return [
      "position:fixed",
      "inset:0",
      "z-index:100000",
      "background:rgba(0,0,0,.82)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "font-family:monospace"
    ].join(";");
  }

  function pickerPanelCss() {
    return [
      "width:min(680px,92vw)",
      "max-height:78vh",
      "overflow:auto",
      "background:#05090d",
      "border:1px solid #1ce8ff",
      "box-shadow:0 0 40px rgba(28,232,255,.22)",
      "padding:18px"
    ].join(";");
  }

  async function chooseOption({
    title,
    subtitle="",
    options=[],
    confirmLabel="CONFIRM"
  }) {
    if (!options.length) return null;

    document.getElementById(PICKER_ID)?.remove();

    return new Promise(resolve => {
      const root = document.createElement("div");
      root.id = PICKER_ID;
      root.style.cssText = pickerCss();

      root.innerHTML =
        '<section style="'+pickerPanelCss()+'">'+
          '<header style="border-bottom:1px solid rgba(28,232,255,.35);padding-bottom:12px;margin-bottom:12px">'+
            '<small style="color:#f5d547;letter-spacing:.14em">QUICKHACK TARGETING</small>'+
            '<h2 style="margin:5px 0;color:#eafcff">'+esc(title)+'</h2>'+
            (subtitle
              ? '<p style="margin:0;color:#8ea6b4">'+esc(subtitle)+'</p>'
              : '')+
          '</header>'+
          '<div data-qh-options style="display:grid;gap:8px">'+
            options.map((option,index) =>
              '<button type="button" data-qh-option="'+index+'" style="'+
                'display:flex;align-items:center;gap:12px;width:100%;text-align:left;'+
                'padding:10px;background:#09131b;border:1px solid #29404d;color:#eafcff;cursor:pointer'+
              '">'+
                (option.img
                  ? '<img src="'+esc(option.img)+'" style="width:38px;height:38px;object-fit:contain">'
                  : '')+
                '<span style="display:flex;flex-direction:column;gap:2px">'+
                  '<b>'+esc(option.label ?? option.name ?? option.value)+'</b>'+
                  (option.detail
                    ? '<small style="color:#8199a7">'+esc(option.detail)+'</small>'
                    : '')+
                '</span>'+
              '</button>'
            ).join("")+
          '</div>'+
          '<footer style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">'+
            '<button type="button" data-qh-cancel style="padding:9px 14px;background:#111;border:1px solid #555;color:#aaa">CANCEL</button>'+
            '<button type="button" data-qh-confirm disabled style="padding:9px 18px;background:#132029;border:1px solid #f5d547;color:#f5d547;font-weight:800">'+
              esc(confirmLabel)+
            '</button>'+
          '</footer>'+
        '</section>';

      document.body.appendChild(root);

      let selected = -1;
      const confirm =
        root.querySelector("[data-qh-confirm]");

      root.addEventListener("click",event => {
        const optionButton =
          event.target?.closest?.("[data-qh-option]");

        if (optionButton) {
          selected =
            Number(optionButton.dataset.qhOption);

          for (
            const button of
            root.querySelectorAll("[data-qh-option]")
          ) {
            const active =
              Number(button.dataset.qhOption) === selected;

            button.style.borderColor =
              active
                ? "#f5d547"
                : "#29404d";

            button.style.background =
              active
                ? "#182016"
                : "#09131b";
          }

          confirm.disabled = false;
          return;
        }

        if (event.target?.closest?.("[data-qh-cancel]")) {
          root.remove();
          resolve(null);
          return;
        }

        if (
          event.target?.closest?.("[data-qh-confirm]") &&
          selected >= 0
        ) {
          const result = options[selected] ?? null;
          root.remove();
          resolve(result);
        }
      });
    });
  }

  function drawRadius(graphics,radiusPx) {
    graphics.clear();

    try {
      graphics
        .circle(0,0,radiusPx)
        .fill({
          color:0x2eefff,
          alpha:0.13
        })
        .stroke({
          color:0xf5d547,
          width:3,
          alpha:0.92
        });

      return;
    } catch {}

    try {
      graphics.lineStyle(
        3,
        0xf5d547,
        0.92
      );

      graphics.beginFill(
        0x2eefff,
        0.13
      );

      graphics.drawCircle(
        0,
        0,
        radiusPx
      );

      graphics.endFill();
    } catch {}
  }

  async function pickCanvasPoint(radiusFt) {
    if (
      !canvas?.ready ||
      !canvas?.stage ||
      !canvas?.app?.view ||
      !globalThis.PIXI
    ) {
      throw new Error(
        "Canvas is not ready for area placement."
      );
    }

    const jackRoot =
      document.getElementById(
        "feha-jackin-overlay"
      );

    const oldDisplay =
      jackRoot?.style?.display ??
      "";

    if (jackRoot) {
      jackRoot.style.display = "none";
    }

    const stage = canvas.stage;
    const graphics = new PIXI.Graphics();
    graphics.eventMode = "none";
    graphics.zIndex = 999999;

    try {
      stage.addChild(graphics);
    } catch {}

    const gridSize =
      Number(canvas.scene?.grid?.size ?? 100) || 100;

    const gridDistance =
      Number(canvas.scene?.grid?.distance ?? 5) || 5;

    const radiusPx =
      (Number(radiusFt) / gridDistance) *
      gridSize;

    drawRadius(
      graphics,
      radiusPx
    );

    ui?.notifications?.info?.(
      "TOXIC BLOOM // click the scene to place the 10 ft burst // ESC cancels"
    );

    return new Promise((resolve,reject) => {
      let settled = false;

      const cleanup = () => {
        if (settled) return;
        settled = true;

        try {
          stage.off(
            "pointermove",
            onMove
          );

          stage.off(
            "pointerdown",
            onDown
          );
        } catch {}

        document.removeEventListener(
          "keydown",
          onKey,
          true
        );

        try {
          graphics.destroy({
            children:true
          });
        } catch {
          try { graphics.removeFromParent(); } catch {}
        }

        if (jackRoot) {
          jackRoot.style.display = oldDisplay;
        }
      };

      const onMove = event => {
        try {
          const point =
            event.getLocalPosition(stage);

          graphics.position.set(
            point.x,
            point.y
          );
        } catch {}
      };

      const onDown = event => {
        const button =
          event?.button ??
          event?.data?.button ??
          0;

        if (button !== 0) return;

        try {
          const point =
            event.getLocalPosition(stage);

          cleanup();

          resolve({
            x:Number(point.x),
            y:Number(point.y),
            radiusFt:Number(radiusFt)
          });
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      const onKey = event => {
        if (event.key !== "Escape") return;

        cleanup();
        reject(
          cancelled(
            "Toxic Bloom placement cancelled."
          )
        );
      };

      stage.on(
        "pointermove",
        onMove
      );

      stage.on(
        "pointerdown",
        onDown
      );

      document.addEventListener(
        "keydown",
        onKey,
        true
      );
    });
  }

  function visibleSceneTargets(excludeTokenId=null) {
    return list(canvas?.tokens?.placeables)
      .filter(token => {
        const id = targetId(token);

        return (
          id &&
          String(id) !== String(excludeTokenId ?? "") &&
          Boolean(targetActor(token)) &&
          token.visible !== false
        );
      })
      .map(token => ({
        value:targetId(token),
        label:targetName(token),
        img:
          token?.document?.texture?.src ??
          targetActor(token)?.img ??
          ""
      }));
  }

  function preparedBase(operator,item,targetToken) {
    const def = definition(item);

    if (!def) {
      throw new Error(
        "Quickhack is not in the canonical catalog."
      );
    }

    return {
      operator,
      item,
      targetToken,
      targetActor:targetActor(targetToken),
      definition:def,
      key:def.key,
      sceneId:sceneIdFor(targetToken),
      dc:hackDC(operator),
      choice:{}
    };
  }

  async function prepare(operator,item,targetToken=null) {
    assertTurnAvailable(operator);

    const prepared =
      preparedBase(
        operator,
        item,
        targetToken
      );

    if (
      requiresTarget(item) &&
      (!targetToken || !prepared.targetActor)
    ) {
      throw new Error(
        "Select a target for this Quickhack."
      );
    }

    const auth = authority();
    const payload = basePayload(prepared);

    switch (prepared.key) {
      case "toxic-bloom": {
        prepared.choice.point =
          await pickCanvasPoint(
            Number(
              prepared.definition?.meta?.radiusFt ??
              10
            )
          );

        return prepared;
      }

      case "chrome-lock": {
        const result =
          await auth.listTargetItems({
            ...payload,
            kind:"cyberware"
          });

        const options =
          list(result?.items)
            .filter(item => item.installed)
            .map(item => ({
              value:item.id,
              label:item.name,
              img:item.img,
              detail:"INSTALLED CYBERWARE",
              raw:item
            }));

        if (!options.length) {
          throw new Error(
            "Target has no installed cyberware for Chrome Lock."
          );
        }

        const selected =
          await chooseOption({
            title:"CHROME LOCK",
            subtitle:"Choose the cyberware to knock offline.",
            options,
            confirmLabel:"DISABLE"
          });

        if (!selected) {
          throw cancelled();
        }

        prepared.choice.item =
          selected.raw;

        return prepared;
      }

      case "cookoff": {
        const result =
          await auth.listTargetItems({
            ...payload,
            kind:"explosives"
          });

        const options =
          list(result?.items)
            .filter(item =>
              Number(item.quantity ?? 0) > 0
            )
            .map(item => ({
              value:item.id,
              label:item.name,
              img:item.img,
              detail:
                "QTY " +
                String(item.quantity ?? 1),
              raw:item
            }));

        if (!options.length) {
          throw new Error(
            "Target has no grenade or explosive to detonate."
          );
        }

        const selected =
          await chooseOption({
            title:"COOKOFF",
            subtitle:"Choose the carried explosive.",
            options,
            confirmLabel:"DETONATE"
          });

        if (!selected) {
          throw cancelled();
        }

        prepared.choice.item =
          selected.raw;

        return prepared;
      }

      case "dead-trigger": {
        const result =
          await auth.listTargetItems({
            ...payload,
            kind:"firearms"
          });

        const options =
          list(result?.items)
            .filter(item =>
              !/^BROKEN\s*\/\//i.test(
                String(item.name ?? "")
              )
            )
            .map(item => ({
              value:item.id,
              label:item.name,
              img:item.img,
              detail:"FIREARM",
              raw:item
            }));

        if (!options.length) {
          throw new Error(
            "Target has no usable firearm for Dead Trigger."
          );
        }

        const selected =
          await chooseOption({
            title:"DEAD TRIGGER",
            subtitle:"Choose the firearm to break.",
            options,
            confirmLabel:"BREAK"
          });

        if (!selected) {
          throw cancelled();
        }

        prepared.choice.item =
          selected.raw;

        return prepared;
      }

      case "blank-slate": {
        const selected =
          await chooseOption({
            title:"BLANK SLATE",
            subtitle:"Choose the ability used for the saving throw.",
            options:
              ABILITIES.map(ability => ({
                value:ability.value,
                label:ability.label
              })),
            confirmLabel:"UPLOAD"
          });

        if (!selected) {
          throw cancelled();
        }

        prepared.choice.ability =
          selected.value;

        return prepared;
      }

      case "frenzy": {
        const choices =
          visibleSceneTargets(
            targetId(targetToken)
          );

        if (!choices.length) {
          throw new Error(
            "There is no valid creature for Frenzy to attack."
          );
        }

        const selected =
          await chooseOption({
            title:"FRENZY",
            subtitle:
              targetName(targetToken) +
              " will be forced to attack the creature you choose if the save fails.",
            options:choices,
            confirmLabel:"LOCK TARGET"
          });

        if (!selected) {
          throw cancelled();
        }

        prepared.choice.attackTarget =
          selected;

        return prepared;
      }

      case "motor-lock": {
        const state =
          await auth.inspectTarget(
            payload
          );

        if (!state?.hasLegCyberware) {
          throw new Error(
            "Motor Lock requires installed leg cyberware."
          );
        }

        prepared.choice.inspect =
          state;

        return prepared;
      }

      case "arc-overload": {
        const state =
          await auth.inspectTarget(
            payload
          );

        if (!state?.cyberneticElectronic) {
          throw new Error(
            "Arc Overload requires a cybernetic or electronic target."
          );
        }

        prepared.choice.inspect =
          state;

        return prepared;
      }

      case "optic-zero": {
        prepared.choice.inspect =
          await auth.inspectTarget(
            payload
          );

        return prepared;
      }

      default:
        return prepared;
    }
  }

  async function safeChat(prepared,{
    state,
    body,
    save=null,
    accent="#2eefff"
  }) {
    const target =
      prepared.targetToken
        ? targetName(prepared.targetToken)
        : "NO CREATURE TARGET";

    const saveHtml =
      save
        ? (
            '<div class="feha-qh-chat-save" style="'+
              'margin:8px 0 0;padding:7px 9px;border:1px solid rgba(126,222,244,.28);'+
              'background:#0b151b;color:#eafcff !important">'+
              '<strong style="color:#79def4 !important">'+esc(save.label)+' SAVE</strong>'+
              '<span style="color:#eafcff !important"> '+esc(save.total)+' vs DC '+esc(prepared.dc)+'</span>'+
              '<b style="margin-left:8px;color:'+(save.passed?'#8df5a6':'#ff6d8f')+' !important">'+
                (save.passed ? "SUCCESS" : "FAILURE")+
              '</b>'+
            '</div>'
          )
        : "";

    const content =
      '<section class="feha-qh-chat-card" style="'+
        'border:1px solid #24424b;border-left:4px solid '+esc(accent)+';'+
        'background:#071015;color:#eafcff !important;padding:11px 12px;'+
        'box-shadow:inset 0 0 0 1px rgba(46,239,255,.03)">'+
        '<small style="display:block;color:#79def4 !important;font-size:10px;font-weight:900;'+
        'letter-spacing:.13em">BONUS ACTION // QUICKHACK</small>'+
        '<h3 style="margin:4px 0 9px;color:#ffffff !important;font-size:18px;line-height:1.1;'+
        'border:0 !important;text-shadow:none !important">'+esc(prepared.item.name)+'</h3>'+
        '<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 9px;margin:0 0 8px">'+
          '<strong style="color:#7895a0 !important;font-size:10px;letter-spacing:.08em">TARGET</strong>'+
          '<span style="color:#eafcff !important;font-weight:800">'+esc(target)+'</span>'+
          '<strong style="color:#7895a0 !important;font-size:10px;letter-spacing:.08em">STATE</strong>'+
          '<span style="color:#f2d76f !important;font-weight:900">'+esc(state)+'</span>'+
        '</div>'+
        saveHtml+
        '<p class="feha-qh-chat-body" style="margin:9px 0 0;color:#d7e5ea !important;'+
        'line-height:1.45;font-size:12px">'+body+'</p>'+
      '</section>';

    try {
      await ChatMessage.create({
        speaker:
          ChatMessage.getSpeaker({
            actor:prepared.operator
          }),
        content
      });
    } catch (error) {
      console.warn(
        "FEHA QUICKHACK RUNTIME // chat log failed",
        error
      );
    }
  }

  async function rollSave(prepared,ability) {
    const result =
      await authority().rollSave({
        ...basePayload(prepared),
        ability
      });

    return {
      ...result,
      dc:prepared.dc,
      passed:
        Number(result?.total ?? 0) >=
        Number(prepared.dc)
    };
  }

  async function execute(prepared) {
    const auth = authority();
    const payload = basePayload(prepared);

    switch (prepared.key) {
      case "ghost-key": {
        await safeChat(prepared,{
          state:"DM RUN",
          body:
            "Force open one locked networked door directly in front of the operator."
        });

        return {
          manual:true
        };
      }

      case "wiretap": {
        const save =
          await rollSave(
            prepared,
            "wis"
          );

        await safeChat(prepared,{
          state:
            save.passed
              ? "RESISTED"
              : "WIRETAP ACTIVE // DM RUN",
          save,
          body:
            save.passed
              ? "The target keeps its communications secure."
              : "The operator can listen to the target's active communications for up to 1 minute. The GM runs the intercepted conversation."
        });

        return {save};
      }

      case "dead-air": {
        await auth.applyStatus({
          ...payload,
          status:"deafened"
        });

        await safeChat(prepared,{
          state:"DEAFENED // 2 TURNS",
          body:
            "The target's calls, alarms, network messages, and other communications are cut off for the same duration. Communications are GM-run."
        });

        return {
          status:"deafened"
        };
      }

      case "chrome-lock": {
        const save =
          await rollSave(
            prepared,
            "int"
          );

        let result = null;

        if (!save.passed) {
          result =
            await auth.chromeLock({
              ...payload,
              itemId:
                prepared.choice.item.id
            });
        }

        await safeChat(prepared,{
          state:
            save.passed
              ? "RESISTED"
              : "CYBERWARE OFFLINE",
          save,
          body:
            save.passed
              ? "The selected cyberware remains online."
              : (
                  "<strong>"+
                  esc(prepared.choice.item.name)+
                  "</strong> is unequipped until Chrome Lock expires at the end of the target's next turn."
                )
        });

        return {
          save,
          result
        };
      }

      case "motor-lock": {
        const result =
          await auth.motorLock(
            payload
          );

        await safeChat(prepared,{
          state:"SPEED 0",
          body:
            "The target's installed leg cyberware is locked until the end of its next turn."
        });

        return result;
      }

      case "network-sweep": {
        await safeChat(prepared,{
          state:"DM RUN // 50 FT SWEEP",
          body:
            "Reveal networked cameras, turrets, doors, alarms, terminals, similar devices, and hostile creatures with cyberware within 50 feet. The GM reveals the valid network."
        });

        return {
          manual:true
        };
      }

      case "lure": {
        const save =
          await rollSave(
            prepared,
            "wis"
          );

        await safeChat(prepared,{
          state:
            save.passed
              ? "RESISTED"
              : "FORCED MOVEMENT // DM RUN",
          save,
          body:
            save.passed
              ? "The target resists the movement command."
              : "The GM moves the target up to 20 feet toward a point chosen by the operator. This movement does not provoke opportunity attacks."
        });

        return {save};
      }

      case "optic-zero": {
        if (
          prepared.choice.inspect?.blindsight
        ) {
          await safeChat(prepared,{
            state:"UNAFFECTED // BLINDSENSE",
            body:
              "The target can perceive its surroundings without its visual systems."
          });

          return {
            immune:true
          };
        }

        const result =
          await auth.applyStatus({
            ...payload,
            status:"blinded"
          });

        await safeChat(prepared,{
          state:"BLINDED",
          body:
            "The target is Blinded until the end of its next turn."
        });

        return result;
      }

      case "cookoff": {
        const result =
          await auth.useExplosive({
            ...payload,
            itemId:
              prepared.choice.item.id
          });

        await safeChat(prepared,{
          state:"DETONATED",
          body:
            "<strong>"+
            esc(prepared.choice.item.name)+
            "</strong> is used immediately as the target's carried explosive."
        });

        return result;
      }

      case "frenzy": {
        const save =
          await rollSave(
            prepared,
            "wis"
          );

        await safeChat(prepared,{
          state:
            save.passed
              ? "RESISTED"
              : "FRENZY // DM RUN",
          save,
          body:
            save.passed
              ? "The target keeps control."
              : (
                  "<strong>"+
                  esc(targetName(prepared.targetToken))+
                  "</strong> must immediately use its reaction, if available, to attack <strong>"+
                  esc(prepared.choice.attackTarget.label)+
                  "</strong>. The GM resolves the attack manually."
                )
        });

        return {save};
      }

      case "blank-slate": {
        const save =
          await rollSave(
            prepared,
            prepared.choice.ability
          );

        await safeChat(prepared,{
          state:
            save.passed
              ? "RESISTED"
              : "MEMORY ERASED // DM RUN",
          save,
          body:
            save.passed
              ? "The target retains its memory."
              : "The target forgets everything that happened during the previous 1 minute."
        });

        return {save};
      }

      case "dead-trigger": {
        const save =
          await rollSave(
            prepared,
            "int"
          );

        let result = null;

        if (!save.passed) {
          result =
            await auth.markBroken({
              ...payload,
              itemId:
                prepared.choice.item.id
            });
        }

        await safeChat(prepared,{
          state:
            save.passed
              ? "RESISTED"
              : "BROKEN",
          save,
          body:
            save.passed
              ? "The firearm remains functional."
              : (
                  "<strong>BROKEN // "+
                  esc(prepared.choice.item.name)+
                  "</strong>"
                )
        });

        return {
          save,
          result
        };
      }

      case "synapse-burn": {
        const save =
          await rollSave(
            prepared,
            "int"
          );

        const damage =
          await auth.damageRoll({
            ...payload,
            factor:
              save.passed
                ? 0.5
                : 1
          });

        if (!save.passed) {
          await auth.applyStatus({
            ...payload,
            status:"no-reactions"
          });
        }

        await safeChat(prepared,{
          state:
            save.passed
              ? "PARTIAL RESIST"
              : "SYNAPSE BURN",
          save,
          body:
            "<strong>"+
            esc(damage.raw)+
            " PSYCHIC</strong> rolled // "+
            esc(damage.applied)+
            " applied."+
            (
              save.passed
                ? ""
                : " The target cannot take reactions until the end of its next turn."
            )
        });

        return {
          save,
          damage
        };
      }

      case "toxic-bloom": {
        const result =
          await auth.areaDamage({
            ...payload,
            x:
              prepared.choice.point.x,
            y:
              prepared.choice.point.y
          });

        await safeChat(prepared,{
          state:"TOXIC BLOOM",
          body:
            "<strong>"+
            esc(result.raw)+
            " POISON</strong> dealt in a "+
            esc(result.radius)+
            "-foot radius // "+
            esc(result.affectedCount)+
            " creature(s) affected."
        });

        return result;
      }

      case "rollback": {
        await safeChat(prepared,{
          state:"ROLLBACK ARMED // DM RUN",
          body:
            "Until the start of the operator's next turn, the next successful attack roll, ability check, or saving throw made by the target is rerolled and uses the lower result. Then the operator or one ally gains advantage on its next attack roll, ability check, or saving throw before the end of its next turn."
        });

        return {
          manual:true
        };
      }

      case "self-terminate": {
        const save =
          await rollSave(
            prepared,
            "wis"
          );

        await safeChat(prepared,{
          state:
            save.passed
              ? "RESISTED"
              : "SELF-TERMINATE // DM RUN",
          save,
          body:
            save.passed
              ? "The target resists the command."
              : "The target must immediately use its reaction, if available, to make one damaging attack against itself. The GM resolves the attack manually."
        });

        return {save};
      }

      case "system-collapse": {
        const save =
          await rollSave(
            prepared,
            "int"
          );

        let result = null;

        if (!save.passed) {
          result =
            await auth.applyStatus({
              ...payload,
              status:"incapacitated"
            });
        }

        await safeChat(prepared,{
          state:
            save.passed
              ? "RESISTED"
              : "INCAPACITATED",
          save,
          body:
            save.passed
              ? "The target remains online."
              : "The target is Incapacitated until the end of its next turn."
        });

        return {
          save,
          result
        };
      }

      case "arc-overload": {
        const save =
          await rollSave(
            prepared,
            "con"
          );

        const damage =
          await auth.damageRoll({
            ...payload,
            factor:
              save.passed
                ? 0.5
                : 1
          });

        if (!save.passed) {
          await auth.applyStatus({
            ...payload,
            status:"no-reactions"
          });
        }

        await safeChat(prepared,{
          state:
            save.passed
              ? "PARTIAL RESIST"
              : "ARC OVERLOAD",
          save,
          body:
            "<strong>"+
            esc(damage.raw)+
            " LIGHTNING</strong> rolled // "+
            esc(damage.applied)+
            " applied."+
            (
              save.passed
                ? ""
                : " The target cannot take reactions until the end of its next turn."
            )
        });

        return {
          save,
          damage
        };
      }

      case "combustion": {
        const result =
          await auth.combustion(
            payload
          );

        await safeChat(prepared,{
          state:
            result.exploded
              ? "COMBUSTION // DEATH BURST"
              : "COMBUSTION",
          body:
            "<strong>"+
            esc(result.primary.raw)+
            " FIRE</strong> dealt to the target."+
            (
              result.exploded
                ? (
                    " It erupts for <strong>"+
                    esc(result.burst.raw)+
                    " FIRE</strong> in a "+
                    esc(result.burst.radius)+
                    "-foot radius, affecting "+
                    esc(result.burst.affectedCount)+
                    " other creature(s)."
                  )
                : ""
            )
        });

        return result;
      }

      case "puppet-wire": {
        const save =
          await rollSave(
            prepared,
            "cha"
          );

        await safeChat(prepared,{
          state:
            save.passed
              ? "RESISTED"
              : "PUPPET WIRE // DM RUN",
          save,
          body:
            save.passed
              ? "The target rejects the control upload."
              : "The operator controls the target for up to 1 minute and can see through its eyes. The GM runs the controlled target. The effect ends immediately after the target performs a hostile or damaging action."
        });

        return {save};
      }

      default:
        throw new Error(
          "No finalized runtime exists for this Quickhack."
        );
    }
  }

  const api = {
    version:VERSION,
    handles,
    requiresTarget,
    assertTurnAvailable,
    markTurnUsed,
    prepare,
    execute,

    async init() {
      globalThis.FEHA_QUICKHACK_RUNTIME = api;
      game.adk ??= {};
      game.adk.quickhackRuntime = api;

      console.log(
        "FEHA QUICKHACK RUNTIME",
        VERSION,
        "ready // 20 finalized Quickhacks"
      );
    },

    async destroy() {
      document.getElementById(
        PICKER_ID
      )?.remove();

      if (
        game?.adk?.quickhackRuntime === api
      ) {
        delete game.adk.quickhackRuntime;
      }

      if (
        globalThis.FEHA_QUICKHACK_RUNTIME === api
      ) {
        delete globalThis.FEHA_QUICKHACK_RUNTIME;
      }
    }
  };

  core.registerModule(
    "quickhackRuntime",
    api
  );

  globalThis.FEHA_QUICKHACK_RUNTIME = api;
})();
