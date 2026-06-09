import { useState } from "react";
import { useSettings } from "../../entities/settings";
import { useSaveSettings } from "../../features/save-settings/model/useSaveSettings";
import SettingsSectionsWidget from "../../widgets/settings-sections/SettingsSectionsWidget";
import { PageIntro } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";

export default function Settings() {
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
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-app-ink-mute">Loading settings…</p>
      </div>
    );
  }

  return (
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Settings"
        title="Workspace configuration."
        body="These values control how the pipeline talks to Jira and how strict each validation gate should be. The UI is now adapter-backed, so server persistence can be wired later without rewriting the screen."
      />

      <SettingsSectionsWidget
        form={form}
        onChange={update}
        onSubmit={onSubmit}
        pending={pending}
        savedAt={savedAt}
        error={error?.message}
      />
    </AnimatedAppPage>
  );
}
