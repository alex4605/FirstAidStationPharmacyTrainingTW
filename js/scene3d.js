"use strict";
/* 還開著 STILL OPEN — three.js 三維場景 */

/* ---------- 12. 三維場景 ---------- */
let renderer, scene, cam, dust, debrisPts;
const M = {zones:[], lights:[], labels:[], baskets:[], npcs:[]};
const player = {pos:[BENCH[0],BENCH[1]+2.5], yaw:Math.PI, keys:{}, wide:false};
const ROLECOL = {doc:0xe6ece9, nurse:0xa9d3de, rad:0x9fb0dd, lab:0xc3a2dd, psy:0x93d9ae, vol:0x8ba0a0, admin:0xbdb6a4, out:0xd9a06b};
const ROLEKEY = {'醫師':'doc','護理師':'nurse','放射師':'rad','醫檢師':'lab','心理諮商／社工師':'psy','站長':'admin','外部':'out'};

/* ---------- 共用資源 ----------
   原本每個 box() 都新建一份幾何與材質：六百多個網格、四百多份材質。
   顏色與質感相同的東西共用同一份，之後才能把靜態物件合併成少數幾次 draw call。
   會在執行中改顏色的（窗口前的人、調劑檯面、鎖頭）另外拿自己的一份。 */
const GC={}, MC={};
const geo=(k,make)=>GC[k]||(GC[k]=make());
function stdMat(c,r,m,e,ei){
  const k=`${c}|${r}|${m||0}|${e||0}|${ei==null?1:ei}`;
  return MC[k]||(MC[k]=new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m||0,
    emissive:e||0,emissiveIntensity:ei==null?1:ei}));
}
function basicMat(c,op,o){
  o=o||{};
  const k=`b${c}|${op}|${o.add?1:0}|${o.dw===false?0:1}|${o.ds?1:0}`;
  return MC[k]||(MC[k]=new THREE.MeshBasicMaterial({color:c,transparent:op<1,opacity:op,
    depthWrite:o.dw!==false, side:o.ds?THREE.DoubleSide:THREE.FrontSide,
    blending:o.add?THREE.AdditiveBlending:THREE.NormalBlending}));
}
/* 畫在 canvas 上的字：開場時網頁字型多半還沒下載完，先畫的會是系統字型。
   每一張都記下怎麼畫，字型到了再重畫一次。貼圖開 mipmap，拉遠時字不會閃爍。 */
const TEXDRAW=[];
function canvasTex(w,h,draw){
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d'); draw(g);
  const t=new THREE.CanvasTexture(c);
  if (renderer) t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  TEXDRAW.push(()=>{ g.clearRect(0,0,w,h); draw(g); t.needsUpdate=true; });
  return t;
}
function redrawTextOnFonts(){
  if (!document.fonts || !document.fonts.load) return;
  Promise.all(['700 46px "Noto Sans TC"','400 25px "Noto Sans TC"','400 25px "JetBrains Mono"',
    '700 60px "JetBrains Mono"'].map(f=>document.fonts.load(f,'藥局 B2').catch(()=>null)))
    .then(()=>document.fonts.ready)
    .then(()=>{ TEXDRAW.forEach(f=>f()); if (M.fctx) drawFridge(); })
    .catch(()=>{});
}
function labelSprite(text, sub, w){
  const tex=canvasTex(512,128,g=>{
    g.fillStyle='#cfd6d2'; g.font='700 46px "Noto Sans TC",sans-serif';
    g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,256,46);
    if (sub){ g.fillStyle='#6c7a76'; g.font='400 25px "JetBrains Mono",monospace'; g.fillText(sub,256,90); }
  });
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,opacity:.6}));
  sp.scale.set(w||4,(w||4)/4,1); return sp;
}
const TT={};
function textTex(txt,bg,fg){
  const k=txt+'|'+bg+'|'+fg;                   // 同一塊牌子（「領　藥」）只畫一次
  return TT[k]||(TT[k]=canvasTex(256,64,g=>{
    g.fillStyle=bg; g.fillRect(0,0,256,64);
    g.strokeStyle=fg; g.lineWidth=3; g.strokeRect(2,2,252,60);
    g.fillStyle=fg; g.font='700 30px "Noto Sans TC",sans-serif';
    g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,128,34);
  }));
}
function box(w,h,d,color,o){
  o=o||{};
  const r=o.rough!=null?o.rough:.85;
  const mat = o.own
    ? new THREE.MeshStandardMaterial({color,roughness:r,metalness:o.metal||0,
        emissive:o.emissive||0,emissiveIntensity:o.ei||1})
    : stdMat(color,r,o.metal||0,o.emissive||0,o.ei||1);
  const m=new THREE.Mesh(geo(`B${w}|${h}|${d}`,()=>new THREE.BoxGeometry(w,h,d)), mat);
  m.castShadow=true; m.receiveShadow=true; return m;
}
/* 腳底下一圈軟影子。主燈的陰影貼圖解析度只夠讓人「有影子」，
   站在地上的感覺要靠這一圈：一張共用貼圖、一個平面，幾乎不花成本。 */
let BLOB=null;
function blobMat(){
  if (BLOB) return BLOB;
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d'), gr=g.createRadialGradient(32,32,2,32,32,31);
  gr.addColorStop(0,'rgba(0,0,0,.85)'); gr.addColorStop(.55,'rgba(0,0,0,.4)'); gr.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64);
  return BLOB=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,
    opacity:.55,depthWrite:false});
}
/* 水泥地的細紋：一張程序產生的灰階雜訊，乘在原本的地色上。 */
function concreteTex(){
  const N=256, c=document.createElement('canvas'); c.width=c.height=N;
  const g=c.getContext('2d'), im=g.createImageData(N,N), d=im.data;
  const rr=mulberry(0x5eed);
  // 兩層：大塊的不均勻＋細顆粒，平鋪時不能看出接縫，所以大塊那層用可平鋪的值雜訊
  const G=8, grid=[]; for (let i=0;i<G*G;i++) grid.push(rr());
  const at=(x,y)=>grid[((y%G+G)%G)*G+((x%G+G)%G)];
  const sm=t=>t*t*(3-2*t);
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const fx=x/N*G, fy=y/N*G, x0=Math.floor(fx), y0=Math.floor(fy), tx=sm(fx-x0), ty=sm(fy-y0);
    const a=at(x0,y0)+(at(x0+1,y0)-at(x0,y0))*tx, b=at(x0,y0+1)+(at(x0+1,y0+1)-at(x0,y0+1))*tx;
    const v=.80+(a+(b-a)*ty)*.14+(rr()-.5)*.10;
    const k=(y*N+x)*4, q=Math.max(0,Math.min(255,v*255));
    d[k]=d[k+1]=d[k+2]=q; d[k+3]=255;
  }
  g.putImageData(im,0,0);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  return t;
}
function mulberry(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
/** 方塊六個面各自依實際尺寸放大 UV（BoxGeometry 的面順序：±x、±y、±z，每面四個頂點） */
function boxWorldUV(g,w,h,d,scale){
  const uv=g.attributes.uv, F=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for (let f=0;f<6;f++) for (let i=0;i<4;i++){ const k=f*4+i;
    uv.setXY(k,uv.getX(k)*F[f][0]/scale,uv.getY(k)*F[f][1]/scale); }
  uv.needsUpdate=true; return g;
}
/* 停車場的柱子：水泥底色，最下面一公尺漆黃黑斜紋，上緣一條白線——
   B2 停車場每根柱子都長這樣。貼圖高度對應整根柱子（3.4 公尺）。 */
function pillarTex(){
  const W=128,H=512,c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d'), rr=mulberry(0xb2);
  g.fillStyle='#1c2427'; g.fillRect(0,0,W,H);
  for (let i=0;i<2600;i++){ const v=rr(); g.fillStyle=v<.5?'rgba(0,0,0,.18)':'rgba(120,140,140,.06)';
    g.fillRect(rr()*W,rr()*H,1+rr()*2,1+rr()*2); }
  const band=Math.round(H*0.27), y0=H-band;          // 約 0.9 公尺
  g.save(); g.beginPath(); g.rect(0,y0,W,band); g.clip();
  g.fillStyle='#16191a'; g.fillRect(0,y0,W,band);
  g.fillStyle='#8c7a2a';
  for (let x=-band;x<W+band;x+=44){ g.beginPath(); g.moveTo(x,H); g.lineTo(x+22,H); g.lineTo(x+22+band,y0); g.lineTo(x+band,y0); g.fill(); }
  g.fillStyle='rgba(0,0,0,.35)';                          // 被鞋子、推車磨掉的地方
  for (let i=0;i<900;i++) g.fillRect(rr()*W,H-rr()*rr()*band,1+rr()*3,1);
  g.restore();
  g.fillStyle='#5d6866'; g.fillRect(0,y0-10,W,5);
  const t=new THREE.CanvasTexture(c);
  t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  return t;
}
/* 假的環境光遮蔽：牆腳與重物底下一圈漸層的暗。真的 SSAO 要多一整個後製 pass，
   這個只是幾片地貼，合併後一兩次 draw call。 */
let AOM=null;
function aoMats(){
  if (AOM) return AOM;
  const mk=(w,h,paint)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h;
    paint(c.getContext('2d')); return new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),
      transparent:true,depthWrite:false,color:0x000000}); };
  AOM={
    strip: mk(4,64,g=>{ const gr=g.createLinearGradient(0,0,0,64);
      gr.addColorStop(0,'#bfbfbf'); gr.addColorStop(.35,'#474747'); gr.addColorStop(1,'#000');
      g.fillStyle=gr; g.fillRect(0,0,4,64); }),
    pad: mk(64,64,g=>{ const gr=g.createRadialGradient(32,32,4,32,32,32);
      gr.addColorStop(0,'#c8c8c8'); gr.addColorStop(.6,'#5a5a5a'); gr.addColorStop(1,'#000');
      g.fillStyle=gr; g.fillRect(0,0,64,64); }),
  };
  // 灰階當遮蔽量（alphaMap 讀的是綠色通道，不是 alpha）：顏色固定黑，貼圖只提供透明度
  Object.values(AOM).forEach(m=>{ m.alphaMap=m.map; m.map=null; });
  return AOM;
}
/** 地上的一片遮蔽：x,z 中心，w×d，ry 旋轉，kind = 'pad'（四周淡出）或 'strip'（從一邊淡出） */
function aoDecal(x,z,w,d,ry,kind){
  const m=new THREE.Mesh(geo('aoP',()=>new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2)), aoMats()[kind||'pad']);
  m.scale.set(w,1,d); m.position.set(x,.029,z); if (ry) m.rotation.y=ry; m.renderOrder=1;
  scene.add(m); return m;
}
/* 假光暈：發光的東西旁邊一張加法混合的貼片。沒有後製 bloom 的條件下，
   這是讓「那是一盞燈」看起來像燈最便宜的方法。 */
let GLOWT=null;
function glowSprite(col,size,op){
  if (!GLOWT){ const c=document.createElement('canvas'); c.width=c.height=64;
    const g=c.getContext('2d'), gr=g.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.18,'rgba(255,255,255,.55)');
    gr.addColorStop(.5,'rgba(255,255,255,.12)'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr; g.fillRect(0,0,64,64); GLOWT=new THREE.CanvasTexture(c); }
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOWT,color:col,transparent:true,opacity:op,
    blending:THREE.AdditiveBlending,depthWrite:false}));
  sp.scale.set(size,size,1); sp.userData.op=op; scene.add(sp); return sp;
}
/** 把平面的 UV 依實際尺寸放大，所有地面共用一張貼圖時紋理密度一致 */
function worldUV(g,w,h,scale){
  const uv=g.attributes.uv; for (let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*w/scale,uv.getY(i)*h/scale);
  uv.needsUpdate=true; return g;
}
/** 把一組網格烘成一份幾何：頂點套上 mtx(m)，顏色寫進頂點色。
    顏色取材質原色；glow 時加上自發光的一部分（人身上的臂章、識別條沒有自己的材質了，
    不加會暗掉）。已有頂點色的照抄。 */
const _bv=new THREE.Vector3(), _bn=new THREE.Matrix3(), _bc=new THREE.Color();
function bakeGeo(list, mtx, glow){
  let nv=0, ni=0, hasUV=true;
  list.forEach(m=>{ const g=m.geometry, n=g.attributes.position.count;
    nv+=n; ni+=g.index?g.index.count:n; if (!g.attributes.uv) hasUV=false; });
  const pos=new Float32Array(nv*3), nor=new Float32Array(nv*3), col=new Float32Array(nv*3);
  const uv=hasUV?new Float32Array(nv*2):null, idx=new (nv>65535?Uint32Array:Uint16Array)(ni);
  let vo=0, io=0;
  list.forEach(m=>{
    const g=m.geometry, P=g.attributes.position, N=g.attributes.normal, U=g.attributes.uv, C=g.attributes.color;
    const M4=mtx(m); _bn.getNormalMatrix(M4);
    const mt=m.material;
    if (!C){ _bc.copy(mt.color);
      if (glow && mt.emissive && mt.emissive.getHex()) _bc.r+=mt.emissive.r*mt.emissiveIntensity*.6,
        _bc.g+=mt.emissive.g*mt.emissiveIntensity*.6, _bc.b+=mt.emissive.b*mt.emissiveIntensity*.6; }
    for (let i=0;i<P.count;i++){
      const o=(vo+i)*3;
      _bv.fromBufferAttribute(P,i).applyMatrix4(M4); _bv.toArray(pos,o);
      if (N) _bv.fromBufferAttribute(N,i).applyMatrix3(_bn).normalize(); else _bv.set(0,1,0);
      _bv.toArray(nor,o);
      if (C){ col[o]=C.getX(i); col[o+1]=C.getY(i); col[o+2]=C.getZ(i); }
      else { col[o]=_bc.r; col[o+1]=_bc.g; col[o+2]=_bc.b; }
      if (uv){ uv[(vo+i)*2]=U.getX(i); uv[(vo+i)*2+1]=U.getY(i); }
    }
    if (g.index) for (let i=0;i<g.index.count;i++) idx[io++]=g.index.getX(i)+vo;
    else for (let i=0;i<P.count;i++) idx[io++]=vo+i;
    vo+=P.count;
  });
  const bg=new THREE.BufferGeometry();
  bg.setAttribute('position',new THREE.BufferAttribute(pos,3));
  bg.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  bg.setAttribute('color',new THREE.BufferAttribute(col,3));
  if (uv) bg.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  bg.setIndex(new THREE.BufferAttribute(idx,1));
  bg.computeBoundingSphere();
  return bg;
}
/* ---------- 人 ----------
   身形：胸、腰、臀有起伏的軀幹（前後比左右薄，像真人而不是圓柱），
   肩膀、上臂袖子、前臂、手、褲管、鞋；頭上有頭髮（看得出臉朝哪邊）、鼻子。
   每個人的體型、髮色、長短髮略有不同。裝備：背心、頭盔、帽子、背包、臂章、白袍下襬。
   正面是 +z（走路時 rotation.y = atan2(dx,dz) 讓 +z 朝前進方向）。
   擺動的四肢是以髖、肩為軸的群組（userData.limbs，由 gait() 驅動）；
   其餘部位烘成一個頂點色網格。窗口前會換顏色的人傳 kit.own，衣服材質另外拿一份。 */
let PMAT=null;
const personMat=()=>PMAT||(PMAT=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7}));
const PG = GC;
const pgeo = geo;
const SKIN=[0xd8c6ab,0xcdb694,0xe0cdb4,0xc2a888];
const HAIR=[0x161311,0x201a16,0x2c231c,0x3b2f26,0x121010,0x6f6a64];
/** 軀幹：一條側面輪廓轉一圈（臀→腰→胸→肩），再把前後壓扁 */
const torsoGeo=()=>pgeo('torso2',()=>new THREE.LatheGeometry([
  [.001,-.34],[.215,-.34],[.245,-.26],[.235,-.12],[.212,-.02],[.228,.10],[.252,.20],[.25,.28],[.20,.34],[.10,.37],[.001,.37]
].map(([r,y])=>new THREE.Vector2(r,y)),14).scale(1,1,.70));
/** 把一個群組裡（除了 skip 之外）的網格烘成一個，留在原位 */
function bakeChildren(grp, skip){
  const list=grp.children.filter(o=>o.isMesh && !skip.has(o));
  if (list.length<2 && !(list.length && list[0].material!==personMat())) return;
  list.forEach(o=>o.updateMatrix());
  const m=new THREE.Mesh(bakeGeo(list,o=>o.matrix,true), personMat());
  m.castShadow=true; list.forEach(o=>grp.remove(o)); grp.add(m);
}
function person(col, lying, kit){
  kit = kit||{};
  const g=new THREE.Group(), inner=new THREE.Group(); g.add(inner);
  const trouser = kit.trouser!=null ? kit.trouser : 0x2b3236;
  const skin = kit.skin!=null ? kit.skin : SKIN[0];
  const hair = kit.hair!=null ? kit.hair : HAIR[Math.floor(Math.random()*HAIR.length)];
  const longHair = kit.long!=null ? kit.long : Math.random()<.35;
  const mBody = kit.own ? new THREE.MeshStandardMaterial({color:col,roughness:.62}) : stdMat(col,.62);
  const mLeg=stdMat(trouser,.78), mSkin=stdMat(skin,.72), mShoe=stdMat(0x18191a,.55), mHair=stdMat(hair,.9);
  const put=(par,geo,m,x,y,z,rx,rz)=>{ const o=new THREE.Mesh(geo,m);
    o.position.set(x,y,z); if(rx) o.rotation.x=rx; if(rz) o.rotation.z=rz; o.castShadow=true; par.add(o); return o; };
  const G={
    thigh: pgeo('thigh2',()=>new THREE.CylinderGeometry(.088,.066,.84,8).translate(0,-.42,0)),
    shoe:  pgeo('shoe',()=>new THREE.BoxGeometry(.12,.08,.25)),
    sleeve:pgeo('sleeve',()=>new THREE.CylinderGeometry(.068,.058,.32,8).translate(0,-.16,0)),
    fore:  pgeo('fore',()=>new THREE.CylinderGeometry(.052,.044,.28,7).translate(0,-.14,0)),
    hand:  pgeo('hand',()=>new THREE.SphereGeometry(.05,6,4).scale(.9,1.2,.75)),
    yoke:  pgeo('yoke',()=>new THREE.SphereGeometry(.28,14,8).scale(1,.32,.64)),
    neck:  pgeo('neck2',()=>new THREE.CylinderGeometry(.056,.062,.11,7)),
    head:  pgeo('head2',()=>new THREE.SphereGeometry(.132,12,9).scale(1,1.14,1.04)),
    hairc: pgeo('hairc',()=>new THREE.SphereGeometry(.142,12,6,0,Math.PI*2,0,Math.PI*.56).scale(1,1.12,1.06)),
    hairl: pgeo('hairl',()=>new THREE.BoxGeometry(.24,.24,.08)),
    nose:  pgeo('nose',()=>new THREE.BoxGeometry(.035,.05,.045)),
    seatT: pgeo('seatT',()=>new THREE.CylinderGeometry(.09,.08,.44,8)),
    seatS: pgeo('seatS',()=>new THREE.CylinderGeometry(.072,.062,.44,8)),
    coat:  pgeo('coat',()=>new THREE.CylinderGeometry(.252,.29,.36,14,1,true).scale(1,1,.74)),
  };
  const sit=!!kit.sit, dy = sit ? -.37 : 0;       // 坐著的時候上半身整個降到椅面上
  /* 一隻手臂：袖子＋前臂＋手，轉軸在肩 */
  const arm=(x,rx,rz)=>{ const a=new THREE.Group(); a.position.set(x,1.43+dy,0); a.rotation.set(rx,0,rz);
    put(a,G.sleeve,mBody,0,0,0); put(a,G.fore,kit.longSleeve===false?mSkin:mBody,0,-.31,0);
    put(a,G.hand,mSkin,0,-.62,0); inner.add(a); return a; };
  let l1,l2,a1,a2;
  if (sit){
    /* 坐著：大腿往前、小腿往下、鞋子踩地；手放在膝上 */
    [-.1,.1].forEach(x=>{
      put(inner,G.seatT,mLeg,x,.47,.2,Math.PI/2);
      put(inner,G.seatS,mLeg,x,.25,.42);
      put(inner,G.shoe,mShoe,x,.04,.47);
    });
    a1=arm(-.26,-.75,.06); a2=arm(.26,-.75,-.06);
  } else {
    const leg=x=>{ const l=new THREE.Group(); l.position.set(x,.88,0);
      put(l,G.thigh,mLeg,0,0,0); if (!lying) put(l,G.shoe,mShoe,0,-.84,.05); inner.add(l); return l; };
    l1=leg(-.105); l2=leg(.105);
    a1=arm(-.285,-.06,.09); a2=arm(.285,-.06,-.09);
    if (kit.coat) put(inner,G.coat,mBody,0,.76,0);          // 白袍下襬
  }
  const torso=put(inner,torsoGeo(),mBody,0,1.17+dy,0);
  put(inner,G.yoke,mBody,0,1.44+dy,0);
  put(inner,G.neck,mSkin,0,1.55+dy,0);
  const hy=1.70+dy;
  put(inner,G.head,mSkin,0,hy,0);
  put(inner,G.nose,mSkin,0,hy-.015,.135);
  if (kit.helmet==null){
    put(inner,G.hairc,mHair,0,hy+.018,-.012,-.42);
    if (longHair) put(inner,G.hairl,mHair,0,hy-.1,-.1);
  }
  if (kit.vest!=null){                         // 戰術／反光背心
    put(inner,pgeo('vest2',()=>new THREE.BoxGeometry(.5,.44,.4)), stdMat(kit.vest,.72), 0,1.2+dy,0);
    if (kit.band!=null)                        // 背心上的識別條
      put(inner,pgeo('band2',()=>new THREE.BoxGeometry(.52,.075,.42)), stdMat(kit.band,.5,0,kit.band,.45), 0,1.30+dy,0);
  }
  if (kit.helmet!=null){                       // 頭盔（半球＋帽簷）
    put(inner,pgeo('hel',()=>new THREE.SphereGeometry(.17,12,8,0,Math.PI*2,0,Math.PI*0.56)),
      stdMat(kit.helmet,.62,.08), 0,hy+.01,0);
    put(inner,pgeo('brim',()=>new THREE.CylinderGeometry(.18,.18,.028,12)), stdMat(kit.helmet,.62,.08), 0,hy-.05,0);
  } else if (kit.cap!=null){                    // 鴨舌帽：帽簷朝前
    put(inner,pgeo('capc',()=>new THREE.CylinderGeometry(.148,.143,.09,12)), stdMat(kit.cap,.72), 0,hy+.115,0);
    put(inner,pgeo('capb',()=>new THREE.BoxGeometry(.24,.02,.15)), stdMat(kit.cap,.72), 0,hy+.08,.16);
  }
  if (kit.pack)                                 // 背包在背上
    put(inner,pgeo('pack',()=>new THREE.BoxGeometry(.34,.4,.2)), stdMat(kit.pack,.8), 0,1.2+dy,-.27);
  if (kit.badge!=null)                          // 左臂臂章
    put(a1,pgeo('badge2',()=>new THREE.BoxGeometry(.03,.09,.09)), stdMat(kit.badge,.5,0,kit.badge,.5), -.07,-.12,0);
  g.userData.body=torso;                       // 需要換色的時候換這一塊
  if (!sit && !lying) g.userData.limbs={l1,l2,a1,a2,ph:Math.random()*6,amt:0,ar:-.06};
  /* 烘焙：不擺動、不換色的部位併成一個網格；四肢各自烘成一個。
     一個站著的人＝身體 1＋四肢 4，坐著的＝1 或 3。 */
  const skip=new Set(kit.own ? inner.children.concat(...[a1,a2].map(a=>a.children)).filter(o=>o.material===mBody) : []);
  bakeChildren(inner,skip);
  [l1,l2,a1,a2].forEach(l=>{ if (l) bakeChildren(l,skip); });
  // 體型：寬窄、高矮略有不同
  if (!kit.exact){ const bw=fxRnd(.93,1.08); inner.scale.set(bw,fxRnd(.95,1.04),bw); }
  if (lying){                                   // 仰躺：頭朝 -z，臉朝上
    inner.rotation.x=-Math.PI/2; inner.position.set(0,.15,.9);
  } else {                                      // 腳下的軟影子
    const b=new THREE.Mesh(pgeo('blob',()=>new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2)), blobMat());
    b.scale.set(sit?.95:.8,1,sit?1.05:.8); b.position.set(0,.034,sit?.12:0); b.renderOrder=1;
    g.add(b);
  }
  return g;
}
/** 走路的擺動：看這一幀實際移動了多少，就擺多少。不用另外記誰在走。 */
function gait(g, dt){
  const L=g.userData.limbs; if (!L || !dt) return;
  const p=g.position, lp=L.lp||(L.lp=[p.x,p.z]);
  const v=Math.hypot(p.x-lp[0], p.z-lp[1])/dt; lp[0]=p.x; lp[1]=p.z;
  const want=Math.min(1,v/1.4);
  L.amt += (want-L.amt)*Math.min(1,dt*8);
  if (L.amt<.01 && !L.moved) return;
  L.moved = L.amt>=.01;
  L.ph += dt*Math.min(v,5)*4.2;
  const s=Math.sin(L.ph)*.5*L.amt;
  L.l1.rotation.x=s; L.l2.rotation.x=-s;
  L.a1.rotation.x=L.ar-s*.75; L.a2.rotation.x=L.ar+s*.75;
}
/* ---------- 場景陳設 ----------
   這裡本來是社區大樓的地下二樓停車場。停車格線、柱號、消防栓、通風管、
   排水溝、還有一台沒開走的車——那些都還在。
   變成急救站之後搬進來的是：檢傷四色地墊、帆布隔間、折疊桌、擔架、
   點滴架、氧氣鋼瓶、感染性廢棄物桶、地上的動線膠帶、掛牌。
   兩種東西疊在同一個空間裡，這就是災時急救站真正的樣子。 */
function dressStation(small){
  const add=(o,x,y,z,ry)=>{ o.position.set(x,y,z); if(ry) o.rotation.y=ry;
    o.receiveShadow=true; scene.add(o); return o; };
  const flat=(w,d,c,op)=>{ const m=new THREE.Mesh(geo(`P${w}|${d}`,()=>new THREE.PlaneGeometry(w,d)),
    basicMat(c,op==null?.5:op,{dw:false}));
    m.rotation.x=-Math.PI/2; return m; };
  const cyl=(r,h,c,seg,rough,metal)=>{ const m=new THREE.Mesh(
    geo(`C${r}|${h}|${seg||10}`,()=>new THREE.CylinderGeometry(r,r,h,seg||10)),
    stdMat(c,rough==null?.7:rough,metal||0)); return m; };

  /* ── 停車場留下來的 ───────────────────────── */
  // 停車格線：公共空間、留觀、遺體、廢棄物那幾區的線還在地上
  {
    const slots=[];
    for (let i=0;i<6;i++) slots.push([-1.4+i*1.15, 3.9, 2.3]);   // pub
    for (let i=0;i<5;i++) slots.push([6.2+i*1.5, 4.0, 2.3]);      // obs
    for (let i=0;i<3;i++) slots.push([9.6+i*1.2, -6.5, 2.3]);     // mort
    for (let i=0;i<3;i++) slots.push([-12.2+i*1.5, 4.2, 2.3]);    // waste
    const g=new THREE.PlaneGeometry(.08,1);
    const im=new THREE.InstancedMesh(g,
      new THREE.MeshBasicMaterial({color:0x7e8b84,transparent:true,opacity:.20,depthWrite:false}),
      slots.length);
    const m4=new THREE.Matrix4(), q=new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    slots.forEach(([x,z,len],i)=>{
      m4.compose(new THREE.Vector3(x,.022,z), q, new THREE.Vector3(1,len,1));
      im.setMatrixAt(i,m4); });
    im.instanceMatrix.needsUpdate=true; scene.add(im);
  }
  // 車道上的方向箭頭與減速標線
  [[5,-11.2],[5,-13.0]].forEach(([x,z])=>{
    add(flat(.5,1.5,0xb9a05c,.28), x,.024,z);
    add(flat(.9,.12,0xb9a05c,.22), x,.023,z+1.0); });
  // 排水溝：一條貫穿中央
  add(flat(26,.42,0x0a0d0f,.85), 0,.019,1.2);
  if (!small) for (let i=0;i<5;i++) add(flat(.34,.05,0x3b4449,.5), -10+i*5,.021,1.2);
  // 柱號：每根柱子上一塊小牌（雙面，手機上只留四根）
  const PN=[[-9.5,-1.5,'B2-01'],[-9.5,3.5,'B2-02'],[-4.5,-1.5,'B2-03'],[-4.5,3.5,'B2-04'],
   [1,-1.5,'B2-05'],[1,3.5,'B2-06'],[7,-1.5,'B2-07'],[7,3.5,'B2-08'],
   [11.4,-1.5,'B2-09'],[11.4,3.5,'B2-10']];
  (small?PN.filter((_,i)=>i%3===0):PN).forEach(([x,z,t])=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(.52,.19),
      new THREE.MeshBasicMaterial({map:textTex(t,'#161d20','#8b9a93'),transparent:true,
        side:THREE.DoubleSide}));
    add(m, x,1.62,z+.42);
  });
  // 牆上的「B2」與車道口的限高桿
  { const m=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.9),
      new THREE.MeshBasicMaterial({map:textTex('B2','#12181b','#6f7e78'),transparent:true}));
    add(m,-13.2,2.1,-1.5, Math.PI/2); }
  add(cyl(.045,7.6,0xc9b45a,8,.6,.3), 5,2.75,-9.9).rotation.z=Math.PI/2;
  // 消防栓箱與滅火器
  add(box(.5,.7,.26,0x8c3b32,{rough:.7}), -13.1,.9,-6.4);
  if (!small) [[-13.05,-6.4],[13.05,2.2]].forEach(([x,z])=>
    add(cyl(.09,.5,0x9c4038,10,.55,.2), x,.55,z));
  // 配電箱
  add(box(.62,.8,.24,0x39423f,{rough:.8,metal:.25}), -13.1,1.5,2.6);
  // 天花板通風管與灑水頭
  // 通風管沿著牆邊走，不要橫切活動空間
  [[0,-9.1],[0,6.2]].forEach(([x,z])=>{
    const d=cyl(.19,25,0x2b3336,9,.75,.3); d.rotation.z=Math.PI/2; add(d, x,3.2,z); });
  [[-12.9,-1.5],[12.9,-1.5]].forEach(([x,z])=>{
    const d=cyl(.17,15,0x2b3336,9,.75,.3); d.rotation.x=Math.PI/2; add(d, x,3.2,z); });
  // 地上的舊油漬
  if (!small) [[-11.0,4.4,1.5],[8.6,3.2,1.1],[-1.2,5.0,.9],[10.4,-6.0,1.3]].forEach(([x,z,r])=>{
    const o=new THREE.Mesh(geo('oil'+r,()=>new THREE.CircleGeometry(r,14)), basicMat(0x080b0c,.45,{dw:false}));
    o.rotation.x=-Math.PI/2; add(o, x,.018,z); });
  // 車道口的「急救站」布條與出口箭頭
  {
    const ban=new THREE.Mesh(new THREE.PlaneGeometry(4.6,.62),
      new THREE.MeshBasicMaterial({map:textTex('急救站　FIRST AID','#5c1f1a','#f0dcc4'),
        transparent:true, side:THREE.DoubleSide}));
    add(ban, 5,2.35,-9.55);
    const ex=new THREE.Mesh(new THREE.PlaneGeometry(.8,.3),
      new THREE.MeshBasicMaterial({map:textTex('出口 →','#0f1518','#7fbf8f'),transparent:true}));
    add(ex, 8.6,2.3,-9.43);
    const ex2=new THREE.Mesh(new THREE.PlaneGeometry(.8,.3),
      new THREE.MeshBasicMaterial({map:textTex('出口 →','#0f1518','#7fbf8f'),transparent:true}));
    add(ex2, -1.6,2.5,-9.43);
  }
  if (!small){
    const sg=new THREE.CylinderGeometry(.035,.035,.12,6);
    const im=new THREE.InstancedMesh(sg,
      new THREE.MeshStandardMaterial({color:0x6a7470,roughness:.6,metalness:.4}), 10);
    const m4=new THREE.Matrix4();
    for (let i=0;i<10;i++){ m4.makeTranslation(-11+i*2.5,2.9,fxRnd(-6,4)); im.setMatrixAt(i,m4); }
    im.instanceMatrix.needsUpdate=true; scene.add(im);
  }
  // 沒開走的那台車：庫備品區旁邊的角落
  {
    const car=new THREE.Group();
    car.add(add(box(4.0,.62,1.78,0x2a3338,{rough:.62,metal:.25}),0,.62,0));
    car.add(add(box(2.2,.5,1.66,0x1d2428,{rough:.35,metal:.15}),-.15,1.14,0));
    [[-1.35,.78],[1.35,.78],[-1.35,-.78],[1.35,-.78]].forEach(([x,z])=>{
      const w=cyl(.32,.22,0x14181a,10,.9); w.rotation.x=Math.PI/2; car.add(add(w,x,.32,z)); });
    car.position.set(-11.4,0,5.0); car.rotation.y=.18; scene.add(car);
    aoDecal(-11.4,5.0,5.0,2.9,.18);
    add(flat(4.4,2.2,0x0e1113,.5), -11.4,.02,5.0);
  }
  // 機車停車區與兩台機車（手機省略）
  if (!small){
  add(flat(2.6,1.4,0x6f7a74,.13), 11.0,.021,4.6);
  [[10.3,4.5],[11.5,4.7]].forEach(([x,z])=>{
    const s=new THREE.Group();
    s.add(add(box(1.3,.2,.34,0x333c40,{rough:.6,metal:.2}),0,.52,0));
    s.add(add(box(.44,.26,.3,0x2b3236,{rough:.6}),-.2,.74,0));
    [[-.52],[.52]].forEach(([wx])=>{ const w=cyl(.24,.14,0x14181a,9,.9);
      w.rotation.x=Math.PI/2; s.add(add(w,wx,.24,0)); });
    s.position.set(x,0,z); s.rotation.y=fxRnd(-.4,.4); scene.add(s); });
  }

  /* ── 變成急救站之後搬進來的 ─────────────────── */
  // 檢傷四色地墊
  [[-2.2,0xc6362f],[-1.0,0xd9a521],[0.2,0x3e8e5a],[1.4,0x2b3236]].forEach(([x,c])=>
    add(flat(1.0,1.6,c,.30), x,.026,-6.4));
  // 動線膠帶：車道口 → 檢傷 → 診療
  [[5,-8.6,3.4,.1],[3.2,-6.6,.1,4.2],[0,-6.6,6.6,.1],[-4.6,-5.2,.1,3.0],[-4.6,-3.6,7.0,.1]]
    .forEach(([x,z,w,d])=>add(flat(w||.1,d||.1,0xd9a44e,.34), x,.025,z));
  // 帆布隔間與布簾（診療區的隱私）
  const tarp=(x,z,w,ry,c,op,hh)=>{ const h=hh||1.7;
    const k=`tarp${c}|${op}`;
    const m=new THREE.Mesh(geo(`P${w}|${h}`,()=>new THREE.PlaneGeometry(w,h)),
      MC[k]||(MC[k]=new THREE.MeshStandardMaterial({color:c,roughness:.95,transparent:true,
        opacity:op==null?.5:op,side:THREE.DoubleSide,depthWrite:false}))); add(m,x,h/2+.05,z,ry); };
  tarp(-5.0,0.98,5.6,0,0x4d5a5e,.5);                // 診療區一的隱私隔間
  tarp(-5.0,5.9,5.6,0,0x4d5a5e,.5);                 // 診療區二
  tarp(10.8,-6.5,4.6,Math.PI/2,0x1a1e20,.8,2.0);    // 遺體區的黑色屏風
  // 隔離區的帳篷
  {
    const t=new THREE.Mesh(new THREE.BoxGeometry(4.4,2.2,4.4),
      new THREE.MeshStandardMaterial({color:0xb9c2bc,roughness:.95,transparent:true,
        opacity:.20,side:THREE.FrontSide,depthWrite:false}));
    add(t,5.5,1.1,-6.5);   // 只畫外面那幾面：走進去的時候不會被一片白牆擋住
    const f=new THREE.Mesh(new THREE.BoxGeometry(4.42,.05,4.42),
      new THREE.MeshBasicMaterial({color:0x8fb6c4,transparent:true,opacity:.30}));
    add(f,5.5,2.18,-6.5);
  }
  // 折疊桌：檢傷與行政
  [[-.4,-5.2,0],[-10.5,-7.4,0],[-10.5,-5.6,Math.PI/2]].forEach(([x,z,ry])=>{
    add(box(1.7,.06,.75,0xa8a190,{rough:.6}), x,.74,z, ry);
    [[-.75,-.3],[.75,-.3],[-.75,.3],[.75,.3]].forEach(([ox,oz])=>
      add(cyl(.03,.72,0x39423f,6,.6,.35), x+(ry?oz:ox),.36,z+(ry?ox:oz))); });
  // 車道口靠牆的擔架
  [[2.0,-9.2,.22],[2.5,-9.2,-.18]].forEach(([x,z,tilt])=>{
    const st=box(.62,1.9,.1,0x5a6b5f,{rough:.8});
    st.rotation.x=Math.PI/2-.24; st.rotation.z=tilt; add(st,x,1.0,z); });
  // 感染性廢棄物桶與針具收集盒
  [[-12.0,2.4,0xc8a52a],[-11.0,2.4,0xc8a52a],[-12.0,4.0,0xc8a52a]].forEach(([x,z,c])=>{
    add(cyl(.28,.72,c,12,.7), x,.36,z);
    add(cyl(.29,.06,0x2b3236,12,.6), x,.74,z); });
  add(box(.34,.3,.26,0xd14b3c,{rough:.6}), -10.2,.9,2.4);
  // 氧氣鋼瓶架
  add(box(1.3,.1,.5,0x39423f,{rough:.7,metal:.3}), 4.0,.06,-8.4);
  // 酒精與洗手架（領藥窗口旁）
  add(cyl(.05,1.1,0x39423f,8,.6,.4), WINDOW[0]+1.3,.55,WINDOW[1]+1.0);
  add(box(.14,.2,.1,0xd8e2dc,{rough:.4,emissive:0x1c2426}), WINDOW[0]+1.3,1.2,WINDOW[1]+1.0);
  // 發電機拉出來的電纜
  [[-11.2,-2.4,1.6,0],[-10.4,-3.2,.1,1.8],[-10.4,-4.2,3.0,0]].forEach(([x,z,w,d])=>
    add(flat(w||.08,d||.08,0x14181a,.8), x,.024,z));
  // 診療區的血壓車與器械盤
  if (!small){
    const t=new THREE.Group();
    t.add(add(box(.62,.05,.44,0x4f5a5e,{rough:.6,metal:.2}),0,.78,0));
    t.add(add(box(.58,.04,.4,0x414a4e,{rough:.6}),0,.44,0));
    t.add(add(box(.22,.16,.14,0x2f3a44,{rough:.5}),-.12,.88,0));
    [[-.26,-.16],[.26,-.16],[-.26,.16],[.26,.16]].forEach(([x,z])=>
      t.add(add(cyl(.028,.78,0x39423f,6,.6,.35),x,.39,z)));
    t.position.set(-6.4,0,-1.2); t.rotation.y=.4; scene.add(t);
  }
  // 靠牆的物資棧板與疊起來的箱子
  if (!small) [[-12.3,-.4],[-12.3,1.4]].forEach(([x,z])=>{
    add(box(1.2,.1,1.0,0x5a5140,{rough:.9}), x,.05,z);
    add(box(1.0,.42,.84,0x726550,{rough:.85}), x,.31,z);
    add(box(.9,.34,.76,0x685d4a,{rough:.85}), x,.69,z); });
  // 檢傷桌上的號碼牌與紙夾
  if (!small){
    add(box(.16,.02,.22,0xe4dcc8,{rough:.6,emissive:0x3a3424,ei:.5}), -.9,.78,-5.1);
    add(box(.3,.03,.22,0x3e4a50,{rough:.5}), .1,.78,-5.3); }
  // 各區入口的掛牌
  [['檢傷','單一入口',0,-3.9],['領藥','窗口',WINDOW[0],WINDOW[1]+1.9],
   ['留觀','10 床',8.5,-3.9],['廢棄物','感染性',-10.5,.9]].forEach(([t,sub,x,z])=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.42),
      new THREE.MeshBasicMaterial({map:textTex(t+'　'+sub,'#141b1e','#c6b184'),transparent:true}));
    add(m,x,2.35,z);
    add(cyl(.012,.55,0x4a5458,6,.6,.4), x,2.6,z); });
}
function init3D(){
  const canvas=$('scene');
  const small=MOBILE();
  renderer=new THREE.WebGLRenderer({canvas,antialias:!small,powerPreference:'high-performance'});
  // 畫質預算：地下室場景不需要 2x 像素比，陰影也只留一盞主燈與工作燈。
  // 手機一開始就給比較低的像素比與較軟的陰影，寧可從頭就順，不要跑三秒才降級。
  M.basePR=Math.min(window.devicePixelRatio||1, small?1.25:1.6);
  renderer.setPixelRatio(M.basePR);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type= small?THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  // 陰影貼圖不必每幀重畫：場景幾乎全是靜態的，由 render3D 依畫質等級決定多久更新一次
  renderer.shadowMap.autoUpdate=false; renderer.shadowMap.needsUpdate=true;
  if (renderer.outputEncoding!==undefined) renderer.outputEncoding=THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping!==undefined){
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12; }
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x06080a);
  scene.fog=new THREE.FogExp2(0x06080a,0.030);
  cam=new THREE.PerspectiveCamera(46,1,0.1,200);

  // 地面：所有地坪共用一張水泥紋理，UV 依實際尺寸放大，紋理密度一致
  const conc=concreteTex();
  const floor=new THREE.Mesh(worldUV(new THREE.PlaneGeometry(64,54),64,54,4),
    new THREE.MeshStandardMaterial({color:0x0e1214,roughness:.78,metalness:.08,map:conc}));
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);

  const outl={pharm:[],other:[]};
  ZONES.forEach(z=>{
    const w=z.b[0]-z.a[0], h=z.b[1]-z.a[1];
    const k='zone'+z.c;
    const m=new THREE.Mesh(worldUV(new THREE.PlaneGeometry(w-.3,h-.3),w-.3,h-.3,4),
      MC[k]||(MC[k]=new THREE.MeshStandardMaterial({color:z.c,roughness:.9,map:conc})));
    m.rotation.x=-Math.PI/2; m.position.set(z.a[0]+w/2,.012,z.a[1]+h/2);
    m.receiveShadow=true; scene.add(m); M.zones.push(m);
    const x0=z.a[0]+.15,x1=z.b[0]-.15,z0=z.a[1]+.15,z1=z.b[1]-.15;
    const P=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]], L=outl[z.id==='pharm'?'pharm':'other'];
    P.forEach((p,i)=>{ const q=P[(i+1)%4]; L.push(new THREE.Vector3(p[0],.03,p[1]),new THREE.Vector3(q[0],.03,q[1])); });
    const sp=labelSprite(z.name,z.k,Math.min(w*.72,4.3));
    sp.position.set(z.a[0]+w/2,2.95,z.a[1]+h/2); scene.add(sp); M.labels.push(sp);
  });
  // 十二區的外框：兩次 draw call 畫完，不是十二次
  [['pharm',0x6b5222],['other',0x2f3b40]].forEach(([k,c])=>scene.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(outl[k]), new THREE.LineBasicMaterial({color:c}))));
  /* 會擋住鏡頭的東西（柱子、外牆、架子背板）：各自一份材質，擋到你的時候變淡。 */
  M.occ=[];
  let PT=null;
  const occ=m=>{ m.material.transparent=false; m.userData.fade=1; M.occ.push(m); return m; };
  const wall=(x,z,w,d,h,c)=>{const m=occ(box(w,h,d,c||0x161d20,{rough:1,own:true}));
    m.geometry=boxWorldUV(m.geometry.clone(),w,h,d,4); m.material.map=conc;
    m.position.set(x,h/2,z); scene.add(m);};
  wall(0,-9.7,27,.5,3.4); wall(0,6.7,27,.5,3.4);
  wall(-13.5,-1.5,.5,17,3.4); wall(13.5,-1.5,.5,17,3.4);
  const lint=occ(box(8,.7,.6,0x1e262a,{own:true})); lint.position.set(5,3.05,-9.7); scene.add(lint);
  const ramp=box(8,.3,6,0x11161a,{rough:1}); ramp.position.set(5,-.1,-12.4); ramp.rotation.x=-.09; scene.add(ramp);
  // 十根柱子：鏡頭在人後面，柱子常常剛好擋在中間——每根各自能變淡
  [[-9.5,-1.5],[-9.5,3.5],[-4.5,-1.5],[-4.5,3.5],[1,-1.5],[1,3.5],[7,-1.5],[7,3.5],[11.4,-1.5],[11.4,3.5]]
    .forEach(([x,z])=>{ const m=occ(box(.8,3.4,.8,0xffffff,{rough:.92,own:true}));
      m.material.map=PT||(PT=pillarTex()); m.position.set(x,1.7,z); scene.add(m);
      aoDecal(x,z,2.0,2.0); });
  // 牆腳的暗：四面牆內側各一條
  aoDecal(0,-9.0,26.5,.9,0,'strip'); aoDecal(0,6.0,26.5,.9,Math.PI,'strip');
  aoDecal(-12.8,-1.5,16.5,.9,Math.PI/2,'strip'); aoDecal(12.8,-1.5,16.5,.9,-Math.PI/2,'strip');

  // 藥局
  const bench=box(4.4,.9,1.5,0x3a3226,{rough:.55,metal:.15});
  bench.position.set(BENCH[0],.45,BENCH[1]); scene.add(bench);
  aoDecal(BENCH[0],BENCH[1],5.4,2.4);
  aoDecal(BENCH[0]-.2,BENCH[1]-1.95,5.6,1.2);           // 藥品架靠牆那一排
  const top=new THREE.Mesh(new THREE.BoxGeometry(4.5,.07,1.6),
    new THREE.MeshStandardMaterial({color:0xd8cbaa,roughness:.3,emissive:0x4a3a1c,emissiveIntensity:.55}));
  top.position.set(BENCH[0],.93,BENCH[1]); top.castShadow=true; scene.add(top); M.bench=top;
  // 處方籃：高度隨佇列
  for (let i=0;i<10;i++){
    const s=box(.62,.07,.44,0xf0e8d4,{rough:.62,emissive:0x4a3c22,ei:.7});
    s.position.set(BENCH[0]+1.6,1.05+i*.075,BENCH[1]+.15);
    s.rotation.y=fxRnd(-.09,.09); s.visible=false; scene.add(s); M.baskets.push(s);
  }
  const tray=box(.76,.07,.56,0x4a4238); tray.position.set(BENCH[0]+1.6,1.0,BENCH[1]+.15); scene.add(tray);
  const hood=box(1.5,1.0,.9,0x2b3336,{rough:.45,metal:.3});
  hood.position.set(BENCH[0]+2.6,.5,BENCH[1]-.2); scene.add(hood);
  const hg=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.6),
    new THREE.MeshBasicMaterial({color:0x8fd6e4,transparent:true,opacity:.16}));
  hg.position.set(BENCH[0]+2.6,.72,BENCH[1]+.26); scene.add(hg);
  const grind=box(.34,.4,.34,0x4a4238); grind.position.set(BENCH[0]-1.6,1.15,BENCH[1]); scene.add(grind);
  const scl=box(.42,.1,.34,0x2e3538); scl.position.set(BENCH[0]-.8,1.0,BENCH[1]); scene.add(scl);
  // 藥品架上的 33 個藥盒用 InstancedMesh 一次畫完，而不是 33 個 draw call
  const catK=Object.keys(CATS);
  for (let s=0;s<3;s++){
    const sh=box(4.6,.09,.55,0x2a3134); sh.position.set(BENCH[0]-.2,.75+s*.72,BENCH[1]-1.9); scene.add(sh);
  }
  {
    const N=33;
    const im=new THREE.InstancedMesh(new THREE.BoxGeometry(.3,.4,.4),
      new THREE.MeshStandardMaterial({roughness:.8}), N);
    im.castShadow=true; im.receiveShadow=true;
    const m=new THREE.Matrix4(), c=new THREE.Color();
    for (let s=0;s<3;s++) for (let i=0;i<11;i++){
      const idx=s*11+i;
      m.makeTranslation(BENCH[0]-2.3+i*.42, 1.0+s*.72, BENCH[1]-1.9);
      im.setMatrixAt(idx,m);
      c.set(CATS[catK[idx%catK.length]].c).multiplyScalar(.55);
      im.setColorAt(idx,c);
    }
    im.instanceMatrix.needsUpdate=true; if (im.instanceColor) im.instanceColor.needsUpdate=true;
    scene.add(im);
  }
  const sb=occ(box(4.9,2.5,.14,0x1a2124,{own:true})); sb.position.set(BENCH[0]-.2,1.25,BENCH[1]-2.16); scene.add(sb);
  const cab=box(1.0,1.7,.6,0x2a2226,{rough:.65,metal:.2});
  cab.position.set(BENCH[0]+2.6,.85,BENCH[1]-1.9); scene.add(cab);
  aoDecal(BENCH[0]+2.6,BENCH[1]-1.9,1.6,1.2);
  const lock=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),
    new THREE.MeshStandardMaterial({color:0xb8586b,emissive:0xb8586b,emissiveIntensity:1.3}));
  lock.position.set(BENCH[0]+2.6,1.05,BENCH[1]-1.58); scene.add(lock); M.lock=lock;
  // 調劑檯下的光暈：讓那盞燈真的在地上留下一圈
  const pool=new THREE.Mesh(new THREE.CircleGeometry(3.4,40),
    new THREE.MeshBasicMaterial({color:0xffcf8a,transparent:true,opacity:.075,depthWrite:false}));
  pool.rotation.x=-Math.PI/2; pool.position.set(BENCH[0],.02,BENCH[1]+.4); scene.add(pool); M.pool=pool;
  // 領藥窗口
  // 窗檯壓低到 1 公尺，來領藥的人才會露在檯面上方
  const win=box(.18,1.0,2.4,0x232b2e); win.position.set(-3.05,.5,WINDOW[1]); scene.add(win);
  const sill=box(.52,.1,2.4,0x3a3226,{emissive:0x2a2010,ei:.9}); sill.position.set(-2.92,1.03,WINDOW[1]); scene.add(sill);
  const winTop=box(.22,.55,2.4,0x1b2225); winTop.position.set(-3.05,2.2,WINDOW[1]); scene.add(winTop);
  [-1.15,1.15].forEach(z=>{ const post=box(.2,1.2,.16,0x1b2225);
    post.position.set(-3.05,1.55,WINDOW[1]+z); scene.add(post); });
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.34),
    new THREE.MeshBasicMaterial({map:textTex('領　藥','#0e1416','#d99a3c'),transparent:true}));
  sign.position.set(-3.18,2.2,WINDOW[1]); sign.rotation.y=-Math.PI/2; scene.add(sign);
  const wl=new THREE.PointLight(0xffc98a,.85,6,2); wl.position.set(-2.4,2.0,WINDOW[1]);
  scene.add(wl); M.winLight=wl;
  // 地面的排隊線
  for (let i=0;i<4;i++){
    const ln=new THREE.Mesh(new THREE.PlaneGeometry(.5,.07),
      new THREE.MeshBasicMaterial({color:0x4a4231,transparent:true,opacity:.55}));
    ln.rotation.x=-Math.PI/2; ln.position.set(-2.0+i*0.9,.025,WINDOW[1]); scene.add(ln);
  }

  // 庫備品區：冰箱
  const fr=box(1.2,2.0,1.0,0x2b3437,{rough:.4,metal:.35});
  fr.position.set(FRIDGE[0],1.0,FRIDGE[1]); scene.add(fr);
  aoDecal(FRIDGE[0],FRIDGE[1],1.9,1.7);
  const fc=document.createElement('canvas'); fc.width=256; fc.height=128;
  M.fctx=fc.getContext('2d'); M.ftex=new THREE.CanvasTexture(fc);
  const fp=new THREE.Mesh(new THREE.PlaneGeometry(.78,.42),
    new THREE.MeshBasicMaterial({map:M.ftex,transparent:true}));
  fp.position.set(FRIDGE[0]+.62,1.45,FRIDGE[1]); fp.rotation.y=Math.PI/2; scene.add(fp);
  M.fglow=new THREE.PointLight(0x4fa8b8,.7,4.5,2);
  M.fglow.position.set(FRIDGE[0]+.9,1.45,FRIDGE[1]); scene.add(M.fglow);
  for (let i=0;i<3;i++){const r=box(2.2,.09,.6,0x263033); r.position.set(-10.2,.6+i*.7,-7.6); scene.add(r);}
  // 發電機
  const gen=box(1.7,1.25,1.1,0x33302a,{rough:.9}); gen.position.set(-12.0,.62,-2.4); scene.add(gen);
  aoDecal(-12.0,-2.4,2.5,1.9);
  M.genLed=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),
    new THREE.MeshStandardMaterial({color:0x4f9268,emissive:0x4f9268,emissiveIntensity:2}));
  M.genLed.position.set(-12.0,1.32,-1.85); scene.add(M.genLed);
  // 行政區白板
  const wb=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.3),
    new THREE.MeshStandardMaterial({color:0xc8cfc9,roughness:.5,emissive:0x20262a,emissiveIntensity:.6}));
  wb.position.set(-10.5,1.9,-8.9); scene.add(wb);
  // 留觀 10 床＋病人
  for (let i=0;i<10;i++){
    const bx=6.3+(i%5)*1.6, bz=-2.4+Math.floor(i/5)*4.6;
    const b=box(.82,.36,2.0,0x232e31,{rough:.8}); b.position.set(bx,.18,bz); scene.add(b);
    aoDecal(bx,bz,1.35,2.6);
    if (i<7){ const pp=person([0xb0453c,0xc09a3e,0x4a8a62][i%3],true,{skin:SKIN[i%SKIN.length],trouser:0x39423f});
      pp.position.set(bx,.36,bz); scene.add(pp);
      const bl=box(.78,.28,1.0,[0x5f6b66,0x6b6458,0x58626b][i%3],{rough:.95});   // 毯子蓋到腰：上衣的檢傷顏色要看得到
      bl.position.set(bx,.6,bz+.52); scene.add(bl); }
    const iv=box(.05,1.5,.05,0x39454a); iv.position.set(bx+.6,.75,bz-.7); scene.add(iv);
    const bag=box(.16,.24,.08,0x9fd6cf,{emissive:0x1a2a28}); bag.position.set(bx+.6,1.42,bz-.7); scene.add(bag);
  }
  // 氧氣鋼瓶
  [[3.6,-8.2],[4.2,-8.2],[-2.4,4.6]].forEach(([x,z])=>{
    const c=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.9,12),
      new THREE.MeshStandardMaterial({color:0x2f6b4f,roughness:.5,metalness:.35}));
    c.position.set(x,.45,z); c.castShadow=true; scene.add(c);
  });
  // 公共空間的候診家屬
  [[-.6,1.6],[.3,2.2],[1.4,1.2],[2.2,2.6],[-1.2,3.4],[-.2,4.6],[2.6,4.2],[1.0,3.4]].forEach(([x,z],i)=>{
    const CIV=[0x6d7a74,0x7d6f62,0x5f6d78,0x7a6b74,0x6b7566,0x84796a,0x5d6a6a,0x726a5e];
    const sit = i<6;                       // 有椅子的就坐著，站著的是還在等叫號的
    const g=person(CIV[i%CIV.length], false,
      {trouser:[0x2b3236,0x33302a,0x2a2f38][i%3], skin:SKIN[i%SKIN.length],
       cap: i===2?0x4a4238 : null, pack: i===5?0x4b4238 : null, sit});
    g.position.set(x,0,z); g.rotation.y = sit ? (Math.PI*1.1+fxRnd(-.35,.35)) : fxRnd(0,6.2);
    scene.add(g);
    if (sit){                               // 折疊椅：椅面加靠背
      const ch=box(.52,.05,.5,0x2a3236,{rough:.8}); ch.position.set(x,.42,z); scene.add(ch);
      const bk=box(.52,.44,.05,0x2a3236,{rough:.8}); bk.position.set(x,.64,z-.24); scene.add(bk);
      if (!small) [[-.22,-.2],[.22,-.2],[-.22,.2],[.22,.2]].forEach(([ox,oz])=>{
        const lg=box(.035,.42,.035,0x39423f,{rough:.7,metal:.3});
        lg.position.set(x+ox,.21,z+oz); scene.add(lg); });
    }
  });

  // 行政區：站長坐在折疊桌前
  {
    const g=person(0xbdb6a4,false,{trouser:0x3a4247,skin:SKIN[1],sit:true,badge:0xc9a24e});
    g.position.set(-10.5,0,-6.6); g.rotation.y=Math.PI*0.95; scene.add(g);
    const ch=box(.52,.05,.5,0x2a3236); ch.position.set(-10.5,.42,-6.6); scene.add(ch);
    const bk=box(.52,.44,.05,0x2a3236); bk.position.set(-10.5,.64,-6.36); scene.add(bk);
  }
  // 檢傷掛號桌後面坐著一位護理師
  {
    const g=person(ROLECOL.nurse,false,{trouser:0x39505a,cap:0xdfe6e2,skin:SKIN[2],sit:true});
    g.position.set(-.4,0,-4.5); g.rotation.y=0; scene.add(g);
    const ch=box(.52,.05,.5,0x2a3236); ch.position.set(-.4,.42,-4.5); scene.add(ch);
    const bk=box(.52,.44,.05,0x2a3236); bk.position.set(-.4,.64,-4.26); scene.add(bk);
  }
  // 走動的隊員
  const roam=[['doc','張醫師',[-5,-2]],['doc','何醫師',[8,1]],['doc','林醫師',[-6,4]],
    ['nurse','李護理師',[7,-3]],['nurse','蘇護理師',[-4,3]],['nurse','周護理師',[10,3]],
    ['vol','吳志工',[0,-7.5]],['psy','葉心理師',[2,4.5]],['lab','汪醫檢師',[-11,-6]],
    ['rad','孫放射師',[11,-2]]];
  const ROLEKIT={doc:{trouser:0x3a4247,badge:0x8fd6c9,skin:SKIN[0],coat:true},
    nurse:{trouser:0x39505a,cap:0xdfe6e2,skin:SKIN[2]},
    psy:{trouser:0x3a4440,badge:0x93d9ae,skin:SKIN[3]},
    lab:{trouser:0x3c3a48,badge:0xc3a2dd,skin:SKIN[1]},
    rad:{trouser:0x39404c,badge:0x9fb0dd,skin:SKIN[2]},
    vol:{trouser:0x3a4038,vest:0x6f8a5f,band:0xd9c05e,skin:SKIN[1]}};
  roam.forEach(([r,name,p],i)=>{
    const g=person(ROLECOL[r], false, ROLEKIT[r]||{}); g.position.set(p[0],0,p[1]); scene.add(g);
    M.npcs.push({g,name,role:r,pos:[...p],tgt:[...p],wait:fxRnd(0,20),cool:fxRnd(0,40)});
  });
  // 諮詢者：需要時才出現在領藥窗口
  M.consult=person(0xd9a06b,false,{own:true}); M.consult.position.set(WINDOW[0]+.4,0,WINDOW[1]);
  M.consult.visible=false; scene.add(M.consult);
  // 維安：每一種先做一個，藏起來。有人經過的時候才出現
  M.sec = SECURITY.map(sp=>{
    const k=sp.kit;
    const g=person(k.col, false, {trouser:k.trouser, helmet:k.helmet, cap:k.cap,
      vest:k.vest, band:k.band, skin:SKIN[k.skin||0], pack: sp.k==='en'?0x5a5648:null});
    g.visible=false; scene.add(g);
    const tag=new THREE.Mesh(new THREE.PlaneGeometry(1.0,.26),
      new THREE.MeshBasicMaterial({map:textTex(sp.name,'#12181b','#'+(k.band||0x9aa89f).toString(16).padStart(6,'0')),
        transparent:true, depthTest:false}));
    tag.position.y=2.12; g.add(tag); g.userData.tag=tag;
    return g; });

  dressStation(small);

  // 燈光
  /* 原本是一盞平的環境光（0.58），所有東西四面一樣亮，人看起來是剪紙。
     改成上冷下暗的半球光：頭肩亮、腳邊暗，形體出得來，整體亮度差不多。 */
  M.amb=new THREE.AmbientLight(0x384b50,.16); scene.add(M.amb);
  M.hemi=new THREE.HemisphereLight(0x5f7c86,0x14110d,.50); scene.add(M.hemi);
  const rim=new THREE.DirectionalLight(0x5f7f88,.22); rim.position.set(-10,6,10); scene.add(rim);
  const key=new THREE.DirectionalLight(0x93a8ad,.30); key.position.set(6,18,2);
  key.castShadow=true; key.shadow.mapSize.set(small?512:1024,small?512:1024); key.shadow.bias=-0.0006;
  key.shadow.camera.left=-18; key.shadow.camera.right=18;
  key.shadow.camera.top=16; key.shadow.camera.bottom=-16; key.shadow.camera.far=44;
  scene.add(key);
  M.work=new THREE.SpotLight(0xffd9a0,2.6,13,Math.PI/4.4,.55,1.6);
  M.work.position.set(BENCH[0],3.15,BENCH[1]+.2);
  M.work.target.position.set(BENCH[0],.9,BENCH[1]);
  M.work.castShadow=true; M.work.shadow.mapSize.set(small?256:1024,small?256:1024); M.work.shadow.radius=3; M.work.shadow.bias=-0.001;
  scene.add(M.work); scene.add(M.work.target);
  const shade=box(1.0,.12,.7,0x30281c); shade.position.set(BENCH[0],3.2,BENCH[1]+.2); scene.add(shade);
  // 看得見的光錐：整個地下室裡，只有這一塊是亮的
  {
    const cone=new THREE.Mesh(new THREE.ConeGeometry(1.45,1.95,20,1,true),
      new THREE.MeshBasicMaterial({color:0xffce8a, transparent:true, opacity:.028,
        blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false}));
    cone.position.set(BENCH[0],2.22,BENCH[1]+.2); scene.add(cone); M.cone=cone;
    const pool=new THREE.Mesh(new THREE.CircleGeometry(1.7,26),
      new THREE.MeshBasicMaterial({color:0xffd9a0, transparent:true, opacity:.075,
        blending:THREE.AdditiveBlending, depthWrite:false}));
    pool.rotation.x=-Math.PI/2; pool.position.set(BENCH[0],0.03,BENCH[1]+.2); scene.add(pool);
  }
  /* 現場的東西：地下室不是空的。有人搬進來的、還沒拆的、臨時湊出來的。 */
  {
    const P=[];
    const stool=(x,z,c)=>{ const g=new THREE.Group();
      const top=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.06,10),
        new THREE.MeshStandardMaterial({color:c,roughness:.8})); top.position.y=.45; g.add(top);
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.45,7),
        new THREE.MeshStandardMaterial({color:0x3a4448,roughness:.7,metalness:.3}));
      leg.position.y=.22; g.add(leg); g.position.set(x,0,z); g.castShadow=true; return g; };
    P.push(stool(BENCH[0]-1.0, BENCH[1]+2.0, 0x6b5a3e));
    P.push(stool(WINDOW[0]-1.5, WINDOW[1]+1.2, 0x4b5256));
    // 補給推車
    const cart=new THREE.Group();
    const deck=box(1.1,.06,.62,0x59636a); deck.position.y=.72; cart.add(deck);
    const deck2=box(1.06,.05,.58,0x4a5359); deck2.position.y=.36; cart.add(deck2);
    [[-.48,-.24],[.48,-.24],[-.48,.24],[.48,.24]].forEach(([x,z])=>{
      const p=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.72,6),
        new THREE.MeshStandardMaterial({color:0x394247,metalness:.4,roughness:.6}));
      p.position.set(x,.36,z); cart.add(p); });
    [[-.3,.9,0x8a9aa0],[.28,.62,0xb0a184]].forEach(([x,h,c])=>{
      const bx=box(.42,.26,.36,c); bx.position.set(x,h,0); cart.add(bx); });
    cart.position.set(BENCH[0]+2.4, 0, BENCH[1]+2.6); cart.rotation.y=.3; P.push(cart);
    // 還沒拆的紙箱
    [[-9.4,-3.2,.55,0x7d6f57],[-9.0,-3.6,.42,0x6d6250],[-9.6,-2.6,.48,0x84775e],
     [3.4,-8.4,.5,0x776952],[3.9,-8.1,.38,0x6a5f4b]].forEach(([x,z,sz,c])=>{
      const b2=box(sz,sz*.78,sz*.84,c); b2.position.set(x,sz*.39,z);
      b2.rotation.y=fxRnd(-.5,.5); b2.castShadow=true; P.push(b2); });
    // 牆上的時鐘與白板
    const clockF=new THREE.Mesh(new THREE.CircleGeometry(.28,20),
      new THREE.MeshStandardMaterial({color:0xd8ddda,roughness:.85,emissive:0x1b2124}));
    clockF.position.set(BENCH[0]+0.2,2.62,BENCH[1]-2.15); P.push(clockF);
    const board=box(2.2,1.25,.05,0x1f2a2e);
    board.position.set(WINDOW[0]-2.6,1.85,WINDOW[1]-1.9); P.push(board);
    P.forEach(o=>{o.receiveShadow=true; scene.add(o);});
  }

  [[-10.5,-6.4,.5],[0,-6.6,.5],[5.5,-6.6,.42],[-5,3,.42],[2,2,.46],[9.5,1,.46],
   [1.5,4.6,.34],[10.5,4.0,.32],[-11,3.2,.3]].forEach(([x,z,i])=>{
    /* 照明範圍從 15 公尺收到 9.5：原本每一處地面同時被四五盞燈照到，整片一樣亮、
       人的頭肩被打成白色。收短之後燈下亮、燈與燈之間暗，地下室該有的樣子。 */
    const l=new THREE.PointLight(0x8fb0b8,i*1.45,9.5,1.7); l.position.set(x,3.0,z);
    l.userData.base=i*1.45; scene.add(l); M.lights.push(l);
  });
  /* 廢棄物區那一支日光燈管快壞了：大部分時間正常，偶爾閃兩下。
     發電機油快見底時（20 公升以下）全站的燈都跟著不穩。 */
  M.flick=M.lights[M.lights.length-1]; M.flick.userData.next=4;
  M.lights.forEach(l=>{ l.userData.home=l.position.clone(); });
  /* ── 緊急照明 ──────────────────────────────
     停電（打擊或柴油用罄）之後，發電機不會再起來，這一班剩下的時間都靠它：
     ・牆上的雙頭緊急照明燈（電池）：八組，燈頭朝下往外打出兩道光；
     ・牆腳的蓄光帶：平常是暗綠色的漆，停電後發亮，標出牆在哪裡；
     ・出口指示燈：一直亮著，停電時更顯眼。
     不另外加燈：九盞天花板燈在停電時搬到緊急燈的位置、換成冷白色，
     燈的數量不變，材質就不用重新編譯，也不會因此掉幀。 */
  M.emg={lamps:[], glows:[]};
  M.emg.beamMat=new THREE.MeshBasicMaterial({color:0xdfe8ff,transparent:true,opacity:0,
    blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  M.emg.stripMat=new THREE.MeshBasicMaterial({color:0x2c4436,transparent:true,opacity:.95});
  const beamG=new THREE.ConeGeometry(.85,2.3,18,1,true).translate(0,-1.15,0);
  [[-10.5,-9.45,0],[-5.6,-9.45,0],[0,-9.45,0],[11,-9.45,0],[1.5,6.45,Math.PI],[9,6.45,Math.PI],
   [-13.25,-1.5,Math.PI/2],[13.25,0,-Math.PI/2]].forEach(([x,z,ry])=>{
    const L=new THREE.Group(); L.position.set(x,0,z); L.rotation.y=ry;
    const body=box(.4,.2,.11,0xc9cdc8,{rough:.5}); body.position.set(0,2.56,.06); L.add(body);
    const led=box(.04,.03,.02,0x3fd46a,{rough:.4,emissive:0x3fd46a,ei:1.2}); led.position.set(.13,2.6,.12); L.add(led);
    [-.12,.12].forEach(hx=>{
      const h=new THREE.Mesh(geo('emgHead',()=>new THREE.CylinderGeometry(.055,.045,.1,10)),stdMat(0xb9beb9,.45));
      h.position.set(hx,2.44,.12); h.rotation.x=.9; L.add(h);
      const bm=new THREE.Mesh(beamG,M.emg.beamMat);         // 光束：往下、往外、略為張開
      bm.position.set(hx,2.42,.16); bm.rotation.set(-.62,0,hx<0?.42:-.42); L.add(bm);
    });
    scene.add(L);
    const fx=Math.sin(ry), fz=Math.cos(ry);
    M.emg.lamps.push(new THREE.Vector3(x+fx*.8,2.15,z+fz*.8));
    const gl=glowSprite(0xe8f0ff,.9,.75); gl.position.set(x+fx*.2,2.44,z+fz*.2); gl.visible=false; M.emg.glows.push(gl);
  });
  // 牆腳的蓄光帶（貼在四面牆的內側）
  [[0,-9.43,26,0],[0,6.43,26,Math.PI],[-13.23,-1.5,15.6,Math.PI/2],[13.23,-1.5,15.6,-Math.PI/2]].forEach(([x,z,w,ry])=>{
    const st=new THREE.Mesh(new THREE.PlaneGeometry(w,.06),M.emg.stripMat);
    st.position.set(x,.32,z); st.rotation.y=ry; scene.add(st); });
  // 出口指示燈的綠光
  M.emg.exit=[glowSprite(0x5fe08a,1.1,.28), glowSprite(0x5fe08a,.9,.28)];
  M.emg.exit[0].position.set(8.6,2.3,-9.3); M.emg.exit[1].position.set(-1.6,2.5,-9.3);
  M.power={mode:'main',t:0};
  // 粉塵
  const dg=new THREE.BufferGeometry(); const N=260, a=new Float32Array(N*3);
  for (let i=0;i<N;i++){a[i*3]=fxRnd(-14,14); a[i*3+1]=fxRnd(.2,3.2); a[i*3+2]=fxRnd(-11,7);}
  dg.setAttribute('position',new THREE.BufferAttribute(a,3));
  // 粉塵改成柔邊的圓點（原本是方塊），近大遠小
  const softDot=(()=>{ const c=document.createElement('canvas'); c.width=c.height=32;
    const g=c.getContext('2d'), gr=g.createRadialGradient(16,16,0,16,16,16);
    gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.4,'rgba(255,255,255,.5)'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr; g.fillRect(0,0,32,32); return new THREE.CanvasTexture(c); })();
  dust=new THREE.Points(dg,new THREE.PointsMaterial({color:0xc8b48a,size:.06,map:softDot,transparent:true,
    opacity:.32,depthWrite:false}));
  scene.add(dust);
  /* 工作燈光錐裡飄的灰：只有那一塊看得到，暖色、加法混合，緩緩轉 */
  {
    const n=small?40:90, mg=new THREE.BufferGeometry(), ma=new Float32Array(n*3);
    for (let i=0;i<n;i++){ const y=fxRnd(.95,3.0), r=Math.sqrt(Math.random())*(.15+(3.1-y)*.62), t=fxRnd(0,6.283);
      ma[i*3]=Math.cos(t)*r; ma[i*3+1]=y; ma[i*3+2]=Math.sin(t)*r; }
    mg.setAttribute('position',new THREE.BufferAttribute(ma,3));
    M.motes=new THREE.Points(mg,new THREE.PointsMaterial({color:0xffd9a0,size:.045,map:softDot,transparent:true,
      opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));
    M.motes.position.set(BENCH[0],0,BENCH[1]+.2); scene.add(M.motes);
  }
  // 光暈：工作燈、窗口的燈、冷藏庫面板、管制櫃的鎖、發電機燈號
  M.glows={
    work: glowSprite(0xffd9a0,1.5,.55),
    win:  glowSprite(0xffc98a,1.1,.35),
    fr:   glowSprite(0x4fa8b8,1.3,.40),
    lock: glowSprite(0xb8586b,.45,.55),
    gen:  glowSprite(0x4f9268,.4,.6),
  };
  M.glows.work.position.set(BENCH[0],3.06,BENCH[1]+.2);
  M.glows.win.position.set(-2.4,2.0,WINDOW[1]);
  M.glows.fr.position.set(FRIDGE[0]+.66,1.45,FRIDGE[1]);
  M.glows.lock.position.set(BENCH[0]+2.6,1.05,BENCH[1]-1.52);
  M.glows.gen.position.set(-12.0,1.32,-1.8);
  // 打擊碎屑
  const bg=new THREE.BufferGeometry(); const B=170, ba=new Float32Array(B*3);
  for (let i=0;i<B;i++){ba[i*3]=fxRnd(-13,-7); ba[i*3+1]=fxRnd(0,3); ba[i*3+2]=fxRnd(-5,1);}
  bg.setAttribute('position',new THREE.BufferAttribute(ba,3));
  debrisPts=new THREE.Points(bg,new THREE.PointsMaterial({color:0xb0a08a,size:.09,transparent:true,opacity:0}));
  scene.add(debrisPts);
  // 玩家（藥師，白袍）
  M.player=person(0xe0dacb,false,{coat:true,exact:true,hair:0x1c1714,long:false});
  const ring=new THREE.Mesh(new THREE.RingGeometry(.5,.6,26),
    new THREE.MeshBasicMaterial({color:0xd99a3c,side:THREE.DoubleSide,transparent:true,opacity:.6}));
  ring.rotation.x=-Math.PI/2; ring.position.y=.05; M.player.add(ring);
  scene.add(M.player);
  // 碎屑每次打擊都從原本的高度落下
  M.debrisY=Float32Array.from({length:B},(_,i)=>ba[i*3+1]);
  optimizeStatic();
  redrawTextOnFonts();
  onResize();
  // 視窗或宿主容器變動時重算斷點；斷點一變版面就換，3D 也要重新量一次
  const relayout=()=>{ const changed=layoutClass(); onResize(); if (changed) dirty.detail=dirty.q=true; };
  window.addEventListener('resize',relayout);
  window.addEventListener('orientationchange',()=>setTimeout(relayout,180));
  [120,400,1200].forEach(ms=>setTimeout(relayout,ms));   // 宿主容器晚一點才定尺寸也接得住
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.documentElement);
}
/* ---------- 靜態合併 ----------
   場景搭好之後，不會動、不會換色、不會藏起來的網格，依材質（與是否投影）
   合併成一個網格。原本主畫面加兩張陰影貼圖每幀要 500 多次 draw call，
   合併後剩下一小部分。會動的、會改的東西列在 keep 裡，原封不動。
   不動的物件同時關掉 matrixAutoUpdate，每幀不再重算六百多個矩陣。 */
function optimizeStatic(){
  const keep=new Set(), dyn=new Set();
  const K=o=>{ if (o && o.isObject3D) keep.add(o); };
  [M.player,M.consult,M.bench,M.lock,M.genLed,M.pool,M.cone,M.work,M.winLight,M.fglow,dust,debrisPts,M.motes]
    .forEach(K);
  Object.values(M.glows||{}).forEach(K);
  if (M.emg) [...M.emg.glows,...M.emg.exit].forEach(K);
  [M.baskets,M.labels,M.occ,M.sec,M.lights].forEach(a=>(a||[]).forEach(K));
  M.npcs.forEach(n=>K(n.g));
  [M.player,M.consult,dust,M.motes,...M.sec,...M.npcs.map(n=>n.g)].forEach(o=>dyn.add(o));
  scene.updateMatrixWorld(true);
  /* 分組：沒有貼圖的實心材質不看顏色、只看質感（粗糙度與金屬度取到 0.05），
     顏色烘進頂點色，十幾種深灰色的箱子、桌腳、椅子就能併成同一個網格。
     有貼圖或半透明的，照材質本身分組。 */
  const q=x=>Math.round(x*20)/20;
  const sig=c=>{
    const m=c.material, sh='|'+(+c.castShadow)+(+c.receiveShadow)+'|'+c.renderOrder+'|'+m.side;
    if (!m.map && !m.transparent && (m.isMeshStandardMaterial||m.isMeshBasicMaterial))
      return (m.isMeshBasicMaterial?'B':`S${q(m.roughness)}|${q(m.metalness)}|${m.isBaked?0:m.emissive.getHex()}|${m.isBaked?0:m.emissiveIntensity}`)+sh;
    return m.uuid+sh;
  };
  const groups=new Map();
  (function walk(o){
    for (const c of o.children){
      if (keep.has(c)) continue;
      if (c.isMesh && !c.isInstancedMesh && c.visible && !c.children.length &&
          !Array.isArray(c.material) && c.geometry && c.geometry.attributes.position){
        const k=sig(c);
        if (!groups.has(k)) groups.set(k,[]);
        groups.get(k).push(c);
      }
      walk(c);
    }
  })(scene);
  let merged=0;
  groups.forEach((list,k)=>{
    if (list.length<2) return;
    const m0=list[0].material, vc=!m0.map && !m0.transparent;
    let mat=m0;
    if (vc){
      mat = m0.isMeshBasicMaterial ? new THREE.MeshBasicMaterial({vertexColors:true, side:m0.side})
        : new THREE.MeshStandardMaterial({vertexColors:true, side:m0.side,
            roughness:q(m0.roughness), metalness:q(m0.metalness),
            emissive:m0.isBaked?0:m0.emissive, emissiveIntensity:m0.isBaked?1:m0.emissiveIntensity});
      mat.isBaked=true;
    }
    const bg=bakeGeo(list,m=>m.matrixWorld);
    if (!vc) bg.deleteAttribute('color');
    list.forEach(m=>m.parent.remove(m)); merged+=list.length;
    const mm=new THREE.Mesh(bg,mat);
    mm.castShadow=list[0].castShadow; mm.receiveShadow=list[0].receiveShadow;
    mm.renderOrder=list[0].renderOrder;
    scene.add(mm);
  });
  // 凍結不動的物件；會動的那幾棵樹（玩家、隊員、窗口前的人、維安、粉塵）照舊
  (function freeze(o){
    for (const c of o.children){
      if (dyn.has(c)) continue;
      c.updateMatrix(); c.matrixAutoUpdate=false;
      freeze(c);
    }
  })(scene);
  scene.updateMatrixWorld(true);
  M.merged=merged;
}
/* 供電狀態：main 正常 → cut 斷電那一兩秒（全黑、燈管殘閃）→ emg 緊急照明。
   恢復供電（接續下一天、加了油）就直接回到 main。 */
function powerLights(now, wob){
  const P=M.power, E=M.emg;
  const setMode=m=>{
    P.mode=m; P.t=now;
    const emg=m==='emg';
    M.lights.forEach((l,i)=>{
      const to = emg && E.lamps[i] ? E.lamps[i] : l.userData.home;
      l.position.copy(to); l.updateMatrix();
      l.color.setHex(emg?0xdfe8ff:0x8fb0b8);
      l.distance = emg?8:9.5; l.decay = emg?1.5:1.7;
    });
    E.glows.forEach(g=>g.visible=emg);
    M.hemi.intensity = m==='main'?.50 : emg?.22:.08;
    M.amb.intensity  = m==='main'?.16 : emg?.07:.03;
    E.stripMat.color.setHex(m==='main'?0x2c4436:0x8affb4);
    E.exit.forEach(g=>g.material.opacity = m==='main'?.28:.75);
  };
  if (S.genOn && P.mode!=='main') setMode('main');
  if (!S.genOn && P.mode==='main') setMode('cut');
  if (P.mode==='cut' && now-P.t>1600) setMode('emg');
  if (P.mode==='main'){ M.lights.forEach(l=>l.intensity=l.userData.base*wob); E.beamMat.opacity=0; return; }
  if (P.mode==='cut'){                      // 斷電：幾支燈管抽搐兩下就熄了
    const k=(now-P.t)/1600;
    M.lights.forEach((l,i)=>l.intensity = (k<.35 && Math.random()<.25) ? l.userData.base*.5 : 0);
    E.beamMat.opacity=0; return; }
  // 緊急照明：電池燈很穩，偶爾一下電壓下沉
  const sag = Math.random()<.004 ? .55 : 1;
  const on = Math.min(1,(now-P.t)/350);     // 繼電器跳起來，燈頭一下子亮
  M.lights.forEach((l,i)=>l.intensity = E.lamps[i] ? .62*on*sag : 0);
  E.beamMat.opacity=.05*on*sag;
}
/* 擋住鏡頭的柱子與牆變淡：從鏡頭往玩家的胸口與頭打射線，
   再往玩家左右各一公尺半打兩條——擋住身邊視野的柱子也一樣礙事。 */
const _ray=new THREE.Raycaster(), _rv=new THREE.Vector3(), _rt=new THREE.Vector3();
function fadeOccluders(dt){
  if (!M.occ) return;
  const hit=new Set();
  const cs=Math.cos(player.yaw), sn=Math.sin(player.yaw), side=player.wide?3:1.5;
  for (const [ox,y] of [[0,.9],[0,1.7],[-side,1.2],[side,1.2]]){
    _rt.set(player.pos[0]+cs*ox,y,player.pos[1]-sn*ox);
    _rv.subVectors(_rt,cam.position); const d=_rv.length(); _rv.divideScalar(d);
    _ray.set(cam.position,_rv); _ray.far=d-.35;
    _ray.intersectObjects(M.occ,false).forEach(h=>hit.add(h.object));
  }
  const k=Math.min(1,dt*9);
  M.occ.forEach(m=>{
    const want=hit.has(m)?.16:1, u=m.userData;
    if (Math.abs(u.fade-want)<.002) return;
    u.fade+= (want-u.fade)*k; if (Math.abs(u.fade-want)<.01) u.fade=want;
    const t=u.fade<.995;
    m.material.opacity=u.fade; m.material.transparent=t; m.material.depthWrite=!t;
  });
}
function onResize(){
  if (!renderer) return;
  const st=$('stage'); const w=st.clientWidth||640,h=st.clientHeight||420;
  renderer.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix();
}
function drawFridge(){
  const g=M.fctx, hot=S.fridge>8;
  g.clearRect(0,0,256,128);
  g.fillStyle=hot?'#2a1408':'#07171a'; g.fillRect(0,0,256,128);
  g.strokeStyle=hot?'#d9873a':'#4fa8b8'; g.lineWidth=4; g.strokeRect(2,2,252,124);
  g.fillStyle=hot?'#f0b95c':'#7fd6e4'; g.font='700 60px "JetBrains Mono",monospace'; g.textAlign='center';
  g.fillText(S.fridge.toFixed(1)+'℃',128,74);
  g.font='400 20px "Noto Sans TC",sans-serif'; g.fillStyle=hot?'#d9873a':'#3d8794';
  g.fillText(hot?'脫離 2-8℃':'冷鏈正常',128,106);
  M.ftex.needsUpdate=true;
}
function stepPlayer(dt){
  walkStep();                                   // 走路的作業進行中：人照進度往目的地走
  const k=(S.task&&S.task.walk)?{}:player.keys;
  if (k.q) player.yaw+=dt*1.5;
  if (k.e) player.yaw-=dt*1.5;
  let mx=0,mz=0;
  if (k.w) mz+=1; if (k.s) mz-=1; if (k.a) mx-=1; if (k.d) mx+=1;
  if (mx||mz){ const l=Math.hypot(mx,mz); mx/=l; mz/=l;
    const sp=4.8*dt, cs=Math.cos(player.yaw), sn=Math.sin(player.yaw);
    player.pos[0]=Math.max(-13,Math.min(13,player.pos[0]+(mx*cs+mz*sn)*sp));
    player.pos[1]=Math.max(-13.2,Math.min(6.2,player.pos[1]+(mz*cs-mx*sn)*sp)); }
  const ip=inZone(player.pos,'pharm');
  if (ip!==S.atBench){ S.atBench=ip; dirty.detail=true;
    $('hud-zone').textContent = ip?'你在調劑檯前':'你不在藥局，無法調劑'; }
  // 走進另一個功能區 → 描述你看見什麼
  const z = ZONES.find(zz=>inZone(player.pos,zz.id));
  const zid = z?z.id:null;
  if (zid!==player.zone){
    player.zone=zid;
    $('hud-place').firstChild.textContent = z? `${z.name}・${z.k}` : '車道口外';
    if (zid && ZONE_LOOK[zid]){
      const lines=ZONE_LOOK[zid];
      const i = (player.seen=player.seen||{}), k=i[zid]=(i[zid]||0);
      narrate(lines[Math.min(k,lines.length-1)]);
      i[zid]=k+1;
      // 隨機遭遇：同一個地方每次不一定遇到同一件事
      if (S.t - (S.lastEnc||-99) > 45 && chance(.45)){
        const pool = ENCOUNTERS.filter(e=>e.z===zid && !(S.encSeen||(S.encSeen={}))[e.t]);
        if (pool.length){
          const e = pick(pool);
          S.encSeen[e.t]=1; S.lastEnc=S.t;
          setTimeout(()=>{ if (e.who) say(e.who, e.t, 5600); else narrate(e.t, 5200);
            if (e.fx) e.fx(); }, 420);
        }
      }
    }
  }
  // 走近隊員 → 對方會叫住你
  for (const n of M.npcs||[]){
    n.cool=Math.max(0,(n.cool||0)-dt*4);
    if (n.cool>0) continue;
    if (Math.hypot(n.pos[0]-player.pos[0], n.pos[1]-player.pos[1]) < 2.3){
      const L=n.lines||GREETS[n.name]; if (!L) continue;
      n.said=(n.said||0);
      say(n.name, L[Math.min(n.said,L.length-1)], 4800);
      n.said++; n.cool=120;
    }
  }
}
function render3D(dt){
  if (!renderer) return;
  const now=performance.now();
  M.player.position.set(player.pos[0],0,player.pos[1]);
  M.player.rotation.y=player.yaw;
  // NPC 漫步
  M.npcs.forEach(n=>{
    n.wait-=dt;
    if (n.wait<=0){ n.tgt=[fxRnd(-2,12),fxRnd(-8,5)]; n.wait=fxRnd(6,18); }
    const dx=n.tgt[0]-n.pos[0], dz=n.tgt[1]-n.pos[1], d=Math.hypot(dx,dz);
    if (d>.2){ const s=Math.min(d,1.5*dt); n.pos[0]+=dx/d*s; n.pos[1]+=dz/d*s;
      n.g.rotation.y=Math.atan2(dx,dz); }
    n.g.position.set(n.pos[0],0,n.pos[1]);
  });
  // 諮詢者／前來幫忙的民眾站在領藥窗口
  // 一次走完佇列：數出待處理件數，順便找出第一個站在窗口的人（每幀都跑，不另外配置陣列）
  let con=null, nPending=0;
  for (const j of S.jobs){
    if (j.status!=='pending') continue;
    nPending++;
    if (!con && (j.kind==='con'||j.kind==='help'||j.kind==='crowd'||j.kind==='lang')) con=j;
  }
  M.consult.visible=!!con;
  if (con){
    const col = con.kind==='help' ? con.h.col
      : con.kind==='crowd' ? 0xd97f8a
      : con.kind==='lang' ? 0xd9a06b
      : (ROLECOL[ROLEKEY[con.role]||'out']);
    (M.consult.userData.body||M.consult.children[0]).material.color.setHex(col);
    M.consult.rotation.y=-Math.PI/2;
    // 窗口前的人：吼的人在動，悲傷的人不動，發抖的人在抖
    const t=now;
    if (con.kind==='crowd'){
      const id=con.id;
      if (id==='shout'||id==='surge'||id==='argue'){
        M.consult.rotation.y=-Math.PI/2+Math.sin(t/170)*0.20;
        M.consult.position.y=Math.abs(Math.sin(t/210))*0.035;
      } else if (id==='acute'){
        M.consult.position.x=WINDOW[0]+.4+Math.sin(t/55)*0.012;
        M.consult.position.y=0;
      } else {                                  // 悲傷：完全不動
        M.consult.position.set(WINDOW[0]+.4,0,WINDOW[1]);
        M.consult.rotation.y=-Math.PI/2-0.25;
      }
    } else { M.consult.position.set(WINDOW[0]+.4,0,WINDOW[1]); M.consult.position.y=0; }
  }
  // 已授權的幫手站進藥局裡
  M.helperNpcs = M.helperNpcs||[];
  while (M.helperNpcs.length < S.helpers.length){
    const i=M.helperNpcs.length, rec=S.helpers[i];
    const g=person(rec.h.col);
    g.position.set(BENCH[0]-2.2+i*1.5, 0, BENCH[1]+1.5);
    g.rotation.y=Math.PI;
    // 頭上的名牌：現場有誰、他在做什麼，抬頭就看得到
    const tag=new THREE.Mesh(new THREE.PlaneGeometry(.86,.24),
      new THREE.MeshBasicMaterial({map:textTex(rec.h.name,'#10161a','#'+rec.h.col.toString(16).padStart(6,'0')),
        transparent:true, depthTest:false}));
    tag.position.y=2.05; g.add(tag); g.userData.tag=tag;
    scene.add(g); M.helperNpcs.push(g);
  }
  M.helperNpcs.forEach((g,i)=>{
    const r=S.helpers[i];
    if (!r || !r.active || r.away>0){          // 走了的人不會還站在那裡
      g.visible=false; return; }
    g.visible=true;
    const at = helperSpot(r);
    const sp = (r.job||r.chore||r.edu) ? 2.6 : 1.1;     // 有事做的人走得快
    g.position.x += (at[0]-g.position.x)*Math.min(1,dt*sp);
    g.position.z += (at[1]-g.position.z)*Math.min(1,dt*sp);
    const dx=at[0]-g.position.x, dz=at[1]-g.position.z;
    if (Math.hypot(dx,dz)>0.12) g.rotation.y = Math.atan2(dx,dz);
    else g.rotation.y += ((r.scope.includes('window')?-Math.PI/2:Math.PI)-g.rotation.y)*Math.min(1,dt*2);
    g.position.y = Math.sin(now/700+i)*0.012
      + ((r.job||r.chore) ? Math.abs(Math.sin(now/300+i))*0.02 : 0);
    if (g.userData.tag) g.userData.tag.quaternion.copy(cam.quaternion);
  });
  // 來領藥（或來理論）的人
  M.pk = M.pk||[];
  while (M.pk.length < S.pickups.length){
    const g=person(0xa9d3de,false,{own:true}); g.visible=false; scene.add(g);
    const mk=new THREE.Mesh(new THREE.PlaneGeometry(.62,.26),
      new THREE.MeshBasicMaterial({map:textTex('領　藥','#1a1206','#f0b95c'),transparent:true,depthTest:false}));
    mk.position.y=2.02; g.add(mk); g.userData.mk=mk;
    M.pk.push(g);
  }
  M.pk.forEach((g,i)=>{
    const k=S.pickups[i];
    if (!k){ g.visible=false; return; }
    g.visible=true;
    const rk=SPEAK_COL[k.who]||'out';
    (g.userData.body||g.children[0]).material.color.setHex(k.kind==='argue'?0xe6ece9:(ROLECOL[rk]||0xa9d3de));
    g.position.set(k.pos[0],0,k.pos[1]);
    const wx=WINDOW[0]+0.55-k.pos[0], wz=WINDOW[1]-k.pos[1];
    if (k.phase!=='wait') g.rotation.y=Math.atan2(wx*(k.phase==='leave'?-1:1), wz*(k.phase==='leave'?-1:1));
    else g.rotation.y=-Math.PI/2;
    g.userData.mk.visible = k.phase==='wait';
    g.userData.mk.lookAt(cam.position);
    if (k.phase==='walk'||k.phase==='leave') g.position.y=Math.abs(Math.sin(now/150+i))*0.035;
    else g.position.y=0;
  });
  // 處方籃高度＝佇列
  const q=Math.min(10,nPending);
  M.baskets.forEach((b,i)=>b.visible=i<q);
  // 相機
  const cs=Math.cos(player.yaw), sn=Math.sin(player.yaw);
  const dist=player.wide?16.5:8.5, ht=player.wide?13.5:5.5, look=player.wide?4.5:2.3;
  let sx=0,sy=0;
  if (shake>0){ shake=Math.max(0,shake-dt*1.5); sx=fxRnd(-.25,.25)*shake; sy=fxRnd(-.2,.2)*shake; }
  cam.position.set(player.pos[0]-sn*dist+sx, ht+sy, player.pos[1]-cs*dist);
  cam.lookAt(player.pos[0]+sn*look, player.wide?.6:1.1, player.pos[1]+cs*look);
  fadeOccluders(dt);
  // 走路的擺動：玩家、隊員、幫手、來領藥的人、巡邏的維安
  gait(M.player,dt);
  M.npcs.forEach(n=>gait(n.g,dt));
  M.helperNpcs.forEach(g=>{ if (g.visible) gait(g,dt); });
  M.pk.forEach(g=>{ if (g.visible) gait(g,dt); });
  M.sec.forEach(g=>{ if (g.visible) gait(g,dt); });
  // 讀數與燈
  if (!M.lastP || now-M.lastP>420){ M.lastP=now; drawFridge(); }
  const hot=S.fridge>8;
  M.fglow.color.setHex(hot?0xd9873a:0x4fa8b8);
  M.fglow.intensity = hot? .55+Math.sin(now/220)*.35 : .7;
  M.genLed.material.color.setHex(S.genOn?0x4f9268:0x5a3030);
  M.genLed.material.emissive.setHex(S.genOn?0x4f9268:0x3a1a1a);
  M.work.intensity=M.power.mode==='cut'?0:(S.genOn?2.6:1.15)+(S.genOn?Math.sin(now/900)*.06:0);   // 檯燈也是電池的：斷電那一下先黑，再自己亮回來
  M.bench.material.emissiveIntensity=S.genOn?.55:.18;
  if (M.pool) M.pool.material.opacity=S.genOn?.075+Math.sin(now/900)*.006:.022;
  if (M.winLight) M.winLight.intensity=S.genOn?(S.pickups.some(k=>k.phase==='wait')?1.35:.85):.2;
  // 燈：油快沒了全站不穩；廢棄物區那支燈管自己會閃
  const lowFuel = S.genOn && S.fuel<20;
  const wob = lowFuel ? (.82+Math.sin(now/97)*.08+Math.sin(now/41)*.06+(Math.random()<.02?-.4:0)) : 1;
  powerLights(now, wob);
  if (S.genOn && M.power.mode==='main' && M.flick){
    const f=M.flick.userData; f.next-=dt;
    if (f.next<=0){ f.burst=fxRnd(.25,.9); f.next=fxRnd(6,22); }
    if (f.burst>0){ f.burst-=dt; M.flick.intensity*= Math.random()<.5 ? .08 : .7; }
  }
  // 光暈跟著燈的狀態走
  if (M.glows){
    const G=M.glows, on=S.genOn?1:.25;
    G.work.material.opacity=G.work.userData.op*on*(M.work.intensity/2.6);
    G.win.material.opacity=G.win.userData.op*(M.winLight.intensity/.85);
    G.fr.material.color.setHex(hot?0xd9873a:0x4fa8b8);
    G.fr.material.opacity=G.fr.userData.op*(M.fglow.intensity/.7);
    G.lock.material.opacity=G.lock.userData.op*(M.lock.material.emissiveIntensity/1.3);
    G.gen.material.color.setHex(S.genOn?0x4f9268:0x5a3030);
    G.gen.material.opacity=S.genOn?G.gen.userData.op:.25;
  }
  if (M.motes){ M.motes.rotation.y+=dt*.05; M.motes.material.opacity=S.genOn?.55:.12; }
  M.lock.material.emissiveIntensity=1.0+Math.sin(now/700)*.35;
  if (dust) dust.rotation.y+=dt*0.012;
  if (debris>(M.lastDebris||0)+.01){           // 新的一次打擊：碎屑回到上方重新落下
    const p=debrisPts.geometry.attributes.position;
    for (let i=0;i<p.count;i++) p.setY(i,M.debrisY[i]);
    p.needsUpdate=true; }
  if (debris>0){ debris=Math.max(0,debris-dt*.35);
    debrisPts.material.opacity=debris*.7;
    const p=debrisPts.geometry.attributes.position;
    for (let i=0;i<p.count;i++){ p.setY(i, Math.max(0,p.getY(i)-dt*1.6)); }
    p.needsUpdate=true;
  }
  M.lastDebris=debris;
  M.labels.forEach(sp=>{ const d=Math.hypot(sp.position.x-player.pos[0],sp.position.z-player.pos[1]);
    sp.material.opacity = player.wide?.6:Math.max(0,Math.min(.58,(d-3)/9)); });
  // 陰影貼圖：畫質等級決定隔幾幀更新一次（場景靜態，只有人在動）
  M.frame=(M.frame||0)+1;
  if (renderer.shadowMap.enabled && M.frame%(perf.shadowEvery||1)===0) renderer.shadowMap.needsUpdate=true;
  // 累了，視野邊緣跟著暗下來（55 以上開始，分 10 段，變了才寫 CSS）
  const fb=Math.max(0,Math.min(10,Math.round((S.fatigue-45)/5.5)));
  if (fb!==M.fatB){ M.fatB=fb; const st=$('stage').style;
    st.setProperty('--vin',(36-fb*1.6)+'%'); st.setProperty('--vo',(.74+fb*.016).toFixed(3)); }
  renderer.render(scene,cam);
}
