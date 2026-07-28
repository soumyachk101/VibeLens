/*
  VibeLens docs — progressive enhancement only.
  Every page is fully readable and navigable with this file blocked.
*/

(() => {
  "use strict";

  // --- theme -----------------------------------------------------------------
  // The inline script in <head> has already applied the stored theme to avoid a
  // flash; this only wires the toggle.
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");

  if (toggle) {
    const sync = () => {
      const dark = root.dataset.theme !== "light";
      toggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
      toggle.setAttribute("aria-pressed", String(dark));
    };
    sync();
    toggle.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      try {
        localStorage.setItem("vibelens-theme", root.dataset.theme);
      } catch {
        // Private mode or blocked storage: the toggle still works per-page.
      }
      sync();
    });
  }

  // --- sidebar on small screens ---------------------------------------------
  const navToggle = document.querySelector("[data-nav-toggle]");
  const sidebar = document.querySelector(".sidebar");

  if (navToggle && sidebar) {
    const setOpen = (open) => {
      sidebar.dataset.open = String(open);
      navToggle.setAttribute("aria-expanded", String(open));
    };
    setOpen(false);
    navToggle.addEventListener("click", () => setOpen(sidebar.dataset.open !== "true"));
    // Closing on navigation matters because the panel overlays the content.
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
      // Feedback has to be immediate and then get out of the way.
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
    const byId = new Map(
      tocLinks.map((link) => [decodeURIComponent(link.hash.slice(1)), link]),
    );
    const headings = [...byId.keys()]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

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
      // Bias the band toward the top of the viewport so the highlighted entry
      // matches what the reader is actually looking at.
      { rootMargin: "-72px 0px -70% 0px", threshold: 0 },
    );

    for (const heading of headings) observer.observe(heading);
  }
})();
