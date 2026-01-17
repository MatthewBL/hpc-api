const path = require('path');
const Datastore = require('nedb');

const dbFile = path.join(__dirname, '..', 'data', 'researchers.db');
const db = new Datastore({ filename: dbFile, autoload: true });

function getAll() {
  return new Promise((resolve, reject) => {
    db.find({}, (err, docs) => {
      if (err) return reject(err);
      resolve(docs || []);
    });
  });
}

function findResearcher(id) {
  return new Promise((resolve, reject) => {
    db.findOne({ _id: String(id) }, (err, doc) => {
      if (err) return reject(err);
      resolve(doc || null);
    });
  });
}

function addResearcher(id, researcherInfo) {
  const doc = Object.assign({}, researcherInfo, { _id: String(id) });
  return new Promise((resolve, reject) => {
    db.update({ _id: doc._id }, doc, { upsert: true }, (err) => {
      if (err) return reject(err);
      resolve(doc);
    });
  });
}

function updateResearcher(id, updates) {
  return new Promise((resolve, reject) => {
    db.update({ _id: String(id) }, { $set: updates }, {}, (err, numReplaced) => {
      if (err) return reject(err);
      if (numReplaced === 0) {
        return reject(new Error('Researcher not found'));
      }
      // Fetch the updated document
      db.findOne({ _id: String(id) }, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  });
}

function removeResearcher(id) {
  return new Promise((resolve, reject) => {
    db.remove({ _id: String(id) }, {}, (err, numRemoved) => {
      if (err) return reject(err);
      resolve(numRemoved);
    });
  });
}

module.exports = {
  getAll,
  findResearcher,
  addResearcher,
  updateResearcher,
  removeResearcher
};
