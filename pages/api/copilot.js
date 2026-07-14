// pages/api/copilot.js
//
// API Serverless Function สำหรับคุยโต้ตอบกับผู้บริหาร (Conversational Copilot - RAG)
// ดึงข้อมูล Context ด้านการปฏิบัติงานมาใส่ใน Prompt เพื่อส่งให้ Claude ตอบกลับเป็นข้อมูลที่แม่นยำ

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query, context } = req.body || {};
  if (!query) {
    return res.status(400).json({ error: "กรุณาระบุคำถาม" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // --- RULE-BASED FALLBACK (สำหรับกรณีไม่ได้ตั้ง API Key เพื่อให้เดโมไม่ล่มและตอบตรงคำถาม) ---
  if (!apiKey) {
    const q = String(query).toLowerCase();
    let answer = "";
    let hasDecision = false;
    let suggestedDecisions = [];

    if (q.includes("ร้องเรียน") || q.includes("ปัญหา") || q.includes("สรุป")) {
      answer = "วิเคราะห์ข้อมูลล่าสุด: พบรายงานงานค้างสะสม 2 รายการที่เป็นระดับ 'ต้องติดตาม' และ 'เร่งด่วน'\n\n" +
               "1. **ฝ่ายรักษาความสะอาด:** พบกลิ่นเหม็นอุดตันจากท่อระบายน้ำที่ห้องน้ำโซน C-อาหารทะเล เป็นเวลา 2 วันแล้ว\n" +
               "2. **ฝ่ายความปลอดภัย:** รถตรวจการณ์ กข-1234 เบรกไม่ผ่าน 2 ครั้งซ้อน และไม่ได้รับการตรวจซ้ำมา 4 วัน\n" +
               "3. **ฝ่ายแรงงาน:** พบพนักงานก่อสร้างไม่สวมถุงมือและรองเท้านิรภัยในโซน B\n\n" +
               "ท่านต้องการสั่งการในเรื่องใดเป็นลำดับแรก?";
      hasDecision = true;
      suggestedDecisions = ["สั่งปิดประเด็นห้องน้ำโซน C", "อนุมัติซ่อมรถด่วน", "ส่งเจ้าหน้าที่ตักเตือนฝ่ายแรงงาน"];
    } else if (q.includes("รถ") || q.includes("เบรก") || q.includes("กข") || q.includes("1234")) {
      answer = "ข้อมูลสินทรัพย์ (Asset) 'รถตรวจการณ์ กข-1234' ของฝ่ายความปลอดภัย:\n\n" +
               "- **สถานะปัจจุบัน:** วิกฤต (Risk Score: 88/100)\n" +
               "- **ประวัติบันทึก:** ตรวจเช็คสภาพเบรก 'ไม่ผ่าน' ติดต่อกัน 2 วัน (12 และ 13 ก.ค.) และยังไม่มีการลงบันทึกตรวจซ้ำหรือซ่อมแซมมาเป็นเวลา 4 วันติดต่อกันแล้ว\n\n" +
               "ขอแนะนำให้สั่งซ่อมทันทีเพื่อป้องกันอุบัติเหตุระหว่างออกตรวจปฏิบัติงาน";
      hasDecision = true;
      suggestedDecisions = ["ส่งรถซ่อมแซมด่วน", "ระงับการวิ่งของรถคันนี้", "มอบหมายหัวหน้าฝ่ายความปลอดภัย"];
    } else if (q.includes("โซน c") || q.includes("ความเงียบ") || q.includes("หาย") || q.includes("เงียบ")) {
      answer = "วิเคราะห์ความถี่รายงาน (Anomaly Detection):\n\n" +
               "- **พิกัด:** ฝ่ายรักษาความสะอาด โซน C (อาหารทะเล)\n" +
               "- **การวิเคราะห์:** ปกติจะมีรายงานสุขาภิบาลเข้ามาเฉลี่ย 3 ครั้งต่อวัน แต่ล่าสุดไม่พบการรายงานเข้ามาเลยติดต่อกันเป็นเวลา 5 วัน\n" +
               "- **ข้อสังเกต:** ค่าเบี่ยงเบนสถิติ (z-score: -2.18) ถือว่าเงียบผิดปกติอย่างมีนัยสำคัญ อาจเกิดจากเจ้าหน้าที่ไม่ได้ลงพื้นที่จริง หรือละเลยการส่งบันทึกความสะอาด";
      hasDecision = true;
      suggestedDecisions = ["สั่งส่งทีมเทศกิจลงตรวจซ้ำ", "ตักเตือนหัวหน้าโซน C", "เปิดเคสรอข้อมูลอีก 24 ชม."];
    } else if (q.includes("ซ่อม") || q.includes("งบ") || q.includes("จัดลำดับ") || q.includes("Backlog")) {
      answer = "ตารางความสำคัญงานซ่อมบำรุง (Multi-criteria Scoring):\n\n" +
               "1. **โซน A - ผักผลไม้:** (คะแนน 91) เนื่องจากปัญหาถี่ (5 ครั้ง) และกระทบผู้ค้าจำนวนมาก (12 แผง)\n" +
               "2. **โซน D - ของแห้ง:** (คะแนน 78) ปัญหากลาง กระทบผู้ค้ามากที่สุด (20 แผง)\n" +
               "3. **โซน B - เนื้อสัตว์:** (คะแนน 74) ปัญหาสูง แต่กระทบแผงค้าน้อย (6 แผง)\n\n" +
               "งบประมาณเดือนนี้จำกัด แนะนำให้อนุมัติซ่อมแซมในสองลำดับแรกก่อนคือ โซน A และ โซน D";
      hasDecision = true;
      suggestedDecisions = ["อนุมัติซ่อม A และ D", "ปรับปรุงตารางซ่อมใหม่", "อนุมัติซ่อมหมดทุกโซน"];
    } else {
      answer = "สวัสดีครับผู้บริหาร ผมคือ **Executive Copilot** ระบบผู้ช่วยอัจฉริยะวิเคราะห์ข้อมูลเชิงลึก\n\n" +
               "ผมสามารถช่วยสรุปและตอบคำถามเชิงลึกเกี่ยวกับ:\n" +
               "- ปัญหาการตรวจสภาพรถสายตรวจเบรกไม่ผ่าน\n" +
               "- ตรวจจับความเงียบรายงานผิดปกติที่โซน C\n" +
               "- ลำดับงานซ่อมบำรุงและผลกระทบของแผงค้าในตลาด\n" +
               "ท่านต้องการทราบรายละเอียดของหัวข้อใดเพิ่มเติมครับ?";
      hasDecision = false;
      suggestedDecisions = [];
    }

    return res.status(200).json({ answer, hasDecision, suggestedDecisions });
  }

  // --- รันระบบต่อ AI กับ API ของ ANTHROPIC CLAUDE จริง ---
  const systemPrompt = `คุณคือผู้ช่วยระดับสูงสำหรับผู้บริหารตลาดสี่มุมเมือง (ชื่อตำแหน่ง Executive Copilot)
หน้าที่ของคุณคือตอบคำถามของผู้บริหารเกี่ยวกับการปฏิบัติงาน โครงสร้างงาน ข้อผิดพลาด ความผิดปกติ และข้อมูลรายงานที่ดึงมาจากระบบ (Context)
ให้ตอบเป็นภาษาไทยที่สุภาพ กระชับ อ่านง่าย และใช้ประโยชน์ได้จริง

ข้อมูลที่คุณดึงมาตรวจสอบประกอบด้วย:
${JSON.stringify(context)}

หลักเกณฑ์การตอบ:
1. อ้างอิงตัวเลข วันที่ และข้อเท็จจริงในข้อมูล (Context) จริงเสมอ ห้ามตอบลอยๆ หรือคาดเดาเอง
2. หากข้อมูลเพียงพอสำหรับการตัดสินใจ ให้สรุปทางเลือกตัดสินใจ (เช่น เสนอปุ่มตัดสินใจ หรือบอกทางเลือก ก, ข, ค สั้นๆ)
3. หากข้อมูลไม่เพียงพอ ให้แจ้งผู้บริหารอย่างสุภาพว่าขาดข้อมูลในส่วนใด
4. ตอบกลับเป็น JSON เท่านั้น ห้ามมีตัวอักษรอื่นนอกเหนือจาก JSON ห้ามใส่เครื่องหมายคำพูดครอบ JSON ทั้งหมด โครงสร้างดังนี้:
{
  "answer": "ข้อความคำตอบบรรยายอย่างละเอียด กระชับ มีการแจกแจงประเด็นชัดเจน (ใช้ markdown ได้)",
  "hasDecision": true/false,
  "suggestedDecisions": ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2"] 
}`;

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
        messages: [{ role: "user", content: `คำถามของผู้บริหาร: ${query}` }],
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
      parsed = { answer: raw, hasDecision: false, suggestedDecisions: [] };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: `เรียก Copilot AI ไม่สำเร็จ: ${err.message}` });
  }
}
