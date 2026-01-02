const express = require('express');
const router = express.Router();
const memberCtrl = require('../controllers/member.controller');
const auth = require('../middleware/auth.middleware');
const adminOnly = require('../middleware/admin.middleware');

router.use(auth);

router.get('/', adminOnly, memberCtrl.list);
router.post('/', adminOnly, memberCtrl.create);
router.get("/my-stats", auth, memberCtrl.getMyStats);
router.get('/:id', memberCtrl.details);

module.exports = router;
