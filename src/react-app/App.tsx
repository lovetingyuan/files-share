import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AppLayout } from "./components/AppLayout";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Verify } from "./pages/Verify";
import { Dashboard } from "./pages/Dashboard";
import { Profile } from "./pages/Profile";

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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" toastOptions={{ duration: 5000 }} />
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
