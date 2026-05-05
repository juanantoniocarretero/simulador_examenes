import * as storage from './storage.js';
import * as ui from './uiManager.js';

// Variables globales de estado
let allQuestions = [];
let sessionQuestions = [];
let failedQuestions = [];
let userAnswers = [];
let currentIdx = 0;
let successes = 0;
let errors = 0;
let state = "check";
let currentExamName = "";

// Variables para el temporizador
let timerInterval;
let timeLeft;

// Variable para el marcador de dudas
let flaggedQuestions = new Set();

/**
 * Inicialización al cargar la página
 */
window.onload = () => {
    showHistory();
    ui.setupSelectorPreguntas();
    ui.setupSelectorTiempo();

    const examSelect = document.getElementById("exam-select");
    if (examSelect) {
        examSelect.addEventListener("change", updateTypeCounts);
        updateTypeCounts();
    }
};

/**
 * Actualiza dinámicamente el selector de tipos con el conteo
 */
async function updateTypeCounts() {
    const examFile = document.getElementById("exam-select").value;
    const typeSelect = document.getElementById("type-select");

    try {
        const res = await fetch(examFile);
        const questions = await res.json();

        const total = questions.length;
        const counts = {
            all: total,
            radio: questions.filter(q => q.type === "radio").length,
            checkbox: questions.filter(q => q.type === "checkbox").length,
            text: questions.filter(q => q.type === "text").length,
            matrix: questions.filter(q => q.type === "matrix").length,
            match: questions.filter(q => q.type === "match").length // Nuevo conteo para emparejamientos[cite: 1, 2]
        };

        // Actualización de textos en el <select>[cite: 1, 2]
        typeSelect.options[0].text = `Todas las preguntas (${counts.all} / ${total})`;
        typeSelect.options[1].text = `Selección Única (${counts.radio} / ${total})`;
        typeSelect.options[2].text = `Selección Múltiple (${counts.checkbox} / ${total})`;
        typeSelect.options[3].text = `Completar Texto (${counts.text} / ${total})`;

        // Matrices V/F (índice 4)
        if (typeSelect.options[4]) {
            typeSelect.options[4].text = `Matrices V/F (${counts.matrix} / ${total})`;
            typeSelect.options[4].disabled = (counts.matrix === 0);
        }

        // --- NUEVA OPCIÓN PARA EMPAREJAMIENTO (índice 5) ---
        // Asegúrate de tener este <option value="match"> en tu index.html[cite: 2]
        if (typeSelect.options[5]) {
            typeSelect.options[5].text = `Emparejamiento (${counts.match} / ${total})`;
            typeSelect.options[5].disabled = (counts.match === 0);
        }

        // Deshabilitar opciones que no tengan preguntas[cite: 2]
        for (let i = 1; i < typeSelect.options.length; i++) {
            const val = typeSelect.options[i].value;
            if (counts[val] !== undefined) {
                typeSelect.options[i].disabled = (counts[val] === 0);
            }
        }

        // Si el tipo seleccionado actualmente quedó deshabilitado, volver a "Todas"[cite: 2]
        if (typeSelect.selectedOptions[0].disabled) {
            typeSelect.value = "all";
        }

    } catch (e) {
        console.error("Error al actualizar conteos:", e);
        typeSelect.options[0].text = "Error al cargar tipos";
    }
}

/**
 * Inicializa el quiz con filtros
 */
async function initQuiz(onlyFailed = false) {
    if (!onlyFailed) {
        const examFile = document.getElementById("exam-select").value;
        const limit = parseInt(document.getElementById("num-questions").value);
        const selectedType = document.getElementById("type-select").value;
        const timeLimit = parseInt(document.getElementById("timer-select").value);

        currentExamName = document.getElementById("exam-select").options[document.getElementById("exam-select").selectedIndex].text;

        try {
            const res = await fetch(examFile);
            if (!res.ok) {
                window.location.href = "404.html";
                return;
            }

            allQuestions = await res.json();

            let filtered = (selectedType === "all")
                ? [...allQuestions]
                : allQuestions.filter(q => q.type === selectedType);

            if (filtered.length === 0) {
                alert("No hay preguntas disponibles para este filtro.");
                return;
            }

            let shuffled = filtered.sort(() => 0.5 - Math.random());

            sessionQuestions = (limit === 0 || limit > shuffled.length)
                ? shuffled
                : shuffled.slice(0, limit);

            startTimer(timeLimit);

        } catch (e) {
            console.error("Error al cargar:", e);
            alert("Error al cargar el archivo JSON.");
            return;
        }
    } else {
        const timeLimit = parseInt(document.getElementById("timer-select").value);
        startTimer(timeLimit);
        sessionQuestions = [...failedQuestions].sort(() => 0.5 - Math.random());
    }

    currentIdx = 0;
    successes = 0;
    errors = 0;
    failedQuestions = [];
    userAnswers = [];
    flaggedQuestions.clear();

    document.getElementById("setup").classList.add("hidden");
    document.getElementById("results").classList.add("hidden");
    document.getElementById("quiz").classList.remove("hidden");
    renderQuestion();
}

/**
 * Control del cronómetro
 */
function startTimer(minutes) {
    clearInterval(timerInterval);
    const timerDisplay = document.getElementById("timer-display");

    if (minutes === 0) {
        timerDisplay.innerText = "⏱️ Modo Libre";
        timerDisplay.style.color = "var(--accent)";
        return;
    }

    timeLeft = minutes * 60;
    timerInterval = setInterval(() => {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerDisplay.innerText = `⏱️ ${mins}:${secs < 10 ? '0' : ''}${secs}`;

        if (timeLeft <= 300 && timeLeft > 0) {
            timerDisplay.style.color = "red";
            timerDisplay.classList.add("blink-warning");
        } else {
            timerDisplay.style.color = "var(--accent)";
            timerDisplay.classList.remove("blink-warning");
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert("¡Tiempo agotado!");
            finishQuiz();
        } else {
            timeLeft--;
        }
    }, 1000);
}

/**
 * Dibuja la pregunta actual en el DOM
 */
function renderQuestion() {
    const item = sessionQuestions[currentIdx];

    document.getElementById("progress-text").innerText = `Pregunta ${currentIdx + 1} de ${sessionQuestions.length}`;
    const progressPercent = ((currentIdx + 1) / sessionQuestions.length) * 100;
    document.getElementById("progress-bar").style.width = `${progressPercent}%`;

    document.getElementById("count-success").innerText = successes;
    document.getElementById("count-error").innerText = errors;
    document.getElementById("question-text").innerText = item.q;
    document.getElementById("feedback").innerText = "";
    document.getElementById("main-btn").innerText = "Verificar";
    state = "check";

    const imgContainer = document.getElementById("question-image-container");
    if (imgContainer) {
        if (item.image) {
            imgContainer.innerHTML = `<img src="${item.image}" alt="Imagen de la pregunta">`;
            imgContainer.classList.remove("hidden");
        } else {
            imgContainer.innerHTML = "";
            imgContainer.classList.add("hidden");
        }
    }

    const flagBtn = document.getElementById("flag-btn");
    if (flaggedQuestions.has(currentIdx)) {
        flagBtn.innerText = "🚩 Marcada";
        flagBtn.classList.add("active-flag");
    } else {
        flagBtn.innerText = "🚩 Duda";
        flagBtn.classList.remove("active-flag");
    }

    const container = document.getElementById("ans-container");
    container.innerHTML = "";

    // Lógica según el tipo de pregunta
    if (item.type === "text") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "text-ans";
        input.className = "input-text-ans";
        input.autocomplete = "off";
        input.placeholder = "Escribe tu respuesta...";
        container.appendChild(input);
        setTimeout(() => input.focus(), 50);
        input.onkeypress = (e) => { if (e.key === 'Enter') handleMainAction(); };

    } else if (item.type === "matrix") {
        const table = document.createElement("table");
        table.className = "matrix-table";
        item.subquestions.forEach((sub, idx) => {
            const row = document.createElement("tr");
            row.innerHTML = `
            <td class="matrix-question-text">${sub}</td>
            <td class="matrix-cells">
                <label class="matrix-option">
                    <input type="radio" name="matrix-${idx}" value="true"> <span>Sí</span>
                </label>
                <label class="matrix-option">
                    <input type="radio" name="matrix-${idx}" value="false"> <span>No</span>
                </label>
            </td>
        `;
            table.appendChild(row);
        });
        container.appendChild(table);

    } else if (item.type === "match") {
        const matchContainer = document.createElement("div");
        matchContainer.className = "match-container";

        item.left.forEach((text, idx) => {
            const row = document.createElement("div");
            row.className = "match-row";

            const leftCol = document.createElement("div");
            leftCol.className = "match-left-text";
            leftCol.innerText = text;

            const select = document.createElement("select");
            select.id = `match-${idx}`;
            select.className = "match-select";

            // Opción por defecto
            let optionsHtml = `<option value="-1">Selecciona una relación...</option>`;
            // Añadir las opciones de la derecha
            item.right.forEach((rText, rIdx) => {
                optionsHtml += `<option value="${rIdx}">${rText}</option>`;
            });

            select.innerHTML = optionsHtml;

            row.appendChild(leftCol);
            row.appendChild(select);
            matchContainer.appendChild(row);
        });
        container.appendChild(matchContainer);

    } else {
        // Tipos estándar: radio y checkbox
        item.options.forEach((opt, idx) => {
            const label = document.createElement("label");
            label.className = "btn";
            const inputType = item.type === "radio" ? "radio" : "checkbox";
            label.innerHTML = `<input type="${inputType}" name="ans" value="${idx}"> ${opt}`;
            container.appendChild(label);
        });
    }
}

/**
 * Lógica del botón principal
 */
function handleMainAction() {
    if (state === "check") {
        checkAnswer();
    } else {
        currentIdx++;
        if (currentIdx < sessionQuestions.length) {
            renderQuestion();
        } else {
            finishQuiz();
        }
    }
}

/**
 * Validación de respuestas (Modificada para permitir blancos)
 */
function checkAnswer() {
    const item = sessionQuestions[currentIdx];
    const feedback = document.getElementById("feedback");
    let isCorrect = false;
    let userText = "";
    let correctText = "";

    if (item.type === "text") {
        const inputEl = document.getElementById("text-ans");
        const val = inputEl.value.trim();
        const solution = String(item.correct);
        isCorrect = val.toLowerCase() === solution.toLowerCase();
        userText = val || "(Vacío)";
        correctText = solution;
        inputEl.disabled = true;
        inputEl.classList.add(isCorrect ? "correct-input" : "wrong-input");

    } else if (item.type === "matrix") {
        let matrixResults = [];
        let allCorrect = true;

        item.subquestions.forEach((_, idx) => {
            const selected = document.querySelector(`input[name="matrix-${idx}"]:checked`);
            const userVal = selected ? (selected.value === "true") : null;
            const isRowOk = (userVal === item.correct[idx]);

            if (!isRowOk) allCorrect = false;

            // Guardamos el texto para el reporte
            matrixResults.push(userVal === null ? "?" : (userVal ? "Sí" : "No"));

            // --- Lógica de resaltado visual ---
            const options = document.getElementsByName(`matrix-${idx}`);
            options.forEach(input => {
                const label = input.closest('.matrix-option');
                const isCorrectOption = (input.value === String(item.correct[idx]));

                if (isCorrectOption) {
                    // Resaltamos la opción que era la correcta en verde
                    label.classList.add("correct-matrix");
                }

                if (input.checked && !isRowOk) {
                    // Si el usuario marcó esta y estaba mal, resaltamos en rojo
                    label.classList.add("wrong-matrix");
                }

                // Deshabilitamos para que no se pueda cambiar
                input.disabled = true;
            });
        });

        isCorrect = allCorrect;
        userText = `Tus respuestas: [${matrixResults.join(", ")}]`;
        correctText = `Correcto: [${item.correct.map(v => v ? "Sí" : "No").join(", ")}]`;

    } else if (item.type === "match") {
        let allCorrect = true;
        let matchSummary = [];
        let solutionsSummary = [];

        item.left.forEach((leftLabel, idx) => {
            const selectEl = document.getElementById(`match-${idx}`);
            const userVal = parseInt(selectEl.value);
            const correctVal = item.correct[idx];
            const isRowOk = userVal === correctVal;

            if (!isRowOk) {
                allCorrect = false;
                // --- MOSTRAR RESPUESTA CORRECTA VISUALMENTE ---
                const correctHint = document.createElement("div");
                correctHint.className = "correct-match-hint";
                correctHint.innerText = `Correcto: ${item.right[correctVal]}`;
                selectEl.parentNode.appendChild(correctHint);
            }

            selectEl.disabled = true;
            selectEl.classList.add(isRowOk ? "correct-input" : "wrong-input");

            const userChoiceText = userVal !== -1 ? item.right[userVal] : "(Sin unir)";
            matchSummary.push(`${leftLabel} → ${userChoiceText}`);
            solutionsSummary.push(`${leftLabel} → ${item.right[correctVal]}`);
        });

        isCorrect = allCorrect;
        userText = "Tus uniones: " + matchSummary.join(" | ");
        correctText = "Solución: " + solutionsSummary.join(" | ");

    } else {
        const sel = Array.from(document.querySelectorAll('input[name="ans"]:checked')).map(i => parseInt(i.value));
        if (item.type === "radio") {
            isCorrect = sel[0] === item.correct;
            userText = sel.length > 0 ? item.options[sel[0]] : "(Sin selección)";
            correctText = item.options[item.correct];
        } else {
            isCorrect = JSON.stringify(sel.sort()) === JSON.stringify(item.correct.sort());
            userText = sel.map(i => item.options[i]).join(", ") || "(Sin selección)";
            correctText = item.correct.map(i => item.options[i]).join(", ");
        }

        document.querySelectorAll('#ans-container label').forEach((label, idx) => {
            const isOk = Array.isArray(item.correct) ? item.correct.includes(idx) : idx === item.correct;
            if (isOk) label.classList.add("correct");
            else if (label.querySelector('input').checked) label.classList.add("wrong");
            label.classList.add("disabled");
            label.querySelector('input').disabled = true;
        });
    }

    // Guardar resultado para el reporte detallado
    userAnswers.push({
        question: item.q,
        user: userText,
        correct: correctText,
        status: isCorrect ? "✅" : "❌",
        wasFlagged: flaggedQuestions.has(currentIdx)
    });

    if (isCorrect) {
        successes++;
        feedback.innerText = "¡Correcto! ✨";
        feedback.style.color = "var(--success)";
    } else {
        errors++;
        failedQuestions.push(item);
        feedback.innerText = (item.type === "match") ? "Relación incorrecta." : `Error. ${correctText}`;
        feedback.style.color = "var(--error)";
    }

    document.getElementById("main-btn").innerText = "Siguiente";
    state = "next";
}

/**
 * Finalización
 */
function finishQuiz() {
    clearInterval(timerInterval);
    document.getElementById("quiz").classList.add("hidden");
    document.getElementById("results").classList.remove("hidden");

    document.getElementById("score-display").innerText = `${successes} / ${sessionQuestions.length}`;

    const ratio = successes / sessionQuestions.length;
    document.getElementById("final-msg").innerText = ratio >= 0.7 ? "¡Excelente! Nivel de examen." : "Sigue practicando.";

    const reportContainer = document.getElementById("report-container");
    if (reportContainer) {
        reportContainer.innerHTML = ui.renderDetailedReport(userAnswers, sessionQuestions.length);
    }

    const flagReviewDiv = document.getElementById("flagged-review");
    const flagList = document.getElementById("flagged-list");

    if (flaggedQuestions.size > 0) {
        flagReviewDiv.classList.remove("hidden");
        flagList.innerHTML = Array.from(flaggedQuestions).map(idx => {
            return `<li><b>Pregunta ${idx + 1}:</b> ${sessionQuestions[idx].q}</li>`;
        }).join('');
    } else {
        flagReviewDiv.classList.add("hidden");
    }

    const retryBtn = document.getElementById("retry-failed-btn");
    if (retryBtn) retryBtn.classList.toggle("hidden", failedQuestions.length === 0);

    storage.saveToHistory(
        successes,
        sessionQuestions.length,
        currentExamName,
        document.getElementById("exam-select").value,
        document.getElementById("num-questions").value
    );

    showHistory();
}

/**
 * Historial
 */
function showHistory() {
    const history = storage.getHistory();
    const list = document.getElementById("history-list");
    if (!list) return;

    list.innerHTML = history.length ? history.map((h, i) => `
        <div class="history-item" onclick="retryFromHistory(${i})" style="cursor:pointer;">
            <span>${h.exam} (${h.date})</span>
            <strong>${h.result}</strong>
        </div>
    `).join('') : "<p style='text-align:center; color:gray'>Sin intentos</p>";
}

window.retryFromHistory = (index) => {
    const history = storage.getHistory();
    const record = history[index];
    if (record) {
        document.getElementById("exam-select").value = record.file;
        document.getElementById("num-questions").value = record.limit;
        initQuiz(false);
    }
};

window.toggleFlag = () => {
    const flagBtn = document.getElementById("flag-btn");
    if (flaggedQuestions.has(currentIdx)) {
        flaggedQuestions.delete(currentIdx);
        flagBtn.innerText = "🚩 Duda";
        flagBtn.classList.remove("active-flag");
    } else {
        flaggedQuestions.add(currentIdx);
        flagBtn.innerText = "🚩 Marcada";
        flagBtn.classList.add("active-flag");
    }
};

window.initQuiz = initQuiz;
window.handleMainAction = handleMainAction;
window.confirmExit = () => {
    if (confirm("¿Deseas finalizar el examen ahora?")) {
        const answered = currentIdx + (state === "next" ? 1 : 0);
        if (answered === 0) { location.reload(); return; }
        sessionQuestions = sessionQuestions.slice(0, answered);
        finishQuiz();
    }
};