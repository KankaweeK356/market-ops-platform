// pages/api/decisions/[id].js
// Logs decision, spawns task with SLA, and avoids immediate KPI recovery to keep task flow realistic.
import { getDb, saveDb } from "../../../lib/serverDb";

export default function handler(req, res) {
  const { id } = req.query; // aiInsightId
  const db = getDb();

  if (req.method === 'POST') {
    const { optionId } = req.body;
    const now = Date.now();
    
    const insight = db.aiInsights.find(i => i.id === id);
    if (!insight) return res.status(404).json({ message: "Insight not found" });

    const option = db.decisionOptions.find(o => o.id === optionId);
    if (!option) return res.status(404).json({ message: "Option not found" });

    // 1. Log Decision
    const newDecision = {
      id: `dec-${now}`,
      aiInsightId: id,
      chosenOptionId: optionId,
      approvedBy: "Executive-User",
      createdAt: now
    };
    db.executiveDecisions.push(newDecision);

    // 2. Create Task automatically with SLAs from AI Insight (Governance Gap 7)
    const newTask = {
      id: `task-${now}`,
      decisionId: newDecision.id,
      departmentId: option.departmentId,
      title: `ดำเนินการด่วน: ${option.optionText}`,
      status: "Pending",
      responseSla: insight.responseSla || 15,
      resolutionSla: insight.resolutionSla || 60,
      createdAt: now,
      updatedAt: now
    };
    db.tasks.push(newTask);

    // Note: Removed the immediate KPI reset loop here so that the loop is only closed 
    // when the Staff actually completes the task via /api/tasks/[id]/status.js.

    saveDb(db);
    res.status(201).json({ decision: newDecision, task: newTask });
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
