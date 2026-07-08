import jwt from "jsonwebtoken";

const generateRefreshToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from environmental variables.");
  }

  return jwt.sign(
    { 
      sub: user._id, 
      sessionId: user.sessionId 
    }, 
    process.env.JWT_SECRET, 
    {
      expiresIn: "24h",
      issuer: "galibrand",
      audience: "store-owner-dashboard",
      algorithm: "HS256"
    }
  );
};

export default generateRefreshToken;
