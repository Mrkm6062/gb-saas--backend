import jwt from "jsonwebtoken";

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from environmental variables.");
  }

  const sub = user && typeof user === 'object' ? user._id : user;
  const role = user && typeof user === 'object' ? user.role : 'user';
  const sessionId = user && typeof user === 'object' ? user.sessionId : null;

  return jwt.sign(
    { 
      sub, 
      role, 
      sessionId 
    }, 
    process.env.JWT_SECRET, 
    {
      algorithm: "HS256",
      expiresIn: "24h",
      issuer: "galibrand",
      audience: "store-owner-dashboard"
    }
  );
};

export default generateToken;