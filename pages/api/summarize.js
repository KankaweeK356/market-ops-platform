// pages/api/summarize.js
//
// Serverless function (รันบน Vercel) ที่รับข้อมูลรายงานจากฝั่ง client แล้วเรียก
// Anthropic API เพื่อสรุปสถานการณ์เป็นภาษาไทย + ตรวจจับความผิดปกติ +
// ให้ข้อเสนอแนะเชิงนโยบายสำหรับผู้บริหาร
//
// ต้องตั้งค่า Environment Variable ชื่อ ANTHROPIC_API_KEY ใน Vercel Project
// Settings > Environment Variables ก่อน deploy (ดูรายละเอียดใน README.md)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY บน Vercel กรุณาเพิ่ม Environment Variable ก่อนใช้งานฟีเจอร์นี้",
    });
  }

  const { reports, stats } = req.body || {};
  if (!Array.isArray(reports)) {
    return res.status(400).json({ error: "ข้อมูล reports ไม่ถูกต้อง" });
  }

  const deptNames = {
    "d-clean": "ฝ่ายรักษาความสะอาด",
    "d-security": "ฝ่ายความปลอดภัย",
    "d-labor": "ฝ่ายแรงงาน"
  };

  const compactReports = reports.slice(0, 40).map((r) => {
    const answersText = (r.answers || [])
      .map((ans) => {
        let valStr = "";
        if (Array.isArray(ans.value)) {
          valStr = ans.value.length === 0 ? "ไม่มี" : ans.value.join(", ");
        } else if (ans.value === "yes") {
          valStr = "ปกติ/ใช่";
        } else if (ans.value === "no") {
          valStr = "พบปัญหา/ไม่ใช่";
        } else if (ans.value && String(ans.value).startsWith("data:image")) {
          valStr = "[มีภาพถ่ายแนบ]";
        } else {
          valStr = String(ans.value);
        }
        return `${ans.label}: ${valStr}`;
      })
      .join(" | ");

    return {
      date: r.date,
      zone: r.zone,
      department: deptNames[r.departmentId] || r.departmentId,
      status: r.derivedStatus,
      by: r.submittedBy,
      details: answersText
    };
  });

  const systemPrompt = `คุณคือผู้ช่วยวิเคราะห์ข้อมูลสำหรับผู้บริหารตลาดสี่มุมเมือง
หน้าที่ของคุณคือสรุปรายงานปฏิบัติงานประจำวันจากเจ้าหน้าที่หลายโซน แล้วตอบกลับเป็น JSON เท่านั้น
ไม่ต้องมีคำอธิบายอื่นใดนอกเหนือจาก JSON โครงสร้างนี้:

{
  "summary": "สรุปภาพรวมสถานการณ์ 3-5 ประโยค เขียนเป็นภาษาไทยที่อ่านง่ายสำหรับผู้บริหาร",
  "anomalies": ["จุดสังเกตความผิดปกติหรือแนวโน้มที่น่ากังวล ข้อละ 1 ประโยค"],
  "recommendations": ["ข้อเสนอแนะเชิงนโยบายหรือการดำเนินการ ข้อละ 1 ประโยคสั้นๆ"]
}

ให้ anomalies และ recommendations อย่างละ 2-4 ข้อ ถ้าข้อมูลไม่พอให้สรุปตามที่มีอย่างตรงไปตรงมา`;

  const userContent = `สถิติสรุป: ${JSON.stringify(stats)}

รายการรายงาน (ล่าสุดก่อน):
${JSON.stringify(compactReports, null, 2)}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `Anthropic API error: ${errText}` });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    const raw = textBlock ? textBlock.text : "{}";

    let parsed;
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { summary: raw, anomalies: [], recommendations: [] };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: `เรียก AI ไม่สำเร็จ: ${err.message}` });
  }
}
