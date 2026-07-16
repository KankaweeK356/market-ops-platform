// pages/api/forms/[department].js
// Event-Driven Orchestrator: Form Submitted → KPI → Rule Engine → Alert → AI Insight
import { getDb, saveDb } from "../../../lib/serverDb";

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
    const { ACTIVITIES } = await import("../../../lib/constants");
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
        alertTriggered: false,
        message: `✅ บันทึกฟอร์มสำเร็จ (${body.details?.activity ?? "Checklist"}) — Completion Rate: ${completionRate}% ไม่มี KPI ที่ต้องประเมิน`,
      });
    }

    // Has KPI — find definition and evaluate
    const kpiDef = db.kpiDefinitions.find((k) => k.id === activityDef.kpiId);
    if (!kpiDef) {
      saveDb(db);
      return res.status(201).json({ form: newForm, kpiStatus: "Normal", alertTriggered: false, message: "Form saved, KPI definition not found." });
    }

    const rawValue = parseFloat(body.kpiValue ?? body.details?.kpiValue ?? 0);
    let status = "Normal";
    if (rawValue >= kpiDef.critical) status = "Critical";
    else if (rawValue >= kpiDef.warning) status = "Warning";

    const kpiRecId = `kpir-${now}`;
    db.kpiRecords.push({
      id: kpiRecId,
      formId,
      kpiId: kpiDef.id,
      value: rawValue,
      status,
      createdAt: now + 30000, // 30 sec later
    });

    // ─── Step 3: Rule Engine — Create Alert if threshold exceeded ───────────
    let alertId = null;
    if (status !== "Normal") {
      alertId = `alrt-${now}`;
      // ─── Step 3: SLA & Business Impact Data (Gap 3 & 7) ───────────────────
      const responseSla = 15;
      const resolutionSla = department === "d-clean" ? 60 : department === "d-security" ? 45 : 90;

      let businessImpact = {
        affectedZones: `โซน ${newForm.zoneId}`,
        affectedVendors: "12 แผงค้าหลัก",
        estimatedRevenueRisk: "30,000 บาท/ชม.",
        customerImpact: "สูง (กลิ่นเหม็นรบกวนลูกค้าและสุขอนามัย)",
        operationalRisk: "เสี่ยงต่อการหลุดมาตรฐานความสะอาดตลาด"
      };

      if (department === "d-security") {
        businessImpact = {
          affectedZones: `โซน ${newForm.zoneId} และทางเข้าหลัก`,
          affectedVendors: "35 แผงค้าลานผลไม้",
          estimatedRevenueRisk: "45,000 บาท/ชม.",
          customerImpact: "วิกฤต (ลูกค้าเข้าด่านล่าช้า รถจอดขวางทางหลัก)",
          operationalRisk: "ระบบจราจรกะปฏิบัติการแออัดคอขวด"
        };
      } else if (department === "d-maintenance") {
        businessImpact = {
          affectedZones: `โซน ${newForm.zoneId} และระบบห้องเย็น`,
          affectedVendors: "8 ผู้เช่าแช่แข็งรายใหญ่",
          estimatedRevenueRisk: "90,000 บาท/ชม.",
          customerImpact: "สูง (เสี่ยงสินค้าชำรุดเสียหายคลังฝากสด)",
          operationalRisk: "เครื่องยนต์ขัดข้องหนักหากเกิด Breakdown"
        };
      }

      db.alerts.push({
        id: alertId,
        kpiRecordId: kpiRecId,
        severity: status,
        message: `${kpiDef.name} เกินค่ามาตรฐาน (${rawValue}${kpiDef.unit})`,
        businessImpact,
        createdAt: now + 60000,
      });

      // ─── Step 4: AI Insight Generation (Gap 2 & 9) ─────────────────────────
      let evidences = [];
      let reason = "";
      let whatHappened = "";
      let rootCauseChain = [];
      let aiRule = "";

      if (department === "d-clean") {
        evidences = [
          `Peak Bin Fill (Bin #1, #2) = ${rawValue}%`,
          `Other Bins Average = 12% (Outlier Anomaly Detected)`,
          `Collection Rate = Below SLA`,
        ];
        reason = "ปริมาณขยะเพิ่มขึ้นเร็วกว่าความสามารถในการจัดเก็บ เสี่ยงต่อการล้นและสุขอนามัย";
        whatHappened = `Waste Overflow ที่ ${newForm.zoneId} - ระดับขยะสูงสุด ${rawValue}% (${status})`;
        rootCauseChain = ["ปริมาณสินค้าเกินรอบปกติ", "รถรับขนถ่ายช้าลง", "ขยะเกิดสะสมหนาแน่น", "ความจุถังพักล้นเกณฑ์"];
        aiRule = `IF [Max Bin Fill > ${kpiDef.critical}%] AND [Collection Delay > 15 Min] THEN [Action Required: Targeted Emergency Collection]`;
      } else if (department === "d-security") {
        evidences = [
          `Queue Wait = ${rawValue} นาที`,
          `Gate Capacity = เต็ม 100%`,
          `External Traffic = สูงผิดปกติ`,
        ];
        reason = "จำนวนรถหนาแน่นสะสม ช่องทางปัจจุบันระบายไม่ทัน กระทบผู้ค้าและผู้ซื้อ";
        whatHappened = `Traffic Congestion ที่ ${newForm.zoneId} - คิวรอ ${rawValue} นาที (${status})`;
        rootCauseChain = ["พีคชั่วโมงผู้ซื้อหนาแน่น", "ไม่มีการจัดช่องทางระบายเสริม", "เกิดคอขวดที่ประตูตรวจบัตร", "คิวรถติดสะสมยาวนาน"];
        aiRule = `IF [Queue Time > ${kpiDef.critical} Min] AND [External Traffic = High] THEN [Action Required: Open Emergency Gate]`;
      } else {
        evidences = [
          `Temperature = ${rawValue}°C`,
          `Runtime = ต่อเนื่องไม่หยุด`,
          `Vibration Sensor = สูงผิดปกติ`,
        ];
        reason = "อุปกรณ์ทำงานหนักต่อเนื่อง ระบายความร้อนไม่ทัน เสี่ยงต่อการ Overheat และ Shutdown กะทันหัน";
        whatHappened = `Equipment Overheat ที่ ${newForm.zoneId} - อุณหภูมิ ${rawValue}°C (${status})`;
        rootCauseChain = ["ปั๊มระบายทำงานต่อเนื่อง 48 ชม.", "พัดลมระบายความร้อนหมุนช้าลง", "อุณหภูมิห้องเครื่องสูงขึ้น", "ความร้อนมอเตอร์เกินเกณฑ์สะสม"];
        aiRule = `IF [Motor Temp > ${kpiDef.critical}°C] AND [Continuous Runtime > 24 hrs] THEN [Action Required: Swap to Backup System]`;
      }

      const severityWeight = status === "Critical" ? 40 : 20;
      const riskScore = Math.min(100, severityWeight + 20 + 20 + 5);

      const options = db.decisionOptions.filter((d) => d.departmentId === department);
      const insightId = `ins-${now}`;
      db.aiInsights.push({
        id: insightId,
        alertId,
        situation: whatHappened,
        whatHappened,
        whyNow: reason,
        confidenceScore: 90 + Math.floor(Math.random() * 8),
        evidences,
        aiReasoning: aiRule,
        rootCauseChain,
        riskScore,
        responseSla,
        resolutionSla,
        recommendationIds: options.map((o) => o.id),
        createdAt: now + 90000, // 1.5 min later
      });
    }

    saveDb(db);

    return res.status(201).json({
      form: newForm,
      kpiStatus: status,
      alertTriggered: !!alertId,
      message:
        status === "Normal"
          ? `✅ บันทึกฟอร์มสำเร็จ (${activityDef?.name ?? "Activity"}) — ${kpiDef.name}: ${rawValue}${kpiDef.unit} อยู่ในเกณฑ์ปกติ`
          : `🚨 พบ ${status} — ${kpiDef.name}: ${rawValue}${kpiDef.unit} เกินมาตรฐาน · 🧩 Analytical AI วิเคราะห์และส่ง Alert ไปยังผู้บริหารแล้ว`,
    });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
