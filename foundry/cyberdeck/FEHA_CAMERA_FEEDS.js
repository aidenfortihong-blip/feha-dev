// FEHA // CAMERA FEEDS
// Specialized Network Device adapter.
// Camera mechanics and camera POV live here, not in JACK IN or device core.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;

  if (!core) {
    throw new Error("FEHA_CAMERA_FEEDS requires FEHA_CYBER_CORE.");
  }

  const VERSION = "0.9.1";
  const HUD_ID = "feha-camera-feed-hud";
  const feeds = new Map();
  const unsubscribers = [];

  let activeSource = null;
  let activeFeed = null;
  let suppressedSources = [];

  function feedKey(actorId,deviceId) {
    return String(actorId) + "::" + String(deviceId);
  }

  function listFeeds(actor,device) {
    return [
      ...(feeds.get(feedKey(actor?.id,device?.id)) ?? [])
    ];
  }

  function scenePoint(scene,xPct,yPct) {
    const rect =
      scene?.dimensions?.sceneRect ??
      canvas?.dimensions?.sceneRect ??
      {x:0,y:0,width:1,height:1};

    return {
      x:
        Number(rect.x ?? 0) +
        (Number(xPct)/100)*Math.max(1,Number(rect.width)||1),
      y:
        Number(rect.y ?? 0) +
        (Number(yPct)/100)*Math.max(1,Number(rect.height)||1)
    };
  }

  function randomID() {
    return (
      globalThis.foundry?.utils?.randomID?.() ??
      globalThis.crypto?.randomUUID?.() ??
      String(Date.now())+Math.random().toString(36).slice(2)
    );
  }

  function allVisionSources() {
    const collection =
      canvas?.effects?.visionSources ??
      canvas?.visibility?.visionSources ??
      null;

    if (!collection) return [];

    try {
      if (typeof collection.values === "function") {
        return [...collection.values()];
      }

      return [...collection];
    } catch {
      return [];
    }
  }

  function refreshVision() {
    try { canvas?.visibility?.refreshVisibility?.(); } catch {}
    try { canvas?.visibility?.refresh?.(); } catch {}
    try { canvas?.perception?.update?.({refreshVision:true},{force:true}); } catch {}
  }

  function restoreSuppressedSources() {
    for (const source of suppressedSources) {
      try {
        if (source?.suppression) {
          delete source.suppression.fehaCameraFeed;
        }
        source?.refresh?.();
      } catch {}
    }

    suppressedSources = [];
  }

  function removeActiveSource() {
    if (activeSource) {
      try { activeSource.remove?.(); } catch {}
      try { activeSource.destroy?.(); } catch {}
      activeSource = null;
    }

    restoreSuppressedSources();
    refreshVision();
  }

  function closeHUD({returnToNet=true}={}) {
    document.getElementById(HUD_ID)?.remove();

    if (returnToNet) {
      const jack = document.getElementById("feha-jackin-overlay");

      if (jack) {
        jack.style.removeProperty("display");
        jack.removeAttribute("aria-hidden");
      }
    }
  }

  function deactivateFeed({returnToNet=true}={}) {
    removeActiveSource();
    activeFeed = null;
    closeHUD({returnToNet});
  }

  function createVisionSource(feed) {
    const SourceClass =
      globalThis.foundry?.canvas?.sources?.PointVisionSource ??
      globalThis.CONFIG?.Canvas?.visionSourceClass ??
      null;

    if (typeof SourceClass !== "function") {
      throw new Error("Foundry PointVisionSource API is unavailable.");
    }

    const source = new SourceClass({
      sourceId:"feha-camera:"+feed.id
    });

    source.initialize({
      x:feed.x,
      y:feed.y,
      disabled:false,
      preview:false,
      visionMode:"basic",
      attenuation:0.1,
      brightness:0,
      contrast:0.12,
      saturation:-0.55
    });

    return source;
  }

  function renderHUD(actor,device,feed) {
    document.getElementById(HUD_ID)?.remove();

    const all = listFeeds(actor,device);
    const index = Math.max(
      0,
      all.findIndex(candidate => candidate.id === feed.id)
    );

    const root = document.createElement("section");
    root.id = HUD_ID;

    root.innerHTML =
      '<div class="camera-feed-frame">'+
        '<div class="camera-feed-title">'+
          '<small>COMPROMISED SURVEILLANCE</small>'+
          '<b>'+String(feed.label)+'</b>'+
          '<span>'+String(device.name)+' // FEED '+(index+1)+' / '+Math.max(1,all.length)+'</span>'+
        '</div>'+
        '<div class="camera-feed-scan"></div>'+
        '<div class="camera-feed-actions">'+
          '<button type="button" data-camera-action="previous" '+(all.length<2?"disabled":"")+'>PREV</button>'+
          '<button type="button" data-camera-action="next" '+(all.length<2?"disabled":"")+'>NEXT</button>'+
          '<button type="button" data-camera-action="return">RETURN TO NET</button>'+
        '</div>'+
      '</div>';

    document.body.appendChild(root);

    root.onclick = async event => {
      const button = event.target?.closest?.("[data-camera-action]");
      if (!button) return;

      const action = button.dataset.cameraAction;

      if (action === "return") {
        deactivateFeed({returnToNet:true});
        return;
      }

      if (all.length < 2) return;

      const nextIndex =
        action === "previous"
          ? (index-1+all.length)%all.length
          : (index+1)%all.length;

      await activateFeed(actor,device,all[nextIndex]);
    };
  }

  async function activateFeed(actor,device,feed) {
    if (!feed) {
      throw new Error("Camera feed does not exist.");
    }

    if (canvas?.scene?.id !== feed.sceneId) {
      throw new Error("Camera feed belongs to another Scene.");
    }

    removeActiveSource();

    const source = createVisionSource(feed);

    suppressedSources = allVisionSources()
      .filter(candidate => candidate && candidate !== source);

    for (const candidate of suppressedSources) {
      try {
        candidate.suppression ??= {};
        candidate.suppression.fehaCameraFeed = true;
        candidate.refresh?.();
      } catch {}
    }

    source.add();
    source.refresh?.();

    activeSource = source;
    activeFeed = feed;

    refreshVision();

    try {
      await canvas?.animatePan?.({
        x:feed.x,
        y:feed.y,
        scale:Math.max(1,canvas?.stage?.scale?.x ?? 1)
      });
    } catch {}

    const jack = document.getElementById("feha-jackin-overlay");
    if (jack) {
      jack.style.display = "none";
      jack.setAttribute("aria-hidden","true");
    }

    renderHUD(actor,device,feed);

    return feed;
  }

  async function placeFeed({
    actor,
    device,
    xPct,
    yPct
  }={}) {
    const scene = canvas?.scene;

    if (!scene || !actor || !device) {
      throw new Error("Camera placement context is incomplete.");
    }

    const point = scenePoint(scene,xPct,yPct);
    const key = feedKey(actor.id,device.id);
    const current = feeds.get(key) ?? [];

    const feed = {
      id:randomID(),
      sceneId:scene.id,
      actorId:actor.id,
      deviceId:device.id,
      xPct:Number(xPct),
      yPct:Number(yPct),
      x:point.x,
      y:point.y,
      label:
        "CAM // " +
        String(current.length+1).padStart(2,"0"),
      createdAt:new Date().toISOString()
    };

    current.push(feed);
    feeds.set(key,current);

    await core.emit(
      "camera:feedCreated",
      {actor,device,feed}
    );

    await activateFeed(actor,device,feed);

    return feed;
  }

  async function viewLatest(actor,device) {
    const current = listFeeds(actor,device);

    if (!current.length) {
      return {
        handled:true,
        error:"NO CAMERA FEEDS ESTABLISHED"
      };
    }

    const feed = activeFeed &&
      activeFeed.deviceId === device.id &&
      activeFeed.actorId === actor.id
      ? current.find(candidate => candidate.id === activeFeed.id) ?? current[0]
      : current[0];

    await activateFeed(actor,device,feed);

    return {
      handled:true,
      cameraFeed:true,
      feed
    };
  }

  const api = {
    version:VERSION,
    listFeeds,
    placeFeed,
    activateFeed,
    deactivateFeed,
    get activeFeed() {
      return activeFeed;
    },

    async init() {
      unsubscribers.push(
        core.on(
          "device:execute:PLACE_FEED",
          async ({actor,device}) => ({
            handled:true,
            uiMode:"camera-placement",
            deviceId:device.id,
            feedCount:listFeeds(actor,device).length
          })
        )
      );

      unsubscribers.push(
        core.on(
          "device:execute:VIEW_FEED",
          async ({actor,device}) => viewLatest(actor,device)
        )
      );

      console.log("FEHA CAMERA FEEDS",VERSION,"ready");
    },

    async destroy() {
      deactivateFeed({returnToNet:false});

      for (const unsubscribe of unsubscribers.splice(0)) {
        try { unsubscribe(); } catch {}
      }

      feeds.clear();

      if (globalThis.FEHA_CAMERA_FEEDS === api) {
        delete globalThis.FEHA_CAMERA_FEEDS;
      }
    }
  };

  core.registerModule("cameraFeeds",api);
  globalThis.FEHA_CAMERA_FEEDS = api;
})();
