// ── Landing Page & Password Reset ──────────────────
// Extracted from app.js — marketing landing page with login/signup forms

import { signUp, signIn, signOut, resetPassword, updatePassword } from '../supabase.js';
import { toast } from './toast.js';
import { startTutorial } from './tutorial.js';

// ── Login / Signup Page ─────────────────────────────

export function showLandingPage({ onLogin } = {}) {
  // Remove any existing overlay
  document.getElementById('landing-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'landing-overlay';
  overlay.className = 'landing-page';

  overlay.innerHTML = `
    <!-- ── Navigation ── -->
    <nav class="landing-nav">
      <div class="landing-nav-inner">
        <div class="landing-nav-brand">ClearCost</div>
        <div class="landing-nav-links">
          <a href="#features" class="landing-nav-link">Features</a>
          <a href="#pricing" class="landing-nav-link">Pricing</a>
          <a href="#how-it-works" class="landing-nav-link">How It Works</a>
        </div>
        <div class="landing-nav-actions">
          <button class="landing-btn-secondary" id="nav-login-btn">Log In</button>
          <a href="#get-started" class="landing-btn-primary landing-nav-cta">Start Free</a>
        </div>
        <button class="landing-mobile-toggle" id="landing-mobile-toggle" aria-label="Menu">&#9776;</button>
      </div>
      <div class="landing-mobile-menu" id="landing-mobile-menu">
        <a href="#features" class="landing-nav-link">Features</a>
        <a href="#pricing" class="landing-nav-link">Pricing</a>
        <a href="#how-it-works" class="landing-nav-link">How It Works</a>
        <button class="landing-btn-secondary" id="nav-login-btn-mobile">Log In</button>
        <a href="#get-started" class="landing-btn-primary" style="text-align:center;">Start Free</a>
      </div>
    </nav>

    <!-- ── Hero ── -->
    <section class="landing-hero">
      <div class="landing-container">
        <h1 class="landing-hero-headline">Know Your True Cost.<br>See Your Real Profit.</h1>
        <p class="landing-hero-sub">The all-in-one inventory and cost management platform built for small product businesses. Track materials, analyze costs, and see exactly how much you make on every product.</p>
        <div class="landing-hero-actions">
          <a href="#get-started" class="landing-btn-primary landing-btn-lg">Start Free &mdash; No Credit Card Required</a>
          <a href="#how-it-works" class="landing-btn-secondary landing-btn-lg">See How It Works</a>
        </div>
      </div>
    </section>

    <!-- ── Problem ── -->
    <section class="landing-section landing-problem">
      <div class="landing-container">
        <h2 class="landing-section-title">Spreadsheets Can't Tell You This</h2>
        <div class="landing-pain-points">
          <div class="landing-pain-card">
            <span class="landing-pain-icon">?</span>
            <p>What does each product actually cost &mdash; including materials, labor, shipping, and fees?</p>
          </div>
          <div class="landing-pain-card">
            <span class="landing-pain-icon">?</span>
            <p>After rent, insurance, and marketplace commissions &mdash; am I even profitable?</p>
          </div>
          <div class="landing-pain-card">
            <span class="landing-pain-icon">?</span>
            <p>Which products make money and which ones are draining my business?</p>
          </div>
        </div>
        <p class="landing-closing-text">ClearCost answers all three in real time.</p>
      </div>
    </section>

    <!-- ── Features ── -->
    <section class="landing-section" id="features">
      <div class="landing-container">
        <h2 class="landing-section-title">Everything You Need to Run Your Business</h2>
        <p class="landing-section-subtitle">One platform. No more juggling spreadsheets, accounting software, and inventory tools.</p>

        <div class="feature-categories">

          <div class="feature-category" data-category="inventory">
            <div class="feature-cat-header">
              <div class="feature-cat-icon">📦</div>
              <div class="feature-cat-info">
                <h3>Inventory Management</h3>
                <p>Track products, materials, recipes, and suppliers in real time</p>
              </div>
              <span class="feature-cat-toggle">+</span>
            </div>
            <div class="feature-cat-details">
              <ul>
                <li>Product tracking with quantities, SKUs, and sell prices</li>
                <li>Raw material management with costs and supplier links</li>
                <li>Bill of Materials (recipes) with exact ingredient quantities</li>
                <li>Supplier database with contact info, lead times, and ratings</li>
                <li>Purchase orders (create, send, receive, cancel)</li>
                <li>Production runs with automatic material deduction</li>
                <li>Barcode scanning via phone camera</li>
                <li>Multi-warehouse location tracking and stock transfers</li>
                <li>Low stock alerts with per-product thresholds</li>
                <li>CSV bulk import for quick data migration</li>
              </ul>
            </div>
          </div>

          <div class="feature-category" data-category="costs">
            <div class="feature-cat-header">
              <div class="feature-cat-icon">📊</div>
              <div class="feature-cat-info">
                <h3>True Cost Analysis</h3>
                <p>See your real profit per product — not just revenue minus materials</p>
              </div>
              <span class="feature-cat-toggle">+</span>
            </div>
            <div class="feature-cat-details">
              <ul>
                <li>COGS per product (materials + labor + shipping + fees)</li>
                <li>Full P&amp;L statement: Revenue → COGS → Gross Profit → Overhead → Net Profit</li>
                <li>Break-even analysis — units needed to cover all fixed costs</li>
                <li>Contribution margin per product</li>
                <li>Variable cost modeling (per-unit, per-batch, % of revenue)</li>
                <li>Fixed overhead allocation across products</li>
                <li>Expense tracking (rent, insurance, utilities, labor, marketing)</li>
                <li>Per-product profitability ranking</li>
              </ul>
            </div>
          </div>

          <div class="feature-category" data-category="sales">
            <div class="feature-cat-header">
              <div class="feature-cat-icon">🛒</div>
              <div class="feature-cat-info">
                <h3>Customers & Sales</h3>
                <p>Manage customers, create orders, and track the full sales lifecycle</p>
              </div>
              <span class="feature-cat-toggle">+</span>
            </div>
            <div class="feature-cat-details">
              <ul>
                <li>Customer database with contact info and purchase history</li>
                <li>Sales orders (draft → confirmed → shipped → delivered → paid)</li>
                <li>Automatic inventory deduction when orders ship</li>
                <li>Income transactions created automatically when orders are paid</li>
                <li>Order tracking with status badges</li>
                <li>Customer lifetime value tracking</li>
              </ul>
            </div>
          </div>

          <div class="feature-category" data-category="ecommerce">
            <div class="feature-cat-header">
              <div class="feature-cat-icon">🏪</div>
              <div class="feature-cat-info">
                <h3>Etsy & Shopify Integration</h3>
                <p>Connect your online stores and auto-sync orders</p>
              </div>
              <span class="feature-cat-toggle">+</span>
            </div>
            <div class="feature-cat-details">
              <ul>
                <li>Connect Etsy and Shopify stores via OAuth</li>
                <li>Automatic order import — sales appear in ClearCost instantly</li>
                <li>Webhook auto-sync — inventory updates in real time when orders come in</li>
                <li>Product matching by SKU across platforms</li>
                <li>Manual sync option for on-demand order pulls</li>
              </ul>
            </div>
          </div>

          <div class="feature-category" data-category="banking">
            <div class="feature-cat-header">
              <div class="feature-cat-icon">🏦</div>
              <div class="feature-cat-info">
                <h3>Bank & Card Connection</h3>
                <p>Import transactions automatically from your bank accounts and credit cards</p>
              </div>
              <span class="feature-cat-toggle">+</span>
            </div>
            <div class="feature-cat-details">
              <ul>
                <li>Connect bank accounts and credit cards via Plaid</li>
                <li>Automatic transaction import with smart categorization</li>
                <li>Income and expense tracking feeds into your P&amp;L</li>
                <li>Powered by Plaid (same infrastructure as Venmo, Robinhood)</li>
              </ul>
            </div>
          </div>

          <div class="feature-category" data-category="accounting">
            <div class="feature-cat-header">
              <div class="feature-cat-icon">📒</div>
              <div class="feature-cat-info">
                <h3>QuickBooks Sync</h3>
                <p>Two-way sync with QuickBooks Online for seamless accounting</p>
              </div>
              <span class="feature-cat-toggle">+</span>
            </div>
            <div class="feature-cat-details">
              <ul>
                <li>Push products, suppliers, and expenses to QuickBooks</li>
                <li>Pull P&amp;L reports directly from QuickBooks</li>
                <li>OAuth-secured connection</li>
                <li>Keep both systems in sync automatically</li>
              </ul>
            </div>
          </div>

          <div class="feature-category" data-category="shipping">
            <div class="feature-cat-header">
              <div class="feature-cat-icon">📬</div>
              <div class="feature-cat-info">
                <h3>Shipping & Labels</h3>
                <p>Compare rates and generate shipping labels without leaving the app</p>
              </div>
              <span class="feature-cat-toggle">+</span>
            </div>
            <div class="feature-cat-details">
              <ul>
                <li>Rate comparison across USPS, UPS, and FedEx</li>
                <li>Generate shipping labels directly from sales orders</li>
                <li>Tracking number auto-attached to orders</li>
                <li>Powered by EasyPost</li>
              </ul>
            </div>
          </div>

          <div class="feature-category" data-category="team">
            <div class="feature-cat-header">
              <div class="feature-cat-icon">👥</div>
              <div class="feature-cat-info">
                <h3>Team & Permissions</h3>
                <p>Invite team members with role-based access control</p>
              </div>
              <span class="feature-cat-toggle">+</span>
            </div>
            <div class="feature-cat-details">
              <ul>
                <li>Invite members by email</li>
                <li>Four roles: Owner, Manager, Staff, Viewer</li>
                <li>Role-based feature access (staff can't see financials)</li>
                <li>Remove or change roles anytime</li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ── How It Works ── -->
    <section class="landing-section landing-section-alt" id="how-it-works">
      <div class="landing-container">
        <h2 class="landing-section-title">Up and Running in Minutes</h2>
        <div class="landing-steps">
          <div class="landing-step">
            <div class="landing-step-number">1</div>
            <h3>Sign Up in 30 Seconds</h3>
            <p>Pick your business type, name your shop, and you're in. Import existing data via CSV or start fresh.</p>
          </div>
          <div class="landing-step">
            <div class="landing-step-number">2</div>
            <h3>Add Your Products & Costs</h3>
            <p>Enter products, materials, and recipes. Connect your bank, Etsy, or Shopify. Set your expenses.</p>
          </div>
          <div class="landing-step">
            <div class="landing-step-number">3</div>
            <h3>See Your True Profit</h3>
            <p>Instantly see your P&amp;L, COGS per product, break-even point, and which products are most profitable.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Pricing ── -->
    <section class="landing-section" id="pricing">
      <div class="landing-container">
        <h2 class="landing-section-title">Simple, Transparent Pricing</h2>
        <p class="landing-section-sub">Start free. Upgrade when you're ready.</p>
        <div class="landing-pricing-grid">
          <div class="landing-pricing-card">
            <h3>Starter</h3>
            <div class="landing-price">$49<span>/mo</span></div>
            <ul>
              <li>100 products & materials</li>
              <li>Cost tracking & P&L</li>
              <li>CSV bulk import</li>
            </ul>
            <a href="#get-started" class="landing-btn-secondary landing-btn-block">Get Started</a>
          </div>
          <div class="landing-pricing-card landing-pricing-popular">
            <div class="landing-popular-badge">Popular</div>
            <h3>Pro</h3>
            <div class="landing-price">$99<span>/mo</span></div>
            <ul>
              <li>Unlimited everything</li>
              <li>Plaid bank connection</li>
              <li>Full cost analysis</li>
            </ul>
            <a href="#get-started" class="landing-btn-primary landing-btn-block">Start Free Trial</a>
          </div>
          <div class="landing-pricing-card">
            <h3>Business</h3>
            <div class="landing-price">$199<span>/mo</span></div>
            <ul>
              <li>Everything in Pro</li>
              <li>QuickBooks sync</li>
              <li>Advanced analytics</li>
            </ul>
            <a href="#get-started" class="landing-btn-secondary landing-btn-block">Start Free Trial</a>
          </div>
        </div>
      </div>
    </section>

    <!-- ── CTA ── -->
    <section class="landing-section landing-cta-section">
      <div class="landing-container" style="text-align:center;">
        <h2 class="landing-section-title">Ready to Know Your True Profit?</h2>
        <a href="#get-started" class="landing-btn-primary landing-btn-lg">Start Free</a>
      </div>
    </section>

    <!-- ── Get Started (Signup/Login) ── -->
    <section class="landing-section" id="get-started">
      <div class="landing-container" style="max-width:480px;">
        <div class="login-card" style="margin:0 auto;">
          <h2 class="login-brand">ClearCost</h2>
          <p class="login-subtitle">Create your free account</p>

          <div id="signup-form">
            <div class="login-form-group">
              <label>Business Name</label>
              <input type="text" id="signup-biz-name" placeholder="e.g. Stone & Wick Co." />
            </div>
            <div class="login-form-group">
              <label>Email</label>
              <input type="email" id="signup-email" placeholder="you@business.com" />
            </div>
            <div class="login-form-group">
              <label>Password</label>
              <input type="password" id="signup-password" placeholder="Min 6 characters" />
            </div>
            <div class="login-form-group">
              <label>Business Type</label>
              <select id="signup-biz-type">
                <option value="general">General</option>
                <option value="candles">Candles</option>
                <option value="bakery">Bakery</option>
                <option value="retail">Retail</option>
                <option value="crafts">Crafts</option>
              </select>
            </div>
            <div id="signup-error" class="login-error" style="display:none"></div>
            <button class="login-btn login-btn-primary" id="btn-signup">Create Account</button>
            <p class="login-switch">Already have an account? <a href="#" id="show-login">Log In</a></p>
            <p class="login-legal">By signing up, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a></p>
          </div>

          <div id="login-form" style="display:none">
            <div class="login-form-group">
              <label>Email</label>
              <input type="email" id="login-email" placeholder="you@business.com" />
            </div>
            <div class="login-form-group">
              <label>Password</label>
              <input type="password" id="login-password" placeholder="Your password" />
            </div>
            <div id="login-error" class="login-error" style="display:none"></div>
            <button class="login-btn login-btn-primary" id="btn-login">Log In</button>
            <p class="login-switch" style="margin-bottom:8px;">Don't have an account? <a href="#" id="show-signup">Sign Up</a></p>
            <p class="login-switch"><a href="#" id="show-reset">Forgot Password?</a></p>
          </div>

          <div id="reset-form" style="display:none">
            <div class="login-form-group">
              <label>Email</label>
              <input type="email" id="reset-email" placeholder="you@business.com" />
            </div>
            <div id="reset-error" class="login-error" style="display:none"></div>
            <div id="reset-success" style="display:none;background:rgba(126,200,154,0.1);border:1px solid var(--success,#7ec89a);color:var(--success,#7ec89a);padding:8px 12px;border-radius:6px;font-size:0.82rem;margin-bottom:12px;"></div>
            <button class="login-btn login-btn-primary" id="btn-reset">Send Reset Link</button>
            <p class="login-switch"><a href="#" id="show-login-from-reset">Back to Log In</a></p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Footer ── -->
    <footer class="landing-footer">
      <div class="landing-container landing-footer-inner">
        <div class="landing-footer-brand">ClearCost Inventory</div>
        <div class="landing-footer-links">
          <a href="#terms">Terms</a>
          <a href="#privacy">Privacy Policy</a>
        </div>
        <div class="landing-footer-copy">&copy; 2025-2026 ClearCost. All rights reserved.</div>
      </div>
    </footer>
  `;

  document.body.appendChild(overlay);

  // ── Smooth scroll for all anchor links ──
  overlay.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href === '#') return;
      const target = overlay.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        // Close mobile menu if open
        document.getElementById('landing-mobile-menu')?.classList.remove('open');
      }
    });
  });

  // ── Feature category expand/collapse ──
  overlay.querySelectorAll('.feature-cat-header').forEach(header => {
    header.addEventListener('click', () => {
      const category = header.parentElement;
      const isOpen = category.classList.contains('open');
      // Close all others
      overlay.querySelectorAll('.feature-category.open').forEach(c => c.classList.remove('open'));
      // Toggle this one
      if (!isOpen) category.classList.add('open');
    });
  });

  // ── Mobile menu toggle ──
  document.getElementById('landing-mobile-toggle')?.addEventListener('click', () => {
    document.getElementById('landing-mobile-menu')?.classList.toggle('open');
  });

  // ── Nav Log In buttons scroll to get-started and switch to login form ──
  const scrollToLogin = (e) => {
    e.preventDefault();
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('reset-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    const section = overlay.querySelector('#get-started');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('landing-mobile-menu')?.classList.remove('open');
    setTimeout(() => document.getElementById('login-email')?.focus(), 500);
  };
  document.getElementById('nav-login-btn')?.addEventListener('click', scrollToLogin);
  document.getElementById('nav-login-btn-mobile')?.addEventListener('click', scrollToLogin);

  // ── Toggle between login and signup ──
  document.getElementById('show-signup')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('reset-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
  });

  document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('reset-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
  });

  document.getElementById('show-reset')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('reset-form').style.display = 'block';
    document.getElementById('reset-email')?.focus();
  });

  document.getElementById('show-login-from-reset')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('reset-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
  });

  // ── Reset password handler ──
  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim();
    const errorEl = document.getElementById('reset-error');
    const successEl = document.getElementById('reset-success');

    if (!email) {
      errorEl.textContent = 'Please enter your email address';
      errorEl.style.display = 'block';
      successEl.style.display = 'none';
      return;
    }

    try {
      errorEl.style.display = 'none';
      successEl.style.display = 'none';
      document.getElementById('btn-reset').textContent = 'Sending...';
      document.getElementById('btn-reset').disabled = true;

      await resetPassword(email);
      successEl.textContent = 'Password reset link sent! Check your email.';
      successEl.style.display = 'block';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    } finally {
      document.getElementById('btn-reset').textContent = 'Send Reset Link';
      document.getElementById('btn-reset').disabled = false;
    }
  });

  document.getElementById('reset-email')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-reset')?.click();
  });

  // ── Login handler ──
  document.getElementById('btn-login')?.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    if (!email || !password) {
      errorEl.textContent = 'Please enter email and password';
      errorEl.style.display = 'block';
      return;
    }

    try {
      errorEl.style.display = 'none';
      document.getElementById('btn-login').textContent = 'Logging in...';
      document.getElementById('btn-login').disabled = true;

      await signIn(email, password);
      if (onLogin) await onLogin();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      document.getElementById('btn-login').textContent = 'Log In';
      document.getElementById('btn-login').disabled = false;
    }
  });

  // ── Signup handler ──
  document.getElementById('btn-signup')?.addEventListener('click', async () => {
    const bizName = document.getElementById('signup-biz-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const bizType = document.getElementById('signup-biz-type').value;
    const errorEl = document.getElementById('signup-error');

    if (!bizName || !email || !password) {
      errorEl.textContent = 'Please fill in all fields';
      errorEl.style.display = 'block';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorEl.textContent = 'Please enter a valid email address';
      errorEl.style.display = 'block';
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters';
      errorEl.style.display = 'block';
      return;
    }

    try {
      errorEl.style.display = 'none';
      document.getElementById('btn-signup').textContent = 'Creating account...';
      document.getElementById('btn-signup').disabled = true;

      await signUp(email, password, bizName, bizType);
      // Show welcome toast after app loads
      setTimeout(() => {
        toast('Welcome to ClearCost! Follow the getting started guide to set up your business.', 'success', 6000);
      }, 2000);
      // Auto-start tutorial for new users
      setTimeout(() => {
        if (!localStorage.getItem('tutorial_completed')) {
          startTutorial();
        }
      }, 3000);
      if (onLogin) await onLogin();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      document.getElementById('btn-signup').textContent = 'Create Account';
      document.getElementById('btn-signup').disabled = false;
    }
  });

  // ── Enter key handlers ──
  document.getElementById('login-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-login')?.click();
  });
  document.getElementById('signup-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-signup')?.click();
  });
}

// ── Password Reset Page ─────────────────────────────

export function showPasswordResetPage({ onComplete } = {}) {
  // Remove any existing overlays
  document.getElementById('landing-overlay')?.remove();

  // Hide the app completely
  document.querySelector('header')?.setAttribute('style', 'display:none');
  document.querySelector('.app-layout')?.setAttribute('style', 'display:none');
  document.querySelector('.sidebar-toggle')?.setAttribute('style', 'display:none');

  const overlay = document.createElement('div');
  overlay.id = 'landing-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:var(--bg,#0f0d0b);display:flex;align-items:center;justify-content:center;padding:20px;';

  overlay.innerHTML = `
    <div class="login-card">
      <h1 class="login-brand">ClearCost</h1>
      <p class="login-subtitle">Set your new password</p>

      <div class="login-form-group">
        <label>New Password</label>
        <input type="password" id="reset-new-password" placeholder="Min 6 characters" />
      </div>
      <div class="login-form-group">
        <label>Confirm Password</label>
        <input type="password" id="reset-confirm-password" placeholder="Confirm new password" />
      </div>
      <div id="reset-error" class="login-error" style="display:none"></div>
      <div id="reset-success" style="display:none;color:var(--success);text-align:center;padding:12px;font-size:0.9rem;"></div>
      <button class="login-btn login-btn-primary" id="btn-reset-password">Update Password</button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('btn-reset-password')?.addEventListener('click', async () => {
    const newPw = document.getElementById('reset-new-password').value;
    const confirmPw = document.getElementById('reset-confirm-password').value;
    const errorEl = document.getElementById('reset-error');
    const successEl = document.getElementById('reset-success');

    if (!newPw || newPw.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters';
      errorEl.style.display = 'block';
      return;
    }
    if (newPw !== confirmPw) {
      errorEl.textContent = 'Passwords do not match';
      errorEl.style.display = 'block';
      return;
    }

    try {
      errorEl.style.display = 'none';
      document.getElementById('btn-reset-password').textContent = 'Updating...';
      document.getElementById('btn-reset-password').disabled = true;

      await updatePassword(newPw);

      successEl.textContent = 'Password updated! Redirecting to login...';
      successEl.style.display = 'block';
      document.getElementById('btn-reset-password').style.display = 'none';

      // Sign out and redirect to landing page so they log in with new password
      setTimeout(async () => {
        if (onComplete) {
          await onComplete();
        } else {
          await signOut();
          window.location.href = window.location.origin;
        }
      }, 2000);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      document.getElementById('btn-reset-password').textContent = 'Update Password';
      document.getElementById('btn-reset-password').disabled = false;
    }
  });

  document.getElementById('reset-confirm-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-reset-password')?.click();
  });

  setTimeout(() => document.getElementById('reset-new-password')?.focus(), 100);
}
