// pages/executive.js — Executive Dashboard v3: Decision-First UX
import { useEffect, useState } from "react";
import Layout from "../components/Layout";

// ── AI SCORE MEDAL HELPER ─────────────────────────────────────────────────────
function getMedal(rank) {
  return rank === 0 ? "🥇" : rank === 1 ? "🥈" : "🥉";
}
function getScoreColor(score) {
  return score >= 85 ? "#16a34a" : score >= 65 ? "#b45309" : "#dc2626";
}

// ── FORECAST INTERPRETATION TABLE ─────────────────────────────────────────────
const FORECAST_INTERP = {
  stable:   { icon: "✅", label: "No Action Required",     desc: "สถานการณ์ทรงตัว คาดไม่มีเหตุผิดปกติ",      color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  rising:   { icon: "⚠️", label: "Monitor & Pre-position", desc: "แนวโน้มเพิ่มขึ้น — เตรียมทรัพยากรสำรอง",  color: "#b45309", bg: "#fef9c3", border: "#fcd34d" },
  critical: { icon: "🚨", label: "Immediate Action",       desc: "ต้องดำเนินการทันทีเพื่อป้องกันวิกฤต",       color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
};

// ── DEPT STATUS PER SCENARIO ──────────────────────────────────────────────────
const DEPT_STATUS_MAP = {
  Normal:   {
    clean:  { icon: "🧹", label: "Cleanliness", score: 92, status: "Normal",   color: "#16a34a", bg: "#f0fdf4", alert: "0 Critical" },
    sec:    { icon: "🛡️", label: "Security",    score: 88, status: "Normal",   color: "#16a34a", bg: "#f0fdf4", alert: "0 Critical" },
    maint:  { icon: "🔧", label: "Maintenance", score: 95, status: "Normal",   color: "#16a34a", bg: "#f0fdf4", alert: "0 Critical" },
  },
  Busy:     {
    clean:  { icon: "🧹", label: "Cleanliness", score: 74, status: "Warning",  color: "#b45309", bg: "#fef9c3", alert: "1 Warning" },
    sec:    { icon: "🛡️", label: "Security",    score: 65, status: "Critical", color: "#dc2626", bg: "#fef2f2", alert: "1 Critical — Queue 32 min" },
    maint:  { icon: "🔧", label: "Maintenance", score: 82, status: "Warning",  color: "#b45309", bg: "#fef9c3", alert: "1 Warning" },
  },
  Festival: {
    clean:  { icon: "🧹", label: "Cleanliness", score: 52, status: "Critical", color: "#dc2626", bg: "#fef2f2", alert: "2 Critical — Overflow Zone C" },
    sec:    { icon: "🛡️", label: "Security",    score: 48, status: "Critical", color: "#dc2626", bg: "#fef2f2", alert: "1 Critical — Gate Jam" },
    maint:  { icon: "🔧", label: "Maintenance", score: 60, status: "Critical", color: "#dc2626", bg: "#fef2f2", alert: "1 Critical — Motor 92°C" },
  },
};

// ── EXECUTIVE ACTION TEXT PER SCENARIO ───────────────────────────────────────
const EXEC_ACTION_MAP = {
  Normal:   { action: "ไม่มีวาระเร่งด่วน", sub: "ตลาดอยู่ในระดับ Excellent — ติดตาม PM ตามแผน", urgency: "none", riskReduction: null, eta: null },
  Busy:     { action: "อนุมัติเปิด Gate 3 เพิ่มเติม", sub: "ลดคิวรถจาก 32 นาที → 12 นาที ภายใน 15 นาที", urgency: "warning", riskReduction: "95%", eta: "15 นาที" },
  Festival: { action: "อนุมัติสลับใช้ปั๊มสำรอง + เพิ่มรอบเก็บขยะฉุกเฉิน", sub: "หากล่าช้าเกิน 30 นาที จะกระทบผู้ค้า 18 แผงค้า", urgency: "critical", riskReduction: "97%", eta: "5–40 นาที" },
};

export default function Executive() {
  const [dashboardData, setDashboardData]   = useState(null);
  const [loading, setLoading]               = useState(true);
  const [activeScenario, setActiveScenario] = useState("Normal");

  // Modals & Progressive Disclosure
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [governingKpi, setGoverningKpi]         = useState(null);
  const [showLearningLogs, setShowLearningLogs] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState({});

  useEffect(() => { fetchDashboard(activeScenario); }, [activeScenario]);

  const fetchDashboard = async (scenario) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/dashboard?scenario=${scenario}`);
      const text = await res.text();
      try { setDashboardData(JSON.parse(text)); }
      catch { console.error("Dashboard non-JSON:", text.slice(0, 200)); }
    } catch (err) { console.error("fetchDashboard error:", err); }
    finally { setLoading(false); }
  };

  const handleDecision = async (insightId, optionId) => {
    const res = await fetch(`/api/decisions/${insightId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }),
    });
    if (res.ok) fetchDashboard(activeScenario);
  };

  const handleApproveRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/supervisor/request/${requestId}/approve`, { method: "POST" });
      if (res.ok) fetchDashboard(activeScenario);
    } catch (err) { console.error("handleApproveRequest error:", err); }
  };

  const toggleInsightDetail = (id) =>
    setExpandedInsights(prev => ({ ...prev, [id]: !prev[id] }));

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading || !dashboardData) {
    return (
      <Layout>
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🧠</div>
          <p style={{ color: "var(--ink-soft)" }}>AI Engine Syncing...</p>
        </div>
      </Layout>
    );
  }

  // ── SCENARIO COMPUTED VALUES ──────────────────────────────────────────────
  let emergencyBudgetUsed = "15,000";
  let vendorComplaints    = 0;
  let customerComplaints  = 1;

  if (activeScenario === "Busy")    { emergencyBudgetUsed = "40,000";  vendorComplaints = 2;  customerComplaints = 4; }
  if (activeScenario === "Festival"){ emergencyBudgetUsed = "120,000"; vendorComplaints = 7;  customerComplaints = 12; }

  const criticalCount  = dashboardData.activeInsights.length;
  const pendingCount   = (dashboardData.supervisorRequests || []).filter(r => r.status === "Pending").length;
  const slaValue       = dashboardData.sla?.compliance ?? 95;
  const healthScore    = dashboardData.health.score;
  const healthLabel    = dashboardData.health.scoreLabel;
  const healthColor    = dashboardData.health.color;
  const totalComplaints = vendorComplaints + customerComplaints;
  const deptSt         = DEPT_STATUS_MAP[activeScenario] ?? DEPT_STATUS_MAP.Normal;
  const execAction     = EXEC_ACTION_MAP[activeScenario] ?? EXEC_ACTION_MAP.Normal;
  const pf             = dashboardData.predictiveForecast;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:24, flexWrap:"wrap", gap:16 }}>
        <div>
          <p className="eyebrow" style={{ color:"var(--red)", fontWeight:700, letterSpacing:"2px" }}>MARKET INTELLIGENCE CENTER</p>
          <h1 style={{ fontSize:"2.2rem", margin:"6px 0" }}>🧠 Executive Market Intelligence Center</h1>
          <p style={{ opacity:0.7, fontSize:"0.95rem", margin:0 }}>AI-Powered Decision Support · {new Date().toLocaleDateString("th-TH", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <button className="btn" style={{ background:"#4f46e5", color:"#fff", border:"none", padding:"9px 14px", fontWeight:700, fontSize:"0.85rem" }}
            onClick={() => setShowLearningLogs(true)}>🤖 AI Feedback Logs</button>
          <div style={{ background:"#fff", padding:"8px 14px", borderRadius:8, border:"1px solid var(--line)", display:"flex", alignItems:"center", gap:10 }}>
            <strong style={{ fontSize:"0.82rem", color:"var(--ink-soft)" }}>จำลองสถานการณ์:</strong>
            <select value={activeScenario} onChange={e => setActiveScenario(e.target.value)}
              style={{ padding:"5px 10px", borderRadius:4, border:"1px solid var(--blue)", fontWeight:700, color:"var(--blue)" }}>
              <option value="Normal">☀️ Normal Day</option>
              <option value="Busy">🛒 Busy Market Day</option>
              <option value="Festival">🎊 Festival Day (Peak)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          1. EXECUTIVE DECISION SUMMARY (replaces Morning Brief)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="card" style={{ background:"linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0c1a2e 100%)", color:"#fff", border:"none", padding:"28px 32px", marginBottom:24, boxShadow:"0 20px 40px rgba(0,0,0,0.2)" }}>
        {/* Header row */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:"1.4rem" }}>⛅</span>
            <strong style={{ color:"#818cf8", fontSize:"0.82rem", letterSpacing:"2px" }}>EXECUTIVE DECISION SUMMARY</strong>
          </div>
          <span style={{ background:"rgba(167,139,250,0.18)", color:"#c4b5fd", fontSize:"0.7rem", fontWeight:700, padding:"4px 12px", borderRadius:99, border:"1px solid rgba(167,139,250,0.3)", letterSpacing:"1px" }}>
            📝 GENERATIVE AI — Template-Based
          </span>
        </div>

        {/* 3 KPI pillars */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16, marginBottom:20 }}>
          {/* Market Health */}
          <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"16px 18px", borderTop:`3px solid ${healthColor}` }}>
            <div style={{ fontSize:"0.7rem", color:"#94a3b8", fontWeight:700, marginBottom:6 }}>🟢 MARKET HEALTH</div>
            <div style={{ fontSize:"2rem", fontWeight:800, color:"#fff" }}>{healthScore}</div>
            <div style={{ fontSize:"0.78rem", color:healthColor, fontWeight:700, background:healthColor+"22", padding:"2px 8px", borderRadius:99, display:"inline-block", marginTop:4 }}>{healthLabel}</div>
          </div>
          {/* Critical Decisions */}
          <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"16px 18px", borderTop:`3px solid ${criticalCount > 0 ? "#ef4444" : "#10b981"}` }}>
            <div style={{ fontSize:"0.7rem", color:"#94a3b8", fontWeight:700, marginBottom:6 }}>⚠️ CRITICAL DECISIONS</div>
            <div style={{ fontSize:"2rem", fontWeight:800, color: criticalCount > 0 ? "#f87171" : "#34d399" }}>{criticalCount}</div>
            <div style={{ fontSize:"0.78rem", color:"#94a3b8", marginTop:4 }}>รายการรอสั่งการ</div>
          </div>
          {/* Forecast */}
          <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"16px 18px", borderTop:`3px solid #a78bfa` }}>
            <div style={{ fontSize:"0.7rem", color:"#94a3b8", fontWeight:700, marginBottom:6 }}>🔮 FORECAST (2 ชม.)</div>
            <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#c4b5fd", lineHeight:1.3 }}>
              {pf ? `Waste ${pf.waste.delta}` : "N/A"}
            </div>
            <div style={{ fontSize:"0.75rem", color:"#94a3b8", marginTop:4 }}>
              {pf ? `Traffic ${pf.traffic.delta}` : ""}
            </div>
          </div>
        </div>

        {/* Dept status row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10, marginBottom:20 }}>
          {Object.values(deptSt).map(d => (
            <div key={d.label} style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:"0.85rem", fontWeight:600, color:"#e2e8f0" }}>{d.icon} {d.label}</span>
              <span style={{ fontSize:"0.72rem", fontWeight:700, color:d.color, background:d.color+"22", padding:"2px 8px", borderRadius:99 }}>{d.status}</span>
            </div>
          ))}
        </div>

        {/* Executive Action */}
        <div style={{ background: execAction.urgency === "critical" ? "rgba(239,68,68,0.15)" : execAction.urgency === "warning" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)", borderRadius:10, padding:"14px 18px", border:`1px solid ${execAction.urgency === "critical" ? "rgba(239,68,68,0.4)" : execAction.urgency === "warning" ? "rgba(245,158,11,0.4)" : "rgba(16,185,129,0.4)"}` }}>
          <div style={{ fontSize:"0.7rem", color:"#94a3b8", fontWeight:700, marginBottom:6 }}>🎯 EXECUTIVE ACTION REQUIRED</div>
          <div style={{ fontSize:"1.05rem", fontWeight:700, color:"#fff", marginBottom:4 }}>{execAction.action}</div>
          <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ fontSize:"0.82rem", color:"#cbd5e1" }}>{execAction.sub}</span>
            {execAction.riskReduction && (
              <span style={{ fontSize:"0.78rem", fontWeight:700, color:"#34d399", background:"rgba(16,185,129,0.2)", padding:"2px 10px", borderRadius:99 }}>
                Risk Reduction: {execAction.riskReduction} · ETA: {execAction.eta}
              </span>
            )}
          </div>
        </div>
        <p style={{ margin:"10px 0 0 0", fontSize:"0.72rem", color:"#475569", fontStyle:"italic" }}>
          ⚠ Generative AI สรุปจากข้อมูลระบบเท่านั้น — ไม่สร้างตัวเลขใหม่โดยอิสระ
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. EXECUTIVE KPI STRIP (replaces 4-cards grid)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="card" style={{ padding:"16px 24px", marginBottom:24 }}>
        <div style={{ fontSize:"0.72rem", color:"var(--ink-soft)", fontWeight:700, letterSpacing:"1.5px", marginBottom:14 }}>📊 EXECUTIVE KPI OVERVIEW — TODAY</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:0 }}>
          {[
            { label:"Market Health",   value:`${healthScore}/100`, sub:healthLabel,           color:healthColor,  icon:"❤️" },
            { label:"Complaints",      value:totalComplaints,       sub:`${vendorComplaints} ผู้ค้า · ${customerComplaints} ลูกค้า`, color: totalComplaints > 5 ? "#dc2626" : "#b45309", icon:"📋" },
            { label:"Budget Used",     value:`฿${emergencyBudgetUsed}`, sub:"จากงบสำรอง 500K",   color:"#4f46e5",    icon:"💰" },
            { label:"Pending Decision",value:pendingCount,           sub:"รอการอนุมัติ",         color: pendingCount > 0 ? "#dc2626" : "#10b981", icon:"⚠️" },
            { label:"Critical Alert",  value:criticalCount,          sub:"Active Insights",     color: criticalCount > 0 ? "#dc2626" : "#10b981", icon:"🚨" },
            { label:"SLA Compliance",  value:`${slaValue}%`,        sub:"Response & Resolution",color: slaValue >= 90 ? "#10b981" : "#b45309",    icon:"✅" },
          ].map((kpi, i, arr) => (
            <div key={kpi.label} style={{ padding:"12px 16px", borderRight: i < arr.length-1 ? "1px solid var(--line)" : "none", textAlign:"center" }}>
              <div style={{ fontSize:"1.2rem", marginBottom:4 }}>{kpi.icon}</div>
              <div style={{ fontSize:"0.68rem", color:"var(--ink-soft)", fontWeight:700, letterSpacing:"0.5px", marginBottom:4 }}>{kpi.label.toUpperCase()}</div>
              <div style={{ fontSize:"1.5rem", fontWeight:800, color:kpi.color, lineHeight:1 }}>{kpi.value}</div>
              <div style={{ fontSize:"0.68rem", color:"var(--ink-soft)", marginTop:4 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          3. MOIL FRAMEWORK BAR
          ══════════════════════════════════════════════════════════════════ */}
      <div className="card" style={{ background:"#f8fafc", border:"1px solid #cbd5e1", marginBottom:24, padding:"14px 20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <strong style={{ fontSize:"0.78rem", color:"#4f46e5", letterSpacing:"1.5px" }}>ACADEMIC FRAMEWORK: MOIL (Market Operations Intelligence Loop)</strong>
          <span style={{ fontSize:"0.72rem", background:"#e0e7ff", color:"#4f46e5", padding:"2px 8px", borderRadius:4, fontWeight:700 }}>Closed-loop DSS</span>
        </div>
        <div className="moil-steps-flow">
          {[
            { step:1, label:"Collect", active:true },
            { step:2, label:"Monitor", active:true },
            { step:3, label:"Evaluate", active:true },
            { step:4, label:"Detect", active:true },
            { step:5, label:"Recommend", active:true },
            { step:6, label:"Decide", active: criticalCount > 0 },
            { step:7, label:"Execute", active:false },
            { step:8, label:"Outcome", active: (dashboardData.resolvedIncidents?.length ?? 0) > 0 },
          ].map((st, i) => (
            <div key={st.label} style={{ display:"flex", alignItems:"center", flex:1 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{ width:22, height:22, borderRadius:"50%", background: st.active ? "#4f46e5" : "#94a3b8", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.7rem", fontWeight:700 }}>{st.step}</div>
                <span style={{ fontSize:"0.68rem", fontWeight:600, color: st.active ? "#4f46e5" : "#64748b", marginTop:3 }}>{st.label}</span>
              </div>
              {i < 7 && <div style={{ flex:1, height:2, background: st.active ? "#4f46e5" : "#cbd5e1", margin:"0 6px", alignSelf:"center", transform:"translateY(-9px)" }} />}
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          4. DEPARTMENT PORTFOLIO CARDS (replaces table)
          ══════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:"1.3rem", color:"var(--dark)", marginBottom:14 }}>🏢 Department Health Portfolio</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16 }}>
          {Object.values(deptSt).map(dept => {
            const isCrit = dept.status === "Critical";
            const isWarn = dept.status === "Warning";
            return (
              <div key={dept.label} className="card" style={{ borderTop:`4px solid ${dept.color}`, background: isCrit ? "#fef2f2" : isWarn ? "#fffbeb" : "#f0fdf4", padding:"20px 24px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <span style={{ fontSize:"2rem" }}>{dept.icon}</span>
                  <span style={{ fontSize:"0.72rem", fontWeight:700, color:dept.color, background:dept.color+"22", padding:"3px 10px", borderRadius:99, border:`1px solid ${dept.color}44` }}>
                    {isCrit ? "🔴" : isWarn ? "⚠️" : "✅"} {dept.status}
                  </span>
                </div>
                <div style={{ fontSize:"1rem", fontWeight:700, color:"var(--dark)", marginBottom:4 }}>{dept.label}</div>
                <div style={{ fontSize:"2.2rem", fontWeight:800, color:dept.color, lineHeight:1, marginBottom:8 }}>{dept.score}<span style={{ fontSize:"1rem", fontWeight:500, color:"var(--ink-soft)" }}>/100</span></div>
                {/* Mini health bar */}
                <div style={{ height:6, background:"#e2e8f0", borderRadius:99, marginBottom:10, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${dept.score}%`, background:dept.color, borderRadius:99 }} />
                </div>
                <div style={{ fontSize:"0.8rem", color: isCrit ? "#dc2626" : isWarn ? "#b45309" : "#16a34a", fontWeight:600 }}>
                  {dept.alert}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          5. PREDICTIVE AI FORECAST + "SO WHAT"
          ══════════════════════════════════════════════════════════════════ */}
      {pf && (() => {
        const cards = [
          { icon:"🗑️", label:"Waste Overflow Forecast", dept:"ฝ่ายรักษาความสะอาด",
            current:`${pf.waste.currentPct}%`, forecast:`${pf.waste.forecastPct}%`,
            delta:pf.waste.delta, trend:pf.waste.trend, confidence:pf.waste.confidence, timeframe:pf.waste.timeframe,
            actionMsg: pf.waste.trend === "critical" ? "ส่งรถเก็บขยะเสริมก่อนระดับเกิน 95%" : pf.waste.trend === "rising" ? "เตรียมรถสำรองพร้อมใช้งาน" : "ไม่ต้องดำเนินการเพิ่มเติม" },
          { icon:"🚦", label:"Traffic Queue Forecast", dept:"ฝ่ายความปลอดภัย",
            current:`${pf.traffic.currentMin} นาที`, forecast:`${pf.traffic.forecastMin} นาที`,
            delta:pf.traffic.delta, trend:pf.traffic.trend, confidence:pf.traffic.confidence, timeframe:pf.traffic.timeframe,
            actionMsg: pf.traffic.trend === "critical" ? "เปิด Gate สำรองทันที ก่อนคิวเกิน 45 นาที" : pf.traffic.trend === "rising" ? "แจ้งเตรียมเจ้าหน้าที่เสริม Gate" : "ไม่ต้องดำเนินการเพิ่มเติม" },
          { icon:"🔩", label:"Equipment Temperature Forecast", dept:"ฝ่ายซ่อมบำรุง",
            current:`${pf.equipment.currentTemp}°C`, forecast:`${pf.equipment.forecastTemp}°C`,
            delta:pf.equipment.delta, trend:pf.equipment.trend, confidence:pf.equipment.confidence, timeframe:pf.equipment.timeframe,
            actionMsg: pf.equipment.trend === "critical" ? "สลับใช้ปั๊มสำรองก่อนอุณหภูมิเกิน 95°C" : pf.equipment.trend === "rising" ? "ตรวจสอบระบบระบายความร้อน" : "ติดตาม PM ตามแผนปกติ" },
        ];
        const tc = (t) => t === "critical" ? "#dc2626" : t === "rising" ? "#f59e0b" : "#10b981";
        return (
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <h2 style={{ margin:0, fontSize:"1.3rem", color:"var(--dark)" }}>🔮 Predictive AI Forecast</h2>
              <span style={{ fontSize:"0.7rem", fontWeight:700, color:"#7c3aed", background:"#ede9fe", padding:"4px 12px", borderRadius:99 }}>🔮 PREDICTIVE AI — Scenario Simulation</span>
            </div>
            <div style={{ background:"#faf5ff", border:"1px solid #ddd6fe", borderRadius:8, padding:"8px 14px", marginBottom:12, fontSize:"0.78rem", color:"#6d28d9" }}>
              📊 {pf.basis} · Scenario: <strong>{pf.scenario}</strong> · Generated: {pf.generatedAt}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16 }}>
              {cards.map(card => {
                const interp = FORECAST_INTERP[card.trend] ?? FORECAST_INTERP.stable;
                return (
                  <div key={card.label} className="card" style={{ border:`1px solid ${interp.border}`, borderTop:`4px solid ${tc(card.trend)}`, padding:"18px 20px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                      <div>
                        <div style={{ fontSize:"1.5rem" }}>{card.icon}</div>
                        <div style={{ fontSize:"0.68rem", color:"var(--ink-soft)", fontWeight:700 }}>{card.dept}</div>
                        <div style={{ fontSize:"0.82rem", fontWeight:600, color:"var(--dark)" }}>{card.label}</div>
                      </div>
                      <div style={{ fontSize:"0.78rem", fontWeight:700, color:tc(card.trend), background:tc(card.trend)+"18", padding:"3px 8px", borderRadius:99, height:"fit-content" }}>{card.delta}</div>
                    </div>

                    {/* Current → Forecast */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:"0.65rem", color:"var(--ink-soft)", fontWeight:600 }}>ตอนนี้</div>
                        <div style={{ fontSize:"1.3rem", fontWeight:800, color:"var(--dark)" }}>{card.current}</div>
                      </div>
                      <div style={{ fontSize:"1.2rem", color:tc(card.trend) }}>→</div>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:"0.65rem", color:"var(--ink-soft)", fontWeight:600 }}>Forecast ({card.timeframe})</div>
                        <div style={{ fontSize:"1.3rem", fontWeight:800, color:tc(card.trend) }}>{card.forecast}</div>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div style={{ height:4, background:"#e2e8f0", borderRadius:99, marginBottom:10, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${card.confidence}%`, background:tc(card.trend), borderRadius:99 }} />
                    </div>
                    <div style={{ fontSize:"0.68rem", color:"var(--ink-soft)", marginBottom:10 }}>Confidence: <strong>{card.confidence}%</strong></div>

                    {/* ── SO WHAT — AI Interpretation ── */}
                    <div style={{ background:interp.bg, border:`1px solid ${interp.border}`, borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:"0.68rem", color:"var(--ink-soft)", fontWeight:700, marginBottom:4 }}>🧠 AI INTERPRETATION</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                        <span style={{ fontSize:"0.9rem" }}>{interp.icon}</span>
                        <strong style={{ fontSize:"0.8rem", color:interp.color }}>{interp.label}</strong>
                      </div>
                      <div style={{ fontSize:"0.75rem", color:"var(--ink-soft)", marginBottom:6 }}>{interp.desc}</div>
                      <div style={{ fontSize:"0.78rem", fontWeight:700, color:interp.color }}>→ {card.actionMsg}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          6. CRITICAL DECISIONS + AI RANKING + BUSINESS IMPACT BADGES
          ══════════════════════════════════════════════════════════════════ */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <h2 style={{ fontFamily:"var(--font-display)", color:"var(--dark)", margin:0, fontSize:"1.5rem" }}>
          🚨 วาระรอการสั่งการของคณะผู้บริหาร
        </h2>
        <span style={{ fontSize:"0.7rem", fontWeight:700, color:"#0369a1", background:"#e0f2fe", padding:"5px 12px", borderRadius:99, border:"1px solid #bae6fd" }}>
          🧩 ANALYTICAL AI — Real-Time Situation Analysis
        </span>
      </div>

      {dashboardData.activeInsights.length === 0 ? (
        <div className="card" style={{ textAlign:"center", padding:"48px 20px", background:"#f8fafc", marginBottom:24 }}>
          <span style={{ fontSize:"2.5rem" }}>✅</span>
          <h3 style={{ marginTop:12 }}>All Clear</h3>
          <p style={{ color:"var(--ink-soft)", margin:0 }}>ไม่มีเหตุการณ์วิกฤตที่ต้องรอการอนุมัติในขณะนี้</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:28, marginBottom:24 }}>
          {dashboardData.activeInsights.map(insight => {
            const isCritical  = insight.alert.severity === "Critical";
            const isExpanded  = !!expandedInsights[insight.id];
            const impact      = insight.alert?.businessImpact ?? {};
            // Sort options by aiScore desc for ranking
            const rankedOpts  = [...(insight.options || [])].sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));

            return (
              <div key={insight.id} className="card" style={{ borderLeft:`6px solid ${isCritical ? "var(--red)" : "var(--gold)"}`, display:"grid", gridTemplateColumns:"1.15fr 1.3fr", gap:0, padding:0, boxShadow:"0 10px 30px rgba(0,0,0,0.07)", overflow:"hidden" }}>

                {/* ── LEFT: Situation + Impact badges + Explainability ── */}
                <div style={{ padding:"26px 28px", display:"flex", flexDirection:"column", gap:16 }}>
                  {/* Badges row */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", gap:8 }}>
                      <span style={{ padding:"4px 12px", background: isCritical ? "#fee2e2" : "#fef3c7", color: isCritical ? "#dc2626" : "#d97706", borderRadius:99, fontSize:"0.72rem", fontWeight:700 }}>
                        {insight.alert.severity.toUpperCase()} ALERT
                      </span>
                      <span style={{ padding:"4px 12px", background:"#f1f5f9", color:"#475569", borderRadius:99, fontSize:"0.72rem", fontWeight:700 }}>
                        Risk {insight.riskScore}/100
                      </span>
                    </div>
                    <button className="btn small-btn" style={{ background:"transparent", border:"1px solid var(--line)", color:"var(--ink)", padding:"3px 9px", fontSize:"0.72rem" }}
                      onClick={() => setSelectedIncident(insight)}>⏱️ MOIL Timeline</button>
                  </div>

                  {/* Title */}
                  <h3 style={{ margin:0, fontSize:"1.25rem", color:"var(--dark)" }}>
                    <span onClick={() => setGoverningKpi(insight.kpiDef)} style={{ cursor:"pointer", borderBottom:"2px dotted #4f46e5", color:"#4f46e5" }}
                      title="คลิกดู KPI Governance">{insight.kpiDef.name}</span>
                    <span style={{ fontSize:"0.9rem", color:"var(--ink-soft)", fontWeight:"normal" }}> — {insight.form?.zoneId}</span>
                  </h3>

                  {/* Situation */}
                  <div>
                    <strong style={{ fontSize:"0.72rem", color:"var(--ink-soft)", letterSpacing:"1px" }}>SITUATION</strong>
                    <p style={{ margin:"4px 0 0 0", fontSize:"0.93rem", color:"var(--ink)", fontWeight:500 }}>{insight.situation}</p>
                  </div>

                  {/* Business Impact — 4 mini-badges */}
                  <div>
                    <strong style={{ fontSize:"0.72rem", color:"#b45309", letterSpacing:"1px" }}>⚠️ BUSINESS IMPACT</strong>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
                      {[
                        { icon:"💰", label:"Financial",   value:impact.estimatedRevenueRisk ?? "ไม่ระบุ", color:"#dc2626", bg:"#fef2f2" },
                        { icon:"🏭", label:"Operational", value:impact.operationalRisk      ?? "ไม่ระบุ", color:"#b45309", bg:"#fef9c3" },
                        { icon:"👥", label:"Customer",    value:impact.affectedVendors       ?? "ไม่ระบุ", color:"#4f46e5", bg:"#eef2ff" },
                        { icon:"⚖️", label:"Compliance",  value: isCritical ? "High Risk" : "Low Risk",   color: isCritical ? "#dc2626" : "#16a34a", bg: isCritical ? "#fef2f2" : "#f0fdf4" },
                      ].map(imp => (
                        <div key={imp.label} style={{ background:imp.bg, borderRadius:8, padding:"8px 12px" }}>
                          <div style={{ fontSize:"0.65rem", color:"var(--ink-soft)", fontWeight:700 }}>{imp.icon} {imp.label.toUpperCase()}</div>
                          <div style={{ fontSize:"0.8rem", fontWeight:700, color:imp.color, marginTop:2, lineHeight:1.3 }}>{imp.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── AI Explainability (Expand/Collapse Visual Chain) ── */}
                  <div>
                    <button onClick={() => toggleInsightDetail(insight.id)}
                      style={{ background:"none", border:"none", color:"#4f46e5", fontWeight:700, fontSize:"0.82rem", cursor:"pointer", display:"flex", alignItems:"center", gap:6, padding:0 }}>
                      {isExpanded ? "🔼 ซ่อน AI Logic Chain" : "🔬 ดู AI Explainability Chain"}
                    </button>

                    {isExpanded && (
                      <div style={{ background:"#f8fafc", padding:14, borderRadius:8, border:"1px solid #e2e8f0", marginTop:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                          <strong style={{ fontSize:"0.75rem", color:"#6366f1", letterSpacing:"1px" }}>✨ AI EXPLAINABILITY CHAIN</strong>
                          <span style={{ fontSize:"0.7rem", background:"#e0e7ff", color:"#4f46e5", padding:"2px 8px", borderRadius:4, fontWeight:700 }}>Confidence: {insight.confidenceScore}%</span>
                        </div>

                        {/* Visual Arrow Chain */}
                        <div style={{ display:"flex", alignItems:"center", gap:0, flexWrap:"wrap", marginBottom:12 }}>
                          {[
                            { icon:"📊", title:"Evidence",       body: insight.evidences?.[0] ?? "N/A" },
                            { icon:"📐", title:"Rule Applied",    body: (insight.aiReasoning ?? "").split(" THEN")[0].replace("IF ","") },
                            { icon:"🔮", title:"AI Prediction",   body: insight.whyNow ?? "N/A" },
                            { icon:"🎯", title:"Recommendation",  body: insight.options?.[0]?.optionText ?? "N/A" },
                          ].map((ch, idx) => (
                            <div key={ch.title} style={{ display:"flex", alignItems:"center" }}>
                              <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px", minWidth:120, maxWidth:140 }}>
                                <div style={{ fontSize:"0.9rem", marginBottom:2 }}>{ch.icon}</div>
                                <div style={{ fontSize:"0.65rem", color:"#6366f1", fontWeight:700, marginBottom:2 }}>{ch.title}</div>
                                <div style={{ fontSize:"0.72rem", color:"var(--ink)", lineHeight:1.3 }}>{ch.body}</div>
                              </div>
                              {idx < 3 && <div style={{ fontSize:"1.2rem", color:"#94a3b8", margin:"0 6px" }}>➔</div>}
                            </div>
                          ))}
                        </div>

                        {/* Root Cause Chain */}
                        <strong style={{ fontSize:"0.72rem", color:"var(--dark)" }}>Root Cause Chain:</strong>
                        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:4, marginTop:4 }}>
                          {(insight.rootCauseChain || []).map((rc, idx) => (
                            <span key={idx} style={{ display:"flex", alignItems:"center", fontSize:"0.72rem" }}>
                              <span style={{ background:"#f1f5f9", padding:"2px 6px", borderRadius:4, color:"#334155", fontWeight:500 }}>{rc}</span>
                              {idx < insight.rootCauseChain.length-1 && <span style={{ color:"#94a3b8", margin:"0 3px" }}>➔</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── RIGHT: AI-Ranked Decision Options ── */}
                <div style={{ background:"#0f172a", color:"#fff", padding:"26px 28px", display:"flex", flexDirection:"column" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                    <strong style={{ fontSize:"0.72rem", color:"#94a3b8", letterSpacing:"1.5px" }}>MOIL STEP 5: DECISION OPTIONS</strong>
                    <span style={{ fontSize:"0.68rem", color:"#818cf8", background:"rgba(99,102,241,0.15)", padding:"2px 8px", borderRadius:99 }}>🧩 AI Ranked</span>
                  </div>

                  <div style={{ display:"flex", flexDirection:"column", gap:14, flex:1 }}>
                    {rankedOpts.map((opt, idx) => {
                      const medal      = getMedal(idx);
                      const scoreColor = getScoreColor(opt.aiScore ?? 0);
                      const isTop      = idx === 0;
                      return (
                        <div key={opt.id} style={{ background: isTop ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.04)", border: isTop ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:14 }}>
                          {/* Medal + Score row */}
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                              <span style={{ fontSize:"1.1rem" }}>{medal}</span>
                              <strong style={{ fontSize:"0.93rem", color: isTop ? "#818cf8" : "#e2e8f0" }}>{opt.optionText}</strong>
                            </div>
                            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                              <div style={{ textAlign:"center" }}>
                                <div style={{ fontSize:"1.1rem", fontWeight:800, color:scoreColor }}>{opt.aiScore ?? "N/A"}</div>
                                <div style={{ fontSize:"0.6rem", color:"#64748b" }}>AI Score</div>
                              </div>
                              <button className="btn" style={{ background: isTop ? "#4f46e5" : "transparent", color:"#fff", border: isTop ? "none" : "1px solid rgba(255,255,255,0.25)", padding:"5px 12px", fontSize:"0.78rem" }}
                                onClick={() => handleDecision(insight.id, opt.id)}>Approve</button>
                            </div>
                          </div>

                          {/* AI Rank Reason */}
                          {opt.aiRankReason && (
                            <div style={{ fontSize:"0.72rem", color:"#64748b", fontStyle:"italic", marginBottom:8, paddingLeft:4, borderLeft:"2px solid rgba(99,102,241,0.3)" }}>
                              {opt.aiRankReason}
                            </div>
                          )}

                          {/* Stats grid */}
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6, background:"rgba(0,0,0,0.3)", padding:8, borderRadius:6, fontSize:"0.68rem" }}>
                            <div><span style={{ color:"#94a3b8" }}>BEFORE→AFTER</span><br/><span style={{ color:"#34d399", fontWeight:700 }}>{opt.expectedImpact?.before} → {opt.expectedImpact?.after}</span></div>
                            <div><span style={{ color:"#94a3b8" }}>RISK REDUCE</span><br/><span style={{ color:"#60a5fa", fontWeight:700 }}>{opt.riskReduction}</span></div>
                            <div><span style={{ color:"#94a3b8" }}>COST</span><br/><span>{opt.costLevel?.split(" ")[0]}</span></div>
                            <div><span style={{ color:"#94a3b8" }}>ETA</span><br/><span>⏱️ {opt.expectedImpact?.eta}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          7. SUPERVISOR REQUESTS
          ══════════════════════════════════════════════════════════════════ */}
      {dashboardData.supervisorRequests?.length > 0 && (
        <div style={{ marginBottom:40 }}>
          <h2 style={{ fontFamily:"var(--font-display)", color:"var(--dark)", marginBottom:16, fontSize:"1.4rem" }}>
            📩 คำอนุมัติพิเศษจากหัวหน้างาน
          </h2>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {dashboardData.supervisorRequests.map(req => {
              const deptColor = req.departmentId === "d-clean" ? "#0d9488" : req.departmentId === "d-security" ? "#3b82f6" : "#ef4444";
              const deptLabel = req.departmentId === "d-clean" ? "ฝ่ายรักษาความสะอาด" : req.departmentId === "d-security" ? "ฝ่ายความปลอดภัย" : "ฝ่ายซ่อมบำรุง";
              return (
                <div key={req.id} className="card" style={{ borderLeft:`5px solid ${req.status === "Approved" ? "#64748b" : deptColor}`, background: req.status === "Approved" ? "#f8fafc" : "#fff", padding:"14px 20px", display:"grid", gridTemplateColumns:"1fr auto", gap:16, alignItems:"center" }}>
                  <div>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:5 }}>
                      <span style={{ fontSize:"0.72rem", fontWeight:700, color:"#fff", background:deptColor, padding:"2px 7px", borderRadius:4 }}>{deptLabel}</span>
                      <span style={{ fontSize:"0.72rem", color:"var(--ink-soft)" }}>เสนอเมื่อ: {new Date(req.createdAt).toLocaleTimeString("th-TH")}</span>
                    </div>
                    <p style={{ margin:"0 0 5px 0", fontWeight:700, color:"var(--dark)", fontSize:"1rem" }}>{req.title}</p>
                    <div style={{ fontSize:"0.82rem", color:"var(--ink-soft)" }}>งบที่ขอ: <strong style={{ color:"var(--dark)" }}>{req.cost.toLocaleString()} บาท</strong></div>
                  </div>
                  <div>
                    {req.status === "Approved" ? (
                      <span style={{ display:"inline-block", padding:"8px 14px", background:"#e2e8f0", color:"#64748b", borderRadius:6, fontWeight:700, fontSize:"0.82rem" }}>✅ อนุมัติแล้ว</span>
                    ) : (
                      <button className="btn" style={{ background:"#10b981", color:"#fff", border:"none", padding:"8px 14px", fontSize:"0.82rem", fontWeight:700 }}
                        onClick={() => handleApproveRequest(req.id)}>✍️ อนุมัติ</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          8. OUTCOME — Decision → Result Visual (Enhanced)
          ══════════════════════════════════════════════════════════════════ */}
      {dashboardData.resolvedIncidents?.length > 0 && (
        <div style={{ marginBottom:40 }}>
          <h2 style={{ fontFamily:"var(--font-display)", color:"var(--dark)", marginBottom:16, fontSize:"1.4rem" }}>
            ✅ ผลลัพธ์การตัดสินใจ — AI Prediction Accuracy
          </h2>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {dashboardData.resolvedIncidents.map(incident => (
              <div key={incident.taskId} className="card" style={{ borderLeft:"5px solid #10b981", padding:"18px 24px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                      <span style={{ fontSize:"0.7rem", fontWeight:700, color:"#10b981", background:"#f0fdf4", padding:"2px 8px", borderRadius:99 }}>MOIL STEP 8: EVALUATE OUTCOME</span>
                      <span style={{ fontSize:"0.72rem", color:"var(--ink-soft)" }}>เสร็จเมื่อ: {new Date(incident.completedAt).toLocaleTimeString("th-TH")}</span>
                    </div>
                    <p style={{ margin:"0 0 10px 0", fontWeight:700, color:"var(--dark)", fontSize:"1rem" }}>{incident.taskTitle}</p>

                    {/* Decision → Task → Result visual flow */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                      {[
                        { label:"✅ Decision Approved",   val: incident.decision,                        color:"#4f46e5", bg:"#eef2ff" },
                        { label:"🔧 Task Completed",       val: "Staff ดำเนินการเสร็จสิ้น",              color:"#0369a1", bg:"#e0f2fe" },
                        { label:"📊 Actual Result",        val: `${incident.actualOutcomeValue}`,        color:"#16a34a", bg:"#f0fdf4" },
                        { label:"🤖 Forecast Accuracy",    val: incident.accuracy,                        color:"#7c3aed", bg:"#faf5ff" },
                      ].map((step, idx, arr) => (
                        <div key={step.label} style={{ display:"flex", alignItems:"center" }}>
                          <div style={{ background:step.bg, borderRadius:8, padding:"8px 12px", minWidth:120 }}>
                            <div style={{ fontSize:"0.65rem", color:"var(--ink-soft)", fontWeight:700, marginBottom:2 }}>{step.label}</div>
                            <div style={{ fontSize:"0.82rem", fontWeight:700, color:step.color }}>{step.val}</div>
                          </div>
                          {idx < arr.length-1 && <div style={{ fontSize:"1rem", color:"#94a3b8", margin:"0 6px" }}>→</div>}
                        </div>
                      ))}
                    </div>

                    {/* Before → After bar */}
                    <div>
                      <div style={{ fontSize:"0.72rem", color:"var(--ink-soft)", marginBottom:4 }}>
                        AI Expected: <strong style={{ color:"var(--blue)" }}>{incident.expectedImpact?.after}</strong>
                        &nbsp;·&nbsp; Actual: <strong style={{ color:"#16a34a" }}>{incident.actualOutcomeValue}</strong>
                      </div>
                      <div style={{ fontSize:"0.72rem", color:"#64748b", fontStyle:"italic", background:"#f8fafc", padding:"4px 8px", borderRadius:4, display:"inline-block" }}>
                        🤖 AI Feedback: {incident.learningApplied}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: MOIL TIMELINE
          ══════════════════════════════════════════════════════════════════ */}
      {selectedIncident && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(15,23,42,0.85)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div className="card" style={{ width:"100%", maxWidth:640, maxHeight:"90vh", overflowY:"auto", position:"relative" }}>
            <button style={{ position:"absolute", top:16, right:16, background:"none", border:"none", fontSize:"1.5rem", cursor:"pointer" }} onClick={() => setSelectedIncident(null)}>✖</button>
            <h2 style={{ marginTop:0, marginBottom:8, color:"var(--dark)" }}>⏱️ MOIL Event Timeline</h2>
            <p style={{ color:"var(--ink-soft)", marginBottom:24, fontSize:"0.9rem" }}>
              เส้นทางเหตุการณ์ปิดลูป {selectedIncident.kpiDef.name} ({selectedIncident.form?.zoneId})
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
              {[
                { step:1, label:"Collect",    icon:"📋", desc:`Form submitted by ${selectedIncident.form?.submittedBy}`,                    time: new Date(selectedIncident.form?.createdAt ?? 0).toLocaleTimeString("th-TH") },
                { step:2, label:"Monitor",    icon:"📊", desc:`KPI evaluated: ${selectedIncident.kpiDef.name} = ${selectedIncident.kpiRecord?.value}${selectedIncident.kpiDef?.unit}`, time: new Date((selectedIncident.form?.createdAt ?? 0)+30000).toLocaleTimeString("th-TH") },
                { step:3, label:"Evaluate",   icon:"⚙️", desc:`Threshold check: value ≥ ${selectedIncident.alert?.severity === "Critical" ? selectedIncident.kpiDef.critical : selectedIncident.kpiDef.warning}`, time:"" },
                { step:4, label:"Detect",     icon:"🚨", desc:`Alert triggered: ${selectedIncident.alert?.severity} — ${selectedIncident.alert?.message}`, time: new Date((selectedIncident.form?.createdAt ?? 0)+60000).toLocaleTimeString("th-TH") },
                { step:5, label:"Recommend",  icon:"🧠", desc:`AI generated ${selectedIncident.options?.length ?? 0} decision options (Risk Score: ${selectedIncident.riskScore}/100)`, time: new Date((selectedIncident.form?.createdAt ?? 0)+90000).toLocaleTimeString("th-TH") },
                { step:6, label:"Decide",     icon:"✅", desc:"รอการสั่งการจากผู้บริหาร", time:"(Pending)" },
                { step:7, label:"Execute",    icon:"🔧", desc:"ดำเนินการตามทางเลือกที่อนุมัติ", time:"(After Approval)" },
                { step:8, label:"Outcome",    icon:"📈", desc:"ประเมินผลลัพธ์และ AI Learning", time:"(Post-execution)" },
              ].map((ev, i) => (
                <div key={ev.step} style={{ display:"flex", gap:16 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background: i < 5 ? "#4f46e5" : "#e2e8f0", color: i < 5 ? "#fff" : "#94a3b8", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:"0.8rem", flexShrink:0 }}>{ev.step}</div>
                    {i < 7 && <div style={{ width:2, flex:1, background: i < 4 ? "#4f46e5" : "#e2e8f0", minHeight:32 }} />}
                  </div>
                  <div style={{ paddingBottom:20, flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <strong style={{ fontSize:"0.9rem", color:"var(--dark)" }}>{ev.icon} {ev.label}</strong>
                      <span style={{ fontSize:"0.75rem", color:"var(--ink-soft)" }}>{ev.time}</span>
                    </div>
                    <p style={{ margin:"4px 0 0 0", fontSize:"0.82rem", color:"var(--ink-soft)" }}>{ev.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: KPI GOVERNANCE
          ══════════════════════════════════════════════════════════════════ */}
      {governingKpi && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(15,23,42,0.85)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div className="card" style={{ width:"100%", maxWidth:560, maxHeight:"85vh", overflowY:"auto", position:"relative" }}>
            <button style={{ position:"absolute", top:16, right:16, background:"none", border:"none", fontSize:"1.5rem", cursor:"pointer" }} onClick={() => setGoverningKpi(null)}>✖</button>
            <h2 style={{ marginTop:0, marginBottom:4 }}>📐 KPI Governance Specification</h2>
            <p style={{ color:"var(--ink-soft)", fontSize:"0.85rem", marginBottom:20 }}>มาตรฐานการกำหนดและวัดผล KPI หลัก</p>
            {[
              ["KPI Name", governingKpi.name],
              ["Unit", governingKpi.unit],
              ["Warning Threshold", governingKpi.warning + governingKpi.unit],
              ["Critical Threshold", governingKpi.critical + governingKpi.unit],
              ["Target", governingKpi.target],
              ["Formula", governingKpi.formula],
              ["Description", governingKpi.description],
              ["Business Purpose", governingKpi.businessPurpose],
              ["Data Source", governingKpi.dataSource],
              ["Update Frequency", governingKpi.updateFreq],
              ["Owner", governingKpi.owner],
            ].map(([k, v]) => (
              <div key={k} style={{ display:"grid", gridTemplateColumns:"160px 1fr", gap:8, padding:"8px 0", borderBottom:"1px solid var(--line)", fontSize:"0.85rem" }}>
                <strong style={{ color:"var(--ink-soft)" }}>{k}</strong>
                <span style={{ color:"var(--dark)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: AI LEARNING LOGS
          ══════════════════════════════════════════════════════════════════ */}
      {showLearningLogs && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(15,23,42,0.85)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div className="card" style={{ width:"100%", maxWidth:560, maxHeight:"85vh", overflowY:"auto", position:"relative" }}>
            <button style={{ position:"absolute", top:16, right:16, background:"none", border:"none", fontSize:"1.5rem", cursor:"pointer" }} onClick={() => setShowLearningLogs(false)}>✖</button>
            <h2 style={{ marginTop:0, marginBottom:4 }}>🤖 AI Feedback & Learning Logs</h2>
            <p style={{ color:"var(--ink-soft)", fontSize:"0.85rem", marginBottom:20 }}>บันทึกการเรียนรู้และปรับปรุงโมเดล AI</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {(dashboardData.aiLearningLogs ?? []).map((log, i) => (
                <div key={i} style={{ background:"#f8fafc", borderRadius:8, padding:"12px 16px", border:"1px solid #e2e8f0" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <strong style={{ fontSize:"0.8rem", color:"#4f46e5" }}>Epoch #{log.epoch}</strong>
                    <span style={{ fontSize:"0.72rem", color:"var(--ink-soft)" }}>{new Date(log.timestamp).toLocaleTimeString("th-TH")}</span>
                  </div>
                  <p style={{ margin:"0 0 4px 0", fontSize:"0.83rem", color:"var(--dark)" }}>{log.event}</p>
                  <div style={{ display:"flex", gap:12, fontSize:"0.75rem", color:"var(--ink-soft)" }}>
                    <span>Accuracy: <strong style={{ color:"#10b981" }}>{log.accuracy}</strong></span>
                    <span style={{ fontStyle:"italic" }}>{log.record}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
