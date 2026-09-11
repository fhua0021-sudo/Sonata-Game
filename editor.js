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
const scenePreviewUrls = {};
const comicPreviewUrls = {};
let saveTimer = null;

function loadDraft() {
  try {
    const loaded = JSON.parse(localStorage.getItem(DRAFT_KEY)) || clone(window.SONATA_CONTENT);
    const defaultContent = window.SONATA_CONTENT;
    const previousSchemaVersion = Number(loaded.schemaVersion || 1);
    const usesLegacyMap = ["assets/weilan-empire-map.svg", "assets/weilan-empire-map.png"].includes(loaded.map?.artwork);
    loaded.schemaVersion = defaultContent.schemaVersion || 2;
    if (loaded.subtitle === "遗失的和弦") loaded.subtitle = defaultContent.subtitle;
    loaded.prologue = { ...clone(window.SONATA_CONTENT.prologue), ...(loaded.prologue || {}) };
    loaded.legend = { ...clone(window.SONATA_CONTENT.legend || {}), ...(loaded.legend || {}) };
    loaded.map = { ...clone(window.SONATA_CONTENT.map || { artwork: "assets/weilan-mapgen4-187.webp", shroudOpacity: 0.62, defaultRevealRadius: 18 }), ...(loaded.map || {}) };
    if (usesLegacyMap) loaded.map = clone(defaultContent.map);
    loaded.locations = { ...clone(defaultContent.locations || {}), ...(loaded.locations || {}) };
    if (usesLegacyMap) {
      Object.entries(defaultContent.locations || {}).forEach(([id, defaults]) => {
        if (!loaded.locations[id]) return;
        loaded.locations[id].mapX = defaults.mapX;
        loaded.locations[id].mapY = defaults.mapY;
        loaded.locations[id].mapRevealRadius = defaults.mapRevealRadius;
      });
    }
    Object.values(loaded.locations || {}).forEach((location, index) => {
      if (location.requiredKeyClues == null) location.requiredKeyClues = 0;
      if (location.mapX == null) location.mapX = 38 + (index % 3) * 16;
      if (location.mapY == null) location.mapY = 38 + Math.floor(index / 3) * 18;
      if (location.mapRevealRadius == null) location.mapRevealRadius = loaded.map.defaultRevealRadius || 18;
      if (!location.scenes) {
        location.scenes = [{ id: `scene-${Date.now()}`, title: location.sceneTitle || "新场景", artwork: location.artwork || "", placeholderTone: location.placeholderTone || "archive", hotspots: location.hotspots || [] }];
      }
      location.scenes.forEach((scene) => (scene.hotspots || []).forEach((spot) => {
        if (spot.artwork == null) spot.artwork = "";
        if (spot.fullText == null) spot.fullText = spot.text || "";
      }));
    });
    loaded.dream = { ...clone(defaultContent.dream || {}), ...(loaded.dream || {}) };
    if (!loaded.dream.hotspots) loaded.dream.hotspots = clone(window.SONATA_CONTENT.dream.hotspots);
    if (!loaded.dream.lightPoint) loaded.dream.lightPoint = clone(window.SONATA_CONTENT.dream.lightPoint);
    if (loaded.dream.unlockAtKeyClues == null) loaded.dream.unlockAtKeyClues = window.SONATA_CONTENT.dream.unlockAtKeyClues || Math.ceil(loaded.keyClueGoal / 2);
    if (loaded.dream.secondFormRequiredKeyClues == null) loaded.dream.secondFormRequiredKeyClues = window.SONATA_CONTENT.dream.secondFormRequiredKeyClues || loaded.keyClueGoal;
    Object.values(loaded.dream.hotspots || {}).flat().forEach((spot) => { if (spot.requiredKeyClues == null) spot.requiredKeyClues = loaded.dream.unlockAtKeyClues; });
    if (!loaded.rumorModules) loaded.rumorModules = clone(window.SONATA_CONTENT.rumorModules || []);
    const legendParagraphs = String(loaded.legend?.body || "").split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
    const defaultRumors = new Map((defaultContent.rumorModules || []).map((module) => [module.id, module]));
    loaded.rumorModules.forEach((module, index) => {
      if (module.legendExcerpt == null) module.legendExcerpt = defaultRumors.get(module.id)?.legendExcerpt || legendParagraphs[index] || "";
    });
    loaded.history ||= clone(defaultContent.history || []);
    loaded.credits = { ...clone(defaultContent.credits || {}), ...(loaded.credits || {}) };
    loaded.comics = { ...clone(defaultContent.comics || { title: "图像残页", pages: [] }), ...(loaded.comics || {}) };
    const loadedComicPages = new Map((loaded.comics.pages || []).map((page) => [page.id, page]));
    loaded.comics.pages = (defaultContent.comics?.pages || []).map((page) => ({ ...clone(page), ...(loadedComicPages.get(page.id) || {}) }));
    if (previousSchemaVersion < 2) {
      if (Number(loaded.keyClueGoal || 0) === 3) loaded.keyClueGoal = 5;
      const rupture = loaded.rumorModules.find((module) => module.id === "rupture");
      if (rupture && (rupture.evidenceIds || []).length === 1 && rupture.evidenceIds[0] === "theatre-score") {
        rupture.requiredKeyClues = 5;
        rupture.evidenceIds = ["theatre-score", "cemetery-route", "refuge-cache"];
      }
      if (Number(loaded.dream.secondFormRequiredKeyClues || 0) === 3) loaded.dream.secondFormRequiredKeyClues = 4;
    }
    delete loaded.timelineModules;
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

function renderFirstLocationSelect() {
  const select = document.querySelector("#prologue-first-location");
  if (!select) return;
  select.innerHTML = Object.entries(draft.locations).map(([id, location]) => `<option value="${escapeHtml(id)}" ${draft.prologue.firstLocation === id ? "selected" : ""}>${escapeHtml(location.name || "未命名地点")}</option>`).join("");
  if (!draft.locations[draft.prologue.firstLocation]) draft.prologue.firstLocation = Object.keys(draft.locations)[0] || "";
  select.value = draft.prologue.firstLocation;
  select.onchange = () => { draft.prologue.firstLocation = select.value; saveDraft(); };
}

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
  if (button.dataset.section === "timeline") renderTimelineEditor();
  if (button.dataset.section === "comics") renderComicsEditor();
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
  renderFirstLocationSelect();
  renderLocationEditor();
}

function renderLocationEditor() {
  const editor = document.querySelector("#location-editor");
  const location = draft.locations[activeLocation];
  if (!location) { editor.innerHTML = "<p>请先新增一个地点。</p>"; return; }
  const scene = location.scenes[activeSceneIndex] || location.scenes[0];
  activeSceneIndex = Math.max(0, location.scenes.indexOf(scene));
  const scenePreviewImage = scenePreviewUrls[scene.id] || scene.artwork || "";
  const mapArtwork = escapeHtml(draft.map?.artwork || "assets/weilan-mapgen4-187.webp");
  const mapDots = Object.entries(draft.locations).map(([id, item]) => `<button class="map-editor-dot ${id === activeLocation ? "is-current" : ""}" data-map-location="${escapeHtml(id)}" type="button" style="left:${Number(item.mapX ?? 50)}%;top:${Number(item.mapY ?? 50)}%" title="${escapeHtml(item.name || "未命名地点")}"><span>${escapeHtml(item.name || "未命名地点")}</span></button>`).join("");
  editor.innerHTML = `
    <div class="form-grid">
      <label>地点名称<input data-location-field="name" value="${escapeHtml(location.name || "")}"></label>
      <label>解锁所需关键线索<input data-location-field="requiredKeyClues" type="number" min="0" value="${location.requiredKeyClues || 0}"><small>填 0 表示开场即可进入；填 1 表示找到一条关键线索后解锁。</small></label>
      <label>地图横向位置<input data-location-field="mapX" type="number" min="0" max="100" step="0.1" value="${Number(location.mapX ?? 50)}"></label>
      <label>地图纵向位置<input data-location-field="mapY" type="number" min="0" max="100" step="0.1" value="${Number(location.mapY ?? 50)}"></label>
      <label>解封照亮范围<input data-location-field="mapRevealRadius" type="number" min="8" max="36" step="1" value="${Number(location.mapRevealRadius ?? draft.map?.defaultRevealRadius ?? 18)}"><small>数值越大，地点解锁时照亮的地图范围越广。</small></label>
    </div>
    <div class="map-placement-preview" id="map-location-preview" style="background-image:url('${mapArtwork}')">${mapDots}</div>
    <p class="section-help">点击地图可移动当前地点；也可以直接拖动高亮点。其他地点会同时显示，方便避免重叠。</p>
    <div class="scene-picker">${location.scenes.map((item, index) => `<button class="${index === activeSceneIndex ? "is-current" : ""}" data-scene-index="${index}" type="button">场景 ${index + 1}</button>`).join("")}<button id="add-scene" type="button" ${location.scenes.length >= 3 ? "disabled" : ""}>＋ 新增场景</button></div>
    <div class="form-grid">
      <label>场景标题<input data-scene-field="title" value="${escapeHtml(scene.title || "")}"></label>
      <label>场景图片文件名<input data-scene-field="artwork" value="${escapeHtml(scene.artwork || "")}" placeholder="assets/scenes/scene-01.jpg"></label>
      <label>只在本机预览图片<input id="scene-local-preview" type="file" accept="image/*"><small>图片不会保存或上传，只用来定位调查点。</small></label>
    </div>
    <div class="hotspot-preview ${scenePreviewImage ? "has-image" : ""}" id="hotspot-preview">${scene.hotspots.map((spot, index) => `<i class="preview-dot ${index === activeHotspot ? "is-current" : ""}" data-dot="${index}" style="left:${spot.x}%;top:${spot.y}%" title="${escapeHtml(spot.title)}"></i>`).join("")}</div>
    <div class="card-head"><h3>调查点</h3><button id="add-hotspot" type="button">＋ 新增调查点</button></div>
    <div id="hotspot-editor"></div>
    <button class="remove-button" id="remove-scene" type="button" ${location.scenes.length === 1 ? "disabled" : ""}>删除当前场景</button>
    <button class="remove-button" id="remove-location" type="button">删除这个地点</button>`;
  editor.querySelectorAll("[data-location-field]").forEach((input) => input.addEventListener("input", () => {
    location[input.dataset.locationField] = input.type === "number" ? Number(input.value) : input.value;
    saveDraft();
    if (input.dataset.locationField === "name") {
      const currentButton = document.querySelector("#location-list button.is-current");
      if (currentButton) currentButton.textContent = input.value || "未命名地点";
      renderFirstLocationSelect();
    }
    if (input.dataset.locationField === "mapX" || input.dataset.locationField === "mapY") {
      const dot = editor.querySelector(`[data-map-location="${activeLocation}"]`);
      if (dot) {
        dot.style.left = `${Number(location.mapX ?? 50)}%`;
        dot.style.top = `${Number(location.mapY ?? 50)}%`;
      }
    }
  }));
  const mapPreview = editor.querySelector("#map-location-preview");
  let draggingMapPoint = false;
  const placeMapPoint = (event) => {
    const rect = mapPreview.getBoundingClientRect();
    location.mapX = Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)) * 10) / 10;
    location.mapY = Math.round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)) * 10) / 10;
    const dot = mapPreview.querySelector(`[data-map-location="${activeLocation}"]`);
    if (dot) { dot.style.left = `${location.mapX}%`; dot.style.top = `${location.mapY}%`; }
    const xInput = editor.querySelector('[data-location-field="mapX"]');
    const yInput = editor.querySelector('[data-location-field="mapY"]');
    if (xInput) xInput.value = location.mapX;
    if (yInput) yInput.value = location.mapY;
    saveDraft();
  };
  mapPreview.addEventListener("pointerdown", (event) => {
    const targetDot = event.target.closest("[data-map-location]");
    if (targetDot && targetDot.dataset.mapLocation !== activeLocation) {
      activeLocation = targetDot.dataset.mapLocation;
      activeSceneIndex = 0;
      activeHotspot = 0;
      renderLocations();
      return;
    }
    draggingMapPoint = true;
    mapPreview.setPointerCapture(event.pointerId);
    placeMapPoint(event);
  });
  mapPreview.addEventListener("pointermove", (event) => { if (draggingMapPoint) placeMapPoint(event); });
  mapPreview.addEventListener("pointerup", (event) => {
    draggingMapPoint = false;
    if (mapPreview.hasPointerCapture(event.pointerId)) mapPreview.releasePointerCapture(event.pointerId);
  });
  const hotspotPreview = editor.querySelector("#hotspot-preview");
  if (scenePreviewImage) hotspotPreview.style.backgroundImage = `url("${scenePreviewImage}")`;
  editor.querySelectorAll("[data-scene-field]").forEach((input) => input.addEventListener("input", () => {
    scene[input.dataset.sceneField] = input.value;
    saveDraft();
    if (input.dataset.sceneField === "artwork" && !scenePreviewUrls[scene.id]) {
      hotspotPreview.style.backgroundImage = input.value ? `url("${input.value}")` : "";
      hotspotPreview.classList.toggle("has-image", Boolean(input.value));
    }
  }));
  editor.querySelector("#scene-local-preview").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (scenePreviewUrls[scene.id]) URL.revokeObjectURL(scenePreviewUrls[scene.id]);
    scenePreviewUrls[scene.id] = URL.createObjectURL(file);
    renderLocationEditor();
  });
  editor.querySelectorAll("[data-scene-index]").forEach((button) => button.addEventListener("click", () => { activeSceneIndex = Number(button.dataset.sceneIndex); activeHotspot = 0; renderLocationEditor(); }));
  editor.querySelector("#add-scene").addEventListener("click", () => {
    if (location.scenes.length >= 3) return;
    location.scenes.push({ id: `${activeLocation}-scene-${Date.now()}`, title: "新场景", artwork: "", placeholderTone: "archive", hotspots: [] });
    activeSceneIndex = location.scenes.length - 1; activeHotspot = 0; saveDraft(); renderLocationEditor();
  });
  hotspotPreview.addEventListener("click", (event) => {
    if (!scene.hotspots.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const hotspot = scene.hotspots[activeHotspot] || scene.hotspots[0];
    hotspot.x = Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10;
    hotspot.y = Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10;
    saveDraft();
    renderLocationEditor();
  });
  editor.querySelector("#add-hotspot").addEventListener("click", () => {
    scene.hotspots.push({ id: `${activeLocation}-${Date.now()}`, x: 50, y: 50, size: 7, kind: "optional", title: "新调查点", text: "在此填写调查簿中的简短摘要。", artwork: "", fullText: "在此填写点开后的完整正文。" });
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
    row.innerHTML = `<div class="card-head"><h3>调查点 ${index + 1}</h3><button class="remove-button" type="button">删除</button></div><div class="hotspot-row"><label>标题<input data-field="title" value="${escapeHtml(spot.title || "")}"></label><label>类型<select data-field="kind"><option value="key" ${spot.kind === "key" ? "selected" : ""}>关键</option><option value="optional" ${spot.kind !== "key" ? "selected" : ""}>补充</option></select></label><label>大小<input data-field="size" type="number" min="2" max="20" value="${spot.size || 7}"></label></div><label>调查簿简短摘要<textarea data-field="text">${escapeHtml(spot.text || "")}</textarea></label><label>完整记录配图文件名<input data-field="artwork" value="${escapeHtml(spot.artwork || "")}" placeholder="assets/clues/clue-01.jpg"></label><label>点开后的完整正文<textarea class="long-textarea" data-field="fullText">${escapeHtml(spot.fullText || spot.text || "")}</textarea></label><p class="section-help">坐标：${spot.x}% / ${spot.y}%　点击上方画面重新放置。配图与完整正文会显示在独立的调查记录纸页中。</p>`;
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
  const clues = Object.values(draft.locations).flatMap((location) => location.scenes.flatMap((scene) => scene.hotspots));
  draft.rumorModules.forEach((module, moduleIndex) => {
    const card = document.createElement("section");
    card.className = "timeline-module-editor";
    module.evidenceIds ||= [];
    card.innerHTML = `<div class="card-head"><h3>传闻 ${moduleIndex + 1}</h3><button class="remove-button" data-remove-module type="button">删除传闻</button></div><div class="form-grid"><label>模块名称<input data-module-field="title" value="${escapeHtml(module.title || "")}"></label><label class="full-width">传说正文中要点击的原句<textarea data-module-field="legendExcerpt" placeholder="从开场传说正文中复制一整句到这里">${escapeHtml(module.legendExcerpt || "")}</textarea><small>必须与传说正文完全一致。玩家点击这句话后，才会把它记为疑点。</small></label><label class="full-width">流传的错误说法<textarea data-module-field="rumor">${escapeHtml(module.rumor || "")}</textarea></label><label class="full-width">成功后显示的更正结论<textarea data-module-field="correction">${escapeHtml(module.correction || "")}</textarea></label></div><div class="card-head"><h3>能够反驳它的证据</h3></div><div class="evidence-picker">${clues.map((clue) => `<label><input type="checkbox" data-evidence-id="${escapeHtml(clue.id)}" ${module.evidenceIds.includes(clue.id) ? "checked" : ""}><span><b>${escapeHtml(clue.title || "未命名调查点")}</b><small>${escapeHtml(clue.id)}</small></span></label>`).join("") || "<p class=\"section-help\">请先在地点中新增调查点。</p>"}</div>`;
    card.querySelectorAll("[data-module-field]").forEach((input) => input.addEventListener("input", () => { module[input.dataset.moduleField] = input.type === "number" ? Number(input.value) : input.value; saveDraft(); }));
    card.querySelector("[data-remove-module]").addEventListener("click", () => { if (!confirm("确定删除这条传闻吗？")) return; draft.rumorModules.splice(moduleIndex, 1); saveDraft(); renderTimelineEditor(); });
    card.querySelectorAll("[data-evidence-id]").forEach((input) => input.addEventListener("change", () => {
      module.evidenceIds = [...card.querySelectorAll("[data-evidence-id]:checked")].map((item) => item.dataset.evidenceId);
      saveDraft();
    }));
    container.appendChild(card);
  });
}

function comicUnlockOptions() {
  const options = [{ value: "always:", label: "开场即解锁" }];
  for (let count = 1; count <= Number(draft.keyClueGoal || 1); count += 1) {
    options.push({ value: `key:${count}`, label: `收集到 ${count} 条关键线索` });
  }
  (draft.rumorModules || []).forEach((module) => options.push({ value: `rumor:${module.id}`, label: `更正传言：${module.title || module.id}` }));
  Object.entries(draft.locations || {}).forEach(([id, location]) => options.push({ value: `location:${id}`, label: `完成地点：${location.name || id}` }));
  Object.values(draft.dream?.hotspots || {}).flat().forEach((spot) => options.push({ value: `dream:${spot.id}`, label: `发现梦境线索：${spot.title || spot.id}` }));
  return options;
}

function comicUnlockValue(page) {
  const unlock = page.unlock || { type: "always" };
  if (unlock.type === "key") return `key:${unlock.count || unlock.id || 1}`;
  return `${unlock.type || "always"}:${unlock.id || ""}`;
}

function renderComicsEditor() {
  const container = document.querySelector("#comics-editor");
  if (!container) return;
  draft.comics ||= { title: "图像残页", pages: [] };
  const options = comicUnlockOptions();
  container.innerHTML = `<label class="comic-title-field">栏目名称<input id="comic-section-title" value="${escapeHtml(draft.comics.title || "图像残页")}"></label><div class="comic-editor-grid"></div>`;
  container.querySelector("#comic-section-title").addEventListener("input", (event) => { draft.comics.title = event.target.value; saveDraft(); });
  const grid = container.querySelector(".comic-editor-grid");
  (draft.comics.pages || []).forEach((page, index) => {
    const card = document.createElement("section");
    const previewUrl = comicPreviewUrls[page.id] || page.artwork || "";
    card.className = "comic-editor-card";
    card.innerHTML = `
      <div class="card-head"><h3>第 ${index + 1} 页</h3><span>${escapeHtml(page.id)}</span></div>
      <div class="comic-editor-preview ${previewUrl ? "has-image" : ""}" data-comic-preview>${previewUrl ? `<img src="${escapeHtml(previewUrl)}" alt="第 ${index + 1} 页本机预览">` : `<span>COMIC PAGE ${String(index + 1).padStart(2, "0")}</span><b>尚未选择预览图片</b>`}</div>
      <div class="form-grid">
        <label>页标题<input data-comic-field="title" value="${escapeHtml(page.title || "")}"></label>
        <label>正式图片文件名<input data-comic-field="artwork" value="${escapeHtml(page.artwork || "")}" placeholder="assets/comics/page-${index + 1}.jpg"></label>
        <label>解锁时机<select data-comic-unlock>${options.map((option) => `<option value="${escapeHtml(option.value)}" ${comicUnlockValue(page) === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label>
        <label>只在本机预览<input data-comic-local type="file" accept="image/*"><small>不会保存或上传，只用于确认版面。</small></label>
        <label class="full-width">页下说明／小片段<textarea data-comic-field="caption">${escapeHtml(page.caption || "")}</textarea></label>
      </div>`;
    card.querySelectorAll("[data-comic-field]").forEach((input) => input.addEventListener("input", () => { page[input.dataset.comicField] = input.value; saveDraft(); }));
    card.querySelector("[data-comic-unlock]").addEventListener("change", (event) => {
      const [type, id] = event.target.value.split(":");
      page.unlock = type === "key" ? { type, count: Number(id) } : type === "always" ? { type } : { type, id };
      saveDraft();
    });
    card.querySelector("[data-comic-local]").addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      if (comicPreviewUrls[page.id]) URL.revokeObjectURL(comicPreviewUrls[page.id]);
      comicPreviewUrls[page.id] = URL.createObjectURL(file);
      renderComicsEditor();
    });
    grid.appendChild(card);
  });
}

function normalizeTimeline() {}

function renderHistoryEditor() {
  const container = document.querySelector("#history-editor");
  container.innerHTML = "";
  draft.history.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "history-edit-row";
    row.innerHTML = `<div class="history-meta-fields"><input data-field="title" value="${escapeHtml(item.title || "")}" aria-label="段落标题"><input data-field="artwork" value="${escapeHtml(item.artwork || "")}" placeholder="可选：assets/history-01.jpg" aria-label="段落配图文件名"></div><textarea data-field="text" aria-label="段落正文">${escapeHtml(item.text || "")}</textarea><button class="remove-button" type="button">删除</button>`;
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
    <div class="dream-editor-cards">${spots.map((spot, index) => `<div class="editor-card"><div class="card-head"><h3>${form === "black" ? "黑底" : "白底"}调查点 ${index + 1}</h3><button class="remove-button" data-remove-dream="${index}" type="button">删除</button></div><div class="form-grid"><label>标题<input data-dream-field="title" data-dream-index="${index}" value="${escapeHtml(spot.title || "")}"></label><label>现实中达到几条关键线索后出现<input data-dream-field="requiredKeyClues" data-dream-index="${index}" type="number" min="1" value="${spot.requiredKeyClues || draft.dream.unlockAtKeyClues}"></label></div><label>线索文字<textarea data-dream-field="text" data-dream-index="${index}">${escapeHtml(spot.text || "")}</textarea></label><p class="section-help">坐标：${spot.x}% / ${spot.y}%</p></div>`).join("")}</div>`;

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
    spots.push({ id: `dream-${form}-${Date.now()}`, x: 50, y: 50, requiredKeyClues: draft.dream.unlockAtKeyClues, title: "新梦境调查点", text: "在此填写梦境线索。" });
    activeDreamHotspot = spots.length - 1; dreamPlacement = "hotspot"; saveDraft(); renderDreamEditor();
  });
  container.querySelectorAll("[data-dream-field]").forEach((input) => input.addEventListener("input", () => { spots[Number(input.dataset.dreamIndex)][input.dataset.dreamField] = input.type === "number" ? Number(input.value) : input.value; saveDraft(); }));
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

const protectorFile = document.querySelector("#protector-file");
const protectorText = document.querySelector("#protector-text");
const protectorOpacity = document.querySelector("#protector-opacity");
const protectorOpacityValue = document.querySelector("#protector-opacity-value");
const protectorClearFile = document.querySelector("#protector-clear-file");
const protectorSlash = document.querySelector("#protector-slash");
const protectorSlashValue = document.querySelector("#protector-slash-value");
const protectorSlashWidth = document.querySelector("#protector-slash-width");
const protectorSlashWidthValue = document.querySelector("#protector-slash-width-value");
const protectorSlashSpacing = document.querySelector("#protector-slash-spacing");
const protectorSlashSpacingValue = document.querySelector("#protector-slash-spacing-value");
const protectorSlashGray = document.querySelector("#protector-slash-gray");
const protectorSlashGrayValue = document.querySelector("#protector-slash-gray-value");
const protectorSafeEnabled = document.querySelector("#protector-safe-enabled");
const protectorSafeSize = document.querySelector("#protector-safe-size");
const protectorSafeSizeValue = document.querySelector("#protector-safe-size-value");
const protectorTexture = document.querySelector("#protector-texture");
const protectorTextureValue = document.querySelector("#protector-texture-value");
const protectorMaxEdge = document.querySelector("#protector-max-edge");
const protectorCanvas = document.querySelector("#protector-canvas");
const protectorCanvasStage = document.querySelector("#protector-canvas-stage");
const protectorSafeZone = document.querySelector("#protector-safe-zone");
const protectorDownload = document.querySelector("#protector-download");
const protectorStatus = document.querySelector("#protector-status");
const protectorEmpty = document.querySelector("#protector-empty");
const protectorContext = protectorCanvas?.getContext("2d");
let protectorImage = null;
let protectorObjectUrl = "";
let protectorSourceName = "";
let protectorSafeDrag = false;
const protectorSafeArea = { x: 0.5, y: 0.34, size: 0.25 };

function protectedFilename(filename) {
  const base = String(filename || "image").replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-").trim() || "image";
  return `${base}-watermarked.webp`;
}

function seededRandomFactory() {
  let seed = 0x51f15e;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function drawFineGrain(context, width, height, strength) {
  if (strength <= 0) return;
  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;
  const random = seededRandomFactory();
  const amplitude = Math.max(1, Math.round(strength * 58));
  for (let index = 0; index < data.length; index += 4) {
    const delta = Math.round((random() - 0.5) * amplitude * 2);
    data[index] = Math.max(0, Math.min(255, data[index] + delta));
    data[index + 1] = Math.max(0, Math.min(255, data[index + 1] + delta));
    data[index + 2] = Math.max(0, Math.min(255, data[index + 2] + delta));
  }
  context.putImageData(pixels, 0, 0);
}

function drawDiagonalHatch(context, width, height, strength, widthSetting, spacingSetting, graySetting) {
  if (strength <= 0) return;
  const shortest = Math.min(width, height);
  const previewScale = shortest / 740;
  const spacing = Math.max(5, spacingSetting * previewScale);
  const lineWidth = Math.max(1, widthSetting * previewScale);
  const gray = Math.max(100, Math.min(220, Math.round(graySetting)));
  const first = -height - spacing;
  const last = width + spacing;

  context.save();
  context.beginPath();
  for (let x = first; x <= last; x += spacing) {
    context.moveTo(x, height + spacing);
    context.lineTo(x + height + spacing * 2, -spacing);
  }
  context.lineWidth = lineWidth;
  context.globalAlpha = Math.max(0, Math.min(0.1, strength));
  context.strokeStyle = `rgb(${gray}, ${gray}, ${gray})`;
  context.stroke();
  context.restore();
}

function drawCornerWatermark(context, width, height, text, opacity) {
  const shortest = Math.min(width, height);
  const padding = Math.max(18, shortest * 0.026);
  let fontSize = Math.max(16, Math.round(shortest * 0.023));
  context.save();
  context.font = `500 ${fontSize}px "Songti SC","Noto Serif SC",serif`;
  const maxWidth = width * 0.48;
  const measured = context.measureText(text).width;
  if (measured > maxWidth) {
    fontSize = Math.max(13, Math.floor(fontSize * maxWidth / measured));
    context.font = `500 ${fontSize}px "Songti SC","Noto Serif SC",serif`;
  }
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.lineWidth = Math.max(1, fontSize * 0.09);
  context.globalAlpha = Math.min(0.42, opacity * 0.72);
  context.strokeStyle = "#2c2723";
  context.strokeText(text, width - padding, height - padding);
  context.globalAlpha = opacity;
  context.fillStyle = "#fff9ed";
  context.fillText(text, width - padding, height - padding);
  context.restore();
}

function updateSafeZoneGuide(width = protectorCanvas.width, height = protectorCanvas.height) {
  const enabled = Boolean(protectorSafeEnabled?.checked && protectorImage);
  protectorSafeZone.hidden = !enabled;
  protectorSafeSizeValue.textContent = `${Math.round(protectorSafeArea.size * 100)}%`;
  if (!enabled || !width || !height) return;
  const diameterPercent = (protectorSafeArea.size * Math.min(width, height) / width) * 100;
  protectorSafeZone.style.left = `${protectorSafeArea.x * 100}%`;
  protectorSafeZone.style.top = `${protectorSafeArea.y * 100}%`;
  protectorSafeZone.style.width = `${diameterPercent}%`;
}

function drawProtectedImage() {
  if (!protectorImage || !protectorContext) return;
  const requestedEdge = Math.max(800, Math.min(2400, Number(protectorMaxEdge.value) || 1800));
  const scale = Math.min(1, requestedEdge / Math.max(protectorImage.naturalWidth, protectorImage.naturalHeight));
  const width = Math.max(1, Math.round(protectorImage.naturalWidth * scale));
  const height = Math.max(1, Math.round(protectorImage.naturalHeight * scale));
  protectorCanvas.width = width;
  protectorCanvas.height = height;
  protectorCanvasStage.style.aspectRatio = `${width} / ${height}`;
  protectorContext.clearRect(0, 0, width, height);
  protectorContext.drawImage(protectorImage, 0, 0, width, height);

  const overlay = document.createElement("canvas");
  overlay.width = width;
  overlay.height = height;
  const overlayContext = overlay.getContext("2d");
  const label = protectorText.value.trim() || "© 《琴》· 仅供阅览";
  const opacity = Math.max(0.08, Math.min(0.32, Number(protectorOpacity.value) / 100));
  const slashStrength = Math.max(0, Math.min(0.1, Number(protectorSlash.value) / 100));
  const slashWidth = Math.max(2, Math.min(8, Number(protectorSlashWidth.value) || 5));
  const slashSpacing = Math.max(12, Math.min(32, Number(protectorSlashSpacing.value) || 20));
  const slashGray = Math.max(100, Math.min(220, Number(protectorSlashGray.value) || 175));
  drawDiagonalHatch(overlayContext, width, height, slashStrength, slashWidth, slashSpacing, slashGray);
  drawCornerWatermark(overlayContext, width, height, label, opacity);

  if (protectorSafeEnabled.checked) {
    overlayContext.globalCompositeOperation = "destination-out";
    const centerX = protectorSafeArea.x * width;
    const centerY = protectorSafeArea.y * height;
    const radius = protectorSafeArea.size * Math.min(width, height) / 2;
    const fade = Math.max(5, radius * 0.12);
    const clearing = overlayContext.createRadialGradient(centerX, centerY, Math.max(0, radius - fade), centerX, centerY, radius + fade);
    clearing.addColorStop(0, "rgba(0,0,0,1)");
    clearing.addColorStop(0.72, "rgba(0,0,0,1)");
    clearing.addColorStop(1, "rgba(0,0,0,0)");
    overlayContext.fillStyle = clearing;
    overlayContext.fillRect(centerX - radius - fade, centerY - radius - fade, (radius + fade) * 2, (radius + fade) * 2);
  }

  protectorContext.drawImage(overlay, 0, 0);
  const textureStrength = Math.max(0, Math.min(0.1, Number(protectorTexture.value) / 100));
  drawFineGrain(protectorContext, width, height, textureStrength);

  protectorEmpty.hidden = true;
  protectorCanvasStage.hidden = false;
  protectorDownload.disabled = false;
  protectorClearFile.hidden = false;
  protectorOpacityValue.textContent = `${Math.round(opacity * 100)}%`;
  protectorSlashValue.textContent = `${Math.round(slashStrength * 100)}%`;
  protectorSlashWidthValue.textContent = String(slashWidth);
  protectorSlashSpacingValue.textContent = String(Math.round(slashSpacing));
  protectorSlashGrayValue.textContent = String(Math.round(slashGray));
  protectorTextureValue.textContent = `${Math.round(textureStrength * 100)}%`;
  updateSafeZoneGuide(width, height);
  protectorStatus.textContent = `副本尺寸：${width} × ${height}。全图为细颗粒与浅灰斜纹，文字水印位于右下角。`;
}

function openProtectorSection() {
  document.querySelectorAll("[data-section]").forEach((item) => item.classList.toggle("is-current", item.dataset.section === "protector"));
  document.querySelectorAll("[data-editor-section]").forEach((section) => section.classList.toggle("is-active", section.dataset.editorSection === "protector"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearProtectorFile() {
  if (protectorObjectUrl) URL.revokeObjectURL(protectorObjectUrl);
  protectorObjectUrl = "";
  protectorSourceName = "";
  protectorImage = null;
  protectorFile.value = "";
  protectorCanvas.width = 1;
  protectorCanvas.height = 1;
  protectorCanvasStage.hidden = true;
  protectorSafeZone.hidden = true;
  protectorEmpty.hidden = false;
  protectorDownload.disabled = true;
  protectorClearFile.hidden = true;
  protectorStatus.textContent = "已清除本地原图。它不会进入生成的更新文件。";
}

protectorClearFile?.addEventListener("click", clearProtectorFile);

protectorFile?.addEventListener("change", () => {
  const file = protectorFile.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    protectorStatus.textContent = "请选择 PNG、JPG 或 WebP 图片。";
    return;
  }
  if (protectorObjectUrl) URL.revokeObjectURL(protectorObjectUrl);
  protectorObjectUrl = URL.createObjectURL(file);
  protectorSourceName = file.name;
  const image = new Image();
  image.onload = () => {
    protectorImage = image;
    drawProtectedImage();
  };
  image.onerror = () => {
    protectorStatus.textContent = "这张图片无法读取，请换一张图片重试。";
  };
  image.src = protectorObjectUrl;
});

[protectorText, protectorOpacity, protectorSlash, protectorSlashWidth, protectorSlashSpacing, protectorSlashGray, protectorSafeSize, protectorTexture, protectorMaxEdge].forEach((input) => input?.addEventListener("input", () => {
  if (input === protectorSafeSize) protectorSafeArea.size = Number(protectorSafeSize.value) / 100;
  drawProtectedImage();
}));
protectorSafeEnabled?.addEventListener("change", drawProtectedImage);

function moveSafeArea(event) {
  if (!protectorImage) return;
  const rect = protectorCanvasStage.getBoundingClientRect();
  protectorSafeArea.x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  protectorSafeArea.y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  updateSafeZoneGuide();
}

protectorSafeZone?.addEventListener("pointerdown", (event) => {
  protectorSafeDrag = true;
  protectorSafeZone.setPointerCapture(event.pointerId);
  moveSafeArea(event);
});
protectorSafeZone?.addEventListener("pointermove", (event) => {
  if (protectorSafeDrag) moveSafeArea(event);
});
protectorSafeZone?.addEventListener("pointerup", (event) => {
  protectorSafeDrag = false;
  protectorSafeZone.releasePointerCapture(event.pointerId);
  drawProtectedImage();
});
protectorCanvasStage?.addEventListener("click", (event) => {
  if (!protectorImage || event.target === protectorSafeZone || event.target.closest("#protector-safe-zone")) return;
  moveSafeArea(event);
  drawProtectedImage();
});

protectorDownload?.addEventListener("click", () => {
  if (!protectorImage) return;
  drawProtectedImage();
  protectorCanvas.toBlob((blob) => {
    if (!blob) {
      protectorStatus.textContent = "生成副本失败，请重新选择图片。";
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = protectedFilename(protectorSourceName);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    protectorStatus.textContent = `已生成 ${link.download}。请只上传这个带水印副本。`;
  }, "image/webp", 0.88);
});

function decorateArtworkInputs() {
  const selector = [
    '[data-path$=".artwork"]',
    '[data-path$="Artwork"]',
    '[data-path="map.artwork"]',
    '[data-scene-field="artwork"]',
    '[data-field="artwork"]',
    '[data-comic-field="artwork"]',
    '#dream-artwork-path'
  ].join(",");
  document.querySelectorAll(selector).forEach((input) => {
    const label = input.closest("label");
    if (!label || label.querySelector(".protect-image-shortcut")) return;
    const shortcut = document.createElement("button");
    shortcut.type = "button";
    shortcut.className = "protect-image-shortcut";
    shortcut.textContent = "上传前先生成带水印副本";
    shortcut.addEventListener("click", openProtectorSection);
    label.appendChild(shortcut);
  });
}

const artworkObserver = new MutationObserver(decorateArtworkInputs);
artworkObserver.observe(document.querySelector(".editor-main"), { childList: true, subtree: true });
decorateArtworkInputs();

document.querySelector("#add-location").addEventListener("click", () => {
  const id = `location-${Date.now()}`;
  draft.locations[id] = { name: "新地点", requiredKeyClues: 0, mapX: 50, mapY: 50, mapRevealRadius: draft.map?.defaultRevealRadius || 18, scenes: [{ id: `${id}-scene-1`, title: "新场景", artwork: "", placeholderTone: "archive", hotspots: [] }] };
  activeLocation = id; activeSceneIndex = 0; saveDraft(); renderLocations();
});
document.querySelector("#add-timeline-module").addEventListener("click", () => {
  const id = `module-${Date.now()}`;
  draft.rumorModules.push({ id, title: "新传闻", legendExcerpt: "", rumor: "在此填写流传的错误说法。", correction: "在此填写更正后的结论。", requiredKeyClues: draft.keyClueGoal, evidenceIds: [] });
  saveDraft(); renderTimelineEditor();
});
document.querySelector("#add-history").addEventListener("click", () => { draft.history.push({ title: "新段落", artwork: "", text: "在此填写复原后的完整故事正文。" }); saveDraft(); renderHistoryEditor(); });

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
renderComicsEditor();
