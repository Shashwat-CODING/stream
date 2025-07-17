"use strict";
const fs = require("fs");
const path = require("path");
const sig = require("./sig_stuff/sig.js");
const utils = require("./sig_stuff/utils.js");

// Read res.json
const resPath = path.join(__dirname, "res.json");
const dePath = path.join(__dirname, "de.json");
const raw = fs.readFileSync(resPath, "utf8");
const data = JSON.parse(raw);

async function main() {
  // Get streamingData
  const streamingData = data.streamingData;
  if (!streamingData) {
    throw new Error("No streamingData found in res.json");
  }

  // Collect all formats
  const allFormats = [
    ...(streamingData.formats || []),
    ...(streamingData.adaptiveFormats || [])
  ];

  const html5player = "https://www.youtube.com/s/player/69b31e11/player-plasma-ias-tablet-en_US.vflset/base.js";

  const deciphered = await sig.decipherFormats(allFormats, html5player, {});

  fs.writeFileSync(dePath, JSON.stringify(deciphered, null, 2));
  console.log(`Deciphered formats written to ${dePath}`);
}

main().catch(err => {
  console.error("Error in yt.js:", err);
  process.exit(1);
}); 