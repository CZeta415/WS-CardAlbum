document.addEventListener("DOMContentLoaded", () => {
    // --- ELEMENTOS DEL DOM ---
    const activationOverlay = document.getElementById("activation-overlay");
    const activationText = document.getElementById("activation-text");
    const initialDeckContainer = document.getElementById("initial-deck-container");
    const initialDeck = document.getElementById("initial-deck");
    const cardGallery = document.getElementById("card-gallery");
    const searchBox = document.getElementById("search-box");
    const clearSearchBtn = document.getElementById("clear-search-btn");
    const noResultsMessage = document.getElementById("no-results-message");
    const dynamicSubtitle = document.getElementById("dynamic-subtitle");
    const cardCounterElement = document.getElementById("card-counter");
    const settingsToggleBtn = document.getElementById("settings-toggle-btn");
    const settingsPanel = document.getElementById("settings-panel");
    const commentsToggleBtn = document.getElementById("comments-toggle-btn");
    const modalOverlay = document.getElementById("modal-overlay");
    const changelogModal = document.getElementById("changelog-modal");
    const legalModal = document.getElementById("legal-modal");
    const commentsModal = document.getElementById("comments-modal");
    const cardViewModal = document.getElementById("card-view-modal");

    // --- ESTADO GLOBAL ---
    let appData = {};
    let fuse;
    let visibleCards = [];
    let currentCardIndex = -1;
    let pactOfTheDayId = -1;
    let activeModal = null;
    let caughtErrors = [];
    let audioContext;
    const audioBuffers = {};
    const audioSources = {
        deal: "assets/sounds/CardRep.mp3",
        flip: "assets/sounds/Flip.mp3",
        roll: "assets/sounds/CardRolls.mp3",
        logS: "assets/sounds/LogS.mp3",
        button: "assets/sounds/button.mp3"
    };
    let settings = {
        themeColor: "#dcbaff",
        cardBack: "default",
        auraEffect: "alfa",
        masterVolume: 0.7,
        mutedSounds: [],
        seenCards: [],
        legalAccepted: false
    };

    // --- INICIALIZACIÓN ---
    async function init() {
        try {
            const response = await fetch("app_data.json");
            if (!response.ok) throw new Error("No se pudo cargar app_data.json");
            appData = await response.json();
            activationText.textContent = "Listo para el pacto.";
            activationOverlay.addEventListener("click", activateApp, { once: true });
        } catch (error) {
            handleError("init", error);
            activationText.textContent = "Error al cargar datos. Verifica que app_data.json esté junto a index.html.";
        }
    }

    async function activateApp() {
        activationOverlay.classList.add("hidden");
        document.body.classList.remove("no-scroll");
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await loadAudio();
            loadSettings();
            applySettings();
            calculatePactOfTheDay();
            setupEventListeners();
            initializeFuseSearch();
            startSubtitleRotator();
            updateCardCounter();
            if (!settings.legalAccepted) setTimeout(showLegalModal, 500);
        } catch (error) {
            handleError("activateApp", error);
        }
    }

    // --- FUNCIONES DE MODALES ---
    function closeAllPopups() {
        document.querySelectorAll(".modal.visible").forEach(m => m.classList.remove("visible"));
        document.querySelectorAll(".settings-panel.visible").forEach(s => s.classList.remove("visible"));
        modalOverlay?.classList.remove("visible");
        activeModal = null;
    }

    function openModal(modal) {
        if (!modal) return;
        closeAllPopups();
        activeModal = modal;
        modal.classList.add("visible");
        modalOverlay.classList.add("visible");
        document.body.classList.add("no-scroll");
    }

    function closeModal() {
        if (!activeModal) return;
        playSound("button");
        if (activeModal === legalModal && !settings.legalAccepted) {
            settings.legalAccepted = true;
            saveSettings();
        }
        activeModal.classList.remove("visible");
        modalOverlay.classList.remove("visible");
        document.body.classList.remove("no-scroll");
        activeModal = null;
    }

    // --- MODALES ESPECÍFICOS ---
    function showChangelog() {
        playSound("logS");
        if (!changelogModal || !appData.changelog) return;
        const { version, changes, ai_note } = appData.changelog;
        changelogModal.innerHTML = `
            <button class="close-modal-btn" aria-label="Cerrar">X</button>
            <h2 id="changelog-title">Novedades (${version})</h2>
            <ul>${changes.map(c => `<li>${c}</li>`).join("")}</ul>
            <small>${ai_note}</small>`;
        openModal(changelogModal);
        changelogModal.querySelector(".close-modal-btn")?.addEventListener("click", closeModal);
    }

    function showLegalModal() {
        playSound("logS");
        if (!legalModal || !appData.legal_text) return;
        const { title, content } = appData.legal_text;
        legalModal.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2 id="legal-title">${title}</h2>${content}`;
        openModal(legalModal);
        legalModal.querySelector(".close-modal-btn")?.addEventListener("click", closeModal);
    }

    function showCommentsModal() {
        playSound("button");
        const giscusContainer = document.getElementById("giscus-container");
        if (!giscusContainer) return;
        giscusContainer.innerHTML = "";
        giscusContainer.classList.remove("hidden");

        const script = document.createElement("script");
        Object.assign(script, {
            src: "https://giscus.app/client.js",
            "data-repo": "CZeta415/WS-CardAlbum",
            "data-repo-id": "R_kgDOPrKawQ",
            "data-category": "General",
            "data-category-id": "DIC_kwDOPrKawc4Cwfmj",
            "data-mapping": "pathname",
            "data-strict": "0",
            "data-reactions-enabled": "1",
            "data-emit-metadata": "0",
            "data-input-position": "top",
            "data-theme": "preferred_color_scheme",
            "data-lang": "es",
            "data-loading": "lazy",
            crossorigin: "anonymous",
            async: true
        });
        giscusContainer.appendChild(script);
        openModal(commentsModal);
        commentsModal.querySelector(".close-modal-btn")?.addEventListener("click", closeModal);
    }

    // --- CARTAS ---
    function dealCards() {
        playSound("deal");
        initialDeckContainer?.classList.add("hidden");
        if (searchBox) {
            searchBox.disabled = false;
            searchBox.focus();
        }
        if (appData.cards) displayCards(appData.cards);
    }

    function displayCards(cards) {
        visibleCards = cards;
        cardGallery.innerHTML = "";
        noResultsMessage?.classList.toggle("hidden", cards.length > 0);
        const fragment = document.createDocumentFragment();
        cards.forEach((card, index) => fragment.appendChild(createCardElement(card, index)));
        cardGallery.appendChild(fragment);
    }

    function createCardElement(card, index) {
        const cardContainer = document.createElement("div");
        cardContainer.className = "card-container";
        cardContainer.style.animationDelay = `${index * 50}ms`;
        if (settings.seenCards.includes(card.id)) cardContainer.classList.add("seen", "flipped");
        if (card.id === pactOfTheDayId) cardContainer.classList.add("pact-of-the-day");
        cardContainer.dataset.id = card.id;
        cardContainer.innerHTML = `
            <div class="card-inner">
                <div class="card-face card-back" style="background-image: url('${getCardBackUrl(index)}')">
                    <span class="card-back-prompt">${appData.ui_text.identify_prompt || "Identificar"}</span>
                </div>
                <div class="card-face card-front" style="--card-front-image: url('assets/cards/card_${card.id}.webp')">
                    <h3 class="card-title">${card.title}</h3>
                </div>
            </div>`;
        return cardContainer;
    }

    function handleCardClick(cardEl) {
        const cardId = parseInt(cardEl.dataset.id, 10);
        const wasFlipped = cardEl.classList.contains("flipped");
        if (!wasFlipped) {
            playSound("flip");
            cardEl.classList.add("seen", "flipped");
            if (!settings.seenCards.includes(cardId)) {
                settings.seenCards.push(cardId);
                saveSettings();
                updateCardCounter();
            }
        }
        setTimeout(() => openCardViewModal(cardId), wasFlipped ? 0 : 650);
    }

    function openCardViewModal(cardId) {
        playSound("roll");
        currentCardIndex = visibleCards.findIndex(c => c.id === cardId);
        if (currentCardIndex === -1) return;
        updateCardViewModal();
        openModal(cardViewModal);
    }

    function updateCardViewModal() {
        const card = visibleCards[currentCardIndex];
        document.getElementById("card-view-title").textContent = card.title;
        document.getElementById("card-view-description").innerHTML = card.description;
        const imgEl = document.getElementById("card-view-image");
        imgEl.src = `assets/cards/card_${card.id}.webp`;
        imgEl.alt = card.title;
    }

    // --- UTILIDADES ---
    function updateCardCounter() {
        if (!cardCounterElement || !appData.cards) return;
        cardCounterElement.textContent = `${settings.seenCards.length} / ${appData.cards.length} Reveladas`;
    }

    function startSubtitleRotator() {
        if (dynamicSubtitle && appData.ui_text?.dynamic_subtitles) {
            setInterval(() => {
                const subtitles = appData.ui_text.dynamic_subtitles;
                dynamicSubtitle.textContent = subtitles[Math.floor(Math.random() * subtitles.length)];
            }, 10000);
        }
    }

    function getCardBackUrl(index) {
        if (settings.cardBack === "default") {
            const backs = [
                "assets/card_back/card_back.webp",
                "assets/card_back/card_back2.webp",
                "assets/card_back/card_back3.webp"
            ];
            return backs[index % backs.length];
        }
        return settings.cardBack;
    }

    function calculatePactOfTheDay() {
        const date = new Date();
        const seed = date.getFullYear() * 1000 + date.getMonth() * 100 + date.getDate();
        pactOfTheDayId = appData.cards[(seed % appData.cards.length)]?.id;
    }

    function handleError(source, error) {
        caughtErrors.push({ source, message: error.message });
        console.error(`Error en ${source}:`, error);
    }

    // --- AUDIO ---
    async function loadAudio() {
        const promises = Object.entries(audioSources).map(async ([name, url]) => {
            try {
                if (!audioContext) return;
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                audioBuffers[name] = await audioContext.decodeAudioData(arrayBuffer);
            } catch (error) { handleError(`loadAudio:${name}`, error); }
        });
        await Promise.all(promises);
    }

    function playSound(name) {
        if (!audioContext || !audioBuffers[name] || settings.mutedSounds.includes(name)) return;
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffers[name];
        const gainNode = audioContext.createGain();
        gainNode.gain.value = settings.masterVolume;
        source.connect(gainNode).connect(audioContext.destination);
        source.start(0);
    }

    // --- AJUSTES ---
    function loadSettings() {
        try {
            const saved = localStorage.getItem("grimorioSettingsV5");
            if (saved) Object.assign(settings, JSON.parse(saved));
        } catch (error) { handleError("loadSettings", error); }
    }

    function saveSettings() {
        try {
            localStorage.setItem("grimorioSettingsV5", JSON.stringify(settings));
        } catch (error) { handleError("saveSettings", error); }
    }

    function applySettings() {
        document.documentElement.style.setProperty("--theme-accent-color", settings.themeColor);
    }

    // --- EVENTOS ---
    function setupEventListeners() {
        initialDeck?.addEventListener("click", dealCards, { once: true });
        searchBox?.addEventListener("input", () => {
            if (!fuse) return;
            const q = searchBox.value.trim();
            clearSearchBtn.style.display = q ? "block" : "none";
            const results = q ? fuse.search(q).map(r => r.item) : appData.cards;
            displayCards(results);
        });
        clearSearchBtn?.addEventListener("click", () => {
            searchBox.value = "";
            searchBox.dispatchEvent(new Event("input"));
        });
        cardGallery?.addEventListener("click", e => {
            const cardEl = e.target.closest(".card-container");
            if (cardEl) handleCardClick(cardEl);
        });
        modalOverlay?.addEventListener("click", closeModal);
        document.querySelectorAll(".close-modal-btn").forEach(btn => btn.addEventListener("click", closeModal));
        document.getElementById("changelog-btn")?.addEventListener("click", showChangelog);
        commentsToggleBtn?.addEventListener("click", showCommentsModal);
        settingsToggleBtn?.addEventListener("click", e => {
            e.stopPropagation();
            playSound("button");
            const visible = settingsPanel.classList.toggle("visible");
            settingsToggleBtn.setAttribute("aria-expanded", visible);
        });
    }

    // --- BÚSQUEDA ---
    function initializeFuseSearch() {
        if (appData.cards) fuse = new Fuse(appData.cards, { keys: ["title"], threshold: 0.4 });
    }

    init();
});
