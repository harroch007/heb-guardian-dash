import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the KippyAI Hebrew early-access landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="he"[^>]*dir="rtl"/i);
  assert.match(html, /<title>KippyAI — הורות דיגיטלית בדרך רגועה יותר<\/title>/i);
  assert.match(html, /לתת להם מרחב/);
  assert.match(html, /לא לקרוא הכול. לא להישאר בחושך/);
  assert.match(html, /kippy-family-conversation\.png/);
  assert.match(html, /https:\/\/www\.kippyai\.com\/auth\?signup=true/);
  assert.match(html, /גישה מוקדמת/);
  assert.doesNotMatch(html, /מתחילים בחינם|בזמן אמת|כל Android|TikTok|Instagram/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps accessibility, metadata and brand safeguards", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /className="skip-link"/);
  assert.match(page, /id="main-content"/);
  assert.match(layout, /lang="he" dir="rtl"/);
  assert.match(layout, /\/og\.png/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /<svg|transition-all|https:\/\/images\./);
  assert.doesNotMatch(page, /מתחילים בחינם|100%|בזמן אמת|כל Android|TikTok|Instagram/);
  await assert.rejects(access(new URL("./app/_sites-preview", templateRoot)));

  const [hero, mascot, socialCard] = await Promise.all([
    stat(new URL("./public/kippy-family-conversation.png", templateRoot)),
    stat(new URL("./public/kippy-mascot.png", templateRoot)),
    stat(new URL("./public/og.png", templateRoot)),
  ]);
  assert.ok(hero.size > 100_000, "hero image should be present and non-empty");
  assert.ok(mascot.size > 50_000, "mascot image should be present and non-empty");
  assert.ok(socialCard.size > 100_000, "social preview should be present and non-empty");
});
