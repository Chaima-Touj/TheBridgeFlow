import User from "../models/users.model.js";
import asyncHandler from "../utils/asyncHandler.js";

// GET /api/favorites
export const getFavorites = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("favorites");
  res.json({ favorites: user.favorites });
});

// POST /api/favorites/:offerId — toggle ajout/retrait
export const toggleFavorite = asyncHandler(async (req, res) => {
  const { offerId } = req.params;
  const user = await User.findById(req.user._id);

  const index = user.favorites.findIndex((id) => id.toString() === offerId);
  let isFavorite;

  if (index === -1) {
    user.favorites.push(offerId);
    isFavorite = true;
  } else {
    user.favorites.splice(index, 1);
    isFavorite = false;
  }

  await user.save();
  res.json({ isFavorite, favoritesCount: user.favorites.length });
});
