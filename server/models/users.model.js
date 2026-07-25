import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const experienceSchema = new mongoose.Schema({
  company:      { type: String, default: "" },
  position:     { type: String, default: "" },
  location:     { type: String, default: "" },
  startDate:    { type: Date },
  endDate:      { type: Date },
  current:      { type: Boolean, default: false },
  description:  { type: String, default: "" },
  technologies: [{ type: String }],
}, { _id: false });

const skillSchema = new mongoose.Schema({
  name:     { type: String, default: "" },
  level:    { type: String, enum: ["Débutant", "Intermédiaire", "Avancé", "Expert"], default: "Débutant" },
  category: { type: String, default: "" },
}, { _id: false });

const languageSchema = new mongoose.Schema({
  name:  { type: String, default: "" },
  level: { type: String, enum: ["Débutant", "Intermédiaire", "Courant", "Natif"], default: "Débutant" },
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: [true, "Nom requis"], trim: true },
    email:    { type: String, required: [true, "Email requis"], unique: true, lowercase: true, trim: true },
    password: {
      type: String,
      required: function () { return !this.googleId && !this.facebookId; },
      minlength: 6,
      select: false,
    },
    role:     { type: String, enum: ["étudiant", "admin"], default: "étudiant" },

    // Pas de "required" au niveau schéma : les comptes déjà en base avant
    // l'ajout de ce champ n'en ont pas et ne doivent pas échouer une future
    // validation (ex. mise à jour de statut par un admin). Le caractère
    // obligatoire n'est imposé qu'à l'inscription (contrôleur register).
    gender:    { type: String, enum: ["homme", "femme"] },
    // Assigné automatiquement à l'inscription selon `gender` — vide pour les
    // comptes existants ou créés sans ce champ (OAuth, création admin) :
    // l'UI retombe alors sur les initiales, jamais de lien cassé.
    avatarUrl: { type: String, default: "" },

    // ─── Connexion Google (OAuth) ──────────────────────────────────────────
    googleId: { type: String, unique: true, sparse: true, select: false },

    // ─── Connexion Facebook (OAuth) ─────────────────────────────────────────
    facebookId: { type: String, unique: true, sparse: true, select: false },

    phone:          { type: String, default: "" },
    university:     { type: String, default: "" },
    specialty:      { type: String, default: "" },
    supervisorId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    supervisorName: { type: String, default: "" },
    isActive:       { type: Boolean, default: true },
    favorites:      [{ type: mongoose.Schema.Types.ObjectId, ref: "Offer" }],

    // ─── Vérification email (première connexion uniquement) ───────────────
    isVerified:        { type: Boolean, default: false },
    verifyCode:        { type: String,  select: false },
    verifyCodeExpires: { type: Date,    select: false },

    // ─── Réinitialisation de mot de passe ──────────────────────────────────
    // On stocke un hash SHA-256 du token envoyé par email, jamais le token en
    // clair — comme pour un mot de passe, une fuite de la BDD seule ne doit
    // pas suffire à générer un lien de reset valide.
    resetPasswordToken:   { type: String, select: false },
    resetPasswordExpires: { type: Date,   select: false },

    // ─── Profil étudiant ──────────────────────────────────────────────────
    // ─── Profil étudiant ──────────────────────────────────────────────────
    bio: { type: String, default: "" },
    cv: {
      fileName: { type: String, default: "" },
      fileUrl:  { type: String, default: "" },
    },
    education: {
      institution:  { type: String, default: "" },
      degree:       { type: String, default: "" },
      fieldOfStudy: { type: String, default: "" },
      startDate:    { type: Date },
      endDate:      { type: Date },
      current:      { type: Boolean, default: false },
      grade:        { type: String, default: "" },
      courses:      [{ type: String }],
    },
    experience:  [experienceSchema],
    skills:      [skillSchema],
    languages:   [languageSchema],
    socialLinks: {
      linkedin:  { type: String, default: "" },
      github:    { type: String, default: "" },
      portfolio: { type: String, default: "" },
    },

    // ─── Dernière connexion ────────────────────────────────────────────────
    lastLoginAt: { type: Date },

    // ─── Dernière activité (polling /api/notifications) ────────────────────
    lastActiveAt: { type: Date },

    settings: {
      notifications: {
        newOffers:       { type: Boolean, default: true },
        newApplications: { type: Boolean, default: true },
        interviews:      { type: Boolean, default: true },
        messages:        { type: Boolean, default: true },
        formations:      { type: Boolean, default: true },
        emails:          { type: Boolean, default: true },
      },
      privacy: {
        profileVisibility: { type: String, enum: ["public", "private", "connections"], default: "public" },
        cvVisibility:      { type: Boolean, default: true },
        allowCompanyView:  { type: Boolean, default: true },
      },
      ai: {
        enableRecommendations: { type: Boolean, default: true },
      },
      internshipPreferences: {
        locations:    [{ type: String }],
        type:         { type: String, enum: ["Stage", "PFE", "Alternance", "CDI", "CDD", ""], default: "" },
        technologies: [{ type: String }],
        duration:     { type: String, default: "" },
      },
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verifyCode;
  delete obj.verifyCodeExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

export default mongoose.model("User", userSchema);