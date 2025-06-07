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
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const videoResponses = new Set();

    // Track video responses
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.mp4') || url.includes('.m3u8')) {
        videoResponses.add(url);
      }
    });

    await page.goto(link, { waitUntil: 'networkidle2' });

    // Try clicking play if it exists
    try {
      await page.waitForSelector('iframe', { timeout: 5000 });
      const frames = page.frames();
      const iframe = frames.find(f => f.url().includes('terabox') || f.name());

      if (iframe) {
        await iframe.click('video, button, .play-button, .vjs-big-play-button');
        await new Promise((r) => setTimeout(r, 8000));
      } else {
        await new Promise((r) => setTimeout(r, 8000));
      }
    } catch (err) {
      await new Promise((r) => setTimeout(r, 8000));
    }

    await browser.close();

    if (videoResponses.size === 0) {
      return res.status(500).json({ error: 'Could not extract video URLs' });
    }

    const links = {};
    [...videoResponses].forEach((url, i) => {
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
