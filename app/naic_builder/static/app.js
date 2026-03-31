const state = {
  bootstrap: null,
  selectedFormSlug: null,
  loadedForm: null,
  draft: null,
  selectedPath: ["meta"],
  dirty: false,
};

const formListEl = document.getElementById("formList");
const formSearchEl = document.getElementById("formSearch");
const statusTextEl = document.getElementById("statusText");
const dirtyBadgeEl = document.getElementById("dirtyBadge");
const structureTreeEl = document.getElementById("structureTree");
const inspectorContentEl = document.getElementById("inspectorContent");
const previewCanvasEl = document.getElementById("previewCanvas");
const jsonOutputEl = document.getElementById("jsonOutput");
const selectionHintEl = document.getElementById("selectionHint");

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json();
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function splitLines(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function pathKey(path) {
  return JSON.stringify(path);
}

function isSelected(path) {
  return pathKey(path) === pathKey(state.selectedPath);
}

function getNodeByPath(path) {
  let cursor = state.draft;
  for (const segment of path) {
    cursor = cursor?.[segment];
  }
  return cursor;
}

function getParentCollection(path) {
  const parentPath = path.slice(0, -1);
  return {
    collection: getNodeByPath(parentPath),
    index: path[path.length - 1],
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function makeBlankField(kind = "field") {
  if (kind === "field_group") {
    return {
      name: "New Field Group",
      key: "new_field_group",
      kind: "field_group",
      notes: [],
      fields: [],
    };
  }

  return {
    name: "New Field",
    key: "new_field",
    kind: "field",
    control: "input",
    data_type: "text",
    unit_hint: "",
    normal_value: "",
    notes: [],
    options: [],
  };
}

function makeBlankSection() {
  return {
    name: "New Section",
    key: "new_section",
    notes: [],
    fields: [],
  };
}

function makeBlankForm() {
  return {
    slug: null,
    name: "Untitled Form",
    group_name: "New Group",
    group_kind: "category",
    group_order: 999,
    form_order: 1,
    current_version_number: 0,
    summary: "",
    schema: {
      name: "Untitled Form",
      key: "untitled_form",
      order: 1,
      common_field_set_id: "default_lab_request",
      notes: [],
      fields: [],
      sections: [],
    },
  };
}

function setDirty(value) {
  state.dirty = value;
  dirtyBadgeEl.classList.toggle("hidden", !value);
}

function setStatus(message, isError = false) {
  statusTextEl.textContent = message;
  statusTextEl.style.color = isError ? "#9f3d17" : "";
}

function syncDraftKeys() {
  if (!state.draft) {
    return;
  }
  if (!state.draft.schema.key) {
    state.draft.schema.key = slugify(state.draft.name);
  }
  if (!state.draft.schema.name) {
    state.draft.schema.name = state.draft.name;
  }
}

function renderAll() {
  renderFormList();
  renderStructure();
  renderInspector();
  renderPreview();
  renderJson();
}

async function bootstrap() {
  setStatus("Loading builder...");
  state.bootstrap = await api("/api/builder/bootstrap");
  renderFormList();

  if (state.bootstrap.selected_form_slug) {
    await loadForm(state.bootstrap.selected_form_slug);
  } else {
    startNewForm();
  }
}

async function loadForm(slug) {
  if (state.dirty && !window.confirm("You have unsaved changes. Continue and discard them?")) {
    return;
  }

  const form = await api(`/api/forms/${slug}`);
  state.selectedFormSlug = slug;
  state.loadedForm = form;
  state.draft = deepClone(form);
  state.selectedPath = ["meta"];
  setDirty(false);
  setStatus(`Loaded ${form.name} (v${form.current_version_number}).`);
  renderAll();
}

function startNewForm() {
  state.selectedFormSlug = null;
  state.loadedForm = null;
  state.draft = makeBlankForm();
  state.selectedPath = ["meta"];
  setDirty(true);
  setStatus("Creating a new unsaved form.");
  renderAll();
}

function groupedForms() {
  return state.bootstrap?.groups || [];
}

function renderFormList() {
  const query = formSearchEl.value.trim().toLowerCase();
  formListEl.innerHTML = "";

  for (const group of groupedForms()) {
    const matching = group.forms.filter((form) => {
      if (!query) {
        return true;
      }
      return `${group.name} ${form.name}`.toLowerCase().includes(query);
    });

    if (!matching.length) {
      continue;
    }

    const block = document.createElement("section");
    block.className = "group-block";
    block.innerHTML = `<div class="group-title">${group.name}</div>`;

    matching.forEach((form) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "form-link";
      if (form.slug === state.selectedFormSlug) {
        button.classList.add("active");
      }
      button.innerHTML = `<strong>${form.name}</strong><span class="meta">v${form.current_version_number} | order ${form.form_order}</span>`;
      button.addEventListener("click", () => void loadForm(form.slug));
      block.appendChild(button);
    });

    formListEl.appendChild(block);
  }

  if (!formListEl.children.length) {
    formListEl.innerHTML = '<div class="empty-state">No matching forms found.</div>';
  }
}

function renderStructure() {
  structureTreeEl.innerHTML = "";
  if (!state.draft) {
    structureTreeEl.innerHTML = '<div class="empty-state">No draft loaded.</div>';
    return;
  }

  structureTreeEl.appendChild(renderMetaCard());
  structureTreeEl.appendChild(renderTopLevelFields());
  structureTreeEl.appendChild(renderSections());
}

function renderMetaCard() {
  const card = document.createElement("section");
  card.className = "meta-card";
  if (isSelected(["meta"])) {
    card.style.borderColor = "rgba(24, 92, 74, 0.35)";
    card.style.background = "var(--accent-soft)";
  }
  card.innerHTML = `
    <div class="block-head">
      <div>
        <div class="block-title">Form Meta</div>
        <div class="hint">${state.draft.group_name} | ${state.draft.group_kind}</div>
      </div>
      <button class="ghost mini-btn" type="button">Edit</button>
    </div>
    <div class="hint">${state.draft.name} | version ${state.draft.current_version_number || 0}</div>
  `;
  card.querySelector("button").addEventListener("click", () => {
    state.selectedPath = ["meta"];
    renderStructure();
    renderInspector();
  });
  card.addEventListener("click", () => {
    state.selectedPath = ["meta"];
    renderStructure();
    renderInspector();
  });
  return card;
}

function renderTopLevelFields() {
  const block = document.createElement("section");
  block.className = "block";
  block.innerHTML = `
    <div class="block-head">
      <div class="block-title">Top-Level Fields</div>
      <div class="hint">${normalizeArray(state.draft.schema.fields).length} items</div>
    </div>
  `;

  const list = document.createElement("div");
  list.className = "item-list";
  const fields = normalizeArray(state.draft.schema.fields);
  if (!fields.length) {
    list.innerHTML = '<div class="empty-state">No top-level fields yet. Use "Add Field" or "Add Field Group".</div>';
  } else {
    fields.forEach((field, index) => {
      list.appendChild(renderFieldRow(field, ["schema", "fields", index]));
    });
  }
  block.appendChild(list);
  return block;
}

function renderSections() {
  const block = document.createElement("section");
  block.className = "block";
  block.innerHTML = `
    <div class="block-head">
      <div class="block-title">Sections</div>
      <div class="hint">${normalizeArray(state.draft.schema.sections).length} sections</div>
    </div>
  `;

  const list = document.createElement("div");
  list.className = "item-list";
  const sections = normalizeArray(state.draft.schema.sections);
  if (!sections.length) {
    list.innerHTML = '<div class="empty-state">No sections yet. Use "Add Section".</div>';
  } else {
    sections.forEach((section, index) => {
      list.appendChild(renderSectionShell(section, ["schema", "sections", index]));
    });
  }
  block.appendChild(list);
  return block;
}

function renderSectionShell(section, path) {
  const wrapper = document.createElement("div");
  wrapper.className = "section-shell";

  const row = document.createElement("div");
  row.className = "item-row";
  if (isSelected(path)) {
    row.classList.add("selected");
  }
  row.innerHTML = `
    <div class="item-meta">
      <span class="item-kind">Section</span>
      <strong>${section.name || "Untitled Section"}</strong>
      <span class="item-sub">${normalizeArray(section.fields).length} fields</span>
    </div>
  `;
  row.appendChild(buildRowActions(path));
  row.addEventListener("click", (event) => {
    if (event.target.closest(".item-actions")) {
      return;
    }
    state.selectedPath = path;
    renderStructure();
    renderInspector();
  });
  wrapper.appendChild(row);

  const children = document.createElement("div");
  children.className = "item-list nested";
  if (!normalizeArray(section.fields).length) {
    children.innerHTML = '<div class="empty-state">No fields in this section yet.</div>';
  } else {
    normalizeArray(section.fields).forEach((field, index) => {
      children.appendChild(renderFieldRow(field, [...path, "fields", index]));
    });
  }
  wrapper.appendChild(children);

  const addBar = document.createElement("div");
  addBar.className = "item-actions nested";
  addBar.innerHTML = `
    <button class="ghost mini-btn" type="button">Add Field</button>
    <button class="ghost mini-btn" type="button">Add Field Group</button>
  `;
  addBar.children[0].addEventListener("click", () => addFieldAt([...path, "fields"], "field"));
  addBar.children[1].addEventListener("click", () => addFieldAt([...path, "fields"], "field_group"));
  wrapper.appendChild(addBar);

  return wrapper;
}

function renderFieldRow(field, path) {
  const row = document.createElement("div");
  row.className = "item-row";
  if (isSelected(path)) {
    row.classList.add("selected");
  }

  const options = normalizeArray(field.options);
  const children = normalizeArray(field.fields);
  const descriptor =
    field.kind === "field_group"
      ? `${children.length} child fields`
      : `${field.control || "input"} | ${field.data_type || "text"}${options.length ? ` | ${options.length} options` : ""}`;

  row.innerHTML = `
    <div class="item-meta">
      <span class="item-kind">${field.kind === "field_group" ? "Field Group" : "Field"}</span>
      <strong>${field.name || "Untitled Field"}</strong>
      <span class="item-sub">${descriptor}</span>
    </div>
  `;
  row.appendChild(buildRowActions(path));
  row.addEventListener("click", (event) => {
    if (event.target.closest(".item-actions")) {
      return;
    }
    state.selectedPath = path;
    renderStructure();
    renderInspector();
  });

  const wrapper = document.createElement("div");
  wrapper.appendChild(row);

  if (field.kind === "field_group") {
    const childList = document.createElement("div");
    childList.className = "item-list nested";
    if (!children.length) {
      childList.innerHTML = '<div class="empty-state">No child fields yet.</div>';
    } else {
      children.forEach((child, index) => {
        childList.appendChild(renderFieldRow(child, [...path, "fields", index]));
      });
    }
    wrapper.appendChild(childList);

    const addBar = document.createElement("div");
    addBar.className = "item-actions nested";
    addBar.innerHTML = '<button class="ghost mini-btn" type="button">Add Child Field</button>';
    addBar.children[0].addEventListener("click", () => addFieldAt([...path, "fields"], "field"));
    wrapper.appendChild(addBar);
  }

  return wrapper;
}

function buildRowActions(path) {
  const actions = document.createElement("div");
  actions.className = "item-actions";
  actions.innerHTML = `
    <button class="ghost mini-btn" type="button">Up</button>
    <button class="ghost mini-btn" type="button">Down</button>
    <button class="ghost mini-btn" type="button">Delete</button>
  `;
  actions.children[0].addEventListener("click", (event) => {
    event.stopPropagation();
    moveAtPath(path, -1);
  });
  actions.children[1].addEventListener("click", (event) => {
    event.stopPropagation();
    moveAtPath(path, 1);
  });
  actions.children[2].addEventListener("click", (event) => {
    event.stopPropagation();
    deleteAtPath(path);
  });
  return actions;
}

function moveAtPath(path, delta) {
  const { collection, index } = getParentCollection(path);
  if (!Array.isArray(collection)) {
    return;
  }
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= collection.length) {
    return;
  }
  const [item] = collection.splice(index, 1);
  collection.splice(nextIndex, 0, item);
  state.selectedPath = [...path.slice(0, -1), nextIndex];
  setDirty(true);
  renderAll();
}

function deleteAtPath(path) {
  const { collection, index } = getParentCollection(path);
  if (!Array.isArray(collection)) {
    return;
  }
  collection.splice(index, 1);
  state.selectedPath = ["meta"];
  setDirty(true);
  renderAll();
}

function addFieldAt(path, kind) {
  const collection = getNodeByPath(path);
  if (!Array.isArray(collection)) {
    return;
  }
  collection.push(makeBlankField(kind));
  state.selectedPath = [...path, collection.length - 1];
  setDirty(true);
  renderAll();
}

function addSection() {
  state.draft.schema.sections.push(makeBlankSection());
  state.selectedPath = ["schema", "sections", state.draft.schema.sections.length - 1];
  setDirty(true);
  renderAll();
}

function renderInspector() {
  inspectorContentEl.innerHTML = "";
  if (!state.draft) {
    inspectorContentEl.innerHTML = '<div class="empty-state">Nothing selected.</div>';
    return;
  }

  if (state.selectedPath.length === 1 && state.selectedPath[0] === "meta") {
    selectionHintEl.textContent = "Editing form meta.";
    inspectorContentEl.appendChild(renderMetaInspector());
    return;
  }

  const node = getNodeByPath(state.selectedPath);
  if (!node) {
    inspectorContentEl.innerHTML = '<div class="empty-state">Select a node to edit its properties.</div>';
    return;
  }

  const isSection =
    state.selectedPath.includes("sections") &&
    state.selectedPath[state.selectedPath.length - 2] === "sections";

  if (isSection) {
    selectionHintEl.textContent = "Editing section.";
    inspectorContentEl.appendChild(renderSectionInspector(node));
    return;
  }

  selectionHintEl.textContent = node.kind === "field_group" ? "Editing field group." : "Editing field.";
  inspectorContentEl.appendChild(renderFieldInspector(node));
}

function renderMetaInspector() {
  const card = document.createElement("section");
  card.className = "inspector-card";
  card.innerHTML = `
    <div class="inspector-header">
      <h3>Form Meta</h3>
      <span class="hint">${state.selectedFormSlug ? "Existing form" : "Unsaved draft"}</span>
    </div>
    <div class="field-grid two">
      <label class="field-label">Form Name<input data-bind="name" value="${escapeHtml(state.draft.name)}"></label>
      <label class="field-label">Form Key<input data-bind="schema.key" value="${escapeHtml(state.draft.schema.key || "")}"></label>
      <label class="field-label">Group Name<input data-bind="group_name" value="${escapeHtml(state.draft.group_name)}"></label>
      <label class="field-label">Group Kind
        <select data-bind="group_kind">
          <option value="category">Category</option>
          <option value="standalone_form">Standalone Form</option>
        </select>
      </label>
      <label class="field-label">Group Order<input data-bind="group_order" type="number" value="${state.draft.group_order}"></label>
      <label class="field-label">Form Order<input data-bind="form_order" type="number" value="${state.draft.form_order}"></label>
      <label class="field-label">Common Field Set
        <select data-bind="schema.common_field_set_id"></select>
      </label>
    </div>
    <label class="field-label">Form Notes<textarea data-bind="schema.notes">${escapeHtml(normalizeArray(state.draft.schema.notes).join("\n"))}</textarea></label>
    <label class="field-label">Version Summary<textarea data-bind="summary">${escapeHtml(state.draft.summary || "")}</textarea></label>
  `;

  card.querySelector('[data-bind="group_kind"]').value = state.draft.group_kind || "category";

  const commonSelect = card.querySelector('[data-bind="schema.common_field_set_id"]');
  normalizeArray(state.bootstrap?.common_field_sets).forEach((fieldSet) => {
    const option = document.createElement("option");
    option.value = fieldSet.id;
    option.textContent = fieldSet.name;
    commonSelect.appendChild(option);
  });
  commonSelect.value = state.draft.schema.common_field_set_id || "default_lab_request";

  wireInputs(card, (bind, value) => {
    if (bind === "schema.notes") {
      state.draft.schema.notes = splitLines(value);
    } else if (bind === "summary") {
      state.draft.summary = value;
    } else {
      setBoundValue(bind, value);
      if (bind === "name") {
        state.draft.schema.name = value;
        if (!state.selectedFormSlug) {
          state.draft.schema.key = slugify(value);
        }
      }
    }
    setDirty(true);
    renderAll();
  });

  return card;
}

function renderSectionInspector(section) {
  const card = document.createElement("section");
  card.className = "inspector-card";
  card.innerHTML = `
    <div class="inspector-header"><h3>Section</h3><span class="hint">${normalizeArray(section.fields).length} fields</span></div>
    <div class="field-grid two">
      <label class="field-label">Section Name<input data-bind="name" value="${escapeHtml(section.name || "")}"></label>
      <label class="field-label">Section Key<input data-bind="key" value="${escapeHtml(section.key || "")}"></label>
    </div>
    <label class="field-label">Notes<textarea data-bind="notes">${escapeHtml(normalizeArray(section.notes).join("\n"))}</textarea></label>
  `;
  wireNodeInputs(card, section);
  return card;
}

function renderFieldInspector(field) {
  const card = document.createElement("section");
  card.className = "inspector-card";
  const isGroup = field.kind === "field_group";
  card.innerHTML = `
    <div class="inspector-header">
      <h3>${isGroup ? "Field Group" : "Field"}</h3>
      <span class="hint">${isGroup ? `${normalizeArray(field.fields).length} child fields` : `${field.control || "input"} | ${field.data_type || "text"}`}</span>
    </div>
    <div class="field-grid two">
      <label class="field-label">Name<input data-bind="name" value="${escapeHtml(field.name || "")}"></label>
      <label class="field-label">Key<input data-bind="key" value="${escapeHtml(field.key || "")}"></label>
    </div>
    <label class="field-label">Notes<textarea data-bind="notes">${escapeHtml(normalizeArray(field.notes).join("\n"))}</textarea></label>
  `;

  if (!isGroup) {
    const extras = document.createElement("div");
    extras.innerHTML = `
      <div class="field-grid two">
        <label class="field-label">Control
          <select data-bind="control">
            <option value="input">Input</option>
            <option value="select">Select</option>
          </select>
        </label>
        <label class="field-label">Data Type
          <select data-bind="data_type">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="time">Time</option>
            <option value="datetime">Datetime</option>
            <option value="enum">Enum</option>
          </select>
        </label>
        <label class="field-label">Unit Hint<input data-bind="unit_hint" value="${escapeHtml(field.unit_hint || "")}"></label>
        <label class="field-label">Normal Value<input data-bind="normal_value" value="${escapeHtml(field.normal_value || "")}"></label>
      </div>
      <div class="inspector-card">
        <div class="inspector-header">
          <h3>Options</h3>
          <button id="addOptionBtn" class="ghost mini-btn" type="button">Add Option</button>
        </div>
        <div id="optionsList" class="options-list"></div>
      </div>
    `;
    card.appendChild(extras);
    card.querySelector('[data-bind="control"]').value = field.control || "input";
    card.querySelector('[data-bind="data_type"]').value = field.data_type || "text";
    renderOptionRows(field, card.querySelector("#optionsList"));
    card.querySelector("#addOptionBtn").addEventListener("click", () => {
      field.options = normalizeArray(field.options);
      field.options.push({ name: "New Option" });
      setDirty(true);
      renderAll();
    });
  }

  wireNodeInputs(card, field);
  return card;
}

function renderOptionRows(field, container) {
  container.innerHTML = "";
  const options = normalizeArray(field.options);
  if (!options.length) {
    container.innerHTML = '<div class="empty-state">No options defined. Useful for select fields.</div>';
    return;
  }

  options.forEach((option, index) => {
    const row = document.createElement("div");
    row.className = "option-row";
    row.innerHTML = `
      <input value="${escapeHtml(option.name || "")}" placeholder="Option name">
      <button class="ghost mini-btn" type="button">Delete</button>
    `;
    row.querySelector("input").addEventListener("input", (event) => {
      field.options[index].name = event.target.value;
      setDirty(true);
      renderAll();
    });
    row.querySelector("button").addEventListener("click", () => {
      field.options.splice(index, 1);
      setDirty(true);
      renderAll();
    });
    container.appendChild(row);
  });
}

function wireInputs(root, onChange) {
  root.querySelectorAll("[data-bind]").forEach((input) => {
    const handler = (event) => onChange(event.target.dataset.bind, event.target.value);
    input.addEventListener("input", handler);
    input.addEventListener("change", handler);
  });
}

function wireNodeInputs(card, node) {
  wireInputs(card, (bind, value) => {
    if (bind === "notes") {
      node.notes = splitLines(value);
    } else {
      node[bind] = value;
    }
    setDirty(true);
    renderAll();
  });
}

function setBoundValue(bind, value) {
  const parts = bind.split(".");
  let cursor = state.draft;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor = cursor[parts[index]];
  }
  const key = parts[parts.length - 1];
  cursor[key] = key.includes("order") ? Number(value || 0) : value;
}

function renderPreview() {
  previewCanvasEl.innerHTML = "";
  if (!state.draft) {
    return;
  }

  const card = document.createElement("section");
  card.className = "preview-card";
  card.innerHTML = `
    <h3>${escapeHtml(state.draft.name || "Untitled Form")}</h3>
    <div class="preview-hint">${escapeHtml(state.draft.group_name)} | ${escapeHtml(state.draft.group_kind)} | common fields: ${escapeHtml(state.draft.schema.common_field_set_id || "default_lab_request")}</div>
  `;

  if (normalizeArray(state.draft.schema.fields).length) {
    const topGrid = document.createElement("div");
    topGrid.className = "preview-field-grid preview-section";
    state.draft.schema.fields.forEach((field) => topGrid.appendChild(renderPreviewField(field)));
    card.appendChild(topGrid);
  }

  normalizeArray(state.draft.schema.sections).forEach((section) => {
    const sectionEl = document.createElement("section");
    sectionEl.className = "preview-section";
    sectionEl.innerHTML = `<h3>${escapeHtml(section.name)}</h3>`;
    const grid = document.createElement("div");
    grid.className = "preview-field-grid";
    normalizeArray(section.fields).forEach((field) => grid.appendChild(renderPreviewField(field)));
    sectionEl.appendChild(grid);
    card.appendChild(sectionEl);
  });

  previewCanvasEl.appendChild(card);
}

function renderPreviewField(field) {
  if (field.kind === "field_group") {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-field";
    wrapper.innerHTML = `<label>${escapeHtml(field.name)}</label>`;
    const nested = document.createElement("div");
    nested.className = "preview-field-grid";
    normalizeArray(field.fields).forEach((child) => nested.appendChild(renderPreviewField(child)));
    wrapper.appendChild(nested);
    return wrapper;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "preview-field";
  wrapper.innerHTML = `<label>${escapeHtml(field.name)}</label>`;

  const hints = [];
  if (field.control) hints.push(field.control);
  if (field.data_type) hints.push(field.data_type);
  if (field.unit_hint) hints.push(field.unit_hint);
  if (field.normal_value) hints.push(`normal ${field.normal_value}`);

  if (field.control === "select") {
    const select = document.createElement("select");
    normalizeArray(field.options).forEach((option) => {
      const optionEl = document.createElement("option");
      optionEl.textContent = option.name || "Option";
      select.appendChild(optionEl);
    });
    wrapper.appendChild(select);
  } else {
    const input = document.createElement("input");
    input.placeholder = hints.join(" | ");
    wrapper.appendChild(input);
  }

  if (hints.length) {
    const hint = document.createElement("div");
    hint.className = "preview-hint";
    hint.textContent = hints.join(" | ");
    wrapper.appendChild(hint);
  }

  return wrapper;
}

function renderJson() {
  jsonOutputEl.textContent = state.draft ? JSON.stringify(state.draft, null, 2) : "{}";
}

async function saveDraft() {
  if (!state.draft) {
    return;
  }

  syncDraftKeys();
  const payload = {
    slug: state.selectedFormSlug,
    name: state.draft.name,
    group_name: state.draft.group_name,
    group_kind: state.draft.group_kind,
    group_order: Number(state.draft.group_order || 999),
    form_order: Number(state.draft.form_order || 1),
    summary: state.draft.summary || "",
    schema: state.draft.schema,
  };

  const saved = state.selectedFormSlug
    ? await api(`/api/forms/${state.selectedFormSlug}`, { method: "PUT", body: JSON.stringify(payload) })
    : await api("/api/forms", { method: "POST", body: JSON.stringify(payload) });

  state.selectedFormSlug = saved.slug;
  state.loadedForm = saved;
  state.draft = deepClone(saved);
  state.selectedPath = ["meta"];
  setDirty(false);
  setStatus(`Saved ${saved.name} as version ${saved.current_version_number}.`);
  state.bootstrap = await api("/api/builder/bootstrap");
  renderAll();
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".pane").forEach((pane) => {
        pane.classList.toggle("active", pane.id === `${button.dataset.tab}Pane`);
      });
    });
  });
}

document.getElementById("newFormBtn").addEventListener("click", () => {
  if (state.dirty && !window.confirm("Discard current unsaved changes and start a new form?")) {
    return;
  }
  startNewForm();
});

document.getElementById("saveBtn").addEventListener("click", () => {
  void saveDraft().catch((error) => {
    console.error(error);
    setStatus(`Save failed: ${error.message}`, true);
  });
});

document.getElementById("addTopFieldBtn").addEventListener("click", () => addFieldAt(["schema", "fields"], "field"));
document.getElementById("addTopGroupBtn").addEventListener("click", () => addFieldAt(["schema", "fields"], "field_group"));
document.getElementById("addSectionBtn").addEventListener("click", addSection);
formSearchEl.addEventListener("input", renderFormList);

bindTabs();

void bootstrap().catch((error) => {
  console.error(error);
  setStatus(`Unable to load builder: ${error.message}`, true);
});
