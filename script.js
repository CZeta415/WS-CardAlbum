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
    const commentsSection = document.getElementById("comments-section");
    const utterancesContainer = document.getElementById("utterances-container");
    
    // ... (El resto de las variables y la configuración de Audio y Settings no cambia)
    let isUtterancesLoaded = false;
    let appData = {};

    // --- CORRECCIÓN CRÍTICA en applySettings ---
    function applySettings() {
        // ... (resto de applySettings)
        
        // CORRECCIÓN: Usamos classList para no sobreescribir otras clases como "no-scroll"
        document.body.classList.remove("aura-effect-alfa", "aura-effect-beta");
        document.body.classList.add(`aura-effect-${settings.auraEffect}`);
    }

    // --- LÓGICA DE UTTERANCES (COMENTARIOS) ---
    function loadUtterances() {
        if (isUtterancesLoaded || !utterancesContainer) return;
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
        if (initialDeck) initialDeck.addEventListener("click", dealCards, { once: true });
        if (searchBox) searchBox.addEventListener("input", handleSearch);
        
        if (cardGallery) cardGallery.addEventListener("click", e => {
            const cardElement = e.target.closest(".card-container");
            if (cardElement) handleCardClick(cardElement);
        });

        // Event listener para cerrar popups y modales
        document.addEventListener("click", e => {
            if (settingsPanel && settingsToggleBtn && !settingsPanel.contains(e.target) && !settingsToggleBtn.contains(e.target)) {
                settingsPanel.classList.remove("visible");
            }
            if (e.target.closest(".close-modal-btn")) {
                closeModal();
            }
        });

        if (commentsToggleBtn) {
            commentsToggleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                playSound("button");
                const isVisible = commentsSection.classList.toggle("visible");
                if (isVisible) {
                    loadUtterances();
                }
            });
        }
        
        // ... (El resto de todos los event listeners de los mensajes anteriores sin cambios)
    }

    // --- ACTIVATE APP (Asegurarse de que el scroll se active) ---
    async function activateApp() {
        try {
            activationOverlay.classList.add("hidden");
            document.body.classList.remove("no-scroll"); // <- Línea clave
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await loadAudio();
            
            // ... (el resto de activateApp no cambia)
        } catch (error) {
             // ...
        }
    }
    
    // Asegúrate de incluir el resto del código JS de los mensajes anteriores
    // como init(), preloadAssets(), playSound(), etc., ya que no han cambiado.
    init(); 
});