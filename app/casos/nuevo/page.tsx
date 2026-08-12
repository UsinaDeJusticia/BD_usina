import { Header } from "@/components/layout/header"
import { CaseForm } from "@/components/cases/case-form"

interface NewCasePageProps {
  searchParams: Promise<{ fromCandidato?: string }>
}

export default async function NewCasePage({ searchParams }: NewCasePageProps) {
  const { fromCandidato } = await searchParams

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <CaseForm mode="create" fromCandidatoId={fromCandidato} />
    </div>
  )
}
