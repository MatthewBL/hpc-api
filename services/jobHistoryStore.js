const path = require('path');
const Datastore = require('nedb');
const JobHistory = require('../models/jobHistory');

const dbFile = path.join(__dirname, '..', 'data', 'jobHistory.db');
const db = new Datastore({ filename: dbFile, autoload: true });

/**
 * Get all job history entries
 * @returns {Promise<Array>}
 */
function getAll() {
  return new Promise((resolve, reject) => {
    db.find({}, (err, docs) => {
      if (err) return reject(err);
      resolve(docs || []);
    });
  });
}

/**
 * Find a job history entry by job ID
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
function findJob(jobId) {
  return new Promise((resolve, reject) => {
    db.findOne({ _id: String(jobId) }, (err, doc) => {
      if (err) return reject(err);
      resolve(doc || null);
    });
  });
}

/**
 * Find all job history entries for a model
 * @param {string} modelId
 * @returns {Promise<Array>}
 */
function findByModel(modelId) {
  return new Promise((resolve, reject) => {
    db.find({ modelId: String(modelId) }, (err, docs) => {
      if (err) return reject(err);
      resolve(docs || []);
    });
  });
}

/**
 * Add or update a job history entry
 * @param {string} jobId
 * @param {Object} jobHistoryInfo
 * @returns {Promise<Object>}
 */
function addJob(jobId, jobHistoryInfo) {
  // Validate using JobHistory class
  const entry = new JobHistory(Object.assign({ jobId }, jobHistoryInfo));
  const doc = Object.assign({}, entry.toJSON(), { _id: String(jobId) });
  
  return new Promise((resolve, reject) => {
    // upsert so we don't create duplicates
    db.update({ _id: doc._id }, doc, { upsert: true }, (err) => {
      if (err) return reject(err);
      resolve(doc);
    });
  });
}

/**
 * Update the status of a job history entry
 * @param {string} jobId
 * @param {string} newStatus - 'ongoing' or 'ended'
 * @returns {Promise<Object>}
 */
function updateJobStatus(jobId, newStatus) {
  return new Promise((resolve, reject) => {
    db.findOne({ _id: String(jobId) }, (err, doc) => {
      if (err) return reject(err);
      if (!doc) return resolve(null);

      const updated = Object.assign({}, doc, { status: newStatus });
      if (newStatus === 'ended' && !updated.endTime) {
        updated.endTime = new Date().toISOString();
      }

      db.update({ _id: doc._id }, updated, {}, (updateErr) => {
        if (updateErr) return reject(updateErr);
        resolve(updated);
      });
    });
  });
}

/**
 * Remove a job history entry
 * @param {string} jobId
 * @returns {Promise<number>} - number of documents removed
 */
function removeJob(jobId) {
  return new Promise((resolve, reject) => {
    db.remove({ _id: String(jobId) }, {}, (err, numRemoved) => {
      if (err) return reject(err);
      resolve(numRemoved);
    });
  });
}

/**
 * Remove all job history entries
 * @returns {Promise<number>} - number of documents removed
 */
function removeAll() {
  return new Promise((resolve, reject) => {
    db.remove({}, { multi: true }, (err, numRemoved) => {
      if (err) return reject(err);
      resolve(numRemoved);
    });
  });
}

module.exports = {
  getAll,
  findJob,
  findByModel,
  addJob,
  updateJobStatus,
  removeJob,
  removeAll
};
