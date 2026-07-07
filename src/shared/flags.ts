// INF-08 — Feature flags v3 (fonte única, server + client).
//
// Espelhadas em NEXT_PUBLIC_* para que o mesmo booleano valha no servidor e no
// bundle do cliente (o Next inlina NEXT_PUBLIC_* no build). Com TODAS as flags
// desligadas o app é byte-a-byte o comportamento v2 (critério de regressão do
// PRD §8): as rotas de API novas respondem 404 e os componentes de UI novos não
// renderizam (nem o card da home).

function isOn(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

export const FEATURE_FLAGS = {
  manualGames: isOn(process.env.NEXT_PUBLIC_FEATURE_MANUAL_GAMES),
  explore: isOn(process.env.NEXT_PUBLIC_FEATURE_EXPLORE),
  groups: isOn(process.env.NEXT_PUBLIC_FEATURE_GROUPS),
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
