/**
 * CJ POS - Módulo de Inventario
 * Gestión visual del stock de insumos con alertas
 */
const Inventario = (() => {
    let insumos = [];

    async function load() {
        try {
            const res = await App.api('/api/insumos');
            insumos = res.data;
            render();
            updateAlertBadge();
        } catch (e) {
            App.toast('Error al cargar inventario', 'error');
        }
    }

    function render() {
        const grid = document.getElementById('inventario-grid');
        grid.innerHTML = insumos.map(i => {
            const pct = i.stock_minimo > 0 ? Math.min((i.stock_actual / (i.stock_minimo * 3)) * 100, 100) : 100;
            const level = i.stock_actual <= i.stock_minimo ? 'low' : pct < 50 ? 'warning' : '';
            const isLow = i.stock_actual <= i.stock_minimo;
            return `
            <div class="insumo-card ${isLow ? 'stock-bajo' : ''}">
                <div class="insumo-card-header">
                    <div>
                        <div class="insumo-nombre">${i.nombre}</div>
                    </div>
                    <span class="insumo-unidad">${i.unidad_medida}</span>
                </div>
                <div class="stock-bar-container">
                    <div class="stock-label">
                        <span>Stock: ${parseFloat(i.stock_actual).toLocaleString()}</span>
                        <span>Mín: ${parseFloat(i.stock_minimo).toLocaleString()}</span>
                    </div>
                    <div class="stock-bar">
                        <div class="stock-bar-fill ${level}" style="width:${pct}%"></div>
                    </div>
                </div>
                <div class="insumo-actions">
                    <button class="btn-restock" onclick="Inventario.openRestock(${i.id}, '${i.nombre.replace(/'/g, "\\'")}')">
                        + Reabastecer
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    function updateAlertBadge() {
        const alertas = insumos.filter(i => i.stock_actual <= i.stock_minimo);
        const badge = document.getElementById('stock-alert-badge');
        if (alertas.length > 0) {
            badge.style.display = 'flex';
            document.getElementById('alert-count').textContent = alertas.length;
        } else {
            badge.style.display = 'none';
        }
    }

    function openRestock(id, nombre) {
        document.getElementById('restock-insumo-name').textContent = nombre;
        document.getElementById('restock-cantidad').value = '';
        document.getElementById('restock-modal').classList.add('active');
        // Guardar ID para confirmar
        document.getElementById('btn-confirm-restock').onclick = () => confirmRestock(id);
        document.getElementById('modal-close-restock').onclick = closeRestock;
        document.getElementById('btn-cancel-restock').onclick = closeRestock;
    }

    function closeRestock() {
        document.getElementById('restock-modal').classList.remove('active');
    }

    async function confirmRestock(id) {
        const cantidad = parseFloat(document.getElementById('restock-cantidad').value);
        if (!cantidad || cantidad <= 0) {
            App.toast('Ingresa una cantidad válida', 'error');
            return;
        }
        try {
            await App.api(`/api/insumos/${id}/reabastecer`, {
                method: 'POST', body: { cantidad }
            });
            App.toast('Insumo reabastecido correctamente', 'success');
            closeRestock();
            load(); // Recargar
        } catch (e) {
            App.toast(e.message, 'error');
        }
    }

    return { load, openRestock };
})();
