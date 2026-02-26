import bcrypt from "bcryptjs";
import db from "../database/db.js";

const mapUser = (row) => ({
  id: row.id,
  name: row.name || "",
  role: row.role,
  email: row.email,
  password: row.password,
});

export const getUserByEmail = async (email) => {
  const normalized = email.toLowerCase();
  const [rows] = await db.query(
    "SELECT id, name, role, email, password FROM emotion WHERE email = ? LIMIT 1",
    [normalized]
  );
  return rows[0] ? mapUser(rows[0]) : null;
};

export const getUserById = async (id) => {
  const [rows] = await db.query(
    "SELECT id, name, role, email, password FROM emotion WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] ? mapUser(rows[0]) : null;
};

export const createUser = async ({ email, password, role = "user", name = "" }) => {
  const pass = await bcrypt.hash(password, 10);
  const normalized = email.toLowerCase();

  const [result] = await db.query(
    "INSERT INTO emotion (name, role, email, pass)   VALUES (?, ?, ?, ?)",
    [name, role, normalized, pass]
  );

  return {
    id: result.insertId,
    name,
    role,
    email: normalized,
    password,
  };
};
