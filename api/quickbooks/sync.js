// Consolidated QuickBooks Sync API — single serverless function
// Routes by ?action= query parameter:
//   POST ?action=products   — Sync products to QuickBooks Items
//   POST ?action=suppliers  — Sync suppliers to QuickBooks Vendors
//   POST ?action=expenses   — Sync expenses to QuickBooks Purchases
//   GET  ?action=accounts   — Fetch Chart of Accounts
//   GET  ?action=report     — Fetch P&L report

const { authenticate } = require('../_lib/auth');
const {
  getQBClient, qbPromise, setIdMapping, getQboId, setLastSync, ensureValidToken,
} = require('../_lib/quickbooks-client');

const QBO_ENV = (process.env.QUICKBOOKS_ENV || '').trim() || 'sandbox';
const BASE_URL = QBO_ENV === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';
const SITE_URL = (process.env.SITE_URL || '').trim();

function setCors(res) {
  if (SITE_URL) {
    res.setHeader('Access-Control-Allow-Origin', SITE_URL);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}

module.exports = async (req, res) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    setCors(res);
    return res.status(204).end();
  }

  setCors(res);

  // Authenticate every request
  let businessId;
  try {
    const auth = await authenticate(req);
    businessId = auth.businessId;
  } catch (error) {
    return res.status(error.status || 401).json({ error: error.message });
  }

  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'products':
      return handleSyncProducts(req, res, businessId);
    case 'suppliers':
      return handleSyncSuppliers(req, res, businessId);
    case 'expenses':
      return handleSyncExpenses(req, res, businessId);
    case 'accounts':
      return handleFetchAccounts(req, res, businessId);
    case 'report':
      return handleFetchReport(req, res, businessId);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
};

// ── sync-products ──────────────────────────────────────

async function handleSyncProducts(req, res, businessId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { products } = req.body;
  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ error: 'Missing products array' });
  }

  try {
    const qbo = await getQBClient(businessId);
    const results = { created: 0, updated: 0, errors: [] };

    // Get income account for sales (needed for QBO Items)
    let incomeAccountRef = null;
    let expenseAccountRef = null;
    try {
      const accounts = await qbPromise(qbo, 'findAccounts', [
        { field: 'AccountType', value: 'Income', operator: '=' },
      ]);
      if (accounts?.QueryResponse?.Account?.length) {
        incomeAccountRef = { value: accounts.QueryResponse.Account[0].Id };
      }
      const expAccounts = await qbPromise(qbo, 'findAccounts', [
        { field: 'AccountType', value: 'Cost of Goods Sold', operator: '=' },
      ]);
      if (expAccounts?.QueryResponse?.Account?.length) {
        expenseAccountRef = { value: expAccounts.QueryResponse.Account[0].Id };
      }
    } catch (e) {
      // Use defaults if account lookup fails
    }

    for (const product of products) {
      try {
        const qboId = await getQboId(businessId, 'product', product.id);

        const itemData = {
          Name: (product.name || 'Unnamed').substring(0, 100),
          Type: 'Inventory',
          TrackQtyOnHand: true,
          QtyOnHand: product.quantity || 0,
          InvStartDate: new Date().toISOString().split('T')[0],
        };

        if (product.sku) itemData.Sku = product.sku;
        if (product.sellPrice) itemData.UnitPrice = product.sellPrice;
        if (product.costOverride) itemData.PurchaseCost = product.costOverride;
        if (incomeAccountRef) itemData.IncomeAccountRef = incomeAccountRef;
        if (expenseAccountRef) {
          itemData.ExpenseAccountRef = expenseAccountRef;
          itemData.AssetAccountRef = expenseAccountRef; // simplified
        }

        if (qboId) {
          // Update existing
          itemData.Id = qboId;
          itemData.sparse = true;
          // Need SyncToken for updates
          try {
            const existing = await qbPromise(qbo, 'getItem', qboId);
            itemData.SyncToken = existing.SyncToken;
            await qbPromise(qbo, 'updateItem', itemData);
            results.updated++;
          } catch (e) {
            // If get fails, try creating instead
            delete itemData.Id;
            delete itemData.SyncToken;
            delete itemData.sparse;
            const created = await qbPromise(qbo, 'createItem', itemData);
            await setIdMapping(businessId, 'product', product.id, created.Id);
            results.created++;
          }
        } else {
          // Create new
          const created = await qbPromise(qbo, 'createItem', itemData);
          await setIdMapping(businessId, 'product', product.id, created.Id);
          results.created++;
        }
      } catch (err) {
        results.errors.push({
          productId: product.id,
          name: product.name,
          error: err.Fault?.Error?.[0]?.Detail || err.message || 'Unknown error',
        });
      }
    }

    await setLastSync(businessId, 'products');
    return res.status(200).json(results);
  } catch (error) {
    console.error('Sync products error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

// ── sync-suppliers ─────────────────────────────────────

async function handleSyncSuppliers(req, res, businessId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { suppliers } = req.body;
  if (!suppliers || !Array.isArray(suppliers)) {
    return res.status(400).json({ error: 'Missing suppliers array' });
  }

  try {
    const qbo = await getQBClient(businessId);
    const results = { created: 0, updated: 0, errors: [] };

    for (const supplier of suppliers) {
      try {
        const qboId = await getQboId(businessId, 'supplier', supplier.id);

        // Parse contact name into first/last
        const nameParts = (supplier.contactName || '').split(' ');
        const givenName = nameParts[0] || '';
        const familyName = nameParts.slice(1).join(' ') || '';

        const vendorData = {
          DisplayName: (supplier.name || 'Unnamed Supplier').substring(0, 100),
        };

        if (givenName) vendorData.GivenName = givenName;
        if (familyName) vendorData.FamilyName = familyName;
        if (supplier.email) vendorData.PrimaryEmailAddr = { Address: supplier.email };
        if (supplier.phone) vendorData.PrimaryPhone = { FreeFormNumber: supplier.phone };
        if (supplier.website) vendorData.WebAddr = { URI: supplier.website };
        if (supplier.address) {
          vendorData.BillAddr = { Line1: supplier.address };
        }
        if (supplier.notes) vendorData.Notes = supplier.notes.substring(0, 4000);

        if (qboId) {
          vendorData.Id = qboId;
          vendorData.sparse = true;
          try {
            const existing = await qbPromise(qbo, 'getVendor', qboId);
            vendorData.SyncToken = existing.SyncToken;
            await qbPromise(qbo, 'updateVendor', vendorData);
            results.updated++;
          } catch (e) {
            delete vendorData.Id;
            delete vendorData.SyncToken;
            delete vendorData.sparse;
            const created = await qbPromise(qbo, 'createVendor', vendorData);
            await setIdMapping(businessId, 'supplier', supplier.id, created.Id);
            results.created++;
          }
        } else {
          const created = await qbPromise(qbo, 'createVendor', vendorData);
          await setIdMapping(businessId, 'supplier', supplier.id, created.Id);
          results.created++;
        }
      } catch (err) {
        results.errors.push({
          supplierId: supplier.id,
          name: supplier.name,
          error: err.Fault?.Error?.[0]?.Detail || err.message || 'Unknown error',
        });
      }
    }

    await setLastSync(businessId, 'suppliers');
    return res.status(200).json(results);
  } catch (error) {
    console.error('Sync suppliers error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

// ── sync-expenses ──────────────────────────────────────

// Map app expense categories to QBO account types
const CATEGORY_ACCOUNT_MAP = {
  rent: 'Rent or Lease',
  insurance: 'Insurance',
  utilities: 'Utilities',
  labor: 'Payroll Expenses',
  equipment: 'Equipment Rental',
  marketing: 'Advertising',
  packaging: 'Cost of Goods Sold',
  subscription: 'Office Expenses',
  shipping: 'Shipping and delivery expense',
  commission: 'Commissions & fees',
  other: 'Miscellaneous Expense',
};

async function handleSyncExpenses(req, res, businessId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { expenses } = req.body;
  if (!expenses || !Array.isArray(expenses)) {
    return res.status(400).json({ error: 'Missing expenses array' });
  }

  try {
    const qbo = await getQBClient(businessId);
    const results = { created: 0, errors: [] };

    // Fetch available expense accounts
    let accountMap = {};
    try {
      const accounts = await qbPromise(qbo, 'findAccounts', [
        { field: 'Classification', value: 'Expense', operator: '=' },
      ]);
      if (accounts?.QueryResponse?.Account) {
        for (const acct of accounts.QueryResponse.Account) {
          accountMap[acct.Name.toLowerCase()] = acct.Id;
        }
      }
    } catch (e) {
      console.warn('Could not fetch accounts, using defaults');
    }

    // Find a bank account to use as payment source
    let bankAccountRef = null;
    try {
      const bankAccounts = await qbPromise(qbo, 'findAccounts', [
        { field: 'AccountType', value: 'Bank', operator: '=' },
      ]);
      if (bankAccounts?.QueryResponse?.Account?.length) {
        bankAccountRef = { value: bankAccounts.QueryResponse.Account[0].Id };
      }
    } catch (e) {
      // Will fail if no bank account, but we try
    }

    for (const expense of expenses) {
      // Only sync fixed expenses (variable costs are per-unit, not standalone transactions)
      if (expense.costType && expense.costType !== 'fixed') continue;

      try {
        // Find matching QBO account
        const categoryName = CATEGORY_ACCOUNT_MAP[expense.category] || 'Miscellaneous Expense';
        let accountRef = null;

        // Try exact match first, then partial
        for (const [name, id] of Object.entries(accountMap)) {
          if (name.includes(categoryName.toLowerCase()) || categoryName.toLowerCase().includes(name)) {
            accountRef = { value: id };
            break;
          }
        }

        // Fallback: use first expense account
        if (!accountRef && Object.keys(accountMap).length > 0) {
          accountRef = { value: Object.values(accountMap)[0] };
        }

        const purchaseData = {
          PaymentType: 'Cash',
          Line: [{
            Amount: expense.amount,
            DetailType: 'AccountBasedExpenseLineDetail',
            AccountBasedExpenseLineDetail: {
              AccountRef: accountRef || { value: '1' },
            },
            Description: `${expense.name} (${expense.frequency})`,
          }],
          TxnDate: new Date().toISOString().split('T')[0],
        };

        if (bankAccountRef) {
          purchaseData.AccountRef = bankAccountRef;
        }

        await qbPromise(qbo, 'createPurchase', purchaseData);
        results.created++;
      } catch (err) {
        results.errors.push({
          expenseId: expense.id,
          name: expense.name,
          error: err.Fault?.Error?.[0]?.Detail || err.message || 'Unknown error',
        });
      }
    }

    await setLastSync(businessId, 'expenses');
    return res.status(200).json(results);
  } catch (error) {
    console.error('Sync expenses error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

// ── fetch-accounts ─────────────────────────────────────

async function handleFetchAccounts(req, res, businessId) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const qbo = await getQBClient(businessId);
    const result = await qbPromise(qbo, 'findAccounts', {});

    const accounts = (result?.QueryResponse?.Account || []).map(acct => ({
      id: acct.Id,
      name: acct.Name,
      type: acct.AccountType,
      subType: acct.AccountSubType,
      classification: acct.Classification,
      balance: acct.CurrentBalance,
      active: acct.Active,
    }));

    return res.status(200).json({ accounts });
  } catch (error) {
    console.error('Fetch accounts error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

// ── fetch-report ───────────────────────────────────────

async function handleFetchReport(req, res, businessId) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { access_token, realm_id } = await ensureValidToken(businessId);

    // Date range: default to current month, or use query params
    const now = new Date();
    const startDate = req.query.start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = req.query.end_date || now.toISOString().split('T')[0];

    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    const url = `${BASE_URL}/v3/company/${realm_id}/reports/ProfitAndLoss?${params}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`QBO API error: ${response.status} ${err}`);
    }

    const report = await response.json();

    // Parse the QBO report format into something simpler
    const parsed = parseQBOReport(report);

    return res.status(200).json({
      report: parsed,
      period: { start_date: startDate, end_date: endDate },
      raw: report, // include raw for debugging
    });
  } catch (error) {
    console.error('Fetch report error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

function parseQBOReport(report) {
  const result = {
    title: report.Header?.ReportName || 'Profit and Loss',
    period: report.Header?.StartPeriod + ' to ' + report.Header?.EndPeriod,
    income: { total: 0, items: [] },
    cogs: { total: 0, items: [] },
    expenses: { total: 0, items: [] },
    grossProfit: 0,
    netIncome: 0,
  };

  if (!report.Rows?.Row) return result;

  for (const section of report.Rows.Row) {
    const sectionName = section.group || '';
    const summary = section.Summary?.ColData?.[1]?.value || '0';

    if (sectionName === 'Income') {
      result.income.total = parseFloat(summary) || 0;
      if (section.Rows?.Row) {
        result.income.items = section.Rows.Row
          .filter(r => r.ColData)
          .map(r => ({
            name: r.ColData[0]?.value || '',
            amount: parseFloat(r.ColData[1]?.value) || 0,
          }));
      }
    } else if (sectionName === 'COGS') {
      result.cogs.total = parseFloat(summary) || 0;
      if (section.Rows?.Row) {
        result.cogs.items = section.Rows.Row
          .filter(r => r.ColData)
          .map(r => ({
            name: r.ColData[0]?.value || '',
            amount: parseFloat(r.ColData[1]?.value) || 0,
          }));
      }
    } else if (sectionName === 'Expenses') {
      result.expenses.total = parseFloat(summary) || 0;
      if (section.Rows?.Row) {
        result.expenses.items = section.Rows.Row
          .filter(r => r.ColData)
          .map(r => ({
            name: r.ColData[0]?.value || '',
            amount: parseFloat(r.ColData[1]?.value) || 0,
          }));
      }
    } else if (sectionName === 'GrossProfit') {
      result.grossProfit = parseFloat(summary) || 0;
    } else if (sectionName === 'NetIncome') {
      result.netIncome = parseFloat(summary) || 0;
    }
  }

  return result;
}
