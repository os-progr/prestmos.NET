// CONSTANTS
const PIN_CODE = "092022edith";
const PENALTY_PER_DAY = 0.50; // S/ 0.50 mora por día
const WA_TEXT_TEMPLATE = "¡Hola! 🧾 Confirmación de Abono.\n\n👤 Cliente: {name}\n💰 Abono: S/ {amount}\n💳 Saldo Anterior: S/ {prev}\n📉 Nuevo Saldo: S/ {newTotal}\n\nGracias por su pago.";

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
const previewQuotaRow = document.getElementById('preview-quota-row');
const previewQuotaAmt = document.getElementById('preview-quota-amt');

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

// Modals
const modalGallery = document.getElementById('modal-gallery');
const modalEmpty = document.getElementById('modal-empty');
const modalTitle = document.getElementById('modal-title');

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

// Login
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const pinInput = document.getElementById('pin-input');
const loginError = document.getElementById('login-error');
const dashboardMain = document.getElementById('dashboard-main');
const logoutBtn = document.getElementById('logout-btn');
const themeToggleBtn = document.getElementById('theme-toggle');

// App State
let db;
let loans = [];
let currentWaMessage = "";
let currentWaPhone = "";
let portfolioChart = null;

// Initialize App
function init() {
    checkAuth();
    
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
        alert("Tu navegador no soporta IndexedDB.");
    });
    
    initChart();

    loanAmountInput.addEventListener('input', updatePreview);
    interestRateInput.addEventListener('input', updatePreview);

    form.addEventListener('submit', handleAddOrEditLoan);
    searchInput.addEventListener('input', handleSearch);
    exportBtn.addEventListener('click', exportToCSV);
    backupBtn.addEventListener('click', exportToJSON);
    importJson.addEventListener('change', importFromJSON);
    
    payForm.addEventListener('submit', handleAddPayment);
    loginForm.addEventListener('submit', handleLogin);

    interestModeSelect.addEventListener('change', () => {
        const isFixed = interestModeSelect.value === 'fixed';
        interestLabel.textContent = isFixed ? 'S/' : '%';
        interestIcon.setAttribute('data-lucide', isFixed ? 'banknote' : 'percent');
        lucide.createIcons();
        updatePreview();
    });
    logoutBtn.addEventListener('click', handleLogout);
    shareWaBtn.addEventListener('click', sendWaMessage);
    
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
   SECURITY LOGIC
========================================= */
function checkAuth() {
    const isAuth = sessionStorage.getItem('loanAppAuth') === 'true';
    if (isAuth) {
        loginOverlay.style.display = 'none';
        dashboardMain.style.display = 'block';
    } else {
        loginOverlay.style.display = 'flex';
        dashboardMain.style.display = 'none';
        pinInput.focus();
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
    sessionStorage.removeItem('loanAppAuth');
    checkAuth();
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
        
        loans.forEach(l => {
            if (!l.abonos) l.abonos = [];
            if (!l.dueDate) l.dueDate = l.date;
            if (!l.quotas) l.quotas = 1;
        });

        renderTable(loans);
        updateMetrics();
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
function calcTotalPay(amount, rate, mode = 'percent') {
    if (mode === 'fixed') {
        return amount + rate;
    }
    const interest = amount * (rate / 100);
    return amount + interest;
}

function calculatePenalty(loan) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(loan.dueDate + 'T12:00:00');
    
    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const abonado = loan.abonos ? loan.abonos.reduce((sum, a) => sum + a.amount, 0) : 0;
    const baseRestante = loan.total - abonado;

    let mora = 0;
    if (diffDays > 0 && baseRestante > 0) {
        mora = diffDays * PENALTY_PER_DAY;
    }

    return { diffDays, mora, baseRestante };
}

function getLoanSummary(loan) {
    const abonado = loan.abonos ? loan.abonos.reduce((sum, a) => sum + a.amount, 0) : 0;
    const { mora } = calculatePenalty(loan);
    const restanteTotal = (loan.total + mora) - abonado;
    
    return { abonado, restante: restanteTotal, mora };
}


/* =========================================
   UI & BUSINESS LOGIC
========================================= */
function updatePreview() {
    const amount = parseFloat(loanAmountInput.value) || 0;
    const rate = parseFloat(interestRateInput.value) || 0;
    
    const mode = interestModeSelect.value;
    const total = calcTotalPay(amount, rate, mode);
    previewTotal.textContent = `S/ ${total.toFixed(2)}`;
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

    if (!name || isNaN(amount) || amount <= 0 || !dateStr || !dueDateStr) return;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader" class="pulse"></i> Procesando...';

    const totalToPay = calcTotalPay(amount, rate, mode);

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
            loans[existingId].interest = (mode === 'fixed') ? rate : (amount * (rate/100));
            loans[existingId].interestMode = mode;
            loans[existingId].interestVal = rate;
            loans[existingId].total = totalToPay;
            loans[existingId].date = dateStr;
            loans[existingId].dueDate = dueDateStr;
            await putLoanToDB(loans[existingId]);
        }
        window.cancelEdit();
    } else {


        const newLoan = {
            id: crypto.randomUUID(),
            name: name,
            dni: dni,
            phone: phone,
            address: address,
            cip: cip,
            work: work,
            amount: amount,
            interest: (mode === 'fixed') ? rate : (amount * (rate/100)),
            interestMode: mode,
            interestVal: rate,
            total: totalToPay,
            date: dateStr,
            dueDate: dueDateStr,
            abonos: [], 
            createdAt: new Date().toISOString()
        };
        
        await putLoanToDB(newLoan);
        loans.unshift(newLoan);
        form.reset();
        
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
    
    payQuotaInfo.textContent = `Pagos: ${(loan.abonos||[]).length} de ${loan.quotas||1}`;

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
        setTimeout(() => alert("¡Operación Salda con Éxito!"), 600);
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
   RENDERING & METRICS
========================================= */
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
    
    const activeLoans = dataToRender.filter(l => !l.isArchived);
    const archivedLoans = dataToRender.filter(l => l.isArchived);

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
            
            const tr = document.createElement('tr');
            tr.style.animationDelay = `${idx * 0.05}s`;
            tr.className = 'fade-in';
            tr.innerHTML = `
                <td>
                    <div class="client-name">${loan.name}</div>
                    ${loan.phone ? `<div class="client-notes"><i data-lucide="smartphone" style="width:12px;color: #25D366;"></i> <a href="https://wa.me/${loan.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color:#25D366; text-decoration:none;">${loan.phone}</a></div>` : ''}
                </td>
                <td class="font-bold">S/ ${loan.total.toFixed(2)}</td>
                <td class="${mora > 0 ? 'text-danger font-bold' : 'text-muted'}">
                    ${mora > 0 ? '+ S/ ' + mora.toFixed(2) : '---'}
                </td>
                <td class="text-accent font-bold">S/ ${abonado.toFixed(2)}</td>
                <td class="${restante > 0 ? 'text-danger' : 'text-muted'} font-bold">
                    S/ ${restante.toFixed(2)}
                </td>
                <td>
                    <span class="status-badge ${status.class}"><i data-lucide="${status.icon}" style="width:12px; height:12px;"></i> ${status.label}</span>
                    <div class="text-muted text-sm mt-1">Límite: ${formatObjDate(loan.dueDate)}</div>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-icon btn-pay" onclick="openPayModal('${loan.id}')" title="Abonar Pago" ${restante<=0 ? 'disabled' : ''}>
                        <i data-lucide="dollar-sign"></i> <span>Abono</span>
                    </button>
                    <button class="btn btn-icon btn-reminder" onclick="sendReminder('${loan.id}')" title="Enviar Recordatorio por WhatsApp" ${restante<=0 ? 'disabled' : ''}>
                        <i data-lucide="bell"></i> <span>Cobrar</span>
                    </button>
                    <button class="btn btn-icon btn-contract" onclick="generateContract('${loan.id}')" title="Imprimir Pagaré / Contrato">
                        <i data-lucide="printer"></i> <span>Pagaré</span>
                    </button>
                    <button class="btn btn-icon btn-edit" onclick="startEditMode('${loan.id}')" title="Editar Info">
                        <i data-lucide="edit"></i> <span>Edit</span>
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

    if (archivedLoans.length === 0) {
        archiveEmptyState.classList.remove('hidden');
        document.getElementById('archive-table').classList.add('hidden');
    } else {
        archiveEmptyState.classList.add('hidden');
        document.getElementById('archive-table').classList.remove('hidden');
        archivedLoans.forEach((loan, idx) => {
            const tr = document.createElement('tr');
            tr.className = 'fade-in';
            tr.innerHTML = `
                <td>
                    <div class="client-name">${loan.name}</div>
                    <div class="client-notes text-muted text-sm">Archivado</div>
                </td>
                <td class="font-bold">S/ ${loan.amount.toFixed(2)}</td>
                <td><span class="status-badge status-paid"><i data-lucide="check-circle" style="width:12px; height:12px;"></i> Cerrado</span></td>
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
                totalC += loan.amount;
                totalI += loan.interest;
                totalP += mora;
                activeClients++;
            }
        }
    });

    totalLentEl.textContent = `S/ ${totalC.toFixed(2)}`;
    totalInterestEl.textContent = `S/ ${totalI.toFixed(2)}`;
    totalPenaltiesEl.textContent = `S/ ${totalP.toFixed(2)}`;
    clientsCountEl.textContent = activeClients;

    updateChartData(totalC, totalI, totalP);
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
    
    if (n >= 1000000) {
        let millions = Math.floor(n / 1000000);
        words += (millions === 1 ? 'UN MILLÓN' : numberToWords(millions) + ' MILLONES') + ' ';
        n %= 1000000;
    }

    if (n >= 1000) {
        let thousands = Math.floor(n / 1000);
        words += (thousands === 1 ? 'MIL' : numberToWords(thousands) + ' MIL') + ' ';
        n %= 1000;
    }
    
    if (n >= 100) {
        let hundreds = Math.floor(n / 100);
        if (hundreds === 1 && n % 100 === 0) words += 'CIEN ';
        else if (hundreds === 1) words += 'CIENTO ';
        else if (hundreds === 5) words += 'QUINIENTOS ';
        else if (hundreds === 7) words += 'SETECIENTOS ';
        else if (hundreds === 9) words += 'NOVECIENTOS ';
        else words += ones[hundreds] + 'CIENTOS ';
        n %= 100;
    }
    
    if (n >= 20) {
        words += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' Y ' + ones[n % 10] : '') + ' ';
    } else if (n >= 10) {
        words += teens[n - 10] + ' ';
    } else if (n > 0) {
        words += ones[n] + ' ';
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
        <div class="contract-paper">
            <div class="contract-header">
                <center><h2 style="text-decoration: underline; margin-bottom: 30px;">CONTRATO DE MUTUO (PRÉSTAMO DE DINERO)</h2></center>
            </div>
            
            <div class="contract-content">
                <p>Conste por el presente documento privado de Contrato de Mutuo, que se celebra de una parte como <strong>EL PRESTAMISTA</strong>, el <strong>Sr. Juan David Puclla Quispe</strong>, identificado con <strong>DNI N° 60257586</strong>, con domicilio en la ciudad de Cusco; y de la otra parte como <strong>EL PRESTATARIO</strong>, el/la Sr.(a) <strong>${loan.name}</strong>, identificado(a) con <strong>DNI N° ${loan.dni || '..........'}</strong>, con domicilio en <strong>${loan.address || '...................................................'}</strong>, bajo los términos y condiciones siguientes:</p>

                <h3 style="margin-top: 20px;">CLÁUSULAS:</h3>
                
                <p><strong>PRIMERA: OBJETO</strong><br>
                EL PRESTAMISTA entrega en calidad de préstamo al PRESTATARIO la suma de <strong>S/ ${amountStr} (${amountWords} y 00/100 Soles)</strong>. Dicho monto genera un interés pactado de <strong>S/ ${interestStr}</strong>, lo que hace un total a devolver de <strong>S/ ${totalStr}</strong>.</p>

                <p><strong>SEGUNDA: MEDIO DE PAGO Y RECEPCIÓN</strong><br>
                Las partes acuerdan que la entrega y devolución del dinero se realizará mediante efectivo o transferencias electrónicas (Yape, Plin o transferencia bancaria). EL PRESTATARIO declara bajo juramento haber recibido el capital a su entera satisfacción a la firma del presente.</p>

                <p><strong>TERCERA: PLAZO DE DEVOLUCIÓN</strong><br>
                EL PRESTATARIO se obliga a devolver la suma total (capital e intereses) en una sola armada, teniendo como fecha máxima de pago el día <strong>${dDay} de ${dMonth} del ${dYear}</strong>.</p>

                <p><strong>CUARTA: MORA Y PENALIDADES</strong><br>
                En caso de incumplimiento en la fecha pactada, se aplicará una penalidad por mora de <strong>S/ ${PENALTY_PER_DAY.toFixed(2)}</strong> por cada día de retraso, sin perjuicio de las acciones legales que EL PRESTAMISTA decida emprender para recuperar el total del adeudo.</p>

                <p><strong>QUINTA: ALLANAMIENTO ANTICIPADO Y JURISDICCIÓN</strong><br>
                EL PRESTATARIO se somete expresamente a la cláusula de allanamiento anticipado conforme a la Ley N° 30201. Asimismo, en caso de litigio, ambas partes renuncian al fuero de sus domicilios y se someten a la competencia de los jueces y tribunales de la ciudad de Cusco.</p>

                <p><strong>SEXTA: CONFORMIDAD</strong><br>
                Ambas partes declaran que en este acto no existe error, dolo ni mala fe, firmando y poniendo su huella digital en señal de total conformidad en la localidad de <strong>Cusco</strong>, el día <strong>${lDay} de ${lMonth} del ${lYear}</strong>.</p>
            </div>

            <div class="sig-container" style="margin-top: 100px; display: flex; justify-content: space-between;">
                <div class="sig-box" style="text-align: center; width: 45%;">
                    <br>..................................................<br>
                    <strong>EL PRESTAMISTA</strong><br>
                    <strong>DNI: 60257586</strong><br>
                    <strong>Huella:</strong>
                </div>
                <div class="sig-box" style="text-align: center; width: 45%;">
                    <br>..................................................<br>
                    <strong>EL PRESTATARIO</strong><br>
                    <strong>DNI: ${loan.dni || '..........'}</strong><br>
                    <strong>Huella:</strong>
                </div>
            </div>
        </div>
    `;
    
    printArea.classList.remove('hidden');
    window.print();
    printArea.classList.add('hidden');
}

window.handleArchiveLoan = async function(id) {
    if(confirm('¿Seguro de mover esta operación al Historial de Cancelados/Cerrados?')) {
        const loan = loans.find(l => l.id === id);
        if(loan) {
            loan.isArchived = true;
            await putLoanToDB(loan);
            renderTable(loans);
            updateMetrics();
        }
    }
}

window.handleRestoreLoan = async function(id) {
    if(confirm('¿Seguro de restaurar esta operación a tus créditos activos?')) {
        const loan = loans.find(l => l.id === id);
        if(loan) {
            loan.isArchived = false;
            await putLoanToDB(loan);
            renderTable(loans);
            updateMetrics();
        }
    }
}

window.handleDeletePermanent = async function(id) {
    if(confirm('⚠️ ¿ESTÁS SEGURO?\n\nEsta acción eliminará este registro DEL TODO y no se podrá recuperar jamás. ¿Proceder?')) {
        await deleteLoanFromDB(id);
        const idx = loans.findIndex(l => l.id === id);
        if(idx !== -1) {
            loans.splice(idx, 1);
        }
        renderTable(loans);
        updateMetrics();
    }
}

function handleSearch(e) {
    const term = searchInput.value.toLowerCase();
    const filtered = loans.filter(l => l.name.toLowerCase().includes(term));
    renderTable(filtered);
}

function exportToCSV() {
    if(loans.length === 0) {
        alert("Portafolio vacío."); return;
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
        alert("Portafolio vacío."); return;
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
