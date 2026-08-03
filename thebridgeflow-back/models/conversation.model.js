import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Toujours exactement 2 participants
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    lastMessage:   { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    lastMessageAt: { type: Date, default: Date.now },
    // Nombre de messages non lus par userId (objet dynamique: { "userId": count })
    unreadCounts:  { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Toutes les conversations d'un utilisateur, triées par activité récente
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
// Trouver la conversation entre deux utilisateurs précis (upsert)
conversationSchema.index({ participants: 1 });

export default mongoose.model("Conversation", conversationSchema);
