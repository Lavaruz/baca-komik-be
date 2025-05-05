import { Request, Response } from "express";
import Chapter from "../models/Chapter";
import Comic from "../models/Comic";
import { validationResult } from "express-validator";
import cloudinary from "../config/coudinary";

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
  const { comicSlug, chapterSlug } = req.params;

  try {
    // Cari komik berdasarkan slug
    const comic = await Comic.findOne({
      where: { slug: comicSlug }
    });

    if (!comic) {
      return res.status(404).json({ message: "Komik tidak ditemukan" });
    }

    // Cari chapter berdasarkan slug dan comicId
    const chapter = await Chapter.findOne({
      where: {
        slug: chapterSlug,
        comicId: comic.id
      },
      include: [{
        model: Comic,
        as: 'comic',
        attributes: ['title', 'slug']
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

const uploadToCloudinary = async (file: Express.Multer.File, folder: string): Promise<string> => {
  const maxRetries = 3;
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < maxRetries) {
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "image",
          },
          (err, result) => {
            if (err) {
              console.error('Cloudinary upload error:', err);
              return reject(err);
            }
            if (!result) {
              return reject(new Error('Upload failed'));
            }
            resolve(result.secure_url);
          }
        );

        // Upload dari buffer
        uploadStream.end(file.buffer);
      });

      return result;
    } catch (error) {
      lastError = error as Error;
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`Retrying upload (${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }

  throw lastError || new Error('Upload failed after retries');
};

export const AddChapter = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { comicSlug } = req.params;
  const { title, slug } = req.body;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ message: "Tidak ada gambar yang diupload" });
  }

  try {
    // Cari komik berdasarkan slug
    const comic = await Comic.findOne({
      where: { slug: comicSlug }
    });

    if (!comic) {
      return res.status(404).json({ message: "Komik tidak ditemukan" });
    }

    // Cek apakah chapter dengan slug yang sama sudah ada
    const existingChapter = await Chapter.findOne({
      where: {
        slug,
        comicId: comic.id
      }
    });

    if (existingChapter) {
      return res.status(409).json({ message: "Chapter dengan slug tersebut sudah ada" });
    }

    // Urutkan file berdasarkan nama asli
    const extractNumber = (filename: string): number => {
      const match = filename.match(/\d+/g); // ambil semua angka
      if (!match) return 0;
      return parseInt(match[0]); // ambil angka pertama yang muncul
    };
    
    const sortedFiles = [...files].sort((a, b) => {
      const numA = extractNumber(a.originalname);
      const numB = extractNumber(b.originalname);
      return  numA - numB;
    });

    // Upload gambar ke Cloudinary
    const uploadedUrls: string[] = [];
    const folder = `comics/${comicSlug}/chapters/${slug}`;

    try {
      // Upload semua file secara paralel
      const uploadPromises = sortedFiles.map(file => 
        uploadToCloudinary(file, folder)
      );

      const results = await Promise.all(uploadPromises);
      uploadedUrls.push(...results);
    } catch (uploadError) {
      console.error('Error uploading to Cloudinary:', uploadError);
      // Jika ada error saat upload, hapus gambar yang sudah terupload
      for (const uploadedUrl of uploadedUrls) {
        const publicId = uploadedUrl
          .split('/')
          .slice(uploadedUrl.split('/').indexOf('comics'))
          .join('/')
          .replace(/\.[^/.]+$/, "");
        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
        }
      }
      return res.status(500).json({ message: "Gagal mengupload gambar" });
    }

    // Buat chapter baru
    const newChapter = await Chapter.create({
      comicId: comic.id,
      title,
      slug,
      pages: uploadedUrls,
      releaseDate: new Date()
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
