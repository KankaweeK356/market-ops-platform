import { useEffect, useState, useMemo } from "react";
import Layout from "../components/Layout";
import DecisionCard from "../components/DecisionCard";
import { getReports, computeStats, getExecutiveData, getExecutiveDecisions, logExecutiveDecision, clearExecutiveDecisions } from "../lib/storage";
import { calculateMaintenanceRisk, detectReportingAnomaly, forecastLaborRequirements, calculatePriorityScores } from "../lib/executiveLogic";

export default function Executive() {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [execData, setExecData] = useState(null);
  const [loggedDecisions, setLoggedDecisions] = useState([]);

  // เลือกฝ่ายงานเพื่อวิเคราะห์เจาะลึก
  const [activeDeptId, setActiveDeptId] = useState("d-clean"); // ค่าเริ่มต้นเป็นฝ่ายรักษาความสะอาด

  // Case 5 Weekly Briefing State
  const [briefingResult, setBriefingResult] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState("");

  // Case 6 Conversational Copilot State
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotMessages, setCopilotMessages] = useState([]);
  const [copilotLoading, setCopilotLoading] = useState(false);

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

  // เลื่อนไปที่เคสการตัดสินใจแบบลื่นไหล
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
  }

  // ล้างประวัติการตัดสินใจเพื่อเริ่มรันใหม่
  function handleClearDecisions() {
    if (confirm("ต้องการเคลียร์ประวัติการตัดสินใจทั้งหมดเพื่อเริ่มต้นเดโมใหม่ใช่หรือไม่?")) {
      clearExecutiveDecisions();
      setLoggedDecisions([]);
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

  // แถบเป้าหมายตัวชี้วัด KPI รายฝ่ายงานตามเอกสารเปรียบเทียบในระบบจริง
  const kpiMetrics = useMemo(() => {
    if (activeDeptId === "d-clean") {
      return [
        { label: "ระดับขยะล้นถัง (Overflow Bin)", target: "< 80%", current: "92.0%", status: "alert" },
        { label: "การล้างถังขยะประจำวัน", target: ">= 2 รอบ", current: "1.0 รอบ", status: "warning" },
        { label: "ดัชนีบำบัดน้ำเสีย COD", target: "< 120 mg/L", current: "160 mg/L", status: "alert" }
      ];
    } else if (activeDeptId === "d-security") {
      return [
        { label: "เวลารถกระบะจอดแช่ขนสินค้า", target: "< 25 นาที", current: "34 นาที", status: "warning" },
        { label: "เวลารอคิวจราจรเฉลี่ย (Queue)", target: "< 15 นาที", current: "34 นาที", status: "alert" },
        { label: "ระยะเวลาเคลียร์คอขวดสะสม", target: "< 8 นาที", current: "15 นาที", status: "alert" }
      ];
    } else if (activeDeptId === "d-labor") {
      return [
        { label: "ชั่วโมงโอทีสะสม (Overtime Hours)", target: "< 12%", current: "124 ชม. (21%)", status: "alert" },
        { label: "ต่างด้าวเอกสารใกล้หมดสิทธิ์", target: "0 ราย", current: "16 ราย (เตือน)", status: "warning" },
        { label: "รถโฟล์กลิฟต์จอดว่างงาน (Idle)", target: "Utilization 70%", current: "18 คัน (50%)", status: "warning" }
      ];
    } else if (activeDeptId === "d-maintenance") {
      return [
        { label: "การใช้เครื่องจักร (Utilization)", target: "> 80%", current: "45.0% (Gen 1)", status: "alert" },
        { label: "เครื่องจักรชำรุดสะสม (Breakdown)", target: "0 นาที", current: "พบ 120 นาที", status: "alert" },
        { label: "ความเร็วงานซ่อมตาม SLA Met", target: "> 95%", current: "91.0%", status: "warning" }
      ];
    }
    return [];
  }, [activeDeptId]);

  // คำแนะนำสืบค้นข้อมูล Copilot ที่เข้ากับ Use Cases ใหม่
  const copilotSuggestions = useMemo(() => {
    if (activeDeptId === "d-clean") {
      return [
        { label: "🔎 ข้อมูลปั๊มบ่อน้ำเสียและระดับความเน่าเสีย BOD/COD", text: "รายงานค่า BOD/COD บ่อบำบัดน้ำเสียล่าสุดมีจุดใดหลุดเกณฑ์เป้าหมายบ้าง" },
        { label: "🔎 รายละเอียดประสิทธิภาพน้ำมันรถขยะและไมล์ KM", text: "ตรวจสอบประสิทธิภาพการใช้น้ำมันและระยะทาง KM ของรถปฏิบัติการล้างถนนเทียบเป้าหมายประหยัด 5%" },
        { label: "🔎 การแจ้งเตือนขยะผักอินทรีย์ล้นสะสม ณ Zone C", text: "วิเคราะห์สาเหตุและคาดการณ์ขยะผักอินทรีย์ล้นลานผัก Zone C ในอีก 38 นาที" }
      ];
    } else if (activeDeptId === "d-security") {
      return [
        { label: "🔎 รายละเอียดปัญหารถคอก 70-4567 จอดแช่", text: "ตรวจสอบเหตุจอดแช่สะสมขวางลานขนถ่ายของรถทะเบียน 70-4567 ที่ Dock-B" },
        { label: "🔎 ปัญหารถติดขัดสะสมคอขวดและเวลารอคิวเข้าลาน", text: "วิเคราะห์เวลารอเฉลี่ยของคิวรถ 31 คันและผลกระทบต่อแผงค้า 63 แผง" },
        { label: "🔎 ตรวจสอบผู้ฝ่าฝืนจราจรคนเดินย้อนช่องโดย Vision AI", text: "มีรายงานกล้องวงจรปิด CCTV ตรวจจับคนเดินย้อนช่องเดินรถหรือรถผิดประเภทเข้ามาไหม" }
      ];
    } else if (activeDeptId === "d-labor") {
      return [
        { label: "🔎 ยอดจำนวนแรงงานกะเช้าเทียบกับรถขนของเข้าลาน", text: "วิเคราะห์ประสิทธิภาพกำลังคน 185 คนเทียบกับรถขนของเข้าลาน 460 คันประจำกะเช้า" },
        { label: "🔎 ตรวจสอบแรงงานต่างด้าววีซ่า/Work Permit ใกล้หมดอายุ", text: "รายงานต่างด้าว 16 รายที่วีซ่าและ Work Permit ใกล้สิ้นสุดสิทธิ์ในอีก 15 วันมีรายละเอียดอย่างไร" },
        { label: "🔎 ประสิทธิภาพชั่วโมงโอทีล่วงหน้าและอัตราการรัน Forklift", text: "ขอดูอัตรา Utilization ของรถ Forklift และยอดโอทีสะสมที่เกินเป้าหมาย 12%" }
      ];
    } else if (activeDeptId === "d-maintenance") {
      return [
        { label: "🔎 รายงาน Breakdown และประสิทธิภาพ Utilization เครื่องจักร", text: "สรุปปัญหาสัญญาณขัดข้องของเครื่องปั่นไฟสำรอง GEN-01 และอัตราการ Utilize ล่าสุด" },
        { label: "🔎 ตรวจสอบใบงานซ่อมที่ล่าช้าเกินเวลาข้อตกลง SLA", text: "ขอดูรายชื่องานแจ้งซ่อมและรายงานใบงาน RQ-1045 ซ่อมล่าช้าขัด SLA" },
        { label: "🔎 ข้อมูลการวางแผนซ่อมบำรุงเชิงป้องกัน (PM) รถตักและปั๊ม", text: "ตรวจเช็คสภาพปั๊มสูบระบายหลักและชั่วโมงการเดินเครื่องสะสมสัปดาห์นี้" }
      ];
    }
    return [];
  }, [activeDeptId]);

  return (
    <Layout>
      <div className="page-head">
        <p className="eyebrow">แผงควบคุมผู้บริหารสูงสุด (Executive Dashboard)</p>
        <h1>ระบบประเมินดัชนี KPI และสั่งการอนุมัติ</h1>
        <p>
          ระบบวิเคราะห์สถานการณ์สนับสนุนการบริหารและตัดสินใจสำหรับ **ตลาดสี่มุมเมือง** 
          แยกแยะตามตรรกะเฉพาะฝ่ายงาน เพื่อแก้ปัญหาคอขวดปฏิบัติงานและคงเกณฑ์มาตรฐานของตลาด
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 1. แถบเลือกฝ่ายงานหลักของผู้บริหาร */}
      {/* ========================================================================= */}
      <div className="dept-tabs-container">
        <button 
          className={`dept-tab-btn clean-btn ${activeDeptId === "d-clean" ? "active" : ""}`}
          onClick={() => setActiveDeptId("d-clean")}
        >
          🧹 ฝ่ายรักษาความสะอาด
        </button>
        <button 
          className={`dept-tab-btn security-btn ${activeDeptId === "d-security" ? "active" : ""}`}
          onClick={() => setActiveDeptId("d-security")}
        >
          🛡️ ฝ่ายความปลอดภัย
        </button>
        <button 
          className={`dept-tab-btn labor-btn ${activeDeptId === "d-labor" ? "active" : ""}`}
          onClick={() => setActiveDeptId("d-labor")}
        >
          👥 ฝ่ายแรงงาน
        </button>
        <button 
          className={`dept-tab-btn maint-btn ${activeDeptId === "d-maintenance" ? "active" : ""}`}
          onClick={() => setActiveDeptId("d-maintenance")}
          style={{ borderLeftColor: "var(--red)" }}
        >
          🔧 ฝ่ายซ่อมบำรุง
        </button>
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

      <div className="executive-grid">
        {/* Main Left Content: Case Cards */}
        <div className="exec-main-content">
          
          {/* ========================================================================= */}
          {/* Case 5: Weekly Briefing (Generative AI - filtered by selected department) */}
          {/* ========================================================================= */}
          <div className="card briefing-panel" id="case-5">
            <div className="ai-tag-wrapper">
              <span className="ai-tag generative">Generative AI</span>
            </div>
            
            <h2 style={{ margin: "0 0 8px 0", fontFamily: "var(--font-display)", fontSize: "1.4rem" }}>
              📋 สรุปตัวชี้วัดประเด็นร้อน & ลิสต์ส่งคำสั่งตัดสินใจ (Case 5)
            </h2>
            <p className="briefing-dept-sub font-display">วิเคราะห์เฉพาะ: {
              activeDeptId === "d-clean" ? "ฝ่ายรักษาความสะอาด" : 
              activeDeptId === "d-security" ? "ฝ่ายความปลอดภัย" : 
              activeDeptId === "d-labor" ? "ฝ่ายแรงงาน" : "ฝ่ายซ่อมบำรุง"
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
                
                {/* Dynamic Todo List based on Active Department */}
                <ul className="briefing-todo-list">
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
                          <span>จัดการสกัดกั้นปัญหาระบบบำบัดน้ำเสียเกินค่ามาตรฐานความปลอดภัย BOD/COD</span>
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
                          <span>ส่ง รปภ. เคลียร์พื้นที่สะสมรถคอกจอดแช่เกินขอบเขตเวลา 25 นาที ณ Dock-B</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("S01")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-S01)
                          </button>
                        </div>
                      </li>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>สั่งเปิด Gate ประตูทางเข้าออกเพิ่มเติมระบายจราจรคิวติดสะสม</span>
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
                          <span>แจ้งจัดการเอกสาร Work Permit ของแรงงานต่างด้าวใกล้สิ้นสุดใบอนุญาตใน 15 วัน</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase("L01")}>
                            ➔ ตรวจเกณฑ์และอนุมัติ (UC-L01)
                          </button>
                        </div>
                      </li>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>สั่งจัดกะระดมแรงงานต่างด้าวคัดแยกเสริมขจัดความล่าช้าการโหลดสินค้า</span>
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
                          <span>อนุมัติโครงการซ่อมแซมใหญ่เปลี่ยนพัดลมความร้อนเพื่อกู้เครื่อง Gen-01 หลังขัดข้อง Breakdown</span>
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
                </ul>
              </div>
            )}
          </div>

          <div style={{ margin: "24px 0 16px 0", borderBottom: "2px solid var(--line)" }} />

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
                decisions={["เพิ่มกำลังพลรถเก็บขยะเสริมจาก Zone A", "ปรับความถี่ขยายรอบเก็บทุก 30 นาที", "อนุมัติผู้รับเหมาเอกชนเก็บขยะภายนอกชั่วคราว"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("C01")}
              />

              <DecisionCard
                caseId="C02"
                aiLabel="Rule-based AI"
                title="ระบบบำบัดน้ำเสียหลักมีค่าความเน่าเสีย BOD/COD เกินค่าความปลอดภัย"
                what={
                  <div>
                    ดัชนีคุณภาพบ่อน้ำเสียมีค่าซีโอดี COD สูงวิกฤตพุ่งแตะ <strong>160 mg/L</strong> (หลุดเกณฑ์เป้าหมายมาตรฐาน)
                  </div>
                }
                why={
                  <div>
                    เปรียบเทียบตามมาตรฐานควบคุมน้ำทิ้งตลาดสด: <strong>ค่า COD ห้ามเกิน 150 mg/L และค่า BOD ห้ามเกิน 20 mg/L</strong> ผลวัดล่าสุดพบ BOD สูง 25 mg/L เสี่ยงภัยต่อน้ำล้นคูคลองและสุขอนามัยตลาดโดนราชการปรับ
                  </div>
                }
                decisions={["สั่งสลับเปิดเครื่องระบายรอบน้ำและปั๊มสูบเพิ่ม", "ส่งวิศวกรและสิ่งแวดล้อมตรวจหาจุดสารปนเปื้อน", "ระงับช่องระบายน้ำจากโซนล้างรถและล้างถังชั่วคราว"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("C02")}
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* B. ฝ่ายความปลอดภัย (Security Cases) */}
          {/* ========================================================================= */}
          {activeDeptId === "d-security" && (
            <div className="dept-cases-list">
              <DecisionCard
                caseId="S01"
                aiLabel="Rule-based Alert"
                title="ปัญหารถคอกจอดแช่ขนส่งสินค้ากีดขวางเลนจราจรลานหลัก"
                what={
                  <div>
                    ตรวจพบรถกระบะคอกลอยป้ายทะเบียน 70-4567 จอดโหลดของ ณ ลาน Dock-B <strong>ยาวนานถึง 34 นาที</strong>
                  </div>
                }
                why={
                  <div>
                    เปรียบเทียบตามเป้าจอดแช่: <strong>ห้ามจอดแช่ขนของเกิน 25 นาที</strong> การจอดกีดขวางส่งผลกระทบต่อคิวขนานรถสะสมของสะพานเทียบแผงสินค้า และเกิดขวดขยะอับสายตา รบกวนรถบริการรอบอาคาร
                  </div>
                }
                decisions={["ส่ง รปภ. ลงเคลียร์ระเบียบจราจรและสั่งล็อกล้อทันที", "เปิดช่องลานจอดรถสำรองขนานระเบียงส่งของ", "จำกัดเข้มงวดสิทธิเวลาจอดแช่ไม่เกิน 15 นาที"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("S01")}
              />

              <DecisionCard
                caseId="S02"
                aiLabel="Queue Forecast"
                title="คิวจราจรรถขนส่งติดสะสมคอขวดวิกฤตหน้าลานค้าหลัก"
                what={
                  <div>
                    แถวคิวรถสะสมหน้าอาคารหลักพุ่งสูง <strong>31 คัน</strong> ทำให้รถติดขัดหนาแน่นเวลารอพุ่งแตะ 15 นาที
                  </div>
                }
                why={
                  <div>
                    เปรียบเทียบ KPI จราจร: <strong>ห้ามรถติดคอขวดสะสมเกิน 3 นาที</strong> AI คาดการณ์ว่าหากไม่สั่งระบายรถภายใน 25 นาที เวลารอเฉลี่ยจะพุ่งแตะ 42 นาทีต่อรอบ และกระทบแผงค้าแผงสินค้าผลผลิตเกษตร 63 แผง
                  </div>
                }
                decisions={["อนุมัติสั่งเปิดประตู Gate พิเศษเข้าออกระบายรถเพิ่ม", "ปรับแก้สลับคิวเดินรถและเบี่ยงคิวไปลานนอกชั่วคราว", "เรียกเสริมกำลังเจ้าหน้าที่ตำรวจและ รปภ. เคลียร์แยกหลัก"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("S02")}
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* C. ฝ่ายแรงงาน (Labor Cases) */}
          {/* ========================================================================= */}
          {activeDeptId === "d-labor" && (
            <div className="dept-cases-list">
              <DecisionCard
                caseId="L01"
                aiLabel="Compliance Check"
                title="วีซ่าและใบอนุญาตทำงานพนักงานต่างด้าวใกล้ครบกำหนดอายุ"
                what={
                  <div>
                    ตรวจพบพนักงานคัดแยกแรงงานต่างด้าว <strong>16 ราย</strong> ใบอนุญาต (Work Permit) จะหมดอายุใน 15 วัน และมีแรงงานผิดกฎหมายขาดเอกสารแล้ว 4 ราย
                  </div>
                }
                why={
                  <div>
                    เปรียบเทียบเป้าหมายการจ้างงาน: <strong>ดัชนีแรงงานถูกต้องตามกฎหมายต้องเป็น 100%</strong> การละเลยส่งผลให้มีความเสี่ยงสูงที่จะโดนปรับคดีร้ายแรงและถูกปิดงดกะงานปฏิบัติการของตลาด
                  </div>
                }
                decisions={["แจ้ง HR ตลาดนำเรื่องยื่นเรื่องต่อวีซ่าแบบด่วนที่สุด", "พักงานชั่วคราวสำหรับพนักงาน 16 รายจนกว่าต่อสิทธิ์เสร็จ", "ว่าจ้างบริษัทจัดหาแรงงานต่างชาติสำรองเข้าเสริมงานแทน"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("L01")}
              />

              <DecisionCard
                caseId="L02"
                aiLabel="Labor Forecast"
                title="อัตรากำลังแรงงานคัดแยกสินค้าไม่เพียงพอต่อปริมาณงานรอบกะ"
                what={
                  <div>
                    กะปฏิบัติการเช้าคาดว่ามีรถขนสินค้าเข้าหนาแน่นสะสม <strong>460 คัน</strong> แต่แรงงานที่มีพร้อมทำงานมีเพียง 185 คน
                  </div>
                }
                why={
                  <div>
                    เปรียบเทียบตามประสิทธิภาพความพร้อม: <strong>ดัชนีเวลาจอดรอถ่ายสินค้าเป้าหมายห้ามเกิน 25 นาที/คัน</strong> แต่ยอดประเมินพบเฉลี่ยแตะ 31 นาที ยอดจราจรล้นคัดแยกเฉลี่ยและ Utilization ของกำลังคนพุ่งแตะ 95% วิกฤต
                  </div>
                }
                decisions={["เรียกใช้แรงงานต่างด้าวสำรองบริษัทคู่สัญญาด่วน", "อนุมัติเลื่อนกำหนดถ่ายขนสินค้าบางโซนเบาบาง", "อนุมัติงบค่าจ้างโอทีทำงานล่วงเวลาสะสมกะเช้าเสริม"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("L02")}
              />
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
                decisions={["อนุมัติให้วิศวกรเข้าซ่อมและเปลี่ยนพัดลมระบบทันที", "สั่งปรับสลับกระจายโหลดไฟฟ้าไปเครื่องปั่นไฟสำรอง 2", "ควบคุมขีดจำกัดความเร็วรอบจ่ายไฟเพื่อลดความร้อนชั่วคราว"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("M01")}
              />

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
                decisions={["อนุมัติงบฉุกเฉินจัดซื้อสต็อกสายไฟและอะไหล่กลางด่วน", "ปรับตารางแบ่งเขตโซนรับผิดชอบของช่างซ่อมบำรุงใหม่", "ขยายช่วงขีดจำกัด SLA ซ่อมด่วนจาก 2 ชม. เป็น 3 ชม."]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase("M02")}
              />
            </div>
          )}

          <div style={{ margin: "32px 0 20px 0", borderBottom: "2px solid var(--line)" }} />

          {/* ========================================================================= */}
          {/* Case 6: Conversational Copilot (RAG Chat - filtered context) */}
          {/* ========================================================================= */}
          <div className="card copilot-panel" id="case-6">
            <div className="ai-tag-wrapper">
              <span className="ai-tag rag-tag">Generative AI + RAG</span>
            </div>
            
            <h3 className="font-display" style={{ margin: "0 0 4px 0", fontSize: "1.2rem" }}>
              💬 ผู้ช่วยวิเคราะห์ปฏิบัติงานเชิงลึก (Executive Copilot)
            </h3>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.85rem", margin: "0 0 20px 0" }}>
              พิมพ์ประเมินความสอดคล้อง ดึงประวัติน้ำมันรถขยะ หรือกดหัวข้อจำลองทางเลือกด้านล่างที่วิเคราะห์เฉพาะ **{
                activeDeptId === "d-clean" ? "ฝ่ายรักษาความสะอาด" : 
                activeDeptId === "d-security" ? "ฝ่ายความปลอดภัย" : 
                activeDeptId === "d-labor" ? "ฝ่ายแรงงาน" : "ฝ่ายซ่อมบำรุง"
              }** ได้ทันที
            </p>

            {/* Dynamic Suggested Chips based on Active Department */}
            <div className="copilot-suggestions">
              {copilotSuggestions.map((sug, idx) => (
                <button 
                  key={idx}
                  type="button" 
                  className="suggestion-chip"
                  onClick={() => handleSendCopilotQuery(sug.text)}
                >
                  {sug.label}
                </button>
              ))}
            </div>

            {/* Chat History Messages */}
            <div className="copilot-chat-box" id="copilot-chat-box">
              {copilotMessages.length === 0 && (
                <p className="chat-empty-state">ถามเปรียบเทียบประสิทธิภาพดัชนี KPI หรือการตรวจจับเหตุความปลอดภัย...</p>
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
                                activeDeptId === "d-clean" ? "C01" : 
                                activeDeptId === "d-security" ? "S01" : 
                                activeDeptId === "d-labor" ? "L01" : "M01", 
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
                placeholder={`ถามความล่าช้า, ตารางตรวจไมล์รถ หรือดัชนีชี้วัดของ${
                  activeDeptId === "d-clean" ? "บ่อบำบัดน้ำเสีย/การใช้น้ำมัน" : 
                  activeDeptId === "d-security" ? "คิวรถติดขัด/รถจอดแช่" : 
                  activeDeptId === "d-labor" ? "อัตราโอที/วีซ่าต่างด้าว" : "ชั่วโมง Breakdown/งานซ่อม SLA"
                }...`}
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

      <style jsx global>{`
        /* Dept Switcher Tabs styling */
        .dept-tabs-container {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          border-bottom: 2px solid var(--line);
          padding-bottom: 12px;
        }
        .dept-tab-btn {
          flex: 1;
          padding: 14px 20px;
          font-size: 1rem;
          font-weight: 700;
          background: #fff;
          color: var(--ink-soft);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-display);
        }
        .dept-tab-btn:hover {
          background: var(--paper-raised);
          color: var(--ink);
        }
        .dept-tab-btn.active {
          background: var(--ink);
          color: var(--paper);
          border-color: var(--ink);
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

        /* Case 4 backlog table */
        .backlog-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
          margin-top: 8px;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: var(--radius);
        }
        .backlog-table th {
          text-align: left;
          background: var(--paper);
          padding: 8px 10px;
          font-size: 0.72rem;
          text-transform: uppercase;
        }
        .backlog-table td {
          padding: 8px 10px;
          border-bottom: 1px solid var(--line);
        }
        .rec-star {
          font-size: 0.68rem;
          background: var(--green-soft);
          color: var(--green);
          padding: 2px 6px;
          border-radius: 99px;
          margin-left: 4px;
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
