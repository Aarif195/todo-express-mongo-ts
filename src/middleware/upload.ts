import multer from "multer";
import { Request } from "express";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

export const upload = multer({ storage }).single("image");
