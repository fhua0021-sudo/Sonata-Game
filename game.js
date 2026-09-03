const CONTENT = (() => {
  if (new URLSearchParams(window.location.search).has("editor-preview")) {
    try {
      const draft = JSON.parse(localStorage.getItem("sonata-content-draft-v1"));
      if (!draft) return window.SONATA_CONTENT;
      const locations = Object.fromEntries(Object.entries(draft.locations || window.SONATA_CONTENT.locations).map(([id, location], index) => {
        const original = window.SONATA_CONTENT.locations[id] || {};
        return [id, {
          ...location,
          mapX: location.mapX ?? original.mapX ?? 38 + (index % 3) * 16,
          mapY: location.mapY ?? original.mapY ?? 38 + Math.floor(index / 3) * 18,
          mapRevealRadius: location.mapRevealRadius ?? original.mapRevealRadius ?? window.SONATA_CONTENT.map?.defaultRevealRadius ?? 18
        }];
      }));
      return { ...window.SONATA_CONTENT, ...draft, map: { ...window.SONATA_CONTENT.map, ...(draft.map || {}) }, locations };
    }
    catch { return window.SONATA_CONTENT; }
  }
  return window.SONATA_CONTENT;
})();
const SAVE_KEY = "sonata-game-progress-v3";

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
const mapPaper = document.querySelector("#map-paper");
const worldMapArt = document.querySelector("#world-map-art");
const mapShroud = document.querySelector("#map-shroud");
const mapPinLayer = document.querySelector("#map-pin-layer");

let audioContext = null;
let activeOscillator = null;
let pendingCueTimer = null;
let toastTimer = null;
let currentLocation = null;
let currentSceneIndex = 0;
let zoom = 1;
let pan = { x: 0, y: 0 };
let activeTimelineModuleId = null;
let selectedEvidenceIds = new Set();
let mapRevealFrame = null;
let activeComicIndex = 0;
let comicContinuousMode = false;

const defaultState = {
  sound: true,
  reduceMotion: false,
  foundClues: [],
  rumorSolved: false,
  correctedRumorModules: [],
  dreamUnlocked: false,
  dreamPrompted: false,
  dreamGuidanceSeen: false,
  dreamUpdatePending: false,
  dreamLastKeyCount: 0,
  dreamVisited: false,
  dreamHotspotFound: false,
  dreamFoundForms: [],
  dreamFoundHotspots: [],
  dreamForm: CONTENT.dream.initialForm || "black",
  unlockedComicPages: [],
  comicFinalViewed: false,
  introComplete: false,
  investigationComplete: false
};

let state = loadState();

function loadState() {
  try {
    const loaded = { ...JSON.parse(JSON.stringify(defaultState)), ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") };
    if (!Array.isArray(loaded.foundClues)) loaded.foundClues = [];
    if (!Array.isArray(loaded.correctedRumorModules)) loaded.correctedRumorModules = [];
    if (!Array.isArray(loaded.dreamFoundForms)) loaded.dreamFoundForms = [];
    if (!Array.isArray(loaded.dreamFoundHotspots)) loaded.dreamFoundHotspots = [];
    if (!Array.isArray(loaded.unlockedComicPages)) loaded.unlockedComicPages = [];
    return loaded;
  } catch {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  state.rumorSolved = areAllModulesSolved();
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

function playInkScratch(duration = 0.09, volume = 0.055) {
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
  bandpass.Q.setValueAtTime(0.38, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.006);
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
  playInkScratch(0.105, 0.052);
}

function playTimelineSuccessCue() {
  stopActiveTone();
  playTone(523.25, 0.09, 0.028, 1.002);
  window.setTimeout(() => playTone(659.25, 0.13, 0.03, 1.002), 92);
}

function renderPrologue() {
  const prologue = CONTENT.prologue || {};
  const title = CONTENT.title || "琴";
  const subtitle = CONTENT.subtitle || "仪式的和弦";
  document.querySelector("#game-title").textContent = title;
  document.querySelector("#game-subtitle").textContent = subtitle;
  document.title = `${title}：${subtitle}`;
  const sender = prologue.sender || "音乐史系导师";
  const subject = prologue.subject || "关于你提交的研究申请";
  document.querySelector("#mail-summary-sender").textContent = sender;
  document.querySelector("#mail-summary-subject").textContent = subject;
  document.querySelector("#mail-sender").textContent = sender;
  document.querySelector("#mail-subject").textContent = subject;
  document.querySelector("#mail-term").textContent = prologue.term || "秋季学期 · 独立研究许可";
  document.querySelector("#mail-signature").textContent = prologue.signature || sender;
  document.querySelector("#opening-rumor").textContent = prologue.rumor || "“琴”从诞生起便只会招致灾难。";
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
  if (id === "comic-panel") renderComics();
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
  return CONTENT.rumorModules || [];
}

function getComicPages() {
  return CONTENT.comics?.pages || [];
}

function isModuleUnlocked(module) { return getKeyCount() >= (module.requiredKeyClues || 0); }
function isModuleSolved(moduleId) { return state.correctedRumorModules.includes(moduleId); }
function areAllModulesSolved() { return getTimelineModules().every((module) => isModuleSolved(module.id)); }

function getFoundClues() { return getAllClues().filter((clue) => state.foundClues.includes(clue.id)); }
function getKeyCount() { return getFoundClues().filter((clue) => clue.kind === "key").length; }
function getLocationClues(locationId) { return getAllClues().filter((clue) => clue.locationId === locationId); }
function isLocationComplete(locationId) {
  const clues = getLocationClues(locationId);
  return clues.length > 0 && clues.every((clue) => state.foundClues.includes(clue.id));
}
function isLocationUnlocked(locationId, keyCount = getKeyCount()) {
  const location = CONTENT.locations[locationId];
  return Boolean(location) && keyCount >= (location.requiredKeyClues || 0);
}

function isComicMilestoneComplete(page) {
  const unlock = page.unlock || {};
  if (unlock.type === "rumor") return isModuleSolved(unlock.id);
  if (unlock.type === "location") return isLocationComplete(unlock.id);
  if (unlock.type === "dream") return state.dreamFoundHotspots.includes(unlock.id);
  if (unlock.type === "key") return getKeyCount() >= Number(unlock.count || unlock.id || 0);
  return unlock.type === "always";
}

function syncComicUnlocks() {
  state.unlockedComicPages ||= [];
  const newlyUnlocked = getComicPages().filter((page) => isComicMilestoneComplete(page) && !state.unlockedComicPages.includes(page.id));
  if (!newlyUnlocked.length) return [];
  state.unlockedComicPages.push(...newlyUnlocked.map((page) => page.id));
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  updateProgressUI();
  return newlyUnlocked;
}

function renderMapPins() {
  if (!mapPinLayer) return;
  mapPinLayer.innerHTML = "";
  Object.entries(CONTENT.locations).forEach(([locationId, location], index) => {
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "map-pin";
    pin.dataset.location = locationId;
    pin.style.left = `${Number(location.mapX ?? 50)}%`;
    pin.style.top = `${Number(location.mapY ?? 50)}%`;
    pin.innerHTML = `<span class="pin-dot"></span><span class="pin-label"><b>${location.name || "未命名地点"}</b><small>等待确认</small></span>`;
    pin.addEventListener("pointerenter", () => {
      if (!isLocationUnlocked(locationId)) return;
      stopActiveTone();
      playPizzicato([523.25, 587.33, 466.16, 659.25][index % 4], .024);
    });
    pin.addEventListener("click", () => openScene(locationId));
    mapPinLayer.appendChild(pin);
  });
}

function drawMapShroud(revealingLocationId = "", revealProgress = 1) {
  if (!mapPaper || !mapShroud) return;
  const rect = mapPaper.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const density = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const pixelWidth = Math.round(width * density);
  const pixelHeight = Math.round(height * density);
  if (mapShroud.width !== pixelWidth || mapShroud.height !== pixelHeight) {
    mapShroud.width = pixelWidth;
    mapShroud.height = pixelHeight;
  }
  const context = mapShroud.getContext("2d");
  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, width, height);
  const opacity = Math.max(0, Math.min(0.86, Number(CONTENT.map?.shroudOpacity ?? 0.62)));
  const shade = context.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, "rgba(16,18,18,0)");
  shade.addColorStop(.13, `rgba(16,18,18,${opacity * .28})`);
  shade.addColorStop(.22, `rgba(16,18,18,${opacity})`);
  shade.addColorStop(.93, `rgba(16,18,18,${opacity})`);
  shade.addColorStop(1, `rgba(16,18,18,${opacity * .18})`);
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "destination-out";
  Object.entries(CONTENT.locations).forEach(([locationId, location]) => {
    if (!isLocationUnlocked(locationId)) return;
    const progress = locationId === revealingLocationId ? revealProgress : 1;
    const baseRadius = Number(location.mapRevealRadius ?? CONTENT.map?.defaultRevealRadius ?? 18) / 100 * width;
    const radius = Math.max(2, baseRadius * Math.max(.04, progress));
    const x = Number(location.mapX ?? 50) / 100 * width;
    const y = Number(location.mapY ?? 50) / 100 * height;
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, "rgba(0,0,0,1)");
    glow.addColorStop(.58, "rgba(0,0,0,.96)");
    glow.addColorStop(.82, "rgba(0,0,0,.56)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = glow;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  });
  context.globalCompositeOperation = "source-over";
}

function queueMapShroud() {
  window.requestAnimationFrame(() => drawMapShroud());
}

function animateMapReveal(locationId) {
  if (!locationId || !isLocationUnlocked(locationId)) return;
  const pin = mapPinLayer?.querySelector(`[data-location="${locationId}"]`);
  pin?.classList.add("is-unlocking");
  if (state.reduceMotion) {
    drawMapShroud();
    window.setTimeout(() => pin?.classList.remove("is-unlocking"), 40);
    return;
  }
  window.cancelAnimationFrame(mapRevealFrame);
  const startedAt = performance.now();
  const duration = 980;
  const step = (now) => {
    const raw = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - raw, 3);
    drawMapShroud(locationId, eased);
    if (raw < 1) mapRevealFrame = window.requestAnimationFrame(step);
    else {
      pin?.classList.remove("is-unlocking");
      drawMapShroud();
    }
  };
  mapRevealFrame = window.requestAnimationFrame(step);
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
  const comicButton = document.querySelector('[data-view="comics"]');
  const comicDeskItem = document.querySelector("#comic-desk-item");
  dreamButton.classList.toggle("is-hidden", !state.dreamUnlocked);
  dreamDeskItem.classList.toggle("is-hidden", !state.dreamUnlocked);
  dreamButton.classList.toggle("has-update", state.dreamUpdatePending);
  dreamButton.setAttribute("aria-label", state.dreamUpdatePending ? "梦境记录，有新变化" : "梦境记录");
  dreamDeskItem.querySelector("small").textContent = state.dreamUpdatePending ? "有新的细节显现" : "随时重新进入";
  const comicCount = (state.unlockedComicPages || []).length;
  const hasComicPages = comicCount > 0;
  comicButton.classList.toggle("is-hidden", !hasComicPages);
  comicDeskItem.classList.toggle("is-hidden", !hasComicPages);
  comicDeskItem.querySelector("small").textContent = hasComicPages ? `已复原 ${comicCount} / ${getComicPages().length} 页` : "查看逐步复原的黑白漫画";
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
  queueMapShroud();
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
  const clueCardImage = document.querySelector("#clue-card-image");
  clueCardImage.textContent = clue.artwork ? "" : "线索图片";
  clueCardImage.style.backgroundImage = clue.artwork ? `url("${clue.artwork}")` : "none";
  clueCardImage.classList.toggle("has-image", Boolean(clue.artwork));
  clueCard.classList.add("is-open");
  clueCard.setAttribute("aria-hidden", "false");
  if (isNew && clue.kind === "optional") showToast("补充记录已自动收入调查簿。");
  const currentKeyCount = getKeyCount();
  const newlyUnlocked = Object.entries(CONTENT.locations).filter(([id, location]) => previousKeyCount < (location.requiredKeyClues || 0) && currentKeyCount >= (location.requiredKeyClues || 0) && isLocationUnlocked(id));
  if (isNew && newlyUnlocked.length) {
    window.setTimeout(() => {
      newlyUnlocked.forEach(([id]) => animateMapReveal(id));
      showToast(`【${newlyUnlocked.map(([, location]) => location.name).join("、")}已解锁】`);
    }, 420);
  }
  const dreamThreshold = CONTENT.dream.unlockAtKeyClues || Math.ceil(CONTENT.keyClueGoal / 2);
  if (isNew && clue.kind === "key" && currentKeyCount >= dreamThreshold && !state.dreamPrompted) {
    window.setTimeout(showDreamRestPrompt, newlyUnlocked.length ? 1650 : 520);
  } else if (isNew && clue.kind === "key" && state.dreamVisited && currentKeyCount > state.dreamLastKeyCount) {
    state.dreamUpdatePending = true;
    state.dreamLastKeyCount = currentKeyCount;
    saveState();
    window.setTimeout(() => showToast("【梦境有新变化】现实中的发现，似乎在梦里留下了回响。", "前往梦境", () => openPanel("dream-panel")), 520);
  }
  if (isNew && currentKeyCount >= CONTENT.keyClueGoal) {
    window.setTimeout(() => showToast("关键记录已齐全，可以开始更正流传的说法。", "前往勘误", () => openPanel("timeline-panel")), state.dreamVisited ? 1750 : 900);
  }
  if (isNew) {
    const newComicPages = syncComicUnlocks();
    if (newComicPages.length) {
      const pageNumbers = newComicPages.map((page) => getComicPages().indexOf(page) + 1).join("、");
      window.setTimeout(() => showToast(`【图像残页已复原：第 ${pageNumbers} 页】`, "查看残页", () => openPanel("comic-panel")), newlyUnlocked.length ? 1500 : 620);
    }
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
    content.innerHTML = grouped.map(({ location, clues }) => `<section class="record-group"><h3>${location.name}</h3>${clues.map((clue) => `<div class="record-entry"><b>${clue.kind === "key" ? "关键线索" : "补充记录"}</b><div><strong>${clue.title}</strong><p>${clue.text}</p><button class="record-link" data-clue-record="${clue.id}" type="button">阅读完整记录 <span>→</span></button></div></div>`).join("")}</section>`).join("");
    content.querySelectorAll("[data-clue-record]").forEach((button) => button.addEventListener("click", () => openClueDetail(button.dataset.clueRecord)));
  } else if (tab === "history") {
    const solvedModules = getTimelineModules().filter((module) => isModuleSolved(module.id));
    content.innerHTML = solvedModules.length
      ? `<div class="record-group"><h3>第一阶段：传闻勘误</h3>${solvedModules.map((module) => `<div class="record-entry"><b>已更正</b><div><strong>${module.title}</strong><p>${module.correction}</p></div></div>`).join("")}${state.rumorSolved ? '<div class="record-entry"><b>完整</b><div><strong>全部传闻已经完成勘误</strong><p>完整的研究稿已经可以阅读。</p><button class="text-button" data-read-history type="button">阅读复原稿</button></div></div>' : ""}</div>`
      : '<div class="empty-state"><p>尚未更正任何传闻。<br>先在现实中收集能够相互印证的记录。</p></div>';
    content.querySelector("[data-read-history]")?.addEventListener("click", () => openPanel("history-panel"));
  } else {
    content.innerHTML = state.dreamVisited
      ? '<div class="record-group"><h3>无日期梦境</h3><div class="record-entry"><b>可重看</b><div><strong>梦中的人</strong><p>人物没有开口。黑白两种形态保留着不同的调查点。</p><button class="text-button" data-replay-dream type="button">重新进入</button></div></div></div>'
      : '<div class="empty-state"><p>没有可以确认的梦境记录。</p></div>';
    content.querySelector("[data-replay-dream]")?.addEventListener("click", () => openPanel("dream-panel"));
  }
}

function openClueDetail(clueId) {
  const clue = getFoundClues().find((item) => item.id === clueId);
  if (!clue) return;
  document.querySelector("#clue-detail-meta").textContent = clue.kind === "key" ? "KEY INVESTIGATION RECORD" : "SUPPLEMENTARY RECORD";
  document.querySelector("#clue-detail-title").textContent = clue.title;
  document.querySelector("#clue-detail-location").textContent = `${clue.locationName} · ${clue.sceneTitle}`;
  const figure = document.querySelector("#clue-detail-figure");
  figure.classList.toggle("has-image", Boolean(clue.artwork));
  figure.style.backgroundImage = clue.artwork ? `url("${clue.artwork}")` : "none";
  figure.querySelector(".clue-detail-placeholder").hidden = Boolean(clue.artwork);
  const body = document.querySelector("#clue-detail-body");
  body.innerHTML = "";
  String(clue.fullText || clue.text || "").split(/\n\s*\n/).filter(Boolean).forEach((paragraph) => {
    const element = document.createElement("p");
    element.textContent = paragraph;
    body.appendChild(element);
  });
  openPanel("clue-detail-panel");
}

function renderTimeline() {
  const container = document.querySelector("#timeline-cards");
  const intro = document.querySelector("#timeline-intro");
  const moduleContainer = document.querySelector("#timeline-modules");
  const rumor = document.querySelector("#rumor-statement");
  const result = document.querySelector("#correction-result");
  const modules = getTimelineModules();
  if (!activeTimelineModuleId || !modules.some((module) => module.id === activeTimelineModuleId)) {
    activeTimelineModuleId = modules.find((module) => isModuleUnlocked(module) && !isModuleSolved(module.id))?.id || modules[0]?.id;
    selectedEvidenceIds = new Set();
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
    button.innerHTML = `<b>${module.title}</b><small>${unlocked ? (isModuleSolved(module.id) ? "更正已经归档" : "等待核对证据") : `需要 ${module.requiredKeyClues} 条关键线索`}</small>`;
    button.addEventListener("click", () => {
      if (!unlocked) { showToast("这个小节所需的记录还没有收集齐。 "); return; }
      activeTimelineModuleId = module.id;
      selectedEvidenceIds = new Set();
      renderTimeline();
    });
    moduleContainer.appendChild(button);
  });
  const activeModule = modules.find((module) => module.id === activeTimelineModuleId) || modules[0];
  if (!activeModule) { container.innerHTML = ""; rumor.textContent = "尚未设置传闻。"; return; }
  const ready = isModuleUnlocked(activeModule);
  const solved = isModuleSolved(activeModule.id);
  rumor.textContent = activeModule.rumor;
  rumor.classList.toggle("is-corrected", solved);
  intro.textContent = solved ? "这条传闻已经完成勘误。可以继续核对其他说法。" : ready ? "从已经收集的记录中，选出真正能够反驳这条传闻的证据。" : `还需要 ${Math.max(0, activeModule.requiredKeyClues - getKeyCount())} 条关键线索才能核对这条传闻。`;
  result.hidden = !solved;
  result.innerHTML = solved ? `<span>更正后的结论</span><p>${activeModule.correction}</p>` : "";
  container.innerHTML = "";
  const found = getFoundClues();
  if (!found.length) container.innerHTML = '<div class="empty-state"><p>还没有能够用于核对的调查记录。</p></div>';
  found.forEach((clue) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "evidence-card";
    card.classList.toggle("is-selected", selectedEvidenceIds.has(clue.id));
    card.classList.toggle("is-confirmed", solved && (activeModule.evidenceIds || []).includes(clue.id));
    card.disabled = !ready || solved;
    card.innerHTML = `<span>${clue.kind === "key" ? "关键记录" : "补充资料"}</span><div><h3>${clue.title}</h3><p>${clue.text}</p><small>${clue.locationName} · ${clue.sceneTitle}</small></div>`;
    card.addEventListener("click", () => {
      if (selectedEvidenceIds.has(clue.id)) selectedEvidenceIds.delete(clue.id);
      else selectedEvidenceIds.add(clue.id);
      renderTimeline();
    });
    container.appendChild(card);
  });
  document.querySelector("#timeline-submit").disabled = !ready || solved || !selectedEvidenceIds.size;
}

function submitTimeline() {
  const activeModule = getTimelineModules().find((module) => module.id === activeTimelineModuleId);
  if (!activeModule) return;
  const correct = new Set(activeModule.evidenceIds || []);
  const selectionCorrect = correct.size === selectedEvidenceIds.size && [...correct].every((id) => selectedEvidenceIds.has(id));
  if (selectionCorrect) {
    if (!state.correctedRumorModules.includes(activeModule.id)) state.correctedRumorModules.push(activeModule.id);
    state.rumorSolved = areAllModulesSolved();
    saveState();
    playTimelineSuccessCue();
    const newComicPages = syncComicUnlocks();
    if (state.rumorSolved) {
      showToast(newComicPages.length ? "【最后一页图像残页已复原】完整漫画已经可以连续阅读。" : "【完整故事页已解锁】传闻已经逐一更正。", "查看图像残页", () => openPanel("comic-panel"));
      window.setTimeout(() => {
        if (getComicPages().length) openPanel("comic-panel");
        else {
          openPanel("history-panel");
          document.querySelector("#history-panel").classList.add("is-revealing");
          window.setTimeout(() => document.querySelector("#history-panel").classList.remove("is-revealing"), 900);
        }
      }, state.reduceMotion ? 100 : 760);
    }
    else if (newComicPages.length) showToast(`【图像残页已复原：第 ${getComicPages().indexOf(newComicPages[0]) + 1} 页】`, "查看残页", () => openPanel("comic-panel"));
    else showToast(`${activeModule.title}已经更正，结论已收入调查簿。`);
    renderTimeline();
  } else {
    document.querySelectorAll(".evidence-card.is-selected").forEach((card) => {
      card.classList.remove("is-shaking");
      void card.offsetWidth;
      card.classList.add("is-shaking");
    });
    playTone(220, .1);
    showToast("这些记录还不足以直接反驳传闻，再核对一次。");
  }
}

function playDreamPrelude() {
  if (!state.sound) return 3000;
  ensureAudio();
  if (!audioContext) return 3000;
  const now = audioContext.currentTime + 0.08;
  const notes = [392, 493.88, 587.33, 523.25, 659.25];
  notes.forEach((frequency, index) => {
    const start = now + index * 0.82;
    const duration = index === notes.length - 1 ? 1.45 : 1.15;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const real = new Float32Array([0, 0, 0, 0, 0, 0]);
    const imag = new Float32Array([0, 1, 0.42, 0.2, 0.09, 0.035]);
    oscillator.setPeriodicWave(audioContext.createPeriodicWave(real, imag));
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.linearRampToValueAtTime(frequency * 1.004, start + duration * 0.55);
    oscillator.frequency.linearRampToValueAtTime(frequency, start + duration);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1850, start);
    filter.Q.setValueAtTime(1.1, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.026, start + 0.16);
    gain.gain.setValueAtTime(0.021, start + duration * 0.68);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter).connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  });
  return 4850;
}

function showDreamRestPrompt() {
  if (state.dreamPrompted || state.dreamUnlocked) return;
  const prompt = document.querySelector("#dream-rest-prompt");
  prompt.classList.add("is-open");
  prompt.setAttribute("aria-hidden", "false");
}

function beginDreamIntro() {
  const prompt = document.querySelector("#dream-rest-prompt");
  prompt.classList.remove("is-open");
  prompt.setAttribute("aria-hidden", "true");
  sceneLayer.classList.remove("is-open");
  clueCard.classList.remove("is-open");
  closePanels();
  state.dreamUnlocked = true;
  state.dreamPrompted = true;
  state.dreamLastKeyCount = getKeyCount();
  state.dreamUpdatePending = false;
  saveState();
  const layer = document.querySelector("#dream-intro-layer");
  layer.classList.add("is-open");
  layer.setAttribute("aria-hidden", "false");
  const duration = playDreamPrelude();
  window.setTimeout(() => {
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    openPanel("dream-panel");
  }, state.reduceMotion ? Math.min(duration, 1800) : duration);
}

function showDreamGuide() {
  const guide = document.querySelector("#dream-guide");
  guide.classList.add("is-open");
  guide.setAttribute("aria-hidden", "false");
}

function renderDream() {
  if (!state.dreamUnlocked) { closePanels(); return; }
  state.dreamVisited = true;
  state.dreamUpdatePending = false;
  state.dreamLastKeyCount = Math.max(state.dreamLastKeyCount, getKeyCount());
  saveState();
  const dream = document.querySelector("#dream-scene");
  dream.classList.toggle("is-black", state.dreamForm === "black");
  dream.classList.toggle("is-white", state.dreamForm === "white");
  const dreamFigure = dream.querySelector(".dream-figure");
  const dreamArtwork = state.dreamForm === "black" ? CONTENT.dream.blackArtwork : CONTENT.dream.whiteArtwork;
  dreamFigure.style.backgroundImage = dreamArtwork ? `url("${dreamArtwork}")` : "none";
  dreamFigure.classList.toggle("has-image", Boolean(dreamArtwork));
  const light = document.querySelector("#light-switch");
  const initialHotspots = (CONTENT.dream.hotspots?.[CONTENT.dream.initialForm] || []).filter((spot) => getKeyCount() >= (spot.requiredKeyClues || 0));
  const initialFormInvestigated = initialHotspots.length > 0 && initialHotspots.every((spot) => state.dreamFoundHotspots.includes(spot.id));
  const realityReady = getKeyCount() >= (CONTENT.dream.secondFormRequiredKeyClues || CONTENT.keyClueGoal);
  light.disabled = !initialFormInvestigated || !realityReady;
  light.querySelector("span").textContent = !initialFormInvestigated ? "光点尚未回应" : !realityReady ? "现实仍缺少一段回响" : (state.dreamForm === "black" ? "放出光点" : "收回光点");
  const clues = (CONTENT.dream.hotspots?.[state.dreamForm] || []).filter((spot) => getKeyCount() >= (spot.requiredKeyClues || 0));
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
  const formClues = (CONTENT.dream.hotspots?.[state.dreamForm] || []).filter((spot) => getKeyCount() >= (spot.requiredKeyClues || 0));
  if (formClues.length && formClues.every((spot) => state.dreamFoundHotspots.includes(spot.id)) && !state.dreamFoundForms.includes(state.dreamForm)) {
    state.dreamFoundForms.push(state.dreamForm);
  }
  state.dreamHotspotFound = true;
  saveState();
  playConfirmCue();
  document.querySelector("#dream-caption").textContent = clue.text || "梦境中留下了一处无法解释的细节。";
  const newComicPages = syncComicUnlocks();
  if (newComicPages.length) window.setTimeout(() => showToast(`【图像残页已复原：第 ${getComicPages().indexOf(newComicPages[0]) + 1} 页】`, "查看残页", () => openPanel("comic-panel")), 420);
  renderDream();
}

function renderComics() {
  const pages = getComicPages();
  const unlockedIds = new Set(state.unlockedComicPages || []);
  const unlockedIndexes = pages.map((page, index) => unlockedIds.has(page.id) ? index : -1).filter((index) => index >= 0);
  if (!unlockedIndexes.length) { closePanels(); return; }
  if (!unlockedIndexes.includes(activeComicIndex)) activeComicIndex = unlockedIndexes[0];
  const page = pages[activeComicIndex];
  document.querySelector("#comic-panel-title").textContent = CONTENT.comics?.title || "图像残页";
  document.querySelector("#comic-page-count").textContent = `${activeComicIndex + 1} / ${pages.length}`;
  document.querySelector("#comic-page-title").textContent = page.title || `残页 ${activeComicIndex + 1}`;
  document.querySelector("#comic-caption").textContent = page.caption || "";
  const image = document.querySelector("#comic-image");
  const placeholder = document.querySelector("#comic-placeholder");
  image.hidden = !page.artwork;
  placeholder.hidden = Boolean(page.artwork);
  if (page.artwork) {
    image.src = page.artwork;
    image.alt = page.title || `图像残页第 ${activeComicIndex + 1} 页`;
  } else {
    image.removeAttribute("src");
    image.alt = "";
  }
  const strip = document.querySelector("#comic-page-strip");
  strip.innerHTML = "";
  pages.forEach((item, index) => {
    const button = document.createElement("button");
    const unlocked = unlockedIds.has(item.id);
    button.type = "button";
    button.disabled = !unlocked;
    button.classList.toggle("is-current", index === activeComicIndex);
    button.classList.toggle("is-locked", !unlocked);
    button.textContent = unlocked ? String(index + 1).padStart(2, "0") : "×";
    button.setAttribute("aria-label", unlocked ? `阅读第 ${index + 1} 页` : `第 ${index + 1} 页尚未复原`);
    if (unlocked) button.addEventListener("click", () => { activeComicIndex = index; comicContinuousMode = false; renderComics(); });
    strip.appendChild(button);
  });
  const currentUnlockedPosition = unlockedIndexes.indexOf(activeComicIndex);
  document.querySelector("#comic-prev").disabled = currentUnlockedPosition <= 0 || comicContinuousMode;
  document.querySelector("#comic-next").disabled = currentUnlockedPosition >= unlockedIndexes.length - 1 || comicContinuousMode;
  const allUnlocked = unlockedIndexes.length === pages.length;
  const continuousToggle = document.querySelector("#comic-continuous-toggle");
  continuousToggle.hidden = !allUnlocked;
  continuousToggle.textContent = comicContinuousMode ? "返回单页" : "连续阅读";
  const reader = document.querySelector("#comic-reader");
  const continuous = document.querySelector("#comic-continuous");
  reader.hidden = comicContinuousMode;
  continuous.hidden = !comicContinuousMode;
  continuous.innerHTML = "";
  if (comicContinuousMode) {
    pages.forEach((item, index) => {
      const section = document.createElement("section");
      section.className = "comic-continuous-page";
      const figure = document.createElement("figure");
      if (item.artwork) {
        const pageImage = document.createElement("img");
        pageImage.src = item.artwork;
        pageImage.alt = item.title || `图像残页第 ${index + 1} 页`;
        figure.appendChild(pageImage);
      } else {
        const empty = document.createElement("div");
        empty.className = "comic-placeholder";
        empty.textContent = `第 ${index + 1} 页漫画图片`;
        figure.appendChild(empty);
      }
      const heading = document.createElement("h3");
      heading.textContent = item.title || `残页 ${index + 1}`;
      const caption = document.createElement("p");
      caption.textContent = item.caption || "";
      section.append(figure, heading, caption);
      continuous.appendChild(section);
    });
  }
  document.querySelector("#comic-to-history").hidden = !state.rumorSolved;
}

function renderHistory() {
  document.querySelector("#history-article").innerHTML = CONTENT.history.map((block) => `<section class="history-block"><div class="history-image" ${block.artwork ? `style="background-image:url('${block.artwork}')"` : ""}>${block.artwork ? "" : "章节配图"}</div><div class="history-copy"><h3>${block.title}</h3><p>${String(block.text || "").replace(/\n/g, "<br>")}</p></div></section>`).join("");
}

function renderCredits() {
  document.querySelector("#credits-title").textContent = CONTENT.title || "琴";
  document.querySelector("#credits-subtitle").textContent = CONTENT.subtitle || "仪式的和弦";
  const labels = { planning: "策划／原案", artists: "画师", writers: "文手", music: "音乐", thanks: "特别感谢" };
  const container = document.querySelector("#credits-content");
  container.innerHTML = "";
  Object.entries(labels).forEach(([key, label]) => {
    const names = CONTENT.credits?.[key] || [];
    if (!names.length) return;
    const heading = document.createElement("h3");
    heading.textContent = label;
    const list = document.createElement("p");
    list.textContent = names.join("\n");
    container.append(heading, list);
  });
}

function openCredits() {
  state.investigationComplete = true;
  saveState();
  renderCredits();
  closePanels();
  const credits = document.querySelector("#credits-layer");
  credits.classList.add("is-open");
  credits.setAttribute("aria-hidden", "false");
  const roll = document.querySelector("#credits-roll");
  roll.style.animation = "none";
  void roll.offsetWidth;
  roll.style.animation = "";
}

function updateStartButton() {
  const start = document.querySelector("#start-game");
  start.textContent = state.introComplete ? "继续调查" : "开始调查";
}

document.querySelector("#start-game").addEventListener("click", () => {
  ensureAudio();
  if (state.introComplete) {
    showScreen("map-screen");
    updateProgressUI();
    return;
  }
  resetMailView();
  showScreen("prologue");
});
document.querySelector("#open-mail").addEventListener("click", () => {
  document.querySelector("#mail-inbox").classList.add("is-read");
  document.querySelector("#mentor-letter").classList.add("is-open");
  document.querySelector("#mentor-letter").setAttribute("aria-hidden", "false");
});
document.querySelector("#enter-map").addEventListener("click", () => {
  state.introComplete = true;
  saveState();
  updateStartButton();
  showScreen("map-screen");
  const firstId = CONTENT.prologue?.firstLocation || Object.keys(CONTENT.locations)[0];
  const firstLocation = CONTENT.locations[firstId];
  if (firstLocation) window.setTimeout(() => {
    animateMapReveal(firstId);
    showToast(`【${firstLocation.name}已解锁】导师建议先从这里开始。`);
  }, 300);
  const dreamThreshold = CONTENT.dream.unlockAtKeyClues || Math.ceil(CONTENT.keyClueGoal / 2);
  if (getKeyCount() >= dreamThreshold && !state.dreamPrompted) window.setTimeout(showDreamRestPrompt, 900);
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
    if (view === "dream" && !state.dreamUnlocked) return;
    if (view === "comics" && !(state.unlockedComicPages || []).length) return;
    const target = { desk: "desk-panel", notebook: "notebook-panel", timeline: "timeline-panel", comics: "comic-panel", dream: "dream-panel" }[view];
    if (target) openPanel(target);
  });
});
document.querySelectorAll("[data-open-panel]").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.openPanel === "dream-panel" && !state.dreamUnlocked) return;
  if (button.dataset.openPanel === "comic-panel" && !(state.unlockedComicPages || []).length) return;
  openPanel(button.dataset.openPanel);
}));
document.querySelectorAll(".panel-close").forEach((button) => button.addEventListener("click", () => {
  const leavingFirstDream = Boolean(button.closest("#dream-panel")) && state.dreamVisited && !state.dreamGuidanceSeen;
  closePanels();
  document.body.classList.remove("custom-cursor-active");
  if (leavingFirstDream) {
    state.dreamGuidanceSeen = true;
    saveState();
    window.setTimeout(showDreamGuide, 220);
  }
}));
document.querySelectorAll("[data-note-tab]").forEach((button) => button.addEventListener("click", () => renderNotebook(button.dataset.noteTab)));
document.querySelector("#clue-detail-back").addEventListener("click", () => openPanel("notebook-panel"));
document.querySelector("#timeline-submit").addEventListener("click", submitTimeline);
document.querySelector("#timeline-hint").addEventListener("click", () => {
  const activeModule = getTimelineModules().find((module) => module.id === activeTimelineModuleId);
  if (!activeModule) return;
  const missing = (activeModule.evidenceIds || []).filter((id) => !state.foundClues.includes(id)).length;
  showToast(missing ? `还缺少 ${missing} 条能够直接反驳这条传闻的记录。` : "对照传闻中的绝对说法，寻找能证明“并非一直如此”的记录。 ");
});
document.querySelector("#light-switch").addEventListener("click", () => {
  state.dreamForm = state.dreamForm === "black" ? "white" : "black";
  saveState();
  playTone(state.dreamForm === "white" ? 698.46 : 349.23, .18, .035);
  renderDream();
  document.querySelector("#dream-caption").textContent = state.dreamForm === "white" ? "光向外铺开，原本被黑暗藏起的轮廓逐渐显现。" : "光重新收束成一点，白色的边界随之退去。";
});
document.querySelector("#comic-prev").addEventListener("click", () => {
  const unlockedIndexes = getComicPages().map((page, index) => (state.unlockedComicPages || []).includes(page.id) ? index : -1).filter((index) => index >= 0);
  const position = unlockedIndexes.indexOf(activeComicIndex);
  if (position > 0) { activeComicIndex = unlockedIndexes[position - 1]; renderComics(); }
});
document.querySelector("#comic-next").addEventListener("click", () => {
  const unlockedIndexes = getComicPages().map((page, index) => (state.unlockedComicPages || []).includes(page.id) ? index : -1).filter((index) => index >= 0);
  const position = unlockedIndexes.indexOf(activeComicIndex);
  if (position >= 0 && position < unlockedIndexes.length - 1) { activeComicIndex = unlockedIndexes[position + 1]; renderComics(); }
});
document.querySelector("#comic-continuous-toggle").addEventListener("click", () => { comicContinuousMode = !comicContinuousMode; renderComics(); });
document.querySelector("#comic-to-history").addEventListener("click", () => {
  state.comicFinalViewed = true;
  saveState();
  comicContinuousMode = false;
  openPanel("history-panel");
  document.querySelector("#history-panel").classList.add("is-revealing");
  window.setTimeout(() => document.querySelector("#history-panel").classList.remove("is-revealing"), 900);
});

soundToggle.addEventListener("click", () => { state.sound = !state.sound; saveState(); if (state.sound) playTone(440, .09); showToast(state.sound ? "声音已开启" : "声音已关闭"); });
document.querySelector("#settings-open").addEventListener("click", () => openPanel("settings-panel"));
settingsSound.addEventListener("change", () => { state.sound = settingsSound.checked; saveState(); if (state.sound) playTone(440, .09); });
settingsMotion.addEventListener("change", () => { state.reduceMotion = settingsMotion.checked; saveState(); });
document.querySelector("#reset-progress").addEventListener("click", () => {
  if (!window.confirm("确定清除这台设备上的全部调查进度吗？")) return;
  localStorage.removeItem(SAVE_KEY);
  state = JSON.parse(JSON.stringify(defaultState));
  selectedEvidenceIds = new Set();
  activeTimelineModuleId = null;
  closePanels();
  updateProgressUI();
  updateStartButton();
  showScreen("opening");
  showToast("调查进度已经清除。");
});
document.querySelector("#dream-guide-close").addEventListener("click", () => {
  const guide = document.querySelector("#dream-guide");
  guide.classList.remove("is-open");
  guide.setAttribute("aria-hidden", "true");
});
document.querySelector("#dream-rest").addEventListener("click", beginDreamIntro);
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
  updateStartButton();
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

if (worldMapArt && CONTENT.map?.artwork) {
  worldMapArt.src = CONTENT.map.artwork;
  worldMapArt.alt = CONTENT.map.alt || "调查地图";
  worldMapArt.addEventListener("load", queueMapShroud);
}
window.addEventListener("resize", queueMapShroud);
renderMapPins();
renderPrologue();
syncComicUnlocks();
renderCredits();
updateProgressUI();
updateStartButton();

