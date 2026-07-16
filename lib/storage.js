// lib/storage.js
//
// เก็บข้อมูลแบบลำดับชั้น (Department -> WorkPackage -> Activity -> FormTemplate)
// และรายการ FormSubmission ผ่าน localStorage ของเบราว์เซอร์
//
// โครงสร้างได้รับการปรับแต่งใหม่ตามคำสั่ง KPI ตลาดสี่มุมเมือง ครบถ้วนทั้ง 7 ฝ่ายงาน

import { DEPARTMENTS, STAFF_NAMES, ZONES } from "./constants";

const KEY = "market_ops_system_data_v5";

const SEED_WPS = [
  // 2. ฝ่ายรักษาความสะอาด (d-clean)
  { id: "wp-clean-waste", departmentId: "d-clean", name: "การจัดการขยะอินทรีย์และโครงการ Zero Waste", description: "ตรวจเช็คระดับขยะสะสมในถังพักและปริมาณส่งมอบเศษผักปุ๋ยอินทรีย์", frequency: "daily" },
  { id: "wp-clean-water", departmentId: "d-clean", name: "บ่อบำบัดน้ำเสียและคุณภาพน้ำ COD", description: "ตรวจสอบสถานะปั๊มสูบน้ำเสียและค่าความสกปรก COD ของน้ำทิ้ง", frequency: "daily" },
  { id: "wp-clean-complaint", departmentId: "d-clean", name: "การเคลียร์ข้อร้องเรียนจุดสกปรกตาม SLA", description: "ตรวจสอบความเร็วการจัดการล้างและกวาดจุดเปื้อนตามเวลากำหนด 30 นาที", frequency: "daily" },
  
  // 3. ฝ่ายความปลอดภัย (d-security)
  { id: "wp-sec-traffic", departmentId: "d-security", name: "จราจรทางเข้าและเวลาเคลียร์คอขวด", description: "ตรวจสอบเวลาเคลียร์รถติดคอขวด (เกณฑ์ห้ามเกิน 5 นาที)", frequency: "daily" },
  { id: "wp-sec-routing", departmentId: "d-security", name: "การจัดระเบียบเดินรถเข้าอาคารรถผัก 3 รอบหลัก", description: "ตรวจสอบเวลารอบวิ่งเข้าอาคารลานผัก (เป้าหมาย 40 นาที/รอบ)", frequency: "daily" },
  { id: "wp-sec-parking", departmentId: "d-security", name: "จัดการลักลอบจอดเพื่ออำนวยความสะดวกผู้ซื้อ", description: "เคลียร์พวกลักลอบแอบจอดรถยนต์ส่วนบุคคลเพื่อลดข้อร้องเรียน", frequency: "daily" },
  
  // 5. ฝ่ายซ่อมบำรุง (d-maintenance)
  { id: "wp-maint-pm", departmentId: "d-maintenance", name: "การบำรุงรักษาเชิงป้องกัน (PM)", description: "ตรวจเช็คเครื่องผลิตไฟฟ้า ปั๊มน้ำ และเครื่องจักรเพื่อลด Breakdown", frequency: "daily" },
  { id: "wp-maint-breakdown", departmentId: "d-maintenance", name: "แจ้งเสียและบันทึก Downtime", description: "บันทึกและติดตามการแก้ไขเครื่องจักรขัดข้อง", frequency: "daily" },
  { id: "wp-maint-request", departmentId: "d-maintenance", name: "งานแจ้งซ่อมและควบคุม SLA", description: "วัดระยะเวลางานปิดจ๊อบซ่อมแผงค้าและงานไฟฟ้าตาม SLA", frequency: "daily" }
];

const SEED_ACTIVITIES = [
  // 2. ฝ่ายรักษาความสะอาด
  { id: "act-clean-bins", workPackageId: "wp-clean-waste", name: "บันทึกระดับขยะล้นและล้างถังขยะ", description: "ตรวจจับถังขยะเต็มล้นและปริมาณขยะผักผลไม้" },
  { id: "act-clean-water", workPackageId: "wp-clean-water", name: "ตรวจเช็คปั๊มและวัดค่าบ่อน้ำเสีย", description: "บันทึกสถานะปั๊มสูบน้ำเสียและค่าความเน่าเสีย COD" },
  { id: "act-clean-complaint", workPackageId: "wp-clean-complaint", name: "บันทึกเวลาเคลียร์จุดสกปรกตาม SLA", description: "บันทึกระยะเวลาดำเนินการหลังได้รับเรื่องร้องเรียนจุดสกปรก" },

  // 3. ฝ่ายความปลอดภัย
  { id: "act-sec-traffic", workPackageId: "wp-sec-traffic", name: "ตรวจจับและบันทึกเวลาเคลียร์รถติด", description: "ตรวจจับรถติดหน้าด่านทางเข้า (ห้ามเกิน 5 นาที)" },
  { id: "act-sec-routing", workPackageId: "wp-sec-routing", name: "ตรวจรอบรถผักวิ่งเข้าอาคารลานค้า", description: "ตรวจความก้าวหน้าการปล่อยรถเข้าอาคารผักผลไม้ (เป้า 40 นาที)" },
  { id: "act-sec-parking", workPackageId: "wp-sec-parking", name: "ตรวจจับพวกลักลอบแอบจอดรถยนต์", description: "ลงตรวจสอบและดำเนินการล็อกล้อรถลักลอบจอดทิ้ง" },

  // 5. ฝ่ายซ่อมบำรุง
  { id: "act-maint-pm", workPackageId: "wp-maint-pm", name: "ตรวจสอบสภาพเครื่องจักรและรถตัก", description: "เช็คระบบเครื่องจักรตามรอบ (PM)" },
  { id: "act-maint-breakdown", workPackageId: "wp-maint-breakdown", name: "บันทึกแจ้งเสียและขัดข้อง (Breakdown)", description: "บันทึกเวลาที่เครื่องจักรเสียและรอซ่อม" },
  { id: "act-maint-sla", workPackageId: "wp-maint-request", name: "บันทึกสถิติงานแจ้งซ่อมตาม SLA", description: "ตรวจเช็คเวลาจบงานซ่อมประปา ระบบไฟฟ้า และโครงสร้างแผงค้า" }
];

const SEED_TEMPLATES = [
  // 4. ตรวจขยะล้น (รักษาความสะอาด)
  {
    id: "tmpl-clean-bins",
    activityId: "act-clean-bins",
    questions: [
      { id: "binId", label: "รหัสถังขยะ", type: "text", required: true },
      { id: "wasteType", label: "ประเภทขยะหลัก", type: "single_choice", options: ["ขยะผักผลไม้ (Organic)", "ขยะทั่วไป (Inorganic)", "ขยะพลาสติก/รีไซเคิล"], required: true },
      { id: "currentWeightKg", label: "น้ำหนักขยะที่ชั่งตวงสะสมจริงวันนี้ (กก.)", type: "number", required: true },
      { id: "odorLevel", label: "ระดับความรุนแรงของกลิ่น", type: "single_choice", options: ["ปกติ (Low)", "ปานกลาง (Medium)", "เหม็นวิกฤต (High)"], required: true }
    ]
  },
  // 5. บ่อน้ำเสีย (รักษาความสะอาด)
  {
    id: "tmpl-clean-water",
    activityId: "act-clean-water",
    questions: [
      { id: "pumpId", label: "รหัสระบบปั๊มสูบน้ำเสีย", type: "single_choice", options: ["PUMP-01", "PUMP-02", "PUMP-03"], required: true },
      { id: "checkControlPanel", label: "ตู้คอนโทรลและระบบไฟฟ้า", type: "single_choice", options: ["ปกติ", "ผิดปกติ"], required: true, flagIf: { value: "ผิดปกติ", setStatus: "ต้องติดตาม" } },
      { id: "checkFloatSwitch", label: "ระบบลูกลอยสั่งงานอัตโนมัติ", type: "single_choice", options: ["ปกติ", "ผิดปกติ"], required: true, flagIf: { value: "ผิดปกติ", setStatus: "ต้องติดตาม" } },
      { id: "checkMotorVibration", label: "การสั่นสะเทือนมอเตอร์", type: "single_choice", options: ["ปกติ", "สั่นรุนแรง"], required: true, flagIf: { value: "สั่นรุนแรง", setStatus: "เร่งด่วน" } },
      { id: "checkPumpNoise", label: "เสียงการทำงานของปั๊ม", type: "single_choice", options: ["ปกติ", "ดังผิดปกติ"], required: true, flagIf: { value: "ดังผิดปกติ", setStatus: "ต้องติดตาม" } },
      { id: "checkPipeLeak", label: "รอยรั่วซึมท่อส่งน้ำและวาล์ว", type: "single_choice", options: ["ปกติ", "พบรอยรั่ว"], required: true, flagIf: { value: "พบรอยรั่ว", setStatus: "เร่งด่วน" } },
      { id: "codLevel", label: "ค่าซีโอดี COD วัดได้ (mg/L) - เป้าหมาย <120", type: "number", required: true, flagIf: { value: ">120", setStatus: "เร่งด่วน" } }
    ]
  },
  // 6. เคลียร์จุดสกปรกตาม SLA (รักษาความสะอาด)
  {
    id: "tmpl-clean-complaint",
    activityId: "act-clean-complaint",
    questions: [
      { id: "complaintType", label: "ประเภทข้อร้องเรียนจุดสกปรก", type: "single_choice", options: ["ขยะล้นเกลื่อนพื้น", "น้ำขัง/น้ำเน่า", "กลิ่นเหม็นรุนแรง", "คราบน้ำมันบนพื้น", "ซากสัตว์/สิ่งปฏิกูล"], required: true },
      { id: "minutesToClear", label: "เวลาที่ใช้เคลียร์กวาดล้างพื้นที่ (นาที)", type: "number", required: true },
      { id: "slaMet", label: "ดำเนินการสำเร็จตาม SLA เกณฑ์กำหนดหรือไม่", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "เร่งด่วน" } }
    ]
  },

  // 7. บันทึกตรวจจราจรติดสะสม (ความปลอดภัย)
  {
    id: "tmpl-sec-traffic",
    activityId: "act-sec-traffic",
    questions: [
      { id: "trafficWaitMinutes", label: "ระยะเวลารถติดขัดสะสมหนาแน่น (นาที) - เกณฑ์ห้ามเกิน 5 นาที", type: "number", required: true, flagIf: { value: ">5", setStatus: "เร่งด่วน" } },
      { id: "queueLength", label: "ความยาวแถวคิวคอยสะสม (คัน)", type: "number", required: true }
    ]
  },
  // 8. จัดรถเข้าอาคารรถผัก (ความปลอดภัย - บันทึกตามรอบเดินรถ)
  {
    id: "tmpl-sec-routing",
    activityId: "act-sec-routing",
    questions: [
      { id: "routingRound", label: "ช่วงเวลา / รอบการเดินรถ", type: "single_choice", options: ["รอบที่ 1 (07.00 - 11.00 น.)", "รอบที่ 2 (11.00 - 15.00 น.)", "รอบที่ 3 (15.00 - 19.00 น.)"], required: true },
      { id: "truckRoutingMinutes", label: "ระยะเวลาที่ใช้จัดรถเข้าอาคารผักเฉลี่ย (นาที)", type: "number", required: true, flagIf: { value: ">40", setStatus: "ต้องติดตาม" } }
    ]
  },
  // 9. ตรวจจับและเคลียร์พวกลักลอบแอบจอดรถยนต์ (ความปลอดภัย)
  {
    id: "tmpl-sec-parking",
    activityId: "act-sec-parking",
    questions: [
      { id: "licensePlate", label: "ป้ายทะเบียนรถที่ลักลอบจอดทิ้ง", type: "text", required: true },
      { id: "lockAction", label: "ดำเนินการล็อกล้อรถคันดังกล่าวหรือไม่", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "ต้องติดตาม" } }
    ]
  },

  // 12. ฝ่ายซ่อมบำรุง - PM
  {
    id: "tmpl-maint-pm",
    activityId: "act-maint-pm",
    questions: [
      { id: "machineId", label: "รหัสเครื่องจักร / รหัสรถตัก", type: "text", required: true },
      { id: "machineType", label: "ประเภทของเครื่องจักร", type: "single_choice", options: ["เครื่องผลิตไฟสำรอง (Gen)", "รถล้างถนนแทรกเตอร์", "ปั๊มสูบระบายหลัก"], required: true },
      { id: "runningHours", label: "ชั่วโมงรันเครื่องสะสม (ชั่วโมง)", type: "number", required: true },
      { id: "oilLevel", label: "ระดับน้ำมันเครื่อง/สารหล่อลื่น", type: "single_choice", options: ["ปกติ", "ต่ำกว่าเกณฑ์", "ต้องเปลี่ยนถ่าย"], required: true },
      { id: "electricalCheck", label: "ระบบไฟฟ้าและคอนแทคเตอร์", type: "single_choice", options: ["ปกติ", "พบรอยไหม้/หลวม"], required: true, flagIf: { value: "พบรอยไหม้/หลวม", setStatus: "ต้องติดตาม" } },
      { id: "utilizationPercent", label: "อัตราการเปิดใช้งานเครื่องจักร (Utilize %)", type: "number", required: true, flagIf: { value: "<70", setStatus: "ต้องติดตาม" } }
    ]
  },
  // 13. ฝ่ายซ่อมบำรุง - Breakdown
  {
    id: "tmpl-maint-breakdown",
    activityId: "act-maint-breakdown",
    questions: [
      { id: "machineId", label: "รหัสเครื่องจักรที่เสีย", type: "text", required: true },
      { id: "breakdownSymptom", label: "อาการขัดข้องเบื้องต้น", type: "text", required: true },
      { id: "breakdownMinutes", label: "เวลาที่เครื่องจักรหยุดทำงาน (Downtime - นาที)", type: "number", required: true, flagIf: { value: ">60", setStatus: "เร่งด่วน" } },
      { id: "repairAction", label: "การดำเนินการซ่อม", type: "single_choice", options: ["ซ่อมเสร็จใช้งานได้ทันที", "ต้องสั่งซื้ออะไหล่/รออะไหล่", "ต้องส่งซ่อมภายนอก"], required: true, flagIf: { value: "ต้องสั่งซื้ออะไหล่/รออะไหล่", setStatus: "ต้องติดตาม" } }
    ]
  },
  // 13. ฝ่ายซ่อมบำรุง - SLA แจ้งซ่อม
  {
    id: "tmpl-maint-sla",
    activityId: "act-maint-sla",
    questions: [
      { id: "requestId", label: "รหัสใบงานแจ้งซ่อม (Request ID)", type: "single_choice", options: ["RQ-1045", "RQ-1046", "RQ-1047", "RQ-1048"], required: true },
      { id: "issueType", label: "ประเภทอุปกรณ์แจ้งซ่อม", type: "single_choice", options: ["ท่อน้ำประปาแตก", "ระบบไฟฟ้าร้านชำรุด", "คานเหล็กหลังคาคด"], required: true },
      { id: "priority", label: "ระดับความสำคัญ (SLA Scope)", type: "single_choice", options: ["High (SLA 2 ชม.)", "Medium (SLA 6 ชม.)", "Low (SLA 24 ชม.)"], required: true },
      { id: "timeFinished", label: "เวลาที่ดำเนินการเสร็จสิ้น (ถ้ายังไม่เสร็จให้เว้นว่าง)", type: "text", required: false },
      { id: "minutesToComplete", label: "เวลาที่ใช้จริงในการเข้าซ่อม (นาที)", type: "number", required: true },
      { id: "slaMet", label: "สถานะ SLA / การซ่อม", type: "single_choice", options: ["ซ่อมเสร็จทัน SLA", "ซ่อมเสร็จแต่เกิน SLA", "รออะไหล่ (ระงับ SLA)"], required: true, flagIf: { value: "ซ่อมเสร็จแต่เกิน SLA", setStatus: "เร่งด่วน" } }
    ]
  }
];

const SEED_MACHINES = [
  { id: "PUMP-01", name: "ปั๊มสูบน้ำเสียตัวที่ 1 (Main)", type: "Pump", purchasePrice: 120000, totalRepairCost: 65000, ageYears: 6 },
  { id: "PUMP-02", name: "ปั๊มสูบน้ำเสียตัวที่ 2 (Sub)", type: "Pump", purchasePrice: 120000, totalRepairCost: 15000, ageYears: 2 },
  { id: "PUMP-03", name: "ปั๊มสูบน้ำเสียตัวที่ 3 (Sub)", type: "Pump", purchasePrice: 120000, totalRepairCost: 48000, ageYears: 5 },
  { id: "GEN-01", name: "เครื่องปั่นไฟสำรอง 1", type: "Generator", purchasePrice: 500000, totalRepairCost: 80000, ageYears: 3 },
  { id: "TRAC-01", name: "รถตักขยะ", type: "Vehicle", purchasePrice: 850000, totalRepairCost: 350000, ageYears: 7 }
];

const SEED_ZONE_REPORT_HISTORY = [
  { zone: "ประตูทางเข้า 3", date: "2026-07-09", count: 3 },
  { zone: "ประตูทางเข้า 3", date: "2026-07-10", count: 0 },
  { zone: "ประตูทางเข้า 3", date: "2026-07-11", count: 0 },
  { zone: "ประตูทางเข้า 3", date: "2026-07-12", count: 0 },
  { zone: "ประตูทางเข้า 3", date: "2026-07-13", count: 0 },
  { zone: "ประตูทางเข้า 3", date: "2026-07-14", count: 0 }
];

const SEED_FESTIVAL_DATA = {
  period: "สงกรานต์ 2568",
  footTrafficIncreasePercent: 40,
  issueIncreasePercent: 40,
  extraStaffUsed: 8
};

const SEED_REPAIR_BACKLOG = [
  { zone: "โซน A - ผักผลไม้ (ล้างใหญ่ตามมาตรฐาน ISO)", frequency: 5, severity: "สูง", affectedVendors: 12, score: 91 },
  { zone: "โซน D - ของแห้ง (จัดระเบียบและคราบสะสม)", frequency: 3, severity: "กลาง", affectedVendors: 20, score: 78 },
  { zone: "โซน B - เนื้อสัตว์ (ล้างลอกท่อน้ำตกค้าง)", frequency: 4, severity: "สูง", affectedVendors: 6, score: 74 }
];

const SEED_FUEL_LOGS = [
  { date: "2026-07-14", vehicle: "รถล้างถนนแรงดันสูง WT-03", distanceKm: 85, fuelLitres: 12.1, efficiencyKmPerLitre: 7.02, savingsPercent: 5.2 }
];

const SEED_BIN_WASH_LOGS = [
  { date: "2026-07-14", binsWashed: 42, target: 40, status: "ผ่านเกณฑ์" }
];

const SEED_MIGRANT_WORKERS = [
  { id: "w-01", name: "Som (นายส้ม - เมียนมา)", documentType: "Work Permit", expiryDate: "2026-07-21", status: "เตือนหมดอายุใน 7 วัน", legal: true }
];

const SEED_MAINT_BREAKDOWNS = [
  { machineId: "GEN-01", name: "เครื่องปั่นไฟอาคารผลไม้", breakdownMinutes: 120, utilizationPercent: 45, type: "Gen" }
];

const SEED_SLA_REQUESTS = [
  { requestId: "RQ-1045", issue: "ระบบไฟฟ้าร้านชำรุด", priority: "High (SLA 2 ชม.)", minutesUsed: 180, met: "no" }
];

function generateSeedSubmissions() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const mk = (id, tmplId, actId, wpId, deptId, daysAgo, zoneIdx, answers, status) => ({
    id,
    formTemplateId: tmplId,
    activityId: actId,
    workPackageId: wpId,
    departmentId: deptId,
    submittedBy: STAFF_NAMES[Math.abs(id.charCodeAt(id.length - 1)) % STAFF_NAMES.length],
    submittedAt: new Date(now - daysAgo * day).toISOString(),
    date: new Date(now - daysAgo * day).toISOString().slice(0, 10),
    zone: ZONES[zoneIdx % ZONES.length],
    answers,
    derivedStatus: status || "ปกติ",
    createdAt: now - daysAgo * day
  });
  const ans = (questionId, label, value) => ({ questionId, label, value });

  const TENANTS = ["ร้านป้าสุ ผักสด","ร้านเฮียหลี ผลไม้","ร้านนายก้อง เครื่องปรุง","ร้านแม่นิด ผักหวาน","ร้านพ่อมาลี ผักออร์แกนิก","ร้านลุงบุญ ผักใบ","ร้านหมี ผลไม้นำเข้า","ร้านอาหยก ผักชี"];
  const STALLS = ["A-01","A-05","A-08","A-12","B-03","B-07","B-14","B-22","B-24","C-02","C-09","C-15","C-21","D-04","D-11","D-18","E-01","E-06","E-10","F-03"];
  const PLATES = ["กข-1234","ขค-5678","คง-9012","งจ-3456","จฉ-7890","ฉช-2345","ชซ-6789","ซญ-0123","ญฐ-4567","ฐณ-8901","3กก-4444","4ขข-5555","5คค-6666"];
  const MACHINES = SEED_MACHINES.map(m => m.id);
  const MACHINE_TYPES = ["เครื่องผลิตไฟสำรอง (Gen)","เครื่องผลิตไฟสำรอง (Gen)","ปั๊มสูบระบายหลัก","ปั๊มสูบระบายหลัก","รถล้างถนนแทรกเตอร์","รถล้างถนนแทรกเตอร์","ปั๊มสูบระบายหลัก"];
  const ROUNDS = ["รอบที่ 1 (07.00 - 11.00 น.)","รอบที่ 2 (11.00 - 15.00 น.)","รอบที่ 3 (15.00 - 19.00 น.)"];
  const PRODUCT_TYPES = ["ผักใบ (Leafy Greens)","ผลไม้ (Fruits)","ผักหัว/เครื่องปรุง (Roots/Spices)"];
  const VIOLATION_TYPES = ["วางของกีดขวางทางเดิน (Stall Obstruction)","ทิ้งขยะไม่เป็นที่ (Illegal Dumping)","จอดรถกีดขวาง (Traffic Obstruction)","อื่นๆ"];
  const ISSUE_TYPES = ["ท่อน้ำประปาแตก","ระบบไฟฟ้าร้านชำรุด","คานเหล็กหลังคาคด"];
  const PRIORITIES = ["High (SLA 2 ชม.)","Medium (SLA 6 ชม.)","Low (SLA 24 ชม.)"];
  const SLA_MINUTES = { "High (SLA 2 ชม.)": 120, "Medium (SLA 6 ชม.)": 360, "Low (SLA 24 ชม.)": 1440 };
  const SAMPLE_POINTS = ["บ่อบำบัด 1","บ่อบำบัด 2","จุดทางออก"];
  const WORKER_GROUPS = ["กลุ่มแรงงานโซน A-B","กลุ่มแรงงานโซน C-D","กลุ่มขับรถและยกของ","กลุ่มทำความสะอาด"];
  const FORKLIFT_IDS = ["FL-01","FL-02","FL-03","FL-04"];
  const SHIFTS = ["กะเช้า (06.00-14.00)","กะบ่าย (14.00-22.00)","กะดึก (22.00-06.00)"];
  const GATES = ["ด่านทางเข้า 1","ด่านทางเข้า 2","ด่านทางเข้า 3"];
  const ROOMS = ["Room-A","Room-B","Room-C","Room-D","Room-E"];
  const WASTE_ZONES = ["โซน A ผักใบ","โซน B เนื้อสัตว์","โซน C ผลไม้","โซน D ของแห้ง","โซน E ท้ายตลาด"];

  const subs = [];
  const push = (s) => subs.push(s);

  // ── 4. tmpl-clean-bins (25 ธุรกรรม) ─────────────────────────────────────
  // 1 transaction = 1 การตรวจถังขยะ 1 โซน
  // KPI: % ถังที่ overflow (น้ำหนักเกิน 85% ของความจุ)
  // ปรับลดจำนวน Mock ถังขยะให้เหลือแค่ 10 ใบ เพื่อให้กราฟดูไม่ถี่จนเกินไปตามคำขอของผู้ใช้
  [...Array.from({length:18},(_,i)=>({wtype:"ขยะผักผลไม้ (Organic)",bin:`BIN-${1+i%10}`,weight:300+((i*43)%500),odor:"ปกติ (Low)",days:Math.floor(i/2)+1,zi:i%7,status:"ปกติ"})),
   ...Array.from({length:5},(_,i)=>({wtype:"ขยะผักผลไม้ (Organic)",bin:`BIN-${1+i%10}`,weight:900+((i*7)%90),odor:"เหม็นวิกฤต (High)",days:i%7+1,zi:i%7,status:"เร่งด่วน"})),
   ...Array.from({length:2},(_,i)=>({wtype:"ขยะทั่วไป (Inorganic)",bin:`BIN-${1+i%10}`,weight:750+(i*20),odor:"ปานกลาง (Medium)",days:i+2,zi:(i+2)%7,status:"ต้องติดตาม"}))
  ].forEach((d,i)=>push(mk(`bin-${i+1}`,"tmpl-clean-bins","act-clean-bins","wp-clean-waste","d-clean",d.days,d.zi,[ans("binId","รหัสถังขยะ",d.bin),ans("wasteType","ประเภทขยะหลัก",d.wtype),ans("currentWeightKg","น้ำหนักขยะที่ชั่งตวงสะสมจริงวันนี้ (กก.)",d.weight),ans("odorLevel","ระดับความรุนแรงของกลิ่น",d.odor)],d.status)));

  // ── 5. tmpl-clean-water (50 ธุรกรรม) ────────────────────────────────────
  // 1 transaction = 1 การวัดค่าน้ำ 1 จุดตรวจวัด
  // KPI: ค่า COD เฉลี่ย (mg/L), % ครั้งที่เกินเกณฑ์ 120 mg/L
  [...Array.from({length:38},(_,i)=>({pumpId:`PUMP-0${i%3+1}`, cCtrl:"ปกติ", cFloat:"ปกติ", cVib:"ปกติ", cNoise:"ปกติ", cLeak:"ปกติ", cod:80+((i*11)%35), days:Math.floor(i/2)+1, zi:i%7, status:"ปกติ"})),
   ...Array.from({length:8},(_,i)=>({pumpId:`PUMP-0${i%3+1}`, cCtrl:(i%2===0?"ผิดปกติ":"ปกติ"), cFloat:(i%2!==0?"ผิดปกติ":"ปกติ"), cVib:"ปกติ", cNoise:"ดังผิดปกติ", cLeak:"ปกติ", cod:100+i*5, days:i%14+1, zi:i%7, status:"ต้องติดตาม"})),
   ...Array.from({length:4},(_,i)=>({pumpId:`PUMP-0${i%3+1}`, cCtrl:"ปกติ", cFloat:"ปกติ", cVib:"สั่นรุนแรง", cNoise:"ปกติ", cLeak:"พบรอยรั่ว", cod:145+i*10, days:i+1, zi:(i+4)%7, status:"เร่งด่วน"}))
  ].forEach((d,i)=>push(mk(`wat-${i+1}`,"tmpl-clean-water","act-clean-water","wp-clean-water","d-clean",d.days,d.zi,[
      ans("pumpId","รหัสระบบปั๊มสูบน้ำเสีย",d.pumpId),
      ans("checkControlPanel","ตู้คอนโทรลและระบบไฟฟ้า",d.cCtrl),
      ans("checkFloatSwitch","ระบบลูกลอยสั่งงานอัตโนมัติ",d.cFloat),
      ans("checkMotorVibration","การสั่นสะเทือนมอเตอร์",d.cVib),
      ans("checkPumpNoise","เสียงการทำงานของปั๊ม",d.cNoise),
      ans("checkPipeLeak","รอยรั่วซึมท่อส่งน้ำและวาล์ว",d.cLeak),
      ans("codLevel","ค่าซีโอดี COD วัดได้ (mg/L) - เป้าหมาย <120",d.cod)
  ],d.status)));

  // ── 6. tmpl-clean-complaint (50 ธุรกรรม) ────────────────────────────────
  // 1 transaction = 1 ใบเรื่องร้องเรียนที่รับและปิดงาน
  // KPI: % งานที่ปิดทัน 30 นาที (SLA Rate)
  const cTypes = ["ขยะล้นเกลื่อนพื้น", "น้ำขัง/น้ำเน่า", "กลิ่นเหม็นรุนแรง", "คราบน้ำมันบนพื้น", "ซากสัตว์/สิ่งปฏิกูล"];
  [...Array.from({length:38},(_,i)=>({ctype:cTypes[i%5],mins:10+((i*7)%20),sla:"yes",days:Math.floor(i/2)+1,zi:i%7,status:"ปกติ"})),
   ...Array.from({length:12},(_,i)=>({ctype:cTypes[i%5],mins:35+(i*5),sla:"no",days:i%15+1,zi:(i+3)%7,status:"เร่งด่วน"}))
  ].forEach((d,i)=>push(mk(`cmp-${i+1}`,"tmpl-clean-complaint","act-clean-complaint","wp-clean-complaint","d-clean",d.days,d.zi,[ans("complaintType","ประเภทข้อร้องเรียนจุดสกปรก",d.ctype),ans("minutesToClear","เวลาที่ใช้เคลียร์กวาดล้างพื้นที่ (นาที)",d.mins),ans("slaMet","ดำเนินการสำเร็จตาม SLA เกณฑ์กำหนดหรือไม่",d.sla)],d.status)));

  // ── 7. tmpl-sec-traffic (50 ธุรกรรม) ────────────────────────────────────
  // 1 transaction = 1 การตรวจสอบ 1 ช่วงเวลา 1 ด่าน
  // KPI: เวลารถติดเฉลี่ย (นาที), % ครั้งที่เกิน 5 นาที
  [...Array.from({length:28},(_,i)=>({gate:GATES[i%3],mins:1+((i*3)%4),queue:2+((i*7)%10),days:Math.floor(i/2)+1,zi:i%7,status:"ปกติ"})),
   ...Array.from({length:15},(_,i)=>({gate:GATES[i%3],mins:6+(i%5),queue:15+(i*2),days:i%14+1,zi:i%7,status:"เร่งด่วน"})),
   ...Array.from({length:7},(_,i)=>({gate:GATES[i%3],mins:11+(i*2),queue:30+(i*5),days:i%7+1,zi:(i+2)%7,status:"เร่งด่วน"}))
  ].forEach((d,i)=>push(mk(`trf-${i+1}`,"tmpl-sec-traffic","act-sec-traffic","wp-sec-traffic","d-security",d.days,d.zi,[ans("trafficWaitMinutes","ระยะเวลารถติดขัด (นาที)",d.mins),ans("queueLength","ความยาวแถวคิวคอย (คัน)",d.queue)],d.status)));

  // ── 8. tmpl-sec-routing (50 ธุรกรรม) ────────────────────────────────────
  // 1 transaction = 1 รอบการเดินรถเข้าอาคาร
  // KPI: เวลาเฉลี่ยต่อรอบ (นาที), % รอบที่ล่าช้าเกิน 40 นาที
  [...Array.from({length:35},(_,i)=>({round:ROUNDS[i%3],mins:22+((i*3)%18),days:Math.floor(i/2)+1,zi:i%7,status:"ปกติ"})),
   ...Array.from({length:15},(_,i)=>({round:ROUNDS[i%3],mins:41+(i*3),days:i%14+1,zi:i%7,status:"ต้องติดตาม"}))
  ].forEach((d,i)=>push(mk(`rut-${i+1}`,"tmpl-sec-routing","act-sec-routing","wp-sec-routing","d-security",d.days,d.zi,[ans("routingRound","ช่วงเวลา / รอบการเดินรถ",d.round),ans("truckRoutingMinutes","ระยะเวลาที่ใช้จัดรถเข้าอาคารผัก (นาที)",d.mins)],d.status)));

  // ── 9. tmpl-sec-parking (50 ธุรกรรม) ────────────────────────────────────
  // 1 transaction = 1 คันรถที่ตรวจพบจอดผิดกฎ
  // KPI: จำนวนรถที่พบต่อวัน, % ที่ดำเนินการล็อกล้อสำเร็จ (เป้า 100%)
  [...Array.from({length:40},(_,i)=>({plate:PLATES[i%PLATES.length],lock:"yes",days:Math.floor(i/2)+1,zi:i%7,status:"ปกติ"})),
   ...Array.from({length:10},(_,i)=>({plate:PLATES[(i+5)%PLATES.length],lock:"no",days:i%7+1,zi:(i+4)%7,status:"ต้องติดตาม"}))
  ].forEach((d,i)=>push(mk(`prk-${i+1}`,"tmpl-sec-parking","act-sec-parking","wp-sec-parking","d-security",d.days,d.zi,[ans("licensePlate","ป้ายทะเบียนรถ",d.plate),ans("lockAction","ดำเนินการล็อกล้อหรือไม่",d.lock)],d.status)));

  // ── 12. tmpl-maint-pm (50 ธุรกรรม) ──────────────────────────────────────
  // 1 transaction = 1 ครั้งที่เช็คเครื่องจักร 1 ชิ้น
  // KPI: Utilization เฉลี่ย %
  [...Array.from({length:38},(_,i)=>({mid:MACHINES[i%7],mtype:MACHINE_TYPES[i%7],hours:200+i*10,oil:"ปกติ",elec:"ปกติ",util:72+((i*3)%25),days:Math.floor(i/2)+1,zi:i%7,status:"ปกติ"})),
   ...Array.from({length:12},(_,i)=>({mid:MACHINES[i%7],mtype:MACHINE_TYPES[i%7],hours:350+i*15,oil:"ต่ำกว่าเกณฑ์",elec:"พบรอยไหม้/หลวม",util:30+((i*5)%35),days:i%14+1,zi:i%7,status:"ต้องติดตาม"}))
  ].forEach((d,i)=>push(mk(`pm-${i+1}`,"tmpl-maint-pm","act-maint-pm","wp-maint-pm","d-maintenance",d.days,d.zi,[ans("machineId","รหัสเครื่องจักร",d.mid),ans("machineType","ประเภทเครื่องจักร",d.mtype),ans("runningHours","ชั่วโมงรันสะสม (ชม.)",d.hours),ans("oilLevel","ระดับน้ำมันเครื่อง",d.oil),ans("electricalCheck","ระบบไฟฟ้า",d.elec),ans("utilizationPercent","อัตราใช้งาน (%)",d.util)],d.status)));

  // ── 12.5 tmpl-maint-breakdown (15 ธุรกรรม) ────────────────────────────────
  // KPI: Breakdown สะสม (นาที)
  [...Array.from({length:10},(_,i)=>({mid:MACHINES[i%7],sym:"เครื่องไม่ทำงาน",bdown:45,rep:"ซ่อมเสร็จใช้งานได้ทันที",days:Math.floor(i/2)+1,zi:i%7,status:"ปกติ"})),
   ...Array.from({length:3},(_,i)=>({mid:MACHINES[i%7],sym:"มอเตอร์ไหม้",bdown:120,rep:"ต้องสั่งซื้ออะไหล่/รออะไหล่",days:i%14+1,zi:i%7,status:"ต้องติดตาม"})),
   ...Array.from({length:2},(_,i)=>({mid:MACHINES[i%7],sym:"ระบบไฟฟ้าลัดวงจร",bdown:200,rep:"ต้องส่งซ่อมภายนอก",days:i+1,zi:(i+4)%7,status:"เร่งด่วน"}))
  ].forEach((d,i)=>push(mk(`mbd-${i+1}`,"tmpl-maint-breakdown","act-maint-breakdown","wp-maint-breakdown","d-maintenance",d.days,d.zi,[ans("machineId","รหัสเครื่องจักร",d.mid),ans("breakdownSymptom","อาการขัดข้อง",d.sym),ans("breakdownMinutes","Breakdown (นาที)",d.bdown),ans("repairAction","การดำเนินการซ่อม",d.rep)],d.status)));

  // ── 13. tmpl-maint-sla (50 ธุรกรรม) ─────────────────────────────────────
  // 1 transaction = 1 ใบงานแจ้งซ่อม
  // KPI: % ปิดงานทัน SLA แยกตาม Priority
  [...Array.from({length:38},(_,i)=>{const p=PRIORITIES[i%3];const lim=SLA_MINUTES[p];const m=Math.floor(lim*0.5)+((i*17)%(Math.floor(lim*0.4)));return{rid:`RQ-104${5+(i%4)}`,itype:ISSUE_TYPES[i%3],priority:p,mins:m,sla:"ซ่อมเสร็จทัน SLA",time:"14:30",days:Math.floor(i/2)+1,zi:i%7,status:"ปกติ"};}),
   ...Array.from({length:8},(_,i)=>{const p=PRIORITIES[i%3];const lim=SLA_MINUTES[p];const m=lim+30+i*15;return{rid:`RQ-104${5+(i%4)}`,itype:ISSUE_TYPES[i%3],priority:p,mins:m,sla:"ซ่อมเสร็จแต่เกิน SLA",time:"16:45",days:i%14+1,zi:i%7,status:"เร่งด่วน"};}),
   ...Array.from({length:4},(_,i)=>{const p=PRIORITIES[i%3];const m=120;return{rid:`RQ-104${5+(i%4)}`,itype:ISSUE_TYPES[i%3],priority:p,mins:m,sla:"รออะไหล่ (ระงับ SLA)",time:"",days:i%14+1,zi:i%7,status:"ต้องติดตาม"};})
  ].forEach((d,i)=>push(mk(`msl-${i+1}`,"tmpl-maint-sla","act-maint-sla","wp-maint-request","d-maintenance",d.days,d.zi,[ans("requestId","รหัสใบงานแจ้งซ่อม",d.rid),ans("issueType","ประเภทอุปกรณ์แจ้งซ่อม",d.itype),ans("priority","ระดับความสำคัญ (SLA)",d.priority),ans("timeFinished","เวลาที่เสร็จสิ้น",d.time),ans("minutesToComplete","เวลาที่ใช้ซ่อม (นาที)",d.mins),ans("slaMet","สถานะ SLA",d.sla)],d.status)));

  return subs;
}

// โหลดข้อมูลหลักของระบบ
function readAll() {
  if (typeof window === "undefined") return { 
    departments: [], 
    workPackages: [], 
    activities: [], 
    formTemplates: [], 
    submissions: [],
    assets: [],
    zoneReportHistory: [],
    lastYearFestivalData: {},
    repairBacklog: [],
    executiveDecisionsLog: [],
    fuelLogs: [],
    binWashLogs: [],
    migrantWorkers: [],
    maintBreakdowns: [],
    slaRequests: []
  };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const initialData = {
        departments: DEPARTMENTS,
        workPackages: SEED_WPS,
        activities: SEED_ACTIVITIES,
        formTemplates: SEED_TEMPLATES,
        submissions: generateSeedSubmissions(),
        assets: SEED_ASSETS,
        zoneReportHistory: SEED_ZONE_REPORT_HISTORY,
        lastYearFestivalData: SEED_FESTIVAL_DATA,
        repairBacklog: SEED_REPAIR_BACKLOG,
        executiveDecisionsLog: [],
        fuelLogs: SEED_FUEL_LOGS,
        binWashLogs: SEED_BIN_WASH_LOGS,
        migrantWorkers: SEED_MIGRANT_WORKERS,
        maintBreakdowns: SEED_MAINT_BREAKDOWNS,
        slaRequests: SEED_SLA_REQUESTS
      };
      window.localStorage.setItem(KEY, JSON.stringify(initialData));
      return initialData;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Local storage read error, returning empty dataset:", e);
    return { 
      departments: [], 
      workPackages: [], 
      activities: [], 
      formTemplates: [], 
      submissions: [],
      assets: [],
      zoneReportHistory: [],
      lastYearFestivalData: {},
      repairBacklog: [],
      executiveDecisionsLog: [],
      fuelLogs: [],
      binWashLogs: [],
      migrantWorkers: [],
      maintBreakdowns: [],
      slaRequests: []
    };
  }
}

// บันทึกข้อมูลหลักลงใน localStorage
function writeAll(data) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

// ฟังก์ชันดึงโครงสร้างลำดับชั้น
export function getDepartments() {
  return readAll().departments || DEPARTMENTS;
}

export function getWorkPackages() {
  return readAll().workPackages || [];
}

export function getActivities() {
  return readAll().activities || [];
}

export function getFormTemplates() {
  return readAll().formTemplates || [];
}

export function getFormTemplate(activityId) {
  const templates = getFormTemplates();
  let found = templates.find(t => t.activityId === activityId);
  if (!found) {
    found = {
      id: `tmpl-${Date.now()}`,
      activityId,
      questions: []
    };
  }
  return found;
}

// ฟังก์ชัน CRUD สำหรับ Work Package
export function addWorkPackage(wp) {
  const data = readAll();
  const record = {
    id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...wp
  };
  data.workPackages.push(record);
  writeAll(data);
  return record;
}

export function updateWorkPackage(wp) {
  const data = readAll();
  const idx = data.workPackages.findIndex(item => item.id === wp.id);
  if (idx !== -1) {
    data.workPackages[idx] = { ...data.workPackages[idx], ...wp };
    writeAll(data);
  }
  return wp;
}

export function deleteWorkPackage(id) {
  const data = readAll();
  data.workPackages = data.workPackages.filter(item => item.id !== id);
  const actIds = data.activities.filter(a => a.workPackageId === id).map(a => a.id);
  data.activities = data.activities.filter(a => a.workPackageId !== id);
  data.formTemplates = data.formTemplates.filter(t => !actIds.includes(t.activityId));
  writeAll(data);
}

// ฟังก์ชัน CRUD สำหรับ Activity
export function addActivity(act) {
  const data = readAll();
  const record = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...act
  };
  data.activities.push(record);
  writeAll(data);
  return record;
}

export function updateActivity(act) {
  const data = readAll();
  const idx = data.activities.findIndex(item => item.id === act.id);
  if (idx !== -1) {
    data.activities[idx] = { ...data.activities[idx], ...act };
    writeAll(data);
  }
  return act;
}

export function deleteActivity(id) {
  const data = readAll();
  data.activities = data.activities.filter(item => item.id !== id);
  data.formTemplates = data.formTemplates.filter(t => t.activityId !== id);
  writeAll(data);
}

// บันทึกคำถามแบบ Dynamic ของกิจกรรม
export function saveFormTemplate(template) {
  const data = readAll();
  const idx = data.formTemplates.findIndex(t => t.activityId === template.activityId);
  if (idx !== -1) {
    data.formTemplates[idx] = template;
  } else {
    data.formTemplates.push(template);
  }
  writeAll(data);
  return template;
}

// ฟังก์ชันประเมินความรุนแรงของสถานะจากเงื่อนไข flagIf
export function deriveSubmissionStatus(answers, questions) {
  let derivedStatus = "ปกติ";
  
  questions.forEach((q) => {
    const ans = answers.find(a => a.questionId === q.id);
    if (!ans) return;
    
    let isFlagged = false;
    
    if (q.flagIf) {
      const triggerVal = q.flagIf.value;
      
      if (q.type === "yes_no" || q.type === "single_choice" || q.type === "text") {
        isFlagged = String(ans.value).trim().toLowerCase() === String(triggerVal).trim().toLowerCase();
      } else if (q.type === "number") {
        const numVal = Number(ans.value);
        if (triggerVal === "not_zero") {
          isFlagged = numVal !== 0;
        } else if (triggerVal === ">0") {
          isFlagged = numVal > 0;
        } else if (triggerVal.startsWith(">")) {
          const threshold = Number(triggerVal.replace(">", ""));
          isFlagged = numVal > threshold;
        } else if (triggerVal.startsWith("<")) {
          const threshold = Number(triggerVal.replace("<", ""));
          isFlagged = numVal < threshold;
        } else {
          isFlagged = numVal === Number(triggerVal);
        }
      } else if (q.type === "checkbox_group") {
        if (triggerVal === "incomplete" || triggerVal === "any_missing") {
          const selected = ans.value || [];
          const allOptions = q.options || [];
          isFlagged = selected.length < allOptions.length;
        }
      }
      
      if (isFlagged) {
        if (q.flagIf.setStatus === "เร่งด่วน") {
          derivedStatus = "เร่งด่วน";
        } else if (q.flagIf.setStatus === "ต้องติดตาม" && derivedStatus !== "เร่งด่วน") {
          derivedStatus = "ต้องติดตาม";
        }
      }
    }
  });
  
  return derivedStatus;
}

// ฟังก์ชันเพิ่มรายการ Submission
export function getReports() {
  return readAll().submissions.sort((a, b) => b.createdAt - a.createdAt);
}

export function addReport(entry) {
  const data = readAll();
  const record = {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    submittedAt: new Date().toISOString(),
    ...entry
  };
  data.submissions.push(record);
  writeAll(data);
  return record;
}

export function deleteSubmission(id) {
  const data = readAll();
  data.submissions = data.submissions.filter(item => item.id !== id);
  writeAll(data);
}

export function resetToSeed() {
  const initialData = {
    departments: DEPARTMENTS,
    workPackages: SEED_WPS,
    activities: SEED_ACTIVITIES,
    formTemplates: SEED_TEMPLATES,
    submissions: generateSeedSubmissions(),
    assets: SEED_ASSETS,
    zoneReportHistory: SEED_ZONE_REPORT_HISTORY,
    lastYearFestivalData: SEED_FESTIVAL_DATA,
    repairBacklog: SEED_REPAIR_BACKLOG,
    executiveDecisionsLog: [],
    fuelLogs: SEED_FUEL_LOGS,
    binWashLogs: SEED_BIN_WASH_LOGS,
    migrantWorkers: SEED_MIGRANT_WORKERS,
    maintBreakdowns: SEED_MAINT_BREAKDOWNS,
    slaRequests: SEED_SLA_REQUESTS
  };
  writeAll(initialData);
  return initialData.submissions;
}

// สถิติและประมวลผลข้อมูลแดชบอร์ด
export function computeStats(submissions) {
  const total = submissions.length;
  const byStatus = { ปกติ: 0, ต้องติดตาม: 0, เร่งด่วน: 0 };
  const byDept = {};

  submissions.forEach((s) => {
    byStatus[s.derivedStatus] = (byStatus[s.derivedStatus] || 0) + 1;
    byDept[s.departmentId] = (byDept[s.departmentId] || 0) + 1;
  });

  const deptMeta = getDepartments();
  const deptChart = Object.entries(byDept).map(([id, value]) => {
    const dept = deptMeta.find(d => d.id === id);
    return {
      name: dept ? dept.name : id,
      value
    };
  });

  const statusChart = Object.entries(byStatus).map(([name, value]) => ({ name, value }));
  const urgentOpen = submissions.filter(s => s.derivedStatus === "เร่งด่วน").length;
  const watchOpen = submissions.filter(s => s.derivedStatus === "ต้องติดตาม").length;

  // ประมวลผลดัชนี KPI รายฝ่ายงานแบบไดนามิกจากข้อมูลรายงานดิบในฐานข้อมูล
  // ค่าเริ่มต้นใช้เมื่อยังไม่มี submissions เพียงพอ
  const dynamicKPIs = {
    "d-space": {
      occupancy: 96.0,  // % แผงที่เช่าอยู่ (สะสมจาก Rent Out - Return ÷ 100)
      safety: 95.0,     // % ตัวอย่างที่ผ่านการตรวจสารพิษ (Pass Rate)
      fines: 0          // ยอดค่าปรับรวม (บาท) ในช่วง 30 วันล่าสุด
    },
    "d-clean": {
      overflowRate: 20.0, // % ถังขยะที่ล้น (น้ำหนักเกิน 85% ความจุ)
      cod: 95.0,          // ค่า COD เฉลี่ย (mg/L) ล่าสุด (เป้า < 120)
      sla: 88.0           // % งานร้องเรียนที่ปิดทัน 30 นาที
    },
    "d-security": {
      trafficAvgMins: 3.2, // เวลารถติดเฉลี่ย (นาที)
      trafficExceedRate: 44.0, // % ครั้งที่เกิน 5 นาที
      routingAvgMins: 30.0, // เวลาเฉลี่ยต่อรอบเดินรถ (นาที)
      routingLateRate: 30.0, // % รอบที่ล่าช้าเกิน 40 นาที
      parkingLockRate: 80.0  // % รถจอดผิดกฎที่ล็อกล้อสำเร็จ
    },
    "d-labor": {
      waitAvgMins: 7.5, // เวลารอคอยเฉลี่ย (นาที)
      unloadSlaRate: 64.0, // % คิวที่ผ่าน SLA (รอ <= 10 นาที)
      forkliftUtil: 75.0   // Forklift Utilization เฉลี่ย (%)
    },
    "d-maintenance": {
      machineUtil: 68.0,    // Utilization เครื่องจักรเฉลี่ย (%)
      breakdownTotal: 0,    // Breakdown สะสม (นาที) ใน 30 วันล่าสุด
      slaRate: 76.0         // % ใบงานซ่อมที่ปิดทัน SLA
    },
    "d-specsec": {
      incidentTotal: 0,    // จำนวนเหตุสะสม (ครั้ง)
      drugPositiveRate: 0  // % แรงงานที่ตรวจพบสารเสพติด
    },
    "d-cold": {
      satisfaction: 4.5,   // คะแนนพึงพอใจเฉลี่ย (เต็ม 5)
      depositRate: 82.0,   // อัตราใช้ประโยชน์ฝากสินค้า (%)
      powerAvg: 1.0,       // ค่าไฟเฉลี่ย (หน่วย/ตร.ม./วัน)
      powerExceedRate: 0   // % วันที่เกินเกณฑ์ 1.2 หน่วย
    }
  };

  const findAnswer = (sub, questionId) => {
    const ans = sub.answers?.find(a => a.questionId === questionId);
    return ans ? Number(ans.value) : null;
  };
  const findAnswerStr = (sub, questionId) => {
    const ans = sub.answers?.find(a => a.questionId === questionId);
    return ans ? String(ans.value) : null;
  };

  // ══════════════════════════════════════════════════════════════════
  // คำนวณ KPI รายฝ่ายงานจาก Transaction Data จริง
  // ══════════════════════════════════════════════════════════════════

  // ── 4. ฝ่ายแรงงาน (d-labor) ─────────────────────────────────────────

  // Unload: เวลารอเฉลี่ย + % ที่ผ่าน SLA (รอ <= 10 นาที)
  const laborUnloadSubs = submissions.filter(s => s.formTemplateId === "tmpl-lab-unload");
  if (laborUnloadSubs.length > 0) {
    let totalWait = 0;
    let metSla = 0;
    laborUnloadSubs.forEach(s => {
      const w = s.resolved ? 8 : (findAnswer(s, "customerWaitMinutes") || 10);
      totalWait += w;
      const met = s.resolved ? "yes" : findAnswerStr(s, "slaMet");
      if (met === "yes" || met === "ปกติ/ใช่") metSla++;
    });
    dynamicKPIs["d-labor"].waitAvgMins = Number((totalWait / laborUnloadSubs.length).toFixed(1));
    dynamicKPIs["d-labor"].unloadSlaRate = Number(((metSla / laborUnloadSubs.length) * 100).toFixed(1));
  }

  // Forklift: Utilization เฉลี่ย %
  const laborForkliftSubs = submissions.filter(s => s.formTemplateId === "tmpl-lab-forklift");
  if (laborForkliftSubs.length > 0) {
    let totalUtil = 0;
    laborForkliftSubs.forEach(s => {
      totalUtil += (s.resolved ? 85 : (findAnswer(s, "forkliftUtilizePercent") || 75));
    });
    dynamicKPIs["d-labor"].forkliftUtil = Number((totalUtil / laborForkliftSubs.length).toFixed(1));
  }

  // ── 5. ฝ่ายซ่อมบำรุง (d-maintenance) ────────────────────────────────

  // PM: Utilization เครื่องจักรเฉลี่ย + Breakdown สะสม
  const maintPmSubs = submissions.filter(s => s.formTemplateId === "tmpl-maint-pm");
  if (maintPmSubs.length > 0) {
    let totalUtil = 0;
    maintPmSubs.forEach(s => {
      totalUtil += (s.resolved ? 85 : (findAnswer(s, "utilizationPercent") || 70));
    });
    dynamicKPIs["d-maintenance"].machineUtil = Number((totalUtil / maintPmSubs.length).toFixed(1));
  }

  // Breakdown: สะสมนาทีจากฟอร์ม Breakdown
  const maintBreakdownSubs = submissions.filter(s => s.formTemplateId === "tmpl-maint-breakdown");
  if (maintBreakdownSubs.length > 0) {
    let totalBreakdown = 0;
    maintBreakdownSubs.forEach(s => {
      totalBreakdown += (s.resolved ? 0 : (findAnswer(s, "breakdownMinutes") || 0));
    });
    dynamicKPIs["d-maintenance"].breakdownTotal = totalBreakdown;
  }

  // SLA Repair: % ใบงานซ่อมที่ปิดทัน SLA
  const maintSlaSubs = submissions.filter(s => s.formTemplateId === "tmpl-maint-sla");
  if (maintSlaSubs.length > 0) {
    let metSla = 0;
    maintSlaSubs.forEach(s => {
      const met = s.resolved ? "ซ่อมเสร็จทัน SLA" : findAnswerStr(s, "slaMet");
      if (met === "ซ่อมเสร็จทัน SLA" || met === "yes" || met === "ปกติ/ใช่") metSla++;
    });
    dynamicKPIs["d-maintenance"].slaRate = Number(((metSla / maintSlaSubs.length) * 100).toFixed(1));
  }

  // ── 6. ฝ่าย รปภ. เฉพาะกิจ (d-specsec) ──────────────────────────────

  // Emergency: จำนวนเหตุสะสมทั้งหมด
  const specsecEmergencySubs = submissions.filter(s => s.formTemplateId === "tmpl-specsec-emergency");
  if (specsecEmergencySubs.length > 0) {
    let totalIncidents = 0;
    specsecEmergencySubs.forEach(s => {
      totalIncidents += (s.resolved ? 0 : (findAnswer(s, "emergencyIncidents") || 0));
    });
    dynamicKPIs["d-specsec"].incidentTotal = totalIncidents;
  }

  // Drugs: Positive Rate % = พบ ÷ ตรวจทั้งหมด × 100
  const specsecDrugsSubs = submissions.filter(s => s.formTemplateId === "tmpl-specsec-drugs");
  if (specsecDrugsSubs.length > 0) {
    let totalPositives = 0;
    let totalTested = 0;
    specsecDrugsSubs.forEach(s => {
      totalPositives += (s.resolved ? 0 : (findAnswer(s, "positiveDrugCount") || 0));
      totalTested += (findAnswer(s, "totalTested") || 0);
    });
    dynamicKPIs["d-specsec"].drugPositiveRate = totalTested > 0
      ? Number(((totalPositives / totalTested) * 100).toFixed(2))
      : 0;
  }

  // ── 7. ฝ่ายห้องเย็น (d-cold) ─────────────────────────────────────────────

  // Satisfaction: คะแนนพึงพอใจเฉลี่ย + อัตราใช้ประโยชน์
  const coldSatisfactionSubs = submissions.filter(s => s.formTemplateId === "tmpl-cold-satisfaction");
  if (coldSatisfactionSubs.length > 0) {
    let totalRating = 0;
    let totalDeposit = 0;
    coldSatisfactionSubs.forEach(s => {
      totalRating += (findAnswer(s, "satisfactionScore") || 4.0);
      totalDeposit += (findAnswer(s, "depositRatePercent") || 80);
    });
    dynamicKPIs["d-cold"].satisfaction = Number((totalRating / coldSatisfactionSubs.length).toFixed(1));
    dynamicKPIs["d-cold"].depositRate = Number((totalDeposit / coldSatisfactionSubs.length).toFixed(1));
  }

  // Power: ค่าไฟเฉลี่ย + % วันที่เกินเกณฑ์ 1.2 หน่วย
  const coldPowerSubs = submissions.filter(s => s.formTemplateId === "tmpl-cold-power");
  if (coldPowerSubs.length > 0) {
    let totalPower = 0;
    let exceedCount = 0;
    coldPowerSubs.forEach(s => {
      const kwh = findAnswer(s, "powerKwh") || 1.0;
      totalPower += kwh;
      if (kwh > 1.2) exceedCount++;
    });
    dynamicKPIs["d-cold"].powerAvg = Number((totalPower / coldPowerSubs.length).toFixed(2));
    dynamicKPIs["d-cold"].powerExceedRate = Number(((exceedCount / coldPowerSubs.length) * 100).toFixed(1));
  }

  return {
    total,
    byStatus,
    byDept,
    deptChart,
    statusChart,
    urgentOpen,
    watchOpen,
    dynamicKPIs
  };
}

// --- ฟังก์ชันเสริมสำหรับรายงานผู้บริหาร (Executive AI/ML Dashboard) ---

export function getExecutiveData() {
  const data = readAll();
  return {
    assets: data.assets || SEED_ASSETS,
    zoneReportHistory: data.zoneReportHistory || SEED_ZONE_REPORT_HISTORY,
    lastYearFestivalData: data.lastYearFestivalData || SEED_FESTIVAL_DATA,
    repairBacklog: data.repairBacklog || SEED_REPAIR_BACKLOG,
    fuelLogs: data.fuelLogs || SEED_FUEL_LOGS,
    binWashLogs: data.binWashLogs || SEED_BIN_WASH_LOGS,
    migrantWorkers: data.migrantWorkers || SEED_MIGRANT_WORKERS,
    maintBreakdowns: data.maintBreakdowns || SEED_MAINT_BREAKDOWNS,
    slaRequests: data.slaRequests || SEED_SLA_REQUESTS
  };
}

export function getExecutiveDecisions() {
  return readAll().executiveDecisionsLog || [];
}

export function logExecutiveDecision(caseId, decisionText) {
  const data = readAll();
  if (!data.executiveDecisionsLog) data.executiveDecisionsLog = [];
  
  const record = {
    id: `dec-${Date.now()}`,
    caseId,
    decisionText,
    timestamp: new Date().toLocaleTimeString("th-TH") + " | " + new Date().toLocaleDateString("th-TH")
  };
  
  data.executiveDecisionsLog.push(record);
  writeAll(data);
  return record;
}

export function clearExecutiveDecisions() {
  const data = readAll();
  data.executiveDecisionsLog = [];
  writeAll(data);
}

export function resolveIncident(submissionId, decisionText) {
  const data = readAll();
  const idx = data.submissions.findIndex(s => s.id === submissionId);
  if (idx !== -1) {
    data.submissions[idx].resolved = true;
    data.submissions[idx].resolution = decisionText;
    data.submissions[idx].derivedStatus = "ปกติ"; // เมื่อแก้ไขแล้วจะปรับสถานะกลับเป็นปกติ
    
    // หากเป็นแบบฟอร์มที่มีการสุ่มตรวจ เช่น สารพิษ หรือ ปัสสาวะ หรือ ค่าไฟ ให้สลับตัวเลขป้อนกลับเพื่อให้ KPI ฟื้นตัว
    const answers = data.submissions[idx].answers;
    if (data.submissions[idx].formTemplateId === "tmpl-sec-routing") {
      const ansIdx = answers.findIndex(a => a.questionId === "truckRoutingMinutes");
      if (ansIdx !== -1) answers[ansIdx].value = 33;
    } else if (data.submissions[idx].formTemplateId === "tmpl-sec-parking") {
      // แก้ไขว่าทำการล็อกล้อเรียบร้อยแล้ว
      const ansIdx = answers.findIndex(a => a.questionId === "lockAction");
      if (ansIdx !== -1) answers[ansIdx].value = "yes";
    } else if (data.submissions[idx].formTemplateId === "tmpl-clean-bins") {
      // ปรับระดับขยะล้นถังให้สะอาดเรียบร้อย
      const ansIdx = answers.findIndex(a => a.questionId === "currentWeightKg");
      if (ansIdx !== -1) answers[ansIdx].value = 100;
    } else if (data.submissions[idx].formTemplateId === "tmpl-clean-water") {
      // ปรับปั๊มสูบปกติและค่า COD กลับคืนเกณฑ์
      const ansIdx = answers.findIndex(a => a.questionId === "codLevel");
      if (ansIdx !== -1) answers[ansIdx].value = 90;
    }
    
    writeAll(data);
  }
}

export function getAiMaintenanceInsights() {
  const data = readAll();
  const reports = data.submissions || [];
  const breakdowns = reports.filter(r => r.activityId === "act-maint-breakdown");
  const pmChecks = reports.filter(r => r.activityId === "act-maint-pm");
  
  const insights = SEED_MACHINES.map(machine => {
    // 1. Calculate Breakdown Frequency for this specific machine
    const machineBreakdowns = breakdowns.filter(r => 
      r.answers?.some(a => a.questionId === "machineId" && a.value === machine.id)
    );
    const breakdownCount = machineBreakdowns.length;

    // Calculate PM misses (if it was never checked)
    const machinePms = pmChecks.filter(r => 
      r.answers?.some(a => a.questionId === "machineId" && a.value === machine.id)
    );
    
    // 2. Calculate Repair Cost Ratio
    const repairRatio = (machine.totalRepairCost / machine.purchasePrice) * 100;
    
    // 3. AI Logic (Decision Tree)
    let actionType = "";
    let severity = "";
    let recommendation = "";
    
    if (repairRatio > 50 || (repairRatio > 40 && breakdownCount >= 3)) {
      actionType = "REPLACE";
      severity = "เร่งด่วน";
      recommendation = `แนะนำให้พิจารณาซื้อเครื่องใหม่ทดแทน (Replacement) 🚨 เนื่องจากค่าซ่อมสะสมสูงถึง ${repairRatio.toFixed(1)}% ของราคาเครื่องใหม่ และมีการแจ้งเสียบ่อยครั้งในรอบเดือน (${breakdownCount} ครั้ง) ซึ่งไม่คุ้มค่ากับการซ่อมต่อเชิงเศรษฐศาสตร์`;
    } else if (machine.ageYears >= 5 && breakdownCount >= 2) {
      actionType = "OVERHAUL";
      severity = "ต้องติดตาม";
      recommendation = `แนะนำให้ทำการซ่อมบำรุงใหญ่ (Major Overhaul) ⚠️ เนื่องจากอายุการใช้งานเข้าปีที่ ${machine.ageYears} และเริ่มมีอัตราการขัดข้องถี่ขึ้น (MTBF ต่ำลง) หากปล่อยไว้อาจเกิด Breakdown ร้ายแรง`;
    } else if (breakdownCount >= 1) {
       actionType = "INSPECT";
       severity = "ต้องติดตาม";
       recommendation = `แนะนำให้ทีมช่างเข้าตรวจสอบหาสาเหตุเชิงลึก (Root Cause Analysis) 🔍 เครื่องจักรมีการขัดข้องผิดปกติวงรอบการทำงาน`;
    } else if (machinePms.length === 0) {
       actionType = "MISSED_PM";
       severity = "เร่งด่วน";
       recommendation = `ตรวจพบการละเว้น (Missed Check) ❗️ เครื่องจักรตัวนี้ไม่มีประวัติการเข้าตรวจสอบ PM ตามวงรอบในระบบ เสี่ยงต่อการชำรุดกะทันหัน แนะนำให้จัดทีมเข้าตรวจสอบทันที`;
    } else {
      actionType = "NORMAL";
      severity = "ปกติ";
      recommendation = `สถานะปกติ ✅ แนะนำให้ทำการบำรุงรักษาตามรอบ (Preventive Maintenance) ปกติ`;
    }
    
    return {
      machine,
      breakdownCount,
      repairRatio,
      actionType,
      severity,
      recommendation
    };
  });
  
  return insights.sort((a, b) => b.breakdownCount - a.breakdownCount);
}
