import { useState, useEffect, useRef } from "react";
import Layout from "../components/Layout";
import StatusStamp from "../components/StatusStamp";
import { ZONES, STAFF_NAMES, statusMeta } from "../lib/constants";
import { 
  getDepartments, 
  getWorkPackages, 
  getActivities, 
  getFormTemplate, 
  addReport, 
  deriveSubmissionStatus 
} from "../lib/storage";

const today = () => new Date().toISOString().slice(0, 10);

export default function ReportPage() {
  const [departments, setDepartments] = useState([]);
  const [workPackages, setWorkPackages] = useState([]);
  const [activities, setActivities] = useState([]);

  // Wizard state
  const [step, setStep] = useState(1); // 1: Dept, 2: WP, 3: Activity, 4: Form
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedWP, setSelectedWP] = useState(null);
  const [selectedAct, setSelectedAct] = useState(null);
  const [template, setTemplate] = useState(null);

  // Form input state
  const [metadata, setMetadata] = useState({
    date: today(),
    staffName: STAFF_NAMES[0],
    zone: ZONES[0],
  });
  const [answers, setAnswers] = useState({}); // { questionId: value }
  const [savedReport, setSavedReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setDepartments(getDepartments());
    setWorkPackages(getWorkPackages());
    setActivities(getActivities());
  }, []);

  // Filter lists based on selections
  const filteredWPs = workPackages.filter(wp => wp.departmentId === selectedDept?.id);
  const filteredActs = activities.filter(act => act.workPackageId === selectedWP?.id);

  function handleSelectDept(dept) {
    setSelectedDept(dept);
    setSelectedWP(null);
    setSelectedAct(null);
    setStep(2);
  }

  function handleSelectWP(wp) {
    setSelectedWP(wp);
    setSelectedAct(null);
    setStep(3);
  }

  function handleSelectAct(act) {
    setSelectedAct(act);
    const tmpl = getFormTemplate(act.id);
    setTemplate(tmpl);
    
    // Initialize empty answers state
    const initialAnswers = {};
    tmpl.questions.forEach(q => {
      if (q.type === "checkbox_group") {
        initialAnswers[q.id] = [];
      } else if (q.type === "yes_no") {
        initialAnswers[q.id] = "";
      } else {
        initialAnswers[q.id] = "";
      }
    });
    setAnswers(initialAnswers);
    setSavedReport(null);
    setError("");
    setStep(4);
  }

  function handleAnswerChange(questionId, value) {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
    setSavedReport(null);
  }

  function handleCheckboxChange(questionId, option, checked) {
    const current = answers[questionId] || [];
    let updated;
    if (checked) {
      updated = [...current, option];
    } else {
      updated = current.filter(o => o !== option);
    }
    handleAnswerChange(questionId, updated);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Validate required questions
    for (const q of template.questions) {
      const val = answers[q.id];
      if (q.required) {
        if (q.type === "checkbox_group" && (!val || val.length === 0)) {
          setError(`กรุณากรอกข้อมูล: ${q.label}`);
          return;
        }
        if (q.type !== "checkbox_group" && (val === undefined || val === null || val === "")) {
          setError(`กรุณากรอกข้อมูล: ${q.label}`);
          return;
        }
      }
    }

    // Format answers array as { questionId, label, value }
    const answersList = template.questions.map(q => ({
      questionId: q.id,
      label: q.label,
      value: answers[q.id]
    }));

    // Auto-calculate status from flagIf rules
    const derivedStatus = deriveSubmissionStatus(answersList, template.questions);

    const submission = {
      formTemplateId: template.id,
      activityId: selectedAct.id,
      workPackageId: selectedWP.id,
      departmentId: selectedDept.id,
      submittedBy: metadata.staffName,
      submittedAt: new Date().toISOString(),
      date: metadata.date,
      zone: metadata.zone,
      answers: answersList,
      derivedStatus
    };

    const record = addReport(submission);
    setSavedReport(record);
    
    // Clear form answers but keep metadata
    const resetAnswers = {};
    template.questions.forEach(q => {
      resetAnswers[q.id] = q.type === "checkbox_group" ? [] : "";
    });
    setAnswers(resetAnswers);
  }

  return (
    <Layout>
      {/* Breadcrumb wizard navigation */}
      <div className="wizard-breadcrumb">
        <span className={step >= 1 ? "active" : ""} onClick={() => setStep(1)}>1. เลือกฝ่าย</span>
        <span className="arrow">➔</span>
        <span className={step >= 2 ? "active" : ""} onClick={() => { if (selectedDept) setStep(2); }}>2. WP งานหลัก</span>
        <span className="arrow">➔</span>
        <span className={step >= 3 ? "active" : ""} onClick={() => { if (selectedWP) setStep(3); }}>3. กิจกรรม</span>
        <span className="arrow">➔</span>
        <span className={step >= 4 ? "active" : ""}>4. บันทึกข้อมูล</span>
      </div>

      <div className="page-head" style={{ marginTop: 16 }}>
        <p className="eyebrow">เจ้าหน้าที่ปฏิบัติงาน</p>
        <h1>บันทึกงานประจำวัน</h1>
        <p>กรอกรายงานการปฏิบัติงานย่อย โดยระบบจะสรุปและคำนวณสถานะแจ้งเตือนแบบเรียลไทม์</p>
      </div>

      {/* Step 1: Select Department */}
      {step === 1 && (
        <div>
          <h3 className="section-title">กรุณาเลือกฝ่ายงานของคุณ</h3>
          <div className="dept-grid">
            {departments.map((dept) => (
              <div 
                key={dept.id} 
                className={`dept-card border-${dept.colorTag}`}
                onClick={() => handleSelectDept(dept)}
              >
                <span className="dept-icon">{dept.icon}</span>
                <h2>{dept.name}</h2>
                <p>คลิกเพื่อเลือกบันทึกงานในความรับผิดชอบของ{dept.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select Work Package */}
      {step === 2 && (
        <div>
          <div className="step-back-banner">
            <span>ฝ่ายที่เลือก: <strong>{selectedDept?.icon} {selectedDept?.name}</strong></span>
            <button className="btn secondary small-btn" onClick={() => setStep(1)}>ย้อนกลับ</button>
          </div>
          <h3 className="section-title">กรุณาเลือกงานหลัก (Work Package)</h3>
          
          {filteredWPs.length === 0 ? (
            <p className="empty-note">ยังไม่มีการตั้งค่า Work Package สำหรับฝ่ายนี้</p>
          ) : (
            <div className="wp-list">
              {filteredWPs.map((wp) => (
                <div key={wp.id} className="wp-card" onClick={() => handleSelectWP(wp)}>
                  <div className="wp-info">
                    <h4>{wp.name}</h4>
                    <p>{wp.description}</p>
                  </div>
                  <span className="freq-badge">{wp.frequency}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Select Activity */}
      {step === 3 && (
        <div>
          <div className="step-back-banner">
            <span>งานหลัก: <strong>{selectedWP?.name}</strong></span>
            <button className="btn secondary small-btn" onClick={() => setStep(2)}>ย้อนกลับ</button>
          </div>
          <h3 className="section-title">กรุณาเลือกกิจกรรมย่อย (Activity)</h3>

          {filteredActs.length === 0 ? (
            <p className="empty-note">ยังไม่มีการตั้งค่ากิจกรรมสำหรับ Work Package นี้</p>
          ) : (
            <div className="wp-list">
              {filteredActs.map((act) => (
                <div key={act.id} className="wp-card" onClick={() => handleSelectAct(act)}>
                  <div className="wp-info">
                    <h4>{act.name}</h4>
                    <p>{act.description}</p>
                  </div>
                  <span className="arrow-next">➔</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Render Dynamic Form */}
      {step === 4 && selectedAct && template && (
        <div>
          <div className="step-back-banner">
            <span>กิจกรรม: <strong>{selectedAct.name}</strong></span>
            <button className="btn secondary small-btn" onClick={() => setStep(3)}>ย้อนกลับไปยังกิจกรรม</button>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h2 style={{ margin: "0 0 8px 0", fontFamily: "var(--font-display)" }}>
              {selectedAct.name}
            </h2>
            <p style={{ color: "var(--ink-soft)", margin: "0 0 24px 0", fontSize: "0.92rem" }}>
              {selectedAct.description}
            </p>

            <form onSubmit={handleSubmit}>
              <h3 className="form-sub-title">1. ข้อมูลปฏิบัติงานเบื้องต้น</h3>
              <div className="grid grid-3">
                <div className="field">
                  <label>วันที่ปฏิบัติงาน</label>
                  <input
                    type="date"
                    value={metadata.date}
                    onChange={(e) => setMetadata(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>ชื่อผู้บันทึก</label>
                  <select
                    value={metadata.staffName}
                    onChange={(e) => setMetadata(prev => ({ ...prev, staffName: e.target.value }))}
                    required
                  >
                    {STAFF_NAMES.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>พื้นที่ / โซน</label>
                  <select
                    value={metadata.zone}
                    onChange={(e) => setMetadata(prev => ({ ...prev, zone: e.target.value }))}
                    required
                  >
                    {ZONES.map((zone) => (
                      <option key={zone}>{zone}</option>
                    ))}
                  </select>
                </div>
              </div>

              <h3 className="form-sub-title" style={{ marginTop: 24 }}>2. รายละเอียดการประเมิน</h3>

              {template.questions.length === 0 ? (
                <div className="empty-questions-alert">
                  <p>⚠️ ยังไม่ได้กำหนดชุดคำถามในฟอร์มของกิจกรรมนี้</p>
                  <p style={{ fontSize: "0.85rem", marginTop: 4 }}>กรุณาแจ้งผู้ดูแลระบบให้เข้าไปตั้งค่า Form Template ในหน้าผู้ดูแลระบบ (Admin)</p>
                </div>
              ) : (
                template.questions.map((q) => (
                  <div key={q.id} className="field form-field-box">
                    <label style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--ink)" }}>
                      {q.label} {q.required && <span style={{ color: "var(--red)" }}>*</span>}
                    </label>

                    {/* Question type: YES/NO */}
                    {q.type === "yes_no" && (
                      <div className="yes-no-group">
                        <button
                          type="button"
                          className={`yes-no-btn yes ${answers[q.id] === "yes" ? "selected" : ""}`}
                          onClick={() => handleAnswerChange(q.id, "yes")}
                        >
                          ใช่ / ปกติ
                        </button>
                        <button
                          type="button"
                          className={`yes-no-btn no ${answers[q.id] === "no" ? "selected" : ""}`}
                          onClick={() => handleAnswerChange(q.id, "no")}
                        >
                          ไม่ใช่ / พบปัญหา
                        </button>
                      </div>
                    )}

                    {/* Question type: CHECKBOX_GROUP */}
                    {q.type === "checkbox_group" && (
                      <div className="checkbox-options-grid">
                        {(q.options || []).map((opt) => (
                          <label key={opt} className="checkbox-option">
                            <input
                              type="checkbox"
                              checked={(answers[q.id] || []).includes(opt)}
                              onChange={(e) => handleCheckboxChange(q.id, opt, e.target.checked)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                        {q.flagIf && (
                          <div className="flag-hint-text">
                            * ติ๊กเฉพาะรายการที่ผ่านเกณฑ์ ส่วนที่ไม่ติ๊กจะถูกระบบแจ้งสถานะเป็น <strong>{q.flagIf.setStatus}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Question type: SINGLE_CHOICE */}
                    {q.type === "single_choice" && (
                      <select
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        required={q.required}
                      >
                        <option value="">-- กรุณาเลือก --</option>
                        {(q.options || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}

                    {/* Question type: TEXT */}
                    {q.type === "text" && (
                      <textarea
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        placeholder="กรอกรายละเอียด..."
                        required={q.required}
                      />
                    )}

                    {/* Question type: NUMBER */}
                    {q.type === "number" && (
                      <input
                        type="number"
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        placeholder="กรอกตัวเลข..."
                        required={q.required}
                      />
                    )}

                    {/* Question type: PHOTO (Mock image selection to preserve localStorage capacity) */}
                    {q.type === "photo" && (
                      <PhotoInput 
                        value={answers[q.id] || ""}
                        onChange={(val) => handleAnswerChange(q.id, val)}
                      />
                    )}

                    {/* Question type: SIGNATURE (Canvas signature pad) */}
                    {q.type === "signature" && (
                      <SignatureInput
                        value={answers[q.id] || ""}
                        onChange={(val) => handleAnswerChange(q.id, val)}
                      />
                    )}
                  </div>
                ))
              )}

              {error && (
                <div className="error-banner">
                  {error}
                </div>
              )}

              <div className="form-submit-footer">
                <button 
                  className="btn" 
                  type="submit" 
                  disabled={template.questions.length === 0}
                >
                  บันทึกข้อมูลรายงาน
                </button>

                {savedReport && (
                  <div className="save-success-banner">
                    <span style={{ fontSize: "0.9rem", color: "var(--ink-soft)" }}>บันทึกสำเร็จ สถานะประเมิน:</span>
                    <StatusStamp status={savedReport.derivedStatus} />
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled wizard elements inside the document */}
      <style jsx global>{`
        .wizard-breadcrumb {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--paper-raised);
          padding: 12px 20px;
          border-radius: var(--radius);
          border: 1px solid var(--line);
          font-size: 0.88rem;
          flex-wrap: wrap;
        }
        .wizard-breadcrumb span {
          color: var(--ink-soft);
          cursor: pointer;
        }
        .wizard-breadcrumb span.active {
          color: var(--ink);
          font-weight: 700;
        }
        .wizard-breadcrumb .arrow {
          color: var(--line);
          cursor: default;
        }
        
        .section-title {
          font-family: var(--font-display);
          margin: 24px 0 16px 0;
          font-weight: 600;
        }

        .step-back-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--paper-raised);
          border: 1px solid var(--line);
          padding: 10px 16px;
          border-radius: var(--radius);
          font-size: 0.9rem;
          margin-top: 10px;
        }
        .small-btn {
          padding: 6px 12px;
          font-size: 0.8rem;
        }

        /* Dept grid cards */
        .dept-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-top: 10px;
        }
        .dept-card {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 24px;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          box-shadow: var(--shadow-card);
        }
        .dept-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(35, 38, 31, 0.1);
        }
        .dept-icon {
          font-size: 2.2rem;
          display: block;
          margin-bottom: 12px;
        }
        .dept-card h2 {
          font-family: var(--font-display);
          font-size: 1.3rem;
          margin: 0 0 8px 0;
        }
        .dept-card p {
          color: var(--ink-soft);
          font-size: 0.88rem;
          margin: 0;
          line-height: 1.5;
        }
        .border-green { border-top: 5px solid var(--green); }
        .border-navy { border-top: 5px solid #283747; }
        .border-gold { border-top: 5px solid var(--gold); }

        /* WP activity list */
        .wp-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .wp-card {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          box-shadow: var(--shadow-card);
          transition: background 0.15s ease;
        }
        .wp-card:hover {
          background: rgba(35, 38, 31, 0.03);
        }
        .wp-info h4 {
          margin: 0 0 4px 0;
          font-size: 1rem;
        }
        .wp-info p {
          margin: 0;
          color: var(--ink-soft);
          font-size: 0.85rem;
        }
        .freq-badge {
          background: var(--gold-soft);
          color: #6b4c14;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 99px;
          text-transform: uppercase;
        }
        .arrow-next {
          color: var(--ink-soft);
          font-weight: bold;
        }

        /* Form dynamic styling */
        .form-sub-title {
          font-family: var(--font-display);
          border-bottom: 1px solid var(--line);
          padding-bottom: 8px;
          margin-bottom: 16px;
          font-weight: 600;
        }
        .form-field-box {
          background: rgba(255, 255, 255, 0.4);
          padding: 16px;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          margin-bottom: 20px;
        }
        
        .empty-questions-alert {
          background: var(--gold-soft);
          border: 1px solid var(--gold);
          color: #6b4c14;
          padding: 20px;
          border-radius: var(--radius);
          text-align: center;
          margin-bottom: 20px;
        }

        /* Yes No button group */
        .yes-no-group {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }
        .yes-no-btn {
          flex: 1;
          padding: 12px;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          background: #fff;
          color: var(--ink-soft);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .yes-no-btn:hover {
          background: var(--paper);
        }
        .yes-no-btn.yes.selected {
          background: var(--green-soft);
          border-color: var(--green);
          color: var(--green);
        }
        .yes-no-btn.no.selected {
          background: var(--red-soft);
          border-color: var(--red);
          color: var(--red);
        }

        /* Checkbox grid */
        .checkbox-options-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
          margin-top: 8px;
        }
        .checkbox-option {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 0.92rem;
          padding: 6px;
        }
        .checkbox-option input {
          width: auto;
          cursor: pointer;
        }
        .flag-hint-text {
          grid-column: 1 / -1;
          font-size: 0.78rem;
          color: var(--ink-soft);
          margin-top: 4px;
        }

        /* Error banner */
        .error-banner {
          background: var(--red-soft);
          color: var(--red);
          border: 1px solid var(--red);
          padding: 12px 16px;
          border-radius: var(--radius);
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .form-submit-footer {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-top: 24px;
        }

        .save-success-banner {
          display: flex;
          align-items: center;
          gap: 12px;
        }
      `}</style>
    </Layout>
  );
}

// Sub-component: Signature Canvas Pad
function SignatureInput({ value, onChange }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#23261f";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    // Set high-dpi support
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Load initial signature if exists
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = value;
    }
  }, [value]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Check Touch Event vs Mouse Event
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawing.current = true;
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL());
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="sig-container">
      <div className="sig-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="sig-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="sig-toolbar">
        <span className="sig-hint">กรุณาใช้นิ้วหรือเมาส์ลากเซ็นชื่อในช่องสี่เหลี่ยม</span>
        <button type="button" className="btn secondary small-btn" onClick={handleClear}>
          ล้างลายเซ็น
        </button>
      </div>

      <style jsx>{`
        .sig-container {
          margin-top: 8px;
        }
        .sig-canvas-wrapper {
          border: 2px dashed var(--line);
          background: #fff;
          border-radius: var(--radius);
          overflow: hidden;
        }
        .sig-canvas {
          width: 100%;
          height: 140px;
          cursor: crosshair;
          display: block;
        }
        .sig-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
        }
        .sig-hint {
          font-size: 0.78rem;
          color: var(--ink-soft);
        }
      `}</style>
    </div>
  );
}

// Sub-component: Photo Upload Mock Input
function PhotoInput({ value, onChange }) {
  // Available mockup images
  const MOCK_PHOTOS = [
    { name: "ภาพถ่ายปกติ 1", url: "/mock_photo_1.jpg", thumb: "🟢 ภาพถ่ายสภาพเรียบร้อย" },
    { name: "ภาพถ่ายไม่สวมหมวกนิรภัย", url: "/mock_photo_no_helmet.jpg", thumb: "⚠️ มีพนักงานไม่สวมหมวกนิรภัย" },
    { name: "ภาพถ่ายพบเศษขยะสะสม", url: "/mock_photo_trash.jpg", thumb: "⚠️ พบขยะตกค้างโซน A" },
    { name: "ภาพถ่ายห้องน้ำสกปรก", url: "/mock_photo_dirty_toilet.jpg", thumb: "⚠️ พื้นห้องน้ำเปียกสกปรก" }
  ];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        // Compress base64 to avoid local storage quota limits
        onChange(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="photo-input-container">
      <div className="upload-btn-wrapper">
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange} 
          style={{ marginBottom: 10 }}
        />
        <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)", margin: "4px 0 10px 0" }}>
          หรือเลือกภาพตัวอย่างเดโมเพื่อจำลองการตรวจสอบ:
        </div>
        <div className="mock-grid">
          {MOCK_PHOTOS.map(p => (
            <button
              key={p.url}
              type="button"
              className={`mock-photo-btn ${value === p.url ? "active" : ""}`}
              onClick={() => onChange(p.url)}
            >
              {p.thumb}
            </button>
          ))}
        </div>
      </div>

      {value && (
        <div className="photo-preview-box">
          <p className="preview-label">ตัวอย่างภาพถ่าย:</p>
          {value.startsWith("data:") ? (
            <img src={value} alt="Preview" className="img-preview" />
          ) : (
            <div className="mock-image-container">
              <span className="photo-icon">📷</span>
              <strong>{MOCK_PHOTOS.find(p => p.url === value)?.name || value}</strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem" }}>[จำลองการเชื่อมต่อโมเดล Vision ใน Phase 2]</p>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .photo-input-container {
          margin-top: 8px;
        }
        .mock-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }
        .mock-photo-btn {
          padding: 8px;
          font-size: 0.8rem;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: var(--radius);
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }
        .mock-photo-btn:hover {
          background: var(--paper);
        }
        .mock-photo-btn.active {
          border-color: var(--gold);
          background: var(--gold-soft);
          font-weight: 600;
        }
        .photo-preview-box {
          margin-top: 12px;
          border: 1px solid var(--line);
          padding: 12px;
          background: var(--paper);
          border-radius: var(--radius);
        }
        .preview-label {
          margin: 0 0 6px 0;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .img-preview {
          max-width: 100%;
          max-height: 200px;
          display: block;
          border-radius: 3px;
        }
        .mock-image-container {
          border: 1px dashed var(--ink-soft);
          padding: 20px;
          border-radius: 4px;
          text-align: center;
          color: var(--ink-soft);
        }
        .photo-icon {
          font-size: 1.8rem;
          display: block;
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
}
