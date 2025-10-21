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

    let allSets = [];
    let currentSetIndex = 0;

    const currentTracklistElement = document.getElementById('current-tracklist'); // Referencia al nuevo <ul>
    let favorites = new Set(JSON.parse(localStorage.getItem('vloitz_favorites') || '[]')); // Cargar favoritos guardados
    let currentLoadedSet = null; // Para saber qué set está cargado
    console.log("Variables globales inicializadas. Favoritos cargados:", favorites); // LOG


    let wavesurfer = null;

    // --- Inicializar WaveSurfer ---
    try {
        console.log("Inicializando WaveSurfer..."); // LOG
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: getComputedStyle(document.documentElement).getPropertyValue('--waveform-wave-color').trim(),
            progressColor: getComputedStyle(document.documentElement).getPropertyValue('--waveform-progress-color').trim(),
            height: 100,
            cursorWidth: 2,
            cursorColor: '#fff',
            barWidth: 3,
            barGap: 2,
            responsive: true,
            backend: 'MediaElement',
            media: document.getElementById('audio-player') // Conectarlo al <audio>
        });
        console.log("WaveSurfer inicializado correctamente."); // LOG
        window.wavesurfer = wavesurfer; // <-- AÑADIR ESTA LÍNEA
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

        currentTracklistElement.classList.add('disabled'); // <-- AÑADIR ESTA LÍNEA
        console.log("Tracklist deshabilitado durante la carga."); // LOG

        wavesurfer.load(set.audio_url);

        currentLoadedSet = set; // Guardar referencia al set cargado
        // Llamar a la nueva función para mostrar el tracklist
        displayTracklist(set.tracklist || []); // Pasar el tracklist del set o un array vacío si no existe

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
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

        // --- NUEVA FUNCIÓN: Mostrar el tracklist del set actual ---
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
            li.dataset.time = track.time; // Guardar el timestamp MM:SS
            li.dataset.index = index; // Guardar índice por si acaso

            // Convertir MM:SS a segundos para el botón de favorito
            const timeParts = track.time.split(':');
            const totalSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
            const isFavorited = favorites.has(totalSeconds); // Comprobar si está en favoritos

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
        currentTrackTitle.textContent = allSets[currentSetIndex].title;
        console.log("WaveSurfer listo para track:", allSets[currentSetIndex].title); // LOG ÉXITO

        currentTracklistElement.classList.remove('disabled'); // <-- AÑADIR ESTA LÍNEA
        console.log("Tracklist habilitado."); // LOG

    });

     wavesurfer.on('loading', (percent) => {
         console.log(`WaveSurfer cargando: ${percent}%`); // LOG PROGRESO
         currentTrackTitle.textContent = `Cargando: ${allSets[currentSetIndex].title} (${percent}%)`;
    });

    wavesurfer.on('error', (err) => {
        console.error('Error de WaveSurfer al cargar audio:', err); // LOG ERROR
        currentTrackTitle.textContent = `Error: ${err.message || err}`;
        playPauseBtn.textContent = '❌';
        playPauseBtn.disabled = true;

        currentTracklistElement.classList.add('disabled'); // <-- AÑADIR ESTA LÍNEA (Asegura deshabilitado)
        console.log("Tracklist permanece deshabilitado debido a error.");// LOG

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
        loadTrack(allSets[nextIndex], nextIndex);
        // Reproducir automáticamente cuando esté listo
        wavesurfer.once('ready', () => {
            console.log("Siguiente track listo, reproduciendo..."); // LOG
            wavesurfer.play();
        });
    });

        // --- NUEVO: Manejar clics en el tracklist actual ---
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
            const timeInSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);

            console.log(`Clic en tracklist item: ${timeString} (${timeInSeconds}s). Intentando buscar...`); // LOG

            if (wavesurfer && wavesurfer.isReady) {
                // Usar seekTo (porcentaje) o setTime (segundos)

                // Calcular el progreso (0 a 1)
                const duration = wavesurfer.getDuration();
                if (duration > 0) {
                    const progress = timeInSeconds / duration;
                    console.log(`Calculando progreso: ${timeInSeconds}s / ${duration.toFixed(2)}s = ${progress.toFixed(4)}`); // LOG
                    wavesurfer.seekTo(progress);
                    console.log(`Ejecutado wavesurfer.seekTo(${progress.toFixed(4)})`); // LOG
                } else {
                    console.warn("La duración es 0, no se puede calcular el progreso para seekTo."); // LOG ADVERTENCIA
                }

                // Asegurarse de que se reproduzca si estaba pausado
                if (!wavesurfer.isPlaying()) {
                    wavesurfer.play();
                }
            } else {
                console.warn("WaveSurfer no está listo para buscar."); // LOG ADVERTENCIA
            }
        }
    });

    // --- NUEVA FUNCIÓN: Añadir/Quitar Favorito ---
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

    // --- Clic en lista ---
    tracklistElement.addEventListener('click', e => {
        const clickedItem = e.target.closest('.track-item');
        if (!clickedItem) return;

        const trackIndex = parseInt(clickedItem.dataset.index);
        console.log(`Clic en tracklist item: ${trackIndex}`); // LOG
        if (trackIndex !== currentSetIndex) {
            loadTrack(allSets[trackIndex], trackIndex);
            // Reproducir automáticamente cuando esté listo
            wavesurfer.once('ready', () => {
                console.log("Track seleccionado listo, reproduciendo..."); // LOG
                wavesurfer.play();
            });
        } else {
            // Si se hace clic en el mismo, solo play/pause
            console.log("Clic en track actual, ejecutando playPause..."); // LOG
            wavesurfer.playPause();
        }
    });

    // --- Botón Play/Pause ---
    playPauseBtn.addEventListener('click', () => {
        console.log("Clic en botón Play/Pause"); // LOG
        wavesurfer.playPause();
    });

    console.log("Aplicación inicializada y listeners configurados."); // LOG FINAL INIT
});
