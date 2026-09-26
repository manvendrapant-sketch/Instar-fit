import Link from 'next/link';
import { Icon } from '@/lib/icons';

export function InsightCard() {
  return (
    <section className="ins-panel ins-insight">
      <span className="ins-label">Content that paid</span>
      <p>
        Your form-check reel made <b>$1,100</b> this month. That&apos;s {'3×'} your next best post.
      </p>
      <Link href="/grow#content" className="ins-link">
        See what&apos;s converting <Icon name="arrow" />
      </Link>
    </section>
  );
}
