// pages/api/supervisor/request.js
// Supervisor creates requests for Executive approval.
import { getDb, saveDb } from "../../../lib/serverDb";

export default function handler(req, res) {
  const db = getDb();
  
  if (req.method === 'GET') {
    res.status(200).json(db.supervisorRequests || []);
  } else if (req.method === 'POST') {
    const { departmentId, title, cost } = req.body;
    const now = Date.now();
    
    const newRequest = {
      id: `req-${now}`,
      departmentId,
      title,
      status: "Pending",
      cost: parseFloat(cost) || 0,
      createdAt: now
    };
    
    if (!db.supervisorRequests) {
      db.supervisorRequests = [];
    }
    
    db.supervisorRequests.push(newRequest);
    saveDb(db);
    
    res.status(201).json(newRequest);
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
