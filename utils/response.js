// Lightweight response helpers to reduce repetition in route handlers
module.exports = {
  success(res, payload = {}, status = 200) {
    // If payload already contains a `success` boolean, prefer it, otherwise set true
    const body = Object.assign({ success: true }, payload);
    return res.status(status).json(body);
  },

  created(res, payload = {}) {
    const body = Object.assign({ success: true }, payload);
    return res.status(201).json(body);
  },

  error(res, message = 'Internal server error', status = 500, extra = {}) {
    const body = Object.assign({ success: false, error: message }, extra);
    return res.status(status).json(body);
  }
};
