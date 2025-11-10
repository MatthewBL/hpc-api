const path = require('path');
const Datastore = require('nedb');

const dbFile = path.join(__dirname, '..', 'data', 'jobs.db');
const db = new Datastore({ filename: dbFile, autoload: true });

// Ensure an index on _id (job id) is present implicitly via _id

function getAll() {
  return new Promise((resolve, reject) => {
    db.find({}, (err, docs) => {
      if (err) return reject(err);
      resolve(docs || []);
    });
  });
}

function findJob(jobId) {
  return new Promise((resolve, reject) => {
    db.findOne({ _id: jobId }, (err, doc) => {
      if (err) return reject(err);
      resolve(doc || null);
    });
  });
}

function addJob(jobId, jobInfo) {
  const doc = Object.assign({}, jobInfo, { _id: String(jobId) });
  return new Promise((resolve, reject) => {
    // upsert so we don't create duplicates
    db.update({ _id: doc._id }, doc, { upsert: true }, (err) => {
      if (err) return reject(err);
      resolve(doc);
    });
  });
}

function removeJob(jobId) {
  return new Promise((resolve, reject) => {
    db.remove({ _id: String(jobId) }, {}, (err, numRemoved) => {
      if (err) return reject(err);
      resolve(numRemoved);
    });
  });
}

module.exports = {
  getAll,
  findJob,
  addJob,
  removeJob
};
