import { describe, expect, it } from "vitest";
import { REVEAL_EVENT, reveal, type RevealDetail } from "./reveal";

/** An event target standing in for an element: the helper only dispatches on it. */
const fakeElement = (name: string) => Object.assign(new EventTarget(), { name }) as unknown as HTMLElement;

describe("reveal", () => {
  it("brings the target itself into view, and focuses it, when nothing hides it", () => {
    const target = fakeElement("target");
    expect(reveal(target)).toEqual({ view: target, focus: target });
  });

  it("asks before the page lands, and takes the element a listener names", () => {
    const target = fakeElement("panel");
    const section = fakeElement("section");
    const asked: string[] = [];
    target.addEventListener(REVEAL_EVENT, (event) => {
      asked.push(event.type);
      (event as CustomEvent<RevealDetail>).detail.view = section;
    });
    const { view, focus } = reveal(target);
    expect(view).toBe(section);
    expect(focus).toBe(target);
    expect(asked).toEqual([REVEAL_EVENT]);
  });

  it("lets a listener hand the focus on (an old fragment's alias to its panel)", () => {
    const alias = fakeElement("alias");
    const panel = fakeElement("panel");
    alias.addEventListener(REVEAL_EVENT, (event) => {
      (event as CustomEvent<RevealDetail>).detail.focus = panel;
    });
    expect(reveal(alias)).toEqual({ view: alias, focus: panel });
  });
});
