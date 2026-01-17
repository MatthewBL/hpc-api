const path = require('path');
const Datastore = require('nedb');

const dbFile = path.join(__dirname, '..', 'data', 'slas.db');
const db = new Datastore({ filename: dbFile, autoload: true });

function getAll() {
  return new Promise((resolve, reject) => {
    db.find({}, (err, docs) => {
      if (err) return reject(err);
      resolve(docs || []);
    });
  });
}

function findSLA(id) {
  return new Promise((resolve, reject) => {
    db.findOne({ _id: String(id) }, (err, doc) => {
      if (err) return reject(err);
      resolve(doc || null);
    });
  });
}

function addSLA(id, slaInfo) {
  const doc = Object.assign({}, slaInfo, { _id: String(id) });
  return new Promise((resolve, reject) => {
    db.update({ _id: doc._id }, doc, { upsert: true }, (err) => {
      if (err) return reject(err);
      resolve(doc);
    });
  });
}

function updateSLA(id, updates) {
  return new Promise((resolve, reject) => {
    db.update({ _id: String(id) }, { $set: updates }, {}, (err, numReplaced) => {
      if (err) return reject(err);
      if (numReplaced === 0) return reject(new Error('SLA not found'));
      db.findOne({ _id: String(id) }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  });
}

function removeSLA(id) {
  return new Promise((resolve, reject) => {
    db.remove({ _id: String(id) }, {}, (err, numRemoved) => {
      if (err) return reject(err);
      resolve(numRemoved);
    });
  });
}

function findByApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    db.find({ apiKey: String(apiKey) }, (err, docs) => {
      if (err) return reject(err);
      resolve(docs || []);
    });
  });
}

module.exports = {
  getAll,
  findSLA,
  addSLA,
  updateSLA,
  removeSLA,
  findByApiKey
};
