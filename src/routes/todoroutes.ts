import express, { Request, Response } from "express";
import { createArticle } from "../controllers/articleController";

const router = express.Router();

router.get("/", (req: Request, res: Response) => {
  res.send("Welcome Home");
});


router.post("/articles", createArticle);


export default router;
