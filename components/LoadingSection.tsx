/**
 * A visible "still loading" state for any panel waiting on its first server fetch (offers,
 * payouts, storefront profile, ...). Used in place of `return null` while `hydrated` is false —
 * rendering nothing there reads as the app having crashed for the second or so a fetch takes,
 * rather than as loading.
 */
export function LoadingSection({ label }: { label?: string }) {
  return (
    <section className="ins-panel ins-loading-section ins-in" role="status" aria-live="polite">
      <span className="ins-spinner" aria-hidden="true" />
      {label && <p>{label}</p>}
    </section>
  );
}
