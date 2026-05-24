document.addEventListener('DOMContentLoaded', () => {
  let business = null;
  if (window.parent && typeof window.parent.getSelectedRestaurant === 'function') {
    business = window.parent.getSelectedRestaurant();
    if (business) renderTemplate(business);
  } else {
    // Standalone loader
    const params = new URLSearchParams(window.location.search);
    const demoId = params.get('demoId');
    if (demoId) {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      fetch(`/api/restaurants/detail/${demoId}`, { headers })
        .then(res => res.json())
        .then(data => {
          if (data && !data.message) {
            renderTemplate(data);
          } else {
            showError('No demo data available. Standalone preview link requires login.');
          }
        })
        .catch(err => {
          console.error(err);
          showError('Failed to fetch demo data.');
        });
    } else {
      showError('No business data context found.');
    }
  }
});

function renderTemplate(business) {
  // Bind simple text fields
  document.getElementById('restaurant-name').textContent = business.mslname;
  document.getElementById('footer-restaurant-name').textContent = business.mslname;
  
  if (business.description) {
    document.getElementById('restaurant-description').textContent = business.description;
    document.getElementById('footer-restaurant-desc').textContent = business.description;
  }
  
  document.getElementById('restaurant-phone').textContent = business.phoneNumber || 'N/A';
  document.getElementById('restaurant-address').textContent = business.fullAddress || 'N/A';

  // Bind hero image
  const heroBg = document.getElementById('hero-bg');
  if (heroBg && business.image) {
    heroBg.style.backgroundImage = `url('${business.image}')`;
  }

  // Bind popular products (split dishes by comma)
  const dishesList = document.getElementById('dishes-list');
  if (dishesList) {
    const dishesStr = business.popularProductsOrServices || 'Woodfired Pizza, Crispy Garlic Bread, Creamy Pasta Carbonara';
    const dishes = dishesStr.split(',').map(d => d.trim()).filter(d => d.length > 0);
    
    // Emojis for food dishes
    const foodEmojis = ['🍲', '🍕', '🍝', '🍔', '🥩', '🥗', '🍨', '🍤', '🍗', '🌮'];
    
    dishesList.innerHTML = dishes.map((dish, index) => {
      const emoji = foodEmojis[index % foodEmojis.length];
      return `
        <div class="menu-item-card">
          <div class="menu-item-icon">${emoji}</div>
          <div class="menu-item-info">
            <h4 class="menu-item-name">${dish}</h4>
            <p class="menu-item-desc">Freshly prepared with authentic ingredients and seasoned to order.</p>
          </div>
        </div>
      `;
    }).join('');
  }

  // Bind social links
  const socialContainer = document.getElementById('social-container');
  if (socialContainer) {
    const socialVal = business.socialLinks || '@culinaryarts';
    const cleanHandle = socialVal.startsWith('@') ? socialVal.slice(1) : socialVal;
    
    socialContainer.innerHTML = `
      <a href="https://instagram.com/${cleanHandle}" target="_blank" class="social-btn" title="Instagram">IG</a>
      <a href="https://facebook.com/${cleanHandle}" target="_blank" class="social-btn" title="Facebook">FB</a>
      <a href="${business.website || '#'}" target="_blank" class="social-btn" title="Website">WS</a>
    `;
  }
}

function showError(msg) {
  document.body.innerHTML = `
    <div style="padding: 40px; text-align: center; font-family: 'Outfit', sans-serif; background: #0F172A; color: white; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" style="width: 48px; height: 48px; margin-bottom: 16px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <h3 style="margin: 0 0 8px 0; font-size: 18px;">Preview Error</h3>
      <p style="color: #94A3B8; font-size: 13px; max-width: 250px; line-height: 1.5; margin: 0;">${msg}</p>
    </div>
  `;
}
