import Conversation from "../models/conversation.model.js";
import Message      from "../models/messages.model.js";
import User         from "../models/users.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import fs           from "fs";

// GET /api/conversations
export const getConversations = asyncHandler(async (req, res) => {
  const myId = req.user._id;

  const conversations = await Conversation.find({ participants: myId })
    .populate("participants", "name role avatarUrl")
    .populate({
      path:     "lastMessage",
      populate: { path: "senderId", select: "name" },
    })
    .sort({ lastMessageAt: -1 })
    .lean();

  const result = conversations.map((conv) => {
    const otherUser   = conv.participants.find((p) => String(p._id) !== String(myId));
    const unreadCount = conv.unreadCounts?.[String(myId)] || 0;
    return { ...conv, otherUser, unreadCount };
  });

  res.json({ conversations: result });
});

// GET /api/conversations/:conversationId/messages?page=1&limit=50
export const getConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const myId  = req.user._id;
  const page  = Math.max(1, parseInt(req.query.page  || "1",  10));
  const limit = Math.min(100, parseInt(req.query.limit || "50", 10));
  const skip  = (page - 1) * limit;

  // Vérifier que l'utilisateur est bien participant
  const conv = await Conversation.findOne({
    _id: conversationId,
    participants: myId,
  }).lean();

  if (!conv) {
    const err = new Error("Conversation introuvable");
    err.statusCode = 404;
    throw err;
  }

  const [messages, total] = await Promise.all([
    Message.find({ conversationId })
      .populate("senderId",   "name role avatarUrl")
      .populate("receiverId", "name role avatarUrl")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Message.countDocuments({ conversationId }),
  ]);

  // Marquer les messages reçus comme lus + réinitialiser le compteur
  await Promise.all([
    Message.updateMany(
      { conversationId, receiverId: myId, isRead: false },
      { isRead: true }
    ),
    Conversation.updateOne(
      { _id: conversationId },
      { $set: { [`unreadCounts.${myId}`]: 0 } }
    ),
  ]);

  res.json({
    messages,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// POST /api/conversations/upload — envoi d'un fichier dans une conversation
export const uploadFileMessage = asyncHandler(async (req, res) => {
  const myId = req.user._id;
  const { receiverId, conversationId, content } = req.body;

  if (!req.file) {
    const err = new Error("Aucun fichier fourni");
    err.statusCode = 400;
    throw err;
  }

  if (!receiverId && !conversationId) {
    fs.unlink(req.file.path, () => {});
    const err = new Error("receiverId ou conversationId requis");
    err.statusCode = 400;
    throw err;
  }

  let conv;
  let actualReceiverId;

  if (conversationId) {
    conv = await Conversation.findOne({ _id: conversationId, participants: myId });
    if (!conv) {
      fs.unlink(req.file.path, () => {});
      const err = new Error("Conversation introuvable");
      err.statusCode = 404;
      throw err;
    }
    actualReceiverId = conv.participants.find((p) => String(p) !== String(myId));
  } else {
    actualReceiverId = receiverId;
    conv = await Conversation.findOne({
      participants: { $all: [myId, receiverId], $size: 2 },
    });
    if (!conv) {
      conv = new Conversation({ participants: [myId, receiverId] });
    }
  }

  const message = await Message.create({
    conversationId: conv._id,
    senderId:       myId,
    receiverId:     actualReceiverId,
    content:        content?.trim() || "",
    fileUrl:        `/uploads/${req.file.filename}`,
    fileName:       req.file.originalname,
    fileType:       req.file.mimetype,
    fileSize:       req.file.size,
  });

  const receiverIdStr = String(actualReceiverId);
  conv.lastMessage   = message._id;
  conv.lastMessageAt = message.createdAt;
  conv.unreadCounts  = {
    ...(conv.unreadCounts || {}),
    [receiverIdStr]: ((conv.unreadCounts || {})[receiverIdStr] || 0) + 1,
  };
  await conv.save();

  await message.populate([
    { path: "senderId",   select: "name role avatarUrl" },
    { path: "receiverId", select: "name role avatarUrl" },
  ]);

  res.status(201).json({ message, conversationId: conv._id });
});

// GET /api/conversations/students — liste des étudiants actifs (hors soi-même)
export const getStudents = asyncHandler(async (req, res) => {
  const myId = req.user._id;

  const students = await User.find({
    _id:      { $ne: myId },
    role:     "étudiant",
    isActive: true,
  })
    .select("_id name role avatarUrl university specialty bio skills")
    .sort({ name: 1 })
    .lean();

  res.json({ students });
});
