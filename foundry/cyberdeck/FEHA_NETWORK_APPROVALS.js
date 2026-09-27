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

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  function randomID() {
    return (
      foundry?.utils?.randomID?.() ??
      crypto?.randomUUID?.() ??
      String(Date.now())+Math.random().toString(36).slice(2)
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

  function removeRequest(id) {
    queue.delete(id);
    renderQueue();
  }

  function typeOptions(selected="door") {
    return Object.entries(devices.types)
      .map(([key,def]) =>
        '<option value="'+esc(key)+'" '+(key===selected?"selected":"")+"> '+
          esc(def.label)+
          ' // DC '+devices.suggestedDC(key)+
        '</option>'
      )
      .join("");
  }

  function renderQueue() {
    document.getElementById(ROOT_ID)?.remove();

    if (!game.user?.isGM || !queue.size) return;

    const root = document.createElement("section");
    root.id = ROOT_ID;

    root.innerHTML =
      '<div class="nda-shell">'+
        '<header class="nda-head">'+
          '<div><small>NETWORK APPROVAL QUEUE</small><b>'+
            queue.size+' REQUEST'+(queue.size===1?"":"S")+
          '</b></div>'+
          '<button type="button" data-nda-action="close">×</button>'+
        '</header>'+
        '<div class="nda-list">'+
          [...queue.values()].map(request => {
            const suggested = request.suggestedType ?? "door";
            const dc = devices.suggestedDC(suggested);
            const user = game.users?.get?.(request.userId);

            return (
              '<article class="nda-request" data-request-id="'+esc(request.id)+'">'+
                '<div class="nda-meta">'+
                  '<small>PROBE REQUEST</small>'+
                  '<b>'+esc(user?.name ?? request.userName ?? "PLAYER")+'</b>'+
                  '<span>SCENE // '+esc(game.scenes?.get?.(request.sceneId)?.name ?? request.sceneId)+'</span>'+
                  '<span>POSITION // '+Number(request.xPct).toFixed(1)+' / '+Number(request.yPct).toFixed(1)+'</span>'+
                '</div>'+
                '<label>DEVICE TYPE<select data-nda-type>'+typeOptions(suggested)+'</select></label>'+
                '<label>NETWORK LABEL<input data-nda-name value="'+esc(request.label ?? "")+'" placeholder="OPTIONAL LABEL"></label>'+
                '<label>SECURITY DC<input data-nda-dc type="number" min="0" max="30" step="1" value="'+dc+'"></label>'+
                '<div class="nda-security">'+
                  '<span>10 BASIC</span><span>12 SECURED</span><span>14 HARDENED</span>'+
                  '<span>16 CENTRAL</span><span>18 CORE</span><span>20+ EXCEPTIONAL</span>'+
                '</div>'+
                '<div class="nda-actions">'+
                  '<button type="button" data-nda-action="deny">DENY</button>'+
                  '<button type="button" data-nda-action="approve">APPROVE DEVICE</button>'+
                '</div>'+
              '</article>'
            );
          }).join("")+
        '</div>'+
      '</div>';

    document.body.appendChild(root);

    root.onchange = event => {
      const select = event.target?.closest?.("[data-nda-type]");
      if (!select) return;

      const card = select.closest(".nda-request");
      const dc = card?.querySelector?.("[data-nda-dc]");

      if (dc) {
        dc.value = String(devices.suggestedDC(select.value));
      }
    };

    root.onclick = async event => {
      const button = event.target?.closest?.("[data-nda-action]");
      if (!button) return;

      const action = button.dataset.ndaAction;

      if (action === "close") {
        root.remove();
        return;
      }

      const card = button.closest(".nda-request");
      const id = card?.dataset?.requestId;
      const request = queue.get(id);
      if (!card || !request) return;

      if (action === "deny") {
        queue.delete(id);

        emit("probeResolved",{
          requestId:id,
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
            id:"probe:"+request.id,
            type,
            name:enteredName || def.label+" NODE",
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

        queue.delete(id);

        emit("probeResolved",{
          requestId:id,
          userId:request.userId,
          decision:"approved",
          gmId:game.user.id,
          record
        });

        ui.notifications?.info?.(
          "NETWORK DEVICE APPROVED // "+record.name+
          " // DC "+record.securityDC
        );

        renderQueue();
      } catch (err) {
        console.error("FEHA NETWORK APPROVAL failed",err);
        ui.notifications?.error?.("Could not approve Network Device.");
        button.disabled = false;
        delete button.dataset.busy;
      }
    };
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
            "NETWORK PROBE APPROVED // "+
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
    if (!sceneId) throw new Error("No active Scene for Network Probe.");

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

    const promise = new Promise(resolve => {
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

    return {
      request,
      resolution:promise
    };
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
        try { game.socket?.off?.(CHANNEL,socketHandler); } catch {}
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
