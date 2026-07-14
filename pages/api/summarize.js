// pages/api/summarize.js
//
// API Serverless Function สำหรับสรุปรายงานรายสัปดาห์
// รองรับทั้ง Google Gemini API (แนะนำ - มีรุ่นฟรี), Anthropic Claude API หรือใช้ Mock สแตนด์บาย
// รองรับการเจาะลึกวิเคราะห์เฉพาะรายฝ่าย (Cleanliness, Security, Labor) ตามเป้าหมาย KPI

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { reports, stats, departmentId } = req.body || {};
  if (!Array.isArray(reports)) {
    return res.status(400).json({ error: "ข้อมูล reports ไม่ถูกต้อง" });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const deptNames = {
    "d-clean": "ฝ่ายรักษาความสะอาด",
    "d-security": "ฝ่ายความปลอดภัย",
    "d-labor": "ฝ่ายแรงงาน"
  };

  const currentDeptLabel = deptNames[departmentId] || "ทุกฝ่ายงาน";

  // --- MOCK FALLBACK (หากไม่พบ API Key ใดๆ เลย) ---
  if (!geminiKey && !anthropicKey) {
    if (departmentId === "d-clean") {
      return res.status(200).json({
        summary: "สรุปภาพรวมฝ่ายรักษาความสะอาด: สัปดาห์นี้ตรวจพบปัญหาความไม่สอดคล้องตาม KPI การส่งรายงาน โดยในพื้นที่โซน C-อาหารทะเล ขาดการลงบันทึกรายงานสุขาภิบาลติดต่อกันเป็นเวลา 5 วันซ้อน (Z-score: -2.18) ถือเป็นความเงียบผิดปกติอย่างวิกฤต นอกจากนี้ในส่วนของ KPI งานซ่อมบำรุงพบจุดชำรุดรอซ่อมสะสม 5 จุด ซึ่งอยู่ในช่วงงบประมาณจำกัดและควรรีบดำเนินการในโซน A และโซน D ก่อน",
        anomalies: [
          "โซน C ขาดรายงานสุขาภิบาลติดต่อกัน 5 วันเต็ม ซึ่งผิดปกติเชิงสถิติอย่างมีนัยสำคัญ",
          "พบงบประมาณซ่อมบำรุงตึงตัว ไม่สามารถทำพร้อมกัน 5 จุดจำต้องเลือกเฉพาะจุดสำคัญ"
        ],
        recommendations: [
          "ส่งทีมเทศกิจและผู้ตรวจสอบลงพื้นที่จริงโซน C เพื่อสืบหาเหตุผลการขาดรายงานด่วน",
          "อนุมัติโครงการซ่อมแซมเร่งด่วนในโซน A และ D ตามคะแนนความต้องการผู้ค้า"
        ]
      });
    } else if (departmentId === "d-security") {
      return res.status(200).json({
        summary: "สรุปภาพรวมฝ่ายความปลอดภัย: ตรวจพบเหตุการณ์ฝ่าฝืนดัชนีความพร้อมยานพาหนะ (KPI: 100%) เนื่องจากรถตรวจการณ์ กข-1234 ตรวจเบรกไม่ผ่าน 2 ครั้งติดต่อกัน และไม่มีประวัติตรวจซ้ำใน 4 วัน อีกทั้งในแง่ KPI กล้องวงจรปิด (เป้าหมาย >95%) พบอัตราออนไลน์ตกลงเหลือ 92.5% เนื่องจากกล้องโซน B ดับพร้อมกัน 3 จุด และเครื่องประมวลผล NVR มีความร้อนสูงเกินเกณฑ์",
        anomalies: [
          "รถตรวจการณ์สายตรวจทะเบียน กข-1234 ระบบเบรกไม่ผ่านเกณฑ์ 2 ครั้งซ้อนและยังไม่ได้แก้ไข",
          "อัตรา CCTV Online ต่ำกว่า KPI มาตรฐานเนื่องจากกล้องเสีย 3 ตัวในโซน B"
        ],
        recommendations: [
          "สั่งซ่อมเบรกรถตรวจการณ์ กข-1234 ทันทีเพื่อความปลอดภัยในการออกตรวจ",
          "สั่งช่างเปลี่ยนกล้องชำรุดในโซน B และปรับระบบระบายความร้อนของเครื่องบันทึก NVR"
        ]
      });
    } else if (departmentId === "d-labor") {
      return res.status(200).json({
        summary: "สรุปภาพรวมฝ่ายแรงงาน: ดัชนีการสวมใส่อุปกรณ์ PPE เพื่อความปลอดภัยในการทำงาน (KPI: 100%) ตกลงมาอยู่ที่ 70% ในโซน B เนื่องจากมีแรงงานฝ่าฝืนลักลอบไม่สวมรองเท้านิรภัยและถุงมือ ส่วนด้านการวางแผนกำลังพลเพื่อรองรับช่วงเทศกาลสงกรานต์ คาดว่าจะมีความต้องการกำลังคนเสริม +8 คน เพื่อรักษาเสถียรภาพการจัดการเนื่องจากสถิติจำนวนลูกค้าปีที่แล้วขยายตัวขึ้น 40%",
        anomalies: [
          "พบแรงงานละเลยอุปกรณ์ป้องกันในเขตก่อสร้างโซน B ส่งผลให้สถิติความปลอดภัยตกต่ำ",
          "ความต้องการพนักงานเสริมช่วงสงกรานต์เพิ่มขึ้นตามแนวโน้มผู้ค้าและลูกค้าที่หนาแน่น"
        ],
        recommendations: [
          "ตักเตือนแรงงานหน้างานและส่งจดหมายคาดโทษผู้รับเหมาในข้อหาความปลอดภัยต่ำ",
          "อนุมัติงบว่าจ้างพนักงานพาร์ทไทม์ 8 คนล่วงหน้าเพื่อเตรียมพร้อมช่วงสงกรานต์"
        ]
      });
    } else {
      return res.status(200).json({
        summary: "สรุปภาพรวมการปฏิบัติงานสัปดาห์นี้: ระบบมีรายงานสะสมรวม 8 รายการ พบประเด็นความปลอดภัยระดับวิกฤตที่ต้องได้รับการอนุมัติอย่างเร่งด่วน คือ รถตรวจการณ์ กข-1234 ตรวจสภาพระบบเบรกไม่ผ่าน 2 ครั้งซ้อนและขาดการลงบันทึกตรวจซ้ำมานาน 4 วัน อีกทั้งพบความเงียบรายงานสุขาภิบาลผิดปกติที่โซน C-อาหารทะเล เป็นเวลา 5 วันติดต่อกัน ซึ่งชี้วัดว่าเจ้าหน้าที่ขาดการปฏิบัติงานหรือละเลยการบันทึกรายงาน",
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
  }

  // กรองเฉพาะรายงานของฝ่ายที่เลือก
  const filteredReports = departmentId 
    ? reports.filter(r => r.departmentId === departmentId)
    : reports;

  const compactReports = filteredReports.slice(0, 40).map((r) => {
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
หน้าที่ของคุณคือสรุปรายงานปฏิบัติงานประจำวันและตรวจสอบประสิทธิภาพตามตัวชี้วัด (KPI) ของ ${currentDeptLabel} เท่านั้น
แล้วตอบกลับเป็น JSON ห้ามมีเครื่องหมายคำพูดครอบหรือคำตอบนอกเหนือจากนี้ โครงสร้าง:

{
  "summary": "สรุปภาพรวมสถานการณ์และดัชนีชี้วัดหลัก 3-5 ประโยค เขียนเป็นภาษาไทยที่อ่านง่ายสำหรับผู้บริหารระดับสูง",
  "anomalies": ["จุดสังเกตความผิดปกติหรือการละเลยตัวชี้วัด KPI ข้อละ 1 ประโยค"],
  "recommendations": ["ข้อเสนอแนะสำหรับการให้ทางเลือกผู้บริหารอนุมัติ ข้อละ 1 ประโยคสั้นๆ"]
}

ให้มีประเด็นสอดคล้องตามโครงสร้างข้อมูลของฝ่ายที่วิเคราะห์อย่างเคร่งครัด`;

  const userContent = `ฝ่ายที่เลือกวิเคราะห์: ${currentDeptLabel}
สถิติสรุปภาพรวม: ${JSON.stringify(stats)}

รายการรายงานล่าสุดของฝ่ายนี้:
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
