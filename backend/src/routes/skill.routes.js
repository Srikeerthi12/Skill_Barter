const express = require('express');
const {
  createSkill,
  listSkills,
  getSkill,
  updateSkill,
  deleteSkill,
} = require('../controllers/skill.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', listSkills);
router.get('/:id', getSkill);
router.post('/', requireAuth, createSkill);
router.put('/:id', requireAuth, updateSkill);
router.delete('/:id', requireAuth, deleteSkill);

module.exports = router;
