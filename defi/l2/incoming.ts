import { getCurrentUnixTimestamp } from "../src/utils/date";
import { Chain } from "@defillama/sdk/build/general";
import BigNumber from "bignumber.js";
import { DollarValues, TokenTvlData } from "./types";
import { zero } from "./constants";
import { fetchBridgeTokenList, fetchSupplies, getPrices } from "./utils";

export async function fetchIncoming(params: { canonical: TokenTvlData; timestamp?: number }): Promise<TokenTvlData> {
  const canonicalTvls: TokenTvlData = params.canonical;
  const timestamp: number = params.timestamp ?? getCurrentUnixTimestamp();
  const data: TokenTvlData = {};
  await Promise.all(
    Object.keys(canonicalTvls).map(async (chain: Chain) => {
      try {
        const tokens: string[] = await fetchBridgeTokenList(chain);

        if (!tokens.length) {
          data[chain] = {};
          return;
        }

        const supplies = await fetchSupplies(chain, tokens, params.timestamp);

        const prices = await getPrices(Object.keys(supplies), timestamp);

        data[chain] = findDollarValues();

        function findDollarValues() {
          const dollarValues: DollarValues = {};
          Object.keys(supplies).map((t: string) => {
            const priceInfo = prices[t];
            const supply = supplies[t];
            if (!priceInfo || !supply) return;
            if (priceInfo.symbol in canonicalTvls[chain]) return;
            if (!(priceInfo.symbol in dollarValues)) dollarValues[priceInfo.symbol] = zero;
            const decimalShift: BigNumber = BigNumber(10).pow(BigNumber(priceInfo.decimals));
            const usdValue: BigNumber = BigNumber(priceInfo.price).times(BigNumber(supply)).div(decimalShift);
            dollarValues[priceInfo.symbol] = BigNumber(usdValue).plus(dollarValues[priceInfo.symbol]);
          });

          return dollarValues;
        }
      } catch (e) {
        console.error(`fetchIncoming() failed for ${chain} with ${e}`);
      }
    })
  );
  return data;
}
