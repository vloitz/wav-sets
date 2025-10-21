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
    let isDraggingWaveformTouch = false; // Bandera activada por toque largo
    let longTouchTimer = null; // Temporizador
    const LONG_TOUCH_THRESHOLD = 200; // Umbral ms

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
         currentTrackTitle.textContent = "Error al iniciar reproductor";
         playPauseBtn.textContent = '❌'; return;
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
            if (allSets.length > 0) { loadTrack(allSets[0], 0); } else { currentTrackTitle.textContent = "No hay sets."; console.warn("No se encontraron sets."); }
        })
        .catch(error => { console.error('Error FATAL al cargar sets.json:', error); currentTrackTitle.textContent = "Error al cargar datos."; });

    // --- Poblar la lista general ---
    function populateTracklist(sets) { /* ... (sin cambios) ... */
        console.log("Poblando tracklist general..."); // LOG
        tracklistElement.innerHTML = '';
        sets.forEach((set, index) => {
            const li = document.createElement('li'); li.className = 'track-item'; li.dataset.index = index;
            li.innerHTML = `<img src="${set.cover_art_url}" alt="${set.title} cover" class="track-item-cover"><span class="track-item-title">${set.title}</span><span class="track-item-date">${set.date}</span>`;
            tracklistElement.appendChild(li);
        });
        console.log(`Tracklist general poblado con ${sets.length} items.`); // LOG
     }

    // --- Cargar un set ---
    function loadTrack(set, index) { /* ... (lógica fetch picos sin cambios) ... */
        console.log(`Cargando track ${index}: ${set.title}`); // LOG
        currentCoverArt.src = set.cover_art_url; currentTrackTitle.textContent = `Cargando: ${set.title}...`; currentSetIndex = index;
        totalDurationEl.textContent = '0:00'; currentTimeEl.textContent = '0:00'; playPauseBtn.disabled = true; playPauseBtn.textContent = '🔄';
        console.log(`WaveSurfer intentará cargar: ${set.audio_url}`); // LOG
        if (set.peaks_url) {
            console.log(`Intentando cargar picos desde: ${set.peaks_url}`); // LOG
            fetch(set.peaks_url).then(response => { if (!response.ok) { throw new Error(`HTTP picos! ${response.status}`); } return response.json(); })
            .then(peaksData => { const peaksArray = peaksData.data; if (peaksArray && Array.isArray(peaksArray)) { console.log(`Picos cargados (${peaksArray.length}). Cargando audio+picos...`); wavesurfer.load(set.audio_url, peaksArray); } else { console.warn("JSON picos inválido."); wavesurfer.load(set.audio_url); } })
            .catch(error => { console.error('Error picos:', error); console.warn("Fallback: solo audio."); wavesurfer.load(set.audio_url); });
        } else { console.log("Sin peaks_url."); wavesurfer.load(set.audio_url); }
        currentLoadedSet = set; displayTracklist(set.tracklist || []); updatePlayingHighlight();
     }

    // --- Resaltar activo ---
    function updatePlayingHighlight() { /* ... (sin cambios) ... */
        tracklistElement.querySelectorAll('.track-item').forEach(item => item.classList.remove('playing'));
        const activeItem = tracklistElement.querySelector(`.track-item[data-index="${currentSetIndex}"]`);
        if (activeItem && wavesurfer && wavesurfer.isPlaying()) { activeItem.classList.add('playing'); }
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
        if (!tracklistData || tracklistData.length === 0) { currentTracklistElement.innerHTML = '<li>No hay tracklist.</li>'; console.warn("Sin tracklist."); return; }
        tracklistData.forEach((track, index) => {
            const li = document.createElement('li'); li.className = 'current-tracklist-item'; li.dataset.time = track.time; li.dataset.index = index;
            let totalSeconds = 0; const timeParts = track.time.split(':'); if (timeParts.length === 2 && !isNaN(parseInt(timeParts[0], 10)) && !isNaN(parseInt(timeParts[1], 10))) { totalSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10); } else { console.warn(`Timestamp inválido: ${track.time}`); }
            const isFavorited = favorites.has(totalSeconds);
            li.innerHTML = `<span class="track-time">${track.time}</span><span class="track-emoji">${track.emoji || ''}</span><span class="track-title">${track.title}</span><button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-seconds="${totalSeconds}" title="Favorito">${isFavorited ? '★' : '☆'}</button>`;
            currentTracklistElement.appendChild(li);
        });
        console.log(`Tracklist del set mostrado (${tracklistData.length}).`); // LOG
     }

    // --- Eventos de WaveSurfer ---
    wavesurfer.on('ready', () => { /* ... (sin cambios) ... */
        const duration = wavesurfer.getDuration(); totalDurationEl.textContent = formatTime(duration); currentTimeEl.textContent = formatTime(0); playPauseBtn.disabled = false; playPauseBtn.textContent = '▶️'; currentTrackTitle.textContent = allSets[currentSetIndex]?.title || "Set Listo"; console.log("WS listo:", allSets[currentSetIndex]?.title);
     });
    wavesurfer.on('loading', (percent) => { /* ... (sin cambios) ... */
        console.log(`WS cargando: ${percent}%`); currentTrackTitle.textContent = `Cargando: ${allSets[currentSetIndex]?.title || 'Set'} (${percent}%)`;
     });
    wavesurfer.on('error', (err) => { /* ... (sin cambios) ... */
        console.error('WS error:', err); currentTrackTitle.textContent = `Error: ${err.message || err}`; playPauseBtn.textContent = '❌'; playPauseBtn.disabled = true;
     });
    wavesurfer.on('timeupdate', (currentTime) => { currentTimeEl.textContent = formatTime(currentTime); });
    wavesurfer.on('seeking', (currentTime) => { currentTimeEl.textContent = formatTime(currentTime); console.log(`Seeking a: ${formatTime(currentTime)}`); });
    wavesurfer.on('play', () => { playPauseBtn.textContent = '⏸️'; updatePlayingHighlight(); console.log("Evento: Play"); });
    wavesurfer.on('pause', () => { playPauseBtn.textContent = '▶️'; updatePlayingHighlight(); console.log("Evento: Pause"); });
    wavesurfer.on('finish', () => { /* ... (sin cambios) ... */
        console.log("Evento: Finish"); playPauseBtn.textContent = '▶️'; const nextIndex = (currentSetIndex + 1) % allSets.length; console.log(`Cargando next: ${nextIndex}`); if (allSets.length > 0) { loadTrack(allSets[nextIndex], nextIndex); wavesurfer.once('ready', () => { console.log("Next listo, play..."); wavesurfer.play(); }); }
     });

    // --- Función SeekWaveform ---
    const seekWaveform = (clientX, rect, eventType) => {
        console.log(`[Drag v6] seekWaveform desde: ${eventType}`);
        if (!wavesurfer || !wavesurfer.isReady) { console.warn("[Drag v6] Seek ignorado: WS no listo."); return false; } // Re-activamos check isReady
        const x = Math.max(0, clientX - rect.left); const width = rect.width; if (width === 0) { console.warn("[Drag v6] Seek abortado: Ancho 0."); return false; }
        const progress = Math.max(0, Math.min(1, x / width));
        try { wavesurfer.seekTo(progress); console.log(`[Drag v6] Seek executed: ${progress.toFixed(4)}`); return true; }
        catch (error) { console.error(`[Drag v6] Error seekTo(${progress.toFixed(4)}):`, error); return false; }
    };

    // --- NUEVO v6: Lógica Drag-to-Seek (Móvil con toque largo) ---
    const waveformInteractionElement = document.getElementById('waveform');

    if (waveformInteractionElement && wavesurfer) {
        console.log("[Drag v6] Añadiendo listeners TÁCTILES v6.");

        // Función para manejar el MOVIMIENTO táctil (se añade/quita dinámicamente)
        const handleWaveformTouchMove = (event) => {
            console.log("[Drag v6] Touch Move event."); // LOG Move
            if (!isDraggingWaveformTouch) return; // Seguridad extra
            event.preventDefault(); // Prevenir scroll
            if (event.touches && event.touches.length > 0) {
                const rect = wavesurfer.getWrapper().getBoundingClientRect();
                seekWaveform(event.touches[0].clientX, rect, "touchmove");
            }
        };

        // Función para manejar el FIN del toque (se añade/quita dinámicamente)
        const handleWaveformTouchEnd = (event) => {
             console.log(`[Drag v6] Touch End/Cancel event. Type: ${event.type}`); // LOG End
             clearTimeout(longTouchTimer); // Limpiar timer por si acaso
             if (isDraggingWaveformTouch) {
                 isDraggingWaveformTouch = false; // Resetear bandera
                 console.log("[Drag v6] Bandera isDragging reseteada a false.");
                 // Quitar listeners globales AHORA que terminó el arrastre
                 window.removeEventListener('touchmove', handleWaveformTouchMove);
                 window.removeEventListener('touchend', handleWaveformTouchEnd);
                 window.removeEventListener('touchcancel', handleWaveformTouchEnd);
                 console.log("[Drag v6] Listeners globales de window removidos.");
             }
        };

        // Listener para INICIO TÁCTIL (touchstart)
        waveformInteractionElement.addEventListener('touchstart', (event) => {
            console.log("[Drag v6] Evento: touchstart INICIO.");
            if (event.target.closest('button')) { console.warn("[Drag v6] Ignorado: Botón."); return; }
            if (!wavesurfer || !wavesurfer.isReady) { console.warn(`[Drag v6] Ignorado: WS no listo.`); return; } // Usamos check isReady aquí

            // Prevenir menú contextual y otros defaults AHORA que sabemos que es en la onda
            // y que el listener NO es pasivo.
            event.preventDefault();
            console.log("[Drag v6] preventDefault() llamado en touchstart.");

            // Calcular y buscar posición inicial (Tap/Inicio de Drag)
             let initialSeekDone = false;
             if (event.touches && event.touches.length > 0) {
                 const rect = wavesurfer.getWrapper().getBoundingClientRect();
                 initialSeekDone = seekWaveform(event.touches[0].clientX, rect, "touchstart");
             }
             // Si el seek inicial falló (ej. WS no listo a pesar del check), no continuar
             if(!initialSeekDone) {
                  console.warn("[Drag v6] Seek inicial falló, no se inicia toque largo/drag.");
                  return;
             }


            // --- Lógica Toque Largo ---
            clearTimeout(longTouchTimer); // Limpiar anterior
            const touchStartTime = wavesurfer.getCurrentTime(); // Usar tiempo después del seek inicial
            const formattedTouchStartTime = formatTime(touchStartTime);
            console.log(`[Drag v6] Tiempo audio inicio toque: ${formattedTouchStartTime}`);

            longTouchTimer = setTimeout(() => {
                console.warn(`[Drag v6] ¡TOQUE LARGO DETECTADO! en ${formattedTouchStartTime}`);
                isDraggingWaveformTouch = true; // Activar bandera de arrastre
                console.log("[Drag v6] Bandera isDragging = TRUE. Añadiendo listeners globales...");
                // Añadir listeners globales SOLO AHORA que es un toque largo
                window.addEventListener('touchmove', handleWaveformTouchMove, { passive: false });
                window.addEventListener('touchend', handleWaveformTouchEnd);
                window.addEventListener('touchcancel', handleWaveformTouchEnd);
            }, LONG_TOUCH_THRESHOLD);
            // --- Fin Toque Largo ---

            console.log("[Drag v6] touchstart FIN.");
        }, { passive: false }); // <-- IMPORTANTE: NO PASIVO para permitir preventDefault

        // Listener CLIC PC (sin cambios)
        waveformInteractionElement.addEventListener('click', (event) => {
            if (!isDraggingWaveformTouch && wavesurfer && wavesurfer.isReady && !event.target.closest('button')) {
                console.log("[Drag v6] Clic simple (Mouse).");
                const rect = wavesurfer.getWrapper().getBoundingClientRect();
                seekWaveform(event.clientX, rect, "click");
            } else { console.log(`[Drag v6] Clic ignorado. isDragging: ${isDraggingWaveformTouch}`); }
        });

    } else { console.error("[Drag v6] No se pudo añadir lógica interacción."); }
    // --- FIN NUEVO BLOQUE v6 ---


    // --- Manejar clics en el tracklist actual ---
    currentTracklistElement.addEventListener('click', (e) => { /* ... (sin cambios, usa seekTo) ... */
        const target = e.target; if (target.classList.contains('favorite-btn')) { const s = parseInt(target.dataset.seconds, 10); if (!isNaN(s)) toggleFavorite(s, target); } else { const li = target.closest('.current-tracklist-item'); if (!li || !li.dataset.time) return; const t = li.dataset.time.split(':'); let s = 0; if (t.length === 2 && !isNaN(parseInt(t[0], 10)) && !isNaN(parseInt(t[1], 10))) { s = parseInt(t[0], 10) * 60 + parseInt(t[1], 10); } else { console.warn(`Inválido en clic: ${li.dataset.time}`); return; } console.log(`Clic tracklist: ${li.dataset.time} (${s}s)...`); try { if (wavesurfer && wavesurfer.isReady) { const d = wavesurfer.getDuration(); if (d > 0) { const p = Math.max(0, Math.min(1, s / d)); wavesurfer.seekTo(p); console.log(`Seek tracklist: ${p.toFixed(4)}`); } else { console.warn("Duración 0."); } if (!wavesurfer.isPlaying()) { wavesurfer.play(); } } else { console.warn("Clic tracklist ignorado: WS no listo."); } } catch (err) { console.error("Error seek tracklist:", err); } }
     });

    // --- Añadir/Quitar Favorito ---
    function toggleFavorite(seconds, buttonElement) { /* ... (sin cambios) ... */
        if (favorites.has(seconds)) { favorites.delete(seconds); buttonElement.classList.remove('favorited'); buttonElement.innerHTML = '☆'; console.log(`Fav quitado: ${seconds}s`); } else { favorites.add(seconds); buttonElement.classList.add('favorited'); buttonElement.innerHTML = '★'; console.log(`Fav añadido: ${seconds}s`); } try { localStorage.setItem('vloitz_favorites', JSON.stringify(Array.from(favorites))); console.log("Favs guardados."); } catch (err) { console.error("Error guardando favs:", err); }
     }

    // --- Clic en lista general de sets ---
    tracklistElement.addEventListener('click', e => { /* ... (sin cambios) ... */
        const clickedItem = e.target.closest('.track-item'); if (!clickedItem) return; const trackIndex = parseInt(clickedItem.dataset.index); console.log(`Clic lista general: ${trackIndex}`); if (trackIndex !== currentSetIndex && allSets[trackIndex]) { loadTrack(allSets[trackIndex], trackIndex); wavesurfer.once('ready', () => { console.log("Track lista general listo, play..."); wavesurfer.play(); }); } else if (trackIndex === currentSetIndex) { console.log("Clic track actual, playPause..."); wavesurfer.playPause(); }
     });

    // --- Botón Play/Pause Principal ---
    playPauseBtn.addEventListener('click', () => { /* ... (sin cambios) ... */
        console.log("Clic Play/Pause principal"); if (wavesurfer && typeof wavesurfer.playPause === 'function') { if (wavesurfer.isReady) { wavesurfer.playPause(); } else { console.warn("Play/Pause pero WS no listo."); } } else { console.warn("Play/Pause pero WS no ok."); }
     });

    console.log("Aplicación inicializada y listeners configurados."); // LOG FINAL INIT
});
