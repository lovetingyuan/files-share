import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '@iconify/react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  buildDownloadUrl,
  useCreateFolderMutation,
  useDeleteFileMutation,
  useDeleteFolderMutation,
  useFileListWithOptimistic,
  useUploadFileMutation,
} from '../hooks/useFilesApi'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const sizeFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = -1

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${sizeFormatter.format(value)} ${units[unitIndex]}`
}

function getDownloadFilename(contentDisposition: string | null, fallbackName: string): string {
  if (!contentDisposition) {
    return fallbackName
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return fallbackName
    }
  }

  const plainMatch = contentDisposition.match(/filename="([^"]+)"/i)
  return plainMatch?.[1] ?? fallbackName
}

const FILE_ICON_MAP: Record<string, { icon: string; color: string }> = {
  // Images
  jpg: { icon: 'mdi:file-image', color: 'text-purple-500' },
  jpeg: { icon: 'mdi:file-image', color: 'text-purple-500' },
  png: { icon: 'mdi:file-image', color: 'text-purple-500' },
  gif: { icon: 'mdi:file-image', color: 'text-purple-500' },
  bmp: { icon: 'mdi:file-image', color: 'text-purple-500' },
  svg: { icon: 'mdi:file-image', color: 'text-purple-500' },
  webp: { icon: 'mdi:file-image', color: 'text-purple-500' },
  ico: { icon: 'mdi:file-image', color: 'text-purple-500' },
  tiff: { icon: 'mdi:file-image', color: 'text-purple-500' },
  tif: { icon: 'mdi:file-image', color: 'text-purple-500' },
  avif: { icon: 'mdi:file-image', color: 'text-purple-500' },
  heic: { icon: 'mdi:file-image', color: 'text-purple-500' },
  heif: { icon: 'mdi:file-image', color: 'text-purple-500' },
  raw: { icon: 'mdi:file-image', color: 'text-purple-500' },
  psd: { icon: 'mdi:file-image', color: 'text-blue-400' },
  ai: { icon: 'mdi:file-image', color: 'text-orange-500' },
  // PDF
  pdf: { icon: 'mdi:file-pdf-box', color: 'text-red-500' },
  // Documents
  doc: { icon: 'mdi:file-word', color: 'text-blue-600' },
  docx: { icon: 'mdi:file-word', color: 'text-blue-600' },
  odt: { icon: 'mdi:file-word', color: 'text-blue-600' },
  rtf: { icon: 'mdi:file-word', color: 'text-blue-600' },
  // Spreadsheets
  xls: { icon: 'mdi:file-excel', color: 'text-green-600' },
  xlsx: { icon: 'mdi:file-excel', color: 'text-green-600' },
  csv: { icon: 'mdi:file-excel', color: 'text-green-600' },
  ods: { icon: 'mdi:file-excel', color: 'text-green-600' },
  tsv: { icon: 'mdi:file-excel', color: 'text-green-600' },
  // Presentations
  ppt: { icon: 'mdi:file-powerpoint', color: 'text-orange-600' },
  pptx: { icon: 'mdi:file-powerpoint', color: 'text-orange-600' },
  odp: { icon: 'mdi:file-powerpoint', color: 'text-orange-600' },
  key: { icon: 'mdi:file-powerpoint', color: 'text-orange-600' },
  // Video
  mp4: { icon: 'mdi:file-video', color: 'text-pink-500' },
  avi: { icon: 'mdi:file-video', color: 'text-pink-500' },
  mov: { icon: 'mdi:file-video', color: 'text-pink-500' },
  mkv: { icon: 'mdi:file-video', color: 'text-pink-500' },
  wmv: { icon: 'mdi:file-video', color: 'text-pink-500' },
  flv: { icon: 'mdi:file-video', color: 'text-pink-500' },
  webm: { icon: 'mdi:file-video', color: 'text-pink-500' },
  m4v: { icon: 'mdi:file-video', color: 'text-pink-500' },
  '3gp': { icon: 'mdi:file-video', color: 'text-pink-500' },
  // Audio
  mp3: { icon: 'mdi:file-music', color: 'text-teal-500' },
  wav: { icon: 'mdi:file-music', color: 'text-teal-500' },
  flac: { icon: 'mdi:file-music', color: 'text-teal-500' },
  aac: { icon: 'mdi:file-music', color: 'text-teal-500' },
  ogg: { icon: 'mdi:file-music', color: 'text-teal-500' },
  wma: { icon: 'mdi:file-music', color: 'text-teal-500' },
  m4a: { icon: 'mdi:file-music', color: 'text-teal-500' },
  opus: { icon: 'mdi:file-music', color: 'text-teal-500' },
  mid: { icon: 'mdi:file-music', color: 'text-teal-500' },
  midi: { icon: 'mdi:file-music', color: 'text-teal-500' },
  // Archives
  zip: { icon: 'mdi:folder-zip', color: 'text-yellow-600' },
  rar: { icon: 'mdi:folder-zip', color: 'text-yellow-600' },
  '7z': { icon: 'mdi:folder-zip', color: 'text-yellow-600' },
  tar: { icon: 'mdi:folder-zip', color: 'text-yellow-600' },
  gz: { icon: 'mdi:folder-zip', color: 'text-yellow-600' },
  bz2: { icon: 'mdi:folder-zip', color: 'text-yellow-600' },
  xz: { icon: 'mdi:folder-zip', color: 'text-yellow-600' },
  zst: { icon: 'mdi:folder-zip', color: 'text-yellow-600' },
  iso: { icon: 'mdi:disc', color: 'text-yellow-600' },
  dmg: { icon: 'mdi:disc', color: 'text-yellow-600' },
  // Code
  js: { icon: 'mdi:language-javascript', color: 'text-yellow-400' },
  mjs: { icon: 'mdi:language-javascript', color: 'text-yellow-400' },
  cjs: { icon: 'mdi:language-javascript', color: 'text-yellow-400' },
  ts: { icon: 'mdi:language-typescript', color: 'text-blue-500' },
  tsx: { icon: 'mdi:language-typescript', color: 'text-blue-500' },
  jsx: { icon: 'mdi:language-javascript', color: 'text-yellow-400' },
  py: { icon: 'mdi:language-python', color: 'text-blue-400' },
  java: { icon: 'mdi:language-java', color: 'text-red-400' },
  kt: { icon: 'mdi:language-kotlin', color: 'text-purple-400' },
  swift: { icon: 'mdi:language-swift', color: 'text-orange-500' },
  c: { icon: 'mdi:language-c', color: 'text-blue-500' },
  cpp: { icon: 'mdi:language-cpp', color: 'text-blue-600' },
  h: { icon: 'mdi:language-c', color: 'text-blue-500' },
  hpp: { icon: 'mdi:language-cpp', color: 'text-blue-600' },
  cs: { icon: 'mdi:language-csharp', color: 'text-green-500' },
  go: { icon: 'mdi:language-go', color: 'text-cyan-500' },
  rs: { icon: 'mdi:language-rust', color: 'text-orange-700' },
  rb: { icon: 'mdi:language-ruby', color: 'text-red-500' },
  php: { icon: 'mdi:language-php', color: 'text-indigo-400' },
  lua: { icon: 'mdi:language-lua', color: 'text-blue-600' },
  r: { icon: 'mdi:language-r', color: 'text-blue-400' },
  dart: { icon: 'mdi:code-braces', color: 'text-cyan-500' },
  scala: { icon: 'mdi:code-braces', color: 'text-red-500' },
  // Web
  html: { icon: 'mdi:language-html5', color: 'text-orange-500' },
  htm: { icon: 'mdi:language-html5', color: 'text-orange-500' },
  css: { icon: 'mdi:language-css3', color: 'text-blue-500' },
  scss: { icon: 'mdi:language-css3', color: 'text-pink-400' },
  sass: { icon: 'mdi:language-css3', color: 'text-pink-400' },
  less: { icon: 'mdi:language-css3', color: 'text-blue-400' },
  vue: { icon: 'mdi:vuejs', color: 'text-green-500' },
  // Data / Config
  json: { icon: 'mdi:code-json', color: 'text-yellow-500' },
  jsonc: { icon: 'mdi:code-json', color: 'text-yellow-500' },
  xml: { icon: 'mdi:file-xml-box', color: 'text-orange-400' },
  yaml: { icon: 'mdi:file-code', color: 'text-red-400' },
  yml: { icon: 'mdi:file-code', color: 'text-red-400' },
  toml: { icon: 'mdi:file-code', color: 'text-gray-500' },
  ini: { icon: 'mdi:file-cog', color: 'text-gray-500' },
  env: { icon: 'mdi:file-cog', color: 'text-yellow-600' },
  // Shell / Scripts
  sh: { icon: 'mdi:console', color: 'text-green-400' },
  bash: { icon: 'mdi:console', color: 'text-green-400' },
  zsh: { icon: 'mdi:console', color: 'text-green-400' },
  bat: { icon: 'mdi:console', color: 'text-gray-500' },
  cmd: { icon: 'mdi:console', color: 'text-gray-500' },
  ps1: { icon: 'mdi:powershell', color: 'text-blue-500' },
  // Text / Docs
  txt: { icon: 'mdi:file-document-outline', color: 'text-gray-500' },
  md: { icon: 'mdi:language-markdown', color: 'text-gray-600' },
  mdx: { icon: 'mdi:language-markdown', color: 'text-gray-600' },
  log: { icon: 'mdi:file-document-outline', color: 'text-gray-400' },
  // Database
  sql: { icon: 'mdi:database', color: 'text-blue-400' },
  db: { icon: 'mdi:database', color: 'text-blue-400' },
  sqlite: { icon: 'mdi:database', color: 'text-blue-400' },
  // Fonts
  ttf: { icon: 'mdi:format-font', color: 'text-gray-500' },
  otf: { icon: 'mdi:format-font', color: 'text-gray-500' },
  woff: { icon: 'mdi:format-font', color: 'text-gray-500' },
  woff2: { icon: 'mdi:format-font', color: 'text-gray-500' },
  eot: { icon: 'mdi:format-font', color: 'text-gray-500' },
  // Executables / Binaries
  exe: { icon: 'mdi:application-cog', color: 'text-gray-600' },
  msi: { icon: 'mdi:application-cog', color: 'text-gray-600' },
  deb: { icon: 'mdi:application-cog', color: 'text-gray-600' },
  rpm: { icon: 'mdi:application-cog', color: 'text-gray-600' },
  apk: { icon: 'mdi:android', color: 'text-green-500' },
  ipa: { icon: 'mdi:apple', color: 'text-gray-600' },
  // 3D / CAD
  obj: { icon: 'mdi:cube-outline', color: 'text-orange-400' },
  stl: { icon: 'mdi:cube-outline', color: 'text-orange-400' },
  fbx: { icon: 'mdi:cube-outline', color: 'text-orange-400' },
  gltf: { icon: 'mdi:cube-outline', color: 'text-orange-400' },
  glb: { icon: 'mdi:cube-outline', color: 'text-orange-400' },
  // Misc
  lock: { icon: 'mdi:file-lock', color: 'text-gray-500' },
  bak: { icon: 'mdi:file-restore', color: 'text-gray-400' },
  tmp: { icon: 'mdi:file-clock', color: 'text-gray-400' },
  torrent: { icon: 'mdi:magnet', color: 'text-green-500' },
}

const DEFAULT_FILE_ICON = { icon: 'mdi:file-outline', color: 'text-info' }

function getFileIcon(filename: string): { icon: string; color: string } {
  const ext =
    filename.lastIndexOf('.') !== -1
      ? filename.slice(filename.lastIndexOf('.') + 1).toLowerCase()
      : ''
  return FILE_ICON_MAP[ext] ?? DEFAULT_FILE_ICON
}

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/

function validateFolderName(name: string): string | null {
  if (!name) return 'Folder name cannot be empty'
  if (name.includes('/')) return 'Folder name cannot contain "/"'
  if (name.includes('\\')) return 'Folder name cannot contain "\\"'
  if (name === '.' || name === '..') return 'Folder name cannot be "." or ".."'
  if (name === '.fileshare-folder') return 'This is a reserved name'
  if (CONTROL_CHARACTER_PATTERN.test(name)) return 'Folder name contains invalid characters'
  return null
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const newFolderInputRef = useRef<HTMLInputElement | null>(null)
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false)
  const [newFolderDefaultName, setNewFolderDefaultName] = useState('')
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null)
  const currentPath = searchParams.get('path') ?? ''
  const {
    data,
    error,
    hasMore,
    isLoading,
    isRefreshing,
    loadMore,
    refresh,
    addOptimisticFolder,
    removeOptimisticFolder,
  } = useFileListWithOptimistic(currentPath)
  const { createFolder, isMutating: isCreatingFolder } = useCreateFolderMutation()
  const { uploadFile, isMutating: isUploadingFile } = useUploadFileMutation()
  const { deleteFile, isMutating: isDeletingFile } = useDeleteFileMutation()
  const { deleteFolder, isMutating: isDeletingFolder } = useDeleteFolderMutation()

  const busy =
    isCreatingFolder ||
    isUploadingFile ||
    isDeletingFile ||
    isDeletingFolder ||
    downloadingPath !== null
  const totalBytes = data.files.reduce((sum, file) => sum + file.size, 0)
  const breadcrumbs = currentPath ? currentPath.split('/') : []

  const setPath = (path: string) => {
    const nextSearchParams = new URLSearchParams()
    if (path) {
      nextSearchParams.set('path', path)
    }

    setSearchParams(nextSearchParams)
  }

  const handleLogout = async () => {
    await logout()
  }

  const getUniqueFolderName = (baseName: string): string => {
    const existingNames = new Set(data.folders.map(f => f.name))
    if (!existingNames.has(baseName)) return baseName
    let counter = 1
    while (existingNames.has(`${baseName} (${counter})`)) {
      counter++
    }
    return `${baseName} (${counter})`
  }

  const handleStartCreateFolder = () => {
    setNewFolderDefaultName(getUniqueFolderName('新建文件夹'))
    setIsCreatingNewFolder(true)
  }

  useEffect(() => {
    if (isCreatingNewFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus()
      newFolderInputRef.current.select()
    }
  }, [isCreatingNewFolder])

  const handleNewFolderBlur = async () => {
    const name = newFolderInputRef.current?.value.trim()
    setIsCreatingNewFolder(false)

    if (!name) return

    const validationError = validateFolderName(name)
    if (validationError) {
      toast.error(validationError)
      return
    }

    // Optimistic update: add folder immediately
    const optimisticPath = addOptimisticFolder(name)

    try {
      await createFolder(currentPath, name)
      // Refresh first so real data is available before removing optimistic folder
      await refresh()
      removeOptimisticFolder(optimisticPath)
      toast.success('Folder created')
    } catch (err) {
      // Rollback on error
      removeOptimisticFolder(optimisticPath)
      toast.error(err instanceof Error ? err.message : 'Failed to create folder')
    }
  }

  const handleNewFolderKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      newFolderInputRef.current?.blur()
    } else if (event.key === 'Escape') {
      setIsCreatingNewFolder(false)
    }
  }

  const handleUploadSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      await uploadFile(file, currentPath)
      await refresh()
      toast.success(`"${file.name}" uploaded`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload file')
    }
  }

  const handleDeleteFile = async (path: string, name: string) => {
    try {
      await deleteFile(path)
      await refresh()
      toast.success(`"${name}" deleted`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete file')
    }
  }

  const handleDeleteFolder = async (path: string, name: string) => {
    try {
      await deleteFolder(path)
      await refresh()
      toast.success(`Folder "${name}" deleted`, {
        className: 'toast',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete folder')
    }
  }

  const handleDownloadFile = async (path: string, fallbackName: string) => {
    try {
      setDownloadingPath(path)

      const response = await fetch(buildDownloadUrl(path), {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to download file')
      }

      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = getDownloadFilename(
        response.headers.get('Content-Disposition'),
        fallbackName,
      )
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download file')
    } finally {
      setDownloadingPath(null)
    }
  }

  return (
    <div className="min-h-screen bg-base-200">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleUploadSelection}
        disabled={busy}
      />

      <nav className="navbar bg-base-100 shadow-sm px-6">
        <div className="flex-1">
          <span className="flex items-center text-xl gap-2 cursor-pointer">
            <img src="/favicon.svg" alt="logo" className="w-6 h-6" />
            File Share
          </span>
        </div>
        <div className="flex-none gap-2">
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="flex w-10 items-center justify-center rounded-full bg-primary text-primary-content">
                <span className="text-lg font-bold">{user?.email?.charAt(0).toUpperCase()}</span>
              </div>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content z-[1] mt-3 w-60 rounded-box bg-base-100 p-2 shadow"
            >
              <li className="menu-title">
                <span>{user?.email}</span>
              </li>
              <li>
                <button type="button" onClick={handleLogout}>
                  <Icon icon="mdi:logout" className="w-4 h-4" />
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <main className="container mx-auto flex flex-col gap-4 p-4">
        <section className="card bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div className="flex flex-row items-center justify-between gap-3">
              <div className="breadcrumbs text-sm">
                <ul>
                  <li>
                    <button
                      type="button"
                      className="link link-hover inline-flex items-center gap-1"
                      onClick={() => setPath('')}
                    >
                      <Icon icon="mdi:home-outline" className="w-4 h-4" />
                      Home
                    </button>
                  </li>
                  {breadcrumbs.map((segment, index) => {
                    const path = breadcrumbs.slice(0, index + 1).join('/')
                    return (
                      <li key={path}>
                        <button
                          type="button"
                          className="link link-hover"
                          onClick={() => setPath(path)}
                        >
                          {segment}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs text-base-content/60 whitespace-nowrap">
                  {data.files.length} 个文件，共 {formatBytes(totalBytes)}
                </span>
                <div
                  className="tooltip"
                  data-tip={isUploadingFile ? 'Uploading...' : 'Upload File'}
                >
                  <button
                    type="button"
                    className={`btn btn-primary btn-square btn-sm ${isUploadingFile ? 'loading' : ''}`}
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {!isUploadingFile && <Icon icon="mdi:upload" className="w-5 h-5" />}
                  </button>
                </div>
                <div className="tooltip" data-tip={isCreatingFolder ? 'Creating...' : 'New Folder'}>
                  <button
                    type="button"
                    className={`btn btn-secondary btn-square btn-sm ${isCreatingFolder ? 'loading' : ''}`}
                    disabled={busy || isCreatingNewFolder}
                    onClick={handleStartCreateFolder}
                  >
                    {!isCreatingFolder && <Icon icon="mdi:folder-plus" className="w-5 h-5" />}
                  </button>
                </div>
                <div className="tooltip" data-tip="Refresh">
                  <button
                    type="button"
                    className={`btn btn-outline btn-square btn-sm ${isRefreshing ? 'loading' : ''}`}
                    disabled={busy}
                    onClick={() => refresh()}
                  >
                    {!isRefreshing && <Icon icon="mdi:refresh" className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-box border border-base-300 bg-base-200 p-6 text-center">
                <p className="mb-4 text-sm text-base-content/70">
                  The current folder could not be loaded.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm gap-2"
                  onClick={() => setPath('')}
                >
                  <Icon icon="mdi:home-outline" className="w-4 h-4" />
                  Go to Home
                </button>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="loading loading-spinner loading-lg text-primary"></span>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="table table-zebra table-fixed">
                    <thead className="bg-base-300">
                      <tr className="bg-base-200">
                        <th className="w-auto">Name</th>
                        <th className="w-28">Size</th>
                        <th className="w-46">Updated</th>
                        <th className="w-24 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isCreatingNewFolder && (
                        <tr>
                          <td>
                            <span className="inline-flex items-center gap-1">
                              <Icon icon="mdi:folder" className="w-5 h-5 text-warning" />
                              <input
                                ref={newFolderInputRef}
                                type="text"
                                className="input input-sm input-bordered w-48"
                                defaultValue={newFolderDefaultName}
                                onBlur={handleNewFolderBlur}
                                onKeyDown={handleNewFolderKeyDown}
                              />
                            </span>
                          </td>
                          <td className="text-base-content/50">-</td>
                          <td className="text-base-content/50">-</td>
                          <td className="text-right"></td>
                        </tr>
                      )}
                      {data.folders.map(folder => {
                        const isOptimistic = 'isOptimistic' in folder
                        return (
                          <tr
                            key={`folder:${folder.path}`}
                            className={isOptimistic ? 'opacity-60' : ''}
                          >
                            <td>
                              <span className="inline-flex items-center gap-2 align-middle">
                                <Icon
                                  icon={isOptimistic ? 'mdi:folder-sync' : 'mdi:folder'}
                                  className="w-5 h-5 text-warning"
                                />
                                {isOptimistic && (
                                  <span className="loading loading-spinner loading-xs"></span>
                                )}
                                <button
                                  type="button"
                                  className="font-medium link link-hover"
                                  onClick={() => setPath(folder.path)}
                                >
                                  {folder.name}
                                </button>
                              </span>
                            </td>
                            <td className="text-base-content/50">-</td>
                            <td className="text-base-content/50">-</td>
                            <td className="text-right">
                              {!isOptimistic && (
                                <div className="flex justify-end gap-2">
                                  <div className="dropdown dropdown-top dropdown-end">
                                    <button
                                      type="button"
                                      tabIndex={0}
                                      className={`btn btn-ghost btn-sm btn-square text-error ${isDeletingFolder ? 'loading' : ''}`}
                                      disabled={busy}
                                    >
                                      <Icon icon="mdi:delete-outline" className="w-4 h-4" />
                                    </button>
                                    <ul
                                      tabIndex={0}
                                      className="dropdown-content menu menu-sm bg-base-200 rounded-box z-10 w-40 p-2 shadow-sm"
                                    >
                                      <li>
                                        <button
                                          type="button"
                                          className="text-error"
                                          onClick={() => {
                                            ;(document.activeElement as HTMLElement)?.blur()
                                            handleDeleteFolder(folder.path, folder.name)
                                          }}
                                        >
                                          确认删除？
                                        </button>
                                      </li>
                                    </ul>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {data.files.map(file => {
                        const fileIcon = getFileIcon(file.name)
                        return (
                          <tr key={`file:${file.path}`}>
                            <td className="font-medium truncate">
                              <span className="inline-flex items-start gap-2 max-w-full align-middle">
                                <Icon
                                  icon={fileIcon.icon}
                                  className={`w-5 h-5 shrink-0 ${fileIcon.color}`}
                                />
                                <span className="truncate">{file.name}</span>
                              </span>
                            </td>
                            <td className="text-base-content/50" style={{ fontSize: 13 }}>
                              <span
                                className="tooltip"
                                data-tip={`${file.size.toLocaleString()} 字节`}
                              >
                                {formatBytes(file.size)}
                              </span>
                            </td>
                            <td
                              className="whitespace-nowrap text-base-content/50"
                              style={{ fontSize: 13 }}
                            >
                              {dateFormatter.format(new Date(file.uploadedAt))}
                            </td>
                            <td>
                              <div className="flex justify-end gap-2">
                                <div className="tooltip" data-tip="下载">
                                  <button
                                    type="button"
                                    className={`btn btn-ghost btn-sm btn-square ${downloadingPath === file.path ? 'loading' : ''}`}
                                    disabled={busy}
                                    onClick={() => handleDownloadFile(file.path, file.name)}
                                  >
                                    <Icon icon="mdi:download" className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="dropdown dropdown-top dropdown-end">
                                  <button
                                    type="button"
                                    tabIndex={0}
                                    className={`btn btn-ghost btn-sm btn-square text-error ${isDeletingFile ? 'loading' : ''}`}
                                    disabled={busy}
                                  >
                                    <Icon icon="mdi:delete-outline" className="w-4 h-4" />
                                  </button>
                                  <ul
                                    tabIndex={0}
                                    className="dropdown-content menu menu-sm bg-base-200 rounded-box z-10 w-40 p-2 shadow-sm"
                                  >
                                    <li>
                                      <button
                                        type="button"
                                        className="text-error"
                                        onClick={() => {
                                          ;(document.activeElement as HTMLElement)?.blur()
                                          handleDeleteFile(file.path, file.name)
                                        }}
                                      >
                                        确认删除？
                                      </button>
                                    </li>
                                  </ul>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {data.folders.length === 0 && data.files.length === 0 && (
                        <tr>
                          <td colSpan={4}>
                            <div className="flex flex-col items-center gap-2 py-15 text-base-content/60">
                              <Icon icon="mdi:folder-open-outline" className="w-12 h-12" />
                              This folder is empty.
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {hasMore && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className={`btn btn-outline ${isRefreshing ? 'loading' : ''}`}
                      onClick={() => loadMore()}
                      disabled={isRefreshing}
                    >
                      {isRefreshing ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
