export function validatePfePackRegistration(input) {
  const { firstName, lastName, phone, email, university, city, technologies, locationMode, preferredLocation, subject, consentConfirmed } = input || {};
  const requiredText = [
    ["firstName", firstName, 80],
    ["lastName", lastName, 80],
    ["phone", phone, 32],
    ["university", university, 160],
    ["city", city, 100],
  ];

  for (const [field, value, maxLength] of requiredText) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
      const error = new Error(`Le champ ${field} est requis et ne doit pas dépasser ${maxLength} caractères.`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    const error = new Error("Veuillez saisir une adresse email valide.");
    error.statusCode = 400;
    throw error;
  }
  if (!Array.isArray(technologies) || technologies.length < 2 || technologies.length > 20) {
    const error = new Error("Indiquez entre 2 et 20 technologies.");
    error.statusCode = 400;
    throw error;
  }

  const cleanedTechnologies = [...new Set(technologies.map((technology) => {
    if (typeof technology !== "string" || technology.trim().length > 160) {
      const error = new Error("Chaque technologie doit contenir au maximum 160 caractères.");
      error.statusCode = 400;
      throw error;
    }
    return technology.trim();
  }).filter(Boolean))];
  if (cleanedTechnologies.length < 2) {
    const error = new Error("Indiquez au moins deux technologies différentes.");
    error.statusCode = 400;
    throw error;
  }
  if (!["remote", "onsite"].includes(locationMode)) {
    const error = new Error("Choisissez un mode de stage valide.");
    error.statusCode = 400;
    throw error;
  }
  const cleanedLocation = typeof preferredLocation === "string" ? preferredLocation.trim() : "";
  if ((locationMode === "onsite" && !cleanedLocation) || cleanedLocation.length > 200) {
    const error = new Error("Indiquez un lieu de stage valide.");
    error.statusCode = 400;
    throw error;
  }
  if (consentConfirmed !== true) {
    const error = new Error("Confirmez l’exactitude des informations et votre accord pour être contacté.");
    error.statusCode = 400;
    throw error;
  }
  if (subject !== undefined && (typeof subject !== "string" || subject.trim().length > 3000)) {
    const error = new Error("Le sujet ne doit pas dépasser 3000 caractères.");
    error.statusCode = 400;
    throw error;
  }

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone.trim(),
    email: email.trim().toLowerCase(),
    university: university.trim(),
    city: city.trim(),
    technologies: cleanedTechnologies,
    locationMode,
    preferredLocation: locationMode === "onsite" ? cleanedLocation : "",
    consentConfirmed,
    ...(typeof subject === "string" ? { subject: subject.trim() } : {}),
  };
}
