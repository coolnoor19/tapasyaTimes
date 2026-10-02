import { describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";

describe("cn", () => {
  it("joins classes and skips falsy values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });
  it("lets a later Tailwind class override an earlier conflicting one", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });
  it("keeps non-conflicting classes", () => {
    expect(cn("bg-brand-700", "text-white")).toBe("bg-brand-700 text-white");
  });
});
