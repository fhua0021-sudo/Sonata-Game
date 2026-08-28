const CONTENT = (() => {
  if (new URLSearchParams(window.location.search).has("editor-preview")) {
    try { return JSON.parse(localStorage.getItem("sonata-content-draft-v1")) || window.SONATA_CONTENT; }
    catch { return window.SONATA_CONTENT; }
  }
  return window.SONATA_CONTENT;
})();
const SAVE_KEY = "sonata-game-progress-v1";

const screens = [...document.querySelectorAll(".screen")];
const toast = document.querySelector("#toast");
const toastMessage = document.querySelector("#toast-message");
const toastAction = document.querySelector("#toast-action");
const soundToggle = document.querySelector("#sound-toggle");
const settingsSound = document.querySelector("#settings-sound");
const settingsMotion = document.querySelector("#settings-motion");
const sceneLayer = document.querySelector("#scene-layer");
const sceneArt = document.querySelector("#scene-art");
const scenePlaceholder = document.querySelector("#scene-placeholder");
const hotspotLayer = document.querySelector("#hotspot-layer");
const clueCard = document.querySelector("#clue-card");
const quillCursor = document.querySelector("#quill-cursor");
const batonCursor = document.querySelector("#baton-cursor");
const panels = [...document.querySelectorAll(".panel-layer")];

let audioContext = null;
let activeOscillator = null;
let pendingCueTimer = null;
let toastTimer = null;
let currentLocation = null;
let currentSceneIndex = 0;
let zoom = 1;
let pan = { x: 0, y: 0 };
let dragging = null;
let timelineOrders = {};
let activeTimelineModuleId = null;

const defaultState = {
  sound: true,
  reduceMotion: false,
  foundClues: [],
  timelineSolved: false,
  timelineSolvedModules: [],
  dreamVisited: false,
  dreamHotspotFound: false,
  dreamFoundForms: [],
  dreamFoundHotspots: [],
  dreamForm: CONTENT.dream.initialForm || "black",
  introComplete: false,
  investigationComplete: false
};

let state = loadState();

function loadState() {
  try {
    const loaded = { ...defaultState, ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") };
    if (loaded.timelineSolved && !loaded.timelineSolvedModules.length) loaded.timelineSolvedModules = getTimelineModules().map((module) => module.id);
    return loaded;
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  state.timelineSolved = areAllModulesSolved();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  updateProgressUI();
}

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle("is-active", screen.id === id));
}

function showToast(message, actionLabel = "", actionHandler = null) {
  window.clearTimeout(toastTimer);
  toastMessage.textContent = message;
  toastAction.hidden = !actionLabel;
  toastAction.textContent = actionLabel;
  toastAction.onclick = actionHandler ? () => { toast.classList.remove("is-visible"); actionHandler(); } : null;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), actionLabel ? 6200 : 2500);
}

function ensureAudio() {
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioContext = new AudioContext();
  }
  if (audioContext?.state === "suspended") audioContext.resume();
}

function playInkScratch(duration = 0.075, volume = 0.024) {
  if (!state.sound) return;
  ensureAudio();
  if (!audioContext) return;
  const now = audioContext.currentTime;
  const frameCount = Math.max(1, Math.floor(audioContext.sampleRate * duration));
  const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
  const samples = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < frameCount; index += 1) {
    const envelope = Math.sin((index / frameCount) * Math.PI);
    last = last * 0.28 + (Math.random() * 2 - 1) * 0.72;
    samples[index] = last * envelope;
  }
  const source = audioContext.createBufferSource();
  const highpass = audioContext.createBiquadFilter();
  const bandpass = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(520, now);
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(1850, now);
  bandpass.frequency.linearRampToValueAtTime(2350, now + duration);
  bandpass.Q.setValueAtTime(0.72, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.009);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(highpass).connect(bandpass).connect(gain).connect(audioContext.destination);
  source.start(now);
  source.stop(now + duration + 0.01);
}

function stopActiveTone() {
  window.clearTimeout(pendingCueTimer);
  pendingCueTimer = null;
  if (!activeOscillator) return;
  try { activeOscillator.stop(); } catch {}
  activeOscillator = null;
}

function playTone(frequency, duration = 0.11, volume = 0.045, bend = 1.006) {
  if (!state.sound) return;
  ensureAudio();
  if (!audioContext) return;
  if (activeOscillator) {
    try { activeOscillator.stop(); } catch {}
  }
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const real = new Float32Array([0, 0, 0, 0, 0, 0]);
  const imag = new Float32Array([0, 1, 0.46, 0.24, 0.12, 0.055]);
  oscillator.setPeriodicWave(audioContext.createPeriodicWave(real, imag, { disableNormalization: false }));
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * bend, audioContext.currentTime + duration * 0.42);
  oscillator.frequency.exponentialRampToValueAtTime(frequency, audioContext.currentTime + duration);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1450, audioContext.currentTime);
  filter.Q.setValueAtTime(0.8, audioContext.currentTime);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + 0.018);
  gain.gain.exponentialRampToValueAtTime(volume * 0.62, audioContext.currentTime + duration * 0.46);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(filter).connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + 0.02);
  activeOscillator = oscillator;
  oscillator.addEventListener("ended", () => { if (activeOscillator === oscillator) activeOscillator = null; });
}

function playPizzicato(frequency, volume = 0.032) {
  if (!state.sound) return;
  ensureAudio();
  if (!audioContext) return;
  if (activeOscillator) {
    try { activeOscillator.stop(); } catch {}
  }
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const real = new Float32Array([0, 0, 0, 0, 0, 0, 0]);
  const imag = new Float32Array([0, 1, 0.72, 0.42, 0.24, 0.12, 0.05]);
  oscillator.setPeriodicWave(audioContext.createPeriodicWave(real, imag));
  oscillator.frequency.setValueAtTime(frequency * 1.008, now);
  oscillator.frequency.exponentialRampToValueAtTime(frequency, now + 0.045);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2400, now);
  filter.frequency.exponentialRampToValueAtTime(900, now + 0.17);
  filter.Q.setValueAtTime(0.65, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(volume * 0.35, now + 0.055);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  oscillator.connect(filter).connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.2);
  activeOscillator = oscillator;
  oscillator.addEventListener("ended", () => { if (activeOscillator === oscillator) activeOscillator = null; });
}

function playHoverCue(kind) {
  stopActiveTone();
  playPizzicato(kind === "key" ? 659.25 : 523.25, kind === "key" ? 0.03 : 0.026);
}

function playConfirmCue() {
  playInkScratch(0.09, 0.03);
}

function playTimelineSuccessCue() {
  stopActiveTone();
  playTone(523.25, 0.09, 0.028, 1.002);
  window.setTimeout(() => playTone(659.25, 0.13, 0.03, 1.002), 92);
}

function renderPrologue() {
  const prologue = CONTENT.prologue || {};
  const sender = prologue.sender || "音乐史系导师";
  const subject = prologue.subject || "关于你提交的研究申请";
  document.querySelector("#mail-summary-sender").textContent = sender;
  document.querySelector("#mail-summary-subject").textContent = subject;
  document.querySelector("#mail-sender").textContent = sender;
  document.querySelector("#mail-subject").textContent = subject;
  document.querySelector("#mail-term").textContent = prologue.term || "秋季学期 · 独立研究许可";
  document.querySelector("#mail-signature").textContent = prologue.signature || sender;
  const paragraphs = String(prologue.body || "你的研究申请已经通过。请从中央档案馆开始调查。").split(/\n\s*\n/).filter(Boolean);
  document.querySelector("#mail-body").innerHTML = paragraphs.map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`).join("");
}

function resetMailView() {
  document.querySelector("#mail-inbox").classList.remove("is-read");
  document.querySelector("#mentor-letter").classList.remove("is-open");
  document.querySelector("#mentor-letter").setAttribute("aria-hidden", "true");
}

function openPanel(id) {
  sceneLayer.classList.remove("is-open");
  sceneLayer.setAttribute("aria-hidden", "true");
  document.body.classList.toggle("custom-cursor-active", id === "dream-panel");
  panels.forEach((panel) => {
    const open = panel.id === id;
    panel.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", String(!open));
  });
  if (id === "notebook-panel") renderNotebook("records");
  if (id === "timeline-panel") renderTimeline();
  if (id === "dream-panel") renderDream();
  if (id === "history-panel") renderHistory();
}

function closePanels() {
  panels.forEach((panel) => {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
  });
  document.body.classList.remove("custom-cursor-active");
}

function getAllClues() {
  return Object.entries(CONTENT.locations).flatMap(([locationId, location]) =>
    getScenes(location).flatMap((scene) => scene.hotspots.map((clue) => ({ ...clue, locationId, locationName: location.name, sceneTitle: scene.title })))
  );
}

function getScenes(location) {
  return location.scenes || [{ id: `${location.name}-scene`, title: location.sceneTitle, artwork: location.artwork, placeholderTone: location.placeholderTone, hotspots: location.hotspots || [] }];
}

function getTimelineModules() {
  if (CONTENT.timelineModules?.length) return CONTENT.timelineModules;
  return [{ id: "history", title: "历史复原", intro: "整理关键事件的先后顺序。", requiredKeyClues: CONTENT.keyClueGoal, events: CONTENT.timeline || [] }];
}

function isModuleUnlocked(module) { return getKeyCount() >= (module.requiredKeyClues || 0); }
function isModuleSolved(moduleId) { return state.timelineSolvedModules.includes(moduleId); }
function areAllModulesSolved() { return getTimelineModules().every((module) => isModuleSolved(module.id)); }

function getFoundClues() { return getAllClues().filter((clue) => state.foundClues.includes(clue.id)); }
function getKeyCount() { return getFoundClues().filter((clue) => clue.kind === "key").length; }
function getLocationClues(locationId) { return getAllClues().filter((clue) => clue.locationId === locationId); }
function isLocationUnlocked(locationId, keyCount = getKeyCount()) {
  const location = CONTENT.locations[locationId];
  return Boolean(location) && keyCount >= (location.requiredKeyClues || 0);
}

function updateProgressUI() {
  document.querySelector("#clue-count").textContent = `${getKeyCount()} / ${CONTENT.keyClueGoal}`;
  soundToggle.textContent = state.sound ? "♫" : "♩";
  soundToggle.setAttribute("aria-label", state.sound ? "关闭声音" : "开启声音");
  settingsSound.checked = state.sound;
  settingsMotion.checked = state.reduceMotion;
  document.body.classList.toggle("reduce-motion", state.reduceMotion);
  const dreamButton = document.querySelector('[data-view="dream"]');
  const dreamDeskItem = document.querySelector("#dream-desk-item");
  const unlocked = state.timelineSolved;
  dreamButton.classList.toggle("is-locked", !unlocked);
  dreamButton.setAttribute("aria-label", unlocked ? "梦境记录" : "梦境记录，尚未解锁");
  dreamDeskItem.classList.toggle("is-locked", !unlocked);
  dreamDeskItem.querySelector("small").textContent = unlocked ? "重新进入梦境" : "尚未解锁";
  document.querySelectorAll(".map-pin[data-location]").forEach((pin) => {
    const location = CONTENT.locations[pin.dataset.location];
    const locationUnlocked = isLocationUnlocked(pin.dataset.location);
    pin.classList.toggle("is-locked", !locationUnlocked);
    pin.setAttribute("aria-disabled", String(!locationUnlocked));
    if (!location) {
      const unavailableStatus = pin.querySelector("small");
      if (unavailableStatus) unavailableStatus.textContent = "尚未解锁";
      return;
    }
    const clues = getLocationClues(pin.dataset.location);
    if (!locationUnlocked) {
      const lockedStatus = pin.querySelector("small");
      if (lockedStatus) lockedStatus.textContent = `还需 ${Math.max(0, (location.requiredKeyClues || 0) - getKeyCount())} 条关键线索`;
      return;
    }
    if (!clues.length) return;
    const keyClues = clues.filter((clue) => clue.kind === "key");
    const allComplete = clues.every((clue) => state.foundClues.includes(clue.id));
    const mainComplete = keyClues.length > 0 && keyClues.every((clue) => state.foundClues.includes(clue.id));
    pin.classList.toggle("is-complete", allComplete);
    pin.classList.toggle("is-main-complete", mainComplete && !allComplete);
    const status = pin.querySelector("small");
    if (status) status.textContent = allComplete ? "全部调查完成" : mainComplete ? "主要调查完成" : "可调查";
  });
}

function openScene(locationId, sceneIndex = 0) {
  const location = CONTENT.locations[locationId];
  if (!location) { showToast("这里暂时没有可调查的场景。"); return; }
  if (!isLocationUnlocked(locationId)) { showToast(`【${location.name}尚未解锁】先完成当前地点的调查。`); return; }
  const scenes = getScenes(location);
  const scene = scenes[Math.max(0, Math.min(sceneIndex, scenes.length - 1))];
  currentLocation = locationId;
  currentSceneIndex = scenes.indexOf(scene);
  zoom = 1;
  pan = { x: 0, y: 0 };
  document.querySelector("#scene-location-label").textContent = location.name;
  document.querySelector("#scene-title").textContent = scene.title;
  document.querySelector("#scene-page").textContent = `${currentSceneIndex + 1} / ${scenes.length}`;
  document.querySelector("#scene-prev").disabled = currentSceneIndex === 0;
  document.querySelector("#scene-next").disabled = currentSceneIndex === scenes.length - 1;
  scenePlaceholder.dataset.tone = scene.placeholderTone || "archive";
  scenePlaceholder.hidden = Boolean(scene.artwork);
  sceneArt.style.backgroundImage = scene.artwork ? `url("${scene.artwork}")` : "none";
  sceneArt.style.backgroundSize = "contain";
  sceneArt.style.backgroundPosition = "center";
  sceneArt.style.backgroundRepeat = "no-repeat";
  hotspotLayer.innerHTML = "";
  scene.hotspots.forEach((clue) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hotspot";
    if (state.foundClues.includes(clue.id)) button.classList.add("is-found");
    button.style.left = `${clue.x}%`;
    button.style.top = `${clue.y}%`;
    button.style.setProperty("--size", `${clue.size || 7}%`);
    button.setAttribute("aria-label", `调查点：${clue.title}`);
    button.addEventListener("pointerenter", () => playHoverCue(clue.kind));
    button.addEventListener("click", () => discoverClue(clue, button));
    hotspotLayer.appendChild(button);
  });
  applySceneTransform();
  closePanels();
  sceneLayer.classList.add("is-open");
  sceneLayer.setAttribute("aria-hidden", "false");
  document.body.classList.add("custom-cursor-active");
}

function discoverClue(clue, button) {
  const isNew = !state.foundClues.includes(clue.id);
  const previousKeyCount = getKeyCount();
  if (isNew) {
    state.foundClues.push(clue.id);
    button.classList.add("is-found");
    saveState();
  }
  playConfirmCue();
  document.querySelector("#clue-type").textContent = clue.kind === "key" ? "关键线索" : "补充记录";
  document.querySelector("#clue-title").textContent = clue.title;
  document.querySelector("#clue-text").textContent = clue.text;
  clueCard.classList.add("is-open");
  clueCard.setAttribute("aria-hidden", "false");
  if (isNew && clue.kind === "optional") showToast("补充记录已自动收入调查簿。");
  const currentKeyCount = getKeyCount();
  const newlyUnlocked = Object.entries(CONTENT.locations).filter(([id, location]) => previousKeyCount < (location.requiredKeyClues || 0) && currentKeyCount >= (location.requiredKeyClues || 0) && isLocationUnlocked(id));
  if (isNew && newlyUnlocked.length) {
    window.setTimeout(() => showToast(`【${newlyUnlocked.map(([, location]) => location.name).join("、")}已解锁】`), 420);
  }
  if (isNew && getKeyCount() >= CONTENT.keyClueGoal) {
    window.setTimeout(() => showToast("关键记录已齐全，可以尝试还原历史。", "前往复原", () => openPanel("timeline-panel")), newlyUnlocked.length ? 1700 : 650);
  }
}

function applySceneTransform() {
  sceneArt.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  document.querySelector("#zoom-value").textContent = `${Math.round(zoom * 100)}%`;
}

function renderNotebook(tab) {
  const content = document.querySelector("#notebook-content");
  document.querySelectorAll("[data-note-tab]").forEach((button) => button.classList.toggle("is-current", button.dataset.noteTab === tab));
  if (tab === "records") {
    const found = getFoundClues();
    if (!found.length) {
      content.innerHTML = '<div class="empty-state"><p>还没有调查记录。<br>前往地图寻找第一个地点。</p></div>';
      return;
    }
    const grouped = Object.entries(CONTENT.locations).map(([id, location]) => ({ location, clues: found.filter((clue) => clue.locationId === id) })).filter((group) => group.clues.length);
    content.innerHTML = grouped.map(({ location, clues }) => `<section class="record-group"><h3>${location.name}</h3>${clues.map((clue) => `<div class="record-entry"><b>${clue.kind === "key" ? "关键线索" : "补充记录"}</b><div><strong>${clue.title}</strong><p>${clue.text}</p></div></div>`).join("")}</section>`).join("");
  } else if (tab === "history") {
    const solvedModules = getTimelineModules().filter((module) => isModuleSolved(module.id));
    content.innerHTML = solvedModules.length
      ? `<div class="record-group"><h3>第一阶段：残存记录</h3>${solvedModules.map((module) => `<div class="record-entry"><b>已复原</b><div><strong>${module.title}</strong><p>${module.intro}</p></div></div>`).join("")}${state.timelineSolved ? '<div class="record-entry"><b>完整</b><div><strong>全部小节已经复原</strong><p>完整的研究稿已经可以阅读。</p><button class="text-button" data-read-history type="button">阅读复原稿</button></div></div>' : ""}</div>`
      : '<div class="empty-state"><p>尚未复原任何历史。<br>关键事件需要由你排列。</p></div>';
    content.querySelector("[data-read-history]")?.addEventListener("click", () => openPanel("history-panel"));
  } else {
    content.innerHTML = state.dreamVisited
      ? '<div class="record-group"><h3>无日期梦境</h3><div class="record-entry"><b>可重看</b><div><strong>梦中的人</strong><p>人物没有开口。黑白两种形态保留着不同的调查点。</p><button class="text-button" data-replay-dream type="button">重新进入</button></div></div></div>'
      : '<div class="empty-state"><p>没有可以确认的梦境记录。</p></div>';
    content.querySelector("[data-replay-dream]")?.addEventListener("click", () => openPanel("dream-panel"));
  }
}

function renderTimeline() {
  const container = document.querySelector("#timeline-cards");
  const intro = document.querySelector("#timeline-intro");
  const moduleContainer = document.querySelector("#timeline-modules");
  const modules = getTimelineModules();
  if (!activeTimelineModuleId || !modules.some((module) => module.id === activeTimelineModuleId)) {
    activeTimelineModuleId = modules.find((module) => isModuleUnlocked(module) && !isModuleSolved(module.id))?.id || modules[0]?.id;
  }
  moduleContainer.innerHTML = "";
  modules.forEach((module) => {
    const button = document.createElement("button");
    const unlocked = isModuleUnlocked(module);
    button.type = "button";
    button.className = "timeline-module";
    button.classList.toggle("is-current", module.id === activeTimelineModuleId);
    button.classList.toggle("is-solved", isModuleSolved(module.id));
    button.classList.toggle("is-locked", !unlocked);
    button.innerHTML = `<b>${module.title}</b><small>${unlocked ? module.intro : `需要 ${module.requiredKeyClues} 条关键线索`}</small>`;
    button.addEventListener("click", () => {
      if (!unlocked) { showToast("这个小节所需的记录还没有收集齐。 "); return; }
      activeTimelineModuleId = module.id;
      renderTimeline();
    });
    moduleContainer.appendChild(button);
  });
  const activeModule = modules.find((module) => module.id === activeTimelineModuleId) || modules[0];
  if (!activeModule) { container.innerHTML = ""; return; }
  const ready = isModuleUnlocked(activeModule);
  const solved = isModuleSolved(activeModule.id);
  if (!timelineOrders[activeModule.id]) {
    timelineOrders[activeModule.id] = [...activeModule.events].sort(() => Math.random() - 0.5).map((item) => item.id);
    if (timelineOrders[activeModule.id].every((id, index) => id === activeModule.events[index].id)) timelineOrders[activeModule.id].reverse();
  }
  const timelineOrder = timelineOrders[activeModule.id];
  intro.textContent = solved ? `${activeModule.title}已经复原。可以选择其他小节。` : ready ? activeModule.intro : `还需要 ${Math.max(0, activeModule.requiredKeyClues - getKeyCount())} 条关键线索才能打开这个小节。`;
  container.innerHTML = "";
  timelineOrder.forEach((id, index) => {
    const item = activeModule.events.find((entry) => entry.id === id);
    const card = document.createElement("article");
    card.className = "timeline-card";
    card.draggable = ready && !solved;
    card.dataset.id = id;
    card.innerHTML = `<span class="timeline-number">${index + 1}</span><div><h3>${item.title}</h3><p>${item.text}</p></div><div class="card-moves"><button type="button" data-move="up" aria-label="向前移动">↑</button><button type="button" data-move="down" aria-label="向后移动">↓</button></div>`;
    card.addEventListener("dragstart", () => { dragging = id; });
    card.addEventListener("dragover", (event) => event.preventDefault());
    card.addEventListener("drop", () => moveTimelineItem(dragging, id));
    card.querySelector('[data-move="up"]').addEventListener("click", () => moveBy(index, -1));
    card.querySelector('[data-move="down"]').addEventListener("click", () => moveBy(index, 1));
    container.appendChild(card);
  });
  document.querySelector("#timeline-submit").disabled = !ready || solved;
}

function moveTimelineItem(fromId, toId) {
  const activeModule = getTimelineModules().find((module) => module.id === activeTimelineModuleId);
  if (!fromId || fromId === toId || !activeModule || isModuleSolved(activeModule.id)) return;
  const timelineOrder = timelineOrders[activeModule.id];
  const from = timelineOrder.indexOf(fromId);
  const to = timelineOrder.indexOf(toId);
  timelineOrder.splice(from, 1);
  timelineOrder.splice(to, 0, fromId);
  renderTimeline();
}

function moveBy(index, direction) {
  const activeModule = getTimelineModules().find((module) => module.id === activeTimelineModuleId);
  if (!activeModule || isModuleSolved(activeModule.id)) return;
  const timelineOrder = timelineOrders[activeModule.id];
  const target = index + direction;
  if (target < 0 || target >= timelineOrder.length) return;
  [timelineOrder[index], timelineOrder[target]] = [timelineOrder[target], timelineOrder[index]];
  renderTimeline();
}

function submitTimeline() {
  const activeModule = getTimelineModules().find((module) => module.id === activeTimelineModuleId);
  if (!activeModule) return;
  const timelineOrder = timelineOrders[activeModule.id];
  const correct = [...activeModule.events].sort((a, b) => a.order - b.order).map((item) => item.id);
  if (timelineOrder.every((id, index) => id === correct[index])) {
    if (!state.timelineSolvedModules.includes(activeModule.id)) state.timelineSolvedModules.push(activeModule.id);
    state.timelineSolved = areAllModulesSolved();
    saveState();
    playTimelineSuccessCue();
    if (state.timelineSolved) {
      showToast("【完整故事页已解锁】时间线只是概括，研究稿正在展开。");
      window.setTimeout(() => {
        openPanel("history-panel");
        document.querySelector("#history-panel").classList.add("is-revealing");
        window.setTimeout(() => document.querySelector("#history-panel").classList.remove("is-revealing"), 900);
      }, state.reduceMotion ? 100 : 760);
    }
    else showToast(`${activeModule.title}已经复原，可以继续整理下一小节。`);
    renderTimeline();
  } else {
    document.querySelectorAll(".timeline-card").forEach((card) => {
      card.classList.remove("is-shaking");
      void card.offsetWidth;
      card.classList.add("is-shaking");
    });
    playTone(220, .1);
    showToast("顺序仍有矛盾，可以重新尝试。");
  }
}

function renderDream() {
  if (!state.timelineSolved) { showToast("现实中的研究尚未抵达梦境的入口。"); closePanels(); return; }
  state.dreamVisited = true;
  saveState();
  const dream = document.querySelector("#dream-scene");
  dream.classList.toggle("is-black", state.dreamForm === "black");
  dream.classList.toggle("is-white", state.dreamForm === "white");
  const light = document.querySelector("#light-switch");
  const initialHotspots = CONTENT.dream.hotspots?.[CONTENT.dream.initialForm] || [];
  const initialFormInvestigated = initialHotspots.length > 0 && initialHotspots.every((spot) => state.dreamFoundHotspots.includes(spot.id));
  light.disabled = !initialFormInvestigated;
  light.querySelector("span").textContent = initialFormInvestigated ? (state.dreamForm === "black" ? "放出光点" : "收回光点") : "光点尚未回应";
  const clues = CONTENT.dream.hotspots?.[state.dreamForm] || [];
  const lightPosition = CONTENT.dream.lightPoint?.[state.dreamForm] || { x: 84, y: 84 };
  light.style.left = `${lightPosition.x}%`;
  light.style.top = `${lightPosition.y}%`;
  light.style.right = "auto";
  light.style.bottom = "auto";
  const hotspotLayer = document.querySelector("#dream-hotspot-layer");
  hotspotLayer.innerHTML = "";
  clues.forEach((clue) => {
    const hotspot = document.createElement("button");
    hotspot.type = "button";
    hotspot.className = "dream-hotspot";
    hotspot.style.left = `${clue.x}%`;
    hotspot.style.top = `${clue.y}%`;
    hotspot.setAttribute("aria-label", `调查梦境：${clue.title}`);
    hotspot.addEventListener("pointerenter", () => playHoverCue("key"));
    hotspot.addEventListener("click", () => discoverDreamClue(clue));
    hotspotLayer.appendChild(hotspot);
  });
  document.body.classList.add("custom-cursor-active");
}

function discoverDreamClue(clue) {
  if (!state.dreamFoundHotspots.includes(clue.id)) state.dreamFoundHotspots.push(clue.id);
  const formClues = CONTENT.dream.hotspots?.[state.dreamForm] || [];
  if (formClues.length && formClues.every((spot) => state.dreamFoundHotspots.includes(spot.id)) && !state.dreamFoundForms.includes(state.dreamForm)) {
    state.dreamFoundForms.push(state.dreamForm);
  }
  state.dreamHotspotFound = true;
  saveState();
  playConfirmCue();
  document.querySelector("#dream-caption").textContent = clue.text || "梦境中留下了一处无法解释的细节。";
  renderDream();
}

function renderHistory() {
  document.querySelector("#history-article").innerHTML = CONTENT.history.map((block) => `<section class="history-block"><div class="history-image" ${block.artwork ? `style="background-image:url('${block.artwork}')"` : ""}>${block.artwork ? "" : "章节配图"}</div><div class="history-copy"><h3>${block.title}</h3><p>${String(block.text || "").replace(/\n/g, "<br>")}</p></div></section>`).join("");
}

function openCredits() {
  state.investigationComplete = true;
  saveState();
  closePanels();
  const credits = document.querySelector("#credits-layer");
  credits.classList.add("is-open");
  credits.setAttribute("aria-hidden", "false");
  const roll = document.querySelector("#credits-roll");
  roll.style.animation = "none";
  void roll.offsetWidth;
  roll.style.animation = "";
}

document.querySelector("#start-game").addEventListener("click", () => { ensureAudio(); resetMailView(); showScreen("prologue"); });
document.querySelector("#open-mail").addEventListener("click", () => {
  document.querySelector("#mail-inbox").classList.add("is-read");
  document.querySelector("#mentor-letter").classList.add("is-open");
  document.querySelector("#mentor-letter").setAttribute("aria-hidden", "false");
});
document.querySelector("#enter-map").addEventListener("click", () => {
  state.introComplete = true;
  saveState();
  showScreen("map-screen");
  const firstId = CONTENT.prologue?.firstLocation || Object.keys(CONTENT.locations)[0];
  const firstLocation = CONTENT.locations[firstId];
  if (firstLocation) window.setTimeout(() => showToast(`【${firstLocation.name}已解锁】导师建议先从这里开始。`), 300);
});
document.querySelectorAll(".map-pin").forEach((pin, index) => {
  pin.addEventListener("pointerenter", () => { if (!isLocationUnlocked(pin.dataset.location)) return; stopActiveTone(); playPizzicato([523.25, 587.33, 466.16][index], .024); });
  pin.addEventListener("click", () => openScene(pin.dataset.location));
});
document.querySelector("#scene-back").addEventListener("click", () => { sceneLayer.classList.remove("is-open"); clueCard.classList.remove("is-open"); document.body.classList.remove("custom-cursor-active"); });
document.querySelector("#scene-prev").addEventListener("click", () => openScene(currentLocation, currentSceneIndex - 1));
document.querySelector("#scene-next").addEventListener("click", () => openScene(currentLocation, currentSceneIndex + 1));
document.querySelector("#clue-close").addEventListener("click", () => { clueCard.classList.remove("is-open"); clueCard.setAttribute("aria-hidden", "true"); });
document.querySelector("#zoom-in").addEventListener("click", () => { zoom = Math.min(2.5, zoom + .2); applySceneTransform(); });
document.querySelector("#zoom-out").addEventListener("click", () => { zoom = Math.max(1, zoom - .2); if (zoom === 1) pan = { x: 0, y: 0 }; applySceneTransform(); });
document.querySelector("#zoom-reset").addEventListener("click", () => { zoom = 1; pan = { x: 0, y: 0 }; applySceneTransform(); });
document.querySelector("#observe-toggle").addEventListener("click", (event) => { event.currentTarget.classList.toggle("is-active"); sceneLayer.classList.toggle("observe-mode"); });

let panStart = null;
document.querySelector("#scene-stage").addEventListener("pointerdown", (event) => {
  if (event.target.closest("button") || zoom <= 1) return;
  panStart = { pointerX: event.clientX, pointerY: event.clientY, x: pan.x, y: pan.y };
  event.currentTarget.setPointerCapture(event.pointerId);
});
document.querySelector("#scene-stage").addEventListener("pointermove", (event) => {
  if (!panStart) return;
  pan.x = panStart.x + event.clientX - panStart.pointerX;
  pan.y = panStart.y + event.clientY - panStart.pointerY;
  applySceneTransform();
});
document.querySelector("#scene-stage").addEventListener("pointerup", () => { panStart = null; });

document.querySelectorAll(".game-nav button").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (view === "map") { closePanels(); return; }
    if (view === "dream" && !state.timelineSolved) { playTone(246.94, .09); showToast("尚未做梦。继续调查现实中的关键记录。"); return; }
    const target = { desk: "desk-panel", notebook: "notebook-panel", timeline: "timeline-panel", dream: "dream-panel" }[view];
    if (target) openPanel(target);
  });
});
document.querySelectorAll("[data-open-panel]").forEach((button) => button.addEventListener("click", () => {
  if (button.classList.contains("is-locked")) { showToast("梦境尚未解锁。"); return; }
  openPanel(button.dataset.openPanel);
}));
document.querySelectorAll(".panel-close").forEach((button) => button.addEventListener("click", () => { closePanels(); document.body.classList.remove("custom-cursor-active"); }));
document.querySelectorAll("[data-note-tab]").forEach((button) => button.addEventListener("click", () => renderNotebook(button.dataset.noteTab)));
document.querySelector("#timeline-submit").addEventListener("click", submitTimeline);
document.querySelector("#timeline-hint").addEventListener("click", () => {
  const activeModule = getTimelineModules().find((module) => module.id === activeTimelineModuleId);
  if (!activeModule) return;
  const timelineOrder = timelineOrders[activeModule.id];
  const correct = [...activeModule.events].sort((a, b) => a.order - b.order);
  const wrongIndex = timelineOrder.findIndex((id, index) => id !== correct[index].id);
  showToast(wrongIndex < 0 ? "这份顺序已经没有明显矛盾。" : `“${activeModule.events.find((item) => item.id === timelineOrder[wrongIndex]).title}”的位置需要再考虑。`);
});
document.querySelector("#light-switch").addEventListener("click", () => {
  state.dreamForm = state.dreamForm === "black" ? "white" : "black";
  saveState();
  playTone(state.dreamForm === "white" ? 698.46 : 349.23, .18, .035);
  renderDream();
  document.querySelector("#dream-caption").textContent = state.dreamForm === "white" ? "光向外铺开，原本被黑暗藏起的轮廓逐渐显现。" : "光重新收束成一点，白色的边界随之退去。";
});

soundToggle.addEventListener("click", () => { state.sound = !state.sound; saveState(); if (state.sound) playTone(440, .09); showToast(state.sound ? "声音已开启" : "声音已关闭"); });
document.querySelector("#settings-open").addEventListener("click", () => openPanel("settings-panel"));
settingsSound.addEventListener("change", () => { state.sound = settingsSound.checked; saveState(); if (state.sound) playTone(440, .09); });
settingsMotion.addEventListener("change", () => { state.reduceMotion = settingsMotion.checked; saveState(); });
document.querySelector("#reset-progress").addEventListener("click", () => {
  if (!window.confirm("确定清除这台设备上的全部调查进度吗？")) return;
  localStorage.removeItem(SAVE_KEY);
  state = { ...defaultState };
  timelineOrders = {};
  activeTimelineModuleId = null;
  closePanels();
  updateProgressUI();
  showToast("调查进度已经清除。");
});
document.querySelector("#finish-investigation").addEventListener("click", openCredits);
document.querySelector("#credits-skip").addEventListener("click", () => {
  const credits = document.querySelector("#credits-layer");
  credits.classList.remove("is-open");
  credits.setAttribute("aria-hidden", "true");
  showToast("调查已经完成。你仍可以回到地图补全记录。");
});
document.querySelector("#credits-return").addEventListener("click", () => {
  const credits = document.querySelector("#credits-layer");
  credits.classList.remove("is-open");
  credits.setAttribute("aria-hidden", "true");
  showScreen("opening");
});

document.addEventListener("click", (event) => {
  const interactive = event.target.closest("button, a");
  if (!interactive || interactive.disabled || interactive.matches(".hotspot, .dream-hotspot")) return;
  playInkScratch();
}, true);

const finePointer = window.matchMedia("(pointer: fine)").matches;
document.body.classList.toggle("has-fine-pointer", finePointer);
document.addEventListener("pointermove", (event) => {
  if (!finePointer) return;
  quillCursor.style.left = `${event.clientX}px`;
  quillCursor.style.top = `${event.clientY}px`;
  batonCursor.style.left = `${event.clientX}px`;
  batonCursor.style.top = `${event.clientY}px`;
});

renderPrologue();
updateProgressUI();
