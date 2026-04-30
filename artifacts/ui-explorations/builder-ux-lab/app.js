const BLOCK_TYPES = [
  { kind: "container", label: "Container", isContainer: true },
  { kind: "field", label: "Field", isContainer: false },
];

const FIELD_TYPES = ["Text", "Dropdown", "Number", "Date", "Image"];

const state = {
  selectedBlockId: "lab_result",
  inspectorVisible: true,
  collapsedBlockIds: new Set(["patient_info"]),
  root: {
    id: "root",
    kind: "root",
    name: "Blood Bank Form",
    children: [
      {
        id: "patient_info",
        kind: "container",
        name: "Patient Info",
        children: [
          { id: "patient_name", kind: "field", name: "Name", fieldType: "Text", required: true },
          { id: "case_number", kind: "field", name: "Case Number", fieldType: "Text", required: true },
          {
            id: "demographics",
            kind: "container",
            name: "Demographics",
            children: [
              { id: "age", kind: "field", name: "Age", fieldType: "Text", required: false },
              { id: "sex", kind: "field", name: "Sex", fieldType: "Dropdown", required: false },
            ],
          },
        ],
      },
      {
        id: "lab_result",
        kind: "container",
        name: "Lab Result",
        children: [
          {
            id: "microscopic_findings",
            kind: "container",
            name: "Microscopic Findings",
            children: [
              { id: "rbc", kind: "field", name: "RBC", fieldType: "Text", required: false },
              { id: "wbc", kind: "field", name: "WBC", fieldType: "Text", required: false },
            ],
          },
          { id: "remarks", kind: "field", name: "Remarks", fieldType: "Text", required: false },
        ],
      },
    ],
  },
};

const outlineList = document.querySelector("#outlineList");
const contentEditor = document.querySelector("#contentEditor");
const inspectorPanel = document.querySelector("#inspectorPanel");
const inspectorContent = document.querySelector("#inspectorContent");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function blockType(kind) {
  return BLOCK_TYPES.find((type) => type.kind === kind) || { kind, label: kind, isContainer: false };
}

function isContainerBlock(block) {
  return block && (block.kind === "root" || block.kind === "container");
}

function walkBlocks(block, visitor, depth = 0, parent = null) {
  visitor(block, depth, parent);
  if (Array.isArray(block.children)) {
    block.children.forEach((child) => walkBlocks(child, visitor, depth + 1, block));
  }
}

function findBlock(blockId) {
  let found = null;
  walkBlocks(state.root, (block, depth, parent) => {
    if (block.id === blockId) {
      found = { block, parent, depth };
    }
  });
  return found;
}

function selectedBlock() {
  return findBlock(state.selectedBlockId)?.block || state.root;
}

function uniqueId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function countChildren(block) {
  return Array.isArray(block.children) ? block.children.length : 0;
}

function countDescendants(block) {
  let containers = 0;
  let fields = 0;
  if (!Array.isArray(block.children)) {
    return { containers, fields };
  }
  block.children.forEach((child) => {
    if (isContainerBlock(child)) {
      containers += 1;
      const nested = countDescendants(child);
      containers += nested.containers;
      fields += nested.fields;
    } else {
      fields += 1;
    }
  });
  return { containers, fields };
}

function isCollapsed(blockId) {
  return state.collapsedBlockIds.has(blockId);
}

function renderOutline() {
  const rows = [];
  walkBlocks(state.root, (block, depth) => {
    if (block.kind === "root") {
      return;
    }
    rows.push(`
      <button
        class="outline-item ${block.id === state.selectedBlockId ? "active" : ""}"
        style="--depth: ${Math.max(0, depth - 1)}"
        type="button"
        data-action="select-block"
        data-block-id="${escapeHtml(block.id)}"
      >
        <span class="outline-kind">${escapeHtml(blockType(block.kind).label)}</span>
        <strong>${escapeHtml(block.name)}</strong>
        <span>${isContainerBlock(block) ? countChildren(block) : escapeHtml(block.fieldType || "Field")}</span>
      </button>
    `);
  });
  outlineList.innerHTML = rows.join("");
}

function renderContentEditor() {
  contentEditor.innerHTML = `
    <article class="form-canvas-card">
      <div class="form-title-row">
        <label>
          <p class="eyebrow">Content canvas</p>
          <input value="${escapeHtml(state.root.name)}" data-action="rename-block" data-block-id="root" aria-label="Form name">
        </label>
        <div class="canvas-note">Only two content blocks: Container and Field. Containers can contain more containers or fields.</div>
      </div>
      <div class="block-tree">
        ${renderChildren(state.root, 0)}
      </div>
      ${renderAddContent(state.root)}
    </article>
  `;
}

function renderChildren(block, depth) {
  if (!Array.isArray(block.children) || block.children.length === 0) {
    return `
      <div class="empty-drop-zone">
        <strong>Empty container</strong>
        <span>Add a container or field here.</span>
      </div>
    `;
  }
  return block.children.map((child) => renderBlock(child, depth)).join("");
}

function renderBlock(block, depth) {
  const selected = block.id === state.selectedBlockId;
  const type = blockType(block.kind);
  const isContainer = isContainerBlock(block);
  const collapsed = isContainer && isCollapsed(block.id);
  const descendantCount = isContainer ? countDescendants(block) : { containers: 0, fields: 0 };
  return `
    <article class="lego-block lego-block--${escapeHtml(block.kind)} ${selected ? "active" : ""} ${collapsed ? "is-collapsed" : ""}" style="--depth: ${depth}" data-block-id="${escapeHtml(block.id)}">
      <div class="block-main-row">
        ${isContainer ? `
          <button class="collapse-button" type="button" data-action="toggle-collapse" data-block-id="${escapeHtml(block.id)}" aria-label="${collapsed ? "Expand" : "Collapse"} ${escapeHtml(block.name)}" aria-expanded="${collapsed ? "false" : "true"}">
            ${collapsed ? ">" : "v"}
          </button>
        ` : `
          <span class="collapse-placeholder" aria-hidden="true"></span>
        `}
        <button class="block-grip" type="button" data-action="select-block" data-block-id="${escapeHtml(block.id)}" aria-label="Select ${escapeHtml(block.name)}">::</button>
        <label class="block-name">
          <span>${escapeHtml(type.label)}</span>
          <input value="${escapeHtml(block.name)}" data-action="rename-block" data-block-id="${escapeHtml(block.id)}" aria-label="${escapeHtml(type.label)} name">
        </label>
        ${block.kind === "field" ? renderFieldControls(block) : `<span class="block-count">${descendantCount.containers} containers / ${descendantCount.fields} fields</span>`}
        <button class="icon-button" type="button" data-action="remove-block" data-block-id="${escapeHtml(block.id)}" aria-label="Remove ${escapeHtml(block.name)}">x</button>
      </div>
      ${isContainer && collapsed ? `
        <div class="collapsed-summary">
          <span>${countChildren(block)} direct blocks hidden</span>
          <button type="button" data-action="toggle-collapse" data-block-id="${escapeHtml(block.id)}">Expand to edit contents</button>
        </div>
      ` : ""}
      ${isContainer && !collapsed ? `
        <div class="block-children">
          ${renderChildren(block, depth + 1)}
        </div>
        ${renderAddContent(block)}
      ` : `
        <div class="field-inline-settings">
          <label>
            <input type="checkbox" data-action="toggle-required" data-block-id="${escapeHtml(block.id)}" ${block.required ? "checked" : ""}>
            Required
          </label>
          <span>Field captures one answer. Add related content inside its parent container.</span>
        </div>
      `}
    </article>
  `;
}

function renderFieldControls(block) {
  return `
    <select class="field-type-select" data-action="change-field-type" data-block-id="${escapeHtml(block.id)}" aria-label="Field type">
      ${FIELD_TYPES.map((type) => `
        <option value="${escapeHtml(type)}" ${block.fieldType === type ? "selected" : ""}>${escapeHtml(type)}</option>
      `).join("")}
    </select>
  `;
}

function renderAddContent(parentBlock) {
  return `
    <div class="add-content-bar" data-parent-id="${escapeHtml(parentBlock.id)}">
      <span>Add content here</span>
      <div>
        ${BLOCK_TYPES.map((type) => `
          <button type="button" data-action="add-block" data-parent-id="${escapeHtml(parentBlock.id)}" data-kind="${escapeHtml(type.kind)}">${escapeHtml(type.label)}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderInspector() {
  inspectorPanel.classList.toggle("is-hidden", !state.inspectorVisible);
  document.querySelector(".builder-frame").classList.toggle("inspector-hidden", !state.inspectorVisible);

  const block = selectedBlock();
  const isContainer = isContainerBlock(block);
  inspectorContent.innerHTML = `
    <div class="inspector-empty">
      <strong>${escapeHtml(block.name)}</strong>
      <span>${block.kind === "root" ? "Root form" : escapeHtml(blockType(block.kind).label)}</span>
      <span>${isContainer ? "Container: holds containers and fields." : "Field: captures one answer."}</span>
    </div>
  `;
}

function render() {
  renderOutline();
  renderContentEditor();
  renderInspector();
}

function addBlock(parentId, kind) {
  const found = findBlock(parentId);
  if (!found || !isContainerBlock(found.block)) {
    return;
  }
  if (!Array.isArray(found.block.children)) {
    found.block.children = [];
  }
  const id = uniqueId(kind);
  const nextBlock = kind === "container"
    ? { id, kind, name: "New Container", children: [] }
    : { id, kind, name: "New Field", fieldType: "Text", required: false };
  found.block.children.push(nextBlock);
  state.selectedBlockId = id;
}

function removeBlock(blockId) {
  const found = findBlock(blockId);
  if (!found || !found.parent || !Array.isArray(found.parent.children)) {
    return;
  }
  found.parent.children = found.parent.children.filter((block) => block.id !== blockId);
  state.selectedBlockId = found.parent.id === "root" ? found.parent.children[0]?.id || "root" : found.parent.id;
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  if (action === "select-block") {
    state.selectedBlockId = target.dataset.blockId || state.selectedBlockId;
    render();
  }

  if (action === "toggle-inspector") {
    state.inspectorVisible = !state.inspectorVisible;
    render();
  }

  if (action === "toggle-collapse") {
    const blockId = target.dataset.blockId;
    if (state.collapsedBlockIds.has(blockId)) {
      state.collapsedBlockIds.delete(blockId);
    } else if (blockId && blockId !== "root") {
      state.collapsedBlockIds.add(blockId);
    }
    state.selectedBlockId = blockId || state.selectedBlockId;
    render();
  }

  if (action === "add-root-container") {
    addBlock("root", "container");
    render();
  }

  if (action === "add-block") {
    addBlock(target.dataset.parentId, target.dataset.kind);
    render();
  }

  if (action === "remove-block") {
    removeBlock(target.dataset.blockId);
    render();
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.dataset.action !== "rename-block") {
    return;
  }
  const found = findBlock(target.dataset.blockId);
  if (found) {
    found.block.name = target.value;
    state.selectedBlockId = found.block.id;
    renderOutline();
    renderInspector();
  }
});

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const blockEl = target.closest("[data-block-id]");
  if (blockEl?.dataset.blockId && blockEl.dataset.blockId !== state.selectedBlockId) {
    state.selectedBlockId = blockEl.dataset.blockId;
    renderOutline();
    renderInspector();
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.dataset.action === "change-field-type") {
    const found = findBlock(target.dataset.blockId);
    if (found) {
      found.block.fieldType = target.value;
      render();
    }
  }
  if (target instanceof HTMLInputElement && target.dataset.action === "toggle-required") {
    const found = findBlock(target.dataset.blockId);
    if (found) {
      found.block.required = target.checked;
      render();
    }
  }
});

render();
