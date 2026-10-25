# DemandSync

> **Smart, private demand forecasting and inventory replenishment for retail stores.**

DemandSync is an intelligent retail inventory assistant. It helps store managers and supply chain teams decide **when to reorder stock, how much to order, and how to avoid running out of products** without tying up too much cash in excess inventory.

Everything runs **100% locally on the computer** your sales numbers, inventory levels, and prices stays in your machine.
---

## The Problem DemandSync Solves

Every retail business faces the same costly dilemma:

* **Order too little:** Shelves go empty, customers walk away frustrated, and you lose revenue you can never get back.
* **Order too much:** Cash sits trapped in unsold boxes, warehouse storage fees climb, and products risk expiring or being marked down at a loss.

Most inventory software only provides a single average guess: *"You will sell 100 units next week."* But real life is messy. What if a heatwave hits? What if competitor prices drop? What if your supplier takes an extra 4 days to deliver?

DemandSync replaces guesswork with **probabilistic forecasting, automated inventory math, and an on-device AI copilot**.

---

## Key Features

### 1. Forecasts with Real-World Confidence Ranges
Instead of giving you a single number, DemandSync predicts three realistic scenarios:
* **Conservative ($P_{10}$):** The lowest demand you can reasonably expect (protects your cash flow).
* **Expected ($P_{50}$):** The most likely sales volume.
* **Peak ($P_{90}$):** High-demand surge capacity (ensures you don't stock out during holiday spikes).

### 2. Automatic Reorder Alerts & Safety Stock Math
DemandSync continuously monitors your stock and calculates:
* **Reorder Point (ROP):** Exactly when you need to place a purchase order based on supplier lead times.
* **Safety Stock:** A mathematically calibrated buffer to protect against delivery delays or sudden demand surges.
* **Stockout Risk Scores:** Visual alerts highlighting which items need immediate attention.

### 3. "What-If" Scenario Simulator
Test business ideas before spending any money:
* What happens to sales if we offer a 15% discount?
* How will demand change if it rains all weekend?
* What is our stockout risk if the supplier takes 7 days instead of 3?

### 4. Transparent AI
No "black boxes." For every forecast, DemandSync tells you *why* demand is going up or down—whether it is driven by day-of-week trends, weather conditions, active discounts, or seasonality.

### 5. Private On-Device AI Copilot
DemandSync includes an embedded AI assistant powered by **Qwen2.5-1.5B** running directly on your CPU:
* Generates clear, plain-English executive briefings for store managers.
* Answers operational questions (e.g., *"Which items are at risk of stockout this week?"*).
* Zero cloud connection required; completely private and air-gapped.

---

## Live Dataset

DemandSync comes pre-loaded with a realistic retail benchmark dataset from Kaggle comprising **73,100 daily store records** across 5 stores (`S001`–`S005`) and 20 product SKUs (`P0001`–`P0020`):

| Column | Description |
| :--- | :--- |
| **Date** | Daily timeline from 2022 to 2024 |
| **Store ID** | Identifier for the store (`S001` to `S005`) |
| **Product ID** | SKU identifier (`P0001` to `P0020`) |
| **Category** | Product category (Groceries, Electronics, Toys, Clothing, etc.) |
| **Region** | Geographic region (North, South, East, West) |
| **Inventory Level** | On-hand physical stock count at store opening |
| **Units Sold** | Actual customer purchases on that day |
| **Units Ordered** | Replenishment shipments ordered from suppliers |
| **Demand Forecast** | Baseline reference forecast |
| **Price** | Regular retail unit price |
| **Discount** | Active promotional discount percentage |
| **Weather Condition** | Daily local weather (Sunny, Rainy, Snowy, Cloudy) |
| **Holiday / Promotion** | Indicator for holidays and marketing events |
| **Competitor Pricing** | Daily competitor price for identical products |
| **Seasonality** | Seasonal indicator (Autumn, Winter, Spring, Summer) |

All data is stored and indexed in a local **DuckDB** columnar database for sub-10ms query speeds.

---

## Product Tour: What You Will See

* **Executive Overview (`/`):** Summary cards showing total active inventory, projected daily revenue, stockout risk distribution, and macro sales trends.
* **Product Explorer (`/explorer`):** Filter by store and product. View historical sales, 30-day forecast confidence ribbons ($P_{10}$ to $P_{90}$), and key sales drivers.
* **What-If Simulator (`/simulator`):** Interactive sliders to change promotional discounts, test bad weather events, or simulate supplier shipping delays.
* **Inventory & Alerts (`/inventory`):** Color-coded risk heatmap showing products that have breached their Reorder Point and need attention today.
* **AI Copilot Drawer:** Click the Copilot button anywhere in the app to ask questions and generate instant query in plain-English.

---

## For technical details: 
[Architecture Blueprint](architecture.md): System diagrams, relational schema, LightGBM multi-quantile regression, safety stock math, and copilot mechanics.

---

