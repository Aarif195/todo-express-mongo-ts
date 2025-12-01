#  Todo Task Management API

A robust, secure, and scalable RESTful API for managing personal and collaborative to-do tasks.

Built using **Express**, **TypeScript**, and **MongoDB**

##  Key Features

* **User Authentication:** Secure sign-up, sign-in using Bearer Tokens.
* **CRUD Operations:** Complete management of user-specific tasks (Create, Read, Update, Delete).
* **Advanced Filtering:** Fetch tasks with filters, searching, sorting, and pagination.
* **Nested Resources:** Management of comments and replies within tasks.
* **Interaction Endpoints:** Ability to like/unlike tasks, comments, and replies (owner restricted).

## Prerequisites

Ensure you have the following installed:

* **Node.js** (v18+)
* **npm** or **Yarn**
* **MongoDB** (Local instance or a remote service like MongoDB Atlas)

##  API Endpoints

All endpoints are protected by authentication (`Authorization: Bearer <token>`).

| Method | Endpoint | Description | Notes |
| **POST** | `/api/auth/register` | Create a new user. | Unprotected |
| **POST** | `/api/auth/login` | Authenticate and get token. | Unprotected |
| **GET** | `/api/task/my` | Retrieve authenticated user's tasks (paginated/filtered). | |
| **DELETE** | `/api/task/:id` | Delete a specific task. | Owner only |
| **PUT** | `/api/task/:id/like` | Toggle like status on a task. | Owner only |
| **PUT** | `/api/task/:id/comments/:commentId/like` | Toggle like status on a comment. | Task Owner only |
| **DELETE** | `/api/task/:id/comments/:commentId` | Delete a comment. | Task Owner only |
| **DELETE** | `/api/task/:id/comments/:commentId/replies/:replyId` | Delete a reply. | Task Owner only |