const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'folders-data.json');

class FolderManager {
  constructor() {
    this.folders = new Map();
    this._loadData();
  }

  _loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        data.forEach(f => this.folders.set(f.id, f));
        console.log(`Da load ${data.length} folder tu file`);
      }
    } catch (e) {
      console.error('Loi load folder data:', e.message);
    }
  }

  _saveData() {
    try {
      const data = Array.from(this.folders.values());
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Loi save folder data:', e.message);
    }
  }

  createFolder(name, parentId) {
    const id = uuidv4();
    const folder = {
      id,
      name: name || 'Folder moi',
      parentId: parentId || null,
      createdAt: new Date().toISOString(),
    };
    this.folders.set(id, folder);
    this._saveData();
    return folder;
  }

  getFolder(id) {
    return this.folders.get(id) || null;
  }

  getFoldersByParent(parentId) {
    return Array.from(this.folders.values()).filter(f => f.parentId === (parentId || null));
  }

  getBreadcrumb(folderId) {
    const crumbs = [];
    let current = folderId;
    while (current) {
      const folder = this.folders.get(current);
      if (!folder) break;
      crumbs.unshift({ id: folder.id, name: folder.name });
      current = folder.parentId;
    }
    return crumbs;
  }

  renameFolder(id, name) {
    const folder = this.folders.get(id);
    if (!folder) return null;
    folder.name = name;
    this._saveData();
    return folder;
  }

  deleteFolder(id) {
    const folder = this.folders.get(id);
    if (!folder) return false;
    const children = this.getFoldersByParent(id);
    for (const child of children) {
      this.deleteFolder(child.id);
    }
    this.folders.delete(id);
    this._saveData();
    return true;
  }

  getAllFolders() {
    return Array.from(this.folders.values());
  }
}

const folderManager = new FolderManager();
module.exports = { folderManager };
