// ── App Entry Point ──────────────────────────────────

import * as db from './db.js';
import * as config from './config.js';
import { initRouter, onNavigate, getCurrentPage } from './router.js';
import * as products from './stores/products.js';
import * as materials from './stores/materials.js';
import * as history from './stores/history.js';
import * as production from './stores/production.js';
import * as recipes from './stores/recipes.js';
import * as suppliers from './stores/suppliers.js';
import * as orders from './stores/orders.js';
import * as batches from './stores/batches.js';
import * as waste from './stores/waste.js';
import * as locations from './stores/locations.js';
import * as customers from './stores/customers.js';
import * as sales from './stores/sales.js';
import { renderHeader } from './ui/header.js';
import { renderAlerts } from './ui/alerts.js';
import { renderProductGrid, renderMaterialGrid } from './ui/grid.js';
import { renderHistoryTable } from './ui/tables.js';
import { showFormModal, escHtml, showConfirmModal, showPromptModal } from './ui/modals.js';
import { renderTermsPage, renderPrivacyPage } from './ui/pages/legal.js';
import { renderHelpPage } from './ui/pages/help.js';
import { toast, showLoading, hideLoading } from './ui/toast.js';
import { getProductForecasts, getMaterialForecasts } from './services/forecasting.js';
import { detectReorderNeeded, generatePurchaseOrders, formatPOEmail } from './services/auto-order.js';
import * as expenses from './stores/expenses.js';
import * as transactions from './stores/transactions.js';
import * as snapshots from './stores/snapshots.js';
import { renderExpensesPage, renderCostAnalysisPage, renderProductDetailBreakdown, getExpenseFormFields, registerStores } from './ui/cost-analysis.js';
import { renderTransactionsPage, getTransactionFormFields, setPlaidAccounts, setPlaidSyncing } from './ui/transactions.js';
import { openPlaidLink, getLinkedAccounts, syncTransactions, syncAllAccounts, removeAccount } from './services/plaid.js';
import { connectQuickBooks, disconnectQuickBooks, getQBStatus, syncProducts as qbSyncProducts, syncSuppliers as qbSyncSuppliers, syncExpenses as qbSyncExpenses, fetchPLReport } from './services/quickbooks.js';
import { renderQuickBooksSection } from './ui/quickbooks.js';
import { apiUpdateProfile, apiTeamInvite, apiTeamAccept, apiTeamList, apiTeamRemove, apiTeamUpdateRole, apiTeamCheckInvites } from './api-client.js';
import {
  initSupabase, getSession, signUp, signIn, signOut,
  getBusinessProfile, getCachedBusiness, isAuthenticated,
  resetPassword, updatePassword, getSubscriptionTier,
} from './supabase.js';
import { renderPricingPage, renderBillingSection, createCheckoutSession, openBillingPortal, getSubscriptionStatus } from './ui/pricing.js';
import { connectEtsy, disconnectEtsy, syncEtsyOrders, connectShopify, disconnectShopify, syncShopifyOrders, getChannelStatus, simulateEtsyWebhook, simulateShopifyWebhook } from './services/ecommerce.js';
import { getShippingRates, createShippingLabel } from './services/shipping.js';
import { renderSalesChannelsSection } from './ui/ecommerce.js';
import { startTutorial } from './ui/tutorial.js';
import { showLandingPage, showPasswordResetPage } from './ui/landing.js';
import {
  getProductTemplate, getMaterialTemplate, getRecipeTemplate,
  parseCSV, importProducts, importMaterials, importRecipes,
  downloadCSV,
} from './services/csv-import.js';
import {
  registerRenderers,
  showAddProductModal, showRestockProductModal, showEditNoteModal,
  showAddMaterialModal, showRestockMaterialModal,
  showAddSupplierModal, showEditSupplierModal,
  showAddRecipeModal, showEditRecipeModal, showProduceFromRecipeModal,
  deductRecipeMaterials,
  showLogWasteModal,
  showAddExpenseModal, showEditExpenseModal,
  showAddTransactionModal, showEditTransactionModal,
  showEditWasteModal,
  showImportModal, showBarcodeScanner,
  showTransferModal, showInviteMemberModal,
  exportCSV,
} from './ui/modal-forms.js';

// ── Friendly Error Helper ────────────────────────────

function friendlyError(err) {
  const msg = (err?.message || err || '').toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network')) return 'Connection error. Please check your internet and try again.';
  if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('invalid token') || msg.includes('session expired')) return 'Your session has expired. Please log in again.';
  if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already exists')) return 'This item already exists.';
  if (msg.includes('foreign key') || msg.includes('referenced') || msg.includes('linked')) return 'This item is linked to other records and cannot be deleted.';
  if (msg.includes('not found') || msg.includes('404')) return 'Item not found. It may have been deleted.';
  if (msg.includes('permission') || msg.includes('403') || msg.includes('forbidden')) return 'You do not have permission to do this.';
  if (msg.includes('timeout')) return 'Request timed out. Please try again.';
  return 'Something went wrong. Please try again.';
}

// ── Register renderers for modal-forms module ────────
registerRenderers({
  renderInventoryPage: () => renderInventoryPage(),
  renderMaterialsPage: () => renderMaterialsPage(),
  renderSuppliersPage: () => renderSuppliersPage(),
  renderRecipesPage: () => renderRecipesPage(),
  renderProductionPage: () => renderProductionPage(),
  renderWastePage: () => renderWastePage(),
  renderExpensesPage: () => renderExpensesPage(),
  renderTransactionsPage: () => renderTransactionsPage(),
  renderAll: () => renderAll(),
  renderHeader: () => renderHeader(),
  renderAlerts: () => renderAlerts(),
  loadTeamSection: () => loadTeamSection(),
  friendlyError,
});

// ── State ────────────────────────────────────────────

let productFilter = 'all';
let productSearch = '';
let materialSearch = '';
let supplierSearch = '';
let orderSearch = '';
let historyFilter = 'all';
let currentUserRole = 'owner'; // default until loaded
let deferredPrompt = null;

// ── PWA Install Prompt ──────────────────────────────

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btn-install-app');
  if (btn) btn.style.display = 'block';
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const btn = document.getElementById('btn-install-app');
  if (btn) btn.style.display = 'none';
});

// ── Roles & Permissions ─────────────────────────────

const ROLE_HIERARCHY = { owner: 4, manager: 3, staff: 2, viewer: 1 };

function hasPermission(requiredRole) {
  return (ROLE_HIERARCHY[currentUserRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 99);
}

async function getCurrentUserRole() {
  try {
    const members = await apiTeamList();
    const session = await getSession();
    const myId = session?.user?.id;
    if (!myId) return 'owner';
    const me = members.find(m => m.user_id === myId);
    return me?.role || 'owner';
  } catch (e) {
    console.warn('Could not fetch user role:', e);
    return 'owner'; // fallback to owner for business owners
  }
}

function applyRoleRestrictions() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Tab visibility by role
  const tabRestrictions = {
    viewer: ['expenses', 'costs', 'transactions', 'pricing', 'settings'],
    staff: ['costs', 'expenses', 'transactions', 'pricing'],
  };

  // First show all tabs
  sidebar.querySelectorAll('.tab[data-tab]').forEach(tab => tab.style.display = '');

  // Hide restricted tabs
  const hidden = currentUserRole === 'viewer' ? tabRestrictions.viewer
    : currentUserRole === 'staff' ? tabRestrictions.staff
    : [];

  hidden.forEach(tab => {
    const el = sidebar.querySelector(`[data-tab="${tab}"]`);
    if (el) el.style.display = 'none';
  });

  // Hide action buttons for viewer
  if (currentUserRole === 'viewer') {
    document.querySelectorAll('[data-action="add-product"], [data-action="add-material"], [data-action="import-products-csv"], [data-action="import-materials-csv"]').forEach(b => b.style.display = 'none');
  }

  // Hide pricing tab for manager
  if (currentUserRole === 'manager') {
    const pricingTab = sidebar.querySelector('[data-tab="pricing"]');
    if (pricingTab) pricingTab.style.display = 'none';
  }
}

async function checkPendingInvites() {
  try {
    const { invites } = await apiTeamCheckInvites();
    if (!invites || invites.length === 0) return;

    for (const invite of invites) {
      const accepted = await showConfirmModal({ title: 'Team Invite', message: `You've been invited to join "${invite.businessName}" as ${invite.role}. Accept?`, confirmLabel: 'Accept' });
      if (accepted) {
        await apiTeamAccept(invite.id);
        toast(`Joined ${invite.businessName}!`, 'success');
        location.reload();
        return;
      }
    }
  } catch (e) {
    console.warn('Invite check failed:', e);
  }
}

// ── Init ─────────────────────────────────────────────

async function init() {
  // Initialize Supabase auth
  initSupabase();

  // Check if this is a password recovery redirect
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(hash.replace('#', ''));
  const isRecovery = hash.includes('type=recovery') || params.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
  const hasError = hash.includes('error=') || params.get('error');
  const errorDesc = hashParams.get('error_description') || params.get('error_description') || '';

  if (isRecovery || hasError) {
    // Try to establish session from recovery tokens
    const session = await getSession();
    if (isRecovery && session) {
      showPasswordResetPage({ onComplete: async () => { await signOut(); showLandingPage({ onLogin: loadApp }); } });
      return;
    }
    if (hasError && errorDesc.includes('expired')) {
      // Token expired — show landing with error
      showLandingPage({ onLogin: loadApp });
      setTimeout(() => {
        const errEl = document.getElementById('login-error') || document.getElementById('signup-error');
        if (errEl) { errEl.textContent = 'Password reset link has expired. Please request a new one.'; errEl.style.display = 'block'; }
      }, 500);
      return;
    }
    if (isRecovery && !session) {
      // Recovery token present but session failed — show reset page anyway and let it fail gracefully
      showPasswordResetPage({ onComplete: async () => { await signOut(); showLandingPage({ onLogin: loadApp }); } });
      return;
    }
  }

  // Check for existing session
  const session = await getSession();

  if (!session) {
    // No session — show landing page
    showLandingPage({ onLogin: loadApp });
    return;
  }

  // Session exists — load the app
  await loadApp();
}

async function loadApp() {
  try {
    showLoading('Loading your business...');
  } catch(e) {}

  // Hide landing overlay if visible
  const landingOverlay = document.getElementById('landing-overlay');
  if (landingOverlay) landingOverlay.remove();

  await db.openDB();

  // Load profile from Supabase (or fall back to local config)
  const bizProfile = await getBusinessProfile();
  const profile = await config.loadProfile();

  // If no local profile but we have a Supabase business, apply it
  if (!config.hasProfile() && bizProfile) {
    await config.initFromPreset(bizProfile.type || 'general', bizProfile.name);
    await config.saveProfile({
      name: bizProfile.name,
      type: bizProfile.type,
    });
  }

  // Sync all settings from cloud (overrides stale local data on new device login)
  if (bizProfile && config.hasProfile()) {
    const cloudUpdates = {};
    const localProfile = config.getProfile();
    if (localProfile.name !== bizProfile.name) cloudUpdates.name = bizProfile.name;
    if (localProfile.type !== (bizProfile.type || 'general')) cloudUpdates.type = bizProfile.type || localProfile.type;
    if (bizProfile.theme && JSON.stringify(bizProfile.theme) !== JSON.stringify(localProfile.theme)) cloudUpdates.theme = bizProfile.theme;
    if (bizProfile.globalThresholds && JSON.stringify(bizProfile.globalThresholds) !== JSON.stringify(localProfile.globalThresholds)) cloudUpdates.globalThresholds = bizProfile.globalThresholds;
    if (bizProfile.shipFromAddress) cloudUpdates.shipFromAddress = bizProfile.shipFromAddress;
    if (Object.keys(cloudUpdates).length > 0) {
      await config.saveProfile(cloudUpdates);
    }
  }

  // Check if we need setup wizard (first time on this device)
  if (!config.hasProfile()) {
    showSetupWizard();
    return;
  }

  // Check pending team invites and load current user role
  await checkPendingInvites();
  currentUserRole = await getCurrentUserRole();

  // Load all data
  await Promise.all([
    products.loadProducts(),
    materials.loadMaterials(),
    history.loadHistory(),
    production.loadProduction(),
    recipes.loadRecipes(),
    suppliers.loadSuppliers(),
    orders.loadOrders(),
    batches.loadBatches(),
    waste.loadWaste(),
    locations.loadLocations(),
    expenses.loadExpenses(),
    transactions.loadTransactions(),
    customers.loadCustomers(),
    sales.loadSales(),
    snapshots.loadSnapshots(),
  ]);

  // Register stores for cost analysis UI
  registerStores({ getAllProducts: products.getAllProducts });

  // Init router and render
  onNavigate(handlePageChange);
  initRouter();
  renderAll();
  setupEventListeners();
  applyRoleRestrictions();
  hideLoading();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ── Landing page & password reset imported from ./ui/landing.js ──
// (showLandingPage, showPasswordResetPage)

// ── Render All ───────────────────────────────────────

function renderAll() {
  renderHeader();
  renderAlerts();
  handlePageChange(getCurrentPage());
}

// ── Page Rendering ───────────────────────────────────

function handlePageChange(page) {
  // Only show alerts on dashboard, inventory, and materials
  const alertsEl = document.getElementById('alerts');
  if (alertsEl) {
    alertsEl.style.display = ['dashboard', 'inventory', 'materials'].includes(page) ? '' : 'none';
  }

  if (page === 'inventory') renderInventoryPage();
  else if (page === 'materials') renderMaterialsPage();
  else if (page === 'history') renderHistoryPage();
  else if (page === 'dashboard') renderDashboardPage();
  else if (page === 'recipes') renderRecipesPage();
  else if (page === 'production') renderProductionPage();
  else if (page === 'suppliers') renderSuppliersPage();
  else if (page === 'orders') renderOrdersPage();
  else if (page === 'waste') renderWastePage();
  else if (page === 'expenses') renderExpensesPage();
  else if (page === 'costs') renderCostAnalysisPage();
  else if (page === 'transactions') {
    try { renderTransactionsPage(); } catch (e) { console.error('Transactions render error:', e); }
    refreshPlaidAccounts().then(() => {
      try { renderTransactionsPage(); } catch (e) { console.error('Transactions re-render error:', e); }
    }).catch(e => console.warn('Plaid accounts fetch failed:', e));
  }
  else if (page === 'customers') renderCustomersPage();
  else if (page === 'sales') renderSalesPage();
  else if (page === 'pricing') renderPricingPageWrapper();
  else if (page === 'help') renderHelpPage();
  else if (page === 'settings') renderSettingsPage();
  else if (page === 'terms') renderTermsPage();
  else if (page === 'privacy') renderPrivacyPage();
}

function renderInventoryPage() {
  let items = products.filterProducts({ filter: productFilter, search: productSearch });

  // Location filter
  const allLocations = locations.getAllLocations();
  const toolbar = document.querySelector('#page-inventory .toolbar-left');
  if (toolbar && allLocations.length > 0) {
    let locSelect = document.getElementById('loc-filter');
    if (!locSelect) {
      locSelect = document.createElement('select');
      locSelect.id = 'loc-filter';
      locSelect.className = 'search-input';
      locSelect.style.width = 'auto';
      locSelect.innerHTML = `<option value="">All Locations</option>` +
        allLocations.map(l => `<option value="${l.id}">${escHtml(l.name)}</option>`).join('');
      locSelect.addEventListener('change', () => { renderInventoryPage(); });
      toolbar.appendChild(locSelect);
    }
    const selectedLoc = locSelect.value;
    if (selectedLoc) {
      items = items.filter(p => p.locationId === parseInt(selectedLoc));
    }
  }

  renderProductGrid('grid', items);

  // Bulk action bar for products
  const invPage = document.getElementById('page-inventory');
  if (invPage && !document.getElementById('bulk-bar-products')) {
    const bar = document.createElement('div');
    bar.className = 'bulk-bar';
    bar.id = 'bulk-bar-products';
    bar.style.display = 'none';
    bar.innerHTML = `<span class="bulk-count">0 selected</span><button class="btn-secondary" data-action="bulk-delete-products" style="color:var(--danger)">Delete Selected</button>`;
    invPage.appendChild(bar);
  }
}

function renderMaterialsPage() {
  const items = materials.filterMaterials({ search: materialSearch });
  renderMaterialGrid('mat-grid', items);

  // Bulk action bar for materials
  const matPage = document.getElementById('page-materials');
  if (matPage && !document.getElementById('bulk-bar-materials')) {
    const bar = document.createElement('div');
    bar.className = 'bulk-bar';
    bar.id = 'bulk-bar-materials';
    bar.style.display = 'none';
    bar.innerHTML = `<span class="bulk-count">0 selected</span><button class="btn-secondary" data-action="bulk-delete-materials" style="color:var(--danger)">Delete Selected</button>`;
    matPage.appendChild(bar);
  }
}

function renderHistoryPage() {
  const entries = history.filterHistory({ type: historyFilter });
  renderHistoryTable('history-body', 'history-empty', entries);
}

function renderDashboardPage() {
  const el = document.getElementById('page-dashboard');
  if (!el) return;
  const pStats = products.getStats();
  const mStats = materials.getStats();
  const allProds = products.getAllProducts();
  const allMats = materials.getAllMaterials();

  // Forecasts
  const prodForecasts = getProductForecasts(allProds);
  const matForecasts = getMaterialForecasts(allMats);

  // Calculate total inventory value
  let totalValue = 0;
  for (const m of allMats) {
    if (m.costPerUnit) totalValue += m.costPerUnit * m.quantity;
  }

  // Find soonest stockout
  const soonestOut = prodForecasts.find(f => f.daysUntilOut !== Infinity);
  const soonestDays = soonestOut ? soonestOut.daysUntilOut : null;

  // Onboarding detection
  const pCount = allProds.length;
  const mCount = allMats.length;
  const rCount = recipes.getAllRecipes().length;
  const eCount = expenses.getAllExpenses().length;
  const allStepsDone = pCount > 0 && mCount > 0 && rCount > 0 && eCount > 0;

  let html = '';

  // Getting started cards (show if any step is incomplete)
  if (!allStepsDone) {
    html += `
    <div class="onboarding-section">
      <h3>Getting Started</h3>
      <p style="color:var(--text-muted);margin-bottom:16px;">Complete these steps to set up your business</p>
      <button class="take-tour-btn" data-action="start-tutorial">&#9654; Take a Tour</button>
      <div class="onboarding-grid">
        <div class="onboarding-card ${pCount > 0 ? 'onboarding-done' : ''}">
          <div class="onboarding-icon">${pCount > 0 ? '&#10003;' : '1'}</div>
          <h4>Add Products</h4>
          <p>Add the products you sell with prices and SKUs</p>
          <a href="#inventory" class="btn-secondary" style="margin-top:auto;">Go to Inventory</a>
        </div>
        <div class="onboarding-card ${mCount > 0 ? 'onboarding-done' : ''}">
          <div class="onboarding-icon">${mCount > 0 ? '&#10003;' : '2'}</div>
          <h4>Add Materials</h4>
          <p>Add raw materials with costs and suppliers</p>
          <a href="#materials" class="btn-secondary" style="margin-top:auto;">Go to Materials</a>
        </div>
        <div class="onboarding-card ${rCount > 0 ? 'onboarding-done' : ''}">
          <div class="onboarding-icon">${rCount > 0 ? '&#10003;' : '3'}</div>
          <h4>Create Recipes</h4>
          <p>Link materials to products with exact quantities</p>
          <a href="#recipes" class="btn-secondary" style="margin-top:auto;">Go to Recipes</a>
        </div>
        <div class="onboarding-card ${eCount > 0 ? 'onboarding-done' : ''}">
          <div class="onboarding-icon">${eCount > 0 ? '&#10003;' : '4'}</div>
          <h4>Set Expenses</h4>
          <p>Add rent, labor, and other business costs</p>
          <a href="#expenses" class="btn-secondary" style="margin-top:auto;">Go to Expenses</a>
        </div>
      </div>
    </div>`;
  }

  html += `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
      <div class="settings-section" style="text-align:center;margin-bottom:0;">
        <div style="font-size:2.4rem;color:var(--accent);font-weight:300;">${pStats.total.toLocaleString()}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">Total ${config.label('products')} In Stock</div>
      </div>
      <div class="settings-section" style="text-align:center;margin-bottom:0;">
        <div style="font-size:2.4rem;color:${pStats.lowStock > 0 ? 'var(--danger)' : 'var(--success)'};font-weight:300;">${pStats.lowStock}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">Low Stock Items</div>
      </div>
      <div class="settings-section" style="text-align:center;margin-bottom:0;">
        <div style="font-size:2.4rem;color:${soonestDays !== null && soonestDays <= 7 ? 'var(--warning)' : 'var(--accent)'};font-weight:300;">${soonestDays !== null ? soonestDays + 'd' : '--'}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">Next Stockout</div>
      </div>
      <div class="settings-section" style="text-align:center;margin-bottom:0;">
        <div style="font-size:2.4rem;color:var(--accent);font-weight:300;">$${totalValue.toFixed(0)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">Material Value</div>
      </div>
    </div>
  `;

  // Days Until Out — Product Forecasts
  const urgentProds = prodForecasts.filter(f => f.daysUntilOut !== Infinity);
  html += `
    <div class="settings-section" style="margin-bottom:18px;">
      <h3>${config.label('Product')} Forecasts — Days Until Out</h3>
      ${urgentProds.length ? urgentProds.map(f => {
        const barWidth = Math.min(100, Math.max(2, (f.daysUntilOut / 30) * 100));
        const barColor = f.urgency === 'critical' ? 'var(--danger)' : f.urgency === 'high' ? 'var(--warning)' : f.urgency === 'medium' ? 'var(--accent)' : 'var(--success)';
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
            <span style="min-width:140px;color:var(--text);">${escHtml(f.name)}</span>
            <div style="flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${barWidth}%;background:${barColor};border-radius:4px;"></div>
            </div>
            <span style="min-width:50px;text-align:right;color:${barColor};font-weight:500;">${f.daysUntilOut}d</span>
            <span style="min-width:60px;text-align:right;color:var(--text-muted);font-size:0.78rem;">${f.burnRate}/day</span>
          </div>`;
      }).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;">No consumption data yet. Sell or produce items to see forecasts.</p>'}
    </div>
  `;

  // Material Forecasts
  const urgentMats = matForecasts.filter(f => f.daysUntilOut !== Infinity);
  html += `
    <div class="settings-section" style="margin-bottom:18px;">
      <h3>Material Forecasts — Days Until Out</h3>
      ${urgentMats.length ? urgentMats.map(f => {
        const barWidth = Math.min(100, Math.max(2, (f.daysUntilOut / 30) * 100));
        const barColor = f.urgency === 'critical' ? 'var(--danger)' : f.urgency === 'high' ? 'var(--warning)' : f.urgency === 'medium' ? 'var(--accent)' : 'var(--success)';
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
            <span style="min-width:140px;color:var(--text);">${escHtml(f.name)}</span>
            <div style="flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${barWidth}%;background:${barColor};border-radius:4px;"></div>
            </div>
            <span style="min-width:50px;text-align:right;color:${barColor};font-weight:500;">${f.daysUntilOut}d</span>
            <span style="min-width:80px;text-align:right;color:var(--text-muted);font-size:0.78rem;">${f.burnRate}/${f.unit}/day</span>
          </div>`;
      }).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;">No consumption data yet. Produce items to see material forecasts.</p>'}
    </div>
  `;

  // Low stock summary
  const lowProducts = allProds.filter(p => {
    const t = p.lowThreshold ?? config.getProfile()?.globalThresholds?.productLow ?? 10;
    return p.quantity <= t;
  });
  const lowMats = allMats.filter(m => {
    const t = m.lowThreshold ?? config.getProfile()?.globalThresholds?.materialLow ?? 50;
    return m.quantity <= t;
  });

  if (lowProducts.length || lowMats.length) {
    html += `<div class="settings-section"><h3>Low Stock Summary</h3>`;
    if (lowProducts.length) {
      html += `<div style="margin-bottom:12px;"><div style="font-size:0.75rem;color:var(--danger);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">${config.label('Products')}</div>`;
      html += lowProducts.map(p => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
        <span>${escHtml(p.name)}</span><span style="color:var(--danger);">${p.quantity} units</span>
      </div>`).join('');
      html += '</div>';
    }
    if (lowMats.length) {
      html += `<div><div style="font-size:0.75rem;color:var(--warning);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Materials</div>`;
      html += lowMats.map(m => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
        <span>${escHtml(m.name)}</span><span style="color:var(--warning);">${m.quantity} ${m.unit}</span>
      </div>`).join('');
      html += '</div>';
    }
    html += '</div>';
  }

  // Inventory Trend Chart
  html += `
    <div class="settings-section">
      <h3>Inventory Trend (14 days)</h3>
      <div class="trend-chart" id="trend-chart"></div>
    </div>
  `;

  el.innerHTML = html;

  // Populate trend chart
  const chartEl = document.getElementById('trend-chart');
  if (chartEl) {
    const recent = snapshots.getRecentSnapshots(14);
    if (recent.length > 1) {
      const max = Math.max(...recent.map(s => s.data?.totalProducts || 0));
      chartEl.innerHTML = recent.map(s => {
        const val = s.data?.totalProducts || 0;
        const pct = max > 0 ? (val / max * 100) : 0;
        const label = new Date(s.date + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
        return `<div class="trend-bar-wrap">
          <div class="trend-bar" style="height:${pct}%"></div>
          <div class="trend-label">${label}</div>
          <div class="trend-value">${val}</div>
        </div>`;
      }).join('');
    } else {
      chartEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Trend data will appear after a few days of use.</p>';
    }
  }
}

// ── Suppliers Page ───────────────────────────────────

function renderSuppliersPage() {
  const el = document.getElementById('page-suppliers');
  if (!el) return;
  const allSuppliers = suppliers.getAllSuppliers();
  const filteredSuppliers = supplierSearch
    ? allSuppliers.filter(s => {
        const q = supplierSearch.toLowerCase();
        return (s.name && s.name.toLowerCase().includes(q))
          || (s.contactName && s.contactName.toLowerCase().includes(q))
          || (s.email && s.email.toLowerCase().includes(q));
      })
    : allSuppliers;

  let html = `
    <div class="toolbar">
      <div class="toolbar-left">
        <input class="search-input" id="supplier-search" type="text" placeholder="Search suppliers..." value="${escHtml(supplierSearch)}" />
        <span style="color:var(--text-muted);font-size:0.85rem;">${filteredSuppliers.length} supplier${filteredSuppliers.length !== 1 ? 's' : ''}</span>
      </div>
      <button class="btn-primary" data-action="add-supplier">+ Add Supplier</button>
    </div>
  `;

  if (!filteredSuppliers.length) {
    html += `<div class="empty"><div class="empty-icon">--</div><p>${supplierSearch ? 'No suppliers match your search.' : 'No suppliers yet. Add suppliers to link them with materials and enable auto-ordering.'}</p></div>`;
  } else {
    // Pre-build supplier→material count map (avoids O(S*M) loop)
    const matCountMap = new Map();
    for (const m of materials.getAllMaterials()) {
      if (m.supplierId) matCountMap.set(m.supplierId, (matCountMap.get(m.supplierId) || 0) + 1);
    }
    html += '<div class="grid">';
    for (const s of filteredSuppliers) {
      const matCount = matCountMap.get(s.id) || 0;
      html += `
        <div class="card in-stock" data-supplier-id="${s.id}">
          <div class="card-header">
            <div>
              <div class="candle-name">${escHtml(s.name)}</div>
              ${s.contactName ? `<div class="candle-note">${escHtml(s.contactName)}</div>` : ''}
            </div>
            ${matCount > 0 ? `<span class="badge ok">${matCount} material${matCount !== 1 ? 's' : ''}</span>` : ''}
          </div>
          <div style="font-size:0.85rem;margin-bottom:14px;">
            ${s.email ? `<div style="margin-bottom:4px;color:var(--text-muted);">${escHtml(s.email)}</div>` : ''}
            ${s.phone ? `<div style="margin-bottom:4px;color:var(--text-muted);">${escHtml(s.phone)}</div>` : ''}
            ${s.defaultLeadTimeDays ? `<div style="color:var(--accent);font-size:0.8rem;">Lead time: ${s.defaultLeadTimeDays} days</div>` : ''}
          </div>
          ${s.notes ? `<div style="font-size:0.8rem;color:var(--text-muted);font-style:italic;margin-bottom:12px;">${escHtml(s.notes)}</div>` : ''}
          <div class="card-footer">
            <div class="card-actions">
              <button class="toggle-btn" data-action="edit-supplier" data-id="${s.id}">Edit</button>
            </div>
            <button class="btn-delete" data-action="delete-supplier" data-id="${s.id}" title="Remove">x</button>
          </div>
        </div>`;
    }
    html += '</div>';
  }

  el.innerHTML = html;

  const supSearchEl = document.getElementById('supplier-search');
  if (supSearchEl) {
    supSearchEl.oninput = e => {
      supplierSearch = e.target.value.trim();
      renderSuppliersPage();
    };
  }
}

// ── Recipes Page ─────────────────────────────────────

function renderRecipesPage() {
  const el = document.getElementById('page-recipes');
  if (!el) return;
  const allRecipes = recipes.getAllRecipes();
  const allMats = materials.getAllMaterials();
  const allProds = products.getAllProducts();

  let html = `
    <div class="toolbar">
      <div class="toolbar-left">
        <span style="color:var(--text-muted);font-size:0.85rem;">${allRecipes.length} recipe${allRecipes.length !== 1 ? 's' : ''}</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary" data-action="import-recipes-csv">Import CSV</button>
        <button class="btn-primary" data-action="add-recipe">+ Add Recipe</button>
      </div>
    </div>
  `;

  if (!allRecipes.length) {
    html += `<div class="empty"><div class="empty-icon">--</div><p>No recipes yet. Recipes define what materials are needed to produce each ${config.label('product').toLowerCase()}.</p></div>`;
  } else {
    html += '<div class="grid">';
    const matMap = new Map(allMats.map(m => [m.id, m]));
    for (const r of allRecipes) {
      const prod = allProds.find(p => p.id === r.productId);
      const cost = recipes.calculateRecipeCost(r, matMap);

      html += `
        <div class="card in-stock" data-recipe-id="${r.id}">
          <div class="card-header">
            <div>
              <div class="candle-name">${escHtml(r.name)}</div>
              ${prod ? `<div class="candle-note">Linked to: ${escHtml(prod.name)}</div>` : '<div class="candle-note">Template (not linked)</div>'}
            </div>
            ${cost > 0 ? `<span class="badge ok">$${cost.toFixed(2)}</span>` : ''}
          </div>
          <div style="margin-bottom:14px;">
            <div class="qty-label" style="margin-bottom:8px;">Ingredients (yields ${r.yieldQty})</div>
            ${r.ingredients.map(ing => {
              const mat = allMats.find(m => m.id === ing.materialId);
              return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem;border-bottom:1px solid var(--border);">
                <span>${mat ? escHtml(mat.name) : 'Unknown'}</span>
                <span style="color:var(--accent);">${ing.quantity} ${mat?.unit || ''}</span>
              </div>`;
            }).join('')}
            ${r.ingredients.length === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;">No ingredients defined</div>' : ''}
          </div>
          ${r.notes ? `<div style="font-size:0.8rem;color:var(--text-muted);font-style:italic;margin-bottom:12px;">${escHtml(r.notes)}</div>` : ''}
          <div class="card-footer">
            <div class="card-actions">
              <button class="toggle-btn" data-action="edit-recipe" data-id="${r.id}">Edit</button>
              <button class="toggle-btn" data-action="produce-from-recipe" data-id="${r.id}">Produce</button>
            </div>
            <button class="btn-delete" data-action="delete-recipe" data-id="${r.id}" title="Remove">x</button>
          </div>
        </div>`;
    }
    html += '</div>';
  }

  el.innerHTML = html;
}

// ── Production Page ──────────────────────────────────

function renderProductionPage() {
  const el = document.getElementById('page-production');
  if (!el) return;

  const achieveData = production.getAchievementData();
  const milestones = production.getMilestones();
  const profile = config.getProfile();
  const achieve = profile?.achievement || {};

  let html = '';

  // Achievement section (if enabled)
  if (achieveData) {
    html += `
      <div class="settings-section" style="display:flex;align-items:center;gap:32px;flex-wrap:wrap;margin-bottom:24px;">
        <div style="font-size:4rem;line-height:1;">${achieve.emoji || '🎯'}</div>
        <div style="flex:1;min-width:200px;">
          <div style="font-size:3.5rem;color:var(--accent);line-height:1;font-weight:300;">${achieveData.earned}</div>
          <div style="color:var(--text-muted);font-size:0.8rem;letter-spacing:0.12em;text-transform:uppercase;margin-top:4px;">${achieve.label || 'Milestone'}s Earned</div>
        </div>
        <div style="flex:2;min-width:260px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.82rem;">
            <span style="color:var(--text-muted);letter-spacing:0.06em;text-transform:uppercase;font-size:0.75rem;">Progress to Next</span>
            <span style="color:var(--accent);font-size:1.1rem;">${achieveData.pct}%</span>
          </div>
          <div style="height:14px;background:var(--surface2);border-radius:7px;overflow:hidden;border:1px solid var(--border);">
            <div style="height:100%;background:linear-gradient(90deg,var(--accent-dim),var(--accent));border-radius:7px;width:${achieveData.pct}%;transition:width 0.4s;"></div>
          </div>
          <div style="margin-top:8px;font-size:0.8rem;color:var(--text-muted);">
            <strong style="color:var(--text);">${achieveData.until}</strong> more until ${achieve.label || 'milestone'} #<strong style="color:var(--text);">${achieveData.nextNum}</strong>
            &nbsp;&middot;&nbsp; <strong style="color:var(--text);">${achieveData.totalProduced.toLocaleString()}</strong> total produced
          </div>
        </div>
      </div>
    `;

    // Milestones
    if (milestones.length) {
      html += '<div class="settings-section" style="margin-bottom:24px;"><h3>Milestones</h3>';
      html += milestones.map(m => {
        const cls = m.isEarned ? 'earned' : m.isNext ? 'next' : 'future';
        const icon = m.isEarned ? achieve.emoji : m.isNext ? '>' : '-';
        const statusText = m.isEarned
          ? `Earned at ${m.target.toLocaleString()}`
          : `${m.away.toLocaleString()} away`;
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;
            border:1px solid ${m.isEarned ? 'var(--accent)' : m.isNext ? 'var(--accent-dim)' : 'var(--border)'};
            background:${m.isEarned ? 'var(--surface2)' : 'var(--surface)'};
            ${m.isFuture ? 'opacity:0.5;' : ''}margin-bottom:8px;font-size:0.85rem;">
            <span style="font-size:1.2rem;">${icon}</span>
            <span style="flex:1;">${achieve.label} <strong style="color:var(--accent);">#${m.num}</strong> — at ${m.target.toLocaleString()}</span>
            <span style="font-size:0.75rem;color:${m.isEarned ? 'var(--success)' : 'var(--text-muted)'};">${statusText}</span>
          </div>`;
      }).join('');
      html += '</div>';
    }
  }

  // Log Production
  html += `
    <div class="settings-section" style="margin-bottom:24px;">
      <h3>Log Production</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;flex:1;min-width:140px;">
          <label>Quantity Produced</label>
          <input type="number" id="prod-qty" placeholder="e.g. 50" min="1" />
        </div>
        <div class="form-group" style="margin-bottom:0;flex:1;min-width:140px;">
          <label>${config.label('Product')} (optional)</label>
          <select id="prod-product">
            <option value="">General production</option>
            ${products.getAllProducts().map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;flex:1;min-width:140px;">
          <label>Note (optional)</label>
          <input type="text" id="prod-note" placeholder="e.g. Batch run" />
        </div>
        <button class="btn-primary" data-action="log-production" style="align-self:flex-end;white-space:nowrap;">Log Production</button>
      </div>
    </div>
  `;

  // Set total directly
  html += `
    <div class="settings-section">
      <h3>Set Total Directly</h3>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
        <div class="form-group" style="margin-bottom:0;">
          <label>Total Produced</label>
          <input type="number" id="prod-set-total" placeholder="${achieveData ? achieveData.totalProduced : 0}" min="0" />
        </div>
        <button class="btn-secondary" data-action="set-total-produced">Update Total</button>
      </div>
    </div>
  `;

  // Production runs list
  const allRuns = production.getRuns();
  if (allRuns.length) {
    html += `<div class="settings-section"><h3>Recent Production Runs</h3>`;
    html += allRuns.slice(0, 50).map(r => {
      const prod = r.productId ? products.getProductById(r.productId) : null;
      const date = new Date(r.createdAt).toLocaleDateString();
      return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
        <span style="min-width:80px;color:var(--text-muted);font-size:0.78rem;">${date}</span>
        <span style="flex:1;color:var(--text);">${prod ? escHtml(prod.name) : 'General'}</span>
        <span style="color:var(--success);min-width:50px;text-align:right;">+${r.quantity}</span>
        ${r.note ? `<span style="color:var(--text-muted);font-size:0.78rem;">${escHtml(r.note)}</span>` : ''}
        <button class="btn-delete" data-action="delete-production" data-id="${r.id}" title="Remove">x</button>
      </div>`;
    }).join('');
    html += '</div>';
  }

  el.innerHTML = html;
}

// ── Orders Page ──────────────────────────────────────

function renderOrdersPage() {
  const el = document.getElementById('page-orders');
  if (!el) return;
  const allOrders = orders.getAllOrders();
  const allSuppliers = suppliers.getAllSuppliers();
  const allMats = materials.getAllMaterials();

  // Check for auto-order opportunities
  const reorderNeeded = detectReorderNeeded();

  const filteredOrders = orderSearch
    ? allOrders.filter(o => {
        const q = orderSearch.toLowerCase();
        const supplier = allSuppliers.find(s => s.id === o.supplierId);
        return (o.poNumber && o.poNumber.toLowerCase().includes(q))
          || (supplier && supplier.name.toLowerCase().includes(q))
          || (o.status && o.status.toLowerCase().includes(q));
      })
    : allOrders;

  let html = `
    <div class="toolbar">
      <div class="toolbar-left">
        <input class="search-input" id="order-search" type="text" placeholder="Search orders..." value="${escHtml(orderSearch)}" />
        <span style="color:var(--text-muted);font-size:0.85rem;">${filteredOrders.length} order${filteredOrders.length !== 1 ? 's' : ''}</span>
      </div>
      <div style="display:flex;gap:8px;">
        ${reorderNeeded.length ? `<button class="btn-secondary" data-action="auto-generate-pos" style="color:var(--warning);border-color:var(--warning);">${reorderNeeded.length} items need reorder</button>` : ''}
        <button class="btn-primary" data-action="create-order">+ New Order</button>
      </div>
    </div>
  `;

  if (!filteredOrders.length && !reorderNeeded.length) {
    html += `<div class="empty"><div class="empty-icon">--</div><p>${orderSearch ? 'No orders match your search.' : 'No purchase orders yet. Orders are created when materials need restocking.'}</p></div>`;
  } else {
    html += '<div class="grid">';
    for (const o of filteredOrders) {
      const supplier = allSuppliers.find(s => s.id === o.supplierId);
      const badge = orders.getOrderStatusBadge(o.status);
      const date = new Date(o.createdAt).toLocaleDateString();

      html += `
        <div class="card ${o.status === 'received' ? 'in-stock' : o.status === 'cancelled' ? 'low-stock' : 'in-production'}" data-order-id="${o.id}">
          <div class="card-header">
            <div>
              <div class="candle-name">${escHtml(o.poNumber)}</div>
              <div class="candle-note">${supplier ? escHtml(supplier.name) : 'Unknown'} · ${date}</div>
            </div>
            <span class="badge ${badge.cls}">${badge.label}</span>
          </div>
          <div style="margin-bottom:14px;">
            <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:6px;">${o.lineItems.length} item${o.lineItems.length !== 1 ? 's' : ''}</div>
            ${o.lineItems.slice(0, 3).map(li => {
              const mat = allMats.find(m => m.id === li.materialId);
              return `<div style="font-size:0.82rem;padding:2px 0;color:var(--text);">${mat ? escHtml(mat.name) : 'Item'}: ${li.quantity} ${mat?.unit || ''}</div>`;
            }).join('')}
            ${o.lineItems.length > 3 ? `<div style="font-size:0.78rem;color:var(--text-muted);">+${o.lineItems.length - 3} more</div>` : ''}
          </div>
          <div style="font-size:1.1rem;color:var(--accent);margin-bottom:12px;">$${o.totalCost.toFixed(2)}</div>
          <div class="card-footer">
            <div class="card-actions">
              ${o.status === 'draft' ? `<button class="toggle-btn" data-action="send-order" data-id="${o.id}">Send</button>` : ''}
              ${o.status === 'sent' ? `<button class="toggle-btn" data-action="receive-order" data-id="${o.id}">Receive</button>` : ''}
              ${['draft', 'pending-approval'].includes(o.status) ? `<button class="toggle-btn" data-action="cancel-order" data-id="${o.id}">Cancel</button>` : ''}
            </div>
            ${['draft', 'cancelled'].includes(o.status) ? `<button class="btn-delete" data-action="delete-order" data-id="${o.id}" title="Delete">x</button>` : ''}
          </div>
        </div>`;
    }
    html += '</div>';
  }

  el.innerHTML = html;

  const ordSearchEl = document.getElementById('order-search');
  if (ordSearchEl) {
    ordSearchEl.oninput = e => {
      orderSearch = e.target.value.trim();
      renderOrdersPage();
    };
  }
}

// ── Waste Page ───────────────────────────────────────

function renderWastePage() {
  const el = document.getElementById('page-waste');
  if (!el) return;
  const allWaste = waste.getAllWaste();
  const stats = waste.getWasteStats();
  const allProds = products.getAllProducts();
  const allMats = materials.getAllMaterials();

  let html = `
    <div class="toolbar">
      <div class="toolbar-left">
        <h3 style="margin:0;font-size:1.1rem;">Waste Tracking</h3>
      </div>
      <button class="btn-primary" data-action="log-waste">+ Log Waste</button>
    </div>

    <div class="cost-summary-row">
      <div class="cost-summary-card">
        <div class="cost-summary-value">${stats.count}</div>
        <div class="cost-summary-label">Waste Entries</div>
      </div>
      <div class="cost-summary-card">
        <div class="cost-summary-value">${stats.totalQty}</div>
        <div class="cost-summary-label">Units Lost</div>
      </div>
      <div class="cost-summary-card profit-negative">
        <div class="cost-summary-value">$${stats.totalCost.toFixed(2)}</div>
        <div class="cost-summary-label">Total Impact</div>
      </div>
    </div>
  `;

  // Waste by reason summary
  if (Object.keys(stats.byReason).length) {
    html += `<div class="settings-section" style="margin-bottom:18px;"><h3>Waste by Reason</h3>`;
    const reasons = Object.entries(stats.byReason).sort((a, b) => b[1] - a[1]);
    const maxQty = Math.max(...reasons.map(r => r[1]));
    for (const [reason, qty] of reasons) {
      const pct = maxQty > 0 ? (qty / maxQty) * 100 : 0;
      html += `<div style="display:flex;align-items:center;gap:12px;padding:6px 0;font-size:0.85rem;">
        <span style="min-width:100px;text-transform:capitalize;color:var(--text);">${reason}</span>
        <div style="flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:var(--danger);border-radius:4px;"></div>
        </div>
        <span style="min-width:50px;text-align:right;color:var(--danger);">${qty}</span>
      </div>`;
    }
    html += '</div>';
  }

  // Waste entries list
  if (allWaste.length) {
    html += `<div class="settings-section"><h3>Recent Waste Entries</h3>`;
    html += allWaste.slice(0, 50).map(w => {
      const item = w.itemType === 'product'
        ? allProds.find(p => p.id === w.itemId)
        : allMats.find(m => m.id === w.itemId);
      const date = new Date(w.createdAt).toLocaleDateString();
      return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
        <span style="min-width:80px;color:var(--text-muted);font-size:0.78rem;">${date}</span>
        <span style="flex:1;color:var(--text);">${item ? escHtml(item.name) : 'Unknown'}</span>
        <span style="color:var(--danger);min-width:50px;text-align:right;">-${w.quantity}</span>
        <span style="min-width:80px;text-transform:capitalize;color:var(--text-muted);font-size:0.78rem;">${w.reason}</span>
        ${w.note ? `<span style="color:var(--text-muted);font-size:0.78rem;">${escHtml(w.note)}</span>` : ''}
        <button class="toggle-btn" data-action="edit-waste" data-id="${w.id}" style="font-size:0.75rem;padding:2px 8px;">Edit</button>
        <button class="btn-delete" data-action="delete-waste" data-id="${w.id}" title="Remove">x</button>
      </div>`;
    }).join('');
    html += '</div>';
  } else {
    html += `<div class="empty"><div class="empty-icon">--</div><p>No waste logged yet. Use this to track damaged, expired, lost, or defective items.</p></div>`;
  }

  el.innerHTML = html;
}

function renderSettingsPage() {
  const profile = config.getProfile();
  if (!profile) return;
  const el = document.getElementById('settings-content');
  if (!el) return;

  const theme = profile.theme || {};

  el.innerHTML = `
    <div class="settings-section">
      <h3>Help & Support</h3>
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <a href="#help" class="btn-secondary" style="text-decoration:none;">Help Docs & FAQ</a>
        <a href="mailto:support@clearcostinventory.com" class="btn-secondary" style="text-decoration:none;">Email Support</a>
      </div>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:14px;">Have a question or issue? Send us a message below and we'll get back to you.</p>
      <div class="login-form-group">
        <label>Subject</label>
        <input type="text" id="support-subject" placeholder="What do you need help with?" />
      </div>
      <div class="login-form-group">
        <label>Message</label>
        <textarea id="support-message" rows="4" placeholder="Describe your issue or question..." style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:0.9rem;resize:vertical;"></textarea>
      </div>
      <button class="btn-primary" data-action="send-support">Send Message</button>
    </div>

    <div class="settings-section">
      <h3>System Status</h3>
      <div class="status-grid">
        <div class="status-item status-ok">Database Connected</div>
        <div class="status-item status-ok">Authentication Active</div>
        <div class="status-item" id="status-stripe">Checking Stripe...</div>
        <div class="status-item" id="status-plaid">Checking Plaid...</div>
        <div class="status-item" id="status-qb">Checking QuickBooks...</div>
        <div class="status-item" id="status-domain">Checking Domain...</div>
      </div>
    </div>

    <div class="settings-section">
      <h3>Business Profile</h3>
      <div class="form-group">
        <label>Business Name</label>
        <input type="text" id="set-biz-name" value="${escHtml(profile.name)}" />
      </div>
      <div class="form-group">
        <label>${config.label('Product')} Label (singular)</label>
        <input type="text" id="set-prod-label" value="${escHtml(profile.productLabel)}" />
      </div>
      <div class="form-group">
        <label>${config.label('Products')} Label (plural)</label>
        <input type="text" id="set-prod-label-plural" value="${escHtml(profile.productLabelPlural)}" />
      </div>
      <div class="form-group">
        <label>Logo</label>
        <input type="file" id="set-logo" accept="image/*" />
      </div>
      <div class="form-group">
        <label>Favicon</label>
        <input type="file" id="set-favicon" accept="image/png,image/x-icon,image/svg+xml" />
      </div>
      <button class="btn-primary" id="btn-save-profile">Save Profile</button>
    </div>

    <div class="settings-section">
      <h3>Shipping Address</h3>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px;">Used for calculating shipping rates and creating labels.</p>
      <div class="form-group">
        <label>Street</label>
        <input type="text" id="set-ship-street" value="${escHtml(profile.shipFromAddress?.street1 || '')}" placeholder="123 Main St" />
      </div>
      <div style="display:flex;gap:10px;">
        <div class="form-group" style="flex:2">
          <label>City</label>
          <input type="text" id="set-ship-city" value="${escHtml(profile.shipFromAddress?.city || '')}" placeholder="Tulsa" />
        </div>
        <div class="form-group" style="flex:1">
          <label>State</label>
          <input type="text" id="set-ship-state" value="${escHtml(profile.shipFromAddress?.state || '')}" placeholder="OK" maxlength="2" />
        </div>
        <div class="form-group" style="flex:1">
          <label>ZIP</label>
          <input type="text" id="set-ship-zip" value="${escHtml(profile.shipFromAddress?.zip || '')}" placeholder="74103" />
        </div>
      </div>
      <button class="btn-primary" id="btn-save-shipping">Save Shipping Address</button>
    </div>

    <div class="settings-section">
      <h3>Theme & Branding</h3>
      <div class="toggle-row">
        <input type="checkbox" class="sw-toggle" id="set-dark-mode" ${theme.mode !== 'light' ? 'checked' : ''} />
        <label for="set-dark-mode">Dark Mode</label>
      </div>
      <div class="color-row"><label>Accent Color</label><input type="color" id="set-color-accent" value="${theme.accent || '#c8a06a'}" /></div>
      <div class="color-row"><label>Background</label><input type="color" id="set-color-bg" value="${theme.bg || '#0f0d0b'}" /></div>
      <div class="color-row"><label>Surface</label><input type="color" id="set-color-surface" value="${theme.surface || '#1a1714'}" /></div>
      <div class="color-row"><label>Border</label><input type="color" id="set-color-border" value="${theme.border || '#38383e'}" /></div>
      <div class="color-row"><label>Text</label><input type="color" id="set-color-text" value="${theme.text || '#e8e8f0'}" /></div>
      <div class="color-row"><label>Muted Text</label><input type="color" id="set-color-muted" value="${theme.textMuted || '#8a8a9a'}" /></div>
      <div class="color-row"><label>Danger</label><input type="color" id="set-color-danger" value="${theme.danger || '#e07070'}" /></div>
      <div class="color-row"><label>Warning</label><input type="color" id="set-color-warning" value="${theme.warning || '#e0b060'}" /></div>
      <div class="color-row"><label>Success</label><input type="color" id="set-color-success" value="${theme.success || '#7ec89a'}" /></div>
      <div style="margin-top:12px;">
        <button class="btn-primary" id="btn-save-theme">Save Theme</button>
        <button class="btn-secondary" id="btn-reset-theme" style="margin-left:8px;">Reset to Preset</button>
      </div>
    </div>

    <div class="settings-section">
      <h3>Low Stock Thresholds</h3>
      <div class="threshold-row">
        <span class="threshold-label">Global ${config.label('Product')} Threshold</span>
        <input class="threshold-input" type="number" min="1" id="set-product-threshold" value="${profile.globalThresholds?.productLow ?? 10}" />
        <span class="threshold-unit">units</span>
      </div>
      <div class="threshold-row">
        <span class="threshold-label">Global Material Threshold</span>
        <input class="threshold-input" type="number" min="1" id="set-material-threshold" value="${profile.globalThresholds?.materialLow ?? 50}" />
        <span class="threshold-unit">units</span>
      </div>
      <button class="btn-primary" id="btn-save-thresholds" style="margin-top:12px;">Save Thresholds</button>
    </div>

    <div id="billing-section-container"></div>

    ${hasPermission('owner') ? `
    <div class="settings-section">
      <h3>Team Members</h3>
      <div id="team-section-container">Loading...</div>
    </div>
    ` : ''}

    <div id="ecommerce-section-container"></div>

    <div id="qb-section-container"></div>

    <div class="settings-section">
      <h3>App Tour</h3>
      <p style="color:var(--text-muted);margin-bottom:12px;">Revisit the guided tour to learn about all the features ClearCost offers.</p>
      <button class="btn-secondary" data-action="start-tutorial">Take a Tour</button>
    </div>

    <div class="settings-section">
      <h3>Developer API</h3>
      <p style="color:var(--text-muted);margin-bottom:12px;">Integrate ClearCost with your own tools using the REST API.</p>
      <a href="/api-docs.html" target="_blank" class="btn-secondary" style="display:inline-block;text-decoration:none;">View API Documentation</a>
    </div>

    <div class="settings-section">
      <h3>Data Management</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-secondary" id="btn-export-data">Export All Data (JSON)</button>
        <button class="btn-secondary" id="btn-import-data">Import Data</button>
        <input type="file" id="import-file" accept=".json" style="display:none" />
      </div>
    </div>
  `;

  // Load billing section
  loadBillingSection();

  // Load team section
  if (hasPermission('owner')) loadTeamSection();

  // Load Sales Channels (Etsy/Shopify) section
  loadEcommerceSection();

  // Load QuickBooks status and render section
  loadQBSection();

  // Live theme preview on color change
  el.querySelectorAll('input[type="color"]').forEach(input => {
    input.addEventListener('input', () => previewTheme());
  });
  const darkToggle = document.getElementById('set-dark-mode');
  if (darkToggle) darkToggle.addEventListener('change', () => previewTheme());

  // Save profile
  document.getElementById('btn-save-profile')?.addEventListener('click', saveProfileSettings);
  document.getElementById('btn-save-shipping')?.addEventListener('click', async () => {
    const addr = {
      street1: document.getElementById('set-ship-street')?.value.trim() || '',
      city: document.getElementById('set-ship-city')?.value.trim() || '',
      state: document.getElementById('set-ship-state')?.value.trim().toUpperCase() || '',
      zip: document.getElementById('set-ship-zip')?.value.trim() || '',
      country: 'US',
    };
    if (!addr.street1 || !addr.city || !addr.zip) {
      toast('Please fill in street, city, and ZIP', 'warning');
      return;
    }
    try {
      await apiUpdateProfile({ ship_from_address: addr });
      await config.saveProfile({ shipFromAddress: addr });
      toast('Shipping address saved', 'success');
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  });
  document.getElementById('btn-save-theme')?.addEventListener('click', saveThemeSettings);
  document.getElementById('btn-reset-theme')?.addEventListener('click', resetTheme);
  document.getElementById('btn-save-thresholds')?.addEventListener('click', saveThresholds);
  document.getElementById('btn-export-data')?.addEventListener('click', exportData);
  document.getElementById('btn-import-data')?.addEventListener('click', () => document.getElementById('import-file')?.click());
  document.getElementById('import-file')?.addEventListener('change', importData);

  // Async system status checks
  checkSystemStatus();
}

async function checkSystemStatus() {
  // Stripe
  const stripeEl = document.getElementById('status-stripe');
  if (stripeEl) {
    try {
      const res = await fetch('/api/stripe?action=status');
      if (res.ok) { stripeEl.className = 'status-item status-ok'; stripeEl.textContent = 'Stripe Connected'; }
      else { stripeEl.className = 'status-item status-warn'; stripeEl.textContent = 'Stripe Not Configured'; }
    } catch { stripeEl.className = 'status-item status-warn'; stripeEl.textContent = 'Stripe Not Configured'; }
  }

  // Plaid
  const plaidEl = document.getElementById('status-plaid');
  if (plaidEl) {
    try {
      const res = await fetch('/api/plaid?action=status');
      const data = await res.json();
      if (data.env === 'production') { plaidEl.className = 'status-item status-ok'; plaidEl.textContent = 'Plaid (Production)'; }
      else if (data.env) { plaidEl.className = 'status-item status-warn'; plaidEl.textContent = `Plaid (${data.env})`; }
      else { plaidEl.className = 'status-item status-warn'; plaidEl.textContent = 'Plaid Not Configured'; }
    } catch { plaidEl.className = 'status-item status-warn'; plaidEl.textContent = 'Plaid Not Configured'; }
  }

  // QuickBooks
  const qbEl = document.getElementById('status-qb');
  if (qbEl) {
    try {
      const status = await getQBStatus();
      if (status?.connected) { qbEl.className = 'status-item status-ok'; qbEl.textContent = 'QuickBooks Connected'; }
      else { qbEl.className = 'status-item status-warn'; qbEl.textContent = 'QuickBooks Not Connected'; }
    } catch { qbEl.className = 'status-item status-warn'; qbEl.textContent = 'QuickBooks Not Connected'; }
  }

  // Domain
  const domainEl = document.getElementById('status-domain');
  if (domainEl) {
    const host = window.location.hostname;
    if (host === 'clearcostinventory.com' || (host !== 'localhost' && !host.endsWith('.vercel.app'))) {
      domainEl.className = 'status-item status-ok'; domainEl.textContent = `Custom Domain (${host})`;
    } else if (host === 'localhost') {
      domainEl.className = 'status-item status-warn'; domainEl.textContent = 'Local Development';
    } else {
      domainEl.className = 'status-item status-warn'; domainEl.textContent = 'Using Default Vercel Domain';
    }
  }
}

function previewTheme() {
  const theme = {
    accent: document.getElementById('set-color-accent')?.value,
    accentDim: adjustColor(document.getElementById('set-color-accent')?.value, -40),
    bg: document.getElementById('set-color-bg')?.value,
    surface: document.getElementById('set-color-surface')?.value,
    surface2: adjustColor(document.getElementById('set-color-surface')?.value, 10),
    border: document.getElementById('set-color-border')?.value,
    text: document.getElementById('set-color-text')?.value,
    textMuted: document.getElementById('set-color-muted')?.value,
    danger: document.getElementById('set-color-danger')?.value,
    warning: document.getElementById('set-color-warning')?.value,
    success: document.getElementById('set-color-success')?.value,
    mode: document.getElementById('set-dark-mode')?.checked ? 'dark' : 'light',
  };
  config.applyTheme(theme);
}

function adjustColor(hex, amount) {
  if (!hex) return '#000000';
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

async function saveProfileSettings() {
  const updates = {
    name: document.getElementById('set-biz-name')?.value.trim() || 'My Business',
    productLabel: document.getElementById('set-prod-label')?.value.trim() || 'Product',
    productLabelPlural: document.getElementById('set-prod-label-plural')?.value.trim() || 'Products',
  };

  const logoFile = document.getElementById('set-logo')?.files?.[0];
  if (logoFile) updates.logo = logoFile;

  const faviconFile = document.getElementById('set-favicon')?.files?.[0];
  if (faviconFile) updates.favicon = faviconFile;

  await config.saveProfile(updates);
  // Sync to cloud
  try { await apiUpdateProfile({ name: updates.name, product_label: updates.productLabel, product_label_plural: updates.productLabelPlural }); } catch(e) { console.warn('Cloud sync failed:', e); }
  renderHeader();
  config.applyFavicon();
  toast('Profile saved', 'success');
}

async function saveThemeSettings() {
  const theme = {
    accent: document.getElementById('set-color-accent')?.value,
    accentDim: adjustColor(document.getElementById('set-color-accent')?.value, -40),
    bg: document.getElementById('set-color-bg')?.value,
    surface: document.getElementById('set-color-surface')?.value,
    surface2: adjustColor(document.getElementById('set-color-surface')?.value, 10),
    border: document.getElementById('set-color-border')?.value,
    text: document.getElementById('set-color-text')?.value,
    textMuted: document.getElementById('set-color-muted')?.value,
    danger: document.getElementById('set-color-danger')?.value,
    warning: document.getElementById('set-color-warning')?.value,
    success: document.getElementById('set-color-success')?.value,
    mode: document.getElementById('set-dark-mode')?.checked ? 'dark' : 'light',
  };
  await config.saveProfile({ theme });
  // Sync theme to cloud
  try { await apiUpdateProfile({ theme }); } catch(e) { console.warn('Cloud theme sync failed:', e); }
  toast('Theme saved', 'success');
}

async function resetTheme() {
  const profile = config.getProfile();
  const preset = config.PRESETS[profile?.type] || config.PRESETS.general;
  await config.saveProfile({ theme: { ...preset.theme } });
  renderSettingsPage();
  toast('Theme reset to preset', 'info');
}

async function saveThresholds() {
  const productLow = parseInt(document.getElementById('set-product-threshold')?.value) || 10;
  const materialLow = parseInt(document.getElementById('set-material-threshold')?.value) || 50;
  await config.saveProfile({ globalThresholds: { productLow, materialLow } });
  try { await apiUpdateProfile({ global_thresholds: { productLow, materialLow } }); } catch(e) { console.warn('Cloud threshold sync failed:', e); }
  renderAll();
  toast('Thresholds saved', 'success');
}

async function exportData() {
  const data = await db.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `inventory-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Data exported', 'success');
}

async function importData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await db.importAll(data);
    await config.loadProfile();
    await Promise.all([
      products.loadProducts(),
      materials.loadMaterials(),
      history.loadHistory(),
      production.loadProduction(),
      recipes.loadRecipes(),
      suppliers.loadSuppliers(),
      orders.loadOrders(),
      batches.loadBatches(),
      waste.loadWaste(),
      locations.loadLocations(),
      expenses.loadExpenses(),
      transactions.loadTransactions(),
      customers.loadCustomers(),
      sales.loadSales(),
    ]);
    renderAll();
    toast('Data imported successfully', 'success');
  } catch (err) {
    toast(friendlyError(err), 'error');
  }
  e.target.value = '';
}

// ── Setup Wizard ─────────────────────────────────────

function showSetupWizard() {
  const presetKeys = Object.keys(config.PRESETS);
  const presetEmojis = { candles: '🕯️', bakery: '🍞', retail: '🏪', crafts: '🎨', general: '📦' };

  const overlay = document.createElement('div');
  overlay.className = 'wizard-overlay';
  overlay.innerHTML = `
    <div class="wizard">
      <h1>Welcome</h1>
      <p>Set up your inventory manager in seconds.</p>
      <div class="form-group" style="text-align:left;">
        <label>Business Name</label>
        <input type="text" id="wizard-name" placeholder="e.g. My Business" />
      </div>
      <div style="text-align:left;margin-bottom:8px;">
        <label style="font-size:0.75rem;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;">Business Type</label>
      </div>
      <div class="preset-grid">
        ${presetKeys.map((k, i) => `
          <div class="preset-card ${i === 0 ? 'selected' : ''}" data-preset="${k}">
            <div class="preset-emoji">${presetEmojis[k] || '📦'}</div>
            <div class="preset-name">${k.charAt(0).toUpperCase() + k.slice(1)}</div>
          </div>
        `).join('')}
      </div>
      <button class="btn-primary" id="wizard-go" style="width:100%;padding:14px;font-size:1rem;">Get Started</button>
    </div>
  `;

  document.body.appendChild(overlay);

  let selectedPreset = presetKeys[0];
  overlay.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', () => {
      overlay.querySelectorAll('.preset-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedPreset = card.dataset.preset;
    });
  });

  document.getElementById('wizard-go').addEventListener('click', async () => {
    const name = document.getElementById('wizard-name').value.trim();
    if (!name) {
      document.getElementById('wizard-name').focus();
      return;
    }
    await config.initFromPreset(selectedPreset, name);
    overlay.remove();

    await Promise.all([
      products.loadProducts(),
      materials.loadMaterials(),
      history.loadHistory(),
      production.loadProduction(),
      recipes.loadRecipes(),
    ]);

    onNavigate(handlePageChange);
    initRouter();
    renderAll();
    setupEventListeners();
    toast(`Welcome to ${name}!`, 'success');
  });

  setTimeout(() => document.getElementById('wizard-name')?.focus(), 100);
}

// ── Bulk Selection Helper ────────────────────────────

function updateBulkBar(type) {
  const barId = type === 'product' ? 'bulk-bar-products' : 'bulk-bar-materials';
  const bar = document.getElementById(barId);
  if (!bar) return;
  const checked = document.querySelectorAll(`.bulk-check[data-type="${type}"]:checked`);
  if (checked.length > 0) {
    bar.style.display = 'flex';
    bar.querySelector('.bulk-count').textContent = `${checked.length} selected`;
  } else {
    bar.style.display = 'none';
  }
}

// ── Event Listeners ──────────────────────────────────

function setupEventListeners() {
  // Install app button
  document.getElementById('btn-install-app')?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') toast('App installed!', 'success');
      deferredPrompt = null;
      document.getElementById('btn-install-app').style.display = 'none';
    }
  });

  // Logout button
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut();
    location.reload();
  });

  // Sidebar toggle (mobile)
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebarOverlay?.classList.toggle('open');
    });
    sidebarOverlay?.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('open');
    });
  }

  // Delegated click handlers on main
  document.querySelector('main')?.addEventListener('click', handleMainClick);
  document.querySelector('main')?.addEventListener('change', handleMainChange);

  // Bulk checkbox handler
  document.querySelector('main')?.addEventListener('change', e => {
    if (e.target.classList.contains('bulk-check')) {
      updateBulkBar(e.target.dataset.type);
    }
  });

  // Product filter buttons
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      productFilter = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === productFilter));
      renderInventoryPage();
    });
  });

  // History filter buttons
  document.querySelectorAll('[data-hfilter]').forEach(btn => {
    btn.addEventListener('click', () => {
      historyFilter = btn.dataset.hfilter;
      document.querySelectorAll('[data-hfilter]').forEach(b => b.classList.toggle('active', b.dataset.hfilter === historyFilter));
      renderHistoryPage();
    });
  });

  // Search inputs
  document.getElementById('search-input')?.addEventListener('input', e => {
    productSearch = e.target.value.trim();
    renderInventoryPage();
  });
  document.getElementById('mat-search')?.addEventListener('input', e => {
    materialSearch = e.target.value.trim();
    renderMaterialsPage();
  });

  // Escape to close modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });
}

// ── Delegated Actions ────────────────────────────────

async function handleMainClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = parseInt(btn.dataset.id);

  switch (action) {
    case 'restock-product':
      showRestockProductModal(id);
      break;

    case 'toggle-needs': {
      const item = products.getProductById(id);
      if (!item) return;
      await products.updateProduct(id, { needsMade: !item.needsMade, inProduction: false });
      renderInventoryPage();
      renderHeader();
      renderAlerts();
      break;
    }

    case 'toggle-production': {
      const item = products.getProductById(id);
      if (!item) return;
      await products.updateProduct(id, { inProduction: !item.inProduction, needsMade: false });
      renderInventoryPage();
      renderHeader();
      renderAlerts();
      break;
    }

    case 'edit-note':
      showEditNoteModal(id);
      break;

    case 'delete-product': {
      const item = products.getProductById(id);
      if (!item) return;
      if (!await showConfirmModal({ title: 'Remove Item', message: `Remove "${item.name}" from inventory?`, confirmLabel: 'Remove', danger: true })) return;
      // Clean up references: nullify recipe productId links
      const linkedRecipes = recipes.getAllRecipes().filter(r => r.productId === id);
      for (const r of linkedRecipes) {
        await recipes.updateRecipe(r.id, { productId: null });
      }
      await products.deleteProduct(id);
      renderInventoryPage();
      renderHeader();
      renderAlerts();
      toast(`${item.name} removed`, 'info');
      break;
    }

    case 'bulk-delete-products': {
      const checked = document.querySelectorAll('.bulk-check[data-type="product"]:checked');
      if (!checked.length) break;
      if (!await showConfirmModal({ title: 'Delete Selected', message: `Remove ${checked.length} product${checked.length > 1 ? 's' : ''} from inventory?`, confirmLabel: 'Delete All', danger: true })) break;
      for (const cb of checked) {
        const pid = parseInt(cb.dataset.id);
        const linkedRecipes = recipes.getAllRecipes().filter(r => r.productId === pid);
        for (const r of linkedRecipes) await recipes.updateRecipe(r.id, { productId: null });
        await products.deleteProduct(pid);
      }
      renderInventoryPage();
      renderHeader();
      renderAlerts();
      toast(`${checked.length} product${checked.length > 1 ? 's' : ''} removed`, 'info');
      break;
    }

    case 'bulk-delete-materials': {
      const checked = document.querySelectorAll('.bulk-check[data-type="material"]:checked');
      if (!checked.length) break;
      if (!await showConfirmModal({ title: 'Delete Selected', message: `Remove ${checked.length} material${checked.length > 1 ? 's' : ''} from inventory?`, confirmLabel: 'Delete All', danger: true })) break;
      for (const cb of checked) {
        await materials.deleteMaterial(parseInt(cb.dataset.id));
      }
      renderMaterialsPage();
      renderHeader();
      renderAlerts();
      toast(`${checked.length} material${checked.length > 1 ? 's' : ''} removed`, 'info');
      break;
    }

    case 'restock-material':
      showRestockMaterialModal(id);
      break;

    case 'add-product': {
      const tier = getSubscriptionTier();
      if ((tier === 'free' || tier === 'starter') && products.getAllProducts().length >= 100) {
        toast('Starter plan limited to 100 products. Upgrade to Pro for unlimited.', 'warning');
        break;
      }
      showAddProductModal();
      break;
    }

    case 'add-material': {
      const tier = getSubscriptionTier();
      if ((tier === 'free' || tier === 'starter') && materials.getAllMaterials().length >= 200) {
        toast('Starter plan limited to 200 materials. Upgrade to Pro for unlimited.', 'warning');
        break;
      }
      showAddMaterialModal();
      break;
    }

    case 'scan-barcode': {
      const target = btn.dataset.target || 'product';
      showBarcodeScanner(target);
      break;
    }

    case 'add-supplier':
      showAddSupplierModal();
      break;

    case 'edit-supplier':
      showEditSupplierModal(id);
      break;

    case 'delete-supplier': {
      const sup = suppliers.getSupplierById(id);
      if (!sup) return;
      if (!await showConfirmModal({ title: 'Remove Supplier', message: `Remove supplier "${sup.name}"?`, confirmLabel: 'Remove', danger: true })) return;
      // Clean up references: nullify supplierId on materials
      const linkedMats = materials.getAllMaterials().filter(m => m.supplierId === id);
      for (const m of linkedMats) {
        await materials.updateMaterial(m.id, { supplierId: null });
      }
      await suppliers.deleteSupplier(id);
      renderSuppliersPage();
      toast(`${sup.name} removed`, 'info');
      break;
    }

    case 'add-recipe':
      showAddRecipeModal();
      break;

    case 'edit-recipe':
      showEditRecipeModal(id);
      break;

    case 'delete-recipe': {
      const recipe = recipes.getRecipeById(id);
      if (!recipe) return;
      if (!await showConfirmModal({ title: 'Remove Recipe', message: `Remove recipe "${recipe.name}"?`, confirmLabel: 'Remove', danger: true })) return;
      await recipes.deleteRecipe(id);
      renderRecipesPage();
      toast(`${recipe.name} removed`, 'info');
      break;
    }

    case 'produce-from-recipe':
      showProduceFromRecipeModal(id);
      break;

    case 'log-production': {
      const qty = parseInt(document.getElementById('prod-qty')?.value) || 0;
      const note = document.getElementById('prod-note')?.value.trim() || '';
      const productId = parseInt(document.getElementById('prod-product')?.value) || null;
      if (qty <= 0) { document.getElementById('prod-qty')?.focus(); return; }

      // Log the production run
      await production.logRun({ quantity: qty, productId, note });

      // If a specific product is selected, add to its inventory
      if (productId) {
        const item = products.getProductById(productId);
        if (item) {
          await products.changeQuantity(productId, qty);
          // Deduct materials via recipe
          const recipe = recipes.getRecipeForProduct(productId);
          if (recipe) {
            await deductRecipeMaterials(recipe, qty);
          }
        }
      }

      await history.addEntry({
        itemType: 'production', itemId: productId,
        itemName: productId ? (products.getProductById(productId)?.name || 'Production') : 'Production Run',
        changeType: 'produced', quantityChange: qty,
        newQuantity: production.getTotalProduced(),
        note: note || 'Production logged',
      });

      document.getElementById('prod-qty').value = '';
      document.getElementById('prod-note').value = '';
      renderProductionPage();
      renderHeader();
      renderAlerts();
      toast(`${qty} units produced`, 'success');
      break;
    }

    case 'set-total-produced': {
      const val = parseInt(document.getElementById('prod-set-total')?.value);
      if (isNaN(val) || val < 0) return;
      await production.setTotalProduced(val);
      document.getElementById('prod-set-total').value = '';
      renderProductionPage();
      renderHeader();
      toast('Total updated', 'success');
      break;
    }

    case 'auto-generate-pos': {
      const needed = detectReorderNeeded();
      if (!needed.length) { toast('Nothing needs reorder', 'info'); return; }
      if (!await showConfirmModal({ title: 'Generate Purchase Orders', message: `Generate purchase orders for ${needed.length} items?`, confirmLabel: 'Generate' })) return;
      const created = await generatePurchaseOrders(needed);
      renderOrdersPage();
      toast(`${created.length} PO(s) created as drafts`, 'success');
      break;
    }

    case 'create-order': {
      const allSup = suppliers.getAllSuppliers();
      if (!allSup.length) { toast('Add a supplier first', 'warning'); return; }
      showFormModal({
        title: 'New Purchase Order',
        fields: [
          { id: 'po-supplier', label: 'Supplier', type: 'select', options: allSup.map(s => ({ value: String(s.id), label: s.name })) },
          { id: 'po-notes', label: 'Notes (optional)', type: 'text', placeholder: '' },
        ],
        submitLabel: 'Create Draft PO',
        async onSubmit(vals) {
          await orders.createOrder({ supplierId: parseInt(vals['po-supplier']), notes: vals['po-notes'], lineItems: [] });
          renderOrdersPage();
          toast('Draft PO created', 'success');
        },
      });
      break;
    }

    case 'send-order': {
      const order = orders.getOrderById(id);
      if (!order) return;
      if (!order.lineItems.length) { toast('Add items to the PO first', 'warning'); return; }
      await orders.markSent(id);
      renderOrdersPage();
      toast(`${order.poNumber} marked as sent`, 'success');
      break;
    }

    case 'receive-order': {
      const order = orders.getOrderById(id);
      if (!order) return;
      // Auto-receive all items at ordered quantity
      const updatedItems = order.lineItems.map(li => ({ ...li, receivedQty: li.quantity }));
      await orders.markReceived(id, updatedItems);
      // Auto-restock materials
      for (const li of updatedItems) {
        const result = await materials.changeQuantity(li.materialId, li.receivedQty);
        if (result) {
          await history.addEntry({
            itemType: 'material', itemId: li.materialId,
            itemName: result.item.name,
            changeType: 'restock', quantityChange: li.receivedQty,
            newQuantity: result.newQty,
            note: `Received via ${order.poNumber}`,
            metadata: { orderId: order.id },
          });
        }
      }
      renderOrdersPage();
      renderMaterialsPage();
      renderHeader();
      renderAlerts();
      toast(`${order.poNumber} received — materials restocked`, 'success');
      break;
    }

    case 'cancel-order': {
      const order = orders.getOrderById(id);
      if (!order) return;
      if (!await showConfirmModal({ title: 'Cancel Order', message: `Cancel ${order.poNumber}?`, confirmLabel: 'Cancel Order', danger: true })) return;
      await orders.cancelOrder(id);
      renderOrdersPage();
      toast(`${order.poNumber} cancelled`, 'info');
      break;
    }

    case 'delete-order': {
      const order = orders.getOrderById(id);
      if (!order) return;
      if (!await showConfirmModal({ title: 'Delete Order', message: `Delete ${order.poNumber}? This cannot be undone.`, confirmLabel: 'Delete', danger: true })) return;
      await orders.deleteOrder(id);
      renderOrdersPage();
      toast('Order deleted', 'info');
      break;
    }

    case 'log-waste':
      showLogWasteModal();
      break;

    case 'edit-waste':
      showEditWasteModal(id);
      break;

    case 'delete-waste': {
      const wasteEntry = waste.getAllWaste().find(w => w.id === id);
      if (!wasteEntry) return;
      if (!await showConfirmModal({ title: 'Remove Waste Entry', message: 'Remove this waste entry? This cannot be undone.', confirmLabel: 'Remove', danger: true })) return;
      await waste.deleteWasteEntry(id);
      renderWastePage();
      toast('Waste entry removed', 'info');
      break;
    }

    case 'delete-production': {
      const run = production.getRuns().find(r => r.id === id);
      if (!run) return;
      if (!await showConfirmModal({ title: 'Remove Production Run', message: `Remove production run of ${run.quantity} units? This will subtract from the total produced count.`, confirmLabel: 'Remove', danger: true })) return;
      await production.deleteRun(id);
      renderProductionPage();
      renderHeader();
      renderAlerts();
      toast('Production run removed', 'info');
      break;
    }

    case 'export-csv':
      exportCSV();
      break;

    case 'import-products-csv':
      showImportModal('products');
      break;

    case 'import-materials-csv':
      showImportModal('materials');
      break;

    case 'import-recipes-csv':
      showImportModal('recipes');
      break;

    case 'clear-history':
      if (!await showConfirmModal({ title: 'Clear History', message: 'Clear all history? This cannot be undone.', confirmLabel: 'Clear', danger: true })) return;
      await history.clearHistory();
      renderHistoryPage();
      toast('History cleared', 'info');
      break;

    // ── Expense Actions ──
    case 'add-expense':
      showAddExpenseModal();
      break;

    case 'edit-expense':
      showEditExpenseModal(id);
      break;

    case 'delete-expense': {
      const exp = expenses.getExpenseById(id);
      if (!exp) return;
      if (!await showConfirmModal({ title: 'Remove Expense', message: `Remove expense "${exp.name}"?`, confirmLabel: 'Remove', danger: true })) return;
      await expenses.deleteExpense(id);
      renderExpensesPage();
      toast(`${exp.name} removed`, 'info');
      break;
    }

    // ── Cost Analysis Actions ──
    case 'show-product-breakdown':
      renderProductDetailBreakdown(id);
      break;

    case 'close-product-breakdown': {
      const detailEl = document.getElementById('product-detail-breakdown');
      if (detailEl) detailEl.innerHTML = '';
      break;
    }

    // ── Transaction Actions ──
    case 'add-income':
      showAddTransactionModal('income');
      break;

    case 'add-expense-txn':
      showAddTransactionModal('expense');
      break;

    case 'edit-transaction':
      showEditTransactionModal(id);
      break;

    case 'delete-transaction': {
      const txn = transactions.getTransactionById(id);
      if (!txn) return;
      if (!await showConfirmModal({ title: 'Remove Transaction', message: `Remove transaction "${txn.description}"?`, confirmLabel: 'Remove', danger: true })) return;
      await transactions.deleteTransaction(id);
      renderTransactionsPage();
      toast('Transaction removed', 'info');
      break;
    }

    // ── Plaid Actions ──
    case 'plaid-connect': {
      if (getSubscriptionTier() === 'free') {
        toast('Upgrade to Pro to connect bank accounts.', 'warning');
        break;
      }
      try {
        toast('Opening bank connection...', 'info');
        const result = await openPlaidLink();
        if (result) {
          toast(`Connected to ${result.institution_name}`, 'success');
          await refreshPlaidAccounts();
          renderTransactionsPage();
        }
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;
    }

    case 'plaid-sync': {
      const itemId = btn.dataset.itemId;
      if (!itemId) break;
      try {
        setPlaidSyncing(true);
        renderTransactionsPage();
        toast('Syncing transactions...', 'info');
        const result = await syncTransactions(itemId);
        setPlaidSyncing(false);
        await refreshPlaidAccounts();
        renderTransactionsPage();
        toast(`Imported ${result.addedCount} new, ${result.modifiedCount} updated, ${result.removedCount} removed`, 'success');
      } catch (err) {
        setPlaidSyncing(false);
        renderTransactionsPage();
        toast(friendlyError(err), 'error');
      }
      break;
    }

    case 'plaid-sync-all': {
      try {
        setPlaidSyncing(true);
        renderTransactionsPage();
        toast('Syncing all accounts...', 'info');
        const result = await syncAllAccounts();
        setPlaidSyncing(false);
        await refreshPlaidAccounts();
        renderTransactionsPage();
        toast(`Imported ${result.addedCount} new, ${result.modifiedCount} updated, ${result.removedCount} removed`, 'success');
      } catch (err) {
        setPlaidSyncing(false);
        renderTransactionsPage();
        toast(friendlyError(err), 'error');
      }
      break;
    }

    case 'plaid-remove': {
      const itemId = btn.dataset.itemId;
      if (!itemId) break;
      if (!await showConfirmModal({ title: 'Unlink Account', message: 'Unlink this bank account? Imported transactions will remain.', confirmLabel: 'Unlink', danger: true })) break;
      try {
        await removeAccount(itemId);
        await refreshPlaidAccounts();
        renderTransactionsPage();
        toast('Account unlinked', 'info');
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;
    }

    // ── QuickBooks Actions ──
    // ── Billing Actions ──
    case 'subscribe': {
      const tier = btn.dataset.tier;
      if (!tier || tier === 'free') break;
      try {
        toast('Redirecting to checkout...', 'info');
        await createCheckoutSession(tier);
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;
    }

    case 'billing-portal': {
      try {
        toast('Opening billing portal...', 'info');
        await openBillingPortal();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;
    }

    case 'qb-connect': {
      const qbTier = getSubscriptionTier();
      if (qbTier !== 'business' && qbTier !== 'lifetime') {
        toast('Upgrade to Business to connect QuickBooks.', 'warning');
        break;
      }
      connectQuickBooks();
      break;
    }

    case 'qb-disconnect':
      if (!await showConfirmModal({ title: 'Disconnect QuickBooks', message: 'Disconnect from QuickBooks? Your local data will not be affected.', confirmLabel: 'Disconnect', danger: true })) break;
      try {
        await disconnectQuickBooks();
        toast('Disconnected from QuickBooks', 'info');
        await loadQBSection();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;

    case 'qb-sync-products':
      try {
        toast('Syncing products to QuickBooks...', 'info');
        const prodResult = await qbSyncProducts();
        toast(`Products: ${prodResult.created} created, ${prodResult.updated} updated${prodResult.errors.length ? `, ${prodResult.errors.length} errors` : ''}`, 'success');
        await loadQBSection();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;

    case 'qb-sync-suppliers':
      try {
        toast('Syncing suppliers to QuickBooks...', 'info');
        const supResult = await qbSyncSuppliers();
        toast(`Suppliers: ${supResult.created} created, ${supResult.updated} updated${supResult.errors.length ? `, ${supResult.errors.length} errors` : ''}`, 'success');
        await loadQBSection();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;

    case 'qb-sync-expenses':
      try {
        toast('Syncing expenses to QuickBooks...', 'info');
        const expResult = await qbSyncExpenses();
        toast(`Expenses: ${expResult.created} created${expResult.errors.length ? `, ${expResult.errors.length} errors` : ''}`, 'success');
        await loadQBSection();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;

    case 'qb-fetch-report':
      try {
        toast('Fetching P&L report...', 'info');
        _qbReport = await fetchPLReport();
        const container = document.getElementById('qb-section-container');
        if (container) container.innerHTML = renderQuickBooksSection(_qbStatus, _qbReport);
        toast('P&L report loaded', 'success');
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;

    // ── Ecommerce / Sales Channel Actions ──
    case 'etsy-connect':
      connectEtsy();
      break;

    case 'etsy-disconnect':
      if (!await showConfirmModal({ title: 'Disconnect Etsy', message: 'Disconnect from Etsy? Your imported orders will not be affected.', confirmLabel: 'Disconnect', danger: true })) break;
      try {
        await disconnectEtsy();
        toast('Disconnected from Etsy', 'info');
        await loadEcommerceSection();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;

    case 'etsy-sync':
      try {
        toast('Syncing Etsy orders...', 'info');
        const etsyResult = await syncEtsyOrders();
        toast(`Imported ${etsyResult.synced} order${etsyResult.synced !== 1 ? 's' : ''} from Etsy${etsyResult.sandbox ? ' (sandbox)' : ''}`, 'success');
        await loadEcommerceSection();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;

    case 'shopify-connect': {
      const domainInput = document.getElementById('shopify-domain-input');
      const domain = domainInput?.value?.trim() || '';
      try {
        toast('Connecting to Shopify...', 'info');
        const shopResult = await connectShopify(domain);
        if (shopResult?.connected) {
          toast(`Connected to Shopify${shopResult.sandbox ? ' (sandbox)' : ''}`, 'success');
          await loadEcommerceSection();
        }
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;
    }

    case 'shopify-disconnect':
      if (!await showConfirmModal({ title: 'Disconnect Shopify', message: 'Disconnect from Shopify? Your imported orders will not be affected.', confirmLabel: 'Disconnect', danger: true })) break;
      try {
        await disconnectShopify();
        toast('Disconnected from Shopify', 'info');
        await loadEcommerceSection();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;

    case 'shopify-sync':
      try {
        toast('Syncing Shopify orders...', 'info');
        const shopifyResult = await syncShopifyOrders();
        toast(`Imported ${shopifyResult.synced} order${shopifyResult.synced !== 1 ? 's' : ''} from Shopify${shopifyResult.sandbox ? ' (sandbox)' : ''}`, 'success');
        await loadEcommerceSection();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;

    case 'start-tutorial':
      startTutorial();
      break;

    case 'send-support': {
      const subject = document.getElementById('support-subject')?.value.trim();
      const message = document.getElementById('support-message')?.value.trim();
      if (!subject || !message) { toast('Please fill in both subject and message', 'warning'); break; }
      const bizName = config.getProfile()?.name || 'Unknown Business';
      const body = `Business: ${bizName}\n\n${message}`;
      window.location.href = `mailto:support@clearcostinventory.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      toast('Opening your email client...', 'info');
      break;
    }

    case 'simulate-etsy-order':
      try {
        toast('Simulating Etsy order webhook...', 'info');
        const simEtsy = await simulateEtsyWebhook();
        toast(`Webhook received${simEtsy.sandbox ? ' (sandbox)' : ''} - order auto-synced`, 'success');
        await loadEcommerceSection();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;

    case 'simulate-shopify-order':
      try {
        toast('Simulating Shopify order webhook...', 'info');
        const simShopify = await simulateShopifyWebhook();
        toast(`Webhook received${simShopify.sandbox ? ' (sandbox)' : ''} - order auto-synced`, 'success');
        await loadEcommerceSection();
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;

    // ── Shipping Actions ──
    case 'get-shipping-rates': {
      const shippingSale = sales.getSaleById(id);
      if (!shippingSale) break;
      const profile = config.getProfile();
      try {
        toast('Fetching shipping rates...', 'info');
        const shipFrom = profile?.shipFromAddress || {};
        const fromAddr = {
          name: profile?.name || 'Sender',
          street1: shipFrom.street1 || '',
          city: shipFrom.city || '',
          state: shipFrom.state || '',
          zip: shipFrom.zip || '',
          country: shipFrom.country || 'US',
        };
        if (!fromAddr.street1 || !fromAddr.city || !fromAddr.zip) {
          toast('Set your shipping address in Settings first', 'warning');
          break;
        }
        const toAddr = parseShippingAddress(shippingSale.shippingAddress);
        const ratesResult = await getShippingRates(fromAddr, toAddr, 16);
        _shippingRates = ratesResult.rates || [];
        _shippingShipmentId = ratesResult.shipment_id || null;
        _shippingForSaleId = id;
        _selectedShippingRate = null;
        renderSalesPage();
        toast(`Found ${_shippingRates.length} shipping rate${_shippingRates.length !== 1 ? 's' : ''}${ratesResult.mock ? ' (demo)' : ''}`, 'success');
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;
    }

    case 'select-shipping-rate': {
      _selectedShippingRate = btn.dataset.rateId || null;
      renderSalesPage();
      break;
    }

    case 'buy-shipping-label': {
      if (!_selectedShippingRate) {
        toast('Please select a shipping rate first', 'warning');
        break;
      }
      const labelSale = sales.getSaleById(_shippingForSaleId);
      if (!labelSale) break;
      const labelProfile = config.getProfile();
      try {
        toast('Creating shipping label...', 'info');
        const labelShipFrom = labelProfile?.shipFromAddress || {};
        const fromAddr = {
          name: labelProfile?.name || 'Sender',
          street1: labelShipFrom.street1 || '',
          city: labelShipFrom.city || '',
          state: labelShipFrom.state || '',
          zip: labelShipFrom.zip || '',
          country: labelShipFrom.country || 'US',
        };
        if (!fromAddr.street1 || !fromAddr.city || !fromAddr.zip) {
          toast('Set your shipping address in Settings first', 'warning');
          break;
        }
        const toAddr = parseShippingAddress(labelSale.shippingAddress);
        const labelResult = await createShippingLabel(_selectedShippingRate, _shippingShipmentId, fromAddr, toAddr);
        // Update the sale with tracking number
        if (labelResult.tracking_number) {
          await sales.updateSale(_shippingForSaleId, {
            trackingNumber: labelResult.tracking_number,
            shippingCost: parseFloat(labelResult.rate) || labelSale.shippingCost || 0,
            shippingCarrier: labelResult.carrier,
            shippingService: labelResult.service,
            labelUrl: labelResult.label_url,
          });
        }
        _shippingRates = [];
        _selectedShippingRate = null;
        _shippingShipmentId = null;
        renderSalesPage();
        toast(`Label created! Tracking: ${labelResult.tracking_number}${labelResult.mock ? ' (demo)' : ''}`, 'success');
      } catch (err) {
        toast(friendlyError(err), 'error');
      }
      break;
    }

    // ── Customer Actions ──
    case 'add-customer':
      showFormModal({
        title: 'Add Customer',
        fields: [
          { id: 'cust-name', label: 'Name', type: 'text', required: true, placeholder: 'Customer name' },
          { id: 'cust-email', label: 'Email', type: 'text', placeholder: 'email@example.com' },
          { id: 'cust-phone', label: 'Phone', type: 'text', placeholder: '(555) 123-4567' },
          { id: 'cust-company', label: 'Company', type: 'text', placeholder: 'Company name' },
          { id: 'cust-address', label: 'Address', type: 'text', placeholder: 'Street, City, State' },
          { id: 'cust-notes', label: 'Notes', type: 'text', placeholder: 'Optional notes' },
        ],
        submitLabel: 'Add Customer',
        async onSubmit(vals) {
          await customers.addCustomer({
            name: vals['cust-name'],
            email: vals['cust-email'],
            phone: vals['cust-phone'],
            company: vals['cust-company'],
            address: vals['cust-address'],
            notes: vals['cust-notes'],
          });
          renderCustomersPage();
          toast('Customer added', 'success');
        },
      });
      break;

    case 'edit-customer': {
      const cust = customers.getCustomerById(id);
      if (!cust) break;
      showFormModal({
        title: 'Edit Customer',
        fields: [
          { id: 'cust-name', label: 'Name', type: 'text', required: true, value: cust.name },
          { id: 'cust-email', label: 'Email', type: 'text', value: cust.email || '' },
          { id: 'cust-phone', label: 'Phone', type: 'text', value: cust.phone || '' },
          { id: 'cust-company', label: 'Company', type: 'text', value: cust.company || '' },
          { id: 'cust-address', label: 'Address', type: 'text', value: cust.address || '' },
          { id: 'cust-notes', label: 'Notes', type: 'text', value: cust.notes || '' },
        ],
        submitLabel: 'Save Changes',
        async onSubmit(vals) {
          await customers.updateCustomer(id, {
            name: vals['cust-name'],
            email: vals['cust-email'],
            phone: vals['cust-phone'],
            company: vals['cust-company'],
            address: vals['cust-address'],
            notes: vals['cust-notes'],
          });
          renderCustomersPage();
          toast('Customer updated', 'success');
        },
      });
      break;
    }

    case 'delete-customer': {
      const cust = customers.getCustomerById(id);
      if (!cust) break;
      if (!await showConfirmModal({ title: 'Remove Customer', message: `Remove customer "${cust.name}"?`, confirmLabel: 'Remove', danger: true })) break;
      // Clean up references: nullify customerId on sales orders
      const linkedSales = sales.getAllSales().filter(s => s.customerId === id);
      for (const s of linkedSales) {
        await sales.updateSale(s.id, { customerId: null });
      }
      await customers.deleteCustomer(id);
      if (selectedCustomerId === id) selectedCustomerId = null;
      renderCustomersPage();
      toast(`${cust.name} removed`, 'info');
      break;
    }

    case 'view-customer':
      selectedCustomerId = id;
      renderCustomersPage();
      break;

    case 'close-customer-detail':
      selectedCustomerId = null;
      renderCustomersPage();
      break;

    // ── Sales Order Actions ──
    case 'create-sale': {
      const allCust = customers.getAllCustomers();
      const allProds = products.getAllProducts();
      const custOptions = [{ value: '', label: '-- No customer --' }, ...allCust.map(c => ({ value: String(c.id), label: c.name }))];
      const prodOptions = allProds.map(p => ({ value: String(p.id), label: `${p.name} ($${(p.sellPrice || 0).toFixed(2)})` }));

      if (!prodOptions.length) { toast('Add products first', 'warning'); break; }

      showFormModal({
        title: 'New Sales Order',
        fields: [
          { id: 'sale-customer', label: 'Customer', type: 'select', options: custOptions },
          { id: 'sale-product', label: 'Product', type: 'select', options: prodOptions },
          { id: 'sale-qty', label: 'Quantity', type: 'number', value: '1', required: true },
          { id: 'sale-price', label: 'Unit Price', type: 'number', value: '', placeholder: 'Auto from product' },
          { id: 'sale-tax', label: 'Tax', type: 'number', value: '0' },
          { id: 'sale-shipping', label: 'Shipping Cost', type: 'number', value: '0' },
          { id: 'sale-notes', label: 'Notes', type: 'text', placeholder: 'Optional notes' },
        ],
        submitLabel: 'Create Order',
        async onSubmit(vals) {
          const prodId = parseInt(vals['sale-product']);
          const prod = products.getProductById(prodId);
          const qty = parseInt(vals['sale-qty']) || 1;
          const unitPrice = parseFloat(vals['sale-price']) || (prod?.sellPrice || 0);
          const tax = parseFloat(vals['sale-tax']) || 0;
          const shippingCost = parseFloat(vals['sale-shipping']) || 0;
          const subtotal = Math.round(qty * unitPrice * 100) / 100;
          const total = Math.round((subtotal + tax + shippingCost) * 100) / 100;

          await sales.createSale({
            customerId: vals['sale-customer'] ? parseInt(vals['sale-customer']) : null,
            lineItems: [{ productId: prodId, description: prod?.name || 'Product', quantity: qty, unitPrice }],
            subtotal,
            tax,
            shippingCost,
            total,
            notes: vals['sale-notes'],
          });
          renderSalesPage();
          toast('Sales order created', 'success');
        },
      });

      // Auto-fill price when product changes
      setTimeout(() => {
        const prodSelect = document.getElementById('sale-product');
        const priceInput = document.getElementById('sale-price');
        if (prodSelect && priceInput) {
          const initProd = products.getProductById(parseInt(prodSelect.value));
          if (initProd && !priceInput.value) priceInput.value = (initProd.sellPrice || 0).toFixed(2);
          prodSelect.addEventListener('change', () => {
            const p = products.getProductById(parseInt(prodSelect.value));
            if (p) priceInput.value = (p.sellPrice || 0).toFixed(2);
          });
        }
      }, 100);
      break;
    }

    case 'view-sale':
      selectedSaleId = id;
      renderSalesPage();
      break;

    case 'close-sale-detail':
      selectedSaleId = null;
      renderSalesPage();
      break;

    case 'confirm-sale': {
      const sale = sales.getSaleById(id);
      if (!sale) break;
      await sales.confirmSale(id);
      renderSalesPage();
      toast(`${sale.orderNumber} confirmed`, 'success');
      break;
    }

    case 'ship-sale': {
      const sale = sales.getSaleById(id);
      if (!sale) break;
      const tracking = await showPromptModal({ title: 'Tracking Number', message: 'Enter tracking number (optional):', placeholder: 'e.g. 1Z999AA10123456784' }) || '';
      await sales.shipSale(id, tracking);
      // Deduct inventory for line items
      if (sale.lineItems && sale.lineItems.length) {
        for (const li of sale.lineItems) {
          if (li.productId && li.quantity) {
            try {
              const result = await products.changeQuantity(li.productId, -li.quantity);
              if (result) {
                await history.addEntry({
                  itemType: 'product', itemId: li.productId,
                  itemName: result.item.name,
                  changeType: 'sold', quantityChange: -li.quantity,
                  newQuantity: result.newQty,
                  note: `Shipped via ${sale.orderNumber}`,
                });
              }
            } catch (e) { console.warn('Inventory deduction failed:', e); }
          }
        }
      }
      renderSalesPage();
      renderInventoryPage();
      renderHeader();
      renderAlerts();
      toast(`${sale.orderNumber} shipped`, 'success');
      break;
    }

    case 'deliver-sale': {
      const sale = sales.getSaleById(id);
      if (!sale) break;
      await sales.deliverSale(id);
      renderSalesPage();
      toast(`${sale.orderNumber} marked delivered`, 'success');
      break;
    }

    case 'mark-sale-paid': {
      const sale = sales.getSaleById(id);
      if (!sale || sale.status === 'paid') break;
      await sales.markPaid(id);
      // Create income transaction
      try {
        const cust = sale.customerId ? customers.getCustomerById(sale.customerId) : null;
        await transactions.addTransaction({
          type: 'income',
          amount: sale.total || 0,
          description: `Payment for ${sale.orderNumber}${cust ? ' - ' + cust.name : ''}`,
          category: 'sales',
          productId: sale.lineItems?.[0]?.productId || null,
        });
        // Update customer totalSpent and orderCount
        if (cust) {
          await customers.updateCustomer(cust.id, {
            totalSpent: (cust.totalSpent || 0) + (sale.total || 0),
            orderCount: (cust.orderCount || 0) + 1,
          });
        }
      } catch (e) { console.warn('Transaction/customer update failed:', e); }
      renderSalesPage();
      renderCustomersPage();
      toast(`${sale.orderNumber} marked paid`, 'success');
      break;
    }

    case 'cancel-sale': {
      const sale = sales.getSaleById(id);
      if (!sale) break;
      if (!await showConfirmModal({ title: 'Cancel Order', message: `Cancel order ${sale.orderNumber}?`, confirmLabel: 'Cancel Order', danger: true })) break;
      await sales.cancelSale(id);
      renderSalesPage();
      toast(`${sale.orderNumber} cancelled`, 'info');
      break;
    }

    case 'delete-sale': {
      const sale = sales.getSaleById(id);
      if (!sale) break;
      if (!await showConfirmModal({ title: 'Delete Order', message: `Delete order ${sale.orderNumber}? This cannot be undone.`, confirmLabel: 'Delete', danger: true })) break;
      await sales.deleteSale(id);
      if (selectedSaleId === id) selectedSaleId = null;
      renderSalesPage();
      toast('Order deleted', 'info');
      break;
    }
  }
}

// ── Sales Channels (Ecommerce) Section ─────────────

let _ecommerceStatus = null;
let _shippingRates = [];
let _shippingShipmentId = null;
let _shippingForSaleId = null;
let _selectedShippingRate = null;

// ── Team Section ────────────────────────────────────

async function loadTeamSection() {
  const container = document.getElementById('team-section-container');
  if (!container) return;

  try {
    const members = await apiTeamList();
    let html = '<div class="team-members-list">';

    members.forEach(m => {
      const roleClass = `role-${m.role}`;
      const isPending = m.status === 'pending';
      html += `
        <div class="team-member-row">
          <div class="team-member-info">
            <div class="team-member-name">${escHtml(m.email)}</div>
            ${isPending ? '<span class="team-status-pending">Invite pending</span>' : ''}
          </div>
          <span class="team-role-badge ${roleClass}">${m.role}</span>
          ${m.isOwner ? '' : `
            <select class="team-role-select" data-member-id="${m.id}" style="margin-left:8px;font-size:0.78rem;padding:3px 6px;border-radius:6px;background:var(--surface);color:var(--text);border:1px solid var(--border);">
              <option value="manager" ${m.role === 'manager' ? 'selected' : ''}>Manager</option>
              <option value="staff" ${m.role === 'staff' ? 'selected' : ''}>Staff</option>
              <option value="viewer" ${m.role === 'viewer' ? 'selected' : ''}>Viewer</option>
            </select>
            <button class="btn-icon team-remove-btn" data-action="remove-team-member" data-id="${m.id}" title="Remove member" style="margin-left:6px;color:var(--danger);font-size:1rem;cursor:pointer;background:none;border:none;">&#10005;</button>
          `}
        </div>`;
    });

    html += '</div>';
    html += `
      <div style="margin-top:14px;">
        <button class="btn-primary" id="btn-invite-member">+ Invite Member</button>
      </div>
      <div style="margin-top:8px;font-size:0.72rem;color:var(--text-muted);">
        <strong>Roles:</strong> Owner = full access | Manager = everything except billing & team | Staff = inventory CRUD only | Viewer = read-only
      </div>`;

    container.innerHTML = html;

    // Invite button
    document.getElementById('btn-invite-member')?.addEventListener('click', showInviteMemberModal);

    // Role change selects
    container.querySelectorAll('.team-role-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const memberId = e.target.dataset.memberId;
        const newRole = e.target.value;
        try {
          await apiTeamUpdateRole(memberId, newRole);
          toast('Role updated', 'success');
        } catch (err) {
          toast(friendlyError(err), 'error');
          loadTeamSection(); // reload to reset
        }
      });
    });

    // Remove buttons
    container.querySelectorAll('[data-action="remove-team-member"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const memberId = btn.dataset.id;
        if (!await showConfirmModal({ title: 'Remove Member', message: 'Remove this team member?', confirmLabel: 'Remove', danger: true })) return;
        try {
          await apiTeamRemove(memberId);
          toast('Member removed', 'success');
          loadTeamSection();
        } catch (err) {
          toast(friendlyError(err), 'error');
        }
      });
    });

  } catch (err) {
    container.innerHTML = `<p style="color:var(--text-muted);">Could not load team members.</p>`;
    console.warn('Team section error:', err);
  }
}

// ── Sales Channels / Ecommerce ──────────────────────

async function loadEcommerceSection() {
  const container = document.getElementById('ecommerce-section-container');
  if (!container) return;

  try {
    _ecommerceStatus = await getChannelStatus();
  } catch (e) {
    _ecommerceStatus = null;
  }

  container.innerHTML = renderSalesChannelsSection(_ecommerceStatus);
}

function parseShippingAddress(addr) {
  if (!addr) return { name: 'Recipient', street1: '', city: '', state: '', zip: '', country: 'US' };
  const parts = addr.split(',').map(s => s.trim());
  return {
    name: 'Recipient',
    street1: parts[0] || '',
    city: parts[1] || '',
    state: parts[2] || '',
    zip: parts[3] || '',
    country: 'US',
  };
}

// ── QuickBooks Section ──────────────────────────────

let _qbStatus = null;
let _qbReport = null;

// ── Customers Page ──────────────────────────────────

let customerSearch = '';
let selectedCustomerId = null;

function renderCustomersPage() {
  const el = document.getElementById('page-customers');
  if (!el) return;
  const filtered = customers.filterCustomers({ search: customerSearch });

  let html = `
    <div class="toolbar">
      <div class="toolbar-left">
        <input class="search-input" id="customer-search" type="text" placeholder="Search customers..." value="${escHtml(customerSearch)}" />
        <span style="color:var(--text-muted);font-size:0.85rem;">${filtered.length} customer${filtered.length !== 1 ? 's' : ''}</span>
      </div>
      <button class="btn-primary" data-action="add-customer">+ Add Customer</button>
    </div>
  `;

  if (selectedCustomerId) {
    const cust = customers.getCustomerById(selectedCustomerId);
    if (cust) {
      const custOrders = sales.getAllSales().filter(o => o.customerId === cust.id);
      html += `
        <div class="sale-detail" style="margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
            <div>
              <h3 style="margin:0;color:var(--text);">${escHtml(cust.name)}</h3>
              ${cust.company ? `<div style="color:var(--text-muted);font-size:0.85rem;">${escHtml(cust.company)}</div>` : ''}
            </div>
            <button class="btn-secondary" data-action="close-customer-detail" style="font-size:0.78rem;">Close</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
            ${cust.email ? `<div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Email</div><div style="font-size:0.88rem;color:var(--text);">${escHtml(cust.email)}</div></div>` : ''}
            ${cust.phone ? `<div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Phone</div><div style="font-size:0.88rem;color:var(--text);">${escHtml(cust.phone)}</div></div>` : ''}
            ${cust.address ? `<div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Address</div><div style="font-size:0.88rem;color:var(--text);">${escHtml(cust.address)}</div></div>` : ''}
            <div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Total Spent</div><div style="font-size:0.88rem;color:var(--accent);">$${(cust.totalSpent || 0).toFixed(2)}</div></div>
            <div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Orders</div><div style="font-size:0.88rem;color:var(--text);">${cust.orderCount || 0}</div></div>
          </div>
          ${cust.notes ? `<div style="font-size:0.82rem;color:var(--text-muted);font-style:italic;margin-bottom:12px;">${escHtml(cust.notes)}</div>` : ''}
          <div class="sale-actions">
            <button class="btn-secondary" data-action="edit-customer" data-id="${cust.id}">Edit</button>
            <button class="btn-secondary" data-action="delete-customer" data-id="${cust.id}" style="color:var(--danger);border-color:var(--danger);">Delete</button>
          </div>
          ${custOrders.length ? `
            <div style="margin-top:16px;">
              <h4 style="margin:0 0 8px;font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Orders</h4>
              <div class="sales-list">
                ${custOrders.map(o => {
                  const badge = sales.getSaleStatusBadge(o.status);
                  return `<div class="sale-row" data-action="view-sale" data-id="${o.id}">
                    <div><div class="sale-number">${escHtml(o.orderNumber)}</div><div class="sale-customer">${new Date(o.createdAt).toLocaleDateString()}</div></div>
                    <div style="display:flex;align-items:center;gap:12px;">
                      <span class="sale-status ${badge.cls}">${badge.label}</span>
                      <span class="sale-total">$${(o.total || 0).toFixed(2)}</span>
                    </div>
                  </div>`;
                }).join('')}
              </div>
            </div>
          ` : '<div style="margin-top:12px;font-size:0.82rem;color:var(--text-muted);">No orders yet for this customer.</div>'}
        </div>
      `;
    }
  }

  if (!filtered.length) {
    html += `<div class="empty"><div class="empty-icon">--</div><p>No customers yet. Add customers to create sales orders.</p></div>`;
  } else {
    html += '<div class="customer-grid">';
    for (const c of filtered) {
      html += `
        <div class="customer-card" data-action="view-customer" data-id="${c.id}">
          <div class="customer-name">${escHtml(c.name)}</div>
          ${c.company ? `<div class="customer-company">${escHtml(c.company)}</div>` : ''}
          ${c.email ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">${escHtml(c.email)}</div>` : ''}
          <div class="customer-stats">
            <span>$${(c.totalSpent || 0).toFixed(2)} spent</span>
            <span>${c.orderCount || 0} order${(c.orderCount || 0) !== 1 ? 's' : ''}</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px;">
            <button class="toggle-btn" data-action="edit-customer" data-id="${c.id}">Edit</button>
            <button class="btn-delete" data-action="delete-customer" data-id="${c.id}" title="Remove">x</button>
          </div>
        </div>`;
    }
    html += '</div>';
  }

  el.innerHTML = html;

  const custSearchEl = document.getElementById('customer-search');
  if (custSearchEl) {
    custSearchEl.oninput = e => {
      customerSearch = e.target.value.trim();
      renderCustomersPage();
    };
  }
}

// ── Sales Page ──────────────────────────────────────

let salesFilter = 'all';
let salesSearch = '';
let selectedSaleId = null;

function renderShippingSection(sale) {
  let html = `
    <div class="shipping-section" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:0.85rem;font-weight:600;color:var(--text);text-transform:uppercase;letter-spacing:0.06em;">Shipping</div>
        <button class="btn-secondary" data-action="get-shipping-rates" data-id="${sale.id}" style="font-size:0.78rem;">Get Shipping Rates</button>
      </div>`;

  if (_shippingForSaleId === sale.id && _shippingRates.length > 0) {
    html += `<div class="shipping-rates">`;
    for (const rate of _shippingRates) {
      const isSelected = _selectedShippingRate === rate.id;
      html += `
        <div class="shipping-rate-card ${isSelected ? 'selected' : ''}" data-action="select-shipping-rate" data-rate-id="${rate.id}">
          <div class="shipping-carrier">${escHtml(rate.carrier)}</div>
          <div class="shipping-service">${escHtml(rate.service)}</div>
          <div class="shipping-price">$${parseFloat(rate.rate).toFixed(2)}</div>
          <div class="shipping-days">${rate.delivery_days ? rate.delivery_days + ' day' + (rate.delivery_days !== 1 ? 's' : '') : 'Varies'}</div>
        </div>`;
    }
    html += `</div>`;

    if (_selectedShippingRate) {
      html += `<button class="btn-primary" data-action="buy-shipping-label" data-id="${sale.id}" style="margin-top:12px;font-size:0.82rem;">Buy Label & Get Tracking</button>`;
    }
  }

  html += `</div>`;
  return html;
}

function renderSalesPage() {
  const el = document.getElementById('page-sales');
  if (!el) return;
  let allSales = salesFilter === 'all' ? sales.getAllSales() : sales.getSalesByStatus(salesFilter);
  const stats = sales.getSalesStats();
  const allCustomers = customers.getAllCustomers();

  if (salesSearch) {
    const q = salesSearch.toLowerCase();
    allSales = allSales.filter(o => {
      const cust = o.customerId ? customers.getCustomerById(o.customerId) : null;
      return (o.orderNumber && o.orderNumber.toLowerCase().includes(q))
        || (cust && cust.name && cust.name.toLowerCase().includes(q))
        || (o.status && o.status.toLowerCase().includes(q));
    });
  }

  let html = `
    <div class="toolbar">
      <div class="toolbar-left">
        <input class="search-input" id="sales-search" type="text" placeholder="Search sales..." value="${escHtml(salesSearch)}" />
        <button class="filter-btn ${salesFilter === 'all' ? 'active' : ''}" data-sfilter="all">All</button>
        <button class="filter-btn ${salesFilter === 'draft' ? 'active' : ''}" data-sfilter="draft">Draft</button>
        <button class="filter-btn ${salesFilter === 'confirmed' ? 'active' : ''}" data-sfilter="confirmed">Confirmed</button>
        <button class="filter-btn ${salesFilter === 'shipped' ? 'active' : ''}" data-sfilter="shipped">Shipped</button>
        <button class="filter-btn ${salesFilter === 'paid' ? 'active' : ''}" data-sfilter="paid">Paid</button>
      </div>
      <button class="btn-primary" data-action="create-sale">+ New Order</button>
    </div>

    <div class="cost-summary-row" style="margin-bottom:20px;">
      <div class="cost-summary-card">
        <div class="cost-summary-value">${stats.total}</div>
        <div class="cost-summary-label">Total Orders</div>
      </div>
      <div class="cost-summary-card">
        <div class="cost-summary-value">${stats.pending}</div>
        <div class="cost-summary-label">Pending</div>
      </div>
      <div class="cost-summary-card">
        <div class="cost-summary-value">${stats.shipped}</div>
        <div class="cost-summary-label">Shipped</div>
      </div>
      <div class="cost-summary-card">
        <div class="cost-summary-value">$${stats.revenue.toFixed(2)}</div>
        <div class="cost-summary-label">Revenue (Paid)</div>
      </div>
    </div>
  `;

  // Sale detail view
  if (selectedSaleId) {
    const sale = sales.getSaleById(selectedSaleId);
    if (sale) {
      const cust = sale.customerId ? customers.getCustomerById(sale.customerId) : null;
      const badge = sales.getSaleStatusBadge(sale.status);
      html += `
        <div class="sale-detail" style="margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
            <div>
              <h3 style="margin:0;color:var(--text);">${escHtml(sale.orderNumber)} <span class="sale-status ${badge.cls}" style="vertical-align:middle;margin-left:8px;">${badge.label}</span></h3>
              ${cust ? `<div style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">Customer: ${escHtml(cust.name)}</div>` : ''}
            </div>
            <button class="btn-secondary" data-action="close-sale-detail" style="font-size:0.78rem;">Close</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px;">
            <div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Subtotal</div><div style="font-size:0.88rem;color:var(--text);">$${(sale.subtotal || 0).toFixed(2)}</div></div>
            <div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Tax</div><div style="font-size:0.88rem;color:var(--text);">$${(sale.tax || 0).toFixed(2)}</div></div>
            <div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Shipping</div><div style="font-size:0.88rem;color:var(--text);">$${(sale.shippingCost || 0).toFixed(2)}</div></div>
            <div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Total</div><div style="font-size:1rem;color:var(--accent);font-weight:600;">$${(sale.total || 0).toFixed(2)}</div></div>
            <div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Created</div><div style="font-size:0.88rem;color:var(--text);">${new Date(sale.createdAt).toLocaleDateString()}</div></div>
            ${sale.shippedAt ? `<div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Shipped</div><div style="font-size:0.88rem;color:var(--text);">${new Date(sale.shippedAt).toLocaleDateString()}</div></div>` : ''}
            ${sale.deliveredAt ? `<div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Delivered</div><div style="font-size:0.88rem;color:var(--text);">${new Date(sale.deliveredAt).toLocaleDateString()}</div></div>` : ''}
            ${sale.paidAt ? `<div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Paid</div><div style="font-size:0.88rem;color:var(--text);">${new Date(sale.paidAt).toLocaleDateString()}</div></div>` : ''}
            ${sale.trackingNumber ? `<div><div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">Tracking</div><div style="font-size:0.88rem;color:var(--text);">${escHtml(sale.trackingNumber)}</div></div>` : ''}
          </div>
          ${sale.lineItems && sale.lineItems.length ? `
            <div style="margin-bottom:12px;">
              <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Line Items</div>
              ${sale.lineItems.map(li => {
                const prod = products.getProductById(li.productId);
                return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
                  <span style="color:var(--text);">${prod ? escHtml(prod.name) : (li.description || 'Item')}</span>
                  <span style="color:var(--text-muted);">${li.quantity} x $${(li.unitPrice || 0).toFixed(2)} = $${((li.quantity || 0) * (li.unitPrice || 0)).toFixed(2)}</span>
                </div>`;
              }).join('')}
            </div>
          ` : ''}
          ${sale.notes ? `<div style="font-size:0.82rem;color:var(--text-muted);font-style:italic;margin-bottom:12px;">${escHtml(sale.notes)}</div>` : ''}
          ${sale.shippingAddress ? `<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px;">Ship to: ${escHtml(sale.shippingAddress)}</div>` : ''}
          <div class="sale-actions">
            ${sale.status === 'draft' ? `<button class="btn-primary" data-action="confirm-sale" data-id="${sale.id}" style="font-size:0.82rem;">Confirm</button>` : ''}
            ${sale.status === 'confirmed' ? `<button class="btn-primary" data-action="ship-sale" data-id="${sale.id}" style="font-size:0.82rem;">Ship</button>` : ''}
            ${sale.status === 'shipped' ? `<button class="btn-primary" data-action="deliver-sale" data-id="${sale.id}" style="font-size:0.82rem;">Mark Delivered</button>` : ''}
            ${sale.status === 'delivered' ? `<button class="btn-primary" data-action="mark-sale-paid" data-id="${sale.id}" style="font-size:0.82rem;">Mark Paid</button>` : ''}
            ${!['paid', 'cancelled'].includes(sale.status) ? `<button class="btn-secondary" data-action="cancel-sale" data-id="${sale.id}" style="color:var(--danger);border-color:var(--danger);font-size:0.82rem;">Cancel</button>` : ''}
            ${['draft', 'cancelled'].includes(sale.status) ? `<button class="btn-secondary" data-action="delete-sale" data-id="${sale.id}" style="color:var(--danger);border-color:var(--danger);font-size:0.82rem;">Delete</button>` : ''}
          </div>
          ${sale.status === 'confirmed' ? renderShippingSection(sale) : ''}
          ${sale.labelUrl && sale.labelUrl !== '#' ? `<div style="margin-top:12px;"><a href="${escHtml(sale.labelUrl)}" target="_blank" class="btn-secondary" style="display:inline-block;text-decoration:none;font-size:0.82rem;">Download Shipping Label</a></div>` : ''}
        </div>
      `;
    }
  }

  if (!allSales.length) {
    html += `<div class="empty"><div class="empty-icon">--</div><p>${salesSearch ? 'No sales match your search.' : `No sales orders${salesFilter !== 'all' ? ' with this status' : ''}. Create a new order to start tracking sales.`}</p></div>`;
  } else {
    html += '<div class="sales-list">';
    for (const o of allSales) {
      const cust = o.customerId ? customers.getCustomerById(o.customerId) : null;
      const badge = sales.getSaleStatusBadge(o.status);
      const date = new Date(o.createdAt).toLocaleDateString();
      html += `
        <div class="sale-row" data-action="view-sale" data-id="${o.id}">
          <div>
            <div class="sale-number">${escHtml(o.orderNumber)}</div>
            <div class="sale-customer">${cust ? escHtml(cust.name) : 'No customer'} &middot; ${date}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="sale-status ${badge.cls}">${badge.label}</span>
            <span class="sale-total">$${(o.total || 0).toFixed(2)}</span>
          </div>
        </div>`;
    }
    html += '</div>';
  }

  el.innerHTML = html;

  const salesSearchEl = document.getElementById('sales-search');
  if (salesSearchEl) {
    salesSearchEl.oninput = e => {
      salesSearch = e.target.value.trim();
      renderSalesPage();
    };
  }

  // Sales filter uses event delegation via handleMainClick (data-action pattern)
  // Bind filter buttons inline — use onclick to avoid stacking listeners
  el.querySelectorAll('[data-sfilter]').forEach(btn => {
    btn.onclick = () => {
      salesFilter = btn.dataset.sfilter;
      renderSalesPage();
    };
  });
}

// ── Pricing Page ────────────────────────────────────

async function renderPricingPageWrapper() {
  const el = document.getElementById('page-pricing');
  if (!el) return;
  try {
    const sub = await getSubscriptionStatus();
    el.innerHTML = renderPricingPage(sub.tier, sub.status);
  } catch (e) {
    el.innerHTML = renderPricingPage('free', 'active');
  }
}

// ── Billing Section ─────────────────────────────────

async function loadBillingSection() {
  const container = document.getElementById('billing-section-container');
  if (!container) return;
  try {
    const sub = await getSubscriptionStatus();
    container.innerHTML = renderBillingSection(sub.tier, sub.status);
  } catch (e) {
    container.innerHTML = renderBillingSection('free', 'active');
  }
}

// ── QuickBooks Section ──────────────────────────────

async function loadQBSection() {
  const container = document.getElementById('qb-section-container');
  if (!container) return;

  try {
    _qbStatus = await getQBStatus();
  } catch (e) {
    _qbStatus = null;
  }

  container.innerHTML = renderQuickBooksSection(_qbStatus, _qbReport);
}

// ── Plaid Account Refresh ───────────────────────────

async function refreshPlaidAccounts() {
  try {
    const { accounts } = await getLinkedAccounts();
    setPlaidAccounts(accounts);
  } catch (err) {
    console.warn('Failed to fetch Plaid accounts:', err.message);
    setPlaidAccounts([]);
  }
}

async function handleMainChange(e) {
  const input = e.target.closest('[data-action="set-material-qty"]');
  if (!input) return;
  const id = parseInt(input.dataset.id);
  const newQty = parseFloat(input.value);
  if (isNaN(newQty)) return;

  const result = await materials.setQuantity(id, newQty);
  if (result && result.delta !== 0) {
    await history.addEntry({
      itemType: 'material',
      itemId: id,
      itemName: result.item.name,
      changeType: result.delta > 0 ? 'restock' : 'sold',
      quantityChange: result.delta,
      newQuantity: result.newQty,
      note: 'manual set',
    });
  }
  renderHeader();
  renderAlerts();
}

// ── Launch ───────────────────────────────────────────

init().catch(err => {
  console.error('Init failed:', err);
  // If it's a session/auth error, show login page instead of crashing
  if (err.message?.includes('Session expired') || err.message?.includes('401') || err.message?.includes('token') || err.message?.includes('Unauthorized')) {
    showLandingPage({ onLogin: loadApp });
    return;
  }
  document.body.innerHTML = `<div style="padding:40px;text-align:center;color:#e07070;">
    <h2>Failed to initialize</h2>
    <p>${err.message}</p>
    <button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;background:#c8a06a;color:#0f0d0b;border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;">Reload</button>
  </div>`;
});
