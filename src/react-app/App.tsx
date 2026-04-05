import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AppLayout } from "./components/AppLayout";
import { HealthCheckReporter } from "./components/HealthCheckReporter";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Verify } from "./pages/Verify";
import { Dashboard } from "./pages/Dashboard";
import { Profile } from "./pages/Profile";
import { FilePickerDebug } from "./pages/FilePickerDebug";
import { ShareDownload } from "./pages/ShareDownload";

function AuthGate() {
  const { authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return <Outlet />;
}

function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSwitchToRegister = () => {
    navigate("/register");
  };

  const handleSwitchToLogin = (email?: string) => {
    const search = email ? `?email=${encodeURIComponent(email)}&registered=1` : "";
    navigate(`/login${search}`);
  };

  const handleVerifySuccess = () => {
    navigate("/login");
  };

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="share/:token" element={<ShareDownload />} />
        <Route element={<AuthGate />}>
          <Route
            path="login"
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <Login onSwitchToRegister={handleSwitchToRegister} />
              )
            }
          />
          <Route
            path="register"
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <Register onSwitchToLogin={handleSwitchToLogin} />
              )
            }
          />
          <Route
            path="verify/:token"
            element={
              user ? <Navigate to="/" replace /> : <Verify onSuccess={handleVerifySuccess} />
            }
          />
          <Route
            path="profile"
            element={user ? <Profile /> : <Login onSwitchToRegister={handleSwitchToRegister} />}
          />
          <Route
            index
            element={user ? <Dashboard /> : <Login onSwitchToRegister={handleSwitchToRegister} />}
          />
        </Route>
      </Route>
    </Routes>
  );
}

function AppRoutes() {
  const location = useLocation();

  if (location.pathname === "/debug/file-picker") {
    return <FilePickerDebug />;
  }

  return (
    <AuthProvider>
      <HealthCheckReporter />
      <AppContent />
    </AuthProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{ duration: 5000 }} />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
