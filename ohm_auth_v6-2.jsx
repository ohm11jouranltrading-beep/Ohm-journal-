import { useState, useEffect, useRef } from "react";
import {
  registerUser,
  loginUser,
  loginWithGoogle,
  onAuthChange,
} from "./firebase-1";


const LOGO = "data:image/jpeg;base64,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";

/* ═══════════════════════════════════════════════════════
   OHM TRADING JOURNAL — Auth System v5
   ─────────────────────────────────────────────────────
   FIX: All components defined OUTSIDE OhmAuth to prevent
   remount on every keystroke (was causing icon flicker
   and white screen due to file size + bad nesting)
   ═══════════════════════════════════════════════════════ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Space+Grotesk:wght@500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{height:100%;-webkit-text-size-adjust:100%}
body{
  height:100%;
  font-family:'DM Sans',sans-serif;
  -webkit-font-smoothing:antialiased;
  background:#050d08;
  color:#e8f5e9;
  overflow:hidden;
}

/* Keyframes */
@keyframes orb1{0%,100%{transform:translate(0,0)}33%{transform:translate(18px,-12px)}66%{transform:translate(-12px,8px)}}
@keyframes orb2{0%,100%{transform:translate(0,0)}40%{transform:translate(-20px,14px)}70%{transform:translate(14px,-8px)}}
@keyframes scan{0%{top:-10%;opacity:0}8%,92%{opacity:.4}100%{top:110%;opacity:0}}
@keyframes cardIn{from{opacity:0;transform:translateY(20px) scale(.975)}to{opacity:1;transform:none}}
@keyframes itemIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes glow{0%,100%{box-shadow:0 0 0 3px rgba(34,197,94,.08),0 0 24px rgba(34,197,94,.18)}50%{box-shadow:0 0 0 3px rgba(34,197,94,.14),0 0 40px rgba(34,197,94,.32)}}
@keyframes ringDraw{from{stroke-dashoffset:207}to{stroke-dashoffset:0}}
@keyframes checkDraw{from{stroke-dashoffset:60}to{stroke-dashoffset:0}}
@keyframes otpPop{0%,100%{transform:scale(1)}45%{transform:scale(1.14)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes modalIn{from{opacity:0;transform:scale(.93) translateY(8px)}to{opacity:1;transform:none}}

.card-in{animation:cardIn .48s cubic-bezier(.2,.88,.3,1) both}
.item{animation:itemIn .42s cubic-bezier(.2,.88,.3,1) both}
.d0{animation-delay:.04s}.d1{animation-delay:.09s}.d2{animation-delay:.14s}
.d3{animation-delay:.19s}.d4{animation-delay:.24s}.d5{animation-delay:.29s}
.d6{animation-delay:.34s}.d7{animation-delay:.40s}
.spin{animation:spin .65s linear infinite}
`;

/* ─── GLASS CARD ─── */
function GlassCard({ children, animKey }) {
  return (
    <div className="card-in" key={animKey} style={{
      position:'relative', width:'100%',
      background:'linear-gradient(155deg,rgba(255,255,255,.085) 0%,rgba(255,255,255,.032) 45%,rgba(255,255,255,.065) 100%)',
      backdropFilter:'blur(44px) saturate(180%)',
      WebkitBackdropFilter:'blur(44px) saturate(180%)',
      border:'1px solid rgba(255,255,255,.14)',
      borderRadius:24,
      padding:'28px 26px 24px',
      boxShadow:`
        0 0 0 1px rgba(255,255,255,.06) inset,
        0 2px 0 rgba(255,255,255,.16) inset,
        0 -1px 0 rgba(0,0,0,.18) inset,
        0 32px 64px rgba(0,0,0,.7),
        0 10px 32px rgba(0,0,0,.45),
        0 0 60px rgba(34,197,94,.04)
      `,
      overflow:'hidden',
    }}>
      {/* Top shimmer */}
      <div style={{position:'absolute',top:0,left:26,right:26,height:1,
        background:'linear-gradient(90deg,transparent,rgba(255,255,255,.5),rgba(34,197,94,.3),rgba(255,255,255,.5),transparent)'}}/>
      {/* Spotlight */}
      <div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',
        width:220,height:80,background:'radial-gradient(ellipse,rgba(34,197,94,.06),transparent)',
        pointerEvents:'none'}}/>
      {children}
    </div>
  );
}

/* ─── STABLE INPUT ─── */
/* KEY FIX: Icon is a static div sibling to input, NOT inside it */
function GlassInput({ label, type='text', value, onChange, error, iconPath, eyeToggle, autoComplete }) {
  const [foc, setFoc] = useState(false);
  const up = foc || (value?.length > 0);

  return (
    <div style={{marginBottom:13}}>
      <div style={{
        position:'relative',
        background: foc ? 'rgba(255,255,255,.065)' : 'rgba(255,255,255,.038)',
        border:`1.5px solid ${error?'rgba(239,68,68,.52)':foc?'rgba(34,197,94,.52)':'rgba(255,255,255,.1)'}`,
        borderRadius:13, backdropFilter:'blur(20px)',
        transition:'border-color .2s,background .2s,box-shadow .2s',
        boxShadow: foc ? '0 0 0 3px rgba(34,197,94,.09),inset 0 1px 0 rgba(255,255,255,.08)' : 'inset 0 1px 0 rgba(255,255,255,.05)',
      }}>
        {/* Focus edge shimmer - CSS only, no remount */}
        <div style={{
          position:'absolute',top:0,left:14,right:14,height:1,
          background:'linear-gradient(90deg,transparent,rgba(34,197,94,.55),transparent)',
          opacity:foc?1:0,transition:'opacity .2s',pointerEvents:'none',
        }}/>
        {/* STABLE ICON - pure div, zero remount risk */}
        <div style={{
          position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',
          color:foc?'#4ade80':'rgba(255,255,255,.24)',
          transition:'color .2s',display:'flex',alignItems:'center',
          pointerEvents:'none',flexShrink:0,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d={iconPath}/>
          </svg>
        </div>
        {/* Floating label */}
        <label style={{
          position:'absolute',left:41,zIndex:2,pointerEvents:'none',
          top:up?7:'50%', transform:up?'none':'translateY(-50%)',
          fontSize:up?10:13.5, fontWeight:up?600:400,
          color:error?'#f87171':foc?'#4ade80':up?'rgba(74,222,128,.62)':'rgba(255,255,255,.3)',
          letterSpacing:up?'.1em':'.01em', textTransform:up?'uppercase':'none',
          transition:'top .17s,font-size .17s,color .17s,letter-spacing .17s',
          fontFamily:"'Space Grotesk',sans-serif", userSelect:'none',
        }}>{label}</label>
        <input type={type} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFoc(true)}
          onBlur={() => setFoc(false)}
          autoComplete={autoComplete}
          style={{
            width:'100%',background:'transparent',border:'none',outline:'none',
            color:'#f0fff4',fontSize:14,fontFamily:"'DM Sans',sans-serif",fontWeight:500,
            padding: up?'22px 42px 8px 41px':'14px 42px 14px 41px',
            paddingRight: eyeToggle ? 42 : 14,
          }}
        />
        {/* Eye toggle */}
        {eyeToggle && (
          <button type="button" onClick={eyeToggle.toggle}
            style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
              background:'none',border:'none',cursor:'pointer',padding:4,
              color:'rgba(255,255,255,.26)',transition:'color .2s',display:'flex'}}
            onMouseEnter={e=>e.currentTarget.style.color='#4ade80'}
            onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.26)'}>
            {eyeToggle.show
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.749 10.749 0 0 1 4.46-5.165"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        )}
      </div>
      {error && (
        <p style={{fontSize:11,color:'#f87171',marginTop:5,marginLeft:2,
          display:'flex',alignItems:'center',gap:4,animation:'itemIn .2s ease'}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="currentColor"/>
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

/* Icon paths */
const P = {
  mail:'M2 7c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z M2 7l10 7 10-7',
  lock:'M7 11V7a5 5 0 0 1 10 0v4 M3 11h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V11z',
  user:'M20 21a8 8 0 1 0-16 0 M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  phone:'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.5 2 2 0 0 1 3.6 1.32h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9A16 16 0 0 0 15 16.09l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
};

/* ─── PRIMARY BUTTON ─── */
function PrimaryBtn({ children, onClick, loading, disabled }) {
  const [hov, setHov] = useState(false);
  const [dn, setDn] = useState(false);
  return (
    <button onClick={onClick} disabled={loading||disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>{setHov(false);setDn(false);}}
      onMouseDown={()=>setDn(true)} onMouseUp={()=>setDn(false)}
      style={{
        width:'100%',padding:'13px 24px',
        background: loading||disabled?'rgba(34,197,94,.12)'
          :hov?'linear-gradient(135deg,#22c55e,#15803d)'
          :'linear-gradient(135deg,#16a34a,#22c55e)',
        border:`1.5px solid ${loading||disabled?'rgba(34,197,94,.18)':hov?'rgba(34,197,94,.85)':'rgba(34,197,94,.42)'}`,
        borderRadius:13,color:loading||disabled?'rgba(255,255,255,.3)':'#fff',
        fontSize:13,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif",
        letterSpacing:'.07em',textTransform:'uppercase',
        cursor:loading||disabled?'not-allowed':'pointer',
        display:'flex',alignItems:'center',justifyContent:'center',gap:8,
        transform:dn&&!loading?'scale(.99) translateY(1px)':hov&&!loading?'translateY(-1px)':'none',
        transition:'all .18s cubic-bezier(.4,0,.2,1)',
        boxShadow:!loading&&!disabled&&hov?'0 10px 28px rgba(34,197,94,.38),inset 0 1px 0 rgba(255,255,255,.22)':!loading&&!disabled?'0 4px 16px rgba(34,197,94,.18),inset 0 1px 0 rgba(255,255,255,.14)':'none',
      }}>
      {loading
        ? <span className="spin" style={{display:'inline-block',width:14,height:14,border:'2px solid rgba(255,255,255,.2)',borderTopColor:'#fff',borderRadius:'50%'}}/>
        : children}
    </button>
  );
}

/* ─── SOCIAL BUTTON ─── */
function SocialBtn({ icon, label, onPress }) {
  const [hov,setHov]=useState(false), [busy,setBusy]=useState(false);
  const go = async () => { setBusy(true); try{ await onPress(); }finally{ setBusy(false); } };
  return (
    <button onClick={go} disabled={busy}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'11px 8px',
        background:hov?'rgba(255,255,255,.09)':'rgba(255,255,255,.05)',
        border:`1px solid ${hov?'rgba(255,255,255,.18)':'rgba(255,255,255,.09)'}`,
        borderRadius:11,cursor:busy?'wait':'pointer',
        color:'rgba(255,255,255,.62)',fontSize:13,fontWeight:600,
        fontFamily:"'DM Sans',sans-serif",transition:'all .2s',
        backdropFilter:'blur(10px)',
      }}>
      {busy?<span className="spin" style={{display:'inline-block',width:13,height:13,border:'2px solid rgba(255,255,255,.18)',borderTopColor:'rgba(255,255,255,.7)',borderRadius:'50%'}}/>:icon}
      {!busy&&label}
    </button>
  );
}

/* ─── SOCIAL MODAL ─── */
function SocialModal({ provider, onClose }) {
  return (
    <div onClick={onClose} style={{
      position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.72)',
      backdropFilter:'blur(10px)',display:'flex',alignItems:'center',
      justifyContent:'center',padding:20,animation:'fadeIn .2s ease',
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        maxWidth:320,width:'100%',
        background:'linear-gradient(160deg,rgba(15,25,15,.95),rgba(8,15,8,.98))',
        border:'1px solid rgba(34,197,94,.18)',borderRadius:20,padding:'28px 24px',
        backdropFilter:'blur(40px)',
        boxShadow:'0 30px 60px rgba(0,0,0,.7),0 0 0 1px rgba(34,197,94,.06) inset,0 1px 0 rgba(34,197,94,.14) inset',
        animation:'modalIn .3s cubic-bezier(.2,.88,.3,1)',textAlign:'center',
      }}>
        <div style={{fontSize:32,marginBottom:14}}>{provider==='Google'?'🔍':'🍎'}</div>
        <h3 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,color:'#f0fff4',marginBottom:8}}>
          {provider} Sign-In
        </h3>
        <p style={{fontSize:13,color:'rgba(255,255,255,.4)',lineHeight:1.7,marginBottom:20}}>
          سيتم ربط هذه الميزة قريباً بـ Firebase OAuth. استخدم البريد الإلكتروني وكلمة المرور حالياً.
        </p>
        <button onClick={onClose} style={{
          width:'100%',padding:'11px',borderRadius:11,cursor:'pointer',
          background:'rgba(34,197,94,.12)',border:'1px solid rgba(34,197,94,.28)',
          color:'#4ade80',fontSize:13,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif",
          transition:'all .18s',
        }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(34,197,94,.22)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(34,197,94,.12)'}>
          فهمت، شكراً
        </button>
      </div>
    </div>
  );
}

/* ─── OTP INPUT ─── */
function OTPInput({ value, onChange, error }) {
  const refs = useRef([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0,6);
  const handle = (e, i) => {
    const v = e.target.value.replace(/\D/g,'').slice(-1);
    const next=[...digits]; next[i]=v;
    onChange(next.join('').slice(0,6));
    if(v && i<5) setTimeout(()=>refs.current[i+1]?.focus(),35);
    if(v){ const el=refs.current[i]; if(el){el.style.animation='none';void el.offsetWidth;el.style.animation='otpPop .22s ease';}}
  };
  const handleKey=(e,i)=>{if(e.key==='Backspace'&&!digits[i]&&i>0)refs.current[i-1]?.focus();};
  const handlePaste=e=>{e.preventDefault();const p=e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);onChange(p);setTimeout(()=>refs.current[Math.min(p.length,5)]?.focus(),40);};
  return (
    <div>
      <div style={{display:'flex',gap:7,justifyContent:'center',direction:'ltr'}}>
        {digits.map((d,i)=>(
          <input key={i} ref={el=>refs.current[i]=el}
            type="text" inputMode="numeric" maxLength={1} value={d}
            onChange={e=>handle(e,i)} onKeyDown={e=>handleKey(e,i)} onPaste={handlePaste}
            style={{
              width:44,height:52,
              background:d?'rgba(34,197,94,.1)':'rgba(255,255,255,.04)',
              border:`1.5px solid ${error?'rgba(239,68,68,.52)':d?'rgba(34,197,94,.58)':'rgba(255,255,255,.11)'}`,
              borderRadius:11,color:d?'#4ade80':'rgba(255,255,255,.65)',
              fontSize:21,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif",
              textAlign:'center',outline:'none',caretColor:'transparent',
              boxShadow:d?'0 0 14px rgba(34,197,94,.16),inset 0 1px 0 rgba(255,255,255,.07)':'inset 0 1px 0 rgba(255,255,255,.04)',
              transition:'border-color .15s,background .15s',
            }}/>
        ))}
      </div>
      {error&&<p style={{fontSize:11,color:'#f87171',textAlign:'center',marginTop:9,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="currentColor"/></svg>{error}</p>}
    </div>
  );
}

/* ─── PW STRENGTH ─── */
function PwStrength({ pw }) {
  if(!pw) return null;
  const checks=[pw.length>=8,/\d/.test(pw),/[^a-zA-Z0-9]/.test(pw),/[A-Z]/.test(pw)];
  const s=checks.filter(Boolean).length;
  const m=[null,{c:'#ef4444',l:'ضعيفة'},{c:'#f97316',l:'مقبولة'},{c:'#eab308',l:'جيدة'},{c:'#22c55e',l:'قوية ✓'}][s];
  return (
    <div style={{marginBottom:11,animation:'itemIn .3s ease both'}}>
      <div style={{display:'flex',gap:3,marginBottom:4}}>
        {[1,2,3,4].map(i=><div key={i} style={{flex:1,height:2.5,borderRadius:2,background:i<=s?m?.c:'rgba(255,255,255,.07)',boxShadow:i<=s?`0 0 6px ${m?.c}55`:'none',transition:'all .3s'}}/>)}
      </div>
      <div style={{display:'flex',justifyContent:'flex-end'}}>
        <span style={{fontSize:10,fontWeight:700,color:m?.c,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'.06em'}}>{m?.l}</span>
      </div>
    </div>
  );
}

/* ─── STEP BAR ─── */
function StepBar({ step }) {
  return (
    <div style={{display:'flex',gap:6,marginBottom:18}}>
      {[0,1].map(i=><div key={i} style={{flex:1,height:2.5,borderRadius:2,background:i<=step?'linear-gradient(90deg,#22c55e,#4ade80)':'rgba(255,255,255,.08)',boxShadow:i<=step?'0 0 8px rgba(34,197,94,.28)':'none',transition:'all .4s'}}/>)}
    </div>
  );
}

/* ─── CHECKBOX ─── */
function Checkbox({ checked, onToggle, label }) {
  return (
    <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
      <div onClick={onToggle} style={{
        width:17,height:17,borderRadius:5,flexShrink:0,
        background:checked?'rgba(34,197,94,.2)':'rgba(255,255,255,.05)',
        border:`1.5px solid ${checked?'rgba(34,197,94,.7)':'rgba(255,255,255,.13)'}`,
        display:'flex',alignItems:'center',justifyContent:'center',
        boxShadow:checked?'0 0 8px rgba(34,197,94,.22)':'none',
        transition:'all .15s',
      }}>
        {checked&&<svg width="9" height="8"><polyline points="1.5,4 3.8,6.5 8,1.5" fill="none" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <span style={{fontSize:12,color:'rgba(255,255,255,.36)'}}>{label}</span>
    </label>
  );
}

/* ─── MARKET TICKER ─── */
function Ticker() {
  const items=[
    {s:'BTC/USD',v:'+2.41%',up:true},{s:'EUR/USD',v:'-0.83%',up:false},
    {s:'XAU/USD',v:'+1.12%',up:true},{s:'S&P500',v:'+0.64%',up:true},
    {s:'USD/JPY',v:'-1.31%',up:false},{s:'WTI OIL',v:'+3.22%',up:true},
    {s:'ETH/USD',v:'+4.18%',up:true},{s:'NAS100',v:'+0.95%',up:true},
    {s:'GBP/USD',v:'-0.55%',up:false},{s:'DAX',v:'+0.72%',up:true},
  ];
  return (
    <div style={{position:'absolute',bottom:0,left:0,right:0,height:30,
      borderTop:'1px solid rgba(34,197,94,.07)',
      background:'rgba(3,8,5,.95)',backdropFilter:'blur(12px)',
      overflow:'hidden',display:'flex',alignItems:'center',zIndex:20}}>
      <div style={{display:'flex',width:'max-content',animation:'ticker 34s linear infinite',whiteSpace:'nowrap'}}>
        {[...items,...items].map((x,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:5,padding:'0 14px',borderRight:'1px solid rgba(255,255,255,.04)'}}>
            <span style={{fontSize:9.5,fontWeight:700,color:'rgba(255,255,255,.28)',letterSpacing:'.08em',fontFamily:'monospace'}}>{x.s}</span>
            <span style={{fontSize:9.5,fontWeight:800,color:x.up?'#22c55e':'#ef4444',fontFamily:'monospace',
              textShadow:x.up?'0 0 6px rgba(34,197,94,.45)':'0 0 6px rgba(239,68,68,.45)'}}>{x.v}</span>
            <span style={{fontSize:7,color:x.up?'rgba(34,197,94,.45)':'rgba(239,68,68,.45)'}}>{x.up?'▲':'▼'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── LOGO HEADER ─── (used in login and standalone) */
function LogoHeader({ LOGO }) {
  return (
    <div className="item d0" style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:22,textAlign:'center'}}>
      <div style={{
        width:68,height:68,borderRadius:20,overflow:'hidden',marginBottom:14,
        border:'1.5px solid rgba(34,197,94,.38)',
        animation:'float 3.2s ease-in-out infinite,glow 3.2s ease-in-out infinite',
        flexShrink:0,
      }}>
        <img src={LOGO} alt="OHM" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
      </div>
      <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:24,fontWeight:700,
        letterSpacing:'-.4px',lineHeight:1,marginBottom:6,
        background:'linear-gradient(135deg,#f0fff4 30%,#86efac 70%,#4ade80)',
        WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>OHM Trading Journal</h1>
      <p style={{fontSize:12,color:'rgba(255,255,255,.35)',fontWeight:300,lineHeight:1.65,maxWidth:270}}>
        منصة احترافية لتسجيل وتحليل الصفقات وبناء انضباط تداولي حقيقي
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   VIEWS — All defined OUTSIDE OhmAuth to prevent remount
   ══════════════════════════════════════════════════════════ */

function LoginView({ state, handlers, LOGO }) {
  const { lEmail, lPass, showLP, remMe, errors, loading } = state;
  const { setLEmail, setLPass, setShowLP, setRemMe, doLogin, goReg, setSocialModal, doGoogleLogin } = handlers;
  return (
    <GlassCard animKey={state.animKey}>
      <LogoHeader LOGO={LOGO}/>
      <div className="item d1">
        <GlassInput label="البريد الإلكتروني" type="email" value={lEmail} onChange={setLEmail}
          error={errors.email} iconPath={P.mail} autoComplete="email"/>
      </div>
      <div className="item d2">
        <GlassInput label="كلمة المرور" type={showLP?'text':'password'} value={lPass} onChange={setLPass}
          error={errors.pass} iconPath={P.lock} autoComplete="current-password"
          eyeToggle={{show:showLP, toggle:()=>setShowLP(p=>!p)}}/>
      </div>
      <div className="item d3" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <Checkbox checked={remMe} onToggle={()=>setRemMe(p=>!p)} label="تذكرني"/>
        <button style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'rgba(74,222,128,.65)',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
          نسيت كلمة المرور؟
        </button>
      </div>
      <div className="item d4"><PrimaryBtn onClick={doLogin} loading={loading}>دخول المنصة ←</PrimaryBtn></div>
      <div className="item d5" style={{display:'flex',alignItems:'center',gap:12,margin:'16px 0'}}>
        <div style={{flex:1,height:1,background:'rgba(255,255,255,.07)'}}/><span style={{fontSize:10,color:'rgba(255,255,255,.2)',fontWeight:700,letterSpacing:'.1em',fontFamily:"'Space Grotesk',sans-serif"}}>أو</span>
        <div style={{flex:1,height:1,background:'rgba(255,255,255,.07)'}}/>
      </div>
      <div className="item d6" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <SocialBtn label="Google" onPress={()=>doGoogleLogin()} icon={<svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}/>
        <SocialBtn label="Apple" onPress={()=>setSocialModal('Apple')} icon={<svg width="14" height="14" viewBox="0 0 814 1000" fill="rgba(255,255,255,.72)"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-122.4c-47.8-81.7-88.5-209.6-88.5-332.8 0-209.6 138-320.2 273.8-320.2 69.4 0 126.9 45.7 170.7 45.7 43.3 0 110.8-48.3 190.4-48.3zm-234.4-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/></svg>}/>
      </div>
      <p className="item d7" style={{textAlign:'center',marginTop:18,fontSize:13,color:'rgba(255,255,255,.28)'}}>
        لا تملك حساباً؟{' '}<button onClick={goReg} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:700,color:'rgba(74,222,128,.82)',fontFamily:"'DM Sans',sans-serif",textDecoration:'underline',textUnderlineOffset:3}}>إنشاء حساب</button>
      </p>
    </GlassCard>
  );
}

function RegisterView({ state, handlers, LOGO }) {
  const { regStep, rName, rEmail, rPhone, rPass, rPassC, showRP, showRC, errors, loading, animKey } = state;
  const { setRName, setREmail, setRPhone, setRPass, setRPassC, setShowRP, setShowRC, doReg, goBack } = handlers;
  return (
    <GlassCard animKey={animKey}>
      <div className="item d0" style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
        <button onClick={goBack} style={{width:32,height:32,borderRadius:9,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.09)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'rgba(255,255,255,.42)',flexShrink:0,transition:'all .2s'}}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(34,197,94,.1)';e.currentTarget.style.color='#4ade80';}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.05)';e.currentTarget.style.color='rgba(255,255,255,.42)';}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div style={{flex:1,textAlign:'center'}}>
          <div style={{width:44,height:44,borderRadius:13,overflow:'hidden',margin:'0 auto 8px',border:'1.5px solid rgba(34,197,94,.28)',boxShadow:'0 0 18px rgba(34,197,94,.16)'}}>
            <img src={LOGO} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </div>
          <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,color:'#f0fff4'}}>{regStep===0?'إنشاء حساب جديد':'تأمين الحساب'}</p>
          <p style={{fontSize:11,color:'rgba(255,255,255,.28)',marginTop:3}}>{regStep===0?'الخطوة 1 من 2 — بياناتك الأساسية':'الخطوة 2 من 2 — كلمة المرور'}</p>
        </div>
        <div style={{width:32}}/>
      </div>
      <div className="item d1"><StepBar step={regStep}/></div>
      {regStep===0?(
        <>
          <div className="item d2"><GlassInput label="الاسم الكامل" value={rName} onChange={setRName} error={errors.name} iconPath={P.user} autoComplete="name"/></div>
          <div className="item d3"><GlassInput label="البريد الإلكتروني" type="email" value={rEmail} onChange={setREmail} error={errors.email} iconPath={P.mail} autoComplete="email"/></div>
          <div className="item d4"><GlassInput label="رقم الجوال (اختياري)" type="tel" value={rPhone} onChange={setRPhone} iconPath={P.phone} autoComplete="tel"/></div>
        </>
      ):(
        <>
          <div className="item d2"><GlassInput label="كلمة المرور" type={showRP?'text':'password'} value={rPass} onChange={setRPass} error={errors.pass} iconPath={P.lock} autoComplete="new-password" eyeToggle={{show:showRP,toggle:()=>setShowRP(p=>!p)}}/></div>
          <PwStrength pw={rPass}/>
          <div className="item d3"><GlassInput label="تأكيد كلمة المرور" type={showRC?'text':'password'} value={rPassC} onChange={setRPassC} error={errors.passC} iconPath={P.lock} autoComplete="new-password" eyeToggle={{show:showRC,toggle:()=>setShowRC(p=>!p)}}/></div>
          <div className="item d4" style={{marginBottom:14,padding:'10px 13px',background:'rgba(34,197,94,.04)',borderRadius:10,border:'1px solid rgba(34,197,94,.1)'}}>
            <p style={{fontSize:11,color:'rgba(255,255,255,.32)',lineHeight:1.7}}>
              بالمتابعة توافق على <span style={{color:'rgba(74,222,128,.68)',cursor:'pointer',fontWeight:600}}>شروط الاستخدام</span> و<span style={{color:'rgba(74,222,128,.68)',cursor:'pointer',fontWeight:600}}>سياسة الخصوصية</span>
            </p>
          </div>
        </>
      )}
      <div className="item d5"><PrimaryBtn onClick={doReg} loading={loading}>{regStep===0?'التالي ←':'إنشاء الحساب ←'}</PrimaryBtn></div>
      <p className="item d6" style={{textAlign:'center',marginTop:14,fontSize:13,color:'rgba(255,255,255,.28)'}}>
        لديك حساب؟{' '}<button onClick={handlers.goLogin} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:700,color:'rgba(74,222,128,.82)',fontFamily:"'DM Sans',sans-serif",textDecoration:'underline',textUnderlineOffset:3}}>تسجيل الدخول</button>
      </p>
    </GlassCard>
  );
}

function OTPView({ state, handlers }) {
  const { otp, errors, loading, timer, canRes, rEmail, animKey } = state;
  const { setOtp, doVerify, doResend, goBackOTP } = handlers;
  return (
    <GlassCard animKey={animKey}>
      <div className="item d0" style={{textAlign:'center',marginBottom:22}}>
        <div style={{display:'inline-flex',width:64,height:64,borderRadius:20,background:'linear-gradient(135deg,rgba(34,197,94,.1),rgba(34,197,94,.04))',border:'1.5px solid rgba(34,197,94,.24)',alignItems:'center',justifyContent:'center',marginBottom:16,boxShadow:'0 0 26px rgba(34,197,94,.12),inset 0 1px 0 rgba(255,255,255,.08)'}}>
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
        </div>
        <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:21,fontWeight:700,color:'#f0fff4',marginBottom:8}}>التحقق من هويتك</h2>
        <p style={{fontSize:12,color:'rgba(255,255,255,.38)',lineHeight:1.7,marginBottom:5}}>أرسلنا رمزاً مؤلفاً من 6 أرقام إلى</p>
        <p style={{fontSize:13,color:'#4ade80',fontWeight:700,textShadow:'0 0 12px rgba(34,197,94,.38)'}}>{rEmail}</p>
      </div>
      <div className="item d1" style={{marginBottom:20}}><OTPInput value={otp} onChange={setOtp} error={errors.otp}/></div>
      <div className="item d2"><PrimaryBtn onClick={doVerify} loading={loading} disabled={otp.length<6}>تأكيد الرمز ←</PrimaryBtn></div>
      <div className="item d3" style={{textAlign:'center',marginTop:14}}>
        {canRes
          ? <button onClick={doResend} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,fontWeight:700,color:'rgba(74,222,128,.68)',fontFamily:"'DM Sans',sans-serif"}}>إعادة إرسال الرمز</button>
          : <p style={{fontSize:11,color:'rgba(255,255,255,.24)'}}>إعادة الإرسال خلال <span style={{color:'#4ade80',fontWeight:800,fontVariantNumeric:'tabular-nums'}}>0:{String(timer).padStart(2,'0')}</span></p>
        }
      </div>
      <div className="item d4" style={{marginTop:14,padding:'9px 13px',background:'rgba(34,197,94,.04)',borderRadius:10,border:'1px solid rgba(34,197,94,.09)'}}>
        <p style={{fontSize:11,color:'rgba(74,222,128,.48)',lineHeight:1.7}}>💡 تحقق من مجلد البريد غير المرغوب إن لم تجد الرسالة</p>
      </div>
      <button onClick={goBackOTP} style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:5,color:'rgba(255,255,255,.2)',fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:14,padding:0,transition:'color .2s'}}
        onMouseEnter={e=>e.currentTarget.style.color='rgba(34,197,94,.5)'}
        onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.2)'}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg> العودة
      </button>
    </GlassCard>
  );
}

function SuccessView({ state, handlers }) {
  const { rName, lEmail, rEmail, animKey } = state;
  return (
    <GlassCard animKey={animKey}>
      <div className="item d0" style={{textAlign:'center',marginBottom:20}}>
        <div style={{display:'inline-block',marginBottom:16}}>
          <svg width="68" height="68" viewBox="0 0 68 68">
            <circle cx="34" cy="34" r="31" fill="none" stroke="rgba(34,197,94,.14)" strokeWidth="2"/>
            <circle cx="34" cy="34" r="31" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="195" strokeDashoffset="195" style={{animation:'ringDraw .88s cubic-bezier(.4,0,.2,1) .08s forwards'}}/>
            <polyline points="20,35 30,45 49,23" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="60" style={{animation:'checkDraw .42s ease .78s forwards'}}/>
          </svg>
        </div>
        <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:24,fontWeight:700,color:'#4ade80',marginBottom:8,textShadow:'0 0 18px rgba(34,197,94,.28)'}}>{lEmail&&!rEmail?'أهلاً بعودتك!':'مرحباً بك في OHM!'}</h2>
        <p style={{fontSize:12,color:'rgba(255,255,255,.36)',lineHeight:1.7}}>{rName?`مرحباً ${rName}! `:''}حسابك جاهز — ابدأ رحلتك التداولية</p>
      </div>
      <div className="item d1" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:18}}>
        {[['📊','لوحة التحكم'],['🎯','Ohm Score'],['📓','يومية الصفقات'],['📈','التقارير']].map(([e,t],i)=>(
          <div key={t} style={{padding:'13px 11px',background:'linear-gradient(135deg,rgba(34,197,94,.07),rgba(34,197,94,.02))',border:'1px solid rgba(34,197,94,.1)',borderRadius:12,cursor:'pointer',transition:'all .2s',animation:`itemIn .4s ${.15+i*.06}s both`}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.borderColor='rgba(34,197,94,.2)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.borderColor='rgba(34,197,94,.1)';}}>
            <span style={{fontSize:18}}>{e}</span>
            <p style={{fontSize:12,fontWeight:700,color:'#86efac',marginTop:7,fontFamily:"'Space Grotesk',sans-serif"}}>{t}</p>
          </div>
        ))}
      </div>
      <div className="item d2">
        <PrimaryBtn onClick={handlers.reset}>انطلق إلى المنصة →</PrimaryBtn>
      </div>
    </GlassCard>
  );
}

/* ══════════════════════════════════════════════════════════
   BACKGROUND — static component, renders once
   ══════════════════════════════════════════════════════════ */
function Background() {
  return (
    <>
      <div style={{position:'absolute',inset:0,background:'linear-gradient(150deg,#040d08 0%,#060f0b 25%,#050a0e 55%,#040305 100%)',zIndex:0}}/>
      <div style={{position:'absolute',right:'-5%',top:'5%',width:'min(520px,58vw)',aspectRatio:'1',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(34,197,94,.12) 0%,transparent 65%)',filter:'blur(50px)',animation:'orb1 20s ease-in-out infinite',zIndex:0}}/>
      <div style={{position:'absolute',left:'-8%',bottom:'5%',width:'min(460px,52vw)',aspectRatio:'1',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(239,68,68,.09) 0%,transparent 65%)',filter:'blur(55px)',animation:'orb2 24s ease-in-out infinite',zIndex:0}}/>
      <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:'min(680px,88vw)',aspectRatio:'1',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(8,18,12,.88) 0%,transparent 60%)',filter:'blur(40px)',zIndex:0}}/>
      <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:.055,zIndex:0}} viewBox="0 0 100 100" preserveAspectRatio="none">
        {[10,20,30,40,50,60,70,80,90].map(x=><line key={'v'+x} x1={x+'%'} y1="0" x2={x+'%'} y2="100%" stroke="#22c55e" strokeWidth=".055"/>)}
        {[10,20,30,40,50,60,70,80,90].map(y=><line key={'h'+y} x1="0" y1={y+'%'} x2="100%" y2={y+'%'} stroke="#22c55e" strokeWidth=".055"/>)}
      </svg>
      <div style={{position:'absolute',left:0,right:0,height:100,background:'linear-gradient(180deg,transparent,rgba(34,197,94,.015),transparent)',animation:'scan 14s linear infinite',pointerEvents:'none',zIndex:1}}/>
      <div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:'min(420px,78vw)',height:260,background:'radial-gradient(ellipse at 50% 0%,rgba(34,197,94,.065),transparent 70%)',pointerEvents:'none',zIndex:1}}/>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT — only state lives here, all views outside
   ══════════════════════════════════════════════════════════ */
export default function OhmAuth({ onLogin }) {
  const [view,setView]    = useState('login');
  const [animKey,setAK]   = useState(0);
  const [social,setSocial]= useState(null);

  // Login
  const [lEmail,setLEmail]= useState('');
  const [lPass,setLPass]  = useState('');
  const [showLP,setShowLP]= useState(false);
  const [remMe,setRemMe]  = useState(false);

  // Register
  const [regStep,setRegStep]= useState(0);
  const [rName,setRName]  = useState('');
  const [rEmail,setREmail]= useState('');
  const [rPhone,setRPhone]= useState('');
  const [rPass,setRPass]  = useState('');
  const [rPassC,setRPassC]= useState('');
  const [showRP,setShowRP]= useState(false);
  const [showRC,setShowRC]= useState(false);

  // OTP
  const [otp,setOtp]      = useState('');
  const [timer,setTimer]  = useState(60);
  const [canRes,setCanRes]= useState(false);

  // Shared
  const [errors,setErrors]= useState({});
  const [loading,setLoading]= useState(false);

  useEffect(()=>{
    if(view!=='otp') return;
    if(timer<=0){setCanRes(true);return;}
    const t=setTimeout(()=>setTimer(p=>p-1),1000); return()=>clearTimeout(t);
  },[timer,view]);

  const go = (v)=>{ setAK(k=>k+1); setView(v); setErrors({}); };

  const doLogin = async ()=>{
    const e={};
    if(!lEmail)e.email='البريد مطلوب'; else if(!/\S+@\S+\.\S+/.test(lEmail))e.email='بريد غير صالح';
    if(!lPass)e.pass='كلمة المرور مطلوبة';
    setErrors(e); if(Object.keys(e).length)return;
    setLoading(true);
    try {
      const user = await loginUser(lEmail, lPass);
      setLoading(false);
      go('success');
      if(onLogin) onLogin(user);
    } catch(err) {
      setLoading(false);
      const code = err.code || '';
      if(code.includes('user-not-found')||code.includes('wrong-password')||code.includes('invalid-credential'))
        setErrors({pass:'البريد أو كلمة المرور غير صحيحة'});
      else if(code.includes('too-many-requests'))
        setErrors({pass:'تم تجاوز عدد المحاولات، حاول لاحقاً'});
      else
        setErrors({pass:'حدث خطأ: ' + (err.message||err.code||'unknown')});
    }
  };

  const doReg = async ()=>{
    const e={};
    if(regStep===0){
      if(!rName.trim())e.name='الاسم مطلوب';
      if(!rEmail)e.email='البريد مطلوب'; else if(!/\S+@\S+\.\S+/.test(rEmail))e.email='بريد غير صالح';
      setErrors(e); if(Object.keys(e).length)return;
      setRegStep(1); setAK(k=>k+1); return;
    }
    if(!rPass)e.pass='كلمة المرور مطلوبة'; else if(rPass.length<8)e.pass='8 أحرف على الأقل';
    if(rPass!==rPassC)e.passC='كلمتا المرور غير متطابقتين';
    setErrors(e); if(Object.keys(e).length)return;
    setLoading(true);
    try {
      const user = await registerUser({ name:rName, email:rEmail, phone:rPhone, password:rPass });
      setLoading(false);
      setTimer(60); setCanRes(false); setOtp(''); go('otp');
      // سيتم استدعاء onLogin بعد تأكيد التحقق من الإيميل
    } catch(err) {
      setLoading(false);
      const code = err.code || '';
      if(code.includes('email-already-in-use'))
        setErrors({email:'هذا البريد مسجّل مسبقاً'});
      else if(code.includes('weak-password'))
        setErrors({pass:'كلمة المرور ضعيفة جداً'});
      else
        setErrors({pass:'حدث خطأ: ' + (err.message||err.code||'unknown')});
    }
  };

  const doVerify = async ()=>{
    // Firebase يرسل رابط تحقق بالإيميل وليس OTP رقمي
    // هذه الشاشة تُعلم المستخدم بأن يتحقق من بريده
    go('success');
    if(onLogin) onLogin(null);
  };

  const doResend=()=>{setCanRes(false);setTimer(60);setOtp('');setErrors({});};

  const reset=()=>{
    go('login');
    setLEmail('');setLPass('');setREmail('');setRName('');
    setRPass('');setRPassC('');setRegStep(0);
  };

  // Pack state and handlers to pass to views
  const state = {
    view,animKey,lEmail,lPass,showLP,remMe,
    regStep,rName,rEmail,rPhone,rPass,rPassC,showRP,showRC,
    otp,timer,canRes,errors,loading,
  };
  const loginHandlers = {
    setLEmail,setLPass,setShowLP,setRemMe,doLogin,
    goReg:()=>{go('register');setRegStep(0);},
    setSocialModal:setSocial,
doGoogleLogin: async()=>{
  setLoading(true);
  try{
    const user=await loginWithGoogle();
    setLoading(false);
    go('success');
    if(onLogin) onLogin(user);
  }catch(err){
    setLoading(false);
    setErrors({pass:'فشل الدخول بـ Google'});
  }
},
  };
  const regHandlers = {
    setRName,setREmail,setRPhone,setRPass,setRPassC,setShowRP,setShowRC,
    doReg, goBack:()=>regStep===0?go('login'):(setRegStep(0),setAK(k=>k+1)),
    goLogin:()=>go('login'),
  };
  const otpHandlers = { setOtp, doVerify, doResend, goBackOTP:()=>{go('register');setRegStep(1);} };
  const successHandlers = { reset };

  return (
    <>
      <style>{CSS}</style>
      <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',direction:'rtl',overflow:'hidden'}}>
        <Background/>
        {/* Scroll wrapper */}
        <div style={{position:'relative',zIndex:10,width:'100%',maxWidth:450,padding:'16px 16px 38px',overflowY:'auto',maxHeight:'100%',WebkitOverflowScrolling:'touch',scrollbarWidth:'thin'}}>
          {view==='login'    && <LoginView    state={state} handlers={loginHandlers} LOGO={LOGO}/>}
          {view==='register' && <RegisterView state={state} handlers={regHandlers}   LOGO={LOGO}/>}
          {view==='otp'      && <OTPView      state={state} handlers={otpHandlers}/>}
          {view==='success'  && <SuccessView  state={state} handlers={successHandlers}/>}
        </div>
        <Ticker/>
      </div>
      {social && <SocialModal provider={social} onClose={()=>setSocial(null)}/>}
    </>
  );
}
