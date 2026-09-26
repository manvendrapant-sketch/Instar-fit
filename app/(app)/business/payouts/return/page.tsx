import { PayoutsReturn } from '@/components/PayoutsReturn';

export const metadata = { title: 'Checking with Stripe · Instar' };

export default async function PayoutsReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { mock } = await searchParams;
  return <PayoutsReturn mock={typeof mock === 'string' ? mock : undefined} />;
}
