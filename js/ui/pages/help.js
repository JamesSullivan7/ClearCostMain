// ── Help / FAQ Page ─────────────────────────────────

import { escHtml } from '../modals.js';

export function renderHelpPage() {
  const el = document.getElementById('page-help');
  if (!el) return;

  const faqData = [
    { title: 'Getting Started', items: [
      { q: 'How do I add my first product?', a: 'Go to the <strong>Inventory</strong> tab and click <strong>+ Add</strong>. Fill in the product name, SKU, quantity, and cost. You can also upload a photo and assign it to a location.' },
      { q: 'How do I add raw materials?', a: 'Navigate to the <strong>Materials</strong> tab and click <strong>+ Add Material</strong>. Enter the material name, unit of measure, quantity on hand, and cost per unit.' },
      { q: 'How do I create a recipe (Bill of Materials)?', a: 'Go to the <strong>Recipes</strong> tab and click <strong>+ Add Recipe</strong>. Select a finished product, then add the raw materials and quantities needed to produce one unit.' },
      { q: 'How do I import data from a spreadsheet?', a: 'On the <strong>Inventory</strong> or <strong>Materials</strong> tab, click <strong>Import CSV</strong>. Upload a CSV file with columns matching the expected format. A template is provided for reference.' },
    ]},
    { title: 'Inventory Management', items: [
      { q: 'How do low stock alerts work?', a: 'When a product or material drops below its threshold, a warning appears on the dashboard and in the header stats. Set global thresholds in <strong>Settings > Low Stock Thresholds</strong>, or override per item.' },
      { q: 'How do I scan barcodes?', a: 'Click the <strong>Scan</strong> button on the Inventory or Materials toolbar. Point your camera at a barcode and the app will match it to an existing item or let you create a new one.' },
      { q: 'How do I manage multiple locations?', a: 'Locations are created automatically when you assign products to them. Use the location filter dropdown on the <strong>Inventory</strong> tab to view stock by warehouse or store.' },
      { q: 'How do I create a purchase order?', a: 'Go to the <strong>Orders</strong> tab and click <strong>+ New Order</strong>. Select a supplier, add line items, and submit. You can track order status and receive items when they arrive.' },
      { q: 'How do production runs work?', a: 'On the <strong>Production</strong> tab, select a recipe and specify how many units to produce. The app will deduct raw materials and add finished products to your inventory automatically.' },
    ]},
    { title: 'Cost Analysis', items: [
      { q: 'How is COGS calculated?', a: 'COGS (Cost of Goods Sold) is calculated from your recipe costs, material prices, and any overhead allocations. View detailed breakdowns on the <strong>Cost Analysis</strong> tab.' },
      { q: 'What is the difference between fixed and variable costs?', a: 'Fixed costs (rent, insurance) stay the same regardless of production volume. Variable costs (materials, packaging) change with quantity. Both are tracked in the <strong>Expenses</strong> tab.' },
      { q: 'How does break-even analysis work?', a: 'The break-even calculator on the <strong>Cost Analysis</strong> tab shows how many units you need to sell to cover all costs. It uses your selling price, variable cost per unit, and total fixed costs.' },
      { q: 'How are overhead costs allocated to products?', a: 'Overhead costs from the <strong>Expenses</strong> tab are distributed across products based on production volume or a custom allocation method you define in Cost Analysis.' },
    ]},
    { title: 'Sales & Customers', items: [
      { q: 'How do I create a sales order?', a: 'Go to the <strong>Sales</strong> tab and click <strong>+ New Sale</strong>. Select a customer, add products, set quantities and prices, then save. Inventory is automatically reduced.' },
      { q: 'How do I track customer purchases?', a: 'The <strong>Customers</strong> tab shows each customer\'s order history, total spend, and last purchase date. Click any customer to see their full transaction record.' },
      { q: 'How do shipping labels work?', a: 'When viewing a sales order, click <strong>Generate Label</strong> to create a shipping label. You can print it directly or download as a PDF. Integrates with your configured shipping provider.' },
    ]},
    { title: 'Integrations', items: [
      { q: 'How do I connect my bank account (Plaid)?', a: 'Go to <strong>Transactions</strong> and click <strong>Connect Bank</strong>. Follow the Plaid flow to securely link your bank. Transactions will sync automatically for expense tracking.' },
      { q: 'How do I connect QuickBooks?', a: 'In <strong>Settings</strong>, scroll to the QuickBooks section and click <strong>Connect QuickBooks</strong>. Authorize the connection and your invoices, expenses, and customers will sync.' },
      { q: 'How do I connect Etsy or Shopify?', a: 'In <strong>Settings</strong>, find the Sales Channels section. Click <strong>Connect</strong> next to Etsy or Shopify and follow the authorization flow. Orders will import automatically.' },
      { q: 'How do I sync orders from my online store?', a: 'Once your Etsy or Shopify store is connected, orders sync automatically. You can also click <strong>Sync Now</strong> in Settings to trigger a manual sync at any time.' },
    ]},
    { title: 'Account & Billing', items: [
      { q: 'How do I change my password?', a: 'Click <strong>Log Out</strong> in the sidebar, then use the <strong>Forgot Password</strong> link on the login screen. A reset link will be sent to your email address.' },
      { q: 'How do I upgrade my plan?', a: 'Go to <strong>Settings</strong> and scroll to the Billing section. Click <strong>Upgrade</strong> to see available plans and complete the upgrade through Stripe.' },
      { q: 'How do I invite team members?', a: 'In <strong>Settings > Team Members</strong>, enter a team member\'s email and select their role (Admin, Manager, or Viewer). They\'ll receive an invite email to join your business.' },
      { q: 'How do I export my data?', a: 'Go to <strong>Settings > Data Management</strong> and click <strong>Export All Data (JSON)</strong>. This downloads a complete backup of all your inventory, materials, recipes, and history.' },
    ]},
  ];

  let html = `<input type="text" class="help-search" id="help-search" placeholder="Search help topics..." />`;

  for (const section of faqData) {
    html += `<div class="help-section"><h4 class="help-section-title">${section.title}</h4>`;
    for (const item of section.items) {
      html += `
        <div class="help-item" data-question="${escHtml(item.q.toLowerCase())}">
          <div class="help-question">${escHtml(item.q)}<span class="help-toggle">+</span></div>
          <div class="help-answer"><p>${item.a}</p></div>
        </div>`;
    }
    html += `</div>`;
  }

  html += `
    <div class="settings-section" style="margin-top:32px;">
      <h3>Still need help?</h3>
      <p style="color:var(--text-muted);margin-bottom:12px;">Can't find what you're looking for? Reach out to our support team.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <a href="#settings" class="btn-primary" style="text-decoration:none;">Contact Support</a>
        <a href="mailto:support@clearcostinventory.com" class="btn-secondary" style="text-decoration:none;">Email Us</a>
      </div>
    </div>`;

  el.innerHTML = html;

  // Accordion toggle (use onclick to avoid stacking on re-render)
  el.onclick = e => {
    const question = e.target.closest('.help-question');
    if (!question) return;
    const item = question.closest('.help-item');
    if (item) item.classList.toggle('open');
  };

  // Search filter
  const searchInput = document.getElementById('help-search');
  if (searchInput) {
    searchInput.oninput = () => {
      const query = searchInput.value.toLowerCase().trim();
      el.querySelectorAll('.help-item').forEach(item => {
        const match = !query || item.dataset.question.includes(query);
        item.style.display = match ? '' : 'none';
      });
      // Hide empty sections
      el.querySelectorAll('.help-section').forEach(sec => {
        const visibleItems = sec.querySelectorAll('.help-item[style=""], .help-item:not([style])');
        // Check if any items are visible
        const hasVisible = Array.from(sec.querySelectorAll('.help-item')).some(i => i.style.display !== 'none');
        sec.style.display = hasVisible ? '' : 'none';
      });
    });
  }
}
