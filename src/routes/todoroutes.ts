import express, { Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { upload } from "../middleware/upload";

import { createTask, getTasks } from "../controllers/articleController";

const router = express.Router();




router.post("/", authenticate, upload, createTask);
router.get("/", getTasks);


export default router;
