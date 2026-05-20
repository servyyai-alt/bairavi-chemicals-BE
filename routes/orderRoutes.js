const express = require('express');
const {
  createOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
  cancelMyOrder,
  deleteMyOrder,
  getAllOrders,
  updateOrderStatus,
  getDashboardStats
} = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/', createOrder);
router.post('/verify-payment', verifyPayment);
router.get('/my-orders', getMyOrders);
router.get('/admin/all', adminOnly, getAllOrders);
router.get('/admin/dashboard', adminOnly, getDashboardStats);
router.get('/:id', getOrderById);
router.put('/:id/cancel', cancelMyOrder);
router.delete('/:id', deleteMyOrder);
router.put('/:id/status', adminOnly, updateOrderStatus);

module.exports = router;
