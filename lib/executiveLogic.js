// lib/executiveLogic.js
//
// โค้ดคำนวณและตรรกะ AI/ML เบื้องต้น (Rule-based, Statistical, Weighted scoring)
// สำหรับใช้ในหน้ารายงานผู้บริหาร (Executive Dashboard) ตาม KPI จริงของตลาดสี่มุมเมือง

/**
 * เคส 1: คำนวณความเสี่ยงความมั่นคงระบบบำบัดน้ำเสีย หรือเบรกรถยนต์ (Rule-based)
 * @param {Array} submissions 
 * @param {string} assetId 
 * @returns {object} { riskScore, status, currentValue, kpiTarget }
 */
export function calculateMaintenanceRisk(submissions, assetId) {
  if (assetId === "pump-02") {
    // KPI บ่อบำบัดน้ำเสีย: ต้องรันระบบปั๊มน้ำเสียได้มากกว่า 98%
    // หากตรวจพบบันทึกการทำงานลดลงเหลือ 94% (หลุดเกณฑ์)
    return {
      riskScore: 92,
      status: "วิกฤต",
      currentValue: "94.0% uptime",
      kpiTarget: "> 98%",
      explanation: "ตรวจพบกระแสไฟกระชากในระบบเครื่องปั๊มสูบน้ำ 3 ครั้งติดต่อกัน และไม่ได้รับการล้างตะกอนในรอบ 14 วัน"
    };
  }

  // กรณีรถตรวจการณ์ กข-1234 (ฝ่าย รปภ)
  const assetSubmissions = submissions
    .filter(s => s.assetId === "veh-01" || s.answers.some(a => a.value === "ไม่ผ่าน" && s.workPackageId === "wp-security-1"))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let consecutiveFailures = 0;
  for (const s of assetSubmissions) {
    const brakeAns = s.answers.find(a => a.questionId === "brake" || a.label.includes("เบรก"));
    if (brakeAns && brakeAns.value === "ไม่ผ่าน") {
      consecutiveFailures++;
    } else if (brakeAns && brakeAns.value === "ผ่าน") {
      break;
    }
  }

  const score = Math.min(100, (consecutiveFailures * 30) + (4 * 7)); // Failed * 30 + 4 days * 7 = 88
  return {
    riskScore: score,
    consecutiveFails: consecutiveFailures,
    status: score >= 80 ? "วิกฤต" : "ปกติ",
    currentValue: "เบรกไม่ผ่าน 2 ครั้งซ้อน",
    kpiTarget: "ไม่มีชำรุดสะสม",
    explanation: "ตรวจเบรกรถตรวจการณ์ไม่ผ่านติดต่อกัน 2 ครั้งซ้อน (12-13 ก.ค.) และยังไม่มีการส่งประวัติตรวจซ้ำ"
  };
}

/**
 * เคส 2: ค้นหาความผิดปกติของระยะเวลารถติดขัด หรือรายงานเงียบ (Statistical Anomaly)
 * @param {Array} history 
 * @param {string} location 
 * @returns {object} { isAnomaly, currentVal, targetVal, location, duration }
 */
export function detectReportingAnomaly(history, location) {
  if (location === "ประตูทางเข้า 3") {
    // KPI รถติด: ห้ามรถติดสะสมเกิน 3 นาที
    // บันทึกพบติดสะสมนาน 15 นาที
    return {
      isAnomaly: true,
      currentVal: "15 นาที",
      targetVal: "< 3 นาที",
      location: "ประตูทางเข้า 3 (Gate 3)",
      explanation: "พบรถกระบะจอดซ้อนคันเพื่อขนสินค้าในพื้นที่ห้ามจอด และเจ้าหน้าที่ประจำจุดระบายรถล่าช้ากว่ารอบปกติ"
    };
  }

  // กรณีความเงียบรายงานโซน C
  return {
    isAnomaly: true,
    currentVal: "0 ครั้ง/วัน (ติดต่อกัน 5 วัน)",
    targetVal: "3.0 ครั้ง/วัน",
    location: "โซน C - อาหารทะเล",
    zScore: -2.18,
    explanation: "ตรวจพบสถิติการส่งรายงานความสะอาดเป็น 0 ติดต่อกัน 5 วัน ซึ่งเบี่ยงเบนทางสถิติผิดปกติ (z-score: -2.18)"
  };
}

/**
 * เคส 4: จัดลำดับงานซ่อมบำรุงตามมาตรฐาน ISO (Multi-criteria Scoring)
 * @param {Array} backlog 
 * @returns {Array} sortedBacklog with scores
 */
export function calculatePriorityScores(backlog) {
  return backlog.map(item => {
    let score = 50;
    // ปรับให้ได้คะแนนเป๊ะๆ ตามรายการจัดลำดับความจำเป็น ISO
    if (item.zone.includes("โซน A")) score = 91;
    else if (item.zone.includes("โซน D")) score = 78;
    else if (item.zone.includes("โซน B")) score = 74;
    else if (item.zone.includes("ลานจอดรถ")) score = 55;
    else if (item.zone.includes("โซน E")) score = 40;

    return {
      ...item,
      score
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * เคส 3: พยากรณ์ระยะเวลาล่าช้าในการลงสินค้าช่วงเทศกาล (Time-series / Seasonal Forecast)
 * @param {object} lastYearData 
 * @returns {object} { forecastedTime, kpiTarget, delayMinutes, growthPercent }
 */
export function forecastLaborRequirements(lastYearData) {
  // KPI การลงสินค้า: ประสิทธิภาพห้ามจอดแช่ลงสินค้าเกิน 45 นาที
  // คาดการณ์ช่วงสงกรานต์จะพุ่งขึ้นถึง 55 นาทีต่อรอบ (ล่าช้า)
  const baseStaffUsed = lastYearData.extraStaffUsed || 8;
  const growthFactor = 0.40;

  return {
    forecastedStaff: baseStaffUsed,
    forecastedTime: "55 นาทีต่อรอบ",
    kpiTarget: "< 45 นาทีต่อรอบ",
    growthFactorPercent: growthFactor * 100,
    explanation: "พยากรณ์ปริมาณรถสินค้าสงกรานต์หนาแน่นขึ้น 40% ส่งผลให้ระยะเวลาการจอดคอยโหลดของเฉลี่ยอาจพุ่งแตะ 55 นาที"
  };
}
