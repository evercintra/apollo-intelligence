import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { currentOrganizationId } from "@/lib/tenancy/scope";
import { ANALYTICS_CHANNELS, ratio, type AnalyticsChannel, type AnalyticsRange, type ProspectingAnalytics } from "./contract";
import { getOverviewAnalytics } from "./overview.server";
import { toRecentQualified, type RecentQualifiedRow } from "./rows";
import { createLimiter, num } from "./server";

type QualificationRow = {
  id: string;
  name: string;
  status: string;
  targetMode: string;
  targetLeadCount: number | string;
  targetDomainCount: number | string | null;
  analyzed: number | string;
  qualified: number | string;
  pending: number | string;
  lastCheckedAt: Date | string | null;
};

type CampaignCountRow = { channel: string; status: string; n: number | string };

const emptyCounts = () => ({ active: 0, paused: 0, draft: 0, completed: 0, total: 0 });

export async function getProspectingAnalytics(range: AnalyticsRange): Promise<ProspectingAnalytics> {
  const org = currentOrganizationId();
  const limit = createLimiter(3);

  const [overview, qualificationRows, campaignCountRows, qualifiedRows] = await Promise.all([
    getOverviewAnalytics(range),
    limit(() =>
      db.execute<QualificationRow>(sql`
        SELECT
          c.id,
          c.name,
          c.status,
          c.target_mode AS "targetMode",
          c.target_lead_count AS "targetLeadCount",
          c.target_domain_count AS "targetDomainCount",
          count(td.id)::int AS analyzed,
          count(td.id) FILTER (WHERE td.status = 'qualified')::int AS qualified,
          count(td.id) FILTER (WHERE td.status = 'pending')::int AS pending,
          max(td.checked_at) AS "lastCheckedAt"
        FROM campaigns c
        LEFT JOIN targeted_domains td ON td.campaign_id = c.id AND td.organization_id = c.organization_id
        WHERE c.organization_id = ${org}
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT 8`)),
    limit(() =>
      db.execute<CampaignCountRow>(sql`
        SELECT 'email' AS channel, status::text AS status, count(*)::int AS n FROM outreach_campaigns WHERE organization_id = ${org} GROUP BY status
        UNION ALL
        SELECT 'linkedin' AS channel, status::text AS status, count(*)::int AS n FROM "Campaign" WHERE "organizationId" = ${org} GROUP BY status
        UNION ALL
        SELECT 'whatsapp' AS channel, status::text AS status, count(*)::int AS n FROM whatsapp_campaigns WHERE organization_id = ${org} AND archived_at IS NULL GROUP BY status`)),
    limit(() =>
      db.execute<RecentQualifiedRow>(sql`
        SELECT
          td.domain,
          c.name AS "campaignName",
          td.checked_at AS "checkedAt",
          td.revenue,
          cd.country_code AS "countryCode"
        FROM targeted_domains td
        LEFT JOIN campaigns c ON c.id = td.campaign_id AND c.organization_id = td.organization_id
        LEFT JOIN clean_domains cd ON regexp_replace(lower(cd.domain), '^www\\.', '') = td.domain
        WHERE td.organization_id = ${org} AND td.status = 'qualified'
        ORDER BY td.checked_at DESC NULLS LAST
        LIMIT 8`)),
  ]);

  const counts = new Map<AnalyticsChannel, ReturnType<typeof emptyCounts>>(ANALYTICS_CHANNELS.map((channel) => [channel, emptyCounts()]));
  for (const row of campaignCountRows) {
    const bucket = counts.get(row.channel as AnalyticsChannel);
    if (!bucket) continue;
    const n = num(row.n);
    const status = row.status.toLowerCase();
    if (status === "active" || status === "ready" || status === "building" || status === "running") bucket.active += n;
    else if (status === "paused") bucket.paused += n;
    else if (status === "draft") bucket.draft += n;
    else if (status === "completed" || status === "done") bucket.completed += n;
    bucket.total += n;
  }

  const campaignCounts = ANALYTICS_CHANNELS.map((channel) => {
    const bucket = counts.get(channel) ?? emptyCounts();
    return { channel, ...bucket };
  });

  return {
    view: "prospecting",
    range,
    commercial: overview.commercial,
    channels: overview.channels,
    activeCampaigns: campaignCounts.reduce((sum, row) => sum + row.active, 0),
    qualificationCampaigns: qualificationRows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      targetMode: row.targetMode,
      targetLeadCount: num(row.targetLeadCount),
      targetDomainCount: row.targetDomainCount === null || row.targetDomainCount === undefined ? null : num(row.targetDomainCount),
      analyzed: num(row.analyzed),
      qualified: num(row.qualified),
      pending: num(row.pending),
      qualifiedRate: ratio(num(row.qualified), num(row.analyzed)),
      lastCheckedAt: row.lastCheckedAt ? new Date(row.lastCheckedAt).toISOString() : null,
    })),
    campaignCounts,
    recentQualified: qualifiedRows.map(toRecentQualified),
  };
}
