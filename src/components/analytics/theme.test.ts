import { describe, expect, test } from "bun:test";
import { APOLLO, CHANNEL, CHANNEL_META, CRM_CATEGORY_COLOR, HUE, STATUS } from "./theme";

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((start) => {
    const channel = Number.parseInt(value.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("semantic tokens", () => {
  test("keeps the original meaning of global HUE tokens", () => {
    expect(HUE.blue).toBe("#335cff");
    expect(HUE.orange).toBe("#fa7319");
    expect(HUE.green).toBe("#1fc16b");
    expect(HUE.purple).toBe("#7d52f4");
    expect(HUE.teal).toBe("#1daf9c");
    expect(HUE.red).toBe("#fb3748");
  });

  test("keeps status and CRM category semantics tied to those tokens", () => {
    expect(STATUS.good).toBe(HUE.green);
    expect(STATUS.warning).toBe(HUE.amber);
    expect(STATUS.serious).toBe(HUE.orange);
    expect(STATUS.critical).toBe(HUE.red);
    expect(CRM_CATEGORY_COLOR.interested).toBe(HUE.teal);
    expect(CRM_CATEGORY_COLOR.customer).toBe(HUE.purple);
    expect(CRM_CATEGORY_COLOR.not_interested).toBe(HUE.red);
    expect(CRM_CATEGORY_COLOR.other).toBe(HUE.amber);
  });
});

describe("Apollo brand and channel tokens", () => {
  test("uses separate brand tokens instead of repurposing HUE", () => {
    expect(APOLLO.purple).toBe("#49345F");
    expect(APOLLO.lime).toBe("#C5F467");
    expect(APOLLO.lime).not.toBe(HUE.green);
  });

  test("uses a WhatsApp green with enough contrast against a white icon", () => {
    expect(CHANNEL_META.whatsapp.color).toBe(CHANNEL.whatsapp);
    expect(CHANNEL_META.whatsapp.color).not.toBe(APOLLO.lime);
    expect(contrast(CHANNEL_META.whatsapp.color, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
});
