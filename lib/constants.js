export const ZONES = [
  "โซน A - ผักผลไม้",
  "โซน B - เนื้อสัตว์",
  "โซน C - อาหารทะเล",
  "โซน D - ของแห้ง/เครื่องปรุง",
  "โซน E - อาหารสำเร็จรูป",
  "ลานจอดรถ/ทางเข้า",
];

export const DEPARTMENTS = [
  { id: "d-space", name: "ฝ่ายจัดพื้นที่ & สารพิษ", colorTag: "green", icon: "🏬" },
  { id: "d-clean", name: "ฝ่ายรักษาความสะอาด", colorTag: "teal", icon: "🧹" },
  { id: "d-security", name: "ฝ่ายความปลอดภัย", colorTag: "navy", icon: "🛡️" },
  { id: "d-labor", name: "ฝ่ายแรงงาน", colorTag: "gold", icon: "👥" },
  { id: "d-maintenance", name: "ฝ่ายซ่อมบำรุง", colorTag: "red", icon: "🔧" },
  { id: "d-specsec", name: "ฝ่าย รปภ. เฉพาะกิจ", colorTag: "purple", icon: "🚨" },
  { id: "d-cold", name: "ฝ่ายห้องเย็น", colorTag: "blue", icon: "❄️" },
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
