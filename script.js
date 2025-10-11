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
    const commentsToggleBtn = document.getElementById("comments-toggle-btn");
    const utterancesContainer = document.getElementById("utterances-container");

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
    let caughtErrors = [];
    let isUtterancesLoaded = false;

    // Audio
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
        }
    }
    // ... (El resto de funciones como preloadAssets, calculatePactOfTheDay, dealCards, etc. no cambian y se mantienen igual)...
    // Asegúrate de pegar esto en el archivo JS que ya tienes o de copiar todas las funciones de los mensajes anteriores.
    // La parte clave que cambia es la que viene a continuación:
    
    // --- LÓGICA DE UTTERANCES (COMENTARIOS) ---
    function loadUtterances() {
        if (isUtterancesLoaded || !utterancesContainer) return; // Se asegura de que cargue solo una vez
        isUtterancesLoaded = true;

        const script = document.createElement("script");
        script.src = "https://utteranc.es/client.js";
        script.setAttribute("repo", "CZeta415/WS-CardAlbum");
        script.setAttribute("issue-term", "pathname");
        script.setAttribute("theme", "github-dark");
        script.setAttribute("crossorigin", "anonymous");
        script.async = true;

        utterancesContainer.appendChild(script);
    }
    
    // --- EVENT LISTENERS SETUP ---
    function setupEventListeners() {
        // ... (Todos los event listeners de antes para los botones de la página, modales, etc.)

        if (commentsToggleBtn) {
            commentsToggleBtn.addEventListener("click", () => {
                playSound("button");
                const isHidden = utterancesContainer.classList.toggle("hidden");
                if (!isHidden) {
                    commentsToggleBtn.textContent = "📫 Ocultar Comentarios";
                    loadUtterances(); // Llama a la función para cargar el script
                } else {
                    commentsToggleBtn.textContent = "💬 Mostrar Comentarios";
                }
            });
        }
        // ... (resto de tus event listeners del panel de ajustes, etc.)
    }

    init();

    // ---- NOTA: A CONTINUACIÓN VA EL RESTO DEL CÓDIGO JS QUE NO CAMBIÓ ----
    // (Asegúrate de que estas funciones también están en tu archivo)

    async function preloadAssets() { /* ...código de mensajes anteriores... */ }
    function calculatePactOfTheDay() { /* ...código de mensajes anteriores... */ }
    function dealCards() { /* ...código de mensajes anteriores... */ }
    function displayCards(cards) { /* ...código de mensajes anteriores... */ }
    function createCardElement(card, index) { /* ...código de mensajes anteriores... */ }
    function handleCardClick(cardEl) { /* ...código de mensajes anteriores... */ }
    function updateCardCounter() { /* ...código de mensajes anteriores... */ }
    function initializeFuseSearch() { /* ...código de mensajes anteriores... */ }
    function handleSearch() { /* ...código de mensajes anteriores... */ }
    function openModal(modal) { /* ...código de mensajes anteriores... */ }
    function closeModal() { /* ...código de mensajes anteriores... */ }
    function closeAllPopups() { /* ...código de mensajes anteriores... */ }
    function showChangelog() { /* ...código de mensajes anteriores... */ }
    function showLegalModal() { /* ...código de mensajes anteriores... */ }
    function openCardViewModal(cardId) { /* ...código de mensajes anteriores... */ }
    function updateCardViewModal() { /* ...código de mensajes anteriores... */ }
    function navigateCard(direction) { /* ...código de mensajes anteriores... */ }
    function loadSettings() { /* ...código de mensajes anteriores... */ }
    function saveSettings() { /* ...código de mensajes anteriores... */ }
    function applySettings() { /* ...código de mensajes anteriores... */ }
    function resetSettings() { /* ...código de mensajes anteriores... */ }
    function clearSeenCards() { /* ...código de mensajes anteriores... */ }
    function revealAllCards() { /* ...código de mensajes anteriores... */ }
    function copyDebugInfo() { /* ...código de mensajes anteriores... */ }
    async function setupVisitorCounter() { /* ...código de mensajes anteriores... */ }
    function startSubtitleRotator() { /* ...código de mensajes anteriores... */ }
    function getCardBackUrl(index) { /* ...código de mensajes anteriores... */ }
    async function loadAudio() { /* ...código de mensajes anteriores... */ }
    function playSound(name) { /* ...código de mensajes anteriores... */ }
});