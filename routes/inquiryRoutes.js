const express = require('express');
const {
  createInquiry,
  getAllInquiries,
  updateInquiryStatus
} = require('../controllers/inquiryController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.post('/', createInquiry);
router.get('/admin/all', protect, adminOnly, getAllInquiries);
router.put('/:id/status', protect, adminOnly, updateInquiryStatus);

module.exports = router;
