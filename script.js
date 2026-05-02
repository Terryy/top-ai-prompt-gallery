const DATA_URL = "data/prompts.json";
const STORAGE_KEY = "image-prompt-library-local";
const PAGE_SIZE = 12;

const state = {
  baseItems: [],
  localItems: [],
  filteredItems: [],
  renderedCount: 0,
};

const gallery = document.querySelector("#gallery");
const sentinel = document.querySelector("#sentinel");
const searchInput = document.querySelector("#searchInput");
const typeFilter = document.querySelector("#typeFilter");
const tagFilter = document.querySelector("#tagFilter");
const sortSelect = document.querySelector("#sortSelect");
const visibleCount = document.querySelector("#visibleCount");
const savedCount = document.querySelector("#savedCount");
const entryDialog = document.querySelector("#entryDialog");
const entryForm = document.querySelector("#entryForm");
const importFile = document.querySelector("#importFile");

const observer = new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting)) {
    renderNextPage();
  }
}, { rootMargin: "900px 0px" });

document.querySelector("#addButton").addEventListener("click", () => entryDialog.showModal());
document.querySelector("#closeDialog").addEventListener("click", () => entryDialog.close());
document.querySelector("#exportButton").addEventListener("click", exportLocalItems);
document.querySelector("#importButton").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", importLocalItems);

[searchInput, typeFilter, tagFilter, sortSelect].forEach((control) => {
  control.addEventListener("input", applyControls);
});

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(entryForm);
  const item = {
    id: crypto.randomUUID(),
    title: clean(form.get("title")),
    image: clean(form.get("image")),
    prompt: clean(form.get("prompt")),
    type: clean(form.get("type")) || "Unsorted",
    tags: splitTags(form.get("tags")),
    notes: clean(form.get("notes")),
    createdAt: new Date().toISOString().slice(0, 10),
    source: "local",
  };

  state.localItems.unshift(item);
  persistLocalItems();
  entryForm.reset();
  entryDialog.close();
  refresh();
});

async function init() {
  state.baseItems = await loadBaseItems();
  state.localItems = loadLocalItems();
  refresh();
  observer.observe(sentinel);
}

async function loadBaseItems() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${DATA_URL}`);
    const items = await response.json();
    return Array.isArray(items) ? items.map(normalizeItem) : [];
  } catch (error) {
    console.warn(error);
    return [];
  }
}

function loadLocalItems() {
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(items) ? items.map(normalizeItem) : [];
  } catch (error) {
    console.warn(error);
    return [];
  }
}

function normalizeItem(item) {
  return {
    id: item.id || crypto.randomUUID(),
    title: item.title || "Untitled prompt",
    image: item.image || "",
    prompt: item.prompt || "",
    type: item.type || "Unsorted",
    tags: Array.isArray(item.tags) ? item.tags : splitTags(item.tags),
    notes: item.notes || "",
    createdAt: item.createdAt || "2026-01-01",
    source: item.source || "published",
  };
}

function refresh() {
  hydrateFilters();
  applyControls();
  savedCount.textContent = `${state.localItems.length} saved locally`;
}

function hydrateFilters() {
  const currentType = typeFilter.value;
  const currentTag = tagFilter.value;
  const allItems = getAllItems();
  const types = unique(allItems.map((item) => item.type));
  const tags = unique(allItems.flatMap((item) => item.tags));

  typeFilter.innerHTML = `<option value="all">All types</option>${types.map(optionMarkup).join("")}`;
  tagFilter.innerHTML = `<option value="all">All tags</option>${tags.map(optionMarkup).join("")}`;
  typeFilter.value = types.includes(currentType) ? currentType : "all";
  tagFilter.value = tags.includes(currentTag) ? currentTag : "all";
}

function applyControls() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;
  const selectedTag = tagFilter.value;

  state.filteredItems = getAllItems()
    .filter((item) => selectedType === "all" || item.type === selectedType)
    .filter((item) => selectedTag === "all" || item.tags.includes(selectedTag))
    .filter((item) => {
      if (!query) return true;
      return [
        item.title,
        item.prompt,
        item.type,
        item.notes,
        item.tags.join(" "),
      ].join(" ").toLowerCase().includes(query);
    })
    .sort(sortItems(sortSelect.value));

  state.renderedCount = 0;
  gallery.innerHTML = "";
  renderNextPage();
}

function getAllItems() {
  return [...state.localItems, ...state.baseItems];
}

function renderNextPage() {
  if (state.renderedCount >= state.filteredItems.length) {
    updateVisibleCount();
    if (!state.filteredItems.length) {
      gallery.innerHTML = `<div class="empty">No matching image prompts.</div>`;
    }
    return;
  }

  const nextItems = state.filteredItems.slice(state.renderedCount, state.renderedCount + PAGE_SIZE);
  const fragment = document.createDocumentFragment();
  nextItems.forEach((item) => fragment.appendChild(createCard(item)));
  gallery.appendChild(fragment);
  state.renderedCount += nextItems.length;
  updateVisibleCount();
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.title)}" loading="lazy">
    <div class="cardBody">
      <div class="cardTitle">
        <h3>${escapeHtml(item.title)}</h3>
        <span class="badge">${escapeHtml(item.type)}</span>
      </div>
      <div class="cardActions">
        <button class="copyButton" type="button">Copy prompt</button>
      </div>
      <p class="prompt">${escapeHtml(item.prompt)}</p>
      ${item.tags.length ? `<div class="tags">${item.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      <div class="meta">
        <span>${formatDate(item.createdAt)}</span>
        <span>${item.source === "local" ? "Local" : "Published"}</span>
      </div>
    </div>
  `;
  card.querySelector(".copyButton").addEventListener("click", (event) => {
    copyPrompt(item.prompt, event.currentTarget);
  });
  return card;
}

async function copyPrompt(prompt, button) {
  const originalText = button.textContent;
  try {
    await navigator.clipboard.writeText(prompt);
    button.textContent = "Copied";
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = prompt;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    button.textContent = "Copied";
  }

  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1400);
}

function sortItems(mode) {
  return (a, b) => {
    if (mode === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (mode === "title") return a.title.localeCompare(b.title);
    if (mode === "type") return a.type.localeCompare(b.type) || b.createdAt.localeCompare(a.createdAt);
    return b.createdAt.localeCompare(a.createdAt);
  };
}

function persistLocalItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.localItems, null, 2));
}

function exportLocalItems() {
  const blob = new Blob([JSON.stringify(state.localItems, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "image-prompts-local.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importLocalItems(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const incoming = JSON.parse(reader.result);
      if (!Array.isArray(incoming)) throw new Error("Expected an array");
      const existingIds = new Set(state.localItems.map((item) => item.id));
      const merged = incoming.map(normalizeItem).filter((item) => !existingIds.has(item.id));
      state.localItems = [...merged, ...state.localItems];
      persistLocalItems();
      refresh();
    } catch (error) {
      alert("That JSON file could not be imported.");
      console.warn(error);
    } finally {
      importFile.value = "";
    }
  });
  reader.readAsText(file);
}

function updateVisibleCount() {
  visibleCount.textContent = `${Math.min(state.renderedCount, state.filteredItems.length)} of ${state.filteredItems.length} shown`;
}

function clean(value) {
  return String(value || "").trim();
}

function splitTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function optionMarkup(value) {
  return `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

init();
