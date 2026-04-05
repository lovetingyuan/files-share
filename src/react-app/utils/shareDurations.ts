import { SHARE_DURATION_OPTIONS, type ShareDurationOption } from "../../types";
import { formatDetailedDate } from "./fileFormatters";

const SHARE_DURATION_LABELS: Record<ShareDurationOption, string> = {
  600: "10 分钟",
  1800: "30 分钟",
  3600: "1 小时",
  7200: "2 小时",
  86400: "24 小时",
};

export const shareDurationOptions = SHARE_DURATION_OPTIONS.map((value) => ({
  value,
  label: SHARE_DURATION_LABELS[value],
}));

export function formatShareDuration(expiresInSeconds: ShareDurationOption): string {
  return SHARE_DURATION_LABELS[expiresInSeconds];
}

export function formatShareExpiry(dateInput: string): string {
  return formatDetailedDate(dateInput);
}
