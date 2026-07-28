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

  // --- Toast Notification Handler ---------------------------------------------
  let toastTimer = null;
  const showToast = (text = "Copied to clipboard!") => {
    let toast = document.querySelector(".site-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "site-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>${text}</span>`;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2200);
  };

  // --- Click-to-Copy for Code Blocks ------------------------------------------
  for (const block of document.querySelectorAll(".code-block")) {
    const code = block.querySelector("code");
    if (!code || !navigator.clipboard) continue;

    const copyText = async (e) => {
      // Don't trigger if user is selecting text manually
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;

      const text = code.innerText.trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        showToast("Copied code to clipboard!");
        block.classList.add("copied-pulse");
        setTimeout(() => block.classList.remove("copied-pulse"), 1200);
      } catch (err) {}
    };

    block.style.cursor = "pointer";
    block.setAttribute("title", "Click anywhere to copy code");
    block.addEventListener("click", copyText);
  }

  // --- Click-to-Copy for Hero Terminal & Install Lines ------------------------
  const installLines = document.querySelectorAll("[data-copy-cmd], .hero-terminal, .install-line");
  for (const line of installLines) {
    const textToCopy = line.getAttribute("data-copy-cmd") || line.innerText.replace(/^\$\s*/, "").trim();
    if (!textToCopy) continue;

    line.style.cursor = "pointer";
    line.setAttribute("title", "Click anywhere to copy command");

    const doCopy = async (e) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(textToCopy);
        showToast("Copied command to clipboard!");
        line.classList.add("copied-pulse");
        setTimeout(() => line.classList.remove("copied-pulse"), 1200);
      } catch (err) {}
    };

    line.addEventListener("click", doCopy);
  }

  // --- Click-to-Copy for Inline Command Badges -------------------------------
  for (const inlineCode of document.querySelectorAll(".prose p code, .prose li code")) {
    const text = inlineCode.innerText.trim();
    if (/^(claude|npx|npm|git|codex|vibelens|playwright)/i.test(text) && text.length > 3) {
      inlineCode.style.cursor = "pointer";
      inlineCode.setAttribute("title", "Click to copy command");
      inlineCode.classList.add("clickable-cmd");
      inlineCode.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          showToast(`Copied "${text}"`);
          inlineCode.classList.add("copied-pulse");
          setTimeout(() => inlineCode.classList.remove("copied-pulse"), 800);
        } catch (err) {}
      });
    }
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

    /**
     * Pulls a snippet around the first match. The window is snapped to word
     * boundaries, because a snippet that starts mid-word reads as a bug.
     */
    const snippet = (page, term) => {
      const body = page.b;
      const at = body.toLowerCase().indexOf(term);
      if (at === -1) return body.slice(0, 140).replace(/\s+\S*$/, "…");

      let from = Math.max(0, at - 52);
      if (from > 0) {
        const space = body.indexOf(" ", from);
        if (space !== -1 && space < at) from = space + 1;
      }
      const slice = body.slice(from, from + 160).replace(/\s+\S*$/, "");
      return `${from > 0 ? "… " : ""}${slice}…`;
    };

    /** Wraps every occurrence of a term so the reader sees why it matched. */
    const highlight = (text, terms) => {
      let out = escapeHtml(text);
      for (const term of terms) {
        if (term.length < 2) continue;
        const pattern = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
        out = out.replace(pattern, "<mark>$1</mark>");
      }
      return out;
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
            <span class="search-result-title">${highlight(label, terms)}</span>
            <span class="search-result-snippet">${highlight(snippet(page, terms[0]), terms)}</span>
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
    for (const trigger of triggers) trigger.hidden = true;
  }

  // --- interactive demo simulator --------------------------------------------
  const demoTabs = document.querySelectorAll(".demo-tab");
  const demoPanes = document.querySelectorAll(".demo-pane");
  const runDemoBtn = document.querySelector("#run-demo-btn");
  const demoSection = document.querySelector("#demo-simulator");

  if (demoTabs.length && demoPanes.length) {
    let isRunning = false;

    const switchTab = (tabName) => {
      demoTabs.forEach((t) => {
        const match = t.dataset.tab === tabName;
        t.classList.toggle("active", match);
        if (match) t.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      });
      demoPanes.forEach((p) => p.classList.toggle("active", p.id === `pane-${tabName}`));
    };

    demoTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        if (!isRunning) switchTab(tab.dataset.tab);
      });
    });

    if (runDemoBtn) {
      const stages = [
        { id: "screenshot", label: "📸 Capturing viewport screenshot…" },
        { id: "console",    label: "🚨 Reading console errors & network…" },
        { id: "dom",        label: "🌳 Extracting token-reduced DOM…" },
        { id: "ai-fix",     label: "✨ AI verifies the fix — done!" },
      ];
      const STEP_MS = 2200;

      runDemoBtn.addEventListener("click", () => {
        if (isRunning) return;
        isRunning = true;

        // Scroll the demo section into view so the user can actually see it
        if (demoSection) {
          demoSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        runDemoBtn.disabled = true;
        runDemoBtn.style.opacity = "0.7";
        const originalText = runDemoBtn.textContent;

        let step = 0;
        const advance = () => {
          if (step >= stages.length) {
            // Done — reset
            runDemoBtn.textContent = originalText;
            runDemoBtn.disabled = false;
            runDemoBtn.style.opacity = "";
            isRunning = false;
            return;
          }
          const s = stages[step];
          switchTab(s.id);
          runDemoBtn.textContent = `Step ${step + 1}/4 · ${s.label}`;
          showToast(s.label);
          step++;
          setTimeout(advance, STEP_MS);
        };
        advance();
      });
    }
  }
})();

