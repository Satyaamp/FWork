const DB_NAME = 'RestaurantOfflineDB';
const STORE_NAME = 'offline_restaurants';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = (e) => {
      resolve(e.target.result);
    };
    
    request.onerror = (e) => {
      console.error('IndexedDB failure:', e.target.error);
      reject(e.target.error);
    };
  });
  
  return dbPromise;
}

const offlineDb = {
  async saveRestaurant(restaurantData) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(restaurantData);
      
      request.onsuccess = () => {
        resolve(true);
        window.dispatchEvent(new CustomEvent('offline-data-changed'));
      };
      
      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  },

  async getOfflineRestaurants() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  },

  async deleteOfflineRestaurant(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve(true);
        window.dispatchEvent(new CustomEvent('offline-data-changed'));
      };
      
      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  },

  async syncRestaurants() {
    if (!navigator.onLine) return;
    
    const offlineList = await this.getOfflineRestaurants();
    if (offlineList.length === 0) {
      this.updateSyncBanner(0, false);
      return;
    }

    console.log(`Syncing ${offlineList.length} offline restaurant entries...`);
    this.updateSyncBanner(offlineList.length, true);

    for (const item of offlineList) {
      try {
        const formData = new FormData();
        formData.append('restaurantName', item.restaurantName);
        formData.append('ownerName', item.ownerName || '');
        formData.append('phoneNumber', item.phoneNumber || '');
        formData.append('latitude', item.latitude);
        formData.append('longitude', item.longitude);
        formData.append('fullAddress', item.fullAddress);
        formData.append('area', item.area || '');
        formData.append('city', item.city || '');
        formData.append('state', item.state || '');
        formData.append('country', item.country || '');
        formData.append('pincode', item.pincode || '');
        formData.append('notes', item.notes || '');

        if (item.imageBlob) {
          const file = new File([item.imageBlob], 'captured_image.png', { type: item.imageType || 'image/png' });
          formData.append('image', file);
        }

        const response = await api.post('/restaurants', formData);
        
        if (response) {
          await this.deleteOfflineRestaurant(item.id);
        }
      } catch (err) {
        console.error('Failed to sync item:', item.restaurantName, err);
        break;
      }
    }
    
    const remaining = await this.getOfflineRestaurants();
    this.updateSyncBanner(remaining.length, false);
    window.dispatchEvent(new CustomEvent('sync-completed'));
  },

  updateSyncBanner(count, isSyncing) {
    const banner = document.getElementById('sync-banner');
    if (!banner) return;

    if (count > 0) {
      banner.style.display = 'flex';
      banner.classList.add('offline');
      if (isSyncing) {
        banner.innerHTML = `<span class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin: 0;"></span> Syncing ${count} offline additions...`;
      } else {
        banner.innerHTML = `⚠️ ${count} unsynced restaurants. Waiting for connection...`;
      }
    } else {
      if (!navigator.onLine) {
        banner.style.display = 'flex';
        banner.classList.add('offline');
        banner.innerHTML = `📡 Offline. Saved entries will be synced when online.`;
      } else {
        banner.style.display = 'none';
        banner.classList.remove('offline');
      }
    }
  }
};

window.addEventListener('online', () => {
  console.log('Back online. Restoring database additions...');
  offlineDb.syncRestaurants();
});

window.addEventListener('offline', () => {
  offlineDb.updateSyncBanner(0, false);
});

document.addEventListener('DOMContentLoaded', async () => {
  const offlineList = await offlineDb.getOfflineRestaurants();
  offlineDb.updateSyncBanner(offlineList.length, false);
  
  if (navigator.onLine && offlineList.length > 0) {
    offlineDb.syncRestaurants();
  }
  
  window.addEventListener('offline-data-changed', async () => {
    const list = await offlineDb.getOfflineRestaurants();
    offlineDb.updateSyncBanner(list.length, false);
  });
});
