import jwt from "jsonwebtoken";

export const sendToken = (user, statusCode, message, res) => {
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  const options = {
    expires: new Date(
      Date.now() + process.env.COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
  };

  // ✅ SET COOKIE FIRST
  res.cookie("token", token, options);

  // ✅ THEN SEND RESPONSE
  return res.status(statusCode).json({
    success: true,
    user,
    message,
  });
};