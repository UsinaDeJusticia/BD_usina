"use client"

import Link from "next/link"
import { VictimPhoto } from "@/components/victims/victim-photo"
import type { CaseListItem } from "@/lib/data/casos"
import { getStatusColor } from "@/lib/cases/status"
import { formatDateUTC } from "@/lib/utils"

const NOT_SPECIFIED = "No especificado"

/**
 * Ficha de un caso para los listados (diseño aprobado "opción A"): sin caja,
 * la foto se desvanece hacia el fondo y el nombre se apoya sobre ella.
 */
export function CasePhotoCard({ caseData, photoUrl }: { caseData: CaseListItem; photoUrl?: string | null }) {
  const location = [caseData.municipio, caseData.provincia].filter((x) => x && x !== NOT_SPECIFIED).join(", ")
  const contact =
    caseData.familyContactName && caseData.familyContactName !== NOT_SPECIFIED
      ? `Contacto: ${caseData.familyContactName}${caseData.familyRelationship ? ` (${caseData.familyRelationship.toLowerCase()})` : ""}`
      : null
  const victims = caseData.totalVictimsInHecho > 1 ? `${caseData.totalVictimsInHecho} víctimas` : null

  return (
    <Link
      href={`/casos/${caseData.id}`}
      className="group flex flex-col rounded-2xl text-inherit no-underline outline-offset-[6px] transition-transform duration-200 hover:-translate-y-[3px] focus-visible:outline-2 focus-visible:outline-blue-900"
    >
      <VictimPhoto name={caseData.victimName} url={photoUrl} variant="card" />
      <div className="relative -mt-14 flex flex-col gap-2.5 px-1">
        <h3 className="m-0 line-clamp-2 font-heading text-[21px] font-bold leading-tight text-slate-900 transition-colors group-hover:text-blue-900">
          {caseData.victimName}
        </h3>
        <span className={`self-start rounded-full px-2.5 py-0.5 text-xs ${getStatusColor(caseData.status)}`}>
          {caseData.status}
        </span>
        <div className="flex flex-col gap-1 text-[13px] leading-normal text-slate-600">
          <span className="line-clamp-1">
            {[formatDateUTC(caseData.incidentDate), location].filter(Boolean).join(" · ")}
          </span>
          {(contact || victims) && <span className="line-clamp-1">{[contact, victims].filter(Boolean).join(" · ")}</span>}
        </div>
      </div>
    </Link>
  )
}
