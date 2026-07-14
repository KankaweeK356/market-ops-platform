// pages/api/summarize.js
//
// API Serverless Function สำหรับสรุปรายงานรายสัปดาห์
// รองรับทั้ง Google Gemini API (แนะนำ - มีรุ่นฟรี), Anthropic Claude API หรือใช้ Mock สแตนด์บาย
// รองรับการเจาะลึกวิเคราะห์เฉพาะรายฝ่าย (Cleanliness, Security, Labor, Maintenance) ตามเป้าหมาย KPI ตลาดสี่มุมเมือง

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
    "d-labor": "ฝ่ายแรงงาน",
    "d-maintenance": "ฝ่ายซ่อมบำรุง"
  };

  const currentDeptLabel = deptNames[departmentId] || "ทุกฝ่ายงาน";

  // --- MOCK FALLBACK (หากไม่พบ API Key ใดๆ เลย) ---
  if (!geminiKey && !anthropicKey) {
    if (departmentId === "d-clean") {
      return res.status(200).json({
        summary: "สรุปภาพรวมฝ่ายรักษาความสะอาด: สัปดาห์นี้ตรวจพบปัญหาขยะอินทรีย์ล้นถังสะสม ณ ลานผัก Zone C คาดว่าจะเกินขีดจำกัดภายใน 38 นาที เนื่องจากมีรถคอกเข้ามาสะสมพร้อมกัน 27 คัน (ปริมาณความจุสูงถึง 92% และแมลงวันเฉลี่ย 45 ตัว/กับดัก) นอกจากนี้ บ่อบำบัดน้ำเสียหลักบ่อ 2 มีประสิทธิภาพรันปั๊มลดลงเหลือ 94% โดยมีค่าซีโอดี COD พุ่งแตะ 160 mg/L สูงเกินมาตรฐานความปลอดภัยสิ่งแวดล้อมตลาด (KPI < 120 mg/L)",
        anomalies: [
          "ระดับปริมาณขยะอินทรีย์ Zone C แตะ 92% เกินระดับความปลอดภัยเตือนภัยของถังคัดแยก",
          "ค่าซีโอดี COD บ่อบำบัดน้ำเสียขึ้นสูง 160 mg/L ปั๊มทำงานต่ำกว่า 98% uptime"
        ],
        recommendations: [
          "อนุมัติเพิ่มกำลังพลรถเก็บขยะจาก Zone A ช่วยระบายลาน Zone C ด่วน",
          "สั่งวิศวกรซ่อมบำรุงปั๊มสูบระบบและเพิ่มรอบบำบัดน้ำเสียทันที"
        ]
      });
    } else if (departmentId === "d-security") {
      return res.status(200).json({
        summary: "สรุปภาพรวมฝ่ายความปลอดภัย: พบคิวรถคอกจราจรสะสมหนาแน่นถึง 31 คัน ส่งผลให้เกิดปัญหารถติดขัดคอขวด 15 นาที ณ ประตูทางเข้า Gate 3 (หลุดเกณฑ์เป้าหมาย KPI ห้ามเกิน 3 นาที) อีกทั้งรายงานประสิทธิภาพเดินรถผักเข้าอาคาร Point A ไป B เฉลี่ยพุ่งสูงขึ้นแตะ 42 นาทีต่อรอบ (เป้าไม่เกิน 30 นาที) และตรวจพบรถกระบะทะเบียน 70-4567 จอดแช่ขวางระเบียงขนสินค้า Dock-B นาน 34 นาที",
        anomalies: [
          "คอขวดติดขัดประตู Gate 3 ยาวนาน 15 นาที สูงเกินเกณฑ์มาตรฐานจราจรอย่างวิกฤต",
          "รถขนสินค้าจอดแช่เกินเวลา 25 นาที และรถผัก Point A-B วิ่งช้ากว่ากำหนด 30 นาที/รอบ"
        ],
        recommendations: [
          "เปิดประตูทางเข้าออก Gate สำรองเพิ่มเพื่อระบายเวลารอคิวที่จอดรถคอก",
          "ส่งเจ้าหน้าที่ รปภ. เคลียร์รถจอดแช่และสั่งล็อกล้อรถกีดขวางทันที"
        ]
      });
    } else if (departmentId === "d-labor") {
      return res.status(200).json({
        summary: "สรุปภาพรวมฝ่ายแรงงาน: พบบันทึกเตือนกำลังคนแรงงานคัดแยกสินค้ากะเช้ามีเพียง 185 คน ไม่สอดรับกับยอดรถสินค้าเข้าที่มีปริมาณสูงถึง 460 คัน ส่งผลให้เวลาจอดรอถ่ายสินค้าพุ่งสูงเฉลี่ย 31 นาทีต่อคัน (เกินเป้า KPI 25 นาที) และระบบตรวจเช็คประวัติแรงงานต่างด้าวพบมีใบอนุญาต Work Permit ใกล้หมดอายุ 16 ราย และหมดสิทธิ์แล้ว 4 ราย",
        anomalies: [
          "สัดส่วนแรงงานต่อจำนวนรถเข้าวิกฤต ส่งผลให้ Labor Utilization ทะลุเกินเกณฑ์ 95%",
          "ตรวจพบต่างด้าว 20 รายวีซ่า/ใบอนุญาตขัดต่อเกณฑ์ความสอดคล้องทางกฎหมาย 100%"
        ],
        recommendations: [
          "แจ้งสั่งจ้างแรงงานต่างด้าวสำรองหรือจ่ายงบค่าทำงานล่วงเวลา (OT) ในกะเพิ่ม",
          "สั่งฝ่ายบุคคลยื่นเอกสารต่ออายุ Work Permit ปรับปรุงแรงงานให้ถูกกฎหมายด่วน"
        ]
      });
    } else if (departmentId === "d-maintenance") {
      return res.status(200).json({
        summary: "สรุปภาพรวมฝ่ายซ่อมบำรุง: สัปดาห์นี้ตรวจพบปัญหาประสิทธิภาพเครื่องจักรหลัก โดยเครื่องปั่นไฟสำรองอาคารผลไม้ GEN-01 เกิดเหตุขัดข้อง Breakdown สะสมยาวนาน 120 นาที ส่งผลให้อัตราการเปิดเครื่องรันงานลดลงฮวบเหลือ 45% (หลุดเกณฑ์เป้าหมาย >80%) นอกจากนี้ ยอดการซ่อมปิดใบงานล่าช้ากว่าเกณฑ์ข้อตกลง SLA สัปดาห์นี้สะสมรวม 9 รายการ โดยเฉพาะใบงานซ่อมไฟฟ้า RQ-1045 ใช้เวลาปิดจ๊อบนานเกิน 180 นาที เนื่องจากชิ้นส่วนสายไฟและข้อต่อชำรุดขาดแคลนในคลังพัสดุ",
        anomalies: [
          "เครื่องปั่นไฟสำรอง GEN-01 ขัดข้องสะสมนาน 120 นาทีจากระดับความร้อนห้องจ่ายไฟสูงวิกฤต",
          "อัตรางานซ่อมปิดสำเร็จตามข้อตกลง SLA ตกลงเหลือ 91.0% (ต่ำกว่าเป้าหมาย SLA Met ที่ 95%)"
        ],
        recommendations: [
          "อนุมัติทีมช่างเข้าซ่อมเปลี่ยนพัดลมระบายความร้อนเครื่อง GEN-01 ทันทีเพื่อกู้คืนระบบไฟสำรอง",
          "อนุมัติงบฉุกเฉินสำหรับสั่งซื้อสต็อกชิ้นส่วนสายไฟและข้อต่อกันน้ำจัดสำรองไว้คลังสต็อกกลาง"
        ]
      });
    } else {
      return res.status(200).json({
        summary: "สรุปภาพรวมการปฏิบัติงานสัปดาห์นี้: ระบบมีรายงานสะสมพบข้อบกพร่องตามเกณฑ์ตัวชี้วัดเป้าหมายตลาด ทั้งปัญหารถติดขัดประตูเข้าออกสะสม 15 นาที, ระบบบำบัดน้ำเสียค่า COD สูง 160 mg/L และการแจ้งเตือนสิทธิ์ใบอนุญาตทำงานแรงงานต่างด้าวใกล้หมดอายุ 16 รายที่ต้องพิจารณาตัดสินใจนโยบายโดยด่วน",
        anomalies: [
          "ค่าซีโอดี COD บ่อบำบัดสิ่งปฏิกูลพุ่งสูงเกินเกณฑ์ควบคุม",
          "รถจอดคอขวดและเวลารอคิวโหลดของล่าช้าขัดต่อ KPI ตลาด"
        ],
        recommendations: [
          "อนุมัติทางเลือกสั่งการด่วนรายฝ่ายงานเพื่อป้องกันคอขวดโลจิสติกส์",
          "ส่งทีมผู้ตรวจ ISO ติดตามงานทำความสะอาดหน้าแผงค้า"
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
          messages: [{ role: "user", content: `ข้อมูลดิบปฏิบัติงาน: ${userContent}` }],
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
