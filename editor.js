const DRAFT_KEY = "sonata-content-draft-v1";
const clone = (value) => JSON.parse(JSON.stringify(value));
let draft = loadDraft();
let activeLocation = Object.keys(draft.locations)[0] || null;
let activeSceneIndex = 0;
let activeHotspot = 0;
let activeDreamForm = "black";
let activeDreamHotspot = 0;
let dreamPlacement = "hotspot";
let dreamDrag = null;
const dreamPreviewUrls = { black: "", white: "" };
let saveTimer = null;

function loadDraft() {
  try {
    const loaded = JSON.parse(localStorage.getItem(DRAFT_KEY)) || clone(window.SONATA_CONTENT);
    Object.values(loaded.locations || {}).forEach((location) => {
      if (!location.scenes) {
        location.scenes = [{ id: `scene-${Date.now()}`, title: location.sceneTitle || "新场景", artwork: location.artwork || "", placeholderTone: location.placeholderTone || "archive", hotspots: location.hotspots || [] }];
      }
    });
    if (!loaded.dream.hotspots) loaded.dream.hotspots = clone(window.SONATA_CONTENT.dream.hotspots);
    if (!loaded.dream.lightPoint) loaded.dream.lightPoint = clone(window.SONATA_CONTENT.dream.lightPoint);
    if (!loaded.timelineModules) loaded.timelineModules = clone(window.SONATA_CONTENT.timelineModules);
    return loaded;
  }
  catch { return clone(window.SONATA_CONTENT); }
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  const indicator = document.querySelector("#save-indicator");
  indicator.classList.add("is-visible");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => indicator.classList.remove("is-visible"), 1100);
}

function getPath(path) {
  return path.split(".").reduce((value, part) => value?.[part], draft);
}

function setPath(path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  const target = parts.reduce((object, part) => object[part], draft);
  target[last] = value;
  saveDraft();
}

document.querySelectorAll("[data-path]").forEach((input) => {
  const value = getPath(input.dataset.path);
  if (input.type === "checkbox") input.checked = Boolean(value);
  else input.value = value ?? "";
  input.addEventListener("input", () => setPath(input.dataset.path, input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value));
});

document.querySelectorAll("[data-credit]").forEach((input) => {
  input.value = (draft.credits[input.dataset.credit] || []).join("\n");
  input.addEventListener("input", () => {
    draft.credits[input.dataset.credit] = input.value.split("\n").map((line) => line.trim()).filter(Boolean);
    saveDraft();
  });
});

document.querySelectorAll("[data-section]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-section]").forEach((item) => item.classList.toggle("is-current", item === button));
  document.querySelectorAll("[data-editor-section]").forEach((section) => section.classList.toggle("is-active", section.dataset.editorSection === button.dataset.section));
}));

function renderLocations() {
  const list = document.querySelector("#location-list");
  list.innerHTML = "";
  Object.entries(draft.locations).forEach(([id, location]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = location.name || "未命名地点";
    button.classList.toggle("is-current", id === activeLocation);
    button.addEventListener("click", () => { activeLocation = id; activeSceneIndex = 0; activeHotspot = 0; renderLocations(); });
    list.appendChild(button);
  });
  renderLocationEditor();
}

function renderLocationEditor() {
  const editor = document.querySelector("#location-editor");
  const location = draft.locations[activeLocation];
  if (!location) { editor.innerHTML = "<p>请先新增一个地点。</p>"; return; }
  const scene = location.scenes[activeSceneIndex] || location.scenes[0];
  activeSceneIndex = Math.max(0, location.scenes.indexOf(scene));
  editor.innerHTML = `
    <label>地点名称<input data-location-field="name" value="${escapeHtml(location.name || "")}"></label>
    <div class="scene-picker">${location.scenes.map((item, index) => `<button class="${index === activeSceneIndex ? "is-current" : ""}" data-scene-index="${index}" type="button">场景 ${index + 1}</button>`).join("")}<button id="add-scene" type="button" ${location.scenes.length >= 3 ? "disabled" : ""}>＋ 新增场景</button></div>
    <div class="form-grid">
      <label>场景标题<input data-scene-field="title" value="${escapeHtml(scene.title || "")}"></label>
      <label>场景图片文件名<input data-scene-field="artwork" value="${escapeHtml(scene.artwork || "")}" placeholder="assets/scene-01.jpg"></label>
    </div>
    <div class="hotspot-preview" id="hotspot-preview">${scene.hotspots.map((spot, index) => `<i class="preview-dot" data-dot="${index}" style="left:${spot.x}%;top:${spot.y}%" title="${escapeHtml(spot.title)}"></i>`).join("")}</div>
    <div class="card-head"><h3>调查点</h3><button id="add-hotspot" type="button">＋ 新增调查点</button></div>
    <div id="hotspot-editor"></div>
    <button class="remove-button" id="remove-scene" type="button" ${location.scenes.length === 1 ? "disabled" : ""}>删除当前场景</button>
    <button class="remove-button" id="remove-location" type="button">删除这个地点</button>`;
  editor.querySelectorAll("[data-location-field]").forEach((input) => input.addEventListener("input", () => {
    location[input.dataset.locationField] = input.value;
    saveDraft();
    if (input.dataset.locationField === "name") {
      const currentButton = document.querySelector("#location-list button.is-current");
      if (currentButton) currentButton.textContent = input.value || "未命名地点";
    }
  }));
  editor.querySelectorAll("[data-scene-field]").forEach((input) => input.addEventListener("input", () => { scene[input.dataset.sceneField] = input.value; saveDraft(); }));
  editor.querySelectorAll("[data-scene-index]").forEach((button) => button.addEventListener("click", () => { activeSceneIndex = Number(button.dataset.sceneIndex); activeHotspot = 0; renderLocationEditor(); }));
  editor.querySelector("#add-scene").addEventListener("click", () => {
    if (location.scenes.length >= 3) return;
    location.scenes.push({ id: `${activeLocation}-scene-${Date.now()}`, title: "新场景", artwork: "", placeholderTone: "archive", hotspots: [] });
    activeSceneIndex = location.scenes.length - 1; activeHotspot = 0; saveDraft(); renderLocationEditor();
  });
  editor.querySelector("#hotspot-preview").addEventListener("click", (event) => {
    if (!scene.hotspots.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const hotspot = scene.hotspots[activeHotspot] || scene.hotspots[0];
    hotspot.x = Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10;
    hotspot.y = Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10;
    saveDraft();
    renderLocationEditor();
  });
  editor.querySelector("#add-hotspot").addEventListener("click", () => {
    scene.hotspots.push({ id: `${activeLocation}-${Date.now()}`, x: 50, y: 50, size: 7, kind: "optional", title: "新调查点", text: "在此填写线索内容。" });
    activeHotspot = scene.hotspots.length - 1;
    saveDraft(); renderLocationEditor();
  });
  editor.querySelector("#remove-scene").addEventListener("click", () => {
    if (location.scenes.length === 1 || !confirm("确定删除当前场景及其全部调查点吗？")) return;
    location.scenes.splice(activeSceneIndex, 1); activeSceneIndex = 0; activeHotspot = 0; saveDraft(); renderLocationEditor();
  });
  editor.querySelector("#remove-location").addEventListener("click", () => {
    if (!confirm("确定删除这个地点及其全部调查点吗？")) return;
    delete draft.locations[activeLocation];
    activeLocation = Object.keys(draft.locations)[0] || null;
    saveDraft(); renderLocations();
  });
  renderHotspots();
}

function renderHotspots() {
  const location = draft.locations[activeLocation];
  const scene = location.scenes[activeSceneIndex];
  const container = document.querySelector("#hotspot-editor");
  container.innerHTML = "";
  scene.hotspots.forEach((spot, index) => {
    const row = document.createElement("div");
    row.className = "editor-card";
    row.innerHTML = `<div class="card-head"><h3>调查点 ${index + 1}</h3><button class="remove-button" type="button">删除</button></div><div class="hotspot-row"><label>标题<input data-field="title" value="${escapeHtml(spot.title || "")}"></label><label>类型<select data-field="kind"><option value="key" ${spot.kind === "key" ? "selected" : ""}>关键</option><option value="optional" ${spot.kind !== "key" ? "selected" : ""}>补充</option></select></label><label>大小<input data-field="size" type="number" min="2" max="20" value="${spot.size || 7}"></label></div><label>线索文字<textarea data-field="text">${escapeHtml(spot.text || "")}</textarea></label><p class="section-help">坐标：${spot.x}% / ${spot.y}%　点击上方画面重新放置</p>`;
    row.addEventListener("click", () => { activeHotspot = index; });
    row.querySelectorAll("[data-field]").forEach((input) => input.addEventListener("input", () => {
      spot[input.dataset.field] = input.type === "number" ? Number(input.value) : input.value;
      saveDraft();
    }));
    row.querySelector(".remove-button").addEventListener("click", () => { scene.hotspots.splice(index, 1); activeHotspot = 0; saveDraft(); renderLocationEditor(); });
    container.appendChild(row);
  });
}

function renderTimelineEditor() {
  const container = document.querySelector("#timeline-editor");
  container.innerHTML = "";
  draft.timelineModules.forEach((module, moduleIndex) => {
    const card = document.createElement("section");
    card.className = "timeline-module-editor";
    card.innerHTML = `<div class="card-head"><h3>小模块 ${moduleIndex + 1}</h3><button class="remove-button" data-remove-module type="button">删除模块</button></div><div class="form-grid"><label>模块名称<input data-module-field="title" value="${escapeHtml(module.title || "")}"></label><label>需要几条关键线索<input data-module-field="requiredKeyClues" type="number" min="0" value="${module.requiredKeyClues || 0}"></label><label>模块说明<textarea data-module-field="intro">${escapeHtml(module.intro || "")}</textarea></label></div><div class="card-head"><h3>事件卡</h3><button data-add-event type="button">＋ 新增事件卡</button></div><div class="module-events"></div>`;
    card.querySelectorAll("[data-module-field]").forEach((input) => input.addEventListener("input", () => { module[input.dataset.moduleField] = input.type === "number" ? Number(input.value) : input.value; saveDraft(); }));
    card.querySelector("[data-remove-module]").addEventListener("click", () => { if (!confirm("确定删除这个历史复原模块吗？")) return; draft.timelineModules.splice(moduleIndex, 1); saveDraft(); renderTimelineEditor(); });
    card.querySelector("[data-add-event]").addEventListener("click", () => { module.events.push({ id: `${module.id}-event-${Date.now()}`, title: "新事件", text: "在此填写事件说明。", order: module.events.length + 1 }); normalizeTimeline(); saveDraft(); renderTimelineEditor(); });
    const eventsContainer = card.querySelector(".module-events");
    module.events.forEach((item, eventIndex) => {
      const row = document.createElement("div");
      row.className = "timeline-edit-row";
      row.innerHTML = `<span>${eventIndex + 1}</span><input data-field="title" value="${escapeHtml(item.title || "")}" aria-label="事件标题"><textarea data-field="text" aria-label="事件说明">${escapeHtml(item.text || "")}</textarea><button class="remove-button" type="button">删除</button>`;
      row.querySelectorAll("[data-field]").forEach((input) => input.addEventListener("input", () => { item[input.dataset.field] = input.value; saveDraft(); }));
      row.querySelector("button").addEventListener("click", () => { module.events.splice(eventIndex, 1); normalizeTimeline(); saveDraft(); renderTimelineEditor(); });
      eventsContainer.appendChild(row);
    });
    container.appendChild(card);
  });
}

function normalizeTimeline() { draft.timelineModules.forEach((module) => module.events.forEach((item, index) => { item.order = index + 1; })); }

function renderHistoryEditor() {
  const container = document.querySelector("#history-editor");
  container.innerHTML = "";
  draft.history.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "history-edit-row";
    row.innerHTML = `<input data-field="title" value="${escapeHtml(item.title || "")}" aria-label="段落标题"><textarea data-field="text" aria-label="段落正文">${escapeHtml(item.text || "")}</textarea><button class="remove-button" type="button">删除</button>`;
    row.querySelectorAll("[data-field]").forEach((input) => input.addEventListener("input", () => { item[input.dataset.field] = input.value; saveDraft(); }));
    row.querySelector("button").addEventListener("click", () => { draft.history.splice(index, 1); saveDraft(); renderHistoryEditor(); });
    container.appendChild(row);
  });
}

function renderDreamEditor() {
  const container = document.querySelector("#dream-visual-editor");
  const form = activeDreamForm;
  const spots = draft.dream.hotspots[form] || (draft.dream.hotspots[form] = []);
  const light = draft.dream.lightPoint[form] || (draft.dream.lightPoint[form] = { x: 84, y: 84 });
  const artworkKey = form === "black" ? "blackArtwork" : "whiteArtwork";
  container.innerHTML = `
    <div class="dream-form-tabs"><button class="${form === "black" ? "is-current" : ""}" data-dream-form="black" type="button">黑底形态</button><button class="${form === "white" ? "is-current" : ""}" data-dream-form="white" type="button">白底形态</button></div>
    <div class="form-grid"><label>正式图片文件名<input id="dream-artwork-path" value="${escapeHtml(draft.dream[artworkKey] || "")}" placeholder="assets/dream-${form}.jpg"></label><label>只在本机预览图片<input id="dream-local-preview" type="file" accept="image/*"><small>图片不会被保存或上传，只用来帮助你定位。</small></label></div>
    <div class="dream-place-tools"><button class="${dreamPlacement === "hotspot" ? "is-current" : ""}" data-dream-place="hotspot" type="button">放置调查点</button><button class="${dreamPlacement === "light" ? "is-current" : ""}" data-dream-place="light" type="button">放置切换光点</button><button id="add-dream-hotspot" type="button" ${spots.length >= 2 ? "disabled" : ""}>＋ 新增调查点</button></div>
    <div class="dream-preview ${form === "white" ? "is-white" : ""}" id="dream-preview">
      ${spots.map((spot, index) => `<button class="dream-editor-dot ${index === activeDreamHotspot ? "is-current" : ""}" data-dream-dot="${index}" type="button" style="left:${spot.x}%;top:${spot.y}%" aria-label="拖动调查点 ${index + 1}"></button>`).join("")}
      <button class="dream-editor-light" data-dream-light type="button" style="left:${light.x}%;top:${light.y}%" aria-label="拖动切换光点"></button>
    </div>
    <p class="section-help">点击画面可以放置当前选择的点；也可以直接按住红色调查点或金色光点拖动。</p>
    <div class="dream-editor-cards">${spots.map((spot, index) => `<div class="editor-card"><div class="card-head"><h3>${form === "black" ? "黑底" : "白底"}调查点 ${index + 1}</h3><button class="remove-button" data-remove-dream="${index}" type="button">删除</button></div><label>标题<input data-dream-field="title" data-dream-index="${index}" value="${escapeHtml(spot.title || "")}"></label><label>线索文字<textarea data-dream-field="text" data-dream-index="${index}">${escapeHtml(spot.text || "")}</textarea></label><p class="section-help">坐标：${spot.x}% / ${spot.y}%</p></div>`).join("")}</div>`;

  const preview = container.querySelector("#dream-preview");
  const previewImage = dreamPreviewUrls[form] || draft.dream[artworkKey];
  if (previewImage) {
    preview.style.backgroundImage = `url("${previewImage}")`;
    preview.classList.add("has-image");
  }
  container.querySelectorAll("[data-dream-form]").forEach((button) => button.addEventListener("click", () => { activeDreamForm = button.dataset.dreamForm; activeDreamHotspot = 0; dreamPlacement = "hotspot"; renderDreamEditor(); }));
  container.querySelectorAll("[data-dream-place]").forEach((button) => button.addEventListener("click", () => { dreamPlacement = button.dataset.dreamPlace; renderDreamEditor(); }));
  container.querySelector("#dream-artwork-path").addEventListener("input", (event) => { draft.dream[artworkKey] = event.target.value; saveDraft(); });
  container.querySelector("#dream-local-preview").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (dreamPreviewUrls[form]) URL.revokeObjectURL(dreamPreviewUrls[form]);
    dreamPreviewUrls[form] = URL.createObjectURL(file);
    renderDreamEditor();
  });
  container.querySelector("#add-dream-hotspot").addEventListener("click", () => {
    if (spots.length >= 2) return;
    spots.push({ id: `dream-${form}-${Date.now()}`, x: 50, y: 50, title: "新梦境调查点", text: "在此填写梦境线索。" });
    activeDreamHotspot = spots.length - 1; dreamPlacement = "hotspot"; saveDraft(); renderDreamEditor();
  });
  container.querySelectorAll("[data-dream-field]").forEach((input) => input.addEventListener("input", () => { spots[Number(input.dataset.dreamIndex)][input.dataset.dreamField] = input.value; saveDraft(); }));
  container.querySelectorAll("[data-remove-dream]").forEach((button) => button.addEventListener("click", () => { spots.splice(Number(button.dataset.removeDream), 1); activeDreamHotspot = 0; saveDraft(); renderDreamEditor(); }));

  function placeDreamPoint(event, target) {
    const rect = preview.getBoundingClientRect();
    const point = target === "light" ? light : spots[activeDreamHotspot];
    if (!point) return;
    point.x = Math.max(0, Math.min(100, Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10));
    point.y = Math.max(0, Math.min(100, Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10));
    const element = target === "light" ? preview.querySelector("[data-dream-light]") : preview.querySelector(`[data-dream-dot="${activeDreamHotspot}"]`);
    if (element) { element.style.left = `${point.x}%`; element.style.top = `${point.y}%`; }
    saveDraft();
  }
  preview.addEventListener("pointerdown", (event) => {
    const dot = event.target.closest("[data-dream-dot]");
    const lightDot = event.target.closest("[data-dream-light]");
    if (dot) { activeDreamHotspot = Number(dot.dataset.dreamDot); dreamPlacement = "hotspot"; dreamDrag = "hotspot"; }
    else if (lightDot) { dreamPlacement = "light"; dreamDrag = "light"; }
    else { dreamDrag = dreamPlacement; }
    preview.setPointerCapture(event.pointerId);
    placeDreamPoint(event, dreamDrag);
  });
  preview.addEventListener("pointermove", (event) => { if (dreamDrag) placeDreamPoint(event, dreamDrag); });
  preview.addEventListener("pointerup", () => { dreamDrag = null; renderDreamEditor(); });
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }

document.querySelector("#add-location").addEventListener("click", () => {
  const id = `location-${Date.now()}`;
  draft.locations[id] = { name: "新地点", scenes: [{ id: `${id}-scene-1`, title: "新场景", artwork: "", placeholderTone: "archive", hotspots: [] }] };
  activeLocation = id; activeSceneIndex = 0; saveDraft(); renderLocations();
});
document.querySelector("#add-timeline-module").addEventListener("click", () => {
  const id = `module-${Date.now()}`;
  draft.timelineModules.push({ id, title: "新复原模块", intro: "在此填写这一小节需要整理的历史范围。", requiredKeyClues: draft.keyClueGoal, events: [
    { id: `${id}-event-1`, title: "第一件事", text: "在此填写事件说明。", order: 1 },
    { id: `${id}-event-2`, title: "第二件事", text: "在此填写事件说明。", order: 2 },
    { id: `${id}-event-3`, title: "第三件事", text: "在此填写事件说明。", order: 3 }
  ] });
  saveDraft(); renderTimelineEditor();
});
document.querySelector("#add-history").addEventListener("click", () => { draft.history.push({ title: "新段落", text: "在此填写复原后的历史正文。" }); saveDraft(); renderHistoryEditor(); });

document.querySelector("#export-button").addEventListener("click", () => {
  normalizeTimeline();
  const text = `window.SONATA_CONTENT = ${JSON.stringify(draft, null, 2)};\n`;
  const url = URL.createObjectURL(new Blob([text], { type: "text/javascript;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "content.js";
  link.click();
  URL.revokeObjectURL(url);
});
document.querySelector("#import-button").addEventListener("click", () => document.querySelector("#import-file").click());
document.querySelector("#import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const raw = await file.text();
    const json = raw.trim().startsWith("{") ? raw : raw.replace(/^\s*window\.SONATA_CONTENT\s*=\s*/, "").replace(/;\s*$/, "");
    draft = JSON.parse(json);
    activeLocation = Object.keys(draft.locations)[0] || null;
    saveDraft();
    location.reload();
  } catch { alert("这个文件无法识别。请选择此前生成的 content.js 或内容 JSON 文件。"); }
});

renderLocations();
renderTimelineEditor();
renderHistoryEditor();
renderDreamEditor();
