import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { currentOrganizationId } from "@/lib/tenancy/scope";
import { type AnalyticsRange, type PipelineAnalytics } from "./contract";
import { getOverviewAnalytics } from "./overview.server";
import { toUpcomingMeetings, type UpcomingMeetingRow } from "./rows";

export async function getPipelineAnalytics(range: AnalyticsRange): Promise<PipelineAnalytics> {
  const org = currentOrganizationId();
  const [overview, meetingRows] = await Promise.all([
    getOverviewAnalytics(range),
    db.execute<UpcomingMeetingRow>(sql`
      SELECT
        m.id,
        coalesce(p.full_name, concat_ws(' ', p.first_name, p.last_name), p.email, 'Lead') AS "personName",
        c.name AS "companyName",
        m.start_at AS "startAt",
        m.end_at AS "endAt",
        m.status,
        m.outcome
      FROM crm_meetings m
      JOIN crm_records r ON r.id = m.crm_record_id AND r.organization_id = m.organization_id
      JOIN people p ON p.id = m.person_id AND p.organization_id = m.organization_id
      LEFT JOIN companies c ON c.id = p.company_id AND c.organization_id = m.organization_id
      WHERE m.organization_id = ${org} AND m.status = 'booked' AND m.outcome IS NULL AND m.start_at >= now()
      ORDER BY m.start_at ASC
      LIMIT 6`),
  ]);

  const upcomingMeetings = toUpcomingMeetings(meetingRows);

  return {
    view: "pipeline",
    range,
    commercial: overview.commercial,
    kpis: overview.kpis,
    crm: overview.crm,
    conversion: overview.conversion,
    upcomingMeetings,
  };
}
