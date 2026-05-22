const mongoose = require('mongoose');

const RestaurantSchema = new mongoose.Schema({
  restaurantName: {
    type: String,
    required: true,
    trim: true
  },
  ownerName: {
    type: String,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  fullAddress: {
    type: String,
    required: true
  },
  area: String,
  city: String,
  state: String,
  country: String,
  pincode: String,
  geoLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  notes: {
    type: String,
    trim: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAtUTC: {
    type: Date,
    default: Date.now
  },
  createdAtIST: {
    type: Date,
    required: true
  }
});

// Middleware to set GeoJSON and IST timestamp automatically
RestaurantSchema.pre('validate', function(next) {
  if (this.latitude !== undefined && this.longitude !== undefined) {
    this.geoLocation = {
      type: 'Point',
      coordinates: [Number(this.longitude), Number(this.latitude)]
    };
  }
  if (!this.createdAtIST) {
    const utcDate = this.createdAtUTC || new Date();
    // Add 5 hours 30 mins to get IST representation
    const istOffset = 5.5 * 60 * 60 * 1000;
    this.createdAtIST = new Date(utcDate.getTime() + istOffset);
  }
  next();
});

RestaurantSchema.index({ geoLocation: '2dsphere' });

module.exports = mongoose.model('Restaurant', RestaurantSchema);
