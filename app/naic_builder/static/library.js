const searchEl = document.getElementById("librarySearch");
const libraryRootEl = document.querySelector("[data-library-root]");
const rootNodes = [...(libraryRootEl?.children || [])].filter((node) => node.dataset?.nodeKind);
const jumpLinks = [...document.querySelectorAll("[data-jump-link]")];
const emptyStateEl = document.getElementById("emptySearchState");

function childNodesOf(node) {
  const childrenWrap = node.querySelector(":scope > .tree-node-body > .tree-children");
  return [...(childrenWrap?.children || [])].filter((child) => child.dataset?.nodeKind);
}

function filterNode(node, query) {
  const searchText = String(node.dataset.searchText || "");
  const ownMatch = !query || searchText.includes(query);
  const childNodes = childNodesOf(node);
  let childVisible = false;

  childNodes.forEach((child) => {
    if (filterNode(child, query)) {
      childVisible = true;
    }
  });

  const visible = ownMatch || childVisible;
  node.classList.toggle("hidden", !visible);

  if (node instanceof HTMLDetailsElement) {
    const defaultOpen = String(node.dataset.defaultOpen || "") === "true";
    node.open = query ? visible : defaultOpen;
  }

  return visible;
}

function applyLibraryFilter() {
  const query = String(searchEl?.value || "").trim().toLowerCase();
  let visibleRootCount = 0;

  rootNodes.forEach((node) => {
    if (filterNode(node, query)) {
      visibleRootCount += 1;
    }
  });

  jumpLinks.forEach((link) => {
    const nodeId = String(link.dataset.jumpLink || "");
    const related = rootNodes.find((node) => String(node.dataset.nodeId || "") === nodeId);
    link.classList.toggle("hidden", !related || related.classList.contains("hidden"));
  });

  emptyStateEl?.classList.toggle("hidden", visibleRootCount > 0);
}

if (searchEl) {
  searchEl.addEventListener("input", applyLibraryFilter);
}

applyLibraryFilter();
