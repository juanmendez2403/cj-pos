/**
 * CJ POS - App Controller
 * Controlador principal: navegación, utilidades, reloj
 */
const App = (() => {
    const API = '';

    /** Fetch wrapper con manejo de errores */
    async function api(endpoint, options = {}) {
        const res = await fetch(`${API}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error de servidor');
        return data;
    }

    /** Mostrar notificación toast */
    function toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.textContent = message;
        container.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
    }

    /** Formatear moneda MXN */
    function formatMoney(n) {
        return '$' + parseFloat(n).toFixed(2);
    }

    /** Navegación entre vistas */
    function setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
                document.getElementById(`${view}-view`).classList.add('active-view');
                // Cargar datos al cambiar de vista
                if (view === 'gestion') Gestion.load();
                if (view === 'inventario') Inventario.load();
                if (view === 'reportes') Reportes.load();
            });
        });
    }

    /** Reloj en sidebar */
    function startClock() {
        function update() {
            const now = new Date();
            document.getElementById('sidebar-clock').textContent =
                now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            document.getElementById('sidebar-date').textContent =
                now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
        }
        update();
        setInterval(update, 1000);
    }

    /** Inicializar la aplicación */
    function init() {
        setupNavigation();
        startClock();
        POS.init();
        Gestion.init();
        // Establecer fecha de hoy en el input de reportes
        const dateInput = document.getElementById('report-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().slice(0, 10);
            dateInput.addEventListener('change', () => Reportes.load());
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return { api, toast, formatMoney };
})();
