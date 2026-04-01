const searchEl = document.getElementById("librarySearch");
const groupSections = [...document.querySelectorAll(".group-section")];
const jumpLinks = [...document.querySelectorAll(".group-jump-link")];
const emptyStateEl = document.getElementById("emptySearchState");
const extraGroupsEl = document.querySelector("[data-extra-groups]");

function applyLibraryFilter() {
  const query = String(searchEl?.value || "").trim().toLowerCase();
  let visibleGroupCount = 0;
  let visibleExtraGroupCount = 0;

  groupSections.forEach((section) => {
    const groupName = String(section.dataset.groupName || "");
    const cards = [...section.querySelectorAll(".form-card")];
    const groupMatch = !query || groupName.includes(query);
    let visibleCards = 0;

    cards.forEach((card) => {
      const formName = String(card.dataset.formName || "");
      const formGroup = String(card.dataset.groupName || "");
      const match = groupMatch || `${groupName} ${formName} ${formGroup}`.includes(query);
      card.classList.toggle("hidden", !match);
      if (match) {
        visibleCards += 1;
      }
    });

    const groupVisible = visibleCards > 0;
    section.classList.toggle("hidden", !groupVisible);
    if (groupVisible) {
      visibleGroupCount += 1;
      if (section.closest("[data-extra-groups]")) {
        visibleExtraGroupCount += 1;
      }
    }
  });

  jumpLinks.forEach((link) => {
    const groupToken = String(link.dataset.groupLink || "");
    const related = groupSections.find((section) => String(section.dataset.groupName || "") === groupToken);
    link.classList.toggle("hidden", Boolean(related?.classList.contains("hidden")));
  });

  emptyStateEl?.classList.toggle("hidden", visibleGroupCount > 0);

  if (extraGroupsEl) {
    if (query) {
      extraGroupsEl.classList.toggle("hidden", visibleExtraGroupCount === 0);
      extraGroupsEl.open = visibleExtraGroupCount > 0;
    } else {
      extraGroupsEl.classList.remove("hidden");
      extraGroupsEl.open = false;
    }
  }
}

if (searchEl) {
  searchEl.addEventListener("input", applyLibraryFilter);
}

applyLibraryFilter();
