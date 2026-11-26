// Tela principal: o resumo (produtos com atacado, a regra e a assinatura) e a tabela de preços, com a busca e o
// filtro em cima. Cada variante tem o input do preço de atacado e o desconto que ele dá. As alterações ficam numa
// barra de salvar fixa no rodapé. No celular a tabela vira Data List (a homologação não aceita tabela no mobile).
import { useCallback, useEffect, useRef, useState } from "react";
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
  SegmentedControl,
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
import BillingBanner from "../components/BillingBanner";
import ErrorState from "../components/ErrorState";
import {
  api,
  type Billing,
  type Product,
  type ProductsResponse,
  type StoreConfig,
  type Variant,
  type WholesalePrice,
} from "../lib/api";
import { discountPercent, isValidPrice, toInputPrice } from "../lib/price";
import { billingStatusInfo, billingVisible, useBilling } from "../lib/billing";
import { apiErrorMessage, useI18n } from "../i18n";

type Edit = { productId: number; value: string };
type Filter = "all" | "with" | "without";
const FILTERS: Filter[] = ["all", "with", "without"];

export default function HomePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const i18n = useI18n();
  const { t, tp, formatMoney, formatDate } = i18n;
  const { billing, today } = useBilling();

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [saved, setSaved] = useState<Record<number, string>>({}); // variantId → preço salvo
  const [edits, setEdits] = useState<Record<number, Edit>>({}); // alterações ainda não salvas (todas as páginas)
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [fixingSetup, setFixingSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  // destino de uma navegação parada pelo modal "Sair sem salvar?" (null = modal fechado)
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

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

  // número da última busca: a resposta de uma busca antiga (outro filtro, página ou termo) não sobrescreve a nova
  const latestLoad = useRef(0);

  // busca a página atual; quem dispara a recarga liga o "loading" antes (changePage, retry, busca, filtro)
  const load = useCallback(async () => {
    const request = ++latestLoad.current;
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (query) params.set("q", query);
      if (filter !== "all") params.set("filter", filter);
      const res = await api<ProductsResponse>(`/api/products?${params}`);

      const variantIds = res.products.flatMap((p) => p.variants.map((v) => v.id));
      const prices = variantIds.length
        ? await api<WholesalePrice[]>(`/api/wholesale?variant_ids=${variantIds.join(",")}`)
        : [];

      if (request !== latestLoad.current) return;
      setSaved((prev) => ({ ...prev, ...Object.fromEntries(prices.map((p) => [p.variantId, p.price])) }));
      setData(res);
      setFailed(false);
    } catch (err) {
      if (request !== latestLoad.current) return;
      console.error(err);
      setFailed(true);
    } finally {
      if (request === latestLoad.current) setLoading(false);
    }
  }, [page, query, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const loadConfig = useCallback(() => {
    api<StoreConfig>("/api/config")
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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
      // o resumo conta os produtos com atacado; com o filtro ligado, um produto pode ter saído da lista
      loadConfig();
      if (filter !== "all") {
        setLoading(true);
        load();
      }
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

  const changeFilter = (next: Filter) => {
    if (next === filter) return;
    setLoading(true);
    setFilter(next);
    setPage(1);
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
      addToast({ id: "setup-error", type: "danger", text: t("home.toast.setupError"), duration: 8000 });
    } finally {
      setFixingSetup(false);
    }
  };

  // com preços não salvos, sair da tela (Configurar, o resumo ou o aviso da assinatura) pede confirmação
  const navigateSafely = (path: string) => (pending ? setLeaveTo(path) : navigate(path));

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  /** Linha curta da assinatura no resumo: a data que importa e o atalho. */
  const billingLine = (b: Billing): { caption: string; action: string } => {
    if (b.status === "trialing") {
      return b.subscribed
        ? {
            caption: t("home.summary.billing.firstCharge", { date: formatDate(b.trialEndsOn) }),
            action: t("home.summary.billing.view"),
          }
        : {
            caption: t("home.summary.billing.until", { date: formatDate(b.trialEndsOn) }),
            action: t("home.summary.billing.subscribe"),
          };
    }
    if (b.status === "active") {
      if (!b.subscribed)
        return {
          caption: t("home.summary.billing.activeUntil", { date: formatDate(b.paidUntil) }),
          action: t("home.summary.billing.subscribe"),
        };
      if (b.cancelAtPeriodEnd)
        return {
          caption: t("home.summary.billing.activeUntil", { date: formatDate(b.paidUntil) }),
          action: t("home.summary.billing.view"),
        };
      return {
        caption: t("home.summary.billing.renews", { date: formatDate(b.paidUntil) }),
        action: t("home.summary.billing.view"),
      };
    }
    if (b.status === "past_due")
      return {
        caption: t("home.summary.billing.payUntil", { date: formatDate(b.graceUntil) }),
        action: t("home.summary.billing.pay"),
      };
    return { caption: "", action: t("home.summary.billing.view") };
  };

  const statCard = (title: string, caption: string, action: string, onAction: () => void) => (
    <Card padding="small">
      <Box display="flex" flexDirection="column" gap="1">
        <Text fontWeight="bold">{title}</Text>
        <Box display="flex" gap="1" flexWrap="wrap" alignItems="baseline">
          {caption && (
            <Text fontSize="caption" color="neutral-textLow">
              {caption}
            </Text>
          )}
          {caption && (
            <Text fontSize="caption" color="neutral-textLow">
              ·
            </Text>
          )}
          <Link as="button" appearance="primary" fontSize="caption" textDecoration="none" onClick={onAction}>
            {action}
          </Link>
        </Box>
      </Box>
    </Card>
  );

  /** Resumo no topo: produtos com atacado, a regra em vigor e a assinatura, cada um com o atalho. */
  const summary = () => {
    if (!config) {
      return (
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr 1fr" }} gridGap="3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} width="100%" height="4.5rem" />
          ))}
        </Box>
      );
    }
    const visible = billingVisible(billing);
    const line = visible ? billingLine(billing) : null;
    return (
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: visible ? "1fr 1fr 1fr" : "1fr 1fr" }} gridGap="3">
        {statCard(
          tp("home.summary.products", config.wholesaleProducts),
          t("home.summary.productsCaption"),
          config.wholesaleProducts > 0 ? t("home.summary.productsAction") : t("home.summary.productsStart"),
          () => changeFilter(config.wholesaleProducts > 0 ? "with" : "without"),
        )}
        {statCard(
          tp("home.summary.minQuantity", config.minQuantity),
          t("home.summary.ruleCaption"),
          t("home.summary.change"),
          () => navigateSafely("/config"),
        )}
        {visible &&
          line &&
          statCard(billingStatusInfo(billing, i18n, today).label, line.caption, line.action, () =>
            navigateSafely("/billing"),
          )}
      </Box>
    );
  };

  /** Input do preço de atacado, com o desconto que ele dá logo embaixo. */
  const priceInput = (product: Product, variant: Variant) => {
    const value = valueOf(variant.id);
    const discount = discountPercent(variant.price, value);
    return (
      <Box display="flex" flexDirection="column" gap="1">
        <Input
          aria-label={t("home.priceInput.label", { product: product.name, variant: variant.name })}
          inputMode="decimal"
          placeholder={t("home.priceInput.empty")}
          prefix={i18n.currencySymbol}
          value={value}
          appearance={isValidPrice(value) ? "neutral" : "danger"}
          onChange={(e) => setValue(product.id, variant.id, e.target.value)}
        />
        {!isValidPrice(value) && (
          <Text fontSize="caption" color="danger-textLow">
            {t("home.invalidPriceShort", { example: `10${i18n.decimalSeparator}50` })}
          </Text>
        )}
        {discount !== null && discount > 0 && (
          <Text fontSize="caption" color="success-textLow" fontWeight="bold">
            {t("home.discount", { percent: discount })}
          </Text>
        )}
        {discount !== null && discount <= 0 && (
          <Text fontSize="caption" color="warning-textLow">
            {t("home.discount.none")}
          </Text>
        )}
      </Box>
    );
  };

  const applyLink = (product: Product) =>
    product.variants.length > 1 ? (
      <Link as="button" appearance="primary" onClick={() => applyToAll(product)}>
        {t("home.applyToAll")}
      </Link>
    ) : null;

  const renderList = () => {
    if (failed) return <ErrorState onRetry={retry} primary={false} />;

    if (loading || !data) {
      return (
        <Box display="flex" flexDirection="column" gap="2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width="100%" height="3rem" />
          ))}
        </Box>
      );
    }

    if (data.products.length === 0) {
      if (filter !== "all") {
        return (
          <EmptyMessage
            icon={<SearchIcon size={32} />}
            title={filter === "with" ? t("home.empty.with.title") : t("home.empty.without.title")}
            text={filter === "with" ? t("home.empty.with.text") : t("home.empty.without.text")}
            actions={
              <Button appearance="neutral" onClick={() => changeFilter("all")}>
                {t("home.empty.filter.action")}
              </Button>
            }
          />
        );
      }
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
              {data.products.flatMap((product) =>
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

        {/* celular: Data List (a homologação não aceita tabela no mobile) */}
        <Box display={{ xs: "block", md: "none" }}>
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
        </Box>

        {pageCount > 1 && (
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
        buttonStack={
          <Button appearance="neutral" onClick={() => navigateSafely("/config")}>
            <CogIcon />
            {t("home.configure")}
          </Button>
        }
      />
      <Page.Body>
        <Box display="flex" flexDirection="column" gap="4">
          {/* o resumo já mostra o teste grátis: o aviso só aparece quando exige ação */}
          <BillingBanner onNavigate={navigateSafely} hideTrial />
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
          {summary()}
          <Card>
            <Card.Body>
              <Box display="flex" flexDirection="column" gap="4">
                <Box display="flex" gap="3" flexWrap="wrap" alignItems="center">
                  <Box flex="1" minWidth="16rem">
                    <Input
                      type="search"
                      aria-label={t("home.search.label")}
                      placeholder={t("home.search.placeholder")}
                      append={<SearchIcon />}
                      appendPosition="start"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </Box>
                  <Box maxWidth="100%" overflowX="auto">
                    <SegmentedControl
                      selectedSegments={[filter]}
                      onSegmentsSelect={(ids) => {
                        const next = ids.find((id) => id !== filter);
                        if (next) changeFilter(next as Filter);
                      }}
                    >
                      {FILTERS.map((f) => (
                        <SegmentedControl.Button key={f} id={f} label={t(`home.filter.${f}`)}>
                          {t(`home.filter.${f}`)}
                        </SegmentedControl.Button>
                      ))}
                    </SegmentedControl>
                  </Box>
                </Box>
                {hasInvalid && (
                  <Text color="danger-textLow">
                    {t("home.invalidPrice", { example: `10${i18n.decimalSeparator}50` })}
                  </Text>
                )}
                {renderList()}
              </Box>
            </Card.Body>
          </Card>
          {pending > 0 && (
            <Box position="sticky" bottom="1rem" zIndex="100">
              <Box
                backgroundColor="neutral-textHigh"
                borderRadius="2"
                padding="3"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                gap="2"
                flexWrap="wrap"
                boxShadow="2"
              >
                <Text color="neutral-background" fontWeight="bold">
                  {tp("home.savebar.count", pending)}
                </Text>
                <Box display="flex" gap="2">
                  <Button appearance="neutral" disabled={saving} onClick={() => setConfirmDiscard(true)}>
                    {t("home.savebar.discard")}
                  </Button>
                  <Button appearance="primary" disabled={hasInvalid || saving} onClick={save}>
                    {saving ? <Spinner size="small" /> : <DisketteIcon />}
                    {t("home.save")}
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Page.Body>

      <Modal open={confirmDiscard && pending > 0} onDismiss={() => setConfirmDiscard(false)}>
        <Modal.Header title={t("home.discard.title")} />
        <Modal.Body>
          <Text>{tp("home.leave.message", pending)}</Text>
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="neutral" onClick={() => setConfirmDiscard(false)}>
            {t("home.leave.keepEditing")}
          </Button>
          <Button
            appearance="danger"
            onClick={() => {
              setEdits({});
              setConfirmDiscard(false);
            }}
          >
            {t("home.discard.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal open={leaveTo !== null} onDismiss={() => setLeaveTo(null)}>
        <Modal.Header title={t("home.leave.title")} />
        <Modal.Body>
          <Text>{tp("home.leave.message", pending)}</Text>
        </Modal.Body>
        <Modal.Footer>
          <Button appearance="neutral" onClick={() => setLeaveTo(null)}>
            {t("home.leave.keepEditing")}
          </Button>
          <Button appearance="danger" onClick={() => leaveTo && navigate(leaveTo)}>
            {t("home.leave.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>
    </Page>
  );
}
