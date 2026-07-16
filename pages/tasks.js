// pages/tasks.js — Staff Task View & Update
import { useEffect, useState } from "react";
import Layout from "../components/Layout";

const STATUS_CONFIG = {
  Pending: { label: "⏳ รอดำเนินการ", color: "#f59e0b", bg: "#fffbeb" },
  "In Progress": { label: "🔄 กำลังดำเนินการ", color: "#3b82f6", bg: "#eff6ff" },
  Completed: { label: "✅ เสร็จสิ้น", color: "#10b981", bg: "#f0fdf4" },
};

const DEPT_NAMES = {
  "d-clean": "🧹 รักษาความสะอาด",
  "d-security": "🛡️ รักษาความปลอดภัย",
  "d-maintenance": "🔧 ซ่อมบำรุง",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState("ทั้งหมด");
  const [filterStatus, setFilterStatus] = useState("ทั้งหมด");
  const [updatingId, setUpdatingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(taskId, newStatus) {
    setUpdatingId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setSuccessMsg(`✅ อัปเดตสถานะเป็น "${newStatus}" สำเร็จ`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredTasks = tasks.filter((t) => {
    const matchDept = filterDept === "ทั้งหมด" || t.departmentId === filterDept;
    const matchStatus = filterStatus === "ทั้งหมด" || t.status === filterStatus;
    return matchDept && matchStatus;
  });

  const pendingCount = tasks.filter((t) => t.status === "Pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "In Progress").length;
  const completedCount = tasks.filter((t) => t.status === "Completed").length;

  return (
    <Layout>
      <div className="page-head">
        <p className="eyebrow">เจ้าหน้าที่ปฏิบัติงาน</p>
        <h1>Task Board — ใบงานที่ได้รับมอบหมาย</h1>
        <p>รายการงานที่ผู้บริหารสั่งการมาจาก AI Decision Support System</p>
      </div>

      {/* Success Toast */}
      {successMsg && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 999,
          background: "#10b981", color: "#fff", padding: "12px 20px",
          borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          fontWeight: 700
        }}>
          {successMsg}
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-3" style={{ marginBottom: 32 }}>
        {[
          { label: "รอดำเนินการ", count: pendingCount, color: "#f59e0b", icon: "⏳" },
          { label: "กำลังดำเนินการ", count: inProgressCount, color: "#3b82f6", icon: "🔄" },
          { label: "เสร็จสิ้นแล้ว", count: completedCount, color: "#10b981", icon: "✅" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ borderTop: `4px solid ${s.color}`, display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: "2rem" }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
          style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--line)", fontWeight: 600 }}>
          <option value="ทั้งหมด">ทุกฝ่าย</option>
          {Object.entries(DEPT_NAMES).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--line)", fontWeight: 600 }}>
          <option value="ทั้งหมด">ทุกสถานะ</option>
          <option value="Pending">⏳ รอดำเนินการ</option>
          <option value="In Progress">🔄 กำลังดำเนินการ</option>
          <option value="Completed">✅ เสร็จสิ้น</option>
        </select>
        <button className="btn" style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink)" }} onClick={fetchTasks}>
          🔄 รีเฟรช
        </button>
      </div>

      {/* Task List */}
      {loading ? (
        <p>กำลังโหลดใบงาน...</p>
      ) : filteredTasks.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px", background: "#f8fafc" }}>
          <span style={{ fontSize: "3rem" }}>📋</span>
          <h3 style={{ marginTop: 16 }}>ไม่มีใบงานในขณะนี้</h3>
          <p style={{ color: "var(--ink-soft)" }}>เมื่อผู้บริหารอนุมัติคำสั่งการ ใบงานจะปรากฏที่นี่</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredTasks.map((task) => {
            const sCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG["Pending"];
            const isUpdating = updatingId === task.id;

            return (
              <div key={task.id} className="card" style={{
                borderLeft: `5px solid ${sCfg.color}`,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 24,
                alignItems: "center",
              }}>
                <div>
                  {/* Department badge */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink-soft)", background: "#f1f5f9", padding: "2px 10px", borderRadius: 99 }}>
                      {DEPT_NAMES[task.departmentId] || task.departmentId}
                    </span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: sCfg.color, background: sCfg.bg, padding: "2px 10px", borderRadius: 99 }}>
                      {sCfg.label}
                    </span>
                  </div>

                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", color: "var(--dark)" }}>
                    {task.title}
                  </h3>

                  <div style={{ fontSize: "0.82rem", color: "var(--ink-soft)", display: "flex", gap: 16 }}>
                    <span>📅 สร้างเมื่อ: {new Date(task.createdAt).toLocaleString("th-TH")}</span>
                    {task.updatedAt !== task.createdAt && (
                      <span>🔄 อัปเดต: {new Date(task.updatedAt).toLocaleString("th-TH")}</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
                  {task.status === "Pending" && (
                    <button className="btn"
                      style={{ background: "#3b82f6", justifyContent: "center" }}
                      disabled={isUpdating}
                      onClick={() => handleStatusUpdate(task.id, "In Progress")}>
                      {isUpdating ? "..." : "🔄 เริ่มดำเนินการ"}
                    </button>
                  )}
                  {task.status === "In Progress" && (
                    <button className="btn"
                      style={{ background: "#10b981", justifyContent: "center" }}
                      disabled={isUpdating}
                      onClick={() => handleStatusUpdate(task.id, "Completed")}>
                      {isUpdating ? "..." : "✅ เสร็จสิ้น"}
                    </button>
                  )}
                  {task.status === "Completed" && (
                    <span style={{ color: "#10b981", fontWeight: 700, textAlign: "center", fontSize: "0.9rem" }}>
                      งานเสร็จสิ้นแล้ว
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
