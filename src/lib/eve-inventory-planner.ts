export type EveItem = { id: number | string; name: string };

export type InventoryLine = {
  raw: string;
  itemName: string;
  quantity: number;
  item?: EveItem;
};

export type InventoryParseResult = {
  lines: InventoryLine[];
  recognized: InventoryLine[];
  unknown: InventoryLine[];
  inventoryByItemId: Map<EveItem["id"], number>;
};

const normalizeItemName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const parseQuantity = (value: string) => {
  const cleaned = value.trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
};

export const parseInventoryLine = (line: string) => {
  const raw = line.trim();
  if (!raw) return null;

  const tabParts = raw.split(/\t+/).map((part) => part.trim()).filter(Boolean);
  if (tabParts.length >= 2) {
    const quantity = parseQuantity(tabParts[tabParts.length - 1]);
    if (quantity !== null) return { itemName: tabParts.slice(0, -1).join(" "), quantity };
  }

  const trailingQuantity = raw.match(/^(.+?)\s{2,}(\d[\d,]*(?:\.\d+)?)$/);
  if (trailingQuantity) {
    const quantity = parseQuantity(trailingQuantity[2]);
    if (quantity !== null) return { itemName: trailingQuantity[1].trim(), quantity };
  }

  const leadingQuantity = raw.match(/^(\d[\d,]*(?:\.\d+)?)\s+(.+)$/);
  if (leadingQuantity) {
    const quantity = parseQuantity(leadingQuantity[1]);
    if (quantity !== null) return { itemName: leadingQuantity[2].trim(), quantity };
  }

  return null;
};

export const parseInventory = (pastedInventory: string, items: EveItem[]): InventoryParseResult => {
  const itemByName = new Map(items.map((item) => [normalizeItemName(item.name), item]));
  const lines = pastedInventory
    .split(/\r?\n/)
    .map((line) => {
      const parsed = parseInventoryLine(line);
      if (!parsed) return null;
      return { raw: line, ...parsed, item: itemByName.get(normalizeItemName(parsed.itemName)) } satisfies InventoryLine;
    })
    .filter((line): line is InventoryLine => Boolean(line));

  const inventoryByItemId = new Map<EveItem["id"], number>();
  for (const line of lines) {
    if (!line.item) continue;
    inventoryByItemId.set(line.item.id, (inventoryByItemId.get(line.item.id) ?? 0) + line.quantity);
  }

  return {
    lines,
    recognized: lines.filter((line) => Boolean(line.item)),
    unknown: lines.filter((line) => !line.item),
    inventoryByItemId,
  };
};

export type RequiredMaterial = {
  item: EveItem;
  requiredQuantity: number;
  buyPrice: number;
};

export type InventoryPlanInput = {
  productName: string;
  grossProfit: number;
  requiredMaterials: RequiredMaterial[];
};

export type InventoryPlanResult = InventoryPlanInput & {
  canProduceFully: boolean;
  missingItemsCount: number;
  missingBuyCost: number;
  projectedNetProfit: number;
  materials: Array<RequiredMaterial & { availableQuantity: number; missingQuantity: number; buyCost: number }>;
  recommendation: string;
};

export const planInventoryOpportunities = (
  plans: InventoryPlanInput[],
  inventoryByItemId: Map<EveItem["id"], number>,
): InventoryPlanResult[] =>
  plans
    .map((plan) => {
      const materials = plan.requiredMaterials.map((material) => {
        const availableQuantity = inventoryByItemId.get(material.item.id) ?? 0;
        const missingQuantity = Math.max(0, material.requiredQuantity - availableQuantity);
        return { ...material, availableQuantity, missingQuantity, buyCost: missingQuantity * material.buyPrice };
      });
      const missingBuyCost = materials.reduce((total, material) => total + material.buyCost, 0);
      const missingItemsCount = materials.filter((material) => material.missingQuantity > 0).length;
      const projectedNetProfit = plan.grossProfit - missingBuyCost;
      return {
        ...plan,
        materials,
        canProduceFully: missingItemsCount === 0,
        missingItemsCount,
        missingBuyCost,
        projectedNetProfit,
        recommendation: projectedNetProfit > 0 ? "Build after buying missing materials" : "Skip unless prices improve",
      };
    })
    .sort((a, b) => b.projectedNetProfit - a.projectedNetProfit);
