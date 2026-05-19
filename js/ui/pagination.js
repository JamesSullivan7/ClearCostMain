export function renderPagination({ totalItems, currentPage, pageSize = 50, onPageChange }) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return '';

  let html = '<div class="pagination">';
  html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">&laquo; Prev</button>`;

  // Show max 5 page numbers
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Next &raquo;</button>`;
  html += `<span class="page-info">${totalItems} items</span>`;
  html += '</div>';
  return html;
}

export function paginate(items, page, pageSize = 50) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
