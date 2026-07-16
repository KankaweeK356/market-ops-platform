// pages/dashboard.js — Department Command Center (Supervisor View)
import { useEffect, useState } from "react";
import Layout from "../components/Layout";

const DEPT_CONFIGS = {
  "d-clean": {
    label: "ฝ่ายรักษาความสะอาด",
    icon: "🧹",
    color: "#0d9488",
    aiInsight: "ปริมาณขยะสะสมใน Zone C มีแนวโน้มเพิ่มขึ้นต่อเนื่องในช่วงเย็น แนะนำให้เพิ่มรอบบริการกวาดล้างเสริมเวลา 15:00 น. ก่อนเข้าสู่ช่วงผู้ซื้อหนาแน่นหนาตา",
    kpis: [
      { label: "Waste Overflow Rate", value: (val) => `${val}%`, desc: "ระดับความจุของถังขยะที่สูงสุด (Peak)" },
      { label: "Cleaning SLA Compliance", value: () => "96.2%", desc: "สถิติตามกรอบ SLA" },
      { label: "Fuel Usage (Trucks)", value: () => "420 ลิตร", desc: "การใช้เชื้อเพลิงวันนี้" },
      { label: "Bin Cleaning Rate", value: () => "88.5%", desc: "อัตราความสะอาดถังพัก" }
    ]
  },
  "d-security": {
    label: "ฝ่ายรักษาความปลอดภัย",
    icon: "🛡️",
    color: "#3b82f6",
    aiInsight: "พบอัตราความเร็วรถสะสมช่องทางเข้าหลักช้าลง 20% ในรอบ 15 นาทีที่ผ่านมา ควรส่งกำลังเจ้าหน้าที่เดินเท้าจัดจราจรพิเศษหน้า Gate 3 เสริมแนวระบาย",
    kpis: [
      { label: "Traffic Queue Time", value: (val) => `${val} นาที`, desc: "เวลารอผ่านด่านเฉลี่ย" },
      { label: "Incident Response Time", value: () => "6.4 นาที", desc: "เวลาเข้าเผชิญเหตุเฉลี่ย" },
      { label: "Illegal Parking Incidents", value: () => "14 คัน", desc: "พบจอดแฝงนอกจุดที่กำหนด" }
    ]
  },
  "d-maintenance": {
    label: "ฝ่ายซ่อมบำรุง",
    icon: "🔧",
    color: "#ef4444",
    aiInsight: "ระบบมอเตอร์หลักทำงานติดต่อกัน 48 ชั่วโมง อุณหภูมิพัดลมระบายสะสมใกล้พุ่งเตือนระดับ Warning ควรจัดแผน PM เฝ้าระวังภายในคืนนี้",
    kpis: [
      { label: "Motor Operating Temp", value: (val) => `${val}°C`, desc: "อุณหภูมิห้องเครื่องหลัก (SCADA)" },
      { label: "Repair SLA Compliance", value: () => "91.2%", desc: "สถิติจบงานตาม SLA" },
      { label: "Machine Utilization Rate", value: (val, scenario) => scenario === "Festival" ? "96.5%" : scenario === "Busy" ? "82.1%" : "58.4%", desc: "อัตราการเดินเครื่องสะสม" }
    ]
  }
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState("d-clean");
  
  // Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqTitle, setReqTitle] = useState("");
  const [reqCost, setReqCost] = useState("");
  
  const [actionMessage, setActionMessage] = useState(null);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000); // auto-refresh 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchAll() {
    try {
      const [dashRes, taskRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/tasks"),
      ]);

      const dashText = await dashRes.text();
      const taskText = await taskRes.text();

      let dashData = null;
      let taskData = [];

      try { dashData = JSON.parse(dashText); } catch { console.error("Dashboard API non-JSON:", dashText.slice(0, 200)); }
      try { taskData = JSON.parse(taskText); } catch { console.error("Tasks API non-JSON:", taskText.slice(0, 200)); }

      if (dashData) setData(dashData);
      if (Array.isArray(taskData)) setTasks(taskData);
    } catch (err) {
      console.error("fetchAll error:", err);
    } finally {
      setLoading(false);
    }
  }

  const triggerAction = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!reqTitle || !reqCost) return;
    
    try {
      const res = await fetch("/api/supervisor/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: filterDept,
          title: reqTitle,
          cost: parseFloat(reqCost)
        })
      });
      
      if (res.ok) {
        setReqTitle("");
        setReqCost("");
        setShowRequestModal(false);
        triggerAction("📩 ส่งรายงานขอคำอนุมัติงบฉุกเฉินถึงผู้บริหารเรียบร้อยแล้ว");
        fetchAll(); // Refresh tasks and metrics
      }
    } catch (err) {
      console.error("handleCreateRequest error:", err);
    }
  };

  if (loading || !data) return <Layout><div style={{ padding: 40, textAlign: "center" }}>กำลังโหลดข้อมูลศูนย์ควบคุม...</div></Layout>;

  // Filter items matching the chosen department
  const filteredTasks = tasks.filter((t) => t.departmentId === filterDept);
  const activeTasks = filteredTasks.filter((t) => t.status !== "Completed");
  const completedTasks = filteredTasks.filter((t) => t.status === "Completed");

  const activeInsights = data.activeInsights.filter(insight => insight.kpiDef.departmentId === filterDept);
  
  const currentDeptCfg = DEPT_CONFIGS[filterDept];

  // Retrieve matching KPI object from DB to render dynamically
  const getDynamicKpiValue = (label) => {
    if (label === "Waste Overflow Rate") {
      return data.latestKpis?.["kpi-clean-waste"] || { value: 65, status: "Normal" };
    }
    if (label === "Traffic Queue Time") {
      return data.latestKpis?.["kpi-security-traffic"] || { value: 12, status: "Normal" };
    }
    if (label === "Motor Operating Temp") {
      return data.latestKpis?.["kpi-maint-temp"] || { value: 72, status: "Normal" };
    }
    return { value: null, status: "Normal" };
  };

  return (
    <Layout>
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <p className="eyebrow" style={{ color: "var(--blue)", fontWeight: 700 }}>DEPARTMENT COMMAND CENTER</p>
          <h1 style={{ fontSize: "2.4rem", margin: "8px 0" }}>📊 ศูนย์ควบคุมงานระดับปฏิบัติการ</h1>
          <p style={{ opacity: 0.8, fontSize: "1rem" }}>แดชบอร์ดจัดการ ควบคุม และติดตามสถานะความคล่องตัวของแต่ละฝ่ายงาน</p>
        </div>

        {/* Department Switcher Dropdown */}
        <div style={{ background: "#fff", padding: "10px 16px", borderRadius: 8, border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
          <strong style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>เลือกแผนกดูแล:</strong>
          <select 
            value={filterDept} 
            onChange={(e) => setFilterDept(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid var(--blue)", fontWeight: 700, color: "var(--blue)" }}
          >
            <option value="d-clean">🧹 ฝ่ายรักษาความสะอาด</option>
            <option value="d-security">🛡️ ฝ่ายรักษาความปลอดภัย</option>
            <option value="d-maintenance">🔧 ฝ่ายซ่อมบำรุง</option>
          </select>
        </div>
      </div>

      {/* Action Dialog Notification */}
      {actionMessage && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 999,
          background: "#3b82f6", color: "#fff", padding: "12px 20px",
          borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          fontWeight: 700
        }}>
          {actionMessage}
        </div>
      )}

      {/* ── AI DEPARTMENT INSIGHT (Supervisor Requirement) ────────────────── */}
      <div className="card" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "20px 24px", marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: "1.3rem" }}>🧠</span>
          <strong style={{ color: "#1d4ed8", fontSize: "0.85rem", letterSpacing: "1.5px" }}>AI COGNITIVE DEPARTMENT INSIGHT</strong>
        </div>
        <p style={{ margin: 0, fontSize: "1.05rem", color: "#1e3a8a", fontWeight: 600, lineHeight: 1.5 }}>
          "{currentDeptCfg.aiInsight}"
        </p>
      </div>

      {/* ── DEPARTMENT-SPECIFIC KPI METRICS ───────────────────────────────── */}
      <h2 style={{ fontSize: "1.4rem", color: "var(--dark)", marginBottom: 16 }}>📈 ดัชนีชี้วัดผลการทำงาน ({currentDeptCfg.label})</h2>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${currentDeptCfg.kpis.length}, 1fr)`, gap: 16, marginBottom: 32 }}>
        {currentDeptCfg.kpis.map((kpi, idx) => {
          const kpiObj = getDynamicKpiValue(kpi.label);
          const rawVal = kpiObj ? kpiObj.value : null;
          const status = kpiObj ? kpiObj.status : "Normal";
          const displayVal = rawVal !== null && rawVal !== undefined ? kpi.value(rawVal, data.currentScenario) : kpi.value(null, data.currentScenario);
          
          // Color coding depending on warning & critical statuses
          const isCritical = status === "Critical";
          const isWarning = status === "Warning";
          const borderColor = isCritical ? "#ef4444" : isWarning ? "#f59e0b" : "#10b981";
          const bgColor = isCritical ? "#fef2f2" : isWarning ? "#fffbeb" : "#f0fdf4";
          
          return (
            <div key={idx} className="card" style={{ borderTop: `4px solid ${borderColor}`, background: bgColor, transition: "all 0.3s ease" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: isCritical ? "#dc2626" : isWarning ? "#b45309" : "var(--dark)", marginTop: 8 }}>{displayVal}</div>
              {kpiObj?.detail && (
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isCritical ? "#b91c1c" : isWarning ? "#a16207" : "#047857", marginTop: 4, marginBottom: 8 }}>
                  📍 {kpiObj.detail}
                </div>
              )}
              <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: 6, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 6 }}>
                {kpi.desc} · <strong style={{ color: borderColor }}>{status}</strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── TEAM PERFORMANCE & SUPERVISOR ACTIONS ────────────────────────── */}
      <div className="grid grid-3" style={{ marginBottom: 32, gap: 20 }}>
        {/* Statistics Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifySelf: "stretch" }}>
          <h3 style={{ marginTop: 0, fontSize: "1.1rem", borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>👥 สถิตการทำงานทีมวันนี้</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-soft)" }}>ใบงานทั้งหมด:</span>
              <strong style={{ color: "var(--dark)" }}>{filteredTasks.length} รายการ</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-soft)" }}>งานที่รอดำเนินการ:</span>
              <strong style={{ color: "var(--gold)" }}>{activeTasks.length} รายการ</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-soft)" }}>SLA Compliance %:</span>
              <strong style={{ color: "#10b981" }}>{data.sla.compliance}%</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-soft)" }}>เวลาการแก้ไขเฉลี่ย:</span>
              <strong style={{ color: "var(--blue)" }}>{data.sla.avgResolution} นาที</strong>
            </div>
          </div>
        </div>

        {/* Action Panel Card (Supervisor Actions) */}
        <div className="card" style={{ gridColumn: "span 2", display: "flex", flexDirection: "column" }}>
          <h3 style={{ marginTop: 0, fontSize: "1.1rem", borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>⚡ แผงจัดการและควบคุมปฏิบัติการ (Supervisor Actions)</h3>
          <div className="grid grid-2" style={{ gap: 12, marginTop: 12, flex: 1 }}>
            <button 
              className="btn" 
              style={{ background: "#4f46e5", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 12px", border: "none" }}
              onClick={() => triggerAction("📤 มอบหมายงานใบสั่งส่งตรงหา Staff หน้างานแล้ว")}
            >
              <span style={{ fontSize: "1.5rem", marginBottom: 6 }}>📋</span>
              <strong>Assign Task</strong>
              <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>จ่ายงานเร่งด่วนสู่เจ้าหน้าที่ปฏิบัติการ</span>
            </button>
            
            <button 
              className="btn" 
              style={{ background: "#3b82f6", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 12px", border: "none" }}
              onClick={() => triggerAction("🔄 ปรับเปลี่ยนผู้รับผิดชอบงาน เรียบร้อยแล้ว")}
            >
              <span style={{ fontSize: "1.5rem", marginBottom: 6 }}>👥</span>
              <strong>Reassign Task</strong>
              <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>สลับกะหรือส่งต่อใบสั่งให้อีกทีม</span>
            </button>

            <button 
              className="btn" 
              style={{ background: "#d97706", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 12px", border: "none" }}
              onClick={() => triggerAction("🔥 ยกระดับรายงานแจ้งความเสียหาย (Escalated)")}
            >
              <span style={{ fontSize: "1.5rem", marginBottom: 6 }}>🚨</span>
              <strong>Escalate Issue</strong>
              <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>ส่งเคสปัญหาข้ามฝ่าย/รายงานด่วนที่สุด</span>
            </button>

            <button 
              className="btn" 
              style={{ background: "#059669", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 12px", border: "none" }}
              onClick={() => setShowRequestModal(true)}
            >
              <span style={{ fontSize: "1.5rem", marginBottom: 6 }}>👑</span>
              <strong>Request Approval</strong>
              <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>ขออนุมัติจัดงบหรือรอบเสริมฉุกเฉิน</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── ACTIVE ALERTS ─────────────────────────────────────────────────── */}
      {activeInsights.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16, fontSize: "1.3rem", color: "var(--dark)" }}>🚨 แจ้งเตือนวิกฤตของฝ่ายงาน (Active Department Alerts)</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activeInsights.map((insight) => (
              <div key={insight.id} className="card" style={{
                borderLeft: `5px solid ${insight.alert?.severity === "Critical" ? "var(--red)" : "var(--gold)"}`,
                padding: "16px 20px",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <div>
                  <span style={{
                    fontSize: "0.75rem", fontWeight: 700,
                    color: insight.alert?.severity === "Critical" ? "#dc2626" : "#b45309",
                    background: insight.alert?.severity === "Critical" ? "#fef2f2" : "#fffbeb",
                    padding: "2px 8px", borderRadius: 99
                  }}>
                    {insight.alert?.severity}
                  </span>
                  <p style={{ margin: "6px 0 0 0", fontWeight: 600, color: "var(--dark)", fontSize: "1.05rem" }}>{insight.whatHappened}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                    Confidence: {insight.confidenceScore}% · {insight.whyNow}
                  </p>
                </div>
                <a href="/executive" style={{ padding: "8px 16px", background: "var(--blue)", color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                  ดูทางเลือกสั่งการ →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TASKS CURRENT STATUS ──────────────────────────────────────────── */}
      <h2 style={{ marginBottom: 16, fontSize: "1.3rem", color: "var(--dark)" }}>📋 ใบงานปฏิบัติการทั้งหมดของฝ่าย</h2>
      {filteredTasks.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px", color: "var(--ink-soft)" }}>
          ไม่มีงานปฏิบัติงานสำหรับแผนกนี้ในกะปัจจุบัน
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredTasks.map((task) => {
            const statusColor = task.status === "Completed" ? "#10b981" : task.status === "In Progress" ? "#3b82f6" : "#f59e0b";
            return (
              <div key={task.id} className="card" style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
                  <span style={{ fontSize: "1.5rem" }}>{currentDeptCfg.icon}</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem", color: "var(--dark)" }}>{task.title}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                      SLA: Response {task.responseSla} นาที / Resolution {task.resolutionSla} นาที · {new Date(task.createdAt).toLocaleTimeString("th-TH")}
                    </p>
                  </div>
                </div>
                <span style={{ padding: "4px 12px", background: statusColor + "20", color: statusColor, borderRadius: 99, fontWeight: 700, fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                  {task.status === "Completed" ? "✅ เสร็จสิ้น" : task.status === "In Progress" ? "🔄 กำลังทำ" : "⏳ รอคิว"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: CREATE APPROVAL REQUEST ──────────────────────────────────── */}
      {showRequestModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <form onSubmit={handleCreateRequest} className="card" style={{ width: "100%", maxWidth: 480, position: "relative" }}>
            <button type="button" style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }} onClick={() => setShowRequestModal(false)}>✖</button>
            
            <h2 style={{ marginTop: 0, marginBottom: 8, color: "var(--dark)" }}>📩 ส่งคำขออนุมัติพิเศษ (Request Executive Approval)</h2>
            <p style={{ color: "var(--ink-soft)", marginBottom: 20, fontSize: "0.85rem" }}>
              กรอกคำร้องของบประมาณฉุกเฉินหรือนโยบายพิเศษเพื่อส่งตรงไปยังบอร์ดอนุมัติของผู้บริหารสูงสุด
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: "0.85rem" }}>หัวข้อคำเสนออนุมัติ (Request Title):</label>
                <input 
                  type="text" 
                  required 
                  placeholder="เช่น ขออนุมัติเหมาจ่ายรอบเก็บขยะเพิ่มเติม Zone C ฉุกเฉิน"
                  value={reqTitle} 
                  onChange={(e) => setReqTitle(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--line)" }} 
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: "0.85rem" }}>ประมาณการงบประมาณใช้สอย (Estimated Cost - บาท):</label>
                <input 
                  type="number" 
                  required 
                  placeholder="เช่น 15000"
                  value={reqCost} 
                  onChange={(e) => setReqCost(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--line)" }} 
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button type="button" className="btn" style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink)" }} onClick={() => setShowRequestModal(false)}>ยกเลิก</button>
              <button type="submit" className="btn" style={{ background: "#059669", color: "#fff", border: "none" }}>ส่งขออนุมัติ</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}
