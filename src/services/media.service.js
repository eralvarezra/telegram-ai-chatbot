const prisma = require('../config/database');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Save a single media file
 */
const saveMedia = async (file, data, ownerUserId = null) => {
  const { title, description, keywords, price, tags, priority, featured, isNewRelease, productId } = data;

  // Generate unique filename
  const ext = file.mimetype.split('/')[1] || 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  // Save file
  await fs.promises.writeFile(filepath, file.buffer);

  const fileType = file.mimetype.startsWith('image') ? 'image' : 'video';

  // If this is marked as new release, unmark others from the same product
  if (isNewRelease === true || isNewRelease === 'true') {
    if (productId) {
      await prisma.mediaContent.updateMany({
        where: {
          product_id: parseInt(productId),
          is_new_release: true
        },
        data: { is_new_release: false }
      });
    }
  }

  const media = await prisma.mediaContent.create({
    data: {
      title,
      description,
      keywords: keywords.toLowerCase(),
      file_path: filename,
      file_type: fileType,
      owner_user_id: ownerUserId ? parseInt(ownerUserId) : null,
      price: price ? parseFloat(price) : null,
      tags: tags || null,
      priority: parseInt(priority) || 0,
      featured: featured === true || featured === 'true',
      is_new_release: isNewRelease === true || isNewRelease === 'true',
      product_id: productId ? parseInt(productId) : null
    }
  });

  logger.info(`Media saved: ${media.id} - ${title}`);
  return serializeMedia(media);
};

/**
 * Bulk save multiple media files
 */
const saveMediaBulk = async (files, data, ownerUserId = null) => {
  const results = [];

  for (const file of files) {
    try {
      const media = await saveMedia(file, {
        ...data,
        title: data.title || file.originalname?.split('.')[0] || 'Untitled',
        productId: data.productId
      }, ownerUserId);
      results.push({ success: true, media });
    } catch (error) {
      logger.error(`Failed to save media ${file.originalname}:`, error);
      results.push({ success: false, error: error.message, filename: file.originalname });
    }
  }

  return results;
};

/**
 * Get all media with filters
 */
const getAllMedia = async (filters = {}) => {
  const { ownerUserId, isActive, featured, tags, productId } = filters;

  const where = {};

  if (ownerUserId) {
    where.owner_user_id = parseInt(ownerUserId);
  }

  if (isActive !== undefined) {
    where.is_active = isActive === true || isActive === 'true';
  }

  if (featured === true || featured === 'true') {
    where.featured = true;
  }

  if (productId) {
    where.product_id = parseInt(productId);
  }

  if (tags) {
    const tagArray = tags.split(',').map(t => t.trim().toLowerCase());
    // Use contains for each tag
    where.OR = tagArray.map(tag => ({
      tags: { contains: tag }
    }));
  }

  const media = await prisma.mediaContent.findMany({
    where,
    orderBy: [
      { is_new_release: 'desc' },
      { featured: 'desc' },
      { priority: 'desc' },
      { created_at: 'desc' }
    ],
    include: {
      product: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return media.map(serializeMedia);
};

/**
 * Get media by ID
 */
const getMediaById = async (id) => {
  const media = await prisma.mediaContent.findUnique({
    where: { id: parseInt(id) },
    include: {
      product: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  return media ? serializeMedia(media) : null;
};

/**
 * Find media by keyword (single match for keyword trigger)
 */
const findMediaByKeyword = async (text) => {
  const textLower = text.toLowerCase();
  const words = textLower.split(/\s+/);

  logger.debug(`Searching for keywords in: "${textLower}"`);

  const media = await prisma.mediaContent.findMany({
    where: { is_active: true }
  });

  // Find media that matches any keyword
  for (const m of media) {
    const keywords = m.keywords.split(',').map(k => k.trim().toLowerCase());

    // Check if any keyword is contained in the text
    for (const keyword of keywords) {
      if (keyword && textLower.includes(keyword)) {
        logger.info(`Keyword "${keyword}" matched for media "${m.title}"`);
        return serializeMedia(m);
      }
    }

    // Also check if any word contains the keyword
    for (const word of words) {
      for (const keyword of keywords) {
        if (keyword && word.includes(keyword)) {
          logger.info(`Word "${word}" matched keyword "${keyword}" for media "${m.title}"`);
          return serializeMedia(m);
        }
      }
    }
  }

  logger.debug('No matching media found');
  return null;
};

/**
 * Get bulk media for browsing content
 * Returns 3-6 items prioritized by: featured > priority > view_count > recent
 */
const getBulkMedia = async (ownerUserId = null, userId = null, limit = 5) => {
  // Get all active media
  const where = { is_active: true };

  if (ownerUserId) {
    where.owner_user_id = parseInt(ownerUserId);
  }

  const allMedia = await prisma.mediaContent.findMany({
    where,
    orderBy: [
      { featured: 'desc' },
      { priority: 'desc' },
      { view_count: 'asc' }, // Lower views first (show less seen content)
      { created_at: 'desc' }
    ]
  });

  // If user is provided, filter out already seen content
  let unseenMedia = allMedia;

  if (userId) {
    const viewedMediaIds = await prisma.mediaView.findMany({
      where: { user_id: parseInt(userId) },
      select: { media_id: true }
    });

    const viewedIds = new Set(viewedMediaIds.map(v => v.media_id));
    unseenMedia = allMedia.filter(m => !viewedIds.has(m.id));

    // If all content has been seen, fall back to showing all
    if (unseenMedia.length === 0) {
      unseenMedia = allMedia;
    }
  }

  // Select items with priority logic
  const selected = [];
  const featured = unseenMedia.filter(m => m.featured);
  const regular = unseenMedia.filter(m => !m.featured);

  // Add featured content first (up to 2)
  for (const item of featured.slice(0, 2)) {
    selected.push(item);
  }

  // Fill remaining slots with regular content
  const remaining = limit - selected.length;
  for (const item of regular.slice(0, remaining)) {
    selected.push(item);
  }

  // If we still need more, add from featured
  if (selected.length < limit && featured.length > 2) {
    const more = limit - selected.length;
    for (const item of featured.slice(2, 2 + more)) {
      selected.push(item);
    }
  }

  return selected.map(serializeMedia);
};

/**
 * Record that a user has viewed media
 */
const recordMediaView = async (userId, mediaId, ownerUserId = null) => {
  try {
    await prisma.mediaView.create({
      data: {
        user_id: parseInt(userId),
        media_id: parseInt(mediaId),
        owner_user_id: ownerUserId ? parseInt(ownerUserId) : null
      }
    });

    // Increment view count
    await prisma.mediaContent.update({
      where: { id: parseInt(mediaId) },
      data: { view_count: { increment: 1 } }
    });

    logger.debug(`Recorded view: user ${userId} viewed media ${mediaId}`);
  } catch (error) {
    // Unique constraint violation means already viewed - that's fine
    if (error.code !== 'P2002') {
      logger.error('Error recording media view:', error);
    }
  }
};

/**
 * Delete media
 */
const deleteMedia = async (id) => {
  const media = await prisma.mediaContent.findUnique({
    where: { id: parseInt(id) }
  });

  if (media) {
    // Delete file
    const filepath = path.join(UPLOAD_DIR, media.file_path);
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
    }

    // Delete from database
    await prisma.mediaContent.delete({
      where: { id: parseInt(id) }
    });
  }

  return { success: true };
};

/**
 * Update media
 */
const updateMedia = async (id, data) => {
  const updateData = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.keywords !== undefined) updateData.keywords = data.keywords.toLowerCase();
  if (data.is_active !== undefined) updateData.is_active = data.is_active === true || data.is_active === 'true';
  if (data.price !== undefined) updateData.price = data.price ? parseFloat(data.price) : null;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.priority !== undefined) updateData.priority = parseInt(data.priority) || 0;
  if (data.featured !== undefined) updateData.featured = data.featured === true || data.featured === 'true';
  if (data.product_id !== undefined) updateData.product_id = data.product_id ? parseInt(data.product_id) : null;

  // Handle is_new_release - only one per product
  if (data.is_new_release !== undefined) {
    const isNewRelease = data.is_new_release === true || data.is_new_release === 'true';

    if (isNewRelease) {
      // Get the current media to find its product
      const currentMedia = await prisma.mediaContent.findUnique({
        where: { id: parseInt(id) },
        select: { product_id: true }
      });

      if (currentMedia && currentMedia.product_id) {
        // Unmark all other media from the same product
        await prisma.mediaContent.updateMany({
          where: {
            product_id: currentMedia.product_id,
            id: { not: parseInt(id) }
          },
          data: { is_new_release: false }
        });
      }
    }

    updateData.is_new_release = isNewRelease;
  }

  const media = await prisma.mediaContent.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: {
      product: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return serializeMedia(media);
};

/**
 * Toggle media active status
 */
const toggleMediaActive = async (id) => {
  const media = await prisma.mediaContent.findUnique({
    where: { id: parseInt(id) }
  });

  if (!media) {
    throw new Error('Media not found');
  }

  const updated = await prisma.mediaContent.update({
    where: { id: parseInt(id) },
    data: { is_active: !media.is_active }
  });

  return serializeMedia(updated);
};

/**
 * Get media stats
 */
const getMediaStats = async (ownerUserId = null) => {
  const where = {};
  if (ownerUserId) {
    where.owner_user_id = parseInt(ownerUserId);
  }

  const [total, active, featured, totalViews] = await Promise.all([
    prisma.mediaContent.count({ where }),
    prisma.mediaContent.count({ where: { ...where, is_active: true } }),
    prisma.mediaContent.count({ where: { ...where, featured: true } }),
    prisma.mediaContent.aggregate({
      where,
      _sum: { view_count: true }
    })
  ]);

  return {
    total,
    active,
    inactive: total - active,
    featured,
    totalViews: totalViews._sum.view_count || 0
  };
};

/**
 * Get media file path
 */
const getMediaPath = (filename) => {
  return path.join(UPLOAD_DIR, filename);
};

/**
 * Serialize media for API response
 */
const serializeMedia = (media) => ({
  id: media.id,
  title: media.title,
  description: media.description,
  keywords: media.keywords,
  file_path: media.file_path,
  file_type: media.file_type,
  file_url: `/uploads/${media.file_path}`,
  owner_user_id: media.owner_user_id,
  price: media.price,
  tags: media.tags,
  priority: media.priority,
  view_count: media.view_count,
  featured: media.featured,
  is_new_release: media.is_new_release,
  is_active: media.is_active,
  product_id: media.product_id,
  product: media.product ? { id: media.product.id, name: media.product.name } : null,
  created_at: media.created_at.toISOString()
});

/**
 * Toggle media new release status
 * Only one media per product can be marked as new release
 */
const toggleNewRelease = async (id) => {
  const media = await prisma.mediaContent.findUnique({
    where: { id: parseInt(id) },
    select: { id: true, product_id: true, is_new_release: true }
  });

  if (!media) {
    throw new Error('Media not found');
  }

  // If we're marking as new release, unmark all others from the same product first
  if (!media.is_new_release && media.product_id) {
    await prisma.mediaContent.updateMany({
      where: {
        product_id: media.product_id,
        id: { not: parseInt(id) }
      },
      data: { is_new_release: false }
    });
  }

  const updated = await prisma.mediaContent.update({
    where: { id: parseInt(id) },
    data: { is_new_release: !media.is_new_release },
    include: {
      product: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  logger.info(`Media ${id} new release status: ${!media.is_new_release}`);
  return serializeMedia(updated);
};

module.exports = {
  saveMedia,
  saveMediaBulk,
  getAllMedia,
  getMediaById,
  findMediaByKeyword,
  getBulkMedia,
  recordMediaView,
  deleteMedia,
  updateMedia,
  toggleMediaActive,
  toggleNewRelease,
  getMediaStats,
  getMediaPath,
  serializeMedia
};