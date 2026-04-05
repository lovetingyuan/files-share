import { Icon } from "@iconify/react";
import { useTheme } from "../hooks/useTheme";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const handleToggle = () => {
    const next: Record<string, "light" | "dark" | "system"> = {
      system: "light",
      light: "dark",
      dark: "system",
    };
    setTheme(next[theme]);
  };

  const icons = {
    light: "mdi:white-balance-sunny",
    dark: "mdi:moon-waning-crescent",
    system: "mdi:brightness-auto",
  };

  const labels = {
    light: "亮色",
    dark: "暗色",
    system: "系统",
  };

  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost btn-circle"
      onClick={handleToggle}
      aria-label={`当前主题: ${labels[theme]}`}
      title={`切换主题 (当前: ${labels[theme]})`}
    >
      <Icon icon={icons[theme]} className="w-5 h-5" />
    </button>
  );
}
