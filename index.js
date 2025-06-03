const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const chromium = require('chrome-aws-lambda');

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
    const isProduction = !!process.env.AWS_REGION || process.env.NODE_ENV === 'production';

    browser = await puppeteer.launch({
      args: isProduction ? chromium.args : [],
      executablePath: isProduction ? await chromium.executablePath : undefined,
      defaultViewport: chromium.defaultViewport,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(link, { waitUntil: 'networkidle2' });

    const videoInfo = await page.evaluate(() => {
      const scriptTags = Array.from(document.querySelectorAll('script'));
      const targetScript = scriptTags.find(tag => tag.textContent.includes('window.playinfo'));
      if (!targetScript) return null;

      const match = targetScript.textContent.match(/window\.playinfo\s*=\s*(\{.*?\});/);
      if (!match) return null;

      try {
        const playinfo = JSON.parse(match[1]);
        const qualities = {};
        (playinfo.media || []).forEach(item => {
          qualities[item.quality] = item.url;
        });
        return qualities;
      } catch (e) {
        return null;
      }
    });

    await browser.close();

    if (!videoInfo || Object.keys(videoInfo).length === 0) {
      return res.status(500).json({ error: 'Could not extract video URLs' });
    }

    res.json({
      name: 'Terabox Video',
      links: videoInfo
    });

  } catch (error) {
    if (browser) await browser.close();
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
