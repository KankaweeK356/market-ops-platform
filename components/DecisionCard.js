import React from "react";

export default function DecisionCard({ 
  caseId, 
  aiLabel, 
  title, 
  what, 
  why, 
  decisions = [], 
  onDecision, 
  loggedDecision 
}) {
  return (
    <div className="card decision-card" id={`case-${caseId}`}>
      {/* AI Label Tag Badge */}
      <div className="ai-tag-wrapper">
        <span className="ai-tag">{aiLabel}</span>
      </div>

      {/* Title */}
      <h3 className="card-title font-display">
        <span className="case-num">Case {caseId}:</span> {title}
      </h3>

      <div className="card-sections">
        {/* WHAT Section */}
        <div className="card-section">
          <div className="section-label">🔴 เกิดอะไรขึ้น (What)</div>
          <div className="section-body">{what}</div>
        </div>

        {/* WHY Section */}
        <div className="card-section">
          <div className="section-label">📊 ทำไมต้องสนใจตอนนี้ (Why now)</div>
          <div className="section-body">{why}</div>
        </div>

        {/* DECISION Section */}
        <div className="card-section decision-section">
          <div className="section-label">🎯 ต้องตัดสินใจอะไร (Decision)</div>
          
          {loggedDecision ? (
            <div className="decision-completed-banner">
              <span className="check-icon">✓</span>
              <div className="decision-details">
                <strong>ตัดสินใจแล้ว:</strong> &ldquo;{loggedDecision.decisionText}&rdquo;
                <span className="decision-time">บันทึกเมื่อ: {loggedDecision.timestamp}</span>
              </div>
            </div>
          ) : (
            <div className="decision-buttons">
              {decisions.map((text) => (
                <button
                  key={text}
                  type="button"
                  className="btn decision-btn"
                  onClick={() => onDecision(caseId, text)}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .decision-card {
          position: relative;
          border-left: 5px solid var(--gold);
          transition: all 0.20s ease;
        }
        .decision-card:hover {
          box-shadow: 0 4px 14px rgba(35, 38, 31, 0.08);
        }
        .ai-tag-wrapper {
          position: absolute;
          top: 18px;
          right: 20px;
        }
        .ai-tag {
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          background: var(--ink);
          color: var(--paper);
          padding: 4px 10px;
          border-radius: 3px;
          font-weight: 700;
        }
        
        .card-title {
          margin: 0 0 20px 0;
          font-size: 1.25rem;
          font-weight: 700;
          padding-right: 120px;
        }
        .case-num {
          color: var(--gold);
          margin-right: 4px;
        }

        .card-sections {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .card-section {
          padding-bottom: 12px;
          border-bottom: 1px dashed var(--line);
        }
        .card-section:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .section-label {
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--ink-soft);
          margin-bottom: 6px;
        }
        .section-body {
          font-size: 0.92rem;
          line-height: 1.5;
          color: var(--ink);
        }

        .decision-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 8px;
        }
        .decision-btn {
          font-size: 0.88rem;
          padding: 8px 16px;
          background: #fff;
          color: var(--ink);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          cursor: pointer;
          font-weight: 600;
          transition: all 0.15s ease;
        }
        .decision-btn:hover {
          background: var(--ink);
          color: var(--paper);
          border-color: var(--ink);
        }

        /* Completed Banner styling */
        .decision-completed-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--green-soft);
          border: 1px solid var(--green);
          color: #234f32;
          padding: 12px 16px;
          border-radius: var(--radius);
          margin-top: 8px;
        }
        .check-icon {
          font-size: 1.4rem;
          font-weight: bold;
        }
        .decision-details {
          display: flex;
          flex-direction: column;
          font-size: 0.9rem;
        }
        .decision-time {
          font-size: 0.72rem;
          opacity: 0.8;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
