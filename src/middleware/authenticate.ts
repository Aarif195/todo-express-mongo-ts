import { getUsersCollection } from "../utils/helpers";
import { Request, Response, NextFunction } from "express";
import { User } from "../types/todo";

// AUTHENTICATION

interface AuthRequest extends Request {
  user?: User;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "Unauthorized" });

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = parts[1];

  try {
    const usersCol = getUsersCollection();
    const user = await usersCol.findOne({ token });

    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // Attach user to request
    req.user = user;

    next();
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}


module.exports = { authenticate };
