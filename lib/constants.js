export const ZONES = [
  "โซน A - ผักผลไม้",
  "โซน B - เนื้อสัตว์",
  "โซน C - อาหารทะเล",
  "โซน D - ของแห้ง/เครื่องปรุง",
  "โซน E - อาหารสำเร็จรูป",
  "ลานจอดรถ/ทางเข้า",
];

export const DEPARTMENTS = [
  { id: "d-clean", name: "ฝ่ายรักษาความสะอาด", colorTag: "teal", icon: "🧹" },
  { id: "d-security", name: "ฝ่ายความปลอดภัย", colorTag: "navy", icon: "🛡️" },
  { id: "d-maintenance", name: "ฝ่ายซ่อมบำรุง", colorTag: "red", icon: "🔧" },
];

// ── WORK PROCESS MASTER DATA ─────────────────────────────────────────────────
export const WORK_PROCESSES = [
  { id: "wp-waste",    departmentId: "d-clean",       name: "Waste Management",        icon: "🗑️",  description: "การจัดการขยะและสุขาภิบาลพื้นที่ตลาด" },
  { id: "wp-cleaning", departmentId: "d-clean",       name: "Public Area Cleaning",    icon: "🧽",  description: "การทำความสะอาดพื้นที่สาธารณะและโครงสร้างพื้นฐาน" },
  { id: "wp-traffic",  departmentId: "d-security",    name: "Traffic Management",      icon: "🚦",  description: "การจัดการการจราจรและระบบเข้า-ออกตลาด" },
  { id: "wp-incident", departmentId: "d-security",    name: "Incident Management",     icon: "🚨",  description: "การจัดการเหตุการณ์ฉุกเฉินและความปลอดภัยบุคคล" },
  { id: "wp-pm",       departmentId: "d-maintenance", name: "Preventive Maintenance",  icon: "🔩",  description: "การบำรุงรักษาเชิงป้องกันตามแผนประจำงวด" },
  { id: "wp-cm",       departmentId: "d-maintenance", name: "Corrective Maintenance",  icon: "🛠️", description: "การซ่อมแซมแก้ไขอุปกรณ์และโครงสร้างพื้นฐาน" },
];

// ── ACTIVITY MASTER DATA ─────────────────────────────────────────────────────
// kpiId = null means no KPI triggered (checklist-only with Completion Rate)
export const ACTIVITIES = [
  // ─── Waste Management ────────────────────────────────────────────────────
  {
    id: "act-bin-check", workProcessId: "wp-waste", name: "ตรวจถังขยะ",
    kpiId: "kpi-clean-waste", kpiLabel: "ระดับขยะในถัง (%)", kpiUnit: "%", kpiMax: 100,
    kpiPlaceholder: "เช่น 85 (ขยะ 85% ของความจุ)",
    kpiWarning: 80, kpiCritical: 90,
    checklist: ["ถังไม่มีกลิ่นเหม็น", "ไม่มีขยะตกหล่นภายนอก", "ฝาปิดสนิท", "ระดับขยะไม่เกินความจุ", "ถังอยู่ในตำแหน่งที่กำหนด"],
  },
  {
    id: "act-zone-check", workProcessId: "wp-waste", name: "ตรวจจุดทิ้งขยะ",
    kpiId: null,
    checklist: ["จุดทิ้งสะอาดไม่มีขยะสะสม", "ป้ายแยกประเภทขยะชัดเจน", "ไม่มีขยะนอกจุดที่กำหนด", "ไม่มีกลิ่นรบกวน"],
  },
  {
    id: "act-truck-check", workProcessId: "wp-waste", name: "ตรวจรถเก็บขยะ",
    kpiId: null,
    checklist: ["รถพร้อมใช้งาน ไม่มีความเสียหาย", "ถังล้อรถสะอาด ไม่มีรั่วซึม", "ขับตามเส้นทางที่กำหนด", "เจ้าหน้าที่ประจำรถครบ"],
  },
  // ─── Public Area Cleaning ────────────────────────────────────────────────
  {
    id: "act-floor", workProcessId: "wp-cleaning", name: "ตรวจพื้นตลาด",
    kpiId: null,
    checklist: ["พื้นแห้ง ไม่ลื่น", "ไม่มีน้ำขังในทางเดิน", "ทางเดินโล่งไม่มีสิ่งกีดขวาง", "ไม่มีคราบน้ำมันหรือสิ่งสกปรก"],
  },
  {
    id: "act-toilet", workProcessId: "wp-cleaning", name: "ตรวจห้องน้ำ",
    kpiId: null,
    checklist: ["ห้องน้ำสะอาด ไม่มีกลิ่น", "น้ำไหลปกติทุกก๊อก", "กระดาษชำระเพียงพอ", "สบู่/แอลกอฮอล์เพียงพอ", "ไฟสว่างทุกดวง"],
  },
  {
    id: "act-walkway", workProcessId: "wp-cleaning", name: "ตรวจทางเดิน",
    kpiId: null,
    checklist: ["ทางเดินโล่ง ไม่มีสิ่งกีดขวาง", "แสงสว่างเพียงพอตลอดทาง", "ป้ายบอกทางชัดเจน", "ไม่มีสิ่งกีดขวางฉุกเฉิน"],
  },
  // ─── Traffic Management ──────────────────────────────────────────────────
  {
    id: "act-traffic", workProcessId: "wp-traffic", name: "ตรวจการจราจร",
    kpiId: "kpi-security-traffic", kpiLabel: "เวลารอผ่านประตู (นาที)", kpiUnit: "นาที", kpiMax: 60,
    kpiPlaceholder: "เช่น 12 (รอ 12 นาที)",
    kpiWarning: 15, kpiCritical: 30,
    checklist: ["Gate ทุกช่องเปิดบริการ", "เจ้าหน้าที่ประจำด่านครบ", "กล้อง LPR ทำงานปกติ", "ไม่มีรถจอดขวางทางหลัก"],
  },
  {
    id: "act-truck-park", workProcessId: "wp-traffic", name: "ตรวจรถคอก",
    kpiId: null,
    checklist: ["รถจอดถูกช่องที่กำหนด", "ไม่มีรถขวางทางสัญจร", "พื้นที่ขนถ่ายโล่งเพียงพอ", "ป้ายหมายเลขช่องชัดเจน"],
  },
  {
    id: "act-parking", workProcessId: "wp-traffic", name: "ตรวจลานจอด",
    kpiId: null,
    checklist: ["ลานจอดสะอาด ไม่มีน้ำขัง", "เส้นจราจรสีชัดเจน", "ป้ายบอกทิศทางครบ", "ไฟส่องสว่างลานจอดทำงาน"],
  },
  // ─── Incident Management ─────────────────────────────────────────────────
  {
    id: "act-fight", workProcessId: "wp-incident", name: "ตรวจเหตุทะเลาะวิวาท",
    kpiId: null,
    checklist: ["บันทึกข้อมูลคู่กรณีครบ", "แจ้งหัวหน้าเวรทันที", "เคลียร์พื้นที่ให้ปลอดภัย", "ตรวจสอบกล้อง CCTV"],
  },
  {
    id: "act-lost", workProcessId: "wp-incident", name: "ตรวจทรัพย์สินสูญหาย",
    kpiId: null,
    checklist: ["รับแจ้งความและบันทึก", "ตรวจกล้อง CCTV ย้อนหลัง", "แจ้งทีมรักษาความปลอดภัย", "จัดทำรายงานส่งผู้บังคับบัญชา"],
  },
  {
    id: "act-entry", workProcessId: "wp-incident", name: "ตรวจการเข้าออก",
    kpiId: null,
    checklist: ["ตรวจบัตรผ่านเข้าออก", "บันทึก Log การเข้าออก", "ไม่พบบุคคลไม่มีสิทธิ์", "ระบบสแกนบัตรทำงานปกติ"],
  },
  // ─── Preventive Maintenance ──────────────────────────────────────────────
  {
    id: "act-pump", workProcessId: "wp-pm", name: "ตรวจเครื่องสูบน้ำ",
    kpiId: "kpi-maint-temp", kpiLabel: "อุณหภูมิมอเตอร์/ปั๊ม (°C)", kpiUnit: "°C", kpiMax: 120,
    kpiPlaceholder: "เช่น 78 (อุณหภูมิ 78°C)",
    kpiWarning: 85, kpiCritical: 90,
    checklist: ["เสียงการทำงานปกติ ไม่มีเสียงผิดปกติ", "ไม่มีการสั่นสะเทือนเกินมาตรฐาน", "น้ำหล่อเย็นเพียงพอ", "ตรวจสอบค่าอุณหภูมิผ่าน SCADA"],
  },
  {
    id: "act-light", workProcessId: "wp-pm", name: "ตรวจไฟส่องสว่าง",
    kpiId: null,
    checklist: ["หลอดไฟครบทุกดวง ไม่มีดับ", "ระบบไฟฉุกเฉินทดสอบผ่าน", "ตู้ไฟไม่ร้อนผิดปกติ", "Breaker ไม่ Trip"],
  },
  {
    id: "act-wastewater", workProcessId: "wp-pm", name: "ตรวจระบบบำบัดน้ำเสีย",
    kpiId: null,
    checklist: ["ค่า pH อยู่ในช่วง 6.5–8.5", "ปั๊มระบายน้ำทำงานปกติ", "ไม่มีกลิ่นผิดปกติ", "ระดับน้ำในบ่อปกติ"],
  },
  // ─── Corrective Maintenance ──────────────────────────────────────────────
  {
    id: "act-elec", workProcessId: "wp-cm", name: "ซ่อมไฟฟ้า",
    kpiId: null,
    checklist: ["ระบุจุดที่เสียและสาเหตุ", "ปิดไฟและล็อคก่อนซ่อม (LOTO)", "ดำเนินการซ่อมตามมาตรฐาน", "ทดสอบระบบหลังซ่อมผ่าน", "บันทึกรายงานซ่อมครบ"],
  },
  {
    id: "act-water", workProcessId: "wp-cm", name: "ซ่อมประปา",
    kpiId: null,
    checklist: ["ปิดน้ำก่อนดำเนินการซ่อม", "ตรวจรอยรั่วซึมทุกจุด", "ทดสอบแรงดันน้ำหลังซ่อม", "บันทึกรายงานซ่อมครบ"],
  },
  {
    id: "act-road", workProcessId: "wp-cm", name: "ซ่อมถนน",
    kpiId: null,
    checklist: ["ติดป้ายเตือนและกั้นพื้นที่", "ดำเนินการซ่อมตามมาตรฐาน", "ตรวจความแข็งแรงหลังซ่อม", "เปิดทางจราจรหลังผ่านการตรวจ"],
  },
];

export const CATEGORIES = [
  "ความสะอาด/สุขาภิบาล",
  "ความปลอดภัย",
  "ซ่อมบำรุง/สาธารณูปโภค",
  "ร้องเรียนผู้ค้า/ลูกค้า",
  "ระเบียบ/ผังตลาด",
  "อื่นๆ",
];

export const STATUSES = [
  { value: "ปกติ", color: "var(--green)", weight: 0 },
  { value: "ต้องติดตาม", color: "var(--gold)", weight: 1 },
  { value: "เร่งด่วน", color: "var(--red)", weight: 2 },
];

export const STAFF_NAMES = [
  "สมชาย ใจดี",
  "วิภา ตั้งมั่น",
  "ประยุทธ สายบุญ",
  "อรทัย เพชรรัตน์",
];

export function statusMeta(value) {
  return STATUSES.find((s) => s.value === value) || STATUSES[0];
}
