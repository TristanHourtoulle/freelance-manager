# Spec — Module Devis (Quotes) — complétion UI track-only

> Date: 2026-07-21 (révisé le même jour)
> Statut: en cours d'implémentation
>
> **AVERTISSEMENT — ce spec a été réécrit.** La v1 proposait un builder devis +
> conversion devis→facture + portail public client. **Abandonné** : le module
> Devis existe déjà sur `main` (commit `8b1d72b`) et est **délibérément
> track-only** — c'est **Abby.fr** qui émet le document et gère l'acceptation
> client (`Quote.externalUrl` pointe dessus). Émettre le document depuis l'app
> est un **non-goal acté**. La v1 contredisait cette architecture ; elle a été
> conçue sur une branche 140 commits en retard où le module n'existait pas.

## Contexte : ce qui existe déjà (shipped)

Le module Devis est un **suivi commercial** du devis dont Abby.fr reste la source
de vérité légale :

- Prisma `Quote` / `QuoteLine` / enum `QuoteStatus` (DRAFT/SENT/ACCEPTED/REFUSED/
  **EXPIRED stocké**) + migration `20260721090100_add_quote_models`.
- Champs : `issueDate`, `validUntil?`, `sentAt?`, `decidedAt?`, `externalUrl?`,
  `subtotal`, `total`, `notes?`, lignes. **Pas** de `tax`/`totalOverride`/
  `publicToken`/`convertedInvoiceId`. `QuoteLine` : `taskId?` (sans FK), label,
  qty, rate, position.
- Numérotation `src/lib/quote-numbering.ts` → `nextQuoteNumber` → `D-YYYY-NNNN`,
  lock advisory dédié (`quote:${userId}`), séquence par-année (`baseCount + 1`,
  sans l'offset +1024 des factures).
- API `src/app/api/quotes/route.ts` (GET liste paginée + POST create) et
  `[id]/route.ts` (GET détail, PATCH create-lines/status, DELETE). CSRF +
  ownership scoping OK. `revalidateTag(navTag)` sur mutation.
- Hooks `src/hooks/use-quotes.ts` : `useQuotes`, `useQuote`, `useCreateQuote`,
  `useUpdateQuote`, `useSetQuoteStatus`, `useDeleteQuote` (invalident quotes +
  analytics).
- Domain `src/domain/quotes/{types,serialize,kpis}` (+ `kpis.test.ts`).
- Vue liste desktop `page.tsx` + mobile `mobile.tsx` : KPIs (taux de signature,
  délai de décision, pipeline), filtres statut, recherche, lien « Voir sur Abby ».
- Nav item « Devis → /quotes » dans `NAV_SECTIONS` (sans `badgeKey`).

## Le gap réel

**Aucune UI d'écriture.** On ne peut ni créer, ni éditer, ni changer le statut
d'un devis depuis l'app. La liste est en lecture seule (rangs non cliquables, pas
de bouton « Nouveau devis »). L'API et les hooks sont prêts mais non câblés.

## Périmètre de cette complétion

Respect strict de l'archi track-only. **Aucun** changement de schéma Prisma.

### 1. Formulaire de création / édition (partagé)

- `src/features/quotes/use-quote-form.ts` — hook de formulaire (bien plus simple
  que `use-invoice-builder`) : état client/projet/`issueDate`/`validUntil`/
  `number`(auto, éditable)/`status`/`externalUrl`/`notes` + lignes
  (`{label, qty, rate, taskId?}`). Charge `useClients`/`useProjects`. Expose
  `addLine`/`removeLine`/`updateLine`, `subtotal`/`total` calculés via
  `sumLines` (`@/lib/billing-math`), et `submit()` (create) / `save()` (edit)
  branchés sur `useCreateQuote`/`useUpdateQuote`.
  - **Import optionnel depuis les tâches** : bouton « Importer les tâches à
    facturer » qui pré-remplit des lignes depuis les tâches `PENDING_INVOICE` du
    client (réutilise `lineFromTask` + `filterEligibleTasks` de billing).
    Convenience, pas de binding (les devis ne consomment pas les tâches).
- `src/components/quotes/quote-form.tsx` — UI du formulaire, miroir visuel de la
  config-card + panneau lignes de billing (`.card`, `.input`, `.table`, `.btn`).
  Champ `externalUrl` labellisé « Lien Abby (facultatif) ». Responsive (marche
  sur mobile sans builder drag&drop).
- `src/app/(dashboard)/quotes/new/page.tsx` — page création (`mode: "create"`,
  supporte `?clientId=` et `?taskIds=` en préselection comme billing).
- `src/app/(dashboard)/quotes/[id]/edit/page.tsx` — page édition (`use(params)`,
  `useQuote(id)` + skeleton).

### 2. Drawer détail + actions de statut

- `src/components/quotes/quote-drawer.tsx` — props `{ quoteId, onClose }`, miroir
  d'`InvoiceDrawer` (`<Modal title={number} width={680}>`). Affiche header
  (pill statut + dates + « Voir sur Abby »), carte client cliquable, lignes
  (table), notes, total. **Actions footer** (conditionnelles au statut) :
  « Modifier » (→ `/quotes/[id]/edit`), « Marquer envoyé » (DRAFT→SENT),
  « Marquer accepté » / « Marquer refusé » (SENT→ACCEPTED/REFUSED via
  `useSetQuoteStatus`), « Supprimer » (via `<ConfirmDialog>`, `useDeleteQuote`,
  puis `onClose`). Toasts déjà gérés par les hooks.

### 3. Câblage des vues liste

- `page.tsx` (desktop) : bouton **« Nouveau devis »** dans `.page-header`
  (→ `/quotes/new`) ; rangs **cliquables** → ouvrent `QuoteDrawer` (state
  `openId`). Aucune régression des KPIs/filtres/recherche existants.
- `mobile.tsx` : bouton/CTA **« Nouveau devis »** ; tap sur une carte → drawer
  (ou navigation détail). Parité mobile respectée.

### 4. Badge de navigation (petit, fichiers nav disjoints)

- `src/lib/data/nav.ts` : ajouter `quotes` à `NavCounts` + le comptage dans
  `getNavCounts` (devis `SENT` non expirés = « en attente de décision »).
- `src/lib/navigation.ts` : `badgeKey: "quotes"` sur l'item Devis ; étendre
  `NavBadgeKey`. Le badge se met à jour via le `revalidateTag(navTag)` déjà
  émis par les routes quotes.

## Tests (vitest, sans DB)

- `use-quote-form` : math des lignes (`subtotal`/`total`), mapping task→ligne
  (DAILY/HOURLY/FIXED via `lineFromTask`), payload `submit` conforme à
  `quoteCreateSchema`, payload `save` conforme à `quoteUpdateSchema`.
- Rendu du drawer : actions affichées selon le statut (DRAFT vs SENT vs décidé).

## Hors périmètre

- Builder drag&drop dédié, conversion devis→facture, portail public client,
  émission de document/PDF, signature électronique → **non-goals** (Abby.fr).
- `tax`/`totalOverride` sur les devis → non demandés.
- Cache data-layer `quotesTag` + `getQuotesFirstPage` (le GET liste requête
  directement, fonctionne) → **follow-up perf optionnel**, pas un gap.
- `ActivityLog` pour les devis (pas de `quoteId`/`ActivityKind` QUOTE_*) →
  follow-up si besoin, nécessiterait une migration.
