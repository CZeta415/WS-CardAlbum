document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    // Se obtienen todas las referencias a los elementos del DOM al inicio para mayor claridad y rendimiento.
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
    
    // --- Global State ---
    let appData = {};
    let fuse;
    let visibleCards = [];
    let currentCardIndex = -1;
    let pactOfTheDayId = -1;
    let activeModal = null;
    let caughtErrors = [];
    let audioContext;
    const audioBuffers = {};
    const audioSources = { deal: "assets/sounds/CardRep.mp3", flip: "assets/sounds/Flip.mp3", roll: "assets/sounds/CardRolls.mp3", logS: "assets/sounds/LogS.mp3", button: "assets/sounds/button.mp3" };
    let settings = { themeColor: "#dcbaff", cardBack: "default", auraEffect: "alfa", masterVolume: 0.7, mutedSounds: [], seenCards: [], legalAccepted: false };

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
            setupEventListeners(); // Esto se ejecutará de forma segura ahora.
            initializeFuseSearch();
            setupVisitorCounter();
            startSubtitleRotator();
            updateCardCounter();
            if (!settings.legalAccepted) {
                setTimeout(showLegalModal, 500);
            }
        } catch (error) {
            handleError("activateApp", error);
        }
    }
    
    // --- UI & CARD HANDLING ---
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
        if (!cardGallery) return;
        cardGallery.innerHTML = "";
        noResultsMessage?.classList.toggle("hidden", cards.length > 0);
        const fragment = document.createDocumentFragment();
        cards.forEach((card, index) => {
            fragment.appendChild(createCardElement(card, index));
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
        cardCounterElement.textContent = `${settings.seenCards.length} / ${appData.cards.length} Reveladas`;
    }

    // --- SEARCH ---
    function initializeFuseSearch() {
        if (appData.cards) { fuse = new Fuse(appData.cards, { keys: ["title"], threshold: 0.4 }); }
    }

    function handleSearch() {
        if (!fuse) return;
        const query = searchBox.value.trim();
        clearSearchBtn.style.display = query ? 'block' : 'none';
        const results = query ? fuse.search(query).map(result => result.item) : appData.cards;
        displayCards(results);
    }

    // --- MODALS ---
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
        
        if (activeModal === commentsModal) {
            document.getElementById("giscus-container")?.classList.add("hidden");
            document.getElementById("comment-categories-container")?.classList.remove("hidden");
        }
        activeModal = null;
    }

    function showChangelog() {
        playSound("logS");
        if (!changelogModal || !appData.changelog) return;
        const { version, changes, ai_note } = appData.changelog;
        changelogModal.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2 id="changelog-title">Novedades (${version})</h2><ul>${changes.map(c => `<li>${c}</li>`).join("")}</ul><small>${ai_note}</small>`;
        openModal(changelogModal);
        changelogModal.querySelector('.close-modal-btn')?.addEventListener('click', closeModal);
    }
    
    function showLegalModal() {
        playSound("logS");
        if (!legalModal || !appData.legal_text) return;
        const { title, content } = appData.legal_text;
        legalModal.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2 id="legal-title">${title}</h2>${content}`;
        openModal(legalModal);
        legalModal.querySelector('.close-modal-btn')?.addEventListener('click', closeModal);
    }
    
    // --- COMMENTS ---
    function showCommentsModal() {
        playSound("button");
        const container = document.getElementById("comment-categories-container");
        if (!container || !appData.ui_text.comment_categories) return;
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
        document.getElementById("comment-categories-container")?.classList.add("hidden");
        const giscusContainer = document.getElementById("giscus-container");
        if (!giscusContainer) return;
        giscusContainer.innerHTML = '';
        giscusContainer.classList.remove("hidden");
        const script = document.createElement("script");
        Object.assign(script, {
            src: "https://giscus.app/client.js", "data-repo": "CZeta415/WS-CardAlbum", "data-repo-id": "R_kgDOPrKawQ",
            "data-category": category, "data-mapping": "pathname", "data-strict": "0", "data-reactions-enabled": "1",
            "data-emit-metadata": "0", "data-input-position": "bottom", "data-theme": "preferred_color_scheme",
            "data-lang": "es", crossorigin: "anonymous", async: true
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
        imgEl.alt = card.title;
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
            if (savedSettings) Object.assign(settings, JSON.parse(savedSettings));
        } catch (error) {
            handleError("loadSettings", error);
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
        document.body.className = (document.body.className.replace(/aura-effect-\w+/g, '') + ` aura-effect-${settings.auraEffect}`).trim();
        document.querySelector(`input[name="aura-effect"][value="${settings.auraEffect}"]`)?.setAttribute('checked', 'true');
        const volumeSlider = document.getElementById("master-volume-slider");
        if(volumeSlider) volumeSlider.value = settings.masterVolume;
        document.querySelectorAll("#sound-mute-toggles input").forEach(toggle => { toggle.checked = settings.mutedSounds.includes(toggle.dataset.sound); });
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
        navigator.clipboard.writeText(JSON.stringify({
            timestamp: new Date().toISOString(), url: window.location.href, userAgent: navigator.userAgent,
            screen: { width: window.innerWidth, height: window.innerHeight }, settings, errors: caughtErrors,
        }, null, 2))
        .then(() => alert("Información de depuración copiada al portapapeles."))
        .catch(err => console.error("Failed to copy debug info:", err));
    }
    
    async function setupVisitorCounter() {
        const counterContainer = document.getElementById("visitor-counter");
        try {
            const response = await fetch("https://api.counterapi.dev/v1/grimorio-muerte/pactos-v3-fix/up");
            if (!response.ok) throw new Error("Counter API failed");
            const data = await response.json();
            document.getElementById("visitor-count").textContent = data.count.toLocaleString("es-ES");
        } catch (error) {
            handleError("visitorCounter", error);
            if(counterContainer) counterContainer.style.display = "none";
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

    function calculatePactOfTheDay() {
        const date = new Date();
        const seed = date.getFullYear() * 1000 + date.getMonth() * 100 + date.getDate();
        pactOfTheDayId = appData.cards[(seed % appData.cards.length)]?.id;
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
        if (!audioContext || audioContext.state === "suspended" || !audioBuffers[name] || settings.mutedSounds.includes(name)) return;
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffers[name];
        const gainNode = audioContext.createGain();
        gainNode.gain.value = settings.masterVolume;
        source.connect(gainNode).connect(audioContext.destination);
        source.start(0);
    }
    
    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // CORRECCIÓN: Se utiliza encadenamiento opcional `?.` en todos los event listeners.
        // Esto evita que el script se bloquee si un elemento no se encuentra en el DOM.
        
        initialDeck?.addEventListener("click", dealCards, { once: true });
        searchBox?.addEventListener("input", handleSearch);
        clearSearchBtn?.addEventListener("click", () => {
            if (searchBox) {
                searchBox.value = '';
                searchBox.dispatchEvent(new Event('input'));
                searchBox.focus();
            }
        });

        cardGallery?.addEventListener("click", e => {
            const cardEl = e.target.closest(".card-container");
            if (cardEl) handleCardClick(cardEl);
        });
        
        document.addEventListener("click", e => {
            if (settingsPanel?.classList.contains('visible') && !settingsPanel.contains(e.target) && !settingsToggleBtn?.contains(e.target)) {
                settingsPanel.classList.remove("visible");
                settingsToggleBtn.setAttribute('aria-expanded', 'false');
            }
        });
        
        modalOverlay?.addEventListener("click", closeModal);
        document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', closeModal));
        
        document.getElementById("prev-card-btn")?.addEventListener("click", e => { e.stopPropagation(); navigateCard(-1); });
        document.getElementById("next-card-btn")?.addEventListener("click", e => { e.stopPropagation(); navigateCard(1); });

        document.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                if (activeModal) closeModal();
                else if (settingsPanel?.classList.contains('visible')) {
                    settingsPanel.classList.remove('visible');
                    settingsToggleBtn?.setAttribute('aria-expanded', 'false');
                }
            }
            if (activeModal === cardViewModal) {
                if (e.key === "ArrowLeft") navigateCard(-1);
                if (e.key === "ArrowRight") navigateCard(1);
            }
        });
        
        document.getElementById("changelog-btn")?.addEventListener("click", showChangelog);
        commentsToggleBtn?.addEventListener("click", showCommentsModal);
        settingsToggleBtn?.addEventListener("click", e => {
            e.stopPropagation();
            playSound("button");
            const isVisible = settingsPanel.classList.toggle("visible");
            settingsToggleBtn.setAttribute('aria-expanded', isVisible);
        });

        // Settings Panel Listeners
        document.getElementById("theme-color-selector")?.addEventListener("click", e => { if (e.target.matches(".color-swatch")) { playSound("button"); settings.themeColor = e.target.dataset.color; applySettings(); saveSettings(); } });
        document.getElementById("card-back-selector")?.addEventListener("click", e => { if (e.target.matches(".card-back-option")) { playSound("button"); settings.cardBack = e.target.dataset.back; applySettings(); saveSettings(); } });
        document.querySelector(".setting-toggle")?.addEventListener("change", e => { if (e.target.matches("input[name='aura-effect']")){ playSound("button"); settings.auraEffect = e.target.value; applySettings(); saveSettings(); }});
        
        const volumeSlider = document.getElementById("master-volume-slider");
        volumeSlider?.addEventListener("input", e => { settings.masterVolume = parseFloat(e.target.value); });
        volumeSlider?.addEventListener("change", () => { playSound("button"); saveSettings(); });
        
        document.getElementById("sound-mute-toggles")?.addEventListener("change", e => {
            if (e.target.matches("input[type='checkbox']")) {
                const soundName = e.target.dataset.sound;
                if (e.target.checked) { if(!settings.mutedSounds.includes(soundName)) settings.mutedSounds.push(soundName); }
                else { settings.mutedSounds = settings.mutedSounds.filter(s => s !== soundName); }
                saveSettings();
            }
        });
        
        document.getElementById("reveal-all-btn")?.addEventListener("click", revealAllCards);
        document.getElementById("clear-seen-btn")?.addEventListener("click", clearSeenCards);
        document.getElementById("reset-settings-btn")?.addEventListener("click", () => { if (confirm("¿Seguro que quieres borrar TODOS los ajustes y el progreso? Esta acción no se puede deshacer.")) { playSound("button"); localStorage.removeItem("grimorioSettingsV5"); window.location.reload(); }});
        document.getElementById("legal-notice-btn")?.addEventListener("click", showLegalModal);
        document.getElementById("debug-copy-btn")?.addEventListener("click", copyDebugInfo);
    }
    
    init();
});