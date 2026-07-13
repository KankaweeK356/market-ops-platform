// lib/storage.js
//
// เก็บข้อมูลแบบลำดับชั้น (Department -> WorkPackage -> Activity -> FormTemplate)
// และรายการ FormSubmission ผ่าน localStorage ของเบราว์เซอร์
//
// โครงสร้างฟังก์ชันช่วยให้สามารถเปลี่ยนไปใช้ฐานข้อมูลกลาง (Postgres/Supabase) ในภายหลังได้ทันที

import { DEPARTMENTS, STAFF_NAMES, ZONES } from "./constants";

const KEY = "market_ops_system_data_v2";

const SEED_WPS = [
  { id: "wp-clean-1", departmentId: "d-clean", name: "ทำความสะอาดพื้นที่ส่วนกลาง", description: "งานทำความสะอาดทางเดิน ห้องน้ำ และโซนตลาดทั้งหมด", frequency: "daily" },
  { id: "wp-clean-2", departmentId: "d-clean", name: "จัดการขยะ", description: "งานคัดแยก ขนย้าย และกำจัดขยะประจำวัน", frequency: "daily" },
  { id: "wp-security-1", departmentId: "d-security", name: "ตรวจสภาพยานพาหนะ", description: "ตรวจสอบยานพาหนะตรวจการณ์ก่อนออกปฏิบัติงาน", frequency: "daily" },
  { id: "wp-security-2", departmentId: "d-security", name: "ตรวจกล้องวงจรปิด", description: "ตรวจสอบกล้อง CCTV และสถานะระบบบันทึกภาพ", frequency: "weekly" },
  { id: "wp-labor-1", departmentId: "d-labor", name: "ตรวจสอบกำลังคน", description: "เช็คชื่อการเข้าปฏิบัติงานของแรงงานในสังกัด", frequency: "daily" },
  { id: "wp-labor-2", departmentId: "d-labor", name: "ตรวจความปลอดภัยแรงงาน (PPE)", description: "ตรวจเช็คอุปกรณ์ป้องกันภัยส่วนบุคคลของผู้ปฏิบัติงาน", frequency: "daily" },
];

const SEED_ACTIVITIES = [
  { id: "act-clean-1-1", workPackageId: "wp-clean-1", name: "ตรวจความสะอาดห้องน้ำ (รอบเช้า/บ่าย)", description: "การตรวจเช็คสภาพห้องน้ำสาธารณะในแต่ละโซน" },
  { id: "act-clean-2-1", workPackageId: "wp-clean-2", name: "เก็บขยะประจำวันตามโซน", description: "ตรวจเช็คการจัดเก็บขยะและการทำความสะอาดถังขยะ" },
  { id: "act-security-1-1", workPackageId: "wp-security-1", name: "ตรวจสภาพรถตรวจการณ์ก่อนออกปฏิบัติงาน", description: "เช็คลิสต์ตรวจความพร้อมของรถสายตรวจ" },
  { id: "act-security-2-1", workPackageId: "wp-security-2", name: "ตรวจสอบสถานะกล้อง CCTV รายจุด", description: "เช็คความพร้อมการออนไลน์ของระบบกล้องวงจรปิด" },
  { id: "act-labor-1-1", workPackageId: "wp-labor-1", name: "เช็คชื่อเข้างานประจำวัน", description: "ลงชื่อบันทึกการทำงานของพนักงานรายวัน" },
  { id: "act-labor-2-1", workPackageId: "wp-labor-2", name: "ตรวจการสวมใส่อุปกรณ์ป้องกัน", description: "ตรวจสอบสวมใส่อุปกรณ์หมวกนิรภัย เสื้อกั๊ก ถุงมือ และรองเท้า" },
];

const SEED_TEMPLATES = [
  {
    id: "tmpl-clean-1-1",
    activityId: "act-clean-1-1",
    questions: [
      { id: "q-c1", label: "กระดาษชำระพร้อมใช้", type: "yes_no", required: true },
      { id: "q-c2", label: "พื้นแห้งไม่ลื่น", type: "yes_no", required: true },
      { id: "q-c3", label: "ถังขยะไม่ล้น", type: "yes_no", required: true },
      { id: "q-c4", label: "มีกลิ่นไม่พึงประสงค์", type: "yes_no", required: true, flagIf: { value: "yes", setStatus: "ต้องติดตาม" } },
      { id: "q-c5", label: "ภาพถ่ายสภาพห้องน้ำ", type: "photo", required: false },
      { id: "q-c6", label: "หมายเหตุ / จุดที่ต้องปรับปรุง", type: "text", required: false }
    ]
  },
  {
    id: "tmpl-clean-2-1",
    activityId: "act-clean-2-1",
    questions: [
      { id: "q-c2-1", label: "ถังขยะทุกจุดทำความสะอาดและใส่ถุงดำใหม่", type: "yes_no", required: true },
      { id: "q-c2-2", label: "ปริมาณขยะคัดแยกโดยประมาณ (กิโลกรัม)", type: "number", required: true },
      { id: "q-c2-3", label: "ภาพถ่ายลานขยะ/ถังขยะ", type: "photo", required: false },
      { id: "q-c2-4", label: "หมายเหตุ / รายงานปัญหาขยะตกค้าง", type: "text", required: false }
    ]
  },
  {
    id: "tmpl-security-1-1",
    activityId: "act-security-1-1",
    questions: [
      {
        id: "q-s1",
        label: "รายการตรวจเช็คสภาพรถ (ผ่านเกณฑ์)",
        type: "checkbox_group",
        options: ["ยางรถ", "ไฟหน้า-ไฟท้าย", "เบรก", "น้ำมันเครื่อง", "กระจกมองข้าง", "สัญญาณไฟฉุกเฉิน", "แตร"],
        required: true,
        flagIf: { value: "incomplete", setStatus: "เร่งด่วน" }
      },
      { id: "q-s2", label: "ภาพถ่ายรอบรถยนต์สายตรวจ", type: "photo", required: false },
      { id: "q-s3", label: "หมายเหตุการตรวจสภาพ / รายการที่ชำรุด", type: "text", required: false }
    ]
  },
  {
    id: "tmpl-security-2-1",
    activityId: "act-security-2-1",
    questions: [
      { id: "q-s2-1", label: "สถานะกล้องโซน A-C ทั้งหมดออนไลน์", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "ต้องติดตาม" } },
      { id: "q-s2-2", label: "เครื่องบันทึกภาพ NVR ทำงานปกติ", type: "yes_no", required: true, flagIf: { value: "no", setStatus: "เร่งด่วน" } },
      { id: "q-s2-3", label: "ภาพถ่ายหน้าจอมอนิเตอร์ CCTV", type: "photo", required: false },
      { id: "q-s2-4", label: "ระบุเลขกล้องที่หน้าจอดับ/ขัดข้อง", type: "text", required: false }
    ]
  },
  {
    id: "tmpl-labor-1-1",
    activityId: "act-labor-1-1",
    questions: [
      { id: "q-l1", label: "จำนวนผู้มาปฏิบัติงานปกติ (คน)", type: "number", required: true },
      { id: "q-l2", label: "จำนวนผู้ขาดงาน/ลางาน (คน)", type: "number", required: true, flagIf: { value: "not_zero", setStatus: "ต้องติดตาม" } },
      { id: "q-l3", label: "รายชื่อผู้ลากิจ/ลาป่วย/ขาดงาน", type: "text", required: false },
      { id: "q-l4", label: "ลงลายมือชื่อผู้เช็คชื่อ", type: "signature", required: true }
    ]
  },
  {
    id: "tmpl-labor-2-1",
    activityId: "act-labor-2-1",
    questions: [
      {
        id: "q-l2-1",
        label: "การสวมใส่อุปกรณ์ PPE (สวมใส่ครบถ้วน)",
        type: "checkbox_group",
        options: ["หมวกนิรภัย", "เสื้อสะท้อนแสง", "ถุงมือ", "รองเท้านิรภัย"],
        required: true,
        flagIf: { value: "incomplete", setStatus: "เร่งด่วน" }
      },
      { id: "q-l2-2", label: "ภาพถ่ายหน้างานขณะปฏิบัติงาน", type: "photo", required: true },
      { id: "q-l2-3", label: "หมายเหตุข้อตักเตือนพนักงาน (ถ้ามี)", type: "text", required: false }
    ]
  }
];

function generateSeedSubmissions() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  return [
    {
      id: "sub-1",
      formTemplateId: "tmpl-clean-1-1",
      activityId: "act-clean-1-1",
      workPackageId: "wp-clean-1",
      departmentId: "d-clean",
      submittedBy: STAFF_NAMES[0],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[0],
      answers: [
        { questionId: "q-c1", label: "กระดาษชำระพร้อมใช้", value: "yes" },
        { questionId: "q-c2", label: "พื้นแห้งไม่ลื่น", value: "yes" },
        { questionId: "q-c3", label: "ถังขยะไม่ล้น", value: "yes" },
        { questionId: "q-c4", label: "มีกลิ่นไม่พึงประสงค์", value: "no" },
        { questionId: "q-c5", label: "ภาพถ่ายสภาพห้องน้ำ", value: "" },
        { questionId: "q-c6", label: "หมายเหตุ / จุดที่ต้องปรับปรุง", value: "ตรวจรอบเช้า สะอาดเรียบร้อยดีมาก" }
      ],
      derivedStatus: "ปกติ",
      createdAt: now - 1 * day
    },
    {
      id: "sub-2",
      formTemplateId: "tmpl-clean-1-1",
      activityId: "act-clean-1-1",
      workPackageId: "wp-clean-1",
      departmentId: "d-clean",
      submittedBy: STAFF_NAMES[1],
      submittedAt: new Date(now - 2 * day).toISOString(),
      date: new Date(now - 2 * day).toISOString().slice(0, 10),
      zone: ZONES[1],
      answers: [
        { questionId: "q-c1", label: "กระดาษชำระพร้อมใช้", value: "yes" },
        { questionId: "q-c2", label: "พื้นแห้งไม่ลื่น", value: "yes" },
        { questionId: "q-c3", label: "ถังขยะไม่ล้น", value: "yes" },
        { questionId: "q-c4", label: "มีกลิ่นไม่พึงประสงค์", value: "yes" },
        { questionId: "q-c5", label: "ภาพถ่ายสภาพห้องน้ำ", value: "" },
        { questionId: "q-c6", label: "หมายเหตุ / จุดที่ต้องปรับปรุง", value: "พบกลิ่นเหม็นจากท่อระบายน้ำล้น แจ้งฝ่ายซ่อมบำรุงแล้วรอดำเนินการ" }
      ],
      derivedStatus: "ต้องติดตาม",
      createdAt: now - 2 * day
    },
    {
      id: "sub-3",
      formTemplateId: "tmpl-security-1-1",
      activityId: "act-security-1-1",
      workPackageId: "wp-security-1",
      departmentId: "d-security",
      submittedBy: STAFF_NAMES[2],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[5],
      answers: [
        { questionId: "q-s1", label: "รายการตรวจเช็คสภาพรถ (ผ่านเกณฑ์)", value: ["ยางรถ", "ไฟหน้า-ไฟท้าย", "เบรก", "น้ำมันเครื่อง", "กระจกมองข้าง", "สัญญาณไฟฉุกเฉิน", "แตร"] },
        { questionId: "q-s2", label: "ภาพถ่ายรอบรถยนต์สายตรวจ", value: "" },
        { questionId: "q-s3", label: "หมายเหตุการตรวจสภาพ / รายการที่ชำรุด", value: "รถเบอร์ 4 ตรวจครบถ้วนพร้อมออกตรวจการณ์" }
      ],
      derivedStatus: "ปกติ",
      createdAt: now - 1 * day
    },
    {
      id: "sub-4",
      formTemplateId: "tmpl-security-1-1",
      activityId: "act-security-1-1",
      workPackageId: "wp-security-1",
      departmentId: "d-security",
      submittedBy: STAFF_NAMES[3],
      submittedAt: new Date(now - 2 * day).toISOString(),
      date: new Date(now - 2 * day).toISOString().slice(0, 10),
      zone: ZONES[5],
      answers: [
        { questionId: "q-s1", label: "รายการตรวจเช็คสภาพรถ (ผ่านเกณฑ์)", value: ["ยางรถ", "เบรก", "น้ำมันเครื่อง", "กระจกมองข้าง", "แตร"] },
        { questionId: "q-s2", label: "ภาพถ่ายรอบรถยนต์สายตรวจ", value: "" },
        { questionId: "q-s3", label: "หมายเหตุการตรวจสภาพ / รายการที่ชำรุด", value: "ไฟหน้าข้างขวาและสัญญาณไฟฉุกเฉินไม่ติด ต้องนำเข้าอู่ซ่อมด่วน" }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 2 * day
    },
    {
      id: "sub-5",
      formTemplateId: "tmpl-labor-2-1",
      activityId: "act-labor-2-1",
      workPackageId: "wp-labor-2",
      departmentId: "d-labor",
      submittedBy: STAFF_NAMES[0],
      submittedAt: new Date(now - 1 * day).toISOString(),
      date: new Date(now - 1 * day).toISOString().slice(0, 10),
      zone: ZONES[2],
      answers: [
        { questionId: "q-l2-1", label: "การสวมใส่อุปกรณ์ PPE (สวมใส่ครบถ้วน)", value: ["หมวกนิรภัย", "เสื้อสะท้อนแสง", "ถุงมือ", "รองเท้านิรภัย"] },
        { questionId: "q-l2-2", label: "ภาพถ่ายหน้างานขณะปฏิบัติงาน", value: "mock_image_url" },
        { questionId: "q-l2-3", label: "หมายเหตุข้อตักเตือนพนักงาน (ถ้ามี)", value: "คนงานหน้างานสวมใส่ครบถ้วนเรียบร้อยดี" }
      ],
      derivedStatus: "ปกติ",
      createdAt: now - 1 * day
    },
    {
      id: "sub-6",
      formTemplateId: "tmpl-labor-2-1",
      activityId: "act-labor-2-1",
      workPackageId: "wp-labor-2",
      departmentId: "d-labor",
      submittedBy: STAFF_NAMES[1],
      submittedAt: new Date(now - 3 * day).toISOString(),
      date: new Date(now - 3 * day).toISOString().slice(0, 10),
      zone: ZONES[2],
      answers: [
        { questionId: "q-l2-1", label: "การสวมใส่อุปกรณ์ PPE (สวมใส่ครบถ้วน)", value: ["หมวกนิรภัย", "เสื้อสะท้อนแสง"] },
        { questionId: "q-l2-2", label: "ภาพถ่ายหน้างานขณะปฏิบัติงาน", value: "mock_image_url" },
        { questionId: "q-l2-3", label: "หมายเหตุข้อตักเตือนพนักงาน (ถ้ามี)", value: "พบแรงงาน 2 รายไม่ได้สวมถุงมือและรองเท้านิรภัย ได้เตือนและสั่งให้เปลี่ยนรองเท้าทันที" }
      ],
      derivedStatus: "เร่งด่วน",
      createdAt: now - 3 * day
    }
  ];
}

// โหลดข้อมูลหลักของระบบ
function readAll() {
  if (typeof window === "undefined") return { departments: [], workPackages: [], activities: [], formTemplates: [], submissions: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const initialData = {
        departments: DEPARTMENTS,
        workPackages: SEED_WPS,
        activities: SEED_ACTIVITIES,
        formTemplates: SEED_TEMPLATES,
        submissions: generateSeedSubmissions()
      };
      window.localStorage.setItem(KEY, JSON.stringify(initialData));
      return initialData;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Local storage read error, returning empty dataset:", e);
    return { departments: [], workPackages: [], activities: [], formTemplates: [], submissions: [] };
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
  // ลบ WP และกิจกรรมย่อยเพื่อไม่ให้กำพร้า
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
        } else {
          isFlagged = numVal === Number(triggerVal);
        }
      } else if (q.type === "checkbox_group") {
        // หากติ๊กไม่ครบตามจำนวนตัวเลือก (ติ๊กเฉพาะที่ผ่าน รายการไหนไม่ติ๊ก = ไม่ผ่าน)
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
    submissions: generateSeedSubmissions()
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
