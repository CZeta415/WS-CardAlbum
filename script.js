document.addEventListener("DOMContentLoaded", () => {
  const activationOverlay = document.getElementById("activation-overlay");
  const activationText = document.getElementById("activation-text");
  const initialDeck = document.getElementById("initial-deck");
  const initialDeckContainer = document.getElementById("initial-deck-container");
  const cardGallery = document.getElementById("card-gallery");
  const searchBox = document.getElementById("search-box");
  const clearSearchBtn = document.getElementById("clear-search-btn");
  const changelogModal = document.getElementById("changelog-modal");
  const legalModal = document.getElementById("legal-modal");
  const commentsModal = document.getElementById("comments-modal");
  const modalOverlay = document.getElementById("modal-overlay");
  const settingsToggleBtn = document.getElementById("settings-toggle-btn");
  const settingsPanel = document.getElementById("settings-panel");
  const commentsToggleBtn = document.getElementById("comments-toggle-btn");
  const cardViewModal = document.getElementById("card-view-modal");

  let appData = {};
  let fuse;
  let visibleCards = [];
  let pactOfTheDayId = -1;
  let currentCardIndex = -1;
  let activeModal = null;
  let audioContext;
  const audioBuffers = {};
  const audioSources = {
    deal: "assets/sounds/CardRep.mp3",
    flip: "assets/sounds/Flip.mp3",
    roll: "assets/sounds/CardRolls.mp3",
    logS: "assets/sounds/LogS.mp3",
    button: "assets/sounds/button.mp3"
  };
  const settings = { themeColor: "#dcbaff", cardBack: "default", auraEffect: "alfa", masterVolume: 0.7, mutedSounds: [], seenCards: [], legalAccepted: false };

  async function init() {
    try {
      const res = await fetch("app_data.json");
      if (!res.ok) throw new Error("No se pudo cargar app_data.json");
      appData = await res.json();
      activationText.textContent = "Listo para comenzar";
      activationOverlay.addEventListener("click", activateApp, { once: true });
    } catch {
      activationText.textContent = "Error al cargar datos. Verifica app_data.json.";
    }
  }

  async function activateApp() {
    activationOverlay.classList.add("hidden");
    document.body.classList.remove("no-scroll");
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await loadAudio();
    loadSettings();
    applySettings();
    calculatePactOfTheDay();
    setupEventListeners();
    initializeFuseSearch();
  }

  function closeAllPopups() {
    document.querySelectorAll(".modal.visible").forEach(m => m.classList.remove("visible"));
    document.querySelectorAll(".settings-panel.visible").forEach(s => s.classList.remove("visible"));
  }

  function openModal(modal) {
    closeAllPopups();
    activeModal = modal;
    modal.classList.add("visible");
    modalOverlay.classList.add("visible");
  }

  function closeModal() {
    if (!activeModal) return;
    playSound("button");
    activeModal.classList.remove("visible");
    modalOverlay.classList.remove("visible");
    activeModal = null;
  }

  function showChangelog() {
    const { version, changes, ai_note } = appData.changelog;
    changelogModal.innerHTML = `
      <button class="close-modal-btn" aria-label="Cerrar">X</button>
      <h2>Novedades (${version})</h2>
      <ul>${changes.map(c => `<li>${c}</li>`).join("")}</ul>
      <small>${ai_note}</small>`;
    changelogModal.querySelector(".close-modal-btn").addEventListener("click", closeModal);
    openModal(changelogModal);
  }

  function showLegalModal() {
    const { title, content } = appData.legal_text;
    legalModal.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2>${title}</h2>${content}`;
    legalModal.querySelector(".close-modal-btn").addEventListener("click", closeModal);
    openModal(legalModal);
  }

  function showCommentsModal() {
    const container = document.getElementById("giscus-container");
    container.classList.remove("hidden");
    container.innerHTML = `
    <script src="https://giscus.app/client.js"
        data-repo="CZeta415/WS-CardAlbum"
        data-repo-id="R_kgDOPrKawQ"
        data-category="Generals"
        data-category-id="DIC_kwDOPrKawc4Cwfmj"
        data-mapping="pathname"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="top"
        data-theme="preferred_color_scheme"
        data-lang="es"
        crossorigin="anonymous"
        async>
    </script>`;
    openModal(commentsModal);
  }

  function displayCards(cards) {
    visibleCards = cards;
    cardGallery.innerHTML = cards.map((c, i) => `
      <div class="card-container" data-id="${c.id}" style="animation-delay:${i * 50}ms">
        <div class="card-inner">
          <div class="card-face card-back" style="background-image:url('assets/card_back/card_back${(i % 3) + 1}.webp')">
            <span class="card-back-prompt">${appData.ui_text.identify_prompt}</span>
          </div>
          <div class="card-face card-front" style="--card-front-image:url('assets/cards/card_${c.id}.webp')">
            <h3 class="card-title">${c.title}</h3>
          </div>
        </div>
      </div>`).join("");
  }

  function dealCards() {
    playSound("deal");
    initialDeckContainer.classList.add("hidden");
    searchBox.disabled = false;
    displayCards(appData.cards);
  }

  function setupEventListeners() {
    initialDeck.addEventListener("click", dealCards, { once: true });
    document.getElementById("changelog-btn").addEventListener("click", showChangelog);
    document.getElementById("legal-notice-btn").addEventListener("click", showLegalModal);
    commentsToggleBtn.addEventListener("click", showCommentsModal);
    modalOverlay.addEventListener("click", closeModal);
    settingsToggleBtn.addEventListener("click", e => {
      e.stopPropagation();
      playSound("button");
      const visible = settingsPanel.classList.toggle("visible");
      settingsToggleBtn.setAttribute("aria-expanded", visible);
    });
  }

  function initializeFuseSearch() {
    if (appData.cards) fuse = new Fuse(appData.cards, { keys: ["title"], threshold: 0.4 });
  }

  async function loadAudio() {
    for (const [name, url] of Object.entries(audioSources)) {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        audioBuffers[name] = await audioContext.decodeAudioData(buf);
      } catch {}
    }
  }

  function playSound(name) {
    if (!audioBuffers[name]) return;
    const src = audioContext.createBufferSource();
    src.buffer = audioBuffers[name];
    const gain = audioContext.createGain();
    gain.gain.value = settings.masterVolume;
    src.connect(gain).connect(audioContext.destination);
    src.start(0);
  }

  function loadSettings() {
    const saved = localStorage.getItem("grimorioSettingsV5");
    if (saved) Object.assign(settings, JSON.parse(saved));
  }

  function applySettings() {
    document.documentElement.style.setProperty("--theme-accent-color", settings.themeColor);
  }

  function calculatePactOfTheDay() {
    const d = new Date();
    const seed = d.getFullYear() * 1000 + d.getMonth() * 100 + d.getDate();
    pactOfTheDayId = appData.cards[(seed % appData.cards.length)]?.id;
  }

  init();
});
document.addEventListener("DOMContentLoaded", () => {
  const activationOverlay = document.getElementById("activation-overlay");
  const activationText = document.getElementById("activation-text");
  const initialDeck = document.getElementById("initial-deck");
  const initialDeckContainer = document.getElementById("initial-deck-container");
  const cardGallery = document.getElementById("card-gallery");
  const searchBox = document.getElementById("search-box");
  const clearSearchBtn = document.getElementById("clear-search-btn");
  const changelogModal = document.getElementById("changelog-modal");
  const legalModal = document.getElementById("legal-modal");
  const commentsModal = document.getElementById("comments-modal");
  const modalOverlay = document.getElementById("modal-overlay");
  const settingsToggleBtn = document.getElementById("settings-toggle-btn");
  const settingsPanel = document.getElementById("settings-panel");
  const commentsToggleBtn = document.getElementById("comments-toggle-btn");
  const cardViewModal = document.getElementById("card-view-modal");

  let appData = {};
  let fuse;
  let visibleCards = [];
  let pactOfTheDayId = -1;
  let currentCardIndex = -1;
  let activeModal = null;
  let audioContext;
  const audioBuffers = {};
  const audioSources = {
    deal: "assets/sounds/CardRep.mp3",
    flip: "assets/sounds/Flip.mp3",
    roll: "assets/sounds/CardRolls.mp3",
    logS: "assets/sounds/LogS.mp3",
    button: "assets/sounds/button.mp3"
  };
  const settings = { themeColor: "#dcbaff", cardBack: "default", auraEffect: "alfa", masterVolume: 0.7, mutedSounds: [], seenCards: [], legalAccepted: false };

  async function init() {
    try {
      const res = await fetch("app_data.json");
      if (!res.ok) throw new Error("No se pudo cargar app_data.json");
      appData = await res.json();
      activationText.textContent = "Listo para comenzar";
      activationOverlay.addEventListener("click", activateApp, { once: true });
    } catch {
      activationText.textContent = "Error al cargar datos. Verifica app_data.json.";
    }
  }

  async function activateApp() {
    activationOverlay.classList.add("hidden");
    document.body.classList.remove("no-scroll");
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await loadAudio();
    loadSettings();
    applySettings();
    calculatePactOfTheDay();
    setupEventListeners();
    initializeFuseSearch();
  }

  function closeAllPopups() {
    document.querySelectorAll(".modal.visible").forEach(m => m.classList.remove("visible"));
    document.querySelectorAll(".settings-panel.visible").forEach(s => s.classList.remove("visible"));
  }

  function openModal(modal) {
    closeAllPopups();
    activeModal = modal;
    modal.classList.add("visible");
    modalOverlay.classList.add("visible");
  }

  function closeModal() {
    if (!activeModal) return;
    playSound("button");
    activeModal.classList.remove("visible");
    modalOverlay.classList.remove("visible");
    activeModal = null;
  }

  function showChangelog() {
    const { version, changes, ai_note } = appData.changelog;
    changelogModal.innerHTML = `
      <button class="close-modal-btn" aria-label="Cerrar">X</button>
      <h2>Novedades (${version})</h2>
      <ul>${changes.map(c => `<li>${c}</li>`).join("")}</ul>
      <small>${ai_note}</small>`;
    changelogModal.querySelector(".close-modal-btn").addEventListener("click", closeModal);
    openModal(changelogModal);
  }

  function showLegalModal() {
    const { title, content } = appData.legal_text;
    legalModal.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2>${title}</h2>${content}`;
    legalModal.querySelector(".close-modal-btn").addEventListener("click", closeModal);
    openModal(legalModal);
  }

  function showCommentsModal() {
    const container = document.getElementById("giscus-container");
    container.classList.remove("hidden");
    container.innerHTML = `
    <script src="https://giscus.app/client.js"
        data-repo="CZeta415/WS-CardAlbum"
        data-repo-id="R_kgDOPrKawQ"
        data-category="Generals"
        data-category-id="DIC_kwDOPrKawc4Cwfmj"
        data-mapping="pathname"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="top"
        data-theme="preferred_color_scheme"
        data-lang="es"
        crossorigin="anonymous"
        async>
    </script>`;
    openModal(commentsModal);
  }

  function displayCards(cards) {
    visibleCards = cards;
    cardGallery.innerHTML = cards.map((c, i) => `
      <div class="card-container" data-id="${c.id}" style="animation-delay:${i * 50}ms">
        <div class="card-inner">
          <div class="card-face card-back" style="background-image:url('assets/card_back/card_back${(i % 3) + 1}.webp')">
            <span class="card-back-prompt">${appData.ui_text.identify_prompt}</span>
          </div>
          <div class="card-face card-front" style="--card-front-image:url('assets/cards/card_${c.id}.webp')">
            <h3 class="card-title">${c.title}</h3>
          </div>
        </div>
      </div>`).join("");
  }

  function dealCards() {
    playSound("deal");
    initialDeckContainer.classList.add("hidden");
    searchBox.disabled = false;
    displayCards(appData.cards);
  }

  function setupEventListeners() {
    initialDeck.addEventListener("click", dealCards, { once: true });
    document.getElementById("changelog-btn").addEventListener("click", showChangelog);
    document.getElementById("legal-notice-btn").addEventListener("click", showLegalModal);
    commentsToggleBtn.addEventListener("click", showCommentsModal);
    modalOverlay.addEventListener("click", closeModal);
    settingsToggleBtn.addEventListener("click", e => {
      e.stopPropagation();
      playSound("button");
      const visible = settingsPanel.classList.toggle("visible");
      settingsToggleBtn.setAttribute("aria-expanded", visible);
    });
  }

  function initializeFuseSearch() {
    if (appData.cards) fuse = new Fuse(appData.cards, { keys: ["title"], threshold: 0.4 });
  }

  async function loadAudio() {
    for (const [name, url] of Object.entries(audioSources)) {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        audioBuffers[name] = await audioContext.decodeAudioData(buf);
      } catch {}
    }
  }

  function playSound(name) {
    if (!audioBuffers[name]) return;
    const src = audioContext.createBufferSource();
    src.buffer = audioBuffers[name];
    const gain = audioContext.createGain();
    gain.gain.value = settings.masterVolume;
    src.connect(gain).connect(audioContext.destination);
    src.start(0);
  }

  function loadSettings() {
    const saved = localStorage.getItem("grimorioSettingsV5");
    if (saved) Object.assign(settings, JSON.parse(saved));
  }

  function applySettings() {
    document.documentElement.style.setProperty("--theme-accent-color", settings.themeColor);
  }

  function calculatePactOfTheDay() {
    const d = new Date();
    const seed = d.getFullYear() * 1000 + d.getMonth() * 100 + d.getDate();
    pactOfTheDayId = appData.cards[(seed % appData.cards.length)]?.id;
  }

  init();
});
