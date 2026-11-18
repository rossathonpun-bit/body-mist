/* ==========================================================
   Body Scent — script.js (shared by every page)
   Each function runs only if its elements exist on the page.
   ========================================================== */

// ---------- Config: replace these two values ----------
const APPS_SCRIPT_URL = 'APPS_SCRIPT_URL';
const CSV_URL = 'CSV_URL';

// ---------- Helpers ----------
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(price) {
  return Number(price).toLocaleString('th-TH') + ' บาท';
}

// ==========================================================
// 1) product.html — product cards + mood filter
// ==========================================================
const MOOD_FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

const MOOD_LABELS = {
  fresh: 'Fresh',
  sweet: 'Sweet',
  confident: 'Confident',
  romance: 'Romance'
};

let allProducts = [];

function initProductPage() {
  const filterBar = document.getElementById('filter-bar');
  const productList = document.getElementById('product-list');
  if (!filterBar || !productList) return;

  // mood from URL (?mood=xxx); fall back to "all" if it is not a valid mood
  const params = new URLSearchParams(window.location.search);
  const moodParam = (params.get('mood') || 'all').toLowerCase();
  const activeMood = MOOD_FILTERS.some(function (f) { return f.key === moodParam; })
    ? moodParam
    : 'all';

  renderFilterBar(filterBar, productList, activeMood);

  fetch('products.json')
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (products) {
      allProducts = products;
      renderProducts(productList, activeMood);
    })
    .catch(function (error) {
      console.error(error);
      productList.innerHTML =
        '<p class="empty-state">ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
    });
}

function renderFilterBar(filterBar, productList, activeMood) {
  filterBar.innerHTML = '';

  MOOD_FILTERS.forEach(function (filter) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-btn' + (filter.key === activeMood ? ' active' : '');
    button.dataset.mood = filter.key;
    button.textContent = filter.label;

    button.addEventListener('click', function () {
      filterBar.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b === button);
      });
      renderProducts(productList, filter.key);
    });

    filterBar.appendChild(button);
  });
}

function renderProducts(productList, mood) {
  const items = mood === 'all'
    ? allProducts
    : allProducts.filter(function (p) { return p.mood === mood; });

  if (items.length === 0) {
    productList.innerHTML = '<p class="empty-state">ยังไม่มีสินค้าในหมวดนี้</p>';
    return;
  }

  productList.innerHTML = items.map(productCardHtml).join('');
}

function productCardHtml(product) {
  const sizeText = product.size || 'โรลออน';
  const orderUrl =
    'order.html?item=' + encodeURIComponent(product.name) +
    '&price=' + encodeURIComponent(product.price);

  return (
    '<article class="product-card" data-mood="' + escapeHtml(product.mood) + '">' +
      '<img class="product-img" src="' + escapeHtml(product.image) + '" ' +
        'alt="' + escapeHtml(product.name) + '" loading="lazy">' +
      '<div class="product-body">' +
        '<div class="mood-label"><span class="mood-dot"></span>' +
          escapeHtml(MOOD_LABELS[product.mood] || product.mood) + '</div>' +
        '<h3>' + escapeHtml(product.name) + '</h3>' +
        '<p class="desc">' + escapeHtml(product.description) + '</p>' +
        '<div class="meta">' +
          '<span class="size">' + escapeHtml(sizeText) + '</span>' +
          '<span class="price">' + escapeHtml(formatPrice(product.price)) + '</span>' +
        '</div>' +
        '<a class="btn btn--small btn--block" href="' + orderUrl + '">สั่งซื้อ</a>' +
      '</div>' +
    '</article>'
  );
}

// ==========================================================
// 2) order.html — autofill item/price + submit to Apps Script
// ==========================================================
function initOrderPage() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  // Autofill from ?item=...&price=... (fills BOTH #items and #total)
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');

  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  if (itemsInput && item) itemsInput.value = item;
  if (totalInput && price) totalInput.value = price;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    const payload = {
      customerName: document.getElementById('customerName').value,
      contact: document.getElementById('contact').value,
      items: document.getElementById('items').value,
      total: document.getElementById('total').value,
      note: document.getElementById('note').value
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      if (submitBtn) submitBtn.disabled = false;
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

// ==========================================================
// 3) admin.html — load CSV and show newest orders first
// ==========================================================

// Own CSV parser: handles quoted fields, "" escapes,
// commas/newlines inside quotes, and CRLF / LF line endings.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  // last field / row (file without trailing newline)
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  const COLUMNS = 6; // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ

  tbody.innerHTML =
    '<tr><td colspan="' + COLUMNS + '">กำลังโหลดข้อมูล...</td></tr>';

  // add a timestamp so the browser does not serve an old cached CSV
  const url = CSV_URL + (CSV_URL.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();

  fetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    })
    .then(function (text) {
      const rows = parseCSV(text)
        .slice(1) // skip header row
        .filter(function (r) {
          return r.some(function (cell) { return cell.trim() !== ''; });
        })
        .reverse(); // newest first (rows are appended at the bottom of the sheet)

      if (rows.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="' + COLUMNS + '">ยังไม่มีรายการสั่งซื้อ</td></tr>';
        return;
      }

      tbody.innerHTML = rows.map(function (r) {
        let cells = '';
        for (let i = 0; i < COLUMNS; i++) {
          cells += '<td>' + escapeHtml(r[i] || '') + '</td>';
        }
        return '<tr>' + cells + '</tr>';
      }).join('');
    })
    .catch(function (error) {
      console.error(error);
      tbody.innerHTML =
        '<tr><td colspan="' + COLUMNS + '">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง</td></tr>';
    });
}

// ==========================================================
// Run page-specific code once the DOM is ready
// ==========================================================
document.addEventListener('DOMContentLoaded', function () {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
