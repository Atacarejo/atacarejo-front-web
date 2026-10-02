// Modelos de exibição do atacado na vitrine. O valor vai para store_config.design_option
// e o NubeSDK escolhe o layout por ele. Novo modelo: adicione aqui, na API
// (atacarejo-api/lib/design-options.ts), no SDK e os textos nos dicionários (src/i18n/dictionaries).
import type { MessageKey } from "../i18n/types";

export type DesignOptionInfo = {
  value: number;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
};

export const DESIGN_OPTIONS: DesignOptionInfo[] = [
  {
    value: 1,
    titleKey: "design.1.title",
    descriptionKey: "design.1.description",
  },
];
