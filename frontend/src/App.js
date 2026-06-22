// ErrorBoundary untuk menangkap error runtime di komponen React
import ReactDOM from "react-dom";
import React, { lazy, useEffect, Suspense } from "react";
import { useSelector } from "react-redux";
import "./App.css";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { themeChange } from "theme-change";
import checkAuth from "./app/auth";
import initializeApp from "./app/init";
import { NotificationContainer } from "react-notifications";
import "react-notifications/lib/notifications.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    // Bisa log ke service eksternal di sini
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: "red", padding: 32 }}>
          <h2>Terjadi error pada aplikasi:</h2>
          <pre>{this.state.error && this.state.error.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Importing pages
const Layout = lazy(() => import("./containers/Layout"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Register = lazy(() => import("./pages/Register"));
const Documentation = lazy(() => import("./pages/Documentation"));
const InternalPortalLandingPage = lazy(
  () => import("./pages/InternalPortalLandingPage"),
);
const CandidateJobsPage = lazy(() => import("./pages/CandidateJobsPage"));
const CandidateApplyPage = lazy(() => import("./pages/CandidateApplyPage"));
const CandidateRequestsPage = lazy(
  () => import("./pages/CandidateRequestsPage"),
);
const CandidateJobDetailPage = lazy(
  () => import("./pages/CandidateJobDetailPage"),
);
const CandidateRoutes = lazy(() => import("./pages/CandidateRoutes"));

// Initializing different libraries
initializeApp();

// Check for login and initialize axios
const token = checkAuth();

function App() {
  const pageTitle = useSelector((state) => state.header.pageTitle);

  useEffect(() => {
    // Update browser tab title based on current page
    if (pageTitle) {
      document.title = `${pageTitle} - PT OTAK KANAN`;
    } else {
      document.title = "PT OTAK KANAN";
    }
  }, [pageTitle]);

  useEffect(() => {
    // 👆 daisy UI themes initialization
    themeChange(false);
  }, []);

  return (
    <ErrorBoundary>
      <Router basename={process.env.PUBLIC_URL || "/"}>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              Loading...
            </div>
          }
        >
          <Routes>
            {/* Public candidate job application routes */}
            <Route
              path="/"
              element={<Navigate to="/candidate/jobs" replace />}
            />
            <Route path="/portal" element={<InternalPortalLandingPage />} />
            <Route path="/candidate/jobs" element={<CandidateJobsPage />} />
            <Route
              path="/candidate/jobs/:jobId"
              element={<CandidateJobDetailPage />}
            />
            <Route
              path="/candidate/apply/:jobId"
              element={<CandidateApplyPage />}
            />
            <Route
              path="/candidate/status"
              element={<CandidateRequestsPage />}
            />
            <Route path="/candidate/*" element={<CandidateRoutes />} />

            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/register" element={<Register />} />
            <Route path="/documentation" element={<Documentation />} />

            {/* Place new routes over this */}
            <Route path="/app/*" element={<Layout />} />

            <Route
              path="*"
              element={<Navigate to="/candidate/jobs" replace />}
            />
          </Routes>
        </Suspense>
      </Router>
      <NotificationContainer />
    </ErrorBoundary>
  );
}

export default App;
