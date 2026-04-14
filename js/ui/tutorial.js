// ── Interactive Tutorial Overlay ───────────────────────
// Multi-step guided tour for new users.

const TUTORIAL_STEPS = [
  {
    title: 'Welcome to ClearCost!',
    description: 'Let\'s take a quick tour of your new business management platform. This will only take 2 minutes.',
    target: null,
    position: 'center',
  },
  {
    title: 'Sidebar Navigation',
    description: 'Use the sidebar to navigate between different sections of your business. Let\'s start with the most important ones.',
    target: '.sidebar',
    position: 'right',
  },
  {
    title: 'Inventory',
    description: 'This is where you manage your products. Add items you sell, track quantities, and set sell prices. Click "+ Add" to create your first product.',
    target: '[data-tab="inventory"]',
    position: 'right',
    action: () => { window.location.hash = '#inventory'; },
  },
  {
    title: 'Materials',
    description: 'Track your raw materials here. Add ingredients, packaging, and supplies with their costs. This feeds into your cost analysis.',
    target: '[data-tab="materials"]',
    position: 'right',
  },
  {
    title: 'Recipes',
    description: 'Link materials to products. Define exactly how much of each material goes into each product. This calculates your true cost per unit.',
    target: '[data-tab="recipes"]',
    position: 'right',
  },
  {
    title: 'Cost Analysis',
    description: 'See your P&L, COGS per product, break-even analysis, and true profit margins. This is where ClearCost shines \u2014 no other tool gives you this level of cost visibility.',
    target: '[data-tab="costs"]',
    position: 'right',
    action: () => { window.location.hash = '#costs'; },
  },
  {
    title: 'Expenses',
    description: 'Track fixed costs (rent, insurance) and variable costs (shipping per unit, marketplace fees). These get allocated to your product costs automatically.',
    target: '[data-tab="expenses"]',
    position: 'right',
  },
  {
    title: 'Transactions',
    description: 'Log income and expenses manually, or connect your bank account to import them automatically via Plaid.',
    target: '[data-tab="transactions"]',
    position: 'right',
  },
  {
    title: 'Customers & Sales',
    description: 'Manage your customer database and create sales orders. Track order status from draft to paid.',
    target: '[data-tab="customers"]',
    position: 'right',
  },
  {
    title: 'Barcode Scanning',
    description: 'Use the Scan button on the Inventory page to scan product barcodes with your phone camera for quick lookups and restocking.',
    target: '[data-action="scan-barcode"]',
    position: 'bottom',
    action: () => { window.location.hash = '#inventory'; },
  },
  {
    title: 'CSV Import',
    description: 'Got existing data in a spreadsheet? Use Import CSV to bulk-upload products, materials, and recipes.',
    target: '[data-action="import-products-csv"]',
    position: 'bottom',
  },
  {
    title: 'Settings & Integrations',
    description: 'Connect Etsy, Shopify, QuickBooks, and bank accounts in Settings. Customize your theme and manage your team.',
    target: '[data-tab="settings"]',
    position: 'right',
    action: () => { window.location.hash = '#settings'; },
  },
  {
    title: 'You\'re All Set!',
    description: 'Start by adding your products and materials. ClearCost will handle the rest \u2014 calculating costs, tracking inventory, and showing you exactly where your money goes.',
    target: null,
    position: 'center',
  },
];

let currentStep = 0;
let tutorialActive = false;
let overlayEl = null;
let highlightEl = null;
let tooltipEl = null;

export function startTutorial() {
  if (tutorialActive) return;
  tutorialActive = true;
  currentStep = 0;
  createOverlay();
  renderStep(currentStep);
}

export function nextStep() {
  if (currentStep < TUTORIAL_STEPS.length - 1) {
    currentStep++;
    renderStep(currentStep);
  } else {
    endTutorial();
  }
}

export function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    renderStep(currentStep);
  }
}

export function endTutorial() {
  tutorialActive = false;
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
    highlightEl = null;
    tooltipEl = null;
  }
  localStorage.setItem('tutorial_completed', 'true');
  // Navigate back to dashboard
  window.location.hash = '#dashboard';
}

function createOverlay() {
  // Remove existing overlay if any
  document.getElementById('tutorial-overlay')?.remove();

  overlayEl = document.createElement('div');
  overlayEl.className = 'tutorial-overlay';
  overlayEl.id = 'tutorial-overlay';

  highlightEl = document.createElement('div');
  highlightEl.className = 'tutorial-highlight';
  highlightEl.id = 'tutorial-highlight';
  highlightEl.style.display = 'none';

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tutorial-tooltip';
  tooltipEl.id = 'tutorial-tooltip';

  overlayEl.appendChild(highlightEl);
  overlayEl.appendChild(tooltipEl);
  document.body.appendChild(overlayEl);

  // Click on overlay outside tooltip = skip
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) {
      endTutorial();
    }
  });
}

function renderStep(stepIndex) {
  const step = TUTORIAL_STEPS[stepIndex];
  if (!step) return;

  // Execute step action (e.g., navigate to page)
  if (step.action) {
    step.action();
    // Small delay to let page render before positioning
    setTimeout(() => positionStep(step, stepIndex), 200);
  } else {
    positionStep(step, stepIndex);
  }
}

function positionStep(step, stepIndex) {
  const total = TUTORIAL_STEPS.length;
  const isCenter = step.position === 'center' || !step.target;

  // Build dots HTML
  let dotsHtml = '';
  for (let i = 0; i < total; i++) {
    dotsHtml += `<div class="tutorial-dot ${i === stepIndex ? 'active' : ''}"></div>`;
  }

  // Build tooltip content
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  tooltipEl.innerHTML = `
    <div class="tutorial-step-num">Step ${stepIndex + 1} of ${total}</div>
    <h3 class="tutorial-title">${step.title}</h3>
    <p class="tutorial-desc">${step.description}</p>
    <div class="tutorial-actions">
      <button class="tutorial-btn-skip" id="tutorial-skip">${isLast ? '' : 'Skip Tutorial'}</button>
      <div>
        ${!isFirst ? '<button class="tutorial-btn-prev" id="tutorial-prev">Previous</button>' : ''}
        <button class="tutorial-btn-next" id="tutorial-next">${isLast ? 'Get Started' : isFirst ? 'Start Tour' : 'Next'}</button>
      </div>
    </div>
    <div class="tutorial-dots">${dotsHtml}</div>
  `;

  // Attach event listeners
  document.getElementById('tutorial-skip')?.addEventListener('click', endTutorial);
  document.getElementById('tutorial-prev')?.addEventListener('click', prevStep);
  document.getElementById('tutorial-next')?.addEventListener('click', nextStep);

  if (isCenter) {
    // Center the tooltip, hide highlight
    highlightEl.style.display = 'none';
    tooltipEl.className = 'tutorial-tooltip center';
    tooltipEl.style.top = '';
    tooltipEl.style.left = '';
    tooltipEl.style.right = '';
    tooltipEl.style.bottom = '';
    // Reset overlay to full dark
    overlayEl.style.background = 'rgba(0,0,0,0.75)';
  } else {
    // Position highlight over target element
    overlayEl.style.background = 'transparent';
    const targetEl = document.querySelector(step.target);

    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const pad = 6;

      highlightEl.style.display = 'block';
      highlightEl.style.top = (rect.top - pad) + 'px';
      highlightEl.style.left = (rect.left - pad) + 'px';
      highlightEl.style.width = (rect.width + pad * 2) + 'px';
      highlightEl.style.height = (rect.height + pad * 2) + 'px';

      // Position tooltip relative to target
      tooltipEl.className = 'tutorial-tooltip';
      positionTooltip(rect, step.position);
    } else {
      // Target not found — fallback to center
      highlightEl.style.display = 'none';
      tooltipEl.className = 'tutorial-tooltip center';
      overlayEl.style.background = 'rgba(0,0,0,0.75)';
    }
  }
}

function positionTooltip(targetRect, position) {
  const gap = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Reset inline positioning
  tooltipEl.style.top = '';
  tooltipEl.style.left = '';
  tooltipEl.style.right = '';
  tooltipEl.style.bottom = '';
  tooltipEl.style.transform = '';

  switch (position) {
    case 'right': {
      let topPos = targetRect.top;
      let leftPos = targetRect.right + gap;
      // If tooltip would overflow right side, put it on the left
      if (leftPos + 380 > vw) {
        leftPos = Math.max(8, targetRect.left - 380 - gap);
      }
      // Clamp vertically
      if (topPos + 300 > vh) {
        topPos = Math.max(8, vh - 320);
      }
      tooltipEl.style.top = topPos + 'px';
      tooltipEl.style.left = leftPos + 'px';
      break;
    }
    case 'bottom': {
      let topPos = targetRect.bottom + gap;
      let leftPos = targetRect.left;
      // Clamp horizontally
      if (leftPos + 380 > vw) {
        leftPos = Math.max(8, vw - 390);
      }
      // If it would overflow bottom, put above
      if (topPos + 250 > vh) {
        topPos = Math.max(8, targetRect.top - 270);
      }
      tooltipEl.style.top = topPos + 'px';
      tooltipEl.style.left = leftPos + 'px';
      break;
    }
    case 'left': {
      let topPos = targetRect.top;
      let leftPos = Math.max(8, targetRect.left - 380 - gap);
      tooltipEl.style.top = topPos + 'px';
      tooltipEl.style.left = leftPos + 'px';
      break;
    }
    case 'top': {
      let topPos = Math.max(8, targetRect.top - 270);
      let leftPos = targetRect.left;
      if (leftPos + 380 > vw) {
        leftPos = Math.max(8, vw - 390);
      }
      tooltipEl.style.top = topPos + 'px';
      tooltipEl.style.left = leftPos + 'px';
      break;
    }
    default: {
      tooltipEl.style.top = targetRect.bottom + gap + 'px';
      tooltipEl.style.left = targetRect.left + 'px';
    }
  }
}
