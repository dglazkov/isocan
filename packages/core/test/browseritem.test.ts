/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, expect, it } from "vitest";
import { normalizeSiteUrl, parseUriList, siteFilename, siteLabel } from "../src/browseritem.ts";

describe("normalizeSiteUrl", () => {
  it("assumes http:// for a bare host:port", () => {
    expect(normalizeSiteUrl("localhost:5173")).toBe("http://localhost:5173/");
    expect(normalizeSiteUrl("127.0.0.1:3000/app")).toBe("http://127.0.0.1:3000/app");
  });

  it("keeps an explicit scheme and path", () => {
    expect(normalizeSiteUrl("https://example.com/docs?x=1")).toBe("https://example.com/docs?x=1");
  });

  it("trims whitespace", () => {
    expect(normalizeSiteUrl("  localhost:8080  ")).toBe("http://localhost:8080/");
  });

  it("rejects non-http schemes and garbage", () => {
    expect(() => normalizeSiteUrl("file:///etc/passwd")).toThrow(/only http/);
    expect(() => normalizeSiteUrl("ftp://x")).toThrow(/only http/);
    expect(() => normalizeSiteUrl("")).toThrow(/empty/);
    expect(() => normalizeSiteUrl("http://")).toThrow(/not a URL/);
  });
});

describe("parseUriList", () => {
  it("returns the first entry, skipping comments and blanks", () => {
    expect(parseUriList("# projected site\r\nhttp://localhost:5173/\r\n")).toBe(
      "http://localhost:5173/",
    );
    expect(parseUriList("\n\nhttp://a\nhttp://b")).toBe("http://a");
  });

  it("is null for a body with no entries", () => {
    expect(parseUriList("# nothing\n")).toBeNull();
    expect(parseUriList("")).toBeNull();
  });
});

describe("siteLabel / siteFilename", () => {
  it("labels an address the way a person says it", () => {
    expect(siteLabel("http://localhost:5173/")).toBe("localhost:5173");
    expect(siteLabel("https://example.com/docs")).toBe("example.com/docs");
  });

  it("derives a safe filename", () => {
    expect(siteFilename("http://localhost:5173/")).toBe("localhost-5173.uri");
    expect(siteFilename("https://example.com/a/b?q=1")).toBe("example.com-a-b-q-1.uri");
  });
});
