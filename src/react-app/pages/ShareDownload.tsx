import { useState } from 'react'
import toast from 'react-hot-toast'
import useSWR from 'swr'
import { useParams } from 'react-router-dom'
import type { SharedFileMetadataResponse } from '../../types'
import { ApiError, apiRequest } from '../utils/apiRequest'
import { getDownloadFilename } from '../utils/fileFormatters'
import { formatShareDuration } from '../utils/shareDurations'

function buildSharedFileMetadataUrl(token: string): string {
  return `/api/share-links/${encodeURIComponent(token)}`
}

type SharePageStatus = 'active' | 'expired' | 'missing' | 'invalid' | 'error'

function getSharePageStatus(
  data: SharedFileMetadataResponse | undefined,
  error: ApiError | undefined,
): SharePageStatus {
  if (error?.status === 403) {
    return 'invalid'
  }

  if (error) {
    return 'error'
  }

  return data?.status ?? 'active'
}

function getUnavailableReason(status: SharePageStatus, error?: ApiError): string {
  if (status === 'expired') {
    return '链接已过期'
  }

  if (status === 'missing') {
    return '文件不存在或已不可用'
  }

  if (status === 'invalid') {
    return '分享链接无效'
  }

  if (status === 'active') {
    return '文件暂时不可下载'
  }

  return error?.message ?? '暂时无法读取文件信息'
}

export function ShareDownload() {
  const { token } = useParams<{ token: string }>()
  const [isDownloading, setIsDownloading] = useState(false)
  const { data, error, isLoading } = useSWR<SharedFileMetadataResponse, ApiError>(
    token ? buildSharedFileMetadataUrl(token) : null,
    (url: string) => apiRequest<SharedFileMetadataResponse>(url, { credentials: 'same-origin' }),
  )

  const status = getSharePageStatus(data, error)
  const fileName = data?.fileName ?? '未知文件'

  const handleDownload = async () => {
    if (!data?.downloadUrl || isDownloading) return

    try {
      setIsDownloading(true)
      const response = await fetch(data.downloadUrl, { credentials: 'same-origin' })
      if (!response.ok) {
        throw new Error(
          response.status === 410
            ? '链接已过期，不再提供下载'
            : response.status === 404
              ? '文件不存在或已不可用'
              : 'Failed to download file',
        )
      }

      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = getDownloadFilename(response.headers.get('Content-Disposition'), fileName)
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(downloadUrl)
    } catch (downloadError) {
      toast.error(
        downloadError instanceof Error ? downloadError.message : 'Failed to download file',
      )
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <main className="mx-auto flex w-[94%] max-w-2xl flex-1 items-center py-10 sm:py-16">
      <section className="w-full rounded-[1.75rem] border border-base-300 bg-base-100 px-6 py-8 shadow-lg sm:px-8 sm:py-10">
        <div className="flex flex-col gap-6">
          <h1 className="text-lg font-semibold text-base-content sm:text-xl">
            {status === 'active' ? '文件下载' : '文件无法下载'}
          </h1>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : status === 'active' && data?.downloadUrl ? (
            <>
              <div className="space-y-2 text-base-content">
                <p className="text-sm text-base-content/70">文件名</p>
                <p className="break-all text-lg">{fileName}</p>
                <p className="text-sm text-right italic text-base-content/70">
                  {formatShareDuration(data.expiresInSeconds)} 后过期
                </p>
              </div>

              <button
                type="button"
                className={`btn btn-primary w-full sm:w-auto ${isDownloading ? 'loading' : ''}`}
                onClick={handleDownload}
                disabled={isDownloading}
              >
                下载文件
              </button>
            </>
          ) : (
            <div className="space-y-2 text-base-content">
              <p className="text-sm text-base-content/70">文件名</p>
              <p className="break-all text-lg">{fileName}</p>
              <p className="text-sm text-base-content/70">{getUnavailableReason(status, error)}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
