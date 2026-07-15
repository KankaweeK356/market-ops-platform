// lib/storage.js
//
// เก็บข้อมูลแบบลำดับชั้น (Department -> WorkPackage -> Activity -> FormTemplate)
// และรายการ FormSubmission ผ่าน localStorage ของเบราว์เซอร์
//
// โครงสร้างได้รับการปรับแต่งใหม่ตามคำสั่ง KPI ตลาดสี่มุมเมือง ครบถ้วนทั้ง 7 ฝ่ายงาน

import { DEPARTMENTS, STAFF_NAMES, ZONES } from "./constants";

const KEY = "market_ops_system_data_v2";

const SEED_WPS = [
  // 1. ฝ่ายจัดพื้นที่ & สารพิษ (d-space)
  { id: "wp-space-occupancy", departmentId: "d-space", name: "อัตราการเช่าพื้นที่การค้า (Stall Occupancy)", description: "ตรวจเช็คระดับแผงเช่าและการใช้ประโยชน์พื้นที่การค้าแยกตามโซน", frequency: "daily" },
  { id: "wp-space-toxin", departmentId: "d-space", name: "ตรวจสารพิษตกค้างรายแผงค้าและสินค้า", description: "รายงานแนวโน้มความเสี่ยงของผักผลไม้และการสุ่มคัดกรองสารปนเปื้อน", frequency: "weekly" },
  { id: "wp-space-fines", departmentId: "d-space", name: "รายได้ค่าปรับและจำนวนละเมิดแผงค้า", description: "สรุปยอดค่าปรับการค้าและแผงที่จัดวางสินค้าล้ำช่องทางเดิน", frequency: "daily" },

  // 2. ฝ่ายรักษาความสะอาด (d-clean)
  { id: "wp-clean-waste", departmentId: "d-clean", name: "การจัดการขยะอินทรีย์และโครงการ Zero Waste", description: "ตรวจเช็คระดับขยะสะสมในถังพักและปริมาณส่งมอบเศษผักปุ๋ยอินทรีย์", frequency: "daily" },
  { id: "wp-clean-water", departmentId: "d-clean", name: "บ่อบำบัดน้ำเสียและคุณภาพน้ำ COD", description: "ตรวจสอบสถานะปั๊มสูบน้ำเสียและค่าความสกปรก COD ของน้ำทิ้ง", frequency: "daily" },
  { id: "wp-clean-complaint", departmentId: "d-clean", name: "การเคลียร์ข้อร้องเรียนจุดสกปรกตาม SLA", description: "ตรวจสอบความเร็วการจัดการล้างและกวาดจุดเปื้อนตามเวลากำหนด 30 นาที", frequency: "daily" },
  
  // 3. ฝ่ายความปลอดภัย (d-security)
  { id: "wp-sec-traffic", departmentId: "d-security", name: "จราจรทางเข้าและเวลาเคลียร์คอขวด", description: "ตรวจสอบเวลาเคลียร์รถติดคอขวด (เกณฑ์ห้ามเกิน 5 นาที)", frequency: "daily" },
  { id: "wp-sec-routing", departmentId: "d-security", name: "การจัดระเบียบเดินรถเข้าอาคารรถผัก 3 รอบหลัก", description: "ตรวจสอบเวลารอบวิ่งเข้าอาคารลานผัก (เป้าหมาย 40 นาที/รอบ)", frequency: "daily" },
  { id: "wp-sec-parking", departmentId: "d-security", name: "จัดการลักลอบจอดเพื่ออำนวยความสะดวกผู้ซื้อ", description: "เคลียร์พวกลักลอบแอบจอดรถยนต์ส่วนบุคคลเพื่อลดข้อร้องเรียน", frequency: "daily" },
  
  // 4. ฝ่ายแรงงาน (d-labor)
  { id: "wp-lab-unload", departmentId: "d-labor", name: "ควบคุมเวลารถคอยและลงสินค้า", description: "ตรวจจับรถลูกค้ารอคอยลงสินค้า (ห้ามเกิน 10 นาที) และเวลาลงตาม SLA", frequency: "daily" },
  { id: "wp-lab-forklift", departmentId: "d-labor", name: "ประสิทธิภาพการใช้และการตรวจเช็ค Forklift", description: "ติดตามอัตราการใช้งาน Forklift (ไม่ต่ำกว่า 80%) และตรวจบำรุงรักษา PM", frequency: "daily" },

  // 5. ฝ่ายซ่อมบำรุง (d-maintenance)
  { id: "wp-maint-pm", departmentId: "d-maintenance", name: "การบำรุงรักษาเชิงป้องกัน (PM)", description: "ตรวจเช็คเครื่องผลิตไฟฟ้า ปั๊มน้ำ และเครื่องจักรเพื่อลด Breakdown", frequency: "daily" },
  { id: "wp-maint-request", departmentId: "d-maintenance", name: "งานแจ้งซ่อมและควบคุม SLA", description: "วัดระยะเวลางานปิดจ๊อบซ่อมแผงค้าและงานไฟฟ้าตาม SLA", frequency: "daily" },

  // 6. ฝ่าย รปภ. เฉพาะกิจ (d-specsec)
  { id: "wp-specsec-emergency", departmentId: "d-specsec", name: "เหตุฉุกเฉิน ลักทรัพย์ และทะเลาะวิวาท", description: "บันทึกและประเมินอุบัติเหตุและการระงับเหตุความสงบเรียบร้อย", frequency: "daily" },
  { id: "wp-specsec-drugs", departmentId: "d-specsec", name: "สุ่มตรวจสารเสพติดกลุ่มแรงงาน", description: "สถิติการสุ่มตรวจปัสสาวะเพื่อความปลอดภัยประจำสัปดาห์", frequency: "weekly" },

  // 7. ฝ่ายห้องเย็น (d-cold)
  { id: "wp-cold-satisfaction", departmentId: "d-cold", name: "พึงพอใจลูกค้าและใช้พื้นที่ห้องเย็น", description: "ประเมินคะแนนความพึงพอใจบริการและอัตราการรับฝากสินค้า", frequency: "monthly" },
  { id: "wp-cold-power", departmentId: "d-cold", name: "การใช้พลังงานไฟฟ้าห้องเย็นรายห้อง", description: "ติดตามหน่วยไฟต่อตารางเมตรต่อวันเพื่อประหยัดพลังงาน", frequency: "daily" }
];

const SEED_ACTIVITIES = [
  // 1. ฝ่ายจัดพื้นที่ & สารพิษ
  { id: "act-space-occupancy", workPackageId: "wp-space-occupancy", name: "บันทึกอัตราการเช่าแผงค้ารายโซน", description: "บันทึกสัดส่วนจำนวนแผงเช่าสะสม" },
  { id: "act-space-toxin", workPackageId: "wp-space-toxin", name: "สุ่มตรวจวัดสารปนเปื้อนในสินค้าเกษตร", description: "บันทึกระดับความปลอดภัยของประเภทผักผลไม้" },
  { id: "act-space-fines", workPackageId: "wp-space-fines", name: "ตรวจบันทึกยอดค่าปรับแผงค้ารายวัน", description: "สถิติแผงค่าวางของเกะกะและค้างจ่ายค่าปรับ" },

  // 2. ฝ่ายรักษาความสะอาด
  { id: "act-clean-bins", workPackageId: "wp-clean-waste", name: "บันทึกระดับขยะล้นและล้างถังขยะ", description: "ตรวจจับถังขยะเต็มล้นและปริมาณขยะผักผลไม้" },
  { id: "act-clean-water", workPackageId: "wp-clean-water", name: "ตรวจเช็คปั๊มและวัดค่าบ่อน้ำเสีย", description: "บันทึกสถานะปั๊มสูบน้ำเสียและค่าความเน่าเสีย COD" },
  { id: "act-clean-complaint", workPackageId: "wp-clean-complaint", name: "บันทึกเวลาเคลียร์จุดสกปรกตาม SLA", description: "บันทึกระยะเวลาดำเนินการหลังได้รับเรื่องร้องเรียนจุดสกปรก" },

  // 3. ฝ่ายความปลอดภัย
  { id: "act-sec-traffic", workPackageId: "wp-sec-traffic", name: "ตรวจจับและบันทึกเวลาเคลียร์รถติด", description: "ตรวจจับรถติดหน้าด่านทางเข้า (ห้ามเกิน 5 นาที)" },
  { id: "act-sec-routing", workPackageId: "wp-sec-routing", name: "ตรวจรอบรถผักวิ่งเข้าอาคารลานค้า", description: "ตรวจความก้าวหน้าการปล่อยรถเข้าอาคารผักผลไม้ (เป้า 40 นาที)" },
  { id: "act-sec-parking", workPackageId: "wp-sec-parking", name: "ตรวจจับพวกลักลอบแอบจอดรถยนต์", description: "ลงตรวจสอบและดำเนินการล็อกล้อรถลักลอบจอดทิ้ง" },

  // 4. ฝ่ายแรงงาน
  { id: "act-lab-unload", workPackageId: "wp-lab-unload", name: "บันทึกเวลารถรอและเวลาลงของ", description: "ตรวจวัดเวลารถลูกค้ารอลงสินค้า (ห้ามเกิน 10 นาที)" },
  { id: "act-lab-forklift", workPackageId: "wp-lab-forklift", name: "บันทึก Utilization และการตรวจเช็ค Forklift", description: "ตรวจบันทึกประสิทธิภาพการใช้รถและสภาพ PM ประจำรอบ" },

  // 5. ฝ่ายซ่อมบำรุง
  { id: "act-maint-pm", workPackageId: "wp-maint-pm", name: "ตรวจสอบสภาพเครื่องจักรและรถตัก", description: "เช็คระบบไฟฟ้าเครื่องผลิตไฟสำรองและเครื่องสูบระบายหลัก" },
  { id: "act-maint-sla", workPackageId: "wp-maint-request", name: "บันทึกสถิติงานแจ้งซ่อมตาม SLA", description: "ตรวจเช็คเวลาจบงานซ่อมประปา ระบบไฟฟ้า และโครงสร้างแผงค้า" },

  // 6. ฝ่าย รปภ. เฉพาะกิจ
  { id: "act-specsec-emergency", workPackageId: "wp-specsec-emergency", name: "ตรวจสอบเหตุทะเลาะวิวาทและลักทรัพย์", description: "สถิติรายงานเหตุด่วนความมั่นคงลานจอดและแผงค้า" },
  { id: "act-specsec-drugs", workPackageId: "wp-specsec-drugs", name: "รายงานสุ่มตรวจหาสารเสพติดในแรงงาน", description: "ตรวจสอบประวัติสุ่มฉี่กลุ่มแรงงานต่างด้าวถือสิทธิ์" },

  // 7. ฝ่ายห้องเย็น
  { id: "act-cold-satisfaction", workPackageId: "wp-cold-satisfaction", name: "บันทึกการใช้ประโยชน์พื้นที่ห้องแช่เย็น", description: "สัดส่วนคะแนนความพึงพอใจการใช้พื้นที่ฝากสินค้า" },
  { id: "act-cold-power", workPackageId: "wp-cold-power", name: "จดบันทึกหน่วยไฟฟ้าห้องเย็น", description: "ประเมินค่าพลังงานไฟฟ้าแยกตามมิเตอร์ห้องแช่แข็ง" }
];

const SEED_TEMPLATES = [
  // 1. จัดพื้นที่ - แผงเช่า (ธุรกรรมการเช่าแผงรายวัน)
  {
    id: "tmpl-space-occupancy",
    activityId: "act-space-occupancy",
    questions: [
      { id: "stallCode", label: "รหัสแผงค้า (เช่น A-01, B-12, C-99)", type: "text", required: true },
      { id: "actionType", label: "ประเภทธุรกรรมแผงค้า", type: "single_choice", options: ["ปล่อยเช่าแผงสำเร็จ (Rent Out)", "ยกเลิก/คืนแผงค้า (Return Stall)"], required: true, flagIf: { value: "ยกเลิก/คืนแผงค้า (Return Stall)", setStatus: "ต้องติดตาม" } },
      { id: "tenantName", label: "ชื่อผู้เช่า / ผู้ประกอบการแผงค้า", type: "text", required: true }
    ]
  },
  // 2. จัดพื้นที่ - ตรวจสารพิษ
  {
    id: "tmpl-space-toxin",
    activityId: "act-space-toxin",
    questions: [
      { id: "testedSamplesCount", label: "จำนวนผักผลไม้ตัวอย่างที่ส่งตรวจสุ่ม (รายการ)", type: "number", required: true },
      { id: "unsafeSamplesCount", label: "จำนวนตัวอย่างที่พบยาฆ่าแมลงหรือสารเคมีปนเปื้อน (รายการ)", type: "number", required: true }
    ]
  },
  // 3. จัดพื้นที่ - ค่าปรับ
  {
    id: "tmpl-space-fines",
    activityId: "act-space-fines",
    questions: [
      { id: "fineAmount", label: "มูลค่าสั่งปรับผู้ฝ่าฝืนกฎวันนี้ (บาท)", type: "number", required: true },
      { id: "violationCount", label: "จำนวนครั้งตรวจพบแผงค้าล้ำทางเดิน (ครั้ง)", type: "number", required: true, flagIf: { value: ">5", setStatus: "ต้องติดตาม" } }
    ]
  },

  // 4. ตรวจขยะล้น (รักษาความสะอาด)
  {
    id: "tmpl-clean-bins",
    activityId: "act-clean-bins",
    questions: [
      { id: "wasteType", label: "ประเภทขยะหลัก", type: "single_choice", options: ["ขยะผักผลไม้ (Organic)", "ขยะทั่วไป (Inorganic)", "ขยะพลาสติก/รีไซเคิล"], required: true },
      { id: "maxCapacityKg", label: "ความจุสูงสุดของถังขยะและลานพักสะสม (กก.)", type: "number", required: true },
      { id: "currentWeightKg", label: "น้ำหนักขยะที่ชั่งตวงสะสมจริงวันนี้ (กก.)", type: "number", required: true },
      { id: "odorLevel", label: "ระดับความรุนแรงของกลิ่น", type: "single_choice", options: ["ปกติ (Low)", "ปานกลาง (Medium)", "เหม็นวิกฤต (High)"], required: true }
    ]
  },
  // 5. บ่อน้ำเสีย (รักษาความสะอาด)
  {
    id: "tmpl-clean-water",
    activityId: "act-clean-water",
    questions: [
      { id: "pumpStatus", label: "สถานะเครื่องปั๊มสูบน้ำเสียบ่อ 2", type: "single_choice", options: ["เปิดระบบปกติ", "ปิดระบบ/ขัดข้อง"], required: true, flagIf: { value: "ปิดระบบ/ขัดข้อง", setStatus: "เร่งด่วน" } },
      { id: "codLevel", label: "ค่าซีโอดี COD วัดได้ (mg/L) - เป้าหมาย <120", type: "number", required: true, flagIf: { value: ">120", setStatus: "เร่งด่วน" } }
    ]
  },
  // 6. เคลียร์จุดสกปรกตาม SLA (รักษาความสะอาด)
  {
    id: "tmpl-clean-complaint",
    activityId: "act-clean-complaint",
    questions: [
      { id: "complaintId", label: "รหัสข้อร้องเรียนจุดสกปรก", type: "text", required: true },
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
  // 8. จัดรถเข้าอาคารรถผัก (ความปลอดภัย)
  {
    id: "tmpl-sec-routing",
    activityId: "act-sec-routing",
    questions: [
      { id: "truckRoutingMinutes", label: "เวลาที่ใช้จัดรถเข้าอาคารผัก (นาที) - เป้าหมายไม่เกิน 40 นาที", type: "number", required: true, flagIf: { value: ">40", setStatus: "ต้องติดตาม" } }
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

  // 10. เวลารถลูกค้ารอคอยและลงสินค้า (แรงงาน)
  {
    id: "tmpl-lab-unload",
    activityId: "act-lab-unload",
    questions: [
      { id: "customerWaitMinutes", label: "เวลารอคอยเฉลี่ยของรถลูกค้า (นาที) - ห้ามเกิน 10 นาที", type: "number", required: true, flagIf: { value: ">10", setStatus: "เร่งด่วน" } },
      { id: "unloadMinutes", label: "เวลาที่ใช้ในการลงสินค้าขนถ่ายจริง (นาที)", type: "number", required: true },
      { id: "slaMet", label: "ผลการขนสินค้าเสร็จสิ้นทันตามข้อตกลง SLA หรือไม่", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "เร่งด่วน" } }
    ]
  },
  // 11. การใช้งานและการตรวจเช็ค Forklift (แรงงาน)
  {
    id: "tmpl-lab-forklift",
    activityId: "act-lab-forklift",
    questions: [
      { id: "forkliftUtilizePercent", label: "อัตราการใช้งานรถ Forklift ในกะ (%) - เป้าหมาย >= 80%", type: "number", required: true, flagIf: { value: "<80", setStatus: "ต้องติดตาม" } },
      { id: "pmChecked", label: "ผ่านการตรวจสอบบำรุงรักษาประจำกะ (PM Check) หรือไม่", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "เร่งด่วน" } }
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
      { id: "breakdownMinutes", label: "เวลาที่เครื่องจักรเสียขัดข้อง Breakdown (นาที)", type: "number", required: true, flagIf: { value: ">60", setStatus: "เร่งด่วน" } },
      { id: "utilizationPercent", label: "อัตราการเปิดใช้งานเครื่องจักร (Utilize %)", type: "number", required: true, flagIf: { value: "<70", setStatus: "ต้องติดตาม" } }
    ]
  },
  // 13. ฝ่ายซ่อมบำรุง - SLA แจ้งซ่อม
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
  },

  // 14. รปภ. เฉพาะกิจ - เหตุฉุกเฉิน
  {
    id: "tmpl-specsec-emergency",
    activityId: "act-specsec-emergency",
    questions: [
      { id: "emergencyIncidents", label: "จำนวนเหตุลักทรัพย์/ทะเลาะวิวาทวันนี้ (ครั้ง) - เป้าหมาย = 0", type: "number", required: true, flagIf: { value: ">0", setStatus: "เร่งด่วน" } },
      { id: "injuredCount", label: "จำนวนผู้บาดเจ็บจากเหตุการณ์ (คน)", type: "number", required: true }
    ]
  },
  // 15. รปภ. เฉพาะกิจ - ตรวจสารเสพติด
  {
    id: "tmpl-specsec-drugs",
    activityId: "act-specsec-drugs",
    questions: [
      { id: "positiveDrugCount", label: "จำนวนตรวจพบสารเสพติดในการสุ่ม (คน) - เป้าหมาย = 0", type: "number", required: true, flagIf: { value: ">0", setStatus: "เร่งด่วน" } },
      { id: "totalTested", label: "จำนวนแรงงานที่สุ่มรับการตรวจฉี่สะสม (คน)", type: "number", required: true }
    ]
  },

  // 16. ห้องเย็น - ความพึงพอใจและสัดส่วนรับฝาก
  {
    id: "tmpl-cold-satisfaction",
    activityId: "act-cold-satisfaction",
    questions: [
      { id: "satisfactionScore", label: "คะแนนพึงพอใจลูกค้าเฉลี่ย (คะแนนเต็ม 5) - เป้าหมาย >= 4.5", type: "number", required: true, flagIf: { value: "<4.5", setStatus: "ต้องติดตาม" } },
      { id: "depositRatePercent", label: "อัตราใช้ประโยชน์รับฝากรายชิ้น (%) - เป้าหมาย >= 80%", type: "number", required: true, flagIf: { value: "<80", setStatus: "ต้องติดตาม" } }
    ]
  },
  // 17. ห้องเย็น - การประหยัดไฟฟ้า
  {
    id: "tmpl-cold-power",
    activityId: "act-cold-power",
    questions: [
      { id: "powerKwh", label: "การใช้ไฟเฉลี่ยห้องแช่เย็น (หน่วย/ตร.ม./วัน) - เป้าหมาย <= 1.2", type: "number", required: true, flagIf: { value: ">1.2", setStatus: "ต้องติดตาม" } }
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
    // 1. ฝ่ายจัดพื้นที่ & สารพิษ
    {
      id: "sub-sp1",
      formTemplateId: "tmpl-space-occupancy",
      activityId: "act-space-occupancy",
      workPackageId: "wp-space-occupancy",
      departmentId: "d-space",
      submittedBy: STAFF_NAMES[0],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[0],
      answers: [
        { questionId: "stallCode", label: "รหัสแผงค้า (เช่น A-01, B-12, C-99)", value: "B-24" },
        { questionId: "actionType", label: "ประเภทธุรกรรมแผงค้า", value: "ยกเลิก/คืนแผงค้า (Return Stall)" },
        { questionId: "tenantName", label: "ชื่อผู้เช่า / ผู้ประกอบการแผงค้า", value: "ร้านเฮียเล้ง ผักสด" }
      ],
      derivedStatus: "ต้องติดตาม",
      createdAt: now - 1 * day
    },
    {
      id: "sub-sp2",
      formTemplateId: "tmpl-space-toxin",
      activityId: "act-space-toxin",
      workPackageId: "wp-space-toxin",
      departmentId: "d-space",
      submittedBy: STAFF_NAMES[1],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[0],
      answers: [
        { questionId: "testedSamplesCount", label: "จำนวนผักผลไม้ตัวอย่างที่ส่งตรวจสุ่ม (รายการ)", value: 60 },
        { questionId: "unsafeSamplesCount", label: "จำนวนตัวอย่างที่พบยาฆ่าแมลงหรือสารเคมีปนเปื้อน (รายการ)", value: 3 }
      ],
      derivedStatus: "ต้องติดตาม",
      createdAt: now - 1 * day
    },
    {
      id: "sub-sp3",
      formTemplateId: "tmpl-space-fines",
      activityId: "act-space-fines",
      workPackageId: "wp-space-fines",
      departmentId: "d-space",
      submittedBy: STAFF_NAMES[2],
      submittedAt: new Date(now - 2 * day).toISOString(),
      date: new Date(now - 2 * day).toISOString().slice(0, 10),
      zone: ZONES[1],
      answers: [
        { questionId: "fineAmount", label: "มูลค่าสั่งปรับผู้ฝ่าฝืนกฎวันนี้ (บาท)", value: 12500 },
        { questionId: "violationCount", label: "จำนวนครั้งตรวจพบแผงค้าล้ำทางเดิน (ครั้ง) - เป้าหมาย <5", value: 8 }
      ],
      derivedStatus: "ต้องติดตาม",
      createdAt: now - 2 * day
    },

    // 2. ฝ่ายรักษาความสะอาด
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
        { questionId: "maxCapacityKg", label: "ความจุสูงสุดของถังขยะและลานพักสะสม (กก.)", value: 1000 },
        { questionId: "currentWeightKg", label: "น้ำหนักขยะที่ชั่งตวงสะสมจริงวันนี้ (กก.)", value: 920 },
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

    // 3. ฝ่ายความปลอดภัย
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

    // 4. ฝ่ายแรงงาน
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

    // 5. ฝ่ายซ่อมบำรุง
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
    },

    // 6. ฝ่าย รปภ. เฉพาะกิจ
    {
      id: "sub-ss1",
      formTemplateId: "tmpl-specsec-emergency",
      activityId: "act-specsec-emergency",
      workPackageId: "wp-specsec-emergency",
      departmentId: "d-specsec",
      submittedBy: STAFF_NAMES[0],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[6],
      answers: [
        { questionId: "emergencyIncidents", label: "จำนวนเหตุลักทรัพย์/ทะเลาะวิวาทวันนี้ (ครั้ง) - เป้าหมาย = 0", value: 2 },
        { questionId: "injuredCount", label: "จำนวนผู้บาดเจ็บจากเหตุการณ์ (คน)", value: 0 }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 1 * day
    },
    {
      id: "sub-ss2",
      formTemplateId: "tmpl-specsec-drugs",
      activityId: "act-specsec-drugs",
      workPackageId: "wp-specsec-drugs",
      departmentId: "d-specsec",
      submittedBy: STAFF_NAMES[1],
      submittedAt: new Date(now - 2 * day).toISOString(),
      date: new Date(now - 2 * day).toISOString().slice(0, 10),
      zone: ZONES[2],
      answers: [
        { questionId: "positiveDrugCount", label: "จำนวนตรวจพบสารเสพติดในการสุ่ม (คน) - เป้าหมาย = 0", value: 2 },
        { questionId: "totalTested", label: "จำนวนแรงงานที่สุ่มรับการตรวจฉี่สะสม (คน)", value: 320 }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 2 * day
    },

    // 7. ฝ่ายห้องเย็น
    {
      id: "sub-cd1",
      formTemplateId: "tmpl-cold-satisfaction",
      activityId: "act-cold-satisfaction",
      workPackageId: "wp-cold-satisfaction",
      departmentId: "d-cold",
      submittedBy: STAFF_NAMES[2],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[4],
      answers: [
        { questionId: "satisfactionScore", label: "คะแนนพึงพอใจลูกค้าเฉลี่ย (คะแนนเต็ม 5) - เป้าหมาย >= 4.5", value: 4.8 },
        { questionId: "depositRatePercent", label: "อัตราใช้ประโยชน์รับฝากรายชิ้น (%) - เป้าหมาย >= 80%", value: 85 }
      ],
      derivedStatus: "ปกติ",
      createdAt: now - 1 * day
    },
    {
      id: "sub-cd2",
      formTemplateId: "tmpl-cold-power",
      activityId: "act-cold-power",
      workPackageId: "wp-cold-power",
      departmentId: "d-cold",
      submittedBy: STAFF_NAMES[3],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[4],
      answers: [
        { questionId: "powerKwh", label: "การใช้ไฟเฉลี่ยห้องแช่เย็น (หน่วย/ตร.ม./วัน) - เป้าหมาย <= 1.2", value: 1.45 }
      ],
      derivedStatus: "ต้องติดตาม",
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

  // ประมวลผลดัชนี KPI รายฝ่ายงานแบบไดนามิกจากข้อมูลรายงานดิบในฐานข้อมูล
  const dynamicKPIs = {
    "d-space": { occupancy: 96.0, safety: 95.0, routing: 33.0 },
    "d-clean": { overflow: 92.0, cod: 160.0, sla: 88.0 },
    "d-security": { traffic: 15.0, routing: 42.0, illegal: 82.0 },
    "d-labor": { wait: 22.0, sla: 81.0, forklift: 50.0 },
    "d-maintenance": { utilize: 45.0, breakdown: 120.0, sla: 91.0 },
    "d-specsec": { incidents: 2, drugs: 2 },
    "d-cold": { satisfaction: 4.8, deposit: 85.0, power: 1.45 }
  };

  const findAnswer = (sub, questionId) => {
    const ans = sub.answers?.find(a => a.questionId === questionId);
    return ans ? Number(ans.value) : null;
  };
  const findAnswerStr = (sub, questionId) => {
    const ans = sub.answers?.find(a => a.questionId === questionId);
    return ans ? String(ans.value) : null;
  };

  // 1. ฝ่ายจัดพื้นที่ & สารพิษ (d-space)
  const spaceOccupancySubs = submissions.filter(s => s.formTemplateId === "tmpl-space-occupancy");
  if (spaceOccupancySubs.length > 0) {
    let occupied = 80;
    spaceOccupancySubs.forEach(s => {
      if (s.resolved) {
        occupied = 94;
      } else {
        const type = findAnswerStr(s, "actionType");
        if (type === "ปล่อยเช่าแผงสำเร็จ (Rent Out)") {
          occupied = Math.min(100, occupied + 1);
        } else if (type === "ยกเลิก/คืนแผงค้า (Return Stall)") {
          occupied = Math.max(0, occupied - 1);
        }
      }
    });
    dynamicKPIs["d-space"].occupancy = occupied;
  }

  const spaceToxinSubs = submissions.filter(s => s.formTemplateId === "tmpl-space-toxin");
  if (spaceToxinSubs.length > 0) {
    let totalTested = 0;
    let unsafeTested = 0;
    spaceToxinSubs.forEach(s => {
      const tot = findAnswer(s, "testedSamplesCount") || 60;
      const uns = findAnswer(s, "unsafeSamplesCount") || 3;
      totalTested += tot;
      unsafeTested += uns;
    });
    dynamicKPIs["d-space"].safety = totalTested > 0 ? Number((((totalTested - unsafeTested) / totalTested) * 100).toFixed(1)) : 95.0;
  }

  const spaceRoutingSubs = submissions.filter(s => s.formTemplateId === "tmpl-sec-routing" && s.departmentId === "d-space");
  if (spaceRoutingSubs.length > 0) {
    let totalMins = 0;
    spaceRoutingSubs.forEach(s => {
      totalMins += (findAnswer(s, "truckRoutingMinutes") || 33);
    });
    dynamicKPIs["d-space"].routing = Number((totalMins / spaceRoutingSubs.length).toFixed(1));
  }

  // 2. ฝ่ายรักษาความสะอาด (d-clean)
  const cleanWasteSubs = submissions.filter(s => s.formTemplateId === "tmpl-clean-bins");
  if (cleanWasteSubs.length > 0) {
    let totalMax = 0;
    let totalCurr = 0;
    cleanWasteSubs.forEach(s => {
      const max = findAnswer(s, "maxCapacityKg") || 1000;
      const curr = findAnswer(s, "currentWeightKg") || 920;
      totalMax += max;
      totalCurr += curr;
    });
    dynamicKPIs["d-clean"].overflow = totalMax > 0 ? Number(((totalCurr / totalMax) * 100).toFixed(1)) : 92.0;
  }

  const cleanWaterSubs = submissions.filter(s => s.formTemplateId === "tmpl-clean-water");
  if (cleanWaterSubs.length > 0) {
    let totalCod = 0;
    cleanWaterSubs.forEach(s => {
      totalCod += (findAnswer(s, "codLevel") || 160);
    });
    dynamicKPIs["d-clean"].cod = Number((totalCod / cleanWaterSubs.length).toFixed(1));
  }

  const cleanComplaintSubs = submissions.filter(s => s.formTemplateId === "tmpl-clean-complaint");
  if (cleanComplaintSubs.length > 0) {
    let metCount = 0;
    cleanComplaintSubs.forEach(s => {
      const mins = findAnswer(s, "minutesToClear") || 45;
      if (mins <= 30) metCount++;
    });
    dynamicKPIs["d-clean"].sla = Number(((metCount / cleanComplaintSubs.length) * 100).toFixed(1));
  }

  // 3. ฝ่ายความปลอดภัย (d-security)
  const secTrafficSubs = submissions.filter(s => s.formTemplateId === "tmpl-sec-traffic");
  if (secTrafficSubs.length > 0) {
    let totalTrafficMins = 0;
    secTrafficSubs.forEach(s => {
      totalTrafficMins += (findAnswer(s, "trafficWaitMinutes") || 15);
    });
    dynamicKPIs["d-security"].traffic = Number((totalTrafficMins / secTrafficSubs.length).toFixed(1));
  }

  const secRoutingSubs = submissions.filter(s => s.formTemplateId === "tmpl-sec-routing" && s.departmentId === "d-security");
  if (secRoutingSubs.length > 0) {
    let totalMins = 0;
    secRoutingSubs.forEach(s => {
      totalMins += (findAnswer(s, "truckRoutingMinutes") || 42);
    });
    dynamicKPIs["d-security"].routing = Number((totalMins / secRoutingSubs.length).toFixed(1));
  }

  const secParkingSubs = submissions.filter(s => s.formTemplateId === "tmpl-sec-parking");
  if (secParkingSubs.length > 0) {
    let totalLogged = secParkingSubs.length;
    let lockedCount = 0;
    secParkingSubs.forEach(s => {
      const act = findAnswerStr(s, "lockAction");
      if (act === "yes" || act === "ปกติ/ใช่") lockedCount++;
    });
    dynamicKPIs["d-security"].illegal = totalLogged > 0 ? Number(((lockedCount / totalLogged) * 100).toFixed(1)) : 82.0;
  }

  // 4. ฝ่ายแรงงาน (d-labor)
  const laborUnloadSubs = submissions.filter(s => s.formTemplateId === "tmpl-lab-unload");
  if (laborUnloadSubs.length > 0) {
    let maxWait = 0;
    let metSla = 0;
    laborUnloadSubs.forEach(s => {
      const w = findAnswer(s, "customerWaitMinutes") || 22;
      if (w > maxWait) maxWait = w;
      const met = findAnswerStr(s, "slaMet");
      if (met === "yes" || met === "ปกติ/ใช่") metSla++;
    });
    dynamicKPIs["d-labor"].wait = maxWait;
    dynamicKPIs["d-labor"].sla = Number(((metSla / laborUnloadSubs.length) * 100).toFixed(1));
  }

  const laborForkliftSubs = submissions.filter(s => s.formTemplateId === "tmpl-lab-forklift");
  if (laborForkliftSubs.length > 0) {
    let totalUtil = 0;
    laborForkliftSubs.forEach(s => {
      totalUtil += (findAnswer(s, "forkliftUtilizePercent") || 50);
    });
    dynamicKPIs["d-labor"].forklift = Number((totalUtil / laborForkliftSubs.length).toFixed(1));
  }

  // 5. ฝ่ายซ่อมบำรุง (d-maintenance)
  const maintPmSubs = submissions.filter(s => s.formTemplateId === "tmpl-maint-pm");
  if (maintPmSubs.length > 0) {
    let totalUtil = 0;
    let totalBreakdown = 0;
    maintPmSubs.forEach(s => {
      totalUtil += (findAnswer(s, "utilizationPercent") || 45);
      totalBreakdown += (findAnswer(s, "breakdownMinutes") || 120);
    });
    dynamicKPIs["d-maintenance"].utilize = Number((totalUtil / maintPmSubs.length).toFixed(1));
    dynamicKPIs["d-maintenance"].breakdown = totalBreakdown;
  }

  const maintSlaSubs = submissions.filter(s => s.formTemplateId === "tmpl-maint-sla");
  if (maintSlaSubs.length > 0) {
    let metSla = 0;
    maintSlaSubs.forEach(s => {
      const met = findAnswerStr(s, "slaMet");
      if (met === "yes" || met === "ปกติ/ใช่") metSla++;
    });
    dynamicKPIs["d-maintenance"].sla = Number(((metSla / maintSlaSubs.length) * 100).toFixed(1));
  }

  // 6. ฝ่าย รปภ. เฉพาะกิจ (d-specsec)
  const specsecEmergencySubs = submissions.filter(s => s.formTemplateId === "tmpl-specsec-emergency");
  if (specsecEmergencySubs.length > 0) {
    let totalIncidents = 0;
    specsecEmergencySubs.forEach(s => {
      totalIncidents += (findAnswer(s, "emergencyIncidents") || 2);
    });
    dynamicKPIs["d-specsec"].incidents = totalIncidents;
  }

  const specsecDrugsSubs = submissions.filter(s => s.formTemplateId === "tmpl-specsec-drugs");
  if (specsecDrugsSubs.length > 0) {
    let totalPositives = 0;
    specsecDrugsSubs.forEach(s => {
      totalPositives += (findAnswer(s, "positiveDrugCount") || 2);
    });
    dynamicKPIs["d-specsec"].drugs = totalPositives;
  }

  // 7. ฝ่ายห้องเย็น (d-cold)
  const coldSatisfactionSubs = submissions.filter(s => s.formTemplateId === "tmpl-cold-satisfaction");
  if (coldSatisfactionSubs.length > 0) {
    let totalRating = 0;
    let totalDeposit = 0;
    coldSatisfactionSubs.forEach(s => {
      totalRating += (findAnswer(s, "satisfactionScore") || 4.8);
      totalDeposit += (findAnswer(s, "depositRatePercent") || 85);
    });
    dynamicKPIs["d-cold"].satisfaction = Number((totalRating / coldSatisfactionSubs.length).toFixed(1));
    dynamicKPIs["d-cold"].deposit = Number((totalDeposit / coldSatisfactionSubs.length).toFixed(1));
  }

  const coldPowerSubs = submissions.filter(s => s.formTemplateId === "tmpl-cold-power");
  if (coldPowerSubs.length > 0) {
    let totalPower = 0;
    coldPowerSubs.forEach(s => {
      totalPower += (findAnswer(s, "powerKwh") || 1.45);
    });
    dynamicKPIs["d-cold"].power = Number((totalPower / coldPowerSubs.length).toFixed(2));
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
    if (data.submissions[idx].formTemplateId === "tmpl-space-toxin") {
      // สลับค่าเป็น 0 รายการเพื่อแสดงการแก้ไขสำเร็จ
      const ansIdx = answers.findIndex(a => a.questionId === "unsafeSamplesCount");
      if (ansIdx !== -1) answers[ansIdx].value = 0;
    } else if (data.submissions[idx].formTemplateId === "tmpl-specsec-drugs") {
      const ansIdx = answers.findIndex(a => a.questionId === "positiveDrugCount");
      if (ansIdx !== -1) answers[ansIdx].value = 0;
    } else if (data.submissions[idx].formTemplateId === "tmpl-specsec-emergency") {
      const ansIdx = answers.findIndex(a => a.questionId === "emergencyIncidents");
      if (ansIdx !== -1) answers[ansIdx].value = 0;
    } else if (data.submissions[idx].formTemplateId === "tmpl-sec-parking") {
      // แก้ไขว่าทำการล็อกล้อเรียบร้อยแล้ว
      const ansIdx = answers.findIndex(a => a.questionId === "lockAction");
      if (ansIdx !== -1) answers[ansIdx].value = "yes";
    } else if (data.submissions[idx].formTemplateId === "tmpl-cold-power") {
      // ปรับค่าไฟลงตามขอบเขตประหยัดพลังงาน
      const ansIdx = answers.findIndex(a => a.questionId === "powerKwh");
      if (ansIdx !== -1) answers[ansIdx].value = 1.10;
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
