import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "../data/users.store.js";
import { signAccessToken } from "../utils/jwt.js";

const toAuthResponse = (user) => {
  const token = signAccessToken({ userId: user.id, role: user.role });
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
};

export const login = async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "Email и пароль обязательны." });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ message: "Неверные учётные данные." });
  }

  if (user.password !== password) {
    return res.status(401).json({ message: "Неверные учётные данные." });
  }

  return res.json(toAuthResponse(user));
};

export const me = (req, res) => {
  return res.json({ user: req.user });
};
