import { useState, useEffect } from "react";
import { onAuthChange } from "./firebase";
import OhmAuth from "./ohm_auth_v6";
import App from "./app_v35";

export default function Main() {
  const [user, setUser] = useState(undefined);
  const [ready, setReady] = useState(false);

  useEffect(()=>{
    const unsub = onAuthChange((u)=>{
      setUser(u);
      setReady(true);
    });
    return ()=>unsub();
  },[]);

  if(!ready){
    return (
      <div style={{position:"fixed",inset:0,background:"#050d08",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
        <div style={{width:44,height:44,borderRadius:"50%",border:"3px solid rgba(34,197,94,0.15)",borderTopColor:"#22c55e",animation:"spin .7s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:"rgba(74,222,128,0.6)",fontSize:13,fontWeight:600,fontFamily:"sans-serif"}}>جاري التحقق...</p>
      </div>
    );
  }

  if(!user) return <OhmAuth onLogin={(u)=>setUser(u)} />;
  return <App />;
}
