// Telegram Web App initialization
let tg = window.Telegram?.WebApp;
let user = null;
let userRole = 'agent'; // Default role

// Configuration
const CONFIG = {
    webhookUrl: 'https://amp-telegram.app.n8n.cloud/webhook/neuer-auftrag',
    googleMapsApiKey: '', // Add your Google Maps API key here
    roles: {
        agent: ['new-order', 'search-orders', 'my-orders', 'report-revenue', 'report-waiting'],
        monteur: ['my-orders', 'report-revenue', 'report-waiting'],
        admin: ['new-order', 'search-orders', 'my-orders', 'report-revenue', 'report-waiting', 'daily-report']
    }
};

// Application state
const state = {
    currentPage: 'home',
    orders: [],
    duplicateCheckCache: new Map(),
    lastAddressValidation: null
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeTelegramWebApp();
    initializeEventListeners();
    loadInitialData();
    setReportDateToToday();
});

// Telegram Web App initialization
function initializeTelegramWebApp() {
    if (tg) {
        tg.ready();
        tg.expand();
        
        // Get user information
        user = tg.initDataUnsafe?.user;
        if (user) {
            document.getElementById('user-name').textContent = user.first_name || 'Benutzer';
            
            // Determine user role based on user ID (you can customize this logic)
            userRole = determineUserRole(user.id);
            updateUserRole(userRole);
        }
        
        // Apply Telegram theme
        if (tg.colorScheme === 'dark') {
            document.body.classList.add('dark');
        }
        
        // Handle theme changes
        tg.onEvent('themeChanged', function() {
            if (tg.colorScheme === 'dark') {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }
        });
        
        // Set main button
        tg.MainButton.setText('Schließen');
        tg.MainButton.onClick(() => tg.close());
    } else {
        // Fallback for testing outside Telegram
        console.warn('Telegram Web App not available. Running in fallback mode.');
        user = { id: 12345, first_name: 'Test User' };
        userRole = 'admin'; // Default to admin for testing
        updateUserRole(userRole);
    }
}

// Determine user role based on user ID
function determineUserRole(userId) {
    // Customize this logic based on your requirements
    const adminIds = [12345, 67890]; // Add admin user IDs
    const monteurIds = [11111, 22222]; // Add monteur user IDs
    
    if (adminIds.includes(userId)) {
        return 'admin';
    } else if (monteurIds.includes(userId)) {
        return 'monteur';
    } else {
        return 'agent';
    }
}

// Update user role in UI
function updateUserRole(role) {
    const roleElement = document.getElementById('user-role');
    const bodyElement = document.body;
    
    // Remove existing role classes
    bodyElement.classList.remove('role-agent', 'role-monteur', 'role-admin');
    roleElement.classList.remove('admin', 'monteur');
    
    // Add new role class
    bodyElement.classList.add(`role-${role}`);
    
    // Update role badge
    switch (role) {
        case 'admin':
            roleElement.textContent = 'Admin';
            roleElement.classList.add('admin');
            break;
        case 'monteur':
            roleElement.textContent = 'Monteur';
            roleElement.classList.add('monteur');
            break;
        default:
            roleElement.textContent = 'Agent';
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Form submissions
    document.getElementById('new-order-form').addEventListener('submit', handleNewOrderSubmit);
    document.getElementById('revenue-form').addEventListener('submit', handleRevenueSubmit);
    document.getElementById('waiting-form').addEventListener('submit', handleWaitingSubmit);
    
    // Real-time validation
    document.getElementById('customer-phone').addEventListener('blur', validatePhoneNumber);
    document.getElementById('customer-address').addEventListener('blur', validateAddress);
    
    // Search functionality
    document.getElementById('search-input').addEventListener('input', debounce(searchOrders, 300));
    document.getElementById('status-filter').addEventListener('change', searchOrders);
    document.getElementById('industry-filter').addEventListener('change', searchOrders);
    
    // Set today's date for report
    document.getElementById('report-date').value = new Date().toISOString().split('T')[0];
}

// Load initial data
async function loadInitialData() {
    showLoading(true);
    try {
        await Promise.all([
            loadDashboardStats(),
            loadMyOrders(),
            loadOrdersForDropdowns()
        ]);
    } catch (error) {
        console.error('Error loading initial data:', error);
        showToast('Fehler beim Laden der Daten', 'error');
    } finally {
        showLoading(false);
    }
}

// Set report date to today
function setReportDateToToday() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('report-date').value = today;
}

// Page navigation
function showPage(pageId) {
    // Check if user has permission for this page
    if (!hasPermission(pageId)) {
        showToast('Keine Berechtigung für diese Seite', 'error');
        return;
    }
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show target page
    const targetPage = document.getElementById(pageId + '-page');
    if (targetPage) {
        targetPage.classList.add('active');
        state.currentPage = pageId;
        
        // Load page-specific data
        switch (pageId) {
            case 'my-orders':
                loadMyOrders();
                break;
            case 'search-orders':
                searchOrders();
                break;
            case 'report-revenue':
            case 'report-waiting':
                loadOrdersForDropdowns();
                break;
        }
    }
}

// Check user permissions
function hasPermission(pageId) {
    return CONFIG.roles[userRole]?.includes(pageId) || pageId === 'home';
}

// Generate UUID for order numbers
function generateUUID() {
    return 'AMP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Validate phone number and check for duplicates
async function validatePhoneNumber() {
    const phoneInput = document.getElementById('customer-phone');
    const validationDiv = document.getElementById('phone-validation');
    const phone = phoneInput.value.trim();
    
    if (!phone) {
        validationDiv.innerHTML = '';
        return;
    }
    
    // Basic phone validation
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
        showValidationMessage(validationDiv, 'Ungültige Telefonnummer', 'error');
        return;
    }
    
    // Check for duplicates
    try {
        const isDuplicate = await checkPhoneDuplicate(phone);
        if (isDuplicate) {
            showValidationMessage(validationDiv, 'Telefonnummer bereits vorhanden', 'error');
        } else {
            showValidationMessage(validationDiv, 'Telefonnummer verfügbar', 'success');
        }
    } catch (error) {
        console.error('Error checking phone duplicate:', error);
    }
}

// Validate address with Google Maps API
async function validateAddress() {
    const addressInput = document.getElementById('customer-address');
    const validationDiv = document.getElementById('address-validation');
    const address = addressInput.value.trim();
    
    if (!address) {
        validationDiv.innerHTML = '';
        return;
    }
    
    if (!CONFIG.googleMapsApiKey) {
        showValidationMessage(validationDiv, 'Adressvalidierung nicht konfiguriert', 'warning');
        return;
    }
    
    try {
        const isValid = await validateAddressWithGoogleMaps(address);
        if (isValid) {
            showValidationMessage(validationDiv, 'Adresse gefunden', 'success');
        } else {
            showValidationMessage(validationDiv, 'Adresse nicht eindeutig - bitte präzisieren', 'warning');
        }
    } catch (error) {
        console.error('Error validating address:', error);
        showValidationMessage(validationDiv, 'Adressvalidierung fehlgeschlagen', 'error');
    }
}

// Check for phone number duplicates
async function checkPhoneDuplicate(phone) {
    // Check cache first
    if (state.duplicateCheckCache.has(phone)) {
        return state.duplicateCheckCache.get(phone);
    }
    
    try {
        const response = await fetch(CONFIG.webhookUrl + '/check-duplicate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, type: 'phone' })
        });
        
        if (response.ok) {
            const result = await response.json();
            const isDuplicate = result.exists;
            state.duplicateCheckCache.set(phone, isDuplicate);
            return isDuplicate;
        }
    } catch (error) {
        console.error('Error checking duplicate:', error);
    }
    
    return false;
}

// Validate address with Google Maps API
async function validateAddressWithGoogleMaps(address) {
    if (!CONFIG.googleMapsApiKey) return true;
    
    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${CONFIG.googleMapsApiKey}`
        );
        
        if (response.ok) {
            const data = await response.json();
            return data.status === 'OK' && data.results.length > 0;
        }
    } catch (error) {
        console.error('Google Maps API error:', error);
    }
    
    return true; // Fallback to true if API fails
}

// Show validation message
function showValidationMessage(element, message, type) {
    element.innerHTML = `<div class="validation-feedback ${type}">${message}</div>`;
}

// Handle new order form submission
async function handleNewOrderSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const orderData = {
        orderNumber: generateUUID(),
        customerName: formData.get('customerName'),
        customerAddress: formData.get('customerAddress'),
        customerPhone: formData.get('customerPhone'),
        description: formData.get('description'),
        industry: formData.get('industry'),
        priority: formData.get('priority'),
        estimatedRevenue: parseFloat(formData.get('estimatedRevenue')) || 0,
        country: formData.get('country'),
        status: 'offen',
        createdAt: new Date().toISOString(),
        createdBy: user?.id || 'unknown',
        createdByName: user?.first_name || 'Unbekannt'
    };
    
    // Validate required fields
    if (!validateOrderData(orderData)) {
        return;
    }
    
    // Check for duplicates
    const phoneExists = await checkPhoneDuplicate(orderData.customerPhone);
    if (phoneExists) {
        showToast('Telefonnummer bereits vorhanden', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(CONFIG.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'new-order',
                data: orderData,
                user: user
            })
        });
        
        if (response.ok) {
            showToast('Auftrag erfolgreich erstellt', 'success');
            event.target.reset();
            state.duplicateCheckCache.clear();
            loadDashboardStats();
            
            // Show success message with order number
            showToast(`Auftragsnummer: ${orderData.orderNumber}`, 'success');
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        console.error('Error creating order:', error);
        showToast('Fehler beim Erstellen des Auftrags', 'error');
    } finally {
        showLoading(false);
    }
}

// Validate order data
function validateOrderData(data) {
    const required = ['customerName', 'customerAddress', 'customerPhone', 'description', 'industry', 'priority', 'country'];
    
    for (const field of required) {
        if (!data[field] || data[field].toString().trim() === '') {
            showToast(`Feld "${field}" ist erforderlich`, 'error');
            return false;
        }
    }
    
    // Validate phone number format
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(data.customerPhone.replace(/[\s\-\(\)]/g, ''))) {
        showToast('Ungültige Telefonnummer', 'error');
        return false;
    }
    
    return true;
}

// Reset form
function resetForm() {
    document.getElementById('new-order-form').reset();
    document.querySelectorAll('.validation-feedback').forEach(el => el.innerHTML = '');
    state.duplicateCheckCache.clear();
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const response = await fetch(CONFIG.webhookUrl + '/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get-stats',
                user: user
            })
        });
        
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('open-orders').textContent = stats.openOrders || 0;
            document.getElementById('today-revenue').textContent = `${stats.todayRevenue || 0}€`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load user's orders
async function loadMyOrders() {
    const container = document.getElementById('my-orders-list');
    
    try {
        const response = await fetch(CONFIG.webhookUrl + '/my-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get-my-orders',
                user: user,
                role: userRole
            })
        });
        
        if (response.ok) {
            const orders = await response.json();
            displayOrders(orders, container);
        }
    } catch (error) {
        console.error('Error loading my orders:', error);
        container.innerHTML = '<p>Fehler beim Laden der Aufträge</p>';
    }
}

// Search orders
async function searchOrders() {
    const searchInput = document.getElementById('search-input').value;
    const statusFilter = document.getElementById('status-filter').value;
    const industryFilter = document.getElementById('industry-filter').value;
    const container = document.getElementById('search-results');
    
    try {
        const response = await fetch(CONFIG.webhookUrl + '/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'search-orders',
                query: searchInput,
                status: statusFilter,
                industry: industryFilter,
                user: user,
                role: userRole
            })
        });
        
        if (response.ok) {
            const orders = await response.json();
            displayOrders(orders, container);
        }
    } catch (error) {
        console.error('Error searching orders:', error);
        container.innerHTML = '<p>Fehler beim Suchen der Aufträge</p>';
    }
}

// Display orders in container
function displayOrders(orders, container) {
    if (!orders || orders.length === 0) {
        container.innerHTML = '<p>Keine Aufträge gefunden</p>';
        return;
    }
    
    const ordersHtml = orders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <span class="order-number">${order.orderNumber}</span>
                <span class="order-status ${order.status}">${getStatusText(order.status)}</span>
            </div>
            <div class="order-customer">${order.customerName}</div>
            <div class="order-description">${order.description}</div>
            <div class="order-meta">
                <span>📞 ${order.customerPhone}</span>
                <span>🏢 ${getIndustryText(order.industry)}</span>
                <span>⚡ ${getPriorityText(order.priority)}</span>
                <span>📅 ${formatDate(order.createdAt)}</span>
            </div>
            ${getOrderActions(order)}
        </div>
    `).join('');
    
    container.innerHTML = ordersHtml;
}

// Get order actions based on role and status
function getOrderActions(order) {
    const actions = [];
    
    if (userRole === 'admin') {
        actions.push(`<button class="btn btn-primary" onclick="editOrder('${order.orderNumber}')">Bearbeiten</button>`);
        if (order.status === 'offen') {
            actions.push(`<button class="btn btn-success" onclick="assignOrder('${order.orderNumber}')">Zuweisen</button>`);
        }
        if (order.status !== 'abgeschlossen' && order.status !== 'storniert') {
            actions.push(`<button class="btn btn-error" onclick="cancelOrder('${order.orderNumber}')">Stornieren</button>`);
        }
    }
    
    if ((userRole === 'monteur' || userRole === 'admin') && order.status === 'in-bearbeitung') {
        actions.push(`<button class="btn btn-success" onclick="completeOrder('${order.orderNumber}')">Abschließen</button>`);
    }
    
    if (actions.length === 0) {
        return '';
    }
    
    return `<div class="order-actions">${actions.join('')}</div>`;
}

// Load orders for dropdowns
async function loadOrdersForDropdowns() {
    try {
        const response = await fetch(CONFIG.webhookUrl + '/available-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get-available-orders',
                user: user,
                role: userRole
            })
        });
        
        if (response.ok) {
            const orders = await response.json();
            populateOrderDropdowns(orders);
        }
    } catch (error) {
        console.error('Error loading orders for dropdowns:', error);
    }
}

// Populate order dropdowns
function populateOrderDropdowns(orders) {
    const revenueSelect = document.getElementById('order-select');
    const waitingSelect = document.getElementById('waiting-order-select');
    
    const options = orders.map(order => 
        `<option value="${order.orderNumber}">${order.orderNumber} - ${order.customerName}</option>`
    ).join('');
    
    revenueSelect.innerHTML = '<option value="">Bitte wählen...</option>' + options;
    waitingSelect.innerHTML = '<option value="">Bitte wählen...</option>' + options;
}

// Handle revenue report submission
async function handleRevenueSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const revenueData = {
        orderId: formData.get('orderId'),
        amount: parseFloat(formData.get('amount')),
        paymentMethod: formData.get('paymentMethod'),
        notes: formData.get('notes'),
        reportedBy: user?.id || 'unknown',
        reportedByName: user?.first_name || 'Unbekannt',
        reportedAt: new Date().toISOString()
    };
    
    if (!revenueData.orderId || !revenueData.amount || !revenueData.paymentMethod) {
        showToast('Bitte alle Pflichtfelder ausfüllen', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(CONFIG.webhookUrl + '/revenue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'report-revenue',
                data: revenueData,
                user: user
            })
        });
        
        if (response.ok) {
            showToast('Umsatz erfolgreich gemeldet', 'success');
            event.target.reset();
            loadDashboardStats();
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        console.error('Error reporting revenue:', error);
        showToast('Fehler beim Melden des Umsatzes', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle waiting time report submission
async function handleWaitingSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const waitingData = {
        orderId: formData.get('orderId'),
        waitingTime: parseInt(formData.get('waitingTime')),
        reason: formData.get('reason'),
        reportedBy: user?.id || 'unknown',
        reportedByName: user?.first_name || 'Unbekannt',
        reportedAt: new Date().toISOString()
    };
    
    if (!waitingData.orderId || !waitingData.waitingTime) {
        showToast('Bitte alle Pflichtfelder ausfüllen', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(CONFIG.webhookUrl + '/waiting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'report-waiting',
                data: waitingData,
                user: user
            })
        });
        
        if (response.ok) {
            showToast('Wartezeit erfolgreich gemeldet', 'success');
            event.target.reset();
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        console.error('Error reporting waiting time:', error);
        showToast('Fehler beim Melden der Wartezeit', 'error');
    } finally {
        showLoading(false);
    }
}

// Generate daily report
async function generateDailyReport() {
    const date = document.getElementById('report-date').value;
    const container = document.getElementById('daily-report-content');
    
    if (!date) {
        showToast('Bitte Datum auswählen', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(CONFIG.webhookUrl + '/daily-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'generate-daily-report',
                date: date,
                user: user
            })
        });
        
        if (response.ok) {
            const report = await response.json();
            displayDailyReport(report, container);
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        console.error('Error generating daily report:', error);
        container.innerHTML = '<p>Fehler beim Generieren des Reports</p>';
    } finally {
        showLoading(false);
    }
}

// Display daily report
function displayDailyReport(report, container) {
    const reportHtml = `
        <div class="report-section">
            <h3>Aufträge</h3>
            <div class="report-grid">
                <div class="report-card">
                    <div class="number">${report.orders.new}</div>
                    <div class="label">Neue Aufträge</div>
                </div>
                <div class="report-card">
                    <div class="number">${report.orders.completed}</div>
                    <div class="label">Abgeschlossen</div>
                </div>
                <div class="report-card">
                    <div class="number">${report.orders.cancelled}</div>
                    <div class="label">Storniert</div>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h3>Umsätze</h3>
            <div class="report-grid">
                <div class="report-card">
                    <div class="number">${report.revenue.total}€</div>
                    <div class="label">Gesamtumsatz</div>
                </div>
                <div class="report-card">
                    <div class="number">${report.revenue.cash}€</div>
                    <div class="label">Bar</div>
                </div>
                <div class="report-card">
                    <div class="number">${report.revenue.card}€</div>
                    <div class="label">Karte</div>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h3>Branchen</h3>
            <div class="report-grid">
                ${Object.entries(report.industries).map(([industry, count]) => `
                    <div class="report-card">
                        <div class="number">${count}</div>
                        <div class="label">${getIndustryText(industry)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = reportHtml;
}

// Order management functions (Admin only)
async function editOrder(orderNumber) {
    // Implementation for editing orders
    showToast('Bearbeitung wird geöffnet...', 'info');
}

async function assignOrder(orderNumber) {
    // Implementation for assigning orders
    showToast('Zuweisung wird geöffnet...', 'info');
}

async function cancelOrder(orderNumber) {
    if (confirm('Auftrag wirklich stornieren?')) {
        try {
            const response = await fetch(CONFIG.webhookUrl + '/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'cancel-order',
                    orderNumber: orderNumber,
                    user: user
                })
            });
            
            if (response.ok) {
                showToast('Auftrag storniert', 'success');
                loadMyOrders();
                searchOrders();
            }
        } catch (error) {
            console.error('Error cancelling order:', error);
            showToast('Fehler beim Stornieren', 'error');
        }
    }
}

async function completeOrder(orderNumber) {
    try {
        const response = await fetch(CONFIG.webhookUrl + '/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'complete-order',
                orderNumber: orderNumber,
                user: user
            })
        });
        
        if (response.ok) {
            showToast('Auftrag abgeschlossen', 'success');
            loadMyOrders();
            searchOrders();
        }
    } catch (error) {
        console.error('Error completing order:', error);
        showToast('Fehler beim Abschließen', 'error');
    }
}

// Utility functions
function getStatusText(status) {
    const statusMap = {
        'offen': 'Offen',
        'in-bearbeitung': 'In Bearbeitung',
        'abgeschlossen': 'Abgeschlossen',
        'storniert': 'Storniert'
    };
    return statusMap[status] || status;
}

function getIndustryText(industry) {
    const industryMap = {
        'rohrreinigung': 'Rohrreinigung',
        'schluesseldienst': 'Schlüsseldienst',
        'schaedlingsbekaempfung': 'Schädlingsbekämpfung',
        'sanitaer': 'Sanitär'
    };
    return industryMap[industry] || industry;
}

function getPriorityText(priority) {
    const priorityMap = {
        'dringend': 'Dringend',
        'normal': 'Normal',
        'niedrig': 'Niedrig'
    };
    return priorityMap[priority] || priority;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions for global access
window.showPage = showPage;
window.resetForm = resetForm;
window.searchOrders = searchOrders;
window.generateDailyReport = generateDailyReport;
window.editOrder = editOrder;
window.assignOrder = assignOrder;
window.cancelOrder = cancelOrder;
window.completeOrder = completeOrder;