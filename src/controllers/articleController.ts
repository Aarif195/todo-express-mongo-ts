import express, { Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { Todo, Reply, Comment, User } from "../types/todo";
import { ObjectId } from "mongodb";
import {
  sendError,
  hashPassword,
  getTasksCollection,
  getUsersCollection,
} from "../utils/helpers";
import { getDb } from "../config/db";
import { AuthRequest } from "../middleware/authenticate";

// Allowed values for tasks
const allowedPriorities = ["low", "medium", "high"];
const allowedStatuses = ["pending", "in-progress", "completed"];
const allowedLabels = ["work", "personal", "urgent", "misc"];

// CREATE TASK
export const createTask = async (req: AuthRequest, res: any) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { title, description, priority, status, labels, completed } =
      req.body;

    if (!title?.trim())
      return res.status(400).json({ message: "Title is required." });
    if (!description?.trim())
      return res.status(400).json({ message: "Description is required." });
    if (!priority?.trim())
      return res.status(400).json({ message: "Priority is required." });
    if (!allowedPriorities.includes(priority))
      return res.status(400).json({ message: "Invalid priority provided." });
    if (!status?.trim())
      return res.status(400).json({ message: "Status is required." });
    if (!allowedStatuses.includes(status))
      return res.status(400).json({ message: "Invalid status provided." });
    if (!labels || !Array.isArray(labels) || labels.length === 0)
      return res
        .status(400)
        .json({ message: "At least one label is required." });
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

// GET TASKS
export const getTasks = async (req: Request, res: Response) => {
  try {
    const tasksCol = getTasksCollection();

    const tasksArray = (await tasksCol.find({}).toArray()) as Todo[];

    tasksArray.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const queryParams = req.query;

    const page = Math.max(1, parseInt((queryParams.page as string) || "1"));
    const limit = Math.max(1, parseInt((queryParams.limit as string) || "10"));

    let filteredTasks = [...tasksArray];

    for (const key in queryParams) {
      const value = String(queryParams[key]).toLowerCase();

      if (key === "search") {
        filteredTasks = filteredTasks.filter(
          (task) =>
            task.title.toLowerCase().includes(value) ||
            task.description.toLowerCase().includes(value) ||
            (Array.isArray(task.labels) &&
              task.labels.some((label) => label.toLowerCase().includes(value)))
        );
      } else if (key === "labels") {
        filteredTasks = filteredTasks.filter(
          (task) =>
            Array.isArray(task.labels) &&
            task.labels.map((label) => label.toLowerCase()).includes(value)
        );
      } else if (key === "status" && allowedStatuses.includes(value)) {
        filteredTasks = filteredTasks.filter((task) => task.status === value);
      } else if (key === "priority" && allowedPriorities.includes(value)) {
        filteredTasks = filteredTasks.filter((task) => task.priority === value);
      } else if (key === "completed") {
        const isCompleted = value === "true";
        filteredTasks = filteredTasks.filter(
          (task) => task.completed === isCompleted
        );
      }
    }

    const totalData = filteredTasks.length;
    const totalPages = totalData === 0 ? 0 : Math.ceil(totalData / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const dataSlice = filteredTasks.slice(startIndex, endIndex);

    return res.status(200).json({
      totalData,
      totalPages,
      currentPage: page,
      limit,
      data: dataSlice,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, "Server error");
  }
};

// TOGGLE TASK COMPLETION
export const toggleTaskCompletion = async (req: Request, res: Response) => {
  try {
    const { taskId, action } = req.params;

    if (!ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    if (action !== "complete" && action !== "incomplete") {
      return res.status(400).json({ message: "Invalid action" });
    }

    const tasksCol = getTasksCollection();
    const task = await tasksCol.findOne({ _id: new ObjectId(taskId) });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const newCompleted = action === "complete";

    await tasksCol.updateOne(
      { _id: new ObjectId(taskId) },
      {
        $set: {
          completed: newCompleted,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    const updatedTask = {
      ...task,
      completed: newCompleted,
      updatedAt: new Date().toISOString(),
    };

    return res.status(200).json({
      message: `Task marked as ${action}`,
      task: updatedTask,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
