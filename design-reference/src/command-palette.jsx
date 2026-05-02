// CommandPalette — ⌘K nav modal
// Usage:
//   <CommandPalette commands={...} onClose={...} open={...} />
// or use the built-in trigger: window.__cmdk.open() / .close()
//
// commands: Array<{
//   id, label, hint?, group?, icon?, shortcut?, keywords?, run: () => void
// }>

const { useState: useCMDState, useEffect: useCMDEffect, useRef: useCMDRef, useMemo: useCMDMemo, useCallback: useCMDCallback } = React;

// ---------- Styles (scoped) ----------
const cmdkStyles = `
.cmdk-root { position: fixed; inset: 0; z-index: 9000; display: flex; justify-content: center; align-items: flex-start; padding-top: 14vh; pointer-events: none; font-family: 'Inter', system-ui, sans-serif; }
.cmdk-root.open { pointer-events: auto; }
.cmdk-backdrop { position: absolute; inset: 0; background: oklch(0.08 0.005 240 / 0.55); backdrop-filter: blur(6px) saturate(140%); -webkit-backdrop-filter: blur(6px) saturate(140%); opacity: 0; transition: opacity .18s ease-out; }
.cmdk-root.open .cmdk-backdrop { opacity: 1; }

.cmdk-modal {
  position: relative; width: 640px; max-width: calc(100vw - 32px);
  background: linear-gradient(180deg, oklch(0.22 0.009 240) 0%, oklch(0.20 0.008 240) 100%);
  border: 1px solid oklch(0.40 0.012 240);
  border-radius: 16px;
  box-shadow:
    0 0 0 1px oklch(0.86 0.19 128 / 0.06),
    0 28px 80px rgba(0,0,0,0.55),
    0 8px 24px rgba(0,0,0,0.35),
    inset 0 1px 0 oklch(0.55 0.012 240 / 0.4);
  overflow: hidden;
  transform: translateY(-12px) scale(0.97);
  opacity: 0;
  transition: transform .22s cubic-bezier(.2,.9,.3,1.2), opacity .18s ease-out;
}
.cmdk-root.open .cmdk-modal { transform: translateY(0) scale(1); opacity: 1; }

.cmdk-glow {
  position: absolute; top: -120px; left: 50%; transform: translateX(-50%);
  width: 460px; height: 220px; pointer-events: none;
  background: radial-gradient(closest-side, oklch(0.86 0.19 128 / 0.20), transparent 70%);
  opacity: 0; transition: opacity .35s ease-out .05s;
}
.cmdk-root.open .cmdk-glow { opacity: 1; }

.cmdk-search {
  display: flex; align-items: center; gap: 12px; padding: 16px 18px; position: relative;
  border-bottom: 1px solid oklch(0.32 0.010 240 / 0.6);
}
.cmdk-search-icon { color: oklch(0.58 0.010 240); flex-shrink: 0; }
.cmdk-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: oklch(0.97 0.004 240); font-size: 15px; font-family: inherit; padding: 2px 0;
  letter-spacing: -0.005em;
}
.cmdk-input::placeholder { color: oklch(0.42 0.010 240); }
.cmdk-loading { width: 14px; height: 14px; border-radius: 99px; border: 1.5px solid oklch(0.86 0.19 128 / 0.3); border-top-color: oklch(0.86 0.19 128); animation: cmdk-spin .7s linear infinite; }
@keyframes cmdk-spin { to { transform: rotate(360deg); } }

.cmdk-kbd-hint { display: flex; align-items: center; gap: 4px; color: oklch(0.42 0.010 240); font-size: 11px; }
.cmdk-kbd { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10.5px; padding: 2px 6px; border-radius: 5px; background: oklch(0.27 0.010 240); color: oklch(0.78 0.008 240); border: 1px solid oklch(0.32 0.010 240); line-height: 1; min-width: 16px; text-align: center; }

.cmdk-list { max-height: 380px; overflow-y: auto; padding: 8px; scrollbar-width: thin; }
.cmdk-list::-webkit-scrollbar { width: 6px; }
.cmdk-list::-webkit-scrollbar-thumb { background: oklch(0.30 0.010 240); border-radius: 99px; }

.cmdk-group-label {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
  color: oklch(0.42 0.010 240); padding: 12px 12px 4px; display: flex; align-items: center; justify-content: space-between;
}
.cmdk-group-label:first-child { padding-top: 6px; }

.cmdk-item {
  display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: 9px;
  color: oklch(0.78 0.008 240); cursor: pointer; transition: background .08s, color .08s;
  position: relative; user-select: none;
}
.cmdk-item-icon {
  width: 28px; height: 28px; border-radius: 7px; background: oklch(0.27 0.010 240);
  display: grid; place-items: center; color: oklch(0.78 0.008 240); flex-shrink: 0;
  transition: background .08s, color .08s;
}
.cmdk-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.cmdk-item-label { font-size: 13.5px; font-weight: 500; color: oklch(0.97 0.004 240); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cmdk-item-hint { font-size: 11.5px; color: oklch(0.58 0.010 240); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cmdk-item-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.cmdk-item-shortcut { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; color: oklch(0.58 0.010 240); display: flex; align-items: center; gap: 3px; }
.cmdk-item-enter { opacity: 0; transition: opacity .12s; }

.cmdk-item.active {
  background: oklch(0.86 0.19 128 / 0.10);
  color: oklch(0.97 0.004 240);
}
.cmdk-item.active .cmdk-item-icon { background: oklch(0.86 0.19 128); color: oklch(0.20 0.05 128); }
.cmdk-item.active .cmdk-item-enter { opacity: 1; color: oklch(0.86 0.19 128); }

.cmdk-empty { padding: 48px 20px; text-align: center; color: oklch(0.58 0.010 240); }
.cmdk-empty-glyph { width: 52px; height: 52px; border-radius: 14px; background: oklch(0.27 0.010 240); display: grid; place-items: center; margin: 0 auto 14px; color: oklch(0.42 0.010 240); }
.cmdk-empty-title { color: oklch(0.97 0.004 240); font-weight: 600; font-size: 14px; margin-bottom: 4px; }
.cmdk-empty-sub { font-size: 12.5px; }

.cmdk-footer {
  display: flex; align-items: center; gap: 14px; padding: 10px 16px; border-top: 1px solid oklch(0.32 0.010 240 / 0.6);
  background: oklch(0.18 0.008 240 / 0.6); font-size: 11px; color: oklch(0.58 0.010 240);
}
.cmdk-footer-left { display: flex; align-items: center; gap: 6px; }
.cmdk-footer-brand-mark { width: 16px; height: 16px; border-radius: 4px; background: oklch(0.86 0.19 128); color: oklch(0.20 0.05 128); display: grid; place-items: center; font-family: 'JetBrains Mono'; font-size: 10px; font-weight: 700; }
.cmdk-footer-actions { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.cmdk-footer-action { display: flex; align-items: center; gap: 5px; }

.cmdk-tag { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.04em; }
.cmdk-tag-new { background: oklch(0.86 0.19 128 / 0.16); color: oklch(0.86 0.19 128); }

@media (max-width: 600px) {
  .cmdk-root { padding-top: 8vh; align-items: flex-start; }
  .cmdk-modal { width: calc(100vw - 24px); border-radius: 14px; }
  .cmdk-list { max-height: 60vh; }
  .cmdk-footer { display: none; }
}
`;

// inject styles once
if (typeof document !== 'undefined' && !document.getElementById('cmdk-styles')) {
  const s = document.createElement('style');
  s.id = 'cmdk-styles';
  s.textContent = cmdkStyles;
  document.head.appendChild(s);
}

// ---------- Icons (small inline set, no dep) ----------
function CmdIcon({ name, size = 16 }) {
  const c = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'search': return <svg {...c}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    case 'enter': return <svg {...c}><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>;
    case 'up-down': return <svg {...c}><polyline points="7 17 12 22 17 17"/><polyline points="7 7 12 2 17 7"/></svg>;
    case 'esc': return <svg {...c}><path d="M3 12h18M9 6l-6 6 6 6"/></svg>;
    case 'home': return <svg {...c}><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"/></svg>;
    case 'users': return <svg {...c}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>;
    case 'folder': return <svg {...c}><path d="M4 4h5l2 2.5h9a1.5 1.5 0 0 1 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5h-16A1.5 1.5 0 0 1 2.5 18.5v-13A1.5 1.5 0 0 1 4 4z"/></svg>;
    case 'invoice': return <svg {...c}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>;
    case 'tasks': return <svg {...c}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
    case 'chart': return <svg {...c}><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/></svg>;
    case 'settings': return <svg {...c}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case 'plus': return <svg {...c}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case 'sync': return <svg {...c}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
    case 'logout': return <svg {...c}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    case 'moon': return <svg {...c}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
    case 'sun': return <svg {...c}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>;
    case 'arrow-right': return <svg {...c}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
    case 'doc': return <svg {...c}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
    case 'help': return <svg {...c}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'sparkle': return <svg {...c}><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z"/></svg>;
    default: return <svg {...c}><circle cx="12" cy="12" r="9"/></svg>;
  }
}

// ---------- Fuzzy score ----------
function fuzzyScore(text, q) {
  if (!q) return 1;
  text = text.toLowerCase(); q = q.toLowerCase();
  if (text.includes(q)) return 100 - text.indexOf(q); // substring boost
  let ti = 0, qi = 0, score = 0, streak = 0;
  while (ti < text.length && qi < q.length) {
    if (text[ti] === q[qi]) { qi++; streak++; score += 1 + streak; }
    else { streak = 0; }
    ti++;
  }
  return qi === q.length ? score : 0;
}

// ---------- Component ----------
function CommandPalette({ open, onClose, commands = [], placeholder = 'Tape une commande ou cherche...', loading = false }) {
  const [q, setQ] = useCMDState('');
  const [active, setActive] = useCMDState(0);
  const inputRef = useCMDRef(null);
  const listRef = useCMDRef(null);
  const itemRefs = useCMDRef({});

  // reset on open
  useCMDEffect(() => {
    if (open) {
      setQ(''); setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // filter & group
  const filtered = useCMDMemo(() => {
    if (!q.trim()) return commands.map((c, i) => ({ ...c, _score: 1, _idx: i }));
    return commands
      .map((c) => {
        const hay = [c.label, c.hint, c.group, ...(c.keywords || [])].filter(Boolean).join(' ');
        const score = fuzzyScore(hay, q);
        return { ...c, _score: score };
      })
      .filter((c) => c._score > 0)
      .sort((a, b) => b._score - a._score);
  }, [commands, q]);

  // group by group key, keeping order
  const grouped = useCMDMemo(() => {
    const groups = [];
    const map = {};
    filtered.forEach((c) => {
      const g = c.group || 'Général';
      if (!map[g]) { map[g] = { label: g, items: [] }; groups.push(map[g]); }
      map[g].items.push(c);
    });
    return groups;
  }, [filtered]);

  // flat list for keyboard nav
  const flat = useCMDMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useCMDEffect(() => { setActive(0); }, [q]);

  // keyboard
  useCMDEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flat[active];
        if (cmd) { cmd.run?.(); onClose?.(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, active, onClose]);

  // scroll active into view
  useCMDEffect(() => {
    const el = itemRefs.current[active];
    if (el && listRef.current) {
      const c = listRef.current.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (r.top < c.top) listRef.current.scrollTop -= c.top - r.top + 6;
      else if (r.bottom > c.bottom) listRef.current.scrollTop += r.bottom - c.bottom + 6;
    }
  }, [active]);

  // delayed unmount for exit animation
  const [mounted, setMounted] = useCMDState(open);
  useCMDEffect(() => {
    if (open) setMounted(true);
    else { const t = setTimeout(() => setMounted(false), 220); return () => clearTimeout(t); }
  }, [open]);

  if (!mounted) return null;

  let cursor = -1;

  return (
    <div className={'cmdk-root' + (open ? ' open' : '')} role="dialog" aria-modal="true">
      <div className="cmdk-backdrop" onClick={onClose}></div>
      <div className="cmdk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-glow"></div>
        <div className="cmdk-search">
          <span className="cmdk-search-icon"><CmdIcon name="search" size={18}/></span>
          <input
            ref={inputRef}
            className="cmdk-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
          />
          {loading && <div className="cmdk-loading"></div>}
          <div className="cmdk-kbd-hint">
            <span className="cmdk-kbd">esc</span>
          </div>
        </div>

        <div className="cmdk-list" ref={listRef}>
          {flat.length === 0 ? (
            <div className="cmdk-empty">
              <div className="cmdk-empty-glyph"><CmdIcon name="search" size={22}/></div>
              <div className="cmdk-empty-title">Aucun résultat</div>
              <div className="cmdk-empty-sub">Essaie avec un autre mot-clé</div>
            </div>
          ) : grouped.map((g) => (
            <div key={g.label}>
              <div className="cmdk-group-label">
                <span>{g.label}</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 10, opacity: 0.7 }}>{g.items.length}</span>
              </div>
              {g.items.map((c) => {
                cursor++;
                const idx = cursor;
                const isActive = active === idx;
                return (
                  <div
                    key={c.id}
                    ref={(el) => { itemRefs.current[idx] = el; }}
                    className={'cmdk-item' + (isActive ? ' active' : '')}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => { c.run?.(); onClose?.(); }}
                  >
                    <div className="cmdk-item-icon">
                      <CmdIcon name={c.icon || 'doc'} size={15}/>
                    </div>
                    <div className="cmdk-item-body">
                      <div className="cmdk-item-label">
                        {c.label}
                        {c.tag && <span className="cmdk-tag cmdk-tag-new" style={{ marginLeft: 8 }}>{c.tag}</span>}
                      </div>
                      {c.hint && <div className="cmdk-item-hint">{c.hint}</div>}
                    </div>
                    <div className="cmdk-item-meta">
                      {c.shortcut && (
                        <div className="cmdk-item-shortcut">
                          {c.shortcut.map((k, i) => <span key={i} className="cmdk-kbd">{k}</span>)}
                        </div>
                      )}
                      <span className="cmdk-item-enter"><CmdIcon name="arrow-right" size={14}/></span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="cmdk-footer">
          <div className="cmdk-footer-left">
            <span className="cmdk-footer-brand-mark">F</span>
            <span>FreelanceManager · ⌘K</span>
          </div>
          <div className="cmdk-footer-actions">
            <span className="cmdk-footer-action"><span className="cmdk-kbd">↑</span><span className="cmdk-kbd">↓</span> naviguer</span>
            <span className="cmdk-footer-action"><span className="cmdk-kbd">↵</span> ouvrir</span>
            <span className="cmdk-footer-action"><span className="cmdk-kbd">esc</span> fermer</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Global helper hook — opens on ⌘K / Ctrl+K
function useCommandPalette() {
  const [open, setOpen] = useCMDState(false);
  useCMDEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}

window.CommandPalette = CommandPalette;
window.useCommandPalette = useCommandPalette;
