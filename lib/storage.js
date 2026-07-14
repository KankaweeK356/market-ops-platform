// lib/storage.js
//
// เก็บข้อมูลแบบลำดับชั้น (Department -> WorkPackage -> Activity -> FormTemplate)
// และรายการ FormSubmission ผ่าน localStorage ของเบราว์เซอร์
//
// โครงสร้างไฟล์นี้ได้รับการอัปเกรดเพื่อรองรับ Use Cases ทั้งหมด 15 เคส และ KPI เกณฑ์ควบคุม (Thresholds)
// ของตลาดสี่มุมเมือง ครอบคลุมการใช้น้ำมัน ล้างถังขยะ จราจร แรงงานต่างด้าว และบ่อบำบัดน้ำเสีย

import { DEPARTMENTS, STAFF_NAMES, ZONES } from "./constants";

const KEY = "market_ops_system_data_v2";

const SEED_WPS = [
  // ฝ่ายรักษาความสะอาด
  { id: "wp-clean-waste", departmentId: "d-clean", name: "การจัดการขยะอินทรีย์และถังขยะ", description: "ล้างถังขยะและตรวจเช็คปริมาณขยะสะสมล้นตระกร้า", frequency: "daily" },
  { id: "wp-clean-water", departmentId: "d-clean", name: "บ่อบำบัดน้ำเสียและสิ่งแวดล้อม", description: "ตรวจสอบค่าปั๊มน้ำเสียและระดับ BOD/COD ตามหลักสากล", frequency: "daily" },
  { id: "wp-clean-vehicle", departmentId: "d-clean", name: "ตรวจเช็คระยะทางและน้ำมันรถปฏิบัติการ", description: "บันทึก Odometer KM และลิตรน้ำมันเพื่อป้องกันการรั่วไหล/ทุจริต", frequency: "daily" },
  { id: "wp-clean-iso", departmentId: "d-clean", name: "ตรวจความสะอาดมาตรฐาน ISO", description: "การตรวจประเมินระดับคะแนนความสะอาดรายจุดเสี่ยงสุขาภิบาล", frequency: "weekly" },
  
  // ฝ่ายความปลอดภัย (รปภ)
  { id: "wp-sec-traffic", departmentId: "d-security", name: "การจราจรและรถคอกขนส่ง", description: "การคุมเวลารถจอดแช่ และปัญหารถติดสะสมบริเวณทางเข้า", frequency: "daily" },
  { id: "wp-sec-routing", departmentId: "d-security", name: "การบริหารจัดการลานจอดและรถผัก", description: "การทำรอบเดินรถ Point A ไป Point B ไม่ให้เกินเวลาเกณฑ์", frequency: "daily" },
  { id: "wp-sec-cctv", departmentId: "d-security", name: "กล้อง CCTV และ Vision AI ลาดตระเวน", description: "ตรวจสอบรถผิดประเภทและคนเดินย้อนช่องจราจรเพื่อความปลอดภัย", frequency: "daily" },
  
  // ฝ่ายแรงงาน
  { id: "wp-lab-shift", departmentId: "d-labor", name: "การบริหารกะทำงานและเอกสารแรงงาน", description: "ตรวจรายชื่อ ความถูกต้องวีซ่า/Work Permit แรงงานต่างด้าว", frequency: "daily" },
  { id: "wp-lab-prod", departmentId: "d-labor", name: "ประสิทธิภาพแรงงานคัดแยกและลงของ", description: "วัดระยะเวลาคัดแยกสินค้าต่อชั่วโมงและอัตราว่างงาน Forklift", frequency: "daily" }
];

const SEED_ACTIVITIES = [
  // ฝ่ายรักษาความสะอาด
  { id: "act-clean-bins", workPackageId: "wp-clean-waste", name: "บันทึกระดับขยะล้นและล้างถังขยะ", description: "ตรวจจับถังขยะเต็มล้นและจำนวนการล้างถังประจำรอบ" },
  { id: "act-clean-water", workPackageId: "wp-clean-water", name: "ตรวจเช็คปั๊มและวัดค่าบ่อน้ำเสีย", description: "บันทึกสถานะปั๊มสูบน้ำเสียและค่าความเน่าเสีย BOD/COD" },
  { id: "act-clean-fuel", workPackageId: "wp-clean-vehicle", name: "บันทึกใช้น้ำมันรถขยะล้างถนน", description: "ตรวจเช็คเลขไมล์สะสมรถฉีดล้างเพื่อควบคุมการโกงน้ำมัน" },
  { id: "act-clean-iso", workPackageId: "wp-clean-iso", name: "ตรวจความสะอาด ISO รายโซนเสี่ยง", description: "บันทึกคะแนนสุขาภิบาล จุดเสี่ยงกลิ่น และจำนวนแมลงวัน" },

  // ฝ่ายความปลอดภัย (รปภ)
  { id: "act-sec-stall", workPackageId: "wp-sec-traffic", name: "ตรวจรถคอกจอดแช่ลานขนถ่าย", description: "ตรวจสอบรถกระบะจอดเกินเวลา 25 นาทีขวางสะพานขึ้นของ" },
  { id: "act-sec-jam", workPackageId: "wp-sec-traffic", name: "บันทึกรถติดขัดหนาแน่นทางเข้า", description: "ตรวจจุดรถจอดคอขวดและระยะเวลาเฉลี่ยจราจรติดขัด" },
  { id: "act-sec-routing", workPackageId: "wp-sec-routing", name: "ตรวจสอบเวลารถผักเดินเข้าอาคาร", description: "เช็คเวลาวิ่ง Point A ลานจอด ไปยัง Point B อาคารขายส่ง" },
  { id: "act-sec-cctv", workPackageId: "wp-sec-cctv", name: "ตรวจสอบเหตุแจ้งเตือนผ่านกล้อง AI", description: "ลงบันทึกรถผิดประเภท หรือคนเดินย้อนช่องการจราจร" },

  // ฝ่ายแรงงาน
  { id: "act-lab-shift", workPackageId: "wp-lab-shift", name: "ตรวจนับจำนวนคนงานและสถานะเอกสาร", description: "ตรวจสอบการหมดอายุวีซ่าและ Work Permit แรงงานต่างด้าว" },
  { id: "act-lab-prod", workPackageId: "wp-lab-prod", name: "บันทึกประสิทธิภาพขนถ่ายสินค้า", description: "วัดระยะเวลา unloading ต่อคัน และอัตราการใช้งาน Forklift" }
];

const SEED_TEMPLATES = [
  // 1. ตรวจขยะล้นและจำนวนการล้างถัง
  {
    id: "tmpl-clean-bins",
    activityId: "act-clean-bins",
    questions: [
      { id: "wasteType", label: "ประเภทขยะหลัก", type: "single_choice", options: ["ขยะผักผลไม้ (Organic)", "ขยะทั่วไป (Inorganic)", "ขยะพลาสติก/รีไซเคิล"], required: true },
      { id: "binLevelPercent", label: "ระดับความจุขยะในถัง (%)", type: "number", required: true, flagIf: { value: ">90", setStatus: "เร่งด่วน" } },
      { id: "estimatedWeightKg", label: "ปริมาณน้ำหนักขยะโดยประมาณ (กิโลกรัม)", type: "number", required: true },
      { id: "cleanedToday", label: "จำนวนรอบที่ฉีดล้างทำความสะอาดวันนี้ (รอบ)", type: "number", required: true, flagIf: { value: "0", setStatus: "ต้องติดตาม" } },
      { id: "odorLevel", label: "ระดับความรุนแรงของกลิ่น", type: "single_choice", options: ["ปกติ (Low)", "ปานกลาง (Medium)", "เหม็นวิกฤต (High)"], required: true },
      { id: "flyCount", label: "จำนวนแมลงวันเฉลี่ย (ตัว/กับดัก)", type: "number", required: true, flagIf: { value: ">50", setStatus: "ต้องติดตาม" } },
      { id: "collectorTruck", label: "รหัสรถขยะผู้รับเหมาที่เข้าเก็บ", type: "text", required: true }
    ]
  },
  // 2. ตรวจเช็คปั๊มและวัดค่าบ่อน้ำเสีย
  {
    id: "tmpl-clean-water",
    activityId: "act-clean-water",
    questions: [
      { id: "pumpStatus", label: "สถานะเครื่องปั๊มสูบน้ำเสียบ่อ 2", type: "single_choice", options: ["เปิดระบบปกติ", "ปิดระบบ/ขัดข้อง"], required: true, flagIf: { value: "ปิดระบบ/ขัดข้อง", setStatus: "เร่งด่วน" } },
      { id: "runTimeHours", label: "ชั่วโมงการรันเครื่องสะสมวันนี้ (ชั่วโมง)", type: "number", required: true },
      { id: "bodLevel", label: "ค่าบีโอดี BOD วัดได้ (mg/L) - เป้าหมาย <20", type: "number", required: true, flagIf: { value: ">20", setStatus: "ต้องติดตาม" } },
      { id: "codLevel", label: "ค่าซีโอดี COD วัดได้ (mg/L) - เป้าหมาย <120", type: "number", required: true, flagIf: { value: ">150", setStatus: "เร่งด่วน" } }
    ]
  },
  // 3. บันทึกใช้น้ำมันและระยะไมล์ KM
  {
    id: "tmpl-clean-fuel",
    activityId: "act-clean-fuel",
    questions: [
      { id: "vehicle", label: "รหัสรถปฏิบัติการล้างและขนขยะ", type: "single_choice", options: ["รถล้างถนนแรงดันสูง WT-03", "รถดูดสิ่งปฏิกูล WT-02", "รถลากเก็บถังขยะ WT-05"], required: true },
      { id: "odometerStartKm", label: "เลขไมล์เริ่มต้นงาน (KM)", type: "number", required: true },
      { id: "odometerEndKm", label: "เลขไมล์เสร็จสิ้นงาน (KM)", type: "number", required: true },
      { id: "fuelAddedLitres", label: "น้ำมันที่เติมระหว่างรอบ (ลิตร)", type: "number", required: true }
    ]
  },
  // 4. บันทึกตรวจความสะอาด ISO รายโซน
  {
    id: "tmpl-clean-iso",
    activityId: "act-clean-iso",
    questions: [
      { id: "cleanlinessGrade", label: "ผลการประเมินสุขอนามัยทางกายภาพตามมาตรฐาน ISO", type: "single_choice", options: ["เกรด A (ดีเยี่ยม)", "เกรด B (ผ่านเกณฑ์)", "เกรด C (ต้องปรับปรุง)", "เกรด D (ไม่ได้มาตรฐาน)"], required: true, flagIf: { value: "เกรด D (ไม่ได้มาตรฐาน)", setStatus: "เร่งด่วน" } },
      { id: "issuesFound", label: "ระบุข้อพบบกพร่อง / จุดน้ำท่วมขังหรือคราบสะสม", type: "text", required: false }
    ]
  },

  // 5. บันทึกรถคอกจอดแช่
  {
    id: "tmpl-sec-stall",
    activityId: "act-sec-stall",
    questions: [
      { id: "licensePlate", label: "ป้ายทะเบียนรถกระบะคอกขนส่ง", type: "text", required: true },
      { id: "vehicleType", label: "ประเภทรถสินค้า", type: "single_choice", options: ["รถกระบะคอกลอย", "รถสิบล้อส่งผลไม้", "รถโฟล์กลิฟต์ส่วนตัว"], required: true },
      { id: "waitingMinutes", label: "จำนวนเวลาที่จอดแช่ขนสินค้า (นาที) - เกณฑ์ห้ามเกิน 25 นาที", type: "number", required: true, flagIf: { value: ">25", setStatus: "ต้องติดตาม" } },
      { id: "illegalParking", label: "จอดรถผิดตำแหน่ง/กีดขวางช่องจราจรหลัก", type: "yes_no", required: true, flagIf: { value: "yes", setStatus: "เร่งด่วน" } }
    ]
  },
  // 6. บันทึกรถติดสะสมคอขวด
  {
    id: "tmpl-sec-jam",
    activityId: "act-sec-jam",
    questions: [
      { id: "queueLength", label: "ความยาวแถวคิวรถสะสม (คัน)", type: "number", required: true, flagIf: { value: ">25", setStatus: "เร่งด่วน" } },
      { id: "durationMinutes", label: "ระยะเวลารถติดขัดสะสมคอขวด (นาที) - เกณฑ์ห้ามเกิน 3 นาที", type: "number", required: true, flagIf: { value: ">3", setStatus: "เร่งด่วน" } }
    ]
  },
  // 7. ตรวจสอบเวลารถผักวิ่งเข้าอาคาร Point A -> B
  {
    id: "tmpl-sec-routing",
    activityId: "act-sec-routing",
    questions: [
      { id: "truckId", label: "รหัสรถขนสินค้าเกษตร", type: "text", required: true },
      { id: "durationMinutes", label: "เวลาวิ่งรอบจากลานจอด A ไปยังอาคาร B (นาที) - เกณฑ์ไม่เกิน 30 นาที", type: "number", required: true, flagIf: { value: ">30", setStatus: "ต้องติดตาม" } }
    ]
  },
  // 8. บันทึกเหตุกล้องวงจรปิด / Vision AI
  {
    id: "tmpl-sec-cctv",
    activityId: "act-sec-cctv",
    questions: [
      { id: "cctvStatus", label: "สถานะกล้องวงจรปิด ออนไลน์ครบถ้วนหรือไม่", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "ต้องติดตาม" } },
      { id: "visionAiAlert", label: "Vision AI ตรวจพบพฤติกรรมฝ่าฝืนจราจร", type: "single_choice", options: ["ไม่พบความผิดปกติ", "ตรวจพบคนเดินย้อนช่องทางเดินรถ", "ตรวจพบรถผิดประเภทเข้าพื้นที่ลานค้า"], required: true, flagIf: { value: "ตรวจพบคนเดินย้อนช่องทางเดินรถ", setStatus: "เร่งด่วน" } }
    ]
  },

  // 9. บันทึกกะแรงงานและเอกสารหมดอายุ
  {
    id: "tmpl-lab-shift",
    activityId: "act-lab-shift",
    questions: [
      { id: "shift", label: "กะปฏิบัติงานแรงงาน", type: "single_choice", options: ["เช้า (Morning)", "บ่าย (Afternoon)", "ดึก (Night)"], required: true },
      { id: "workersAvailable", label: "จำนวนแรงงานที่มาปฏิบัติงานจริงในกะ (คน)", type: "number", required: true },
      { id: "expectedInboundTrucks", label: "จำนวนรถกระบะขนถ่ายสินค้าเข้าในกะ (คัน)", type: "number", required: true },
      { id: "workPermitExpiring", label: "จำนวนต่างด้าวที่วีซ่า/Work Permit ใกล้หมดอายุ (<30 วัน)", type: "number", required: true, flagIf: { value: ">0", setStatus: "ต้องติดตาม" } },
      { id: "visaExpiredWorkers", label: "จำนวนต่างด้าวที่ใบอนุญาตหมดอายุแล้ว (คน)", type: "number", required: true, flagIf: { value: ">0", setStatus: "เร่งด่วน" } }
    ]
  },
  // 10. ประสิทธิภาพขนถ่ายสินค้าและ Forklift
  {
    id: "tmpl-lab-prod",
    activityId: "act-lab-prod",
    questions: [
      { id: "averageUnloadMinutes", label: "เวลาลงถ่ายสินค้าเฉลี่ยต่อคัน (นาที) - เป้าหมาย <25 นาที", type: "number", required: true, flagIf: { value: ">40", setStatus: "ต้องติดตาม" } },
      { id: "forkliftAvailable", label: "จำนวนรถโฟล์กลิฟต์ที่ว่างงานเฉลี่ย (คัน) - Utilization เป้า 70%", type: "number", required: true, flagIf: { value: "<5", setStatus: "ต้องติดตาม" } },
      { id: "overtimeHours", label: "จำนวนชั่วโมงล่วงเวลาสะสมในกะ (ชั่วโมง) - เป้าหมาย OT <12%", type: "number", required: true, flagIf: { value: ">20", setStatus: "ต้องติดตาม" } }
    ]
  }
];

// ข้อมูลจำลองเพิ่มเติมตามความต้องการใหม่ของตลาดสี่มุมเมือง
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
  { zone: "โซน B - เนื้อสัตว์ (ล้างลอกท่อน้ำตกค้าง)", frequency: 4, severity: "สูง", affectedVendors: 6, score: 74 },
  { zone: "ลานจอดรถ/ทางเข้า (ทำความสะอาดลอกคราบน้ำมัน)", frequency: 2, severity: "ต่ำ", affectedVendors: 30, score: 55 },
  { zone: "โซน E - อาหารสำเร็จรูป (ล้างฉีดขยะเปียกตกค้าง)", frequency: 1, severity: "กลาง", affectedVendors: 4, score: 40 }
];

const SEED_FUEL_LOGS = [
  { date: "2026-07-14", vehicle: "รถล้างถนนแรงดันสูง WT-03", distanceKm: 85, fuelLitres: 12.1, efficiencyKmPerLitre: 7.02, savingsPercent: 5.2 },
  { date: "2026-07-14", vehicle: "รถดูดปฏิกูลบ่อเกรอะ WT-02", distanceKm: 42, fuelLitres: 9.8, efficiencyKmPerLitre: 4.28, savingsPercent: 4.8 }
];

const SEED_BIN_WASH_LOGS = [
  { date: "2026-07-14", binsWashed: 42, target: 40, status: "ผ่านเกณฑ์" },
  { date: "2026-07-13", binsWashed: 40, target: 40, status: "ผ่านเกณฑ์" },
  { date: "2026-07-12", binsWashed: 38, target: 40, status: "ต่ำกว่าเกณฑ์" }
];

const SEED_MIGRANT_WORKERS = [
  { id: "w-01", name: "Som (นายส้ม - เมียนมา)", documentType: "Work Permit", expiryDate: "2026-07-21", status: "เตือนหมดอายุใน 7 วัน", legal: true },
  { id: "w-02", name: "Min (นายมิน - เมียนมา)", documentType: "Work Permit", expiryDate: "2026-07-21", status: "เตือนหมดอายุใน 7 วัน", legal: true },
  { id: "w-03", name: "Aung (นายอ่อง - เมียนมา)", documentType: "Visa", expiryDate: "2026-07-21", status: "เตือนหมดอายุใน 7 วัน", legal: true }
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
        { questionId: "estimatedWeightKg", label: "ปริมาณน้ำหนักขยะโดยประมาณ (กิโลกรัม)", value: 1280 },
        { questionId: "cleanedToday", label: "จำนวนรอบที่ฉีดล้างทำความสะอาดวันนี้ (รอบ)", value: 1 },
        { questionId: "odorLevel", label: "ระดับความรุนแรงของกลิ่น", value: "เหม็นวิกฤต (High)" },
        { questionId: "flyCount", label: "จำนวนแมลงวันเฉลี่ย (ตัว/กับดัก)", value: 45 },
        { questionId: "collectorTruck", label: "รหัสรถขยะผู้รับเหมาที่เข้าเก็บ", value: "WT-03" }
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
        { questionId: "runTimeHours", label: "ชั่วโมงการรันเครื่องสะสมวันนี้ (ชั่วโมง)", value: 22 },
        { questionId: "bodLevel", label: "ค่าบีโอดี BOD วัดได้ (mg/L) - เป้าหมาย <20", value: 25 },
        { questionId: "codLevel", label: "ค่าซีโอดี COD วัดได้ (mg/L) - เป้าหมาย <120", value: 160 }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 2 * day
    },
    {
      id: "s1",
      assetId: "veh-01",
      formTemplateId: "tmpl-security-1-1",
      activityId: "act-security-1-1",
      workPackageId: "wp-security-1",
      departmentId: "d-security",
      submittedBy: STAFF_NAMES[2],
      submittedAt: "2026-07-12T10:00:00.000Z",
      date: "2026-07-12",
      zone: ZONES[5],
      answers: [
        { questionId: "brake", label: "ตรวจเช็คสภาพเบรก", value: "ไม่ผ่าน" }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: new Date("2026-07-12T10:00:00.000Z").getTime()
    },
    {
      id: "s2",
      assetId: "veh-01",
      formTemplateId: "tmpl-security-1-1",
      activityId: "act-security-1-1",
      workPackageId: "wp-security-1",
      departmentId: "d-security",
      submittedBy: STAFF_NAMES[3],
      submittedAt: "2026-07-13T10:00:00.000Z",
      date: "2026-07-13",
      zone: ZONES[5],
      answers: [
        { questionId: "brake", label: "ตรวจเช็คสภาพเบรก", value: "ไม่ผ่าน" }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: new Date("2026-07-13T10:00:00.000Z").getTime()
    },
    {
      id: "sub-3",
      formTemplateId: "tmpl-sec-stall",
      activityId: "act-sec-stall",
      workPackageId: "wp-sec-traffic",
      departmentId: "d-security",
      submittedBy: STAFF_NAMES[2],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[5],
      answers: [
        { questionId: "licensePlate", label: "ป้ายทะเบียนรถกระบะคอกขนส่ง", value: "70-4567" },
        { questionId: "vehicleType", label: "ประเภทรถสินค้า", value: "รถกระบะคอกลอย" },
        { questionId: "waitingMinutes", label: "จำนวนเวลาที่จอดแช่ขนสินค้า (นาที) - เกณฑ์ห้ามเกิน 25 นาที", value: 34 },
        { questionId: "illegalParking", label: "จอดรถผิดตำแหน่ง/กีดขวางช่องจราจรหลัก", value: "yes" }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 1 * day
    },
    {
      id: "sub-4",
      formTemplateId: "tmpl-sec-jam",
      activityId: "act-sec-jam",
      workPackageId: "wp-sec-traffic",
      departmentId: "d-security",
      submittedBy: STAFF_NAMES[3],
      submittedAt: new Date(now - 2 * day).toISOString(),
      date: new Date(now - 2 * day).toISOString().slice(0, 10),
      zone: ZONES[5],
      answers: [
        { questionId: "queueLength", label: "ความยาวแถวคิวรถสะสม (คัน)", value: 31 },
        { questionId: "durationMinutes", label: "ระยะเวลารถติดขัดสะสมคอขวด (นาที) - เกณฑ์ห้ามเกิน 3 นาที", value: 15 }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 2 * day
    },
    {
      id: "sub-5",
      formTemplateId: "tmpl-lab-shift",
      activityId: "act-lab-shift",
      workPackageId: "wp-lab-shift",
      departmentId: "d-labor",
      submittedBy: STAFF_NAMES[0],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[2],
      answers: [
        { questionId: "shift", label: "กะปฏิบัติงานแรงงาน", value: "เช้า (Morning)" },
        { questionId: "workersAvailable", label: "จำนวนแรงงานที่มาปฏิบัติงานจริงในกะ (คน)", value: 185 },
        { questionId: "expectedInboundTrucks", label: "จำนวนรถกระบะขนถ่ายสินค้าเข้าในกะ (คัน)", value: 460 },
        { questionId: "workPermitExpiring", label: "จำนวนต่างด้าวที่วีซ่า/Work Permit ใกล้หมดอายุ (<30 วัน)", value: 16 },
        { questionId: "visaExpiredWorkers", label: "จำนวนต่างด้าวที่ใบอนุญาตหมดอายุแล้ว (คน)", value: 4 }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 1 * day
    },
    {
      id: "sub-6",
      formTemplateId: "tmpl-lab-prod",
      activityId: "act-lab-prod",
      workPackageId: "wp-lab-prod",
      departmentId: "d-labor",
      submittedBy: STAFF_NAMES[1],
      submittedAt: new Date(now - 3 * day).toISOString(),
      date: new Date(now - 3 * day).toISOString().slice(0, 10),
      zone: ZONES[2],
      answers: [
        { questionId: "averageUnloadMinutes", label: "เวลาลงถ่ายสินค้าเฉลี่ยต่อคัน (นาที) - เป้าหมาย <25 นาที", value: 31 },
        { questionId: "forkliftAvailable", label: "จำนวนรถโฟล์กลิฟต์ที่ว่างงานเฉลี่ย (คัน) - Utilization เป้า 70%", value: 18 },
        { questionId: "overtimeHours", label: "จำนวนชั่วโมงล่วงเวลาสะสมในกะ (ชั่วโมง) - เป้าหมาย OT <12%", value: 124 }
      ],
      derivedStatus: "ต้องติดตาม",
      createdAt: now - 3 * day
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
    migrantWorkers: []
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
        migrantWorkers: SEED_MIGRANT_WORKERS
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
      migrantWorkers: []
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
    migrantWorkers: SEED_MIGRANT_WORKERS
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
    migrantWorkers: data.migrantWorkers || SEED_MIGRANT_WORKERS
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
