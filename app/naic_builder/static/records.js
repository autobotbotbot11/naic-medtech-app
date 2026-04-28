(() => {
  const setupDirtyGuards = () => {
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
  };

  const setupRecordStartModal = () => {
    const modal = document.querySelector("[data-record-start-modal]");
    if (!modal) {
      return;
    }

    const formSelect = modal.querySelector('select[name="form_slug"]');
    const dialog = modal.querySelector("[data-record-start-dialog]");

    const openModal = () => {
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("record-start-open");
      window.requestAnimationFrame(() => {
        formSelect?.focus();
      });
    };

    const closeModal = () => {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("record-start-open");
    };

    document.querySelectorAll("[data-record-start-trigger]").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        openModal();
      });
    });

    modal.querySelectorAll("[data-record-start-close]").forEach((button) => {
      button.addEventListener("click", () => {
        closeModal();
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeModal();
      }
    });

    dialog?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    if (modal.dataset.startOpen === "true") {
      openModal();
    }
  };

  setupDirtyGuards();
  setupRecordStartModal();
})();
