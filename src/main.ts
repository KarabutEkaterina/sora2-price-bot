import {ApiPromise, WsProvider} from '@polkadot/api';
import {options} from '@sora-substrate/api';
import "@sora-substrate/types/build/interfaces/augment-api-rpc";
import {AssetInfo} from '@sora-substrate/types/src/interfaces/assets';
import {formatBalance} from "@polkadot/util";
import {notifyNewPrice, startBot} from "./bot"

function planks(planks: bigint, assetInfo: AssetInfo): bigint {
    return planks * 10n ** (assetInfo.precision.toBigInt())
}

function presentBalance(planks: bigint, assetInfo: AssetInfo): string {
    return formatBalance(planks, {withSi: true, withUnit: assetInfo.symbol.toString()}, assetInfo.precision.toNumber())
}

function presentFiat(price: number): string {
    return price.toFixed(5) + "$"
}

function presentChange(newAmount: number, previousAmount: number | undefined): [number, string] {
    if (previousAmount == undefined) {
        previousAmount = newAmount
    }

    const change = newAmount - previousAmount

    const prefix = change >= 0 ? "+" : ""

    const changePercentage = change / previousAmount * 100.0

    return [changePercentage, `${prefix}${changePercentage.toFixed(3)}%`]
}

const DAI_AMOUNT = 1000n // 1k$

const DAI_ID = "0x0200060000000000000000000000000000000000000000000000000000000000"

const checked_assets = [
    "0x0200000000000000000000000000000000000000000000000000000000000000", // XOR
    "0x0200050000000000000000000000000000000000000000000000000000000000" // PSWAP
]

const PIN_THRESHOLD = 0.5

async function main() {
    await startBot()

    console.log("Connecting to node...");
    const provider = new WsProvider('wss://ws.sora2.soramitsu.co.jp');
    await provider.isReady;
    const api = await ApiPromise.create(options({provider}));
    await api.isReady;

    console.log("Done.");

    console.log("Retrieving asset infos...")

    const assetIds = checked_assets.map((idString) => api.createType('AssetId', idString))

    const DAIAssetId = api.createType('AssetId', DAI_ID);

    const assetInfos = (await Promise.all(
        assetIds.map((id) => api.rpc.assets.getAssetInfo(id))
    )).map((option) => option.unwrap())

    const DAIInfo = (await api.rpc.assets.getAssetInfo(DAIAssetId)).unwrap();

    let lastPrices = new Map<String, number>()

    const wantedDai = planks(DAI_AMOUNT, DAIInfo);

    await api.rpc.chain.subscribeNewHeads(async (header) => {
        console.log(`Chain is at block #${header.number}`)

        await Promise.all(
            assetInfos.map((assetInfo) => {
                const asset_id = assetInfo.asset_id

                api.rpc.liquidityProxy.quote(0, asset_id, DAIAssetId, wantedDai.toString(), "WithDesiredOutput", [], "Disabled")
                    .then((option) => {
                        console.log(`Received info for ${assetInfo.symbol} at #${header.number}`)

                        const requiredAssetAmount = option.unwrap().amount.toBigInt();

                        const currentPrice = parseFloat(wantedDai.toString()) / parseFloat(requiredAssetAmount.toString())

                        const previousPrice = lastPrices.get(asset_id)

                        if (previousPrice != currentPrice) {
                            lastPrices.set(asset_id, currentPrice)

                            const [change, display] = presentChange(currentPrice, previousPrice)
                            const shouldPin = Math.abs(change) > PIN_THRESHOLD

                            notifyNewPrice(
                                assetInfo.symbol,
                                `${assetInfo.symbol} price is ${presentFiat(currentPrice)} (${display}) at #${header.number}`, shouldPin)
                        }
                    })
            })
        )
    })
}

main().catch(console.error)
