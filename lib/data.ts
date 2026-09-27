// Content ported verbatim from the approved Instar concept (Today screen, roster and spaces).
// Same copy, same numbers — only the rendering is new.

export type QueueKind = 'checkin' | 'lead' | 'money' | 'quiet' | 'renew';

export interface QueueAction {
  label: string;
  style: 'go' | 'quiet' | '';
  toast: string;
}

export interface QueueFact {
  value: string;
  label: string;
}

export interface QueueEntry {
  id: string;
  kind: QueueKind;
  title: string;
  meta: string;
  value: string;
  facts?: QueueFact[];
  draft?: string;
  who?: string;
  actions: QueueAction[];
}

export const KIND: Record<QueueKind, { label: string; className: `k-${QueueKind}` }> = {
  checkin: { label: 'Check-in', className: 'k-checkin' },
  lead: { label: 'Hot lead', className: 'k-lead' },
  money: { label: 'Payment', className: 'k-money' },
  quiet: { label: 'Retention', className: 'k-quiet' },
  renew: { label: 'Renewal', className: 'k-renew' },
};

export const QUEUE: QueueEntry[] = [
  {
    id: 'leah',
    kind: 'checkin',
    title: 'Leah Kim',
    meta: 'Week 6 check-in, waiting 2 days',
    value: '$199/mo',
    facts: [
      { value: '−1.2 lb', label: 'this week' },
      { value: '4 / 4', label: 'workouts' },
      { value: '86%', label: 'macros' },
      { value: 'Knee', label: 'flagged in note' },
    ],
    draft:
      "Leah, down another 1.2 lb and 4 for 4 on workouts. That consistency is what gets you the pull-up. Let's swap split squats for reverse lunges for two weeks, and I've added 20g carbs on Saturday.",
    who: 'Your draft · also updates her program and Saturday targets',
    actions: [
      { label: 'Approve and send', style: 'go', toast: 'Sent to Leah. Program and targets updated.' },
      { label: 'Open full review', style: '', toast: 'Full check-in review opens here in the next round' },
    ],
  },
  {
    id: 'alyssa',
    kind: 'lead',
    title: 'Alyssa Moreno',
    meta: 'Viewed 1:1 pricing twice, 2 hours ago',
    value: '$199/mo',
    facts: [
      { value: '2×', label: 'pricing views' },
      { value: 'Since June', label: 'follower' },
      { value: '6', label: 'likes this week' },
    ],
    draft:
      "Hey Alyssa! Saw you checking out 1:1 coaching. Happy to answer anything, or we can do a quick 15-minute call this week to see if it's the right fit.",
    who: 'Opener in your voice · you send it from Instagram',
    actions: [
      { label: 'Copy and open Instagram', style: 'go', toast: 'Copied. Paste it into your DM with Alyssa.' },
      { label: 'Not now', style: 'quiet', toast: 'Alyssa moves to tomorrow' },
    ],
  },
  {
    id: 'priya',
    kind: 'money',
    title: 'Priya Shah',
    meta: '$199 payment failed, card expired',
    value: '$199',
    facts: [
      { value: 'Thu', label: 'auto retry' },
      { value: 'Notified', label: 'by email' },
      { value: 'Week 3', label: 'of 16' },
    ],
    actions: [
      { label: 'Retry now', style: 'go', toast: "Retrying Priya’s payment" },
      { label: 'Message Priya', style: '', toast: 'Thread with Priya opens' },
    ],
  },
  {
    id: 'jake',
    kind: 'quiet',
    title: 'Jake Thompson',
    meta: 'No workouts logged in 6 days',
    value: '$199/mo',
    facts: [
      { value: '38%', label: 'training, 7 days' },
      { value: '13 days', label: 'since check-in' },
      { value: 'Week 11', label: 'of 16' },
    ],
    draft:
      "Hey Jake, haven't seen you in the app this week. Everything okay? If work's crazy, I can cut this week to two short sessions so you keep momentum.",
    who: 'Drafted in your voice',
    actions: [
      { label: 'Send to Jake', style: 'go', toast: 'Sent to Jake' },
      { label: 'Snooze 2 days', style: 'quiet', toast: 'Jake snoozed until Thursday' },
    ],
  },
  {
    id: 'sam',
    kind: 'renew',
    title: 'Sam Ortiz',
    meta: '12-week program ends Sunday',
    value: '$149',
    facts: [
      { value: '96%', label: 'adherence' },
      { value: '+50 lb', label: 'squat since week 1' },
    ],
    actions: [
      { label: 'Offer 1:1 coaching', style: 'go', toast: 'Renewal offer sent to Sam' },
      { label: 'Offer program 2', style: '', toast: 'Program 2 offer sent to Sam' },
    ],
  },
  {
    id: 'chris',
    kind: 'lead',
    title: 'Chris Patel',
    meta: 'Left checkout at the payment step, yesterday',
    value: '$199/mo',
    draft:
      'Hey Chris, noticed you almost joined yesterday. Any questions before you start? Happy to walk you through the first week.',
    who: 'Reminder in your voice',
    actions: [
      { label: 'Copy and open Instagram', style: 'go', toast: 'Copied. Paste it into your DM with Chris.' },
      { label: 'Not now', style: 'quiet', toast: 'Chris moves to tomorrow' },
    ],
  },
];

export type RosterState = 'ok' | 'warn' | 'bad';

export interface RosterPerson {
  name: string;
  state: RosterState;
}

const ROSTER_NAMES = [
  'Leah Kim', 'Jake Thompson', 'Priya Shah', 'Sam Ortiz', 'Nina Alvarez', 'Omar Haddad',
  'Marcus Bell', 'Tom Walsh', 'Ella Brooks', 'Hannah Cole', 'Kevin Park', 'Ari Cohen',
  'Jess Morgan', 'Luis Romero', 'Dana Lee', 'Brian Scott', 'Mia Chen', 'Noah Diaz',
  'Ava Patel', 'Liam Ross', 'Zoe King', 'Ethan Wu', 'Isla Grant', 'Leo Park',
  'Ruby Shaw', 'Max Reed', 'Ivy Lane', 'Owen Hart', 'Lily Moss', 'Cole Fox',
  'Nora Bell', 'Eli Stone', 'Maya Cruz', 'Finn Ray', 'Ada Young', 'Jude Kerr',
];

const ROSTER_STATE: Record<string, RosterState> = {
  'Jake Thompson': 'bad',
  'Priya Shah': 'warn',
  'Nina Alvarez': 'warn',
  'Kevin Park': 'warn',
  'Brian Scott': 'bad',
  'Zoe King': 'warn',
  'Owen Hart': 'warn',
  'Finn Ray': 'bad',
  'Isla Grant': 'warn',
};

export const ROSTER: RosterPerson[] = ROSTER_NAMES.map((name) => ({
  name,
  state: ROSTER_STATE[name] ?? 'ok',
}));

export interface SpaceTile {
  id: string;
  title: string;
  description: string;
  statValue?: string;
  statLabel?: string;
  lead?: boolean;
}

export interface SpaceDef {
  id: 'clients' | 'grow' | 'business';
  title: string;
  lede: string;
  tiles: SpaceTile[];
}

export const SPACES: SpaceDef[] = [
  {
    id: 'clients',
    title: 'Clients',
    lede: 'Everyone you coach. Open any client to see their program, nutrition, check-ins, messages and billing in one place.',
    tiles: [
      { id: 'roster', title: 'Roster', description: '36 active clients, sorted by who needs you most.', statValue: '36', statLabel: 'active', lead: true },
      { id: 'checkins', title: 'Check-ins', description: 'Review the week, approve drafted replies.', statValue: '3', statLabel: 'waiting' },
      { id: 'programs', title: 'Program library', description: 'Templates you assign and tailor per client.', statValue: '5', statLabel: 'templates' },
      { id: 'nutrition', title: 'Nutrition', description: 'Targets and adherence across everyone.', statValue: '3', statLabel: 'off track' },
      { id: 'clientspace', title: 'Client space', description: 'Your private community, challenges and wins.', statValue: '31', statLabel: 'members' },
    ],
  },
  {
    id: 'grow',
    title: 'Grow',
    lede: 'Turn followers into clients. Leads, outreach, content that converts and coaches you bring on board.',
    tiles: [
      { id: 'pipeline', title: 'Pipeline', description: 'From first storefront tap to paying client.', statValue: '48', statLabel: 'leads this month', lead: true },
      { id: 'outreach', title: 'Outreach', description: 'Who to message today, with openers in your voice.', statValue: '6', statLabel: 'today' },
      { id: 'content', title: 'Content', description: 'Which posts actually made money.', statValue: '$2,742', statLabel: 'from content' },
      { id: 'referrals', title: 'Referrals', description: 'Earn from the coaches you bring.', statValue: '3', statLabel: 'coaches' },
      { id: 'network', title: 'Coach network', description: 'Coaches sharing what works.', statValue: '1.2K', statLabel: 'coaches' },
    ],
  },
  {
    id: 'business',
    title: 'Business',
    lede: 'The money side. Payouts, offers, your storefront and the settings that run it all.',
    tiles: [
      { id: 'payouts', title: 'Payouts', description: 'Money in, pending and on its way to you.', statValue: '$2,104', statLabel: 'Friday', lead: true },
      { id: 'offers', title: 'Offers', description: 'Coaching, programs and calls you sell.', statValue: '3', statLabel: 'live' },
      { id: 'storefront', title: 'Storefront', description: 'Your link-in-bio page and checkout.', statValue: '1,284', statLabel: 'visits, 30 days' },
      { id: 'subscribers', title: 'Clients', description: 'Who is active, paused and past due.' },
      { id: 'settings', title: 'Settings', description: 'Brand, team, security and data export.' },
    ],
  },
];

export const AGENDA = [
  { time: 'Today 12:30', title: 'Discovery call · Luis Romero', meta: 'Came from a referral', action: 'Join', toast: 'Zoom link copied' },
  { time: 'Thu 18:00', title: 'Discovery call · Jess Morgan', meta: 'Booked from your storefront', action: 'Prep', toast: 'Added prep notes for Jess' },
  { time: 'Sun', title: '9 weekly check-ins due', meta: 'Drafts ready as they arrive', action: 'View', href: '/clients' },
];

export interface Command {
  group: string;
  label: string;
  hint: string;
  href?: string;
  toast?: string;
}

export const COMMANDS: Command[] = [
  { group: 'Go to', label: 'Today', hint: 'Space', href: '/' },
  { group: 'Go to', label: 'Clients', hint: 'Space', href: '/clients' },
  { group: 'Go to', label: 'Grow', hint: 'Space', href: '/grow' },
  { group: 'Go to', label: 'Business', hint: 'Space', href: '/business' },
  ...SPACES.flatMap((s) => s.tiles.map((t) => ({ group: 'Go to', label: t.title, hint: s.title, href: `/${s.id}` }))),
  ...['Leah Kim', 'Jake Thompson', 'Priya Shah', 'Sam Ortiz', 'Nina Alvarez', 'Omar Haddad', 'Marcus Bell', 'Ella Brooks'].map(
    (name) => ({ group: 'Clients', label: name, hint: 'Open client', toast: `${name}’s profile gets its redesign in the next round` }),
  ),
  { group: 'Actions', label: "Review Leah’s check-in", hint: 'Queue', href: '/' },
  { group: 'Actions', label: 'Move Thursday check-ins to Friday', hint: 'Schedule', toast: 'Moved 4 check-ins to Friday and told those clients' },
  { group: 'Actions', label: 'Copy storefront link', hint: 'Storefront', toast: 'Copied instar.co/maya' },
  { group: 'Actions', label: 'Create a new offer', hint: 'Business', href: '/business' },
  { group: 'Actions', label: 'Send a broadcast to all clients', hint: 'Clients', toast: 'Broadcast composer opens' },
  { group: 'Actions', label: 'Draft 5 hooks for this week', hint: 'Grow', toast: 'Five hooks drafted from your top reels' },
];

export const REVENUE = {
  monthly: 8640,
  deltaPct: '+6.2%',
  deltaLabel: 'vs August',
  nextPayout: '$2,104 Friday',
  goal: 10000,
  goalPct: 0.864,
  sparkline: [4.2, 4.6, 5.1, 5.0, 5.6, 6.0, 6.4, 6.9, 7.3, 7.8, 8.1, 8.64],
};

export const HERO_STATS = [
  { value: '36', label: 'Active clients' },
  { value: '82%', label: 'Retention, top 10%' },
  { value: '3h', label: 'Median reply to leads' },
];
