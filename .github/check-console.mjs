// CI 用：本機起靜態伺服器，用 headless Chromium 開每個 lessons/*.html，
// 蒐集 console error 與未捕捉例外，有就讓 CI 失敗。
// 忽略音檔／manifest 的 404（引擎本來就會 fallback 到瀏覽器語音）。
import { chromium } from "playwright";
import { createServer } from "http";
import { readFile, readdir } from "fs/promises";
import { extname, join } from "path";

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
};

const root = process.cwd();
const srv = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const buf = await readFile(join(root, p));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404); res.end("not found");
  }
});
await new Promise((r) => srv.listen(4173, r));

const lessons = (await readdir("lessons")).filter((f) => f.endsWith(".html"));
const browser = await chromium.launch();
let failed = false;

for (const f of lessons) {
  const page = await browser.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(`http://localhost:4173/lessons/${encodeURIComponent(f)}`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const real = errs.filter((e) => !/\.mp3|manifest\.json/.test(e));
  if (real.length) {
    console.log(`✗ ${f}`);
    real.forEach((e) => console.log("   " + e));
    failed = true;
  } else {
    console.log(`ok ${f}`);
  }
  await page.close();
}

await browser.close();
srv.close();
process.exit(failed ? 1 : 0);
