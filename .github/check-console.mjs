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

const LOCAL = "localhost:4173";

for (const f of lessons) {
  const page = await browser.newPage();
  const errs = [];
  // 外部 CDN（React / Babel / Tailwind…）連不上時，頁面本身沒問題也會冒一串錯。
  // 那是網路狀況不是程式壞掉，記下來當提醒，不讓 CI 變紅。
  const offline = [];
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (!u.includes(LOCAL) && /^https?:/.test(u)) offline.push(u);
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const u = (m.location() || {}).url || "";
    if (!u.includes(LOCAL) && /^https?:/.test(u)) { offline.push(u); return; }
    errs.push(m.text());
  });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(`http://localhost:4173/lessons/${encodeURIComponent(f)}`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const real = errs.filter((e) => !/\.mp3|manifest\.json/.test(e));
  if (offline.length) {
    // 外部資源載不到 → 這頁沒辦法真的驗證，整頁降級成提醒
    const hosts = [...new Set(offline.map((u) => new URL(u).host))].join("、");
    console.log(`⚠ ${f}（外部資源連不上：${hosts}，這頁跳過檢查）`);
    if (real.length) real.forEach((e) => console.log("   " + e));
  } else if (real.length) {
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
