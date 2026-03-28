import { useState, useEffect } from "react";
import { db, logoutUser } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

const ADMIN_EMAILS = ["ohm.1.1jouranltrading@gmail.com"];
const isAdmin = (user) => user && ADMIN_EMAILS.includes(user.email);

function calcStats(trades=[]) {
  if(!trades.length) return {score:0,wr:0,total:0,count:0,avgRR:"0.0",bestDay:null,worstDay:null,topMistakes:[],topSetups:[]};
  const wins=trades.filter(t=>t.pnl>0);
  const wr=Math.round((wins.length/trades.length)*100);
  const total=trades.reduce((s,t)=>s+(t.pnl||0),0);
  const rrs=trades.filter(t=>t.rr>0);
  const avgRR=rrs.length?(rrs.reduce((s,t)=>s+t.rr,0)/rrs.length).toFixed(1):"0.0";
  const byDay={};
  trades.forEach(t=>{byDay[t.date]=(byDay[t.date]||0)+(t.pnl||0);});
  const days=Object.entries(byDay).sort((a,b)=>b[1]-a[1]);
  const bestDay=days[0]?{date:days[0][0],pnl:days[0][1]}:null;
  const worstDay=days[days.length-1]?.pnl<0?{date:days[days.length-1][0],pnl:days[days.length-1][1]}:null;
  const gl=Math.abs(trades.filter(t=>t.pnl<0).reduce((s,t)=>s+t.pnl,0))||1;
  const gp=wins.reduce((s,t)=>s+t.pnl,0);
  const mist=trades.reduce((s,t)=>s+(t.mistakes?.length||0),0);
  const score=Math.round((wins.length/trades.length)*30+(Math.min(gp/gl,3)/3)*30+Math.min(Number(avgRR)/1.5,1)*20+Math.max(0,20-mist*5));
  const mistakes={};
  trades.forEach(t=>t.mistakes?.forEach(m=>{mistakes[m]=(mistakes[m]||0)+1;}));
  const topMistakes=Object.entries(mistakes).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const bySetup={};
  trades.forEach(t=>{if(t.setup)bySetup[t.setup]=(bySetup[t.setup]||0)+1;});
  const topSetups=Object.entries(bySetup).sort((a,b)=>b[1]-a[1]).slice(0,3);
  return {score,wr,total,count:trades.length,avgRR,bestDay,worstDay,topMistakes,topSetups};
}

const B={bg:"#f0f6ff",card:"#ffffff",primary:"#1d4ed8",primary2:"#3b82f6",accent:"#0ea5e9",text:"#0f172a",text2:"#334155",text3:"#64748b",border:"#dbeafe",border2:"#bfdbfe",success:"#059669",warning:"#d97706",danger:"#dc2626",header:"linear-gradient(135deg,#1e3a8a,#1d4ed8,#2563eb)"};

function ScoreBadge({score}){
  const col=score>=70?B.success:score>=45?B.warning:B.danger;
  const lbl=score>=70?"Elite 🏆":score>=45?"Good 📈":"Needs Work 📉";
  return <span style={{background:col+"18",color:col,border:`1.5px solid ${col}40`,borderRadius:20,padding:"3px 12px",fontSize:11,fontWeight:800,whiteSpace:"nowrap"}}>{score} · {lbl}</span>;
}

export default function AdminPage({user,onBack}){
  const [clients,setClients]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState("score");
  const [selected,setSelected]=useState(null);
  const [error,setError]=useState("");

  if(!isAdmin(user)){return(<div style={{minHeight:"100vh",background:B.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,fontFamily:"sans-serif"}}><div style={{fontSize:56}}>🚫</div><p style={{color:B.danger,fontSize:18,fontWeight:800}}>غير مصرح لك</p><button onClick={onBack} style={{background:B.primary,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",cursor:"pointer",fontWeight:700}}>رجوع</button></div>);}

  useEffect(()=>{loadClients();},[]);

  async function loadClients(){
    setLoading(true);
    try{
      const snap=await getDocs(collection(db,"users"));
      const list=[];
      snap.forEach(doc=>{const d=doc.data();const stats=calcStats(d.trades||[]);list.push({uid:doc.id,name:d.name||"بدون اسم",email:d.email||"",createdAt:d.createdAt?.toDate?.()||null,trades:d.trades||[],...stats});});
      setClients(list);
    }catch(e){setError("خطأ: "+e.message);}
    setLoading(false);
  }

  const filtered=clients.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.email.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==="score"?b.score-a.score:sort==="wr"?b.wr-a.wr:sort==="trades"?b.count-a.count:a.name.localeCompare(b.name));

  if(selected){
    const c=selected;
    const recent=[...c.trades].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,10);
    return(
      <div style={{minHeight:"100vh",background:B.bg,fontFamily:"sans-serif",color:B.text}}>
        <div style={{background:B.header,padding:"20px 16px 24px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-30,right:-30,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.06)"}}/>
          <button onClick={()=>setSelected(null)} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:10,padding:"7px 14px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,marginBottom:14}}>← رجوع</button>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:52,height:52,borderRadius:16,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#fff",border:"2px solid rgba(255,255,255,0.3)",flexShrink:0}}>{(c.name||"?")[0].toUpperCase()}</div>
            <div><p style={{fontSize:20,fontWeight:900,color:"#fff",lineHeight:1}}>{c.name}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.7)",marginTop:4}}>{c.email}</p>{c.createdAt&&<p style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>انضم {c.createdAt.toLocaleDateString("ar")}</p>}</div>
          </div>
          <div style={{marginTop:12}}><ScoreBadge score={c.score}/></div>
        </div>
        <div style={{padding:"16px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[{l:"Win Rate",v:c.wr+"%",col:c.wr>=60?B.success:c.wr>=40?B.warning:B.danger,i:"🎯"},{l:"Ohm Score",v:c.score,col:c.score>=70?B.success:c.score>=45?B.warning:B.danger,i:"⚡"},{l:"الصفقات",v:c.count,col:B.primary,i:"📊"},{l:"Avg RR",v:c.avgRR+":1",col:B.accent,i:"⚖️"}].map(({l,v,col,i})=>(
              <div key={l} style={{background:col+"0f",borderRadius:14,padding:"12px 16px",border:`1px solid ${col}30`}}>
                <p style={{fontSize:9,color:B.text3,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>{i} {l}</p>
                <p style={{fontSize:24,fontWeight:900,color:col,lineHeight:1}}>{v}</p>
              </div>
            ))}
          </div>
          {(c.bestDay||c.worstDay)&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {c.bestDay&&<div style={{background:"#f0fdf4",borderRadius:14,padding:"12px 14px",border:"1.5px solid #bbf7d0"}}><p style={{fontSize:10,color:B.success,fontWeight:800,marginBottom:6}}>🏆 أفضل يوم</p><p style={{fontSize:16,fontWeight:900,color:B.success}}>+${c.bestDay.pnl}</p><p style={{fontSize:10,color:B.text3,marginTop:2}}>{c.bestDay.date}</p></div>}
            {c.worstDay&&<div style={{background:"#fff1f2",borderRadius:14,padding:"12px 14px",border:"1.5px solid #fecdd3"}}><p style={{fontSize:10,color:B.danger,fontWeight:800,marginBottom:6}}>📉 أسوأ يوم</p><p style={{fontSize:16,fontWeight:900,color:B.danger}}>${c.worstDay.pnl}</p><p style={{fontSize:10,color:B.text3,marginTop:2}}>{c.worstDay.date}</p></div>}
          </div>)}
          {c.topSetups?.length>0&&(<div style={{background:B.card,borderRadius:16,padding:"14px 16px",border:`1px solid ${B.border}`,marginBottom:12,boxShadow:"0 2px 12px rgba(29,78,216,0.06)"}}><p style={{fontSize:12,fontWeight:800,color:B.text2,marginBottom:10}}>🎯 أبرز الإعدادات</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{c.topSetups.map(([s,n])=><span key={s} style={{background:"#eff6ff",color:B.primary,border:`1px solid ${B.border2}`,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700}}>{s} ({n}×)</span>)}</div></div>)}
          {c.topMistakes?.length>0&&(<div style={{background:B.card,borderRadius:16,padding:"14px 16px",border:`1px solid ${B.border}`,marginBottom:12,boxShadow:"0 2px 12px rgba(29,78,216,0.06)"}}><p style={{fontSize:12,fontWeight:800,color:B.text2,marginBottom:10}}>⚠️ أبرز الأخطاء</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{c.topMistakes.map(([m,n])=><span key={m} style={{background:"#fff1f2",color:B.danger,border:"1px solid #fecdd3",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700}}>{m} ({n}×)</span>)}</div></div>)}
          <div style={{background:B.card,borderRadius:16,padding:"14px 16px",border:`1px solid ${B.border}`,boxShadow:"0 2px 12px rgba(29,78,216,0.06)"}}><p style={{fontSize:12,fontWeight:800,color:B.text2,marginBottom:12}}>📋 آخر الصفقات</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {recent.length===0&&<p style={{color:B.text3,fontSize:13}}>لا توجد صفقات</p>}
              {recent.map((t,i)=>{const isW=t.pnl>=0;return(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:12,background:isW?"#f0fdf4":"#fff1f2",border:`1px solid ${isW?"#bbf7d0":"#fecdd3"}`}}><div><p style={{fontSize:14,fontWeight:800,color:B.text}}>{t.symbol}</p><p style={{fontSize:10,color:B.text3,marginTop:2}}>{t.date} · {t.direction==="L"?"LONG":"SHORT"}{t.grade?" · "+t.grade:""}</p></div><div style={{textAlign:"right"}}><p style={{fontSize:15,fontWeight:900,color:isW?B.success:B.danger}}>{isW?"+":""}${t.pnl}</p><p style={{fontSize:10,color:B.text3}}>RR {t.rr||0}:1</p></div></div>);})}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return(
    <div style={{minHeight:"100vh",background:B.bg,fontFamily:"sans-serif",color:B.text}}>
      <div style={{background:B.header,padding:"20px 16px 28px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,0.06)"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,position:"relative"}}>
          <div><p style={{fontSize:22,fontWeight:900,color:"#fff",lineHeight:1}}>🛡️ Admin Panel</p><p style={{fontSize:12,color:"rgba(255,255,255,0.65)",marginTop:5}}>OHM Trading Journal</p></div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onBack} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.25)",borderRadius:10,padding:"8px 14px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>← تطبيق</button>
            <button onClick={()=>logoutUser()} style={{background:"rgba(220,38,38,0.3)",border:"1px solid rgba(220,38,38,0.5)",borderRadius:10,padding:"8px 14px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>خروج</button>
          </div>
        </div>
        {!loading&&clients.length>0&&(<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,position:"relative"}}>
          {[{l:"العملاء",v:clients.length,i:"👥"},{l:"متوسط Score",v:Math.round(clients.reduce((s,c)=>s+c.score,0)/clients.length),i:"⚡"},{l:"متوسط WR",v:Math.round(clients.reduce((s,c)=>s+c.wr,0)/clients.length)+"%",i:"🎯"}].map(({l,v,i})=>(<div key={l} style={{background:"rgba(255,255,255,0.12)",borderRadius:14,padding:"12px 10px",border:"1px solid rgba(255,255,255,0.2)",textAlign:"center"}}><p style={{fontSize:18,marginBottom:2}}>{i}</p><p style={{fontSize:20,fontWeight:900,color:"#fff",lineHeight:1}}>{v}</p><p style={{fontSize:9,color:"rgba(255,255,255,0.6)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginTop:3}}>{l}</p></div>))}
        </div>)}
      </div>
      <div style={{padding:"14px 16px 0"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 ابحث باسم أو إيميل..." style={{width:"100%",background:B.card,border:`1.5px solid ${B.border2}`,borderRadius:12,padding:"11px 14px",color:B.text,fontSize:13,fontFamily:"sans-serif",outline:"none",boxSizing:"border-box",boxShadow:"0 2px 8px rgba(29,78,216,0.08)"}}/>
        <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
          {[["score","⚡ Score"],["wr","🎯 Win Rate"],["trades","📊 الصفقات"],["name","🔤 الاسم"]].map(([k,l])=>(<button key={k} onClick={()=>setSort(k)} style={{background:sort===k?B.primary:B.card,color:sort===k?"#fff":B.text2,border:`1.5px solid ${sort===k?B.primary:B.border2}`,borderRadius:20,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"sans-serif",boxShadow:sort===k?"0 4px 12px rgba(29,78,216,0.3)":"none"}}>{l}</button>))}
          <button onClick={loadClients} style={{background:B.card,color:B.text3,border:`1.5px solid ${B.border2}`,borderRadius:20,padding:"6px 14px",cursor:"pointer",fontSize:12,fontFamily:"sans-serif",marginLeft:"auto"}}>🔄</button>
        </div>
      </div>
      <div style={{padding:"14px 16px 40px"}}>
        {loading&&(<div style={{textAlign:"center",padding:50}}><div style={{width:40,height:40,borderRadius:"50%",border:`3px solid ${B.border}`,borderTopColor:B.primary,animation:"spin .7s linear infinite",margin:"0 auto 14px"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><p style={{color:B.text3,fontSize:13}}>جاري التحميل...</p></div>)}
        {error&&<div style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:12,padding:"12px 16px",color:B.danger,fontSize:13}}>{error}</div>}
        {!loading&&filtered.length===0&&<p style={{color:B.text3,textAlign:"center",padding:30}}>لا توجد نتائج</p>}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filtered.map(c=>(<div key={c.uid} onClick={()=>setSelected(c)} style={{background:B.card,borderRadius:18,padding:"16px",border:`1.5px solid ${B.border}`,cursor:"pointer",boxShadow:"0 2px 16px rgba(29,78,216,0.07)",transition:"all .2s",position:"relative",overflow:"hidden"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=B.primary2;e.currentTarget.style.boxShadow="0 8px 28px rgba(29,78,216,0.15)";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=B.border;e.currentTarget.style.boxShadow="0 2px 16px rgba(29,78,216,0.07)";e.currentTarget.style.transform="";}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${B.primary},${B.accent})`,borderRadius:"18px 18px 0 0"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:44,height:44,borderRadius:14,background:`linear-gradient(135deg,${B.primary},${B.accent})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#fff",flexShrink:0}}>{(c.name||"?")[0].toUpperCase()}</div>
                <div><p style={{fontSize:15,fontWeight:800,color:B.text,lineHeight:1}}>{c.name}</p><p style={{fontSize:11,color:B.text3,marginTop:3}}>{c.email}</p></div>
              </div>
              <ScoreBadge score={c.score}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              {[{l:"WR",v:c.wr+"%",col:c.wr>=60?B.success:c.wr>=40?B.warning:B.danger},{l:"صفقة",v:c.count,col:B.primary},{l:"RR",v:c.avgRR+":1",col:B.accent}].map(({l,v,col})=>(<div key={l} style={{background:col+"12",borderRadius:10,padding:"6px 10px",border:`1px solid ${col}30`,flex:1,textAlign:"center"}}><p style={{fontSize:8,color:col+"99",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>{l}</p><p style={{fontSize:14,fontWeight:900,color:col}}>{v}</p></div>))}
            </div>
            {c.createdAt&&<p style={{fontSize:10,color:B.text3,marginTop:10,textAlign:"right"}}>📅 انضم {c.createdAt.toLocaleDateString("ar")}</p>}
          </div>))}
        </div>
      </div>
    </div>
  );
}
