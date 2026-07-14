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

  function loadAllData() {
    const r = getReports();
    setReports(r);
    setStats(computeStats(r));
    setExecData(getExecutiveData());
    setLoggedDecisions(getExecutiveDecisions());
  }

  // AI Calculations based on logic rules
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

  // Jump to specific card smoothly
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

  // Handle decisions logging
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

  // Case 5 Weekly Briefing fetch
  async function runWeeklyBriefing() {
    setBriefingLoading(true);
    setBriefingError("");
    setBriefingResult(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports, stats }),
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

  // Case 6 Copilot submit query
  async function handleSendCopilotQuery(customText = "") {
    const queryToSend = customText || copilotQuery;
    if (!queryToSend.trim()) return;

    // Add user message
    const userMsg = { role: "user", text: queryToSend };
    setCopilotMessages(prev => [...prev, userMsg]);
    if (!customText) setCopilotQuery("");

    setCopilotLoading(true);
    try {
      // Compile RAG context
      const contextData = {
        stats,
        case1Risk: case1Data,
        case2Anomaly: case2Data,
        case3Forecast: case3Data,
        case4Priority: case4Data,
        recentSubmissions: reports.slice(0, 10)
      };

      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryToSend, context: contextData }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        setCopilotMessages(prev => [
          ...prev, 
          { role: "assistant", text: `เกิดข้อผิดพลาด: ${data.error || "ไม่สามารถเชื่อมต่อได้"}` }
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
      // Scroll to bottom of chat
      setTimeout(() => {
        const chatBox = document.getElementById("copilot-chat-box");
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      }, 100);
    }
  }

  // Check if a decision has already been logged for a case
  const getDecisionForCase = (caseId) => {
    return loggedDecisions.find(d => d.caseId === caseId);
  };

  return (
    <Layout>
      <div className="page-head">
        <p className="eyebrow">ผู้บริหารสูงสุด (Executive Dashboard)</p>
        <h1>แผงวิเคราะห์และอนุมัติการตัดสินใจ</h1>
        <p>
          ระบบวิเคราะห์สถานการณ์เพื่อสนับสนุนการบริหารจัดการตลาดสี่มุมเมือง 
          เน้นข้อมูลเชิงประจักษ์ (Data-driven) และกระตุ้นการสั่งการในเคสเร่งด่วน
        </p>
      </div>

      <div className="executive-grid">
        {/* Main Left Content: Case Cards */}
        <div className="exec-main-content">
          
          {/* ========================================================================= */}
          {/* Case 5: Weekly Briefing (Generative AI) */}
          {/* ========================================================================= */}
          <div className="card briefing-panel" id="case-5">
            <div className="ai-tag-wrapper">
              <span className="ai-tag generative">Generative AI</span>
            </div>
            
            <h2 style={{ margin: "0 0 16px 0", fontFamily: "var(--font-display)", fontSize: "1.4rem" }}>
              📋 สรุปรายงานประจำสัปดาห์ & สิ่งที่รอการอนุมัติ (Case 5)
            </h2>

            <div className="briefing-action-header">
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.92rem" }}>
                AI สรุปเหตุการณ์ภาพรวมทั้งหมดในตลาด พร้อมลิสต์ทางเลือกที่ต้องการการตัดสินใจของคุณในสัปดาห์นี้
              </p>
              <button className="btn" onClick={runWeeklyBriefing} disabled={briefingLoading}>
                {briefingLoading ? "กำลังสรุป..." : "✨ สรุปรายงานและประเด็นอนุมัติด้วย AI"}
              </button>
            </div>

            {briefingError && (
              <p className="error-banner" style={{ marginTop: 12 }}>{briefingError}</p>
            )}

            {!briefingResult && !briefingLoading && !briefingError && (
              <div className="empty-briefing-prompt">
                <span className="briefing-icon">📝</span>
                <p>กดปุ่ม &ldquo;สรุปรายงานและประเด็นอนุมัติด้วย AI&rdquo; เพื่อสรุปใจความสำคัญและดูลิสต์อนุมัติ</p>
              </div>
            )}

            {briefingResult && (
              <div className="briefing-compiled-result">
                <blockquote>{briefingResult.summary}</blockquote>
                
                <h4 style={{ margin: "20px 0 10px 0", fontWeight: 700 }}>
                  🚨 รายการที่ต้องการการตัดสินใจเร่งด่วนในสัปดาห์นี้:
                </h4>
                <ul className="briefing-todo-list">
                  <li>
                    <span className="bullet">📌</span>
                    <div className="todo-item-desc">
                      <span>อนุมัติสั่งซ่อมรถสายตรวจความปลอดภัย กข-1234 หรือไม่?</span>
                      <button className="jump-link-btn" onClick={() => handleScrollToCase(1)}>
                        ➔ ดูข้อมูลและสั่งการ (Case 1)
                      </button>
                    </div>
                  </li>
                  <li>
                    <span className="bullet">📌</span>
                    <div className="todo-item-desc">
                      <span>สั่งตรวจสอบลงพื้นที่ฝ่ายรักษาความสะอาด โซน C หรือไม่?</span>
                      <button className="jump-link-btn" onClick={() => handleScrollToCase(2)}>
                        ➔ ดูข้อมูลและสั่งการ (Case 2)
                      </button>
                    </div>
                  </li>
                  <li>
                    <span className="bullet">📌</span>
                    <div className="todo-item-desc">
                      <span>อนุมัติจ้างกำลังพลเสริมช่วงเทศกาลสงกรานต์หรือไม่?</span>
                      <button className="jump-link-btn" onClick={() => handleScrollToCase(3)}>
                        ➔ ดูข้อมูลและสั่งการ (Case 3)
                      </button>
                    </div>
                  </li>
                  <li>
                    <span className="bullet">📌</span>
                    <div className="todo-item-desc">
                      <span>อนุมัติแผนงานซ่อมบำรุงตลาดและจัดสรรงบประมาณชำรุดหรือไม่?</span>
                      <button className="jump-link-btn" onClick={() => handleScrollToCase(4)}>
                        ➔ ดูข้อมูลและสั่งการ (Case 4)
                      </button>
                    </div>
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div style={{ margin: "24px 0 16px 0", borderBottom: "2px solid var(--line)" }} />

          {/* ========================================================================= */}
          {/* Case 1: Maintenance Alert (Rule-based) */}
          {/* ========================================================================= */}
          {case1Data && (
            <DecisionCard
              caseId={1}
              aiLabel="Rule-based AI"
              title="ระบบตรวจพบความเสี่ยงชำรุดของสินทรัพย์ (Asset Maintenance)"
              what={
                <div>
                  พบความเสี่ยงวิกฤต <strong style={{ color: "var(--red)" }}>ความเสี่ยงสูงระดับ {case1Data.riskScore}/100</strong>
                  ของอุปกรณ์ <strong>รถตรวจการณ์ กข-1234</strong>
                </div>
              }
              why={
                <div>
                  เนื่องจากพบประวัติตรวจเช็คสภาพระบบเบรกรถยนต์ <strong>&ldquo;ไม่ผ่าน&rdquo; ติดต่อกัน 2 ครั้งซ้อน</strong> 
                  (วันที่ 12 และ 13 ก.ค.) และตัวรถ<strong>ขาดการบันทึกตรวจซ้ำหรือตรวจสภาพเพิ่มเติมมาเป็นเวลา 4 วันติดต่อกันแล้ว</strong>
                </div>
              }
              decisions={["สั่งซ่อมบำรุงทันที", "เลื่อนการตรวจออกไปอีก 24 ชม.", "มอบหมายให้หัวหน้าฝ่ายความปลอดภัยตรวจสอบ"]}
              onDecision={handleMakeDecision}
              loggedDecision={getDecisionForCase(1)}
            />
          )}

          {/* ========================================================================= */}
          {/* Case 2: Anomaly Detection (Statistical) */}
          {/* ========================================================================= */}
          {case2Data && (
            <DecisionCard
              caseId={2}
              aiLabel="Statistical Anomaly"
              title="ตรวจพบความเงียบรายงานที่ผิดปกติเชิงสถิติ (Silent Anomaly)"
              what={
                <div>
                  <strong>ฝ่ายรักษาความสะอาด ในพื้นที่ โซน C (อาหารทะเล)</strong> ขาดการลงบันทึกรายงาน 
                  <strong style={{ color: "var(--gold)" }}> ติดต่อกันเป็นเวลา 5 วัน</strong> ทั้งที่ปกติมีรายงานเข้ามาทุกวัน
                </div>
              }
              why={
                <div>
                  เปรียบเทียบสถิติรายงาน: <strong>ค่าเฉลี่ยปกติ 3.0 ครั้ง/วัน</strong> แต่ช่วง 5 วันล่าสุดเท่ากับ 
                  <strong> 0.0 ครั้ง/วัน (Z-Score: {case2Data.zScore})</strong> 
                  ซึ่งเข้าเกณฑ์ความผิดปกติเชิงสถิติ (คาดว่าอาจเป็นการละเลยไม่ส่งรายงาน ไม่ใช่เพราะไม่มีปัญหาเกิดขึ้นจริง)
                </div>
              }
              decisions={["สั่งส่งทีมสืบสวนลงพื้นที่จริงด่วน", "ติดต่อชี้แจงหัวหน้าโซน C โดยตรง", "เฝ้าระวังและรอข้อมูลอีก 24 ชม."]}
              onDecision={handleMakeDecision}
              loggedDecision={getDecisionForCase(2)}
            />
          )}

          {/* ========================================================================= */}
          {/* Case 3: Festival Staffing Forecasting (Predictive) */}
          {/* ========================================================================= */}
          {case3Data && (
            <DecisionCard
              caseId={3}
              aiLabel="Predictive Model"
              title="พยากรณ์อัตรากำลังคนปฏิบัติงานเสริมช่วงเทศกาล (Festival Forecasting)"
              what={
                <div>
                  คาดการณ์ต้องการอัตรากำลังพนักงานเสริมเพิ่มเติม 
                  <strong style={{ color: "var(--green)" }}> จำนวน +{case3Data.forecastedStaff} คน</strong> ในช่วงเทศกาลสงกรานต์นี้
                </div>
              }
              why={
                <div>
                  วิเคราะห์ข้อมูลเปรียบเทียบสงกรานต์ปีที่ผ่านมา: ปริมาณลูกค้าตลาดเพิ่มขึ้น 40% และมีปริมาณปัญหาร้องเรียนด้านสุขาภิบาล/ความสะอาด 
                  <strong>เพิ่มขึ้น 40% ในทิศทางเดียวกัน</strong> โดยปีก่อนใช้พนักงานเสริมรวม 8 คน และได้ผลลัพธ์เป็นปกติ
                  <br />
                  <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)", display: "block", marginTop: 6 }}>
                    *หมายเหตุ: นี่คือการพยากรณ์อ้างอิงตาม Seasonal Factor ปีก่อนหน้า ไม่ใช่จำนวนยอดจริง
                  </span>
                </div>
              }
              decisions={["อนุมัติจ้างพนักงาน Part-time 8 คน", "อนุมัติจ้างกำลังคนบางส่วน (4 คน)", "ไม่อนุมัติและคงจำนวนกำลังพลเดิม"]}
              onDecision={handleMakeDecision}
              loggedDecision={getDecisionForCase(3)}
            />
          )}

          {/* ========================================================================= */}
          {/* Case 4: Multi-criteria Repair Priority (Scoring Weight) */}
          {/* ========================================================================= */}
          {case4Data && (
            <DecisionCard
              caseId={4}
              aiLabel="Scoring Model"
              title="จัดลำดับความจำเป็นงานซ่อมบำรุงเร่งด่วน (Backlog Prioritization)"
              what={
                <div>
                  งบประมาณซ่อมแซมจำกัด สามารถซ่อมบำรุงได้เพียง <strong>2 จุดจากทั้งหมด 5 จุด</strong> ที่มีปัญหาค้างอยู่ 
                  ระบบจึงทำการคำนวณและแนะนำ 2 ลำดับแรกที่ต้องซ่อมด่วนที่สุด
                </div>
              }
              why={
                <div style={{ marginTop: 8 }}>
                  <p style={{ margin: "0 0 10px 0" }}>ระบบเรียงคะแนนลำดับความสำคัญจาก (ความถี่ปัญหา × ความรุนแรง × ผลกระทบแผงค้า):</p>
                  <table className="backlog-table">
                    <thead>
                      <tr>
                        <th>พื้นที่</th>
                        <th>ความถี่พบ</th>
                        <th>ความรุนแรง</th>
                        <th>ร้านค้าที่กระทบ</th>
                        <th>คะแนนรวม (เต็ม 100)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {case4Data.map((item, idx) => (
                        <tr key={item.zone} style={idx < 2 ? { fontWeight: 600, background: "rgba(63, 125, 92, 0.08)" } : {}}>
                          <td>{item.zone} {idx < 2 && <span className="rec-star">★ แนะนำ</span>}</td>
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
              decisions={["อนุมัติโครงการซ่อมแซมตามลำดับที่แนะนำ (โซน A และ D)", "ปรับปรุงสลับลำดับความสำคัญเอง", "อนุมัติงบเสริมเร่งด่วนซ่อมทั้งหมด 5 จุด"]}
              onDecision={handleMakeDecision}
              loggedDecision={getDecisionForCase(4)}
            />
          )}

          <div style={{ margin: "32px 0 20px 0", borderBottom: "2px solid var(--line)" }} />

          {/* ========================================================================= */}
          {/* Case 6: Conversational Copilot (RAG Chat) */}
          {/* ========================================================================= */}
          <div className="card copilot-panel" id="case-6">
            <div className="ai-tag-wrapper">
              <span className="ai-tag rag-tag">Generative AI + RAG</span>
            </div>
            
            <h3 className="font-display" style={{ margin: "0 0 4px 0", fontSize: "1.2rem" }}>
              💬 ผู้ช่วยผู้บริหารส่วนบุคคล (Executive Copilot)
            </h3>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.85rem", margin: "0 0 20px 0" }}>
              คุณสามารถพิมพ์ถามคำถามทั่วไป หรือคลิกเลือกคำถามสำเร็จรูปด้านล่างเพื่อตรวจสอบข้อมูลจริงได้ทันที
            </p>

            {/* Suggested quick questions */}
            <div className="copilot-suggestions">
              <button 
                type="button" 
                className="suggestion-chip"
                onClick={() => handleSendCopilotQuery("ฝ่ายไหนมีเรื่องร้องเรียนบ่อยสุดเดือนนี้ และควรทำอะไรก่อน")}
              >
                🔎 สรุปปัญหาที่ค้างทั้งหมดในสัปดาห์นี้
              </button>
              <button 
                type="button" 
                className="suggestion-chip"
                onClick={() => handleSendCopilotQuery("ตรวจพบอะไรเงียบผิดปกติในสถิติข้อมูลบ้างไหม")}
              >
                🔎 ตรวจจับความเงียบผิดปกติของรายงาน
              </button>
              <button 
                type="button" 
                className="suggestion-chip"
                onClick={() => handleSendCopilotQuery("จัดอันดับงานซ่อมบำรุงที่ต้องอนุมัติก่อน")}
              >
                🔎 จัดอันดับงานซ่อมที่จำเป็นที่สุด
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="copilot-chat-box" id="copilot-chat-box">
              {copilotMessages.length === 0 && (
                <p className="chat-empty-state">ยังไม่มีการพิมพ์สอบถามข้อมูล...</p>
              )}
              {copilotMessages.map((msg, idx) => (
                <div key={idx} className={`chat-bubble ${msg.role}`}>
                  <div className="sender-name">{msg.role === "user" ? "👤 คุณ" : "🤖 Executive Copilot"}</div>
                  <div className="bubble-text" style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                  
                  {/* If assistant response suggests a decision button */}
                  {msg.role === "assistant" && msg.hasDecision && msg.suggestedDecisions && (
                    <div className="copilot-inline-decision">
                      <p style={{ margin: "10px 0 6px 0", fontSize: "0.8rem", fontWeight: "bold" }}>🎯 เลือกสั่งการด่วนตรงนี้:</p>
                      <div className="inline-dec-buttons">
                        {msg.suggestedDecisions.map(btnText => (
                          <button
                            key={btnText}
                            type="button"
                            className="btn decision-btn inline-btn"
                            onClick={() => {
                              handleMakeDecision(6, `[จากแชท] ${btnText}`);
                              // Add a confirmation msg
                              setCopilotMessages(prev => [
                                ...prev,
                                { role: "assistant", text: `✓ รับทราบข้อสั่งการ: "${btnText}" และทำการบันทึกลงสมุดบันทึกของผู้บริหารเรียบร้อยครับ` }
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
                  <span>🤖 กำลังอ่านรายงานและพิมพ์ตอบกลับ...</span>
                </div>
              )}
            </div>

            {/* Chat Input panel */}
            <div className="copilot-chat-input-bar">
              <input
                type="text"
                placeholder="เช่น รถตรวจการณ์ทะเบียน กข-1234 ทำไมถึงวิกฤต..."
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
              <h3 className="font-display">📝 บันทึกการตัดสินใจวันนี้</h3>
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
                ผู้บริหารยังไม่ได้ทำการกดยืนยันการตัดสินใจสำหรับหัวข้อในวันนี้
              </p>
            ) : (
              <div className="audit-timeline">
                {loggedDecisions.map((dec) => (
                  <div key={dec.id} className="audit-timeline-item">
                    <span className="audit-case-dot">Case {dec.caseId}</span>
                    <div className="audit-details">
                      <strong>อนุมัติข้อตกลง:</strong> &ldquo;{dec.decisionText}&rdquo;
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
        /* Executive Page Grids */
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

        /* Briefing specific elements */
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
