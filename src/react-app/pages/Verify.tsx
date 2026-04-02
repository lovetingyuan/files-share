import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useVerifyEmail } from "../hooks/useAuthApi";

interface VerifyProps {
  onSuccess: () => void;
}

export function Verify({ onSuccess }: VerifyProps) {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  const { result, error, isLoading } = useVerifyEmail(token, email ?? undefined);
  const status: "loading" | "success" | "error" =
    !token || !email ? "error" : isLoading ? "loading" : result ? "success" : "error";
  const errorMessage = !token
    ? "Invalid verification link"
    : !email
      ? "Email is missing from the verification link"
      : (error?.message ?? "An error occurred during verification");

  useEffect(() => {
    if (!result) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onSuccess();
    }, 2000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [onSuccess, result]);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body text-center">
          {status === "loading" && (
            <>
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <h2 className="card-title text-2xl font-bold justify-center mt-4">
                Verifying your email...
              </h2>
            </>
          )}

          {status === "success" && (
            <>
              <Icon
                icon="mdi:check-circle"
                className="text-success text-6xl mb-4 mx-auto"
                width={72}
              />
              <h2 className="card-title text-2xl font-bold justify-center">Email Verified!</h2>
              <p className="mt-2">Redirecting to login...</p>
            </>
          )}

          {status === "error" && (
            <>
              <Icon
                icon="mdi:close-circle"
                className="text-error text-6xl mb-4 mx-auto"
                width={72}
              />
              <h2 className="card-title text-2xl font-bold justify-center">Verification Failed</h2>
              <p className="mt-2 text-error">{errorMessage}</p>
              <button type="button" className="btn btn-primary mt-4 gap-2" onClick={onSuccess}>
                <Icon icon="mdi:login" className="w-5 h-5" />
                Go to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
