import express, { Request, Response } from "express";
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

// GET TASK BY ID
export const getTaskById = async (req: Request, res: Response) => {
  try {
    const idStr = req.params.id;

    if (!ObjectId.isValid(idStr)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const tasksCol = getTasksCollection();
    const task = await tasksCol.findOne({ _id: new ObjectId(idStr) });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATE
export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const taskId = req.params.id;
    let updatedData: Partial<
      Pick<Todo, "title" | "description" | "status" | "priority" | "labels">
    > = req.body;

    const tasksCol = getTasksCollection();
    const task = await tasksCol.findOne({ _id: new ObjectId(taskId) });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!task.userId.equals(user._id)) {
      return res.status(403).json({
        message: "Forbidden: You can only update your own tasks",
      });
    }

    // VALIDATIONS
    const { title, description, status, priority, labels } = updatedData;
    if (title !== undefined && title.trim() === "")
      return sendError(res, "Title cannot be empty");
    if (description !== undefined && description.trim() === "")
      return sendError(res, "Description cannot be empty");
     if (priority !== undefined && priority.trim() === "")
  return sendError(res, "Priority cannot be empty");
    if (priority && !allowedPriorities.includes(priority.toLowerCase()))
      return sendError(res, "Invalid priority");
    if (status !== undefined && status.trim() === "")
  return sendError(res, "Status cannot be empty");
    if (status && !allowedStatuses.includes(status.toLowerCase()))
      return sendError(res, "Invalid status");
   
    if (
      labels &&
      (!Array.isArray(labels) ||
        labels.some((l) => !allowedLabels.includes(l.toLowerCase())))
    )
      return sendError(res, "Invalid labels");


      // To make Update to the fields
    const updatePayload: Partial<Todo> = {
      title: title !== undefined ? title.trim() : task.title,
      description:
        description !== undefined ? description.trim() : task.description,
      status: status ? (status.toLowerCase() as Todo["status"]) : task.status,
      priority: priority
        ? (priority.toLowerCase() as Todo["priority"])
        : task.priority,
      labels: labels ? labels.map((l) => l.toLowerCase()) : task.labels,
      updatedAt: new Date().toISOString(),
    };

    await tasksCol.updateOne({ _id: new ObjectId(taskId) }, { $set: updatePayload });

    res.status(200).json({
      message: "Task updated successfully",
      updatedTask: { ...task, ...updatePayload },
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};


// DELETE TASK
export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
   
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const taskIdStr = req.params.id; 

    if (!ObjectId.isValid(taskIdStr)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }
    const taskId = new ObjectId(taskIdStr);

    const tasksCol = getTasksCollection();

    const task = await tasksCol.findOne({ _id: taskId });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check ownership
    if (!task.userId.equals(user._id!)) {
      return res.status(403).json({
        message: "Forbidden: You can only delete your own tasks",
      });
    }

    // Delete task
    await tasksCol.deleteOne({ _id: taskId });

    res.status(204).end();

  } catch (err) {
  
    res.status(500).json({ message: "Server error" });
  }
};


// LIKE TODO TASK
export const likeTask = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Task ID from route parameters
    const taskIdStr = req.params.id; 

    //  ObjectId 
    if (!ObjectId.isValid(taskIdStr)) {
      sendError(res, "Invalid task ID");
      return;
    }
    const taskId = new ObjectId(taskIdStr);

    const tasksCol = getTasksCollection();
    const task = await tasksCol.findOne({ _id: taskId });

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    // Check ownership
    if (!task.userId.equals(user._id!)) {
      res.status(403).json({
        message: "Forbidden: You can only like your own tasks",
      });
      return;
    }

    // Toggle like
    let message = "";
    let liked = false;
    const likedBy: ObjectId[] = Array.isArray(task.likedBy) ? (task.likedBy as ObjectId[]) : [];

    let newLikedBy: ObjectId[];

    if (likedBy.some((id: ObjectId) => id.equals(user._id!))) {
      // User already liked → unlike
      newLikedBy = likedBy.filter((id: ObjectId) => !id.equals(user._id!));
      message = "Task unliked!";
      liked = false;
    } else {
      // Like
      newLikedBy = [...likedBy, user._id!];
      message = "Task liked!";
      liked = true;
    }

    await tasksCol.updateOne(
      { _id: taskId },
      { $set: { likedBy: newLikedBy, likesCount: newLikedBy.length } }
    );

    // Send response
    res.status(200).json({
      message,
      task: {
        ...task,
        likedBy: newLikedBy,
        likesCount: newLikedBy.length,
        liked,
      },
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

// ADD COMMENT
export const postTaskComment = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const taskIdStr = req.params.id;
    if (!ObjectId.isValid(taskIdStr)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    const tasksCol = getTasksCollection();
    const task = await tasksCol.findOne({ _id: new ObjectId(taskIdStr) });
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Ownership check
    if (!task.userId.equals(user._id)) {
      return res
        .status(403)
        .json({ message: "Forbidden: Only the task owner can add comments." });
    }

    const newComment: Comment = {
      _id: new ObjectId(),
      userId: user._id!,
      username: user.username,
      text: text.trim(),
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedComments = Array.isArray(task.comments)
      ? [...task.comments, newComment]
      : [newComment];

    await tasksCol.updateOne(
      { _id: new ObjectId(taskIdStr) },
      {
        $set: {
          comments: updatedComments,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    return res.status(201).json({
      message: "Comment added successfully",
      comment: newComment,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
