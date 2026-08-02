# Landscape Management Pro

ระบบบริหารงานออกแบบและจัดสวน เวอร์ชันเริ่มต้น Phase 1

## ฟังก์ชันที่มีแล้ว

- Dashboard
- CRM ลูกค้า: เพิ่ม ค้นหา และลบ
- โครงการ: เพิ่ม ค้นหา เปลี่ยนสถานะ และลบ
- AI Design Gallery พร้อมภาพที่สร้างไว้
- ฐานข้อมูลต้นไม้
- แบบสวนสำเร็จรูป
- ตั้งค่าบริษัท
- Responsive สำหรับมือถือ
- โหมดสาธิตด้วย LocalStorage
- เตรียม Supabase Client และ SQL Schema

## วิธีเปิดบนเครื่อง

```bash
npm install
npm run dev
```

เปิด URL ที่ Vite แสดง เช่น `http://localhost:5173`

## วิธี Build

```bash
npm run build
```

ไฟล์เว็บจะอยู่ในโฟลเดอร์ `dist`

## การเชื่อม Supabase

1. สร้างโปรเจกต์ใน Supabase
2. เปิด SQL Editor และรัน `supabase-schema.sql`
3. คัดลอก `.env.example` เป็น `.env`
4. กรอกค่า:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

หมายเหตุ: เวอร์ชัน Phase 1 ยังใช้ LocalStorage สำหรับหน้าลูกค้าและโครงการ เพื่อให้ทดลองได้ทันที การเชื่อม CRUD กับ Supabase จะทำในรุ่นถัดไป

## อัปโหลดขึ้น GitHub

อัปโหลดไฟล์และโฟลเดอร์ทั้งหมดในโปรเจกต์นี้ โดยให้ `package.json` และ `index.html` อยู่หน้าแรกของ Repository

## GitHub Pages

โปรเจกต์ใช้ HashRouter และ Vite `base: './'` เพื่อรองรับ GitHub Pages หลัง Build

## โครงสร้าง

- `src/components` ส่วนประกอบหลัก
- `src/pages` หน้าระบบ
- `src/data` ข้อมูลตัวอย่าง
- `src/lib` ระบบจัดเก็บและ Supabase
- `public/images/designs` ภาพแบบสวน AI
- `supabase-schema.sql` โครงสร้างฐานข้อมูลเริ่มต้น

## Roadmap ต่อไป

Phase 2:
- BOQ ใช้งานจริง
- ใบเสนอราคา
- PDF/Excel Export
- เชื่อม Supabase CRUD
- Authentication
- อัปโหลดภาพ AI
- Garden Planner
