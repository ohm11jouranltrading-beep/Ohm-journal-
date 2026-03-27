import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { onAuthChange } from "./firebase";
import OhmAuth from "./ohm_auth_v6";
import App from "./app_v35";
import AdminPage from "./admin";

const ADMIN_EMAILS = [
  "ohm.1.1jouranltrading@gmail.com",
];

function Main() {
  const [user,  setUser]  = useState(undefined);
  const [ready, setReady] = useState(false);
  const [view,  setView]  = useState("app");

  useEffect(() => {
    const unsub = onAuthChange((u) => { setUser(u); setReady(true); });
    return () => unsub();
  }, []);

  if (!ready) {
    return (
      <div style={{position:"fixed",inset:0,background:"#050d08",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
        <div style={{width:44,height:44,borderRadius:"50%",border:"3px solid rgba(34,197,94,0.15)",borderTopColor:"#22c55e",animation:"spin .7s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:"rgba(74,222,128,0.6)",fontSize:13,fontWeight:600,fontFamily:"sans-serif"}}>جاري التحقق...</p>
      </div>
    );
  }

  if (!user) return <OhmAuth onLogin={(u) => setUser(u)} />;

  const isAdmin = ADMIN_EMAILS.includes(user.email);
  if (isAdmin && view === "admin") return <AdminPage user={user} onBack={() => setView("app")} />;

  return (
    <div style={{position:"relative"}}>
      <App />
      {isAdmin && (
        <button onClick={() => setView("admin")} style={{position:"fixed",bottom:20,left:20,zIndex:9999,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:12,padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:800,fontFamily:"sans-serif",boxShadow:"0 4px 20px rgba(99,102,241,0.5)"}}>
          🛡️ Admin
        </button>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><Main /></React.StrictMode>
);
