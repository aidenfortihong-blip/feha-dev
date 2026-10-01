// FEHA // CAMERAS
// A GM tool, not a hacking system. When a player gets into a camera (roleplay,
// or a Cyber Check against a DC the GM picks), the GM drops a camera token for
// that player. The player owns it, so they see what it sees.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;

  if (!core) {
    throw new Error("FEHA_CAMERAS requires FEHA_CYBER_CORE.");
  }

  const VERSION = "0.2.0";
  const FLAG_SCOPE = "fleshEnshrouded";
  const ACTOR_FLAG = "cameraActor";
  const TOKEN_FLAG = "cameraToken";
  const CAMERA_FOLDER = "Camera";
  const CAMERA_IMG = "icons/svg/eye.svg";
  const TOKEN_SIZE = 0.5;
  const SIGHT_RANGE_FT = 60;
  const TOOL_NAME = "fehaCamera";

  let controlsHook = null;
  let visionPatch = null;

  const clamp = (n,min,max) =>
    Math.max(min,Math.min(max,Number(n)||0));

  function collectionContents(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  }

  function ownerLevel() {
    return Number(
      globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ??
      3
    );
  }

  function sceneRect(scene) {
    return (
      scene?.dimensions?.sceneRect ??
      (
        canvas?.scene?.id === scene?.id
          ? canvas?.dimensions?.sceneRect
          : null
      ) ??
      {x:0,y:0,width:1,height:1}
    );
  }

  function gridSize(scene) {
    return Math.max(
      1,
      Number(
        scene?.grid?.size ??
        (
          canvas?.scene?.id === scene?.id
            ? canvas?.grid?.size
            : null
        ) ??
        100
      ) || 100
    );
  }

  // Direct reads: getFlag throws for the "fleshEnshrouded" namespace.
  function cameraActorFlag(actor) {
    return actor?.flags?.[FLAG_SCOPE]?.[ACTOR_FLAG] ?? null;
  }

  function cameraTokenFlag(token) {
    return token?.flags?.[FLAG_SCOPE]?.[TOKEN_FLAG] ?? null;
  }

  function isCameraActor(actor) {
    return Boolean(cameraActorFlag(actor)?.enabled);
  }

  function isCameraToken(token) {
    return Boolean(cameraTokenFlag(token)?.enabled);
  }

  function cameraRecord(scene,token) {
    if (!scene || !token || !isCameraToken(token)) return null;

    const flag = cameraTokenFlag(token) ?? {};
    const size = gridSize(scene);
    const rect = sceneRect(scene);
    const width = Math.max(1,Number(rect.width)||1);
    const height = Math.max(1,Number(rect.height)||1);

    const centerX =
      Number(token.x ?? 0) + Number(token.width ?? TOKEN_SIZE)*size/2;
    const centerY =
      Number(token.y ?? 0) + Number(token.height ?? TOKEN_SIZE)*size/2;

    return {
      id:String(token.id),
      tokenId:String(token.id),
      sceneId:String(scene.id),
      ownerUserId:String(flag.ownerUserId ?? ""),
      name:String(token.name ?? "CAMERA"),
      xPct:clamp(((centerX-Number(rect.x??0))/width)*100,0,100),
      yPct:clamp(((centerY-Number(rect.y??0))/height)*100,0,100)
    };
  }

  // Cameras this user may know about: the GM sees all, a player only theirs.
  function scanScene(scene=canvas?.scene) {
    if (!scene) return [];

    return collectionContents(scene.tokens)
      .filter(token =>
        isCameraToken(token) &&
        (game.user?.isGM || token.isOwner)
      )
      .map(token => cameraRecord(scene,token))
      .filter(Boolean);
  }

  async function ensureCameraFolder() {
    const existing = collectionContents(game.folders).find(folder =>
      folder?.type === "Actor" &&
      String(folder?.name ?? "").trim().toLowerCase() ===
        CAMERA_FOLDER.toLowerCase()
    );

    return existing ?? Folder.create({
      name:CAMERA_FOLDER,
      type:"Actor",
      sorting:"a"
    });
  }

  async function ensureCameraActor(user) {
    const folder = await ensureCameraFolder();

    const existing = collectionContents(game.actors).find(actor => {
      const flag = cameraActorFlag(actor);
      return (
        flag?.enabled === true &&
        String(flag.ownerUserId ?? "") === String(user.id)
      );
    });

    if (existing) {
      if (Number(existing.ownership?.[user.id] ?? 0) < ownerLevel()) {
        await existing.update({
          ["ownership."+user.id]:ownerLevel()
        });
      }

      return existing;
    }

    const name = "CAMERA // " + user.name;

    return Actor.create({
      name,
      type:"npc",
      img:CAMERA_IMG,
      folder:folder.id,
      ownership:{
        default:Number(
          globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0
        ),
        [user.id]:ownerLevel()
      },
      flags:{
        [FLAG_SCOPE]:{
          [ACTOR_FLAG]:{
            enabled:true,
            ownerUserId:user.id,
            createdAt:new Date().toISOString()
          }
        }
      },
      prototypeToken:{
        name,
        actorLink:true,
        width:TOKEN_SIZE,
        height:TOKEN_SIZE,
        texture:{src:CAMERA_IMG},
        disposition:0
      }
    },{
      renderSheet:false
    });
  }

  // Middle of what the GM is looking at right now.
  function viewCenter() {
    const pivot = canvas?.stage?.pivot;
    const rect = sceneRect(canvas?.scene);

    return {
      x:Number(pivot?.x ?? (Number(rect.x)+Number(rect.width)/2)),
      y:Number(pivot?.y ?? (Number(rect.y)+Number(rect.height)/2))
    };
  }

  // Drop a camera token for a player on the current scene. The GM then drags
  // it where the camera is and deletes the token when the feed is lost.
  async function placeCameraFor(userId,{x,y}={}) {
    if (!game.user?.isGM) {
      throw new Error("Only the GM can place a camera.");
    }

    const scene = canvas?.scene ?? null;
    const user = game.users?.get?.(userId) ?? null;

    if (!scene || !user) {
      throw new Error("Camera needs an open scene and a player.");
    }

    const actor = await ensureCameraActor(user);
    const center = viewCenter();
    const half = gridSize(scene)*TOKEN_SIZE/2;

    const [token] = await scene.createEmbeddedDocuments("Token",[{
      name:"CAMERA // " + user.name,
      actorId:actor.id,
      actorLink:true,
      x:Math.round(Number(x ?? center.x)-half),
      y:Math.round(Number(y ?? center.y)-half),
      width:TOKEN_SIZE,
      height:TOKEN_SIZE,
      disposition:0,
      texture:{src:actor.img || CAMERA_IMG},
      sight:{
        enabled:true,
        range:SIGHT_RANGE_FT,
        angle:360
      },
      flags:{
        [FLAG_SCOPE]:{
          [TOKEN_FLAG]:{
            enabled:true,
            ownerUserId:user.id,
            createdAt:new Date().toISOString()
          }
        }
      }
    }]);

    ui.notifications?.info?.(
      "Camera placed for " + user.name +
      ". Drag it into position; delete the token to cut the feed."
    );

    return cameraRecord(scene,token);
  }

  async function openPlaceDialog() {
    if (!game.user?.isGM) return null;

    const players = collectionContents(game.users)
      .filter(user => !user.isGM);

    if (!players.length) {
      ui.notifications?.warn?.("There are no players to give a camera to.");
      return null;
    }

    const escape = value =>
      foundry.utils.escapeHTML(String(value ?? ""));

    const options = players
      .map(user =>
        '<option value="'+escape(user.id)+'">'+
        escape(user.name)+
        (user.active ? "" : " (offline)")+
        '</option>'
      )
      .join("");

    const userId = await foundry.applications.api.DialogV2.prompt({
      window:{title:"Place camera"},
      content:
        '<p>The player you pick owns the camera and sees through it. '+
        'It appears in the middle of your view.</p>'+
        '<div class="form-group"><label for="feha-camera-user">Player</label>'+
        '<select id="feha-camera-user" name="user">'+options+'</select></div>',
      ok:{
        label:"Place camera",
        callback:(event,button) => button.form.elements.user.value
      },
      rejectClose:false
    });

    if (!userId) return null;

    try {
      return await placeCameraFor(userId);
    } catch (err) {
      console.error("FEHA CAMERAS // placement failed",err);
      ui.notifications?.error?.(err?.message ?? "Could not place the camera.");
      return null;
    }
  }

  function addControlTool(controls) {
    if (!game.user?.isGM) return;

    const tools = controls?.tokens?.tools;
    if (!tools || tools[TOOL_NAME]) return;

    tools[TOOL_NAME] = {
      name:TOOL_NAME,
      title:"Place camera for a player",
      icon:"fa-solid fa-video",
      order:Object.keys(tools).length,
      button:true,
      visible:true,
      onChange:() => openPlaceDialog()
    };
  }

  // Foundry only uses a player's other owned tokens for vision while they
  // have no token selected. A camera feed should stay on while they play
  // their character, so a player's own camera always counts.
  function patchVision() {
    const proto = CONFIG?.Token?.objectClass?.prototype;
    const original = proto?._isVisionSource;

    if (typeof original !== "function") return;

    const patched = function() {
      if (
        !game.user?.isGM &&
        isCameraToken(this.document) &&
        this.document.isOwner &&
        !this.document.hidden &&
        this.hasSight &&
        canvas?.visibility?.tokenVision
      ) {
        return true;
      }

      return original.call(this);
    };

    proto._isVisionSource = patched;
    visionPatch = {proto,original,patched};
  }

  function unpatchVision() {
    if (
      visionPatch &&
      visionPatch.proto._isVisionSource === visionPatch.patched
    ) {
      visionPatch.proto._isVisionSource = visionPatch.original;
    }

    visionPatch = null;
  }

  function refreshCameraVision() {
    for (const token of canvas?.tokens?.placeables ?? []) {
      if (isCameraToken(token.document)) {
        try { token.initializeVisionSource?.(); } catch {}
      }
    }
  }

  const api = {
    version:VERSION,
    cameraFolderName:CAMERA_FOLDER,
    isCameraActor,
    isCameraToken,
    scanScene,
    cameraRecord,
    placeCameraFor,
    openPlaceDialog,

    async init() {
      patchVision();
      refreshCameraVision();

      controlsHook = Hooks.on("getSceneControlButtons",addControlTool);

      // This file hot-loads after the controls first drew.
      if (game.user?.isGM) {
        try { await ui.controls?.render?.({reset:true}); } catch {}
      }

      console.log("FEHA CAMERAS",VERSION,"ready");
    },

    async destroy() {
      if (controlsHook !== null) {
        Hooks.off("getSceneControlButtons",controlsHook);
        controlsHook = null;
      }

      unpatchVision();

      if (globalThis.FEHA_CAMERAS === api) {
        delete globalThis.FEHA_CAMERAS;
      }
    }
  };

  core.registerModule("cameras",api);
  globalThis.FEHA_CAMERAS = api;
})();
