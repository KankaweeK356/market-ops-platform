// pages/api/forms/[department].js
// Event-Driven Orchestrator: Form Submitted → KPI → Rule Engine → Alert → AI Insight
import { getDb, saveDb } from "../../../lib/serverDb";
import { ACTIVITIES } from "../../../lib/constants"; // ✅ นำเข้าแบบ Static ไว้บนสุดของไฟล์

export default function handler(req, res) {
  const { department } = req.query;
  const db = getDb();

  if (req.method === "GET") {
    // Return form history for this department
    const forms = db.inspectionForms
      .filter((f) => f.departmentId === department)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
    return res.status(200).json(forms);
  }

  if (req.method === "POST") {
    const body = req.body;
    const now = Date.now();

    // ─── Step 1: Save Inspection Form (with Process Hierarchy) ─────────────
    const formId = `form-${now}`;
    const newForm = {
      id: formId,
      departmentId:  department,
      workProcessId: body.workProcessId || null,  // NEW: WP hierarchy
      activityId:    body.activityId    || null,  // NEW: Activity hierarchy
      zoneId:        body.zoneId        || "ไม่ระบุ",
      submittedBy:   body.submittedBy   || "Staff",
      details:       body.details       || {},
      createdAt: now,
    };
    db.inspectionForms.push(newForm);

    // ─── Step 2: Evaluate KPI — only for KPI-linked Activities ─────────────
    // If activityId is provided, lookup the specific KPI for that activity.
    // Activities with kpiId: null will skip KPI evaluation entirely.
    
    // ✅ ลบคำสั่ง await import ออก และเรียกใช้ ACTIVITIES ที่นำเข้าจากด้านบนได้เลย
    const activityDef = body.activityId
      ? ACTIVITIES.find((a) => a.id === body.activityId)
      : null;

    // No KPI linked to this activity → save form only (Checklist mode)
    if (!activityDef?.kpiId) {
      saveDb(db);
      const completionRate = body.details?.completionRate ?? 0;
      return res.status(201).json({
        form: newForm,
        kpiStatus: "Normal",