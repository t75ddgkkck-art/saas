/**
 * Tests des helpers Lightbox (Lot 23).
 * On teste les extracteurs YouTube/Vimeo ID (fonctions pures).
 */

import { describe, it, expect } from "vitest";
import { __lightboxInternals } from "../../src/components/public/Lightbox";

const { youtubeId, vimeoId } = __lightboxInternals;

describe("Lightbox - youtubeId (Lot 23)", () => {
  it("extrait l'ID depuis youtu.be/xxx", () => {
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extrait l'ID depuis youtube.com/watch?v=xxx", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=42")).toBe("dQw4w9WgXcQ");
  });

  it("extrait l'ID depuis /embed/", () => {
    expect(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extrait l'ID depuis /shorts/", () => {
    expect(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("retourne null si URL non-YouTube", () => {
    expect(youtubeId("https://vimeo.com/12345")).toBeNull();
    expect(youtubeId("https://example.com/video.mp4")).toBeNull();
    expect(youtubeId("")).toBeNull();
  });

  it("retourne null si format ID incorrect (< 11 chars)", () => {
    expect(youtubeId("https://youtu.be/short")).toBeNull();
  });
});

describe("Lightbox - vimeoId (Lot 23)", () => {
  it("extrait depuis vimeo.com/12345", () => {
    expect(vimeoId("https://vimeo.com/76979871")).toBe("76979871");
  });

  it("extrait depuis player.vimeo.com/video/12345", () => {
    expect(vimeoId("https://player.vimeo.com/video/76979871")).toBe("76979871");
  });

  it("retourne null si non-Vimeo", () => {
    expect(vimeoId("https://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(vimeoId("")).toBeNull();
  });
});
