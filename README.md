# Vloitz Audio Platform 🎵

> **Plataforma Progresiva (PWA) de streaming Hi-Fi con ingeniería visual y de renderizado propietaria.**

Este repositorio aloja el código fuente de **Vloitz**, una aplicación web diseñada para democratizar el consumo y creación de contenido musical de alta fidelidad en dispositivos móviles de gama de entrada.

---

## 🚀 Innovación 1: The Vloitz Hybrid Video Engine

Resolví el desafío técnico de **generar videos MP4 (H.264/AAC)** compatibles con WhatsApp Status directamente desde navegadores móviles en dispositivos Android con recursos limitados (2GB RAM).

### El Problema (The "Low-End" Bottleneck)
El desarrollo web móvil enfrenta tres barreras fatales al intentar renderizar video en el cliente:
1.  **Bloqueo de Hardware:** El `AudioEncoder` (WebCodecs) no tiene acceso al codec AAC en la mayoría de chipsets Android económicos, resultando en archivos mudos.
2.  **Bloqueo de Formato:** `MediaRecorder` nativo solo graba WebM (Opus), un formato que WhatsApp rechaza o recorta a 1 segundo por falta de metadatos.
3.  **Bloqueo de Memoria:** Intentar transcodificar con FFmpeg.wasm (Client-side) provoca crasheos por falta de memoria (OOM) en dispositivos con <4GB RAM.

### Mi Solución: Arquitectura de Renderizado Híbrido (V78)
Desarrollé un flujo de **"Renderizado de Dos Pasos con Puente en la Nube"**:

1.  **Fase 1 (Captura Nativa):** Grabación ligera usando el chip del móvil (WebM/Opus) para garantizar 0% de lag en el audio y prevenir saturación de CPU.
2.  **Fase 2 (Sync-Lock & Pre-Roll):** Algoritmo propio de sincronización que inyecta un "colchón de seguridad" de 0.5s y sincroniza el video basado en el reloj de audio, eliminando el desajuste visual común en JS.
3.  **Fase 3 (Cloud Middleware):** Microservicio Node.js personalizado que recibe los streams, realiza un `copy` del video (sin recodificar para velocidad extrema) y transcodifica solo el audio a AAC.

**Resultado:** Video 100% compatible generado en <15 segundos en dispositivos de gama baja.

---

## 🎨 Innovación 2: Vloitz Dynamic Spectrum (WaveSurfer Hack)

Superé las limitaciones nativas de la librería `wavesurfer.js` para crear una visualización de audio segmentada y multicolor que representa el tracklist del set.

### El Desafío Visual
La librería estándar no permite colorear la onda de audio por segmentos dinámicos (tracks individuales) de manera performante; solo permite un color global o degradados simples.

### Mi Solución: Sistema de Superposición de Regiones
Implementé una técnica de ingeniería inversa visual:
1.  **Capa Base:** Renderizo la onda completa en un color neutro (Blanco/Gris).
2.  **Lentes de Color:** Utilizo el plugin de `Regions` no para su propósito original (selección/loop), sino como capas de filtrado visual.
3.  **Mapeo Dinámico:** Un algoritmo recorre el JSON del tracklist y genera regiones transparentes (`rgba`) con colores específicos sobre cada segmento de tiempo.
4.  **Optimización Táctil:** Reescribí los controladores de eventos táctiles para permitir la navegación fluida ("scrubbing") a través de estas capas sin que el navegador capture los gestos incorrectamente.

**Resultado:** Una interfaz visual rica donde el usuario puede identificar cada canción por su color, manteniendo un rendimiento de 60fps en móviles.

---

## 🎛️ Ecosistema Vloitz: Arquitectura Serverless & Tooling

Más allá del renderizado de video, la plataforma opera bajo una arquitectura de **costo cero** y **alto rendimiento**, utilizando herramientas CLI propias desarrolladas para la gestión de contenido.

### 1. Serverless "GitHub-as-Backend"
En lugar de pagar bases de datos y servidores de almacenamiento, diseñé un sistema que utiliza la infraestructura global de GitHub:
* **Base de Datos:** Un archivo `sets.json` actúa como fuente de verdad, estructurando metadatos, tracklists y tiempos.
* **CDN de Audio:** Los archivos FLAC/WAV se sirven directamente desde los servidores de distribución de GitHub (Raw), permitiendo streaming de alta velocidad y ancho de banda ilimitado sin costo.

### 2. SEO Automation & Social Cards (Smart Sharing)
Resolví el problema de compartir "Single Page Applications" (SPA) en redes sociales (donde WhatsApp/Facebook no leen JavaScript).
* **Herramienta Propia:** Desarrollé un script de Node.js (`generator.js`) que se ejecuta localmente antes de cada deploy.
* **Proceso:** El script lee el `sets.json` y **genera automáticamente** cientos de archivos HTML estáticos ligeros (`/share/id/index.html`) con las etiquetas `OpenGraph` y `Twitter Cards` específicas para cada set.
* **Resultado:** Cada set tiene su propia "portada" rica en redes sociales, aunque la app sea una sola página.

### 3. Vloitz Peak-Generator (Propiedad Intelectual)
Para lograr la visualización instantánea de la onda de audio sin esperar a descargar el archivo completo (300MB+):
* Creé una utilidad interna que analiza los archivos de audio offline y extrae los datos de picos (`peaks.json`).
* El reproductor web carga este JSON ligero (pocos KB) para dibujar la onda inmediatamente, mientras el audio real se carga bajo demanda (streaming).

### 4. PWA & Offline Strategy
Implementación de Service Workers personalizados que:
* Cachean la "App Shell" (Interfaz, lógica, estilos) para carga instantánea.
* **Excluyen inteligentemente** los archivos de audio pesados (.flac) del caché automático para no saturar la memoria del dispositivo del usuario.

---

## 🛠️ Stack Tecnológico

* **Core:** HTML5, CSS3, JavaScript (ES6+).
* **Audio:** Web Audio API, WaveSurfer.js (Custom Implementation).
* **Video:** WebCodecs API (`mp4-muxer`), MediaRecorder API.
* **Backend:** Node.js, Express, Fluent-FFmpeg (Render Cloud).
* **PWA:** Service Workers, Manifest V2, iOS Polyfills.

---

### © Autoría y Derechos

**Desarrollado y Diseñado por:** Kevin Italo Cajaleon Zuta (Vloitz)
*Lima, Perú - 2025*

> *Este proyecto demuestra que las limitaciones de hardware no son el final del camino, sino el comienzo de la innovación en software.*