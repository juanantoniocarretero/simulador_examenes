import * as storage from './storage.js';
import * as ui from './uiManager.js';

let allQuestions = [];
let sessionQuestions = [];
let failedQuestions = []; 
let userAnswers = []; 
let currentIdx = 0;
let successes = 0;
let errors = 0;
let state = "check"; 
let currentExamName = "";

window.onload = () => {
    showHistory();
    ui.setupSelectorPreguntas();
};

async function initQuiz(onlyFailed = false) {
    if (!onlyFailed) {
        const examFile = document.getElementById("exam-select").value;
        const limit = parseInt(document.getElementById("num-questions").value);
        currentExamName = document.getElementById("exam-select").options[document.getElementById("exam-select").selectedIndex].text;

        try {
            const res = await fetch(examFile);
            if (!res.ok) { window.location.href = "404.html"; return; }
            allQuestions = await res.json();
            let shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
            sessionQuestions = (limit === 0) ? shuffled : shuffled.slice(0, limit);
        } catch (e) {
            alert("Error al cargar el archivo JSON.");
            return;
        }
    } else {
        sessionQuestions = [...failedQuestions].sort(() => 0.5 - Math.random());
    }

    currentIdx = 0; successes = 0; errors = 0;
    failedQuestions = []; userAnswers = [];
    
    document.getElementById("setup").classList.add("hidden");
    document.getElementById("results").classList.add("hidden");
    document.getElementById("quiz").classList.remove("hidden");
    renderQuestion();
}

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
        input.type = "text"; input.id = "text-ans"; input.autocomplete = "off";
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

function handleMainAction() {
    if (state === "check") checkAnswer();
    else {
        currentIdx++;
        if (currentIdx < sessionQuestions.length) renderQuestion();
        else finishQuiz();
    }
}

function checkAnswer() {
    const item = sessionQuestions[currentIdx];
    const feedback = document.getElementById("feedback");
    let isCorrect = false;
    let userText = ""; let correctText = "";

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
        document.querySelectorAll('#ans-container label').forEach((l, idx) => {
            const isOk = Array.isArray(item.correct) ? item.correct.includes(idx) : idx === item.correct;
            if (isOk) l.classList.add("correct");
            else if (l.querySelector('input').checked) l.classList.add("wrong");
            l.classList.add("disabled"); l.querySelector('input').disabled = true;
        });
    }

    userAnswers.push({ question: item.q, user: userText, correct: correctText, status: isCorrect ? "✅" : "❌" });

    if (isCorrect) { successes++; feedback.innerText = "¡Correcto! ✨"; feedback.style.color = "var(--success)"; }
    else { errors++; failedQuestions.push(item); feedback.innerText = "Incorrecto."; feedback.style.color = "var(--error)"; }
    
    document.getElementById("main-btn").innerText = "Siguiente";
    state = "next";
}

function finishQuiz() {
    document.getElementById("quiz").classList.add("hidden");
    const resDiv = document.getElementById("results");
    resDiv.classList.remove("hidden");
    document.getElementById("score-display").innerText = `${successes} / ${sessionQuestions.length}`;
    
    // Insertar reporte detallado
    const oldRep = document.getElementById("detailed-report");
    if(oldRep) oldRep.remove();
    const reportHTML = ui.renderDetailedReport(userAnswers, sessionQuestions.length);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = reportHTML;
    resDiv.insertBefore(wrapper, resDiv.querySelector("button").parentNode.nextSibling);

    const retryBtn = document.getElementById("retry-failed-btn");
    if (failedQuestions.length > 0) retryBtn.classList.remove("hidden");
    else retryBtn.classList.add("hidden");

    storage.saveToHistory(successes, sessionQuestions.length, currentExamName, document.getElementById("exam-select").value, document.getElementById("num-questions").value);
    showHistory();
}

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

function retryFromHistory(index) {
    const history = storage.getHistory();
    const record = history[index];
    if (record) {
        document.getElementById("exam-select").value = record.file;
        document.getElementById("num-questions").value = record.limit;
        initQuiz(false);
    }
}

// Hacer funciones disponibles para el HTML
window.initQuiz = initQuiz;
window.handleMainAction = handleMainAction;
window.confirmExit = () => { if(confirm("¿Finalizar ya?")) { sessionQuestions = sessionQuestions.slice(0, currentIdx + (state === "next" ? 1 : 0)); finishQuiz(); } };
window.retryFromHistory = retryFromHistory;