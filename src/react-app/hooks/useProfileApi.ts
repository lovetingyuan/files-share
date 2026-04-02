import useSWR from "swr";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { FileMutationResponse } from "../../shared/file-manager";
import type { ProfileResponse } from "../../shared/profile";
import { ApiError, apiRequest } from "../lib/api";

const PROFILE_KEY = "/api/profile";
const AVATAR_ENDPOINT = "/api/profile/avatar";

async function fetchProfile() {
  const data = await apiRequest<ProfileResponse>(PROFILE_KEY);
  return data.profile;
}

export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR(PROFILE_KEY, fetchProfile);

  return {
    profile: data ?? null,
    error,
    isLoading,
    mutate,
  };
}

export function useUploadAvatar() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating } = useSWRMutation<FileMutationResponse, ApiError, string, Blob>(
    AVATAR_ENDPOINT,
    (url, { arg }) =>
      apiRequest<FileMutationResponse>(url, {
        method: "PUT",
        headers: {
          "Content-Type": "image/png",
        },
        body: arg,
      }),
    {
      throwOnError: true,
    },
  );

  const uploadAvatar = async (avatar: Blob) => {
    const response = await trigger(avatar);
    await mutate(PROFILE_KEY);
    return response;
  };

  return {
    uploadAvatar,
    isMutating,
  };
}
