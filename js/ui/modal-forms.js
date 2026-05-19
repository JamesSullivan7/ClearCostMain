// ── Modal Form Functions ─────────────────────────────
// Extracted from app.js — product/material/supplier/recipe/expense/waste/transaction modals

import * as config from '../config.js';
import * as products from '../stores/products.js';
import * as materials from '../stores/materials.js';
import * as history from '../stores/history.js';
import * as production from '../stores/production.js';
import * as recipes from '../stores/recipes.js';
import * as suppliers from '../stores/suppliers.js';
import * as waste from '../stores/waste.js';
import * as locations from '../stores/locations.js';
import * as expenses from '../stores/expenses.js';
import * as transactions from '../stores/transactions.js';
import * as customers from '../stores/customers.js';
import { showFormModal, escHtml, showConfirmModal } from './modals.js';
import { toast } from './toast.js';
import { getExpenseFormFields } from './cost-analysis.js';
import { getTransactionFormFields } from './transactions.js';
import { apiTeamInvite } from '../api-client.js';
import {
  getProductTemplate, getMaterialTemplate, getRecipeTemplate,
  parseCSV, importProducts, importMaterials, importRecipes,
  downloadCSV,
} from '../services/csv-import.js';

// ── Renderer Registry ───────────────────────────────
// app.js registers its render functions here so modals can trigger re-renders.

let _r = {};

export function registerRenderers(renderers) {
  _r = renderers;
}

// ── Product Modals ──────────────────────────────────

export function showAddProductModal() {
  const allLocations = locations.getAllLocations();
  const locOptions = [{ value: '', label: 'None' }, ...allLocations.map(l => ({ value: String(l.id), label: l.name }))];
  const defaultLoc = locations.getDefaultLocation();

  showFormModal({
    title: `Add New ${config.label('product')}`,
    fields: [
      { id: 'add-p-name', label: `${config.label('Product')} Name`, type: 'text', placeholder: 'e.g. Widget A', required: true },
      { id: 'add-p-photo', label: 'Photo', type: 'file', accept: 'image/*' },
      { id: 'add-p-qty', label: 'Starting Quantity', type: 'number', placeholder: '0', min: 0 },
      { id: 'add-p-note', label: 'Note (optional)', type: 'text', placeholder: 'e.g. seasonal, bestseller' },
      { id: 'add-p-sell', label: 'Sell Price ($)', type: 'number', placeholder: '0.00', min: 0, step: '0.01' },
      { id: 'add-p-low', label: 'Low Stock Threshold', type: 'number', placeholder: 'Default: ' + (config.getProfile()?.globalThresholds?.productLow || 10), min: 0 },
      { id: 'add-p-status', label: 'Status', type: 'select', value: 'none', options: [
        { value: 'none', label: 'In Stock' },
        { value: 'needs', label: 'Needs to be Made' },
        { value: 'production', label: 'In Production' },
      ]},
      ...(allLocations.length > 0 ? [{ id: 'add-p-loc', label: 'Location', type: 'select', value: defaultLoc ? String(defaultLoc.id) : '', options: locOptions }] : []),
    ],
    submitLabel: `Add ${config.label('Product')}`,
    async onSubmit(vals) {
      const name = vals['add-p-name'];
      if (!name) return false;
      const qty = vals['add-p-qty'] || 0;
      const sellPrice = parseFloat(vals['add-p-sell']) || null;
      const item = await products.addProduct({
        name,
        quantity: qty,
        note: vals['add-p-note'],
        sellPrice,
        lowThreshold: vals['add-p-low'] ? parseInt(vals['add-p-low']) : null,
        needsMade: vals['add-p-status'] === 'needs',
        inProduction: vals['add-p-status'] === 'production',
        locationId: vals['add-p-loc'] ? parseInt(vals['add-p-loc']) : null,
      });
      // Upload photo if selected
      const photoFile = vals['add-p-photo'];
      if (photoFile) {
        try {
          const { uploadPhoto } = await import('../services/photos.js');
          const photoPath = await uploadPhoto(photoFile);
          await products.updateProduct(item.id, { photoId: photoPath });
        } catch (err) {
          console.warn('Photo upload failed:', err);
          toast('Product added but photo upload failed', 'warning');
        }
      }
      if (qty > 0) {
        await history.addEntry({
          itemType: 'product', itemId: item.id, itemName: name,
          changeType: 'restock', quantityChange: qty, newQuantity: qty,
          note: 'Initial stock',
        });
      }
      _r.renderInventoryPage?.();
      _r.renderHeader?.();
      _r.renderAlerts?.();
      toast(`${name} added`, 'success');
    },
  });
}

export function showRestockProductModal(id) {
  const item = products.getProductById(id);
  if (!item) return;
  showFormModal({
    title: `Restock — ${item.name}`,
    fields: [
      { id: 'rst-qty', label: 'Quantity to Add', type: 'number', placeholder: 'e.g. 50', min: 1 },
      { id: 'rst-note', label: 'Note (optional)', type: 'text', placeholder: 'e.g. batch #3' },
    ],
    submitLabel: 'Add Stock',
    async onSubmit(vals) {
      const qty = vals['rst-qty'];
      if (!qty || qty <= 0) return false;
      const result = await products.changeQuantity(id, qty);
      await history.addEntry({
        itemType: 'product', itemId: id, itemName: item.name,
        changeType: 'restock', quantityChange: qty, newQuantity: result.newQty,
        note: vals['rst-note'],
      });
      _r.renderInventoryPage?.();
      _r.renderHeader?.();
      _r.renderAlerts?.();
      toast(`${item.name} restocked +${qty}`, 'success');
    },
  });
}

export function showEditNoteModal(id) {
  const item = products.getProductById(id);
  if (!item) return;
  const globalThreshold = config.getProfile()?.globalThresholds?.productLow || 10;
  showFormModal({
    title: `Edit — ${item.name}`,
    fields: [
      { id: 'edit-note', label: 'Note', type: 'textarea', value: item.note || '', placeholder: 'e.g. seasonal, bestseller' },
      { id: 'edit-sell', label: 'Sell Price ($)', type: 'number', value: item.sellPrice || '', placeholder: '0.00', min: 0, step: '0.01' },
      { id: 'edit-low', label: 'Low Stock Threshold', type: 'number', value: item.lowThreshold || '', placeholder: 'Default: ' + globalThreshold, min: 0 },
    ],
    submitLabel: 'Save',
    async onSubmit(vals) {
      await products.updateProduct(id, {
        note: vals['edit-note'],
        sellPrice: vals['edit-sell'] ? parseFloat(vals['edit-sell']) : null,
        lowThreshold: vals['edit-low'] ? parseInt(vals['edit-low']) : null,
      });
      _r.renderInventoryPage?.();
      _r.renderHeader?.();
      _r.renderAlerts?.();
    },
  });
}

// ── Material Modals ─────────────────────────────────

export function showAddMaterialModal() {
  const allSuppliers = suppliers.getAllSuppliers();
  const supplierOptions = [{ value: '', label: 'None' }, ...allSuppliers.map(s => ({ value: String(s.id), label: s.name }))];
  const allLocations = locations.getAllLocations();
  const locOptions = [{ value: '', label: 'None' }, ...allLocations.map(l => ({ value: String(l.id), label: l.name }))];
  const defaultLoc = locations.getDefaultLocation();

  showFormModal({
    title: 'Add New Material',
    fields: [
      { id: 'add-m-name', label: 'Material Name', type: 'text', placeholder: 'e.g. Wax', required: true },
      { id: 'add-m-cat', label: 'Category', type: 'select', value: 'raw', options: [
        { value: 'raw', label: 'Raw Material' },
        { value: 'packaging', label: 'Packaging' },
        { value: 'label', label: 'Label / Sticker' },
        { value: 'fragrance', label: 'Fragrance / Flavoring' },
        { value: 'other', label: 'Other' },
      ]},
      { id: 'add-m-unit', label: 'Unit', type: 'select', value: 'units', options: [
        { value: 'units', label: 'units' },
        { value: 'lbs', label: 'lbs' },
        { value: 'oz', label: 'oz' },
        { value: 'kg', label: 'kg' },
        { value: 'ml', label: 'ml' },
        { value: 'each', label: 'each' },
      ]},
      { id: 'add-m-qty', label: 'Starting Quantity', type: 'number', placeholder: '0', min: 0, step: '0.01' },
      { id: 'add-m-cost', label: 'Cost Per Unit ($)', type: 'number', placeholder: '0.00', min: 0, step: '0.01' },
      { id: 'add-m-supplier', label: 'Supplier', type: 'select', value: '', options: supplierOptions },
      { id: 'add-m-low', label: 'Low Stock Threshold', type: 'number', placeholder: '50', min: 1 },
      ...(allLocations.length > 0 ? [{ id: 'add-m-loc', label: 'Location', type: 'select', value: defaultLoc ? String(defaultLoc.id) : '', options: locOptions }] : []),
    ],
    submitLabel: 'Add Material',
    async onSubmit(vals) {
      const name = vals['add-m-name'];
      if (!name) return false;
      await materials.addMaterial({
        name,
        category: vals['add-m-cat'] || 'raw',
        unit: vals['add-m-unit'],
        quantity: vals['add-m-qty'] || 0,
        costPerUnit: vals['add-m-cost'] || null,
        supplierId: vals['add-m-supplier'] ? parseInt(vals['add-m-supplier']) : null,
        lowThreshold: vals['add-m-low'] || 50,
        locationId: vals['add-m-loc'] ? parseInt(vals['add-m-loc']) : null,
      });
      _r.renderMaterialsPage?.();
      _r.renderHeader?.();
      _r.renderAlerts?.();
      toast(`${name} added`, 'success');
    },
  });
}

export function showRestockMaterialModal(id) {
  const item = materials.getMaterialById(id);
  if (!item) return;
  showFormModal({
    title: `Restock — ${item.name}`,
    fields: [
      { id: 'mrst-qty', label: `Amount to Add (${item.unit})`, type: 'number', placeholder: 'e.g. 100', min: 0.001, step: 'any' },
      { id: 'mrst-note', label: 'Note (optional)', type: 'text', placeholder: 'e.g. new shipment' },
    ],
    submitLabel: 'Add Stock',
    async onSubmit(vals) {
      const qty = vals['mrst-qty'];
      if (!qty || qty <= 0) return false;
      const result = await materials.changeQuantity(id, qty);
      await history.addEntry({
        itemType: 'material', itemId: id, itemName: item.name,
        changeType: 'restock', quantityChange: qty, newQuantity: result.newQty,
        note: vals['mrst-note'],
      });
      _r.renderMaterialsPage?.();
      _r.renderHeader?.();
      _r.renderAlerts?.();
      toast(`${item.name} restocked +${qty}`, 'success');
    },
  });
}

// ── Supplier Modals ─────────────────────────────────

export function showAddSupplierModal() {
  showFormModal({
    title: 'Add Supplier',
    fields: [
      { id: 'sup-name', label: 'Supplier Name', type: 'text', placeholder: 'e.g. Acme Supply Co.', required: true },
      { id: 'sup-contact', label: 'Contact Name', type: 'text', placeholder: 'e.g. John Smith' },
      { id: 'sup-email', label: 'Email', type: 'text', placeholder: 'e.g. orders@acme.com' },
      { id: 'sup-phone', label: 'Phone', type: 'text', placeholder: 'e.g. (555) 123-4567' },
    ],
    submitLabel: 'Add Supplier',
    async onSubmit(vals) {
      const name = vals['sup-name'];
      if (!name) return false;
      await suppliers.addSupplier({
        name,
        contactName: vals['sup-contact'],
        email: vals['sup-email'],
        phone: vals['sup-phone'],
      });
      _r.renderSuppliersPage?.();
      toast(`${name} added`, 'success');
    },
  });
}

export function showEditSupplierModal(id) {
  const sup = suppliers.getSupplierById(id);
  if (!sup) return;
  showFormModal({
    title: `Edit — ${sup.name}`,
    fields: [
      { id: 'sup-name', label: 'Supplier Name', type: 'text', value: sup.name, required: true },
      { id: 'sup-contact', label: 'Contact Name', type: 'text', value: sup.contactName },
      { id: 'sup-email', label: 'Email', type: 'text', value: sup.email },
      { id: 'sup-phone', label: 'Phone', type: 'text', value: sup.phone },
      { id: 'sup-website', label: 'Website', type: 'text', value: sup.website },
      { id: 'sup-lead', label: 'Default Lead Time (days)', type: 'number', value: sup.defaultLeadTimeDays || '', min: 1 },
      { id: 'sup-notes', label: 'Notes', type: 'textarea', value: sup.notes },
    ],
    submitLabel: 'Save',
    async onSubmit(vals) {
      await suppliers.updateSupplier(id, {
        name: vals['sup-name'] || sup.name,
        contactName: vals['sup-contact'],
        email: vals['sup-email'],
        phone: vals['sup-phone'],
        website: vals['sup-website'],
        defaultLeadTimeDays: vals['sup-lead'] || null,
        notes: vals['sup-notes'],
      });
      _r.renderSuppliersPage?.();
      toast('Supplier updated', 'success');
    },
  });
}

// ── Recipe Modals ───────────────────────────────────

export function showAddRecipeModal() {
  const allMats = materials.getAllMaterials();
  const allProds = products.getAllProducts();

  if (!allMats.length) {
    toast('Add some materials first before creating recipes', 'warning');
    return;
  }

  showFormModal({
    title: 'Add Recipe',
    fields: [
      { id: 'recipe-name', label: 'Recipe Name', type: 'text', placeholder: 'e.g. Standard Widget', required: true },
      { id: 'recipe-product', label: `Linked ${config.label('Product')} (optional)`, type: 'select', value: '',
        options: [{ value: '', label: 'None (template)' }, ...allProds.map(p => ({ value: String(p.id), label: p.name }))] },
      { id: 'recipe-yield', label: 'Yield Quantity', type: 'number', value: '1', min: 1, placeholder: '1' },
      { id: 'recipe-notes', label: 'Notes (optional)', type: 'text', placeholder: 'e.g. production instructions' },
    ],
    submitLabel: 'Create Recipe',
    async onSubmit(vals) {
      const name = vals['recipe-name'];
      if (!name) return false;
      const recipe = await recipes.addRecipe({
        name,
        productId: vals['recipe-product'] ? parseInt(vals['recipe-product']) : null,
        yieldQty: vals['recipe-yield'] || 1,
        notes: vals['recipe-notes'],
        ingredients: [],
      });
      // Now show ingredient editor
      showEditRecipeModal(recipe.id);
      _r.renderRecipesPage?.();
      toast(`${name} created — add ingredients now`, 'success');
    },
  });
}

export function showEditRecipeModal(recipeId) {
  const recipe = recipes.getRecipeById(recipeId);
  if (!recipe) return;
  const allMats = materials.getAllMaterials();

  // Build ingredients editor as a dynamic modal
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'modal-recipe-edit';

  let ingredients = [...(recipe.ingredients || [])];

  function renderIngredientRows() {
    return ingredients.map((ing, i) => {
      const mat = allMats.find(m => m.id === ing.materialId);
      return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;" data-ing-idx="${i}">
        <select class="ing-material" style="flex:2;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px;border-radius:6px;font-family:var(--font-ui);">
          ${allMats.map(m => `<option value="${m.id}" ${m.id === ing.materialId ? 'selected' : ''}>${escHtml(m.name)} (${m.unit})</option>`).join('')}
        </select>
        <input type="number" class="ing-qty" value="${ing.quantity}" min="0.001" step="any"
          style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px;border-radius:6px;font-family:var(--font-ui);width:80px;" />
        <button class="btn-delete ing-remove" style="font-size:1.2rem;" data-idx="${i}">x</button>
      </div>`;
    }).join('');
  }

  function renderModal() {
    overlay.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <h2>Edit Recipe — ${escHtml(recipe.name)}</h2>
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <label style="font-size:0.75rem;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;">Ingredients</label>
            <button class="btn-secondary" id="add-ingredient" style="font-size:0.78rem;padding:4px 12px;">+ Add Ingredient</button>
          </div>
          <div id="ingredient-list">${renderIngredientRows()}</div>
          ${!ingredients.length ? '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">No ingredients yet. Click "+ Add Ingredient" to start.</div>' : ''}
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" id="recipe-cancel">Cancel</button>
          <button class="btn-confirm" id="recipe-save">Save Recipe</button>
        </div>
      </div>
    `;

    // Event handlers
    overlay.querySelector('#add-ingredient')?.addEventListener('click', () => {
      if (!allMats.length) return;
      ingredients.push({ materialId: allMats[0].id, quantity: 1, unit: allMats[0].unit });
      renderModal();
    });

    overlay.querySelectorAll('.ing-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        ingredients.splice(parseInt(btn.dataset.idx), 1);
        renderModal();
      });
    });

    overlay.querySelector('#recipe-cancel')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#recipe-save')?.addEventListener('click', async () => {
      // Gather current values from DOM
      const rows = overlay.querySelectorAll('[data-ing-idx]');
      const newIngredients = [];
      rows.forEach(row => {
        const matId = parseInt(row.querySelector('.ing-material').value);
        const qty = parseFloat(row.querySelector('.ing-qty').value) || 0;
        const mat = allMats.find(m => m.id === matId);
        if (qty > 0) {
          newIngredients.push({ materialId: matId, quantity: qty, unit: mat?.unit || 'units' });
        }
      });
      await recipes.updateRecipe(recipeId, { ingredients: newIngredients });
      overlay.remove();
      _r.renderRecipesPage?.();
      toast('Recipe updated', 'success');
    });
  }

  renderModal();
  document.body.appendChild(overlay);
}

// ── Production Helper ───────────────────────────────

export function showProduceFromRecipeModal(recipeId) {
  const recipe = recipes.getRecipeById(recipeId);
  if (!recipe) return;

  showFormModal({
    title: `Produce — ${recipe.name}`,
    fields: [
      { id: 'produce-qty', label: 'Quantity to Produce', type: 'number', placeholder: 'e.g. 10', min: 1 },
      { id: 'produce-note', label: 'Note (optional)', type: 'text', placeholder: 'e.g. batch run' },
    ],
    submitLabel: 'Produce',
    async onSubmit(vals) {
      const qty = vals['produce-qty'];
      if (!qty || qty <= 0) return false;

      // Check material availability
      const matMap = new Map(materials.getAllMaterials().map(m => [m.id, m]));
      const check = recipes.checkAvailability(recipe, qty, matMap);

      if (!check.canProduce) {
        const shortages = check.ingredients.filter(i => !i.sufficient);
        const msg = shortages.map(s => `${s.materialName}: need ${s.needed}, have ${s.available} (short ${s.deficit})`).join('\n');
        if (!await showConfirmModal({ title: 'Insufficient Materials', message: `${msg}\n\nProduce anyway?`, confirmLabel: 'Produce Anyway', danger: true })) return false;
      }

      // Deduct materials
      await deductRecipeMaterials(recipe, qty);

      // Add to product inventory if linked
      if (recipe.productId) {
        await products.changeQuantity(recipe.productId, qty);
      }

      // Log production
      await production.logRun({ quantity: qty, productId: recipe.productId, recipeId: recipe.id, note: vals['produce-note'] });

      await history.addEntry({
        itemType: 'production', itemId: recipe.productId,
        itemName: recipe.name,
        changeType: 'produced', quantityChange: qty,
        newQuantity: production.getTotalProduced(),
        note: vals['produce-note'] || `Produced via recipe`,
      });

      _r.renderAll?.();
      _r.renderRecipesPage?.();
      _r.renderProductionPage?.();
      toast(`${qty} units produced via ${recipe.name}`, 'success');
    },
  });
}

export async function deductRecipeMaterials(recipe, qty) {
  const multiplier = qty / (recipe.yieldQty || 1);

  for (const ing of recipe.ingredients) {
    const deduct = Math.round(ing.quantity * multiplier * 1000) / 1000;
    const result = await materials.changeQuantity(ing.materialId, -deduct);
    if (result) {
      await history.addEntry({
        itemType: 'material', itemId: ing.materialId,
        itemName: result.item.name + ' (materials)',
        changeType: 'produced', quantityChange: -deduct,
        newQuantity: result.newQty,
        note: `${qty}x ${recipe.name} produced`,
      });
    }
  }
}

// ── Waste Modal ─────────────────────────────────────

export function showLogWasteModal() {
  const allProds = products.getAllProducts();
  const allMats = materials.getAllMaterials();
  const itemOptions = [
    ...allProds.map(p => ({ value: `product_${p.id}`, label: `${p.name} (${config.label('product')})` })),
    ...allMats.map(m => ({ value: `material_${m.id}`, label: `${m.name} (material)` })),
  ];

  if (!itemOptions.length) { toast('Add products or materials first', 'warning'); return; }

  showFormModal({
    title: 'Log Waste / Shrinkage',
    fields: [
      { id: 'waste-item', label: 'Item', type: 'select', options: itemOptions },
      { id: 'waste-qty', label: 'Quantity Lost', type: 'number', placeholder: 'e.g. 5', min: 0.001, step: 'any' },
      { id: 'waste-reason', label: 'Reason', type: 'select', value: 'damaged', options: [
        { value: 'damaged', label: 'Damaged' },
        { value: 'expired', label: 'Expired' },
        { value: 'lost', label: 'Lost' },
        { value: 'defective', label: 'Defective' },
        { value: 'other', label: 'Other' },
      ]},
      { id: 'waste-note', label: 'Note (optional)', type: 'text', placeholder: 'e.g. dropped during shipping' },
    ],
    submitLabel: 'Log Waste',
    async onSubmit(vals) {
      const qty = vals['waste-qty'];
      if (!qty || qty <= 0) return false;
      const [itemType, itemIdStr] = vals['waste-item'].split('_');
      const itemId = parseInt(itemIdStr);

      // Deduct from inventory
      let itemName = '';
      let costImpact = null;
      if (itemType === 'product') {
        const result = await products.changeQuantity(itemId, -qty);
        if (result) itemName = result.item.name;
      } else {
        const result = await materials.changeQuantity(itemId, -qty);
        if (result) {
          itemName = result.item.name;
          if (result.item.costPerUnit) costImpact = result.item.costPerUnit * qty;
        }
      }

      await waste.logWaste({ itemType, itemId, quantity: qty, reason: vals['waste-reason'], note: vals['waste-note'], costImpact });

      await history.addEntry({
        itemType, itemId, itemName,
        changeType: 'wasted', quantityChange: -qty,
        newQuantity: itemType === 'product' ? (products.getProductById(itemId)?.quantity || 0) : (materials.getMaterialById(itemId)?.quantity || 0),
        note: `Waste: ${vals['waste-reason']}${vals['waste-note'] ? ' — ' + vals['waste-note'] : ''}`,
      });

      _r.renderAll?.();
      _r.renderWastePage?.();
      toast(`${qty} ${itemName} logged as waste`, 'info');
    },
  });
}

// ── Expense Modals ──────────────────────────────────

export function showAddExpenseModal() {
  showFormModal({
    title: 'Add Business Expense',
    fields: getExpenseFormFields(),
    submitLabel: 'Add Expense',
    async onSubmit(vals) {
      const name = vals.name;
      if (!name) return false;
      await expenses.addExpense({
        name,
        category: vals.category,
        costType: vals.costType || 'fixed',
        amount: parseFloat(vals.amount) || 0,
        frequency: vals.frequency,
        variableBasis: vals.variableBasis || null,
        variableRate: parseFloat(vals.variableRate) || 0,
        linkedProductId: vals.linkedProductId || null,
        note: vals.note,
      });
      _r.renderExpensesPage?.();
      toast(`${name} added`, 'success');
    },
  });
}

export function showEditExpenseModal(id) {
  const exp = expenses.getExpenseById(id);
  if (!exp) return;
  showFormModal({
    title: `Edit — ${exp.name}`,
    fields: getExpenseFormFields(exp),
    submitLabel: 'Save Changes',
    async onSubmit(vals) {
      await expenses.updateExpense(id, {
        name: vals.name,
        category: vals.category,
        costType: vals.costType || 'fixed',
        amount: parseFloat(vals.amount) || 0,
        frequency: vals.frequency,
        variableBasis: vals.variableBasis || null,
        variableRate: parseFloat(vals.variableRate) || 0,
        linkedProductId: vals.linkedProductId || null,
        note: vals.note,
      });
      _r.renderExpensesPage?.();
      toast(`${exp.name} updated`, 'success');
    },
  });
}

// ── Transaction Modal ───────────────────────────────

export function showAddTransactionModal(type) {
  showFormModal({
    title: type === 'income' ? 'Log Income' : 'Log Expense',
    fields: getTransactionFormFields(type),
    submitLabel: 'Save',
    async onSubmit(vals) {
      if (!vals.description) return false;
      await transactions.addTransaction({
        date: vals.date,
        description: vals.description,
        amount: parseFloat(vals.amount) || 0,
        type,
        category: vals.category,
        productId: vals.productId ? parseInt(vals.productId) : null,
        note: vals.note,
        source: 'manual',
      });
      _r.renderTransactionsPage?.();
      toast(`${type === 'income' ? 'Income' : 'Expense'} logged`, 'success');
    },
  });
}

// ── Edit Transaction Modal ──────────────────────────

export function showEditTransactionModal(id) {
  const txn = transactions.getTransactionById(id);
  if (!txn) return;
  showFormModal({
    title: `Edit Transaction`,
    fields: getTransactionFormFields(txn.type, txn),
    submitLabel: 'Save Changes',
    async onSubmit(vals) {
      if (!vals.description) return false;
      await transactions.updateTransaction(id, {
        date: vals.date,
        description: vals.description,
        amount: parseFloat(vals.amount) || 0,
        category: vals.category,
        productId: vals.productId ? parseInt(vals.productId) : null,
        note: vals.note,
      });
      _r.renderTransactionsPage?.();
      toast('Transaction updated', 'success');
    },
  });
}

// ── Edit Waste Modal ───────────────────────────────

export function showEditWasteModal(id) {
  const entry = waste.getAllWaste().find(w => w.id === id);
  if (!entry) return;
  showFormModal({
    title: 'Edit Waste Entry',
    fields: [
      { id: 'waste-qty', label: 'Quantity Lost', type: 'number', value: entry.quantity, min: 0.001, step: 'any' },
      { id: 'waste-reason', label: 'Reason', type: 'select', value: entry.reason, options: [
        { value: 'damaged', label: 'Damaged' },
        { value: 'expired', label: 'Expired' },
        { value: 'lost', label: 'Lost' },
        { value: 'defective', label: 'Defective' },
        { value: 'other', label: 'Other' },
      ]},
      { id: 'waste-note', label: 'Note (optional)', type: 'text', value: entry.note || '' },
    ],
    submitLabel: 'Save Changes',
    async onSubmit(vals) {
      const qty = vals['waste-qty'];
      if (!qty || qty <= 0) return false;
      await waste.updateWaste(id, {
        quantity: parseFloat(qty),
        reason: vals['waste-reason'],
        note: vals['waste-note'],
      });
      _r.renderWastePage?.();
      toast('Waste entry updated', 'success');
    },
  });
}

// ── CSV Import Modal ────────────────────────────────

export function showImportModal(type) {
  const labels = {
    products: 'Products',
    materials: 'Materials',
    recipes: 'Recipes',
  };
  const label = labels[type] || type;

  const overlay = document.createElement('div');
  overlay.className = 'import-modal-overlay';
  overlay.innerHTML = `
    <div class="import-modal">
      <div class="import-modal-header">
        <h3>Import ${label} from CSV</h3>
        <button class="import-modal-close">&times;</button>
      </div>
      <div class="import-modal-body">
        <p class="import-instructions">
          Download the CSV template, fill it in with your data, then upload the file to bulk-create ${label.toLowerCase()}.
          ${type === 'recipes' ? 'Product and material names must match existing items exactly.' : ''}
        </p>
        <button class="btn-secondary import-download-btn">Download Template</button>
        <div class="import-file-area">
          <label class="import-file-label">
            <span class="import-file-text">Choose CSV file...</span>
            <input type="file" accept=".csv" class="import-file-input" />
          </label>
        </div>
        <button class="btn-primary import-run-btn" disabled>Import</button>
        <div class="import-results"></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector('.import-modal-close');
  const downloadBtn = overlay.querySelector('.import-download-btn');
  const fileInput = overlay.querySelector('.import-file-input');
  const fileText = overlay.querySelector('.import-file-text');
  const importBtn = overlay.querySelector('.import-run-btn');
  const resultsDiv = overlay.querySelector('.import-results');

  let selectedFile = null;

  // Close
  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Download template
  downloadBtn.addEventListener('click', () => {
    if (type === 'products') downloadCSV(getProductTemplate(), 'products-template.csv');
    else if (type === 'materials') downloadCSV(getMaterialTemplate(), 'materials-template.csv');
    else if (type === 'recipes') downloadCSV(getRecipeTemplate(), 'recipes-template.csv');
  });

  // File selection
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      selectedFile = fileInput.files[0];
      fileText.textContent = selectedFile.name;
      importBtn.disabled = false;
    }
  });

  // Import
  importBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';
    resultsDiv.innerHTML = '';

    try {
      const text = await selectedFile.text();
      const records = parseCSV(text);

      if (!records.length) {
        resultsDiv.innerHTML = '<div class="import-error">No data rows found in CSV.</div>';
        importBtn.disabled = false;
        importBtn.textContent = 'Import';
        return;
      }

      let result;
      if (type === 'products') {
        result = await importProducts(records, products.addProduct.bind(products));
      } else if (type === 'materials') {
        result = await importMaterials(records, materials.addMaterial.bind(materials));
      } else if (type === 'recipes') {
        const allProds = products.getAllProducts();
        const allMats = materials.getAllMaterials();
        result = await importRecipes(records, recipes.addRecipe.bind(recipes), allProds, allMats);
      }

      let html = `<div class="import-success">Imported ${result.imported} ${label.toLowerCase()} successfully.</div>`;
      if (result.errors.length) {
        html += `<div class="import-error">${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}:</div>`;
        html += '<ul class="import-error-list">';
        for (const err of result.errors) {
          html += `<li>Row ${err.row}: ${escHtml(err.error)}</li>`;
        }
        html += '</ul>';
      }
      resultsDiv.innerHTML = html;

      // Refresh pages
      if (type === 'products') {
        _r.renderInventoryPage?.();
        _r.renderHeader?.();
        _r.renderAlerts?.();
      } else if (type === 'materials') {
        _r.renderMaterialsPage?.();
      } else if (type === 'recipes') {
        _r.renderRecipesPage?.();
      }

      toast(`Imported ${result.imported} ${label.toLowerCase()}${result.errors.length ? ` with ${result.errors.length} errors` : ''}`, result.errors.length ? 'warning' : 'success');
    } catch (err) {
      resultsDiv.innerHTML = `<div class="import-error">Import failed: ${escHtml(err.message || String(err))}</div>`;
    }

    importBtn.textContent = 'Import';
    importBtn.disabled = false;
  });
}

// ── Barcode Scanner ─────────────────────────────────

export function showBarcodeScanner(target) {
  const overlay = document.createElement('div');
  overlay.className = 'scanner-modal';
  overlay.innerHTML = `
    <button class="scanner-close" id="scanner-close-btn">&times;</button>
    <div class="scanner-container" id="scanner-reader"></div>
    <div class="scanner-result" id="scanner-result" style="display:none"></div>
  `;
  document.body.appendChild(overlay);

  let html5Qr = null;

  function cleanup() {
    if (html5Qr) {
      html5Qr.stop().catch(() => {});
      html5Qr.clear();
    }
    overlay.remove();
  }

  document.getElementById('scanner-close-btn').addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

  try {
    html5Qr = new window.Html5Qrcode('scanner-reader');
    html5Qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 280, height: 160 } },
      (decodedText) => {
        html5Qr.stop().catch(() => {});
        onScanSuccess(decodedText, target, overlay, cleanup);
      },
      () => {}
    ).catch(err => {
      document.getElementById('scanner-result').style.display = 'block';
      document.getElementById('scanner-result').innerHTML = `
        <h3>Camera Error</h3>
        <p>${escHtml(err.message || 'Could not access camera')}</p>
        <button class="btn-primary" onclick="this.closest('.scanner-modal').remove()">Close</button>
      `;
    });
  } catch (err) {
    document.getElementById('scanner-result').style.display = 'block';
    document.getElementById('scanner-result').innerHTML = `
      <h3>Scanner Unavailable</h3>
      <p>Barcode scanning requires HTTPS and camera access.</p>
      <button class="btn-primary" onclick="this.closest('.scanner-modal').remove()">Close</button>
    `;
  }
}

function onScanSuccess(code, target, overlay, cleanup) {
  const resultEl = document.getElementById('scanner-result');
  if (!resultEl) return;
  resultEl.style.display = 'block';

  // Search products by SKU
  const allProducts = products.getAllProducts();
  const matched = allProducts.find(p => p.sku && p.sku.toLowerCase() === code.toLowerCase());

  if (matched) {
    resultEl.innerHTML = `
      <h3>${escHtml(matched.name)}</h3>
      <p>SKU: ${escHtml(matched.sku)}</p>
      <p>Current Stock: <strong>${matched.quantity}</strong></p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
        <button class="btn-primary" id="scanner-restock-btn">Restock</button>
        <button class="btn-secondary" id="scanner-done-btn">Done</button>
      </div>
    `;
    document.getElementById('scanner-restock-btn')?.addEventListener('click', () => {
      cleanup();
      showRestockProductModal(matched.id);
    });
    document.getElementById('scanner-done-btn')?.addEventListener('click', cleanup);
  } else {
    // Also check materials
    const allMats = materials.getAllMaterials();
    const matchedMat = allMats.find(m => m.sku && m.sku.toLowerCase() === code.toLowerCase());
    if (matchedMat) {
      resultEl.innerHTML = `
        <h3>${escHtml(matchedMat.name)}</h3>
        <p>SKU: ${escHtml(matchedMat.sku)}</p>
        <p>On Hand: <strong>${matchedMat.quantity} ${escHtml(matchedMat.unit)}</strong></p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
          <button class="btn-primary" id="scanner-restock-btn">Restock</button>
          <button class="btn-secondary" id="scanner-done-btn">Done</button>
        </div>
      `;
      document.getElementById('scanner-restock-btn')?.addEventListener('click', () => {
        cleanup();
        showRestockMaterialModal(matchedMat.id);
      });
      document.getElementById('scanner-done-btn')?.addEventListener('click', cleanup);
    } else {
      resultEl.innerHTML = `
        <h3>Not Found</h3>
        <p>No product or material with SKU "<strong>${escHtml(code)}</strong>"</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
          <button class="btn-primary" id="scanner-create-btn">Create New ${target === 'material' ? 'Material' : config.label('Product')}</button>
          <button class="btn-secondary" id="scanner-done-btn">Close</button>
        </div>
      `;
      document.getElementById('scanner-create-btn')?.addEventListener('click', () => {
        cleanup();
        if (target === 'material') {
          showAddMaterialModal();
        } else {
          showAddProductModal();
        }
      });
      document.getElementById('scanner-done-btn')?.addEventListener('click', cleanup);
    }
  }
}

// ── Transfer Modal ──────────────────────────────────

export function showTransferModal(id) {
  const item = products.getProductById(id);
  if (!item) return;
  const allLocations = locations.getAllLocations();
  if (allLocations.length < 2) {
    toast('Add at least 2 locations in settings to transfer stock.', 'warning');
    return;
  }
  const locOptions = allLocations.filter(l => l.id !== item.locationId).map(l => ({ value: String(l.id), label: l.name }));
  const currentLoc = locations.getLocationById(item.locationId);

  showFormModal({
    title: `Transfer — ${item.name}`,
    fields: [
      { id: 'xfer-from', label: 'From', type: 'text', value: currentLoc ? currentLoc.name : 'Unassigned', disabled: true },
      { id: 'xfer-to', label: 'To Location', type: 'select', options: locOptions, required: true },
      { id: 'xfer-qty', label: 'Quantity', type: 'number', placeholder: 'e.g. 10', min: 1, max: item.quantity },
      { id: 'xfer-note', label: 'Note (optional)', type: 'text', placeholder: 'e.g. restocking downtown' },
    ],
    submitLabel: 'Transfer',
    async onSubmit(vals) {
      const qty = parseInt(vals['xfer-qty']);
      if (!qty || qty <= 0 || qty > item.quantity) { toast('Invalid quantity', 'warning'); return false; }
      const toLocId = parseInt(vals['xfer-to']);
      if (qty === item.quantity) {
        // Moving all stock — just change location
        await products.updateProduct(id, { locationId: toLocId });
      } else {
        // Partial transfer — reduce source, create new product at destination
        await products.changeQuantity(id, -qty);
        await products.addProduct({
          name: item.name, quantity: qty, locationId: toLocId,
          needsMade: false, inProduction: false, lowThreshold: item.lowThreshold,
          note: item.note, recipeId: item.recipeId, sellPrice: item.sellPrice,
          costOverride: item.costOverride, sku: item.sku, customFields: item.customFields,
        });
      }
      await history.addEntry({
        itemType: 'product', itemId: id, itemName: item.name,
        changeType: 'transfer', quantityChange: -qty, newQuantity: item.quantity - qty,
        note: `Transferred ${qty} to ${locations.getLocationById(toLocId)?.name || 'Unknown'}${vals['xfer-note'] ? ' — ' + vals['xfer-note'] : ''}`,
      });
      _r.renderInventoryPage?.();
      _r.renderHeader?.();
      toast(`${qty} ${item.name} transferred`, 'success');
    },
  });
}

// ── Team Modal ──────────────────────────────────────

export function showInviteMemberModal() {
  showFormModal({
    title: 'Invite Team Member',
    fields: [
      { key: 'email', label: 'Email Address', type: 'email', required: true },
      { key: 'role', label: 'Role', type: 'select', options: [
        { value: 'manager', label: 'Manager' },
        { value: 'staff', label: 'Staff' },
        { value: 'viewer', label: 'Viewer' },
      ], required: true },
    ],
    onSubmit: async (data) => {
      try {
        await apiTeamInvite(data.email, data.role);
        toast(`Invite sent to ${data.email}`, 'success');
        _r.loadTeamSection?.();
      } catch (err) {
        toast(_r.friendlyError?.(err) || 'Something went wrong. Please try again.', 'error');
      }
    },
  });
}

// ── CSV Export ───────────────────────────────────────

export function exportCSV() {
  const allProducts = products.getAllProducts();
  const rows = [['Name', 'Quantity', 'Needs Made', 'In Production', 'Note']];
  allProducts.forEach(p => {
    rows.push([p.name, p.quantity, p.needsMade ? 'Yes' : 'No', p.inProduction ? 'Yes' : 'No', p.note]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  toast('CSV exported', 'success');
}
