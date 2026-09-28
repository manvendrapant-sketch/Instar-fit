import { HeroGreeting } from '@/components/HeroGreeting';
import { QueuePanel } from '@/components/QueuePanel';
import { RevenueCard } from '@/components/RevenueCard';
import { RosterPulse } from '@/components/RosterPulse';
import { Agenda } from '@/components/Agenda';
import { InsightCard } from '@/components/InsightCard';
import { DisputeAlert } from '@/components/DisputeAlert';

export default function TodayPage() {
  return (
    <>
      <HeroGreeting />
      <DisputeAlert />
      <div className="ins-today">
        <QueuePanel />
        <div className="ins-col">
          <RevenueCard />
          <RosterPulse />
          <Agenda />
          <InsightCard />
        </div>
      </div>
    </>
  );
}
