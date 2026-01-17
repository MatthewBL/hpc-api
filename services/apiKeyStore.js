const path = require('path');
const Datastore = require('nedb');

const dbFile = path.join(__dirname, '..', 'data', 'apikeys.db');
const db = new Datastore({ filename: dbFile, autoload: true });

function getAll() {
  return new Promise((resolve, reject) => {
    db.find({}, (err, docs) => {
      if (err) return reject(err);
      resolve(docs || []);
    });
  });
}

function findAPIKey(id) {
  return new Promise((resolve, reject) => {
    db.findOne({ _id: String(id) }, (err, doc) => {
      if (err) return reject(err);
      resolve(doc || null);
    });
  });
}

function addAPIKey(id, apiKeyInfo) {
  const doc = Object.assign({}, apiKeyInfo, { _id: String(id) });
  return new Promise((resolve, reject) => {
    db.update({ _id: doc._id }, doc, { upsert: true }, (err) => {
      if (err) return reject(err);
      resolve(doc);
    });
  });
}

function updateAPIKey(id, updates) {
  return new Promise((resolve, reject) => {
    db.update({ _id: String(id) }, { $set: updates }, {}, (err, numReplaced) => {
      if (err) return reject(err);
      if (numReplaced === 0) {
        return reject(new Error('API Key not found'));
      }
      // Fetch the updated document
      db.findOne({ _id: String(id) }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  });
}

function removeAPIKey(id) {
  return new Promise((resolve, reject) => {
    db.remove({ _id: String(id) }, {}, (err, numRemoved) => {
      if (err) return reject(err);
      resolve(numRemoved);
    });
  });
}

function addSLAToAPIKey(apiKeyId, slaId) {
  return new Promise((resolve, reject) => {
    db.findOne({ _id: String(apiKeyId) }, (err, doc) => {
      if (err) return reject(err);
      if (!doc) return reject(new Error('API Key not found'));
      
      const slas = doc.slas || [];
      if (!slas.includes(slaId)) {
        slas.push(slaId);
      }
      
      db.update({ _id: String(apiKeyId) }, { $set: { slas } }, {}, (err, numReplaced) => {
        if (err) return reject(err);
        db.findOne({ _id: String(apiKeyId) }, (err, updatedDoc) => {
          if (err) return reject(err);
          resolve(updatedDoc);
        });
      });
    });
  });
}

function removeSLAFromAPIKey(apiKeyId, slaId) {
  return new Promise((resolve, reject) => {
    db.findOne({ _id: String(apiKeyId) }, (err, doc) => {
      if (err) return reject(err);
      if (!doc) return reject(new Error('API Key not found'));
      
      const slas = doc.slas || [];
      const index = slas.indexOf(slaId);
      if (index > -1) {
        slas.splice(index, 1);
      }
      
      db.update({ _id: String(apiKeyId) }, { $set: { slas } }, {}, (err, numReplaced) => {
        if (err) return reject(err);
        db.findOne({ _id: String(apiKeyId) }, (err, updatedDoc) => {
          if (err) return reject(err);
          resolve(updatedDoc);
        });
      });
    });
  });
}

module.exports = {
  getAll,
  findAPIKey,
  addAPIKey,
  updateAPIKey,
  removeAPIKey,
  addSLAToAPIKey,
  removeSLAFromAPIKey
};
