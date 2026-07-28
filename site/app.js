/*
  VibeLens docs — progressive enhancement only.

  Every page is fully readable and navigable with this file blocked: the sidebar
  is a plain nav, the code is highlighted at build time, and search degrades to
  the sidebar. Nothing here is required to read the documentation.
*/

(() => {
  "use strict";

  const root = document.documentElement;
  const BASE = window.VIBELENS_BASE ?? "";

  // --- theme -----------------------------------------------------------------
  // The inline script in <head> already applied the stored theme to avoid a
  // flash of the wrong one; this only wires the toggle.
  const themeToggle = document.querySelector("[data-theme-toggle]");
  if (themeToggle) {
    const sync = () => {
      const dark = root.dataset.theme !== "light";
      themeToggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
      themeToggle.setAttribute("aria-pressed", String(dark));
    };
    sync();
    themeToggle.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      try {
        localStorage.setItem("vibelens-theme", root.dataset.theme);
      } catch {
        // Blocked storage: the toggle still works for this page.
      }
      sync();
    });
  }

  // --- mobile navigation drawer ---------------------------------------------
  const navToggle = document.querySelector("[data-nav-toggle]");
  const sidebar = document.querySelector(".sidebar");
  const backdrop = document.querySelector("[data-nav-backdrop]");

  if (navToggle && sidebar) {
    const setOpen = (open) => {
      sidebar.dataset.open = String(open);
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close documentation navigation" : "Open documentation navigation");
      if (backdrop) backdrop.hidden = !open;
      // Locking the body prevents the page scrolling behind the drawer.
      document.body.classList.toggle("nav-open", open);
    };
    setOpen(false);

    navToggle.addEventListener("click", () => setOpen(sidebar.dataset.open !== "true"));
    backdrop?.addEventListener("click", () => setOpen(false));
    sidebar.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sidebar.dataset.open === "true") {
        setOpen(false);
        navToggle.focus();
      }
    });
  }

  // --- copy buttons ---------------------------------------------------------
  for (const block of document.querySelectorAll(".code-block")) {
    const code = block.querySelector("code");
    if (!code || !navigator.clipboard) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-button";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code to clipboard");

    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.innerText);
        button.textContent = "Copied";
        button.dataset.state = "done";
      } catch {
        button.textContent = "Press Ctrl+C";
      }
      window.setTimeout(() => {
        button.textContent = "Copy";
        delete button.dataset.state;
      }, 1600);
    });

    block.append(button);
  }

  // --- table of contents highlight ------------------------------------------
  const tocLinks = [...document.querySelectorAll(".toc a")];
  if (tocLinks.length > 0 && "IntersectionObserver" in window) {
    const byId = new Map(tocLinks.map((link) => [decodeURIComponent(link.hash.slice(1)), link]));
    const headings = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);

    let active = null;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const link = byId.get(entry.target.id);
          if (!link || link === active) continue;
          active?.classList.remove("is-active");
          link.classList.add("is-active");
          active = link;
        }
      },
      // Biased toward the top of the viewport so the highlighted entry matches
      // what the reader is actually looking at.
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    for (const heading of headings) observer.observe(heading);
  }

  // --- search ---------------------------------------------------------------
  const dialog = document.querySelector("[data-search-dialog]");
  const input = document.querySelector("[data-search-input]");
  const resultsEl = document.querySelector("[data-search-results]");
  const triggers = [...document.querySelectorAll("[data-search-open]")];

  if (dialog && input && resultsEl && typeof dialog.showModal === "function") {
    let index = null;
    let loading = null;
    let items = [];
    let cursor = 0;

    // The index is fetched on first use, not on page load: it is 56 kB and most
    // visits never search.
    const load = () => {
      loading ??= fetch(`${BASE}/search-index.json`)
        .then((response) => (response.ok ? response.json() : []))
        .then((data) => {
          index = data;
        })
        .catch(() => {
          index = [];
        });
      return loading;
    };

    const escapeHtml = (value) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    /** Ranks a page against the query. Higher is better; 0 means no match. */
    const score = (page, terms) => {
      const title = page.t.toLowerCase();
      const group = (page.g ?? "").toLowerCase();
      const body = page.b.toLowerCase();
      const headings = page.h.map((h) => h.t.toLowerCase());

      let total = 0;
      for (const term of terms) {
        let best = 0;
        if (title.startsWith(term)) best = 100;
        else if (title.includes(term)) best = 70;
        else if (headings.some((h) => h.includes(term))) best = 45;
        else if (group.includes(term)) best = 25;
        else if (body.includes(term)) best = 15;
        if (best === 0) return 0; // every term has to appear somewhere
        total += best;
      }
      return total;
    };

    /** Pulls a snippet around the first match so the result explains itself. */
    const snippet = (page, term) => {
      const body = page.b;
      const at = body.toLowerCase().indexOf(term);
      if (at === -1) return body.slice(0, 120);
      const from = Math.max(0, at - 48);
      return `${from > 0 ? "…" : ""}${body.slice(from, from + 150)}…`;
    };

    const render = (query) => {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (terms.length === 0 || !index) {
        resultsEl.innerHTML = `<p class="search-empty">Type to search ${index ? index.length : ""} pages.</p>`;
        items = [];
        return;
      }

      const ranked = index
        .map((page) => ({ page, rank: score(page, terms) }))
        .filter((entry) => entry.rank > 0)
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 8);

      if (ranked.length === 0) {
        resultsEl.innerHTML = `<p class="search-empty">No page matches “${escapeHtml(query)}”.</p>`;
        items = [];
        return;
      }

      // Offer the closest heading as the deep link when the query matched one.
      resultsEl.innerHTML = ranked
        .map(({ page }, i) => {
          const heading = page.h.find((h) => terms.some((term) => h.t.toLowerCase().includes(term)));
          const href = heading ? `${page.u}#${heading.i}` : page.u;
          const label = heading ? `${page.t} › ${heading.t}` : page.t;
          return `<a class="search-result" href="${href}" role="option" aria-selected="${i === 0}" data-i="${i}">
            <span class="search-result-group">${escapeHtml(page.g ?? "")}</span>
            <span class="search-result-title">${escapeHtml(label)}</span>
            <span class="search-result-snippet">${escapeHtml(snippet(page, terms[0]))}</span>
          </a>`;
        })
        .join("");

      items = [...resultsEl.querySelectorAll(".search-result")];
      cursor = 0;
    };

    const move = (delta) => {
      if (items.length === 0) return;
      items[cursor]?.setAttribute("aria-selected", "false");
      cursor = (cursor + delta + items.length) % items.length;
      const next = items[cursor];
      next.setAttribute("aria-selected", "true");
      next.scrollIntoView({ block: "nearest" });
    };

    const open = async () => {
      dialog.showModal();
      input.value = "";
      resultsEl.innerHTML = `<p class="search-empty">Loading index…</p>`;
      await load();
      render("");
      input.focus();
    };

    for (const trigger of triggers) trigger.addEventListener("click", open);

    input.addEventListener("input", () => render(input.value.trim()));

    dialog.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const target = items[cursor];
        if (target) window.location.href = target.getAttribute("href");
      }
    });

    // Clicking the backdrop closes the dialog; clicking inside must not.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    document.addEventListener("keydown", (event) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const isSlash = event.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
      if (isShortcut || isSlash) {
        event.preventDefault();
        if (!dialog.open) open();
      }
    });

    // Show the right shortcut hint: Ctrl on anything that is not a Mac.
    if (!/Mac|iP(hone|ad)/.test(navigator.platform ?? navigator.userAgent)) {
      for (const kbd of document.querySelectorAll(".search-trigger kbd")) kbd.textContent = "Ctrl K";
    }
  } else {
    // No dialog support, or no script-driven search: the trigger would be a
    // dead control, so send it to the sidebar instead of leaving it broken.
    for (const trigger of triggers) trigger.hidden = true;
  }
})();
