import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"

interface RecapInvoice {
  number: string
  issueDate: string
  status: string
  paymentStatus: string
  total: number
  paidAmount: number
  balanceDue: number
}

interface RecapProps {
  client: {
    firstName: string
    lastName: string
    company: string | null
    email: string | null
    phone: string | null
    website: string | null
    address: string | null
    billingMode: "DAILY" | "FIXED" | "HOURLY"
    rate: number
    fixedPrice: number | null
    paymentTerms: number | null
    notes: string | null
    createdAt: string
  }
  totals: {
    revenue: number
    outstanding: number
    overdueCount: number
    invoicesCount: number
    avgPaymentDelay: number | null
  }
  invoices: RecapInvoice[]
  generatedAt: string
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    color: "#0f172a",
    fontSize: 10,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 18,
    borderBottom: "1 solid #d4d4d8",
    marginBottom: 18,
  },
  brand: { fontSize: 16, fontWeight: 700 },
  brandSub: { fontSize: 9, color: "#71717a", marginTop: 2 },
  date: { fontSize: 9, color: "#71717a", textAlign: "right" },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 10, color: "#52525b", marginBottom: 18 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#71717a",
    marginBottom: 8,
  },
  card: {
    border: "1 solid #e4e4e7",
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  row: { flexDirection: "row", marginBottom: 4 },
  rowLabel: { width: 110, color: "#71717a" },
  rowValue: { flex: 1, color: "#0f172a" },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },
  kpi: {
    flex: 1,
    border: "1 solid #e4e4e7",
    borderRadius: 6,
    padding: 10,
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#71717a",
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 4,
    color: "#0f172a",
  },
  kpiSub: { fontSize: 9, color: "#71717a", marginTop: 2 },
  table: { borderTop: "1 solid #e4e4e7" },
  tr: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottom: "1 solid #f4f4f5",
  },
  th: {
    fontSize: 9,
    color: "#71717a",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: { fontSize: 10 },
  cellNumber: { width: 80 },
  cellDate: { width: 70 },
  cellStatus: { width: 80 },
  cellAmount: { width: 80, textAlign: "right" },
  cellGrow: { flex: 1 },
  notes: { fontSize: 10, color: "#3f3f46", lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#a1a1aa",
    textAlign: "center",
  },
})

const STATUS_FR: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Émise",
  CANCELLED: "Annulée",
}
const PAYMENT_FR: Record<string, string> = {
  UNPAID: "Non payée",
  PARTIALLY_PAID: "Partielle",
  PAID: "Payée",
  OVERPAID: "Trop-perçu",
}

function fmtEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/**
 * Multi-page client recap PDF (identity, KPIs, invoices table, notes).
 * Used by the GET /api/clients/:id/recap endpoint.
 */
export function ClientRecapDocument({
  client,
  totals,
  invoices,
  generatedAt,
}: RecapProps) {
  const fullName = `${client.firstName} ${client.lastName}`
  const billingLabel =
    client.billingMode === "DAILY"
      ? `${client.rate} €/jour`
      : client.billingMode === "HOURLY"
        ? `${client.rate} €/heure`
        : client.fixedPrice
          ? `Forfait ${fmtEUR(client.fixedPrice)}`
          : "Forfait"

  return (
    <Document
      title={`Récap — ${client.company ?? fullName}`}
      author="FreelanceManager"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>FreelanceManager</Text>
            <Text style={styles.brandSub}>Récapitulatif client</Text>
          </View>
          <Text style={styles.date}>Généré le {fmtDate(generatedAt)}</Text>
        </View>

        <Text style={styles.title}>{client.company ?? fullName}</Text>
        <Text style={styles.sub}>
          {client.company ? fullName : ""}
          {client.email ? ` · ${client.email}` : ""}
        </Text>

        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Revenu encaissé</Text>
            <Text style={styles.kpiValue}>{fmtEUR(totals.revenue)}</Text>
            <Text style={styles.kpiSub}>{totals.invoicesCount} factures</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Encours</Text>
            <Text style={styles.kpiValue}>{fmtEUR(totals.outstanding)}</Text>
            <Text style={styles.kpiSub}>{totals.overdueCount} en retard</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Délai moyen</Text>
            <Text style={styles.kpiValue}>
              {totals.avgPaymentDelay != null
                ? `${totals.avgPaymentDelay} j`
                : "—"}
            </Text>
            <Text style={styles.kpiSub}>du règlement</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Coordonnées</Text>
        <View style={styles.card}>
          {client.email && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{client.email}</Text>
            </View>
          )}
          {client.phone && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Téléphone</Text>
              <Text style={styles.rowValue}>{client.phone}</Text>
            </View>
          )}
          {client.website && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Site</Text>
              <Text style={styles.rowValue}>{client.website}</Text>
            </View>
          )}
          {client.address && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Adresse</Text>
              <Text style={styles.rowValue}>{client.address}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Facturation</Text>
            <Text style={styles.rowValue}>{billingLabel}</Text>
          </View>
          {client.paymentTerms != null && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Délai paiement</Text>
              <Text style={styles.rowValue}>{client.paymentTerms} jours</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Client depuis</Text>
            <Text style={styles.rowValue}>{fmtDate(client.createdAt)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Factures</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.cellNumber]}>Numéro</Text>
            <Text style={[styles.th, styles.cellDate]}>Émise</Text>
            <Text style={[styles.th, styles.cellStatus]}>Statut</Text>
            <Text style={[styles.th, styles.cellGrow]}>Paiement</Text>
            <Text style={[styles.th, styles.cellAmount]}>Total</Text>
            <Text style={[styles.th, styles.cellAmount]}>Reste</Text>
          </View>
          {invoices.map((inv) => (
            <View key={inv.number} style={styles.tr}>
              <Text style={[styles.td, styles.cellNumber]}>{inv.number}</Text>
              <Text style={[styles.td, styles.cellDate]}>
                {fmtDate(inv.issueDate)}
              </Text>
              <Text style={[styles.td, styles.cellStatus]}>
                {STATUS_FR[inv.status] ?? inv.status}
              </Text>
              <Text style={[styles.td, styles.cellGrow]}>
                {PAYMENT_FR[inv.paymentStatus] ?? inv.paymentStatus}
              </Text>
              <Text style={[styles.td, styles.cellAmount]}>
                {fmtEUR(inv.total)}
              </Text>
              <Text style={[styles.td, styles.cellAmount]}>
                {fmtEUR(inv.balanceDue)}
              </Text>
            </View>
          ))}
          {invoices.length === 0 && (
            <View style={styles.tr}>
              <Text style={[styles.td, { color: "#a1a1aa" }]}>
                Aucune facture pour ce client.
              </Text>
            </View>
          )}
        </View>

        {client.notes && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.card}>
              <Text style={styles.notes}>{client.notes}</Text>
            </View>
          </View>
        )}

        <Text style={styles.footer}>
          FreelanceManager — récap généré pour usage interne
        </Text>
      </Page>
    </Document>
  )
}
