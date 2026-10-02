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
import { isValidPrice, toInputPrice } from "../lib/price";
import { apiErrorMessage, useI18n } from "../i18n";

type Edit = { productId: number; value: string };

export default function HomePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const i18n = useI18n();
  const { t, tp, formatMoney } = i18n;

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

  const valueOf = (variantId: number) =>
    edits[variantId]?.value ?? toInputPrice(saved[variantId], i18n.decimalSeparator);

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
      addToast({ id: "wholesale-saved", type: "success", text: t("home.toast.saved"), duration: 4000 });
    } catch (err) {
      addToast({
        id: "wholesale-error",
        type: "danger",
        text: apiErrorMessage(err, i18n, "home.toast.saveError"),
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
      addToast({ id: "setup-ok", type: "success", text: t("home.toast.setupOk"), duration: 4000 });
    } catch (err) {
      console.error(err);
      addToast({
        id: "setup-error",
        type: "danger",
        text: t("home.toast.setupError"),
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
      config ? t("home.subtitle.withMin", { count: config.minQuantity }) : t("home.subtitle.noMin"),
    [config, t],
  );

  const priceInput = (product: Product, variant: Variant) => {
    const value = valueOf(variant.id);
    return (
      <Input
        aria-label={t("home.priceInput.label", { product: product.name, variant: variant.name })}
        inputMode="decimal"
        placeholder={i18n.pricePlaceholder}
        prefix={i18n.currencySymbol}
        value={value}
        appearance={isValidPrice(value) ? "neutral" : "danger"}
        onChange={(e) => setValue(product.id, variant.id, e.target.value)}
      />
    );
  };

  const applyLink = (product: Product) =>
    product.variants.length > 1 ? (
      <Link appearance="primary" onClick={() => applyToAll(product)}>
        {t("home.applyToAll")}
      </Link>
    ) : null;

  const renderBody = () => {
    if (failed) return <ErrorState onRetry={retry} primary={false} />;

    if (!loading && data && data.products.length === 0) {
      return query ? (
        <EmptyMessage
          icon={<SearchIcon size={32} />}
          title={t("home.empty.search.title")}
          text={t("home.empty.search.text")}
          actions={
            <Button appearance="neutral" onClick={() => setSearch("")}>
              {t("home.empty.search.action")}
            </Button>
          }
        />
      ) : (
        <EmptyMessage
          icon={<BoxPackedIcon size={32} />}
          title={t("home.empty.store.title")}
          text={t("home.empty.store.text")}
          actions={
            <Button appearance="neutral" onClick={() => goTo(nexo, "/products/new")}>
              {t("home.empty.store.action")}
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
                <Table.Cell as="th">{t("home.table.product")}</Table.Cell>
                <Table.Cell as="th">{t("home.table.variant")}</Table.Cell>
                <Table.Cell as="th">{t("home.table.price")}</Table.Cell>
                <Table.Cell as="th">{t("home.table.wholesalePrice")}</Table.Cell>
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
                          <Text>{formatMoney(variant.price)}</Text>
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
                          {variant.name} · {formatMoney(variant.price)}
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
        title={t("home.title")}
        subtitle={subtitle}
        buttonStack={
          <>
            <Button appearance="neutral" onClick={goToConfig}>
              <CogIcon />
              {t("home.configure")}
            </Button>
            <Button appearance="primary" disabled={!pending || hasInvalid || saving} onClick={save}>
              {saving ? <Spinner size="small" /> : <DisketteIcon />}
              {pending ? t("home.saveCount", { count: pending }) : t("home.save")}
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
                aria-label={t("home.search.label")}
                placeholder={t("home.search.placeholder")}
                append={<SearchIcon />}
                appendPosition="start"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {config && !config.ready && (
                <Alert appearance="warning" title={t("home.setupPending.title")}>
                  <Box display="flex" flexDirection="column" gap="2" alignItems="flex-start">
                    <Text>{t("home.setupPending.text")}</Text>
                    <Button appearance="neutral" disabled={fixingSetup} onClick={finishSetup}>
                      {fixingSetup && <Spinner size="small" />}
                      {t("home.setupPending.action")}
                    </Button>
                  </Box>
                </Alert>
              )}
              {config?.ready && !config.hasWholesalePrices && !pending && (
                <Alert appearance="primary" title={t("home.onboarding.title")}>
                  <Text>{t("home.onboarding.text", { count: config.minQuantity })}</Text>
                </Alert>
              )}
              {hasInvalid && (
                <Text color="danger-textLow">
                  {t("home.invalidPrice", { example: `10${i18n.decimalSeparator}50` })}
                </Text>
              )}
              {renderBody()}
            </Box>
          </Card.Body>
        </Card>
      </Page.Body>

      <Modal open={confirmLeave} onDismiss={() => setConfirmLeave(false)}>
        <Modal.Header title={t("home.leave.title")} />
        <Modal.Body>
          <Text>{tp("home.leave.message", pending)}</Text>
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="neutral" onClick={() => setConfirmLeave(false)}>
            {t("home.leave.keepEditing")}
          </Button>
          <Button appearance="danger" onClick={() => navigate("/config")}>
            {t("home.leave.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>
    </Page>
  );
}
