const path = require('path');
const Datastore = require('nedb');

const dbFile = path.join(__dirname, '..', 'data', 'slatemplates.db');
const db = new Datastore({ filename: dbFile, autoload: true });

function getAll() {
  return new Promise((resolve, reject) => {
    db.find({}, (err, docs) => {
      if (err) return reject(err);
      resolve(docs || []);
    });
  });
}

function findTemplate(id) {
  return new Promise((resolve, reject) => {
    db.findOne({ _id: String(id) }, (err, doc) => {
      if (err) return reject(err);
      resolve(doc || null);
    });
  });
}

function addTemplate(id, templateInfo) {
  const doc = Object.assign({}, templateInfo, { _id: String(id) });
  return new Promise((resolve, reject) => {
    db.update({ _id: doc._id }, doc, { upsert: true }, (err) => {
      if (err) return reject(err);
      resolve(doc);
    });
  });
}

function updateTemplate(id, updates) {
  return new Promise((resolve, reject) => {
    db.update({ _id: String(id) }, { $set: updates }, {}, (err, numReplaced) => {
      if (err) return reject(err);
      if (numReplaced === 0) return reject(new Error('Template not found'));
      db.findOne({ _id: String(id) }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  });
}

function removeTemplate(id) {
  return new Promise((resolve, reject) => {
    db.remove({ _id: String(id) }, {}, (err, numRemoved) => {
      if (err) return reject(err);
      resolve(numRemoved);
    });
  });
}

module.exports = {
  getAll,
  findTemplate,
  addTemplate,
  updateTemplate,
  removeTemplate
};
