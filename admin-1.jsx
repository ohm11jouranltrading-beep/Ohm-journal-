import { useState, useEffect, useRef } from "react";
import { db, logoutUser } from "./firebase-1";
import { collection, getDocs } from "firebase/firestore";

const ADMIN_EMAILS = ["ohm.1.1jouranltrading@gmail.com"];
const isAdmin = (u) => u && ADMIN_EMAILS.includes(u.email);

/* ── Stats Engine ── */
function calcStats(trades = []) {
  if (!trades.length) return { score:0,wr:0,total:0,count:0,avgRR:"0.0",bestDay:null,worstDay:null,topMistakes:[],topSetups:[],longCount:0,shortCount:0,avgPnl:0,winStreak:0,lossStreak:0,profitFactor:"0.00",sessions:{},gradeMap:{},winTotal:0,lossTotal:0 };
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
  return {score,wr,total,count:trades.length,avgRR,bestDay,worstDay,topMistakes,topSetups,longCount:trades.filter(t=>t.direction==="L").length,shortCount:trades.filter(t=>t.direction==="S").length,avgPnl,winStreak:ws,lossStreak:ls,profitFactor,sessions,gradeMap,winTotal,lossTotal:Math.abs(losses.reduce((s,t)=>s+t.pnl,0))};
}

const GC={A:"#00ff87","A+":"#00ffcc",B:"#00d4ff","B+":"#4fc3f7",C:"#ffd700",D:"#ff9800",F:"#ff3366"};
const SC={score:"#6366f1",wr:"#06b6d4",pnl:"#10b981",trades:"#8b5cf6",rr:"#f59e0b",pf:"#ec4899"};

/* ── CSS ── */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#050810;}
::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.4);border-radius:2px;}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pulse2{0%,100%{opacity:1}50%{opacity:0.5}}
@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.3)}50%{box-shadow:0 0 40px rgba(99,102,241,0.6)}}
.card-hover{transition:all .25s cubic-bezier(.4,0,.2,1);cursor:pointer;}
.card-hover:hover{transform:translateY(-4px);border-color:rgba(99,102,241,0.4)!important;box-shadow:0 20px 60px rgba(99,102,241,0.15)!important;}
.btn-hover{transition:all .2s;cursor:pointer;}
.btn-hover:hover{filter:brightness(1.15);transform:scale(1.02);}
.tab-item{transition:all .2s;cursor:pointer;border:none;background:none;}
.row-hover{transition:background .15s;cursor:pointer;}
.row-hover:hover{background:rgba(99,102,241,0.08)!important;}
input{outline:none;transition:border .2s;}
input:focus{border-color:rgba(99,102,241,0.5)!important;}
input::placeholder{color:rgba(255,255,255,0.2);}
.shimmer{background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent);background-size:200% 100%;animation:shimmer 2s infinite;}
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
function ScoreArc({score,size=96}){
  const r=size/2-10;const circ=2*Math.PI*r;
  const col=score>=70?"#10b981":score>=45?"#f59e0b":"#ef4444";
  const glow=score>=70?"rgba(16,185,129,0.4)":score>=45?"rgba(245,158,11,0.4)":"rgba(239,68,68,0.4)";
  const lbl=score>=70?"ELITE":score>=45?"GOOD":"WEAK";
  return(
    <div style={{position:"relative",width:size,height:size}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={circ*(1-score/100)}
          strokeLinecap="round" style={{filter:`drop-shadow(0 0 6px ${glow})`,transition:"stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:size*0.23,fontWeight:900,color:col,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{score}</span>
        <span style={{fontSize:size*0.1,fontWeight:700,color:col+"80",letterSpacing:".1em",marginTop:2}}>{lbl}</span>
      </div>
    </div>
  );
}

/* ── KPI Tile ── */
function KpiTile({icon,label,value,sub,color,delay=0}){
  return(
    <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:`1px solid ${color}18`,borderRadius:16,padding:"18px 20px",position:"relative",overflow:"hidden",animation:`fadeUp .4s ease ${delay}s both`}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${color},transparent)`}}/>
      <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:`${color}06`}}/>
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
      <div onClick={e=>e.stopPropagation()} style={{background:"#0d1117",border:"1px solid rgba(99,102,241,0.2)",borderRadius:24,width:"100%",maxWidth:540,maxHeight:"90vh",overflowY:"auto",position:"relative",boxShadow:"0 40px 100px rgba(0,0,0,0.8)"}}>
        {/* modal header */}
        <div style={{background:`linear-gradient(135deg,${isW?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)"},rgba(99,102,241,0.05))`,borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"22px 24px",borderRadius:"24px 24px 0 0"}}>
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
              {l:"Entry Price",v:trade.entry||"—",c:"#6366f1"},
              {l:"Exit Price",v:trade.exitPrice||"—",c:isW?"#10b981":"#ef4444"},
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
            <div style={{background:"rgba(99,102,241,0.05)",border:"1px solid rgba(99,102,241,0.15)",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>🎯</span>
              <div><p style={{fontSize:9,color:"rgba(99,102,241,0.6)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>Setup</p><p style={{fontSize:14,fontWeight:700,color:"#a5b4fc"}}>{trade.setup}</p></div>
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
          {trade.chartUrl&&(
            <div style={{borderRadius:12,overflow:"hidden",border:"1px solid rgba(255,255,255,0.06)"}}>
              <p style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",padding:"10px 14px",background:"rgba(255,255,255,0.02)"}}>📸 Chart</p>
              <img src={trade.chartUrl} alt="chart" style={{width:"100%",display:"block"}}/>
            </div>
          )}

          <button onClick={onClose} className="btn-hover" style={{background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:12,padding:"12px",color:"#a5b4fc",fontSize:13,fontWeight:700,fontFamily:"inherit",width:"100%",marginTop:4}}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}

/* ── Profile Page ── */
function ProfilePage({client:c,onBack}){
  const [tab,setTab]=useState("overview");
  const [tradeSel,setTradeSel]=useState(null);
  const sorted=[...c.trades].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const scoreCol=c.score>=70?"#10b981":c.score>=45?"#f59e0b":"#ef4444";

  const kpis=[
    {icon:"🎯",label:"Win Rate",value:c.wr+"%",color:c.wr>=60?"#10b981":c.wr>=40?"#f59e0b":"#ef4444",delay:.05},
    {icon:"💰",label:"Total PnL",value:(c.total>=0?"+":"")+"$"+c.total?.toFixed(0),color:c.total>=0?"#10b981":"#ef4444",delay:.1},
    {icon:"⚖️",label:"Avg RR",value:c.avgRR+":1",color:"#f59e0b",delay:.15},
    {icon:"⚡",label:"Profit Factor",value:c.profitFactor,color:"#6366f1",delay:.2},
    {icon:"📊",label:"Total Trades",value:c.count,color:"#8b5cf6",delay:.25},
    {icon:"📈",label:"Avg PnL",value:"$"+c.avgPnl?.toFixed(1),color:c.avgPnl>=0?"#10b981":"#ef4444",delay:.3},
    {icon:"🔥",label:"Win Streak",value:c.winStreak,color:"#10b981",sub:"Best streak",delay:.35},
    {icon:"❄️",label:"Loss Streak",value:c.lossStreak,color:"#ef4444",sub:"Worst streak",delay:.4},
  ];

  return(
    <div style={{minHeight:"100vh",background:"#050810",color:"#fff",fontFamily:"'Outfit',sans-serif",direction:"rtl"}}>
      <style>{CSS}</style>

      {/* HERO HEADER */}
      <div style={{background:"linear-gradient(135deg,#0a0f1e 0%,#0d1530 40%,#0a0f1e 100%)",borderBottom:"1px solid rgba(99,102,241,0.1)",padding:"24px 28px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-60,left:-60,width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,0.08),transparent)"}}/>
        <div style={{position:"absolute",bottom:-40,right:-40,width:160,height:160,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,0.06),transparent)"}}/>

        <button className="btn-hover" onClick={onBack} style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:10,padding:"8px 16px",color:"#a5b4fc",fontSize:12,fontWeight:700,marginBottom:20,fontFamily:"inherit"}}>← رجوع</button>

        <div style={{display:"flex",alignItems:"center",gap:24,flexWrap:"wrap"}}>
          {/* avatar */}
          <div style={{position:"relative"}}>
            <div style={{width:72,height:72,borderRadius:20,background:`linear-gradient(135deg,${scoreCol}30,${scoreCol}10)`,border:`2px solid ${scoreCol}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:900,color:scoreCol,flexShrink:0}}>
              {(c.name||"?")[0].toUpperCase()}
            </div>
            <div style={{position:"absolute",bottom:-4,right:-4,width:20,height:20,borderRadius:"50%",background:scoreCol,border:"2px solid #050810",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8}}>✓</div>
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

      {/* TABS */}
      <div style={{display:"flex",gap:0,background:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"0 28px",overflowX:"auto"}}>
        {[["overview","📊 Overview"],["trades","📋 Trades ("+c.count+")"],["analysis","🔬 Analysis"],["psychology","🧠 Psychology"]].map(([id,lbl])=>(
          <button key={id} className="tab-item" onClick={()=>setTab(id)}
            style={{padding:"14px 20px",fontSize:13,fontWeight:600,color:tab===id?"#a5b4fc":"rgba(255,255,255,0.35)",borderBottom:tab===id?"2px solid #6366f1":"2px solid transparent",whiteSpace:"nowrap",fontFamily:"inherit"}}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{padding:"24px 28px 60px"}}>
        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
              {kpis.map(k=><KpiTile key={k.label} {...k}/>)}
            </div>

            {/* Best / Worst */}
            {(c.bestDay||c.worstDay)&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {c.bestDay&&<div style={{background:"linear-gradient(135deg,rgba(16,185,129,0.08),rgba(16,185,129,0.02))",border:"1px solid rgba(16,185,129,0.15)",borderRadius:18,padding:"20px 22px"}}>
                  <p style={{fontSize:10,color:"#10b981",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>🏆 Best Day</p>
                  <p style={{fontSize:30,fontWeight:900,color:"#10b981",fontFamily:"'JetBrains Mono',monospace"}}>+${c.bestDay.pnl?.toFixed(0)}</p>
                  <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:6}}>{c.bestDay.date}</p>
                </div>}
                {c.worstDay&&<div style={{background:"linear-gradient(135deg,rgba(239,68,68,0.08),rgba(239,68,68,0.02))",border:"1px solid rgba(239,68,68,0.15)",borderRadius:18,padding:"20px 22px"}}>
                  <p style={{fontSize:10,color:"#ef4444",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>📉 Worst Day</p>
                  <p style={{fontSize:30,fontWeight:900,color:"#ef4444",fontFamily:"'JetBrains Mono',monospace"}}>${c.worstDay.pnl?.toFixed(0)}</p>
                  <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:6}}>{c.worstDay.date}</p>
                </div>}
              </div>
            )}

            {/* Long vs Short */}
            <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"20px 22px"}}>
              <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>Direction Breakdown</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div style={{background:"rgba(16,185,129,0.06)",border:"1px solid rgba(16,185,129,0.15)",borderRadius:12,padding:"14px",textAlign:"center"}}>
                  <p style={{fontSize:28,fontWeight:900,color:"#10b981",fontFamily:"'JetBrains Mono',monospace"}}>{c.longCount}</p>
                  <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>LONG ▲</p>
                  <p style={{fontSize:11,color:"#10b98180",marginTop:2}}>{c.count?Math.round(c.longCount/c.count*100):0}%</p>
                </div>
                <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:12,padding:"14px",textAlign:"center"}}>
                  <p style={{fontSize:28,fontWeight:900,color:"#ef4444",fontFamily:"'JetBrains Mono',monospace"}}>{c.shortCount}</p>
                  <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>SHORT ▼</p>
                  <p style={{fontSize:11,color:"#ef444480",marginTop:2}}>{c.count?Math.round(c.shortCount/c.count*100):0}%</p>
                </div>
              </div>
            </div>

            {/* Sessions */}
            {Object.keys(c.sessions||{}).length>0&&(
              <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>🕐 Sessions</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:8}}>
                  {Object.entries(c.sessions).sort((a,b)=>b[1]-a[1]).map(([s,n])=>(
                    <div key={s} style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.15)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                      <p style={{fontSize:18,fontWeight:900,color:"#a5b4fc",fontFamily:"'JetBrains Mono',monospace"}}>{n}</p>
                      <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:".06em",marginTop:3}}>{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TRADES ── */}
        {tab==="trades"&&(
          <div>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginBottom:14,letterSpacing:".04em"}}>كل الصفقات • اضغط لرؤية التفاصيل</p>

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
                      <p style={{fontSize:15,fontWeight:800,color:"#fff",fontFamily:"'JetBrains Mono',monospace"}}>{t.symbol}</p>
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
        {tab==="analysis"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
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
              <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(99,102,241,0.1)",borderRadius:18,padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(99,102,241,0.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>🎯 Top Setups</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {c.topSetups.map(([s,n],idx)=>{
                    const pct=Math.round(n/c.count*100);
                    const cols=["#6366f1","#8b5cf6","#a855f7","#c084fc","#d8b4fe"];
                    const col=cols[idx]||"#6366f1";
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
        )}

        {/* ── PSYCHOLOGY ── */}
        {tab==="psychology"&&(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Streak analysis */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{background:"linear-gradient(135deg,rgba(16,185,129,0.08),rgba(16,185,129,0.02))",border:"1px solid rgba(16,185,129,0.15)",borderRadius:18,padding:"22px"}}>
                <p style={{fontSize:10,color:"#10b98170",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>🔥 Best Win Streak</p>
                <p style={{fontSize:42,fontWeight:900,color:"#10b981",fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{c.winStreak}</p>
                <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:6}}>consecutive wins</p>
              </div>
              <div style={{background:"linear-gradient(135deg,rgba(239,68,68,0.08),rgba(239,68,68,0.02))",border:"1px solid rgba(239,68,68,0.15)",borderRadius:18,padding:"22px"}}>
                <p style={{fontSize:10,color:"#ef444470",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>❄️ Worst Loss Streak</p>
                <p style={{fontSize:42,fontWeight:900,color:"#ef4444",fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{c.lossStreak}</p>
                <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:6}}>consecutive losses</p>
              </div>
            </div>

            {/* Mistake frequency */}
            {c.topMistakes?.length>0&&(
              <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>🧠 Behavioral Patterns</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {c.topMistakes.map(([m,n])=>{
                    const totalMist=c.topMistakes.reduce((s,[,v])=>s+v,0);
                    const pct=Math.round(n/totalMist*100);
                    return(
                      <div key={m}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:13,color:"rgba(255,255,255,0.7)",fontWeight:500}}>{m}</span>
                          <span style={{fontSize:12,color:"#f87171",fontWeight:700}}>{pct}%</span>
                        </div>
                        <div style={{height:4,background:"rgba(255,255,255,0.05)",borderRadius:2}}>
                          <div style={{height:4,width:pct+"%",background:"linear-gradient(90deg,#ef4444,#f87171)",borderRadius:2}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Motivations */}
            {c.motivations?.length>0&&(
              <div style={{background:"linear-gradient(135deg,rgba(99,102,241,0.06),rgba(99,102,241,0.02))",border:"1px solid rgba(99,102,241,0.12)",borderRadius:18,padding:"20px 22px"}}>
                <p style={{fontSize:10,color:"rgba(99,102,241,0.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}}>💬 Motivations</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {c.motivations.slice(0,5).map((m,i)=>(
                    <div key={i} style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.1)",borderRadius:10,padding:"12px 14px"}}>
                      <p style={{fontSize:13,color:"#c7d2fe",fontStyle:"italic",lineHeight:1.6}}>"{typeof m==="string"?m:m.text||m.q||JSON.stringify(m)}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {tradeSel&&<TradeModal trade={tradeSel} onClose={()=>setTradeSel(null)}/>}
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
    <div style={{minHeight:"100vh",background:"#050810",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,fontFamily:"'Outfit',sans-serif"}}>
      <style>{CSS}</style>
      <div style={{fontSize:60}}>🚫</div>
      <p style={{color:"#ef4444",fontSize:18,fontWeight:800}}>غير مصرح لك</p>
      <button className="btn-hover" onClick={onBack} style={{background:"rgba(99,102,241,0.15)",color:"#a5b4fc",border:"1px solid rgba(99,102,241,0.3)",borderRadius:12,padding:"10px 24px",cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>رجوع</button>
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
    <div style={{minHeight:"100vh",background:"#050810",color:"#fff",fontFamily:"'Outfit',sans-serif",direction:"rtl"}}>
      <style>{CSS}</style>

      {/* ── SIDEBAR-STYLE HEADER ── */}
      <div style={{background:"linear-gradient(180deg,#0a0f1e 0%,#080d1a 100%)",borderBottom:"1px solid rgba(99,102,241,0.08)"}}>
        {/* top bar */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 28px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 0 20px rgba(99,102,241,0.4)"}}>🛡️</div>
            <div>
              <h1 style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:"-.02em",lineHeight:1}}>OHM Admin</h1>
              <p style={{fontSize:10,color:"rgba(99,102,241,0.6)",fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",marginTop:2}}>Control Center</p>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 8px #10b981",animation:"pulse2 2s infinite"}}/>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginLeft:4,fontWeight:500}}>{clients.length} clients online</span>
            <button className="btn-hover" onClick={onBack} style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:10,padding:"7px 16px",color:"#a5b4fc",fontSize:12,fontWeight:700,fontFamily:"inherit",marginRight:4}}>← App</button>
            <button className="btn-hover" onClick={()=>logoutUser()} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"7px 16px",color:"#f87171",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>Logout</button>
          </div>
        </div>

        {/* KPI row */}
        {!loading&&clients.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:0,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            {[
              {l:"Total Clients",v:clients.length,i:"👥",c:"#6366f1"},
              {l:"Elite Traders",v:eliteCount,i:"🏆",c:"#f59e0b"},
              {l:"Avg Score",v:avgScore,i:"⚡",c:"#8b5cf6"},
              {l:"Avg Win Rate",v:avgWR+"%",i:"🎯",c:"#06b6d4"},
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
              style={{background:sort===k?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.03)",color:sort===k?"#a5b4fc":"rgba(255,255,255,0.4)",border:`1px solid ${sort===k?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.06)"}`,borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:600,fontFamily:"inherit",whiteSpace:"nowrap"}}>
              {l}
            </button>
          ))}
        </div>

        <div style={{display:"flex",gap:4}}>
          {[["grid","⊞"],["list","☰"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{background:view===v?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.03)",color:view===v?"#a5b4fc":"rgba(255,255,255,0.35)",border:`1px solid ${view===v?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.06)"}`,borderRadius:8,padding:"8px 12px",fontSize:14,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
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
            <div style={{width:44,height:44,borderRadius:"50%",border:"3px solid rgba(99,102,241,0.1)",borderTopColor:"#6366f1",animation:"spin .8s linear infinite",margin:"0 auto 16px"}}/>
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
                      {l:"Trades",v:c.count,c:"#8b5cf6"},
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
                  <p style={{fontSize:15,fontWeight:800,color:"#8b5cf6",textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>{c.count}</p>
                  <p style={{fontSize:14,fontWeight:800,color:c.total>=0?"#10b981":"#ef4444",textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>{c.total>=0?"+":""}${c.total?.toFixed(0)}</p>
                  <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8}}>
                    <Sparkline trades={c.trades} w={60} h={22}/>
                    <span style={{color:"rgba(99,102,241,0.5)",fontSize:16}}>›</span>
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
