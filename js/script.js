// Variables de estado del simulador
let allQuestions = [];
let sessionQuestions = [];
let failedQuestions = []; 
let currentIdx = 0;
let successes = 0;
let errors = 0;
let state = "check"; 
let currentExamName = "";

// Al cargar la página, inicializamos historial y selector
window.onload = () => {
    showHistory();
    setupSelectorPreguntas();
};

/**
 * Genera las opciones del selector de 20 en 20 hasta 200
 */
function setupSelectorPreguntas() {
    const select = document.getElementById("num-questions");
    if (!select) return;

    select.innerHTML = ""; // Limpiar por si acaso

    for (let i = 0; i <= 200; i += 20) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = (i === 0) ? "Todas las disponibles" : `${i} preguntas`;
        select.appendChild(opt);
    }
}

/**
 * Inicializa el examen y gestiona si el archivo existe o no
 */
async function initQuiz(onlyFailed = false) {
    if (!onlyFailed) {
        const examFile = document.getElementById("exam-select").value;
        const limit = parseInt(document.getElementById("num-questions").value);
        currentExamName = document.getElementById("exam-select").options[document.getElementById("exam-select").selectedIndex].text;

        try {
            const res = await fetch(examFile);
            
            // Si el archivo no existe en el servidor (404), redirigimos
            if (!res.ok) {
                window.location.href = "404.html";
                return;
            }

            allQuestions = await res.json();
            let shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
            
            // Si el usuario elige 0, cargamos todo el JSON
            sessionQuestions = (limit === 0) ? shuffled : shuffled.slice(0, limit);

        } catch (e) {
            console.error("Error al cargar:", e);
            alert("Error crítico al cargar el test. Revisa la consola.");
            return;
        }
    } else {
        // Modo repetir falladas
        sessionQuestions = [...failedQuestions].sort(() => 0.5 - Math.random());
    }

    // Reset de variables para nueva sesión
    currentIdx = 0;
    successes = 0;
    errors = 0;
    failedQuestions = []; 
    
    document.getElementById("setup").classList.add("hidden");
    document.getElementById("results").classList.add("hidden");
    document.getElementById("quiz").classList.remove("hidden");
    renderQuestion();
}

/**
 * Muestra la pregunta actual
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
 * Controla el flujo del botón principal
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
 * Lógica de validación de respuestas
 */
function checkAnswer() {
    const item = sessionQuestions[currentIdx];
    const feedback = document.getElementById("feedback");
    let isCorrect = false;

    if (item.type === "text") {
        const userVal = document.getElementById("text-ans").value.trim().toLowerCase();
        isCorrect = userVal === item.correct.toLowerCase();
    } else {
        const selected = Array.from(document.querySelectorAll('input[name="ans"]:checked')).map(i => parseInt(i.value));
        if (item.type === "radio") {
            isCorrect = selected[0] === item.correct;
        } else {
            isCorrect = JSON.stringify(selected.sort()) === JSON.stringify(item.correct.sort());
        }

        // Estilos visuales para opciones
        document.querySelectorAll('#ans-container label').forEach((label, idx) => {
            const isChoiceCorrect = Array.isArray(item.correct) ? item.correct.includes(idx) : idx === item.correct;
            if (isChoiceCorrect) label.classList.add("correct");
            else if (label.querySelector('input').checked) label.classList.add("wrong");
            label.classList.add("disabled");
            label.querySelector('input').disabled = true;
        });
    }

    if (isCorrect) {
        successes++;
        feedback.innerText = "¡Correcto! ✨";
        feedback.style.color = "var(--success)";
    } else {
        errors++;
        failedQuestions.push(item); 
        const sol = item.type === "text" ? `Solución: ${item.correct}` : "Revisa las marcas verdes";
        feedback.innerText = `Incorrecto. ${sol}`;
        feedback.style.color = "var(--error)";
    }

    document.getElementById("count-success").innerText = successes;
    document.getElementById("count-error").innerText = errors;
    document.getElementById("main-btn").innerText = "Siguiente";
    state = "next";
}

/**
 * Permite al usuario terminar el examen manualmente
 */
function confirmExit() {
    if (confirm("¿Quieres finalizar el intento ahora? Calcularemos tu nota con lo que llevas.")) {
        const respondidas = currentIdx + (state === "next" ? 1 : 0);
        if (respondidas === 0) return location.reload();
        
        sessionQuestions = sessionQuestions.slice(0, respondidas);
        finishQuiz();
    }
}

/**
 * Finaliza el quiz y guarda historial
 */
function finishQuiz() {
    document.getElementById("quiz").classList.add("hidden");
    document.getElementById("results").classList.remove("hidden");
    document.getElementById("score-display").innerText = `${successes} / ${sessionQuestions.length}`;
    
    const ratio = successes / sessionQuestions.length;
    document.getElementById("final-msg").innerText = ratio >= 0.7 ? "¡Aprobado! Excelente trabajo." : "No has alcanzado el mínimo. ¡Sigue practicando!";
    
    const retryBtn = document.getElementById("retry-failed-btn");
    if (failedQuestions.length > 0) retryBtn.classList.remove("hidden");
    else retryBtn.classList.add("hidden");

    saveToHistory(successes, sessionQuestions.length, currentExamName);
}

/**
 * Persistencia en LocalStorage
 */
function saveToHistory(s, t, name) {
    let history = JSON.parse(localStorage.getItem('multi_cert_history') || '[]');
    const cleanName = name.split('(')[0].trim();
    history.unshift({ exam: cleanName, result: `${s}/${t}`, date: new Date().toLocaleDateString() });
    localStorage.setItem('multi_cert_history', JSON.stringify(history.slice(0, 5)));
    showHistory();
}

/**
 * Muestra los últimos 5 resultados
 */
function showHistory() {
    const history = JSON.parse(localStorage.getItem('multi_cert_history') || '[]');
    const list = document.getElementById("history-list");
    if (!list) return;

    list.innerHTML = history.length ? history.map(h => `
        <div class="history-item">
            <span>${h.exam} (${h.date})</span>
            <strong>${h.result}</strong>
        </div>
    `).join('') : "<p style='text-align:center; color:gray'>No hay historial disponible</p>";
}