const THEME_KEY = "emotion_app_theme";
const DEFAULT_THEME = "light";

const isBrowser = typeof window !== "undefined";

const normalizeTheme = (value) => (value === "dark" ? "dark" : DEFAULT_THEME);

export const getTheme = () => {
  if (!isBrowser) {
    return DEFAULT_THEME;
  }

  try {
    return normalizeTheme(window.localStorage.getItem(THEME_KEY));
  } catch {
    return DEFAULT_THEME;
  }
};

export const applyTheme = (theme) => {
  if (!isBrowser) {
    return DEFAULT_THEME;
  }

  const normalized = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", normalized);
  return normalized;
};

export const saveTheme = (theme) => {
  if (!isBrowser) {
    return DEFAULT_THEME;
  }

  const normalized = normalizeTheme(theme);
  window.localStorage.setItem(THEME_KEY, normalized);
  return normalized;
};

export const setTheme = (theme) => {
  const normalized = saveTheme(theme);
  return applyTheme(normalized);
};

export const toggleTheme = (currentTheme) => {
  const nextTheme = normalizeTheme(currentTheme) === "dark" ? "light" : "dark";
  return setTheme(nextTheme);
};

