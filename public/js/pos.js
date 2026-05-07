/**
 * CJ POS - Módulo Punto de Venta
 * Maneja productos, carrito, búsqueda y proceso de pago
 */
const POS = (() => {
    let productos = [];
    let carrito = [];
    const EMOJIS = {
        hamburguesas: '🍔', complementos: '🍟',
        bebidas: '🥤', postres: '🍩', combos: '⭐'
    };

    /** Cargar productos desde API */
    async function loadProducts() {
        try {
            const res = await App.api('/api/productos');
            productos = res.data;
            renderProducts(productos);
        } catch (e) {
            App.toast('Error al cargar productos', 'error');
        }
    }

    /** Renderizar grid de productos */
    function renderProducts(list) {
        const grid = document.getElementById('products-grid');
        grid.innerHTML = list.map(p => `
            <div class="product-card" data-id="${p.id}" onclick="POS.addToCart(${p.id})">
                <span class="product-emoji">${EMOJIS[p.categoria] || '🍔'}</span>
                <div class="product-name">${p.nombre}</div>
                <div class="product-desc">${p.descripcion || ''}</div>
                <div class="product-price">${App.formatMoney(p.precio_venta)}</div>
            </div>
        `).join('');
    }

    /** Filtrar por categoría */
    function setupCategoryFilters() {
        document.getElementById('category-filters').addEventListener('click', e => {
            const btn = e.target.closest('.cat-btn');
            if (!btn) return;
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const cat = btn.dataset.category;
            renderProducts(cat === 'todos' ? productos : productos.filter(p => p.categoria === cat));
        });
    }

    /** Búsqueda en tiempo real */
    function setupSearch() {
        document.getElementById('search-input').addEventListener('input', e => {
            const q = e.target.value.toLowerCase();
            renderProducts(productos.filter(p =>
                p.nombre.toLowerCase().includes(q) || (p.descripcion || '').toLowerCase().includes(q)
            ));
        });
    }

    /** Agregar producto al carrito */
    function addToCart(productId) {
        const producto = productos.find(p => p.id === productId);
        if (!producto) return;
        const existing = carrito.find(item => item.producto_id === productId);
        if (existing) {
            existing.cantidad++;
        } else {
            carrito.push({
                producto_id: producto.id,
                nombre: producto.nombre,
                precio_unitario: parseFloat(producto.precio_venta),
                cantidad: 1
            });
        }
        renderCart();
        App.toast(`${producto.nombre} agregado`, 'success');
    }

    /** Renderizar carrito — FIXED: ya no destruye el DOM del empty state */
    function renderCart() {
        const container = document.getElementById('cart-items');

        if (carrito.length === 0) {
            container.innerHTML = `
                <div class="cart-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                    <p>Agrega productos</p>
                </div>`;
            updateTotals();
            return;
        }

        container.innerHTML = carrito.map((item, i) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.nombre}</div>
                    <div class="cart-item-price">${App.formatMoney(item.precio_unitario)} c/u</div>
                </div>
                <div class="cart-item-qty">
                    <button class="qty-btn" onclick="POS.changeQty(${i}, -1)">−</button>
                    <span class="qty-value">${item.cantidad}</span>
                    <button class="qty-btn" onclick="POS.changeQty(${i}, 1)">+</button>
                </div>
                <div class="cart-item-total">${App.formatMoney(item.precio_unitario * item.cantidad)}</div>
            </div>
        `).join('');
        updateTotals();
    }

    /** Cambiar cantidad de item en carrito */
    function changeQty(index, delta) {
        carrito[index].cantidad += delta;
        if (carrito[index].cantidad <= 0) carrito.splice(index, 1);
        renderCart();
    }

    /** Actualizar totales */
    function updateTotals() {
        const subtotal = carrito.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
        document.getElementById('cart-subtotal').textContent = App.formatMoney(subtotal);
        document.getElementById('cart-total').textContent = App.formatMoney(subtotal);
        document.getElementById('btn-cobrar').disabled = carrito.length === 0;
    }

    /** Vaciar carrito */
    function clearCart() {
        carrito = [];
        renderCart();
    }

    /** Abrir modal de pago */
    function openPaymentModal() {
        if (carrito.length === 0) return;
        const total = carrito.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
        document.getElementById('payment-amount').textContent = App.formatMoney(total);
        document.getElementById('payment-modal').classList.add('active');
        // Botones de monto rápido
        const quickCash = document.getElementById('quick-cash');
        const amounts = [50, 100, 200, 500, 1000].filter(a => a >= total);
        quickCash.innerHTML = amounts.map(a =>
            `<button class="quick-cash-btn" onclick="document.getElementById('monto-recibido').value=${a}; POS.updateChange()">\\$${a}</button>`
        ).join('');
        document.getElementById('monto-recibido').value = '';
        document.getElementById('cambio-amount').textContent = '$0.00';
        document.getElementById('btn-confirm-payment').disabled = false;
        updatePaymentMethod();
    }

    /** Manejar cambio de método de pago */
    function updatePaymentMethod() {
        const method = document.querySelector('input[name="metodo_pago"]:checked').value;
        const cashSection = document.getElementById('cash-section');
        cashSection.style.display = method === 'efectivo' ? 'flex' : 'none';
        if (method !== 'efectivo') {
            document.getElementById('btn-confirm-payment').disabled = false;
        } else {
            updateChange();
        }
    }

    /** Calcular cambio */
    function updateChange() {
        const total = carrito.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
        const received = parseFloat(document.getElementById('monto-recibido').value) || 0;
        const cambio = received - total;
        document.getElementById('cambio-amount').textContent = App.formatMoney(Math.max(0, cambio));
        document.getElementById('btn-confirm-payment').disabled = received < total;
    }

    /** Confirmar venta — envía al backend transaccional */
    async function confirmSale() {
        const btn = document.getElementById('btn-confirm-payment');
        btn.disabled = true;
        btn.textContent = 'Procesando...';
        try {
            const metodo_pago = document.querySelector('input[name="metodo_pago"]:checked').value;
            const monto_recibido = metodo_pago === 'efectivo'
                ? parseFloat(document.getElementById('monto-recibido').value) : null;
            const body = {
                items: carrito.map(i => ({
                    producto_id: i.producto_id,
                    cantidad: i.cantidad,
                    precio_unitario: i.precio_unitario
                })),
                metodo_pago,
                monto_recibido
            };
            const res = await App.api('/api/ventas', { method: 'POST', body });
            // Cerrar modal de pago y mostrar ticket
            document.getElementById('payment-modal').classList.remove('active');
            Ticket.show(res.data);
            App.toast('¡Venta completada exitosamente!', 'success');
            clearCart();
        } catch (e) {
            App.toast(e.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Confirmar Venta';
        }
    }

    /** Setup event listeners */
    function setupEvents() {
        setupCategoryFilters();
        setupSearch();
        document.getElementById('btn-cobrar').addEventListener('click', openPaymentModal);
        document.getElementById('btn-clear-cart').addEventListener('click', clearCart);
        document.getElementById('modal-close-payment').addEventListener('click', () =>
            document.getElementById('payment-modal').classList.remove('active'));
        document.getElementById('btn-cancel-payment').addEventListener('click', () =>
            document.getElementById('payment-modal').classList.remove('active'));
        document.getElementById('btn-confirm-payment').addEventListener('click', confirmSale);
        document.getElementById('monto-recibido').addEventListener('input', updateChange);
        document.querySelectorAll('input[name="metodo_pago"]').forEach(r =>
            r.addEventListener('change', updatePaymentMethod));
    }

    function init() {
        loadProducts();
        setupEvents();
    }

    return { init, addToCart, changeQty, updateChange, clearCart, loadProducts };
})();
