// ── Migración desde datos anteriores ──────────────────────────────
function migrateList(raw) {
    return raw.map((p, i) => ({
        id:      p.id      ?? (Date.now() - raw.length + i),
        name:    p.name    ?? '',
        price:   p.price   ?? 0,
        checked: p.checked ?? false,
    }));
}

// ── App ───────────────────────────────────────────────────────────
const app = {
    products: migrateList(
        JSON.parse(localStorage.getItem('v9_list')) ||
        JSON.parse(localStorage.getItem('v8_list')) || []
    ),
    base: JSON.parse(localStorage.getItem('v9_base')) ||
          JSON.parse(localStorage.getItem('v8_base')) || [
        { name:'Leche Colun',  price:1250 },
        { name:'Huevos 12u',   price:3400 },
        { name:'Pan Molde',    price:2100 },
        { name:'Mantequilla',  price:1800 },
    ],
    history:  JSON.parse(localStorage.getItem('v9_history')) || [],
    editIdx:  null,
    sortable: null,

    // ── Arranque ────────────────────────────────────────────────────
    init() {
        this.applyTheme(localStorage.getItem('theme') || 'blue', false);
        if (localStorage.getItem('dark') === 'true') {
            document.documentElement.classList.add('dark');
        }
        this.renderAll();
        this.bindEvents();
        this.registerSW();
    },

    registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .catch(err => console.warn('SW no registrado:', err));
        }
    },

    bindEvents() {
        const inp = document.getElementById('quick-input');
        document.getElementById('btn-quick-add').onclick = () => this.quickAdd();
        document.getElementById('btn-save-base').onclick  = () => this.saveToBase();
        document.getElementById('btn-add-base').onclick   = () => this.addFromBase();
        document.getElementById('btn-clear').onclick      = () => {
            if (confirm('¿Vaciar la lista actual?')) { this.products = []; this.renderAll(); }
        };
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); this.quickAdd(); }
        });

        // Theme dots
        document.querySelectorAll('.tdot').forEach(dot => {
            dot.onclick = () => this.applyTheme(dot.dataset.t, true);
        });

        // Archivar – guardar
        document.getElementById('btn-archive-save').onclick = () => this.archiveList(true);
        document.getElementById('btn-archive-clear').onclick = () => {
            if (confirm('¿Limpiar la lista sin guardar en historial?')) {
                this.products = [];
                this.renderAll();
                closeModal('modal-archive');
            }
        };

        // Modal base – guardar
        document.getElementById('m-save').onclick = () => {
            const n = document.getElementById('m-name').value.trim();
            const p = parseInt(document.getElementById('m-price').value) || 0;
            if (!n) return;
            if (this.editIdx !== null) {
                this.base[this.editIdx] = { name: n, price: p };
            } else {
                if (!this.base.some(b => b.name.toLowerCase() === n.toLowerCase())) {
                    this.base.push({ name: n, price: p });
                }
            }
            this.renderAll();
            closeModal('modal-base');
        };

        // Modal base – eliminar
        document.getElementById('m-del').onclick = () => {
            if (this.editIdx !== null) {
                this.base.splice(this.editIdx, 1);
                this.renderAll();
                closeModal('modal-base');
            }
        };
    },

    // ── Vistas (Lista / Historial) ─────────────────────────────────
    switchView(view) {
        const isLista = view === 'lista';
        document.getElementById('view-lista').classList.toggle('hidden', !isLista);
        document.getElementById('view-historial').classList.toggle('hidden', isLista);
        document.getElementById('nav-lista').classList.toggle('nav-tab-active', isLista);
        document.getElementById('nav-lista').classList.toggle('t-muted', !isLista);
        document.getElementById('nav-historial').classList.toggle('nav-tab-active', !isLista);
        document.getElementById('nav-historial').classList.toggle('t-muted', isLista);
        if (!isLista) this.renderHistory();
    },

    // ── Archivar lista ─────────────────────────────────────────────
    openArchiveModal() {
        if (this.products.length === 0) {
            alert('La lista está vacía, no hay nada que archivar.');
            return;
        }
        const total = this.products
            .filter(p => p.checked)
            .reduce((s, p) => s + (p.price || 0), 0);
        document.getElementById('archive-total').textContent =
            new Intl.NumberFormat('es-CL', {
                style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
            }).format(total);
        document.getElementById('archive-note').value = '';
        openModal('modal-archive');
        setTimeout(() => document.getElementById('archive-note').focus(), 80);
    },

    archiveList(save) {
        if (!save) return;
        const note  = document.getElementById('archive-note').value.trim();
        const total = this.products
            .filter(p => p.checked)
            .reduce((s, p) => s + (p.price || 0), 0);

        this.history.unshift({
            id:    Date.now(),
            date:  new Date().toISOString(),
            note:  note || 'Sin nota',
            total,
            items: JSON.parse(JSON.stringify(this.products)),
        });
        this.saveHistory();
        this.products = [];
        this.renderAll();
        closeModal('modal-archive');
    },

    saveHistory() {
        localStorage.setItem('v9_history', JSON.stringify(this.history));
    },

    // ── Historial: render ──────────────────────────────────────────
    renderHistory() {
        const list  = document.getElementById('history-list');
        const empty = document.getElementById('history-empty');
        const count = document.getElementById('history-count');

        const n = this.history.length;
        count.textContent = n === 1 ? '1 compra' : `${n} compras`;

        if (n === 0) {
            list.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }
        list.classList.remove('hidden');
        empty.classList.add('hidden');
        list.innerHTML = '';

        this.history.forEach(entry => {
            const date = new Intl.DateTimeFormat('es-CL', {
                weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
            }).format(new Date(entry.date));

            const totalFmt = new Intl.NumberFormat('es-CL', {
                style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
            }).format(entry.total);

            const bought  = entry.items.filter(i => i.checked).length;
            const pending = entry.items.filter(i => !i.checked).length;

            const card = document.createElement('div');
            card.className = 't-card rounded-[2rem] overflow-hidden';
            card.innerHTML = `
                <button class="w-full p-5 text-left press"
                    onclick="app.toggleHistoryCard(${entry.id})">
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-black uppercase tracking-widest t-muted mb-1">${date}</p>
                            <h3 class="font-black text-sm t-text leading-snug">${entry.note}</h3>
                            <p class="text-xs t-muted mt-1">
                                ${entry.items.length} productos
                                ${bought  > 0 ? `· <span class="t-accent">${bought} comprados</span>` : ''}
                                ${pending > 0 ? `· ${pending} pendientes` : ''}
                            </p>
                        </div>
                        <div class="text-right flex-shrink-0">
                            <p class="font-black text-xl t-accent">${totalFmt}</p>
                            <span id="chev-${entry.id}" class="material-symbols-outlined text-base t-muted mt-1 block"
                                style="font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20">expand_more</span>
                        </div>
                    </div>
                </button>

                <div id="hbody-${entry.id}" class="history-card-body">
                    <div class="px-5 pb-2">
                        <div class="border-t mb-3" style="border-color:var(--bdr)"></div>
                        ${entry.items.map(item => `
                            <div class="history-item-row ${item.checked ? '' : 'opacity-50'}">
                                <div class="flex items-center gap-2">
                                    <span class="material-symbols-outlined text-base ${item.checked ? 't-accent' : 't-muted'}"
                                        style="font-size:1rem">${item.checked ? 'check_circle' : 'radio_button_unchecked'}</span>
                                    <span class="font-bold t-text text-sm">${item.name}</span>
                                </div>
                                <span class="font-black t-accent text-xs">
                                    ${item.price > 0 ? '$' + item.price.toLocaleString('es-CL') : '—'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="px-5 pb-5 pt-2">
                        <button onclick="app.deleteHistory(${entry.id})"
                            class="w-full py-3 rounded-xl font-bold text-red-500 bg-red-500/10 text-xs press">
                            Eliminar del historial
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    },

    toggleHistoryCard(id) {
        const body  = document.getElementById(`hbody-${id}`);
        const chev  = document.getElementById(`chev-${id}`);
        const isOpen = body.classList.contains('open');
        body.classList.toggle('open', !isOpen);
        chev.textContent = isOpen ? 'expand_more' : 'expand_less';
    },

    deleteHistory(id) {
        if (!confirm('¿Eliminar esta compra del historial?')) return;
        this.history = this.history.filter(h => h.id !== id);
        this.saveHistory();
        this.renderHistory();
    },

    // ── Añadir desde input rápido ──────────────────────────────────
    quickAdd() {
        const inp = document.getElementById('quick-input');
        const val = inp.value.trim();
        if (!val) return;
        if (!this.products.some(p => p.name.toLowerCase() === val.toLowerCase())) {
            const baseItem = this.base.find(b => b.name.toLowerCase() === val.toLowerCase());
            this.products.unshift({
                id:      Date.now(),
                name:    baseItem ? baseItem.name : val,
                price:   baseItem ? baseItem.price : 0,
                checked: false,
            });
            this.renderAll();
        }
        inp.value = '';
        inp.focus();
    },

    // ── Guardar en base desde input rápido ─────────────────────────
    saveToBase() {
        const inp = document.getElementById('quick-input');
        const val = inp.value.trim();
        if (!val) return;

        const alreadyIn = this.base.some(b => b.name.toLowerCase() === val.toLowerCase());
        if (!alreadyIn) {
            this.base.push({ name: val, price: 0 });
            this.renderAll();
        }

        // Feedback visual
        const fb   = document.getElementById('save-feedback');
        const icon = document.getElementById('icon-save-base');
        fb.textContent = alreadyIn ? '— Ya está en sugeridos' : '✓ Guardado en sugeridos';
        fb.classList.remove('hidden');
        icon.style.setProperty('font-variation-settings', "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24");
        setTimeout(() => {
            fb.classList.add('hidden');
            icon.style.removeProperty('font-variation-settings');
        }, 1800);
    },

    // ── Guardar en base desde un ítem de la lista ──────────────────
    saveItemToBase(id) {
        const item = this.products.find(p => p.id === id);
        if (!item) return;
        if (!this.base.some(b => b.name.toLowerCase() === item.name.toLowerCase())) {
            this.base.push({ name: item.name, price: item.price || 0 });
            this.renderAll();
        }
    },

    // ── Añadir desde dropdown de sugeridos ─────────────────────────
    addFromBase() {
        const idx = document.getElementById('dropdown').value;
        if (idx === '' || idx === null) return;
        const item = this.base[parseInt(idx)];
        if (!item) return;
        if (!this.products.some(p => p.name.toLowerCase() === item.name.toLowerCase())) {
            this.products.unshift({ id: Date.now(), ...item, checked: false });
            this.renderAll();
        }
    },

    // ── Marcar/desmarcar ítem ──────────────────────────────────────
    toggleCheck(id) {
        const item = this.products.find(p => p.id === id);
        if (!item) return;
        item.checked = !item.checked;
        const unchecked = this.products.filter(p => !p.checked);
        const checked   = this.products.filter(p =>  p.checked);
        this.products = [...unchecked, ...checked];
        this.renderAll();
    },

    // ── Actualizar precio sin re-render ────────────────────────────
    updatePrice(id, val) {
        const item = this.products.find(p => p.id === id);
        if (item) item.price = parseInt(val) || 0;
        this.save();
        this.updateTotal();
    },

    // ── Eliminar ítem ──────────────────────────────────────────────
    removeItem(id) {
        this.products = this.products.filter(p => p.id !== id);
        this.renderAll();
    },

    // ── Render completo ────────────────────────────────────────────
    renderAll() {
        this.renderList();
        this.renderDropdown();
        this.save();
    },

    renderList() {
        const elUnchecked = document.getElementById('list-unchecked');
        const elChecked   = document.getElementById('list-checked');
        const elDivider   = document.getElementById('list-divider');

        if (this.sortable) { this.sortable.destroy(); this.sortable = null; }

        elUnchecked.innerHTML = '';
        elChecked.innerHTML   = '';

        const unchecked = this.products.filter(p => !p.checked);
        const checked   = this.products.filter(p =>  p.checked);

        unchecked.forEach(item => elUnchecked.appendChild(this.buildItem(item)));
        checked.forEach(item   => elChecked.appendChild(this.buildItem(item)));

        if (checked.length > 0) {
            elDivider.className = 'divider';
            elDivider.innerHTML = `<span>Completados · ${checked.length}</span>`;
        } else {
            elDivider.className = 'hidden';
            elDivider.innerHTML = '';
        }

        this.updateTotal();
        this.setupSortable();
    },

    buildItem(item) {
        const inBase    = this.base.some(b => b.name.toLowerCase() === item.name.toLowerCase());
        const priceVal  = item.price > 0 ? item.price : '';
        const isChecked = item.checked;

        const div = document.createElement('div');
        div.className = `t-card rounded-[1.75rem] p-4 flex items-center gap-3 item-in transition-all ${isChecked ? 'checked-item' : ''}`;
        div.dataset.id = item.id;

        div.innerHTML = `
            ${!isChecked
                ? `<div class="drag-handle t-muted flex items-center px-0.5 flex-shrink-0">
                       <span class="material-symbols-outlined text-lg"
                           style="font-variation-settings:'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24">drag_indicator</span>
                   </div>`
                : `<div class="w-5 flex-shrink-0"></div>`
            }
            <button onclick="app.toggleCheck(${item.id})"
                class="w-11 h-11 rounded-xl flex items-center justify-center press transition-all flex-shrink-0 ${isChecked ? 't-btn' : 't-btn-soft'}">
                <span class="material-symbols-outlined text-xl">${isChecked ? 'check' : 'add'}</span>
            </button>
            <div class="flex-1 min-w-0">
                <h3 class="font-black text-sm truncate"
                    style="color:var(--fg);${isChecked ? 'text-decoration:line-through;' : ''}">${item.name}</h3>
                <div class="flex items-center gap-0.5 mt-0.5" style="color:var(--p)">
                    <span class="text-[10px] font-black">$</span>
                    <input type="number"
                        value="${priceVal}"
                        placeholder="precio"
                        onchange="app.updatePrice(${item.id}, this.value)"
                        class="bg-transparent border-none p-0 focus:ring-0 font-black w-20 ml-0.5"
                        style="color:var(--p);font-size:.65rem">
                </div>
            </div>
            ${inBase
                ? `<div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 t-btn-soft" title="Ya en sugeridos">
                       <span class="material-symbols-outlined text-sm t-accent">bookmark</span>
                   </div>`
                : `<button onclick="app.saveItemToBase(${item.id})" title="Guardar en sugeridos"
                       class="w-9 h-9 rounded-xl flex items-center justify-center press t-btn-soft flex-shrink-0">
                       <span class="material-symbols-outlined text-sm t-accent"
                           style="font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20">bookmark</span>
                   </button>`
            }
            <button onclick="app.removeItem(${item.id})"
                class="w-9 h-9 rounded-xl flex items-center justify-center press flex-shrink-0 t-muted"
                style="-webkit-tap-highlight-color:transparent">
                <span class="material-symbols-outlined text-base">close</span>
            </button>
        `;
        return div;
    },

    setupSortable() {
        const el = document.getElementById('list-unchecked');
        if (!el || !el.children.length) return;
        this.sortable = Sortable.create(el, {
            animation:   200,
            handle:      '.drag-handle',
            ghostClass:  'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass:   'sortable-drag',
            onEnd: (evt) => {
                const unchecked = this.products.filter(p => !p.checked);
                const checked   = this.products.filter(p =>  p.checked);
                const [moved]   = unchecked.splice(evt.oldIndex, 1);
                unchecked.splice(evt.newIndex, 0, moved);
                this.products = [...unchecked, ...checked];
                this.save();
            },
        });
    },

    updateTotal() {
        const total = this.products
            .filter(p => p.checked)
            .reduce((s, p) => s + (p.price || 0), 0);
        document.getElementById('total-price').textContent =
            new Intl.NumberFormat('es-CL', {
                style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
            }).format(total);
    },

    renderDropdown() {
        const dd = document.getElementById('dropdown');

        if (this.base.length === 0) {
            dd.innerHTML = '<option value="">Base vacía...</option>';
            document.getElementById('base-count').textContent = '0 en base';
            return;
        }

        const available = this.base
            .filter(b => !this.products.some(p => p.name.toLowerCase() === b.name.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));

        const inList = this.base
            .filter(b => this.products.some(p => p.name.toLowerCase() === b.name.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));

        dd.innerHTML = '<option value="">Seleccionar para añadir...</option>';

        available.forEach(item => {
            const i   = this.base.indexOf(item);
            const opt = document.createElement('option');
            opt.value       = i;
            opt.textContent = item.price > 0
                ? `${item.name}  ·  $${item.price.toLocaleString('es-CL')}`
                : item.name;
            dd.appendChild(opt);
        });

        if (inList.length > 0) {
            const group = document.createElement('optgroup');
            group.label = '── Ya en tu lista ──';
            inList.forEach(item => {
                const opt    = document.createElement('option');
                opt.disabled = true;
                opt.textContent = `✓  ${item.name}`;
                group.appendChild(opt);
            });
            dd.appendChild(group);
        }

        const total = this.base.length;
        document.getElementById('base-count').textContent =
            total === 1 ? '1 en base' : `${total} en base`;
    },

    save() {
        localStorage.setItem('v9_list', JSON.stringify(this.products));
        localStorage.setItem('v9_base',  JSON.stringify(this.base));
    },

    // ── Tema ─────────────────────────────────────────────────────────
    applyTheme(name, save = true) {
        document.documentElement.dataset.theme = name;
        if (save) localStorage.setItem('theme', name);
        document.querySelectorAll('.tdot').forEach(d => {
            d.classList.toggle('on', d.dataset.t === name);
        });
    },

    toggleDark() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('dark', isDark);
        document.getElementById('dark-label').textContent =
            isDark ? 'Modo Día' : 'Modo Noche';
    },

    // ── Utilidades ───────────────────────────────────────────────────
    shareWA() {
        let text = '🛒 *LISTA DE COMPRAS*\n\n';
        this.products.forEach(p => {
            text += `${p.checked ? '✅' : '⬜'} *${p.name}*`;
            if (p.price > 0) text += ` — $${p.price.toLocaleString('es-CL')}`;
            text += '\n';
        });
        text += `\n💰 *TOTAL: ${document.getElementById('total-price').textContent}*`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    },

    exportData() {
        navigator.clipboard.writeText(JSON.stringify(this.base))
            .then(() => alert('Base copiada al portapapeles.'));
    },

    reset() {
        if (confirm('¿Resetear toda la aplicación? Se borrará todo.')) {
            localStorage.clear();
            location.reload();
        }
    },
};

// ── Modales ───────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

['modal-base', 'modal-settings'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
        if (e.target === this) closeModal(id);
    });
});

function openBaseModal(mode) {
    const idx      = document.getElementById('dropdown').value;
    const nameInp  = document.getElementById('m-name');
    const priceInp = document.getElementById('m-price');
    const delBtn   = document.getElementById('m-del');
    const title    = document.getElementById('modal-base-title');

    if (mode === 'edit') {
        if (!idx) { alert('Selecciona primero un producto del dropdown.'); return; }
        app.editIdx    = parseInt(idx);
        nameInp.value  = app.base[app.editIdx].name;
        priceInp.value = app.base[app.editIdx].price || '';
        delBtn.classList.remove('hidden');
        title.textContent = 'Editar Producto';
    } else {
        app.editIdx    = null;
        nameInp.value  = '';
        priceInp.value = '';
        delBtn.classList.add('hidden');
        title.textContent = 'Nuevo Producto';
    }
    openModal('modal-base');
    setTimeout(() => nameInp.focus(), 50);
}

// ── Iniciar ───────────────────────────────────────────────────────
app.init();
