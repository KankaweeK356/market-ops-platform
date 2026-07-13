import Layout from "../components/Layout";
import Link from "next/link";

export default function Home() {
  return (
    <Layout>
      <div className="page-head">
        <p className="eyebrow">Centralized Data Platform · Dashboard · AI Analytics</p>
        <h1>บันทึกครั้งเดียว รู้สถานการณ์ทั้งตลาดแบบเรียลไทม์</h1>
        <p>
          เลือกบทบาทของคุณเพื่อเข้าใช้งานส่วนที่เกี่ยวข้อง — เจ้าหน้าที่บันทึกงานภาคสนาม
          หัวหน้างานติดตามสถานะทุกโซน และผู้บริหารดูสรุปภาพรวมพร้อมคำแนะนำจาก AI
        </p>
      </div>

      <div className="role-grid">
        <Link href="/report" className="role-card">
          <span className="tab-index">01 · เจ้าหน้าที่ปฏิบัติงาน</span>
          <h2>บันทึกงานประจำวัน</h2>
          <p>
            บันทึกการทำงานตามระดับฝ่ายงานหลัก (Work Package) กิจกรรมย่อย (Activity)
            และกรอกฟอร์มประเมินย่อยแบบ Dynamic Form รวดเร็วและแม่นยำ
          </p>
        </Link>

        <Link href="/dashboard" className="role-card">
          <span className="tab-index">02 · หัวหน้างาน</span>
          <h2>Dashboard ติดตามสถานะ</h2>
          <p>
            เห็นภาพรวมทุกโซนแบบเรียลไทม์ พร้อม KPI งานค้าง และรายการที่ต้อง
            เร่งติดตามก่อนใคร
          </p>
        </Link>

        <Link href="/executive" className="role-card">
          <span className="tab-index">03 · ผู้บริหาร</span>
          <h2>สรุปผู้บริหารด้วย AI</h2>
          <p>
            AI สรุปสถานการณ์ทั้งตลาดเป็นภาษาที่อ่านง่าย พร้อมจุดสังเกตความผิดปกติ
            และข้อเสนอแนะเชิงนโยบาย
          </p>
        </Link>
      </div>

      <div className="card" style={{ marginTop: 32 }}>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink-soft)" }}>
          <strong>หมายเหตุเดโม:</strong> เวอร์ชันนี้เก็บข้อมูลไว้ใน localStorage ของเบราว์เซอร์
          เพื่อให้ทดลองใช้งานและ deploy ขึ้น Vercel ได้ทันที เมื่อพร้อมใช้งานจริงหลายหน่วยงาน
          พร้อมกัน แนะนำให้เชื่อมต่อฐานข้อมูลกลาง (เช่น Vercel Postgres หรือ Supabase)
          ตามที่ระบุไว้ใน README
        </p>
      </div>
    </Layout>
  );
}
