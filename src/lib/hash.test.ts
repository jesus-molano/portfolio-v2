import { describe, expect, it } from "vitest";
import { idFromHash } from "./hash";

describe("idFromHash", () => {
  it("reads the id a fragment names", () => {
    expect(idFromHash("#contact")).toBe("contact");
    expect(idFromHash("#stats-sheet")).toBe("stats-sheet");
  });

  it("names nothing for an empty fragment", () => {
    expect(idFromHash("")).toBeNull();
    expect(idFromHash("#")).toBeNull();
  });

  it("decodes escapes, and keeps a malformed one as it is", () => {
    expect(idFromHash("#caf%C3%A9")).toBe("café");
    expect(idFromHash("#100%")).toBe("100%");
  });
});
