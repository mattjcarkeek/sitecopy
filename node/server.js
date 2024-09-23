const express = require('express');
const path = require('path');
const cors = require('cors');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required and must be a string', status: 'error' });
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid URL protocol');
    }

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(parsedUrl.href, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    const html = await page.content();
    await browser.close();

    const $ = cheerio.load(html);
    const mainContent = $('main');
    const h1Content = mainContent.find('h1.post-title').prop('outerHTML') || '';
    const articleContent = mainContent.find('article').html() || '';

    let combinedContent = h1Content + articleContent;

  // Perform the text replacement
  combinedContent = combinedContent.replace(/\b(?<!Manage My )Nightlife\b/g, "AMS Nightlife");

    const mainImage = mainContent.find('img.wp-post-image').first().attr('src');
    const figureImages = mainContent.find('figure img').map((i, el) => {
      const src = $(el).attr('data-src') || $(el).attr('src');
      return src && src.startsWith('https://') ? src : null;
    }).get();

    const articleImages = [mainImage, ...figureImages].filter(Boolean);

    console.log(`Found ${articleImages.length} valid images in the article`);

    const downloadedImages = [];

    for (const imgSrc of articleImages) {
      const imgName = path.basename(imgSrc).split('?')[0];
      try {
        console.log(`Attempting to download: ${imgSrc}`);
        const response = await axios.get(imgSrc, { responseType: 'arraybuffer' });
        if (response.headers['content-type'].startsWith('image/')) {
          const buffer = Buffer.from(response.data, 'binary');
          fs.writeFileSync(path.join(__dirname, 'downloads', imgName), buffer);
          downloadedImages.push(imgName);
          console.log(`Successfully downloaded: ${imgName}`);
        }
      } catch (imgError) {
        console.error(`Error downloading image ${imgSrc}:`, imgError.message);
      }
    }

    console.log(`Total images downloaded: ${downloadedImages.length}`);

    res.json({ content: combinedContent, images: downloadedImages, status: 'success' });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(400).json({ error: error.message, status: 'error' });
  }
});

app.post('/delete-images', (req, res) => {
  const { images } = req.body;
  images.forEach(image => {
    const imagePath = path.join(__dirname, 'downloads', image);
    fs.unlink(imagePath, (err) => {
      if (err) console.error(`Error deleting ${image}:`, err);
      else console.log(`Successfully deleted ${image}`);
    });
  });
  res.json({ status: 'success', message: 'Images deleted' });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
