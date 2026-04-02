import useSWR from "swr";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { ApiError, apiRequest } from "../lib/api";

export interface User {
  email: string;
  verified: boolean;
  createdAt?: number;
}

type AuthUserResponse = {
  success: true;
  user: User;
};

type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponse = {
  success: true;
  message: string;
  user: User;
};

type RegisterPayload = {
  email: string;
  password: string;
};

type RegisterResponse = {
  success: true;
  message: string;
};

type LogoutResponse = {
  success: true;
  message: string;
};

type VerifyResponse = {
  success: true;
  message: string;
};

const AUTH_USER_KEY = "/api/auth/me";

async function fetchAuthUser(): Promise<User | null> {
  try {
    const data = await apiRequest<AuthUserResponse>(AUTH_USER_KEY);
    return data.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export function useAuthUser() {
  const { data, error, isLoading, mutate } = useSWR<User | null, ApiError>(
    AUTH_USER_KEY,
    fetchAuthUser,
    {
      shouldRetryOnError: false,
    },
  );

  return {
    user: data ?? null,
    error,
    isLoading,
    mutate,
  };
}

export function useLoginMutation() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating } = useSWRMutation<LoginResponse, ApiError, string, LoginPayload>(
    "/api/auth/login",
    (url, { arg }) =>
      apiRequest<LoginResponse>(url, {
        method: "POST",
        body: JSON.stringify(arg),
      }),
    {
      throwOnError: true,
    },
  );

  const login = async (email: string, password: string) => {
    const data = await trigger({ email, password });
    await mutate(AUTH_USER_KEY, data.user, { revalidate: false });
    return data;
  };

  return {
    login,
    isMutating,
  };
}

export function useRegisterMutation() {
  const { trigger, isMutating } = useSWRMutation<
    RegisterResponse,
    ApiError,
    string,
    RegisterPayload
  >(
    "/api/auth/register",
    (url, { arg }) =>
      apiRequest<RegisterResponse>(url, {
        method: "POST",
        body: JSON.stringify(arg),
      }),
    {
      throwOnError: true,
    },
  );

  const register = (email: string, password: string) => trigger({ email, password });

  return {
    register,
    isMutating,
  };
}

export function useLogoutMutation() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating } = useSWRMutation<LogoutResponse, ApiError>(
    "/api/auth/logout",
    (url: string) =>
      apiRequest<LogoutResponse>(url, {
        method: "POST",
      }),
    {
      throwOnError: true,
    },
  );

  const logout = async () => {
    try {
      await trigger();
    } finally {
      await mutate(AUTH_USER_KEY, null, { revalidate: false });
    }
  };

  return {
    logout,
    isMutating,
  };
}

export function useVerifyEmail(token?: string, email?: string) {
  const { data, error, isLoading } = useSWR<VerifyResponse, ApiError>(
    token && email ? ["/api/auth/verify", token, email] : null,
    ([url, verificationToken, verificationEmail]) =>
      apiRequest<VerifyResponse>(url, {
        method: "POST",
        body: JSON.stringify({
          token: verificationToken,
          email: verificationEmail,
        }),
      }),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );

  return {
    result: data,
    error,
    isLoading,
  };
}
