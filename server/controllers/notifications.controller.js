import User from "../models/users.model.js";
import Notification from "../models/notification.model.js";
import asyncHandler from "../utils/asyncHandler.js";

// GET /api/notifications
export const getNotifications = asyncHandler(async (req, res) => {
  // Mise à jour légère de l'activité (polling frontend toutes les 30s)
  await User.findByIdAndUpdate(req.user._id, { lastActiveAt: new Date() });

  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const skip  = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments({ userId: req.user._id }),
  ]);

  res.json({
    count: notifications.length,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    notifications,
  });
});

// PUT /api/notifications/:id/read
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    const err = new Error("Notification non trouvée");
    err.statusCode = 404;
    throw err;
  }

  res.json({ notification });
});

// PUT /api/notifications/read-all
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { isRead: true }
  );

  res.json({ message: "Toutes les notifications marquées comme lues" });
});

// DELETE /api/notifications/:id
export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    const err = new Error("Notification non trouvée");
    err.statusCode = 404;
    throw err;
  }

  res.json({ message: "Notification supprimée" });
});
