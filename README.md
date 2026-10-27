# DemandSync

> **Smart AI based demand forecasting and inventory replenishment for retail stores.**

Every retail business from small shops to multi-store chains faces the exact same expensive balancing act every single day:

1. **Ordering Too Little (Stockouts)**: If customer demand surges and your shelves are empty, customers walk away, buy from a competitor, and you lose revenue you can never recover.
2. **Ordering Too Much (Overstocking)**: Excess inventory ties up valuable cash flow in storage. You pay higher warehousing fees, risk product expiration or damage, and eventually have to sell items at steep discount markdowns that destroy your profits.

Most legacy inventory systems try to guess demand with a **single flat number**: *"You will sell 50 units next Tuesday."*  
Real retail does not work like that. Sales fluctuate with weekend traffic, seasonal weather shifts, supplier delivery delays, and promotional discounts.

**DemandSync replaces guesswork with smart range-based forecasting, automatic stock calculations, and a private on-device AI assistant.**

---

# How DemandSync Works

Instead of guessing a single number, DemandSync gives store managers three realistic scenarios:

| Forecast Type | What It Means | How It Helps You |
| :--- | :--- | :--- |
| **Minimum Expected Sales** | The low baseline estimate | Protects cash flow so you don't over-order slow-moving inventory. |
| **Most Likely Sales** | The expected baseline volume | Guides routine, cost-effective weekly inventory replenishment. |
| **Peak Surge Potential** | High customer surge capacity | Prepares your store for holiday rushes, weekend spikes, or bad weather runs. |

When inventory runs low, DemandSync **automatically calculates exactly how many units you need to reorder** and generates a ready-to-use purchase order with a single click.

---

## Key Features

### 1. Smart Reorder Alerts & Safety Buffers
- **Reorder Thresholds**: Automatically calculates the exact inventory number where a new supplier order must be placed.
- **Safety Reserve Buffers**: Calibrates an extra stock cushion based on supplier delivery variability to protect your store from running out during shipping delays.
- **Out of Stock Risk Scores**: Alert managers immediately when a product breaches safety buffers.

### 2. "What-If" Scenario Simulator
Test real-world business scenarios before spending your budget:
- *What happens to customer demand if we run a 20% discount promotion?*
- *How will sales shift if a sudden winter storm or heatwave hits this region?*
- *What is our stockout exposure if our overseas supplier is delayed by 7 days?*

### 3. 1-Click Purchase Orders
Directly converts inventory deficit alerts into enterprise purchase orders:
- Includes authorized vendors, unit costs, payment terms (Net 30), and delivery expectations.

### 4. On-Device DemandSync Assistant
Includes a floating AI assistant available in the bottom-right corner of any page:
- **Fully Local Model**: Runs on your computer's local CPU using high-speed 4-bit quantization.
- **Executive Summaries**: Summarizes store inventory risks, identifies top items requiring replenishment, and gives straightforward action plans.
- **Resilient Fallback**: Seamlessly falls back to local business rules so you always get reliable inventory guidance.

---

## Live Data & Store Network

Currently DemandSync includes a benchmark multi-store dataset with **73,100 clean daily sales records** across 5 regional stores and 20 product categories:

- **Store S001**: Chicago Downtown (High Foot Traffic Urban Hub)
- **Store S002**: Dallas Metro (Suburban High-Volume Center)
- **Store S003**: New York Manhattan (Dense Foot Traffic Flagship)
- **Store S004**: Denver Foothills (Cold-Weather Regional Hub)
- **Store S005**: Miami Coastal (Warm-Weather Coastal Market)

All records, inventory counts, and price histories are stored locally in an embedded **DuckDB** columnar database, giving you sub-10ms query responses without running database servers.

---

## System Architecture

For complete engineering details, see:
 **[Architecture & Engineering Blueprint](architecture.md)**

---