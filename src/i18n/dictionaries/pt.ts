// Português (Brasil). É a fonte das chaves: es.ts e en.ts são tipados com `Dictionary`,
// então o TypeScript acusa chave faltando ou sobrando.
// Interpolação: {nome}. Plural: chaves irmãs ".one" / ".other" (use tp()).

export const pt = {
  // App (erro antes de conectar ao Nexo)
  "app.connectError.title": "Não foi possível abrir o app",
  "app.connectError.message": "Abra o Atacarejo pelo admin da Nuvemshop, em Meus aplicativos.",

  // ErrorState
  "errorState.title": "Não foi possível carregar as informações",
  "errorState.message": "Pode ser uma instabilidade momentânea. Tente de novo em alguns instantes.",
  "errorState.retry": "Tentar de novo",
  "errorState.support": "Se continuar, fale com a gente:",

  // HomePage
  "home.title": "Definir preços de atacado",
  "home.subtitle.withMin":
    "O desconto é aplicado quando o carrinho tiver {count} ou mais unidades com preço de atacado.",
  "home.subtitle.noMin": "O desconto é aplicado quando o carrinho atinge a quantidade mínima de atacado.",
  "home.configure": "Configurar",
  "home.save": "Salvar",
  "home.saveCount": "Salvar ({count})",
  "home.search.label": "Buscar produtos",
  "home.search.placeholder": "Buscar por nome ou SKU",
  "home.setupPending.title": "Falta concluir a configuração",
  "home.setupPending.text":
    "A promoção de atacado ainda não foi criada na sua loja, então o desconto não aparece no carrinho.",
  "home.setupPending.action": "Concluir configuração",
  "home.onboarding.title": "Comece definindo os preços de atacado",
  "home.onboarding.text":
    "Digite o preço de atacado nas variantes que você quer vender no atacado e clique em Salvar. Quando o carrinho tiver {count} ou mais unidades desses produtos, o desconto é aplicado automaticamente, sem cupom.",
  "home.invalidPrice":
    "Use só números com até 2 casas decimais, como {example}. Para remover o preço de atacado, deixe o campo vazio.",
  "home.empty.search.title": "Nenhum produto encontrado",
  "home.empty.search.text": "Revise o termo buscado ou limpe a busca para ver todos os produtos.",
  "home.empty.search.action": "Limpar busca",
  "home.empty.store.title": "Sua loja ainda não tem produtos",
  "home.empty.store.text":
    "Cadastre produtos no admin da Nuvemshop e volte aqui para definir os preços de atacado.",
  "home.empty.store.action": "Cadastrar produto",
  "home.table.product": "Produto",
  "home.table.variant": "Variante",
  "home.table.price": "Preço",
  "home.table.wholesalePrice": "Preço de atacado",
  "home.applyToAll": "Repetir para todas as variantes",
  "home.priceInput.label": "Preço de atacado de {product} {variant}",
  "home.toast.saved": "Preços de atacado salvos",
  "home.toast.saveError": "Não foi possível salvar os preços",
  "home.toast.setupOk": "Configuração concluída",
  "home.toast.setupError": "Não foi possível concluir a configuração. Tente de novo em instantes.",
  "home.leave.title": "Sair sem salvar?",
  "home.leave.message.one": "Você tem {count} alteração de preço que ainda não foi salva.",
  "home.leave.message.other": "Você tem {count} alterações de preço que ainda não foram salvas.",
  "home.leave.keepEditing": "Continuar editando",
  "home.leave.confirm": "Sair sem salvar",

  // ConfigPage
  "config.backLink": "Preços de atacado",
  "config.title": "Configurar atacado",
  "config.save": "Salvar",
  "config.minQuantity.title": "Quantidade mínima",
  "config.minQuantity.text":
    "O preço de atacado vale quando o carrinho tiver essa quantidade de unidades, somando só os produtos que têm preço de atacado. Produtos sem preço de atacado continuam com o preço normal.",
  "config.minQuantity.label": "Unidades no carrinho",
  "config.minQuantity.help": "Ex.: com 3, o desconto aparece a partir de 3 unidades.",
  "config.minQuantity.invalid": "Use um número inteiro de {min} a {max}.",
  "config.design.title": "Modelo de exibição",
  "config.design.text": "Escolha como o preço de atacado aparece para os clientes na sua loja.",
  "config.toast.saved": "Configuração salva",
  "config.toast.saveError": "Não foi possível salvar",

  // Modelos de exibição (lib/design-options.ts)
  "design.1.title": "Padrão",
  "design.1.description": "Modelo atual de exibição do preço de atacado na loja.",

  // Erros da API (i18n/api-errors.ts)
  "apiError.invalidDesignOption": "O modelo de exibição escolhido não está disponível.",
  "apiError.invalidMinQuantity": "A quantidade mínima deve ser um número inteiro de 1 a 999.",
  "apiError.invalidPrice": "Algum preço está inválido. Use só números com até 2 casas decimais.",
  "apiError.storeNotInstalled": "O app não está instalado nesta loja. Reinstale o Atacarejo pelo admin da Nuvemshop.",
  "apiError.rateLimited": "Muitas requisições em pouco tempo. Tente de novo em instantes.",
  "apiError.nuvemshopUnavailable": "A Nuvemshop não respondeu. Tente de novo em instantes.",
  "apiError.invalidToken": "O acesso à loja expirou. Reinstale o app pelo admin da Nuvemshop.",
  "apiError.badRequest": "Alguns dados estão inválidos. Revise e tente de novo.",
  "apiError.unauthorized": "Não foi possível validar o acesso. Reinstale o app pelo admin da Nuvemshop.",
  "apiError.server": "Ocorreu um erro no servidor. Tente de novo em instantes.",
};
