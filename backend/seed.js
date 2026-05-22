const mongoose = require('mongoose');
const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
const dotenv = require('dotenv');

dotenv.config();

const users = [
  {
    name: 'Vijay Kumar',
    username: 'worker',
    password: 'worker123',
    role: 'worker'
  },
  {
    name: 'Sonia Sharma',
    username: 'admin',
    password: 'admin123',
    role: 'admin'
  }
];

const restaurants = [
  {
    restaurantName: 'The Taj Mahal Palace (Souk)',
    ownerName: 'Taj Group',
    phoneNumber: '+91 22 6665 3366',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9217,
    longitude: 72.8333,
    fullAddress: 'Apollo Bandar, Colaba, Mumbai, Maharashtra 400001, India',
    area: 'Colaba',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400001',
    notes: 'Premium dining, excellent service, checked GPS coordinate near Gateway of India.',
    createdAtUTC: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
  },
  {
    restaurantName: 'Leopold Cafe',
    ownerName: 'Farhang Jehani',
    phoneNumber: '+91 22 2282 8185',
    image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9228,
    longitude: 72.8317,
    fullAddress: 'S.B. Singh Road, Colaba, Mumbai, Maharashtra 400001, India',
    area: 'Colaba',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400001',
    notes: 'Busy tourist spot. Checked coordinates are highly accurate. Menu scanned.',
    createdAtUTC: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  },
  {
    restaurantName: 'Britannia & Co. Restaurant',
    ownerName: 'Boman Kohinoor',
    phoneNumber: '+91 22 2261 5264',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9382,
    longitude: 72.8391,
    fullAddress: 'Wakefield House, 11 Sprott Road, Ballard Estate, Fort, Mumbai, Maharashtra 400001, India',
    area: 'Ballard Estate',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400001',
    notes: 'Famous Parsi Cafe. Outstanding berry pulao. Owner details updated.',
    createdAtUTC: new Date()
  }
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant-pwa', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB database cluster for seeding.');

    await User.deleteMany({});
    await Restaurant.deleteMany({});
    console.log('Cleared existing users and restaurants collections.');

    const seededUsers = [];
    for (const u of users) {
      const newUser = new User(u);
      const saved = await newUser.save();
      seededUsers.push(saved);
      console.log(`User seeded: username="${saved.username}", role="${saved.role}"`);
    }

    const workerId = seededUsers.find(u => u.role === 'worker')._id;

    for (const r of restaurants) {
      r.addedBy = workerId;
      const newResto = new Restaurant(r);
      await newResto.save();
      console.log(`Restaurant seeded: "${newResto.restaurantName}"`);
    }

    console.log('Database seeding successfully finished.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding process failed:', error);
    process.exit(1);
  }
};

seed();
