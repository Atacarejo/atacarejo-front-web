// Tela principal: lista os produtos da loja e deixa definir o preço de atacado de cada variante.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { goTo } from "@tiendanube/nexo";
import {
  Alert,
  Box,
  Button,
  Card,
  Input,
  Link,
  Modal,
  Pagination,
  Skeleton,
  Spinner,
  Table,
  Text,
  Thumbnail,
  useToast,
} from "@nimbus-ds/components";
import { DataList, EmptyMessage, Page } from "@nimbus-ds/patterns";
import { BoxPackedIcon, CogIcon, DisketteIcon, SearchIcon } from "@nimbus-ds/icons";
import nexo from "../nexoClient";
import ErrorState from "../components/ErrorState";
import {
  api,
  type Product,
  type ProductsResponse,
  type StoreConfig,
  type Variant,
  type WholesalePrice,
} from "../lib/api";
import { formatBRL, isValidPrice, toInputPrice } from "../lib/price";

type Edit = { productId: number; value: string };

export default function HomePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [saved, setSaved] = useState<Record<number, string>>({}); // variantId → preço salvo
  const [edits, setEdits] = useState<Record<number, Edit>>({}); // alterações ainda não salvas (todas as páginas)
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [fixingSetup, setFixingSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // busca com debounce; nova busca volta para a página 1
  useEffect(() => {
    const t = setTimeout(() => {
      const next = search.trim();
      if (next === query) return;
      setLoading(true);
      setQuery(next);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search, query]);

  // busca a página atual; quem dispara a recarga liga o "loading" antes (changePage, retry, busca)
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (query) params.set("q", query);
      const res = await api<ProductsResponse>(`/api/products?${params}`);

      const variantIds = res.products.flatMap((p) => p.variants.map((v) => v.id));
      const prices = variantIds.length
        ? await api<WholesalePrice[]>(`/api/wholesale?variant_ids=${variantIds.join(",")}`)
        : [];

      setSaved((prev) => ({ ...prev, ...Object.fromEntries(prices.map((p) => [p.variantId, p.price])) }));
      setData(res);
      setFailed(false);
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<StoreConfig>("/api/config")
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  const valueOf = (variantId: number) => edits[variantId]?.value ?? toInputPrice(saved[variantId]);

  const setValue = (productId: number, variantId: number, value: string) =>
    setEdits((prev) => ({ ...prev, [variantId]: { productId, value } }));

  const applyToAll = (product: Product) => {
    const value = valueOf(product.variants[0].id);
    setEdits((prev) => ({
      ...prev,
      ...Object.fromEntries(product.variants.map((v) => [v.id, { productId: product.id, value }])),
    }));
  };

  const pending = Object.keys(edits).length;
  const hasInvalid = Object.values(edits).some((e) => !isValidPrice(e.value));

  const save = async () => {
    setSaving(true);
    try {
      const items = Object.entries(edits).map(([variantId, e]) => ({
        productId: e.productId,
        variantId: Number(variantId),
        price: e.value.trim() || null, // vazio remove o atacado da variante
      }));
      await api("/api/wholesale", { method: "POST", body: JSON.stringify({ items }) });

      setSaved((prev) => {
        const next = { ...prev };
        for (const item of items) {
          if (item.price) next[item.variantId] = item.price.replace(",", ".");
          else delete next[item.variantId];
        }
        return next;
      });
      setEdits({});
      setConfig((c) => (c ? { ...c, hasWholesalePrices: c.hasWholesalePrices || items.some((i) => i.price) } : c));
      addToast({ id: "wholesale-saved", type: "success", text: "Preços de atacado salvos", duration: 4000 });
    } catch (err) {
      addToast({
        id: "wholesale-error",
        type: "danger",
        text: err instanceof Error ? err.message : "Não foi possível salvar os preços",
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  };

  const changePage = (next: number) => {
    setLoading(true);
    setPage(next);
  };

  const retry = () => {
    setLoading(true);
    setFailed(false);
    load();
  };

  const finishSetup = async () => {
    setFixingSetup(true);
    try {
      await api("/api/setup", { method: "POST" });
      setConfig((c) => (c ? { ...c, ready: true } : c));
      addToast({ id: "setup-ok", type: "success", text: "Configuração concluída", duration: 4000 });
    } catch {
      addToast({
        id: "setup-error",
        type: "danger",
        text: "Não foi possível concluir a configuração. Tente de novo em instantes.",
        duration: 8000,
      });
    } finally {
      setFixingSetup(false);
    }
  };

  const goToConfig = () => (pending ? setConfirmLeave(true) : navigate("/config"));

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  const subtitle = useMemo(
    () =>
      config
        ? `O desconto é aplicado quando o carrinho tiver ${config.minQuantity} ou mais unidades com preço de atacado.`
        : "O desconto é aplicado quando o carrinho atinge a quantidade mínima de atacado.",
    [config],
  );

  const priceInput = (product: Product, variant: Variant) => {
    const value = valueOf(variant.id);
    return (
      <Input
        aria-label={`Preço de atacado de ${product.name} ${variant.name}`}
        inputMode="decimal"
        placeholder="0,00"
        prefix="R$"
        value={value}
        appearance={isValidPrice(value) ? "neutral" : "danger"}
        onChange={(e) => setValue(product.id, variant.id, e.target.value)}
      />
    );
  };

  const applyLink = (product: Product) =>
    product.variants.length > 1 ? (
      <Link appearance="primary" onClick={() => applyToAll(product)}>
        Repetir para todas as variantes
      </Link>
    ) : null;

  const renderBody = () => {
    if (failed) return <ErrorState onRetry={retry} primary={false} />;

    if (!loading && data && data.products.length === 0) {
      return query ? (
        <EmptyMessage
          icon={<SearchIcon size={32} />}
          title="Nenhum produto encontrado"
          text="Revise o termo buscado ou limpe a busca para ver todos os produtos."
          actions={
            <Button appearance="neutral" onClick={() => setSearch("")}>
              Limpar busca
            </Button>
          }
        />
      ) : (
        <EmptyMessage
          icon={<BoxPackedIcon size={32} />}
          title="Sua loja ainda não tem produtos"
          text="Cadastre produtos no admin da Nuvemshop e volte aqui para definir os preços de atacado."
          actions={
            <Button appearance="neutral" onClick={() => goTo(nexo, "/products/new")}>
              Cadastrar produto
            </Button>
          }
        />
      );
    }

    return (
      <>
        {/* desktop: tabela */}
        <Box display={{ xs: "none", md: "block" }}>
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Cell as="th">Produto</Table.Cell>
                <Table.Cell as="th">Variante</Table.Cell>
                <Table.Cell as="th">Preço</Table.Cell>
                <Table.Cell as="th">Preço de atacado</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {loading || !data
                ? Array.from({ length: 5 }, (_, i) => (
                    <Table.Row key={i}>
                      {Array.from({ length: 4 }, (_, j) => (
                        <Table.Cell key={j}>
                          <Skeleton width="100%" height="2rem" />
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                : data.products.flatMap((product) =>
                    product.variants.map((variant, i) => (
                      <Table.Row key={variant.id}>
                        <Table.Cell>
                          {i === 0 ? (
                            <Box display="flex" gap="2" alignItems="center">
                              <Thumbnail src={product.image ?? undefined} alt={product.name} width="48px" />
                              <Box display="flex" flexDirection="column" gap="1">
                                <Text>{product.name}</Text>
                                {applyLink(product)}
                              </Box>
                            </Box>
                          ) : null}
                        </Table.Cell>
                        <Table.Cell>
                          <Text>{variant.name}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text>{formatBRL(variant.price)}</Text>
                        </Table.Cell>
                        <Table.Cell>{priceInput(product, variant)}</Table.Cell>
                      </Table.Row>
                    )),
                  )}
            </Table.Body>
          </Table>
        </Box>

        {/* mobile: Data List (a homologação não aceita tabela no mobile) */}
        <Box display={{ xs: "block", md: "none" }}>
          {loading || !data ? (
            <Skeleton width="100%" height="10rem" />
          ) : (
            <DataList>
              {data.products.map((product) => (
                <DataList.Row key={product.id}>
                  <Box display="flex" flexDirection="column" gap="2" width="100%">
                    <Box display="flex" gap="2" alignItems="center">
                      <Thumbnail src={product.image ?? undefined} alt={product.name} width="40px" />
                      <Text fontWeight="bold">{product.name}</Text>
                    </Box>
                    {product.variants.map((variant) => (
                      <Box key={variant.id} display="flex" flexDirection="column" gap="1">
                        <Text fontSize="caption">
                          {variant.name} · {formatBRL(variant.price)}
                        </Text>
                        {priceInput(product, variant)}
                      </Box>
                    ))}
                    {applyLink(product)}
                  </Box>
                </DataList.Row>
              ))}
            </DataList>
          )}
        </Box>

        {data && pageCount > 1 && (
          <Box display="flex" justifyContent="center" paddingTop="4">
            <Pagination activePage={page} pageCount={pageCount} onPageChange={changePage} />
          </Box>
        )}
      </>
    );
  };

  return (
    <Page maxWidth="1200px">
      <Page.Header
        title="Definir preços de atacado"
        subtitle={subtitle}
        buttonStack={
          <>
            <Button appearance="neutral" onClick={goToConfig}>
              <CogIcon />
              Configurar
            </Button>
            <Button appearance="primary" disabled={!pending || hasInvalid || saving} onClick={save}>
              {saving ? <Spinner size="small" /> : <DisketteIcon />}
              {pending ? `Salvar (${pending})` : "Salvar"}
            </Button>
          </>
        }
      />
      <Page.Body>
        <Card>
          <Card.Body>
            <Box display="flex" flexDirection="column" gap="4">
              <Input
                type="search"
                aria-label="Buscar produtos"
                placeholder="Buscar por nome ou SKU"
                append={<SearchIcon />}
                appendPosition="start"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {config && !config.ready && (
                <Alert appearance="warning" title="Falta concluir a configuração">
                  <Box display="flex" flexDirection="column" gap="2" alignItems="flex-start">
                    <Text>
                      A promoção de atacado ainda não foi criada na sua loja, então o desconto não aparece no carrinho.
                    </Text>
                    <Button appearance="neutral" disabled={fixingSetup} onClick={finishSetup}>
                      {fixingSetup && <Spinner size="small" />}
                      Concluir configuração
                    </Button>
                  </Box>
                </Alert>
              )}
              {config?.ready && !config.hasWholesalePrices && !pending && (
                <Alert appearance="primary" title="Comece definindo os preços de atacado">
                  <Text>
                    Digite o preço de atacado nas variantes que você quer vender no atacado e clique em Salvar. Quando o
                    carrinho tiver {config.minQuantity} ou mais unidades desses produtos, o desconto é aplicado
                    automaticamente, sem cupom.
                  </Text>
                </Alert>
              )}
              {hasInvalid && (
                <Text color="danger-textLow">
                  Use só números com até 2 casas decimais, como 10,50. Para remover o preço de atacado, deixe o campo
                  vazio.
                </Text>
              )}
              {renderBody()}
            </Box>
          </Card.Body>
        </Card>
      </Page.Body>

      <Modal open={confirmLeave} onDismiss={() => setConfirmLeave(false)}>
        <Modal.Header title="Sair sem salvar?" />
        <Modal.Body>
          <Text>
            Você tem {pending} {pending === 1 ? "alteração" : "alterações"} de preço que ainda não {pending === 1 ? "foi salva" : "foram salvas"}.
          </Text>
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="neutral" onClick={() => setConfirmLeave(false)}>
            Continuar editando
          </Button>
          <Button appearance="danger" onClick={() => navigate("/config")}>
            Sair sem salvar
          </Button>
        </Modal.Footer>
      </Modal>
    </Page>
  );
}
