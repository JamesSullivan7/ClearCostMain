// ── CSV Bulk Import Service ──────────────────────────

// ── Template Generators ─────────────────────────────

export function getProductTemplate() {
  return [
    'Name,Quantity,Sell Price,SKU,Low Threshold,Note',
    'Lavender Candle,50,28.00,LC-001,10,Best seller',
    'Vanilla Candle,30,28.00,VC-001,10,',
  ].join('\n');
}

export function getMaterialTemplate() {
  return [
    'Name,Category,Unit,Quantity,Cost Per Unit,Low Threshold,Note',
    'Soy Wax,raw,lbs,100,2.85,50,Golden Brands 464',
    'Lavender FO,fragrance,oz,32,1.85,16,',
  ].join('\n');
}

export function getRecipeTemplate() {
  return [
    'Recipe Name,Product Name,Material Name,Qty Per Unit,Unit',
    'Lavender Candle Recipe,Lavender Candle,Soy Wax,8,oz',
    'Lavender Candle Recipe,Lavender Candle,Lavender FO,1,oz',
  ].join('\n');
}

// ── CSV Parser ──────────────────────────────────────

export function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.every(v => v === '')) continue; // skip blank rows
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (values[idx] || '').trim();
    });
    records.push(obj);
  }

  return records;
}

function parseLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

// ── Importers ───────────────────────────────────────

export async function importProducts(records, addProduct) {
  let imported = 0;
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    try {
      const name = r['Name'];
      if (!name) throw new Error('Name is required');

      await addProduct({
        name,
        quantity: parseFloat(r['Quantity']) || 0,
        sellPrice: r['Sell Price'] ? parseFloat(r['Sell Price']) : null,
        sku: r['SKU'] || '',
        lowThreshold: r['Low Threshold'] ? parseInt(r['Low Threshold'], 10) : null,
        note: r['Note'] || '',
      });
      imported++;
    } catch (err) {
      errors.push({ row: i + 2, error: err.message || String(err) });
    }
  }

  return { imported, errors };
}

export async function importMaterials(records, addMaterial) {
  let imported = 0;
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    try {
      const name = r['Name'];
      if (!name) throw new Error('Name is required');

      await addMaterial({
        name,
        category: r['Category'] || 'raw',
        unit: r['Unit'] || 'units',
        quantity: parseFloat(r['Quantity']) || 0,
        costPerUnit: r['Cost Per Unit'] ? parseFloat(r['Cost Per Unit']) : null,
        lowThreshold: r['Low Threshold'] ? parseInt(r['Low Threshold'], 10) : 50,
        note: r['Note'] || '',
      });
      imported++;
    } catch (err) {
      errors.push({ row: i + 2, error: err.message || String(err) });
    }
  }

  return { imported, errors };
}

export async function importRecipes(records, addRecipe, allProducts, allMaterials) {
  let imported = 0;
  const errors = [];

  // Group rows by recipe name
  const grouped = new Map();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const recipeName = r['Recipe Name'];
    if (!recipeName) {
      errors.push({ row: i + 2, error: 'Recipe Name is required' });
      continue;
    }
    if (!grouped.has(recipeName)) {
      grouped.set(recipeName, { productName: r['Product Name'], ingredients: [], rows: [] });
    }
    grouped.get(recipeName).ingredients.push(r);
    grouped.get(recipeName).rows.push(i + 2);
  }

  for (const [recipeName, data] of grouped) {
    try {
      // Resolve product
      let productId = null;
      if (data.productName) {
        const prod = allProducts.find(
          p => p.name.toLowerCase() === data.productName.toLowerCase()
        );
        if (!prod) throw new Error(`Product "${data.productName}" not found`);
        productId = prod.id;
      }

      // Resolve ingredients
      const ingredients = [];
      for (const ing of data.ingredients) {
        const matName = ing['Material Name'];
        if (!matName) throw new Error('Material Name is required for each ingredient row');
        const mat = allMaterials.find(
          m => m.name.toLowerCase() === matName.toLowerCase()
        );
        if (!mat) throw new Error(`Material "${matName}" not found`);

        ingredients.push({
          materialId: mat.id,
          quantity: parseFloat(ing['Qty Per Unit']) || 0,
          unit: ing['Unit'] || mat.unit || 'units',
        });
      }

      await addRecipe({
        name: recipeName,
        productId,
        ingredients,
        yieldQty: 1,
        notes: '',
      });
      imported++;
    } catch (err) {
      errors.push({ row: data.rows[0], error: err.message || String(err) });
    }
  }

  return { imported, errors };
}

// ── Download Helper ─────────────────────────────────

export function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
