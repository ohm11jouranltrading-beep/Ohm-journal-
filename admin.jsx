import { useState, useEffect } from "react";
import { db, auth, logoutUser } from "./firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

// ═══════════════════════════════════════════════
//  ADMIN EMAILS — أضف إيميلك هنا
// ═══════════════════════════════════════════════
const ADMIN_EMAILS = [
  "ohm.1.1jouranltrading@gmail.com", // غيّر هذا لإيميلك
];

function isAdmin(user) {
  return user && ADMIN_EMAILS.includes(user.email);
}

function calcStats(trades = []) {
  if (!trades.length) return { score: 0, wr: 0, total: 0, count: 0, avgRR: 0, bestDay: null, worstDay: null };
  const wins = trades.filter(t => t.pnl > 0);
  const wr = Math.round((wins.length / trades.length) * 100);
  const total = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const avgRR = trades.filter(t => t.rr > 0).length
    ? (trades.filter(t => t.rr > 0).reduce((s, t) => s + t.rr, 0) / trades.filter(t => t.rr > 0).length).toFixed(1)
    : 0;
  // Best/worst day
  const byDay = {};
  trades.forEach(t => { byDay[t.date] = (byDay[t.date] || 0) + (t.pnl || 0); });
  const days = Object.entries(byDay).sort((a, b) => b[1] - a[1]);
  const bestDay = days[0] ? { date: days[0][0], pnl: days[0][1] } : null;
  const worstDay = days[days.length - 1] && days[days.length - 1][1] < 0 ? { date: days[days.length - 1][0], pnl: days[days.length - 1][1] } : null;
  // Score
  const gl = Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0)) || 1;
  const gp = wins.reduce((s, t) => s + t.pnl, 0);
  const mist = trades.reduce((s, t) => s + (t.mistakes?.length || 0), 0);
  const score = Math.round((wins.length / trades.length) * 30 + (Math.min(gp / gl, 3) / 3) * 30 + Math.min(Number(avgRR) / 1.5, 1) * 20 + Math.max(0, 20 - mist * 5));
  return { score, wr, total, count: trades.length, avgRR, bestDay, worstDay };
}

function ScoreBadge({ score }) {
  const col = score >= 70 ? "#22c55e" : score >= 45 ? "#f59e0b" : "#ef4444";
  const lbl = score >= 70 ? "Elite" : score >= 45 ? "Good" : "Weak";
  return (
    <span style={{ background: col + "22", color: col, border: `1px solid ${col}44`, borderRadius: 8, padding: "2px 10px", fontSize: 12, fontWeight: 800 }}>
      {score} · {lbl}
    </span>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div style={{ background: color + "15", borderRadius: 10, padding: "6px 12px", border: `1px solid ${color}30`, textAlign: "center", minWidth: 70 }}>
      <p style={{ fontSize: 9, color: color + "99", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 900, color }}>{value}</p>
    </div>
  );
}

export default function AdminPage({ user, onBack }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("score"); // score | wr | trades | name
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  // Check admin
  if (!isAdmin(user)) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 48 }}>🚫</div>
        <p style={{ color: "#ef4444", fontSize: 18, fontWeight: 800, fontFamily: "sans-serif" }}>غير مصرح لك بالدخول</p>
        <button onClick={onBack} style={{ background: "#1c2333", color: "#8b949e", border: "1px solid #30363d", borderRadius: 10, padding: "8px 20px", cursor: "pointer", fontFamily: "sans-serif" }}>رجوع</button>
      </div>
    );
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const list = [];
      snap.forEach(doc => {
        const d = doc.data();
        const stats = calcStats(d.trades || []);
        list.push({
          uid: doc.id,
          name: d.name || "بدون اسم",
          email: d.email || "",
          createdAt: d.createdAt?.toDate?.() || null,
          trades: d.trades || [],
          ...stats,
        });
      });
      setClients(list);
    } catch (e) {
      setError("خطأ في تحميل البيانات: " + e.message);
    }
    setLoading(false);
  }

  const filtered = clients
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "score") return b.score - a.score;
      if (sort === "wr") return b.wr - a.wr;
      if (sort === "trades") return b.count - a.count;
      if (sort === "name") return a.name.localeCompare(b.name);
      return 0;
    });

  const G = "#22c55e", BLU = "#38bdf8", PRP = "#a78bfa", ORG = "#f59e0b", RED = "#ef4444";

  // Client detail view
  if (selected) {
    const c = selected;
    const recentTrades = [...c.trades].sort((a, b) => b.date?.localeCompare(a.date)).slice(0, 10);
    const bySetup = {};
    c.trades.forEach(t => { if (t.setup) bySetup[t.setup] = (bySetup[t.setup] || 0) + 1; });
    const topSetups = Object.entries(bySetup).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const mistakes = {};
    c.trades.forEach(t => t.mistakes?.forEach(m => { mistakes[m] = (mistakes[m] || 0) + 1; }));
    const topMistakes = Object.entries(mistakes).sort((a, b) => b[1] - a[1]).slice(0, 3);

    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "sans-serif", padding: "20px 16px 40px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => setSelected(null)} style={{ background: "#1c2333", border: "1px solid #30363d", borderRadius: 10, padding: "8px 14px", color: "#8b949e", cursor: "pointer", fontFamily: "sans-serif", fontSize: 13 }}>← رجوع</button>
          <div>
            <p style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{c.name}</p>
            <p style={{ fontSize: 12, color: "#8b949e", marginTop: 3 }}>{c.email}</p>
          </div>
          <ScoreBadge score={c.score} />
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Ohm Score", value: c.score, color: c.score >= 70 ? G : c.score >= 45 ? ORG : RED },
            { label: "Win Rate", value: c.wr + "%", color: c.wr >= 60 ? G : c.wr >= 40 ? ORG : RED },
            { label: "الصفقات", value: c.count, color: BLU },
            { label: "Avg RR", value: c.avgRR + ":1", color: PRP },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#161b22", borderRadius: 14, padding: "14px 16px", border: "1px solid #21262d" }}>
              <p style={{ fontSize: 10, color: "#6e7681", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>{label}</p>
              <p style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Best/Worst day */}
        {(c.bestDay || c.worstDay) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {c.bestDay && (
              <div style={{ background: "#022c22", borderRadius: 14, padding: "12px 14px", border: "1px solid #22c55e33" }}>
                <p style={{ fontSize: 10, color: G + "88", fontWeight: 700, marginBottom: 4 }}>🏆 أفضل يوم</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: G }}>+${c.bestDay.pnl}</p>
                <p style={{ fontSize: 10, color: "#6e7681" }}>{c.bestDay.date}</p>
              </div>
            )}
            {c.worstDay && (
              <div style={{ background: "#1a0205", borderRadius: 14, padding: "12px 14px", border: "1px solid #ef444433" }}>
                <p style={{ fontSize: 10, color: RED + "88", fontWeight: 700, marginBottom: 4 }}>📉 أسوأ يوم</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: RED }}>${c.worstDay.pnl}</p>
                <p style={{ fontSize: 10, color: "#6e7681" }}>{c.worstDay.date}</p>
              </div>
            )}
          </div>
        )}

        {/* Top setups */}
        {topSetups.length > 0 && (
          <div style={{ background: "#161b22", borderRadius: 14, padding: "14px 16px", border: "1px solid #21262d", marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "#8b949e", fontWeight: 700, marginBottom: 10 }}>🎯 أبرز الإعدادات</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {topSetups.map(([s, n]) => (
                <span key={s} style={{ background: PRP + "22", color: PRP, border: `1px solid ${PRP}44`, borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{s} ({n})</span>
              ))}
            </div>
          </div>
        )}

        {/* Top mistakes */}
        {topMistakes.length > 0 && (
          <div style={{ background: "#161b22", borderRadius: 14, padding: "14px 16px", border: "1px solid #21262d", marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "#8b949e", fontWeight: 700, marginBottom: 10 }}>⚠️ أبرز الأخطاء</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {topMistakes.map(([m, n]) => (
                <span key={m} style={{ background: RED + "22", color: RED, border: `1px solid ${RED}44`, borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{m} ({n}x)</span>
              ))}
            </div>
          </div>
        )}

        {/* Recent trades */}
        <div style={{ background: "#161b22", borderRadius: 14, padding: "14px 16px", border: "1px solid #21262d" }}>
          <p style={{ fontSize: 11, color: "#8b949e", fontWeight: 700, marginBottom: 12 }}>📋 آخر الصفقات</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentTrades.length === 0 && <p style={{ color: "#6e7681", fontSize: 12 }}>لا توجد صفقات</p>}
            {recentTrades.map((t, i) => {
              const isW = t.pnl >= 0;
              const col = isW ? G : RED;
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, background: isW ? "#022c2222" : "#1a020522", border: `1px solid ${col}22` }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#e6edf3" }}>{t.symbol}</p>
                    <p style={{ fontSize: 10, color: "#6e7681" }}>{t.date} · {t.direction === "L" ? "LONG" : "SHORT"} · {t.grade || "—"}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 14, fontWeight: 900, color: col }}>{isW ? "+" : ""}${t.pnl}</p>
                    <p style={{ fontSize: 10, color: "#6e7681" }}>RR {t.rr || 0}:1</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#161b22", borderBottom: "1px solid #21262d", padding: "16px 16px 14px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 900, background: "linear-gradient(135deg,#6366f1,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🛡️ Admin Panel</p>
            <p style={{ fontSize: 11, color: "#6e7681", marginTop: 2 }}>{clients.length} عميل مسجل</p>
          </div>
          <button onClick={() => { logoutUser(); onBack(); }} style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444433", borderRadius: 10, padding: "7px 14px", cursor: "pointer", fontFamily: "sans-serif", fontSize: 12, fontWeight: 700 }}>خروج</button>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ابحث باسم أو إيميل..."
          style={{ width: "100%", background: "#0d1117", border: "1px solid #30363d", borderRadius: 10, padding: "9px 12px", color: "#e6edf3", fontSize: 13, fontFamily: "sans-serif", outline: "none", boxSizing: "border-box" }}
        />

        {/* Sort */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {[["score", "Score"], ["wr", "Win Rate"], ["trades", "الصفقات"], ["name", "الاسم"]].map(([k, l]) => (
            <button key={k} onClick={() => setSort(k)} style={{
              background: sort === k ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#1c2333",
              color: sort === k ? "#fff" : "#8b949e",
              border: `1px solid ${sort === k ? "#6366f1" : "#30363d"}`,
              borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "sans-serif"
            }}>{l}</button>
          ))}
          <button onClick={loadClients} style={{ background: "#1c2333", color: "#8b949e", border: "1px solid #30363d", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "sans-serif", marginLeft: "auto" }}>🔄 تحديث</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "16px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #21262d", borderTopColor: "#6366f1", animation: "spin .7s linear infinite", margin: "0 auto 12px" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{ color: "#6e7681", fontSize: 13 }}>جاري تحميل البيانات...</p>
          </div>
        )}

        {error && <p style={{ color: "#ef4444", fontSize: 13, textAlign: "center", padding: 20 }}>{error}</p>}

        {/* Summary cards */}
        {!loading && clients.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
            {[
              { label: "العملاء", value: clients.length, color: BLU },
              { label: "متوسط Score", value: Math.round(clients.reduce((s, c) => s + c.score, 0) / clients.length), color: PRP },
              { label: "متوسط WR", value: Math.round(clients.reduce((s, c) => s + c.wr, 0) / clients.length) + "%", color: G },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#161b22", borderRadius: 12, padding: "12px 10px", border: "1px solid #21262d", textAlign: "center" }}>
                <p style={{ fontSize: 9, color: "#6e7681", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 22, fontWeight: 900, color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Client list */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length === 0 && <p style={{ color: "#6e7681", textAlign: "center", padding: 20, fontSize: 13 }}>لا توجد نتائج</p>}
            {filtered.map(c => (
              <div key={c.uid} onClick={() => setSelected(c)} style={{
                background: "#161b22", borderRadius: 16, padding: "14px 16px",
                border: "1px solid #21262d", cursor: "pointer", transition: "all .2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f144"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#21262d"; e.currentTarget.style.transform = ""; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#e6edf3", lineHeight: 1 }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: "#6e7681", marginTop: 3 }}>{c.email}</p>
                    {c.createdAt && <p style={{ fontSize: 10, color: "#6e7681", marginTop: 2 }}>انضم: {c.createdAt.toLocaleDateString("ar")}</p>}
                  </div>
                  <ScoreBadge score={c.score} />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <StatChip label="Win Rate" value={c.wr + "%"} color={c.wr >= 60 ? G : c.wr >= 40 ? ORG : RED} />
                  <StatChip label="الصفقات" value={c.count} color={BLU} />
                  <StatChip label="Avg RR" value={c.avgRR + ":1"} color={PRP} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
