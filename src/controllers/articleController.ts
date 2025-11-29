import express, { Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { Todo, Reply, Comment, User } from "../types/todo";
import { ObjectId } from "mongodb";
import {sendError,  hashPassword , getUsersCollection} from "../utils/helpers";
import { getDb } from "../config/db";

// const db = getDb();
// const tasksCollection = db.collection("tasks");


export async function createArticle(req:Request, res:Response)  {

}