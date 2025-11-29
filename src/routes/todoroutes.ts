import express, { Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { upload } from "../middleware/upload";

import { createTask } from "../controllers/articleController";

const router = express.Router();

router.get("/", (req: Request, res: Response) => {
  res.send("Welcome Home");
});


router.post("/", authenticate, upload, createTask);


export default router;
