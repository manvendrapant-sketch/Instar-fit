import { SPACES } from '@/lib/data';
import { SpaceTiles } from '@/components/SpaceTiles';

const space = SPACES.find((s) => s.id === 'clients')!;

export const metadata = { title: 'Clients · Instar' };

export default function ClientsPage() {
  return <SpaceTiles space={space} />;
}
