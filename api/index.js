// Vercel Serverless Function entry point
// Connects Vercel's serverless runtime directly to the Express server
const app = require('../backend/server.js');

module.exports = app;
