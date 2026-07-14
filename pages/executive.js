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
    setExecData(getExecutiveData());
    setLoggedDecisions(getExecutiveDecisions());
  }

  // คำนวณข้อมูล AI/ML ย่อยในแต่ละเคส
  const case1Data = useMemo(() => {
    if (!reports.length) return null;
    return calculateMaintenanceRisk(reports, "veh-01");
  }, [reports]);

  const case2Data = useMemo(() => {
    if (!execData) return null;
    return detectReportingAnomaly(execData.zoneReportHistory, "โซน C - อาหารทะเล");
  }, [execData]);

  const case3Data = useMemo(() => {
    if (!execData) return null;
    return forecastLaborRequirements(execData.lastYearFestivalData);
  }, [execData]);

  const case4Data = useMemo(() => {
    if (!execData) return null;
    return calculatePriorityScores(execData.repairBacklog);
  }, [execData]);

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
        case1Risk: case1Data,
        case2Anomaly: case2Data,
        case3Forecast: case3Data,
        case4Priority: case4Data,
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

  // แถบเป้าหมายตัวชี้วัด KPI รายฝ่ายงาน
  const kpiMetrics = useMemo(() => {
    if (activeDeptId === "d-clean") {
      return [
        { label: "อัตราการส่งรายงานปกติ", target: "> 98%", current: "94.5%", status: "warning" },
        { label: "ระยะเวลาบำรุงรักษาจุดชำรุด", target: "< 48 ชม.", current: "54 ชม.", status: "alert" }
      ];
    } else if (activeDeptId === "d-security") {
      return [
        { label: "ความพร้อมวิ่งรถสายตรวจ", target: "100%", current: "92.0%", status: "alert" },
        { label: "อัตรา CCTV ออนไลน์", target: "> 95%", current: "92.5%", status: "warning" }
      ];
    } else if (activeDeptId === "d-labor") {
      return [
        { label: "อัตราการสวมใส่ชุด PPE", target: "100%", current: "70.0%", status: "alert" },
        { label: "ความเพียงพอกำลังคนเทศกาล", target: "> 90%", current: "95.0%", status: "pass" }
      ];
    }
    return [];
  }, [activeDeptId]);

  // คำแนะนำสำหรับปุ่มด่วนแชท Copilot รายฝ่ายงาน
  const copilotSuggestions = useMemo(() => {
    if (activeDeptId === "d-clean") {
      return [
        { label: "🔎 สรุปวิกฤตงานรักษาความสะอาดสัปดาห์นี้", text: "ฝ่ายรักษาความสะอาดมีปัญหาที่วิกฤตที่สุดเรื่องใดบ้างสัปดาห์นี้" },
        { label: "🔎 ตรวจพบความเงียบรายงานตรงจุดไหนบ้าง", text: "ตรวจจับรายงานขาดช่วงหรือหายไปผิดปกติเชิงสถิติในโซนไหนบ้างไหม" },
        { label: "🔎 จัดลำดับงานซ่อมบำรุงตลาดเร่งด่วน", text: "จัดอันดับงานซ่อมบำรุงตลาดและร้านค้าที่ชำรุด 5 จุดด้วยความเหมาะสม" }
      ];
    } else if (activeDeptId === "d-security") {
      return [
        { label: "🔎 สรุปภาพรวมงานความปลอดภัยสัปดาห์นี้", text: "มีเหตุการณ์ผิดสังเกตหรือเรื่องร้องเรียนของฝ่ายความปลอดภัยในสัปดาห์นี้อย่างไร" },
        { label: "🔎 ทำไมรถตรวจการณ์ กข-1234 เสี่ยงวิกฤต", text: "เพราะอะไร รถตรวจการณ์ กข-1234 ถึงมีความเสี่ยงซ่อมบำรุงระดับสูงระดับ 88" },
        { label: "🔎 เช็คสถิติปัญหาระบบกล้องวงจรปิด", text: "ตรวจพบข้อร้องเรียนหรือประเด็นเกี่ยวกับกล้องวงจรปิด CCTV และเครื่อง NVR อย่างไร" }
      ];
    } else if (activeDeptId === "d-labor") {
      return [
        { label: "🔎 สรุปปัญหาดัชนีวินัยแรงงานเข้างาน", text: "ฝ่ายแรงงานพบบันทึกข้อผิดพลาดหรือคนขาดเข้างานอย่างไรในสัปดาห์นี้" },
        { label: "🔎 ตรวจสอบเหตุการฝ่าฝืนกฎนิรภัย PPE", text: "รายงานการไม่สวมใส่อุปกรณ์หมวกนิรภัยหรือถุงมือเกิดขึ้นที่จุดใดและรุนแรงไหม" },
        { label: "🔎 พยากรณ์จัดหาพนักงานเพิ่มช่วงสงกรานต์", text: "การพยากรณ์ความต้องการพนักงานเพิ่มช่วงสงกรานต์อิงจากสถิติของปีก่อนอย่างไร" }
      ];
    }
    return [];
  }, [activeDeptId]);

  return (
    <Layout>
      <div className="page-head">
        <p className="eyebrow">แผงควบคุมระดับสูง (Executive Boardroom)</p>
        <h1>แผงวิเคราะห์และสนับสนุนการสั่งการ</h1>
        <p>
          ระบบวิเคราะห์สถานการณ์เพื่อสนับสนุนการบริหารจัดการตลาดสี่มุมเมือง 
          กรุณาเลือกฝ่ายงานเป้าหมายเพื่อรับสรุปเหตุการณ์ และสั่งการทางเลือกการตัดสินใจตามดัชนีชี้วัด KPI
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
              📋 สรุปเรื่องราวและสิ่งทึ่รอการอนุมัติ (Case 5)
            </h2>
            <p className="briefing-dept-sub font-display">วิเคราะห์เฉพาะ: {activeDeptId === "d-clean" ? "ฝ่ายรักษาความสะอาด" : activeDeptId === "d-security" ? "ฝ่ายความปลอดภัย" : "ฝ่ายแรงงาน"}</p>

            <div className="briefing-action-header">
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.92rem", flex: 1 }}>
                AI จะคัดกรองเฉพาะข้อมูลบันทึกและตัวชี้วัดของฝ่ายงานนี้ นำมาสรุปเป็นเรื่องสั้น และรวบรวมลิสต์ใบสั่งการเพื่อให้คุณพิจารณาตัดสินใจ
              </p>
              <button className="btn" onClick={runWeeklyBriefing} disabled={briefingLoading}>
                {briefingLoading ? "กำลังวิเคราะห์..." : "✨ สรุปประเด็นอนุมัติด้วย AI"}
              </button>
            </div>

            {briefingError && (
              <p className="error-banner" style={{ marginTop: 12 }}>{briefingError}</p>
            )}

            {!briefingResult && !briefingLoading && !briefingError && (
              <div className="empty-briefing-prompt">
                <span className="briefing-icon">📊</span>
                <p>กดปุ่ม &ldquo;สรุปประเด็นอนุมัติด้วย AI&rdquo; เพื่อให้สมองกลอ่านข้อมูลและสรุปรายงานดัชนี KPI</p>
              </div>
            )}

            {briefingResult && (
              <div className="briefing-compiled-result">
                <blockquote>{briefingResult.summary}</blockquote>
                
                <h4 style={{ margin: "20px 0 10px 0", fontWeight: 700 }}>
                  🚨 ใบสั่งการและคำอนุมัติที่กำลังรอท่านตัดสินใจ:
                </h4>
                
                {/* Dynamic Todo List based on Active Department */}
                <ul className="briefing-todo-list">
                  {activeDeptId === "d-clean" && (
                    <>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>สั่งตรวจสอบกรณีรายงานความสะอาดห้องน้ำ โซน C หายเงียบ 5 วันติดต่อกัน</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase(2)}>
                            ➔ ดูข้อมูลและตัดสินใจ (Case 2)
                          </button>
                        </div>
                      </li>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>อนุมัติโครงการซ่อมแซมจุดชำรุดสะสม 2 ใน 5 แผงค้าหลักในตลาด</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase(4)}>
                            ➔ ดูข้อมูลและตัดสินใจ (Case 4)
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
                          <span>อนุมัติสั่งซ่อมยานพาหนะ รถตรวจการณ์ กข-1234 สภาพเบรกไม่ผ่าน 2 ครั้ง</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase(1)}>
                            ➔ ดูข้อมูลและตัดสินใจ (Case 1)
                          </button>
                        </div>
                      </li>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>สั่งแก้ไขเหตุระบบออนไลน์กล้อง CCTV ดับพร้อมกัน 3 จุดในตลาด</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase(11)}>
                            ➔ ดูข้อมูลและตัดสินใจ (CCTV Case)
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
                          <span>อนุมัติยอดจัดจ้างพนักงาน Part-time เสริม 8 อัตราช่วงสงกรานต์</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase(3)}>
                            ➔ ดูข้อมูลและตัดสินใจ (Case 3)
                          </button>
                        </div>
                      </li>
                      <li>
                        <span className="bullet">📌</span>
                        <div className="todo-item-desc">
                          <span>จัดการข้อสั่งโทษแรงงานและตักเตือนผู้รับเหมาไซด์ก่อสร้างฐานละเลย PPE</span>
                          <button className="jump-link-btn" onClick={() => handleScrollToCase(33)}>
                            ➔ ดูข้อมูลและตัดสินใจ (PPE Case)
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
              {case2Data && (
                <DecisionCard
                  caseId={2}
                  aiLabel="Statistical Anomaly"
                  title="ตรวจพบความเงียบรายงานสุขาภิบาลห้องน้ำผิดปกติ (Silent Anomaly)"
                  what={
                    <div>
                      <strong>ฝ่ายรักษาความสะอาด ในพื้นที่ โซน C (อาหารทะเล)</strong> ขาดการส่งรายงานความสะอาด 
                      <strong style={{ color: "var(--gold)" }}> ติดต่อกันเป็นเวลา 5 วัน</strong> ทั้งที่ปกติมีรายงานทุกวัน
                    </div>
                  }
                  why={
                    <div>
                      สอดคล้องตาม KPI ความสม่ำเสมอ: <strong>ค่าเฉลี่ยปกติ 3.0 ครั้ง/วัน</strong> แต่สัปดาห์นี้ยอดตกลงเหลือ 
                      <strong> 0.0 ครั้ง/วัน (Z-Score: {case2Data.zScore})</strong> 
                      ซึ่งขัดต่อเกณฑ์มาตรฐานความหนาแน่นรายงาน (คาดว่าผู้ตรวจอาจไม่ได้ลงบันทึกจริง ไม่ใช่ตลาดไม่มีปัญหา)
                    </div>
                  }
                  decisions={["สั่งส่งทีมสืบสวนลงตรวจสอบด่วน", "ชี้แจงเตือนหัวหน้างานโซน C", "เฝ้าระวังรอรายงานอีก 24 ชม."]}
                  onDecision={handleMakeDecision}
                  loggedDecision={getDecisionForCase(2)}
                />
              )}

              {case4Data && (
                <DecisionCard
                  caseId={4}
                  aiLabel="Scoring Model"
                  title="จัดลำดับอนุมัติซ่อมบำรุงภายใต้กรอบงบประมาณจำกัด (Weighted Priority)"
                  what={
                    <div>
                      ตรวจพบงานชำรุดรอซ่อมแซมสะสม <strong>5 จุดในตลาด</strong> แต่งบประมาณมีจำกัดอนุมัติได้พร้อมกันสูงสุด 
                      <strong>2 จุดในเดือนนี้</strong> แผงควบคุมคำนวณและเสนอแนะ 2 ลำดับความรุนแรงสูงสุดที่ควรทำทันที
                    </div>
                  }
                  why={
                    <div style={{ marginTop: 8 }}>
                      <p style={{ margin: "0 0 10px 0" }}>ระบบถ่วงน้ำหนักคะแนนตาม: ความถี่ปัญหา (60%) + ความรุนแรง (25%) + แผงค้าที่ได้รับผลกระทบ (15%):</p>
                      <table className="backlog-table">
                        <thead>
                          <tr>
                            <th>พื้นที่ / แผงค้า</th>
                            <th>ความถี่พบชำรุด</th>
                            <th>ระดับวิกฤต</th>
                            <th>ร้านค้าที่กระทบ</th>
                            <th>คะแนนรวม (เต็ม 100)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {case4Data.map((item, idx) => (
                            <tr key={item.zone} style={idx < 2 ? { fontWeight: 600, background: "rgba(63, 125, 92, 0.08)" } : {}}>
                              <td>{item.zone} {idx < 2 && <span className="rec-star">★ แนะนำซ่อมด่วน</span>}</td>
                              <td>{item.frequency} ครั้ง</td>
                              <td>{item.severity}</td>
                              <td>{item.affectedVendors} แผง</td>
                              <td style={{ color: idx < 2 ? "var(--green)" : "inherit" }}>{item.score}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                  decisions={["อนุมัติโครงการซ่อมแซม โซน A และ D", "ปรับเปลี่ยนลำดับการจัดสร้างใหม่", "ขออนุมัติขยายกรอบงบประมาณเพื่อซ่อมทั้งหมด"]}
                  onDecision={handleMakeDecision}
                  loggedDecision={getDecisionForCase(4)}
                />
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* B. ฝ่ายความปลอดภัย (Security Cases) */}
          {/* ========================================================================= */}
          {activeDeptId === "d-security" && (
            <div className="dept-cases-list">
              {case1Data && (
                <DecisionCard
                  caseId={1}
                  aiLabel="Rule-based AI"
                  title="ความเสี่ยงอุบัติเหตุและการชำรุดของยานพาหนะสายตรวจ (Asset Safety)"
                  what={
                    <div>
                      ตรวจพบคะแนนความเสี่ยงวิกฤต <strong style={{ color: "var(--red)" }}>ความเสี่ยงสูงสุด 88/100 (ระดับแดง)</strong>
                      ของสินทรัพย์ <strong>รถตรวจการณ์ กข-1234</strong>
                    </div>
                  }
                  why={
                    <div>
                      เนื่องจากประวัติส่งบันทึกเช็คสภาพพบเบรกรถยนต์ <strong>&ldquo;ไม่ผ่านเกณฑ์&rdquo; ติดต่อกัน 2 วันซ้อน</strong> 
                      และตัวรถ<strong>ขาดการบันทึกตรวจซ้ำหรือแจ้งประวัติการแก้ไขมาแล้ว 4 วันติดต่อกัน</strong> (ขัดต่อ KPI ความพร้อมใช้ 100%)
                    </div>
                  }
                  decisions={["สั่งนำรถเข้าอู่ซ่อมบำรุงทันที", "พักใช้งานรถสายตรวจชั่วคราว", "มอบหมายหัวหน้าฝ่ายความปลอดภัยตรวจสอบ"]}
                  onDecision={handleMakeDecision}
                  loggedDecision={getDecisionForCase(1)}
                />
              )}

              <DecisionCard
                caseId={11}
                aiLabel="Statistical Alarm"
                title="ระดับความพร้อมใช้งานกล้องตรวจจับ CCTV หลุดเกณฑ์เป้าหมาย (CCTV Outage)"
                what={
                  <div>
                    อัตราความพร้อมระบบกล้องวงจรปิด <strong>ตกลงเหลือ 92.5%</strong> (ต่ำกว่าเกณฑ์ความปลอดภัยมาตรฐาน) 
                    เนื่องจากมีรายงาน <strong>กล้องดับ 3 ตัวในโซน B</strong> และเครื่องบันทึกวิดีโอ (NVR) กลางอุณหภูมิวิกฤต
                  </div>
                }
                why={
                  <div>
                    เปรียบเทียบตามเป้าหมาย KPI: <strong>ต้องการอัตราออนไลน์กล้องวงจรปิด &gt; 95%</strong> การเสียของกล้อง 3 ตัวในโซน B 
                    ส่งผลให้เกิดพื้นที่อับสายตา ซึ่งเป็นจุดเสี่ยงต่อการเกิดอาชญากรรมและการติดตามคดี
                  </div>
                }
                decisions={["สั่งซื้อเปลี่ยนกล้องใหม่ 3 จุด", "ส่งช่างเทคนิคดูแลซ่อมเครื่อง NVR", "ติดตั้งกล้องโมบายสำรองชั่วคราว"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase(11)}
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* C. ฝ่ายแรงงาน (Labor Cases) */}
          {/* ========================================================================= */}
          {activeDeptId === "d-labor" && (
            <div className="dept-cases-list">
              {case3Data && (
                <DecisionCard
                  caseId={3}
                  aiLabel="Predictive Model"
                  title="พยากรณ์การจัดสรรอัตราพนักงานเสริมล่วงหน้าช่วงเทศกาล (Staffing Forecast)"
                  what={
                    <div>
                      คาดการณ์ความต้องการกำลังพลเจ้าหน้าที่เสริมสุขาภิบาลและอำนวยความสะดวก 
                      <strong style={{ color: "var(--green)" }}> จำนวน +{case3Data.forecastedStaff} คน</strong> ในช่วงเทศกาลสงกรานต์นี้
                    </div>
                  }
                  why={
                    <div>
                      สอดคล้องตาม KPI ความเพียงพอกำลังคน: จากข้อมูลสงกรานต์ปีที่ผ่านมา ยอดจำนวนลูกค้าเข้าตลาดขยายตัวขึ้น 40% 
                      และประเด็นเรื่องร้องเรียนความสะอาดพุ่งขึ้น 40% การเพิ่มกำลังคนเสริม 8 คนจะช่วยรองรับเหตุการณ์ได้ตามขีดมาตรฐาน
                    </div>
                  }
                  decisions={["อนุมัติจ้างพนักงานเสริม 8 อัตรา", "อนุมัติจ้างงานครึ่งหนึ่ง (4 อัตรา)", "ไม่อนุมัติและควบคุมด้วยทีมงานหลัก"]}
                  onDecision={handleMakeDecision}
                  loggedDecision={getDecisionForCase(3)}
                />
              )}

              <DecisionCard
                caseId={33}
                aiLabel="Rule-based Violation"
                title="ดัชนีสวมใส่อุปกรณ์ป้องกันภัยแรงงานไม่ได้มาตรฐานกฎความปลอดภัย (PPE Violation)"
                what={
                  <div>
                    พบพนักงานก่อสร้างจำนวน <strong>2 รายละเลยไม่ใส่ถุงมือและรองเท้านิรภัย</strong> ระหว่างปฏิบัติงานโครงสร้างในพื้นที่ไซด์งาน โซน B
                  </div>
                }
                why={
                  <div>
                    ส่งผลให้ดัชนีความสอดคล้องความปลอดภัย (KPI: สวมใส่ 100%) **ตกลงมาอยู่ที่ 70%** ซึ่งชี้วัดถึงความเสี่ยงอุบัติเหตุทางกายภาพวิกฤตหน้างาน 
                    และผิดระเบียบวินัยความปลอดภัยของผู้ค้า/ผู้รับเหมาในตลาด
                  </div>
                }
                decisions={["ตักเตือนและลงบันทึกคาดโทษแรงงาน", "ระงับการเข้าทำงานชั่วคราว", "ปรับเงินผู้รับเหมาตามสัญญาก่อสร้าง"]}
                onDecision={handleMakeDecision}
                loggedDecision={getDecisionForCase(33)}
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
              💬 ผู้ช่วยส่วนบุคคลเฉพาะฝ่ายงาน (Executive Copilot)
            </h3>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.85rem", margin: "0 0 20px 0" }}>
              พิมพ์สอบถามข้อมูลระบบ หรือกดหัวข้อจำลองทางเลือกด้านล่างที่วิเคราะห์เฉพาะ **{activeDeptId === "d-clean" ? "ฝ่ายรักษาความสะอาด" : activeDeptId === "d-security" ? "ฝ่ายความปลอดภัย" : "ฝ่ายแรงงาน"}** ได้ทันทีครับ
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
                <p className="chat-empty-state">กรุณาคลิกหัวข้อด่วนด้านบน หรือพิมพ์สอบถามเพื่อดึงข้อมูลรายงาน...</p>
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
                              handleMakeDecision(activeDeptId === "d-clean" ? 20 : activeDeptId === "d-security" ? 10 : 30, `[จากแชท] ${btnText}`);
                              setCopilotMessages(prev => [
                                ...prev,
                                { role: "assistant", text: `✓ บันทึกข้อสั่งการของผู้บริหาร: "${btnText}" และจัดเข้าระบบงานเสร็จสมบูรณ์แล้วครับ` }
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
                  <span>🤖 กำลังวิเคราะห์ข้อมูลและสรุปตอบกลับ...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="copilot-chat-input-bar">
              <input
                type="text"
                placeholder={`ถามเกณฑ์ KPI หรือเหตุการณ์ผิดปกติของ${activeDeptId === "d-clean" ? "งานทำความสะอาด" : activeDeptId === "d-security" ? "งานความปลอดภัย" : "กำลังพลแรงงาน"}...`}
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
