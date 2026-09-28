// FEHA // NETWORK DEVICE ACTIONS
// Security checks and capability execution.
// Specialized device behavior plugs into Core events instead of JACK IN.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  const devices = core?.module?.("devices");
  if (!core || !devices) {
    throw new Error("FEHA_DEVICE_ACTIONS requires Cyber Core + Network Devices.");
  }

  const VERSION = "0.10.1";
  const FLAG_SCOPE = "fleshEnshrouded";
  const DEVICE_FLAG = "networkDevice";
  const sessionAccess = new Set();

  function accessTuple(actor,device) {
    return [
      String(actor?.id ?? "actor"),
      String(device?.sceneId ?? canvas?.scene?.id ?? "scene"),
      String(device?.id ?? "device")
    ];
  }

  function accessKey(actor,device) {
    // Device IDs intentionally contain ":" (door:abc, probe:xyz, doc:...).
    // JSON encoding keeps the cache key reversible without delimiter bugs.
    return JSON.stringify(accessTuple(actor,device));
  }

  function parseAccessKey(key) {
    try {
      const tuple = JSON.parse(String(key));
      return Array.isArray(tuple) && tuple.length === 3
        ? tuple.map(String)
        : null;
    } catch {
      return null;
    }
  }

  function hasAccess(actor,device) {
    return (
      Number(device?.securityDC ?? 0) <= 0 ||
      sessionAccess.has(accessKey(actor,device))
    );
  }

  function clearAccess(actor=null,device=null) {
    if (!actor && !device) {
      sessionAccess.clear();
      return;
    }

    const actorId = actor?.id ?? null;
    const deviceId = device?.id ?? null;

    for (const key of [...sessionAccess]) {
      const tuple = parseAccessKey(key);
      if (!tuple) {
        // Stale keys from an older hot-loaded build are never trustworthy.
        sessionAccess.delete(key);
        continue;
      }

      const [a,,d] = tuple;
      if (actorId && a !== String(actorId)) continue;
      if (deviceId && d !== String(deviceId)) continue;
      sessionAccess.delete(key);
    }
  }

  function abilityModifier(actor,key="int") {
    const ability = actor?.system?.abilities?.[key] ?? {};
    const prepared = Number(ability.mod);
    if (Number.isFinite(prepared)) return prepared;

    const score = Number(ability.value);
    return Number.isFinite(score)
      ? Math.floor((score-10)/2)
      : 0;
  }

  function proficiency(actor) {
    const value = Number(
      actor?.system?.attributes?.prof ??
      actor?.system?.details?.prof ??
      2
    );
    return Number.isFinite(value) ? value : 2;
  }

  async function rollFormula(formula) {
    const roll = new Roll(String(formula));
    await roll.evaluate();
    return roll;
  }

  async function breach(actor,device,{force=false}={}) {
    const dc = Math.max(0,Number(device?.securityDC ?? 0)||0);

    if (force || dc <= 0) {
      sessionAccess.add(accessKey(actor,device));
      return {
        automatic:true,
        passed:true,
        dc,
        total:null,
        die:null,
        modifier:null
      };
    }

    if (hasAccess(actor,device)) {
      return {
        cached:true,
        passed:true,
        dc,
        total:null,
        die:null,
        modifier:null
      };
    }

    const modifier = abilityModifier(actor,"int") + proficiency(actor);
    const roll = await rollFormula(
      "1d20" + (modifier >= 0 ? "+" : "") + modifier
    );

    const total = Number(roll.total ?? 0);
    const die = Number(
      roll?.dice?.[0]?.total ??
      (total-modifier)
    );

    const result = {
      automatic:false,
      cached:false,
      passed:total >= dc,
      dc,
      total,
      die,
      modifier,
      margin:total-dc
    };

    if (result.passed) {
      sessionAccess.add(accessKey(actor,device));
    }

    await core.emit("device:breach",{
      actor,
      device,
      result
    });

    return result;
  }

  async function resolveSource(device) {
    if (!device?.sourceUuid) return null;

    try {
      if (typeof fromUuid === "function") {
        return await fromUuid(device.sourceUuid);
      }
    } catch {}

    const scene = game.scenes?.get?.(device.sceneId);
    if (!scene) return null;

    const id = device.sourceId;
    const type = String(device.sourceType ?? "");

    if (/Wall/i.test(type)) return scene.walls?.get?.(id) ?? null;
    if (/Token/i.test(type)) return scene.tokens?.get?.(id) ?? null;
    if (/Tile/i.test(type)) return scene.tiles?.get?.(id) ?? null;
    if (/AmbientLight/i.test(type)) return scene.lights?.get?.(id) ?? null;

    return null;
  }

  async function updateDeviceFlag(source,patch) {
    if (!source?.setFlag) return false;

    const current =
      source.getFlag?.(FLAG_SCOPE,DEVICE_FLAG) ??
      source.flags?.[FLAG_SCOPE]?.[DEVICE_FLAG] ??
      {};

    const config =
      current && typeof current === "object"
        ? {...current}
        : {};

    config.enabled = config.enabled !== false;
    config.state = {
      ...(config.state ?? {}),
      ...(patch ?? {})
    };

    await source.setFlag(FLAG_SCOPE,DEVICE_FLAG,config);
    return true;
  }

  async function updateCustomState(device,patch) {
    if (device?.origin !== "custom" && device?.origin !== "probe") {
      return false;
    }

    await devices.upsertCustomDevice(
      device.sceneId,
      {
        ...device,
        state:{
          ...(device.state ?? {}),
          ...(patch ?? {})
        }
      }
    );

    return true;
  }

  function doorStates() {
    const states = globalThis.CONST?.WALL_DOOR_STATES ?? {};
    return {
      CLOSED:Number(states.CLOSED ?? 0),
      OPEN:Number(states.OPEN ?? 1),
      LOCKED:Number(states.LOCKED ?? 2)
    };
  }

  async function executeDoor(source,capability) {
    if (!source?.update) return null;

    const states = doorStates();

    if (capability === "OPEN") {
      await source.update({ds:states.OPEN});
      return {state:"open"};
    }

    if (capability === "CLOSE") {
      await source.update({ds:states.CLOSED});
      return {state:"closed"};
    }

    if (capability === "LOCK") {
      await source.update({ds:states.LOCKED});
      return {state:"locked"};
    }

    if (capability === "UNLOCK") {
      await source.update({ds:states.CLOSED});
      return {state:"closed"};
    }

    return null;
  }

  async function executeLight(source,capability) {
    if (!source?.update) return null;

    if (capability === "POWER_OFF") {
      await source.update({hidden:true});
      return {powered:false};
    }

    if (capability === "POWER_ON") {
      await source.update({hidden:false});
      return {powered:true};
    }

    return null;
  }

  async function genericState(device,source,patch) {
    if (await updateCustomState(device,patch)) {
      return {state:patch};
    }

    if (source) {
      await updateDeviceFlag(source,patch);
      return {state:patch};
    }

    return {state:patch,ephemeral:true};
  }

  async function executeCapability(actor,device,capability,context={}) {
    const cap = String(capability ?? "").trim().toUpperCase();

    // Only the GM authority path may mark an execution as remote/skip-breach.
    // A player calling this API directly cannot promote their own context.
    if (
      !game.user?.isGM &&
      (
        context?.remote === true ||
        context?.skipBreach === true
      )
    ) {
      throw new Error(
        "Remote Network Device execution requires GM authority."
      );
    }

    if (!devices.capabilities[cap]) {
      throw new Error("Unknown Network Device capability: "+cap);
    }

    if (!device?.capabilities?.includes?.(cap)) {
      throw new Error(device?.name+" does not expose "+cap+".");
    }

    const access =
      context?.skipBreach === true
        ? {
            automatic:true,
            cached:true,
            passed:true,
            dc:Number(device?.securityDC ?? 0),
            total:null,
            die:null,
            modifier:null
          }
        : await breach(actor,device);

    if (!access.passed) {
      return {
        ok:false,
        denied:true,
        access,
        capability:cap
      };
    }

    // Player clients may resolve their local breach roll, but every actual
    // device mutation — including future specialized adapters — is executed by
    // the selected GM authority.
    if (!game.user?.isGM) {
      const approvals = core.module("deviceApprovals");

      if (!approvals?.requestDeviceCommand) {
        throw new Error("No online GM command service is available.");
      }

      const remoteResult = await approvals.requestDeviceCommand({
        actorId:actor?.id,
        sceneId:device.sceneId,
        deviceId:device.id,
        capability:cap
      });

      return {
        ok:true,
        access,
        capability:cap,
        remote:true,
        ...(remoteResult ?? {})
      };
    }

    // Specialized adapters run only on the GM-authoritative execution path.
    const delegated = await core.emit(
      "device:execute:"+cap,
      {actor,device,capability:cap,context,access}
    );

    const handled = delegated.find(
      result => result?.handled === true
    );

    if (handled) {
      return {
        ok:true,
        access,
        capability:cap,
        ...handled
      };
    }

    const source = await resolveSource(device);
    let result = null;

    if (device.type === "door") {
      result = await executeDoor(source,cap);
    }

    if (!result && device.type === "door") {
      const doorState =
        cap === "OPEN" ? "open" :
        cap === "LOCK" ? "locked" :
        cap === "UNLOCK" ? "closed" :
        cap === "CLOSE" ? "closed" :
        null;

      if (doorState) {
        result = await genericState(
          device,
          source,
          {doorState}
        );
      }
    }

    if (!result && device.type === "lights") {
      result = await executeLight(source,cap);
    }

    if (
      !result &&
      device.type === "lights" &&
      (cap === "POWER_OFF" || cap === "POWER_ON")
    ) {
      result = await genericState(
        device,
        source,
        {powered:cap === "POWER_ON"}
      );
    }

    if (!result && cap === "DISABLE") {
      result = await genericState(device,source,{disabled:true});
    }

    if (!result && cap === "ENABLE") {
      result = await genericState(device,source,{disabled:false});
    }

    if (!result && cap === "TRIGGER") {
      result = await genericState(device,source,{triggered:true});
    }

    if (!result && cap === "OVERLOAD") {
      result = await genericState(device,source,{overloaded:true});
    }

    if (!result && cap === "TAKEOVER") {
      result = await genericState(device,source,{controlledBy:actor?.id ?? null});
    }

    if (!result && cap === "REVEAL_NETWORK") {
      const approvals = core.module("deviceApprovals");
      const revealUserId =
        context?.requestingUserId ??
        game.user?.id;

      const revealResult =
        game.user?.isGM
          ? {
              count:await devices.revealCustomDevices?.(
                device.sceneId,
                revealUserId
              )
            }
          : await approvals?.requestReveal?.(
              device.sceneId,
              revealUserId
            );

      await genericState(
        device,
        source,
        {networkRevealed:true}
      );

      result = {
        networkRevealed:true,
        revealed:Number(
          revealResult?.count ??
          revealResult?.revealed ??
          0
        )
      };
    }

    if (!result && cap === "DOWNLOAD_DATA") {
      result = {downloaded:true};
    }

    if (!result && cap === "CONTROL_SUBSYSTEM") {
      result = await genericState(device,source,{subsystemControl:true});
    }

    if (!result && (cap === "ROTATE" || cap === "FIRE")) {
      return {
        ok:false,
        access,
        capability:cap,
        requiresAdapter:device.type
      };
    }

    await core.emit("device:executed",{
      actor,
      device,
      capability:cap,
      access,
      result
    });

    return {
      ok:true,
      access,
      capability:cap,
      result
    };
  }

  const api = {
    version:VERSION,
    hasAccess,
    clearAccess,
    breach,
    resolveSource,
    executeCapability,

    async init() {
      console.log("FEHA DEVICE ACTIONS",VERSION,"ready");
    },

    async destroy() {
      sessionAccess.clear();
      if (globalThis.FEHA_DEVICE_ACTIONS === api) {
        delete globalThis.FEHA_DEVICE_ACTIONS;
      }
    }
  };

  core.registerModule("deviceActions",api);
  globalThis.FEHA_DEVICE_ACTIONS = api;
})();
