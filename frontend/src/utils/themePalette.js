export const UI_PALETTE = Object.freeze({
  light: {
    primary: "#F58220",
    primaryHover: "#FF9F40",
    primarySoft: "#FFB066",
    background: "#FFFFFF",
    section: "#F5F5F5",
    surface: "#FAFAFA",
    border: "#E0E0E0",
    textPrimary: "#333333",
    textSecondary: "#4F4F4F",
    textMuted: "#9E9E9E",
    textOnPrimary: "#FFFFFF",
    success: "#2ECC71",
    warning: "#FFB020",
    error: "#E74C3C",
    info: "#3498DB",
  },
  dark: {
    primary: "#F58220",
    primaryHover: "#FF9F40",
    primarySoft: "#FFB066",
    background: "#1E1E1E",
    section: "#2D2D2D",
    surface: "#333333",
    border: "#4F4F4F",
    textPrimary: "#FFFFFF",
    textSecondary: "#E0E0E0",
    textMuted: "#9E9E9E",
    textOnPrimary: "#FFFFFF",
    success: "#27AE60",
    warning: "#F39C12",
    error: "#E74C3C",
    info: "#2980B9",
  },
});

export const CHART_PALETTE = Object.freeze({
  light: ["#F58220", "#FFB066", "#FF9F40", "#4F4F4F", "#3498DB", "#2ECC71", "#9B59B6"],
  dark: ["#F58220", "#FFB066", "#FFD08A", "#4FC3F7", "#81C784", "#BA68C8", "#F06292"],
});

export function getCurrentTheme() {
  if (typeof document !== "undefined") {
    const dataTheme = document.documentElement.getAttribute("data-theme");
    if (dataTheme === "dark" || dataTheme === "light") return dataTheme;
  }

  if (typeof localStorage !== "undefined") {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  }

  return "light";
}

export function getChartColors() {
  const theme = getCurrentTheme();
  return CHART_PALETTE[theme] || CHART_PALETTE.light;
}

export function toRgba(hex, alpha = 1) {
  const value = (hex || "").replace("#", "");
  if (value.length !== 6) return hex;

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}