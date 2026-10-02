import Notification from "../models/notification.model.js";
import User from "../models/users.model.js";
import emailService from "./email.service.js";

async function sendEmailSafely(method, email, data) {
  if (!email || !method || typeof emailService[method] !== "function") return;
  try {
    await emailService[method](email, data);
  } catch (error) {
    console.error("[notification] Email dispatch failed", {
      method,
      message: error.message,
    });
  }
}

export async function notifyUser({
  userId,
  email,
  notification,
  emailMethod,
  emailData,
}) {
  try {
    await Notification.create({ userId, ...notification });
  } catch (error) {
    console.error("[notification] Dashboard notification creation failed", {
      userId: String(userId),
      message: error.message,
    });
  }

  await sendEmailSafely(emailMethod, email, emailData);
}

export async function notifyUsers(users, options) {
  const uniqueUsers = [...new Map(users.map((user) => [String(user._id), user])).values()];
  await Promise.all(uniqueUsers.map((user) => notifyUser({
    userId: user._id,
    email: user.email,
    ...options(user),
  })));
}

export async function notifyAdmins(options) {
  let admins;
  try {
    admins = await User.find({ role: "admin", isActive: true })
      .select("name email")
      .lean();
  } catch (error) {
    console.error("[notification] Failed to load admin recipients", { message: error.message });
    return;
  }
  await notifyUsers(admins, options);
}

export async function getActiveStudents() {
  return User.find({ role: "étudiant", isActive: true })
    .select("name email")
    .lean();
}

export async function notifyActiveStudents(options) {
  let students;
  try {
    students = await getActiveStudents();
  } catch (error) {
    console.error("[notification] Failed to load student recipients", { message: error.message });
    return;
  }
  await notifyUsers(students, options);
}
