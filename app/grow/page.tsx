import { SPACES } from '@/lib/data';
import { SpaceTiles } from '@/components/SpaceTiles';

const space = SPACES.find((s) => s.id === 'grow')!;

export const metadata = { title: 'Grow · Instar' };

export default function GrowPage() {
  return <SpaceTiles space={space} />;
}
