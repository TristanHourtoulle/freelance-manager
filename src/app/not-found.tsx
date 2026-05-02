import Link from "next/link"

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty">
        <div className="empty-title">Page introuvable</div>
        <div style={{ marginBottom: 16 }}>
          Cette adresse ne correspond à aucune page.
        </div>
        <Link href="/dashboard" className="btn btn-primary">
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
