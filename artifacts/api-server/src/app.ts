import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const frontendPath = path.join(process.cwd(), "artifacts/bookkeeper/dist/public");
if (process.env.NODE_ENV === "production" && fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

export default app;
