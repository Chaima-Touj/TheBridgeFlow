import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import geoip from "geoip-lite";
import User from "../models/users.model.js";
import LoginHistory from "../models/loginHistory.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { signToken } from "../utils/jwt.js";
import emailService from "../services/email.service.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Crée/relie/connecte un utilisateur à partir d'une identité tierce déjà vérifiée
// (Google, Facebook…) et renvoie le JWT — logique commune aux deux providers.
const findOrCreateOAuthUser = async ({ providerField, providerId, email, name, provider }) => {
  let user = await User.findOne({ [providerField]: providerId });

  if (!user) {
    // Compte existant avec le même email (inscription classique ou autre provider) → on relie.
    user = await User.findOne({ email });
    if (user) {
      user[providerField] = providerId;
      if (!user.isVerified) user.isVerified = true;
      await user.save();
    }
  }

  if (!user) {
    user = await User.create({
      name:  name || email.split("@")[0],
      email,
      [providerField]: providerId,
      role:       "étudiant",
      isVerified: true, // le provider a déjà vérifié l'email
    });
    console.log(`📝 Nouveau compte via ${provider} : ${user.name} (${user.email})`);

    emailService.sendWelcome(user.email, { name: user.name, role: user.role });
    User.findOne({ role: "admin" }).select("email").lean().then((admin) => {
      if (admin?.email) {
        emailService.sendNewUserAdmin(admin.email, {
          userName:  user.name,
          userEmail: user.email,
          userRole:  user.role,
        });
      }
    });
  }

  if (user.isActive === false) {
    const err = new Error("Ce compte a été désactivé. Contactez un administrateur.");
    err.statusCode = 403;
    throw err;
  }

  return user;
};

// Rôles autorisés à l'inscription publique — seul "étudiant" existe côté
// inscription ; "admin" n'est assignable que par un autre admin (voir
// admin.controller.js).
const ALLOWED_REGISTER_ROLES = ["étudiant"];

// Avatar assigné automatiquement selon le sexe déclaré à l'inscription.
const AVATAR_BY_GENDER = {
  homme: "/images/avatars/avatar-homme.png",
  femme: "/images/avatars/avatar-femme.png",
};

// Génère un code à 6 chiffres
const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const {
    name, email, password, role, gender, phone, university, specialty,
    bio, education, experience, skills, languages, socialLinks,
  } = req.body;

  if (!name || !email || !password) {
    const err = new Error("Champs requis manquants");
    err.statusCode = 400;
    throw err;
  }

  if (!AVATAR_BY_GENDER[gender]) {
    const err = new Error("Le champ sexe est requis (homme ou femme).");
    err.statusCode = 400;
    throw err;
  }

  const safeRole = ALLOWED_REGISTER_ROLES.includes(role) ? role : "étudiant";

  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error("Email déjà utilisé");
    err.statusCode = 409;
    throw err;
  }

  // Générer le code de vérification
  const code    = generateCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  const user = await User.create({
    name, email, password,
    role: safeRole,
    gender,
    avatarUrl: AVATAR_BY_GENDER[gender],
    phone, university, specialty,
    bio, education, experience, skills, languages, socialLinks,
    isVerified:        false,
    verifyCode:        code,
    verifyCodeExpires: expires,
  });

  console.log(`📝 Nouvelle inscription : ${user.name} (${user.email}) — rôle: ${user.role}`);

  // Email de bienvenue (non-bloquant, non critique pour le flux d'inscription)
  emailService.sendWelcome(user.email, { name: user.name, role: user.role });

  // Email admin (non-bloquant, non critique)
  User.findOne({ role: "admin" }).select("email").lean().then((admin) => {
    if (admin?.email) {
      emailService.sendNewUserAdmin(admin.email, {
        userName:  user.name,
        userEmail: user.email,
        userRole:  user.role,
      });
    }
  });

  // Code de vérification : critique pour la suite du flux, on attend le résultat réel.
  const codeResult = await emailService.sendVerifyCode(user.email, { name: user.name, code });
  if (!codeResult.success) {
    console.error(`⚠️  Code de vérification non envoyé à ${user.email} : ${codeResult.error}`);
  }

  // On renvoie l'email pour que le frontend sache où rediriger
  res.status(201).json({
    message:     "Compte créé. Vérifiez votre email pour obtenir le code.",
    email:       user.email,
    needsVerify: true,
    emailSent:   codeResult.success,
  });
});

// POST /api/auth/verify-email
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    const err = new Error("Email et code requis");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({ email })
    .select("+verifyCode +verifyCodeExpires +password");

  if (!user) {
    const err = new Error("Utilisateur introuvable");
    err.statusCode = 404;
    throw err;
  }

  if (user.isVerified) {
    const err = new Error("Email déjà vérifié");
    err.statusCode = 400;
    throw err;
  }

  // Vérifier expiration
  if (!user.verifyCodeExpires || user.verifyCodeExpires < new Date()) {
    const err = new Error("Code expiré. Demandez un nouveau code.");
    err.statusCode = 400;
    throw err;
  }

  // Vérifier le code
  if (user.verifyCode !== String(code).trim()) {
    const err = new Error("Code incorrect.");
    err.statusCode = 400;
    throw err;
  }

  // Marquer comme vérifié et effacer le code
  user.isVerified        = true;
  user.verifyCode        = undefined;
  user.verifyCodeExpires = undefined;
  await user.save();

  const token = signToken({ id: user._id });
  console.log(`✅ Email vérifié : ${user.name} (${user.email})`);

  res.json({ token, user });
});

// POST /api/auth/resend-code
export const resendCode = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    const err = new Error("Email requis");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({ email })
    .select("+verifyCode +verifyCodeExpires");

  if (!user) {
    const err = new Error("Utilisateur introuvable");
    err.statusCode = 404;
    throw err;
  }

  if (user.isVerified) {
    const err = new Error("Email déjà vérifié");
    err.statusCode = 400;
    throw err;
  }

  // Générer un nouveau code
  const code    = generateCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000);

  user.verifyCode        = code;
  user.verifyCodeExpires = expires;
  await user.save();

  const codeResult = await emailService.sendVerifyCode(user.email, { name: user.name, code });
  if (!codeResult.success) {
    console.error(`⚠️  Code de vérification non renvoyé à ${user.email} : ${codeResult.error}`);
    const err = new Error("Échec de l'envoi de l'email. Réessayez dans quelques instants.");
    err.statusCode = 502;
    throw err;
  }

  console.log(`🔄 Code renvoyé à : ${user.email}`);
  res.json({ message: "Nouveau code envoyé sur votre email." });
});

const REMEMBER_ME_EXPIRES_IN = "30d";
const RESET_TOKEN_EXPIRES_MS = 60 * 60 * 1000; // 1h
const GENERIC_FORGOT_MESSAGE = "Si cet email existe, un lien de réinitialisation vient d'être envoyé.";

// Hash déterministe du token de reset — jamais le token en clair n'est stocké
// en base (même logique qu'un mot de passe : une fuite BDD ne doit pas
// suffire à forger un lien de reset valide).
const hashResetToken = (rawToken) => crypto.createHash("sha256").update(rawToken).digest("hex");

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    const err = new Error("Email requis");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({ email });

  // Ne jamais révéler si l'email existe ou non — même réponse dans tous les
  // cas, on ne fait le travail (génération token + envoi email) que si le
  // compte existe réellement.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    // updateOne ciblé (pas user.save()) : .save() revalide le document
    // entier, y compris des champs sans rapport (ex: languages[].level) —
    // des comptes avec des données antérieures à l'enum actuel faisaient
    // échouer TOUT le flux de réinitialisation en 500, avant même
    // d'atteindre l'envoi d'email. Seuls les 2 champs modifiés ici.
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken:   hashResetToken(rawToken),
          resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_EXPIRES_MS),
        },
      }
    );

    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${rawToken}`;
    const result = await emailService.sendResetPassword(user.email, { name: user.name, resetUrl });
    if (!result.success) {
      console.error(`⚠️  Email de réinitialisation non envoyé à ${user.email} : ${result.error}`);
    } else {
      console.log(`🔑 Lien de réinitialisation envoyé à : ${user.email}`);
    }
  } else {
    console.log(`⚠️  Demande de réinitialisation pour un email inconnu : ${email}`);
  }

  res.json({ message: GENERIC_FORGOT_MESSAGE });
});

// POST /api/auth/reset-password/:token
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    const err = new Error("Le mot de passe doit contenir au moins 6 caractères");
    err.statusCode = 400;
    throw err;
  }

  const hashedToken = hashResetToken(token);
  const user = await User.findOne({
    resetPasswordToken:   hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  }).select("+resetPasswordToken +resetPasswordExpires");

  if (!user) {
    const err = new Error("Lien de réinitialisation invalide ou expiré");
    err.statusCode = 400;
    throw err;
  }

  user.password             = password; // rehashé par le hook pre("save")
  user.resetPasswordToken   = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  console.log(`🔒 Mot de passe réinitialisé : ${user.name} (${user.email})`);
  res.json({ message: "Mot de passe réinitialisé avec succès." });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  if (!email || !password) {
    const err = new Error("Email et mot de passe requis");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    console.log(`⚠️  Tentative de connexion échouée pour : ${email}`);
    const err = new Error("Identifiants invalides");
    err.statusCode = 401;
    throw err;
  }

  // Compte créé via OAuth (Google/Facebook) : jamais de password défini.
  // Sans cette vérification, bcrypt.compare(candidat, undefined) lève
  // "Illegal arguments: string, undefined" — une erreur 500 opaque au lieu
  // d'un message actionnable pour l'utilisateur.
  if (!user.password) {
    const err = new Error("Ce compte utilise une connexion Google/Facebook. Connectez-vous avec ce mode.");
    err.statusCode = 400;
    throw err;
  }

  if (!(await user.comparePassword(password))) {
    console.log(`⚠️  Tentative de connexion échouée pour : ${email}`);
    const err = new Error("Identifiants invalides");
    err.statusCode = 401;
    throw err;
  }

  // Bloquer si le compte a été désactivé par un admin
  if (user.isActive === false) {
    const err = new Error("Ce compte a été désactivé. Contactez un administrateur.");
    err.statusCode = 403;
    throw err;
  }

  // Bloquer si email non vérifié (première connexion)
  if (!user.isVerified) {
    // Renvoyer un code frais automatiquement
    const code    = generateCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      verifyCode:        code,
      verifyCodeExpires: expires,
    });

    const codeResult = await emailService.sendVerifyCode(user.email, { name: user.name, code });
    if (!codeResult.success) {
      console.error(`⚠️  Code de vérification non envoyé à ${user.email} : ${codeResult.error}`);
    }

    return res.status(403).json({
      message:     "Email non vérifié. Un nouveau code vient d'être envoyé.",
      needsVerify: true,
      email:       user.email,
      emailSent:   codeResult.success,
    });
  }

  // Mettre à jour la date de dernière connexion
  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

  // Enregistrer l'historique de connexion
  const rawIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const geo = geoip.lookup(rawIp);
  await LoginHistory.create({
    userId: user._id,
    timestamp: new Date(),
    method: "email",
    location: geo
      ? { country: geo.country, city: geo.city, timezone: geo.timezone }
      : { country: "", city: "", timezone: "" },
  });

  const token = signToken({ id: user._id }, rememberMe ? { expiresIn: REMEMBER_ME_EXPIRES_IN } : {});
  console.log(`✅ Connexion : ${user.name} (${user.email}) — rôle: ${user.role}${rememberMe ? " (session prolongée)" : ""}`);
  res.json({ token, user });
});

// POST /api/auth/google
export const googleAuth = asyncHandler(async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    const err = new Error("Jeton Google manquant");
    err.statusCode = 400;
    throw err;
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    console.error("❌ [google-auth] GOOGLE_CLIENT_ID absent de la configuration serveur");
    const err = new Error("Connexion Google indisponible pour le moment");
    err.statusCode = 503;
    throw err;
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken:  credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    console.log(`⚠️  Jeton Google invalide : ${err.message}`);
    const e = new Error("Jeton Google invalide ou expiré");
    e.statusCode = 401;
    throw e;
  }

  const { sub: googleId, email, name, email_verified } = payload;

  if (!email_verified) {
    const err = new Error("Email Google non vérifié");
    err.statusCode = 401;
    throw err;
  }

  const user = await findOrCreateOAuthUser({
    providerField: "googleId",
    providerId:    googleId,
    email, name,
    provider: "Google",
  });

  // Mettre à jour la date de dernière connexion
  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

  // Enregistrer l'historique de connexion
  const rawIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const geo = geoip.lookup(rawIp);
  await LoginHistory.create({
    userId: user._id,
    timestamp: new Date(),
    method: "google",
    location: geo
      ? { country: geo.country, city: geo.city, timezone: geo.timezone }
      : { country: "", city: "", timezone: "" },
  });

  const token = signToken({ id: user._id });
  console.log(`✅ Connexion Google : ${user.name} (${user.email}) — rôle: ${user.role}`);
  res.json({ token, user });
});

// POST /api/auth/facebook
export const facebookAuth = asyncHandler(async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    const err = new Error("Jeton Facebook manquant");
    err.statusCode = 400;
    throw err;
  }

  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    console.error("❌ [facebook-auth] FACEBOOK_APP_ID/FACEBOOK_APP_SECRET absents de la configuration serveur");
    const err = new Error("Connexion Facebook indisponible pour le moment");
    err.statusCode = 503;
    throw err;
  }

  // 1) Vérifier le jeton auprès de Facebook (appel serveur-à-serveur, contrairement
  // à Google le jeton Facebook n'est pas auto-vérifiable hors-ligne).
  const appAccessToken = `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`;
  let debugData;
  try {
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`
    );
    const debugJson = await debugRes.json();
    debugData = debugJson.data;
  } catch (err) {
    console.log(`⚠️  Échec de vérification du jeton Facebook : ${err.message}`);
    const e = new Error("Jeton Facebook invalide ou expiré");
    e.statusCode = 401;
    throw e;
  }

  if (!debugData?.is_valid || debugData.app_id !== process.env.FACEBOOK_APP_ID) {
    console.log("⚠️  Jeton Facebook invalide ou émis pour une autre application");
    const err = new Error("Jeton Facebook invalide ou expiré");
    err.statusCode = 401;
    throw err;
  }

  // 2) Récupérer le profil (id, nom, email) avec ce même jeton.
  let profile;
  try {
    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`
    );
    profile = await profileRes.json();
  } catch (err) {
    console.log(`⚠️  Échec de récupération du profil Facebook : ${err.message}`);
    const e = new Error("Impossible de récupérer votre profil Facebook");
    e.statusCode = 502;
    throw e;
  }

  const { id: facebookId, name, email } = profile;

  if (!email) {
    // Compte Facebook sans email vérifié associé (ou permission refusée) — on ne peut
    // pas créer/relier de compte sans identifiant email unique.
    const err = new Error("Votre compte Facebook doit avoir un email vérifié pour continuer. Utilisez une autre méthode de connexion.");
    err.statusCode = 422;
    throw err;
  }

  const user = await findOrCreateOAuthUser({
    providerField: "facebookId",
    providerId:    facebookId,
    email, name,
    provider: "Facebook",
  });

  // Mettre à jour la date de dernière connexion
  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

  // Enregistrer l'historique de connexion
  const rawIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const geo = geoip.lookup(rawIp);
  await LoginHistory.create({
    userId: user._id,
    timestamp: new Date(),
    method: "facebook",
    location: geo
      ? { country: geo.country, city: geo.city, timezone: geo.timezone }
      : { country: "", city: "", timezone: "" },
  });

  const token = signToken({ id: user._id });
  console.log(`✅ Connexion Facebook : ${user.name} (${user.email}) — rôle: ${user.role}`);
  res.json({ token, user });
});

// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  res.json({ user });
});

// PUT /api/auth/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const {
    name, phone, university, specialty,
    bio, education, experience, skills, languages, socialLinks, cv, gender,
  } = req.body;

  const updateData = {
    name, phone, university, specialty, bio, education, experience, skills, languages, socialLinks,
  };
  if (cv !== undefined) updateData.cv = cv;

  if (gender === "homme" || gender === "femme") {
    updateData.gender = gender;
    // Ne réassigne l'avatar auto que si l'utilisateur n'a pas déjà une photo
    // personnalisée (avatarUrl actuel vide ou égal à l'un des deux avatars
    // auto-assignés) — sinon on écraserait sa photo perso.
    const isAutoAvatar = !req.user.avatarUrl || Object.values(AVATAR_BY_GENDER).includes(req.user.avatarUrl);
    if (isAutoAvatar) updateData.avatarUrl = AVATAR_BY_GENDER[gender];
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  ).lean();

  res.json({ user });
});

// POST /api/auth/profile/cv
export const uploadProfileCV = asyncHandler(async (req, res) => {
  if (!req.file) {
    const err = new Error("Aucun fichier reçu");
    err.statusCode = 400;
    throw err;
  }

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { cv: { fileName: req.file.originalname, fileUrl } },
    { new: true, runValidators: true }
  ).lean();

  res.json({ user });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  console.log(`👋 Déconnexion : ${req.user?.name || "utilisateur inconnu"}`);
  res.json({ message: "Déconnecté avec succès" });
});

// PUT /api/auth/password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    const err = new Error("Mot de passe actuel et nouveau mot de passe requis");
    err.statusCode = 400;
    throw err;
  }

  if (newPassword.length < 6) {
    const err = new Error("Le nouveau mot de passe doit contenir au moins 6 caractères");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    const err = new Error("Utilisateur introuvable");
    err.statusCode = 404;
    throw err;
  }

  const match = await user.comparePassword(currentPassword);
  if (!match) {
    const err = new Error("Mot de passe actuel incorrect");
    err.statusCode = 401;
    throw err;
  }

  user.password = newPassword;
  await user.save();
  res.json({ message: "Mot de passe modifié avec succès" });
});

// PUT /api/auth/settings
export const updateSettings = asyncHandler(async (req, res) => {
  const { notifications, privacy, ai, internshipPreferences } = req.body;

  const $set = {};
  if (notifications)        $set["settings.notifications"]        = notifications;
  if (privacy)              $set["settings.privacy"]              = privacy;
  if (ai)                   $set["settings.ai"]                   = ai;
  if (internshipPreferences) $set["settings.internshipPreferences"] = internshipPreferences;

  if (Object.keys($set).length === 0) {
    const err = new Error("Aucun paramètre à mettre à jour");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set },
    { new: true, runValidators: true }
  ).lean();

  res.json({ user });
});

// DELETE /api/auth/account
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    const err = new Error("Mot de passe requis pour confirmer la suppression");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    const err = new Error("Utilisateur introuvable");
    err.statusCode = 404;
    throw err;
  }

  const match = await user.comparePassword(password);
  if (!match) {
    const err = new Error("Mot de passe incorrect");
    err.statusCode = 401;
    throw err;
  }

  await User.findByIdAndDelete(req.user._id);
  console.log(`🗑️  Compte supprimé : ${user.email}`);
  res.json({ message: "Compte supprimé définitivement" });
});