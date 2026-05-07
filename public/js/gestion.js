/**
 * CJ POS - Módulo de Gestión de Productos
 * CRUD de productos con gestión de recetas/ingredientes
 * Usa modales propios en lugar de confirm()/prompt() nativos
 */
const Gestion = (() => {
    let productos = [];
    let insumos = [];
    let editingProductId = null;

    const EMOJIS = {
        hamburguesas: '🍔', complementos: '🍟',
        bebidas: '🥤', postres: '🍩', combos: '⭐'
    };

    // ==========================================
    // MODAL DE CONFIRMACIÓN PERSONALIZADO
    // (reemplaza confirm() nativo que puede ser bloqueado)
    // ==========================================
    function showConfirm(message) {
        return new Promise(resolve => {
            const overlay = document.getElementById('confirm-modal');
            document.getElementById('confirm-message').textContent = message;
            overlay.classList.add('active');

            const btnYes = document.getElementById('confirm-yes');
            const btnNo = document.getElementById('confirm-no');

            function cleanup() {
                overlay.classList.remove('active');
                btnYes.removeEventListener('click', onYes);
                btnNo.removeEventListener('click', onNo);
            }
            function onYes() { cleanup(); resolve(true); }
            function onNo() { cleanup(); resolve(false); }

            btnYes.addEventListener('click', onYes);
            btnNo.addEventListener('click', onNo);
        });
    }

    /** Modal prompt personalizado (reemplaza prompt() nativo) */
    function showPrompt(message, defaultValue) {
        return new Promise(resolve => {
            const overlay = document.getElementById('prompt-modal');
            document.getElementById('prompt-message').textContent = message;
            const input = document.getElementById('prompt-input');
            input.value = defaultValue || '';
            overlay.classList.add('active');
            input.focus();
            input.select();

            const btnOk = document.getElementById('prompt-ok');
            const btnCancel = document.getElementById('prompt-cancel');

            function cleanup() {
                overlay.classList.remove('active');
                btnOk.removeEventListener('click', onOk);
                btnCancel.removeEventListener('click', onCancel);
                input.removeEventListener('keydown', onKey);
            }
            function onOk() { cleanup(); resolve(input.value); }
            function onCancel() { cleanup(); resolve(null); }
            function onKey(e) { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); }

            btnOk.addEventListener('click', onOk);
            btnCancel.addEventListener('click', onCancel);
            input.addEventListener('keydown', onKey);
        });
    }

    /** Cargar datos iniciales */
    async function load() {
        try {
            const [prodRes, insRes] = await Promise.all([
                App.api('/api/productos?includeInactive=true'),
                App.api('/api/insumos')
            ]);
            productos = prodRes.data;
            insumos = insRes.data;
            render();
        } catch (e) {
            App.toast('Error al cargar productos', 'error');
        }
    }

    /** Renderizar la lista de productos */
    function render() {
        const grid = document.getElementById('gestion-grid');
        if (!grid) return;

        if (productos.length === 0) {
            grid.innerHTML = `
                <div class="gestion-empty">
                    <p>No hay productos registrados</p>
                </div>`;
            return;
        }

        grid.innerHTML = productos.map(p => `
            <div class="gestion-card" data-id="${p.id}">
                <div class="gestion-card-header">
                    <div class="gestion-card-info">
                        <span class="gestion-emoji">${EMOJIS[p.categoria] || '🍔'}</span>
                        <div>
                            <div class="gestion-card-name">${p.nombre}</div>
                            <div class="gestion-card-cat">${p.categoria}</div>
                        </div>
                    </div>
                    <div class="gestion-card-price">${App.formatMoney(p.precio_venta)}</div>
                </div>
                <div class="gestion-card-desc">${p.descripcion || 'Sin descripción'}</div>
                <div class="gestion-card-actions">
                    <button class="btn-gestion btn-edit" onclick="Gestion.openEdit(${p.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Editar
                    </button>
                    <button class="btn-gestion btn-recipe" onclick="Gestion.openRecipe(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        Ingredientes
                    </button>
                    <button class="btn-gestion btn-delete" onclick="Gestion.deleteProduct(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Eliminar
                    </button>
                </div>
            </div>
        `).join('');
    }

    /** Abrir modal para crear producto */
    function openCreate() {
        editingProductId = null;
        document.getElementById('product-modal-title').textContent = 'Nuevo Producto';
        document.getElementById('prod-nombre').value = '';
        document.getElementById('prod-descripcion').value = '';
        document.getElementById('prod-precio').value = '';
        document.getElementById('prod-categoria').value = 'hamburguesas';
        document.getElementById('product-modal').classList.add('active');
    }

    /** Abrir modal para editar producto */
    async function openEdit(id) {
        const p = productos.find(pr => pr.id === id);
        if (!p) return;
        editingProductId = id;
        document.getElementById('product-modal-title').textContent = 'Editar Producto';
        document.getElementById('prod-nombre').value = p.nombre;
        document.getElementById('prod-descripcion').value = p.descripcion || '';
        document.getElementById('prod-precio').value = p.precio_venta;
        document.getElementById('prod-categoria').value = p.categoria;
        document.getElementById('product-modal').classList.add('active');
    }

    /** Guardar producto (crear o editar) */
    async function saveProduct() {
        const nombre = document.getElementById('prod-nombre').value.trim();
        const descripcion = document.getElementById('prod-descripcion').value.trim();
        const precio_venta = parseFloat(document.getElementById('prod-precio').value);
        const categoria = document.getElementById('prod-categoria').value;

        if (!nombre) return App.toast('El nombre es obligatorio', 'error');
        if (!precio_venta || precio_venta <= 0) return App.toast('El precio debe ser mayor a 0', 'error');

        const body = { nombre, descripcion, precio_venta, categoria };

        try {
            if (editingProductId) {
                await App.api(`/api/productos/${editingProductId}`, { method: 'PUT', body });
                App.toast('Producto actualizado', 'success');
            } else {
                await App.api('/api/productos', { method: 'POST', body });
                App.toast('Producto creado', 'success');
            }
            closeProductModal();
            load();
            POS.loadProducts();
        } catch (e) {
            App.toast(e.message, 'error');
        }
    }

    /** Eliminar producto — usa modal personalizado */
    async function deleteProduct(id, nombre) {
        const confirmed = await showConfirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`);
        if (!confirmed) return;
        try {
            await App.api(`/api/productos/${id}`, { method: 'DELETE' });
            App.toast(`"${nombre}" eliminado`, 'success');
            load();
            POS.loadProducts();
        } catch (e) {
            App.toast(e.message, 'error');
        }
    }

    /** Cerrar modal de producto */
    function closeProductModal() {
        document.getElementById('product-modal').classList.remove('active');
        editingProductId = null;
    }

    // ==========================================
    // GESTIÓN DE RECETAS / INGREDIENTES
    // ==========================================

    let currentRecipeProductId = null;
    let currentRecipe = [];

    /** Abrir modal de ingredientes */
    async function openRecipe(productId, productName) {
        currentRecipeProductId = productId;
        document.getElementById('recipe-product-name').textContent = productName;
        document.getElementById('recipe-modal').classList.add('active');

        try {
            const res = await App.api(`/api/productos/${productId}/receta`);
            currentRecipe = res.data;
            renderRecipe();
        } catch (e) {
            currentRecipe = [];
            renderRecipe();
        }
    }

    /** Renderizar ingredientes de la receta */
    function renderRecipe() {
        const container = document.getElementById('recipe-items');

        if (currentRecipe.length === 0) {
            container.innerHTML = `
                <div class="recipe-empty">
                    <p style="color: var(--text-muted); text-align: center; padding: 20px;">
                        Sin ingredientes configurados
                    </p>
                </div>`;
        } else {
            container.innerHTML = currentRecipe.map(r => `
                <div class="recipe-item">
                    <div class="recipe-item-info">
                        <span class="recipe-item-name">${r.insumo_nombre}</span>
                        <span class="recipe-item-qty">${parseFloat(r.cantidad_necesaria)} ${r.unidad_medida}</span>
                    </div>
                    <div class="recipe-item-actions">
                        <button class="btn-recipe-edit" onclick="Gestion.editRecipeItem(${r.insumo_id}, ${r.cantidad_necesaria})" title="Editar cantidad">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-recipe-delete" onclick="Gestion.removeRecipeItem(${r.insumo_id})" title="Quitar ingrediente">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        // Llenar select de insumos (excluyendo los ya agregados)
        const usedIds = currentRecipe.map(r => r.insumo_id);
        const select = document.getElementById('recipe-insumo-select');
        const available = insumos.filter(i => !usedIds.includes(i.id));
        select.innerHTML = `<option value="">Seleccionar insumo...</option>` +
            available.map(i => `<option value="${i.id}">${i.nombre} (${i.unidad_medida})</option>`).join('');
    }

    /** Agregar ingrediente a la receta */
    async function addRecipeItem() {
        const insumoId = parseInt(document.getElementById('recipe-insumo-select').value);
        const cantidad = parseFloat(document.getElementById('recipe-cantidad-input').value);

        if (!insumoId) return App.toast('Selecciona un insumo', 'error');
        if (!cantidad || cantidad <= 0) return App.toast('Ingresa una cantidad válida', 'error');

        try {
            await App.api(`/api/productos/${currentRecipeProductId}/receta`, {
                method: 'POST',
                body: { insumo_id: insumoId, cantidad_necesaria: cantidad }
            });
            App.toast('Ingrediente agregado', 'success');
            const res = await App.api(`/api/productos/${currentRecipeProductId}/receta`);
            currentRecipe = res.data;
            renderRecipe();
            document.getElementById('recipe-cantidad-input').value = '';
        } catch (e) {
            App.toast(e.message, 'error');
        }
    }

    /** Editar cantidad de un ingrediente — usa modal prompt personalizado */
    async function editRecipeItem(insumoId, currentQty) {
        const nuevaCantidad = await showPrompt(`Nueva cantidad (actual: ${currentQty}):`, currentQty);
        if (nuevaCantidad === null) return;
        const qty = parseFloat(nuevaCantidad);
        if (!qty || qty <= 0) return App.toast('Cantidad inválida', 'error');

        try {
            await App.api(`/api/productos/${currentRecipeProductId}/receta/${insumoId}`, {
                method: 'PUT',
                body: { cantidad_necesaria: qty }
            });
            App.toast('Cantidad actualizada', 'success');
            const res = await App.api(`/api/productos/${currentRecipeProductId}/receta`);
            currentRecipe = res.data;
            renderRecipe();
        } catch (e) {
            App.toast(e.message, 'error');
        }
    }

    /** Quitar ingrediente de la receta — usa modal confirm personalizado */
    async function removeRecipeItem(insumoId) {
        const confirmed = await showConfirm('¿Quitar este ingrediente de la receta?');
        if (!confirmed) return;
        try {
            await App.api(`/api/productos/${currentRecipeProductId}/receta/${insumoId}`, {
                method: 'DELETE'
            });
            App.toast('Ingrediente eliminado', 'success');
            const res = await App.api(`/api/productos/${currentRecipeProductId}/receta`);
            currentRecipe = res.data;
            renderRecipe();
        } catch (e) {
            App.toast(e.message, 'error');
        }
    }

    /** Cerrar modal de receta */
    function closeRecipeModal() {
        document.getElementById('recipe-modal').classList.remove('active');
        currentRecipeProductId = null;
        currentRecipe = [];
    }

    /** Setup eventos de modales */
    function setupEvents() {
        document.getElementById('btn-new-product')?.addEventListener('click', openCreate);
        document.getElementById('modal-close-product')?.addEventListener('click', closeProductModal);
        document.getElementById('btn-cancel-product')?.addEventListener('click', closeProductModal);
        document.getElementById('btn-save-product')?.addEventListener('click', saveProduct);
        document.getElementById('modal-close-recipe')?.addEventListener('click', closeRecipeModal);
        document.getElementById('btn-close-recipe')?.addEventListener('click', closeRecipeModal);
        document.getElementById('btn-add-recipe-item')?.addEventListener('click', addRecipeItem);
    }

    function init() {
        setupEvents();
    }

    return {
        load, init, openCreate, openEdit, deleteProduct,
        openRecipe, addRecipeItem, editRecipeItem, removeRecipeItem
    };
})();
