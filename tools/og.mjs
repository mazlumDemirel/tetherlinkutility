// Generates a 1200x630 Open Graph image per blog post (handoff 6b) in headless Chrome.
// Run it before the Eleventy build whenever a post title, region or carrier changes, and commit
// the PNGs (the Pages workflow only runs Eleventy):
//
//   node tools/og.mjs            # all posts
//   node tools/og.mjs jio        # only posts whose slug contains "jio"
//
// Output: public/og/{lang}/{slug}.png, copied to /og/... by the passthrough copy.
// post.njk points og:image / twitter:image at it when the file exists.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const run = promisify(execFile);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LANGS = { en: "src/blog", tr: "src/tr/blog", hi: "src/hi/blog" };
const GUIDE = { en: "GUIDE", tr: "REHBER", hi: "गाइड" };
const only = process.argv[2];

const logo = fs.readFileSync(path.join(root, "public/favicon.png")).toString("base64");
const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#8377;/g, "₹");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Top-level `key: "value"` pairs from the front matter (all these keys are simple strings).
function frontMatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const head = text.split(/\n---\n/)[0];
  const data = {};
  for (const m of head.matchAll(/^([A-Za-z]+): "(.*)"$/gm)) data[m[1]] = m[2].replace(/\\"/g, '"');
  return data;
}

function card({ eyebrow, title, year }) {
  // 76px per the design; long titles (mostly TR/HI, which have no short ogTitle) step down to fit.
  const size = title.length <= 48 ? 76 : title.length <= 66 ? 64 : 54;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body { position: relative; background: #0C0C18; color: #ECEDFF;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Noto Sans Devanagari", sans-serif; }
  .glow { position: absolute; right: -160px; top: -220px; width: 720px; height: 720px;
    background: radial-gradient(circle, rgba(232,98,42,0.22) 0%, rgba(232,98,42,0) 65%); }
  .bar { position: absolute; left: 0; top: 0; bottom: 0; width: 10px; background: #E8622A; }
  .inner { position: absolute; inset: 72px 80px 64px 88px; display: flex; flex-direction: column; justify-content: space-between; }
  .top { display: flex; align-items: center; gap: 14px; }
  .eyebrow { font-size: 24px; font-weight: 700; letter-spacing: .12em; color: #E8622A; }
  .year { font-size: 22px; font-weight: 700; border: 2px solid #2C2C50; border-radius: 10px; padding: 4px 14px; }
  .title { font-size: ${size}px; font-weight: 800; line-height: 1.05; letter-spacing: -.03em; max-width: 960px; text-wrap: balance; }
  .foot { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 16px; font-size: 26px; font-weight: 700; }
  .brand img { width: 48px; height: 48px; border-radius: 11px; }
  .url { font-size: 24px; color: #A4A4C8; }
</style></head><body>
  <div class="glow"></div><div class="bar"></div>
  <div class="inner">
    <div class="top"><span class="eyebrow">${esc(eyebrow)}</span>${year ? `<span class="year">${year}</span>` : ""}</div>
    <div class="title">${esc(title)}</div>
    <div class="foot"><span class="brand"><img src="data:image/png;base64,${logo}" alt="">Tether Link Utility</span><span class="url">tetherlinkutility.com</span></div>
  </div>
</body></html>`;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "og-"));
let count = 0;
for (const [lang, dir] of Object.entries(LANGS)) {
  const outDir = path.join(root, "public/og", lang);
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".html")).sort()) {
    const slug = name.replace(/\.html$/, "");
    if (only && !slug.includes(only)) continue;
    const fm = frontMatter(path.join(root, dir, name));
    const raw = decode(fm.ogTitle || fm.title || slug);
    const year = (raw.match(/\b(20\d\d)\b/) || [])[1] || String(fm.published || "").slice(0, 4);
    const title = raw
      .replace(/\s*\(20\d\d\)/g, "")
      .replace(/\s+20\d\d(?=[:\s]|$)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const locale = lang === "tr" ? "tr-TR" : "en-US";
    const eyebrow =
      fm.region && fm.carrier
        ? // "Türkiye" needs Turkish casing (İ) in every language.
          `${fm.region.toLocaleUpperCase(/ü|ı|ş|ğ/i.test(fm.region) ? "tr-TR" : locale)} · ${fm.carrier.toLocaleUpperCase(locale)}`
        : GUIDE[lang];
    const htmlFile = path.join(tmp, `${lang}-${slug}.html`);
    fs.writeFileSync(htmlFile, card({ eyebrow, title, year }));
    const out = path.join(outDir, `${slug}.png`);
    await run(CHROME, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
      "--window-size=1200,630", `--screenshot=${out}`, `file://${htmlFile}`,
    ]);
    count++;
    console.log(`og/${lang}/${slug}.png  ${eyebrow} | ${title}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${count} images`);
