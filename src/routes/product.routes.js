const express = require('express');
const router = express.Router();
const productService = require('../services/product.service');
const authMiddleware = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all products
router.get('/', async (req, res) => {
  try {
    const { isActive, type } = req.query;

    const products = await productService.getProducts({
      ownerUserId: req.user?.id,
      isActive,
      type
    });

    res.json(products);
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get products with media count
router.get('/with-media', async (req, res) => {
  try {
    const products = await productService.getProductsWithMediaCount(req.user?.id);
    res.json(products);
  } catch (error) {
    logger.error('Error fetching products with media:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    logger.error('Error fetching product:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new product
router.post('/', async (req, res) => {
  try {
    const { name, description, price, type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    // Validate type if provided
    if (type && !['product', 'service'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "product" or "service"' });
    }

    const product = await productService.createProduct({
      name,
      description,
      price,
      type
    }, req.user?.id);

    logger.info(`Product created: ${product.id} - ${product.name}`);
    res.status(201).json(product);
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    const { name, description, price, is_active, type } = req.body;

    // Validate type if provided
    if (type !== undefined && !['product', 'service'].includes(type)) {
      return res.status(400).json({ error: 'Type must be either "product" or "service"' });
    }

    const product = await productService.updateProduct(req.params.id, {
      name,
      description,
      price,
      is_active,
      type
    });

    logger.info(`Product updated: ${req.params.id}`);
    res.json(product);
  } catch (error) {
    logger.error('Error updating product:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle product active status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const product = await productService.toggleProductActive(req.params.id);
    res.json(product);
  } catch (error) {
    logger.error('Error toggling product:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    await productService.deleteProduct(req.params.id);
    logger.info(`Product deleted: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting product:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;