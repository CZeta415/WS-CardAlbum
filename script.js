document.addEventListener("DOMContentLoaded", () => {
    // --- Referencias a Elementos del DOM ---
    const DOMElements = {
        activationOverlay: document.getElementById("activation-overlay"),
        activationText: document.getElementById("activation-text"),
        initialDeck: document.getElementById("initial-deck"),
        cardGallery: document.getElementById("card-gallery"),
        searchBox: document.getElementById("search-box"),
        clearSearchBtn: document.getElementById("clear-search-btn"),
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
    let appData = {}, fuse, visibleCards = [], activeModal = null, caughtErrors = [];
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
            DOMElements.activationText.textContent = "Error crítico. Verifica que app_data.json esté en la raíz del proyecto.";
        }
    }

    async function activateApp() {
        DOMElements.activationOverlay.classList.add("hidden");
        document.body.classList.remove("no-scroll");
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await loadAudio();
        loadSettings();
        applySettings();
        setupEventListeners();
        initializeFuseSearch();
        updateCardCounter();
    }
    
    // --- MANEJO DE MODALES ---
    const openModal = (modal) => {
        if (!modal) return;
        activeModal = modal;
        modal.classList.add("visible");
        DOMElements.modalOverlay.classList.add("visible");
        document.body.classList.add("no-scroll");
    };

    const closeModal = () => {
        if (!activeModal) return;
        playSound("button");
        activeModal.classList.remove("visible");
        DOMElements.modalOverlay.classList.remove("visible");
        document.body.classList.remove("no-scroll");
        if (activeModal === DOMElements.modals.comments) {
            const giscusContainer = document.getElementById("giscus-container");
            if (giscusContainer) {
                giscusContainer.classList.add("hidden");
                giscusContainer.innerHTML = '';
            }
            document.getElementById("comment-categories-container")?.classList.remove("hidden");
        }
        activeModal = null;
    };
    
    // --- FUNCIONES DE LA INTERFAZ ---
    const showChangelog = () => {
        playSound("logS");
        const { changelog } = DOMElements.modals;
        if (!changelog || !appData.changelog) return;
        changelog.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2>Novedades (${appData.changelog.version})</h2><ul>${appData.changelog.changes.map(c => `<li>${c}</li>`).join("")}</ul><small>${appData.changelog.ai_note}</small>`;
        openModal(changelog);
    };

    const showLegalModal = () => {
        playSound("logS");
        const { legal } = DOMElements.modals;
        if (!legal || !appData.legal_text) return;
        legal.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2>${appData.legal_text.title}</h2>${appData.legal_text.content}`;
        openModal(legal);
    };
    
    const showCommentsModal = () => {
        playSound("button");
        const container = document.getElementById("comment-categories-container");
        if (!container || !appData.ui_text.comment_categories) return;
        container.innerHTML = "";
        appData.ui_text.comment_categories.forEach(cat => {
            const btn = document.createElement("button");
            btn.className = "category-btn";
            btn.dataset.categoryId = cat.categoryId;
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
        const script = Object.assign(document.createElement("script"), {
            src: "https://giscus.app/client.js", "data-repo": "CZeta415/WS-CardAlbum", "data-repo-id": "R_kgDOPrKawQ",
            "data-category-id": categoryId, "data-mapping": "pathname", "data-strict": "0", "data-reactions-enabled": "1",
            "data-emit-metadata": "0", "data-input-position": "bottom", "data-theme": "preferred_color_scheme",
            "data-lang": "es", crossorigin: "anonymous", async: true
        });
        giscusContainer.appendChild(script);
    };

    // --- MANEJO DE CARTAS ---
    const dealCards = () => {
        playSound("deal");
        document.getElementById("initial-deck-container")?.classList.add("hidden");
        if (DOMElements.searchBox) { DOMElements.searchBox.disabled = false; DOMElements.searchBox.focus(); }
        displayCards(appData.cards);
    };

    const displayCards = (cards) => {
        visibleCards = cards;
        if (!DOMElements.cardGallery) return;
        DOMElements.cardGallery.innerHTML = "";
        document.getElementById('no-results-message').classList.toggle('hidden', cards.length > 0);
        cards.forEach((card, index) => DOMElements.cardGallery.appendChild(createCardElement(card, index)));
    };

    const createCardElement = (card, index) => {
        const el = document.createElement("div");
        el.className = "card-container";
        el.style.animationDelay = `${index * 50}ms`;
        el.dataset.id = card.id;
        if (settings.seenCards.includes(card.id)) el.classList.add("seen", "flipped");
        // CORRECCIÓN: Se vuelve a añadir el texto "Identificar".
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
        setTimeout(() => openCardViewModal(cardId), wasFlipped ? 50 : 350);
    };
    
    const openCardViewModal = (cardId) => {
        const card = appData.cards.find(c => c.id === cardId);
        if(!card) return;
        document.getElementById("card-view-title").textContent = card.title;
        document.getElementById("card-view-description").innerHTML = card.description;
        document.getElementById("card-view-image").src = `assets/cards/card_${card.id}.webp`;
        openModal(DOMElements.modals.cardView);
        playSound("roll");
    };

    // --- BÚSQUEDA Y OTROS ---
    const initializeFuseSearch = () => { if (appData.cards) fuse = new Fuse(appData.cards, { keys: ["title"], threshold: 0.4 }); };
    const updateCardCounter = () => document.getElementById('card-counter').textContent = `${settings.seenCards.length} / ${appData.cards.length} Reveladas`;

    // --- LÓGICA DE AJUSTES ---
    const loadSettings = () => { try { const s = localStorage.getItem("grimorioSettingsV5"); if(s) Object.assign(settings, JSON.parse(s)); } catch(e) { handleError("loadSettings", e); }};
    const saveSettings = () => { try { localStorage.setItem("grimorioSettingsV5", JSON.stringify(settings)); } catch(e) { handleError("saveSettings", e); }};
    
    const applySettings = () => {
        document.documentElement.style.setProperty("--theme-accent-color", settings.themeColor);
        document.body.className = (document.body.className.replace(/aura-effect-\w+/g, '') + ` aura-effect-${settings.auraEffect}`).trim();
        document.querySelectorAll(".color-swatch").forEach(s => s.classList.toggle("selected", s.dataset.color === settings.themeColor));
        document.querySelectorAll(".card-back-option").forEach(o => o.classList.toggle("selected", o.dataset.back === settings.cardBack));
        document.querySelector(`input[name="aura-effect"][value="${settings.auraEffect}"]`).checked = true;
        document.getElementById('master-volume-slider').value = settings.masterVolume;
        document.querySelectorAll("#sound-mute-toggles input").forEach(t => t.checked = settings.mutedSounds.includes(t.dataset.sound));
        displayCards(visibleCards);
    };

    // --- AUDIO ---
    async function loadAudio() {
        if (!audioContext) return;
        await Promise.all(Object.entries(audioSources).map(async ([name, url]) => {
            try {
                const res = await fetch(url);
                const buffer = await res.arrayBuffer();
                audioBuffers[name] = await audioContext.decodeAudioData(buffer);
            } catch (error) { handleError(`loadAudio:${name}`, error); }
        }));
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
    const getCardBackUrl = (index) => settings.cardBack === 'default' ? `assets/card_back/card_back${index % 3 + 1}.webp` : settings.cardBack;

    // --- MANEJO DE EVENTOS ---
    function setupEventListeners() {
        DOMElements.initialDeck?.addEventListener("click", dealCards, { once: true });
        
        // --- DELEGACIÓN DE EVENTOS CENTRALIZADA ---
        document.body.addEventListener('click', e => {
            const target = e.target;
            const actionBtnId = target.closest('.settings-btn')?.id;
            
            // Cerrar Modales/Paneles
            if (target.closest('.close-modal-btn') || target === DOMElements.modalOverlay) closeModal();
            if (DOMElements.settingsPanel.classList.contains('visible') && !target.closest('#settings-panel') && !target.closest('#settings-toggle-btn')) DOMElements.settingsPanel.classList.remove('visible');

            // Abrir Modales/Paneles
            if (target.closest('#changelog-btn')) showChangelog();
            if (target.closest('#comments-toggle-btn')) showCommentsModal();
            if (target.closest('#settings-toggle-btn')) { e.stopPropagation(); playSound("button"); DOMElements.settingsPanel.classList.toggle("visible"); }

            // Interacciones
            if (target.closest('.card-container')) handleCardClick(target.closest('.card-container'));
            if (target.closest('.category-btn')) loadGiscus(target.closest('.category-btn').dataset.categoryId);
            
            // CORRECCIÓN: Botones de Ajustes
            if(actionBtnId) {
                playSound('button');
                if(actionBtnId === 'reveal-all-btn') { if(confirm("¿Revelar todos los pactos?")) { settings.seenCards = appData.cards.map(c => c.id); saveSettings(); applySettings(); updateCardCounter(); }}
                if(actionBtnId === 'clear-seen-btn') { if(confirm("¿Volver a sellar todos los pactos?")) { settings.seenCards = []; saveSettings(); window.location.reload(); }}
                if(actionBtnId === 'reset-settings-btn') { if(confirm("¿Borrar TODOS los datos y ajustes?")) { localStorage.removeItem("grimorioSettingsV5"); window.location.reload(); }}
                if(actionBtnId === 'legal-notice-btn') showLegalModal();
                if(actionBtnId === 'debug-copy-btn') navigator.clipboard.writeText(JSON.stringify({ts:new Date().toISOString(), ...settings, errors: caughtErrors})).then(() => alert("Info de depuración copiada."));
            }

            // CORRECCIÓN: Personalización en Ajustes
            if (target.closest('.color-swatch') || target.closest('.card-back-option')) {
                 playSound('button');
                 if(target.closest('.color-swatch')) settings.themeColor = target.dataset.color;
                 if(target.closest('.card-back-option')) settings.cardBack = target.dataset.back;
                 applySettings();
                 saveSettings();
            }
        });

        // Eventos de input (no son de click)
        DOMElements.searchBox?.addEventListener("input", () => {
             const query = DOMElements.searchBox.value.trim();
             DOMElements.clearSearchBtn.style.display = query ? 'block' : 'none';
             displayCards(query ? fuse.search(query).map(r => r.item) : appData.cards);
        });
        DOMElements.clearSearchBtn?.addEventListener('click', () => { DOMElements.searchBox.value = ''; DOMElements.searchBox.dispatchEvent(new Event('input')); });

        document.getElementById('master-volume-slider')?.addEventListener('input', e => { settings.masterVolume = parseFloat(e.target.value); saveSettings(); });
        document.getElementById('sound-mute-toggles')?.addEventListener('change', () => { settings.mutedSounds = [...document.querySelectorAll('#sound-mute-toggles input:checked')].map(cb => cb.dataset.sound); saveSettings(); });
        document.querySelector('.setting-toggle')?.addEventListener('change', (e) => { if (e.target.name === 'aura-effect') { settings.auraEffect = e.target.value; applySettings(); saveSettings(); } });
    }
    const handleError = (source, error) => { caughtErrors.push({ source, message: error.message }); console.error(`Error in ${source}:`, error); };

    init();
});