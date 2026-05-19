// ── Undo Service ── Simple in-memory undo stack ──────────────

const MAX_UNDO = 20;
const stack = [];

export function pushUndo({ label, undo }) {
  stack.push({ label, undo, timestamp: Date.now() });
  if (stack.length > MAX_UNDO) stack.shift();
  updateUI();
}

export function popUndo() {
  const entry = stack.pop();
  if (entry) {
    entry.undo();
    updateUI();
  }
  return entry;
}

export function canUndo() { return stack.length > 0; }
export function getLastLabel() { return stack.length > 0 ? stack[stack.length - 1].label : null; }

function updateUI() {
  const btn = document.getElementById('undo-btn');
  if (btn) {
    btn.style.display = stack.length > 0 ? '' : 'none';
    btn.title = stack.length > 0 ? `Undo: ${stack[stack.length - 1].label}` : '';
  }
}
