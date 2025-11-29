import express, { Request, Response } from "express";
import path from "path";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "../config/db";
import { Todo, Reply, Comment, User } from "../types/todo";
import { sendError, hashPassword , getUsersCollection} from "../utils/helpers";

export async function register(req:Request, res:Response)  {

}

export async function login(req:Request, res:Response)  {

}

