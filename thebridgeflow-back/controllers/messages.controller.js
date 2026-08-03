import Message      from "../models/messages.model.js";
import Conversation  from "../models/conversation.model.js";
import User          from "../models/users.model.js";
import Notification  from "../models/notification.model.js";
import asyncHandler  from "../utils/asyncHandler.js";
import emailService  from "../services/email.service.js";

const MESSAGES_ROUTE_BY_ROLE = {
  admin: "/dashboard/admin/messages",
  étudiant: "/dashboard/student/messages",
};

// POST /api/messages
export const sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, content, conversationId } = req.body;
  const senderId = req.user._id;

  if (!receiverId || !content?.trim()) {
    const err = new Error("receiverId et content requis");
    err.statusCode = 400;
    throw err;
  }

  const receiver = await User.findById(receiverId).select("email name role").lean();
  if (!receiver) {
    const err = new Error("Destinataire introuvable");
    err.statusCode = 404;
    throw err;
  }

  // Trouver ou créer la Conversation
  let conv;
  if (conversationId) {
    conv = await Conversation.findOne({ _id: conversationId, participants: senderId });
  }
  if (!conv) {
    conv = await Conversation.findOne({
      participants: { $all: [senderId, receiverId], $size: 2 },
    });
  }
  if (!conv) {
    conv = new Conversation({ participants: [senderId, receiverId] });
  }

  const message = await Message.create({
    conversationId: conv._id,
    senderId,
    receiverId,
    content: content.trim(),
  });

  // Mettre à jour les métadonnées de la conversation
  const receiverIdStr = String(receiverId);
  conv.lastMessage   = message._id;
  conv.lastMessageAt = message.createdAt;
  conv.unreadCounts  = {
    ...conv.unreadCounts,
    [receiverIdStr]: (conv.unreadCounts?.[receiverIdStr] || 0) + 1,
  };
  await conv.save();

  const messagesLink = MESSAGES_ROUTE_BY_ROLE[receiver.role] || "/dashboard/student/messages";

  // Notification in-app
  await Notification.create({
    userId:  receiver._id,
    title:   `Nouveau message de ${req.user.name}`,
    message: content.trim().slice(0, 140),
    type:    "info",
    link:    messagesLink,
  });

  emailService.sendNewMessage(receiver.email, {
    recipientName: receiver.name,
    senderName:    req.user.name,
    preview:       content.trim(),
    link:          messagesLink,
  });

  res.status(201).json({ message, conversationId: conv._id });
});

// GET /api/messages/:userId — conservé pour rétro-compatibilité
export const getConversation = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const myId = req.user._id;

  const messages = await Message.find({
    $or: [
      { senderId: myId,   receiverId: userId },
      { senderId: userId, receiverId: myId   },
    ],
  })
    .populate("senderId",   "name role")
    .populate("receiverId", "name role")
    .sort({ createdAt: 1 })
    .lean();

  await Message.updateMany(
    { senderId: userId, receiverId: myId, isRead: false },
    { isRead: true }
  );

  res.json({ count: messages.length, messages });
});

// GET /api/messages — conservé pour rétro-compatibilité
export const getConversations = asyncHandler(async (req, res) => {
  const myId = req.user._id;

  const messages = await Message.find({
    $or: [{ senderId: myId }, { receiverId: myId }],
  })
    .populate("senderId",   "name role")
    .populate("receiverId", "name role")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ messages });
});
