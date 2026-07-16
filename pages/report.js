// pages/report.js — 4-Step Process-Based Wizard
import { useState } from "react";
import Layout from "../components/Layout";
import { ZONES, STAFF_NAMES, DEPARTMENTS, WORK_PROCESSES, ACTIVITIES } from "../lib/constants";

// ── STEP DEFINITIONS ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "เลือกฝ่าย",         short: "Department" },
  { id: 2, label: "เลือก Work Process", short: "Work Process" },
  { id: 3, label: "เลือก Activity",     short: "Activity" },
  { id: 4, label: "กรอกแบบฟอร์ม",      short: "Form" },
];

// ── KPI STATUS HELPER ─────────────────────────────────────────────────────────
function getKpiStatus(value, activity) {
  if (!activity?.kpiId || value === "") return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  if (num >= activity.kpiCritical) return "Critical";
  if (num >= activity.kpiWarning)  return "Warning";
  return "Normal";
}

// ── BREADCRUMB COMPONENT ──────────────────────────────────────────────────────
function WizardBreadcrumb({ currentStep, dept, wp, activity }) {
  const labels = [
    dept?.name   ?? "ฝ่าย",
    wp?.name     ?? "Work Process",
    activity?.name ?? "Activity",
    "แบบฟอร์ม",
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 28, fontSize: "0.88rem" }}>
      {STEPS.map((step, i) => {
        const isActive  = step.id === currentStep;
        const isDone    = step.id < currentStep;
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 14px", borderRadius: 99,
              background: isActive ? "#4f46e5" : isDone ? "#e0e7ff" : "#f1f5f9",
              color:      isActive ? "#fff"    : isDone ? "#4f46e5" : "#94a3b8",
              fontWeight: isActive ? 700       : 600,
              transition: "all 0.2s ease",
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%",
                background: isActive ? "rgba(255,255,255,0.25)" : isDone ? "#4f46e5" : "#cbd5e1",
                color: isDone ? "#fff" : "inherit",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", fontWeight: 800,
              }}>
                {isDone ? "✓" : step.id}
              </span>
              <span style={{ maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {isDone && labels[i] ? labels[i] : step.short}
              </span>
            </div>
            {i < 3 && <span style={{ color: "#cbd5e1", fontSize: "1rem" }}>›</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── SELECTION CARD GRID ──────────────────────────────────────────────────────
function SelectionGrid({ items, onSelect, columns = 3, selected = null }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: 16,
    }}>
      {items.map((item) => {
        const isSelected = selected && selected.id === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            style={{
              background: isSelected ? "#eef2ff" : "#fff",
              border: `2px solid ${isSelected ? "#4f46e5" : "var(--line)"}`,
              borderRadius: 14, padding: "28px 20px",
              cursor: "pointer", textAlign: "center",
              transition: "all 0.2s ease",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 10,
              boxShadow: isSelected ? "0 0 0 3px rgba(79,70,229,0.15)" : "none",
            }}
            onMouseOver={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = "#818cf8";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.07)";
              }
            }}
            onMouseOut={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = "var(--line)";
                e.currentTarget.style.boxShadow = "none";
              }
            }}
          >
            {item.icon && <span style={{ fontSize: "2.4rem" }}>{item.icon}</span>}
            <strong style={{ fontSize: "0.97rem", color: "var(--dark)", lineHeight: 1.3 }}>{item.name}</strong>
            {item.description && (
              <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)", margin: 0, lineHeight: 1.4 }}>{item.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ReportPage() {
  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedDept,     setSelectedDept]     = useState(null);
  const [selectedWP,       setSelectedWP]       = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);

  // Form state
  const [zone,      setZone]      = useState(ZONES[0]);
  const [staffName, setStaffName] = useState(STAFF_NAMES[0]);
  const [kpiValue,  setKpiValue]  = useState("");
  const [checklist, setChecklist] = useState({});
  const [note,      setNote]      = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]     = useState(null);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function toggleChecklist(item) {
    setChecklist((prev) => ({ ...prev, [item]: !prev[item] }));
  }

  function resetAll() {
    setStep(1); setSelectedDept(null); setSelectedWP(null); setSelectedActivity(null);
    setKpiValue(""); setChecklist({}); setNote(""); setResult(null);
  }

  // Back: drop one step and clear downstream selections
  function goBack() {
    if (step === 2) { setSelectedDept(null); setSelectedWP(null); setStep(1); }
    if (step === 3) { setSelectedWP(null); setSelectedActivity(null); setStep(2); }
    if (step === 4) { setSelectedActivity(null); setKpiValue(""); setChecklist({}); setStep(3); }
  }

  // ── Derived Data ───────────────────────────────────────────────────────────
  const availableWPs         = WORK_PROCESSES.filter(wp => wp.departmentId === selectedDept?.id);
  const availableActivities  = ACTIVITIES.filter(a => a.workProcessId === selectedWP?.id);
  const kpiStatus            = getKpiStatus(kpiValue, selectedActivity);
  const checklistItems       = selectedActivity?.checklist ?? [];
  const completedCount       = checklistItems.filter(it => checklist[it]).length;
  const completionRate       = checklistItems.length > 0
    ? Math.round((completedCount / checklistItems.length) * 100)
    : 0;

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedActivity) return;
    // If activity has KPI, require kpiValue
    if (selectedActivity.kpiId && kpiValue === "") return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/forms/${selectedDept.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submittedBy: staffName,
          zoneId: zone,
          workProcessId: selectedWP.id,
          activityId: selectedActivity.id,
          kpiValue: selectedActivity.kpiId ? parseFloat(kpiValue) : null,
          details: {
            workProcess:    selectedWP.name,
            activity:       selectedActivity.name,
            kpiValue:       selectedActivity.kpiId ? parseFloat(kpiValue) : null,
            checklist,
            completionRate,
            note,
          },
        }),
      });
      const data = await res.json();
      setResult({ success: res.ok, message: data.message, kpiStatus: data.kpiStatus, alertTriggered: data.alertTriggered });
    } catch (err) {
      setResult({ success: false, message: "เกิดข้อผิดพลาด: " + err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESULT VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (result) {
    const isAlert = result.kpiStatus === "Critical" || result.kpiStatus === "Warning";
    return (
      <Layout>
        <div style={{ maxWidth: 580, margin: "60px auto", textAlign: "center" }}>
          <div style={{
            background: isAlert ? "#fef2f2" : "#f0fdf4",
            border: `2px solid ${isAlert ? "#fca5a5" : "#86efac"}`,
            borderRadius: 20, padding: "48px 40px",
          }}>
            <div style={{ fontSize: "4rem", marginBottom: 16 }}>{isAlert ? "🚨" : "✅"}</div>
            <h2 style={{ color: isAlert ? "#dc2626" : "#16a34a", marginTop: 0, fontSize: "1.6rem" }}>
              {isAlert ? `พบสถานะ ${result.kpiStatus}!` : "บันทึกข้อมูลสำเร็จ"}
            </h2>

            {/* Journey Summary */}
            <div style={{ background: "rgba(0,0,0,0.04)", borderRadius: 10, padding: "14px 18px", marginBottom: 16, textAlign: "left", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
              <div style={{ marginBottom: 4 }}><strong style={{ color: "var(--dark)" }}>ฝ่าย:</strong> {selectedDept?.icon} {selectedDept?.name}</div>
              <div style={{ marginBottom: 4 }}><strong style={{ color: "var(--dark)" }}>Work Process:</strong> {selectedWP?.icon} {selectedWP?.name}</div>
              <div style={{ marginBottom: 4 }}><strong style={{ color: "var(--dark)" }}>Activity:</strong> {selectedActivity?.name}</div>
              <div><strong style={{ color: "var(--dark)" }}>Checklist Completion:</strong> {completedCount}/{checklistItems.length} ({completionRate}%)</div>
            </div>

            <p style={{ color: "#374151", fontSize: "1.05rem", lineHeight: 1.7, marginBottom: 20 }}>{result.message}</p>

            {result.alertTriggered && (
              <div style={{
                background: "#fff7ed", border: "1px solid #fed7aa",
                borderRadius: 10, padding: "12px 18px", marginBottom: 20,
                fontSize: "0.9rem", color: "#c2410c", textAlign: "left",
              }}>
                ⚡ ระบบได้ส่ง <strong>Alert + AI Insight (🧩 Analytical AI)</strong> ไปยังหน้าผู้บริหารโดยอัตโนมัติแล้ว
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn" onClick={resetAll} style={{ background: "var(--blue)" }}>
                + บันทึกฟอร์มใหม่
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WIZARD LAYOUT WRAPPER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <Layout>
      {/* Page Header */}
      <div className="page-head" style={{ marginBottom: 8 }}>
        <p className="eyebrow">เจ้าหน้าที่ปฏิบัติงาน · Operations Workspace</p>
        <h1>บันทึกผลการตรวจพื้นที่</h1>
        <p>เลือกฝ่าย → Work Process → Activity → กรอกแบบฟอร์ม เพื่อบันทึกข้อมูลเข้าสู่ระบบ</p>
      </div>

      {/* Breadcrumb */}
      <WizardBreadcrumb
        currentStep={step}
        dept={selectedDept}
        wp={selectedWP}
        activity={selectedActivity}
      />

      {/* ────────────────────────────────────────────────────────────────────
          STEP 1: SELECT DEPARTMENT
          ──────────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: "1.2rem", color: "var(--ink-soft)", marginBottom: 16, fontWeight: 600 }}>
            Step 1 — เลือกฝ่ายงานที่คุณรับผิดชอบ
          </h2>
          <SelectionGrid
            items={DEPARTMENTS}
            columns={3}
            onSelect={(dept) => { setSelectedDept(dept); setSelectedWP(null); setSelectedActivity(null); setStep(2); }}
          />
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────
          STEP 2: SELECT WORK PROCESS
          ──────────────────────────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: "1.2rem", color: "var(--ink-soft)", marginBottom: 16, fontWeight: 600 }}>
            Step 2 — เลือก Work Process ภายใต้ {selectedDept?.icon} {selectedDept?.name}
          </h2>
          <SelectionGrid
            items={availableWPs}
            columns={2}
            selected={selectedWP}
            onSelect={(wp) => { setSelectedWP(wp); setSelectedActivity(null); setStep(3); }}
          />
          <div style={{ marginTop: 20 }}>
            <button className="btn" onClick={goBack}
              style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink)" }}>
              ← กลับ
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────
          STEP 3: SELECT ACTIVITY
          ──────────────────────────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <h2 style={{ fontSize: "1.2rem", color: "var(--ink-soft)", marginBottom: 16, fontWeight: 600 }}>
            Step 3 — เลือก Activity ภายใต้ {selectedWP?.icon} {selectedWP?.name}
          </h2>
          <SelectionGrid
            items={availableActivities}
            columns={3}
            selected={selectedActivity}
            onSelect={(act) => { setSelectedActivity(act); setKpiValue(""); setChecklist({}); setStep(4); }}
          />
          <div style={{ marginTop: 20 }}>
            <button className="btn" onClick={goBack}
              style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink)" }}>
              ← กลับ
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────
          STEP 4: INSPECTION FORM
          ──────────────────────────────────────────────────────────────── */}
      {step === 4 && selectedActivity && (
        <form onSubmit={handleSubmit} style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Journey Context Banner */}
          <div style={{
            background: "linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%)",
            border: "1px solid #c7d2fe", borderRadius: 12, padding: "14px 20px",
            display: "flex", gap: 20, flexWrap: "wrap", fontSize: "0.85rem", color: "var(--ink)",
          }}>
            <span>🏢 <strong>{selectedDept?.name}</strong></span>
            <span style={{ color: "#cbd5e1" }}>›</span>
            <span>{selectedWP?.icon} <strong>{selectedWP?.name}</strong></span>
            <span style={{ color: "#cbd5e1" }}>›</span>
            <span>📋 <strong>{selectedActivity?.name}</strong></span>
            {selectedActivity.kpiId && (
              <span style={{ marginLeft: "auto", color: "#4f46e5", fontWeight: 700, fontSize: "0.78rem", background: "#e0e7ff", padding: "2px 10px", borderRadius: 99 }}>
                🧩 KPI-Linked Activity
              </span>
            )}
          </div>

          {/* Metadata */}
          <div className="card">
            <h3 style={{ marginTop: 0, color: "var(--dark)", fontSize: "1rem" }}>📋 ข้อมูลผู้บันทึก</h3>
            <div className="grid grid-2" style={{ gap: 16 }}>
              <div className="field">
                <label>ชื่อเจ้าหน้าที่</label>
                <select value={staffName} onChange={(e) => setStaffName(e.target.value)}>
                  {STAFF_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="field">
                <label>โซนที่ตรวจ</label>
                <select value={zone} onChange={(e) => setZone(e.target.value)}>
                  {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* KPI Input — only for KPI-linked activities */}
          {selectedActivity.kpiId && (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: "var(--dark)", fontSize: "1rem" }}>📊 ค่า KPI หลัก</h3>
                <span style={{ fontSize: "0.75rem", background: "#e0e7ff", color: "#4f46e5", padding: "3px 10px", borderRadius: 99, fontWeight: 700 }}>
                  🧩 Analytical AI จะประมวลผลค่านี้
                </span>
              </div>
              <div className="field">
                <label>
                  {selectedActivity.kpiLabel} <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  type="number" min="0" max={selectedActivity.kpiMax} step="0.1"
                  value={kpiValue}
                  onChange={(e) => setKpiValue(e.target.value)}
                  placeholder={selectedActivity.kpiPlaceholder}
                  required
                  style={{ fontSize: "1.2rem", padding: "12px 16px" }}
                />
              </div>

              {/* Live KPI Preview */}
              {kpiStatus && (
                <div style={{
                  marginTop: 12, padding: "12px 18px", borderRadius: 10,
                  background: kpiStatus === "Critical" ? "#fef2f2" : kpiStatus === "Warning" ? "#fffbeb" : "#f0fdf4",
                  border: `1px solid ${kpiStatus === "Critical" ? "#fca5a5" : kpiStatus === "Warning" ? "#fcd34d" : "#86efac"}`,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: "1.3rem" }}>
                    {kpiStatus === "Critical" ? "🔴" : kpiStatus === "Warning" ? "🟡" : "🟢"}
                  </span>
                  <div>
                    <strong style={{ color: kpiStatus === "Critical" ? "#dc2626" : kpiStatus === "Warning" ? "#b45309" : "#16a34a", display: "block" }}>
                      KPI Preview: {kpiStatus}
                    </strong>
                    <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                      {kpiStatus === "Normal"
                        ? `✓ ต่ำกว่าเกณฑ์เตือน (Warning ที่ ${selectedActivity.kpiWarning}${selectedActivity.kpiUnit})`
                        : kpiStatus === "Warning"
                        ? `⚠ เกินเกณฑ์เตือน — Critical ที่ ${selectedActivity.kpiCritical}${selectedActivity.kpiUnit}`
                        : `🚨 เกินเกณฑ์วิกฤต — 🧩 Analytical AI จะวิเคราะห์และส่ง Alert อัตโนมัติ`
                      }
                    </span>
                  </div>
                  {kpiStatus !== "Normal" && (
                    <span style={{ fontSize: "0.78rem", color: "#6b7280", marginLeft: "auto", textAlign: "right" }}>
                      ⚡ ระบบแจ้งเตือน<br/>ผู้บริหารอัตโนมัติ
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Checklist + Completion Rate */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <h3 style={{ margin: 0, color: "var(--dark)", fontSize: "1rem" }}>✅ รายการตรวจสอบ (Checklist)</h3>
              {/* Completion Rate Badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                  {completedCount}/{checklistItems.length} รายการ
                </span>
                <div style={{
                  background: completionRate === 100 ? "#dcfce7" : completionRate >= 70 ? "#fef9c3" : "#fee2e2",
                  color:      completionRate === 100 ? "#16a34a" : completionRate >= 70 ? "#854d0e" : "#dc2626",
                  fontWeight: 800, fontSize: "0.9rem", padding: "4px 14px", borderRadius: 99,
                }}>
                  {completionRate}% Complete
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, marginBottom: 16, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99, transition: "width 0.3s ease",
                width: `${completionRate}%`,
                background: completionRate === 100 ? "#22c55e" : completionRate >= 70 ? "#f59e0b" : "#ef4444",
              }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {checklistItems.map((item) => (
                <label
                  key={item}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                    padding: "10px 14px", background: checklist[item] ? "#f0fdf4" : "#f8fafc",
                    borderRadius: 10, border: `1px solid ${checklist[item] ? "#86efac" : "var(--line)"}`,
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!checklist[item]}
                    onChange={() => toggleChecklist(item)}
                    style={{ width: 18, height: 18, accentColor: "#22c55e" }}
                  />
                  <span style={{ color: "var(--ink)", fontSize: "0.95rem", flex: 1 }}>{item}</span>
                  {checklist[item] && <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "0.85rem" }}>✓ ผ่าน</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <h3 style={{ marginTop: 0, color: "var(--dark)", fontSize: "1rem" }}>📝 หมายเหตุเพิ่มเติม</h3>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="บันทึกสิ่งที่พบเพิ่มเติม หรือข้อสังเกตในพื้นที่..."
              rows={3} style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className="btn" onClick={goBack}
              style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink)" }}>
              ← กลับ
            </button>
            <button
              type="submit"
              className="btn"
              style={{ background: "var(--blue)", flex: 1, justifyContent: "center", opacity: submitting ? 0.7 : 1 }}
              disabled={submitting || (selectedActivity.kpiId && kpiValue === "")}
            >
              {submitting ? "กำลังส่งข้อมูล..." : "📤 ส่งรายงาน"}
            </button>
          </div>
        </form>
      )}
    </Layout>
  );
}
