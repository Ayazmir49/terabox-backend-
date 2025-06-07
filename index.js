const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Terabox backend is running ✅');
});

app.post('/fetch', async (req, res) => {
  const { link } = req.body;
  console.log("🔗 Received link:", link);
  if (!link) return res.status(400).json({ error: 'Link required' });

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    console.log("🚀 Browser launched");
    const page = await browser.newPage();

    const videoResponses = [];

    // Intercept network responses
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.mp4') || url.includes('.m3u8')) {
        console.log("🎥 Detected video URL:", url);
        videoResponses.push(url);
      }
    });

    // Visit the link
    await page.goto(link, { waitUntil: 'networkidle2' });
    console.log("✅ Page loaded");

    // Extra wait to allow dynamic content
    await page.waitForTimeout(7000); // Increase timeout to 7s

    await browser.close();
    console.log("🛑 Browser closed");

    if (videoResponses.length === 0) {
      console.log("⚠️ No video URLs detected");
      return res.status(500).json({ error: 'Could not extract video URLs' });
    }

    const links = {};
    videoResponses.forEach((url, i) => {
      links[`quality_${i + 1}`] = url;
    });

    res.json({
      name: 'Terabox Video',
      links,
    });

  } catch (error) {
    console.error("❌ Error occurred:", error);
    if (browser) await browser.close();
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${PORT}`);
});
