"use strict";
/* 還開著 STILL OPEN — 主迴圈與畫質自動調整 */

/* ---------- 8. 主迴圈 ---------- */
let last=0, shake=0, debris=0;
/* 畫質自適應：連續掉幀就把陰影與像素比降下來，寧可少一點光影也不要卡 */
const perf={frames:0, acc:0, level:2, warm:0, bad:0};
function tuneQuality(raw){
  if (!renderer) return;
  perf.warm+=raw;
  if (perf.warm<4) return;                 // 開場載入字型與貼圖的前幾秒不算
  perf.frames++; perf.acc+=raw;
  if (perf.acc<2.5) return;
  const fps=perf.frames/perf.acc; perf.frames=0; perf.acc=0;
  perf.bad = fps<26 ? perf.bad+1 : 0;
  if (perf.bad>=2 && perf.level>0){
    perf.bad=0;
    perf.level--;
    if (perf.level===1){ renderer.setPixelRatio(1); log('畫質已調降（像素比）以維持流暢。'); }
    else { renderer.shadowMap.enabled=false; scene.traverse(o=>{o.castShadow=false;});
      log('畫質已調降（關閉陰影）以維持流暢。'); }
    onResize();
  }
}
const MIN_PER_SEC = 0.4;   // ×1：1 實秒 ＝ 0.4 遊戲分鐘（白班 720 分鐘 ≈ 30 分鐘實時）
                           // 慢下來是刻意的：字要來得及看完，決定才是決定
function loop(now){
  requestAnimationFrame(loop);
  const raw = Math.min(0.1,(now-last)/1000); last=now;
  if (S.running && !S.over){ const dt = raw*S.speed*MIN_PER_SEC; S.t+=dt; step(dt); }
  tickPickups(S.running && !S.over ? raw*S.speed*MIN_PER_SEC : 0);
  stepPlayer(raw);
  /* 對話框蓋住場景時（簡報、事件、AAR），場景只是背景：降到約 10fps 就好，手機會省很多電。
     這段時間的幀率不拿來判斷要不要降畫質。 */
  const covered = !$('modal').hidden;
  if (!covered || now-lastDraw>=100){ render3D(covered ? Math.min(0.1,(now-lastDraw)/1000) : raw); lastDraw=now; }
  flushUI();
  if (!covered) tuneQuality(raw);
}
let lastDraw=0;
function step(dt){
  while (S.nextJob<JOBS.length && S.t>=JOBS[S.nextJob].t){
    const spec = JOBS[S.nextJob++];
    // 有前後關係的處方：條件還沒成立就往後挪，成立不了就不出現
    if (spec.dep){
      const p=patById[spec.dep.pid];
      if (!p.given.some(g=>g.d===spec.dep.given)){
        spec.tries=(spec.tries||0)+1;
        if (spec.tries<8){ const at=S.t+rint(25,45);
          const k=JOBS.findIndex(x=>x.t>at); JOBS.splice(k<0?JOBS.length:k,0,{...spec,t:at});
          if (k>=0 && k<=S.nextJob) S.nextJob++; }
        continue;
      }
    }
    if (spec.kind==='evt') fireEvent(spec.id); else pushJob(spec);
  }
  for (let i=S.pending.length-1;i>=0;i--){
    const c = S.pending[i];
    if (S.t<c.at) continue;
    S.pending.splice(i,1);
    if (c.follow){ pushJob({...FOLLOWUP[c.follow], t:S.t}); log('先前的諮詢回覆帶回了一張處方。','l-warn'); continue; }
    if (c.steal){ doTheft(c.steal); continue; }
    if (c.fu){ spawnFollowUp(c.fu); continue; }      // 給錯的藥，從別人的嘴裡回來
    if (c.idn){ pushJob({kind:'idn', t:S.t, ...c.idn}); continue; }
    if (c.raidLoss){                      // 警報時沒鎖的那個櫃子
      const t=DRUGS.filter(d=>d.st==='ctrl'&&d.have>0);
      if (t.length){ const d=pick(t), n=Math.min(d.have,rint(1,3)); d.have-=n;
        S.theft={who:'不明', d, n, t:S.t};
        mark('P3',false,`空襲警報期間管制藥品櫃未上鎖，${d.n.split(' ')[0]} 短少 ${n} ${d.u}`);
        log(`※ 警報結束後清點：${d.n.split(' ')[0]} 少了 ${n} ${d.u}。櫃子當時是開的。`,'l-bad');
        dirty.stock=true; }
      continue; }
    if (c.remind){                          // 先給一劑的那張，剩下的要有人回來要
      const r=c.src;
      log(`護理站問 #${String(r.n).padStart(2,'0')} ${r.drug.n.split(' ')[0]} 剩下的劑量什麼時候給。`,'l-warn');
      say('李護理師', `藥師，${r.pat.nm} 那張只拿到一劑，後面呢？`, 4600);
      continue; }
    const b = c.src;
    if (c.reissue){ pushJob({kind:'rx',pid:b.pid,d:b.d,dose:b.dose,by:b.by,flag:b.flag,why:b.why,
      alt:b.alt,altD:b.altD,ctrl:b.ctrl,stat:b.stat,reissued:true});
      log(`${b.by} 把處方 #${b.n} 原樣送回。`,'l-warn'); }
    else { pushJob({kind:'rx',pid:b.pid,d:b.altD||b.d,dose:'依你的建議修正',by:b.by,flag:null,corrected:true,
      why:'這是依你的攔截建議開立的修正處方。'});
      log(`${b.by} 依你的建議開立修正處方。`,'l-ok'); }
  }
  if (S.task){ S.task.remain-=dt;
    if (S.task.remain<=0){ const f=S.task.then; S.task=(S.taskStack&&S.taskStack.length)?S.taskStack.pop():null;
      if (S.task) log(`回到「${S.task.n}」。`); if(f) f(); }
    dirty.detail=true; }
  if (S.genOn && S.fuel>0){ S.fuel=Math.max(0,S.fuel-dt*0.052);
    if (S.fuel<=0){ S.genOn=false; log('※ 發電機油用罄。','l-bad'); } }
  S.fatigue = Math.min(100,S.fatigue+dt*0.03);
  tickBg(dt); tickHelperWork(dt); tickChatter(dt); tickPatrol(dt);
  tickCold(dt); tickThreat(dt); tickRounds();
  for (const j of pending()){
    if (j.kind!=='rx') continue;
    const age = S.t-j.issued;
    if (j.stat && age>30 && !j.lateFlag){ j.lateFlag=true;
      mark('P1',false,`#${j.n}（STAT）等待逾 30 分鐘`);
      log(`#${String(j.n).padStart(2,'0')} 為立即處方，已等待 ${Math.round(age)} 分鐘。`,'l-warn'); }
  }
  // 19:00：夜班的護理師開始問了
  if (S.t>=660 && !S.packReady && !S.eveAsked){ S.eveAsked=true;
    say('周護理師','藥師，夜班的備藥包好了嗎？你不在的時候，我們就只有那幾包。',5200);
    log('周護理師在問夜班備藥包。','l-warn'); }
  if (S.t>=720 && !S.over) openHandover();
  dirty.top=dirty.q=true;
}
