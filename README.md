# ระบบปฏิบัติการตลาดสี่มุมเมือง (Market Ops Platform) — MVP

เดโมแพลตฟอร์มตาม IS ที่วางไว้ ครบ 3 ส่วนหลัก:

1. **Centralized Data Platform** — ฟอร์มบันทึกงานประจำวัน (`/report`) สำหรับเจ้าหน้าที่ปฏิบัติงาน
2. **Analytics Dashboard** — Dashboard เรียลไทม์ (`/dashboard`) สำหรับหัวหน้างาน พร้อม KPI และกราฟ
3. **AI Analytics** — สรุปภาพรวม + ตรวจจับความผิดปกติ + ข้อเสนอแนะด้วย Claude API (`/executive`)

## เทคโนโลยีที่ใช้

- Next.js 14 (Pages Router) + React 18
- Recharts สำหรับกราฟ
- Anthropic API (Claude) เรียกผ่าน serverless function ที่ `/pages/api/summarize.js`
- เก็บข้อมูลด้วย `localStorage` ของเบราว์เซอร์ (ดูข้อจำกัดด้านล่าง)

## รันบนเครื่องตัวเอง

```bash
npm install
cp .env.example .env.local   # แล้วใส่ ANTHROPIC_API_KEY ของจริง
npm run dev
```

เปิด http://localhost:3000

## Deploy ขึ้น Vercel

1. Push โค้ดนี้ขึ้น GitHub repo
2. ไปที่ https://vercel.com/new แล้วเลือก import repo นี้
3. Vercel จะ detect เป็น Next.js อัตโนมัติ ไม่ต้องตั้งค่า Build Command เพิ่ม
4. ก่อนกด Deploy ให้ไปที่ **Settings → Environment Variables** แล้วเพิ่ม:
   - Key: `ANTHROPIC_API_KEY`
   - Value: API key จาก https://console.anthropic.com/
5. กด Deploy — เสร็จแล้วจะได้ URL พร้อมใช้งานทันที

> ถ้าลืมตั้งค่า API Key หน้า `/executive` จะขึ้นข้อความแจ้งเตือนให้ไปตั้งค่าก่อน แทนที่จะพังเงียบๆ

## ข้อจำกัดสำคัญของเดโมนี้ (และวิธีอัปเกรดเป็นของจริง)

**การเก็บข้อมูล:** ตอนนี้ข้อมูลรายงานเก็บอยู่ใน `localStorage` ของเบราว์เซอร์แต่ละเครื่อง
เพื่อให้ deploy ทดลองใช้งานได้ทันทีโดยไม่ต้องตั้งค่าฐานข้อมูล **แต่จะไม่ sync ข้ามอุปกรณ์จริง**
(เจ้าหน้าที่คนละเครื่องจะไม่เห็นข้อมูลของกันและกัน)

เมื่อพร้อมใช้งานจริงหลายหน่วยงานพร้อมกัน ให้แก้เฉพาะไฟล์ `lib/storage.js` ให้เรียก API
ของฐานข้อมูลจริงแทน (หน้าอื่นๆ ไม่ต้องแก้ เพราะเรียกผ่านฟังก์ชัน `getReports/addReport/computeStats`
ที่เป็น interface เดียวกัน) แนะนำตัวเลือก:

- **Vercel Postgres** (`@vercel/postgres`) — ผูกกับ Vercel โดยตรง ตั้งค่าง่ายที่สุด
- **Supabase** — มี Auth + Realtime ในตัว เหมาะถ้าต้องการ multi-user จริงจัง

**การแนบรูป:** ช่องแนบรูปในฟอร์มตอนนี้เป็น placeholder (disabled) ยังไม่เชื่อมระบบอัปโหลดจริง
แนะนำใช้ Vercel Blob หรือ Supabase Storage เมื่อเชื่อมฐานข้อมูลจริงแล้ว

**ผู้ใช้/สิทธิ์:** เดโมนี้ยังไม่มีระบบ Login/Role-based Access จริง (เลือกบทบาทได้อิสระจากหน้าแรก)
เมื่อใช้งานจริงควรเพิ่มระบบยืนยันตัวตน (เช่น NextAuth) และจำกัดสิทธิ์ตามหน่วยงาน

## โครงสร้างไฟล์

```
pages/
  index.js          หน้าแรก เลือกบทบาท
  report.js          ฟอร์มบันทึกงาน (เจ้าหน้าที่)
  dashboard.js        Dashboard (หัวหน้างาน)
  executive.js         สรุปผู้บริหาร + AI
  api/summarize.js      Serverless function เรียก Claude API
lib/
  constants.js       รายชื่อโซน/หมวดหมู่/สถานะ
  storage.js         Data layer (สลับเป็นฐานข้อมูลจริงได้ที่นี่ที่เดียว)
components/
  Layout.js          Navbar + shell
  StatusStamp.js       ตราประทับสถานะ (signature UI element)
styles/globals.css     Design tokens และสไตล์ทั้งหมด
```
