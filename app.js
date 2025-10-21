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

    // --- Variables para lógica táctil ---
    let isDraggingWaveformTouch = false; // Bandera específica para arrastre táctil
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
        console.log("Instancia de WaveSurfer asignada a window.wavesurfer para depuración."); // LOG
    } catch (error) {
         console.error("Error CRÍTICO al inicializar WaveSurfer:", error); // LOG ERROR
         currentTrackTitle.textContent = "Error al iniciar reproductor"; playPauseBtn.textContent = '❌'; return;
    }

    // --- Cargar sets.json ---
    console.log("Cargando sets.json..."); // LOG
    fetch('sets.json')
        .then(response => { if (!response.ok) { throw new Error(`Error HTTP! status: ${response.status}`); } return response.json(); })
        .then(data => {
            console.log("sets.json cargado:", data); // LOG ÉXITO
            if (data.profile) { profilePicImg.src = data.profile.profile_pic_url; profileBanner.style.backgroundImage = `url('${data.profile.banner_url}')`; console.log("Perfil cargado."); }
            allSets = data.sets; allSets.sort((a, b) => new Date(b.date) - new Date(a.date));
            populateTracklist(allSets);
            if (allSets.length > 0) { loadTrack(allSets[0], 0); } else { currentTrackTitle.textContent = "No hay sets para mostrar."; console.warn("No se encontraron sets en sets.json"); }
        })
        .catch(error => { console.error('Error FATAL al cargar o parsear sets.json:', error); currentTrackTitle.textContent = "Error al cargar datos de sets."; });

    // --- Poblar la lista ---
    function populateTracklist(sets) { /* ... (sin cambios) ... */
        console.log("Poblando tracklist..."); // LOG
        tracklistElement.innerHTML = '';
        sets.forEach((set, index) => {
            const li = document.createElement('li');
            li.className = 'track-item';
            li.dataset.index = index;
            li.innerHTML = `
                <img src="${set.cover_art_url}" alt="${set.title} cover" class="track-item-cover">
                <span class="track-item-title">${set.title}</span>
                <span class="track-item-date">${set.date}</span>
            `;
            tracklistElement.appendChild(li);
        });
        console.log(`Tracklist poblado con ${sets.length} items.`); // LOG
     }

    // --- Cargar un set ---
    function loadTrack(set, index) { /* ... (sin cambios) ... */
        console.log(`Cargando track ${index}: ${set.title}`); // LOG
        currentCoverArt.src = set.cover_art_url;
        currentTrackTitle.textContent = `Cargando: ${set.title}...`;
        currentSetIndex = index;
        totalDurationEl.textContent = '0:00'; currentTimeEl.textContent = '0:00';
        playPauseBtn.disabled = true; playPauseBtn.textContent = '🔄';
        console.log(`WaveSurfer intentará cargar: ${set.audio_url}`); // LOG
        if (set.peaks_url) {
            console.log(`Intentando cargar picos desde: ${set.peaks_url}`); // LOG
            fetch(set.peaks_url)
                .then(response => { if (!response.ok) { throw new Error(`Error HTTP al cargar picos! status: ${response.status}`); } return response.json(); })
                .then(peaksData => {
                    const peaksArray = peaksData.data;
                    if (peaksArray && Array.isArray(peaksArray)) { console.log(`Picos cargados (${peaksArray.length} puntos). Cargando audio con picos...`); wavesurfer.load(set.audio_url, peaksArray); }
                    else { console.warn("JSON de picos inválido. Cargando solo audio..."); wavesurfer.load(set.audio_url); }
                })
                .catch(error => { console.error('Error al cargar picos:', error); console.warn("Fallback: Cargando solo audio..."); wavesurfer.load(set.audio_url); });
        } else { console.log("No peaks_url. Cargando solo audio..."); wavesurfer.load(set.audio_url); }
        currentLoadedSet = set; displayTracklist(set.tracklist || []); updatePlayingHighlight();
     }

    // --- Resaltar activo ---
    function updatePlayingHighlight() { /* ... (sin cambios) ... */
        tracklistElement.querySelectorAll('.track-item').forEach(item => { item.classList.remove('playing'); });
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
        console.log("Mostrando tracklist..."); // LOG
        currentTracklistElement.innerHTML = '';
        if (!tracklistData || tracklistData.length === 0) { currentTracklistElement.innerHTML = '<li>No hay tracklist disponible.</li>'; console.warn("No se encontró tracklist."); return; }
        tracklistData.forEach((track, index) => {
            const li = document.createElement('li'); li.className = 'current-tracklist-item'; li.dataset.time = track.time; li.dataset.index = index;
            const timeParts = track.time.split(':'); let totalSeconds = 0;
            if (timeParts.length === 2 && !isNaN(parseInt(timeParts[0], 10)) && !isNaN(parseInt(timeParts[1], 10))) { totalSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10); } else { console.warn(`Timestamp inválido: ${track.time}`); }
            const isFavorited = favorites.has(totalSeconds);
            li.innerHTML = `<span class="track-time">${track.time}</span><span class="track-emoji">${track.emoji || ''}</span><span class="track-title">${track.title}</span><button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-seconds="${totalSeconds}" title="Añadir/Quitar Favorito">${isFavorited ? '★' : '☆'}</button>`;
            currentTracklistElement.appendChild(li);
        });
        console.log(`Tracklist mostrado con ${tracklistData.length} items.`); // LOG
    }

    // --- Eventos de WaveSurfer ---
    wavesurfer.on('ready', () => { /* ... (sin cambios) ... */
        const duration = wavesurfer.getDuration(); totalDurationEl.textContent = formatTime(duration); currentTimeEl.textContent = formatTime(0);
        playPauseBtn.disabled = false; playPauseBtn.textContent = '▶️'; currentTrackTitle.textContent = allSets[currentSetIndex]?.title || "Set Listo";
        console.log("WaveSurfer listo:", allSets[currentSetIndex]?.title);
    });
    wavesurfer.on('loading', (percent) => { /* ... (sin cambios) ... */
        console.log(`Cargando: ${percent}%`); currentTrackTitle.textContent = `Cargando: ${allSets[currentSetIndex]?.title || 'Set'} (${percent}%)`;
     });
    wavesurfer.on('error', (err) => { /* ... (sin cambios) ... */
        console.error('Error WaveSurfer:', err); currentTrackTitle.textContent = `Error: ${err.message || err}`; playPauseBtn.textContent = '❌'; playPauseBtn.disabled = true;
     });
    wavesurfer.on('timeupdate', (currentTime) => { currentTimeEl.textContent = formatTime(currentTime); });
    wavesurfer.on('seeking', (currentTime) => { currentTimeEl.textContent = formatTime(currentTime); console.log(`Seeking a: ${formatTime(currentTime)}`); });
    wavesurfer.on('play', () => { playPauseBtn.textContent = '⏸️'; updatePlayingHighlight(); console.log("Evento: Play"); });
    wavesurfer.on('pause', () => { playPauseBtn.textContent = '▶️'; updatePlayingHighlight(); console.log("Evento: Pause"); });
    wavesurfer.on('finish', () => { /* ... (sin cambios) ... */
        console.log("Evento: Finish"); playPauseBtn.textContent = '▶️'; const nextIndex = (currentSetIndex + 1) % allSets.length;
        if (allSets.length > 0) { loadTrack(allSets[nextIndex], nextIndex); wavesurfer.once('ready', () => { console.log("Siguiente listo, play..."); wavesurfer.play(); }); }
    });

    // --- Función SeekWaveform ---
    const seekWaveform = (clientX, rect, eventType) => {
        console.log(`[Drag V6] seekWaveform llamado desde: ${eventType}`);
        if (!wavesurfer) { console.warn("[Drag V6] Seek abortado: WS null."); return false; }
        const x = Math.max(0, clientX - rect.left); const width = rect.width;
        if (width === 0) { console.warn("[Drag V6] Seek abortado: width 0."); return false; }
        const progress = Math.max(0, Math.min(1, x / width));
        try {
            if (wavesurfer.isReady) { // Check de seguridad
                wavesurfer.seekTo(progress);
                const duration = wavesurfer.getDuration();
                if (duration > 0 && currentTimeEl) { currentTimeEl.textContent = formatTime(progress * duration); }
                console.log(`[Drag V6] Seek executed: progress=${progress.toFixed(4)}`); return true;
            } else { console.warn("[Drag V6] Seek abortado DENTRO: WS no listo."); return false; }
        } catch (error) { console.error(`[Drag V6] Error seekTo(${progress.toFixed(4)}):`, error); return false; }
    };


    // --- NUEVO v6: Lógica Drag-to-Seek (Móvil Corregido) ---
    const waveformInteractionElement = document.getElementById('waveform');

    if (waveformInteractionElement && wavesurfer) {
        console.log("[Drag V6] Añadiendo listeners TÁCTILES v6."); // LOG

        // let isDraggingWaveformTouch = false; // Ya definida arriba
        // let longTouchTimer = null; // Ya definida arriba
        // const LONG_TOUCH_THRESHOLD = 200; // Ya definida arriba

        // --- Handlers Táctiles ---
        const handleWaveformTouchMove = (event) => {
            console.log("[Drag V6] handleWaveformTouchMove INICIO."); // LOG
            if (!isDraggingWaveformTouch) { console.log("[Drag V6] Touch Move ignorado: Bandera false."); return; }

            event.preventDefault(); // Prevenir scroll

            if (event.touches && event.touches.length > 0) {
                const wavesurferElement = wavesurfer.getWrapper();
                const rect = wavesurferElement.getBoundingClientRect();
                seekWaveform(event.touches[0].clientX, rect, "touchmove");
            } else { console.warn("[Drag V6] Touch Move: No touches."); }
            console.log("[Drag V6] handleWaveformTouchMove FIN."); // LOG
        };

        const handleWaveformTouchEnd = (event) => {
             console.log(`[Drag V6] handleWaveformTouchEnd INICIO. isDragging: ${isDraggingWaveformTouch}. Tipo: ${event.type}`); // LOG
            if (!isDraggingWaveformTouch) { console.log("[Drag V6] Touch End ignorado: Bandera false."); return; }

            isDraggingWaveformTouch = false; // Resetear bandera
            console.log(`[Drag V6] Bandera isDragging reseteada a false.`); // LOG

            clearTimeout(longTouchTimer); // Limpiar timer por si acaso

            // Limpiar listeners globales
            console.log("[Drag V6] Removiendo listeners de window: touchmove, touchend, touchcancel"); // LOG
            window.removeEventListener('touchmove', handleWaveformTouchMove);
            window.removeEventListener('touchend', handleWaveformTouchEnd);
            window.removeEventListener('touchcancel', handleWaveformTouchEnd);

            console.log(`[Drag V6] handleWaveformTouchEnd FIN.`); // LOG
        };

        // Listener para INICIO TÁCTIL (touchstart)
        waveformInteractionElement.addEventListener('touchstart', (event) => {
            console.log(`[Drag V6] handleWaveformTouchStart INICIO. isDragging: ${isDraggingWaveformTouch}`); // LOG

            if (event.target.closest('button') || isDraggingWaveformTouch) {
                 console.warn("[Drag V6] Touch Start ignorado: Botón o ya en proceso.");
                 console.log(`[Drag V6] handleWaveformTouchStart FIN (ignorado).`); return;
            }
             // No necesitamos check isReady aquí, lo hacemos antes de llamar a seekTo

            // **PREVENIR COMPORTAMIENTO DEFAULT (MENÚ CONTEXTUAL)**
            event.preventDefault();
            console.log("[Drag V6] event.preventDefault() llamado en touchstart."); // LOG

            clearTimeout(longTouchTimer); // Limpiar timer anterior

            let touchStartTime = wavesurfer?.getMediaElement()?.currentTime || 0;
            const formattedTouchStartTime = formatTime(touchStartTime);
            console.log(`[Drag V6] Tiempo inicio toque: ${formattedTouchStartTime}`); // LOG

            // Iniciar temporizador para detectar toque largo
            longTouchTimer = setTimeout(() => {
                console.warn(`[Drag V6] ¡TOQUE LARGO DETECTADO! (>${LONG_TOUCH_THRESHOLD}ms) en ${formattedTouchStartTime}`); // LOG LARGO
                isDraggingWaveformTouch = true; // Activar bandera de arrastre
                console.log("[Drag V6] Bandera isDragging establecida a TRUE. Añadiendo listeners move/end."); // LOG

                // **AÑADIR LISTENERS DE MOVIMIENTO/FIN SOLO DESPUÉS DEL TOQUE LARGO**
                window.addEventListener('touchmove', handleWaveformTouchMove, { passive: false });
                window.addEventListener('touchend', handleWaveformTouchEnd);
                window.addEventListener('touchcancel', handleWaveformTouchEnd);

                // Buscar posición inicial AHORA que es un toque largo
                if (event.touches && event.touches.length > 0) {
                     const wavesurferElement = wavesurfer.getWrapper();
                     const rect = wavesurferElement.getBoundingClientRect();
                     seekWaveform(event.touches[0].clientX, rect, "touchstart-long");
                 }

            }, LONG_TOUCH_THRESHOLD);

            console.log(`[Drag V6] handleWaveformTouchStart FIN (Timer iniciado).`); // LOG FIN
        }, { passive: false }); // **IMPORTANTE: passive: false para poder usar preventDefault()**

        // Listener para CLIC SIMPLE en PC (Sin cambios)
        waveformInteractionElement.addEventListener('click', (event) => {
            if (!isDraggingWaveformTouch && wavesurfer && wavesurfer.isReady && !event.target.closest('button')) {
                console.log("[Drag V6] Clic simple (Mouse) detectado."); // LOG Click
                const wavesurferElement = wavesurfer.getWrapper();
                const rect = wavesurferElement.getBoundingClientRect();
                seekWaveform(event.clientX, rect, "click");
            } else if (isDraggingWaveformTouch) {
                console.log("[Drag V6] Clic ignorado (fin de arrastre táctil?)."); // LOG Ignorado
            }
        });

    } else {
         console.error("[Drag V6] No se pudo añadir lógica de interacción: #waveform o wavesurfer no encontrados."); // LOG ERROR
    }
    // --- FIN NUEVO BLOQUE v6 ---


    // --- Manejar clics en el tracklist actual ---
    currentTracklistElement.addEventListener('click', (e) => { /* ... (sin cambios desde la versión anterior) ... */
        const target = e.target;
        if (target.classList.contains('favorite-btn')) {
            const seconds = parseInt(target.dataset.seconds, 10); if (isNaN(seconds)) return;
            toggleFavorite(seconds, target); console.log(`Clic fav t=${seconds}s.`);
        } else {
            const listItem = target.closest('.current-tracklist-item'); if (!listItem || !listItem.dataset.time) return;
            const timeString = listItem.dataset.time; const timeParts = timeString.split(':'); let timeInSeconds = 0;
            if (timeParts.length === 2 && !isNaN(parseInt(timeParts[0], 10)) && !isNaN(parseInt(timeParts[1], 10))) { timeInSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10); } else { console.warn(`Timestamp inválido: ${timeString}`); return; }
            console.log(`Clic tracklist: ${timeString} (${timeInSeconds}s).`);
            try {
                if (wavesurfer?.isReady) { // Usamos optional chaining y check isReady
                    const duration = wavesurfer.getDuration();
                    if (duration > 0) { const progress = Math.max(0, Math.min(1, timeInSeconds / duration)); wavesurfer.seekTo(progress); console.log(`Seek tracklist ${progress.toFixed(4)}`); } else { console.warn("Duración 0 (tracklist)."); }
                    if (!wavesurfer.isPlaying()) { wavesurfer.play(); }
                } else { console.warn("Clic tracklist ignorado: WS no listo."); }
            } catch (error) { console.error("Error seek tracklist:", error); }
        }
     });

    // --- Añadir/Quitar Favorito ---
    function toggleFavorite(seconds, buttonElement) { /* ... (sin cambios) ... */
        if (favorites.has(seconds)) { favorites.delete(seconds); buttonElement.classList.remove('favorited'); buttonElement.innerHTML = '☆'; console.log(`Fav eliminado: ${seconds}s`); }
        else { favorites.add(seconds); buttonElement.classList.add('favorited'); buttonElement.innerHTML = '★'; console.log(`Fav añadido: ${seconds}s`); }
        try { localStorage.setItem('vloitz_favorites', JSON.stringify(Array.from(favorites))); console.log("Favs guardados."); } catch (error) { console.error("Error guardando favs:", error); }
     }

    // --- Clic en lista general de sets ---
    tracklistElement.addEventListener('click', e => { /* ... (sin cambios) ... */
        const clickedItem = e.target.closest('.track-item'); if (!clickedItem) return;
        const trackIndex = parseInt(clickedItem.dataset.index); console.log(`Clic lista general: ${trackIndex}`);
        if (trackIndex !== currentSetIndex && allSets[trackIndex]) { loadTrack(allSets[trackIndex], trackIndex); wavesurfer.once('ready', () => { console.log("Track lista general play..."); wavesurfer.play(); }); }
        else if (trackIndex === currentSetIndex && wavesurfer?.isReady) { console.log("Clic track actual playPause..."); wavesurfer.playPause(); }
    });

    // --- Botón Play/Pause Principal ---
    playPauseBtn.addEventListener('click', () => { /* ... (sin cambios) ... */
        console.log("Clic Play/Pause principal");
        if (wavesurfer?.isReady) { wavesurfer.playPause(); } else { console.warn("Play/Pause ignorado: WS no listo."); }
    });

    console.log("App inicializada y listeners configurados."); // LOG FINAL INIT
});
