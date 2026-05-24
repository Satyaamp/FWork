const express = require('express');
const router = express.Router();
const Presentation = require('../models/Presentation');
const auth = require('../middleware/auth');
const presentationUpload = require('../config/presentationUpload');
const { isCloudinary, cloudinary } = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');

// Helper to safely delete local uploads or Cloudinary resources
const deleteUploadedFile = async (fileUrl) => {
  if (!fileUrl) return;

  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    // Cloudinary resource deletion
    if (isCloudinary) {
      try {
        // Extract public ID from Cloudinary URL
        // Example: https://res.cloudinary.com/cloud_name/image/upload/v1234567/presentations/filename.pdf
        const urlParts = fileUrl.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex !== -1 && urlParts.length > uploadIndex + 2) {
          const publicIdWithExt = urlParts.slice(uploadIndex + 2).join('/');
          const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));
          
          let resource_type = 'image';
          if (fileUrl.includes('/raw/')) {
            resource_type = 'raw';
          } else if (fileUrl.includes('/video/')) {
            resource_type = 'video';
          }
          
          await cloudinary.uploader.destroy(publicId, { resource_type });
          console.log(`Successfully deleted Cloudinary resource: ${publicId} (${resource_type})`);
        }
      } catch (err) {
        console.error(`Failed to delete Cloudinary resource at ${fileUrl}:`, err.message);
      }
    }
  } else {
    // Local filesystem deletion
    try {
      const cleanPath = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
      const absolutePath = path.join(__dirname, '..', cleanPath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`Successfully deleted file: ${absolutePath}`);
      }
    } catch (err) {
      console.error(`Failed to delete file on disk at ${fileUrl}:`, err.message);
    }
  }
};

// Helper to upload a local temp file to Cloudinary and delete the temp file
const uploadToCloudinary = async (localFilePath, options) => {
  try {
    const result = await cloudinary.uploader.upload(localFilePath, options);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return result.secure_url;
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    throw new Error('Cloudinary upload failed: ' + err.message);
  }
};

// 1. GET /api/presentations/admin (Admins only) - List all presentations
router.get('/admin', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }
    const list = await Presentation.find().sort({ sortOrder: 1, createdAtUTC: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch Admin Presentations Error:', error);
    res.status(500).json({ message: 'Failed to retrieve presentation list.' });
  }
});

// 2. POST /api/presentations (Admins only) - Create presentation
router.post(
  '/',
  auth,
  presentationUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
      }

      const { title, description, businessTypes, presentationType, sortOrder, isActive } = req.body;

      if (!title || !description || !presentationType) {
        return res.status(400).json({ message: 'Title, description, and presentationType are required.' });
      }

      if (!req.files || !req.files['file'] || req.files['file'].length === 0) {
        return res.status(400).json({ message: 'Presentation document/media file is required.' });
      }

      let parsedBusinessTypes = ['Other'];
      if (businessTypes) {
        try {
          if (Array.isArray(businessTypes)) {
            parsedBusinessTypes = businessTypes;
          } else {
            const parsed = JSON.parse(businessTypes);
            parsedBusinessTypes = Array.isArray(parsed) ? parsed : [parsed];
          }
        } catch (e) {
          parsedBusinessTypes = typeof businessTypes === 'string'
            ? businessTypes.split(',').map(t => t.trim())
            : [businessTypes];
        }
      }

      const fileField = req.files['file'][0];
      let fileUrl;
      
      if (isCloudinary) {
        let resource_type = 'raw'; // For PDFs
        if (presentationType === 'image') resource_type = 'image';
        else if (presentationType === 'video') resource_type = 'video';

        fileUrl = await uploadToCloudinary(fileField.path, {
          folder: 'presentations',
          resource_type
        });
      } else {
        fileUrl = `/uploads/presentations/${fileField.filename}`;
      }

      let thumbnailUrl = '';
      if (req.files['thumbnail'] && req.files['thumbnail'].length > 0) {
        const thumbField = req.files['thumbnail'][0];
        if (isCloudinary) {
          thumbnailUrl = await uploadToCloudinary(thumbField.path, {
            folder: 'presentations/thumbnails',
            resource_type: 'image'
          });
        } else {
          thumbnailUrl = `/uploads/presentations/${thumbField.filename}`;
        }
      }

      const newPresentation = new Presentation({
        title: title.trim(),
        description: description.trim(),
        businessTypes: parsedBusinessTypes,
        presentationType,
        thumbnail: thumbnailUrl,
        file: fileUrl,
        isActive: isActive === 'true' || isActive === true,
        sortOrder: Number(sortOrder) || 0,
        createdBy: {
          name: req.user.name,
          username: req.user.username
        }
      });

      const saved = await newPresentation.save();
      res.status(201).json(saved);
    } catch (error) {
      console.error('Create Presentation Error:', error);
      // Clean up uploaded files if error occurs
      if (req.files) {
        if (req.files['file'] && fs.existsSync(req.files['file'][0].path)) {
          fs.unlinkSync(req.files['file'][0].path);
        }
        if (req.files['thumbnail'] && req.files['thumbnail'].length > 0 && fs.existsSync(req.files['thumbnail'][0].path)) {
          fs.unlinkSync(req.files['thumbnail'][0].path);
        }
      }
      res.status(500).json({ message: error.message || 'Failed to create presentation.' });
    }
  }
);

// 3. PUT /api/presentations/:id (Admins only) - Update presentation
router.put(
  '/:id',
  auth,
  presentationUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
      }

      const presentation = await Presentation.findById(req.params.id);
      if (!presentation) {
        return res.status(404).json({ message: 'Presentation not found.' });
      }

      const { title, description, businessTypes, presentationType, sortOrder, isActive } = req.body;

      if (title) presentation.title = title.trim();
      if (description) presentation.description = description.trim();
      if (presentationType) presentation.presentationType = presentationType;
      if (sortOrder !== undefined) presentation.sortOrder = Number(sortOrder) || 0;
      if (isActive !== undefined) presentation.isActive = isActive === 'true' || isActive === true;

      if (businessTypes) {
        try {
          if (Array.isArray(businessTypes)) {
            presentation.businessTypes = businessTypes;
          } else {
            const parsed = JSON.parse(businessTypes);
            presentation.businessTypes = Array.isArray(parsed) ? parsed : [parsed];
          }
        } catch (e) {
          presentation.businessTypes = typeof businessTypes === 'string'
            ? businessTypes.split(',').map(t => t.trim())
            : [businessTypes];
        }
      }

      // Handle new file upload
      if (req.files && req.files['file'] && req.files['file'].length > 0) {
        const oldFile = presentation.file;
        const newFileField = req.files['file'][0];
        
        if (isCloudinary) {
          const type = presentationType || presentation.presentationType;
          let resource_type = 'raw';
          if (type === 'image') resource_type = 'image';
          else if (type === 'video') resource_type = 'video';

          presentation.file = await uploadToCloudinary(newFileField.path, {
            folder: 'presentations',
            resource_type
          });
        } else {
          presentation.file = `/uploads/presentations/${newFileField.filename}`;
        }
        
        // Delete old file
        await deleteUploadedFile(oldFile);
      }

      // Handle new thumbnail upload
      if (req.files && req.files['thumbnail'] && req.files['thumbnail'].length > 0) {
        const oldThumbnail = presentation.thumbnail;
        const newThumbField = req.files['thumbnail'][0];
        
        if (isCloudinary) {
          presentation.thumbnail = await uploadToCloudinary(newThumbField.path, {
            folder: 'presentations/thumbnails',
            resource_type: 'image'
          });
        } else {
          presentation.thumbnail = `/uploads/presentations/${newThumbField.filename}`;
        }
        
        // Delete old thumbnail
        await deleteUploadedFile(oldThumbnail);
      }

      const updated = await presentation.save();
      res.json(updated);
    } catch (error) {
      console.error('Update Presentation Error:', error);
      // Clean up temp local files if upload fails
      if (req.files) {
        if (req.files['file'] && fs.existsSync(req.files['file'][0].path)) {
          fs.unlinkSync(req.files['file'][0].path);
        }
        if (req.files['thumbnail'] && req.files['thumbnail'].length > 0 && fs.existsSync(req.files['thumbnail'][0].path)) {
          fs.unlinkSync(req.files['thumbnail'][0].path);
        }
      }
      res.status(500).json({ message: error.message || 'Failed to update presentation.' });
    }
  }
);

// 4. DELETE /api/presentations/:id (Admins only) - Delete presentation
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }

    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) {
      return res.status(404).json({ message: 'Presentation not found.' });
    }

    // Delete files (removes local or Cloudinary objects)
    await deleteUploadedFile(presentation.file);
    await deleteUploadedFile(presentation.thumbnail);

    await Presentation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Presentation deleted successfully.' });
  } catch (error) {
    console.error('Delete Presentation Error:', error);
    res.status(500).json({ message: 'Failed to delete presentation.' });
  }
});

// 5. GET /api/presentations (Field Workers / Admins) - Fetch active presentations by business type
router.get('/', auth, async (req, res) => {
  try {
    const { businessType } = req.query;
    if (!businessType) {
      return res.status(400).json({ message: 'businessType query parameter is required.' });
    }

    const presentations = await Presentation.find({
      isActive: true,
      businessTypes: businessType
    }).sort({ sortOrder: 1, createdAtUTC: -1 });

    res.json(presentations);
  } catch (error) {
    console.error('Fetch Presentations for Workers Error:', error);
    res.status(500).json({ message: 'Failed to fetch presentation materials.' });
  }
});

module.exports = router;
