import type { AuthVariables } from "./middleware/auth";

export type AppBindings = Env & {
  APP_URL?: string;
  ENVIRONMENT?: string;
  MAX_UPLOAD_BYTES?: string;
  RESEND_API_KEY?: string;
  SENDER_EMAIL?: string;
};

export type AppContext = {
  Bindings: AppBindings;
  Variables: AuthVariables;
};
