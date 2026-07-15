import { useEffect, useState, useMemo } from "react";
import Layout from "../components/Layout";
import DecisionCard from "../components/DecisionCard";
import { getReports, computeStats, getExecutiveData, getExecutiveDecisions, logExecutiveDecision, clearExecutiveDecisions } from "../lib/storage";
import { DEPARTMENTS } from "../lib/constants";

export default function Executive() {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [execData, setExecData] = useState(null);
  const [loggedDecisions, setLoggedDecisions] = useState([]);

  // เลือกฝ่ายงานเพื่อวิเคราะห์เจาะลึก (ค่าเริ่มต้นเป็นฝ่ายจัดพื้นที่ & สารพิษ)
  const [activeDeptId, setActiveDeptId] = useState("d-space");

  // Case 5 Weekly Briefing State
  const [briefingResult, setBriefingResult] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState("");

  // Case 6 Conversational Copilot State
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotMessages, setCopilotMessages] = useState([]);
  const [copilotLoading, setCopilotLoading] = useState(false);

  // Workflow states (GAP 4 - Closed-loop workflow status)
  const [workflowStatus, setWorkflowStatus] = useState({}); // { caseId: 'ordered' | 'completed' }

  // PDF Export Modal State (GAP 5)
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  // เมื่อเปลี่ยนฝ่าย ให้รีเซ็ตประวัติแชท Copilot และผลลัพธ์ Briefing เพื่อความถูกต้องเฉพาะฝ่าย
  useEffect(() => {
    setBriefingResult(null);
    setBriefingError("");
    setCopilotMessages([]);
  }, [activeDeptId]);

  function loadAllData() {
    const r = getReports();
    setReports(r);
    setStats(computeStats(r));
    const data = getExecutiveData();
    setExecData(data);
    setLoggedDecisions(getExecutiveDecisions());
  }

  // เลื่อนไปที่เคสการตัดสินใจ
  function handleScrollToCase(caseNum) {
    const el = document.getElementById(`case-${caseNum}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.backgroundColor = "var(--gold-soft)";
      setTimeout(() => {
        el.style.backgroundColor = "var(--paper-raised)";
      }, 1000);
    }
  }

  // กดเลือกคำตอบตัดสินใจบนการ์ด
  function handleMakeDecision(caseId, decisionText) {
    const record = logExecutiveDecision(caseId, decisionText);
    setLoggedDecisions(prev => [...prev, record]);
    
    // ตั้งค่าสถานะเวิร์กโฟลว์ว่า "สั่งการแล้ว"
    setWorkflowStatus(prev => ({
      ...prev,
      [caseId]: "ordered"
    }));

    // จำลองการอัปเดตสถานะงานหลังจากปฏิบัติการตอบกลับ (4 วินาที)
    setTimeout(() => {
      setWorkflowStatus(prev => ({
        ...prev,
        [caseId]: "completed"
      }));
    }, 4000);
  }

  // ล้างประวัติการตัดสินใจเพื่อเริ่มรันใหม่
  function handleClearDecisions() {
    if (confirm("ต้องการเคลียร์ประวัติการตัดสินใจทั้งหมดเพื่อเริ่มต้นเดโมใหม่ใช่หรือไม่?")) {
      clearExecutiveDecisions();
      setLoggedDecisions([]);
      setWorkflowStatus({});
    }
  }

  // เรียกใช้สรุปข้อมูล Generative AI ประจำสัปดาห์เฉพาะฝ่าย
  async function runWeeklyBriefing() {
    setBriefingLoading(true);
    setBriefingError("");
    setBriefingResult(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports, stats, departmentId: activeDeptId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBriefingError(data.error || "เกิดข้อผิดพลาด");
      } else {
        setBriefingResult(data);
      }
    } catch (e) {
      setBriefingError(e.message);
    } finally {
      setBriefingLoading(false);
    }
  }

  // ส่งคำถามในช่องแชทส่วนตัวของผู้บริหาร (Copilot)
  async function handleSendCopilotQuery(customText = "") {
    const queryToSend = customText || copilotQuery;
    if (!queryToSend.trim()) return;

    const userMsg = { role: "user", text: queryToSend };
    setCopilotMessages(prev => [...prev, userMsg]);
    if (!customText) setCopilotQuery("");

    setCopilotLoading(true);
    try {
      const contextData = {
        stats,
        fuelLogs: execData?.fuelLogs,
        binWashLogs: execData?.binWashLogs,
        migrantWorkers: execData?.migrantWorkers,
        maintBreakdowns: execData?.maintBreakdowns,
        slaRequests: execData?.slaRequests,
        recentSubmissions: reports.filter(r => r.departmentId === activeDeptId).slice(0, 10)
      };

      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: queryToSend, 
          context: contextData,
          departmentId: activeDeptId
        }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        setCopilotMessages(prev => [
          ...prev, 
          { role: "assistant", text: `เกิดข้อผิดพลาด: ${data.error || "ไม่สามารถประมวลผลคำตอบได้"}` }
        ]);
      } else {
        setCopilotMessages(prev => [
          ...prev, 
          { 
            role: "assistant", 
            text: data.answer,
            hasDecision: data.hasDecision,
            suggestedDecisions: data.suggestedDecisions 
          }
        ]);
      }
    } catch (e) {
      setCopilotMessages(prev => [
        ...prev, 
        { role: "assistant", text: `ระบบขัดข้อง: ${e.message}` }
      ]);
    } finally {
      setCopilotLoading(false);
      setTimeout(() => {
        const chatBox = document.getElementById("copilot-chat-box");
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      }, 100);
    }
  }

  const getDecisionForCase = (caseId) => {
    return loggedDecisions.find(d => d.caseId === caseId);
  };

  // แถบเป้าหมายตัวชี้วัด KPI รายฝ่ายงาน ปรับแก้ตามคำสั่งตลาดสี่มุมเมืองล่าสุด (คำนวณแบบไดนามิกจากข้อมูลรายงาน)
  const kpiMetrics = useMemo(() => {
    if (!stats || !stats.dynamicKPIs) return [];
    const dk = stats.dynamicKPIs;
    if (activeDeptId === "d-space") {
      const occVal = dk["d-space"].occupancy;
      const safeVal = dk["d-space"].safety;
      const routVal = dk["d-space"].routing;
      return [
        { label: "อัตราเช่าแผงค้ารวมทุกโซน (Stall Occupancy)", target: ">= 90%", current: `${occVal}%`, status: occVal >= 90 ? "pass" : "alert" },
        { label: "สัดส่วนตรวจสารเคมีแล้วปลอดภัย", target: "100%", current: `${safeVal}%`, status: safeVal === 100 ? "pass" : safeVal >= 95 ? "warning" : "alert" },
        { label: "เวลาจัดจอดรถในอาคารรถผัก (3 รอบหลัก)", target: "< 30 นาที", current: `${routVal} นาที`, status: routVal < 30 ? "pass" : "warning" }
      ];
    } else if (activeDeptId === "d-clean") {
      const overVal = dk["d-clean"].overflow;
      const codVal = dk["d-clean"].cod;
      const slaVal = dk["d-clean"].sla;
      return [
        { label: "ระดับขยะล้นถัง (Organic Waste Overflow)", target: "< 80%", current: `${overVal}%`, status: overVal < 80 ? "pass" : overVal < 90 ? "warning" : "alert" },
        { label: "คุณภาพน้ำทิ้งบ่อบำบัด COD", target: "< 120 mg/L", current: `${codVal} mg/L`, status: codVal < 120 ? "pass" : "alert" },
        { label: "เคลียร์ข้อร้องเรียนจุดสกปรกตาม SLA", target: "> 95%", current: `${slaVal}%`, status: slaVal >= 95 ? "pass" : slaVal >= 90 ? "warning" : "alert" }
      ];
    } else if (activeDeptId === "d-security") {
      const trafVal = dk["d-security"].traffic;
      const routVal = dk["d-security"].routing;
      const illVal = dk["d-security"].illegal;
      return [
        { label: "เวลาเคลียร์การจราจรติดขัด", target: "< 5 นาที", current: `${trafVal} นาที`, status: trafVal < 5 ? "pass" : "alert" },
        { label: "จัดระเบียบรถเข้าอาคารลานผัก", target: "<= 40 นาที/รอบ", current: `${routVal} นาที`, status: routVal <= 40 ? "pass" : "warning" },
        { label: "การจัดการแอบลักลอบจอดรถ", target: "สูงสุด (เป้า > 95%)", current: `${illVal}%`, status: illVal >= 95 ? "pass" : "warning" }
      ];
    } else if (activeDeptId === "d-labor") {
      const waitVal = dk["d-labor"].wait;
      const slaVal = dk["d-labor"].sla;
      const forkVal = dk["d-labor"].forklift;
      return [
        { label: "ลูกค้ารอคอยลงของนานสุด", target: "< 10 นาที", current: `${waitVal} นาที`, status: waitVal < 10 ? "pass" : "alert" },
        { label: "เวลาลงสินค้าสำเร็จตาม SLA", target: "> 90%", current: `${slaVal}%`, status: slaVal >= 90 ? "pass" : "warning" },
        { label: "การใช้งาน Forklift & ตรวจ PM", target: ">= 80%", current: `${forkVal}%`, status: forkVal >= 80 ? "pass" : "warning" }
      ];
    } else if (activeDeptId === "d-maintenance") {
      const utiVal = dk["d-maintenance"].utilize;
      const breVal = dk["d-maintenance"].breakdown;
      const slaVal = dk["d-maintenance"].sla;
      return [
        { label: "การใช้เครื่องจักร (Utilization)", target: "> 80%", current: `${utiVal}%`, status: utiVal >= 80 ? "pass" : "alert" },
        { label: "เครื่องจักรชำรุดสะสม (Breakdown)", target: "0 นาที", current: `${breVal} นาที`, status: breVal === 0 ? "pass" : "alert" },
        { label: "ความเร็วงานซ่อมตาม SLA Met", target: "> 95%", current: `${slaVal}%`, status: slaVal >= 95 ? "pass" : "warning" }
      ];
    } else if (activeDeptId === "d-specsec") {
      const incVal = dk["d-specsec"].incidents;
      const drugVal = dk["d-specsec"].drugs;
      return [
        { label: "เหตุลักทรัพย์และทะเลาะวิวาท", target: "0 ครั้ง", current: `${incVal} ครั้ง`, status: incVal === 0 ? "pass" : "alert" },
        { label: "การสุ่มตรวจหาสารเสพติดแรงงาน", target: "พบ = 0", current: `พบสารเสพติด ${drugVal} ราย`, status: drugVal === 0 ? "pass" : "alert" }
      ];
    } else if (activeDeptId === "d-cold") {
      const satVal = dk["d-cold"].satisfaction;
      const depVal = dk["d-cold"].deposit;
      const powVal = dk["d-cold"].power;
      return [
        { label: "พึงพอใจการบริการ (Satisfaction)", target: ">= 4.5 / 5.0", current: `${satVal} / 5.0`, status: satVal >= 4.5 ? "pass" : "warning" },
        { label: "อัตราใช้ประโยชน์พื้นที่แช่เย็น", target: ">= 80%", current: `${depVal}%`, status: depVal >= 80 ? "pass" : "warning" },
        { label: "อัตราการสิ้นเปลืองกระแสไฟฟ้า", target: "<= 1.2 หน่วย/ตร.ม./วัน", current: `${powVal} หน่วย`, status: powVal <= 1.2 ? "pass" : "warning" }
      ];
    }
    return [];
  }, [activeDeptId, stats]);

  // สถิติข้อมูลแนวโน้ม 4 สัปดาห์ย้อนหลัง (สัปดาห์ปัจจุบันดึงจากข้อมูลไดนามิก)
  const historicalTrends = useMemo(() => {
    if (!stats || !stats.dynamicKPIs) return [];
    const dk = stats.dynamicKPIs;
    if (activeDeptId === "d-space") {
      const s = dk["d-space"];
      return [
        { period: "สัปดาห์ปัจจุบัน (รันไทม์)", kpi1: `${s.occupancy}%`, kpi2: `${s.safety}%`, kpi3: `${s.routing} นาที`, state: s.occupancy >= 90 && s.safety >= 95 ? "pass" : "warning" },
        { period: "สัปดาห์ก่อน", kpi1: "95.0%", kpi2: "98.0%", kpi3: "28 นาที", state: "pass" },
        { period: "2 สัปดาห์ก่อน", kpi1: "93.0%", kpi2: "100%", kpi3: "25 นาที", state: "pass" },
        { period: "3 สัปดาห์ก่อน", kpi1: "92.0%", kpi2: "100%", kpi3: "24 นาที", state: "pass" }
      ];
    } else if (activeDeptId === "d-clean") {
      const s = dk["d-clean"];
      return [
        { period: "สัปดาห์ปัจจุบัน (รันไทม์)", kpi1: `${s.overflow}%`, kpi2: `${s.cod} mg/L`, kpi3: `${s.sla}%`, state: s.overflow < 90 && s.cod < 120 ? "pass" : "alert" },
        { period: "สัปดาห์ก่อน", kpi1: "88%", kpi2: "148 mg/L", kpi3: "90%", state: "warning" },
        { period: "2 สัปดาห์ก่อน", kpi1: "82%", kpi2: "125 mg/L", kpi3: "93%", state: "warning" },
        { period: "3 สัปดาห์ก่อน", kpi1: "78%", kpi2: "115 mg/L", kpi3: "96%", state: "pass" }
      ];
    } else if (activeDeptId === "d-security") {
      const s = dk["d-security"];
      return [
        { period: "สัปดาห์ปัจจุบัน (รันไทม์)", kpi1: `${s.traffic} นาที`, kpi2: `${s.routing} นาที`, kpi3: `${s.illegal}%`, state: s.traffic < 5 ? "pass" : "alert" },
        { period: "สัปดาห์ก่อน", kpi1: "11 นาที", kpi2: "39 นาที", kpi3: "87%", state: "warning" },
        { period: "2 สัปดาห์ก่อน", kpi1: "6 นาที", kpi2: "38 นาที", kpi3: "92%", state: "warning" },
        { period: "3 สัปดาห์ก่อน", kpi1: "4 นาที", kpi2: "35 นาที", kpi3: "96%", state: "pass" }
      ];
    } else if (activeDeptId === "d-labor") {
      const s = dk["d-labor"];
      return [
        { period: "สัปดาห์ปัจจุบัน (รันไทม์)", kpi1: `${s.wait} นาที`, kpi2: `${s.sla}%`, kpi3: `${s.forklift}%`, state: s.wait < 10 && s.sla >= 90 ? "pass" : "alert" },
        { period: "สัปดาห์ก่อน", kpi1: "18 นาที", kpi2: "83%", kpi3: "62% (ขาด PM)", state: "warning" },
        { period: "2 สัปดาห์ก่อน", kpi1: "12 นาที", kpi2: "88%", kpi3: "75% (PM ครบ)", state: "warning" },
        { period: "3 สัปดาห์ก่อน", kpi1: "8 นาที", kpi2: "92%", kpi3: "85% (PM ครบ)", state: "pass" }
      ];
    } else if (activeDeptId === "d-maintenance") {
      const s = dk["d-maintenance"];
      return [
        { period: "สัปดาห์ปัจจุบัน (รันไทม์)", kpi1: `${s.utilize}%`, kpi2: `${s.breakdown} นาที`, kpi3: `${s.sla}%`, state: s.breakdown === 0 && s.sla >= 95 ? "pass" : "alert" },
        { period: "สัปดาห์ก่อน", kpi1: "62%", kpi2: "45 นาที", kpi3: "93.4%", state: "warning" },
        { period: "2 สัปดาห์ก่อน", kpi1: "78%", kpi2: "15 นาที", kpi3: "96.5%", state: "pass" },
        { period: "3 สัปดาห์ก่อน", kpi1: "82%", kpi2: "0 นาที", kpi3: "98.2%", state: "pass" }
      ];
    } else if (activeDeptId === "d-specsec") {
      const s = dk["d-specsec"];
      return [
        { period: "สัปดาห์ปัจจุบัน (รันไทม์)", kpi1: `${s.incidents} ครั้ง`, kpi2: `พบ ${s.drugs} ราย`, kpi3: "ตรวจครบ", state: s.incidents === 0 && s.drugs === 0 ? "pass" : "alert" },
        { period: "สัปดาห์ก่อน", kpi1: "1 ครั้ง", kpi2: "พบ 0 ราย", kpi3: "ตรวจครบ", state: "pass" },
        { period: "2 สัปดาห์ก่อน", kpi1: "0 ครั้ง", kpi2: "พบ 1 ราย", kpi3: "ตรวจครบ", state: "warning" },
        { period: "3 สัปดาห์ก่อน", kpi1: "0 ครั้ง", kpi2: "พบ 0 ราย", kpi3: "ตรวจครบ", state: "pass" }
      ];
    } else if (activeDeptId === "d-cold") {
      const s = dk["d-cold"];
      return [
        { period: "สัปดาห์ปัจจุบัน (รันไทม์)", kpi1: `${s.satisfaction}`, kpi2: `${s.deposit}%`, kpi3: `${s.power} หน่วย`, state: s.satisfaction >= 4.5 && s.power <= 1.2 ? "pass" : "warning" },
        { period: "สัปดาห์ก่อน", kpi1: "4.7", kpi2: "82%", kpi3: "1.32 หน่วย", state: "warning" },
        { period: "2 สัปดาห์ก่อน", kpi1: "4.8", kpi2: "84%", kpi3: "1.18 หน่วย", state: "pass" },
        { period: "3 สัปดาห์ก่อน", kpi1: "4.9", kpi2: "88%", kpi3: "1.10 หน่วย", state: "pass" }
      ];
    }
    return [];
  }, [activeDeptId, stats]);

  // ลิสต์คำถามด่วนอ้างอิงตามตัวชี้วัดความสอดคล้อง (Quick KPI Questions)
  const quickQuestions = useMemo(() => {
    if (activeDeptId === "d-space") {
      return [
        { label: "วิเคราะห์อัตราการเช่า Stall Occupancy (96%)", text: "วิเคราะห์การจองพื้นที่และโอกาสขยายโซนตลาดเพิ่มเติม" },
        { label: "ตรวจสารเคมีตกค้างปลอดภัย 95%", text: "สัดส่วนตรวจสารเคมีแล้วปลอดภัย 95% มีความเสี่ยงตรงกลุ่มพืชผักชนิดใดและควรแก้ปัญหาอย่างไร" },
        { label: "เวลาเดินรถอาคารผัก 33 นาที", text: "วิเคราะห์เวลาจอดรถในอาคารรถผัก 3 รอบหลัก ทำไมใช้เวลาเฉลี่ยถึง 33 นาทีต่อรอบ" }
      ];
    } else if (activeDeptId === "d-clean") {
      return [
        { label: "วิเคราะห์เหตุการณ์ขยะล้น Zone C (92%)", text: "วิเคราะห์ขยะล้นถังขยะอินทรีย์ลานผัก Zone C สะสม 92% มีผลเสียอย่างไร" },
        { label: "ดัชนี COD บ่อบำบัดน้ำเสียสูง (160 mg/L)", text: "รายงานค่า COD บ่อบำบัดน้ำเสียพุ่งสูง 160 mg/L ผิดเกณฑ์ควบคุมอย่างไร" },
        { label: "ข้อร้องเรียนจุดสกปรกหลุดเกณฑ์ SLA", text: "มีข้อร้องเรียนจุดสกปรกแผงค้าใดบ้างที่ซ่อมเคลียร์ไม่ทัน SLA 30 นาที" }
      ];
    } else if (activeDeptId === "d-security") {
      return [
        { label: "รายงานรถคอขวดติดด่านทางเข้าเกิน 5 นาที", text: "ขอดูรายงานปัญหารถติดคอขวดสะสมหน้าประตู Gate 3 นาน 15 นาที" },
        { label: "เดินรถผักเข้าอาคารล่าช้า (42 นาที/รอบ)", text: "รถผักเข้าอาคารผลไม้ล่าช้า 42 นาที/รอบ เกิดจากอะไรและแก้ยังไง" },
        { label: "วิเคราะห์ลักลอบจอดรถยนต์ส่วนบุคคล 18 เคส", text: "มีรายงานลักลอบแอบจอดรถทิ้งไม่ซื้อจริง และข้อร้องเรียนจากผู้ซื้อแท้จริงอย่างไรบ้าง" }
      ];
    } else if (activeDeptId === "d-labor") {
      return [
        { label: "ลูกค้ารอคิวลงของเฉลี่ยวิกฤต (22 นาที)", text: "วิเคราะห์เวลารอคอยของรถลูกค้าลงสินค้าเฉลี่ย 22 นาที เกินเกณฑ์ 10 นาทีอย่างไร" },
        { label: "เวลาลงสินค้าหลุด SLA สะสม 19%", text: "ทำไมเวลาโหลดของลงสินค้าถึงล่าช้ากว่ากำหนด SLA สะสมสูงถึง 19%" },
        { label: "Forklift Utilization ตกต่ำ & ขาด PM", text: "ทำไม Forklift รันเฉลี่ยแค่ 50% และปัญหาการงดตรวจ PM ประจำรอบกะเช้า" }
      ];
    } else if (activeDeptId === "d-maintenance") {
      return [
        { label: "วิเคราะห์ Breakdown เครื่อง Gen-01 นาน 120 นาที", text: "สรุปปัญหาสัญญาณขัดข้องของเครื่องปั่นไฟสำรอง GEN-01 และอัตราการ Utilize ล่าสุด" },
        { label: "ขอดูใบงานซ่อมระบบประปาไฟฟ้าขัดต่อ SLA", text: "ขอดูรายชื่องานแจ้งซ่อมและรายงานใบงาน RQ-1045 ซ่อมล่าช้าขัด SLA" }
      ];
    } else if (activeDeptId === "d-specsec") {
      return [
        { label: "วิเคราะห์เหตุลักทรัพย์/ทะเลาะวิวาท 2 เคส", text: "วิเคราะห์ข้อมูลอุบัติเหตุและเหตุการณ์ทะเลาะวิวาท 2 ครั้งในตลาดสัปดาห์นี้และมาตรการป้องกัน" },
        { label: "สุ่มตรวจสารเสพติดเจอสีเสื้อแรงงานต่างชาติ", text: "ขอวิเคราะห์ผลการสุ่มตรวจปัสสาวะแรงงานต่างด้าว 320 คน พบสารเสพติด 2 ราย" }
      ];
    } else if (activeDeptId === "d-cold") {
      return [
        { label: "ดัชนีพึงพอใจการบริการห้องเย็น (4.8)", text: "วิเคราะห์ความพึงพอใจและการจองรับฝากสินค้าห้องเย็น 85% เทียบเกณฑ์เป้าหมาย" },
        { label: "วิเคราะห์ค่าไฟฟ้าบานปลายห้องแช่แข็ง (1.45)", text: "ทำไมอัตราการใช้พลังงานไฟฟ้าห้องเย็นสูงถึง 1.45 หน่วย/ตร.ม./วัน และแผนประหยัดไฟฟ้า" }
      ];
    }
    return [];
  }, [activeDeptId]);

  return (
    <Layout>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p className="eyebrow">แผงควบคุมผู้บริหารสูงสุด (Executive Dashboard)</p>
          <h1>ระบบประเมินดัชนี KPI และสั่งการอนุมัติ</h1>
          <p>
            ระบบวิเคราะห์สถานการณ์สนับสนุนการบริหารและตัดสินใจสำหรับ **ตลาดสี่มุมเมือง** 
            แยกแยะตามตรรกะเฉพาะฝ่ายงาน เพื่อแก้ปัญหาคอขวดปฏิบัติงานและคงเกณฑ์มาตรฐานของตลาด
          </p>
        </div>
        
        {/* GAP 5: PDF Briefing Export Action */}
        <button 
          className="btn" 
          onClick={() => setShowExportModal(true)}
          style={{ backgroundColor: "var(--red-dark)", borderColor: "var(--red-dark)" }}
        >
          📄 ส่งออกรายงาน SMM Board Briefing
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. เมนู Dropdown เลือกฝ่ายงานปฏิบัติการที่ต้องการวิเคราะห์ */}
      {/* ========================================================================= */}
      <div className="card dept-selector-panel" style={{ marginBottom: 24, padding: "18px 24px", borderLeft: "5px solid var(--red-dark)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: "#fff" }}>
        <label className="font-display" style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--red-dark)", margin: 0, whiteSpace: "nowrap" }}>
          📂 เลือกฝ่ายงานปฏิบัติการที่ต้องการวิเคราะห์ดัชนี:
        </label>
        <select
          value={activeDeptId}
          onChange={(e) => setActiveDeptId(e.target.value)}
          className="dept-select-dropdown"
          style={{
            flex: 1,
            minWidth: "280px",
            padding: "12px 16px",
            fontSize: "1rem",
            fontWeight: 700,
            borderRadius: "var(--radius)",
            border: "1.5px solid var(--line)",
            background: "#fff",
            color: "var(--ink)",
            cursor: "pointer",
            fontFamily: "var(--font-display)",
            transition: "all 0.2s ease"
          }}
        >
          {DEPARTMENTS.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.icon} {dept.name}
            </option>
          ))}
        </select>
      </div>

      {/* ========================================================================= */}
      {/* 2. ดัชนีเป้าหมายความสำเร็จตัวชี้วัด (KPI Metrics Grid) */}
      {/* ========================================================================= */}
      <div className="kpi-metrics-grid">
        {kpiMetrics.map((kpi, idx) => (
          <div key={idx} className={`kpi-metric-card kpi-state-${kpi.status}`}>
            <span className="kpi-badge font-display">{kpi.status === "pass" ? "ผ่านเกณฑ์" : kpi.status === "warning" ? "ต้องติดตาม" : "หลุดเกณฑ์วิกฤต"}</span>
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-values">
              <span className="current-val">{kpi.current}</span>
              <span className="target-val">/ เป้าหมาย {kpi.target}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* GAP 1: ตารางแสดงข้อมูลแนวโน้มเปรียบเทียบย้อนหลัง (เรียงจากสัปดาห์ล่าสุด -> เก่าสุด) */}
      {/* ========================================================================= */}
      <div className="card trend-panel" style={{ marginBottom: 20 }}>
        <h3 className="font-display" style={{ margin: "0 0 12px 0", fontSize: "1.1rem", color: "var(--red-dark)" }}>
          📈 รายงานเปรียบเทียบแนวโน้มย้อนหลัง (เรียงจากสัปดาห์ล่าสุด &rarr; เก่าสุด)
        </h3>
        <p style={{ color: "var(--ink-soft)", fontSize: "0.85rem", margin: "0 0 14px 0" }}>
          แสดงทิศทางแนวโน้มเพื่อติดตามความคืบหน้าของมาตรการอนุมัติ โดยเรียงลำดับหัวข้อจากสัปดาห์ล่าสุดเพื่อให้พร้อมดูสถานะได้ทันที
        </p>

        <div className="trend-table-wrapper">
          <table className="trend-table">
            <thead>
              <tr>
                <th>ระยะช่วงเวลา</th>
                <th>
                  {activeDeptId === "d-space" ? "Stall Occupancy" : 
                   activeDeptId === "d-clean" ? "ระดับขยะล้นถัง" : 
                   activeDeptId === "d-security" ? "เวลาเคลียร์รถติด" : 
                   activeDeptId === "d-labor" ? "ลูกค้ารอลงของ" : 
                   activeDeptId === "d-maintenance" ? "Utilize ปั๊ม/Gen" :
                   activeDeptId === "d-specsec" ? "คดีทะเลาะวิวาท" : "ความพึงพอใจ"}
                </th>
                <th>
                  {activeDeptId === "d-space" ? "ตรวจเคมีปลอดภัย" : 
                   activeDeptId === "d-clean" ? "น้ำทิ้ง COD บ่อบำบัด" : 
                   activeDeptId === "d-security" ? "เวลาจัดรถผัก" : 
                   activeDeptId === "d-labor" ? "เวลาลงสินค้า SLA" : 
                   activeDeptId === "d-maintenance" ? "ชั่วโมง Breakdown" :
                   activeDeptId === "d-specsec" ? "สุ่มตรวจสารเสพติด" : "พื้นที่ห้องเย็น"}
                </th>
                <th>
                  {activeDeptId === "d-space" ? "รอบจอดรถอาคารรถผัก" : 
                   activeDeptId === "d-clean" ? "งานเคลียร์จุดสกปรก (SLA)" : 
                   activeDeptId === "d-security" ? "เคลียร์ลักลอบจอด" : 
                   activeDeptId === "d-labor" ? "Forklift PM/Util" : 
                   activeDeptId === "d-maintenance" ? "งานจบตาม SLA" :
                   activeDeptId === "d-specsec" ? "การสุ่มตรวจสอบ" : "ไฟฟ้าสะสม (หน่วย)"}
                </th>
                <th>ดัชนีรวมฝ่าย</th>
              </tr>
            </thead>
            <tbody>
              {historicalTrends.map((t, idx) => (
                <tr key={idx} className={`trend-row trend-state-${t.state}`}>
                  <td><strong>{t.period}</strong></td>
                  <td>{t.kpi1}</td>
                  <td>{t.kpi2}</td>
                  <td>{t.kpi3}</td>
                  <td>
                    <span className={`trend-indicator-badge ${t.state}`}>
                      {t.state === "pass" ? "🟢 เสถียรดี" : t.state === "warning" ? "🟡 เริ่มอ่อนไหว" : "🔴 หลุดเกณฑ์สะสม"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="executive-grid">
        {/* Main Left Content: Case Cards */}
        <div className="exec-main-content">
          
          {/* ========================================================================= */}
          {/* Case 5: Weekly Briefing */}
          {/* ========================================================================= */}
          <div className="card briefing-panel" id="case-5">
            <div className="ai-tag-wrapper">
              <span className="ai-tag generative">Generative AI</span>
            </div>
            
            <h2 style={{ margin: "0 0 8px 0", fontFamily: "var(--font-display)", fontSize: "1.4rem" }}>
              📋 สรุปตัวชี้วัดประเด็นร้อน & ลิสต์ส่งคำสั่งตัดสินใจ (Case 5)
            </h2>
            <p className="briefing-dept-sub font-display">วิเคราะห์เฉพาะ: {
              DEPARTMENTS.find(d => d.id === activeDeptId)?.name || activeDeptId
            }</p>

            <div className="briefing-action-header">
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.92rem", flex: 1 }}>
                AI ประมวลผลจากข้อมูลรายงานหน้างาน เพื่อชี้เป้าว่ามีดัชนี KPI ตัวไหนหลุดเป้าหมาย และเสนอปุ่มใบสั่งงานเพื่ออนุมัติคำสั่งเร่งด่วน
              </p>
              <button className="btn" onClick={runWeeklyBriefing} disabled={briefingLoading}>
                {briefingLoading ? "กำลังประมวลผล..." : "✨ สรุปประเด็นอนุมัติด้วย AI"}
              </button>
            </div>

            {briefingError && (
              <p className="error-banner" style={{ marginTop: 12 }}>{briefingError}</p>
            )}

            {!briefingResult && !briefingLoading && !briefingError && (
              <div className="empty-briefing-prompt">
                <span className="briefing-icon">📊</span>
                <p>กดปุ่ม &ldquo;สรุปประเด็นอนุมัติด้วย AI&rdquo; เพื่อให้ AI ตรวจสอบสถานะการตัดสินใจ</p>
              </div>
            )}

            {briefingResult && (
              <div className="briefing-compiled-result">
                <blockquote>{briefingResult.summary}</blockquote>
                
                <h4 style={{ margin: "20px 0 10px 0", fontWeight: 700 }}>
                  🚨 ลิสต์ส่งคำอนุมัติสั่งการนโยบายด่วน:
                </h4>
                
                <ul className="briefing-todo-list">
                  {activeDeptId === "d-space" && (
                    <>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>สั่งงดการค้าขาย 3 วัน แผงที่พบปนเปื้อนสารเคมีสะสมในผักใบ 5% เพื่อกู้สิทธิปลอดภัย</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("P01")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-P01)
                          </button>
                        </div>
                      </li>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>เร่งระบายจัดเดินรถเข้าอาคารผักลดคอขวดเวลา 33 นาทีต่อรอบ</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("P02")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-P02)
                          </button>
                        </div>
                      </li>
                    </>
                  )}

                  {activeDeptId === "d-clean" && (
                    <>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>สั่งดำเนินการแก้ปัญหาขยะลอยฟ้า/ขยะอินทรีย์สะสมล้นตระกร้า ณ ลานผัก Zone C</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("C01")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-C01)
                          </button>
                        </div>
                      </li>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>เร่งดึงและล้างจุดสกปรกค้างสะสมตาม SLA และควบคุมน้ำเสีย COD บ่อ 2</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("C02")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-C02)
                          </button>
                        </div>
                      </li>
                    </>
                  )}

                  {activeDeptId === "d-security" && (
                    <>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>ส่ง รปภ. ตรวจและล็อกล้อรถแอบลักลอบจอดผิดกฎเพื่ออำนวยความสะดวกผู้ซื้อ</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("S01")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-S01)
                          </button>
                        </div>
                      </li>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>ปรับวิถีเดินรถและเพิ่มด่านทางเข้าเพื่อเคลียร์คอขวดสะสมจราจรต่ำกว่า 5 นาที</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("S02")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-S02)
                          </button>
                        </div>
                      </li>
                    </>
                  )}

                  {activeDeptId === "d-labor" && (
                    <>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>แก้ปัญหารถลูกค้ารอลงของนานเกิน 10 นาที ขัดเกณฑ์มาตรฐานการบริการ</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("L01")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-L01)
                          </button>
                        </div>
                      </li>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>อนุมัติโครงการซ่อมตรวจสอบบำรุงรักษา PM พัฒนา Utilization Forklift &gt; 80%</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("L02")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-L02)
                          </button>
                        </div>
                      </li>
                    </>
                  )}

                  {activeDeptId === "d-maintenance" && (
                    <>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>อนุมัติโครงการซ่อมใหญ่เปลี่ยนพัดลมความร้อนเพื่อกู้เครื่อง Gen-01 หลังขัดข้อง Breakdown</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("M01")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-M01)
                          </button>
                        </div>
                      </li>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>อนุมัติมาตรการปรับสต็อกชิ้นส่วนอะไหล่สายไฟแก้ปัญหางานซ่อมเกินกำหนด SLA</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("M02")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-M02)
                          </button>
                        </div>
                      </li>
                    </>
                  )}

                  {activeDeptId === "d-specsec" && (
                    <>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>อนุมัติตั้งจุดตรวจร่วมพิเศษ รปภ. ลานจอดเพื่อป้องกันเหตุทะเลาะวิวาทและลักทรัพย์</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("R01")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-R01)
                          </button>
                        </div>
                      </li>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>อนุมัติมาตรการสุ่มตรวจวินัยแรงงานและการจัดการต่างด้าวปัสสาวะสีม่วง</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("R02")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-R02)
                          </button>
                        </div>
                      </li>
                    </>
                  )}

                  {activeDeptId === "d-cold" && (
                    <>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>อนุมัติการตรวจสอบประเก็นขอบยางประตูกันความร้อนเครื่องแช่แข็ง A-01 ลดค่าไฟฟ้าสะสม</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("K01")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-K01)
                          </button>
                        </div>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div style={{ margin: "24px 0 16px 0", borderBottom: "2px solid var(--line)" }} />

          {/* ========================================================================= */}
          {/* P. ฝ่ายจัดพื้นที่ & สารพิษ (Space Cases) */}
          {/* ========================================================================= */}
          {activeDeptId === "d-space" && (
            <div className="dept-cases-list">
              <DecisionCard
                caseId="P01"
                aiLabel="Toxin & Rent Occupancy"
                title="สัดส่วนตรวจสารเคมีแล้วปลอดภัยหลุดเกณฑ์เป้าหมาย 100% (ปนเปื้อน 5%)"
                what={
                  <div>
                    สุ่มตรวจพบสารเคมีตกค้างปนเปื้อนระดับเฝ้าระวังสีส้มในแผงจำหน่ายผักใบสะสมรวม <strong>5%</strong> ของจำนวนรายการสุ่มคัดกรอง 65 ตัวอย่าง
                  </div>
                }
                why={
                  <div>
                    ดัชนีเฝ้าระวังสารพิษ: <strong>ต้องปลอดสารเคมี 100%</strong> เพื่อรักษาความเชื่อมั่นผู้ซื้อตลาด ขณะนี้พบบริเวณแผงผักใบและคะน้าจีน
                  </div>
                }
                decisions={["ตักเตือนและสั่งงดจำหน่ายแผงที่พบสารเคมี 3 วัน", "เพิ่มความถี่ตรวจคัดกรองสารพิษเป็นรายวัน", "ระงับการต่อสัญญาเช่าแผงค้านั้นในรอบถัดไป"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("P01")}
              />

              {workflowStatus["P01"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["P01"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["P01"] === "ordered" ? "🕒 กำลังออกหนังสือเตือนแผงค้าและระงับสิทธิ์จำหน่าย..." : "✓ เสร็จสมบูรณ์ (แผงค้ายินยอมงดจำหน่ายและคัดแยกสินค้าชุดที่ตรวจพบแล้ว)"
                  }</strong></span>
                </div>
              )}

              <DecisionCard
                caseId="P02"
                aiLabel="Traffic Allocation"
                title="เวลาจัดจอดรถในอาคารรถผัก 3 รอบหลักล่าช้ากว่าเกณฑ์กำหนด"
                what={
                  <div>
                    เวลาเฉลี่ยการบริหารจัดจอดรถผักเข้าเทียบชานชาลาวัดได้ <strong>33 นาทีต่อรอบ</strong> (เป้าหมายห้ามเกิน 30 นาที)
                  </div>
                }
                why={
                  <div>
                    เกณฑ์ประสิทธิภาพอาคารผักใหม่: <strong>ต้องไหลลื่นใน 30 นาที</strong> เพื่อคิวรถคอกขนส่งไม่ให้กระจุยกระจายกีดขวางถนนหลัก
                  </div>
                }
                decisions={["สั่งระดมกำลังเจ้าหน้าที่จัดพื้นที่เสริมช่วยโบกรถ (+1,000 บ./วัน)", "เปิดช่องสำรองจอดรอบ 20:00 เฉพาะรถบรรทุกหนัก", "ขยายเป้าเวลารอบวิ่งเป็น 35 นาที (เพื่อความปลอดภัย)"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("P02")}
              />

              {workflowStatus["P02"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["P02"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["P02"] === "ordered" ? "🕒 สั่งการทีมจัดพื้นที่เข้าคุมจุดตัดอาคารรถผัก..." : "✓ เสร็จสมบูรณ์ (ขจัดรถค้างสะสมและเดินรถได้ต่ำกว่า 30 นาทีต่อรอบ)"
                  }</strong></span>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* A. ฝ่ายรักษาความสะอาด (Cleanliness Cases) */}
          {/* ========================================================================= */}
          {activeDeptId === "d-clean" && (
            <div className="dept-cases-list">
              <DecisionCard
                caseId="C01"
                aiLabel="Predictive + Rule"
                title="ขยะอินทรีย์สะสมเกินความสามารถในการคัดแยก (Waste Overflow)"
                what={
                  <div>
                    ลานผัก Zone C คาดว่าจะมีขยะอินทรีย์ล้นเกินความจุสะสม <strong>1,280 kg</strong> ในอีก 38 นาที ข้างหน้า เนื่องจากมีรถคอกขนส่งผลไม้เข้ามาพร้อมกันสะสม 27 คัน
                  </div>
                }
                why={
                  <div>
                    ประเมินตามเกณฑ์ควบคุมขยะล้นถัง: <strong>ปริมาณขยะเกณฑ์เตือน &gt; 90%</strong> ปัจจุบันตรวจวัดพบระดับสะสมสูงถึง 92% พร้อมปัญหากลิ่นรบกวน (High Odor) และปริมาณแมลงวันขึ้นทะลุเป้าหมายที่ 45 ตัว/กับดัก (KPI &lt; 20 ตัว)
                  </div>
                }
                decisions={["เพิ่มรถเก็บจาก Zone A (งบ +1,500 บ./วัน)", "ขยายรอบเก็บเป็นทุก 30 นาที (งบ +2,200 บ./วัน)", "จ้างผู้รับเหมาภายนอกชั่วคราว (+5,000 บ./ครั้ง)"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("C01")}
              />

              {workflowStatus["C01"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["C01"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["C01"] === "ordered" ? "🕒 สั่งการแล้ว (ช่างกำลังดำเนินการขนย้ายรถขยะ...)" : "✓ เสร็จสมบูรณ์ (ระบายขยะอินทรีย์เสร็จเรียบร้อย)"
                  }</strong></span>
                </div>
              )}

              <DecisionCard
                caseId="C02"
                aiLabel="Complaints SLA + Water Quality"
                title="ข้อร้องเรียนจุดสกปรกตามแผงค้าค้างชำระหลุดเกณฑ์ SLA และน้ำเสีย COD พุ่งสูง"
                what={
                  <div>
                    ข้อร้องเรียนความสกปรกสะสมบริเวณแผงสัตว์ปีกและลานปลา **หลุดเวลาปิดงาน SLA 6 รายการ** และดัชนีคุณภาพบ่อน้ำเสียมีค่าซีโอดี COD สูงวิกฤตพุ่งแตะ <strong>160 mg/L</strong> (หลุดเกณฑ์เป้าหมายมาตรฐาน)
                  </div>
                }
                why={
                  <div>
                    เปรียบเทียบเกณฑ์ปิดงานสะอาด: **ต้องเคลียร์ขจัดจุดสกปรกเสร็จใน 30 นาที (SLA Met &gt; 95%)** แต่อัตรางานเคลียร์จริงทำได้ล่าช้าตกลงเหลือ 88% สอดคล้องกับค่า COD ทะลุเกณฑ์น้ำทิ้งตลาดสด (&lt; 120 mg/L)
                  </div>
                }
                decisions={["สั่งระดมหน่วยฉีดน้ำล้างแผงด่วน (งบ +2,500 บ.)", "จัดโซนผู้รับผิดชอบกวาดจุดเปื้อนใหม่ (ค่าใช้จ่าย 0 บ.)", "ปรับลดขีดจำกัด SLA ซ่อมความสะอาดเป็น 45 นาที"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("C02")}
              />

              {workflowStatus["C02"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["C02"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["C02"] === "ordered" ? "🕒 ทีมฉีดล้างกำลังเคลื่อนที่เข้าจุดแผงค้า..." : "✓ เสร็จสมบูรณ์ (กวาดล้างคราบสิ่งปฏิกูลค้างท่อและบำบัดน้ำเป็นปกติแล้ว)"
                  }</strong></span>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* B. ฝ่ายความปลอดภัย (Security Cases) */}
          {/* ========================================================================= */}
          {activeDeptId === "d-security" && (
            <div className="dept-cases-list">
              <DecisionCard
                caseId="S01"
                aiLabel="Illegal Parking Gate"
                title="รถยนต์แอบลักลอบจอดในที่จอดสำหรับผู้ซื้อสินค้า (Illegal Parking)"
                what={
                  <div>
                    ตรวจพบรถยนต์แอบลักลอบจอดทิ้งไม่ซื้อจริงสะสมบริเวณลานจอดหลัก ส่งผลให้อัตราจอดแฝงสูงขึ้นและลดความสะดวกของผู้ซื้อบริการจริง (อัตราจัดการจอดแฝงสำเร็จเพียง <strong>82%</strong>)
                  </div>
                }
                why={
                  <div>
                    เป้าหมายที่จอดรถตลาด: **ต้องจัดการพวกลักลอบจอดและลดข้อร้องเรียนให้เหลือน้อยที่สุด** เพื่ออำนวยความสะดวกให้ผู้ซื้อเข้ามาหมุนเวียนได้สะดวก ปัจจุบันผู้ซื้อบ่นไม่มีที่จอดและมีข้อร้องเรียนสะสม 18 รายการ
                  </div>
                }
                decisions={["สั่งล็อกล้อรถลักลอบจอดทันที (เก็บค่าปรับ +500 บ.)", "ติดตั้งกล้อง AI ตรวจจับรถแอบจอด (งบ +3,000 บ.)", "จัด รปภ. เฝ้ารายด่านลานจอดหลัก (+1,500 บ./กะ)"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("S01")}
              />

              {workflowStatus["S01"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["S01"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["S01"] === "ordered" ? "🕒 รปภ. กำลังเคลื่อนที่ตรวจสอบและติดป้ายปรับ..." : "✓ เสร็จสมบูรณ์ (ล็อกล้อรถแฝงและสแกนสิทธิ์ทางเข้าอำนวยความสะดวกผู้ซื้อจริงแล้ว)"
                  }</strong></span>
                </div>
              )}

              <DecisionCard
                caseId="S02"
                aiLabel="Traffic Jam SLA"
                title="จราจรทางเข้าคอขวดและจัดระเบียบรถผักเดินรอบอาคารล่าช้าขัดต่อเกณฑ์ 5 นาที"
                what={
                  <div>
                    ระยะเวลารถติดขัดสะสมหนาแน่นด่านทางเข้า Gate 3 สูงถึง <strong>15 นาที</strong> และเวลารอบวิ่งจัดรถผักเข้าอาคารลานส่งเฉลี่ยพุ่งถึง <strong>42 นาทีต่อรอบ</strong>
                  </div>
                }
                why={
                  <div>
                    เกณฑ์ควบคุมจราจร: **รถติดห้ามเกิน 5 นาทีต้องเคลียร์** และ **จัดรถผักเข้าอาคารเป้าหมายต้องไม่เกิน 40 นาทีต่อรอบ** เพื่อขจัดคอขวดสะสมจราจรรถขนส่ง
                  </div>
                }
                decisions={["สั่งเปิดประตู Gate พิเศษเพิ่มเติม (+800 บ./กะ)", "ปรับแผนสลับเดินรถวันเวย์ทางเข้าออก (ค่าใช้จ่าย 0 บ.)", "เรียก รปภ. เสริมช่วยจัดคิวปล่อยรถผลไม้ (+1,200 บ./วัน)"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("S02")}
              />

              {workflowStatus["S02"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["S02"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["S02"] === "ordered" ? "🕒 กำลังปรับทิศทางทางเดินรถและเสริม รปภ. ด่านทางร่วม..." : "✓ เสร็จสมบูรณ์ (ระบายคิวรถสะสมหน้า Gate ต่ำกว่า 5 นาทีเป็นปกติ)"
                  }</strong></span>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* C. ฝ่ายแรงงาน (Labor Cases) */}
          {/* ========================================================================= */}
          {activeDeptId === "d-labor" && (
            <div className="dept-cases-list">
              <DecisionCard
                caseId="L01"
                aiLabel="Customer Queue Delay"
                title="เวลารอคอยของรถลูกค้าในการลงสินค้าขนถ่ายล่าช้าเกินกำหนด 10 นาที"
                what={
                  <div>
                    รถลูกค้าขนส่งที่จอดรอลงของบริเวณลานค้าเพื่อขนถ่ายสินค้า จอดคอยเฉลี่ยยาวนาน <strong>22 นาที</strong> (หลุดเกณฑ์เป้าหมาย)
                  </div>
                }
                why={
                  <div>
                    เป้าหมายการขนถ่าย: **เวลารอคอยสูงสุดของรถลูกค้าห้ามเกิน 10 นาที** และเวลาลงสินค้าตาม SLA ต้องลื่นไหล เนื่องจากกะปฏิบัติการนี้สัดส่วนแรงงานไม่สมดุลส่งผลให้งานล่าช้าขัด SLA สะสมรวม 19%
                  </div>
                }
                decisions={["จ่ายค่าแรงโอทีจัดกะขนของเสริมด่วน (+3,200 บ./กะ)", "ปรับรอบเวลาจำกัดสิทธิ์รถที่มาจอดลงของ (ค่าดำเนินการ 0 บ.)", "จัดระเบียบคิวปล่อยรถเพื่อระบายช่องเทียบขนถ่าย"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("L01")}
              />

              {workflowStatus["L01"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["L01"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["L01"] === "ordered" ? "🕒 หัวหน้ากะกำลังเรียกจัดกำลังคนเสริม..." : "✓ เสร็จสมบูรณ์ (เคลียร์เวลารอลงสินค้าของรถลูกค้าต่ำกว่า 10 นาที)"
                  }</strong></span>
                </div>
              )}

              <DecisionCard
                caseId="L02"
                aiLabel="Forklift PM & Idle"
                title="อัตราการใช้งาน Forklift ตกต่ำกว่าเกณฑ์ 80% และขาดการตรวจสอบ PM เช็คสภาพ"
                what={
                  <div>
                    อัตราการใช้งาน Forklift ตกลงเฉลี่ยเหลือเพียง <strong>50%</strong> และตรวจพบบันทึกขาดการประเมินสภาพ PM Check ระบบชาร์จและไฟเตือนประจำวัน
                  </div>
                }
                why={
                  <div>
                    เป้าหมายฝ่ายแรงงาน: **รถ Forklift ต้องมีอัตราการใช้งานไม่ต่ำกว่า 80%** และต้องได้รับการทำบำรุงรักษาป้องกันเชิงควบคุม (Preventative Maintenance) ตรวจเช็คเครื่องยนต์ 100% เพื่อลดความสูญเสียกะงาน
                  </div>
                }
                decisions={["สั่งด่วนช่างคลังเข้าซ่อมทำ PM Forklift ทั้งคลัง (-6,000 บ.)", "ปรับลดจำนวนเช่ารถและกระจายกะรถสแตนด์บาย (ค่าปรับ 0 บ.)", "เรียกใช้สัญญาช่างซัพพลายเออร์ดูแลด่วน"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("L02")}
              />

              {workflowStatus["L02"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["L02"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["L02"] === "ordered" ? "🕒 ช่างไฟฟ้าเข้าตรวจสอบชุดแบตเตอรี่รถตัก..." : "✓ เสร็จสมบูรณ์ (Forklift ดำเนินการ PM เช็คลิสต์ 100% อัตราการรันสูงกว่า 80%)"
                  }</strong></span>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* D. ฝ่ายซ่อมบำรุง (Maintenance Cases) */}
          {/* ========================================================================= */}
          {activeDeptId === "d-maintenance" && (
            <div className="dept-cases-list">
              <DecisionCard
                caseId="M01"
                aiLabel="Preventative Maintenance"
                title="เครื่องผลิตไฟสำรองเกิด Breakdown ขัดข้องกระทบความสม่ำเสมอ"
                what={
                  <div>
                    ตรวจพบเครื่องปั่นไฟฟ้าอาคารผลไม้หลัก (GEN-01) ชำรุดเสียหายขัดข้อง Breakdown สะสมยาวนาน <strong>120 นาที</strong> ส่งผลให้อัตราใช้เครื่องจักรลดลงเหลือ <strong>45%</strong>
                  </div>
                }
                why={
                  <div>
                    เปรียบเทียบตามเกณฑ์ควบคุมขัดข้อง: <strong>Breakdown ต้องเป็น 0 และ Utilize ต้อง &gt; 80%</strong> เครื่องเกิดความร้อนในห้องสูบน้ำหล่อเย็นสูง หากไม่เร่งเปลี่ยนพัดลมความร้อนด่วน จะเกิดความเสี่ยงไฟฟ้าดับกระทบระบบห้องเย็นผู้ค้าผลไม้ 12 แผง
                  </div>
                }
                decisions={["ซ่อมเปลี่ยนพัดลมไฟฟ้าด่วน (-8,500 บ. อะไหล่)", "สลับจ่ายไฟไปตัวเครื่อง 2 (สูญเสียน้ำมันสำรอง 15%)", "คุมการจ่ายไฟเพื่อลดความร้อน (ลดความสว่าง 20%)"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("M01")}
              />

              {workflowStatus["M01"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["M01"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["M01"] === "ordered" ? "🕒 ส่งกำลังทีมช่างนำอะไหล่เข้าพื้นที่ GEN-01..." : "✓ เสร็จสมบูรณ์ (เปลี่ยนชิ้นส่วนพัดลมสำเร็จ อุณหภูมิเป็นปกติ 100% Run)"
                  }</strong></span>
                </div>
              )}

              <DecisionCard
                caseId="M02"
                aiLabel="SLA Compliance"
                title="อัตราความเร็วในการจบงานซ่อมแผงค้าและระบบหลุดเกณฑ์ SLA ตลาด"
                what={
                  <div>
                    ยอดการปิดงานแจ้งซ่อมระบบประปาและไฟฟ้ารอบสัปดาห์นี้ <strong>หลุดมาตรฐานข้อตกลง SLA รวม 9 รายการ</strong> เช่น งานซ่อมไฟฟ้า RQ-1045 ล่าช้าเกิน 180 นาที
                  </div>
                }
                why={
                  <div>
                    เปรียบเทียบ KPI SLA: <strong>ความรวดเร็วงานซ่อมด่วนต้องสำเร็จใน 2 ชม. (SLA Met &gt; 95%)</strong> แต่อัตราปิดงานสัปดาห์นี้ทำได้เพียง 91% เนื่องจากขาดแคลนชิ้นส่วนสายไฟและข้อต่อในสต็อกกลาง
                  </div>
                }
                decisions={["จัดซื้ออะไหล่สต็อกสายไฟสำรอง (-15,000 บ.)", "แบ่งโซนเขตรับผิดชอบทีมช่างใหม่ (ค่าใช้จ่าย 0 บ.)", "ขยาย SLA ซ่อมด่วนเป็น 3 ชม. (เสียความเชื่อมั่นผู้ค้า 5%)"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("M02")}
              />

              {workflowStatus["M02"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["M02"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["M02"] === "ordered" ? "🕒 ส่งคำสั่งการคลังสินค้าเบิกซื้ออะไหล่..." : "✓ เสร็จสมบูรณ์ (ขจัดคอขวดวัสดุพร้อมประกันความเร็ว SLA 98% จบงาน)"
                  }</strong></span>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* E. ฝ่าย รปภ. เฉพาะกิจ (Special Security Cases) */}
          {/* ========================================================================= */}
          {activeDeptId === "d-specsec" && (
            <div className="dept-cases-list">
              <DecisionCard
                caseId="R01"
                aiLabel="Emergency Response"
                title="รายงานเหตุทะเลาะวิวาทและลักทรัพย์สะสมในสัปดาห์วิกฤต"
                what={
                  <div>
                    มีบันทึกเหตุการณ์ทะเลาะวิวาทและแอบลักทรัพย์สินค้าสะสมรวม <strong>2 ครั้ง</strong> ในสัปดาห์นี้ บริเวณลานจอดหลักและลานค้าผลไม้
                  </div>
                }
                why={
                  <div>
                    เกณฑ์ควบคุมเหตุความมั่นคง: <strong>สถิติต้องเป็น 0</strong> เพื่อความปลอดภัยสูงสุดของผู้ซื้อที่เข้ามาใช้บริการหมุนเวียนในตลาด
                  </div>
                }
                decisions={["สั่งตั้งจุดตรวจร่วมพิเศษ รปภ. ตลอด 24 ชม. โซนลานจอด", "เพิ่มการเดินลาดตระเวนรอบตลาดช่วงตี 2-7 โมง (+2,000 บ./คืน)", "ติดตั้งป้ายคำเตือนการปรับและดำเนินคดีเด็ดขาด"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("R01")}
              />

              {workflowStatus["R01"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["R01"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["R01"] === "ordered" ? "🕒 ทีม รปภ. เฉพาะกิจกำลังนำอุปกรณ์รั้วตั้งจุดตรวจร่วม..." : "✓ เสร็จสมบูรณ์ (สถาปนาความปลอดภัยและควบคุมความสงบในพื้นที่)"
                  }</strong></span>
                </div>
              )}

              <DecisionCard
                caseId="R02"
                aiLabel="Compliance Screening"
                title="การสุ่มตรวจหาสารเสพติดปัสสาวะแรงงานพบผลเป็นบวก"
                what={
                  <div>
                    สุ่มคัดกรองปัสสาวะกลุ่มแรงงานคลังกลางและคลังสินค้า 320 ราย ตรวจพบผลบวกสารเสพติดสะสมจำนวน <strong>2 ราย</strong>
                  </div>
                }
                why={
                  <div>
                    นโยบายความสอดคล้องระเบียบแรงงานเสื้อม่วง: <strong>สารเสพติดต้องเป็น 0%</strong> เพื่อรักษาความปลอดภัยวินัยในการปฏิบัติงานคัดแยกสินค้า
                  </div>
                }
                decisions={["ยกเลิกสิทธิ์เสื้อม่วงและส่งตำรวจดำเนินคดีทันที", "สั่งคัดกรองปัสสาวะแรงงานย่อยยกแผงค้าของแรงงานคนดังกล่าว", "เพิ่มเกณฑ์สุ่มตรวจฉี่แรงงานเป็น 20% ทุกสัปดาห์"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("R02")}
              />

              {workflowStatus["R02"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["R02"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["R02"] === "ordered" ? "🕒 กำลังดำเนินเอกสารยึดสิทธิ์บัตรและประสานพนักงานสอบสวน..." : "✓ เสร็จสมบูรณ์ (ลงทัณฑ์วินัยและปรับปรุงมาตรการสแกนแรงงานแล้ว)"
                  }</strong></span>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* F. ฝ่ายห้องเย็น (Cold Storage Cases) */}
          {/* ========================================================================= */}
          {activeDeptId === "d-cold" && (
            <div className="dept-cases-list">
              <DecisionCard
                caseId="K01"
                aiLabel="Energy Saving KPI"
                title="วิเคราะห์การใช้กระแสไฟฟ้าและค่าพลังงานพุ่งสูงเกินเป้าหมายห้องเย็น A-01"
                what={
                  <div>
                    อัตราการบริโภคพลังงานเครื่องไฟฟ้าห้องแช่แข็งหลัก (Cold Room A-01) สูงถึง <strong>1.45 หน่วย/ตร.ม./วัน</strong> (หลุดเกณฑ์เป้าหมายประหยัดพลังงาน)
                  </div>
                }
                why={
                  <div>
                    เกณฑ์ควบคุมงบค่าไฟห้องเย็น: <strong>การบริโภคไฟต้องไม่เกิน 1.2 หน่วย/ตร.ม./วัน</strong> ตรวจพบความชื้นขอบประตูและปะเก็นยางเสื่อมสภาพทำให้สูญเสียไอเย็นสะสม
                  </div>
                }
                decisions={["สั่งทีมช่างซ่อมบำรุงตรวจขอบยางประตูกันเย็นรั่วซึมทันที (-3,000 บ.)", "ปรับตั้งรอบ Defrost ละลายน้ำแข็งช่วง 00:00-04:00 เท่านั้น", "ติดตั้งม่านพลาสติกริ้วกันความร้อนเสริมตรงจุดขนถ่าย"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("K01")}
              />

              {workflowStatus["K01"] && (
                <div className={`workflow-tracker-bar ${workflowStatus["K01"]}`}>
                  <span className="pulse-dot"></span>
                  <span>สถานะสั่งการ: <strong>{
                    workflowStatus["K01"] === "ordered" ? "🕒 ช่างระบบความเย็นเข้าพื้นที่ตรวจสอบเครื่องปรับแรงดัน..." : "✓ เสร็จสมบูรณ์ (ลดการสิ้นเปลืองกำลังไฟเฉลี่ยต่ำกว่า 1.2 หน่วยได้ผลดี)"
                  }</strong></span>
                </div>
              )}
            </div>
          )}

          <div style={{ margin: "32px 0 20px 0", borderBottom: "2px solid var(--line)" }} />

          {/* ========================================================================= */}
          {/* Case 6: Conversational Copilot */}
          {/* ========================================================================= */}
          <div className="card copilot-panel" id="case-6">
            <div className="ai-tag-wrapper">
              <span className="ai-tag rag-tag">Generative AI + RAG</span>
            </div>
            
            <h3 className="font-display" style={{ margin: "0 0 4px 0", fontSize: "1.2rem" }}>
              💬 ผู้ช่วยวิเคราะห์ปฏิบัติงานเชิงลึก (Executive Copilot)
            </h3>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.85rem", margin: "0 0 16px 0" }}>
              คลิกเลือกหัวข้อคำถาม KPI ด้านล่างเพื่อวิเคราะห์ได้ทันที หรือพิมพ์หัวข้ออื่นที่ต้องการสอบถามเพิ่มเติม
            </p>

            {/* อัปเกรด: เพิ่ม Dropdown ค้นหาด่วนตามเกณฑ์ KPI สำหรับแชท */}
            <div className="quick-kpi-select-wrapper" style={{ marginBottom: 14 }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--red-dark)", display: "block", marginBottom: 6 }}>
                🎯 รายการวิเคราะห์ด่วนอ้างอิงตามดัชนี KPI (คลิกเลือกเพื่อถามทันที):
              </label>
              <select 
                className="kpi-quick-dropdown"
                onChange={(e) => {
                  if (e.target.value) {
                    handleSendCopilotQuery(e.target.value);
                    e.target.value = ""; // รีเซ็ตเพื่อเลือกใหม่ได้อีกรอบ
                  }
                }}
                style={{ width: "100%", padding: "10px", borderRadius: "var(--radius)", border: "1px solid var(--line)", background: "#fff", color: "var(--ink)", fontWeight: 600 }}
              >
                <option value="">-- คลิกเลือกหัวข้อคำถามดัชนี KPI --</option>
                {quickQuestions.map((sug, idx) => (
                  <option key={idx} value={sug.text}>{sug.label}</option>
                ))}
              </select>
            </div>

            {/* Dynamic Suggested Chips */}
            <div className="copilot-suggestions">
              {quickQuestions.map((sug, idx) => (
                <button 
                  key={idx}
                  type="button" 
                  className="suggestion-chip"
                  onClick={() => handleSendCopilotQuery(sug.text)}
                >
                  📍 {sug.label}
                </button>
              ))}
            </div>

            {/* Chat History Messages */}
            <div className="copilot-chat-box" id="copilot-chat-box">
              {copilotMessages.length === 0 && (
                <p className="chat-empty-state">เลือกรายการคำถามดัชนี KPI ด้านบน หรือทดลองพิมพ์เพื่อสนทนา...</p>
              )}
              {copilotMessages.map((msg, idx) => (
                <div key={idx} className={`chat-bubble ${msg.role}`}>
                  <div className="sender-name">{msg.role === "user" ? "👤 คุณ" : "🤖 Copilot"}</div>
                  <div className="bubble-text" style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                  
                  {/* Action buttons inside chat box if applicable */}
                  {msg.role === "assistant" && msg.hasDecision && msg.suggestedDecisions && (
                    <div className="copilot-inline-decision">
                      <p style={{ margin: "10px 0 6px 0", fontSize: "0.8rem", fontWeight: "bold" }}>🎯 สั่งการด่วนผ่านช่องแชท:</p>
                      <div className="inline-dec-buttons">
                        {msg.suggestedDecisions.map(btnText => (
                          <button
                            key={btnText}
                            type="button"
                            className="btn decision-btn inline-btn"
                            onClick={() => {
                              handleMakeDecision(
                                activeDeptId === "d-space" ? "P01" : 
                                activeDeptId === "d-clean" ? "C01" : 
                                activeDeptId === "d-security" ? "S01" : 
                                activeDeptId === "d-labor" ? "L01" : 
                                activeDeptId === "d-maintenance" ? "M01" :
                                activeDeptId === "d-specsec" ? "R01" : "K01", 
                                `[จากแชท] ${btnText}`
                              );
                              setCopilotMessages(prev => [
                                ...prev,
                                { role: "assistant", text: `✓ บันทึกข้อสั่งการอนุมัติของผู้บริหาร: "${btnText}" และสั่งจ่ายใบงานเรียบร้อยแล้ว` }
                              ]);
                            }}
                          >
                            {btnText}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {copilotLoading && (
                <div className="chat-bubble assistant loading-bubble">
                  <span>🤖 กำลังดึงข้อมูลจากระบบและสรุปการวิเคราะห์เชิงลึก...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="copilot-chat-input-bar">
              <input
                type="text"
                placeholder={`พิมพ์ถามรายละเอียดของดัชนี KPI...`}
                value={copilotQuery}
                onChange={(e) => setCopilotQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendCopilotQuery(); }}
                disabled={copilotLoading}
              />
              <button 
                type="button" 
                className="btn" 
                onClick={() => handleSendCopilotQuery()}
                disabled={copilotLoading}
              >
                ส่งคำถาม
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Panel: Decisions Audit Log */}
        <div className="exec-sidebar">
          <div className="card sidebar-audit-card">
            <div className="sidebar-header">
              <h3 className="font-display">📝 คำสั่งการผู้บริหารวันนี้</h3>
              {loggedDecisions.length > 0 && (
                <button 
                  className="btn secondary small-btn reset-log-btn"
                  onClick={handleClearDecisions}
                >
                  ล้างล็อก
                </button>
              )}
            </div>

            {loggedDecisions.length === 0 ? (
              <p className="empty-note" style={{ padding: "30px 10px", margin: 0 }}>
                ยังไม่มีการสั่งการหรือกดยืนยันคำสั่งอนุมัติใดๆ ในวันนี้
              </p>
            ) : (
              <div className="audit-timeline">
                {loggedDecisions.map((dec) => (
                  <div key={dec.id} className="audit-timeline-item">
                    <span className="audit-case-dot">Case {dec.caseId}</span>
                    <div className="audit-details">
                      <strong>สั่งคำอนุมัติ:</strong> &ldquo;{dec.decisionText}&rdquo;
                      <span className="audit-time">{dec.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* GAP 5: SMM BOARD BRIEFING PRINT/EXPORT MODAL */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div className="modal-backdrop">
          <div className="modal-content card">
            <div className="modal-header">
              <h2 className="font-display">📄 เอกสารสรุปข้อสั่งการและตัวชี้วัด (Board Briefing Memo)</h2>
              <button className="close-modal-btn" onClick={() => setShowExportModal(false)}>✕</button>
            </div>
            
            <div className="modal-body-printable" id="printable-memo">
              <div className="memo-top-brand">
                <span className="memo-brand-title">บันทึกข้อความภายใน ตลาดสี่มุมเมือง</span>
              </div>
              <table className="memo-meta-table">
                <tbody>
                  <tr>
                    <td><strong>จาก:</strong> ระบบสารสนเทศตัดสินใจอัจฉริยะ (Decision Intelligence)</td>
                    <td><strong>ถึง:</strong> คณะกรรมการบริหารงานตลาดสี่มุมเมือง</td>
                  </tr>
                  <tr>
                    <td><strong>วันที่รายงาน:</strong> {new Date().toLocaleDateString("th-TH")}</td>
                    <td><strong>ฝ่ายที่พิจารณา:</strong> ทุกฝ่ายงานความสอดคล้อง</td>
                  </tr>
                  <tr>
                    <td colSpan={2}><strong>เรื่อง:</strong> รายงานสรุปดัชนี KPI และประวัติคำอนุมัติข้อสั่งการเพื่อระบายปัญหาวิกฤต</td>
                  </tr>
                </tbody>
              </table>

              <div className="memo-section">
                <h4>1. สรุปสถานะเป้าหมาย KPI สัปดาห์นี้</h4>
                <p>ขณะนี้ระบบบันทึกความล้มเหลวหลุดเกณฑ์เป้าหมายในส่วนหลัก ได้แก่ สัดส่วนปนเปื้อนสารเคมีสะสมในผักใบ 5%, ขยะล้นลานผักสะสม Zone C (92%), คิวรถติดคอขวดสะสมหน้าประตูทางเข้า Gate 3 เกิน 5 นาที, รถลูกค้ารอลงสินค้านานเกิน 10 นาที, อัตราใช้ไฟฟ้าสะสมห้องแช่แข็ง A-01 พุ่ง 1.45 หน่วย และปัญหาแรงงาน/รปภ.เกิดเหตุฉุกเฉิน</p>
              </div>

              <div className="memo-section">
                <h4>2. ประวัติและผลลัพธ์การสั่งคำอนุมัตินโยบายในรอบวัน</h4>
                {loggedDecisions.length === 0 ? (
                  <p className="empty-note">ไม่มีการสั่งการอนุมัติใดๆ ในเซสชันนี้</p>
                ) : (
                  <table className="memo-decision-table">
                    <thead>
                      <tr>
                        <th>รหัสเคส</th>
                        <th>คำสั่งการที่อนุมัติเชิงนโยบาย</th>
                        <th>เวลาและผู้สั่งการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loggedDecisions.map((dec) => (
                        <tr key={dec.id}>
                          <td><strong>Case {dec.caseId}</strong></td>
                          <td>{dec.decisionText}</td>
                          <td>{dec.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              
              <div className="memo-sign-section">
                <div className="sign-placeholder">
                  <p>ลงนามผู้ประเมินสูงสุด</p>
                  <p style={{ marginTop: 40, borderBottom: "1.5px solid var(--ink)", width: 180, display: "inline-block" }}></p>
                  <p>(.........................................................)</p>
                  <p>คณะกรรมการบริหารงานตลาดสี่มุมเมือง</p>
                </div>
              </div>
            </div>

            <div className="modal-footer-actions">
              <button className="btn secondary" onClick={() => window.print()}>🖨️ พิมพ์รายงานราชการ (Print PDF)</button>
              <button className="btn" onClick={() => {
                alert("ระบบจำลอง: ได้ทำการส่งข้อมูลสรุปข้อสั่งการเข้าห้องแชท LINE OA ของทีมผู้จัดการตลาด เรียบร้อยแล้วครับ! 💬");
                setShowExportModal(false);
              }}>💬 ส่งข้อความแชร์เข้า LINE OA</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* Quick KPI selector styles */
        .kpi-quick-dropdown {
          border: 1.5px solid var(--red-dark);
          transition: all 0.2s ease;
        }
        .kpi-quick-dropdown:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(125,10,14,0.15);
        }

        /* Dept Switcher Tabs styling */
        .dept-tabs-container {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          border-bottom: 2px solid var(--line);
          padding-bottom: 12px;
        }
        
        .dept-tab-btn:hover {
          background: var(--paper-raised) !important;
          color: var(--ink) !important;
        }
        .dept-tab-btn.active {
          background: var(--ink) !important;
          color: var(--paper) !important;
          border-color: var(--ink) !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.12);
        }

        /* KPI Metrics Grid */
        .kpi-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .kpi-metric-card {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 16px;
          position: relative;
        }
        .kpi-badge {
          position: absolute;
          top: 14px;
          right: 14px;
          font-size: 0.65rem;
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 99px;
          text-transform: uppercase;
        }
        .kpi-label {
          font-size: 0.85rem;
          color: var(--ink-soft);
          margin-bottom: 6px;
        }
        .kpi-values {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .current-val {
          font-size: 1.8rem;
          font-weight: bold;
          font-family: var(--font-display);
        }
        .target-val {
          font-size: 0.8rem;
          color: var(--ink-soft);
        }

        /* KPI status colors */
        .kpi-state-pass {
          border-left: 5px solid var(--green);
        }
        .kpi-state-pass .kpi-badge {
          background: var(--green-soft);
          color: var(--green);
        }
        .kpi-state-pass .current-val {
          color: var(--green);
        }
        
        .kpi-state-warning {
          border-left: 5px solid var(--gold);
        }
        .kpi-state-warning .kpi-badge {
          background: var(--gold-soft);
          color: var(--gold);
        }
        .kpi-state-warning .current-val {
          color: var(--gold);
        }

        .kpi-state-alert {
          border-left: 5px solid var(--red);
        }
        .kpi-state-alert .kpi-badge {
          background: var(--red-soft);
          color: var(--red);
        }
        .kpi-state-alert .current-val {
          color: var(--red);
        }

        /* GAP 1: Historical Trend Table CSS */
        .trend-table-wrapper {
          overflow-x: auto;
        }
        .trend-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
          margin-top: 10px;
        }
        .trend-table th {
          background: #f8fafc;
          border-bottom: 2px solid var(--line);
          padding: 10px;
          text-align: left;
          font-weight: 700;
        }
        .trend-table td {
          border-bottom: 1px solid var(--line);
          padding: 10px;
        }
        .trend-indicator-badge {
          font-size: 0.72rem;
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 99px;
        }
        .trend-indicator-badge.pass { background: var(--green-soft); color: var(--green); }
        .trend-indicator-badge.warning { background: var(--gold-soft); color: var(--gold); }
        .trend-indicator-badge.alert { background: var(--red-soft); color: var(--red); }

        /* GAP 4: Workflow Progress Tracker CSS */
        .workflow-tracker-bar {
          background: #f8fafc;
          border: 1px solid var(--line);
          padding: 10px 14px;
          border-radius: var(--radius);
          margin: -10px 0 20px 0;
          font-size: 0.82rem;
          display: flex;
          align-items: center;
          gap: 10px;
          border-left: 4px solid var(--red);
        }
        .workflow-tracker-bar.completed {
          background: var(--green-soft);
          border-color: var(--green);
          border-left-color: var(--green);
          color: #234f32;
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          background: var(--red);
          border-radius: 99px;
          animation: pulse 1.5s infinite;
        }
        .workflow-tracker-bar.completed .pulse-dot {
          background: var(--green);
          animation: none;
        }
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }

        /* GAP 5: Export Modal Layout */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
        }
        .modal-content {
          width: 100%;
          max-width: 680px;
          max-height: 90vh;
          overflow-y: auto;
          background: white;
          padding: 28px !important;
          border-top: 5px solid var(--red-dark) !important;
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid var(--line);
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--red-dark);
        }
        .close-modal-btn {
          background: transparent;
          border: none;
          font-size: 1.4rem;
          cursor: pointer;
          color: var(--ink-soft);
        }
        .modal-footer-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          border-top: 1px solid var(--line);
          padding-top: 16px;
        }

        /* Printable SMM board memo styling */
        .memo-top-brand {
          border-bottom: 2.5px double var(--ink);
          text-align: center;
          padding-bottom: 8px;
          margin-bottom: 16px;
        }
        .memo-brand-title {
          font-family: var(--font-display);
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--red-dark);
        }
        .memo-meta-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
          margin-bottom: 20px;
        }
        .memo-meta-table td {
          padding: 6px 0;
          border-bottom: 1px dashed var(--line);
        }
        .memo-section {
          margin-bottom: 20px;
        }
        .memo-section h4 {
          margin: 0 0 6px 0;
          font-size: 0.95rem;
          color: var(--red-dark);
          border-left: 3px solid var(--red);
          padding-left: 8px;
        }
        .memo-section p {
          font-size: 0.88rem;
          line-height: 1.5;
          margin: 0;
        }
        .memo-decision-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
          margin-top: 8px;
        }
        .memo-decision-table th {
          background: #f8fafc;
          padding: 8px;
          border: 1px solid var(--line);
          text-align: left;
        }
        .memo-decision-table td {
          padding: 8px;
          border: 1px solid var(--line);
        }
        .memo-sign-section {
          display: flex;
          justify-content: flex-end;
          margin-top: 40px;
          text-align: center;
          font-size: 0.85rem;
        }

        /* Printable media queries CSS override */
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-memo, #printable-memo * {
            visibility: visible;
          }
          #printable-memo {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
          }
        }

        /* Executive Page layout */
        .briefing-dept-sub {
          font-size: 0.85rem;
          background: var(--gold-soft);
          color: #7d5918;
          padding: 3px 10px;
          border-radius: var(--radius);
          display: inline-block;
          margin-bottom: 12px;
          font-weight: 600;
        }

        .executive-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 1000px) {
          .executive-grid {
            grid-template-columns: 1fr;
          }
        }

        .exec-main-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .exec-sidebar {
          position: sticky;
          top: 20px;
        }

        /* Briefing panel */
        .briefing-panel {
          border-left: 5px solid var(--ink);
          background: #fdfdf9;
        }
        .briefing-action-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-top: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .empty-briefing-prompt {
          text-align: center;
          padding: 40px 10px;
          border: 1px dashed var(--line);
          border-radius: var(--radius);
          background: var(--paper);
          color: var(--ink-soft);
        }
        .briefing-icon {
          font-size: 2.2rem;
          display: block;
          margin-bottom: 8px;
        }
        .briefing-todo-list {
          list-style: none;
          padding: 0;
          margin: 14px 0 0 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .briefing-todo-list li {
          display: flex;
          gap: 12px;
          background: var(--paper);
          border: 1px solid var(--line);
          padding: 12px 14px;
          border-radius: var(--radius);
          align-items: flex-start;
        }
        .briefing-todo-list .bullet {
          font-size: 1.1rem;
        }
        .todo-item-desc {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          font-size: 0.9rem;
          flex-wrap: wrap;
          gap: 10px;
        }
        .jump-link-btn {
          background: transparent;
          border: none;
          color: var(--gold);
          font-weight: 700;
          cursor: pointer;
          font-size: 0.85rem;
          padding: 0;
        }
        .jump-link-btn:hover {
          text-decoration: underline;
        }

        /* Copilot panel chat ui */
        .copilot-panel {
          border-left: 5px solid #2471a3;
        }
        .rag-tag {
          background: #2471a3 !important;
        }
        .copilot-suggestions {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .suggestion-chip {
          background: #fff;
          border: 1px solid var(--line);
          padding: 6px 12px;
          font-size: 0.78rem;
          border-radius: 99px;
          cursor: pointer;
          color: var(--ink-soft);
          transition: all 0.15s ease;
        }
        .suggestion-chip:hover {
          background: #ebf5fb;
          border-color: #2980b9;
          color: #2980b9;
        }
        .copilot-chat-box {
          height: 320px;
          border: 1px solid var(--line);
          background: var(--paper);
          border-radius: var(--radius);
          padding: 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 14px;
        }
        .chat-empty-state {
          color: var(--ink-soft);
          text-align: center;
          font-size: 0.85rem;
          margin-top: 130px;
        }
        .chat-bubble {
          max-width: 85%;
          padding: 10px 14px;
          border-radius: var(--radius);
          font-size: 0.88rem;
          line-height: 1.5;
        }
        .chat-bubble.user {
          align-self: flex-end;
          background: var(--ink);
          color: var(--paper);
          border-bottom-right-radius: 0;
        }
        .chat-bubble.assistant {
          align-self: flex-start;
          background: #fff;
          color: var(--ink);
          border: 1px solid var(--line);
          border-bottom-left-radius: 0;
        }
        .sender-name {
          font-size: 0.68rem;
          font-weight: 700;
          margin-bottom: 4px;
          opacity: 0.8;
        }
        .loading-bubble {
          font-size: 0.82rem;
          color: var(--ink-soft);
          background: transparent !important;
          border: none !important;
        }
        .copilot-chat-input-bar {
          display: flex;
          gap: 10px;
        }
        .copilot-chat-input-bar input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: var(--radius);
          font-size: 0.9rem;
        }
        .copilot-inline-decision {
          background: var(--paper);
          border: 1px solid var(--line);
          padding: 10px;
          border-radius: var(--radius);
          margin-top: 8px;
        }
        .inline-dec-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .inline-btn {
          font-size: 0.78rem !important;
          padding: 6px 12px !important;
          background: #fff;
        }

        /* Sidebar Audit logs styling */
        .sidebar-audit-card {
          border-top: 4px solid var(--ink);
        }
        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid var(--ink);
          padding-bottom: 8px;
          margin-bottom: 14px;
        }
        .sidebar-header h3 {
          margin: 0;
          font-size: 1.05rem;
        }
        .reset-log-btn {
          font-size: 0.72rem !important;
          padding: 4px 8px !important;
        }
        .audit-timeline {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .audit-timeline-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .audit-case-dot {
          background: var(--gold-soft);
          color: #6b4c14;
          font-size: 0.68rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: var(--radius);
          white-space: nowrap;
        }
        .audit-details {
          display: flex;
          flex-direction: column;
          font-size: 0.85rem;
          color: var(--ink);
          line-height: 1.4;
        }
        .audit-time {
          font-size: 0.72rem;
          color: var(--ink-soft);
          margin-top: 2px;
        }
      `}</style>
    </Layout>
  );
}
