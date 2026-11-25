import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { currentOrganizationId } from "@/lib/tenancy/scope";
import { OVERDUE_SQL } from "./crm.server";
import { type ActionSignalKey, type ActionsAnalytics, type AnalyticsRange } from "./contract";
import { toCampaignIssue, type CampaignIssueRow } from "./rows";
import { inRange, num } from "./server";

const SIGNAL_KEYS: ActionSignalKey[] = [
  "actionRequired",
  "followUpsDue",
  "draftsAwaitingReview",
  "failingMailboxes",
  "linkedinDisconnected",
  "whatsappDisconnected",
  "failedEmailSends",
  "failedQualificationJobs",
  "parentPending",
];

export async function getActionsAnalytics(range: AnalyticsRange): Promise<ActionsAnalytics> {
  const org = currentOrganizationId();

  const [signalRows, issueRows] = await Promise.all([
    db.execute<Record<string, number>>(sql`
      SELECT
        (SELECT count(*) FROM crm_records WHERE organization_id = ${org} AND workflow_state = 'action_required')::int AS action_required,
        (SELECT count(*) FROM crm_records r WHERE r.organization_id = ${org} AND ${OVERDUE_SQL})::int AS follow_ups_due,
        (SELECT count(*) FROM crm_drafts d WHERE d.status = 'awaiting_review'
          AND d.crm_record_id IN (SELECT id FROM crm_records WHERE organization_id = ${org}))::int AS drafts_awaiting_review,
        (SELECT count(*) FROM outreach_mailboxes WHERE organization_id = ${org} AND status = 'failed')::int AS failing_mailboxes,
        (SELECT count(*) FROM "LinkedInAccount" WHERE "organizationId" = ${org} AND status = 'DISCONNECTED')::int AS linkedin_disconnected,
        (SELECT count(*) FROM whatsapp_accounts WHERE organization_id = ${org} AND status <> 'connected')::int AS whatsapp_disconnected,
        (SELECT count(*) FROM outreach_emails e
          JOIN outreach_leads l ON l.id = e.lead_id
          JOIN outreach_campaigns c ON c.id = l.campaign_id
          WHERE c.organization_id = ${org} AND e.status = 'failed' AND ${inRange(sql`e.created_at`, range)})::int AS failed_email_sends,
        (SELECT count(*) FROM qualification_jobs j
          JOIN campaigns c ON c.id = j.campaign_id
          WHERE c.organization_id = ${org} AND j.status = 'failed')::int AS failed_qualification_jobs,
        (SELECT count(*) FROM targeted_domains WHERE organization_id = ${org} AND parent_pending = true)::int AS parent_pending`),
    db.execute<CampaignIssueRow>(sql`
      SELECT
        c.id,
        c.name,
        c.status,
        count(j.id) FILTER (WHERE j.status = 'failed')::int AS "failedJobs",
        max(j.finished_at) FILTER (WHERE j.status = 'failed') AS "lastFailedAt"
      FROM campaigns c
      LEFT JOIN qualification_jobs j ON j.campaign_id = c.id
      WHERE c.organization_id = ${org}
      GROUP BY c.id
      HAVING count(j.id) FILTER (WHERE j.status = 'failed') > 0
      ORDER BY "lastFailedAt" DESC NULLS LAST
      LIMIT 8`),
  ]);

  const row = signalRows[0] ?? {};
  const column: Record<ActionSignalKey, string> = {
    actionRequired: "action_required",
    followUpsDue: "follow_ups_due",
    draftsAwaitingReview: "drafts_awaiting_review",
    failingMailboxes: "failing_mailboxes",
    linkedinDisconnected: "linkedin_disconnected",
    whatsappDisconnected: "whatsapp_disconnected",
    failedEmailSends: "failed_email_sends",
    failedQualificationJobs: "failed_qualification_jobs",
    parentPending: "parent_pending",
  };

  return {
    view: "actions",
    range,
    signals: SIGNAL_KEYS.map((key) => ({ key, value: num(row[column[key]]) })),
    campaignsWithIssues: issueRows.map(toCampaignIssue),
  };
}
