import { useEffect } from "react";
import { useRouter } from "next/router";

export default function TableauRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
      <h2>กำลังนำท่านกลับสู่หน้าหลัก...</h2>
    </div>
  );
}
