import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/report",     label: "📝 Operations Workspace",       roles: ["staff"] },
  { href: "/tasks",      label: "📋 ใบงานของฉัน",                 roles: ["staff"] },
  { href: "/",           label: "🏠 เลือกบทบาท",                 roles: ["supervisor", "executive"] },
  { href: "/dashboard",  label: "📊 Department Command Center",   roles: ["supervisor"] },
  { href: "/executive",  label: "🧠 Market Intelligence Center",  roles: ["executive", "supervisor"] },
];

export default function Layout({ children }) {
  const router = useRouter();
  const [userRole, setUserRole] = useState(null); // 'staff', 'supervisor', 'executive'
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedRole = localStorage.getItem("smm_user_role");
    if (storedRole) {
      setUserRole(storedRole);
    }
  }, []);

  function handleLogin(role) {
    localStorage.setItem("smm_user_role", role);
    setUserRole(role);
    // Redirect based on role
    if (role === "staff") {
      router.push("/report");
    } else if (role === "executive") {
      router.push("/executive");
    } else {
      router.push("/dashboard");
    }
  }

  function handleLogout() {
    localStorage.removeItem("smm_user_role");
    setUserRole(null);
    router.push("/");
  }

  if (!isMounted) return null;

  // --- LOGIN PORTAL SCREEN ---
  if (!userRole) {
    return (
      <div className="login-portal-bg">
        <div className="login-card">
          {/* Logo Brand Header */}
          <div className="login-logo-box">
            <svg className="login-logo-svg" viewBox="0 0 100 80" fill="currentColor">
              <rect x="48" y="15" width="4" height="42" fill="white" />
              <path d="M50,15 C38,25 22,45 12,55 C18,54 26,52 34,50 C40,38 45,25 50,15 Z" fill="white" />
              <path d="M50,30 C42,38 30,53 22,60 C28,59 35,58 42,56 C45,48 48,38 50,30 Z" fill="white" opacity="0.8" />
              <path d="M50,15 C62,25 78,45 88,55 C82,54 74,52 66,50 C60,38 55,25 50,15 Z" fill="white" />
              <path d="M50,30 C58,38 70,53 78,60 C72,59 65,58 58,56 C55,48 52,38 50,30 Z" fill="white" opacity="0.8" />
              <path d="M15,64 C40,63 60,63 85,64 C70,64.5 30,64.5 15,64 Z" fill="white" />
            </svg>
            <h1 className="font-display">ตลาดสี่มุมเมือง</h1>
            <p className="login-sub">OPERATIONS DECISION PLATFORM</p>
          </div>

          <div className="login-body">
            <h3>🔐 เข้าใช้งานระบบอินทราเน็ต (Governance Role Gate)</h3>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.88rem", marginBottom: 20 }}>
              กรุณาเลือกบทบาทของคุณเพื่อตรวจสอบสิทธิ์และความรับผิดชอบในการปฏิบัติงานและการอนุมัติ
            </p>

            <div className="role-buttons">
              <button className="role-select-btn staff-btn" onClick={() => handleLogin("staff")}>
                <span className="icon">🧹</span>
                <div>
                  <strong>เจ้าหน้าที่ปฏิบัติงาน (Staff)</strong>
                  <span>สิทธิ์บันทึกฟอร์มงานดิบหน้างานเท่านั้น</span>
                </div>
              </button>

              <button className="role-select-btn supervisor-btn" onClick={() => handleLogin("supervisor")}>
                <span className="icon">👥</span>
                <div>
                  <strong>ผู้จัดการ / หัวหน้างาน (Manager)</strong>
                  <span>สิทธิ์ตรวจสอบ บันทึก แดชบอร์ด และแก้ไขฟอร์มระบบ</span>
                </div>
              </button>

              <button className="role-select-btn executive-btn" onClick={() => handleLogin("executive")}>
                <span className="icon">👑</span>
                <div>
                  <strong>ผู้บริหารสูงสุด (Executive)</strong>
                  <span>สิทธิ์สูงสุดในการมอนิเตอร์และสั่งการทางเลือกนโยบาย</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <style jsx>{`
          .login-portal-bg {
            min-height: 100vh;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            font-family: var(--font-body);
          }
          .login-card {
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 480px;
            overflow: hidden;
          }
          .login-logo-box {
            background: var(--red);
            color: #ffffff;
            padding: 32px 24px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .login-logo-svg {
            height: 52px;
            margin-bottom: 8px;
          }
          .login-logo-box h1 {
            margin: 0;
            font-size: 1.8rem;
            font-weight: 700;
          }
          .login-sub {
            font-size: 0.72rem;
            letter-spacing: 0.12em;
            opacity: 0.85;
            margin: 4px 0 0 0;
          }
          .login-body {
            padding: 28px 24px;
          }
          .login-body h3 {
            margin: 0 0 8px 0;
            font-family: var(--font-display);
            font-weight: 700;
          }
          .role-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .role-select-btn {
            display: flex;
            align-items: center;
            gap: 16px;
            background: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: var(--radius);
            padding: 14px 18px;
            cursor: pointer;
            text-align: left;
            transition: all 0.2s ease;
          }
          .role-select-btn:hover {
            border-color: var(--red);
            background: #fff8f8;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(211,30,37,0.06);
          }
          .role-select-btn .icon {
            font-size: 1.8rem;
          }
          .role-select-btn strong {
            display: block;
            font-size: 0.95rem;
            color: var(--ink);
          }
          .role-select-btn span {
            font-size: 0.78rem;
            color: var(--ink-soft);
          }
        `}</style>
      </div>
    );
  }

  // --- ROUTE PROTECTION / ACCESS CHECK ---
  const currentPath = router.pathname;
  const activeNavItem = NAV_ITEMS.find((item) => item.href === currentPath);
  const hasAccess = !activeNavItem || activeNavItem.roles.includes(userRole);

  // Filter navigation items based on active role
  const visibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  const roleLabels = {
    staff: { label: "เจ้าหน้าที่ปฏิบัติการ", color: "#10b981", icon: "🧹" },
    supervisor: { label: "ผู้จัดการ / Admin", color: "#3b82f6", icon: "👥" },
    executive: { label: "ผู้บริหารสูงสุด", color: "#eab308", icon: "👑" },
  };

  const currentRoleMeta = roleLabels[userRole] || { label: "ทั่วไป", color: "#64748b", icon: "👤" };

  return (
    <div className="shell">
      {/* SMM Intranet Header Theme */}
      <header className="smm-header">
        {/* Left Side: Brand Logo Box */}
        <Link href={userRole === "staff" ? "/report" : "/"} style={{ textDecoration: "none" }}>
          <div className="smm-logo-box">
            <svg className="smm-logo-svg" viewBox="0 0 100 80" fill="currentColor">
              <rect x="48" y="15" width="4" height="42" fill="white" />
              <path d="M50,15 C38,25 22,45 12,55 C18,54 26,52 34,50 C40,38 45,25 50,15 Z" fill="white" />
              <path d="M50,30 C42,38 30,53 22,60 C28,59 35,58 42,56 C45,48 48,38 50,30 Z" fill="white" opacity="0.8" />
              <path d="M50,15 C62,25 78,45 88,55 C82,54 74,52 66,50 C60,38 55,25 50,15 Z" fill="white" />
              <path d="M50,30 C58,38 70,53 78,60 C72,59 65,58 58,56 C55,48 52,38 50,30 Z" fill="white" opacity="0.8" />
              <path d="M15,64 C40,63 60,63 85,64 C70,64.5 30,64.5 15,64 Z" fill="white" />
            </svg>
            <span className="smm-logo-text font-display">ตลาดสี่มุมเมือง</span>
          </div>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="smm-nav">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`smm-nav-link ${router.pathname === item.href ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right Side: Mock Utility Panel */}
        <div className="smm-utility-panel">
          {/* Active Role Governance Badge */}
          <div className="role-gov-badge" style={{ backgroundColor: currentRoleMeta.color }}>
            <span style={{ marginRight: 4 }}>{currentRoleMeta.icon}</span>
            {currentRoleMeta.label}
          </div>

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
          <button className="utility-exit-btn" onClick={handleLogout} title="ออกจากระบบ / สลับผู้ใช้งาน">
            🚪
          </button>
        </div>
      </header>

      {/* Main Page Area with Access Check */}
      <main className="smm-main-container">
        {hasAccess ? (
          children
        ) : (
          <div className="access-denied-box card">
            <span className="denied-icon">🚫</span>
            <h2 className="font-display">ขออภัย คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
            <p>
              หน้านี้ถูกจำกัดการเข้าใช้งานเฉพาะ **{activeNavItem?.roles.map(r => roleLabels[r]?.label).join(" หรือ ")}** 
              เพื่อความปลอดภัยและการควบคุมการปกครองระบบ (System Governance)
            </p>
            <button className="btn" onClick={() => router.push(userRole === "staff" ? "/report" : "/")} style={{ marginTop: 14 }}>
              กลับไปยังหน้าที่ได้รับอนุญาต
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="smm-footer">
        <p>© 2026 ตลาดสี่มุมเมือง (Talaad Si Mum Muang) - ระบบบริหารการปฏิบัติงานตลาดอัจฉริยะ (Decision Intelligence Platform)</p>
      </footer>

      <style jsx global>{`
        /* Role Governance Badge */
        .role-gov-badge {
          color: #ffffff;
          padding: 6px 12px;
          border-radius: 99px;
          font-size: 0.78rem;
          font-weight: 700;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        /* Access denied container styling */
        .access-denied-box {
          text-align: center;
          padding: 60px 40px;
          border-top: 4px solid var(--red) !important;
          margin-top: 40px;
        }
        .denied-icon {
          font-size: 3.5rem;
          display: block;
          margin-bottom: 12px;
        }
      `}</style>
    </div>
  );
}
