// Variables globales de estado
let allQuestions = [];
let sessionQuestions = [];
let failedQuestions = []; 
let currentIdx = 0;
let successes = 0;
let errors = 0;
let state = "check"; 
let currentExamName = "";

// Al cargar la página, inicializamos historial y generamos el selector de preguntas
window.onload = () => {
    showHistory();
    setupSelectorPreguntas();
};

/**
 * Genera dinámicamente las opciones del selector de 20 en 20 hasta 200
 */
function setupSelectorPreguntas() {
    const select = document.getElementById("num-questions");
    if (!select) return;

    select.innerHTML = ""; // Limpiar contenido previo

    for (let i = 0; i <= 200; i += 20) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = (i === 0) ? "Todas las disponibles" : `${i} preguntas`;
        select.appendChild(opt);
    }
}

/**
 * Inicializa el quiz cargando el JSON o las fallidas
 * Incluye verificación de existencia del archivo (Redirección 404)
 */
async function initQuiz(onlyFailed = false) {
    if (!onlyFailed) {
        const examFile = document.getElementById("exam-select").value;
        const limit = parseInt(document.getElementById("num-questions").value);
        currentExamName = document.getElementById("exam-select").options[document.getElementById("exam-select").selectedIndex].text;

        try {
            const res = await fetch(examFile);
            
            // VERIFICACIÓN: Si el archivo no existe (error 404), redirigimos a la página de error
            if (!res.ok) {
                window.location.href = "404.html";
                return;
            }

            allQuestions = await res.json();
            let shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
            
            // Si el límite es 0, usamos todas las preguntas del JSON
            sessionQuestions = (limit === 0) ? shuffled : shuffled.slice(0, limit);
        } catch (e) {
            console.error("Error al cargar:", e);
            alert("Error al cargar el archivo JSON.");
            return;
        }
    } else {
        // Modo repetir preguntas falladas
        sessionQuestions = [...failedQuestions].sort(() => 0.5 - Math.random());
    }

    // Resetear contadores y estado
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
        
        // Permitir check con la tecla Enter
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

        // Marcar opciones correctas/incorrectas visualmente
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
        const sol = item.type === "text" ? `Solución: ${item.correct}` : "Ver opciones en verde";
        feedback.innerText = `Incorrecto. ${sol}`;
        feedback.style.color = "var(--error)";
    }

    document.getElementById("count-success").innerText = successes;
    document.getElementById("count-error").innerText = errors;
    document.getElementById("main-btn").innerText = "Siguiente";
    state = "next";
}

/**
 * Lógica para finalizar el intento antes de tiempo
 */
function confirmExit() {
    if (confirm("¿Deseas finalizar el examen ahora? Se guardará el progreso de las respondidas.")) {
        const answeredSoFar = currentIdx + (state === "next" ? 1 : 0);
        
        if (answeredSoFar === 0) {
            location.reload();
            return;
        }

        sessionQuestions = sessionQuestions.slice(0, answeredSoFar);
        finishQuiz();
    }
}

/**
 * Finaliza el quiz y muestra pantalla de resultados
 */
function finishQuiz() {
    document.getElementById("quiz").classList.add("hidden");
    document.getElementById("results").classList.remove("hidden");
    document.getElementById("score-display").innerText = `${successes} / ${sessionQuestions.length}`;
    
    const ratio = successes / sessionQuestions.length;
    document.getElementById("final-msg").innerText = ratio >= 0.7 ? "¡Excelente! Nivel de examen." : "Sigue intentándolo.";
    
    // Mostrar botón de re-intento si hay fallos
    const retryBtn = document.getElementById("retry-failed-btn");
    if (failedQuestions.length > 0) retryBtn.classList.remove("hidden");
    else retryBtn.classList.add("hidden");

    saveToHistory(successes, sessionQuestions.length, currentExamName);
}

/**
 * Guarda el resultado en LocalStorage incluyendo parámetros para repetición
 */
function saveToHistory(s, t, name) {
    let history = JSON.parse(localStorage.getItem('multi_cert_history') || '[]');
    const examFile = document.getElementById("exam-select").value;
    const limit = document.getElementById("num-questions").value;

    const newEntry = {
        exam: name.split('(')[0].trim(),
        result: `${s}/${t}`,
        date: new Date().toLocaleDateString(),
        file: examFile, // Guardado para repetir examen
        limit: limit    // Guardado para repetir examen
    };

    history.unshift(newEntry);
    localStorage.setItem('multi_cert_history', JSON.stringify(history.slice(0, 5)));
    showHistory();
}

/**
 * Muestra el historial y permite hacer clic para repetir
 */
function showHistory() {
    const history = JSON.parse(localStorage.getItem('multi_cert_history') || '[]');
    const list = document.getElementById("history-list");
    if (!list) return;

    list.innerHTML = history.length ? history.map((h, index) => `
        <div class="history-item" onclick="retryFromHistory(${index})" style="cursor:pointer; transition: background 0.2s;">
            <span>${h.exam} (${h.date}) <small style="color:var(--accent)">↩ Repetir</small></span>
            <strong>${h.result}</strong>
        </div>
    `).join('') : "<p style='text-align:center; color:gray'>Sin intentos</p>";
}

/**
 * Carga un examen específico del historial
 */
function retryFromHistory(index) {
    const history = JSON.parse(localStorage.getItem('multi_cert_history') || '[]');
    const record = history[index];

    if (record) {
        document.getElementById("exam-select").value = record.file;
        document.getElementById("num-questions").value = record.limit;
        initQuiz(false);
    }
}