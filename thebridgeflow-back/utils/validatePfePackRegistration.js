export function validatePfePackRegistration(input) {
  const { firstName, lastName, phone, email, technologies, subject } = input || {};
  const requiredText = [
    ["firstName", firstName, 80],
    ["lastName", lastName, 80],
    ["phone", phone, 32],
    ["subject", subject, 3000],
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
  if (!Array.isArray(technologies) || technologies.length === 0 || technologies.length > 20) {
    const error = new Error("Indiquez entre 1 et 20 technologies.");
    error.statusCode = 400;
    throw error;
  }

  const cleanedTechnologies = [...new Set(technologies.map((technology) => {
    if (typeof technology !== "string" || technology.trim().length > 60) {
      const error = new Error("Chaque technologie doit contenir au maximum 60 caractères.");
      error.statusCode = 400;
      throw error;
    }
    return technology.trim();
  }).filter(Boolean))];
  if (!cleanedTechnologies.length) {
    const error = new Error("Indiquez au moins une technologie.");
    error.statusCode = 400;
    throw error;
  }

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone.trim(),
    email: email.trim().toLowerCase(),
    technologies: cleanedTechnologies,
    subject: subject.trim(),
  };
}
