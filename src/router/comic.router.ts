import express from "express";
import { decrypt } from "../config/crypto";    
import { 
  GetAllComics, 
  GetComicBySlug, 
  GetComicChapterBySlug,
  UpdateComic,
  DeleteComic,
  AddComic
} from "../controllers/comic.controller";

const comicRouter = express.Router();

comicRouter.get("/", GetAllComics)
comicRouter.get("/:slug", GetComicBySlug)
comicRouter.get("/:slug/chapters", GetComicChapterBySlug)

comicRouter.post("/", AddComic)
comicRouter.put("/:slug", UpdateComic)
comicRouter.delete("/:slug", DeleteComic)

function decodeMiddleware(req, res, next){
    req.body = decrypt(req.body.d)
    if(req.body[0] == "{" || req.body[0] == "["){
        req.body = JSON.parse(req.body)
    }
    next()
}
    
export default comicRouter;