/**
 * CJ POS - Módulo de Reportes
 * Reporte diario con resumen, desglose por pago y top productos
 */
const Reportes = (() => {
    async function load() {
        try {
            const fecha = document.getElementById('report-date').value ||
                new Date().toISOString().slice(0, 10);
            const res = await App.api(`/api/reportes/diario?fecha=${fecha}`);
            renderStats(res.data.resumen);
            renderPaymentBreakdown(res.data.porMetodoPago);
            renderTopProducts(res.data.topProductos);
            await loadSalesHistory(fecha);
        } catch (e) {
            App.toast('Error al cargar reportes', 'error');
        }
    }

    function renderStats(r) {
        const grid = document.getElementById('stats-grid');
        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Ventas Totales</div>
                <div class="stat-value accent">${r.total_ventas}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ingresos del Día</div>
                <div class="stat-value success">${App.formatMoney(r.ingresos_totales)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ticket Promedio</div>
                <div class="stat-value">${App.formatMoney(r.ticket_promedio)}</div>
            </div>
        `;
    }

    function renderPaymentBreakdown(data) {
        const section = document.getElementById('payment-breakdown');
        const labels = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', transferencia: '🏦 Transferencia' };
        section.innerHTML = `
            <h3>Desglose por Método de Pago</h3>
            <table class="report-table">
                <thead><tr><th>Método</th><th>Cantidad</th><th>Total</th></tr></thead>
                <tbody>${data.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">Sin datos</td></tr>' :
                data.map(d => `<tr><td>${labels[d.metodo_pago] || d.metodo_pago}</td><td>${d.cantidad}</td><td>${App.formatMoney(d.total)}</td></tr>`).join('')}
                </tbody>
            </table>
        `;
    }

    function renderTopProducts(data) {
        const section = document.getElementById('top-products');
        section.innerHTML = `
            <h3>Productos Más Vendidos</h3>
            <table class="report-table">
                <thead><tr><th>Producto</th><th>Vendidos</th><th>Ingresos</th></tr></thead>
                <tbody>${data.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">Sin datos</td></tr>' :
                data.map(d => `<tr><td>${d.nombre}</td><td>${d.cantidad_vendida}</td><td>${App.formatMoney(d.ingresos)}</td></tr>`).join('')}
                </tbody>
            </table>
        `;
    }

    async function loadSalesHistory(fecha) {
        try {
            const res = await App.api('/api/ventas/hoy');
            const section = document.getElementById('sales-history');
            section.innerHTML = `
                <h3>Historial de Ventas</h3>
                <table class="report-table">
                    <thead><tr><th>Folio</th><th>Hora</th><th>Productos</th><th>Pago</th><th>Total</th></tr></thead>
                    <tbody>${res.data.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Sin ventas hoy</td></tr>' :
                    res.data.map(v => `<tr>
                        <td style="font-weight:600">${v.folio}</td>
                        <td>${new Date(v.fecha).toLocaleTimeString('es-MX', {hour:'2-digit',minute:'2-digit'})}</td>
                        <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${v.resumen_productos || '-'}</td>
                        <td>${v.metodo_pago}</td>
                        <td style="font-weight:700;color:var(--accent)">${App.formatMoney(v.total)}</td>
                    </tr>`).join('')}
                    </tbody>
                </table>
            `;
        } catch(e) { /* silencio */ }
    }

    return { load };
})();
