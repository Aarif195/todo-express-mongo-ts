import { ObjectId } from "mongodb";

export type Todo = {
  _id?: ObjectId;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  labels: string[];
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  userId: ObjectId;
  isLiked?: boolean;
  likesCount?: number;
  comments?: Comment[];
};

export type Reply = {
  _id?: ObjectId;
  userId: ObjectId; // reference to User._id
  username: string;
  text: string;
  updatedAt?: string;
};

export type Comment = {
  _id?: ObjectId; // Mongo-generated ID
  userId: ObjectId;
  username: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  replies: Reply[];
};

export interface User {
  _id?: ObjectId;
  username: string;
  email: string;
  password: string;
  token?: string;
}
