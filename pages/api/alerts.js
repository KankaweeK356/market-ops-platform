import { getDb } from "../../lib/serverDb";

export default function handler(req, res) {
  if (req.method === 'GET') {
    const { department } = req.query;
    const db = getDb();
    
    let alerts = db.submissions.filter(r => !r.resolved && (r.derivedStatus === "เร่งด่วน" || r.derivedStatus === "ต้องติดตาม"));
    
    if (department && department !== 'ทั้งหมด') {
      alerts = alerts.filter(r => r.departmentId === department);
    }
    
    // Sort by severity (เร่งด่วน first, then ต้องติดตาม)
    alerts.sort((a, b) => {
      if (a.derivedStatus === "เร่งด่วน" && b.derivedStatus !== "เร่งด่วน") return -1;
      if (a.derivedStatus !== "เร่งด่วน" && b.derivedStatus === "เร่งด่วน") return 1;
      return b.createdAt - a.createdAt;
    });
    
    res.status(200).json(alerts);
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
