import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import users from "./models/users.model.js";
import users from "./seed/users.seed.js";

dotenv.config();

const HASHED_PASSWORD = await bcrypt.hash("TheBridgeFlow123", 10);

try {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("✅ MongoDB Connected");

  

  await User.deleteMany({});
  console.log("🗑️ Existing users deleted");

  const formattedUsers = users.map((u) => ({
    name: u.name,
    email: u.email.toLowerCase(),
    password: HASHED_PASSWORD,
    role: u.role,

    phone: u.phone || "",
    university: u.university || "",
    specialty: u.specialty || "",

    supervisorName: u.supervisorName || "",

    bio: u.bio || "",

    education: u.education || {
      institution: "",
      degree: "",
      fieldOfStudy: "",
      current: false,
      grade: "",
      courses: [],
    },

    experience: u.experience || [],

    skills:
      u.skills?.map((s) => ({
        name: s.name,
        level: s.level,
        category: s.category || "Technical",
      })) || [],

    languages: u.languages || [],

    socialLinks: {
      linkedin: u.socialLinks?.linkedin || "",
      github: u.socialLinks?.github || "",
      portfolio: u.socialLinks?.portfolio || "",
    },

    favorites: [],
    isActive: true,
  }));

  await User.insertMany(formattedUsers);

  console.log(`✅ ${formattedUsers.length} users imported successfully`);

  await mongoose.connection.close();

  console.log("🔌 MongoDB connection closed");

  process.exit(0);

} catch (error) {
  console.error("❌ Seed Error:");
  console.error(error);

  await mongoose.connection.close();

  process.exit(1);
}