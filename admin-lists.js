(() => {
  'use strict';

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const controllers = new Map();

  document.querySelectorAll('[data-admin-list]').forEach((list) => {
    const rows = [...list.querySelectorAll('tbody tr')].filter((row) => row.dataset.search || row.textContent);
    const search = list.querySelector('[data-list-search]');
    const filters = [...list.querySelectorAll('[data-list-filter]')];
    const counter = list.querySelector('[data-visible-count]');
    const empty = list.querySelector('[data-filter-empty]');
    const pagination = list.querySelector('[data-list-pagination]');
    const paginationPages = pagination?.querySelector('[data-pagination-pages]');
    const previous = pagination?.querySelector('[data-page-previous]');
    const next = pagination?.querySelector('[data-page-next]');
    const pageSize = Math.max(1, Number(list.dataset.pageSize || 8));
    let currentPage = 1;

    const matchingRows = () => {
      const query = normalize(search?.value);
      return rows.filter((row) => {
        const rowText = normalize(row.dataset.search || row.textContent || '');
        const matchesSearch = !query || rowText.includes(query);
        const matchesFilters = filters.every((filter) => {
          const filterName = filter.dataset.listFilter;
          const selectedValue = String(filter.value || '');
          if (!selectedValue) return true;
          const rowValue = String(row.dataset[filterName] || '').trim().toLowerCase();
          return rowValue === selectedValue.toLowerCase();
        });
        return matchesSearch && matchesFilters && row.isConnected;
      });
    };

    const pageButton = (page, active = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-page-number';
      button.textContent = String(page);
      button.setAttribute('aria-label', `Page ${page}`);
      if (active) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => {
        currentPage = page;
        refresh();
        list.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return button;
    };

    const renderPagination = (totalPages) => {
      if (!pagination || !paginationPages || !previous || !next) return;
      pagination.hidden = false;
      previous.disabled = currentPage <= 1;
      next.disabled = currentPage >= totalPages;
      paginationPages.replaceChildren();

      const pages = totalPages <= 5
        ? Array.from({ length: totalPages }, (_, index) => index + 1)
        : [...new Set([1, Math.max(2, currentPage - 1), currentPage, Math.min(totalPages - 1, currentPage + 1), totalPages])].sort((a, b) => a - b);

      pages.forEach((page, index) => {
        if (index && page - pages[index - 1] > 1) {
          const ellipsis = document.createElement('span');
          ellipsis.className = 'admin-page-ellipsis';
          ellipsis.textContent = '…';
          paginationPages.append(ellipsis);
        }
        paginationPages.append(pageButton(page, page === currentPage));
      });
    };

    const refresh = (resetPage = false) => {
      if (resetPage) currentPage = 1;
      const matches = matchingRows();
      const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
      currentPage = Math.min(currentPage, totalPages);
      const start = (currentPage - 1) * pageSize;
      const displayed = new Set(matches.slice(start, start + pageSize));

      rows.forEach((row) => { row.hidden = !displayed.has(row); });
      if (counter) counter.textContent = String(matches.length);
      if (empty) empty.hidden = matches.length !== 0;
      renderPagination(totalPages);
    };

    search?.addEventListener('input', () => refresh(true));
    filters.forEach((filter) => filter.addEventListener('change', () => refresh(true)));
    previous?.addEventListener('click', () => { if (currentPage > 1) { currentPage -= 1; refresh(); } });
    next?.addEventListener('click', () => { if (currentPage < Math.max(1, Math.ceil(matchingRows().length / pageSize))) { currentPage += 1; refresh(); } });

    rows.forEach((row) => {
      const open = () => {
        if (row.dataset.href) {
          window.location.href = row.dataset.href;
        }
      };
      row.addEventListener('click', (event) => { if (!event.target.closest('a,button,input,select,textarea')) open(); });
      row.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('a,button,input,select,textarea')) {
          event.preventDefault();
          open();
        }
      });
    });

    controllers.set(list, { refresh });
    refresh();
  });

  window.SkushAdminLists = {
    refresh(list) { controllers.get(list)?.refresh(); },
    refreshAll() { controllers.forEach((controller) => controller.refresh()); }
  };
})();
