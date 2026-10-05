import { describe, expect, it } from "vitest";
import { REVEAL_EVENT, reveal, type RevealDetail } from "./reveal";

/** An event target standing in for an element: the helper only dispatches on it. */
const fakeElement = (name: string) => Object.assign(new EventTarget(), { name }) as unknown as HTMLElement;

describe("reveal", () => {
  it("brings the target itself into view when nothing hides it", () => {
    const target = fakeElement("target");
    expect(reveal(target)).toBe(target);
  });

  it("asks before the page lands, and takes the element a listener names", () => {
    const target = fakeElement("panel");
    const section = fakeElement("section");
    const asked: string[] = [];
    target.addEventListener(REVEAL_EVENT, (event) => {
      asked.push(event.type);
      (event as CustomEvent<RevealDetail>).detail.view = section;
    });
    expect(reveal(target)).toBe(section);
    expect(asked).toEqual([REVEAL_EVENT]);
  });
});
