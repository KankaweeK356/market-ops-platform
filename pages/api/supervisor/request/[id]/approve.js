// pages/api/supervisor/request/[id]/approve.js
// Executive approves supervisor request and creates a corresponding Staff Task.
import { getDb, saveDb } from "../../../../../lib/serverDb";

export default function handler(req, res) {
  const { id } = req.query;
  const db = getDb();
  
  if (req.method === 'POST') {
    if (!db.supervisorRequests) {
      return res.status(404).json({ message: "No requests found" });
    }
    
    const reqIndex = db.supervisorRequests.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Update request status
    db.supervisorRequests[reqIndex].status = "Approved";
    db.supervisorRequests[reqIndex].approvedAt = Date.now();
    
    const approvedRequest = db.supervisorRequests[reqIndex];
    
    // Create operational task for staff
    const newTask = {
      id: `task-req-${Date.now()}`,
      decisionId: approvedRequest.id, // linked to request
      departmentId: approvedRequest.departmentId,
      title: `ดำเนินการด่วน: ${approvedRequest.title}`,
      status: "Pending",
      responseSla: 15,
      resolutionSla: 60,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    db.tasks.push(newTask);
    
    saveDb(db);
    
    res.status(200).json({ request: approvedRequest, task: newTask });
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
