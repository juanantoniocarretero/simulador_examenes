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

// Al cargar la página, inicializamos historial y selectores
window.onload = () => {
    showHistory();
    ui.setupSelectorPreguntas();
    ui.setupSelectorTiempo(); // Poblamos el selector dinámico de tiempo
};

/**
 * Inicializa el quiz cargando el JSON o las fallidas
 */
async function initQuiz(onlyFailed = false) {
    if (!onlyFailed) {
        const examFile = document.getElementById("exam-select").value;
        const limit = parseInt(document.getElementById("num-questions").value);
        
        // LEER EL TIEMPO SELECCIONADO DEL SELECTOR DINÁMICO
        const timeLimit = parseInt(document.getElementById("timer-select").value);
        
        currentExamName = document.getElementById("exam-select").options[document.getElementById("exam-select").selectedIndex].text;

        try {
            const res = await fetch(examFile);
            
            if (!res.ok) {
                window.location.href = "404.html";
                return;
            }

            allQuestions = await res.json();
            let shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
            
            sessionQuestions = (limit === 0) ? shuffled : shuffled.slice(0, limit);

            // INICIAR EL TEMPORIZADOR CON EL VALOR ELEGIDO
            startTimer(timeLimit);

        } catch (e) {
            console.error("Error al cargar:", e);
            alert("Error al cargar el archivo JSON.");
            return;
        }
    } else {
        // Modo repetir preguntas falladas: Reutilizamos el tiempo seleccionado
        const timeLimit = parseInt(document.getElementById("timer-select").value);
        startTimer(timeLimit);
        sessionQuestions = [...failedQuestions].sort(() => 0.5 - Math.random());
    }

    // Resetear contadores, estado y respuestas
    currentIdx = 0;
    successes = 0;
    errors = 0;
    failedQuestions = []; 
    userAnswers = []; 

    document.getElementById("setup").classList.add("hidden");
    document.getElementById("results").classList.add("hidden");
    document.getElementById("quiz").classList.remove("hidden");
    renderQuestion();
}

/**
 * Gestiona el cronómetro del examen de forma ajustable
 */
function startTimer(minutes) {
    clearInterval(timerInterval); // Limpiar cualquier intervalo previo
    const timerDisplay = document.getElementById("timer-display");

    // Lógica para "Sin límite de tiempo" (valor 0)
    if (minutes === 0) {
        timerDisplay.innerText = "⏱️ Modo Libre";
        timerDisplay.style.color = "var(--accent)";
        return; 
    }

    timeLeft = minutes * 60;

    timerInterval = setInterval(() => {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        
        // Actualizar visualmente el tiempo
        timerDisplay.innerText = `⏱️ ${mins}:${secs < 10 ? '0' : ''}${secs}`;
        
        // Cambio de color visual si queda menos de 1 minuto
        if (timeLeft < 60) {
            timerDisplay.style.color = "red";
        } else {
            timerDisplay.style.color = "var(--accent)";
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert("¡Tiempo agotado!");
            finishQuiz(); // Finaliza automáticamente al llegar a cero
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
    document.getElementById("count-success").innerText = successes;
    document.getElementById("count-error").innerText = errors;
    document.getElementById("question-text").innerText = item.q;
    document.getElementById("feedback").innerText = "";
    document.getElementById("main-btn").innerText = "Verificar";
    state = "check";

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
 * Gestiona el botón principal (Verificar / Siguiente)
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
 * Comprueba si la respuesta es correcta
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
        status: isCorrect ? "✅" : "❌"
    });

    if (isCorrect) {
        successes++;
        feedback.innerText = "¡Correcto! ✨";
        feedback.style.color = "var(--success)";
    } else {
        errors++;
        failedQuestions.push(item); 
        const sol = item.type === "text" ? `Solución: ${item.correct}` : "Ver opciones en verde";
        feedback.innerText = `Incorrecto. ${sol}`;
        feedback.style.color = "var(--error)";
    }

    document.getElementById("main-btn").innerText = "Siguiente";
    state = "next";
}

/**
 * Finaliza el quiz y detiene el tiempo
 */
function finishQuiz() {
    clearInterval(timerInterval); // Detener el cronómetro
    
    document.getElementById("quiz").classList.add("hidden");
    const resDiv = document.getElementById("results");
    resDiv.classList.remove("hidden");
    
    document.getElementById("score-display").innerText = `${successes} / ${sessionQuestions.length}`;
    
    const ratio = successes / sessionQuestions.length;
    document.getElementById("final-msg").innerText = ratio >= 0.7 ? "¡Excelente! Nivel de examen." : "Sigue practicando.";
    
    const oldReport = document.getElementById("detailed-report");
    if(oldReport) oldReport.remove();
    
    const reportHTML = ui.renderDetailedReport(userAnswers, sessionQuestions.length);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = reportHTML;
    resDiv.insertBefore(wrapper, resDiv.querySelector("button").parentNode.nextSibling);

    const retryBtn = document.getElementById("retry-failed-btn");
    if (failedQuestions.length > 0) retryBtn.classList.remove("hidden");
    else retryBtn.classList.add("hidden");

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
 * Muestra el historial
 */
function showHistory() {
    const history = storage.getHistory();
    const list = document.getElementById("history-list");
    if (!list) return;

    list.innerHTML = history.length ? history.map((h, i) => `
        <div class="history-item" onclick="retryFromHistory(${i})" style="cursor:pointer; transition: background 0.2s;">
            <span>${h.exam} (${h.date}) <small style="color:var(--accent)">↩ Repetir</small></span>
            <strong>${h.result}</strong>
        </div>
    `).join('') : "<p style='text-align:center; color:gray'>Sin intentos</p>";
}

/**
 * Carga un examen desde el historial
 */
function retryFromHistory(index) {
    const history = storage.getHistory();
    const record = history[index];
    if (record) {
        document.getElementById("exam-select").value = record.file;
        document.getElementById("num-questions").value = record.limit;
        initQuiz(false);
    }
}

// Exponer funciones globales
window.initQuiz = initQuiz;
window.handleMainAction = handleMainAction;
window.retryFromHistory = retryFromHistory;
window.confirmExit = () => {
    if (confirm("¿Deseas finalizar el examen ahora?")) {
        const answered = currentIdx + (state === "next" ? 1 : 0);
        if (answered === 0) { location.reload(); return; }
        sessionQuestions = sessionQuestions.slice(0, answered);
        finishQuiz();
    }
};