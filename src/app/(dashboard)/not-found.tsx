import Link from "next/link"

export default function DashboardNotFound() {
  return (
    <div className="page">
      <div className="empty">
        <div className="empty-title">Ressource introuvable</div>
        <div style={{ marginBottom: 16 }}>
          Cet élément n&apos;existe pas ou n&apos;est pas accessible.
        </div>
        <Link href="/dashboard" className="btn btn-primary">
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
