// ── Modal System ─────────────────────────────────────

export function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

export function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => {
    m.classList.remove('open');
  });
}

// Generic form modal builder
export function showFormModal({ title, fields, onSubmit, onCancel, submitLabel = 'Save', dangerSubmit = false, customBody = '', id = 'modal-dynamic' }) {
  // Remove existing dynamic modal
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = id;

  const fieldsHtml = fields.map(f => {
    let input = '';
    if (f.type === 'textarea') {
      input = `<textarea id="${f.id}" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>`;
    } else if (f.type === 'select') {
      input = `<select id="${f.id}">${f.options.map(o =>
        `<option value="${esc(o.value)}" ${o.value === f.value ? 'selected' : ''}>${esc(o.label)}</option>`
      ).join('')}</select>`;
    } else if (f.type === 'file') {
      input = `<input type="file" id="${f.id}" accept="${f.accept || 'image/*'}" />`;
    } else {
      input = `<input type="${f.type || 'text'}" id="${f.id}" value="${esc(f.value || '')}"
        placeholder="${esc(f.placeholder || '')}" ${f.min !== undefined ? `min="${f.min}"` : ''}
        ${f.max !== undefined ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''} />`;
    }
    return `<div class="form-group">
      <label>${esc(f.label)}${f.required ? ' *' : ''}</label>
      ${input}
    </div>`;
  }).join('');

  const submitBtnClass = dangerSubmit ? 'btn-confirm btn-danger' : 'btn-confirm';

  overlay.innerHTML = `
    <div class="modal">
      <h2>${esc(title)}</h2>
      ${customBody || fieldsHtml}
      <div class="modal-actions">
        <button class="btn-cancel" data-action="cancel">Cancel</button>
        <button class="${submitBtnClass}" data-action="submit">${esc(submitLabel)}</button>
      </div>
    </div>
  `;

  const dismiss = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.dataset.action === 'cancel') {
      dismiss();
    }
    if (e.target.dataset.action === 'submit') {
      const values = {};
      for (const f of fields) {
        const el = document.getElementById(f.id);
        if (!el) continue;
        if (f.type === 'number') values[f.id] = parseFloat(el.value) || 0;
        else if (f.type === 'file') values[f.id] = el.files?.[0] || null;
        else if (f.type === 'checkbox') values[f.id] = el.checked;
        else values[f.id] = el.value.trim();
      }
      const result = onSubmit(values);
      // Support both sync and async onSubmit
      if (result && typeof result.then === 'function') {
        result.then(r => { if (r !== false) overlay.remove(); });
      } else if (result !== false) {
        overlay.remove();
      }
    }
  });

  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape' && document.getElementById(id)) {
      dismiss();
      document.removeEventListener('keydown', handler);
    }
  });

  document.body.appendChild(overlay);

  // Conditional field visibility (dependsOn)
  for (const f of fields) {
    if (f.dependsOn) {
      const controlEl = document.getElementById(f.dependsOn.field);
      const groupEl = document.getElementById(f.id)?.closest('.form-group');
      if (controlEl && groupEl) {
        const toggle = () => {
          const show = f.dependsOn.values.includes(controlEl.value);
          groupEl.style.display = show ? '' : 'none';
        };
        controlEl.addEventListener('change', toggle);
        toggle(); // set initial state
      }
    }
  }

  // Focus first input
  const firstInput = overlay.querySelector('input, textarea, select');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);

  return overlay;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export { esc as escHtml };

// ── Confirm / Prompt Modals ─────────────────────────

export function showConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    showFormModal({
      title,
      fields: [],
      id: 'modal-confirm',
      submitLabel: confirmLabel,
      dangerSubmit: danger,
      customBody: `<p style="color:var(--text);margin:0;line-height:1.5;white-space:pre-line;">${message}</p>`,
      onSubmit() { resolve(true); },
      onCancel() { resolve(false); },
    });
  });
}

export function showPromptModal({ title, message, placeholder = '', defaultValue = '' }) {
  return new Promise(resolve => {
    showFormModal({
      title,
      fields: [{ id: '_prompt_value', label: message, type: 'text', placeholder, value: defaultValue }],
      id: 'modal-prompt',
      submitLabel: 'OK',
      onSubmit(vals) { resolve(vals['_prompt_value'] || ''); },
      onCancel() { resolve(null); },
    });
  });
}
