/* Une seule adresse pour le site : ouvert sur « www.<domaine de l'API> »
   (ex. www.9antra.tn), il est renvoyé vers le même chemin sur le domaine
   principal (9antra.tn). Sans cela, la session (stockée par adresse),
   l'API et la connexion Google ne fonctionneraient pas pareil selon que
   l'adresse a été saisie avec ou sans www (certains navigateurs l'ajoutent).
   Renvoie l'URL cible, ou null s'il n'y a rien à faire (dev, autre domaine). */
export function canonicalHostUrl(location, apiUrl) {
  let apiHost;
  try {
    apiHost = new URL(apiUrl).hostname;
  } catch {
    return null; // API relative ou absente : rien à comparer
  }
  if (!apiHost || location?.hostname !== `www.${apiHost}`) return null;
  const port = location.port ? `:${location.port}` : "";
  return `${location.protocol}//${apiHost}${port}${location.pathname}${location.search}${location.hash}`;
}
