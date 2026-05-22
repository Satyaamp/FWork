const restaurantRenderer = {
  renderCard(item) {
    const date = new Date(item.createdAtUTC || item.createdAtIST);
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const areaCity = `${item.area ? item.area + ', ' : ''}${item.city || 'N/A'}`;

    return `
      <a href="/restaurant-detail?id=${item._id}" class="restaurant-item">
        <img src="${item.image || '/assets/images/default-restaurant.svg'}" alt="${item.restaurantName}" class="restaurant-item-img" onerror="this.src='/assets/images/default-restaurant.svg'">
        <div class="restaurant-item-details">
          <div class="restaurant-item-name">${item.restaurantName}</div>
          <div class="restaurant-item-address">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25z" />
            </svg>
            <span>${item.fullAddress || areaCity}</span>
          </div>
          <div class="restaurant-item-meta" style="margin-top: 8px;">
            <span style="font-weight: 500;">Pin: <strong style="color: var(--text-main);">${item.pincode || 'N/A'}</strong></span>
            <span class="restaurant-item-worker">by ${item.addedBy ? item.addedBy.name : 'Unknown'}</span>
            <span>${dateStr}, ${timeStr}</span>
          </div>
        </div>
      </a>
    `;
  }
};
