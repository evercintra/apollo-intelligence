import { describe, expect, test } from "bun:test";
import { foldDonutItems, type DonutItem } from "./donutFold";

const item = (index: number, value: number): DonutItem => ({
  key: `k${index}`,
  label: `Item ${index}`,
  value,
  color: `#00000${index}`,
});

describe("foldDonutItems", () => {
  test("keeps every provided row when it fits the slice limit", () => {
    const items = [item(1, 3), item(2, 2), item(3, 1)];
    expect(foldDonutItems(items, 6)).toEqual(items);
  });

  test("folds the remaining real rows into Outros without losing total value", () => {
    const items = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((value, index) => item(index + 1, value));
    const slices = foldDonutItems(items, 6);
    const originalTotal = items.reduce((sum, row) => sum + row.value, 0);
    const foldedTotal = slices.reduce((sum, row) => sum + row.value, 0);
    expect(slices).toHaveLength(6);
    expect(foldedTotal).toBe(originalTotal);
    expect(slices[5].label).toBe("Outros (5)");
    expect(slices[5].value).toBe(15);
    expect(slices.some((slice) => slice.key === "k10")).toBe(false);
  });

  test("ignores zero-valued rows without changing the real total", () => {
    const items = [item(1, 5), item(2, 0)];
    expect(foldDonutItems(items, 6)).toEqual([item(1, 5)]);
  });
});
