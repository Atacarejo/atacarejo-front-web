// Modelos de exibição do atacado na vitrine. O valor vai para store_config.design_option
// e o NubeSDK escolhe o layout por ele. Novo modelo: adicione aqui, na API
// (atacarejo-api/lib/design-options.ts) e no SDK.

export type DesignOptionInfo = {
  value: number;
  title: string;
  description: string;
};

export const DESIGN_OPTIONS: DesignOptionInfo[] = [
  {
    value: 1,
    title: "Padrão",
    description: "Modelo atual de exibição do preço de atacado na loja.",
  },
];
