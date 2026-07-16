export default function handler(req, res) {
  if (req.method === 'GET') {
    const roles = [
      { id: "exec", name: "ผู้บริหาร (Executive)" },
      { id: "d-security", name: "หัวหน้าฝ่ายรักษาความปลอดภัย" },
      { id: "d-clean", name: "หัวหน้าฝ่ายรักษาความสะอาด" },
      { id: "d-maintenance", name: "หัวหน้าฝ่ายซ่อมบำรุง" }
    ];
    res.status(200).json(roles);
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
