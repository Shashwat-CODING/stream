const axios = require('axios');
const fs = require('fs');

// --- Config ---
const videoId = "G9wBwVnn4m0";
const url = `https://m.youtube.com/watch?v=${videoId}`;

// --- Dynamic cookies logic ---
async function fetchRemoteCookies() {
    try {
        const resp = await axios.get('http://34.131.128.7:5000/cookies', { timeout: 10000000 });
        if (resp.data && Array.isArray(resp.data.cookies)) {
            return resp.data.cookies.map(c => `${c.name}=${c.value}`).join('; ');
        } else if (resp.data && Array.isArray(resp.data)) {
            // fallback: if response is just an array
            return resp.data.map(c => `${c.name}=${c.value}`).join('; ');
        } else {
            throw new Error('Invalid cookies API response');
        }
    } catch (err) {
        throw new Error('❌ Failed to fetch cookies: ' + err.message);
    }
}

/**
 * Extract ytInitialPlayerResponse from HTML
 */
function extractPlayerResponse(html) {
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/s);
    if (!match) throw new Error("❌ ytInitialPlayerResponse not found");
    return JSON.parse(match[1]);
}

/**
 * Fetch MWEB YouTube HTML and extract player response
 */
async function fetchMwebPlayerResponse() {
    const cookieHeader = await fetchRemoteCookies();
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://m.youtube.com/',
        'Cookie': cookieHeader,
    };

    console.log(`🌐 Fetching HTML from MWEB...`);
    const res = await axios.get(url, { headers });
    const html = res.data;

    console.log(`🔍 Extracting ytInitialPlayerResponse...`);
    const playerResponse = extractPlayerResponse(html);

    fs.writeFileSync('mweb_player_response.json', JSON.stringify(playerResponse, null, 2));
    console.log(`✅ Saved to mweb_player_response.json`);

    // Optional: log audio/video URLs
    const streamingData = playerResponse.streamingData || {};
    const formats = streamingData.formats || [];
    const adaptiveFormats = streamingData.adaptiveFormats || [];

    const urls = [...formats, ...adaptiveFormats]
        .map(f => ({ mime: f.mimeType, url: f.url || f.signatureCipher }))
        .filter(f => f.url);

    console.log("\n🎵 Available Streams:");
    urls.forEach((u, i) => {
        console.log(`${i + 1}. ${u.mime}`);
        console.log(`    ${decodeURIComponent(u.url.split('&').find(p => p.startsWith('url='))?.slice(4) || u.url)}\n`);
    });
}

fetchMwebPlayerResponse().catch(err => {
    console.error("❌ Error:", err.message);
});
