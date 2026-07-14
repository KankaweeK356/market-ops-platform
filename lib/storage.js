// lib/storage.js
//
// เก็บข้อมูลแบบลำดับชั้น (Department -> WorkPackage -> Activity -> FormTemplate)
// และรายการ FormSubmission ผ่าน localStorage ของเบราว์เซอร์
//
// โครงสร้างได้รับการปรับแต่งใหม่ตามคำสั่ง KPI ตลาดสี่มุมเมืองล่าสุด

import { DEPARTMENTS, STAFF_NAMES, ZONES } from "./constants";

const KEY = "market_ops_system_data_v2";

const SEED_WPS = [
  // ฝ่ายรักษาความสะอาด
  { id: "wp-clean-waste", departmentId: "d-clean", name: "การจัดการขยะอินทรีย์และถังขยะ", description: "ตรวจเช็คระดับขยะสะสมในถังพักและลานผัก", frequency: "daily" },
  { id: "wp-clean-water", departmentId: "d-clean", name: "บ่อบำบัดน้ำเสียและสิ่งแวดล้อม", description: "ตรวจสอบค่าปั๊มน้ำเสียและระดับ COD ของน้ำทิ้ง", frequency: "daily" },
  { id: "wp-clean-complaint", departmentId: "d-clean", name: "การเคลียร์ข้อร้องเรียนจุดสกปรกตาม SLA", description: "ตรวจสอบความเร็วการจัดการล้างและกวาดจุดเปื้อนตามเวลากำหนด", frequency: "daily" },
  
  // ฝ่ายความปลอดภัย (รปภ)
  { id: "wp-sec-traffic", departmentId: "d-security", name: "จราจรทางเข้าและเวลาเคลียร์คอขวด", description: "ตรวจสอบเวลาเคลียร์รถติดคอขวด (เกณฑ์ห้ามเกิน 5 นาที)", frequency: "daily" },
  { id: "wp-sec-routing", departmentId: "d-security", name: "การจัดระเบียบเดินรถเข้าอาคารรถผัก", description: "ตรวจสอบเวลารอบวิ่งเข้าอาคารลานผัก (เป้าหมาย 40 นาที/รอบ)", frequency: "daily" },
  { id: "wp-sec-parking", departmentId: "d-security", name: "จัดการลักลอบจอดเพื่อผู้ซื้อบริการ", description: "เคลียร์พวกลักลอบแอบจอดรถยนต์ส่วนบุคคลเพื่อลดข้อร้องเรียน", frequency: "daily" },
  
  // ฝ่ายแรงงาน
  { id: "wp-lab-unload", departmentId: "d-labor", name: "ควบคุมเวลารถคอยและลงสินค้า", description: "ตรวจจับรถลูกค้ารอคอยลงสินค้า (ห้ามเกิน 10 นาที) และเวลาลงตาม SLA", frequency: "daily" },
  { id: "wp-lab-forklift", departmentId: "d-labor", name: "ประสิทธิภาพการใช้และการตรวจเช็ค Forklift", description: "ติดตามอัตราการใช้งาน Forklift (ไม่ต่ำกว่า 80%) และตรวจบำรุงรักษา PM", frequency: "daily" },

  // ฝ่ายซ่อมบำรุง
  { id: "wp-maint-pm", departmentId: "d-maintenance", name: "การบำรุงรักษาเชิงป้องกัน (PM)", description: "ตรวจเช็คเครื่องผลิตไฟฟ้า ปั๊มน้ำ และเครื่องจักรเพื่อลด Breakdown", frequency: "daily" },
  { id: "wp-maint-request", departmentId: "d-maintenance", name: "งานแจ้งซ่อมและควบคุม SLA", description: "วัดระยะเวลางานปิดจ๊อบซ่อมแผงค้าและงานไฟฟ้าตาม SLA", frequency: "daily" }
];

const SEED_ACTIVITIES = [
  // ฝ่ายรักษาความสะอาด
  { id: "act-clean-bins", workPackageId: "wp-clean-waste", name: "บันทึกระดับขยะล้นและล้างถังขยะ", description: "ตรวจจับถังขยะเต็มล้นและปริมาณขยะผักผลไม้" },
  { id: "act-clean-water", workPackageId: "wp-clean-water", name: "ตรวจเช็คปั๊มและวัดค่าบ่อน้ำเสีย", description: "บันทึกสถานะปั๊มสูบน้ำเสียและค่าความเน่าเสีย COD" },
  { id: "act-clean-complaint", workPackageId: "wp-clean-complaint", name: "บันทึกเวลาเคลียร์จุดสกปรกตาม SLA", description: "บันทึกระยะเวลาดำเนินการหลังได้รับเรื่องร้องเรียนจุดสกปรก" },

  // ฝ่ายความปลอดภัย (รปภ)
  { id: "act-sec-traffic", workPackageId: "wp-sec-traffic", name: "ตรวจจับและบันทึกเวลาเคลียร์รถติด", description: "ตรวจจับรถติดหน้าด่านทางเข้า (ห้ามเกิน 5 นาที)" },
  { id: "act-sec-routing", workPackageId: "wp-sec-routing", name: "ตรวจรอบรถผักวิ่งเข้าอาคารลานค้า", description: "ตรวจความก้าวหน้าการปล่อยรถเข้าอาคารผักผลไม้ (เป้า 40 นาที)" },
  { id: "act-sec-parking", workPackageId: "wp-sec-parking", name: "ตรวจจับพวกลักลอบแอบจอดรถยนต์", description: "ลงตรวจสอบและดำเนินการล็อกล้อรถลักลอบจอดทิ้ง" },

  // ฝ่ายแรงงาน
  { id: "act-lab-unload", workPackageId: "wp-lab-unload", name: "บันทึกเวลารถรอและเวลาลงของ", description: "ตรวจวัดเวลารถลูกค้ารอลงสินค้า (ห้ามเกิน 10 นาที)" },
  { id: "act-lab-forklift", workPackageId: "wp-lab-forklift", name: "บันทึก Utilization และการตรวจเช็ค Forklift", description: "ตรวจบันทึกประสิทธิภาพการใช้รถและสภาพ PM ประจำรอบ" },

  // ฝ่ายซ่อมบำรุง
  { id: "act-maint-pm", workPackageId: "wp-maint-pm", name: "ตรวจสอบสภาพเครื่องจักรและรถตัก", description: "เช็คระบบไฟฟ้าเครื่องผลิตไฟสำรองและเครื่องสูบระบายหลัก" },
  { id: "act-maint-sla", workPackageId: "wp-maint-request", name: "บันทึกสถิติงานแจ้งซ่อมตาม SLA", description: "ตรวจเช็คเวลาจบงานซ่อมประปา ระบบไฟฟ้า และโครงสร้างแผงค้า" }
];

const SEED_TEMPLATES = [
  // 1. ตรวจขยะล้น
  {
    id: "tmpl-clean-bins",
    activityId: "act-clean-bins",
    questions: [
      { id: "wasteType", label: "ประเภทขยะหลัก", type: "single_choice", options: ["ขยะผักผลไม้ (Organic)", "ขยะทั่วไป (Inorganic)", "ขยะพลาสติก/รีไซเคิล"], required: true },
      { id: "binLevelPercent", label: "ระดับความจุขยะในถัง (%)", type: "number", required: true, flagIf: { value: ">90", setStatus: "เร่งด่วน" } },
      { id: "odorLevel", label: "ระดับความรุนแรงของกลิ่น", type: "single_choice", options: ["ปกติ (Low)", "ปานกลาง (Medium)", "เหม็นวิกฤต (High)"], required: true }
    ]
  },
  // 2. ตรวจเช็คปั๊มและวัดค่าบ่อน้ำเสีย
  {
    id: "tmpl-clean-water",
    activityId: "act-clean-water",
    questions: [
      { id: "pumpStatus", label: "สถานะเครื่องปั๊มสูบน้ำเสียบ่อ 2", type: "single_choice", options: ["เปิดระบบปกติ", "ปิดระบบ/ขัดข้อง"], required: true, flagIf: { value: "ปิดระบบ/ขัดข้อง", setStatus: "เร่งด่วน" } },
      { id: "codLevel", label: "ค่าซีโอดี COD วัดได้ (mg/L) - เป้าหมาย <120", type: "number", required: true, flagIf: { value: ">120", setStatus: "เร่งด่วน" } }
    ]
  },
  // 3. เคลียร์ข้อร้องเรียนจุดสกปรกตาม SLA
  {
    id: "tmpl-clean-complaint",
    activityId: "act-clean-complaint",
    questions: [
      { id: "complaintId", label: "รหัสข้อร้องเรียนจุดสกปรก", type: "text", required: true },
      { id: "minutesToClear", label: "เวลาที่ใช้เคลียร์กวาดล้างพื้นที่ (นาที)", type: "number", required: true },
      { id: "slaMet", label: "ดำเนินการสำเร็จตาม SLA เกณฑ์กำหนดหรือไม่", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "เร่งด่วน" } }
    ]
  },

  // 4. บันทึกตรวจจราจรติดสะสม
  {
    id: "tmpl-sec-traffic",
    activityId: "act-sec-traffic",
    questions: [
      { id: "trafficWaitMinutes", label: "ระยะเวลารถติดขัดสะสมหนาแน่น (นาที) - เกณฑ์ห้ามเกิน 5 นาที", type: "number", required: true, flagIf: { value: ">5", setStatus: "เร่งด่วน" } },
      { id: "queueLength", label: "ความยาวแถวคิวคอยสะสม (คัน)", type: "number", required: true }
    ]
  },
  // 5. จัดรถเข้าอาคารรถผัก
  {
    id: "tmpl-sec-routing",
    activityId: "act-sec-routing",
    questions: [
      { id: "truckRoutingMinutes", label: "เวลาที่ใช้จัดรถเข้าอาคารผัก (นาที) - เป้าหมายไม่เกิน 40 นาที", type: "number", required: true, flagIf: { value: ">40", setStatus: "ต้องติดตาม" } }
    ]
  },
  // 6. ตรวจจับและเคลียร์พวกลักลอบแอบจอดรถยนต์
  {
    id: "tmpl-sec-parking",
    activityId: "act-sec-parking",
    questions: [
      { id: "licensePlate", label: "ป้ายทะเบียนรถที่ลักลอบจอดทิ้ง", type: "text", required: true },
      { id: "lockAction", label: "ดำเนินการล็อกล้อรถคันดังกล่าวหรือไม่", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "ต้องติดตาม" } }
    ]
  },

  // 7. เวลารถลูกค้ารอคอยและลงสินค้า
  {
    id: "tmpl-lab-unload",
    activityId: "act-lab-unload",
    questions: [
      { id: "customerWaitMinutes", label: "เวลารอคอยเฉลี่ยของรถลูกค้า (นาที) - ห้ามเกิน 10 นาที", type: "number", required: true, flagIf: { value: ">10", setStatus: "เร่งด่วน" } },
      { id: "unloadMinutes", label: "เวลาที่ใช้ในการลงสินค้าขนถ่ายจริง (นาที)", type: "number", required: true },
      { id: "slaMet", label: "ผลการขนสินค้าเสร็จสิ้นทันตามข้อตกลง SLA หรือไม่", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "เร่งด่วน" } }
    ]
  },
  // 8. การใช้งานและการตรวจเช็ค Forklift
  {
    id: "tmpl-lab-forklift",
    activityId: "act-lab-forklift",
    questions: [
      { id: "forkliftUtilizePercent", label: "อัตราการใช้งานรถ Forklift ในกะ (%) - เป้าหมาย >= 80%", type: "number", required: true, flagIf: { value: "<80", setStatus: "ต้องติดตาม" } },
      { id: "pmChecked", label: "ผ่านการตรวจสอบบำรุงรักษาประจำกะ (PM Check) หรือไม่", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "เร่งด่วน" } }
    ]
  },

  // 9. ฝ่ายซ่อมบำรุง - การตรวจสภาพเครื่องจักร PM
  {
    id: "tmpl-maint-pm",
    activityId: "act-maint-pm",
    questions: [
      { id: "machineId", label: "รหัสเครื่องจักร / รหัสรถตัก", type: "text", required: true },
      { id: "machineType", label: "ประเภทของเครื่องจักร", type: "single_choice", options: ["เครื่องผลิตไฟสำรอง (Gen)", "รถล้างถนนแทรกเตอร์", "ปั๊มสูบระบายหลัก"], required: true },
      { id: "runningHours", label: "ชั่วโมงรันเครื่องสะสม (ชั่วโมง)", type: "number", required: true },
      { id: "breakdownMinutes", label: "เวลาที่เครื่องจักรเสียขัดข้อง Breakdown (นาที)", type: "number", required: true, flagIf: { value: ">60", setStatus: "เร่งด่วน" } },
      { id: "utilizationPercent", label: "อัตราการเปิดใช้งานเครื่องจักร (Utilize %)", type: "number", required: true, flagIf: { value: "<70", setStatus: "ต้องติดตาม" } }
    ]
  },
  // 10. ฝ่ายซ่อมบำรุง - การจัดการงานซ่อมตาม SLA
  {
    id: "tmpl-maint-sla",
    activityId: "act-maint-sla",
    questions: [
      { id: "requestId", label: "รหัสใบงานแจ้งซ่อม (Request ID)", type: "text", required: true },
      { id: "issueType", label: "ประเภทอุปกรณ์แจ้งซ่อม", type: "single_choice", options: ["ท่อน้ำประปาแตก", "ระบบไฟฟ้าร้านชำรุด", "คานเหล็กหลังคาคด"], required: true },
      { id: "priority", label: "ระดับความสำคัญ (SLA Scope)", type: "single_choice", options: ["High (SLA 2 ชม.)", "Medium (SLA 6 ชม.)", "Low (SLA 24 ชม.)"], required: true },
      { id: "minutesToComplete", label: "เวลาที่ใช้จริงในการเข้าซ่อมจนปิดงาน (นาที)", type: "number", required: true },
      { id: "slaMet", label: "ซ่อมเสร็จทันข้อตกลง SLA หรือไม่", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "เร่งด่วน" } }
    ]
  }
];

const SEED_ASSETS = [
  { id: "veh-01", departmentId: "d-security", type: "vehicle", name: "รถตรวจการณ์ กข-1234" },
  { id: "pump-02", departmentId: "d-clean", type: "machinery", name: "เครื่องปั๊มบำบัดน้ำเสียบ่อ 2" }
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
  
  return [
    {
      id: "sub-1",
      formTemplateId: "tmpl-clean-bins",
      activityId: "act-clean-bins",
      workPackageId: "wp-clean-waste",
      departmentId: "d-clean",
      submittedBy: STAFF_NAMES[0],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[0],
      answers: [
        { questionId: "wasteType", label: "ประเภทขยะหลัก", value: "ขยะผักผลไม้ (Organic)" },
        { questionId: "binLevelPercent", label: "ระดับความจุขยะในถัง (%)", value: 92 },
        { questionId: "odorLevel", label: "ระดับความรุนแรงของกลิ่น", value: "เหม็นวิกฤต (High)" }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 1 * day
    },
    {
      id: "sub-2",
      formTemplateId: "tmpl-clean-water",
      activityId: "act-clean-water",
      workPackageId: "wp-clean-water",
      departmentId: "d-clean",
      submittedBy: STAFF_NAMES[1],
      submittedAt: new Date(now - 2 * day).toISOString(),
      date: new Date(now - 2 * day).toISOString().slice(0, 10),
      zone: ZONES[1],
      answers: [
        { questionId: "pumpStatus", label: "สถานะเครื่องปั๊มสูบน้ำเสียบ่อ 2", value: "เปิดระบบปกติ" },
        { questionId: "codLevel", label: "ค่าซีโอดี COD วัดได้ (mg/L) - เป้าหมาย <120", value: 160 }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 2 * day
    },
    {
      id: "sub-2b",
      formTemplateId: "tmpl-clean-complaint",
      activityId: "act-clean-complaint",
      workPackageId: "wp-clean-complaint",
      departmentId: "d-clean",
      submittedBy: STAFF_NAMES[0],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[2],
      answers: [
        { questionId: "complaintId", label: "รหัสข้อร้องเรียนจุดสกปรก", value: "RC-4029" },
        { questionId: "minutesToClear", label: "เวลาที่ใช้เคลียร์กวาดล้างพื้นที่ (นาที)", value: 45 },
        { questionId: "slaMet", label: "ดำเนินการสำเร็จตาม SLA เกณฑ์กำหนดหรือไม่", value: "no" }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 1 * day
    },
    {
      id: "sub-3",
      formTemplateId: "tmpl-sec-parking",
      activityId: "act-sec-parking",
      workPackageId: "wp-sec-parking",
      departmentId: "d-security",
      submittedBy: STAFF_NAMES[2],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[5],
      answers: [
        { questionId: "licensePlate", label: "ป้ายทะเบียนรถที่ลักลอบจอดทิ้ง", value: "70-4567" },
        { questionId: "lockAction", label: "ดำเนินการล็อกล้อรถคันดังกล่าวหรือไม่", value: "no" }
      ],
      derivedStatus: "ต้องติดตาม",
      createdAt: now - 1 * day
    },
    {
      id: "sub-4",
      formTemplateId: "tmpl-sec-traffic",
      activityId: "act-sec-traffic",
      workPackageId: "wp-sec-traffic",
      departmentId: "d-security",
      submittedBy: STAFF_NAMES[3],
      submittedAt: new Date(now - 2 * day).toISOString(),
      date: new Date(now - 2 * day).toISOString().slice(0, 10),
      zone: ZONES[5],
      answers: [
        { questionId: "trafficWaitMinutes", label: "ระยะเวลารถติดขัดสะสมหนาแน่น (นาที) - เกณฑ์ห้ามเกิน 5 นาที", value: 15 },
        { questionId: "queueLength", label: "ความยาวแถวคิวคอยสะสม (คัน)", value: 31 }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: new Date(now - 2 * day).getTime()
    },
    {
      id: "sub-4b",
      formTemplateId: "tmpl-sec-routing",
      activityId: "act-sec-routing",
      workPackageId: "wp-sec-routing",
      departmentId: "d-security",
      submittedBy: STAFF_NAMES[1],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[0],
      answers: [
        { questionId: "truckRoutingMinutes", label: "เวลาที่ใช้จัดรถเข้าอาคารผัก (นาที) - เป้าหมายไม่เกิน 40 นาที", value: 42 }
      ],
      derivedStatus: "ต้องติดตาม",
      createdAt: now - 1 * day
    },
    {
      id: "sub-5",
      formTemplateId: "tmpl-lab-unload",
      activityId: "act-lab-unload",
      workPackageId: "wp-lab-unload",
      departmentId: "d-labor",
      submittedBy: STAFF_NAMES[0],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[2],
      answers: [
        { questionId: "customerWaitMinutes", label: "เวลารอคอยเฉลี่ยของรถลูกค้า (นาที) - ห้ามเกิน 10 นาที", value: 22 },
        { questionId: "unloadMinutes", label: "เวลาที่ใช้ในการลงสินค้าขนถ่ายจริง (นาที)", value: 35 },
        { questionId: "slaMet", label: "ผลการขนสินค้าเสร็จสิ้นทันตามข้อตกลง SLA หรือไม่", value: "no" }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 1 * day
    },
    {
      id: "sub-6",
      formTemplateId: "tmpl-lab-forklift",
      activityId: "act-lab-forklift",
      workPackageId: "wp-lab-forklift",
      departmentId: "d-labor",
      submittedBy: STAFF_NAMES[1],
      submittedAt: new Date(now - 3 * day).toISOString(),
      date: new Date(now - 3 * day).toISOString().slice(0, 10),
      zone: ZONES[2],
      answers: [
        { questionId: "forkliftUtilizePercent", label: "อัตราการใช้งานรถ Forklift ในกะ (%) - เป้าหมาย >= 80%", value: 50 },
        { questionId: "pmChecked", label: "ผ่านการตรวจสอบบำรุงรักษาประจำกะ (PM Check) หรือไม่", value: "no" }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 3 * day
    },
    // ซ่อมบำรุง Submissions
    {
      id: "sub-m1",
      formTemplateId: "tmpl-maint-pm",
      activityId: "act-maint-pm",
      workPackageId: "wp-maint-pm",
      departmentId: "d-maintenance",
      submittedBy: STAFF_NAMES[2],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[4],
      answers: [
        { questionId: "machineId", label: "รหัสเครื่องจักร / รหัสรถตัก", value: "GEN-01" },
        { questionId: "machineType", label: "ประเภทของเครื่องจักร", value: "เครื่องผลิตไฟสำรอง (Gen)" },
        { questionId: "runningHours", label: "ชั่วโมงรันเครื่องสะสม (ชั่วโมง)", value: 450 },
        { questionId: "breakdownMinutes", label: "เวลาที่เครื่องจักรเสียขัดข้อง Breakdown (นาที)", value: 120 },
        { questionId: "utilizationPercent", label: "อัตราการเปิดใช้งานเครื่องจักร (Utilize %)", value: 45 }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 1 * day
    },
    {
      id: "sub-m2",
      formTemplateId: "tmpl-maint-sla",
      activityId: "act-maint-sla",
      workPackageId: "wp-maint-request",
      departmentId: "d-maintenance",
      submittedBy: STAFF_NAMES[3],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[0],
      answers: [
        { questionId: "requestId", label: "รหัสใบงานแจ้งซ่อม (Request ID)", value: "RQ-1045" },
        { questionId: "issueType", label: "ประเภทอุปกรณ์แจ้งซ่อม", value: "ระบบไฟฟ้าร้านชำรุด" },
        { questionId: "priority", label: "ระดับความสำคัญ (SLA Scope)", value: "High (SLA 2 ชม.)" },
        { questionId: "minutesToComplete", label: "เวลาที่ใช้จริงในการเข้าซ่อมจนปิดงาน (นาที)", value: 180 },
        { questionId: "slaMet", label: "ซ่อมเสร็จทันข้อตกลง SLA หรือไม่", value: "no" }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 1 * day
    }
  ];
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

  return {
    total,
    byStatus,
    byDept,
    deptChart,
    statusChart,
    urgentOpen,
    watchOpen
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
