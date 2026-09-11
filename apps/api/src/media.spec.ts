import { detectMediaType, MEDIA_MAX_BYTES } from "./media";

describe("detectMediaType", () => {
  it.each([
    ["jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg", ".jpg"],
    ["png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png", ".png"],
    ["gif", Buffer.from("GIF89a"), "image/gif", ".gif"],
    ["webp", Buffer.from("RIFFxxxxWEBP"), "image/webp", ".webp"],
    ["pdf", Buffer.from("%PDF-1.7"), "application/pdf", ".pdf"],
  ])("detects %s by signature", (_name, input, mime, ext) => {
    expect(detectMediaType(input as Buffer)).toEqual({ mime, ext });
  });

  it.each([
    ["empty", Buffer.alloc(0)],
    ["html", Buffer.from("<script>alert(1)</script>")],
    ["svg", Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>")],
  ])("rejects %s", (_name, input) => {
    expect(detectMediaType(input as Buffer)).toBeNull();
  });
});

describe("MEDIA_MAX_BYTES", () => {
  it("converts megabytes to bytes", () => {
    expect(MEDIA_MAX_BYTES(10)).toBe(10 * 1024 * 1024);
  });
});
