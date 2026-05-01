// ============================================================
// Toast — standalone module, drop-in replacement for Sonner
// Exposes: window.Toaster (component) + window.toast (API)
//
// Usage:
//   1. Mount <Toaster /> once at app root (with optional `position`)
//   2. Call toast.success('msg'), toast.error(...), toast.info(...),
//      toast.warning(...), toast.loading(...), toast.custom(...),
//      toast.promise(p, { loading, success, error })
//   3. toast.dismiss(id?) to clear one or all
//
// Variants returned id (number) so caller can dismiss programmatically.
// Auto-detects mobile (<= 600px) and switches to bottom-fullwidth.
// ============================================================

(() => {
  const { useState, useEffect, useRef, useCallback, useLayoutEffect } = React;

  // -------- Internal subscriber store --------
  let _id = 0;
  const _listeners = new Set();
  const _state = { toasts: [] };

  function emit() { _listeners.forEach(l => l([..._state.toasts])); }

  function add(t) {
    const id = t.id != null ? t.id : ++_id;
    const idx = _state.toasts.findIndex(x => x.id === id);
    const toast = {
      id,
      type: 'default',
      duration: 4500,
      dismissible: true,
      createdAt: Date.now(),
      ...t,
    };
    if (idx >= 0) _state.toasts[idx] = { ..._state.toasts[idx], ...toast };
    else _state.toasts.push(toast);
    emit();
    return id;
  }

  function remove(id) {
    if (id == null) { _state.toasts = []; emit(); return; }
    _state.toasts = _state.toasts.filter(t => t.id !== id);
    emit();
  }

  function update(id, patch) {
    const idx = _state.toasts.findIndex(t => t.id === id);
    if (idx < 0) return;
    _state.toasts[idx] = { ..._state.toasts[idx], ...patch };
    emit();
  }

  // -------- Public API --------
  const toast = (msg, opts = {}) => add({ type: 'default', message: msg, ...opts });
  toast.success = (msg, opts = {}) => add({ type: 'success', message: msg, ...opts });
  toast.error = (msg, opts = {}) => add({ type: 'error', message: msg, ...opts });
  toast.warning = (msg, opts = {}) => add({ type: 'warning', message: msg, ...opts });
  toast.info = (msg, opts = {}) => add({ type: 'info', message: msg, ...opts });
  toast.loading = (msg, opts = {}) => add({ type: 'loading', message: msg, duration: Infinity, ...opts });
  toast.custom = (render, opts = {}) => add({ type: 'custom', render, ...opts });
  toast.dismiss = (id) => remove(id);
  toast.promise = (p, msgs = {}) => {
    const id = add({ type: 'loading', message: msgs.loading || 'Chargement…', duration: Infinity });
    Promise.resolve(p).then((data) => {
      const m = typeof msgs.success === 'function' ? msgs.success(data) : msgs.success;
      update(id, { type: 'success', message: m || 'Terminé', duration: 4000, createdAt: Date.now() });
    }).catch((err) => {
      const m = typeof msgs.error === 'function' ? msgs.error(err) : msgs.error;
      update(id, { type: 'error', message: m || 'Erreur', duration: 5500, createdAt: Date.now() });
    });
    return id;
  };

  // -------- Hook --------
  function useToasts() {
    const [list, setList] = useState(_state.toasts);
    useEffect(() => { _listeners.add(setList); return () => _listeners.delete(setList); }, []);
    return list;
  }

  // -------- Icon helpers --------
  const ICON_PROPS = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const Icons = {
    success: () => <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" opacity="0.18"/><polyline points="8 12.5 11 15.5 16 9.5" stroke="currentColor"/></svg>,
    error: () => <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" opacity="0.18"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>,
    warning: () => <svg {...ICON_PROPS}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="currentColor" stroke="none" opacity="0.18"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13.5"/><line x1="12" y1="16.8" x2="12.01" y2="16.8"/></svg>,
    info: () => <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" opacity="0.18"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="currentColor"/></svg>,
    loading: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'tspin 0.9s linear infinite' }}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.4"/>
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
      </svg>
    ),
    close: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  };

  // -------- ToastItem --------
  function ToastItem({ data, onDismiss, mobile }) {
    const ref = useRef(null);
    const [phase, setPhase] = useState('enter'); // enter | live | exit
    const [paused, setPaused] = useState(false);
    const [drag, setDrag] = useState(0);
    const startX = useRef(0);
    const startY = useRef(0);
    const dragging = useRef(false);
    const startedAt = useRef(Date.now());
    const remainingRef = useRef(data.duration);

    // mount: trigger entry transition (next frame)
    useLayoutEffect(() => {
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('live')));
      return () => cancelAnimationFrame(r);
    }, []);

    // auto-dismiss
    useEffect(() => {
      if (data.duration === Infinity) return;
      if (paused) return;
      startedAt.current = Date.now();
      const t = setTimeout(() => beginExit(), remainingRef.current);
      return () => {
        clearTimeout(t);
        remainingRef.current = remainingRef.current - (Date.now() - startedAt.current);
      };
    }, [paused, data.duration, data.id, data.type]);

    // reset duration on type change (for promise)
    useEffect(() => {
      remainingRef.current = data.duration;
    }, [data.type, data.duration]);

    const beginExit = useCallback(() => {
      setPhase('exit');
      setTimeout(() => onDismiss(data.id), 280);
    }, [data.id, onDismiss]);

    // swipe handlers
    const onPointerDown = (e) => {
      if (!data.dismissible) return;
      dragging.current = true;
      startX.current = e.clientX;
      startY.current = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!dragging.current) return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;
      // mobile bottom: only allow down or sideways; desktop top-right: allow horizontal
      if (mobile) {
        if (dy > 0 || Math.abs(dx) > Math.abs(dy)) setDrag(mobile ? Math.max(dx, 0) ? dx : dy : dx);
        else setDrag(0);
      } else {
        setDrag(dx);
      }
    };
    const onPointerUp = () => {
      dragging.current = false;
      const threshold = 80;
      if (Math.abs(drag) > threshold) beginExit();
      else setDrag(0);
    };

    const isLoading = data.type === 'loading';
    const Icon = Icons[data.type] || (() => null);

    const cls = ['toast-item', `t-${data.type}`, `phase-${phase}`, mobile ? 'is-mobile' : 'is-desktop', paused ? 'paused' : ''].join(' ');
    const dragOpacity = Math.max(0, 1 - Math.abs(drag) / 220);
    const transform = drag !== 0 ? `translate3d(${mobile ? 0 : drag}px, ${mobile ? Math.max(drag, 0) : 0}px, 0)` : undefined;

    return (
      <div
        ref={ref}
        className={cls}
        style={{ transform, opacity: drag !== 0 ? dragOpacity : undefined }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="status"
        aria-live={data.type === 'error' ? 'assertive' : 'polite'}
      >
        {data.type === 'custom' && data.render ? (
          <div className="toast-custom-wrap">{data.render({ id: data.id, dismiss: () => beginExit() })}</div>
        ) : (
          <>
            <div className="toast-accent"></div>
            <div className="toast-icon"><Icon /></div>
            <div className="toast-body">
              {data.title && <div className="toast-title">{data.title}</div>}
              <div className="toast-msg">{data.message}</div>
              {data.description && <div className="toast-desc">{data.description}</div>}
              {data.action && (
                <button className="toast-action" onClick={(e) => {
                  e.stopPropagation();
                  data.action.onClick && data.action.onClick();
                  if (data.action.dismiss !== false) beginExit();
                }}>{data.action.label}</button>
              )}
            </div>
            {data.dismissible && !isLoading && (
              <button className="toast-close" onClick={(e) => { e.stopPropagation(); beginExit(); }} aria-label="Fermer">
                <Icons.close />
              </button>
            )}
            {!isLoading && data.duration !== Infinity && (
              <div className="toast-progress">
                <div className="toast-progress-bar" style={{ animationDuration: `${data.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}></div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // -------- Toaster (root) --------
  function Toaster({ position = 'top-right', mobilePosition = 'bottom', mobileBreakpoint = 600, maxVisible = 5 }) {
    const list = useToasts();
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= mobileBreakpoint);
    useEffect(() => {
      const onResize = () => setIsMobile(window.innerWidth <= mobileBreakpoint);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, [mobileBreakpoint]);

    const visible = list.slice(-maxVisible);
    const pos = isMobile ? mobilePosition : position;

    return (
      <div className={`toast-viewport pos-${pos} ${isMobile ? 'mobile' : 'desktop'}`} aria-label="Notifications">
        {visible.map((t) => (
          <ToastItem key={t.id} data={t} onDismiss={remove} mobile={isMobile} />
        ))}
      </div>
    );
  }

  // -------- Inject styles once --------
  if (!document.getElementById('toast-styles')) {
    const s = document.createElement('style');
    s.id = 'toast-styles';
    s.textContent = `
@keyframes tspin { to { transform: rotate(360deg); } }
@keyframes tprogress { from { transform: scaleX(1); } to { transform: scaleX(0); } }

.toast-viewport {
  position: fixed; z-index: 9999; pointer-events: none;
  display: flex; flex-direction: column; gap: 10px;
  font-family: 'Inter', system-ui, sans-serif;
}
.toast-viewport.pos-top-right { top: 18px; right: 18px; align-items: flex-end; flex-direction: column; }
.toast-viewport.pos-top-left { top: 18px; left: 18px; align-items: flex-start; flex-direction: column; }
.toast-viewport.pos-top-center { top: 18px; left: 50%; transform: translateX(-50%); align-items: center; flex-direction: column; }
.toast-viewport.pos-bottom-right { bottom: 18px; right: 18px; align-items: flex-end; flex-direction: column-reverse; }
.toast-viewport.pos-bottom-left { bottom: 18px; left: 18px; align-items: flex-start; flex-direction: column-reverse; }
.toast-viewport.pos-bottom { bottom: 18px; left: 12px; right: 12px; flex-direction: column-reverse; align-items: stretch; }
.toast-viewport.pos-top { top: 18px; left: 12px; right: 12px; flex-direction: column; align-items: stretch; }
.toast-viewport.mobile.pos-bottom { bottom: max(18px, env(safe-area-inset-bottom, 18px)); }

.toast-item {
  pointer-events: auto;
  position: relative;
  display: flex; align-items: flex-start; gap: 12px;
  min-width: 320px; max-width: 420px;
  padding: 13px 38px 13px 16px;
  background: oklch(0.22 0.008 240 / 0.92);
  border: 1px solid oklch(0.34 0.010 240 / 0.7);
  border-radius: 12px;
  box-shadow:
    0 1px 0 oklch(1 0 0 / 0.04) inset,
    0 6px 16px rgba(0,0,0,0.28),
    0 18px 36px rgba(0,0,0,0.32);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  color: oklch(0.97 0.004 240);
  overflow: hidden;
  font-size: 13.5px;
  line-height: 1.45;
  transition: transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 220ms ease, scale 380ms cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform, opacity;
  touch-action: pan-y;
}
.toast-item.is-mobile { width: 100%; max-width: 100%; min-width: 0; touch-action: pan-x pan-y; }

/* Phases — entry comes from the side with a tilt (creative spring) */
.toast-viewport.pos-top-right .toast-item.phase-enter { transform: translate3d(60px, -10px, 0) rotate(3deg) scale(0.94); opacity: 0; }
.toast-viewport.pos-top-left .toast-item.phase-enter { transform: translate3d(-60px, -10px, 0) rotate(-3deg) scale(0.94); opacity: 0; }
.toast-viewport.pos-top-center .toast-item.phase-enter { transform: translate3d(0, -30px, 0) scale(0.9); opacity: 0; }
.toast-viewport.pos-bottom-right .toast-item.phase-enter { transform: translate3d(60px, 10px, 0) rotate(3deg) scale(0.94); opacity: 0; }
.toast-viewport.pos-bottom-left .toast-item.phase-enter { transform: translate3d(-60px, 10px, 0) rotate(-3deg) scale(0.94); opacity: 0; }
.toast-viewport.pos-bottom .toast-item.phase-enter { transform: translate3d(0, 100%, 0) scale(0.96); opacity: 0; }
.toast-viewport.pos-top .toast-item.phase-enter { transform: translate3d(0, -100%, 0) scale(0.96); opacity: 0; }
.toast-item.phase-live { transform: translate3d(0,0,0) rotate(0) scale(1); opacity: 1; }
.toast-item.phase-exit { transition: transform 240ms ease-in, opacity 240ms ease-in; opacity: 0; transform: translate3d(0, -8px, 0) scale(0.92); }
.toast-viewport.pos-bottom .toast-item.phase-exit { transform: translate3d(0, 100%, 0) scale(0.96); }
.toast-viewport.pos-top-right .toast-item.phase-exit, .toast-viewport.pos-bottom-right .toast-item.phase-exit { transform: translate3d(80px, 0, 0) scale(0.94); }

/* Type accents */
.toast-item .toast-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: oklch(0.86 0.19 128); }
.toast-item.t-success .toast-accent { background: oklch(0.86 0.19 128); }
.toast-item.t-error .toast-accent { background: oklch(0.70 0.20 25); }
.toast-item.t-warning .toast-accent { background: oklch(0.78 0.16 55); }
.toast-item.t-info .toast-accent { background: oklch(0.78 0.13 240); }
.toast-item.t-loading .toast-accent { background: oklch(0.65 0.02 240); }
.toast-item.t-default .toast-accent { display: none; }
.toast-item.t-custom .toast-accent { display: none; }

.toast-item .toast-icon { flex-shrink: 0; padding-top: 1px; }
.toast-item.t-success .toast-icon { color: oklch(0.86 0.19 128); }
.toast-item.t-error .toast-icon { color: oklch(0.78 0.18 25); }
.toast-item.t-warning .toast-icon { color: oklch(0.82 0.15 60); }
.toast-item.t-info .toast-icon { color: oklch(0.82 0.13 240); }
.toast-item.t-loading .toast-icon { color: oklch(0.78 0.008 240); }

.toast-body { flex: 1; min-width: 0; }
.toast-title { font-weight: 600; font-size: 13.5px; margin-bottom: 2px; letter-spacing: -0.005em; }
.toast-msg { font-weight: 500; word-wrap: break-word; }
.toast-desc { color: oklch(0.72 0.008 240); font-size: 12.5px; margin-top: 4px; line-height: 1.4; }
.toast-action {
  margin-top: 8px;
  background: oklch(0.30 0.010 240); color: oklch(0.97 0.004 240);
  border: 1px solid oklch(0.40 0.012 240);
  padding: 5px 11px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: inherit; transition: background 0.12s;
}
.toast-action:hover { background: oklch(0.36 0.010 240); }
.toast-item.t-success .toast-action { background: oklch(0.86 0.19 128 / 0.16); border-color: oklch(0.86 0.19 128 / 0.4); color: oklch(0.86 0.19 128); }
.toast-item.t-error .toast-action { background: oklch(0.70 0.20 25 / 0.16); border-color: oklch(0.70 0.20 25 / 0.4); color: oklch(0.78 0.18 25); }

.toast-close {
  position: absolute; top: 9px; right: 9px;
  width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center;
  color: oklch(0.58 0.010 240); cursor: pointer; transition: background 0.12s, color 0.12s;
  background: transparent; border: none; padding: 0;
  opacity: 0; pointer-events: none;
}
.toast-item:hover .toast-close, .toast-item.is-mobile .toast-close { opacity: 1; pointer-events: auto; }
.toast-close:hover { background: oklch(0.30 0.010 240); color: oklch(0.97 0.004 240); }

.toast-progress {
  position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
  background: oklch(0.30 0.010 240 / 0.5);
  overflow: hidden;
}
.toast-progress-bar {
  height: 100%;
  background: oklch(0.86 0.19 128);
  transform-origin: left;
  animation: tprogress linear forwards;
}
.toast-item.t-error .toast-progress-bar { background: oklch(0.70 0.20 25); }
.toast-item.t-warning .toast-progress-bar { background: oklch(0.78 0.16 55); }
.toast-item.t-info .toast-progress-bar { background: oklch(0.78 0.13 240); }
.toast-item.t-default .toast-progress-bar { background: oklch(0.65 0.05 240); }

.toast-custom-wrap { width: 100%; }

@media (prefers-reduced-motion: reduce) {
  .toast-item, .toast-item.phase-enter, .toast-item.phase-exit {
    transition-duration: 0ms !important;
    transform: none !important;
  }
  .toast-progress-bar { animation: none; }
}
`;
    document.head.appendChild(s);
  }

  window.toast = toast;
  window.Toaster = Toaster;
})();
