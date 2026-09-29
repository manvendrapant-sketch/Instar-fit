'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CoachClientSummary, CoachPurchaseSummary } from '@/lib/commerce/types';
import { fetchCoachClients, STATUS_LABEL } from '@/lib/coachClients';
import { formatMoney } from '@/lib/offers';
import { LoadingSection } from '@/components/LoadingSection';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ClientsHero() {
  return (
    <section className="ins-space-hero">
      <div>
        <div className="ins-label ins-in" style={{ marginBottom: 18 }}>
          Business · Clients
        </div>
        <h1 className="ins-in d1">Clients</h1>
        <p className="ins-in d2">Who&rsquo;s active, paused and past due across every offer.</p>
      </div>
    </section>
  );
}

export function ClientsPage() {
  const [clients, setClients] = useState<CoachClientSummary[] | null>(null);
  const [purchases, setPurchases] = useState<CoachPurchaseSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCoachClients().then((result) => {
      setLoading(false);
      if (result.ok) {
        setClients(result.clients);
        setPurchases(result.purchases);
      } else {
        setError(result.message);
      }
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, same pattern as StorefrontCreator
    load();
  }, [load]);

  if (loading) {
    return (
      <>
        <ClientsHero />
        <LoadingSection label="Loading your clients…" />
      </>
    );
  }

  if (error || !clients || !purchases) {
    return (
      <>
        <ClientsHero />
        <section className="ins-panel ins-offers-missing ins-in" aria-live="polite">
          <h2>Couldn&rsquo;t load your clients</h2>
          <p>Something went wrong loading this list. Check your connection and try again.</p>
          <button type="button" className="ins-btn go" onClick={load}>
            Try again
          </button>
        </section>
      </>
    );
  }

  if (clients.length === 0 && purchases.length === 0) {
    return (
      <>
        <ClientsHero />
        <section className="ins-panel ins-offers-missing ins-in" aria-live="polite">
          <h2>No clients yet</h2>
          <p>Once someone buys through your storefront, they&rsquo;ll show up here.</p>
        </section>
      </>
    );
  }

  return (
    <>
      <ClientsHero />

      {clients.length > 0 && (
        <section className="ins-panel ins-clients-table ins-in d2" aria-labelledby="clients-title">
          <h2 id="clients-title" className="ins-label" style={{ marginBottom: 10 }}>
            {clients.length} {clients.length === 1 ? 'subscription' : 'subscriptions'}
          </h2>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Offer</th>
                <th>Status</th>
                <th>Next charge</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const status = STATUS_LABEL[c.status];
                return (
                  <tr key={c.subscriptionId}>
                    <td>
                      <b>{c.clientName ?? c.clientEmail}</b>
                      {c.clientName && <span className="ins-clients-email">{c.clientEmail}</span>}
                    </td>
                    <td data-label="Offer">{c.offerName}</td>
                    <td data-label="Status">
                      <span className={`ins-chip ${status.chip}`}>{status.label}</span>
                      {c.status === 'paused' && c.pauseResumesAt && (
                        <span className="ins-clients-sub">resumes {formatDate(c.pauseResumesAt)}</span>
                      )}
                    </td>
                    <td data-label="Next charge">{c.status === 'canceled' ? '—' : formatDate(c.currentPeriodEnd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {purchases.length > 0 && (
        <section className="ins-panel ins-clients-table ins-in d3" aria-labelledby="purchases-title">
          <h2 id="purchases-title" className="ins-label" style={{ marginBottom: 10 }}>
            Programs &amp; sessions
          </h2>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Offer</th>
                <th>Amount</th>
                <th>Purchased</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.clientName ?? p.clientEmail}</b>
                    {p.clientName && <span className="ins-clients-email">{p.clientEmail}</span>}
                  </td>
                  <td data-label="Offer">{p.offerName}</td>
                  <td data-label="Amount">{formatMoney(p.amountCents)}</td>
                  <td data-label="Purchased">{formatDate(p.purchasedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
