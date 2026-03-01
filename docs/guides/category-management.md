# Category Management Guide

How to customise, override, and manage transaction categories in FIRE.

## How Categorisation Works

FIRE uses a two-layer system:

1. **AI Categorisation** — GPT-4 analyses each transaction and assigns a category with a confidence score (0-100)
2. **Manual Override** — You can override any AI decision by typing a category name in the "Manual Category" column

The **Category** column (R) always shows the effective category: your manual choice if set, otherwise the AI's choice.

## Default Categories

FIRE ships with 12 categories (see [sheets-template.md](./sheets-template.md) for the full list). These cover common UK personal finance spending patterns. You can modify them freely.

## Adding a New Category

1. Go to the **Categories** sheet
2. Add a new row with:
   - **ID**: Leave blank — or generate a UUID. The system uses UUIDs for stable references, but you can also run `setupSheets` again to have the system clean things up
   - **Name**: Your category name (must be unique among active categories)
   - **Description**: What types of transactions belong here. Be specific — the AI reads this
   - **Examples**: Comma-separated merchant names or transaction descriptions. The more examples you give, the better the AI performs
   - **Is Active**: `TRUE`
   - **Created At**: Current date/time
   - **Modified At**: Current date/time

**Example**: Adding a "Pets" category:

| ID | Name | Description | Examples | Is Active | Created At | Modified At |
|---|---|---|---|---|---|---|
| *(UUID)* | Pets | Pet food, vet bills, pet insurance, and pet supplies | Pets at Home, Vets4Pets, Petplan, pet shop | TRUE | 2024-01-15 10:00:00 | 2024-01-15 10:00:00 |

> Write good descriptions and examples. The AI uses both the description and examples fields when deciding which category fits a transaction. Vague descriptions lead to poor categorisation.

## Editing a Category

Edit the row directly in the Categories sheet. Update the **Modified At** timestamp.

Changes take effect on the **next categorisation run**. Already-categorised transactions keep their existing category unless you re-categorise them.

### Renaming a Category

Just change the **Name** field. The UUID-based ID means the system tracks categories by ID, not name. Existing transactions referencing the old name via AI Category will show the old name, but the ID reference remains valid.

To update historical transaction names after a rename, run `recategorizeAll` from the Apps Script editor.

## Deactivating a Category

Set **Is Active** to `FALSE`. The category:
- Won't be offered to the AI for new transactions
- Remains visible on historically categorised transactions
- Can be reactivated later by setting Is Active back to `TRUE`

This is preferable to deleting rows, as it preserves referential integrity.

## Deleting a Category

You can delete a category row from the Categories sheet if no transactions reference it. If transactions do reference it, deactivate instead (see above).

## Manual Overrides

### Overriding a Single Transaction

1. Go to the **Result** sheet
2. Find the transaction you want to override
3. Type a category name in the **Manual Category** column (Q)
4. The system automatically:
   - Resolves the name to a category UUID (if it matches an active category)
   - Updates the **Manual Category ID** column (P)
   - The **Category** formula column (R) immediately reflects your override

### Clearing an Override

Delete the value in the **Manual Category** column. The Category column reverts to showing the AI's choice.

### Custom Category Names

You can type any name in Manual Category, even one that doesn't exist in the Categories sheet. The system will:
- Accept it and display it in the Category column
- Log a warning that the custom name has no referential integrity
- Not assign a Manual Category ID (the ID cell stays empty)

This is handy for one-off overrides, but for recurring categories, add them to the Categories sheet instead.

### Batch Overrides

You can paste multiple category names into the Manual Category column at once. The onEdit trigger processes each edited cell.

## How the AI Learns from Your Overrides

The Historical Pattern Learner uses your manual overrides to improve future categorisation:

1. **Manual overrides get 2x weight** — When the AI looks at historical patterns, manual overrides are prioritised over AI-assigned categories
2. **90-day lookback window** — The system considers the last 90 days of categorised transactions
3. **Similarity matching** — For each new transaction, the system finds similar historical ones using:
   - **Exact match**: Same merchant/description (normalised)
   - **Fuzzy match**: Similar words (Jaccard similarity above 60%)
   - **Amount range**: Similar GBP amounts (within ±10%)

### Confidence Scoring

The confidence score (0-100) in the Result sheet combines:
- **60%** — AI model confidence
- **40%** — Historical pattern strength
- **+15 bonus** — When AI and history agree
- **-15 penalty** — When AI and history disagree
- **Extra boost** — When manual overrides support the AI's choice

A confidence score below ~50 usually means the AI is guessing. Override these to train it.

## Tips for Better Categorisation

1. **Be consistent with overrides** — If you override "UBER *TRIP" as "Transport" once, do it every time. Inconsistent overrides confuse the learning
2. **Write detailed category descriptions** — "Restaurants, cafes, takeaways, and food delivery" is better than "Food out"
3. **Add real merchant names as examples** — The AI matches against these. Add the merchants you actually spend at
4. **Override low-confidence results first** — Focus your effort on transactions with confidence scores below 50
5. **Review after the first few runs** — The AI improves as it builds history, but the first run has no context to learn from. Expect to override more initially
6. **Use specific categories over general ones** — "Subscriptions" is better than dumping Netflix into "Entertainment" if you want to track recurring costs separately

## Re-categorising Transactions

### Re-categorise Uncategorised

The scheduled trigger automatically picks up any `NORMALISED` transactions that haven't been categorised yet. This runs every hour.

### Force Re-categorise All

To re-run AI categorisation on all transactions (e.g., after updating categories):

1. In the Apps Script editor, select `recategorizeAll` from the function dropdown
2. Click **Run**

This clears existing AI categories and re-processes everything. Manual overrides are preserved.
