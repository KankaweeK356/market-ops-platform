// lib/serverDb.js
import { DEPARTMENTS, ZONES } from "./constants";

const globalCache = global;
if (!globalCache.__db) {
  globalCache.__db = null;
}
if (!globalCache.__aiLearningLogs) {
  globalCache.__aiLearningLogs = [
    { timestamp: Date.now() - 3600000 * 4, epoch: 124, event: "Completed clean scenario simulation", accuracy: "96.8%", record: "Adjusted waste prediction bias by -1.2%" },
    { timestamp: Date.now() - 3600000 * 2, epoch: 125, event: "Completed security queue simulation", accuracy: "98.2%", record: "Updated traffic routing prediction weight by +0.8%" }
  ];
}

export function initDb(scenario = "Normal") {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  // Scenario Config
  let severityMultiplier = 1.0;
  let scenarioName = "Normal Day";
  if (scenario === "Busy") {
    severityMultiplier = 1.4;
    scenarioName = "Busy Market Day";
  } else if (scenario === "Festival") {
    severityMultiplier = 1.9;
    scenarioName = "Festival Day (Peak)";
  }

  // --- 1. KPI GOVERNANCE MASTER DATA ---
  const kpiDefinitions = [
    { 
      id: "kpi-clean-waste", 
      departmentId: "d-clean", 
      name: "Waste Overflow Rate", 
      warning: 80, 
      critical: 90, 
      unit: "%", 
      formula: "Max(IoT Bin Fill Level_1..n) in Target Zone", 
      description: "ระดับขยะของถังที่แน่นที่สุดในโซน เพื่อป้องกันปัญหาค่าเฉลี่ยกลบวิกฤตเฉพาะจุด (Outlier Masking)",
      businessPurpose: "ป้องกันปัญหาขยะล้นและสุขอนามัยในพื้นที่ตลาดค้าส่งตามเกณฑ์มาตรฐานความสะอาดและสิ่งแวดล้อม",
      target: "< 70%",
      owner: "ฝ่ายรักษาความสะอาด", 
      dataSource: "IoT Bin Fill Sensors + Visual Inspections",
      updateFreq: "Real-time (ทุก 5 นาที)" 
    },
    { 
      id: "kpi-security-traffic", 
      departmentId: "d-security", 
      name: "Traffic Queue Time", 
      warning: 15, 
      critical: 30, 
      unit: "นาที", 
      formula: "Average Wait Time from Gate Entry to Parking", 
      description: "ระยะเวลารอคอยเฉลี่ยสะสมตั้งแต่รถเข้าด่านทางเข้าหลักจนถึงพื้นที่จัดจอดรถขนถ่าย",
      businessPurpose: "รักษาความคล่องตัวในการคมนาคมและระบายความแออัดของรถบรรทุกหนักในช่วงหัวค่ำ",
      target: "< 10 นาที",
      owner: "ฝ่ายรักษาความปลอดภัย", 
      dataSource: "RFID Gate Sensor + License Plate Recognition (LPR)",
      updateFreq: "Real-time (ทุก 1 นาที)" 
    },
    { 
      id: "kpi-maint-temp", 
      departmentId: "d-maintenance", 
      name: "Motor Temperature", 
      warning: 85, 
      critical: 90, 
      unit: "°C", 
      formula: "Peak Temperature Sensor Reading", 
      description: "อุณหภูมิสูงสุดของปั๊มสูบน้ำและคอมเพรสเซอร์เครื่องเย็นหลัก",
      businessPurpose: "ป้องกันระบบขัดข้องฉุกเฉิน (Breakdown) ที่จะส่งผลต่อความเสียหายของสินค้าสดหรือบ่อบำบัดน้ำเสีย",
      target: "< 75°C",
      owner: "ฝ่ายซ่อมบำรุง", 
      dataSource: "SCADA Modbus Temperature Sensors",
      updateFreq: "1 Min (ทุก 1 นาที)" 
    }
  ];

  // --- 2. DECISION INTELLIGENCE MASTER DATA ---
  const decisionOptions = [
    { 
      id: "opt-truck", departmentId: "d-clean", 
      optionText: "เพิ่มรถเก็บขยะฉุกเฉิน", 
      impactDesc: "ระดมรถขุดตักเสริมลดขยะสะสมทันที", 
      expectedImpact: { before: "96%", after: "72%", eta: "40 นาที" },
      resourceNeeded: "ทีมล้างขยะพิเศษ 1 ทีม + รถคีบ 1 คัน",
      costLevel: "สูง (High)", riskReduction: "90%",
      aiScore: 88, aiRankReason: "Risk reduction 90% สูง · ETA 40 นาที เร็วพอ · ต้นทุนสูงแต่คุ้มค่าต่อ Business Impact ที่เสี่ยง",
    },
    { 
      id: "opt-round", departmentId: "d-clean", 
      optionText: "เพิ่มรอบเก็บปกติ", 
      impactDesc: "เพิ่มความถี่รถขนขยะเข้าเตาเผาชั่วคราว", 
      expectedImpact: { before: "96%", after: "85%", eta: "2 ชั่วโมง" },
      resourceNeeded: "รถบรรทุกขนขยะรอบเสริม 2 เที่ยว",
      costLevel: "ต่ำ (Low)", riskReduction: "60%",
      aiScore: 58, aiRankReason: "ต้นทุนต่ำแต่ Risk Reduction เพียง 60% และ ETA นาน 2 ชม. อาจไม่ทันสถานการณ์วิกฤต",
    },
    { 
      id: "opt-gate", departmentId: "d-security", 
      optionText: "เปิด Gate 3 เพิ่มเติม", 
      impactDesc: "ระบายรถคอขวดสะสมออกสู่ทางออกรอง", 
      expectedImpact: { before: "32 นาที", after: "12 นาที", eta: "15 นาที" },
      resourceNeeded: "เจ้าหน้าที่ รปภ. จัดจราจรพิเศษ 2 นาย",
      costLevel: "ต่ำ (Low)", riskReduction: "95%",
      aiScore: 96, aiRankReason: "Risk reduction 95% สูงสุด · ETA 15 นาที เร็วมาก · ต้นทุนต่ำ · ประสิทธิภาพสูงสุดเทียบต้นทุน",
    },
    { 
      id: "opt-police", departmentId: "d-security", 
      optionText: "ประสานจราจรกลาง", 
      impactDesc: "ขอความช่วยเหลือโบกรถภายนอกตลาดบนถนนพหลโยธิน", 
      expectedImpact: { before: "32 นาที", after: "25 นาที", eta: "30 นาที" },
      resourceNeeded: "ผู้ช่วยติดต่อประสานงานตำรวจทางหลวง",
      costLevel: "ไม่มี (None)", riskReduction: "50%",
      aiScore: 52, aiRankReason: "ไม่มีต้นทุนแต่ Risk Reduction เพียง 50% และ ETA 30 นาที ช้ากว่าทางเลือกอื่น",
    },
    { 
      id: "opt-repair", departmentId: "d-maintenance", 
      optionText: "ส่งทีมซ่อมฉุกเฉิน", 
      impactDesc: "ซ่อมพัดลมระบายความร้อนเพื่อประคองรอบใช้งาน", 
      expectedImpact: { before: "92°C", after: "Stopped", eta: "10 นาที" },
      resourceNeeded: "วิศวกรไฟฟ้า 2 นาย + เครื่องมือสำรอง",
      costLevel: "ปานกลาง (Medium)", riskReduction: "85%",
      aiScore: 82, aiRankReason: "Risk reduction 85% ดี · ETA 10 นาที เร็ว · ต้นทุนปานกลาง · ซ่อมตรงสาเหตุ",
    },
    { 
      id: "opt-backup", departmentId: "d-maintenance", 
      optionText: "สลับใช้ปั๊มสำรอง", 
      impactDesc: "สลับระบบไฟไปยังปั๊มตัวสำรองที่อุณหภูมิปกติ", 
      expectedImpact: { before: "92°C", after: "45°C", eta: "5 นาที" },
      resourceNeeded: "ช่างเทคนิคควบคุมไฟ 1 นาย",
      costLevel: "ต่ำ (Low)", riskReduction: "98%",
      aiScore: 97, aiRankReason: "Risk reduction 98% สูงสุด · ETA 5 นาที เร็วที่สุด · ต้นทุนต่ำ · ดีที่สุดสำหรับสถานการณ์ฉุกเฉิน",
    },
  ];


  // --- 3. TRANSACTION DATA STORAGE ---
  const inspectionForms = [];
  const kpiRecords = [];
  const alerts = [];
  const aiInsights = [];
  const executiveDecisions = [];
  const tasks = [];
  const taskHistory = [];

  // Helper to generate a complete chain of events
  const generateChain = (deptId, kpiDef, daysAgo, statusType) => {
    const time = now - (daysAgo * dayMs) + (Math.random() * 3600000);
    const formId = `form-${time}`;
    const kpiRecId = `kpir-${time}`;
    const alertId = `alrt-${time}`;
    const insightId = `ins-${time}`;
    const decId = `dec-${time}`;
    const taskId = `tsk-${time}`;

    inspectionForms.push({
      id: formId, 
      departmentId: deptId, 
      zoneId: ZONES[Math.floor(Math.random() * ZONES.length)],
      submittedBy: "Staff-" + Math.floor(Math.random() * 10 + 1), 
      createdAt: time
    });

    let value = 0; 
    let status = "Normal";
    if (statusType === "Critical") {
      value = Math.min(98.5, kpiDef.critical + parseFloat((Math.random() * 8 * severityMultiplier).toFixed(1)) + 1);
      status = "Critical";
    } else if (statusType === "Warning") {
      value = parseFloat((kpiDef.warning + Math.random() * (kpiDef.critical - kpiDef.warning)).toFixed(1));
      status = "Warning";
    } else {
      value = parseFloat((Math.max(30, kpiDef.warning - Math.random() * 20 - 10)).toFixed(1));
      status = "Normal";
    }

    kpiRecords.push({
      id: kpiRecId, 
      formId, 
      kpiId: kpiDef.id, 
      value, 
      status, 
      createdAt: time + 60000 
    });

    if (status !== "Normal") {
      // SLA parameters
      const responseSla = 15; // 15 mins response SLA
      const resolutionSla = deptId === "d-clean" ? 60 : deptId === "d-security" ? 45 : 90; // Resolution SLA

      // Business Impact data
      let businessImpact = {
        affectedZones: "โซน C (อาหารทะเล) และ ลานจอดรถหลัก",
        affectedVendors: `${Math.floor(15 * severityMultiplier)} แผงค้าหลัก`,
        estimatedRevenueRisk: `${(25000 * severityMultiplier).toLocaleString()} บาท/ชม.`,
        customerImpact: "สูง (กลิ่นเหม็นรบกวนลูกค้าและผู้สัญจร)",
        operationalRisk: "เสี่ยงต่อการหลุดมาตรฐานสุขอนามัย ISO 14001"
      };

      if (deptId === "d-security") {
        businessImpact = {
          affectedZones: "ทางเข้าหลัก (Gate 3) และลานจอดรถผักผลไม้",
          affectedVendors: `${Math.floor(45 * severityMultiplier)} แผงค้าบริเวณลานชานชาลา`,
          estimatedRevenueRisk: `${(60000 * severityMultiplier).toLocaleString()} บาท/ชม.`,
          customerImpact: "วิกฤต (ผู้ซื้อเข้าตลาดช้า คิวจราจรล้นออกถนนหลัก)",
          operationalRisk: "ความปลอดภัยในการเข้าเดินรถขนถ่ายสินค้าล้นคอขวด"
        };
      } else if (deptId === "d-maintenance") {
        businessImpact = {
          affectedZones: "ห้องเย็นเก็บรักษาความสด อาคาร B",
          affectedVendors: `${Math.floor(8 * severityMultiplier)} ผู้ค้าส่งรายใหญ่ห้องฝากแช่`,
          estimatedRevenueRisk: `${(120000 * severityMultiplier).toLocaleString()} บาท/ชม.`,
          customerImpact: "สูง (เสี่ยงสินค้าผักใบเหี่ยวเฉาชำรุดเสียหาย)",
          operationalRisk: "ระบบทำความเย็นเสียหายหนักหากเครื่องดับกะทันหัน"
        };
      }

      // Root Cause chain (Cause -> Effect)
      let rootCauseChain = ["ปริมาณสินค้าเกินรอบปกติ", "รถรับขนถ่ายช้าลง", "ขยะเกิดสะสมหนาแน่น", "ความจุถังพักล้นเกณฑ์"];
      if (deptId === "d-security") {
        rootCauseChain = ["พีคชั่วโมงผู้ซื้อหนาแน่น", "ไม่มีการจัดช่องทางระบายเสริม", "เกิดคอขวดที่ประตูตรวจบัตร", "คิวรถติดสะสมยาวนาน"];
      } else if (deptId === "d-maintenance") {
        rootCauseChain = ["ปั๊มระบายทำงานต่อเนื่อง 48 ชม.", "พัดลมระบายความร้อนหมุนช้าลง", "อุณหภูมิห้องเครื่องสูงขึ้น", "ความร้อนมอเตอร์เกินเกณฑ์สะสม"];
      }

      // AI Reasoning logic rule representation
      const alertMessage = `${kpiDef.name} เกินค่ามาตรฐาน (${value}${kpiDef.unit})`;
      alerts.push({
        id: alertId, 
        kpiRecordId: kpiRecId, 
        severity: status, 
        message: alertMessage, 
        businessImpact,
        createdAt: time + 120000
      });

      // Calculate Risk Score (0-100)
      const severityWeight = status === "Critical" ? 40 : 20;
      const urgencyWeight = Math.floor(15 * severityMultiplier);
      const impactWeight = deptId === "d-maintenance" ? 30 : 20;
      const trendWeight = Math.random() > 0.5 ? 10 : 5; // rising vs steady
      const riskScore = Math.min(100, severityWeight + urgencyWeight + impactWeight + trendWeight);

      const options = decisionOptions.filter(d => d.departmentId === deptId);
      
      let evidences = [];
      let reason = "";
      let aiRule = "";

      if (deptId === "d-clean") {
        evidences = [`Peak Bin Fill (Bin #1, #2) = ${value}%`, `Other Bins Average = 12% (Outlier Anomaly Detected)`, `Collection Delay = 22 min`];
        reason = "ปริมาณขยะเพิ่มขึ้นเร็วกว่ารอบการเก็บเนื่องจากปริมาณรถขนของหนาแน่น";
        aiRule = `IF [Max Bin Fill > ${kpiDef.critical}%] AND [Collection Delay > 15 Min] THEN [Action Required: Targeted Emergency Collection]`;
      } else if (deptId === "d-security") {
        evidences = [`Queue Wait = ${value} min`, `LPR Wait Time = ${value} min`, `External Queue = ${Math.floor(20 * severityMultiplier)} trucks`];
        reason = "ช่องบริการทางเข้าระบายรถได้ช้ากว่าอัตราความเร็วรถขาเข้าในช่วงพีค";
        aiRule = `IF [Queue Time > ${kpiDef.critical} Min] AND [External Traffic = High] THEN [Action Required: Open Emergency Gate]`;
      } else {
        evidences = [`Motor Temp = ${value}°C`, `Continuous Runtime = 48 hrs`, `Vibration = Warning level`];
        reason = "ปั๊มสูบน้ำทำงานหนักต่อเนื่อง พัดลมชำรุดทำให้อุณหภูมิเครื่องพุ่งทะลุจุดปลอดภัย";
        aiRule = `IF [Motor Temp > ${kpiDef.critical}°C] AND [Continuous Runtime > 24 hrs] THEN [Action Required: Swap to Backup System]`;
      }

      aiInsights.push({
        id: insightId, 
        alertId,
        situation: `พบปัญหา ${kpiDef.name} สูงผิดปกติที่ระดับ ${status}`,
        whyNow: reason,
        confidenceScore: 90 + Math.floor(Math.random() * 8), // 90-98%
        evidences,
        aiReasoning: aiRule,
        rootCauseChain,
        riskScore,
        responseSla,
        resolutionSla,
        recommendationIds: options.map(o => o.id),
        createdAt: time + 180000
      });

      if (daysAgo > 0) {
        // Complete the loop for historic items
        executiveDecisions.push({
          id: decId, 
          aiInsightId: insightId, 
          chosenOptionId: options[0].id,
          approvedBy: "Executive-1", 
          createdAt: time + 360000
        });
        
        const completedTime = time + 400000 + Math.floor(Math.random() * 1200000 + 1200000); // 40-60 mins later
        tasks.push({
          id: taskId, 
          decisionId: decId, 
          departmentId: deptId, 
          title: `ดำเนินการ: ${options[0].optionText}`,
          status: "Completed", 
          responseSla,
          resolutionSla,
          createdAt: time + 400000, 
          updatedAt: completedTime
        });

        taskHistory.push({ id: `th-${time}-1`, taskId, oldStatus: "Pending", newStatus: "In Progress", changedAt: time + 500000 });
        taskHistory.push({ id: `th-${time}-2`, taskId, oldStatus: "In Progress", newStatus: "Completed", changedAt: completedTime });
      }
    }
  };

  const dCleanKpi = kpiDefinitions.find(k => k.id === "kpi-clean-waste");
  const dSecKpi = kpiDefinitions.find(k => k.id === "kpi-security-traffic");
  const dMaintKpi = kpiDefinitions.find(k => k.id === "kpi-maint-temp");

  // Historic data generation (last 30 days)
  for (let i = 30; i >= 1; i--) {
    const rand = Math.random();
    let statusType = "Normal";
    if (rand > (0.9 - (severityMultiplier-1)*0.2)) statusType = "Critical";
    else if (rand > (0.7 - (severityMultiplier-1)*0.2)) statusType = "Warning";

    generateChain("d-clean", dCleanKpi, i, statusType);
    generateChain("d-security", dSecKpi, i, statusType === "Critical" ? "Normal" : "Warning");
    generateChain("d-maintenance", dMaintKpi, i, statusType === "Warning" ? "Critical" : "Normal");
  }

  // Active Scenarios for Demo (Today)
  generateChain("d-clean", dCleanKpi, 0, "Critical");
  generateChain("d-security", dSecKpi, 0, "Critical");
  generateChain("d-maintenance", dMaintKpi, 0, "Critical");

  const dataQuality = {
    completeness: 98.4,
    missing: 1.2,
    duplicate: 0.4,
    invalid: 0.0,
    lastUpdated: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };

  const supervisorRequests = [
    { id: "req-1", departmentId: "d-clean", title: "ขอจัดสรรคลอรีนล้างสิ่งปฏิกูลเพิ่มบริเวณ Zone C", status: "Approved", cost: 15000, createdAt: now - 3600000 * 2, approvedAt: now - 3600000 * 1.8 },
    { id: "req-2", departmentId: "d-security", title: "ขอโควต้าจ้าง รปภ. นอกเวลาราชการเสริมวันเสาร์อาทิตย์", status: "Approved", cost: 25000, createdAt: now - 3600000 * 4, approvedAt: now - 3600000 * 3.5 }
  ];

  if (scenario === "Busy") {
    supervisorRequests.push({ id: "req-3", departmentId: "d-security", title: "ขอนโยบายจัดจราจรร่วมด่านทางด่วนช่วงรถคิวล้น", status: "Pending", cost: 10000, createdAt: now - 1800000 });
  } else if (scenario === "Festival") {
    supervisorRequests.push({ id: "req-4", departmentId: "d-clean", title: "ขออนุมัติเหมาจ่ายรอบเก็บขยะเพิ่มเติม Zone C ฉุกเฉิน", status: "Pending", cost: 45000, createdAt: now - 1200000 });
    supervisorRequests.push({ id: "req-5", departmentId: "d-maintenance", title: "ของบฉุกเฉินจัดหาคอมเพรสเซอร์สำรองปั๊มสูบเย็นอาคาร B", status: "Pending", cost: 75000, createdAt: now - 600000 });
  }

  // ─── PREDICTIVE AI FORECAST (Fixed by Scenario, not random) ────────────────
  // Deterministic forecast values based on historical scenario patterns.
  // DO NOT use Math.random() here — values must be stable for Demo reproducibility.
  const FORECAST_PROFILES = {
    Normal: {
      waste:     { currentPct: 45, forecastPct: 50, delta: "+5%",   trend: "stable",  confidence: 88, timeframe: "2 ชั่วโมง" },
      traffic:  { currentMin: 8,  forecastMin: 11,  delta: "+3 min", trend: "stable",  confidence: 85, timeframe: "2 ชั่วโมง" },
      equipment: { currentTemp: 68, forecastTemp: 72, delta: "+4°C",  trend: "stable",  confidence: 90, timeframe: "4 ชั่วโมง" },
    },
    Busy: {
      waste:     { currentPct: 72, forecastPct: 90, delta: "+18%",  trend: "rising",  confidence: 91, timeframe: "2 ชั่วโมง" },
      traffic:  { currentMin: 18, forecastMin: 43,  delta: "+25 min",trend: "rising",  confidence: 89, timeframe: "2 ชั่วโมง" },
      equipment: { currentTemp: 79, forecastTemp: 87, delta: "+8°C",  trend: "rising",  confidence: 87, timeframe: "4 ชั่วโมง" },
    },
    Festival: {
      waste:     { currentPct: 91, forecastPct: 97, delta: "+42%",  trend: "critical", confidence: 94, timeframe: "1.5 ชั่วโมง" },
      traffic:  { currentMin: 32, forecastMin: 58,  delta: "+60 min",trend: "critical", confidence: 92, timeframe: "1.5 ชั่วโมง" },
      equipment: { currentTemp: 88, forecastTemp: 95, delta: "+15°C", trend: "critical", confidence: 91, timeframe: "3 ชั่วโมง" },
    },
  };
  const predictiveForecast = {
    scenario,
    basis: "Predictive AI Forecast based on historical scenario simulation",
    generatedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    ...FORECAST_PROFILES[scenario] ?? FORECAST_PROFILES.Normal,
  };

  globalCache.__db = {
    currentScenario: scenario,
    departments: DEPARTMENTS,
    zones: ZONES,
    kpiDefinitions,
    decisionOptions,
    inspectionForms,
    kpiRecords,
    alerts,
    aiInsights,
    executiveDecisions,
    tasks,
    taskHistory,
    supervisorRequests,
    dataQuality,
    predictiveForecast,  // NEW: Predictive AI Forecast (scenario-fixed)
  };

  return globalCache.__db;
}

export function getDb() {
  if (globalCache.__db) return globalCache.__db;
  return initDb();
}

export function saveDb(newData) {
  globalCache.__db = newData;
}

export function getAiLearningLogs() {
  return globalCache.__aiLearningLogs;
}

export function addAiLearningLog(log) {
  globalCache.__aiLearningLogs.push({
    timestamp: Date.now(),
    epoch: globalCache.__aiLearningLogs.length + 125,
    ...log
  });
  // Keep last 15 logs
  if (globalCache.__aiLearningLogs.length > 15) {
    globalCache.__aiLearningLogs.shift();
  }
}
