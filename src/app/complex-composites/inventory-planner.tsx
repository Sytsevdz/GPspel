"use client";

import { useMemo, useState } from "react";
import {
  type EveItem,
  type InventoryPlanInput,
  parseInventory,
  planInventoryOpportunities,
} from "@/lib/eve-inventory-planner";

type Props = {
  eveItems: EveItem[];
  reactionPlans: InventoryPlanInput[];
};

const formatIsk = (value: number) => `${Math.round(value).toLocaleString("en-US")} ISK`;

export function InventoryPlanner({ eveItems, reactionPlans }: Props) {
  const [inventoryText, setInventoryText] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const parsedInventory = useMemo(() => parseInventory(inventoryText, eveItems), [eveItems, inventoryText]);
  const opportunities = useMemo(
    () => planInventoryOpportunities(reactionPlans, parsedInventory.inventoryByItemId),
    [parsedInventory.inventoryByItemId, reactionPlans],
  );

  return (
    <details className="card" open>
      <summary>
        <strong>Inventory Planner</strong>
      </summary>
      <div className="form-grid" style={{ marginTop: "1rem" }}>
        <label>
          Paste inventory copied from EVE
          <textarea
            value={inventoryText}
            onChange={(event) => setInventoryText(event.target.value)}
            placeholder={"Fullerides\t12000\nPhenolic Composites    2500\n5000 Sylramic Fibers"}
            rows={8}
          />
        </label>
      </div>

      <div className="dashboard-grid" style={{ marginTop: "1rem" }}>
        <div className="stat-card"><span>Recognized items</span><strong>{parsedInventory.recognized.length}</strong></div>
        <div className="stat-card"><span>Unknown items</span><strong>{parsedInventory.unknown.length}</strong></div>
        <div className="stat-card"><span>Total quantity lines</span><strong>{parsedInventory.lines.length}</strong></div>
      </div>

      {parsedInventory.unknown.length > 0 ? (
        <p className="form-error">Unknown items: {parsedInventory.unknown.map((line) => line.itemName).join(", ")}</p>
      ) : null}

      <h3>Inventory opportunities</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Can build</th>
              <th>Missing items count</th>
              <th>Missing buy cost</th>
              <th>Projected net profit</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((opportunity) => (
              <tr key={opportunity.productName}>
                <td>
                  <button type="button" onClick={() => setExpandedProduct(expandedProduct === opportunity.productName ? null : opportunity.productName)}>
                    {opportunity.productName}
                  </button>
                  {expandedProduct === opportunity.productName ? (
                    <div className="table-wrapper" style={{ marginTop: "0.75rem" }}>
                      <table>
                        <thead><tr><th>Item</th><th>Have</th><th>Need</th><th>Missing</th><th>Buy price</th><th>Buy cost</th></tr></thead>
                        <tbody>
                          {opportunity.materials.map((material) => (
                            <tr key={String(material.item.id)}>
                              <td>{material.item.name}</td>
                              <td>{material.availableQuantity.toLocaleString("en-US")}</td>
                              <td>{material.requiredQuantity.toLocaleString("en-US")}</td>
                              <td>{material.missingQuantity.toLocaleString("en-US")}</td>
                              <td>{formatIsk(material.buyPrice)}</td>
                              <td>{formatIsk(material.buyCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </td>
                <td>{opportunity.canProduceFully ? "Yes" : "No"}</td>
                <td>{opportunity.missingItemsCount}</td>
                <td>{formatIsk(opportunity.missingBuyCost)}</td>
                <td>{formatIsk(opportunity.projectedNetProfit)}</td>
                <td>{opportunity.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
