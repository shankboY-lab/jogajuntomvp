// BE-06 — regra pura do perfil completo (testável sem banco, QA-01):
// nome + cidade + coords + consent + >=1 contato + >=1 jogo.
export function isProfileCompleteRule(input: {
  displayName: string;
  city: string;
  hasCoords: boolean;
  hasConsent: boolean;
  whatsapp: string | null;
  telegram: string | null;
  gamesCount: number;
}): boolean {
  return (
    input.displayName.trim().length >= 2 &&
    input.city.trim().length > 0 &&
    input.hasCoords &&
    input.hasConsent &&
    (Boolean(input.whatsapp) || Boolean(input.telegram)) &&
    input.gamesCount >= 1
  );
}
