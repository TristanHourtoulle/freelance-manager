import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import type { ClientFacingRecap } from "@/domain/clients/client-recap"

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
  projectName: { fontSize: 11, fontWeight: 700, marginBottom: 6 },
  table: { borderTop: "1 solid #e4e4e7", marginBottom: 16 },
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
  cellId: { width: 80 },
  cellDate: { width: 80, textAlign: "right" },
  cellGrow: { flex: 1 },
  empty: { fontSize: 10, color: "#a1a1aa", marginBottom: 16 },
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

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function fmtDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(iso))
}

function fmtDuration(minutes: number): string {
  if (minutes <= 0) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h} h ${m}`
  if (h) return `${h} h`
  return `${m} min`
}

/**
 * Client-facing recap PDF: what was delivered, what was discussed and what
 * comes next. Composed exclusively from {@link ClientFacingRecap}, which
 * structurally cannot carry the freelancer's private data.
 *
 * @param recap - The composed client-facing payload.
 */
export function ClientFacingRecapDocument({
  recap,
}: {
  recap: ClientFacingRecap
}) {
  return (
    <Document
      title={`Récapitulatif — ${recap.clientName}`}
      author="FreelanceManager"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>FreelanceManager</Text>
            <Text style={styles.brandSub}>Récapitulatif client</Text>
          </View>
          <Text style={styles.date}>Édité le {fmtDate(recap.issuedAt)}</Text>
        </View>

        <Text style={styles.title}>{recap.clientName}</Text>
        <Text style={styles.sub}>Point d&apos;avancement</Text>

        <Text style={styles.sectionTitle}>Période</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Du</Text>
            <Text style={styles.rowValue}>{fmtDate(recap.periodStart)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Au</Text>
            <Text style={styles.rowValue}>{fmtDate(recap.periodEnd)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Travaux livrés</Text>
        {recap.projects.length === 0 ? (
          <Text style={styles.empty}>Aucun travail livré sur la période.</Text>
        ) : (
          recap.projects.map((project) => (
            <View key={project.name} style={{ marginBottom: 12 }}>
              <Text style={styles.projectName}>{project.name}</Text>
              <View style={styles.table}>
                <View style={styles.tr}>
                  <Text style={[styles.th, styles.cellId]}>Réf.</Text>
                  <Text style={[styles.th, styles.cellGrow]}>Intitulé</Text>
                  <Text style={[styles.th, styles.cellDate]}>Livré le</Text>
                </View>
                {project.tasks.map((task) => (
                  <View key={task.identifier} style={styles.tr}>
                    <Text style={[styles.td, styles.cellId]}>
                      {task.identifier}
                    </Text>
                    <Text style={[styles.td, styles.cellGrow]}>
                      {task.title}
                    </Text>
                    <Text style={[styles.td, styles.cellDate]}>
                      {fmtDate(task.completedAt)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Réunions</Text>
        {recap.meetings.length === 0 ? (
          <Text style={styles.empty}>Aucune réunion sur la période.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={[styles.th, styles.cellGrow]}>Sujet</Text>
              <Text style={[styles.th, styles.cellDate]}>Date</Text>
              <Text style={[styles.th, styles.cellDate]}>Durée</Text>
            </View>
            {recap.meetings.map((meeting) => (
              <View
                key={`${meeting.heldAt}-${meeting.title}`}
                style={styles.tr}
              >
                <Text style={[styles.td, styles.cellGrow]}>
                  {meeting.title}
                </Text>
                <Text style={[styles.td, styles.cellDate]}>
                  {fmtDate(meeting.heldAt)}
                </Text>
                <Text style={[styles.td, styles.cellDate]}>
                  {fmtDuration(meeting.durationMinutes)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Prochaines étapes</Text>
        {recap.nextSteps.length === 0 ? (
          <Text style={styles.empty}>Aucune étape en cours.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={[styles.th, styles.cellGrow]}>Étape</Text>
              <Text style={[styles.th, styles.cellId]}>État</Text>
              <Text style={[styles.th, styles.cellDate]}>Échéance</Text>
            </View>
            {recap.nextSteps.map((step) => (
              <View
                key={`${step.title}-${step.dueDate ?? ""}`}
                style={styles.tr}
              >
                <Text style={[styles.td, styles.cellGrow]}>{step.title}</Text>
                <Text style={[styles.td, styles.cellId]}>
                  {step.waiting ? "En attente" : "En cours"}
                </Text>
                <Text style={[styles.td, styles.cellDate]}>
                  {step.dueDate ? fmtDate(step.dueDate) : "—"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          FreelanceManager — récapitulatif client
        </Text>
      </Page>
    </Document>
  )
}
