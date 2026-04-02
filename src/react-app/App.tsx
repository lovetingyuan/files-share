import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Verify } from './pages/Verify';
import { Dashboard } from './pages/Dashboard';

function AppContent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  const handleSwitchToRegister = () => {
    navigate('/register');
  };

  const handleSwitchToLogin = (email?: string) => {
    const search = email ? `?email=${encodeURIComponent(email)}&registered=1` : '';
    navigate(`/login${search}`);
  };

  const handleVerifySuccess = () => {
    navigate('/login');
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login onSwitchToRegister={handleSwitchToRegister} />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/" replace /> : <Register onSwitchToLogin={handleSwitchToLogin} />}
      />
      <Route
        path="/verify/:token"
        element={user ? <Navigate to="/" replace /> : <Verify onSuccess={handleVerifySuccess} />}
      />
      <Route path="/" element={user ? <Dashboard /> : <Login onSwitchToRegister={handleSwitchToRegister} />} />
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
