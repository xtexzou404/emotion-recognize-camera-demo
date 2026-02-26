import {
  CAMERA_STORAGE_KEY,
  DEFAULT_CAMERA_SOURCE,
} from "../config/cameraConfig";

const isBrowser = typeof window !== "undefined";

const normalize = (value) => {
  if (!value || typeof value !== "object") {
    return DEFAULT_CAMERA_SOURCE;
  }

  const type = value.type === "ip" ? "ip" : "local";
  const ipUrl = typeof value.ipUrl === "string" ? value.ipUrl.trim() : "";

  return { type, ipUrl };
};

export const getCameraSource = () => {
  if (!isBrowser) {
    return DEFAULT_CAMERA_SOURCE;
  }

  try {
    const raw = window.localStorage.getItem(CAMERA_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CAMERA_SOURCE;
    }

    return normalize(JSON.parse(raw));
  } catch {
    return DEFAULT_CAMERA_SOURCE;
  }
};

export const saveCameraSource = (source) => {
  if (!isBrowser) {
    return;
  }

  const normalized = normalize(source);
  window.localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(normalized));
};

