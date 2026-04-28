(() => {
  const body = document.body;
  const drawer = document.querySelector("[data-shell-drawer]");
  const scrim = document.querySelector("[data-shell-drawer-scrim]");
  const toggles = Array.from(document.querySelectorAll("[data-shell-drawer-toggle]"));
  const closers = Array.from(document.querySelectorAll("[data-shell-drawer-close]"));

  if (!body || !drawer || !toggles.length) {
    return;
  }

  const openClass = "shell-drawer-open";

  const syncState = () => {
    const isOpen = body.classList.contains(openClass);

    drawer.hidden = !isOpen;
    drawer.toggleAttribute("inert", !isOpen);
    drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");

    if (scrim) {
      scrim.hidden = !isOpen;
    }

    toggles.forEach((button) => {
      button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  };

  const openDrawer = () => {
    body.classList.add(openClass);
    syncState();
  };

  const closeDrawer = () => {
    body.classList.remove(openClass);
    syncState();
  };

  toggles.forEach((button) => {
    button.addEventListener("click", () => {
      if (body.classList.contains(openClass)) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
  });

  closers.forEach((button) => {
    button.addEventListener("click", closeDrawer);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && body.classList.contains(openClass)) {
      closeDrawer();
    }
  });

  syncState();
})();
