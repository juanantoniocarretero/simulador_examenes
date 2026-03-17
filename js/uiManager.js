/**
 * Genera dinámicamente las opciones del selector de tiempo (Nuevo)
 */
export function setupSelectorTiempo() {
    const select = document.getElementById("timer-select");
    if (!select) return;
    
    const opciones = [
        { val: 0, text: "Sin límite de tiempo" },
        { val: 15, text: "15 Minutos" },
        { val: 30, text: "30 Minutos" },
        { val: 60, text: "60 Minutos" },
        { val: 90, text: "90 Minutos" }
    ];

    select.innerHTML = opciones
        .map(opt => `<option value="${opt.val}">${opt.text}</option>`)
        .join('');
}

/**
 * Genera dinámicamente las opciones del selector de 20 en 20
 */
export function setupSelectorPreguntas() {
    const select = document.getElementById("num-questions");
    if (!select) return;
    select.innerHTML = ""; 
    for (let i = 0; i <= 200; i += 20) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = (i === 0) ? "Todas las disponibles" : `${i} preguntas`;
        select.appendChild(opt);
    }
}

/**
 * Genera la tabla detallada de resultados final
 */
export function renderDetailedReport(userAnswers, total) {
    let html = `
    <table style="width:100%; border-collapse: collapse; margin-top:20px;">
        <thead>
            <tr>
                <th>#</th>
                <th>Pregunta</th>
                <th>Tu respuesta</th>
                <th>Correcta</th>
                <th>Estado</th>
                <th>🚩</th> 
            </tr>
        </thead>
        <tbody>`;

    userAnswers.forEach((ans, idx) => {
        // Si la pregunta fue marcada como duda, le damos un color de fondo especial
        const rowStyle = ans.wasFlagged ? 'style="background-color: #fff3cd;"' : '';
        
        html += `
            <tr ${rowStyle}>
                <td>${idx + 1}</td>
                <td>${ans.question}</td>
                <td>${ans.user}</td>
                <td>${ans.correct}</td>
                <td>${ans.status}</td>
                <td>${ans.wasFlagged ? '🚩' : ''}</td>
            </tr>`;
    });

    html += `</tbody></table>`;
    return html;
}