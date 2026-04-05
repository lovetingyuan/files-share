import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import QRCodeImport from 'react-qr-code'
import { Icon } from '@iconify/react'
import toast from 'react-hot-toast'
import type { FileEntry, ShareLinkResponse, ShareDurationOption } from '../../types'
import { useCreateShareLinkMutation } from '../hooks/useFilesApi'
import { formatShareDuration, shareDurationOptions } from '../utils/shareDurations'

interface ShareFileModalProps {
  file: FileEntry | null
  onClose: () => void
}

type QRCodeComponentProps = {
  value: string
  size?: number
  className?: string
  bgColor?: string
  fgColor?: string
  style?: CSSProperties
}

const DEFAULT_SHARE_DURATION: ShareDurationOption = 3600
const QRCode = ((QRCodeImport as unknown as { QRCode?: unknown; default?: unknown }).QRCode ??
  (QRCodeImport as unknown as { default?: unknown }).default ??
  QRCodeImport) as ComponentType<QRCodeComponentProps>

async function copyToClipboard(value: string): Promise<void> {
  await navigator.clipboard.writeText(value)
}

export function ShareFileModal({ file, onClose }: ShareFileModalProps) {
  const [expiresInSeconds, setExpiresInSeconds] =
    useState<ShareDurationOption>(DEFAULT_SHARE_DURATION)
  const [shareLink, setShareLink] = useState<ShareLinkResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const { createShareLink, isMutating } = useCreateShareLinkMutation()

  useEffect(() => {
    if (!file) return

    const currentRequestId = requestIdRef.current + 1
    requestIdRef.current = currentRequestId
    setLoadError(null)
    setShareLink(null)

    void createShareLink(file.path, expiresInSeconds)
      .then(response => {
        if (requestIdRef.current !== currentRequestId) return
        setShareLink(response)
      })
      .catch(error => {
        if (requestIdRef.current !== currentRequestId) return
        setLoadError(error instanceof Error ? error.message : 'Failed to generate share link')
      })
  }, [createShareLink, expiresInSeconds, file])

  if (!file) return null

  const isLoading = isMutating || shareLink === null
  const shareDurationLabel = formatShareDuration(expiresInSeconds)

  const handleCopyLink = async () => {
    if (!shareLink) return

    try {
      await copyToClipboard(shareLink.shareUrl)
      toast.success('下载链接已复制')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to copy share link')
    }
  }

  const handleShare = async () => {
    if (!shareLink) return

    const shareText = `文件名：${shareLink.fileName}\n有效期：${shareDurationLabel}\n下载链接：${shareLink.shareUrl}`

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: shareLink.fileName,
          text: shareText,
          url: shareLink.shareUrl,
        })
        return
      }

      await copyToClipboard(shareLink.shareUrl)
      toast.success('浏览器不支持系统分享，已复制下载链接')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      if (typeof navigator.share !== 'function') {
        toast.error(error instanceof Error ? error.message : 'Failed to copy share link')
        return
      }

      toast.error(error instanceof Error ? error.message : 'Failed to share file')
    }
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg bg-base-100 px-5 py-4 shadow-xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-base-content">文件分享</h3>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              onClick={onClose}
              aria-label="关闭分享弹窗"
            >
              <Icon icon="mdi:close" className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_11rem] sm:items-start">
            <div className="min-w-0 space-y-2">
              <div className="flex h-5 items-end text-xs text-base-content/50">文件名</div>
              <div className="truncate text-[15px] font-mono font-medium tracking-tight text-base-content">
                {file.name}
              </div>
            </div>

            <label className="form-control gap-1">
              <span className="flex h-5 items-end text-xs mb-1 text-base-content/50">有效时长</span>
              <select
                className="select select-sm w-full"
                value={String(expiresInSeconds)}
                onChange={event =>
                  setExpiresInSeconds(Number(event.target.value) as ShareDurationOption)
                }
              >
                {shareDurationOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-base-content/50">下载链接</div>
            {loadError ? (
              <div className="text-sm text-error">{loadError}</div>
            ) : shareLink ? (
              <div className="flex items-center gap-2">
                <a
                  href={shareLink.shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={shareLink.shareUrl}
                  className="link min-w-0 flex-1 truncate font-mono text-xs text-primary"
                >
                  {shareLink.shareUrl}
                </a>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs shrink-0"
                  onClick={handleCopyLink}
                >
                  复制
                </button>
              </div>
            ) : (
              <div className="text-sm text-base-content/50">正在生成链接...</div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-base-content/50">二维码</div>
            <div className="flex justify-center">
              <div className="inline-flex bg-white p-2">
                {shareLink ? (
                  <QRCode
                    value={shareLink.shareUrl}
                    size={180}
                    className="h-45 w-45"
                    bgColor="#ffffff"
                    fgColor="#111827"
                    style={{ shapeRendering: 'crispEdges' }}
                  />
                ) : (
                  <div className="flex h-36 w-36 items-center justify-center text-base-content/45">
                    <span className="loading loading-spinner loading-md" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className={`btn btn-primary btn-sm ${isLoading ? 'loading' : ''}`}
              disabled={isLoading || Boolean(loadError) || !shareLink}
              onClick={handleShare}
            >
              {isLoading ? '生成中' : '分享'}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  )
}
