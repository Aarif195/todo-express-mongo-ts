import { connectToMongo } from "./config/db";
import todoroutes from "./routes/todoroutes";
import authroutes from "./routes/authroutes";


const express = require("express");
const app = express();
const port = process.env.PORT || 9000;


app.use(express.json());

app.use("/articles", todoroutes);
app.use("/auth", authroutes);


  connectToMongo();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
