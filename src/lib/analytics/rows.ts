import { ANALYTICS_CHANNELS, type ActionsAnalytics, type AnalyticsChannel, type ProspectingAnalytics, type UpcomingMeeting } from "./contract";

type Side = "cur" | "prev";
type StageTotals = { positive: number; meetings: number; customers: number };

export type GroupedPeopleRow = {
  cur: unknown;
  total: unknown;
  ch: string | null;
  people: unknown;
};

export type GroupedStageRow = {
  cur: unknown;
  total: unknown;
  ch: string | null;
  positive: unknown;
  meetings: unknown;
  customers: unknown;
};

export type UpcomingMeetingRow = {
  id: string;
  personName?: string | null;
  companyName?: string | null;
  startAt?: unknown;
  endAt?: unknown;
  status: string;
  outcome?: string | null;
};

export type RecentQualifiedRow = {
  domain: string;
  campaignName?: string | null;
  checkedAt?: unknown;
  revenue?: unknown;
  countryCode?: string | null;
};

export type CampaignIssueRow = {
  id: string;
  name: string;
  status: string;
  failedJobs?: unknown;
  lastFailedAt?: unknown;
};

export type PeopleBreakdown = {
  all: Record<Side, number>;
  by: Record<Side, Record<AnalyticsChannel, number>>;
};

export type StageBreakdown = {
  all: Record<Side, StageTotals>;
  positiveByChannel: Record<AnalyticsChannel, number>;
};

export type RecentQualified = ProspectingAnalytics["recentQualified"][number];
export type CampaignIssue = ActionsAnalytics["campaignsWithIssues"][number];

const isTrue = (value: unknown): boolean => value === true || value === 1 || value === "1" || value === "t" || value === "true";

const isChannel = (value: string | null): value is AnalyticsChannel => value !== null && ANALYTICS_CHANNELS.includes(value as AnalyticsChannel);

const count = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function toIsoString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const emptyByChannel = (): Record<AnalyticsChannel, number> =>
  Object.fromEntries(ANALYTICS_CHANNELS.map((channel) => [channel, 0])) as Record<AnalyticsChannel, number>;

const emptyStage = (): StageTotals => ({ positive: 0, meetings: 0, customers: 0 });

export function groupPeopleRows(rows: readonly GroupedPeopleRow[]): PeopleBreakdown {
  const result: PeopleBreakdown = {
    all: { cur: 0, prev: 0 },
    by: { cur: emptyByChannel(), prev: emptyByChannel() },
  };
  for (const row of rows) {
    const side: Side = isTrue(row.cur) ? "cur" : "prev";
    if (isTrue(row.total)) result.all[side] = count(row.people);
    else if (isChannel(row.ch)) result.by[side][row.ch] = count(row.people);
  }
  return result;
}

export function groupStageRows(rows: readonly GroupedStageRow[]): StageBreakdown {
  const result: StageBreakdown = {
    all: { cur: emptyStage(), prev: emptyStage() },
    positiveByChannel: emptyByChannel(),
  };
  for (const row of rows) {
    if (isTrue(row.total)) {
      const side: Side = isTrue(row.cur) ? "cur" : "prev";
      result.all[side] = {
        positive: count(row.positive),
        meetings: count(row.meetings),
        customers: count(row.customers),
      };
    } else if (isTrue(row.cur) && isChannel(row.ch)) {
      result.positiveByChannel[row.ch] = count(row.positive);
    }
  }
  return result;
}

export function toUpcomingMeetings(rows: readonly UpcomingMeetingRow[]): UpcomingMeeting[] {
  const meetings: UpcomingMeeting[] = [];
  for (const row of rows) {
    const startAt = toIsoString(row.startAt);
    const endAt = toIsoString(row.endAt);
    if (!startAt || !endAt) continue;
    meetings.push({
      id: row.id,
      personName: row.personName ?? "Lead",
      companyName: row.companyName ?? null,
      startAt,
      endAt,
      status: row.status ?? "",
      outcome: row.outcome ?? null,
    });
  }
  return meetings;
}

export function toRecentQualified(row: RecentQualifiedRow): RecentQualified {
  const revenue = row.revenue;
  return {
    domain: row.domain,
    campaignName: row.campaignName ?? null,
    checkedAt: toIsoString(row.checkedAt),
    revenue: revenue === null || revenue === undefined ? null : count(revenue),
    countryCode: row.countryCode ?? null,
  };
}

export function toCampaignIssue(row: CampaignIssueRow): CampaignIssue {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    failedJobs: count(row.failedJobs),
    lastFailedAt: toIsoString(row.lastFailedAt),
  };
}
