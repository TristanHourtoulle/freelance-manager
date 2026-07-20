"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { fmtRelative } from "@/lib/format"
import {
  usePushStatus,
  useSendTestPush,
  useSubscribePush,
  useUnsubscribePush,
} from "@/hooks/use-push"

/**
 * Réglages card managing the daily push digest.
 *
 * Exposes a manual test send and the last delivery date on purpose: browsers,
 * iOS in particular, drop push subscriptions silently, and a subscription that
 * looks alive but is dead is worse than none.
 */
export function PushNotificationsCard() {
  const { data: status, isPending } = usePushStatus()
  const subscribe = useSubscribePush()
  const unsubscribe = useUnsubscribePush()
  const sendTest = useSendTestPush()
  const [isConfirmingDisable, setIsConfirmingDisable] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsBlocked(Notification.permission === "denied")
  }, [])

  const isConfigured = status?.configured ?? false
  const isSubscribed = status?.subscribed ?? false

  return (
    <div className="card">
      <div className="row gap-12" style={{ marginBottom: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 9,
            background: "var(--accent-soft)",
            display: "grid",
            placeItems: "center",
            color: "var(--accent)",
          }}
        >
          <Icon name="bell" size={18} />
        </div>
        <div className="grow">
          <div className="card-h2">Notifications</div>
          <div className="muted small" style={{ marginTop: 2 }}>
            Un seul résumé par matin : actions du jour, RDV et factures en
            retard.
          </div>
        </div>
      </div>

      {!isPending && !isConfigured ? (
        <div className="muted small">
          Les notifications ne sont pas configurées sur ce serveur.
        </div>
      ) : null}

      {isConfigured && isBlocked ? (
        <div className="muted small" style={{ marginBottom: 12 }}>
          Notifications bloquées dans les réglages du navigateur.
        </div>
      ) : null}

      {isConfigured && isSubscribed ? (
        <div className="muted small" style={{ marginBottom: 12 }}>
          Dernier envoi :{" "}
          {status?.lastDeliveredAt
            ? fmtRelative(status.lastDeliveredAt)
            : "Jamais"}
        </div>
      ) : null}

      {isConfigured ? (
        <div className="row gap-8" style={{ flexWrap: "wrap" }}>
          {isSubscribed ? (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => sendTest.mutate()}
                disabled={sendTest.isPending}
              >
                <Icon name="bell" size={14} />
                {sendTest.isPending ? "Envoi…" : "Tester la notification"}
              </button>
              <button
                className="btn btn-ghost btn-danger"
                onClick={() => setIsConfirmingDisable(true)}
                disabled={unsubscribe.isPending}
              >
                Désactiver
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => subscribe.mutate()}
              disabled={subscribe.isPending || isBlocked || isPending}
            >
              <Icon name="bell" size={14} />
              {subscribe.isPending
                ? "Activation…"
                : "Activer les notifications"}
            </button>
          )}
        </div>
      ) : null}

      <div className="muted small" style={{ marginTop: 12 }}>
        Sur iPhone, les notifications ne fonctionnent que si l&apos;app est
        installée sur l&apos;écran d&apos;accueil.
      </div>

      {isConfirmingDisable ? (
        <ConfirmDialog
          title="Désactiver les notifications ?"
          description="Tu ne recevras plus le résumé quotidien sur cet appareil."
          confirmLabel="Désactiver"
          danger
          isPending={unsubscribe.isPending}
          onCancel={() => setIsConfirmingDisable(false)}
          onConfirm={() => {
            unsubscribe.mutate(undefined, {
              onSettled: () => setIsConfirmingDisable(false),
            })
          }}
        />
      ) : null}
    </div>
  )
}
