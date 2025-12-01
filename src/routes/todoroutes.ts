import express, { Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { upload } from "../middleware/upload";

import { createTask, getTasks, getTaskById, updateTask, deleteTask } from "../controllers/articleController";

const router = express.Router();

router.post("/", authenticate, upload, createTask);
router.get("/", getTasks);
router.get("/:id", getTaskById);
router.put("/:id", authenticate, updateTask);
router.delete('/:id', authenticate, deleteTask);


export default router;
