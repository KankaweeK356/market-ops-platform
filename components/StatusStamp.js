import { statusMeta } from "../lib/constants";

export default function StatusStamp({ status, size }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`stamp${size === "lg" ? " lg" : ""}`}
      style={{ "--stamp-color": meta.color }}
    >
      {status}
    </span>
  );
}
