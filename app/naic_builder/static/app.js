const state = {
  bootstrap: null,
  selectedFormSlug: null,
  loadedForm: null,
  baselineDraft: null,
  draft: null,
  dirty: false,
  ui: {
    libraryOpen: false,
    previewOpen: false,
    setupOpen: true,
    saveOpen: false,
    topFieldsOpen: true,
    openSectionPaths: [],
    activeFieldPath: null,
  },
};

const sortableInstances = [];

const FIELD_TYPES = [
  { id: "text", label: "Short answer", control: "input", dataType: "text" },
  { id: "number", label: "Number", control: "input", dataType: "number" },
  { id: "choice", label: "Dropdown choices", control: "select", dataType: "enum" },
  { id: "date", label: "Date", control: "input", dataType: "date" },
  { id: "time", label: "Time", control: "input", dataType: "time" },
  { id: "datetime", label: "Date and time", control: "input", dataType: "datetime" },
];

const formListEl = document.getElementById("formList");
const formSearchEl = document.getElementById("formSearch");
const statusTextEl = document.getElementById("statusText");
const dirtyBadgeEl = document.getElementById("dirtyBadge");
const formEditorEl = document.getElementById("formEditor");
const previewCanvasEl = document.getElementById("previewCanvas");
const jsonOutputEl = document.getElementById("jsonOutput");
const drawerScrimEl = document.getElementById("drawerScrim");
const libraryDrawerEl = document.getElementById("libraryDrawer");
const previewDrawerEl = document.getElementById("previewDrawer");
const currentFormNameEl = document.getElementById("currentFormName");
const currentFormMetaEl = document.getElementById("currentFormMeta");
const stageTitleEl = document.getElementById("stageTitle");
const stageDescriptionEl = document.getElementById("stageDescription");
const openPreviewBtnEl = document.getElementById("openPreviewBtn");
const saveBtnEl = document.getElementById("saveBtn");
const saveDockEl = document.getElementById("saveDock");
const saveDockTitleEl = document.getElementById("saveDockTitle");
const saveDockMetaEl = document.getElementById("saveDockMeta");
const saveDockBtnEl = document.getElementById("saveDockBtn");
const resetDraftBtnEl = document.getElementById("resetDraftBtn");

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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function encodePath(path) {
  return encodeURIComponent(JSON.stringify(path));
}

function decodePath(serialized) {
  return JSON.parse(decodeURIComponent(serialized));
}

function pathKey(path) {
  return JSON.stringify(path);
}

function parsePathKey(serialized) {
  return JSON.parse(serialized);
}

function pathStartsWith(path, prefix) {
  return prefix.every((segment, index) => path[index] === segment);
}

function groupedForms() {
  return state.bootstrap?.groups || [];
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function currentVersionLabel() {
  return state.draft?.current_version_number ? `Version ${state.draft.current_version_number}` : "New draft";
}

function currentDraftFieldCount() {
  return state.draft ? countFields(state.draft.schema) : 0;
}

function currentCommonFieldSetName() {
  const selectedId = state.draft?.schema?.common_field_set_id || "default_lab_request";
  const match = normalizeArray(state.bootstrap?.common_field_sets).find((fieldSet) => fieldSet.id === selectedId);
  return match?.name || "Default Lab Request Metadata";
}

function syncShellState() {
  libraryDrawerEl.hidden = !state.ui.libraryOpen;
  previewDrawerEl.hidden = !state.ui.previewOpen;
  drawerScrimEl.hidden = !(state.ui.libraryOpen || state.ui.previewOpen);

  if (state.ui.libraryOpen) {
    libraryDrawerEl.removeAttribute("inert");
  } else {
    libraryDrawerEl.setAttribute("inert", "");
  }

  if (state.ui.previewOpen) {
    previewDrawerEl.removeAttribute("inert");
  } else {
    previewDrawerEl.setAttribute("inert", "");
  }

  libraryDrawerEl.classList.toggle("is-open", state.ui.libraryOpen);
  previewDrawerEl.classList.toggle("is-open", state.ui.previewOpen);
  libraryDrawerEl.setAttribute("aria-hidden", String(!state.ui.libraryOpen));
  previewDrawerEl.setAttribute("aria-hidden", String(!state.ui.previewOpen));

  const anyOpen = state.ui.libraryOpen || state.ui.previewOpen;
  drawerScrimEl.classList.toggle("hidden", !anyOpen);
  document.body.classList.toggle("drawer-open", anyOpen);
  openPreviewBtnEl.textContent = state.ui.previewOpen ? "Hide Preview" : "Open Preview";
}

function closeDrawers() {
  state.ui.libraryOpen = false;
  state.ui.previewOpen = false;
  syncShellState();
}

function openLibrary() {
  state.ui.libraryOpen = true;
  state.ui.previewOpen = false;
  syncShellState();
}

function togglePreview() {
  state.ui.previewOpen = !state.ui.previewOpen;
  if (state.ui.previewOpen) {
    state.ui.libraryOpen = false;
  }
  syncShellState();
}

function renderShellSummary() {
  if (!state.draft) {
    currentFormNameEl.textContent = "No form selected";
    currentFormMetaEl.textContent = "Open a form or start a blank draft.";
    stageTitleEl.textContent = "One form at a time";
    stageDescriptionEl.textContent = "Switch forms only when you need to. Keep preview closed unless you are checking layout.";
    return;
  }

  const formName = state.draft.name || "Untitled Form";
  const groupName = state.draft.group_name || "Unassigned";
  const version = currentVersionLabel();
  const fieldCount = pluralize(currentDraftFieldCount(), "field");
  const sectionCount = pluralize(normalizeArray(state.draft.schema.sections).length, "section");

  currentFormNameEl.textContent = formName;
  currentFormMetaEl.textContent = `${groupName} | ${version} | ${fieldCount}`;
  stageTitleEl.textContent = `Editing ${formName}`;
  stageDescriptionEl.textContent = `${sectionCount} and ${fieldCount}. Open only the part you are working on.`;
}

function resetEditorPanels() {
  const sections = normalizeArray(state.draft?.schema?.sections);
  const topFields = normalizeArray(state.draft?.schema?.fields);
  state.ui.setupOpen = !state.selectedFormSlug;
  state.ui.saveOpen = !state.selectedFormSlug;
  state.ui.topFieldsOpen = !topFields.length;
  state.ui.openSectionPaths = sections.length ? [pathKey(["schema", "sections", 0])] : [];
  state.ui.activeFieldPath = null;
}

function collectFieldPathKeys(container, basePath = []) {
  const paths = [];
  normalizeArray(container?.fields).forEach((field, index) => {
    const fieldPath = [...basePath, "fields", index];
    paths.push(pathKey(fieldPath));
    if (field.kind === "field_group") {
      paths.push(...collectFieldPathKeys(field, fieldPath));
    }
  });
  normalizeArray(container?.sections).forEach((section, index) => {
    paths.push(...collectFieldPathKeys(section, [...basePath, "sections", index]));
  });
  return paths;
}

function syncEditorPanels() {
  const sections = normalizeArray(state.draft?.schema?.sections);
  const validPaths = new Set(sections.map((_, index) => pathKey(["schema", "sections", index])));
  state.ui.openSectionPaths = normalizeArray(state.ui.openSectionPaths).filter((item) => validPaths.has(item));

  if (sections.length && !state.ui.openSectionPaths.length) {
    state.ui.openSectionPaths = [pathKey(["schema", "sections", 0])];
  }

  const validFieldPaths = new Set(collectFieldPathKeys(state.draft?.schema, ["schema"]));
  if (state.ui.activeFieldPath && !validFieldPaths.has(state.ui.activeFieldPath)) {
    state.ui.activeFieldPath = null;
  }
}

function isSectionOpen(path) {
  return normalizeArray(state.ui.openSectionPaths).includes(pathKey(path));
}

function toggleSection(path) {
  const token = pathKey(path);
  if (isSectionOpen(path)) {
    state.ui.openSectionPaths = state.ui.openSectionPaths.filter((item) => item !== token);
    if (state.ui.activeFieldPath && pathStartsWith(parsePathKey(state.ui.activeFieldPath), path)) {
      state.ui.activeFieldPath = null;
    }
  } else {
    state.ui.openSectionPaths = [token];
    if (state.ui.activeFieldPath && !pathStartsWith(parsePathKey(state.ui.activeFieldPath), path)) {
      state.ui.activeFieldPath = null;
    }
  }
  renderEditor();
}

function toggleSetup() {
  state.ui.setupOpen = !state.ui.setupOpen;
  renderEditor();
}

function toggleSaveStep() {
  state.ui.saveOpen = !state.ui.saveOpen;
  renderEditor();
}

function isFieldOpen(path) {
  if (!state.ui.activeFieldPath) {
    return false;
  }

  const token = pathKey(path);
  if (state.ui.activeFieldPath === token) {
    return true;
  }

  const node = getNodeByPath(path);
  if (node?.kind !== "field_group") {
    return false;
  }

  return pathStartsWith(parsePathKey(state.ui.activeFieldPath), path);
}

function toggleField(path) {
  const token = pathKey(path);
  if (state.ui.activeFieldPath) {
    const activePath = parsePathKey(state.ui.activeFieldPath);
    if (state.ui.activeFieldPath === token || pathStartsWith(activePath, path)) {
      state.ui.activeFieldPath = null;
      renderEditor();
      return;
    }
  }

  state.ui.activeFieldPath = token;
  renderEditor();
}

function remapPathAfterMove(path, parentPath, fromIndex, toIndex) {
  if (!pathStartsWith(path, parentPath)) {
    return path;
  }

  const indexPosition = parentPath.length;
  const currentIndex = path[indexPosition];
  if (typeof currentIndex !== "number") {
    return path;
  }

  let nextIndex = currentIndex;
  if (currentIndex === fromIndex) {
    nextIndex = toIndex;
  } else if (fromIndex < toIndex && currentIndex > fromIndex && currentIndex <= toIndex) {
    nextIndex = currentIndex - 1;
  } else if (fromIndex > toIndex && currentIndex >= toIndex && currentIndex < fromIndex) {
    nextIndex = currentIndex + 1;
  }

  if (nextIndex === currentIndex) {
    return path;
  }

  const copy = [...path];
  copy[indexPosition] = nextIndex;
  return copy;
}

function remapUiStateAfterMove(parentPath, fromIndex, toIndex) {
  state.ui.openSectionPaths = [...new Set(
    normalizeArray(state.ui.openSectionPaths).map((serialized) => pathKey(remapPathAfterMove(parsePathKey(serialized), parentPath, fromIndex, toIndex)))
  )];

  if (state.ui.activeFieldPath) {
    state.ui.activeFieldPath = pathKey(remapPathAfterMove(parsePathKey(state.ui.activeFieldPath), parentPath, fromIndex, toIndex));
  }
}

function setDirty(value) {
  state.dirty = value;
  dirtyBadgeEl.classList.toggle("hidden", !value);
  saveBtnEl.disabled = !value;
  saveBtnEl.textContent = value ? "Quick Save" : "Saved";
  renderSaveDock();
}

function setStatus(message, isError = false) {
  statusTextEl.textContent = message;
  statusTextEl.style.color = isError ? "#9f3d17" : "";
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

function setBoundValue(target, bind, rawValue) {
  const parts = bind.split(".");
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor = cursor[parts[index]];
  }
  const key = parts[parts.length - 1];
  if (key.includes("order")) {
    cursor[key] = Number(rawValue || 0);
    return;
  }
  cursor[key] = rawValue;
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
    group_name: "New Category",
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

function makeCopyName(name) {
  const base = String(name || "Untitled").trim() || "Untitled";
  return base.endsWith(" Copy") ? `${base} 2` : `${base} Copy`;
}

function cloneNode(node) {
  const copy = deepClone(node);
  copy.name = makeCopyName(copy.name);
  if (copy.key) {
    copy.key = `${slugify(copy.key)}_copy`;
  }
  return copy;
}

function ensureOptionShape(field) {
  field.options = normalizeArray(field.options);
}

function inferFieldType(field) {
  if (field.control === "select" || field.data_type === "enum") {
    return "choice";
  }
  const match = FIELD_TYPES.find((item) => item.dataType === field.data_type && item.control === field.control);
  return match?.id || "text";
}

function applyFieldType(field, typeId) {
  const selected = FIELD_TYPES.find((item) => item.id === typeId) || FIELD_TYPES[0];
  field.control = selected.control;
  field.data_type = selected.dataType;
  if (selected.id === "choice") {
    ensureOptionShape(field);
    if (!field.options.length) {
      field.options.push({ name: "Option 1" });
    }
  }
}

function syncNodeKeys(node) {
  if (!node || typeof node !== "object") {
    return;
  }
  if ("name" in node && !node.key) {
    node.key = slugify(node.name);
  }
  normalizeArray(node.fields).forEach(syncNodeKeys);
  normalizeArray(node.sections).forEach(syncNodeKeys);
}

function syncDraftKeys() {
  if (!state.draft) {
    return;
  }
  if (!state.draft.schema.key) {
    state.draft.schema.key = slugify(state.draft.name);
  }
  state.draft.schema.name = state.draft.name;
  syncNodeKeys(state.draft.schema);
}

function touch(options = {}) {
  setDirty(true);
  renderShellSummary();
  renderPreview();
  renderJson();
  if (options.full) {
    renderEditor();
  }
  if (options.library) {
    renderFormList();
  }
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
  if (slug === state.selectedFormSlug && state.draft) {
    state.ui.libraryOpen = false;
    setStatus(`Still editing ${state.draft.name}.`);
    renderAll();
    return;
  }

  if (state.dirty && !window.confirm("You have unsaved changes. Continue and discard them?")) {
    return;
  }

  const form = await api(`/api/forms/${slug}`);
  state.selectedFormSlug = slug;
  state.loadedForm = form;
  state.draft = deepClone(form);
  state.baselineDraft = deepClone(form);
  resetEditorPanels();
  setDirty(false);
  state.ui.libraryOpen = false;
  setStatus(`Loaded ${form.name}.`);
  renderAll();
}

function startNewForm() {
  state.selectedFormSlug = null;
  state.loadedForm = null;
  state.draft = makeBlankForm();
  state.baselineDraft = deepClone(state.draft);
  resetEditorPanels();
  setDirty(true);
  state.ui.libraryOpen = false;
  setStatus("Started a new blank form.");
  renderAll();
}

function duplicateCurrentForm() {
  if (!state.draft) {
    startNewForm();
    return;
  }
  const copy = deepClone(state.draft);
  copy.slug = null;
  copy.current_version_number = 0;
  copy.summary = "";
  copy.name = makeCopyName(copy.name);
  copy.schema.name = copy.name;
  copy.schema.key = slugify(copy.name);
  state.selectedFormSlug = null;
  state.loadedForm = null;
  state.draft = copy;
  state.baselineDraft = deepClone(copy);
  resetEditorPanels();
  setDirty(true);
  state.ui.libraryOpen = false;
  setStatus("Duplicated the current form into a new draft.");
  renderAll();
}

function resetCurrentDraft() {
  if (!state.baselineDraft) {
    return;
  }

  const message = state.selectedFormSlug
    ? "Discard your unsaved changes and go back to the last saved version?"
    : "Clear this current draft and go back to its starting point?";
  if (!window.confirm(message)) {
    return;
  }

  state.draft = deepClone(state.baselineDraft);
  resetEditorPanels();
  setDirty(false);
  setStatus(state.selectedFormSlug ? `Restored ${state.draft.name} to its last saved version.` : "Reset the current draft.");
  renderAll();
}

function renderAll() {
  renderShellSummary();
  renderFormList();
  renderEditor();
  renderPreview();
  renderJson();
  renderSaveDock();
  syncShellState();
}

function renderSaveDock() {
  if (!saveDockEl) {
    return;
  }

  const visible = Boolean(state.draft && state.dirty);
  saveDockEl.hidden = !visible;
  saveDockEl.classList.toggle("hidden", !visible);
  if (!visible) {
    return;
  }

  const note = String(state.draft.summary || "").trim();
  saveDockTitleEl.textContent = state.selectedFormSlug ? "Unsaved changes" : "This draft is not saved yet";
  saveDockMetaEl.textContent = note
    ? `Save note: ${note}`
    : "You can save now, or add a short note in the Save step first.";
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
    block.innerHTML = `
      <div class="group-title">
        <span>${escapeHtml(group.name)}</span>
        <span class="group-count">${pluralize(matching.length, "form")}</span>
      </div>
    `;

    matching.forEach((form) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "form-link";
      button.dataset.action = "load-form";
      button.dataset.slug = form.slug;
      if (form.slug === state.selectedFormSlug) {
        button.classList.add("active");
      }
      button.innerHTML = `
        <strong>${escapeHtml(form.name)}</strong>
        <span class="meta">Version ${form.current_version_number}</span>
      `;
      block.appendChild(button);
    });

    formListEl.appendChild(block);
  }

  if (!formListEl.children.length) {
    formListEl.innerHTML = '<div class="empty-state">No matching forms found.</div>';
  }
}

function renderCommonFieldSetOptions(selectedId) {
  return normalizeArray(state.bootstrap?.common_field_sets)
    .map((fieldSet) => `
      <option value="${escapeHtml(fieldSet.id)}"${fieldSet.id === selectedId ? " selected" : ""}>${escapeHtml(fieldSet.name)}</option>
    `)
    .join("");
}

function renderEditor() {
  destroySortables();

  if (!state.draft) {
    formEditorEl.innerHTML = '<div class="empty-state">No draft loaded.</div>';
    return;
  }

  syncEditorPanels();

  formEditorEl.innerHTML = `
    ${renderFormSetupCard()}
    ${renderTopFieldsCard()}
    ${renderSectionsCard()}
    ${renderSaveCard()}
  `;

  setupSortableCollections();
}

function renderFormSetupCard() {
  const setupOpen = state.ui.setupOpen;
  const formName = state.draft.name || "Untitled Form";
  const groupName = state.draft.group_name || "Unassigned";
  const sharedFieldSetName = currentCommonFieldSetName();
  return `
    <section class="editor-card">
      <div class="card-head">
        <div>
          <div class="chip-row">
            <span class="chip">${escapeHtml(currentVersionLabel())}</span>
            <span class="chip soft">${escapeHtml(groupName)}</span>
          </div>
          <h3 class="card-title">Form setup</h3>
          <p class="panel-copy">${setupOpen ? "Name the form and place it in the right department." : "Open only when you need to rename or move the form."}</p>
        </div>
        <div class="top-actions">
          <button class="ghost mini" type="button" data-action="toggle-setup">${setupOpen ? "Done" : "Open"}</button>
        </div>
      </div>

      ${setupOpen ? `
        <div class="setup-grid">
          <label>
            <span>Form title</span>
            <input data-bind="name" value="${escapeHtml(formName)}" placeholder="Example: Urinalysis">
          </label>
          <label>
            <span>Department / category</span>
            <input data-bind="group_name" value="${escapeHtml(groupName)}" placeholder="Example: Clinical Microscopy">
          </label>
          <label>
            <span>Shared patient info</span>
            <select data-bind="schema.common_field_set_id">
              ${renderCommonFieldSetOptions(state.draft.schema.common_field_set_id || "default_lab_request")}
            </select>
          </label>
        </div>

        <details class="advanced">
          <summary>Advanced</summary>
          <div class="advanced-grid">
            <label>
              <span>Internal form key</span>
              <input data-bind="schema.key" value="${escapeHtml(state.draft.schema.key || "")}">
            </label>
            <label style="grid-column: 1 / -1;">
              <span>Builder notes</span>
              <textarea data-bind="schema.notes" data-format="lines">${escapeHtml(normalizeArray(state.draft.schema.notes).join("\n"))}</textarea>
            </label>
          </div>
        </details>
      ` : `
        <div class="collapsed-copy">
          <strong>${escapeHtml(formName)}</strong>
          ${escapeHtml(groupName)} | ${escapeHtml(sharedFieldSetName)}
        </div>
      `}
    </section>
  `;
}

function renderSaveCard() {
  const saveOpen = state.ui.saveOpen;
  const note = String(state.draft.summary || "").trim();
  return `
    <section class="editor-card">
      <div class="card-head">
        <div>
          <h3 class="card-title">Save this version</h3>
          <p class="panel-copy">${saveOpen ? "Add a short note if you want one, then save." : "Open if you want to review the version note."}</p>
        </div>
        <div class="top-actions">
          <button class="ghost mini" type="button" data-action="toggle-save-step">${saveOpen ? "Done" : "Open"}</button>
          ${saveOpen ? '<button class="secondary" type="button" data-action="save-draft">Save Changes</button>' : ""}
        </div>
      </div>

      ${saveOpen ? `
        <div class="field-stack">
          <label>
            <span>Version note</span>
            <input data-bind="summary" value="${escapeHtml(state.draft.summary || "")}" placeholder="Example: Added urine ketone choices">
          </label>
        </div>
      ` : `
        <div class="collapsed-copy">
          <strong>${note ? "Current version note" : "Save note is optional"}</strong>
          ${note ? escapeHtml(note) : "Use the floating save bar when you are ready."}
        </div>
      `}
    </section>
  `;
}

function renderNodeActionMenu(path) {
  return `
    <details class="action-details">
      <summary>More</summary>
      <div class="action-menu">
        <button class="ghost mini" type="button" data-action="duplicate-node" data-path="${encodePath(path)}">Duplicate</button>
        <button class="ghost mini warn" type="button" data-action="delete-node" data-path="${encodePath(path)}">Delete</button>
      </div>
    </details>
  `;
}

function renderTopFieldsCard() {
  const topFields = normalizeArray(state.draft.schema.fields);
  const itemCount = pluralize(topFields.length, "item");
  return `
    <section class="editor-card">
      <div class="card-head">
        <div>
          <h3 class="card-title">Top of form</h3>
          <p class="panel-copy">Optional fields that appear before the main sections.</p>
        </div>
        <div class="top-actions">
          <button class="ghost mini" type="button" data-action="toggle-top-fields">${state.ui.topFieldsOpen ? "Done" : "Open"}</button>
          ${state.ui.topFieldsOpen ? `
            <button class="secondary mini" type="button" data-action="add-top-field">Add field</button>
            <button class="ghost mini" type="button" data-action="add-top-group">Add field group</button>
          ` : ""}
        </div>
      </div>
      ${state.ui.topFieldsOpen
        ? renderFieldCollection(topFields, ["schema", "fields"])
        : `<div class="collapsed-copy">${escapeHtml(itemCount)} hidden here.</div>`}
    </section>
  `;
}

function renderSectionsCard() {
  const sections = normalizeArray(state.draft.schema.sections);
  return `
    <section class="editor-card">
      <div class="card-head">
        <div>
          <h3 class="card-title">Sections</h3>
          <p class="panel-copy">Open one section at a time. Drag by handle to reorder.</p>
        </div>
        <div class="top-actions">
          <button class="secondary mini" type="button" data-action="add-section">Add section</button>
        </div>
      </div>
      <div class="section-list" data-collection-path="${encodePath(["schema", "sections"])}">
        ${sections.length ? sections.map((section, index) => renderSectionCard(section, ["schema", "sections", index], index + 1)).join("") : '<div class="empty-state">No sections yet. Add one to start organizing the form.</div>'}
      </div>
    </section>
  `;
}

function renderSectionCard(section, path, number) {
  const open = isSectionOpen(path);
  const itemCount = pluralize(normalizeArray(section.fields).length, "item");
  return `
    <article class="section-card ${open ? "is-open" : ""}" data-node-path="${encodePath(path)}" data-parent-path="${encodePath(path.slice(0, -1))}">
      <div class="section-head">
        <div>
          <div class="chip-row">
            <span class="chip warm">Section ${number}</span>
            <span class="chip soft">${itemCount}</span>
          </div>
          <h4 class="section-display-title">${escapeHtml(section.name || "Untitled Section")}</h4>
        </div>
        <div class="row-actions">
          <button class="drag-handle" type="button" title="Drag to reorder">Drag</button>
          <button class="ghost mini" type="button" data-action="toggle-section" data-path="${encodePath(path)}">${open ? "Done" : "Open"}</button>
          ${renderNodeActionMenu(path)}
        </div>
      </div>

      ${open ? `
        <div class="field-stack">
          <label>
            <span>Section title</span>
            <input class="section-title-input" data-path="${encodePath(path)}" data-bind="name" value="${escapeHtml(section.name || "")}" placeholder="Example: Chemical Findings">
          </label>
        </div>

        ${renderFieldCollection(section.fields, [...path, "fields"])}

        <div class="section-actions">
          <button class="secondary mini" type="button" data-action="add-field" data-path="${encodePath([...path, "fields"])}">Add field</button>
          <button class="ghost mini" type="button" data-action="add-group" data-path="${encodePath([...path, "fields"])}">Add group</button>
        </div>

        <details class="advanced">
          <summary>Advanced</summary>
          <div class="advanced-grid">
            <label>
              <span>Internal section key</span>
              <input data-path="${encodePath(path)}" data-bind="key" value="${escapeHtml(section.key || "")}">
            </label>
            <label style="grid-column: 1 / -1;">
              <span>Section notes</span>
              <textarea data-path="${encodePath(path)}" data-bind="notes" data-format="lines">${escapeHtml(normalizeArray(section.notes).join("\n"))}</textarea>
            </label>
          </div>
        </details>
      ` : ""}
    </article>
  `;
}

function renderFieldCollection(fields, collectionPath) {
  const items = normalizeArray(fields);
  if (!items.length) {
    return '<div class="empty-state">Nothing here yet. Add a field when you are ready.</div>';
  }
  return `<div class="field-list" data-collection-path="${encodePath(collectionPath)}">${items.map((field, index) => renderFieldCard(field, [...collectionPath, index])).join("")}</div>`;
}

function renderFieldCard(field, path) {
  const isGroup = field.kind === "field_group";
  const open = isFieldOpen(path);
  const childCount = normalizeArray(field.fields).length;
  const optionCount = normalizeArray(field.options).length;
  const fieldType = inferFieldType(field);
  const summary = isGroup
    ? `${childCount} child fields`
    : `${FIELD_TYPES.find((item) => item.id === fieldType)?.label || "Short answer"}${optionCount ? ` | ${optionCount} choices` : ""}`;

  return `
    <article class="field-card ${isGroup ? "group-card" : ""} ${open ? "is-open" : ""}" data-node-path="${encodePath(path)}" data-parent-path="${encodePath(path.slice(0, -1))}">
      <div class="field-head">
        <div>
          <div class="field-meta">
            <span class="chip ${isGroup ? "warm" : ""}">${isGroup ? "Field group" : "Field"}</span>
            <span class="field-summary">${escapeHtml(summary)}</span>
          </div>
          <h4 class="field-display-title">${escapeHtml(field.name || (isGroup ? "Untitled Group" : "Untitled Field"))}</h4>
        </div>
        <div class="row-actions">
          <button class="drag-handle" type="button" title="Drag to reorder">Drag</button>
          <button class="ghost mini" type="button" data-action="toggle-field" data-path="${encodePath(path)}">${open ? "Done" : "Edit"}</button>
          ${renderNodeActionMenu(path)}
        </div>
      </div>

      ${open ? `
        <div class="inline-grid">
          <label>
            <span>${isGroup ? "Group title" : "Field label"}</span>
            <input class="field-title-input" data-path="${encodePath(path)}" data-bind="name" value="${escapeHtml(field.name || "")}" placeholder="${isGroup ? "Example: Vital Signs" : "Example: Color"}">
          </label>
          ${isGroup ? `
            <label>
              <span>Type</span>
              <input value="Field group" disabled>
            </label>
          ` : `
            <label>
              <span>Answer type</span>
              <select data-action="field-type" data-path="${encodePath(path)}">
                ${FIELD_TYPES.map((item) => `<option value="${item.id}"${item.id === fieldType ? " selected" : ""}>${item.label}</option>`).join("")}
              </select>
            </label>
          `}
        </div>

        ${isGroup ? `
          <div class="nested-fields">
            ${renderFieldCollection(field.fields, [...path, "fields"])}
          </div>
          <div class="section-actions">
            <button class="secondary mini" type="button" data-action="add-field" data-path="${encodePath([...path, "fields"])}">Add child field</button>
          </div>
        ` : ""}

        ${!isGroup && field.control === "select" ? renderOptionsEditor(field, path) : ""}

        <details class="advanced">
          <summary>Advanced</summary>
          <div class="advanced-grid">
            <label>
              <span>Internal key</span>
              <input data-path="${encodePath(path)}" data-bind="key" value="${escapeHtml(field.key || "")}">
            </label>
            ${isGroup ? "" : `
              <label>
                <span>Normal value</span>
                <input data-path="${encodePath(path)}" data-bind="normal_value" value="${escapeHtml(field.normal_value || "")}" placeholder="Example: 4.5 - 11.0">
              </label>
              <label>
                <span>Unit hint</span>
                <input data-path="${encodePath(path)}" data-bind="unit_hint" value="${escapeHtml(field.unit_hint || "")}" placeholder="Example: mg/dL">
              </label>
            `}
            <label style="grid-column: 1 / -1;">
              <span>Notes</span>
              <textarea data-path="${encodePath(path)}" data-bind="notes" data-format="lines">${escapeHtml(normalizeArray(field.notes).join("\n"))}</textarea>
            </label>
          </div>
        </details>
      ` : ""}
    </article>
  `;
}

function renderOptionsEditor(field, path) {
  const options = normalizeArray(field.options);
  return `
    <section class="field-stack">
      <div class="card-head">
        <div>
          <h4>Choices</h4>
        </div>
        <div class="option-actions">
          <button class="ghost mini" type="button" data-action="add-option" data-path="${encodePath(path)}">Add choice</button>
        </div>
      </div>
      <div class="options-list">
        ${options.length ? options.map((option, index) => `
          <div class="option-row">
            <label>
              <span>Choice ${index + 1}</span>
              <input data-action="option-name" data-path="${encodePath(path)}" data-index="${index}" value="${escapeHtml(option.name || "")}" placeholder="Option name">
            </label>
            <button class="ghost mini warn" type="button" data-action="delete-option" data-path="${encodePath(path)}" data-index="${index}">Delete</button>
          </div>
        `).join("") : '<div class="empty-state">This dropdown has no choices yet.</div>'}
      </div>
    </section>
  `;
}

function renderPreview() {
  if (!state.draft) {
    previewCanvasEl.innerHTML = '<div class="empty-state">No preview yet.</div>';
    return;
  }

  const totalFields = countFields(state.draft.schema);
  previewCanvasEl.innerHTML = `
    <section class="preview-card">
      <div class="preview-head">
        <div>
          <h3 class="preview-title">${escapeHtml(state.draft.name || "Untitled Form")}</h3>
          <p class="panel-copy">${escapeHtml(state.draft.group_name || "Unassigned")} | ${escapeHtml(currentVersionLabel())}</p>
        </div>
      </div>
      <div class="preview-badges">
        <span class="chip">${totalFields} fields</span>
        <span class="chip soft">${normalizeArray(state.draft.schema.sections).length} sections</span>
      </div>
      ${normalizeArray(state.draft.schema.fields).length ? `
        <section class="preview-section">
          <h4>Top of form</h4>
          <div class="preview-grid">
            ${normalizeArray(state.draft.schema.fields).map(renderPreviewField).join("")}
          </div>
        </section>
      ` : ""}
      ${normalizeArray(state.draft.schema.sections).map((section) => `
        <section class="preview-section">
          <h4>${escapeHtml(section.name || "Untitled Section")}</h4>
          <div class="preview-grid">
            ${normalizeArray(section.fields).map(renderPreviewField).join("")}
          </div>
        </section>
      `).join("")}
    </section>
  `;
}

function countFields(container) {
  let count = 0;
  normalizeArray(container.fields).forEach((field) => {
    if (field.kind === "field_group") {
      count += countFields(field);
    } else {
      count += 1;
    }
  });
  normalizeArray(container.sections).forEach((section) => {
    count += countFields(section);
  });
  return count;
}

function renderPreviewField(field) {
  if (field.kind === "field_group") {
    return `
      <div class="preview-group">
        <div class="preview-group-title">${escapeHtml(field.name || "Field group")}</div>
        <div class="preview-grid">
          ${normalizeArray(field.fields).map(renderPreviewField).join("")}
        </div>
      </div>
    `;
  }

  const hints = [];
  if (field.unit_hint) hints.push(field.unit_hint);
  if (field.normal_value) hints.push(`normal ${field.normal_value}`);

  return `
    <label class="preview-field">
      <span>${escapeHtml(field.name || "Untitled Field")}</span>
      ${field.control === "select" ? `
        <select>
          ${normalizeArray(field.options).map((option) => `<option>${escapeHtml(option.name || "Option")}</option>`).join("")}
        </select>
      ` : '<input>'}
      ${hints.length ? `<div class="preview-hint">${escapeHtml(hints.join(" | "))}</div>` : ""}
    </label>
  `;
}

function renderJson() {
  jsonOutputEl.textContent = state.draft ? JSON.stringify(state.draft, null, 2) : "{}";
}

function moveWithinCollection(collectionPath, fromIndex, toIndex) {
  const collection = getNodeByPath(collectionPath);
  if (!Array.isArray(collection)) {
    return;
  }

  const boundedTarget = Math.max(0, Math.min(toIndex, collection.length - 1));
  if (fromIndex === boundedTarget) {
    return;
  }

  const [item] = collection.splice(fromIndex, 1);
  collection.splice(boundedTarget, 0, item);
  remapUiStateAfterMove(collectionPath, fromIndex, boundedTarget);
  touch({ full: true });
}

function duplicateAtPath(path) {
  const { collection, index } = getParentCollection(path);
  if (!Array.isArray(collection)) {
    return;
  }
  collection.splice(index + 1, 0, cloneNode(collection[index]));
  if (path.includes("fields")) {
    state.ui.activeFieldPath = pathKey([...path.slice(0, -1), index + 1]);
  } else {
    state.ui.activeFieldPath = null;
  }
  touch({ full: true });
}

function deleteAtPath(path) {
  const { collection, index } = getParentCollection(path);
  if (!Array.isArray(collection)) {
    return;
  }
  if (state.ui.activeFieldPath && pathStartsWith(parsePathKey(state.ui.activeFieldPath), path)) {
    state.ui.activeFieldPath = null;
  }
  collection.splice(index, 1);
  touch({ full: true });
}

function addFieldAt(path, kind) {
  const collection = getNodeByPath(path);
  if (!Array.isArray(collection)) {
    return;
  }
  collection.push(makeBlankField(kind));
  state.ui.activeFieldPath = pathKey([...path, collection.length - 1]);
  if (pathKey(path) === pathKey(["schema", "fields"])) {
    state.ui.topFieldsOpen = true;
  }
  touch({ full: true });
}

function addSection() {
  state.draft.schema.sections.push(makeBlankSection());
  state.ui.openSectionPaths = [pathKey(["schema", "sections", state.draft.schema.sections.length - 1])];
  state.ui.activeFieldPath = null;
  touch({ full: true });
}

function addOption(path) {
  const field = getNodeByPath(path);
  ensureOptionShape(field);
  field.options.push({ name: `Option ${field.options.length + 1}` });
  touch({ full: true });
}

function deleteOption(path, index) {
  const field = getNodeByPath(path);
  ensureOptionShape(field);
  field.options.splice(index, 1);
  touch({ full: true });
}

function destroySortables() {
  while (sortableInstances.length) {
    sortableInstances.pop()?.destroy();
  }
}

function setupSortableCollections() {
  if (!window.Sortable) {
    return;
  }

  formEditorEl.querySelectorAll("[data-collection-path]").forEach((collectionEl) => {
    if (!(collectionEl instanceof HTMLElement)) {
      return;
    }

    const collectionPath = decodePath(collectionEl.dataset.collectionPath);
    const items = getNodeByPath(collectionPath);
    if (!Array.isArray(items) || items.length < 2) {
      return;
    }

    const sortable = window.Sortable.create(collectionEl, {
      animation: 160,
      handle: ".drag-handle",
      chosenClass: "is-dragging",
      dragClass: "is-dragging",
      ghostClass: "sortable-ghost",
      onEnd(event) {
        if (event.oldIndex == null || event.newIndex == null || event.oldIndex === event.newIndex) {
          return;
        }

        moveWithinCollection(collectionPath, event.oldIndex, event.newIndex);
      },
    });

    sortableInstances.push(sortable);
  });
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
  state.baselineDraft = deepClone(saved);
  state.bootstrap = await api("/api/builder/bootstrap");
  setDirty(false);
  setStatus(`Saved ${saved.name} as version ${saved.current_version_number}.`);
  renderAll();
}

function handleRootInput(event) {
  const bind = event.target.dataset.bind;
  if (!bind || !state.draft) {
    return;
  }

  if (event.target.dataset.action === "option-name") {
    return;
  }

  const rawValue = event.target.value;
  if (event.target.dataset.path) {
    const node = getNodeByPath(decodePath(event.target.dataset.path));
    if (!node) {
      return;
    }
    const previousName = bind === "name" ? node.name : "";
    if (event.target.dataset.format === "lines") {
      node[bind] = splitLines(rawValue);
    } else {
      setBoundValue(node, bind, rawValue);
    }
    if (bind === "name" && (!node.key || node.key === slugify(previousName))) {
      node.key = slugify(rawValue);
    }
  } else {
    const previousName = bind === "name" ? state.draft.name : "";
    if (event.target.dataset.format === "lines") {
      setBoundValue(state.draft, bind, splitLines(rawValue));
    } else {
      setBoundValue(state.draft, bind, rawValue);
    }
    if (bind === "name") {
      state.draft.schema.name = state.draft.name;
      if (!state.draft.schema.key || state.draft.schema.key === slugify(previousName)) {
        state.draft.schema.key = slugify(rawValue);
      }
    }
  }

  touch();
}

function handleOptionInput(event) {
  const path = event.target.dataset.path;
  const index = Number(event.target.dataset.index);
  if (!path || Number.isNaN(index)) {
    return;
  }
  const field = getNodeByPath(decodePath(path));
  ensureOptionShape(field);
  field.options[index].name = event.target.value;
  touch();
}

function handleEditorClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const action = actionTarget.dataset.action;
  if (action === "option-name" || action === "load-form") {
    return;
  }

  if (actionTarget.tagName === "SUMMARY") {
    return;
  }

  const path = actionTarget.dataset.path ? decodePath(actionTarget.dataset.path) : null;

  if (action === "add-top-field") {
    addFieldAt(["schema", "fields"], "field");
    return;
  }
  if (action === "add-top-group") {
    addFieldAt(["schema", "fields"], "field_group");
    return;
  }
  if (action === "add-section") {
    addSection();
    return;
  }
  if (action === "toggle-top-fields") {
    state.ui.topFieldsOpen = !state.ui.topFieldsOpen;
    renderEditor();
    return;
  }
  if (action === "toggle-setup") {
    toggleSetup();
    return;
  }
  if (action === "toggle-save-step") {
    toggleSaveStep();
    return;
  }
  if (action === "toggle-section" && path) {
    toggleSection(path);
    return;
  }
  if (action === "toggle-field" && path) {
    toggleField(path);
    return;
  }
  if (action === "add-field" && path) {
    addFieldAt(path, "field");
    return;
  }
  if (action === "add-group" && path) {
    addFieldAt(path, "field_group");
    return;
  }
  if (action === "duplicate-node" && path) {
    duplicateAtPath(path);
    return;
  }
  if (action === "delete-node" && path) {
    if (window.confirm("Delete this item?")) {
      deleteAtPath(path);
    }
    return;
  }
  if (action === "add-option" && path) {
    addOption(path);
    return;
  }
  if (action === "delete-option" && path) {
    deleteOption(path, Number(actionTarget.dataset.index));
    return;
  }
  if (action === "save-draft") {
    void saveDraft().catch((error) => {
      console.error(error);
      setStatus(`Save failed: ${error.message}`, true);
    });
  }
}

function handleEditorChange(event) {
  if (event.target.dataset.action === "field-type") {
    const field = getNodeByPath(decodePath(event.target.dataset.path));
    applyFieldType(field, event.target.value);
    touch({ full: true });
    return;
  }
  handleRootInput(event);
}

formListEl.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="load-form"]');
  if (!button) {
    return;
  }
  void loadForm(button.dataset.slug);
});

formEditorEl.addEventListener("click", handleEditorClick);
formEditorEl.addEventListener("input", (event) => {
  if (event.target.dataset.action === "option-name") {
    handleOptionInput(event);
    return;
  }
  if (event.target.matches("input, textarea")) {
    handleRootInput(event);
  }
});
formEditorEl.addEventListener("change", (event) => {
  if (event.target.matches("select")) {
    handleEditorChange(event);
  }
});
formEditorEl.addEventListener("toggle", (event) => {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("action-details") || !details.open) {
    return;
  }

  formEditorEl.querySelectorAll(".action-details[open]").forEach((item) => {
    if (item !== details) {
      item.open = false;
    }
  });
}, true);

document.getElementById("openLibraryBtn").addEventListener("click", () => {
  openLibrary();
});

document.getElementById("closeLibraryBtn").addEventListener("click", () => {
  closeDrawers();
});

document.getElementById("closePreviewBtn").addEventListener("click", () => {
  closeDrawers();
});

openPreviewBtnEl.addEventListener("click", () => {
  togglePreview();
});

drawerScrimEl.addEventListener("click", () => {
  closeDrawers();
});

document.getElementById("newFormBtn").addEventListener("click", () => {
  if (state.dirty && !window.confirm("Discard current unsaved changes and start a new form?")) {
    return;
  }
  startNewForm();
});

document.getElementById("duplicateFormBtn").addEventListener("click", () => {
  duplicateCurrentForm();
});

document.getElementById("saveBtn").addEventListener("click", () => {
  void saveDraft().catch((error) => {
    console.error(error);
    setStatus(`Save failed: ${error.message}`, true);
  });
});

saveDockBtnEl.addEventListener("click", () => {
  void saveDraft().catch((error) => {
    console.error(error);
    setStatus(`Save failed: ${error.message}`, true);
  });
});

resetDraftBtnEl.addEventListener("click", () => {
  resetCurrentDraft();
});

formSearchEl.addEventListener("input", renderFormList);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDrawers();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

void bootstrap().catch((error) => {
  console.error(error);
  setStatus(`Unable to load builder: ${error.message}`, true);
});
