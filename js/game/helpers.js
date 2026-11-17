"use strict";
/* 還開著 STILL OPEN — 幫手的獨立作業、日常對話與作息 */

/* ---------- 6d. 藥師幫手的獨立作業 ----------
   藥助只能協助你；但一位具備藥師資格、被授權調劑與核對的人，是可以自己把一張處方
   從頭做到尾的。他做得好不好，取決於你有沒有跟他做作業簡介。 */
function soloPharmacist(){
  return S.helpers.find(x=>x.active && x.scope.includes('dispense')
    && x.h.ok.includes('dispense') && x.h.verify==='good');
}
/* 藥助等級的人也能獨立把雜事做完——那本來就是他們熟的事 */
function choreHelpers(){
  return S.helpers.filter(x=>x.active && !x.job &&
    (x.scope.includes('count')||x.scope.includes('pack')));
}
function assignChore(rec, id){
  const b=BGJOBS[id];
  const skilled = rec.h.ok.includes(id==='pack'?'pack':'count');
  rec.chore={id, remain:b.min*(rec.briefed?0.9:1.25), total:b.min, skilled};
  say(rec.h.name, `${b.n}交給我，你去忙。`, 4200);
  mark('P10', skilled, skilled
    ? `委派 ${rec.h.name} 獨立執行「${b.n}」（在其能力範圍內）`
    : `委派 ${rec.h.name} 執行「${b.n}」，但這超出他熟悉的範圍`);
  dirty.helpers=dirty.bg=true;
}
function tickChores(dt){
  for (const rec of S.helpers){
    if (!rec.chore) continue;
    rec.chore.remain-=dt;
    if (rec.chore.remain>0) continue;
    const {id, skilled}=rec.chore; rec.chore=null;
    const botch = !skilled || (!rec.briefed && chance(.25));
    if (id==='count' && botch){
      // 沒受過訓練的人「數」出來的數字，比不數更危險
      DRUGS.forEach(d=>{ if (d.st!=='ctrl' && chance(.35))
        d.book = Math.max(0, d.have + (chance(.5)?rint(1,4):-rint(1,4))); });
      S.counted=true;
      log(`${rec.h.name} 回報盤點完成。數字看起來很整齊。`,'l-warn');
      say(rec.h.name, `我照架上數的，應該都對。`, 4200);
      mark('P4', false, `${rec.h.name} 的盤點結果未經覆核即採信`);
    } else {
      BGJOBS[id].done(rec.h.name);
      if (id==='pack') S.packReady=true;
      mark('P10', true, `${rec.h.name} 獨立完成「${BGJOBS[id].n}」`);
    }
    dirty.helpers=dirty.bg=dirty.stock=true;
  }
}
/* ---------- 6d-2. 日常對話 ----------
   救災不是一連串事件。大部分的時間是人跟人在同一個房間裡待著，
   而人待久了就會講話：抱怨、關心、自言自語、講到一半被打斷。
   每一句都看情境挑，講過的不再講。 */
const CHAT = [
 // ── 幫手（{n} 會換成他的名字）─────────────────
 {w:'h', c:s=>s.t<180, t:['這裡比我想的整齊。你一個人顧的？',
   '外面現在是什麼狀況，你知道嗎？','我剛剛在樓梯間看到有人在排隊，是排這裡嗎？',
   '你從第一天就在這裡了？','你們的藥是怎麼分類的？我怕拿錯。',
   '那個櫃子上鎖的是管制的吧？我不會去碰。',
   '我早上經過學校那邊，操場上停了兩台直升機。']},
 {w:'h', c:s=>s.t>=180&&s.t<420, t:['我幫你把處方籃排一下，最舊的放上面。',
   '剛剛那個小朋友一直哭，是不是很痛？','你中午有吃東西嗎？','這個燈是不是比早上暗了一點。',
   '我跟你說，我以前在的那家店，颱風天也是這樣。',
   '有人問我這裡能不能充電。我說我問一下。',
   '窗口那個阿姨已經來第三次了，她好像忘記自己領過。',
   '你剛剛那個動作——先看袋子再看單子——是不是有什麼講究？']},
 {w:'h', c:s=>s.t>=420, t:['天要黑了。','你今天講幾句話了？','等一下幾點換班？喔……沒有人換。',
   '我兒子跟你差不多年紀。','你手在抖。你自己知道嗎？',
   '我明天還能來嗎？','我要不要幫你把明天早上的先排出來？',
   '外面安靜了。安靜的時候我反而更怕。']},
 {w:'h', c:s=>s.fatigue>55, t:['你去坐十分鐘，我看著窗口。','你這樣撐不到晚上。',
   '我幫你倒水。你放著，我來。','你已經站了十個小時了。我算過。']},
 {w:'h', c:s=>DRUGS.some(d=>d.have<=0), t:['有幾格是空的，我要不要先把牌子翻過來？',
   '那個架子最上面那排，我拿不到。','空掉的那幾格我用紙寫了「無」貼上去，可以嗎？']},
 {w:'h', c:s=>s.fridge>8, t:['冰箱是不是有聲音？','那台是不是該除霜了？','冰箱的燈剛剛閃了一下。']},
 {w:'h', c:s=>s.helpers.filter(r=>r.active).length>=2, t:['我跟他分一下，他數藥我包藥。',
   '我們兩個都在的話，你要不要去躺十分鐘？']},
 // ── 護理師 ───────────────────────────────
 {w:'n', c:()=>true, t:['藥師，等一下那張我先拿走囉。','裡面現在三床，都還算穩。',
   '你那邊還有多少 NS？我們快用完了。','剛剛那個阿伯一直問他的血壓藥。',
   '你要不要喝水？我幫你倒。','外面又進來兩個，都是擦傷。',
   '五床那個血壓一直往下掉，我先跟醫師講。','針具收集盒滿了，我去換一個。',
   '你寫的那張給藥指示我貼在床頭了，家屬看得懂。',
   '藥師，這個要冰的對不對？我先放保冷袋。']},
 {w:'n', c:s=>s.t>360, t:['我下班了——喔，我們沒有下班。','你晚上真的一個人？',
   '我等一下把留觀的單子拿過來給你對。','夜班的備藥包你做了嗎？我可以幫你貼標。',
   '今天已經第三次有人問我「什麼時候可以回家」。']},
 {w:'n', c:s=>s.jobs.filter(j=>j.status==='pending').length>=4,
  t:['我知道你很忙。我等。','你先處理重的，我這個可以等。',
   '我不催你——但三床那個止痛，時間到了。']},
 // ── 醫師 ────────────────────────────────
 {w:'d', c:()=>true, t:['藥師，剛剛那張我改了，等一下重開給你。',
   '這個病人的體重你有嗎？我寫的是估的。','你那邊還有沒有止痛的？口服的。',
   '我開藥之前先問你，這樣比較快。','有你在，我少寫錯很多張。',
   '這個人的腎功能我沒有數據。你幫我盯一下劑量。']},
 {w:'d', c:s=>s.t>300, t:['我今天看了六十幾個。','我等一下要去遺體區一趟。',
   '你有沒有看到我的筆？算了，我用你的。']},
 // ── 站長 ────────────────────────────────
 {w:'a', c:()=>true, t:['藥師辛苦了。上面在問我們還撐得住嗎，我說撐得住。',
   '發電機的油我再想辦法。','有記者想進來拍，我擋掉了。',
   '你要什麼，寫給我，我拿去區公所吵。','名冊我更新了。今天地下室兩百三十一個人。',
   '如果真的要撤，你的管制藥品櫃鑰匙要交給誰？這件事我們要先講好。']},
 // ── 民眾與家屬 ───────────────────────────
 {w:'p', c:()=>true, t:['請問……領藥是在這裡排嗎？','我先生的藥昨天就吃完了。',
   '小朋友吐了兩次，要不要緊？','謝謝你。真的謝謝你。','你們這裡有沒有衛生棉？',
   '我沒有健保卡，這樣可以領嗎？','我媽的藥是白色小顆的，你知道是哪一種嗎？',
   '外面有訊號嗎？我想跟我女兒說一聲我還活著。',
   '我可以坐在這裡嗎？我不吵你，我只是想坐在有燈的地方。']},
 {w:'p', c:s=>s.t>420, t:['今天晚上還會有人在這裡嗎？','你什麼時候休息？',
   '我孫子說這裡很像地下室的醫院。他還不知道這就是醫院。']},
];
const CHAT_WHO = {n:()=>pick(NURSES), d:()=>pick(PRESCRIBERS.filter(x=>/醫師/.test(x.n))).n, a:()=>'站長',
  p:()=>pick(['家屬','家屬','家屬'])};
/* 巡邏：每隔一段時間有人從車道口進來，沿著公共空間走一圈再出去。
   稀有機會是盟軍——迷彩不一樣，語言也不一樣。 */
const PATROL_PATH = [[5,-8.6],[3.0,-6.6],[0.4,-5.4],[0.4,1.2],[3.0,3.8],[6.0,1.0],[3.0,-6.6],[5,-9.2]];
function tickPatrol(dt){
  const P = S.patrol;
  if (P){
    P.t+=dt;
    const tgt=PATROL_PATH[P.i];
    const dx=tgt[0]-P.pos[0], dz=tgt[1]-P.pos[1], d=Math.hypot(dx,dz);
    if (d<.3){
      P.i++;
      if (P.i>=PATROL_PATH.length){       // 走完就離開了
        log(`${P.sp.name} 走出車道口。`,'l-key');
        M.sec[P.k].visible=false; S.patrol=null; S.patrolIn=rnd(55,130); return; }
    } else {
      const sp=1.9*dt; P.pos[0]+=dx/d*Math.min(d,sp); P.pos[1]+=dz/d*Math.min(d,sp);
      P.yaw=Math.atan2(dx,dz);
    }
    const g=M.sec[P.k];
    if (g){ g.visible=true; g.position.set(P.pos[0],0,P.pos[1]);
      g.rotation.y += (P.yaw-g.rotation.y)*Math.min(1,dt*3);
      if (g.userData.tag) g.userData.tag.quaternion.copy(cam.quaternion); }
    // 走近了會跟你講話
    P.cool=Math.max(0,(P.cool||0)-dt);
    if (!P.cool && Math.hypot(P.pos[0]-player.pos[0],P.pos[1]-player.pos[1])<2.6){
      const L=P.sp.lines; const line=L[Math.min(P.said||0,L.length-1)];
      if (typeof line==='string') say(P.sp.name, line, 5400);
      else {
        say(P.sp.name, line.t, 5600);
        narrate(line.zh, 5200);
        const tr=S.helpers.find(x=>x.active&&!x.away&&x.h.lang===P.sp.lang);
        if (tr) narrate(`站內的 ${tr.h.name} 會講${P.sp.lang}——需要的話可以請他過來。`,4600);
      }
      P.said=(P.said||0)+1; P.cool=25;
    }
    return;
  }
  S.patrolIn=(S.patrolIn==null?rnd(30,70):S.patrolIn)-dt;
  if (S.patrolIn>0) return;
  // 出現一組巡邏
  const pool=[]; SECURITY.forEach((sp,i)=>{ for(let k=0;k<sp.w;k++) pool.push(i); });
  const k=pick(pool);
  S.patrol={k, sp:SECURITY[k], i:0, pos:[5,-10.5], yaw:0, t:0, said:0, cool:0};
  S.patrolSeen=S.patrolSeen||[]; S.patrolSeen.push({t:S.t, name:SECURITY[k].name, k:SECURITY[k].k});
  log(`車道口有人進來：${SECURITY[k].name}（${SECURITY[k].tag}）。`,'l-key');
  if (SECURITY[k].lang) narrate(`他的迷彩樣式你不太認得。臂章也不是國軍的。`,5000);
}
function tickChatter(dt){
  S.chatIn=(S.chatIn||rnd(25,45))-dt;
  if (S.chatIn>0) return;
  S.chatIn = rnd(16,38);
  if (speech.q.length>2) return;                 // 已經排了兩句以上就不插隊
  if (S.task && chance(.5)) return;
  S.chatSaid = S.chatSaid || {};
  const helpers=S.helpers.filter(r=>r.active && !r.away);
  const pool=[];
  CHAT.forEach(g=>{
    if (g.w==='h' && !helpers.length) return;
    if (!g.c(S)) return;
    g.t.forEach(t=>{ if(!S.chatSaid[t]) pool.push({w:g.w,t}); });
  });
  if (!pool.length) return;
  const c=pick(pool); S.chatSaid[c.t]=1;
  const who = c.w==='h' ? pick(helpers).h.name : CHAT_WHO[c.w]();
  say(who, c.t, 4600);
}
/* ---------- 6e. 幫手也是人 ----------
   他們會走動、會被叫去別的地方、會累、會有自己的家人在別的區域。
   有人待到你下班，有人幫兩個小時就得走。人是來來去去的。 */
const SPOTS = {
  bench:[BENCH[0]-2.2, BENCH[1]+1.6], shelf:[BENCH[0]-4.2, BENCH[1]-0.6],
  window:[WINDOW[0]-1.2, WINDOW[1]+0.6], door:[BENCH[0]+2.6, BENCH[1]+3.0],
};
function helperSpot(rec){
  if (rec.job) return [BENCH[0]+1.9, BENCH[1]+0.9];
  if (rec.edu)  return SPOTS.window;
  if (rec.chore) return rec.chore.id==='count'?SPOTS.shelf:SPOTS.bench;
  if (rec.scope.includes('window')) return SPOTS.window;
  if (rec.scope.includes('count')||rec.scope.includes('record')) return SPOTS.shelf;
  return SPOTS.bench;
}
const AWAY_LINES=['我去留觀區看一下就回來。','站長叫我過去搬東西，五分鐘。',
  '我去上個廁所，馬上回來。','我去檢傷那邊幫忙抬一下。','我去看我女兒一眼，馬上回來。',
  '樓上在叫人搬水，我去一下。','我去洗個手，剛剛碰到血。'];
const BACK_LINES=['我回來了。','好了，那邊弄完了。','我回來了，需要我做什麼？',
  '外面又多了幾個人在排。','抱歉久了一點。','那邊比這裡更亂。'];
function tickHelperLife(dt){
  for (const rec of S.helpers){
    if (!rec.active) continue;
    // 暫時離開一下（不是永久走人）
    if (rec.away>0){
      rec.away-=dt;
      if (rec.away<=0){ rec.away=0; say(rec.h.name, pick(BACK_LINES), 3200); dirty.helpers=true; }
      continue;
    }
    // 該走了
    if (S.t>=rec.leaveAt){
      rec.active=false; rec.leftAt=S.t;
      const unfinished = rec.job || rec.chore || rec.edu;
      if (rec.job){ rec.job.j.taken=null; rec.job=null; }
      if (rec.edu){ rec.edu.j.taken=null; rec.edu=null; }
      rec.chore=null;
      say(rec.h.name, rec.h.leaveWhy||'我得走了。', 6000);
      log(`${rec.h.name} 離開了急救站（在站 ${Math.round(S.t-rec.joinedAt)} 分鐘）。`
        + (unfinished?'手上的事沒有做完。':''), unfinished?'l-warn':'l-key');
      if (unfinished) mark('P10', false, `${rec.h.name} 中途離開時手上仍有未完成的作業，交接中斷`);
      else mark('P10', true, `${rec.h.name} 在站期間的作業均已結束後才離開`);
      dirty.helpers=dirty.q=dirty.detail=true;
      continue;
    }
    // 偶爾被叫走一下
    if (!rec.job && !rec.chore && !rec.edu && chance(dt*0.0016)){
      rec.away=rnd(6,16); say(rec.h.name, pick(AWAY_LINES), 3400); dirty.helpers=true;
    }
  }
}
function availHelper(scope){
  return S.helpers.find(x=>x.active && !x.away && !x.job && !x.chore && !x.edu
    && x.scope.includes(scope));
}
/* 衛教可以交給人——但只有他真的做得來，衛教才算完成。
   藥助、學生、志工被授權做衛教時，病人會「有人跟他說過話」，卻不一定學到該學的事。 */
function tickHelperEdu(dt){
  for (const rec of S.helpers){
    if (!rec.edu) continue;
    rec.edu.remain-=dt;
    if (rec.edu.remain>0) continue;
    const j=rec.edu.j, name=rec.h.name, able=rec.h.ok.includes('edu');
    rec.edu=null; j.taken=null;
    if (j.status!=='pending'){ dirty.q=true; continue; }
    j.status='done'; j.doneAt=S.t; j.byHelper=name;
    const full = able && (rec.briefed || chance(.6));
    j.score = full ? [j.need,0] : [Math.max(1,j.need-2), able?0:1];
    j.pat.educated.push(j.topic);
    if (full){
      S.eduGood++;
      mark('P6', true, `${j.topic}：由 ${name} 完成給藥指導（在其資格與能力範圍內）`);
      mark('P10', true, `${name} 獨立完成一次衛教`);
      say(name, `${j.pat.nm} 的用藥說明我講完了，他複誦了一次。`, 4600);
      log(`${name} 完成 ${j.pat.nm} 的用藥指導。`,'l-ok');
    } else if (able){
      S.eduBad++;
      mark('P6', false, `${j.topic}：由 ${name} 完成，但未做作業簡介，重點有漏`);
      say(name, `我跟他講過了……大概講了怎麼吃。`, 4600);
      log(`${name} 做了衛教，但沒有講到停藥時機與警訊。`,'l-warn');
    } else {
      S.eduBad++;
      mark('P6', false, `${j.topic}：交給不具給藥指導資格的 ${name}（${rec.h.skill}）`);
      mark('P10', false, `${name} 被授權執行超出其範圍的衛教`);
      say(name, `我照藥袋上寫的念給他聽了。他點頭了。`, 5200);
      log(`※ ${name} 不具給藥指導資格。病人聽到的是念出來的字，不是指導。`,'l-bad');
    }
    dirty.q=dirty.helpers=dirty.detail=true;
  }
}
function tickHelperWork(dt){
  tickChores(dt);
  tickHelperLife(dt);
  tickHelperEdu(dt);
  // 有人被授權衛教，而佇列裡有衛教在等——他會自己接走
  const ed = availHelper('edu');
  if (ed){
    const e = pending().find(j=>j.kind==='edu' && !j.taken);
    if (e){ e.taken=ed;
      ed.edu={j:e, remain: 5*(ed.h.ok.includes('edu')?(ed.briefed?1:1.2):1.5)};
      say(ed.h.name, `${e.pat.nm} 的用藥說明我去講，你先忙處方。`, 4400);
      dirty.q=dirty.helpers=true; }
  }
  // 被授權「領藥窗口秩序」的人，會自己去把秩序拉住——但跟藥有關的決定仍然是你的
  const wd = availHelper('window');
  if (wd){
    const c = pending().find(j=>j.kind==='crowd' && j.deleg && !j.helperTook);
    if (c){ c.helperTook=wd.h.name; wd.order=(wd.order||0)+1;
      say(wd.h.name, `窗口我先去拉一下，你別停下來。`, 4200);
      log(`${wd.h.name} 過去處理窗口的秩序（${c.title}）。`,'l-ok');
      dirty.q=dirty.detail=dirty.helpers=true; }
  }
  const h=soloPharmacist(); if(!h||h.away||h.edu) return;
  h.job = h.job||null;
  if (h.job){
    h.job.remain-=dt;
    if (h.job.remain<=0){ const j=h.job.j; h.job=null; finishHelperRx(h,j); }
    dirty.helpers=true; return;
  }
  h.idle=(h.idle||0)+dt;
  if (h.idle<4) return;
  // 他自己從佇列裡挑一張：不碰管制藥品、不碰 STAT（那些要你自己決定）
  const cand = pending().filter(j=>j.kind==='rx' && !j.ctrl && !j.stat && !j.taken);
  if (!cand.length) return;
  const j=cand[0];
  if (j.drug.have<=0) return;
  j.taken=h; h.idle=0;
  h.job={j, remain:dispTime(j)*(h.briefed?1.0:1.25), total:dispTime(j)};
  say(h.h.name, `#${String(j.n).padStart(2,'0')} ${j.pat.nm} 這張我來配，你先忙。`, 4200);
  dirty.q=dirty.helpers=true;
}
function finishHelperRx(h,j){
  j.taken=null;
  if (j.status!=='pending'){ dirty.q=true; return; }   // 你自己已經處理掉了
  const name=h.h.name;
  if (j.flag){
    if (h.briefed){
      // 有做作業簡介 → 他會停下來問你，而不是配出去
      j.raised=true; j.raisedBy=name;
      say(name, `這張你看一下——${j.why? j.why.split('。')[0]+'。':'我覺得有問題，我不敢配。'}`, 6800);
      mark('P10', true, `${name} 攔下 #${j.n} 並回報你（作業簡介發揮作用）`);
      mark('P7', true, `幫手的疑義被完整傳達`);
      dirty.q=dirty.detail=true; return;
    }
    // 沒做作業簡介 → 他照單配出去
    j.drug.have=Math.max(0,j.drug.have-1);
    j.status='done'; j.doneAt=S.t; j.byHelper=name; S.dispensed++; S.errors++; j.pat.harm++;
    j.pat.given.push({d:j.drug.id,t:S.t});
    say(name, `#${String(j.n).padStart(2,'0')} 配好了，我請人拿走了。`, 4200);
    log(`※ 給藥事件：#${j.n} ${j.pat.nm} ${j.drug.n} — ${REASON_N[j.flag]}（${name} 獨立作業，未經作業簡介）`,'l-bad');
    mark('P1', false, `#${j.n} 由 ${name} 獨立配發，問題未被攔截`);
    mark('P10', false, `${name} 未接受作業簡介即獨立作業，${REASON_N[j.flag]} 未被發現`);
    startPickup(j); dirty.q=dirty.stock=dirty.detail=true; return;
  }
  // 乾淨的處方
  const slip = !h.briefed && chance(0.22);
  j.drug.have=Math.max(0,j.drug.have-1);
  j.status='done'; j.doneAt=S.t; j.byHelper=name; S.dispensed++;
  j.pat.given.push({d:j.drug.id,t:S.t});
  if (slip){
    S.errors++; h.err++;
    say(name, `這個品項……跟我以前用的不太一樣，我照名字拿的。`, 5200);
    log(`※ ${name} 取到同名不同劑量的品項（未經作業簡介）。`,'l-bad');
    mark('P10', false, `${name} 因不熟現行品項而取錯（未做作業簡介）`);
  } else {
    say(name, `#${String(j.n).padStart(2,'0')} 好了。${h.briefed?'我照你說的位置拿的。':''}`, 3800);
    mark('P1', true, `#${j.n} 由 ${name} 獨立完成調劑`);
    mark('P10', true, `${name} 在授權範圍內獨立完成一張處方`);
  }
  startPickup(j);
  dirty.q=dirty.stock=dirty.detail=true;
}
