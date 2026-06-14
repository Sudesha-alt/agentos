import { useState } from "react";
import { useSettings } from "../../../entities/settings";
import { useSaveSettings } from "../../../features/save-settings/model/useSaveSettings";
import SettingsSectionsWidget from "../../../widgets/settings-sections/SettingsSectionsWidget";

/** Pipeline quality & gate thresholds (integrations live under Integrations tab). */
export default function SettingsPipelinePage() {
  const { data, loading } = useSettings();
  const { save, pending, error, savedAt } = useSaveSettings();
  const [form, setForm] = useState(null);

  if (!form && data) {
    setForm(data);
  }

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    await save(form);
  }

  if (loading && !form) {
    return (
      <div className="flex h-40 items-center justify-center text-[13px] text-app-ink-mute">
        Loading…
      </div>
    );
  }

  return (
    <SettingsSectionsWidget
      form={form}
      onChange={update}
      onSubmit={onSubmit}
      pending={pending}
      savedAt={savedAt}
      error={error?.message}
      mode="pipeline"
    />
  );
}
