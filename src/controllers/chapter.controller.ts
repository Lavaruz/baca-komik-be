import { Request, Response } from "express";
import Chapter from "../models/Chapter";
import Comic from "../models/Comic";
import { validationResult } from "express-validator";
import r2 from "../config/vendor/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3"

export const GetAllChapter = async (req: Request, res: Response) => {
  try {
    const CHAPTERS = await Chapter.findAll();

    return res.status(200).json(CHAPTERS);
  } catch (error) {
    console.error('Error in GetAllChapter:', error);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const GetChapterBySlug = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Cari chapter berdasarkan slug dan comicId
    const chapter = await Chapter.findByPk(id,{
      include: [{
        model: Comic,
        as: 'comic',
        // attributes: ['title', 'slug']
      }]
    });

    if (!chapter) {
      return res.status(404).json({ message: "Chapter tidak ditemukan" });
    }

    return res.status(200).json(chapter);
  } catch (error) {
    console.error('Error in GetChapterBySlug:', error);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const AddChapter = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { comicSlug } = req.params;
  const { title } = req.body;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ message: "Tidak ada gambar yang diupload" });
  }

  try {
    // Cari komik berdasarkan slug
    const comic = await Comic.findOne({where: { slug: comicSlug }});

    if (!comic) {
      return res.status(404).json({ message: "Komik tidak ditemukan" });
    }

    // Urutkan file berdasarkan angka dalam nama file
    const extractNumber = (filename: string): number => {
      const match = filename.match(/\d+/g);
      return match ? parseInt(match[0]) : 0;
    };

    const sortedFiles = [...files].sort((a, b) => {
      return extractNumber(a.originalname) - extractNumber(b.originalname);
    });

    const uploadedUrls: string[] = [];

    // Upload satu per satu ke R2 (bisa dibuat paralel jika mau)
    for (const file of sortedFiles) {
      const key = `${comicSlug}/chapters-${(await Chapter.count({where: { slug: comicSlug }})+1)}/${Date.now()}-${file.originalname}`;

      const params = {
        Bucket: "gatedoujin",
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      await r2.send(new PutObjectCommand(params));

      // Simpan URL atau key, tergantung cara akses
      uploadedUrls.push(key); // Simpan key, nanti diakses via CDN URL + key
    }

    

    // Simpan chapter baru
    const newChapter = await Chapter.create({
      comicId: comic.id,
      title,
      slug: comicSlug,
      pages: uploadedUrls, // simpan array of string path R2
      releaseDate: new Date(),
      chapterNumber: (await comic.countChapters()) + 1
    });

    return res.status(201).json({
      message: "Chapter berhasil ditambahkan",
      data: newChapter
    });

  } catch (error) {
    console.error('Error in AddChapter:', error);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')      // hapus karakter selain huruf, angka, spasi, dan strip
    .replace(/[\s_]+/g, '-')       // ganti spasi atau underscore dengan strip
    .replace(/-+/g, '-')           // hapus duplikat strip
    .trim();                       // hapus spasi di awal/akhir
}