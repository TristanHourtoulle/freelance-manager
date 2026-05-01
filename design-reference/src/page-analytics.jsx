// Analytics page
function PageAnalytics({ navigate, store }) {
  const { fmtEUR, fmtDate, initials } = window.FM;
  const [range, setRange] = useState('12m');

  const today = new Date('2026-04-30');
  const paid = store.invoices.filter(i => i.status === 'paid');
  const sent = store.invoices.filter(i => i.status === 'sent' || i.status === 'overdue');

  const monthsCount = range === '3m' ? 3 : range === '6m' ? 6 : 12;
  const months = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    const paidTotal = paid.filter(inv => { const d = new Date(inv.paidDate); return d >= start && d < end; }).reduce((s, i) => s + i.total, 0);
    const issuedTotal = store.invoices.filter(inv => { const d = new Date(inv.issueDate); return d >= start && d < end; }).reduce((s, i) => s + i.total, 0);
    months.push({
      label: start.toLocaleDateString('fr-FR', { month: 'short' }),
      paid: paidTotal,
      issued: issuedTotal,
      isCurrent: i === 0,
    });
  }
  // Synthesize realistic data if values are too sparse
  const seedRev = [3200, 4100, 3800, 5600, 4900, 6200, 5400, 7100, 6800, 8200, 7800, 9100];
  months.forEach((m, i) => {
    if (m.paid === 0) m.paid = seedRev[(i + 12 - monthsCount) % 12];
    if (m.issued === 0) m.issued = m.paid + 500 + Math.round(Math.random() * 1500);
  });

  const totalRevenue = months.reduce((s, m) => s + m.paid, 0);
  const avgRevenue = Math.round(totalRevenue / months.length);
  const lastMonth = months[months.length - 1].paid;
  const prevMonth = months[months.length - 2]?.paid || lastMonth;
  const trend = prevMonth ? Math.round(((lastMonth - prevMonth) / prevMonth) * 100) : 0;

  // Client mix
  const byClient = store.clients.map(c => {
    const r = paid.filter(i => i.clientId === c.id).reduce((s, i) => s + i.total, 0);
    return { client: c, revenue: r };
  }).filter(x => x.revenue > 0).sort((a, b) => b.revenue - a.revenue);
  // ensure some signal
  if (byClient.length === 0) {
    store.clients.slice(0, 4).forEach((c, i) => byClient.push({ client: c, revenue: [12400, 8200, 5400, 3100][i] || 1500 }));
  }
  const totalClients = byClient.reduce((s, x) => s + x.revenue, 0);

  // Billing type mix
  const byType = ['daily', 'fixed', 'hourly'].map(t => {
    const cs = store.clients.filter(c => c.billingType === t).map(c => c.id);
    const r = byClient.filter(x => cs.includes(x.client.id)).reduce((s, x) => s + x.revenue, 0);
    return { type: t, revenue: r };
  });
  const totalByType = byType.reduce((s, x) => s + x.revenue, 0) || 1;

  // Tasks throughput last 12 weeks (synth)
  const weeks = Array.from({ length: 12 }, (_, i) => ({
    label: `S${i + 18}`,
    done: 6 + Math.round(Math.sin(i / 2) * 4) + Math.round(Math.random() * 6),
    invoiced: 4 + Math.round(Math.cos(i / 2) * 3) + Math.round(Math.random() * 5),
  }));

  // Avg payment delay
  const delays = paid.filter(i => i.paidDate && i.issueDate).map(i => {
    return Math.round((new Date(i.paidDate) - new Date(i.issueDate)) / (1000 * 60 * 60 * 24));
  });
  const avgDelay = delays.length ? Math.round(delays.reduce((s, d) => s + d, 0) / delays.length) : 18;

  return (
    <div className="page" style={{ maxWidth: 1500 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <div className="page-sub">Performances financières · {monthsCount} derniers mois</div>
        </div>
        <div className="page-actions">
          <div className="ana-rangepicker">
            {['3m', '6m', '12m'].map(r => (
              <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r === '3m' ? '3 mois' : r === '6m' ? '6 mois' : '12 mois'}</button>
            ))}
          </div>
          <button className="btn btn-secondary"><I name="download" size={14} />Export</button>
        </div>
      </div>

      {/* Hero */}
      <div className="ana-hero">
        <div className="ana-hero-content">
          <div>
            <div className="row gap-8" style={{ marginBottom: 6 }}>
              <span className="auth-eyebrow" style={{ margin: 0 }}><I name="chart" size={11} />Revenu total · {monthsCount}M</span>
              <span className={'kpi-trend ' + (trend >= 0 ? 'up' : 'down')}><I name={trend >= 0 ? 'arrow-up' : 'arrow-down'} size={10} />{trend >= 0 ? '+' : ''}{trend}%</span>
            </div>
            <h2 className="ana-headline">Tu encaisses</h2>
            <div className="ana-bigfig">{fmtEUR(totalRevenue)}</div>
            <div className="row gap-16 small muted" style={{ marginTop: 14 }}>
              <span><I name="euro" size={11} /> Moyenne {fmtEUR(avgRevenue)}/mois</span>
              <span><I name="clock" size={11} /> Délai moyen de paiement {avgDelay}j</span>
              <span><I name="invoice" size={11} /> {paid.length} factures payées</span>
            </div>
          </div>
          <Sparkline data={months.map(m => m.paid)} width={220} height={64} />
        </div>
      </div>

      {/* Row 1: big chart + breakdowns */}
      <div className="ana-grid ana-grid-3" style={{ marginBottom: 16 }}>
        <div className="ana-card" style={{ gridColumn: '1 / -1' }}>
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Revenu vs Facturation</h3>
              <div className="ana-card-sub">Comparaison mensuelle · payé (encaissé) vs émis</div>
            </div>
            <div className="legend">
              <span><span className="legend-dot" style={{ background: 'var(--accent)' }}></span>Payé</span>
              <span><span className="legend-dot" style={{ background: 'var(--info)' }}></span>Émis</span>
            </div>
          </div>
          <DualChart months={months} />
        </div>
      </div>

      <div className="ana-grid ana-grid-3" style={{ marginBottom: 16 }}>
        <div className="ana-card">
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Top clients</h3>
              <div className="ana-card-sub">Revenu cumulé par client</div>
            </div>
          </div>
          <div>
            {byClient.slice(0, 5).map((x, i) => (
              <div key={x.client.id} className="top-row">
                <div className="av av-sm" style={{ background: x.client.color }}>{initials(`${x.client.firstName} ${x.client.lastName}`)}</div>
                <div>
                  <div className="strong small">{x.client.company}</div>
                  <div className="xs muted">{x.client.firstName} {x.client.lastName}</div>
                </div>
                <div className="top-bar-bg" style={{ width: 100 }}>
                  <div className="top-bar-fill" style={{ width: `${(x.revenue / byClient[0].revenue) * 100}%`, background: i === 0 ? 'var(--accent)' : i === 1 ? 'var(--info)' : 'var(--purple)' }}></div>
                </div>
                <div className="num strong" style={{ minWidth: 80, textAlign: 'right' }}>{fmtEUR(x.revenue)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="ana-card">
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Mix par type</h3>
              <div className="ana-card-sub">Part de revenu</div>
            </div>
          </div>
          <Donut segments={byType.map((b, i) => ({
            label: b.type === 'daily' ? 'TJM' : b.type === 'fixed' ? 'Forfait' : 'Horaire',
            value: b.revenue,
            color: ['oklch(0.86 0.19 128)', 'oklch(0.75 0.15 300)', 'oklch(0.78 0.13 180)'][i],
          })).filter(s => s.value > 0)} total={totalByType} format={fmtEUR} />
        </div>

        <div className="ana-card">
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Métriques clés</h3>
              <div className="ana-card-sub">Sur la période</div>
            </div>
          </div>
          <div>
            <div className="ana-metric">
              <div className="ana-metric-row"><span className="ana-metric-label">Délai moyen de paiement</span><span className="ana-metric-value">{avgDelay} <span className="muted small">j</span></span></div>
              <div className="row gap-4 xs" style={{ color: 'var(--accent)' }}><I name="arrow-down" size={10} />2j vs période précédente</div>
            </div>
            <div className="ana-metric">
              <div className="ana-metric-row"><span className="ana-metric-label">Panier moyen / facture</span><span className="ana-metric-value">{fmtEUR(Math.round(totalRevenue / Math.max(paid.length, 1)))}</span></div>
              <div className="row gap-4 xs muted">{paid.length} factures payées</div>
            </div>
            <div className="ana-metric">
              <div className="ana-metric-row"><span className="ana-metric-label">Taux de conversion</span><span className="ana-metric-value">{Math.round((paid.length / Math.max(paid.length + sent.length, 1)) * 100)}%</span></div>
              <div className="row gap-4 xs muted">tasks done → factures payées</div>
            </div>
            <div className="ana-metric">
              <div className="ana-metric-row"><span className="ana-metric-label">Run-rate annuel</span><span className="ana-metric-value">{fmtEUR(avgRevenue * 12)}</span></div>
              <div className="row gap-4 xs" style={{ color: 'var(--accent)' }}><I name="arrow-up" size={10} />Sur la moyenne récente</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="ana-grid ana-grid-2">
        <div className="ana-card">
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Throughput tasks</h3>
              <div className="ana-card-sub">Tasks terminées vs facturées · 12 dernières semaines</div>
            </div>
            <div className="legend">
              <span><span className="legend-dot" style={{ background: 'var(--accent)' }}></span>Done</span>
              <span><span className="legend-dot" style={{ background: 'var(--purple)' }}></span>Facturée</span>
            </div>
          </div>
          <ThroughputChart weeks={weeks} />
        </div>

        <div className="ana-card">
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Activité hebdomadaire</h3>
              <div className="ana-card-sub">Heatmap tasks terminées</div>
            </div>
          </div>
          <ActivityHeatmap />
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, width = 220, height = 64 }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => [i * stepX, height - ((v - min) / span) * (height - 8) - 4]);
  const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ` L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg className="ana-spark" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.86 0.19 128)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.86 0.19 128)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkfill)" />
      <path d={path} fill="none" stroke="oklch(0.86 0.19 128)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => i === points.length - 1 && (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="6" fill="oklch(0.86 0.19 128)" opacity="0.2" />
          <circle cx={p[0]} cy={p[1]} r="3.5" fill="oklch(0.86 0.19 128)" />
        </g>
      ))}
    </svg>
  );
}

function DualChart({ months }) {
  const max = Math.max(...months.flatMap(m => [m.paid, m.issued]), 1);
  const W = 900, H = 280, padL = 50, padR = 16, padT = 16, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const stepX = innerW / months.length;
  const barW = stepX * 0.32;

  const ticks = 5;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((max * i) / ticks));

  // smoothed line for issued
  const linePts = months.map((m, i) => [
    padL + i * stepX + stepX / 2,
    padT + innerH - (m.issued / max) * innerH,
  ]);
  const linePath = linePts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 280 }}>
      <defs>
        <linearGradient id="barpaid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.86 0.19 128)" stopOpacity="1" />
          <stop offset="100%" stopColor="oklch(0.86 0.19 128)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {tickVals.map((t, i) => {
        const y = padT + innerH - (innerH * i) / ticks;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="oklch(0.32 0.010 240 / 0.4)" strokeDasharray={i === 0 ? '' : '2 4'} />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="oklch(0.58 0.010 240)" fontFamily="JetBrains Mono">
              {t >= 1000 ? (t / 1000).toFixed(0) + 'k' : t}
            </text>
          </g>
        );
      })}
      {months.map((m, i) => {
        const x = padL + i * stepX + (stepX - barW) / 2;
        const h = (m.paid / max) * innerH;
        const y = padT + innerH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx="3" fill="url(#barpaid)" />
            <text x={padL + i * stepX + stepX / 2} y={H - padB + 18} textAnchor="middle" fontSize="11" fill={m.isCurrent ? 'var(--text-0)' : 'oklch(0.58 0.010 240)'} fontWeight={m.isCurrent ? 600 : 400}>{m.label}</text>
          </g>
        );
      })}
      <path d={linePath} fill="none" stroke="oklch(0.78 0.13 240)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {linePts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="oklch(0.20 0.01 240)" stroke="oklch(0.78 0.13 240)" strokeWidth="2" />
      ))}
    </svg>
  );
}

function Donut({ segments, total, format }) {
  if (!segments.length) return <div className="muted">Pas encore de données</div>;
  const size = 160, stroke = 22, r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * C;
          const offset = -acc * C;
          acc += frac;
          return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={offset} strokeLinecap="butt" />;
        })}
        <g transform={`rotate(90 ${size / 2} ${size / 2})`}>
          <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="11" fill="oklch(0.58 0.010 240)">Total</text>
          <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize="16" fontWeight="700" fontFamily="JetBrains Mono" fill="oklch(0.97 0.004 240)">{format(total).replace(/\u202f/g, ' ')}</text>
        </g>
      </svg>
      <div className="donut-rows">
        {segments.map((s, i) => (
          <div key={i} className="donut-row">
            <span className="legend-dot" style={{ background: s.color }}></span>
            <span className="lbl">{s.label}<div className="xs muted">{Math.round((s.value / total) * 100)}%</div></span>
            <span className="val">{format(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThroughputChart({ weeks }) {
  const max = Math.max(...weeks.flatMap(w => [w.done, w.invoiced]), 1);
  const W = 600, H = 220, padL = 30, padR = 16, padT = 16, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const stepX = innerW / weeks.length;
  const barW = stepX * 0.36;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = padT + innerH - innerH * t;
        return <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="oklch(0.32 0.010 240 / 0.3)" strokeDasharray={t === 0 ? '' : '2 4'} />;
      })}
      {weeks.map((w, i) => {
        const xBase = padL + i * stepX + stepX / 2;
        const hd = (w.done / max) * innerH;
        const hi = (w.invoiced / max) * innerH;
        return (
          <g key={i}>
            <rect x={xBase - barW - 1} y={padT + innerH - hd} width={barW} height={hd} rx="2" fill="oklch(0.86 0.19 128)" />
            <rect x={xBase + 1} y={padT + innerH - hi} width={barW} height={hi} rx="2" fill="oklch(0.75 0.15 300)" />
          </g>
        );
      })}
    </svg>
  );
}

function ActivityHeatmap() {
  // 7 cols (days) × 12 rows (weeks)
  const cells = [];
  for (let w = 0; w < 12; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      const intensity = Math.max(0, Math.round(Math.random() * 4) - (d === 6 || d === 5 ? 2 : 0));
      row.push(intensity);
    }
    cells.push(row);
  }
  const colors = ['var(--bg-3)', 'oklch(0.86 0.19 128 / 0.25)', 'oklch(0.86 0.19 128 / 0.5)', 'oklch(0.86 0.19 128 / 0.75)', 'oklch(0.86 0.19 128)'];
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 6 }}>
        <div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="xs muted" style={{ textAlign: 'center' }}>{i % 3 === 0 ? `S${18 + i}` : ''}</div>)}
        </div>
      </div>
      {days.map((d, di) => (
        <div key={d} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 6, marginTop: 4 }}>
          <div className="xs muted" style={{ alignSelf: 'center' }}>{d}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
            {cells.map((row, wi) => (
              <div key={wi} className="heat-cell" style={{ background: colors[row[di]] }} title={`${row[di]} tasks`}></div>
            ))}
          </div>
        </div>
      ))}
      <div className="row gap-8" style={{ marginTop: 14, justifyContent: 'flex-end', fontSize: 11, color: 'var(--text-2)' }}>
        <span>Moins</span>
        {colors.map((c, i) => <div key={i} style={{ width: 12, height: 12, background: c, borderRadius: 3 }}></div>)}
        <span>Plus</span>
      </div>
    </div>
  );
}

window.PageAnalytics = PageAnalytics;
