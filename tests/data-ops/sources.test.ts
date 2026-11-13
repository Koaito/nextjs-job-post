import { describe, expect, it } from "vitest";
import { listCategories, listSourceNames, type SourcesMap } from "@/lib/data-ops/sources";

const SOURCES: SourcesMap = {
  topcv: { "data-analyst": "Data Analyst", marketing: "Marketing" },
  vietnamworks: { it: "IT" },
};

describe("listSourceNames", () => {
  it("giữ thứ tự backend trả về", () => {
    expect(listSourceNames(SOURCES)).toEqual(["topcv", "vietnamworks"]);
  });
  it("rỗng -> []", () => {
    expect(listSourceNames({})).toEqual([]);
  });
});

describe("listCategories", () => {
  it("trả key + label theo thứ tự backend", () => {
    expect(listCategories(SOURCES, "topcv")).toEqual([
      { key: "data-analyst", label: "Data Analyst" },
      { key: "marketing", label: "Marketing" },
    ]);
  });

  it("nguồn không tồn tại -> []", () => {
    expect(listCategories(SOURCES, "careerviet")).toEqual([]);
  });

  it("nguồn mang tên key của Object.prototype -> [] (không ném lỗi)", () => {
    expect(listCategories(SOURCES, "constructor")).toEqual([]);
    expect(listCategories(SOURCES, "toString")).toEqual([]);
  });
});
