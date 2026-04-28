(() => {
  const userSearch = document.getElementById("userSearch");
  const userCards = Array.from(document.querySelectorAll("[data-user-card]"));
  const filterButtons = Array.from(document.querySelectorAll("[data-user-filter]"));
  const emptyState = document.querySelector("[data-user-empty]");

  if (!userCards.length) {
    return;
  }

  let activeStatus = "all";

  const applyFilters = () => {
    const query = String(userSearch?.value || "").trim().toLowerCase();
    let visibleCount = 0;

    userCards.forEach((card) => {
      const status = String(card.dataset.userStatus || "");
      const searchText = String(card.dataset.userSearch || "");
      const statusMatch = activeStatus === "all" || status === activeStatus;
      const queryMatch = !query || searchText.includes(query);
      const isVisible = statusMatch && queryMatch;
      card.hidden = !isVisible;
      if (isVisible) {
        visibleCount += 1;
      }
    });

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }
  };

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeStatus = String(button.dataset.userFilter || "all");
      filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      applyFilters();
    });
  });

  userSearch?.addEventListener("input", applyFilters);
  applyFilters();
})();
