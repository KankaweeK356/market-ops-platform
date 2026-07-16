import { getDb } from "../../../lib/serverDb";

export default function handler(req, res) {
  if (req.method === 'GET') {
    const { department } = req.query;
    const db = getDb();
    
    let tasks = db.tasks;
    if (department && department !== 'ทั้งหมด') {
      tasks = tasks.filter(t => t.departmentId === department);
    }
    
    // Sort by newest first
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    
    res.status(200).json(tasks);
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
