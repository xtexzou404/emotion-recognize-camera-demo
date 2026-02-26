import mysql from "mysql2/promise";
import { env } from "../config/env.js";

const db = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
});

export default db;
