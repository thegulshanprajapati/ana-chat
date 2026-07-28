import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { config } from "../config.js";
import { UserModel } from "../models/user.model.js";
import { SessionModel } from "../models/session.model.js";

const authService = {
  async hashPassword(password: string) {
    return argon2.hash(password, { type: argon2.argon2id });
  },

  async verifyPassword(hash: string, password: string) {
    return argon2.verify(hash, password);
  },

  signJwt(payload: object, expiresIn = config.jwtExpiresIn) {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: expiresIn as any });
  },

  async verifyToken(token: string) {
    return jwt.verify(token, config.jwtSecret);
  },

  async createSession(userId: string, refreshToken: string, deviceId: string) {
    const hash = await this.hashPassword(refreshToken);
    return SessionModel.create({ userId, refreshTokenHash: hash, deviceId, createdAt: new Date(), lastUsedAt: new Date() });
  },

  async revokeSession(sessionId: string) {
    return SessionModel.findByIdAndUpdate(sessionId, { revokedAt: new Date() }, { new: true });
  },

  async signup(req: Request, res: Response) {
    const { name, email, password, mobile } = req.body;

    const existing = await UserModel.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email already registered." });

    const passwordHash = await this.hashPassword(password);
    const user = await UserModel.create({ name, email, mobile, passwordHash, isVerified: false, settings: { theme: "system" } });

    return res.status(201).json({ user: { id: user._id, name: user.name, email: user.email } });
  },

  async login(req: Request, res: Response) {
    const { email, password, deviceId } = req.body;
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid login credentials." });

    const valid = await this.verifyPassword(user.passwordHash, password);
    if (!valid) return res.status(401).json({ error: "Invalid login credentials." });

    const accessToken = this.signJwt({ userId: user._id, isAdmin: user.isAdmin }, "15m");
    const refreshToken = this.signJwt({ userId: user._id }, config.refreshTokenExpiresIn);

    await this.createSession(user._id.toString(), refreshToken, deviceId || "unknown");
    res.cookie("refreshToken", refreshToken, { httpOnly: true, secure: config.cookieSecure, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 30 });

    return res.json({ accessToken, user: { id: user._id, email: user.email, name: user.name } });
  },

  async refreshToken(req: Request, res: Response) {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: "Refresh token required." });

    const payload = await this.verifyToken(refreshToken) as { userId: string };
    const accessToken = this.signJwt({ userId: payload.userId }, "15m");
    return res.json({ accessToken });
  },

  async logout(req: Request, res: Response) {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const payload = await this.verifyToken(refreshToken) as { userId: string };
      await SessionModel.updateMany({ userId: payload.userId, revokedAt: null }, { revokedAt: new Date() });
    }
    res.clearCookie("refreshToken");
    return res.json({ success: true });
  },

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    const user = await UserModel.findOne({ email });
    if (!user) return res.status(200).json({ success: true });

    const token = this.signJwt({ userId: user._id }, "15m");
    // TODO: email the reset link using EmailService
    return res.json({ success: true, token });
  },

  async resetPassword(req: Request, res: Response) {
    const { token, password } = req.body;
    const payload = await this.verifyToken(token) as { userId: string };
    const user = await UserModel.findById(payload.userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    user.passwordHash = await this.hashPassword(password);
    await user.save();
    await SessionModel.updateMany({ userId: user._id }, { revokedAt: new Date() });
    return res.json({ success: true });
  },

  async verifyEmail(req: Request, res: Response) {
    const { token } = req.body;
    const payload = await this.verifyToken(token) as { userId: string };
    await UserModel.findByIdAndUpdate(payload.userId, { isVerified: true });
    return res.json({ success: true });
  },

  async me(req: Request, res: Response) {
    return res.json({ user: req.user });
  },

  async getSessions(req: Request, res: Response) {
    const sessions = await SessionModel.find({ userId: req.user!.userId, revokedAt: null });
    return res.json({ sessions });
  },

  async getDevices(req: Request, res: Response) {
    const user = await UserModel.findById(req.user!.userId);
    return res.json({ devices: user?.devices || [] });
  },

  async updateSettings(req: Request, res: Response) {
    const settings = req.body;
    const user = await UserModel.findByIdAndUpdate(req.user!.userId, { settings, updatedAt: new Date() }, { new: true });
    return res.json({ settings: user?.settings });
  },

  async listUsers(_req: Request, res: Response) {
    const users = await UserModel.find().select("name email mobile isVerified isAdmin createdAt");
    return res.json({ users });
  },

  async listEmailTemplates(_req: Request, res: Response) {
    return res.json({ templates: [] });
  },

  async createEmailTemplate(_req: Request, res: Response) {
    return res.status(201).json({ success: true });
  },

  async updateEmailTemplate(_req: Request, res: Response) {
    return res.json({ success: true });
  },

  async getAuditLogs(_req: Request, res: Response) {
    return res.json({ logs: [] });
  }
};

export const verifyToken = authService.verifyToken.bind(authService);
export const authController = {
  signup: authService.signup.bind(authService),
  login: authService.login.bind(authService),
  refreshToken: authService.refreshToken.bind(authService),
  logout: authService.logout.bind(authService),
  forgotPassword: authService.forgotPassword.bind(authService),
  resetPassword: authService.resetPassword.bind(authService),
  verifyEmail: authService.verifyEmail.bind(authService)
};
export const userController = {
  me: authService.me.bind(authService),
  getSessions: authService.getSessions.bind(authService),
  getDevices: authService.getDevices.bind(authService),
  updateSettings: authService.updateSettings.bind(authService)
};
export const adminController = {
  listUsers: authService.listUsers.bind(authService),
  listEmailTemplates: authService.listEmailTemplates.bind(authService),
  createEmailTemplate: authService.createEmailTemplate.bind(authService),
  updateEmailTemplate: authService.updateEmailTemplate.bind(authService),
  getAuditLogs: authService.getAuditLogs.bind(authService)
};
