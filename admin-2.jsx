import { useState, useEffect, useRef } from "react";
import { db, logoutUser } from "./firebase-1";
import { collection, getDocs } from "firebase/firestore";

const ADMIN_EMAILS = ["ohm.1.1jouranltrading@gmail.com"];
const isAdmin = (user) => user && ADMIN_EMAILS.includes(user.email);

/* ── Calc Stats ── */
function calcStats(trades = []) {
  if (!trades.length) return { score: 0, wr: 0, total: 0, count: 0, avgRR: "0.0", bestDay: null, worstDay: null, topMistakes: [], topSetups: [], longCount: 0, shortCount: 0, avgPnl: 0, winStreak: 0, lossStreak: 0, profitFactor: 0 };
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const wr = Math.round((wins.length / trades.length) * 100);
  const total = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const avgPnl = total / trades.length;
  const rrs = trades.filter(t => t.rr > 0);
  const avgRR = rrs.length ? (rrs.reduce((s, t) => s + t.rr, 0) / rrs.length).toFixed(1) : "0.0";
  const byDay = {};
  trades.forEach(t => { byDay[t.date] = (byDay[t.date] || 0) + (t.pnl || 0); });
  const days = Object.entries(byDay).sort((a, b) => b[1] - a[1]);
  const bestDay = days[0] ? { date: days[0][0], pnl: days[0][1] } : null;
  const worstDay = days[days.length - 1]?.pnl < 0 ? { date: days[days.length - 1][0], pnl: days[days.length - 1][1] } : null;
  const gl = Math.abs(losses.reduce((s, t) => s + t.pnl, 0)) || 1;
  const gp = wins.reduce((s, t) => s + t.pnl, 0);
  const profitFactor = (gp / gl).toFixed(2);
  const mist = trades.reduce((s, t) => s + (t.mistakes?.length || 0), 0);
  const score = Math.round((wins.length / trades.length) * 30 + (Math.min(gp / gl, 3) / 3) * 30 + Math.min(Number(avgRR) / 1.5, 1) * 20 + Math.max(0, 20 - mist * 5));
  const mistakes = {};
  trades.forEach(t => t.mistakes?.forEach(m => { mistakes[m] = (mistakes[m] || 0) + 1; }));
  const topMistakes = Object.entries(mistakes).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const bySetup = {};
  trades.forEach(t => { if (t.setup) bySetup[t.setup] = (bySetup[t.setup] || 0) + 1; });
  const topSetups = Object.entries(bySetup).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const longCount = trades.filter(t => t.direction === "L").length;
  const shortCount = trades.filter(t => t.direction === "S").length;
  // Streaks
  let winStreak = 0, lossStreak = 0, curW = 0, curL = 0;
  [...trades].sort((a, b) => (a.date || "").localeCompare(b.date || "")).forEach(t => {
    if (t.pnl > 0) { curW++; curL = 0; winStreak = Math.max(winStreak, curW); }
    else { curL++; curW = 0; lossStreak = Math.max(lossStreak, curL); }
  });
  return { score, wr, total, count: trades.length, avgRR, bestDay, worstDay, topMistakes, topSetups, longCount, shortCount, avgPnl, winStreak, lossStreak, profitFactor };
}

/* ── Grade colors ── */
const gradeColor = { A: "#00ff87", B: "#00d4ff", C: "#ffd700", D: "#ff6b35", F: "#ff3366" };

/* ── Sparkline ── */
function Sparkline({ trades }) {
  if (!trades?.length) return null;
  const sorted = [...trades].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  let cum = 0;
  const points = sorted.map(t => { cum += (t.pnl || 0); return cum; });
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const w = 120, h = 36;
  const pts = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const isPos = points[points.length - 1] >= 0;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`sg${trades[0]?.id || Math.random()}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={isPos ? "#00ff87" : "#ff3366"} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isPos ? "#00ff87" : "#ff3366"} stopOpacity="1" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={isPos ? "#00ff87" : "#ff3366"} strokeWidth="2" points={pts} />
    </svg>
  );
}

/* ── Score Ring ── */
function ScoreRing({ score, size = 80 }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const pct = score / 100;
  const col = score >= 70 ? "#00ff87" : score >= 45 ? "#ffd700" : "#ff3366";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
        fill={col} fontSize={size * 0.22} fontWeight="900" style={{ transform: `rotate(90deg) translate(0px, -${size}px)`, transformOrigin: `${size / 2}px ${size / 2}px` }}>
      </text>
    </svg>
  );
}

/* ── Mini stat card ── */
function StatCard({ label, value, sub, color = "#00d4ff", icon }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}20`, borderRadius: 14, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: "'Space Grotesk', monospace", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ── Profile Page ── */
function ProfilePage({ client, onBack }) {
  const [tab, setTab] = useState("overview");
  const s = client;
  const recent = [...(s.trades || [])].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 20);
  const scoreCol = s.score >= 70 ? "#00ff87" : s.score >= 45 ? "#ffd700" : "#ff3366";
  const tabs = [
    { id: "overview", label: "📊 Overview" },
    { id: "trades", label: "📋 الصفقات" },
    { id: "analysis", label: "🔬 تحليل" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#060b14", color: "#fff", fontFamily: "'DM Sans', sans-serif", direction: "rtl" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.3); border-radius: 2px; }
        .tab-btn { background: none; border: none; cursor: pointer; font-family: inherit; transition: all .2s; }
        .tab-btn:hover { opacity: 0.8; }
        .trade-row:hover { background: rgba(255,255,255,0.05) !important; }
        .back-btn:hover { background: rgba(0,212,255,0.15) !important; }
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)", borderBottom: "1px solid rgba(0,212,255,0.1)", padding: "20px 24px" }}>
        <button className="back-btn" onClick={onBack} style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 10, padding: "8px 16px", color: "#00d4ff", cursor: "pointer", fontSize: 13, fontWeight: 700, marginBottom: 20, transition: "all .2s" }}>
          ← رجوع للقائمة
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <ScoreRing score={s.score} size={90} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 18, fontWeight: 900, color: scoreCol, fontFamily: "'Space Grotesk', monospace" }}>{s.score}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>{s.name}</h1>
              <span style={{ background: `${scoreCol}18`, color: scoreCol, border: `1px solid ${scoreCol}40`, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 800 }}>
                {s.score >= 70 ? "🏆 Elite" : s.score >= 45 ? "📈 Good" : "📉 Needs Work"}
              </span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{s.email}</p>
            {s.phone && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 }}>📞 {s.phone}</p>}
            {s.createdAt && <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 4 }}>📅 انضم {s.createdAt.toLocaleDateString("ar")}</p>}
          </div>
          <div style={{ textAlign: "center" }}>
            <Sparkline trades={s.trades} />
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>منحنى الأرباح</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "12px 24px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.3)" }}>
        {tabs.map(t => (
          <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)}
            style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700, color: tab === t.id ? "#00d4ff" : "rgba(255,255,255,0.4)", borderBottom: tab === t.id ? "2px solid #00d4ff" : "2px solid transparent", borderRadius: 0 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 24px 40px" }}>
        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
              <StatCard label="Win Rate" value={s.wr + "%"} color={s.wr >= 60 ? "#00ff87" : s.wr >= 40 ? "#ffd700" : "#ff3366"} icon="🎯" />
              <StatCard label="إجمالي PnL" value={`$${s.total?.toFixed(0)}`} color={s.total >= 0 ? "#00ff87" : "#ff3366"} icon="💰" />
              <StatCard label="عدد الصفقات" value={s.count} color="#00d4ff" icon="📊" />
              <StatCard label="متوسط RR" value={s.avgRR + ":1"} color="#a855f7" icon="⚖️" />
              <StatCard label="Profit Factor" value={s.profitFactor} color="#f59e0b" icon="⚡" />
              <StatCard label="متوسط PnL" value={`$${s.avgPnl?.toFixed(1)}`} color={s.avgPnl >= 0 ? "#00ff87" : "#ff3366"} icon="📈" />
              <StatCard label="Win Streak" value={s.winStreak} color="#00ff87" icon="🔥" sub="أطول سلسلة فوز" />
              <StatCard label="Loss Streak" value={s.lossStreak} color="#ff3366" icon="❄️" sub="أطول سلسلة خسارة" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {s.bestDay && (
                <div style={{ background: "rgba(0,255,135,0.05)", border: "1px solid rgba(0,255,135,0.15)", borderRadius: 16, padding: "16px 18px" }}>
                  <p style={{ fontSize: 11, color: "#00ff87", fontWeight: 800, marginBottom: 8 }}>🏆 أفضل يوم</p>
                  <p style={{ fontSize: 26, fontWeight: 900, color: "#00ff87", fontFamily: "'Space Grotesk', monospace" }}>+${s.bestDay.pnl?.toFixed(0)}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{s.bestDay.date}</p>
                </div>
              )}
              {s.worstDay && (
                <div style={{ background: "rgba(255,51,102,0.05)", border: "1px solid rgba(255,51,102,0.15)", borderRadius: 16, padding: "16px 18px" }}>
                  <p style={{ fontSize: 11, color: "#ff3366", fontWeight: 800, marginBottom: 8 }}>📉 أسوأ يوم</p>
                  <p style={{ fontSize: 26, fontWeight: 900, color: "#ff3366", fontFamily: "'Space Grotesk', monospace" }}>${s.worstDay.pnl?.toFixed(0)}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{s.worstDay.date}</p>
                </div>
              )}
            </div>

            {/* Long vs Short */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.5)", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".08em" }}>Long vs Short</p>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: s.longCount || 1, background: "rgba(0,255,135,0.15)", borderRadius: 8, padding: "8px 12px", textAlign: "center", border: "1px solid rgba(0,255,135,0.2)" }}>
                  <p style={{ fontSize: 18, fontWeight: 900, color: "#00ff87" }}>{s.longCount}</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>LONG ▲</p>
                </div>
                <div style={{ flex: s.shortCount || 1, background: "rgba(255,51,102,0.15)", borderRadius: 8, padding: "8px 12px", textAlign: "center", border: "1px solid rgba(255,51,102,0.2)" }}>
                  <p style={{ fontSize: 18, fontWeight: 900, color: "#ff3366" }}>{s.shortCount}</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>SHORT ▼</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TRADES TAB */}
        {tab === "trades" && (
          <div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>آخر {recent.length} صفقة</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recent.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: 40 }}>لا توجد صفقات</p>}
              {recent.map((t, i) => {
                const isW = t.pnl >= 0;
                const gc = gradeColor[t.grade] || "rgba(255,255,255,0.4)";
                return (
                  <div key={i} className="trade-row" style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${isW ? "rgba(0,255,135,0.1)" : "rgba(255,51,102,0.1)"}`, transition: "background .15s" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: isW ? "#00ff87" : "#ff3366", flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: "'Space Grotesk', monospace" }}>{t.symbol}</p>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{t.date} · {t.direction === "L" ? "LONG ▲" : "SHORT ▼"}{t.setup ? " · " + t.setup : ""}</p>
                    </div>
                    {t.grade && <span style={{ background: gc + "18", color: gc, border: `1px solid ${gc}40`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>{t.grade}</span>}
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>RR {t.rr || 0}:1</p>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 70 }}>
                      <p style={{ fontSize: 15, fontWeight: 900, color: isW ? "#00ff87" : "#ff3366", fontFamily: "'Space Grotesk', monospace" }}>{isW ? "+" : ""}${t.pnl}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ANALYSIS TAB */}
        {tab === "analysis" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {s.topSetups?.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px 18px" }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.5)", marginBottom: 14, textTransform: "uppercase", letterSpacing: ".08em" }}>🎯 أبرز الإعدادات</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.topSetups.map(([setup, count]) => {
                    const pct = Math.round((count / s.count) * 100);
                    return (
                      <div key={setup}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{setup}</span>
                          <span style={{ fontSize: 12, color: "#00d4ff", fontWeight: 700 }}>{count}× ({pct}%)</span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                          <div style={{ height: 4, width: pct + "%", background: "linear-gradient(90deg,#00d4ff,#a855f7)", borderRadius: 2, transition: "width 1s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {s.topMistakes?.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,51,102,0.15)", borderRadius: 16, padding: "16px 18px" }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: "#ff3366", marginBottom: 14, textTransform: "uppercase", letterSpacing: ".08em" }}>⚠️ أبرز الأخطاء</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.topMistakes.map(([mistake, count]) => {
                    const pct = Math.round((count / s.count) * 100);
                    return (
                      <div key={mistake}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{mistake}</span>
                          <span style={{ fontSize: 12, color: "#ff3366", fontWeight: 700 }}>{count}×</span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                          <div style={{ height: 4, width: Math.min(pct * 3, 100) + "%", background: "linear-gradient(90deg,#ff3366,#ff6b35)", borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grades breakdown */}
            {s.trades?.length > 0 && (() => {
              const gradeCount = {};
              s.trades.forEach(t => { if (t.grade) gradeCount[t.grade] = (gradeCount[t.grade] || 0) + 1; });
              const entries = Object.entries(gradeCount).sort();
              if (!entries.length) return null;
              return (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px 18px" }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.5)", marginBottom: 14, textTransform: "uppercase", letterSpacing: ".08em" }}>📝 توزيع الدرجات</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                    {entries.map(([g, n]) => (
                      <div key={g} style={{ textAlign: "center", background: (gradeColor[g] || "#fff") + "10", border: `1px solid ${(gradeColor[g] || "#fff")}30`, borderRadius: 10, padding: "10px 4px" }}>
                        <p style={{ fontSize: 20, fontWeight: 900, color: gradeColor[g] || "#fff" }}>{g}</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginTop: 2 }}>{n}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════ */
/*  MAIN ADMIN PAGE                                       */
/* ══════════════════════════════════════════════════════ */
export default function AdminPage({ user, onBack }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("score");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("grid"); // grid | list

  if (!isAdmin(user)) {
    return (
      <div style={{ minHeight: "100vh", background: "#060b14", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 56 }}>🚫</div>
        <p style={{ color: "#ff3366", fontSize: 18, fontWeight: 800 }}>غير مصرح لك</p>
        <button onClick={onBack} style={{ background: "#00d4ff20", color: "#00d4ff", border: "1px solid #00d4ff40", borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 700 }}>رجوع</button>
      </div>
    );
  }

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    setLoading(true); setError("");
    try {
      const snap = await getDocs(collection(db, "users"));
      const list = [];
      snap.forEach(doc => {
        const d = doc.data();
        const stats = calcStats(d.trades || []);
        list.push({ uid: doc.id, name: d.name || "بدون اسم", email: d.email || "", phone: d.phone || "", createdAt: d.createdAt?.toDate?.() || null, trades: d.trades || [], ...stats });
      });
      setClients(list);
    } catch (e) { setError("خطأ: " + e.message); }
    setLoading(false);
  }

  if (selected) return <ProfilePage client={selected} onBack={() => setSelected(null)} />;

  const filtered = clients
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === "score" ? b.score - a.score : sort === "wr" ? b.wr - a.wr : sort === "trades" ? b.count - a.count : a.name.localeCompare(b.name));

  const totalPnl = clients.reduce((s, c) => s + (c.total || 0), 0);
  const avgScore = clients.length ? Math.round(clients.reduce((s, c) => s + c.score, 0) / clients.length) : 0;
  const avgWR = clients.length ? Math.round(clients.reduce((s, c) => s + c.wr, 0) / clients.length) : 0;
  const eliteCount = clients.filter(c => c.score >= 70).length;

  return (
    <div style={{ minHeight: "100vh", background: "#060b14", color: "#fff", fontFamily: "'DM Sans', sans-serif", direction: "rtl" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.3); border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        .client-card { transition: all .2s; cursor: pointer; }
        .client-card:hover { transform: translateY(-3px); border-color: rgba(0,212,255,0.3) !important; box-shadow: 0 12px 40px rgba(0,212,255,0.1) !important; }
        .sort-btn { transition: all .2s; cursor: pointer; }
        .sort-btn:hover { opacity: .85; }
        .action-btn { transition: all .2s; cursor: pointer; }
        .action-btn:hover { opacity: .8; transform: scale(1.05); }
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:focus { outline: none; border-color: rgba(0,212,255,0.4) !important; }
      `}</style>

      {/* TOP HEADER */}
      <div style={{ background: "linear-gradient(135deg,#0a1628 0%,#0d1f3c 60%,#0a1628 100%)", borderBottom: "1px solid rgba(0,212,255,0.08)", padding: "18px 24px" }}>
        {/* top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#00d4ff,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-.02em" }}>Admin Panel</h1>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>OHM Trading Journal</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="action-btn" onClick={onBack} style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 10, padding: "8px 16px", color: "#00d4ff", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>← تطبيق</button>
            <button className="action-btn" onClick={() => logoutUser()} style={{ background: "rgba(255,51,102,0.1)", border: "1px solid rgba(255,51,102,0.25)", borderRadius: 10, padding: "8px 16px", color: "#ff3366", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>خروج</button>
          </div>
        </div>

        {/* KPI cards */}
        {!loading && clients.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
            {[
              { l: "العملاء", v: clients.length, i: "👥", c: "#00d4ff" },
              { l: "Elite", v: eliteCount, i: "🏆", c: "#ffd700" },
              { l: "متوسط Score", v: avgScore, i: "⚡", c: "#a855f7" },
              { l: "متوسط WR", v: avgWR + "%", i: "🎯", c: "#00ff87" },
              { l: "إجمالي PnL", v: "$" + totalPnl.toFixed(0), i: "💰", c: totalPnl >= 0 ? "#00ff87" : "#ff3366" },
            ].map(({ l, v, i, c }) => (
              <div key={l} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${c}20`, borderRadius: 14, padding: "12px 14px", textAlign: "center" }}>
                <p style={{ fontSize: 16, marginBottom: 4 }}>{i}</p>
                <p style={{ fontSize: 20, fontWeight: 900, color: c, fontFamily: "'Space Grotesk', monospace", lineHeight: 1 }}>{v}</p>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 4 }}>{l}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEARCH + SORT */}
      <div style={{ padding: "14px 24px 0", background: "rgba(0,0,0,0.2)" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ابحث باسم أو إيميل..."
          style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "11px 16px", color: "#fff", fontSize: 13, fontFamily: "inherit", transition: "border .2s" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10, paddingBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          {[["score", "⚡ Score"], ["wr", "🎯 Win Rate"], ["trades", "📊 الصفقات"], ["name", "🔤 الاسم"]].map(([k, l]) => (
            <button key={k} className="sort-btn" onClick={() => setSort(k)}
              style={{ background: sort === k ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)", color: sort === k ? "#00d4ff" : "rgba(255,255,255,0.4)", border: `1px solid ${sort === k ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
              {l}
            </button>
          ))}
          <button className="sort-btn" onClick={loadClients}
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontFamily: "inherit", marginRight: "auto" }}>
            🔄 تحديث
          </button>
          <div style={{ display: "flex", gap: 4 }}>
            {[["grid", "⊞"], ["list", "☰"]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)}
                style={{ background: view === v ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)", color: view === v ? "#00d4ff" : "rgba(255,255,255,0.4)", border: `1px solid ${view === v ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 8, padding: "6px 10px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "16px 24px 60px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(0,212,255,0.1)", borderTopColor: "#00d4ff", animation: "spin .7s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, animation: "pulse 1.5s infinite" }}>جاري تحميل البيانات...</p>
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(255,51,102,0.08)", border: "1px solid rgba(255,51,102,0.2)", borderRadius: 12, padding: "14px 18px", color: "#ff3366", fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <p style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", padding: 50, fontSize: 15 }}>لا توجد نتائج</p>
        )}

        {/* GRID VIEW */}
        {view === "grid" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
            {filtered.map((c, idx) => {
              const sc = c.score >= 70 ? "#00ff87" : c.score >= 45 ? "#ffd700" : "#ff3366";
              return (
                <div key={c.uid} className="client-card" onClick={() => setSelected(c)}
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "18px", overflow: "hidden", position: "relative", animation: `fadeUp .3s ease ${idx * 0.05}s both` }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${sc},transparent)` }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg,${sc}30,${sc}10)`, border: `1.5px solid ${sc}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: sc, flexShrink: 0 }}>
                        {(c.name || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{c.name}</p>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{c.email}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ position: "relative", width: 48, height: 48 }}>
                        <ScoreRing score={c.score} size={48} />
                        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 11, fontWeight: 900, color: sc, fontFamily: "'Space Grotesk', monospace" }}>{c.score}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {[
                      { l: "WR", v: c.wr + "%", c: c.wr >= 60 ? "#00ff87" : c.wr >= 40 ? "#ffd700" : "#ff3366" },
                      { l: "صفقة", v: c.count, c: "#00d4ff" },
                      { l: "RR", v: c.avgRR + ":1", c: "#a855f7" },
                    ].map(({ l, v, c: col }) => (
                      <div key={l} style={{ background: col + "0a", border: `1px solid ${col}18`, borderRadius: 10, padding: "7px 8px", textAlign: "center" }}>
                        <p style={{ fontSize: 8, color: col + "80", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>{l}</p>
                        <p style={{ fontSize: 15, fontWeight: 900, color: col, fontFamily: "'Space Grotesk', monospace" }}>{v}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Sparkline trades={c.trades} />
                    {c.createdAt && <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>📅 {c.createdAt.toLocaleDateString("ar")}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW */}
        {view === "list" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((c, idx) => {
              const sc = c.score >= 70 ? "#00ff87" : c.score >= 45 ? "#ffd700" : "#ff3366";
              return (
                <div key={c.uid} className="client-card" onClick={() => setSelected(c)}
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, animation: `fadeUp .2s ease ${idx * 0.03}s both` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${sc}18`, border: `1.5px solid ${sc}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, color: sc, flexShrink: 0 }}>
                    {(c.name || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{c.email}</p>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}><p style={{ fontSize: 14, fontWeight: 900, color: sc, fontFamily: "'Space Grotesk', monospace" }}>{c.score}</p><p style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Score</p></div>
                    <div style={{ textAlign: "center" }}><p style={{ fontSize: 14, fontWeight: 900, color: c.wr >= 60 ? "#00ff87" : c.wr >= 40 ? "#ffd700" : "#ff3366", fontFamily: "'Space Grotesk', monospace" }}>{c.wr}%</p><p style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>WR</p></div>
                    <div style={{ textAlign: "center" }}><p style={{ fontSize: 14, fontWeight: 900, color: "#00d4ff", fontFamily: "'Space Grotesk', monospace" }}>{c.count}</p><p style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>صفقة</p></div>
                    <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>›</div>
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
