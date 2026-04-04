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
    openSectionPaths: [],
    activeItemPath: null,
    activeOptionToken: null,
    activePreviewSectionId: null,
  },
};

const sortableInstances = [];

const INPUT_TYPES = [
  { id: "text", label: "Text", control: "input", dataType: "text" },
  { id: "number", label: "Number", control: "input", dataType: "number" },
  { id: "choice", label: "Choices", control: "select", dataType: "enum" },
  { id: "image", label: "Image", control: "input", dataType: "image" },
  { id: "date", label: "Date", control: "input", dataType: "date" },
  { id: "time", label: "Time", control: "input", dataType: "time" },
  { id: "datetime", label: "Date & time", control: "input", dataType: "datetime" },
];
const ACTIVE_BLOCK_SCHEMA_SOURCE = "builder_blocks_v1";

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

function blockKind(node) {
  return String(node?.kind || "").trim();
}

function getDraftFormKey(draft = state.draft) {
  if (!draft || typeof draft !== "object") {
    return "";
  }
  const meta = ensureBlockSchemaMeta(draft);
  return compactText(meta?.form_key) || slugify(draft.name || "untitled_form") || "untitled_form";
}

function setDraftFormKey(value, draft = state.draft) {
  if (!draft || typeof draft !== "object") {
    return;
  }
  const meta = ensureBlockSchemaMeta(draft);
  meta.form_key = compactText(value) || slugify(draft.name || "untitled_form") || "untitled_form";
}

function getDraftFormNotes(draft = state.draft) {
  if (!draft || typeof draft !== "object") {
    return [];
  }
  const meta = ensureBlockSchemaMeta(draft);
  return normalizeArray(meta?.notes);
}

function setDraftFormNotes(value, draft = state.draft) {
  if (!draft || typeof draft !== "object") {
    return;
  }
  const meta = ensureBlockSchemaMeta(draft);
  const notes = normalizeArray(value);
  if (notes.length) {
    meta.notes = deepClone(notes);
  } else {
    delete meta.notes;
  }
}

function ensureDraftBlockState(draft) {
  if (!draft || typeof draft !== "object") {
    return draft;
  }

  const existingBlockSchema = draft.block_schema && typeof draft.block_schema === "object"
    ? deepClone(draft.block_schema)
    : null;

  if (existingBlockSchema) {
    draft.block_schema = existingBlockSchema;
  } else {
    draft.block_schema = {
      schema_version: 1,
      source_kind: ACTIVE_BLOCK_SCHEMA_SOURCE,
      meta: {},
      blocks: [],
    };
  }

  draft.name = compactText(draft.name) || "Untitled Form";
  syncRootMetaToBlockSchema(draft);
  syncDraftLocationState(draft);
  normalizeArray(draft.block_schema.blocks).forEach(normalizeLiveBlockNode);
  delete draft.schema;
  delete draft.form_schema;
  return draft;
}

function ensureBlockSchemaMeta(draft) {
  if (!draft || typeof draft !== "object") {
    return null;
  }

  if (!draft.block_schema || typeof draft.block_schema !== "object") {
    draft.block_schema = {
      schema_version: 1,
      source_kind: ACTIVE_BLOCK_SCHEMA_SOURCE,
      meta: {},
      blocks: [],
    };
  }

  if (!draft.block_schema.meta || typeof draft.block_schema.meta !== "object") {
    draft.block_schema.meta = {};
  }

  draft.block_schema.blocks = normalizeArray(draft.block_schema.blocks);
  return draft.block_schema.meta;
}

function syncRootMetaToBlockSchema(draft = state.draft) {
  if (!draft || typeof draft !== "object") {
    return;
  }

  const meta = ensureBlockSchemaMeta(draft);
  if (!meta) {
    return;
  }

  draft.block_schema.source_kind = ACTIVE_BLOCK_SCHEMA_SOURCE;
  delete meta.legacy_form_id;
  meta.form_key = compactText(meta.form_key) || slugify(draft.name || "untitled_form") || "untitled_form";
  meta.form_order = parsePositiveInt(meta.form_order, 1);
  delete meta.legacy_form_key;
  delete meta.legacy_order;

  const notes = normalizeArray(meta.notes);
  if (notes.length) {
    meta.notes = deepClone(notes);
  } else {
    delete meta.notes;
  }

  if (!(meta.source && typeof meta.source === "object")) {
    delete meta.source;
  }
}

function syncDraftBlockState() {
  if (!state.draft) {
    return;
  }
  syncRootMetaToBlockSchema(state.draft);
}

function isBlockNode(node) {
  const kind = blockKind(node);
  return kind === "field" || kind === "field_group" || kind === "section";
}

function isStoredBlockNode(node) {
  const kind = blockKind(node);
  return kind === "field" || kind === "field_group" || kind === "section" || kind === "note" || kind === "divider" || kind === "table";
}

function isUtilityBlockNode(node) {
  const kind = blockKind(node);
  return kind === "note" || kind === "divider" || kind === "table";
}

function getNodeProps(node) {
  if (!isStoredBlockNode(node)) {
    return {};
  }
  if (!node.props || typeof node.props !== "object") {
    node.props = {};
  }
  return node.props;
}

function getNodeChildren(node) {
  if (!isStoredBlockNode(node)) {
    return [];
  }
  node.children = normalizeArray(node.children);
  return node.children;
}

function getNodeKey(node) {
  return isStoredBlockNode(node) ? String(getNodeProps(node).key || "").trim() : "";
}

function getNodeNotes(node) {
  return isStoredBlockNode(node) ? normalizeArray(getNodeProps(node).notes) : [];
}

function getInputControl(field) {
  return isBlockNode(field)
    ? String(getNodeProps(field).control || "input").trim() || "input"
    : "input";
}

function getInputDataType(field) {
  return isBlockNode(field)
    ? String(getNodeProps(field).data_type || "text").trim() || "text"
    : "text";
}

function getInputUnitHint(field) {
  return isBlockNode(field) ? String(getNodeProps(field).unit_hint || "").trim() : "";
}

function getInputReferenceText(field) {
  return isBlockNode(field)
    ? String(getNodeProps(field).reference_text || getNodeProps(field).normal_value || "").trim()
    : "";
}

function getInputNormalMin(field) {
  return isBlockNode(field) ? String(getNodeProps(field).normal_min || "").trim() : "";
}

function getInputNormalMax(field) {
  return isBlockNode(field) ? String(getNodeProps(field).normal_max || "").trim() : "";
}

function inputNormalRangeLabel(field) {
  const min = compactText(getInputNormalMin(field));
  const max = compactText(getInputNormalMax(field));
  if (min && max) {
    return `Normal ${min} - ${max}`;
  }
  if (min) {
    return `Normal from ${min}`;
  }
  if (max) {
    return `Normal to ${max}`;
  }
  return "";
}

function normalizeInputOptions(field, { allowLegacyLabel = false } = {}) {
  if (!isBlockNode(field)) {
    return [];
  }
  const props = getNodeProps(field);
  props.options = normalizeArray(props.options).map((option, index) => {
    if (option && typeof option === "object") {
      const normalized = { ...option };
      const normalizedName = compactText(
        normalized.name || (allowLegacyLabel ? normalized.label : "")
      );
      normalized.name = normalizedName;
      delete normalized.label;
      normalized.key = compactText(normalized.key) || slugify(normalizedName || `option_${index + 1}`) || `option_${index + 1}`;
      normalized.order = parsePositiveInt(normalized.order, index + 1);
      normalized.is_normal = Boolean(normalized.is_normal);
      return normalized;
    }
    const normalizedName = compactText(option);
    return {
      name: normalizedName,
      key: slugify(normalizedName || `option_${index + 1}`) || `option_${index + 1}`,
      order: index + 1,
      is_normal: false,
    };
  });
  return props.options;
}

function normalizeLiveBlockNode(node) {
  if (!isStoredBlockNode(node)) {
    return;
  }

  const props = getNodeProps(node);
  delete props.field_type;

  const referenceText = compactText(props.reference_text || props.normal_value);
  if (referenceText) {
    props.reference_text = referenceText;
  } else {
    delete props.reference_text;
  }
  delete props.normal_value;

  const normalMin = compactText(props.normal_min);
  if (normalMin) {
    props.normal_min = normalMin;
  } else {
    delete props.normal_min;
  }

  const normalMax = compactText(props.normal_max);
  if (normalMax) {
    props.normal_max = normalMax;
  } else {
    delete props.normal_max;
  }

  if (blockKind(node) === "field") {
    normalizeInputOptions(node, { allowLegacyLabel: true });
  }

  getNodeChildren(node).forEach(normalizeLiveBlockNode);
}

function getInputOptions(field) {
  return normalizeInputOptions(field);
}

function topLevelBlocks() {
  return normalizeArray(state.draft?.block_schema?.blocks);
}

function topLevelSectionEntries() {
  return topLevelBlocks()
    .map((node, index) => ({ node, path: ["block_schema", "blocks", index] }))
    .filter((entry) => entry.node?.kind === "section");
}

function topLevelContentEntries() {
  const entries = topLevelBlockEntries();
  if (state.ui.advancedMode) {
    return entries;
  }
  return entries.filter((entry) => {
    const kind = blockKind(entry.node);
    return kind === "field" || kind === "field_group" || kind === "section";
  });
}

function topLevelBlockEntries() {
  return topLevelBlocks().map((node, index) => ({
    node,
    path: ["block_schema", "blocks", index],
  }));
}

function setContentSelection(path) {
  const node = getNodeByPath(path);
  if (!node) {
    return;
  }

  if (blockKind(node) === "section") {
    state.ui.openSectionPaths = [pathKey(path)];
    state.ui.activeItemPath = null;
  } else {
    state.ui.activeItemPath = pathKey(path);
  }
  state.ui.activeOptionToken = null;
}

function collectItemPathKeysFromNode(node, basePath) {
  const keys = [];
  const kind = String(node?.kind || "").trim();

  if (kind === "field" || kind === "field_group" || kind === "note" || kind === "divider" || kind === "table") {
    keys.push(pathKey(basePath));
  }

  getNodeChildren(node).forEach((child, index) => {
    keys.push(...collectItemPathKeysFromNode(child, [...basePath, "children", index]));
  });

  return keys;
}

function insertTopLevelItem(kind) {
  const blocks = topLevelBlocks();
  const nextNode = makeBlankBlock(kind);
  const firstSectionIndex = blocks.findIndex((block) => String(block?.kind || "").trim() === "section");

  if (firstSectionIndex === -1) {
    blocks.push(nextNode);
    return blocks.length - 1;
  }

  blocks.splice(firstSectionIndex, 0, nextNode);
  return firstSectionIndex;
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

function quickSwitchForms() {
  return normalizeArray(state.bootstrap?.form_choices).filter((form) => compactText(form?.slug));
}

function quickSwitchLocationLabel(form) {
  const direct = compactText(form?.location_path_label);
  if (direct) {
    return direct;
  }
  const formPathLabel = compactText(form?.form_path_label);
  const name = compactText(form?.name);
  if (!formPathLabel || formPathLabel === name) {
    return "Top level";
  }
  const suffix = ` / ${name}`;
  return formPathLabel.endsWith(suffix) ? formPathLabel.slice(0, -suffix.length) : formPathLabel;
}

function currentVersionLabel() {
  return state.draft?.current_version_number ? `Version ${state.draft.current_version_number}` : "New draft";
}

function topLevelPreviewSegments() {
  const segments = [];
  let looseItems = [];
  let looseGroupCount = 0;

  const flushLooseItems = () => {
    if (!looseItems.length) {
      return;
    }
    const localIndex = ++looseGroupCount;
    const baseLabel = localIndex === 1
      ? "Details"
      : localIndex === 2
        ? "More details"
        : `More details ${localIndex - 1}`;
    const baseId = localIndex === 1
      ? "details"
      : localIndex === 2
        ? "more_details"
        : `more_details_${localIndex - 1}`;
    segments.push({
      id: `preview_section_${baseId}`,
      label: baseLabel,
      title: baseLabel,
      items: looseItems,
    });
    looseItems = [];
  };

  topLevelBlockEntries().forEach((entry, index) => {
    if (entry.node?.kind === "section") {
      flushLooseItems();
      const sectionName = compactText(entry.node?.name);
      segments.push({
        id: previewSectionId(sectionName || "Section", index),
        label: sectionName || "Section",
        title: sectionName || "Untitled Section",
        items: getNodeChildren(entry.node),
      });
      return;
    }
    looseItems.push(entry.node);
  });

  flushLooseItems();
  return segments;
}

function normalizeTopLevelLocationValue(value) {
  const normalized = compactText(value);
  return normalized === "Unassigned" ? "Top level" : normalized;
}

function isTopLevelLocationName(name) {
  const value = normalizeTopLevelLocationValue(name);
  return !value || value === "Top level";
}

function compactLocationName(draft = state.draft) {
  return normalizeTopLevelLocationValue(draft?.location_name);
}

function compactLocationPathLabel(draft = state.draft) {
  return normalizeTopLevelLocationValue(draft?.location_path_label);
}

function availableLocationOptions() {
  return normalizeArray(state.bootstrap?.container_options);
}

function findLocationOptionByNodeKey(nodeKey) {
  const key = compactText(nodeKey);
  if (!key) {
    return null;
  }
  return availableLocationOptions().find((option) => compactText(option.node_key) === key) || null;
}

function findLocationOptionByFolderPathLabel(folderPathLabel) {
  const label = compactText(folderPathLabel);
  if (!label) {
    return null;
  }
  return availableLocationOptions().find((option) => compactText(option.folder_path_label) === label) || null;
}

function isTopLevelDraftLocation(draft = state.draft) {
  if (!draft) {
    return true;
  }
  if (compactText(draft.library_parent_node_key)) {
    return false;
  }
  const locationName = compactLocationName(draft);
  return !locationName || locationName === "Top level";
}

function displayLocationName(draft = state.draft) {
  if (!draft) {
    return "Top level";
  }
  const explicitPath = compactLocationPathLabel(draft);
  if (explicitPath) {
    return explicitPath;
  }
  const matchedOption = findLocationOptionByNodeKey(draft.library_parent_node_key);
  if (matchedOption?.folder_path_label) {
    return matchedOption.folder_path_label;
  }
  return isTopLevelDraftLocation(draft) ? "Top level" : compactLocationName(draft) || "Top level";
}

function editableLocationValue(draft = state.draft) {
  if (!draft) {
    return "";
  }
  const explicitPath = compactLocationPathLabel(draft);
  if (explicitPath && explicitPath !== "Top level") {
    return explicitPath;
  }
  const matchedOption = findLocationOptionByNodeKey(draft.library_parent_node_key);
  if (matchedOption?.folder_path_label) {
    return matchedOption.folder_path_label;
  }
  return isTopLevelDraftLocation(draft) ? "" : compactLocationName(draft);
}

function syncDraftLocationState(draft = state.draft) {
  if (!draft || typeof draft !== "object") {
    return;
  }

  const explicitName = compactLocationName(draft);
  const explicitPath = compactLocationPathLabel(draft);
  const pendingFolderName = compactText(draft.library_new_container_name);
  const matchedOption = findLocationOptionByNodeKey(draft.library_parent_node_key);

  if (pendingFolderName) {
    const parentPath = compactText(matchedOption?.folder_path_label);
    const folderName = explicitName || pendingFolderName;
    draft.location_name = folderName || "Top level";
    draft.location_path_label = [parentPath, folderName].filter(Boolean).join(" / ") || folderName || "Top level";
    draft.location_node_key = null;
    draft.location_kind = folderName ? "folder" : "top_level";
    return;
  }

  if (matchedOption) {
    draft.location_name = compactText(matchedOption.name) || explicitName || "Top level";
    draft.location_path_label = compactText(matchedOption.folder_path_label) || explicitPath || draft.location_name;
    draft.location_node_key = compactText(matchedOption.node_key) || null;
    draft.location_kind = "folder";
    return;
  }

  const freeform = explicitPath || explicitName;
  if (!freeform || isTopLevelLocationName(freeform)) {
    draft.location_name = "Top level";
    draft.location_path_label = "Top level";
    draft.location_node_key = null;
    draft.location_kind = "top_level";
    return;
  }

  draft.location_name = compactText(freeform);
  draft.location_path_label = compactText(freeform);
  draft.location_node_key = null;
  draft.location_kind = "folder";
}

function availableLocationNames() {
  const names = new Set();
  availableLocationOptions().forEach((option) => {
    const label = compactText(option.folder_path_label);
    if (label) {
      names.add(label);
    }
  });
  const currentLocation = displayLocationName(state.draft);
  if (currentLocation && currentLocation !== "Top level") {
    names.add(currentLocation);
  }
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function renderLocationSuggestions() {
  const names = availableLocationNames();
  if (!names.length) {
    return "";
  }
  return `
    <datalist id="locationSuggestions">
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
    openPreviewBtnEl.textContent = previewVisible ? "Hide" : "Show";
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
    currentFormNameEl.textContent = "Start with a form";
    currentFormMetaEl.textContent = "Choose one from the library or start new.";
    stageTitleEl.textContent = "Choose a form";
    stageDescriptionEl.textContent = "Edit one area at a time.";
    renderPreviewCallout();
    return;
  }

  const formName = state.draft.name || "Untitled Form";
  const locationName = displayLocationName(state.draft);
  const version = currentVersionLabel();

  currentFormNameEl.textContent = formName;
  currentFormMetaEl.textContent = `${locationName} | ${version}`;
  stageTitleEl.textContent = formName;
  stageDescriptionEl.textContent = state.ui.previewOpen
    ? "Edit one area at a time."
    : "Edit one area at a time. Show preview anytime.";
  renderPreviewCallout();
}

function renderPreviewCallout() {
  if (!previewCalloutTitleEl || !previewCalloutMetaEl || !openPreviewBtnEl) {
    return;
  }

  if (!state.draft) {
    previewCalloutTitleEl.textContent = "Live preview";
    previewCalloutMetaEl.textContent = "Choose a form to see it here.";
    openPreviewBtnEl.disabled = true;
    return;
  }

  openPreviewBtnEl.disabled = false;
  previewCalloutTitleEl.textContent = "Live preview";

  if (state.ui.previewOpen) {
    previewCalloutMetaEl.textContent = "Updates while you edit.";
    return;
  }

  previewCalloutMetaEl.textContent = "Show it for a quick check.";
}

function resetEditorPanels() {
  const sections = topLevelSectionEntries();
  state.ui.setupOpen = !state.selectedFormSlug;
  state.ui.saveOpen = !state.selectedFormSlug;
  state.ui.openSectionPaths = sections.length ? [pathKey(sections[0].path)] : [];
  state.ui.activeItemPath = null;
  state.ui.activeOptionToken = null;
  state.ui.focusPane = defaultFocusPane();
}

function collectItemPathKeys(container, basePath = []) {
  const paths = [];
  normalizeArray(container?.blocks).forEach((block, index) => {
    paths.push(...collectItemPathKeysFromNode(block, [...basePath, "blocks", index]));
  });
  getNodeChildren(container).forEach((child, index) => {
    paths.push(...collectItemPathKeysFromNode(child, [...basePath, "children", index]));
  });
  return paths;
}

function syncEditorPanels() {
  const sections = topLevelSectionEntries();
  const validPaths = new Set(sections.map((entry) => pathKey(entry.path)));
  state.ui.openSectionPaths = normalizeArray(state.ui.openSectionPaths).filter((item) => validPaths.has(item));

  if (sections.length && !state.ui.openSectionPaths.length) {
    state.ui.openSectionPaths = [pathKey(sections[0].path)];
  }

  const validItemPaths = new Set(collectItemPathKeys(state.draft?.block_schema, ["block_schema"]));
  if (state.ui.activeItemPath && !validItemPaths.has(state.ui.activeItemPath)) {
    state.ui.activeItemPath = null;
    state.ui.activeOptionToken = null;
  }

  if (state.ui.activeOptionToken) {
    const parsed = parseOptionToken(state.ui.activeOptionToken);
    const field = parsed ? getNodeByPath(parsed.path) : null;
    const options = getInputOptions(field);
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
    if (state.ui.activeItemPath && pathStartsWith(parsePathKey(state.ui.activeItemPath), path)) {
      state.ui.activeItemPath = null;
    }
  } else {
    state.ui.openSectionPaths = [token];
    if (state.ui.activeItemPath && !pathStartsWith(parsePathKey(state.ui.activeItemPath), path)) {
      state.ui.activeItemPath = null;
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

function isItemOpen(path) {
  if (!state.ui.activeItemPath) {
    return false;
  }

  const token = pathKey(path);
  if (state.ui.activeItemPath === token) {
    return true;
  }

  const node = getNodeByPath(path);
  if (node?.kind !== "field_group") {
    return false;
  }

  return pathStartsWith(parsePathKey(state.ui.activeItemPath), path);
}

function toggleItem(path) {
  const token = pathKey(path);
  if (state.ui.activeItemPath) {
    const activePath = parsePathKey(state.ui.activeItemPath);
    if (state.ui.activeItemPath === token || pathStartsWith(activePath, path)) {
      state.ui.activeItemPath = null;
      state.ui.activeOptionToken = null;
      renderEditor();
      return;
    }
  }

  state.ui.activeItemPath = token;
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

  if (state.ui.activeItemPath) {
    state.ui.activeItemPath = pathKey(remapPathAfterMove(parsePathKey(state.ui.activeItemPath), parentPath, fromIndex, toIndex));
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
  if (target === state.draft && bind === "form_key") {
    setDraftFormKey(rawValue);
    syncRootMetaToBlockSchema();
    return;
  }

  if (target === state.draft && bind === "form_notes") {
    setDraftFormNotes(rawValue);
    syncRootMetaToBlockSchema();
    return;
  }

  if (isStoredBlockNode(target)) {
    const props = getNodeProps(target);
    if (bind === "name") {
      target.name = rawValue;
      return;
    }
    if (bind === "sample_rows") {
      props.sample_rows = parsePositiveInt(rawValue, 3);
      return;
    }
    if (
      bind === "key" ||
      bind === "notes" ||
      bind === "reference_text" ||
      bind === "normal_min" ||
      bind === "normal_max" ||
      bind === "unit_hint" ||
      bind === "content" ||
      bind === "columns"
    ) {
      props[bind] = rawValue;
      return;
    }
  }

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

function makeBlankGroup() {
  return {
    id: `blk_${slugify(`group_${Date.now()}`)}`,
    kind: "field_group",
    name: "New Field Group",
    props: {
      key: "new_field_group",
      order: 1,
      notes: [],
    },
    children: [],
  };
}

function makeBlankField() {
  return {
    id: `blk_${slugify(`field_${Date.now()}`)}`,
    kind: "field",
    name: "New Field",
    props: {
      key: "new_field",
      order: 1,
      control: "input",
      data_type: "text",
      unit_hint: "",
      reference_text: "",
      normal_min: "",
      normal_max: "",
      notes: [],
      options: [],
    },
    children: [],
  };
}

function makeBlankSection() {
  return {
    id: `blk_${slugify(`section_${Date.now()}`)}`,
    kind: "section",
    name: "New Section",
    props: {
      key: "new_section",
      order: 1,
      notes: [],
    },
    children: [],
  };
}

function makeBlankNote() {
  return {
    id: `blk_${slugify(`note_${Date.now()}`)}`,
    kind: "note",
    name: "Note",
    props: {
      key: "note",
      order: 1,
      content: "Add note text here.",
      notes: [],
    },
    children: [],
  };
}

function makeBlankDivider() {
  return {
    id: `blk_${slugify(`divider_${Date.now()}`)}`,
    kind: "divider",
    name: "Divider",
    props: {
      key: "divider",
      order: 1,
      content: "",
      notes: [],
    },
    children: [],
  };
}

function makeBlankTable() {
  return {
    id: `blk_${slugify(`table_${Date.now()}`)}`,
    kind: "table",
    name: "Results Table",
    props: {
      key: "results_table",
      order: 1,
      columns: ["Test", "Result", "Reference Range"],
      sample_rows: 3,
      notes: [],
    },
    children: [],
  };
}

function makeBlankBlock(kind) {
  if (kind === "section") {
    return makeBlankSection();
  }
  if (kind === "note") {
    return makeBlankNote();
  }
  if (kind === "divider") {
    return makeBlankDivider();
  }
  if (kind === "table") {
    return makeBlankTable();
  }
  if (kind === "field_group") {
    return makeBlankGroup();
  }
  return makeBlankField();
}

function navigateWithIntent(url) {
  allowIntentionalUnload = true;
  window.location.assign(url);
}

function uniqueSlug(base, used) {
  const root = slugify(base || "item");
  let candidate = root;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${root}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function freshBlockId(kind, key) {
  return `blk_${slugify(`${kind}_${key}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)}`;
}

function makeBlankForm(config = {}) {
  const formName = String(config.name || "").trim() || "Untitled Form";
  const locationName = String(config.locationName || "").trim();

  const draft = {
    slug: null,
    name: formName,
    location_name: locationName || "Top level",
    location_path_label: isTopLevelLocationName(locationName) ? "Top level" : locationName,
    location_node_key: String(config.libraryParentNodeKey || "").trim() || null,
    location_kind: isTopLevelLocationName(locationName) ? "top_level" : "folder",
    library_parent_node_key: String(config.libraryParentNodeKey || "").trim() || null,
    library_new_container_name: String(config.libraryNewContainerName || "").trim() || null,
    current_version_number: 0,
    summary: "",
    block_schema: {
      schema_version: 1,
      source_kind: ACTIVE_BLOCK_SCHEMA_SOURCE,
      meta: {
        form_key: slugify(formName),
        form_order: 1,
      },
      blocks: [],
    },
  };
  syncDraftLocationState(draft);
  return ensureDraftBlockState(draft);
}

function makeCopyName(name) {
  const base = String(name || "Untitled").trim() || "Untitled";
  return base.endsWith(" Copy") ? `${base} 2` : `${base} Copy`;
}

function cloneNode(node) {
  const copy = deepClone(node);
  copy.name = makeCopyName(copy.name);
  if (isStoredBlockNode(copy)) {
    const props = getNodeProps(copy);
    if (props.key) {
      props.key = `${slugify(props.key)}_copy`;
    }
    if (!copy.id) {
      copy.id = `blk_${slugify(`${copy.kind || "node"}_${Date.now()}`)}`;
    }
    return copy;
  }
  if (copy.key) {
    copy.key = `${slugify(copy.key)}_copy`;
  }
  return copy;
}

function inferInputType(field) {
  if (getInputControl(field) === "select" || getInputDataType(field) === "enum") {
    return "choice";
  }
  const match = INPUT_TYPES.find((item) => item.dataType === getInputDataType(field) && item.control === getInputControl(field));
  return match?.id || "text";
}

function applyInputType(field, typeId) {
  const selected = INPUT_TYPES.find((item) => item.id === typeId) || INPUT_TYPES[0];
  if (!isBlockNode(field)) {
    return;
  }
  const props = getNodeProps(field);
  delete props.field_type;
  props.control = selected.control;
  props.data_type = selected.dataType;
  if (selected.id === "choice") {
    const options = getInputOptions(field);
    if (!options.length) {
      options.push({ name: "Option 1", key: "option_1", order: 1, is_normal: false });
    }
  }
  if (selected.id !== "number") {
    delete props.normal_min;
    delete props.normal_max;
  }
}

function syncNodeKeys(node) {
  if (!isStoredBlockNode(node)) {
    return;
  }
  const props = getNodeProps(node);
  if (node.name && !props.key) {
    props.key = slugify(node.name);
  }
  getNodeChildren(node).forEach(syncNodeKeys);
}

function syncDraftKeys() {
  if (!state.draft) {
    return;
  }
  setDraftFormKey(getDraftFormKey(state.draft), state.draft);
  syncRootMetaToBlockSchema(state.draft);
  topLevelBlocks().forEach(syncNodeKeys);
  syncDraftBlockState();
}

function touch(options = {}) {
  syncDraftBlockState();
  setDirty(true);
  renderShellSummary();
  renderPreview();
  renderJson();
  syncSaveSurface();
  if (options.full) {
    renderEditor();
  }
  if (options.library) {
    renderFormList();
  }
}

function syncSaveSurface() {
  const titleEl = document.getElementById("saveStateTitle");
  const metaEl = document.getElementById("saveStateMeta");
  if (!titleEl || !metaEl || !state.draft) {
    return;
  }

  const dirtyLabel = state.dirty ? "Changes ready" : "Saved";
  const helperCopy = state.dirty
    ? "Save when this version feels right."
    : "Nothing new to save.";

  titleEl.textContent = dirtyLabel;
  metaEl.textContent = `${currentVersionLabel()} | ${helperCopy}`;
}

async function bootstrap() {
  setStatus("Loading builder");
  state.bootstrap = await api("/api/builder/bootstrap");
  renderFormList();
  const draftConfig = {
    name: String(initialQuery.get("draft_name") || "").trim(),
    locationName: String(initialQuery.get("location_name") || "").trim(),
    libraryParentNodeKey: String(initialQuery.get("library_parent_node_key") || "").trim(),
    libraryNewContainerName: String(initialQuery.get("library_new_container_name") || "").trim(),
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
  state.loadedForm = ensureDraftBlockState(deepClone(form));
  state.draft = ensureDraftBlockState(deepClone(form));
  state.baselineDraft = ensureDraftBlockState(deepClone(form));
  resetEditorPanels();
  setDirty(false);
  state.ui.libraryOpen = false;
  setStatus(`${form.name} ready`);
  renderAll();
}

function startNewForm(config = {}) {
  state.selectedFormSlug = null;
  state.loadedForm = null;
  state.draft = ensureDraftBlockState(makeBlankForm(config));
  state.baselineDraft = ensureDraftBlockState(deepClone(state.draft));
  resetEditorPanels();
  setDirty(true);
  state.ui.libraryOpen = false;
  setStatus("Blank draft ready");
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
  const nextLocationName = String(overrides.locationName || "").trim();
  if (nextLocationName) {
    copy.location_name = nextLocationName;
    copy.location_path_label = nextLocationName;
  }
  copy.library_parent_node_key = String(overrides.libraryParentNodeKey || "").trim() || copy.library_parent_node_key || null;
  copy.library_new_container_name = String(overrides.libraryNewContainerName || "").trim() || copy.library_new_container_name || null;
  if (
    !copy.library_parent_node_key
    && !copy.library_new_container_name
    && isTopLevelLocationName(copy.location_name)
  ) {
    copy.location_name = "Top level";
    copy.location_path_label = "Top level";
  }
  syncDraftLocationState(copy);
  setDraftFormKey(slugify(copy.name), copy);
  state.selectedFormSlug = null;
  state.loadedForm = null;
  state.draft = ensureDraftBlockState(copy);
  state.baselineDraft = ensureDraftBlockState(deepClone(copy));
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

  state.draft = ensureDraftBlockState(deepClone(state.baselineDraft));
  resetEditorPanels();
  setDirty(false);
  setStatus(state.selectedFormSlug ? "Returned to the last saved version" : "Draft reset");
  renderAll();
}

async function confirmDeleteNode(path) {
  const decision = await openDecisionDialog({
    eyebrow: "Remove item",
    title: "Remove this item from the form?",
    message: "This only changes the current draft until you save.",
    cancelLabel: "Keep item",
    confirmLabel: "Remove item",
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
  saveDockTitleEl.textContent = state.selectedFormSlug ? "Changes ready" : "Ready to save";
  saveDockMetaEl.textContent = note
    ? `Note: ${note}`
    : "Save now or keep editing.";
}

function renderFormList() {
  const query = formSearchEl.value.trim().toLowerCase();
  formListEl.innerHTML = "";

  const matching = quickSwitchForms().filter((form) => {
    if (!query) {
      return true;
    }
    const haystack = [
      compactText(form?.name),
      compactText(form?.form_path_label),
      compactText(form?.location_path_label),
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  matching.forEach((form) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "form-link";
    button.dataset.action = "load-form";
    button.dataset.slug = form.slug;
    if (form.slug === state.selectedFormSlug) {
      button.classList.add("active");
    }
    const versionLabel = `v${Number(form.current_version_number || 1)}`;
    button.innerHTML = `
      <strong>${escapeHtml(form.name || "Untitled Form")}</strong>
      <span class="meta">${escapeHtml(quickSwitchLocationLabel(form))} | ${escapeHtml(versionLabel)}</span>
    `;
    formListEl.appendChild(button);
  });

  if (!formListEl.children.length) {
    formListEl.innerHTML = '<div class="empty-state">No forms match that search yet.</div>';
  }
}

function defaultFocusPane() {
  if (!state.selectedFormSlug) {
    return "setup";
  }
  return "content";
}

function syncFocusPane() {
  const focus = String(state.ui.focusPane || "");
  const valid = new Set(["setup", "content", "save"]);
  if (!valid.has(focus)) {
    state.ui.focusPane = defaultFocusPane();
  }
}

function setFocusPane(pane) {
  state.ui.focusPane = pane;
  renderAll();
}

function renderOutline() {
  if (!builderOutlineEl) {
    return;
  }

  if (!state.draft) {
    builderOutlineEl.innerHTML = '<div class="empty-state">Open a form to start editing.</div>';
    return;
  }

  const contentEntries = topLevelContentEntries();
  const focusPane = String(state.ui.focusPane || defaultFocusPane());
  const selectedContentEntry = focusPane === "content" ? resolveFocusedTopLevelBlockEntry(contentEntries) : null;

  builderOutlineEl.innerHTML = `
      <div class="outline-head">
        <p class="eyebrow">Outline</p>
        <h3>${escapeHtml(state.draft.name || "Untitled Form")}</h3>
      </div>

      <nav class="outline-nav">
        <button class="outline-item ${focusPane === "setup" ? "active" : ""}" type="button" data-action="focus-pane" data-pane="setup">
          <span>Basics</span>
        </button>
        <button class="outline-item ${focusPane === "content" ? "active" : ""}" type="button" data-action="focus-pane" data-pane="content">
          <span>Content</span>
        </button>
      ${contentEntries.length ? `
        <div class="outline-sublist">
          ${contentEntries.map((entry) => renderOutlineContentItem(
            entry,
            Boolean(selectedContentEntry) && pathKey(entry.path) === pathKey(selectedContentEntry.path)
          )).join("")}
        </div>
        ` : `
          <div class="outline-empty">No content yet.</div>
        `}
        <button class="outline-item ${focusPane === "save" ? "active" : ""}" type="button" data-action="focus-pane" data-pane="save">
          <span>Save</span>
        </button>
      </nav>
    `;
  }

function renderEditor() {
  destroySortables();

  if (!state.draft) {
    formEditorEl.innerHTML = '<div class="empty-state">Choose a form to start editing.</div>';
    return;
  }

  syncEditorPanels();
  const focusPane = String(state.ui.focusPane || defaultFocusPane());

  if (focusPane === "setup") {
    formEditorEl.innerHTML = renderFormSetupCard({ focusMode: true });
  } else if (focusPane === "content") {
    formEditorEl.innerHTML = renderContentCard();
  } else if (focusPane === "save") {
    formEditorEl.innerHTML = renderSaveCard({ focusMode: true });
  } else {
    formEditorEl.innerHTML = renderContentCard();
  }

  formEditorEl.classList.remove("pane-setup", "pane-content", "pane-save");
  formEditorEl.classList.add(`pane-${focusPane}`);

  setupSortableCollections();
}

function renderFormSetupCard(options = {}) {
  const focusMode = Boolean(options.focusMode);
  const setupOpen = focusMode ? true : state.ui.setupOpen;
  const formName = state.draft.name || "Untitled Form";
  const locationName = displayLocationName(state.draft);
  const locationInputValue = editableLocationValue(state.draft);
  const currentVersion = currentVersionLabel();
  return `
    <section class="editor-card">
      <div class="card-head">
        <div>
          <p class="eyebrow">Basics</p>
          <div class="card-title-row">
            <h3 class="card-title">Basics</h3>
            ${renderHelpPopover("Basics help", "Set the name and location. Advanced details are optional.")}
          </div>
        </div>
        ${focusMode ? "" : `
        <div class="top-actions">
          <button class="ghost mini" type="button" data-action="toggle-setup">${setupOpen ? "Hide" : "Show"}</button>
        </div>
        `}
      </div>

      ${setupOpen ? `
        <div class="editor-spotlight">
          <div>
            <strong>${escapeHtml(formName)}</strong>
            <span>${escapeHtml(locationName)}</span>
          </div>
          <div class="editor-spotlight-meta">
            <span class="chip">${escapeHtml(currentVersion)}</span>
          </div>
        </div>
        <div class="setup-grid">
          <label>
            <span>Name</span>
            <input data-bind="name" value="${escapeHtml(formName)}" placeholder="Example: Urinalysis">
          </label>
          <label>
            <span>Location</span>
            <input list="locationSuggestions" data-bind="location_name" value="${escapeHtml(locationInputValue)}" placeholder="Top level or choose a folder">
          </label>
        </div>
        ${renderLocationSuggestions()}
        ${state.ui.advancedMode ? `
          <details class="advanced">
            <summary>Advanced</summary>
            <div class="advanced-grid">
              <label>
                <span>Key</span>
                <input data-bind="form_key" value="${escapeHtml(getDraftFormKey(state.draft))}">
              </label>
              <label style="grid-column: 1 / -1;">
                <span>Notes</span>
                <textarea data-bind="form_notes" data-format="lines">${escapeHtml(getDraftFormNotes(state.draft).join("\n"))}</textarea>
              </label>
            </div>
          </details>
        ` : ""}
      ` : `
        <div class="collapsed-copy">
          <strong>${escapeHtml(formName)}</strong>
          ${escapeHtml(locationName)}
        </div>
      `}
    </section>
  `;
}

function renderSaveCard(options = {}) {
  const focusMode = Boolean(options.focusMode);
  const saveOpen = focusMode ? true : state.ui.saveOpen;
  const note = String(state.draft.summary || "").trim();
  const dirtyLabel = state.dirty ? "Changes ready" : "Saved";
  const helperCopy = state.dirty
    ? "Save when this version feels right."
    : "Nothing new to save.";
  return `
    <section class="editor-card">
      <div class="card-head">
        <div>
          <p class="eyebrow">Save</p>
          <div class="card-title-row">
            <h3 class="card-title">Save</h3>
            ${renderHelpPopover("Save help", "Notes are optional.")}
          </div>
        </div>
        ${focusMode ? "" : `
        <div class="top-actions">
          <button class="ghost mini" type="button" data-action="toggle-save-step">${saveOpen ? "Hide" : "Show"}</button>
        </div>
        `}
      </div>

      ${saveOpen ? `
        <div class="save-spotlight">
          <div>
            <strong id="saveStateTitle">${escapeHtml(dirtyLabel)}</strong>
            <span id="saveStateMeta">${escapeHtml(currentVersionLabel())} | ${escapeHtml(helperCopy)}</span>
          </div>
        </div>
        <div class="save-step-inline">
          <label>
            <span>Note</span>
            <input data-bind="summary" value="${escapeHtml(state.draft.summary || "")}" placeholder="Optional note for this version">
          </label>
          <button class="secondary" type="button" data-action="save-draft">Save</button>
        </div>
      ` : `
        <div class="collapsed-copy">
          <strong>${note ? "Saved note" : "Note is optional"}</strong>
          ${note ? escapeHtml(note) : "You can save without adding one."}
        </div>
      `}
    </section>
  `;
}

function renderNodeActionMenu(path) {
    return `
      <details class="action-details">
        <summary aria-label="More" title="More">...</summary>
        <div class="action-menu">
          <button class="ghost mini" type="button" data-action="duplicate-node" data-path="${encodePath(path)}">Copy</button>
          <button class="ghost mini warn" type="button" data-action="delete-node" data-path="${encodePath(path)}">Remove</button>
        </div>
      </details>
    `;
  }

function renderAddMenu(items, label = "Add") {
    const entries = normalizeArray(items).filter((item) => item?.action && item?.label);
    if (!entries.length) {
      return "";
    }
    return `
      <details class="action-details add-details">
        <summary aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${escapeHtml(label)}</summary>
        <div class="action-menu">
          ${entries.map((item) => `
            <button
              class="ghost mini"
              type="button"
              data-action="${escapeHtml(item.action)}"
              ${item.path ? `data-path="${encodePath(item.path)}"` : ""}
            >${escapeHtml(item.label)}</button>
          `).join("")}
        </div>
      </details>
    `;
  }

function organizerSecondaryLabel(node, title) {
    const kind = blockKind(node);
    const normalizedTitle = compactText(title).toLowerCase();
    if (kind === "section") {
      return compactText(node?.name || "") ? "" : "Section";
    }
    if (kind === "field_group") {
      return compactText(node?.name || "") ? "" : "Group";
    }
    const label = kind === "note"
      ? "Note"
      : kind === "divider"
        ? "Divider"
        : kind === "table"
          ? "Table"
          : summarizeItem(node);
    return label && normalizedTitle !== label.toLowerCase() ? label : "";
  }

function itemOrganizerSecondaryLabel(item, title) {
    if (item.kind === "field_group") {
      return compactText(item.name || "") ? "" : "Group";
    }
    if (isUtilityBlockNode(item)) {
      const summary = summarizeItem(item);
      return summary && compactText(title).toLowerCase() !== summary.toLowerCase() ? summary : "";
    }
    const inputType = inferInputType(item);
    if (!["choice", "image", "date", "time", "datetime"].includes(inputType)) {
      return "";
    }
    const summary = summarizeItem(item);
    return summary && compactText(title).toLowerCase() !== summary.toLowerCase() ? summary : "";
  }

function renderManageFooter(path) {
    return `
      <details class="manage-details">
        <summary>More</summary>
        <div class="manage-actions">
          <button class="ghost mini" type="button" data-action="duplicate-node" data-path="${encodePath(path)}">Copy</button>
          <button class="ghost mini warn" type="button" data-action="delete-node" data-path="${encodePath(path)}">Remove</button>
        </div>
      </details>
    `;
  }

function renderOptionManageFooter(path, index) {
    return `
      <details class="manage-details">
        <summary>More</summary>
        <div class="manage-actions">
          <button class="ghost mini" type="button" data-action="duplicate-option" data-path="${encodePath(path)}" data-index="${index}">Copy</button>
          <button class="ghost mini warn" type="button" data-action="delete-option" data-path="${encodePath(path)}" data-index="${index}">Remove</button>
        </div>
      </details>
    `;
  }

function renderContentOrganizerItem(entry, active) {
  const title = compactText(entry.node?.name) || "Untitled item";
  const secondaryLabel = organizerSecondaryLabel(entry.node, title);

  return `
    <div class="section-organizer-item ${active ? "active" : ""}">
      <button class="drag-handle" type="button" title="Drag to reorder" aria-label="Drag to reorder">
        <span class="drag-dots" aria-hidden="true"></span>
      </button>
      <button class="section-organizer-select" type="button" data-action="focus-content-block" data-path="${encodePath(entry.path)}">
        <span class="section-organizer-copy">
          <strong>${escapeHtml(title)}</strong>
          ${secondaryLabel ? `<span>${escapeHtml(secondaryLabel)}</span>` : ""}
        </span>
      </button>
    </div>
  `;
}

function renderOutlineContentItem(entry, active) {
  const title = compactText(entry.node?.name) || "Untitled item";
  const secondaryLabel = organizerSecondaryLabel(entry.node, title);

  return `
    <button class="outline-subitem ${active ? "active" : ""}" type="button" data-action="focus-content-block" data-path="${encodePath(entry.path)}">
      <span class="outline-copy">
        <strong>${escapeHtml(title)}</strong>
        ${secondaryLabel ? `<span>${escapeHtml(secondaryLabel)}</span>` : ""}
      </span>
    </button>
  `;
}

function renderContentCard() {
  const entries = topLevelContentEntries();
  const hiddenBlockCount = Math.max(0, topLevelBlockEntries().length - entries.length);
  const selectedEntry = resolveFocusedTopLevelBlockEntry(entries);
  const helpCopy = state.ui.advancedMode
    ? "Add, edit, and order everything here."
    : "Add sections, fields, or groups here.";
  const addItems = [
    { action: "add-content-section", label: "Section" },
    { action: "add-content-field", label: "Field" },
    { action: "add-content-group", label: "Group" },
    ...(state.ui.advancedMode
      ? [
          { action: "add-content-note", label: "Note" },
          { action: "add-content-table", label: "Table" },
          { action: "add-content-divider", label: "Divider" },
        ]
      : []),
  ];

  return `
    <section class="editor-card">
      <div class="card-head">
        <div>
          <div class="card-title-row">
            <h3 class="card-title">Content</h3>
            ${renderHelpPopover("Content help", helpCopy)}
          </div>
        </div>
        <div class="top-actions">
          ${renderAddMenu(addItems)}
        </div>
      </div>
      ${entries.length ? `
        <div class="section-organizer" data-collection-path="${encodePath(["block_schema", "blocks"])}">
          ${entries.map((entry) => renderContentOrganizerItem(entry, selectedEntry ? pathKey(entry.path) === pathKey(selectedEntry.path) : false)).join("")}
        </div>
        <div class="section-focus-stage">
          ${selectedEntry
            ? (selectedEntry.node?.kind === "section"
              ? renderSectionCard(selectedEntry.node, selectedEntry.path, { forceOpen: true, hideToggle: true, focusedCard: true })
              : (selectedEntry.node?.kind === "field" || selectedEntry.node?.kind === "field_group")
                ? renderItemCard(selectedEntry.node, selectedEntry.path, { forceOpen: true, hideToggle: true, focusedCard: true })
                : renderUtilityBlockCard(selectedEntry.node, selectedEntry.path))
            : '<div class="empty-state">Choose an item.</div>'}
        </div>
      ` : '<div class="empty-state">No content yet. Add what you need when you are ready.</div>'}
      ${!state.ui.advancedMode && hiddenBlockCount ? '<div class="collapsed-copy">Some advanced items stay hidden until you turn on Advanced.</div>' : ""}
    </section>
  `;
}

function resolveFocusedTopLevelBlockEntry(entries) {
  if (!entries.length) {
    return null;
  }

  const activeItemPath = state.ui.activeItemPath ? parsePathKey(state.ui.activeItemPath) : null;
  if (activeItemPath) {
    const matchingItemEntry = entries.find((entry) => pathStartsWith(activeItemPath, entry.path));
    if (matchingItemEntry) {
      return matchingItemEntry;
    }
  }

  const openSectionPath = normalizeArray(state.ui.openSectionPaths)[0] ? parsePathKey(normalizeArray(state.ui.openSectionPaths)[0]) : null;
  if (openSectionPath) {
    const sectionMatch = entries.find((entry) => pathKey(entry.path) === pathKey(openSectionPath));
    if (sectionMatch) {
      return sectionMatch;
    }
  }

  return entries[0];
}

function utilityBlockContent(node) {
  return String(getNodeProps(node).content || "").trim();
}

function getTableColumns(node) {
  const columns = normalizeArray(getNodeProps(node).columns)
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return columns.length ? columns : ["Column 1", "Column 2"];
}

function getTableSampleRows(node) {
  return Math.max(1, Math.min(parsePositiveInt(getNodeProps(node).sample_rows, 3), 6));
}

function renderUtilityBlockCard(node, path) {
  const kind = blockKind(node);
  const isNote = kind === "note";
  const isTable = kind === "table";
  const title = isNote ? "Note" : isTable ? "Table" : "Divider";
  const namePlaceholder = isNote
    ? "Example: Preparation Note"
    : isTable
      ? "Example: Results Table"
      : "Optional divider label";
  const content = utilityBlockContent(node);
  const columns = getTableColumns(node);
  const sampleRows = getTableSampleRows(node);

  return `
    <article class="item-card utility-card is-open is-focused" data-node-path="${encodePath(path)}" data-parent-path="${encodePath(path.slice(0, -1))}">
      <div class="item-head item-head-focused">
        <div>
          <h4 class="item-display-title">${escapeHtml(node.name || title)}</h4>
        </div>
      </div>
      <p class="item-focus-copy">${escapeHtml(
        isNote
          ? "Appears in the preview."
          : isTable
            ? "Shows a sample table."
            : "Adds a visual break."
      )}</p>

      <div class="inline-grid item-basics-grid compact">
        <label>
          <span>Name</span>
          <input class="item-title-input" data-path="${encodePath(path)}" data-bind="name" value="${escapeHtml(node.name || "")}" placeholder="${escapeHtml(namePlaceholder)}">
        </label>
      </div>

      ${isNote ? `
        <label class="stacked-input">
          <span>Text</span>
          <textarea data-path="${encodePath(path)}" data-bind="content" rows="5" placeholder="Write the note shown in the preview.">${escapeHtml(content)}</textarea>
        </label>
      ` : isTable ? `
        <label class="stacked-input">
          <span>Columns</span>
          <textarea data-path="${encodePath(path)}" data-bind="columns" data-format="lines" rows="4" placeholder="One column name per line">${escapeHtml(columns.join("\n"))}</textarea>
        </label>
        <div class="inline-grid item-basics-grid compact">
          <label>
            <span>Rows</span>
            <input type="number" min="1" max="6" data-path="${encodePath(path)}" data-bind="sample_rows" value="${escapeHtml(sampleRows)}">
          </label>
        </div>
      ` : `
        <label class="stacked-input">
          <span>Caption</span>
          <input data-path="${encodePath(path)}" data-bind="content" value="${escapeHtml(content)}" placeholder="Optional short caption">
        </label>
      `}

      ${state.ui.advancedMode ? `
        <details class="advanced">
          <summary>Advanced</summary>
          <div class="advanced-grid">
            <label>
              <span>Key</span>
              <input data-path="${encodePath(path)}" data-bind="key" value="${escapeHtml(getNodeKey(node) || "")}">
            </label>
            <label style="grid-column: 1 / -1;">
              <span>Notes</span>
              <textarea data-path="${encodePath(path)}" data-bind="notes" data-format="lines">${escapeHtml(getNodeNotes(node).join("\n"))}</textarea>
            </label>
          </div>
        </details>
      ` : ""}
      ${renderManageFooter(path)}
    </article>
  `;
}


function renderSectionCard(section, path, options = {}) {
    const focusedCard = Boolean(options.focusedCard);
    const open = Boolean(options.forceOpen) || isSectionOpen(path);
    const showHeaderActions = !focusedCard || !options.hideToggle;
    const addItems = [
      { action: "add-field", label: "Field", path: [...path, "children"] },
      { action: "add-group", label: "Group", path: [...path, "children"] },
      ...(state.ui.advancedMode
        ? [
            { action: "add-note", label: "Note", path: [...path, "children"] },
            { action: "add-table", label: "Table", path: [...path, "children"] },
            { action: "add-divider", label: "Divider", path: [...path, "children"] },
          ]
        : []),
    ];
    return `
      <article class="section-card ${open ? "is-open" : ""} ${focusedCard ? "is-focused" : ""}" data-node-path="${encodePath(path)}" data-parent-path="${encodePath(path.slice(0, -1))}">
        <div class="section-head ${focusedCard ? "section-head-focused" : ""}">
          <div>
            <h4 class="section-display-title">${escapeHtml(section.name || "Untitled Section")}</h4>
          </div>
          ${showHeaderActions ? `
          <div class="row-actions">
            ${focusedCard ? "" : `
            <button class="drag-handle" type="button" title="Drag to reorder" aria-label="Drag to reorder">
              <span class="drag-dots" aria-hidden="true"></span>
            </button>
            `}
            ${options.hideToggle ? "" : `<button class="ghost mini" type="button" data-action="toggle-section" data-path="${encodePath(path)}">${open ? "Hide" : "Show"}</button>`}
            ${renderNodeActionMenu(path)}
          </div>
          ` : ""}
        </div>
  
        ${open ? `
          <div class="section-builder-head ${focusedCard ? "compact" : ""}">
            <label class="section-title-wrap">
              <span>Name</span>
              <input class="section-title-input" data-path="${encodePath(path)}" data-bind="name" value="${escapeHtml(section.name || "")}" placeholder="Example: Chemical Findings">
            </label>
            <div class="section-quick-actions">
              ${renderAddMenu(addItems)}
          </div>
        </div>

        ${renderItemCollection(getNodeChildren(section), [...path, "children"], { focused: true })}

          ${state.ui.advancedMode ? `
            <details class="advanced">
              <summary>Advanced</summary>
              <div class="advanced-grid">
              <label>
                <span>Key</span>
                <input data-path="${encodePath(path)}" data-bind="key" value="${escapeHtml(getNodeKey(section) || "")}">
              </label>
              <label style="grid-column: 1 / -1;">
                <span>Notes</span>
                <textarea data-path="${encodePath(path)}" data-bind="notes" data-format="lines">${escapeHtml(getNodeNotes(section).join("\n"))}</textarea>
              </label>
              </div>
            </details>
          ` : ""}
          ${focusedCard ? renderManageFooter(path) : ""}
        ` : ""}
      </article>
    `;
  }

function renderItemCollection(items, collectionPath, options = {}) {
    const entries = normalizeArray(items).map((item, index) => {
      if (item?.path && item?.node) {
        return item;
      }
      return {
        node: item,
        path: [...collectionPath, index],
      };
    });
    const showUtility = options.showUtility ?? state.ui.advancedMode;
    const hiddenUtilityCount = showUtility ? 0 : entries.filter((entry) => isUtilityBlockNode(entry.node)).length;
    const visibleEntries = showUtility
      ? entries
      : entries.filter((entry) => !isUtilityBlockNode(entry.node));
    if (!visibleEntries.length) {
      if (hiddenUtilityCount) {
        return '<div class="empty-state">Some advanced items stay hidden here. Turn on Advanced to edit them.</div>';
      }
      return '<div class="empty-state">No content here yet. Add something when you are ready.</div>';
    }
  if (options.focused) {
    const selectedIndex = resolveFocusedItemIndex(collectionPath, visibleEntries);
    const selectedEntry = visibleEntries[selectedIndex] || null;
    return `
      <div class="item-organizer" data-collection-path="${encodePath(collectionPath)}">
        ${visibleEntries.map((entry, index) => renderItemOrganizerItem(entry.node, entry.path, index, index === selectedIndex)).join("")}
      </div>
      <div class="item-focus-stage">
        ${selectedEntry
          ? (isUtilityBlockNode(selectedEntry.node)
            ? renderUtilityBlockCard(selectedEntry.node, selectedEntry.path)
            : renderItemCard(selectedEntry.node, selectedEntry.path, { forceOpen: true, hideToggle: true, focusedCard: true }))
          : '<div class="empty-state">Choose an item.</div>'}
      </div>
      ${hiddenUtilityCount ? '<div class="collapsed-copy">Some advanced items stay hidden here. Turn on Advanced to edit them.</div>' : ""}
    `;
  }
  return `
    <div class="item-list" data-collection-path="${encodePath(collectionPath)}">
      ${visibleEntries.map((entry) => (
        isUtilityBlockNode(entry.node)
          ? renderUtilityBlockCard(entry.node, entry.path)
          : renderItemCard(entry.node, entry.path)
      )).join("")}
    </div>
    ${hiddenUtilityCount ? '<div class="collapsed-copy">Some advanced items stay hidden here. Turn on Advanced to edit them.</div>' : ""}
  `;
}

function resolveFocusedItemIndex(collectionPath, items) {
  if (!items.length) {
    return 0;
  }

  if (!state.ui.activeItemPath) {
    return 0;
  }

  const activePath = parsePathKey(state.ui.activeItemPath);
  const matchIndex = items.findIndex((entry, index) => {
    const entryPath = entry?.path || [...collectionPath, index];
    return pathStartsWith(activePath, entryPath);
  });
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

function summarizeItem(item) {
  if (item.kind === "note") {
    return "Note";
  }
  if (item.kind === "divider") {
    return "Divider";
  }
  if (item.kind === "table") {
    return "Table";
  }
  if (item.kind === "field_group") {
    return "Group";
  }
  const inputType = inferInputType(item);
  if (inputType === "choice") {
    return "Dropdown";
  }
  return INPUT_TYPES.find((item) => item.id === inputType)?.label || "Text";
}

function renderItemOrganizerItem(item, path, index, active) {
    const isGroup = item.kind === "field_group";
    const isUtility = isUtilityBlockNode(item);
    const title = item.name || (isUtility ? summarizeItem(item) : isGroup ? `Group ${index + 1}` : `Field ${index + 1}`);
    const secondaryLabel = itemOrganizerSecondaryLabel(item, title);
    return `
      <div class="item-organizer-item ${active ? "active" : ""}">
        <button class="drag-handle" type="button" title="Drag to reorder" aria-label="Drag to reorder">
          <span class="drag-dots" aria-hidden="true"></span>
        </button>
        <button class="item-organizer-select" type="button" data-action="focus-item" data-path="${encodePath(path)}">
          <span class="item-organizer-copy">
            <strong>${escapeHtml(title)}</strong>
            ${secondaryLabel ? `<span>${escapeHtml(secondaryLabel)}</span>` : ""}
          </span>
        </button>
      </div>
    `;
  }

function renderItemCard(item, path, options = {}) {
    const isGroup = item.kind === "field_group";
    const open = Boolean(options.forceOpen) || isItemOpen(path);
    const summary = summarizeItem(item);
    const inputType = inferInputType(item);
    const focusedCard = Boolean(options.focusedCard);
    const showHeaderActions = !focusedCard || !options.hideToggle;
    const compactReference = compactText(getInputReferenceText(item));
    const compactUnit = compactText(getInputUnitHint(item));
    const focusCopy = isGroup
      ? "Nested content"
      : inputType === "image"
        ? "One image will be uploaded when this form is filled up."
      : [
          compactReference ? `Reference ${compactReference}` : "",
          compactUnit ? `Unit ${compactUnit}` : "",
          inputNormalRangeLabel(item),
        ].filter(Boolean).join(" | ");
    const addItems = isGroup
      ? [
          { action: "add-field", label: "Field", path: [...path, "children"] },
          { action: "add-group", label: "Group", path: [...path, "children"] },
          ...(state.ui.advancedMode
            ? [
                { action: "add-note", label: "Note", path: [...path, "children"] },
                { action: "add-table", label: "Table", path: [...path, "children"] },
                { action: "add-divider", label: "Divider", path: [...path, "children"] },
              ]
            : []),
        ]
      : [];
  
    return `
      <article class="item-card ${isGroup ? "group-card" : ""} ${open ? "is-open" : ""} ${focusedCard ? "is-focused" : ""}" data-node-path="${encodePath(path)}" data-parent-path="${encodePath(path.slice(0, -1))}">
        <div class="item-head ${focusedCard ? "item-head-focused" : ""}">
          <div>
            ${!focusedCard ? `
            <div class="item-meta">
              <span class="item-summary">${escapeHtml(summary)}</span>
            </div>
            ` : ""}
            <h4 class="item-display-title">${escapeHtml(item.name || (isGroup ? "Untitled Group" : "Untitled Field"))}</h4>
          </div>
          ${showHeaderActions ? `
          <div class="row-actions">
            ${focusedCard ? "" : `
            <button class="drag-handle" type="button" title="Drag to reorder" aria-label="Drag to reorder">
              <span class="drag-dots" aria-hidden="true"></span>
            </button>
            `}
            ${options.hideToggle ? "" : `<button class="ghost mini" type="button" data-action="toggle-item" data-path="${encodePath(path)}">${open ? "Hide" : "Edit"}</button>`}
            ${renderNodeActionMenu(path)}
          </div>
          ` : ""}
        </div>
  
        ${open ? `
          ${focusedCard && focusCopy ? `<p class="item-focus-copy">${escapeHtml(focusCopy)}</p>` : ""}

          <div class="inline-grid item-basics-grid ${focusedCard ? "compact" : ""} ${isGroup ? "single" : ""}">
            <label>
              <span>Name</span>
              <input class="item-title-input" data-path="${encodePath(path)}" data-bind="name" value="${escapeHtml(item.name || "")}" placeholder="${isGroup ? "Example: Vital Signs" : "Example: Color"}">
            </label>
              ${isGroup ? "" : `
                <label>
                  <span>Input</span>
                  <select data-action="item-input-type" data-path="${encodePath(path)}">
                    ${INPUT_TYPES.map((item) => `<option value="${item.id}"${item.id === inputType ? " selected" : ""}>${item.label}</option>`).join("")}
                  </select>
                </label>
              `}
          </div>

          ${isGroup ? "" : inputType === "image" ? `
            <section class="reference-editor image-answer-editor">
              <div class="reference-editor-head">
                <p>One image will be uploaded when this form is filled up.</p>
              </div>
            </section>
          ` : `
            <section class="reference-editor">
              <div class="reference-editor-head">
                <p>Shown beside the result.</p>
              </div>
              <div class="inline-grid item-basics-grid compact">
                <label>
                  <span>Reference</span>
                  <input data-path="${encodePath(path)}" data-bind="reference_text" value="${escapeHtml(getInputReferenceText(item) || "")}" placeholder="${inputType === "choice" ? "Example: Negative" : "Example: 4.5 - 11.0"}">
                </label>
                <label>
                  <span>Unit</span>
                  <input data-path="${encodePath(path)}" data-bind="unit_hint" value="${escapeHtml(getInputUnitHint(item) || "")}" placeholder="Example: mg/dL">
                </label>
              </div>
              ${inputType === "number" ? `
                <div class="reference-range">
                  <div class="reference-range-head">
                    <span class="reference-range-title">Normal range</span>
                    <p>Used for normal checks.</p>
                  </div>
                  <div class="inline-grid reference-range-grid">
                    <label>
                      <span>From</span>
                      <input type="number" step="any" data-path="${encodePath(path)}" data-bind="normal_min" value="${escapeHtml(getInputNormalMin(item) || "")}" placeholder="Example: 4.5">
                    </label>
                    <label>
                      <span>To</span>
                      <input type="number" step="any" data-path="${encodePath(path)}" data-bind="normal_max" value="${escapeHtml(getInputNormalMax(item) || "")}" placeholder="Example: 11.0">
                    </label>
                  </div>
                </div>
              ` : ""}
            </section>
          `}

        ${isGroup ? `
          <div class="nested-items">
            ${renderItemCollection(getNodeChildren(item), [...path, "children"], focusedCard ? { focused: true } : {})}
          </div>
          <div class="section-actions">
            ${renderAddMenu(addItems)}
          </div>
        ` : ""}

        ${!isGroup && inferInputType(item) === "choice" ? renderOptionsEditor(item, path) : ""}

          ${state.ui.advancedMode ? `
            <details class="advanced">
              <summary>Advanced</summary>
              <div class="advanced-grid">
              <label>
                <span>Key</span>
                <input data-path="${encodePath(path)}" data-bind="key" value="${escapeHtml(getNodeKey(item) || "")}">
              </label>
              <label style="grid-column: 1 / -1;">
                <span>Notes</span>
                <textarea data-path="${encodePath(path)}" data-bind="notes" data-format="lines">${escapeHtml(getNodeNotes(item).join("\n"))}</textarea>
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
    const options = getInputOptions(field);
    const selectedIndex = resolveFocusedOptionIndex(path, options);
    const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
    const selectedOptionName = String(selectedOption?.name || "").trim() || "Untitled option";
    return `
      <section class="item-stack">
        <div class="card-head">
          <div>
            <div class="card-title-row">
              <h4>Options</h4>
            </div>
          </div>
          <div class="option-actions">
            <button class="ghost mini" type="button" data-action="add-option" data-path="${encodePath(path)}">Add option</button>
          </div>
        </div>
      ${options.length ? `
        <div class="option-organizer">
          ${options.map((option, index) => `
            <div class="option-organizer-item ${index === selectedIndex ? "active" : ""}">
              <button class="option-organizer-select" type="button" data-action="focus-option" data-path="${encodePath(path)}" data-index="${index}">
                <span class="option-organizer-copy">
                  <strong>${escapeHtml(option.name || "Untitled option")}</strong>
                  ${option.is_normal ? '<span>Normal</span>' : ""}
                </span>
              </button>
            </div>
          `).join("")}
        </div>
        <div class="option-focus-stage">
          ${selectedOption ? `
            <div class="option-focus-card">
                <div class="option-focus-head">
                  <div>
                    <h5>${escapeHtml(selectedOptionName)}</h5>
                  </div>
                </div>
                <label class="option-focus-input">
                  <span>Name</span>
                  <input data-action="option-name" data-path="${encodePath(path)}" data-index="${selectedIndex}" value="${escapeHtml(selectedOption.name || "")}" placeholder="Example: Positive">
                </label>
                <label class="option-focus-toggle">
                  <span>Counts as normal</span>
                  <input type="checkbox" data-action="option-normal" data-path="${encodePath(path)}" data-index="${selectedIndex}" ${selectedOption.is_normal ? "checked" : ""}>
                </label>
                ${renderOptionManageFooter(path, selectedIndex)}
              </div>
          ` : '<div class="empty-state">Pick an option to keep editing.</div>'}
        </div>
      ` : '<div class="empty-state">No options yet. Add one when you are ready.</div>'}
    </section>
  `;
}

function renderPreview() {
  if (!state.draft) {
    previewCanvasEl.innerHTML = '<div class="empty-state">Your preview will appear here.</div>';
    return;
  }

  const previewSegments = topLevelPreviewSegments();
  const previewTargets = previewSegments.map((segment) => ({
    id: segment.id,
    label: segment.label,
  }));
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
              <span class="preview-sync-copy">Sample</span>
            </div>
            <h3 class="preview-title">${escapeHtml(state.draft.name || "Untitled Form")}</h3>
            <p class="panel-copy">${escapeHtml(displayLocationName(state.draft))} | ${escapeHtml(currentVersionLabel())}</p>
          </div>
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
          ${previewSegments.map((segment) => renderPreviewSection(segment.title, segment.items, segment.id)).join("")}
        </div>
      </div>
    </section>
  `;
  syncPreviewIndexSelection();
}

function previewSectionId(title, index) {
  return `preview_section_${slugify(title)}_${index}`;
}

function renderPreviewSection(title, items, previewId) {
  const normalizedItems = normalizeArray(items);
  if (!normalizedItems.length) {
    return "";
  }

  return `
    <section class="preview-section" id="${escapeHtml(previewId)}">
      <div class="preview-section-head">
        <h4>${escapeHtml(title)}</h4>
      </div>
      <div class="preview-grid">
        ${normalizedItems.map(renderPreviewItem).join("")}
      </div>
    </section>
  `;
}

function previewRichText(value) {
  return escapeHtml(String(value || "")).replaceAll("\n", "<br>");
}

function previewInputType(field) {
  const inputType = inferInputType(field);
  if (inputType === "number") {
    return "number";
  }
  if (inputType === "date") {
    return "date";
  }
  if (inputType === "time") {
    return "time";
  }
  if (inputType === "datetime") {
    return "datetime-local";
  }
  return "text";
}

function previewPlaceholder(field) {
  const unitHint = getInputUnitHint(field);
  if (unitHint) {
    return unitHint;
  }
  if (inferInputType(field) === "number") {
    return "Enter value";
  }
  return "Sample input";
}

function renderPreviewItem(item) {
  if (item.kind === "note") {
    const title = String(item.name || "").trim();
    const content = utilityBlockContent(item);
    const showTitle = title && title.toLowerCase() !== "note";
    return `
      <div class="preview-note">
        ${showTitle ? `<div class="preview-note-title">${escapeHtml(title)}</div>` : ""}
        <div class="preview-note-body">${previewRichText(content || "Note text")}</div>
      </div>
    `;
  }

  if (item.kind === "divider") {
    const label = String(item.name || "").trim();
    const caption = utilityBlockContent(item);
    const showLabel = label && label.toLowerCase() !== "divider";
    return `
      <div class="preview-divider">
        <div class="preview-divider-line"></div>
        ${(showLabel || caption) ? `
          <div class="preview-divider-copy">
            ${showLabel ? `<span class="preview-divider-label">${escapeHtml(label)}</span>` : ""}
            ${caption ? `<span class="preview-divider-caption">${escapeHtml(caption)}</span>` : ""}
          </div>
        ` : ""}
      </div>
    `;
  }

  if (item.kind === "field_group") {
    return `
      <div class="preview-group">
        <div class="preview-group-head">
          <div class="preview-group-title">${escapeHtml(item.name || "Group")}</div>
        </div>
        <div class="preview-grid">
          ${getNodeChildren(item).map((child) => renderPreviewItem(child)).join("")}
        </div>
      </div>
    `;
  }

  if (item.kind === "table") {
    const title = String(item.name || "").trim();
    const columns = getTableColumns(item);
    const sampleRows = getTableSampleRows(item);
    const showTitle = title && title.toLowerCase() !== "table";
    return `
      <div class="preview-table">
        ${showTitle ? `<div class="preview-table-title">${escapeHtml(title)}</div>` : ""}
        <div class="preview-table-shell">
          <table>
            <thead>
              <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${Array.from({ length: sampleRows }, () => `
                <tr>
                  ${columns.map(() => '<td><span class="preview-table-placeholder"></span></td>').join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  const hints = [];
  if (getInputUnitHint(item)) hints.push(getInputUnitHint(item));
  if (getInputReferenceText(item)) hints.push(`reference ${getInputReferenceText(item)}`);
  const inputType = inferInputType(item);

  if (inputType === "image") {
    return `
      <label class="preview-field">
        <span>${escapeHtml(item.name || "Untitled Field")}</span>
        <div class="preview-image-upload">
          <strong>Add image</strong>
          <span>One image will be uploaded here.</span>
        </div>
        ${hints.length ? `<div class="preview-hint">${escapeHtml(hints.join(" | "))}</div>` : ""}
      </label>
    `;
  }

  return `
    <label class="preview-field">
      <span>${escapeHtml(item.name || "Untitled Field")}</span>
      ${getInputControl(item) === "select" ? `
        <select disabled>
          ${getInputOptions(item).map((option) => `<option>${escapeHtml(option.name || "Option")}</option>`).join("")}
        </select>
      ` : `<input type="${previewInputType(item)}" placeholder="${escapeHtml(previewPlaceholder(item))}" disabled>`}
      ${hints.length ? `<div class="preview-hint">${escapeHtml(hints.join(" | "))}</div>` : ""}
    </label>
  `;
}

function countItems(container) {
  let count = 0;
  normalizeArray(container?.blocks).forEach((block) => {
    count += countItems(block);
  });
  getNodeChildren(container).forEach((item) => {
    if (String(item?.kind || "").trim() === "field_group" || String(item?.kind || "").trim() === "section") {
      count += countItems(item);
    } else {
      count += 1;
    }
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
  touch({ full: true, source: "blocks" });
}

function duplicateAtPath(path) {
  const { collection, index } = getParentCollection(path);
  if (!Array.isArray(collection)) {
    return;
  }
  collection.splice(index + 1, 0, cloneNode(collection[index]));
  const duplicatedPath = [...path.slice(0, -1), index + 1];
  const duplicatedNode = getNodeByPath(duplicatedPath);
  if (String(duplicatedNode?.kind || "").trim() === "section") {
    state.ui.openSectionPaths = [pathKey(duplicatedPath)];
    state.ui.focusPane = "content";
    state.ui.activeItemPath = null;
  } else {
    state.ui.activeItemPath = pathKey(duplicatedPath);
    if (!pathStartsWith(duplicatedPath, ["block_schema", "blocks"])) {
      state.ui.focusPane = "content";
    }
  }
  if (path.includes("children")) {
    state.ui.activeItemPath = pathKey([...path.slice(0, -1), index + 1]);
  }
  touch({ full: true, source: "blocks" });
}

function deleteAtPath(path) {
  const { collection, index } = getParentCollection(path);
  if (!Array.isArray(collection)) {
    return;
  }
  if (state.ui.activeItemPath && pathStartsWith(parsePathKey(state.ui.activeItemPath), path)) {
    state.ui.activeItemPath = null;
  }
  if (String(getNodeByPath(path)?.kind || "").trim() === "section" && isSectionOpen(path)) {
    state.ui.openSectionPaths = [];
  }
  collection.splice(index, 1);
  touch({ full: true, source: "blocks" });
}

function addItemAt(path, kind) {
  const collection = getNodeByPath(path);
  if (!Array.isArray(collection)) {
    return;
  }
  const insertAt = insertChildNodeAtSelection(path, makeBlankBlock(kind));
  state.ui.activeItemPath = pathKey([...path, insertAt]);
  touch({ full: true, source: "blocks" });
}

function addUtilityAt(path, kind) {
  const collection = getNodeByPath(path);
  if (!Array.isArray(collection)) {
    return;
  }
  const insertAt = insertChildNodeAtSelection(
    path,
    kind === "divider"
      ? makeBlankDivider()
      : kind === "table"
        ? makeBlankTable()
        : makeBlankNote()
  );
  state.ui.activeItemPath = pathKey([...path, insertAt]);
  state.ui.activeOptionToken = null;
  touch({ full: true, source: "blocks" });
}

function insertChildNodeAtSelection(collectionPath, node) {
  const collection = getNodeByPath(collectionPath);
  if (!Array.isArray(collection)) {
    return -1;
  }

  const activePath = state.ui.activeItemPath ? parsePathKey(state.ui.activeItemPath) : null;
  if (activePath && pathStartsWith(activePath, collectionPath)) {
    const nextSegment = activePath[collectionPath.length];
    if (Number.isInteger(nextSegment)) {
      const insertAt = Math.max(0, Math.min(nextSegment + 1, collection.length));
      collection.splice(insertAt, 0, node);
      return insertAt;
    }
  }

  collection.push(node);
  return collection.length - 1;
}

function addSection() {
  topLevelBlocks().push(makeBlankSection());
  state.ui.openSectionPaths = [pathKey(["block_schema", "blocks", topLevelBlocks().length - 1])];
  state.ui.activeItemPath = null;
  state.ui.focusPane = "content";
  touch({ full: true, source: "blocks" });
}

function insertTopLevelContentBlock(kind) {
  const blocks = topLevelBlocks();
  const selectedEntry = resolveFocusedTopLevelBlockEntry(topLevelContentEntries());
  const nextNode = makeBlankBlock(kind);

  if (selectedEntry) {
    const selectedIndex = Number(selectedEntry.path[selectedEntry.path.length - 1]);
    const insertAt = Number.isInteger(selectedIndex) ? selectedIndex + 1 : blocks.length;
    blocks.splice(insertAt, 0, nextNode);
    if (kind === "section") {
      state.ui.openSectionPaths = [pathKey(["block_schema", "blocks", insertAt])];
      state.ui.activeItemPath = null;
    } else {
      state.ui.activeItemPath = pathKey(["block_schema", "blocks", insertAt]);
      state.ui.activeOptionToken = null;
    }
    state.ui.focusPane = "content";
    touch({ full: true, source: "blocks" });
    return;
  }

  if (kind === "section") {
    addSection();
    return;
  }

  if (kind === "field" || kind === "field_group") {
    const actualIndex = insertTopLevelItem(kind);
    state.ui.activeItemPath = pathKey(["block_schema", "blocks", actualIndex]);
    state.ui.activeOptionToken = null;
    state.ui.focusPane = "content";
    touch({ full: true, source: "blocks" });
    return;
  }

  blocks.push(nextNode);
  state.ui.activeItemPath = pathKey(["block_schema", "blocks", blocks.length - 1]);
  state.ui.activeOptionToken = null;
  state.ui.focusPane = "content";
  touch({ full: true, source: "blocks" });
}

function addOption(path) {
  const field = getNodeByPath(path);
  const options = getInputOptions(field);
  options.push({ name: `Option ${options.length + 1}`, key: `option_${options.length + 1}`, order: options.length + 1, is_normal: false });
  state.ui.activeOptionToken = optionToken(path, options.length - 1);
  touch({ full: true, source: "blocks" });
}

function duplicateOption(path, index) {
  const field = getNodeByPath(path);
  const options = getInputOptions(field);
  const source = options[index];
  if (!source) {
    return;
  }
  const duplicate = deepClone(source);
  const baseName = String(duplicate.name || "").trim() || "Untitled option";
  duplicate.name = `${baseName} Copy`;
  duplicate.key = slugify(duplicate.name);
  duplicate.is_normal = Boolean(source.is_normal);
  options.splice(index + 1, 0, duplicate);
  state.ui.activeOptionToken = optionToken(path, index + 1);
  touch({ full: true, source: "blocks" });
}

function deleteOption(path, index) {
  const field = getNodeByPath(path);
  const options = getInputOptions(field);
  options.splice(index, 1);
  if (options.length) {
    state.ui.activeOptionToken = optionToken(path, Math.max(0, Math.min(index, options.length - 1)));
  } else {
    state.ui.activeOptionToken = null;
  }
  touch({ full: true, source: "blocks" });
}

async function confirmDeleteOption(path, index) {
  const field = getNodeByPath(path);
  const options = getInputOptions(field);
  const option = options[index];
  if (!option) {
    return;
  }

  const optionName = String(option.name || "").trim() || "this option";
  const decision = await openDecisionDialog({
    eyebrow: "Remove option",
    title: `Remove ${optionName}?`,
    message: "This option will be removed from the dropdown.",
    cancelLabel: "Keep option",
    confirmLabel: "Remove option",
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
    location_name: displayLocationName(state.draft),
    library_parent_node_key: state.draft.library_parent_node_key || null,
    library_new_container_name: state.draft.library_new_container_name || null,
    summary: state.draft.summary || "",
    form_schema: state.draft.block_schema,
  };

  const saved = state.selectedFormSlug
    ? await api(`/api/forms/${state.selectedFormSlug}`, { method: "PUT", body: JSON.stringify(payload) })
    : await api("/api/forms", { method: "POST", body: JSON.stringify(payload) });

  state.selectedFormSlug = saved.slug;
  state.loadedForm = ensureDraftBlockState(deepClone(saved));
  state.draft = ensureDraftBlockState(deepClone(saved));
  state.baselineDraft = ensureDraftBlockState(deepClone(saved));
  state.bootstrap = await api("/api/builder/bootstrap");
  if (saved.slug && window.location.pathname !== `/forms/${saved.slug}/builder`) {
    window.history.replaceState({}, "", `/forms/${saved.slug}/builder`);
  }
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
      setBoundValue(node, bind, splitLines(rawValue));
    } else {
      setBoundValue(node, bind, rawValue);
    }
    if (bind === "name") {
      const currentKey = getNodeKey(node);
      if (!currentKey || currentKey === slugify(previousName)) {
        setBoundValue(node, "key", slugify(rawValue));
      }
    }
  } else {
    const previousName = bind === "name" ? state.draft.name : "";
    const previousDraftKey = bind === "name" ? getDraftFormKey(state.draft) : "";
    if (event.target.dataset.format === "lines") {
      setBoundValue(state.draft, bind, splitLines(rawValue));
    } else {
      setBoundValue(state.draft, bind, rawValue);
    }
    if (bind === "name") {
      if (!previousDraftKey || previousDraftKey === slugify(previousName)) {
        setDraftFormKey(slugify(rawValue), state.draft);
      }
      syncDraftLocationState(state.draft);
    } else if (bind === "location_name") {
      if (state.draft.library_new_container_name) {
        state.draft.library_new_container_name = compactText(rawValue) || null;
        state.draft.location_name = compactText(rawValue);
        state.draft.location_path_label = compactText(rawValue);
      } else {
        const matchedLocation = findLocationOptionByFolderPathLabel(rawValue);
        if (matchedLocation) {
          state.draft.library_parent_node_key = matchedLocation.node_key;
          state.draft.location_name = matchedLocation.name;
          state.draft.location_path_label = matchedLocation.folder_path_label;
        } else if (isTopLevelLocationName(rawValue)) {
          state.draft.library_parent_node_key = null;
          state.draft.location_name = "Top level";
          state.draft.location_path_label = "Top level";
        } else {
          state.draft.library_parent_node_key = null;
          state.draft.location_name = compactText(rawValue);
          state.draft.location_path_label = compactText(rawValue);
        }
      }
      syncDraftLocationState(state.draft);
    }
  }

  touch({ source: "blocks" });
}

function handleOptionInput(event) {
  const path = event.target.dataset.path;
  const index = Number(event.target.dataset.index);
  if (!path || Number.isNaN(index)) {
    return;
  }
  const field = getNodeByPath(decodePath(path));
  const options = getInputOptions(field);
  if (!options[index]) {
    return;
  }
  if (event.target.dataset.action === "option-normal") {
    options[index].is_normal = Boolean(event.target.checked);
    touch({ source: "blocks" });
    return;
  }
  options[index].name = event.target.value;
  options[index].key = slugify(event.target.value);
  touch({ source: "blocks" });
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

  if (action === "add-section") {
    addSection();
    return;
  }
  if (action === "add-content-section") {
    insertTopLevelContentBlock("section");
    return;
  }
  if (action === "add-content-field") {
    insertTopLevelContentBlock("field");
    return;
  }
  if (action === "add-content-group") {
    insertTopLevelContentBlock("field_group");
    return;
  }
  if (action === "add-content-note") {
    insertTopLevelContentBlock("note");
    return;
  }
  if (action === "add-content-divider") {
    insertTopLevelContentBlock("divider");
    return;
  }
  if (action === "add-content-table") {
    insertTopLevelContentBlock("table");
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
  if (action === "focus-content-block" && path) {
    state.ui.focusPane = "content";
    setContentSelection(path);
    renderAll();
    return;
  }
  if (action === "focus-item" && path) {
    state.ui.activeItemPath = pathKey(path);
    state.ui.activeOptionToken = null;
    renderAll();
    return;
  }
  if (action === "toggle-section" && path) {
    state.ui.focusPane = "content";
    toggleSection(path);
    return;
  }
  if (action === "toggle-item" && path) {
    toggleItem(path);
    return;
  }
  if (action === "add-field" && path) {
    addItemAt(path, "field");
    return;
  }
  if (action === "add-group" && path) {
    addItemAt(path, "field_group");
    return;
  }
  if (action === "add-note" && path) {
    addUtilityAt(path, "note");
    return;
  }
  if (action === "add-divider" && path) {
    addUtilityAt(path, "divider");
    return;
  }
  if (action === "add-table" && path) {
    addUtilityAt(path, "table");
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
  if (event.target.dataset.action === "item-input-type") {
    const field = getNodeByPath(decodePath(event.target.dataset.path));
    applyInputType(field, event.target.value);
    state.ui.activeOptionToken = event.target.value === "choice"
      ? optionToken(decodePath(event.target.dataset.path), 0)
      : null;
    touch({ full: true, source: "blocks" });
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

  if (action === "focus-content-block" && actionTarget.dataset.path) {
    state.ui.focusPane = "content";
    setContentSelection(decodePath(actionTarget.dataset.path));
    renderAll();
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
  if (event.target.dataset.action === "option-normal") {
    handleOptionInput(event);
    return;
  }
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

