const ENABLE_WAVEFORM_TUNER = true; // Poner en false para ocultar los controles

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




// Referencias para el Tuner (si está habilitado)
let tunerContainer = null, barWidthSlider = null, barGapSlider = null, barHeightSlider = null;
let barWidthValueSpan = null, barGapValueSpan = null, barHeightValueSpan = null;

if (ENABLE_WAVEFORM_TUNER) {
    tunerContainer = document.getElementById('waveform-tuner');
    barWidthSlider = document.getElementById('barWidthSlider');
    barGapSlider = document.getElementById('barGapSlider');
    barHeightSlider = document.getElementById('barHeightSlider');
    barWidthValueSpan = document.getElementById('barWidthValue');
    barGapValueSpan = document.getElementById('barGapValue');
    barHeightValueSpan = document.getElementById('barHeightValue');


// Nuevas referencias
    heightSlider = document.getElementById('heightSlider');
    barRadiusSlider = document.getElementById('barRadiusSlider');
    cursorWidthSlider = document.getElementById('cursorWidthSlider');
    heightValueSpan = document.getElementById('heightValue');
    barRadiusValueSpan = document.getElementById('barRadiusValue');
    cursorWidthValueSpan = document.getElementById('cursorWidthValue');
    waveColorPicker = document.getElementById('waveColorPicker');
    progressColorPicker = document.getElementById('progressColorPicker');
    cursorColorPicker = document.getElementById('cursorColorPicker');


    if (tunerContainer) tunerContainer.style.display = 'block'; // Mostrar el contenedor
    console.log("Waveform Tuner habilitado."); // LOG
}




    console.log("Variables globales inicializadas. Favoritos cargados:", favorites); // LOG

    // --- Inicializar WaveSurfer ---
    try {
        console.log("Inicializando WaveSurfer..."); // LOG
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            // Leer colores iniciales del Tuner o usar defaults CSS
            waveColor: ENABLE_WAVEFORM_TUNER && waveColorPicker ? waveColorPicker.value : getComputedStyle(document.documentElement).getPropertyValue('--waveform-wave-color').trim(),
            progressColor: ENABLE_WAVEFORM_TUNER && progressColorPicker ? progressColorPicker.value : getComputedStyle(document.documentElement).getPropertyValue('--waveform-progress-color').trim(),
            cursorColor: ENABLE_WAVEFORM_TUNER && cursorColorPicker ? cursorColorPicker.value : '#fff',
            // Leer valores numéricos iniciales del Tuner o usar defaults
            height: ENABLE_WAVEFORM_TUNER && heightSlider ? parseInt(heightSlider.value) : 100,
            cursorWidth: ENABLE_WAVEFORM_TUNER && cursorWidthSlider ? parseInt(cursorWidthSlider.value) : 2,
            barWidth: ENABLE_WAVEFORM_TUNER && barWidthSlider ? parseInt(barWidthSlider.value) : 1,
            barGap: ENABLE_WAVEFORM_TUNER && barGapSlider ? parseInt(barGapSlider.value) : 0,
            barHeight: ENABLE_WAVEFORM_TUNER && barHeightSlider ? parseFloat(barHeightSlider.value) : 1,
            barRadius: ENABLE_WAVEFORM_TUNER && barRadiusSlider ? parseInt(barRadiusSlider.value) : 0,
            responsive: true,
            backend: 'MediaElement',
            media: document.getElementById('audio-player')
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

        // Ya no se deshabilita el tracklist aquí

        // --- LÓGICA MODIFICADA PARA CARGAR PICOS ---
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
                    // Extraer el array de datos de picos del JSON
                    const peaksArray = peaksData.data;
                    if (peaksArray && Array.isArray(peaksArray)) {
                        console.log(`Picos cargados (${peaksArray.length} puntos). Cargando audio con picos...`); // LOG
                        // Cargar audio Y picos en WaveSurfer
                        wavesurfer.load(set.audio_url, peaksArray);
                    } else {
                        console.warn("El JSON de picos no tiene un array 'data' válido. Cargando solo audio..."); // LOG ADVERTENCIA
                        wavesurfer.load(set.audio_url); // Fallback: cargar solo audio
                    }
                })
                .catch(error => {
                    console.error('Error al cargar o parsear el JSON de picos:', error); // LOG ERROR
                    console.warn("Fallback: Cargando solo audio debido a error con picos..."); // LOG ADVERTENCIA
                    wavesurfer.load(set.audio_url); // Fallback: cargar solo audio
                });
        } else {
            // Si no hay peaks_url, cargar solo el audio como antes
            console.log("No se encontró peaks_url. Cargando solo audio..."); // LOG
            wavesurfer.load(set.audio_url);
        }
        // --- FIN LÓGICA MODIFICADA ---

        currentLoadedSet = set; // Guardar referencia al set cargado
        displayTracklist(set.tracklist || []); // Mostrar tracklist

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

        // Ya no se habilita el tracklist aquí
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
        // Ya no se deshabilita el tracklist aquí
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
            // LOG DE DEPURACIÓN ESPECÍFICO (Mantenido):
            console.log("Estado de wavesurfer.isReady al hacer clic:", wavesurfer ? wavesurfer.isReady : 'wavesurfer no definido');
            // NUEVO LOG para ver el objeto wavesurfer en este scope:
            console.log("Objeto wavesurfer DENTRO del listener:", wavesurfer); // <-- Mantenemos este log importante

            // --- SIMPLIFICACIÓN ---
            // Quitamos el if (wavesurfer && wavesurfer.isReady)
            try {
                // Comprobación mínima de que wavesurfer existe y tiene los métodos
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

                    // Asegurarse de que se reproduzca si estaba pausado
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
            // --- FIN SIMPLIFICACIÓN ---
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
        // Guardar en Local Storage
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
            wavesurfer.playPause();
        } else {
            console.warn("Intento de Play/Pause pero WaveSurfer no está listo o no tiene el método.");
        }
    });


    // --- Lógica del Waveform Tuner (si está habilitado) ---
    if (ENABLE_WAVEFORM_TUNER && wavesurfer && barWidthSlider && barGapSlider && barHeightSlider) {
        const updateWaveformAppearance = () => {
            const newOptions = {
                // Valores numéricos
                barWidth: parseInt(barWidthSlider.value),
                barGap: parseInt(barGapSlider.value),
                barHeight: parseFloat(barHeightSlider.value),
                height: parseInt(heightSlider.value),
                barRadius: parseInt(barRadiusSlider.value),
                cursorWidth: parseInt(cursorWidthSlider.value),
                // Colores
                waveColor: waveColorPicker.value,
                progressColor: progressColorPicker.value,
                cursorColor: cursorColorPicker.value
            };
            // Actualizar spans de valores
            if(barWidthValueSpan) barWidthValueSpan.textContent = newOptions.barWidth;
            if(barGapValueSpan) barGapValueSpan.textContent = newOptions.barGap;
            if(barHeightValueSpan) barHeightValueSpan.textContent = newOptions.barHeight.toFixed(1);
            if(heightValueSpan) heightValueSpan.textContent = newOptions.height;
            if(barRadiusValueSpan) barRadiusValueSpan.textContent = newOptions.barRadius;
            if(cursorWidthValueSpan) cursorWidthValueSpan.textContent = newOptions.cursorWidth;

            console.log("Aplicando nuevas opciones de renderizado:", newOptions); // LOG
            try {
                wavesurfer.setOptions(newOptions);
            } catch (error) {
                console.error("Error al aplicar setOptions:", error); // LOG ERROR
            }
        };

        barWidthSlider.addEventListener('input', updateWaveformAppearance);
        barGapSlider.addEventListener('input', updateWaveformAppearance);
        barHeightSlider.addEventListener('input', updateWaveformAppearance);
        console.log("Listeners del Waveform Tuner añadidos."); // LOG
    }



    console.log("Aplicación inicializada y listeners configurados."); // LOG FINAL INIT
});
