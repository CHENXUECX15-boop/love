const STORAGE_KEY = "love-record-site.entries.v1";

const state = {
  entries: [],
  filter: "all",
  search: "",
  expandedMonths: new Set(),
};

const els = {
  form: document.querySelector("#recordForm"),
  recordId: document.querySelector("#recordId"),
  date: document.querySelector("#recordDate"),
  mood: document.querySelector("#mood"),
  moodValue: document.querySelector("#moodValue"),
  happy: document.querySelector("#happyText"),
  sad: document.querySelector("#sadText"),
  talk: document.querySelector("#talkText"),
  saveBtn: document.querySelector("#saveBtn"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  message: document.querySelector("#formMessage"),
  list: document.querySelector("#recordList"),
  search: document.querySelector("#searchInput"),
  filters: document.querySelectorAll(".filter-button"),
  exportBtn: document.querySelector("#exportBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  totalCount: document.querySelector("#totalCount"),
  pendingCount: document.querySelector("#pendingCount"),
  revisitCount: document.querySelector("#revisitCount"),
  talkRate: document.querySelector("#talkRate"),
};

const moodText = {
  1: "低落",
  2: "有点累",
  3: "平稳",
  4: "开心",
  5: "很甜",
};

const statusText = {
  talked: "已沟通",
  pending: "未沟通",
  revisit: "需再聊",
};

function loadEntries() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.entries = Array.isArray(stored) ? stored : [];
  } catch {
    state.entries = [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function createId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTalkStatus() {
  const selected = document.querySelector('input[name="talkStatus"]:checked');
  return selected ? selected.value : "pending";
}

function setTalkStatus(value) {
  const target = document.querySelector(`input[name="talkStatus"][value="${value}"]`);
  if (target) {
    target.checked = true;
  }
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function monthKeyFromDate(value) {
  if (!value || value.length < 7) {
    return "unknown";
  }

  return value.slice(0, 7);
}

function currentMonthKey() {
  return monthKeyFromDate(today());
}

function formatMonth(value) {
  if (value === "unknown") {
    return "未填写月份";
  }

  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "未填写月份";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function updateMoodLabel() {
  els.moodValue.value = moodText[els.mood.value] || "平稳";
  els.moodValue.textContent = els.moodValue.value;
}

function setMessage(text, isError = false) {
  els.message.textContent = text;
  els.message.classList.toggle("error", isError);
}

function resetForm() {
  els.form.reset();
  els.recordId.value = "";
  els.date.value = today();
  els.mood.value = "3";
  updateMoodLabel();
  setTalkStatus("pending");
  els.saveBtn.textContent = "保存记录";
  els.cancelEditBtn.classList.add("hidden");
  setMessage("");
}

function collectFormData() {
  return {
    date: els.date.value,
    mood: Number(els.mood.value),
    happy: els.happy.value.trim(),
    sad: els.sad.value.trim(),
    talkStatus: getTalkStatus(),
    talk: els.talk.value.trim(),
  };
}

function validateEntry(entry) {
  if (!entry.date) {
    return "请选择日期";
  }

  if (!entry.happy && !entry.sad) {
    return "开心和不开心的事情至少写一项";
  }

  return "";
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "");
  });
}

function visibleEntries() {
  const keyword = state.search.trim().toLowerCase();

  return sortEntries(state.entries).filter((entry) => {
    const statusMatch = state.filter === "all" || entry.talkStatus === state.filter;
    const searchTarget = [entry.date, entry.happy, entry.sad, entry.talk, statusText[entry.talkStatus]]
      .join(" ")
      .toLowerCase();
    return statusMatch && (!keyword || searchTarget.includes(keyword));
  });
}

function groupEntriesByMonth(entries) {
  const groups = [];
  const byKey = new Map();

  for (const entry of entries) {
    const key = monthKeyFromDate(entry.date);
    let group = byKey.get(key);

    if (!group) {
      group = { key, entries: [] };
      byKey.set(key, group);
      groups.push(group);
    }

    group.entries.push(entry);
  }

  return groups;
}

function toggleMonth(key) {
  if (state.expandedMonths.has(key)) {
    state.expandedMonths.delete(key);
  } else {
    state.expandedMonths.add(key);
  }

  renderEntries();
}

function updateMetrics() {
  const total = state.entries.length;
  const pending = state.entries.filter((entry) => entry.talkStatus === "pending").length;
  const revisit = state.entries.filter((entry) => entry.talkStatus === "revisit").length;
  const talked = state.entries.filter((entry) => entry.talkStatus === "talked").length;

  els.totalCount.textContent = total;
  els.pendingCount.textContent = pending;
  els.revisitCount.textContent = revisit;
  els.talkRate.textContent = total ? `${Math.round((talked / total) * 100)}%` : "0%";
}

function createRecordSection(title, text) {
  const section = document.createElement("section");
  section.className = "record-section";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const content = document.createElement("p");
  content.textContent = text || "未填写";

  section.append(heading, content);
  return section;
}

function renderEntries() {
  updateMetrics();
  els.list.innerHTML = "";

  const entries = visibleEntries();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.entries.length ? "没有符合条件的记录" : "还没有记录";
    els.list.append(empty);
    return;
  }

  for (const group of groupEntriesByMonth(entries)) {
    const month = document.createElement("section");
    month.className = "month-group";

    const isExpanded = state.expandedMonths.has(group.key);
    month.classList.toggle("collapsed", !isExpanded);

    const monthToggle = document.createElement("button");
    monthToggle.className = "month-toggle";
    monthToggle.type = "button";
    monthToggle.setAttribute("aria-expanded", String(isExpanded));
    monthToggle.addEventListener("click", () => toggleMonth(group.key));

    const monthTitle = document.createElement("span");
    monthTitle.className = "month-title";
    monthTitle.textContent = formatMonth(group.key);

    const monthCount = document.createElement("span");
    monthCount.className = "month-count";
    monthCount.textContent = `${group.entries.length} 条记录`;

    const monthCaret = document.createElement("span");
    monthCaret.className = "month-caret";
    monthCaret.setAttribute("aria-hidden", "true");
    monthCaret.textContent = "⌄";

    monthToggle.append(monthTitle, monthCount, monthCaret);

    const monthRecords = document.createElement("div");
    monthRecords.className = "month-records";
    monthRecords.hidden = !isExpanded;

    month.append(monthToggle, monthRecords);

    if (!isExpanded) {
      els.list.append(month);
      continue;
    }

    for (const entry of group.entries) {
    const card = document.createElement("article");
    card.className = "record-card";

    const head = document.createElement("div");
    head.className = "record-head";

    const titleWrap = document.createElement("div");
    const date = document.createElement("p");
    date.className = "record-date";
    date.textContent = formatDate(entry.date);

    const mood = document.createElement("p");
    mood.className = "record-mood";
    mood.textContent = `感觉：${moodText[entry.mood] || "平稳"}`;

    titleWrap.append(date, mood);

    const status = document.createElement("span");
    status.className = `status-pill ${entry.talkStatus}`;
    status.textContent = statusText[entry.talkStatus] || "未沟通";

    head.append(titleWrap, status);

    const actions = document.createElement("div");
    actions.className = "record-actions";

    const editButton = document.createElement("button");
    editButton.className = "small-button";
    editButton.type = "button";
    editButton.textContent = "编辑";
    editButton.addEventListener("click", () => editEntry(entry.id));

    const talkButton = document.createElement("button");
    talkButton.className = "small-button";
    talkButton.type = "button";
    talkButton.textContent = entry.talkStatus === "talked" ? "标记未沟通" : "标记已沟通";
    talkButton.addEventListener("click", () => toggleTalked(entry.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "small-button";
    deleteButton.type = "button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => deleteEntry(entry.id));

    actions.append(editButton, talkButton, deleteButton);
    card.append(
      head,
      createRecordSection("开心的事情", entry.happy),
      createRecordSection("不开心的事情", entry.sad),
      createRecordSection("沟通内容 / 下一步", entry.talk),
      actions,
    );
      monthRecords.append(card);
    }

    els.list.append(month);
  }
}

function handleSubmit(event) {
  event.preventDefault();

  const data = collectFormData();
  const error = validateEntry(data);
  if (error) {
    setMessage(error, true);
    return;
  }

  const now = new Date().toISOString();
  const editingId = els.recordId.value;
  state.expandedMonths.add(monthKeyFromDate(data.date));

  if (editingId) {
    state.entries = state.entries.map((entry) =>
      entry.id === editingId
        ? {
            ...entry,
            ...data,
            updatedAt: now,
          }
        : entry,
    );
    setMessage("已更新");
  } else {
    state.entries.push({
      id: createId(),
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    setMessage("已保存");
  }

  saveEntries();
  renderEntries();
  resetForm();
}

function editEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) {
    return;
  }

  els.recordId.value = entry.id;
  els.date.value = entry.date;
  els.mood.value = String(entry.mood || 3);
  updateMoodLabel();
  els.happy.value = entry.happy || "";
  els.sad.value = entry.sad || "";
  els.talk.value = entry.talk || "";
  setTalkStatus(entry.talkStatus || "pending");
  els.saveBtn.textContent = "更新记录";
  els.cancelEditBtn.classList.remove("hidden");
  setMessage("正在编辑");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleTalked(id) {
  state.entries = state.entries.map((entry) =>
    entry.id === id
      ? {
          ...entry,
          talkStatus: entry.talkStatus === "talked" ? "pending" : "talked",
          updatedAt: new Date().toISOString(),
        }
      : entry,
  );
  saveEntries();
  renderEntries();
}

function deleteEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) {
    return;
  }

  const ok = confirm(`删除 ${formatDate(entry.date)} 的记录？`);
  if (!ok) {
    return;
  }

  state.entries = state.entries.filter((item) => item.id !== id);
  saveEntries();
  renderEntries();
  if (els.recordId.value === id) {
    resetForm();
  }
}

function exportEntries() {
  const data = JSON.stringify(state.entries, null, 2);
  const blob = new Blob([data], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `love-record-${today()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clearEntries() {
  if (!state.entries.length) {
    setMessage("暂无记录");
    return;
  }

  const ok = confirm("清空所有恋爱记录？");
  if (!ok) {
    return;
  }

  state.entries = [];
  saveEntries();
  renderEntries();
  resetForm();
  setMessage("已清空");
}

function bindEvents() {
  els.form.addEventListener("submit", handleSubmit);
  els.mood.addEventListener("input", updateMoodLabel);
  els.cancelEditBtn.addEventListener("click", resetForm);
  els.exportBtn.addEventListener("click", exportEntries);
  els.clearBtn.addEventListener("click", clearEntries);
  els.search.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderEntries();
  });

  els.filters.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      els.filters.forEach((item) => item.classList.toggle("active", item === button));
      renderEntries();
    });
  });
}

function init() {
  loadEntries();
  state.expandedMonths.add(currentMonthKey());
  bindEvents();
  resetForm();
  renderEntries();
}

init();
