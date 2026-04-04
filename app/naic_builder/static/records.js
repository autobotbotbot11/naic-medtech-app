(() => {
  const guardedForms = document.querySelectorAll("[data-dirty-guard]");
  if (!guardedForms.length) {
    return;
  }

  guardedForms.forEach((form) => {
    const statusEl = form.querySelector("[data-dirty-state]");
    let dirty = false;
    let allowUnload = false;

    const setDirty = (value) => {
      dirty = value;
      if (!statusEl) {
        return;
      }
      statusEl.textContent = dirty ? "Unsaved changes." : "All changes saved.";
      statusEl.classList.toggle("is-dirty", dirty);
    };

    const markDirty = () => {
      if (!dirty) {
        setDirty(true);
      }
    };

    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);

    form.querySelectorAll('button[type="submit"], input[type="submit"]').forEach((button) => {
      button.addEventListener("click", () => {
        allowUnload = true;
        if (statusEl) {
          statusEl.textContent = "Saving...";
          statusEl.classList.remove("is-dirty");
        }
      });
    });

    form.addEventListener("submit", () => {
      allowUnload = true;
    });

    window.addEventListener("beforeunload", (event) => {
      if (!dirty || allowUnload) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    });
  });
})();
