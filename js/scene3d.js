"use strict";
/* 還開著 STILL OPEN — three.js 三維場景 */

/* ---------- 12. 三維場景 ---------- */
let renderer, scene, cam, dust, debrisPts;
const M = {zones:[], lights:[], labels:[], baskets:[], npcs:[]};
const player = {pos:[BENCH[0],BENCH[1]+2.5], yaw:Math.PI, keys:{}, wide:false};
const ROLECOL = {doc:0xe6ece9, nurse:0xa9d3de, rad:0x9fb0dd, lab:0xc3a2dd, psy:0x93d9ae, vol:0x8ba0a0, admin:0xbdb6a4, out:0xd9a06b};
const ROLEKEY = {'醫師':'doc','護理師':'nurse','放射師':'rad','醫檢師':'lab','心理諮商／社工師':'psy','站長':'admin','外部':'out'};

function labelSprite(text, sub, w){
  const c=document.createElement('canvas'); c.width=512; c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#cfd6d2'; g.font='700 46px "Noto Sans TC",sans-serif';
  g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,256,46);
  if (sub){ g.fillStyle='#6c7a76'; g.font='400 25px "JetBrains Mono",monospace'; g.fillText(sub,256,90); }
  const tex=new THREE.CanvasTexture(c); tex.minFilter=THREE.LinearFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,opacity:.6}));
  sp.scale.set(w||4,(w||4)/4,1); return sp;
}
function textTex(txt,bg,fg){
  const c=document.createElement('canvas'); c.width=256; c.height=64;
  const g=c.getContext('2d'); g.fillStyle=bg; g.fillRect(0,0,256,64);
  g.strokeStyle=fg; g.lineWidth=3; g.strokeRect(2,2,252,60);
  g.fillStyle=fg; g.font='700 30px "Noto Sans TC",sans-serif';
  g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,128,34);
  const t=new THREE.CanvasTexture(c); t.minFilter=THREE.LinearFilter; return t;
}
function box(w,h,d,color,o){
  o=o||{};
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshStandardMaterial({
    color, roughness:o.rough!=null?o.rough:.85, metalness:o.metal||0,
    emissive:o.emissive||0x000000, emissiveIntensity:o.ei||1}));
  m.castShadow=true; m.receiveShadow=true; return m;
}
/* ---------- 人 ----------
   原本每個人是一根圓柱加一顆球。現在是有肩膀、手臂、腿與頭的身形，
   而且可以戴上裝備：背心、頭盔、帽子、識別臂章。
   幾何與材質共用一份，所以人再多也只是多幾個 draw call。 */
const PG = {};   // 共用幾何
function pgeo(k, make){ return PG[k] || (PG[k]=make()); }
const SKIN=[0xd8c6ab,0xcdb694,0xe0cdb4,0xc2a888];
function person(col, lying, kit){
  kit = kit||{};
  const g=new THREE.Group();
  const mat=(c,r,m)=>new THREE.MeshStandardMaterial({color:c,roughness:r==null?.68:r,metalness:m||0});
  const leg=pgeo('leg',()=>new THREE.CylinderGeometry(.082,.072,.82,7));
  const arm=pgeo('arm',()=>new THREE.CylinderGeometry(.062,.055,.58,7));
  const tor=pgeo('tor',()=>new THREE.CylinderGeometry(.225,.28,.66,10));
  const shl=pgeo('shl',()=>new THREE.CylinderGeometry(.285,.26,.16,10));
  const hed=pgeo('hed',()=>new THREE.SphereGeometry(.152,12,10));
  const nck=pgeo('nck',()=>new THREE.CylinderGeometry(.058,.062,.1,6));
  const trouser = kit.trouser!=null ? kit.trouser : 0x2b3236;
  const skin = kit.skin!=null ? kit.skin : SKIN[0];
  // 躺著的人放在一個內層群組裡旋轉，外層的位置與朝向用法就跟以前一樣
  const inner=new THREE.Group(); g.add(inner);
  const put=(geo,m,x,y,z,rz)=>{ const o=new THREE.Mesh(geo,m);
    o.position.set(x,y,z); if(rz) o.rotation.z=rz; o.castShadow=true; inner.add(o); return o; };
  const mBody=mat(col,.62), mLeg=mat(trouser,.78), mSkin=mat(skin,.72);
  let torso;
  if (kit.sit){
    /* 坐著：大腿往前、小腿往下，身體整個降到椅面上。
       有椅子的地方就該有人坐著——候診的人不會站一整天。 */
    const thigh=pgeo('thigh',()=>new THREE.CylinderGeometry(.082,.078,.46,7));
    const shin =pgeo('shin', ()=>new THREE.CylinderGeometry(.072,.066,.44,7));
    [-.105,.105].forEach(x=>{
      const t=put(thigh,mLeg,x,.46,.20); t.rotation.x=Math.PI/2;
      put(shin,mLeg,x,.24,.40);
    });
    torso=put(tor,mBody,0,.80,0);
    put(shl,mBody,0,1.10,0);
    // 手放在膝上
    const a1=put(arm,mBody,-.27,.86,.10); a1.rotation.x=.55; a1.rotation.z=.12;
    const a2=put(arm,mBody,.27,.86,.10);  a2.rotation.x=.55; a2.rotation.z=-.12;
    put(nck,mSkin,0,1.21,0);
    put(hed,mSkin,0,1.35,0);
    g.userData.seated=true;
  } else {
    put(leg,mLeg,-.105,.41,0); put(leg,mLeg,.105,.41,0);
    torso=put(tor,mBody,0,1.14,0);
    put(shl,mBody,0,1.45,0);
    put(arm,mBody,-.285,1.16,0,.13); put(arm,mBody,.285,1.16,0,-.13);
    put(nck,mSkin,0,1.56,0);
    put(hed,mSkin,0,1.70,0);
  }
  g.userData.body=torso;                       // 需要換色的時候換這一塊
  const dy = kit.sit ? -.355 : 0;               // 坐著的時候所有裝備一起降
  if (kit.vest!=null){                         // 戰術／反光背心
    const v=put(pgeo('vest',()=>new THREE.BoxGeometry(.5,.44,.34)), mat(kit.vest,.72), 0,1.18+dy,0);
    v.scale.set(1,1,1);
    if (kit.band!=null){                       // 背心上的識別條
      put(pgeo('band',()=>new THREE.BoxGeometry(.52,.075,.36)),
        new THREE.MeshStandardMaterial({color:kit.band,roughness:.5,
          emissive:kit.band,emissiveIntensity:.45}), 0,1.30+dy,0);
    }
  }
  if (kit.helmet!=null){                       // 頭盔（半球＋帽簷）
    put(pgeo('hel',()=>new THREE.SphereGeometry(.176,12,8,0,Math.PI*2,0,Math.PI*0.56)),
      mat(kit.helmet,.62,.08), 0,1.705+dy,0);
    put(pgeo('brim',()=>new THREE.CylinderGeometry(.185,.185,.028,12)),
      mat(kit.helmet,.62,.08), 0,1.645+dy,0);
  } else if (kit.cap!=null){                    // 鴨舌帽
    put(pgeo('capc',()=>new THREE.CylinderGeometry(.155,.15,.1,10)), mat(kit.cap,.72), 0,1.79+dy,0);
    put(pgeo('capb',()=>new THREE.BoxGeometry(.26,.022,.16)), mat(kit.cap,.72), 0,1.755+dy,-.16);
  }
  if (kit.pack){                                // 背包／醫療包
    put(pgeo('pack',()=>new THREE.BoxGeometry(.34,.4,.2)), mat(kit.pack,.8), 0,1.2+dy,.24);
  }
  if (kit.badge!=null){                         // 臂章
    put(pgeo('badge',()=>new THREE.BoxGeometry(.09,.09,.03)),
      new THREE.MeshStandardMaterial({color:kit.badge,roughness:.5,
        emissive:kit.badge,emissiveIntensity:.5}), -.31,1.30+dy,0);
  }
  if (lying){ inner.rotation.z=Math.PI/2; inner.position.set(1.0,.18,0); }
  return g;
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
  const flat=(w,d,c,op)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),
    new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op==null?.5:op,depthWrite:false}));
    m.rotation.x=-Math.PI/2; return m; };
  const cyl=(r,h,c,seg,rough,metal)=>new THREE.Mesh(
    new THREE.CylinderGeometry(r,r,h,seg||10),
    new THREE.MeshStandardMaterial({color:c,roughness:rough==null?.7:rough,metalness:metal||0}));

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
    const o=new THREE.Mesh(new THREE.CircleGeometry(r,14),
      new THREE.MeshBasicMaterial({color:0x080b0c,transparent:true,opacity:.45,depthWrite:false}));
    o.rotation.x=-Math.PI/2; add(o, x,.018,z); });
  // 車道口的「急救站」布條與出口箭頭
  {
    const ban=new THREE.Mesh(new THREE.PlaneGeometry(4.6,.62),
      new THREE.MeshBasicMaterial({map:textTex('急救站　FIRST AID','#5c1f1a','#f0dcc4'),
        transparent:true, side:THREE.DoubleSide}));
    add(ban, 5,2.35,-9.55);
    const ex=new THREE.Mesh(new THREE.PlaneGeometry(.8,.3),
      new THREE.MeshBasicMaterial({map:textTex('出口 →','#0f1518','#7fbf8f'),transparent:true}));
    add(ex, 8.6,2.3,-9.6);
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
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
      new THREE.MeshStandardMaterial({color:c,roughness:.95,transparent:true,
        opacity:op==null?.5:op,side:THREE.DoubleSide})); add(m,x,h/2+.05,z,ry); };
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, small?1.25:1.6));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type= small?THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  if (renderer.outputEncoding!==undefined) renderer.outputEncoding=THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping!==undefined){
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.22; }
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x06080a);
  scene.fog=new THREE.FogExp2(0x06080a,0.030);
  cam=new THREE.PerspectiveCamera(46,1,0.1,200);

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(64,54),
    new THREE.MeshStandardMaterial({color:0x0e1214,roughness:.78,metalness:.08}));
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);

  ZONES.forEach(z=>{
    const w=z.b[0]-z.a[0], h=z.b[1]-z.a[1];
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w-.3,h-.3),
      new THREE.MeshStandardMaterial({color:z.c,roughness:.9}));
    m.rotation.x=-Math.PI/2; m.position.set(z.a[0]+w/2,.012,z.a[1]+h/2);
    m.receiveShadow=true; scene.add(m); M.zones.push(m);
    const pts=[], x0=z.a[0]+.15,x1=z.b[0]-.15,z0=z.a[1]+.15,z1=z.b[1]-.15;
    [[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]].forEach(p=>pts.push(new THREE.Vector3(p[0],.03,p[1])));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:z.id==='pharm'?0x6b5222:0x2f3b40})));
    const sp=labelSprite(z.name,z.k,Math.min(w*.72,4.3));
    sp.position.set(z.a[0]+w/2,2.95,z.a[1]+h/2); scene.add(sp); M.labels.push(sp);
  });
  const wall=(x,z,w,d,h,c)=>{const m=box(w,h,d,c||0x161d20,{rough:1}); m.position.set(x,h/2,z); scene.add(m);};
  wall(0,-9.7,27,.5,3.4); wall(0,6.7,27,.5,3.4);
  wall(-13.5,-1.5,.5,17,3.4); wall(13.5,-1.5,.5,17,3.4);
  const lint=box(8,.7,.6,0x1e262a); lint.position.set(5,3.05,-9.7); scene.add(lint);
  const ramp=box(8,.3,6,0x11161a,{rough:1}); ramp.position.set(5,-.1,-12.4); ramp.rotation.x=-.09; scene.add(ramp);
  // 十根柱子：同樣合併成一次 draw call
  {
    const P=[[-9.5,-1.5],[-9.5,3.5],[-4.5,-1.5],[-4.5,3.5],[1,-1.5],[1,3.5],[7,-1.5],[7,3.5],[11.4,-1.5],[11.4,3.5]];
    const im=new THREE.InstancedMesh(new THREE.BoxGeometry(.8,3.4,.8),
      new THREE.MeshStandardMaterial({color:0x1c2427,roughness:.92}), P.length);
    im.castShadow=true; im.receiveShadow=true;
    const m=new THREE.Matrix4();
    P.forEach(([x,z],i)=>{ m.makeTranslation(x,1.7,z); im.setMatrixAt(i,m); });
    im.instanceMatrix.needsUpdate=true; scene.add(im);
  }

  // 藥局
  const bench=box(4.4,.9,1.5,0x3a3226,{rough:.55,metal:.15});
  bench.position.set(BENCH[0],.45,BENCH[1]); scene.add(bench);
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
  const sb=box(4.9,2.5,.14,0x1a2124); sb.position.set(BENCH[0]-.2,1.25,BENCH[1]-2.16); scene.add(sb);
  const cab=box(1.0,1.7,.6,0x2a2226,{rough:.65,metal:.2});
  cab.position.set(BENCH[0]+2.6,.85,BENCH[1]-1.9); scene.add(cab);
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
    if (i<7){ const pp=person([0xb0453c,0xc09a3e,0x4a8a62][i%3],true,{skin:SKIN[i%SKIN.length],trouser:0x39423f});
      pp.position.set(bx,.36,bz); pp.rotation.y=Math.PI/2; scene.add(pp); }
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
  const ROLEKIT={doc:{trouser:0x3a4247,badge:0x8fd6c9,skin:SKIN[0]},
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
  M.consult=person(0xd9a06b); M.consult.position.set(WINDOW[0]+.4,0,WINDOW[1]);
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
    tag.position.y=2.02; g.add(tag); g.userData.tag=tag;
    return g; });

  dressStation(small);

  // 燈光
  scene.add(new THREE.AmbientLight(0x384b50,.58));
  const rim=new THREE.DirectionalLight(0x5f7f88,.22); rim.position.set(-10,6,10); scene.add(rim);
  const key=new THREE.DirectionalLight(0x93a8ad,.30); key.position.set(6,18,2);
  key.castShadow=true; key.shadow.mapSize.set(small?512:768,small?512:768); key.shadow.bias=-0.0006;
  key.shadow.camera.left=-18; key.shadow.camera.right=18;
  key.shadow.camera.top=16; key.shadow.camera.bottom=-16; key.shadow.camera.far=44;
  scene.add(key);
  M.work=new THREE.SpotLight(0xffd9a0,2.6,13,Math.PI/4.4,.55,1.6);
  M.work.position.set(BENCH[0],3.15,BENCH[1]+.2);
  M.work.target.position.set(BENCH[0],.9,BENCH[1]);
  M.work.castShadow=true; M.work.shadow.mapSize.set(small?256:512,small?256:512); M.work.shadow.bias=-0.001;
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
  // 牆邊的緊急照明帶：不亮，但讓空間有邊界
  [[-13.6,-2.0,0],[-13.6,3.5,0],[6.0,-10.4,Math.PI/2],[-2.0,-10.4,Math.PI/2]].forEach(([x,z,ry])=>{
    const st=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.06),
      new THREE.MeshBasicMaterial({color:0x6f8f96, transparent:true, opacity:.5}));
    st.position.set(x,2.42,z); st.rotation.y=ry; scene.add(st);
  });
  [[-10.5,-6.4,.5],[0,-6.6,.5],[5.5,-6.6,.42],[-5,3,.42],[2,2,.46],[9.5,1,.46],
   [1.5,4.6,.34],[10.5,4.0,.32],[-11,3.2,.3]].forEach(([x,z,i])=>{
    const l=new THREE.PointLight(0x8fb0b8,i,15,2); l.position.set(x,3.0,z);
    l.userData.base=i; scene.add(l); M.lights.push(l);
  });
  // 粉塵
  const dg=new THREE.BufferGeometry(); const N=260, a=new Float32Array(N*3);
  for (let i=0;i<N;i++){a[i*3]=fxRnd(-14,14); a[i*3+1]=fxRnd(.2,3.2); a[i*3+2]=fxRnd(-11,7);}
  dg.setAttribute('position',new THREE.BufferAttribute(a,3));
  dust=new THREE.Points(dg,new THREE.PointsMaterial({color:0xc8b48a,size:.035,transparent:true,opacity:.30}));
  scene.add(dust);
  // 打擊碎屑
  const bg=new THREE.BufferGeometry(); const B=170, ba=new Float32Array(B*3);
  for (let i=0;i<B;i++){ba[i*3]=fxRnd(-13,-7); ba[i*3+1]=fxRnd(0,3); ba[i*3+2]=fxRnd(-5,1);}
  bg.setAttribute('position',new THREE.BufferAttribute(ba,3));
  debrisPts=new THREE.Points(bg,new THREE.PointsMaterial({color:0xb0a08a,size:.09,transparent:true,opacity:0}));
  scene.add(debrisPts);
  // 玩家（藥師，白袍）
  M.player=person(0xe8e2d2);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.5,.6,26),
    new THREE.MeshBasicMaterial({color:0xd99a3c,side:THREE.DoubleSide,transparent:true,opacity:.6}));
  ring.rotation.x=-Math.PI/2; ring.position.y=.05; M.player.add(ring);
  scene.add(M.player);
  onResize();
  // 視窗或宿主容器變動時重算斷點；斷點一變版面就換，3D 也要重新量一次
  const relayout=()=>{ const changed=layoutClass(); onResize(); if (changed) dirty.detail=dirty.q=true; };
  window.addEventListener('resize',relayout);
  window.addEventListener('orientationchange',()=>setTimeout(relayout,180));
  [120,400,1200].forEach(ms=>setTimeout(relayout,ms));   // 宿主容器晚一點才定尺寸也接得住
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.documentElement);
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
  const k=player.keys;
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
    tag.position.y=1.86; g.add(tag); g.userData.tag=tag;
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
    const g=person(0xa9d3de); g.visible=false; scene.add(g);
    const mk=new THREE.Mesh(new THREE.PlaneGeometry(.62,.26),
      new THREE.MeshBasicMaterial({map:textTex('領　藥','#1a1206','#f0b95c'),transparent:true,depthTest:false}));
    mk.position.y=1.82; g.add(mk); g.userData.mk=mk;
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
  // 讀數與燈
  if (!M.lastP || now-M.lastP>420){ M.lastP=now; drawFridge(); }
  const hot=S.fridge>8;
  M.fglow.color.setHex(hot?0xd9873a:0x4fa8b8);
  M.fglow.intensity = hot? .55+Math.sin(now/220)*.35 : .7;
  M.genLed.material.color.setHex(S.genOn?0x4f9268:0x5a3030);
  M.genLed.material.emissive.setHex(S.genOn?0x4f9268:0x3a1a1a);
  M.work.intensity=(S.genOn?2.6:1.15)+(S.genOn?Math.sin(now/900)*.06:0);
  M.bench.material.emissiveIntensity=S.genOn?.55:.18;
  if (M.pool) M.pool.material.opacity=S.genOn?.075+Math.sin(now/900)*.006:.022;
  if (M.winLight) M.winLight.intensity=S.genOn?(S.pickups.some(k=>k.phase==='wait')?1.35:.85):.2;
  M.lights.forEach(l=>l.intensity=S.genOn?l.userData.base:.16);
  M.lock.material.emissiveIntensity=1.0+Math.sin(now/700)*.35;
  if (dust) dust.rotation.y+=dt*0.012;
  if (debris>0){ debris=Math.max(0,debris-dt*.35);
    debrisPts.material.opacity=debris*.7;
    const p=debrisPts.geometry.attributes.position;
    for (let i=0;i<p.count;i++){ p.setY(i, Math.max(0,p.getY(i)-dt*1.6)); }
    p.needsUpdate=true;
  }
  M.labels.forEach(sp=>{ const d=Math.hypot(sp.position.x-player.pos[0],sp.position.z-player.pos[1]);
    sp.material.opacity = player.wide?.6:Math.max(0,Math.min(.58,(d-3)/9)); });
  renderer.render(scene,cam);
}
