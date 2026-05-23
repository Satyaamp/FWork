const express = require('express');
const router = express.Router();
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { upload, isCloudinary } = require('../config/cloudinary');

// Create a restaurant (authenticated field workers/admins)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const {
      mslCode,
      mslname,
      ownerName,
      phoneNumber,
      latitude,
      longitude,
      fullAddress,
      area,
      city,
      state,
      country,
      pincode,
      notes
    } = req.body;

    if (!mslCode || !mslname || !latitude || !longitude || !fullAddress) {
      return res.status(400).json({ message: 'MSL Code, name, latitude, longitude, and full address are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Restaurant image file is required.' });
    }

    const image = isCloudinary ? req.file.path : `/uploads/${req.file.filename}`;

    const userObj = await User.findById(req.user._id);

    // Offline-safe Collision Prevention Logic
    let finalMslCode = mslCode;
    let isUnique = false;
    while (!isUnique) {
      const existing = await Restaurant.findOne({ mslCode: finalMslCode });
      if (existing) {
        const prefix = finalMslCode.substring(0, 4).padEnd(4, 'U');
        const random4Digits = Math.floor(1000 + Math.random() * 9000);
        finalMslCode = `${prefix}${random4Digits}`;
      } else {
        isUnique = true;
      }
    }

    const newRestaurant = new Restaurant({
      mslCode: finalMslCode,
      mslname,
      ownerName,
      phoneNumber,
      image,
      latitude: Number(latitude),
      longitude: Number(longitude),
      fullAddress,
      area,
      city,
      state,
      country,
      pincode,
      notes,
      addedBy: {
        name: userObj.name,
        username: userObj.username
      }
    });

    const savedRestaurant = await newRestaurant.save();

    res.status(201).json(savedRestaurant);
  } catch (error) {
    console.error('Add MSL Error:', error);
    res.status(500).json({ message: 'Failed to add MSL. Server error.' });
  }
});

// Get restaurants listing with filters and search
router.get('/', auth, async (req, res) => {
  try {
    const { search, filter, addedByMe } = req.query;
    let query = {};

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { mslCode: searchRegex },
        { mslname: searchRegex },
        { fullAddress: searchRegex },
        { city: searchRegex },
        { pincode: searchRegex },
        { ownerName: searchRegex }
      ];
    }

    if (filter && filter !== 'all') {
      const now = new Date();
      let dateLimit = new Date();

      if (filter === 'today') {
        dateLimit.setHours(0, 0, 0, 0);
      } else if (filter === 'last-2-days') {
        dateLimit.setDate(now.getDate() - 2);
        dateLimit.setHours(0, 0, 0, 0);
      } else if (filter === 'last-7-days') {
        dateLimit.setDate(now.getDate() - 7);
        dateLimit.setHours(0, 0, 0, 0);
      }

      query.createdAtUTC = { $gte: dateLimit };
    }

    const userObj = await User.findById(req.user._id);
    if (req.user.role === 'worker') {
      query['addedBy.username'] = userObj.username;
    } else if (addedByMe === 'true') {
      query['addedBy.username'] = userObj.username;
    }

    const restaurants = await Restaurant.find(query)
      .sort({ createdAtUTC: -1 });

    res.json(restaurants);
  } catch (error) {
    console.error('Fetch Restaurants Error:', error);
    res.status(500).json({ message: 'Server Error fetching restaurants.' });
  }
});

// Get single restaurant detail
router.get('/detail/:id', auth, async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant details not found' });
    }

    const userObj = await User.findById(req.user._id);
    if (req.user.role === 'worker' && restaurant.addedBy && restaurant.addedBy.username !== userObj.username) {
      return res.status(403).json({ message: 'Access denied. You can only view your own outlets.' });
    }
    
    res.json(restaurant);
  } catch (error) {
    console.error('Fetch Restaurant Detail Error:', error);
    res.status(500).json({ message: 'Server error retrieving details.' });
  }
});

// Get worker dashboard statistics
router.get('/stats/worker', auth, async (req, res) => {
  try {
    const userObj = await User.findById(req.user._id);
    const username = userObj.username;

    const totalAdded = await Restaurant.countDocuments({ 'addedBy.username': username });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const addedToday = await Restaurant.countDocuments({ 
      'addedBy.username': username, 
      createdAtUTC: { $gte: todayStart } 
    });

    const weekStart = new Date();
    // Monday start
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    const addedThisWeek = await Restaurant.countDocuments({ 
      'addedBy.username': username, 
      createdAtUTC: { $gte: weekStart } 
    });

    // Recent 5 entries added by this worker
    const recentAdditions = await Restaurant.find({ 'addedBy.username': username })
      .sort({ createdAtUTC: -1 })
      .limit(5);

    res.json({
      totalAdded,
      addedToday,
      addedThisWeek,
      recentAdditions
    });
  } catch (error) {
    console.error('Fetch Worker Stats Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Get admin global dashboard statistics
router.get('/stats/admin', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const totalRestaurants = await Restaurant.countDocuments();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const addedToday = await Restaurant.countDocuments({ createdAtUTC: { $gte: todayStart } });

    const weekStart = new Date();
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const addedThisWeek = await Restaurant.countDocuments({ createdAtUTC: { $gte: weekStart } });

    // Active workers: Count of users who have added at least 1 restaurant
    const activeWorkers = await Restaurant.distinct('addedBy.username');
    const activeWorkersCount = activeWorkers.length;

    // Recent 10 entries globally
    const recentEntries = await Restaurant.find()
      .sort({ createdAtUTC: -1 })
      .limit(10);

    // Monthly Analytics (Past 6 calendar months including current)
    const monthlyAnalytics = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      
      const count = await Restaurant.countDocuments({
        createdAtUTC: { $gte: monthStart, $lte: monthEnd }
      });
      
      const monthName = monthStart.toLocaleString('default', { month: 'short' });
      monthlyAnalytics.push({
        month: `${monthName} ${monthStart.getFullYear()}`,
        count
      });
    }

    // Fetch user-wise statistics (both workers and admins)
    const workers = await User.find().select('name username role createdAt phoneNumber');
    const workersStats = await Promise.all(workers.map(async (w) => {
      const count = await Restaurant.countDocuments({ 'addedBy.username': w.username });
      return {
        _id: w._id,
        name: w.name,
        username: w.username,
        role: w.role,
        phoneNumber: w.phoneNumber || '',
        createdAt: w.createdAt,
        count
      };
    }));

    res.json({
      totalRestaurants,
      addedToday,
      addedThisWeek,
      activeWorkers: activeWorkersCount,
      monthlyAnalytics,
      recentEntries,
      workersStats
    });
  } catch (error) {
    console.error('Fetch Admin Stats Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Delete a restaurant (admin authentication required)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required to delete entries.' });
    }
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' });
    }
    await Restaurant.findByIdAndDelete(req.params.id);
    res.json({ message: 'Restaurant successfully deleted.' });
  } catch (error) {
    console.error('Delete Restaurant Error:', error);
    res.status(500).json({ message: 'Failed to delete restaurant.' });
  }
});

module.exports = router;
