import { verifyAccessToken } from "../utils/jwt.js";
import { getUserById } from "../data/users.store.js";

export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Требуется авторизация." });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await getUserById(payload.userId);

    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден." });
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    return next();
  } catch {
    return res.status(401).json({ message: "Недействительный токен." });
  }
};
