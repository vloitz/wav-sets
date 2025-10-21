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
    let isDraggingWaveformTouch = false; // Bandera específica para arrastre táctil (activada por toque largo)
    let longTouchTimer = null; // Variable para el temporizador de toque largo
    const LONG_TOUCH_THRESHOLD = 200; // Umbral en milisegundos

    console.log("Variables globales inicializadas. Favoritos cargados:", favorites); // LOG

    // --- Inicializar WaveSurfer ---
    try {
        console.log("Inicializando WaveSurfer..."); // LOG
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            // --- VALORES FINALES BASADOS EN image_b05879.png ---
            waveColor: "#cccccc",       // Color base (gris claro)
            progressColor: "#ff7f00",   // Color de progreso (naranja)
            cursorColor: "#ffffff",     // Color del cursor (blanco)
            height: 100,                // Altura
            cursorWidth: 1,             // Ancho cursor
            barWidth: 1,                // Ancho barra
            barGap: 0,                  // Espacio barra
            barHeight: 0.9,             // Altura relativa barra
            barRadius: 10,              // Radio barra
            // --- FIN VALORES FINALES ---
            responsive: true,
            backend: 'MediaElement',
            media: document.getElementById('audio-player') // Conectarlo al <audio>
        });
        console.log("WaveSurfer inicializado correctamente."); // LOG
        // Hacer accesible globalmente para depuración desde la consola
        window.wavesurfer = wavesurfer;
        console.log("Instancia de WaveSurfer asignada a window.wavesurfer para depuración."); // LOG
    } catch (error) {
         console.error("Error CRÍTICO al inicializar WaveSurfer:", error); // LOG ERROR
         currentTrackTitle.textContent = "Error al iniciar reproductor";
         playPauseBtn.textContent = '❌';
         return; // Detener si WaveSurfer no se puede crear
    }

    // --- Cargar sets.json ---
    console.log("Cargando sets.json..."); // LOG
    fetch('sets.json')
        .then(response => {
            if (!response.ok) { // LOG ERROR RED
                throw new Error(`Error HTTP! status: ${response.status}`);
            }
            return response.json();
         })
        .then(data => {
            console.log("sets.json cargado:", data); // LOG ÉXITO
            // Cargar perfil
            if (data.profile) {
                profilePicImg.src = data.profile.profile_pic_url;
                profileBanner.style.backgroundImage = `url('${data.profile.banner_url}')`;
                console.log("Perfil cargado."); // LOG
            }
            // Cargar sets
            allSets = data.sets;
            allSets.sort((a, b) => new Date(b.date) - new Date(a.date)); // Ordenar
            populateTracklist(allSets);
            if (allSets.length > 0) {
                loadTrack(allSets[0], 0);
            } else {
                currentTrackTitle.textContent = "No hay sets para mostrar.";
                console.warn("No se encontraron sets en sets.json"); // LOG ADVERTENCIA
            }
        })
        .catch(error => {
            console.error('Error FATAL al cargar o parsear sets.json:', error); // LOG ERROR
            currentTrackTitle.textContent = "Error al cargar datos de sets.";
        });

    // --- Poblar la lista ---
    function populateTracklist(sets) {
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
    function loadTrack(set, index) {
        console.log(`Cargando track ${index}: ${set.title}`); // LOG
        currentCoverArt.src = set.cover_art_url;
        currentTrackTitle.textContent = `Cargando: ${set.title}...`;
        currentSetIndex = index;

        // Resetear UI del reproductor
        totalDurationEl.textContent = '0:00';
        currentTimeEl.textContent = '0:00';
        playPauseBtn.disabled = true;
        playPauseBtn.textContent = '🔄';

        console.log(`WaveSurfer intentará cargar: ${set.audio_url}`); // LOG

        // Lógica para cargar picos
        if (set.peaks_url) {
            console.log(`Intentando cargar picos desde: ${set.peaks_url}`); // LOG
            fetch(set.peaks_url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error HTTP al cargar picos! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(peaksData => {
                    const peaksArray = peaksData.data;
                    if (peaksArray && Array.isArray(peaksArray)) {
                        console.log(`Picos cargados (${peaksArray.length} puntos). Cargando audio con picos...`); // LOG
                        wavesurfer.load(set.audio_url, peaksArray);
                    } else {
                        console.warn("El JSON de picos no tiene un array 'data' válido. Cargando solo audio..."); // LOG ADVERTENCIA
                        wavesurfer.load(set.audio_url);
                    }
                })
                .catch(error => {
                    console.error('Error al cargar o parsear el JSON de picos:', error); // LOG ERROR
                    console.warn("Fallback: Cargando solo audio debido a error con picos..."); // LOG ADVERTENCIA
                    wavesurfer.load(set.audio_url);
                });
        } else {
            console.log("No se encontró peaks_url. Cargando solo audio..."); // LOG
            wavesurfer.load(set.audio_url);
        }

        currentLoadedSet = set;
        displayTracklist(set.tracklist || []);
        updatePlayingHighlight();
    }

    // --- Resaltar activo ---
    function updatePlayingHighlight() {
        tracklistElement.querySelectorAll('.track-item').forEach(item => {
            item.classList.remove('playing');
        });
        const activeItem = tracklistElement.querySelector(`.track-item[data-index="${currentSetIndex}"]`);
        if (activeItem && wavesurfer && wavesurfer.isPlaying()) {
            activeItem.classList.add('playing');
            console.log(`Resaltando track ${currentSetIndex} como activo.`); // LOG
        }
    }

    // Formatear tiempo
    function formatTime(seconds) {
        seconds = Number(seconds);
        if (isNaN(seconds) || seconds < 0) {
            seconds = 0;
        }
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // --- Mostrar el tracklist del set actual ---
    function displayTracklist(tracklistData) {
        console.log("Mostrando tracklist para el set actual..."); // LOG
        currentTracklistElement.innerHTML = ''; // Limpiar lista anterior

        if (!tracklistData || tracklistData.length === 0) {
            currentTracklistElement.innerHTML = '<li>No hay tracklist disponible para este set.</li>';
            console.warn("No se encontró tracklist en los datos del set."); // LOG ADVERTENCIA
            return;
        }

        tracklistData.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = 'current-tracklist-item';
            li.dataset.time = track.time;
            li.dataset.index = index;

            const timeParts = track.time.split(':');
            let totalSeconds = 0;
            if (timeParts.length === 2 && !isNaN(parseInt(timeParts[0], 10)) && !isNaN(parseInt(timeParts[1], 10))) {
                 totalSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
            } else {
                 console.warn(`Timestamp inválido en tracklist: ${track.time}`); // LOG ADVERTENCIA
            }

            const isFavorited = favorites.has(totalSeconds);

            li.innerHTML = `
                <span class="track-time">${track.time}</span>
                <span class="track-emoji">${track.emoji || ''}</span>
                <span class="track-title">${track.title}</span>
                <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-seconds="${totalSeconds}" title="Añadir/Quitar Favorito">
                    ${isFavorited ? '★' : '☆'}
                </button>
            `;
            currentTracklistElement.appendChild(li);
        });
        console.log(`Tracklist mostrado con ${tracklistData.length} items.`); // LOG
    }

    // --- Eventos de WaveSurfer ---
    wavesurfer.on('ready', () => {
        const duration = wavesurfer.getDuration();
        totalDurationEl.textContent = formatTime(duration);
        currentTimeEl.textContent = formatTime(0);
        playPauseBtn.disabled = false;
        playPauseBtn.textContent = '▶️';
        currentTrackTitle.textContent = allSets[currentSetIndex]?.title || "Set Listo";
        console.log("WaveSurfer listo para track:", allSets[currentSetIndex]?.title); // LOG ÉXITO
    });

     wavesurfer.on('loading', (percent) => {
         console.log(`WaveSurfer cargando: ${percent}%`); // LOG PROGRESO
         currentTrackTitle.textContent = `Cargando: ${allSets[currentSetIndex]?.title || 'Set'} (${percent}%)`;
    });

    wavesurfer.on('error', (err) => {
        console.error('Error de WaveSurfer al cargar audio:', err); // LOG ERROR
        currentTrackTitle.textContent = `Error: ${err.message || err}`;
        playPauseBtn.textContent = '❌';
        playPauseBtn.disabled = true;
    });

    wavesurfer.on('timeupdate', (currentTime) => {
        currentTimeEl.textContent = formatTime(currentTime);
    });

    wavesurfer.on('seeking', (currentTime) => {
         currentTimeEl.textContent = formatTime(currentTime);
         console.log(`Seeking a: ${formatTime(currentTime)}`); // LOG
    });

    wavesurfer.on('play', () => {
        playPauseBtn.textContent = '⏸️';
        updatePlayingHighlight();
        console.log("Evento: Play"); // LOG
    });
    wavesurfer.on('pause', () => {
        playPauseBtn.textContent = '▶️';
        updatePlayingHighlight(); // Quitar resaltado
        console.log("Evento: Pause"); // LOG
    });

    wavesurfer.on('finish', () => {
        console.log("Evento: Finish (track terminado)"); // LOG
        playPauseBtn.textContent = '▶️';
        const nextIndex = (currentSetIndex + 1) % allSets.length;
        console.log(`Cargando siguiente track: ${nextIndex}`); // LOG
        if (allSets.length > 0) {
            loadTrack(allSets[nextIndex], nextIndex);
            wavesurfer.once('ready', () => {
                console.log("Siguiente track listo, reproduciendo..."); // LOG
                wavesurfer.play();
            });
        }
    });

    // --- Función SeekWaveform (Necesaria para los listeners de abajo) ---
    const seekWaveform = (clientX, rect, eventType) => {
        console.log(`[Drag V5] seekWaveform llamado desde: ${eventType}`);
        // Quitamos check isReady temporalmente basado en logs anteriores
        if (!wavesurfer /*|| !wavesurfer.isReady*/) {
             console.warn("[Drag V5] SeekWaveform ignorado: WS no inicializado.");
             return false;
        }
        const x = Math.max(0, clientX - rect.left);
        const width = rect.width;
         if (width === 0) {
             console.warn("[Drag V5] SeekWaveform abortado: Ancho del waveform es 0.");
             return false;
         }
        const progress = Math.max(0, Math.min(1, x / width));
        try {
             // Solo buscar si wavesurfer está listo (protección adicional)
             if(wavesurfer.isReady) {
                 wavesurfer.seekTo(progress);
                 const duration = wavesurfer.getDuration();
                 if (duration > 0 && currentTimeEl) {
                      currentTimeEl.textContent = formatTime(progress * duration);
                 }
                 console.log(`[Drag V5] Seek executed: progress=${progress.toFixed(4)}`);
                 return true;
             } else {
                  console.warn("[Drag V5] SeekWaveform abortado DENTRO de try: WS no listo.");
                  return false;
             }
        } catch (error) {
             console.error(`[Drag V5] Error en wavesurfer.seekTo(${progress.toFixed(4)}):`, error);
             return false;
        }
    };


    // --- NUEVO v5: Lógica Drag-to-Seek (Depuración Inicio Táctil) ---
    // const waveformInteractionElement = document.getElementById('waveform'); // Ya definido arriba

    if (waveformInteractionElement && wavesurfer) {
        console.log("[Drag V5] Añadiendo listeners TÁCTILES v5 (Solo Start/Click)."); // LOG

        // let isDraggingWaveformTouch = false; // Ya definida arriba
        // let longTouchTimer = null; // Ya definida arriba
        // const LONG_TOUCH_THRESHOLD = 200; // Ya definida arriba

        // Listener para INICIO TÁCTIL (touchstart)
        waveformInteractionElement.addEventListener('touchstart', (event) => {
            console.log("[Drag V5] Evento: touchstart INICIO."); // LOG INICIO
            console.log("[Drag V5] Evento touchstart object:", event); // LOG Evento
            console.log("[Drag V5] Estado de wavesurfer ANTES del check:", wavesurfer); // LOG Objeto WS

            // Comprobación MÍNIMA: solo si fue en un botón, ignorar.
            if (event.target.closest('button')) {
                 console.warn("[Drag V5] Touch Start ignorado: Clic en botón.");
                 console.log("[Drag V5] touchstart FIN (ignorado botón)."); // LOG FIN
                 return;
            }

            // *** TEMPORALMENTE QUITAMOS EL CHECK isReady para ver si el resto se ejecuta ***
            // if (!wavesurfer || !wavesurfer.isReady) {
            //      console.warn(`[Drag V5] Touch Start ignorado: WS no listo. wavesurfer: ${!!wavesurfer}, isReady: ${wavesurfer ? wavesurfer.isReady : 'N/A'}`);
            //      console.log(`[Drag V5] touchstart FIN (ignorado WS no listo).`);
            //      return;
            // }

            // Si pasa el check mínimo...
            console.log("[Drag V5] Touch Start ACEPTADO (Check isReady temporalmente quitado)."); // LOG Aceptado


            // --- INICIO: Lógica de Detección Toque Largo ---
            clearTimeout(longTouchTimer); // Limpiar timer anterior

            let touchStartTime = 0; // Guardar tiempo inicial
            if (wavesurfer && wavesurfer.isReady) {
                touchStartTime = wavesurfer.getCurrentTime();
            } else if (wavesurfer) {
                touchStartTime = wavesurfer.getMediaElement()?.currentTime || 0;
            }
             const formattedTouchStartTime = formatTime(touchStartTime);

            console.log(`[Drag V5] Tiempo de audio al inicio del toque: ${formattedTouchStartTime} (${touchStartTime.toFixed(3)}s)`); // LOG TIEMPO

            // Iniciar temporizador
            longTouchTimer = setTimeout(() => {
                console.warn(`[Drag V5] ¡TOQUE LARGO DETECTADO! (>${LONG_TOUCH_THRESHOLD}ms) en ${formattedTouchStartTime}`); // LOG LARGO
                isDraggingWaveformTouch = true; // Activar bandera de arrastre SOLO si es largo
                 console.log("[Drag V5] Bandera isDraggingWaveformTouch establecida a TRUE (por toque largo)."); // LOG
                 // Aquí podríamos añadir listeners para touchmove/touchend en window si quisiéramos arrastre continuo
            }, LONG_TOUCH_THRESHOLD);
            // --- FIN: Lógica de Detección Toque Largo ---

            console.log(`[Drag V5] touchstart FIN.`); // LOG FIN
        } /* Quitamos { passive: true } */);

        // Listener simple para CLIC de RATÓN (PC)
        waveformInteractionElement.addEventListener('click', (event) => {
            // Solo si NO estamos en modo arrastre táctil y WS está listo
            if (!isDraggingWaveformTouch && wavesurfer && wavesurfer.isReady && !event.target.closest('button')) {
                console.log("[Drag V5] Clic simple (Mouse) detectado."); // LOG Click
                const wavesurferElement = wavesurfer.getWrapper();
                const rect = wavesurferElement.getBoundingClientRect();
                seekWaveform(event.clientX, rect, "click");
            } else {
                 console.log(`[Drag V5] Clic de ratón ignorado. isDraggingWaveformTouch: ${isDraggingWaveformTouch}`); // LOG Ignorado
            }
        });

        // Listener para FIN de toque (SOLO para resetear bandera y cancelar timer)
         const handleWaveformTouchEndSimple = (event) => {
             clearTimeout(longTouchTimer); // Cancelar el timer si el dedo se levanta rápido
             console.log("[Drag V5] Temporizador de toque largo cancelado (si estaba activo)."); // LOG CANCEL

             // Resetear bandera SOLO si estaba activa (evita logs extra en taps)
             if (isDraggingWaveformTouch) {
                 isDraggingWaveformTouch = false;
                 console.log(`[Drag V5] Evento: ${event.type}. Bandera isDraggingWaveformTouch reseteada a false.`); // LOG
             }
         };
         waveformInteractionElement.addEventListener('touchend', handleWaveformTouchEndSimple);
         waveformInteractionElement.addEventListener('touchcancel', handleWaveformTouchEndSimple);

    } else {
         console.error("[Drag V5] No se pudo añadir lógica de interacción: #waveform o wavesurfer no encontrados."); // LOG ERROR
    }
    // --- FIN NUEVO BLOQUE v5 ---


    // --- Manejar clics en el tracklist actual ---
    currentTracklistElement.addEventListener('click', (e) => {
        const target = e.target;
        // Caso 1: Favorito
        if (target.classList.contains('favorite-btn')) {
            const seconds = parseInt(target.dataset.seconds, 10);
            if (isNaN(seconds)) return;
            toggleFavorite(seconds, target);
            console.log(`Clic en botón favorito para t=${seconds}s.`); // LOG
        }
        // Caso 2: Saltar tiempo
        else {
            const listItem = target.closest('.current-tracklist-item');
            if (!listItem || !listItem.dataset.time) return;
            const timeString = listItem.dataset.time;
            const timeParts = timeString.split(':');
            let timeInSeconds = 0;
            if (timeParts.length === 2 && !isNaN(parseInt(timeParts[0], 10)) && !isNaN(parseInt(timeParts[1], 10))) {
                 timeInSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
            } else {
                 console.warn(`Timestamp inválido al hacer clic: ${timeString}`);
                 return;
            }
            console.log(`Clic en tracklist item: ${timeString} (${timeInSeconds}s). Intentando buscar...`); // LOG
            try {
                if (wavesurfer && typeof wavesurfer.getDuration === 'function' && typeof wavesurfer.seekTo === 'function') {
                    // Re-añadimos check isReady aquí por seguridad para el tracklist
                    if (wavesurfer.isReady) {
                        const duration = wavesurfer.getDuration();
                        if (duration > 0) {
                            const progress = timeInSeconds / duration;
                            const clampedProgress = Math.max(0, Math.min(1, progress));
                            wavesurfer.seekTo(clampedProgress);
                            console.log(`Ejecutado wavesurfer.seekTo(${clampedProgress.toFixed(4)}) desde tracklist`); // LOG
                        } else { console.warn("Duración 0 desde tracklist."); }
                        if (!wavesurfer.isPlaying()) { wavesurfer.play(); }
                    } else { console.warn("Clic en tracklist ignorado: WS no listo."); }
                } else { console.error("wavesurfer no inicializado correctamente (tracklist)."); }
            } catch (error) { console.error("Error al buscar desde tracklist:", error); }
        }
    });

    // --- Añadir/Quitar Favorito ---
    function toggleFavorite(seconds, buttonElement) {
        if (favorites.has(seconds)) {
            favorites.delete(seconds);
            buttonElement.classList.remove('favorited');
            buttonElement.innerHTML = '☆';
            console.log(`Favorito eliminado: ${seconds}s`); // LOG
        } else {
            favorites.add(seconds);
            buttonElement.classList.add('favorited');
            buttonElement.innerHTML = '★';
            console.log(`Favorito añadido: ${seconds}s`); // LOG
        }
        try {
            localStorage.setItem('vloitz_favorites', JSON.stringify(Array.from(favorites)));
            console.log("Favoritos guardados en Local Storage."); // LOG
        } catch (error) {
            console.error("Error al guardar favoritos en Local Storage:", error); // LOG ERROR
        }
    }

    // --- Clic en lista general de sets ---
    tracklistElement.addEventListener('click', e => {
        const clickedItem = e.target.closest('.track-item');
        if (!clickedItem) return;
        const trackIndex = parseInt(clickedItem.dataset.index);
        console.log(`Clic en lista general de sets, item: ${trackIndex}`); // LOG
        if (trackIndex !== currentSetIndex && allSets[trackIndex]) {
            loadTrack(allSets[trackIndex], trackIndex);
            wavesurfer.once('ready', () => {
                console.log("Track seleccionado de lista general listo, reproduciendo..."); // LOG
                wavesurfer.play();
            });
        } else if (trackIndex === currentSetIndex) {
            console.log("Clic en track actual de lista general, ejecutando playPause..."); // LOG
            wavesurfer.playPause();
        }
    });

    // --- Botón Play/Pause Principal ---
    playPauseBtn.addEventListener('click', () => {
        console.log("Clic en botón Play/Pause principal"); // LOG
        if (wavesurfer && typeof wavesurfer.playPause === 'function') {
             // Re-añadimos check isReady por seguridad
            if (wavesurfer.isReady) {
                wavesurfer.playPause();
            } else {
                 console.warn("Intento de Play/Pause pero WaveSurfer no está listo.");
            }
        } else {
            console.warn("Intento de Play/Pause pero WaveSurfer no está inicializado o no tiene el método.");
        }
    });

    console.log("Aplicación inicializada y listeners configurados."); // LOG FINAL INIT
});
