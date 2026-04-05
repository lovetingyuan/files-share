import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";

type LogEntry = {
  id: number;
  source: string;
  event: string;
  detail?: string;
  atMs: number;
};

type ProbeMode = "direct" | "click" | "showPicker" | "label";

type ProbeCardProps = {
  title: string;
  description: string;
  mode: ProbeMode;
  onLog: (source: string, event: string, detail?: string) => void;
};

type FileInputWithPicker = HTMLInputElement & {
  showPicker?: () => void;
};

function formatFileDetail(input: HTMLInputElement) {
  const files = Array.from(input.files ?? []);
  if (files.length === 0) {
    return "0 files";
  }

  return files.map((file) => `${file.name} (${file.size}B)`).join(", ");
}

function ProbeCard({ title, description, mode, onLog }: ProbeCardProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [supportsShowPicker, setSupportsShowPicker] = useState(false);

  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      inputRef.current = node;
      setSupportsShowPicker(Boolean(node && "showPicker" in node));

      if (!node) {
        return;
      }

      const handleClick = () => onLog(title, "input.click");
      const handleFocus = () => onLog(title, "input.focus");
      const handleBlur = () => onLog(title, "input.blur");
      const handleCancel = () => onLog(title, "input.cancel");
      const handleChange = () => onLog(title, "input.change", formatFileDetail(node));

      node.addEventListener("click", handleClick);
      node.addEventListener("focus", handleFocus);
      node.addEventListener("blur", handleBlur);
      node.addEventListener("cancel", handleCancel);
      node.addEventListener("change", handleChange);

      cleanupRef.current = () => {
        node.removeEventListener("click", handleClick);
        node.removeEventListener("focus", handleFocus);
        node.removeEventListener("blur", handleBlur);
        node.removeEventListener("cancel", handleCancel);
        node.removeEventListener("change", handleChange);
      };
    },
    [onLog, title],
  );

  const openViaClick = () => {
    onLog(title, "trigger.invoke", "input.click()");
    inputRef.current?.click();
  };

  const openViaShowPicker = () => {
    const input = inputRef.current as FileInputWithPicker | null;
    if (!input) {
      onLog(title, "trigger.error", "input not ready");
      return;
    }

    if (typeof input.showPicker !== "function") {
      onLog(title, "trigger.unsupported", "showPicker unavailable");
      return;
    }

    try {
      onLog(title, "trigger.invoke", "input.showPicker()");
      input.showPicker();
    } catch (error) {
      onLog(title, "trigger.error", error instanceof Error ? error.message : "showPicker failed");
    }
  };

  const inputClassName =
    mode === "direct" ? "file-input file-input-bordered w-full max-w-md" : "sr-only";

  return (
    <section className="card bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm leading-6 text-base-content/70">{description}</p>
          <p className="text-xs text-base-content/50">
            `showPicker` 支持: {supportsShowPicker ? "是" : "否"}
          </p>
        </div>

        <input ref={setInputRef} id={inputId} type="file" className={inputClassName} />

        {mode === "direct" && (
          <p className="text-xs text-base-content/60">
            直接使用原生可见的 `input[type=file]`，不经过额外按钮或脚本。
          </p>
        )}

        {mode === "click" && (
          <button type="button" className="btn btn-primary w-fit" onClick={openViaClick}>
            通过 `input.click()` 打开
          </button>
        )}

        {mode === "showPicker" && (
          <button type="button" className="btn btn-secondary w-fit" onClick={openViaShowPicker}>
            通过 `input.showPicker()` 打开
          </button>
        )}

        {mode === "label" && (
          <label
            htmlFor={inputId}
            className="btn btn-accent w-fit"
            onClick={() => onLog(title, "trigger.invoke", "<label htmlFor>")}
          >
            通过 `label` 打开
          </label>
        )}
      </div>
    </section>
  );
}

export function FilePickerDebug() {
  const startTimeRef = useRef(performance.now());
  const nextIdRef = useRef(1);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const appendLog = useCallback((source: string, event: string, detail?: string) => {
    const entry: LogEntry = {
      id: nextIdRef.current++,
      source,
      event,
      detail,
      atMs: performance.now() - startTimeRef.current,
    };

    setLogs((previous) => [entry, ...previous].slice(0, 200));
  }, []);

  useEffect(() => {
    const handleWindowFocus = () => appendLog("window", "focus");
    const handleWindowBlur = () => appendLog("window", "blur");
    const handleVisibility = () =>
      appendLog("document", "visibilitychange", document.visibilityState);

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [appendLog]);

  return (
    <main className="mx-auto flex w-[96%] max-w-300 flex-1 flex-col gap-6 py-6 md:w-[90%] md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">File Picker Debug</h1>
          <p className="max-w-3xl text-sm leading-6 text-base-content/70">
            这个页面只验证 `input[type=file]` 的原生打开与取消行为，不接入上传、toast、 tooltip、SWR
            或文件读取逻辑。
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setLogs([])}>
            清空日志
          </button>
          <Link to="/" className="btn btn-ghost btn-sm gap-2">
            <Icon icon="mdi:arrow-left" className="h-4 w-4" />
            返回首页
          </Link>
        </div>
      </div>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 text-sm text-base-content/70">
          <p>测试步骤：逐个打开文件选择器，然后先测取消，再测真实选中文件。</p>
          <p>对比维度：是否卡顿、卡顿持续时间、是否触发 `cancel`、焦点/可见性事件顺序。</p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ProbeCard
          title="Visible Input"
          description="直接点击可见 input，自带浏览器原生按钮。"
          mode="direct"
          onLog={appendLog}
        />
        <ProbeCard
          title="Programmatic click()"
          description="隐藏 input，由按钮在用户手势中调用 `input.click()`。"
          mode="click"
          onLog={appendLog}
        />
        <ProbeCard
          title="Programmatic showPicker()"
          description="隐藏 input，由按钮在用户手势中调用 `input.showPicker()`。"
          mode="showPicker"
          onLog={appendLog}
        />
        <ProbeCard
          title="Label htmlFor"
          description="隐藏 input，由原生 `label htmlFor` 触发，不走 JS 打开调用。"
          mode="label"
          onLog={appendLog}
        />
      </div>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Event Log</h2>
            <span className="text-xs text-base-content/50">最多保留最近 200 条</span>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th className="w-24">t(ms)</th>
                  <th className="w-48">source</th>
                  <th className="w-40">event</th>
                  <th>detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-base-content/60">
                      还没有事件。先尝试打开一个文件选择器。
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.atMs.toFixed(1)}</td>
                      <td>{log.source}</td>
                      <td>{log.event}</td>
                      <td className="break-all text-xs text-base-content/70">
                        {log.detail ?? "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
