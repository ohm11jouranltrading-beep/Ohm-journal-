// ═══════════════════════════════════════════════════════════
//  OHM TRADING JOURNAL — Main Entry (Auth Router)
//  ───────────────────────────────────────────────────────────
//  هذا الملف يربط صفحة تسجيل الدخول بالتطبيق الرئيسي.
//  يراقب حالة Firebase Auth ويوجّه المستخدم تلقائياً.
//  ═══════════════════════════════════════════════════════════

import React from "react";
import ReactDOM from "react-dom/client";
import { useState, useEffect } from "react";
import { onAuthChange } from "./firebase";
import OhmAuth from "./ohm_auth_v6";
import App from "./app_v35";

function Main() {
  const [user, setUser] = useState(undefined);
  const [ready, setReady] = useState(false);

  useEffect(()=>{
    const unsub = onAuthChange((u)=>{ setUser(u); setReady(true); });
    return ()=>unsub();
  },[]);

  if(!ready) return null;
  if(!user) return <OhmAuth onLogin={(u)=>setUser(u)} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>
);
