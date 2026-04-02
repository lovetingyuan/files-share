export interface Profile {
  email: string;
  avatarUrl: string | null;
}

export interface ProfileResponse {
  success: true;
  profile: Profile;
}
