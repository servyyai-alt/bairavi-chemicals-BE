const express = require('express');
const { getStoreSettings, updateStoreSettings } = require('../controllers/settingsController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', getStoreSettings);
router.put('/', protect, adminOnly, updateStoreSettings);

module.exports = router;
