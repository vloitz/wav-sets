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
    const currentTracklistElement = document.getElementById('current-tracklist');
    const favToggleCheckbox = document.getElementById('fav-toggle'); // Referencia al checkbox
    // Referencias para Último Set (VERIFICAR IDs CON index.html)
    const latestSetTitleEl = document.getElementById('latest-set-title');
    const latestSetDateEl = document.getElementById('latest-set-date');


    let allSets = [];
    let currentSetIndex = 0;
    let favorites = new Set(JSON.parse(localStorage.getItem('vloitz_favorites') || '[]'));
    let currentLoadedSet = null;
    let wavesurfer = null;

    // --- Variables para lógica táctil ---
    let isDraggingWaveformTouch = false;
    let longTouchTimer = null;
    const LONG_TOUCH_THRESHOLD = 200;
    let wasPlayingBeforeDrag = false;

    console.log("Variables globales inicializadas. Favoritos:", favorites); // LOG

    // --- Inicializar WaveSurfer ---
    try {
        console.log("Inicializando WaveSurfer..."); // LOG
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: "#cccccc", progressColor: "#ff7f00", cursorColor: "#ffffff",
            height: 100, cursorWidth: 1, barWidth: 1, barGap: 0, barHeight: 0.9, barRadius: 10,
            responsive: true, backend: 'MediaElement', media: document.getElementById('audio-player')
        });
        console.log("WaveSurfer inicializado."); // LOG
        window.wavesurfer = wavesurfer;
        console.log("WaveSurfer asignado a window."); // LOG
    } catch (error) { console.error("Error CRÍTICO WS:", error); return; }

    // --- Cargar sets.json ---
    console.log("Cargando sets.json..."); // LOG
    fetch('sets.json')
        .then(response => { if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); return response.json(); })
        .then(data => {
            console.log("sets.json cargado:", data); // LOG
            if (data.profile) {
                profilePicImg.src = data.profile.profile_pic_url;
                profileBanner.style.backgroundImage = `url('${data.profile.banner_url}')`; console.log("Perfil cargado."); // LOG
            }
            allSets = data.sets;
            allSets.sort((a, b) => new Date(b.date) - new Date(a.date));

            // --- Actualizar Placeholder 'Último Set' ---
            if (allSets.length > 0) {
                const latestSet = allSets[0];
                // VERIFICAR que los IDs coincidan con el HTML
                if (latestSetTitleEl) latestSetTitleEl.textContent = latestSet.title; else console.warn("Elemento #latest-set-title no encontrado.");
                if (latestSetDateEl) latestSetDateEl.textContent = latestSet.date; else console.warn("Elemento #latest-set-date no encontrado.");
                console.log("Placeholder 'Último Set' actualizado."); // LOG
            }
            // --- Fin Actualizar Placeholder ---

            populateTracklist(allSets);
            if (allSets.length > 0) { loadTrack(allSets[0], 0); }
            else { currentTrackTitle.textContent = "No hay sets."; console.warn("No sets found."); }
        })
        .catch(error => { console.error('Error FATAL sets.json:', error); currentTrackTitle.textContent = "Error datos."; });

    // --- Poblar la lista General de Sets ---
    function populateTracklist(sets) { /* ... (sin cambios) ... */
        console.log("Poblando lista general..."); // LOG
        tracklistElement.innerHTML = '';
        sets.forEach((set, index) => {
            const li = document.createElement('li'); li.className = 'track-item'; li.dataset.index = index;
            li.innerHTML = `<img src="${set.cover_art_url}" alt="${set.title} cover" class="track-item-cover"><span class="track-item-title">${set.title}</span><span class="track-item-date">${set.date}</span>`;
            tracklistElement.appendChild(li);
        }); console.log(`Lista general poblada: ${sets.length} items.`); // LOG
    }

    // --- Cargar un Set específico ---
    function loadTrack(set, index) { /* ... (sin cambios en fetch picos/load) ... */
        console.log(`Cargando track ${index}: ${set.title}`); // LOG
        currentCoverArt.src = set.cover_art_url; currentTrackTitle.textContent = `Cargando: ${set.title}...`; currentSetIndex = index;
        totalDurationEl.textContent = '0:00'; currentTimeEl.textContent = '0:00'; playPauseBtn.disabled = true; playPauseBtn.textContent = '🔄';
        console.log(`WS load URL: ${set.audio_url}`); // LOG
        if (set.peaks_url) {
            console.log(`Fetch picos: ${set.peaks_url}`); // LOG
            fetch(set.peaks_url)
                .then(response => { if (!response.ok) throw new Error(`HTTP error picos! ${response.status}`); return response.json(); })
                .then(peaksData => {
                    const peaksArray = peaksData.data;
                    if (peaksArray && Array.isArray(peaksArray)) { console.log(`Picos OK (${peaksArray.length}). Loading audio+picos...`); wavesurfer.load(set.audio_url, peaksArray); }
                    else { console.warn("JSON picos inválido. Loading solo audio..."); wavesurfer.load(set.audio_url); }
                }).catch(error => { console.error('Error picos:', error); console.warn("Fallback: Loading solo audio..."); wavesurfer.load(set.audio_url); });
        } else { console.log("No peaks_url. Loading solo audio..."); wavesurfer.load(set.audio_url); }
        currentLoadedSet = set;
        // Llamar a displayTracklist usando el estado actual del checkbox
        displayTracklist(set.tracklist || [], favToggleCheckbox ? favToggleCheckbox.checked : false);
        updatePlayingHighlight();
    }

    // --- Resaltar activo en lista general ---
    function updatePlayingHighlight() { /* ... (sin cambios) ... */
        tracklistElement.querySelectorAll('.track-item').forEach(item => item.classList.remove('playing'));
        const activeItem = tracklistElement.querySelector(`.track-item[data-index="${currentSetIndex}"]`);
        if (activeItem && wavesurfer && wavesurfer.isPlaying()) { activeItem.classList.add('playing'); /* console.log(`Resaltando ${currentSetIndex}.`); */ }
    }

    // Formatear tiempo
    function formatTime(seconds) { /* ... (sin cambios) ... */
        seconds = Number(seconds); if (isNaN(seconds) || seconds < 0) { seconds = 0; }
        const minutes = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // --- Mostrar el tracklist del set actual (CON LOGS DETALLADOS FILTRO) ---
    function displayTracklist(tracklistData, filterFavorites = false) {
        console.log(`[DisplayTracklist] Mostrando. Filtrar: ${filterFavorites}`); // LOG Inicio
        currentTracklistElement.innerHTML = '';
        let itemsDisplayed = 0;

        if (!tracklistData || tracklistData.length === 0) {
            currentTracklistElement.innerHTML = '<li>No tracklist available.</li>'; console.warn("[DisplayTracklist] No data."); return;
        }

        tracklistData.forEach((track, index) => {
            const timeParts = track.time.split(':'); let totalSeconds = 0;
            if (timeParts.length === 2 && !isNaN(parseInt(timeParts[0], 10)) && !isNaN(parseInt(timeParts[1], 10))) { totalSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10); }
            else { console.warn(`[DisplayTracklist] Invalid time: ${track.time}`); }
            const isFavorited = favorites.has(totalSeconds);
            // LOG DETALLADO POR ITEM:
            // console.log(`[DisplayTracklist] Item ${index}: ${track.title}, Fav: ${isFavorited}. Filtro: ${filterFavorites}`);

            // Lógica de Filtro
            if (!filterFavorites || (filterFavorites && isFavorited)) {
                 // console.log(`[DisplayTracklist] -> Mostrando item ${index}`); // LOG Mostrando
                const li = document.createElement('li'); li.className = 'current-tracklist-item'; li.dataset.time = track.time; li.dataset.index = index;
                li.innerHTML = `<span class="track-time">${track.time}</span><span class="track-emoji">${track.emoji || ''}</span><span class="track-title">${track.title}</span><button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-seconds="${totalSeconds}" title="Fav"> ${isFavorited ? '★' : '☆'} </button>`;
                currentTracklistElement.appendChild(li);
                itemsDisplayed++;
            } else {
                 // console.log(`[DisplayTracklist] -> Ocultando item ${index} (No cumple filtro)`); // LOG Ocultando
            }
        });

        if (itemsDisplayed === 0 && filterFavorites) {
             currentTracklistElement.innerHTML = '<li>No tienes favoritos marcados.</li>'; console.log("[DisplayTracklist] Filtro activo, 0 favoritos."); // LOG
        } else if (itemsDisplayed > 0){
             console.log(`[DisplayTracklist] Mostrados ${itemsDisplayed} items.`); // LOG
        }
    }

    // --- Función SeekWaveform ---
    const seekWaveform = (clientX, rect, eventType) => { /* ... (sin cambios, usa prefijo [Drag v6 Final Corrected]) ... */
        console.log(`[Drag v6 Final Corrected] seekWaveform llamado desde: ${eventType}`);
        if (!wavesurfer) { console.warn("[Drag v6 Final Corrected] Seek ignorado: WS no inicializado."); return false; }
        const x = Math.max(0, clientX - rect.left); const width = rect.width;
        if (width === 0) { console.warn("[Drag v6 Final Corrected] Seek abortado: Ancho 0."); return false; }
        const progress = Math.max(0, Math.min(1, x / width));
        try {
             wavesurfer.seekTo(progress);
             const duration = wavesurfer.getDuration();
             if (duration > 0 && currentTimeEl) { currentTimeEl.textContent = formatTime(progress * duration); }
             console.log(`[Drag v6 Final Corrected] Seek executed: progress=${progress.toFixed(4)}`); return true;
        } catch (error) { console.error(`[Drag v6 Final Corrected] Error en seekTo(${progress.toFixed(4)}):`, error); return false; }
    };

    // --- Handlers Globales para Arrastre Táctil (Definidos Fuera) ---
    const handleWaveformTouchMove = (moveEvent) => { /* ... (sin cambios, usa prefijo [Drag v7 Refactored]) ... */
        console.log("[Drag v7 Refactored] handleWaveformTouchMove INICIO.");
        if (!isDraggingWaveformTouch) { console.log("[Drag v7 Refactored] Move ignorado."); return; }
        moveEvent.preventDefault();
        if (moveEvent.touches && moveEvent.touches.length > 0) {
            const wavesurferElement = wavesurfer.getWrapper(); const rect = wavesurferElement.getBoundingClientRect();
            seekWaveform(moveEvent.touches[0].clientX, rect, "touchmove");
        } else { console.warn("[Drag v7 Refactored] Touch Move: No 'touches'."); }
        console.log("[Drag v7 Refactored] handleWaveformTouchMove FIN.");
     };
    const handleWaveformTouchEnd = (endEvent) => { /* ... (sin cambios, usa prefijo [Drag v7 Refactored]) ... */
        console.log(`[Drag v7 Refactored] handleWaveformTouchEnd (Global) INICIO. isDragging: ${isDraggingWaveformTouch}. Tipo: ${endEvent.type}`);
        if (!isDraggingWaveformTouch) { console.log("[Drag v7 Refactored] End (Global) ignorado."); return; }
        isDraggingWaveformTouch = false;
        if (wasPlayingBeforeDrag) { wavesurfer.play(); console.log("[Drag v7 Refactored] Audio reanudado."); }
        wasPlayingBeforeDrag = false;
        console.log("[Drag v7 Refactored] Bandera reseteada (Global).");
        console.log("[Drag v7 Refactored] Removiendo listeners GLOBALES...");
        window.removeEventListener('touchmove', handleWaveformTouchMove); window.removeEventListener('touchend', handleWaveformTouchEnd); window.removeEventListener('touchcancel', handleWaveformTouchEnd);
        console.log("[Drag v7 Refactored] handleWaveformTouchEnd (Global) FIN.");
     };


    // --- Eventos de WaveSurfer ---
    wavesurfer.on('ready', () => { /* ... (sin cambios) ... */
        const duration = wavesurfer.getDuration(); totalDurationEl.textContent = formatTime(duration); currentTimeEl.textContent = formatTime(0);
        playPauseBtn.disabled = false; playPauseBtn.textContent = '▶️'; currentTrackTitle.textContent = allSets[currentSetIndex]?.title || "Set Listo"; console.log("WS listo:", allSets[currentSetIndex]?.title);
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

    // --- Lógica Drag-to-Seek ---
    // const waveformInteractionElement = document.getElementById('waveform'); // Ya definido

    if (waveformInteractionElement && wavesurfer) {
        console.log("[Drag v7 Final] Añadiendo listeners TÁCTILES v7."); // LOG

        // Variables ya definidas arriba

        // Listener INICIO TÁCTIL
        waveformInteractionElement.addEventListener('touchstart', (event) => {
            console.log("[Drag v7 Final] Evento: touchstart INICIO.");
            if (event.target.closest('button')) { console.warn("[Drag v7 Final] Touch Start ignorado: botón."); return; }
            console.log("[Drag v7 Final] Touch Start ACEPTADO.");

            clearTimeout(longTouchTimer);

            let touchStartTime = 0;
            if (wavesurfer && typeof wavesurfer.getCurrentTime === 'function') { try { touchStartTime = wavesurfer.getCurrentTime(); } catch (e) {} }
            if (touchStartTime === 0 && wavesurfer && wavesurfer.getMediaElement()) { touchStartTime = wavesurfer.getMediaElement().currentTime || 0; }
            const formattedTouchStartTime = formatTime(touchStartTime);
            console.log(`[Drag v7 Final] Tiempo inicio toque: ${formattedTouchStartTime}`);

            console.log("[Drag v7 Final] Intentando seek inicial...");
            if (event.touches && event.touches.length > 0) {
                const wavesurferElement = wavesurfer.getWrapper(); const rect = wavesurferElement.getBoundingClientRect();
                seekWaveform(event.touches[0].clientX, rect, "touchstart-initial");
            } else { console.warn("[Drag v7 Final] Touch Start: No 'touches' para seek inicial."); }

            longTouchTimer = setTimeout(() => {
                console.warn(`[Drag v7 Final] ¡TOQUE LARGO DETECTADO! en ${formattedTouchStartTime}`);
                wasPlayingBeforeDrag = wavesurfer.isPlaying();
                if (wasPlayingBeforeDrag) { wavesurfer.pause(); console.log("[Drag v7 Final] Audio pausado."); }
                isDraggingWaveformTouch = true;
                console.log("[Drag v7 Final] isDragging=TRUE. Añadiendo listeners GLOBALES.");
                window.addEventListener('touchmove', handleWaveformTouchMove, { passive: false });
                window.addEventListener('touchend', handleWaveformTouchEnd);
                window.addEventListener('touchcancel', handleWaveformTouchEnd);
            }, LONG_TOUCH_THRESHOLD);

            console.log(`[Drag v7 Final] touchstart FIN (Timer iniciado).`);
        });

        // Listener CLIC SIMPLE PC
        waveformInteractionElement.addEventListener('click', (event) => {
            if (!isDraggingWaveformTouch && wavesurfer && wavesurfer.isReady && !event.target.closest('button')) {
                console.log("[Drag v7 Final] Clic simple (Mouse) detectado.");
                const wavesurferElement = wavesurfer.getWrapper(); const rect = wavesurferElement.getBoundingClientRect();
                seekWaveform(event.clientX, rect, "click");
            } else { console.log(`[Drag v7 Final] Clic ignorado. isDragging: ${isDraggingWaveformTouch}, WS ready: ${wavesurfer ? wavesurfer.isReady : 'N/A'}`); }
        });

        // Listener LOCAL FIN de toque (Cancelar Timer TAP)
         const handleWaveformTapEnd = (event) => {
             console.log(`[Drag v7 Final] Evento LOCAL: ${event.type}.`);
             if (longTouchTimer) { clearTimeout(longTouchTimer); console.log("[Drag v7 Final] Timer cancelado (TAP)."); longTouchTimer = null; }
         };
         waveformInteractionElement.addEventListener('touchend', handleWaveformTapEnd);
         waveformInteractionElement.addEventListener('touchcancel', handleWaveformTapEnd);

    } else { console.error("[Drag v7 Final] No se pudo añadir lógica de interacción."); }
    // --- FIN Lógica Drag-to-Seek ---

    // --- Manejar clics en el tracklist actual ---
    currentTracklistElement.addEventListener('click', (e) => { /* ... (sin cambios, usa [Tracklist Clic] logs) ... */
        const target = e.target;
        if (target.classList.contains('favorite-btn')) {
            const seconds = parseInt(target.dataset.seconds, 10); if (isNaN(seconds)) return;
            toggleFavorite(seconds, target); console.log(`Fav clic: ${seconds}s.`);
        } else {
            const listItem = target.closest('.current-tracklist-item'); if (!listItem || !listItem.dataset.time) return;
            const timeString = listItem.dataset.time; const timeParts = timeString.split(':'); let timeInSeconds = 0;
            if (timeParts.length === 2 && !isNaN(parseInt(timeParts[0], 10)) && !isNaN(parseInt(timeParts[1], 10))) { timeInSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10); } else { console.warn(`Invalid time: ${timeString}`); return; }
            console.log(`Tracklist clic: ${timeString} (${timeInSeconds}s).`);
            try {
                if (wavesurfer && typeof wavesurfer.getDuration === 'function' && typeof wavesurfer.seekTo === 'function') {
                    if (wavesurfer.isReady) {
                        const duration = wavesurfer.getDuration();
                        if (duration > 0) { const progress = timeInSeconds / duration; const clampedProgress = Math.max(0, Math.min(1, progress)); console.log(`[Tracklist Clic] Calc prog: ${timeInSeconds}s / ${duration.toFixed(2)}s = ${clampedProgress.toFixed(4)}`); wavesurfer.seekTo(clampedProgress); console.log(`[Tracklist Clic] Seek exec: ${clampedProgress.toFixed(4)}`); } else { console.warn("[Tracklist Clic] Duración 0."); }
                        if (!wavesurfer.isPlaying()) { wavesurfer.play(); }
                    } else { console.warn("[Tracklist Clic] Ignorado: WS no listo."); }
                } else { console.error("[Tracklist Clic] WS no init."); }
            } catch (error) { console.error("[Tracklist Clic] Error seek:", error); }
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
    playPauseBtn.addEventListener('click', () => { /* ... (sin cambios, sin check isReady) ... */
        console.log("Clic Play/Pause");
        if (wavesurfer && typeof wavesurfer.playPause === 'function') { wavesurfer.playPause(); }
        else { console.warn("[Play/Pause] Ignorado: WS no inicializado."); }
    });

    // --- Listener para el Toggle de Favoritos ---
    if (favToggleCheckbox) {
        favToggleCheckbox.addEventListener('change', () => {
            console.log("[Filter] Toggle Favoritos cambiado:", favToggleCheckbox.checked); // LOG
            if (currentLoadedSet) {
                // Volver a dibujar usando el estado actual del checkbox
                displayTracklist(currentLoadedSet.tracklist || [], favToggleCheckbox.checked);
            } else { console.warn("[Filter] No hay set cargado para filtrar."); }
        });
        console.log("Listener para Toggle Favoritos añadido."); // LOG
    } else { console.warn("Checkbox filtro favoritos no encontrado!"); } // LOG Advertencia

    console.log("Aplicación inicializada y listeners configurados."); // LOG FINAL INIT
});
