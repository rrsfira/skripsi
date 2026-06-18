import axios from "axios";
import { NotificationManager } from "react-notifications";

const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);
const AUTO_NOTIFICATION_DELAY_MS = 250;

const getRequestMethod = (config = {}) =>
  String(config.method || "get").toLowerCase();

const isMutationRequest = (config = {}) =>
  MUTATION_METHODS.has(getRequestMethod(config));

const shouldSkipMutationNotification = (config = {}) => {
  const url = String(config.url || "").toLowerCase();
  const headers = config.headers || {};

  return (
    headers["X-Skip-Mutation-Notification"] === "1" ||
    headers["x-skip-mutation-notification"] === "1" ||
    url.includes("/api/auth/login") ||
    url.includes("/auth/login") ||
    url.includes("/upload")
  );
};

const getResponseMessage = (response, fallback) =>
  response?.data?.message || response?.data?.msg || fallback;

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  "Aksi gagal diproses";

const getSuccessFallbackMessage = (method) => {
  if (method === "post") return "Data berhasil ditambahkan";
  if (method === "delete") return "Data berhasil dihapus";
  return "Data berhasil diperbarui";
};

const markManualNotification = () => {
  window.__lastManualNotificationAt = Date.now();
};

const runAutoNotification = (callback) => {
  window.__isAutoMutationNotification = true;
  callback();
  window.__isAutoMutationNotification = false;
};

const installNotificationTracking = () => {
  if (window.__notificationTrackingInitialized) return;
  window.__notificationTrackingInitialized = true;

  ["success", "error", "warning", "info"].forEach((type) => {
    const original = NotificationManager[type];
    if (typeof original !== "function") return;

    NotificationManager[type] = (...args) => {
      if (!window.__isAutoMutationNotification) {
        markManualNotification();
      }
      return original.apply(NotificationManager, args);
    };
  });
};

const scheduleMutationNotification = (type, message) => {
  const startedAt = Date.now();

  window.setTimeout(() => {
    const lastManualNotificationAt = window.__lastManualNotificationAt || 0;
    if (lastManualNotificationAt >= startedAt) return;

    runAutoNotification(() => {
      if (type === "success") {
        NotificationManager.success(message, "Berhasil", 3500);
      } else {
        NotificationManager.error(message, "Gagal", 4500);
      }
    });
  }, AUTO_NOTIFICATION_DELAY_MS);
};

const checkAuth = () => {
  /*  Getting token value stored in localstorage, if token is not present we will open login page 
    for all internal dashboard routes  */
  const TOKEN = localStorage.getItem("token");
  const activeRole = localStorage.getItem("activeRole");
  const savedRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const PUBLIC_ROUTES = [
    "login",
    "forgot-password",
    "reset-password",
    "register",
    "documentation",
    "portal",
    "candidate/jobs",
    "candidate/apply",
    "candidate/status",
  ];

  const isPublicPage = PUBLIC_ROUTES.some((r) =>
    window.location.href.includes(r),
  );
  const isAppRoute = window.location.pathname.startsWith((process.env.PUBLIC_URL || '') + "/app");
  const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const userStatus = String(savedUser?.status || "").toLowerCase();

  if (TOKEN && isAppRoute && userStatus === "inactive") {
    localStorage.setItem("accountInactiveNotice", "1");
    localStorage.removeItem("token");
    localStorage.removeItem("roles");
    localStorage.removeItem("activeRole");
    delete axios.defaults.headers.common["Authorization"];
    window.location.href = (process.env.PUBLIC_URL || '') + '/login';
    return null;
  }

  if (!TOKEN && !isPublicPage) {
    window.location.href = (process.env.PUBLIC_URL || '') + '/login';
    return;
  }

  if (!TOKEN) {
    return null;
  }

  axios.defaults.headers.common["Authorization"] = `Bearer ${TOKEN}`;
  const currentActiveRole = localStorage.getItem("activeRole");
  if (currentActiveRole) {
    axios.defaults.headers.common["X-Active-Role"] = currentActiveRole;
  }

  if (isAppRoute) {
    if (!Array.isArray(savedRoles) || savedRoles.length === 0) {
      localStorage.clear();
      window.location.href = (process.env.PUBLIC_URL || '') + '/login';
      return;
    }

    if (!activeRole || !savedRoles.includes(activeRole)) {
      localStorage.setItem("activeRole", savedRoles[0]);
    }
  }

  if (!window.__axiosInterceptorsInitialized) {
    window.__axiosInterceptorsInitialized = true;
    installNotificationTracking();

    axios.interceptors.request.use(
      function (config) {
        document.body.classList.add("loading-indicator");
        const runtimeActiveRole = localStorage.getItem("activeRole");
        if (runtimeActiveRole) {
          config.headers = config.headers || {};
          config.headers["X-Active-Role"] = runtimeActiveRole;
        }
        return config;
      },
      function (error) {
        return Promise.reject(error);
      },
    );

    axios.interceptors.response.use(
      function (response) {
        document.body.classList.remove("loading-indicator");

        if (
          isMutationRequest(response?.config) &&
          !shouldSkipMutationNotification(response?.config)
        ) {
          const method = getRequestMethod(response.config);
          scheduleMutationNotification(
            "success",
            getResponseMessage(response, getSuccessFallbackMessage(method)),
          );
        }

        return response;
      },
      function (error) {
        document.body.classList.remove("loading-indicator");

        const statusCode = error?.response?.status;
        const errorCode = error?.response?.data?.code;
        const requestUrl = String(error?.config?.url || "");
        const hasToken = Boolean(localStorage.getItem("token"));
        if (statusCode === 403 && errorCode === "ACCOUNT_INACTIVE") {
          localStorage.clear();
          localStorage.setItem("accountInactiveNotice", "1");
          delete axios.defaults.headers.common["Authorization"];
          window.location.href = (process.env.PUBLIC_URL || '') + '/login';
        }

        const isAuthLoginRequest =
          requestUrl.includes("/api/auth/login") ||
          requestUrl.includes("/auth/login");
        if (statusCode === 401 && hasToken && !isAuthLoginRequest) {
          localStorage.clear();
          localStorage.setItem("sessionExpiredNotice", "1");
          delete axios.defaults.headers.common["Authorization"];
          window.location.href = (process.env.PUBLIC_URL || '') + '/login';
        }

        if (
          isMutationRequest(error?.config) &&
          !shouldSkipMutationNotification(error?.config)
        ) {
          scheduleMutationNotification("error", getErrorMessage(error));
        }

        return Promise.reject(error);
      },
    );
  }

  return TOKEN;
};

export default checkAuth;
