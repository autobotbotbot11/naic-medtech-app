(() => {
  const body = document.body;
  const panel = document.querySelector("[data-shell-panel]");
  const scrim = document.querySelector("[data-shell-panel-scrim]");
  const toggles = Array.from(document.querySelectorAll("[data-shell-panel-toggle]"));
  const closers = Array.from(document.querySelectorAll("[data-shell-panel-close]"));

  if (!body || !panel || !toggles.length) {
    return;
  }

  const mobile = window.matchMedia("(max-width: 1080px)");
  const openClass = "shell-panel-open";

  const syncState = () => {
    const isOpen = body.classList.contains(openClass);

    panel.hidden = !isOpen;
    panel.toggleAttribute("inert", !isOpen);
    panel.setAttribute("aria-hidden", isOpen ? "false" : "true");

    if (scrim) {
      scrim.hidden = !isOpen;
    }

    toggles.forEach((button) => {
      button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    if (!mobile.matches) {
      body.classList.remove("shell-nav-open");
    }
  };

  const openPanel = () => {
    body.classList.add(openClass);
    syncState();
  };

  const closePanel = () => {
    body.classList.remove(openClass);
    syncState();
  };

  toggles.forEach((button) => {
    button.addEventListener("click", () => {
      if (body.classList.contains(openClass)) {
        closePanel();
      } else {
        openPanel();
      }
    });
  });

  closers.forEach((button) => {
    button.addEventListener("click", closePanel);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && body.classList.contains(openClass)) {
      closePanel();
    }
  });

  if (typeof mobile.addEventListener === "function") {
    mobile.addEventListener("change", syncState);
  } else if (typeof mobile.addListener === "function") {
    mobile.addListener(syncState);
  }

  syncState();
})();
