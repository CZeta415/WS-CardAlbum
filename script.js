document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const activationOverlay = document.getElementById("activation-overlay");
    const activationText = document.getElementById("activation-text");
    const initialDeckContainer = document.getElementById("initial-deck-container");
    const initialDeck = document.getElementById("initial-deck");
    const cardGallery = document.getElementById("card-gallery");
    const searchBox = document.getElementById("search-box");
    const noResultsMessage = document.getElementById("no-results-message");
    const dynamicSubtitle = document.getElementById("dynamic-subtitle");
    const cardCounterElement = document.getElementById("card-counter");

    // Popups and Modals
    const settingsToggleBtn = document.getElementById("settings-toggle-btn");
    const settingsPanel = document.getElementById("settings-panel");
    const changelogBtn = document.getElementById("changelog-btn");
    const modalOverlay = document.getElementById("modal-overlay");
    const changelogModal = document.getElementById("changelog-modal");
    const cardViewModal = document.getElementById("card-view-modal");
    const legalModal = document.getElementById("legal-modal");
    
    // Global state
    let appData = {};
    let fuse;
    let visibleCards = [];
    let currentCardIndex = -1;
    let pactOfTheDayId = -1;
    let activeModal = null;
    let caughtErrors = []; // For debug reporting

    // Audio
    let audioContext;
    const audioBuffers = {};
    const audioSources = {
        deal: "assets/sounds/CardRep.mp3",
        flip: "assets/sounds/Flip.mp3",
        roll: "assets/sounds/CardRolls.mp3", // Corrected filename as requested
        logS: "assets/sounds/LogS.mp3",
        button: "assets/sounds/button.mp3",
    };
    
    // Default settings
    let settings = {
        themeColor: "#dcbaff",
        cardBack: "default",
        auraEffect: "alfa",
        masterVolume: 0.7,
        mutedSounds: [],
        seenCards: [],
        legalAccepted: false
    };

    // --- INITIALIZATION ---
    async function init() {
        try {
            const response = await fetch("app_data.json");
            if (!response.ok) throw new Error("Could not load app_data.json");
            appData = await response.json();
            
            preloadAssets();
            activationText.textContent = "Listo para el pacto.";
            activationOverlay.addEventListener("click", activateApp, { once: true });
        } catch (error) {
            caughtErrors.push({ source: "init", message: error.message, stack: error.stack });
            activationText.textContent = "Error crítico al cargar datos. Refresca la página.";
            console.error(error);
        }
    }

    async function activateApp() {
        try {
            activationOverlay.classList.add("hidden");
            
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
            
            document.body.classList.remove("no-scroll");

            if (!settings.legalAccepted) {
                setTimeout(showLegalModal, 500);
            }
        } catch (error) {
            caughtErrors.push({ source: "activateApp", message: error.message, stack: error.stack });
            console.error("Error during app activation:", error);
            // Non-critical error, the app might still be partially functional.
        }
    }

    async function preloadAssets() {
        // Pre-fetch assets without blocking
        Object.values(audioSources).forEach(url => fetch(url));
        if (appData.cards) {
            appData.cards.forEach(card => {
                const img = new Image();
                img.src = `assets/cards/card_${card.id}.webp`;
            });
        }
    }

    function calculatePactOfTheDay() {
        const date = new Date();
        const seed = date.getFullYear() * 1000 + date.getMonth() * 100 + date.getDate();
        if (appData.cards && appData.cards.length > 0) {
            pactOfTheDayId = (seed % appData.cards.length) + 1;
        }
    }
    
    // --- UI & CARD LOGIC ---
    function dealCards() {
        playSound("deal");
        if(initialDeckContainer) initialDeckContainer.classList.add("hidden");
        if(searchBox) {
            searchBox.disabled = false;
            searchBox.focus();
        }
        if (appData.cards) displayCards(appData.cards);
    }
    
    function displayCards(cards) {
        visibleCards = cards;
        if (cardGallery) cardGallery.innerHTML = "";
        if (noResultsMessage) noResultsMessage.classList.toggle("hidden", cards.length > 0);

        const fragment = document.createDocumentFragment();
        cards.forEach((card, index) => {
            const cardEl = createCardElement(card, index);
            if(cardEl) {
                cardEl.style.animationDelay = `${index * 50}ms`;
                fragment.appendChild(cardEl);
            }
        });
        if(cardGallery) cardGallery.appendChild(fragment);
    }

    function createCardElement(card, index) {
        const cardContainer = document.createElement("div");
        cardContainer.className = "card-container";
        if (settings.seenCards.includes(card.id)) {
            cardContainer.classList.add("seen", "flipped");
        }
        if (card.id === pactOfTheDayId) {
            cardContainer.classList.add("pact-of-the-day");
        }
        cardContainer.dataset.id = card.id;
        const cardBackImage = getCardBackUrl(index);
        const cardFrontImage = `assets/cards/card_${card.id}.webp`;
        cardContainer.innerHTML = `
            <div class="card-inner">
                <div class="card-face card-back" style="background-image: url('${cardBackImage}')">
                    <span class="card-back-prompt">${appData.ui_text.identify_prompt || "Identificar"}</span>
                </div>
                <div class="card-face card-front" style="--card-front-image: url('${cardFrontImage}')">
                    <div class="card-front-content">
                         <h3 class="card-title">${card.title}</h3>
                    </div>
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
    
    function updateCardCounter() {
        if (!cardCounterElement || !appData.cards) return;
        const revealedCount = settings.seenCards.length;
        const totalCount = appData.cards.length;
        cardCounterElement.textContent = `${revealedCount} / ${totalCount} Reveladas`;
    }
    
    // --- SEARCH ---
    function initializeFuseSearch() {
        if (appData.cards) {
            fuse = new Fuse(appData.cards, { keys: ["title"], threshold: 0.4 });
        }
    }

    function handleSearch() {
        if (!fuse) return;
        const query = searchBox.value.trim();
        const results = query ? fuse.search(query).map(result => result.item) : appData.cards;
        displayCards(results);
    }

    // --- MODALS & POPUPS ---
    function openModal(modal) {
        if(!modal) return;
        closeAllPopups();
        activeModal = modal;
        modal.classList.add("visible");
        if(modalOverlay) modalOverlay.classList.add("visible");
        document.body.classList.add("no-scroll");
    }

    function closeModal() {
        if (activeModal) {
            playSound("button");
            if(activeModal === legalModal) {
                settings.legalAccepted = true;
                saveSettings();
            }
            activeModal.classList.remove("visible");
            activeModal = null;
        }
        if(modalOverlay) modalOverlay.classList.remove("visible");
        document.body.classList.remove("no-scroll");
    }
    
    function closeAllPopups() {
        if (activeModal) closeModal();
        if(settingsPanel) settingsPanel.classList.remove("visible");
    }
    
    function showChangelog() {
        playSound("logS");
        const { version, changes, ai_note } = appData.changelog;
        if(changelogModal){
            changelogModal.innerHTML = `
                <button class="close-modal-btn" aria-label="Cerrar">X</button>
                <h2>Registro de Cambios (${version})</h2>
                <ul>${changes.map(change => `<li>${change}</li>`).join("")}</ul>
                <small>${ai_note}</small>`;
            openModal(changelogModal);
        }
    }
    
    function showLegalModal() {
        playSound("logS");
        const { title, content } = appData.legal_text;
        if(legalModal){
            legalModal.innerHTML = `
                <button class="close-modal-btn" aria-label="Cerrar">X</button>
                <h2>${title}</h2>${content}`;
            openModal(legalModal);
        }
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
        if(!cardViewModal) return;
        const card = visibleCards[currentCardIndex];
        const titleEl = document.getElementById("card-view-title");
        const descEl = document.getElementById("card-view-description");
        const imgEl = document.getElementById("card-view-image");

        if(titleEl) titleEl.textContent = card.title;
        if(descEl) descEl.innerHTML = card.description;
        if(imgEl) {
            imgEl.src = `assets/cards/card_${card.id}.webp`;
            imgEl.onerror = () => imgEl.src = "assets/noise.webp";
            imgEl.alt = card.title;
        }
    }
    
    function navigateCard(direction) {
        playSound("roll");
        currentCardIndex = (currentCardIndex + direction + visibleCards.length) % visibleCards.length;
        updateCardViewModal();
    }
    
    // --- SETTINGS & DATA ---
    function loadSettings() {
        try {
            const savedSettings = localStorage.getItem("grimorioSettingsV5");
            if (savedSettings) {
                settings = { ...settings, ...JSON.parse(savedSettings) };
            }
        } catch (error) {
            caughtErrors.push({ source: "loadSettings", message: error.message });
            console.error("Could not load settings, using defaults.", error);
            // Proceed with default settings
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem("grimorioSettingsV5", JSON.stringify(settings));
        } catch (error) {
             caughtErrors.push({ source: "saveSettings", message: error.message });
            console.error("Could not save settings.", error);
        }
    }
    
    function applySettings() {
        document.documentElement.style.setProperty("--theme-accent-color", settings.themeColor);
        document.querySelectorAll(".color-swatch").forEach(s => s.classList.toggle("selected", s.dataset.color === settings.themeColor));
        document.querySelectorAll(".card-back-option").forEach(opt => opt.classList.toggle("selected", opt.dataset.back === settings.cardBack));
        document.body.className = `no-scroll aura-effect-${settings.auraEffect}`;
        const auraRadio = document.querySelector(`input[name="aura-effect"][value="${settings.auraEffect}"]`);
        if (auraRadio) auraRadio.checked = true;
        const volumeSlider = document.getElementById("master-volume-slider");
        if(volumeSlider) volumeSlider.value = settings.masterVolume;
        document.querySelectorAll("#sound-mute-toggles input").forEach(toggle => {
            toggle.checked = settings.mutedSounds.includes(toggle.dataset.sound);
        });
        if (cardGallery && cardGallery.innerHTML) displayCards(visibleCards);
    }
    
    function resetSettings() {
        if (confirm("¿Seguro que quieres borrar TODOS los ajustes y el progreso? Esta acción no se puede deshacer.")) {
            playSound("button");
            localStorage.removeItem("grimorioSettingsV5");
            window.location.reload();
        }
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
            if (appData.cards) settings.seenCards = appData.cards.map(c => c.id);
            saveSettings();
            document.querySelectorAll(".card-container:not(.flipped)").forEach(el => el.classList.add("seen", "flipped"));
            updateCardCounter();
        }
    }

    function copyDebugInfo() {
        playSound("button");
        const debugData = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            screen: { width: window.innerWidth, height: window.innerHeight },
            settings: settings,
            errors: caughtErrors,
        };
        
        navigator.clipboard.writeText(JSON.stringify(debugData, null, 2))
            .then(() => alert("Información de depuración copiada al portapapeles."))
            .catch(err => {
                console.error("Failed to copy debug info:", err);
                alert("No se pudo copiar la información. Revisa la consola.");
            });
    }
    
    // --- UTILITIES ---
    async function setupVisitorCounter() {
        const counterContainer = document.getElementById("visitor-counter");
        const counterElement = document.getElementById("visitor-count");
        if(!counterContainer || !counterElement) return;

        try {
            const response = await fetch("https://api.counterapi.dev/v1/grimorio-muerte/pactos-v3-fix/up");
            if (!response.ok) throw new Error("Counter API failed");
            const data = await response.json();
            counterElement.textContent = data.count.toLocaleString("es-ES");
        } catch (error) {
            caughtErrors.push({ source: "visitorCounter", message: error.message });
            console.error("Visitor counter failed:", error);
            counterContainer.style.display = "none";
        }
    }
    
    function startSubtitleRotator() {
        if (dynamicSubtitle && appData.ui_text && appData.ui_text.dynamic_subtitles) {
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
            } catch (error) {
                caughtErrors.push({ source: `loadAudio:${name}`, message: error.message });
                console.error(`Error loading audio ${name}:`, error);
            }
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
        if (initialDeck) initialDeck.addEventListener("click", dealCards, { once: true });
        if (searchBox) searchBox.addEventListener("input", handleSearch);
        if (cardGallery) cardGallery.addEventListener("click", e => {
            const cardElement = e.target.closest(".card-container");
            if (cardElement) handleCardClick(cardElement);
        });

        document.addEventListener("click", e => {
            if (settingsPanel && !settingsPanel.contains(e.target) && !settingsToggleBtn.contains(e.target)) {
                settingsPanel.classList.remove("visible");
            }
            if (e.target.closest(".close-modal-btn")) {
                closeModal();
            }
        });
        
        if (modalOverlay) modalOverlay.addEventListener("click", closeModal);
        const prevBtn = document.getElementById("prev-card-btn");
        const nextBtn = document.getElementById("next-card-btn");
        if (prevBtn) prevBtn.addEventListener("click", e => { e.stopPropagation(); navigateCard(-1); });
        if (nextBtn) nextBtn.addEventListener("click", e => { e.stopPropagation(); navigateCard(1); });
        
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") closeModal();
            if (activeModal === cardViewModal) {
                if (e.key === "ArrowLeft") navigateCard(-1);
                if (e.key === "ArrowRight") navigateCard(1);
            }
        });
        
        if (changelogBtn) changelogBtn.addEventListener("click", e => { e.stopPropagation(); showChangelog(); });
        if (settingsToggleBtn) settingsToggleBtn.addEventListener("click", e => { 
            e.stopPropagation();
            playSound("button");
            if(settingsPanel) settingsPanel.classList.toggle("visible"); 
        });

        // Settings Panel Listeners
        const themeSelector = document.getElementById("theme-color-selector");
        if (themeSelector) themeSelector.addEventListener("click", e => {
            if (e.target.matches(".color-swatch")) { playSound("button"); settings.themeColor = e.target.dataset.color; applySettings(); saveSettings(); }
        });
        
        const backSelector = document.getElementById("card-back-selector");
        if (backSelector) backSelector.addEventListener("click", e => {
            if (e.target.matches(".card-back-option")) { playSound("button"); settings.cardBack = e.target.dataset.back; applySettings(); saveSettings(); }
        });

        const auraSelector = settingsPanel?.querySelector("input[name='aura-effect']");
        if (auraSelector) auraSelector.parentElement.parentElement.addEventListener("change", e => {
            playSound("button"); settings.auraEffect = e.target.value; applySettings(); saveSettings();
        });

        const volumeSlider = document.getElementById("master-volume-slider");
        if (volumeSlider) {
            volumeSlider.addEventListener("input", e => settings.masterVolume = parseFloat(e.target.value));
            volumeSlider.addEventListener("change", () => { playSound("button"); saveSettings(); });
        }
        
        const muteToggles = document.getElementById("sound-mute-toggles");
        if(muteToggles) muteToggles.addEventListener("change", e => {
            if (e.target.matches("input[type='checkbox']")) {
                const soundName = e.target.dataset.sound;
                if (e.target.checked) settings.mutedSounds.push(soundName);
                else settings.mutedSounds = settings.mutedSounds.filter(s => s !== soundName);
                saveSettings();
            }
        });
        
        document.getElementById("reveal-all-btn")?.addEventListener("click", revealAllCards);
        document.getElementById("clear-seen-btn")?.addEventListener("click", clearSeenCards);
        document.getElementById("reset-settings-btn")?.addEventListener("click", resetSettings);
        document.getElementById("legal-notice-btn")?.addEventListener("click", showLegalModal);
        document.getElementById("debug-copy-btn")?.addEventListener("click", copyDebugInfo);
        document.getElementById("discord-link")?.addEventListener("click", () => playSound("button"));
    }
    
    init();
});