// FEHA // MULTIPLAYER SYNC 0.1.0
(() => {
  const core=globalThis.FEHA_CYBER_CORE;
  if(!core) throw new Error("FEHA_MULTIPLAYER_SYNC requires FEHA_CYBER_CORE.");
  const VERSION="0.2.0", CH="module.flesh-enshrouded-heart-ablaze", MARK="fehaMultiplayerSyncV1";
  const FLAG="fleshEnshrouded", NS="world", STOCK="adkMarketStockV16", SESSION="adkMarketSessionV1", TIMEOUT=15000, APPROVAL_TIMEOUT=600000;
  const PLAYABLE=new Set(["ponyboy","derke","sasha","zach"]), pending=new Map(), hooks=[];
  let socketHandler=null, originals=null, wrappers=null, marketTimer=null, surfaceTimer=null, sessionTimer=null, applyingSession=false, marketHandler=false, approvalClickHandler=null, stockChain=Promise.resolve();
  const norm=v=>String(v??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g," ").trim().toLowerCase();
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const list=c=>{if(!c)return[];if(Array.isArray(c))return c;if(Array.isArray(c.contents))return c.contents;try{return[...c]}catch{return[]}};
  const authorityGM=()=>game.users?.activeGM??list(game.users).filter(u=>u?.isGM&&u?.active).sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0]??null;
  const knownGMs=()=>list(game.users).filter(u=>u?.isGM).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const ownerLevel=()=>Number(globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER??3);
  const owns=(u,a)=>{if(!u||!a)return false;if(u.isGM)return true;try{if(typeof a.testUserPermission==="function")return a.testUserPermission(u,ownerLevel())}catch{}const o=a.ownership??a.permission??{};return Number(o[u.id]??o.default??0)>=ownerLevel()};
  function actorForUser(user,requested=null){
    const req=typeof requested==="string"?game.actors?.get?.(requested)??null:requested;
    if(user?.isGM&&req?.type==="character")return req;
    if(req?.type==="character"&&owns(user,req))return req;
    const raw=user?.character??null, assigned=typeof raw==="string"?game.actors?.get?.(raw)??null:raw;
    if(assigned?.type==="character"&&owns(user,assigned))return assigned;
    if(user?.isGM&&!req)return null;
    return list(game.actors).filter(a=>a?.type==="character"&&PLAYABLE.has(norm(a.name))&&owns(user,a)).sort((a,b)=>String(a.name).localeCompare(String(b.name)))[0]??null;
  }
  const localActor=r=>actorForUser(game.user,r), canUseAuthority=()=>Boolean(game.user?.isGM||authorityGM());
  const rid=()=>globalThis.foundry?.utils?.randomID?.()??globalThis.crypto?.randomUUID?.()??String(Date.now())+Math.random().toString(36);
  const emit=(kind,payload={})=>game.socket?.emit?.(CH,{[MARK]:true,kind,payload});
  function wait(id,{timeoutMs=TIMEOUT,timeoutMessage="FEHA multiplayer authority request timed out."}={}){let timer;return new Promise((resolve,reject)=>{const done=p=>{clearTimeout(timer);if(pending.get(id)===done)pending.delete(id);p?.error?reject(new Error(p.error)):resolve(p)};done.cancel=()=>done({error:"FEHA multiplayer authority reloaded."});pending.set(id,done);timer=setTimeout(()=>{if(pending.get(id)!==done)return;pending.delete(id);reject(new Error(timeoutMessage))},timeoutMs)})}
  function hp(a){const h=a?.system?.attributes?.hp??{};return{value:Math.max(0,Number(h.value??0)),max:Math.max(0,Number(h.max??0)),temp:Math.max(0,Number(h.temp??0))}}
  async function damageLocal(a,amount){const damage=Math.max(0,Math.floor(Number(amount)||0)),before=hp(a);let rem=damage,temp=before.temp,value=before.value;const used=Math.min(temp,rem);temp-=used;rem-=used;value=Math.max(0,value-rem);const u={"system.attributes.hp.value":value};if(temp!==before.temp)u["system.attributes.hp.temp"]=temp;await a.update(u);return{damage,before,after:{value,max:before.max,temp}}}
  function validateHack(p){
    const user=game.users?.get?.(p.userId)??null;
    const op=game.actors?.get?.(p.operatorActorId)??null;
    const scene=game.scenes?.get?.(p.sceneId)??null;
    const token=scene?.tokens?.get?.(p.targetTokenId)??null;
    const target=token?.actor??null;
    const item=op?.items?.get?.(p.quickhackItemId)??null;

    if(!user?.active)throw new Error("Requesting player is no longer online.");
    if(!op)throw new Error("Quickhack operator Actor is unavailable.");
    if(!scene)throw new Error("Quickhack Scene is unavailable.");
    if(!token)throw new Error("Quickhack target Token is unavailable.");
    if(!target)throw new Error("Quickhack target Actor is unavailable.");
    if(!item)throw new Error("Quickhack software is unavailable.");

    const assignedRaw=user.character??null;
    const assignedId=
      typeof assignedRaw==="string"
        ? assignedRaw
        : assignedRaw?.id??null;

    if(
      !owns(user,op) &&
      String(assignedId??"")!==String(op.id)
    ){
      throw new Error("Requesting player is not authorized for the operator Actor.");
    }

    const f=item.flags?.[FLAG]??{};
    const isHack=
      f.quickhack===true||
      f.isQuickhack===true||
      String(f.sourceCategory??"").toLowerCase()==="quickhacks"||
      f.loadedQuickhack===true;

    if(!isHack)throw new Error("Selected software is not a Quickhack.");
    if(!(f.loadedQuickhack===true||f.quickhackLoaded===true||f.loaded===true)){
      throw new Error("Quickhack is no longer loaded.");
    }

    return{
      target,
      damage:Math.max(0,Math.floor(Number(p.damage)||0))
    };
  }
  function quickhackApprovalFlag(message){
    try{
      return message?.getFlag?.(FLAG,"quickhackApproval") ??
        message?.flags?.[FLAG]?.quickhackApproval ??
        null;
    }catch{
      return message?.flags?.[FLAG]?.quickhackApproval ?? null;
    }
  }

  function quickhackApprovalContent(data){
    const status=String(data?.status??"pending");
    const damage=Math.max(0,Math.floor(Number(data?.damage)||0));
    const operator=game.actors?.get?.(data?.operatorActorId)??null;
    const scene=game.scenes?.get?.(data?.sceneId)??null;
    const token=scene?.tokens?.get?.(data?.targetTokenId)??null;
    const target=token?.actor??null;
    const item=operator?.items?.get?.(data?.quickhackItemId)??null;
    const operatorName=operator?.name??data?.operatorName??"PLAYER";
    const targetName=target?.name??token?.name??data?.targetName??"TARGET";
    const hackName=item?.name??data?.quickhackName??"QUICKHACK";

    if(status==="applied"){
      const result=data?.result??{};
      return (
        '<div class="feha-qh-chat-approval">'+
          '<p><strong>QUICKHACK DAMAGE APPLIED</strong></p>'+
          '<p>'+esc(operatorName)+' → '+esc(targetName)+'</p>'+
          '<p>'+esc(hackName)+' // <strong>'+damage+' DAMAGE</strong></p>'+
          '<p>HP '+esc(result?.before?.value??"?")+' → <strong>'+esc(result?.after?.value??"?")+'</strong></p>'+
          '<p><em>Approved by '+esc(data?.approvedByName??"GM")+'</em></p>'+
        '</div>'
      );
    }

    if(status==="denied"){
      return (
        '<div class="feha-qh-chat-approval">'+
          '<p><strong>QUICKHACK DAMAGE DENIED</strong></p>'+
          '<p>'+esc(operatorName)+' → '+esc(targetName)+'</p>'+
          '<p>'+esc(hackName)+' // '+damage+' DAMAGE</p>'+
        '</div>'
      );
    }

    if(status==="error"){
      return (
        '<div class="feha-qh-chat-approval">'+
          '<p><strong>QUICKHACK DAMAGE ERROR</strong></p>'+
          '<p>'+esc(data?.error??"Unknown error")+'</p>'+
        '</div>'
      );
    }

    if(status==="processing"){
      return (
        '<div class="feha-qh-chat-approval">'+
          '<p><strong>QUICKHACK DAMAGE // PROCESSING</strong></p>'+
          '<p>'+esc(operatorName)+' → '+esc(targetName)+'</p>'+
          '<p>'+esc(hackName)+' // '+damage+' DAMAGE</p>'+
        '</div>'
      );
    }

    return (
      '<div class="feha-qh-chat-approval">'+
        '<p><strong>QUICKHACK DAMAGE APPROVAL</strong></p>'+
        '<p>'+esc(operatorName)+' → '+esc(targetName)+'</p>'+
        '<p>'+esc(hackName)+' // <strong>'+damage+' DAMAGE</strong></p>'+
        '<p>'+
          '<button type="button" data-feha-qh-approval-action="apply" data-feha-qh-request="'+esc(data?.requestId??"")+'">APPLY DAMAGE</button> '+
          '<button type="button" data-feha-qh-approval-action="deny" data-feha-qh-request="'+esc(data?.requestId??"")+'">DENY</button>'+
        '</p>'+
      '</div>'
    );
  }

  function findQuickhackApprovalMessage(requestId){
    return list(game.messages).find(message=>{
      const data=quickhackApprovalFlag(message);
      return String(data?.requestId??"")===String(requestId??"");
    })??null;
  }

  function settleQuickhackApproval(message){
    const data=quickhackApprovalFlag(message);
    if(!data)return;
    if(String(data.userId??"")!==String(game.user?.id??""))return;

    const resolver=pending.get(data.requestId);
    if(!resolver)return;

    if(data.status==="applied"){
      resolver({result:data.result??null});
    }else if(data.status==="denied"){
      resolver({error:"Quickhack damage was denied by the GM."});
    }else if(data.status==="error"){
      resolver({error:String(data.error??"Quickhack damage approval failed.")});
    }
  }

  async function createQuickhackApproval(payload){
    const operator=game.actors?.get?.(payload.operatorActorId)??null;
    const scene=game.scenes?.get?.(payload.sceneId)??null;
    const token=scene?.tokens?.get?.(payload.targetTokenId)??null;
    const target=token?.actor??null;
    const item=operator?.items?.get?.(payload.quickhackItemId)??null;
    const gmIds=knownGMs().map(user=>user.id);
    const whisper=[...new Set([...gmIds,game.user.id])];

    if(!gmIds.length){
      throw new Error("No GM user exists in this world for Quickhack approval.");
    }

    const data={
      ...payload,
      status:"pending",
      operatorName:operator?.name??"PLAYER",
      targetName:target?.name??token?.name??"TARGET",
      quickhackName:item?.name??"QUICKHACK",
      createdAt:new Date().toISOString()
    };

    const result=wait(
      data.requestId,
      {
        timeoutMs:APPROVAL_TIMEOUT,
        timeoutMessage:"Quickhack damage approval expired before a GM clicked it."
      }
    );

    try{
      await ChatMessage.create({
        speaker:ChatMessage.getSpeaker({actor:operator}),
        whisper,
        content:quickhackApprovalContent(data),
        flags:{
          [FLAG]:{
            quickhackApproval:data
          }
        }
      });
    }catch(err){
      pending.get(data.requestId)?.({
        error:"Could not create Quickhack approval chat message // "+String(err?.message??err)
      });
    }

    ui.notifications?.info?.("Quickhack damage sent to GM chat for approval.");
    return (await result)?.result??null;
  }

  async function applyQuickhackDamage(p={}){
    const {operatorActorId,quickhackItemId,targetTokenId}=p;
    const sceneId=p.sceneId??canvas?.scene?.id;
    const damage=Math.max(0,Math.floor(Number(p.damage)||0));

    if(!operatorActorId||!quickhackItemId||!targetTokenId||!sceneId){
      throw new Error("Quickhack authority request is incomplete.");
    }

    if(game.user?.isGM){
      const v=validateHack({
        userId:game.user.id,
        operatorActorId,
        quickhackItemId,
        targetTokenId,
        sceneId,
        damage
      });
      return damageLocal(v.target,v.damage);
    }

    return createQuickhackApproval({
      requestId:rid(),
      userId:game.user.id,
      operatorActorId,
      quickhackItemId,
      targetTokenId,
      sceneId,
      damage
    });
  }
  const hasSetting=k=>Boolean(game.settings?.settings?.has?.(NS+"."+k));
  function ensureSession(){if(hasSetting(SESSION))return true;try{game.settings.register(NS,SESSION,{scope:"world",config:false,type:Object,default:{}});return true}catch{return hasSetting(SESSION)}}
  function readSession(){try{if(!ensureSession())return null;const v=game.settings.get(NS,SESSION)??{},shop=String(v.shop??"").trim();return shop?{shop,shopTier:clamp(v.shopTier??3,1,5)}:null}catch{return null}}
  async function writeSession(s){if(!game.user?.isGM)throw new Error("GM authority is required to sync Market session state.");ensureSession();const shop=String(s?.shop??"").trim(),shopTier=clamp(s?.shopTier??3,1,5),cur=readSession();if(!shop||cur?.shop===shop&&Number(cur.shopTier)===shopTier)return false;await game.settings.set(NS,SESSION,{shop,shopTier,updatedBy:String(s?.updatedBy??game.user.id),updatedAt:new Date().toISOString()});return true}
  async function requestSession(s){const shop=String(s?.shop??"").trim(),shopTier=clamp(s?.shopTier??3,1,5);if(!shop)return false;if(game.user?.isGM)return writeSession({shop,shopTier,updatedBy:game.user.id});const gm=authorityGM();if(!gm)throw new Error("No online GM authority is available for Market sync.");emit("marketSessionReq",{userId:game.user.id,gmId:gm.id,shop,shopTier});return true}
  function readStock(){try{const v=hasSetting(STOCK)?game.settings.get(NS,STOCK)??{}:{};return globalThis.foundry?.utils?.deepClone?.(v)??JSON.parse(JSON.stringify(v))}catch{return{}}}
  async function writeStock(s){if(!game.user?.isGM)throw new Error("GM authority is required to write Market stock.");if(!hasSetting(STOCK))game.settings.register(NS,STOCK,{scope:"world",config:false,type:Object,default:{}});await game.settings.set(NS,STOCK,s??{})}
  async function refundDuplicate(item,userId){const actor=item?.parent,price=Math.max(0,Math.floor(Number(item?.flags?.[FLAG]?.purchasePrice??0)||0)),name=String(item?.name??"Item");try{await item.delete()}catch(e){console.error("FEHA MULTIPLAYER duplicate delete failed",e)}if(actor&&price){try{if(globalThis.ADKWallet?.add)await globalThis.ADKWallet.add(actor,price,"Duplicate Market purchase refund");else{const n=Number(actor.flags?.[FLAG]?.credits??actor.flags?.[FLAG]?.eurodollars??0)||0;await actor.update({[`flags.${FLAG}.credits`]:n+price})}}catch(e){console.error("FEHA MULTIPLAYER duplicate refund failed",e)}}emit("purchaseRejected",{userId:String(userId??""),itemName:name,price})}
  function reconcilePurchase(item,userId){if(!game.user?.isGM||authorityGM()?.id!==game.user.id)return;const f=item?.flags?.[FLAG]??{};if(f.marketPurchased!==true||!f.marketSourceId||!f.marketShop||!f.marketShopTier)return;stockChain=stockChain.then(async()=>{const stock=readStock(),key=String(f.marketShop)+":"+clamp(f.marketShopTier,1,5),arr=Array.isArray(stock[key])?[...stock[key]]:[],id=String(f.marketSourceId);if(!arr.includes(id))return refundDuplicate(item,userId);stock[key]=arr.filter(x=>x!==id);await writeStock(stock)}).catch(e=>console.error("FEHA MULTIPLAYER Market authority failed",e))}
  function snapshot(){const s=globalThis.ADKMarket?.state;if(!s)return null;return{actorId:s.actorId??null,shop:s.shop??null,shopTier:clamp(s.shopTier??3,1,5),search:String(s.search??""),category:String(s.category??"ALL"),itemTier:Number(s.itemTier??0)||0,manufacturer:String(s.manufacturer??"ALL"),slot:String(s.slot??"ALL"),page:Math.max(1,Number(s.page??1)||1)}}
  async function applySession(session=readSession()){if(!session?.shop||!document.getElementById("adk-market-15"))return false;const api=globalThis.ADKMarket;if(!api?.open)return false;const s=api.state??{};if(s.shop===session.shop&&Number(s.shopTier)===Number(session.shopTier))return true;const actor=game.actors?.get?.(s.actorId)??localActor();applyingSession=true;try{await api.open(actor??null,session.shop,session.shopTier);return true}finally{setTimeout(()=>applyingSession=false,0)}}
  async function reloadMarket(){if(!document.getElementById("adk-market-15"))return;const s=snapshot();if(!s||!originals?.openMarket)return globalThis.ADKMarket?.refresh?.();const actor=game.actors?.get?.(s.actorId)??localActor();try{await originals.openMarket();const api=globalThis.ADKMarket;if(!api?.state)return;if(actor)await api.open?.(actor,s.shop,s.shopTier);Object.assign(api.state,{search:s.search,category:s.category,itemTier:s.itemTier,manufacturer:s.manufacturer,slot:s.slot,page:s.page});api.refresh?.()}catch(e){console.warn("FEHA MULTIPLAYER Market reload failed",e);globalThis.ADKMarket?.refresh?.()}}
  const queueMarket=()=>{clearTimeout(marketTimer);marketTimer=setTimeout(()=>{marketTimer=null;void reloadMarket()},80)};
  function publishSession(){if(applyingSession)return;clearTimeout(sessionTimer);sessionTimer=setTimeout(()=>{sessionTimer=null;const s=globalThis.ADKMarket?.state;if(s?.shop)void requestSession({shop:s.shop,shopTier:s.shopTier}).catch(e=>console.warn("FEHA Market session sync failed",e))},60)}
  function marketClick(e){if(applyingSession)return;const t=e.target?.closest?.("#adk-market-15 [data-shop],#adk-market-15 .shop-card,#adk-market-15 [data-shop-tier],#adk-market-15 .tier-choice");if(t)setTimeout(publishSession,0)}
  function queueSurface(actorId=null){clearTimeout(surfaceTimer);surfaceTimer=setTimeout(()=>{surfaceTimer=null;try{const r=document.getElementById("adk-market-15"),v=r?.querySelector?.("#adk-market-actor")?.value;if(r&&(!actorId||!v||v===actorId))globalThis.ADKMarket?.refresh?.()}catch{}try{const r=document.getElementById("adk-chrome-manager-34"),v=r?.querySelector?.("#actor-select")?.value;if(r&&(!actorId||!v||v===actorId))globalThis.ADKChromeBackend?.refresh?.()}catch{}try{globalThis.ADKWallet?.refresh?.()}catch{}},35)}
  async function selectActor(rootId,selector,actor){if(!actor)return;for(let i=0;i<40;i++){const s=document.getElementById(rootId)?.querySelector?.(selector);if(s){if(s.value!==actor.id){s.value=actor.id;s.dispatchEvent(new Event("change",{bubbles:true}))}return}await new Promise(r=>setTimeout(r,25))}}
  async function openLocal(app,requested=null){const actor=localActor(requested),key=norm(app).replaceAll(" ","");if(key==="market"||key==="shop")return game.adk?.openMarket?.(actor?.id??null);if(key==="chrome"||key==="chromemanager")return game.adk?.openChrome?.(actor?.id??null);if(key==="cyberdeck"||key==="deck")return game.adk?.openCyberdeck?.(actor?.id??null);if(key==="wallet"||key==="credits"){if(!actor)throw new Error("No corresponding actor is available.");return globalThis.ADKWallet?.open?.(actor)}throw new Error("Unknown FEHA UI: "+app)}
  async function openForUser(userId,app,{actorId=null}={}){const user=game.users?.get?.(userId);if(!user?.active)throw new Error("Target player is not online.");if(String(user.id)===String(game.user?.id))return openLocal(app,actorId);if(!game.user?.isGM)throw new Error("Only a GM may open a UI on another player's client.");emit("uiOpen",{userId:user.id,senderId:game.user.id,app:String(app),actorId:actorForUser(user,actorId)?.id??null});return true}
  function restore(){if(!originals||!wrappers)return;const a=game.adk;if(a){if(a.openMarket===wrappers.openMarket)a.openMarket=originals.openMarket;if(a.openChrome===wrappers.openChrome)a.openChrome=originals.openChrome;if(a.openCyberdeck===wrappers.openCyberdeck)a.openCyberdeck=originals.openCyberdeck;for(const k of ["openForUser","openMarketForUser","openChromeForUser","openCyberdeckForUser","openWalletForUser"])if(a[k]===wrappers[k])delete a[k]}originals=wrappers=null}
  function attachUiBridges(){restore();const a=game.adk;if(!a)return false;originals={openMarket:typeof a.openMarket==="function"?a.openMarket.bind(a):null,openChrome:typeof a.openChrome==="function"?a.openChrome.bind(a):null,openCyberdeck:typeof a.openCyberdeck==="function"?a.openCyberdeck.bind(a):null};
    const openMarket=async(actorRef=null,...args)=>{if(!originals.openMarket)return null;const actor=game.user?.isGM&&!actorRef?null:localActor(actorRef),result=await originals.openMarket(...args),session=readSession(),api=globalThis.ADKMarket;if(actor||session?.shop)await api?.open?.(actor??game.actors?.get?.(api?.state?.actorId)??null,session?.shop??api?.state?.shop??null,session?.shopTier??api?.state?.shopTier??null);if(game.user?.isGM&&!session?.shop)publishSession();return result};
    const openChrome=async(actorRef=null,...args)=>{if(!originals.openChrome)return null;const actor=game.user?.isGM&&!actorRef?null:localActor(actorRef),result=await originals.openChrome(...args);if(actor)await selectActor("adk-chrome-manager-34","#actor-select",actor);return result};
    const openCyberdeck=async(actorRef=null,...args)=>{if(!originals.openCyberdeck)return null;if(game.user?.isGM&&!actorRef)return originals.openCyberdeck(null,...args);return originals.openCyberdeck(localActor(actorRef)?.id??null,...args)};
    const openForUserFn=(u,x,o={})=>openForUser(u,x,o), openMarketForUser=(u,o={})=>openForUser(u,"market",o), openChromeForUser=(u,o={})=>openForUser(u,"chrome",o), openCyberdeckForUser=(u,o={})=>openForUser(u,"cyberdeck",o), openWalletForUser=(u,o={})=>openForUser(u,"wallet",o);
    wrappers={openMarket,openChrome,openCyberdeck,openForUser:openForUserFn,openMarketForUser,openChromeForUser,openCyberdeckForUser,openWalletForUser};if(originals.openMarket)a.openMarket=openMarket;if(originals.openChrome)a.openChrome=openChrome;if(originals.openCyberdeck)a.openCyberdeck=openCyberdeck;Object.assign(a,{openForUser:openForUserFn,openMarketForUser,openChromeForUser,openCyberdeckForUser,openWalletForUser});return true}
  async function handleQuickhackApprovalClick(event){
    const button=event.target?.closest?.("[data-feha-qh-approval-action]");
    if(!button)return;

    event.preventDefault();
    event.stopPropagation();

    if(!game.user?.isGM){
      ui.notifications?.warn?.("GM approval required.");
      return;
    }

    const requestId=button.dataset.fehaQhRequest??"";
    const message=findQuickhackApprovalMessage(requestId);
    const data=quickhackApprovalFlag(message);

    if(!message||!data){
      ui.notifications?.error?.("Quickhack approval request is no longer available.");
      return;
    }

    if(String(data.status??"pending")!=="pending"){
      ui.notifications?.warn?.("This Quickhack request has already been resolved.");
      return;
    }

    const action=button.dataset.fehaQhApprovalAction;

    if(action==="deny"){
      const next={
        ...data,
        status:"denied",
        approvedBy:game.user.id,
        approvedByName:game.user.name,
        resolvedAt:new Date().toISOString()
      };

      await message.update({
        content:quickhackApprovalContent(next),
        [`flags.${FLAG}.quickhackApproval`]:next
      });
      return;
    }

    if(action!=="apply")return;

    const processing={
      ...data,
      status:"processing",
      approvedBy:game.user.id,
      approvedByName:game.user.name
    };

    await message.update({
      content:quickhackApprovalContent(processing),
      [`flags.${FLAG}.quickhackApproval`]:processing
    });

    try{
      const validated=validateHack(data);
      const result=await damageLocal(validated.target,validated.damage);
      const applied={
        ...data,
        status:"applied",
        approvedBy:game.user.id,
        approvedByName:game.user.name,
        resolvedAt:new Date().toISOString(),
        result
      };

      await message.update({
        content:quickhackApprovalContent(applied),
        [`flags.${FLAG}.quickhackApproval`]:applied
      });
    }catch(err){
      const failed={
        ...data,
        status:"error",
        approvedBy:game.user.id,
        approvedByName:game.user.name,
        resolvedAt:new Date().toISOString(),
        error:String(err?.message??err)
      };

      await message.update({
        content:quickhackApprovalContent(failed),
        [`flags.${FLAG}.quickhackApproval`]:failed
      });

      console.error("FEHA Quickhack chat approval failed",err);
    }
  }

  async function receive(m){if(!m?.[MARK])return;const k=m.kind,p=m.payload??{};
    if(k==="hackReq"){
      if(!game.user?.isGM)return;

      const preferred=authorityGM();

      if(
        p.gmId &&
        String(p.gmId)!==String(game.user.id)
      ) return;

      if(
        !p.gmId &&
        preferred &&
        String(preferred.id)!==String(game.user.id)
      ) return;

      try{
        const v=validateHack(p);
        emit("hackRes",{
          requestId:p.requestId,
          userId:p.userId,
          result:await damageLocal(v.target,v.damage)
        });
      }catch(e){
        emit("hackRes",{
          requestId:p.requestId,
          userId:p.userId,
          error:String(e?.message??e)
        });
      }
      return
    }
    if(k==="hackRes"){if(String(p.userId??"")===String(game.user?.id??""))pending.get(p.requestId)?.(p);return}
    if(k==="marketSessionReq"){if(!game.user?.isGM||p.gmId!==game.user.id||authorityGM()?.id!==game.user.id)return;const u=game.users?.get?.(p.userId);if(u?.active)try{await writeSession({shop:p.shop,shopTier:p.shopTier,updatedBy:u.id})}catch(e){console.warn("FEHA Market session authority failed",e)}return}
    if(k==="purchaseRejected"){if(String(p.userId??"")===String(game.user?.id??""))ui.notifications?.warn?.("Market stock changed before purchase completed. "+String(p.itemName??"Item")+" was removed and refunded.");return}
    if(k==="uiOpen"){if(String(p.userId??"")!==String(game.user?.id??""))return;const sender=game.users?.get?.(p.senderId);if(!sender?.isGM||!sender.active)return;try{await openLocal(p.app,p.actorId)}catch(e){console.error("FEHA remote UI open failed",e)}}
  }
  function installHooks(){if(!globalThis.Hooks?.on)return;hooks.push(["updateChatMessage",globalThis.Hooks.on("updateChatMessage",message=>settleQuickhackApproval(message))]);hooks.push(["updateActor",globalThis.Hooks.on("updateActor",a=>queueSurface(a?.id))]);hooks.push(["createItem",globalThis.Hooks.on("createItem",(i,_o,u)=>{queueSurface(i?.parent?.id);reconcilePurchase(i,u)})]);hooks.push(["updateItem",globalThis.Hooks.on("updateItem",i=>queueSurface(i?.parent?.id))]);hooks.push(["deleteItem",globalThis.Hooks.on("deleteItem",i=>queueSurface(i?.parent?.id))]);hooks.push(["updateSetting",globalThis.Hooks.on("updateSetting",s=>{const k=String(s?.key??s?._source?.key??"");if(k===NS+"."+STOCK||k.endsWith("."+STOCK))queueMarket();if(k===NS+"."+SESSION||k.endsWith("."+SESSION))void applySession()})]);hooks.push(["updateScene",globalThis.Hooks.on("updateScene",s=>void core.emit("devices:changed",{sceneId:s?.id??null,remote:true}))])}
  function removeHooks(){for(const[e,id]of hooks.splice(0))try{globalThis.Hooks.off(e,id)}catch{}}
  const api={version:VERSION,canUseAuthority,authorityGM,knownGMs,actorForUser,localActor,attachUiBridges,openForUser,applyQuickhackDamage,async init(){if(socketHandler)try{game.socket?.off?.(CH,socketHandler)}catch{}socketHandler=receive;game.socket?.on?.(CH,socketHandler);ensureSession();installHooks();if(!marketHandler){marketHandler=true;document.addEventListener("click",marketClick,true)}if(!approvalClickHandler){approvalClickHandler=handleQuickhackApprovalClick;document.addEventListener("click",approvalClickHandler,true)}console.log("FEHA MULTIPLAYER SYNC",VERSION,"ready")},async destroy(){if(socketHandler)try{game.socket?.off?.(CH,socketHandler)}catch{}socketHandler=null;for(const d of [...pending.values()])try{d.cancel?.()}catch{}pending.clear();removeHooks();if(marketHandler){marketHandler=false;document.removeEventListener("click",marketClick,true)}if(approvalClickHandler){document.removeEventListener("click",approvalClickHandler,true);approvalClickHandler=null}restore();clearTimeout(marketTimer);clearTimeout(surfaceTimer);clearTimeout(sessionTimer);if(globalThis.FEHA_MULTIPLAYER_SYNC===api)delete globalThis.FEHA_MULTIPLAYER_SYNC}};
  core.registerModule("multiplayerSync",api);globalThis.FEHA_MULTIPLAYER_SYNC=api;
})();
