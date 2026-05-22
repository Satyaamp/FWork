const locationService = {
  getCurrentCoords() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your browser.'));
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          let msg = 'Failed to fetch GPS coordinates.';
          if (error.code === error.PERMISSION_DENIED) {
            msg = 'Location permission denied. Please enable GPS permissions.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = 'GPS location info is unavailable.';
          } else if (error.code === error.TIMEOUT) {
            msg = 'GPS coordinate retrieval timed out.';
          }
          reject(new Error(msg));
        },
        options
      );
    });
  },

  async reverseGeocode(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en'
        }
      });
      
      if (!response.ok) {
        throw new Error('Nominatim reverse lookup failed.');
      }
      
      const data = await response.json();
      const addr = data.address || {};
      
      const area = addr.suburb || addr.neighbourhood || addr.residential || addr.road || '';
      const city = addr.city || addr.town || addr.village || addr.municipality || '';
      
      return {
        latitude: lat,
        longitude: lon,
        fullAddress: data.display_name || '',
        area: area,
        city: city,
        state: addr.state || '',
        country: addr.country || '',
        pincode: addr.postcode || ''
      };
    } catch (error) {
      console.error('Reverse Geocode Fail:', error);
      throw new Error('Reverse geocoding error. Check active network connection.');
    }
  }
};
