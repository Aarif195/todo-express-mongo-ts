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

    await tasksCol.updateOne(
      { _id: new ObjectId(taskId) },
      { $set: updatePayload }
    );

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
    const likedBy: ObjectId[] = Array.isArray(task.likedBy)
      ? (task.likedBy as ObjectId[])
      : [];

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

// REPLY TO COMMENT
export const replyTaskComment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return sendError(res, "Unauthorized");

    const { commentId } = req.params;

    if (!ObjectId.isValid(commentId))
      return sendError(res, "Invalid comment ID");

    const { text } = req.body;
    if (!text || text.trim() === "")
      return sendError(res, "Text cannot be empty");

    const tasksCol = getTasksCollection();

    // Find task containing the comment
    const task = await tasksCol.findOne({
      "comments._id": new ObjectId(commentId),
    });

    if (!task) return sendError(res, "Comment not found");

    // Ownership check
    if (!task.userId.equals(req.user._id!)) {
      return sendError(
        res,
        "Forbidden: Only the task owner can reply to this comment."
      );
    }

    const reply: Reply = {
      _id: new ObjectId(),
      userId: req.user._id!,
      username: req.user.username,
      text: text.trim(),
      updatedAt: new Date().toISOString(),
    };

    // Push reply into the comment replies
    await tasksCol.updateOne(
      { "comments._id": new ObjectId(commentId) },
      { $push: { "comments.$.replies": reply } as any }
    );

    res.status(200).json({
      message: "Reply added successfully",
      reply,
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

// GET TASK COMMENTS
export const getTaskComments = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const tasksCol = getTasksCollection();
    const task = await tasksCol.findOne({ _id: new ObjectId(id) });

    if (!task) return res.status(404).json({ message: "Task not found" });

    if (!task.userId.equals(user._id)) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You can only view your own task comments.",
        });
    }

    res.status(200).json({ comments: task.comments || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET TASKS CREATED BY THE LOGGED-IN USER
export const getMyTasks = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return sendError(res, "Unauthorized");

    const tasksCol = getTasksCollection();

    // Fetch all tasks created by this user
    //  user's ID
    const baseQuery = { userId: user._id };

    // fetching all data initially to support the client-side sorting and filtering logic below.
    const tasksArray = (await tasksCol.find(baseQuery).toArray()) as Todo[];

    //  Sort newest first
    tasksArray.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    //  Parse query parameters
    const queryParams = req.query;

    const page = Math.max(1, parseInt(queryParams.page?.toString() || "1"));
    const limit = Math.max(1, parseInt(queryParams.limit?.toString() || "10"));

    //  Apply filters
    let filteredTasks = [...tasksArray];

    for (const key in queryParams) {
      // Ensure value is treated as string for comparison
      const value = queryParams[key]?.toString().toLowerCase() || "";

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
            task.labels.map((l) => l.toLowerCase()).includes(value)
        );
      } else if (key === "status") {
        filteredTasks = filteredTasks.filter((task) => task.status === value);
      } else if (key === "priority") {
        filteredTasks = filteredTasks.filter((task) => task.priority === value);
        // }
      } else if (key === "completed") {
        const isCompleted = value === "true";
        filteredTasks = filteredTasks.filter(
          (task) => task.completed === isCompleted
        );
      }
    }

    //  Pagination
    const totalData = filteredTasks.length;
    const totalPages = totalData === 0 ? 0 : Math.ceil(totalData / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const dataSlice = filteredTasks.slice(startIndex, endIndex);

    //  Send response
    res.status(200).json({
      totalData,
      totalPages,
      currentPage: page,
      limit,
      data: dataSlice,
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

// LIKE/UNLIKE A COMMENT
export const likeComment = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return sendError(res, "Unauthorized");

    // Comment ID from route parameters
    const commentIdStr = req.params.commentId;

    if (!ObjectId.isValid(commentIdStr))
      return sendError(res, "Invalid comment ID");

    const tasksCol = getTasksCollection();
    const commentObjectId = new ObjectId(commentIdStr);

    // Find the task containing the comment
    const task = await tasksCol.findOne({
      "comments._id": commentObjectId,
    });

    if (!task) return sendError(res, "Comment not found");

    // Check ownership
    if (!task.userId.equals(user._id!)) {
      return sendError(res, "Forbidden: Only the task owner can like comment");
    }

    // Find the specific comment object within the task (client-side)
    const comment = task.comments.find((c: Comment) =>
      c._id?.equals(commentObjectId)
    );

    if (!comment) return sendError(res, "Comment not found");

    // Toggle like
    let liked = false;
    // Ensure likedBy array exists on the comment document
    const likedBy: ObjectId[] = Array.isArray(comment.likedBy)
      ? (comment.likedBy as ObjectId[])
      : [];

    let newLikedBy: ObjectId[];

    if (likedBy.some((id) => id.equals(user._id!))) {
      // Unlike
      newLikedBy = likedBy.filter((id) => !id.equals(user._id!));
      liked = false;
    } else {
      // Like
      newLikedBy = [...likedBy, user._id!];
      liked = true;
    }

    // Update the comment's likedBy and likes in MongoDB using positional operator ($)
    await tasksCol.updateOne(
      { "comments._id": commentObjectId },
      {
        $set: {
          "comments.$.likedBy": newLikedBy,
          "comments.$.likes": newLikedBy.length,
          "comments.$.updatedAt": new Date().toISOString(),
        },
      }
    );

    // Update 'likes' and 'liked' properties
    comment.likedBy = newLikedBy;
    comment.likes = newLikedBy.length;
    comment.liked = liked;

    // Send response
    res.status(200).json({
      message: liked ? "Comment liked!" : "Comment unliked!",
      comment,
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
};

// LIKE/UNLIKE A REPLY
export async function likeReply(req: AuthRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) return sendError(res, "Unauthorized");

    // Get ID from route parameters
    const replyIdStr = req.params.replyId;
    const replyObjectId = new ObjectId(replyIdStr);

    if (!ObjectId.isValid(replyIdStr))
      return sendError(res, "Invalid reply ID");

    const tasksCol = getTasksCollection();

    // Find the task containing the reply
    const task = await tasksCol.findOne({
      "comments.replies._id": replyObjectId,
    });
    if (!task) return sendError(res, "Reply not found");

    // Check ownership
    if (!task.userId.equals(user._id!)) {
      return sendError(
        res,
        "Forbidden: Only the task owner can like reply's comment."
      );
    }

    // Find the specific comment containing the reply
    const comment = task.comments.find((c: Comment) =>
      c.replies.some((r: Reply) => r._id?.equals(replyObjectId))
    );
    if (!comment) return sendError(res, "Reply not found in any comment");

    // Find the reply object (client-side)
    const reply = comment.replies.find((r: Reply) =>
      r._id?.equals(replyObjectId)
    );
    if (!reply) return sendError(res, "Reply not found");

    // Toggle like for reply
    let liked = false;
    // Ensure likedBy array exists on the reply document
    const likedBy: ObjectId[] = Array.isArray(reply.likedBy)
      ? (reply.likedBy as ObjectId[])
      : [];

    let newLikedBy: ObjectId[];

    if (likedBy.some((id) => id.equals(user._id!))) {
      // Unlike
      newLikedBy = likedBy.filter((id) => !id.equals(user._id!));
      liked = false;
    } else {
      // Like
      newLikedBy = [...likedBy, user._id!];
      liked = true;
    }

    // Update the reply's likedBy and likes in MongoDB using array filters
    await tasksCol.updateOne(
      { "comments.replies._id": replyObjectId },
      {
        $set: {
          "comments.$[].replies.$[r].likedBy": newLikedBy,
          "comments.$[].replies.$[r].likes": newLikedBy.length,
        },
      },
      // Array filter 'r' targets the specific reply ID
      { arrayFilters: [{ "r._id": replyObjectId }] }
    );

    // Update 'likes' and 'liked' properties
    reply.likes = newLikedBy.length;
    (reply.likedBy as ObjectId[]) = newLikedBy;

    // Send response
    res.status(200).json({
      message: liked ? "Reply liked!" : "Reply unliked!",
      reply: { ...reply, liked },
    });
  } catch (err) {
    console.error(err);
    sendError(res, "Server error");
  }
}

// Delete a comment or reply
export async function deleteCommentOrReply(req: AuthRequest, res: Response) {
  try {
    const user = req.user;
    if (!user || !user._id) return sendError(res, "Unauthorized");

    // Extracting ID from URL

    const idStr = req.params.id;

    //  replyId parameter, we treat it as a reply deletion.
    const isReply = !!req.params.replyId;

    if (!ObjectId.isValid(idStr)) return sendError(res, "Invalid ID");

    // Use the ID specific to the entity being deleted
    const targetId = new ObjectId(idStr);
    const ownerId = new ObjectId(user._id);

    const tasksCol = getTasksCollection();

    // Determine the query to find the parent task based on the entity ID
    const taskFindQuery = isReply
      ? { "comments.replies._id": targetId }
      : { "comments._id": targetId };

    const task = await tasksCol.findOne(taskFindQuery, {
      projection: { userId: 1 },
    });

    if (!task)
      return sendError(res, isReply ? "Reply not found" : "Comment not found");

    // Only the task owner can delete comments/replies on their task.
    if (!task.userId.equals(user._id!)) {
      const type = isReply ? "replies" : "comments";
      const errorMessage = `Forbidden: Only the task owner can delete ${type} on this task.`;
      return sendError(res, errorMessage);
    }

    // (Reply Deletion)
    if (isReply) {
      const replyUpdateResult = await tasksCol.updateOne(
        // Query to find the task that contains the reply ID
        {
          "comments.replies._id": targetId,
          
        },
        {
          // $pull the reply based on its ID
          $pull: {
            "comments.$[].replies": {
              _id: targetId,
            } as any,
          },
        }
      );

      if (replyUpdateResult.modifiedCount > 0) {
        res.status(204).end();
      }
      return sendError(res, "Reply not found or forbidden to delete");
    }
    // (Comment Deletion)
    else {
      const commentUpdateResult = await tasksCol.updateOne(
        // Query to find the task that contains the comment ID
        {
          "comments._id": targetId,
        },
        {
          // $pull the comment based on its ID
          $pull: {
            comments: {
              _id: targetId,
            } as any,
          },
        }
      );

      if (commentUpdateResult.modifiedCount > 0) {
        res.status(204).end(); // 204 No Content for successful delete
      }
      return sendError(res, "Comment not found or forbidden to delete");
    }
  } catch (err) {
    console.error(err);
    return sendError(res, "Internal Server Error");
  }
}
