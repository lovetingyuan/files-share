import { useRef } from 'react'
import { Icon } from '@iconify/react'
import { formatBytes } from '../utils/fileFormatters'

interface FileToolbarProps {
  currentPath: string
  breadcrumbs: string[]
  fileCount: number
  totalBytes: number
  busy: boolean
  isUploadingFile: boolean
  isCreatingFolder: boolean
  isRefreshing: boolean
  isCreatingNewFolder: boolean
  searchQuery: string
  onSetPath: (path: string) => void
  onUploadClick: () => void
  onCreateFolder: () => void
  onCreateTextFile: () => void
  onRefresh: () => void
  onSearchChange: (q: string) => void
}

export function FileToolbar({
  breadcrumbs,
  fileCount,
  totalBytes,
  busy,
  isUploadingFile,
  isCreatingFolder,
  isRefreshing,
  isCreatingNewFolder,
  searchQuery,
  onSetPath,
  onUploadClick,
  onCreateFolder,
  onCreateTextFile,
  onRefresh,
  onSearchChange,
}: FileToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isSearchExpanded = searchQuery.length > 0
  const focusSearchInput = () => {
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="max-w-full shrink-0 overflow-x-auto breadcrumbs text-sm">
        <ul>
          <li>
            <button
              type="button"
              className="link link-hover inline-flex items-center gap-1"
              onClick={() => onSetPath('')}
            >
              <Icon icon="mdi:home-outline" className="w-4 h-4" />
              Home
            </button>
          </li>
          {breadcrumbs.map((segment, index) => {
            const path = breadcrumbs.slice(0, index + 1).join('/')
            return (
              <li key={path}>
                <button type="button" className="link link-hover" onClick={() => onSetPath(path)}>
                  {segment}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
        <span className="text-xs text-base-content/60 whitespace-nowrap">
          {fileCount} 个文件，共 {formatBytes(totalBytes)}
        </span>
        <div className="tooltip" data-tip={isUploadingFile ? 'Uploading...' : 'Upload File'}>
          <button
            type="button"
            className={`btn btn-primary btn-square btn-sm ${isUploadingFile ? 'loading' : ''}`}
            disabled={busy}
            onClick={onUploadClick}
          >
            {!isUploadingFile && <Icon icon="mdi:upload" className="w-5 h-5" />}
          </button>
        </div>
        <div className="tooltip" data-tip="New Text File">
          <button
            type="button"
            className="btn btn-accent btn-square btn-sm"
            disabled={busy}
            onClick={onCreateTextFile}
          >
            <Icon icon="mdi:file-plus" className="w-5 h-5" />
          </button>
        </div>
        <div className="tooltip" data-tip={isCreatingFolder ? 'Creating...' : 'New Folder'}>
          <button
            type="button"
            className={`btn btn-secondary btn-square btn-sm ${isCreatingFolder ? 'loading' : ''}`}
            disabled={busy || isCreatingNewFolder}
            onClick={onCreateFolder}
          >
            {!isCreatingFolder && <Icon icon="mdi:folder-plus" className="w-5 h-5" />}
          </button>
        </div>
        <div
          className={`group/search relative h-8 shrink-0 transition-[width] duration-200 ease-in-out focus-within:w-40 ${
            isSearchExpanded ? 'w-40' : 'w-8'
          }`}
        >
          <div className="absolute inset-0 overflow-hidden rounded-field">
            <input
              ref={searchInputRef}
              type="text"
              className={`input input-sm input-bordered absolute top-0 right-0 h-8 w-40 min-w-0 transition-opacity duration-150 ease-in-out group-focus-within/search:border-base-300 group-focus-within/search:bg-base-100 group-focus-within/search:opacity-100 group-focus-within/search:outline-none ${
                isSearchExpanded
                  ? 'border-base-300 bg-base-100 pr-9 opacity-100'
                  : 'border-transparent bg-transparent pr-9 opacity-0'
              }`}
              placeholder="搜索文件名..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  onSearchChange('')
                  e.currentTarget.blur()
                }
              }}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-field transition-shadow duration-150 ease-in-out group-focus-within/search:ring-2 group-focus-within/search:ring-base-content/15" />
          <div className="tooltip absolute inset-y-0 right-0 z-10" data-tip="Search">
            <button
              type="button"
              className={`btn btn-ghost btn-square btn-sm h-8 w-8 transition-opacity duration-150 ease-in-out group-focus-within/search:pointer-events-none group-focus-within/search:opacity-0 ${
                isSearchExpanded ? 'pointer-events-none opacity-0' : ''
              }`}
              onMouseDown={e => e.preventDefault()}
              onClick={focusSearchInput}
            >
              <Icon icon="mdi:magnify" className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="tooltip" data-tip="Refresh">
          <button
            type="button"
            className={`btn btn-ghost btn-square btn-sm ${isRefreshing ? 'loading' : ''}`}
            disabled={busy}
            onClick={onRefresh}
          >
            {!isRefreshing && <Icon icon="mdi:refresh" className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
