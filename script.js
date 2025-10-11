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

    // --- Estado Global de la Aplicación ---
    let appData = {}, fuse, visibleCards = [], currentCardIndex = -1, activeModal = null, caughtErrors = [];
    let audioContext;
    const audioBuffers = {};
    const audioSources = { deal: "assets/sounds/CardRep.mp3", flip: "assets/sounds/Flip.mp3", roll: "assets/sounds/CardRolls.mp3", logS: "assets/sounds/LogS.mp3", button: "assets/sounds/button.mp3" };
    let settings = { themeColor: "#dcbaff", cardBack: "default", auraEffect: "alfa", masterVolume: 0.7, mutedSounds: [], seenCards: [], legalAccepted: false };

    // --- INICIALIZACIÓN ---
    async function init() {
        try {
            const response = await fetch("app_data.json", { cache: 'no-store' });
            if (!response.ok) throw new Error(`app_data.json no encontrado (status: ${response.status})`);
            appData = await response.json();
            DOMElements.activationText.textContent = "Listo para el pacto.";
            DOMElements.activationOverlay.addEventListener("click", activateApp, { once: true });
        } catch (error) {
            handleError("init", error);
            DOMElements.activationText.textContent = "Error crítico. Verifica que app_data.json existe en la raíz.";
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

    // --- LÓGICA DE MODALES Y PANELES ---
    const openModal = (modal) => { if (modal) { activeModal = modal; modal.classList.add("visible"); DOMElements.modalOverlay.classList.add("visible"); document.body.classList.add("no-scroll"); }};
    const closeModal = () => { if (activeModal) { playSound("button"); activeModal.classList.remove("visible"); DOMElements.modalOverlay.classList.remove("visible"); document.body.classList.remove("no-scroll"); activeModal = null; }};

    const showChangelog = () => {
        playSound("logS");
        DOMElements.modals.changelog.innerHTML = `<button class="close-modal-btn" aria-label="Cerrar">X</button><h2>Novedades (${appData.changelog.version})</h2><ul>${appData.changelog.changes.map(c => `<li>${c}</li>`).join("")}</ul><small>${appData.changelog.ai_note}</small>`;
        openModal(DOMElements.modals.changelog);
    };

    const loadGiscus = (categoryId) => {
        const giscusContainer = document.getElementById("giscus-container");
        if(giscusContainer){
            document.getElementById("comment-categories-container")?.classList.add("hidden");
            giscusContainer.innerHTML = ''; 
            giscusContainer.classList.remove("hidden");
            const script = Object.assign(document.createElement("script"), {
                src: "https://giscus.app/client.js", "data-repo": "CZeta415/WS-CardAlbum", "data-repo-id": "R_kgDOPrKawQ",
                "data-category-id": categoryId, "data-mapping": "pathname", "data-strict": "0", "data-reactions-enabled": "1",
                "data-emit-metadata": "0", "data-input-position": "bottom", "data-theme": "preferred_color_scheme",
                "data-lang": "es", crossorigin: "anonymous", async: true
            });
            giscusContainer.appendChild(script);
        }
    };
    
    // --- LÓGICA DE CARTAS ---
    const dealCards = () => { playSound("deal"); document.getElementById("initial-deck-container")?.classList.add("hidden"); if (DOMElements.searchBox) { DOMElements.searchBox.disabled = false; DOMElements.searchBox.focus(); } displayCards(appData.cards); };
    const displayCards = (cards) => { visibleCards = cards; DOMElements.cardGallery.innerHTML = ""; document.getElementById('no-results-message').classList.toggle('hidden', cards.length > 0); cards.forEach((card, index) => DOMElements.cardGallery.appendChild(createCardElement(card, index))); };
    const createCardElement = (card, index) => { const el = document.createElement("div"); el.className = "card-container"; el.style.animationDelay = `${index * 50}ms`; el.dataset.id = card.id; if (settings.seenCards.includes(card.id)) el.classList.add("seen", "flipped"); el.innerHTML = `<div class="card-inner"><div class="card-face card-back" style="background-image: url('${getCardBackUrl(index)}')"><span class="card-back-prompt">${appData.ui_text.identify_prompt}</span></div><div class="card-face card-front" style="--card-front-image: url('assets/cards/card_${card.id}.webp')"><h3 class="card-title">${card.title}</h3></div></div>`; return el; };

    const handleCardClick = (cardEl) => {
        const cardId = parseInt(cardEl.dataset.id, 10);
        if (!cardEl.classList.contains("flipped")) { playSound("flip"); cardEl.classList.add("seen", "flipped"); if (!settings.seenCards.includes(cardId)) { settings.seenCards.push(cardId); saveSettings(); updateCardCounter(); }}
        setTimeout(() => openCardViewModal(cardId), 300);
    };
    
    const openCardViewModal = (cardId) => {
        const card = appData.cards.find(c => c.id === cardId);
        if(!card) return;
        currentCardIndex = visibleCards.findIndex(c => c.id === cardId); // <-- Faltaba esto
        document.getElementById("card-view-title").textContent = card.title;
        document.getElementById("card-view-description").innerHTML = card.description;
        document.getElementById("card-view-image").src = `assets/cards/card_${card.id}.webp`;
        openModal(DOMElements.modals.cardView);
        playSound("roll");
    };

    const navigateCard = (direction) => {
        if(currentCardIndex === -1) return;
        currentCardIndex = (currentCardIndex + direction + visibleCards.length) % visibleCards.length;
        const card = visibleCards[currentCardIndex];
        if(!card) return;
        document.getElementById("card-view-title").textContent = card.title;
        document.getElementById("card-view-description").innerHTML = card.description;
        document.getElementById("card-view-image").src = `assets/cards/card_${card.id}.webp`;
        playSound('roll');
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
        if(visibleCards.length > 0) displayCards(visibleCards);
    };
    
    // CORRECCIÓN: Lógica robusta para texturas del reverso
    const getCardBackUrl = (index) => {
        if (settings.cardBack === 'default') {
            const backs = ["assets/card_back/card_back.webp", "assets/card_back/card_back2.webp", "assets/card_back/card_back3.webp"];
            return backs[index % backs.length];
        }
        return settings.cardBack;
    };
    
    // --- AUDIO Y ERRORES ---
    async function loadAudio() { if (!audioContext) return; await Promise.all(Object.entries(audioSources).map(async ([n, u]) => { try { const r=await fetch(u), b=await r.arrayBuffer(); audioBuffers[n]=await audioContext.decodeAudioData(b); } catch(e){handleError(`loadAudio:${n}`,e)} }));}
    const playSound = (name) => { if(audioContext?.state==="suspended")audioContext.resume(); if(!audioContext||!audioBuffers[name]||settings.mutedSounds.includes(name))return; const s=audioContext.createBufferSource();s.buffer=audioBuffers[name];const g=audioContext.createGain();g.gain.value=settings.masterVolume;s.connect(g).connect(audioContext.destination);s.start(0);};
    const handleError = (source, error) => { caughtErrors.push({ source, message: error.message }); console.error(`Error in ${source}:`, error); };

    // --- MANEJO DE EVENTOS ROBUSTO ---
    function setupEventListeners() {
        DOMElements.initialDeck?.addEventListener("click", dealCards, { once: true });
        
        document.body.addEventListener('click', e => {
            const target = e.target;
            const actionBtnId = target.closest('.settings-btn')?.id;
            
            if (target.closest('.close-modal-btn') || target === DOMElements.modalOverlay) closeModal();
            if (target.closest('#changelog-btn')) showChangelog();
            if (target.closest('#comments-toggle-btn')) openModal(DOMElements.modals.comments);
            if (target.closest('#settings-toggle-btn')) { e.stopPropagation(); playSound("button"); DOMElements.settingsPanel.classList.toggle("visible"); }
            if (DOMElements.settingsPanel.classList.contains('visible') && !target.closest('#settings-panel') && !target.closest('#settings-toggle-btn')) DOMElements.settingsPanel.classList.remove('visible');
            if (target.closest('.card-container')) handleCardClick(target.closest('.card-container'));
            if (target.closest('.category-btn')) loadGiscus(target.closest('.category-btn').dataset.categoryId);

            // CORRECCIÓN: Eventos para flechas de navegación
            if (target.id === 'prev-card-btn') navigateCard(-1);
            if (target.id === 'next-card-btn') navigateCard(1);
            
            if(actionBtnId) {
                playSound('button');
                if(actionBtnId === 'reveal-all-btn') { if(confirm("¿Revelar todos los pactos?")) { settings.seenCards = appData.cards.map(c => c.id); saveSettings(); applySettings(); updateCardCounter(); }}
                if(actionBtnId === 'clear-seen-btn') { if(confirm("¿Volver a sellar todos los pactos?")) { settings.seenCards = []; saveSettings(); window.location.reload(); }}
                if(actionBtnId === 'reset-settings-btn') { if(confirm("¿Borrar TODOS los datos y ajustes?")) { localStorage.removeItem("grimorioSettingsV5"); window.location.reload(); }}
                if(actionBtnId === 'legal-notice-btn') { DOMElements.modals.legal.innerHTML=`<button class="close-modal-btn" aria-label="Cerrar">X</button><h2>${appData.legal_text.title}</h2>${appData.legal_text.content}`; openModal(DOMElements.modals.legal); }
                if(actionBtnId === 'debug-copy-btn') navigator.clipboard.writeText(JSON.stringify({ts:new Date().toISOString(), ...settings, errors: caughtErrors})).then(() => alert("Info de depuración copiada."));
            }
        });
        
        DOMElements.settingsPanel?.addEventListener('input', e => {
            const target = e.target;
            playSound('button');
            if(target.id === 'master-volume-slider') { settings.masterVolume = parseFloat(target.value); saveSettings(); }
            if(target.closest('#sound-mute-toggles')) { settings.mutedSounds = [...document.querySelectorAll('#sound-mute-toggles input:checked')].map(cb => cb.dataset.sound); saveSettings(); }
            if(target.name === 'aura-effect') { settings.auraEffect = target.value; applySettings(); saveSettings(); }
        });
        DOMElements.settingsPanel?.addEventListener('click', e => {
            if (e.target.closest('.color-swatch') || e.target.closest('.card-back-option')) {
                 playSound('button');
                 if(e.target.closest('.color-swatch')) settings.themeColor = e.target.dataset.color;
                 if(e.target.closest('.card-back-option')) settings.cardBack = e.target.dataset.back;
                 applySettings();
                 saveSettings();
            }
        });

        DOMElements.searchBox?.addEventListener("input", () => {
             const query = DOMElements.searchBox.value.trim(); DOMElements.clearSearchBtn.style.display = query ? 'block' : 'none'; displayCards(query ? fuse.search(query).map(r => r.item) : appData.cards);
        });
        DOMElements.clearSearchBtn?.addEventListener('click', () => { DOMElements.searchBox.value = ''; DOMElements.searchBox.dispatchEvent(new Event('input')); });
    }
    init();
});