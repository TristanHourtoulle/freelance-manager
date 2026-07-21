# Spec — Module Devis (Quotes)

> Date: 2026-07-21
> Statut: design validé, en attente de relecture utilisateur avant plan d'implémentation
> Auteur: brainstorming Tristan + Claude

## Contexte & objectif

L'app Freelance Manager couvre aujourd'hui le cycle **client → projet → task →
facture → suivi**, mais pas l'**amont commercial**. Le module Devis ouvre la
première brique manquante du cycle de vie freelance complet :

```
Prospect ──► Devis ──► Contrat ──► [Client] ──► Delivery + Temps ──► Facture ──► Suivi
             ^^^^^                  existant                          existant   existant
             CE SPEC
```

Un **devis** est une estimation chiffrée envoyée au client **avant** la facture.
Une fois accepté, il se **convertit en facture en un clic**. Le module réutilise
au maximum le moteur de facturation existant (`Invoice`/`InvoiceLine`, builder
drag&drop, `fmtEUR`, pills, numérotation).

Les trois autres dimensions amont identifiées au brainstorming (Prospection/CRM,
Time tracking, Contrats/documents) feront **chacune leur propre spec** — hors de
ce document.

## Contrainte design (source de vérité)

Le module Devis **n'existe pas** dans `design-reference/`. Déviation **approuvée
explicitement** par l'utilisateur : Devis est construit en **miroir fidèle du
module Billing existant** (même design system, mêmes composants, aucun nouveau
langage visuel). Toute décision visuelle se réfère aux pages `billing/`
correspondantes, pas à une nouvelle maquette.

## Décisions verrouillées (brainstorming)

1. **Premier module** du chantier « élargir le périmètre » = Devis (ROI immédiat,
   réutilise l'infra billing, risque faible).
2. **Design** = miroir 1:1 du module Billing.
3. **Numéro** = `D-2026-0001` (préfixe `D-`, séquence par année propre aux devis,
   indépendante des factures).
4. **Portail public inclus** (Phase B) : lien partageable où le client voit le
   devis et clique Accepter/Refuser.
5. Livraison **en 2 phases** dans un seul spec (Phase A shippable seule).

---

## Modèle de données

Deux nouvelles entités Prisma, calquées sur `Invoice`/`InvoiceLine`. Types
`Decimal(10,2)` identiques.

```prisma
enum QuoteStatus {
  DRAFT
  SENT
  ACCEPTED
  REFUSED
}

model Quote {
  id        String  @id @default(cuid())
  userId    String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  clientId  String
  client    Client  @relation(fields: [clientId], references: [id], onDelete: Cascade)
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  number   String
  status   QuoteStatus @default(DRAFT)

  issueDate  DateTime
  validUntil DateTime

  subtotal      Decimal  @default(0) @db.Decimal(10, 2)
  totalOverride Decimal? @db.Decimal(10, 2)
  tax           Decimal  @default(0) @db.Decimal(10, 2)
  total         Decimal  @default(0) @db.Decimal(10, 2)
  notes         String?  @db.Text

  acceptedAt DateTime?
  refusedAt  DateTime?

  publicToken       String?  @unique
  convertedInvoiceId String? @unique
  convertedInvoice   Invoice? @relation("QuoteConversion", fields: [convertedInvoiceId], references: [id], onDelete: SetNull)

  lines    QuoteLine[]
  activity ActivityLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, number])
  @@index([userId])
  @@index([userId, status])
  @@index([userId, issueDate(sort: Desc)])
  @@index([clientId])
  @@index([projectId])
  @@map("quotes")
}

model QuoteLine {
  id      String @id @default(cuid())
  quoteId String
  quote   Quote  @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  taskId  String?
  task    Task?  @relation(fields: [taskId], references: [id], onDelete: SetNull)

  label    String
  qty      Decimal @db.Decimal(10, 2)
  rate     Decimal @db.Decimal(10, 2)
  position Int     @default(0)

  @@index([quoteId])
  @@index([taskId])
  @@map("quote_lines")
}
```

Relations inverses à ajouter :
- `Invoice` : `sourceQuote Quote? @relation("QuoteConversion")` (back-relation).
- `User` : `quotes Quote[]`.
- `Client`, `Project`, `Task`, `ActivityLog` : back-relations correspondantes.

### Statut `EXPIRED` (calculé, non stocké)

Comme `isOverdue` pour les factures, `EXPIRED` n'est **pas** une valeur d'enum
persistée. Il est dérivé au vol :

```
isExpired = status === "SENT" && validUntil < now() && !acceptedAt && !refusedAt
```

Le statut affiché (pill) applique `isExpired` par-dessus le `status` brut. Un
helper `getQuoteComputed(quote)` (miroir de `getInvoiceComputed`) centralise ce
calcul et le total effectif (`totalOverride ?? total`).

### Migration

- `pnpm exec prisma db push` en local, puis commit du SQL de migration à la main
  (règle projet : `_prisma_migrations` marquée après apply raw psql si besoin).
- Nouvelles tables `quotes` / `quote_lines`, nouvel enum `QuoteStatus`, colonnes
  `publicToken` (+ index unique) et `convertedInvoiceId` (+ index unique).

---

## Numérotation

Généraliser `src/lib/invoice-numbering.ts` pour accepter la table cible et un
préfixe, **sans** régresser sur les factures existantes.

- Nouvelle fonction `nextQuoteNumber(tx, userId, year)` OU paramétrage de
  `nextAutoNumber` (table + préfixe + format). Format devis : `D-${year}-${seq4}`
  → `D-2026-0001`.
- Même mécanisme de `pg_advisory_xact_lock(userIdLockKey(userId))` mais **domaine
  de lock distinct** des factures (ex. hash `quote:${userId}` ou offset de clé)
  pour ne pas sérialiser inutilement devis et factures d'un même user.
- Séquence **par année** propre aux devis (compteur sur table `quotes`).

> Note dette connue : la numérotation facture a des bugs ouverts (séquence
> par-année imparfaite, régression COUNT) épinglés par des tests. Le devis
> **réimplémente proprement** la séquence par-année (pas de recopie du bug) et
> documente la divergence dans les tests. Ne pas propager le comportement fautif.

---

## Conversion Devis → Facture

`POST /api/quotes/[id]/convert`

Préconditions (sinon `409 Conflict`) :
- `status === "ACCEPTED"`.
- `convertedInvoiceId === null` (conversion **unique**, idempotence).

Effet (dans une transaction) :
1. Alloue un numéro de facture (`nextAutoNumber`).
2. Crée une `Invoice` **DRAFT / UNPAID / STANDARD** copiant : `clientId`,
   `projectId`, `tax`, `totalOverride`, `subtotal`, `total`, `notes`, et chaque
   ligne (`label`, `qty`, `rate`, `taskId`, `position`).
3. `Quote.convertedInvoiceId = invoice.id`.
4. `issueDate = today`, `dueDate = today + client.paymentTerms ?? defaultPaymentDays`.
5. `ActivityLog` : « Devis D-… converti en facture 2026-… ».

Invalidation cache : `["quotes"]`, `["quote", id]`, `["invoices"]`, nav-counts,
`revalidateTag(invoicesTag, "max")` + tag quotes équivalent.

**Tâches & double facturation** : les tâches d'un devis ne sont **pas
consommées** (un devis est non engageant). `task.invoiceId` n'est renseigné qu'à
la **création de facture** (y compris via conversion). Une tâche reste éligible
dans le builder de facture tant qu'elle n'est pas réellement facturée. Pas de
système de réservation parallèle.

---

## Pages (miroir 1:1 de Billing)

| Route | Clone de | Contenu |
|---|---|---|
| `/quotes` | `src/app/(dashboard)/billing/page.tsx` | Liste + chips filtre par statut + `QuoteDrawer` + `LoadMoreButton` (pagination curseur) |
| `/quotes/new` | `src/app/(dashboard)/billing/new/page.tsx` | Builder drag&drop, même task-picker ; lignes auto selon `client.billingMode` (règle DAILY/HOURLY/FIXED du CLAUDE.md) |
| `/quotes/[id]/edit` | `src/app/(dashboard)/billing/[id]/edit/page.tsx` | Édition builder |
| `/quotes/mobile.tsx` | `src/app/(dashboard)/billing/mobile.tsx` | Twin mobile (parité obligatoire) |

- **Chips de filtre** : `all` / `DRAFT` / `SENT` / `ACCEPTED` / `REFUSED` /
  `EXPIRED` (miroir de `matchesFilter`).
- **Builder** : réutilise la logique de mapping task→ligne existante
  (`qty`/`rate` selon `billingMode`, `label = [${linearId}] ${title}`). Le champ
  `dueDate` devient `validUntil` (« Valable jusqu'au »).
- **Composant partagé** : extraire si nécessaire le corps du builder facture en
  primitive réutilisable pour éviter la duplication de 886 lignes ; sinon clone
  paramétré. Décision d'implémentation à trancher dans le plan (préférence :
  factoriser `LineBuilder` + `TaskPicker` partagés entre facture et devis).

### Pills

Aucun nouveau token couleur (grille chroma 0.13–0.16 respectée). Réutilisation :

| Statut devis | Pill existante | Couleur |
|---|---|---|
| DRAFT | `pill-draft` | bg-3 (gris) |
| SENT | `pill-sent` | info (bleu) |
| ACCEPTED | `pill-done` | accent (vert) |
| REFUSED | `pill-overdue` | danger (rouge) |
| EXPIRED | `pill-warn` | warn (ambre) |

Ajouter un helper `quotePillStatus(quote)` miroir de `invoicePillStatus`.

### Navigation

- Nouvel item sidebar **« Devis »** (icône cohérente du set `<I>`), placé **avant
  « Facturation »** (ordre du cycle de vie).
- Nav-count `/api/nav-counts` : nombre de devis `SENT` non expirés non convertis
  (les devis « en attente de réponse »).
- Mobile : la barre bottom-nav a 5 onglets fixes (Accueil/Tasks/Factures/Clients/
  Plus). Devis n'y entre pas ; accès via la page « Plus » (ajouter l'entrée).

---

## Couche données (TanStack Query — pattern obligatoire)

`src/hooks/use-quotes.ts` :

```ts
const QUERY_KEY = ["quotes"] as const

export function useQuotes() { /* liste paginée, staleTime 30_000 */ }
export function useQuote(id: string) { /* détail, staleTime 60_000 */ }
export function useCreateQuote() { /* invalide ["quotes"] + nav-counts */ }
export function useUpdateQuote() { /* PATCH statut/lignes ; invalide ["quotes"], ["quote", id] */ }
export function useConvertQuote() { /* invalide ["quotes"], ["invoices"], nav-counts */ }
export function useRegenerateQuoteToken() { /* Phase B */ }
```

Règles projet respectées : jamais de `fetch` direct en composant ; mutations
invalident toujours les clés concernées ; `isPending` (pas `isLoading`) ; totaux
globaux via serveur (les listes sont capées à 50 lignes).

---

## API (routes internes, authentifiées)

- `GET /api/quotes` — liste paginée (curseur), `getQuotesFirstPage(userId)` en
  fast-path (miroir `getInvoicesFirstPage`). `getQuoteComputed` par ligne.
- `POST /api/quotes` — création (Zod `quoteCreateSchema` miroir de
  `invoiceCreateSchema` ; `dueDate`→`validUntil`). `requireSameOrigin`.
- `GET /api/quotes/[id]` — détail + lignes.
- `PATCH /api/quotes/[id]` — édition (lignes, notes, statut manuel Envoyé/
  Accepté/Refusé). `requireSameOrigin`.
- `DELETE /api/quotes/[id]` — suppression (bloquée si `convertedInvoiceId` set ?
  → décision : autoriser mais garder la facture ; `onDelete: SetNull` protège).
- `POST /api/quotes/[id]/convert` — conversion (voir plus haut).

Toutes les mutations : `requireSameOrigin`, `getAuthUser`, `deferActivityLog`,
invalidation tags.

---

## Phase B — Portail public client

### Routes publiques (non authentifiées, hors `(dashboard)`)

- Page `/q/[token]` — vue lecture seule du devis, sans chrome app (pas de sidebar/
  topbar), brandée, **français**, responsive mobile. N'expose **que** : les lignes
  du devis, le nom d'affichage du client, ton identité pro (nom/entreprise depuis
  `UserSettings`/`User`), les totaux, la date de validité. **Jamais** : ton
  e-mail, d'autres clients, d'autres devis/factures.
- `GET /api/public/quotes/[token]` — renvoie le devis par token. **404 générique**
  sur token inconnu/invalide (anti-énumération). Pas de `getAuthUser`.
- `POST /api/public/quotes/[token]/respond` — `{ action: "accept" | "refuse" }`.

### Modèle de sécurité (route non-auth = surface d'attaque)

- **Token** : `randomBytes(32)` encodé base64url (256 bits d'entropie),
  capability-URL non devinable (standard type Stripe/Notion). Stocké dans
  `Quote.publicToken` (`@unique`). Généré **à la 1ʳᵉ mise en `SENT`**.
  - *Durcissement optionnel (hors scope, noté)* : stocker un **hash** du token et
    lookup par hash, pour limiter l'exposition en cas de fuite DB. Retenu en
    follow-up seulement si demandé — complexifie la génération de l'URL (affichage
    one-time du token clair).
- **`requireSameOrigin` NE s'applique PAS** (cross-origin voulu). Protection :
  token non devinable + **rate-limit par IP** + **one-shot**.
- **Rate-limit** : il n'existe pas de limiter réutilisable générique (better-auth
  a le sien). Implémenter un limiter léger (fenêtre glissante en mémoire, keyé par
  `getClientIp`, nécessite `TRUST_PROXY=1` en prod Railway) sur `GET` (anti-
  énumération) et `POST` (anti-spam). Per-instance (Railway mono-instance = OK) ;
  documenter la limite.
- **`respond`** autorisé **uniquement si** `status === "SENT" && !isExpired &&
  convertedInvoiceId === null && !acceptedAt && !refusedAt`. **Une seule réponse**
  (re-clic → `409`). Écrit `ACCEPTED`/`REFUSED` + `acceptedAt`/`refusedAt` + une
  entrée `ActivityLog` (audit : IP + User-Agent, comme le modèle `Session`).
- **Devis expiré / déjà répondu / converti** → page publique en lecture seule
  avec message d'état (« Ce devis a expiré », « Devis déjà accepté le … »), pas de
  bouton d'action.
- **Révocation** : « Régénérer le lien » côté proprio remplace `publicToken` →
  l'ancien lien renvoie 404.

### Côté propriétaire (dans `QuoteDrawer`)

- Bouton **« Copier le lien »** (visible dès `SENT`).
- **« Régénérer le lien »** (confirmation via `<ConfirmDialog>`, pas de dialog
  natif).
- Affichage de la **réponse client** : statut + horodatage (`acceptedAt`/
  `refusedAt`).
- Quand le client accepte via le lien public → le devis passe `ACCEPTED` →
  nav-count et dashboard reflètent au prochain refetch/invalidation.

### Notification (follow-up optionnel, hors scope strict)

À l'événement `respond`, en plus de l'`ActivityLog` (dans le scope), déclencher
une **web-push** (infra VAPID existante) « Votre devis D-… a été accepté ». Noté
comme follow-up, pas requis pour livrer Phase B.

---

## Découpage & jalons

- **Phase A — Devis internes (shippable seule)** : schéma + migration,
  `nextQuoteNumber`, `getQuoteComputed`, hooks TanStack, API interne (CRUD +
  convert), liste `/quotes`, builder `/quotes/new` + edit, `QuoteDrawer`, pills,
  nav + nav-count, twin mobile.
- **Phase B — Portail public** : `publicToken` + régénération, page `/q/[token]`,
  API publique `GET`/`respond`, rate-limit IP, one-shot, boutons partage dans le
  drawer, `ActivityLog` sur respond.

---

## Tests (co-localisés `*.test.ts(x)`)

Couvrir en priorité la logique métier et les gardes de sécurité :

- **Numérotation devis** : séquence par-année, unicité concurrente (advisory
  lock), format `D-YYYY-NNNN`, non-collision avec factures.
- **`getQuoteComputed`** : calcul `isExpired` (limites : `validUntil` == now,
  accepté avant expiration, refusé), total effectif avec `totalOverride`.
- **Mapping task→ligne** : DAILY / HOURLY / FIXED (règle du CLAUDE.md), label
  `[linearId] title`.
- **Conversion** : refus si non-ACCEPTED, refus si déjà converti (idempotence),
  copie fidèle des lignes, `task.invoiceId` posé sur la facture résultante,
  nouvelle facture DRAFT.
- **Portail public** : 404 générique sur token invalide ; `respond` refusé si
  DRAFT / expiré / déjà répondu / converti ; one-shot ; rate-limit ; aucune fuite
  de données hors devis ciblé.
- **Édge** : suppression d'un devis converti (SetNull, facture conservée) ;
  régénération de token invalide l'ancien.

---

## Hors périmètre (non-goals de ce spec)

- Prospection/CRM amont, Time tracking, Contrats/documents → specs séparés.
- Analytics devis (taux de conversion, « pipeline devis » en attente) → follow-up
  une fois le module en place.
- Web-push sur réponse client → follow-up optionnel.
- Signature électronique / valeur juridique du lien public → non traité.
- PDF du devis (cohérent avec le non-goal PDF facture déjà acté — Abby.fr).
- Hash du `publicToken` au repos → durcissement optionnel futur.
