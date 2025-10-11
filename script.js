document.addEventListener("DOMContentLoaded", () => {
    // --- Referencias a Elementos del DOM ---
    const DOMElements = {
        activationOverlay: document.getElementById("activation-overlay"),
        activationText: document.getElementById("activation-text"),
        initialDeck: document.getElementById("initial-deck"),
        cardGallery: document.getElementById("card-gallery"),
        searchBox: document.getElementById("search-box"),
        clearSearchBtn: document.getElementById("clear-search-btn"),
        noResultsMessage: document.getElementById("no-results-message"),
        dynamicSubtitle: document.getElementById("dynamic-subtitle"),
        cardCounter: document.getElementById("card-counter"),
        settingsToggleBtn: document.getElementById("settings-toggle-btn"),
        settingsPanel: document.getElementById("settings-panel"),
        modalOverlay: document.getElementById("modal-overlay"),
        modals: {
            changelog: document.getElementById("changelog-modal"),
            legal: document.getElementById("legal-modal"),
            comments: document.getElementById("comments-modal"),
            cardView: document.getElementById("card-view-modal"),
        }
    };

    // --- Estado Global ---
    let appData = {}, fuse, visibleCards = [], currentCardIndex = -1, pactOfTheDayId = -1, activeModal = null, caughtErrors = [];
    let audioContext;
    const audioBuffers = {};
    const audioSources = { deal: "assets/sounds/CardRep.mp3", flip: "assets/sounds/Flip.mp3", roll: "assets/sounds/CardRolls.mp3", logS: "assets/sounds/LogS.mp3", button: "assets/sounds/button.mp3" };
    let settings = { themeColor: "#dcbaff", cardBack: "default", auraEffect: "alfa", masterVolume: 0.7, mutedSounds: [], seenCards: [], legalAccepted: false };

    // --- INICIALIZACIÓN ---
    async function init() {
        try {
            const response = await fetch("app_data.json");
            if (!response.ok) throw new Error(`app_data.json no encontrado (status: ${response.status})`);
            appData = await response.json();
            DOMElements.activationText.textContent = "Listo para el pacto.";
            DOMElements.activationOverlay.addEventListener("click", activateApp, { once: true });
        } catch (error) {
            handleError("init", error);
            DOMElements.activationText.textContent = "Error crítico al cargar datos. Verifica la consola y que app_data.json esté en la raíz del proyecto.";
        }
    }

    async function activateApp() {
        DOMElements.activationOverlay.classList.add("hidden");
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
            if (!settings.legalAccepted) setTimeout(showLegalModal, 500);
        } catch (error) {
            handleError("activateApp", error);
        }
    }

    // --- FUNCIONES DE MODALES Y PANELES ---
    function closeAllPopups() {
        if (DOMElements.settingsPanel?.classList.contains('visible')) {
            DOMElements.settingsPanel.classList.remove("visible");
            DOMElements.settingsToggleBtn?.setAttribute('aria-expanded', 'false');
        }
    }
    
    function openModal(modal) {
        if (!modal) return;
        closeAllPopups(); // <-- Llama a la función que ahora sí existe.
        activeModal = modal;
        modal.classList.add("visible");
        DOMElements.modalOverlay.classList.add("visible");
        document.body.classList.add("no-scroll");
    }

    function closeModal() {
        if (!activeModal) return;
        playSound("button");
        if (activeModal === DOMElements.modals.legal && !settings.legalAccepted) {
            settings.legalAccepted = true;
            saveSettings();
        }
        activeModal.classList.remove("visible");
        DOMElements.modalOverlay.classList.remove("visible");
        document.body.classList.remove("no-scroll");
        if (activeModal === DOMElements.modals.comments) {
            document.getElementById("giscus-container")?.classList.add("hidden");
            document.getElementById("comment-categories-container")?.classList.remove("hidden");
        }
        activeModal = null;
    }
    
    const showChangelog = () => {
        playSound("logS");
        const { changelog } = DOMElements.modals;
        if (!changelog || !appData.changelog) return;
        changelog.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2 id="changelog-title">Novedades (${appData.changelog.version})</h2><ul>${appData.changelog.changes.map(c => `<li>${c}</li>`).join("")}</ul><small>${appData.changelog.ai_note}</small>`;
        openModal(changelog);
    };

    const showLegalModal = () => {
        playSound("logS");
        const { legal } = DOMElements.modals;
        if (!legal || !appData.legal_text) return;
        legal.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2 id="legal-title">${appData.legal_text.title}</h2>${appData.legal_text.content}`;
        openModal(legal);
    };

    // --- COMENTARIOS (GISCUS) ---
    const showCommentsModal = () => {
        playSound("button");
        const container = document.getElementById("comment-categories-container");
        if (!container || !appData.ui_text.comment_categories) return;
        container.innerHTML = "";
        appData.ui_text.comment_categories.forEach(cat => {
            const btn = document.createElement("button");
            btn.className = "category-btn";
            btn.dataset.categoryId = cat.categoryId; // <-- Usar el ID
            btn.innerHTML = `<span class="icon">${cat.icon}</span><span class="info"><span class="name">${cat.name}</span><span class="description">${cat.description}</span></span>`;
            container.appendChild(btn);
        });
        openModal(DOMElements.modals.comments);
    };

    const loadGiscus = (categoryId) => {
        document.getElementById("comment-categories-container")?.classList.add("hidden");
        const giscusContainer = document.getElementById("giscus-container");
        if (!giscusContainer) return;
        giscusContainer.innerHTML = '';
        giscusContainer.classList.remove("hidden");
        const script = document.createElement("script");
        Object.assign(script, {
            src: "https://giscus.app/client.js",
            "data-repo": "CZeta415/WS-CardAlbum",
            "data-repo-id": "R_kgDOPrKawQ",
            "data-category-id": categoryId, // <-- CORREGIDO: Usa el ID de la categoría
            "data-mapping": "pathname",
            "data-strict": "0",
            "data-reactions-enabled": "1",
            "data-emit-metadata": "0",
            "data-input-position": "bottom",
            "data-theme": "preferred_color_scheme",
            "data-lang": "es",
            crossorigin: "anonymous",
            async: true
        });
        giscusContainer.appendChild(script);
    };
    
    // ... (El resto del código como la versión anterior, que ya era robusta)
    
    const dealCards = () => {
        playSound("deal");
        document.getElementById("initial-deck-container")?.classList.add("hidden");
        if (DOMElements.searchBox) { DOMElements.searchBox.disabled = false; DOMElements.searchBox.focus(); }
        if (appData.cards) displayCards(appData.cards);
    };
    const displayCards = (cards) => {
        visibleCards = cards;
        const { cardGallery, noResultsMessage } = DOMElements;
        if (!cardGallery) return;
        cardGallery.innerHTML = "";
        noResultsMessage?.classList.toggle("hidden", cards.length === 0);
        const fragment = document.createDocumentFragment();
        cards.forEach((card, index) => fragment.appendChild(createCardElement(card, index)));
        cardGallery.appendChild(fragment);
    };
    const createCardElement = (card, index) => {
        const el = document.createElement("div");
        el.className = "card-container";
        el.style.animationDelay = `${index * 50}ms`;
        el.dataset.id = card.id;
        if (settings.seenCards.includes(card.id)) el.classList.add("seen", "flipped");
        if (card.id === pactOfTheDayId) el.classList.add("pact-of-the-day");
        el.innerHTML = `<div class="card-inner">
            <div class="card-face card-back" style="background-image: url('${getCardBackUrl(index)}')">
                <span class="card-back-prompt">${appData.ui_text.identify_prompt || "Identificar"}</span>
            </div>
            <div class="card-face card-front" style="--card-front-image: url('assets/cards/card_${card.id}.webp')">
                <h3 class="card-title">${card.title}</h3>
            </div>
        </div>`;
        return el;
    };
    const handleCardClick = (cardEl) => {
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
        setTimeout(() => openCardViewModal(cardId), wasFlipped ? 0 : 300);
    };
    const updateCardCounter = () => {
        if (!DOMElements.cardCounter || !appData.cards) return;
        DOMElements.cardCounter.textContent = `${settings.seenCards.length} / ${appData.cards.length} Reveladas`;
    };
    const initializeFuseSearch = () => { if (appData.cards) fuse = new Fuse(appData.cards, { keys: ["title"], threshold: 0.4 }); };
    const handleSearch = () => {
        if (!fuse) return;
        const query = DOMElements.searchBox.value.trim();
        DOMElements.clearSearchBtn.style.display = query ? 'block' : 'none';
        displayCards(query ? fuse.search(query).map(r => r.item) : appData.cards);
    };
    const openCardViewModal = (cardId) => {
        playSound("roll");
        currentCardIndex = visibleCards.findIndex(c => c.id === cardId);
        if (currentCardIndex === -1) return;
        updateCardViewModal();
        openModal(DOMElements.modals.cardView);
    };
    const updateCardViewModal = () => {
        const card = visibleCards[currentCardIndex];
        document.getElementById("card-view-title").textContent = card.title;
        document.getElementById("card-view-description").innerHTML = card.description;
        document.getElementById("card-view-image").src = `assets/cards/card_${card.id}.webp`;
        document.getElementById("card-view-image").alt = card.title;
    };
    const navigateCard = (direction) => {
        playSound("roll");
        currentCardIndex = (currentCardIndex + direction + visibleCards.length) % visibleCards.length;
        updateCardViewModal();
    };
    const loadSettings = () => { try { const s = localStorage.getItem("grimorioSettingsV5"); if(s) Object.assign(settings, JSON.parse(s)); } catch(e) { handleError("loadSettings", e); }};
    const saveSettings = () => { try { localStorage.setItem("grimorioSettingsV5", JSON.stringify(settings)); } catch(e) { handleError("saveSettings", e); }};
    const applySettings = () => {
        document.documentElement.style.setProperty("--theme-accent-color", settings.themeColor);
        document.querySelectorAll(".color-swatch").forEach(s => s.classList.toggle("selected", s.dataset.color === settings.themeColor));
        document.querySelectorAll(".card-back-option").forEach(o => o.classList.toggle("selected", o.dataset.back === settings.cardBack));
        document.body.className = (document.body.className.replace(/aura-effect-\w+/g, '') + ` aura-effect-${settings.auraEffect}`).trim();
        const checkedAura = document.querySelector(`input[name="aura-effect"][value="${settings.auraEffect}"]`);
        if(checkedAura) checkedAura.checked = true;
        const vol = document.getElementById("master-volume-slider");
        if(vol) vol.value = settings.masterVolume;
        document.querySelectorAll("#sound-mute-toggles input").forEach(t => { t.checked = settings.mutedSounds.includes(t.dataset.sound); });
    };
    const getCardBackUrl = (index) => {
        if (settings.cardBack === "default") {
            const backs = ["assets/card_back/card_back.webp", "assets/card_back/card_back2.webp", "assets/card_back/card_back3.webp"];
            return backs[index % backs.length];
        }
        return settings.cardBack;
    }
    const calculatePactOfTheDay = () => { if(!appData.cards || appData.cards.length === 0) return; const d = new Date(); const s = d.getFullYear()*1000+d.getMonth()*100+d.getDate(); pactOfTheDayId = appData.cards[s % appData.cards.length].id; };
    const handleError = (source, error) => { caughtErrors.push({ source, message: error.message }); console.error(`Error in ${source}:`, error); };
    async function loadAudio() {
        if (!audioContext) return;
        const promises = Object.entries(audioSources).map(async ([name, url]) => {
            try {
                const res = await fetch(url);
                const buffer = await res.arrayBuffer();
                audioBuffers[name] = await audioContext.decodeAudioData(buffer);
            } catch (error) { handleError(`loadAudio:${name}`, error); }
        });
        await Promise.all(promises);
    }
    const playSound = (name) => {
        if (audioContext?.state === "suspended") audioContext.resume();
        if (!audioContext || !audioBuffers[name] || settings.mutedSounds.includes(name)) return;
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffers[name];
        const gainNode = audioContext.createGain();
        gainNode.gain.value = settings.masterVolume;
        source.connect(gainNode).connect(audioContext.destination);
        source.start(0);
    };
    const setupVisitorCounter = async () => {
        const counterContainer = document.getElementById("visitor-counter");
        try {
            const r = await fetch("https://api.counterapi.dev/v1/grimorio-muerte/pactos-v3-fix/up");
            if (!r.ok) throw new Error("API failed");
            const d = await r.json();
            document.getElementById("visitor-count").textContent = d.count.toLocaleString("es-ES");
        } catch(e) { handleError("visitorCounter", e); if (counterContainer) counterContainer.style.display = "none";}
    };
    const startSubtitleRotator = () => { setInterval(() => { const s = appData.ui_text?.dynamic_subtitles; if(s && DOMElements.dynamicSubtitle) DOMElements.dynamicSubtitle.textContent = s[Math.floor(Math.random()*s.length)]; }, 10000) };
    
    function setupEventListeners() {
        document.body.addEventListener('click', e => {
            const target = e.target;
            const cardContainer = target.closest('.card-container');
            const categoryBtn = target.closest('.category-btn');
            const actionBtnId = target.closest('.settings-btn')?.id;
            
            // Acciones principales
            if (target.closest('.close-modal-btn')) closeModal();
            if (cardContainer) handleCardClick(cardContainer);
            if (categoryBtn) loadGiscus(categoryBtn.dataset.categoryId);
            
            // Acciones de los botones de la cabecera
            if(target.closest('#changelog-btn')) showChangelog();
            if(target.closest('#comments-toggle-btn')) showCommentsModal();

            // Botones de ajustes
            if(actionBtnId === 'reveal-all-btn') { if(confirm("¿Revelar todos los pactos?")) { playSound('button'); settings.seenCards = appData.cards.map(c => c.id); saveSettings(); document.querySelectorAll(".card-container").forEach(c => c.classList.add("seen", "flipped")); updateCardCounter();}}
            if(actionBtnId === 'clear-seen-btn') { if(confirm("¿Volver a sellar todos los pactos?")) { playSound('button'); settings.seenCards = []; saveSettings(); window.location.reload();}}
            if(actionBtnId === 'reset-settings-btn') { if(confirm("¿Borrar TODOS los datos y ajustes?")) { playSound('button'); localStorage.removeItem("grimorioSettingsV5"); window.location.reload();}}
            if(actionBtnId === 'legal-notice-btn') showLegalModal();
            if(actionBtnId === 'debug-copy-btn') { playSound('button'); navigator.clipboard.writeText(JSON.stringify({ts:new Date().toISOString(), ...settings, errors: caughtErrors})).then(() => alert("Info de depuración copiada.")); }

            if(target.closest('.color-swatch') || target.closest('.card-back-option')) {
                 playSound('button');
                 if(target.closest('.color-swatch')) settings.themeColor = target.dataset.color;
                 if(target.closest('.card-back-option')) settings.cardBack = target.dataset.back;
                 applySettings();
                 saveSettings();
            }
        });
        DOMElements.initialDeck?.addEventListener("click", dealCards, { once: true });
        DOMElements.settingsToggleBtn?.addEventListener("click", e => {
            e.stopPropagation(); playSound("button");
            const isVisible = DOMElements.settingsPanel.classList.toggle("visible");
            DOMElements.settingsToggleBtn.setAttribute('aria-expanded', isVisible);
        });
        DOMElements.searchBox?.addEventListener("input", handleSearch);
        DOMElements.clearSearchBtn?.addEventListener("click", () => {
            if(DOMElements.searchBox) { DOMElements.searchBox.value = ''; handleSearch(); DOMElements.searchBox.focus(); }
        });
        document.getElementById("prev-card-btn")?.addEventListener("click", e => { e.stopPropagation(); navigateCard(-1); });
        document.getElementById("next-card-btn")?.addEventListener("click", e => { e.stopPropagation(); navigateCard(1); });
        
        // Listeners que no son de click
        const volumeSlider = document.getElementById("master-volume-slider");
        volumeSlider?.addEventListener("input", e => settings.masterVolume = parseFloat(e.target.value));
        volumeSlider?.addEventListener("change", () => { playSound('button'); saveSettings(); });

        document.querySelector('.setting-toggle')?.addEventListener('change', (e) => {
            if (e.target.matches("input[name='aura-effect']")) {
                playSound('button');
                settings.auraEffect = e.target.value;
                applySettings();
                saveSettings();
            }
        });
        
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") activeModal ? closeModal() : closeAllPopups();
            if (activeModal === DOMElements.modals.cardView) {
                if (e.key === "ArrowLeft") navigateCard(-1);
                if (e.key === "ArrowRight") navigateCard(1);
            }
        });
    }

    init();
});