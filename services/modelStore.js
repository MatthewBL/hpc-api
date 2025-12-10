const path = require('path');
const Datastore = require('nedb');

const dbFile = path.join(__dirname, '..', 'data', 'models.db');
const db = new Datastore({ filename: dbFile, autoload: true });

function getAll() {
  return new Promise((resolve, reject) => {
    db.find({}, (err, docs) => {
      if (err) return reject(err);
      resolve(docs || []);
    });
  });
}

function findModel(id) {
  return new Promise((resolve, reject) => {
    db.findOne({ _id: String(id) }, (err, doc) => {
      if (err) return reject(err);
      resolve(doc || null);
    });
  });
}

function addModel(id, modelInfo) {
  const doc = Object.assign({}, modelInfo, { _id: String(id) });
  return new Promise((resolve, reject) => {
    db.update({ _id: doc._id }, doc, { upsert: true }, (err) => {
      if (err) return reject(err);
      resolve(doc);
    });
  });
}

function removeModel(id) {
  return new Promise((resolve, reject) => {
    db.remove({ _id: String(id) }, {}, (err, numRemoved) => {
      if (err) return reject(err);
      resolve(numRemoved);
    });
  });
}

module.exports = {
  getAll,
  findModel,
  addModel,
  removeModel
};
