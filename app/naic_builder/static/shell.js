(() => {
  const body = document.body;
  const sidebar = document.querySelector("[data-shell-sidebar]");
  const scrim = document.querySelector("[data-shell-drawer-scrim]");
  const toggles = Array.from(document.querySelectorAll("[data-shell-drawer-toggle]"));
  const closers = Array.from(document.querySelectorAll("[data-shell-drawer-close]"));

  if (!body || !sidebar || !toggles.length) {
    return;
  }

  const media = window.matchMedia("(max-width: 1080px)");

  const syncState = () => {
    const isMobile = media.matches;
    const isOpen = body.classList.contains("shell-nav-open");

    if (!isMobile) {
      body.classList.remove("shell-nav-open");
      sidebar.setAttribute("aria-hidden", "false");
      if (scrim) {
        scrim.hidden = true;
      }
      toggles.forEach((button) => button.setAttribute("aria-expanded", "false"));
      return;
    }

    sidebar.setAttribute("aria-hidden", isOpen ? "false" : "true");
    if (scrim) {
      scrim.hidden = !isOpen;
    }
    toggles.forEach((button) => button.setAttribute("aria-expanded", isOpen ? "true" : "false"));
  };

  const openSidebar = () => {
    if (!media.matches) {
      return;
    }
    body.classList.add("shell-nav-open");
    syncState();
  };

  const closeSidebar = () => {
    body.classList.remove("shell-nav-open");
    syncState();
  };

  toggles.forEach((button) => {
    button.addEventListener("click", () => {
      if (!media.matches) {
        return;
      }
      if (body.classList.contains("shell-nav-open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  });

  closers.forEach((button) => {
    button.addEventListener("click", closeSidebar);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && body.classList.contains("shell-nav-open")) {
      closeSidebar();
    }
  });

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", syncState);
  } else if (typeof media.addListener === "function") {
    media.addListener(syncState);
  }

  syncState();
})();
