import express, { Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";

import { createArticle } from "../controllers/articleController";

const router = express.Router();

router.get("/", (req: Request, res: Response) => {
  res.send("Welcome Home");
});


router.post("/", authenticate, upload, createArticle);


export default router;
