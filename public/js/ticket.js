/**
 * CJ POS - Módulo de Tickets
 * Genera vista previa, PDF con jsPDF y envío por WhatsApp
 */
const Ticket = (() => {
    let currentVenta = null;

    /** Mostrar ticket tras venta exitosa */
    function show(venta) {
        currentVenta = venta;
        renderPreview(venta);
        document.getElementById('ticket-modal').classList.add('active');
        setupActions();
    }

    /** Renderizar vista previa del ticket */
    function renderPreview(v) {
        const fecha = new Date(v.fecha).toLocaleString('es-MX');
        const detalles = v.detalles || [];
        const metodoLabel = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };
        document.getElementById('ticket-preview').innerHTML = `
            <div class="t-header">
                <div class="t-title">🍔 CJ HAMBURGUESAS</div>
                <div>Ticket de Venta</div>
                <div style="margin-top:4px">Folio: ${v.folio}</div>
                <div>${fecha}</div>
            </div>
            ${detalles.map(d => `
                <div class="t-row">
                    <span>${d.cantidad}x ${d.producto}</span>
                    <span>$${parseFloat(d.subtotal).toFixed(2)}</span>
                </div>
                <div style="font-size:10px;color:#999;padding-left:16px">
                    @ $${parseFloat(d.precio_unitario).toFixed(2)} c/u
                </div>
            `).join('')}
            <div class="t-divider"></div>
            <div class="t-row"><span>Subtotal</span><span>$${parseFloat(v.subtotal).toFixed(2)}</span></div>
            <div class="t-divider"></div>
            <div class="t-row t-total"><span>TOTAL</span><span>$${parseFloat(v.total).toFixed(2)}</span></div>
            <div class="t-divider"></div>
            <div class="t-row"><span>Pago</span><span>${metodoLabel[v.metodo_pago] || v.metodo_pago}</span></div>
            ${v.metodo_pago === 'efectivo' ? `
                <div class="t-row"><span>Recibido</span><span>$${parseFloat(v.monto_recibido).toFixed(2)}</span></div>
                <div class="t-row"><span>Cambio</span><span>$${parseFloat(v.cambio).toFixed(2)}</span></div>
            ` : ''}
            <div class="t-footer">
                <p>¡Gracias por tu compra!</p>
                <p>CJ Hamburguesas</p>
            </div>
        `;
    }

    /** Generar PDF con jsPDF */
    function generatePDF() {
        if (!currentVenta) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: [80, 200] }); // Formato ticket 80mm
        const v = currentVenta;
        const detalles = v.detalles || [];
        let y = 10;
        const lh = 5; // line height
        const center = (text, yPos, size = 8) => {
            doc.setFontSize(size);
            const w = doc.getTextWidth(text);
            doc.text(text, (80 - w) / 2, yPos);
        };

        // Header
        doc.setFont('helvetica', 'bold');
        center('CJ HAMBURGUESAS', y, 14); y += 7;
        doc.setFont('helvetica', 'normal');
        center('Ticket de Venta', y, 9); y += 5;
        center(`Folio: ${v.folio}`, y, 8); y += 4;
        center(new Date(v.fecha).toLocaleString('es-MX'), y, 7); y += 6;

        // Línea divisoria
        doc.setDrawColor(200); doc.line(5, y, 75, y); y += 4;

        // Productos
        doc.setFontSize(8);
        detalles.forEach(d => {
            doc.setFont('helvetica', 'normal');
            doc.text(`${d.cantidad}x ${d.producto}`, 5, y);
            doc.text(`$${parseFloat(d.subtotal).toFixed(2)}`, 75, y, { align: 'right' });
            y += lh;
        });

        y += 2; doc.line(5, y, 75, y); y += 5;

        // Total
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('TOTAL:', 5, y);
        doc.text(`$${parseFloat(v.total).toFixed(2)}`, 75, y, { align: 'right' });
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const metodos = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };
        doc.text(`Pago: ${metodos[v.metodo_pago]}`, 5, y); y += 4;
        if (v.metodo_pago === 'efectivo') {
            doc.text(`Recibido: $${parseFloat(v.monto_recibido).toFixed(2)}`, 5, y); y += 4;
            doc.text(`Cambio: $${parseFloat(v.cambio).toFixed(2)}`, 5, y); y += 4;
        }

        y += 4; doc.line(5, y, 75, y); y += 5;
        center('¡Gracias por tu compra!', y, 9); y += 5;
        center('CJ Hamburguesas', y, 8);

        doc.save(`CJ-Ticket-${v.folio}.pdf`);
        App.toast('PDF descargado', 'success');
    }

    /** Enviar resumen por WhatsApp (API wa.me) */
    function sendWhatsApp() {
        if (!currentVenta) return;
        const v = currentVenta;
        const detalles = (v.detalles || []).map(d =>
            `• ${d.cantidad}x ${d.producto} — $${parseFloat(d.subtotal).toFixed(2)}`
        ).join('\n');
        const msg = `🍔 *CJ HAMBURGUESAS*\n` +
            `📋 Ticket: ${v.folio}\n` +
            `📅 ${new Date(v.fecha).toLocaleString('es-MX')}\n\n` +
            `${detalles}\n\n` +
            `💰 *Total: $${parseFloat(v.total).toFixed(2)}*\n` +
            `💳 Pago: ${v.metodo_pago}\n\n` +
            `¡Gracias por tu preferencia! 🙌`;

        const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    }

    /** Configurar botones del modal de ticket */
    function setupActions() {
        document.getElementById('btn-download-pdf').onclick = generatePDF;
        document.getElementById('btn-whatsapp').onclick = sendWhatsApp;
        document.getElementById('btn-new-sale').onclick = () => {
            document.getElementById('ticket-modal').classList.remove('active');
        };
        document.getElementById('modal-close-ticket').onclick = () => {
            document.getElementById('ticket-modal').classList.remove('active');
        };
    }

    return { show };
})();
