require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ssyoutube, quality, searchYouTube } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Utility function - Validate YouTube URL
function isValidYouTubeUrl(url) {
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\s]{11})/;
  return youtubeRegex.test(url);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'API is running' });
});

/**
 * GET /api/download/qualities
 * Returns available quality options
 */
app.get('/api/download/qualities', (req, res) => {
  res.json({
    success: true,
    qualities: quality
  });
});

/**
 * GET /api/download/search
 * Search YouTube videos by name/query
 */
app.get('/api/download/search', async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required'
      });
    }

    const maxResults = Math.min(parseInt(limit) || 10, 50);
    const results = await searchYouTube(q.trim(), maxResults);

    res.json({
      success: true,
      query: q,
      results: results,
      count: results.length
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/download/search
 * Search YouTube videos (POST method)
 */
app.post('/api/download/search', async (req, res) => {
  try {
    const { query, limit } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const maxResults = Math.min(parseInt(limit) || 10, 50);
    const results = await searchYouTube(query.trim(), maxResults);

    res.json({
      success: true,
      query: query,
      results: results,
      count: results.length
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/download
 * Downloads YouTube video with specified quality
 */
app.post('/api/download', async (req, res) => {
  try {
    const { url, quality: userQuality } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'YouTube URL is required'
      });
    }

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL format'
      });
    }

    const resolution = userQuality || '720';

    if (!quality.includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: `Invalid quality. Available options: ${quality.join(', ')}`
      });
    }

    const result = await ssyoutube(url, resolution);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/download/batch
 * Download multiple videos at once
 */
app.post('/api/download/batch', async (req, res) => {
  try {
    const { urls, quality: userQuality } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array of YouTube URLs is required'
      });
    }

    if (urls.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 videos per request'
      });
    }

    const resolution = userQuality || '720';

    if (!quality.includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: `Invalid quality. Available options: ${quality.join(', ')}`
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < urls.length; i++) {
      try {
        if (!isValidYouTubeUrl(urls[i])) {
          errors.push({ index: i, url: urls[i], error: 'Invalid YouTube URL' });
          continue;
        }

        const result = await ssyoutube(urls[i], resolution);
        results.push({ index: i, url: urls[i], ...result });
      } catch (error) {
        errors.push({ index: i, url: urls[i], error: error.message });
      }
    }

    res.json({
      success: true,
      successful: results.length,
      failed: errors.length,
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Batch download error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Search API: GET/POST http://localhost:${PORT}/api/download/search`);
  console.log(`Download API: POST http://localhost:${PORT}/api/download`);
});

