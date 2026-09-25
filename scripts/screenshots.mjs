// Renders a few pages from the current site (main branch, extracted by compare.mjs into
// .compare/main) and from the Eleventy build (_site) in headless Chrome, and checks that
// the screenshots match. Run `npm run compare` first.
//
//   node scripts/screenshots.mjs
//
// Screenshots are written to .compare/shots/{old,new}/.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGES = [
  ["en-home", "/"],
  ["tr-home", "/tr/"],
  ["blog-post", "/blog/socks5-proxy-setup-windows-macos-ios.html"],
  ["blog-post-ws", "/blog/understanding-carrier-hotspot-throttling.html"],
  ["privacy", "/privacy.html"],
];
const SIZES = [
  ["desktop", "1280,4000"],
  ["mobile", "390,4000"],
];

const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".mp4": "video/mp4", ".xml": "application/xml", ".txt": "text/plain" };
function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(dir, p);
      if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const sites = { old: path.join(root, ".compare", "main"), new: path.join(root, "_site") };
const servers = {};
for (const [k, dir] of Object.entries(sites)) servers[k] = await serve(dir);

let failures = 0;
for (const [name, url] of PAGES) {
  for (const [sizeName, size] of SIZES) {
    const shots = {};
    for (const k of Object.keys(sites)) {
      const out = path.join(root, ".compare", "shots", k, `${name}-${sizeName}.png`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const port = servers[k].address().port;
      await promisify(execFile)(CHROME, [
        "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
        "--force-device-scale-factor=1", `--window-size=${size}`,
        "--virtual-time-budget=4000", `--screenshot=${out}`,
        `http://127.0.0.1:${port}${url}`,
      ], { timeout: 60000 });
      shots[k] = fs.readFileSync(out);
    }
    const same = shots.old.equals(shots.new);
    if (!same) failures++;
    console.log(`${same ? "same     " : "DIFFERENT"}  ${name} (${sizeName})`);
  }
}
for (const s of Object.values(servers)) s.close();
console.log(failures ? `\n${failures} screenshot pair(s) differ, see .compare/shots/` : "\nAll screenshots are identical.");
process.exitCode = failures ? 1 : 0;
