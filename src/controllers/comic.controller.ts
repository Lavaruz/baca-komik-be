import Comic from "../models/Comic";
import {Request, Response} from "express"
import { validationResult } from "express-validator";
import { Op } from "sequelize";
import Chapter from "../models/Chapter";
import cloudinary from "../config/coudinary";
import { Readable } from "stream";
import fs from 'fs';

export const GetAllComics = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const { count, rows: comics } = await Comic.findAndCountAll({
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json({
        data: comics,
        pagination: {
          total: count,
          page,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Error in GetAllComics:', error);
      return res.status(500).json({
        message: "Terjadi kesalahan server",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
};

export const GetComicBySlug = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const slug = req.params.slug;
  try {
    const comic = await Comic.findOne({
      where: {
        slug: {
          [Op.eq]: slug
        }
      },
    });

    if (!comic) {
      return res.status(404).json({ message: "Komik tidak ditemukan" });
    }

    return res.status(200).json(comic);
  } catch (error) {
    console.error('Error in GetComicBySlug:', error);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const GetComicChapterBySlug = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const slug = req.params.slug;
  try {
    const comic = await Comic.findOne({
      where: {
        slug: {
          [Op.eq]: slug
        }
      }
    });

    if (!comic) {
      return res.status(404).json({ message: "Komik tidak ditemukan" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const chapters = await Chapter.findAndCountAll({
      where: { comicId: comic.id },
      limit,
      offset,
      // order: [['chapterNumber', 'ASC']]
    });

    return res.status(200).json({
      data: chapters.rows,
      pagination: {
        total: chapters.count,
        page,
        totalPages: Math.ceil(chapters.count / limit)
      }
    });
  } catch (error) {
    console.error('Error in GetComicChapterBySlug:', error);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const AddComic = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const comicData = req.body;
  const coverImage = req.files?.[0];

  if (!coverImage) {
    return res.status(400).json({ message: "Gambar cover diperlukan" });
  }

  try {
    // Cek apakah komik dengan slug yang sama sudah ada
    const existingComic = await Comic.findOne({
      where: {
        slug: comicData.slug
      }
    });

    if (existingComic) {
      return res.status(409).json({ message: "Komik dengan slug tersebut sudah ada" });
    }

    // Upload gambar cover ke Cloudinary
    const result = await new Promise<string>((resolve, reject) => {
      // Baca file dari path
      const fileStream = fs.createReadStream(coverImage.path);
      
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `comics/${comicData.slug}/cover`,
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

      fileStream.pipe(uploadStream);
    });

    // Hapus file temporary setelah diupload
    fs.unlink(coverImage.path, (err) => {
      if (err) console.error('Error deleting temporary file:', err);
    });

    // Buat komik baru dengan URL gambar dari Cloudinary
    const newComic = await Comic.create({
      ...comicData,
      coverImage: result
    });

    return res.status(201).json({
      message: "Berhasil menambahkan komik baru",
      data: newComic
    });
  } catch (error) {
    console.error('Error in AddComic:', error);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const UpdateComic = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { slug } = req.params;
  const updateData = req.body;

  try {
    // Cek apakah komik ada
    const comic = await Comic.findOne({
      where: {
        slug: {
          [Op.eq]: slug
        }
      }
    });

    if (!comic) {
      return res.status(404).json({ message: "Komik tidak ditemukan" });
    }

    // Jika slug diubah, cek apakah slug baru sudah ada
    if (updateData.slug && updateData.slug !== slug) {
      const existingComic = await Comic.findOne({
        where: {
          slug: updateData.slug
        }
      });

      if (existingComic) {
        return res.status(409).json({ message: "Slug sudah digunakan oleh komik lain" });
      }
    }

    // Update komik
    await comic.update(updateData);

    // Ambil data terbaru setelah update
    const updatedComic = await Comic.findOne({
      where: {
        slug: updateData.slug || slug
      }
    });

    return res.status(200).json({
      message: "Komik berhasil diperbarui",
      data: updatedComic
    });
  } catch (error) {
    console.error('Error in UpdateComic:', error);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const DeleteComic = async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    // Cek apakah komik ada
    const comic = await Comic.findOne({
      where: {
        slug: {
          [Op.eq]: slug
        }
      }
    });

    if (!comic) {
      return res.status(404).json({ message: "Komik tidak ditemukan" });
    }

    // Hapus semua chapter terkait
    await Chapter.destroy({
      where: {
        comicId: comic.id
      }
    });

    // Hapus komik
    await comic.destroy();

    return res.status(200).json({
      message: "Komik berhasil dihapus"
    });
  } catch (error) {
    console.error('Error in DeleteComic:', error);
    return res.status(500).json({
      message: "Terjadi kesalahan server",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};