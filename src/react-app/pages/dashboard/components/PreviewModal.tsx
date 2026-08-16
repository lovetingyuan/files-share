import { useEffect, useRef, useState } from 'react'
import MdiChevronLeft from '~icons/mdi/chevron-left'
import MdiChevronRight from '~icons/mdi/chevron-right'
import MdiInformationOutline from '~icons/mdi/information-outline'
import MdiPencil from '~icons/mdi/pencil'
import toast from 'react-hot-toast'
import { Dialog } from '../../../components/Dialog'
import {
  buildPreviewUrl,
  buildRenderedPreviewUrl,
  useUpdateFileMutation,
} from '../../../hooks/useFilesApi'
import { useAppStore } from '../../../store'
import { getPreviewInfo, getRenderedPreviewKind } from '../../../utils/previewInfo'
import { getFolderUnlockTokenForPath } from '../../../utils/folderUnlockTokens'
import { closeFilePreview, openFileDetails, openFilePreview } from '../actions'
import { downloadDashboardFile, runWithLargeFileUploadToast } from '../fileOperations'
import { useDashboardFileView } from '../hooks/useDashboardFileView'
import { getAdjacentPreviewFile, type PreviewNavigationDirection } from '../utils/previewNavigation'
import { RENDERED_MARKDOWN_MAX_BYTES } from '../../../../types'
import {
  getPreviewContentWrapperClassName,
  getPreviewModalBoxClassName,
} from '../../../components/previewModalLayout'
import { AudioPreview, ImagePreview, VideoPreview } from './preview/PreviewMedia'
import { PdfPreview } from './preview/PreviewPdf'
import { TextPreview } from './preview/PreviewText'
import { PreviewCopyTextButton } from './preview/PreviewCopyTextButton'
import { PreviewUnsupportedMessage } from './preview/PreviewUnsupportedMessage'
import { PREVIEW_SIZE_LIMITS } from './preview/previewLimits'

const COPY_FEEDBACK_RESET_DELAY_MS = 1800

function getPreviewSizeError(
  kind: 'audio' | 'image' | 'text' | 'unsupported' | 'video' | 'pdf',
  fileSize: number,
): string | null {
  if (kind === 'image' && fileSize > PREVIEW_SIZE_LIMITS.IMAGE) {
    return `图片文件过大，无法预览（超过 ${PREVIEW_SIZE_LIMITS.IMAGE / 1024 / 1024}MB）`
  }
  if (kind === 'video' && fileSize > PREVIEW_SIZE_LIMITS.VIDEO) {
    return `视频文件过大，无法预览（超过 ${PREVIEW_SIZE_LIMITS.VIDEO / 1024 / 1024}MB）`
  }
  if (kind === 'audio' && fileSize > PREVIEW_SIZE_LIMITS.AUDIO) {
    return `音频文件过大，无法预览（超过 ${PREVIEW_SIZE_LIMITS.AUDIO / 1024 / 1024}MB）`
  }
  return null
}

export function PreviewModal() {
  const { currentFile, folderUnlockTokens, previewing } = useAppStore()
  const { filteredFiles, refresh } = useDashboardFileView()
  const { updateFile } = useUpdateFileMutation()
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [forceTextPreview, setForceTextPreview] = useState(false)
  const [isCopyFeedbackVisible, setIsCopyFeedbackVisible] = useState(false)
  const [isTextWrapEnabled, setIsTextWrapEnabled] = useState(false)
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loadedTextState, setLoadedTextState] = useState<{ path: string; content: string } | null>(
    null,
  )

  const clearCopyFeedbackTimeout = () => {
    if (copyFeedbackTimeoutRef.current !== null) {
      clearTimeout(copyFeedbackTimeoutRef.current)
      copyFeedbackTimeoutRef.current = null
    }
  }

  useEffect(() => clearCopyFeedbackTimeout, [])

  const resetPreviewState = () => {
    clearCopyFeedbackTimeout()
    setIsEditing(false)
    setEditContent('')
    setForceTextPreview(false)
    setIsCopyFeedbackVisible(false)
    setIsTextWrapEnabled(false)
    setLoadedTextState(null)
  }

  const handleClose = () => {
    resetPreviewState()
    closeFilePreview()
  }

  const file = previewing ? currentFile : null
  const previewUrl = file
    ? buildPreviewUrl(file.path, getFolderUnlockTokenForPath(file.path), file.uploadedAt)
    : ''
  void folderUnlockTokens
  const info = file ? getPreviewInfo(file) : { kind: 'unsupported' as const }
  const effectiveInfo = forceTextPreview ? { kind: 'text' as const } : info
  const renderedPreviewKind = file ? getRenderedPreviewKind(file) : null

  if (!file) {
    return null
  }

  const canForceTextPreview = info.kind === 'unsupported' && file.size <= PREVIEW_SIZE_LIMITS.TEXT
  const canEditTextFile = effectiveInfo.kind === 'text'
  const canViewRendered =
    renderedPreviewKind !== null &&
    (renderedPreviewKind === 'html' || file.size <= RENDERED_MARKDOWN_MAX_BYTES)
  const renderedPreviewUrl =
    file && canViewRendered
      ? buildRenderedPreviewUrl(file.path, getFolderUnlockTokenForPath(file.path))
      : ''
  const loadedText =
    loadedTextState && loadedTextState.path === file.path ? loadedTextState.content : null
  const previousFile = getAdjacentPreviewFile(filteredFiles, file, 'previous')
  const nextPreviewFile = getAdjacentPreviewFile(filteredFiles, file, 'next')

  const handlePreviewNavigation = (direction: PreviewNavigationDirection) => {
    const targetFile = direction === 'previous' ? previousFile : nextPreviewFile
    if (!targetFile) {
      return
    }

    resetPreviewState()
    openFilePreview(targetFile)
  }

  const handleDataLoaded = (data: string) => {
    setLoadedTextState({ path: file.path, content: data })
  }

  const handleStartEdit = () => {
    clearCopyFeedbackTimeout()
    setIsCopyFeedbackVisible(false)
    setEditContent(loadedText ?? '')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent('')
  }

  const handleSave = async () => {
    const pathParts = file.path.split('/')
    const filename = pathParts.pop() || ''
    const parentPath = pathParts.join('/')
    const blob = new Blob([editContent], { type: 'text/plain;charset=utf-8' })
    const nextFile = new File([blob], filename, { type: 'text/plain;charset=utf-8' })

    try {
      await runWithLargeFileUploadToast(nextFile, async () => {
        await updateFile(nextFile, parentPath)
        await refresh()
      })
      toast.success(`"${filename}" updated`)
      handleClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update file')
    }
  }

  const handleCopyText = async () => {
    if (loadedText === null) {
      return
    }

    try {
      await navigator.clipboard.writeText(loadedText)
      setIsCopyFeedbackVisible(true)
      clearCopyFeedbackTimeout()
      copyFeedbackTimeoutRef.current = setTimeout(() => {
        setIsCopyFeedbackVisible(false)
        copyFeedbackTimeoutRef.current = null
      }, COPY_FEEDBACK_RESET_DELAY_MS)
    } catch (error) {
      clearCopyFeedbackTimeout()
      setIsCopyFeedbackVisible(false)
      toast.error(error instanceof Error ? error.message : '复制文本失败')
    }
  }

  const sizeError = getPreviewSizeError(effectiveInfo.kind, file.size)
  const canCopyText = effectiveInfo.kind === 'text' && !sizeError

  return (
    <Dialog
      isOpen
      title={<h3 className="truncate pr-4 font-bold text-base">{file.name}</h3>}
      onClose={handleClose}
      supportFullscreen={!isEditing && effectiveInfo.kind !== 'unsupported'}
      widthMode="content"
      boxClassName={getPreviewModalBoxClassName()}
      bodyClassName="flex-1 min-h-0 overflow-auto p-1"
      closeButtonAriaLabel="关闭文件预览弹窗"
      headerClassName="items-center"
      headerActions={({ isInteractionDisabled }) => (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => openFileDetails(file, { keepPreviewOpen: true })}
            disabled={isInteractionDisabled || isEditing}
            title="查看详情"
            aria-label="查看详情"
          >
            <MdiInformationOutline className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => handlePreviewNavigation('previous')}
            disabled={isInteractionDisabled || isEditing || !previousFile}
            title="上一个文件"
            aria-label="上一个文件"
          >
            <MdiChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => handlePreviewNavigation('next')}
            disabled={isInteractionDisabled || isEditing || !nextPreviewFile}
            title="下一个文件"
            aria-label="下一个文件"
          >
            <MdiChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
      footer={
        (canCopyText || canEditTextFile) && !sizeError
          ? ({ confirm, isConfirming }) =>
              isEditing ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={handleCancelEdit}
                    disabled={isConfirming}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => void confirm()}
                    disabled={isConfirming}
                  >
                    {isConfirming ? (
                      <span className="loading loading-spinner" aria-hidden="true" />
                    ) : null}
                    {isConfirming ? '保存中...' : '保存'}
                  </button>
                </>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm text-base-content/70">
                    <span>自动换行</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-sm"
                      checked={isTextWrapEnabled}
                      onChange={event => setIsTextWrapEnabled(event.target.checked)}
                      aria-label="自动换行展示"
                    />
                  </label>
                  <PreviewCopyTextButton
                    disabled={loadedText === null}
                    isCopied={isCopyFeedbackVisible}
                    onClick={() => void handleCopyText()}
                  />
                  {canViewRendered ? (
                    <a
                      className="btn btn-sm btn-ghost"
                      href={renderedPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      查看渲染
                    </a>
                  ) : null}
                  {canEditTextFile ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={handleStartEdit}
                    >
                      <MdiPencil className="w-4 h-4" />
                      编辑
                    </button>
                  ) : null}
                </>
              )
          : undefined
      }
      showCancelButton={false}
      showConfirmButton={false}
      onConfirm={isEditing ? handleSave : undefined}
    >
      {({ isConfirming, isFullscreen }) => {
        const previewContentWrapperClassName = getPreviewContentWrapperClassName(
          effectiveInfo.kind,
          isEditing,
          isFullscreen,
        )

        return (
          <>
            {sizeError ? (
              <PreviewUnsupportedMessage reason={sizeError} />
            ) : (
              <div className={previewContentWrapperClassName}>
                {effectiveInfo.kind === 'image' && (
                  <ImagePreview file={file} previewUrl={previewUrl} isFullscreen={isFullscreen} />
                )}
                {effectiveInfo.kind === 'video' && (
                  <VideoPreview previewUrl={previewUrl} isFullscreen={isFullscreen} />
                )}
                {effectiveInfo.kind === 'audio' && (
                  <AudioPreview previewUrl={previewUrl} isFullscreen={isFullscreen} />
                )}
                {effectiveInfo.kind === 'pdf' && (
                  <PdfPreview file={file} previewUrl={previewUrl} isFullscreen={isFullscreen} />
                )}
                {effectiveInfo.kind === 'text' && (
                  <TextPreview
                    file={file}
                    previewUrl={previewUrl}
                    isFullscreen={isFullscreen}
                    isEditing={isEditing && effectiveInfo.kind === 'text'}
                    editContent={editContent}
                    isBusy={isConfirming}
                    isTextWrapEnabled={isTextWrapEnabled}
                    onEditContentChange={setEditContent}
                    onDataLoaded={handleDataLoaded}
                  />
                )}
                {effectiveInfo.kind === 'unsupported' && (
                  <div className="flex flex-col items-center gap-4 py-12 text-center">
                    <p className="text-sm text-base-content/70">
                      此文件类型不支持预览，您可以
                      <button
                        type="button"
                        className="link link-primary mx-1"
                        onClick={() => void downloadDashboardFile(file.path, file.name)}
                      >
                        下载
                      </button>
                      后查看
                    </p>
                    {canForceTextPreview ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => setForceTextPreview(true)}
                      >
                        按文本打开
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </>
        )
      }}
    </Dialog>
  )
}
