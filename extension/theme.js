(() => {
  "use strict";

  const system = matchMedia("(prefers-color-scheme: dark)");
  const themePath = /\/bili-theme\/(?:light|dark)(_all)?\.css$/;
  let theme = system.matches ? "dark" : "light";
  let emitter;
  let syncing = false;

  function nativeLink() {
    const link = document.getElementById("__css-map__");
    if (!(link instanceof HTMLLinkElement)) return;
    const url = new URL(link.href);
    if (url.hostname === "s1.hdslb.com" && themePath.test(url.pathname)) return link;
  }

  function sync() {
    const link = nativeLink();
    if (!link) return false;
    syncing = true;
    try {
      // Use the header's own switch handler when its Vue app is available.
      emitter?.emit("themeChange", theme);
      const url = new URL(link.href);
      url.pathname = url.pathname.replace(themePath, (_, all = "") => `/bili-theme/${theme}${all}.css`);
      if (link.href !== url.href) link.href = url.href;

      // Some Bilibili pages additionally toggle their native image filter.
      const filter = document.getElementById("__css-map-filter__");
      if (filter) {
        const text = filter.textContent.trim();
        if (theme === "light" && text && !text.startsWith("/*")) filter.textContent = `/*${text}*/`;
        if (theme === "dark" && text.startsWith("/*") && text.endsWith("*/")) filter.textContent = text.slice(2, -2);
      }
      document.cookie = `theme_style=${theme}; Domain=.bilibili.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
      document.dispatchEvent(new CustomEvent("biliThemeChange", {
        detail: { theme }, bubbles: true, cancelable: true
      }));
    } finally {
      syncing = false;
    }
    return true;
  }

  function connectHeader() {
    if (emitter || !nativeLink()) return;
    const mounts = document.querySelectorAll("#biliMainHeader, [data-v-app]");
    for (const mount of mounts) {
      const candidate = mount._vnode?.component?.provides?.emitter;
      if (typeof candidate?.emit === "function") {
        emitter = candidate;
        sync();
        document.removeEventListener("load", onScriptLoad, true);
        break;
      }
    }
  }

  function onScriptLoad(event) {
    if (event.target instanceof HTMLScriptElement) setTimeout(connectHeader, 0);
  }

  document.addEventListener("biliThemeChange", event => {
    if (!syncing && ["dark", "light"].includes(event.detail?.theme)) theme = event.detail.theme;
  });
  system.addEventListener("change", event => {
    theme = event.matches ? "dark" : "light";
    sync();
  });
  document.addEventListener("load", onScriptLoad, true);

  // Observe insertion only during startup; never watch or undo manual changes.
  const startup = new MutationObserver(() => {
    if (sync()) {
      startup.disconnect();
      connectHeader();
    }
  });
  if (!sync()) startup.observe(document, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => {
    startup.disconnect();
    sync();
    connectHeader();
  }, { once: true });
})();
