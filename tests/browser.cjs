const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const extension = path.resolve(__dirname, "../extension");
const cdn = "https://s1.hdslb.com/bfs/seed/jinkela/short/bili-theme/";
const nativeMarkup = `<link id="__css-map__" rel="stylesheet" href="${cdn}light.css">`;
const html = (head = nativeMarkup, body = "") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "bili-theme-edge-"));
  let context;
  let passed = 0;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: "msedge", headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    let markup = html();
    await context.route("**/*", async route => {
      const url = route.request().url();
      if (url.startsWith(cdn)) {
        const dark = /\/dark(?:_all)?\.css/.test(url);
        return route.fulfill({ contentType: "text/css", body: `:root { --test-theme: ${dark ? "dark" : "light"}; }` });
      }
      if (url.endsWith("/native-header.js") && process.env.BILI_HEADER_PATH) {
        return route.fulfill({ contentType: "text/javascript", body: await fs.readFile(process.env.BILI_HEADER_PATH, "utf8") });
      }
      if (route.request().isNavigationRequest()) return route.fulfill({ contentType: "text/html", body: markup });
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const href = () => page.locator("#__css-map__").getAttribute("href");
    const waitTheme = theme => page.waitForFunction(theme => {
      const link = document.getElementById("__css-map__");
      return link && new URL(link.href).pathname.endsWith(`/${theme}.css`);
    }, theme);
    async function check(name, fn) {
      await fn();
      console.log(`PASS ${++passed}: ${name}`);
    }
    async function manual(theme) {
      await page.evaluate(({ cdn, theme }) => {
        document.getElementById("__css-map__").href = `${cdn}${theme}.css`;
        document.cookie = `theme_style=${theme}; Domain=.bilibili.com; Path=/`;
        document.dispatchEvent(new CustomEvent("biliThemeChange", { detail: { theme } }));
      }, { cdn, theme });
    }
    await check("actual extension loads at document_start and follows dark system", async () => {
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto("https://www.bilibili.com/test");
      await waitTheme("dark");
      const cookie = (await context.cookies()).find(cookie => cookie.name === "theme_style");
      assert.equal(cookie.value, "dark");
      assert.equal(cookie.domain, ".bilibili.com");
      assert.equal(cookie.path, "/");
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--test-theme").trim()), "dark");
    });
    await check("system changes both ways without navigation", async () => {
      await page.emulateMedia({ colorScheme: "light" });
      await waitTheme("light");
      await page.emulateMedia({ colorScheme: "dark" });
      await waitTheme("dark");
    });
    await check("manual choice survives DOM changes, script loading and focus", async () => {
      await manual("light");
      await page.evaluate(() => {
        document.body.append(document.createElement("div"));
        const script = document.createElement("script");
        document.head.append(script);
        script.dispatchEvent(new Event("load"));
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForTimeout(100);
      assert.ok((await href()).endsWith("/light.css"));
    });
    await check("next system change resumes synchronization", async () => {
      await page.emulateMedia({ colorScheme: "light" });
      await page.emulateMedia({ colorScheme: "dark" });
      await waitTheme("dark");
    });
    await check("refresh resets manual override", async () => {
      await manual("light");
      await page.reload();
      await waitTheme("dark");
    });
    await check("native _all variant and image filter are preserved", async () => {
      markup = html(nativeMarkup.replace("light.css", "light_all.css") + '<style id="__css-map-filter__">/*img{filter:brightness(.8)}*/</style>');
      await page.goto("https://www.bilibili.com/filter");
      await waitTheme("dark_all");
      assert.equal(await page.locator("#__css-map-filter__").textContent(), "img{filter:brightness(.8)}");
      await page.emulateMedia({ colorScheme: "light" });
      await waitTheme("light_all");
      assert.equal(await page.locator("#__css-map-filter__").textContent(), "/*img{filter:brightness(.8)}*/");
    });
    await check("unsupported pages are left unchanged", async () => {
      markup = html("<title>Unsupported</title>", "<p>original</p>");
      await page.goto("https://www.bilibili.com/unsupported");
      const before = await page.content();
      const cookiesBefore = await context.cookies();
      await page.emulateMedia({ colorScheme: "dark" });
      await page.waitForTimeout(100);
      assert.equal(await page.content(), before);
      assert.deepEqual(await context.cookies(), cookiesBefore);
    });
    await check("an unrelated link using the same ID is ignored", async () => {
      markup = html('<link id="__css-map__" rel="stylesheet" href="https://example.com/light.css">');
      await page.goto("https://www.bilibili.com/unrelated");
      assert.equal(await href(), "https://example.com/light.css");
    });
    await check("theme entry inserted during parsing is detected", async () => {
      markup = html(`<script>document.write(${JSON.stringify(nativeMarkup)})</script>`);
      await page.goto("https://www.bilibili.com/delayed");
      await waitTheme("dark");
    });
    await check("subdomains synchronize and separate tabs receive changes", async () => {
      markup = html();
      const other = await context.newPage();
      await other.emulateMedia({ colorScheme: "dark" });
      await other.goto("https://space.bilibili.com/2");
      assert.ok((await other.locator("#__css-map__").getAttribute("href")).endsWith("/dark.css"));
      await page.emulateMedia({ colorScheme: "light" });
      await other.emulateMedia({ colorScheme: "light" });
      await waitTheme("light");
      await other.waitForFunction(() => document.getElementById("__css-map__").href.endsWith("/light.css"));
      await other.close();
    });
    assert.deepEqual(errors, []);
    if (process.env.BILI_HEADER_PATH) {
      await check("current Bilibili header handles native state and manual switch", async () => {
        markup = html(nativeMarkup + '<script src="/native-header.js"></script>', `<div id="biliMainHeader"></div><script>
          window.receivedThemes = [];
          new BiliHeader({config:{forceVersion:3,theme:"light",themeSwitchHandler:theme=>receivedThemes.push(theme)}}).init(document.getElementById("biliMainHeader"));
        </script>`);
        await page.emulateMedia({ colorScheme: "dark" });
        await page.goto("https://www.bilibili.com/native");
        await page.waitForFunction(() => window.receivedThemes?.includes("dark"));
        assert.ok((await href()).endsWith("/dark.css"));
        await page.evaluate(() => document.getElementById("biliMainHeader")._vnode.component.provides.emitter.emit("themeChange", "light"));
        await waitTheme("light");
        await page.waitForTimeout(100);
        assert.ok((await href()).endsWith("/light.css"));
        await page.emulateMedia({ colorScheme: "light" });
        await page.emulateMedia({ colorScheme: "dark" });
        await waitTheme("dark");
        assert.equal(await page.evaluate(() => receivedThemes.at(-1)), "dark");
      });
    }
    console.log(`All ${passed} browser checks passed.`);
  } finally {
    await context?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
