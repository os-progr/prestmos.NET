// CONSTANTS
const PENALTY_PER_DAY = 0.50; // S/ 0.50 mora por día
const WA_TEXT_TEMPLATE = "¡Hola! 🧾 Confirmación de Abono.\n\n👤 Cliente: {name}\n💰 Abono: S/ {amount}\n💳 Saldo Anterior: S/ {prev}\n📉 Nuevo Saldo: S/ {newTotal}\n\nGracias por su pago.";
const PIN_CODE = 'edith2007';
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutos de inactividad
let inactivityTimer;

// DOM Elements
const form = document.getElementById('loan-form');
const editIdInput = document.getElementById('edit-id');
const clientNameInput = document.getElementById('clientName');
const clientDniInput = document.getElementById('clientDni');
const clientPhoneInput = document.getElementById('clientPhone');
const clientAddressInput = document.getElementById('clientAddress');
const clientCipInput = document.getElementById('clientCip');
const clientWorkInput = document.getElementById('clientWork');
const loanAmountInput = document.getElementById('loanAmount');
const interestRateInput = document.getElementById('interestRate');
const interestModeSelect = document.getElementById('interestMode');
const interestLabel = document.getElementById('interest-label');
const interestIcon = document.getElementById('interest-icon');
const loanDateInput = document.getElementById('loanDate');
const dueDateInput = document.getElementById('dueDate');

const previewTotal = document.getElementById('preview-total');

const searchInput = document.getElementById('searchInput');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const formTitle = document.getElementById('form-title');
const exportBtn = document.getElementById('export-btn');
const backupBtn = document.getElementById('backup-btn');
const importJson = document.getElementById('import-json');

// Table and Metrics
const loansTbody = document.getElementById('loans-tbody');
const emptyState = document.getElementById('empty-state');
const tableEl = document.getElementById('loans-table');
const totalLentEl = document.getElementById('total-lent');
const totalInterestEl = document.getElementById('total-interest');
const totalPenaltiesEl = document.getElementById('total-penalties');
const clientsCountEl = document.getElementById('clients-count');

const archiveTbody = document.getElementById('archive-tbody');
const archiveContent = document.getElementById('archive-content');
const toggleArchiveBtn = document.getElementById('toggle-archive-btn');
const archiveEmptyState = document.getElementById('archive-empty-state');

// Payments, etc.

// Payment Modal
const payLoanId = document.getElementById('pay-loan-id');
const payAmountInput = document.getElementById('pay-amount');
const payDateInput = document.getElementById('pay-date');
const payClientName = document.getElementById('pay-client-name');
const payRemaining = document.getElementById('pay-remaining');
const payForm = document.getElementById('pay-form');
const payHistoryList = document.getElementById('pay-history');
const payQuotaInfo = document.getElementById('pay-quota-info');

// WhatsApp Voucher
const vDate = document.getElementById('v-date');
const vClient = document.getElementById('v-client');
const vAmount = document.getElementById('v-amount');
const vPrev = document.getElementById('v-prev');
const vNew = document.getElementById('v-new');
const shareWaBtn = document.getElementById('share-wa-btn');

// Theme setup elements
const themeToggleBtn = document.getElementById('theme-toggle');
const logoutBtn = document.getElementById('logout-btn');
const loginOverlay = document.getElementById('login-overlay');
const loginFormAuth = document.getElementById('login-form-auth');
const pinInput = document.getElementById('pin-input');
const loginError = document.getElementById('login-error');
const dashboardMain = document.querySelector('.dashboard-container');

// File Uploads
const loanFilesInput   = document.getElementById('loan-files');
const filesModal       = document.getElementById('files-modal');
const filesList        = document.getElementById('files-list');
const filesEmpty       = document.getElementById('files-empty');
const filesClientName  = document.getElementById('files-client-name');
const addMoreFilesInput = document.getElementById('add-more-files');
const currentFilesLoanId = { value: null };

// #I - Notes
const loanNotesInput = document.getElementById('loanNotes');

// App State
let db;
let loans = [];
let currentWaMessage = "";
let currentWaPhone = "";
let portfolioChart = null;
let dueChart = null;            // #E
let sortState = { col: null, asc: true }; // #7 sort
let isCompactMode = false;       // #K
let currentFilter = 'all';      // #G

/* =========================================
   CUSTOM MODAL SYSTEM - #C
========================================= */
function showConfirm(message, onConfirm, onCancel) {
    const modal = document.getElementById('custom-confirm-modal');
    document.getElementById('confirm-msg').textContent = message;
    modal.classList.remove('hidden');

    const okBtn     = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    const cleanup = () => modal.classList.add('hidden');

    okBtn.onclick = () => { cleanup(); if (onConfirm) onConfirm(); };
    cancelBtn.onclick = () => { cleanup(); if (onCancel) onCancel(); };
}

function showAlert(message, type = 'info') {
    const modal = document.getElementById('custom-alert-modal');
    document.getElementById('alert-msg').textContent = message;
    // Color by type
    const icon = document.getElementById('alert-icon');
    if (type === 'danger')  { icon.setAttribute('data-lucide','alert-triangle'); icon.style.color = 'var(--danger)'; }
    else if (type === 'success') { icon.setAttribute('data-lucide','check-circle'); icon.style.color = 'var(--success)'; }
    else { icon.setAttribute('data-lucide','info'); icon.style.color = 'var(--info)'; }
    lucide.createIcons();
    modal.classList.remove('hidden');
    document.getElementById('alert-ok-btn').onclick = () => modal.classList.add('hidden');
}

// Initialize App
function init() {
    loginFormAuth.addEventListener('submit', handleLogin);
    checkAuth();
    setupInactivityTimer();
}

function startApp() {
    // Default dates
    const today = new Date();
    loanDateInput.valueAsDate = today;
    
    const nextMonth = new Date(today);
    nextMonth.setDate(nextMonth.getDate() + 30);
    dueDateInput.valueAsDate = nextMonth;
    
    initDB().then(() => {
        loadDataFromDB();
    }).catch(err => {
        console.error("Error IDB:", err);
        showAlert("Tu navegador no soporta IndexedDB.", 'danger');
    });

    initChart();
    initDueChart(); // #E

    loanAmountInput.addEventListener('input', updatePreview);
    interestRateInput.addEventListener('input', updatePreview);
    loanDateInput.addEventListener('change', updatePreview);
    dueDateInput.addEventListener('change', updatePreview);

    form.addEventListener('submit', handleAddOrEditLoan);
    searchInput.addEventListener('input', handleSearch);
    exportBtn.addEventListener('click', exportToCSV);
    backupBtn.addEventListener('click', exportToJSON);
    importJson.addEventListener('change', importFromJSON);
    
    payForm.addEventListener('submit', handleAddPayment);

    interestModeSelect.addEventListener('change', () => {
        const isFixed = interestModeSelect.value === 'fixed';
        interestLabel.textContent = isFixed ? 'S/' : '%';
        interestIcon.setAttribute('data-lucide', isFixed ? 'banknote' : 'percent');
        lucide.createIcons();
        updatePreview();
    });
    shareWaBtn.addEventListener('click', sendWaMessage);

    // File input listeners
    loanFilesInput.addEventListener('change', (e) => {
        const fileLabel = document.querySelector('label[for="loan-files"]');
        if (e.target.files.length > 0) {
            fileLabel.classList.add('has-file');
            fileLabel.innerHTML = `<i data-lucide="check-circle"></i> ${e.target.files.length} archivos seleccionados`;
        } else {
            fileLabel.classList.remove('has-file');
            fileLabel.innerHTML = '<i data-lucide="paperclip"></i> Seleccionar Archivos';
        }
        lucide.createIcons();
    });

    addMoreFilesInput.addEventListener('change', (e) => {
        const fileLabel = document.querySelector('label[for="add-more-files"]');
        if (e.target.files.length > 0) {
            fileLabel.classList.add('has-file');
            fileLabel.innerHTML = `<i data-lucide="check-circle"></i> ${e.target.files.length} seleccionados`;
        } else {
            fileLabel.classList.remove('has-file');
            fileLabel.innerHTML = '<i data-lucide="plus"></i> Seleccionar';
        }
        lucide.createIcons();
    });
    
    // #K - Compact table toggle
    const compactBtn = document.getElementById('compact-toggle-btn');
    if (compactBtn) {
        compactBtn.addEventListener('click', () => {
            isCompactMode = !isCompactMode;
            tableEl.classList.toggle('table-compact', isCompactMode);
            compactBtn.title = isCompactMode ? 'Vista normal' : 'Vista compacta';
            compactBtn.innerHTML = isCompactMode
                ? '<i data-lucide="maximize-2"></i>'
                : '<i data-lucide="minimize-2"></i>';
            lucide.createIcons();
        });
    }

    toggleArchiveBtn.addEventListener('click', () => {
        archiveContent.classList.toggle('hidden');
        toggleArchiveBtn.textContent = archiveContent.classList.contains('hidden') ? 'Mostrar' : 'Ocultar';
    });
    
    // Theme setup
    const savedTheme = localStorage.getItem('capitalflow_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeToggleBtn.innerHTML = '<i data-lucide="moon" style="width: 16px; height: 16px;"></i>';
    }
    
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('capitalflow_theme', isLight ? 'light' : 'dark');
        themeToggleBtn.innerHTML = isLight ? '<i data-lucide="moon" style="width: 16px; height: 16px;"></i>' : '<i data-lucide="sun" style="width: 16px; height: 16px;"></i>';
        lucide.createIcons();
        if (portfolioChart) {
            Chart.defaults.color = isLight ? '#475569' : '#94A3B8';
            portfolioChart.update();
        }
    });

    logoutBtn.addEventListener('click', handleLogout);
}

/* =========================================
   SECURITY LOGIC
========================================= */
function checkAuth() {
    const isAuth = sessionStorage.getItem('loanAppAuth') === 'true';
    if (isAuth) {
        loginOverlay.style.display = 'none';
        dashboardMain.style.display = 'flex'; // It's a flex container in CSS
        startApp();
    } else {
        loginOverlay.style.display = 'flex';
        dashboardMain.style.display = 'none';
    }
}

function handleLogin(e) {
    e.preventDefault();
    const pin = pinInput.value;
    if (pin === PIN_CODE) {
        sessionStorage.setItem('loanAppAuth', 'true');
        loginError.classList.add('hidden');
        pinInput.value = '';
        checkAuth();
    } else {
        loginError.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();
    }
}

function handleLogout() {
    if(confirm('¿Seguro que deseas bloquear el sistema?')) {
        forceLogout();
    }
}

function forceLogout() {
    sessionStorage.removeItem('loanAppAuth');
    location.reload(); // Hard reload to clear all state
}

function setupInactivityTimer() {
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    events.forEach(event => {
        window.addEventListener(event, resetInactivityTimer);
    });
    resetInactivityTimer();
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (sessionStorage.getItem('loanAppAuth') === 'true') {
        inactivityTimer = setTimeout(() => {
            forceLogout();
        }, INACTIVITY_TIMEOUT);
    }
}

function refreshIcons() {
    try {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (e) {
        console.warn("Lucide not ready", e);
    }
}

/* =========================================
   CHART.JS LOGIC
========================================= */
function initChart() {
    const ctx = document.getElementById('portfolioChart');
    if(!ctx) return;
    
    Chart.defaults.color = '#94A3B8';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    portfolioChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Capital Base', 'Interés Esperado', 'Mora Acum.'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(0, 228, 161, 0.85)',  // Accent Green
                    'rgba(30, 144, 255, 0.85)', // Info Blue
                    'rgba(255, 71, 87, 0.85)'   // Danger Red
                ],
                borderColor: [
                    '#030405', '#030405', '#030405'
                ],
                borderWidth: 2,
                hoverOffset: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(20, 22, 25, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return ' S/ ' + context.parsed.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

function updateChartData(capital, interest, mora) {
    if(portfolioChart) {
        portfolioChart.data.datasets[0].data = [capital, interest, mora];
        portfolioChart.update();
    }
}

/* =========================================
   DUE CHART - #E
========================================= */
function initDueChart() {
    const ctx = document.getElementById('dueChart');
    if (!ctx) return;

    dueChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Por cobrar S/', data: [], backgroundColor: 'rgba(0, 228, 161, 0.7)', borderColor: 'rgba(0, 228, 161, 1)', borderRadius: 6, borderWidth: 0 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' S/ ' + c.parsed.y.toFixed(2) } } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8', font: { size: 10 } } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8', font: { size: 10 }, callback: v => 'S/ ' + v } }
            }
        }
    });
}

function renderDueChart() {
    if (!dueChart) return;
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const today  = new Date();
    const labels = [];
    const data   = [];

    for (let i = 0; i < 6; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        labels.push(months[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2));
        const monthYear = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        let total = 0;
        loans.forEach(l => {
            if (l.isArchived) return;
            if (l.dueDate && l.dueDate.startsWith(monthYear)) {
                const { restante } = getLoanSummary(l);
                if (restante > 0) total += restante;
            }
        });
        data.push(parseFloat(total.toFixed(2)));
    }

    dueChart.data.labels = labels;
    dueChart.data.datasets[0].data = data;
    dueChart.update();
}

/* =========================================
   CLIENT HISTORY MODAL - #H
========================================= */
window.openClientModal = function(name) {
    const modal  = document.getElementById('client-modal');
    const title  = document.getElementById('client-modal-name');
    const body   = document.getElementById('client-modal-body');
    if (!modal) return;

    const clientLoans = loans.filter(l => l.name === name);
    title.textContent = name;

    let totalBorrowed = 0, totalPaid = 0, totalDue = 0;
    let html = '';

    clientLoans.forEach(l => {
        const { abonado, restante, mora } = getLoanSummary(l);
        totalBorrowed += l.amount || 0;
        totalPaid     += abonado;
        totalDue      += restante;
        const statusCls = l.isArchived ? 'status-paid' : restante <= 0 ? 'status-paid' : 'status-warn';
        const statusLbl = l.isArchived ? 'Cerrado' : restante <= 0 ? 'Saldado' : 'Activo';
        html += `
        <div class="client-loan-card">
            <div class="client-loan-header">
                <span class="status-badge ${statusCls}">${statusLbl}</span>
                <span class="text-muted text-sm">${formatObjDate(l.date)} → ${formatObjDate(l.dueDate)}</span>
            </div>
            <div class="client-loan-row">
                <span>Capital</span><strong>S/ ${(l.amount||0).toFixed(2)}</strong>
            </div>
            <div class="client-loan-row">
                <span>Total con interés</span><strong>S/ ${(l.total||0).toFixed(2)}</strong>
            </div>
            <div class="client-loan-row">
                <span>Abonado</span><strong class="text-accent">S/ ${abonado.toFixed(2)}</strong>
            </div>
            <div class="client-loan-row">
                <span>Restante</span><strong class="${restante>0?'text-danger':'text-muted'}">S/ ${restante.toFixed(2)}</strong>
            </div>
            ${l.notes ? `<div class="client-loan-note"><i data-lucide="file-text" style="width:12px;"></i> ${l.notes}</div>` : ''}
        </div>`;
    });

    body.innerHTML = `
        <div class="client-summary-bar">
            <div><span class="text-muted text-sm">Préstamos</span><strong>${clientLoans.length}</strong></div>
            <div><span class="text-muted text-sm">Total prestado</span><strong>S/ ${totalBorrowed.toFixed(2)}</strong></div>
            <div><span class="text-muted text-sm">Total pagado</span><strong class="text-accent">S/ ${totalPaid.toFixed(2)}</strong></div>
            <div><span class="text-muted text-sm">Saldo pendiente</span><strong class="${totalDue>0?'text-danger':'text-muted'}">S/ ${totalDue.toFixed(2)}</strong></div>
        </div>
        ${html || '<p class="text-muted text-sm" style="text-align:center;padding:1rem;">Sin préstamos registrados.</p>'}`;

    lucide.createIcons();
    modal.classList.remove('hidden');
};

/* =========================================
   INDEXED DB LOGIC
========================================= */
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LoanManagerDBV2', 1);
        request.onupgradeneeded = (e) => {
            const tempDb = e.target.result;
            if (!tempDb.objectStoreNames.contains('loans')) {
                tempDb.createObjectStore('loans', { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => { db = e.target.result; resolve(); };
        request.onerror = (e) => reject(e.target.error);
    });
}

function loadDataFromDB() {
    const transaction = db.transaction(['loans'], 'readonly');
    const store = transaction.objectStore('loans');
    const request = store.getAll();

    request.onsuccess = () => {
        let results = request.result || [];
        loans = results.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

        // #1 – Migrate legacy loans that don't have months saved
        const migratePromises = [];
        loans.forEach(l => {
            if (!l.abonos)  l.abonos  = [];
            if (!l.dueDate) l.dueDate = l.date;
            if (!l.quotas)  l.quotas  = 1;
            if (!l.months && l.date && l.dueDate) {
                l.months = calcMonths(l.date, l.dueDate);
                const m = l.months;
                const r = l.interestVal || 0;
                const a = l.amount || 0;
                if (l.interestMode === 'fixed') {
                    l.interest = r * m;
                } else {
                    l.interest = a * (r / 100) * m;
                }
                l.total = a + l.interest;
                migratePromises.push(putLoanToDB(l));
            }
        });
        Promise.all(migratePromises).then(() => {
            renderTable(loans);
            updateMetrics();
        });
    };
}

function putLoanToDB(loanObj) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['loans'], 'readwrite');
        const store = transaction.objectStore('loans');
        const request = store.put(loanObj);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

function deleteLoanFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['loans'], 'readwrite');
        const store = transaction.objectStore('loans');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

/* =========================================
   CALCULATIONS
========================================= */
// Calcula los meses completos entre dos fechas (mínimo 1)
function calcMonths(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return 1;
    const start = new Date(startDateStr + 'T12:00:00');
    const end   = new Date(endDateStr   + 'T12:00:00');
    if (end <= start) return 1;
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(1, months);
}

function calcTotalPay(amount, rate, mode = 'percent', months = 1) {
    const a = Number(amount) || 0;
    const r = Number(rate)   || 0;
    const m = Math.max(1, Number(months) || 1);
    if (mode === 'fixed') {
        // Interés fijo = monto fijo × meses
        return a + (r * m);
    }
    // Interés porcentual = capital × (tasa/100) × meses
    const interest = a * (r / 100) * m;
    return a + interest;
}

function calculatePenalty(loan) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(loan.dueDate + 'T12:00:00');
    
    const diffTime = today - due;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const abonado = loan.abonos ? loan.abonos.reduce((sum, a) => sum + (Number(a.amount) || 0), 0) : 0;
    const baseRestante = (Number(loan.total) || 0) - abonado;

    let mora = 0;
    if (diffDays > 0 && baseRestante > 0) {
        mora = diffDays * PENALTY_PER_DAY;
    }

    return { diffDays, mora, baseRestante };
}

function getLoanSummary(loan) {
    const { mora, baseRestante, diffDays } = calculatePenalty(loan);
    const abonado = loan.abonos ? loan.abonos.reduce((sum, a) => sum + (Number(a.amount) || 0), 0) : 0;
    const restanteTotal = (Number(loan.total) || 0) + Number(mora) - abonado;
    
    return { abonado, restante: restanteTotal, mora, diffDays };
}

function getStatus(loan, restante, diffDays) {
    if (restante <= 0) return { label: 'Saldado', class: 'status-paid', icon: 'check-circle' };
    if (diffDays > 0) return { label: 'En Mora', class: 'status-late', icon: 'alert-circle' };
    return { label: 'Pendiente', class: 'status-pending', icon: 'clock' };
}


/* =========================================
   UI & BUSINESS LOGIC
========================================= */
function updatePreview() {
    const amount = parseFloat(loanAmountInput.value) || 0;
    const rate   = parseFloat(interestRateInput.value) || 0;
    const mode   = interestModeSelect.value;
    const months = calcMonths(loanDateInput.value, dueDateInput.value);
    const total  = calcTotalPay(amount, rate, mode, months);
    const interest = total - amount;

    previewTotal.textContent = `S/ ${total.toFixed(2)}`;

    // Mostrar detalle de meses e interés en el preview
    let detailEl = document.getElementById('preview-detail');
    if (!detailEl) {
        detailEl = document.createElement('div');
        detailEl.id = 'preview-detail';
        detailEl.style.cssText = 'font-size:0.78rem; color: var(--text-secondary); margin-top:4px;';
        previewTotal.parentElement.parentElement.appendChild(detailEl);
    }
    detailEl.textContent = `${months} mes${months !== 1 ? 'es' : ''} · Interés: S/ ${interest.toFixed(2)} · Cuota est.: S/ ${(total / months).toFixed(2)}/mes`;
}

async function handleAddOrEditLoan(e) {
    e.preventDefault();

    const editId = editIdInput.value;
    const name = clientNameInput.value.trim();
    const dni = clientDniInput.value.trim();
    const phone = clientPhoneInput.value.trim();
    const address = clientAddressInput.value.trim();
    const cip = clientCipInput.value.trim();
    const work = clientWorkInput.value.trim();
    const amount = parseFloat(loanAmountInput.value);
    const rate = parseFloat(interestRateInput.value) || 0;
    const mode = interestModeSelect.value;
    const dateStr = loanDateInput.value;
    const dueDateStr = dueDateInput.value;

    if (!name || isNaN(amount) || amount <= 0 || !dateStr || !dueDateStr) {
        showAlert("Por favor, completa los campos obligatorios (Nombre, Monto y Fechas).", 'danger');
        return;
    }
    // #3 – Validar que fecha de vencimiento sea posterior al préstamo
    if (new Date(dueDateStr) <= new Date(dateStr)) {
        showAlert("⚠️ La fecha de vencimiento debe ser posterior a la fecha del préstamo.", 'danger');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader" class="pulse"></i> Procesando...';

    const months = calcMonths(dateStr, dueDateStr);
    const totalToPay = calcTotalPay(amount, rate, mode, months);

    if (editId) {
        const existingId = loans.findIndex(l => l.id === editId);
        if(existingId >= 0) {
            loans[existingId].name = name;
            loans[existingId].dni = dni;
            loans[existingId].phone = phone;
            loans[existingId].address = address;
            loans[existingId].cip = cip;
            loans[existingId].work = work;
            loans[existingId].amount = amount;
            loans[existingId].interest = (mode === 'fixed') ? rate * months : (amount * (rate/100) * months);
            loans[existingId].interestMode = mode;
            loans[existingId].interestVal = rate;
            loans[existingId].months = months;
            loans[existingId].total = totalToPay;
            loans[existingId].date = dateStr;
            loans[existingId].dueDate = dueDateStr;
            loans[existingId].notes = loanNotesInput ? loanNotesInput.value.trim() : ''; // #I
            await putLoanToDB(loans[existingId]);
        }
        window.cancelEdit();
    } else {


        // Read files if any
        const attachments = await processFiles(loanFilesInput.files);

        const newLoan = {
            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `id-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: name,
            dni: dni,
            phone: phone,
            address: address,
            cip: cip,
            work: work,
            amount: amount,
            interest: (mode === 'fixed') ? rate * months : (amount * (rate/100) * months),
            interestMode: mode,
            interestVal: rate,
            months: months,
            total: totalToPay,
            date: dateStr,
            dueDate: dueDateStr,
            notes: loanNotesInput ? loanNotesInput.value.trim() : '', // #I
            abonos: [], 
            attachments: attachments,
            createdAt: new Date().toISOString()
        };
        
        await putLoanToDB(newLoan);
        loans.unshift(newLoan);
        form.reset();
        
        // Reset file input label
        const fileLabel = document.querySelector('.file-upload-label');
        if (fileLabel) {
            fileLabel.classList.remove('has-file');
            fileLabel.innerHTML = '<i data-lucide="paperclip"></i> Seleccionar Archivos';
            lucide.createIcons();
        }
        loanFilesInput.value = ""; // Clear file input
        
        loanDateInput.valueAsDate = new Date();
        const nextM = new Date(); nextM.setDate(nextM.getDate() + 30);
        dueDateInput.valueAsDate = nextM;
    }

    updatePreview();
    renderTable(loans);
    updateMetrics();
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="save"></i> Procesar Operación';
    lucide.createIcons();
}

window.cancelEdit = function() {
    editIdInput.value = '';
    form.reset();
    
    loanDateInput.valueAsDate = new Date();
    const nextM = new Date(); nextM.setDate(nextM.getDate() + 30);
    dueDateInput.valueAsDate = nextM;
    
    updatePreview();
    formTitle.innerHTML = '<i data-lucide="plus-circle"></i> Nuevo Préstamo';
    cancelEditBtn.classList.add('hidden');    submitBtn.innerHTML = '<i data-lucide="save"></i> Procesar Operación';
    lucide.createIcons();
}

window.startEditMode = function(id) {
    const loan = loans.find(l => l.id === id);
    if(!loan) return;
    
    editIdInput.value = loan.id;
    clientNameInput.value = loan.name;
    clientDniInput.value = loan.dni || "";
    clientPhoneInput.value = loan.phone || "";
    clientAddressInput.value = loan.address || "";
    clientCipInput.value = loan.cip || "";
    clientWorkInput.value = loan.work || "";
    loanAmountInput.value = loan.amount;
    
    if (loan.interestMode === 'fixed') {
        interestModeSelect.value = 'fixed';
        interestRateInput.value = loan.interestVal || loan.interest;
    } else {
        interestModeSelect.value = 'percent';
        const r = (loan.interest / loan.amount) * 100;
        interestRateInput.value = loan.interestVal || r;
    }
    
    interestLabel.textContent = (interestModeSelect.value === 'fixed' ? 'S/' : '%');
    
    loanDateInput.value = loan.date;
    dueDateInput.value = loan.dueDate;
    if (loanNotesInput) loanNotesInput.value = loan.notes || ''; // #I

    updatePreview();

    formTitle.innerHTML = '<i data-lucide="edit"></i> Editando Operación';
    cancelEditBtn.classList.remove('hidden');    submitBtn.innerHTML = '<i data-lucide="save"></i> Actualizar Registro';
    
    lucide.createIcons();
    window.scrollTo({top:0, behavior: "smooth"});
}


/* =========================================
   ABONOS & WHATSAPP GENERATION
========================================= */
window.openPayModal = function(id) {
    const loan = loans.find(l => l.id === id);
    if (!loan) return;

    const { restante } = getLoanSummary(loan);
    if (restante <= 0) {
        alert("Esta deuda ya está saldada.");
        return;
    }

    payLoanId.value = loan.id;
    payClientName.textContent = loan.name;
    payRemaining.textContent = `S/ ${restante.toFixed(2)}`;
    payAmountInput.max = restante.toFixed(2); 
    payDateInput.valueAsDate = new Date();
    payAmountInput.value = "";
    
    payHistoryList.innerHTML = "";
    if (loan.abonos && loan.abonos.length > 0) {
        loan.abonos.forEach((ab) => {
            const div = document.createElement('div');
            div.className = 'pay-history-item fade-in';
            div.innerHTML = `<span><i data-lucide="calendar" style="width:12px"></i> ${formatObjDate(ab.date)}</span> 
                             <strong class="text-success">S/ ${ab.amount.toFixed(2)}</strong>`;
            payHistoryList.appendChild(div);
        });
        lucide.createIcons();
    } else {
        payHistoryList.innerHTML = "<p class='text-muted text-sm' style='text-align:center; padding:1rem;'>No hay abonos registrados.</p>";
    }

    document.getElementById('pay-modal').classList.remove('hidden');
}

async function handleAddPayment(e) {
    e.preventDefault();
    const id = payLoanId.value;
    const amount = parseFloat(payAmountInput.value);
    const date = payDateInput.value;

    const loanObj = loans.find(l => l.id === id);
    if(!loanObj || isNaN(amount) || amount<=0) return;

    const { restante: prevRestante } = getLoanSummary(loanObj);

    if (!loanObj.abonos) loanObj.abonos = [];
    loanObj.abonos.push({ amount, date });

    await putLoanToDB(loanObj);
    
    const { restante: newRestante } = getLoanSummary(loanObj);
    
    closeModal('pay-modal');
    renderTable(loans);
    updateMetrics();

    showVoucherModal(loanObj.name, amount, prevRestante, newRestante, date, loanObj.phone);
    
    if(newRestante <= 0) {
        setTimeout(() => showAlert('¡Operación Saldada con Éxito! 🎉', 'success'), 400);
    }
}

function showVoucherModal(name, amountPaid, prevR, newR, dateStr, phone = "") {
    vDate.textContent = formatObjDate(dateStr) + " " + new Date().toLocaleTimeString();
    vClient.textContent = name;
    vAmount.textContent = `S/ ${amountPaid.toFixed(2)}`;
    vPrev.textContent = `S/ ${prevR.toFixed(2)}`;
    vNew.textContent = `S/ ${newR.toFixed(2)}`;

    let msg = WA_TEXT_TEMPLATE
                .replace('{name}', name)
                .replace('{amount}', amountPaid.toFixed(2))
                .replace('{prev}', prevR.toFixed(2))
                .replace('{newTotal}', newR.toFixed(2));
    
    currentWaMessage = msg;
    currentWaPhone = phone;
    document.getElementById('voucher-modal').classList.remove('hidden');
}

function sendWaMessage() {
    let url = `https://wa.me/?text=${encodeURIComponent(currentWaMessage)}`;
    if (currentWaPhone) {
        const cleanPhone = currentWaPhone.replace(/[^0-9]/g, '');
        url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(currentWaMessage)}`;
    }
    window.open(url, '_blank');
    closeModal('voucher-modal');
}


/* =========================================
   UPCOMING ALERTS - #11
========================================= */
function renderUpcomingAlerts(activeLoans) {
    const container = document.getElementById('upcoming-alerts');
    if (!container) return;

    const today = new Date(); today.setHours(0,0,0,0);
    const relevant = activeLoans
        .filter(l => {
            const { restante } = getLoanSummary(l);
            if (restante <= 0) return false;
            const due = new Date(l.dueDate + 'T12:00:00');
            const diff = Math.ceil((due - today) / (1000*60*60*24));
            return diff <= 7; // Vence en 7 días o ya venció
        })
        .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (relevant.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="alert-banner">
            <div class="alert-banner-title">
                <i data-lucide="bell-ring" style="width:16px;height:16px;"></i>
                <strong>${relevant.length} vencimiento${relevant.length>1?'s':''} próximo${relevant.length>1?'s':''} (≤7 días)</strong>
            </div>
            <div class="alert-chips">
                ${relevant.map(l => {
                    const due = new Date(l.dueDate + 'T12:00:00');
                    const diff = Math.ceil((due - today) / (1000*60*60*24));
                    const cls  = diff < 0 ? 'chip-danger' : diff <= 3 ? 'chip-warn' : 'chip-info';
                    const label = diff < 0 ? `${Math.abs(diff)}d mora` : diff === 0 ? 'Hoy!' : `${diff}d`;
                    const { restante } = getLoanSummary(l);
                    return `<span class="alert-chip ${cls}">${l.name.split(' ')[0]} &bull; S/${restante.toFixed(0)} &bull; ${label}</span>`;
                }).join('')}
            </div>
        </div>`;
    lucide.createIcons();
}

/* =========================================
   RENDERING & METRICS
========================================= */
// #7 - Sortable column helper
function getSortValue(loan, col) {
    if (col === 'name')    return loan.name.toLowerCase();
    if (col === 'total')   return loan.total || 0;
    if (col === 'dueDate') return loan.dueDate || '';
    return '';
}

function applySortAndRender(dataToRender) {
    let data = [...dataToRender];
    if (sortState.col) {
        data.sort((a,b) => {
            const va = getSortValue(a, sortState.col);
            const vb = getSortValue(b, sortState.col);
            if (va < vb) return sortState.asc ? -1 :  1;
            if (va > vb) return sortState.asc ?  1 : -1;
            return 0;
        });
    }
    renderTable(data);
}

window.handleSortClick = function(col) {
    if (sortState.col === col) {
        sortState.asc = !sortState.asc;
    } else {
        sortState.col = col;
        sortState.asc = true;
    }
    applySearchAndFilter();
};

window.handleFilterClick = function(filter) {
    currentFilter = filter;
    
    // Update UI buttons
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        const text = btn.textContent.toLowerCase();
        const isMatch = (filter === 'all' && text === 'todos') ||
                        (filter === 'mora' && text.includes('mora')) ||
                        (filter === 'today' && text.includes('hoy')) ||
                        (filter === 'soon' && text.includes('pronto'));
        
        if (isMatch) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    applySearchAndFilter();
};

function applySearchAndFilter() {
    const term = searchInput.value.toLowerCase().trim();
    const today = new Date(); today.setHours(0,0,0,0);

    let filtered = loans.filter(l => {
        // 1. Search Mask
        const matchesSearch = l.name.toLowerCase().includes(term) ||
            (l.dni   && l.dni.toLowerCase().includes(term))  ||
            (l.phone && l.phone.toLowerCase().includes(term));
        
        if (!matchesSearch) return false;

        // 2. Status Filter
        if (currentFilter === 'all') return true;
        
        const { restante } = getLoanSummary(l);
        if (restante <= 0) return false; // Filters only apply to active debt
        
        const { diffDays } = calculatePenalty(l);
        
        if (currentFilter === 'mora') return diffDays > 0;
        if (currentFilter === 'today') return diffDays === 0;
        if (currentFilter === 'soon') return diffDays < 0 && diffDays >= -3;
        
        return true;
    });

    applySortAndRender(filtered);
}

function getStatus(loan, restante, diffDays) {
    if (restante <= 0) return { label: "Saldado", class: "status-paid", icon: 'check-circle'};
    if (diffDays > 0) {
        return { label: `Mora: ${diffDays}d`, class: "status-danger", icon: 'alert-triangle'};
    } else if (diffDays >= -3 && diffDays <= 0) {
        return { label: `Vence pronto`, class: "status-warn", icon: 'clock'};
    } else {
        return { label: `En Plazo`, class: "status-good", icon: 'shield-check'};
    }
}

function formatObjDate(dateStr) {
    if(!dateStr) return "";
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function renderTable(dataToRender) {
    loansTbody.innerHTML = '';
    archiveTbody.innerHTML = '';

    const activeLoans   = dataToRender.filter(l => !l.isArchived);
    const archivedLoans = dataToRender.filter(l =>  l.isArchived);

    // #11 - Upcoming alerts
    renderUpcomingAlerts(activeLoans);

    if (activeLoans.length === 0) {
        emptyState.classList.remove('hidden');
        tableEl.classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        tableEl.classList.remove('hidden');

        activeLoans.forEach((loan, idx) => {
            const { abonado, restante, mora } = getLoanSummary(loan);
            const { diffDays } = calculatePenalty(loan);
            const status = getStatus(loan, restante, diffDays);

            // #5 - Cuota mensual
            const months = loan.months || 1;
            const quota  = months > 1 ? (loan.total / months).toFixed(2) : null;

            const tr = document.createElement('tr');
            tr.style.animationDelay = `${idx * 0.05}s`;
            tr.className = 'fade-in';
            tr.innerHTML = `
                <td>
                    <div class="client-row-info">
                        <div class="client-name-group">
                            <div class="client-name">${loan.name}</div>
                            <button class="btn-history-small" onclick="openClientModal('${loan.name}')" title="Ver historial completo">
                                <i data-lucide="history"></i>
                            </button>
                        </div>
                        ${loan.phone ? `<div class="client-notes"><i data-lucide="smartphone" style="width:12px;color:#25D366;"></i> <a href="https://wa.me/${loan.phone.replace(/[^0-9]/g,'')}" target="_blank" style="color:#25D366;text-decoration:none;">${loan.phone}</a></div>` : ''}
                        ${loan.notes ? `<div class="client-loan-note-table"><i data-lucide="file-text" style="width:11px;"></i> ${loan.notes}</div>` : ''}
                        <div class="months-badge">
                            <i data-lucide="calendar-days" style="width:11px;height:11px;"></i>
                            ${months} mes${months>1?'es':''}
                            ${loan.interestVal ? `&bull; ${loan.interestVal}${loan.interestMode==='fixed'?'S/':'%'}/mes` : ''}
                        </div>
                    </div>
                </td>
                <td class="font-bold">
                    S/ ${loan.total.toFixed(2)}
                    ${quota ? `<div class="quota-hint">S/ ${quota}/mes</div>` : ''}
                </td>
                <td class="${mora > 0 ? 'text-danger font-bold' : 'text-muted'}">
                    ${mora > 0 ? '+ S/ ' + mora.toFixed(2) : '---'}
                </td>
                <td class="text-accent font-bold">S/ ${abonado.toFixed(2)}</td>
                <td class="${restante > 0 ? 'text-danger' : 'text-muted'} font-bold">
                    S/ ${restante.toFixed(2)}
                </td>
                <td>
                    <span class="status-badge ${status.class}"><i data-lucide="${status.icon}" style="width:12px;height:12px;"></i> ${status.label}</span>
                    <div class="text-muted text-sm mt-1">Límite: ${formatObjDate(loan.dueDate)}</div>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-icon btn-pay" onclick="openPayModal('${loan.id}')" title="Abonar Pago" ${restante<=0?'disabled':''}>
                        <i data-lucide="dollar-sign"></i> <span>Abono</span>
                    </button>
                    <button class="btn btn-icon btn-reminder" onclick="sendReminder('${loan.id}')" title="Enviar Recordatorio por WhatsApp" ${restante<=0?'disabled':''}>
                        <i data-lucide="bell"></i> <span>Cobrar</span>
                    </button>
                    <button class="btn btn-icon btn-contract" onclick="generateContract('${loan.id}')" title="Imprimir Pagaré / Contrato">
                        <i data-lucide="printer"></i> <span>Pagaré</span>
                    </button>
                    <button class="btn btn-icon btn-edit" onclick="startEditMode('${loan.id}')" title="Editar Info">
                        <i data-lucide="edit"></i> <span>Edit</span>
                    </button>
                    <button class="btn btn-icon btn-files" onclick="openFilesModal('${loan.id}')" title="Ver Archivos / Documentos">
                        <i data-lucide="paperclip"></i> <span>Archivos ${loan.attachments && loan.attachments.length > 0 ? `(${loan.attachments.length})` : ''}</span>
                    </button>
                    <button class="btn btn-icon btn-delete" onclick="handleArchiveLoan('${loan.id}')" title="Mover al Archivo (Cerrar Operación)">
                        <i data-lucide="archive"></i> <span>Cerrar</span>
                    </button>
                </td>
            `;
            loansTbody.appendChild(tr);
        });
        refreshIcons();
    }

    // #13 - Improved archive table
    if (archivedLoans.length === 0) {
        archiveEmptyState.classList.remove('hidden');
        document.getElementById('archive-table').classList.add('hidden');
    } else {
        archiveEmptyState.classList.add('hidden');
        document.getElementById('archive-table').classList.remove('hidden');
        archivedLoans.forEach((loan) => {
            const abonado = loan.abonos ? loan.abonos.reduce((s,a) => s + (Number(a.amount)||0), 0) : 0;
            const tr = document.createElement('tr');
            tr.className = 'fade-in';
            tr.innerHTML = `
                <td>
                    <div class="client-name">${loan.name}</div>
                    <div class="text-muted text-sm">${loan.dni ? 'DNI: '+loan.dni : ''}</div>
                </td>
                <td class="font-bold">S/ ${(loan.amount||0).toFixed(2)}</td>
                <td class="text-accent">S/ ${(loan.interest||0).toFixed(2)}</td>
                <td class="font-bold">S/ ${(loan.total||0).toFixed(2)}</td>
                <td class="text-muted">${loan.months || 1} mes${(loan.months||1)>1?'es':''}</td>
                <td class="text-muted">${formatObjDate(loan.date)} &rarr; ${formatObjDate(loan.dueDate)}</td>
                <td><span class="status-badge status-paid"><i data-lucide="check-circle" style="width:12px;height:12px;"></i> Cerrado</span></td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="handleRestoreLoan('${loan.id}')" title="Restaurar a Activos">
                        <i data-lucide="refresh-cw"></i> <span>Restaurar</span>
                    </button>
                    <button class="btn btn-sm btn-icon btn-delete" onclick="handleDeletePermanent('${loan.id}')" title="Eliminar Definitivamente">
                        <i data-lucide="trash-2"></i> <span>Eliminar</span>
                    </button>
                </td>
            `;
            archiveTbody.appendChild(tr);
        });
        refreshIcons();
    }
}

function updateMetrics() {
    let totalC = 0; // Total Capital
    let totalI = 0; // Total Interest expected
    let totalP = 0; // Total Penalties
    let activeClients = 0;

    loans.forEach(loan => {
        if (!loan.isArchived) {
            const { restante, mora } = getLoanSummary(loan);
            if (restante > 0) {
                totalC += Number(loan.amount) || 0;
                totalI += Number(loan.interest) || 0;
                totalP += Number(mora) || 0;
                activeClients++;
            }
        }
    });

    totalLentEl.textContent = `S/ ${totalC.toFixed(2)}`;
    totalInterestEl.textContent = `S/ ${totalI.toFixed(2)}`;
    totalPenaltiesEl.textContent = `S/ ${totalP.toFixed(2)}`;
    clientsCountEl.textContent = activeClients;

    updateChartData(totalC, totalI, totalP);
    renderDueChart(); // #E
}

window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

window.sendReminder = function(id) {
    const loan = loans.find(l => l.id === id);
    if (!loan) return;
    const { restante } = getLoanSummary(loan);
    const msg = `Hola *${loan.name}* 👋\n\nTe escribimos de *PRESTACUSCO* para saludarte y recordarte amablemente que tu crédito activo por un saldo pendiente de *S/ ${restante.toFixed(2)}* tiene como fecha de vencimiento el *${formatObjDate(loan.dueDate)}*.\n\nPor favor, comunícate con nosotros si requieres asistencia.\n\n¡Que tengas un excelente día! 🚀`;
    
    let url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    if (loan.phone) {
        url = `https://wa.me/${loan.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
    }
    window.open(url, '_blank');
}

/* =========================================
   CONTRACT GENERATION (CONTRATO DE MUTUO)
========================================= */
function numberToWords(n) {
    const ones = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const tens = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    
    if (n === 0) return 'CERO';
    if (n < 0) return 'MENOS ' + numberToWords(Math.abs(n));
    
    let words = '';
    let whole = Math.floor(n);
    let cents = Math.round((n - whole) * 100);
    
    if (whole >= 1000000) {
        let millions = Math.floor(whole / 1000000);
        words += (millions === 1 ? 'UN MILLÓN' : numberToWords(millions) + ' MILLONES') + ' ';
        whole %= 1000000;
    }

    if (whole >= 1000) {
        let thousands = Math.floor(whole / 1000);
        words += (thousands === 1 ? 'MIL' : numberToWords(thousands) + ' MIL') + ' ';
        whole %= 1000;
    }
    
    if (whole >= 100) {
        let hundreds = Math.floor(whole / 100);
        if (hundreds === 1 && whole % 100 === 0) words += 'CIEN ';
        else if (hundreds === 1) words += 'CIENTO ';
        else if (hundreds === 5) words += 'QUINIENTOS ';
        else if (hundreds === 7) words += 'SETECIENTOS ';
        else if (hundreds === 9) words += 'NOVECIENTOS ';
        else words += ones[hundreds] + 'CIENTOS ';
        whole %= 100;
    }
    
    if (whole >= 20) {
        words += tens[Math.floor(whole / 10)] + (whole % 10 !== 0 ? ' Y ' + ones[whole % 10] : '') + ' ';
    } else if (whole >= 10) {
        words += teens[whole - 10] + ' ';
    } else if (whole > 0) {
        words += ones[whole] + ' ';
    }
    
    return words.trim();
}

window.generateContract = function(id) {
    const loan = loans.find(l => l.id === id);
    if (!loan) return;

    const printArea = document.getElementById('print-area');
    const amountStr = loan.amount.toLocaleString('es-PE', { minimumFractionDigits: 2 });
    const interestStr = loan.interest.toLocaleString('es-PE', { minimumFractionDigits: 2 });
    const totalStr = loan.total.toLocaleString('es-PE', { minimumFractionDigits: 2 });
    
    const amountWords = numberToWords(Math.floor(loan.amount));
    const totalWords = numberToWords(Math.floor(loan.total));
    
    const loanDate = new Date(loan.date + 'T12:00:00');
    const dueDate = new Date(loan.dueDate + 'T12:00:00');
    
    const monthsNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    const lDay = loanDate.getDate();
    const lMonth = monthsNames[loanDate.getMonth()];
    const lYear = loanDate.getFullYear();
    
    const dDay = dueDate.getDate();
    const dMonth = monthsNames[dueDate.getMonth()];
    const dYear = dueDate.getFullYear();
    printArea.innerHTML = `
        <div class="contract-paper formal-mode">
            <div class="contract-header" style="margin-top: 20px;">
                <center>
                    <h2 style="text-decoration: underline; margin-bottom: 30px; font-size: 16pt; font-weight: bold;">CONTRATO DE MUTUO (PRÉSTAMO DE DINERO)</h2>
                </center>
                <p style="text-align: justify; margin-bottom: 30px;">Conste por el presente documento privado de reconocimiento de deuda y compromiso de pago;</p>
            </div>
            
            <div class="contract-content">
                <p><strong>I. LAS PARTES:</strong></p>
                <p><strong>EL PRESTAMISTA:</strong> Don <strong>Juan David Puclla Quispe</strong>, identificado con <strong>DNI N° 60257586</strong>, domiciliado en el departamento de Cusco.</p>

                <p><strong>EL PRESTATARIO:</strong> Don/Doña <strong>${loan.name}</strong>, identificado(a) con <strong>DNI N° ${loan.dni || '..........'}</strong>, con domicilio real en <strong>${loan.address || '...................................................'}</strong> y número de contacto/WhatsApp <strong>${loan.phone || '........................................'}</strong>.</p>

                <p><strong>II. CLÁUSULAS:</strong></p>

                <p><strong>PRIMERA (EL MONTO):</strong><br>
                EL PRESTAMISTA entrega en calidad de mutuo al PRESTATARIO la suma líquida de <strong>S/ ${amountStr} (${amountWords} y 00/100 Soles)</strong>. EL PRESTATARIO declara bajo juramento haber recibido dicha cantidad a su entera satisfacción mediante: <strong>[ ] Efectivo / [ ] Transferencia Electrónica</strong>.</p>

                <p><strong>SEGUNDA (LOS INTERESES Y TOTAL):</strong><br>
                Las partes pactan un interés compensatorio de <strong>S/ ${interestStr}</strong>. Sumando ambos conceptos, EL PRESTATARIO reconoce una obligación total de pago de <strong>S/ ${totalStr} (${totalWords} y 00/100 Soles)</strong>.</p>

                <p><strong>TERCERA (PLAZO):</strong><br>
                EL PRESTATARIO se obliga irrevocablemente a la devolución del capital e intereses en una única cuota, teniendo como fecha de vencimiento fatal el día <strong>${dDay} de ${dMonth} del ${dYear}</strong>.</p>

                <p><strong>CUARTA (MORA):</strong><br>
                A partir del día siguiente del vencimiento, se generará una penalidad diaria por mora de <strong>S/ ${PENALTY_PER_DAY.toFixed(2)}</strong> (Cero con 50/100 Soles). Esta penalidad es acumulativa y no requiere notificación previa.</p>

                <p><strong>QUINTA (JURISDICCIÓN):</strong><br>
                Para todos los efectos legales, las partes se someten a la competencia de los jueces y tribunales del Distrito Judicial de Cusco, renunciando al fuero de sus domicilios.</p>

                <p><strong>SEXTA (CONFORMIDAD):</strong><br>
                En señal de absoluta conformidad y validez de lo aquí pactado, las partes firman y estampan su huella digital en la ciudad de <strong>Cusco</strong>, a los <strong>${lDay} días del mes de ${lMonth} del año ${lYear}</strong>.</p>
            </div>

            <div class="sig-container" style="margin-top: 150px; display: flex; justify-content: space-between;">
                <div class="sig-box" style="text-align: center; width: 42%;">
                    <br>..................................................<br>
                    <strong>EL PRESTAMISTA</strong><br>
                    DNI: 60257586<br>
                    Huella: __________
                </div>
                <div class="sig-box" style="text-align: center; width: 42%;">
                    <br>..................................................<br>
                    <strong>EL PRESTATARIO</strong><br>
                    DNI: ${loan.dni || '..........'}<br>
                    Huella: __________
                </div>
            </div>
        </div>
    `;
    
    printArea.classList.remove('hidden');
    // Pequeño retraso para asegurar que el navegador renderice el contenido antes de imprimir
    setTimeout(() => {
        window.print();
        printArea.classList.add('hidden');
    }, 100);
}

window.handleArchiveLoan = async function(id) {
    showConfirm('¿Seguro de mover esta operación al Historial de Cancelados/Cerrados?', async () => {
        const loan = loans.find(l => l.id === id);
        if(loan) {
            loan.isArchived = true;
            await putLoanToDB(loan);
            renderTable(loans);
            updateMetrics();
        }
    });
}

window.handleRestoreLoan = async function(id) {
    showConfirm('¿Seguro de restaurar esta operación a tus créditos activos?', async () => {
        const loan = loans.find(l => l.id === id);
        if(loan) {
            loan.isArchived = false;
            await putLoanToDB(loan);
            renderTable(loans);
            updateMetrics();
        }
    });
}

window.handleDeletePermanent = async function(id) {
    showConfirm('⚠️ ¿ELIMINAR DEFINITIVAMENTE?\nEsta acción no se puede deshacer.', async () => {
        await deleteLoanFromDB(id);
        const idx = loans.findIndex(l => l.id === id);
        if(idx !== -1) loans.splice(idx, 1);
        renderTable(loans);
        updateMetrics();
    });
}

function handleSearch(e) {
    applySearchAndFilter();
}

function exportToCSV() {
    if(loans.length === 0) {
        showAlert("Portafolio vacío.", 'info'); return;
    }

    const headers = ["ID", "Cliente", "Capital_Base", "Interes", "Total_Cobrar", "Total_Abonado", "Deuda_Restante", "Mora_Actual", "Fecha", "Vencimiento", "Notas"];
    
    const rows = loans.map(l => {
        const { abonado, restante, mora } = getLoanSummary(l);
        return [
            l.id,
            `"${l.name}"`, 
            l.amount,
            l.interest,
            l.total,
            abonado,
            restante,
            mora,
            l.date,
            l.dueDate,
            `"${(l.notes || '').replace(/"/g, '""')}"`
        ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CapitalFlow_Backup_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function exportToJSON() {
    if(loans.length === 0) {
        showAlert("Portafolio vacío.", 'info'); return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(loans));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `CapitalFlow_FullSync_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function importFromJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) throw new Error("Formato inválido");
            if (confirm("🚨 ¡Peligro! Esto sobreescribirá tu base de datos actual y no se puede deshacer. ¿Continuar con la Restauración?")) {
                const transaction = db.transaction(['loans'], 'readwrite');
                const store = transaction.objectStore('loans');
                store.clear();
                imported.forEach(l => store.put(l));
                transaction.oncomplete = () => {
                    alert("✅ Restauración completada con éxito.");
                    loadDataFromDB();
                    importJson.value = ""; // reset input
                };
            } else {
                importJson.value = "";
            }
        } catch(err) {
            alert("Error procesando el archivo JSON de respaldo.");
            importJson.value = "";
        }
    };
    reader.readAsText(file);
}

/* =========================================
   FILE MANAGEMENT HELPERS
========================================= */
async function processFiles(fileList) {
    const promises = Array.from(fileList).map(file => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: e.target.result
                });
            };
            reader.readAsDataURL(file);
        });
    });
    return Promise.all(promises);
}

window.openFilesModal = function(id) {
    const loan = loans.find(l => l.id === id);
    if (!loan) return;

    currentFilesLoanId.value = id;
    filesClientName.textContent = loan.name;
    renderFilesList(loan);
    filesModal.classList.remove('hidden');
}

function renderFilesList(loan) {
    filesList.innerHTML = "";
    if (!loan.attachments || loan.attachments.length === 0) {
        filesEmpty.classList.remove('hidden');
        return;
    }
    filesEmpty.classList.add('hidden');

    loan.attachments.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-card fade-in';
        
        const isImage = file.type.startsWith('image/');
        const preview = isImage 
            ? `<img src="${file.data}" class="file-preview-img">` 
            : `<div class="file-icon-box"><i data-lucide="file-text"></i></div>`;
            
        div.innerHTML = `
            ${preview}
            <div class="file-info">
                <span class="file-name" title="${file.name}">${file.name}</span>
                <span class="file-size">${(file.size / 1024).toFixed(1)} KB</span>
            </div>
            <div class="file-actions">
                <a href="${file.data}" download="${file.name}" class="btn-file-icon text-primary" title="Descargar"><i data-lucide="download"></i></a>
                <button onclick="handleDeleteFile('${loan.id}', ${index})" class="btn-file-icon text-danger" title="Eliminar"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        filesList.appendChild(div);
    });
    lucide.createIcons();
}

window.handleUploadMoreFiles = async function() {
    const id = currentFilesLoanId.value;
    const loan = loans.find(l => l.id === id);
    if (!loan || !addMoreFilesInput.files.length) return;

    const newAttachments = await processFiles(addMoreFilesInput.files);
    if (!loan.attachments) loan.attachments = [];
    loan.attachments.push(...newAttachments);

    await putLoanToDB(loan);
    addMoreFilesInput.value = "";
    renderFilesList(loan);
    
    // Proactively refresh table just in case (though not strictly needed here)
    renderTable(loans);
}

window.handleDeleteFile = async function(loanId, index) {
    if (!confirm("¿Eliminar este archivo?")) return;
    const loan = loans.find(l => l.id === loanId);
    if (!loan || !loan.attachments) return;

    loan.attachments.splice(index, 1);
    await putLoanToDB(loan);
    renderFilesList(loan);
}

// Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(err => console.error("SW reg failed", err));
}

// Start
init();
window.addEventListener('load', () => {
    refreshIcons();
});
setTimeout(refreshIcons, 100);
setTimeout(refreshIcons, 500); 
setTimeout(refreshIcons, 2000); // Último intento tardío
