import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Layout from "../components/Layout";
import StatusStamp from "../components/StatusStamp";
import { 
  getReports, 
  computeStats, 
  resetToSeed, 
  getDepartments, 
  getWorkPackages, 
  getActivities, 
  deleteSubmission 
} from "../lib/storage";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });

const STATUS_COLORS = { ปกติ: "#3f7d5c", ต้องติดตาม: "#c08a28", เร่งด่วน: "#b23a2e" };

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [workPackages, setWorkPackages] = useState([]);
  const [activities, setActivities] = useState([]);

  // Hierarchical Filter State
  const [filterDept, setFilterDept] = useState("ทั้งหมด");
  const [filterWp, setFilterWp] = useState("ทั้งหมด");
  const [filterAct, setFilterAct] = useState("ทั้งหมด");
  const [filterStatus, setFilterStatus] = useState("ทั้งหมด");
  
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReports(getReports());
    setDepartments(getDepartments());
    setWorkPackages(getWorkPackages());
    setActivities(getActivities());
    setReady(true);
  }, []);

  // Filter lists for dropdown dependency
  const availableWPs = useMemo(() => {
    if (filterDept === "ทั้งหมด") return [];
    return workPackages.filter(wp => wp.departmentId === filterDept);
  }, [filterDept, workPackages]);

  const availableActs = useMemo(() => {
    if (filterWp === "ทั้งหมด") return [];
    return activities.filter(act => act.workPackageId === filterWp);
  }, [filterWp, activities]);

  // Reset dependent filters when parent changes
  function handleDeptChange(e) {
    setFilterDept(e.target.value);
    setFilterWp("ทั้งหมด");
    setFilterAct("ทั้งหมด");
  }

  function handleWpChange(e) {
    setFilterWp(e.target.value);
    setFilterAct("ทั้งหมด");
  }

  // Filter reports list based on all filters
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchDept = filterDept === "ทั้งหมด" || r.departmentId === filterDept;
      const matchWp = filterWp === "ทั้งหมด" || r.workPackageId === filterWp;
      const matchAct = filterAct === "ทั้งหมด" || r.activityId === filterAct;
      const matchStatus = filterStatus === "ทั้งหมด" || r.derivedStatus === filterStatus;
      return matchDept && matchWp && matchAct && matchStatus;
    });
  }, [reports, filterDept, filterWp, filterAct, filterStatus]);

  // Calculate dynamic stats
  const stats = useMemo(() => computeStats(filteredReports), [filteredReports]);

  // Compute dynamic chart data based on drill-down level
  const dynamicChartData = useMemo(() => {
    if (filterDept === "ทั้งหมด") {
      // Drill level: Departments summary
      const counts = {};
      filteredReports.forEach(s => {
        counts[s.departmentId] = (counts[s.departmentId] || 0) + 1;
      });
      return Object.entries(counts).map(([id, value]) => {
        const dept = departments.find(d => d.id === id);
        return { name: dept ? dept.name : id, value };
      });
    }
    
    if (filterWp === "ทั้งหมด") {
      // Drill level: Work Packages inside selected Department
      const counts = {};
      filteredReports.forEach(s => {
        counts[s.workPackageId] = (counts[s.workPackageId] || 0) + 1;
      });
      return Object.entries(counts).map(([id, value]) => {
        const wp = workPackages.find(w => w.id === id);
        return { name: wp ? wp.name : id, value };
      });
    }

    if (filterAct === "ทั้งหมด") {
      // Drill level: Activities inside selected WP
      const counts = {};
      filteredReports.forEach(s => {
        counts[s.activityId] = (counts[s.activityId] || 0) + 1;
      });
      return Object.entries(counts).map(([id, value]) => {
        const act = activities.find(a => a.id === id);
        return { name: act ? act.name : id, value };
      });
    }

    // Drill level: Zone distribution for selected Activity
    const counts = {};
    filteredReports.forEach(s => {
      counts[s.zone] = (counts[s.zone] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredReports, filterDept, filterWp, filterAct, departments, workPackages, activities]);

  const dynamicChartTitle = useMemo(() => {
    if (filterDept === "ทั้งหมด") return "สัดส่วนแบ่งตามฝ่าย";
    if (filterWp === "ทั้งหมด") return `รายงานแบ่งตามงานหลัก (WP) - ${departments.find(d => d.id === filterDept)?.name}`;
    if (filterAct === "ทั้งหมด") return `รายงานแบ่งตามกิจกรรมย่อย - ${workPackages.find(w => w.id === filterWp)?.name}`;
    return `รายงานในแต่ละพื้นที่โซน - ${activities.find(a => a.id === filterAct)?.name}`;
  }, [filterDept, filterWp, filterAct, departments, workPackages, activities]);

  function handleReset() {
    if (confirm("ต้องการรีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้นตัวอย่าง (Seed Data) หรือไม่?")) {
      const seeded = resetToSeed();
      setReports(seeded);
      setFilterDept("ทั้งหมด");
      setFilterWp("ทั้งหมด");
      setFilterAct("ทั้งหมด");
      setFilterStatus("ทั้งหมด");
    }
  }

  function handleDelete(id) {
    if (confirm("ต้องการลบรายงานนี้หรือไม่?")) {
      deleteSubmission(id);
      setReports(prev => prev.filter(r => r.id !== id));
    }
  }

  function renderAnswersSummary(answers) {
    if (!answers || answers.length === 0) return "-";
    return answers
      .map((a) => {
        let valStr = "";
        if (Array.isArray(a.value)) {
          valStr = a.value.length === 0 ? "ไม่มี" : a.value.join(", ");
        } else if (a.value === "yes") {
          valStr = "ปกติ/ใช่";
        } else if (a.value === "no") {
          valStr = "พบปัญหา/ไม่ใช่";
        } else if (a.value && String(a.value).startsWith("data:image/png;base64")) {
          valStr = "✍️ เซ็นชื่อแล้ว";
        } else if (a.value && String(a.value).startsWith("data:image")) {
          valStr = "🖼️ ภาพถ่าย";
        } else if (a.value && String(a.value).includes("mock_photo")) {
          valStr = "📷 ภาพตัวอย่าง";
        } else {
          valStr = String(a.value);
        }
        return `${a.label}: ${valStr}`;
      })
      .join(" | ");
  }

  if (!ready) return null;

  return (
    <Layout>
      <div className="page-head">
        <p className="eyebrow">หัวหน้างาน</p>
        <h1>Dashboard ติดตามสถานะปฏิบัติงาน</h1>
        <p>รายงานข้อมูลสรุปแยกตามโครงสร้างฝ่ายงานและกิจกรรมย่อยแบบเรียลไทม์</p>
      </div>

      {/* KPI summaries based on current filters */}
      <div className="grid grid-3">
        <div className="card kpi">
          <div className="num">{stats.total}</div>
          <div className="label">จำนวนรายงาน (ที่ถูกกรอง)</div>
        </div>
        <div className="card kpi">
          <div className="num" style={{ color: "var(--gold)" }}>
            {stats.watchOpen}
          </div>
          <div className="label">ต้องติดตาม</div>
        </div>
        <div className="card kpi">
          <div className="num" style={{ color: "var(--red)" }}>
            {stats.urgentOpen}
          </div>
          <div className="label">เร่งด่วน</div>
        </div>
      </div>

      {/* Filter panel card */}
      <div className="card" style={{ marginTop: 20, padding: 18 }}>
        <h4 style={{ margin: "0 0 12px 0", fontFamily: "var(--font-display)" }}>🎯 คัดกรองและสืบค้นเชิงโครงสร้าง</h4>
        <div className="filters-grid">
          <div className="field-compact">
            <label>เลือกฝ่ายงาน</label>
            <select value={filterDept} onChange={handleDeptChange}>
              <option value="ทั้งหมด">ทั้งหมด</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="field-compact">
            <label>เลือกงานหลัก (WP)</label>
            <select 
              value={filterWp} 
              onChange={handleWpChange}
              disabled={filterDept === "ทั้งหมด"}
            >
              <option value="ทั้งหมด">ทั้งหมด</option>
              {availableWPs.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="field-compact">
            <label>เลือกกิจกรรมย่อย</label>
            <select 
              value={filterAct} 
              onChange={(e) => setFilterAct(e.target.value)}
              disabled={filterWp === "ทั้งหมด"}
            >
              <option value="ทั้งหมด">ทั้งหมด</option>
              {availableActs.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="field-compact">
            <label>สถานะประเมิน</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="ทั้งหมด">ทั้งหมด</option>
              <option value="ปกติ">ปกติ</option>
              <option value="ต้องติดตาม">ต้องติดตาม</option>
              <option value="เร่งด่วน">เร่งด่วน</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recharts graph panel */}
      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <div className="card">
          <h3 style={{ marginTop: 0, fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>{dynamicChartTitle}</h3>
          <div style={{ width: "100%", height: 260 }}>
            {dynamicChartData.length === 0 ? (
              <p className="empty-note">ไม่มีข้อมูลที่จะแสดงผลกราฟ</p>
            ) : (
              <ResponsiveContainer>
                <BarChart data={dynamicChartData} margin={{ left: -20, bottom: 20 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3f7d5c" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>สัดส่วนตามสถานะ</h3>
          <div style={{ width: "100%", height: 260 }}>
            {stats.statusChart.filter(x => x.value > 0).length === 0 ? (
              <p className="empty-note">ไม่มีข้อมูลสัดส่วนสถานะ</p>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={stats.statusChart.filter(x => x.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {stats.statusChart.filter(x => x.value > 0).map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Ledger list of filtered submissions */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="toolbar">
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)" }}>
            รายการบันทึกรายงานล่าสุด ({filteredReports.length} รายการ)
          </h3>
          <button className="btn secondary small-btn" onClick={handleReset} type="button">
            รีเซ็ตข้อมูลตัวอย่างทั้งหมด
          </button>
        </div>

        {filteredReports.length === 0 ? (
          <p className="empty-note">ไม่พบรายการรายงานที่ตรงตามตัวเลือกคัดกรอง</p>
        ) : (
          <table className="ledger-table font-compact">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ฝ่าย / งานหลัก / กิจกรรม</th>
                <th>ผู้บันทึก</th>
                <th>พื้นที่</th>
                <th>ผลการประเมินย่อย</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => {
                const dept = departments.find(d => d.id === r.departmentId);
                const wp = workPackages.find(w => w.id === r.workPackageId);
                const act = activities.find(a => a.id === r.activityId);
                
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{r.date}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                        {dept?.icon} {dept?.name || r.departmentId}
                      </div>
                      <div className="table-subtext">{wp?.name} ➔ {act?.name}</div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.submittedBy}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.zone}</td>
                    <td className="ans-summary">{renderAnswersSummary(r.answers)}</td>
                    <td>
                      <StatusStamp status={r.derivedStatus} />
                    </td>
                    <td>
                      <button 
                        className="icon-btn" 
                        onClick={() => handleDelete(r.id)} 
                        title="ลบรายงาน"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style jsx global>{`
        .filters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .field-compact {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .field-compact label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--ink-soft);
        }
        .field-compact select {
          padding: 8px 10px;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          background: #fff;
          font-size: 0.88rem;
          color: var(--ink);
        }
        .field-compact select:disabled {
          background: var(--paper);
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .font-compact {
          font-size: 0.85rem;
        }
        .table-subtext {
          font-size: 0.72rem;
          color: var(--ink-soft);
          margin-top: 2px;
        }
        .ans-summary {
          max-width: 380px;
          font-size: 0.78rem;
          color: var(--ink-soft);
          line-height: 1.4;
          word-break: break-word;
        }
      `}</style>
    </Layout>
  );
}
