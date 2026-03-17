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
export function renderDetailedReport(userAnswers, sessionLength) {
    let reportHTML = `
        <div id="detailed-report" style="margin-top: 25px; text-align: left; border-top: 2px solid #eee; padding-top: 20px;">
            <h3 style="text-align:center">Revisión del Intento</h3>
            <div style="overflow-x: auto;">
                <table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead>
                        <tr style="background:#f8f9fa;">
                            <th style="padding:10px; border:1px solid #ddd;">Pregunta</th>
                            <th style="padding:10px; border:1px solid #ddd;">Tu Respuesta</th>
                            <th style="padding:10px; border:1px solid #ddd;">Resultado</th>
                        </tr>
                    </thead>
                    <tbody>`;

    userAnswers.forEach(ans => {
        const rowColor = ans.status === "✅" ? "#f0fff4" : "#fff5f5";
        reportHTML += `
            <tr style="background: ${rowColor}">
                <td style="padding:10px; border:1px solid #ddd;">${ans.question}</td>
                <td style="padding:10px; border:1px solid #ddd;">
                    ${ans.user} 
                    ${ans.status === "❌" ? `<br><small style="color:var(--success)"><b>Correcta:</b> ${ans.correct}</small>` : ""}
                </td>
                <td style="padding:10px; border:1px solid #ddd; text-align:center">${ans.status}</td>
            </tr>`;
    });

    reportHTML += `</tbody></table></div></div>`;
    return reportHTML;
}