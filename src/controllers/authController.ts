import  { Request, Response } from "express";
import path from "path";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "../config/db";
import { Todo, Reply, Comment, User } from "../types/todo";
import { sendError, hashPassword , getUsersCollection} from "../utils/helpers";


// REGISTER
export async function register(req: Request, res: Response) {
  try {
    const { username, email, password }: { username: string; email: string; password: string } = req.body;

    // Validation
    if (!username || !email || !password)
      return sendError(res, "All fields are required");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return sendError(res, "Invalid email format");

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(password))
      return sendError(
        res,
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
      );

    const usersCol = getUsersCollection();

    // Unique email check
    if (await usersCol.findOne({ email }))
      return sendError(res, "Email already exists");

    // Unique username check
    if (await usersCol.findOne({ username }))
      return sendError(res, "Username already exists");

    // Create new user
    const newUser: User = {
      username,
      email,
      password: hashPassword(password),
    };

    const result = await usersCol.insertOne(newUser);
    console.log("User successfully inserted with ID:", result.insertedId);
    console.log("New user details:", newUser);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: result.insertedId.toString(),
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
}

// LOGIN
export async function login(req: Request, res: Response) {
  try {
    const { email, password }: { email: string; password: string } = req.body;

    // Validate required fields
    if (!email || !password)
      return sendError(res, "Email and password are required");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return sendError(res, "Invalid email format");

    const usersCol = getUsersCollection();

    // Find user by email
    const user = await usersCol.findOne({ email });

    if (!user || user.password !== hashPassword(password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate a new token for current login
    const token = crypto.randomBytes(24).toString("hex");

    // Update token in MongoDB
    await usersCol.updateMany({}, { $unset: { token: "" } }); // remove old tokens
    await usersCol.updateOne({ _id: user._id }, { $set: { token } }); // set new token for current user

    res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
}


