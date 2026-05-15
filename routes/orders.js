const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getMyOrders, getOrderById, cancelMyOrder, getAllOrders, updateOrderStatus, getDashboardStats } = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/', protect, createOrder);
router.post('/verify-payment', protect, verifyPayment);
router.get('/my-orders', protect, getMyOrders);
router.put('/:id/cancel', protect, cancelMyOrder);
router.get('/admin/all', protect, adminOnly, getAllOrders);
router.get('/admin/dashboard', protect, adminOnly, getDashboardStats);
router.get('/:id', protect, getOrderById);
router.put('/:id/status', protect, adminOnly, updateOrderStatus);

module.exports = router;
