// ============================================================
// FreelanceManager — Mock data store (in-memory)
// Models: Client, Project, Task (Linear-style), Invoice
// ============================================================

const fmtEUR = (n) => {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
};
const fmtEURprecise = (n) => {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtDateShort = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};
const fmtRelative = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.round((d - now) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "aujourd'hui";
  if (diff === -1) return 'hier';
  if (diff === 1) return 'demain';
  if (diff < 0 && diff >= -7) return `il y a ${-diff}j`;
  if (diff < 0 && diff >= -30) return `il y a ${-Math.round(-diff / 7)} sem`;
  if (diff < 0) return `il y a ${-Math.round(-diff / 30)} mois`;
  if (diff <= 7) return `dans ${diff}j`;
  return fmtDateShort(iso);
};
const initials = (str) => str.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
const avatarColor = (seed) => {
  const colors = [
    'linear-gradient(135deg, oklch(0.6 0.15 250), oklch(0.55 0.18 320))',
    'linear-gradient(135deg, oklch(0.6 0.15 30), oklch(0.55 0.18 60))',
    'linear-gradient(135deg, oklch(0.55 0.16 150), oklch(0.6 0.18 180))',
    'linear-gradient(135deg, oklch(0.55 0.18 280), oklch(0.6 0.16 220))',
    'linear-gradient(135deg, oklch(0.6 0.17 0), oklch(0.55 0.18 350))',
    'linear-gradient(135deg, oklch(0.6 0.14 80), oklch(0.55 0.16 110))',
    'linear-gradient(135deg, oklch(0.55 0.15 200), oklch(0.6 0.18 240))',
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
};

// ---------- Seed data ----------
const seedClients = [
  {
    id: 'c1',
    firstName: 'Henri',
    lastName: 'Mistral',
    company: 'Quintyss Limited',
    email: 'henri@quintyss.io',
    billingType: 'daily', // daily | fixed | hourly
    rate: 650, // €/jour
    tag: 'Freelance',
    color: 'linear-gradient(135deg, oklch(0.6 0.15 250), oklch(0.55 0.18 320))',
    archived: false,
    createdAt: '2025-09-12',
  },
  {
    id: 'c2',
    firstName: 'Coralie',
    lastName: 'Ebring',
    company: 'GYNECOLOGIE RUEIL',
    email: 'c.ebring@gyn-rueil.fr',
    billingType: 'fixed',
    fixedPrice: 8400,
    deposit: 2520, // 30%
    tag: 'Freelance',
    color: 'linear-gradient(135deg, oklch(0.55 0.16 150), oklch(0.6 0.18 180))',
    archived: false,
    createdAt: '2026-01-08',
  },
  {
    id: 'c3',
    firstName: 'Paul',
    lastName: 'Levy',
    company: 'Moduloop',
    email: 'paul@moduloop.app',
    billingType: 'fixed',
    fixedPrice: 12000,
    deposit: 4000,
    tag: 'Freelance',
    color: 'linear-gradient(135deg, oklch(0.55 0.18 280), oklch(0.6 0.16 220))',
    archived: false,
    createdAt: '2026-02-14',
  },
  {
    id: 'c4',
    firstName: 'Tahirihanitra',
    lastName: 'Sambazafi',
    company: 'Hosted',
    email: 'tahiri@hosted.cloud',
    billingType: 'hourly',
    rate: 75,
    tag: 'Freelance',
    color: 'linear-gradient(135deg, oklch(0.6 0.17 0), oklch(0.55 0.18 350))',
    archived: false,
    createdAt: '2026-03-04',
  },
  {
    id: 'c5',
    firstName: 'Léa',
    lastName: 'Garnier',
    company: 'Pivot Studio',
    email: 'lea@pivot.studio',
    billingType: 'daily',
    rate: 580,
    tag: 'Freelance',
    color: 'linear-gradient(135deg, oklch(0.6 0.14 80), oklch(0.55 0.16 110))',
    archived: false,
    createdAt: '2026-03-22',
  },
];

const seedProjects = [
  { id: 'p1', clientId: 'c1', linearId: 'TRI', name: 'quintyss-dashboard', key: 'TRI', desc: 'Refonte du dashboard interne admin', status: 'active', createdAt: '2025-09-15' },
  { id: 'p2', clientId: 'c1', linearId: 'TRI-API', name: 'quintyss-api', key: 'API', desc: 'Migration API v2 + auth', status: 'active', createdAt: '2025-11-02' },
  { id: 'p3', clientId: 'c2', linearId: 'GYN', name: 'gyn-portal-patient', key: 'GYN', desc: 'Portail patient avec prise de rdv', status: 'active', createdAt: '2026-01-10' },
  { id: 'p4', clientId: 'c3', linearId: 'MOD', name: 'moduloop-marketplace', key: 'MOD', desc: 'Marketplace SaaS modulaire', status: 'active', createdAt: '2026-02-15' },
  { id: 'p5', clientId: 'c4', linearId: 'HST', name: 'hosted-dns-tooling', key: 'HST', desc: 'CLI + dashboard pour DNS', status: 'active', createdAt: '2026-03-04' },
  { id: 'p6', clientId: 'c5', linearId: 'PVT', name: 'pivot-website', key: 'PVT', desc: 'Site vitrine + CMS', status: 'paused', createdAt: '2026-03-22' },
];

// Linear-style task statuses we care about: 'pending_invoice' | 'done'
// We also include other statuses for context but they're filtered out of revenue/pipeline.
const taskTitles = {
  TRI: [
    'Layout & colocation per route', 'Forms error UX', 'Translate server errors via error.code',
    'Audit form error UX (invalid input until blur)', 'Inline constants extraction',
    'Replace hex color inputs with Tailwind tokens', 'Backend: add presigned PUT endpoint',
    'Data layer migration', 'Hygiene & safety net', 'Root error.tsx et not-found.tsx',
    'Refactor — vagues admin/support architectural', 'Layout & colocation par route — vague 3',
    'Extraction des constantes inline', 'Empty states pour tableaux principaux', 'Skeleton loaders',
  ],
  API: [
    'JWT refresh strategy', 'Rate limiter Redis', 'Webhook signing v2', 'Migrate /v1/users endpoint',
    'Sentry breadcrumbs cleanup', 'OpenAPI doc regen',
  ],
  GYN: [
    'Page de prise de rdv mobile', 'Auth patient via SMS OTP', 'Calendrier dispo praticiens',
    'Dossier patient — résumé visites', 'Notifications email rappel rdv',
  ],
  MOD: [
    'Onboarding marketplace v2', 'Stripe Connect intégration', 'Module produit "abonnement"',
    'Search Algolia setup', 'Reviews + modération',
  ],
  HST: [
    'CLI: hosted dns import bind', 'Bulk DNS edit UI', 'Audit log per zone', 'API tokens management',
  ],
  PVT: [
    'Hero animation Framer', 'Blog MDX setup',
  ],
};

function genTasks() {
  const tasks = [];
  let n = 500;
  Object.entries(taskTitles).forEach(([key, titles]) => {
    titles.forEach((title, i) => {
      n++;
      const project = seedProjects.find(p => p.key === key);
      // distribution: 40% done, 30% pending_invoice, 20% in_progress, 10% backlog
      let status, completedAt = null;
      const r = Math.random();
      if (r < 0.40) { status = 'done'; completedAt = randomPastDate(60); }
      else if (r < 0.70) { status = 'pending_invoice'; completedAt = randomPastDate(20); }
      else if (r < 0.90) { status = 'in_progress'; }
      else { status = 'backlog'; }
      const estimate = [0.25, 0.5, 0.5, 1, 1, 1, 1.5, 2, 2, 3][Math.floor(Math.random() * 10)];
      tasks.push({
        id: `t-${n}`,
        linearId: `${key}-${n}`,
        projectId: project.id,
        clientId: project.clientId,
        title,
        status, // pending_invoice | done | in_progress | backlog
        estimate, // jours
        completedAt,
        invoiceId: null,
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      });
    });
  });
  return tasks;
}
function randomPastDate(maxDaysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * maxDaysAgo));
  return d.toISOString().slice(0, 10);
}

const seedTasks = genTasks();

// Tag a few "done" tasks as already invoiced via seed invoices below
function buildInvoices(tasks) {
  const invoices = [];
  let invNum = 1024;

  // Helper
  const make = (clientId, projectId, status, issueDate, dueDate, paidDate, lineItems, opts = {}) => {
    invNum++;
    const subtotal = lineItems.reduce((s, l) => s + l.qty * l.rate, 0);
    return {
      id: `inv-${invNum}`,
      number: `${new Date(issueDate).getFullYear()}-${String(invNum).padStart(4, '0')}`,
      clientId, projectId,
      status, // draft | sent | paid | overdue
      kind: opts.kind || 'standard', // 'standard' | 'deposit'
      issueDate, dueDate, paidDate,
      lineItems,
      subtotal,
      tax: 0,
      total: subtotal,
      notes: opts.notes || '',
    };
  };

  // 1) Henri Mistral — TJM, plusieurs factures dont récentes payées
  // Take some done tasks for c1
  const c1Done = tasks.filter(t => t.clientId === 'c1' && t.status === 'done').slice(0, 18);
  if (c1Done.length >= 6) {
    const batch1 = c1Done.slice(0, 6);
    batch1.forEach(t => t.invoiceId = 'will-1');
    const lineItems = batch1.map(t => ({ taskId: t.id, label: `[${t.linearId}] ${t.title}`, qty: t.estimate, rate: 650 }));
    const inv = make('c1', 'p1', 'paid', '2026-02-28', '2026-03-30', '2026-03-12', lineItems);
    inv.id = 'will-1'; invoices.push(inv);
    batch1.forEach(t => t.invoiceId = inv.id);
  }
  if (c1Done.length >= 12) {
    const batch2 = c1Done.slice(6, 12);
    const lineItems = batch2.map(t => ({ taskId: t.id, label: `[${t.linearId}] ${t.title}`, qty: t.estimate, rate: 650 }));
    const inv = make('c1', 'p1', 'paid', '2026-03-31', '2026-04-30', '2026-04-22', lineItems);
    invoices.push(inv);
    batch2.forEach(t => t.invoiceId = inv.id);
  }
  if (c1Done.length >= 18) {
    const batch3 = c1Done.slice(12, 18);
    const lineItems = batch3.map(t => ({ taskId: t.id, label: `[${t.linearId}] ${t.title}`, qty: t.estimate, rate: 650 }));
    const inv = make('c1', 'p1', 'sent', '2026-04-15', '2026-05-15', null, lineItems);
    invoices.push(inv);
    batch3.forEach(t => t.invoiceId = inv.id);
  }

  // 2) Coralie / GYN — Fixed price, deposit + final
  invoices.push(make('c2', 'p3', 'paid', '2026-01-10', '2026-01-25', '2026-01-22',
    [{ taskId: null, label: 'Acompte 30% — Portail patient', qty: 1, rate: 2520 }],
    { kind: 'deposit' }));

  // a "sent overdue" simulating a late one
  const c2Done = tasks.filter(t => t.clientId === 'c2' && t.status === 'done').slice(0, 4);
  if (c2Done.length) {
    const lineItems = c2Done.map(t => ({ taskId: t.id, label: `[${t.linearId}] ${t.title}`, qty: t.estimate, rate: 0 }));
    lineItems.push({ taskId: null, label: 'Forfait étape 1 — Auth + RDV', qty: 1, rate: 3500 });
    const inv = make('c2', 'p3', 'overdue', '2026-03-20', '2026-04-20', null, lineItems);
    invoices.push(inv);
    c2Done.forEach(t => t.invoiceId = inv.id);
  }

  // 3) Paul Levy / Moduloop — Fixed, deposit paid, then sent in progress
  invoices.push(make('c3', 'p4', 'paid', '2026-02-15', '2026-03-01', '2026-02-28',
    [{ taskId: null, label: 'Acompte 33% — Marketplace v2', qty: 1, rate: 4000 }],
    { kind: 'deposit' }));
  invoices.push(make('c3', 'p4', 'sent', '2026-04-10', '2026-05-10', null,
    [{ taskId: null, label: 'Étape 1 — Onboarding + Stripe Connect', qty: 1, rate: 4000 }]));

  // 4) Tahiri / Hosted — Hourly
  const c4Done = tasks.filter(t => t.clientId === 'c4' && t.status === 'done').slice(0, 3);
  if (c4Done.length) {
    const lineItems = c4Done.map(t => ({ taskId: t.id, label: `[${t.linearId}] ${t.title}`, qty: t.estimate * 8, rate: 75 }));
    const inv = make('c4', 'p5', 'paid', '2026-03-31', '2026-04-15', '2026-04-10', lineItems);
    invoices.push(inv);
    c4Done.forEach(t => t.invoiceId = inv.id);
  }

  // 5) draft for Léa
  invoices.push(make('c5', 'p6', 'draft', '2026-04-22', '2026-05-22', null,
    [{ taskId: null, label: 'Hero animation', qty: 2, rate: 580 }]));

  return invoices;
}

const seedInvoices = buildInvoices(seedTasks);

// ---------- Store ----------
const Store = {
  clients: seedClients,
  projects: seedProjects,
  tasks: seedTasks,
  invoices: seedInvoices,
  lastSync: '2026-04-30T16:42:00',
  me: { name: 'Tristan Hourtoulle', email: 'tristan@freelance.app' },
};

// expose for other scripts
window.FM = {
  Store,
  fmtEUR, fmtEURprecise, fmtDate, fmtDateShort, fmtRelative,
  initials, avatarColor,
};
