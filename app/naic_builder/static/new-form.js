const startFormEl = document.getElementById("startForm");
const formNameEl = document.getElementById("formName");
const existingGroupWrapEl = document.getElementById("existingGroupWrap");
const newGroupWrapEl = document.getElementById("newGroupWrap");
const existingGroupSelectEl = document.getElementById("existingGroupSelect");
const newGroupNameEl = document.getElementById("newGroupName");
const newGroupParentSelectEl = document.getElementById("newGroupParentSelect");
const rootGroupHintEl = document.getElementById("rootGroupHint");
const duplicateSourceWrapEl = document.getElementById("duplicateSourceWrap");
const duplicateSourceSelectEl = document.getElementById("duplicateSourceSelect");
const modeInputEl = document.getElementById("modeInput");
const slugInputEl = document.getElementById("slugInput");
const draftNameInputEl = document.getElementById("draftNameInput");
const groupNameInputEl = document.getElementById("groupNameInput");
const groupKindInputEl = document.getElementById("groupKindInput");
const groupOrderInputEl = document.getElementById("groupOrderInput");
const formOrderInputEl = document.getElementById("formOrderInput");
const parentNodeKeyInputEl = document.getElementById("parentNodeKeyInput");
const newContainerNameInputEl = document.getElementById("newContainerNameInput");
const summaryNameEl = document.getElementById("summaryName");
const summaryGroupEl = document.getElementById("summaryGroup");
const summaryStartEl = document.getElementById("summaryStart");

function visibleChoice(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function copyName(value) {
  const base = String(value || "").trim();
  if (!base) {
    return "";
  }
  return base.endsWith(" Copy") ? `${base} 2` : `${base} Copy`;
}

function selectedGroupOption() {
  return existingGroupSelectEl?.selectedOptions?.[0] || null;
}

function selectedNewGroupParentOption() {
  return newGroupParentSelectEl?.selectedOptions?.[0] || null;
}

function selectedDuplicateLabel() {
  const option = duplicateSourceSelectEl?.selectedOptions?.[0];
  return String(option?.dataset.pathLabel || option?.textContent || "").trim() || "Duplicate existing form";
}

function syncGroupMode() {
  const mode = visibleChoice("group_source_mode") || "existing";
  const useExistingGroup = mode === "existing";
  const useNewGroup = mode === "new";
  const useRoot = mode === "root";

  existingGroupWrapEl?.classList.toggle("hidden", !useExistingGroup);
  existingGroupWrapEl && (existingGroupWrapEl.hidden = !useExistingGroup);
  newGroupWrapEl?.classList.toggle("hidden", !useNewGroup);
  newGroupWrapEl && (newGroupWrapEl.hidden = !useNewGroup);
  rootGroupHintEl?.classList.toggle("hidden", !useRoot);
  rootGroupHintEl && (rootGroupHintEl.hidden = !useRoot);

  if (newGroupNameEl) {
    newGroupNameEl.required = useNewGroup;
  }
}

function syncStartMode() {
  const startMode = visibleChoice("start_mode") || "blank";
  const duplicateSelected = startMode === "duplicate";

  duplicateSourceWrapEl?.classList.toggle("hidden", !duplicateSelected);
  duplicateSourceWrapEl && (duplicateSourceWrapEl.hidden = !duplicateSelected);

  if (duplicateSourceSelectEl) {
    duplicateSourceSelectEl.required = duplicateSelected;
  }
}

function updateSummary() {
  const formName = String(formNameEl?.value || "").trim();
  const groupMode = visibleChoice("group_source_mode") || "existing";
  const startMode = visibleChoice("start_mode") || "blank";

  let groupName = "Top level";
  if (groupMode === "new") {
    const parentPath = String(selectedNewGroupParentOption()?.dataset.pathLabel || "").trim();
    const newFolderName = String(newGroupNameEl?.value || "").trim();
    groupName = [parentPath, newFolderName].filter(Boolean).join(" / ");
  } else if (groupMode === "existing") {
    groupName = String(selectedGroupOption()?.dataset.pathLabel || selectedGroupOption()?.textContent || "").trim();
  }

  let startLabel = "Start empty";
  if (startMode === "duplicate") {
    startLabel = `Duplicate ${selectedDuplicateLabel()}`;
  }

  if (summaryNameEl) {
    summaryNameEl.textContent = formName || "Choose a name";
  }
  if (summaryGroupEl) {
    summaryGroupEl.textContent = groupName || "Choose a folder";
  }
  if (summaryStartEl) {
    summaryStartEl.textContent = startLabel;
  }
}

function syncHiddenInputs() {
  const groupMode = visibleChoice("group_source_mode") || "existing";
  const startMode = visibleChoice("start_mode") || "blank";
  const selectedOption = selectedGroupOption();
  const selectedNewParentOption = selectedNewGroupParentOption();
  const draftName = String(formNameEl?.value || "").trim();

  const usingNewGroup = groupMode === "new";
  const usingRoot = groupMode === "root";
  const parentNodeKey = usingNewGroup
    ? String(selectedNewParentOption?.value || "").trim()
    : usingRoot
      ? ""
      : String(selectedOption?.value || "").trim();
  const groupName = usingRoot
    ? (draftName || "Untitled Form")
    : usingNewGroup
    ? String(newGroupNameEl?.value || "").trim()
    : String(selectedOption?.dataset.groupName || "").trim();
  const groupOrder = usingNewGroup
    ? 999
    : usingRoot
      ? 999
      : Number(selectedOption?.dataset.groupOrder || 999);
  const formOrder = usingNewGroup
    ? 1
    : usingRoot
      ? Number(startFormEl?.dataset.rootFormOrder || 1)
      : Number(selectedOption?.dataset.formOrder || 1);

  if (modeInputEl) {
    modeInputEl.value = startMode === "duplicate" ? "duplicate" : "new";
  }
  if (slugInputEl) {
    slugInputEl.value = startMode === "duplicate" ? String(duplicateSourceSelectEl?.value || "") : "";
  }
  if (draftNameInputEl) {
    draftNameInputEl.value = String(formNameEl?.value || "").trim();
  }
  if (groupNameInputEl) {
    groupNameInputEl.value = groupName;
  }
  if (groupKindInputEl) {
    groupKindInputEl.value = usingRoot ? "standalone_form" : "category";
  }
  if (groupOrderInputEl) {
    groupOrderInputEl.value = Number.isFinite(groupOrder) ? String(groupOrder) : "999";
  }
  if (formOrderInputEl) {
    formOrderInputEl.value = Number.isFinite(formOrder) ? String(formOrder) : "1";
  }
  if (parentNodeKeyInputEl) {
    parentNodeKeyInputEl.value = parentNodeKey;
  }
  if (newContainerNameInputEl) {
    newContainerNameInputEl.value = usingNewGroup ? String(newGroupNameEl?.value || "").trim() : "";
  }
}

function handleSourceSelectionAutofill() {
  if (!formNameEl || !duplicateSourceSelectEl) {
    return;
  }

  if (document.activeElement === formNameEl) {
    return;
  }

  const currentName = String(formNameEl.value || "").trim();
  if (!currentName || formNameEl.dataset.autofill === "true") {
    formNameEl.value = copyName(selectedDuplicateLabel());
    formNameEl.dataset.autofill = "true";
  }
}

function refreshScreen() {
  syncGroupMode();
  syncStartMode();
  syncHiddenInputs();
  updateSummary();
}

document.querySelectorAll('input[name="group_source_mode"], input[name="start_mode"]').forEach((input) => {
  input.addEventListener("change", () => {
    if (visibleChoice("start_mode") === "duplicate") {
      handleSourceSelectionAutofill();
    }
    refreshScreen();
  });
});

existingGroupSelectEl?.addEventListener("change", refreshScreen);
newGroupNameEl?.addEventListener("input", refreshScreen);
newGroupParentSelectEl?.addEventListener("change", refreshScreen);
duplicateSourceSelectEl?.addEventListener("change", () => {
  handleSourceSelectionAutofill();
  refreshScreen();
});

formNameEl?.addEventListener("input", () => {
  const value = String(formNameEl.value || "").trim();
  formNameEl.dataset.autofill = value ? "false" : "true";
  refreshScreen();
});

startFormEl?.addEventListener("submit", (event) => {
  syncHiddenInputs();

  if (!String(formNameEl?.value || "").trim()) {
    event.preventDefault();
    formNameEl?.focus();
    formNameEl?.setCustomValidity("Give this form a clear name first.");
    formNameEl?.reportValidity();
    return;
  }

  formNameEl?.setCustomValidity("");

  if (visibleChoice("group_source_mode") === "new" && !String(newGroupNameEl?.value || "").trim()) {
    event.preventDefault();
    newGroupNameEl?.focus();
    newGroupNameEl?.setCustomValidity("Name the new folder before you continue.");
    newGroupNameEl?.reportValidity();
    return;
  }

  newGroupNameEl?.setCustomValidity("");

  startFormEl
    .querySelectorAll('input[name="group_source_mode"], input[name="start_mode"]')
    .forEach((input) => {
      input.disabled = true;
    });
});

if (visibleChoice("start_mode") === "duplicate") {
  handleSourceSelectionAutofill();
}

refreshScreen();
