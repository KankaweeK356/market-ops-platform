// pages/api/copilot.js
//
// API Serverless Function สำหรับคุยโต้ตอบกับผู้บริหาร (Conversational Copilot - RAG)
// รองรับทั้ง Google Gemini API (แนะนำ - มีรุ่นฟรี), Anthropic Claude API หรือใช้ Mock สแตนด์บาย
// รองรับการระบุฝ่ายงานที่กำลังเรียกวิเคราะห์ เพื่อตีกรอบคำถามคำตอบให้อยู่ในฝ่ายงานนั้นๆ

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query, context, departmentId } = req.body || {};
  if (!query) {
    return res.status(400).json({ error: "กรุณาระบุคำถาม" });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const deptNames = {
    "d-clean": "ฝ่ายรักษาความสะอาด",
    "d-security": "ฝ่ายความปลอดภัย",
    "d-labor": "ฝ่ายแรงงาน"
  };

  const currentDeptLabel = deptNames[departmentId] || "ทุกฝ่ายงาน";

  // --- RULE-BASED FALLBACK (หากไม่พบ API Key ใดๆ เลย) ---
  if (!geminiKey && !anthropicKey) {
    const q = String(query).toLowerCase();
    let answer = "";
    let hasDecision = false;
    let suggestedDecisions = [];

    if (q.includes("ร้องเรียน") || q.includes("ปัญหา") || q.includes("สรุป")) {
      if (departmentId === "d-clean") {
        answer = "สรุปประเด็นงานรักษาความสะอาดสัปดาห์นี้:\n\n" +
                 "1. **ห้องน้ำโซน C:** ขาดรายงานมาแล้ว 5 วันซ้อน (วิกฤตความสม่ำเสมอ)\n" +
                 "2. **งานซ่อมบำรุงตลาดชำรุด:** มีรายการค้างซ่อมสะสม 5 จุด งบประมาณเดือนนี้จัดสรรทำได้ทันทีเพียง 2 จุด\n\n" +
                 "ท่านต้องการดำเนินการในเรื่องใดเป็นหลัก?";
        hasDecision = true;
        suggestedDecisions = ["ส่งทีมตรวจสอบโซน C", "อนุมัติซ่อมแซมแผงค้า A และ D", "ขอรายงานงบรักษาความสะอาด"];
      } else if (departmentId === "d-security") {
        answer = "สรุปประเด็นงานฝ่ายความปลอดภัยสัปดาห์นี้:\n\n" +
                 "1. **รถสายตรวจ กข-1234:** ตรวจสภาพเบรก 'ไม่ผ่าน' 2 วันซ้อน และขาดเช็คซ้ำมา 4 วัน (เสี่ยงอุบัติเหตุทางถนน)\n" +
                 "2. **กล้อง CCTV:** ออนไลน์ต่ำกว่าเกณฑ์ 95% เนื่องจากกล้องดับ 3 จุดในโซน B และตัวบันทึก NVR ความร้อนเกินเกณฑ์\n\n" +
                 "ต้องการส่งซ่อมแซมรายการใดด่วน?";
        hasDecision = true;
        suggestedDecisions = ["ส่งซ่อมรถ กข-1234 ทันที", "สั่งเปลี่ยนกล้อง CCTV 3 จุด", "มอบหมายหัวหน้าฝ่ายความปลอดภัย"];
      } else if (departmentId === "d-labor") {
        answer = "สรุปประเด็นงานฝ่ายแรงงานสัปดาห์นี้:\n\n" +
                 "1. **การละเลย PPE:** คนงานก่อสร้างโซน B สองคนไม่สวมรองเท้านิรภัยและถุงมือ (ดัชนีตกเหลือ 70%)\n" +
                 "2. **พยากรณ์สงกรานต์:** คาดต้องการกำลังคนสุขาภิบาล/พนักงานเสริมเพิ่มขึ้น 8 คนรับช่วงลูกค้าขยายตัว 40%\n\n" +
                 "ต้องการสั่งดำเนินการอย่างไร?";
        hasDecision = true;
        suggestedDecisions = ["อนุมัติพนักงานเสริม 8 คน", "ตักเตือนผู้รับเหมาไซด์ก่อสร้าง", "ลงบันทึกโทษแรงงาน"];
      } else {
        answer = "สรุปภาพรวมปัญหารวมสัปดาห์นี้ของทุกฝ่ายงาน:\n\n" +
                 "- รถตรวจการณ์ กข-1234 เบรกเสียและขาดการตรวจซ้ำ\n" +
                 "- รายงานสุขาภิบาลโซน C หายเงียบไปผิดปกติ 5 วัน\n" +
                 "- แรงงานหน้างานโซน B ปฏิบัติงานโดยสวมใส่อุปกรณ์ PPE ไม่ครบถ้วน\n\n" +
                 "ท่านอยากเจาะลึกที่ฝ่ายใดเป็นพิเศษหรือไม่?";
        hasDecision = false;
        suggestedDecisions = [];
      }
    } else if (q.includes("รถ") || q.includes("เบรก") || q.includes("กข") || q.includes("1234")) {
      answer = "ข้อมูลสภาพรถสายตรวจ กข-1234 (ฝ่ายความปลอดภัย):\n\n" +
               "- **สถานะความเสี่ยง:** วิกฤต (88/100)\n" +
               "- **ประวัติการตรวจ:** เบรกตรวจไม่ผ่าน 2 วันติด (12 และ 13 ก.ค.) และเงียบหายจากการอัปเดตสถานะมา 4 วัน\n" +
               "- **ผลกระทบ:** ต่ำกว่า KPI ความพร้อมยานพาหนะของฝ่ายความปลอดภัยที่กำหนดไว้ที่ 100%";
      hasDecision = true;
      suggestedDecisions = ["ส่งรถตรวจเข้าศูนย์ทันที", "พักการใช้งานรถคันนี้ชั่วคราว", "สั่งชี้แจงสาเหตุขาดการตรวจซ้ำ"];
    } else if (q.includes("cctv") || q.includes("กล้อง") || q.includes("nvr")) {
      answer = "ข้อมูลกล้องวงจรปิด CCTV (ฝ่ายความปลอดภัย):\n\n" +
               "- **สถานะออนไลน์:** 92.5% (ต่ำกว่า KPI มาตรฐานที่ 95%)\n" +
               "- **สาเหตุ:** กล้องโซน B ดับจำนวน 3 จุด และพัดลมระบายความร้อนเครื่องบันทึก NVR ชำรุดทำให้อุณหภูมิสูงเกินขีดปลอดภัย";
      hasDecision = true;
      suggestedDecisions = ["อนุมัติจัดซื้อกล้องใหม่ 3 ตัว", "ส่งช่างซ่อมเครื่อง NVR", "ติดตั้งกล้องสำรองชั่วคราว"];
    } else if (q.includes("โซน c") || q.includes("ความเงียบ") || q.includes("เงียบ") || q.includes("รายงานหาย")) {
      answer = "ข้อมูลความถี่รายงาน โซน C (ฝ่ายรักษาความสะอาด):\n\n" +
               "- **ดัชนีตรวจจับผิดปกติ:** z-score ต่ำกว่าเกณฑ์วิกฤต (-2.18)\n" +
               "- **สถิติข้อมูล:** ยอดส่งปกติเฉลี่ย 3.0 ครั้งต่อวัน แต่ล่าสุดยอดตกลงเหลือ 0 ครั้งติดต่อกัน 5 วันรวด\n" +
               "- **ข้อสันนิษฐาน:** มีโอกาสสูงที่พนักงานขาดการลงพื้นที่ปฏิบัติงานจริง หรือละเลยขั้นตอนการบันทึกรายงาน";
      hasDecision = true;
      suggestedDecisions = ["ส่งทีมเทศกิจตรวจสอบหน้างานด่วน", "ปรับปรุงกระบวนการสแกน QR Code", "คาดโทษผู้ปฏิบัติงานโซน C"];
    } else if (q.includes("ซ่อม") || q.includes("งบ") || q.includes("จัดลำดับ") || q.includes("backlog")) {
      answer = "ตารางความจำเป็นงานซ่อมบำรุง (ฝ่ายรักษาความสะอาด):\n\n" +
               "1. **โซน A - ผักผลไม้:** (คะแนน 91 | กระทบ 12 แผง | ค้างซ่อมบ่อยที่สุด)\n" +
               "2. **โซน D - ของแห้ง:** (คะแนน 78 | กระทบ 20 แผง | ร้านค้ากระทบมากที่สุด)\n" +
               "3. **โซน B - เนื้อสัตว์:** (คะแนน 74 | กระทบ 6 แผง)\n\n" +
               "แนะนำให้อนุมัติซ่อมบำรุงในจุด โซน A และ โซน D ก่อนเพื่อให้สอดคล้องตามกรอบงบประมาณจำกัดของเดือนนี้";
      hasDecision = true;
      suggestedDecisions = ["อนุมัติซ่อม A และ D", "ขออนุมัติขยายงบซ่อมทั้งหมด", "สลับคิวจัดลำดับใหม่"];
    } else if (q.includes("สงกรานต์") || q.includes("คน") || q.includes("กำลังคน") || q.includes("forecast")) {
      answer = "การคาดการณ์กำลังคนเทศกาลสงกรานต์ (ฝ่ายแรงงาน):\n\n" +
               "- **พยากรณ์กำลังพล:** ต้องการพนักงานสุขาภิบาลปฏิบัติงานเสริมจำนวน +8 คน\n" +
               "- **สถิติเปรียบเทียบ:** ปีที่แล้วยอดจำนวนลูกค้าตลาดเพิ่มขึ้น 40% และร้องเรียนปัญหาขยะเพิ่มขึ้น 40% โดยมีการจ้างพนักงานเสริม 8 คนเพื่อคุมเสถียรภาพการบริการ";
      hasDecision = true;
      suggestedDecisions = ["อนุมัติจ้างเสริม 8 คน", "อนุมัติจ้างเสริมครึ่งหนึ่ง (4 คน)", "ใช้กำลังคนเดิมและจ่ายค่าโอทีเพิ่ม"];
    } else if (q.includes("ppe") || q.includes("ความปลอดภัย") || q.includes("ถุงมือ") || q.includes("รองเท้า")) {
      answer = "รายงานความปลอดภัยและ PPE (ฝ่ายแรงงาน):\n\n" +
               "- **ดัชนีความสอดคล้อง:** 70% (ต่ำกว่า KPI สวมใส่ 100%)\n" +
               "- **ประเด็น:** พบแรงงาน 2 รายหน้างานก่อสร้างโซน B ปฏิบัติงานโดยปราศจากรองเท้านิรภัยและถุงมือเซฟตี้ ซึ่งอันตรายและฝ่าฝืนกฎหลักความปลอดภัย";
      hasDecision = true;
      suggestedDecisions = ["ออกใบเตือนผู้รับเหมาทันที", "พักงานคนงานจนกว่าจะใส่ครบ", "สั่งการปรับเงินตามระเบียบไซด์งาน"];
    } else {
      answer = `สวัสดีครับผู้บริหาร ผมคือ **Executive Copilot** ระบบผู้ช่วยอัจฉริยะวิเคราะห์ข้อมูลเชิงลึก\n\n` +
               `ขณะนี้คุณกำลังโฟกัสข้อมูลที่ **${currentDeptLabel}**\n` +
               `ท่านสามารถพิมพ์ถามเพื่อประเมินความสอดคล้องของตัวชี้วัด KPI หรือสอบถามรายละเอียดของหัวข้อภายในฝ่ายนี้ได้เลยครับ เช่น:\n` +
               `- "วิเคราะห์สาเหตุปัญหาที่วิกฤตที่สุดขณะนี้"\n` +
               `- "สรุปความเสี่ยงหรือรายงานที่ค้างทั้งหมดในสัปดาห์นี้"`;
      hasDecision = false;
      suggestedDecisions = [];
    }

    return res.status(200).json({ answer, hasDecision, suggestedDecisions });
  }

  const systemPrompt = `คุณคือผู้ช่วยระดับสูงสำหรับผู้บริหารตลาดสี่มุมเมือง ประจำฝ่ายงาน: ${currentDeptLabel}
หน้าที่ของคุณคือตอบคำถามของผู้บริหารเกี่ยวกับการปฏิบัติงาน โครงสร้างงาน ข้อผิดพลาด ความผิดปกติ และข้อมูลรายงานที่ดึงมาจากระบบ (Context) ของฝ่ายงานนี้เท่านั้น
ให้ตอบเป็นภาษาไทยที่สุภาพ กระชับ อ่านง่าย และใช้ประโยชน์ได้จริง

ข้อมูลที่คุณดึงมาตรวจสอบประกอบด้วย:
${JSON.stringify(context)}

หลักเกณฑ์การตอบ:
1. อ้างอิงตัวเลข วันที่ และข้อเท็จจริงในข้อมูล (Context) จริงเสมอ ห้ามตอบลอยๆ หรือคาดเดาเอง
2. หากข้อมูลนำไปสู่การตัดสินใจได้ ให้สรุปทางเลือกตัดสินใจ (ปุ่ม) เพื่อส่งกลับไปให้แผงสั่งการทำงาน
3. ตอบกลับเป็น JSON เท่านั้น ห้ามมีตัวอักษรอื่นนอกเหนือจาก JSON ห้ามใส่เครื่องหมายคำพูดครอบ JSON ทั้งหมด โครงสร้างดังนี้:
{
  "answer": "ข้อความคำตอบบรรยายอย่างละเอียด กระชับ มีการแจกแจงประเด็นชัดเจน (ใช้ markdown ได้)",
  "hasDecision": true/false,
  "suggestedDecisions": ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2"] 
}`;

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
              parts: [{ text: `${systemPrompt}\n\nคำถามจากผู้บริหาร:\n${query}` }]
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
          messages: [{ role: "user", content: `คำถามของผู้บริหาร: ${query}` }],
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
