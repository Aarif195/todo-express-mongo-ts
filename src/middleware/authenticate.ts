import { Request, Response } from "express";
import { getUsersCollection } from "../utils/helpers";

// AUTHENTICATION
export async function authenticate(req: Request) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return null;

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  const token = parts[1];

  const usersCol = getUsersCollection(); // MongoDB
  const user = await usersCol.findOne({ token });

  return user || null;
}

module.exports = { authenticate };
