document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const activationOverlay = document.getElementById("activation-overlay");
    const activationText = document.getElementById("activation-text");
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
    const commentsModal = document.getElementById("comments-modal");
    const cardViewModal = document.getElementById("card-view-modal");

    // Global state
    let appData = {};
    let fuse;
    let visibleCards = [];
    let currentCardIndex = -1;
    let pactOfTheDayId = -1;
    let activeModal = null;
    let caughtErrors = [];
    let isGiscusLoaded = false;
    let audioContext;
    const audioBuffers = {};
    const audioSources = {
        deal: "assets/sounds/CardRep.mp3",
        flip: "assets/sounds/Flip.mp3",
        roll: "assets/sounds/CardRolls.mp3",
        logS: "assets/sounds/LogS.mp3",
        button: "assets/sounds/button.mp3",
    };
    
    let settings = {
        themeColor: "#dcbaff", cardBack: "default", auraEffect: "alfa",
        masterVolume: 0.7, mutedSounds: [], seenCards: [], legalAccepted: false
    };

    // --- INITIALIZATION ---
    async function init() {
        try {
            const response = await fetch("app_data.json");
            if (!response.ok) throw new Error("Could not load app_data.json");
            appData = await response.json();
            activationText.textContent = "Listo para el pacto.";
            activationOverlay.addEventListener("click", activateApp, { once: true });
        } catch (error) {
            handleError("init", error);
            activationText.textContent = "Error crítico al cargar datos. Refresca la página.";
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
            setupVisitorCounter();
            startSubtitleRotator();
            updateCardCounter();
            if (!settings.legalAccepted) { setTimeout(showLegalModal, 500); }
        } catch (error) {
            handleError("activateApp", error);
        }
    }
    
    function calculatePactOfTheDay() {
        if (!appData.cards?.length) return;
        const date = new Date();
        const seed = date.getFullYear() * 1000 + date.getMonth() * 100 + date.getDate();
        pactOfTheDayId = appData.cards[seed % appData.cards.length].id;
    }

    // --- UI & CARD HANDLING ---
    function dealCards() {
        playSound("deal");
        document.getElementById("initial-deck-container")?.classList.add("hidden");
        if(searchBox) {
            searchBox.disabled = false;
            searchBox.focus();
        }
        if (appData.cards) displayCards(appData.cards);
    }
    
    function displayCards(cards) {
        visibleCards = cards;
        cardGallery.innerHTML = "";
        noResultsMessage.classList.toggle("hidden", cards.length > 0);
        const fragment = document.createDocumentFragment();
        cards.forEach((card, index) => {
            const cardEl = createCardElement(card, index);
            if(cardEl) fragment.appendChild(cardEl);
        });
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
        if (!cardEl.classList.contains("flipped")) {
            playSound("flip");
            cardEl.classList.add("seen", "flipped");
            if (!settings.seenCards.includes(cardId)) {
                settings.seenCards.push(cardId);
                saveSettings();
                updateCardCounter();
            }
        }
        setTimeout(() => openCardViewModal(cardId), cardEl.classList.contains('flipped') ? 0 : 650);
    }
    
    function updateCardCounter() {
        if (!cardCounterElement || !appData.cards) return;
        cardCounterElement.textContent = `${settings.seenCards.length} / ${appData.cards.length} Reveladas`;
    }

    // --- SEARCH ---
    function initializeFuseSearch() {
        if (appData.cards) { fuse = new Fuse(appData.cards, { keys: ["title"], threshold: 0.4 }); }
    }

    function handleSearch(e) {
        const query = e.target.value;
        clearSearchBtn.style.display = query ? 'block' : 'none';
        const results = query ? fuse.search(query.trim()).map(result => result.item) : appData.cards;
        displayCards(results);
    }

    // --- MODALS ---
    function openModal(modal) {
        closeAllPopups();
        activeModal = modal;
        modal.classList.add("visible");
        modalOverlay.classList.add("visible");
        document.body.classList.add("no-scroll");
    }

    function closeModal() {
        if (!activeModal) return;
        playSound("button");
        if (activeModal.id === 'legal-modal' && !settings.legalAccepted) {
            settings.legalAccepted = true;
            saveSettings();
        }
        activeModal.classList.remove("visible");
        modalOverlay.classList.remove("visible");
        document.body.classList.remove("no-scroll");

        // Reset comments modal if it's the one being closed
        if (activeModal.id === 'comments-modal') {
            document.getElementById("giscus-container").classList.add("hidden");
            document.getElementById("comment-categories-container").classList.remove("hidden");
        }
        activeModal = null;
    }

    function showChangelog() {
        playSound("logS");
        const changelogModal = document.getElementById("changelog-modal");
        const { version, changes, ai_note } = appData.changelog;
        changelogModal.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2 id="changelog-title">Novedades (${version})</h2><ul>${changes.map(c => `<li>${c}</li>`).join("")}</ul><small>${ai_note}</small>`;
        openModal(changelogModal);
    }
    
    function showLegalModal() {
        playSound("logS");
        const legalModal = document.getElementById("legal-modal");
        const { title, content } = appData.legal_text;
        legalModal.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2 id="legal-title">${title}</h2>${content}`;
        openModal(legalModal);
    }
    
    // --- COMMENTS (GISCUS) ---
    function showCommentsModal() {
        playSound("button");
        const container = document.getElementById("comment-categories-container");
        container.innerHTML = "";
        
        appData.ui_text.comment_categories.forEach(cat => {
            const btn = document.createElement("button");
            btn.className = "category-btn";
            btn.dataset.category = cat.name;
            btn.innerHTML = `<span class="icon">${cat.icon}</span><span class="info"><span class="name">${cat.name}</span><span class="description">${cat.description}</span></span>`;
            btn.addEventListener("click", () => loadGiscus(cat.name));
            container.appendChild(btn);
        });

        openModal(commentsModal);
    }
    
    function loadGiscus(category) {
        document.getElementById("comment-categories-container").classList.add("hidden");
        const giscusContainer = document.getElementById("giscus-container");
        giscusContainer.innerHTML = ''; // Clear previous instance
        giscusContainer.classList.remove("hidden");

        const script = document.createElement("script");
        Object.assign(script, {
            src: "https://giscus.app/client.js",
            "data-repo": "CZeta415/WS-CardAlbum", "data-repo-id": "R_kgDOPrKawQ",
            "data-category": category, "data-mapping": "pathname", "data-strict": "0",
            "data-reactions-enabled": "1", "data-emit-metadata": "0",
            "data-input-position": "bottom", "data-theme": "preferred_color_scheme",
            "data-lang": "es", "data-loading": "lazy",
            crossorigin: "anonymous", async: true
        });
        giscusContainer.appendChild(script);
    }

    // --- CARD VIEW MODAL ---
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
        imgEl.onerror = () => imgEl.src = "assets/noise.webp";
        imgEl.alt = card.title;
    }
    
    function navigateCard(direction) {
        playSound("roll");
        currentCardIndex = (currentCardIndex + direction + visibleCards.length) % visibleCards.length;
        updateCardViewModal();
    }
    
    // --- SETTINGS & DATA MANAGEMENT ---
    function loadSettings() {
        try {
            const savedSettings = localStorage.getItem("grimorioSettingsV5");
            if (savedSettings) Object.assign(settings, JSON.parse(savedSettings));
        } catch (error) {
            handleError("loadSettings", error);
            console.error("Could not load settings, using defaults.", error);
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem("grimorioSettingsV5", JSON.stringify(settings));
        } catch (error) {
            handleError("saveSettings", error);
        }
    }
    
    function applySettings() {
        document.documentElement.style.setProperty("--theme-accent-color", settings.themeColor);
        document.querySelectorAll(".color-swatch").forEach(s => s.classList.toggle("selected", s.dataset.color === settings.themeColor));
        document.querySelectorAll(".card-back-option").forEach(opt => opt.classList.toggle("selected", opt.dataset.back === settings.cardBack));
        document.body.className = document.body.className.replace(/aura-effect-\w+/g, '');
        document.body.classList.add(`aura-effect-${settings.auraEffect}`);
        document.querySelector(`input[name="aura-effect"][value="${settings.auraEffect}"]`).checked = true;
        document.getElementById("master-volume-slider").value = settings.masterVolume;
        document.querySelectorAll("#sound-mute-toggles input").forEach(toggle => toggle.checked = settings.mutedSounds.includes(toggle.dataset.sound));
        if (cardGallery.innerHTML) displayCards(visibleCards);
    }
    
    function clearSeenCards() {
        if (confirm("¿Quieres volver a sellar todos los pactos (cartas reveladas)?")) {
            playSound("button");
            settings.seenCards = [];
            saveSettings();
            window.location.reload();
        }
    }

    function revealAllCards() {
        if (confirm("¿Quieres revelar todos los pactos al instante?")) {
            playSound("button");
            settings.seenCards = appData.cards.map(c => c.id);
            saveSettings();
            document.querySelectorAll(".card-container:not(.flipped)").forEach(el => el.classList.add("seen", "flipped"));
            updateCardCounter();
        }
    }
    
    // --- UTILITIES ---
    function handleError(source, error) { caughtErrors.push({ source, message: error.message }); console.error(`Error in ${source}:`, error); }

    function copyDebugInfo() {
        playSound("button");
        const debugData = {
            timestamp: new Date().toISOString(), url: window.location.href, userAgent: navigator.userAgent,
            screen: { width: window.innerWidth, height: window.innerHeight }, settings, errors: caughtErrors,
        };
        navigator.clipboard.writeText(JSON.stringify(debugData, null, 2))
            .then(() => alert("Información de depuración copiada al portapapeles."))
            .catch(err => console.error("Failed to copy debug info:", err));
    }
    
    async function setupVisitorCounter() {
        const counterContainer = document.getElementById("visitor-counter");
        const counterElement = document.getElementById("visitor-count");
        try {
            const response = await fetch("https://api.counterapi.dev/v1/grimorio-muerte/pactos-v3-fix/up");
            if (!response.ok) throw new Error("Counter API failed");
            const data = await response.json();
            counterElement.textContent = data.count.toLocaleString("es-ES");
        } catch (error) {
            handleError("visitorCounter", error);
            counterContainer.style.display = "none";
        }
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
            const backs = ["assets/card_back/card_back.webp", "assets/card_back/card_back2.webp", "assets/card_back/card_back3.webp"];
            return backs[index % backs.length];
        }
        return settings.cardBack;
    }

    // --- AUDIO ---
    async function loadAudio() {
        const promises = Object.entries(audioSources).map(async ([name, url]) => {
            try {
                if(!audioContext) return;
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                audioBuffers[name] = await audioContext.decodeAudioData(arrayBuffer);
            } catch (error) { handleError(`loadAudio:${name}`, error); }
        });
        await Promise.all(promises);
    }

    function playSound(name) {
        if (!audioContext || !audioBuffers[name] || settings.mutedSounds.includes(name)) return;
        if (audioContext.state === "suspended") audioContext.resume();
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffers[name];
        const gainNode = audioContext.createGain();
        gainNode.gain.value = settings.masterVolume;
        source.connect(gainNode).connect(audioContext.destination);
        source.start(0);
    }
    
    // --- EVENT LISTENERS SETUP ---
    function setupEventListeners() {
        initialDeck.addEventListener("click", dealCards, { once: true });
        searchBox.addEventListener("input", handleSearch);
        clearSearchBtn.addEventListener("click", () => {
            searchBox.value = '';
            searchBox.dispatchEvent(new Event('input'));
            searchBox.focus();
        });

        cardGallery.addEventListener("click", e => { e.target.closest(".card-container")?.click(); });
        cardGallery.addEventListener("click", e => { const el = e.target.closest(".card-container"); if (el) handleCardClick(el); });
        
        document.addEventListener("click", e => {
            if (settingsPanel && !settingsPanel.contains(e.target) && !settingsToggleBtn.contains(e.target) && settingsPanel.classList.contains('visible')) {
                closeAllPopups();
            }
        });
        
        function closeAllPopups() {
            if (settingsPanel.classList.contains('visible')) {
                settingsPanel.classList.remove("visible");
                settingsToggleBtn.setAttribute('aria-expanded', 'false');
            }
        }
        
        modalOverlay.addEventListener("click", closeModal);
        document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', closeModal));
        document.getElementById("prev-card-btn").addEventListener("click", e => { e.stopPropagation(); navigateCard(-1); });
        document.getElementById("next-card-btn").addEventListener("click", e => { e.stopPropagation(); navigateCard(1); });

        document.addEventListener("keydown", e => {
            if (e.key === "Escape") activeModal ? closeModal() : closeAllPopups();
            if (activeModal === cardViewModal) {
                if (e.key === "ArrowLeft") navigateCard(-1);
                if (e.key === "ArrowRight") navigateCard(1);
            }
        });
        
        document.getElementById("changelog-btn").addEventListener("click", showChangelog);
        commentsToggleBtn.addEventListener("click", showCommentsModal);
        settingsToggleBtn.addEventListener("click", e => {
            e.stopPropagation(); playSound("button");
            const isVisible = settingsPanel.classList.toggle("visible");
            settingsToggleBtn.setAttribute('aria-expanded', isVisible);
        });

        document.getElementById("theme-color-selector").addEventListener("click", e => { if (e.target.matches(".color-swatch")) { playSound("button"); settings.themeColor = e.target.dataset.color; applySettings(); saveSettings(); } });
        document.getElementById("card-back-selector").addEventListener("click", e => { if (e.target.matches(".card-back-option")) { playSound("button"); settings.cardBack = e.target.dataset.back; applySettings(); saveSettings(); } });
        document.querySelector(".setting-toggle").addEventListener("change", e => { if (e.target.matches("input[name='aura-effect']")){ playSound("button"); settings.auraEffect = e.target.value; applySettings(); saveSettings(); }});
        
        const volumeSlider = document.getElementById("master-volume-slider");
        volumeSlider.addEventListener("input", e => settings.masterVolume = parseFloat(e.target.value));
        volumeSlider.addEventListener("change", () => { playSound("button"); saveSettings(); });
        
        document.getElementById("sound-mute-toggles").addEventListener("change", e => {
            if (e.target.matches("input[type='checkbox']")) {
                const soundName = e.target.dataset.sound;
                if (e.target.checked) { if(!settings.mutedSounds.includes(soundName)) settings.mutedSounds.push(soundName); }
                else { settings.mutedSounds = settings.mutedSounds.filter(s => s !== soundName); }
                saveSettings();
            }
        });
        
        document.getElementById("reveal-all-btn").addEventListener("click", revealAllCards);
        document.getElementById("clear-seen-btn").addEventListener("click", clearSeenCards);
        document.getElementById("reset-settings-btn").addEventListener("click", () => { if (confirm("¿Seguro que quieres borrar TODOS los ajustes y el progreso? Esta acción no se puede deshacer.")) { localStorage.removeItem("grimorioSettingsV5"); window.location.reload(); }});
        document.getElementById("legal-notice-btn").addEventListener("click", showLegalModal);
        document.getElementById("debug-copy-btn").addEventListener("click", copyDebugInfo);
    }
    
    init();
});