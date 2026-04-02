const startFormEl = document.getElementById("startForm");
const formNameEl = document.getElementById("formName");
const existingGroupWrapEl = document.getElementById("existingGroupWrap");
const newGroupWrapEl = document.getElementById("newGroupWrap");
const existingGroupSelectEl = document.getElementById("existingGroupSelect");
const newGroupNameEl = document.getElementById("newGroupName");
const duplicateSourceWrapEl = document.getElementById("duplicateSourceWrap");
const duplicateSourceSelectEl = document.getElementById("duplicateSourceSelect");
const modeInputEl = document.getElementById("modeInput");
const slugInputEl = document.getElementById("slugInput");
const draftNameInputEl = document.getElementById("draftNameInput");
const groupNameInputEl = document.getElementById("groupNameInput");
const groupKindInputEl = document.getElementById("groupKindInput");
const groupOrderInputEl = document.getElementById("groupOrderInput");
const formOrderInputEl = document.getElementById("formOrderInput");
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

function selectedDuplicateLabel() {
  return duplicateSourceSelectEl?.selectedOptions?.[0]?.textContent?.trim() || "Duplicate existing form";
}

function syncGroupMode() {
  const useNewGroup = visibleChoice("group_source_mode") === "new";
  existingGroupWrapEl?.classList.toggle("hidden", useNewGroup);
  existingGroupWrapEl && (existingGroupWrapEl.hidden = useNewGroup);
  newGroupWrapEl?.classList.toggle("hidden", !useNewGroup);
  newGroupWrapEl && (newGroupWrapEl.hidden = !useNewGroup);

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

  const groupName = groupMode === "new"
    ? String(newGroupNameEl?.value || "").trim()
    : String(selectedGroupOption()?.value || "");

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

  const usingNewGroup = groupMode === "new";
  const groupName = usingNewGroup
    ? String(newGroupNameEl?.value || "").trim()
    : String(selectedOption?.value || "");
  const groupOrder = usingNewGroup
    ? 999
    : Number(selectedOption?.dataset.groupOrder || 999);
  const formOrder = usingNewGroup
    ? 1
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
    groupKindInputEl.value = "category";
  }
  if (groupOrderInputEl) {
    groupOrderInputEl.value = Number.isFinite(groupOrder) ? String(groupOrder) : "999";
  }
  if (formOrderInputEl) {
    formOrderInputEl.value = Number.isFinite(formOrder) ? String(formOrder) : "1";
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
