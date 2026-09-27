// FEHA // CAMERA PLACEMENT
// Clean 0.10.x camera baseline.
// Owns only GM camera placement. No feeds, POV, rotation, or camera hacking UI.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;

  if (!core) {
    throw new Error("FEHA_CAMERA_PLACEMENT requires FEHA_CYBER_CORE.");
  }

  const VERSION = "0.10.0";
  const ROOT_ID = "feha-camera-placement";
  const STYLE_ID = "feha-camera-placement-style";

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function sceneBackground(scene) {
    return (
      scene?.background?.src ??
      scene?._source?.background?.src ??
      scene?.img ??
      scene?._source?.img ??
      ""
    );
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        --fcp-cyan:92,239,255;
        --fcp-yellow:255,216,84;
        position:fixed;
        inset:0;
        z-index:140000;
        display:grid;
        grid-template-rows:auto minmax(0,1fr);
        color:#eaffff;
        background:#010507;
        font-family:"Share Tech Mono","Consolas",monospace;
      }

      #${ROOT_ID} * {
        box-sizing:border-box;
      }

      #${ROOT_ID} .fcp-head {
        min-height:86px;
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:center;
        gap:16px;
        padding:14px 20px;
        background:#02090b;
        border-bottom:1px solid rgba(var(--fcp-cyan),.22);
      }

      #${ROOT_ID} .fcp-head small,
      #${ROOT_ID} .fcp-head b,
      #${ROOT_ID} .fcp-head span {
        display:block;
      }

      #${ROOT_ID} .fcp-head small {
        color:rgb(var(--fcp-yellow));
        font-size:8px;
        letter-spacing:1.4px;
      }

      #${ROOT_ID} .fcp-head b {
        margin-top:4px;
        color:#fff;
        font-size:20px;
        letter-spacing:1px;
      }

      #${ROOT_ID} .fcp-head span {
        margin-top:4px;
        color:#6f878d;
        font-size:8px;
      }

      #${ROOT_ID} .fcp-close {
        width:132px;
        height:44px;
        color:rgb(var(--fcp-cyan));
        background:#03090b;
        border:1px solid rgba(var(--fcp-cyan),.28);
        border-radius:0;
        font:900 8px "Share Tech Mono","Consolas",monospace;
        letter-spacing:1px;
        cursor:pointer;
      }

      #${ROOT_ID} .fcp-stage {
        min-height:0;
        padding:18px;
        background:
          linear-gradient(rgba(var(--fcp-cyan),.025) 1px,transparent 1px),
          linear-gradient(90deg,rgba(var(--fcp-cyan),.02) 1px,transparent 1px),
          #010507;
        background-size:36px 36px;
      }

      #${ROOT_ID} .fcp-map {
        position:relative;
        width:100%;
        height:100%;
        min-height:0;
        display:block;
        margin:0;
        padding:0;
        overflow:hidden;
        background:#020709;
        border:1px solid rgba(var(--fcp-cyan),.22);
        border-top-color:rgba(var(--fcp-yellow),.42);
        border-radius:0;
        cursor:crosshair;
      }

      #${ROOT_ID} .fcp-map img {
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        object-fit:fill;
        pointer-events:none;
        opacity:.72;
        filter:saturate(.58) brightness(.72) contrast(1.18);
      }

      #${ROOT_ID} .fcp-map::after {
        content:"CLICK ONCE TO PLACE CAMERA";
        position:absolute;
        left:50%;
        top:16px;
        transform:translateX(-50%);
        padding:8px 12px;
        color:#050708;
        background:rgb(var(--fcp-yellow));
        border:1px solid rgba(255,241,170,.65);
        font-size:8px;
        font-weight:900;
        letter-spacing:1px;
        pointer-events:none;
      }

      #${ROOT_ID} .fcp-map.is-busy {
        pointer-events:none;
        cursor:wait;
      }
    `;

    document.head.appendChild(style);
  }

  function close() {
    document.getElementById(ROOT_ID)?.remove();
  }

  async function persistCamera(scene,actor,xPct,yPct) {
    const devices = core.module("devices");

    if (!devices?.upsertCustomDevice) {
      throw new Error("Network Device persistence is unavailable.");
    }

    const type = "camera";
    const accessScope =
      devices.typeDef?.(type)?.defaultScope ??
      "endpoint";

    const securityDC =
      devices.suggestedDC?.(type,accessScope) ??
      11;

    const existing = devices.scanScene?.(scene) ?? [];
    const cameraCount = existing.filter(device => device.type === "camera").length;

    return devices.upsertCustomDevice(
      scene.id,
      {
        type,
        name:"CAMERA "+String(cameraCount+1).padStart(2,"0"),
        xPct,
        yPct,
        accessScope,
        securityDC,
        capabilities:[],
        discoveredBy:[],
        origin:"gm-camera-placement",
        metadata:{
          authoredBy:game.user.id,
          authoredAt:new Date().toISOString(),
          operatorActorId:actor?.id ?? null
        }
      }
    );
  }

  function open({actor=null}={}) {
    if (!game.user?.isGM) {
      ui?.notifications?.warn?.("Only the GM can place Cameras.");
      return null;
    }

    const scene = canvas?.scene;
    if (!scene) {
      ui?.notifications?.warn?.("No active Scene is available.");
      return null;
    }

    const background = sceneBackground(scene);
    if (!background) {
      ui?.notifications?.warn?.("Active Scene has no background image.");
      return null;
    }

    injectStyle();
    close();

    const root = document.createElement("section");
    root.id = ROOT_ID;
    root.innerHTML =
      '<header class="fcp-head">'+
        '<div>'+
          '<small>FEHA // CAMERA PLACEMENT 0.10.0</small>'+
          '<b>'+esc(scene.name ?? "ACTIVE SCENE")+'</b>'+
          '<span>CLICK THE SCENE IMAGE ONCE. NOTHING ELSE HAPPENS HERE.</span>'+
        '</div>'+
        '<button type="button" class="fcp-close" data-fcp-action="close">CANCEL</button>'+
      '</header>'+
      '<main class="fcp-stage">'+
        '<button type="button" class="fcp-map" data-fcp-action="place">'+
          '<img src="'+esc(background)+'" alt="">'+
        '</button>'+
      '</main>';

    document.body.appendChild(root);

    root.addEventListener("click",async event => {
      const control = event.target?.closest?.("[data-fcp-action]");
      if (!control || !root.contains(control)) return;

      const action = control.dataset.fcpAction;

      if (action === "close") {
        close();
        return;
      }

      if (action !== "place") return;
      if (control.classList.contains("is-busy")) return;

      const rect = control.getBoundingClientRect();
      const xPct = Math.max(
        0,
        Math.min(100,((event.clientX-rect.left)/Math.max(1,rect.width))*100)
      );
      const yPct = Math.max(
        0,
        Math.min(100,((event.clientY-rect.top)/Math.max(1,rect.height))*100)
      );

      control.classList.add("is-busy");

      ui?.notifications?.info?.(
        "CAMERA CLICK // "+
        xPct.toFixed(1)+"%, "+
        yPct.toFixed(1)+"%"
      );

      try {
        const record = await persistCamera(scene,actor,xPct,yPct);

        ui?.notifications?.info?.(
          "CAMERA CREATED // "+
          record.name+
          " // DC "+
          record.securityDC
        );

        close();
      } catch (err) {
        control.classList.remove("is-busy");
        console.error("FEHA camera placement failed",err);
        ui?.notifications?.error?.(
          "Camera placement failed: "+
          String(err?.message ?? err)
        );
      }
    });

    return root;
  }

  const api = {
    version:VERSION,
    open,
    close,
    async init() {
      injectStyle();
      console.log("FEHA CAMERA PLACEMENT",VERSION,"ready");
    },
    async destroy() {
      close();
      document.getElementById(STYLE_ID)?.remove();
    }
  };

  core.register("cameraPlacement",api);
})();
