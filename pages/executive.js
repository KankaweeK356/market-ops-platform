import { useEffect, useState, useMemo } from "react";
import Layout from "../components/Layout";
import DecisionCard from "../components/DecisionCard";
import { getReports, computeStats, getExecutiveData, getExecutiveDecisions, logExecutiveDecision, clearExecutiveDecisions, resolveIncident, resetToSeed } from "../lib/storage";
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
  // จัดการแก้ไขเคสสดด้วยการตัดสินใจของผู้บริหาร (Base on data input)
  function handleResolveIncident(submissionId, caseId, decisionText) {
    const record = logExecutiveDecision(caseId, decisionText);
    setLoggedDecisions(prev => [...prev, record]);
    
    // ตั้งค่าสถานะเวิร์กโฟลว์ว่า "สั่งการแล้ว"
    setWorkflowStatus(prev => ({
      ...prev,
      [submissionId]: "ordered"
    }));

    // หลังจากนั้น 2 วินาที ปรับปรุงข้อมูลจริงในฐานข้อมูลและคำนวณ KPI ใหม่สด!
    setTimeout(() => {
      resolveIncident(submissionId, decisionText);
      loadAllData(); // รีโหลดสถิติและแบบฟอร์มเพื่ออัปเดตเปอร์เซ็นต์ KPI และเอาการ์ดออก
      setWorkflowStatus(prev => ({
        ...prev,
        [submissionId]: "completed"
      }));
    }, 2000);
  }

  // ล้างประวัติการตัดสินใจและรีเซ็ตฐานข้อมูลทั้งหมด
  function handleClearDecisions() {
    if (confirm("ต้องการเคลียร์ประวัติและรีเซ็ตข้อมูลรายงานทั้งหมดกลับไปเป็นค่าเริ่มต้นใช่หรือไม่?")) {
      resetToSeed();
      clearExecutiveDecisions();
      loadAllData();
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

  // ดึงรายการประเด็นวิกฤต (Incidents) ของฝ่ายนี้ที่ยังไม่ได้แก้ไขแบบไดนามิกจากฐานข้อมูล
  const activeIncidents = useMemo(() => {
    return reports.filter(r => 
      r.departmentId === activeDeptId && 
      (r.derivedStatus === "ต้องติดตาม" || r.derivedStatus === "เร่งด่วน") &&
      !r.resolved
    );
  }, [reports, activeDeptId]);

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
          {/* รายการเหตุการณ์วิกฤตที่ต้องอนุมัติการตัดสินใจรายฝ่ายงาน (Dynamic Case Cards) */}
          {/* ========================================================================= */}
          <div className="dept-cases-list">
            {activeIncidents.length === 0 ? (
              <div className="card" style={{ padding: "40px", textAlign: "center", background: "rgba(46, 204, 113, 0.05)", border: "1px dashed var(--green)", borderRadius: "12px" }}>
                <span style={{ fontSize: "3rem", display: "block", marginBottom: "16px" }}>🟢</span>
                <h3 style={{ margin: "0 0 8px 0", fontFamily: "var(--font-display)", color: "var(--green)" }}>การทำงานของฝ่ายเป็นปกติเรียบร้อย</h3>
                <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.95rem" }}>
                  ไม่มีเคสข้อร้องเรียนหรือดัชนีชี้วัดหลุดเป้าหมายที่ต้องการอนุมัติเร่งด่วนในขณะนี้
                </p>
              </div>
            ) : (
              activeIncidents.map((inc) => {
                let aiLabel = "Operational Violation";
                let title = "พบเกณฑ์ดัชนีหลุดค่าเป้าหมาย";
                let what = <div>เกิดข้อผิดพลาดในการดึงข้อมูล</div>;
                let why = <div>ตรวจสอบตามนโยบายระดับคุณภาพของตลาดสี่มุมเมือง</div>;
                let decisions = ["สั่งการตรวจสอบด่วน", "แจ้งเตือนแผงค้า"];
                let caseId = inc.id.slice(-4).toUpperCase();

                const findAns = (qId) => {
                  const ans = inc.answers?.find(a => a.questionId === qId);
                  return ans ? ans.value : null;
                };

                if (inc.formTemplateId === "tmpl-space-occupancy") {
                  const total = Number(findAns("totalStalls") || 100);
                  const occupied = Number(findAns("occupiedStalls") || 80);
                  const rate = total > 0 ? ((occupied / total) * 100).toFixed(1) : "0.0";
                  aiLabel = "Space Occupancy";
                  title = `อัตราการเช่าแผงค้ารวม โซน ${inc.zone || "ทั่วไป"}`;
                  what = (
                    <div>
                      ตรวจเช็คข้อมูลสัญญาเช่ามีแผงปล่อยเช่าได้จริงเพียง <strong>{occupied} แผง</strong> จากทั้งหมด <strong>{total} แผง</strong> คิดเป็นอัตราเช่าพื้นที่การค้า <strong>{rate}%</strong>
                    </div>
                  );
                  why = (
                    <div>
                      ดัชนีควบคุมพื้นที่: <strong>ต้องมีอัตราครองเช่าแผงค้า &gt;= 90%</strong> เพื่อรักษาความคล่องตัวของตลาดค้าส่ง
                    </div>
                  );
                  decisions = [
                    "สั่งลดราคาค่าเช่าแผง 20% สำหรับแผงว่างรายใหม่",
                    "สั่งจัดบูธกิจกรรมส่งเสริมการขายเพื่อหาผู้ค้ารายย่อย",
                    "จำกัดพื้นที่แบ่งโซนนิ่งผักใหม่เพิ่มช่องว่างสำหรับรถขนถ่าย"
                  ];
                } else if (inc.formTemplateId === "tmpl-space-toxin") {
                  const prodType = findAns("productType") || "ผักใบ (Leafy Greens)";
                  const stall = findAns("stallCode") || "C-15";
                  const result = findAns("testResult") || "พบสารเคมีปนเปื้อน (Not Pass)";
                  aiLabel = "Chemical & Toxin";
                  title = `ตรวจสารเคมีปนเปื้อนตกค้างในพืชผัก แผงค้า ${stall}`;
                  what = (
                    <div>
                      สุ่มตรวจพบสารเคมีปนเปื้อนตกค้างในพืชผักประเภท <strong>{prodType}</strong> จากแผงค้า <strong>{stall}</strong> ผลการตรวจคือ <strong style={{ color: "var(--red-dark)" }}>{result}</strong>
                    </div>
                  );
                  why = (
                    <div>
                      เกณฑ์เฝ้าระวังสารพิษ: <strong>ผลผลิตต้องปลอดภัยปลอดสารตกค้าง 100%</strong> เพื่อพยุงความน่าเชื่อถือตลาดระดับสากล
                    </div>
                  );
                  decisions = [
                    "สั่งแผงค้าที่ตรวจพบสารเคมีงดจำหน่ายเป็นเวลา 3 วัน เพื่อคัดสินค้าทิ้ง",
                    "ออกจดหมายแจ้งเตือนสถานเบาและสั่งให้สุ่มตรวจซ้ำในวันถัดไป",
                    "ยึดและทำลายสินค้าล๊อตนี้ทั้งหมดพร้อมปรับเงินผู้ค้า 5,000 บาท"
                  ];
                } else if (inc.formTemplateId === "tmpl-clean-bins") {
                  const maxCap = Number(findAns("maxCapacityKg") || 1000);
                  const weight = Number(findAns("currentWeightKg") || 900);
                  const rate = maxCap > 0 ? ((weight / maxCap) * 100).toFixed(1) : "0.0";
                  aiLabel = "Waste Management";
                  title = `ระดับปริมาณขยะอินทรีย์ล้นถังขยะสะสมวิกฤต โซน ${inc.zone || "ทั่วไป"}`;
                  what = (
                    <div>
                      ปริมาณขยะอินทรีย์เปียกชั่งน้ำหนักสะสมสูงถึง <strong>{weight} กก.</strong> จากความจุสูงสุด <strong>{maxCap} กก.</strong> คิดเป็น <strong>{rate}%</strong>
                    </div>
                  );
                  why = (
                    <div>
                      การควบคุมสิ่งแวดล้อม: <strong>ปริมาณขยะสะสมห้ามเกิน 80%</strong> เพื่อไม่ให้เกิดกลิ่นเน่าเสียสะสมและปัญหาฝูงแมลงวันรบกวนผู้ซื้อขาย
                    </div>
                  );
                  decisions = [
                    "สั่งรถตักขยะเบี่ยงรอบจากโซนอื่นเข้ามาเคลียร์ถังล้นลานผักด่วน",
                    "จ้างพ่นจุลินทรีย์ชีวภาพและน้ำหมักช่วยย่อยและดับกลิ่นคาวสะสม",
                    "เพิ่มรอบรถขยะเข้าตักสี่มุมเมืองเป็นวันละ 3 รอบด่วน"
                  ];
                } else if (inc.formTemplateId === "tmpl-clean-water") {
                  const cod = Number(findAns("codLevel") || 160);
                  aiLabel = "Water Treatment";
                  title = `ดัชนีคุณภาพน้ำเสีย COD เกินข้อกำหนดของกรมควบคุมมลพิษ`;
                  what = (
                    <div>
                      ผลวิเคราะห์ตัวอย่างน้ำทิ้งจากบ่อบำบัดน้ำเสียหลัก มีค่าความสกปรก COD สูงถึง <strong>{cod} mg/L</strong> (หลุดเกณฑ์เป้าหมายมาตรฐาน)
                    </div>
                  );
                  why = (
                    <div>
                      มาตรฐานคุณภาพสิ่งแวดล้อมตลาด: <strong>ค่าน้ำเสียต้องต่ำกว่า 120 mg/L</strong> ก่อนระบายสู่ระบบสาธารณะเพื่อเลี่ยงค่าปรับทางกฎหมาย
                    </div>
                  );
                  decisions = [
                    "อนุมัติเปิดระบบปั๊มกรองน้ำระบายความร้อนบ่อบำบัดสำรองสลับรันใช้งาน",
                    "สั่งเติมสารสกัดธรรมชาติและจุลินทรีย์เร่งกระตุ้นตกตะกอนด่วน",
                    "ส่งทีมช่างเทคนิคมุดอุโมงค์ล้างไส้กรองและคราบไขมันตกค้างในระบบ"
                  ];
                } else if (inc.formTemplateId === "tmpl-clean-complaint") {
                  const mins = Number(findAns("minutesToClear") || 45);
                  aiLabel = "Cleanliness SLA";
                  title = `งานจัดระเบียบและฉีดล้างสิ่งปฏิกูลตามแผงค้าล่าช้าเกินเวลา SLA`;
                  what = (
                    <div>
                      ได้รับแจ้งข้อร้องเรียนคราบน้ำสกปรกสะสม แต่ช่างใช้เวลาดำเนินการช้าจนสะสมแตะ <strong>{mins} นาที</strong>
                    </div>
                  );
                  why = (
                    <div>
                      การปิดงานตามข้อร้องเรียน: <strong>ต้องทำความสะอาดเสร็จสิ้นใน 30 นาที</strong> (SLA ต่ำสุดที่ 95% แต่อัตรางานทำสำเร็จตกลงเหลือ 88%)
                    </div>
                  );
                  decisions = [
                    "สั่งทีมเคลื่อนที่เร็วเข้าฉีดล้างลานแผงค้านั้น in 10 นาทีนี้ด่วน",
                    "ตักเตือนและหักเงินรางวัลผู้ให้บริการซัพพลายเออร์ที่ปิดงานช้าเกิน SLA",
                    "เสนอปรับเวลา SLA ขอบเขตความสะอาดเป็น 40 นาทีชั่วคราวในช่วงหน้าฝน"
                  ];
                } else if (inc.formTemplateId === "tmpl-sec-traffic") {
                  const mins = Number(findAns("trafficWaitMinutes") || 15);
                  aiLabel = "Traffic Gate Control";
                  title = `จราจรรถคอขวดสะสมบริเวณหน้าด่านทางเข้าหลัก โซน ${inc.zone || "ทั่วไป"}`;
                  what = (
                    <div>
                      รถขนส่งและผู้ซื้อติดขัดข้ามสะพานคอขวดด่าน Gate 3 ใช้เวลารอคอยเฉลี่ยสะสม <strong>{mins} นาที</strong>
                    </div>
                  );
                  why = (
                    <div>
                      ข้อบังคับการไหลจราจร: <strong>รถติดคอขวดหน้าประตูห้ามเกิน 5 นาที</strong> เพื่อระบายพืชผลการเกษตรให้สดใหม่รวดเร็ว
                    </div>
                  );
                  decisions = [
                    "สั่งเปิดช่องประตูสำรองทางเข้าเพิ่มและใช้ระบบจ่ายบัตรกึ่งอัตโนมัติด่วน",
                    "ส่ง รปภ. โบกห้ามรถบรรทุกขนาดใหญ่จอดแช่เลนกระจายสินค้าหน้าด่านหลัก",
                    "จำกัดสิทธิ์เวลารถเทียบของชั่วคราวในช่วงกะเวลาวิกฤต"
                  ];
                } else if (inc.formTemplateId === "tmpl-sec-routing") {
                  const round = findAns("routingRound") || "รอบที่ 2 (11.00 - 15.00 น.)";
                  const mins = Number(findAns("truckRoutingMinutes") || 42);
                  aiLabel = "Truck Routing";
                  title = `ระยะเวลาจัดรถเข้าชานชาลาอาคารผัก ${round} ล่าช้าเกินเกณฑ์`;
                  what = (
                    <div>
                      ตรวจเช็คช่วงเวลาเดินรถ <strong>{round}</strong> ใช้เวลาจัดจอดเทียบเฉลี่ยสะสม <strong>{mins} นาทีต่อรอบ</strong>
                    </div>
                  );
                  why = (
                    <div>
                      ข้อกำหนดระเบียบเดินรถ: <strong>เวลาจัดจอดเทียบตู้ต้องต่ำกว่า 40 นาที</strong> เพื่อคิวรถคอกขนส่งไม่สับสนเบียดเสียดกีดขวาง
                    </div>
                  );
                  decisions = [
                    "สั่งระดมกำลัง รปภ. เสริมตรงโค้งทางเลี้ยวจัดคิวรถผักสลับเข้าเทียบด่วน",
                    "จัดสรรรอบเวลาเข้าเทียบชานชาลาแยกตามประเภทและแผงเป้าหมาย",
                    "เปิดช่องทางเดินรถเสริมรอบนอกเพื่อแบ่งเบาปัญหารถคอขวด"
                  ];
                } else if (inc.formTemplateId === "tmpl-sec-parking") {
                  const plate = findAns("licensePlate") || "70-4567";
                  aiLabel = "Parking Violation";
                  title = `พบรถยนต์ส่วนบุคคลแอบลักลอบจอดแช่ในพื้นที่ลานจอดจำหน่ายสินค้า โซน ${inc.zone || "ทั่วไป"}`;
                  what = (
                    <div>
                      ตรวจพบรถยนต์แอบลักลอบจอดทิ้งไม่ซื้อจริงสะสมนานเกิน 3 ชม. หมายเลขทะเบียนรถ <strong>{plate}</strong>
                    </div>
                  );
                  why = (
                    <div>
                      มาตรการจอดรถตลาด: <strong>ต้องจัดการพวกลักลอบจอดสะสมและคืนความสะดวกผู้ซื้อจริง</strong> (สัดส่วนปิดงานสำเร็จลดเหลือ 82%)
                    </div>
                  );
                  decisions = [
                    `สั่ง รปภ. ล็อกล้อรถทะเบียน ${plate} ทันทีและเปรียบเทียบปรับ 500 บาท`,
                    `แปะใบสั่งเตือนระเบียบจอดหน้ารถทะเบียน ${plate} และให้บันทึกประวัติ`,
                    `ปล่อยผ่านเป็นกรณีพิเศษเนื่องจากเป็นผู้ค้าส่งส่งมอบสินค้าด่วน`
                  ];
                } else if (inc.formTemplateId === "tmpl-space-fines") {
                  const violType = findAns("violationType") || "วางของกีดขวางทางเดิน (Stall Obstruction)";
                  const amount = Number(findAns("fineAmount") || 0);
                  const violator = findAns("violatorName") || "แผงป้าศรี (Zone A-08)";
                  aiLabel = "Fine Violation";
                  title = `มีคำสั่งเปรียบเทียบปรับยอดสูงจากกรณีทำผิดกฎระเบียบแผงค้า`;
                  what = (
                    <div>
                      ตรวจพบกรณี <strong>{violType}</strong> โดยผู้กระทำความผิด <strong>{violator}</strong> มียอดสั่งปรับสะสมสูงถึง <strong>{amount.toLocaleString()} บาท</strong>
                    </div>
                  );
                  why = (
                    <div>
                      การควบคุมระเบียบแผงค้า: <strong>ยอดปรับสะสมรายเคสต้องไม่เกิน 1,000 บาท</strong> หากสูงเกินเกณฑ์แสดงว่าเป็นการทำผิดระเบียบซ้ำซากที่ต้องการการตักเตือนระดับบริหาร
                    </div>
                  );
                  decisions = [
                    "สั่งการระงับการเปิดขายชั่วคราว 1 วัน พร้อมเรียกตักเตือน",
                    "สั่งลดหย่อนผ่อนปรนค่าปรับกึ่งหนึ่งหากยินยอมรื้อถอนทันที",
                    "อนุมัติส่งทีม รปภ. ร่วมจัดระเบียบและออกหนังสือทัณฑ์บนทางการ"
                  ];
                } else if (inc.formTemplateId === "tmpl-lab-unload") {
                  const mins = Number(findAns("customerWaitMinutes") || 22);
                  aiLabel = "Labor Load Service";
                  title = `ลูกค้ารอคอยแรงงานโหลดลงของนานสุดเกินกำหนดเป้าหมาย`;
                  what = (
                    <div>
                      ผู้ซื้อขนส่งสินค้าแจ้งร้องเรียนเรื่องทีมแรงงานช่วยลงของจัดส่งคิวยาว รอนานถึง <strong>{mins} นาที</strong>
                    </div>
                  );
                  why = (
                    <div>
                      ข้อกำหนดมาตรฐานบริการ: <strong>ลูกค้ารอคิวลงของต้องไม่เกิน 10 นาที (SLA &gt; 90%)</strong> เพื่อไม่ให้แผงค้าและรถค้างสะสม
                    </div>
                  );
                  decisions = [
                    "สั่งจ่ายเบี้ยแรงเสริมกะเช้าให้พนักงานจัดพอร์ทลงของเพิ่มคู่อำนวยความสะดวก",
                    "ปรับเปลี่ยนแผนจำกัดรอบเวลาจอดจองลงของเทียบด่วนห้ามเกิน 30 นาทีต่อคัน",
                    "โยกย้ายจุดคัดถ่ายสินค้าของเบาแยกออกจากลานสินค้าหนักคลังหลัก"
                  ];
                } else if (inc.formTemplateId === "tmpl-maint-pm") {
                  const id = findAns("machineId") || "GEN-01";
                  const mins = Number(findAns("breakdownMinutes") || 120);
                  aiLabel = "Utilities Breakdown";
                  title = `เครื่องจ่ายกระแสไฟฟ้าหลักเกิดระบบขัดข้องสะสม (Breakdown)`;
                  what = (
                    <div>
                      รายงานตรวจเช็คพบสัญญาณขัดข้องทางไฟฟ้าจากอุปกรณ์ <strong>{id}</strong> อุณหภูมิพุ่งสูงสะสมเป็นเวลา <strong>{mins} นาที</strong>
                    </div>
                  );
                  why = (
                    <div>
                      ข้อรับประกันสาธารณูปโภค: <strong>เวลาชำรุดเสียหายสะสมของเครื่องปั่นไฟต้องเป็น 0 นาที</strong> เพื่อคุมไม่ให้ระบบตลาดดับมืด
                    </div>
                  );
                  decisions = [
                    `อนุมัติทีมวิศวกรซ่อมใหญ่เปลี่ยนพัดลมความร้อน GEN-01 เป็นกรณีฉุกเฉิน`,
                    `สลับวงจรจ่ายกระแสไฟฟ้าไปยังเครื่องจักร Gen-02 สำรองจ่ายไฟโซนสอง`,
                    `ปรับลดกำลังผลิตลงครึ่งหนึ่งชั่วคราวเพื่อรักษาระดับอุณหภูมิห้องจ่ายไฟ`
                  ];
                } else if (inc.formTemplateId === "tmpl-maint-sla") {
                  const id = findAns("requestId") || "RQ-1045";
                  const mins = Number(findAns("minutesToComplete") || 90);
                  aiLabel = "Maintenance SLA";
                  title = `ใบงานแจ้งซ่อมระบบประปาไฟฟ้าภายในแผงค้าล่าช้าเกินเวลา SLA`;
                  what = (
                    <div>
                      คำร้องใบแจ้งซ่อมรหัส <strong>{id}</strong> ซ่อมแก้ไขไฟฟ้าชำรุดใช้เวลารวมสูงถึง <strong>{mins} นาที</strong>
                    </div>
                  );
                  why = (
                    <div>
                      กรอบเวลาปิดงานบำรุงรักษา: <strong>ต้องแก้ไขเรียบร้อยใน 60 นาที (SLA Met &gt; 95%)</strong> เพื่อป้องกันการลุกไหม้อัคคีภัย
                    </div>
                  );
                  decisions = [
                    "สั่งอนุมัติจัดงบสต็อกอุปกรณ์ตัดจ่ายกระแสไฟสำรองจัดเก็บไว้คลังด่วน",
                    "สั่งการปรับเวรหมุนช่างเทคนิคประจำการกะกลางคืนเพิ่มเติม 2 คน",
                    "อนุมัติขยายระยะเวลา SLA ระบบสายเคเบิลใต้ดินชั่วคราวเป็น 180 นาที"
                  ];
                } else if (inc.formTemplateId === "tmpl-specsec-emergency") {
                  const count = Number(findAns("emergencyIncidents") || 2);
                  aiLabel = "Specsec Emergency";
                  title = `มีเหตุทะเลาะวิวาทหรือเหตุลักทรัพย์เกิดสะสมในรอบกะของฝ่าย รปภ.`;
                  what = (
                    <div>
                      รายงานความไม่สงบพบอุบัติเหตุชนแล้วหนี หรือคดีทะเลาะวิวาทแรงงาน สะสมรวม <strong>{count} ครั้ง</strong> ในสัปดาห์นี้
                    </div>
                  );
                  why = (
                    <div>
                      มาตรการความสงบในพื้นที่: <strong>อุบัติเหตุความรุนแรงและลักขโมยต้องเป็น 0 ครั้ง</strong> เพื่อมาตรฐานความปลอดภัย
                    </div>
                  );
                  decisions = [
                    "สั่ง รปภ. ตั้งบูธจุดตรวจสกัดพิเศษลานจอดหลักตรวจคนเข้าออก 24 ชม.",
                    "ออกใบสั่งปรับผู้ค้าหรือแรงงานคู่กรณีที่ก่อเหตุ 5,000 บาท และส่งดำเนินคดี",
                    "ติดตั้งระบบไฟส่องสว่างเสริมบริเวณหัวโค้งลานจอดและแผงอับมุมด่วน"
                  ];
                } else if (inc.formTemplateId === "tmpl-specsec-drugs") {
                  const positive = Number(findAns("positiveDrugCount") || 2);
                  const total = Number(findAns("totalTested") || 50);
                  aiLabel = "Drug Control";
                  title = `ผลการสุ่มตรวจวินัยปัสสาวะแรงงานต่างด้าวพบเป็นผลบวก (ฉี่สีม่วง)`;
                  what = (
                    <div>
                      สุ่มตรวจสารเสพติดแรงงานขนถ่ายสะสมรวม <strong>{total} ราย</strong> พบปัสสาวะมีสีม่วงสะสมจำนวน <strong>{positive} ราย</strong>
                    </div>
                  );
                  why = (
                    <div>
                      ระเบียบความมั่นคงตลาด: <strong>ตรวจพบสารเสพติดต้องเท่ากับ 0 (Zero Tolerance)</strong> เพื่อพยุงมาตรฐานการควบคุมแรงงานต่างชาติ
                    </div>
                  );
                  decisions = [
                    "สั่งยกเลิกเสื้อสิทธิ์สีม่วงใบผ่านตลาดและส่งตัวดำเนินคดีตำรวจทันที",
                    "สั่งเตือนเป็นจดหมายและภาคทัณฑ์แผงค้านายจ้างที่รับแรงงานโดยไม่เช็คประวัติ",
                    "สั่งปูพรมระดมทีม รปภ. สุ่มกวาดตรวจปัสสาวะแรงงานทั้งคลังในสัปดาห์ถัดไป"
                  ];
                } else if (inc.formTemplateId === "tmpl-cold-power") {
                  const kwh = Number(findAns("powerKwh") || 1.45);
                  aiLabel = "Coldroom Energy";
                  title = `ห้องเย็นจัดเก็บแช่สินค้าสิ้นเปลืองพลังงานไฟฟ้าเกินค่าควบคุมปกติ`;
                  what = (
                    <div>
                      วิเคราะห์อุณหภูมิห้องแช่แข็งหลักทำงานหนัก อัตราใช้พลังงานไฟฟ้าพุ่ง <strong>{kwh} หน่วย/ตร.ม./วัน</strong>
                    </div>
                  );
                  why = (
                    <div>
                      เกณฑ์การบริโภคพลังงาน: <strong>อัตราการกินกระแสไฟห้ามเกิน 1.2 หน่วย/ตร.ม./วัน</strong> เพื่อประหยัดต้นทุนดำเนินงานของตลาด
                    </div>
                  );
                  decisions = [
                    "สั่งวิศวกรซ่อมปะเก็นและยางขอบประตูคลังแช่ทันทีเพื่อกันความเย็นรั่วไหล",
                    "ปรับเปลี่ยนรอบละลายน้ำแข็งเครื่องเย็น (Defrost) ช่วงเวลา 00:00 - 04:00 (Off-Peak)",
                    "อนุมัติโครงการติดตั้งม่านพลาสติกริ้วดักลมร้อนหน้าประตูเข้าคลังแช่แข็ง"
                  ];
                }

                return (
                  <div key={inc.id} className="incident-card-wrapper" style={{ marginBottom: "20px" }}>
                    <DecisionCard
                      caseId={caseId}
                      aiLabel={aiLabel}
                      title={title}
                      what={what}
                      why={why}
                      decisions={decisions}
                      onDecision={(cId, decTxt) => handleResolveIncident(inc.id, cId, decTxt)}
                      loggedDecision={
                        inc.resolved ? { decisionText: inc.resolution, timestamp: "แก้ไขแล้ว" } : getDecisionForCase(caseId)
                      }
                    />

                    {workflowStatus[inc.id] && (
                      <div className={`workflow-tracker-bar ${workflowStatus[inc.id]}`} style={{ marginTop: "-8px", borderRadius: "0 0 12px 12px" }}>
                        <span className="pulse-dot"></span>
                        <span>สถานะดำเนินการ: <strong>{
                          workflowStatus[inc.id] === "ordered" 
                            ? `🕒 ส่งใบสั่งอนุมัติแล้ว: กำลังลงบันทึกการอนุมัติและแก้สถานะหน้างาน...` 
                            : `✓ อนุมัติการดำเนินการสำเร็จแล้ว: ปรับปรุงข้อมูลธุรกรรมดิบและคำนวณ KPI ดีขึ้นสำเร็จ!`
                        }</strong></span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>









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
                              const firstInc = activeIncidents[0];
                              if (firstInc) {
                                handleResolveIncident(
                                  firstInc.id,
                                  firstInc.id.slice(-4).toUpperCase(),
                                  `[จากแชท] ${btnText}`
                                );
                                setCopilotMessages(prev => [
                                  ...prev,
                                  { role: "assistant", text: `✓ บันทึกคำสั่งอนุมัติ: "${btnText}" สำหรับเคสสด ${firstInc.id.slice(-4).toUpperCase()} แล้วและระบบกำลังคำนวณ KPI ใหม่!` }
                                ]);
                              } else {
                                setCopilotMessages(prev => [
                                  ...prev,
                                  { role: "assistant", text: `ไม่พบเคสวิกฤตค้างส่งผลการตรวจในขณะนี้ที่ต้องรับนโยบายนี้` }
                                ]);
                              }
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
