// FEHA // NETWORK DEVICE APPROVALS
// Player probe requests -> online GM approval queue.
// Keeps unknown-map information authoritative to the GM.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  const devices = core?.module?.("devices");

  if (!core || !devices) {
    throw new Error("FEHA_NETWORK_APPROVALS requires Cyber Core + Network Devices.");
  }

  const VERSION = "0.9.0";
  const CHANNEL = "module.flesh-enshrouded-heart-ablaze";
  const MARKER = "fehaNetworkDevicesV1";
  const ROOT_ID = "feha-network-approval-queue";
  const queue = new Map();
  const pending = new Map();
  let socketHandler = null;

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
      const option = document.createElement("option");
      option.value = key;
      option.selected = key === selectedType;
      option.textContent =
        def.label + " // DC " + devices.suggestedDC(key);
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
    dcInput.value = String(devices.suggestedDC(suggested));

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
      labeledControl("NETWORK LABEL",nameInput),
      labeledControl("SECURITY DC",dcInput),
      security,
      actions
    );

    typeSelect.addEventListener("change",() => {
      dcInput.value = String(devices.suggestedDC(typeSelect.value));
    });

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

        emit("probeResolved",{
          requestId,
          userId:request.userId,
          decision:"denied",
          gmId:game.user.id
        });

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
            securityDC:Number.isFinite(securityDC)
              ? securityDC
              : devices.suggestedDC(type),
            capabilities:devices.defaultCapabilities(type),
            discoveredBy:[request.userId],
            origin:"probe",
            metadata:{
              requestId:request.id,
              requesterId:request.userId,
              approvedBy:game.user.id,
              approvedAt:new Date().toISOString()
            }
          }
        );

        queue.delete(requestId);

        emit("probeResolved",{
          requestId,
          userId:request.userId,
          decision:"approved",
          gmId:game.user.id,
          record
        });

        ui.notifications?.info?.(
          "NETWORK DEVICE APPROVED // " +
          record.name +
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

  function receive(message) {
    if (!message?.[MARKER]) return;

    const kind = message.kind;
    const payload = message.payload ?? {};

    if (kind === "probeRequest") {
      if (!game.user?.isGM) return;
      queue.set(payload.id,payload);
      renderQueue();
      return;
    }

    if (kind === "probeResolved") {
      queue.delete(payload.requestId);
      renderQueue();

      const resolver = pending.get(payload.requestId);

      if (resolver) {
        pending.delete(payload.requestId);
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

    const request = {
      id:randomID(),
      sceneId,
      xPct:Number(xPct),
      yPct:Number(yPct),
      suggestedType:String(suggestedType || "door"),
      label:String(label || ""),
      userId:game.user.id,
      userName:game.user.name,
      createdAt:new Date().toISOString()
    };

    if (
      !Number.isFinite(request.xPct) ||
      !Number.isFinite(request.yPct)
    ) {
      throw new Error("Network Probe requires valid map coordinates.");
    }

    const resolution = new Promise(resolve => {
      pending.set(request.id,resolve);
    });

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

  const api = {
    version:VERSION,
    requestProbe,
    queue,
    renderQueue,

    async init() {
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
      pending.clear();
      document.getElementById(ROOT_ID)?.remove();

      if (globalThis.FEHA_NETWORK_APPROVALS === api) {
        delete globalThis.FEHA_NETWORK_APPROVALS;
      }
    }
  };

  core.registerModule("deviceApprovals",api);
  globalThis.FEHA_NETWORK_APPROVALS = api;
})();
