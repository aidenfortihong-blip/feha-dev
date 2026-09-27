// FEHA // CAMERA SYSTEM
// Foundry-backed camera actors + JACK IN placement authority.
// FOV editing is intentionally a separate follow-up layer.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;

  if (!core) {
    throw new Error("FEHA_CAMERAS requires FEHA_CYBER_CORE.");
  }

  const VERSION = "0.1.0";
  const FLAG_SCOPE = "fleshEnshrouded";
  const ACTOR_FLAG = "cameraActor";
  const TOKEN_FLAG = "cameraToken";
  const CHANNEL = "module.flesh-enshrouded-heart-ablaze";
  const MARKER = "fehaCameraSystemV1";
  const CAMERA_FOLDER = "Camera";
  const CAMERA_IMG = "icons/svg/eye.svg";
  const TOKEN_SIZE = 0.5;
  const REQUEST_TIMEOUT_MS = 15000;

  const pending = new Map();
  let socketHandler = null;

  const clamp = (n,min,max) =>
    Math.max(min,Math.min(max,Number(n)||0));

  function randomID() {
    return (
      globalThis.foundry?.utils?.randomID?.() ??
      globalThis.crypto?.randomUUID?.() ??
      (String(Date.now()) + Math.random().toString(36).slice(2))
    );
  }

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

  function userOwnsActor(user,actor) {
    if (!user || !actor) return false;
    if (user.isGM) return true;

    try {
      if (typeof actor.testUserPermission === "function") {
        return actor.testUserPermission(user,ownerLevel());
      }
    } catch {}

    const ownership =
      actor.ownership ??
      actor.permission ??
      {};

    const level = Number(
      ownership[user.id] ??
      ownership.default ??
      0
    );

    return Number.isFinite(level) && level >= ownerLevel();
  }

  function activeAuthorityGM() {
    return collectionContents(game.users)
      .filter(user => user?.isGM && user?.active)
      .sort((a,b) => String(a.id).localeCompare(String(b.id)))[0] ??
      null;
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

  function percentToCenter(scene,xPct,yPct) {
    const rect = sceneRect(scene);
    const width = Math.max(1,Number(rect.width)||1);
    const height = Math.max(1,Number(rect.height)||1);

    return {
      x:Number(rect.x??0) + width*(clamp(xPct,0,100)/100),
      y:Number(rect.y??0) + height*(clamp(yPct,0,100)/100)
    };
  }

  function centerToPercent(scene,x,y) {
    const rect = sceneRect(scene);
    const width = Math.max(1,Number(rect.width)||1);
    const height = Math.max(1,Number(rect.height)||1);

    return {
      xPct:clamp(
        ((Number(x)-Number(rect.x??0))/width)*100,
        0,
        100
      ),
      yPct:clamp(
        ((Number(y)-Number(rect.y??0))/height)*100,
        0,
        100
      )
    };
  }

  function cameraActorFlag(actor) {
    try {
      return (
        actor?.getFlag?.(FLAG_SCOPE,ACTOR_FLAG) ??
        actor?.flags?.[FLAG_SCOPE]?.[ACTOR_FLAG] ??
        null
      );
    } catch {
      return null;
    }
  }

  function cameraTokenFlag(token) {
    try {
      return (
        token?.getFlag?.(FLAG_SCOPE,TOKEN_FLAG) ??
        token?.flags?.[FLAG_SCOPE]?.[TOKEN_FLAG] ??
        null
      );
    } catch {
      return null;
    }
  }

  function isCameraActor(actor) {
    return Boolean(cameraActorFlag(actor)?.enabled);
  }

  function isCameraToken(token) {
    return Boolean(cameraTokenFlag(token)?.enabled);
  }

  function findCameraActor(operatorActorId,userId) {
    return collectionContents(game.actors).find(actor => {
      const flag = cameraActorFlag(actor);

      return (
        flag?.enabled === true &&
        String(flag.operatorActorId ?? "") === String(operatorActorId ?? "") &&
        String(flag.ownerUserId ?? "") === String(userId ?? "")
      );
    }) ?? null;
  }

  async function ensureCameraFolder() {
    let folder = collectionContents(game.folders).find(folder =>
      folder?.type === "Actor" &&
      String(folder?.name ?? "").trim().toLowerCase() ===
        CAMERA_FOLDER.toLowerCase()
    ) ?? null;

    if (folder) return folder;

    if (!game.user?.isGM) {
      throw new Error("GM authority is required to create the Camera folder.");
    }

    folder = await Folder.create({
      name:CAMERA_FOLDER,
      type:"Actor",
      sorting:"a"
    });

    return folder;
  }

  async function ensureCameraActorLocal(operatorActorId,userId) {
    if (!game.user?.isGM) {
      throw new Error("GM authority is required to create Camera actors.");
    }

    const operator = game.actors?.get?.(operatorActorId) ?? null;
    const user = game.users?.get?.(userId) ?? null;

    if (!operator || !user) {
      throw new Error("Camera operator context is no longer available.");
    }

    if (!userOwnsActor(user,operator)) {
      throw new Error("Requesting user does not own the operator Actor.");
    }

    const folder = await ensureCameraFolder();
    let actor = findCameraActor(operator.id,user.id);

    if (!actor) {
      const ownership = {
        default:Number(
          globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE ??
          0
        )
      };

      ownership[user.id] = ownerLevel();

      actor = await Actor.create({
        name:"CAMERA // " + operator.name,
        type:"npc",
        img:CAMERA_IMG,
        folder:folder.id,
        ownership,
        flags:{
          [FLAG_SCOPE]:{
            [ACTOR_FLAG]:{
              enabled:true,
              operatorActorId:operator.id,
              ownerUserId:user.id,
              createdAt:new Date().toISOString()
            }
          }
        },
        prototypeToken:{
          name:"CAMERA // " + operator.name,
          actorLink:true,
          width:TOKEN_SIZE,
          height:TOKEN_SIZE,
          texture:{src:CAMERA_IMG},
          disposition:0
        }
      },{
        renderSheet:false
      });
    } else {
      const currentOwnership = {
        ...(actor.ownership ?? {})
      };

      if (Number(currentOwnership[user.id] ?? 0) < ownerLevel()) {
        currentOwnership[user.id] = ownerLevel();

        await actor.update({
          ownership:currentOwnership,
          folder:folder.id
        });
      } else if (String(actor.folder?.id ?? actor.folder ?? "") !== String(folder.id)) {
        await actor.update({folder:folder.id});
      }
    }

    return actor;
  }

  function cameraRecord(scene,token) {
    if (!scene || !token || !isCameraToken(token)) return null;

    const flag = cameraTokenFlag(token) ?? {};
    const size = gridSize(scene);
    const widthPx = Math.max(
      1,
      Number(token.width ?? TOKEN_SIZE)*size
    );
    const heightPx = Math.max(
      1,
      Number(token.height ?? TOKEN_SIZE)*size
    );

    const center = {
      x:Number(token.x ?? 0) + widthPx/2,
      y:Number(token.y ?? 0) + heightPx/2
    };

    const pos = centerToPercent(
      scene,
      center.x,
      center.y
    );

    const actor =
      token.actor ??
      game.actors?.get?.(token.actorId) ??
      null;

    return {
      id:String(token.id),
      tokenId:String(token.id),
      sceneId:String(scene.id),
      actorId:String(actor?.id ?? token.actorId ?? ""),
      operatorActorId:String(flag.operatorActorId ?? ""),
      ownerUserId:String(flag.ownerUserId ?? ""),
      name:String(token.name ?? actor?.name ?? "CAMERA"),
      img:String(
        token.texture?.src ??
        actor?.img ??
        CAMERA_IMG
      ),
      xPct:pos.xPct,
      yPct:pos.yPct,
      rotation:Number(token.rotation ?? flag.rotation ?? 0) || 0,
      fovAngle:Number(flag.fovAngle ?? 60) || 60,
      fovRange:Number(flag.fovRange ?? 60) || 60
    };
  }

  function scanScene(scene=canvas?.scene) {
    if (!scene) return [];

    return collectionContents(scene.tokens)
      .filter(isCameraToken)
      .map(token => cameraRecord(scene,token))
      .filter(Boolean);
  }

  async function placeCameraLocal({
    operatorActorId,
    userId,
    sceneId,
    xPct,
    yPct
  }) {
    if (!game.user?.isGM) {
      throw new Error("GM authority is required to place Camera tokens.");
    }

    const scene = game.scenes?.get?.(sceneId) ?? null;
    const user = game.users?.get?.(userId) ?? null;
    const operator = game.actors?.get?.(operatorActorId) ?? null;

    if (!scene || !user || !operator) {
      throw new Error("Camera placement context is no longer available.");
    }

    if (!userOwnsActor(user,operator)) {
      throw new Error("Requesting user does not own the operator Actor.");
    }

    const cameraActor =
      await ensureCameraActorLocal(
        operator.id,
        user.id
      );

    const center =
      percentToCenter(
        scene,
        xPct,
        yPct
      );

    const size = gridSize(scene);
    const tokenPixels = size*TOKEN_SIZE;
    const rect = sceneRect(scene);

    const minX = Number(rect.x ?? 0);
    const minY = Number(rect.y ?? 0);
    const maxX =
      minX +
      Math.max(0,Number(rect.width ?? 0)-tokenPixels);

    const maxY =
      minY +
      Math.max(0,Number(rect.height ?? 0)-tokenPixels);

    const x = Math.round(
      clamp(
        center.x-tokenPixels/2,
        minX,
        maxX
      )
    );

    const y = Math.round(
      clamp(
        center.y-tokenPixels/2,
        minY,
        maxY
      )
    );

    const [token] =
      await scene.createEmbeddedDocuments(
        "Token",
        [{
          name:"CAMERA",
          actorId:cameraActor.id,
          actorLink:true,
          x,
          y,
          width:TOKEN_SIZE,
          height:TOKEN_SIZE,
          rotation:0,
          hidden:false,
          disposition:0,
          texture:{
            src:cameraActor.img || CAMERA_IMG
          },
          flags:{
            [FLAG_SCOPE]:{
              [TOKEN_FLAG]:{
                enabled:true,
                operatorActorId:operator.id,
                ownerUserId:user.id,
                fovAngle:60,
                fovRange:60,
                rotation:0,
                createdAt:new Date().toISOString()
              }
            }
          }
        }]
      );

    const record = cameraRecord(scene,token);

    await core.emit(
      "cameras:changed",
      {
        sceneId:scene.id,
        camera:record,
        placedBy:user.id
      }
    );

    return record;
  }

  function createPending(requestId) {
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(
          new Error(
            "Camera authority request timed out."
          )
        );
      },REQUEST_TIMEOUT_MS);

      pending.set(
        requestId,
        payload => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(payload);
        }
      );
    });
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

  async function requestAuthority(kind,payload) {
    const gm = activeAuthorityGM();

    if (!gm) {
      throw new Error(
        "No online GM authority is available for Camera placement."
      );
    }

    const requestId = randomID();
    const resolution = createPending(requestId);

    emit(
      kind,
      {
        ...payload,
        requestId,
        gmId:gm.id,
        userId:payload.userId ?? game.user.id
      }
    );

    const result = await resolution;

    if (result?.error) {
      throw new Error(result.error);
    }

    return result?.result ?? null;
  }

  async function ensureCameraActor(
    operatorActorId,
    userId=game.user?.id
  ) {
    if (!operatorActorId || !userId) {
      throw new Error("Camera Actor requires operator and user.");
    }

    if (game.user?.isGM) {
      const actor =
        await ensureCameraActorLocal(
          operatorActorId,
          userId
        );

      return {
        id:actor.id,
        name:actor.name,
        img:actor.img
      };
    }

    return requestAuthority(
      "ensureActorRequest",
      {
        operatorActorId,
        userId
      }
    );
  }

  async function placeCamera({
    operatorActorId,
    userId=game.user?.id,
    sceneId=canvas?.scene?.id,
    xPct,
    yPct
  }={}) {
    if (
      !operatorActorId ||
      !userId ||
      !sceneId ||
      !Number.isFinite(Number(xPct)) ||
      !Number.isFinite(Number(yPct))
    ) {
      throw new Error("Camera placement request is incomplete.");
    }

    if (game.user?.isGM) {
      return placeCameraLocal({
        operatorActorId,
        userId,
        sceneId,
        xPct,
        yPct
      });
    }

    return requestAuthority(
      "placeCameraRequest",
      {
        operatorActorId,
        userId,
        sceneId,
        xPct:Number(xPct),
        yPct:Number(yPct)
      }
    );
  }

  async function receive(message) {
    if (!message?.[MARKER]) return;

    const kind = message.kind;
    const payload = message.payload ?? {};

    if (
      kind === "ensureActorResolved" ||
      kind === "placeCameraResolved"
    ) {
      if (
        payload.userId !== game.user?.id
      ) {
        return;
      }

      const resolver =
        pending.get(payload.requestId);

      resolver?.(payload);
      return;
    }

    if (!game.user?.isGM) return;
    if (payload.gmId !== game.user.id) return;

    if (kind === "ensureActorRequest") {
      try {
        const actor =
          await ensureCameraActorLocal(
            payload.operatorActorId,
            payload.userId
          );

        emit(
          "ensureActorResolved",
          {
            requestId:payload.requestId,
            userId:payload.userId,
            result:{
              id:actor.id,
              name:actor.name,
              img:actor.img
            }
          }
        );
      } catch (err) {
        emit(
          "ensureActorResolved",
          {
            requestId:payload.requestId,
            userId:payload.userId,
            error:String(err?.message ?? err)
          }
        );
      }

      return;
    }

    if (kind === "placeCameraRequest") {
      try {
        const record =
          await placeCameraLocal({
            operatorActorId:payload.operatorActorId,
            userId:payload.userId,
            sceneId:payload.sceneId,
            xPct:payload.xPct,
            yPct:payload.yPct
          });

        emit(
          "placeCameraResolved",
          {
            requestId:payload.requestId,
            userId:payload.userId,
            result:record
          }
        );
      } catch (err) {
        emit(
          "placeCameraResolved",
          {
            requestId:payload.requestId,
            userId:payload.userId,
            error:String(err?.message ?? err)
          }
        );
      }
    }
  }

  const api = {
    version:VERSION,
    cameraFolderName:CAMERA_FOLDER,
    cameraImage:CAMERA_IMG,
    tokenSize:TOKEN_SIZE,
    isCameraActor,
    isCameraToken,
    scanScene,
    cameraRecord,
    ensureCameraActor,
    placeCamera,

    async init() {
      socketHandler = receive;
      game.socket?.on?.(CHANNEL,socketHandler);

      if (game.user?.isGM) {
        try {
          await ensureCameraFolder();
        } catch (err) {
          console.warn(
            "FEHA CAMERAS // folder bootstrap failed",
            err
          );
        }
      }

      console.log(
        "FEHA CAMERAS",
        VERSION,
        "ready"
      );
    },

    async destroy() {
      if (socketHandler) {
        try {
          game.socket?.off?.(
            CHANNEL,
            socketHandler
          );
        } catch {}
      }

      socketHandler = null;
      pending.clear();

      if (globalThis.FEHA_CAMERAS === api) {
        delete globalThis.FEHA_CAMERAS;
      }
    }
  };

  core.registerModule("cameras",api);
  globalThis.FEHA_CAMERAS = api;
})();
