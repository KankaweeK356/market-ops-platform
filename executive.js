import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { getReports, computeStats } from "../lib/storage";

export default function Executive() {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const r = getReports();
    setReports(r);
    setStats(computeStats(r));
  }, []);

  async function runSummary() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports, stats }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="page-head">
        <p className="eyebrow">ผู้บริหาร</p>
        <h1>สรุปภาพรวมด้วย AI</h1>
        <p>
          กดสรุปเพื่อให้ AI อ่านรายงานล่าสุดทั้งหมด แล้วสรุปสถานการณ์ ตรวจจับความผิดปกติ
          และให้ข้อเสนอแนะเชิงนโยบาย
        </p>
      </div>

      {stats && (
        <div className="grid grid-3" style={{ marginBottom: 20 }}>
          <div className="card kpi">
            <div className="num">{stats.total}</div>
            <div className="label">รายงานทั้งหมดในระบบ</div>
          </div>
          <div className="card kpi">
            <div className="num" style={{ color: "var(--gold)" }}>
              {stats.watchOpen}
            </div>
            <div className="label">รายการต้องติดตาม</div>
          </div>
          <div className="card kpi">
            <div className="num" style={{ color: "var(--red)" }}>
              {stats.urgentOpen}
            </div>
            <div className="label">รายการเร่งด่วน</div>
          </div>
        </div>
      )}

      <div className="card briefing">
        <div className="toolbar">
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)" }}>สรุปสำหรับผู้บริหาร</h3>
          <button className="btn" onClick={runSummary} disabled={loading}>
            {loading ? "กำลังสรุป..." : "สรุปด้วย AI"}
          </button>
        </div>

        {error && (
          <p style={{ color: "var(--red)", fontSize: "0.9rem" }}>{error}</p>
        )}

        {!result && !error && !loading && (
          <p className="empty-note">กดปุ่ม &ldquo;สรุปด้วย AI&rdquo; เพื่อเริ่มวิเคราะห์ข้อมูลล่าสุด</p>
        )}

        {result && (
          <>
            <blockquote>{result.summary}</blockquote>

            {result.anomalies?.length > 0 && (
              <>
                <h4 style={{ fontFamily: "var(--font-display)", marginBottom: 10 }}>
                  จุดสังเกตความผิดปกติ
                </h4>
                <ul className="rec-list" style={{ marginBottom: 20 }}>
                  {result.anomalies.map((a, i) => (
                    <li key={i}>
                      <span className="idx">!</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {result.recommendations?.length > 0 && (
              <>
                <h4 style={{ fontFamily: "var(--font-display)", marginBottom: 10 }}>
                  ข้อเสนอแนะ
                </h4>
                <ul className="rec-list">
                  {result.recommendations.map((r, i) => (
                    <li key={i}>
                      <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
