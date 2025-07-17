const express = require('express');
const axios = require('axios');
const sig = require('./sig_stuff/sig.js');

const app = express();
const PORT = 3000;

// --- Dynamic cookies logic ---
let cookiesHeader = '';
let cookiesReady = false;

async function fetchRemoteCookies() {
    try {
        const resp = await axios.get('http://34.131.128.7:5000/cookies', { timeout: 10000000 });
        if (resp.data && Array.isArray(resp.data.cookies)) {
            cookiesHeader = resp.data.cookies.map(c => `${c.name}=${c.value}`).join('; ');
            cookiesReady = true;
            console.log('✅ Cookies fetched and ready.');
        } else if (resp.data && Array.isArray(resp.data)) {
            // fallback: if response is just an array
            cookiesHeader = resp.data.map(c => `${c.name}=${c.value}`).join('; ');
            cookiesReady = true;
            console.log('✅ Cookies fetched and ready.');
        } else {
            throw new Error('Invalid cookies API response');
        }
    } catch (err) {
        cookiesReady = false;
        console.error('❌ Failed to fetch cookies:', err.message);
    }
}

// Fetch cookies on startup and every 5 hours
fetchRemoteCookies();
setInterval(fetchRemoteCookies, 5 * 60 * 60 * 1000); // 5 hours

// Helper: Extract ytInitialPlayerResponse from HTML
function extractPlayerResponse(html) {
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/s);
    if (!match) throw new Error('ytInitialPlayerResponse not found');
    return JSON.parse(match[1]);
}

// Helper: Fetch and extract player response for a video ID
async function fetchPlayerResponse(videoId) {
    if (!cookiesReady) {
        throw new Error('Cookies not loaded yet, please try again in a moment.');
    }
    const url = `https://m.youtube.com/watch?v=${videoId}`;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://m.youtube.com/',
        'Cookie': cookiesHeader,
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
        if (!cookiesReady) {
            return res.status(503).json({ error: 'Cookies not loaded yet, please try again in a moment.' });
        }
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