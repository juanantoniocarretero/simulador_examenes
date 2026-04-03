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
    
    // Escuchar cambios en el examen para actualizar los contadores de tipo
    const examSelect = document.getElementById("exam-select");
    if (examSelect) {
        examSelect.addEventListener("change", updateTypeCounts);
        // Ejecución inicial para el primer examen de la lista
        updateTypeCounts();
    }
};

/**
 * Actualiza dinámicamente el selector de tipos con el conteo (tipo / total)
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
            text: questions.filter(q => q.type === "text").length
        };

        // Actualizamos el texto de cada opción con el formato (X / Total)
        typeSelect.options[0].text = `Todas las preguntas (${counts.all} / ${total})`;
        typeSelect.options[1].text = `Selección Única (${counts.radio} / ${total})`;
        typeSelect.options[2].text = `Selección Múltiple (${counts.checkbox} / ${total})`;
        typeSelect.options[3].text = `Completar Texto (${counts.text} / ${total})`;

        // Deshabilitar opciones que no tengan preguntas
        for (let i = 1; i < typeSelect.options.length; i++) {
            const val = typeSelect.options[i].value;
            typeSelect.options[i].disabled = (counts[val] === 0);
        }

        // Si la opción seleccionada quedó deshabilitada, volver a "all"
        if (typeSelect.selectedOptions[0].disabled) {
            typeSelect.value = "all";
        }

    } catch (e) {
        console.error("Error al actualizar conteos:", e);
        typeSelect.options[0].text = "Error al cargar tipos";
    }
}

/**
 * Inicializa el quiz con filtros de tipo y cantidad
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
            
            // Aplicar filtro por tipo
            let filtered = (selectedType === "all") 
                ? [...allQuestions] 
                : allQuestions.filter(q => q.type === selectedType);

            if (filtered.length === 0) {
                alert("No hay preguntas disponibles para este filtro.");
                return;
            }

            // Mezclar y limitar según la cantidad seleccionada
            let shuffled = filtered.sort(() => 0.5 - Math.random());
            
            // Si el límite es 0 (Todos) o mayor al disponible, usamos el total filtrado
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

    // Reset de estado de la sesión
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

    if (item.type === "text") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "text-ans";
        input.autocomplete = "off";
        container.appendChild(input);
        input.focus();
        input.onkeypress = (e) => { if(e.key === 'Enter') handleMainAction(); };
    } else {
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
 * Validación de respuestas
 */
function checkAnswer() {
    const item = sessionQuestions[currentIdx];
    const feedback = document.getElementById("feedback");
    let isCorrect = false;
    let userText = ""; 
    let correctText = "";

    if (item.type === "text") {
        const val = document.getElementById("text-ans").value.trim();
        isCorrect = val.toLowerCase() === item.correct.toLowerCase();
        userText = val || "(Vacío)";
        correctText = item.correct;
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
        feedback.innerText = `Incorrecto. ${item.type === "text" ? 'Solución: ' + item.correct : 'Ver opciones'}`;
        feedback.style.color = "var(--error)";
    }

    document.getElementById("main-btn").innerText = "Siguiente";
    state = "next";
}

/**
 * Finalización y Reporte
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
 * Historial y Utilidades Globales
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