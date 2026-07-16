// pages/admin.js — Disabled (storage.js removed, redirect to home)
import { useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, []);
  return <Layout><div style={{ padding: 40, textAlign: "center" }}>กำลังเปลี่ยนหน้า...</div></Layout>;
}
