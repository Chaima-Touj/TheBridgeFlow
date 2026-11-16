import { useCallback, useEffect, useRef, useState } from "react";
import { candidatesService } from "../../../../services/candidates.service.js";
import { isCanceledError, isNetworkError } from "../candidatesUtils.js";
import { removeTask, upsertTask } from "./dossierUtils.js";

const SILENT_REFRESH_AFTER_MS = 30 * 1000;

export function classifyError(error) {
  if (isNetworkError(error)) return "network";
  const status = error?.response?.status;
  if (status === 404 || status === 400) return "notFound";
  if (status === 403) return "forbidden";
  if (status === 429) return "rateLimited";
  return "generic";
}

/* Dossier + tâches d'un étudiant. L'identifiant vient TOUJOURS de l'URL du
   dossier ouvert. Les tâches étant partagées entre administrateurs, elles
   sont rechargées silencieusement au retour sur l'onglet (≥ 30 s). */
export function useDossierData(studentId) {
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${studentId}:${reloadToken}`;
  const [state, setState] = useState({ key: null, studentId: null, dossier: null, tasks: [], summary: null, error: null });
  const lastFetchRef = useRef(0);
  const silentRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      candidatesService.getDossier(studentId, { signal: controller.signal }),
      candidatesService.getTasks(studentId, {}, { signal: controller.signal }),
    ])
      .then(([dossierRes, tasksRes]) => {
        lastFetchRef.current = Date.now();
        setState({
          key: requestKey,
          studentId,
          dossier: dossierRes.data,
          tasks: tasksRes.data.tasks || [],
          summary: tasksRes.data.summary || dossierRes.data.taskSummary || null,
          error: null,
        });
      })
      .catch((error) => {
        if (isCanceledError(error)) return;
        setState((previous) => ({
          ...(previous.studentId === studentId ? previous : { dossier: null, tasks: [], summary: null }),
          key: requestKey,
          studentId,
          error: classifyError(error),
        }));
      });
    return () => controller.abort();
  }, [studentId, requestKey]);

  const silentRefresh = useCallback(({ tasks = true, dossier = true } = {}) => {
    // Horodaté dès le départ : focus + visibilitychange (quasi simultanés)
    // ne déclenchent qu'un seul rafraîchissement.
    lastFetchRef.current = Date.now();
    silentRef.current?.abort();
    const controller = new AbortController();
    silentRef.current = controller;
    const jobs = [
      dossier ? candidatesService.getDossier(studentId, { signal: controller.signal }) : Promise.resolve(null),
      tasks ? candidatesService.getTasks(studentId, {}, { signal: controller.signal }) : Promise.resolve(null),
    ];
    return Promise.all(jobs)
      .then(([dossierRes, tasksRes]) => {
        lastFetchRef.current = Date.now();
        setState((previous) => {
          if (previous.studentId !== studentId) return previous;
          return {
            ...previous,
            dossier: dossierRes ? dossierRes.data : previous.dossier,
            tasks: tasksRes ? tasksRes.data.tasks || [] : previous.tasks,
            summary: tasksRes ? tasksRes.data.summary : previous.summary,
          };
        });
      })
      .catch(() => { /* rafraîchissement silencieux : l'erreur n'interrompt pas la consultation */ });
  }, [studentId]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchRef.current < SILENT_REFRESH_AFTER_MS) return;
      silentRefresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      silentRef.current?.abort();
    };
  }, [silentRefresh]);

  const applyTask = useCallback((task, summary) => {
    setState((previous) => ({
      ...previous,
      tasks: upsertTask(previous.tasks, task),
      summary: summary || previous.summary,
    }));
  }, []);

  const dropTask = useCallback((taskId, summary) => {
    setState((previous) => ({
      ...previous,
      tasks: removeTask(previous.tasks, taskId),
      summary: summary || previous.summary,
    }));
  }, []);

  const current = state.studentId === studentId;
  return {
    dossier: current ? state.dossier : null,
    tasks: current ? state.tasks : [],
    summary: current ? state.summary : null,
    error: current && state.key === requestKey ? state.error : null,
    loading: state.key !== requestKey,
    reload: () => setReloadToken((value) => value + 1),
    silentRefresh,
    applyTask,
    dropTask,
  };
}
