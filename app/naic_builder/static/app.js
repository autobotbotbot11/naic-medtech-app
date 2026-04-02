const state = {
  bootstrap: null,
  selectedFormSlug: null,
  loadedForm: null,
  baselineDraft: null,
  draft: null,
  dirty: false,
  ui: {
    libraryOpen: false,
    previewOpen: true,
    advancedMode: false,
    focusPane: "setup",
    setupOpen: true,
    saveOpen: false,
    topFieldsOpen: true,
    openSectionPaths: [],
    activeFieldPath: null,
    activeOptionToken: null,
    activePreviewSectionId: null,
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

const initialFormSlug = document.body?.dataset?.initialFormSlug || "";
const initialBuilderMode = document.body?.dataset?.initialBuilderMode || "";
const initialQuery = new URLSearchParams(window.location.search);

const formListEl = document.getElementById("formList");
const formSearchEl = document.getElementById("formSearch");
const statusTextEl = document.getElementById("statusText");
const dirtyBadgeEl = document.getElementById("dirtyBadge");
const formEditorEl = document.getElementById("formEditor");
const builderOutlineEl = document.getElementById("builderOutline");
const previewCanvasEl = document.getElementById("previewCanvas");
const jsonOutputEl = document.getElementById("jsonOutput");
const drawerScrimEl = document.getElementById("drawerScrim");
const workspaceShellEl = document.getElementById("workspaceShell") || document.querySelector(".workspace-shell") || document.querySelector(".stage-shell");
const libraryDrawerEl = document.getElementById("libraryDrawer");
const previewPanelEl = document.getElementById("previewPanel") || document.getElementById("previewDrawer");
const currentFormNameEl = document.getElementById("currentFormName");
const currentFormMetaEl = document.getElementById("currentFormMeta");
const stageTitleEl = document.getElementById("stageTitle");
const stageDescriptionEl = document.getElementById("stageDescription");
const previewCalloutTitleEl = document.getElementById("previewCalloutTitle");
const previewCalloutMetaEl = document.getElementById("previewCalloutMeta");
const openPreviewBtnEl = document.getElementById("openPreviewBtn");
const closePreviewBtnEl = document.getElementById("closePreviewBtn");
const toggleAdvancedBtnEl = document.getElementById("toggleAdvancedBtn");
const saveBtnEl = document.getElementById("saveBtn");
const saveDockEl = document.getElementById("saveDock");
const saveDockTitleEl = document.getElementById("saveDockTitle");
const saveDockMetaEl = document.getElementById("saveDockMeta");
const saveDockBtnEl = document.getElementById("saveDockBtn");
const resetDraftBtnEl = document.getElementById("resetDraftBtn");
const devPanelEl = document.querySelector(".dev-panel");
const dialogScrimEl = document.getElementById("dialogScrim");
const confirmDialogEl = document.getElementById("confirmDialog");
const confirmDialogEyebrowEl = document.getElementById("confirmDialogEyebrow");
const confirmDialogTitleEl = document.getElementById("confirmDialogTitle");
const confirmDialogMessageEl = document.getElementById("confirmDialogMessage");
const confirmDialogCancelBtnEl = document.getElementById("confirmDialogCancelBtn");
const confirmDialogAltBtnEl = document.getElementById("confirmDialogAltBtn");
const confirmDialogConfirmBtnEl = document.getElementById("confirmDialogConfirmBtn");

let dialogResolver = null;
let dialogReturnFocusEl = null;
let allowIntentionalUnload = false;

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

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function compactText(value) {
  return String(value || "").trim();
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

function availableGroupNames() {
  const names = new Set();
  groupedForms().forEach((group) => {
    if (group?.name) {
      names.add(String(group.name).trim());
    }
  });
  if (state.draft?.group_name) {
    names.add(String(state.draft.group_name).trim());
  }
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function renderGroupNameSuggestions() {
  const names = availableGroupNames();
  if (!names.length) {
    return "";
  }
  return `
    <datalist id="groupNameSuggestions">
      ${names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}
    </datalist>
  `;
}

function renderHelpPopover(label, text) {
  return `
    <details class="inline-help">
      <summary aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">?</summary>
      <div class="help-popover">${escapeHtml(text)}</div>
    </details>
  `;
}

function isDialogOpen() {
  return Boolean(confirmDialogEl && !confirmDialogEl.hidden);
}

function closeTransientDetails() {
  if (!document.body) {
    return;
  }

  document.querySelectorAll(".action-details[open], .manage-details[open], .inline-help[open]").forEach((item) => {
    item.open = false;
  });
}

function closeDecisionDialog(result = "cancel") {
  if (!confirmDialogEl || !dialogScrimEl) {
    return;
  }

  confirmDialogEl.hidden = true;
  confirmDialogEl.classList.add("hidden");
  dialogScrimEl.hidden = true;
  dialogScrimEl.classList.add("hidden");
  document.body.classList.remove("modal-open");

  const resolve = dialogResolver;
  const returnFocus = dialogReturnFocusEl;
  dialogResolver = null;
  dialogReturnFocusEl = null;

  if (returnFocus && typeof returnFocus.focus === "function") {
    queueMicrotask(() => returnFocus.focus());
  }

  if (resolve) {
    resolve(result);
  }
}

function openDecisionDialog({
  eyebrow = "Please confirm",
  title = "What do you want to do?",
  message = "",
  cancelLabel = "Cancel",
  altLabel = "",
  confirmLabel = "Continue",
  destructive = false,
}) {
  if (!confirmDialogEl || !dialogScrimEl) {
    return Promise.resolve("confirm");
  }

  if (dialogResolver) {
    closeDecisionDialog("cancel");
  }

  closeTransientDetails();
  dialogReturnFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  confirmDialogEyebrowEl.textContent = eyebrow;
  confirmDialogTitleEl.textContent = title;
  confirmDialogMessageEl.textContent = message;
  confirmDialogCancelBtnEl.textContent = cancelLabel;
  confirmDialogConfirmBtnEl.textContent = confirmLabel;
  confirmDialogConfirmBtnEl.classList.toggle("warn-fill", destructive);

  const showAlt = Boolean(altLabel);
  confirmDialogAltBtnEl.hidden = !showAlt;
  confirmDialogAltBtnEl.classList.toggle("hidden", !showAlt);
  confirmDialogAltBtnEl.textContent = altLabel || "";

  confirmDialogEl.hidden = false;
  confirmDialogEl.classList.remove("hidden");
  dialogScrimEl.hidden = false;
  dialogScrimEl.classList.remove("hidden");
  document.body.classList.add("modal-open");

  return new Promise((resolve) => {
    dialogResolver = resolve;
    queueMicrotask(() => {
      const focusTarget = showAlt ? confirmDialogAltBtnEl : confirmDialogCancelBtnEl;
      if (focusTarget && typeof focusTarget.focus === "function") {
        focusTarget.focus();
      }
    });
  });
}

async function resolveDirtyBeforeContinue() {
  if (!state.dirty) {
    return true;
  }

  const decision = await openDecisionDialog({
    eyebrow: "Draft changed",
    title: "What should happen to this draft?",
    message: "You still have changes in this form.",
    cancelLabel: "Keep editing",
    altLabel: "Save and continue",
    confirmLabel: "Discard changes",
    destructive: true,
  });

  if (decision === "cancel") {
    return false;
  }

  if (decision === "alt") {
    try {
      await saveDraft();
    } catch (error) {
      console.error(error);
      setStatus(`Save failed: ${error.message}`, true);
      return false;
    }
  }

  return true;
}

function syncShellState() {
  const previewVisible = state.ui.previewOpen && Boolean(state.draft);
  if (libraryDrawerEl) {
    libraryDrawerEl.hidden = !state.ui.libraryOpen;
    if (state.ui.libraryOpen) {
      libraryDrawerEl.removeAttribute("inert");
    } else {
      libraryDrawerEl.setAttribute("inert", "");
    }
    libraryDrawerEl.classList.toggle("is-open", state.ui.libraryOpen);
    libraryDrawerEl.setAttribute("aria-hidden", String(!state.ui.libraryOpen));
  }

  if (previewPanelEl) {
    previewPanelEl.hidden = !previewVisible;
    previewPanelEl.classList.toggle("is-hidden", !previewVisible);
    previewPanelEl.setAttribute("aria-hidden", String(!previewVisible));
    if (previewVisible) {
      previewPanelEl.removeAttribute("inert");
    } else {
      previewPanelEl.setAttribute("inert", "");
    }

    if (previewPanelEl.id === "previewDrawer") {
      previewPanelEl.classList.toggle("is-open", previewVisible);
    }
  }

  workspaceShellEl?.classList.toggle("preview-open", previewVisible);
  drawerScrimEl.hidden = !state.ui.libraryOpen;
  drawerScrimEl.classList.toggle("hidden", !state.ui.libraryOpen);
  document.body.classList.toggle("drawer-open", state.ui.libraryOpen);
  if (openPreviewBtnEl) {
    openPreviewBtnEl.textContent = previewVisible ? "Hide Preview" : "Show Preview";
  }
  renderPreviewCallout();
}

function syncAdvancedModeUi() {
  if (toggleAdvancedBtnEl) {
    const enabled = state.ui.advancedMode;
    toggleAdvancedBtnEl.textContent = `Advanced: ${enabled ? "On" : "Off"}`;
    toggleAdvancedBtnEl.setAttribute("aria-pressed", String(enabled));
  }

  if (devPanelEl) {
    devPanelEl.hidden = !state.ui.advancedMode;
    if (!state.ui.advancedMode) {
      devPanelEl.open = false;
    }
  }
}

function closeDrawers() {
  state.ui.libraryOpen = false;
  syncShellState();
}

function openLibrary() {
  state.ui.libraryOpen = true;
  syncShellState();
}

function togglePreview() {
  state.ui.previewOpen = !state.ui.previewOpen;
  renderShellSummary();
  syncShellState();
}

function renderShellSummary() {
  if (!state.draft) {
    currentFormNameEl.textContent = "No form selected";
    currentFormMetaEl.textContent = "Open a form or start a blank draft.";
    stageTitleEl.textContent = "Open a form";
    stageDescriptionEl.textContent = "Edit one area at a time.";
    renderPreviewCallout();
    return;
  }

  const formName = state.draft.name || "Untitled Form";
  const groupName = state.draft.group_name || "Unassigned";
  const version = currentVersionLabel();
  const fieldCount = pluralize(currentDraftFieldCount(), "field");

  currentFormNameEl.textContent = formName;
  currentFormMetaEl.textContent = `${groupName} | ${version} | ${fieldCount}`;
  stageTitleEl.textContent = formName;
  stageDescriptionEl.textContent = state.ui.previewOpen
    ? "Edit one area at a time."
    : "Edit one area at a time. Open preview anytime.";
  renderPreviewCallout();
}

function renderPreviewCallout() {
  if (!previewCalloutTitleEl || !previewCalloutMetaEl || !openPreviewBtnEl) {
    return;
  }

  if (!state.draft) {
    previewCalloutTitleEl.textContent = "Preview";
    previewCalloutMetaEl.textContent = "Open a form to see it here.";
    openPreviewBtnEl.disabled = true;
    return;
  }

  const sectionCount = pluralize(normalizeArray(state.draft.schema.sections).length, "section");
  const fieldCount = pluralize(currentDraftFieldCount(), "field");
  openPreviewBtnEl.disabled = false;
  previewCalloutTitleEl.textContent = "Preview";

  if (state.ui.previewOpen) {
    previewCalloutMetaEl.textContent = `Live beside the editor. ${sectionCount} | ${fieldCount}.`;
    return;
  }

  previewCalloutMetaEl.textContent = `Open it when you want a quick check. ${sectionCount} | ${fieldCount}.`;
}

function resetEditorPanels() {
  const sections = normalizeArray(state.draft?.schema?.sections);
  const topFields = normalizeArray(state.draft?.schema?.fields);
  state.ui.setupOpen = !state.selectedFormSlug;
  state.ui.saveOpen = !state.selectedFormSlug;
  state.ui.topFieldsOpen = !topFields.length;
  state.ui.openSectionPaths = sections.length ? [pathKey(["schema", "sections", 0])] : [];
  state.ui.activeFieldPath = null;
  state.ui.activeOptionToken = null;
  state.ui.focusPane = defaultFocusPane();
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
    state.ui.activeOptionToken = null;
  }

  if (state.ui.activeOptionToken) {
    const parsed = parseOptionToken(state.ui.activeOptionToken);
    const field = parsed ? getNodeByPath(parsed.path) : null;
    const options = normalizeArray(field?.options);
    if (!parsed || !options[parsed.index]) {
      state.ui.activeOptionToken = null;
    }
  }

  syncFocusPane();
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
      state.ui.activeOptionToken = null;
      renderEditor();
      return;
    }
  }

  state.ui.activeFieldPath = token;
  state.ui.activeOptionToken = null;
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
  saveBtnEl.textContent = value ? "Save" : "Saved";
  renderSaveDock();
}

function setStatus(message, isError = false) {
  statusTextEl.textContent = message;
  statusTextEl.dataset.tone = isError ? "error" : "normal";
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

function navigateWithIntent(url) {
  allowIntentionalUnload = true;
  window.location.assign(url);
}

function makePresetSections(templateId) {
  if (templateId === "quick_results") {
    return [
      {
        name: "Results",
        key: "results",
        notes: [],
        fields: [],
      },
    ];
  }

  if (templateId === "structured_report") {
    return [
      {
        name: "Specimen Details",
        key: "specimen_details",
        notes: [],
        fields: [],
      },
      {
        name: "Results",
        key: "results",
        notes: [],
        fields: [],
      },
      {
        name: "Remarks",
        key: "remarks",
        notes: [],
        fields: [],
      },
    ];
  }

  return [];
}

function makeBlankForm(config = {}) {
  const formName = String(config.name || "").trim() || "Untitled Form";
  const groupName = String(config.groupName || "").trim() || "Unassigned";
  const groupKind = String(config.groupKind || "").trim() || "category";
  const groupOrder = parsePositiveInt(config.groupOrder, 999);
  const formOrder = parsePositiveInt(config.formOrder, 1);
  const templateId = String(config.templateId || "").trim() || "blank";

  return {
    slug: null,
    name: formName,
    group_name: groupName,
    group_kind: groupKind,
    group_order: groupOrder,
    form_order: formOrder,
    current_version_number: 0,
    summary: "",
    schema: {
      name: formName,
      key: slugify(formName),
      order: formOrder,
      common_field_set_id: "default_lab_request",
      notes: [],
      fields: [],
      sections: makePresetSections(templateId),
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
  setStatus("Loading builder");
  state.bootstrap = await api("/api/builder/bootstrap");
  renderFormList();
  const draftConfig = {
    name: String(initialQuery.get("draft_name") || "").trim(),
    groupName: String(initialQuery.get("group_name") || "").trim(),
    groupKind: String(initialQuery.get("group_kind") || "").trim() || "category",
    groupOrder: parsePositiveInt(initialQuery.get("group_order"), 999),
    formOrder: parsePositiveInt(initialQuery.get("form_order"), 1),
    templateId: String(initialQuery.get("template") || "").trim() || "blank",
  };

  if (initialBuilderMode === "new") {
    startNewForm(draftConfig);
  } else if (initialFormSlug) {
    await loadForm(initialFormSlug);
    if (initialBuilderMode === "duplicate") {
      duplicateCurrentForm(draftConfig);
    }
  } else if (state.bootstrap.selected_form_slug) {
    await loadForm(state.bootstrap.selected_form_slug);
  } else {
    startNewForm();
  }
}

async function loadForm(slug) {
  if (slug === state.selectedFormSlug && state.draft) {
    state.ui.libraryOpen = false;
    setStatus(`Still in ${state.draft.name}`);
    renderAll();
    return;
  }

  if (!await resolveDirtyBeforeContinue()) {
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
  setStatus(`${form.name} ready`);
  renderAll();
}

function startNewForm(config = {}) {
  state.selectedFormSlug = null;
  state.loadedForm = null;
  state.draft = makeBlankForm(config);
  state.baselineDraft = deepClone(state.draft);
  resetEditorPanels();
  setDirty(true);
  state.ui.libraryOpen = false;
  const templateId = String(config.templateId || "").trim();
  const startLabel = templateId && templateId !== "blank"
    ? `${state.draft.name} draft ready`
    : "Blank draft ready";
  setStatus(startLabel);
  renderAll();
}

function duplicateCurrentForm(overrides = {}) {
  if (!state.draft) {
    startNewForm(overrides);
    return;
  }
  const copy = deepClone(state.draft);
  copy.slug = null;
  copy.current_version_number = 0;
  copy.summary = "";
  copy.name = String(overrides.name || "").trim() || makeCopyName(copy.name);
  copy.group_name = String(overrides.groupName || "").trim() || copy.group_name;
  copy.group_kind = String(overrides.groupKind || "").trim() || copy.group_kind;
  copy.group_order = parsePositiveInt(overrides.groupOrder, parsePositiveInt(copy.group_order, 999));
  copy.form_order = parsePositiveInt(overrides.formOrder, parsePositiveInt(copy.form_order, 1));
  copy.schema.name = copy.name;
  copy.schema.key = slugify(copy.name);
  copy.schema.order = copy.form_order;
  state.selectedFormSlug = null;
  state.loadedForm = null;
  state.draft = copy;
  state.baselineDraft = deepClone(copy);
  resetEditorPanels();
  setDirty(true);
  state.ui.libraryOpen = false;
  setStatus("New draft copied from the current form");
  renderAll();
}

async function resetCurrentDraft() {
  if (!state.baselineDraft) {
    return;
  }

  const message = state.selectedFormSlug
    ? "Go back to the last saved version of this form."
    : "Clear this draft and go back to its starting point.";
  const decision = await openDecisionDialog({
    eyebrow: "Reset draft",
    title: state.selectedFormSlug ? "Reset to the saved version?" : "Reset this draft?",
    message,
    cancelLabel: "Keep editing",
    confirmLabel: state.selectedFormSlug ? "Reset draft" : "Clear draft",
    destructive: true,
  });
  if (decision !== "confirm") {
    return;
  }

  state.draft = deepClone(state.baselineDraft);
  resetEditorPanels();
  setDirty(false);
  setStatus(state.selectedFormSlug ? "Returned to the last saved version" : "Draft reset");
  renderAll();
}

async function confirmDeleteNode(path) {
  const decision = await openDecisionDialog({
    eyebrow: "Delete item",
    title: "Remove this item from the form?",
    message: "This only changes the current draft until you save.",
    cancelLabel: "Keep item",
    confirmLabel: "Delete item",
    destructive: true,
  });

  if (decision === "confirm") {
    deleteAtPath(path);
  }
}

function renderAll() {
  renderShellSummary();
  renderFormList();
  if (state.draft) {
    syncEditorPanels();
  }
  renderOutline();
  renderEditor();
  renderPreview();
  renderJson();
  renderSaveDock();
  syncAdvancedModeUi();
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
  saveDockTitleEl.textContent = state.selectedFormSlug ? "Draft changed" : "New draft";
  saveDockMetaEl.textContent = note
    ? `Note: ${note}`
    : "Save now, or add a short note first.";
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

function defaultFocusPane() {
  const sections = normalizeArray(state.draft?.schema?.sections);
  const freeFields = normalizeArray(state.draft?.schema?.fields);

  if (!state.selectedFormSlug) {
    return "setup";
  }
  if (sections.length) {
    return "sections";
  }
  if (freeFields.length) {
    return "free_fields";
  }
  return "setup";
}

function syncFocusPane() {
  const focus = String(state.ui.focusPane || "");
  const valid = new Set(["setup", "free_fields", "sections", "save"]);
  if (!valid.has(focus)) {
    state.ui.focusPane = defaultFocusPane();
  }
}

function setFocusPane(pane) {
  state.ui.focusPane = pane;
  renderAll();
}

function focusSectionAtIndex(index) {
  const sections = normalizeArray(state.draft?.schema?.sections);
  if (!sections[index]) {
    return;
  }

  state.ui.focusPane = "sections";
  state.ui.openSectionPaths = [pathKey(["schema", "sections", index])];
  state.ui.activeFieldPath = null;
  renderAll();
}

function renderOutline() {
  if (!builderOutlineEl) {
    return;
  }

  if (!state.draft) {
    builderOutlineEl.innerHTML = '<div class="empty-state">No draft loaded.</div>';
    return;
  }

  const sections = normalizeArray(state.draft.schema.sections);
  const freeFields = normalizeArray(state.draft.schema.fields);
  const focusPane = String(state.ui.focusPane || defaultFocusPane());
  const openSectionToken = normalizeArray(state.ui.openSectionPaths)[0] || "";

  builderOutlineEl.innerHTML = `
      <div class="outline-head">
        <p class="eyebrow">Outline</p>
        <h3>${escapeHtml(state.draft.name || "Untitled Form")}</h3>
      </div>

      <nav class="outline-nav">
        <button class="outline-item ${focusPane === "setup" ? "active" : ""}" type="button" data-action="focus-pane" data-pane="setup">
          <span>Basics</span>
        </button>
        <button class="outline-item ${focusPane === "free_fields" ? "active" : ""}" type="button" data-action="focus-pane" data-pane="free_fields">
          <span>Ungrouped fields</span>
        </button>
      <button class="outline-item ${focusPane === "sections" ? "active" : ""}" type="button" data-action="focus-pane" data-pane="sections">
        <span>Sections</span>
      </button>
      ${sections.length ? `
        <div class="outline-sublist">
          ${sections.map((section, index) => {
            const token = pathKey(["schema", "sections", index]);
            return `
              <button class="outline-subitem ${focusPane === "sections" && openSectionToken === token ? "active" : ""}" type="button" data-action="focus-section" data-index="${index}">
                <span>${escapeHtml(section.name || `Section ${index + 1}`)}</span>
                ${focusPane === "sections" && openSectionToken === token ? '<span class="outline-state">Editing</span>' : ""}
              </button>
            `;
          }).join("")}
        </div>
        ` : `
          <div class="outline-empty">No sections yet.</div>
        `}
        <button class="outline-item ${focusPane === "save" ? "active" : ""}" type="button" data-action="focus-pane" data-pane="save">
          <span>Save draft</span>
        </button>
      </nav>
    `;
  }

function renderEditor() {
  destroySortables();

  if (!state.draft) {
    formEditorEl.innerHTML = '<div class="empty-state">No draft loaded.</div>';
    return;
  }

  syncEditorPanels();
  const focusPane = String(state.ui.focusPane || defaultFocusPane());

  if (focusPane === "setup") {
    formEditorEl.innerHTML = renderFormSetupCard({ focusMode: true });
  } else if (focusPane === "free_fields") {
    formEditorEl.innerHTML = renderTopFieldsCard({ focusMode: true });
  } else if (focusPane === "save") {
    formEditorEl.innerHTML = renderSaveCard({ focusMode: true });
  } else {
    formEditorEl.innerHTML = renderSectionsCard({ focusMode: true });
  }

  formEditorEl.classList.remove("pane-setup", "pane-free_fields", "pane-sections", "pane-save");
  formEditorEl.classList.add(`pane-${focusPane}`);

  setupSortableCollections();
}

function renderFormSetupCard(options = {}) {
  const focusMode = Boolean(options.focusMode);
  const setupOpen = focusMode ? true : state.ui.setupOpen;
  const formName = state.draft.name || "Untitled Form";
  const groupName = state.draft.group_name || "Unassigned";
  const sharedFieldSetName = currentCommonFieldSetName();
  const currentVersion = currentVersionLabel();
  return `
    <section class="editor-card">
      <div class="card-head">
        <div>
          <p class="eyebrow">Basics</p>
          <div class="card-title-row">
            <h3 class="card-title">Basics</h3>
            ${renderHelpPopover("Basics help", "Name the form and choose which folder it belongs to. Leave advanced defaults tucked away unless you really need them.")}
          </div>
        </div>
        ${focusMode ? "" : `
        <div class="top-actions">
          <button class="ghost mini" type="button" data-action="toggle-setup">${setupOpen ? "Done" : "Open"}</button>
        </div>
        `}
      </div>

      ${setupOpen ? `
        <div class="editor-spotlight">
          <div>
            <strong>${escapeHtml(formName)}</strong>
            <span>${escapeHtml(groupName)}</span>
          </div>
          <div class="editor-spotlight-meta">
            <span class="chip">${escapeHtml(currentVersion)}</span>
          </div>
        </div>
        <div class="setup-grid">
          <label>
            <span>Form title</span>
            <input data-bind="name" value="${escapeHtml(formName)}" placeholder="Example: Urinalysis">
          </label>
          <label>
            <span>Folder</span>
            <input list="groupNameSuggestions" data-bind="group_name" value="${escapeHtml(groupName)}" placeholder="Type or choose a folder">
          </label>
        </div>
        ${renderGroupNameSuggestions()}
        ${state.ui.advancedMode ? `
          <details class="advanced">
            <summary>Advanced</summary>
            <div class="advanced-grid">
              <label>
                <span>Default record details</span>
                <select data-bind="schema.common_field_set_id">
                  ${renderCommonFieldSetOptions(state.draft.schema.common_field_set_id || "default_lab_request")}
                </select>
              </label>
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
        ` : ""}
      ` : `
        <div class="collapsed-copy">
          <strong>${escapeHtml(formName)}</strong>
          ${escapeHtml(groupName)}${state.ui.advancedMode ? ` | ${escapeHtml(sharedFieldSetName)}` : ""}
        </div>
      `}
    </section>
  `;
}

function renderSaveCard(options = {}) {
  const focusMode = Boolean(options.focusMode);
  const saveOpen = focusMode ? true : state.ui.saveOpen;
  const note = String(state.draft.summary || "").trim();
  const dirtyLabel = state.dirty ? "Ready to save" : "Already saved";
  const helperCopy = state.dirty
    ? "Save this draft when the current changes already look right."
    : "No unsaved changes right now.";
  return `
    <section class="editor-card">
      <div class="card-head">
        <div>
          <p class="eyebrow">Finish</p>
          <div class="card-title-row">
            <h3 class="card-title">Save draft</h3>
            ${renderHelpPopover("Version note help", "Version notes are optional. Add one only when you want to remember what changed.")}
          </div>
        </div>
        ${focusMode ? "" : `
        <div class="top-actions">
          <button class="ghost mini" type="button" data-action="toggle-save-step">${saveOpen ? "Done" : "Open"}</button>
        </div>
        `}
      </div>

      ${saveOpen ? `
        <div class="save-spotlight">
          <div>
            <strong>${escapeHtml(dirtyLabel)}</strong>
            <span>${escapeHtml(currentVersionLabel())} | ${escapeHtml(helperCopy)}</span>
          </div>
          <span class="chip soft">${currentDraftFieldCount()} fields</span>
        </div>
        <div class="save-step-inline">
          <label>
            <span>Note (optional)</span>
            <input data-bind="summary" value="${escapeHtml(state.draft.summary || "")}" placeholder="Example: Added urine ketone choices">
          </label>
          <button class="secondary" type="button" data-action="save-draft">Save now</button>
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
        <summary aria-label="More actions" title="More actions">...</summary>
        <div class="action-menu">
          <button class="ghost mini" type="button" data-action="duplicate-node" data-path="${encodePath(path)}">Duplicate</button>
          <button class="ghost mini warn" type="button" data-action="delete-node" data-path="${encodePath(path)}">Delete</button>
        </div>
      </details>
    `;
  }

function renderManageFooter(path) {
    return `
      <details class="manage-details">
        <summary>More options</summary>
        <div class="manage-actions">
          <button class="ghost mini" type="button" data-action="duplicate-node" data-path="${encodePath(path)}">Duplicate</button>
          <button class="ghost mini warn" type="button" data-action="delete-node" data-path="${encodePath(path)}">Delete</button>
        </div>
      </details>
    `;
  }

function renderOptionManageFooter(path, index) {
    return `
      <details class="manage-details">
        <summary>More options</summary>
        <div class="manage-actions">
          <button class="ghost mini" type="button" data-action="duplicate-option" data-path="${encodePath(path)}" data-index="${index}">Duplicate</button>
          <button class="ghost mini warn" type="button" data-action="delete-option" data-path="${encodePath(path)}" data-index="${index}">Delete</button>
        </div>
      </details>
    `;
  }

function renderTopFieldsCard(options = {}) {
  const focusMode = Boolean(options.focusMode);
  const topFields = normalizeArray(state.draft.schema.fields);
  const itemCount = pluralize(topFields.length, "item");
  const topFieldsOpen = focusMode ? true : state.ui.topFieldsOpen;
  return `
    <section class="editor-card">
      <div class="card-head">
        <div>
          <div class="card-title-row">
            <h3 class="card-title">Ungrouped fields</h3>
            ${renderHelpPopover("Ungrouped fields help", "Use these only when a field should stay outside a named section.")}
          </div>
        </div>
        <div class="top-actions">
          ${focusMode ? "" : `<button class="ghost mini" type="button" data-action="toggle-top-fields">${topFieldsOpen ? "Done" : "Open"}</button>`}
          ${topFieldsOpen ? `
            <button class="secondary mini" type="button" data-action="add-top-field">Add field</button>
            <button class="ghost mini" type="button" data-action="add-top-group">Add group</button>
          ` : ""}
        </div>
      </div>
      ${topFieldsOpen
        ? renderFieldCollection(topFields, ["schema", "fields"], { focused: true })
        : `<div class="collapsed-copy">${escapeHtml(itemCount)} hidden here.</div>`}
    </section>
  `;
}

function renderSectionsCard(options = {}) {
    const sections = normalizeArray(state.draft.schema.sections);
  const selectedPath = normalizeArray(state.ui.openSectionPaths)[0]
    ? parsePathKey(normalizeArray(state.ui.openSectionPaths)[0])
    : null;
  const selectedIndex = selectedPath && selectedPath[0] === "schema" && selectedPath[1] === "sections"
    ? selectedPath[2]
    : 0;
  const selectedSection = Number.isInteger(selectedIndex) ? sections[selectedIndex] : null;

  return `
    <section class="editor-card">
        <div class="card-head">
          <div>
            <div class="card-title-row">
              <h3 class="card-title">Sections</h3>
              <span class="chip soft">${sections.length}</span>
              ${renderHelpPopover("Sections help", "Use sections when the form needs named groups of fields. Open one when you want to edit it, and drag to reorder them.")}
            </div>
          </div>
        <div class="top-actions">
          <button class="secondary mini" type="button" data-action="add-section">Add section</button>
        </div>
      </div>
        ${sections.length ? `
          <div class="section-organizer" data-collection-path="${encodePath(["schema", "sections"])}">
            ${sections.map((section, index) => renderSectionOrganizerItem(section, index, index === selectedIndex)).join("")}
          </div>
          <div class="section-focus-stage">
            ${selectedSection
              ? renderSectionCard(selectedSection, ["schema", "sections", selectedIndex], { forceOpen: true, hideToggle: true, focusedCard: true })
              : '<div class="empty-state">Choose a section from the list to keep editing.</div>'}
          </div>
        ` : '<div class="empty-state">No sections yet. Add one to start organizing the form.</div>'}
      </section>
    `;
}

function renderSectionOrganizerItem(section, index, active) {
    const itemCount = pluralize(normalizeArray(section.fields).length, "item");
    return `
      <div class="section-organizer-item ${active ? "active" : ""}">
        <button class="drag-handle" type="button" title="Drag to reorder" aria-label="Drag to reorder">
          <span class="drag-dots" aria-hidden="true"></span>
        </button>
        <button class="section-organizer-select" type="button" data-action="focus-section" data-index="${index}">
          <span class="section-organizer-copy">
            <strong>${escapeHtml(section.name || `Section ${index + 1}`)}</strong>
            <span>${escapeHtml(itemCount)}</span>
          </span>
          ${active ? '<span class="section-organizer-state">Editing</span>' : ""}
        </button>
      </div>
    `;
  }
  
function renderSectionCard(section, path, options = {}) {
    const focusedCard = Boolean(options.focusedCard);
    const open = Boolean(options.forceOpen) || isSectionOpen(path);
    const itemCount = pluralize(normalizeArray(section.fields).length, "item");
    const showHeaderActions = !focusedCard || !options.hideToggle;
    return `
      <article class="section-card ${open ? "is-open" : ""} ${focusedCard ? "is-focused" : ""}" data-node-path="${encodePath(path)}" data-parent-path="${encodePath(path.slice(0, -1))}">
        <div class="section-head ${focusedCard ? "section-head-focused" : ""}">
          <div>
            <div class="chip-row">
              <span class="chip warm">Section</span>
              <span class="chip soft">${itemCount}</span>
            </div>
            <h4 class="section-display-title">${escapeHtml(section.name || "Untitled Section")}</h4>
          </div>
          ${showHeaderActions ? `
          <div class="row-actions">
            ${focusedCard ? "" : `
            <button class="drag-handle" type="button" title="Drag to reorder" aria-label="Drag to reorder">
              <span class="drag-dots" aria-hidden="true"></span>
            </button>
            `}
            ${options.hideToggle ? "" : `<button class="ghost mini" type="button" data-action="toggle-section" data-path="${encodePath(path)}">${open ? "Done" : "Open"}</button>`}
            ${renderNodeActionMenu(path)}
          </div>
          ` : ""}
        </div>
  
        ${open ? `
          ${focusedCard ? `
            <div class="section-spotlight">
              <strong>Section</strong>
              <span>${escapeHtml(itemCount)}</span>
            </div>
          ` : ""}
          <div class="section-builder-head ${focusedCard ? "compact" : ""}">
            <label class="section-title-wrap">
              <span>Name</span>
              <input class="section-title-input" data-path="${encodePath(path)}" data-bind="name" value="${escapeHtml(section.name || "")}" placeholder="Example: Chemical Findings">
            </label>
            <div class="section-quick-actions">
              <button class="secondary mini" type="button" data-action="add-field" data-path="${encodePath([...path, "fields"])}">Add field</button>
              <button class="ghost mini" type="button" data-action="add-group" data-path="${encodePath([...path, "fields"])}">Add group</button>
          </div>
        </div>

        ${renderFieldCollection(section.fields, [...path, "fields"], { focused: true })}

          ${state.ui.advancedMode ? `
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
          ${focusedCard ? renderManageFooter(path) : ""}
        ` : ""}
      </article>
    `;
  }

function renderFieldCollection(fields, collectionPath, options = {}) {
    const items = normalizeArray(fields);
    if (!items.length) {
      return '<div class="empty-state">Nothing here yet. Add a field when you are ready.</div>';
    }
  if (options.focused) {
    const selectedIndex = resolveFocusedFieldIndex(collectionPath, items);
    const selectedField = items[selectedIndex] || null;
    return `
      <div class="field-organizer" data-collection-path="${encodePath(collectionPath)}">
        ${items.map((field, index) => renderFieldOrganizerItem(field, [...collectionPath, index], index, index === selectedIndex)).join("")}
      </div>
      <div class="field-focus-stage">
        ${selectedField
          ? renderFieldCard(selectedField, [...collectionPath, selectedIndex], { forceOpen: true, hideToggle: true, focusedCard: true })
          : '<div class="empty-state">Choose a field from the list to keep editing.</div>'}
      </div>
    `;
  }
  return `<div class="field-list" data-collection-path="${encodePath(collectionPath)}">${items.map((field, index) => renderFieldCard(field, [...collectionPath, index])).join("")}</div>`;
}

function resolveFocusedFieldIndex(collectionPath, items) {
  if (!items.length) {
    return 0;
  }

  if (!state.ui.activeFieldPath) {
    return 0;
  }

  const activePath = parsePathKey(state.ui.activeFieldPath);
  const matchIndex = items.findIndex((_, index) => pathStartsWith(activePath, [...collectionPath, index]));
  return matchIndex >= 0 ? matchIndex : 0;
}

function optionToken(path, index) {
  return `${pathKey(path)}::${index}`;
}

function parseOptionToken(token) {
  const marker = String(token || "");
  const splitIndex = marker.lastIndexOf("::");
  if (splitIndex <= 0) {
    return null;
  }
  const path = parsePathKey(marker.slice(0, splitIndex));
  const index = Number(marker.slice(splitIndex + 2));
  if (!path.length || Number.isNaN(index)) {
    return null;
  }
  return { path, index };
}

function resolveFocusedOptionIndex(path, options) {
  if (!options.length) {
    return -1;
  }
  const parsed = parseOptionToken(state.ui.activeOptionToken);
  if (parsed && pathKey(parsed.path) === pathKey(path) && options[parsed.index]) {
    return parsed.index;
  }
  return 0;
}

function summarizeField(field) {
  const isGroup = field.kind === "field_group";
  const childCount = normalizeArray(field.fields).length;
  const optionCount = normalizeArray(field.options).length;
  const fieldType = inferFieldType(field);
  return isGroup
    ? `${childCount} child fields`
    : `${FIELD_TYPES.find((item) => item.id === fieldType)?.label || "Short answer"}${optionCount ? ` | ${optionCount} choices` : ""}`;
}

function renderFieldOrganizerItem(field, path, index, active) {
    const isGroup = field.kind === "field_group";
    return `
      <div class="field-organizer-item ${active ? "active" : ""}">
        <button class="drag-handle" type="button" title="Drag to reorder" aria-label="Drag to reorder">
          <span class="drag-dots" aria-hidden="true"></span>
        </button>
        <button class="field-organizer-select" type="button" data-action="focus-field" data-path="${encodePath(path)}">
          <span class="field-organizer-copy">
            <strong>${escapeHtml(field.name || (isGroup ? `Group ${index + 1}` : `Field ${index + 1}`))}</strong>
            <span>${escapeHtml(summarizeField(field))}</span>
          </span>
          ${active ? '<span class="field-organizer-state">Editing</span>' : ""}
        </button>
      </div>
    `;
  }

function renderFieldCard(field, path, options = {}) {
    const isGroup = field.kind === "field_group";
    const open = Boolean(options.forceOpen) || isFieldOpen(path);
    const summary = summarizeField(field);
    const fieldType = inferFieldType(field);
    const focusedCard = Boolean(options.focusedCard);
    const showHeaderActions = !focusedCard || !options.hideToggle;
    const compactNormal = compactText(field.normal_value);
    const compactUnit = compactText(field.unit_hint);
    const metaBits = [
      summary,
      compactUnit ? `Unit: ${compactUnit}` : "",
      compactNormal ? `Normal: ${compactNormal}` : "",
    ].filter(Boolean);
  
    return `
      <article class="field-card ${isGroup ? "group-card" : ""} ${open ? "is-open" : ""} ${focusedCard ? "is-focused" : ""}" data-node-path="${encodePath(path)}" data-parent-path="${encodePath(path.slice(0, -1))}">
        <div class="field-head ${focusedCard ? "field-head-focused" : ""}">
          <div>
            <div class="field-meta">
              ${isGroup ? '<span class="chip warm">Group</span>' : ""}
              <span class="field-summary">${escapeHtml(summary)}</span>
            </div>
            <h4 class="field-display-title">${escapeHtml(field.name || (isGroup ? "Untitled Group" : "Untitled Field"))}</h4>
          </div>
          ${showHeaderActions ? `
          <div class="row-actions">
            ${focusedCard ? "" : `
            <button class="drag-handle" type="button" title="Drag to reorder" aria-label="Drag to reorder">
              <span class="drag-dots" aria-hidden="true"></span>
            </button>
            `}
            ${options.hideToggle ? "" : `<button class="ghost mini" type="button" data-action="toggle-field" data-path="${encodePath(path)}">${open ? "Done" : "Edit"}</button>`}
            ${renderNodeActionMenu(path)}
          </div>
          ` : ""}
        </div>
  
        ${open ? `
          ${focusedCard ? `
            <div class="field-spotlight">
              <strong>${escapeHtml(isGroup ? "Group" : "Field")}</strong>
              <span>${escapeHtml(metaBits.join(" | "))}</span>
            </div>
          ` : ""}

          <div class="inline-grid field-basics-grid ${focusedCard ? "compact" : ""}">
            <label>
              <span>${isGroup ? "Group name" : "Label"}</span>
              <input class="field-title-input" data-path="${encodePath(path)}" data-bind="name" value="${escapeHtml(field.name || "")}" placeholder="${isGroup ? "Example: Vital Signs" : "Example: Color"}">
            </label>
            ${isGroup ? `
              <label>
                <span>Type</span>
                <input value="Field group" disabled>
              </label>
            ` : `
              <label>
                <span>Type</span>
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

          ${state.ui.advancedMode ? `
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
          ${focusedCard ? renderManageFooter(path) : ""}
        ` : ""}
      </article>
    `;
  }

function renderOptionsEditor(field, path) {
    const options = normalizeArray(field.options);
    const selectedIndex = resolveFocusedOptionIndex(path, options);
    const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
    const selectedOptionName = String(selectedOption?.name || "").trim() || "Untitled choice";
    return `
      <section class="field-stack">
        <div class="card-head">
          <div>
            <div class="card-title-row">
              <h4>Choices</h4>
              <span class="chip soft">${options.length}</span>
            </div>
          </div>
          <div class="option-actions">
            <button class="ghost mini" type="button" data-action="add-option" data-path="${encodePath(path)}">Add choice</button>
          </div>
        </div>
      ${options.length ? `
        <div class="option-organizer">
          ${options.map((option, index) => `
            <div class="option-organizer-item ${index === selectedIndex ? "active" : ""}">
              <button class="option-organizer-select" type="button" data-action="focus-option" data-path="${encodePath(path)}" data-index="${index}">
                <span class="option-organizer-copy">
                  <strong>${escapeHtml(option.name || "Untitled choice")}</strong>
                </span>
                ${index === selectedIndex ? '<span class="option-organizer-state">Editing</span>' : ""}
              </button>
            </div>
          `).join("")}
        </div>
        <div class="option-focus-stage">
          ${selectedOption ? `
            <div class="option-focus-card">
                <div class="option-spotlight">
                  <strong>Choice</strong>
                  <span>${escapeHtml(selectedOptionName)}</span>
                </div>
                <div class="option-focus-head">
                  <div>
                    <h5>${escapeHtml(selectedOptionName)}</h5>
                  </div>
                </div>
                <label class="option-focus-input">
                  <span>Label</span>
                  <input data-action="option-name" data-path="${encodePath(path)}" data-index="${selectedIndex}" value="${escapeHtml(selectedOption.name || "")}" placeholder="Option name">
                </label>
                ${renderOptionManageFooter(path, selectedIndex)}
              </div>
          ` : '<div class="empty-state">Choose a choice to keep editing.</div>'}
        </div>
      ` : '<div class="empty-state">This dropdown has no choices yet.</div>'}
    </section>
  `;
}

function renderPreview() {
  if (!state.draft) {
    previewCanvasEl.innerHTML = '<div class="empty-state">No preview yet.</div>';
    return;
  }

  const totalFields = countFields(state.draft.schema);
  const freeFields = normalizeArray(state.draft.schema.fields);
  const sections = normalizeArray(state.draft.schema.sections);
  const previewTargets = [
    ...(freeFields.length ? [{ id: "preview_section_free_fields", label: "Ungrouped fields" }] : []),
    ...sections.map((section, index) => ({
      id: previewSectionId(section.name || "Section", index),
      label: section.name || "Section",
    })),
  ];
  const activePreviewSectionId = previewTargets.some((item) => item.id === state.ui.activePreviewSectionId)
    ? state.ui.activePreviewSectionId
    : (previewTargets[0]?.id || null);
  state.ui.activePreviewSectionId = activePreviewSectionId;
  previewCanvasEl.innerHTML = `
    <section class="preview-card">
      <div class="preview-shell">
        <div class="preview-head">
          <div>
            <div class="preview-live-row">
              <span class="live-pill">
                <span class="live-dot"></span>
                Live
              </span>
              <span class="preview-sync-copy">Sample only</span>
            </div>
            <h3 class="preview-title">${escapeHtml(state.draft.name || "Untitled Form")}</h3>
            <p class="panel-copy">${escapeHtml(state.draft.group_name || "Unassigned")} | ${escapeHtml(currentVersionLabel())}</p>
          </div>
        </div>
        <div class="preview-badges">
          <span class="chip">${totalFields} fields</span>
          <span class="chip soft">${sections.length} sections</span>
        </div>
        <div class="preview-index">
          ${previewTargets.map((item) => `
            <button
              class="preview-index-chip ${item.id === activePreviewSectionId ? "active" : ""}"
              type="button"
              data-preview-target="${escapeHtml(item.id)}"
              aria-pressed="${item.id === activePreviewSectionId ? "true" : "false"}"
            >${escapeHtml(item.label)}</button>
          `).join("")}
        </div>
        <div class="preview-paper">
          ${freeFields.length ? renderPreviewSection("Ungrouped fields", freeFields, "preview_section_free_fields") : ""}
          ${sections.map((section, index) => renderPreviewSection(section.name || "Untitled Section", section.fields, previewSectionId(section.name || "Section", index))).join("")}
        </div>
      </div>
    </section>
  `;
  syncPreviewIndexSelection();
}

function previewSectionId(title, index) {
  return `preview_section_${slugify(title)}_${index}`;
}

function renderPreviewSection(title, fields, previewId) {
  const normalizedFields = normalizeArray(fields);
  if (!normalizedFields.length) {
    return "";
  }

  return `
    <section class="preview-section" id="${escapeHtml(previewId)}">
      <div class="preview-section-head">
        <h4>${escapeHtml(title)}</h4>
        <span class="chip soft">${countPreviewFields(normalizedFields)} fields</span>
      </div>
      <div class="preview-grid">
        ${normalizedFields.map(renderPreviewField).join("")}
      </div>
    </section>
  `;
}

function countPreviewFields(fields) {
  return normalizeArray(fields).reduce((count, field) => {
    if (field?.kind === "field_group") {
      return count + countPreviewFields(field.fields);
    }
    return count + 1;
  }, 0);
}

function previewInputType(field) {
  const fieldType = inferFieldType(field);
  if (fieldType === "number") {
    return "number";
  }
  if (fieldType === "date") {
    return "date";
  }
  if (fieldType === "time") {
    return "time";
  }
  if (fieldType === "datetime") {
    return "datetime-local";
  }
  return "text";
}

function previewPlaceholder(field) {
  if (field.unit_hint) {
    return field.unit_hint;
  }
  if (inferFieldType(field) === "number") {
    return "Enter value";
  }
  return "Sample input";
}

function renderPreviewField(field) {
  if (field.kind === "field_group") {
    return `
      <div class="preview-group">
        <div class="preview-group-head">
          <div class="preview-group-title">${escapeHtml(field.name || "Field group")}</div>
          <span class="chip warm">${countPreviewFields(field.fields)} fields</span>
        </div>
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
        <select disabled>
          ${normalizeArray(field.options).map((option) => `<option>${escapeHtml(option.name || "Option")}</option>`).join("")}
        </select>
      ` : `<input type="${previewInputType(field)}" placeholder="${escapeHtml(previewPlaceholder(field))}" disabled>`}
      ${hints.length ? `<div class="preview-hint">${escapeHtml(hints.join(" | "))}</div>` : ""}
    </label>
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
  } else if (path.includes("sections")) {
    state.ui.openSectionPaths = [pathKey([...path.slice(0, -1), index + 1])];
    state.ui.focusPane = "sections";
    state.ui.activeFieldPath = null;
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
  if (path.includes("sections") && isSectionOpen(path)) {
    state.ui.openSectionPaths = [];
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
    state.ui.focusPane = "free_fields";
  }
  touch({ full: true });
}

function addSection() {
  state.draft.schema.sections.push(makeBlankSection());
  state.ui.openSectionPaths = [pathKey(["schema", "sections", state.draft.schema.sections.length - 1])];
  state.ui.activeFieldPath = null;
  state.ui.focusPane = "sections";
  touch({ full: true });
}

function addOption(path) {
  const field = getNodeByPath(path);
  ensureOptionShape(field);
  field.options.push({ name: `Option ${field.options.length + 1}` });
  state.ui.activeOptionToken = optionToken(path, field.options.length - 1);
  touch({ full: true });
}

function duplicateOption(path, index) {
  const field = getNodeByPath(path);
  ensureOptionShape(field);
  const source = field.options[index];
  if (!source) {
    return;
  }
  const duplicate = deepClone(source);
  const baseName = String(duplicate.name || "").trim() || "Untitled choice";
  duplicate.name = `${baseName} Copy`;
  field.options.splice(index + 1, 0, duplicate);
  state.ui.activeOptionToken = optionToken(path, index + 1);
  touch({ full: true });
}

function deleteOption(path, index) {
  const field = getNodeByPath(path);
  ensureOptionShape(field);
  field.options.splice(index, 1);
  if (field.options.length) {
    state.ui.activeOptionToken = optionToken(path, Math.max(0, Math.min(index, field.options.length - 1)));
  } else {
    state.ui.activeOptionToken = null;
  }
  touch({ full: true });
}

async function confirmDeleteOption(path, index) {
  const field = getNodeByPath(path);
  ensureOptionShape(field);
  const option = field.options[index];
  if (!option) {
    return;
  }

  const optionName = String(option.name || "").trim() || "this choice";
  const decision = await openDecisionDialog({
    eyebrow: "Delete choice",
    title: `Delete ${optionName}?`,
    message: "This choice will be removed from the dropdown.",
    cancelLabel: "Keep choice",
    confirmLabel: "Delete choice",
    destructive: true,
  });

  if (decision !== "confirm") {
    return;
  }

  deleteOption(path, index);
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
  setStatus(`${saved.name} saved as Version ${saved.current_version_number}`);
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

async function handleEditorClick(event) {
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
    state.ui.focusPane = "free_fields";
    renderEditor();
    return;
  }
  if (action === "toggle-setup") {
    state.ui.focusPane = "setup";
    toggleSetup();
    return;
  }
  if (action === "toggle-save-step") {
    state.ui.focusPane = "save";
    toggleSaveStep();
    return;
  }
  if (action === "focus-option" && path) {
    state.ui.activeOptionToken = optionToken(path, Number(actionTarget.dataset.index));
    renderAll();
    return;
  }
  if (action === "focus-section") {
    focusSectionAtIndex(Number(actionTarget.dataset.index));
    return;
  }
  if (action === "focus-field" && path) {
    state.ui.activeFieldPath = pathKey(path);
    state.ui.activeOptionToken = null;
    renderAll();
    return;
  }
  if (action === "toggle-section" && path) {
    state.ui.focusPane = "sections";
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
    await confirmDeleteNode(path);
    return;
  }
  if (action === "add-option" && path) {
    addOption(path);
    return;
  }
  if (action === "duplicate-option" && path) {
    duplicateOption(path, Number(actionTarget.dataset.index));
    return;
  }
  if (action === "delete-option" && path) {
    await confirmDeleteOption(path, Number(actionTarget.dataset.index));
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
    state.ui.activeOptionToken = event.target.value === "choice"
      ? optionToken(decodePath(event.target.dataset.path), 0)
      : null;
    touch({ full: true });
    return;
  }
  handleRootInput(event);
}

function handleOutlineClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const action = actionTarget.dataset.action;
  if (action === "focus-pane") {
    setFocusPane(actionTarget.dataset.pane || defaultFocusPane());
    return;
  }

  if (action === "focus-section") {
    focusSectionAtIndex(Number(actionTarget.dataset.index));
  }
}

function handlePreviewClick(event) {
  const target = event.target.closest("[data-preview-target]");
  if (!target || !(target instanceof HTMLElement) || !previewCanvasEl) {
    return;
  }

  const previewTarget = String(target.dataset.previewTarget || "");
  if (!previewTarget) {
    return;
  }

  const sectionEl = previewCanvasEl.querySelector(`#${CSS.escape(previewTarget)}`);
  if (!(sectionEl instanceof HTMLElement)) {
    return;
  }

  state.ui.activePreviewSectionId = previewTarget;
  syncPreviewIndexSelection();
  sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function syncPreviewIndexSelection() {
  if (!previewCanvasEl) {
    return;
  }

  previewCanvasEl.querySelectorAll("[data-preview-target]").forEach((item) => {
    if (!(item instanceof HTMLElement)) {
      return;
    }
    const isActive = item.dataset.previewTarget === state.ui.activePreviewSectionId;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-pressed", String(isActive));
  });
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
builderOutlineEl?.addEventListener("click", handleOutlineClick);
previewCanvasEl?.addEventListener("click", handlePreviewClick);
formEditorEl.addEventListener("toggle", (event) => {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement) || !details.open) {
    return;
  }

  if (details.classList.contains("action-details") || details.classList.contains("manage-details")) {
    formEditorEl.querySelectorAll(".action-details[open], .manage-details[open]").forEach((item) => {
      if (item !== details) {
        item.open = false;
      }
    });
  }

  if (details.classList.contains("inline-help")) {
    formEditorEl.querySelectorAll(".inline-help[open]").forEach((item) => {
      if (item !== details) {
        item.open = false;
      }
    });
  }
}, true);

document.addEventListener("click", (event) => {
  if (isDialogOpen()) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest(".action-details, .manage-details, .inline-help")) {
    return;
  }

  closeTransientDetails();
});

document.getElementById("openLibraryBtn").addEventListener("click", () => {
  openLibrary();
});

document.getElementById("closeLibraryBtn").addEventListener("click", () => {
  closeDrawers();
});

if (toggleAdvancedBtnEl) {
  toggleAdvancedBtnEl.addEventListener("click", () => {
    state.ui.advancedMode = !state.ui.advancedMode;
    closeTransientDetails();
    renderAll();
  });
}

drawerScrimEl.addEventListener("click", () => {
  closeDrawers();
});

document.getElementById("newFormBtn").addEventListener("click", async () => {
  if (!await resolveDirtyBeforeContinue()) {
    return;
  }
  navigateWithIntent("/forms/new");
});

document.getElementById("duplicateFormBtn").addEventListener("click", async () => {
  if (!await resolveDirtyBeforeContinue()) {
    return;
  }

  if (state.selectedFormSlug) {
    navigateWithIntent(`/forms/new?source=${encodeURIComponent(state.selectedFormSlug)}`);
    return;
  }

  navigateWithIntent("/forms/new");
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
  void resetCurrentDraft();
});

if (dialogScrimEl) {
  dialogScrimEl.addEventListener("click", () => {
    closeDecisionDialog("cancel");
  });
}

if (confirmDialogCancelBtnEl) {
  confirmDialogCancelBtnEl.addEventListener("click", () => {
    closeDecisionDialog("cancel");
  });
}

if (confirmDialogAltBtnEl) {
  confirmDialogAltBtnEl.addEventListener("click", () => {
    closeDecisionDialog("alt");
  });
}

if (confirmDialogConfirmBtnEl) {
  confirmDialogConfirmBtnEl.addEventListener("click", () => {
    closeDecisionDialog("confirm");
  });
}

formSearchEl.addEventListener("input", renderFormList);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isDialogOpen()) {
    closeDecisionDialog("cancel");
    return;
  }
  if (event.key === "Escape") {
    closeDrawers();
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const previewToggleButton = target.closest("#openPreviewBtn, #closePreviewBtn");
  if (!previewToggleButton) {
    return;
  }

  if (previewToggleButton.id === "closePreviewBtn") {
    state.ui.previewOpen = false;
    renderShellSummary();
    syncShellState();
    return;
  }

  togglePreview();
});

window.addEventListener("beforeunload", (event) => {
  if (!state.dirty || allowIntentionalUnload) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

void bootstrap().catch((error) => {
  console.error(error);
  setStatus(`Unable to load builder: ${error.message}`, true);
});
