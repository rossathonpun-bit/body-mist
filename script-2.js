/* ==========================================================
   Body Scent — script.js (shared by every page)
   Each function runs only if its elements exist on the page.
   ========================================================== */

const ORDERS_KEY = 'bodyScentOrders';

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

// Read the saved orders as an array (never throws)
function loadOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(error);
    return [];
  }
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
// 2) order.html — autofill item/price + save order to localStorage
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
      note: document.getElementById('note').value,
      timestamp: new Date().toISOString()
    };

    try {
      const orders = loadOrders();
      orders.push(payload);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    } catch (error) {
      console.error(error);
      alert('ไม่สามารถบันทึกคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง');
      return;
    }

    window.location.href = 'thankyou.html';
  });
}

// ==========================================================
// 3) admin.html — read orders from localStorage, newest first
// ==========================================================
function formatOrderDate(timestamp) {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('th-TH');
}

function formatOrderTotal(total) {
  const number = Number(total);
  if (total === '' || total == null || isNaN(number)) return total || '';
  return number.toLocaleString('th-TH') + ' บาท';
}

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  const COLUMNS = 6; // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ

  const orders = loadOrders().slice().sort(function (a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  if (orders.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="' + COLUMNS + '">ยังไม่มีคำสั่งซื้อ</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(function (order) {
    return (
      '<tr>' +
        '<td>' + escapeHtml(formatOrderDate(order.timestamp)) + '</td>' +
        '<td>' + escapeHtml(order.customerName) + '</td>' +
        '<td>' + escapeHtml(order.contact) + '</td>' +
        '<td>' + escapeHtml(order.items) + '</td>' +
        '<td>' + escapeHtml(formatOrderTotal(order.total)) + '</td>' +
        '<td>' + escapeHtml(order.note) + '</td>' +
      '</tr>'
    );
  }).join('');
}

// ==========================================================
// Run page-specific code once the DOM is ready
// ==========================================================
document.addEventListener('DOMContentLoaded', function () {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
