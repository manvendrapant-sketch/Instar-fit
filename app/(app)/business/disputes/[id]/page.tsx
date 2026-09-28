import { DisputeDetail } from '@/components/DisputeDetail';

export const metadata = { title: 'Dispute · Instar' };

export default async function Dispute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // key: fresh state per dispute, so moving between disputes never carries a draft across.
  return <DisputeDetail key={id} id={id} />;
}
