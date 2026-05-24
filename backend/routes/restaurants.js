const express = require('express');
const router = express.Router();
const Restaurant = require('../models/Restaurant');
const DeletedMsl = require('../models/DeletedMsl');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { upload, isCloudinary } = require('../config/cloudinary');

// Create a restaurant (authenticated field workers/admins)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const {
      mslCode,
      mslname,
      businessType,
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
      notes,
      description,
      popularProductsOrServices,
      website,
      socialLinks
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
      businessType: businessType || 'Restaurant',
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
      description: description || '',
      popularProductsOrServices: popularProductsOrServices || '',
      website: website || '',
      socialLinks: socialLinks || '',
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
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
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

// Export outlets to CSV (Admin only)
router.get('/export', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }

    const { search, state, city } = req.query;
    let query = {};

    // Match Search Query
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

    // Match Filters
    if (state && state !== 'all') {
      query.state = state;
    }
    if (city && city !== 'all') {
      query.city = city;
    }

    const outlets = await Restaurant.find(query).sort({ createdAtUTC: -1 });

    // CSV Headers
    const headers = [
      'MSL Code',
      'Name',
      'Owner Name',
      'Phone Number',
      'Image URL',
      'Map Link',
      'Address',
      'Area',
      'City',
      'State',
      'Pincode',
      'Country',
      'Notes',
      'Added By (Name)',
      'Added By (Username)',
      'Date',
      'Time'
    ];

    const escapeCSVValue = (val) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = headers.join(',') + '\r\n';

    outlets.forEach(item => {
      let dateStr = '';
      let timeStr = '';
      if (item.createdAtIST) {
        const dateObj = new Date(item.createdAtIST);
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;

        const hours = String(dateObj.getUTCHours()).padStart(2, '0');
        const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getUTCSeconds()).padStart(2, '0');
        timeStr = `${hours}:${minutes}:${seconds}`;
      }

      const mapLink = `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;

      const row = [
        item.mslCode,
        item.mslname,
        item.ownerName,
        item.phoneNumber,
        item.image,
        mapLink,
        item.fullAddress,
        item.area,
        item.city,
        item.state,
        item.pincode,
        item.country,
        item.notes,
        item.addedBy ? item.addedBy.name : '',
        item.addedBy ? item.addedBy.username : '',
        dateStr,
        timeStr
      ];
      csvContent += row.map(escapeCSVValue).join(',') + '\r\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=outlets_export_${Date.now()}.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Export CSV Error:', error);
    res.status(500).json({ message: 'Failed to export CSV. Server error.' });
  }
});

// Update specific restaurant fields (superadmin only)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Superadmin access required to edit entries.' });
    }
    const { mslname, ownerName, phoneNumber, businessType, description, popularProductsOrServices, website, socialLinks } = req.body;

    if (!mslname || !mslname.trim()) {
      return res.status(400).json({ message: 'Shop name is required.' });
    }

    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' });
    }

    restaurant.mslname = mslname.trim();
    restaurant.ownerName = ownerName ? ownerName.trim() : '';
    restaurant.phoneNumber = phoneNumber ? phoneNumber.trim() : '';
    if (businessType) {
      restaurant.businessType = businessType;
    }
    restaurant.description = description !== undefined ? description.trim() : (restaurant.description || '');
    restaurant.popularProductsOrServices = popularProductsOrServices !== undefined ? popularProductsOrServices.trim() : (restaurant.popularProductsOrServices || '');
    restaurant.website = website !== undefined ? website.trim() : (restaurant.website || '');
    restaurant.socialLinks = socialLinks !== undefined ? socialLinks.trim() : (restaurant.socialLinks || '');

    const updatedRestaurant = await restaurant.save();
    res.json(updatedRestaurant);
  } catch (error) {
    console.error('Update Restaurant Error:', error);
    res.status(500).json({ message: 'Failed to update restaurant.' });
  }
});

// Bulk delete restaurants (superadmin authentication required)
router.post('/bulk-delete', auth, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Superadmin access required to delete entries.' });
    }
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No IDs provided for deletion.' });
    }

    const adminUser = await User.findById(req.user._id);
    const restaurants = await Restaurant.find({ _id: { $in: ids } });

    if (restaurants.length === 0) {
      return res.status(404).json({ message: 'No matching records found to delete.' });
    }

    // Archive to DeletedMsl
    const deletedDocs = restaurants.map(restaurant => ({
      mslCode: restaurant.mslCode,
      mslname: restaurant.mslname,
      ownerName: restaurant.ownerName,
      phoneNumber: restaurant.phoneNumber,
      image: restaurant.image,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      fullAddress: restaurant.fullAddress,
      area: restaurant.area,
      city: restaurant.city,
      state: restaurant.state,
      country: restaurant.country,
      pincode: restaurant.pincode,
      notes: restaurant.notes,
      addedBy: restaurant.addedBy,
      createdAtUTC: restaurant.createdAtUTC,
      createdAtIST: restaurant.createdAtIST,
      activeFlag: 'N',
      deletedDateTime: new Date(),
      deletedBy: {
        name: adminUser.name,
        username: adminUser.username
      }
    }));

    await DeletedMsl.insertMany(deletedDocs);
    await Restaurant.deleteMany({ _id: { $in: ids } });

    res.json({ message: `${restaurants.length} outlets successfully deleted and archived.` });
  } catch (error) {
    console.error('Bulk Delete Error:', error);
    res.status(500).json({ message: 'Failed to delete restaurants.' });
  }
});

// Delete a restaurant (superadmin authentication required)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Superadmin access required to delete entries.' });
    }
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' });
    }

    const adminUser = await User.findById(req.user._id);

    // Archive to DeletedMsl
    const deletedMsl = new DeletedMsl({
      mslCode: restaurant.mslCode,
      mslname: restaurant.mslname,
      ownerName: restaurant.ownerName,
      phoneNumber: restaurant.phoneNumber,
      image: restaurant.image,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      fullAddress: restaurant.fullAddress,
      area: restaurant.area,
      city: restaurant.city,
      state: restaurant.state,
      country: restaurant.country,
      pincode: restaurant.pincode,
      notes: restaurant.notes,
      addedBy: restaurant.addedBy,
      createdAtUTC: restaurant.createdAtUTC,
      createdAtIST: restaurant.createdAtIST,
      activeFlag: 'N',
      deletedDateTime: new Date(),
      deletedBy: {
        name: adminUser.name,
        username: adminUser.username
      }
    });

    await deletedMsl.save();
    await Restaurant.findByIdAndDelete(req.params.id);
    res.json({ message: 'Restaurant successfully deleted.' });
  } catch (error) {
    console.error('Delete Restaurant Error:', error);
    res.status(500).json({ message: 'Failed to delete restaurant.' });
  }
});

// Restore a deleted restaurant (superadmin authentication required)
router.post('/restore/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Superadmin access required to restore entries.' });
    }
    
    // 1. Find archived MSL record
    const archivedMsl = await DeletedMsl.findById(req.params.id);
    if (!archivedMsl) {
      return res.status(404).json({ message: 'Archived record not found.' });
    }

    // 2. Prevent duplicate MSL Code collision in active list
    const existingActive = await Restaurant.findOne({ mslCode: archivedMsl.mslCode });
    if (existingActive) {
      return res.status(400).json({ message: 'An active restaurant with the same MSL Code already exists.' });
    }

    // 3. Re-instantiate in Restaurant collection with active flag 'A'
    const restoredRestaurant = new Restaurant({
      mslCode: archivedMsl.mslCode,
      mslname: archivedMsl.mslname,
      ownerName: archivedMsl.ownerName,
      phoneNumber: archivedMsl.phoneNumber,
      image: archivedMsl.image,
      latitude: archivedMsl.latitude,
      longitude: archivedMsl.longitude,
      fullAddress: archivedMsl.fullAddress,
      area: archivedMsl.area,
      city: archivedMsl.city,
      state: archivedMsl.state,
      country: archivedMsl.country,
      pincode: archivedMsl.pincode,
      notes: archivedMsl.notes,
      addedBy: archivedMsl.addedBy,
      createdAtUTC: archivedMsl.createdAtUTC,
      createdAtIST: archivedMsl.createdAtIST,
      activeFlag: 'A'
    });

    await restoredRestaurant.save();

    // 4. Delete from archived collection
    await DeletedMsl.findByIdAndDelete(req.params.id);

    res.json({ message: 'Restaurant successfully restored.', restaurant: restoredRestaurant });
  } catch (error) {
    console.error('Restore Restaurant Error:', error);
    res.status(500).json({ message: 'Failed to restore restaurant.' });
  }
});

// Mark presentation or demo as shown (Authenticated users)
router.post('/:id/mark-shown', auth, async (req, res) => {
  try {
    const { type } = req.body; // 'presentation' or 'demo'
    if (!['presentation', 'demo'].includes(type)) {
      return res.status(400).json({ message: 'Invalid track type. Must be presentation or demo.' });
    }

    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' });
    }

    if (type === 'presentation') {
      restaurant.presentationShown = 'Y';
    } else if (type === 'demo') {
      restaurant.demoShown = 'Y';
    }

    const updated = await restaurant.save();
    res.json(updated);
  } catch (error) {
    console.error('Mark Shown Error:', error);
    res.status(500).json({ message: 'Failed to mark as shown. Server error.' });
  }
});

module.exports = router;
