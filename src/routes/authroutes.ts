import express from "express";
import { authenticate } from "../middleware/authenticate";

import { login , register} from "../controllers/authController";


const router = express.Router();

// router.get("/", (req: Request, res: Response) => {
//   res.send("Welcome Auth");
// });


router.post("/register", register);
router.post("/login", login);


export default router;
