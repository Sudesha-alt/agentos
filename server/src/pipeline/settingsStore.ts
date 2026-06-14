export interface PipelineSettings {
  systemDesignComplexityThreshold: number;
}

const DEFAULTS: PipelineSettings = {
  systemDesignComplexityThreshold: 5,
};

let settings: PipelineSettings = { ...DEFAULTS };

export function loadPipelineSettingsFromStore(): PipelineSettings {
  settings = { ...DEFAULTS };
  return settings;
}

export function getPipelineSettings(): PipelineSettings {
  return settings;
}

export function savePipelineSettings(patch: Partial<PipelineSettings>): PipelineSettings {
  settings = {
    ...settings,
    ...patch,
    systemDesignComplexityThreshold:
      patch.systemDesignComplexityThreshold !== undefined
        ? Math.max(1, Math.min(10, patch.systemDesignComplexityThreshold))
        : settings.systemDesignComplexityThreshold,
  };
  return settings;
}

export function getPublicPipelineSettings(): PipelineSettings {
  return getPipelineSettings();
}
