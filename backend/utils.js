const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 生成 JWT 令牌
function generateToken(payload, isAdmin = false) {
  const tokenPayload = {
    ...payload,
    role: isAdmin ? 'admin' : 'user'
  };
  return jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

// 密码哈希
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// 密码验证
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// 生成 UUID
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = {
  generateToken,
  hashPassword,
  comparePassword,
  generateId
};
