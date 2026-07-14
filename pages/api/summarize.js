// pages/api/summarize.js
//
// API Serverless Function สำหรับสรุปรายงานรายสัปดาห์
// รองรับทั้ง Google Gemini API (แนะนำ - มีรุ่นฟรี), Anthropic Claude API หรือใช้ Mock สแตนด์บาย

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { reports, stats } = req.body || {};
  if (!Array.isArray(reports)) {
    return res.status(400).json({ error: "ข้อมูล reports ไม่ถูกต้อง" });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // --- MOCK FALLBACK (หากไม่พบ API Key ใดๆ เลย) ---
  if (!geminiKey && !anthropicKey) {
    return res.status(200).json({
      summary: "สรุปภาพรวมการปฏิบัติงานสัปดาห์นี้ (10 - 14 ก.ค. 2569): ระบบมีรายงานสะสมรวม 8 รายการ พบประเด็นความปลอดภัยระดับวิกฤตที่ต้องได้รับการอนุมัติอย่างเร่งด่วน คือ รถตรวจการณ์ กข-1234 ตรวจสภาพระบบเบรกไม่ผ่าน 2 ครั้งซ้อนและขาดการลงบันทึกตรวจซ้ำมานาน 4 วัน อีกทั้งพบความเงียบรายงานสุขาภิบาลผิดปกติที่โซน C-อาหารทะเล เป็นเวลา 5 วันติดต่อกัน ซึ่งชี้วัดว่าเจ้าหน้าที่ขาดการปฏิบัติงานหรือละเลยการบันทึกรายงาน",
      anomalies: [
        "รถตรวจการณ์ทะเบียน กข-1234 ระบบเบรกชำรุดซ้ำซ้อน 2 ครั้ง และไม่มีการตรวจซ้ำ",
        "โซน C ขาดรายงานสุขาภิบาลติดต่อกัน 5 วันเต็ม ซึ่งผิดปกติเชิงสถิติอย่างมีนัยสำคัญ"
      ],
      recommendations: [
        "อนุมัติสั่งซ่อมแซมยานพาหนะทันทีเพื่อลดความเสี่ยงอุบัติเหตุในการออกตรวจ",
        "ส่งทีมตรวจสอบการทำงานลงพื้นที่จริงโซน C เพื่อสืบสวนการขาดรายงานปฏิบัติงาน"
      ]
    });
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

  // --- กรณีเรียกใช้งาน GOOGLE GEMINI API (แนะนำ) ---
  if (geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `${systemPrompt}\n\nข้อมูลอินพุต:\n${userContent}` }]
            }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return res.status(200).json(JSON.parse(rawText.trim()));
    } catch (err) {
      return res.status(500).json({ error: `เรียก Gemini AI ไม่สำเร็จ: ${err.message}` });
    }
  }

  // --- กรณีเรียกใช้งาน ANTHROPIC CLAUDE API ---
  if (anthropicKey) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      const rawText = data.content?.[0]?.text || "{}";
      const parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      return res.status(200).json(parsed);
    } catch (err) {
      return res.status(500).json({ error: `เรียก Claude AI ไม่สำเร็จ: ${err.message}` });
    }
  }
}
