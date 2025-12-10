<script lang="ts" module>
  /**
   * Shared utility function exported from module script
   */
  export function formatCurrency(
    amount: number,
    currency: string = 'USD',
  ): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }

  export type Currency = 'USD' | 'EUR' | 'GBP';

  export interface PriceConfig {
    showCents: boolean;
    currency: Currency;
  }
</script>

<p>Module script only component</p>
