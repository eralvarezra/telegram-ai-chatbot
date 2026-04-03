const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Create a new product
 * @param {object} data - Product data (name, description, price, type)
 * @param {number|null} ownerUserId - Owner user ID
 * @returns {Promise<object>}
 */
const createProduct = async (data, ownerUserId = null) => {
  const { name, description, price, type } = data;

  // Validate type
  const productType = type || 'product';
  if (!['product', 'service'].includes(productType)) {
    throw new Error('Type must be either "product" or "service"');
  }

  const product = await prisma.product.create({
    data: {
      name,
      description: description || null,
      price: price ? parseFloat(price) : null,
      type: productType,
      owner_user_id: ownerUserId ? parseInt(ownerUserId) : null
    }
  });

  logger.info(`Product created: ${product.id} - ${product.name} (${productType})`);
  return serializeProduct(product);
};

/**
 * Get all products with optional filters
 * @param {number|null} ownerUserId - Filter by owner
 * @param {boolean|null} isActive - Filter by active status
 * @param {string|null} type - Filter by type (product/service)
 * @returns {Promise<Array>}
 */
const getProducts = async (filters = {}) => {
  const { ownerUserId, isActive, type } = filters;

  const where = {};

  if (ownerUserId) {
    where.owner_user_id = parseInt(ownerUserId);
  }

  if (isActive !== undefined) {
    where.is_active = isActive === true || isActive === 'true';
  }

  if (type) {
    where.type = type;
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: {
      _count: {
        select: { media: true }
      }
    }
  });

  return products.map(serializeProduct);
};

/**
 * Get product by ID
 * @param {number} id - Product ID
 * @returns {Promise<object|null>}
 */
const getProductById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id: parseInt(id) },
    include: {
      _count: {
        select: { media: true }
      }
    }
  });

  return product ? serializeProduct(product) : null;
};

/**
 * Update product
 * @param {number} id - Product ID
 * @param {object} data - Update data
 * @returns {Promise<object>}
 */
const updateProduct = async (id, data) => {
  const updateData = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.price !== undefined) updateData.price = data.price ? parseFloat(data.price) : null;
  if (data.is_active !== undefined) updateData.is_active = data.is_active === true || data.is_active === 'true';
  if (data.type !== undefined) {
    if (!['product', 'service'].includes(data.type)) {
      throw new Error('Type must be either "product" or "service"');
    }
    updateData.type = data.type;
  }

  const product = await prisma.product.update({
    where: { id: parseInt(id) },
    data: updateData
  });

  logger.info(`Product updated: ${id}`);
  return serializeProduct(product);
};

/**
 * Toggle product active status
 * @param {number} id - Product ID
 * @returns {Promise<object>}
 */
const toggleProductActive = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id: parseInt(id) }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  const updated = await prisma.product.update({
    where: { id: parseInt(id) },
    data: { is_active: !product.is_active }
  });

  logger.info(`Product toggled: ${id} -> active: ${updated.is_active}`);
  return serializeProduct(updated);
};

/**
 * Delete product
 * @param {number} id - Product ID
 * @returns {Promise<object>}
 */
const deleteProduct = async (id) => {
  // First, set product_id to null for all associated media
  await prisma.mediaContent.updateMany({
    where: { product_id: parseInt(id) },
    data: { product_id: null }
  });

  // Then delete the product
  await prisma.product.delete({
    where: { id: parseInt(id) }
  });

  logger.info(`Product deleted: ${id}`);
  return { success: true };
};

/**
 * Get products with their media count
 * @param {number|null} ownerUserId - Filter by owner
 * @returns {Promise<Array>}
 */
const getProductsWithMediaCount = async (ownerUserId = null) => {
  const where = {};
  if (ownerUserId) {
    where.owner_user_id = parseInt(ownerUserId);
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: {
      _count: {
        select: { media: true }
      }
    }
  });

  return products.map(p => ({
    ...serializeProduct(p),
    media_count: p._count?.media || 0
  }));
};

/**
 * Serialize product for API response
 * @param {object} product
 * @returns {object}
 */
const serializeProduct = (product) => ({
  id: product.id,
  name: product.name,
  description: product.description,
  price: product.price,
  type: product.type,
  owner_user_id: product.owner_user_id,
  is_active: product.is_active,
  media_count: product._count?.media || 0,
  created_at: product.created_at.toISOString(),
  updated_at: product.updated_at.toISOString()
});

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  toggleProductActive,
  deleteProduct,
  getProductsWithMediaCount
};