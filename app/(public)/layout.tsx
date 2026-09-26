// Client-facing pages (a coach's public storefront). No dashboard chrome: clients should only see
// the coach, their offers and a small "Powered by Instar" footer.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="ins-page ins-pub-page">{children}</div>;
}
