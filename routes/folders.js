const express = require('express');
const router = express.Router();
const { folderManager } = require('../services/folder-manager');
const { phoneManager } = require('../services/phone-manager');
const { authMiddleware } = require('../services/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  const parentId = req.query.parentId || null;
  const folders = folderManager.getFoldersByParent(parentId);
  const phones = phoneManager.getAllPhones().filter(p => (p.folderId || null) === parentId);
  const breadcrumb = parentId ? folderManager.getBreadcrumb(parentId) : [];
  res.json({ folders, phones, breadcrumb });
});

router.post('/', (req, res) => {
  const { name, parentId } = req.body;
  const folder = folderManager.createFolder(name, parentId);
  res.status(201).json(folder);
});

router.put('/:id', (req, res) => {
  const { name } = req.body;
  const folder = folderManager.renameFolder(req.params.id, name);
  if (!folder) return res.status(404).json({ error: 'Khong tim thay folder' });
  res.json(folder);
});

router.delete('/:id', (req, res) => {
  function collectFolderIds(parentId) {
    const ids = [parentId];
    const children = folderManager.getFoldersByParent(parentId);
    for (const c of children) {
      ids.push(...collectFolderIds(c.id));
    }
    return ids;
  }
  const allIds = new Set(collectFolderIds(req.params.id));
  const phones = phoneManager.getAllPhones().filter(p => allIds.has(p.folderId));
  for (const p of phones) {
    p.folderId = null;
  }
  if (phones.length > 0) phoneManager._saveData();
  const ok = folderManager.deleteFolder(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Khong tim thay folder' });
  res.json({ success: true });
});

module.exports = router;
