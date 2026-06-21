import AppPreloader from "../../shared/ui/AppPreloader";

export default function Spinner({ label = "Loading", className = "" }) {
  return (
    <div className={className}>
      <AppPreloader label={label || undefined} tone="indigo" size="sm" />
    </div>
  );
}
