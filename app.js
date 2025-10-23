document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM listo. Iniciando aplicación..."); // LOG INICIAL

    // --- Referencias ---
    const waveformContainer = document.getElementById('waveform');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = document.getElementById('playIcon');   // <-- NUEVO
    const pauseIcon = document.getElementById('pauseIcon'); // <-- NUEVO
    const currentTimeEl = document.getElementById('currentTime');
    const totalDurationEl = document.getElementById('totalDuration');
    const currentCoverArt = document.getElementById('current-cover-art');
    const currentTrackTitle = document.getElementById('current-track-title');
    const tracklistElement = document.getElementById('tracklist');
    const profilePicImg = document.getElementById('profile-pic-img');
    const profileBanner = document.querySelector('.profile-banner');
    const currentTracklistElement = document.getElementById('current-tracklist'); // Referencia al nuevo <ul>

    // Referencias para el "Latest Set" (prototipo v4)
    const latestSetTitle = document.getElementById('latest-set-title');
    const latestSetDate = document.getElementById('latest-set-date');
    // Referencia para el filtro de favoritos (prototipo v4)
    const favToggleCheckbox = document.getElementById('fav-toggle');

    // Referencias para la biografía (prototipo v5)
    const profileBioContainer = document.getElementById('profile-bio-container');
    const bioExtended = document.getElementById('bio-extended');
    const bioToggle = document.getElementById('bio-toggle');
    const autoLoopBtn = document.getElementById('autoLoopBtn');
    const prevBtn = document.getElementById('prevBtn'); // <-- AÑADE ESTA LÍNEA
    const nextBtn = document.getElementById('nextBtn'); // <-- AÑADE ESTA LÍNEA


    let currentTrackNameForNotification = null;


    let allSets = [];
    let currentSetIndex = 0;
    let isAutoLoopActive = false;
    let isSeekingViaAutoLoop = false;
    let previousTimeForAutoLoop = -1; // <-- AÑADIR: Guarda el tiempo anterior

    // Cargar un OBJETO de favoritos (v2)
    let allFavorites = JSON.parse(localStorage.getItem('vloitz_favorites') || '{}'); // Reusamos la clave original
    let currentSetFavorites = new Set(); // Este 'Set' guardará los favoritos SÓLO del set actual
    console.log("[Fav PorSet] Datos maestros de favoritos cargados:", allFavorites); // LOG

    let currentLoadedSet = null; // Para saber qué set está cargado
    let wavesurfer = null; // Declarar wavesurfer aquí

    // --- Variables para lógica táctil v6 Final ---
let isDraggingWaveformTouch = false;
let longTouchTimer = null;
const LONG_TOUCH_THRESHOLD = 200;
let wasPlayingBeforeDrag = false; // Para saber si pausar/reanudar

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

                // --- Poblar "Latest Set" (prototipo v4) ---
                if (latestSetTitle && latestSetDate) {
                    console.log("Poblando 'Latest Set' box..."); // LOG
                    latestSetTitle.textContent = allSets[0].title;
                    latestSetDate.textContent = allSets[0].date;
                }

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

        // --- INICIO: CÓDIGO FALTANTE (Establecer icono inicial) ---
        if (playIcon) playIcon.style.display = 'block';   // Asegura que se muestre el icono de Play al cargar
        if (pauseIcon) pauseIcon.style.display = 'none'; // Asegura que Pause esté oculto
        // --- FIN: CÓDIGO FALTANTE ---

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
        updateMediaSessionMetadata(set);
        currentTrackNameForNotification = null;

        // --- Cargar favoritos para ESTE set (v2) ---
        const setKey = currentLoadedSet.title; // Usar el título del set como clave
        if (!allFavorites[setKey]) {
            allFavorites[setKey] = []; // Inicializar si no existe
            console.log(`[Fav v2] Creando nueva entrada de favoritos para: ${setKey}`); // LOG
        }
        // Cargar los favoritos de este set en el 'Set' de memoria actual
        currentSetFavorites = new Set(allFavorites[setKey]);
        console.log(`[Fav v2] Favoritos cargados para "${setKey}":`, currentSetFavorites); // LOG
        // --- Fin carga favoritos v2 ---

        displayTracklist(set.tracklist || []);
        TrackNavigator.prepareTimestamps(set.tracklist || [], currentSetFavorites); // <-- AÑADIR ESTA LÍNEA
        updatePlayingHighlight();
    }

    // --- INICIO: Media Session API (Fase 3 - Modificada para Track Actual) ---
    function updateMediaSessionMetadata(set, currentTrackName = null) { // <-- MODIFICADO: Añadir currentTrackName
        if ('mediaSession' in navigator && set) {
            const trackTitle = currentTrackName || "Loading Track..."; // <-- AÑADIDO: Título por defecto si no hay track
            console.log(`[MediaSession] Actualizando metadatos. Set: "${set.title}", Track: "${trackTitle}"`); // LOG MODIFICADO

            navigator.mediaSession.metadata = new MediaMetadata({
                title: set.title, // El título principal sigue siendo el del Set
                artist: currentTrackName ? '' : 'Vloitz',
                album: trackTitle, // <-- MODIFICADO: Usamos 'album' para el nombre del track actual
                artwork: [
                    { src: set.cover_art_url, sizes: '500x500', type: 'image/png' }, // Asume PNG, ajusta si es necesario
                ]
            });
            console.log("[MediaSession] Metadatos aplicados."); // LOG
        } else {
            console.log("[MediaSession] API no soportada o 'set' no válido."); // LOG
        }
    }

    // --- FIN: Media Session API (Fase 3) ---

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

            const isFavorited = currentSetFavorites.has(totalSeconds); // v2: Comprobar contra el Set del set actual

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

        filterFavoritesDisplay(); // Aplicar filtro al mostrar el tracklist

    }

// --- Función SeekWaveform (Requerida por Drag Logic) ---
const seekWaveform = (clientX, rect, eventType) => {
    console.log(`[Drag v6 Final Corrected] seekWaveform llamado desde: ${eventType}`); // LOG (Prefijo actualizado)
    if (!wavesurfer) { console.warn("[Drag v6 Final Corrected] Seek ignorado: WS no inicializado."); return false; }
    const x = Math.max(0, clientX - rect.left); const width = rect.width;
    if (width === 0) { console.warn("[Drag v6 Final Corrected] Seek abortado: Ancho 0."); return false; }
    const progress = Math.max(0, Math.min(1, x / width));
    try {
        // --- INICIO CORRECCIÓN ---
        // Eliminamos check isReady aquí para permitir seek durante drag
        // if (wavesurfer.isReady) {
            wavesurfer.seekTo(progress);
            const duration = wavesurfer.getDuration();
            if (duration > 0 && currentTimeEl) { currentTimeEl.textContent = formatTime(progress * duration); }
            console.log(`[Drag v6 Final Corrected] Seek executed: progress=${progress.toFixed(4)}`); return true;
        // } else {
        //      console.warn("[Drag v6 Final Corrected] Seek abortado DENTRO: WS no listo."); return false;
        // }
        // --- FIN CORRECCIÓN ---
    } catch (error) {
        console.error(`[Drag v6 Final Corrected] Error en seekTo(${progress.toFixed(4)}):`, error); return false;
    }
};


// --- Handlers Globales para Arrastre Táctil (Definidos Fuera) ---
const handleWaveformTouchMove = (moveEvent) => {
    console.log("[Drag v7 Refactored] handleWaveformTouchMove INICIO."); // LOG
    if (!isDraggingWaveformTouch) { console.log("[Drag v7 Refactored] Move ignorado: isDragging false."); return; }
    moveEvent.preventDefault(); // Prevenir scroll
    if (moveEvent.touches && moveEvent.touches.length > 0) {
        const wavesurferElement = wavesurfer.getWrapper(); const rect = wavesurferElement.getBoundingClientRect();
        seekWaveform(moveEvent.touches[0].clientX, rect, "touchmove"); // Llamar a seekWaveform
    } else { console.warn("[Drag v7 Refactored] Touch Move: No 'touches'."); }
    console.log("[Drag v7 Refactored] handleWaveformTouchMove FIN."); // LOG
};

const handleWaveformTouchEnd = (endEvent) => {
    console.log(`[Drag v7 Refactored] handleWaveformTouchEnd (Global) INICIO. isDragging: ${isDraggingWaveformTouch}. Tipo: ${endEvent.type}`); // LOG
    if (!isDraggingWaveformTouch) { console.log("[Drag v7 Refactored] End (Global) ignorado: isDragging false."); return; }
    isDraggingWaveformTouch = false; // Resetear bandera

                // --- INICIO: Reanudar al finalizar drag ---
                if (wasPlayingBeforeDrag) {
                    wavesurfer.play();
                    console.log("[Drag v7 Pause] Audio reanudado al finalizar arrastre."); // LOG
                }
                wasPlayingBeforeDrag = false; // Resetear estado guardado
                // --- FIN: Reanudar al finalizar drag ---

    console.log("[Drag v7 Refactored] Bandera isDragging reseteada (Global)."); // LOG
    console.log("[Drag v7 Refactored] Removiendo listeners GLOBALES..."); // LOG
    window.removeEventListener('touchmove', handleWaveformTouchMove);
    window.removeEventListener('touchend', handleWaveformTouchEnd);
    window.removeEventListener('touchcancel', handleWaveformTouchEnd);
    console.log("[Drag v7 Refactored] handleWaveformTouchEnd (Global) FIN."); // LOG
};
// --- Fin Handlers Globales ---

    // --- INICIO: Configuración de Acciones Media Session (Repurposed Seek) ---
    if ('mediaSession' in navigator) {
        // LOG MODIFICADO para reflejar los nuevos handlers
        console.log("[MediaSession] Configurando manejadores de acciones (play/pause y seek como skip).");
        try {
            navigator.mediaSession.setActionHandler('play', () => {
                console.log("[MediaSession] Acción 'play' recibida."); // LOG
                if(wavesurfer) wavesurfer.play();
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                console.log("[MediaSession] Acción 'pause' recibida."); // LOG
                if(wavesurfer) wavesurfer.pause();
            });

            // --- INICIO: REEMPLAZO - Usar Seek para Saltar Pista ---
            // ELIMINAMOS setActionHandler('nexttrack', ...)
            // ELIMINAMOS setActionHandler('previoustrack', ...)

            // AÑADIMOS seekforward para llamar a goToNext
            navigator.mediaSession.setActionHandler('seekforward', () => {
                console.log("[MediaSession] Acción 'seekforward' (usada como next) recibida."); // LOG MODIFICADO
                TrackNavigator.goToNext();
            });
            // AÑADIMOS seekbackward para llamar a goToPrevious
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                console.log("[MediaSession] Acción 'seekbackward' (usada como previous) recibida."); // LOG MODIFICADO
                TrackNavigator.goToPrevious();
            });
            // --- FIN: REEMPLAZO ---

        } catch (error) {
            console.error("[MediaSession] Error al configurar manejadores:", error); //LOG ERROR
        }
    }
    // --- FIN: Configuración de Acciones Media Session ---

    // --- Eventos de WaveSurfer ---

    wavesurfer.on('ready', () => {
        const duration = wavesurfer.getDuration();
        totalDurationEl.textContent = formatTime(duration);
        currentTimeEl.textContent = formatTime(0);
        playPauseBtn.disabled = false;
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
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

        // --- INICIO: Lógica para actualizar track en Media Session ---
        if (currentLoadedSet && currentLoadedSet.tracklist && currentLoadedSet.tracklist.length > 0) {
            let foundTrackName = null;
            let foundTrackIndex = null;
            // Iterar tracklist para encontrar el track actual
            // Importante: Asumimos que tracklist está ordenado por tiempo
            for (let i = currentLoadedSet.tracklist.length - 1; i >= 0; i--) {
                const track = currentLoadedSet.tracklist[i];
                const timeParts = track.time.split(':');
                let trackStartTimeSeconds = 0;
                if (timeParts.length === 2) {
                    trackStartTimeSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
                }

                if (currentTime >= trackStartTimeSeconds) {
                    foundTrackName = track.title;
                    foundTrackIndex = i;
                    break; // Salir del bucle una vez encontrado
                }
            }

            // Si encontramos un track y es diferente al último mostrado, actualizamos
            if (foundTrackName && foundTrackName !== currentTrackNameForNotification) {
                console.log(`[MediaSession TimeUpdate] Cambio de track detectado: "${foundTrackName}"`); // LOG
                currentTrackNameForNotification = foundTrackName; // Guardar el nuevo nombre
                updateMediaSessionMetadata(currentLoadedSet, currentTrackNameForNotification); // Actualizar notificación

                // --- INICIO: NUEVO CÓDIGO DE RESALTADO ---

                // 1. Limpiar todos los resaltados anteriores
                currentTracklistElement.querySelectorAll('.track-title.track-title-playing').forEach(el => {
                    el.classList.remove('track-title-playing');
                });

                // 2. Aplicar el nuevo resaltado usando el índice que guardamos
                const newActiveItem = currentTracklistElement.querySelector(`.current-tracklist-item[data-index="${foundTrackIndex}"]`);
                if (newActiveItem) {
                    const titleElement = newActiveItem.querySelector('.track-title');
                    if (titleElement) {
                        titleElement.classList.add('track-title-playing');
                        console.log(`[Highlight] Resaltando track: ${foundTrackName}`);
                    }
                }
                // --- FIN: NUEVO CÓDIGO DE RESALTADO ---

            } else if (!foundTrackName && currentTrackNameForNotification !== null) {
                // Caso borde: Si el tiempo es menor al primer track (ej: intro), reseteamos
                console.log("[MediaSession TimeUpdate] Reseteando nombre de track (intro?)"); // LOG
                currentTrackNameForNotification = null;
                updateMediaSessionMetadata(currentLoadedSet, null); // Actualizar notificación

                // --- AÑADE ESTO PARA LIMPIAR EL RESALTADO ---
                currentTracklistElement.querySelectorAll('.track-title.track-title-playing').forEach(el => {
                    el.classList.remove('track-title-playing');
                });

            }
        }
        // --- FIN: Lógica Media Session ---

            // --- INICIO: Nueva Función Auto-Loop (Refactorización v6) ---
            function handleAutoLoopJump(currentTime) {
                const isFavoritesModeActive = favToggleCheckbox && favToggleCheckbox.checked;

                // Solo actuar si AMBOS botones están activos, Nav está listo Y no estamos ya saltando
                if (isAutoLoopActive && isFavoritesModeActive && TrackNavigator.isReady() && !isSeekingViaAutoLoop) {

                    const currentFavStartTime = TrackNavigator.getCurrentTrackStartTime(currentTime, true);

                    if (currentFavStartTime !== null) {
                        const trackEndTime = TrackNavigator.getTrackEndTime(currentFavStartTime, wavesurfer.getDuration());

                        if (trackEndTime !== null) {
                            const calculatedJumpTime = trackEndTime - TrackNavigator.AUTOLOOP_JUMP_SECONDS_BEFORE_END;

                            // CONDICIÓN: Verificar si estamos DENTRO de la ventana de salto
                            if (currentTime >= calculatedJumpTime) {
                                console.log(`%c[AutoLoop Trigger v6] Condición Cumplida! Time:${currentTime.toFixed(4)} >= JumpAt:${calculatedJumpTime.toFixed(4)}`, "color: lightgreen; font-weight: bold;"); // Log Mantenido

                                const nextFavTimestamp = TrackNavigator.findNextTimestamp(currentFavStartTime, true);
                                console.log(`[AL FoundNext] NextFav: ${nextFavTimestamp !== null ? nextFavTimestamp.toFixed(2)+'s' : 'null'}`); // Log Mantenido

                                if (nextFavTimestamp !== null && nextFavTimestamp !== currentFavStartTime) {
                                    console.log(`[AL Set Seeking TRUE] Antes de llamar a seekToTimestamp.`); // Log Mantenido
                                    isSeekingViaAutoLoop = true;
                                    console.log(`[AL ---> Saltando a ${nextFavTimestamp.toFixed(2)}s <---]`); // Log Mantenido
                                    TrackNavigator.seekToTimestamp(nextFavTimestamp);
                                } else {
                                    console.warn(`[AL No Jump] nextFav es null o igual a currentFav.`); // Log Mantenido
                                }
                            } // Fin if currentTime >= calculatedJumpTime
                        } // Fin if trackEndTime
                    } // Fin if currentFavStartTime
                } // Fin if AutoLoop Activo
            }
            // --- FIN: Nueva Función Auto-Loop ---

            // --- INICIO: Llamada a Lógica Auto-Bucle (Refactorización v6) ---
            handleAutoLoopJump(currentTime);
            // --- FIN: Llamada a Lógica Auto-Bucle ---

            // Actualizar el tiempo anterior SIEMPRE al final del bloque timeupdate
            previousTimeForAutoLoop = currentTime;



    }); // Fin de timeupdate

    wavesurfer.on('seeking', (currentTime) => {
         currentTimeEl.textContent = formatTime(currentTime);
         console.log(`Seeking a: ${formatTime(currentTime)}`); // LOG
    });

    // --- INICIO: Resetear Bandera de AutoLoop (Fase 4 Corrección) ---
    wavesurfer.on('seek', () => {
        // Log SIEMPRE que ocurra un seek
        const timeAfterSeek = wavesurfer.getCurrentTime();
        console.log(`[Event SEEK] Seek completado. Tiempo actual AHORA: ${timeAfterSeek.toFixed(4)}s. Bandera Seeking ERA: ${isSeekingViaAutoLoop}`);

        if (isSeekingViaAutoLoop) {
            console.log("[Event SEEK - AutoLoop] Era un salto automático. Reseteando bandera isSeekingViaAutoLoop a FALSE.");
            isSeekingViaAutoLoop = false; // <-- Resetear bandera DESPUÉS del salto
            // Verificamos el tiempo otra vez por si acaso cambió mínimamente
            const timeAfterReset = wavesurfer.getCurrentTime();
            console.log(`[Event SEEK - AutoLoop] Bandera reseteada. Tiempo actual DESPUÉS del reseteo: ${timeAfterReset.toFixed(4)}s`);
        }
    });
    // --- FIN: Resetear Bandera ---

    wavesurfer.on('play', () => {
        if (playIcon) playIcon.style.display = 'none';    // Oculta Play
        if (pauseIcon) pauseIcon.style.display = 'block'; // Muestra Pause
        updatePlayingHighlight();
        console.log("Evento: Play"); // LOG
    });
    wavesurfer.on('pause', () => {
        if (playIcon) playIcon.style.display = 'block';   // Muestra Play
        if (pauseIcon) pauseIcon.style.display = 'none';  // Oculta Pause
        updatePlayingHighlight(); // Quitar resaltado
        console.log("Evento: Pause"); // LOG
    });

    wavesurfer.on('finish', () => {
        console.log("Evento: Finish (track terminado)"); // LOG
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
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

// --- NUEVO v6 Stable Final (Merged): Lógica Drag-to-Seek ---
const waveformInteractionElement = document.getElementById('waveform');

if (waveformInteractionElement && wavesurfer) {
    console.log("[Drag v6 Final Merged] Añadiendo listeners TÁCTILES v6."); // LOG

    // Variables ya definidas arriba

    // Listener para INICIO TÁCTIL
    waveformInteractionElement.addEventListener('touchstart', (event) => {
        console.log("[Drag v6 Final Merged] Evento: touchstart INICIO.");
        if (event.target.closest('button')) { console.warn("[Drag v6 Final Merged] Touch Start ignorado: botón."); return; }
        console.log("[Drag v6 Final Merged] Touch Start ACEPTADO.");

        clearTimeout(longTouchTimer);

        let touchStartTime = 0;
        if (wavesurfer && typeof wavesurfer.getCurrentTime === 'function') { try { touchStartTime = wavesurfer.getCurrentTime(); } catch (e) {} }
        if (touchStartTime === 0 && wavesurfer && wavesurfer.getMediaElement()) { touchStartTime = wavesurfer.getMediaElement().currentTime || 0; }
        const formattedTouchStartTime = formatTime(touchStartTime);
        console.log(`[Drag v6 Final Merged] Tiempo inicio toque: ${formattedTouchStartTime}`);

        // --- Llamar a seekWaveform en touchstart ---
        console.log("[Drag v6 Final Merged] Intentando seek inicial en touchstart...");
        if (event.touches && event.touches.length > 0) {
            const wavesurferElement = wavesurfer.getWrapper(); const rect = wavesurferElement.getBoundingClientRect();
            seekWaveform(event.touches[0].clientX, rect, "touchstart-initial");
        } else { console.warn("[Drag v6 Final Merged] Touch Start: No 'touches' para seek inicial."); }
        // --- FIN Llamar a seekWaveform ---

        // Iniciar temporizador
        longTouchTimer = setTimeout(() => {
            console.warn(`[Drag v6 Final Merged] ¡TOQUE LARGO DETECTADO! en ${formattedTouchStartTime}`);

            // --- INICIO: Pausar al iniciar drag ---
            wasPlayingBeforeDrag = wavesurfer.isPlaying(); // Guardar estado actual
            if (wasPlayingBeforeDrag) {
                wavesurfer.pause();
                console.log("[Drag v7 Pause] Audio pausado al iniciar arrastre."); // LOG
            }
            // --- FIN: Pausar al iniciar drag ---

            isDraggingWaveformTouch = true; // Activar bandera de arrastre (después de pausar)

            console.log("[Drag v6 Final Merged] isDragging=TRUE. Añadiendo listeners GLOBALES.");

            // --- Definir Handlers Globales ---

            // --- FIN Definir Handlers ---

            // Añadir listeners globales
            window.addEventListener('touchmove', handleWaveformTouchMove, { passive: false });
            window.addEventListener('touchend', handleWaveformTouchEnd);
            window.addEventListener('touchcancel', handleWaveformTouchEnd);

        }, LONG_TOUCH_THRESHOLD);

        console.log(`[Drag v6 Final Merged] touchstart FIN (Timer iniciado).`);
    });

    // Listener para CLIC SIMPLE de RATÓN (PC)
    waveformInteractionElement.addEventListener('click', (event) => {
        // Mantenemos el check isReady aquí para el clic simple
        if (!isDraggingWaveformTouch && wavesurfer && wavesurfer.isReady && !event.target.closest('button')) {
            console.log("[Drag v6 Final Merged] Clic simple (Mouse) detectado.");
            const wavesurferElement = wavesurfer.getWrapper(); const rect = wavesurferElement.getBoundingClientRect();
            seekWaveform(event.clientX, rect, "click"); // Llamada a seek
        } else {
             console.log(`[Drag v6 Final Merged] Clic ignorado. isDragging: ${isDraggingWaveformTouch}, WS ready: ${wavesurfer ? wavesurfer.isReady : 'N/A'}`);
        }
    });

    // Listener LOCAL para FIN de toque (SOLO para cancelar timer en TAP rápido)
    const handleWaveformTapEnd = (event) => {
        console.log(`[Drag v7 Refactored] Evento LOCAL: ${event.type} detectado.`); // LOG
        // Solo necesitamos cancelar el timer aquí
        if (longTouchTimer) {
            clearTimeout(longTouchTimer);
            console.log("[Drag v7 Refactored] Timer cancelado (TAP rápido)."); // LOG
            // Reseteamos longTouchTimer a null para evitar cancelaciones múltiples
            longTouchTimer = null;
        }
        // NO manejamos la bandera ni los listeners globales aquí.
    };
    waveformInteractionElement.addEventListener('touchend', handleWaveformTapEnd);
    waveformInteractionElement.addEventListener('touchcancel', handleWaveformTapEnd);

} else {
     console.error("[Drag v6 Final Merged] No se pudo añadir lógica de interacción."); // LOG ERROR
}
// --- FIN NUEVO BLOQUE v6 Stable Final ---

    // --- Manejar clics en el tracklist actual ---
    currentTracklistElement.addEventListener('click', (e) => {
        const target = e.target;

        // Caso 1: Clic en el botón de favorito
        if (target.classList.contains('favorite-btn')) {
            const seconds = parseInt(target.dataset.seconds, 10);
            if (isNaN(seconds)) return;
            toggleFavorite(seconds, target);
            console.log(`Clic en botón favorito para t=${seconds}s.`); // LOG
        }
        // Caso 2: Clic en cualquier otra parte del item (para saltar)
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
            console.log("Objeto wavesurfer DENTRO del listener:", wavesurfer); // Log de depuración

            try {
                if (wavesurfer && typeof wavesurfer.getDuration === 'function' && typeof wavesurfer.seekTo === 'function') {
                    const duration = wavesurfer.getDuration();
                    if (duration > 0) {
                        const progress = timeInSeconds / duration;
                        const clampedProgress = Math.max(0, Math.min(1, progress));
                        console.log(`Calculando progreso: ${timeInSeconds}s / ${duration.toFixed(2)}s = ${clampedProgress.toFixed(4)}`); // LOG
                        wavesurfer.seekTo(clampedProgress);
                        console.log(`Ejecutado wavesurfer.seekTo(${clampedProgress.toFixed(4)})`); // LOG
                    } else {
                        console.warn("La duración es 0, no se puede calcular el progreso para seekTo."); // LOG ADVERTENCIA
                    }

                    if (typeof wavesurfer.isPlaying === 'function' && !wavesurfer.isPlaying()) {
                         if (typeof wavesurfer.play === 'function') {
                             wavesurfer.play();
                         } else {
                              console.warn("wavesurfer.play no es una función");
                         }
                    }
                } else {
                    console.error("El objeto wavesurfer no está correctamente inicializado o le faltan métodos en este punto."); // LOG ERROR
                }
            } catch (error) {
                 console.error("Error al intentar buscar (seekTo) o reproducir:", error); // LOG ERROR
            }
        }
    });

// --- Lógica Filtro Favoritos (prototipo v4) ---
function filterFavoritesDisplay() {
    if (!favToggleCheckbox || !currentTracklistElement) return; // Salir si no existen

    const showOnlyFavorites = favToggleCheckbox.checked;
    console.log(`[Filter] Cambiando filtro. Mostrar solo favoritos: ${showOnlyFavorites}`); // LOG

    const items = currentTracklistElement.querySelectorAll('.current-tracklist-item');
    let visibleCount = 0;

    items.forEach(item => {
        const favButton = item.querySelector('.favorite-btn');
        const isFavorited = favButton && favButton.classList.contains('favorited');

        if (showOnlyFavorites) {
            if (isFavorited) {
                item.style.display = 'flex'; // Mostrar
                visibleCount++;
            } else {
                item.style.display = 'none'; // Ocultar
            }
        } else {
            item.style.display = 'flex'; // Mostrar todos
            visibleCount++;
        }
    });
    console.log(`[Filter] Filtro aplicado. Items visibles: ${visibleCount} de ${items.length}`); // LOG
}

// Listener para el checkbox
if (favToggleCheckbox) {
    favToggleCheckbox.addEventListener('change', filterFavoritesDisplay);
    console.log("Listener para el filtro de favoritos añadido."); // LOG
}
// --- Fin Lógica Filtro (prototipo v4) ---



// --- Añadir/Quitar Favorito (v2: por set) ---
function toggleFavorite(seconds, buttonElement) {
    if (!currentLoadedSet) {
        console.error("[Fav v2] Error: No hay 'currentLoadedSet' para guardar el favorito.");
        return;
    }

    const setKey = currentLoadedSet.title;
    console.log(`[Fav v2] Toggle favorito para set: "${setKey}", tiempo: ${seconds}s`); // LOG

    // 1. Actualizar el 'Set' en memoria (currentSetFavorites)
    if (currentSetFavorites.has(seconds)) {
        currentSetFavorites.delete(seconds);
        buttonElement.classList.remove('favorited');
        buttonElement.innerHTML = '☆';
        console.log(`[Fav v2] Favorito eliminado de la memoria.`); // LOG
    } else {
        currentSetFavorites.add(seconds);
        buttonElement.classList.add('favorited');
        buttonElement.innerHTML = '★';
        console.log(`[Fav v2] Favorito añadido a la memoria.`); // LOG
    }

    // 2. Actualizar el objeto 'allFavorites' con el array convertido del Set
    allFavorites[setKey] = Array.from(currentSetFavorites);

    // 3. Guardar el objeto 'allFavorites' completo en Local Storage
    try {
        console.log("[Fav PorSet] VERIFICANDO: Objeto a punto de guardar:", JSON.stringify(allFavorites));
        localStorage.setItem('vloitz_favorites', JSON.stringify(allFavorites));
        filterFavoritesDisplay(); // Re-aplicar filtro al cambiar un favorito
        console.log("[Fav PorSet] Base de datos de favoritos guardada en Local Storage:", allFavorites); // LOG

        // --- INICIO: Actualizar Navegador (Corrección Loop Favoritos) ---
        if (currentLoadedSet) { // Asegurarse de que el set está cargado
             TrackNavigator.prepareTimestamps(currentLoadedSet.tracklist || [], currentSetFavorites);
             console.log("[Nav Sync] Timestamps del Navegador actualizados tras cambio de favorito."); // LOG
        }
        // --- FIN: Actualizar Navegador ---

    } catch (error) {
        console.error("[Fav v2] Error al guardar favoritos en Local Storage:", error); // LOG ERROR
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
        console.log("Clic Play/Pause");
        // SIN check isReady aquí (como en v6 estable)
        if (wavesurfer && typeof wavesurfer.playPause === 'function') {
            wavesurfer.playPause();
        } else {
            console.warn("[Play/Pause] Ignorado: WS no inicializado.");
        }
    });


    // --- Lógica de Biografía Expandible (prototipo v5) ---
    if (profileBioContainer && bioExtended && bioToggle) {
        console.log("Biografía expandible inicializada."); // LOG

        // Función para colapsar la biografía
        const collapseBio = () => {
            // Solo colapsar si está expandida
            if (bioExtended.style.display !== 'none') {
                console.log("[Bio] Colapsando biografía."); // LOG
                bioExtended.style.display = 'none';
                bioToggle.textContent = '... Ver más';
            }
        };

        // Función para expandir la biografía
        const expandBio = () => {
            console.log("[Bio] Expandiendo biografía."); // LOG
            bioExtended.style.display = 'inline'; // 'inline' funciona bien con <span>
            bioToggle.textContent = 'Ver menos';
        };

        // 1. Listener para el botón "Ver más / Ver menos"
        bioToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // ¡Importante! Evita que el clic se propague al 'window'

            const isExpanded = bioExtended.style.display !== 'none';
            console.log(`[Bio] Clic en Toggle. ¿Estaba expandido? ${isExpanded}`); // LOG

            if (isExpanded) {
                collapseBio();
            } else {
                expandBio();
            }
        });

        // 2. Listener para cerrar al hacer clic "fuera"
        window.addEventListener('click', (e) => {
            // Comprobar si la bio está expandida Y si el clic NO fue dentro del contenedor
            if (bioExtended.style.display !== 'none' && !profileBioContainer.contains(e.target)) {
                console.log("[Bio] Clic detectado fuera del contenedor. Colapsando."); // LOG
                collapseBio();
            }
        });

    } else {
        console.warn("No se encontraron los elementos de la biografía expandible (prototipo v5)."); // LOG
    }
    // --- Fin Lógica Biografía ---

    // --- INICIO: Módulo de Navegación por Tracks (v1) ---
    const TrackNavigator = (() => {
        const RESTART_THRESHOLD = 3; // Segundos para decidir si reiniciar o ir al anterior
        const AUTOLOOP_JUMP_SECONDS_BEFORE_END = 5;
        let sortedTrackTimestamps = [];
        let sortedFavoriteTimestamps = [];

        // Verifica si los timestamps han sido preparados
        function isReady() {
            return sortedTrackTimestamps.length > 0;
        }

        // Prepara las listas de timestamps (en segundos) cuando se carga un set
        function prepareTimestamps(tracklistData, currentFavoritesSet) {
            console.log("[Nav] Preparando timestamps..."); // LOG
            sortedTrackTimestamps = tracklistData
                .map(track => {
                    const parts = track.time.split(':');
                    if (parts.length === 2) {
                        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                    }
                    return -1; // Marcar como inválido si el formato es incorrecto
                })
                .filter(seconds => seconds >= 0) // Filtrar inválidos
                .sort((a, b) => a - b);

            sortedFavoriteTimestamps = Array.from(currentFavoritesSet)
                .sort((a, b) => a - b);

            console.log("[Nav] Timestamps de tracks:", sortedTrackTimestamps); // LOG
            console.log("[Nav] Timestamps de favoritos:", sortedFavoriteTimestamps); // LOG
        }

        // Encuentra el timestamp de inicio del track (favorito o no) que contiene currentTime
        function getCurrentTrackStartTime(currentTime, useFavorites) {
            const timestamps = useFavorites ? sortedFavoriteTimestamps : sortedTrackTimestamps;
            if (!timestamps || timestamps.length === 0) return null;

            // --- INICIO: Log Interno ---
            console.log(`[Nav Internal] getCurrentTrackStartTime called. Time: ${currentTime.toFixed(4)}, UseFavs: ${useFavorites}`);
            // --- FIN: Log ---

            for (let i = timestamps.length - 1; i >= 0; i--) {
                if (timestamps[i] <= currentTime) {
                    return timestamps[i];
                }
            }
            return null; // Antes del primer track?
        }

        // Encuentra el siguiente timestamp válido
        function findNextTimestamp(currentTime, useFavorites) {
            const timestamps = useFavorites ? sortedFavoriteTimestamps : sortedTrackTimestamps;
            if (!timestamps || timestamps.length === 0) return null;

            for (let i = 0; i < timestamps.length; i++) {
                if (timestamps[i] > currentTime + 0.5) { // +0.5s para evitar saltos accidentales inmediatos
                    console.log(`[Nav] Siguiente timestamp encontrado (${useFavorites ? 'Fav' : 'All'}): ${timestamps[i]}s`); // LOG
                    return timestamps[i];
                }
            }

            // --- INICIO: Lógica de Loop para Favoritos ---
                if (useFavorites && timestamps.length > 0) {
                    // Si estamos en modo favoritos y llegamos al final, volvemos al primero
                    console.log("[Nav Debug] Fin de favoritos alcanzado, loopeando al primero."); // LOG (Ya estaba)
                    // --- INICIO: LOGS ADICIONALES ---
                    console.log(`[Nav Debug] Devolviendo primer favorito: ${timestamps[0]}`);
                    // --- FIN: LOGS ADICIONALES ---
                    return timestamps[0]; // Devuelve el primer favorito
                } else {
                    // Si no estamos en modo favoritos, o no hay favoritos, no hay siguiente
                    console.log(`[Nav Debug] No se encontró siguiente timestamp (${useFavorites ? 'Fav' : 'All'}).`); // LOG (Modificado)
                    // --- INICIO: LOGS ADICIONALES ---
                    console.log("[Nav Debug] Devolviendo null (sin loop o sin siguiente).");
                    // --- FIN: LOGS ADICIONALES ---
                    return null; // Comportamiento original: no hay siguiente
                }
                // --- FIN: Lógica de Loop ---

        }

        // Encuentra el timestamp de fin para un track que empieza en 'trackStartTime'
        // El fin es el inicio del SIGUIENTE track en la lista COMPLETA, o la duración total
        function getTrackEndTime(trackStartTime, totalDuration) {
            if (!sortedTrackTimestamps || sortedTrackTimestamps.length === 0 || trackStartTime === null) return null;

            const currentIndex = sortedTrackTimestamps.indexOf(trackStartTime);
            if (currentIndex === -1) return null; // No debería pasar si trackStartTime vino de getCurrentTrackStartTime

            if (currentIndex < sortedTrackTimestamps.length - 1) {
                // Si NO es el último track, el fin es el inicio del siguiente
                return sortedTrackTimestamps[currentIndex + 1];
            } else {
                // Si ES el último track, el fin es la duración total
                return totalDuration;
            }
        }

        // Encuentra el timestamp anterior válido (o reinicia el actual)
        function findPreviousTimestamp(currentTime, useFavorites) {
            const timestamps = useFavorites ? sortedFavoriteTimestamps : sortedTrackTimestamps;
            if (!timestamps || timestamps.length === 0) return null;

            let previousTimestamp = null;
            let currentTrackStartTimestamp = null;

            // Buscar el inicio del track actual y el inicio del anterior
            for (let i = timestamps.length - 1; i >= 0; i--) {
                if (timestamps[i] <= currentTime) {
                    currentTrackStartTimestamp = timestamps[i];
                    if (i > 0) {
                        previousTimestamp = timestamps[i-1];
                    }
                    break;
                }
            }

            // Si estamos cerca del inicio (menos de RESTART_THRESHOLD segundos), vamos al anterior
            if (currentTrackStartTimestamp !== null && (currentTime - currentTrackStartTimestamp < RESTART_THRESHOLD)) {
                if (previousTimestamp !== null) {
                    console.log(`[Nav] Cerca del inicio, yendo al anterior (${useFavorites ? 'Fav' : 'All'}): ${previousTimestamp}s`); // LOG
                    return previousTimestamp;
                } else {
                    console.log(`[Nav] Cerca del inicio, pero es el primero. Reiniciando a 0s (${useFavorites ? 'Fav' : 'All'}).`); // LOG
                    return 0; // Si es el primer track, reinicia a 0
                }
            }
            // Si no, reiniciamos el track actual
            else if (currentTrackStartTimestamp !== null) {
                console.log(`[Nav] Reiniciando track actual (${useFavorites ? 'Fav' : 'All'}): ${currentTrackStartTimestamp}s`); // LOG
                return currentTrackStartTimestamp;
            }

            console.log(`[Nav] No se pudo determinar timestamp anterior/reinicio (${useFavorites ? 'Fav' : 'All'}). Volviendo a 0s.`); // LOG
            return 0; // Fallback: ir al inicio del audio
        }

        // Función principal para saltar (llamada desde fuera)
        function seekToTimestamp(targetSeconds) {
            if (wavesurfer && typeof wavesurfer.getDuration === 'function') {
                const duration = wavesurfer.getDuration();
                if (duration > 0 && targetSeconds !== null && targetSeconds <= duration) {
                    const progress = targetSeconds / duration;
                    console.log(`[Nav] Saltando a ${targetSeconds}s (Progreso: ${progress.toFixed(4)})`); // LOG
                    wavesurfer.seekTo(progress);

            // --- INICIO: Resetear Bandera INMEDIATAMENTE ---
            if (isSeekingViaAutoLoop) {
                console.log(`[Nav seekToTimestamp] Reseteando isSeekingViaAutoLoop a FALSE inmediatamente después de llamar a seekTo.`);
                isSeekingViaAutoLoop = false;
            }
            // --- FIN: Resetear Bandera ---

                    // Asegurarse de reproducir si estaba pausado por el salto
                    if (!wavesurfer.isPlaying()) {
                        wavesurfer.play();
                    }
                } else {
                    console.warn(`[Nav] No se pudo saltar. Duración: ${duration}, Target: ${targetSeconds}`); // LOG
                }
            }
        }

        // Función PÚBLICA para ir al siguiente
        function goToNext() {
            if (!wavesurfer) return;
            const currentTime = wavesurfer.getCurrentTime();
            const useFavorites = favToggleCheckbox && favToggleCheckbox.checked;
            console.log(`[Nav] goToNext llamado. Tiempo actual: ${currentTime.toFixed(2)}s, Usar Favoritos: ${useFavorites}`); // LOG
            const nextTimestamp = findNextTimestamp(currentTime, useFavorites);
            if (nextTimestamp !== null) {
                seekToTimestamp(nextTimestamp);
            }
        }

        // Función PÚBLICA para ir al anterior
        function goToPrevious() {
            if (!wavesurfer) return;
            const currentTime = wavesurfer.getCurrentTime();
            const useFavorites = favToggleCheckbox && favToggleCheckbox.checked;
            console.log(`[Nav] goToPrevious llamado. Tiempo actual: ${currentTime.toFixed(2)}s, Usar Favoritos: ${useFavorites}`); // LOG
            const previousTimestamp = findPreviousTimestamp(currentTime, useFavorites);
            if (previousTimestamp !== null) {
                seekToTimestamp(previousTimestamp);
            }
        }

        // Exponer la función para ser llamada desde fuera
        return {
            prepareTimestamps: prepareTimestamps,
            goToNext: goToNext,
            goToPrevious: goToPrevious,
            findNextTimestamp: findNextTimestamp,
            isReady: isReady, // <-- AÑADIR
            getCurrentTrackStartTime: getCurrentTrackStartTime, // <-- AÑADIR
            getTrackEndTime: getTrackEndTime, // <-- AÑADIR
            AUTOLOOP_JUMP_SECONDS_BEFORE_END: AUTOLOOP_JUMP_SECONDS_BEFORE_END, // <-- AÑADIR (Exponer umbral)
            seekToTimestamp: seekToTimestamp // <-- LÍNEA AÑADIDA
        };
    })();

    window.TrackNavigator = TrackNavigator; // <-- ADD THIS LINE TO EXPOSE GLOBALLY
    // --- FIN: Módulo de Navegación ---

    // --- INICIO: Lógica Botón Auto-Bucle (Fase 2) ---
    if (autoLoopBtn) {
        autoLoopBtn.addEventListener('click', () => {
            isAutoLoopActive = !isAutoLoopActive; // Alternar estado
            autoLoopBtn.classList.toggle('active', isAutoLoopActive); // Alternar clase CSS
            console.log(`[AutoLoop] Modo Auto-Bucle ${isAutoLoopActive ? 'ACTIVADO' : 'DESACTIVADO'}.`); // LOG

            // Opcional: Podríamos guardar este estado en localStorage también si quisiéramos que se recuerde
             localStorage.setItem('vloitz_auto_loop', isAutoLoopActive);
            // Y cargarlo al inicio:
             isAutoLoopActive = localStorage.getItem('vloitz_auto_loop') === 'true'; autoLoopBtn.classList.toggle('active', isAutoLoopActive);
        });

        // Cargar estado inicial (si decidimos guardarlo en localStorage)
         isAutoLoopActive = localStorage.getItem('vloitz_auto_loop') === 'true';
        autoLoopBtn.classList.toggle('active', isAutoLoopActive);

    } else {
        console.warn("[AutoLoop] Botón Auto-Bucle no encontrado."); // LOG
    }
    // --- FIN: Lógica Botón ---

    // --- INICIO: Listeners para Skip Buttons ---
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            console.log("Clic Previous");
            TrackNavigator.goToPrevious(); // <-- Llama a tu lógica existente
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            console.log("Clic Next");
            TrackNavigator.goToNext(); // <-- Llama a tu lógica existente
        });
    }
    // --- FIN: Listeners para Skip Buttons ---


    console.log("Aplicación inicializada y listeners configurados."); // LOG FINAL INIT



});
