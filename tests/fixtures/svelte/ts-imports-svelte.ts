// TS file that imports from Svelte module script
import { formatCurrency, type Currency } from "./ModuleScript.svelte";

export type PriceDisplay = {
	amount: number;
	currency: Currency;
	formatted: string;
};

export function createPriceDisplay(
	amount: number,
	currency: Currency,
): PriceDisplay {
	return {
		amount,
		currency,
		formatted: formatCurrency(amount, currency),
	};
}
