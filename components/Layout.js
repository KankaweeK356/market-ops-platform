import Link from "next/link";
import { useRouter } from "next/router";

const NAV_ITEMS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/report", label: "บันทึกงาน" },
  { href: "/dashboard", label: "Dashboard หัวหน้างาน" },
  { href: "/executive", label: "สรุปผู้บริหาร (AI)" },
  { href: "/admin", label: "จัดการระบบ (Admin)" },
];

export default function Layout({ children }) {
  const router = useRouter();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="mark">●</span> ระบบปฏิบัติการ
          <span style={{ opacity: 0.6, fontWeight: 400 }}>ตลาดสี่มุมเมือง</span>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={router.pathname === item.href ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
