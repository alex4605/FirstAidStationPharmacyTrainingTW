"use strict";
/* 還開著 STILL OPEN — 領藥、走動所見、維安、支援／CBRNE／語言／窗口／物流 */

/* ---------- 6b. 領藥：有人真的會來拿 ----------
   調劑完不是結束。有人從診療區或留觀區走過來、站在領藥窗口、複誦、簽名、把藥帶走。 */
const SPEAK_COL = {'張醫師':'doc','何醫師':'doc','林醫師':'doc','陳醫師':'doc','郭醫師':'doc',
  '李護理師':'nurse','蘇護理師':'nurse','周護理師':'nurse',
  '孫放射師':'rad','汪醫檢師':'lab','葉心理師':'psy','站長':'admin','家屬':'out','你':'me'};
const NURSES=['李護理師','蘇護理師','周護理師'];
const speech={q:[],cur:null,until:0};
function say(who,text,ms){
  // 有人跟你說話，優先於環境敘述：插到敘述前面，必要時把正在顯示的敘述切掉
  const item={who,text,ms:Math.round((ms||5400)*1.45)};
  const i=speech.q.findIndex(x=>!x.who);
  if (i>=0) speech.q.splice(i,0,item); else speech.q.push(item);
  if (speech.q.length>7) speech.q.shift();
  if (speech.cur && !speech.cur.who) speech.until=0;
  log(`${who}：「${text}」`,'l-say');
}
function narrate(text,ms){
  speech.q.push({who:'',text,ms:Math.round((ms||4600)*1.45)}); if(speech.q.length>6) speech.q.shift();
  log(text,'l-nar');
}

/* ---------- 6c. 走到哪、看見什麼 ----------
   你不是坐在調劑檯前的一雙手。你會走出去，而走出去會看見東西、會被叫住。 */
const ZONE_LOOK = {
  pharm:['調劑檯上那盞暖白工作燈是全站最亮的地方。層架依分類排開，處方籃裡的紙還在那裡。',
         '磨粉機旁邊有一層薄薄的白粉。你上次擦是什麼時候？'],
  store:['庫備品區。上鎖的藥櫃、上鎖的冰箱、溫濕度計。冰箱的壓縮機在低聲運轉——那個聲音代表電還在。',
         '層架上的紙箱按七日儲備堆著。你知道哪一箱快見底，但你沒有寫下來。'],
  tri:  ['檢傷掛號區。單一入口、單向動線，桌上攤著幾張還沒建檔的紙本紀錄單。',
         '掛號桌邊有一疊空白的傷病患資料登錄表，最上面那張被血指印弄髒了。'],
  tx1:  ['診療區一。隔簾拉著，裡面有金屬器械碰撞的聲音，和一個人壓抑的呼吸。',
         '診療區一的推車上，敷料只剩兩包。'],
  tx2:  ['診療區二。地上有還沒清的紗布包裝紙。有人剛在這裡做完什麼。',
         '診療區二暫時空著。點滴架靠在柱子旁邊，像在等下一個人。'],
  obs:  ['留觀區。十張床，七張有人。點滴一滴一滴落下的聲音，在柱列之間來回反射。',
         '留觀區最靠牆那床在咳。柱子擋住了視線，你要走近才看得見是誰。'],
  iso:  ['隔離區。帳篷式的區隔，門口掛著個人防護裝備。裡面沒有聲音。',
         '隔離區門口的防護衣少了兩套。有人進去過。'],
  pub:  ['公共空間。候診的、等領藥的、和單純沒有別的地方可去的人，混在一起坐著。',
         '公共空間的角落有人在低聲吵架。關於位置，或是關於誰先看。'],
  admin:['行政區。白板上寫著今天的人員分派與通報時間，字跡被擦過好幾次。',
         '行政區的無線電在沙沙作響，沒有人在聽。站長不在。'],
  waste:['廢棄物處理區。感染性、針具、一般，三個桶子。針具桶快滿了。',
         '廢棄物處理區的味道比昨天重。清運沒有來。'],
  mort: ['罹難遺體管理區。屍袋整齊地疊著，數量比昨天少了幾個。你沒有細看。',
         '這一區很安靜，而且刻意離公共空間有一段距離。指引是這樣要求的。'],
  ramp: ['車道口。外面的光從斜坡頂端漏進來一點點，剛好夠看見輪印和乾掉的血。',
         '車道口。你在這裡待越久，上面盯著的眼睛就越容易記住這個入口。'],
};
/* 走動時的隨機遭遇：同一個地方每次不一定遇到同一件事 */
const ENCOUNTERS = [
 {z:'store', who:'', t:'你發現有一箱 Cephalexin 被塞在輸液那一層。不知道誰放的，也不知道放多久了。',
  fx:()=>mark('P4',true,'巡視時發現並更正錯置的儲位')},
 {z:'store', who:'', t:'溫濕度計的紙本紀錄停在昨天下午。從那之後沒有人抄過。',
  fx:()=>mark('P5',true,'巡視時發現冷鏈溫度紀錄中斷，補記並恢復每小時記錄')},
 {z:'store', who:'吳志工', t:'藥師，這幾箱是今天早上送來的，我不知道該放哪，先堆在這裡可以嗎？'},
 {z:'waste', who:'', t:'針具桶滿到蓋子合不起來了。旁邊有人用膠帶把它纏住。',
  fx:()=>mark('P3',true,'巡視時發現針具桶滿溢，通報更換')},
 {z:'waste', who:'', t:'一個空的 Morphine 安瓿躺在一般垃圾桶裡。管制藥品的空瓶不該出現在這裡。',
  fx:()=>mark('P3',true,'巡視時發現管制藥品空安瓿流入一般垃圾，收回並登記')},
 {z:'pub',   who:'家屬', t:'藥師，我排在前面，為什麼他先拿？我媽也在等啊。'},
 {z:'pub',   who:'家屬', t:'你們有沒有那種……治高血壓的？我爸的藥吃完三天了，他今天早上站起來就暈。'},
 {z:'pub',   who:'', t:'角落有個孩子在哭，沒有人在哄。他旁邊放著一個空的藥水瓶。'},
 {z:'obs',   who:'周護理師', t:'藥師你來得正好，六床的點滴快跑完了，下一瓶是哪一種？'},
 {z:'obs',   who:'', t:'最靠牆那床的床頭卡上，藥名那一欄是空的。有人給過藥，但沒有人寫。',
  fx:()=>mark('P3',true,'巡視時發現給藥紀錄缺漏，請護理端補登')},
 {z:'tri',   who:'李護理師', t:'藥師，這位剛進來的說他有在吃抗凝血劑，但講不出藥名。你能問得出來嗎？'},
 {z:'tri',   who:'', t:'掛號桌上壓著一疊藥袋，都是民眾自己帶來的。沒有人整理。'},
 {z:'tx1',   who:'張醫師', t:'等一下——這支你剛配的，濃度我再確認一次。我不是懷疑你，是我自己要再看一遍。'},
 {z:'tx2',   who:'', t:'處置台上有兩支已經抽好但沒有貼標的空針。你不知道裡面是什麼。',
  fx:()=>mark('P12',true,'巡視時發現未標示的預抽注射劑，依規棄置')},
 {z:'admin', who:'站長', t:'藥師，你等下有空的話，把你手上的缺藥清單給我一份。我要往上報。'},
 {z:'admin', who:'', t:'白板右下角有人用紅筆寫了「藥師：24h」。字跡不是你的。'},
 {z:'iso',   who:'', t:'隔離區門口的防護衣少了兩套，簽領本上沒有紀錄。'},
 {z:'ramp',  who:'吳志工', t:'藥師，外面現在不要出去。剛剛那個聲音又回來了，而且比較低。'},
 {z:'mort',  who:'', t:'你在門口停了一下，沒有進去。屍袋的數量你昨天數過，今天不想數。'},
 {z:'pharm', who:'', t:'處方籃裡最底下那張的邊角已經被摸得起毛了。它在那裡多久了？'},
];
/* ---------- 維安人員 ----------
   這裡是災區。外面的路在監視之下，而你在地下二樓。
   走道上偶爾會有人經過：國軍的數位迷彩、員警的維安背心、民防的識別臂章。
   偶爾——很偶爾——是盟軍，穿著你不太認得的迷彩，講的話你也不一定聽得懂。
   他們不是敵人也不是麻煩。他們只是今天也在上班的人，而且身上偶爾有你能處理的事。 */
const SECURITY = [
 {k:'mil', w:32, name:'國軍士官', tag:'數位迷彩・步槍背帶',
  kit:{col:0x5d6a4d, trouser:0x505c42, helmet:0x4a5540, vest:0x56634a, band:0x8a9663, skin:1},
  lines:['藥師嗎？這一區我們接手警戒了，門口我留一個人。',
    '我班上有個弟兄手掌被鐵皮劃到，昨天弄的。你們有破傷風嗎？',
    '外面那條路不要走。真的不要走。',
    '你們的發電機聲音在外面聽得到。晚上要不要我幫你們拉個遮音的？']},
 {k:'pol', w:28, name:'員警', tag:'維安勤務・反光背心',
  kit:{col:0x303b4b, trouser:0x28303d, cap:0x242b37, vest:0x2c3543, band:0xd9c35a, skin:0},
  lines:['藥師，領藥那邊我看一下就好，不會打擾你。',
    '剛剛有人在樓梯間問我這裡有沒有安眠藥。我沒讓他進來。',
    '如果有人跟你要管制藥品又拿不出處方，你按牆上那顆鈴，我兩分鐘到。',
    '我今天第三班了。你呢？喔……你沒有班。']},
 {k:'civ', w:22, name:'民防團員', tag:'民防・識別臂章',
  kit:{col:0x4b5b53, trouser:0x404e47, cap:0x3b4741, vest:0x506158, band:0xc9a24e, skin:2},
  lines:['藥師好，我是民防的。上面收容所那邊有人在問慢性病的藥。',
    '我等一下要跑一趟區公所，有什麼要我幫你帶的嗎？',
    '你們這裡的動線我幫你重畫了膠帶，剛剛有人走錯進到隔離區。']},
 // 盟軍：稀有。迷彩樣式你不太認得，講的話也不是你熟的那一種。
 {k:'jp', w:8, name:'盟軍聯絡士官', tag:'迷彩樣式你不太認得・臂章是別的國旗', lang:'日語',
  kit:{col:0x6b6b52, trouser:0x5c5c47, helmet:0x5a5a46, vest:0x66664f, band:0xb9c2bc, skin:1},
  lines:[{t:'すみません、薬剤師さんですか。破傷風の予防接種はありますか。',
    zh:'（他在問你是不是藥師，以及有沒有破傷風疫苗。「破傷風」三個漢字你看得懂。）'},
   {t:'これ、うちの隊員の薬です。成分を確認してもらえますか。',
    zh:'（他遞來一個藥袋，上面是日文。他要你確認成分。）'},
   {t:'ありがとう。本当に助かりました。',
    zh:'（他鞠了一個躬，比你預期的深。）'}]},
 {k:'en', w:6, name:'盟軍衛勤士官', tag:'迷彩樣式你不太認得・臂章上是紅十字', lang:'英語',
  kit:{col:0x74705a, trouser:0x64614f, helmet:0x615e4c, vest:0x6f6c57, band:0xc6362f, skin:3},
  lines:[{t:'Corpsman. Do you have tetanus toxoid? Two of my guys need it.',
    zh:'（他在問破傷風類毒素，他有兩個人需要。）'},
   {t:'Generic names only, please. I cannot read your brand names.',
    zh:'（他請你用學名溝通——他看不懂中文商品名。這句話其實是專業的。）'},
   {t:'Write it down for me. Dose, interval, how many days.',
    zh:'（他要書面的：劑量、間隔、天數。他知道口頭說完就會忘。）'}]},
];
const GREETS = {
  '張醫師':['藥師，等下傷患07 我可能還要一支 TXA，你先幫我留著。',
           '你還好嗎？你今天從八點站到現在，我沒看你坐下過。',
           '我剛剛差點開錯一張。還好你上次跟我說過那件事。',
           '如果我倒下來，你要接手決定給藥。你知道吧？'],
  '何醫師':['藥師，我開的那張 Ipratropium 你配了嗎？他喘得有點快。',
           '有件事想問你——我們的抗生素還撐得住幾天？你比我清楚。',
           '我有個病人堅持要他原本的牌子。你幫我跟他講一下成分一樣好不好？',
           '這幾天我開的藥比我這半年都多。'],
  '林醫師':['藥師，我不太會開內科的藥，你多幫我看一下。',
           '這個劑量你幫我算，我怕我算錯。我平常是拿刀的。',
           '我寫得太簡單的話你直接退我，不要客氣。'],
  '陳醫師':['藥師……你剛剛退我的那張，可以教我一下嗎？我想弄懂。',
           '我這三年開的都是保養的處方。這裡的東西我很多都是第一次。',
           '謝謝你把那張攔下來。我回去查了。'],
  '郭醫師':['小朋友，我開了四十年藥，不過你們的規矩我照著來。',
           '我習慣寫老的商品名，你看不懂就問我，不要猜。',
           '我以前在對面開診所。那棟已經沒有了。'],
  '李護理師':['嗨藥師。等下我去領藥，你不用特地跑一趟。',
             '藥師，留觀三床那個止痛，時間到了我可以給嗎？',
             '你寫在藥袋上的字，家屬說他看得懂。這很少見。',
             '我剛剛把你那張書面指示影印了三份，貼在三個床頭。'],
  '蘇護理師':['藥師，剛剛那支冷藏的我放保冷袋了，你放心。',
             '嗨，問一下，鼻胃管那個到底能不能磨粉？我怕又弄錯。',
             '你上次教我看的那個刻痕，我今天用到了。',
             '我抄的那張你再核一次好不好？我抄了太多張，眼睛花了。'],
  '周護理師':['藥師你慢慢來，我這邊還撐得住。',
             '嗨藥師——你等下經過留觀區的話，幫我看一眼六床的點滴好嗎？',
             '八床的阿嬤剛剛叫我「阿玲」。那是她女兒的名字。',
             '我今天第一次遇到有人跟我說謝謝。我有點不習慣。'],
  '吳志工':['藥師好。有什麼要搬的跟我說，我力氣還夠。',
           '外面又有人抬進來了。我先去幫忙。',
           '我把窗口前面的椅子多排了兩張，站著等太久了。',
           '我不懂藥，但我懂排隊。那個我可以顧。'],
  '孫放射師':['藥師，我這邊沒有電，機器開不了。我來看看有什麼可以幫的。',
             '我本來是照 X 光的。現在我幫忙抬人。'],
  '汪醫檢師':['藥師，血糖機的試紙還有多少？我這邊快用完了。',
             '我可以幫你看效期。那個我很會。'],
  '葉心理師':['藥師，你自己也要顧。我說真的。',
             '如果窗口有人狀況不好，叫我，不要自己扛。',
             '你今天處理的那位太太——我後來陪她坐了半小時。她有講話了。'],
  '站長':['藥師，你需要什麼，寫給我。',
         '這一站我最怕倒下的人，就是你。'],
};
function zoneOfPat(p){ return p.tag===1?'tx1' : p.tag===2?'obs' : 'pub'; }

function pickupLine(j,who){
  const d=j.drug, p=j.pat, z=zoneById[zoneOfPat(p)].name;
  const dose=j.dose;
  if (j.ctrl) return `${d.n.split(' ')[0]}，${p.nm}。管制藥品我這邊簽了，麻煩你也簽一下——雙人核對。`;
  if (j.cold) return `這支要冷藏對吧？我用保冷袋裝，${z}那邊馬上打。`;
  switch (d.f){
    case '針劑': return `${d.n.split(' ')[0]} ${dose}。我複誦一次：${p.nm}、${dose}。我拿去${z}。`;
    case '藥水': return `兒童藥水。量器有附嗎？${p.nm} ${p.wt} 公斤，我照你寫的量給。`;
    case '霧化': return `霧化的，我直接接上去。${p.nm}，${dose}。`;
    case '輸液': return `${d.n.split(' ')[0]}，我先掛上，跑完再過來拿。`;
    case '外用': return `外用的，${p.nm} 那邊我來換藥。`;
    default:    return `${p.nm} 的 ${d.n.split(' ')[0]}，${dose}。我跟晚餐一起送過去。`;
  }
}
function startPickup(j){
  const who = /醫師$/.test(j.by) ? pick(NURSES) : j.by;
  const from = zc(zoneById[zoneOfPat(j.pat)]);
  S.pickups.push({who, job:j, kind:'take', phase:'walk',
    pos:[from[0],from[1]], home:[from[0],from[1]], t:0, said:false});
}
function startReturnVisit(j){
  const from = zc(zoneById[/護理師$/.test(j.by)?'obs':'tx1']);
  const line = j.flag && j.flag===j.reason
    ? `你講得對。${j.pat.nm} 那張我重開一張，改成你建議的。`
    : j.flag ? `我不同意這個理由。${j.pat.nm} 的處方我原樣送回，請照開立配發。`
             : `這張沒有問題，${j.pat.nm} 還在等。請儘速配發。`;
  S.pickups.push({who:j.by, job:j, kind:'argue', phase:'walk', line,
    pos:[from[0],from[1]], home:[from[0],from[1]], t:0, said:false});
}
function tickPickups(dt){
  const W=[WINDOW[0]+0.55, WINDOW[1]];
  for (let i=S.pickups.length-1;i>=0;i--){
    const k=S.pickups[i];
    const tgt = k.phase==='leave' ? k.home : W;
    const dx=tgt[0]-k.pos[0], dz=tgt[1]-k.pos[1], d=Math.hypot(dx,dz);
    if (d>0.25){ const s=Math.min(d,34*dt); k.pos[0]+=dx/d*s; k.pos[1]+=dz/d*s; }
    else if (k.phase==='walk'){
      k.phase='wait'; k.t=0;
      if (!k.said){ k.said=true;
        if (k.kind==='take'){
          say(k.who, pickupLine(k.job,k.who));
          if (k.job.annotated) say('你','我在單子上註記了疑慮，請一併看一下。',3800);
          else if (k.job.flag) say(k.who,'……好，我拿走了。',2600);
        } else say(k.who, k.line, 6200);
      }
    } else if (k.phase==='wait'){
      k.t+=dt;
      if (k.t>3.5){ k.phase='leave';
        if (k.kind==='take' && k.job.ctrl) say(k.who,'簿冊我簽好了，放回你這邊。',3200);
      }
    } else if (k.phase==='leave' && d<=0.25){ S.pickups.splice(i,1); }
  }
  // 對話推進（用實際時間，暫停時也會走完）
  const now=performance.now();
  if (!speech.cur || now>speech.until){
    if (speech.q.length){ speech.cur=speech.q.shift(); speech.until=now+speech.cur.ms; dirty.speech=true; }
    else if (speech.cur){ speech.cur=null; dirty.speech=true; }
  }
}

/* 支援性作業：本來不是你的事，但你幫得上忙 */
function answerAssist(j){
  const good=j.picked.filter(i=>j.pts[i].ok).length, bad=j.picked.filter(i=>!j.pts[i].ok).length;
  const helper = activeWith('draw') || activeWith('pack');
  const mins = (j.id==='a3'?T.assLong:T.ass) * (helper?0.65:1);
  startWork(`${j.title}${helper?`（${helper.h.name}協助）`:''}`, mins, ()=>{
    j.status='done'; j.doneAt=S.t; j.score=[good,bad];
    if (good>=j.need && bad===0){ S.assGood++;
      mark('P12',true,`${j.title}：${good} 項做法皆正確`);
      if (j.id==='a3'){ S.drawnReady=true; log('急救注射藥已預先抽妥並完成標示。','l-ok'); }
      log(`完成支援作業：${j.title}`,'l-ok');
    } else { S.assBad++;
      mark('P12',false,`${j.title}：正確 ${good}／錯誤 ${bad}`);
      log(`${j.title} 完成，但做法有誤或不完整。`,'l-warn'); }
    if (helper) mark('P10',true,`授權 ${helper.h.name} 協助 ${j.title}`);
    dirty.q=dirty.detail=true;
  });
}
/* CBRNE */
function answerCbrne(j,i){
  const st=j.steps[j.step], o=st.opts[i];
  j.res.push({q:st.q,t:o.t,v:o.v,fb:o.fb});
  if (o.v==='good'){ S.cbrGood++; mark('P11',true,`${j.title}／${st.q}：正確`); }
  else if (o.v==='mid'){ mark('P11',false,`${j.title}／${st.q}：不完整`); }
  else { S.cbrBad++; mark('P11',false,`${j.title}／${st.q}：錯誤`);
    if (j.step===0){ S.contaminated=true;
      log('※ 未除污即進站。急救站已遭污染，所有接觸者需除污。','l-bad'); } }
  j.step++;
  if (j.step>=j.steps.length){
    j.status='done'; j.doneAt=S.t;
    const g=j.res.filter(r=>r.v==='good').length;
    log(`${j.title} 處置結束（${g}／${j.steps.length} 步驟正確）。`, g===j.steps.length?'l-ok':'l-warn');
    S.fatigue=Math.min(100,S.fatigue+18);
    if (!S.contaminated) drugById.atr.have = Math.max(0, drugById.atr.have-18);
    dirty.stock=true;
    startWork('脫除防護裝備與清潔消毒', T.doff, ()=>{
      player.pos=[BENCH[0],BENCH[1]+2.5]; player.yaw=Math.PI; log('已完成脫除與清潔消毒，回到藥局。','l-ok'); });
  }
  dirty.q=dirty.detail=true;
  reveal('.step');
}
/* 語言不通的傷患：把用藥安全做完，並保持身分中立 */
function answerLang(j){
  const good=j.picked.filter(i=>j.pts[i].ok).length;
  const bad =j.picked.filter(i=>!j.pts[i].ok).length;
  const bias=j.picked.filter(i=>!j.pts[i].ok && /身分|敵方|用詞不一樣|底細|哪裡生活/.test(j.pts[i].t)).length;
  startWork(`用藥史確認與給藥指導（${j.flagTxt}）`, T.lang, ()=>{
    j.status='done'; j.doneAt=S.t; j.score=[good,bad,bias];
    if (good>=j.need && bad===0){
      mark('P13', true, `${j.nm}：於語言障礙（${j.flagTxt}）下完成過敏史確認與書面指示`);
      mark('P6', true, `${j.nm}：完成給藥指導`);
      log(`完成 ${j.nm} 的用藥史確認與給藥指導。`,'l-ok');
    } else {
      mark('P13', false, `${j.nm}：正確做法 ${good} 項／不當做法 ${bad} 項`);
      log(`${j.nm} 的用藥史確認未完成或做法有誤。`,'l-warn');
    }
    if (bias){
      mark('P13', false, `${j.nm}：以身分推測影響了臨床處置或紀錄`);
      log('※ 依醫療需求施救、不因身分區別，是不可協商的原則。','l-bad');
    }
    dirty.q=dirty.detail=true;
  });
}

/* 窗口前的人。這一題不評價他的情緒，評價你在情緒裡有沒有把該做的事做完。 */
function answerCrowd(j){
  const good=j.picked.filter(i=>j.pts[i].ok).length;
  const bad =j.picked.filter(i=>!j.pts[i].ok).length;
  // 用藥去解決情緒，是這一類題目最典型的錯
  const sed=j.picked.filter(i=>!j.pts[i].ok && /鎮定劑|一顆給他|拿一顆/.test(j.pts[i].t)).length;
  startWork(`處理現場：${j.title}`, T.crowd, ()=>{
    j.status='done'; j.doneAt=S.t; j.score=[good,bad,sed];
    if (good>=j.need && bad===0){
      S.crowdGood++;
      mark('P15', true, `${j.title}：先處理人再處理事，${good} 項做法皆適當`);
      mark('P6', true, `${j.title}：把該講清楚的資訊講清楚了`);
      log(`${j.title} — 處理完了。窗口前安靜下來。`,'l-ok');
    } else {
      S.crowdBad++;
      mark('P15', false, `${j.title}：適當 ${good} 項／不適當 ${bad} 項`);
      log(`${j.title} — 沒有處理好。`,'l-warn');
    }
    if (sed){
      mark('P15', false, `${j.title}：以藥物處理情緒（無醫囑、無適應症）`);
      mark('P3', false, `${j.title}：情緒安撫不是給藥的適應症`);
      log('※ 情緒不是用藥的適應症。這一筆會留在紀錄上。','l-bad');
    }
    if (j.helperTook) mark('P10', true, `${j.helperTook} 在授權範圍內處理了現場秩序`);
    dirty.q=dirty.detail=true;
  });
}
function renderCrowd(j){
  renderChecklistJob(j, {
    title:j.title,
    sub:`${j.who}　·　領藥窗口　·　${clock(j.issued)}`, paper:'現場',
    rows:`<div class="prow"><span>狀況</span><b style="color:var(--ink-dim);font-weight:400">${j.intro}</b></div>`,
    pre:(j.helperTook?`<div class="note ok"><b>${j.helperTook}</b> 已經過去把秩序拉住了。
      你還是要決定跟藥有關的那一部分。</div>`:'')
      + (j.deleg&&!j.helperTook&&availHelper('window')?`<div class="note">
      站內有人被授權「領藥窗口秩序與叫號」——這一件他接得住。</div>`:''),
    hint:`先處理人，再處理事。<b>情緒不是用藥的適應症</b>，但把資訊講清楚、把空間讓出來、
      把該記的記下來，都是你的業務。<br>選出你要採取的做法（至少 ${j.need} 項）。`,
    doneLabel:'適當的處理', badLabel:'不適當的處理', go:'開始處理',
    submit:answerCrowd});
}

/* ---------- 品項辨識 ----------
   盟軍與國際 NGO 的物資走的是別的國家的供應鏈：商品名不一樣、含量不一樣、
   有時候連外盒的字都看不懂。國軍與民防的偶爾也會是別家藥廠的學名藥。
   在比對完學名、含量、劑型與效期之前，那些東西不算庫存——它們只是紙箱。 */
function renderIdn(j){
  const done=j.status==='done';
  let h=`<div class="pane"><h2>待辨識：${j.items.length} 項</h2>
    <div class="sub">${j.from}　·　${j.who}　·　${clock(j.issued)}</div>
    <div class="paper" data-t="待辨識">
      ${j.items.map(it=>`<div class="prow"><span>${it.name.split(' ')[0]}</span>
        <b>${it.brand}<br><span style="color:var(--ink-faint);font-weight:400;font-size:11px">${it.note}　·　${it.n} 單位</span></b></div>`).join('')}
    </div>`;
  if (done){
    h+=`<div class="note ${j.skipped?'':'ok'}" style="${j.skipped?'border-left-color:var(--bad)':''}">
      ${j.skipped
        ? '你把它們直接上架了。成分也許一樣，含量也許不一樣——而下一個拿的人不會知道。'
        : `已完成比對並貼上中文標示，${j.items.length} 項入庫。`}</div></div>`;
    put('detail',h); return;
  }
  const helper=availHelper('count');
  h+=`<div class="note ${j.intl?'warn':''}">${j.intl
    ? '這是從別的國家的供應鏈來的。<b>商品名、含量、標示方式都可能不一樣</b>，'
      +'而「成分一樣」不等於「可以照支數代換」。'
    : '這是國內的學名藥，成分相同但廠商不同。<b>含量與外觀仍要核對一次</b>。'}</div>
    ${helper?`<div class="note ok">${helper.h.name} 可以幫你一起比對。`
      +`${helper.h.arch==='ngo_intl'?`——而且國際品項正是${helper.h.ta}熟的東西。`:''}</div>`:''}
    <div class="note">比對完才能上架。<b>${IDN_MIN(j)} 分鐘</b>。</div>
    <div class="acts">
      <button class="act" data-cmd="idngo"><span class="an">逐項比對學名、含量、劑型與效期，換算成本站的單位並貼上中文標示
        <span class="aw">${IDN_MIN(j)} 分鐘${helper?`・${helper.h.name} 協助`:''}</span></span><span class="ac">辨識</span></button>
      <button class="act warnb" data-cmd="idnskip"><span class="an">先上架，之後有空再說
        <span class="aw">現在省下的時間，之後可能要用別的東西付</span></span><span class="ac">跳過</span></button>
    </div></div>`;
  if (put('detail',h)){
    const q=c=>$('detail').querySelector(`[data-cmd="${c}"]`);
    q('idngo').onclick=()=>doIdentify(j,true);
    q('idnskip').onclick=()=>doIdentify(j,false);
  }
}
function IDN_MIN(j){
  const helper=availHelper('count');
  const base = (j.intl? T.idnIntl : T.idnDom) + j.items.length*(j.intl?2:1.2);
  const fast = helper ? (helper.h.arch==='ngo_intl'?0.6:0.8) : 1;
  return Math.round(base*fast);
}
function doIdentify(j, doIt){
  const helper=availHelper('count'), name=helper?helper.h.name:null;
  if (!doIt){
    j.status='done'; j.doneAt=S.t; j.skipped=true;
    j.items.forEach(it=>{ const d=drugById[it.id]; if(!d) return;
      d.have+=it.n; d.book+=it.n; d.unverified=(d.unverified||0)+it.n; });
    mark('P4', false, `${j.from} 送來的 ${j.items.length} 項未經比對即上架（含量與商品名未確認）`);
    mark('P2', false, `未辨識的外來品項已進入可調劑的庫存`);
    log('※ 未辨識即上架。架上現在有你不確定含量的東西。','l-bad');
    dirty.q=dirty.detail=dirty.stock=true; return;
  }
  startWork(`品項辨識與換算（${j.from}）${name?`・${name}協助`:''}`, IDN_MIN(j), ()=>{
    j.status='done'; j.doneAt=S.t;
    j.items.forEach(it=>{ const d=drugById[it.id]; if(!d) return; d.have+=it.n; d.book+=it.n; });
    mark('P4', true, `${j.from} 送來的 ${j.items.length} 項完成學名、含量與效期比對後入庫`);
    mark('P2', true, `外來品項已換算規格並貼上中文標示`);
    if (name){ mark('P10', true, `${name} 協助完成外來品項辨識`); }
    log(`${j.items.length} 項完成辨識並上架。`,'l-ok');
    dirty.q=dirty.detail=dirty.stock=true;
  });
}

/* 物流：來給的，或來要的 */
function answerLogi(j){
  const c=j.c, give=j.mode==='give';
  // 送出當下把決策內容凍結起來：之後面板怎麼重繪都不影響已經做過的決定
  const picked=(j.picked||[]).slice(), rec=!!j.rec, why=j.why||'', book=!!j.book;
  j.pickedAt=picked;
  const hasList = !!(j.hasList||j.askedList);
  j.recAt=rec; j.whyAt=why; j.bookAt=book; j.listAt=hasList;
  startWork(`${c.f}：${give?'接收補給':'處理徵調'}`, T.logi, ()=>{
    j.status='done'; j.doneAt=S.t;
    if (give){
      const credible = S.counted;
      let got=[];
      const unknown=[];
      picked.forEach(id=>{
        const it=ASK_ITEMS.find(x=>x.id===id);
        if (it && it.sup){ got.push(it.sup()); return; }   // 耗材：不是庫存，是能不能作業
        const d=drugById[id]; if (!d) return;
        // 有盤點 → 你說得出數字，要什麼給什麼；沒盤點 → 只能拿到打折的標準包
        const n = Math.max(credible?3:1, Math.round(d.q * (credible? rnd(.28,.5) : rnd(.08,.2))));
        // 不是我們熟的那個廠牌 → 先不上架，進待辨識區
        if (chance(c.foreign||0)){
          const tg=pick(FOREIGN_TAGS);
          unknown.push({id, n, brand:tg.b, note:tg.note, name:d.n});
          got.push(`${d.n.split(' ')[0]} +${n}（待辨識）`);
        } else { d.have+=n; d.book+=n; got.push(`${d.n.split(' ')[0]} +${n}`); }
      });
      if (unknown.length){
        j.unknown=unknown;
        log(`※ ${c.f} 送來的 ${unknown.length} 項不是我們慣用的廠牌，先放在待辨識區，還不能上架。`,'l-warn');
        say(c.who, c.intl? '這些是我們那邊的供應鏈拿到的，名字跟你們的不一樣。你自己確認一下。'
          : '這批是別家藥廠的學名藥，成分一樣，包裝不一樣。你再看一下。', 6200);
        S.pending.push({at:S.t+rnd(2,6), idn:{from:c.f, who:c.who, intl:!!c.intl, items:unknown}});
      }
      j.got=got; j.credible=credible;
      log(`${c.f} 補給：${got.join('、')||'（你沒有提出任何品項）'}`, got.length?'l-ok':'l-warn');
      if (!picked.length){ mark('P14', false, `${c.f} 到訪但未提出任何需求`); }
      else if (credible){
        mark('P14', true, `依盤點結果向 ${c.f} 提出具體品項與數量，取得 ${picked.length} 項補給`);
        mark('P4', true, '以實際庫存數字支撐對外請求');
        say(c.who, '你這份清單很清楚，我照單給。這種站我今天第三個，只有你說得出數字。', 6200);
      } else {
        mark('P14', false, `未盤點即提出需求，只能領到標準包（實得數量顯著偏低）`);
        say(c.who, '你講不出數量，我只能照標準包給。下一站還在等。', 5600);
      }
    } else {
      const gaveList=[], refused=[];
      picked.forEach(id=>{
        const d=drugById[id]; if (!d) return;
        const n = Math.max(1, Math.round(d.have*rnd(.25,.45)));
        d.have=Math.max(0,d.have-n); d.book=Math.max(0,d.book-n);
        gaveList.push(`${d.n.split(' ')[0]} −${n}`);
        if (d.st==='ctrl'){
          mark('P3', rec, rec
            ? `管制藥品 ${d.n.split(' ')[0]} 移轉已完成紀錄與雙方簽收`
            : `管制藥品 ${d.n.split(' ')[0]} 移轉未辦理紀錄與簽收`);
          mark('P3', book, book
            ? `管制藥品 ${d.n.split(' ')[0]} 移轉已逐筆登記於簿冊（品項、數量、去向、雙方簽章）`
            : `管制藥品 ${d.n.split(' ')[0]} 移轉未登記於管制藥品簿冊`);
          if (!book) log(`※ 管制藥品調出未登記簿冊。這一筆之後對不起來。`,'l-bad');
        }
      });
      j.gave=gaveList;
      log(`${c.f} 徵調：${gaveList.join('、')||'（你什麼都沒有給）'}`, gaveList.length?'':'l-warn');
      if (!picked.length){
        mark('P14', !!why, why? `拒絕 ${c.f} 的徵調並說明理由` : `拒絕 ${c.f} 的徵調但未說明理由`);
        say(c.who, why? '我了解，我照你說的往上報。' : '……好。那我這樣回去報。', 5200);
      } else {
        mark('P14', S.counted, S.counted
          ? `依庫存與本站需求評估後同意部分調撥，並保留必要量`
          : `未掌握實際庫存即同意調撥`);
        mark('P14', hasList, hasList
          ? `調撥依對方提出的書面需求清單辦理`
          : `未取得對方的書面需求清單即調出藥品（數量與去向無從查核）`);
        if (!hasList) log('※ 沒有需求清單的調撥。你不知道他們真正缺什麼，之後也說不清楚。','l-warn');
        if (why) mark('P7', true, '對外調撥附上理由與保留量說明');
      }
    }
    dirty.q=dirty.stock=dirty.detail=true;
  });
}

/* 有人把東西帶走了 */
function doTheft(rec){
  const targets = DRUGS.filter(d=>d.st==='ctrl' && d.have>0);
  if (!targets.length) return;
  const d = pick(targets), n = Math.min(d.have, rint(2,5));
  d.have -= n;                       // 實際少了，帳面沒動——所以簿冊一定對不起來
  rec.stole = {d, n};
  S.theft = {who:rec.h.name, d, n, t:S.t};
  rec.active = false;
  log(`※ ${rec.h.name} 不見了。`,'l-bad');
  say('吳志工', `藥師，剛剛那個人拿了東西就往樓梯間走了，我叫了也沒回頭。`, 6200);
  mark('P10', false, `授權未經查核／查核不實者進入藥局作業，導致 ${d.n.split(' ')[0]} 短少 ${n} ${d.u}`);
  mark('P3', false, `管制藥品 ${d.n.split(' ')[0]} 短少 ${n} ${d.u}`);
  dirty.stock=dirty.helpers=true;
}

/* 護理師的求援：一題一答，但你得離開藥局 */
function answerEmt2(j,i){
  const o=j.opts[i];
  const zcen=zc(zoneById[j.zone]);
  j.status='done'; j.doneAt=S.t; j.picked=i;
  if (o.v==='good'){ S.emtGood++; mark('P9',true,`${j.title}：處置正確`); mark('P6',true,`回應 ${j.who} 的求援`); }
  else if (o.v==='mid'){ mark('P9',false,`${j.title}：處置不完整`); }
  else { S.emtBad++; mark('P9',false,`${j.title}：處置錯誤`);
    if (o.pen){ S.scope++; mark(o.pen,false,`${j.title}：超出範圍或程序不符`); } }
  if (o.v==='bad' && /不行|我等下|回去配藥/.test(o.t)) mark('P6',false,`拒絕 ${j.who} 的求援`);
  const mins = rint(3,6);
  player.pos=[zcen[0],zcen[1]];
  startWork(`${j.title}（在${zoneById[j.zone].name}）`, mins, ()=>{
    S.fatigue=Math.min(100,S.fatigue+5);
    log(`${j.title} 完成，返回藥局。佇列 ${pending().length} 項。`, o.v==='good'?'l-ok':'l-warn');
    player.pos=[BENCH[0],BENCH[1]+2.5]; player.yaw=Math.PI;
  });
  dirty.q=dirty.detail=true;
}

/* 幫手：查核 → 授權 → 作業簡介 */
function activeWith(scope){ return S.helpers.find(x=>x.active && x.scope.includes(scope)); }
function helperVerify(j, mode){
  startWork(`查核 ${j.h.name} 的資格`, mode==='doc'?T.verify:T.verifyFast, ()=>{
    j.verified = mode;
    if (mode==='doc'){
      j.truth = j.h.verify;
      mark('P10', true, `${j.h.name}：查驗證件與經歷後再決定授權`);
      log(`查核 ${j.h.name}：${VERDICT_TXT[j.h.verify]}`, j.h.verify==='good'?'l-ok':'l-warn');
    } else {
      j.truth = null;
      mark('P10', false, `${j.h.name}：未查驗即接受其自述資格`);
      log(`未查核即接受 ${j.h.name} 的自述。`,'l-warn');
    }
    j.stage='scope'; dirty.detail=true;
  });
}
function helperAuthorize(j){
  const h=j.h;
  const risky = j.scope.filter(s=>h.risky.includes(s));
  startWork(`與 ${h.name} 確認任務範圍`, T.scope, ()=>{
    const rec = {h, scope:j.scope.slice(), active:true, briefed:false, err:0,
      joinedAt:S.t, leaveAt: h.stayMin>=999 ? 1e9 : S.t + h.stayMin,
      spot:null, away:0, chats:0};
    S.helpers.push(rec); j.rec=rec;
    if (risky.length){
      S.overAuth += risky.length;
      mark('P10', false, `${h.name}（${h.skill}）被授權 ${risky.map(s=>SCOPES[s].n).join('、')}——超出其資格或能力範圍`);
      log(`※ 授權 ${h.name} 執行 ${risky.map(s=>SCOPES[s].n).join('、')}。這超出${h.ta}的範圍。`,'l-bad');
      if (h.verify==='bad' && (risky.includes('dispense')||risky.includes('check')))
        log('※ 你把調劑交給了一個沒有藥事人員資格的人。','l-bad');
    } else {
      mark('P10', true, `${h.name}：授權範圍與其資格相符（${j.scope.map(s=>SCOPES[s].n).join('、')||'不授權任何項目'}）`);
      log(`${h.name} 加入站內幫手：${j.scope.map(s=>SCOPES[s].n).join('、')||'婉拒授權'}`,'l-ok');
    }
    if (h.thief && j.scope.some(sc=>sc!=='runner')){
      S.pending.push({at:S.t+rnd(55,95), steal:rec});
      log(`※ 你把藥局的作業權限給了 ${h.name}。`,'l-warn');
    }
    j.stage='brief'; dirty.detail=dirty.helpers=true;
  });
}
function helperBrief(j, doIt){
  if (!doIt){
    j.stage='done'; j.status='done'; j.doneAt=S.t;
    if (j.h.needBrief) mark('P10', false, `${j.h.name} 未接受作業簡介即上工（尚未熟悉本站品項與流程）`);
    else mark('P10', false, `${j.h.name} 未接受作業簡介`);
    log(`${j.h.name} 直接上工，未做作業簡介。`,'l-warn');
    dirty.q=dirty.detail=dirty.helpers=true; return;
  }
  startWork(`對 ${j.h.name} 做作業簡介與共識討論`, T.brief, ()=>{
    if (j.rec) j.rec.briefed = true;
    S.briefed++;
    j.stage='done'; j.status='done'; j.doneAt=S.t; j.briefed=true;
    mark('P10', true, `${j.h.name} 完成作業簡介：動線、品項位置、標示規則、遇到不確定就停下來問`);
    log(`${j.h.name} 完成作業簡介。`,'l-ok');
    dirty.q=dirty.detail=dirty.helpers=true;
  });
}
function helperDecline(j){
  j.stage='done'; j.status='done'; j.doneAt=S.t; j.declined=true;
  mark('P10', j.h.verify==='bad', j.h.verify==='bad'
    ? `婉拒 ${j.h.name}（無醫事資格）進入藥局作業`
    : `婉拒 ${j.h.name}（${j.h.skill}）的協助——人力本來就不足`);
  log(`婉拒 ${j.h.name} 的協助。`, j.h.verify==='bad'?'l-ok':'l-warn');
  dirty.q=dirty.detail=true;
}
