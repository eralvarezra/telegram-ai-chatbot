const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mediaService = require('../services/media.service');
const authMiddleware = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|mov/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Allowed: jpeg, jpg, png, gif, webp, mp4, webm, mov'));
  }
});

// Apply auth middleware to all routes
router.use(authMiddleware);

// Upload single media
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description, keywords, price, tags, priority, featured, isNewRelease, productId } = req.body;

    if (!keywords) {
      return res.status(400).json({ error: 'Keywords are required' });
    }

    const media = await mediaService.saveMedia(req.file, {
      title: title || req.file.originalname?.split('.')[0] || 'Untitled',
      description,
      keywords,
      price: price ? parseFloat(price) : null,
      tags,
      priority: priority ? parseInt(priority) : 0,
      featured: featured === 'true' || featured === true,
      isNewRelease: isNewRelease === 'true' || isNewRelease === true,
      productId: productId ? parseInt(productId) : null
    }, req.user?.id);

    logger.info(`Media uploaded: ${media.id} - ${media.title}`);
    res.json({ success: true, media });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk upload multiple files
router.post('/upload/bulk', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { keywords, tags, price, priority, featured, productId } = req.body;

    if (!keywords) {
      return res.status(400).json({ error: 'Keywords are required' });
    }

    const results = await mediaService.saveMediaBulk(req.files, {
      keywords,
      tags,
      price: price ? parseFloat(price) : null,
      priority: priority ? parseInt(priority) : 0,
      featured: featured === 'true' || featured === true,
      productId: productId ? parseInt(productId) : null
    }, req.user?.id);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    res.json({
      success: true,
      uploaded: successful.length,
      failed: failed.length,
      results
    });
  } catch (error) {
    logger.error('Bulk upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all media with filters
router.get('/', async (req, res) => {
  try {
    const { isActive, featured, tags, productId } = req.query;

    const media = await mediaService.getAllMedia({
      ownerUserId: req.user?.id,
      isActive,
      featured,
      tags,
      productId
    });

    res.json(media);
  } catch (error) {
    logger.error('Error fetching media:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get media stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await mediaService.getMediaStats(req.user?.id);
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching media stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single media by ID
router.get('/:id', async (req, res) => {
  try {
    const media = await mediaService.getMediaById(req.params.id);
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }
    res.json(media);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update media
router.put('/:id', async (req, res) => {
  try {
    const { title, description, keywords, is_active, price, tags, priority, featured, product_id } = req.body;

    const media = await mediaService.updateMedia(req.params.id, {
      title,
      description,
      keywords,
      is_active,
      price,
      tags,
      priority,
      featured,
      product_id
    });

    logger.info(`Media updated: ${req.params.id}`);
    res.json(media);
  } catch (error) {
    logger.error('Error updating media:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle media active status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const media = await mediaService.toggleMediaActive(req.params.id);
    logger.info(`Media toggled: ${req.params.id} -> active: ${media.is_active}`);
    res.json(media);
  } catch (error) {
    logger.error('Error toggling media:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle featured status
router.patch('/:id/featured', async (req, res) => {
  try {
    const media = await mediaService.getMediaById(req.params.id);
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const updated = await mediaService.updateMedia(req.params.id, {
      featured: !media.featured
    });

    logger.info(`Media featured toggled: ${req.params.id} -> featured: ${updated.featured}`);
    res.json(updated);
  } catch (error) {
    logger.error('Error toggling featured:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle new release status (only one per product)
router.patch('/:id/new-release', async (req, res) => {
  try {
    const updated = await mediaService.toggleNewRelease(req.params.id);
    logger.info(`Media new release toggled: ${req.params.id} -> is_new_release: ${updated.is_new_release}`);
    res.json(updated);
  } catch (error) {
    logger.error('Error toggling new release:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete media
router.delete('/:id', async (req, res) => {
  try {
    await mediaService.deleteMedia(req.params.id);
    logger.info(`Media deleted: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting media:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;