import { Hono } from "hono";
import type { AppContext } from "../context";
import {
  downloadFile,
  deleteFile,
  headDownloadFile,
  previewFile,
  renderPreviewFile,
  renameFile,
  uploadFile,
} from "./fileObjectHandlers";
import { getDirectoryStats, getUploadLimits, listFiles } from "./fileListHandlers";
import { createArchiveDownloadTicket, downloadArchive } from "./fileArchiveHandlers";
import { listFolderTree, moveEntry } from "./fileMoveHandlers";
import { batchDeleteEntries, batchMoveEntries } from "./fileBatchHandlers";
import {
  checkFolderPasswordSetAllowed,
  createFolder,
  deleteFolder,
  removeFolderAccessPassword,
  renameFolder,
  sendFolderPasswordRecoveryCode,
  setFolderAccessPassword,
  verifyFolderPasswordRecoveryCode,
  verifyFolderAccessPassword,
} from "./folderHandlers";
import {
  batchDeleteJsonValidator,
  batchMoveJsonValidator,
  createArchiveDownloadJsonValidator,
  createFolderJsonValidator,
  fileListQueryValidator,
  moveJsonValidator,
  optionalPathQueryValidator,
  pathQueryValidator,
  removeFolderPasswordJsonValidator,
  renameJsonValidator,
  sendFolderPasswordRecoveryCodeJsonValidator,
  setFolderPasswordJsonValidator,
  uploadObjectQueryValidator,
  verifyFolderPasswordRecoveryCodeJsonValidator,
  verifyFolderPasswordJsonValidator,
} from "../validation";

const files = new Hono<AppContext>();

files.get("/api/files/upload-limits", getUploadLimits);
files.get("/api/files", fileListQueryValidator, listFiles);
files.get("/api/files/stats", optionalPathQueryValidator, getDirectoryStats);
files.get("/api/files/folders/tree", listFolderTree);
files.post(
  "/api/files/archive-downloads",
  createArchiveDownloadJsonValidator,
  createArchiveDownloadTicket,
);
files.get("/api/files/archive-downloads/:ticket", downloadArchive);
files.patch("/api/files/entries", moveJsonValidator, moveEntry);
files.delete("/api/files/entries", batchDeleteJsonValidator, batchDeleteEntries);
files.patch("/api/files/entries/batch", batchMoveJsonValidator, batchMoveEntries);
files.post("/api/files/folders", createFolderJsonValidator, createFolder);
files.get("/api/files/folders/password-policy", pathQueryValidator, checkFolderPasswordSetAllowed);
files.put("/api/files/folders/password", setFolderPasswordJsonValidator, setFolderAccessPassword);
files.post(
  "/api/files/folders/unlocks",
  verifyFolderPasswordJsonValidator,
  verifyFolderAccessPassword,
);
files.delete(
  "/api/files/folders/password",
  removeFolderPasswordJsonValidator,
  removeFolderAccessPassword,
);
files.post(
  "/api/files/folders/password/forgot",
  sendFolderPasswordRecoveryCodeJsonValidator,
  sendFolderPasswordRecoveryCode,
);
files.post(
  "/api/files/folders/password/forgot/verify",
  verifyFolderPasswordRecoveryCodeJsonValidator,
  verifyFolderPasswordRecoveryCode,
);
files.delete("/api/files/folders", pathQueryValidator, deleteFolder);
files.patch("/api/files/folders", renameJsonValidator, renameFolder);
files.put("/api/files/object", uploadObjectQueryValidator, uploadFile);
files.patch("/api/files/object", renameJsonValidator, renameFile);
files.on("HEAD", "/api/files/object", pathQueryValidator, headDownloadFile);
files.get("/api/files/object", pathQueryValidator, downloadFile);
files.get("/api/files/preview", pathQueryValidator, previewFile);
files.get("/api/files/preview/rendered", pathQueryValidator, renderPreviewFile);
files.delete("/api/files/object", pathQueryValidator, deleteFile);

export default files;
