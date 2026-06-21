import AppPreloader from "./AppPreloader";

export default function AppPageFallback({ label = "Loading page" }) {
  return (
    <div
      className="flex min-h-[50vh] w-full items-center justify-center px-5 py-16"
      role="status"
      aria-label={label}
    >
      <AppPreloader label={label} tone="indigo" />
    </div>
  );
}
