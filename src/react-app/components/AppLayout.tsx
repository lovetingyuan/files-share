import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfileApi";
import { UserAvatar } from "./UserAvatar";

function AuthenticatedNavMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();

  return (
    <div className="flex-none">
      <button
        type="button"
        className="btn btn-ghost btn-circle avatar"
        aria-label="Go to profile"
        onClick={() => navigate("/profile")}
      >
        <UserAvatar email={user?.email} avatarUrl={profile?.avatarUrl} />
      </button>
    </div>
  );
}

export function AppLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <nav className="navbar bg-base-100 shadow-sm px-6">
        <div className="flex-1">
          <Link to="/" className="flex items-center gap-2 text-xl">
            <img src="/favicon.svg" alt="logo" className="h-6 w-6" />
            <span>File Share</span>
          </Link>
        </div>
        {user ? <AuthenticatedNavMenu /> : null}
      </nav>

      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
