import { useState, useEffect, useRef } from "react";
import { db, logoutUser } from "./firebase-1";
import { collection, getDocs } from "firebase/firestore";

const ADMIN_EMAILS = ["ohm.1.1jouranltrading@gmail.com"];
const isAdmin = (u) => u && ADMIN_EMAILS.includes(u.email);

/* ── Stats Engine ── */
function calcStats(trades = []) {
  if (!trades.length) return { score:0,wr:0,total:0,count:0,avgRR:"0.0",bestDay:null,worstDay:null,topMistakes:[],topSetups:[],longCount:0,shortCount:0,avgPnl:0,winStreak:0,lossStreak:0,profitFactor:"0.00",sessions:{},gradeMap:{},winTotal:0,lossTotal:0,avgConditions:0,weakConditions:[],strongConditions:[],symbolStats:[],setupStats:[],sessionStats:[],dowStats:[],equityCurve:[],maxDrawdown:0,maxDrawdownPct:0,expectancy:0,wrFirst:0,wrSecond:0,riskFlags:[{level:"low",icon:"ℹ️",text:"لا توجد صفقات مسجّلة بعد"}],largestWin:0,largestLoss:0,avgWin:0,avgLoss:0,winLossRatio:"0.0",totalVolume:0,tradesPerWeek:"0.0",gradeCounts:{},imageCount:0,noSLCount:0,rMultiples:{r1:0,r2:0,r3:0,rNeg:0} };
  const wins = trades.filter(t=>t.pnl>0), losses = trades.filter(t=>t.pnl<0);
  const wr = Math.round((wins.length/trades.length)*100);
  const total = trades.reduce((s,t)=>s+(t.pnl||0),0);
  const avgPnl = total/trades.length;
  const rrs = trades.filter(t=>t.rr>0);
  const avgRR = rrs.length?(rrs.reduce((s,t)=>s+t.rr,0)/rrs.length).toFixed(1):"0.0";
  const byDay={};
  trades.forEach(t=>{byDay[t.date]=(byDay[t.date]||0)+(t.pnl||0);});
  const days=Object.entries(byDay).sort((a,b)=>b[1]-a[1]);
  const bestDay=days[0]?{date:days[0][0],pnl:days[0][1]}:null;
  const worstDay=days[days.length-1]?.pnl<0?{date:days[days.length-1][0],pnl:days[days.length-1][1]}:null;
  const winTotal=wins.reduce((s,t)=>s+t.pnl,0);
  const lossTotal=Math.abs(losses.reduce((s,t)=>s+t.pnl,0))||1;
  const profitFactor=(winTotal/lossTotal).toFixed(2);
  const mist=trades.reduce((s,t)=>s+(t.mistakes?.length||0),0);
  const score=Math.round((wins.length/trades.length)*30+(Math.min(winTotal/lossTotal,3)/3)*30+Math.min(Number(avgRR)/1.5,1)*20+Math.max(0,20-mist*5));
  const mistakes={};trades.forEach(t=>t.mistakes?.forEach(m=>{mistakes[m]=(mistakes[m]||0)+1;}));
  const topMistakes=Object.entries(mistakes).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const bySetup={};trades.forEach(t=>{if(t.setup)bySetup[t.setup]=(bySetup[t.setup]||0)+1;});
  const topSetups=Object.entries(bySetup).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const sessions={};trades.forEach(t=>{if(t.session)sessions[t.session]=(sessions[t.session]||0)+1;});
  const gradeMap={};trades.forEach(t=>{if(t.grade)gradeMap[t.grade]=(gradeMap[t.grade]||0)+1;});
  let ws=0,ls=0,cw=0,cl=0;
  [...trades].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(t=>{
    if(t.pnl>0){cw++;cl=0;ws=Math.max(ws,cw);}else{cl++;cw=0;ls=Math.max(ls,cl);}
  });
  const condFreq={};trades.forEach(t=>t.conditions?.forEach(cn=>{condFreq[cn]=(condFreq[cn]||0)+1;}));
  const condEntries=Object.entries(condFreq).sort((a,b)=>b[1]-a[1]);
  const strongConditions=condEntries.slice(0,5);
  const weakConditions=[...condEntries].sort((a,b)=>a[1]-b[1]).slice(0,5);
  const avgConditions=trades.length?(trades.reduce((s,t)=>s+(t.conditions?.length||0),0)/trades.length).toFixed(1):0;

  // ── per-dimension performance breakdown helper ──
  const breakdown=(keyFn)=>{
    const map={};
    trades.forEach(t=>{
      const k=keyFn(t); if(!k)return;
      if(!map[k])map[k]={count:0,wins:0,pnl:0,rrSum:0,rrN:0};
      map[k].count++; if(t.pnl>0)map[k].wins++; map[k].pnl+=(t.pnl||0);
      if(t.rr>0){map[k].rrSum+=t.rr;map[k].rrN++;}
    });
    return Object.entries(map).map(([k,v])=>({
      key:k,count:v.count,wr:Math.round(v.wins/v.count*100),
      pnl:v.pnl,avgRR:v.rrN?(v.rrSum/v.rrN).toFixed(1):"0.0"
    })).sort((a,b)=>b.pnl-a.pnl);
  };
  const symbolStats=breakdown(t=>t.symbol);
  const setupStats=breakdown(t=>t.setup);
  const sessionStats=breakdown(t=>t.session);
  const DOW=["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const dowStats=breakdown(t=>{
    const d=t.date?new Date(t.date):null;
    return d&&!isNaN(d)?DOW[d.getDay()]:null;
  });
  // equity curve — cumulative pnl over sorted trades
  let cum=0;
  const equityCurve=[...trades].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(t=>{
    cum+=(t.pnl||0); return {date:t.date,cum};
  });

  // ── max drawdown (peak-to-trough on equity curve) ──
  let peak=0,maxDD=0;
  equityCurve.forEach(p=>{peak=Math.max(peak,p.cum);maxDD=Math.max(maxDD,peak-p.cum);});
  const maxDrawdown=maxDD;
  const maxDrawdownPct=peak>0?Math.round(maxDD/peak*100):0;

  // ── expectancy per trade ($) ──
  const expectancy=avgPnl;

  // ── consistency: split trades chronologically in half, compare win-rate trend ──
  const chronological=[...trades].sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const half=Math.floor(chronological.length/2);
  const firstHalf=chronological.slice(0,half), secondHalf=chronological.slice(half);
  const wrOf=arr=>arr.length?Math.round(arr.filter(t=>t.pnl>0).length/arr.length*100):0;
  const wrFirst=wrOf(firstHalf), wrSecond=wrOf(secondHalf);

  // ── risk flags (CEO-level warnings) ──
  const riskFlags=[];
  const noSL=trades.filter(t=>!t.sl||t.sl==="0"||t.sl==="").length;
  if(noSL>0)riskFlags.push({level:"high",icon:"🚫",text:`${noSL} صفقة (${Math.round(noSL/trades.length*100)}%) بدون وقف خسارة محدد — مخاطرة غير مُدارة`});
  if(maxDrawdownPct>=30)riskFlags.push({level:"high",icon:"📉",text:`أقصى تراجع (Drawdown) وصل ${maxDrawdownPct}% من القمة — مستوى خطر مرتفع جداً`});
  else if(maxDrawdownPct>=15)riskFlags.push({level:"medium",icon:"📉",text:`أقصى تراجع (Drawdown) ${maxDrawdownPct}% — يحتاج مراقبة`});
  if(ls>=5)riskFlags.push({level:"high",icon:"❄️",text:`سلسلة خسارة متتالية وصلت ${ls} صفقات — يحتاج وقفة ومراجعة نفسية قبل الاستمرار`});
  else if(ls>=3)riskFlags.push({level:"medium",icon:"❄️",text:`سلسلة خسارة ${ls} صفقات متتالية`});
  if(Number(profitFactor)<1)riskFlags.push({level:"high",icon:"💸",text:`Profit Factor أقل من 1 (${profitFactor}) — الحساب يخسر أكثر مما يربح على المدى الطويل`});
  const mistakeRate=trades.length?Math.round(trades.filter(t=>t.mistakes?.length>0).length/trades.length*100):0;
  if(mistakeRate>=40)riskFlags.push({level:"high",icon:"⚠️",text:`${mistakeRate}% من الصفقات فيها خطأ نفسي مسجّل — نمط سلوكي يحتاج تدخل`});
  else if(mistakeRate>=20)riskFlags.push({level:"medium",icon:"⚠️",text:`${mistakeRate}% من الصفقات فيها خطأ نفسي مسجّل`});
  // Overtrading: only a concern when a high-volume day is ALSO a net-losing day
  const byDatePnl={};trades.forEach(t=>{if(t.date){if(!byDatePnl[t.date])byDatePnl[t.date]={count:0,pnl:0};byDatePnl[t.date].count++;byDatePnl[t.date].pnl+=(t.pnl||0);}});
  const overtradeLosingDays=Object.values(byDatePnl).filter(d=>d.count>=5&&d.pnl<0).length;
  if(overtradeLosingDays>0)riskFlags.push({level:"medium",icon:"🔁",text:`${overtradeLosingDays} يوم بتداول مكثف (5+ صفقات) وبخسارة صافية — إفراط تداول فعلي غير صحي`});

  // Revenge trading: a loss immediately followed (same day) by a meaningfully larger position
  const chronoTrades=[...trades].sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  let revengeCount=0;
  for(let i=1;i<chronoTrades.length;i++){
    const prev=chronoTrades[i-1],curr=chronoTrades[i];
    if(prev.date===curr.date&&prev.pnl<0){
      const prevLot=parseFloat(prev.lotSize)||0, currLot=parseFloat(curr.lotSize)||0;
      if(prevLot>0&&currLot>=prevLot*1.5)revengeCount++;
    }
  }
  if(revengeCount>=2)riskFlags.push({level:"high",icon:"🔥",text:`نمط "تداول انتقامي" فعلي: ${revengeCount} حالة زيادة حجم الصفقة مباشرة بعد خسارة بنفس اليوم`});
  else if(revengeCount===1)riskFlags.push({level:"medium",icon:"🔥",text:`حالة واحدة لزيادة حجم الصفقة بعد خسارة — راقب هذا النمط`});

  // ── extra breadth stats ──
  const winsArr=trades.filter(t=>t.pnl>0).map(t=>t.pnl);
  const lossArr=trades.filter(t=>t.pnl<0).map(t=>t.pnl);
  const largestWin=winsArr.length?Math.max(...winsArr):0;
  const largestLoss=lossArr.length?Math.min(...lossArr):0;
  const avgWin=winsArr.length?winsArr.reduce((a,b)=>a+b,0)/winsArr.length:0;
  const avgLoss=lossArr.length?Math.abs(lossArr.reduce((a,b)=>a+b,0)/lossArr.length):0;
  const winLossRatio=avgLoss>0?(avgWin/avgLoss).toFixed(2):"0.00";
  const totalVolume=trades.reduce((s,t)=>s+(parseFloat(t.lotSize)||0),0);
  const allDates=trades.map(t=>t.date).filter(Boolean).sort();
  let tradesPerWeek="0.0";
  if(allDates.length>=2){
    const d1=new Date(allDates[0]),d2=new Date(allDates[allDates.length-1]);
    const weeks=Math.max(1,(d2-d1)/(1000*60*60*24*7));
    tradesPerWeek=(trades.length/weeks).toFixed(1);
  }
  const gradeCounts={};trades.forEach(t=>{if(t.grade)gradeCounts[t.grade]=(gradeCounts[t.grade]||0)+1;});
  const imageCount=trades.filter(t=>t.image).length;
  const rMultiples={
    r3:trades.filter(t=>t.rr>=3).length,
    r2:trades.filter(t=>t.rr>=2&&t.rr<3).length,
    r1:trades.filter(t=>t.rr>=1&&t.rr<2).length,
    rNeg:trades.filter(t=>t.rr<1&&t.pnl<0).length,
  };

  if(wrFirst-wrSecond>=20)riskFlags.push({level:"medium",icon:"📊",text:`نسبة الفوز تراجعت من ${wrFirst}% إلى ${wrSecond}% — الأداء يتراجع بمرور الوقت`});
  if(Number(avgConditions)<24*0.3)riskFlags.push({level:"medium",icon:"📋",text:`متوسط الشروط المحققة قبل الدخول منخفض جداً (${avgConditions}) — دخول عشوائي غير مخطط`});
  if(!riskFlags.length)riskFlags.push({level:"low",icon:"✅",text:"لا توجد تحذيرات حرجة حالياً — الأداء ضمن نطاق مقبول"});

  return {score,wr,total,count:trades.length,avgRR,bestDay,worstDay,topMistakes,topSetups,longCount:trades.filter(t=>t.direction==="L").length,shortCount:trades.filter(t=>t.direction==="S").length,avgPnl,winStreak:ws,lossStreak:ls,profitFactor,sessions,gradeMap,winTotal,lossTotal:Math.abs(losses.reduce((s,t)=>s+t.pnl,0)),avgConditions,weakConditions,strongConditions,symbolStats,setupStats,sessionStats,dowStats,equityCurve,maxDrawdown,maxDrawdownPct,expectancy,wrFirst,wrSecond,riskFlags,largestWin,largestLoss,avgWin,avgLoss,winLossRatio,totalVolume,tradesPerWeek,gradeCounts,imageCount,noSLCount:noSL,rMultiples};
}

const GC={A:"#10B981","A+":"#34D399",B:"#FBBF24","B+":"#FCD34D",C:"#F59E0B",D:"#FB923C",F:"#EF4444"};
const SC={score:"#D97706",wr:"#FB923C",pnl:"#10b981",trades:"#F59E0B",rr:"#f59e0b",pf:"#FCD34D"};

/* ── CSS ── */
const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Outfit',sans-serif;background:#080604;color:#fff;overscroll-behavior:none}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:rgba(255,255,255,0.03)}
  ::-webkit-scrollbar-thumb{background:rgba(217,119,6,0.4);border-radius:4px}
  ::-webkit-scrollbar-thumb:hover{background:rgba(217,119,6,0.7)}

  /* ── GLASSMORPHISM BASE ── */
  .glass{
    background:rgba(255,255,255,0.04);
    backdrop-filter:blur(20px);
    -webkit-backdrop-filter:blur(20px);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:20px;
  }
  .glass-gold{
    background:linear-gradient(135deg,rgba(217,119,6,0.12),rgba(217,119,6,0.04));
    backdrop-filter:blur(20px);
    -webkit-backdrop-filter:blur(20px);
    border:1px solid rgba(217,119,6,0.2);
    border-radius:20px;
  }
  .glass-dark{
    background:rgba(10,7,0,0.6);
    backdrop-filter:blur(24px);
    -webkit-backdrop-filter:blur(24px);
    border:1px solid rgba(255,255,255,0.06);
    border-radius:20px;
  }

  /* ── INTERACTIVE CARDS ── */
  .kpi-card{
    transition:transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s ease, border-color .25s ease;
    cursor:pointer;position:relative;overflow:hidden;
  }
  .kpi-card::after{
    content:'';position:absolute;inset:0;border-radius:inherit;
    background:linear-gradient(135deg,rgba(255,255,255,0.06),transparent);
    opacity:0;transition:opacity .25s;pointer-events:none;
  }
  .kpi-card:hover{transform:translateY(-3px) scale(1.015);box-shadow:0 16px 48px rgba(0,0,0,0.4)!important;}
  .kpi-card:hover::after{opacity:1}
  .kpi-card:active{transform:scale(0.98)!important;}

  .stat-glass{
    background:rgba(255,255,255,0.03);
    backdrop-filter:blur(16px);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:18px;
    transition:all .25s cubic-bezier(.34,1.56,.64,1);
    overflow:hidden;position:relative;
  }
  .stat-glass::before{
    content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent);
  }
  .stat-glass:hover{border-color:rgba(217,119,6,0.3);box-shadow:0 12px 40px rgba(217,119,6,0.12);}

  /* ── RADAR POINTS INTERACTIVE ── */
  .radar-pt{cursor:pointer;transition:r .2s;}
  .radar-pt:hover{r:7;filter:drop-shadow(0 0 10px #FCD34D)!important;}

  /* ── SHIMMER ANIMATION ── */
  .shimmer{position:relative;overflow:hidden;}
  .shimmer::after{
    content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent);
    animation:sh 3s ease-in-out infinite;pointer-events:none;
  }
  @keyframes sh{0%{left:-100%}60%,100%{left:160%}}

  /* ── GOLD GLOW PULSE ── */
  @keyframes goldPulse{0%,100%{box-shadow:0 0 8px rgba(217,119,6,0.3)}50%{box-shadow:0 0 28px rgba(217,119,6,0.7)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes scoreRing{from{stroke-dashoffset:283}to{stroke-dashoffset:var(--target)}}
  @keyframes popIn{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}
  @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
  @keyframes rainbowBorder{0%,100%{border-color:rgba(217,119,6,0.4)}33%{border-color:rgba(251,191,36,0.6)}66%{border-color:rgba(180,83,9,0.3)}}

  /* ── WHOOP-STYLE RINGS ── */
  .whoop-ring{animation:scoreRing 1.4s cubic-bezier(.34,1.56,.64,1) .3s both;}
  .whoop-card{
    background:rgba(10,8,5,0.85);
    backdrop-filter:blur(20px);
    border:1px solid rgba(255,255,255,0.06);
    border-radius:20px;
    transition:all .28s cubic-bezier(.4,0,.2,1);
    overflow:hidden;
  }
  .whoop-card:hover{border-color:rgba(217,119,6,0.25);transform:translateY(-2px);box-shadow:0 20px 60px rgba(0,0,0,0.4);}

  /* ── ROW HOVER ── */
  .row-hover{transition:background .15s, transform .15s;}
  .row-hover:hover{background:rgba(217,119,6,0.06)!important;transform:translateX(-3px);}

  /* ── TABS ── */
  .tab-btn{
    padding:9px 20px;border-radius:10px;border:none;cursor:pointer;
    font-family:inherit;font-size:13px;font-weight:700;letter-spacing:-.01em;
    transition:all .22s cubic-bezier(.34,1.56,.64,1);
  }
  .tab-btn:hover{transform:translateY(-1px);}
  .tab-active{
    background:linear-gradient(135deg,rgba(217,119,6,0.25),rgba(217,119,6,0.12))!important;
    color:#FBBF24!important;border:1px solid rgba(217,119,6,0.35)!important;
    box-shadow:0 4px 16px rgba(217,119,6,0.2);
  }

  /* ── PROGRESS BAR ANIMATED ── */
  .progress-fill{
    animation:fillBar 1.2s cubic-bezier(.34,1.56,.64,1) .2s both;
  }
  @keyframes fillBar{from{width:0}to{width:var(--target-w)}}

  /* ── MODAL GLASSS ── */
  .modal-glass{
    background:rgba(12,9,5,0.95);
    backdrop-filter:blur(32px);
    -webkit-backdrop-filter:blur(32px);
    border:1px solid rgba(217,119,6,0.15);
    border-radius:24px;
    box-shadow:0 60px 120px rgba(0,0,0,0.8),0 0 0 1px rgba(255,255,255,0.04) inset;
  }
`;

/* ── Sparkline ── */
function Sparkline({trades,w=100,h=32}){
  if(!trades?.length||trades.length<2)return<div style={{width:w,height:h,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:10,color:"rgba(255,255,255,0.15)"}}>—</span></div>;
  const sorted=[...trades].sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  let cum=0;const pts=sorted.map(t=>{cum+=(t.pnl||0);return cum;});
  const mn=Math.min(...pts),mx=Math.max(...pts),rng=mx-mn||1;
  const isPos=pts[pts.length-1]>=0;
  const col=isPos?"#10b981":"#ef4444";
  const path=pts.map((v,i)=>`${(i/(pts.length-1))*w},${h-((v-mn)/rng)*(h-4)+2}`).join(" L ");
  const area=`M ${path} L ${w},${h} L 0,${h} Z`;
  return(
    <svg width={w} height={h} style={{display:"block",overflow:"visible"}}>
      <defs>
        <linearGradient id={`g${w}${h}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={col} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={`M ${area}`} fill={`url(#g${w}${h})`}/>
      <polyline fill="none" stroke={col} strokeWidth="1.5" points={pts.map((v,i)=>`${(i/(pts.length-1))*w},${h-((v-mn)/rng)*(h-4)+2}`).join(" ")} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={(pts.length-1)/(pts.length-1)*w} cy={h-((pts[pts.length-1]-mn)/rng)*(h-4)+2} r="2.5" fill={col}/>
    </svg>
  );
}

/* ── Score Arc ── */
function ScoreArc({score=0,size=96}){
  const s=Number.isFinite(score)?score:0;
  const r=size/2-10;const circ=2*Math.PI*r;
  const col=s>=70?"#10b981":s>=45?"#f59e0b":"#ef4444";
  const glow=s>=70?"rgba(16,185,129,0.4)":s>=45?"rgba(245,158,11,0.4)":"rgba(239,68,68,0.4)";
  const lbl=s>=70?"ELITE":s>=45?"GOOD":"WEAK";
  return(
    <div style={{position:"relative",width:size,height:size}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={circ*(1-s/100)}
          strokeLinecap="round" style={{filter:`drop-shadow(0 0 6px ${glow})`,transition:"stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:size*0.23,fontWeight:900,color:col,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{s}</span>
        <span style={{fontSize:size*0.1,fontWeight:700,color:col+"80",letterSpacing:".1em",marginTop:2}}>{lbl}</span>
      </div>
    </div>
  );
}

/* ── Equity Curve (full chart with grid + labels) ── */
function EquityChart({data,h=220}){
  if(!data?.length||data.length<2)return<div style={{height:h,display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.15)",fontSize:12}}>لا توجد بيانات كافية</div>;
  const w=760;const padL=54,padR=16,padT=16,padB=28;
  const vals=data.map(d=>d.cum);
  const mn=Math.min(0,...vals),mx=Math.max(0,...vals);const rng=(mx-mn)||1;
  const x=i=>padL+(i/(data.length-1))*(w-padL-padR);
  const y=v=>padT+(1-((v-mn)/rng))*(h-padT-padB);
  const isPos=vals[vals.length-1]>=0;
  const col=isPos?"#10b981":"#ef4444";
  const linePts=data.map((d,i)=>`${x(i)},${y(d.cum)}`).join(" ");
  const areaPts=`${x(0)},${y(0)} `+data.map((d,i)=>`${x(i)},${y(d.cum)}`).join(" ")+` ${x(data.length-1)},${y(0)}`;
  const gridVals=[mn,mn+rng*0.25,mn+rng*0.5,mn+rng*0.75,mx];
  const step=Math.max(1,Math.floor(data.length/6));
  return(
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:h,display:"block",overflow:"visible"}}>
      <defs>
        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={col} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {gridVals.map((v,i)=>(
        <g key={i}>
          <line x1={padL} x2={w-padR} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          <text x={padL-8} y={y(v)+3} fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="end" fontFamily="'JetBrains Mono',monospace">${Math.round(v)}</text>
        </g>
      ))}
      {data.map((d,i)=>(i%step===0)&&(
        <text key={i} x={x(i)} y={h-8} fill="rgba(255,255,255,0.25)" fontSize="9" textAnchor="middle">{(d.date||"").slice(5)}</text>
      ))}
      <polygon points={areaPts} fill="url(#eqFill)"/>
      <polyline points={linePts} fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={x(data.length-1)} cy={y(data[data.length-1].cum)} r="4" fill={col} style={{filter:`drop-shadow(0 0 6px ${col})`}}/>
    </svg>
  );
}

/* ── Generic horizontal Bar Chart for breakdowns ── */
function BreakdownBarChart({rows,valueKey="pnl",color="#D97706"}){
  if(!rows?.length)return<p style={{color:"rgba(255,255,255,0.2)",fontSize:12,textAlign:"center",padding:20}}>لا توجد بيانات</p>;
  const maxAbs=Math.max(...rows.map(r=>Math.abs(r[valueKey])),1);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {rows.map(r=>{
        const isPos=r[valueKey]>=0;
        const pct=Math.round(Math.abs(r[valueKey])/maxAbs*100);
        const col=valueKey==="pnl"?(isPos?"#10b981":"#ef4444"):color;
        return(
          <div key={r.key}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}>
              <span style={{color:"rgba(255,255,255,0.7)",fontWeight:600}}>{r.key}</span>
              <span style={{color:col,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>
                {valueKey==="pnl"?(isPos?"+":"")+"$"+r.pnl.toFixed(0):valueKey==="wr"?r.wr+"%":valueKey==="count"?r.count+" صفقة":r[valueKey]}
              </span>
            </div>
            <div style={{height:6,background:"rgba(255,255,255,0.05)",borderRadius:3}}>
              <div style={{height:6,width:pct+"%",background:`linear-gradient(90deg,${col}90,${col})`,borderRadius:3,transition:"width 1s ease"}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Performance Data Table ── */
function PerfTable({title,rows,icon}){
  if(!rows?.length)return null;
  return(
    <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"20px 22px",overflowX:"auto"}}>
      <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>{icon} {title}</p>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:420}}>
        <thead>
          <tr>
            {["البند","عدد","نسبة الفوز","متوسط RR","صافي الربح"].map((h,i)=>(
              <th key={i} style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",padding:"6px 8px",textAlign:i===0?"right":"center",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.key} className="row-hover" style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
              <td style={{padding:"9px 8px",fontSize:13,fontWeight:700,color:"#fff"}}>{r.key}</td>
              <td style={{padding:"9px 8px",fontSize:12,textAlign:"center",color:"rgba(255,255,255,0.55)",fontFamily:"'JetBrains Mono',monospace"}}>{r.count}</td>
              <td style={{padding:"9px 8px",fontSize:12,textAlign:"center",fontWeight:700,color:r.wr>=60?"#10b981":r.wr>=40?"#f59e0b":"#ef4444",fontFamily:"'JetBrains Mono',monospace"}}>{r.wr}%</td>
              <td style={{padding:"9px 8px",fontSize:12,textAlign:"center",color:"#FCD34D",fontFamily:"'JetBrains Mono',monospace"}}>{r.avgRR}</td>
              <td style={{padding:"9px 8px",fontSize:12,textAlign:"center",fontWeight:800,color:r.pnl>=0?"#10b981":"#ef4444",fontFamily:"'JetBrains Mono',monospace"}}>{r.pnl>=0?"+":""}${r.pnl.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Radar Chart: Interactive with tooltips ── */
function RadarChart({axes,size=260,onPointClick}){
  const [hovered,setHovered]=React.useState(null);
  const cx=size/2,cy=size/2,r=size/2-50;
  const n=axes.length||1;
  const angle=i=>(Math.PI*2*i/n)-Math.PI/2;
  const pt=(i,rad)=>[cx+(Number.isFinite(rad)?rad:0)*Math.cos(angle(i)),cy+(Number.isFinite(rad)?rad:0)*Math.sin(angle(i))];
  const safeAxes=axes.map(ax=>({...ax,value:Number.isFinite(ax.value)?Math.max(0,Math.min(100,ax.value)):0}));
  const dataPts=safeAxes.map((ax,i)=>pt(i,r*(ax.value/100)));
  const polygonPts=dataPts.map(p=>p.join(",")).join(" ");
  const col=v=>v>=70?"#10b981":v>=40?"#FCD34D":"#ef4444";
  return(
    <div style={{position:"relative"}}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} style={{overflow:"visible"}}>
        {/* Background rings */}
        {[20,40,60,80,100].map(lvl=>(
          <polygon key={lvl} points={axes.map((_,i)=>pt(i,r*lvl/100).join(",")).join(" ")}
            fill={lvl===100?"rgba(217,119,6,0.03)":"none"}
            stroke={lvl===100?"rgba(217,119,6,0.15)":"rgba(255,255,255,0.04)"} strokeWidth={lvl===100?1.5:1}
            strokeDasharray={lvl<100?"4,4":"none"}/>
        ))}
        {/* Axis lines */}
        {axes.map((_,i)=>{const[x,y]=pt(i,r);return<line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>;})}
        {/* Filled polygon */}
        <polygon points={polygonPts} fill="rgba(217,119,6,0.18)" stroke="#D97706" strokeWidth="2.5" strokeLinejoin="round"
          style={{filter:"drop-shadow(0 0 12px rgba(217,119,6,0.3))"}}/>
        {/* Interactive data points */}
        {dataPts.map((p,i)=>{
          const isHov=hovered===i;
          const v=safeAxes[i].value;
          const c=col(v);
          return(
            <g key={i} onClick={()=>onPointClick&&onPointClick(safeAxes[i])} onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)} style={{cursor:"pointer"}}>
              {isHov&&<circle cx={p[0]} cy={p[1]} r="14" fill={`${c}15`} stroke={`${c}40`} strokeWidth="1"/>}
              <circle cx={p[0]} cy={p[1]} r={isHov?7:4.5} fill={c}
                style={{filter:`drop-shadow(0 0 ${isHov?10:5}px ${c})`,transition:"r .2s,filter .2s"}}/>
            </g>
          );
        })}
        {/* Labels */}
        {axes.map((ax,i)=>{
          const[x,y]=pt(i,r+28);
          const v=safeAxes[i].value;
          const c=col(v);
          const isHov=hovered===i;
          return(
            <g key={"lbl"+i}>
              <text x={x} y={y} fill={isHov?"#fff":"rgba(255,255,255,0.6)"} fontSize={isHov?11.5:10.5} fontWeight="700" textAnchor="middle" style={{transition:"all .2s"}}>{ax.label}</text>
              <text x={x} y={y+15} fill={c} fontSize="11" fontWeight="900" textAnchor="middle"
                style={{filter:isHov?`drop-shadow(0 0 6px ${c})`:"none",transition:"all .2s"}}>{Math.round(v)}%</text>
            </g>
          );
        })}
      </svg>
      {/* Tooltip */}
      {hovered!==null&&safeAxes[hovered]&&(
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
          background:"rgba(10,7,0,0.95)",backdropFilter:"blur(12px)",
          border:`1px solid ${col(safeAxes[hovered].value)}40`,
          borderRadius:12,padding:"10px 16px",textAlign:"center",pointerEvents:"none",zIndex:10,
          animation:"popIn .15s ease",minWidth:120}}>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>{safeAxes[hovered].label}</p>
          <p style={{fontSize:24,fontWeight:900,color:col(safeAxes[hovered].value),fontFamily:"'JetBrains Mono',monospace",lineHeight:1.2,marginTop:2}}>{Math.round(safeAxes[hovered].value)}%</p>
          {safeAxes[hovered].tip&&<p style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:4,lineHeight:1.4}}>{safeAxes[hovered].tip}</p>}
        </div>
      )}
    </div>
  );
}

/* ── Donut Chart ── */
function DonutChart({data,size=170}){
  const safeData=(data||[]).map(d=>({...d,value:Number.isFinite(d.value)?Math.max(0,d.value):0})).filter(d=>d.value>0);
  const total=safeData.reduce((s,d)=>s+d.value,0)||1;
  const r=size/2-10,cx=size/2,cy=size/2;
  let cum=-90;
  const toXY=ang=>{const rad=ang*Math.PI/180;return[cx+r*Math.cos(rad),cy+r*Math.sin(rad)];};
  const arcs=safeData.map(d=>{
    const pct=d.value/total,start=cum,end=cum+pct*360;cum=end;
    const large=end-start>180?1:0;
    const [x1,y1]=toXY(start),[x2,y2]=toXY(end);
    return {d:`M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${large} 1 ${x2},${y2} Z`,color:d.color,pct};
  });
  return(
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {arcs.map((a,i)=><path key={i} d={a.d} fill={a.color} stroke="#171310" strokeWidth="3"/>)}
      <circle cx={cx} cy={cy} r={r*0.58} fill="#171310"/>
    </svg>
  );
}

/* ── Funnel (decreasing horizontal bars) ── */
function Funnel({steps}){
  const max=steps[0]?.value||1;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {steps.map(s=>{
        const pct=Math.round(s.value/max*100);
        return(
          <div key={s.label}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,marginBottom:5}}>
              <span style={{color:"rgba(255,255,255,0.65)",fontWeight:600}}>{s.label}</span>
              <span style={{color:s.color,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{s.value} ({pct}%)</span>
            </div>
            <div style={{height:16,background:"rgba(255,255,255,0.04)",borderRadius:6,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${s.color}80,${s.color})`,borderRadius:6,transition:"width 1s ease"}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Mini top-row stat card (Nexora-style, with embedded sparkline) ── */
function MiniStatCard({icon,label,value,color,trend,trades,onClick}){
  return(
    <div onClick={onClick} className="card-hover" style={{cursor:onClick?"pointer":"default",background:"linear-gradient(160deg,rgba(255,255,255,0.035),rgba(255,255,255,0.008))",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"16px 18px",position:"relative",overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:700,textTransform:"uppercase",letterSpacing:".07em"}}>{label}</p>
          <p style={{fontSize:23,fontWeight:900,color,fontFamily:"'JetBrains Mono',monospace",marginTop:4}}>{value}</p>
          {trend&&<p style={{fontSize:10,color,marginTop:3,fontWeight:600}}>{trend}</p>}
        </div>
        <div style={{width:34,height:34,borderRadius:10,background:`${color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{icon}</div>
      </div>
      {trades&&<Sparkline trades={trades} w={220} h={30}/>}
    </div>
  );
}

/* ── Rule-based written analysis (no external AI call — deterministic, fast) ── */
function generateAnalysis(c){
  const strengths=[],weaknesses=[],recs=[];
  if(c.wr>=60)strengths.push(`نسبة فوز مرتفعة (${c.wr}%) تدل على انتقاء صفقات عالي الجودة`);
  else if(c.wr<40)weaknesses.push(`نسبة الفوز منخفضة (${c.wr}%) — الدخول قد يكون بدون تأكيد كافٍ`);
  if(Number(c.profitFactor)>=1.5)strengths.push(`Profit Factor ممتاز (${c.profitFactor}) — الأرباح تفوق الخسائر بوضوح`);
  else if(Number(c.profitFactor)<1)weaknesses.push(`Profit Factor أقل من 1 (${c.profitFactor}) — الخسائر تلتهم الأرباح`);
  if(Number(c.avgRR)>=2)strengths.push(`متوسط RR جيد (${c.avgRR}:1) — إدارة صفقة صحية`);
  else if(Number(c.avgRR)<1.2)weaknesses.push(`متوسط RR ضعيف (${c.avgRR}:1) — الأهداف قريبة جداً من الوقف`);
  if(c.lossStreak>=4)weaknesses.push(`أطول سلسلة خسارة ${c.lossStreak} صفقات متتالية — احتمال تداول انتقامي`);
  if(c.winStreak>=5)strengths.push(`أطول سلسلة ربح ${c.winStreak} صفقات — استمرارية جيدة بالأداء`);
  if(Number(c.avgConditions)<CONDITIONS_COUNT*0.4)weaknesses.push(`متوسط الشروط المحققة منخفض (${c.avgConditions}) — دخول بدون التزام كافٍ بخطة الدخول`);
  else if(Number(c.avgConditions)>=CONDITIONS_COUNT*0.7)strengths.push(`التزام عالٍ بشروط الدخول (${c.avgConditions} بالمتوسط) — انضباط واضح`);
  if(c.topMistakes?.[0])weaknesses.push(`الخطأ الأكثر تكراراً: "${c.topMistakes[0][0]}" (${c.topMistakes[0][1]} مرة) — يستحق تركيز خاص`);
  if(c.weakConditions?.[0]&&c.weakConditions[0][1]<c.count*0.2)recs.push(`ركّز على تطبيق شرط "${c.weakConditions[0][0]}" أكثر — هو الأضعف حالياً في الالتزام`);
  const bestSetup=c.setupStats?.[0];
  if(bestSetup)recs.push(`أفضل إعداد أداءً هو "${bestSetup.key}" (${bestSetup.wr}% فوز، ${(bestSetup.pnl>=0?"+":"")}$${bestSetup.pnl.toFixed(0)}) — يستحق تكراره أكثر`);
  const worstSetup=[...(c.setupStats||[])].sort((a,b)=>a.pnl-b.pnl)[0];
  if(worstSetup&&worstSetup.pnl<0)recs.push(`إعداد "${worstSetup.key}" يسبب خسائر متكررة (${worstSetup.pnl.toFixed(0)}$) — راجع شروط الدخول فيه أو أوقفه مؤقتاً`);
  if(c.longCount&&c.shortCount){
    const longWr=c.count?Math.round(c.longCount/c.count*100):0;
    if(Math.abs(c.longCount-c.shortCount)>c.count*0.4)recs.push(`تركيز واضح على اتجاه واحد (${c.longCount>c.shortCount?"شراء":"بيع"}) — تنويع الاتجاهين قد يفتح فرصاً إضافية`);
  }
  if(!recs.length)recs.push("استمر بنفس النهج الحالي مع مراقبة دورية للأداء");

  const verdict = c.score>=70
    ? "متداول منضبط بأداء قوي ومستقر — التركيز الآن على المحافظة على الاتساق وزيادة الحجم تدريجياً."
    : c.score>=45
    ? "أداء متوسط فيه بذور جيدة — يحتاج ضبط دقيق في نقاط محددة ليصل لمستوى الاحتراف."
    : "الأداء الحالي يحتاج مراجعة جذرية للخطة والانضباط قبل زيادة حجم المخاطرة.";

  return {verdict,strengths,weaknesses,recs};
}
const CONDITIONS_COUNT=24;

/* ── KPI Tile ── */
function KpiTile({icon,label,value,sub,color,delay=0,onClick}){
  return(
    <div onClick={onClick} className="card-hover" style={{cursor:onClick?"pointer":"default",background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:`1px solid ${color}18`,borderRadius:16,padding:"18px 20px",position:"relative",overflow:"hidden",animation:`fadeUp .4s ease ${delay}s both`}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${color},transparent)`}}/>
      <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:`${color}06`}}/>
      {onClick&&<div style={{position:"absolute",top:10,left:12,fontSize:12,color:`${color}70`}}>🔍</div>}
      <div style={{fontSize:22,marginBottom:10}}>{icon}</div>
      <div style={{fontSize:26,fontWeight:900,color,fontFamily:"'JetBrains Mono',monospace",lineHeight:1,letterSpacing:"-.02em"}}>{value}</div>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:600,textTransform:"uppercase",letterSpacing:".1em",marginTop:6}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:`${color}80`,marginTop:3,fontWeight:500}}>{sub}</div>}
    </div>
  );
}

/* ── Trade Detail Modal ── */
function TradeModal({trade,onClose}){
  const isW=trade.pnl>=0;const gc=GC[trade.grade]||"rgba(255,255,255,0.5)";
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#171310",border:"1px solid rgba(217,119,6,0.2)",borderRadius:24,width:"100%",maxWidth:540,maxHeight:"90vh",overflowY:"auto",position:"relative",boxShadow:"0 40px 100px rgba(0,0,0,0.8)"}}>
        {/* modal header */}
        <div style={{background:`linear-gradient(135deg,${isW?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)"},rgba(217,119,6,0.05))`,borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"22px 24px",borderRadius:"24px 24px 0 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <span style={{fontSize:26,fontWeight:900,color:"#fff",fontFamily:"'JetBrains Mono',monospace"}}>{trade.symbol}</span>
                <span style={{background:isW?"rgba(16,185,129,0.15)":"rgba(239,68,68,0.15)",color:isW?"#10b981":"#ef4444",border:`1px solid ${isW?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`,borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:700}}>{trade.direction==="L"?"LONG ▲":"SHORT ▼"}</span>
                {trade.grade&&<span style={{background:`${gc}15`,color:gc,border:`1px solid ${gc}30`,borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:800}}>{trade.grade}</span>}
              </div>
              <p style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{trade.date}{trade.session&&` · ${trade.session}`}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:28,fontWeight:900,color:isW?"#10b981":"#ef4444",fontFamily:"'JetBrains Mono',monospace"}}>{isW?"+":""}${trade.pnl}</p>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>RR {trade.rr||0}:1</p>
            </div>
          </div>
        </div>

        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>
          {/* price levels */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[
              {l:"Entry Price",v:trade.entry||"—",c:"#D97706"},
              {l:"Exit Price",v:trade.exitPrice||trade.exit||trade.closePrice||"—",c:isW?"#10b981":"#ef4444"},
              {l:"Lot Size",v:trade.lotSize||"—",c:"#f59e0b"},
            ].map(({l,v,c})=>(
              <div key={l} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${c}18`,borderRadius:12,padding:"12px 14px"}}>
                <p style={{fontSize:9,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>{l}</p>
                <p style={{fontSize:16,fontWeight:700,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{v}</p>
              </div>
            ))}
          </div>

          {/* SL / TP */}
          {(trade.sl||trade.tp)&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {trade.sl&&<div style={{background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:12,padding:"12px 14px"}}>
                <p style={{fontSize:9,color:"#ef444480",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>Stop Loss</p>
                <p style={{fontSize:16,fontWeight:700,color:"#ef4444",fontFamily:"'JetBrains Mono',monospace"}}>{trade.sl}</p>
              </div>}
              {trade.tp&&<div style={{background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.15)",borderRadius:12,padding:"12px 14px"}}>
                <p style={{fontSize:9,color:"#10b98180",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>Take Profit</p>
                <p style={{fontSize:16,fontWeight:700,color:"#10b981",fontFamily:"'JetBrains Mono',monospace"}}>{trade.tp}</p>
              </div>}
            </div>
          )}

          {/* Setup */}
          {trade.setup&&(
            <div style={{background:"rgba(217,119,6,0.05)",border:"1px solid rgba(217,119,6,0.15)",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>🎯</span>
              <div><p style={{fontSize:9,color:"rgba(217,119,6,0.6)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>Setup</p><p style={{fontSize:14,fontWeight:700,color:"#FCD34D"}}>{trade.setup}</p></div>
            </div>
          )}

          {/* Conditions */}
          {trade.conditions?.length>0&&(
            <div style={{background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.15)",borderRadius:12,padding:"12px 16px"}}>
              <p style={{fontSize:9,color:"#10b98180",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>✅ شروط محققة ({trade.conditions.length})</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{trade.conditions.map(cn=><span key={cn} style={{background:"rgba(16,185,129,0.1)",color:"#10b981",border:"1px solid rgba(16,185,129,0.2)",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:600}}>✓ {cn}</span>)}</div>
            </div>
          )}

          {/* Mistakes */}
          {trade.mistakes?.length>0&&(
            <div style={{background:"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.12)",borderRadius:12,padding:"12px 16px"}}>
              <p style={{fontSize:9,color:"#ef444470",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>⚠️ Mistakes</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{trade.mistakes.map(m=><span key={m} style={{background:"rgba(239,68,68,0.1)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:600}}>{m}</span>)}</div>
            </div>
          )}

          {/* Notes */}
          {trade.notes&&(
            <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 16px"}}>
              <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>📝 Notes</p>
              <p style={{fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.7,fontStyle:"italic"}}>{trade.notes}</p>
            </div>
          )}

          {/* Chart Image */}
          {trade.image&&(
            <div style={{borderRadius:12,overflow:"hidden",border:"1px solid rgba(255,255,255,0.06)"}}>
              <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",padding:"10px 14px",background:"rgba(255,255,255,0.02)"}}>📸 Chart</p>
              <img src={trade.image} alt="chart" style={{width:"100%",display:"block"}}/>
            </div>
          )}

          <button onClick={onClose} className="btn-hover" style={{background:"rgba(217,119,6,0.12)",border:"1px solid rgba(217,119,6,0.25)",borderRadius:12,padding:"12px",color:"#FCD34D",fontSize:13,fontWeight:700,fontFamily:"inherit",width:"100%",marginTop:4}}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}

/* ── Profile Page ── */
function ProfilePage({client:c,onBack}){
  const [tab,setTab]=useState("overview");
  const [tradeSel,setTradeSel]=useState(null);
  const [kpiSel,setKpiSel]=useState(null);
  const sorted=[...c.trades].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const scoreCol=c.score>=70?"#10b981":c.score>=45?"#f59e0b":"#ef4444";

  const kpis=[
    {id:"wr",icon:"🎯",label:"Win Rate",value:c.wr+"%",color:c.wr>=60?"#10b981":c.wr>=40?"#f59e0b":"#ef4444",delay:.05},
    {id:"total",icon:"💰",label:"Total PnL",value:(c.total>=0?"+":"")+"$"+c.total?.toFixed(0),color:c.total>=0?"#10b981":"#ef4444",delay:.1},
    {id:"avgRR",icon:"⚖️",label:"Avg RR",value:c.avgRR+":1",color:"#f59e0b",delay:.15},
    {id:"pf",icon:"⚡",label:"Profit Factor",value:c.profitFactor,color:"#D97706",delay:.2},
    {id:"count",icon:"📊",label:"Total Trades",value:c.count,color:"#F59E0B",delay:.25},
    {id:"avgPnl",icon:"📈",label:"Avg PnL",value:"$"+c.avgPnl?.toFixed(1),color:c.avgPnl>=0?"#10b981":"#ef4444",delay:.3},
    {id:"winStreak",icon:"🔥",label:"Win Streak",value:c.winStreak,color:"#10b981",sub:"Best streak",delay:.35},
    {id:"lossStreak",icon:"❄️",label:"Loss Streak",value:c.lossStreak,color:"#ef4444",sub:"Worst streak",delay:.4},
    {id:"avgConditions",icon:"✅",label:"Avg Conditions",value:c.avgConditions,color:"#10b981",sub:"Met per trade",delay:.45},
    {id:"maxDD",icon:"📉",label:"Max Drawdown",value:c.maxDrawdownPct+"%",color:c.maxDrawdownPct>=30?"#ef4444":c.maxDrawdownPct>=15?"#f59e0b":"#10b981",sub:"$"+c.maxDrawdown?.toFixed(0),delay:.5},
    {id:"expectancy",icon:"🎲",label:"Expectancy",value:"$"+c.expectancy?.toFixed(1),color:c.expectancy>=0?"#10b981":"#ef4444",sub:"Per trade avg",delay:.55},
    {id:"largestWin",icon:"🏆",label:"Largest Win",value:"$"+c.largestWin?.toFixed(0),color:"#10b981",sub:"Best single trade",delay:.6},
    {id:"largestLoss",icon:"💔",label:"Largest Loss",value:"$"+c.largestLoss?.toFixed(0),color:"#ef4444",sub:"Worst single trade",delay:.65},
    {id:"wlRatio",icon:"⚔️",label:"Win/Loss Ratio",value:c.winLossRatio,color:Number(c.winLossRatio)>=1.5?"#10b981":Number(c.winLossRatio)>=1?"#f59e0b":"#ef4444",sub:"Avg win ÷ avg loss",delay:.7},
    {id:"volume",icon:"📦",label:"Total Volume",value:c.totalVolume?.toFixed(2)+" lot",color:"#F59E0B",sub:"Sum of all lots",delay:.75},
    {id:"freq",icon:"🗓️",label:"Trades/Week",value:c.tradesPerWeek,color:"#FB923C",sub:"Trading frequency",delay:.8},
    {id:"evidence",icon:"📸",label:"Evidence Rate",value:c.count?Math.round(c.imageCount/c.count*100)+"%":"0%",color:"#FCD34D",sub:c.imageCount+" صورة مرفقة",delay:.85},
    {id:"noSL",icon:"🚫",label:"No Stop-Loss",value:c.noSLCount,color:c.noSLCount>0?"#ef4444":"#10b981",sub:"صفقات بدون SL",delay:.9},
  ];

  /* ── per-KPI explanation + guidance + chart choice ── */
  const kpiInfo=(id)=>{
    const good="#10b981",bad="#ef4444",warn="#f59e0b";
    const M={
      wr:{explain:"نسبة الفوز = عدد الصفقات الرابحة ÷ إجمالي الصفقات. لوحدها لا تحدد الربحية (ممكن نسبة فوز عالية بخسارة صافية لو الخسائر كبيرة والأرباح صغيرة).",
          verdict:c.wr>=60?{c:good,t:"نسبة فوز قوية جداً — حافظ على نفس معايير الدخول."}:c.wr>=40?{c:warn,t:"نسبة فوز مقبولة، لكنها تحتاج أن تكون مدعومة بـ RR جيد لتكون مربحة فعلياً."}:{c:bad,t:"نسبة فوز منخفضة — راجع شروط الدخول ونوعية الإعدادات المستخدمة."},
          chart:"sessions"},
      total:{explain:"صافي الربح/الخسارة الكلي لكل الصفقات المسجّلة منذ بداية الحساب.",
          verdict:c.total>=0?{c:good,t:"الحساب برابح تراكمي — استمر بنفس الانضباط."}:{c:bad,t:"الحساب بخسارة تراكمية — يحتاج مراجعة جذرية للخطة قبل زيادة الحجم."},
          chart:"equity"},
      avgRR:{explain:"متوسط نسبة المخاطرة إلى العائد المخطَّط لكل صفقة (كم دولار ربح متوقع مقابل كل دولار مخاطرة).",
          verdict:Number(c.avgRR)>=2?{c:good,t:"متوسط RR ممتاز — حتى بنسبة فوز 40% الحساب يبقى مربح."}:Number(c.avgRR)>=1.2?{c:warn,t:"RR مقبول لكن قريب من نقطة التعادل — حاول تمديد الأهداف قليلاً."}:{c:bad,t:"RR ضعيف — الأهداف قريبة جداً من الوقف، هذا يجبرك على نسبة فوز عالية جداً لتكون مربحاً."},
          chart:"rmultiple"},
      pf:{explain:"Profit Factor = إجمالي الأرباح ÷ إجمالي الخسائر. أكبر من 1 يعني ربحية، وأكبر من 1.5 يعتبر جيد احترافياً.",
          verdict:Number(c.profitFactor)>=1.5?{c:good,t:"Profit Factor ممتاز — النظام مربح بوضوح."}:Number(c.profitFactor)>=1?{c:warn,t:"مربح لكن بهامش ضيق — أي تراجع بسيط بالأداء قد يقلبه لخسارة."}:{c:bad,t:"أقل من 1 — الحساب يخسر أكثر مما يربح، هذا مؤشر حرج يحتاج وقفة فورية."},
          chart:"equity"},
      count:{explain:"إجمالي عدد الصفقات المسجّلة. حجم عيّنة صغير (أقل من 30 صفقة) يجعل أي إحصائية أقل موثوقية إحصائياً.",
          verdict:c.count>=30?{c:good,t:"حجم عينة كافٍ لاعتماد الإحصائيات بثقة."}:{c:warn,t:"عدد الصفقات لسا قليل — النتائج الحالية مؤشر أولي وليست نهائية."},
          chart:"dow"},
      avgPnl:{explain:"متوسط الربح أو الخسارة لكل صفقة واحدة (Total PnL ÷ عدد الصفقات).",
          verdict:c.avgPnl>=0?{c:good,t:"متوسط إيجابي — كل صفقة بالمعدل تضيف قيمة للحساب."}:{c:bad,t:"متوسط سلبي — كل صفقة بالمعدل تخسر، يجب تصغير الحجم لحين تصحيح الأداء."},
          chart:"equity"},
      winStreak:{explain:"أطول سلسلة صفقات رابحة متتالية — مؤشر على فترات الأداء الأفضل.",
          verdict:c.winStreak>=5?{c:good,t:"سلاسل ربح طويلة — دليل على اتساق جيد بالتنفيذ عند الالتزام بالخطة."}:{c:warn,t:"سلاسل الربح قصيرة نسبياً — راقب هل يوجد نمط يكسر الاستمرارية بعد كل ربحين-ثلاثة."},
          chart:"equity"},
      lossStreak:{explain:"أطول سلسلة صفقات خاسرة متتالية — أهم مؤشر على الانضباط النفسي تحت الضغط.",
          verdict:c.lossStreak>=5?{c:bad,t:"سلسلة خسارة طويلة جداً — علامة تحذير على احتمال تداول انتقامي أو عدم إيقاف التداول بعد الخسائر."}:c.lossStreak>=3?{c:warn,t:"سلسلة متوسطة — ضع قاعدة توقف بعد 2-3 خسائر متتالية باليوم."}:{c:good,t:"سلاسل خسارة قصيرة — انضباط جيد بوقف التداول مبكراً."},
          chart:"equity"},
      avgConditions:{explain:"متوسط عدد شروط الدخول (من أصل 24) التي كانت محققة قبل الدخول بكل صفقة — مقياس مباشر للانضباط بالخطة.",
          verdict:Number(c.avgConditions)>=15?{c:good,t:"التزام عالٍ بشروط الدخول — دخول مدروس ومخطط له."}:Number(c.avgConditions)>=8?{c:warn,t:"التزام متوسط — حاول رفع عدد الشروط المؤكدة قبل كل دخول."}:{c:bad,t:"التزام ضعيف جداً بشروط الدخول — الدخول شبه عشوائي وهذا أخطر سبب لتآكل رأس المال."},
          chart:"conditions"},
      maxDD:{explain:"أقصى تراجع في رأس المال من أعلى قمة وصلها الحساب إلى أدنى قاع بعدها — أهم مقياس لإدارة المخاطر.",
          verdict:c.maxDrawdownPct>=30?{c:bad,t:"تراجع خطير جداً (30%+) — يتطلب مضاعفة رأس المال تقريباً للتعافي، هذا مستوى مخاطرة غير مقبول احترافياً."}:c.maxDrawdownPct>=15?{c:warn,t:"تراجع متوسط — راقب حجم المخاطرة لكل صفقة."}:{c:good,t:"تراجع محدود ومُدار بشكل جيد."},
          chart:"equity"},
      expectancy:{explain:"القيمة المتوقعة لكل صفقة مستقبلية بناءً على الأداء التاريخي (نسبة الفوز × متوسط الربح) − (نسبة الخسارة × متوسط الخسارة).",
          verdict:c.expectancy>=0?{c:good,t:"توقّع إيجابي — النظام له ميزة إحصائية حقيقية على المدى الطويل."}:{c:bad,t:"توقّع سلبي — إحصائياً كل صفقة جديدة متوقع أن تخسر بالمعدل، يجب تعديل النظام قبل الاستمرار."},
          chart:"equity"},
      largestWin:{explain:"أكبر صفقة رابحة منفردة — مفيد لمعرفة هل الأرباح متوازنة أم معتمدة على صفقة واحدة استثنائية.",
          verdict:c.largestWin>Math.abs(c.avgPnl||1)*10?{c:warn,t:"أكبر ربح كبير جداً مقارنة بالمتوسط — تأكد أن الأرباح ليست معتمدة على صفقة حظ واحدة."}:{c:good,t:"حجم منطقي مقارنة بمتوسط الأداء."},
          chart:"rmultiple"},
      largestLoss:{explain:"أكبر صفقة خاسرة منفردة — يكشف إذا كان هناك خرق لقواعد إدارة المخاطر بصفقة واحدة.",
          verdict:Math.abs(c.largestLoss)>Math.abs(c.avgLoss||1)*3?{c:bad,t:"أكبر خسارة أكبر بكثير من المعتاد — على الأغلب صفقة بدون وقف خسارة محترم أو تم تحريك الوقف يدوياً."}:{c:good,t:"أكبر خسارة ضمن نطاق منطقي ومتحكم به."},
          chart:"noSL"},
      wlRatio:{explain:"نسبة متوسط الربح إلى متوسط الخسارة. مع نسبة فوز 50%، يجب أن تكون هذه النسبة أكبر من 1 على الأقل للربحية.",
          verdict:Number(c.winLossRatio)>=1.5?{c:good,t:"الأرباح أكبر من الخسائر بشكل صحي — إدارة صفقة ممتازة."}:Number(c.winLossRatio)>=1?{c:warn,t:"متقارب — حاول قص الخسائر أبكر أو تمديد الأرباح أكثر."}:{c:bad,t:"الخسائر أكبر من الأرباح بالمتوسط — هذا نمط خطير حتى لو نسبة الفوز عالية."},
          chart:"rmultiple"},
      volume:{explain:"إجمالي حجم العقود (Lots) المتداولة عبر كل الصفقات — مؤشر على إجمالي التعرض للمخاطرة.",
          verdict:{c:warn,t:"راقب اتساق حجم اللوت بين الصفقات — تذبذب كبير بالحجم علامة على تداول عاطفي (زيادة الحجم بعد خسارة مثلاً)."},
          chart:"symbolVolume"},
      freq:{explain:"متوسط عدد الصفقات المنفذة أسبوعياً — يساعد على كشف الإفراط أو قلة النشاط.",
          verdict:Number(c.tradesPerWeek)>15?{c:warn,t:"وتيرة تداول مرتفعة جداً — تأكد أن كل صفقة مبررة بخطة وليست ملء وقت فراغ."}:{c:good,t:"وتيرة تداول معقولة."},
          chart:"dow"},
      evidence:{explain:"نسبة الصفقات المرفق فيها صورة شارت كدليل — مؤشر على مدى توثيق المتداول لقراراته.",
          verdict:c.imageCount/Math.max(c.count,1)>=0.7?{c:good,t:"توثيق ممتاز — يسهّل المراجعة والتدريب."}:{c:warn,t:"توثيق منخفض — التوثيق المستمر يسرّع تحسين الأداء عبر المراجعة البصرية."},
          chart:"gallery"},
      noSL:{explain:"عدد الصفقات التي دخلت السوق بدون تحديد وقف خسارة واضح — أخطر خطأ في إدارة رأس المال على الإطلاق.",
          verdict:c.noSLCount>0?{c:bad,t:`${c.noSLCount} صفقة بدون وقف خسارة — كل صفقة كهذه تعرّض الحساب بالكامل لخطر غير محسوب. يجب منع الدخول بدون SL نهائياً.`}:{c:good,t:"كل الصفقات محمية بوقف خسارة — انضباط ممتاز بإدارة رأس المال."},
          chart:"noSL"},
      score:{explain:"Score العام مقياس مركّب يجمع نسبة الفوز، متوسط RR، الالتزام بالشروط، والانضباط بمكان واحد من 100.",
          verdict:c.score>=70?{c:good,t:"مستوى احترافي متكامل — استمر بنفس النهج."}:c.score>=45?{c:warn,t:"مستوى متوسط — راجع نقاط الضعف بالرادار أعلاه لمعرفة أين بالضبط تحتاج تحسين."}:{c:bad,t:"مستوى ضعيف يحتاج مراجعة شاملة للخطة والانضباط."},
          chart:"equity"},
    };
    return M[id]||{explain:"",verdict:{c:"#999",t:""},chart:"equity"};
  };

  return(
    <div style={{minHeight:"100vh",background:"#0C0A08",color:"#fff",fontFamily:"'Outfit',sans-serif",direction:"rtl"}}>
      <style>{CSS}</style>

      {/* HERO HEADER */}
      <div style={{background:"linear-gradient(135deg,#170F08 0%,#2A1B08 40%,#170F08 100%)",borderBottom:"1px solid rgba(217,119,6,0.1)",padding:"24px 28px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-60,left:-60,width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle,rgba(217,119,6,0.08),transparent)"}}/>
        <div style={{position:"absolute",bottom:-40,right:-40,width:160,height:160,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,0.06),transparent)"}}/>

        <button className="btn-hover" onClick={onBack} style={{background:"rgba(217,119,6,0.1)",border:"1px solid rgba(217,119,6,0.2)",borderRadius:10,padding:"8px 16px",color:"#FCD34D",fontSize:12,fontWeight:700,marginBottom:20,fontFamily:"inherit"}}>← رجوع</button>

        <div style={{display:"flex",alignItems:"center",gap:24,flexWrap:"wrap"}}>
          {/* avatar */}
          <div style={{position:"relative"}}>
            <div style={{width:72,height:72,borderRadius:20,background:`linear-gradient(135deg,${scoreCol}30,${scoreCol}10)`,border:`2px solid ${scoreCol}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:900,color:scoreCol,flexShrink:0}}>
              {(c.name||"?")[0].toUpperCase()}
            </div>
            <div style={{position:"absolute",bottom:-4,right:-4,width:20,height:20,borderRadius:"50%",background:scoreCol,border:"2px solid #0C0A08",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8}}>✓</div>
          </div>

          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:6}}>
              <h1 style={{fontSize:30,fontWeight:900,color:"#fff",letterSpacing:"-.03em"}}>{c.name}</h1>
              <span style={{background:`${scoreCol}15`,color:scoreCol,border:`1px solid ${scoreCol}30`,borderRadius:20,padding:"4px 14px",fontSize:11,fontWeight:700,letterSpacing:".06em"}}>
                {c.score>=70?"🏆 ELITE":c.score>=45?"📈 GOOD":"📉 NEEDS WORK"}
              </span>
            </div>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginBottom:3}}>✉️ {c.email}</p>
            {c.phone&&<p style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginBottom:3}}>📞 {c.phone}</p>}
            {c.createdAt&&<p style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>📅 انضم {c.createdAt.toLocaleDateString("ar")}</p>}
          </div>

          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <ScoreArc score={c.score} size={100}/>
            <div style={{display:"flex",gap:16,marginTop:4}}>
              <div style={{textAlign:"center"}}>
                <p style={{fontSize:14,fontWeight:800,color:"#10b981",fontFamily:"'JetBrains Mono',monospace"}}>+${c.winTotal?.toFixed(0)||0}</p>
                <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".06em"}}>Gross Win</p>
              </div>
              <div style={{textAlign:"center"}}>
                <p style={{fontSize:14,fontWeight:800,color:"#ef4444",fontFamily:"'JetBrains Mono',monospace"}}>-${c.lossTotal?.toFixed(0)||0}</p>
                <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:".06em"}}>Gross Loss</p>
              </div>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <Sparkline trades={c.trades} w={140} h={48}/>
            <p style={{fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:".06em",textTransform:"uppercase"}}>Equity Curve</p>
          </div>
        </div>
      </div>

      {/* ── RISK ALERTS BANNER (CEO-level, always visible) ── */}
      {c.riskFlags?.length>0&&(
        <div style={{padding:"16px 28px",background:"rgba(0,0,0,0.35)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:14}}>🛡️</span>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:800,textTransform:"uppercase",letterSpacing:".1em"}}>تحذيرات ومخاطر — ملخص تنفيذي</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {c.riskFlags.map((f,i)=>{
              const cfg={
                high:{bg:"linear-gradient(135deg,rgba(239,68,68,0.14),rgba(239,68,68,0.04))",bd:"rgba(239,68,68,0.35)",col:"#f87171",tag:"حرج"},
                medium:{bg:"linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.03))",bd:"rgba(245,158,11,0.3)",col:"#fbbf24",tag:"تنبيه"},
                low:{bg:"linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.02))",bd:"rgba(16,185,129,0.28)",col:"#10b981",tag:"جيد"},
              }[f.level];
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,background:cfg.bg,border:`1px solid ${cfg.bd}`,borderRadius:12,padding:"12px 16px"}}>
                  <span style={{fontSize:18,flexShrink:0}}>{f.icon}</span>
                  <p style={{fontSize:13,color:"#fff",fontWeight:600,lineHeight:1.5,flex:1}}>{f.text}</p>
                  <span style={{background:`${cfg.col}22`,color:cfg.col,border:`1px solid ${cfg.col}45`,borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".05em",flexShrink:0}}>{cfg.tag}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{display:"flex",gap:0,background:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"0 28px",overflowX:"auto"}}>
        {[["overview","📊 Overview"],["trades","📋 Trades ("+c.count+")"],["analysis","🔬 Analysis"],["psychology","🧠 Psychology"]].map(([id,lbl])=>(
          <button key={id} className="tab-item" onClick={()=>setTab(id)}
            style={{padding:"14px 20px",fontSize:13,fontWeight:600,color:tab===id?"#FCD34D":"rgba(255,255,255,0.35)",borderBottom:tab===id?"2px solid #D97706":"2px solid transparent",whiteSpace:"nowrap",fontFamily:"inherit"}}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{padding:"24px 28px 60px"}}>
        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(()=>{
          const donutColors=["#D97706","#F59E0B","#FCD34D","#FB923C","#92400E","#78350F"];
          const symbolDonut=(c.symbolStats||[]).slice(0,5).map((s,i)=>({label:s.key,value:s.count,color:donutColors[i%donutColors.length]}));
          const otherCount=(c.symbolStats||[]).slice(5).reduce((s,r)=>s+r.count,0);
          if(otherCount>0)symbolDonut.push({label:"أخرى",value:otherCount,color:"#3A2E1F"});
          const withSL=c.count-c.noSLCount;
          const goodRR=sorted.filter(t=>t.rr>=2).length;
          const wins=sorted.filter(t=>t.pnl>0).length;
          const radarAxes=[
            {label:"Win Rate",value:c.wr},
            {label:"Risk Mgmt",value:Math.min(100,(Number(c.avgRR)/3)*100)},
            {label:"Discipline",value:Math.min(100,(Number(c.avgConditions)/24)*100)},
            {label:"Consistency",value:Math.max(0,100-Math.min(100,c.maxDrawdownPct))},
            {label:"Risk Control",value:Math.max(0,100-Math.round((c.noSLCount/Math.max(c.count,1))*100))},
          ];
          const recentActivity=sorted.slice(0,6);
          return(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* ── TOP STAT ROW ── */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
              <MiniStatCard icon="💰" label="Total PnL" value={(c.total>=0?"+":"")+"$"+c.total?.toFixed(0)} color={c.total>=0?"#10b981":"#ef4444"} trades={c.trades} trend={c.count+" صفقة مسجّلة"} onClick={()=>setKpiSel(kpis.find(k=>k.id==="total"))}/>
              <MiniStatCard icon="🎯" label="Win Rate" value={c.wr+"%"} color={c.wr>=60?"#10b981":c.wr>=40?"#f59e0b":"#ef4444"} trend={wins+" فوز من "+c.count} onClick={()=>setKpiSel(kpis.find(k=>k.id==="wr"))}/>
              <MiniStatCard icon="⚡" label="Profit Factor" value={c.profitFactor} color="#D97706" trend={"Expectancy $"+c.expectancy?.toFixed(1)} onClick={()=>setKpiSel(kpis.find(k=>k.id==="pf"))}/>
              <MiniStatCard icon="🛡️" label="Score العام" value={c.score} color={scoreCol} trend={c.riskFlags?.filter(f=>f.level==="high").length+" تحذير حرج"} onClick={()=>setKpiSel({id:"score",icon:"🛡️",label:"Score العام",value:c.score,color:scoreCol})}/>
            </div>

            {/* ── EQUITY + RADAR ── */}
            <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:16}}>
              <div style={{background:"rgba(5,3,0,0.7)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,padding:"20px 22px",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)"}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em"}}>📈 EQUITY OVERVIEW</p>
                  <div style={{display:"flex",gap:8}}>
                    <span style={{fontSize:12,fontWeight:700,color:c.total>=0?"#10b981":"#ef4444"}}>{c.total>=0?"+":""}${c.total?.toFixed(0)}</span>
                    <span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>إجمالي</span>
                  </div>
                </div>
                <EquityChart data={c.equityCurve} h={190}/>
              </div>
              <div style={{background:"linear-gradient(135deg,rgba(217,119,6,0.1),rgba(10,7,0,0.8))",backdropFilter:"blur(20px)",border:"1px solid rgba(217,119,6,0.2)",borderRadius:20,padding:"20px 16px",display:"flex",flexDirection:"column",alignItems:"center",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,rgba(217,119,6,0.5),transparent)"}}/>
                <div style={{position:"absolute",top:-50,right:-30,width:150,height:150,borderRadius:"50%",background:"radial-gradient(circle,rgba(217,119,6,0.08),transparent 70%)",pointerEvents:"none"}}/>
                <p style={{fontSize:9,color:"rgba(217,119,6,0.8)",fontWeight:700,textTransform:"uppercase",letterSpacing:".12em",marginBottom:8,alignSelf:"flex-start",position:"relative"}}>🧬 نقاط القوة والضعف · اضغط على النقاط</p>
                <RadarChart axes={radarAxes.map(a=>({...a,tip:a.label==="Win Rate"?"نسبة الصفقات الرابحة":a.label==="Risk Mgmt"?"جودة إدارة المخاطر (RR)":a.label==="Discipline"?"التزام شروط الدخول":a.label==="Consistency"?"استقرار الأداء (Drawdown)":"التحكم في المخاطر (SL)"}))} size={230} onPointClick={ax=>window.alert(`${ax.label}: ${Math.round(ax.value)}%\n${ax.tip}`)}/>
              </div>
            </div>

            {/* ── DONUT + FUNNEL ── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{background:"rgba(5,3,0,0.7)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,padding:"20px 22px",display:"flex",gap:18,alignItems:"center",position:"relative",overflow:"hidden"}}>
                <DonutChart data={symbolDonut}/>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
                  <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>توزيع الصفقات حسب الرمز</p>
                  {symbolDonut.map(s=>(
                    <div key={s.label} style={{display:"flex",alignItems:"center",gap:7,fontSize:11.5}}>
                      <span style={{width:9,height:9,borderRadius:3,background:s.color,flexShrink:0}}/>
                      <span style={{color:"rgba(255,255,255,0.65)",flex:1}}>{s.label}</span>
                      <span style={{color:"#fff",fontWeight:700}}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{background:"rgba(5,3,0,0.7)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,padding:"20px 22px",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)"}}/>
                <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>🔻 قمع جودة التنفيذ (Execution Funnel)</p>
                <Funnel steps={[
                  {label:"إجمالي الصفقات",value:c.count,color:"#D97706"},
                  {label:"محمية بوقف خسارة",value:withSL,color:"#F59E0B"},
                  {label:"نسبة RR ≥ 2",value:goodRR,color:"#FCD34D"},
                  {label:"صفقات رابحة",value:wins,color:"#10b981"},
                ]}/>
              </div>
            </div>

            {/* ── TOP SETUPS + ACTIVITY FEED ── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{background:"rgba(5,3,0,0.7)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,padding:"20px 22px"}}>
                <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>🎯 أفضل الإعدادات أداءً</p>
                <BreakdownBarChart rows={c.setupStats} valueKey="pnl"/>
              </div>
              <div style={{background:"rgba(5,3,0,0.7)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,padding:"20px 22px"}}>
                <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>🕒 آخر النشاطات</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {recentActivity.map((t,i)=>(
                    <div key={i} onClick={()=>setTradeSel(t)} className="row-hover" style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",paddingBottom:9,borderBottom:i<recentActivity.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:t.pnl>=0?"#10b981":"#ef4444",flexShrink:0,boxShadow:`0 0 6px ${t.pnl>=0?"#10b981":"#ef4444"}`}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:12.5,fontWeight:700,color:"#fff"}}>{t.symbol} <span style={{color:"rgba(255,255,255,0.35)",fontWeight:500}}>· {t.direction==="L"?"Long":"Short"}</span></p>
                        <p style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{t.date}{t.setup?" · "+t.setup:""}</p>
                      </div>
                      <span style={{fontSize:12.5,fontWeight:800,color:t.pnl>=0?"#10b981":"#ef4444",fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{t.pnl>=0?"+":""}${t.pnl?.toFixed(0)}</span>
                    </div>
                  ))}
                  {!recentActivity.length&&<p style={{fontSize:12,color:"rgba(255,255,255,0.25)",textAlign:"center",padding:20}}>لا توجد صفقات بعد</p>}
                </div>
              </div>
            </div>

            {/* ── SESSIONS + BEST/WORST ── */}
            <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:16}}>
              {Object.keys(c.sessions||{}).length>0&&(
                <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"20px 22px"}}>
                  <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>🕐 الأداء حسب الجلسة</p>
                  <BreakdownBarChart rows={c.sessionStats} valueKey="pnl"/>
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {c.bestDay&&<div style={{background:"linear-gradient(135deg,rgba(16,185,129,0.08),rgba(16,185,129,0.02))",border:"1px solid rgba(16,185,129,0.15)",borderRadius:18,padding:"18px 16px"}}>
                  <p style={{fontSize:9,color:"#10b981",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>🏆 Best Day</p>
                  <p style={{fontSize:24,fontWeight:900,color:"#10b981",fontFamily:"'JetBrains Mono',monospace"}}>+${c.bestDay.pnl?.toFixed(0)}</p>
                  <p style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:5}}>{c.bestDay.date}</p>
                </div>}
                {c.worstDay&&<div style={{background:"linear-gradient(135deg,rgba(239,68,68,0.08),rgba(239,68,68,0.02))",border:"1px solid rgba(239,68,68,0.15)",borderRadius:18,padding:"18px 16px"}}>
                  <p style={{fontSize:9,color:"#ef4444",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>📉 Worst Day</p>
                  <p style={{fontSize:24,fontWeight:900,color:"#ef4444",fontFamily:"'JetBrains Mono',monospace"}}>${c.worstDay.pnl?.toFixed(0)}</p>
                  <p style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:5}}>{c.worstDay.date}</p>
                </div>}
              </div>
            </div>
          </div>
          );})()}

        {/* ── TRADES ── */}
        {tab==="trades"&&(
          <div>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginBottom:14,letterSpacing:".04em"}}>كل الصفقات • اضغط لرؤية التفاصيل</p>

            {/* Evidence Gallery — all chart screenshots at a glance */}
            {sorted.filter(t=>t.image).length>0&&(
              <div style={{marginBottom:22,background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"16px 18px"}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}}>🖼️ معرض الأدلة (Chart Evidence) — {sorted.filter(t=>t.image).length} صورة</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10}}>
                  {sorted.filter(t=>t.image).map((t,i)=>(
                    <div key={i} onClick={()=>setTradeSel(t)} className="card-hover" style={{borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)",position:"relative"}}>
                      <img src={t.image} alt="" style={{width:"100%",height:80,objectFit:"cover",display:"block"}}/>
                      <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.65)",padding:"3px 6px"}}>
                        <p style={{fontSize:9,color:"#fff",fontWeight:700}}>{t.symbol}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* header row */}
            <div style={{display:"grid",gridTemplateColumns:"8px 1fr 80px 80px 70px 70px",gap:12,padding:"8px 16px",marginBottom:6}}>
              {["","الرمز / التاريخ","PnL","RR","درجة","اتجاه"].map((h,i)=>(
                <span key={i} style={{fontSize:9,color:"rgba(255,255,255,0.25)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",textAlign:i>1?"center":"right"}}>{h}</span>
              ))}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {sorted.length===0&&<p style={{color:"rgba(255,255,255,0.25)",textAlign:"center",padding:50}}>لا توجد صفقات</p>}
              {sorted.map((t,i)=>{
                const isW=t.pnl>=0;const gc=GC[t.grade]||"rgba(255,255,255,0.4)";
                return(
                  <div key={i} className="row-hover" onClick={()=>setTradeSel(t)}
                    style={{display:"grid",gridTemplateColumns:"8px 1fr 80px 80px 70px 70px",gap:12,padding:"14px 16px",borderRadius:14,background:"rgba(255,255,255,0.02)",border:`1px solid rgba(255,255,255,0.05)`,alignItems:"center"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:isW?"#10b981":"#ef4444"}}/>
                    <div>
                      <p style={{fontSize:15,fontWeight:800,color:"#fff",fontFamily:"'JetBrains Mono',monospace"}}>{t.symbol}{t.image&&<span style={{fontSize:11,marginRight:6}} title="يحتوي على صورة">📸</span>}</p>
                      <p style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>{t.date}{t.setup?" · "+t.setup:""}{t.session?" · "+t.session:""}</p>
                    </div>
                    <p style={{fontSize:15,fontWeight:900,color:isW?"#10b981":"#ef4444",fontFamily:"'JetBrains Mono',monospace",textAlign:"center"}}>{isW?"+":""}${t.pnl}</p>
                    <p style={{fontSize:13,color:"#f59e0b",fontFamily:"'JetBrains Mono',monospace",textAlign:"center"}}>{t.rr||0}:1</p>
                    <div style={{display:"flex",justifyContent:"center"}}>
                      {t.grade?<span style={{background:`${gc}15`,color:gc,border:`1px solid ${gc}25`,borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:800}}>{t.grade}</span>:<span style={{color:"rgba(255,255,255,0.2)",fontSize:12}}>—</span>}
                    </div>
                    <p style={{fontSize:11,fontWeight:700,color:t.direction==="L"?"#10b981":"#ef4444",textAlign:"center"}}>{t.direction==="L"?"LONG":"SHORT"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ANALYSIS ── */}
        {tab==="analysis"&&(()=>{
          const an=generateAnalysis(c);
          return(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* ── AI-STYLE WRITTEN ANALYSIS ── */}
            <div style={{background:"linear-gradient(135deg,rgba(217,119,6,0.08),rgba(217,119,6,0.02))",border:"1px solid rgba(217,119,6,0.18)",borderRadius:18,padding:"22px 24px"}}>
              <p style={{fontSize:10,color:"#FCD34D",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>🧠 تحليل الحالة</p>
              <p style={{fontSize:14,color:"#fff",lineHeight:1.8,fontWeight:600,marginBottom:16}}>{an.verdict}</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div>
                  <p style={{fontSize:10,color:"#10b98190",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>✅ نقاط القوة</p>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {an.strengths.length?an.strengths.map((s,i)=>(
                      <p key={i} style={{fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.6}}>• {s}</p>
                    )):<p style={{fontSize:12,color:"rgba(255,255,255,0.25)"}}>لا توجد نقاط قوة واضحة بعد</p>}
                  </div>
                </div>
                <div>
                  <p style={{fontSize:10,color:"#ef444490",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>⚠️ نقاط الضعف</p>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {an.weaknesses.length?an.weaknesses.map((s,i)=>(
                      <p key={i} style={{fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.6}}>• {s}</p>
                    )):<p style={{fontSize:12,color:"rgba(255,255,255,0.25)"}}>لا توجد نقاط ضعف واضحة</p>}
                  </div>
                </div>
              </div>
              <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid rgba(217,119,6,0.12)"}}>
                <p style={{fontSize:10,color:"#FCD34D",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>💡 توصيات عملية</p>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {an.recs.map((r,i)=>(
                    <p key={i} style={{fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.6,background:"rgba(217,119,6,0.06)",border:"1px solid rgba(217,119,6,0.12)",borderRadius:8,padding:"8px 12px"}}>→ {r}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* ── EQUITY CURVE ── */}
            <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"20px 22px"}}>
              <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>📈 منحنى الأداء التراكمي (Equity Curve)</p>
              <EquityChart data={c.equityCurve}/>
            </div>

            {/* ── PERFORMANCE TABLES ── */}
            <PerfTable title="الأداء حسب الرمز (Symbol)" icon="💱" rows={c.symbolStats}/>
            <PerfTable title="الأداء حسب الإعداد (Setup)" icon="🎯" rows={c.setupStats}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>🕐 الربح/الخسارة حسب الجلسة</p>
                <BreakdownBarChart rows={c.sessionStats} valueKey="pnl"/>
              </div>
              <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>📅 الربح/الخسارة حسب يوم الأسبوع</p>
                <BreakdownBarChart rows={c.dowStats} valueKey="pnl"/>
              </div>
            </div>

            {/* R-Multiple Distribution */}
            <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"20px 22px"}}>
              <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>📐 توزيع المخاطرة/العائد (R-Multiple)</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                {[
                  {lbl:"3R+",n:c.rMultiples?.r3,col:"#10b981"},
                  {lbl:"2R–3R",n:c.rMultiples?.r2,col:"#34d399"},
                  {lbl:"1R–2R",n:c.rMultiples?.r1,col:"#FCD34D"},
                  {lbl:"خسارة",n:c.rMultiples?.rNeg,col:"#ef4444"},
                ].map(x=>(
                  <div key={x.lbl} style={{textAlign:"center",background:"rgba(255,255,255,0.02)",borderRadius:12,padding:"14px 8px"}}>
                    <p style={{fontSize:22,fontWeight:900,color:x.col,fontFamily:"'JetBrains Mono',monospace"}}>{x.n||0}</p>
                    <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:700,marginTop:4}}>{x.lbl}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Grade Breakdown */}
            {Object.keys(c.gradeMap||{}).length>0&&(
              <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>📝 Grade Distribution</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(70px,1fr))",gap:8}}>
                  {Object.entries(c.gradeMap).sort().map(([g,n])=>{
                    const col=GC[g]||"#fff";
                    const pct=Math.round(n/c.count*100);
                    return(
                      <div key={g} style={{background:`${col}08`,border:`1px solid ${col}20`,borderRadius:12,padding:"14px 8px",textAlign:"center"}}>
                        <p style={{fontSize:22,fontWeight:900,color:col}}>{g}</p>
                        <p style={{fontSize:18,fontWeight:900,color:"#fff",marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>{n}</p>
                        <p style={{fontSize:10,color:`${col}70`,marginTop:2}}>{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Setups */}
            {c.topSetups?.length>0&&(
              <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(217,119,6,0.1)",borderRadius:18,padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(217,119,6,0.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>🎯 Top Setups</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {c.topSetups.map(([s,n],idx)=>{
                    const pct=Math.round(n/c.count*100);
                    const cols=["#D97706","#F59E0B","#FBBF24","#FCD34D","#FDE68A"];
                    const col=cols[idx]||"#D97706";
                    return(
                      <div key={s}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,alignItems:"center"}}>
                          <span style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{s}</span>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{n} trades</span>
                            <span style={{fontSize:12,color:col,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{pct}%</span>
                          </div>
                        </div>
                        <div style={{height:5,background:"rgba(255,255,255,0.05)",borderRadius:3}}>
                          <div style={{height:5,width:pct+"%",background:`linear-gradient(90deg,${col},${col}80)`,borderRadius:3,transition:"width 1s ease"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conditions Compliance */}
            {c.strongConditions?.length>0&&(
              <div style={{background:"linear-gradient(135deg,rgba(16,185,129,0.05),rgba(16,185,129,0.01))",border:"1px solid rgba(16,185,129,0.12)",borderRadius:18,padding:"20px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <p style={{fontSize:10,color:"#10b98180",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em"}}>✅ Conditions Compliance</p>
                  <span style={{fontSize:11,color:"#10b981",fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{c.avgConditions} avg/trade</span>
                </div>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Most followed</p>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                  {c.strongConditions.map(([cn,n])=>{
                    const pct=Math.round(n/c.count*100);
                    return(
                      <div key={cn}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontWeight:500}}>{cn}</span>
                          <span style={{fontSize:11,color:"#10b981",fontWeight:700}}>{pct}%</span>
                        </div>
                        <div style={{height:4,background:"rgba(255,255,255,0.05)",borderRadius:2}}>
                          <div style={{height:4,width:pct+"%",background:"linear-gradient(90deg,#10b981,#34d399)",borderRadius:2}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p style={{fontSize:10,color:"#ef444470",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>⚠️ Needs attention</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {c.weakConditions.map(([cn,n])=>{
                    const pct=Math.round(n/c.count*100);
                    return(
                      <div key={cn}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:12,color:"rgba(255,255,255,0.55)",fontWeight:500}}>{cn}</span>
                          <span style={{fontSize:11,color:"#f59e0b",fontWeight:700}}>{pct}%</span>
                        </div>
                        <div style={{height:4,background:"rgba(255,255,255,0.05)",borderRadius:2}}>
                          <div style={{height:4,width:pct+"%",background:"linear-gradient(90deg,#f59e0b,#fbbf24)",borderRadius:2}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Mistakes */}
            {c.topMistakes?.length>0&&(
              <div style={{background:"linear-gradient(135deg,rgba(239,68,68,0.05),rgba(239,68,68,0.01))",border:"1px solid rgba(239,68,68,0.12)",borderRadius:18,padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(239,68,68,0.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>⚠️ Common Mistakes</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {c.topMistakes.map(([m,n])=>(
                    <div key={m} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.1)",borderRadius:10}}>
                      <span style={{fontSize:13,color:"#fca5a5",fontWeight:500}}>{m}</span>
                      <span style={{background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,padding:"2px 10px",fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{n}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );})()}

        {/* ── PSYCHOLOGY ── */}
        {tab==="psychology"&&(()=>{
          /* ── compute psychology metrics ── */
          const trades=c.trades||[];
          const wins=trades.filter(t=>t.pnl>0);
          const losses=trades.filter(t=>t.pnl<0);
          // Revenge trading: losses followed by bigger loss
          const sorted=[...trades].sort((a,b)=>(a.date||"").localeCompare(b.date||""));
          let revengeTrades=0;
          for(let i=1;i<sorted.length;i++){if(sorted[i-1].pnl<0&&sorted[i].pnl<sorted[i-1].pnl)revengeTrades++;}
          // Overtrading days: >3 trades in one day
          const byDay={};sorted.forEach(t=>{byDay[t.date]=(byDay[t.date]||0)+1;});
          const overtradeDays=Object.values(byDay).filter(n=>n>3).length;
          // FOMO: trades without setup or conditions
          const fomoTrades=trades.filter(t=>!t.setup||!t.conditions?.length).length;
          // Discipline score
          const discScore=Math.max(0,100-Math.round((c.noSLCount/Math.max(c.count,1))*60)
            -Math.round((revengeTrades/Math.max(c.count,1))*20)
            -Math.round((fomoTrades/Math.max(c.count,1))*20));
          // Emotional control: win after loss sequence
          let recoveries=0,breaks=0;
          for(let i=1;i<sorted.length;i++){if(sorted[i-1].pnl<0){if(sorted[i].pnl>0)recoveries++;else breaks++;}}
          const emotionScore=recoveries+breaks>0?Math.round(recoveries/(recoveries+breaks)*100):50;
          // Grade distribution
          const grades=["A+","A","B","C","D"];
          const gradeData=grades.map(g=>({g,n:c.gradeCounts?.[g]||0,col:g==="A+"?"#10b981":g==="A"?"#34d399":g==="B"?"#FBBF24":g==="C"?"#f59e0b":"#ef4444"}));
          // Session emotional map
          const sessionMood={};
          trades.forEach(t=>{if(t.session){if(!sessionMood[t.session])sessionMood[t.session]={w:0,l:0};if(t.pnl>0)sessionMood[t.session].w++;else sessionMood[t.session].l++;}});
          // Whoop-style ring pcts
          const rings=[
            {label:"الانضباط",pct:discScore,col:"#D97706",icon:"⚔️",tip:discScore>=80?"انضباط ممتاز — تتبع الخطة باستمرار":discScore>=60?"انضباط جيد لكن هناك صفقات خارج الخطة":"الانضباط منخفض — راجع شروط الدخول"},
            {label:"التحكم العاطفي",pct:emotionScore,col:"#10b981",icon:"🧘",tip:emotionScore>=70?"تعافٍ ممتاز بعد الخسائر — علامة على نضج نفسي":emotionScore>=50?"تحكم عاطفي متوسط":"صعوبة في التعافي بعد الخسائر — التوقف المؤقت مفيد"},
            {label:"جودة الإعداد",pct:Math.round((c.count-fomoTrades)/Math.max(c.count,1)*100),col:"#818CF8",icon:"📋",tip:"نسبة الصفقات التي لها إعداد وشروط واضحة"},
            {label:"إدارة المخاطر",pct:Math.round((c.count-c.noSLCount)/Math.max(c.count,1)*100),col:"#F472B6",icon:"🛡️",tip:"نسبة الصفقات المحمية بوقف خسارة"},
          ];

          return(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>

            {/* ── WHOOP RINGS ROW ── */}
            <div style={{background:"rgba(10,7,0,0.7)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:24,padding:"24px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-60,right:-40,width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle,rgba(217,119,6,0.08),transparent 70%)",pointerEvents:"none"}}/>
              <p style={{fontSize:10,color:"rgba(217,119,6,0.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:".12em",marginBottom:20}}>⬤ مؤشرات الأداء النفسي</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
                {rings.map((ring,ri)=>{
                  const circumference=2*Math.PI*38;
                  const offset=circumference*(1-ring.pct/100);
                  return(
                    <div key={ri} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,cursor:"default"}}
                      title={ring.tip}>
                      <div style={{position:"relative",width:100,height:100}}>
                        <svg width={100} height={100} viewBox="0 0 100 100">
                          <circle cx={50} cy={50} r={38} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10}/>
                          <circle cx={50} cy={50} r={38} fill="none" stroke={ring.col} strokeWidth={10}
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            style={{transform:"rotate(-90deg)",transformOrigin:"50% 50%",
                              filter:`drop-shadow(0 0 8px ${ring.col}80)`,
                              transition:"stroke-dashoffset 1.4s cubic-bezier(.34,1.56,.64,1)"}}/>
                          <text x={50} y={47} textAnchor="middle" fill={ring.col} fontSize={16} fontWeight={900} fontFamily="'JetBrains Mono',monospace">{ring.pct}</text>
                          <text x={50} y={60} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9} fontWeight={600}>%</text>
                        </svg>
                        <div style={{position:"absolute",top:-6,right:-6,width:24,height:24,borderRadius:"50%",background:"rgba(10,7,0,0.9)",border:`1px solid ${ring.col}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>{ring.icon}</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{ring.label}</p>
                        <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:2,lineHeight:1.4,maxWidth:100,textAlign:"center"}}>{ring.tip.slice(0,40)}...</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── BEHAVIORAL ALERTS ── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              {[
                {icon:"😤",label:"صفقات انتقام",value:revengeTrades,total:c.count,warn:revengeTrades>2,
                  tip:"خسارة تليها خسارة أكبر = مؤشر على تداول انتقامي",col:"#ef4444"},
                {icon:"🎲",label:"أيام المبالغة",value:overtradeDays,total:Object.keys(byDay).length,warn:overtradeDays>3,
                  tip:"أيام بأكثر من 3 صفقات — خطر التداول المفرط",col:"#f59e0b"},
                {icon:"💨",label:"صفقات FOMO",value:fomoTrades,total:c.count,warn:fomoTrades>c.count*0.3,
                  tip:"صفقات بدون إعداد أو شروط واضحة",col:"#818CF8"},
              ].map((item,i)=>{
                const pct=item.total>0?Math.round(item.value/item.total*100):0;
                return(
                <div key={i} className="whoop-card" style={{padding:"18px 20px",borderColor:item.warn?`${item.col}30`:"rgba(255,255,255,0.06)"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <span style={{fontSize:20}}>{item.icon}</span>
                    {item.warn&&<span style={{fontSize:9,fontWeight:700,color:item.col,background:`${item.col}15`,border:`1px solid ${item.col}30`,borderRadius:5,padding:"2px 7px"}}>تنبيه</span>}
                  </div>
                  <p style={{fontSize:24,fontWeight:900,color:item.warn?item.col:"#fff",fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{item.value}</p>
                  <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",marginTop:4}}>{item.label}</p>
                  <div style={{marginTop:10,height:3,background:"rgba(255,255,255,0.06)",borderRadius:3}}>
                    <div style={{height:3,width:pct+"%",background:`linear-gradient(90deg,${item.col},${item.col}80)`,borderRadius:3,transition:"width 1.2s cubic-bezier(.34,1.56,.64,1)"}}/>
                  </div>
                  <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:5}}>{pct}% من إجمالي الصفقات</p>
                  <p style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:6,lineHeight:1.5}}>{item.tip}</p>
                </div>
              )})}
            </div>

            {/* ── STREAK TIMELINE ── */}
            <div className="whoop-card" style={{padding:"20px 22px"}}>
              <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>📈 سلسلة الأداء (آخر 20 صفقة)</p>
              <div style={{display:"flex",gap:4,alignItems:"flex-end",height:48}}>
                {sorted.slice(-20).map((t,i)=>{
                  const h=Math.min(48,Math.max(6,Math.abs(t.pnl)/Math.max(...sorted.map(x=>Math.abs(x.pnl)),1)*48));
                  return(
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}} title={`${t.symbol} · ${t.pnl>=0?"+":""}$${t.pnl}`}>
                      <div style={{width:"100%",height:h,borderRadius:"3px 3px 0 0",
                        background:t.pnl>=0?"linear-gradient(180deg,#10b981,#059669)":"linear-gradient(180deg,#ef4444,#dc2626)",
                        boxShadow:`0 0 6px ${t.pnl>=0?"rgba(16,185,129,0.4)":"rgba(239,68,68,0.4)"}`,
                        transition:"height .8s cubic-bezier(.34,1.56,.64,1) "+i*.03+"s"}}/>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:10}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:8,height:8,borderRadius:2,background:"#10b981"}}/>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>ربح ({wins.length})</span>
                </div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>Best: {c.winStreak} · Worst: {c.lossStreak}</div>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:8,height:8,borderRadius:2,background:"#ef4444"}}/>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>خسارة ({losses.length})</span>
                </div>
              </div>
            </div>

            {/* ── GRADE DISTRIBUTION + SESSION MOOD ── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div className="whoop-card" style={{padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>🏆 توزيع التقييمات</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {gradeData.filter(g=>g.n>0).map(({g,n,col})=>{
                    const pct=c.count>0?Math.round(n/c.count*100):0;
                    return(
                      <div key={g}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"center"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:13,fontWeight:900,color:col,width:26,textAlign:"center",background:`${col}15`,border:`1px solid ${col}30`,borderRadius:6,padding:"1px 4px"}}>{g}</span>
                            <span style={{fontSize:12,color:"rgba(255,255,255,0.55)",fontWeight:500}}>{n} صفقة</span>
                          </div>
                          <span style={{fontSize:11,color:col,fontWeight:700}}>{pct}%</span>
                        </div>
                        <div style={{height:5,background:"rgba(255,255,255,0.04)",borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:5,borderRadius:3,background:`linear-gradient(90deg,${col},${col}80)`,
                            boxShadow:`0 0 8px ${col}40`,
                            width:pct+"%",transition:"width 1s cubic-bezier(.34,1.56,.64,1)"}}/>
                        </div>
                      </div>
                    );
                  })}
                  {gradeData.every(g=>g.n===0)&&<p style={{fontSize:12,color:"rgba(255,255,255,0.25)",textAlign:"center",padding:"20px 0"}}>لا توجد تقييمات بعد</p>}
                </div>
              </div>

              <div className="whoop-card" style={{padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>⏰ حالة الجلسات</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {Object.entries(sessionMood).map(([sess,{w,l}])=>{
                    const total=w+l;const wr=Math.round(w/total*100);
                    const col=wr>=65?"#10b981":wr>=45?"#f59e0b":"#ef4444";
                    return(
                      <div key={sess} style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:col,flexShrink:0,boxShadow:`0 0 6px ${col}`}}/>
                        <span style={{fontSize:12,color:"rgba(255,255,255,0.65)",flex:1,fontWeight:600}}>{sess}</span>
                        <div style={{display:"flex",gap:4,alignItems:"center"}}>
                          <span style={{fontSize:10,color:"#10b981"}}>{w}✓</span>
                          <span style={{fontSize:10,color:"rgba(255,255,255,0.2)"}}>/</span>
                          <span style={{fontSize:10,color:"#ef4444"}}>{l}✗</span>
                        </div>
                        <span style={{fontSize:12,fontWeight:700,color:col,width:36,textAlign:"right"}}>{wr}%</span>
                      </div>
                    );
                  })}
                  {Object.keys(sessionMood).length===0&&<p style={{fontSize:12,color:"rgba(255,255,255,0.25)",textAlign:"center",padding:"20px 0"}}>لا توجد بيانات جلسات</p>}
                </div>
              </div>
            </div>

            {/* ── BEHAVIORAL MISTAKES ── */}
            {c.topMistakes?.length>0&&(
              <div className="whoop-card" style={{padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>🧠 أنماط سلوكية متكررة</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {c.topMistakes.map(([m,n],i)=>{
                    const totalM=c.topMistakes.reduce((s,[,v])=>s+v,0);
                    const pct=Math.round(n/totalM*100);
                    const severity=pct>40?"high":pct>20?"medium":"low";
                    const col=severity==="high"?"#ef4444":severity==="medium"?"#f59e0b":"#FCD34D";
                    return(
                      <div key={m} style={{background:`${col}08`,border:`1px solid ${col}20`,borderRadius:12,padding:"12px 14px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <span style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:600,lineHeight:1.3,flex:1}}>{m}</span>
                          <span style={{fontSize:13,fontWeight:900,color:col,marginRight:8}}>{pct}%</span>
                        </div>
                        <div style={{height:3,background:"rgba(255,255,255,0.05)",borderRadius:2}}>
                          <div style={{height:3,width:pct+"%",background:`linear-gradient(90deg,${col},${col}60)`,borderRadius:2,transition:"width 1.2s ease"}}/>
                        </div>
                        <p style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginTop:5}}>{n} مرة من أصل {c.count} صفقة</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── MOTIVATIONS — WHOOP JOURNAL STYLE ── */}
            {c.motivations?.length>0&&(
              <div style={{background:"linear-gradient(135deg,rgba(217,119,6,0.08),rgba(217,119,6,0.02))",backdropFilter:"blur(20px)",border:"1px solid rgba(217,119,6,0.15)",borderRadius:20,padding:"22px",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,rgba(217,119,6,0.5),transparent)"}}/>
                <p style={{fontSize:10,color:"rgba(217,119,6,0.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>💬 كلمات التحفيز الشخصية</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {c.motivations.slice(0,6).map((m,i)=>(
                    <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"12px 14px",
                      background:"rgba(217,119,6,0.06)",border:"1px solid rgba(217,119,6,0.08)",borderRadius:12}}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,rgba(217,119,6,0.3),rgba(217,119,6,0.1))",
                        border:"1px solid rgba(217,119,6,0.3)",display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:10,fontWeight:900,color:"#FBBF24",flexShrink:0}}>{i+1}</div>
                      <p style={{fontSize:13,color:"#FDE68A",fontStyle:"italic",lineHeight:1.7,flex:1}}>"{typeof m==="string"?m:m.text||m.q||JSON.stringify(m)}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
          );
        })()}

            {tradeSel&&<TradeModal trade={tradeSel} onClose={()=>setTradeSel(null)}/>}

      {kpiSel&&(()=>{
        const info=kpiInfo(kpiSel.id);
        return(
          <div onClick={()=>setKpiSel(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
            <div onClick={e=>e.stopPropagation()} className="modal-glass" style={{width:"100%",maxWidth:640,maxHeight:"92vh",overflowY:"auto",animation:"popIn .2s ease"}}>
              {/* glass header */}
              <div style={{background:`linear-gradient(135deg,${kpiSel.color}15,rgba(10,7,0,0.9))`,borderBottom:`1px solid ${kpiSel.color}20`,padding:"24px 26px",borderRadius:"24px 24px 0 0",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${kpiSel.color},transparent)`}}/>
                <div style={{position:"absolute",top:-40,right:-30,width:130,height:130,borderRadius:"50%",background:`radial-gradient(circle,${kpiSel.color}18,transparent 70%)`,pointerEvents:"none"}}/>
                <div style={{display:"flex",alignItems:"center",gap:16,position:"relative"}}>
                  <div style={{width:56,height:56,borderRadius:16,background:`linear-gradient(135deg,${kpiSel.color}25,${kpiSel.color}10)`,border:`1.5px solid ${kpiSel.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,boxShadow:`0 8px 24px ${kpiSel.color}25`}}>{kpiSel.icon}</div>
                  <div style={{flex:1}}>
                    <p style={{fontSize:10,color:`${kpiSel.color}90`,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:3}}>{kpiSel.label}</p>
                    <p style={{fontSize:32,fontWeight:900,color:kpiSel.color,fontFamily:"'JetBrains Mono',monospace",lineHeight:1,letterSpacing:"-.02em",textShadow:`0 0 20px ${kpiSel.color}50`}}>{kpiSel.value}</p>
                  </div>
                  <button onClick={()=>setKpiSel(null)}
                    style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,width:34,height:34,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(239,68,68,0.2)";e.currentTarget.style.color="#f87171";e.currentTarget.style.transform="rotate(90deg)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color="rgba(255,255,255,0.5)";e.currentTarget.style.transform="";}}>✕</button>
                </div>
              </div>

              <div style={{padding:"22px 24px",display:"flex",flexDirection:"column",gap:18}}>
                {/* explanation - glass card */}
                <div style={{background:"rgba(255,255,255,0.03)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"16px 18px",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:"20%",right:"20%",height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)"}}/>
                  <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>📖 ما معنى هذا الرقم؟</p>
                  <p style={{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.8,fontWeight:500}}>{info.explain}</p>
                </div>

                {/* verdict - gold glass */}
                <div style={{background:`linear-gradient(135deg,${info.verdict.c}12,${info.verdict.c}05)`,backdropFilter:"blur(10px)",border:`1px solid ${info.verdict.c}30`,borderRadius:16,padding:"16px 18px",display:"flex",gap:12,alignItems:"flex-start",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${info.verdict.c}40,transparent)`}}/>
                  <div style={{width:32,height:32,borderRadius:10,background:`${info.verdict.c}15`,border:`1px solid ${info.verdict.c}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>💡</div>
                  <p style={{fontSize:13,color:"rgba(255,255,255,0.85)",fontWeight:600,lineHeight:1.7}}>{info.verdict.t}</p>
                </div>

                {/* dedicated chart */}
                <div>
                  <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}}>📊 السياق البياني</p>
                  {info.chart==="equity"&&<EquityChart data={c.equityCurve} h={160}/>}
                  {info.chart==="sessions"&&<BreakdownBarChart rows={c.sessionStats} valueKey="wr"/>}
                  {info.chart==="dow"&&<BreakdownBarChart rows={c.dowStats} valueKey="count"/>}
                  {info.chart==="symbolVolume"&&<BreakdownBarChart rows={c.symbolStats} valueKey="count"/>}
                  {info.chart==="rmultiple"&&(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                      {[{lbl:"3R+",n:c.rMultiples?.r3,col:"#10b981"},{lbl:"2R–3R",n:c.rMultiples?.r2,col:"#34d399"},{lbl:"1R–2R",n:c.rMultiples?.r1,col:"#FCD34D"},{lbl:"خسارة",n:c.rMultiples?.rNeg,col:"#ef4444"}].map(x=>(
                        <div key={x.lbl} style={{textAlign:"center",background:"rgba(255,255,255,0.03)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 6px",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=x.col+"40";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";e.currentTarget.style.transform="";}}>
                          <p style={{fontSize:18,fontWeight:900,color:x.col,fontFamily:"'JetBrains Mono',monospace"}}>{x.n||0}</p>
                          <p style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:700,marginTop:3}}>{x.lbl}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {info.chart==="conditions"&&(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {(c.strongConditions||[]).slice(0,3).map(([cn,n])=>(
                        <div key={cn} style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                          <span style={{color:"rgba(255,255,255,0.65)"}}>{cn}</span>
                          <span style={{color:"#10b981",fontWeight:700}}>{Math.round(n/c.count*100)}%</span>
                        </div>
                      ))}
                      {(c.weakConditions||[]).slice(0,3).map(([cn,n])=>(
                        <div key={cn} style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                          <span style={{color:"rgba(255,255,255,0.5)"}}>{cn}</span>
                          <span style={{color:"#f59e0b",fontWeight:700}}>{Math.round(n/c.count*100)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {info.chart==="noSL"&&(
                    <div style={{textAlign:"center",padding:"20px 0"}}>
                      <p style={{fontSize:32,fontWeight:900,color:c.noSLCount>0?"#ef4444":"#10b981",fontFamily:"'JetBrains Mono',monospace"}}>{c.noSLCount}/{c.count}</p>
                      <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:4}}>صفقات بدون وقف خسارة محدد</p>
                    </div>
                  )}
                  {info.chart==="gallery"&&(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:8}}>
                      {sorted.filter(t=>t.image).slice(0,8).map((t,i)=>(
                        <img key={i} src={t.image} alt="" style={{width:"100%",height:60,objectFit:"cover",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)"}}/>
                      ))}
                      {!sorted.filter(t=>t.image).length&&<p style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>لا توجد صور مرفقة بعد</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ══════════════════════════════════════════════════════ */
/*  MAIN ADMIN DASHBOARD                                  */
/* ══════════════════════════════════════════════════════ */
export default function AdminPage({user,onBack}){
  const [clients,setClients]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState("score");
  const [selected,setSelected]=useState(null);
  const [error,setError]=useState("");
  const [view,setView]=useState("grid");

  if(!isAdmin(user))return(
    <div style={{minHeight:"100vh",background:"#0C0A08",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,fontFamily:"'Outfit',sans-serif"}}>
      <style>{CSS}</style>
      <div style={{fontSize:60}}>🚫</div>
      <p style={{color:"#ef4444",fontSize:18,fontWeight:800}}>غير مصرح لك</p>
      <button className="btn-hover" onClick={onBack} style={{background:"rgba(217,119,6,0.15)",color:"#FCD34D",border:"1px solid rgba(217,119,6,0.3)",borderRadius:12,padding:"10px 24px",cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>رجوع</button>
    </div>
  );

  useEffect(()=>{loadClients();},[]);

  async function loadClients(){
    setLoading(true);setError("");
    try{
      const snap=await getDocs(collection(db,"users"));
      const list=[];
      snap.forEach(doc=>{
        const d=doc.data();
        const stats=calcStats(d.trades||[]);
        list.push({uid:doc.id,name:d.name||"بدون اسم",email:d.email||"",phone:d.phone||"",createdAt:d.createdAt?.toDate?.()||null,trades:d.trades||[],motivations:d.motivations||[],...stats});
      });
      setClients(list);
    }catch(e){setError("خطأ: "+e.message);}
    setLoading(false);
  }

  if(selected)return<ProfilePage client={selected} onBack={()=>setSelected(null)}/>;

  const filtered=clients
    .filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>sort==="score"?b.score-a.score:sort==="wr"?b.wr-a.wr:sort==="trades"?b.count-a.count:a.name.localeCompare(b.name));

  const totalPnl=clients.reduce((s,c)=>s+(c.total||0),0);
  const avgScore=clients.length?Math.round(clients.reduce((s,c)=>s+c.score,0)/clients.length):0;
  const avgWR=clients.length?Math.round(clients.reduce((s,c)=>s+c.wr,0)/clients.length):0;
  const eliteCount=clients.filter(c=>c.score>=70).length;
  const totalTrades=clients.reduce((s,c)=>s+c.count,0);

  return(
    <div style={{minHeight:"100vh",background:"#0C0A08",color:"#fff",fontFamily:"'Outfit',sans-serif",direction:"rtl"}}>
      <style>{CSS}</style>

      {/* ── SIDEBAR-STYLE HEADER ── */}
      <div style={{background:"linear-gradient(180deg,#170F08 0%,#120A04 100%)",borderBottom:"1px solid rgba(217,119,6,0.08)"}}>
        {/* top bar */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 28px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#D97706,#F59E0B)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 0 20px rgba(217,119,6,0.4)"}}>🛡️</div>
            <div>
              <h1 style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:"-.02em",lineHeight:1}}>OHM Admin</h1>
              <p style={{fontSize:10,color:"rgba(217,119,6,0.6)",fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",marginTop:2}}>Control Center</p>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 8px #10b981",animation:"pulse2 2s infinite"}}/>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginLeft:4,fontWeight:500}}>{clients.length} clients online</span>
            <button className="btn-hover" onClick={onBack} style={{background:"rgba(217,119,6,0.1)",border:"1px solid rgba(217,119,6,0.2)",borderRadius:10,padding:"7px 16px",color:"#FCD34D",fontSize:12,fontWeight:700,fontFamily:"inherit",marginRight:4}}>← App</button>
            <button className="btn-hover" onClick={()=>logoutUser()} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"7px 16px",color:"#f87171",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>Logout</button>
          </div>
        </div>

        {/* KPI row */}
        {!loading&&clients.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:0,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            {[
              {l:"Total Clients",v:clients.length,i:"👥",c:"#D97706"},
              {l:"Elite Traders",v:eliteCount,i:"🏆",c:"#f59e0b"},
              {l:"Avg Score",v:avgScore,i:"⚡",c:"#F59E0B"},
              {l:"Avg Win Rate",v:avgWR+"%",i:"🎯",c:"#FB923C"},
              {l:"Total Trades",v:totalTrades,i:"📊",c:"#10b981"},
            ].map(({l,v,i,c},idx)=>(
              <div key={l} style={{padding:"16px 20px",borderLeft:idx>0?"1px solid rgba(255,255,255,0.04)":"none",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${c}60,transparent)`}}/>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:14}}>{i}</span>
                  <span style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>{l}</span>
                </div>
                <p style={{fontSize:24,fontWeight:900,color:c,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{v}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SEARCH + CONTROLS ── */}
      <div style={{padding:"16px 28px",background:"rgba(0,0,0,0.3)",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200,position:"relative"}}>
          <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.2)",fontSize:13}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم أو إيميل..."
            style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"9px 40px 9px 14px",color:"#fff",fontSize:13,fontFamily:"inherit"}}/>
        </div>

        <div style={{display:"flex",gap:6}}>
          {[["score","⚡ Score"],["wr","🎯 WR"],["trades","📊 Trades"],["name","🔤 Name"]].map(([k,l])=>(
            <button key={k} className="btn-hover" onClick={()=>setSort(k)}
              style={{background:sort===k?"rgba(217,119,6,0.2)":"rgba(255,255,255,0.03)",color:sort===k?"#FCD34D":"rgba(255,255,255,0.4)",border:`1px solid ${sort===k?"rgba(217,119,6,0.3)":"rgba(255,255,255,0.06)"}`,borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:600,fontFamily:"inherit",whiteSpace:"nowrap"}}>
              {l}
            </button>
          ))}
        </div>

        <div style={{display:"flex",gap:4}}>
          {[["grid","⊞"],["list","☰"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{background:view===v?"rgba(217,119,6,0.2)":"rgba(255,255,255,0.03)",color:view===v?"#FCD34D":"rgba(255,255,255,0.35)",border:`1px solid ${view===v?"rgba(217,119,6,0.3)":"rgba(255,255,255,0.06)"}`,borderRadius:8,padding:"8px 12px",fontSize:14,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
              {l}
            </button>
          ))}
          <button className="btn-hover" onClick={loadClients} style={{background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit"}}>🔄</button>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{padding:"20px 28px 80px"}}>
        {loading&&(
          <div style={{textAlign:"center",padding:80}}>
            <div style={{width:44,height:44,borderRadius:"50%",border:"3px solid rgba(217,119,6,0.1)",borderTopColor:"#D97706",animation:"spin .8s linear infinite",margin:"0 auto 16px"}}/>
            <p style={{color:"rgba(255,255,255,0.25)",fontSize:13,animation:"pulse2 1.5s infinite"}}>جاري تحميل البيانات...</p>
          </div>
        )}

        {error&&<div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:14,padding:"16px 20px",color:"#f87171",fontSize:13,marginBottom:16}}>{error}</div>}

        {!loading&&filtered.length===0&&!error&&(
          <div style={{textAlign:"center",padding:80}}>
            <p style={{fontSize:40,marginBottom:12}}>🔍</p>
            <p style={{color:"rgba(255,255,255,0.2)",fontSize:15}}>لا توجد نتائج</p>
          </div>
        )}

        {/* GRID */}
        {view==="grid"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
            {filtered.map((c,idx)=>{
              const sc=c.score>=70?"#10b981":c.score>=45?"#f59e0b":"#ef4444";
              return(
                <div key={c.uid} className="card-hover" onClick={()=>setSelected(c)}
                  style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"20px",overflow:"hidden",position:"relative",animation:`fadeUp .35s ease ${idx*0.04}s both`,boxShadow:"0 4px 24px rgba(0,0,0,0.3)"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${sc}60,transparent)`}}/>

                  {/* header */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:48,height:48,borderRadius:14,background:`linear-gradient(135deg,${sc}25,${sc}08)`,border:`1.5px solid ${sc}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:sc,flexShrink:0,fontFamily:"'JetBrains Mono',monospace"}}>
                        {(c.name||"?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{fontSize:16,fontWeight:800,color:"#fff",letterSpacing:"-.01em"}}>{c.name}</p>
                        <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2}}>{c.email}</p>
                      </div>
                    </div>
                    <div style={{position:"relative",flexShrink:0}}>
                      <ScoreArc score={c.score} size={56}/>
                    </div>
                  </div>

                  {/* stats row */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                    {[
                      {l:"Win Rate",v:c.wr+"%",c:c.wr>=60?"#10b981":c.wr>=40?"#f59e0b":"#ef4444"},
                      {l:"Trades",v:c.count,c:"#F59E0B"},
                      {l:"Avg RR",v:c.avgRR,c:"#f59e0b"},
                    ].map(({l,v,c:col})=>(
                      <div key={l} style={{background:`${col}08`,border:`1px solid ${col}15`,borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                        <p style={{fontSize:8,color:`${col}70`,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{l}</p>
                        <p style={{fontSize:16,fontWeight:900,color:col,fontFamily:"'JetBrains Mono',monospace"}}>{v}</p>
                      </div>
                    ))}
                  </div>

                  {/* bottom row */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <p style={{fontSize:14,fontWeight:800,color:c.total>=0?"#10b981":"#ef4444",fontFamily:"'JetBrains Mono',monospace"}}>{c.total>=0?"+":""}${c.total?.toFixed(0)}</p>
                      <p style={{fontSize:9,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:".06em",marginTop:1}}>Total PnL</p>
                    </div>
                    <Sparkline trades={c.trades} w={90} h={28}/>
                    {c.createdAt&&<p style={{fontSize:9,color:"rgba(255,255,255,0.2)"}}>📅{c.createdAt.toLocaleDateString("ar")}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST */}
        {view==="list"&&(
          <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.05)",borderRadius:18,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"48px 1fr 90px 80px 80px 80px 100px",gap:12,padding:"10px 20px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              {["","العميل","Score","WR","Trades","PnL",""].map((h,i)=>(
                <span key={i} style={{fontSize:9,color:"rgba(255,255,255,0.25)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",textAlign:i>0&&i<6?"center":"right"}}>{h}</span>
              ))}
            </div>
            {filtered.map((c,idx)=>{
              const sc=c.score>=70?"#10b981":c.score>=45?"#f59e0b":"#ef4444";
              return(
                <div key={c.uid} className="row-hover" onClick={()=>setSelected(c)}
                  style={{display:"grid",gridTemplateColumns:"48px 1fr 90px 80px 80px 80px 100px",gap:12,padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.03)",alignItems:"center",animation:`fadeUp .2s ease ${idx*0.03}s both`,cursor:"pointer"}}>
                  <div style={{width:38,height:38,borderRadius:10,background:`${sc}15`,border:`1px solid ${sc}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:sc,fontFamily:"'JetBrains Mono',monospace"}}>
                    {(c.name||"?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{fontSize:14,fontWeight:700,color:"#fff"}}>{c.name}</p>
                    <p style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{c.email}</p>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <p style={{fontSize:16,fontWeight:900,color:sc,fontFamily:"'JetBrains Mono',monospace"}}>{c.score}</p>
                    <p style={{fontSize:8,color:`${sc}60`,textTransform:"uppercase",letterSpacing:".06em"}}>{c.score>=70?"ELITE":c.score>=45?"GOOD":"WEAK"}</p>
                  </div>
                  <p style={{fontSize:15,fontWeight:800,color:c.wr>=60?"#10b981":c.wr>=40?"#f59e0b":"#ef4444",textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>{c.wr}%</p>
                  <p style={{fontSize:15,fontWeight:800,color:"#F59E0B",textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>{c.count}</p>
                  <p style={{fontSize:14,fontWeight:800,color:c.total>=0?"#10b981":"#ef4444",textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>{c.total>=0?"+":""}${c.total?.toFixed(0)}</p>
                  <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8}}>
                    <Sparkline trades={c.trades} w={60} h={22}/>
                    <span style={{color:"rgba(217,119,6,0.5)",fontSize:16}}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
