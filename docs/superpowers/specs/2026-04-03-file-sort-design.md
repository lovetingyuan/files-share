# File List Sort & Full-Load Design

**Date:** 2026-04-03

## Overview

Add a sort/order dropdown to the file list toolbar. Sorting applies to files only (folders always appear first, sorted alphabetically). The backend fetches all R2 pages internally and returns the full list in one response, eliminating client-side pagination.

## Backend (`src/worker/routes/files.ts`)

### Query Parameters

`GET /api/files` gains two new optional params:

| Param   | Values                           | Default      |
| ------- | -------------------------------- | ------------ |
| `sort`  | `name` \| `size` \| `uploadedAt` | `uploadedAt` |
| `order` | `asc` \| `desc`                  | `desc`       |

### Full-Load Logic

Replace the single `c.env.FILES_BUCKET.list(...)` call with a loop that follows cursors until `truncated` is false, accumulating all objects and delimited prefixes.

### Sorting

After collecting all file objects, sort by the chosen key:

- `name`: `localeCompare`
- `size`: numeric comparison
- `uploadedAt`: `Date` comparison

`order: desc` reverses the result. Folders are unaffected and keep their existing `localeCompare` sort.

### Response Shape

`FileListResponse` removes `truncated` and `cursor` (always fully loaded). The `truncated` field is dropped from the type.

## Frontend

### `src/types.ts`

Remove `truncated` and `cursor` from `FileListResponse`.

Add sort types:

```ts
export type SortKey = "name" | "size" | "uploadedAt";
export type SortOrder = "asc" | "desc";
```

### `src/react-app/hooks/useFilesApi.ts`

- `buildListUrl` gains `sort` and `order` params
- `useFileList(path, sort, order)` switches from `useSWRInfinite` to `useSWR`; SWR key becomes `[FILES_ENDPOINT, path, sort, order]`
- `useFileListWithOptimistic` removes `loadMore`, `setSize`, `hasMore`; accepts `sort` and `order` and forwards them to `useFileList`

### `src/react-app/components/FileToolbar.tsx`

Add `sort`, `order`, `onSortChange` props. Render a DaisyUI `<select>` to the right of the New Folder button with options:

| Label            | sort         | order  |
| ---------------- | ------------ | ------ |
| 上传时间（最新） | `uploadedAt` | `desc` |
| 上传时间（最旧） | `uploadedAt` | `asc`  |
| 文件名（A→Z）    | `name`       | `asc`  |
| 文件名（Z→A）    | `name`       | `desc` |
| 文件大小（最大） | `size`       | `desc` |
| 文件大小（最小） | `size`       | `asc`  |

The select value is a combined string `"${sort}:${order}"` for easy binding.

### `src/react-app/pages/Dashboard.tsx`

- Add `sort` and `order` state (defaults: `uploadedAt`, `desc`)
- Pass them to `useFileListWithOptimistic` and `FileToolbar`
- Remove `hasMore`, `loadMore`, and the "Load More" button
