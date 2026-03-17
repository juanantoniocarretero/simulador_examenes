/**
 * Guarda el resultado en LocalStorage incluyendo parámetros para repetición
 */
export function saveToHistory(s, t, name, examFile, limit) {
    let history = JSON.parse(localStorage.getItem('multi_cert_history') || '[]');
    const newEntry = {
        exam: name.split('(')[0].trim(),
        result: `${s}/${t}`,
        date: new Date().toLocaleDateString(),
        file: examFile,
        limit: limit
    };
    history.unshift(newEntry);
    localStorage.setItem('multi_cert_history', JSON.stringify(history.slice(0, 5)));
}

/**
 * Obtiene el historial guardado
 */
export function getHistory() {
    return JSON.parse(localStorage.getItem('multi_cert_history') || '[]');
}