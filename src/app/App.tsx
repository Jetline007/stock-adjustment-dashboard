// src/app/App.tsx
import { useState, useMemo, useEffect } from "react";
import { VarianceUpload } from "./components/VarianceUpload";
import { KPICard } from "./components/KPICard";
import { DashboardChart } from "./components/DashboardChart";
import { DataTable } from "./components/DataTable";
import {
  Package,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Upload,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import Papa from "papaparse";

interface StockItem {
  "Product Code": string;
  "Product Name": string;
  Location: string;
  Category: string;
  "Write On Qty": number;
  "Write Off Qty": number;
  "Net Difference Qty": number;
  "Rand Cost In": number;
  "Rand Cost Out": number;
  "Net Difference Rand": number;
  "Total Qty": number;
  "Total Cost": number;
  Type: string;
  Reference: string;
  "Document Reference": string;
}

function cleanNumber(val: unknown) {
  if (val === null || val === undefined) return 0;
  const n = Number(String(val).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function formatRand(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function pickFirst(row: any, keys: string[]) {
  for (const k of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, k)) return row[k];
  }
  return undefined;
}

function pickString(row: any, keys: string[]) {
  const v = pickFirst(row, keys);
  return String(v ?? "").trim();
}

function pickNumber(row: any, keys: string[]) {
  const v = pickFirst(row, keys);
  return cleanNumber(v);
}

function isRealStockRow(row: any) {
  const referenceType = String(row?.["Reference type"] ?? "")
    .trim()
    .toLowerCase();
  const sku = String(row?.["SKU"] ?? "").trim();
  const product = String(row?.["Product"] ?? "").trim();
  const category = String(row?.["Category"] ?? "")
    .trim()
    .toLowerCase();

  if (referenceType !== "stocktake") return false;
  if (!sku) return false;
  if (!product) return false;
  if (product.toLowerCase().includes(" total")) return false;
  if (category.includes(" total")) return false;

  return true;
}

function normalizeRow(row: any): StockItem {
  const productCode = pickString(row, ["SKU", "Product Code", "Code"]);
  const productName = pickString(row, ["Product", "Product Name", "Name"]);
  const location = pickString(row, ["Location", "Bin", "Warehouse"]);
  const category = pickString(row, ["Category"]);

  const writeOnQty = pickNumber(row, ["Quantity in", "Quantity In"]);
  const writeOffQty = pickNumber(row, ["Quantity out", "Quantity Out"]);

  const randCostIn = pickNumber(row, ["Cost in", "Cost In"]);
  const randCostOut = pickNumber(row, ["Cost out", "Cost Out"]);
  const totalQty = pickNumber(row, ["Total qty", "Total qty "]);
  const totalCost = pickNumber(row, ["Total cost", "Total cost "]);

  return {
    "Product Code": productCode,
    "Product Name": productName,
    Location: location,
    Category: category,
    "Write On Qty": writeOnQty,
    "Write Off Qty": writeOffQty,
    "Net Difference Qty": writeOnQty - writeOffQty,
    "Rand Cost In": randCostIn,
    "Rand Cost Out": randCostOut,
    "Net Difference Rand": randCostIn - randCostOut,
    "Total Qty": totalQty,
    "Total Cost": totalCost,
    Type: pickString(row, ["Type"]),
    Reference: pickString(row, ["Reference"]),
    "Document Reference": pickString(row, [
      "Document reference",
      "Document Reference",
    ]),
  };
}

export default function App() {
  const [data, setData] = useState<StockItem[]>([]);
  const [showUpload, setShowUpload] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [auditDate, setAuditDate] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadCSVFile();
  }, []);

  const loadCSVFile = async () => {
    try {
      const response = await fetch(
        "/imports/year_end_stock_take_results_2026.csv",
      );

      if (!response.ok) {
        throw new Error(
          `CSV not found: ${response.status} ${response.statusText}`,
        );
      }

      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const normalized = (results.data || [])
            .filter((r: any) => isRealStockRow(r))
            .map((r: any) => normalizeRow(r))
            .filter(
              (r: StockItem) =>
                (r["Product Code"] || "").length > 0 &&
                (r["Product Name"] || "").length > 0,
            );

          setData(normalized);
          setIsLoading(false);
          setShowUpload(false);
          setAuditDate(new Date().toLocaleDateString());
        },
        error: (error: any) => {
          console.error("Error parsing CSV:", error);
          setIsLoading(false);
        },
      });
    } catch (error) {
      console.error("Error loading CSV:", error);
      setData([]);
      setIsLoading(false);
    }
  };

  const handleDataLoaded = (stocktakeData: any[]) => {
    const processed = (stocktakeData || [])
      .filter((r: any) => isRealStockRow(r))
      .map((r: any) => normalizeRow(r))
      .filter(
        (r: StockItem) =>
          (r["Product Code"] || "").length > 0 &&
          (r["Product Name"] || "").length > 0,
      );

    setData(processed);
    setShowUpload(false);
    setAuditDate(new Date().toLocaleDateString());
  };

  const kpis = useMemo(() => {
    const totalWriteOnUnits = data.reduce(
      (sum, row) => sum + (Number(row["Write On Qty"]) || 0),
      0,
    );

    const totalWriteOffUnits = data.reduce(
      (sum, row) => sum + (Number(row["Write Off Qty"]) || 0),
      0,
    );

    const netDifferenceQty = totalWriteOnUnits - totalWriteOffUnits;

    const totalRandCostIn = data.reduce(
      (sum, row) => sum + (Number(row["Rand Cost In"]) || 0),
      0,
    );

    const totalRandCostOut = data.reduce(
      (sum, row) => sum + (Number(row["Rand Cost Out"]) || 0),
      0,
    );

    const totalNetRandValue = totalRandCostIn - totalRandCostOut;

    const locationsAffected = new Set(
      data.map((row) => row.Location).filter(Boolean),
    ).size;

    const skusAffected = new Set(
      data.map((row) => row["Product Code"]).filter(Boolean),
    ).size;

    return {
      totalWriteOnUnits,
      totalWriteOffUnits,
      netDifferenceQty,
      totalRandCostIn,
      totalRandCostOut,
      totalNetRandValue,
      locationsAffected,
      skusAffected,
    };
  }, [data]);

  const adjustmentStatusData = useMemo(() => {
    const writeOnOnly = data.filter(
      (row) => row["Write On Qty"] > 0 && row["Write Off Qty"] === 0,
    ).length;
    const writeOffOnly = data.filter(
      (row) => row["Write Off Qty"] > 0 && row["Write On Qty"] === 0,
    ).length;
    const mixed = data.filter(
      (row) => row["Write Off Qty"] > 0 && row["Write On Qty"] > 0,
    ).length;

    return [
      { id: "writeon", name: "Write On Only", value: writeOnOnly },
      { id: "writeoff", name: "Write Off Only", value: writeOffOnly },
      { id: "mixed", name: "Mixed Adjustments", value: mixed },
    ];
  }, [data]);

  const locationByRandImpactData = useMemo(() => {
    const locationMap: { [key: string]: number } = {};

    data.forEach((row) => {
      const location = row.Location || "Unknown";
      const value = Math.abs(row["Net Difference Rand"] || 0);
      locationMap[location] = (locationMap[location] || 0) + value;
    });

    return Object.entries(locationMap)
      .map(([name, value], idx) => ({
        id: `loc-rand-${idx}`,
        name,
        value,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data]);

  const categoryByRandImpactData = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};

    data.forEach((row) => {
      const category = row.Category || "Other";
      const value = Math.abs(row["Net Difference Rand"] || 0);
      categoryMap[category] = (categoryMap[category] || 0) + value;
    });

    return Object.entries(categoryMap)
      .map(([name, value], idx) => ({
        id: `cat-rand-${idx}`,
        name,
        value,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data]);

  const writeOnVsWriteOffValueData = useMemo(() => {
    return [
      {
        id: "write-on-value",
        name: "Write On Value",
        value: Math.abs(kpis.totalRandCostIn),
      },
      {
        id: "write-off-value",
        name: "Write Off Value",
        value: Math.abs(kpis.totalRandCostOut),
      },
    ];
  }, [kpis]);

  const writeOnVsWriteOffUnitsData = useMemo(() => {
    return [
      {
        id: "write-on-total",
        name: "Write On Units",
        value: kpis.totalWriteOnUnits,
      },
      {
        id: "write-off-total",
        name: "Write Off Units",
        value: kpis.totalWriteOffUnits,
      },
    ];
  }, [kpis]);

  const topWriteOffData = useMemo(() => {
    return data
      .filter((row) => row["Write Off Qty"] > 0)
      .sort((a, b) => b["Write Off Qty"] - a["Write Off Qty"])
      .slice(0, 15)
      .map((row, idx) => ({
        id: `woff-${idx}`,
        name: (row["Product Name"] || "Unknown").substring(0, 25),
        value: row["Write Off Qty"],
      }));
  }, [data]);

  const topWriteOnData = useMemo(() => {
    return data
      .filter((row) => row["Write On Qty"] > 0)
      .sort((a, b) => b["Write On Qty"] - a["Write On Qty"])
      .slice(0, 15)
      .map((row, idx) => ({
        id: `won-${idx}`,
        name: (row["Product Name"] || "Unknown").substring(0, 25),
        value: row["Write On Qty"],
      }));
  }, [data]);

  const affectedItemsData = useMemo(() => {
    return data
      .filter((row) => row["Net Difference Qty"] !== 0)
      .sort(
        (a, b) =>
          Math.abs(b["Net Difference Rand"] || 0) -
          Math.abs(a["Net Difference Rand"] || 0),
      )
      .map((row) => ({
        "Product Code": row["Product Code"] || "",
        "Product Name": row["Product Name"] || "",
        Location: row.Location || "",
        Category: row.Category || "",
        "Write On Units": row["Write On Qty"] || 0,
        "Write Off Units": row["Write Off Qty"] || 0,
        "Net Adjustment Units": row["Net Difference Qty"] || 0,
        "Write On Value (R)": formatRand(row["Rand Cost In"] || 0),
        "Write Off Value (R)": formatRand(row["Rand Cost Out"] || 0),
        "Net Adjustment Value (R)": formatRand(row["Net Difference Rand"] || 0),
      }));
  }, [data]);

  const writeOnDetailData = useMemo(() => {
    return data
      .filter((row) => row["Write On Qty"] > 0)
      .sort((a, b) => b["Write On Qty"] - a["Write On Qty"])
      .map((row) => ({
        "Product Code": row["Product Code"] || "",
        "Product Name": row["Product Name"] || "",
        Location: row.Location || "",
        Category: row.Category || "",
        "Write On Units": row["Write On Qty"] || 0,
        "Write On Value (R)": formatRand(row["Rand Cost In"] || 0),
        Reference: row.Reference || "",
        "Document Reference": row["Document Reference"] || "",
      }));
  }, [data]);

  const writeOffDetailData = useMemo(() => {
    return data
      .filter((row) => row["Write Off Qty"] > 0)
      .sort((a, b) => b["Write Off Qty"] - a["Write Off Qty"])
      .map((row) => ({
        "Product Code": row["Product Code"] || "",
        "Product Name": row["Product Name"] || "",
        Location: row.Location || "",
        Category: row.Category || "",
        "Write Off Units": row["Write Off Qty"] || 0,
        "Write Off Value (R)": formatRand(row["Rand Cost Out"] || 0),
        Reference: row.Reference || "",
        "Document Reference": row["Document Reference"] || "",
      }));
  }, [data]);

  const skuAffectedListData = useMemo(() => {
    const grouped = new Map<
      string,
      {
        "Product Code": string;
        "Product Name": string;
        Category: string;
        "Write On Qty": number;
        "Write Off Qty": number;
        "Net Difference Qty": number;
        "Rand Cost In": number;
        "Rand Cost Out": number;
        "Net Difference Rand": number;
      }
    >();

    data.forEach((row) => {
      const code = row["Product Code"] || "";
      if (!code) return;

      const existing = grouped.get(code);

      if (existing) {
        existing["Write On Qty"] += row["Write On Qty"] || 0;
        existing["Write Off Qty"] += row["Write Off Qty"] || 0;
        existing["Net Difference Qty"] += row["Net Difference Qty"] || 0;
        existing["Rand Cost In"] += row["Rand Cost In"] || 0;
        existing["Rand Cost Out"] += row["Rand Cost Out"] || 0;
        existing["Net Difference Rand"] += row["Net Difference Rand"] || 0;
      } else {
        grouped.set(code, {
          "Product Code": code,
          "Product Name": row["Product Name"] || "",
          Category: row.Category || "",
          "Write On Qty": row["Write On Qty"] || 0,
          "Write Off Qty": row["Write Off Qty"] || 0,
          "Net Difference Qty": row["Net Difference Qty"] || 0,
          "Rand Cost In": row["Rand Cost In"] || 0,
          "Rand Cost Out": row["Rand Cost Out"] || 0,
          "Net Difference Rand": row["Net Difference Rand"] || 0,
        });
      }
    });

    return Array.from(grouped.values())
      .sort(
        (a, b) =>
          Math.abs(b["Net Difference Rand"]) -
          Math.abs(a["Net Difference Rand"]),
      )
      .map((row) => ({
        "Product Code": row["Product Code"],
        "Product Name": row["Product Name"],
        Category: row.Category,
        "Write On Units": row["Write On Qty"],
        "Write Off Units": row["Write Off Qty"],
        "Net Adjustment Units": row["Net Difference Qty"],
        "Write On Value (R)": formatRand(row["Rand Cost In"]),
        "Write Off Value (R)": formatRand(row["Rand Cost Out"]),
        "Net Adjustment Value (R)": formatRand(row["Net Difference Rand"]),
      }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 animate-pulse mx-auto mb-4 text-blue-600" />
          <p className="text-lg">Loading executive adjustment dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Executive Stock Adjustment Dashboard
              </h1>
              <p className="mt-1 opacity-90">
                Financial impact of year-end stocktake adjustments — {auditDate}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowUpload(!showUpload)}
                variant="secondary"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload New Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {showUpload && (
          <div className="mb-8">
            <VarianceUpload onDataLoaded={handleDataLoaded as any} />
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-7 lg:w-[1300px]">
            <TabsTrigger value="overview">Executive Overview</TabsTrigger>
            <TabsTrigger value="analysis">Financial Analysis</TabsTrigger>
            <TabsTrigger value="affected-items">Affected Items</TabsTrigger>
            <TabsTrigger value="write-on-details">Write On Detail</TabsTrigger>
            <TabsTrigger value="write-off-details">
              Write Off Detail
            </TabsTrigger>
            <TabsTrigger value="sku-list">SKU Impact List</TabsTrigger>
            <TabsTrigger value="full-data">Full Data</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div
                className="cursor-pointer"
                onClick={() => setActiveTab("sku-list")}
                title="Open affected SKU list"
              >
                <KPICard
                  title="SKUs Affected"
                  value={kpis.skusAffected.toLocaleString()}
                  icon={Package}
                />
              </div>

              <div
                className="cursor-pointer"
                onClick={() => setActiveTab("write-on-details")}
                title="Open write on detail"
              >
                <KPICard
                  title="Write On Units"
                  value={kpis.totalWriteOnUnits.toLocaleString()}
                  icon={TrendingUp}
                />
              </div>

              <div
                className="cursor-pointer"
                onClick={() => setActiveTab("write-off-details")}
                title="Open write off detail"
              >
                <KPICard
                  title="Write Off Units"
                  value={kpis.totalWriteOffUnits.toLocaleString()}
                  icon={AlertCircle}
                />
              </div>

              <div
                className="cursor-pointer"
                onClick={() => setActiveTab("affected-items")}
                title="Open affected items"
              >
                <KPICard
                  title="Net Adjustment Units"
                  value={kpis.netDifferenceQty.toLocaleString()}
                  icon={CheckCircle}
                />
              </div>

              <div
                className="cursor-pointer"
                onClick={() => setActiveTab("affected-items")}
                title="Open affected items by location"
              >
                <KPICard
                  title="Locations Affected"
                  value={kpis.locationsAffected.toLocaleString()}
                  icon={ClipboardCheck}
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <h3 className="text-lg font-semibold mb-4">
                Executive Financial Summary
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Write On Value (R)</span>
                  </div>
                  <p className="text-3xl font-bold text-green-700">
                    {formatRand(kpis.totalRandCostIn)}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    Total value added back into stock
                  </p>
                </div>

                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium">Write Off Value (R)</span>
                  </div>
                  <p className="text-3xl font-bold text-red-700">
                    {formatRand(kpis.totalRandCostOut)}
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    Total value removed from stock
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">
                      Net Adjustment Value (R)
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-blue-700">
                    {formatRand(kpis.totalNetRandValue)}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    Financial effect after all adjustments
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <DashboardChart
                title="Write On vs Write Off Value"
                data={writeOnVsWriteOffValueData}
                type="bar"
                dataKey="value"
                xAxisKey="name"
              />
              <DashboardChart
                title="Adjustment Type Distribution"
                data={adjustmentStatusData}
                type="pie"
                dataKey="value"
                xAxisKey="name"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <DashboardChart
                title="Top 10 Locations by Net Adjustment Value"
                data={locationByRandImpactData}
                type="bar"
                dataKey="value"
                xAxisKey="name"
              />
              <DashboardChart
                title="Top 10 Categories by Net Adjustment Value"
                data={categoryByRandImpactData}
                type="bar"
                dataKey="value"
                xAxisKey="name"
              />
            </div>

            <DashboardChart
              title="Write On vs Write Off Units"
              data={writeOnVsWriteOffUnitsData}
              type="bar"
              dataKey="value"
              xAxisKey="name"
            />
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <DashboardChart
                title="Top 15 Write Off SKUs"
                data={topWriteOffData}
                type="bar"
                dataKey="value"
                xAxisKey="name"
              />
              <DashboardChart
                title="Top 15 Write On SKUs"
                data={topWriteOnData}
                type="bar"
                dataKey="value"
                xAxisKey="name"
              />
            </div>

            <DashboardChart
              title="Location Net Adjustment Value"
              data={locationByRandImpactData}
              type="area"
              dataKey="value"
              xAxisKey="name"
            />
          </TabsContent>

          <TabsContent value="affected-items">
            <DataTable
              title={`Affected Items (${affectedItemsData.length} rows)`}
              data={affectedItemsData}
              maxRows={20}
            />
          </TabsContent>

          <TabsContent value="write-on-details">
            <DataTable
              title={`Write On Detail (${writeOnDetailData.length} rows)`}
              data={writeOnDetailData}
              maxRows={20}
            />
          </TabsContent>

          <TabsContent value="write-off-details">
            <DataTable
              title={`Write Off Detail (${writeOffDetailData.length} rows)`}
              data={writeOffDetailData}
              maxRows={20}
            />
          </TabsContent>

          <TabsContent value="sku-list">
            <DataTable
              title={`SKU Impact List (${kpis.skusAffected} unique SKUs)`}
              data={skuAffectedListData}
              maxRows={20}
            />
          </TabsContent>

          <TabsContent value="full-data">
            <DataTable
              title="Full Adjustment Data"
              data={data.map((row) => ({
                "Product Code": row["Product Code"] || "",
                "Product Name": row["Product Name"] || "",
                Location: row.Location || "",
                Category: row.Category || "",
                "Write On Units": row["Write On Qty"] || "",
                "Write Off Units": row["Write Off Qty"] || "",
                "Net Adjustment Units": row["Net Difference Qty"] || 0,
                "Write On Value (R)": formatRand(row["Rand Cost In"] || 0),
                "Write Off Value (R)": formatRand(row["Rand Cost Out"] || 0),
                "Net Adjustment Value (R)": formatRand(
                  row["Net Difference Rand"] || 0,
                ),
                Type: row.Type || "",
                Reference: row.Reference || "",
                "Document Reference": row["Document Reference"] || "",
              }))}
              maxRows={25}
              highlightEmpty={true}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
