import { useCallback, useEffect, useRef, useState } from "react";
import { candidatesService } from "../../../../services/candidates.service.js";
import { downloadBlob, isCanceledError, isNetworkError, readBlobError } from "../candidatesUtils.js";

/* Consultation / téléchargement des documents d'un dossier. Les fichiers sont
   récupérés via l'API authentifiée (Blob) : jamais d'URL publique devinable.
   Une seule requête à la fois ; toute URL Blob créée est révoquée. */
export function useDocumentActions(studentId, { onError } = {}) {
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(null);
  const urlRef = useRef("");
  const controllerRef = useRef(null);
  const mountedRef = useRef(true);

  const revoke = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      revoke();
    };
  }, []);

  const startRequest = () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller;
  };

  const fail = useCallback(async (error) => {
    if (isCanceledError(error) || !mountedRef.current) return;
    if (isNetworkError(error)) { onError?.("network"); return; }
    const { message, code } = await readBlobError(error);
    onError?.(code === "DOCUMENT_UNAVAILABLE" ? "unavailable" : "generic", message);
  }, [onError]);

  const openPreview = useCallback(async (doc) => {
    if (!doc?.available) return;
    if (doc.extension !== "pdf") {
      revoke();
      setPreview({ doc, url: "", unsupported: true });
      return;
    }
    const controller = startRequest();
    setBusy(`${doc.key}:preview`);
    try {
      const { data } = await candidatesService.getDocument(studentId, doc.key, "inline", { signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return;
      revoke();
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      urlRef.current = url;
      setPreview({ doc, url, unsupported: false });
    } catch (error) {
      await fail(error);
    } finally {
      if (mountedRef.current && controllerRef.current === controller) setBusy("");
    }
  }, [studentId, fail]);

  const closePreview = useCallback(() => {
    revoke();
    setPreview(null);
  }, []);

  const download = useCallback(async (doc) => {
    if (!doc?.available) return;
    const controller = startRequest();
    setBusy(`${doc.key}:download`);
    try {
      const { data } = await candidatesService.getDocument(studentId, doc.key, "attachment", { signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return;
      downloadBlob(data, doc.fileName || "document");
    } catch (error) {
      await fail(error);
    } finally {
      if (mountedRef.current && controllerRef.current === controller) setBusy("");
    }
  }, [studentId, fail]);

  return { busy, preview, openPreview, closePreview, download };
}
