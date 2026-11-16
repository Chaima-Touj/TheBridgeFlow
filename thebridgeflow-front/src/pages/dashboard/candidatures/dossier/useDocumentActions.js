import { useCallback, useEffect, useRef, useState } from "react";
import { candidatesService } from "../../../../services/candidates.service.js";
import { downloadBlob, isNetworkError, readBlobError } from "../candidatesUtils.js";

/* Consultation / téléchargement des documents d'un dossier. Les fichiers sont
   récupérés via l'API authentifiée (Blob) : jamais d'URL publique devinable. */
export function useDocumentActions(studentId, { onError } = {}) {
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(null);
  const urlRef = useRef("");

  const revoke = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
  };

  useEffect(() => () => revoke(), []);

  const fail = useCallback(async (error) => {
    if (isNetworkError(error)) { onError?.("network"); return; }
    const { message, code } = await readBlobError(error);
    onError?.(code === "DOCUMENT_UNAVAILABLE" ? "unavailable" : "generic", message);
  }, [onError]);

  const openPreview = useCallback(async (doc) => {
    if (!doc?.available) return;
    revoke();
    if (doc.extension !== "pdf") {
      setPreview({ doc, url: "", unsupported: true });
      return;
    }
    setBusy(`${doc.key}:preview`);
    try {
      const { data } = await candidatesService.getDocument(studentId, doc.key, "inline");
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      urlRef.current = url;
      setPreview({ doc, url, unsupported: false });
    } catch (error) {
      await fail(error);
    } finally {
      setBusy("");
    }
  }, [studentId, fail]);

  const closePreview = useCallback(() => {
    revoke();
    setPreview(null);
  }, []);

  const download = useCallback(async (doc) => {
    if (!doc?.available) return;
    setBusy(`${doc.key}:download`);
    try {
      const { data } = await candidatesService.getDocument(studentId, doc.key, "attachment");
      downloadBlob(data, doc.fileName || "document");
    } catch (error) {
      await fail(error);
    } finally {
      setBusy("");
    }
  }, [studentId, fail]);

  return { busy, preview, openPreview, closePreview, download };
}
