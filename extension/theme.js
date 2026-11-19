(() => {
  "use strict";

  const system = matchMedia("(prefers-color-scheme: dark)");
  const themePath = /\/bili-theme\/(?:light|dark)(_all)?\.css$/;
  let theme = system.matches ? "dark" : "light";
  let lastSystem = theme;
  let header;
  let sentTheme;
  let savedTheme;
  let syncing = false;
  let queued = false;
  let interaction = -Infinity;

  function nativeLink() {
    const link = document.getElementById("__css-map__");
    if (!(link instanceof HTMLLinkElement)) return;
    const url = new URL(link.href);
    if (/^(?:[\w-]+\.)?hdslb\.com$/.test(url.hostname) && themePath.test(url.pathname)) return link;
  }

  // The homepage nests its header inside the Vue application, unlike video pages.
  function findHeader() {
    if (header && !header.isUnmounted && header.vnode?.el?.isConnected) return;
    header?.provides?.emitter?.off?.("themeChange", chooseTheme);
    header = undefined;
    sentTheme = undefined;
    const stack = [...document.querySelectorAll("#app, #biliMainHeader, [data-v-app]")]
      .map(node => node._vnode).filter(Boolean);
    const seen = new Set();
    while (stack.length) {
      const vnode = stack.pop();
      if (!vnode || typeof vnode !== "object" || seen.has(vnode)) continue;
      seen.add(vnode);
      const component = vnode.component;
      if (component) {
        const provided = component.provides;
        if (Object.hasOwn(provided || {}, "theme") && typeof provided.emitter?.emit === "function" && component.props?.themeSwitch !== false) {
          header = component;
          provided.emitter.on?.("themeChange", chooseTheme);
          return;
        }
        stack.push(component.subTree);
      }
      if (Array.isArray(vnode.children)) stack.push(...vnode.children);
      stack.push(vnode.suspense?.activeBranch);
    }
  }

  function sync(force = false) {
    if (syncing) return;
    const link = nativeLink();
    const home = !!document.querySelector(".bili-feed4-layout");
    findHeader();
    if (!link && !home && !header) return;
    syncing = true;
    let changed = false;
    try {
      // Keep the menu and page store in sync through Bilibili's own handler.
      if (header && (force || sentTheme !== theme)) {
        try {
          header.provides.emitter.emit("themeChange", theme);
          sentTheme = theme;
          changed = true;
        } catch {
          // A changing header must not prevent CSS or future system updates.
          header = undefined;
        }
      }
      if (home && document.documentElement.classList.contains("bili_dark") !== (theme === "dark")) {
        document.documentElement.classList.toggle("bili_dark", theme === "dark");
        changed = true;
      }
      if (link) {
        const url = new URL(link.href);
        url.pathname = url.pathname.replace(themePath, (_, all = "") => `/bili-theme/${theme}${all}.css`);
        if (link.href !== url.href) {
          link.href = url.href;
          changed = true;
        }
      }
      const filter = document.getElementById("__css-map-filter__");
      if (filter) {
        const text = filter.textContent.trim();
        if (theme === "light" && text && !text.startsWith("/*")) filter.textContent = `/*${text}*/`;
        if (theme === "dark" && text.startsWith("/*") && text.endsWith("*/")) filter.textContent = text.slice(2, -2);
      }
      if (force || savedTheme !== theme) {
        document.cookie = `theme_style=${theme}; Domain=.bilibili.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
        savedTheme = theme;
      }
      if (changed || force) document.dispatchEvent(new CustomEvent("biliThemeChange", {
        detail: { theme }, bubbles: true, cancelable: true
      }));
    } finally {
      syncing = false;
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      sync();
    }, 50);
  }

  // Distinguish the user's choice from a stale theme restored during hydration.
  function chooseTheme(value) {
    if (syncing || !["dark", "light"].includes(value)) return;
    if (performance.now() - interaction < 1000) {
      theme = value;
      sentTheme = theme;
      interaction = -Infinity;
    }
    schedule();
  }
  document.addEventListener("click", event => {
    if (event.isTrusted) interaction = performance.now();
  }, true);
  document.addEventListener("biliThemeChange", event => {
    chooseTheme(event.detail?.theme);
  });
  system.addEventListener("change", () => {
    theme = system.matches ? "dark" : "light";
    lastSystem = theme;
    interaction = -Infinity;
    sync(true);
  });
  // Recheck after suspended tabs/BFCache resume, without discarding manual choice.
  function resume() {
    const current = system.matches ? "dark" : "light";
    if (current !== lastSystem) {
      lastSystem = current;
      theme = current;
      sync(true);
    } else schedule();
  }
  window.addEventListener("pageshow", resume);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resume();
  });
  document.addEventListener("load", schedule, true);
  document.addEventListener("DOMContentLoaded", schedule, { once: true });

  // Async mounts and client navigation can occur long after DOMContentLoaded.
  new MutationObserver(records => {
    if (records.some(record => record.type === "childList" ||
      record.target === document.documentElement || record.target.id === "__css-map__")) schedule();
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "class"] });
  sync();
})();
