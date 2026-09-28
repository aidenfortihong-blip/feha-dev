// FEHA // NETWORK DEVICE APPROVALS
// Player probe requests -> online GM approval queue.
// Keeps unknown-map information authoritative to the GM.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  const devices = core?.module?.("devices");

  if (!core || !devices) {
    throw new Error("FEHA_NETWORK_APPROVALS requires Cyber Core + Network Devices.");
  }

  const VERSION = "0.9.4";
  const CHANNEL = "module.flesh-enshrouded-heart-ablaze";
  const MARKER = "fehaNetworkDevicesV1";
  const ROOT_ID = "feha-network-approval-queue";
  const queue = new Map();
  const pending = new Map();
  let socketHandler = null;
  const COMMAND_TIMEOUT_MS = 15000;
  const PROBE_TIMEOUT_MS = 600000;

  function activeOnlineGM() {
    return [...(game.users?.contents ?? game.users ?? [])]
      .filter(user => user?.isGM && user?.active)
      .sort((a,b) => String(a.id).localeCompare(String(b.id)))[0] ??
      null;
  }

  function isAuthorityFor(payload={}) {
    if (!game.user?.isGM) return false;

    const requestedGM = String(payload?.gmId ?? "");
    if (requestedGM) {
      return requestedGM === String(game.user.id);
    }

    // Compatibility with an older client that omitted gmId: only the
    // deterministic first active GM may process it.
    return (
      String(activeOnlineGM()?.id ?? "") ===
      String(game.user.id)
    );
  }

  function requireOnlineGM() {
    if (game.user?.isGM) return game.user;

    const gm = activeOnlineGM();
    if (!gm) {
      throw new Error("No online GM authority is available.");
    }

    return gm;
  }

  function createPendingResolution(
    requestId,
    {
      timeoutMs=0,
      timeoutMessage="Network authority request timed out."
    }={}
  ) {
    let timer = null;
    let settled = false;

    return new Promise((resolve,reject) => {
      const resolver = payload => {
        if (settled) return;
        settled = true;

        if (timer) clearTimeout(timer);

        if (pending.get(requestId) === resolver) {
          pending.delete(requestId);
        }

        resolve(payload);
      };

      resolver.cancel = (
        message="Network authority service reloaded."
      ) => resolver({
        requestId,
        cancelled:true,
        error:message
      });

      pending.set(requestId,resolver);

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (
            settled ||
            pending.get(requestId) !== resolver
          ) {
            return;
          }

          settled = true;
          pending.delete(requestId);
          reject(new Error(timeoutMessage));
        },timeoutMs);
      }
    });
  }

  function cancelPending(
    message="Network authority service reloaded."
  ) {
    for (const resolver of [...pending.values()]) {
      try {
        resolver?.cancel?.(message);
      } catch {}
    }

    pending.clear();
  }

  function userOwnsActor(user,actor) {
    if (!user || !actor) return false;
    if (user.isGM) return true;

    const ownerLevel = Number(
      globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ??
      3
    );

    try {
      if (typeof actor.testUserPermission === "function") {
        return actor.testUserPermission(user,ownerLevel);
      }
    } catch {}

    const ownership =
      actor?.ownership ??
      actor?.permission ??
      {};

    const level = Number(
      ownership?.[user.id] ??
      ownership?.default ??
      0
    );

    return Number.isFinite(level) && level >= ownerLevel;
  }

  async function validateRemoteDeviceCommand({
    payload,
    actor,
    device,
    actions
  }) {
    const user = game.users?.get?.(payload.userId) ?? null;

    if (!user?.active) {
      throw new Error("Requesting player is no longer online.");
    }

    if (!userOwnsActor(user,actor)) {
      throw new Error("Requesting player does not own the operator Actor.");
    }

    if (String(device?.sceneId ?? "") !== String(payload.sceneId ?? "")) {
      throw new Error("Network Device Scene mismatch.");
    }

    const capability = String(payload.capability ?? "").trim().toUpperCase();

    if (!device?.capabilities?.includes?.(capability)) {
      throw new Error("Network Device does not expose that capability.");
    }

    const discoveredBy = Array.isArray(device?.discoveredBy)
      ? device.discoveredBy.map(String)
      : [];

    if (
      discoveredBy.length &&
      !discoveredBy.includes(String(user.id))
    ) {
      throw new Error("Network Device has not been discovered by that player.");
    }

    // GM scans can see Secret Doors that a player cannot. Re-check the real
    // Wall here so a forged socket command cannot reveal/control a secret door.
    const source = await actions?.resolveSource?.(device);
    const sourceType = String(
      source?.documentName ??
      device?.sourceType ??
      ""
    );

    if (/Wall/i.test(sourceType)) {
      const doorType = Number(
        source?.door ??
        source?._source?.door ??
        0
      );

      const secretType = Number(
        globalThis.CONST?.WALL_DOOR_TYPES?.SECRET ??
        2
      );

      if (
        doorType === secretType &&
        !discoveredBy.includes(String(user.id))
      ) {
        throw new Error("Secret Door has not been discovered by that player.");
      }
    }

    return {user,capability};
  }

  function randomID() {
    const foundryId =
      globalThis.foundry?.utils?.randomID?.();

    const cryptoId =
      globalThis.crypto?.randomUUID?.();

    return (
      foundryId ??
      cryptoId ??
      String(Date.now()) + Math.random().toString(36).slice(2)
    );
  }

  function emit(kind,payload) {
    game.socket?.emit?.(
      CHANNEL,
      {
        [MARKER]:true,
        kind,
        payload
      }
    );
  }

  function element(tag,className="",text="") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== "") node.textContent = text;
    return node;
  }

  function labeledControl(labelText,control) {
    const label = element("label","nda-field");
    const title = element("span","nda-field-label",labelText);
    label.append(title,control);
    return label;
  }

  function makeTypeSelect(selectedType) {
    const select = document.createElement("select");
    select.dataset.ndaType = "1";

    for (const [key,def] of Object.entries(devices.types)) {
      const scope = def.defaultScope ?? "endpoint";
      const option = document.createElement("option");
      option.value = key;
      option.selected = key === selectedType;
      option.textContent =
        def.label + " // DC " + devices.suggestedDC(key,scope);
      select.appendChild(option);
    }

    return select;
  }

  function makeScopeSelect(type,selectedScope=null) {
    const select = document.createElement("select");
    select.dataset.ndaScope = "1";

    const normalized = devices.normalizeScope(
      selectedScope,
      type
    );

    for (const [key,def] of Object.entries(devices.accessScopes ?? {})) {
      const option = document.createElement("option");
      option.value = key;
      option.selected = key === normalized;
      option.textContent =
        def.label +
        " // " +
        (Number(def.dcMod) >= 0 ? "+" : "") +
        Number(def.dcMod ?? 0) +
        " DC";
      select.appendChild(option);
    }

    return select;
  }

  function makeRequestCard(request) {
    const card = element("article","nda-request");
    card.dataset.requestId = request.id;

    const suggested = request.suggestedType || "door";
    const user = game.users?.get?.(request.userId);

    const meta = element("div","nda-meta");
    meta.append(
      element("small","","PROBE REQUEST"),
      element("b","",user?.name ?? request.userName ?? "PLAYER"),
      element(
        "span",
        "",
        "SCENE // " +
          (game.scenes?.get?.(request.sceneId)?.name ?? request.sceneId)
      ),
      element(
        "span",
        "",
        "POSITION // " +
          Number(request.xPct).toFixed(1) +
          " / " +
          Number(request.yPct).toFixed(1)
      )
    );

    const typeSelect = makeTypeSelect(suggested);
    const scopeSelect = makeScopeSelect(
      suggested,
      request.accessScope ?? null
    );

    const nameInput = document.createElement("input");
    nameInput.dataset.ndaName = "1";
    nameInput.value = String(request.label ?? "");
    nameInput.placeholder = "OPTIONAL LABEL";

    const dcInput = document.createElement("input");
    dcInput.dataset.ndaDc = "1";
    dcInput.type = "number";
    dcInput.min = "0";
    dcInput.max = "30";
    dcInput.step = "1";
    dcInput.value = String(
      devices.suggestedDC(
        suggested,
        scopeSelect.value
      )
    );

    const security = element("div","nda-security");
    for (const value of [
      "10 BASIC",
      "12 SECURED",
      "14 HARDENED",
      "16 CENTRAL",
      "18 CORE",
      "20+ EXCEPTIONAL"
    ]) {
      security.appendChild(element("span","",value));
    }

    const actions = element("div","nda-actions");

    const deny = element("button","","DENY");
    deny.type = "button";
    deny.dataset.ndaAction = "deny";

    const approve = element("button","","APPROVE DEVICE");
    approve.type = "button";
    approve.dataset.ndaAction = "approve";

    actions.append(deny,approve);

    card.append(
      meta,
      labeledControl("DEVICE TYPE",typeSelect),
      labeledControl("ACCESS SCOPE",scopeSelect),
      labeledControl("NETWORK LABEL",nameInput),
      labeledControl("SECURITY DC",dcInput),
      security,
      actions
    );

    const refreshSuggestedDC = () => {
      const type = typeSelect.value;
      const currentScope = scopeSelect.value;
      const typeDefaultScope =
        devices.typeDef(type)?.defaultScope ??
        "endpoint";

      // When the user changes DEVICE TYPE, move the scope to that type's
      // normal control breadth rather than keeping an unrelated old scope.
      if (document.activeElement === typeSelect) {
        scopeSelect.value = devices.normalizeScope(
          typeDefaultScope,
          type
        );
      }

      dcInput.value = String(
        devices.suggestedDC(
          type,
          scopeSelect.value
        )
      );
    };

    typeSelect.addEventListener("change",refreshSuggestedDC);
    scopeSelect.addEventListener("change",refreshSuggestedDC);

    return card;
  }

  function renderQueue() {
    document.getElementById(ROOT_ID)?.remove();

    if (!game.user?.isGM || !queue.size) return;

    const root = element("section");
    root.id = ROOT_ID;

    const shell = element("div","nda-shell");
    const head = element("header","nda-head");
    const title = element("div");

    title.append(
      element("small","","NETWORK APPROVAL QUEUE"),
      element(
        "b",
        "",
        queue.size +
          " REQUEST" +
          (queue.size === 1 ? "" : "S")
      )
    );

    const close = element("button","","×");
    close.type = "button";
    close.dataset.ndaAction = "close";

    head.append(title,close);

    const list = element("div","nda-list");

    for (const request of queue.values()) {
      list.appendChild(makeRequestCard(request));
    }

    shell.append(head,list);
    root.appendChild(shell);
    document.body.appendChild(root);

    root.addEventListener("click",async event => {
      const button = event.target?.closest?.("[data-nda-action]");
      if (!button) return;

      const action = button.dataset.ndaAction;

      if (action === "close") {
        root.remove();
        return;
      }

      const card = button.closest(".nda-request");
      const requestId = card?.dataset?.requestId;
      const request = queue.get(requestId);

      if (!card || !request) return;

      if (action === "deny") {
        queue.delete(requestId);

        const response = {
          requestId,
          userId:request.userId,
          decision:"denied",
          gmId:game.user.id
        };

        emit("probeResolved",response);

        // Socket echo behavior can differ by host/proxy. If the GM created
        // their own probe, settle its local Promise immediately as well.
        pending.get(requestId)?.(response);

        renderQueue();
        return;
      }

      if (action !== "approve") return;
      if (button.dataset.busy === "1") return;

      button.dataset.busy = "1";
      button.disabled = true;

      const type =
        card.querySelector("[data-nda-type]")?.value ??
        request.suggestedType ??
        "door";

      const accessScope =
        card.querySelector("[data-nda-scope]")?.value ??
        devices.typeDef(type)?.defaultScope ??
        "endpoint";

      const securityDC =
        Number(card.querySelector("[data-nda-dc]")?.value);

      const enteredName =
        card.querySelector("[data-nda-name]")?.value?.trim?.() ??
        "";

      const def = devices.typeDef(type);

      try {
        const record = await devices.upsertCustomDevice(
          request.sceneId,
          {
            id:"probe:" + request.id,
            type,
            name:enteredName || def.label + " NODE",
            xPct:request.xPct,
            yPct:request.yPct,
            accessScope,
            securityDC:Number.isFinite(securityDC)
              ? securityDC
              : devices.suggestedDC(type,accessScope),
            capabilities:devices.defaultCapabilities(type),
            discoveredBy:[request.userId],
            origin:"probe",
            metadata:{
              requestId:request.id,
              requesterId:request.userId,
              approvedBy:game.user.id,
              approvedAt:new Date().toISOString(),
              accessScope
            }
          }
        );

        queue.delete(requestId);

        const response = {
          requestId,
          userId:request.userId,
          decision:"approved",
          gmId:game.user.id,
          record
        };

        emit("probeResolved",response);
        pending.get(requestId)?.(response);

        ui.notifications?.info?.(
          "NETWORK DEVICE APPROVED // " +
          record.name +
          " // " +
          (record.accessScopeLabel ?? "ENDPOINT") +
          " // DC " +
          record.securityDC
        );

        renderQueue();
      } catch (err) {
        console.error("FEHA NETWORK APPROVAL failed",err);
        ui.notifications?.error?.("Could not approve Network Device.");
        button.disabled = false;
        delete button.dataset.busy;
      }
    });
  }

  async function receive(message) {
    if (!message?.[MARKER]) return;

    const kind = message.kind;
    const payload = message.payload ?? {};

    if (kind === "probeRequest") {
      if (!isAuthorityFor(payload)) return;
      queue.set(payload.id,payload);
      renderQueue();
      return;
    }

    if (kind === "probeResolved") {
      if (game.user?.isGM) {
        queue.delete(payload.requestId);
        renderQueue();
      }

      if (String(payload.userId ?? "") !== String(game.user?.id ?? "")) {
        return;
      }

      const resolver = pending.get(payload.requestId);

      if (resolver) {
        resolver(payload);
      }

      if (payload.userId === game.user?.id) {
        if (payload.decision === "approved") {
          ui.notifications?.info?.(
            "NETWORK PROBE APPROVED // " +
            (payload.record?.name ?? "DEVICE")
          );
        } else {
          ui.notifications?.warn?.("NETWORK PROBE DENIED");
        }
      }

      return;
    }

    if (kind === "deviceCommandRequest") {
      if (!isAuthorityFor(payload)) return;

      try {
        const actions = core.module("deviceActions");
        const actor = game.actors?.get?.(payload.actorId) ?? null;
        const device = devices
          .scanScene(game.scenes?.get?.(payload.sceneId))
          .find(entry => entry.id === payload.deviceId) ?? null;

        if (!actions || !actor || !device) {
          throw new Error("Device command context is no longer available.");
        }

        const validated = await validateRemoteDeviceCommand({
          payload,
          actor,
          device,
          actions
        });

        const result = await actions.executeCapability(
          actor,
          device,
          validated.capability,
          {
            skipBreach:true,
            remote:true,
            requestingUserId:validated.user.id
          }
        );

        emit("deviceCommandResolved",{
          requestId:payload.requestId,
          userId:payload.userId,
          result
        });
      } catch (err) {
        console.error("FEHA NETWORK device command failed",err);

        emit("deviceCommandResolved",{
          requestId:payload.requestId,
          userId:payload.userId,
          error:String(err?.message ?? err)
        });
      }

      return;
    }

    if (kind === "deviceCommandResolved") {
      if (String(payload.userId ?? "") !== String(game.user?.id ?? "")) {
        return;
      }

      const resolver = pending.get(payload.requestId);

      if (resolver) {
        resolver(payload);
      }

      return;
    }

    if (kind === "revealRequest") {
      if (!isAuthorityFor(payload)) return;

      try {
        const count = await devices.revealCustomDevices(
          payload.sceneId,
          payload.userId
        );

        emit("revealResolved",{
          requestId:payload.requestId,
          sceneId:payload.sceneId,
          userId:payload.userId,
          count,
          gmId:game.user.id
        });
      } catch (err) {
        console.error("FEHA NETWORK reveal request failed",err);

        emit("revealResolved",{
          requestId:payload.requestId,
          sceneId:payload.sceneId,
          userId:payload.userId,
          count:0,
          error:String(err?.message ?? err),
          gmId:game.user.id
        });
      }

      return;
    }

    if (kind === "revealResolved") {
      if (String(payload.userId ?? "") !== String(game.user?.id ?? "")) {
        return;
      }

      const resolver = pending.get(payload.requestId);

      if (resolver) {
        resolver(payload);
      }

      if (payload.userId === game.user?.id && !payload.error) {
        ui.notifications?.info?.(
          "NETWORK MAP UPDATED // " +
          Number(payload.count ?? 0) +
          " DEVICE" +
          (Number(payload.count ?? 0) === 1 ? "" : "S") +
          " REVEALED"
        );
      }
    }
  }

  async function requestProbe({
    sceneId=canvas?.scene?.id,
    xPct,
    yPct,
    suggestedType="door",
    label=""
  }={}) {
    if (!sceneId) {
      throw new Error("No active Scene for Network Probe.");
    }

    const rawX = Number(xPct);
    const rawY = Number(yPct);

    if (
      !Number.isFinite(rawX) ||
      !Number.isFinite(rawY)
    ) {
      throw new Error("Network Probe requires valid map coordinates.");
    }

    const authority =
      game.user?.isGM
        ? game.user
        : requireOnlineGM();

    const request = {
      id:randomID(),
      sceneId,
      xPct:Math.max(0,Math.min(100,rawX)),
      yPct:Math.max(0,Math.min(100,rawY)),
      suggestedType:String(suggestedType || "door"),
      label:String(label || ""),
      userId:game.user.id,
      userName:game.user.name,
      gmId:authority.id,
      createdAt:new Date().toISOString()
    };

    const resolution = createPendingResolution(
      request.id,
      {
        timeoutMs:PROBE_TIMEOUT_MS,
        timeoutMessage:"Network Probe timed out waiting for GM approval."
      }
    );

    if (game.user?.isGM) {
      queue.set(request.id,request);
      renderQueue();
    }

    emit("probeRequest",request);

    ui.notifications?.info?.(
      "NETWORK PROBE SENT // GM APPROVAL REQUIRED"
    );

    return {request,resolution};
  }

  async function requestDeviceCommand({
    actorId,
    sceneId=canvas?.scene?.id,
    deviceId,
    capability
  }={}) {
    if (!actorId || !sceneId || !deviceId || !capability) {
      throw new Error("Device command request is incomplete.");
    }

    const authority = requireOnlineGM();
    const requestId = randomID();

    const resolution = createPendingResolution(
      requestId,
      {
        timeoutMs:COMMAND_TIMEOUT_MS,
        timeoutMessage:"Network Device command timed out waiting for GM authority."
      }
    );

    emit("deviceCommandRequest",{
      requestId,
      actorId,
      sceneId,
      deviceId,
      capability,
      userId:game.user.id,
      gmId:authority.id
    });

    const payload = await resolution;

    if (payload?.error) {
      throw new Error(payload.error);
    }

    return payload?.result ?? null;
  }

  async function requestReveal(
    sceneId=canvas?.scene?.id,
    userId=game.user?.id
  ) {
    if (!sceneId || !userId) {
      throw new Error("Network reveal requires Scene and User.");
    }

    if (
      !game.user?.isGM &&
      String(userId) !== String(game.user?.id)
    ) {
      throw new Error(
        "A player may only request Network reveal for their own user."
      );
    }

    if (game.user?.isGM) {
      return {
        count:await devices.revealCustomDevices(sceneId,userId),
        local:true
      };
    }

    const authority = requireOnlineGM();
    const requestId = randomID();

    const resolution = createPendingResolution(
      requestId,
      {
        timeoutMs:COMMAND_TIMEOUT_MS,
        timeoutMessage:"Network reveal timed out waiting for GM authority."
      }
    );

    emit("revealRequest",{
      requestId,
      sceneId,
      userId,
      gmId:authority.id
    });

    return resolution;
  }

  const api = {
    version:VERSION,
    requestProbe,
    requestDeviceCommand,
    requestReveal,
    queue,
    renderQueue,

    async init() {
      if (socketHandler) {
        try {
          game.socket?.off?.(CHANNEL,socketHandler);
        } catch {}
      }

      socketHandler = receive;
      game.socket?.on?.(CHANNEL,socketHandler);
      console.log("FEHA NETWORK APPROVALS",VERSION,"ready");
    },

    async destroy() {
      if (socketHandler) {
        try {
          game.socket?.off?.(CHANNEL,socketHandler);
        } catch {}
      }

      socketHandler = null;
      queue.clear();
      cancelPending();
      document.getElementById(ROOT_ID)?.remove();

      if (globalThis.FEHA_NETWORK_APPROVALS === api) {
        delete globalThis.FEHA_NETWORK_APPROVALS;
      }
    }
  };

  core.registerModule("deviceApprovals",api);
  globalThis.FEHA_NETWORK_APPROVALS = api;
})();
