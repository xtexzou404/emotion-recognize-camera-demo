const DETECTOR_SETTINGS_KEY = "emotion_app_detector_settings";

const DEFAULT_DETECTOR_SETTINGS = {
  drawBoxes: true,
  showEmotionText: true,
  showPerformance: true,
  showGender: true,
  showAge: true,
  sensitivity: "balanced",
};

export const getDetectorSettings = () => {
  try {
    const raw = localStorage.getItem(DETECTOR_SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_DETECTOR_SETTINGS;
    }

    return {
      ...DEFAULT_DETECTOR_SETTINGS,
      ...JSON.parse(raw),
    };
  } catch {
    return DEFAULT_DETECTOR_SETTINGS;
  }
};

export const saveDetectorSettings = (settings) => {
  const normalized = {
    ...DEFAULT_DETECTOR_SETTINGS,
    ...(settings || {}),
  };

  localStorage.setItem(DETECTOR_SETTINGS_KEY, JSON.stringify(normalized));
};

export const DETECTOR_SETTINGS_DEFAULTS = DEFAULT_DETECTOR_SETTINGS;
