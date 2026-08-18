import { useState, useEffect } from "react";
import { ceremonyService } from "../services/ceremony.service.js";

// Détermine si le vote de la Cérémonie est ouvert, à partir de
// CeremonySettings (isVoteClosed + voteStartDate/voteEndDate) — utilisé par
// CeremonyPage.jsx et CeremonyProjectDetail.jsx pour désactiver les boutons
// de vote et afficher un message clair, cohérent entre les deux pages.
// Le vote lui-même est de toute façon re-vérifié côté backend (vote() dans
// ceremony.controller.js) — ce hook ne fait que refléter cet état côté UI.
export function useCeremonyVoteGate() {
  const [reason, setReason] = useState(null); // null = vote ouvert

  useEffect(() => {
    ceremonyService.getSettings()
      .then(({ data }) => {
        const now = new Date();
        let next = null;
        if (data.isVoteClosed) next = "closed";
        else if (data.voteStartDate && now < new Date(data.voteStartDate)) next = "notStarted";
        else if (data.voteEndDate && now > new Date(data.voteEndDate)) next = "ended";
        setReason(next);
      })
      .catch(() => {});
  }, []);

  return reason;
}
