export default function TorusConnector({ id, label, first = false }) {
  return (
    <div
      className={`connector ${first ? "connector-first" : ""}`}
      data-reveal
      id={id}
    >
      <div className="connector-dot" />
      <div className="connector-line" />
      <h2 className="connector-label">{label}</h2>
      <div className="connector-line" />
      <div className="connector-dot" />
    </div>
  );
}
