import { OfferEditor } from '@/components/OfferEditor';

export const metadata = { title: 'Edit offer · Instar' };

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // key: a fresh editor per offer, so navigating between offers never carries state across.
  return <OfferEditor key={id} mode="edit" id={id} />;
}
