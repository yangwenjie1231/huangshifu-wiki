import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/music/song/:id", async (req, res) => {
    const { id } = req.params;
    const url = `https://music.163.com/song?id=${id}`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      const $ = cheerio.load(response.data);
      const metadata: any = {
        id,
        audioUrl: `https://music.163.com/song/media/outer/url?id=${id}.mp3`,
      };

      $('meta').each((_, el) => {
        const property = $(el).attr('property');
        const content = $(el).attr('content');

        if (property === 'og:title') metadata.title = content;
        if (property === 'og:image') metadata.cover = content;
        if (property === 'og:music:artist') metadata.artist = content;
        if (property === 'og:music:album') metadata.album = content;
      });

      // Try to get lyrics
      try {
        const lrcResponse = await axios.get(`https://music.163.com/api/song/media?id=${id}`);
        if (lrcResponse.data && lrcResponse.data.lyric) {
          metadata.lyric = lrcResponse.data.lyric;
        }
      } catch (e) {
        console.error("Error fetching lyrics:", e);
      }

      res.json(metadata);
    } catch (e) {
      console.error("Error fetching song metadata:", e);
      res.status(500).json({ error: "Failed to fetch song metadata" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
