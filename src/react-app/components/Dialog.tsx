import MdiClose from "~icons/mdi/close";
import MdiFullscreen from "~icons/mdi/fullscreen";
import MdiFullscreenExit from "~icons/mdi/fullscreen-exit";
import { type ReactNode, useId, useState } from "react";
import { useNativeDialog } from "../hooks/useNativeDialog";
import { cn } from "../utils/cn";
import { getDialogClosedBy } from "./dialogDismissal";
import { getDialogBoxClassName, type DialogWidthMode } from "./previewModalLayout";

type DialogAction = () => void | Promise<void>;

interface DialogRenderState {
  isConfirming: boolean;
  isFullscreen: boolean;
  isInteractionDisabled: boolean;
  requestClose: () => void;
  cancel: () => void;
  confirm: () => Promise<void>;
}

type DialogSlot = ReactNode | ((state: DialogRenderState) => ReactNode);

interface DialogProps {
  isOpen: boolean;
  title?: ReactNode;
  children: DialogSlot;
  footer?: DialogSlot;
  headerActions?: DialogSlot;
  onClose: () => void;
  onCancel?: () => void;
  onConfirm?: DialogAction;
  onAfterOpen?: () => void;
  cancelText?: string;
  confirmText?: string;
  confirmPendingText?: string;
  confirmLoadingText?: string;
  showCancelButton?: boolean;
  showConfirmButton?: boolean;
  showCloseButton?: boolean;
  isDismissDisabled?: boolean;
  cancelDisabled?: boolean;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  supportFullscreen?: boolean;
  widthMode?: DialogWidthMode;
  dialogClassName?: string;
  boxClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  titleClassName?: string;
  closeButtonAriaLabel?: string;
  closeButtonClassName?: string;
  cancelButtonClassName?: string;
  confirmButtonClassName?: string;
}

function DialogSlotRenderer({
  slot,
  state,
}: {
  slot: DialogSlot | undefined;
  state: DialogRenderState;
}) {
  if (typeof slot === "function") {
    return <>{slot(state)}</>;
  }

  return <>{slot ?? null}</>;
}

export function Dialog(props: DialogProps) {
  if (!props.isOpen) {
    return null;
  }

  return <OpenDialog {...props} />;
}

function OpenDialog({
  isOpen,
  title,
  children,
  footer,
  headerActions,
  onClose,
  onCancel,
  onConfirm,
  onAfterOpen,
  cancelText = "取消",
  confirmText = "确定",
  confirmPendingText,
  confirmLoadingText,
  showCancelButton = true,
  showConfirmButton = true,
  showCloseButton = true,
  isDismissDisabled = false,
  cancelDisabled = false,
  confirmDisabled = false,
  confirmLoading = false,
  supportFullscreen = false,
  widthMode = "default",
  dialogClassName = "",
  boxClassName = "",
  bodyClassName = "",
  headerClassName = "",
  footerClassName = "",
  titleClassName = "",
  closeButtonAriaLabel = "关闭弹窗",
  closeButtonClassName = "",
  cancelButtonClassName = "",
  confirmButtonClassName = "",
}: DialogProps) {
  const generatedTitleId = useId();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isActiveFullscreen = supportFullscreen && isFullscreen;
  const isInteractionDisabled = isDismissDisabled || isConfirming;

  const requestClose = () => {
    if (isInteractionDisabled) {
      return;
    }
    onClose();
  };

  const cancel = () => {
    if (isInteractionDisabled || cancelDisabled) {
      return;
    }
    onCancel?.();
    onClose();
  };

  const confirm = async () => {
    if (!onConfirm || isConfirming || confirmDisabled || confirmLoading) {
      return;
    }

    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const dialogRef = useNativeDialog({
    isOpen,
    isDismissDisabled: isInteractionDisabled,
    onCancel: requestClose,
    onAfterOpen,
  });

  const renderState: DialogRenderState = {
    isConfirming,
    isFullscreen: isActiveFullscreen,
    isInteractionDisabled,
    requestClose,
    cancel,
    confirm,
  };

  const shouldRenderFooter =
    footer !== undefined || showCancelButton || (showConfirmButton && Boolean(onConfirm));
  const confirmLabel = isConfirming
    ? (confirmPendingText ?? confirmText)
    : confirmLoading
      ? (confirmLoadingText ?? confirmText)
      : confirmText;
  const isConfirmLoading = confirmLoading || isConfirming;
  const titleId = title ? generatedTitleId : undefined;

  return (
    <dialog
      ref={dialogRef}
      closedby={getDialogClosedBy(isInteractionDisabled)}
      className={cn("modal", dialogClassName)}
      tabIndex={0}
      aria-labelledby={titleId}
    >
      <div className={getDialogBoxClassName(widthMode, boxClassName, isActiveFullscreen)}>
        {(title || supportFullscreen || showCloseButton || headerActions !== undefined) && (
          <div className={cn("mb-4 flex items-center justify-between gap-4", headerClassName)}>
            <div className="min-w-0 flex-1">
              {typeof title === "string" ? (
                <h3 id={titleId} className={cn("font-bold text-base", titleClassName)}>
                  {title}
                </h3>
              ) : title ? (
                <div id={titleId}>{title}</div>
              ) : (
                null
              )}
            </div>
            <div className="flex items-center gap-2">
              {headerActions !== undefined ? (
                <DialogSlotRenderer slot={headerActions} state={renderState} />
              ) : null}
              {supportFullscreen && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square"
                  onClick={() => setIsFullscreen((value) => !value)}
                  disabled={isInteractionDisabled}
                  title={isActiveFullscreen ? "退出全屏" : "全屏"}
                  aria-label={isActiveFullscreen ? "退出全屏" : "全屏"}
                >
                  {isActiveFullscreen ? (
                    <MdiFullscreenExit className="h-5 w-5" />
                  ) : (
                    <MdiFullscreen className="h-5 w-5" />
                  )}
                </button>
              )}
              {showCloseButton && (
                <button
                  type="button"
                  className={cn("btn btn-ghost btn-sm btn-square", closeButtonClassName)}
                  onClick={requestClose}
                  disabled={isInteractionDisabled}
                  aria-label={closeButtonAriaLabel}
                >
                  <MdiClose className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className={bodyClassName}>
          <DialogSlotRenderer slot={children} state={renderState} />
        </div>

        {shouldRenderFooter && (
          <div className={cn("modal-action", footerClassName)}>
            {footer !== undefined ? (
              <DialogSlotRenderer slot={footer} state={renderState} />
            ) : (
              <>
                {showCancelButton && (
                  <button
                    type="button"
                    className={cn(cancelButtonClassName || "btn btn-sm btn-ghost")}
                    onClick={cancel}
                    disabled={isInteractionDisabled || cancelDisabled}
                  >
                    {cancelText}
                  </button>
                )}
                {showConfirmButton && onConfirm && (
                  <button
                    type="button"
                    className={cn(
                      confirmButtonClassName || "btn btn-sm btn-primary",
                      "disabled:text-base-content/20",
                    )}
                    onClick={() => void confirm()}
                    disabled={isConfirming || confirmLoading || confirmDisabled}
                  >
                    {isConfirmLoading ? (
                      <span className="loading loading-spinner" aria-hidden="true" />
                    ) : null}
                    {confirmLabel}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" onClick={requestClose} disabled={isInteractionDisabled}>
          close
        </button>
      </form>
    </dialog>
  );
}
