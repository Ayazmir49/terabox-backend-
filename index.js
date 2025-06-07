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
  if (!link) return res.status(400).json({ error: 'Link required' });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Array to collect detected video URLs
    const videoResponses = [];

    // Listen to all network responses to detect video URLs
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.mp4') || url.includes('.m3u8')) {
        videoResponses.push(url);
      }
    });

    // Go to the Terabox shared link page
    await page.goto(link, { waitUntil: 'networkidle2' });

    // Wait some extra seconds to allow any video requests to fire
    await page.waitForTimeout(5000);

    await browser.close();

    if (videoResponses.length === 0) {
      return res.status(500).json({ error: 'Could not extract video URLs' });
    }

    // Format links object with simple keys
    const links = {};
    videoResponses.forEach((url, i) => {
      links[`quality_${i + 1}`] = url;
    });

    res.json({
      name: 'Terabox Video',
      links,
    });

  } catch (error) {
    if (browser) await browser.close();
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
});
