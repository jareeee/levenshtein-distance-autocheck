const USERS_DICTIONARY_URL = 'indonesian-wordlist-master/00-indonesian-wordlist.lst';

let dictionary = [];
let chartInstance = null;
let isLoaded = false;

async function init() {
    const statusMsg = document.getElementById('benchmarkStatus');
    statusMsg.textContent = 'Memuat kamus kata...';
    
    const response = await fetch(USERS_DICTIONARY_URL);
    const text = await response.text();
    dictionary = text.split('\n').map(w => w.trim()).filter(w => w.length > 0);
    isLoaded = true;
    statusMsg.textContent = `Kamus dimuat (${dictionary.length} kata). Siap.`;

    setupEvents();
}

function setupEvents() {
    const input = document.getElementById('wordInput');
    const btnBenchmark = document.getElementById('btnBenchmark');

    let timeout;
    input.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        clearTimeout(timeout);
        
        if (val.length === 0) {
            document.getElementById('suggestionBox').classList.add('hidden');
            return;
        }

        timeout = setTimeout(() => {
            findSuggestion(val);
        }, 300);
    });

    btnBenchmark.addEventListener('click', runBenchmark);
}

function findSuggestion(inputWord) {
    if (!isLoaded || dictionary.length === 0) return;

    let minDistance = Infinity;
    let closestWord = '';
    
    // Iterative Search
    const startIter = performance.now();
    for (let word of dictionary) {
        if (Math.abs(word.length - inputWord.length) > 3) continue;

        const dist = levenshteinIterative(inputWord, word);
        if (dist < minDistance) {
            minDistance = dist;
            closestWord = word;
        }
        if (dist === 0) break;
    }
    const endIter = performance.now();
    const timeIter = (endIter - startIter).toFixed(2);

    // Recursive Search
    let timeRec = "Skipped (> 8 chars)";
    if (inputWord.length <= 8) {
        const startRec = performance.now();
        let minDistRec = Infinity;
        
        for (let word of dictionary) {
             if (Math.abs(word.length - inputWord.length) > 3) continue;

             const dist = levenshteinRecursive(inputWord, word);
             if (dist < minDistRec) minDistRec = dist;
             if (dist === 0) break;
        }
        const endRec = performance.now();
        timeRec = (endRec - startRec).toFixed(2);
    }

    displayResult(closestWord, minDistance, timeIter, timeRec);
}

function levenshteinRecursive(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    if (a[0] === b[0]) {
        return levenshteinRecursive(a.slice(1), b.slice(1));
    }

    return 1 + Math.min(
        levenshteinRecursive(a.slice(1), b),    // Deletion
        levenshteinRecursive(a, b.slice(1)),    // Insertion
        levenshteinRecursive(a.slice(1), b.slice(1)) // Substitution
    );
}

function levenshteinIterative(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // Substitution
                    matrix[i][j - 1] + 1,     // Insertion
                    matrix[i - 1][j] + 1      // Deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

function displayResult(word, dist, timeIter, timeRec) {
    const box = document.getElementById('suggestionBox');
    const res = document.getElementById('result');
    const stats = document.getElementById('stats');

    res.textContent = word;
    stats.innerHTML = `
        <strong>Jarak Levenshtein:</strong> ${dist}<br>
        <strong>Waktu Iteratif:</strong> ${timeIter} ms<br>
        <strong>Waktu Recursive:</strong> ${timeRec} ms ${timeRec.includes('Skipped') ? '<small>(dibatasi demi keamanan browser)</small>' : ''}
    `;
    box.classList.remove('hidden');
}

async function runBenchmark() {
    const btn = document.getElementById('btnBenchmark');
    const status = document.getElementById('benchmarkStatus');
    const analysis = document.getElementById('analysisResult');
    const inputVal = document.getElementById('wordInput').value.trim();

    if (!inputVal) {
        alert("Harap ketik kata di input box terlebih dahulu!");
        return;
    }
    
    btn.disabled = true;
    analysis.classList.add('hidden');
    status.textContent = "Sedang menjalankan benchmark...";

    const lengths = [];
    for (let i = 1; i <= inputVal.length; i++) {
        lengths.push(i);
    }
    
    const dataRecursive = [];
    const dataDP = [];

    
    // 1. Recursive Benchmark
    for (let len of lengths) {
        // Limit Recursive Search to small lengths to avoid browser crash
        // Searching 30k words with O(3^n) is very heavy.
        if (len > 8) break;

        const subInput = inputVal.substring(0, len);
        
        status.textContent = `Running Recursive (n=${len})...`;
        await new Promise(r => setTimeout(r, 10));

        const start = performance.now();

        let minDistRec = Infinity;
        for (let word of dictionary) {
             if (Math.abs(word.length - subInput.length) > 3) continue;
             
             const dist = levenshteinRecursive(subInput, word);
             if (dist < minDistRec) minDistRec = dist;
             if (dist === 0) break;
        }

        const end = performance.now();
        dataRecursive.push({ x: len, y: end - start });
    }

    // 2. Iteratif Benchmark
    for (let len of lengths) {
        const subInput = inputVal.substring(0, len);

        status.textContent = `Running Iteratif (n=${len})...`;
        await new Promise(r => setTimeout(r, 10));

        const start = performance.now();

        let minDistance = Infinity;
        for (let word of dictionary) {
            if (Math.abs(word.length - subInput.length) > 3) continue;

            const dist = levenshteinIterative(subInput, word);
            if (dist < minDistance) minDistance = dist;
            if (dist === 0) break;
        }

        const end = performance.now();
        dataDP.push({ x: len, y: end - start });
    }

    status.textContent = "Benchmark selesai!";
    btn.disabled = false;
    analysis.classList.remove('hidden');

    renderChart(lengths, dataRecursive, dataDP);
}

function renderChart(labels, recData, dpData) {
    const ctx = document.getElementById('algoChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels, 
            datasets: [
                {
                    label: 'Recursive',
                    data: recData,
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    tension: 0.4,
                    spanGaps: false
                },
                {
                    label: 'Iteratif',
                    data: dpData,
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Panjang Karakter (n)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Waktu Eksekusi (ms)'
                    },
                    type: 'logarithmic',
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toFixed(4) + ' ms';
                        }
                    }
                }
            }
        }
    });
}

init();
