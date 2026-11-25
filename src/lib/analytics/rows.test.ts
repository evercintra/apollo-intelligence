import { describe, expect, test } from "bun:test";
import {
  groupPeopleRows,
  groupStageRows,
  toCampaignIssue,
  toIsoString,
  toRecentQualified,
  toUpcomingMeetings,
} from "./rows";

describe("toUpcomingMeetings", () => {
  test("converts valid dates and names without dropping present fields", () => {
    const meetings = toUpcomingMeetings([
      {
        id: "m1",
        personName: "Ana",
        companyName: "Acme",
        startAt: "2026-11-25T10:00:00Z",
        endAt: new Date("2026-11-25T11:00:00Z"),
        status: "booked",
        outcome: null,
      },
    ]);
    expect(meetings).toEqual([
      {
        id: "m1",
        personName: "Ana",
        companyName: "Acme",
        startAt: "2026-11-25T10:00:00.000Z",
        endAt: "2026-11-25T11:00:00.000Z",
        status: "booked",
        outcome: null,
      },
    ]);
  });

  test("skips rows with missing or invalid dates instead of throwing", () => {
    const meetings = toUpcomingMeetings([
      { id: "m1", status: "booked" },
      { id: "m2", status: "booked", startAt: "invalid", endAt: "2026-11-25T11:00:00Z" },
      { id: "m3", status: "booked", startAt: "2026-11-25T10:00:00Z", endAt: "2026-11-25T11:00:00Z" },
    ]);
    expect(meetings.map((meeting) => meeting.id)).toEqual(["m3"]);
    expect(toIsoString(undefined)).toBeNull();
    expect(toIsoString("not-a-date")).toBeNull();
  });
});

describe("toRecentQualified", () => {
  test("reads camelCase fields and keeps campaign, date, revenue and country", () => {
    expect(
      toRecentQualified({
        domain: "acme.com",
        campaignName: "Campanha A",
        checkedAt: "2026-11-24T12:00:00Z",
        revenue: "2500000",
        countryCode: "BR",
      }),
    ).toEqual({
      domain: "acme.com",
      campaignName: "Campanha A",
      checkedAt: "2026-11-24T12:00:00.000Z",
      revenue: 2500000,
      countryCode: "BR",
    });
  });

  test("keeps nulls for missing enrichment", () => {
    expect(toRecentQualified({ domain: "sem-dados.com" })).toEqual({
      domain: "sem-dados.com",
      campaignName: null,
      checkedAt: null,
      revenue: null,
      countryCode: null,
    });
  });
});

describe("toCampaignIssue", () => {
  test("converts failedJobs and lastFailedAt", () => {
    expect(
      toCampaignIssue({
        id: "c1",
        name: "Campanha A",
        status: "building",
        failedJobs: "3",
        lastFailedAt: "2026-11-23T09:30:00Z",
      }),
    ).toEqual({
      id: "c1",
      name: "Campanha A",
      status: "building",
      failedJobs: 3,
      lastFailedAt: "2026-11-23T09:30:00.000Z",
    });
  });
});

describe("groupStageRows", () => {
  test("uses the GROUPING flag, so a null-channel detail row cannot overwrite the total", () => {
    const result = groupStageRows([
      { cur: true, total: false, ch: null, positive: 99, meetings: 99, customers: 99 },
      { cur: true, total: true, ch: null, positive: 7, meetings: 3, customers: 1 },
      { cur: true, total: false, ch: "email", positive: 4, meetings: 2, customers: 1 },
      { cur: false, total: true, ch: null, positive: 5, meetings: 2, customers: 0 },
    ]);
    expect(result.all.cur).toEqual({ positive: 7, meetings: 3, customers: 1 });
    expect(result.all.prev).toEqual({ positive: 5, meetings: 2, customers: 0 });
    expect(result.positiveByChannel.email).toBe(4);
    expect(result.positiveByChannel.linkedin).toBe(0);
    expect(result.positiveByChannel.whatsapp).toBe(0);
  });

  test("accepts the integer returned by GROUPING(col) = 1", () => {
    const result = groupStageRows([{ cur: true, total: 1, ch: "email", positive: 10, meetings: 4, customers: 2 }]);
    expect(result.all.cur).toEqual({ positive: 10, meetings: 4, customers: 2 });
  });
});

describe("groupPeopleRows", () => {
  test("distinguishes the total row from a null-channel detail row", () => {
    const result = groupPeopleRows([
      { cur: true, total: false, ch: null, people: 50 },
      { cur: true, total: true, ch: null, people: 120 },
      { cur: true, total: false, ch: "whatsapp", people: 30 },
    ]);
    expect(result.all.cur).toBe(120);
    expect(result.by.cur.whatsapp).toBe(30);
    expect(result.by.cur.email).toBe(0);
  });
});
