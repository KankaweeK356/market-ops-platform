// pages/api/tasks/[id]/status.js
// Updates task status, calculates Expected vs Actual outcome and logs AI feedback records.
import { getDb, saveDb, addAiLearningLog } from "../../../../lib/serverDb";

export default function handler(req, res) {
  const { id } = req.query;
  const db = getDb();

  if (req.method === "PUT") {
    const { status } = req.body;

    const taskIndex = db.tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) {
      return res.status(404).json({ message: "Task not found" });
    }

    const prevStatus = db.tasks[taskIndex].status;
    db.tasks[taskIndex].status = status;
    db.tasks[taskIndex].updatedAt = Date.now();

    // Log Task History
    db.taskHistory.push({
      id: `th-${Date.now()}`,
      taskId: id,
      oldStatus: prevStatus,
      newStatus: status,
      changedAt: Date.now(),
    });

    // ── Feedback Loop: When Task Completed → Calculate Outcome & Reset KPI ──
    if (status === "Completed") {
      const task = db.tasks[taskIndex];

      // Trace back: Task → Decision → AI Insight → Alert → KPI Record
      const decision = db.executiveDecisions.find((d) => d.id === task.decisionId);
      if (decision) {
        const insight = db.aiInsights.find((i) => i.id === decision.aiInsightId);
        if (insight) {
          const alert = db.alerts.find((a) => a.id === insight.alertId);
          if (alert) {
            const kpiRecIdx = db.kpiRecords.findIndex((k) => k.id === alert.kpiRecordId);
            if (kpiRecIdx !== -1) {
              const kpiRecord = db.kpiRecords[kpiRecIdx];
              const kpiDef = db.kpiDefinitions.find((k) => k.id === kpiRecord.kpiId);
              const chosenOption = db.decisionOptions.find((o) => o.id === decision.chosenOptionId);

              // 1. Determine Expected vs Actual Outcome
              let expectedNumeric = 50;
              let expectedStr = "50";
              let unit = "";

              if (chosenOption && chosenOption.expectedImpact) {
                expectedStr = chosenOption.expectedImpact.after;
                expectedNumeric = parseFloat(expectedStr);
                unit = kpiDef ? kpiDef.unit : "";
              }

              // Simulate actual outcome with slight variance (95% - 99% accuracy)
              const variancePercent = (Math.random() - 0.5) * 4; // -2% to +2%
              const actualNumeric = parseFloat((expectedNumeric + (expectedNumeric * (variancePercent / 100))).toFixed(1));
              const accuracyPercent = parseFloat((100 - Math.abs(variancePercent)).toFixed(2));

              // 2. Save outcome data on the Task object
              task.actualOutcomeValue = `${actualNumeric}${unit}`;
              task.accuracy = `${accuracyPercent}%`;

              const learningRecordText = `Updated prediction weights for ${kpiDef ? kpiDef.name : "KPI"} in ${db.currentScenario} Scenario (Adjustment: ${variancePercent.toFixed(2)}%)`;
              task.learningApplied = learningRecordText;

              // 3. Log into the AI Feedback learning database (Simulation Log - Gap 16)
              addAiLearningLog({
                event: `Task Resolved: ${task.title}`,
                accuracy: `${accuracyPercent}%`,
                record: learningRecordText
              });

              // 4. Update the KPI record state to Normal and actual simulated value
              kpiRecord.status = "Normal";
              kpiRecord.value = actualNumeric;
              kpiRecord.resolvedAt = Date.now();
            }
          }
        }
      }
    }

    saveDb(db);
    res.status(200).json({
      ...db.tasks[taskIndex],
      kpiResolved: status === "Completed",
    });
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
