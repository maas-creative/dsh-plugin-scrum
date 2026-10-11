// Independently authored transformations of public provider catalog facts.
// Gateway billing must never be inferred from another provider's prices.
export function gatewayCatalogFacts(payload) {
  if (!payload || !Array.isArray(payload.data)) throw new Error('Invalid gateway catalog');
  const seen = new Set();
  return payload.data.map(row => {
    if (!row || typeof row.id !== 'string' || !row.id || seen.has(row.id)) throw new Error('Invalid or duplicate gateway model ID');
    seen.add(row.id);
    if (row.context_window != null && (!Number.isSafeInteger(row.context_window) || row.context_window <= 0)) throw new Error('Invalid gateway context window');
    return {id: row.id, status: row.status, contextWindow: row.context_window ?? null,
      input: [...(row.modalities?.input || [])], output: [...(row.modalities?.output || [])],
      endpoints: [...(row.endpoints || [])]};
  });
}

export function correlatePublicModelCapabilities(gateway, capabilities) {
  if (!Array.isArray(capabilities?.data)) throw new Error('Invalid capability catalog');
  const exact = new Map();
  for (const row of capabilities.data) {
    if (typeof row?.id !== 'string' || exact.has(row.id)) throw new Error('Invalid or duplicate capability model ID');
    exact.set(row.id, row);
  }
  return gateway.map(fact => {
    const row = exact.get(fact.id);
    const output = row?.top_provider?.max_completion_tokens;
    const parameters = row?.supported_parameters;
    return {...fact, gatewayPricing: null,
      capabilitySource: row ? 'https://openrouter.ai/api/v1/models' : null,
      maxOutputTokens: Number.isSafeInteger(output) && output > 0 ? output : null,
      reasoning: Array.isArray(parameters) ? parameters.includes('reasoning') : null};
  });
}

// Retain route-specific prices: the gateway can dispatch one model to multiple
// upstream providers, whose prices and discount windows need not agree.
export function correlateGatewayPrices(gateway, payload, observedAt) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid gateway prices');
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error('Invalid price observation time');
  const indexed = new Map();
  const amounts = row => Object.fromEntries([
    'inputCostPerToken','outputCostPerToken','cacheReadInputTokenCost','cacheCreationInputTokenCost',
  ].map(key => {
    const value = row?.[key];
    if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error('Invalid gateway price');
    return [key, value ?? null];
  }));
  for (const [route, row] of Object.entries(payload)) {
    if (!row || typeof row.modelOwner !== 'string' || typeof row.modelName !== 'string' || typeof row.provider !== 'string') throw new Error('Invalid gateway price identity');
    const id = row.modelOwner + '/' + row.modelName;
    const routes = indexed.get(id) || [];
    routes.push({route, provider: row.provider, region: row.region ?? null,
      list: amounts(row), effective: row.pricing?.current?.effectivePrice ? amounts(row.pricing.current.effectivePrice) : null,
      scheduledChanges: structuredClone(row.pricing?.next ?? null),
      conditionalAxes: structuredClone(row.axisPrices ?? {}),
      source: 'https://opengateway.ai/api/model-prices', observedAt});
    indexed.set(id, routes);
  }
  return gateway.map(row => ({...row, gatewayPricing: indexed.get(row.id) || []}));
}
