import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import {
  DOC_SYNCED_PROP,
  docFilenameFrom,
  docProperties,
  docSyncedAt,
  docTitleFrom,
  googleDocExportUrl,
  googleDocId,
  googleDocPreviewUrl,
  googleDocUrl,
  isGoogleDocItem,
} from "../src/googledoc.ts";
import { SOURCE_PROP } from "../src/canvasitem.ts";

/**
 * **A Google Doc on the canvas** (research note, stages 2–3): the shape of a
 * doc's address, the addresses derived from it, and how the item is named.
 */
const ID = "195j9eDD3ccgjQRttHhJPymLJUCOUjs-jmwTrekvdjFE";

describe("recognising a doc's address", () => {
  it("reads the id out of every form Google writes", () => {
    expect(googleDocId(`https://docs.google.com/document/d/${ID}/edit`)).toBe(ID);
    expect(googleDocId(`https://docs.google.com/document/d/${ID}/edit?usp=sharing#heading=h.1`)).toBe(ID);
    expect(googleDocId(`https://docs.google.com/document/u/1/d/${ID}/preview`)).toBe(ID);
    expect(googleDocId(`https://docs.google.com/document/d/${ID}`)).toBe(ID);
  });

  it("refuses what is not a doc", () => {
    expect(googleDocId("https://docs.google.com/spreadsheets/d/abc123abc123abc123abc123/edit")).toBeNull();
    expect(googleDocId("https://drive.google.com/file/d/abc123abc123abc123abc123/view")).toBeNull();
    expect(googleDocId("https://example.com/document/d/abc123abc123abc123abc123/edit")).toBeNull();
    expect(googleDocId("not a url")).toBeNull();
  });

  it("derives the addresses the item and the fetch use", () => {
    expect(googleDocUrl(ID)).toBe(`https://docs.google.com/document/d/${ID}/edit`);
    expect(googleDocExportUrl(ID)).toBe(`https://docs.google.com/document/d/${ID}/export?format=md`);
    expect(googleDocPreviewUrl(ID)).toBe(`https://docs.google.com/document/d/${ID}/preview`);
  });
});

describe("naming the item", () => {
  it("takes the first heading, else the first line, else the fallback", () => {
    expect(docTitleFrom("\n# Sign-up in ten seconds\n\nBody.", ID)).toBe("Sign-up in ten seconds");
    expect(docTitleFrom("Just words here\nand more", ID)).toBe("Just words here");
    expect(docTitleFrom("   \n\n", ID)).toBe(ID);
    expect(docTitleFrom(`# ${"x".repeat(120)}`, ID).length).toBe(80);
  });

  it("makes a filename a person would recognise", () => {
    expect(docFilenameFrom("Sign-up in ten seconds!")).toBe("sign-up-in-ten-seconds.md");
    expect(docFilenameFrom("***")).toBe("document.md");
  });
});

describe("the item's two properties", () => {
  const item = (props: Record<string, string>): Item =>
    ({ id: "i", title: "t", x: 0, y: 0, width: 1, height: 1, properties: props, versions: [], currentVersionId: "" }) as unknown as Item;

  it("records the link and when the words were taken", () => {
    const props = docProperties(googleDocUrl(ID), "2026-09-02T10:00:00.000Z");
    expect(props[SOURCE_PROP]).toBe(googleDocUrl(ID));
    expect(props[DOC_SYNCED_PROP]).toBe("2026-09-02T10:00:00.000Z");
    expect(isGoogleDocItem(item(props))).toBe(true);
    expect(docSyncedAt(item(props))).toBe("2026-09-02T10:00:00.000Z");
  });

  it("is not a doc item for a canvas link or a plain document", () => {
    expect(isGoogleDocItem(item({ [SOURCE_PROP]: "https://isocan.io/p/prj_x" }))).toBe(false);
    expect(isGoogleDocItem(item({}))).toBe(false);
  });
});
