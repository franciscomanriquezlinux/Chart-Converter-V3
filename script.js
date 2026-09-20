const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const convertBtn = document.getElementById("convert-btn");
const downloadZipBtn = document.getElementById("download-zip-btn");
const chartArea = document.getElementById("chart-area");
const metaArea = document.getElementById("meta-area");
const dropText = document.getElementById("drop-text");

// Elementos de la UI interactiva de metadatos
const albumToggle = document.getElementById("album-toggle");
const albumInput = document.getElementById("album-input");
const stickerToggle = document.getElementById("sticker-toggle");
const stickerInput = document.getElementById("sticker-input");

// Elementos de la UI de eventos incluidos
const cameraToggle = document.getElementById("camera-toggle");
const zoomToggle = document.getElementById("zoom-toggle");

// Elementos de la UI de empacado FNF Classic (.fnfc)
const instAudioInput = document.getElementById("inst-audio");
const oppAudioInput = document.getElementById("opp-audio");
const plyAudioInput = document.getElementById("ply-audio");
const fnfcBtn = document.getElementById("fnfc-btn");

const modeCards = document.querySelectorAll(".mode-card");

let selectedFiles = [];
let currentSongKey = "pack";
let converterMode = "psych";

// Cambio de formato de origen (Psych Engine / Codename Engine)
modeCards.forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    radio.addEventListener("change", () => {
        converterMode = radio.value;
        modeCards.forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");

        const modeLabels = {
            psych: "Psych Engine",
            psych063: "Psych 0.6.3 (Legacy)",
            kade: "Kade Engine",
            psych073: "Psych 0.7.3 (psych_v1)",
            psych104: "Psych 1.0.4 (psych_v1)",
            pslice: "P Slice",
            codename: "Codename Engine"
        };
        dropText.innerHTML = `¡Suelta tus charts de <span>${modeLabels[converterMode] || "Psych Engine"}</span> aquí!`;

        selectedFiles = [];
        document.getElementById("file-list").innerText = "";
        chartArea.value = "";
        metaArea.value = "";
        convertBtn.style.display = "none";
        downloadZipBtn.style.display = "none";
    });
});

// Activar/Desactivar inputs basados en los switches
albumToggle.addEventListener("change", (e) => {
    albumInput.disabled = !e.target.checked;
    if(e.target.checked) albumInput.focus();
});

stickerToggle.addEventListener("change", (e) => {
    stickerInput.disabled = !e.target.checked;
    if(e.target.checked) stickerInput.focus();
});

dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => handleFiles(e.target.files));
dropZone.addEventListener("dragover", e => { 
    e.preventDefault(); 
    dropZone.style.borderColor = "#ff007f"; 
});
dropZone.addEventListener("drop", e => { 
    e.preventDefault(); 
    handleFiles(e.dataTransfer.files); 
});

function handleFiles(files) {
    selectedFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.json'));
    const fileList = document.getElementById("file-list");
    if (selectedFiles.length > 0) {
        fileList.innerText = `🔥 ¡${selectedFiles.length} mapa(s) detectado(s) listo(s) para reventar!`;
        convertBtn.style.display = "block";
        downloadZipBtn.style.display = "none";
    } else {
        fileList.innerText = "⚠️ No se encontraron archivos .json válidos.";
        convertBtn.style.display = "none";
        downloadZipBtn.style.display = "none";
    }
}

function getDiff(name) {
    const n = name.toLowerCase().replace(/\.json$/i, "");
    const lower = n.toLowerCase();
    if (lower.endsWith("-easy") || lower === "easy") return "easy";
    if (lower.endsWith("-hard") || lower === "hard") return "hard";
    if (lower.endsWith("-normal") || lower === "normal") return "normal";
    return "normal";
}

function copyToClipboard(areaId, button) {
    const textarea = document.getElementById(areaId);
    if (!textarea.value) {
        button.innerText = "❌ ¡Vacío!";
        setTimeout(() => button.innerText = "📋 Copiar", 1500);
        return;
    }

    const done = () => {
        button.innerText = "✅ ¡Copiado!";
        button.style.borderColor = "#00ff66";
        button.style.color = "#00ff66";
        setTimeout(() => {
            button.innerText = "📋 Copiar";
            button.style.borderColor = "";
            button.style.color = "";
        }, 2000);
    };

    // En contextos no seguros (ej: abrir el HTML desde file://) navigator.clipboard no existe.
    if (!navigator.clipboard || !window.isSecureContext) {
        textarea.focus();
        textarea.select();
        try {
            const ok = document.execCommand("copy");
            if (ok) return done();
        } catch (err) {
            console.error("Error al copiar código: ", err);
        }
        button.innerText = "❌ Sin permisos";
        setTimeout(() => button.innerText = "📋 Copiar", 1500);
        return;
    }

    navigator.clipboard.writeText(textarea.value).then(done).catch(err => {
        console.error("Error al copiar código: ", err);
    });
}

// ============ CONVERSIÓN: PSYCH ENGINE → V SLICE ============
// psychMode: "auto" (detecta 0.7+ por campo format) | "063" (legacy, fuerza re-mapeo) | "073" (absoluto, psych_v1) | "104"/"pslice" (absoluto + eventos inline)
// Kade/Kade legacy usan la misma codificación relativa a mustHitSection → se procesa igual que "063".
function convertPsychToVSlice(rawData, file, psychMode = "auto") {
    const song = rawData.song && typeof rawData.song === "object" ? rawData.song : rawData;

    if (!song.notes || !Array.isArray(song.notes)) {
        throw new Error("No se encontró el array 'notes' (chart de Psych Engine). Verifica el formato o que tengas el modo correcto seleccionado.");
    }

    // psych_v1 = direcciones ABSOLUTAS (0.7+). Sin formato = legacy (0.6.3 y anteriores).
    const fmt = typeof song.format === "string" ? song.format.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
    const isV1 = psychMode === "073" || psychMode === "104" || psychMode === "pslice" || (psychMode === "auto" && fmt.startsWith("psychv1"));
    const needsLaneRemap = !isV1;

    // Re-mapea un carril legacy (relativo a mustHitSection) a carril absoluto V-Slice.
    const remapLane = (lane, mustHitSection) => {
        const raw = ((lane % 8) + 8) % 8;
        const isPlayer = raw < 4 ? !!mustHitSection : !mustHitSection;
        return (raw % 4) + (isPlayer ? 0 : 4);
    };

    // Extrae una nota de evento inline (Psych 0.7+/1.0):
    //  - [time, "EventName", v1, v2]           (dirección string)
    //  - [time, -1, "EventName", v1, v2]       (dirección negativa + nombre)
    const extractInlinePsychEvent = (note) => {
        if (!Array.isArray(note) || note.length < 2) return null;
        if (typeof note[1] === "string") return { name: note[1], value1: note[2], time: note[0] };
        if (typeof note[1] === "number" && note[1] < 0 && typeof note[2] === "string") return { name: note[2], value1: note[3], time: note[0] };
        return null;
    };

    const toZoom = (value) => ({ ease: "expoInOut", duration: 4, mode: "stage", zoom: isNaN(parseFloat(value)) ? 1.4 : parseFloat(value) });

    const notesArr = [];
    const eventsArr = [];
    const timeChanges = [{ t: 0, b: 0, bpm: song.bpm || 100, n: 4, d: 4, bt: [4,4,4,4] }];
    let currentTime = 0;
    let lastFocus = -1;
    let bpm = song.bpm || 100;

    // Extracción de eventos de Zoom de Psych (song.events)
    const psychEvents = rawData.events || song.events;
    if (Array.isArray(psychEvents)) {
        psychEvents.forEach(evGroup => {
            const evTime = parseFloat(evGroup[0]);
            const subEvents = evGroup[1];
            if (Array.isArray(subEvents)) {
                subEvents.forEach(subEv => {
                    const evName = String(subEv[0]).toLowerCase();
                    const value1 = subEv[1];
                    if (evName.includes("zoom")) {
                        eventsArr.push({ t: evTime, e: "ZoomCamera", v: toZoom(value1) });
                    }
                });
            }
        });
    }

    song.notes?.forEach(sec => {
        if (sec.changeBPM && sec.bpm && Number(sec.bpm) > 0) {
            bpm = Number(sec.bpm);
            const last = timeChanges[timeChanges.length - 1];
            if (last.bpm !== bpm || last.t !== Math.round(currentTime)) {
                timeChanges.push({ t: Math.round(currentTime), b: 0, bpm, n: 4, d: 4, bt: [4,4,4,4] });
            }
        }

        const focusChar = sec.mustHitSection ? 0 : 1;
        if (focusChar !== lastFocus) {
            eventsArr.push({ t: Math.round(currentTime), e: "FocusCamera", v: { char: focusChar } });
            lastFocus = focusChar;
        }

        sec.sectionNotes?.forEach(n => {
            // Nota de evento inline (Psych 0.7+/1.0): FocusCamera / Add Camera Zoom / etc.
            const inlineEv = extractInlinePsychEvent(n);
            if (inlineEv) {
                const evName = inlineEv.name.toLowerCase();
                if (evName === "focuscamera") {
                    eventsArr.push({ t: inlineEv.time, e: "FocusCamera", v: { char: parseInt(inlineEv.value1, 10) === 0 ? 0 : 1 } });
                } else if (evName.includes("zoom")) {
                    eventsArr.push({ t: inlineEv.time, e: "ZoomCamera", v: toZoom(inlineEv.value1) });
                }
                return;
            }

            // Nota GF (data negativo con sustain numérico): V-Slice no tiene carril GF, se omite.
            if (typeof n[1] === "number" && n[1] < 0) return;

            const d = needsLaneRemap ? remapLane(n[1], sec.mustHitSection) : n[1];
            notesArr.push({ t: n[0], d, l: n[2] || 0, p: [] });
        });
        const sectionBeats = Number(sec.sectionBeats) || (sec.lengthInSteps ? Number(sec.lengthInSteps) / 4 : 4);
        currentTime += (60000 / bpm) * sectionBeats;
    });

    notesArr.sort((a,b) => a.t - b.t);

    return {
        canonicalKey: (song.song || file.name.split("-")[0]).toLowerCase(),
        songName: song.song || "Unknown",
        speed: song.speed || 2.5,
        bpm: song.bpm || 100,
        player1: song.player1 || "bf",
        player2: song.player2 || "dad",
        girlfriend: song.gfVersion || "gf",
        stage: song.stage || "stage",
        difficulties: null,
        notesArr,
        eventsArr,
        timeChanges
    };
}

// ============ CONVERSIÓN: CODENAME ENGINE → V SLICE ============
function getChara(chart, type, fallback) {
    const line = chart.strumLines.find(s => Number(s.type) === type);
    return line && Array.isArray(line.characters) && line.characters[0] ? line.characters[0] : fallback;
}

function convertCodenameToVSlice(rawData) {
    let chart = (rawData && typeof rawData === "object") ? rawData : {};
    const wrapped = rawData.song && typeof rawData.song === "object" ? rawData.song : null;
    if (wrapped && (wrapped.strumLines || Array.isArray(wrapped.chart) || wrapped.codenameChart)) chart = wrapped;

    if (!chart.strumLines || !Array.isArray(chart.strumLines)) {
        throw new Error("No se encontró un chart nativo de Codename (strumLines). Si el archivo es de Psych (o un chart CNE en formato legacy), usa el modo 'Psych To V Slice'.");
    }

    const meta = chart.meta || {};
    const baseBpm = Number(meta.bpm) || 100;

    const notesArr = [];
    const eventsArr = [];

    for (const sl of chart.strumLines) {
        const baseLane = Number(sl.type) === 1 ? 0 : 4; // PLAYER → 0-3 | OPPONENT/GF → 4-7
        for (const n of sl.notes || []) {
            const lane = baseLane + (Number(n.id) % 4);
            const note = { t: Number(n.time) || 0, d: lane, l: n.sLen || 0, p: [] };
            const nType = Number(n.type);
            if (nType > 0 && Array.isArray(chart.noteTypes) && chart.noteTypes[nType - 1]) {
                note.k = chart.noteTypes[nType - 1];
            }
            notesArr.push(note);
        }
    }

    const timeChanges = [{ t: 0, b: 0, bpm: baseBpm, n: 4, d: 4, bt: [4,4,4,4] }];

    for (const ev of chart.events || []) {
        const name = String(ev.name || "").toLowerCase();
        const params = ev.params || [];
        const t = Number(ev.time) || 0;

        if (name === "camera movement") {
            // params[0] = strumline objetivo (1 ⇒ player/BF)
            const char = Number(params[0]) === 1 ? 0 : 1;
            eventsArr.push({ t, e: "FocusCamera", v: { char } });
        } else if (name === "camera zoom") {
            // [tween?, zoom, cam, duration, ease, tipo, mode]
            const zoom = parseFloat(params[1]) || 1.4;
            const mode = params[6] === "stage" ? "stage" : "direct";
            eventsArr.push({ t, e: "ZoomCamera", v: { ease: "expoInOut", duration: 4, mode, zoom } });
        } else if (name === "add camera zoom") {
            // [amount, cam]
            const zoom = parseFloat(params[0]) || 0.05;
            eventsArr.push({ t, e: "ZoomCamera", v: { ease: "expoInOut", duration: 4, mode: "stage", zoom } });
        } else if (name === "bpm change") {
            const bpm = parseFloat(params[0]);
            if (bpm > 0) timeChanges.push({ t, b: 0, bpm, n: 4, d: 4, bt: [4,4,4,4] });
        }
    }

    timeChanges.sort((a,b) => a.t - b.t);
    notesArr.sort((a,b) => a.t - b.t);

    const songName = meta.name || meta.displayName || "unknown";

    return {
        canonicalKey: String(songName).toLowerCase(),
        songName: songName,
        speed: Number(chart.scrollSpeed) || 1,
        bpm: baseBpm,
        player1: getChara(chart, 1, "bf"),
        player2: getChara(chart, 0, "dad"),
        girlfriend: getChara(chart, 2, "gf"),
        stage: chart.stage || "stage",
        difficulties: Array.isArray(meta.difficulties) ? meta.difficulties.slice() : null,
        notesArr,
        eventsArr,
        timeChanges
    };
}

// ============ CONSTRUCCIÓN DE METADATA V SLICE ============
function buildVSliceMeta(opts) {
    const playDataObj = {};

    if (stickerToggle.checked) {
        playDataObj.stickerPack = stickerInput.value || "Custom Stickers";
    }

    playDataObj.characters = {
        player: opts.player1 || "bf",
        girlfriend: opts.girlfriend || "gf",
        opponent: opts.player2 || "dad",
        instrumental: "",
        opponentVocals: ["Opponent"],
        playerVocals: ["Player"]
    };
    playDataObj.stage = opts.stage || "stage";
    playDataObj.noteStyle = "funkin";
    playDataObj.ratings = { easy: 3, normal: 5, hard: 6 };

    // EL ÁLBUM VA EXACTAMENTE AQUÍ (Abajo de ratings y arriba de previews de playData)
    if (albumToggle.checked) {
        playDataObj.album = albumInput.value || "Custom Album";
    }

    playDataObj.previewStart = 0;
    playDataObj.previewEnd = 0;

    const meta = {
        version: "2.2.4",
        songName: opts.songName || "Unknown",
        artist: "Unknown",
        charter: "V-Slice Converter",
        looped: false,
        offsets: { instrumental: 0, altInstrumentals: {}, vocals: {}, altVocals: {} },
        playData: playDataObj,
        generatedBy: "Chart Converter V3 GCD",
        timeFormat: "ms",
        timeChanges: (opts.timeChanges && opts.timeChanges.length) ? opts.timeChanges : [{ t: 0, b: 0, bpm: opts.bpm || 100, n: 4, d: 4, bt: [4,4,4,4] }]
    };

    return meta;
}

async function runConversion() {
    if (selectedFiles.length === 0) return null;

    const isCodename = converterMode === "codename";
    const finalChart = { 
        version: "2.0.0", 
        scrollSpeed: {}, 
        notes: {}, 
        events: [], 
        generatedBy: isCodename ? "Chart Converter V3 GCD (Codename → V Slice)" : "Chart Converter V3 GCD" 
    };
    let finalMeta = null;
    let songKey = "pack";
    let activeDifficulties = [];

    try {
        for (const file of selectedFiles) {
            const rawData = JSON.parse(await file.text());

            const result = isCodename
                ? convertCodenameToVSlice(rawData)
                : convertPsychToVSlice(rawData, file, converterMode === "psych063" || converterMode === "kade" ? "063" : converterMode === "psych073" ? "073" : converterMode === "psych104" || converterMode === "pslice" ? "104" : "auto");

            const diff = getDiff(file.name);
            if (!songKey || songKey === "pack") songKey = result.canonicalKey || "pack";
            if (!activeDifficulties.includes(diff)) activeDifficulties.push(diff);

            finalChart.scrollSpeed[diff] = result.speed;
            finalChart.notes[diff] = result.notesArr;
            finalChart.events.push(...result.eventsArr.filter(ev => {
                if (ev.e === "FocusCamera") return cameraToggle.checked;
                if (ev.e === "ZoomCamera") return zoomToggle.checked;
                return true;
            }));

            if (!finalMeta) {
                finalMeta = buildVSliceMeta({
                    songName: result.songName,
                    bpm: result.bpm,
                    player1: result.player1,
                    player2: result.player2,
                    girlfriend: result.girlfriend,
                    stage: result.stage,
                    difficulties: result.difficulties,
                    timeChanges: result.timeChanges
                });
            }
        }
    } catch (err) {
        alert("❌ Error al convertir: " + err.message);
        console.error(err);
        return null;
    }

    if (finalMeta) {
        finalMeta.playData.difficulties = activeDifficulties.length ? activeDifficulties : finalMeta.playData.difficulties || ["normal"];
        if (!finalMeta.playData.difficulties.length) finalMeta.playData.difficulties = ["normal"];
    }

    finalChart.events.sort((a,b) => a.t - b.t);
    
    chartArea.value = JSON.stringify(finalChart, null, 2);
    metaArea.value = JSON.stringify(finalMeta, null, 2);
    
    currentSongKey = songKey;
    downloadZipBtn.style.display = "block";
    return { songKey };
}

convertBtn.addEventListener("click", async () => {
    await runConversion();
});

downloadZipBtn.addEventListener("click", async () => {
    if (!chartArea.value || !metaArea.value) return;

    const zip = new JSZip();
    zip.file(`${currentSongKey}-chart.json`, chartArea.value);
    zip.file(`${currentSongKey}-metadata.json`, metaArea.value);
    
    const content = await zip.generateAsync({type:"blob"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = `${currentSongKey}_VSlice_Pack.zip`;
    a.click();
});

fnfcBtn.addEventListener("click", async () => {
    const instFile = instAudioInput.files[0];

    // Asegura que la conversión ya esté hecha (reusa los archivos arrastrados)
    if (!chartArea.value || !metaArea.value) {
        if (selectedFiles.length === 0) {
            alert("❌ No hay charts cargados. Arrastra o sube los archivos JSON del mapa y luego presiona '✨ PROCESAR ARCHIVOS' antes de generar el pack.");
            return;
        }
        const res = await runConversion();
        if (!res) return;
    }

    if (!instFile) {
        alert("❌ Debes subir el audio 'Inst.ogg' — es OBLIGATORIO para el pack .fnfc.");
        return;
    }

    const songKey = (currentSongKey && currentSongKey !== "pack")
        ? currentSongKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
        : "song";

    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({ version: "1.0.0", songId: songKey }, null, 2));
    zip.file(`${songKey}-chart.json`, chartArea.value);
    zip.file(`${songKey}-metadata.json`, metaArea.value);
    zip.file("Inst.ogg", instFile);
    if (plyAudioInput.files[0]) zip.file("Voices-Player.ogg", plyAudioInput.files[0]);
    if (oppAudioInput.files[0]) zip.file("Voices-Opponent.ogg", oppAudioInput.files[0]);

    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = `${songKey}.fnfc`;
    a.click();
});
