import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";

interface LoginProps {
  onSwitchToRegister: () => void;
}

export function Login({ onSwitchToRegister }: LoginProps) {
  const [searchParams] = useSearchParams();
  const { login, loading } = useAuth();
  const registered = searchParams.get("registered") === "1";
  const initialEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (registered) {
      toast.success("Registration successful. Please verify your email, then log in.");
    }
  }, [registered]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    const result = await login(email, password);
    if (!result.success) {
      toast.error(result.error || "Login failed");
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold text-center justify-center mb-4">Login</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text flex items-center gap-1">
                  <Icon icon="mdi:email-outline" className="w-4 h-4" />
                  Email
                </span>
              </label>
              <input
                type="email"
                placeholder="email@example.com"
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text flex items-center gap-1">
                  <Icon icon="mdi:lock-outline" className="w-4 h-4" />
                  Password
                </span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="input input-bordered w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-control mt-6">
              <button
                type="submit"
                className={`btn btn-primary gap-2 ${loading ? "loading" : ""}`}
                disabled={loading}
              >
                {loading ? (
                  "Logging in..."
                ) : (
                  <>
                    <Icon icon="mdi:login" className="w-5 h-5" />
                    Login
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="divider">OR</div>

          <button
            type="button"
            className="btn btn-outline gap-2"
            onClick={onSwitchToRegister}
            disabled={loading}
          >
            <Icon icon="mdi:account-plus-outline" className="w-5 h-5" />
            Create an account
          </button>
        </div>
      </div>
    </div>
  );
}
