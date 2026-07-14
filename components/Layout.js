import Link from "next/link";
import { useRouter } from "next/router";

const NAV_ITEMS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/report", label: "บันทึกงานปฏิบัติการ" },
  { href: "/dashboard", label: "Dashboard หัวหน้างาน" },
  { href: "/executive", label: "แผงผู้บริหาร (AI)" },
  { href: "/admin", label: "จัดการระบบ (Admin)" },
];

export default function Layout({ children }) {
  const router = useRouter();

  return (
    <div className="shell">
      {/* Official SMM Intranet Header Theme */}
      <header className="smm-header">
        {/* Left Side: Brand Logo Box */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <div className="smm-logo-box">
            <svg className="smm-logo-svg" viewBox="0 0 100 80" fill="currentColor">
              {/* Pillar Center */}
              <rect x="48" y="15" width="4" height="42" fill="white" />
              {/* Left Curve Roof Layer 1 */}
              <path d="M50,15 C38,25 22,45 12,55 C18,54 26,52 34,50 C40,38 45,25 50,15 Z" fill="white" />
              {/* Left Curve Roof Layer 2 */}
              <path d="M50,30 C42,38 30,53 22,60 C28,59 35,58 42,56 C45,48 48,38 50,30 Z" fill="white" opacity="0.8" />
              {/* Right Curve Roof Layer 1 */}
              <path d="M50,15 C62,25 78,45 88,55 C82,54 74,52 66,50 C60,38 55,25 50,15 Z" fill="white" />
              {/* Right Curve Roof Layer 2 */}
              <path d="M50,30 C58,38 70,53 78,60 C72,59 65,58 58,56 C55,48 52,38 50,30 Z" fill="white" opacity="0.8" />
              {/* Base line brush */}
              <path d="M15,64 C40,63 60,63 85,64 C70,64.5 30,64.5 15,64 Z" fill="white" />
            </svg>
            <span className="smm-logo-text font-display">ตลาดสี่มุมเมือง</span>
          </div>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="smm-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`smm-nav-link ${router.pathname === item.href ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right Side: Mock Utility Panel (Bell, Avatar, Logout) */}
        <div className="smm-utility-panel">
          {/* Notification Bell */}
          <div className="utility-icon bell-icon">
            <span className="bell-badge">2</span>
            🔔
          </div>

          {/* User Avatar Group */}
          <div className="utility-avatar">
            <div className="avatar-circle">
              👤
            </div>
            <span className="avatar-status"></span>
          </div>

          {/* Red Exit Door Button */}
          <button className="utility-exit-btn" onClick={() => alert("ระบบเดโม: ปิดการทำงานออกจากระบบ")}>
            🚪
          </button>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="smm-main-container">
        {children}
      </main>

      {/* Footer */}
      <footer className="smm-footer">
        <p>© 2026 ตลาดสี่มุมเมือง (Talaad Si Mum Muang) - ระบบบริหารการปฏิบัติงานตลาดอัจฉริยะ (Decision Intelligence Platform)</p>
      </footer>
    </div>
  );
}
