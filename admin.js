import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { 
  getDepartments, 
  getWorkPackages, 
  addWorkPackage, 
  updateWorkPackage, 
  deleteWorkPackage, 
  getActivities, 
  addActivity, 
  updateActivity, 
  deleteActivity, 
  getFormTemplate, 
  saveFormTemplate 
} from "../lib/storage";

export default function AdminPage() {
  const [departments, setDepartments] = useState([]);
  const [wps, setWps] = useState([]);
  const [acts, setActs] = useState([]);

  // Selections
  const [activeDept, setActiveDept] = useState(null);
  const [activeWp, setActiveWp] = useState(null);
  const [activeAct, setActiveAct] = useState(null);
  const [template, setTemplate] = useState(null);

  // Forms states
  const [wpForm, setWpForm] = useState({ id: "", name: "", description: "", frequency: "daily" });
  const [actForm, setActForm] = useState({ id: "", name: "", description: "" });
  const [showWpForm, setShowWpForm] = useState(false);
  const [showActForm, setShowActForm] = useState(false);

  // Question editing state
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [newQuestion, setNewQuestion] = useState({
    label: "",
    type: "yes_no",
    optionsString: "",
    required: false,
    hasFlag: false,
    flagValue: "",
    flagStatus: "ต้องติดตาม"
  });

  useEffect(() => {
    const depts = getDepartments();
    setDepartments(depts);
    setWps(getWorkPackages());
    setActs(getActivities());
    
    if (depts.length > 0) {
      setActiveDept(depts[0]);
    }
  }, []);

  // Filtered lists
  const deptWps = wps.filter(wp => wp.departmentId === activeDept?.id);
  const wpActs = acts.filter(act => act.workPackageId === activeWp?.id);

  // WP CRUD Handlers
  function handleSaveWp(e) {
    e.preventDefault();
    if (!wpForm.name.trim()) return;

    if (wpForm.id) {
      // Edit
      const updated = updateWorkPackage({
        id: wpForm.id,
        departmentId: activeDept.id,
        name: wpForm.name,
        description: wpForm.description,
        frequency: wpForm.frequency
      });
      setWps(prev => prev.map(item => item.id === updated.id ? updated : item));
      if (activeWp?.id === wpForm.id) setActiveWp(updated);
    } else {
      // Create
      const created = addWorkPackage({
        departmentId: activeDept.id,
        name: wpForm.name,
        description: wpForm.description,
        frequency: wpForm.frequency
      });
      setWps(prev => [...prev, created]);
    }
    
    setWpForm({ id: "", name: "", description: "", frequency: "daily" });
    setShowWpForm(false);
  }

  function handleEditWp(wp) {
    setWpForm(wp);
    setShowWpForm(true);
  }

  function handleDeleteWp(id) {
    if (confirm("คุณแน่ใจว่าต้องการลบ Work Package นี้? การลบจะลบกิจกรรมและเทมเพลตฟอร์มย่อยทั้งหมดด้วย")) {
      deleteWorkPackage(id);
      setWps(prev => prev.filter(item => item.id !== id));
      setActs(prev => prev.filter(a => a.workPackageId !== id));
      if (activeWp?.id === id) {
        setActiveWp(null);
        setActiveAct(null);
        setTemplate(null);
      }
    }
  }

  // Activity CRUD Handlers
  function handleSaveAct(e) {
    e.preventDefault();
    if (!actForm.name.trim() || !activeWp) return;

    if (actForm.id) {
      // Edit
      const updated = updateActivity({
        id: actForm.id,
        workPackageId: activeWp.id,
        name: actForm.name,
        description: actForm.description
      });
      setActs(prev => prev.map(item => item.id === updated.id ? updated : item));
      if (activeAct?.id === actForm.id) setActiveAct(updated);
    } else {
      // Create
      const created = addActivity({
        workPackageId: activeWp.id,
        name: actForm.name,
        description: actForm.description
      });
      setActs(prev => [...prev, created]);
    }

    setActForm({ id: "", name: "", description: "" });
    setShowActForm(false);
  }

  function handleEditAct(act) {
    setActForm(act);
    setShowActForm(true);
  }

  function handleDeleteAct(id) {
    if (confirm("คุณแน่ใจว่าต้องการลบกิจกรรมนี้? เทมเพลตคำถามจะถูกลบไปด้วย")) {
      deleteActivity(id);
      setActs(prev => prev.filter(item => item.id !== id));
      if (activeAct?.id === id) {
        setActiveAct(null);
        setTemplate(null);
      }
    }
  }

  // Load template for selected activity
  function selectActivity(act) {
    setActiveAct(act);
    const tmpl = getFormTemplate(act.id);
    setTemplate(tmpl);
    setEditingQuestion(null);
    setNewQuestion({
      label: "",
      type: "yes_no",
      optionsString: "",
      required: false,
      hasFlag: false,
      flagValue: "",
      flagStatus: "ต้องติดตาม"
    });
  }

  // FormTemplate Questions Management
  function handleAddQuestion() {
    if (!newQuestion.label.trim()) return;

    const options = newQuestion.optionsString
      ? newQuestion.optionsString.split(",").map(o => o.trim()).filter(Boolean)
      : [];

    const flagIf = newQuestion.hasFlag
      ? { value: newQuestion.flagValue, setStatus: newQuestion.flagStatus }
      : undefined;

    const qRecord = {
      id: `q-${Date.now()}`,
      label: newQuestion.label,
      type: newQuestion.type,
      options: options.length > 0 ? options : undefined,
      required: newQuestion.required,
      flagIf
    };

    const updatedTmpl = {
      ...template,
      questions: [...template.questions, qRecord]
    };

    setTemplate(updatedTmpl);
    saveFormTemplate(updatedTmpl);

    // Reset input form
    setNewQuestion({
      label: "",
      type: "yes_no",
      optionsString: "",
      required: false,
      hasFlag: false,
      flagValue: "",
      flagStatus: "ต้องติดตาม"
    });
  }

  function handleDeleteQuestion(qId) {
    const updatedTmpl = {
      ...template,
      questions: template.questions.filter(q => q.id !== qId)
    };
    setTemplate(updatedTmpl);
    saveFormTemplate(updatedTmpl);
  }

  return (
    <Layout>
      <div className="page-head">
        <p className="eyebrow">ผู้ดูแลระบบ (Admin)</p>
        <h1>จัดการระบบและโครงสร้างงาน</h1>
        <p>แก้ไข จัดหมวดหมู่ เพิ่มกิจกรรมย่อย และสร้างแบบฟอร์มการประเมินคำถาม (Form Schema) ได้แบบเรียลไทม์</p>
      </div>

      {/* Tabs for Department selection */}
      <div className="admin-tabs">
        {departments.map(dept => (
          <button
            key={dept.id}
            className={`tab-btn ${activeDept?.id === dept.id ? "active" : ""}`}
            onClick={() => {
              setActiveDept(dept);
              setActiveWp(null);
              setActiveAct(null);
              setTemplate(null);
            }}
          >
            <span style={{ marginRight: 6 }}>{dept.icon}</span> {dept.name}
          </button>
        ))}
      </div>

      <div className="admin-panel-grid">
        {/* Panel 1: Work Packages list */}
        <div className="panel card">
          <div className="panel-header">
            <h3>WP งานหลัก</h3>
            <button 
              className="btn small-btn" 
              onClick={() => {
                setWpForm({ id: "", name: "", description: "", frequency: "daily" });
                setShowWpForm(true);
              }}
            >
              + เพิ่ม WP
            </button>
          </div>

          {showWpForm && (
            <form onSubmit={handleSaveWp} className="admin-inline-form">
              <h4>{wpForm.id ? "แก้ไข WP" : "สร้าง WP ใหม่"}</h4>
              <div className="field">
                <input
                  type="text"
                  placeholder="ชื่อหลักงาน (เช่น จัดการขยะ)"
                  value={wpForm.name}
                  onChange={(e) => setWpForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <textarea
                  placeholder="คำอธิบายลักษณะงาน..."
                  value={wpForm.description}
                  onChange={(e) => setWpForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="field">
                <select
                  value={wpForm.frequency}
                  onChange={(e) => setWpForm(prev => ({ ...prev, frequency: e.target.value }))}
                >
                  <option value="daily">daily (ทุกวัน)</option>
                  <option value="weekly">weekly (รายสัปดาห์)</option>
                  <option value="monthly">monthly (รายเดือน)</option>
                  <option value="on-demand">on-demand (ตามความต้องการ)</option>
                </select>
              </div>
              <div className="inline-buttons">
                <button type="submit" className="btn small-btn">บันทึก</button>
                <button 
                  type="button" 
                  className="btn secondary small-btn" 
                  onClick={() => setShowWpForm(false)}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          )}

          <div className="list-container">
            {deptWps.length === 0 ? (
              <p className="empty-note">ยังไม่มีข้อมูล</p>
            ) : (
              deptWps.map(wp => (
                <div 
                  key={wp.id} 
                  className={`list-item ${activeWp?.id === wp.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveWp(wp);
                    setActiveAct(null);
                    setTemplate(null);
                  }}
                >
                  <div className="item-text">
                    <strong>{wp.name}</strong>
                    <span className="meta">{wp.frequency}</span>
                  </div>
                  <div className="item-actions">
                    <button className="icon-btn" onClick={() => handleEditWp(wp)}>✏️</button>
                    <button className="icon-btn" onClick={() => handleDeleteWp(wp.id)}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel 2: Activities list */}
        <div className="panel card">
          <div className="panel-header">
            <h3>กิจกรรมย่อย</h3>
            <button 
              className="btn small-btn" 
              disabled={!activeWp}
              onClick={() => {
                setActForm({ id: "", name: "", description: "" });
                setShowActForm(true);
              }}
            >
              + เพิ่มกิจกรรม
            </button>
          </div>

          {!activeWp && (
            <p className="empty-note" style={{ marginTop: 20 }}>กรุณาเลือก Work Package ก่อน</p>
          )}

          {activeWp && showActForm && (
            <form onSubmit={handleSaveAct} className="admin-inline-form">
              <h4>{actForm.id ? "แก้ไขกิจกรรม" : "สร้างกิจกรรมใหม่"}</h4>
              <div className="field">
                <input
                  type="text"
                  placeholder="ชื่อกิจกรรม (เช่น ตรวจห้องน้ำ)"
                  value={actForm.name}
                  onChange={(e) => setActForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <textarea
                  placeholder="คำอธิบาย..."
                  value={actForm.description}
                  onChange={(e) => setActForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="inline-buttons">
                <button type="submit" className="btn small-btn">บันทึก</button>
                <button 
                  type="button" 
                  className="btn secondary small-btn" 
                  onClick={() => setShowActForm(false)}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          )}

          {activeWp && (
            <div className="list-container">
              {wpActs.length === 0 ? (
                <p className="empty-note">ยังไม่มีข้อมูลกิจกรรมย่อย</p>
              ) : (
                wpActs.map(act => (
                  <div 
                    key={act.id} 
                    className={`list-item ${activeAct?.id === act.id ? "active" : ""}`}
                    onClick={() => selectActivity(act)}
                  >
                    <div className="item-text">
                      <strong>{act.name}</strong>
                      <span className="meta">{act.description || "-"}</span>
                    </div>
                    <div className="item-actions">
                      <button className="icon-btn" onClick={() => handleEditAct(act)}>✏️</button>
                      <button className="icon-btn" onClick={() => handleDeleteAct(act.id)}>🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Panel 3: Form Template Designer */}
        <div className="panel card form-designer-panel">
          <div className="panel-header">
            <h3>คำถามในแบบฟอร์ม</h3>
          </div>

          {!activeAct && (
            <p className="empty-note" style={{ marginTop: 20 }}>กรุณาเลือกกิจกรรมเพื่อตั้งค่าแบบฟอร์ม</p>
          )}

          {activeAct && template && (
            <div className="designer-box">
              <div className="current-questions">
                <h4 style={{ margin: "0 0 10px 0" }}>คำถามที่กำหนดแล้ว ({template.questions.length} ข้อ):</h4>
                {template.questions.length === 0 ? (
                  <p className="empty-note">ยังไม่มีคำถามย่อย กรุณาเพิ่มคำถามด้านล่าง</p>
                ) : (
                  <div className="designer-q-list">
                    {template.questions.map((q, idx) => (
                      <div key={q.id} className="designer-q-item">
                        <div className="q-item-num">{idx + 1}</div>
                        <div className="q-item-content">
                          <strong>{q.label}</strong>
                          <div className="q-item-details">
                            <span className="q-type-badge">{q.type}</span>
                            {q.required && <span className="req-badge">required</span>}
                            {q.options && <span className="opt-count">{q.options.length} ตัวเลือก</span>}
                            {q.flagIf && (
                              <span className="flag-badge">
                                flag: &ldquo;{q.flagIf.value}&rdquo; ➔ {q.flagIf.setStatus}
                              </span>
                            )}
                          </div>
                        </div>
                        <button className="icon-btn delete-q-btn" onClick={() => handleDeleteQuestion(q.id)}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add question form block */}
              <div className="add-question-box">
                <h4>➕ เพิ่มคำถามในฟอร์มย่อย</h4>
                
                <div className="field">
                  <label>คำถาม / ป้ายกำกับ</label>
                  <input
                    type="text"
                    placeholder="เช่น พื้นแห้งไม่ลื่น, ถ่ายภาพสภาพรอบรถยนต์..."
                    value={newQuestion.label}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, label: e.target.value }))}
                  />
                </div>

                <div className="grid grid-2">
                  <div className="field">
                    <label>ประเภทข้อมูลตอบกลับ</label>
                    <select
                      value={newQuestion.type}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, type: e.target.value }))}
                    >
                      <option value="yes_no">yes_no (ใช่/ไม่ใช่)</option>
                      <option value="checkbox_group">checkbox_group (เช็คลิสต์ตรวจงาน)</option>
                      <option value="single_choice">single_choice (เลือกได้ช้อยส์เดียว)</option>
                      <option value="text">text (ข้อความบรรยาย)</option>
                      <option value="number">number (จำนวนตัวเลข)</option>
                      <option value="photo">photo (แนบภาพถ่าย)</option>
                      <option value="signature">signature (ลายเซ็นผู้ตรวจ)</option>
                    </select>
                  </div>
                  <div className="field" style={{ display: "flex", alignItems: "center", height: "100%", marginTop: 10 }}>
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={newQuestion.required}
                        onChange={(e) => setNewQuestion(prev => ({ ...prev, required: e.target.checked }))}
                      />
                      <span>จำเป็นต้องกรอก (Required)</span>
                    </label>
                  </div>
                </div>

                {/* Show options string input if checkbox_group or single_choice */}
                {(newQuestion.type === "checkbox_group" || newQuestion.type === "single_choice") && (
                  <div className="field">
                    <label>ตัวเลือกคำตอบ (คั่นด้วยสัญลักษณ์ลูกน้ำ `,` เช่น ยางรถ,เบรก,แตร)</label>
                    <input
                      type="text"
                      placeholder="ช้อยส์ 1, ช้อยส์ 2, ช้อยส์ 3"
                      value={newQuestion.optionsString}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, optionsString: e.target.value }))}
                    />
                  </div>
                )}

                {/* Flag condition config block */}
                <div className="flag-config-box">
                  <label className="checkbox-option" style={{ fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={newQuestion.hasFlag}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, hasFlag: e.target.checked }))}
                    />
                    <span>เปิดระบบ Auto-flag ตั้งค่าสถานะตามคำตอบ</span>
                  </label>

                  {newQuestion.hasFlag && (
                    <div className="grid grid-2" style={{ marginTop: 10 }}>
                      <div className="field">
                        <label>ถ้าคำตอบเท่ากับ (เงื่อนไข)</label>
                        {newQuestion.type === "checkbox_group" ? (
                          <select
                            value={newQuestion.flagValue}
                            onChange={(e) => setNewQuestion(prev => ({ ...prev, flagValue: e.target.value }))}
                          >
                            <option value="">-- เลือกเงื่อนไข --</option>
                            <option value="incomplete">incomplete (ติ๊กผ่านไม่ครบทุกรายการ)</option>
                          </select>
                        ) : newQuestion.type === "yes_no" ? (
                          <select
                            value={newQuestion.flagValue}
                            onChange={(e) => setNewQuestion(prev => ({ ...prev, flagValue: e.target.value }))}
                          >
                            <option value="">-- เลือกเงื่อนไข --</option>
                            <option value="yes">yes (คำตอบเป็น ใช่/ปกติ)</option>
                            <option value="no">no (คำตอบเป็น ไม่ใช่/พบปัญหา)</option>
                          </select>
                        ) : newQuestion.type === "number" ? (
                          <select
                            value={newQuestion.flagValue}
                            onChange={(e) => setNewQuestion(prev => ({ ...prev, flagValue: e.target.value }))}
                          >
                            <option value="">-- เลือกเงื่อนไข --</option>
                            <option value="not_zero">not_zero (ตัวเลขไม่เท่ากับ 0)</option>
                            <option value=">0">&gt;0 (ตัวเลขมากกว่า 0)</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="พิมพ์ค่าคำตอบแจ้งเตือน..."
                            value={newQuestion.flagValue}
                            onChange={(e) => setNewQuestion(prev => ({ ...prev, flagValue: e.target.value }))}
                          />
                        )}
                      </div>
                      <div className="field">
                        <label>ให้ตั้งค่าสถานะเป็น</label>
                        <select
                          value={newQuestion.flagStatus}
                          onChange={(e) => setNewQuestion(prev => ({ ...prev, flagStatus: e.target.value }))}
                        >
                          <option value="ต้องติดตาม">ต้องติดตาม (Warning)</option>
                          <option value="เร่งด่วน">เร่งด่วน (Urgent)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  type="button" 
                  className="btn" 
                  style={{ width: "100%", marginTop: 12, justifyContent: "center" }}
                  onClick={handleAddQuestion}
                >
                  ➕ เพิ่มคำถามนี้ลงแบบฟอร์ม
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .admin-tabs {
          display: flex;
          gap: 10px;
          border-bottom: 2px solid var(--line);
          padding-bottom: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .tab-btn {
          padding: 10px 20px;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--ink-soft);
          transition: all 0.15s ease;
        }
        .tab-btn:hover {
          background: var(--paper);
        }
        .tab-btn.active {
          background: var(--ink);
          color: var(--paper);
          border-color: var(--ink);
        }

        /* Admin layout grid */
        .admin-panel-grid {
          display: grid;
          grid-template-columns: 300px 320px 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1000px) {
          .admin-panel-grid {
            grid-template-columns: 1fr;
          }
        }

        .panel {
          padding: 18px;
          min-height: 480px;
          display: flex;
          flex-direction: column;
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--line);
          padding-bottom: 10px;
          margin-bottom: 14px;
        }
        .panel-header h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.15rem;
        }
        
        .list-container {
          overflow-y: auto;
          max-height: 420px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .list-item {
          padding: 10px 12px;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          background: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .list-item:hover {
          background: var(--paper);
        }
        .list-item.active {
          border-color: var(--ink);
          background: var(--paper);
          font-weight: 600;
        }
        .item-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }
        .item-text strong {
          font-size: 0.9rem;
        }
        .item-text .meta {
          font-size: 0.72rem;
          color: var(--ink-soft);
        }

        .item-actions {
          display: flex;
          gap: 4px;
          opacity: 0.3;
          transition: opacity 0.15s ease;
        }
        .list-item:hover .item-actions {
          opacity: 1;
        }
        .icon-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 0.9rem;
          padding: 4px;
          border-radius: 3px;
        }
        .icon-btn:hover {
          background: rgba(35, 38, 31, 0.1);
        }

        /* Inline forms */
        .admin-inline-form {
          background: var(--paper);
          border: 1px solid var(--line);
          padding: 12px;
          border-radius: var(--radius);
          margin-bottom: 12px;
        }
        .admin-inline-form h4 {
          margin: 0 0 10px 0;
        }
        .admin-inline-form .field {
          margin-bottom: 10px;
        }
        .admin-inline-form input,
        .admin-inline-form textarea,
        .admin-inline-form select {
          padding: 6px 10px;
          font-size: 0.88rem;
          background: #fff;
        }
        .inline-buttons {
          display: flex;
          gap: 8px;
        }

        /* Designer templates list */
        .designer-box {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .current-questions {
          border-bottom: 1px solid var(--line);
          padding-bottom: 20px;
        }
        .designer-q-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .designer-q-item {
          background: #fff;
          border: 1px solid var(--line);
          padding: 12px;
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .q-item-num {
          font-family: var(--font-display);
          font-weight: bold;
          font-size: 1.1rem;
          color: var(--gold);
        }
        .q-item-content {
          flex: 1;
        }
        .q-item-details {
          display: flex;
          gap: 6px;
          margin-top: 4px;
          flex-wrap: wrap;
        }
        .q-type-badge {
          font-size: 0.65rem;
          background: var(--paper);
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
          color: var(--ink-soft);
        }
        .req-badge {
          font-size: 0.65rem;
          background: var(--red-soft);
          color: var(--red);
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
        }
        .opt-count {
          font-size: 0.65rem;
          background: var(--gold-soft);
          color: #6b4c14;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
        }
        .flag-badge {
          font-size: 0.65rem;
          background: #d4e6f1;
          color: #2471a3;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
        }

        .add-question-box {
          background: rgba(255,255,255,0.5);
          border: 1px solid var(--line);
          padding: 16px;
          border-radius: var(--radius);
        }
        .add-question-box h4 {
          margin: 0 0 14px 0;
        }
        .add-question-box label {
          font-size: 0.8rem;
          color: var(--ink-soft);
          display: block;
          margin-bottom: 4px;
        }
        .add-question-box input,
        .add-question-box select {
          background: #fff;
          padding: 8px 10px;
          font-size: 0.9rem;
        }

        .flag-config-box {
          border: 1px solid var(--line);
          background: var(--paper);
          padding: 12px;
          border-radius: var(--radius);
          margin-top: 10px;
        }
      `}</style>
    </Layout>
  );
}
