const express = require('express');
const axios = require('axios');
const sig = require('./sig_stuff/sig.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Read cookies from old/cookies.json
function getCookies() {
    const cookiesPath = 'cookies.json';
    if (!fs.existsSync(cookiesPath)) {
        throw new Error('cookies.json not found');
    }
    const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    if (Array.isArray(cookiesData)) {
        return cookiesData.map(c => `${c.name}=${c.value}`).join('; ');
    } else if (typeof cookiesData === 'object') {
        return Object.entries(cookiesData).map(([k, v]) => `${k}=${v}`).join('; ');
    } else {
        throw new Error('Invalid cookies.json format');
    }
}

// Helper: Extract ytInitialPlayerResponse from HTML
function extractPlayerResponse(html) {
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/s);
    if (!match) throw new Error('ytInitialPlayerResponse not found');
    return JSON.parse(match[1]);
}

// Helper: Fetch and extract player response for a video ID
async function fetchPlayerResponse(videoId) {
    const url = `https://m.youtube.com/watch?v=${videoId}`;
    const cookieHeader = getCookies();
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://m.youtube.com/',
        'Cookie': cookieHeader,
    };
    const res = await axios.get(url, { headers });
    return extractPlayerResponse(res.data);
}

// Helper: Decipher formats using sig.js
async function decipherFormats(formats, html5player) {
    // sig.decipherFormats expects (formats, html5player, options)
    return await sig.decipherFormats(formats, html5player, {});
}

app.get('/streams/:id', async (req, res) => {
    const videoId = req.params.id;
    try {
        // 1. Fetch player response
        const playerResponse = await fetchPlayerResponse(videoId);
        const streamingData = playerResponse.streamingData;
        if (!streamingData) {
            return res.status(404).json({ error: 'No streamingData found in player response.' });
        }
        // 2. Collect all formats
        const allFormats = [
            ...(streamingData.formats || []),
            ...(streamingData.adaptiveFormats || [])
        ];
        // 3. Get html5player URL (fallback to a default if not found)
        let html5player = null;
        // Try to extract from playerResponse or use a default
        if (playerResponse?.assets?.js) {
            html5player = 'https://www.youtube.com' + playerResponse.assets.js;
        } else {
            // fallback: use a known working player js
            html5player = 'https://www.youtube.com/s/player/69b31e11/player-plasma-ias-tablet-en_US.vflset/base.js';
        }
        // 4. Decipher formats
        const deciphered = await decipherFormats(allFormats, html5player);
        // 5. Respond with deciphered formats
        res.json({
            videoId,
            title: playerResponse.videoDetails?.title,
            formats: deciphered
        });
    } catch (err) {
        console.error('Error in /streams/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
}); 
