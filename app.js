document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM listo. Iniciando aplicación..."); // LOG INICIAL

    // --- Referencias ---
    const waveformContainer = document.getElementById('waveform');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const currentTimeEl = document.getElementById('currentTime');
    const totalDurationEl = document.getElementById('totalDuration');
    const currentCoverArt = document.getElementById('current-cover-art');
    const currentTrackTitle = document.getElementById('current-track-title');
    const tracklistElement = document.getElementById('tracklist');
    const profilePicImg = document.getElementById('profile-pic-img');
    const profileBanner = document.querySelector('.profile-banner');
    const currentTracklistElement = document.getElementById('current-tracklist'); // Referencia al nuevo <ul>

    let allSets = [];
    let currentSetIndex = 0;
    let favorites = new Set(JSON.parse(localStorage.getItem('vloitz_favorites') || '[]')); // Cargar favoritos guardados
    let currentLoadedSet = null; // Para saber qué set está cargado
    let wavesurfer = null; // Declarar wavesurfer aquí

    // --- Variables para lógica táctil v6 ---
    let isDraggingWaveformTouch = false; // Bandera específica para arrastre táctil (activada por toque largo)
    let longTouchTimer = null; // Variable para el temporizador de toque largo
    const LONG_TOUCH_THRESHOLD = 200; // Umbral en milisegundos

    console.log("Variables globales inicializadas. Favoritos cargados:", favorites); // LOG

    // --- Inicializar WaveSurfer ---
    try {
        console.log("Inicializando WaveSurfer..."); // LOG
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: "#cccccc", progressColor: "#ff7f00", cursorColor: "#ffffff",
            height: 100, cursorWidth: 1, barWidth: 1, barGap: 0, barHeight: 0.9, barRadius: 10,
            responsive: true, backend: 'MediaElement', media: document.getElementById('audio-player')
        });
        console.log("WaveSurfer inicializado correctamente."); // LOG
        window.wavesurfer = wavesurfer;
        console.log("Instancia de WaveSurfer asignada a window.wavesurfer."); // LOG
    } catch (error) {
         console.error("Error CRÍTICO al inicializar WaveSurfer:", error); return;
    }

    // --- Cargar sets.json ---
    console.log("Cargando sets.json..."); // LOG
    fetch('sets.json')
        .then(response => { if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); } return response.json(); })
        .then(data => {
            console.log("sets.json cargado:", data); // LOG ÉXITO
            if (data.profile) {
                profilePicImg.src = data.profile.profile_pic_url;
                profileBanner.style.backgroundImage = `url('${data.profile.banner_url}')`; console.log("Perfil cargado."); // LOG
            }
            allSets = data.sets;
            allSets.sort((a, b) => new Date(b.date) - new Date(a.date));
            populateTracklist(allSets);
            if (allSets.length > 0) { loadTrack(allSets[0], 0); } else { currentTrackTitle.textContent = "No hay sets."; console.warn("No sets found."); }
        })
        .catch(error => { console.error('Error FATAL al cargar sets.json:', error); currentTrackTitle.textContent = "Error al cargar datos."; });

    // --- Poblar la lista ---
    function populateTracklist(sets) { /* ... (sin cambios) ... */
        console.log("Poblando tracklist..."); // LOG
        tracklistElement.innerHTML = '';
        sets.forEach((set, index) => {
            const li = document.createElement('li'); li.className = 'track-item'; li.dataset.index = index;
            li.innerHTML = `<img src="${set.cover_art_url}" alt="${set.title} cover" class="track-item-cover"><span class="track-item-title">${set.title}</span><span class="track-item-date">${set.date}</span>`;
            tracklistElement.appendChild(li);
        }); console.log(`Tracklist poblado con ${sets.length} items.`); // LOG
     }

    // --- Cargar un set ---
    function loadTrack(set, index) { /* ... (lógica fetch picos y wavesurfer.load sin cambios) ... */
        console.log(`Cargando track ${index}: ${set.title}`); // LOG
        currentCoverArt.src = set.cover_art_url; currentTrackTitle.textContent = `Cargando: ${set.title}...`; currentSetIndex = index;
        totalDurationEl.textContent = '0:00'; currentTimeEl.textContent = '0:00'; playPauseBtn.disabled = true; playPauseBtn.textContent = '🔄';
        console.log(`WaveSurfer intentará cargar: ${set.audio_url}`); // LOG
        if (set.peaks_url) {
            console.log(`Intentando cargar picos desde: ${set.peaks_url}`); // LOG
            fetch(set.peaks_url)
                .then(response => { if (!response.ok) { throw new Error(`HTTP error picos! status: ${response.status}`); } return response.json(); })
                .then(peaksData => {
                    const peaksArray = peaksData.data;
                    if (peaksArray && Array.isArray(peaksArray)) { console.log(`Picos cargados (${peaksArray.length}). Cargando audio+picos...`); wavesurfer.load(set.audio_url, peaksArray); }
                    else { console.warn("JSON picos inválido. Cargando solo audio..."); wavesurfer.load(set.audio_url); }
                })
                .catch(error => { console.error('Error picos:', error); console.warn("Fallback: Cargando solo audio..."); wavesurfer.load(set.audio_url); });
        } else { console.log("No peaks_url. Cargando solo audio..."); wavesurfer.load(set.audio_url); }
        currentLoadedSet = set; displayTracklist(set.tracklist || []); updatePlayingHighlight();
     }

    // --- Resaltar activo ---
    function updatePlayingHighlight() { /* ... (sin cambios) ... */
        tracklistElement.querySelectorAll('.track-item').forEach(item => item.classList.remove('playing'));
        const activeItem = tracklistElement.querySelector(`.track-item[data-index="${currentSetIndex}"]`);
        if (activeItem && wavesurfer && wavesurfer.isPlaying()) { activeItem.classList.add('playing'); console.log(`Resaltando track ${currentSetIndex}.`); }
    }

    // Formatear tiempo
    function formatTime(seconds) { /* ... (sin cambios) ... */
        seconds = Number(seconds); if (isNaN(seconds) || seconds < 0) { seconds = 0; }
        const minutes = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // --- Mostrar el tracklist del set actual ---
    function displayTracklist(tracklistData) { /* ... (sin cambios) ... */
        console.log("Mostrando tracklist del set..."); // LOG
        currentTracklistElement.innerHTML = '';
        if (!tracklistData || tracklistData.length === 0) { currentTracklistElement.innerHTML = '<li>No tracklist available.</li>'; console.warn("No tracklist data."); return; }
        tracklistData.forEach((track, index) => {
            const li = document.createElement('li'); li.className = 'current-tracklist-item'; li.dataset.time = track.time; li.dataset.index = index;
            const timeParts = track.time.split(':'); let totalSeconds = 0;
            if (timeParts.length === 2 && !isNaN(parseInt(timeParts[0], 10)) && !isNaN(parseInt(timeParts[1], 10))) { totalSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10); }
            else { console.warn(`Timestamp inválido: ${track.time}`); }
            const isFavorited = favorites.has(totalSeconds);
            li.innerHTML = `<span class="track-time">${track.time}</span><span class="track-emoji">${track.emoji || ''}</span><span class="track-title">${track.title}</span><button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-seconds="${totalSeconds}" title="Fav"> ${isFavorited ? '★' : '☆'} </button>`;
            currentTracklistElement.appendChild(li);
        }); console.log(`Tracklist mostrado: ${tracklistData.length} items.`); // LOG
    }

    // --- Función SeekWaveform (Definida ANTES de usarse) ---
    const seekWaveform = (clientX, rect, eventType) => {
        console.log(`[Drag V6 Final] seekWaveform llamado desde: ${eventType}`); // LOG
        if (!wavesurfer) { console.warn("[Drag V6 Final] SeekWaveform ignorado: WS no inicializado."); return false; }
        const x = Math.max(0, clientX - rect.left); const width = rect.width;
        if (width === 0) { console.warn("[Drag V6 Final] SeekWaveform abortado: Ancho 0."); return false; }
        const progress = Math.max(0, Math.min(1, x / width));
        try {
            // Quitamos check isReady basado en logs
            // if(wavesurfer.isReady) {
                wavesurfer.seekTo(progress);
                const duration = wavesurfer.getDuration();
                if (duration > 0 && currentTimeEl) { currentTimeEl.textContent = formatTime(progress * duration); }
                console.log(`[Drag V6 Final] Seek executed: progress=${progress.toFixed(4)}`); return true;
            // } else { console.warn("[Drag V6 Final] SeekWaveform abortado DENTRO: WS no listo."); return false; }
        } catch (error) { console.error(`[Drag V6 Final] Error en seekTo(${progress.toFixed(4)}):`, error); return false; }
    };

    // --- Eventos de WaveSurfer ---
    wavesurfer.on('ready', () => { /* ... (sin cambios) ... */
        const duration = wavesurfer.getDuration(); totalDurationEl.textContent = formatTime(duration); currentTimeEl.textContent = formatTime(0);
        playPauseBtn.disabled = false; playPauseBtn.textContent = '▶️'; currentTrackTitle.textContent = allSets[currentSetIndex]?.title || "Set Listo";
        console.log("WS listo:", allSets[currentSetIndex]?.title);
    });
    wavesurfer.on('loading', (percent) => { /* ... (sin cambios) ... */
         console.log(`WS cargando: ${percent}%`); currentTrackTitle.textContent = `Cargando: ${allSets[currentSetIndex]?.title || 'Set'} (${percent}%)`;
    });
    wavesurfer.on('error', (err) => { /* ... (sin cambios) ... */
         console.error('WS Error:', err); currentTrackTitle.textContent = `Error: ${err.message || err}`; playPauseBtn.textContent = '❌'; playPauseBtn.disabled = true;
    });
    wavesurfer.on('timeupdate', (currentTime) => { currentTimeEl.textContent = formatTime(currentTime); });
    wavesurfer.on('seeking', (currentTime) => { currentTimeEl.textContent = formatTime(currentTime); console.log(`WS Seeking a: ${formatTime(currentTime)}`); });
    wavesurfer.on('play', () => { playPauseBtn.textContent = '⏸️'; updatePlayingHighlight(); console.log("WS Evento: Play"); });
    wavesurfer.on('pause', () => { playPauseBtn.textContent = '▶️'; updatePlayingHighlight(); console.log("WS Evento: Pause"); });
    wavesurfer.on('finish', () => { /* ... (sin cambios) ... */
        console.log("WS Evento: Finish"); playPauseBtn.textContent = '▶️';
        const nextIndex = (currentSetIndex + 1) % allSets.length; console.log(`Cargando siguiente: ${nextIndex}`);
        if (allSets.length > 0) { loadTrack(allSets[nextIndex], nextIndex); wavesurfer.once('ready', () => { console.log("Siguiente listo, play..."); wavesurfer.play(); }); }
    });


    // --- NUEVO v6 Stable Final: Lógica Drag-to-Seek ---
    const waveformInteractionElement = document.getElementById('waveform');

    if (waveformInteractionElement && wavesurfer) {
        console.log("[Drag V6 Final] Añadiendo listeners TÁCTILES v6."); // LOG

        // Variables ya definidas arriba: isDraggingWaveformTouch, longTouchTimer, LONG_TOUCH_THRESHOLD

        // Listener para INICIO TÁCTIL (touchstart en el elemento waveform)
        waveformInteractionElement.addEventListener('touchstart', (event) => {
            console.log("[Drag V6 Final] Evento: touchstart INICIO."); // LOG INICIO
            if (event.target.closest('button')) { console.warn("[Drag V6 Final] Touch Start ignorado: botón."); return; }
            // Quitamos check isReady temporalmente
            console.log("[Drag V6 Final] Touch Start ACEPTADO."); // LOG Aceptado

            clearTimeout(longTouchTimer); // Limpiar timer

            let touchStartTime = 0;
            if (wavesurfer && typeof wavesurfer.getCurrentTime === 'function') { try { touchStartTime = wavesurfer.getCurrentTime(); } catch (e) {} }
            if (touchStartTime === 0 && wavesurfer && wavesurfer.getMediaElement()) { touchStartTime = wavesurfer.getMediaElement().currentTime || 0; }
            const formattedTouchStartTime = formatTime(touchStartTime);
            console.log(`[Drag V6 Final] Tiempo inicio toque: ${formattedTouchStartTime}`); // LOG TIEMPO

            // --- INICIO: Llamar a seekWaveform en touchstart ---
            console.log("[Drag V6 Final] Intentando seek inicial en touchstart..."); // LOG
            if (event.touches && event.touches.length > 0) {
                const wavesurferElement = wavesurfer.getWrapper();
                const rect = wavesurferElement.getBoundingClientRect();
                seekWaveform(event.touches[0].clientX, rect, "touchstart-initial"); // Llamada a seek
            } else { console.warn("[Drag V6 Final] Touch Start: No 'touches' para seek inicial."); }
            // --- FIN: Llamar a seekWaveform en touchstart ---

            // Iniciar temporizador para detectar toque largo
            longTouchTimer = setTimeout(() => {
                console.warn(`[Drag V6 Final] ¡TOQUE LARGO DETECTADO! en ${formattedTouchStartTime}`); // LOG LARGO
                isDraggingWaveformTouch = true; // Activar bandera de arrastre
                console.log("[Drag V6 Final] isDragging=TRUE. Añadiendo listeners GLOBALES."); // LOG

                // --- Definir Handlers Globales ANTES de usarlos ---
                const handleWaveformTouchMove = (moveEvent) => {
                    console.log("[Drag V6 Final] handleWaveformTouchMove INICIO."); // LOG Move Start
                    if (!isDraggingWaveformTouch) { console.log("[Drag V6 Final] Move ignorado: isDragging false."); return; }
                    moveEvent.preventDefault(); // Prevenir scroll
                    if (moveEvent.touches && moveEvent.touches.length > 0) {
                        const wavesurferElement = wavesurfer.getWrapper(); const rect = wavesurferElement.getBoundingClientRect();
                        seekWaveform(moveEvent.touches[0].clientX, rect, "touchmove"); // Calcular y buscar
                    } else { console.warn("[Drag V6 Final] Touch Move: No 'touches'."); }
                    console.log("[Drag V6 Final] handleWaveformTouchMove FIN."); // LOG Move End
                };

                const handleWaveformTouchEnd = (endEvent) => {
                    console.log(`[Drag V6 Final] handleWaveformTouchEnd (Global) INICIO. isDragging: ${isDraggingWaveformTouch}. Tipo: ${endEvent.type}`); // LOG End Start
                    if (!isDraggingWaveformTouch) { console.log("[Drag V6 Final] End (Global) ignorado: isDragging false."); return; }
                    isDraggingWaveformTouch = false; // Resetear bandera
                    console.log("[Drag V6 Final] Bandera isDragging reseteada (Global)."); // LOG Reset
                    console.log("[Drag V6 Final] Removiendo listeners GLOBALES..."); // LOG Remove
                    window.removeEventListener('touchmove', handleWaveformTouchMove);
                    window.removeEventListener('touchend', handleWaveformTouchEnd);
                    window.removeEventListener('touchcancel', handleWaveformTouchEnd);
                    console.log("[Drag V6 Final] handleWaveformTouchEnd (Global) FIN."); // LOG End End
                };
                // --- FIN Definir Handlers ---

                // Añadir listeners globales AHORA
                window.addEventListener('touchmove', handleWaveformTouchMove, { passive: false });
                window.addEventListener('touchend', handleWaveformTouchEnd);
                window.addEventListener('touchcancel', handleWaveformTouchEnd);

            }, LONG_TOUCH_THRESHOLD);

            console.log(`[Drag V6 Final] touchstart FIN (Timer iniciado).`); // LOG FIN touchstart
        });

        // Listener para CLIC SIMPLE de RATÓN (PC)
        waveformInteractionElement.addEventListener('click', (event) => {
            if (!isDraggingWaveformTouch && wavesurfer && wavesurfer.isReady && !event.target.closest('button')) {
                console.log("[Drag V6 Final] Clic simple (Mouse) detectado."); // LOG Click
                const wavesurferElement = wavesurfer.getWrapper(); const rect = wavesurferElement.getBoundingClientRect();
                seekWaveform(event.clientX, rect, "click"); // Llamada a seek
            } else {
                 console.log(`[Drag V6 Final] Clic ignorado. isDragging: ${isDraggingWaveformTouch}, WS ready: ${wavesurfer ? wavesurfer.isReady : 'N/A'}`); // LOG Ignorado
            }
        });

        // Listener LOCAL para FIN de toque (SOLO para cancelar timer en TAP rápido)
         const handleWaveformTapEnd = (event) => {
             console.log(`[Drag V6 Final] Evento LOCAL: ${event.type} detectado.`); // LOG Local End
             if (longTouchTimer) { clearTimeout(longTouchTimer); console.log("[Drag V6 Final] Timer cancelado (TAP rápido)."); }
             // No reseteamos la bandera aquí, lo hace el handler global si se llegó a activar
         };
         waveformInteractionElement.addEventListener('touchend', handleWaveformTapEnd);
         waveformInteractionElement.addEventListener('touchcancel', handleWaveformTapEnd);

    } else {
         console.error("[Drag V6 Final] No se pudo añadir lógica de interacción."); // LOG ERROR
    }
    // --- FIN NUEVO BLOQUE v6 Stable Final ---


    // --- Manejar clics en el tracklist actual ---
    currentTracklistElement.addEventListener('click', (e) => { /* ... (sin cambios) ... */
        const target = e.target;
        if (target.classList.contains('favorite-btn')) { /* ... (favoritos sin cambios) ... */
            const seconds = parseInt(target.dataset.seconds, 10); if (isNaN(seconds)) return;
            toggleFavorite(seconds, target); console.log(`Fav clic: ${seconds}s.`);
        } else { /* ... (salto tracklist sin cambios) ... */
            const listItem = target.closest('.current-tracklist-item'); if (!listItem || !listItem.dataset.time) return;
            const timeString = listItem.dataset.time; const timeParts = timeString.split(':'); let timeInSeconds = 0;
            if (timeParts.length === 2 && !isNaN(parseInt(timeParts[0], 10)) && !isNaN(parseInt(timeParts[1], 10))) { timeInSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10); } else { console.warn(`Timestamp inválido: ${timeString}`); return; }
            console.log(`Tracklist clic: ${timeString} (${timeInSeconds}s).`);
            try {
                if (wavesurfer && typeof wavesurfer.getDuration === 'function' && typeof wavesurfer.seekTo === 'function') {
                    if (wavesurfer.isReady) {
                        const duration = wavesurfer.getDuration();
                        if (duration > 0) { const progress = timeInSeconds / duration; const clampedProgress = Math.max(0, Math.min(1, progress)); wavesurfer.seekTo(clampedProgress); console.log(`Seek desde tracklist: ${clampedProgress.toFixed(4)}`); } else { console.warn("Duración 0 (tracklist)."); }
                        if (!wavesurfer.isPlaying()) { wavesurfer.play(); }
                    } else { console.warn("Tracklist clic ignorado: WS no listo."); }
                } else { console.error("WS no inicializado (tracklist)."); }
            } catch (error) { console.error("Error seek tracklist:", error); }
        }
    });

    // --- Añadir/Quitar Favorito ---
    function toggleFavorite(seconds, buttonElement) { /* ... (sin cambios) ... */
        if (favorites.has(seconds)) { favorites.delete(seconds); buttonElement.classList.remove('favorited'); buttonElement.innerHTML = '☆'; console.log(`Fav eliminado: ${seconds}s`); }
        else { favorites.add(seconds); buttonElement.classList.add('favorited'); buttonElement.innerHTML = '★'; console.log(`Fav añadido: ${seconds}s`); }
        try { localStorage.setItem('vloitz_favorites', JSON.stringify(Array.from(favorites))); console.log("Favs guardados."); }
        catch (error) { console.error("Error guardando Favs:", error); }
    }

    // --- Clic en lista general de sets ---
    tracklistElement.addEventListener('click', e => { /* ... (sin cambios) ... */
        const clickedItem = e.target.closest('.track-item'); if (!clickedItem) return;
        const trackIndex = parseInt(clickedItem.dataset.index); console.log(`Clic lista general: ${trackIndex}`);
        if (trackIndex !== currentSetIndex && allSets[trackIndex]) {
            loadTrack(allSets[trackIndex], trackIndex);
            wavesurfer.once('ready', () => { console.log("Track lista general listo, play..."); wavesurfer.play(); });
        } else if (trackIndex === currentSetIndex) { console.log("Clic track actual lista general, playPause..."); wavesurfer.playPause(); }
    });

    // --- Botón Play/Pause Principal ---
    playPauseBtn.addEventListener('click', () => { /* ... (sin cambios) ... */
        console.log("Clic Play/Pause");
        if (wavesurfer && typeof wavesurfer.playPause === 'function') {
             if (wavesurfer.isReady) { wavesurfer.playPause(); } else { console.warn("Play/Pause ignorado: WS no listo."); }
        } else { console.warn("Play/Pause ignorado: WS no inicializado."); }
    });

    console.log("App inicializada y listeners configurados."); // LOG FINAL INIT
});
