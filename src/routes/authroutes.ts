import express, { Request, Response } from "express";
import { login , register} from "../controllers/authController";
const router = express.Router();

router.get("/", (req: Request, res: Response) => {
  res.send("Welcome Auth");
});


router.post("/register", register);
router.post("/login", login);


export default router;
