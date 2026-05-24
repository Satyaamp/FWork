const mongoose = require('mongoose');

const RestaurantSchema = new mongoose.Schema({
  mslCode: {
    type: String,
    required: true,
    unique: true
  },
  mslname: {
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
  notes: {
    type: String,
    trim: true
  },
  addedBy: {
    name: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    }
  },
  activeFlag: {
    type: String,
    default: 'A',
    enum: ['A', 'N']
  },
  businessType: {
    type: String,
    enum: ['Restaurant', 'Hospital', 'Salon', 'Cafe', 'Hotel', 'Clinic', 'Gym', 'Bakery', 'Retail Shop', 'Other'],
    default: 'Restaurant'
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  popularProductsOrServices: {
    type: String,
    trim: true,
    default: ''
  },
  website: {
    type: String,
    trim: true,
    default: ''
  },
  socialLinks: {
    type: String,
    trim: true,
    default: ''
  },
  presentationShown: {
    type: String,
    enum: ['Y', 'N'],
    default: 'N'
  },
  demoShown: {
    type: String,
    enum: ['Y', 'N'],
    default: 'N'
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

// Middleware to set IST timestamp automatically
RestaurantSchema.pre('validate', function(next) {
  if (!this.createdAtIST) {
    const utcDate = this.createdAtUTC || new Date();
    // Add 5 hours 30 mins to get IST representation
    const istOffset = 5.5 * 60 * 60 * 1000;
    this.createdAtIST = new Date(utcDate.getTime() + istOffset);
  }
  next();
});

module.exports = mongoose.model('Restaurant', RestaurantSchema);
