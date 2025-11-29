import express, { Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { Todo, Reply, Comment, User } from "../types/todo";
import { ObjectId } from "mongodb";
import {sendError,  hashPassword ,getTasksCollection, getUsersCollection} from "../utils/helpers";
import { getDb } from "../config/db";

// const db = getDb();
// const tasksCollection = db.collection("tasks");

// Allowed values for tasks
const allowedPriorities = ["low", "medium", "high"];
const allowedStatuses = ["pending", "in-progress", "completed"];
const allowedLabels = ["work", "personal", "urgent", "misc"];

// CREATE TASK 
export const createTask = async (req: any, res: any) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      title,
      description,
      priority,
      status,
      labels,
      completed,
    } = req.body;

    if (!title?.trim()) return res.status(400).json({ message: "Title is required." });
    if (!description?.trim()) return res.status(400).json({ message: "Description is required." });
    if (!priority?.trim()) return res.status(400).json({ message: "Priority is required." });
    if (!allowedPriorities.includes(priority))
      return res.status(400).json({ message: "Invalid priority provided." });
    if (!status?.trim()) return res.status(400).json({ message: "Status is required." });
    if (!allowedStatuses.includes(status))
      return res.status(400).json({ message: "Invalid status provided." });
    if (!labels || !Array.isArray(labels) || labels.length === 0)
      return res.status(400).json({ message: "At least one label is required." });
    if (!labels.every((label) => allowedLabels.includes(label)))
      return res.status(400).json({ message: "Invalid label(s) provided." });
    if (typeof completed !== "boolean")
      return res.status(400).json({ message: "Completed must be boolean" });

    const tasksCol = getTasksCollection();

    const newTask = {
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      labels,
      completed,
      userId: user._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await tasksCol.insertOne(newTask);

    return res.status(201).json({
      message: "Task created successfully",
      task: { ...newTask, _id: result.insertedId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
