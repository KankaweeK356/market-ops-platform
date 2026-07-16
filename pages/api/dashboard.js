// pages/api/dashboard.js
import { getDb, initDb, getAiLearningLogs } from "../../lib/serverDb";

export default function handler(req, res) {
  if (req.method === 'GET') {
    const { scenario } = req.query;
    
    let db = getDb();
    if (scenario && db.currentScenario !== scenario) {
      db = initDb(scenario);
    }
    
    // 1. Calculate Today's KPIs
    const todayForms = db.inspectionForms.filter(f => f.createdAt > Date.now() - 24*60*60*1000);
    const todayKpiRecords = db.kpiRecords.filter(k => k.createdAt > Date.now() - 24*60*60*1000);
    
    // 2. Advanced Executive Health Score Logic (0-100)
    // Find latest KPI records for each dept
    const cleanKpi = todayKpiRecords.filter(k => k.kpiId === "kpi-clean-waste").sort((a,b)=>b.createdAt-a.createdAt)[0] || { value: 65 };
    const secKpi = todayKpiRecords.filter(k => k.kpiId === "kpi-security-traffic").sort((a,b)=>b.createdAt-a.createdAt)[0] || { value: 12 };
    const maintKpi = todayKpiRecords.filter(k => k.kpiId === "kpi-maint-temp").sort((a,b)=>b.createdAt-a.createdAt)[0] || { value: 72 };

    const cleanScore = Math.max(0, 100 - cleanKpi.value);
    const secScore = Math.max(0, 100 - (secKpi.value * 2));
    const maintScore = Math.max(0, 100 - Math.max(0, (maintKpi.value - 40) * 1.25));
    
    const todayHealth = Math.round((cleanScore + secScore + maintScore) / 3);

    let yesterdayHealth = 88;
    let lastWeekHealth = 91;
    let healthExplanation = "สุขภาพของระบบโดยรวมอยู่ในเกณฑ์ปกติ มีค่าความเสี่ยงค่อนข้างต่ำ";

    if (db.currentScenario === "Busy") {
      yesterdayHealth = 82;
      lastWeekHealth = 87;
      healthExplanation = "สุขภาพรวมลดลง 3% เนื่องจากเกิดปัญหาจราจรติดสะสมในช่วงเวลาเร่งด่วนของวันตลาดหนาแน่น";
    } else if (db.currentScenario === "Festival") {
      yesterdayHealth = 74;
      lastWeekHealth = 81;
      healthExplanation = "สุขภาพตลาดลดต่ำลง 8% จากเหตุวิกฤตขยะล้นลานและการระบายคิวรถขนผลไม้ติดขัดสะสมสะสมในช่วงเทศกาล";
    }

    if (todayHealth < 75) {
      healthExplanation = "🚨 สุขภาพรวมเข้าเกณฑ์เฝ้าระวังสูงสุด พบวิกฤตความร้อนมอเตอร์และขยะล้นสะสมพร้อมกัน";
    }

    // 3. SLA Analytics
    const completedTasks = db.tasks.filter(t => t.status === "Completed");
    const activeTasks = db.tasks.filter(t => t.status !== "Completed");
    
    let slaCompliance = 94.5; // fallback
    let avgResponseTime = 8.2; // mins
    let avgResolutionTime = 38.5; // mins

    if (completedTasks.length > 0) {
      let withinSlaCount = 0;
      let totalResponse = 0;
      let totalResolution = 0;
      
      completedTasks.forEach(t => {
        const duration = (t.updatedAt - t.createdAt) / 60000; // in mins
        if (duration <= (t.resolutionSla || 60)) {
          withinSlaCount++;
        }
        totalResolution += duration;
        totalResponse += t.responseSla || 8;
      });
      
      slaCompliance = Math.round((withinSlaCount / completedTasks.length) * 100);
      avgResolutionTime = parseFloat((totalResolution / completedTasks.length).toFixed(1));
      avgResponseTime = parseFloat((totalResponse / completedTasks.length).toFixed(1));
    }

    // 4. Active Insights with Explainability, Risk prioritization, & Business Impacts
    const activeInsights = db.aiInsights.filter(insight => {
      const hasDecision = db.executiveDecisions.some(dec => dec.aiInsightId === insight.id);
      return !hasDecision;
    }).map(insight => {
      const alert = db.alerts.find(a => a.id === insight.alertId);
      const kpiRecord = db.kpiRecords.find(k => k.id === alert.kpiRecordId);
      const kpiDef = db.kpiDefinitions.find(k => k.id === kpiRecord.kpiId);
      const form = db.inspectionForms.find(f => f.id === kpiRecord.formId);
      const options = insight.recommendationIds.map(optId => db.decisionOptions.find(o => o.id === optId));

      return {
        ...insight,
        alert,
        kpiRecord,
        kpiDef,
        form,
        options
      };
    });

    // Sort by Risk Score descending (Gap 4)
    activeInsights.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));

    // 5. Build resolved incidents for Outcomes (Gap 6)
    const resolvedIncidents = db.tasks
      .filter((t) => t.status === "Completed")
      .slice(-5) // Last 5 completed
      .reverse()
      .map((task) => {
        const decision = db.executiveDecisions.find((d) => d.id === task.decisionId);
        if (!decision) return null;
        const insight = db.aiInsights.find((i) => i.id === decision.aiInsightId);
        if (!insight) return null;
        const alert = db.alerts.find((a) => a.id === insight.alertId);
        if (!alert) return null;
        const kpiRecord = db.kpiRecords.find((k) => k.id === alert.kpiRecordId);
        const kpiDef = kpiRecord ? db.kpiDefinitions.find((k) => k.id === kpiRecord.kpiId) : null;
        const chosenOption = db.decisionOptions.find((o) => o.id === decision.chosenOptionId);
        
        // Retrieve accuracy and outcome metrics
        return {
          taskId: task.id,
          taskTitle: task.title,
          completedAt: task.updatedAt,
          kpiStatus: kpiRecord?.status || "Normal",
          kpiValue: kpiRecord?.value,
          kpiUnit: kpiDef?.unit || "",
          kpiName: kpiDef?.name || "",
          decision: chosenOption?.optionText || "",
          expectedImpact: chosenOption?.expectedImpact || null,
          actualOutcomeValue: task.actualOutcomeValue || (kpiRecord ? kpiRecord.value : null),
          accuracy: task.accuracy || "96.5%",
          learningApplied: task.learningApplied || "No record"
        };
      })
      .filter(Boolean);

    // Compute dynamic emergency budget used from approved supervisor requests
    const approvedRequests = (db.supervisorRequests || []).filter(r => r.status === "Approved");
    const dynamicBudgetUsed = approvedRequests.reduce((sum, r) => sum + r.cost, 0);

    res.status(200).json({
      currentScenario: db.currentScenario,
      health: {
        score: todayHealth,
        scoreLabel: todayHealth >= 90 ? "Excellent" : todayHealth >= 80 ? "Good" : todayHealth >= 70 ? "Warning" : "Critical",
        color: todayHealth >= 90 ? "#10b981" : todayHealth >= 80 ? "#3b82f6" : todayHealth >= 70 ? "#f59e0b" : "#ef4444",
        yesterday: yesterdayHealth,
        lastWeek: lastWeekHealth,
        explanation: healthExplanation
      },
      dataQuality: db.dataQuality,
      sla: {
        compliance: slaCompliance,
        avgResponse: avgResponseTime,
        avgResolution: avgResolutionTime
      },
      todayStats: {
        formsSubmitted: todayForms.length,
        criticalAlerts: todayKpiRecords.filter(k => k.status === "Critical").length,
        warningAlerts: todayKpiRecords.filter(k => k.status === "Warning").length,
      },
      emergencyBudgetUsed: `${dynamicBudgetUsed.toLocaleString()} บาท`,
      activeInsights,
      resolvedIncidents,
      supervisorRequests: db.supervisorRequests || [],
      aiLearningLogs: getAiLearningLogs(),
      latestKpis: {
        "kpi-clean-waste": { 
          value: cleanKpi.value, 
          status: cleanKpi.status,
          detail: cleanKpi.status === "Critical" ? "วิกฤต 2 ถัง · ปกติ 8 ถัง" : cleanKpi.status === "Warning" ? "เฝ้าระวัง 1 ถัง · ปกติ 9 ถัง" : "ปกติ 10 ถัง"
        },
        "kpi-security-traffic": { 
          value: secKpi.value, 
          status: secKpi.status,
          detail: secKpi.status === "Critical" ? "ด่าน Gate 3 คิวหนาแน่น · ช่องอื่นปกติ" : secKpi.status === "Warning" ? "ด่าน Gate 3 ชะลอตัว · ช่องอื่นปกติ" : "ผ่านสะดวกทุกด่านหลัก"
        },
        "kpi-maint-temp": { 
          value: maintKpi.value, 
          status: maintKpi.status,
          detail: maintKpi.status === "Critical" ? "ปั๊ม M-01 ร้อนสูง · ปั๊มสำรองทำงานแทน" : maintKpi.status === "Warning" ? "ปั๊ม M-01 อุณหภูมิสะสม · สแตนด์บาย" : "อุณหภูมิปกติทุกเครื่อง"
        }
      },
      tasks: {
        active: activeTasks.length,
        completed: completedTasks.length
      },
      predictiveForecast: db.predictiveForecast || null,
    });
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
