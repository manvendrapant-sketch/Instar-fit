import { SPACES } from '@/lib/data';
import { SpaceTiles } from '@/components/SpaceTiles';

const space = SPACES.find((s) => s.id === 'business')!;

export const metadata = { title: 'Business · Instar' };

export default function BusinessPage() {
  return <SpaceTiles space={space} />;
}
