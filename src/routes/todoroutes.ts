import express, { Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { upload } from "../middleware/upload";

import { createTask, getTasks, getTaskById, updateTask, deleteTask , likeTask} from "../controllers/articleController";

const router = express.Router();

router.post("/", authenticate, upload, createTask);
router.get("/", getTasks);
router.get("/:id", getTaskById);
router.put("/:id", authenticate, updateTask);
router.delete('/:id', authenticate, deleteTask);
router.post('/:id/like', authenticate, likeTask);

export default router;
